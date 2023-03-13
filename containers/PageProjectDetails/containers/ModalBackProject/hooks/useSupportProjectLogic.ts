import * as React from "react";

import { getMaxLovelaceAmount } from "../utils/max";

import { parseLovelaceAmount } from "@/modules/bigint-utils";
import {
  isAbortError,
  useAsyncComputation,
} from "@/modules/common-hooks/hooks/useAsyncComputation";
import { useAppContextValue$Consumer } from "@/modules/teiki-contexts/contexts/AppContext";

export function useSupportProjectLogic() {
  const { walletStatus } = useAppContextValue$Consumer();
  const [lovelaceAmount$Input, setLovelaceAmount$Input] = React.useState("");
  const [message$Input, setMessage$Input] = React.useState("");

  const lovelaceAmount = parseLovelaceAmount(lovelaceAmount$Input);
  const message = message$Input;
  const walletLovelaceAmount =
    walletStatus.status === "connected"
      ? walletStatus.info.lovelaceAmount
      : undefined;
  const maxLovelaceAmount = useAsyncComputation(
    { walletLovelaceAmount },
    async ({ walletLovelaceAmount }) => {
      if (!walletLovelaceAmount) {
        return undefined;
      }
      try {
        const res = await getMaxLovelaceAmount({ walletLovelaceAmount });
        return res;
      } catch (e) {
        if (isAbortError(e)) throw e;
        return undefined;
      }
    }
  );

  const lovelaceAmount$SyntaxError =
    lovelaceAmount == null
      ? "Invalid number"
      : lovelaceAmount <
        2000000 /**TODO: @sk-tenba: import this number from somewhere */
      ? "You must back at least 2 ADA"
      : maxLovelaceAmount != undefined && maxLovelaceAmount < lovelaceAmount
      ? "Insufficient ADA balance"
      : undefined;

  const setLovelaceAmount = (lovelaceAmount: string) => {
    setLovelaceAmount$Input(lovelaceAmount.replace(/[^0-9.]+/g, ""));
  };

  const message$Error =
    message.length > 1500 ? "Exceed character limit" : undefined;

  return {
    input: {
      lovelaceAmount: lovelaceAmount$Input,
      setLovelaceAmount,
      message: message$Input,
      setMessage: setMessage$Input,
    },
    syntaxError: {
      lovelaceAmount: lovelaceAmount$SyntaxError,
      message: message$Error,
    },
    output: {
      lovelaceAmount: !lovelaceAmount$SyntaxError ? lovelaceAmount : undefined,
      message: !message$Error ? message : undefined,
      walletLovelaceAmount,
      maxLovelaceAmount,
    },
  };
}
