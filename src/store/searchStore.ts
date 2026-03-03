import { create } from "zustand";

interface SearchStore {
  nameQuery: string;
  tagIds: Set<number>;
  mimeTypes: Set<string>;
  dateFrom: string | null;
  dateTo: string | null;

  setNameQuery: (q: string) => void;
  toggleTagId: (id: number) => void;
  toggleMimeType: (mime: string) => void;
  toggleMimeGroup: (mimes: string[]) => void;
  setDateFrom: (d: string | null) => void;
  setDateTo: (d: string | null) => void;
  reset: () => void;
}

export const useSearchStore = create<SearchStore>((set) => ({
  nameQuery: "",
  tagIds: new Set(),
  mimeTypes: new Set(),
  dateFrom: null,
  dateTo: null,

  setNameQuery: (q) => set({ nameQuery: q }),

  toggleTagId: (id) =>
    set((s) => {
      const next = new Set(s.tagIds);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return { tagIds: next };
    }),

  toggleMimeType: (mime) =>
    set((s) => {
      const next = new Set(s.mimeTypes);
      if (next.has(mime)) next.delete(mime);
      else next.add(mime);
      return { mimeTypes: next };
    }),

  // Adds all mimes in a group if none are checked; removes all if any are checked
  toggleMimeGroup: (mimes) =>
    set((s) => {
      const anyChecked = mimes.some((m) => s.mimeTypes.has(m));
      const next = new Set(s.mimeTypes);
      mimes.forEach((m) => {
        if (anyChecked) next.delete(m);
        else next.add(m);
      });
      return { mimeTypes: next };
    }),

  setDateFrom: (d) => set({ dateFrom: d }),
  setDateTo: (d) => set({ dateTo: d }),

  reset: () =>
    set({
      nameQuery: "",
      tagIds: new Set(),
      mimeTypes: new Set(),
      dateFrom: null,
      dateTo: null,
    }),
}));

export function isSearchActive(store: {
  nameQuery: string;
  tagIds: Set<number>;
  mimeTypes: Set<string>;
  dateFrom: string | null;
  dateTo: string | null;
}): boolean {
  return (
    store.nameQuery.trim() !== "" ||
    store.tagIds.size > 0 ||
    store.mimeTypes.size > 0 ||
    store.dateFrom !== null ||
    store.dateTo !== null
  );
}
