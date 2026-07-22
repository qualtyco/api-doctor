import { Node } from '@tiptap/core';
import { MarkdownExtension } from 'tiptap-markdown';

// Custom callout node with tiptap-markdown imported — no markdown spec
export const CalloutNode = Node.create({
  name: 'callout',
  group: 'block',
  content: 'block+',

  addAttributes() {
    return {
      type: {
        default: 'info',
        parseHTML: (el) => el.getAttribute('data-type') ?? 'info',
        renderHTML: (attrs) => ({ 'data-type': attrs.type }),
      },
    };
  },

  renderHTML({ node, HTMLAttributes }) {
    return ['div', { class: `callout callout-${node.attrs.type}`, ...HTMLAttributes }, 0];
  },

  parseHTML() {
    return [{ tag: 'div.callout' }];
  },

  // No addStorage with markdown serializer — callout blocks lost on markdown export
});
