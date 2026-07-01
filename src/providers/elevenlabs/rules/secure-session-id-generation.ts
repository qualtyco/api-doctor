/**
 * Flags `Math.random()` used to build a session-id-like value (CWE-338,
 * Finding E). Math.random() is not cryptographically secure and predictable
 * session ids can allow unauthorized access if used for access control.
 */
const rule = {
  meta: {
    type: 'problem',
    docs: {
      description: 'Session ids must be generated with a cryptographically secure RNG',
      category: 'security',
      cwe: 'CWE-338',
      rationale:
        'Math.random() is a non-cryptographic PRNG — its output can be predicted by an attacker who observes enough samples or knows the engine implementation. If a "session_*" value derived from it is later trusted for routing, deduplication, or any access-control-adjacent decision, that predictability can be exploited.',
      docsUrl: 'https://elevenlabs.io/docs/eleven-api/guides/how-to/best-practices/security',
      recommended: true,
    },
    messages: {
      insecureSessionId:
        'This session id is generated with Math.random(), which is not cryptographically secure and can be predicted. Use crypto.getRandomValues() instead.',
    },
  },
  create(context: any) {
    function containsMathRandomCall(node: any, depth = 0): boolean {
      if (!node || typeof node !== 'object' || depth > 20) return false;
      if (Array.isArray(node)) return node.some((n) => containsMathRandomCall(n, depth + 1));
      if (
        node.type === 'CallExpression' &&
        node.callee?.type === 'MemberExpression' &&
        node.callee.object?.type === 'Identifier' &&
        node.callee.object.name === 'Math' &&
        node.callee.property?.type === 'Identifier' &&
        node.callee.property.name === 'random'
      ) {
        return true;
      }
      for (const key of Object.keys(node)) {
        if (key === 'parent' || key === 'loc' || key === 'range') continue;
        const val = node[key];
        if (val && typeof val === 'object' && containsMathRandomCall(val, depth + 1)) return true;
      }
      return false;
    }

    function looksLikeSessionId(name: string | undefined): boolean {
      return typeof name === 'string' && /session/i.test(name);
    }

    function isSessionIdValue(init: any): boolean {
      // `session_${...Math.random()...}` or `'session_' + ... Math.random() ...`
      if (init?.type === 'TemplateLiteral') {
        const firstQuasi = init.quasis?.[0]?.value?.raw ?? '';
        if (/session[-_]?/i.test(firstQuasi) && containsMathRandomCall(init)) return true;
      }
      if (init?.type === 'BinaryExpression' && init.operator === '+') {
        const leftLiteral = init.left?.type === 'Literal' && typeof init.left.value === 'string';
        if (leftLiteral && /session[-_]?/i.test(init.left.value) && containsMathRandomCall(init)) return true;
      }
      return false;
    }

    return {
      VariableDeclarator(node: any) {
        const init = node.init;
        if (!init) return;

        const declaredName =
          node.id?.type === 'Identifier'
            ? node.id.name
            : node.id?.type === 'ArrayPattern' && node.id.elements?.[0]?.type === 'Identifier'
              ? node.id.elements[0].name
              : undefined;

        // `useState(() => ...)` form: the random expression lives in the callback's return.
        let valueNode = init;
        if (
          init.type === 'CallExpression' &&
          init.callee?.type === 'Identifier' &&
          init.callee.name === 'useState' &&
          init.arguments?.[0]?.type === 'ArrowFunctionExpression'
        ) {
          const body = init.arguments[0].body;
          valueNode = body?.type === 'BlockStatement' ? null : body;
          if (body?.type === 'BlockStatement') {
            const returnStmt = (body.body ?? []).find((s: any) => s.type === 'ReturnStatement');
            valueNode = returnStmt?.argument ?? null;
          }
        }

        if (!valueNode) return;
        if (!looksLikeSessionId(declaredName) && !isSessionIdValue(valueNode)) return;
        if (!containsMathRandomCall(valueNode)) return;

        context.report({ node, messageId: 'insecureSessionId' });
      },
    };
  },
};

export const elevenlabsSecureSessionIdGenerationRule = rule;
