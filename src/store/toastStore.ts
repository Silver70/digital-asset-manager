import { create } from "zustand";

export type ToastKind = "success" | "error" | "info";

interface ToastItem {
  id: string;
  message: string;
  kind: ToastKind;
}

interface ToastStore {
  toasts: ToastItem[];
  push: (message: string, kind?: ToastKind) => void;
  dismiss: (id: string) => void;
}

export const useToastStore = create<ToastStore>((set) => ({
  toasts: [],

  push: (message, kind = "info") => {
    const id = crypto.randomUUID();
    set((s) => ({ toasts: [...s.toasts, { id, message, kind }] }));
    setTimeout(
      () => set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })),
      4000,
    );
  },

  dismiss: (id) =>
    set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })),
}));
