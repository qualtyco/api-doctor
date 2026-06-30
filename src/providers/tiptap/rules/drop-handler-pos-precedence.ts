/**
 * tiptap-drop-handler-pos-precedence (correctness)
 *
 * Detects the operator-precedence bug `x ?? 0 - 1` which parses as
 * `x ?? (0 - 1)` = `x ?? -1` because `-` has higher precedence than `??`.
 *
 * The intended expression is `(x ?? 0) - 1`.
 *
 * AST shape of `x ?? 0 - 1`:
 *   LogicalExpression(??)
 *     left: x
 *     right: BinaryExpression(-)
 *               left: Literal(0)
 *               right: Literal(1)
 */

const rule = {
  meta: {
    type: 'problem',
    docs: {
      description: 'x ?? 0 - 1 is parsed as x ?? (0 - 1) = x ?? -1 due to operator precedence',
      category: 'correctness',
      rationale:
        'The nullish coalescing operator (??) has lower precedence than arithmetic operators. Writing `pos ?? 0 - 1` evaluates as `pos ?? -1`, not `(pos ?? 0) - 1`. When pos is null or undefined, the fallback is -1 instead of the intended -1 offset from 0. In ProseMirror drop handlers this produces a decoration at position -1, which corrupts the placeholder position map and can insert content at the document start.',
      docsUrl: 'https://prosemirror.net/docs/ref/#view.EditorView.posAtCoords',
      recommended: true,
    },
    messages: {
      posNullCoalescePrecedence:
        'Operator precedence bug: "x ?? 0 - 1" is parsed as "x ?? (0 - 1)" = "x ?? -1". Wrap the intended expression: "(x ?? 0) - 1".',
    },
    schema: [],
  },
  create(context: any) {
    return {
      LogicalExpression(node: any) {
        if (node.operator !== '??') return;
        const right = node.right;
        if (
          right?.type === 'BinaryExpression' &&
          right.operator === '-' &&
          right.left?.type === 'Literal' &&
          right.left.value === 0 &&
          right.right?.type === 'Literal' &&
          right.right.value === 1
        ) {
          context.report({ node, messageId: 'posNullCoalescePrecedence' });
        }
      },
    };
  },
};

export const tiptapDropHandlerPosPrecedenceRule = rule;
export default rule;
