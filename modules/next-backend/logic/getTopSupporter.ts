import Redis from "ioredis";
import { Address } from "lucid-cardano";

import { Sql } from "../db";

import { getAdaHandleByAddresses } from "./getAdaHandleByAddresses";

type Params = {
  projectId?: string;
};

type Response = {
  address: Address;
  lovelaceAmount: bigint;
  handle?: string;
}[];

export async function getTopSupporter(
  sql: Sql,
  redis: Redis,
  { projectId }: Params
): Promise<Response> {
  const results = await sql`
    SELECT
      b.backer_address,
      sum(b.backing_amount) lovelace_amount
    FROM
      chain.backing b
      INNER JOIN chain.output o ON o.id = b.id
    WHERE
      o.spent_slot IS NULL
      AND ${projectId != null ? sql`b.project_id = ${projectId}` : sql`TRUE`}
      AND NOT EXISTS (SELECT FROM admin.blocked_project bp WHERE bp.project_id = b.project_id)
    GROUP BY
      b.backer_address
    ORDER BY
      lovelace_amount DESC;
  `;
  const handles = await getAdaHandleByAddresses(redis, {
    addresses: results.map(({ backerAddress }) => backerAddress),
  });

  return results.map(({ backerAddress, lovelaceAmount }) => ({
    handle: handles[backerAddress][0],
    address: backerAddress,
    lovelaceAmount,
  }));
}
