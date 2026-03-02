// Rust serializes struct fields as snake_case — TypeScript types match.

export interface Tag {
  id: number;
  name: string;
  color: string;
  created_at: string;
}
