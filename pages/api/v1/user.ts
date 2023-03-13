import { NextApiRequest, NextApiResponse } from "next";

import { DetailedProject } from "@/modules/business-types";
import { toJson } from "@/modules/json-utils";
import { apiCatch, ClientError } from "@/modules/next-backend/api/errors";
import { db, redis } from "@/modules/next-backend/connections";
import { getBackedProjectsByBacker } from "@/modules/next-backend/logic/getBackedProjectsByBacker";
import { getDetailedProject } from "@/modules/next-backend/logic/getDetailedProject";
import { getProjectTeikiRewardsByBacker } from "@/modules/next-backend/logic/getProjectTeikiRewardsByBacker";
import { CodecCid } from "@/modules/next-backend/utils/CodecCid";
import { Converters } from "@/modules/with-bufs-as-converters";

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  try {
    const { address } = req.query;
    ClientError.assert(typeof address === "string", "invalid request");
    /** NOTE (CMIIW):
     *  An user can actually has many projects and we might
     *  need info about the 'closed'/'delisted' ones here
     */
    // TODO: Returning a list of owner's projects
    const ownProject = await getDetailedProject(db, redis, {
      active: true,
      ownerAddress: address,
      preset: "basic",
    });
    const backedProjects = await getBackedProjectsByBacker(db, { address });
    const detailedBackedProjects = await Promise.all(
      backedProjects.map(async (item) => {
        const project = Converters.toProject(CodecCid)(item.contents);
        const detailedProject: DetailedProject = {
          id: item.projectId,
          basics: project.basics,
        };
        const teikiRewards = await getProjectTeikiRewardsByBacker(db, {
          backerAddress: address,
          projectId: item.projectId,
        });
        return {
          project: detailedProject,
          numLovelacesBacked: item.totalBackingAmountByUser,
          numMicroTeikisUnclaimed: teikiRewards.amount,
          isCurrentlyBacking: item.isCurrentlyBacking,
        };
      })
    );
    const response = {
      // TODO: Handle error more properly here
      ownProject: ownProject.error ? [] : [ownProject.project],
      backedProjects: detailedBackedProjects,
    };
    res.send(toJson(response, undefined, 2));
  } catch (error) {
    apiCatch(req, res, error);
  }
}
