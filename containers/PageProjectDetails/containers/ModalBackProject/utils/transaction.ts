import * as S from "@teiki/protocol/schema";
import { ProjectDatum } from "@teiki/protocol/schema/teiki/project";
import {
  PlantParams,
  plantTx,
} from "@teiki/protocol/transactions/backing/plant";
import { Lucid, Tx, TxComplete } from "lucid-cardano";

import { splitToLines } from "@/modules/array-utils";
import { LovelaceAmount } from "@/modules/business-types";
import { DisplayableError } from "@/modules/displayable-error";
import { TxParams$BackerBackProject } from "@/modules/next-backend/logic/getBackerBackProject";
import { getReferenceTxTime } from "@/modules/protocol/utils";

export type BuildTxParams = {
  lucid: Lucid;
  lovelaceAmount: LovelaceAmount;
  message: string; // TODO: @sk-saru attach to metadata in the next PR
  txParams: TxParams$BackerBackProject;
};

export type BuildTxResult = {
  txFee: LovelaceAmount;
  txComplete: TxComplete;
};

export async function buildTx(params: BuildTxParams): Promise<BuildTxResult> {
  const tx = await buildTxRaw(params);
  // `nativeUplc` is specified as a temporary workaround for an Aiken bug
  const txComplete = await tx.complete({ nativeUplc: false });

  const txFee = BigInt(txComplete.txComplete.body().fee().to_str());

  return { txFee, txComplete };
}

// TODO: @sk-saru remove this function when the migration is done.
export async function buildTxRaw({
  lucid,
  lovelaceAmount,
  message,
  txParams,
}: BuildTxParams): Promise<Tx> {
  const supported = BigInt(lovelaceAmount);

  const backerAddress = await lucid.wallet.address();

  const {
    protocolParamsUtxo,
    projectUtxo,
    projectScriptUtxo,
    proofOfBackingMpRefUtxo,
    backingScriptRefUtxo,
  } = txParams;

  DisplayableError.assert(
    projectUtxo.datum != null,
    "invalid project utxo: missing inline datum"
  );

  DisplayableError.assert(
    proofOfBackingMpRefUtxo.scriptRef != null &&
      proofOfBackingMpRefUtxo.scriptHash != null,
    "invalid proof of backing reference utxo: must reference proof of backing script"
  );

  DisplayableError.assert(
    backingScriptRefUtxo.scriptRef != null &&
      backingScriptRefUtxo.scriptHash != null,
    "invalid backing reference utxo: must reference backing script"
  );

  // NOTE: get project credential from project script address due to AllocateStaking...
  const projectStakeCredential = lucid.utils.getAddressDetails(
    projectScriptUtxo.address
  ).stakeCredential;

  const projectDatum = S.fromData(S.fromCbor(projectUtxo.datum), ProjectDatum);

  const backingValidatorHash = backingScriptRefUtxo.scriptHash;

  const backingScriptAddress = lucid.utils.credentialToAddress(
    lucid.utils.scriptHashToCredential(backingValidatorHash),
    projectStakeCredential
  );

  const txTime = await getReferenceTxTime();

  const plantParams: PlantParams = {
    protocolParamsUtxo,
    projectInfo: {
      id: projectDatum.projectId.id,
      currentMilestone: projectDatum.milestoneReached,
      projectUtxo,
      projectScriptUtxo,
    },
    backingInfo: {
      amount: supported,
      backerAddress,
      backingUtxos: [],
      backingScriptAddress,
      backingScriptRefUtxo,
      proofOfBackingMpRefUtxo,
      proofOfBackingMph: proofOfBackingMpRefUtxo.scriptHash,
    },
    txTime,
  };

  let tx = plantTx(lucid, plantParams);
  tx = tx
    .addSigner(plantParams.backingInfo.backerAddress)
    .attachMetadata(674, { msg: splitToLines(message, 64) });

  return tx;
}
