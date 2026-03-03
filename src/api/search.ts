import { invoke } from "@tauri-apps/api/core";
import type { Asset } from "../types/asset";

export interface SearchParams {
  query: string;
  tagIds: number[];
  mimeTypes: string[];
  dateFrom: string | null;
  dateTo: string | null;
  folderId: number | null;
}

export function searchAssets(params: SearchParams): Promise<Asset[]> {
  return invoke<Asset[]>("search_assets", {
    query: params.query,
    tagIds: params.tagIds,
    mimeTypes: params.mimeTypes,
    dateFrom: params.dateFrom,
    dateTo: params.dateTo,
    folderId: params.folderId,
  });
}
