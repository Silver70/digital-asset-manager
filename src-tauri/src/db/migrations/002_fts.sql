-- FTS5 virtual table backed by assets.name
CREATE VIRTUAL TABLE IF NOT EXISTS asset_fts USING fts5(
    name,
    content    = 'assets',
    content_rowid = 'id',
    tokenize   = 'unicode61'
);

-- Keep FTS index in sync with the assets table
CREATE TRIGGER IF NOT EXISTS assets_ai AFTER INSERT ON assets BEGIN
    INSERT INTO asset_fts(rowid, name) VALUES (new.id, new.name);
END;

CREATE TRIGGER IF NOT EXISTS assets_ad AFTER DELETE ON assets BEGIN
    INSERT INTO asset_fts(asset_fts, rowid, name)
    VALUES ('delete', old.id, old.name);
END;

CREATE TRIGGER IF NOT EXISTS assets_au AFTER UPDATE OF name ON assets BEGIN
    INSERT INTO asset_fts(asset_fts, rowid, name)
    VALUES ('delete', old.id, old.name);
    INSERT INTO asset_fts(rowid, name) VALUES (new.id, new.name);
END;
