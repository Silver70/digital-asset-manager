import { FolderTree } from "../FolderTree/FolderTree";
import { FilterSidebar } from "../Search/FilterSidebar";

export function Sidebar() {
  return (
    <aside className="w-56 shrink-0 border-r border-gray-700 bg-gray-900 flex flex-col overflow-hidden">
      <div className="flex-1 min-h-0 overflow-hidden">
        <FolderTree />
      </div>
      <FilterSidebar />
    </aside>
  );
}
