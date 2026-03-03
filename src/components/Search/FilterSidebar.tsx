import { useAllTags } from "../../hooks/useTags";
import { useSearchStore, isSearchActive } from "../../store/searchStore";

// ─── MIME type groups ─────────────────────────────────────────────────────────

const MIME_GROUPS = [
  {
    label: "Images",
    mimes: [
      "image/jpeg",
      "image/png",
      "image/gif",
      "image/webp",
      "image/bmp",
      "image/tiff",
      "image/svg+xml",
    ],
  },
  {
    label: "Videos",
    mimes: [
      "video/mp4",
      "video/quicktime",
      "video/x-msvideo",
      "video/webm",
      "video/x-matroska",
    ],
  },
  {
    label: "Documents",
    mimes: ["application/pdf", "application/postscript"],
  },
] as const;

// ─── FilterSidebar ────────────────────────────────────────────────────────────

export function FilterSidebar() {
  const { data: tags = [] } = useAllTags();
  const {
    nameQuery,
    tagIds,
    mimeTypes,
    dateFrom,
    dateTo,
    toggleTagId,
    toggleMimeGroup,
    setDateFrom,
    setDateTo,
    reset,
  } = useSearchStore();

  const active = isSearchActive({ nameQuery, tagIds, mimeTypes, dateFrom, dateTo });

  return (
    <div className="shrink-0 border-t border-gray-700 overflow-y-auto max-h-72">
      <div className="px-3 py-2 space-y-3">
        {/* Section header */}
        <div className="flex items-center justify-between">
          <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider">
            Filters
          </span>
          {active && (
            <button
              onClick={reset}
              className="text-xs text-indigo-400 hover:text-indigo-300 transition-colors"
            >
              Clear
            </button>
          )}
        </div>

        {/* ── Tags ── */}
        {tags.length > 0 && (
          <div>
            <p className="text-xs text-gray-500 mb-1">Tags</p>
            <div className="space-y-0.5 max-h-28 overflow-y-auto">
              {tags.map((tag) => (
                <label
                  key={tag.id}
                  className="flex items-center gap-2 cursor-pointer group py-0.5"
                >
                  <input
                    type="checkbox"
                    checked={tagIds.has(tag.id)}
                    onChange={() => toggleTagId(tag.id)}
                    className="rounded accent-indigo-500"
                  />
                  <span
                    className="inline-block w-2 h-2 rounded-full shrink-0"
                    style={{ backgroundColor: tag.color }}
                  />
                  <span className="text-xs text-gray-300 group-hover:text-white truncate">
                    {tag.name}
                  </span>
                </label>
              ))}
            </div>
          </div>
        )}

        {/* ── File type ── */}
        <div>
          <p className="text-xs text-gray-500 mb-1">Type</p>
          <div className="space-y-0.5">
            {MIME_GROUPS.map((group) => {
              const anyChecked = group.mimes.some((m) => mimeTypes.has(m));
              return (
                <label
                  key={group.label}
                  className="flex items-center gap-2 cursor-pointer group py-0.5"
                >
                  <input
                    type="checkbox"
                    checked={anyChecked}
                    onChange={() => toggleMimeGroup([...group.mimes])}
                    className="rounded accent-indigo-500"
                  />
                  <span className="text-xs text-gray-300 group-hover:text-white">
                    {group.label}
                  </span>
                </label>
              );
            })}
          </div>
        </div>

        {/* ── Date range ── */}
        <div>
          <p className="text-xs text-gray-500 mb-1">Uploaded</p>
          <div className="space-y-1">
            <div>
              <label className="block text-xs text-gray-500 mb-0.5">From</label>
              <input
                type="date"
                value={dateFrom ?? ""}
                onChange={(e) => setDateFrom(e.target.value || null)}
                className="w-full px-2 py-1 text-xs bg-gray-800 border border-gray-700 rounded text-white focus:outline-none focus:border-indigo-500"
              />
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-0.5">To</label>
              <input
                type="date"
                value={dateTo ?? ""}
                onChange={(e) => setDateTo(e.target.value || null)}
                className="w-full px-2 py-1 text-xs bg-gray-800 border border-gray-700 rounded text-white focus:outline-none focus:border-indigo-500"
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
