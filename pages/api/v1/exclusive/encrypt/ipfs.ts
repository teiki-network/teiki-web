import { NextApiRequest, NextApiResponse } from "next";

import { NEXT_PUBLIC_HOST } from "../../../../../config/client";
import {
  TEIKI_CONTENT_DEFAULT_KEY_ID,
  TEIKI_CONTENT_KEYS,
  TEIKI_HMAC_SECRET,
} from "../../../../../config/server";

import * as crypt from "@/modules/crypt";
import { apiCatch, ClientError } from "@/modules/next-backend/api/errors";
import { sendJson } from "@/modules/next-backend/api/helpers";
import {
  Cid,
  PinResult,
  pinToIpfs,
} from "@/modules/next-backend/logic/postIpfsPin";

export const config = {
  api: {
    bodyParser: false, // Disallow body parsing, consume as stream
    sizeLimit: "50mb",
  },
};

type Envelope = crypt.CipherMeta & PinResult & { preview: string };

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  try {
    ClientError.assert(req.method === "POST", {
      _debug: "invalid http method",
    });

    const { kid, key } = crypt.selectKey(
      TEIKI_CONTENT_KEYS,
      TEIKI_CONTENT_DEFAULT_KEY_ID
    );
    const iv = crypt.randomIv();
    const cipher = crypt.createCipher(key, iv);

    const pinned = await pinToIpfs(req, (file) => file.pipe(cipher));

    const meta: Omit<crypt.CipherMeta, "enc"> = {
      kid,
      iv: iv.toString(crypt.b64),
      tag: cipher.getAuthTag().toString(crypt.b64),
    };

    const preview =
      NEXT_PUBLIC_HOST +
      "/api/v1/exclusive/decrypt/ipfs/" +
      pinned.cid +
      "?" +
      new URLSearchParams({ ...meta, ...signIpfsUrl(pinned.cid, meta) });

    const ev: Envelope = {
      enc: "proto",
      ...meta,
      ...pinned,
      preview,
    };
    sendJson(res.status(200), ev);
  } catch (error) {
    apiCatch(req, res, error);
  }
}

// TODO: Export to a new module
function signIpfsUrl(
  cid: Cid,
  meta: Omit<crypt.CipherMeta, "enc">,
  ttl = 600
): { exp: string; sig: crypt.Base64 } {
  const exp = Math.round(Date.now() / 1000) + ttl;
  const sig = crypt.hmacSign(TEIKI_HMAC_SECRET, {
    json: { ...meta, cid, exp },
  });
  return { exp: exp.toString(), sig };
}
