import { NextApiRequest, NextApiResponse } from "next";

import { assert } from "@/modules/common-utils";
import { apiCatch, ClientError } from "@/modules/next-backend/api/errors";
import { sendJson } from "@/modules/next-backend/api/helpers";
import { dbLegacy, redis } from "@/modules/next-backend/connections";
import { getLegacyBackingInfoByBacker } from "@/modules/next-backend/logic-legacy/getLegacyBackingInfoByBackerAddress";

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  try {
    const { backerAddress } = req.query;

    ClientError.assert(backerAddress && typeof backerAddress === "string", {
      _debug: "Invalid request",
    });

    assert(dbLegacy, "legacy db must be connected in legacy mode");
    const result = await getLegacyBackingInfoByBacker(dbLegacy, redis, {
      backerAddress,
    });

    // IIFE (https://developer.mozilla.org/en-US/docs/Glossary/IIFE)
    const response = (() => {
      switch (result.error) {
        case null:
          return { backingInfo: result.backingInfo };
        case "not-found":
          return { error: 59, _debug: result };
      }
    })();

    sendJson(res.status(200), response);
  } catch (error) {
    apiCatch(req, res, error);
  }
}
