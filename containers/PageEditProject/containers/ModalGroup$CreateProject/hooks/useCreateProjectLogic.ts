import React from "react";

import { parseLovelaceAmount } from "@/modules/bigint-utils";
import { LovelaceAmount } from "@/modules/business-types";
import {
  isAbortError,
  useAsyncComputation,
} from "@/modules/common-hooks/hooks/useAsyncComputation";
import { useAppContextValue$Consumer } from "@/modules/teiki-contexts/contexts/AppContext";

const PADDING_LOVELACE_AMOUNT: LovelaceAmount = 5000000;

type Params = {
  projectSponsorshipMinFee?: LovelaceAmount;
};

export function useCreateProjectLogic({ projectSponsorshipMinFee }: Params) {
  const { walletStatus } = useAppContextValue$Consumer();
  const [lovelaceAmount$Input, setLovelaceAmount$Input] = React.useState("");

  const lovelaceAmount =
    lovelaceAmount$Input === ""
      ? BigInt(0)
      : parseLovelaceAmount(lovelaceAmount$Input);
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
        return BigInt(walletLovelaceAmount) - BigInt(PADDING_LOVELACE_AMOUNT);
      } catch (e) {
        if (isAbortError(e)) throw e;
        return undefined;
      }
    }
  );

  const lovelaceAmount$SyntaxError =
    projectSponsorshipMinFee == null
      ? "Trasaction parameters is not ready"
      : lovelaceAmount == null
      ? "Invalid number"
      : lovelaceAmount && lovelaceAmount < projectSponsorshipMinFee
      ? "Fails to reach the minimum sponsorship fee"
      : maxLovelaceAmount && maxLovelaceAmount < lovelaceAmount
      ? "There is not sufficient ADA in your wallet"
      : undefined;

  const setLovelaceAmount = (lovelaceAmount: string) => {
    setLovelaceAmount$Input(lovelaceAmount.replace(/[^0-9.]+/g, ""));
  };

  return {
    input: { lovelaceAmount: lovelaceAmount$Input, setLovelaceAmount },
    syntaxError: { lovelaceAmount: lovelaceAmount$SyntaxError },
    output: {
      lovelaceAmount: !lovelaceAmount$SyntaxError ? lovelaceAmount : undefined,
      walletLovelaceAmount,
      maxLovelaceAmount,
    },
  };
}
