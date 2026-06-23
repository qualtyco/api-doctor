/**
 * Flags an `*_until`/`*_expires_at`/`*_expiry` column written via a Supabase
 * `.update()` call that is never compared against the current time anywhere
 * else in the same file — the expiry is recorded but nothing ever acts on it.
 */
const EXPIRY_COLUMN_PATTERN = /_(until|expires?_at|expiry)$/i;
const DATE_COMPARISON_OPERATORS = new Set(['>', '<', '>=', '<=']);
const FILTER_METHODS = new Set(['gt', 'gte', 'lt', 'lte']);

const rule = {
  meta: {
    type: 'suggestion',
    docs: {
      description: 'An expiry column must be checked against the current time somewhere',
      category: 'correctness',
      rationale:
        "Writing a *_until/*_expires_at column without ever comparing it to the current time anywhere in the codebase means the expiry is purely cosmetic — whatever it was meant to gate (a boost, a trial, a temporary unlock) never actually expires once granted, whether it was granted legitimately or through an unrelated bug.",
      docsUrl: 'https://docs.lovable.dev/features/cloud',
      recommended: true,
    },
    messages: {
      expiryNeverChecked:
        'The "{{column}}" column is written here but is never compared against the current time anywhere in this file, so it never actually expires anything.',
    },
  },
  create(context: any) {
    const writtenColumns = new Map<string, any>();
    const readColumns = new Set<string>();

    function propName(node: any): string | undefined {
      if (!node) return undefined;
      if (node.type === 'Identifier') return node.name;
      if (node.type === 'Literal' && typeof node.value === 'string') return node.value;
      return undefined;
    }

    function isSupabaseUpdateCall(node: any): boolean {
      if (node?.type !== 'CallExpression') return false;
      const callee = node.callee;
      return callee?.type === 'MemberExpression' && callee.property?.name === 'update';
    }

    function containsDateNowOrNewDate(node: any, depth = 0): boolean {
      if (!node || typeof node !== 'object' || depth > 6) return false;
      if (node.type === 'NewExpression' && node.callee?.type === 'Identifier' && node.callee.name === 'Date') {
        return true;
      }
      if (
        node.type === 'CallExpression' &&
        node.callee?.type === 'MemberExpression' &&
        node.callee.object?.type === 'Identifier' &&
        node.callee.object.name === 'Date' &&
        node.callee.property?.name === 'now'
      ) {
        return true;
      }
      if (node.type === 'MemberExpression') {
        return containsDateNowOrNewDate(node.object, depth + 1) || containsDateNowOrNewDate(node.callee, depth + 1);
      }
      if (node.type === 'CallExpression') {
        return containsDateNowOrNewDate(node.callee, depth + 1);
      }
      return false;
    }

    function memberPropertyName(node: any): string | undefined {
      if (node?.type !== 'MemberExpression') return undefined;
      return propName(node.property);
    }

    return {
      CallExpression(node: any) {
        if (isSupabaseUpdateCall(node)) {
          const arg = node.arguments?.[0];
          if (arg?.type === 'ObjectExpression') {
            for (const prop of arg.properties ?? []) {
              if (prop?.type !== 'Property') continue;
              const keyName = propName(prop.key);
              if (keyName && EXPIRY_COLUMN_PATTERN.test(keyName) && !writtenColumns.has(keyName)) {
                writtenColumns.set(keyName, node);
              }
            }
          }
        }

        // Supabase/PostgREST filter read: .gt('boosted_until', nowIso)
        const callee = node.callee;
        if (callee?.type === 'MemberExpression' && FILTER_METHODS.has(callee.property?.name)) {
          const colArg = node.arguments?.[0];
          const colName = colArg?.type === 'Literal' ? propName(colArg) : undefined;
          if (colName && EXPIRY_COLUMN_PATTERN.test(colName)) {
            readColumns.add(colName);
          }
        }
      },

      BinaryExpression(node: any) {
        if (!DATE_COMPARISON_OPERATORS.has(node.operator)) return;
        const leftCol = memberPropertyName(node.left);
        const rightCol = memberPropertyName(node.right);
        if (leftCol && EXPIRY_COLUMN_PATTERN.test(leftCol) && containsDateNowOrNewDate(node.right)) {
          readColumns.add(leftCol);
        }
        if (rightCol && EXPIRY_COLUMN_PATTERN.test(rightCol) && containsDateNowOrNewDate(node.left)) {
          readColumns.add(rightCol);
        }
      },

      'Program:exit'() {
        for (const [column, node] of writtenColumns) {
          if (!readColumns.has(column)) {
            context.report({ node, messageId: 'expiryNeverChecked', data: { column } });
          }
        }
      },
    };
  },
};

export const lovableExpiryColumnNeverCheckedRule = rule;
