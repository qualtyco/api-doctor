import { collectOpenAIRealtimeSocketVarNames, isSocketOnCall } from '../utils.js';

const LOG_METHOD_NAMES = new Set(['info', 'warn', 'error', 'log']);

function isLogCall(node: any): { matches: boolean; calleeProp?: any } {
  if (node?.type !== 'CallExpression') return { matches: false };
  const callee = node.callee;
  if (callee?.type !== 'MemberExpression') return { matches: false };
  const prop = callee.property;
  if (prop?.type !== 'Identifier' || !LOG_METHOD_NAMES.has(prop.name)) return { matches: false };
  return { matches: true, calleeProp: prop };
}

/** True if `argNode` references `paramName` as a whole value (not a narrowed property access). */
function referencesRawParam(argNode: any, paramName: string): boolean {
  if (!argNode) return false;

  // Direct identifier: logger.info(msg)
  if (argNode.type === 'Identifier' && argNode.name === paramName) return true;

  // msg.toString()
  if (
    argNode.type === 'CallExpression' &&
    argNode.callee?.type === 'MemberExpression' &&
    argNode.callee.object?.type === 'Identifier' &&
    argNode.callee.object.name === paramName &&
    argNode.callee.property?.type === 'Identifier' &&
    argNode.callee.property.name === 'toString'
  ) {
    return true;
  }

  // Template literal: `... ${msg} ...` or `... ${msg.toString()} ...`
  if (argNode.type === 'TemplateLiteral') {
    return (argNode.expressions ?? []).some((expr: any) => referencesRawParam(expr, paramName));
  }

  return false;
}

function findCallExpressions(node: any, out: any[], depth = 0): void {
  if (!node || typeof node !== 'object' || depth > 40) return;
  if (Array.isArray(node)) {
    for (const n of node) findCallExpressions(n, out, depth + 1);
    return;
  }
  if (node.type === 'CallExpression') out.push(node);
  for (const key of Object.keys(node)) {
    if (key === 'parent' || key === 'loc' || key === 'range') continue;
    const val = node[key];
    if (val && typeof val === 'object') findCallExpressions(val, out, depth + 1);
  }
}

const rule = {
  meta: {
    type: 'problem',
    docs: {
      description: 'Raw OpenAI Realtime message payloads must not be logged verbatim',
      category: 'security',
      cwe: 'CWE-532',
      docsUrl: 'https://developers.openai.com/api/docs/guides/realtime',
      rationale:
        'Every inbound Realtime WebSocket message can include response.audio.delta payloads (base64-encoded live call audio) and, once transcription is wired up, transcript text. Logging the raw message object or string verbatim writes a durable, unredacted record of live conversation content into whatever log sink the application ships to.',
      recommended: true,
    },
    messages: {
      rawPayloadLogged:
        'A raw OpenAI Realtime message is logged verbatim here, which can include live call audio or transcript content.',
    },
    schema: [],
  },
  create(context: any) {
    let socketVarNames = new Set<string>();

    return {
      Program(node: any) {
        socketVarNames = collectOpenAIRealtimeSocketVarNames(node);
      },

      CallExpression(node: any) {
        if (socketVarNames.size === 0) return;
        if (!isSocketOnCall(node, socketVarNames, 'message')) return;

        const handler = node.arguments?.[1];
        if (handler?.type !== 'ArrowFunctionExpression' && handler?.type !== 'FunctionExpression') return;

        const param = handler.params?.[0];
        if (param?.type !== 'Identifier') return;
        const paramName = param.name;

        const calls: any[] = [];
        findCallExpressions(handler.body, calls);

        for (const call of calls) {
          const { matches } = isLogCall(call);
          if (!matches) continue;
          const hasRawArg = (call.arguments ?? []).some((arg: any) => referencesRawParam(arg, paramName));
          if (hasRawArg) {
            context.report({ node: call, messageId: 'rawPayloadLogged' });
          }
        }
      },
    };
  },
};

export const openaiRealtimeNoLogRawMessagePayloadsRule = rule;
