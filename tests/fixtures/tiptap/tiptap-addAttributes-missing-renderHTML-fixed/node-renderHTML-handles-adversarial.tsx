import { Node } from '@tiptap/core';

// Adversarial: no per-attribute renderHTML, but the node-level renderHTML
// writes both attributes back under the names parseHTML reads. Serialization
// is hand-written rather than absent, so the round-trip holds.
export const Callout = Node.create({
  name: 'callout',
  group: 'block',
  content: 'block+',

  addAttributes() {
    return {
      variant: {
        default: 'info',
        parseHTML: (element) => element.getAttribute('data-variant') ?? 'info',
      },
      label: {
        default: '',
        parseHTML: (element) => element.dataset.calloutLabel,
      },
    };
  },

  parseHTML() {
    return [{ tag: 'aside.callout' }];
  },

  renderHTML({ node }) {
    return [
      'aside',
      {
        class: 'callout',
        'data-variant': node.attrs.variant,
        'data-callout-label': node.attrs.label,
      },
      0,
    ];
  },
});
