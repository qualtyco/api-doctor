import { Node } from '@tiptap/core';

function loadEmbedScript() {
  const script = document.createElement('script');
  // Adversarial: script.src set but no apiKey= in the URL — should NOT fire
  script.src = "https://cdn.example.com/embed.js?version=1.2.3&mode=production";
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
