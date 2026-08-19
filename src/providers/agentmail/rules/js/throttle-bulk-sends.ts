/**
 * agentmail-throttle-bulk-sends (reliability)
 *
 * A loop that awaits `messages.send` back-to-back fires an entire prospect
 * list as fast as the API accepts: expect 429s, plan-volume burn (Free:
 * 3,000 emails/month), and deliverability damage from bursting off one
 * address. Flags send calls inside loops with no inter-iteration delay
 * (setTimeout / sleep-style call) anywhere in the enclosing loop.
 */
import {
  contains,
  createAgentMailFileTracker,
  isHolderMethodCall,
  isInsideTestFile,
  memberPropName,
  unwrapExpr,
} from '../../utils.js';

const SLEEPISH = /^(sleep|delay|wait|pause|throttle|backoff)$/i;

const rule = {
  meta: {
    type: 'suggestion',
    docs: {
      description: 'Bulk send loops need throttling between iterations',
      category: 'reliability',
      rationale:
        'Sequentially awaiting messages.send over a whole list bursts from a single address as fast as the API accepts: the rate-limits guide tells high-volume agents to expect 429 Too Many Requests, budget against plan volume (Free: 3,000 emails/month), and distribute sends for deliverability instead of bursting. Space bulk sends with a per-send delay or a queue with a daily budget.',
      docsUrl: 'https://docs.agentmail.to/knowledge-base/rate-limits',
      recommended: true,
    },
    messages: {
      unthrottledLoop:
        'messages.send inside a loop with no delay bursts the whole list at once — expect 429s and deliverability damage. Add a per-send delay or queue with a daily budget.',
    },
    schema: [],
  },
  create(context: any) {
    if (isInsideTestFile(String(context.filename ?? context.getFilename?.() ?? ''))) return {};
    const tracker = createAgentMailFileTracker();
    const loops: any[] = [];
    const sendCalls: any[] = [];
    const delayCalls: any[] = [];

    return {
      ImportDeclaration(node: any) {
        tracker.visitImport(node);
      },
      NewExpression(node: any) {
        tracker.visitNew(node);
      },

      ForStatement(node: any) {
        loops.push(node);
      },
      ForOfStatement(node: any) {
        loops.push(node);
      },
      ForInStatement(node: any) {
        loops.push(node);
      },
      WhileStatement(node: any) {
        loops.push(node);
      },
      DoWhileStatement(node: any) {
        loops.push(node);
      },

      CallExpression(node: any) {
        if (isHolderMethodCall(node, 'messages', 'send')) {
          sendCalls.push(node);
          return;
        }
        const callee = unwrapExpr(node.callee);
        const name =
          callee?.type === 'Identifier' ? callee.name : memberPropName(callee) ?? '';
        if (name === 'setTimeout' || SLEEPISH.test(name)) delayCalls.push(node);
      },

      'Program:exit'() {
        if (!tracker.isAgentMailFile()) return;
        for (const send of sendCalls) {
          const enclosing = loops.filter((l) => contains(l, send));
          if (enclosing.length === 0) continue;
          const throttled = enclosing.some((l) => delayCalls.some((d) => contains(l, d)));
          if (!throttled) {
            context.report({ node: send, messageId: 'unthrottledLoop' });
          }
        }
      },
    };
  },
};

export const agentmailThrottleBulkSendsRule = rule;
