import * as Dialog from "@radix-ui/react-dialog";

interface ConfirmDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description: string;
  confirmLabel?: string;
  destructive?: boolean;
  onConfirm: () => void;
}

export function ConfirmDialog({
  open,
  onOpenChange,
  title,
  description,
  confirmLabel = "Confirm",
  destructive = false,
  onConfirm,
}: ConfirmDialogProps) {
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 bg-black/60 z-40" />
        <Dialog.Content className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="bg-gray-800 border border-gray-700 rounded-xl p-6 w-full max-w-sm shadow-2xl">
            <Dialog.Title className="text-base font-semibold text-white mb-2">
              {title}
            </Dialog.Title>
            <Dialog.Description className="text-sm text-gray-400 mb-6">
              {description}
            </Dialog.Description>
            <div className="flex gap-3 justify-end">
              <Dialog.Close asChild>
                <button className="px-4 py-2 text-sm border border-gray-600 hover:bg-gray-700 text-gray-300 rounded-lg transition-colors">
                  Cancel
                </button>
              </Dialog.Close>
              <button
                onClick={() => {
                  onConfirm();
                  onOpenChange(false);
                }}
                className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
                  destructive
                    ? "bg-red-700 hover:bg-red-600 text-white"
                    : "bg-indigo-600 hover:bg-indigo-500 text-white"
                }`}
              >
                {confirmLabel}
              </button>
            </div>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
