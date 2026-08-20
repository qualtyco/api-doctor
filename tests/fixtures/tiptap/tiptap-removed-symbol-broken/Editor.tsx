// v2 import shape on an installed v3: BubbleMenu left the @tiptap/react root
// in 3.0.1 and now lives at @tiptap/react/menus.
import { BubbleMenu, EditorContent, useEditor } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';

export function Editor() {
  const editor = useEditor({ extensions: [StarterKit] });

  return (
    <div>
      <BubbleMenu editor={editor} tippyOptions={{ duration: 100 }}>
        <button onClick={() => editor?.chain().focus().toggleBold().run()}>Bold</button>
      </BubbleMenu>
      <EditorContent editor={editor} />
    </div>
  );
}
