import { Mark, Node } from '@tiptap/core';

export const FontSize = Mark.create({
  name: 'fontSize',

  addAttributes() {
    return {
      // Read from an inline style, written back as fontsize="16px" — the style
      // is never re-emitted, so the size is lost on the next parse.
      fontSize: {
        default: null,
        parseHTML: (element) => element.style.fontSize,
      },

      lineHeight: {
        default: null,
        parseHTML: (element) => element.style.getPropertyValue('line-height'),
      },
    };
  },

  parseHTML() {
    return [{ tag: 'span' }];
  },

  renderHTML({ HTMLAttributes }) {
    return ['span', HTMLAttributes, 0];
  },
});

export const Callout = Node.create({
  name: 'callout',
  group: 'block',

  addAttributes() {
    return {
      // dataset.calloutVariant is data-callout-variant; serialized as
      // variant="…", which the next parse cannot find.
      variant: {
        default: 'info',
        parseHTML: (element) => element.dataset.calloutVariant,
      },

      // Read from text content — an attribute can never write it back.
      caption: {
        default: '',
        parseHTML: (element) => element.textContent,
      },
    };
  },

  parseHTML() {
    return [{ tag: 'div.callout' }];
  },

  renderHTML({ HTMLAttributes }) {
    return ['div', { class: 'callout', ...HTMLAttributes }, 0];
  },
});
