/** Shared AST helpers for Twilio provider rules. */

const POST_METHOD_NAMES = new Set(['post']);
const ROUTER_OBJECT_NAMES = new Set(['server', 'app', 'router', 'fastify']);

/** True for `server.post('/path', ...)` / `app.post('/path', ...)` style route registrations. */
export function isPostRouteRegistration(node: any): boolean {
  if (node?.type !== 'CallExpression') return false;
  const callee = node.callee;
  if (callee?.type !== 'MemberExpression') return false;
  if (callee.property?.type !== 'Identifier' || !POST_METHOD_NAMES.has(callee.property.name)) return false;
  return callee.object?.type === 'Identifier' && ROUTER_OBJECT_NAMES.has(callee.object.name);
}

/** Recursively searches a subtree for any node matching the predicate. */
export function findInSubtree(node: any, predicate: (n: any) => boolean, depth = 0): any {
  if (!node || typeof node !== 'object' || depth > 40) return null;
  if (Array.isArray(node)) {
    for (const n of node) {
      const found = findInSubtree(n, predicate, depth + 1);
      if (found) return found;
    }
    return null;
  }
  if (predicate(node)) return node;
  for (const key of Object.keys(node)) {
    if (key === 'parent' || key === 'loc' || key === 'range') continue;
    const val = node[key];
    if (val && typeof val === 'object') {
      const found = findInSubtree(val, predicate, depth + 1);
      if (found) return found;
    }
  }
  return null;
}

/** True when a subtree references `req.body`/`request.body` anywhere. */
export function referencesRequestBody(node: any): boolean {
  return !!findInSubtree(node, (n) => {
    if (n?.type !== 'MemberExpression') return false;
    if (n.property?.type !== 'Identifier' || n.property.name !== 'body') return false;
    return n.object?.type === 'Identifier' && (n.object.name === 'req' || n.object.name === 'request');
  });
}

/** Recursively collects every VariableDeclarator in a subtree. */
export function collectVarDeclarators(node: any, out: any[], depth = 0): void {
  if (!node || typeof node !== 'object' || depth > 24) return;
  if (Array.isArray(node)) {
    for (const n of node) collectVarDeclarators(n, out, depth + 1);
    return;
  }
  if (node.type === 'VariableDeclarator') out.push(node);
  for (const key of Object.keys(node)) {
    if (key === 'parent' || key === 'loc' || key === 'range') continue;
    const val = node[key];
    if (val && typeof val === 'object') collectVarDeclarators(val, out, depth + 1);
  }
}

/** A source-order sortable position for a node, used to compare "happens before". */
export function posOf(n: any): number {
  if (typeof n?.range?.[0] === 'number') return n.range[0];
  const line = n?.loc?.start?.line ?? 0;
  const column = n?.loc?.start?.column ?? 0;
  return line * 1_000_000 + column;
}

/**
 * Twilio-shaped evidence helpers.
 *
 * A POST route reading req.body is a completely generic web idiom (logins,
 * Stripe webhooks, form handlers…). Rules that target Twilio webhook routes
 * must therefore require positive Twilio evidence before flagging — either on
 * the route itself (TwiML usage, Twilio webhook body fields, the
 * X-Twilio-Signature header) or at file level (a twilio import).
 */

/** Webhook body parameters distinctive enough to identify a Twilio callback on their own. */
const TWILIO_STRONG_BODY_FIELDS = new Set([
  'CallSid',
  'CallStatus',
  'CallToken',
  'CallerName',
  'ForwardedFrom',
  'MessageSid',
  'MessageStatus',
  'MessagingServiceSid',
  'SmsSid',
  'SmsMessageSid',
  'SmsStatus',
  'AccountSid',
  'Digits',
  'SpeechResult',
  'RecordingSid',
  'RecordingUrl',
  'RecordingStatus',
  'StreamSid',
  'TaskSid',
  'TaskAttributes',
  'WorkerSid',
  'WorkerAttributes',
  'ReservationSid',
  'WorkflowSid',
]);

/** Twilio webhook params whose names are too generic alone — two or more together count. */
const TWILIO_WEAK_BODY_FIELDS = new Set(['From', 'To', 'Body', 'Caller', 'Called']);

/** True when the file imports/requires the twilio SDK (any subpath). */
export function hasTwilioImport(program: any): boolean {
  return !!findInSubtree(program, (n) => {
    if (n?.type === 'ImportDeclaration') {
      const src = n.source?.value;
      return typeof src === 'string' && (src === 'twilio' || src.startsWith('twilio/'));
    }
    if (n?.type === 'CallExpression' && n.callee?.type === 'Identifier' && n.callee.name === 'require') {
      const arg = n.arguments?.[0];
      return (
        arg?.type === 'Literal' &&
        typeof arg.value === 'string' &&
        (arg.value === 'twilio' || arg.value.startsWith('twilio/'))
      );
    }
    return false;
  });
}

/** True when a subtree uses TwiML builders (MessagingResponse/VoiceResponse/…twiml…). */
export function usesTwiml(node: any): boolean {
  return !!findInSubtree(node, (n) => {
    if (n?.type !== 'Identifier') return false;
    return n.name === 'MessagingResponse' || n.name === 'VoiceResponse' || /twiml/i.test(n.name);
  });
}

/** True when a subtree reads the X-Twilio-Signature header (string/template literal). */
export function readsTwilioSignatureHeader(node: any): boolean {
  return !!findInSubtree(node, (n) => {
    if (n?.type === 'Literal' && typeof n.value === 'string') {
      return /x-twilio-signature/i.test(n.value);
    }
    if (n?.type === 'TemplateElement') {
      const cooked = n.value?.cooked ?? n.value?.raw;
      return typeof cooked === 'string' && /x-twilio-signature/i.test(cooked);
    }
    return false;
  });
}

/**
 * True when a subtree reads Twilio-shaped webhook body fields: one distinctive
 * field (CallSid, MessageSid…) or at least two generic-named ones together
 * (From + Body…). Covers `req.body.X` reads and `const { X } = req.body`.
 */
export function readsTwilioWebhookBodyFields(node: any): boolean {
  const fields = new Set<string>();

  function isReqBodyMember(n: any): boolean {
    return (
      n?.type === 'MemberExpression' &&
      n.property?.type === 'Identifier' &&
      n.property.name === 'body' &&
      n.object?.type === 'Identifier' &&
      (n.object.name === 'req' || n.object.name === 'request')
    );
  }

  findInSubtree(node, (n) => {
    if (n?.type === 'MemberExpression' && isReqBodyMember(n.object)) {
      if (n.property?.type === 'Identifier') fields.add(n.property.name);
      else if (n.property?.type === 'Literal' && typeof n.property.value === 'string') fields.add(n.property.value);
    }
    if (n?.type === 'VariableDeclarator' && n.id?.type === 'ObjectPattern' && isReqBodyMember(n.init)) {
      for (const p of n.id.properties ?? []) {
        if (p?.type === 'Property' && p.key?.type === 'Identifier') fields.add(p.key.name);
      }
    }
    return false;
  });

  let weak = 0;
  for (const field of fields) {
    if (TWILIO_STRONG_BODY_FIELDS.has(field)) return true;
    if (TWILIO_WEAK_BODY_FIELDS.has(field)) weak += 1;
  }
  return weak >= 2;
}

/**
 * True when a POST route registration is verifiably a Twilio webhook route:
 * the route subtree shows Twilio-shaped usage, or the file as a whole imports
 * twilio / builds TwiML. Generic POST routes (logins, Stripe webhooks…) in
 * files without any twilio reference never qualify.
 */
export function routeHasTwilioEvidence(route: any, program: any): boolean {
  return (
    usesTwiml(route) ||
    readsTwilioSignatureHeader(route) ||
    readsTwilioWebhookBodyFields(route) ||
    hasTwilioImport(program) ||
    usesTwiml(program)
  );
}
