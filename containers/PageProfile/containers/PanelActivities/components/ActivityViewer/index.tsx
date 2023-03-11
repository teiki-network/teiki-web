import cx from "classnames";
import moment from "moment";
import * as React from "react";

import ActionAnnouncement from "./components/ActionAnnouncement";
import ActionBack from "./components/ActionBack";
import ActionProjectCreation from "./components/ActionProjectCreation";
import ActionProjectUpdate from "./components/ActionProjectUpdate";
import ActionProtocolMilestoneReached from "./components/ActionProtocolMilestoneReached";
import ActionUnback from "./components/ActionUnback";
import styles from "./index.module.scss";

import { ProjectActivity, ProjectBasics } from "@/modules/business-types";
import LogoImageViewer from "@/modules/teiki-components/components/LogoImageViewer";
import Flex from "@/modules/teiki-ui/components/Flex";
import Typography from "@/modules/teiki-ui/components/Typography";

type Props = {
  className?: string;
  style?: React.CSSProperties;
  projectActivity: ProjectActivity;
  projectBasics: ProjectBasics | undefined;
};

export default function ActivityViewer({
  className,
  style,
  projectActivity,
  projectBasics,
}: Props) {
  return (
    <div className={cx(styles.container, className)} style={style}>
      <Flex.Row gap="12px">
        <LogoImageViewer value={projectBasics?.logoImage} size="small" />
        <Flex.Col gap="8px">
          <Typography.Div maxLines={2} size="bodyExtraSmall">
            <Typography.Span
              content={projectBasics?.title || "-"}
              color="green"
              fontWeight="semibold"
            />
            <Typography.Span content=" " />
            <Typography.Span
              style={{ whiteSpace: "nowrap" }}
              content={moment(projectActivity.createdAt).format(
                "DD MMM YYYY hh:mm A"
              )}
              color="ink80"
              title={moment(projectActivity.createdAt).format(
                "DD MMM YYYY HH:mm:ss Z"
              )}
            />
          </Typography.Div>
          {(() => {
            switch (projectActivity.action.type) {
              case "back":
                return <ActionBack value={projectActivity.action} />;
              case "unback":
                return <ActionUnback value={projectActivity.action} />;
              case "announcement":
                return (
                  <ActionAnnouncement
                    value={projectActivity.action}
                    createdBy={projectActivity.createdBy}
                  />
                );
              case "project_update":
                return (
                  <ActionProjectUpdate
                    value={projectActivity.action}
                    createdBy={projectActivity.createdBy}
                  />
                );
              case "protocol_milestone_reached":
                return (
                  <ActionProtocolMilestoneReached
                    value={projectActivity.action}
                  />
                );
              case "project_creation":
                return <ActionProjectCreation value={projectActivity.action} />;
              default:
                return null;
            }
          })()}
        </Flex.Col>
      </Flex.Row>
    </div>
  );
}
