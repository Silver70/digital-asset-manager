import {
  useQuery,
  useMutation,
  useQueryClient,
} from "@tanstack/react-query";
import {
  getFolderTree,
  createFolder,
  renameFolder,
  moveFolder,
  deleteFolder,
} from "../api/folders";

export function useFolderTree() {
  return useQuery({
    queryKey: ["folders"],
    queryFn: getFolderTree,
  });
}

export function useCreateFolder() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      name,
      parentId,
    }: {
      name: string;
      parentId: number | null;
    }) => createFolder(name, parentId),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["folders"] }),
  });
}

export function useRenameFolder() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, name }: { id: number; name: string }) =>
      renameFolder(id, name),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["folders"] }),
  });
}

export function useMoveFolder() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      id,
      newParentId,
    }: {
      id: number;
      newParentId: number | null;
    }) => moveFolder(id, newParentId),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["folders"] }),
  });
}

export function useDeleteFolder() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => deleteFolder(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["folders"] }),
  });
}
