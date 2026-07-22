import { Node } from '@tiptap/core';

// Adversarial: shorthand attribute syntax — no parseHTML, no renderHTML
// TipTap accepts bare `{ latex: "" }` as shorthand for { default: "" }
// This should NOT fire because there is no parseHTML to create the mismatch
export const MathNode = Node.create({
  name: 'math',
  group: 'inline',
  inline: true,
  atom: true,

  addAttributes() {
    return {
      // Valid TipTap v2 shorthand — no parseHTML or renderHTML needed
      latex: '',
      display: false,
    };
  },

  renderHTML({ node }) {
    return ['span', { class: 'math-inline', 'data-latex': node.attrs.latex }];
  },

  parseHTML() {
    return [{ tag: 'span.math-inline' }];
  },
});
