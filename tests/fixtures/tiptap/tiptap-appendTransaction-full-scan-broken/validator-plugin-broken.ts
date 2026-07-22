import { Plugin, PluginKey } from '@tiptap/pm/state';

// Validator that scans the whole doc on every transaction — no docChanged guard
export const linkValidatorPlugin = new Plugin({
  key: new PluginKey('link-validator'),
  appendTransaction: (transactions, _old, newState) => {
    // Missing: if (!transactions.some(tr => tr.docChanged)) return null;
    newState.doc.descendants((node, pos) => {
      if (node.type.name === 'link' && !node.attrs.href) {
        console.warn(`Empty link at position ${pos}`);
      }
    });
    return null;
  },
});
