use chrono::NaiveDateTime;
use crate::models::{metadata::{ImageMetadata, VideoMetadata}, tag::Tag};

#[derive(Debug, serde::Serialize, serde::Deserialize, sqlx::FromRow)]
pub struct Asset {
    pub id: i64,
    pub name: String,
    pub folder_id: i64,
    pub file_path: String,
    pub file_size: i64,
    pub mime_type: Option<String>,
    pub extension: String,
    pub thumbnail_path: Option<String>,
    pub processing_status: String,
    pub creator: Option<String>,
    pub upload_date: NaiveDateTime,
    pub created_at: NaiveDateTime,
    pub updated_at: NaiveDateTime,
}

/// Full asset detail including type-specific metadata and tags.
/// Returned by `get_asset_detail`.
#[derive(Debug, serde::Serialize)]
pub struct AssetDetail {
    #[serde(flatten)]
    pub asset: Asset,
    pub image_metadata: Option<ImageMetadata>,
    pub video_metadata: Option<VideoMetadata>,
    pub tags: Vec<Tag>,
}

/// Paginated search result.
#[derive(Debug, serde::Serialize)]
pub struct SearchResult {
    pub assets: Vec<Asset>,
    pub total: i64,
    pub page: i64,
    pub page_size: i64,
}
