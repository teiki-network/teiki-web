import cx from "classnames";
import Link from "next/link";
import { CSSProperties } from "react";
import React from "react";

import WithAspectRatio from "../../../../../../components/WithAspectRatio";
import ProjectCreationAndUpdateTime from "../../../../components/ProjectCreationAndUpdateTime";
import ProjectImageCropped from "../../../../components/ProjectImageCropped";
import ProjectMilestoneProgress from "../../../../components/ProjectMilestoneProgress";
import ProjectStats from "../../../../components/ProjectStats";
import ProjectSummary from "../../../../components/ProjectSummary";
import ProjectTagList from "../../../../components/ProjectTagList";
import IconWarning from "../../../ProjectList/components/ProjectListItem/components/IconWarning";

import styles from "./index.module.scss";

import { ProjectGeneralInfo } from "@/modules/business-types";
import LogoImageViewer from "@/modules/teiki-components/components/LogoImageViewer";
import Button from "@/modules/teiki-ui/components/Button";
import Title from "@/modules/teiki-ui/components/Title";
import Typography from "@/modules/teiki-ui/components/Typography";

type Props = {
  className?: string;
  style?: CSSProperties;
  value: ProjectGeneralInfo;
  padding?: "normal" | "narrow";
  descriptionMaxLines?: 1 | 2 | 3 | 4 | 5 | "none";
};

export default function ProjectCard({
  className,
  style,
  value,
  padding = "normal",
  descriptionMaxLines,
}: Props) {
  /* NOTE: Some tags from AI moderation are camel case so we
   * have to replace them with more user-friendly tags, also,
   * we temporarily remove 'political' because of model performance
   */
  const censorshipContents = value.censorship
    ? value.censorship
        .filter((value) => value !== "political")
        .map((value) =>
          value
            .replace("identityAttack", "identity attack")
            .replace("sexualExplicit", "sexual explicit")
        )
    : [];

  const [isCensored, setIsCensored] = React.useState(
    censorshipContents.length > 0
  );

  const projectUrl =
    value.history.closedAt ||
    value.history.delistedAt ||
    !value.basics.customUrl
      ? `/creator-by-id/${value.id}`
      : `/c/${value.basics.customUrl}`;

  return (
    <div
      className={cx(
        className,
        styles.container,
        padding === "normal" ? styles.normal : styles.narrow
      )}
    >
      {isCensored ? (
        <div className={styles.censoredItemContainer}>
          <IconWarning />
          <Title
            content="Content Warning!"
            size="h3"
            className={styles.censoredItemTitle}
          />
          {/**TODO: @sk-tenba: more accurate content description */}
          <Typography.Div className={styles.censoredItemDescription}>
            This project contains {censorshipContents.join(", ")} content which
            may be inappropriate for some audiences and children
          </Typography.Div>
          <Button.Outline
            className={styles.censoredItemButton}
            content="I understand and want to view the project"
            onClick={() => setIsCensored(false)}
          />
        </div>
      ) : null}
      <Link href={projectUrl} style={style}>
        <>
          {!value.match ? null : (
            <Typography.Div
              className={cx(
                styles.match,
                padding === "normal" ? styles.normal : styles.narrow
              )}
              size="bodyExtraSmall"
              fontWeight="semibold"
              lineHeight="small"
              content={`${Math.round(value.match * 100)}% Match `}
            />
          )}
          <WithAspectRatio aspectRatio={16 / 9}>
            <ProjectImageCropped value={value.basics.coverImages[0]} fluid />
          </WithAspectRatio>
          <div
            className={cx(
              styles.afterBackdrop,
              padding === "normal" ? styles.normal : styles.narrow
            )}
          >
            <LogoImageViewer
              value={value.basics.logoImage}
              shadow="shadow"
              border="medium"
              className={styles.logo}
            />
            <Title
              className={styles.title}
              content={value.basics.title}
              size="h2"
              color="ink100"
            />
            <Title
              className={styles.slogan}
              content={value.basics.slogan}
              size="h4"
              color="green100"
            />
            <ProjectCreationAndUpdateTime
              className={styles.creationAndUpdateTime}
              createdAt={value.history.createdAt}
              updatedAt={value.history.updatedAt}
            />
            <ProjectTagList
              className={styles.tagList}
              value={value.basics.tags}
            />
            <ProjectSummary
              className={styles.summary}
              value={value.basics.summary}
              maxLines={descriptionMaxLines}
            />
            <ProjectMilestoneProgress className={styles.milestoneProgress} />
            <ProjectStats
              className={styles.stats}
              value={value.stats}
              size="large"
            />
          </div>
        </>
      </Link>
    </div>
  );
}
