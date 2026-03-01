#[derive(Debug, serde::Serialize, serde::Deserialize, sqlx::FromRow)]
pub struct ImageMetadata {
    pub asset_id: i64,
    pub width: Option<i32>,
    pub height: Option<i32>,
    pub color_profile: Option<String>,
    pub dpi: Option<f64>,
    /// Stored as 0/1 in SQLite
    pub has_alpha: bool,
}

#[derive(Debug, serde::Serialize, serde::Deserialize, sqlx::FromRow)]
pub struct VideoMetadata {
    pub asset_id: i64,
    pub width: Option<i32>,
    pub height: Option<i32>,
    pub duration: Option<f64>,
    pub frame_rate: Option<f64>,
    pub codec: Option<String>,
    pub audio_codec: Option<String>,
    pub bit_rate: Option<i64>,
}
