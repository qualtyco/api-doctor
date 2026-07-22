import StarterKit from '@tiptap/starter-kit';
import { TableKit } from '@tiptap/extension-table';

// Correct: use TableKit for coordinated configuration
export const extensions = [
  StarterKit,
  TableKit.configure({
    table: { HTMLAttributes: { class: 'border-collapse table-auto w-full' } },
    tableCell: { HTMLAttributes: { class: 'border border-muted px-4 py-2' } },
    tableHeader: { HTMLAttributes: { class: 'border border-muted px-4 py-2 font-bold' } },
  }),
];
