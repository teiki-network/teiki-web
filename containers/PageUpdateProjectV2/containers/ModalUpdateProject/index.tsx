import { signAndSubmit } from "@teiki/protocol/helpers/lucid";
import * as React from "react";

import InputLovelaceAmount$Sponsor from "../../../PageEditProject/containers/ModalGroup$CreateProject/components/ModalSubmit/components/InputLovelaceAmount$Sponsor";
import IconClose from "../../../PageEditProject/containers/ModalGroup$CreateProject/components/ModalSubmit/components/InputLovelaceAmount$Sponsor/icons/IconClose";
import { useCreateProjectLogic } from "../../../PageEditProject/containers/ModalGroup$CreateProject/hooks/useCreateProjectLogic";
import ErrorBox from "../../components/ErrorBox";
import InfoBox from "../../components/InfoBox";
import { useDetailedProject } from "../../hooks/useDetailedProject";
import { TxBreakdown, useEstimatedFees } from "../../hooks/useEstimatedFees";
import { buildTx } from "../../utils/transaction";
import ModalPostAnnouncement from "../ModalPostAnnouncement";
import {
  clearProjectAnnouncement,
  saveProjectAnnouncement,
} from "../ModalPostAnnouncement/utils";
import ModalSponsorship, {
  ModalSponsorship$SuccessEvent,
} from "../ModalSponsorship";

import IconClock from "./icons/IconClock";
import styles from "./index.module.scss";
import { timeToExpiry } from "./utils";

import { useAdaPriceInfo } from "@/modules/ada-price-provider";
import { ResultT } from "@/modules/async-utils";
import { formatLovelaceAmount, sumTxBreakdown } from "@/modules/bigint-utils";
import {
  LovelaceAmount,
  Project,
  ProjectAnnouncement,
} from "@/modules/business-types";
import { assert } from "@/modules/common-utils";
import { DisplayableError } from "@/modules/displayable-error";
import { useModalPromises } from "@/modules/modal-promises";
import { useTxParams$CreatorUpdateProject } from "@/modules/next-backend-client/hooks/useTxParams$CreatorUpdateProject";
import { ipfsAdd$WithBufsAs$Blob } from "@/modules/next-backend-client/utils/ipfsAdd$WithBufsAs$Blob";
import PanelFeesBreakdown from "@/modules/teiki-components/components/PanelFeesBreakdown";
import IconSpin from "@/modules/teiki-components/icons/IconSpin";
import { useAppContextValue$Consumer } from "@/modules/teiki-contexts/contexts/AppContext";
import { useToast } from "@/modules/teiki-contexts/contexts/ToastContext";
import Button from "@/modules/teiki-ui/components/Button";
import Checkbox from "@/modules/teiki-ui/components/Checkbox";
import Divider from "@/modules/teiki-ui/components/Divider";
import Flex from "@/modules/teiki-ui/components/Flex";
import Input from "@/modules/teiki-ui/components/Input";
import MessageBox from "@/modules/teiki-ui/components/MessageBox";
import Modal from "@/modules/teiki-ui/components/Modal";
import Typography from "@/modules/teiki-ui/components/Typography";
import { WithBufsAs } from "@/modules/with-bufs-as";
import { Converters } from "@/modules/with-bufs-as-converters";
import CodecBlob from "@/modules/with-bufs-as-converters/codecs/CodecBlob";

type Cid = string;

type Props = {
  open: boolean;
  projectId: string;
  project: Project;
  initialAnnouncement: ProjectAnnouncement;
  initialShouldPostAnnouncement: boolean;
  onCancel?: () => void;
  onSuccess?: () => void;
};

export default function ModalUpdateProject({
  open,
  projectId,
  project,
  initialAnnouncement,
  initialShouldPostAnnouncement,
  onCancel,
  onSuccess,
}: Props) {
  const { showMessage } = useToast();
  const adaPriceInfo = useAdaPriceInfo();
  const [busy, setBusy] = React.useState(false);
  const { walletStatus } = useAppContextValue$Consumer();
  const txParamsResult = useTxParams$CreatorUpdateProject({ projectId });
  const { showModal } = useModalPromises();
  const detailedProject$Result = useDetailedProject({ projectId });

  const [newSponsorshipAmount, setNewSponsorshipAmount] = React.useState<
    LovelaceAmount | undefined
  >(undefined);

  const [shouldPostAnnouncement, setShouldPostAnnouncement] = React.useState(
    initialShouldPostAnnouncement
  );

  const [announcement, setAnnouncement] = React.useState(initialAnnouncement);

  const [txBreakdown$ResultT, setTxBreakdown$ResultT] = React.useState<
    ResultT<TxBreakdown> | undefined
  >(undefined);

  const txBreakdownResultT$New = useEstimatedFees({
    projectId,
    newSponsorshipAmount,
    shouldPostAnnouncement,
    disabled: busy,
    project,
    announcement,
  });

  const isTxBreakdownLoading = !txBreakdownResultT$New && !busy;

  React.useEffect(() => {
    if (busy) return;
    setTxBreakdown$ResultT(txBreakdownResultT$New);
  }, [busy, txBreakdownResultT$New]);

  const txBreakdown: TxBreakdown | undefined = txBreakdown$ResultT?.ok
    ? txBreakdown$ResultT.result
    : undefined;

  const txBreakdown$DisplableError =
    txBreakdown$ResultT?.ok === false
      ? DisplayableError.from(txBreakdown$ResultT.reason)
      : undefined;

  const [statusBarText, setStatusBarText] = React.useState("");

  const [sponsorInputOpen, setSponsorInputOpen] = React.useState(false);
  const { input, syntaxError, output } = useCreateProjectLogic({
    projectSponsorshipMinFee:
      txParamsResult?.error == null
        ? txParamsResult?.computed.protocolParams.projectSponsorshipMinFee
        : undefined,
  });

  React.useEffect(() => {
    if (!sponsorInputOpen && output.lovelaceAmount)
      setNewSponsorshipAmount(output.lovelaceAmount);
  }, [output, sponsorInputOpen]);

  if (!detailedProject$Result || detailedProject$Result.error != null)
    return null;
  const detailedProject = detailedProject$Result.data.project;

  const handleSaveOnSubmit = async () => {
    await saveProjectAnnouncement(projectId, announcement, "last-submission");
    await clearProjectAnnouncement(projectId, "auto-save");
  };

  const handleSubmit = async () => {
    setBusy(true);
    try {
      assert(walletStatus.status === "connected", "wallet not connected");
      assert(txParamsResult && !txParamsResult.error, "tx params invalid");

      setStatusBarText("Uploading files to IPFS...");
      const projectWBA$Blob: WithBufsAs<Project, Blob> =
        await Converters.fromProject(CodecBlob)(project).catch((cause) => {
          console.error({ project }); // for debugging purpose
          throw DisplayableError.from(cause, "Failed to serialize project");
        });
      const newInformationCid: Cid = await ipfsAdd$WithBufsAs$Blob(
        projectWBA$Blob
      ).catch((cause) => {
        console.error({ projectWBA$Blob }); // for debugging purpose
        throw DisplayableError.from(cause, "Failed to upload files to IPFS");
      });

      setStatusBarText("Uploading files to IPFS...");
      const announcementWBA$Blob: WithBufsAs<ProjectAnnouncement, Blob> =
        await Converters.fromProjectAnnouncement(CodecBlob)(announcement).catch(
          (cause) => {
            console.error({ announcement }); // for debugging purpose
            throw DisplayableError.from(
              cause,
              "Failed to serialize announcement."
            );
          }
        );
      const newAnnouncementCid: Cid | undefined = shouldPostAnnouncement
        ? await ipfsAdd$WithBufsAs$Blob(announcementWBA$Blob).catch((cause) => {
            console.error({ announcementWBA$Blob }); // for debugging purpose
            throw DisplayableError.from(
              cause,
              "Failed to upload files to IPFS"
            );
          })
        : undefined;

      setStatusBarText("Building transaction...");
      const buildTx$Params = {
        lucid: walletStatus.lucid,
        txParams: txParamsResult.data.txParams,
        newSponsorshipAmount,
        newInformationCid,
        newAnnouncementCid,
      };
      const { txComplete } = await buildTx(buildTx$Params).catch((cause) => {
        console.error({ buildTx$Params }); // for debugging purpose
        throw DisplayableError.from(cause, "Failed to build transaction");
      });

      setStatusBarText("Waiting for signature and submission...");
      const txHash = await signAndSubmit(txComplete).catch((cause) => {
        console.error({ txComplete }); // for debugging purpose
        throw DisplayableError.from(cause, "Failed to sign or submit");
      });

      setStatusBarText("Waiting for confirmation...");
      await walletStatus.lucid.awaitTx(txHash).catch((cause) => {
        console.error({ txHash }); // for debugging purpose
        throw DisplayableError.from(cause, "Failed to wait for confirmation");
      });

      setStatusBarText("Done.");
      await handleSaveOnSubmit();
      onSuccess && onSuccess();
    } catch (error) {
      const displayableError = DisplayableError.from(error);
      showMessage({
        title: displayableError.title,
        description: displayableError.description,
        color: "danger",
      });
      console.error(error);
      setStatusBarText("Failed.");
    } finally {
      setBusy(false);
    }
  };

  const handleClickEdit = async () => {
    type ModalPostAnnouncement$ModalResult =
      | { type: "cancel" }
      | { type: "continue"; value: ProjectAnnouncement }
      | { type: "skip" };

    const modalPostAnnouncement$ModalResult =
      await showModal<ModalPostAnnouncement$ModalResult>((resolve) => (
        <ModalPostAnnouncement
          open
          projectId={projectId}
          labelAction="Continue"
          onAction={(value) => resolve({ type: "continue", value })}
          onExit={() => resolve({ type: "cancel" })}
          onSkip={() => resolve({ type: "skip" })}
          hideSkipButton
        />
      ));

    if (modalPostAnnouncement$ModalResult.type !== "continue") {
      return;
    }

    setAnnouncement(modalPostAnnouncement$ModalResult.value);
    setShouldPostAnnouncement(true);
  };

  const handleClickSponsorship = async () => {
    type ModalSponsorship$ModalResult =
      | { type: "success"; event: ModalSponsorship$SuccessEvent }
      | { type: "cancel" };
    const modalSponsorship$ModalResult =
      await showModal<ModalSponsorship$ModalResult>((resolve) => (
        <ModalSponsorship
          open
          projectId={projectId}
          project={project}
          currentSponsorship={detailedProject.sponsorshipAmount}
          sponsoredUntil={detailedProject.sponsorshipUntil}
          announcement={initialAnnouncement}
          onCancel={() => resolve({ type: "cancel" })}
          onSuccess={(event) => resolve({ type: "success", event })}
        />
      ));
    if (modalSponsorship$ModalResult.type === "success") {
      setNewSponsorshipAmount(
        modalSponsorship$ModalResult.event.sponsorshipAmount
      );
    }
  };

  return (
    <Modal
      open={open}
      onOpenChange={(open) => !open && onCancel && onCancel()}
      closeOnDimmerClick={false}
      closeOnEscape={!busy}
    >
      <Modal.Header>
        <Typography.Div size="heading4" maxLines={1} color="green">
          <Typography.Span content="Update: " color="ink" />
          <Typography.Span content={project.basics.title} />
        </Typography.Div>
      </Modal.Header>
      <Modal.Content padding="none">
        <Flex.Row
          className={styles.twoColumns}
          alignItems="stretch"
          flexWrap="wrap"
        >
          <Flex.Col
            flex="10000 10000 294px"
            gap="32px"
            padding="32px 24px 32px 48px"
          >
            <form onSubmit={(event) => event.preventDefault()}>
              <Flex.Col gap="20px">
                {detailedProject.sponsorshipAmount == null ? (
                  <>
                    <Typography.Div content="Sponsor Teiki" size="heading6" />
                    <MessageBox
                      title="Sponsors are auto-listed in the homepage for more exposure."
                      description="Sponsorship can be renewed monthly. Inappropriate sponsors can still be hidden, delisted, and fined the pledge."
                    />
                    <InputLovelaceAmount$Sponsor
                      open={sponsorInputOpen}
                      value={input.lovelaceAmount}
                      onChange={input.setLovelaceAmount}
                      onBlur={() => setSponsorInputOpen(false)}
                      onFocus={() => setSponsorInputOpen(true)}
                      inlineError={syntaxError.lovelaceAmount}
                      lovelaceAmount={output.lovelaceAmount}
                      disabled={busy}
                    />
                  </>
                ) : (
                  <fieldset className={styles.fieldset}>
                    {newSponsorshipAmount ? (
                      <>
                        <Typography.Div
                          content="Extend sponsorship"
                          size="heading6"
                        />
                        <Input
                          value={`(Your project) ${formatLovelaceAmount(
                            newSponsorshipAmount,
                            { compact: true }
                          )} ₳ / month`}
                          color="green"
                          disabled={true}
                          rightSlot={
                            <Typography.Div
                              className={styles.closeSymbol}
                              style={{ display: "flex" }}
                              content={<IconClose />}
                              onClick={() => setNewSponsorshipAmount(undefined)}
                            />
                          }
                        />
                      </>
                    ) : (
                      <>
                        <Typography.Div
                          content="Sponsorship Status"
                          size="heading6"
                        />
                        <Flex.Col className={styles.sponsorBox}>
                          <Flex.Col gap="20px">
                            <Flex.Row justifyContent="space-between">
                              <Flex.Row gap="4px" alignItems="center">
                                <Typography.Span
                                  content={`(${formatLovelaceAmount(
                                    detailedProject.sponsorshipAmount ?? 0,
                                    { compact: true }
                                  )} ₳ / month)`}
                                  size="heading6"
                                  color="ink80"
                                />
                              </Flex.Row>
                              <Flex.Row alignItems="center" gap="8px">
                                <IconClock />
                                <Typography.Div
                                  content={
                                    detailedProject.sponsorshipUntil == null
                                      ? "-"
                                      : timeToExpiry(
                                          detailedProject.sponsorshipUntil
                                        )
                                  }
                                  size="heading6"
                                  color="green"
                                />
                              </Flex.Row>
                            </Flex.Row>
                            <Divider.Horizontal />
                            <Button.Solid
                              content="Extend Sponsorship"
                              style={{ width: "fit-content", height: "28px" }}
                              onClick={handleClickSponsorship}
                            />
                          </Flex.Col>
                        </Flex.Col>
                      </>
                    )}
                    <InfoBox
                      title="Sponsors are auto-listed in the homepage for more exposure."
                      description="Sponsorship can be renewed monthly. Inappropriate sponsors can still be hidden, delisted, and fined the pledge."
                    />
                  </fieldset>
                )}
                <fieldset className={styles.fieldset}>
                  <Checkbox
                    label={
                      <div>
                        <span>Post announcement</span>
                        <Button.Link
                          className={styles.buttonEdit}
                          content="Edit"
                          onClick={handleClickEdit}
                        />
                      </div>
                    }
                    value={shouldPostAnnouncement}
                    onChange={setShouldPostAnnouncement}
                    disabled={busy}
                  />
                  <InfoBox
                    title="An announcement is a post that highlights creator updates."
                    description="Each announcement's summary is included in auto-generated podcasts to attract members."
                  />
                </fieldset>
              </Flex.Col>
            </form>
          </Flex.Col>
          <Flex.Row flex="1 1 294px" alignItems="stretch">
            <PanelFeesBreakdown
              style={{ flex: "1 1 auto" }}
              title="Transaction Breakdown"
              rows={[
                {
                  label: "Project Update",
                  value: txBreakdown?.updateProject,
                },
                {
                  label: "Sponsorship Extension",
                  value: txBreakdown?.extendsSponsorship,
                },
                {
                  label: "Announcement",
                  value: txBreakdown?.postCommunityUpdate,
                },
                {
                  label: "Transaction Fee",
                  value: txBreakdown?.transaction,
                },
              ]}
              total={txBreakdown ? sumTxBreakdown(txBreakdown) : undefined}
              adaPriceInUsd={adaPriceInfo?.usd}
              bottomSlot={
                txBreakdown$DisplableError ? (
                  <ErrorBox
                    style={{ marginTop: "16px" }}
                    title={txBreakdown$DisplableError.title}
                    description={txBreakdown$DisplableError.description}
                  />
                ) : null
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
          content="Update Project"
          disabled={busy || txBreakdown === undefined}
          onClick={handleSubmit}
        />
      </Modal.Actions>
    </Modal>
  );
}
