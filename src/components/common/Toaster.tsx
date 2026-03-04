import { useToastStore } from "../../store/toastStore";

const kindClass: Record<string, string> = {
  error: "bg-red-900 border-red-700 text-red-100",
  success: "bg-green-900 border-green-700 text-green-100",
  info: "bg-gray-800 border-gray-700 text-gray-100",
};

export function Toaster() {
  const { toasts, dismiss } = useToastStore();

  if (toasts.length === 0) return null;

  return (
    <div className="fixed bottom-4 right-4 z-50 flex flex-col gap-2 pointer-events-none">
      {toasts.map((t) => (
        <div
          key={t.id}
          className={`flex items-center gap-2 px-4 py-3 rounded-lg shadow-lg text-sm border pointer-events-auto max-w-xs ${kindClass[t.kind]}`}
        >
          <span className="flex-1">{t.message}</span>
          <button
            onClick={() => dismiss(t.id)}
            className="opacity-60 hover:opacity-100 transition-opacity shrink-0"
          >
            ✕
          </button>
        </div>
      ))}
    </div>
  );
}
