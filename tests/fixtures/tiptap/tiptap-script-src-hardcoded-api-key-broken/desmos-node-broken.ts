import { Node } from '@tiptap/core';

function loadExternalCalculator() {
  const script = document.createElement('script');
  script.async = true;
  // Hardcoded API key in plain string literal
  script.src = `https://www.api.example.com/v1.11/calculator.js?apiKey=dcb31709b452b1cf9dc26972add0fda6`;
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
