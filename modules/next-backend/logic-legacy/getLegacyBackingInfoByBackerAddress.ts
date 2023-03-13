import Redis from "ioredis";

import { Sql } from "../db";
import { getBackerBackingUtxosByProjectId } from "../logic/getBackerBackingUtxosByProjectId";
import { getDetailedProject } from "../logic/getDetailedProject";
import { EnrichedUtxo } from "../types";

import { DetailedProject } from "@/modules/business-types";

type Params = {
  backerAddress: string;
};

export type LegacyBackingInfoByBacker = {
  newProjectId: string;
  project: DetailedProject;
  backingAmount: bigint;
};

type Result =
  | {
      error: null;
      backingInfo: LegacyBackingInfoByBacker[];
    }
  | { error: "not-found"; _debug?: unknown };

export async function getLegacyBackingInfoByBacker(
  sql: Sql,
  redis: Redis,
  { backerAddress }: Params
): Promise<Result> {
  const backingProjectIds = await sql`
    SELECT
      DISTINCT b.project_id as legacy_project_id
    FROM
      chain.backing b
    INNER JOIN
      chain.output o
    ON
      o.id = b.id
    WHERE
      b.backer_address = ${backerAddress}
      AND o.spent_slot is null
  `;

  if (!backingProjectIds.length) {
    return { error: "not-found" };
  }

  const backingInfo: LegacyBackingInfoByBacker[] = [];
  for (const { legacyProjectId } of backingProjectIds) {
    const backingUtxos: EnrichedUtxo[] = await getBackerBackingUtxosByProjectId(
      sql,
      {
        projectId: legacyProjectId,
        backerAddress,
      }
    );

    const backingAmount = backingUtxos.reduce(
      (acc: bigint, backingUtxo: EnrichedUtxo) =>
        acc + BigInt(backingUtxo.assets.lovelace),
      BigInt(0)
    );

    const projectResult = await getDetailedProject(sql, redis, {
      projectId: legacyProjectId,
      preset: "basic",
    });

    if (projectResult.error) continue;

    const projectIdResults = await sql`
      SELECT
        project_id
      FROM
        migration.project
      WHERE
        legacy_project_id = ${legacyProjectId}
    `;

    if (!projectIdResults.length) continue;

    backingInfo.push({
      newProjectId: projectIdResults[0].projectId,
      project: projectResult.project,
      backingAmount,
    });
  }

  return { error: null, backingInfo };
}
