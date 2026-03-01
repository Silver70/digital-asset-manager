import { FolderTree } from "../FolderTree/FolderTree";

export function Sidebar() {
  return (
    <aside className="w-56 shrink-0 border-r border-gray-700 bg-gray-900 flex flex-col overflow-hidden">
      <FolderTree />
    </aside>
  );
}
