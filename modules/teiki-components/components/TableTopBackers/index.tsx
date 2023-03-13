import cx from "classnames";
import Image from "next/image";
import * as React from "react";

import svgFlyingLeaves from "./assets/flying-leaves.svg";
import IconTop1 from "./icons/IconTop1";
import IconTop2 from "./icons/IconTop2";
import IconTop3 from "./icons/IconTop3";
import styles from "./index.module.scss";

import { rankOf, sortedBy } from "@/modules/array-utils";
import { SupporterInfo } from "@/modules/business-types";
import AssetViewer from "@/modules/teiki-ui/components/AssetViewer";
import Flex from "@/modules/teiki-ui/components/Flex";
import InlineAddress from "@/modules/teiki-ui/components/InlineAddress";
import Typography from "@/modules/teiki-ui/components/Typography";

const MAX_DISPLAYED_RANK = 10;

type Props = {
  className?: string;
  style?: React.CSSProperties;
  value: SupporterInfo[];
};

export default function TableTopBackers({ className, style, value }: Props) {
  // sort by amount  > remove zero-amount supporters > inject rank property > only display MAX_DISPLAYED_RANK items
  const sortedItems = sortedBy(value, (item) => -item.lovelaceAmount)
    .filter((item) => item.lovelaceAmount > 0)
    .map((item) => ({
      ...item,
      rank: rankOf(item, value, (value) => BigInt(value.lovelaceAmount)),
    }))
    .filter((item) => item.rank <= MAX_DISPLAYED_RANK);

  if (!sortedItems.length) {
    return (
      <div className={cx(styles.container, className)} style={style}>
        <Flex.Col gap="10px" alignItems="center">
          <Image src={svgFlyingLeaves} alt="" width={96} height={96} />
          <Typography.Div size="bodySmall" color="ink80" content="No Members" />
        </Flex.Col>
      </div>
    );
  }

  return (
    <div className={cx(styles.container, className)} style={style}>
      <div className={styles.table}>
        {sortedItems.map((item, index) => (
          <React.Fragment key={index}>
            <div className={styles.columnRank}>
              {item.rank === 1 ? (
                <IconTop1 />
              ) : item.rank === 2 ? (
                <IconTop2 />
              ) : item.rank === 3 ? (
                <IconTop3 />
              ) : (
                <span className={styles.circledNumber}>{item.rank}</span>
              )}
            </div>
            <div className={styles.columnAddress}>
              <InlineAddress.Auto
                value={item.address}
                className={styles.inlineAddressAuto}
              />
            </div>
            <div className={styles.columnLovelaceAmount}>
              <AssetViewer.Ada.Compact
                as="div"
                size="bodySmall"
                color="ink"
                fontWeight="semibold"
                lovelaceAmount={item.lovelaceAmount}
              />
            </div>
          </React.Fragment>
        ))}
      </div>
    </div>
  );
}
