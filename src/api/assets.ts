import { invoke } from "@tauri-apps/api/core";
import type { Asset } from "../types/asset";
import type { AssetDetail } from "../types/metadata";

export function listAssets(folderId: number): Promise<Asset[]> {
  return invoke<Asset[]>("list_assets", { folderId });
}

export function importAssets(
  filePaths: string[],
  folderId: number,
): Promise<Asset[]> {
  return invoke<Asset[]>("import_assets", { filePaths, folderId });
}

export function deleteAssets(ids: number[]): Promise<void> {
  return invoke<void>("delete_assets", { ids });
}

export function moveAssets(ids: number[], folderId: number): Promise<void> {
  return invoke<void>("move_assets", { ids, folderId });
}

export function getAssetDetail(id: number): Promise<AssetDetail> {
  return invoke<AssetDetail>("get_asset_detail", { id });
}

export function retryAsset(id: number): Promise<void> {
  return invoke<void>("retry_asset_processing", { id });
}
