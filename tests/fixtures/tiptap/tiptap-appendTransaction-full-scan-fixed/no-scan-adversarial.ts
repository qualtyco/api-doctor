import { Plugin, PluginKey } from '@tiptap/pm/state';

// Adversarial: appendTransaction that never calls descendants — should NOT fire
export const selectionPlugin = new Plugin({
  key: new PluginKey('selection-normalizer'),
  appendTransaction: (transactions, _old, newState) => {
    const docChanged = transactions.some((tr) => tr.docChanged);
    if (!docChanged) return null;

    // Only checks selection positions — no descendants() scan
    const { from, to } = newState.selection;
    if (from === to) return null;

    const tr = newState.tr;
    tr.setMeta('addToHistory', false);
    return tr;
  },
});
