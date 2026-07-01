/**
 * Flags code that reads `signed_url` off a parsed ElevenLabs API response
 * without first checking the field is present (CWE-252, Finding A).
 */
import { isElevenLabsUrlArg, unwrapAwait, collectVarDeclarators, posOf } from '../utils.js';

const rule = {
  meta: {
    type: 'problem',
    docs: {
      description:
        'ElevenLabs signed URL responses must be validated before the signed_url field is used',
      category: 'correctness',
      cwe: 'CWE-252',
      rationale:
        'The signed-url endpoint assumes the ElevenLabs API always returns a well-formed body. If the API ever returns an unexpected shape (error payload, empty body, schema change), `data.signed_url` is silently `undefined` and the failure only surfaces downstream when the client tries to connect with an invalid URL.',
      docsUrl: 'https://elevenlabs.io/docs/eleven-agents/api-reference/conversations/get-signed-url',
      recommended: true,
    },
    messages: {
      missingValidation:
        'This code reads signed_url from the ElevenLabs API response without checking that the field exists. A malformed or unexpected response will silently produce an undefined signed URL.',
    },
  },
  create(context: any) {
    function analyzeFunction(fnNode: any): void {
      const declarators: any[] = [];
      collectVarDeclarators(fnNode.body, declarators);

      const responseVarNames: string[] = [];
      for (const d of declarators) {
        const init = unwrapAwait(d.init);
        if (
          init?.type === 'CallExpression' &&
          init.callee?.type === 'Identifier' &&
          init.callee.name === 'fetch' &&
          isElevenLabsUrlArg(init.arguments?.[0]) &&
          d.id?.type === 'Identifier'
        ) {
          responseVarNames.push(d.id.name);
        }
      }
      if (responseVarNames.length === 0) return;

      for (const responseVarName of responseVarNames) {
        for (const d of declarators) {
          const init = unwrapAwait(d.init);
          if (
            init?.type === 'CallExpression' &&
            init.callee?.type === 'MemberExpression' &&
            init.callee.property?.type === 'Identifier' &&
            init.callee.property.name === 'json' &&
            init.callee.object?.type === 'Identifier' &&
            init.callee.object.name === responseVarName &&
            d.id?.type === 'Identifier'
          ) {
            analyzeDataVar(fnNode, d.id.name, d);
          }
        }
      }
    }

    function analyzeDataVar(fnNode: any, dataVarName: string, dataDeclaratorNode: any): void {
      function isSignedUrlMember(n: any): boolean {
        if (n?.type !== 'MemberExpression') return false;
        if (n.object?.type !== 'Identifier' || n.object.name !== dataVarName) return false;
        if (!n.computed) return n.property?.type === 'Identifier' && n.property.name === 'signed_url';
        return n.property?.type === 'Literal' && n.property.value === 'signed_url';
      }

      function isNullishLiteral(n: any): boolean {
        return (n?.type === 'Identifier' && n.name === 'undefined') || (n?.type === 'Literal' && n.value === null);
      }

      function isFalsyGuardOnSignedUrl(test: any): boolean {
        if (!test) return false;
        if (test.type === 'UnaryExpression' && test.operator === '!') {
          return isSignedUrlMember(test.argument);
        }
        if (test.type === 'BinaryExpression' && (test.operator === '==' || test.operator === '===')) {
          return (
            (isSignedUrlMember(test.left) && isNullishLiteral(test.right)) ||
            (isSignedUrlMember(test.right) && isNullishLiteral(test.left))
          );
        }
        if (test.type === 'LogicalExpression') {
          return isFalsyGuardOnSignedUrl(test.left) || isFalsyGuardOnSignedUrl(test.right);
        }
        return false;
      }

      let guardPos: number | null = null;
      let usagePos: number | null = null;

      function walk(n: any, depth = 0): void {
        if (!n || typeof n !== 'object' || depth > 40) return;
        if (Array.isArray(n)) {
          for (const item of n) walk(item, depth + 1);
          return;
        }
        if (n.type === 'IfStatement' && isFalsyGuardOnSignedUrl(n.test)) {
          const p = posOf(n);
          if (guardPos === null || p < guardPos) guardPos = p;
        }
        if (isSignedUrlMember(n) && n !== dataDeclaratorNode) {
          const p = posOf(n);
          if (usagePos === null || p < usagePos) usagePos = p;
        }
        for (const key of Object.keys(n)) {
          if (key === 'parent' || key === 'loc' || key === 'range') continue;
          const val = n[key];
          if (val && typeof val === 'object') walk(val, depth + 1);
        }
      }
      walk(fnNode.body);

      if (usagePos === null) return;
      if (guardPos !== null && guardPos < usagePos) return;

      context.report({ node: dataDeclaratorNode, messageId: 'missingValidation' });
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

export const elevenlabsValidateSignedUrlResponseRule = rule;
