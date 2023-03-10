import { getMaxLovelaceAmount } from "../utils/max";

import {
  isAbortError,
  useAsyncComputation,
} from "@/modules/common-hooks/hooks/useAsyncComputation";
import { useAppContextValue$Consumer } from "@/modules/teiki-contexts/contexts/AppContext";

// TODO: @sk-kitsune: After moving two fields out of this hook, now this
// hook only calculates the max lovelace amount. We will use the proper
// algorithm to calculate the max lovelace amount.
export function useSupportProjectLogic() {
  const { walletStatus } = useAppContextValue$Consumer();

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

  return {
    output: {
      walletLovelaceAmount,
      maxLovelaceAmount,
    },
  };
}
