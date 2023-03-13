import { Hex } from "@teiki/protocol/types";
import { Address, SignedMessage, toText } from "lucid-cardano";
import { NextApiRequest, NextApiResponse } from "next";

import * as Auth from "@/modules/authorization";
import { apiCatch } from "@/modules/next-backend/api/errors";
import { sendJson } from "@/modules/next-backend/api/helpers";
import { db } from "@/modules/next-backend/connections";
import { getTotalStakedByBacker } from "@/modules/next-backend/logic/getTotalStakedByBacker";
export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  try {
    const { backerAddress, projectId } = req.query;
    const token = req.headers["authorization"]?.split(" ")[1];
    if (token == null)
      throw new Error(JSON.stringify({ status: 401, message: "Unauthorized" }));
    else {
      const [address, payload, msg] = token.split(".");
      const signedMessage: SignedMessage = JSON.parse(
        Buffer.from(msg, "base64").toString("ascii")
      );
      const { expiration } = JSON.parse(toText(payload));
      if (!expiration) throw new Error("Invalid payload: missing expiration");
      else if (expiration * 1_000 < Date.now())
        throw new Error("Token expired: " + expiration);
      else {
        const isAuthorized = await Auth.verify({
          address,
          signedMessage,
          payload,
        });

        if (isAuthorized) {
          const result = await getTotalStakedByBacker(db, {
            backerAddress: backerAddress as Address,
            projectId: projectId as Hex,
          });

          sendJson(res.status(200), result);
        } else throw new Error("Unauthorized");
      }
    }
  } catch (error) {
    apiCatch(req, res, error);
  }
}
