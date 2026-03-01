import { create } from "zustand";

interface UIStore {
  selectedFolderId: number | null;
  selectedAssetIds: Set<number>;
  previewAssetId: number | null;
  viewMode: "grid" | "list";

  setSelectedFolder: (id: number | null) => void;
  toggleAssetSelection: (id: number) => void;
  selectAllAssets: (ids: number[]) => void;
  clearSelection: () => void;
  setPreviewAsset: (id: number | null) => void;
  setViewMode: (mode: "grid" | "list") => void;
}

export const useUIStore = create<UIStore>((set) => ({
  selectedFolderId: null,
  selectedAssetIds: new Set(),
  previewAssetId: null,
  viewMode: "grid",

  setSelectedFolder: (id) =>
    set({ selectedFolderId: id, selectedAssetIds: new Set(), previewAssetId: null }),

  toggleAssetSelection: (id) =>
    set((s) => {
      const next = new Set(s.selectedAssetIds);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return { selectedAssetIds: next };
    }),

  selectAllAssets: (ids) => set({ selectedAssetIds: new Set(ids) }),

  clearSelection: () =>
    set({ selectedAssetIds: new Set(), previewAssetId: null }),

  setPreviewAsset: (id) => set({ previewAssetId: id }),

  setViewMode: (mode) => set({ viewMode: mode }),
}));
