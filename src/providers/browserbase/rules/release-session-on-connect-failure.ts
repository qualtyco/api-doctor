/**
 * browserbase-release-session-on-connect-failure (reliability)
 *
 * If a CDP connect call (e.g. Playwright's `connectOverCDP`) raises after
 * `sessions.create()` already succeeded, the session stays RUNNING on
 * Browserbase's side unless something explicitly releases it. The SDK's own
 * docstring warns: "Use REQUEST_RELEASE before session's timeout to avoid
 * additional charges."
 */
import { contains, findProperty, isSessionsCall, memberPropName, someDescendant } from '../utils.js';

function isSessionsCreateAwait(node: any): boolean {
  return node?.type === 'AwaitExpression' && isSessionsCall(node.argument, 'create');
}

function isConnectCall(node: any): boolean {
  if (node?.type !== 'CallExpression') return false;
  const callee = node.callee;
  const name = callee?.type === 'Identifier' ? callee.name : memberPropName(node);
  return !!name && /connect/i.test(name);
}

function isReleaseCall(node: any): boolean {
  if (node?.type !== 'CallExpression') return false;
  if (isSessionsCall(node, 'update')) {
    const optsArg = node.arguments?.[1];
    const statusProp = findProperty(optsArg, 'status');
    if (statusProp?.value?.type === 'Literal' && statusProp.value.value === 'REQUEST_RELEASE') return true;
  }
  const callee = node.callee;
  const name = callee?.type === 'Identifier' ? callee.name : memberPropName(node);
  return !!name && /requeststop|releasesession|release_session/i.test(name);
}

const rule = {
  meta: {
    type: 'problem',
    docs: {
      description: 'A failed connect after session creation must release the session',
      category: 'reliability',
      rationale:
        "If the CDP connect call raises after sessions.create() already succeeded on Browserbase's side, the session stays RUNNING and only terminates once its timeout elapses (up to 6h) unless something explicitly calls sessions.update(id, { status: 'REQUEST_RELEASE' }). The SDK's own docs warn to do this before the timeout \"to avoid additional charges.\" A connect call with no try/catch (or a catch that doesn't release) leaks the session on every connect failure.",
      docsUrl: 'https://docs.browserbase.com/reference/api/update-a-session',
      recommended: true,
    },
    messages: {
      sessionNotReleasedOnFailure:
        'A session was created but this connect call has no catch that releases it (sessions.update with status: "REQUEST_RELEASE") on failure. A failed connect will leak the session until its timeout.',
    },
    schema: [],
  },
  create(context: any) {
    let sawSessionCreate = false;
    const connectCalls: any[] = [];
    const tryStatements: any[] = [];

    return {
      AwaitExpression(node: any) {
        if (isSessionsCreateAwait(node)) sawSessionCreate = true;
      },
      TryStatement(node: any) {
        tryStatements.push(node);
      },
      CallExpression(node: any) {
        if (isConnectCall(node)) connectCalls.push(node);
      },
      'Program:exit'() {
        if (!sawSessionCreate) return;
        for (const call of connectCalls) {
          const enclosingTry = tryStatements.find((t) => t.block && contains(t.block, call));
          const handled = !!enclosingTry?.handler && someDescendant(enclosingTry.handler, isReleaseCall);
          if (!handled) {
            context.report({ node: call, messageId: 'sessionNotReleasedOnFailure' });
          }
        }
      },
    };
  },
};

export const browserbaseReleaseSessionOnConnectFailureRule = rule;
export default rule;
