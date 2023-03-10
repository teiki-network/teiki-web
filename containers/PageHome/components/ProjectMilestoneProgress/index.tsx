import cx from "classnames";
import * as React from "react";

import styles from "./index.module.scss";

type Props = {
  className?: string;
  style?: React.CSSProperties;
};

export default function ProjectMilestoneProgress({ className, style }: Props) {
  return (
    <div className={cx(styles.container, className)} style={style}>
      {/**TODO: handle the milestone progress properly */}
      {/* Needs 15K ADA more to reach the milestone 3 */}
    </div>
  );
}
