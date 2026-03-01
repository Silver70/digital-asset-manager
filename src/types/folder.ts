// Rust serializes struct fields as snake_case — TypeScript types match.

export interface Folder {
  id: number;
  name: string;
  parent_id: number | null;
  path: string;
  depth: number;
  created_at: string;
  updated_at: string;
}

/** Folder with its children populated — mirrors the Rust FolderNode response. */
export interface FolderNode extends Folder {
  children: FolderNode[];
}
