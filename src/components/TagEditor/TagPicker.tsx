import { useState } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import type { Tag } from "../../types/tag";
import {
  useAllTags,
  useCreateTag,
  useAssignTags,
  useRemoveTags,
} from "../../hooks/useTags";
import { extractTauriError } from "../../api/auth";

// Palette of preset colors for new tags
const COLOR_PRESETS = [
  "#6366f1", // indigo
  "#8b5cf6", // violet
  "#ec4899", // pink
  "#ef4444", // red
  "#f97316", // orange
  "#eab308", // yellow
  "#22c55e", // green
  "#14b8a6", // teal
  "#3b82f6", // blue
  "#64748b", // slate
];

interface TagPickerProps {
  /** Asset IDs being tagged (1 for single-asset, N for bulk). */
  assetIds: number[];
  /** Tags already assigned to the first (or only) asset — used for initial checked state. */
  initialAssignedTags: Tag[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function TagPicker({
  assetIds,
  initialAssignedTags,
  open,
  onOpenChange,
}: TagPickerProps) {
  const { data: allTags = [] } = useAllTags();
  const createTag = useCreateTag();
  const assignTags = useAssignTags();
  const removeTags = useRemoveTags();

  // Track which tags are toggled in this session
  const [added, setAdded] = useState<Set<number>>(new Set());
  const [removed, setRemoved] = useState<Set<number>>(new Set());

  const [search, setSearch] = useState("");
  const [newName, setNewName] = useState("");
  const [newColor, setNewColor] = useState(COLOR_PRESETS[0]);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const initialIds = new Set(initialAssignedTags.map((t) => t.id));

  function isChecked(tagId: number): boolean {
    if (added.has(tagId)) return true;
    if (removed.has(tagId)) return false;
    return initialIds.has(tagId);
  }

  function toggleTag(tagId: number) {
    setAdded((prev) => {
      const next = new Set(prev);
      next.delete(tagId);
      return next;
    });
    setRemoved((prev) => {
      const next = new Set(prev);
      next.delete(tagId);
      return next;
    });

    if (isChecked(tagId)) {
      // currently on → remove
      setRemoved((prev) => new Set([...prev, tagId]));
    } else {
      // currently off → add
      setAdded((prev) => new Set([...prev, tagId]));
    }
  }

  async function handleCreateTag() {
    const trimmed = newName.trim();
    if (!trimmed) return;
    setError(null);
    try {
      const tag = await createTag.mutateAsync({ name: trimmed, color: newColor });
      // Auto-check the new tag
      setAdded((prev) => new Set([...prev, tag.id]));
      setNewName("");
    } catch (err) {
      setError(extractTauriError(err));
    }
  }

  async function handleSave() {
    setSaving(true);
    setError(null);
    try {
      const toAdd = Array.from(added);
      const toRemove = Array.from(removed);
      if (toAdd.length > 0) {
        await assignTags.mutateAsync({ assetIds, tagIds: toAdd });
      }
      if (toRemove.length > 0) {
        await removeTags.mutateAsync({ assetIds, tagIds: toRemove });
      }
      onOpenChange(false);
    } catch (err) {
      setError(extractTauriError(err));
    } finally {
      setSaving(false);
    }
  }

  function handleClose(open: boolean) {
    if (!open) {
      setAdded(new Set());
      setRemoved(new Set());
      setSearch("");
      setNewName("");
      setError(null);
    }
    onOpenChange(open);
  }

  const filtered = allTags.filter((t) =>
    t.name.toLowerCase().includes(search.toLowerCase()),
  );

  return (
    <Dialog.Root open={open} onOpenChange={handleClose}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 bg-black/60 z-40" />
        <Dialog.Content className="fixed z-50 top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-80 bg-gray-900 border border-gray-700 rounded-xl shadow-2xl flex flex-col max-h-[80vh]">
          <div className="px-4 pt-4 pb-2 shrink-0">
            <Dialog.Title className="text-sm font-semibold text-white mb-3">
              {assetIds.length > 1
                ? `Tag ${assetIds.length} assets`
                : "Edit tags"}
            </Dialog.Title>

            {/* Search existing tags */}
            <input
              type="text"
              placeholder="Search tags…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full bg-gray-800 border border-gray-600 rounded-lg px-3 py-1.5 text-xs text-white placeholder-gray-500 focus:outline-none focus:border-indigo-500"
            />
          </div>

          {/* Tag list */}
          <div className="flex-1 overflow-y-auto px-4 py-1 min-h-0">
            {filtered.length === 0 && (
              <p className="text-xs text-gray-500 text-center py-4">
                No tags found
              </p>
            )}
            {filtered.map((tag) => (
              <label
                key={tag.id}
                className="flex items-center gap-2 py-1.5 cursor-pointer group"
              >
                <input
                  type="checkbox"
                  checked={isChecked(tag.id)}
                  onChange={() => toggleTag(tag.id)}
                  className="sr-only"
                />
                <span
                  className={[
                    "w-4 h-4 rounded border-2 flex items-center justify-center shrink-0 transition-colors",
                    isChecked(tag.id)
                      ? "border-transparent"
                      : "border-gray-600 bg-transparent",
                  ].join(" ")}
                  style={
                    isChecked(tag.id) ? { backgroundColor: tag.color } : {}
                  }
                >
                  {isChecked(tag.id) && (
                    <svg
                      className="w-2.5 h-2.5 text-white"
                      viewBox="0 0 10 10"
                      fill="none"
                    >
                      <path
                        d="M1.5 5l2.5 2.5L8.5 2.5"
                        stroke="currentColor"
                        strokeWidth="1.5"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </svg>
                  )}
                </span>
                <span
                  className="inline-block w-2.5 h-2.5 rounded-full shrink-0"
                  style={{ backgroundColor: tag.color }}
                />
                <span className="text-xs text-gray-200 truncate flex-1">
                  {tag.name}
                </span>
              </label>
            ))}
          </div>

          {/* Create new tag */}
          <div className="px-4 py-3 border-t border-gray-700 shrink-0">
            <p className="text-[10px] text-gray-500 mb-2 uppercase tracking-wide">
              New tag
            </p>
            <div className="flex gap-2 items-center">
              <input
                type="text"
                placeholder="Tag name"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleCreateTag()}
                className="flex-1 min-w-0 bg-gray-800 border border-gray-600 rounded-lg px-2 py-1 text-xs text-white placeholder-gray-500 focus:outline-none focus:border-indigo-500"
              />
              {/* Color swatches */}
              <div className="flex gap-1">
                {COLOR_PRESETS.slice(0, 5).map((c) => (
                  <button
                    key={c}
                    title={c}
                    onClick={() => setNewColor(c)}
                    className={[
                      "w-4 h-4 rounded-full border transition-transform",
                      newColor === c
                        ? "border-white scale-125"
                        : "border-transparent",
                    ].join(" ")}
                    style={{ backgroundColor: c }}
                  />
                ))}
              </div>
              <button
                onClick={handleCreateTag}
                disabled={!newName.trim() || createTag.isPending}
                className="px-2 py-1 text-xs bg-gray-700 hover:bg-gray-600 disabled:opacity-40 text-white rounded-lg transition-colors"
              >
                Add
              </button>
            </div>
          </div>

          {/* Error */}
          {error && (
            <p className="px-4 py-1.5 text-xs text-red-400 bg-red-900/20 border-t border-red-800 shrink-0">
              {error}
            </p>
          )}

          {/* Footer actions */}
          <div className="px-4 py-3 border-t border-gray-700 flex justify-end gap-2 shrink-0">
            <Dialog.Close asChild>
              <button className="px-3 py-1 text-xs text-gray-400 hover:text-white border border-gray-600 hover:border-gray-500 rounded-lg transition-colors">
                Cancel
              </button>
            </Dialog.Close>
            <button
              onClick={handleSave}
              disabled={saving || (added.size === 0 && removed.size === 0)}
              className="px-3 py-1 text-xs bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 text-white rounded-lg transition-colors"
            >
              {saving ? "Saving…" : "Save"}
            </button>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
