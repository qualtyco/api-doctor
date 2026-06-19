/**
 * supabase-consistent-input-length-limits (correctness)
 *
 * When several string fields are inserted together (e.g. all properties of
 * one `.insert(...)` call), and some of them are validated with an explicit
 * `.length > N` cap while at least one sibling field is only type-checked,
 * the uncapped field is usually the one the agent forgot — not a field that
 * was deliberately left unbounded. Flags the inconsistency, not "missing a
 * cap" in isolation (a single uncapped field with no capped siblings is out
 * of scope for this rule).
 */
import { chainObjectCall, memberPropName, resolvePropertyValueName, typeofStringCheckTarget } from '../utils.js';

interface VarValidation {
  typeofStringChecked: boolean;
  hasLengthCap: boolean;
}

const rule = {
  meta: {
    type: 'suggestion',
    docs: {
      description: 'Sibling string fields inserted together should share the same length cap discipline',
      category: 'correctness',
      rationale:
        'A field with no length cap on an otherwise-validated, unauthenticated insert path lets a client persist arbitrarily large payloads repeatedly, growing storage with no bound. When sibling fields in the same insert already have explicit length caps, an uncapped field next to them is usually an oversight rather than an intentional choice.',
      docsUrl: 'https://supabase.com/docs/guides/database/tables',
      recommended: true,
    },
    messages: {
      inconsistentLengthLimit:
        'Field "{{field}}" has no length cap, but sibling field "{{cappedField}}" in the same insert does. Add a .length check for "{{field}}" too.',
    },
    schema: [],
  },
  create(context: any) {
    const validations = new Map<string, VarValidation>();

    function markValidation(name: string, key: keyof VarValidation) {
      let v = validations.get(name);
      if (!v) {
        v = { typeofStringChecked: false, hasLengthCap: false };
        validations.set(name, v);
      }
      v[key] = true;
    }

    function lengthCapTarget(node: any): string | undefined {
      if (node?.type !== 'BinaryExpression') return undefined;
      if (node.operator !== '>' && node.operator !== '>=') return undefined;
      const left = node.left;
      const right = node.right;
      if (left?.type !== 'MemberExpression') return undefined;
      if (left.property?.type !== 'Identifier' || left.property.name !== 'length') return undefined;
      if (left.object?.type !== 'Identifier') return undefined;
      if (right?.type !== 'Literal' || typeof right.value !== 'number') return undefined;
      return left.object.name;
    }

    return {
      BinaryExpression(node: any) {
        const typeofVar = typeofStringCheckTarget(node);
        if (typeofVar) markValidation(typeofVar, 'typeofStringChecked');

        const lengthVar = lengthCapTarget(node);
        if (lengthVar) markValidation(lengthVar, 'hasLengthCap');
      },

      CallExpression(node: any) {
        const prop = memberPropName(node);
        if (prop !== 'insert' && prop !== 'upsert') return;
        const objCall = chainObjectCall(node);
        if (!objCall || memberPropName(objCall) !== 'from') return;

        const arg = node.arguments?.[0];
        if (arg?.type !== 'ObjectExpression') return;

        const stringFields: { propNode: any; field: string; varName: string }[] = [];
        for (const p of arg.properties ?? []) {
          if (p?.type !== 'Property') continue;
          const field =
            p.key?.type === 'Identifier'
              ? p.key.name
              : p.key?.type === 'Literal'
                ? p.key.value
                : undefined;
          if (typeof field !== 'string') continue;
          const varName = resolvePropertyValueName(p);
          if (!varName) continue;
          const v = validations.get(varName);
          if (v?.typeofStringChecked) stringFields.push({ propNode: p, field, varName });
        }

        const capped = stringFields.filter((f) => validations.get(f.varName)?.hasLengthCap);
        const uncapped = stringFields.filter((f) => !validations.get(f.varName)?.hasLengthCap);
        if (capped.length === 0 || uncapped.length === 0) return;

        for (const f of uncapped) {
          context.report({
            node: f.propNode,
            messageId: 'inconsistentLengthLimit',
            data: { field: f.field, cappedField: capped[0].field },
          });
        }
      },
    };
  },
};

export const supabaseConsistentInputLengthLimitsRule = rule;
export default rule;
