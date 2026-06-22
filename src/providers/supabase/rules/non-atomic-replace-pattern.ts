/**
 * supabase-non-atomic-replace-pattern (correctness)
 *
 * Client-side delete-all-then-insert-all child rows without checking either
 * step's error can silently wipe data when a mid-loop insert fails.
 */
import { fromTableName, isSupabaseMutationKind, destructuredNames } from '../utils.js';

interface MutationSite {
  node: any;
  table: string | undefined;
  kind: 'delete' | 'insert';
  checksError: boolean;
}

function isSupabaseTableMutation(node: any, kind: 'delete' | 'insert'): boolean {
  return isSupabaseMutationKind(node, kind);
}

const rule = {
  meta: {
    type: 'suggestion',
    docs: {
      description: 'Supabase delete-then-insert replace patterns should check errors or use RPC',
      category: 'correctness',
      rationale:
        'Replacing child rows by deleting all rows for a user then re-inserting is a common Supabase pattern, but sequential client calls are not transactional. If delete succeeds and a later insert fails, existing rows are gone with no error shown. Wrap both steps in a Postgres RPC function or check error after each call.',
      docsUrl: 'https://supabase.com/docs/guides/database/functions',
      recommended: true,
    },
    messages: {
      nonAtomicReplace:
        'This function deletes then re-inserts rows without checking errors — a failed insert after a successful delete loses data silently.',
    },
    schema: [],
  },
  create(context: any) {
    const fnStack: any[] = [];
    const mutationsByFunction = new Map<any, MutationSite[]>();

    function currentFunction() {
      return fnStack[fnStack.length - 1];
    }

    function recordMutation(node: any, awaitExpr: any, pattern: any | undefined, kind: 'delete' | 'insert') {
      const fn = currentFunction();
      if (!fn) return;
      if (!isSupabaseTableMutation(awaitExpr.argument, kind)) return;
      const checksError = pattern ? destructuredNames(pattern).has('error') : false;
      const list = mutationsByFunction.get(fn) ?? [];
      list.push({ node, table: fromTableName(awaitExpr.argument), kind, checksError });
      mutationsByFunction.set(fn, list);
    }

    function enterFunction(node: any) {
      fnStack.push(node);
    }

    function exitFunction(node: any) {
      const sites = mutationsByFunction.get(node);
      if (sites) {
        const deletes = sites.filter((s) => s.kind === 'delete');
        const inserts = sites.filter((s) => s.kind === 'insert');
        if (deletes.length > 0 && inserts.length > 0) {
          const uncheckedDelete = deletes.some((d) => !d.checksError);
          const uncheckedInsert = inserts.some((i) => !i.checksError);
          const sameTable =
            uncheckedDelete &&
            uncheckedInsert &&
            deletes.some((d) => inserts.some((i) => d.table && i.table && d.table === i.table));
          if (sameTable) {
            context.report({ node: inserts[0]!.node, messageId: 'nonAtomicReplace' });
          }
        }
        mutationsByFunction.delete(node);
      }
      fnStack.pop();
    }

    return {
      FunctionDeclaration(node: any) {
        enterFunction(node);
      },
      'FunctionDeclaration:exit'(node: any) {
        exitFunction(node);
      },
      FunctionExpression(node: any) {
        enterFunction(node);
      },
      'FunctionExpression:exit'(node: any) {
        exitFunction(node);
      },
      ArrowFunctionExpression(node: any) {
        enterFunction(node);
      },
      'ArrowFunctionExpression:exit'(node: any) {
        exitFunction(node);
      },
      VariableDeclarator(node: any) {
        if (node.init?.type !== 'AwaitExpression') return;
        const arg = node.init.argument;
        if (isSupabaseTableMutation(arg, 'delete')) recordMutation(node, node.init, node.id, 'delete');
        if (isSupabaseTableMutation(arg, 'insert')) recordMutation(node, node.init, node.id, 'insert');
      },
      ExpressionStatement(node: any) {
        const expr = node.expression;
        if (expr?.type !== 'AwaitExpression') return;
        const arg = expr.argument;
        if (isSupabaseTableMutation(arg, 'delete')) recordMutation(node, expr, undefined, 'delete');
        if (isSupabaseTableMutation(arg, 'insert')) recordMutation(node, expr, undefined, 'insert');
      },
    };
  },
};

export const supabaseNonAtomicReplacePatternRule = rule;
export default rule;
