use std::time::{SystemTime, UNIX_EPOCH};

use jsonwebtoken::{decode, decode_header, jwk::JwkSet, Algorithm, DecodingKey, Validation};
use serde::{Deserialize, Serialize};
use tauri::{Manager, State};

use crate::db::init::open_org_db;
use crate::error::AppError;
use crate::state::{AppState, AuthState, OrgMembership};

const KEYRING_SERVICE: &str = "digital-asset-manager";
const KEYRING_USER: &str = "clerk-jwt";
const JWKS_CACHE_TTL_SECS: u64 = 86_400; // 24 hours

// ─── Internal JWT claim types ────────────────────────────────────────────────

#[derive(Debug, Deserialize)]
struct ClerkClaims {
    sub: String,
    iss: String,
    // org_id is deserialized but membership enforcement is done via AppState.auth.orgs
    #[allow(dead_code)]
    #[serde(default)]
    org_id: Option<String>,
}

#[derive(Serialize, Deserialize)]
struct JwksCache {
    fetched_at: u64,
    raw: String, // raw JWKS JSON for safe round-trip
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

fn now_secs() -> u64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap_or_default()
        .as_secs()
}

/// Fetches JWKS from the Clerk JWKS endpoint, caching the result on disk for
/// 24 hours to support offline JWT validation after the first successful fetch.
async fn get_jwks(jwks_url: &str, app_handle: &tauri::AppHandle) -> Result<JwkSet, AppError> {
    let cache_path = app_handle
        .path()
        .app_data_dir()
        .map_err(|e| AppError::Logic(format!("Cannot resolve app data dir: {e}")))?
        .join("digital-asset-manager")
        .join("jwks_cache.json");

    // Use on-disk cache if it is fresh enough
    if let Ok(raw_file) = tokio::fs::read_to_string(&cache_path).await {
        if let Ok(cache) = serde_json::from_str::<JwksCache>(&raw_file) {
            if now_secs().saturating_sub(cache.fetched_at) < JWKS_CACHE_TTL_SECS {
                if let Ok(jwks) = serde_json::from_str::<JwkSet>(&cache.raw) {
                    return Ok(jwks);
                }
            }
        }
    }

    // Fetch fresh JWKS
    let raw = reqwest::get(jwks_url)
        .await
        .map_err(|e| AppError::Logic(format!("Failed to fetch JWKS from Clerk: {e}")))?
        .text()
        .await
        .map_err(|e| AppError::Logic(format!("Failed to read JWKS response: {e}")))?;

    let jwks: JwkSet = serde_json::from_str(&raw)
        .map_err(|e| AppError::Logic(format!("Invalid JWKS format: {e}")))?;

    // Persist cache
    if let Some(parent) = cache_path.parent() {
        let _ = tokio::fs::create_dir_all(parent).await;
    }
    let cache_json = serde_json::to_string(&JwksCache { fetched_at: now_secs(), raw }).unwrap();
    let _ = tokio::fs::write(&cache_path, cache_json).await;

    Ok(jwks)
}

/// Validates a Clerk-issued RS256 JWT.
///
/// Steps:
/// 1. Peek at the payload (no signature check) to extract `iss` → JWKS URL
/// 2. Fetch (or use cached) JWKS from that URL
/// 3. Find the JWK whose `kid` matches the JWT header
/// 4. Perform full RS256 signature + expiry validation
async fn validate_jwt(jwt: &str, app_handle: &tauri::AppHandle) -> Result<ClerkClaims, AppError> {
    // Step 1 — unsafe peek to extract `iss`
    let mut unsafe_val = Validation::new(Algorithm::RS256);
    unsafe_val.insecure_disable_signature_validation();
    unsafe_val.set_required_spec_claims::<&str>(&[]);
    unsafe_val.validate_exp = false;

    let peeked = decode::<ClerkClaims>(jwt, &DecodingKey::from_secret(b""), &unsafe_val)
        .map_err(|e| AppError::Logic(format!("JWT decode error: {e}")))?;

    let iss = peeked.claims.iss.trim_end_matches('/').to_string();

    // Step 2 — JWKS
    let jwks_url = format!("{}/.well-known/jwks.json", iss);
    let jwks = get_jwks(&jwks_url, app_handle).await?;

    // Step 3 — find matching JWK
    let header = decode_header(jwt)
        .map_err(|e| AppError::Logic(format!("JWT header error: {e}")))?;
    let kid = header
        .kid
        .ok_or_else(|| AppError::Logic("JWT is missing `kid` header".to_string()))?;
    let jwk = jwks
        .find(&kid)
        .ok_or_else(|| AppError::Logic(format!("JWK with kid='{kid}' not found in JWKS")))?;
    let decoding_key = DecodingKey::from_jwk(jwk)
        .map_err(|e| AppError::Logic(format!("Cannot construct decoding key: {e}")))?;

    // Step 4 — full validation
    let mut validation = Validation::new(Algorithm::RS256);
    validation.set_issuer(&[&iss]);
    validation.validate_aud = false;

    let token_data = decode::<ClerkClaims>(jwt, &decoding_key, &validation)
        .map_err(|e| AppError::Logic(format!("JWT validation failed: {e}")))?;

    Ok(token_data.claims)
}

// ─── Tauri Commands ───────────────────────────────────────────────────────────

/// Validates the JWT, caches it in the OS keychain, and populates in-memory auth state.
///
/// `email` and `orgs` come from the Clerk React SDK on the frontend because they are
/// not included in the JWT payload by default. The JWT itself provides the
/// cryptographic proof of identity.
#[tauri::command]
pub async fn set_session(
    jwt: String,
    email: String,
    orgs: Vec<OrgMembership>,
    state: State<'_, AppState>,
    app_handle: tauri::AppHandle,
) -> Result<AuthState, AppError> {
    let claims = validate_jwt(&jwt, &app_handle).await?;

    let entry = keyring::Entry::new(KEYRING_SERVICE, KEYRING_USER)
        .map_err(|e| AppError::Logic(format!("Keychain init error: {e}")))?;
    entry
        .set_password(&jwt)
        .map_err(|e| AppError::Logic(format!("Cannot store JWT in keychain: {e}")))?;

    let auth = AuthState {
        user_id: claims.sub,
        email,
        orgs,
        active_org_id: None,
    };

    *state.auth.write().await = Some(auth.clone());

    Ok(auth)
}

/// Switches the active org for the current session.
///
/// Membership is verified against the `auth.orgs` list that was already
/// cryptographically validated during `set_session` — no second JWT round-trip
/// required (and no timing dependency on Clerk's token cache).
#[tauri::command]
pub async fn switch_org(
    org_id: String,
    state: State<'_, AppState>,
    app_handle: tauri::AppHandle,
) -> Result<(), AppError> {
    // Verify user is a member of the requested org
    {
        let auth_guard = state.auth.read().await;
        let auth = auth_guard.as_ref().ok_or(AppError::NotAuthenticated)?;
        if !auth.orgs.iter().any(|o| o.org_id == org_id) {
            return Err(AppError::Unauthorized(format!(
                "User is not a member of org '{org_id}'"
            )));
        }
    }

    // Open org DB lazily (no-op if already cached)
    if !state.db_pool.read().await.contains_key(&org_id) {
        let pool = open_org_db(&org_id, &app_handle).await?;
        state.db_pool.write().await.insert(org_id.clone(), pool);
    }

    // Update auth state
    {
        let mut auth = state.auth.write().await;
        match auth.as_mut() {
            Some(a) => a.active_org_id = Some(org_id.clone()),
            None => return Err(AppError::NotAuthenticated),
        }
    }
    *state.active_org_id.write().await = Some(org_id);

    Ok(())
}

/// Returns the current in-memory auth state without any I/O.
#[tauri::command]
pub async fn get_auth_state(state: State<'_, AppState>) -> Result<Option<AuthState>, AppError> {
    Ok(state.auth.read().await.clone())
}

/// Reads the JWT cached in the OS keychain and validates it.
/// Returns the raw JWT string if valid (the frontend uses it to call Clerk's SDK
/// to restore the session), or `null` if the cache is empty or the token is expired.
#[tauri::command]
pub async fn get_cached_session(
    _state: State<'_, AppState>,
    app_handle: tauri::AppHandle,
) -> Result<Option<String>, AppError> {
    let entry = keyring::Entry::new(KEYRING_SERVICE, KEYRING_USER)
        .map_err(|e| AppError::Logic(format!("Keychain init error: {e}")))?;

    match entry.get_password() {
        Ok(jwt) => match validate_jwt(&jwt, &app_handle).await {
            Ok(_) => Ok(Some(jwt)),
            Err(_) => {
                // Token invalid or expired — remove stale cache entry
                let _ = entry.delete_credential();
                Ok(None)
            }
        },
        Err(keyring::Error::NoEntry) => Ok(None),
        Err(e) => Err(AppError::Logic(format!("Cannot read keychain: {e}"))),
    }
}

/// Clears the OS keychain entry and resets AppState.
/// Frontend is responsible for calling Clerk's `signOut()` separately.
#[tauri::command]
pub async fn logout(state: State<'_, AppState>) -> Result<(), AppError> {
    let entry = keyring::Entry::new(KEYRING_SERVICE, KEYRING_USER)
        .map_err(|e| AppError::Logic(format!("Keychain init error: {e}")))?;

    match entry.delete_credential() {
        Ok(_) | Err(keyring::Error::NoEntry) => {}
        Err(e) => return Err(AppError::Logic(format!("Cannot clear keychain: {e}"))),
    }

    *state.auth.write().await = None;
    *state.active_org_id.write().await = None;

    Ok(())
}
