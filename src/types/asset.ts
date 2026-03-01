// Rust serializes struct fields as snake_case — TypeScript types match.

export type ProcessingStatus = "pending" | "processing" | "complete" | "failed";

export interface Asset {
  id: number;
  name: string;
  folder_id: number;
  file_path: string;
  file_size: number;
  mime_type: string | null;
  extension: string;
  thumbnail_path: string | null;
  processing_status: ProcessingStatus;
  creator: string | null;
  upload_date: string;
  created_at: string;
  updated_at: string;
}
