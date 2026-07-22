import StarterKit from '@tiptap/starter-kit';
import { Table } from '@tiptap/extension-table';
import { TableRow } from '@tiptap/extension-table-row';
import { TableCell } from '@tiptap/extension-table-cell';
import { TableHeader } from '@tiptap/extension-table-header';

// Individual table extension imports instead of TableKit
export const extensions = [
  StarterKit,
  Table.configure({
    resizable: true,
    HTMLAttributes: { class: 'border-collapse table-auto w-full' },
  }),
  TableRow,
  TableCell,
  TableHeader,
];
