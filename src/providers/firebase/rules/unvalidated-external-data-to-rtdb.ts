/**
 * firebase-unvalidated-external-data-to-rtdb (correctness)
 *
 * RTDB has no schema enforcement on the client — data is written exactly as
 * given. When a function parses an external response (JSON.parse, or
 * `response.json()`) and forwards it into set()/update()/push() with no
 * validation call in between, a malformed field from the upstream source
 * (e.g. an LLM response) silently corrupts data with no error surfaced.
 */
import { endOffset, isIdentifierCall, namedImportsFrom, startOffset } from '../utils.js';

function isJsonParseCall(node: any): boolean {
  return (
    node?.type === 'CallExpression' &&
    node.callee?.type === 'MemberExpression' &&
    !node.callee.computed &&
    node.callee.object?.type === 'Identifier' &&
    node.callee.object.name === 'JSON' &&
    node.callee.property?.type === 'Identifier' &&
    node.callee.property.name === 'parse'
  );
}

function isResponseJsonCall(node: any): boolean {
  return (
    node?.type === 'CallExpression' &&
    node.callee?.type === 'MemberExpression' &&
    !node.callee.computed &&
    node.callee.property?.type === 'Identifier' &&
    node.callee.property.name === 'json' &&
    (node.arguments ?? []).length === 0
  );
}

function isValidationLikeCall(node: any): boolean {
  if (node?.type !== 'CallExpression') return false;
  const callee = node.callee;
  const name =
    callee?.type === 'Identifier'
      ? callee.name
      : callee?.type === 'MemberExpression' && !callee.computed && callee.property?.type === 'Identifier'
        ? callee.property.name
        : undefined;
  if (!name) return false;
  return /valid|^test$|check|assert|schema/i.test(name);
}

type FnScope = { node: any; start: number; end: number; parsePos?: number; validatePos?: number; writePos?: number; writeNode?: any };

const rule = {
  meta: {
    type: 'problem',
    docs: {
      description: 'Parsed external data must be validated before an RTDB write',
      category: 'correctness',
      rationale:
        'Realtime Database has no client-side schema enforcement — data is written exactly as given. When a function parses an external response (e.g. an LLM completion) and forwards the result straight into set()/update()/push() with no validation call in between, a malformed or missing field silently corrupts the stored data with no error surfaced anywhere.',
      docsUrl: 'https://firebase.google.com/docs/database/web/read-and-write',
      recommended: true,
    },
    messages: {
      unvalidatedWrite:
        'Parsed external data flows into a Realtime Database write with no validation call in between. Validate shape/values before writing.',
    },
    schema: [],
  },
  create(context: any) {
    const writeLocalNames = new Set<string>();
    const scopes: FnScope[] = [];

    function registerScope(node: any) {
      scopes.push({ node, start: startOffset(node), end: endOffset(node) });
    }

    function innermostScope(pos: number): FnScope | undefined {
      let best: FnScope | undefined;
      for (const scope of scopes) {
        if (pos < scope.start || pos > scope.end) continue;
        if (!best || scope.end - scope.start < best.end - best.start) best = scope;
      }
      return best;
    }

    function enclosingScopes(pos: number): FnScope[] {
      return scopes.filter((scope) => pos >= scope.start && pos <= scope.end);
    }

    return {
      ImportDeclaration(node: any) {
        const imports = namedImportsFrom(node, 'firebase/database');
        for (const name of ['set', 'update', 'push']) {
          const local = imports.get(name);
          if (local) writeLocalNames.add(local);
        }
      },
      FunctionDeclaration(node: any) {
        registerScope(node);
      },
      FunctionExpression(node: any) {
        registerScope(node);
      },
      ArrowFunctionExpression(node: any) {
        registerScope(node);
      },
      CallExpression(node: any) {
        const pos = startOffset(node);

        // Validation may happen inside a nested callback (e.g. `.filter(t => regex.test(t.dueDate))`),
        // so it counts toward every enclosing function scope, not just the innermost one.
        if (isValidationLikeCall(node)) {
          for (const scope of enclosingScopes(pos)) {
            if (scope.validatePos === undefined || pos < scope.validatePos) scope.validatePos = pos;
          }
          return;
        }

        const scope = innermostScope(pos);
        if (!scope) return;

        if (isJsonParseCall(node) || isResponseJsonCall(node)) {
          if (scope.parsePos === undefined || pos < scope.parsePos) scope.parsePos = pos;
          return;
        }
        if (writeLocalNames.size > 0 && [...writeLocalNames].some((n) => isIdentifierCall(node, n))) {
          if (scope.writePos === undefined || pos < scope.writePos) {
            scope.writePos = pos;
            scope.writeNode = node;
          }
        }
      },
      'Program:exit'() {
        for (const scope of scopes) {
          if (scope.parsePos === undefined || scope.writePos === undefined) continue;
          if (scope.writePos < scope.parsePos) continue;
          const validatedBetween =
            scope.validatePos !== undefined && scope.validatePos > scope.parsePos && scope.validatePos < scope.writePos;
          if (!validatedBetween) {
            context.report({ node: scope.writeNode, messageId: 'unvalidatedWrite' });
          }
        }
      },
    };
  },
};

export const firebaseUnvalidatedExternalDataToRtdbRule = rule;
export default rule;
