import { Node } from '@tiptap/core';
import 'tiptap-markdown';

// Node imports tiptap-markdown but defines no markdown serialization spec
// Math formulas will be silently dropped on markdown export
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

  renderHTML({ node }) {
    return ['span', { class: 'math-node', 'data-latex': node.attrs.latex }];
  },

  parseHTML() {
    return [
      {
        tag: 'span.math-node',
        getAttrs: (dom) => ({
          latex: (dom as HTMLElement).getAttribute('data-latex') ?? '',
        }),
      },
    ];
  },
});
