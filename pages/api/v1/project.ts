import { NextApiRequest, NextApiResponse } from "next";

import { apiCatch, ClientError } from "@/modules/next-backend/api/errors";
import { sendJson } from "@/modules/next-backend/api/helpers";
import { db, redis } from "@/modules/next-backend/connections";
import { getDetailedProject } from "@/modules/next-backend/logic/getDetailedProject";

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  try {
    const { active, customUrl, projectId, ownerAddress, preset } = req.query;

    // TODO: define fromQuery$GetDetailedProject
    ClientError.assert(
      (!active ||
        (typeof active === "string" && /^(true|false)$/.test(active))) &&
        (!customUrl || typeof customUrl === "string") &&
        (!projectId || typeof projectId === "string") &&
        (!ownerAddress || typeof ownerAddress === "string") &&
        (customUrl || projectId || ownerAddress),
      { _debug: "Invalid request" }
    );

    ClientError.assert(
      preset === "minimal" || preset === "basic" || preset === "full",
      "invalid preset"
    );

    const response = await getDetailedProject(db, redis, {
      active: active === undefined ? undefined : active === "true",
      customUrl,
      projectId,
      ownerAddress,
      preset,
    });

    sendJson(res.status(200), response);
  } catch (error) {
    apiCatch(req, res, error);
  }
}
