use chrono::NaiveDateTime;

#[derive(Debug, Clone, serde::Serialize, serde::Deserialize, sqlx::FromRow)]
pub struct Folder {
    pub id: i64,
    pub name: String,
    pub parent_id: Option<i64>,
    pub path: String,
    pub depth: i32,
    pub created_at: NaiveDateTime,
    pub updated_at: NaiveDateTime,
}

/// Folder with its children populated — used for the folder tree response.
#[derive(Debug, serde::Serialize)]
pub struct FolderNode {
    #[serde(flatten)]
    pub folder: Folder,
    pub children: Vec<FolderNode>,
}
