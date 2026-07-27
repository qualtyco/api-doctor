/**
 * s2-scoped-token-for-client (security)
 *
 * The account-wide S2_ACCESS_TOKEN is a bearer credential for every basin and
 * stream the issuer granted. Flags it reaching the browser: S2 client usage in
 * "use client" files, tokens read from NEXT_PUBLIC_* env vars (inlined into
 * the client bundle), and the admin token returned in an HTTP response body.
 * The documented pattern — issuing a scoped, expiring token on the server and
 * returning that — is not flagged.
 */
import {
  createS2FileTracker,
  findProperty,
  getObjectArg,
  processEnvVarName,
  unwrapExpr,
} from '../../utils.js';

function isAdminS2EnvName(name: string | null): boolean {
  if (!name) return false;
  if (name.startsWith('NEXT_PUBLIC_')) return false;
  return name.includes('S2') && (name.includes('TOKEN') || name.includes('ACCESS'));
}

function isPublicS2EnvName(name: string | null): boolean {
  if (!name) return false;
  return (
    name.startsWith('NEXT_PUBLIC_') && name.includes('S2') &&
    (name.includes('TOKEN') || name.includes('ACCESS'))
  );
}

const rule = {
  meta: {
    type: 'problem',
    docs: {
      description: 'Broad S2 access tokens must not be exposed to client-side code',
      category: 'security',
      cwe: 'CWE-522',
      owasp: 'API2:2023 Broken Authentication',
      rationale:
        'The account-level S2 access token can read, write, and delete every stream in the account. Shipping it in a client bundle or returning it from an endpoint hands that credential to any visitor, who can exfiltrate or corrupt data directly. S2 supports short-lived tokens scoped to a basin, stream prefix, and operation group — issue one of those on the server and hand only the scoped token to the client.',
      docsUrl: 'https://s2.dev/docs/sdk/access-tokens',
      recommended: true,
    },
    messages: {
      clientBundleToken:
        'S2 access token used in client-side code — it ships to the browser with the bundle. Issue a scoped token on the server instead.',
      tokenReturnedToClient:
        'Account-wide S2 access token returned in an HTTP response. Issue a short-lived scoped token (accessTokens.issue) and return that instead.',
    },
    schema: [],
  },
  create(context: any) {
    const tracker = createS2FileTracker();
    let useClientDirective = false;

    /** var name → env var it was initialized from. */
    const envVarByName = new Map<string, string>();
    /** `new S2({...})` nodes with the raw accessToken value expression. */
    const s2News: Array<{ node: any; accessTokenValue: any }> = [];
    /** Reads of admin/public S2 env vars (for "use client" files). */
    const envReadNodes: any[] = [];
    /** Response-body object properties to resolve at Program:exit. */
    const responseProps: Array<{ node: any; value: any }> = [];

    function envNameOf(expr: any): string | null {
      const n = unwrapExpr(expr);
      const direct = processEnvVarName(n);
      if (direct) return direct;
      if (n?.type === 'Identifier') return envVarByName.get(n.name) ?? null;
      return null;
    }

    return {
      Program(node: any) {
        for (const stmt of node?.body ?? []) {
          if (stmt?.type !== 'ExpressionStatement') break;
          const expr = stmt.expression;
          if (expr?.type === 'Literal' && expr.value === 'use client') {
            useClientDirective = true;
          }
          if (typeof stmt.directive !== 'string') break;
        }
      },

      ImportDeclaration(node: any) {
        tracker.visitImport(node);
      },

      VariableDeclarator(node: any) {
        if (node?.id?.type !== 'Identifier' || !node.init) return;
        const envName = processEnvVarName(node.init);
        if (envName) envVarByName.set(node.id.name, envName);
      },

      NewExpression(node: any) {
        tracker.visitNew(node);
        const callee = unwrapExpr(node?.callee);
        if (callee?.type !== 'Identifier') return;
        const isS2Ctor = callee.name === 'S2' || tracker.localNames('S2').has(callee.name);
        if (!isS2Ctor) return;
        const config = getObjectArg(node, 0);
        const accessToken = config ? findProperty(config, 'accessToken') : undefined;
        s2News.push({ node, accessTokenValue: accessToken?.value });
      },

      MemberExpression(node: any) {
        const name = processEnvVarName(node);
        if (isAdminS2EnvName(name) || isPublicS2EnvName(name)) envReadNodes.push(node);
      },

      CallExpression(node: any) {
        // Response senders: `NextResponse.json({...})`, `Response.json({...})`,
        // `res.json({...})`, `res.send({...})`, `reply.send({...})`. Requiring an
        // argument keeps `await response.json()` (reading a fetch body) out.
        const callee = unwrapExpr(node?.callee);
        if (callee?.type !== 'MemberExpression') return;
        const prop = callee.property;
        if (prop?.type !== 'Identifier') return;
        const obj = unwrapExpr(callee.object);
        if (obj?.type !== 'Identifier') return;
        const sendsJson =
          prop.name === 'json' &&
          ['Response', 'NextResponse', 'res', 'response', 'reply'].includes(obj.name);
        const sendsBody = prop.name === 'send' && ['res', 'reply', 'response'].includes(obj.name);
        if (!sendsJson && !sendsBody) return;
        const body = getObjectArg(node, 0);
        if (!body) return;
        for (const p of body.properties ?? []) {
          if (p?.type !== 'Property') continue;
          responseProps.push({ node: p, value: p.shorthand ? p.key : p.value });
        }
      },

      'Program:exit'() {
        // (b) NEXT_PUBLIC_* tokens are inlined into the browser bundle no
        // matter where the constructor runs.
        const reported = new Set<any>();
        for (const { node, accessTokenValue } of s2News) {
          if (isPublicS2EnvName(envNameOf(accessTokenValue))) {
            context.report({ node, messageId: 'clientBundleToken' });
            reported.add(node);
          }
        }

        // (a) Any S2 client construction or S2 token env read inside a
        // "use client" module executes in the browser. An S2_* token env
        // read is itself sufficient provider evidence.
        if (useClientDirective && (tracker.isS2File() || envReadNodes.length > 0)) {
          for (const { node } of s2News) {
            if (!reported.has(node)) context.report({ node, messageId: 'clientBundleToken' });
          }
          if (s2News.length === 0) {
            for (const node of envReadNodes) {
              context.report({ node, messageId: 'clientBundleToken' });
            }
          }
        }

        // (c) Admin token in a response body — scoped tokens issued via
        // accessTokens.issue() resolve to call results, not S2_* env vars,
        // so the documented return-a-scoped-token pattern stays clean.
        for (const { node, value } of responseProps) {
          if (isAdminS2EnvName(envNameOf(value))) {
            context.report({ node, messageId: 'tokenReturnedToClient' });
          }
        }
      },
    };
  },
};

export const s2ScopedTokenForClientRule = rule;
export default rule;
