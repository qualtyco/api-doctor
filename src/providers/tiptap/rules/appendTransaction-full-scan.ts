/**
 * tiptap-appendTransaction-full-scan (reliability)
 *
 * Detects `appendTransaction` callbacks that call `doc.descendants(...)` on
 * every transaction without first checking whether the document changed.
 * O(n) per keystroke is avoidable with a simple docChanged guard.
 */
import { walk } from '../utils.js';

const rule = {
  meta: {
    type: 'suggestion',
    docs: {
      description: 'appendTransaction must guard doc.descendants() with a docChanged check',
      category: 'reliability',
      rationale:
        'doc.descendants() visits every node in the document on every transaction — every keystroke, selection change, and formatting toggle. For documents with many nodes this is O(n) per transaction and causes visible input latency. ProseMirror provides the docChanged flag precisely to avoid this work when the document structure has not changed.',
      docsUrl: 'https://prosemirror.net/docs/ref/#state.PluginSpec.appendTransaction',
      recommended: true,
    },
    messages: {
      fullScanOnEveryTransaction:
        'appendTransaction calls doc.descendants() on every transaction. Check docChanged first: const docChanged = transactions.some(tr => tr.docChanged); if (!docChanged) return;',
    },
    schema: [],
  },
  create(context: any) {
    function hasDocChangedGuard(fnBody: any): boolean {
      let found = false;
      walk(fnBody, (node: any) => {
        if (found) return false;
        // Look for tr.docChanged or transactions.some(tr => tr.docChanged) or docChanged identifier used as condition
        if (
          node?.type === 'MemberExpression' &&
          node.property?.name === 'docChanged'
        ) {
          found = true;
          return false;
        }
        // Also look for if (!docChanged) return; pattern
        if (
          node?.type === 'Identifier' &&
          node.name === 'docChanged'
        ) {
          found = true;
          return false;
        }
      });
      return found;
    }

    function hasDescendantsCall(fnBody: any): boolean {
      let found = false;
      walk(fnBody, (node: any) => {
        if (found) return false;
        if (
          node?.type === 'CallExpression' &&
          node.callee?.type === 'MemberExpression' &&
          node.callee.property?.name === 'descendants'
        ) {
          found = true;
        }
      });
      return found;
    }

    function checkAppendTransactionFn(fn: any, reportNode: any): void {
      const body = fn?.body;
      if (!body) return;
      if (hasDescendantsCall(body) && !hasDocChangedGuard(body)) {
        context.report({ node: reportNode, messageId: 'fullScanOnEveryTransaction' });
      }
    }

    return {
      Property(node: any) {
        const keyName =
          node.key?.type === 'Identifier'
            ? node.key.name
            : node.key?.type === 'Literal'
            ? node.key.value
            : null;
        if (keyName !== 'appendTransaction') return;

        const val = node.value;
        if (
          val?.type === 'FunctionExpression' ||
          val?.type === 'ArrowFunctionExpression'
        ) {
          checkAppendTransactionFn(val, node);
        }
      },
    };
  },
};

export const tiptapAppendTransactionFullScanRule = rule;
export default rule;
