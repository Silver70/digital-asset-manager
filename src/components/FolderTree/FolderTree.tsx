import { useState } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { FolderNodeItem } from "./FolderNode";
import type { FolderAction } from "./FolderNode";
import type { FolderNode } from "../../types/folder";
import {
  useFolderTree,
  useCreateFolder,
  useRenameFolder,
  useDeleteFolder,
} from "../../hooks/useFolderTree";
import { useUIStore } from "../../store/uiStore";
import { extractTauriError } from "../../api/auth";

// ─── Dialog state ─────────────────────────────────────────────────────────────

type DialogMode = "create-root" | "create-sub" | "rename" | "delete" | null;

interface DialogState {
  mode: DialogMode;
  folder?: FolderNode;
}

// ─── FolderTree ───────────────────────────────────────────────────────────────

export function FolderTree() {
  const { data: tree = [], isLoading, isError } = useFolderTree();
  const createFolder = useCreateFolder();
  const renameFolder = useRenameFolder();
  const deleteFolder = useDeleteFolder();
  const { selectedFolderId, setSelectedFolder } = useUIStore();

  const [dialog, setDialog] = useState<DialogState>({ mode: null });
  const [inputName, setInputName] = useState("");
  const [dialogError, setDialogError] = useState<string | null>(null);

  function openDialog(state: DialogState, initialName = "") {
    setInputName(initialName);
    setDialogError(null);
    setDialog(state);
  }

  function closeDialog() {
    setDialog({ mode: null });
  }

  function handleAction(action: FolderAction) {
    if (action.type === "newSubfolder") {
      openDialog({ mode: "create-sub", folder: action.folder });
    } else if (action.type === "rename") {
      openDialog({ mode: "rename", folder: action.folder }, action.folder.name);
    } else {
      openDialog({ mode: "delete", folder: action.folder });
    }
  }

  async function handleConfirm() {
    setDialogError(null);
    try {
      if (dialog.mode === "create-root") {
        await createFolder.mutateAsync({ name: inputName, parentId: null });
      } else if (dialog.mode === "create-sub" && dialog.folder) {
        await createFolder.mutateAsync({
          name: inputName,
          parentId: dialog.folder.id,
        });
      } else if (dialog.mode === "rename" && dialog.folder) {
        await renameFolder.mutateAsync({ id: dialog.folder.id, name: inputName });
      } else if (dialog.mode === "delete" && dialog.folder) {
        await deleteFolder.mutateAsync(dialog.folder.id);
        if (selectedFolderId === dialog.folder.id) {
          setSelectedFolder(null);
        }
      }
      closeDialog();
    } catch (err) {
      setDialogError(extractTauriError(err));
    }
  }

  const isTextDialog =
    dialog.mode === "create-root" ||
    dialog.mode === "create-sub" ||
    dialog.mode === "rename";
  const isDeleteDialog = dialog.mode === "delete";
  const isPending =
    createFolder.isPending || renameFolder.isPending || deleteFolder.isPending;

  const dialogTitle =
    dialog.mode === "create-root"
      ? "New Folder"
      : dialog.mode === "create-sub"
        ? `New Subfolder in "${dialog.folder?.name}"`
        : dialog.mode === "rename"
          ? `Rename "${dialog.folder?.name}"`
          : `Delete "${dialog.folder?.name}"`;

  return (
    <div className="flex flex-col h-full">
      {/* Section header */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-gray-700 shrink-0">
        <span className="text-xs font-semibold uppercase tracking-wider text-gray-400">
          Folders
        </span>
        <button
          onClick={() => openDialog({ mode: "create-root" })}
          title="New root folder"
          className="w-5 h-5 flex items-center justify-center text-gray-400 hover:text-white rounded hover:bg-gray-700 transition-colors"
        >
          <span className="text-lg leading-none">+</span>
        </button>
      </div>

      {/* Tree */}
      <div className="flex-1 overflow-y-auto py-1">
        {isLoading && (
          <p className="text-xs text-gray-500 px-3 py-2">Loading…</p>
        )}
        {isError && (
          <p className="text-xs text-red-400 px-3 py-2">Failed to load folders</p>
        )}
        {!isLoading && !isError && tree.length === 0 && (
          <p className="text-xs text-gray-500 px-3 py-2 italic">
            No folders yet — click + to create one.
          </p>
        )}
        {tree.map((node) => (
          <FolderNodeItem key={node.id} node={node} onAction={handleAction} />
        ))}
      </div>

      {/* ── Folder dialog (create / rename / delete) ── */}
      <Dialog.Root
        open={dialog.mode !== null}
        onOpenChange={(open) => !open && closeDialog()}
      >
        <Dialog.Portal>
          <Dialog.Overlay className="fixed inset-0 bg-black/50 z-40" />
          <Dialog.Content className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-gray-800 border border-gray-700 rounded-xl p-6 w-80 shadow-2xl z-50 outline-none">
            <Dialog.Title className="text-sm font-semibold text-white mb-4 truncate">
              {dialogTitle}
            </Dialog.Title>

            {isTextDialog && (
              <input
                type="text"
                value={inputName}
                onChange={(e) => setInputName(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleConfirm()}
                autoFocus
                placeholder="Folder name"
                className="w-full bg-gray-900 border border-gray-600 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-500 outline-none focus:border-indigo-500 mb-4"
              />
            )}

            {isDeleteDialog && (
              <p className="text-sm text-gray-300 mb-4">
                This will permanently delete the folder and all its subfolders.
                Assets must be removed first.
              </p>
            )}

            {dialogError && (
              <p className="text-xs text-red-400 bg-red-900/20 border border-red-800 rounded px-3 py-2 mb-4 break-words">
                {dialogError}
              </p>
            )}

            <div className="flex gap-2 justify-end">
              <button
                onClick={closeDialog}
                className="px-3 py-1.5 text-sm text-gray-300 border border-gray-600 hover:bg-gray-700 rounded-lg transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirm}
                disabled={
                  isPending || (isTextDialog && inputName.trim() === "")
                }
                className={[
                  "px-3 py-1.5 text-sm text-white rounded-lg transition-colors disabled:opacity-50",
                  isDeleteDialog
                    ? "bg-red-600 hover:bg-red-500"
                    : "bg-indigo-600 hover:bg-indigo-500",
                ].join(" ")}
              >
                {isPending ? "…" : isDeleteDialog ? "Delete" : "Save"}
              </button>
            </div>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>
    </div>
  );
}
