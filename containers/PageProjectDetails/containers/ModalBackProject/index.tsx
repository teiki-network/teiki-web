import cx from "classnames";
import * as React from "react";

import ErrorBox from "../../../PageUpdateProjectV2/components/ErrorBox";

import { TxBreakdown, useEstimatedFees } from "./hooks/useEstimatedFees";
import { useField$LovelaceAmount, useField$Message } from "./hooks/useField";
import { useMaxLovelaceAmount } from "./hooks/useMaxLovelaceAmount";
import IconRewardStar from "./icons/IconRewardStar";
import styles from "./index.module.scss";
import { buildTx, BuildTxParams } from "./utils/transaction";

import { useAdaPriceInfo } from "@/modules/ada-price-provider";
import { tryUntil } from "@/modules/async-utils";
import { sumTxBreakdown } from "@/modules/bigint-utils";
import { LovelaceAmount } from "@/modules/business-types";
import { assert } from "@/modules/common-utils";
import { DisplayableError } from "@/modules/displayable-error";
import httpGetBackingActivitiesByTxHash from "@/modules/next-backend-client/api/httpGetBackingActivitiesByTxHash";
import { useTxParams$BackerBackProject } from "@/modules/next-backend-client/hooks/useTxParams$BackerBackProject";
import InputLovelaceAmount from "@/modules/teiki-components/components/InputLovelaceAmount";
import PanelFeesBreakdown from "@/modules/teiki-components/components/PanelFeesBreakdown";
import IconSpin from "@/modules/teiki-components/icons/IconSpin";
import { useAppContextValue$Consumer } from "@/modules/teiki-contexts/contexts/AppContext";
import { useToast } from "@/modules/teiki-contexts/contexts/ToastContext";
import AssetViewer from "@/modules/teiki-ui/components/AssetViewer";
import Button from "@/modules/teiki-ui/components/Button";
import Divider from "@/modules/teiki-ui/components/Divider";
import Flex from "@/modules/teiki-ui/components/Flex";
import Modal from "@/modules/teiki-ui/components/Modal";
import TextArea from "@/modules/teiki-ui/components/TextArea";
import Title from "@/modules/teiki-ui/components/Title";
import Typography from "@/modules/teiki-ui/components/Typography";

const ASSUMED_ROA = BigInt(35000);
const MULTIPLIER = BigInt(1000000);
const EPOCH_LENGTH_IN_DAYS = BigInt(5);
const YEAR_LENGTH_IN_DAYS = BigInt(365);

type SuccessEvent = {
  lovelaceAmount: LovelaceAmount;
};

export type ModalBackProject$SuccessEvent = SuccessEvent;

type Props = {
  className?: string;
  style?: React.CSSProperties;
  open: boolean;
  projectName: string;
  projectId: string;
  isBacking: boolean;
  onCancel?: () => void;
  onSuccess?: (event: SuccessEvent) => void;
};

export default function ModalBackProject({
  className,
  style,
  open,
  projectName,
  projectId,
  isBacking,
  onCancel,
  onSuccess,
}: Props) {
  const { showMessage } = useToast();
  const adaPriceInfo = useAdaPriceInfo();
  const [busy, setBusy] = React.useState(false);
  const { walletStatus } = useAppContextValue$Consumer();
  const lucid =
    walletStatus.status === "connected" ? walletStatus.lucid : undefined;
  const [[txBreakdown, txBreakdown$Error], setTxBreakdown] = React.useState<
    [TxBreakdown | undefined, unknown]
  >([undefined, undefined]);
  const fieldMessage = useField$Message();

  const txParamsResult = useTxParams$BackerBackProject({ projectId });

  const [maxLovelaceAmount, _maxLovelaceAmount$Error] = useMaxLovelaceAmount();

  const fieldLovelaceAmount = useField$LovelaceAmount({
    maxLovelaceAmount,
  });

  const [txBreakdown$New, txBreakdown$New$Error] = useEstimatedFees({
    txParamsResult,
    projectId,
    lovelaceAmount: fieldLovelaceAmount.parsed,
    message: fieldMessage.parsed,
    disabled: busy,
  });

  const isTxBreakdownLoading =
    !txBreakdown$New$Error &&
    !txBreakdown$New &&
    !busy &&
    fieldLovelaceAmount.parsed !== undefined;

  React.useEffect(() => {
    if (busy) return;
    setTxBreakdown([txBreakdown$New, txBreakdown$New$Error]);
  }, [txBreakdown$New, txBreakdown$New$Error, busy]);

  const txBreakdown$DisplableError = txBreakdown$Error
    ? DisplayableError.from(txBreakdown$Error)
    : undefined;

  const [statusBarText, setStatusBarText] = React.useState("");

  const waitUntilTxIndexed = async (txHash: string) => {
    await tryUntil({
      run: () => httpGetBackingActivitiesByTxHash({ txHash }),
      until: (response) => response.activities.length > 0,
    });
  };

  const handleSubmit = async () => {
    if (fieldLovelaceAmount.parsed == null) return;
    setBusy(true);
    try {
      const lovelaceAmount = fieldLovelaceAmount.parsed;
      const message = fieldMessage.parsed;
      assert(walletStatus.status === "connected", "wallet not connected");
      assert(lovelaceAmount != null && message != null, "invalid inputs");
      assert(txParamsResult && !txParamsResult.error, "tx params invalid");

      setStatusBarText("Building transaction...");
      const buildTx$Params: BuildTxParams = {
        lucid: walletStatus.lucid,
        lovelaceAmount,
        message,
        txParams: txParamsResult.data.txParams,
      };
      const { txComplete } = await buildTx(buildTx$Params).catch((cause) => {
        console.error({ buildTx$Params }); // for debugging purpose
        throw DisplayableError.from(cause, "Failed to build transaction");
      });

      setStatusBarText("Waiting for signature...");
      const txCompleteSigned = await txComplete
        .sign()
        .complete()
        .catch((cause) => {
          console.error({ txComplete }); // for debugging purpose
          throw DisplayableError.from(cause, "Failed to sign");
        });

      setStatusBarText("Waiting for submission...");
      const txHash = await txCompleteSigned.submit().catch((cause) => {
        console.error({ txCompleteSigned });
        throw DisplayableError.from(cause, "Failed to submit");
      });

      setStatusBarText("Waiting for confirmation...");
      await walletStatus.lucid.awaitTx(txHash).catch((cause) => {
        console.error({ txHash }); // for debugging purpose
        throw DisplayableError.from(cause, "Failed to wait for confirmation");
      });

      setStatusBarText("Waiting for indexers...");
      await waitUntilTxIndexed(txHash).catch((cause) => {
        console.error({ txHash }); // for debugging purpose
        throw DisplayableError.from(cause, "Failed to wait for indexers");
      });

      setStatusBarText("Done.");
      onSuccess && onSuccess({ lovelaceAmount });
    } catch (error) {
      const displayableError = DisplayableError.from(
        error,
        "Failed to back project"
      );
      showMessage({
        title: displayableError.title,
        description: displayableError.description,
        color: "danger",
      });
      setStatusBarText("Failed.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal
      className={cx(styles.container, className)}
      style={style}
      open={open}
      onClose={onCancel}
      closeOnDimmerClick={false}
      closeOnEscape={!busy}
    >
      <Modal.Header>
        <Typography.Div size="heading4" maxLines={1} color="green">
          <Typography.Span
            content={`${isBacking ? "Stake More" : "Become a Member"}: `}
            color="ink"
          />
          <Typography.Span content={projectName} />
        </Typography.Div>
      </Modal.Header>
      <Modal.Content className={styles.modalContent} padding="none">
        <Flex.Row alignItems="stretch" flexWrap="wrap">
          <Flex.Col
            flex="10000 10000 294px"
            gap="32px"
            padding="32px 24px 32px 48px"
          >
            <form className={styles.form} onSubmit={(e) => e.preventDefault()}>
              <fieldset className={styles.fieldset}>
                <Title className={styles.fieldLabel} content="Stake Amount" />
                <InputLovelaceAmount
                  value={fieldLovelaceAmount.text}
                  onChange={fieldLovelaceAmount.setText}
                  inlineError={fieldLovelaceAmount.error}
                  lovelaceAmount={fieldLovelaceAmount.parsed}
                  maxLovelaceAmount={maxLovelaceAmount}
                  disabled={busy}
                />
              </fieldset>
              <Flex.Col padding="20px" gap="16px" className={styles.infoBox}>
                <Flex.Row
                  justifyContent="space-between"
                  gap="20px"
                  alignItems="center"
                >
                  <Flex.Col>
                    <IconRewardStar />
                  </Flex.Col>
                  <Typography.Div>
                    <Typography.Span
                      content="With this stake amount, you help the creator earn "
                      size="bodySmall"
                    />
                    <AssetViewer.Ada.Compact
                      as="span"
                      approx={true}
                      lovelaceAmount={
                        fieldLovelaceAmount.parsed
                          ? (((BigInt(fieldLovelaceAmount.parsed) *
                              ASSUMED_ROA) /
                              MULTIPLIER) *
                              EPOCH_LENGTH_IN_DAYS) /
                            YEAR_LENGTH_IN_DAYS
                          : undefined
                      }
                      size="heading6"
                      fontWeight="bold"
                      color="green"
                    />
                    <Typography.Span
                      content=" every 5 days."
                      size="bodySmall"
                    />
                  </Typography.Div>
                </Flex.Row>
                <Divider.Horizontal />
                <Typography.Div
                  content="You can withdraw your stake anytime!"
                  color="green"
                  size="heading6"
                />
              </Flex.Col>
              <fieldset className={styles.fieldset}>
                <Title className={styles.fieldLabel}>
                  <span>Message</span>
                  <span style={{ fontWeight: "400", fontSize: "12px" }}>
                    {" (Optional, 1500 characters max)"}
                  </span>
                  {!!fieldMessage.error && (
                    <span style={{ color: "rgb(220, 32, 32)" }}>
                      {fieldMessage.error}
                    </span>
                  )}
                </Title>
                <TextArea
                  className={styles.inputMessage}
                  value={fieldMessage.text}
                  onChange={fieldMessage.setText}
                  rows={5}
                  disabled={busy}
                />
                <span
                  className={styles.characterCount}
                >{`${fieldMessage.text.length}/1500`}</span>
              </fieldset>
            </form>
          </Flex.Col>
          <Flex.Row flex="1 1 294px" alignItems="stretch">
            <PanelFeesBreakdown
              style={{ flex: "1 1 auto" }}
              title="Transaction Breakdown"
              rows={[
                { label: "Stake", value: txBreakdown?.back },
                { label: "Transaction Fee", value: txBreakdown?.transaction },
              ]}
              total={txBreakdown ? sumTxBreakdown(txBreakdown) : undefined}
              adaPriceInUsd={adaPriceInfo?.usd}
              bottomSlot={
                <div>
                  {txBreakdown$DisplableError ? (
                    <ErrorBox
                      style={{ marginTop: "16px" }}
                      title={txBreakdown$DisplableError.title}
                      description={txBreakdown$DisplableError.description}
                      tooltip={txBreakdown$DisplableError.description}
                    />
                  ) : null}
                </div>
              }
              loading={isTxBreakdownLoading}
            />
          </Flex.Row>
        </Flex.Row>
      </Modal.Content>
      <Modal.Actions>
        <Flex.Row
          className={styles.statusTextContainer}
          flex="1 1 50px"
          justifyContent="stretch"
          alignItems="center"
          gap="10px"
        >
          {busy ? <IconSpin /> : null}
          <Typography.Span size="heading6" content={statusBarText} />
        </Flex.Row>
        <Button.Outline content="Cancel" onClick={onCancel} disabled={busy} />
        <Button.Solid
          content="Submit"
          disabled={txBreakdown === undefined || !lucid || busy}
          onClick={handleSubmit}
        />
      </Modal.Actions>
    </Modal>
  );
}
