import { useMemo } from "react";
import type { FolderNode } from "../../types/folder";
import { useUIStore } from "../../store/uiStore";

interface BreadcrumbProps {
  tree: FolderNode[];
}

/** Flattens a nested FolderNode tree into a Map<id, FolderNode>. */
function flattenTree(nodes: FolderNode[]): Map<number, FolderNode> {
  const map = new Map<number, FolderNode>();
  function visit(list: FolderNode[]) {
    for (const n of list) {
      map.set(n.id, n);
      visit(n.children);
    }
  }
  visit(nodes);
  return map;
}

export function Breadcrumb({ tree }: BreadcrumbProps) {
  const { selectedFolderId, setSelectedFolder } = useUIStore();

  const flatMap = useMemo(() => flattenTree(tree), [tree]);

  const crumbs = useMemo((): FolderNode[] => {
    if (!selectedFolderId) return [];
    const folder = flatMap.get(selectedFolderId);
    if (!folder) return [];
    // path = "/1/5/12" → [1, 5, 12]
    const ids = folder.path.split("/").filter(Boolean).map(Number);
    return ids
      .map((id) => flatMap.get(id))
      .filter((f): f is FolderNode => f !== undefined);
  }, [selectedFolderId, flatMap]);

  return (
    <nav className="flex items-center gap-1.5 text-sm px-4 py-2.5 border-b border-gray-700 bg-gray-900/50">
      <button
        onClick={() => setSelectedFolder(null)}
        className={[
          "transition-colors",
          crumbs.length === 0
            ? "text-white cursor-default"
            : "text-gray-400 hover:text-white",
        ].join(" ")}
      >
        All Files
      </button>

      {crumbs.map((folder, i) => (
        <span key={folder.id} className="flex items-center gap-1.5">
          <span className="text-gray-600">›</span>
          <button
            onClick={() => setSelectedFolder(folder.id)}
            className={[
              "transition-colors",
              i === crumbs.length - 1
                ? "text-white cursor-default"
                : "text-gray-400 hover:text-white",
            ].join(" ")}
          >
            {folder.name}
          </button>
        </span>
      ))}
    </nav>
  );
}
