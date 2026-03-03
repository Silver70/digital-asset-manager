use tauri::State;

use crate::error::AppError;
use crate::models::asset::Asset;
use crate::state::AppState;

// ─── Helpers ─────────────────────────────────────────────────────────────────

macro_rules! active_pool {
    ($state:expr) => {{
        let org_id = $state
            .active_org_id
            .read()
            .await
            .clone()
            .ok_or(AppError::NotAuthenticated)?;

        let guard = $state.db_pool.read().await;
        let pool = guard
            .get(&org_id)
            .cloned()
            .ok_or(AppError::NotAuthenticated)?;

        (org_id, pool)
    }};
}

/// Converts raw user input into a safe FTS5 prefix-match query string.
///
/// Each whitespace-delimited token is stripped of FTS5 special characters,
/// wrapped in quotes, and suffixed with `*` for prefix matching.
/// Returns `None` if no usable tokens remain after sanitisation.
fn build_fts_query(raw: &str) -> Option<String> {
    let tokens: Vec<String> = raw
        .split_whitespace()
        .filter_map(|t| {
            let clean: String = t
                .chars()
                .filter(|c| c.is_alphanumeric() || *c == '_' || *c == '-' || *c == '.')
                .collect();
            if clean.is_empty() {
                None
            } else {
                Some(format!("\"{}\"*", clean))
            }
        })
        .collect();

    if tokens.is_empty() {
        None
    } else {
        Some(tokens.join(" "))
    }
}

// ─── Command ─────────────────────────────────────────────────────────────────

/// Searches assets using FTS5 full-text search combined with optional filters.
///
/// - `query`      — full-text search string (prefix-matched against asset names)
/// - `tag_ids`    — must have ALL listed tags (existence filter per tag)
/// - `mime_types` — asset mime_type must be IN this list
/// - `date_from`  — earliest upload date (inclusive, ISO date `YYYY-MM-DD`)
/// - `date_to`    — latest upload date   (inclusive, ISO date `YYYY-MM-DD`)
/// - `folder_id`  — restrict to a single folder
///
/// Returns up to 500 results ordered by upload date descending.
/// Returns an empty vec if no filters are active to avoid a full-table scan.
#[tauri::command]
pub async fn search_assets(
    query: String,
    tag_ids: Vec<i64>,
    mime_types: Vec<String>,
    date_from: Option<String>,
    date_to: Option<String>,
    folder_id: Option<i64>,
    state: State<'_, AppState>,
) -> Result<Vec<Asset>, AppError> {
    let (_org_id, pool) = active_pool!(state);

    let fts_query = if query.trim().is_empty() {
        None
    } else {
        build_fts_query(query.trim())
    };

    let use_tags = !tag_ids.is_empty();
    let use_mimes = !mime_types.is_empty();

    // Short-circuit: return empty when no filters are active
    if fts_query.is_none()
        && !use_tags
        && !use_mimes
        && date_from.is_none()
        && date_to.is_none()
        && folder_id.is_none()
    {
        return Ok(vec![]);
    }

    // ── Build WHERE conditions ────────────────────────────────────────────────

    let mut conditions: Vec<String> = Vec::new();

    if fts_query.is_some() {
        conditions.push(
            "a.id IN (SELECT rowid FROM asset_fts WHERE asset_fts MATCH ?)".to_string(),
        );
    }

    // Each tag_id becomes a separate EXISTS subquery — asset must have ALL tags
    for _ in &tag_ids {
        conditions.push(
            "EXISTS (SELECT 1 FROM asset_tags att WHERE att.asset_id = a.id AND att.tag_id = ?)"
                .to_string(),
        );
    }

    if use_mimes {
        let ph = mime_types
            .iter()
            .map(|_| "?")
            .collect::<Vec<_>>()
            .join(", ");
        conditions.push(format!("a.mime_type IN ({ph})"));
    }

    if date_from.is_some() {
        conditions.push("date(a.upload_date) >= ?".to_string());
    }
    if date_to.is_some() {
        conditions.push("date(a.upload_date) <= ?".to_string());
    }
    if folder_id.is_some() {
        conditions.push("a.folder_id = ?".to_string());
    }

    let where_clause = if conditions.is_empty() {
        String::new()
    } else {
        format!("WHERE {}", conditions.join(" AND "))
    };

    let sql = format!(
        "SELECT a.* FROM assets a {where_clause} ORDER BY a.upload_date DESC LIMIT 500"
    );

    // ── Bind parameters (same order as conditions) ────────────────────────────

    let mut q = sqlx::query_as::<_, Asset>(&sql);

    if let Some(fts) = fts_query {
        q = q.bind(fts);
    }
    for id in &tag_ids {
        q = q.bind(*id);
    }
    for mime in &mime_types {
        q = q.bind(mime);
    }
    if let Some(df) = &date_from {
        q = q.bind(df);
    }
    if let Some(dt) = &date_to {
        q = q.bind(dt);
    }
    if let Some(fid) = folder_id {
        q = q.bind(fid);
    }

    let assets = q.fetch_all(&pool).await?;
    Ok(assets)
}
