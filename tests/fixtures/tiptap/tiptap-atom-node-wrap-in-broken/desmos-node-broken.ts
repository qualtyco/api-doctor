import { Node } from '@tiptap/core';

export const WidgetNode = Node.create({
  name: 'widget',
  group: 'block',
  atom: true,  // Cannot contain content

  addCommands() {
    return {
      toggleWidget:
        () =>
        ({ commands, chain, state }) => {
          const { selection } = state;
          if (selection.empty) {
            return commands.insertContent({ type: 'widget', attrs: { src: '' } });
          }
          // wrapIn with an atom node always returns false silently
          return commands.wrapIn('widget');
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
