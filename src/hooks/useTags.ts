import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  getAllTags,
  getAssetTags,
  createTag,
  deleteTag,
  assignTags,
  removeTags,
} from "../api/tags";

export function useAllTags() {
  return useQuery({
    queryKey: ["tags"],
    queryFn: getAllTags,
  });
}

export function useAssetTags(assetId: number) {
  return useQuery({
    queryKey: ["tags", "asset", assetId],
    queryFn: () => getAssetTags(assetId),
    enabled: assetId > 0,
  });
}

export function useCreateTag() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ name, color }: { name: string; color: string }) =>
      createTag(name, color),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["tags"] }),
  });
}

export function useDeleteTag() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => deleteTag(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["tags"] }),
  });
}

export function useAssignTags() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      assetIds,
      tagIds,
    }: {
      assetIds: number[];
      tagIds: number[];
    }) => assignTags(assetIds, tagIds),
    onSuccess: (_data, { assetIds }) => {
      assetIds.forEach((id) =>
        qc.invalidateQueries({ queryKey: ["tags", "asset", id] }),
      );
    },
  });
}

export function useRemoveTags() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      assetIds,
      tagIds,
    }: {
      assetIds: number[];
      tagIds: number[];
    }) => removeTags(assetIds, tagIds),
    onSuccess: (_data, { assetIds }) => {
      assetIds.forEach((id) =>
        qc.invalidateQueries({ queryKey: ["tags", "asset", id] }),
      );
    },
  });
}
