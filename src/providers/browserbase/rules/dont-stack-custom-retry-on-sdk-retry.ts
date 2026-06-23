/**
 * browserbase-dont-stack-custom-retry-on-sdk-retry (reliability)
 *
 * The client already retries internally (default maxRetries: 2, retrying
 * 408/409/429/5xx with Retry-After-aware backoff) before ever raising an
 * exception. A hand-rolled retry loop around sessions.create() that doesn't
 * pass `{ maxRetries: 0 }` stacks two uncoordinated backoff schedules,
 * multiplying worst-case attempts and latency.
 */
import { findProperty, isSessionsCall } from '../utils.js';

function isLoopNode(node: any): boolean {
  return node?.type === 'ForStatement' || node?.type === 'WhileStatement' || node?.type === 'DoWhileStatement';
}

const rule = {
  meta: {
    type: 'suggestion',
    docs: {
      description: 'A custom retry loop around sessions.create must disable the SDK\'s own retry',
      category: 'reliability',
      rationale:
        'The Browserbase client already retries internally (default maxRetries: 2, retrying 408/409/429/5xx with Retry-After-aware exponential backoff) before ever raising an exception back to the caller. A hand-rolled retry loop around sessions.create() that does not pass { maxRetries: 0 } stacks two independent, uncoordinated backoff schedules — a sustained 429 can trigger N outer attempts x (1 + 2 SDK-internal retries), multiplying worst-case latency well beyond what either layer alone would produce.',
      docsUrl: 'https://docs.browserbase.com/optimizations/concurrency/overview',
      recommended: true,
    },
    messages: {
      stackedRetry:
        'sessions.create() is called inside a custom retry loop with no { maxRetries: 0 } override — the SDK retries this call internally too, stacking two backoff schedules.',
    },
    schema: [],
  },
  create(context: any) {
    const loopRanges: any[] = [];

    return {
      ForStatement(node: any) {
        loopRanges.push(node);
      },
      WhileStatement(node: any) {
        loopRanges.push(node);
      },
      DoWhileStatement(node: any) {
        loopRanges.push(node);
      },
      CallExpression(node: any) {
        if (!isSessionsCall(node, 'create')) return;
        const insideLoop = loopRanges.some((loop) => {
          const start = loop.range?.[0] ?? loop.start;
          const end = loop.range?.[1] ?? loop.end;
          const pos = node.range?.[0] ?? node.start;
          return pos >= start && pos <= end;
        });
        if (!insideLoop) return;

        const optsArg = node.arguments?.[1];
        const hasMaxRetries = optsArg?.type === 'ObjectExpression' && !!findProperty(optsArg, 'maxRetries');
        if (!hasMaxRetries) {
          context.report({ node, messageId: 'stackedRetry' });
        }
      },
    };
  },
};

export const browserbaseDontStackCustomRetryOnSdkRetryRule = rule;
export default rule;
