import * as React from "react";

import GrammarlyWrapper from "../../../../../../components/GrammarlyWrapper";
import IconArrowDown from "../../../ProjectRoadmapEditor/components/MilestoneInput/assets/IconArrowDown";
import IconArrowUp from "../../../ProjectRoadmapEditor/components/MilestoneInput/assets/IconArrowUp";
import IconTrash from "../../../ProjectRoadmapEditor/components/MilestoneInput/assets/IconTrash";

import styles from "./index.module.scss";

import {
  formatLovelaceAmount,
  formatUsdAmount,
  parseLovelaceAmount,
} from "@/modules/bigint-utils";
import { ProjectBenefitTier } from "@/modules/business-types";
import RichTextEditor from "@/modules/teiki-components/components/RichTextEditor";
import { useAppContextValue$Consumer } from "@/modules/teiki-contexts/contexts/AppContext";
import Divider from "@/modules/teiki-ui/components/Divider";
import Input from "@/modules/teiki-ui/components/Input";
import Title from "@/modules/teiki-ui/components/Title";

type Props = {
  value: ProjectBenefitTier;
  onChange: (newValue: ProjectBenefitTier) => void;
  onDelete: () => void;
};

export default function TierInput({ value, onChange, onDelete }: Props) {
  const { adaPriceInfo } = useAppContextValue$Consumer();
  const adaPriceInUsd = adaPriceInfo?.usd;
  const [isOpened, setIsOpened] = React.useState(true);
  const [requiredActiveStake, setRequiredActiveStake] = React.useState(
    value.requiredActiveStake
      ? formatLovelaceAmount(value.requiredActiveStake, {
          excludeThousandsSeparator: true,
          useMaxPrecision: true,
        })
      : ""
  );
  const parsedFunding = parseLovelaceAmount(requiredActiveStake);
  return (
    <div className={styles.milestoneInput}>
      <div className={styles.heading}>
        <Title className={styles.milestoneTitle} content={"Tier"} />
        <div className={styles.icons}>
          <button className={styles.icon} onClick={onDelete}>
            <IconTrash />
          </button>
          <button
            className={styles.icon}
            onClick={() => setIsOpened(!isOpened)}
          >
            {isOpened ? <IconArrowUp /> : <IconArrowDown />}
          </button>
        </div>
      </div>
      {isOpened && (
        <>
          <Divider.Horizontal className={styles.divider} />
          <div className={styles.inputContainer}>
            <div className={styles.inputField}>
              <Title content="Description" />
              <div className={styles.box}>
                <GrammarlyWrapper>
                  <RichTextEditor
                    value={value.body}
                    onChange={(newBody) => {
                      onChange && onChange({ ...value, body: newBody });
                    }}
                    isBorderless={true}
                  />
                </GrammarlyWrapper>
              </div>
            </div>
            <div className={styles.inputField}>
              <Title content="Required active stake amount" />
              <Input
                value={requiredActiveStake}
                onChange={(funding) => {
                  const formattedFunding = funding.replace(/[^0-9.]+/g, "");
                  const parsedFunding = parseLovelaceAmount(formattedFunding);
                  onChange({
                    ...value,
                    requiredActiveStake: parsedFunding ?? 0,
                  });
                  setRequiredActiveStake(formattedFunding);
                }}
                rightSlot={<Title className={styles.iconAda} content="₳" />}
                error={requiredActiveStake !== "" && parsedFunding == null}
              />
              <div className={styles.fundingBotSlot}>
                <div className={styles.usdPrice}>
                  {value.requiredActiveStake != null && adaPriceInUsd
                    ? formatUsdAmount(
                        {
                          lovelaceAmount: value.requiredActiveStake,
                          adaPriceInUsd,
                        },
                        {
                          includeAlmostEqualToSymbol: true,
                          includeCurrencySymbol: true,
                        }
                      )
                    : "≈ ... USD"}
                </div>
                <div className={styles.warning}>
                  {requiredActiveStake !== "" &&
                  value.requiredActiveStake == null
                    ? "Invalid active stake amount"
                    : ""}
                </div>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
