import { invoke } from "@tauri-apps/api/core";

/** Returns the storage root path for the active org, or null if not set. */
export function getStoragePath(): Promise<string | null> {
  return invoke<string | null>("get_storage_path");
}

/** Sets the storage root path for the active org. Creates subdirectories. */
export function setStoragePath(path: string): Promise<void> {
  return invoke<void>("set_storage_path", { path });
}
