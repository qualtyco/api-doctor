import { useEditor } from '@tiptap/react';
import { TableRow } from '@tiptap/extension-table-row';
import { TableCell } from '@tiptap/extension-table-cell';
import { TableHeader } from '@tiptap/extension-table-header';

export function useEditorWithTables() {
  return useEditor({
    extensions: [
      // Individual sub-package imports miss TableKit coordination
      TableRow,
      TableCell.configure({ HTMLAttributes: { class: 'border px-2 py-1' } }),
      TableHeader.configure({ HTMLAttributes: { class: 'border px-2 py-1 font-bold' } }),
    ],
  });
}
