import { FloatingMenu, useEditor } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';

export function Toolbar() {
  const editor = useEditor({ extensions: [StarterKit] });

  return (
    <FloatingMenu editor={editor} tippyOptions={{ placement: 'left' }}>
      <button onClick={() => editor?.chain().focus().toggleHeading({ level: 1 }).run()}>H1</button>
    </FloatingMenu>
  );
}
