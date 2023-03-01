import { generateText } from "@tiptap/core";

import { Project } from "@/modules/business-types";
import { parseProject } from "@/modules/business-types/utils/parsing";
import { load, save } from "@/modules/storage-v2";
import { editorExtensions } from "@/modules/teiki-components/components/RichTextEditor/config";
import { Converters } from "@/modules/with-bufs-as-converters";
import CodecBlob from "@/modules/with-bufs-as-converters/codecs/CodecBlob";

export function getStorageId(paymentPubKeyHash: string) {
  // https://www.notion.so/shinka-network/549ee87019e240cd8c9de1cc3f49bbab
  return `storage-v2://creator-create-project/by-payment-pkh/${paymentPubKeyHash}/project--auto-saved`;
}

function newProject(): Project {
  return {
    description: {
      body: {
        type: "doc",
        content: [{ type: "paragraph" }],
      },
    },
    basics: {
      title: "",
      slogan: "",
      customUrl: "",
      tags: [],
      summary: "",
      coverImages: [],
      logoImage: null,
    },
    roadmapInfo: { milestones: [] },
    community: {
      socialChannels: [],
      frequentlyAskedQuestions: [],
    },
  };
}

async function loadProjectFromBrowserStorage(
  storageId: string
): Promise<Project> {
  const { data, bufs } = await load(storageId);
  const project = parseProject(data);
  return Converters.toProject(CodecBlob)({ data: project, bufs });
}

export async function loadProject(storageId: string) {
  try {
    return await loadProjectFromBrowserStorage(storageId);
  } catch {
    return newProject();
  }
}

export async function saveProject(
  storageId: string,
  project: Project,
  signal?: AbortSignal
) {
  const blobWBA = await Converters.fromProject(CodecBlob)(project);
  signal && signal.throwIfAborted();
  await save(storageId, blobWBA);
}

// TODO: @sk-kitsune: improve this implementation
export function isNewProject(project: Project) {
  if (project.description.body.content?.length !== 1) return false;
  const text = generateText(project.description.body, editorExtensions);
  return text.trim() === "";
}
