import { convertFileSrc } from "@tauri-apps/api/core";
import { useUIStore } from "../../store/uiStore";
import { useAssetDetail } from "../../hooks/useAssets";
import { MetadataPanel } from "./MetadataPanel";
import { TagEditor } from "../TagEditor/TagEditor";

// ─── Media preview ────────────────────────────────────────────────────────────

function MediaPreview({ filePath, mimeType }: { filePath: string; mimeType: string | null }) {
  const src = convertFileSrc(filePath);
  const mime = mimeType ?? "";

  if (mime.startsWith("image/")) {
    return (
      <img
        src={src}
        alt=""
        className="w-full h-full object-contain bg-gray-950"
        draggable={false}
      />
    );
  }

  if (mime.startsWith("video/")) {
    return (
      <video
        src={src}
        controls
        className="w-full h-full bg-black"
      />
    );
  }

  // Generic file icon for unsupported types
  return (
    <div className="flex flex-col items-center justify-center w-full h-full bg-gray-950 gap-2">
      <span className="text-5xl text-gray-600">📄</span>
      <span className="text-xs text-gray-500">{mimeType ?? "Unknown type"}</span>
    </div>
  );
}

// ─── PreviewPane ──────────────────────────────────────────────────────────────

export function PreviewPane() {
  const { previewAssetId, setPreviewAsset } = useUIStore();
  const { data: detail, isLoading, isError } = useAssetDetail(previewAssetId);

  if (previewAssetId === null) return null;

  return (
    <aside className="w-72 shrink-0 border-l border-gray-700 bg-gray-900 flex flex-col overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-gray-700 shrink-0">
        <span className="text-xs font-semibold text-gray-300 truncate pr-2">
          {detail?.name ?? "Loading…"}
        </span>
        <button
          onClick={() => setPreviewAsset(null)}
          className="text-gray-400 hover:text-white text-sm shrink-0 w-5 h-5 flex items-center justify-center rounded hover:bg-gray-700 transition-colors"
          aria-label="Close preview"
        >
          ✕
        </button>
      </div>

      {/* Loading */}
      {isLoading && (
        <div className="flex-1 flex items-center justify-center">
          <div className="w-6 h-6 border-2 border-gray-600 border-t-indigo-400 rounded-full animate-spin" />
        </div>
      )}

      {/* Error */}
      {isError && (
        <div className="flex-1 flex items-center justify-center p-4">
          <p className="text-xs text-red-400 text-center">
            Failed to load asset details.
          </p>
        </div>
      )}

      {/* Content */}
      {detail && !isLoading && (
        <div className="flex-1 overflow-y-auto flex flex-col">
          {/* Thumbnail / media preview area */}
          <div className="shrink-0 h-48 w-full overflow-hidden border-b border-gray-700">
            <MediaPreview
              filePath={detail.file_path}
              mimeType={detail.mime_type}
            />
          </div>

          {/* Metadata table */}
          <MetadataPanel detail={detail} />

          {/* Tags */}
          <div className="px-3 py-2 border-t border-gray-700/50 mt-auto">
            <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-2">
              Tags
            </p>
            <TagEditor assetId={detail.id} />
          </div>
        </div>
      )}
    </aside>
  );
}
