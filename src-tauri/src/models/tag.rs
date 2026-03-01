use chrono::NaiveDateTime;

#[derive(Debug, serde::Serialize, serde::Deserialize, sqlx::FromRow)]
pub struct Tag {
    pub id: i64,
    pub name: String,
    pub color: String,
    pub created_at: NaiveDateTime,
}
