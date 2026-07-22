import { Plugin, PluginKey } from '@tiptap/pm/state';

// Adversarial: appendTransaction that only reads state — no mutations, should NOT fire
export const validationPlugin = new Plugin({
  key: new PluginKey('readonly-validator'),
  appendTransaction: (transactions, _old, newState) => {
    let hasError = false;

    newState.doc.descendants((node) => {
      if (node.type.name === 'formula' && !node.attrs.latex) {
        hasError = true;
      }
    });

    if (hasError) {
      console.warn('Document contains formula nodes with no latex content');
    }

    // Returns null — no transaction dispatched, no mutation, no history concern
    return null;
  },
});
