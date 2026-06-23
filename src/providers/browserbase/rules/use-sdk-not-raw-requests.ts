/**
 * browserbase-use-sdk-not-raw-requests (integration)
 *
 * A raw fetch/axios/http call to an api.browserbase.com endpoint bypasses
 * the installed SDK's typed exceptions, retry/backoff, and consistent error
 * handling that every other call site in the same codebase gets for free.
 */
const BROWSERBASE_HOST = 'api.browserbase.com';

function templateLiteralContainsHost(node: any): boolean {
  return (node.quasis ?? []).some((q: any) => {
    const text = q?.value?.cooked ?? q?.value?.raw ?? '';
    return typeof text === 'string' && text.includes(BROWSERBASE_HOST);
  });
}

function urlArgContainsHost(node: any): boolean {
  if (node?.type === 'Literal' && typeof node.value === 'string') return node.value.includes(BROWSERBASE_HOST);
  if (node?.type === 'TemplateLiteral') return templateLiteralContainsHost(node);
  return false;
}

function isRawHttpCall(node: any): { isCall: boolean; urlArg: any } {
  if (node?.type !== 'CallExpression') return { isCall: false, urlArg: undefined };
  const callee = node.callee;

  // fetch(url, ...)
  if (callee?.type === 'Identifier' && callee.name === 'fetch') {
    return { isCall: true, urlArg: node.arguments?.[0] };
  }

  if (callee?.type === 'MemberExpression' && !callee.computed && callee.property?.type === 'Identifier') {
    const objName = callee.object?.type === 'Identifier' ? callee.object.name : undefined;
    const methodName = callee.property.name;
    // axios.get(url, ...) / axios.post(url, ...) / http.get(url, ...) / https.get(url, ...)
    if (objName && /^(axios|http|https)$/i.test(objName) && /^(get|post|put|patch|delete|request)$/i.test(methodName)) {
      return { isCall: true, urlArg: node.arguments?.[0] };
    }
  }

  // axios(url, ...) or axios({ url, ... })
  if (callee?.type === 'Identifier' && callee.name === 'axios') {
    const arg = node.arguments?.[0];
    if (arg?.type === 'ObjectExpression') {
      const urlProp = arg.properties?.find(
        (p: any) => p?.type === 'Property' && p.key?.type === 'Identifier' && p.key.name === 'url',
      );
      return { isCall: true, urlArg: urlProp?.value };
    }
    return { isCall: true, urlArg: arg };
  }

  return { isCall: false, urlArg: undefined };
}

const rule = {
  meta: {
    type: 'suggestion',
    docs: {
      description: 'Use the installed Browserbase SDK instead of hand-rolled HTTP requests',
      category: 'integration',
      rationale:
        'A raw fetch/axios/http call to an api.browserbase.com endpoint duplicates a method the installed SDK already exposes (e.g. sessions.recording.retrieve()), forfeiting its typed exceptions, built-in retry/backoff, and consistent error handling — and risks drifting on auth header naming or response shape as the API evolves.',
      docsUrl: 'https://docs.browserbase.com/reference/sdk/nodejs',
      recommended: true,
    },
    messages: {
      rawRequestToBrowserbase:
        'This makes a raw HTTP request to a Browserbase API endpoint instead of using the installed SDK.',
    },
    schema: [],
  },
  create(context: any) {
    const urlVars = new Map<string, any>();

    return {
      VariableDeclarator(node: any) {
        if (node.id?.type === 'Identifier' && urlArgContainsHost(node.init)) {
          urlVars.set(node.id.name, node.init);
        }
      },
      CallExpression(node: any) {
        const { isCall, urlArg } = isRawHttpCall(node);
        if (!isCall || !urlArg) return;

        const resolved = urlArg.type === 'Identifier' ? urlVars.get(urlArg.name) ?? urlArg : urlArg;
        if (urlArgContainsHost(resolved)) {
          context.report({ node, messageId: 'rawRequestToBrowserbase' });
        }
      },
    };
  },
};

export const browserbaseUseSdkNotRawRequestsRule = rule;
export default rule;
