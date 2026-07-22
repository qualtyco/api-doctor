import { Node } from '@tiptap/core';
import 'tiptap-markdown';
import type { MarkdownNodeSpec } from 'tiptap-markdown';

// Adversarial: has a MarkdownNodeSpec reference — should NOT fire
export const FormulaNode = Node.create({
  name: 'formula',
  group: 'block',
  atom: true,

  addAttributes() {
    return {
      latex: {
        default: '',
        parseHTML: (el) => el.getAttribute('data-latex'),
        renderHTML: (attrs) => ({ 'data-latex': attrs.latex }),
      },
    };
  },

  addStorage() {
    return {
      markdown: {
        serialize(state: any, node: any) {
          state.write(`$$\n${node.attrs.latex}\n$$`);
        },
      } satisfies MarkdownNodeSpec,
    };
  },

  renderHTML({ node }) {
    return ['div', { class: 'formula-block', 'data-latex': node.attrs.latex }];
  },

  parseHTML() {
    return [{ tag: 'div.formula-block' }];
  },
});
