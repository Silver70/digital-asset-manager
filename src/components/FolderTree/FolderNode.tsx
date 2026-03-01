import { useState } from "react";
import * as ContextMenu from "@radix-ui/react-context-menu";
import type { FolderNode } from "../../types/folder";
import { useUIStore } from "../../store/uiStore";

export type FolderAction =
  | { type: "newSubfolder"; folder: FolderNode }
  | { type: "rename"; folder: FolderNode }
  | { type: "delete"; folder: FolderNode };

interface FolderNodeItemProps {
  node: FolderNode;
  onAction: (action: FolderAction) => void;
}

export function FolderNodeItem({ node, onAction }: FolderNodeItemProps) {
  const [expanded, setExpanded] = useState(true);
  const { selectedFolderId, setSelectedFolder } = useUIStore();
  const isSelected = selectedFolderId === node.id;
  const hasChildren = node.children.length > 0;

  const indent = node.depth * 12 + 8;

  return (
    <div>
      <ContextMenu.Root>
        <ContextMenu.Trigger asChild>
          <div
            role="button"
            tabIndex={0}
            className={[
              "flex items-center gap-1 py-1 pr-2 rounded cursor-pointer select-none text-sm",
              isSelected
                ? "bg-indigo-600 text-white"
                : "text-gray-300 hover:bg-gray-700/60",
            ].join(" ")}
            style={{ paddingLeft: `${indent}px` }}
            onClick={() => setSelectedFolder(node.id)}
            onKeyDown={(e) => e.key === "Enter" && setSelectedFolder(node.id)}
          >
            {/* Expand / collapse toggle */}
            <span
              className={[
                "w-4 h-4 flex items-center justify-center text-xs shrink-0",
                hasChildren ? "" : "invisible",
              ].join(" ")}
              onClick={(e) => {
                e.stopPropagation();
                setExpanded((v) => !v);
              }}
            >
              {expanded ? "▾" : "▸"}
            </span>

            {/* Folder icon */}
            <span className="shrink-0 text-base leading-none">
              {isSelected ? "📂" : "📁"}
            </span>

            {/* Name */}
            <span className="truncate">{node.name}</span>
          </div>
        </ContextMenu.Trigger>

        <ContextMenu.Portal>
          <ContextMenu.Content
            className="bg-gray-800 border border-gray-600 rounded-lg shadow-2xl py-1 min-w-[160px] z-50 outline-none"
          >
            <ContextMenu.Item
              className="px-3 py-1.5 text-sm text-gray-200 hover:bg-indigo-600 hover:text-white cursor-pointer outline-none rounded-sm mx-1"
              onSelect={() => onAction({ type: "newSubfolder", folder: node })}
            >
              New Subfolder
            </ContextMenu.Item>
            <ContextMenu.Item
              className="px-3 py-1.5 text-sm text-gray-200 hover:bg-indigo-600 hover:text-white cursor-pointer outline-none rounded-sm mx-1"
              onSelect={() => onAction({ type: "rename", folder: node })}
            >
              Rename
            </ContextMenu.Item>
            <ContextMenu.Separator className="h-px bg-gray-700 my-1" />
            <ContextMenu.Item
              className="px-3 py-1.5 text-sm text-red-400 hover:bg-red-600 hover:text-white cursor-pointer outline-none rounded-sm mx-1"
              onSelect={() => onAction({ type: "delete", folder: node })}
            >
              Delete
            </ContextMenu.Item>
          </ContextMenu.Content>
        </ContextMenu.Portal>
      </ContextMenu.Root>

      {/* Children */}
      {expanded && hasChildren && (
        <div>
          {node.children.map((child) => (
            <FolderNodeItem key={child.id} node={child} onAction={onAction} />
          ))}
        </div>
      )}
    </div>
  );
}
