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

  const lovelaceAmount = parseLovelaceAmount(lovelaceAmount$Input);
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
      : maxLovelaceAmount && maxLovelaceAmount < lovelaceAmount
      ? "There is not sufficient ADA in your wallet"
      : undefined;

  const setLovelaceAmount = (lovelaceAmount: string) => {
    setLovelaceAmount$Input(lovelaceAmount.replace(/[^0-9.]+/g, ""));
  };

  return {
    input: {
      lovelaceAmount: lovelaceAmount$Input,
      setLovelaceAmount,
    },
    syntaxError: {
      lovelaceAmount: lovelaceAmount$SyntaxError,
    },
    output: {
      lovelaceAmount: !lovelaceAmount$SyntaxError ? lovelaceAmount : undefined,
      walletLovelaceAmount,
      maxLovelaceAmount,
    },
  };
}
