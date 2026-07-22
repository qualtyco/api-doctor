import { Node } from '@tiptap/core';
import { Plugin, PluginKey } from '@tiptap/pm/state';

export const DefinitionNode = Node.create({
  name: 'definition',
  group: 'block',

  addProseMirrorPlugins() {
    return [
      new Plugin({
        key: new PluginKey('definition-scan'),
        appendTransaction: (transactions, _oldState, newState) => {
          // Guard: skip the scan entirely when the doc hasn't changed
          const docChanged = transactions.some((tr) => tr.docChanged);
          if (!docChanged) return null;

          let tr = newState.tr;
          let modified = false;

          newState.doc.descendants((node, pos) => {
            if (node.type.name !== 'definition') return;
            if (node.content.size === 0) {
              tr = tr.insert(pos + 1, newState.schema.text(' '));
              modified = true;
            }
          });

          return modified ? tr.setMeta('addToHistory', false) : null;
        },
      }),
    ];
  },
});
