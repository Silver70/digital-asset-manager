import { useSearchStore, isSearchActive } from "../../store/searchStore";
import { useSearchAssets } from "../../hooks/useSearch";
import { AssetCard } from "../AssetGrid/AssetCard";

export function SearchResults() {
  const { nameQuery, tagIds, mimeTypes, dateFrom, dateTo, reset } =
    useSearchStore();

  const params = {
    query: nameQuery,
    tagIds: Array.from(tagIds),
    mimeTypes: Array.from(mimeTypes),
    dateFrom,
    dateTo,
    folderId: null,
  };

  const active = isSearchActive({ nameQuery, tagIds, mimeTypes, dateFrom, dateTo });
  const { data: assets = [], isLoading } = useSearchAssets(params, active);

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-2 border-b border-gray-700 shrink-0 bg-gray-900">
        <span className="text-xs text-gray-400">
          Search results
          {!isLoading && (
            <span className="ml-1 text-gray-500">
              — {assets.length} {assets.length === 1 ? "file" : "files"}
            </span>
          )}
        </span>
        <button
          onClick={reset}
          className="text-xs text-indigo-400 hover:text-indigo-300 transition-colors"
        >
          Clear filters
        </button>
      </div>

      {/* Results */}
      <div className="flex-1 overflow-auto p-3">
        {isLoading && (
          <p className="text-xs text-gray-500 text-center py-8">Searching…</p>
        )}

        {!isLoading && assets.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full text-center py-16">
            <p className="text-4xl mb-3">🔍</p>
            <p className="text-gray-400 text-sm">No assets match your search.</p>
            <p className="text-gray-500 text-xs mt-2">
              Try different keywords or adjust the filters.
            </p>
          </div>
        )}

        {!isLoading && assets.length > 0 && (
          <div
            className="grid gap-2"
            style={{ gridTemplateColumns: "repeat(auto-fill, minmax(160px, 1fr))" }}
          >
            {assets.map((asset) => (
              <AssetCard key={asset.id} asset={asset} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
