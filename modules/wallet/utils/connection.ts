import { Lucid, Network, Provider } from "lucid-cardano";

import { WalletInfo, WalletName } from "../types";

import * as Auth from "@/modules/authorization";
import { sumLovelaceAmount } from "@/modules/bigint-utils";
import { assert } from "@/modules/common-utils";

export async function getWalletInfo(
  walletName: WalletName,
  lucid: Lucid
): Promise<WalletInfo> {
  const address = await lucid.wallet.address();
  const utxos = await lucid.wallet.getUtxos();
  const lovelaceAmount = sumLovelaceAmount(
    utxos.map((utxo) => utxo.assets.lovelace || BigInt(0))
  );
  const addressDetails = lucid.utils.getAddressDetails(address);

  return { walletName, lovelaceAmount, address, addressDetails };
}

/**
 * Connects to a wallet.
 *
 * Returns `[WalletInfo, Lucid]` if succeeds.
 * Throws an error if failed.
 */
export async function connectWallet(
  walletName: WalletName,
  context: { provider: Provider; network: Network }
): Promise<[WalletInfo, Lucid]> {
  const wallet = window?.cardano?.[walletName];
  assert(wallet, "wallet undefined");
  const walletApi = await wallet.enable();
  const lucid = (
    await Lucid.new(context.provider, context.network)
  ).selectWallet(walletApi);
  const walletInfo = await getWalletInfo(walletName, lucid);
  await Auth.refresh(lucid);
  return [walletInfo, lucid];
}
