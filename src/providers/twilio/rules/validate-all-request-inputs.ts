/**
 * Flags two related gaps in Fastify Twilio webhook routes (Findings J, L):
 *  - a route with a `body` schema but no `querystring` schema, while the
 *    handler still reads `req.query.<field>`
 *  - a route with no `schema` object at all, while the handler reads
 *    `req.body.<field>`
 */
import { isPostRouteRegistration, findInSubtree } from '../utils.js';

const rule = {
  meta: {
    type: 'suggestion',
    docs: {
      description: 'Fastify Twilio webhook routes must declare a schema for every request input they read',
      category: 'correctness',
      rationale:
        'A route that validates `body` but not `querystring` (or declares no schema at all) lets unvalidated, possibly-undefined fields flow downstream. If a later call does `value.toString()` or similar on a field that never arrived, that throws instead of failing the request cleanly with a 400 — the failure surfaces far from the actual missing-validation root cause.',
      docsUrl: 'https://www.twilio.com/docs/voice/twiml/stream',
      recommended: true,
    },
    messages: {
      missingQuerystringSchema:
        'This route reads req.query.{{field}} but the route schema validates body without a matching querystring schema — a missing query param flows downstream as undefined instead of failing with a 400.',
      missingSchemaEntirely:
        'This route reads req.body.{{field}} but declares no request schema at all — req.body is untyped and unvalidated before use.',
    },
  },
  create(context: any) {
    function getOptionsArg(routeCall: any): any {
      // server.post('/path', { ... }, handler) — options is arg[1] when 3 args.
      return routeCall.arguments?.length === 3 ? routeCall.arguments[1] : null;
    }

    function getHandlerArg(routeCall: any): any {
      const args = routeCall.arguments ?? [];
      return args[args.length - 1];
    }

    function hasSchemaProperty(optionsArg: any, propName: string): boolean {
      if (optionsArg?.type !== 'ObjectExpression') return false;
      const schemaProp = (optionsArg.properties ?? []).find(
        (p: any) => p.type === 'Property' && p.key?.type === 'Identifier' && p.key.name === 'schema',
      );
      if (!schemaProp || schemaProp.value?.type !== 'ObjectExpression') return false;
      return (schemaProp.value.properties ?? []).some(
        (p: any) => p.type === 'Property' && p.key?.type === 'Identifier' && p.key.name === propName,
      );
    }

    function hasAnySchema(optionsArg: any): boolean {
      if (optionsArg?.type !== 'ObjectExpression') return false;
      return (optionsArg.properties ?? []).some(
        (p: any) => p.type === 'Property' && p.key?.type === 'Identifier' && p.key.name === 'schema',
      );
    }

    function findReadFields(handlerBody: any, objectNames: Set<string>): Set<string> {
      const fields = new Set<string>();
      findInSubtree(handlerBody, (n) => {
        if (n?.type !== 'MemberExpression') return false;
        const obj = n.object;
        if (obj?.type !== 'MemberExpression') return false;
        if (obj.object?.type !== 'Identifier' || (obj.object.name !== 'req' && obj.object.name !== 'request')) return false;
        if (obj.property?.type !== 'Identifier' || !objectNames.has(obj.property.name)) return false;
        const field = n.property?.type === 'Identifier' ? n.property.name : null;
        if (field) fields.add(field);
        return false;
      });
      return fields;
    }

    return {
      CallExpression(node: any) {
        if (!isPostRouteRegistration(node)) return;

        const optionsArg = getOptionsArg(node);
        const handler = getHandlerArg(node);
        if (!handler || (handler.type !== 'ArrowFunctionExpression' && handler.type !== 'FunctionExpression')) return;

        const queryFields = findReadFields(handler.body, new Set(['query']));
        const bodyFields = findReadFields(handler.body, new Set(['body']));

        const hasBodySchema = hasSchemaProperty(optionsArg, 'body');
        const hasQuerystringSchema = hasSchemaProperty(optionsArg, 'querystring');

        if (queryFields.size > 0 && hasBodySchema && !hasQuerystringSchema) {
          const field = [...queryFields][0];
          context.report({ node, messageId: 'missingQuerystringSchema', data: { field } });
        }

        if (bodyFields.size > 0 && !hasAnySchema(optionsArg)) {
          const field = [...bodyFields][0];
          context.report({ node, messageId: 'missingSchemaEntirely', data: { field } });
        }
      },
    };
  },
};

export const twilioValidateAllRequestInputsRule = rule;
