import { useEditor } from '@tiptap/react';
import { Table } from '@tiptap/extension-table';
import { TableRow } from '@tiptap/extension-table-row';
import { TableCell } from '@tiptap/extension-table-cell';
import { TableHeader } from '@tiptap/extension-table-header';

// Only TableRow is subclassed — TableCell and TableHeader are registered
// straight from their sub-packages, which is the split-registration
// anti-pattern TableKit exists to replace. Still fires.
const SmartTableRow = TableRow.extend({
  addAttributes() {
    return { rowType: { default: 'data' } };
  },
});

export function useEditorWithTables() {
  return useEditor({
    extensions: [
      Table.configure({ resizable: true }),
      SmartTableRow,
      TableCell.configure({ HTMLAttributes: { class: 'border px-2 py-1' } }),
      TableHeader.configure({ HTMLAttributes: { class: 'border px-2 py-1 font-bold' } }),
    ],
  });
}
