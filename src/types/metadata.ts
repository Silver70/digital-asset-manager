// Rust serializes struct fields as snake_case — TypeScript types match.

import type { Asset } from "./asset";
import type { Tag } from "./tag";

export interface ImageMetadata {
  asset_id: number;
  width: number | null;
  height: number | null;
  color_profile: string | null;
  dpi: number | null;
  has_alpha: boolean;
}

export interface VideoMetadata {
  asset_id: number;
  width: number | null;
  height: number | null;
  duration: number | null;
  frame_rate: number | null;
  codec: string | null;
  audio_codec: string | null;
  bit_rate: number | null;
}

/** Full asset detail returned by get_asset_detail — asset fields flattened + metadata + tags. */
export interface AssetDetail extends Asset {
  image_metadata: ImageMetadata | null;
  video_metadata: VideoMetadata | null;
  tags: Tag[];
}
