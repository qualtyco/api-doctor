const QUEUE_CALL_NAME_PATTERN = /^(push|unshift|enqueue|queue)$/i;

function isReadyStateOpenCheck(test: any): boolean {
  if (test?.type !== 'BinaryExpression' || (test.operator !== '===' && test.operator !== '==')) return false;

  const isReadyStateMember = (n: any) =>
    n?.type === 'MemberExpression' && n.property?.type === 'Identifier' && n.property.name === 'readyState';

  const isOpenValue = (n: any) =>
    (n?.type === 'MemberExpression' && n.property?.type === 'Identifier' && n.property.name === 'OPEN') ||
    (n?.type === 'Literal' && n.value === 1);

  return (isReadyStateMember(test.left) && isOpenValue(test.right)) ||
    (isReadyStateMember(test.right) && isOpenValue(test.left));
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
      docsUrl: 'https://developers.openai.com/api/docs/voice/media-streams/websocket-messages',
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
        if (!isReadyStateOpenCheck(node.test)) return;
        if (!node.alternate) return;
        if (hasQueueCall(node.alternate)) return;

        context.report({ node: node.alternate, messageId: 'audioDroppedNotBuffered' });
      },
    };
  },
};

export const openaiRealtimeBufferAudioUntilSessionReadyRule = rule;
