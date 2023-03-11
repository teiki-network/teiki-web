// @sk-yagi: We should change this to something more Creator-related...
import { Sql } from "../db";

import {
  LovelaceAmount,
  ProjectId,
  UnixTimestamp,
} from "@/modules/business-types";

type Params = {
  projectId: ProjectId;
};

// Add optional field for error.
export type CreationActivity$Response =
  | {
      error: null;
      createdAt: UnixTimestamp;
      sponsorshipAmount: LovelaceAmount | null; // undefined means no sponsor
    }
  | {
      error: "no-project-found";
    };

export async function getProjectCreation(
  sql: Sql,
  { projectId }: Params
): Promise<CreationActivity$Response> {
  const creationData = await sql<
    { createdAt: UnixTimestamp; sponsorshipAmount: LovelaceAmount | null }[]
  >`
    SELECT
      b.time AS created_at,
      pd.sponsorship_amount
    FROM
      chain.project_detail pd
      INNER JOIN ipfs.project_info pi ON pi.cid = pd.information_cid
      INNER JOIN chain.output o ON o.id = pd.id
      INNER JOIN chain.block b ON o.created_slot = b.slot
    WHERE pd.project_id = ${projectId}
    ORDER BY pd.id
    LIMIT 1
  `;
  if (!creationData.length) {
    console.error("No project with given project ID found!!");
    return {
      error: "no-project-found",
    };
  } else {
    return {
      createdAt: creationData[0].createdAt.valueOf(),
      sponsorshipAmount: creationData[0].sponsorshipAmount,
      error: null,
    };
  }
}
