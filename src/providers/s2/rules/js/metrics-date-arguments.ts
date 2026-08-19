/**
 * s2-metrics-date-arguments (correctness)
 *
 * The TypeScript metrics API takes `start`/`end` as Date objects and a
 * string `interval`; the Python SDK takes integer epoch seconds. Agents
 * porting the Python pattern pass numbers (Date.now(), epoch arithmetic),
 * which is the wrong type in TS. Also flags basin/stream timeseries sets
 * ("storage", "append-ops") queried without an `interval`, which returns an
 * unintended resolution.
 */
import { createS2FileTracker, findProperty, getObjectArg, memberCallObject, memberPropName, unwrapExpr } from '../../utils.js';

const METRIC_METHODS = new Set(['account', 'basin', 'stream']);
const TIMESERIES_SETS = new Set(['storage', 'append-ops']);

const rule = {
  meta: {
    type: 'suggestion',
    docs: {
      description: 'S2 metrics take Date objects for start/end and need interval on timeseries sets',
      category: 'correctness',
      rationale:
        'metrics.account/basin/stream in the TypeScript SDK expect start and end as Date objects — passing epoch numbers (the Python SDK pattern) is a type error at best and a silently wrong query at worst. Timeseries sets like "storage" and "append-ops" also take interval: "hour" | "minute"; omitting it returns a resolution you did not choose.',
      docsUrl: 'https://s2.dev/docs/sdk/metrics',
      recommended: true,
    },
    messages: {
      numericTimeArgument:
        'S2 TypeScript metrics take start/end as Date objects, not epoch numbers. Use e.g. start: new Date(Date.now() - 3600 * 1000).',
      missingInterval:
        'Timeseries metrics set without an interval returns an unintended resolution. Add interval: "hour" or "minute".',
    },
    schema: [],
  },
  create(context: any) {
    const tracker = createS2FileTracker();
    const reports: Array<{ node: any; messageId: string }> = [];

    /** Numeric-epoch shapes: literals, arithmetic, Date.now(). */
    function isNumericTime(value: any): boolean {
      const v = unwrapExpr(value);
      if (!v) return false;
      if (v.type === 'Literal' && typeof v.value === 'number') return true;
      if (v.type === 'BinaryExpression' || v.type === 'UnaryExpression') return true;
      if (v.type === 'CallExpression') {
        const callee = unwrapExpr(v.callee);
        return (
          memberPropName(callee) === 'now' && unwrapExpr(callee?.object)?.name === 'Date'
        );
      }
      return false;
    }

    return {
      ImportDeclaration(node: any) {
        tracker.visitImport(node);
      },

      NewExpression(node: any) {
        tracker.visitNew(node);
      },

      CallExpression(node: any) {
        const callee = unwrapExpr(node?.callee);
        const method = memberPropName(callee);
        if (!method || !METRIC_METHODS.has(method)) return;
        if (memberPropName(unwrapExpr(callee.object)) !== 'metrics') return;

        const options = getObjectArg(node, 0);
        if (!options) return;

        for (const key of ['start', 'end']) {
          const prop = findProperty(options, key);
          if (prop && isNumericTime(prop.value)) {
            reports.push({ node: prop, messageId: 'numericTimeArgument' });
          }
        }

        if (method === 'basin' || method === 'stream') {
          const set = findProperty(options, 'set');
          const setValue = set ? unwrapExpr(set.value) : undefined;
          if (
            setValue?.type === 'Literal' &&
            TIMESERIES_SETS.has(String(setValue.value)) &&
            !findProperty(options, 'interval')
          ) {
            reports.push({ node, messageId: 'missingInterval' });
          }
        }
      },

      'Program:exit'() {
        if (!tracker.isS2File()) return;
        for (const r of reports) context.report(r);
      },
    };
  },
};

export const s2MetricsDateArgumentsRule = rule;
