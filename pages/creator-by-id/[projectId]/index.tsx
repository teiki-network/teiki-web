import { GetServerSideProps } from "next";

import PageProjectDetails from "../../../containers/PageProjectDetails";

import { DisplayableError } from "@/modules/displayable-error";
import { db, redis } from "@/modules/next-backend/connections";
import {
  getDetailedProject,
  GET_DETAILED_PROJECT__ERRORS,
} from "@/modules/next-backend/logic/getDetailedProject";

type Props = {
  projectId: string;
};

// eslint-disable-next-line react/prop-types
export default function RouteToPageProjectDetails({ projectId }: Props) {
  return (
    <PageProjectDetails projectCustomUrl={undefined} projectId={projectId} />
  );
}

export const getServerSideProps: GetServerSideProps<Props> = async (
  context
) => {
  const projectId = context.params?.["projectId"];

  if (typeof projectId !== "string" || !/^[ -~]+$/.test(projectId)) {
    return { notFound: true };
  }

  const project$Response = await getDetailedProject(db, redis, {
    projectId,
    preset: "minimal",
  }).catch((error) => {
    throw new DisplayableError({
      title: "Server error",
      description: "Failed to get the creator.",
      cause: error,
    });
  });

  if (project$Response.error === GET_DETAILED_PROJECT__ERRORS.NOT_FOUND) {
    return {
      notFound: true,
    };
  }

  return {
    props: {
      projectId,
    },
  };
};
