import { useState } from "react";
import { useClerk } from "@clerk/clerk-react";
import { open } from "@tauri-apps/plugin-dialog";
import { logout } from "../../api/auth";
import { setStoragePath } from "../../api/settings";

interface StorageSetupModalProps {
  /** Called after the user has successfully chosen and saved a storage path. */
  onComplete: () => void;
}

/**
 * First-launch dialog that prompts the user to choose a storage root directory.
 * Shown once per org — after org selection, before the main UI.
 *
 * The chosen path is persisted to the org's `app_settings` table via Rust.
 * Rust creates `<path>/<org_id>/assets/` and `<path>/<org_id>/thumbnails/`.
 */
export function StorageSetupModal({ onComplete }: StorageSetupModalProps) {
  const { signOut } = useClerk();
  const [chosenPath, setChosenPath] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleChooseFolder() {
    const result = await open({ directory: true, multiple: false });
    if (typeof result === "string") {
      setChosenPath(result);
      setError(null);
    }
  }

  async function handleConfirm() {
    if (!chosenPath) return;

    setSaving(true);
    setError(null);

    try {
      await setStoragePath(chosenPath);
      onComplete();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="flex items-center justify-center min-h-screen bg-gray-900">
      <div className="bg-gray-800 border border-gray-700 rounded-xl p-8 w-full max-w-md shadow-2xl">
        {/* Header */}
        <div className="mb-6">
          <div className="flex items-center gap-3 mb-3">
            <FolderIcon />
            <h1 className="text-xl font-semibold text-white">
              Choose Storage Location
            </h1>
          </div>
          <p className="text-gray-400 text-sm leading-relaxed">
            DAM stores your asset files locally. Choose a folder where this
            org's files will be kept. A subfolder will be created automatically.
          </p>
        </div>

        {/* Path display */}
        <div
          className={`
            rounded-lg border px-4 py-3 mb-5 min-h-[48px] flex items-center
            ${chosenPath ? "border-indigo-500 bg-gray-900" : "border-gray-600 bg-gray-900"}
          `}
        >
          {chosenPath ? (
            <span className="text-sm text-gray-200 font-mono break-all">
              {chosenPath}
            </span>
          ) : (
            <span className="text-sm text-gray-500">No folder chosen yet</span>
          )}
        </div>

        {/* Error */}
        {error && (
          <p className="text-red-400 text-sm mb-4 bg-red-900/20 border border-red-800 rounded px-3 py-2">
            {error}
          </p>
        )}

        {/* Actions */}
        <div className="flex gap-3">
          <button
            onClick={handleChooseFolder}
            disabled={saving}
            className="flex-1 px-4 py-2.5 rounded-lg border border-gray-600 text-gray-200 text-sm font-medium
                       hover:bg-gray-700 hover:border-gray-500 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Browse…
          </button>
          <button
            onClick={handleConfirm}
            disabled={!chosenPath || saving}
            className="flex-1 px-4 py-2.5 rounded-lg bg-indigo-600 text-white text-sm font-medium
                       hover:bg-indigo-500 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {saving ? "Setting up…" : "Use This Folder"}
          </button>
        </div>

        {/* Sign out */}
        <div className="mt-5 pt-4 border-t border-gray-700 text-center">
          <button
            onClick={async () => {
              await logout();
              await signOut();
            }}
            disabled={saving}
            className="text-sm text-gray-500 hover:text-gray-300 transition-colors disabled:opacity-50"
          >
            Sign out
          </button>
        </div>
      </div>
    </div>
  );
}

function FolderIcon() {
  return (
    <svg
      className="w-6 h-6 text-indigo-400 flex-shrink-0"
      fill="none"
      stroke="currentColor"
      viewBox="0 0 24 24"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M3 7a2 2 0 012-2h4l2 2h8a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2V7z"
      />
    </svg>
  );
}
