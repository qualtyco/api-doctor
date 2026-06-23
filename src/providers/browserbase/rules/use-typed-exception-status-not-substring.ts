/**
 * browserbase-use-typed-exception-status-not-substring (correctness)
 *
 * The SDK raises typed `Browserbase.APIError` (and subclasses) carrying a
 * real `.status: number`. Matching `err.message`/`String(err)` against
 * substrings like "410" or "Gone" is fragile — the API provider can change
 * an unversioned, human-readable error message at any time without notice.
 */
import { someDescendant } from '../utils.js';

function isStringifiedErrorSource(node: any, errName: string): boolean {
  // String(err)
  if (node?.type === 'CallExpression' && node.callee?.type === 'Identifier' && node.callee.name === 'String') {
    const arg = node.arguments?.[0];
    return arg?.type === 'Identifier' && arg.name === errName;
  }
  // err.message / err.toString()
  if (node?.type === 'CallExpression' && node.callee?.type === 'MemberExpression') {
    const obj = node.callee.object;
    const prop = node.callee.property;
    if (obj?.type === 'Identifier' && obj.name === errName && prop?.type === 'Identifier' && prop.name === 'toString') {
      return true;
    }
  }
  if (node?.type === 'MemberExpression' && !node.computed) {
    const obj = node.object;
    const prop = node.property;
    if (obj?.type === 'Identifier' && obj.name === errName && prop?.type === 'Identifier' && prop.name === 'message') {
      return true;
    }
  }
  return false;
}

function unwrapToLowerCase(node: any): any {
  if (
    node?.type === 'CallExpression' &&
    node.callee?.type === 'MemberExpression' &&
    node.callee.property?.type === 'Identifier' &&
    node.callee.property.name === 'toLowerCase'
  ) {
    return node.callee.object;
  }
  return node;
}

function usesTypedStatus(body: any, errName: string): boolean {
  return someDescendant(body, (n) => {
    if (n.type === 'MemberExpression' && !n.computed && n.object?.type === 'Identifier' && n.object.name === errName) {
      return n.property?.type === 'Identifier' && n.property.name === 'status';
    }
    if (n.type === 'BinaryExpression' && n.operator === 'instanceof' && n.left?.type === 'Identifier' && n.left.name === errName) {
      return true;
    }
    return false;
  });
}

function usesSubstringMatch(body: any, errName: string, stringifiedVars: Set<string>): boolean {
  return someDescendant(body, (n) => {
    if (n.type !== 'CallExpression') return false;
    if (n.callee?.type !== 'MemberExpression' || n.callee.computed) return false;
    if (n.callee.property?.type !== 'Identifier' || n.callee.property.name !== 'includes') return false;
    const source = unwrapToLowerCase(n.callee.object);
    if (isStringifiedErrorSource(source, errName)) return true;
    return source?.type === 'Identifier' && stringifiedVars.has(source.name);
  });
}

function collectStringifiedVars(body: any, errName: string): Set<string> {
  const names = new Set<string>();
  someDescendant(body, (n) => {
    if (n.type === 'VariableDeclarator' && n.id?.type === 'Identifier' && n.init) {
      const source = unwrapToLowerCase(n.init);
      if (isStringifiedErrorSource(source, errName)) names.add(n.id.name);
    }
    return false;
  });
  return names;
}

const rule = {
  meta: {
    type: 'suggestion',
    docs: {
      description: 'Branch on err.status, not a substring match of the stringified error',
      category: 'correctness',
      rationale:
        "The SDK raises typed Browserbase.APIError (and subclasses like NotFoundError) carrying a real .status: number and .headers. Matching err.message or String(err) against substrings like \"410\" or \"Session stopped\" is fragile — that human-readable text is an unversioned implementation detail the provider can change at any time without notice. Check err.status (or `instanceof`) instead.",
      docsUrl: 'https://docs.browserbase.com/reference/api/session-live-urls',
      recommended: true,
    },
    messages: {
      substringStatusMatch:
        'This catch block matches a substring of the stringified error instead of checking err.status or `instanceof Browserbase.APIError`.',
    },
    schema: [],
  },
  create(context: any) {
    return {
      CatchClause(node: any) {
        const param = node.param;
        const errName = param?.type === 'Identifier' ? param.name : undefined;
        if (!errName || !node.body) return;

        if (usesTypedStatus(node.body, errName)) return;

        const stringifiedVars = collectStringifiedVars(node.body, errName);
        if (usesSubstringMatch(node.body, errName, stringifiedVars)) {
          context.report({ node, messageId: 'substringStatusMatch' });
        }
      },
    };
  },
};

export const browserbaseUseTypedExceptionStatusNotSubstringRule = rule;
export default rule;
