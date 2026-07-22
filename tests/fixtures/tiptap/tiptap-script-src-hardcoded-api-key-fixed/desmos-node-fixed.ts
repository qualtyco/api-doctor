import { Node } from '@tiptap/core';

function loadExternalCalculator() {
  const script = document.createElement('script');
  script.async = true;
  // Key read from environment variable inline — not hardcoded
  script.src = `https://www.api.example.com/v1.11/calculator.js?apiKey=${process.env.NEXT_PUBLIC_API_KEY}`;
  document.body.appendChild(script);
}

export const CalculatorNode = Node.create({
  name: 'calculator',
  addNodeView() {
    return () => {
      const dom = document.createElement('div');
      loadExternalCalculator();
      return { dom };
    };
  },
});
