import { useRouter } from "next/router";
import * as React from "react";

import { WALLET_LOGO } from "../../constants";

import IconArrowDropDown from "./icons/IconArrowDropDown";
import IconWarning from "./icons/IconWarning";
import styles from "./index.module.scss";

import { formatLovelaceAmount, formatUsdAmount } from "@/modules/bigint-utils";
import { useAppContextValue$Consumer } from "@/modules/teiki-contexts/contexts/AppContext";
import Divider from "@/modules/teiki-ui/components/Divider";
import InlineAddress from "@/modules/teiki-ui/components/InlineAddress";
import { WalletInfo } from "@/modules/wallet/types";

type Props = {
  onDisconnect: () => void;
  walletInfo: WalletInfo;
  disabled: boolean;
};

export default function ButtonWalletOptions({
  onDisconnect,
  walletInfo,
  disabled,
}: Props) {
  const router = useRouter();
  const { adaPriceInfo, walletNetworkWarning } = useAppContextValue$Consumer();
  const adaPriceInUsd = adaPriceInfo?.usd;
  const [showDropdown, setShowDropdown] = React.useState(false);

  return (
    <div className={styles.buttonWalletOptionsContainer}>
      <button
        onClick={() => setShowDropdown(!showDropdown)}
        className={styles.buttonWalletOptions}
        style={{
          borderRadius: showDropdown ? "20px 20px 0 0" : "20px",
        }}
        disabled={disabled}
      >
        <div className={styles.grid}>
          <div className={styles.walletInfo}>
            <div className={styles.wallet} title={walletNetworkWarning || ""}>
              {walletNetworkWarning ? (
                <IconWarning />
              ) : (
                WALLET_LOGO[walletInfo.walletName]
              )}
              <div>
                {/**TODO: @sk-tenba: integrate ada handle on navbar */}
                <InlineAddress
                  className={styles.address}
                  value={walletInfo.address}
                  length="short"
                />
              </div>
            </div>
          </div>
          <div className={styles.lineButtonWalletNavbar} />
          <div className={styles.walletInfo}>
            <div className={styles.assets}>
              <div className={styles.ada}>
                {formatLovelaceAmount(walletInfo.lovelaceAmount, {
                  includeCurrencySymbol: true,
                })}
              </div>
              <div className={styles.usd}>
                {adaPriceInUsd != null
                  ? formatUsdAmount(
                      {
                        lovelaceAmount: walletInfo.lovelaceAmount,
                        adaPriceInUsd,
                      },
                      {
                        includeAlmostEqualToSymbol: true,
                        includeCurrencySymbol: true,
                      }
                    )
                  : "-"}
              </div>
              <div className={styles.iconArrowDropDown}>
                <IconArrowDropDown />
              </div>
            </div>
          </div>
        </div>
      </button>
      {showDropdown ? (
        <div className={styles.walletOptions}>
          <button
            className={styles.optionButton}
            onClick={() => {
              setShowDropdown(false);
              router.push("/profile");
            }}
          >
            Profile
          </button>
          {/* TODO: @sk-tenba: implement these functionalities when design is ready */}
          {/* 
          <button className={styles.optionButton}>
            Activities
          </button>
          <button className={styles.optionButton}>
            My Backed Projects
          </button>
          <div className={styles.line} /> */}
          <Divider.Horizontal color="black-05" />
          <button
            className={styles.disconnectButton}
            onClick={() => {
              setShowDropdown(false);
              onDisconnect();
            }}
          >
            Disconnect Wallet
          </button>
        </div>
      ) : null}
    </div>
  );
}
