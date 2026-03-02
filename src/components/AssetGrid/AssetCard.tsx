import { convertFileSrc } from "@tauri-apps/api/core";
import type { Asset } from "../../types/asset";
import { useUIStore } from "../../store/uiStore";
import { TagEditor } from "../TagEditor/TagEditor";

interface AssetCardProps {
  asset: Asset;
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function StatusBadge({ status }: { status: Asset["processing_status"] }) {
  if (status === "complete") return null;

  const label =
    status === "pending"
      ? "Pending"
      : status === "processing"
        ? "Processing…"
        : "Failed";

  const color =
    status === "failed"
      ? "bg-red-600/80 text-red-100"
      : "bg-gray-700/80 text-gray-300";

  return (
    <span
      className={`absolute top-1 right-1 text-[10px] px-1.5 py-0.5 rounded ${color}`}
    >
      {label}
    </span>
  );
}

export function AssetCard({ asset }: AssetCardProps) {
  const { selectedAssetIds, toggleAssetSelection, setPreviewAsset } =
    useUIStore();
  const isSelected = selectedAssetIds.has(asset.id);

  const thumbnailSrc =
    asset.thumbnail_path && asset.processing_status === "complete"
      ? convertFileSrc(asset.thumbnail_path)
      : null;

  function handleClick(e: React.MouseEvent) {
    if (e.ctrlKey || e.metaKey) {
      toggleAssetSelection(asset.id);
    } else if (e.detail === 2) {
      // double-click → preview
      setPreviewAsset(asset.id);
    } else {
      toggleAssetSelection(asset.id);
    }
  }

  return (
    <div
      onClick={handleClick}
      className={[
        "group relative flex flex-col rounded-lg overflow-hidden cursor-pointer border transition-all",
        isSelected
          ? "border-indigo-500 ring-1 ring-indigo-500"
          : "border-gray-700 hover:border-gray-500",
        "bg-gray-800",
      ].join(" ")}
    >
      {/* Thumbnail area */}
      <div className="relative w-full aspect-[4/3] bg-gray-900 flex items-center justify-center overflow-hidden">
        {thumbnailSrc ? (
          <img
            src={thumbnailSrc}
            alt={asset.name}
            className="w-full h-full object-cover"
          />
        ) : (
          <div className="flex flex-col items-center gap-1 text-gray-600">
            {asset.processing_status === "failed" ? (
              <span className="text-2xl">⚠️</span>
            ) : (
              <>
                <div className="w-6 h-6 border-2 border-gray-600 border-t-indigo-400 rounded-full animate-spin" />
              </>
            )}
          </div>
        )}
        <StatusBadge status={asset.processing_status} />
        {isSelected && (
          <div className="absolute inset-0 bg-indigo-500/20 pointer-events-none" />
        )}
      </div>

      {/* Name + size + tags */}
      <div className="px-2 py-1.5">
        <p className="text-xs text-white truncate" title={asset.name}>
          {asset.name}
        </p>
        <p className="text-[10px] text-gray-500 mt-0.5">
          {formatBytes(asset.file_size)}
        </p>
        <div className="mt-1">
          <TagEditor assetId={asset.id} />
        </div>
      </div>
    </div>
  );
}
