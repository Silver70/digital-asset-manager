import { useState } from "react";
import { useAssetTags } from "../../hooks/useTags";
import { TagPicker } from "./TagPicker";
import type { Tag } from "../../types/tag";

interface TagEditorProps {
  assetId: number;
}

function TagChip({ tag }: { tag: Tag }) {
  return (
    <span
      className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium text-white leading-none"
      style={{ backgroundColor: tag.color }}
      title={tag.name}
    >
      {tag.name}
    </span>
  );
}

export function TagEditor({ assetId }: TagEditorProps) {
  const { data: tags = [] } = useAssetTags(assetId);
  const [pickerOpen, setPickerOpen] = useState(false);

  const visible = tags.slice(0, 3);
  const overflow = tags.length - visible.length;

  return (
    <div className="flex flex-wrap items-center gap-1 min-h-[18px]">
      {visible.map((tag) => (
        <TagChip key={tag.id} tag={tag} />
      ))}
      {overflow > 0 && (
        <span className="text-[10px] text-gray-500">+{overflow}</span>
      )}
      <button
        onClick={(e) => {
          e.stopPropagation();
          setPickerOpen(true);
        }}
        className="inline-flex items-center justify-center w-4 h-4 rounded text-gray-500 hover:text-gray-300 hover:bg-gray-700 transition-colors text-xs leading-none"
        title="Edit tags"
      >
        +
      </button>
      <TagPicker
        assetIds={[assetId]}
        initialAssignedTags={tags}
        open={pickerOpen}
        onOpenChange={setPickerOpen}
      />
    </div>
  );
}
