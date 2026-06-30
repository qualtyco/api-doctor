/**
 * tiptap-upload-validate-fn-void (security)
 *
 * Flags two patterns:
 *   (a) An interface/type with a property `validateFn` typed as returning `void`
 *       when it also has an `onUpload` property — the void return type means the
 *       caller can never act on the validation result.
 *   (b) A bare ExpressionStatement that calls `validateFn(...)` or `validateFn?.(...)`,
 *       discarding the return value silently.
 */

const rule = {
  meta: {
    type: 'problem',
    docs: {
      description: 'validateFn must return boolean so callers can act on the result',
      category: 'security',
      cwe: 'CWE-20',
      owasp: 'API3:2023 Broken Object Property Level Authorization',
      rationale:
        'When validateFn is typed as (file: File) => void, the return value is always discarded. A consumer that returns false to reject an oversized or wrong-type file will have that rejection silently ignored — the upload proceeds regardless. Changing the return type to boolean and guarding with if (validateFn && !validateFn(file)) return; ensures validation actually blocks uploads.',
      docsUrl: 'https://tiptap.dev/docs/editor/extensions/custom-extensions/node-views',
      recommended: true,
    },
    messages: {
      validateFnVoid:
        'validateFn return value is discarded. Change the return type to boolean and guard the call: if (validateFn && !validateFn(file)) return;',
    },
    schema: [],
  },
  create(context: any) {
    let importsTiptap = false;

    function isVoidReturnType(typeAnnotation: any): boolean {
      if (!typeAnnotation) return false;
      // TSTypeAnnotation wraps the actual type
      const t = typeAnnotation.typeAnnotation ?? typeAnnotation;
      // (file: File) => void  →  TSFunctionType with returnType TSVoidKeyword
      if (t?.type === 'TSFunctionType') {
        const ret = t.returnType?.typeAnnotation ?? t.returnType;
        return ret?.type === 'TSVoidKeyword';
      }
      // TSTypeReference or similar wrapping
      return false;
    }

    function hasProperty(members: any[], name: string): boolean {
      return members?.some(
        (m: any) =>
          (m?.key?.type === 'Identifier' && m.key.name === name) ||
          (m?.key?.type === 'Literal' && m.key.value === name),
      ) ?? false;
    }

    return {
      ImportDeclaration(node: any) {
        const src: string = node?.source?.value ?? '';
        if (src.startsWith('@tiptap/')) importsTiptap = true;
      },

      // Pattern (a): interface / type with validateFn: (...) => void + onUpload
      TSInterfaceDeclaration(node: any) {
        const members = node?.body?.body ?? [];
        if (!hasProperty(members, 'onUpload')) return;
        for (const member of members) {
          const name =
            member?.key?.type === 'Identifier'
              ? member.key.name
              : member?.key?.type === 'Literal'
              ? member.key.value
              : null;
          if (name !== 'validateFn') continue;
          const typeAnno = member.typeAnnotation;
          if (isVoidReturnType(typeAnno)) {
            context.report({ node: member, messageId: 'validateFnVoid' });
          }
        }
      },

      // Pattern (b): validateFn?.() or validateFn() used as a bare statement
      ExpressionStatement(node: any) {
        const expr = node.expression;
        // Unwrap optional chain: validateFn?.(file) → ChainExpression → CallExpression
        const call =
          expr?.type === 'CallExpression'
            ? expr
            : expr?.type === 'ChainExpression' && expr.expression?.type === 'CallExpression'
            ? expr.expression
            : null;
        if (!call) return;

        const callee = call.callee;
        // callee may be Identifier(validateFn) or MemberExpression(...).validateFn
        const calleeName =
          callee?.type === 'Identifier'
            ? callee.name
            : callee?.type === 'MemberExpression' && callee.property?.type === 'Identifier'
            ? callee.property.name
            : null;
        if (calleeName !== 'validateFn') return;

        context.report({ node, messageId: 'validateFnVoid' });
      },
    };
  },
};

export const tiptapUploadValidateFnVoidRule = rule;
export default rule;
