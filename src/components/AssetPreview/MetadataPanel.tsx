import type { AssetDetail } from "../../types/metadata";

// ─── Formatters ───────────────────────────────────────────────────────────────

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}

function formatDuration(secs: number): string {
  const h = Math.floor(secs / 3600);
  const m = Math.floor((secs % 3600) / 60);
  const s = Math.floor(secs % 60);
  if (h > 0)
    return `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  return `${m}:${String(s).padStart(2, "0")}`;
}

function formatFps(fps: number): string {
  return `${fps.toFixed(2)} fps`;
}

function formatBitrate(bps: number): string {
  if (bps < 1_000) return `${bps} bps`;
  if (bps < 1_000_000) return `${(bps / 1_000).toFixed(0)} kbps`;
  return `${(bps / 1_000_000).toFixed(1)} Mbps`;
}

// ─── Row ─────────────────────────────────────────────────────────────────────

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  if (value === null || value === undefined || value === "") return null;
  return (
    <tr className="border-b border-gray-700/50">
      <td className="py-1 pr-3 text-[11px] text-gray-500 whitespace-nowrap align-top w-[100px]">
        {label}
      </td>
      <td className="py-1 text-[11px] text-gray-200 break-all">{value}</td>
    </tr>
  );
}

// ─── MetadataPanel ────────────────────────────────────────────────────────────

interface MetadataPanelProps {
  detail: AssetDetail;
}

export function MetadataPanel({ detail }: MetadataPanelProps) {
  const { image_metadata: img, video_metadata: vid } = detail;

  return (
    <div className="px-3 py-2">
      <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-2">
        Details
      </p>
      <table className="w-full border-collapse">
        <tbody>
          {/* ── Base fields ── */}
          <Row label="File" value={detail.name} />
          <Row label="Size" value={formatBytes(detail.file_size)} />
          <Row label="Type" value={detail.mime_type ?? detail.extension} />
          <Row label="Uploaded" value={detail.upload_date.replace("T", " ").split(".")[0]} />
          <Row label="Status" value={detail.processing_status} />
          {detail.creator && <Row label="Creator" value={detail.creator} />}

          {/* ── Image metadata ── */}
          {img && (
            <>
              {img.width && img.height && (
                <Row label="Dimensions" value={`${img.width} × ${img.height} px`} />
              )}
              {img.dpi && <Row label="DPI" value={img.dpi.toFixed(0)} />}
              {img.color_profile && (
                <Row label="Color" value={img.color_profile} />
              )}
              <Row label="Alpha" value={img.has_alpha ? "Yes" : "No"} />
            </>
          )}

          {/* ── Video metadata ── */}
          {vid && (
            <>
              {vid.width && vid.height && (
                <Row label="Dimensions" value={`${vid.width} × ${vid.height} px`} />
              )}
              {vid.duration !== null && vid.duration !== undefined && (
                <Row label="Duration" value={formatDuration(vid.duration)} />
              )}
              {vid.frame_rate !== null && vid.frame_rate !== undefined && (
                <Row label="Frame rate" value={formatFps(vid.frame_rate)} />
              )}
              {vid.codec && <Row label="Video codec" value={vid.codec} />}
              {vid.audio_codec && (
                <Row label="Audio codec" value={vid.audio_codec} />
              )}
              {vid.bit_rate !== null && vid.bit_rate !== undefined && (
                <Row label="Bit rate" value={formatBitrate(vid.bit_rate)} />
              )}
            </>
          )}
        </tbody>
      </table>
    </div>
  );
}
