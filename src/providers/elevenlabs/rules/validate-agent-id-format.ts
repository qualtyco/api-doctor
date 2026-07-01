/**
 * Flags an `agentId` query-param value that is checked for existence but
 * never validated against an expected format before being used in an
 * ElevenLabs API URL (CWE-20, Finding D).
 */
import { isElevenLabsUrlArg, unwrapAwait, collectVarDeclarators, posOf } from '../utils.js';

const rule = {
  meta: {
    type: 'problem',
    docs: {
      description: 'agentId must be format-validated, not just checked for existence, before use',
      category: 'correctness',
      cwe: 'CWE-20',
      rationale:
        'A query-param agentId that is only checked with `if (!agentId)` accepts any non-empty string. An attacker can pass arbitrary values — oversized strings, path-traversal-like sequences, or characters the ElevenLabs API was never designed to receive — directly into the request URL, producing undefined behavior instead of a clean 400.',
      docsUrl: 'https://elevenlabs.io/docs/eleven-agents/customization/authentication',
      recommended: true,
    },
    messages: {
      missingFormatValidation:
        'agentId is checked for existence but never validated against an expected format before being used in an ElevenLabs API request.',
    },
  },
  create(context: any) {
    function isSearchParamsGetAgentId(node: any): boolean {
      if (node?.type !== 'CallExpression') return false;
      const callee = node.callee;
      if (callee?.type !== 'MemberExpression') return false;
      if (callee.property?.type !== 'Identifier' || callee.property.name !== 'get') return false;
      const arg = node.arguments?.[0];
      return arg?.type === 'Literal' && arg.value === 'agentId';
    }

    function analyzeFunction(fnNode: any): void {
      const declarators: any[] = [];
      collectVarDeclarators(fnNode.body, declarators);

      let agentIdVarName: string | null = null;
      let agentIdDeclaratorNode: any = null;
      for (const d of declarators) {
        const init = unwrapAwait(d.init);
        if (isSearchParamsGetAgentId(init) && d.id?.type === 'Identifier') {
          agentIdVarName = d.id.name;
          agentIdDeclaratorNode = d;
        }
      }

      // A parameter literally named `agentId` is treated the same way —
      // callers may have sourced it from a query param a level up.
      if (!agentIdVarName) {
        for (const param of fnNode.params ?? []) {
          if (param?.type === 'Identifier' && param.name === 'agentId') {
            agentIdVarName = param.name;
            agentIdDeclaratorNode = param;
          }
        }
      }
      if (!agentIdVarName) return;

      function isAgentIdMember(n: any): boolean {
        return n?.type === 'Identifier' && n.name === agentIdVarName;
      }

      // A regex-based format check: agentId.match(/.../)  or /.../.test(agentId)
      function isFormatCheck(n: any, depth = 0): boolean {
        if (!n || typeof n !== 'object' || depth > 10) return false;
        if (Array.isArray(n)) return n.some((x) => isFormatCheck(x, depth + 1));
        if (n.type === 'CallExpression' && n.callee?.type === 'MemberExpression') {
          const propName = n.callee.property?.type === 'Identifier' ? n.callee.property.name : null;
          if (propName === 'test' && isAgentIdMember(n.arguments?.[0])) return true;
          if ((propName === 'match' || propName === 'matchAll') && isAgentIdMember(n.callee.object)) return true;
        }
        if (n.type === 'LogicalExpression') {
          return isFormatCheck(n.left, depth + 1) || isFormatCheck(n.right, depth + 1);
        }
        if (n.type === 'UnaryExpression') return isFormatCheck(n.argument, depth + 1);
        return false;
      }

      let formatGuardPos: number | null = null;
      let usagePos: number | null = null;

      function walk(n: any, depth = 0): void {
        if (!n || typeof n !== 'object' || depth > 40) return;
        if (Array.isArray(n)) {
          for (const item of n) walk(item, depth + 1);
          return;
        }
        if (n.type === 'IfStatement' && isFormatCheck(n.test)) {
          const p = posOf(n);
          if (formatGuardPos === null || p < formatGuardPos) formatGuardPos = p;
        }
        // Usage: agentId used inside a fetch() URL targeting the ElevenLabs API.
        if (
          n.type === 'CallExpression' &&
          n.callee?.type === 'Identifier' &&
          n.callee.name === 'fetch' &&
          isElevenLabsUrlArg(n.arguments?.[0])
        ) {
          const urlArg = n.arguments[0];
          const containsAgentId =
            urlArg.type === 'TemplateLiteral' &&
            (urlArg.expressions ?? []).some((e: any) => isAgentIdMember(e));
          if (containsAgentId) {
            const p = posOf(n);
            if (usagePos === null || p < usagePos) usagePos = p;
          }
        }
        for (const key of Object.keys(n)) {
          if (key === 'parent' || key === 'loc' || key === 'range') continue;
          const val = n[key];
          if (val && typeof val === 'object') walk(val, depth + 1);
        }
      }
      walk(fnNode.body);

      if (usagePos === null) return;
      if (formatGuardPos !== null && formatGuardPos < usagePos) return;

      context.report({ node: agentIdDeclaratorNode, messageId: 'missingFormatValidation' });
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

export const elevenlabsValidateAgentIdFormatRule = rule;
