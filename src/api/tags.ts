import { invoke } from "@tauri-apps/api/core";
import type { Tag } from "../types/tag";

export function getAllTags(): Promise<Tag[]> {
  return invoke<Tag[]>("get_all_tags");
}

export function getAssetTags(assetId: number): Promise<Tag[]> {
  return invoke<Tag[]>("get_asset_tags", { assetId });
}

export function createTag(name: string, color: string): Promise<Tag> {
  return invoke<Tag>("create_tag", { name, color });
}

export function deleteTag(id: number): Promise<void> {
  return invoke<void>("delete_tag", { id });
}

export function assignTags(assetIds: number[], tagIds: number[]): Promise<void> {
  return invoke<void>("assign_tags", { assetIds, tagIds });
}

export function removeTags(assetIds: number[], tagIds: number[]): Promise<void> {
  return invoke<void>("remove_tags", { assetIds, tagIds });
}
