import { Node } from '@tiptap/core';

export const FormulaNode = Node.create({
  name: 'formula',
  group: 'block',
  atom: true,

  addAttributes() {
    return {
      latex: {
        default: '',
        parseHTML: (element) => element.getAttribute('data-latex'),
        renderHTML: (attrs) => ({ 'data-latex': attrs.latex }),
      },
      label: {
        default: 'Equation',
        parseHTML: (element) => element.getAttribute('data-label'),
        // Missing renderHTML — TipTap will emit label="..." not data-label="..."
      },
      numbered: {
        default: false,
        parseHTML: (element) => element.getAttribute('data-numbered') === 'true',
        // Missing renderHTML for numbered attribute too
      },
    };
  },

  renderHTML({ node }) {
    return ['div', { 'data-type': 'formula', class: 'formula-node' }, 0];
  },

  parseHTML() {
    return [{ tag: 'div[data-type="formula"]' }];
  },
});
