import Redis from "ioredis";

import { NEXT_PUBLIC_AI_URL } from "../../../config/client";
import { Sql } from "../db";
import { MODERATION_TAGS } from "../types";
import { CodecCid } from "../utils/CodecCid";

import { getAdaHandleByAddresses } from "./getAdaHandleByAddresses";
import { getAllAnnouncementsByProjectId } from "./getAllAnnouncementsByProjectId";
import { getAllProjectMilestoneSnapshots } from "./getAllProjectMilestoneSnapshots";
import { getAllProjectUpdates } from "./getAllProjectUpdates";
import {
  getBackingActivities,
  ProjectBackingActivity,
} from "./getBackingActivitiesByProjectId";
import { getBackingTags } from "./getBackingTags";
import { getTopSupporter } from "./getTopSupporter";

import { httpPostContentModeration } from "@/modules/ai/api/httpPostContentModeration";
import { httpPostTagsRecommendation } from "@/modules/ai/api/httpPostTagsRecommendation";
import { try$ } from "@/modules/async-utils";
import {
  DetailedProject,
  Project,
  ProjectActivity,
  ProjectActivityAction,
  ProjectBenefits,
} from "@/modules/business-types";
import { assert } from "@/modules/common-utils";
import { WithBufsAs } from "@/modules/with-bufs-as";
import { Converters } from "@/modules/with-bufs-as-converters";

const ERRORS = {
  NOT_FOUND: 48,
} as const;

export const GET_DETAILED_PROJECT__ERRORS = ERRORS;

type Cid = string;

type Params = {
  active?: boolean;
  customUrl?: string;
  projectId?: string;
  ownerAddress?: string;
  relevantAddress?: string;
  preset: "minimal" | "basic" | "full";
};

export type GetDetailedProject$Params = Params;

type Response =
  | { error?: undefined; project: DetailedProject }
  | { error: typeof ERRORS.NOT_FOUND; _debug?: unknown };

export type GetDetailedProject$Response = Response;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function isWithBufsAs<T, V>(obj: any): obj is WithBufsAs<T, V> {
  return typeof obj?.data === "object" && typeof obj?.bufs === "object";
}

// When calculating average update time for
// closed projects, should the time range end
// be the closed time or the current time?
export async function getDetailedProject(
  sql: Sql,
  redis: Redis,
  params: Params
): Promise<Response> {
  assert(
    params.customUrl || params.projectId || params.ownerAddress,
    "at least one filter is required"
  );
  const sqlBase = sql`
    SELECT
      (
        SELECT
          max(b.time) AS project_closed_time
        FROM
          chain.project p
          INNER JOIN chain.output o ON p.id = o.id
          INNER JOIN chain.block b ON o.created_slot = b.slot
        WHERE
          o.spent_slot IS NULL
          AND p.project_id = d.project_id
          AND p.status in ('delisted', 'closed')
          AND NOT EXISTS (SELECT FROM admin.blocked_project bp WHERE bp.project_id = p.project_id)
        LIMIT
          1
      ),
      (
        SELECT
          EXTRACT (
            EPOCH
            FROM
              (current_timestamp - ps.created_time)
          ) / (
            COUNT (DISTINCT pd.last_announcement_cid) + 1
          ) * 1000 AS average_milliseconds_between_project_updates
        FROM
          chain.project_detail pd
          INNER JOIN views.project_summary ps ON pd.project_id = ps.project_id
        WHERE
          pd.project_id = d.project_id
        GROUP BY
          ps.created_time
        LIMIT
          1
      ),
      (
        SELECT
          project_id is not null as is_featured
        FROM
          admin.featured_project
        WHERE
          project_id = d.project_id
      ),
      d.project_id,
      d.sponsorship_until,
      pi.contents,
      s.*,
      pcm.*
    FROM
      chain.project_detail d
    INNER JOIN chain.output o
      ON d.id = o.id
    INNER JOIN ipfs.project_info pi
      ON d.information_cid = pi.cid
    INNER JOIN views.project_summary s
      ON s.project_id = d.project_id
    INNER JOIN
      (
        SELECT p.* FROM chain.project p
        INNER JOIN chain.output o ON p.id = o.id
        WHERE
          o.spent_slot IS NULL
      ) as p ON p.project_id = d.project_id
    LEFT JOIN ai.project_moderation pcm
      ON d.information_cid = pcm.cid
  `;

  const sqlProjectIdMatch = params.projectId
    ? sql`d.project_id = ${params.projectId}`
    : sql`TRUE`;
  const sqlOwnerAddressMatch = params.ownerAddress
    ? sql`s.owner_address = ${params.ownerAddress}`
    : sql`TRUE`;
  const sqlActiveStatus =
    params.active === undefined
      ? sql`TRUE`
      : params.active
      ? sql`p.status = 'active'`
      : sql`p.status in ('delisted', 'closed')`;
  const results = await (params.customUrl
    ? sql`
        ${sqlBase}
        INNER JOIN views.project_custom_url mapping
          ON mapping.project_id = d.project_id
        WHERE
          mapping.custom_url = ${params.customUrl}
          AND ${sqlProjectIdMatch}
          AND ${sqlOwnerAddressMatch}
          AND ${sqlActiveStatus}
        ORDER BY
          o.created_slot DESC
        LIMIT 1
      `
    : sql`
        ${sqlBase}
        WHERE
          ${sqlProjectIdMatch}
          AND ${sqlOwnerAddressMatch}
          AND ${sqlActiveStatus}
        ORDER BY
          o.created_slot DESC
          LIMIT 1
      `);

  const row = results[0];

  if (!row) {
    return { error: ERRORS.NOT_FOUND };
  }

  const {
    projectId,
    sponsorshipUntil,
    sponsorshipAmount,
    isFeatured,
    contents,
    createdTime,
    lastUpdatedTime,
    // @sk-yagi: Comment out for now, we havent use this yet.
    // totalBackingAmount,
    // @sk-yagi: This field indicates total ADA amount
    // used to generate staking rewards for project,
    // including `totalBackingAmount` from backers as well as
    // all ADA in project-related UTxOs. This matches `Active stake` on UI
    totalStakingAmount,
    backerCount,
    ownerAddress,
    projectClosedTime,
    averageMillisecondsBetweenProjectUpdates,
    withdrawnFunds,
    availableFunds,
    totalRaisedFunds,
  } = row;

  const { description, basics, roadmap, benefits, community } = await try$<
    Partial<Project>
  >(
    () => {
      assert(isWithBufsAs<Project, Cid>(contents));
      return Converters.toProject(CodecCid)(contents);
    },
    () => ({})
  );

  const project: DetailedProject = {
    id: projectId,
  };

  if (params.preset === "basic" || params.preset === "full") {
    Object.assign(project, {
      basics,
      community,
      history: {
        createdBy: ownerAddress,
        createdAt: createdTime,
        updatedAt: lastUpdatedTime,
        closedAt: projectClosedTime,
        // FIXME: @sk-umiuma: Wait for delist index
        delistedAt: undefined,
      },
      stats: {
        numSupporters: backerCount,
        numLovelacesStaked: totalStakingAmount,
        numLovelaceWithdrawn: withdrawnFunds,
        numLovelacesAvailable: availableFunds,
        numLovelacesRaised: totalRaisedFunds,
        averageMillisecondsBetweenProjectUpdates,
      },
      categories: {
        featured: isFeatured,
        sponsor: sponsorshipUntil >= Date.now(),
      },
      censorship: MODERATION_TAGS.filter((t) => row[t]),
      sponsorshipAmount,
      sponsorshipUntil,
    });
  }

  if (params.preset === "full") {
    const [
      announcements,
      { backingData },
      projectUpdates,
      allProjectProtocolMilestoneSnapshots,
      topSupporters,
    ] = await Promise.all([
      // TODO: Use `getAllActivities` instead
      getAllAnnouncementsByProjectId(sql, {
        projectId,
      }),
      // TODO: @sk-umiuma: implement these
      getBackingActivities(sql, {
        projectId,
      }),
      getAllProjectUpdates(sql, {
        projectId,
      }),
      getAllProjectMilestoneSnapshots(sql, {
        projectId,
      }),
      getTopSupporter(sql, redis, { projectId }),
    ]);

    const activities = await backingDataToActivities(redis, backingData);
    // Announcement
    announcements.forEach((announcement) => {
      const action: ProjectActivityAction = {
        type: "announcement",
        projectTitle: project.basics?.title ?? ownerAddress,
        title: announcement.title,
        message: null, // @sk-yagi: For now there's no message when project post announcement
      };
      // TODO: @sk-yagi: Index correct time
      const createdAt = announcement.createdAt ?? 1672506000000; // 1/1/2023, 12:00:00 AM
      activities.push({
        createdAt,
        createdBy: ownerAddress,
        action,
      });
    });

    // Project Update
    projectUpdates.forEach((update) => {
      const action: ProjectActivityAction = {
        type: "project_update",
        projectTitle: project.basics?.title ?? ownerAddress,
        scope: update.scope,
        message: null, // @sk-yagi: For now there's no message when project update
      };
      activities.push({
        createdAt: update.time,
        createdBy: ownerAddress,
        action,
      });
    });

    // Protocol milestones
    allProjectProtocolMilestoneSnapshots.forEach((snapshot) => {
      const action: ProjectActivityAction = {
        type: "protocol_milestone_reached",
        projectTitle: project.basics?.title ?? ownerAddress,
        milestonesSnapshot: snapshot.milestoneReached,
        message: null, // @sk-yagi: For now there's no message when project reached protocol milestone
      };
      activities.push({
        createdAt: snapshot.time,
        createdBy: ownerAddress,
        action,
      });
    });

    let match: number | undefined = undefined;
    if (params.relevantAddress != null && project.basics != null) {
      const { tags: targetTag } = await getBackingTags(sql, {
        relevantAddress: params.relevantAddress,
      });
      const listTags = [project.basics?.tags];
      const { recommend } = await httpPostTagsRecommendation({
        baseUrl: NEXT_PUBLIC_AI_URL,
        targetTag,
        listTags,
      });

      match = recommend[0];
    }

    Object.assign(project, {
      description,
      roadmap,
      announcements,
      benefits: benefits ?? emptyProjectBenefits(),
      activities,
      topSupporters,
      match,
    });
  }

  return { error: undefined, project };
}

async function backingDataToActivities(
  redis: Redis,
  backingData: ProjectBackingActivity[]
): Promise<ProjectActivity[]> {
  const activities: ProjectActivity[] = [];
  const handles = await getAdaHandleByAddresses(redis, {
    addresses: backingData.map(({ actor }) => actor),
  });
  await Promise.all(
    backingData.map(async (data) => {
      let message$ModeratedTags: string[] = [];
      if (data.message) {
        try {
          const _message$ModeratedTags = await httpPostContentModeration({
            baseUrl: NEXT_PUBLIC_AI_URL,
            text: data.message ?? "",
          });
          message$ModeratedTags = _message$ModeratedTags.tags;
        } catch (error) {
          console.error(error);
        }
      }

      const action: ProjectActivityAction = {
        type: data.action,
        createdBy: data.actor,
        createdByHandle: handles[data.actor][0],
        lovelaceAmount: data.amount,
        message: data.message,
        message$ModeratedTags,
        createdTx: data.txId,
      };
      activities.push({
        createdAt: data.time,
        createdBy: data.actor,
        action,
      });
    })
  );
  return activities;
}

// TODO: Clean up this later
function emptyProjectBenefits(): ProjectBenefits {
  return {
    perks: {
      type: "doc",
      content: [{ type: "paragraph" }],
    },
  };
}
