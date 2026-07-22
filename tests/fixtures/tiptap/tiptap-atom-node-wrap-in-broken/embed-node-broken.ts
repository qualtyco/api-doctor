import { Node } from '@tiptap/core';

export const EmbedNode = Node.create({
  name: 'embed',
  group: 'block',
  atom: true,

  addCommands() {
    return {
      setEmbed:
        (attrs: { src: string }) =>
        ({ commands, state }) => {
          const { selection } = state;
          if (!selection.empty) {
            // Atom nodes cannot wrap content — this always fails silently
            return commands.wrapIn('embed');
          }
          return commands.insertContent({ type: 'embed', attrs });
        },
      wrapInEmbed:
        () =>
        ({ commands }) =>
          // Direct wrapIn call with atom node name
          commands.wrapIn('embed'),
    };
  },

  renderHTML({ node }) {
    return ['div', { class: 'embed-node', 'data-src': node.attrs.src }];
  },

  parseHTML() {
    return [{ tag: 'div.embed-node' }];
  },
});
