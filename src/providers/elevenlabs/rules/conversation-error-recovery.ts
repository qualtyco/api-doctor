/**
 * Flags an async conversation-start function that sets a loading flag true
 * before a try block, but whose catch/finally never resets it to false —
 * leaving the UI stuck in a loading state after a failed attempt and
 * allowing rapid repeated clicks to spawn overlapping attempts (Finding F).
 */
const rule = {
  meta: {
    type: 'suggestion',
    docs: {
      description: 'A loading flag set before starting a conversation must be reset on failure',
      category: 'reliability',
      rationale:
        'If startConversation() sets isLoading true and getSignedUrl()/Conversation.startSession() throws, the loading flag must be reset in the catch or finally block. Otherwise the UI is stuck "loading" forever and the user can trigger overlapping conversation attempts by clicking again.',
      docsUrl: 'https://elevenlabs.io/docs/eleven-agents/libraries/java-script',
      recommended: true,
    },
    messages: {
      missingLoadingReset:
        'This function sets a loading flag true before a try block, but neither the catch nor a finally block resets it to false on failure.',
    },
  },
  create(context: any) {
    function isSetterCallWithBoolean(n: any, setterName: string, expected: boolean): boolean {
      if (n?.type !== 'CallExpression') return false;
      if (n.callee?.type !== 'Identifier' || n.callee.name !== setterName) return false;
      const arg = n.arguments?.[0];
      return arg?.type === 'Literal' && arg.value === expected;
    }

    function containsCall(node: any, predicate: (n: any) => boolean, depth = 0): boolean {
      if (!node || typeof node !== 'object' || depth > 20) return false;
      if (Array.isArray(node)) return node.some((n) => containsCall(n, predicate, depth + 1));
      if (predicate(node)) return true;
      for (const key of Object.keys(node)) {
        if (key === 'parent' || key === 'loc' || key === 'range') continue;
        const val = node[key];
        if (val && typeof val === 'object' && containsCall(val, predicate, depth + 1)) return true;
      }
      return false;
    }

    function findLoadingSetterFromUseState(fnNode: any): string | null {
      let setterName: string | null = null;

      function collect(n: any, depth = 0): void {
        if (setterName || !n || typeof n !== 'object' || depth > 20) return;
        if (Array.isArray(n)) {
          for (const item of n) collect(item, depth + 1);
          return;
        }
        if (
          n.type === 'VariableDeclarator' &&
          n.id?.type === 'ArrayPattern' &&
          n.id.elements?.length === 2 &&
          n.id.elements[0]?.type === 'Identifier' &&
          /loading/i.test(n.id.elements[0].name) &&
          n.id.elements[1]?.type === 'Identifier' &&
          n.init?.type === 'CallExpression' &&
          n.init.callee?.type === 'Identifier' &&
          n.init.callee.name === 'useState'
        ) {
          setterName = n.id.elements[1].name;
          return;
        }
        for (const key of Object.keys(n)) {
          if (key === 'parent' || key === 'loc' || key === 'range') continue;
          const val = n[key];
          if (val && typeof val === 'object') collect(val, depth + 1);
        }
      }
      collect(fnNode);
      return setterName;
    }

    function isLoadingTrueStatement(stmt: any, setterName: string): boolean {
      return stmt?.type === 'ExpressionStatement' && isSetterCallWithBoolean(stmt.expression, setterName, true);
    }

    function analyzeFunction(fnNode: any): void {
      const setterName = findLoadingSetterFromUseState(fnNode);
      if (!setterName) return;

      // Only the try block immediately following a `setLoading(true)` sibling
      // statement is in scope — a stray setLoading(true) elsewhere in the
      // function must not implicate every unrelated try block.
      function walk(n: any, depth = 0): void {
        if (!n || typeof n !== 'object' || depth > 30) return;
        if (Array.isArray(n)) {
          for (const item of n) walk(item, depth + 1);
          return;
        }
        if (n.type === 'BlockStatement' && Array.isArray(n.body)) {
          for (let i = 0; i < n.body.length - 1; i++) {
            if (!isLoadingTrueStatement(n.body[i], setterName)) continue;
            const tryNode = n.body[i + 1];
            if (tryNode?.type !== 'TryStatement') continue;

            const handler = tryNode.handler;
            const finalizer = tryNode.finalizer;
            const finallyResets =
              finalizer && containsCall(finalizer, (x) => isSetterCallWithBoolean(x, setterName, false));
            const catchResets =
              handler && containsCall(handler.body, (x) => isSetterCallWithBoolean(x, setterName, false));

            if (!finallyResets && !catchResets) {
              context.report({ node: tryNode, messageId: 'missingLoadingReset' });
            }
          }
        }
        for (const key of Object.keys(n)) {
          if (key === 'parent' || key === 'loc' || key === 'range') continue;
          const val = n[key];
          if (val && typeof val === 'object') walk(val, depth + 1);
        }
      }
      walk(fnNode.body);
    }

    return {
      FunctionDeclaration(node: any) {
        analyzeFunction(node);
      },
      FunctionExpression(node: any) {
        analyzeFunction(node);
      },
      ArrowFunctionExpression(node: any) {
        analyzeFunction(node);
      },
    };
  },
};

export const elevenlabsConversationErrorRecoveryRule = rule;
