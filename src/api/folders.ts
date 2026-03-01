import { invoke } from "@tauri-apps/api/core";
import type { Folder, FolderNode } from "../types/folder";

// Tauri v2 converts camelCase JS keys → snake_case Rust params automatically.

export function getFolderTree(): Promise<FolderNode[]> {
  return invoke<FolderNode[]>("get_folder_tree");
}

export function createFolder(
  name: string,
  parentId: number | null,
): Promise<Folder> {
  return invoke<Folder>("create_folder", { name, parentId });
}

export function renameFolder(id: number, name: string): Promise<Folder> {
  return invoke<Folder>("rename_folder", { id, name });
}

export function moveFolder(
  id: number,
  newParentId: number | null,
): Promise<void> {
  return invoke<void>("move_folder", { id, newParentId });
}

export function deleteFolder(id: number): Promise<void> {
  return invoke<void>("delete_folder", { id });
}
