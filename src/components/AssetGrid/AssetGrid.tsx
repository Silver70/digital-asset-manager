import { useRef, useState, useEffect } from "react";
import { useVirtualizer } from "@tanstack/react-virtual";
import { open as openDialog } from "@tauri-apps/plugin-dialog";
import { listen } from "@tauri-apps/api/event";
import { AssetCard } from "./AssetCard";
import {
  useAssets,
  useImportAssets,
  useDeleteAssets,
} from "../../hooks/useAssets";
import { useUIStore } from "../../store/uiStore";
import { extractTauriError } from "../../api/auth";

const CARD_MIN_WIDTH = 160;
const CARD_HEIGHT = 190; // thumbnail + label area
const GAP = 10;

interface AssetGridProps {
  folderId: number;
}

export function AssetGrid({ folderId }: AssetGridProps) {
  const { data: assets = [], isLoading, isError } = useAssets(folderId);
  const importAssets = useImportAssets();
  const deleteAssets = useDeleteAssets();
  const { selectedAssetIds, clearSelection, selectAllAssets } = useUIStore();

  const [importError, setImportError] = useState<string | null>(null);
  const [isDragOver, setIsDragOver] = useState(false);

  const parentRef = useRef<HTMLDivElement>(null);
  const [cols, setCols] = useState(4);

  // Recalculate columns when container resizes
  useEffect(() => {
    const el = parentRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => {
      const w = el.clientWidth;
      setCols(Math.max(1, Math.floor((w + GAP) / (CARD_MIN_WIDTH + GAP))));
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const rowCount = Math.ceil(assets.length / cols);

  const rowVirtualizer = useVirtualizer({
    count: rowCount,
    getScrollElement: () => parentRef.current,
    estimateSize: () => CARD_HEIGHT + GAP,
    overscan: 3,
  });

  // ── Import via file dialog ────────────────────────────────────────────────

  async function handleImport() {
    setImportError(null);
    try {
      const result = await openDialog({
        multiple: true,
        filters: [
          {
            name: "Media Files",
            extensions: [
              "jpg",
              "jpeg",
              "png",
              "gif",
              "webp",
              "bmp",
              "tiff",
              "svg",
              "mp4",
              "mov",
              "avi",
              "mkv",
              "webm",
              "pdf",
              "psd",
              "ai",
              "eps",
            ],
          },
          { name: "All Files", extensions: ["*"] },
        ],
      });

      if (!result) return;
      const paths = Array.isArray(result) ? result : [result];
      if (paths.length === 0) return;

      await importAssets.mutateAsync({ filePaths: paths, folderId });
    } catch (err) {
      setImportError(extractTauriError(err));
    }
  }

  // ── Tauri native drag-and-drop ────────────────────────────────────────────
  // The browser File API never exposes .path in WebView2.
  // Tauri fires window-level events with actual FS paths instead.

  // Stable refs so the event listener registered once always sees the latest values.
  const folderIdRef = useRef(folderId);
  useEffect(() => {
    folderIdRef.current = folderId;
  }, [folderId]);

  const importAssetsRef = useRef(importAssets);
  useEffect(() => {
    importAssetsRef.current = importAssets;
  }, [importAssets]);

  useEffect(() => {
    const unlistenPromises = [
      listen("tauri://drag-enter", () => setIsDragOver(true)),
      listen("tauri://drag-leave", () => setIsDragOver(false)),
      listen<{ paths: string[] }>("tauri://drag-drop", async (event) => {
        setIsDragOver(false);
        const paths = event.payload.paths ?? [];
        if (paths.length === 0) return;
        setImportError(null);
        try {
          await importAssetsRef.current.mutateAsync({
            filePaths: paths,
            folderId: folderIdRef.current,
          });
        } catch (err) {
          setImportError(extractTauriError(err));
        }
      }),
    ];
    return () => {
      unlistenPromises.forEach((p) => p.then((f) => f()));
    };
  }, []); // register once on mount, refs handle changing values

  // ── Selection actions ─────────────────────────────────────────────────────

  async function handleDelete() {
    const ids = Array.from(selectedAssetIds);
    try {
      await deleteAssets.mutateAsync(ids);
      clearSelection();
    } catch (err) {
      setImportError(extractTauriError(err));
    }
  }

  function handleSelectAll() {
    selectAllAssets(assets.map((a) => a.id));
  }

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="flex flex-col h-full">
      {/* Toolbar */}
      <div className="flex items-center gap-2 px-4 py-2 border-b border-gray-700 shrink-0 bg-gray-900">
        <button
          onClick={handleImport}
          disabled={importAssets.isPending}
          className="px-3 py-1 text-xs bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white rounded-lg transition-colors"
        >
          {importAssets.isPending ? "Importing…" : "Import Files"}
        </button>

        {selectedAssetIds.size > 0 && (
          <>
            <span className="text-xs text-gray-400 ml-1">
              {selectedAssetIds.size} selected
            </span>
            <button
              onClick={handleDelete}
              disabled={deleteAssets.isPending}
              className="px-3 py-1 text-xs bg-red-700 hover:bg-red-600 disabled:opacity-50 text-white rounded-lg transition-colors"
            >
              Delete
            </button>
            <button
              onClick={clearSelection}
              className="px-3 py-1 text-xs text-gray-400 hover:text-white border border-gray-600 hover:border-gray-500 rounded-lg transition-colors"
            >
              Deselect
            </button>
          </>
        )}

        {assets.length > 0 && selectedAssetIds.size === 0 && (
          <button
            onClick={handleSelectAll}
            className="px-3 py-1 text-xs text-gray-400 hover:text-white transition-colors"
          >
            Select All
          </button>
        )}

        <span className="ml-auto text-xs text-gray-500">
          {assets.length} {assets.length === 1 ? "file" : "files"}
        </span>
      </div>

      {/* Error banner */}
      {importError && (
        <div className="px-4 py-2 text-xs text-red-300 bg-red-900/30 border-b border-red-800 shrink-0">
          {importError}
          <button
            onClick={() => setImportError(null)}
            className="ml-2 text-red-400 hover:text-red-200"
          >
            ✕
          </button>
        </div>
      )}

      {/* Grid */}
      <div
        ref={parentRef}
        className={[
          "flex-1 overflow-auto p-3 relative",
          isDragOver ? "bg-indigo-900/20" : "",
        ].join(" ")}
        onDragOver={(e) => e.preventDefault()}
      >
        {/* Drop overlay */}
        {isDragOver && (
          <div className="absolute inset-0 border-2 border-dashed border-indigo-500 rounded-lg pointer-events-none z-10 flex items-center justify-center">
            <p className="text-indigo-300 text-sm font-medium">
              Drop to import
            </p>
          </div>
        )}

        {/* States */}
        {isLoading && (
          <p className="text-xs text-gray-500 text-center py-8">Loading…</p>
        )}
        {isError && (
          <p className="text-xs text-red-400 text-center py-8">
            Failed to load assets
          </p>
        )}
        {!isLoading && !isError && assets.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full text-center py-16">
            <p className="text-4xl mb-3">📂</p>
            <p className="text-gray-400 text-sm">
              Drag files here or click{" "}
              <button
                onClick={handleImport}
                className="text-indigo-400 hover:text-indigo-300 underline"
              >
                Import Files
              </button>
            </p>
          </div>
        )}

        {/* Virtual rows */}
        {!isLoading && assets.length > 0 && (
          <div
            style={{
              height: rowVirtualizer.getTotalSize(),
              position: "relative",
            }}
          >
            {rowVirtualizer.getVirtualItems().map((vRow) => {
              const startIdx = vRow.index * cols;
              const rowAssets = assets.slice(startIdx, startIdx + cols);

              return (
                <div
                  key={vRow.key}
                  style={{
                    position: "absolute",
                    top: vRow.start,
                    left: 0,
                    right: 0,
                    height: CARD_HEIGHT,
                    display: "grid",
                    gridTemplateColumns: `repeat(${cols}, 1fr)`,
                    gap: GAP,
                  }}
                >
                  {rowAssets.map((asset) => (
                    <AssetCard key={asset.id} asset={asset} />
                  ))}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
