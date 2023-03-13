import Redis from "ioredis";

import { Sql } from "../db";

import { getAdaHandleByAddresses } from "./getAdaHandleByAddresses";

import {
  Address,
  ProjectActivity,
  ProjectUpdateScope,
  PROJECT_UPDATE_SCOPE,
} from "@/modules/business-types";
import { ActivitiesActorRelationship } from "@/modules/next-backend-client/api/httpGetAllActivities";

export type Params = {
  actor: Address;
  relationship: ActivitiesActorRelationship;
  cursor?: string;
  limit?: number;
};

/**
 * The cursor will have this 'Unix_time#Action#SomeId' pattern,
 * where negative id indicates unbacking action
 * (this guarantees the linear property of our key)
 */
type Response = {
  activities: ProjectActivity[];
  nextCursor: string | null;
};

/**
 * Assumption:
 * 1 = back
 * 2 = unback
 * 3 = announcement
 * 4 = protocol landmark reached
 * 5 = project update
 */

export async function getAllActivities(
  sql: Sql,
  redis: Redis,
  { actor, relationship, cursor, limit = 50 }: Params
): Promise<Response> {
  // TODO: Clean this mess...
  const [_cursorTime, cursorAction, cursorOutputId] = cursor
    ? cursor.split("#")
    : [null, null, null];

  const cursorTime = _cursorTime ? _cursorTime?.slice(0, -3) : null; // remove the last three digits

  const results = await sql`
    WITH
    all_referenced_projects AS (
      SELECT
        DISTINCT p.project_id, p.owner_address
      FROM
        chain.project p
        LEFT JOIN chain.backing b ON p.project_id = b.project_id
        WHERE ${
          relationship === "owned_by"
            ? sql`p.owner_address = ${actor}`
            : sql`(b.backer_address = ${actor} OR p.owner_address = ${actor})`
        }
    ),
    -- Query all announcements
    res_announcement AS (
      SELECT
        a.project_id AS project_id,
        bl.time AS time,
        (pcu.data -> 'data' -> 'title') AS title,
        a.owner_address AS created_by,
        o.id AS output_id,
        o.tx_id AS created_tx,
        3 AS action
      FROM
        (SELECT * FROM
          (
            SELECT id, pd.project_id, arp.owner_address, last_announcement_cid AS announcement_cid, lag(last_announcement_cid)
              OVER (
                PARTITION BY pd.project_id
                ORDER BY id
              )
              AS prev_announcement_cid
              FROM chain.project_detail pd
              INNER JOIN all_referenced_projects arp ON arp.project_id = pd.project_id
          ) _a
          WHERE announcement_cid IS DISTINCT FROM prev_announcement_cid
        ) AS a
        INNER JOIN chain.output o ON a.id = o.id
        INNER JOIN chain.block bl ON o.created_slot = bl.slot
        INNER JOIN ipfs.project_announcement pcu ON a.announcement_cid = pcu.cid
      ORDER BY bl.slot DESC
    ),

    -- Query Project update scope
    update_list AS (
      SELECT * FROM (
        SELECT
          id,
          pd.project_id,
          pd.sponsorship_until,
          pd.sponsorship_amount,
          information_cid AS information_cid,
          LAG(sponsorship_until) OVER w AS prev_sponsorship_until,
          LAG(sponsorship_amount) OVER w AS prev_sponsorship_amount,
          LAG(information_cid) OVER w AS prev_information_cid
          FROM chain.project_detail pd
          WHERE EXISTS (SELECT FROM all_referenced_projects a WHERE a.project_id = pd.project_id)
          WINDOW w AS (PARTITION BY pd.project_id ORDER BY id)
      ) _a
      WHERE
        information_cid IS DISTINCT FROM prev_information_cid
          OR sponsorship_until IS DISTINCT FROM prev_sponsorship_until
          OR sponsorship_amount IS DISTINCT FROM prev_sponsorship_amount
    ),

    res_update AS (
      SELECT
        ru.project_id,
        ru."time",
        ru.id AS output_id,
        ru.owner_address AS created_by,
        ru.tx_id AS created_tx,
        ru.sponsorship_amount,
        5 AS action,
        (ru.contents #> '{data, community}' IS DISTINCT FROM ru.prev_contents #> '{data, community}') AS community,
        (ru.contents #> '{data, description}' IS DISTINCT FROM ru.prev_contents #> '{data, description}') AS description,
        (ru.contents #> '{data, benefits}' IS DISTINCT FROM ru.prev_contents #> '{data, benefits}') AS benefits,
        (ru.contents #> '{data, basics, tags}' IS DISTINCT FROM ru.prev_contents #> '{data, basics, tags}') AS tags,
        (ru.contents #> '{data, basics, title}' IS DISTINCT FROM ru.prev_contents #> '{data, basics, title}') AS title,
        (ru.contents #> '{data, basics, slogan}' IS DISTINCT FROM ru.prev_contents #> '{data, basics, slogan}') AS slogan,
        (ru.contents #> '{data, basics, summary}' IS DISTINCT FROM ru.prev_contents #> '{data, basics, summary}') AS summary,
        (ru.contents #> '{data, basics, customUrl}' IS DISTINCT FROM ru.prev_contents #> '{data, basics, customUrl}') AS custom_url,
        (ru.contents #> '{data, basics, logoImage}' IS DISTINCT FROM ru.prev_contents #> '{data, basics, logoImage}') AS logo_image,
        (ru.contents #> '{data, basics, coverImages}' IS DISTINCT FROM ru.prev_contents #> '{data, basics, coverImages}') AS cover_images,
        ( ru.sponsorship_until IS DISTINCT FROM ru.prev_sponsorship_until
            OR ru.sponsorship_amount IS DISTINCT FROM ru.prev_sponsorship_amount
        ) AS sponsorship
      FROM (
        SELECT
          ul.id,
          ul.project_id,
          b.time,
          arp.owner_address,
          o.tx_id,
          ul.sponsorship_amount,
          ul.sponsorship_until,
          ul.information_cid AS cid,
          pi2.contents AS contents,
          LAG(contents) OVER w AS prev_contents,
          LAG(sponsorship_until) OVER w AS prev_sponsorship_until,
          LAG(sponsorship_amount) OVER w AS prev_sponsorship_amount
        FROM
          update_list ul
          INNER JOIN ipfs.project_info pi2 ON pi2.cid = ul.information_cid
          INNER JOIN chain.output o ON o.id = ul.id
          INNER JOIN chain.block b ON b.slot = o.created_slot
          INNER JOIN all_referenced_projects arp ON arp.project_id = ul.project_id
        WINDOW w AS (PARTITION BY ul.project_id ORDER BY ul.id)
      ) ru
      WHERE
        (ru.contents IS DISTINCT FROM ru.prev_contents AND ru.prev_contents IS NOT NULL)
          OR sponsorship_until IS DISTINCT FROM prev_sponsorship_until
          OR sponsorship_amount IS DISTINCT FROM prev_sponsorship_amount
    ),

    -- Query Project protocol-milestone reached
    res_milestone AS (
      SELECT
        mr.project_id AS project_id,
        bl.time AS time,
        mr.owner_address AS created_by,
        o.tx_id AS created_tx,
        o.id AS output_id,
        4 AS action,
        mr.milestone_reached AS milestone
      FROM (
        SELECT * FROM (
          SELECT id, p.project_id, arp.owner_address, milestone_reached AS milestone_reached, lag(milestone_reached)
            OVER (
              PARTITION BY p.project_id
              ORDER BY id
            )
            AS prev_milestone_reached
            FROM chain.project p
            INNER JOIN all_referenced_projects arp ON arp.project_id = p.project_id
        ) _mr
        WHERE milestone_reached IS DISTINCT FROM prev_milestone_reached AND milestone_reached > 0
      ) AS mr
        INNER JOIN chain.output o ON mr.id = o.id
        INNER JOIN chain.block bl ON o.created_slot = bl.slot
      ORDER BY bl.slot DESC
    ),

    -- All back/unback activites
    res_backing AS (
      SELECT
        ba.project_id,
        ba.actor_address AS created_by,
        ba.tx_id AS created_tx,
        ba.time,
        ba.message,
        ba.amount,
        ba.id AS output_id,
        (CASE WHEN ba.action = 'back' THEN 1 ELSE 2 END) AS action
      FROM
        chain.backing_action ba
      WHERE
        ${
          relationship === "owned_by"
            ? sql`ba.actor_address = ${actor}`
            : sql`EXISTS (SELECT FROM all_referenced_projects a WHERE a.project_id = ba.project_id)`
        }
        AND (ba.action = 'back' OR ba.action = 'unback')
      ORDER BY ba.time DESC NULLS LAST
    )

    SELECT * FROM (
      SELECT
        ra.project_id AS project_id,
        ra.time AS time,
        null AS message,
        ra.created_by AS created_by,
        ra.created_tx AS created_tx,
        ra.output_id AS output_id,
        ra.action AS action,
        null AS amount,
        ra.title AS announcement_title,
        null::smallint AS milestone,
        null::boolean AS description,
        null::boolean AS benefits,
        null::boolean AS title,
        null::boolean AS slogan,
        null::boolean AS custom_url,
        null::boolean AS tags,
        null::boolean AS summary,
        null::boolean AS cover_images,
        null::boolean AS logo_image,
        null::boolean AS community,
        null::boolean AS sponsorship,
        null::bigint AS sponsorship_amount
      FROM res_announcement ra
      UNION ALL
      SELECT
        rb.project_id AS project_id,
        rb.time AS time,
        rb.message AS message,
        rb.created_by AS created_by,
        rb.created_tx AS created_tx,
        rb.output_id AS output_id,
        rb.action AS action,
        rb.amount AS amount,
        null AS announcement_title,
        null::smallint AS milestone,
        null::boolean AS description,
        null::boolean AS benefits,
        null::boolean AS title,
        null::boolean AS slogan,
        null::boolean AS custom_url,
        null::boolean AS tags,
        null::boolean AS summary,
        null::boolean AS cover_images,
        null::boolean AS logo_image,
        null::boolean AS community,
        null::boolean AS sponsorship,
        null::bigint AS sponsorship_amount
      FROM res_backing rb
      UNION ALL
      SELECT
        rm.project_id AS project_id,
        rm.time AS time,
        null AS message,
        rm.created_by AS created_by,
        rm.created_tx AS created_tx,
        rm.output_id AS output_id,
        rm.action AS action,
        null AS amount,
        null AS announcement_title,
        rm.milestone AS milestone,
        null::boolean AS description,
        null::boolean AS benefits,
        null::boolean AS title,
        null::boolean AS slogan,
        null::boolean AS custom_url,
        null::boolean AS tags,
        null::boolean AS summary,
        null::boolean AS cover_images,
        null::boolean AS logo_image,
        null::boolean AS community,
        null::boolean AS sponsorship,
        null::bigint AS sponsorship_amount
      FROM res_milestone rm
      UNION ALL
      SELECT
        ru.project_id AS project_id,
        ru.time AS time,
        null AS message,
        ru.created_by AS created_by,
        ru.created_tx AS created_tx,
        ru.output_id AS output_id,
        ru.action AS action,
        null AS amount,
        null AS announcement_title,
        null::smallint AS milestone,
        ru.description AS description,
        ru.benefits AS benefits,
        ru.title AS title,
        ru.slogan AS slogan,
        ru.custom_url AS custom_url,
        ru.tags AS tags,
        ru.summary AS summary,
        ru.cover_images AS cover_images,
        ru.logo_image AS logo_image,
        ru.community AS community,
        ru.sponsorship,
        ru.sponsorship_amount
      FROM res_update ru
    ) res
    WHERE ${
      cursorTime && cursorAction && cursorOutputId
        ? sql`(time, action, output_id) < (SELECT to_timestamp(${cursorTime}), ${cursorAction}::int8, ${cursorOutputId}::int8)`
        : sql`TRUE`
    } AND NOT EXISTS (SELECT FROM admin.blocked_project bp WHERE bp.project_id = res.project_id)
    ORDER BY (time, action, output_id) DESC NULLS LAST
    LIMIT ${limit + 1}
  `;

  // TODO: Refine the below code!
  // Note that we ignore the last additional element (limit + 1).
  let nextCursor;
  if (results.length > limit && limit > 0) {
    nextCursor =
      results[results.length - 2].time.valueOf() +
      "#" +
      results[results.length - 2].action +
      "#" +
      results[results.length - 2].outputId;
  } else {
    nextCursor = null;
  }

  const handles = await getAdaHandleByAddresses(redis, {
    addresses: results
      .filter((result) => result.action === 1 || result.action === 2)
      .map((result) => result.createdBy),
  });

  const _activities: ProjectActivity[] = results.map((result) => {
    const commonFields = {
      projectId: result.projectId,
      createdAt: result.time?.valueOf(),
      createdBy: result.createdBy,
    };

    let res;
    switch (result.action) {
      case 1:
        res = {
          ...commonFields,
          action: {
            type: "back",
            lovelaceAmount: result.amount,
            createdBy: result.createdBy,
            createdByHandle: handles[result.createdBy][0],
            createdTx: result.createdTx,
            message: result.message,
          },
        };
        break;
      case 2:
        res = {
          ...commonFields,
          action: {
            type: "unback",
            lovelaceAmount: result.amount,
            createdBy: result.createdBy,
            createdByHandle: handles[result.createdBy][0],
            createdTx: result.createdTx,
            message: result.message,
          },
        };
        break;
      case 3:
        res = {
          ...commonFields,
          action: {
            type: "announcement",
            title: result.announcementTitle,
            projectTitle: "",
            message: null,
          },
        };
        break;
      case 4:
        res = {
          ...commonFields,
          action: {
            type: "protocol_milestone_reached",
            projectTitle: "",
            milestonesSnapshot: result.milestone,
            message: null,
          },
        };
        break;
      case 5: {
        const scope: ProjectUpdateScope[] = [];
        for (const s of PROJECT_UPDATE_SCOPE) {
          if (!result[s]) continue;
          scope.push(
            s === "sponsorship"
              ? {
                  type: "sponsorship",
                  sponsorshipAmount: result["sponsorshipAmount"],
                }
              : { type: s }
          );
        }
        res = {
          ...commonFields,
          action: {
            type: "project_update",
            projectTitle: "",
            scope,
            message: null,
          },
        };
        break;
      }
      default:
        console.error("Unexpected action tag!!!");
    }
    return res as ProjectActivity;
  });

  // Drop the additional element (if any)
  const activities: ProjectActivity[] = _activities.slice(0, limit);

  return { activities, nextCursor };
}
