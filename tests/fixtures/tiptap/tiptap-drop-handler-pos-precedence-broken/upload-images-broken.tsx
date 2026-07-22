import { Extension } from '@tiptap/core';
import { Plugin } from '@tiptap/pm/state';

type UploadFn = (file: File, view: any, pos: number) => void;

function uploadFile(uploadFn: UploadFn) {
  return new Plugin({
    props: {
      handleDrop(view, event) {
        event.preventDefault();
        const files = event.dataTransfer?.files;
        if (!files?.length) return false;

        const file = files[0];
        const coordinates = view.posAtCoords({
          left: event.clientX,
          top: event.clientY,
        });

        // Operator precedence bug: parses as coordinates?.pos ?? (0 - 1) = ?? -1
        uploadFn(file, view, coordinates?.pos ?? 0 - 1);
        return true;
      },
    },
  });
}

export default uploadFile;
