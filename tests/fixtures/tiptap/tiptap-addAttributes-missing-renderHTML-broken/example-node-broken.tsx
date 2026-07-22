import { Node } from '@tiptap/core';

export const ExampleNode = Node.create({
  name: 'example',
  group: 'block',
  content: 'block+',

  addAttributes() {
    return {
      label: {
        default: 'Example',
        // parseHTML reads data-label, but renderHTML is absent
        // TipTap will serialize as label="..." breaking the round-trip
        parseHTML: (el) => el.getAttribute('data-label') ?? 'Example',
      },
      type: {
        default: 'standard',
        parseHTML: (el) => el.getAttribute('data-type') ?? 'standard',
        // Missing renderHTML for type attribute
      },
    };
  },

  renderHTML({ HTMLAttributes }) {
    return ['section', { class: 'example-node', ...HTMLAttributes }, 0];
  },

  parseHTML() {
    return [{ tag: 'section.example-node' }];
  },
});
