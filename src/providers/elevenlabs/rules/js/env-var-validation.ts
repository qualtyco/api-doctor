/**
 * Flags a module that reads process.env.XI_API_KEY (or similar ElevenLabs
 * env vars) only inside a request handler, with no module-scope assertion
 * that the variable exists — so a missing key only surfaces when a user
 * first hits the feature instead of at startup (Finding J).
 */
const ELEVENLABS_ENV_VAR_PATTERN = /^(XI_API_KEY|ELEVENLABS_API_KEY)$/;

const rule = {
  meta: {
    type: 'suggestion',
    docs: {
      description: 'ElevenLabs API key environment variables should be validated at module load, not only at request time',
      category: 'correctness',
      rationale:
        'Checking `if (!apiKey)` inside a request handler means a misconfigured deployment only fails the first time a user exercises the feature, instead of failing fast at startup where it would show up in deploy logs or a health check.',
      docsUrl: 'https://elevenlabs.io/docs/api-reference/authentication',
      recommended: true,
    },
    messages: {
      missingStartupValidation:
        'This module reads an ElevenLabs API key from process.env but only validates it inside a request handler — validate it at module scope so a missing key fails at startup, not at first use.',
    },
  },
  create(context: any) {
    function isElevenLabsEnvAccess(node: any): boolean {
      if (node?.type !== 'MemberExpression') return false;
      if (node.object?.type !== 'MemberExpression') return false;
      const inner = node.object;
      if (inner.object?.type !== 'Identifier' || inner.object.name !== 'process') return false;
      if (inner.property?.type !== 'Identifier' || inner.property.name !== 'env') return false;
      const propName = node.property?.type === 'Identifier' ? node.property.name : node.property?.value;
      return typeof propName === 'string' && ELEVENLABS_ENV_VAR_PATTERN.test(propName);
    }

    function isInsideFunction(node: any, ancestors: any[]): boolean {
      return ancestors.some(
        (a: any) =>
          a?.type === 'FunctionDeclaration' || a?.type === 'FunctionExpression' || a?.type === 'ArrowFunctionExpression',
      );
    }

    return {
      'Program:exit'(program: any) {
        let moduleScopeAccess = false;
        let handlerScopeAccess = false;

        function walk(n: any, ancestors: any[], depth = 0): void {
          if (!n || typeof n !== 'object' || depth > 60) return;
          if (Array.isArray(n)) {
            for (const item of n) walk(item, ancestors, depth + 1);
            return;
          }
          if (isElevenLabsEnvAccess(n)) {
            if (isInsideFunction(n, ancestors)) {
              handlerScopeAccess = true;
            } else {
              moduleScopeAccess = true;
            }
          }
          const nextAncestors =
            n.type === 'FunctionDeclaration' || n.type === 'FunctionExpression' || n.type === 'ArrowFunctionExpression'
              ? [...ancestors, n]
              : ancestors;
          for (const key of Object.keys(n)) {
            if (key === 'parent' || key === 'loc' || key === 'range') continue;
            const val = n[key];
            if (val && typeof val === 'object') walk(val, nextAncestors, depth + 1);
          }
        }
        walk(program, []);

        if (handlerScopeAccess && !moduleScopeAccess) {
          context.report({ node: program, messageId: 'missingStartupValidation' });
        }
      },
    };
  },
};

export const elevenlabsEnvVarValidationRule = rule;
