import { Node } from '@tiptap/core';

function loadCalculatorScript() {
  const script = document.createElement('script');
  script.src = `https://www.api.example.com/v1.11/calculator.js?apiKey=${process.env.NEXT_PUBLIC_API_KEY}`;
  script.async = true;
  // No integrity attribute set — SRI missing
  document.body.appendChild(script);
}

export const CalculatorNode = Node.create({
  name: 'calculator',
  group: 'block',
  atom: true,
  addNodeView() {
    return () => {
      const dom = document.createElement('div');
      dom.className = 'calculator-wrapper';
      loadCalculatorScript();
      return { dom };
    };
  },
});
