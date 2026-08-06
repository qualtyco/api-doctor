// Adversarial: three individual table sub-packages imported, but every binding
// is used solely as an `.extend()` base to build custom nodes. TableKit cannot
// subclass a node — the sub-package imports are required here, so this must
// NOT fire even though it clears the 2-import threshold.
import { TableRow } from '@tiptap/extension-table-row';
import { TableCell } from '@tiptap/extension-table-cell';
import { TableHeader } from '@tiptap/extension-table-header';

export const SmartTableRow = TableRow.extend({
  addAttributes() {
    return {
      rowType: { default: 'data' },
    };
  },
});

export const SmartTableCell = TableCell.extend({
  addAttributes() {
    return {
      formula: { default: null },
    };
  },
});

export const SmartTableHeader = TableHeader.extend({
  addAttributes() {
    return {
      formula: { default: null },
    };
  },
});
