-- ─────────────────────────────────────────────────────────────
-- App Settings (key-value store)
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS app_settings (
    key        TEXT PRIMARY KEY,
    value      TEXT NOT NULL,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Seed default storage path (empty = unset until user chooses)
INSERT OR IGNORE INTO app_settings (key, value) VALUES ('storage_path', '');

-- ─────────────────────────────────────────────────────────────
-- Folders (Adjacency List + Materialized Path hybrid)
--
-- path: slash-delimited string of ancestor IDs, e.g. "/3/7/15"
--       Enables: SELECT * FROM folders WHERE path LIKE '/3/7/%'
--       Root folders have path = '/<own_id>'
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS folders (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    name       TEXT    NOT NULL,
    parent_id  INTEGER REFERENCES folders(id) ON DELETE CASCADE,
    path       TEXT    NOT NULL UNIQUE,
    depth      INTEGER NOT NULL DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_folders_parent_id ON folders(parent_id);
CREATE INDEX IF NOT EXISTS idx_folders_path      ON folders(path);

-- ─────────────────────────────────────────────────────────────
-- Assets
--
-- processing_status: pending | processing | complete | failed
-- file_path: absolute path to the copied file inside the storage dir
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS assets (
    id                INTEGER  PRIMARY KEY AUTOINCREMENT,
    name              TEXT     NOT NULL,
    folder_id         INTEGER  NOT NULL REFERENCES folders(id) ON DELETE RESTRICT,
    file_path         TEXT     NOT NULL UNIQUE,
    file_size         INTEGER  NOT NULL,
    mime_type         TEXT,
    extension         TEXT     NOT NULL,
    thumbnail_path    TEXT,
    processing_status TEXT     NOT NULL DEFAULT 'pending',
    creator           TEXT,
    upload_date       DATETIME DEFAULT CURRENT_TIMESTAMP,
    created_at        DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at        DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_assets_folder_id   ON assets(folder_id);
CREATE INDEX IF NOT EXISTS idx_assets_name        ON assets(name COLLATE NOCASE);
CREATE INDEX IF NOT EXISTS idx_assets_mime_type   ON assets(mime_type);
CREATE INDEX IF NOT EXISTS idx_assets_upload_date ON assets(upload_date);
CREATE INDEX IF NOT EXISTS idx_assets_file_size   ON assets(file_size);
CREATE INDEX IF NOT EXISTS idx_assets_extension   ON assets(extension);
CREATE INDEX IF NOT EXISTS idx_assets_status      ON assets(processing_status);

-- ─────────────────────────────────────────────────────────────
-- Image-specific metadata (1:0..1 with assets)
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS image_metadata (
    asset_id      INTEGER PRIMARY KEY REFERENCES assets(id) ON DELETE CASCADE,
    width         INTEGER,
    height        INTEGER,
    color_profile TEXT,
    dpi           REAL,
    has_alpha     INTEGER NOT NULL DEFAULT 0
);

-- ─────────────────────────────────────────────────────────────
-- Video-specific metadata (1:0..1 with assets)
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS video_metadata (
    asset_id    INTEGER PRIMARY KEY REFERENCES assets(id) ON DELETE CASCADE,
    width       INTEGER,
    height      INTEGER,
    duration    REAL,
    frame_rate  REAL,
    codec       TEXT,
    audio_codec TEXT,
    bit_rate    INTEGER
);

-- ─────────────────────────────────────────────────────────────
-- Global Tag Library
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS tags (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    name       TEXT    NOT NULL UNIQUE COLLATE NOCASE,
    color      TEXT    NOT NULL DEFAULT '#6366f1',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_tags_name ON tags(name COLLATE NOCASE);

-- ─────────────────────────────────────────────────────────────
-- Asset <-> Tag  (many-to-many junction)
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS asset_tags (
    asset_id   INTEGER NOT NULL REFERENCES assets(id) ON DELETE CASCADE,
    tag_id     INTEGER NOT NULL REFERENCES tags(id)   ON DELETE CASCADE,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (asset_id, tag_id)
);

CREATE INDEX IF NOT EXISTS idx_asset_tags_tag_id   ON asset_tags(tag_id);
CREATE INDEX IF NOT EXISTS idx_asset_tags_asset_id ON asset_tags(asset_id);
