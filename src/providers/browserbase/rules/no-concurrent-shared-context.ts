/**
 * browserbase-no-concurrent-shared-context (correctness)
 *
 * Browserbase's docs are explicit: "Avoid having multiple sessions using the
 * same Context at once. Sites may force a log out." Passing the same
 * browserSettings.context.id into every iteration of a concurrent
 * Promise.all batch creates 2+ sessions simultaneously attached to one
 * Context.
 */
import { findProperty, isSessionsCall, memberPropName } from '../utils.js';

function isPromiseAllCall(node: any): boolean {
  return (
    node?.type === 'CallExpression' &&
    node.callee?.type === 'MemberExpression' &&
    !node.callee.computed &&
    node.callee.object?.type === 'Identifier' &&
    node.callee.object.name === 'Promise' &&
    node.callee.property?.type === 'Identifier' &&
    node.callee.property.name === 'all'
  );
}

function isMapCall(node: any): boolean {
  return memberPropName(node) === 'map';
}

function callbackParamNames(callback: any): Set<string> {
  const names = new Set<string>();
  const param = callback?.params?.[0];
  if (param?.type === 'Identifier') {
    names.add(param.name);
  } else if (param?.type === 'ObjectPattern') {
    for (const p of param.properties ?? []) {
      if (p?.type === 'Property' && p.value?.type === 'Identifier') names.add(p.value.name);
      else if (p?.type === 'RestElement' && p.argument?.type === 'Identifier') names.add(p.argument.name);
    }
  }
  return names;
}

function contextIdValueIsShared(callback: any, contextIdNode: any): boolean {
  if (contextIdNode?.type !== 'Identifier') return false;
  const params = callbackParamNames(callback);
  if (params.has(contextIdNode.name)) return false;

  // `(combo) => ... combo.contextId ...` style — not flaggable as an Identifier
  // check; the bare-identifier case below is the pattern this rule targets.
  return true;
}

function findSharedContextCreateCall(callback: any): any | null {
  const body = callback?.body;
  if (!body) return null;

  let found: any = null;
  function visit(n: any) {
    if (found || !n || typeof n !== 'object') return;
    if (Array.isArray(n)) {
      for (const item of n) visit(item);
      return;
    }
    if (typeof n.type !== 'string') return;

    if (isSessionsCall(n, 'create')) {
      const optsArg = n.arguments?.[0];
      const browserSettings = findProperty(optsArg, 'browserSettings')?.value;
      const ctxProp = findProperty(browserSettings, 'context')?.value;
      const idProp = findProperty(ctxProp, 'id');
      if (idProp && contextIdValueIsShared(callback, idProp.value)) {
        found = n;
        return;
      }
    }
    for (const key of Object.keys(n)) {
      if (key === 'parent' || key === 'loc' || key === 'range') continue;
      visit(n[key]);
    }
  }
  visit(body);
  return found;
}

const rule = {
  meta: {
    type: 'problem',
    docs: {
      description: 'A Browserbase Context must not be attached to concurrent sessions',
      category: 'correctness',
      rationale:
        'Browserbase\'s docs state explicitly: "Avoid having multiple sessions using the same Context at once. Sites may force a log out." Passing the same browserSettings.context.id into every iteration of a Promise.all(items.map(...)) batch creates 2+ Browserbase sessions simultaneously attached to one Context, producing non-deterministic, flaky failures when a site force-logs-out one session because another concurrently authenticated against the same context.',
      docsUrl: 'https://docs.browserbase.com/features/contexts',
      recommended: true,
    },
    messages: {
      concurrentSharedContext:
        'The same browserSettings.context.id is passed into every concurrent sessions.create() call in this Promise.all batch. Sites may force a log out when 2+ sessions share a Context at once.',
    },
    schema: [],
  },
  create(context: any) {
    const mapCallsByVarName = new Map<string, any>();

    function checkMapCall(mapCallNode: any) {
      if (!isMapCall(mapCallNode)) return;
      const callback = mapCallNode.arguments?.[mapCallNode.arguments.length - 1];
      if (!callback) return;
      const sharedCall = findSharedContextCreateCall(callback);
      if (sharedCall) {
        context.report({ node: sharedCall, messageId: 'concurrentSharedContext' });
      }
    }

    return {
      VariableDeclarator(node: any) {
        if (node.id?.type === 'Identifier' && isMapCall(node.init)) {
          mapCallsByVarName.set(node.id.name, node.init);
        }
      },
      CallExpression(node: any) {
        if (!isPromiseAllCall(node)) return;
        const arg = node.arguments?.[0];

        if (isMapCall(arg)) {
          checkMapCall(arg);
          return;
        }
        if (arg?.type === 'Identifier') {
          const mapCall = mapCallsByVarName.get(arg.name);
          if (mapCall) checkMapCall(mapCall);
        }
      },
    };
  },
};

export const browserbaseNoConcurrentSharedContextRule = rule;
export default rule;
