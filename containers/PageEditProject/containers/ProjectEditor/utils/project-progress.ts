import { generateText } from "@tiptap/core";

import { ProgressScore, ProjectProgressScores } from "../../../types";

import {
  Project,
  ProjectBasics,
  ProjectBenefits,
  ProjectCommunity,
  ProjectDescription,
} from "@/modules/business-types";
import { editorExtensions } from "@/modules/teiki-components/components/RichTextEditor/config";

export function getProjectProgressScores(
  project: Project
): ProjectProgressScores {
  return {
    description: getDescriptionProgress(project.description),
    basics: getBasicProgress(project.basics),
    benefits: getProjectBenefitsProgress(project.benefits),
    community: getCommunityProgress(project.community),
  };
}

function getDescriptionProgress(
  description: ProjectDescription
): ProgressScore {
  const bodyContent = description.body;
  const textContent = generateText(bodyContent, editorExtensions);
  return textContent.length > 100 ? 1.0 : 0.0;
}

function getBasicProgress(basic: ProjectBasics): ProgressScore {
  return (
    (basic.title.length > 0 ? 0.5 : 0) + (basic.customUrl.length > 0 ? 0.5 : 0)
  );
}

function getProjectBenefitsProgress(
  benefits: ProjectBenefits | undefined
): ProgressScore {
  if (benefits == null) return 0.0;
  return 1.0;
}

function getCommunityProgress(community: ProjectCommunity): ProgressScore {
  if (community.socialChannels.length > 0) {
    if (community.frequentlyAskedQuestions.length > 0) {
      const hasIncompleteFaq: boolean = community.frequentlyAskedQuestions.some(
        (frequentlyAskedQuestion) =>
          !frequentlyAskedQuestion.answer || !frequentlyAskedQuestion.question
      );

      return hasIncompleteFaq ? 0.5 : 1;
    }
    return 1.0;
  }
  return 0.0;
}
