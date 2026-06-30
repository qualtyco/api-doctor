/**
 * tiptap-tiptap-markdown-missing-node-spec (integration)
 *
 * Detects when a file imports both @tiptap/core and tiptap-markdown but
 * contains a Node.create() / Mark.create() call with no markdown serialization
 * spec (no MarkdownNodeSpec reference and no "markdown" property key).
 */
import { walk } from '../utils.js';

const rule = {
  meta: {
    type: 'suggestion',
    docs: {
      description: 'TipTap nodes used with tiptap-markdown must define a markdown serialization spec',
      category: 'integration',
      rationale:
        'When tiptap-markdown serializes a document, nodes without a markdown spec are silently dropped or emitted as empty strings. Custom node types must register a serialize/parse pair via MarkdownNodeSpec (in addStorage or addOptions) so content survives markdown export/import cycles.',
      docsUrl: 'https://github.com/ueberdosis/tiptap-markdown',
      recommended: true,
    },
    messages: {
      missingMarkdownNodeSpec:
        'This TipTap node is used alongside tiptap-markdown but defines no markdown serialization. Nodes without a markdown spec are silently dropped on export. Add a MarkdownNodeSpec to addStorage or addOptions.',
    },
    schema: [],
  },
  create(context: any) {
    let importsTiptapCore = false;
    let importsTiptapMarkdown = false;
    const nodeCreateCalls: any[] = [];

    function hasMarkdownSpec(configObj: any): boolean {
      if (configObj?.type !== 'ObjectExpression') return false;
      // Check for any property key named "markdown" anywhere in the config
      let found = false;
      walk(configObj, (node: any) => {
        if (found) return false;
        if (node?.type === 'Property') {
          const keyName =
            node.key?.type === 'Identifier'
              ? node.key.name
              : node.key?.type === 'Literal'
              ? String(node.key.value)
              : null;
          if (keyName === 'markdown') {
            found = true;
            return false;
          }
        }
        // Also look for MarkdownNodeSpec identifier reference
        if (node?.type === 'Identifier' && node.name === 'MarkdownNodeSpec') {
          found = true;
          return false;
        }
      });
      return found;
    }

    return {
      ImportDeclaration(node: any) {
        const src: string = node?.source?.value ?? '';
        if (src.startsWith('@tiptap/core')) importsTiptapCore = true;
        if (src === 'tiptap-markdown' || src === '@tiptap/extension-markdown') {
          importsTiptapMarkdown = true;
        }
      },

      CallExpression(node: any) {
        if (
          node.callee?.type === 'MemberExpression' &&
          node.callee.property?.name === 'create'
        ) {
          const configArg = node.arguments?.[0];
          if (configArg?.type === 'ObjectExpression') {
            nodeCreateCalls.push({ callNode: node, configObj: configArg });
          }
        }
      },

      // Also check for MarkdownNodeSpec at program level
      'Program:exit'() {
        if (!importsTiptapCore || !importsTiptapMarkdown) return;

        for (const { callNode, configObj } of nodeCreateCalls) {
          if (!hasMarkdownSpec(configObj)) {
            context.report({ node: callNode, messageId: 'missingMarkdownNodeSpec' });
          }
        }
      },
    };
  },
};

export const tiptapTiptapMarkdownMissingNodeSpecRule = rule;
export default rule;
