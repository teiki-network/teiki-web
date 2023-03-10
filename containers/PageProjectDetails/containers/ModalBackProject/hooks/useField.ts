import React from "react";

import { parseLovelaceAmount } from "@/modules/bigint-utils";
import { LovelaceAmount } from "@/modules/business-types";

export function useField$Message() {
  const [text, setText] = React.useState("");
  const error = text.length > 1500 ? "Exceed character limit" : undefined;
  const parsed = !error ? text : undefined;
  return { text, setText, error, parsed };
}

export function useField$LovelaceAmount({
  maxLovelaceAmount,
}: {
  maxLovelaceAmount: LovelaceAmount | undefined;
}) {
  const [text, setText] = React.useState("");
  const parsed = parseLovelaceAmount(text);
  const error =
    parsed == null
      ? "Invalid number"
      : parsed < 2000000 // TODO: @sk-tenba: import this number from somewhere
      ? "You must back at least 2 ADA"
      : // TODO: @sk-kitsune: We should not use `maxLovelaceAmount`
      // if it is not accurate.
      maxLovelaceAmount && maxLovelaceAmount < parsed
      ? "There is not sufficient ADA in your wallet"
      : undefined;

  // TODO: @sk-kitsune: we should also set onKeyDown at the call site
  const handleTextChange = (text: string) => {
    setText(text.replace(/[^0-9.]+/g, ""));
  };
  return { text, setText: handleTextChange, parsed, error };
}
