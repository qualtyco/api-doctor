import { Plugin, PluginKey } from '@tiptap/pm/state';

// Auto-spacing plugin that removes trailing spaces — no addToHistory annotation
export const spacingPlugin = new Plugin({
  key: new PluginKey('auto-spacing'),
  appendTransaction: (transactions, _old, newState) => {
    let tr = newState.tr;
    let changed = false;

    newState.doc.descendants((node, pos) => {
      if (node.isText && node.text?.endsWith('  ')) {
        const trimmed = node.text.trimEnd();
        tr = tr.replaceWith(pos, pos + node.nodeSize, newState.schema.text(trimmed));
        changed = true;
      }
    });

    // Transaction mutates doc but missing setMeta("addToHistory", false)
    return changed ? tr : null;
  },
});
