import { useEffect, useState } from "react";
import { useSearchStore } from "../../store/searchStore";

export function SearchBar() {
  const { nameQuery, setNameQuery } = useSearchStore();
  const [localValue, setLocalValue] = useState(nameQuery);

  // Sync local value when store is reset from outside (e.g. "Clear all filters")
  useEffect(() => {
    setLocalValue(nameQuery);
  }, [nameQuery]);

  // Debounce: only update the store 300ms after the user stops typing
  useEffect(() => {
    const timer = setTimeout(() => {
      setNameQuery(localValue);
    }, 300);
    return () => clearTimeout(timer);
  }, [localValue, setNameQuery]);

  return (
    <div className="relative flex items-center">
      <span className="absolute left-2 text-gray-400 text-xs pointer-events-none select-none">
        ⌕
      </span>
      <input
        type="text"
        value={localValue}
        onChange={(e) => setLocalValue(e.target.value)}
        placeholder="Search assets…"
        className="w-52 pl-6 pr-6 py-1 text-xs bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-indigo-500 transition-colors"
      />
      {localValue && (
        <button
          onClick={() => {
            setLocalValue("");
            setNameQuery("");
          }}
          className="absolute right-2 text-gray-400 hover:text-white text-xs"
          aria-label="Clear search"
        >
          ✕
        </button>
      )}
    </div>
  );
}
