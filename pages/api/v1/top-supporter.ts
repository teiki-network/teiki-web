import { NextApiRequest, NextApiResponse } from "next";

import { apiCatch } from "@/modules/next-backend/api/errors";
import { sendJson } from "@/modules/next-backend/api/helpers";
import { db, redis } from "@/modules/next-backend/connections";
import { getTopSupporter } from "@/modules/next-backend/logic/getTopSupporter";

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  try {
    const supporters = await getTopSupporter(db, redis, {});
    sendJson(res.status(200), { supporters });
  } catch (error) {
    apiCatch(req, res, error);
  }
}
