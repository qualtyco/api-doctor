/**
 * tiptap-atom-node-wrap-in (correctness)
 *
 * Detects when `wrapIn(nodeName)` is called with the name of a node type that
 * is defined as `atom: true` in the same file. Atom nodes cannot contain
 * content, so wrapIn() always silently returns false — the command appears
 * broken with no error or user feedback.
 */
import { walk } from '../utils.js';

const rule = {
  meta: {
    type: 'problem',
    docs: {
      description: 'wrapIn() must not be called with an atom node type',
      category: 'correctness',
      rationale:
        'Atom nodes have no content model — ProseMirror cannot wrap other nodes inside them. Calling wrapIn("atomNode") always returns false silently, making the command appear broken when triggered on selected text. Use replaceSelectionWith(node.create()) or insertContent() instead.',
      docsUrl: 'https://tiptap.dev/docs/editor/extensions/custom-extensions/create-new/node',
      recommended: true,
    },
    messages: {
      wrapInAtomNode:
        'wrapIn() is called with an atom node type. Atom nodes cannot contain content, so wrapIn() always silently returns false. Replace the selection instead of wrapping it.',
    },
    schema: [],
  },
  create(context: any) {
    // Collect atom node names defined in this file
    const atomNodeNames = new Set<string>();
    // Collect wrapIn calls with string literal arguments
    const wrapInCalls: Array<{ node: any; name: string }> = [];

    function extractNodeName(configObj: any): string | null {
      if (configObj?.type !== 'ObjectExpression') return null;
      const nameProp = configObj.properties?.find(
        (p: any) =>
          p?.type === 'Property' &&
          ((p.key?.type === 'Identifier' && p.key.name === 'name') ||
            (p.key?.type === 'Literal' && p.key.value === 'name')),
      );
      const nameVal = nameProp?.value;
      if (nameVal?.type === 'Literal' && typeof nameVal.value === 'string') {
        return nameVal.value;
      }
      return null;
    }

    function hasAtomTrue(configObj: any): boolean {
      if (configObj?.type !== 'ObjectExpression') return false;
      return configObj.properties?.some(
        (p: any) =>
          p?.type === 'Property' &&
          ((p.key?.type === 'Identifier' && p.key.name === 'atom') ||
            (p.key?.type === 'Literal' && p.key.value === 'atom')) &&
          p.value?.type === 'Literal' &&
          p.value.value === true,
      ) ?? false;
    }

    return {
      CallExpression(node: any) {
        // Detect Node.create({...}) / Mark.create({...}) with atom: true
        if (
          node.callee?.type === 'MemberExpression' &&
          node.callee.property?.name === 'create'
        ) {
          const configArg = node.arguments?.[0];
          if (configArg?.type === 'ObjectExpression' && hasAtomTrue(configArg)) {
            const name = extractNodeName(configArg);
            if (name) atomNodeNames.add(name);
          }
        }

        // Detect wrapIn('nodeName') or commands.wrapIn('nodeName')
        const callee = node.callee;
        const isWrapIn =
          (callee?.type === 'Identifier' && callee.name === 'wrapIn') ||
          (callee?.type === 'MemberExpression' && callee.property?.name === 'wrapIn');
        if (isWrapIn) {
          const firstArg = node.arguments?.[0];
          if (firstArg?.type === 'Literal' && typeof firstArg.value === 'string') {
            wrapInCalls.push({ node, name: firstArg.value });
          }
        }
      },

      'Program:exit'() {
        for (const { node, name } of wrapInCalls) {
          if (atomNodeNames.has(name)) {
            context.report({ node, messageId: 'wrapInAtomNode' });
          }
        }
      },
    };
  },
};

export const tiptapAtomNodeWrapInRule = rule;
export default rule;
