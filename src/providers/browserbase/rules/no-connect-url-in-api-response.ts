/**
 * browserbase-no-connect-url-in-api-response (security)
 *
 * `connectUrl` (the WebSocket CDP URL on SessionCreateResponse) is
 * self-authenticating — connecting to it grants full read/write control of
 * the live browser. It must stay server-side; the sharable artifact is
 * `debuggerFullscreenUrl` from `sessions.debug()`, not `connectUrl`.
 */
import { findProperty, isResponseSendCall } from '../utils.js';

const rule = {
  meta: {
    type: 'problem',
    docs: {
      description: 'connectUrl must never be placed in an HTTP response body',
      category: 'security',
      cwe: 'CWE-200',
      owasp: 'A04:2021 Insecure Design',
      rationale:
        "session.connectUrl is the WebSocket CDP URL returned by sessions.create() — it is self-authenticating; connecting to it grants full read/write control of the live browser (arbitrary JS execution, cookie/localStorage read, simulated input), equivalent to a bearer token. Putting it in a response body widens its exposure (network tab, browser extensions, error trackers, logs) for callers that almost never need it client-side — the intended sharable artifact is debuggerFullscreenUrl from sessions.debug().",
      docsUrl: 'https://docs.browserbase.com/reference/api/create-a-session',
      recommended: true,
    },
    messages: {
      connectUrlInResponse:
        'connectUrl is included in an HTTP response body. Keep it server-side only — it is a bearer credential for the live browser, not a sharable URL.',
    },
    schema: [],
  },
  create(context: any) {
    return {
      CallExpression(node: any) {
        if (!isResponseSendCall(node)) return;
        const arg = node.arguments?.[0];
        if (arg?.type !== 'ObjectExpression') return;
        if (findProperty(arg, 'connectUrl')) {
          context.report({ node, messageId: 'connectUrlInResponse' });
        }
      },
    };
  },
};

export const browserbaseNoConnectUrlInApiResponseRule = rule;
export default rule;
