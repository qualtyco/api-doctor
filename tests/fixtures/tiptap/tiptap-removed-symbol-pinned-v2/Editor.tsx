// Identical to the broken fixture's code, on a project pinned to Tiptap 2.
// The root import is correct there and must stay silent forever — the rule
// reports a mismatch with what is installed, never an upgrade.
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
