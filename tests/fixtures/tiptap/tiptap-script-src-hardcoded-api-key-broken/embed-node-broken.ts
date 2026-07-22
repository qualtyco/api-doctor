import { Node } from '@tiptap/core';

function loadEmbedScript() {
  const script = document.createElement('script');
  // Plain string literal containing hardcoded API key
  script.src = "https://cdn.example.com/embed.js?apiKey=abc123demo456&version=2";
  document.body.appendChild(script);
}

export const EmbedNode = Node.create({
  name: 'embed',
  addNodeView() {
    return () => {
      const dom = document.createElement('div');
      loadEmbedScript();
      return { dom };
    };
  },
});
