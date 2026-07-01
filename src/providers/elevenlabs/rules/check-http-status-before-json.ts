/**
 * Flags `response.json()` called on an ElevenLabs API fetch response with no
 * preceding response.ok / status check, which parses error bodies as if
 * they were successful data (Finding H).
 */
import { isElevenLabsUrlArg, unwrapAwait, collectVarDeclarators, posOf } from '../utils.js';

const rule = {
  meta: {
    type: 'problem',
    docs: {
      description: 'response.json() must not be called before checking the HTTP status of an ElevenLabs response',
      category: 'correctness',
      rationale:
        'Calling response.json() unconditionally parses whatever body the server returned, including error payloads, as if it were a successful response. Without checking response.ok (or response.status) first, a 4xx/5xx error from the ElevenLabs API is silently treated as valid data.',
      docsUrl: 'https://elevenlabs.io/docs/eleven-api/resources/errors',
      recommended: true,
    },
    messages: {
      missingStatusCheck:
        'response.json() is called on this ElevenLabs API response without first checking response.ok/status — an error response will be parsed as if it were valid data.',
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
      for (const responseVarName of responseVarNames) {
        analyzeResponseVar(fnNode, responseVarName);
      }
    }

    function analyzeResponseVar(fnNode: any, responseVarName: string): void {
      function isResponseStatusCheck(test: any): boolean {
        if (!test) return false;
        // response.ok / !response.ok
        if (test.type === 'UnaryExpression' && test.operator === '!') return isResponseStatusCheck(test.argument);
        if (
          test.type === 'MemberExpression' &&
          test.object?.type === 'Identifier' &&
          test.object.name === responseVarName &&
          test.property?.type === 'Identifier' &&
          test.property.name === 'ok'
        ) {
          return true;
        }
        // response.status compared to something
        if (test.type === 'BinaryExpression') {
          const sideIsStatus = (n: any) =>
            n?.type === 'MemberExpression' &&
            n.object?.type === 'Identifier' &&
            n.object.name === responseVarName &&
            n.property?.type === 'Identifier' &&
            n.property.name === 'status';
          if (sideIsStatus(test.left) || sideIsStatus(test.right)) return true;
        }
        if (test.type === 'LogicalExpression') {
          return isResponseStatusCheck(test.left) || isResponseStatusCheck(test.right);
        }
        return false;
      }

      function isResponseJsonCall(n: any): boolean {
        if (n?.type !== 'CallExpression') return false;
        const callee = n.callee;
        if (callee?.type !== 'MemberExpression') return false;
        if (callee.property?.type !== 'Identifier' || callee.property.name !== 'json') return false;
        return callee.object?.type === 'Identifier' && callee.object.name === responseVarName;
      }

      let guardPos: number | null = null;
      let jsonCallNode: any = null;
      let jsonCallPos: number | null = null;

      function walk(n: any, depth = 0): void {
        if (!n || typeof n !== 'object' || depth > 40) return;
        if (Array.isArray(n)) {
          for (const item of n) walk(item, depth + 1);
          return;
        }
        if (n.type === 'IfStatement' && isResponseStatusCheck(n.test)) {
          const p = posOf(n);
          if (guardPos === null || p < guardPos) guardPos = p;
        }
        if (isResponseJsonCall(n)) {
          const p = posOf(n);
          if (jsonCallPos === null || p < jsonCallPos) {
            jsonCallPos = p;
            jsonCallNode = n;
          }
        }
        for (const key of Object.keys(n)) {
          if (key === 'parent' || key === 'loc' || key === 'range') continue;
          const val = n[key];
          if (val && typeof val === 'object') walk(val, depth + 1);
        }
      }
      walk(fnNode.body);

      if (jsonCallPos === null) return;
      if (guardPos !== null && guardPos < jsonCallPos) return;

      context.report({ node: jsonCallNode, messageId: 'missingStatusCheck' });
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

export const elevenlabsCheckHttpStatusBeforeJsonRule = rule;
