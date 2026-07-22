import { Node } from '@tiptap/core';
import { Plugin, PluginKey } from '@tiptap/pm/state';

export const DefinitionNode = Node.create({
  name: 'definition',
  group: 'block',
  content: 'inline*',

  addProseMirrorPlugins() {
    return [
      new Plugin({
        key: new PluginKey('definition-auto-space'),
        appendTransaction: (transactions, _oldState, newState) => {
          let tr = newState.tr;
          let modified = false;

          newState.doc.descendants((node, pos) => {
            if (node.type.name !== 'definition') return;
            if (node.content.size === 0) {
              tr = tr.insert(pos + 1, newState.schema.text(' '));
              modified = true;
            }
          });

          // Missing: tr.setMeta("addToHistory", false)
          // This pollutes the undo stack
          return modified ? tr : null;
        },
      }),
    ];
  },
});
