const QUEUE_CALL_NAME_PATTERN = /^(push|unshift|enqueue|queue)$/i;

/**
 * Classifies a test comparing `readyState` against OPEN: 'is-open' for
 * `readyState === OPEN`, 'is-not-open' for `readyState !== OPEN`, else null.
 */
function readyStateOpenCheckKind(test: any): 'is-open' | 'is-not-open' | null {
  if (test?.type !== 'BinaryExpression') return null;
  const isEq = test.operator === '===' || test.operator === '==';
  const isNeq = test.operator === '!==' || test.operator === '!=';
  if (!isEq && !isNeq) return null;

  const isReadyStateMember = (n: any) =>
    n?.type === 'MemberExpression' && n.property?.type === 'Identifier' && n.property.name === 'readyState';

  const isOpenValue = (n: any) =>
    (n?.type === 'MemberExpression' && n.property?.type === 'Identifier' && n.property.name === 'OPEN') ||
    (n?.type === 'Literal' && n.value === 1);

  const matches =
    (isReadyStateMember(test.left) && isOpenValue(test.right)) ||
    (isReadyStateMember(test.right) && isOpenValue(test.left));
  if (!matches) return null;
  return isEq ? 'is-open' : 'is-not-open';
}

/** True if `node` contains a call that looks like enqueueing onto a buffer (push/unshift/enqueue/queue). */
function hasQueueCall(node: any, depth = 0): boolean {
  if (!node || typeof node !== 'object' || depth > 40) return false;
  if (Array.isArray(node)) return node.some((n) => hasQueueCall(n, depth + 1));

  if (node.type === 'CallExpression') {
    const callee = node.callee;
    const calleeName =
      callee?.type === 'MemberExpression' && callee.property?.type === 'Identifier'
        ? callee.property.name
        : callee?.type === 'Identifier'
          ? callee.name
          : null;
    if (typeof calleeName === 'string' && QUEUE_CALL_NAME_PATTERN.test(calleeName)) return true;
  }

  for (const key of Object.keys(node)) {
    if (key === 'parent' || key === 'loc' || key === 'range') continue;
    const val = node[key];
    if (val && typeof val === 'object' && hasQueueCall(val, depth + 1)) return true;
  }
  return false;
}

const rule = {
  meta: {
    type: 'suggestion',
    docs: {
      description: 'Audio sent before an OpenAI Realtime socket is open must be buffered, not dropped',
      category: 'reliability',
      docsUrl: 'https://developers.openai.com/api/reference/resources/realtime/client-events',
      rationale:
        'Caller audio can arrive before the Realtime WebSocket finishes its connect + session.update round-trip. A readyState !== OPEN branch that only logs and returns silently drops every audio chunk that arrives in that window, meaning the first fragment of speech is lost to translation/processing on every call.',
      recommended: true,
    },
    messages: {
      audioDroppedNotBuffered:
        'Audio sent while this Realtime socket is not yet open is dropped here instead of being buffered and flushed once open.',
    },
    schema: [],
  },
  create(context: any) {
    return {
      IfStatement(node: any) {
        const kind = readyStateOpenCheckKind(node.test);
        if (!kind) return;

        // The branch taken while the socket is not yet open: the else branch
        // of `=== OPEN`, or the consequent of `!== OPEN` (early-return drop).
        const notOpenBranch = kind === 'is-open' ? node.alternate : node.consequent;
        if (!notOpenBranch) return;
        if (hasQueueCall(notOpenBranch)) return;

        context.report({ node: notOpenBranch, messageId: 'audioDroppedNotBuffered' });
      },
    };
  },
};

export const openaiRealtimeBufferAudioUntilSessionReadyRule = rule;
