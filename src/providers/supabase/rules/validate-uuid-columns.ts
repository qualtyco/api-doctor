/**
 * supabase-validate-uuid-columns (correctness)
 *
 * A value validated only with `typeof x === "string"` (or `!== "string"`)
 * before being inserted/upserted into a uuid-typed column passes app
 * validation for any non-UUID string, then fails at the database with a
 * Postgres type-cast error — surfacing a client-correctable 400 as a
 * generic 500.
 *
 * Tracks, per file, which identifiers have been typeof-string-checked and
 * which have separately passed a UUID-shaped regex `.test()` call, then at
 * each `.from(table).insert(...)`/`.upsert(...)` call cross-references the
 * inserted object's tenant/id-style columns (e.g. `session_id`) against
 * that state.
 */
import {
  chainObjectCall,
  isTenantColumnName,
  memberPropName,
  resolvePropertyValueName,
  typeofStringCheckTarget,
} from '../utils.js';

interface VarValidation {
  typeofOnly: boolean;
  uuidChecked: boolean;
}

// Loose heuristic for "this regex checks UUID shape": hex-looking character
// classes combined with a literal hyphen, regardless of the regex's variable
// name (so `UUID_RE` and a differently-named-but-equivalent pattern both count).
function regexSourceLooksUuidShaped(pattern: string): boolean {
  return /[0-9a-f]{2,}/i.test(pattern) && pattern.includes('-');
}

const rule = {
  meta: {
    type: 'suggestion',
    docs: {
      description: 'Columns typed uuid must be validated for UUID shape, not just typeof string',
      category: 'correctness',
      rationale:
        'typeof === "string" accepts any string, including malformed UUIDs like "abc". When the underlying column is typed uuid, the database rejects it with a generic type-cast error that the app then has to collapse into an opaque 500 — masking a client-correctable 400 as a server failure. Validating the UUID shape (e.g. with a regex) before the insert lets the app return a precise 400 instead.',
      docsUrl: 'https://supabase.com/docs/guides/database/tables#data-types',
      recommended: true,
    },
    messages: {
      missingUuidValidation:
        'Column "{{column}}" looks UUID-typed but the value is only checked with typeof === "string", not a UUID-shape regex. Validate the format before insert/upsert.',
    },
    schema: [],
  },
  create(context: any) {
    const validations = new Map<string, VarValidation>();
    const regexVarPatterns = new Map<string, string>();

    function markValidation(name: string, key: keyof VarValidation) {
      let v = validations.get(name);
      if (!v) {
        v = { typeofOnly: false, uuidChecked: false };
        validations.set(name, v);
      }
      v[key] = true;
    }

    return {
      VariableDeclarator(node: any) {
        if (node.id?.type === 'Identifier' && node.init?.type === 'Literal' && node.init.regex) {
          regexVarPatterns.set(node.id.name, node.init.regex.pattern);
        }
      },

      BinaryExpression(node: any) {
        const varName = typeofStringCheckTarget(node);
        if (varName) markValidation(varName, 'typeofOnly');
      },

      CallExpression(node: any) {
        const prop = memberPropName(node);

        if (prop === 'test') {
          const objNode = node.callee.object;
          let pattern: string | undefined;
          if (objNode?.type === 'Literal' && objNode.regex) {
            pattern = objNode.regex.pattern;
          } else if (objNode?.type === 'Identifier' && regexVarPatterns.has(objNode.name)) {
            pattern = regexVarPatterns.get(objNode.name);
          }
          if (pattern && regexSourceLooksUuidShaped(pattern)) {
            const arg = node.arguments?.[0];
            if (arg?.type === 'Identifier') markValidation(arg.name, 'uuidChecked');
          }
          return;
        }

        if (prop !== 'insert' && prop !== 'upsert') return;
        const objCall = chainObjectCall(node);
        if (!objCall || memberPropName(objCall) !== 'from') return;

        const arg = node.arguments?.[0];
        if (arg?.type !== 'ObjectExpression') return;

        for (const p of arg.properties ?? []) {
          if (p?.type !== 'Property') continue;
          const keyName =
            p.key?.type === 'Identifier'
              ? p.key.name
              : p.key?.type === 'Literal'
                ? p.key.value
                : undefined;
          if (typeof keyName !== 'string' || !isTenantColumnName(keyName)) continue;

          const valueName = resolvePropertyValueName(p);
          if (!valueName) continue;

          const v = validations.get(valueName);
          if (v?.typeofOnly && !v.uuidChecked) {
            context.report({ node: p, messageId: 'missingUuidValidation', data: { column: keyName } });
          }
        }
      },
    };
  },
};

export const supabaseValidateUuidColumnsRule = rule;
export default rule;
