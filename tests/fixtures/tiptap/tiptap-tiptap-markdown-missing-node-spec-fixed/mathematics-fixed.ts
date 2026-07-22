import { Node } from '@tiptap/core';
import 'tiptap-markdown';

export const Mathematics = Node.create({
  name: 'math',
  group: 'inline',
  inline: true,
  atom: true,

  addAttributes() {
    return {
      latex: '',
    };
  },

  addStorage() {
    return {
      // Markdown serialization spec — math survives markdown export/import
      markdown: {
        serialize(state: any, node: any) {
          state.write(`$${node.attrs.latex}$`);
        },
        parse: {
          // Inline math: $latex$
          setup(markdownit: any) {
            markdownit.inline.ruler.push('math', (state: any, silent: boolean) => {
              if (state.src[state.pos] !== '$') return false;
              const end = state.src.indexOf('$', state.pos + 1);
              if (end === -1) return false;
              if (!silent) {
                const token = state.push('math_inline', 'math', 0);
                token.markup = '$';
                token.content = state.src.slice(state.pos + 1, end);
              }
              state.pos = end + 1;
              return true;
            });
          },
        },
      },
    };
  },

  renderHTML({ node }) {
    return ['span', { class: 'math-node', 'data-latex': node.attrs.latex }];
  },

  parseHTML() {
    return [{ tag: 'span.math-node' }];
  },
});
