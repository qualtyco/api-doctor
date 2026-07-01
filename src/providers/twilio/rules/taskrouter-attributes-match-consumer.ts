/**
 * Flags a TaskRouter `.task(...)` attributes payload that omits a field
 * which the same file later destructures from `JSON.parse(req.body.TaskAttributes)`
 * (Finding E). The producer and consumer of Task attributes silently drift
 * apart, so the consumer's lookup is always undefined.
 */
import { findInSubtree, collectVarDeclarators } from '../utils.js';

const rule = {
  meta: {
    type: 'problem',
    docs: {
      description: 'TaskRouter Task attributes must include every field the reservation handler reads back out',
      category: 'correctness',
      rationale:
        'A Task is created with attributes like `{ name, type }`, and later a reservation-accepted handler does `const { from } = JSON.parse(req.body.TaskAttributes)` to look up state by `from`. If the producer never set `from` on the Task attributes, that destructure is always `undefined`, the lookup always misses, and the handler returns 404 — even though every other part of the flow worked correctly.',
      docsUrl: 'https://www.twilio.com/docs/taskrouter/twiml-queue-calls',
      recommended: true,
    },
    messages: {
      attributeMismatch:
        'This .task() attributes object does not set "{{field}}", but a reservation handler in this codebase destructures "{{field}}" from JSON.parse(TaskAttributes) — that lookup will always be undefined.',
    },
  },
  create(context: any) {
    function isTaskCall(n: any): boolean {
      if (n?.type !== 'CallExpression') return false;
      const callee = n.callee;
      if (callee?.type !== 'MemberExpression') return false;
      return callee.property?.type === 'Identifier' && callee.property.name === 'task';
    }

    function extractAttributeKeys(taskCallNode: any): Set<string> | null {
      const arg = taskCallNode.arguments?.[0];
      if (!arg) return null;

      // JSON.stringify({ name: ..., from: ... }) form
      if (
        arg.type === 'CallExpression' &&
        arg.callee?.type === 'MemberExpression' &&
        arg.callee.object?.type === 'Identifier' &&
        arg.callee.object.name === 'JSON' &&
        arg.callee.property?.type === 'Identifier' &&
        arg.callee.property.name === 'stringify' &&
        arg.arguments?.[0]?.type === 'ObjectExpression'
      ) {
        return objectKeys(arg.arguments[0]);
      }

      // Raw template-literal/string JSON form: `{ "name": "${...}", "type": "inbound" }`.
      // JSON keys are always literal text in the quasis, never inside the
      // interpolated expressions, so concatenating quasis text is sufficient.
      if (arg.type === 'TemplateLiteral') {
        const raw = arg.quasis.map((q: any) => q.value?.raw ?? '').join('');
        const keys = new Set<string>();
        for (const m of raw.matchAll(/"([a-zA-Z0-9_]+)"\s*:/g)) keys.add(m[1]);
        return keys;
      }
      if (arg.type === 'Literal' && typeof arg.value === 'string') {
        const keys = new Set<string>();
        for (const m of arg.value.matchAll(/"([a-zA-Z0-9_]+)"\s*:/g)) keys.add(m[1]);
        return keys;
      }

      return null;
    }

    function objectKeys(objExpr: any): Set<string> {
      const keys = new Set<string>();
      for (const p of objExpr.properties ?? []) {
        if (p.type !== 'Property') continue;
        const name = p.key?.type === 'Identifier' ? p.key.name : p.key?.type === 'Literal' ? p.key.value : null;
        if (typeof name === 'string') keys.add(name);
      }
      return keys;
    }

    function isTaskAttributesJsonParse(n: any): boolean {
      if (n?.type !== 'CallExpression') return false;
      const callee = n.callee;
      if (callee?.type !== 'MemberExpression') return false;
      if (callee.object?.type !== 'Identifier' || callee.object.name !== 'JSON') return false;
      if (callee.property?.type !== 'Identifier' || callee.property.name !== 'parse') return false;
      const arg = n.arguments?.[0];
      if (arg?.type !== 'MemberExpression') return false;
      return arg.property?.type === 'Identifier' && arg.property.name === 'TaskAttributes';
    }

    function findConsumedFields(program: any): Set<string> {
      const fields = new Set<string>();
      const declarators: any[] = [];
      collectVarDeclarators(program, declarators);
      for (const d of declarators) {
        if (!isTaskAttributesJsonParse(d.init)) continue;
        if (d.id?.type === 'ObjectPattern') {
          for (const p of d.id.properties ?? []) {
            if (p.type !== 'Property') continue;
            const name = p.key?.type === 'Identifier' ? p.key.name : null;
            if (name) fields.add(name);
          }
        }
      }
      return fields;
    }

    return {
      'Program:exit'(program: any) {
        const consumedFields = findConsumedFields(program);
        if (consumedFields.size === 0) return;

        const taskCalls: any[] = [];
        findInSubtree(program, (n) => {
          if (isTaskCall(n)) taskCalls.push(n);
          return false;
        });

        for (const taskCall of taskCalls) {
          const producedKeys = extractAttributeKeys(taskCall);
          if (!producedKeys) continue;

          for (const field of consumedFields) {
            if (!producedKeys.has(field)) {
              context.report({ node: taskCall, messageId: 'attributeMismatch', data: { field } });
            }
          }
        }
      },
    };
  },
};

export const twilioTaskrouterAttributesMatchConsumerRule = rule;
