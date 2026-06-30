/**
 * tiptap-appendTransaction-add-to-history (correctness)
 *
 * Detects `appendTransaction` callbacks that mutate the transaction without
 * calling `tr.setMeta("addToHistory", false)`. Without this annotation,
 * auto-corrections end up in the undo history and fight user undo.
 */
import { walk } from '../utils.js';

const rule = {
  meta: {
    type: 'suggestion',
    docs: {
      description: 'appendTransaction mutations must include tr.setMeta("addToHistory", false)',
      category: 'correctness',
      rationale:
        'ProseMirror records every transaction dispatched by appendTransaction into the undo history unless it is annotated with setMeta("addToHistory", false). When an auto-correction (e.g. inserting a space into an empty node) is recorded, pressing Ctrl-Z undoes the correction and re-enters the broken state, which the plugin immediately re-corrects — the undo and redo keys fight each other.',
      docsUrl: 'https://prosemirror.net/docs/ref/#state.Transaction.setMeta',
      recommended: true,
    },
    messages: {
      missingAddToHistory:
        'appendTransaction mutates the transaction without setMeta("addToHistory", false). This pollutes the undo stack. Add tr.setMeta("addToHistory", false) to the transaction.',
    },
    schema: [],
  },
  create(context: any) {
    function hasAddToHistoryMeta(fnBody: any): boolean {
      let found = false;
      walk(fnBody, (node: any) => {
        if (found) return false;
        if (node?.type !== 'CallExpression') return;
        const callee = node.callee;
        if (callee?.type !== 'MemberExpression') return;
        if (callee.property?.name !== 'setMeta') return;
        const firstArg = node.arguments?.[0];
        if (firstArg?.type === 'Literal' && firstArg.value === 'addToHistory') {
          found = true;
        }
      });
      return found;
    }

    function hasMutation(fnBody: any): boolean {
      const mutatingMethods = new Set([
        'insert', 'insertText', 'replace', 'replaceWith', 'replaceRange',
        'replaceRangeWith', 'delete', 'deleteRange', 'addMark', 'removeMark',
        'setNodeMarkup', 'setNodeAttribute', 'setDocAttribute',
      ]);
      let found = false;
      walk(fnBody, (node: any) => {
        if (found) return false;
        if (node?.type !== 'CallExpression') return;
        const callee = node.callee;
        if (callee?.type !== 'MemberExpression') return;
        const methodName = callee.property?.name;
        if (methodName && mutatingMethods.has(methodName)) {
          found = true;
        }
      });
      return found;
    }

    function checkAppendTransactionFn(fn: any, reportNode: any): void {
      const body = fn?.body;
      if (!body) return;
      if (hasMutation(body) && !hasAddToHistoryMeta(body)) {
        context.report({ node: reportNode, messageId: 'missingAddToHistory' });
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

export const tiptapAppendTransactionAddToHistoryRule = rule;
export default rule;
