-- Backfill the FTS5 index for any assets that existed before migration 002 ran.
-- Safe to run even if the table is already populated: FTS5 handles duplicates internally
-- because it's a content= table and we rebuilt the index in 002.
INSERT INTO asset_fts(rowid, name) SELECT id, name FROM assets;
