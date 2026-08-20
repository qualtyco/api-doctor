// The migrated shape on v3. This is the file the rule most has to stay quiet
// on: '@tiptap/react/menus' is a SUBPATH of the package the removals belong
// to, so a prefix match on the package name alone would flag the very import
// that fixes the finding.
import { EditorContent, useEditor } from '@tiptap/react';
import { BubbleMenu } from '@tiptap/react/menus';
import StarterKit from '@tiptap/starter-kit';

export function Editor() {
  const editor = useEditor({ extensions: [StarterKit] });

  return (
    <div>
      <BubbleMenu editor={editor} options={{ placement: 'top' }}>
        <button onClick={() => editor?.chain().focus().toggleBold().run()}>Bold</button>
      </BubbleMenu>
      <EditorContent editor={editor} />
    </div>
  );
}
