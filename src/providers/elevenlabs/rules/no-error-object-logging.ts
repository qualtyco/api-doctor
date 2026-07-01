/**
 * Flags console.error/warn/log calls in a catch block that pass the raw
 * caught error object instead of a sanitized message (CWE-532, Finding B).
 */
import { findElevenLabsFetchCall } from '../utils.js';

const LOGGING_METHODS = new Set(['error', 'warn', 'log']);

const rule = {
  meta: {
    type: 'problem',
    docs: {
      description: 'Catch blocks must not log the raw caught error object',
      category: 'security',
      cwe: 'CWE-532',
      rationale:
        'Error objects thrown by fetch/SDK calls can carry response bodies, headers, or internal state. Logging them directly with console.error(error) writes that data verbatim into server logs, which may be shipped to third-party log aggregators or be readable by anyone with log access.',
      docsUrl: 'https://elevenlabs.io/docs/api-reference/authentication',
      recommended: true,
    },
    messages: {
      rawErrorLogged:
        'This catch block logs the raw error object instead of a sanitized message — error responses, headers, or internal state may leak into server logs.',
    },
  },
  create(context: any) {
    function isConsoleLogCall(node: any): boolean {
      if (node?.type !== 'CallExpression') return false;
      const callee = node.callee;
      if (callee?.type !== 'MemberExpression') return false;
      if (callee.object?.type !== 'Identifier' || callee.object.name !== 'console') return false;
      return callee.property?.type === 'Identifier' && LOGGING_METHODS.has(callee.property.name);
    }

    function referencesRawIdentifier(node: any, paramName: string, depth = 0): boolean {
      if (!node || typeof node !== 'object' || depth > 10) return false;
      if (Array.isArray(node)) return node.some((n) => referencesRawIdentifier(n, paramName, depth + 1));

      // The bare identifier itself: console.error('msg', error)
      if (node.type === 'Identifier' && node.name === paramName) return true;

      // A property whose value is the bare identifier: console.error({ error })
      if (node.type === 'ObjectExpression') {
        return (node.properties ?? []).some((p: any) => {
          if (p.type !== 'Property') return false;
          return referencesRawIdentifier(p.value, paramName, depth + 1);
        });
      }

      if (node.type === 'ArrayExpression') {
        return (node.elements ?? []).some((el: any) => referencesRawIdentifier(el, paramName, depth + 1));
      }

      return false;
    }

    return {
      TryStatement(node: any) {
        if (!findElevenLabsFetchCall(node.block)) return;

        const handler = node.handler;
        const paramName = handler?.param?.type === 'Identifier' ? handler.param.name : null;
        if (!paramName) return;

        function walk(n: any, depth = 0): void {
          if (!n || typeof n !== 'object' || depth > 30) return;
          if (Array.isArray(n)) {
            for (const item of n) walk(item, depth + 1);
            return;
          }
          if (isConsoleLogCall(n)) {
            const args = n.arguments ?? [];
            const loggedRaw = args.some((a: any) => referencesRawIdentifier(a, paramName));
            if (loggedRaw) {
              context.report({ node: n, messageId: 'rawErrorLogged' });
            }
          }
          for (const key of Object.keys(n)) {
            if (key === 'parent' || key === 'loc' || key === 'range') continue;
            const val = n[key];
            if (val && typeof val === 'object') walk(val, depth + 1);
          }
        }

        walk(handler.body);
      },
    };
  },
};

export const elevenlabsNoErrorObjectLoggingRule = rule;
