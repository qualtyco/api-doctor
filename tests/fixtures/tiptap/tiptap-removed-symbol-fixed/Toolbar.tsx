import { useEditor } from '@tiptap/react';
import { BubbleMenu, FloatingMenu } from '@tiptap/react/menus';
import StarterKit from '@tiptap/starter-kit';

export function Toolbar() {
  const editor = useEditor({ extensions: [StarterKit] });

  return (
    <>
      <FloatingMenu editor={editor} options={{ placement: 'left' }}>
        <button onClick={() => editor?.chain().focus().toggleHeading({ level: 1 }).run()}>H1</button>
      </FloatingMenu>
      <BubbleMenu editor={editor}>
        <button onClick={() => editor?.chain().focus().toggleItalic().run()}>Italic</button>
      </BubbleMenu>
    </>
  );
}
