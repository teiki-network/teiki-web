import * as React from "react";
import * as Uuid from "uuid";

import IconPlus from "./assets/IconPlus";
import TierInput from "./components/TierInput";
import styles from "./index.module.scss";

import { ProjectBenefitTier } from "@/modules/business-types";
import Button from "@/modules/teiki-ui/components/Button";

type Props = {
  value: ProjectBenefitTier[];
  onChange: (newTiers: ProjectBenefitTier[]) => void;
};

export default function ProjectTiersEditor({ value, onChange }: Props) {
  const addMilestone = () => {
    onChange([
      ...value,
      {
        id: Uuid.v4(),
        requiredActiveStake: 0,
        body: { type: "doc", content: [{ type: "paragraph" }] },
      },
    ]);
  };
  const updateTier = (id: string, newValue: ProjectBenefitTier) => {
    onChange(
      value.map((tier: ProjectBenefitTier) => {
        if (tier.id === id) return newValue;
        return tier;
      })
    );
  };
  const deleteTier = (id: string) => {
    onChange(
      value.filter((tier: ProjectBenefitTier) => {
        return tier.id !== id;
      })
    );
  };
  return (
    <div className={styles.container}>
      <div
        style={{
          position: "relative",
          overflowY: "auto",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
        }}
      >
        {value.map((tier: ProjectBenefitTier) => (
          <TierInput
            value={tier}
            onChange={(newValue: ProjectBenefitTier) =>
              updateTier(tier.id, newValue)
            }
            onDelete={() => deleteTier(tier.id)}
            key={tier.id}
          />
        ))}
        <Button.Solid
          icon={<IconPlus />}
          content="Add Milestone"
          onClick={addMilestone}
          className={styles.addMilestoneButton}
          size="small"
        />
      </div>
      <div className={styles.line} />
    </div>
  );
}
