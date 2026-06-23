/**
 * Flags a `.filter()` over a safety-checks array whose callback never
 * references `.code` or `.message` — i.e. it acknowledges every check
 * present instead of evaluating each one against a policy.
 */
const rule = {
  meta: {
    type: 'suggestion',
    docs: {
      description: 'Acknowledging pending safety checks must evaluate each check, not blanket-pass them',
      category: 'correctness',
      rationale:
        '`acknowledged_safety_checks` exists specifically so a developer can selectively confirm checks they have actually reviewed — each entry carries an id/code/message. A filter that only checks the row\'s shape (e.g. that it is an object) and never inspects `.code` or `.message` acknowledges every check present, defeating the purpose of the field entirely.',
      docsUrl: 'https://developers.openai.com/api/docs/guides/tools-computer-use',
      recommended: true,
    },
    messages: {
      blindAck:
        'This filter never inspects .code or .message on each safety check — it acknowledges every check present instead of evaluating it against a policy.',
    },
  },
  create(context: any) {
    function propName(node: any): string | undefined {
      if (!node) return undefined;
      if (node.type === 'Identifier') return node.name;
      if (node.type === 'Literal' && typeof node.value === 'string') return node.value;
      return undefined;
    }

    function sourceLooksLikeSafetyChecks(node: any): boolean {
      if (!node) return false;
      const name = propName(node) ?? (node.type === 'MemberExpression' ? propName(node.property) : undefined);
      if (name && /safety.?check/i.test(name)) return true;
      if (node.type === 'LogicalExpression') {
        return sourceLooksLikeSafetyChecks(node.left) || sourceLooksLikeSafetyChecks(node.right);
      }
      if (node.type === 'MemberExpression') {
        return sourceLooksLikeSafetyChecks(node.object) || sourceLooksLikeSafetyChecks(node.property);
      }
      return false;
    }

    function referencesCodeOrMessage(node: any, depth = 0): boolean {
      if (!node || typeof node !== 'object' || depth > 10) return false;
      if (Array.isArray(node)) return node.some((n) => referencesCodeOrMessage(n, depth + 1));
      if (node.type === 'MemberExpression') {
        const name = propName(node.property);
        if (name === 'code' || name === 'message') return true;
      }
      for (const key of Object.keys(node)) {
        if (key === 'parent' || key === 'loc' || key === 'range') continue;
        const val = (node as any)[key];
        if (val && typeof val === 'object') {
          if (referencesCodeOrMessage(val, depth + 1)) return true;
        }
      }
      return false;
    }

    return {
      CallExpression(node: any) {
        const callee = node.callee;
        if (callee?.type !== 'MemberExpression' || callee.property?.name !== 'filter') return;
        if (!sourceLooksLikeSafetyChecks(callee.object)) return;

        const fn = node.arguments?.[0];
        if (fn?.type !== 'ArrowFunctionExpression' && fn?.type !== 'FunctionExpression') return;

        if (!referencesCodeOrMessage(fn.body)) {
          context.report({ node, messageId: 'blindAck' });
        }
      },
    };
  },
};

export const openaiCuaNoBlindSafetyCheckAckRule = rule;
