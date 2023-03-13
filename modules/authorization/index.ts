// Cardano web token

import { Address, Lucid, SignedMessage, fromText, toText } from "lucid-cardano";

import { toJsonStable } from "../json-utils";

export type AuthMessage = {
  version: number;
  expiration: number;
  message: string;
};

export type AuthToken = {
  signedMessage: SignedMessage;
  payload: string;
};

// Sign a message
export async function sign(
  lucid: Lucid,
  authMessage: AuthMessage
): Promise<AuthToken> {
  const payload = fromText(toJsonStable(authMessage, undefined, 4));
  const signedMessage = await lucid
    .newMessage(await lucid.wallet.address(), payload)
    .sign();

  return {
    signedMessage,
    payload,
  };
}

// Verify the message
export async function verify({
  address,
  signedMessage,
  payload,
}: {
  address: Address;
  signedMessage: SignedMessage;
  payload: string;
}): Promise<boolean> {
  return (await Lucid.new()).verifyMessage(address, payload, signedMessage);
}

export function getAuthMessage({
  version = 1,
  ttl = 600_000,
}: {
  version?: number;
  ttl?: number;
}): AuthMessage {
  return {
    version,
    expiration: Math.floor((Date.now() + ttl) / 1_000),
    message: "Login to Teiki",
  };
}

export function getHeader({
  token,
  address,
}: {
  token: AuthToken;
  address: Address;
}) {
  return new Headers({
    Authorization: `Token ${address}.${token.payload}.${Buffer.from(
      JSON.stringify(token.signedMessage)
    ).toString("base64")}`,
  });
}

export async function refresh(lucid: Lucid) {
  const authMessage: AuthMessage = getAuthMessage({});
  const tokenLS = localStorage.getItem("auth");
  const expiration = tokenLS ? JSON.parse(toText(tokenLS))["expiration"] : 0;
  if (expiration * 1_000 < Date.now()) {
    const token = await sign(lucid, authMessage);
    localStorage.setItem("auth", toJsonStable(token));
  }
}
