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
        renderHTML: (attrs) => ({ 'data-label': attrs.label }),
      },
      numbered: {
        default: false,
        parseHTML: (element) => element.getAttribute('data-numbered') === 'true',
        renderHTML: (attrs) => ({ 'data-numbered': String(attrs.numbered) }),
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
