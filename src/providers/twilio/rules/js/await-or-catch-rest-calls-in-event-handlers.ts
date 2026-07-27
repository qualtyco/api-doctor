/**
 * Flags `await twilio.calls.create(...)` (or other Twilio REST calls) made
 * inside an async event-handler callback with no surrounding try/catch
 * (Finding G). An unhandled rejection there can crash the whole process.
 */
const REST_RESOURCE_METHODS = new Set(['create', 'update', 'remove', 'fetch']);
const EVENT_REGISTRATION_METHODS = new Set(['onStart', 'onStop', 'onMedia', 'onConnected', 'on']);

const rule = {
  meta: {
    type: 'problem',
    docs: {
      description: 'Twilio REST calls inside event-handler callbacks must be wrapped in try/catch',
      category: 'reliability',
      rationale:
        'Event-emitter style callbacks (onStart, onMessage, on("message", ...)) are typically invoked via something like `callbacks.map((cb) => cb(event))`, which discards the returned promise. If the callback is `async` and calls `await twilio.calls.create(...)` with no try/catch, any Twilio REST error (invalid number, suspended account, rate limit) becomes an unhandled promise rejection. If the process has a global `unhandledRejection` handler that calls `process.exit()` (a common pattern), one failed outbound call takes down the entire server and every other in-progress call, not just the failing one.',
      docsUrl: 'https://www.twilio.com/docs/usage/webhooks/webhooks-faq',
      recommended: true,
    },
    messages: {
      missingTryCatch:
        'This await twilio.{{resource}}.{{method}}() call is inside an event-handler callback with no surrounding try/catch — a REST API error here becomes an unhandled promise rejection that can crash the whole process.',
    },
  },
  create(context: any) {
    function isAwaitedTwilioRestCall(n: any): { resource: string; method: string } | null {
      if (n?.type !== 'AwaitExpression') return null;
      const call = n.argument;
      if (call?.type !== 'CallExpression') return null;
      const callee = call.callee;
      if (callee?.type !== 'MemberExpression') return null;
      const method = callee.property?.type === 'Identifier' ? callee.property.name : null;
      if (!method || !REST_RESOURCE_METHODS.has(method)) return null;

      const obj = callee.object;
      if (obj?.type !== 'MemberExpression') return null;
      const resource = obj.property?.type === 'Identifier' ? obj.property.name : null;
      if (!resource) return null;

      // The base object should ultimately be a Twilio client identifier
      // (commonly named `twilio`/`twilioClient`/bare `client`), not an
      // unrelated SDK whose identifier merely contains the word "client"
      // (e.g. `openaiClient`, `dbClient`).
      const base = obj.object;
      const baseName = base?.type === 'Identifier' ? base.name : null;
      if (!baseName || !/^(twilio\w*|client)$/i.test(baseName)) return null;

      return { resource, method };
    }

    function isEventHandlerRegistration(n: any): boolean {
      if (n?.type !== 'CallExpression') return false;
      const callee = n.callee;
      if (callee?.type !== 'MemberExpression') return false;
      return callee.property?.type === 'Identifier' && EVENT_REGISTRATION_METHODS.has(callee.property.name);
    }

    function isAsyncCallback(n: any): boolean {
      return (n?.type === 'ArrowFunctionExpression' || n?.type === 'FunctionExpression') && n.async === true;
    }

    function posOf(n: any): number {
      if (typeof n?.range?.[0] === 'number') return n.range[0];
      const line = n?.loc?.start?.line ?? 0;
      const column = n?.loc?.start?.column ?? 0;
      return line * 1_000_000 + column;
    }
    function posEnd(n: any): number {
      if (typeof n?.range?.[1] === 'number') return n.range[1];
      const line = n?.loc?.end?.line ?? n?.loc?.start?.line ?? 0;
      const column = n?.loc?.end?.column ?? n?.loc?.start?.column ?? 0;
      return line * 1_000_000 + column;
    }

    function isWithinTryBlock(node: any, root: any): boolean {
      const tryRanges: Array<[number, number]> = [];
      function collectTryRanges(n: any, depth = 0): void {
        if (!n || typeof n !== 'object' || depth > 60) return;
        if (Array.isArray(n)) {
          for (const item of n) collectTryRanges(item, depth + 1);
          return;
        }
        if (n.type === 'TryStatement' && n.block) {
          tryRanges.push([posOf(n.block), posEnd(n.block)]);
        }
        for (const key of Object.keys(n)) {
          if (key === 'parent' || key === 'loc' || key === 'range') continue;
          const val = n[key];
          if (val && typeof val === 'object') collectTryRanges(val, depth + 1);
        }
      }
      collectTryRanges(root);

      const p = posOf(node);
      return tryRanges.some(([start, end]) => p >= start && p <= end);
    }

    return {
      CallExpression(node: any) {
        if (!isEventHandlerRegistration(node)) return;
        const callback = node.arguments?.find((a: any) => isAsyncCallback(a));
        if (!callback) return;

        const restCalls: Array<{ node: any; resource: string; method: string }> = [];
        function collect(n: any, depth = 0): void {
          if (!n || typeof n !== 'object' || depth > 40) return;
          if (Array.isArray(n)) {
            for (const item of n) collect(item, depth + 1);
            return;
          }
          const info = isAwaitedTwilioRestCall(n);
          if (info) restCalls.push({ node: n, ...info });
          for (const key of Object.keys(n)) {
            if (key === 'parent' || key === 'loc' || key === 'range') continue;
            const val = n[key];
            if (val && typeof val === 'object') collect(val, depth + 1);
          }
        }
        collect(callback.body);

        for (const call of restCalls) {
          if (!isWithinTryBlock(call.node, callback.body)) {
            context.report({
              node: call.node,
              messageId: 'missingTryCatch',
              data: { resource: call.resource, method: call.method },
            });
          }
        }
      },
    };
  },
};

export const twilioAwaitOrCatchRestCallsInEventHandlersRule = rule;
