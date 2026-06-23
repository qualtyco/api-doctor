/**
 * browserbase-centralize-request-release (integration)
 *
 * `sessions.update(id, { status: "REQUEST_RELEASE" })` hand-rolled inline at
 * multiple call sites, each with slightly different error handling, drifts
 * over time and means an API change requires fixing N places instead of
 * one. Route it through a single designated provider/abstraction module.
 */
import { findProperty, isInsideTestFile, isSessionsCall } from '../utils.js';

const rule = {
  meta: {
    type: 'suggestion',
    docs: {
      description: 'Route REQUEST_RELEASE through a single shared abstraction',
      category: 'integration',
      rationale:
        'sessions.update(id, { status: "REQUEST_RELEASE" }) hand-rolled inline at each call site, with each one carrying slightly different error handling, means an API change (a new required field, a renamed status value) requires fixing every call site instead of one — and the duplicated copies already drift in error-handling quality. Centralize behind one designated provider method (e.g. requestStop()/releaseSession()) and call that everywhere instead.',
      docsUrl: 'https://docs.browserbase.com/reference/api/update-a-session',
      recommended: true,
    },
    messages: {
      inlineRequestRelease:
        'sessions.update(..., { status: "REQUEST_RELEASE" }) is hand-rolled inline here. Route this through a single shared release/provider abstraction instead.',
    },
    schema: [],
  },
  create(context: any) {
    const filename = String(context.filename ?? '');
    if (isInsideTestFile(filename) || /provider|browserbaseclient/i.test(filename)) {
      return {};
    }

    return {
      CallExpression(node: any) {
        if (!isSessionsCall(node, 'update')) return;
        const optsArg = node.arguments?.[1];
        const statusProp = findProperty(optsArg, 'status');
        const val = statusProp?.value;
        if (val?.type === 'Literal' && val.value === 'REQUEST_RELEASE') {
          context.report({ node, messageId: 'inlineRequestRelease' });
        }
      },
    };
  },
};

export const browserbaseCentralizeRequestReleaseRule = rule;
export default rule;
