import { Node } from '@tiptap/core';

// Adversarial case 1: atom node with NO wrapIn call — should NOT fire
export const IconNode = Node.create({
  name: 'icon',
  group: 'inline',
  atom: true,

  addCommands() {
    return {
      insertIcon:
        (attrs: { name: string }) =>
        ({ commands }) =>
          commands.insertContent({ type: 'icon', attrs }),
    };
  },
});

// Adversarial case 2: wrapIn('paragraph') but no atom node named 'paragraph' — should NOT fire
export const ContainerNode = Node.create({
  name: 'container',
  group: 'block',
  content: 'block+',
  // NOT atom

  addCommands() {
    return {
      wrapInContainer:
        () =>
        ({ commands }) =>
          // wrapIn a non-atom node — valid usage
          commands.wrapIn('paragraph'),
    };
  },
});
