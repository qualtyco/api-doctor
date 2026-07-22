import { Plugin } from '@tiptap/pm/state';

// Adversarial: parentheses make the precedence correct — should NOT fire
export function createDropPlugin(onDrop: (pos: number) => void) {
  return new Plugin({
    props: {
      handleDrop(view, event) {
        const coords = view.posAtCoords({ left: event.clientX, top: event.clientY });

        // Correct — explicit parentheses around the ?? expression
        const pos = (coords?.pos ?? 0) - 1;
        onDrop(pos);
        return true;
      },
    },
  });
}

// Also correct — no -1 offset, just use the position directly
export function simpleDropPlugin(onDrop: (pos: number) => void) {
  return new Plugin({
    props: {
      handleDrop(view, event) {
        const coords = view.posAtCoords({ left: event.clientX, top: event.clientY });
        const pos = coords?.pos ?? 0;
        onDrop(pos);
        return true;
      },
    },
  });
}
