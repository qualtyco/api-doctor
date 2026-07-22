import { Node } from '@tiptap/core';

export const WidgetNode = Node.create({
  name: 'widget',
  group: 'block',
  atom: true,

  addCommands() {
    return {
      toggleWidget:
        () =>
        ({ commands, state, tr, dispatch }) => {
          const { selection } = state;
          if (selection.empty) {
            return commands.insertContent({ type: 'widget', attrs: { src: '' } });
          }
          // Correct: replace selection with the atom node instead of wrapping
          const node = state.schema.nodes.widget.create({ src: '' });
          if (dispatch) {
            dispatch(tr.replaceSelectionWith(node));
          }
          return true;
        },
    };
  },

  renderHTML({ node }) {
    return ['div', { class: 'widget-node', 'data-type': 'widget' }];
  },

  parseHTML() {
    return [{ tag: 'div[data-type="widget"]' }];
  },
});
