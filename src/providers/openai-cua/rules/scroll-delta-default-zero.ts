/**
 * Flags a missing vertical scroll delta (dy/deltaY/scrollY) being defaulted
 * to a non-zero literal instead of 0 — OpenAI's own reference scroll
 * handler defaults both axes to 0 when the model omits one.
 */
const VERTICAL_DELTA_NAME_PATTERN = /^(dy|delta_?y|scroll_?y)$/i;

const rule = {
  meta: {
    type: 'problem',
    docs: {
      description: 'A missing vertical scroll delta must default to 0, not an arbitrary non-zero value',
      category: 'correctness',
      rationale:
        "The reference scroll handler in OpenAI's Computer Use guide defaults a missing scroll delta to 0 on both axes. Defaulting the vertical delta to any other value injects an unintended scroll the model never asked for whenever it omits that field, desyncing the model's mental model of the page from the page's actual state on the next turn.",
      docsUrl: 'https://developers.openai.com/api/docs/guides/tools-computer-use',
      recommended: true,
    },
    messages: {
      nonZeroDefault:
        'A missing vertical scroll delta defaults to {{value}} here instead of 0, injecting an unintended scroll the model never requested.',
    },
  },
  create(context: any) {
    function propName(node: any): string | undefined {
      if (!node) return undefined;
      if (node.type === 'Identifier') return node.name;
      if (node.type === 'Literal' && typeof node.value === 'string') return node.value;
      return undefined;
    }

    function targetName(node: any): string | undefined {
      if (node?.type === 'Identifier') return node.name;
      if (node?.type === 'MemberExpression') return propName(node.property);
      return undefined;
    }

    function isNonZeroNumberLiteral(node: any): boolean {
      return node?.type === 'Literal' && typeof node.value === 'number' && node.value !== 0;
    }

    function reportIfBadDefault(targetNode: any, valueNode: any, reportNode: any) {
      const name = targetName(targetNode);
      if (!name || !VERTICAL_DELTA_NAME_PATTERN.test(name)) return;
      if (!isNonZeroNumberLiteral(valueNode)) return;
      context.report({ node: reportNode, messageId: 'nonZeroDefault', data: { value: String(valueNode.value) } });
    }

    function findDirectAssignment(stmt: any): { target: any; value: any } | undefined {
      let inner = stmt;
      if (inner?.type === 'BlockStatement') {
        const exprStmts = (inner.body ?? []).filter((s: any) => s.type === 'ExpressionStatement');
        if (exprStmts.length !== 1) return undefined;
        inner = exprStmts[0];
      }
      if (inner?.type !== 'ExpressionStatement') return undefined;
      const expr = inner.expression;
      if (expr?.type !== 'AssignmentExpression' || expr.operator !== '=') return undefined;
      return { target: expr.left, value: expr.right };
    }

    function undefinedCheckTargetName(test: any): string | undefined {
      if (test?.type !== 'BinaryExpression') return undefined;
      if (test.operator !== '===' && test.operator !== '==') return undefined;
      const sides = [test.left, test.right];
      const undefinedSide = sides.find(
        (s) =>
          (s?.type === 'Identifier' && s.name === 'undefined') ||
          (s?.type === 'Literal' && s.value === null) ||
          (s?.type === 'UnaryExpression' && s.operator === 'typeof'),
      );
      const otherSide = sides.find((s) => s !== undefinedSide);
      if (!undefinedSide || !otherSide) return undefined;
      if (undefinedSide.type === 'UnaryExpression') {
        return targetName(undefinedSide.argument);
      }
      return targetName(otherSide);
    }

    return {
      LogicalExpression(node: any) {
        if (node.operator !== '??') return;
        reportIfBadDefault(node.left, node.right, node);
      },

      IfStatement(node: any) {
        const name = undefinedCheckTargetName(node.test);
        if (!name) return;
        const assignment = findDirectAssignment(node.consequent);
        if (!assignment) return;
        reportIfBadDefault(assignment.target, assignment.value, node);
      },
    };
  },
};

export const openaiCuaScrollDeltaDefaultZeroRule = rule;
