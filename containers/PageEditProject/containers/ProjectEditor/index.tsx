import { GrammarlyButton } from "@grammarly/editor-sdk-react";
import { generateText, JSONContent } from "@tiptap/core";
import awesomeDebouncePromise from "awesome-debounce-promise";
import cx from "classnames";
import * as React from "react";
import { v4 } from "uuid";

import { TabIndex } from "../../types";
import ProjectBasicsEditor from "../ProjectBasicsEditor";
import ProjectBenefitsEditor from "../ProjectBenefitsEditor";
import ProjectCommunityEditor from "../ProjectCommunityEditor";
import ProjectDescriptionEditor from "../ProjectDescriptionEditor";

import PageControl from "./components/PageControl";
import SideBar from "./components/SideBar";
import ProjectView from "./components/SideBar/components/ProjectView";
import { useContentModeration } from "./hooks/useContentModeration";
import { useSimmilarProjects } from "./hooks/useSimilarProjects";
import { useSuggestedCoverImages } from "./hooks/useSuggestedCoverImages";
import { useSuggestedCustomUrl } from "./hooks/useSuggestedCustomUrl";
import { useSuggestedLogoImages } from "./hooks/useSuggestedLogoImages";
import { useSuggestedSlogans } from "./hooks/useSuggestedSlogans";
import { useSuggestedSummary } from "./hooks/useSuggestedSummary";
import { useSuggestedTags } from "./hooks/useSuggestedTags";
import { useSuggestedTitles } from "./hooks/useSuggestedTitles";
import { useTextFromJSONContent } from "./hooks/useTextFromJSONContent";
import IconArrowLeft from "./icons/IconArrowLeft";
import IconArrowRight from "./icons/IconArrowRight";
import styles from "./index.module.scss";
import { getProjectProgressScores } from "./utils/project-progress";

import { getDescriptionSentiment } from "@/modules/ai/sentiment-analysis";
import { Project } from "@/modules/business-types";
import { useDebounce } from "@/modules/common-hooks/hooks/useDebounce";
import { editorExtensions } from "@/modules/teiki-components/components/RichTextEditor/config";
import { useToast } from "@/modules/teiki-contexts/contexts/ToastContext";
import Button from "@/modules/teiki-ui/components/Button";

type Props = {
  value: Project;
  onChange?: (newValue: Project) => void;
  projectId: string | null; // projectId != null in flow creator-update-project
  statusText?: string;
  onExit?: () => void;
  onPreview?: () => void;
  /**
   * Triggered when user clicks Submit button.
   *
   * The name `onClickSubmit` is a bit inconsistent but it is
   * clearer than `onSubmit`.
   **/
  onClickSubmit?: () => void;
};

// TODO: @sk-umiuma: Clean and move to its own component?
function renderModerationWarningLine(section: string, tags: string[]) {
  if (tags.length === 0) {
    return <>The {section} is clean and healthy now, thank you 🤝.</>;
  }

  const lastTag = tags.pop();
  return (
    <>
      Ouch! I detected{" "}
      {tags.map((tag) => (
        <>
          <span key={tag} style={{ color: "#FF7A00" }}>
            {tag}
          </span>
          {tags.length > 1 ? ", " : " "}
        </>
      ))}
      {tags.length > 0 && "and "}
      <span style={{ color: "#FF7A00" }}>{lastTag}</span> in your{" "}
      <span style={{ color: "rgba(0,138,69,1)" }}>{section}</span>
      .<br />
      <br />
      ⚠️ Please tone down to not offend people. Violated projects will be
      delisted and fined.
    </>
  );
}

// TODO: Clean up this later
function emptyProjectBenefitsPerks(): JSONContent {
  return { type: "doc", content: [{ type: "paragraph" }] };
}

/**
 * `ProjectEditor` is the editor of `Project`.
 *
 * It receives a `value: Project`,
 * shows 4 tabs (Description, Basics, Community, Benefits),
 * triggers `onChange(newValue)` on every change,
 * triggers `onSubmit()` when user clicks Submit.
 */
export default function ProjectEditor({
  value,
  onChange,
  projectId,
  statusText,
  onExit,
  onPreview,
  onClickSubmit,
}: Props) {
  const [activeIndex, setActiveIndex] = React.useState<TabIndex>(0);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = React.useState(false);

  const [debouncedValue] = useDebounce(value, { delay: 1000 });

  const projectProgressScores = React.useMemo(
    () => getProjectProgressScores(debouncedValue),
    [debouncedValue]
  );
  const isProjectIncomplete =
    projectProgressScores.description !== 1.0 ||
    projectProgressScores.basics !== 1.0 ||
    projectProgressScores.benefits !== 1.0 ||
    projectProgressScores.community !== 1.0;
  const { showMessage } = useToast();

  const startingLines = [
    "Welcome to Teiki 🌱!",
    "My name is Niko, the mascot.",
    "I will guide you through the profile editing process.",
    <span key={0}>
      Firstly, can you tell us about yourself in{" "}
      <span style={{ color: "rgba(0,138,69,1)" }}> 500 to 2500 words </span> ✍️?
    </span>,
  ];

  const [lines, setLines] = React.useState<React.ReactNode[]>(startingLines);
  const alertNewModerationWarning = React.useCallback(
    (section: string, tags: string[]) =>
      setLines([...lines, renderModerationWarningLine(section, tags)]),
    [lines]
  );

  const descriptionUuid = React.useMemo(() => v4(), []);
  const titleUuid = React.useMemo(() => v4(), []);
  const sloganUuid = React.useMemo(() => v4(), []);
  const customUrlUuid = React.useMemo(() => v4(), []);
  const tagsUuid = React.useMemo(() => v4(), []);
  const summaryUuid = React.useMemo(() => v4(), []);
  const benefitsUUid = React.useMemo(() => v4(), []);
  const faqsUuid = React.useMemo(() => v4(), []);

  useContentModeration({
    section: "description",
    uuid: descriptionUuid,
    text: generateText(value.description.body, editorExtensions),
    alertNewModerationWarning,
  });
  useContentModeration({
    section: "title",
    uuid: titleUuid,
    text: value.basics.title,
    alertNewModerationWarning,
  });
  useContentModeration({
    section: "slogan",
    uuid: sloganUuid,
    text: value.basics.slogan,
    alertNewModerationWarning,
  });
  useContentModeration({
    section: "custom url",
    uuid: customUrlUuid,
    text: value.basics.customUrl,
    alertNewModerationWarning,
  });
  useContentModeration({
    section: "tags",
    uuid: tagsUuid,
    text: value.basics.tags.join(","),
    alertNewModerationWarning,
  });
  useContentModeration({
    section: "summary",
    uuid: summaryUuid,
    text: value.basics.summary,
    alertNewModerationWarning,
  });
  useContentModeration({
    section: "benefits",
    uuid: benefitsUUid,
    text:
      value.benefits == null
        ? ""
        : generateText(value.benefits.perks, editorExtensions),
    alertNewModerationWarning,
  });
  useContentModeration({
    section: "faqs",
    uuid: faqsUuid,
    text: value.community.frequentlyAskedQuestions
      .flatMap((faq) => [faq.answer, faq.question])
      .join(","),
    alertNewModerationWarning,
  });

  const [currentSentiment, setCurrentSentiment] = React.useState("neutral");
  const [descriptionSentiment, setDescriptionSentiment] = React.useState("");
  const debouncedSentimentAnalysis = React.useRef(
    awesomeDebouncePromise(getDescriptionSentiment, 1000)
  );
  const [alertedProjectIds, setAlertedProjectIds] = React.useState<string[]>(
    projectId == null ? [] : [projectId]
  );
  const similarProjects = useSimmilarProjects({
    tags: value.basics.tags,
    active: true,
  });

  React.useEffect(() => {
    if (
      currentSentiment !== "negative" &&
      descriptionSentiment === "negative"
    ) {
      setCurrentSentiment(descriptionSentiment);
      const line =
        "Yo calm down boi. Do you kiss your mother's cheek with that dirty mouth???";
      setLines([...lines, line]);
    }
    if (
      currentSentiment === "negative" &&
      descriptionSentiment !== "negative"
    ) {
      setCurrentSentiment(descriptionSentiment);
      const line = "Good boi.";
      setLines([...lines, line]);
    }
  }, [currentSentiment, descriptionSentiment, lines]);

  React.useEffect(() => {
    const newSimilarProjects =
      similarProjects?.filter(
        (project) => !alertedProjectIds.includes(project.id)
      ) ?? [];

    const newLines = [];
    for (const project of newSimilarProjects) {
      newLines.push(<ProjectView value={project}></ProjectView>);
    }

    if (newSimilarProjects.length) {
      setLines([...lines, ...newLines]);
      setAlertedProjectIds([
        ...alertedProjectIds,
        ...newSimilarProjects.map((project) => project.id),
      ]);
    }
  }, [alertedProjectIds, similarProjects, lines]);

  // NOTE: @sk-kitsune: We only run these hooks when tab
  // Basics is active. This is solely for optimization.
  const descriptionAsText = useTextFromJSONContent(
    activeIndex === 1 ? value.description.body : undefined
  );
  const suggestedTags = useSuggestedTags(descriptionAsText || null);
  const suggestedSlogans = useSuggestedSlogans(descriptionAsText || null);
  const [sloganDebounced, sloganDirty] = useDebounce(value.basics.slogan);
  const suggestedCoverImages = useSuggestedCoverImages(
    sloganDirty
      ? null
      : sloganDebounced
      ? sloganDebounced
      : value.basics.tags != null
      ? value.basics.tags
      : suggestedTags || null
  );
  const suggestedTitles = useSuggestedTitles(suggestedTags || null);
  const suggestedSummary = useSuggestedSummary(descriptionAsText || null);
  const suggestedLogoImages = useSuggestedLogoImages(
    value.basics.title.trim()[0] || null,
    sloganDirty
      ? null
      : sloganDebounced
      ? sloganDebounced.split(/\s+/)
      : value.basics.tags != null
      ? value.basics.tags
      : suggestedTags || null
  );
  const suggestedCustomUrls = useSuggestedCustomUrl(value.basics.title);

  return (
    <div>
      <div
        style={{
          top: 0,
          left: 0,
          position: "fixed",
          zIndex: 999999,
        }}
        id="overlay-container"
      ></div>
      <SideBar
        className={styles.sidebar}
        collapsed={isSidebarCollapsed}
        messages={lines.map((node, index) => ({
          createdAt: 0,
          id: index,
          type: "node",
          body: node,
        }))}
      />
      <div
        className={
          !isSidebarCollapsed
            ? styles.main
            : cx(styles.main, styles.collapsedMain)
        }
      >
        <div className={styles.buttonCollapseWrapper}>
          <Button.Solid
            size="small"
            color="white"
            icon={isSidebarCollapsed ? <IconArrowRight /> : <IconArrowLeft />}
            onClick={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
            circular
          />
        </div>
        <PageControl
          value={activeIndex}
          progress={projectProgressScores}
          onChange={(activeIndex) => setActiveIndex(activeIndex)}
        />
        <div className={styles.mainMain}>
          <div style={{ height: "100%" }}>
            {/* TODO: we should not mount/unmount components when switching between tabs */}
            {activeIndex === 0 ? (
              <ProjectDescriptionEditor
                value={value.description}
                onChange={async (newDescription) => {
                  onChange &&
                    onChange({ ...value, description: newDescription });
                  const description = generateText(
                    newDescription.body,
                    editorExtensions
                  );

                  try {
                    const rate = await debouncedSentimentAnalysis.current(
                      description
                    );
                    if (rate?.sentiment?.negative) {
                      setDescriptionSentiment("negative");
                    } else if (rate?.sentiment?.positive) {
                      setDescriptionSentiment("positive");
                    } else {
                      setDescriptionSentiment("neutral");
                    }
                  } catch (error) {
                    console.log("error :>> ", error);
                  }
                }}
              />
            ) : activeIndex === 1 ? (
              <ProjectBasicsEditor
                value={value.basics}
                onChange={(newBasics) => {
                  onChange && onChange({ ...value, basics: newBasics });
                }}
                projectId={projectId}
                suggestedTags={suggestedTags || null}
                suggestedCoverImages={suggestedCoverImages || null}
                suggestedSlogans={suggestedSlogans || null}
                suggestedTitles={suggestedTitles || null}
                suggestedSummary={suggestedSummary || null}
                suggestedLogoImages={suggestedLogoImages || null}
                suggestedCustomUrls={suggestedCustomUrls || null}
              />
            ) : activeIndex === 2 ? (
              <ProjectCommunityEditor
                value={value.community}
                onChange={(newCommunity) => {
                  onChange && onChange({ ...value, community: newCommunity });
                }}
              />
            ) : activeIndex === 3 ? (
              <ProjectBenefitsEditor
                value={value.benefits?.tiers ?? []}
                onChange={async (newTiers) => {
                  onChange &&
                    onChange({
                      ...value,
                      benefits: {
                        perks: emptyProjectBenefitsPerks(),
                        tiers: newTiers,
                      },
                    });
                }}
              />
            ) : null}
            <GrammarlyButton
              style={{
                position: "absolute",
                bottom: "80px",
                right: "48px",
                padding: "10px",
              }}
            />
          </div>
        </div>
        <div className={styles.mainFooter}>
          {statusText ? (
            <div className={styles.statusText}>{statusText}</div>
          ) : null}
          <div className={styles.buttonGroup}>
            <Button.Outline //
              size="medium"
              content="Exit"
              onClick={onExit}
            />
            <Button.Outline
              size="medium"
              content="Preview"
              onClick={onPreview}
            />

            {activeIndex === 0 ? (
              <Button.Solid
                content="Next: Basics"
                size="medium"
                onClick={() => setActiveIndex(1)}
              />
            ) : activeIndex === 1 ? (
              <Button.Solid
                content="Next: Community"
                size="medium"
                onClick={() => setActiveIndex(2)}
              />
            ) : activeIndex === 2 ? (
              <Button.Solid
                content="Next: Benefits"
                size="medium"
                onClick={() => setActiveIndex(3)}
              />
            ) : activeIndex === 3 ? (
              <Button.Solid
                // TODO: use `ButtonAsync` because `onSubmit` is an async function
                size="medium"
                content="Submit"
                onClick={
                  isProjectIncomplete
                    ? () =>
                        showMessage({
                          color: "danger",
                          title: "Incomplete project!",
                          description:
                            "Please complete all the required information",
                        })
                    : onClickSubmit
                }
              />
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}
