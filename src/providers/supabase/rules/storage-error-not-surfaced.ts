/**
 * supabase-storage-error-not-surfaced (reliability)
 *
 * Storage `.upload()` failures return `{ error }` — `if (!uploadError) { ... }`
 * with no else branch silently continues with a stale URL.
 */
import { chainObjectCall, memberPropName } from '../utils.js';

function isStorageUploadCall(node: any): boolean {
  let current: any = node;
  let sawStorage = false;
  let sawUpload = false;
  while (current?.type === 'CallExpression') {
    const prop = memberPropName(current);
    if (prop === 'storage') sawStorage = true;
    if (prop === 'upload') sawUpload = true;
    current = chainObjectCall(current);
  }
  return sawStorage && sawUpload;
}

const rule = {
  meta: {
    type: 'suggestion',
    docs: {
      description: 'Supabase storage upload errors must be surfaced to the user',
      category: 'reliability',
      rationale:
        'Storage uploads return { error } without throwing. An if (!uploadError) block with no else lets the caller fall through to a profile save and success toast even when the file never uploaded — the user only notices later that their avatar or resume did not change.',
      docsUrl: 'https://supabase.com/docs/reference/javascript/storage-from-upload',
      recommended: true,
    },
    messages: {
      uploadErrorNotSurfaced:
        'Storage upload failure is ignored when uploadError is set — add an else branch to stop and show an error.',
    },
    schema: [],
  },
  create(context: any) {
    const uploadAwaitVars = new Set<string>();

    return {
      VariableDeclarator(node: any) {
        if (node.init?.type !== 'AwaitExpression') return;
        if (!isStorageUploadCall(node.init.argument)) return;
        if (node.id?.type === 'ObjectPattern') {
          for (const p of node.id.properties ?? []) {
            if (p?.type !== 'Property') continue;
            if (p.key?.type === 'Identifier' && p.key.name === 'error' && p.value?.type === 'Identifier') {
              uploadAwaitVars.add(p.value.name);
            }
          }
        }
      },
      IfStatement(node: any) {
        const test = node.test;
        if (test?.type !== 'UnaryExpression' || test.operator !== '!') return;
        const arg = test.argument;
        if (arg?.type !== 'Identifier') return;
        if (!uploadAwaitVars.has(arg.name) && !/uploadError|uploadErr/i.test(arg.name)) return;
        if (node.alternate) return;
        context.report({ node, messageId: 'uploadErrorNotSurfaced' });
      },
      'Program:exit'() {
        uploadAwaitVars.clear();
      },
    };
  },
};

export const supabaseStorageErrorNotSurfacedRule = rule;
export default rule;
