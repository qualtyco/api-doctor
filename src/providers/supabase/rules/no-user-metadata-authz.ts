/**
 * supabase-no-user-metadata-authz (security)
 *
 * `raw_user_meta_data` is client-writable — using `user_metadata` for roles
 * lets any authenticated user self-promote via updateUser({ data: { role } }).
 */
import { isUserMetadataAuthzRead, memberPropName } from '../utils.js';

const AUTHZ_DATA_KEYS = new Set(['role', 'roles', 'admin', 'is_admin', 'permission', 'permissions']);

function objectHasAuthzDataKey(objectExpression: any): boolean {
  if (objectExpression?.type !== 'ObjectExpression') return false;
  return (objectExpression.properties ?? []).some((p: any) => {
    if (p?.type !== 'Property') return false;
    const name =
      p.shorthand && p.key?.type === 'Identifier'
        ? p.key.name
        : p.key?.type === 'Identifier'
          ? p.key.name
          : p.key?.type === 'Literal'
            ? p.key.value
            : undefined;
    return typeof name === 'string' && AUTHZ_DATA_KEYS.has(name);
  });
}

function findAuthDataPayload(args: any[]): any | null {
  for (const arg of args) {
    if (arg?.type !== 'ObjectExpression') continue;
    for (const p of arg.properties ?? []) {
      if (p?.type !== 'Property') continue;
      const key =
        p.key?.type === 'Identifier' ? p.key.name : p.key?.type === 'Literal' ? p.key.value : undefined;
      if (key === 'data' && p.value?.type === 'ObjectExpression') return p.value;
      if (key === 'options' && p.value?.type === 'ObjectExpression') {
        for (const opt of p.value.properties ?? []) {
          if (opt?.type !== 'Property') continue;
          const optKey =
            opt.key?.type === 'Identifier'
              ? opt.key.name
              : opt.key?.type === 'Literal'
                ? opt.key.value
                : undefined;
          if (optKey === 'data' && opt.value?.type === 'ObjectExpression') return opt.value;
        }
      }
    }
  }
  return null;
}

function isAuthUserMetadataWrite(node: any): boolean {
  const prop = memberPropName(node);
  if (prop !== 'signUp' && prop !== 'updateUser') return false;
  const dataPayload = findAuthDataPayload(node.arguments ?? []);
  return dataPayload ? objectHasAuthzDataKey(dataPayload) : false;
}

const rule = {
  meta: {
    type: 'problem',
    docs: {
      description: 'Do not store or read authorization data from user_metadata',
      category: 'security',
      cwe: 'CWE-285',
      owasp: 'A01:2021 Broken Access Control',
      rationale:
        'Supabase documents raw_user_meta_data as client-writable and unsuitable for authorization. Reading user_metadata.role (or writing role into signUp/updateUser data) lets any signed-in user self-assign privileged roles from the browser. Store roles in app_metadata via a trusted server path, or in an RLS-protected profiles table.',
      docsUrl: 'https://supabase.com/docs/guides/database/postgres/row-level-security',
      recommended: true,
    },
    messages: {
      userMetadataAuthzRead:
        'Authorization is read from user_metadata, which the client can modify. Use app_metadata or a server-side role table instead.',
      userMetadataAuthzWrite:
        'Authorization data is written to user_metadata via signUp/updateUser, which the client can change later. Use app_metadata or a server-side role table instead.',
    },
    schema: [],
  },
  create(context: any) {
    return {
      MemberExpression(node: any) {
        if (isUserMetadataAuthzRead(node)) {
          context.report({ node, messageId: 'userMetadataAuthzRead' });
        }
      },
      CallExpression(node: any) {
        if (isAuthUserMetadataWrite(node)) {
          context.report({ node, messageId: 'userMetadataAuthzWrite' });
        }
      },
    };
  },
};

export const supabaseNoUserMetadataAuthzRule = rule;
export default rule;
