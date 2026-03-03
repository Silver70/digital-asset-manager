import { useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { listen } from "@tauri-apps/api/event";
import {
  listAssets,
  importAssets,
  deleteAssets,
  moveAssets,
  getAssetDetail,
} from "../api/assets";

export function useAssets(folderId: number | null) {
  const qc = useQueryClient();

  // Invalidate assets cache when the background worker finishes processing
  useEffect(() => {
    const unlistenPromise = listen("asset:ready", () => {
      qc.invalidateQueries({ queryKey: ["assets"] });
    });
    return () => {
      unlistenPromise.then((unlisten) => unlisten());
    };
  }, [qc]);

  return useQuery({
    queryKey: ["assets", folderId],
    queryFn: () => listAssets(folderId!),
    enabled: folderId !== null,
  });
}

export function useImportAssets() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      filePaths,
      folderId,
    }: {
      filePaths: string[];
      folderId: number;
    }) => importAssets(filePaths, folderId),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["assets"] }),
  });
}

export function useDeleteAssets() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (ids: number[]) => deleteAssets(ids),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["assets"] }),
  });
}

export function useMoveAssets() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ ids, folderId }: { ids: number[]; folderId: number }) =>
      moveAssets(ids, folderId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["assets"] });
    },
  });
}

export function useAssetDetail(assetId: number | null) {
  return useQuery({
    queryKey: ["asset-detail", assetId],
    queryFn: () => getAssetDetail(assetId!),
    enabled: assetId !== null,
    staleTime: 10_000,
  });
}
