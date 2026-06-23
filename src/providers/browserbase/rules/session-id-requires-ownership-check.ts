/**
 * browserbase-session-id-requires-ownership-check (security)
 *
 * A handler that takes a sessionId (route param, query, or body) and passes
 * it straight into a Browserbase live-view/recording call with no ownership
 * check first is an IDOR: any authenticated user who learns or guesses a
 * session id can view someone else's live session.
 */
import { endOffset, isSessionsCall, isSessionsRecordingCall, startOffset } from '../utils.js';

function isOwnershipCheckCall(node: any): boolean {
  if (node?.type !== 'CallExpression') return false;
  const callee = node.callee;
  const name =
    callee?.type === 'Identifier'
      ? callee.name
      : callee?.type === 'MemberExpression' && !callee.computed && callee.property?.type === 'Identifier'
        ? callee.property.name
        : undefined;
  if (!name) return false;
  return /owner|belongsto|hasaccess|authorize|verifyaccess|checkaccess|findproject|getproject/i.test(name);
}

function isSessionIdLikeArg(node: any): boolean {
  if (node?.type === 'Identifier') return /sessionid/i.test(node.name);
  if (node?.type === 'MemberExpression' && !node.computed && node.property?.type === 'Identifier') {
    return /sessionid/i.test(node.property.name);
  }
  return false;
}

type Scope = { node: any; start: number; end: number; sawOwnershipCheck: boolean };

const rule = {
  meta: {
    type: 'suggestion',
    docs: {
      description: 'Session id lookups must verify ownership before returning live-view data',
      category: 'security',
      cwe: 'CWE-862',
      rationale:
        'A session id alone is not an authorization token — it is an opaque identifier that can leak via links, logs, screenshots, or support tickets. A handler that resolves a sessionId straight into sessions.debug()/sessions.recording.retrieve() with no ownership/org-membership check lets any authenticated caller view or replay a session that belongs to someone else.',
      docsUrl: 'https://docs.browserbase.com/features/session-live-view',
      recommended: true,
    },
    messages: {
      missingOwnershipCheck:
        'sessionId is passed directly into a Browserbase live-view/recording call with no ownership check beforehand.',
    },
    schema: [],
  },
  create(context: any) {
    const scopes: Scope[] = [];
    const sensitiveCalls: any[] = [];

    function registerScope(node: any) {
      scopes.push({ node, start: startOffset(node), end: endOffset(node), sawOwnershipCheck: false });
    }

    function innermostScope(pos: number): Scope | undefined {
      let best: Scope | undefined;
      for (const scope of scopes) {
        if (pos < scope.start || pos > scope.end) continue;
        if (!best || scope.end - scope.start < best.end - best.start) best = scope;
      }
      return best;
    }

    return {
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
        const scope = innermostScope(pos);

        if (isOwnershipCheckCall(node)) {
          for (const s of scopes) {
            if (pos >= s.start && pos <= s.end) s.sawOwnershipCheck = true;
          }
          return;
        }

        if (isSessionsCall(node, 'debug') || isSessionsRecordingCall(node, 'retrieve')) {
          const sessionIdArg = (node.arguments ?? []).some(isSessionIdLikeArg);
          if (sessionIdArg) sensitiveCalls.push({ node, scope });
        }
      },
      'Program:exit'() {
        for (const { node, scope } of sensitiveCalls) {
          if (!scope || !scope.sawOwnershipCheck) {
            context.report({ node, messageId: 'missingOwnershipCheck' });
          }
        }
      },
    };
  },
};

export const browserbaseSessionIdRequiresOwnershipCheckRule = rule;
export default rule;
