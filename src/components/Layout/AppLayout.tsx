import { useOrganization, useClerk } from "@clerk/clerk-react";
import { logout } from "../../api/auth";
import { Sidebar } from "./Sidebar";
import { Breadcrumb } from "../common/Breadcrumb";
import { AssetGrid } from "../AssetGrid/AssetGrid";
import { SearchBar } from "../Search/SearchBar";
import { SearchResults } from "../Search/SearchResults";
import { PreviewPane } from "../AssetPreview/PreviewPane";
import { Toaster } from "../common/Toaster";
import { useFolderTree } from "../../hooks/useFolderTree";
import { useUIStore } from "../../store/uiStore";
import { useSearchStore, isSearchActive } from "../../store/searchStore";

// ─── Header ───────────────────────────────────────────────────────────────────

function Header() {
  const { organization } = useOrganization();
  const { signOut } = useClerk();

  async function handleSignOut() {
    try {
      await logout();
    } catch {
      // best-effort
    }
    await signOut();
  }

  return (
    <header className="h-11 shrink-0 flex items-center justify-between gap-3 px-4 border-b border-gray-700 bg-gray-900">
      <div className="flex items-center gap-3 shrink-0">
        <span className="text-sm font-bold text-white tracking-tight">DAM</span>
        {organization && (
          <span className="text-xs text-gray-400 bg-gray-800 border border-gray-700 px-2 py-0.5 rounded-full">
            {organization.name}
          </span>
        )}
      </div>
      <SearchBar />
      <button
        onClick={handleSignOut}
        className="text-xs text-gray-400 hover:text-white transition-colors shrink-0"
      >
        Sign out
      </button>
    </header>
  );
}

// ─── Main content area ────────────────────────────────────────────────────────

function MainContent({ children }: { children?: React.ReactNode }) {
  const { data: tree = [] } = useFolderTree();
  const { selectedFolderId } = useUIStore();
  const { nameQuery, tagIds, mimeTypes, dateFrom, dateTo } = useSearchStore();
  const searchActive = isSearchActive({ nameQuery, tagIds, mimeTypes, dateFrom, dateTo });

  return (
    <main className="flex-1 flex flex-col overflow-hidden">
      <Breadcrumb tree={tree} />
      {children ?? (
        searchActive ? (
          <SearchResults />
        ) : selectedFolderId !== null ? (
          <AssetGrid folderId={selectedFolderId} />
        ) : (
          <div className="flex-1 overflow-auto p-4">
            <EmptyFolderState folderId={null} />
          </div>
        )
      )}
    </main>
  );
}

function EmptyFolderState({ folderId }: { folderId: number | null }) {
  if (!folderId) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-center">
        <p className="text-4xl mb-4">📁</p>
        <p className="text-gray-400 text-sm">
          Select a folder on the left, or create one to get started.
        </p>
      </div>
    );
  }
  return (
    <div className="flex flex-col items-center justify-center h-full text-center">
      <p className="text-4xl mb-4">📂</p>
      <p className="text-gray-400 text-sm">This folder is empty.</p>
    </div>
  );
}

// ─── AppLayout ────────────────────────────────────────────────────────────────

interface AppLayoutProps {
  children?: React.ReactNode;
}

export function AppLayout({ children }: AppLayoutProps) {
  return (
    <div className="flex flex-col h-screen bg-gray-900 text-white overflow-hidden">
      <Header />
      <div className="flex flex-1 overflow-hidden">
        <Sidebar />
        <MainContent>{children}</MainContent>
        <PreviewPane />
      </div>
      <Toaster />
    </div>
  );
}
