// Adversarial: only one individual table sub-package imported (below the 2-import threshold)
// Should NOT fire — single import doesn't indicate the split-package anti-pattern
import { TableRow } from '@tiptap/extension-table-row';

export { TableRow };

// Also adversarial: importing from the base @tiptap/extension-table (not sub-packages) is fine
import { Table } from '@tiptap/extension-table';

export const baseTable = Table.configure({ resizable: true });
