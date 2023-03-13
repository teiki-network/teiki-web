import { GetServerSideProps } from "next";
import { SWRConfig, unstable_serialize } from "swr";

import PageProjectDetails from "../../../containers/PageProjectDetails";

import { DisplayableError } from "@/modules/displayable-error";
import { db, redis } from "@/modules/next-backend/connections";
import {
  getDetailedProject,
  GetDetailedProject$Params,
  GET_DETAILED_PROJECT__ERRORS,
} from "@/modules/next-backend/logic/getDetailedProject";
import { httpGetProject$GetKey } from "@/modules/next-backend-client/api/httpGetProject";

type Props = {
  fallback: Record<string, unknown>;
  customUrl: string;
};

// eslint-disable-next-line react/prop-types
export default function RouteToPageProjectDetails({
  fallback,
  customUrl,
}: Props) {
  return (
    <SWRConfig value={{ fallback }}>
      <PageProjectDetails projectCustomUrl={customUrl} projectId={undefined} />
    </SWRConfig>
  );
}

export const getServerSideProps: GetServerSideProps<Props> = async (
  context
) => {
  const customUrl = context.params?.["customUrl"];

  if (typeof customUrl !== "string" || !/^[ -~]+$/.test(customUrl)) {
    return { notFound: true };
  }

  const project$Params: GetDetailedProject$Params = {
    customUrl,
    projectId: undefined,
    preset: "full",
  };
  const project$Key = httpGetProject$GetKey(project$Params);
  const project$Response = await getDetailedProject(
    db,
    redis,
    project$Params
  ).catch((error) => {
    throw new DisplayableError({
      title: "Server error",
      description: "Failed to get the creator.",
      cause: error,
    });
  });

  if (project$Response?.error === GET_DETAILED_PROJECT__ERRORS.NOT_FOUND) {
    return { notFound: true };
  }

  return {
    props: {
      fallback: {
        [unstable_serialize(project$Key)]: project$Response,
      },
      customUrl,
    },
  };
};
