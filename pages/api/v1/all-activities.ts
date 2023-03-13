import { NextApiRequest, NextApiResponse } from "next";

import { apiCatch, ClientError } from "@/modules/next-backend/api/errors";
import { sendJson } from "@/modules/next-backend/api/helpers";
import { db, redis } from "@/modules/next-backend/connections";
import { getAllActivities } from "@/modules/next-backend/logic/getAllActivities";
import {
  ActivitiesActorRelationship,
  ACTOR_RELATIONSHIP,
} from "@/modules/next-backend-client/api/httpGetAllActivities";

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  try {
    const { actor, relationship, cursor, limit } = req.query;

    ClientError.assert(
      typeof actor === "string" &&
        isActorRelationship(relationship) &&
        (!cursor || typeof cursor === "string") &&
        (!limit || (typeof limit === "string" && /^[0-9]+$/.test(limit))),
      { _debug: "Invalid request" }
    );

    const activities = await getAllActivities(db, redis, {
      actor,
      relationship,
      cursor,
      limit: Number(limit),
    });

    sendJson(res.status(200), activities);
  } catch (error) {
    apiCatch(req, res, error);
  }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const isActorRelationship = (x: any): x is ActivitiesActorRelationship =>
  ACTOR_RELATIONSHIP.includes(x);
