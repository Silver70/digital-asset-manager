# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Vision

A **local-first desktop DAM (Digital Asset Manager)** for organizing, tagging, and searching media files (images, video, documents). Think of it as a private Brandfolder/Bynder that lives entirely on your machine with no cloud dependency for asset data.

**End goal:** A production-quality Windows desktop app where users log in once with Clerk, belong to multiple orgs (Slack/Discord model), and each org gets a fully isolated local asset library.

**Full implementation plan:** `D:/digital-asset-manager/.claude/plans/dam-implementation.md`

---

## Commands

### Development

```bash
npm run tauri dev        # Start full app (launches Vite dev server + Rust backend)
npm run dev              # Vite frontend only (no Rust backend, limited functionality)
```

### Build

```bash
npm run tauri build      # Production build (compiles Rust + bundles frontend)
npm run build            # Frontend only: tsc + vite build
```

### Rust backend

```bash
cd src-tauri && cargo build          # Build Rust crate only
cd src-tauri && cargo test           # Run Rust unit tests
cd src-tauri && cargo clippy         # Lint Rust code
```

### TypeScript / Frontend

```bash
npx tsc --noEmit        # Type-check without emitting
```

---

## Target Architecture

### Auth model

**Single Identity, Multiple Org Memberships (Slack/Discord pattern)**

- **Clerk** handles identity + org memberships via React SDK (`@clerk/clerk-react`)
- Rust validates JWTs (RS256, `jsonwebtoken` crate) — no separate server needed
- Tokens stored in Windows Credential Manager (`keyring` crate)
- `CLERK_SECRET_KEY` is never used — only the public key for JWT validation

### Org isolation

Each org gets completely isolated data:

```
%APPDATA%/digital-asset-manager/
  <org_id>/
    dam.db           # SQLite: folders, assets, tags, metadata for this org
  personal_<user_id>/
    dam.db

User-chosen storage root/
  <org_id>/
    assets/          # Actual files (UUID-named copies)
    thumbnails/      # 256x256 JPEG proxies
```

### Dual-process model

- **Frontend** (`src/`): React SPA in WebView. All communication via `invoke()` from `@tauri-apps/api/core`.
- **Backend** (`src-tauri/src/`): Rust library crate. Handles all file I/O, SQLite, JWT validation, background processing.

---

## Planned Final Folder Structure

```
DAM-app/
├── src-tauri/src/
│   ├── main.rs
│   ├── error.rs              # AppError (thiserror)
│   ├── state.rs              # AppState: auth, db_pool (per org), worker_tx
│   ├── db/
│   │   ├── init.rs           # run_migrations(), WAL setup
│   │   └── migrations/
│   │       ├── 001_initial.sql
│   │       └── 002_fts.sql
│   ├── models/               # folder.rs, asset.rs, tag.rs, metadata.rs
│   ├── commands/
│   │   ├── auth.rs           # set_session, switch_org, get_auth_state, logout
│   │   ├── settings.rs       # get/set storage_path (org-scoped)
│   │   ├── folders.rs        # CRUD + move (materialized path rewrite)
│   │   ├── assets.rs         # import (copy+enqueue), delete, move, get_detail
│   │   ├── tags.rs           # CRUD + bulk assign/remove
│   │   └── search.rs         # search_assets (FTS5 + filters, dynamic query)
│   └── worker/
│       ├── queue.rs          # WorkerJob enum, mpsc channel
│       ├── thumbnail.rs      # image crate + bundled ffmpeg.exe
│       └── metadata.rs       # kamadak-exif + ffprobe JSON
│
└── src/
    ├── types/                # folder.ts, asset.ts, tag.ts
    ├── api/                  # Tauri invoke wrappers per module
    ├── store/
    │   ├── uiStore.ts        # selectedFolderId, selectedAssetIds, viewMode
    │   └── searchStore.ts    # nameQuery, tagIds, mimeTypes, dateRange, etc.
    ├── hooks/                # useFolderTree, useAssets, useTags
    └── components/
        ├── Auth/             # LoginPage, OrgSwitcher, AuthGuard
        ├── Layout/           # AppLayout, Sidebar
        ├── FolderTree/       # FolderTree, FolderNode (recursive, context menu)
        ├── AssetGrid/        # AssetGrid (virtualized), AssetCard
        ├── AssetPreview/     # PreviewPane, MetadataPanel
        ├── TagEditor/        # TagEditor (inline chips), TagPicker (modal)
        ├── Search/           # SearchBar (debounced), FilterSidebar
        └── common/           # Breadcrumb, DropZone
```

---

## Database Schema (SQLite, per org)

6 tables + 1 FTS5 virtual table:

| Table            | Purpose                                                                             |
| ---------------- | ----------------------------------------------------------------------------------- |
| `app_settings`   | Key-value config (storage path)                                                     |
| `folders`        | `parent_id` (FK) + `path` materialized path e.g. `/3/7/15` for fast subtree queries |
| `assets`         | File record: path, size, mime, thumbnail, processing_status                         |
| `image_metadata` | 1:0..1 — width, height, DPI, color_profile                                          |
| `video_metadata` | 1:0..1 — duration, fps, codec                                                       |
| `tags`           | Global tag library (name, color)                                                    |
| `asset_tags`     | N:M junction                                                                        |
| `asset_fts`      | FTS5 virtual table (asset names), sync'd via triggers                               |

---

## Key Packages

### Rust (`src-tauri/Cargo.toml`)

```toml
sqlx = { features = ["sqlite", "runtime-tokio-native-tls", "migrate", "chrono"] }
tokio = { features = ["full"] }
image = { features = ["jpeg", "png", "webp", "tiff", "bmp", "gif"] }
kamadak-exif    # EXIF metadata (DPI, color profile)
mime_guess      # MIME detection from extension
uuid            # UUID v4 for asset filenames
jsonwebtoken    # RS256 JWT validation (Clerk)
keyring         # Windows Credential Manager for token storage
reqwest         # JWKS key refresh from Clerk
thiserror       # AppError derive
```

### Frontend (`package.json`)

```
@clerk/clerk-react      # Auth: SignIn, ClerkProvider, useOrganizationList
@tanstack/react-query   # Data fetching + cache invalidation on Tauri events
@tanstack/react-virtual # Virtualized asset grid (100k+ assets)
zustand                 # UI + search filter state
tailwindcss             # Styling
@radix-ui/*             # Headless UI primitives (dialog, checkbox, context-menu)
```

---

## Architecture Patterns

### Adding Tauri commands (IPC bridge)

1. Define `#[tauri::command]` in the appropriate `src-tauri/src/commands/*.rs` file
2. Register in `tauri::generate_handler![...]` in `lib.rs`
3. All commands receive `state: State<AppState>` — resolve active org DB via `state.active_org_id`
4. Call from frontend: `invoke("command_name", { arg })` — returns a `Promise`

### Org-aware command pattern

Every data command (folders, assets, tags, search) must:

1. Read `state.active_org_id` to know which org DB to use
2. Get the pool: `state.db_pool.read().await[&org_id]`
3. Execute query against that pool

### Background worker pattern

- Worker runs as a `tokio::spawn` task reading from `mpsc::Receiver<WorkerJob>`
- Jobs include `org_id` — worker resolves correct DB pool per job
- On completion: `UPDATE assets SET thumbnail_path, processing_status = 'complete'`
- Emits `asset:ready` Tauri event → frontend React Query invalidates

### Permissions / capabilities

`src-tauri/capabilities/default.json` — add plugin permissions here when using new Tauri plugins.

Currently active: `tauri-plugin-opener`. Add new plugins to:

1. `src-tauri/Cargo.toml`
2. `.plugin(...)` chain in `lib.rs`
3. Permission string in `capabilities/default.json`

---

## Key Configuration Files

- `src-tauri/tauri.conf.json` — app identity, window size, bundle targets, CSP
- `vite.config.ts` — Vite config (fixed port **1420**, ignores `src-tauri/` in watcher)
- `tsconfig.json` — TypeScript config
- `src-tauri/Cargo.toml` — Rust dependencies

## Documenting process

- After every execution of the phases of the plan or even a small task or bug fix record the summary inside `D:\digital-asset-manager\DAM-app\.claude\sessions`
- You should create seperate markdown files for each execution session (eq: 1201*SESSION*{name of the main goal of that task}.md)
