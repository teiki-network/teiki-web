// This module is safe to load in front-end code

export type Base64 = string;

export type KeyType = "content" | "hmac";
export type KeyId = string;
export type CipherText<_ = unknown> = Base64;

// We're following JWE closely
export type CipherMeta = {
  enc: "proto";
  kid: KeyId;
  iv: Base64;
  tag: Base64;
  aad?: Base64 | undefined;
};
