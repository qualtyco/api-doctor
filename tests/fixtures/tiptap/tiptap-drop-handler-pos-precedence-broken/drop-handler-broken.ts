import { Plugin } from '@tiptap/pm/state';

export function createDropPlugin(onDrop: (pos: number, item: DataTransferItem) => void) {
  return new Plugin({
    props: {
      handleDrop(view, event) {
        const items = Array.from(event.dataTransfer?.items ?? []);
        const fileItem = items.find((i) => i.kind === 'file');
        if (!fileItem) return false;

        const dropPos = view.posAtCoords({ left: event.clientX, top: event.clientY });
        // Same precedence bug: dropPos?.pos ?? (0 - 1) = dropPos?.pos ?? -1
        const pos = dropPos?.pos ?? 0 - 1;

        onDrop(pos, fileItem);
        return true;
      },
    },
  });
}
