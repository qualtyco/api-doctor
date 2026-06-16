/**
 * First oxlint rule scaffold for v1: validates Resend webhook handlers
 * verify signatures before processing webhook payload.
 */
// Implemented with an ESLint-compatible visitor model (string matching avoided).
const rule = {
  meta: {
    type: 'problem',
    docs: {
      description: 'Resend webhook handlers must verify signatures before processing payloads',
      category: 'security',
      cwe: 'CWE-345',
      owasp: 'API2:2023 Broken Authentication',
      rationale:
        'Webhook endpoints are public URLs, so anyone who learns the path can POST a forged payload. Without verifying the Svix signature first, an attacker can fake delivery, bounce, or complaint events and drive your application into the wrong state. Validating the signature against your webhook secret before reading the body ensures the event genuinely came from Resend.',
      docsUrl: 'https://resend.com/docs/dashboard/webhooks/introduction#verify-webhook-signatures',
      recommended: true,
    },
    messages: {
      missingVerification:
        'This webhook handler processes Resend events without verifying the signature first.',
    },
  },
  // eslint-style rule API: `create(context)` returns visitor map.
  create(context: any) {
    let importsResend = false;
    const svixImports = new Set<string>();

    type Pos = { offset: number; line: number; column: number };
    type Handler = {
      node: any;
      start: Pos;
      end: Pos;
      firstBodyPos?: Pos;
      firstVerifyPos?: Pos;
    };

    const postHandlers: Handler[] = [];

    function nodeStartPos(n: any): Pos {
      const rangeStart = typeof n?.range?.[0] === 'number' ? n.range[0] : null;
      const line = n?.loc?.start?.line ?? 1;
      const column = n?.loc?.start?.column ?? 0;
      // Fallback ordering when range isn't available.
      const offset = rangeStart ?? line * 1_000_000 + column;
      return { offset, line, column };
    }

    function nodeEndPos(n: any): Pos {
      const rangeEnd = typeof n?.range?.[1] === 'number' ? n.range[1] : null;
      const line = n?.loc?.end?.line ?? n?.loc?.start?.line ?? 1;
      const column = n?.loc?.end?.column ?? n?.loc?.start?.column ?? 0;
      const offset = rangeEnd ?? line * 1_000_000 + column;
      return { offset, line, column };
    }

    function within(handler: Handler, n: any): boolean {
      const p = nodeStartPos(n);
      return p.offset >= handler.start.offset && p.offset <= handler.end.offset;
    }

    function isExportedPostHandler(fnNode: any): boolean {
      // FunctionDeclaration: `function POST() {}`
      if (fnNode?.type === 'FunctionDeclaration') return fnNode?.id?.name === 'POST';

      // VariableDeclaration init: `export const POST = async () => {}`
      return fnNode?.type === 'ArrowFunctionExpression' || fnNode?.type === 'FunctionExpression';
    }

    function getHandlerFromExportNamedDeclaration(node: any): Handler[] {
      const handlers: Handler[] = [];
      const decl = node?.declaration;
      if (!decl) return handlers;

      if (decl.type === 'FunctionDeclaration') {
        if (decl.id?.name === 'POST') {
          handlers.push({
            node: decl,
            start: nodeStartPos(decl),
            end: nodeEndPos(decl),
            firstBodyPos: undefined,
            firstVerifyPos: undefined,
          });
        }
        return handlers;
      }

      if (decl.type === 'VariableDeclaration') {
        for (const d of decl.declarations ?? []) {
          const idName = d?.id?.type === 'Identifier' ? d.id.name : null;
          if (idName !== 'POST') continue;
          const init = d?.init;
          if (!init) continue;
          if (!isExportedPostHandler(init)) continue;
          handlers.push({
            node: init,
            start: nodeStartPos(init),
            end: nodeEndPos(init),
            firstBodyPos: undefined,
            firstVerifyPos: undefined,
          });
        }
      }

      return handlers;
    }

    function isReqJsonCall(n: any): boolean {
      if (n?.type !== 'CallExpression') return false;
      const callee = n.callee;
      if (callee?.type !== 'MemberExpression') return false;
      const prop = callee.property;
      if (prop?.type !== 'Identifier' || prop.name !== 'json') return false;
      const obj = callee.object;
      return obj?.type === 'Identifier' && (obj.name === 'req' || obj.name === 'request');
    }

    function isBodyMember(n: any): boolean {
      if (n?.type !== 'MemberExpression') return false;
      const prop = n.property;
      if (prop?.type !== 'Identifier' || prop.name !== 'body') return false;
      const obj = n.object;
      return obj?.type === 'Identifier' && (obj.name === 'req' || obj.name === 'request');
    }

    function isCryptoCreateHmacCall(n: any): boolean {
      if (n?.type !== 'CallExpression') return false;
      const callee = n.callee;
      if (callee?.type !== 'MemberExpression') return false;
      const prop = callee.property;
      if (prop?.type !== 'Identifier' || prop.name !== 'createHmac') return false;
      // Prefer `crypto.createHmac`, but accept any `*.createHmac` to reduce false negatives.
      return callee.object?.type === 'Identifier' || callee.object?.type === 'MemberExpression';
    }

    function isSvixVerifyCall(n: any): boolean {
      if (n?.type !== 'CallExpression') return false;
      const callee = n.callee;
      if (callee?.type !== 'MemberExpression') return false;
      const prop = callee.property;
      if (prop?.type !== 'Identifier' || prop.name !== 'verify') return false;
      const obj = callee.object;
      return obj?.type === 'Identifier' && svixImports.has(obj.name);
    }

    function recordFirst(posKey: keyof Handler, handler: Handler, pos: Pos): void {
      // `firstBodyPos` and `firstVerifyPos` use Pos objects.
      const existing = handler[posKey as 'firstBodyPos' | 'firstVerifyPos'] as Pos | undefined;
      if (!existing) {
        (handler as any)[posKey] = pos;
        return;
      }
      if (pos.offset < existing.offset) {
        (handler as any)[posKey] = pos;
      }
    }

    return {
      ImportDeclaration(node: any) {
        const importSource = node?.source?.value;
        if (importSource === 'resend') importsResend = true;

        if (importSource === 'svix') {
          for (const s of node.specifiers ?? []) {
            // `import { Webhook as MyHook } from 'svix'`
            if (s?.type === 'ImportSpecifier' && s.local?.type === 'Identifier') {
              svixImports.add(s.local.name);
            }
            // `import Webhook from 'svix'` or `import * as svix from 'svix'`
            if ((s?.type === 'ImportDefaultSpecifier' || s?.type === 'ImportNamespaceSpecifier') && s.local?.type === 'Identifier') {
              svixImports.add(s.local.name);
            }
          }
        }
      },

      ExportNamedDeclaration(node: any) {
        const handlers = getHandlerFromExportNamedDeclaration(node);
        for (const h of handlers) postHandlers.push(h);
      },

      CallExpression(node: any) {
        if (postHandlers.length === 0) return;

        const pos = nodeStartPos(node);

        for (const handler of postHandlers) {
          if (!within(handler, node)) continue;

          if (isReqJsonCall(node)) recordFirst('firstBodyPos', handler, pos);
          if (isSvixVerifyCall(node)) recordFirst('firstVerifyPos', handler, pos);
          if (isCryptoCreateHmacCall(node)) recordFirst('firstVerifyPos', handler, pos);
        }
      },

      MemberExpression(node: any) {
        if (postHandlers.length === 0) return;
        if (!isBodyMember(node)) return;
        const pos = nodeStartPos(node);
        for (const handler of postHandlers) {
          if (!within(handler, node)) continue;
          recordFirst('firstBodyPos', handler, pos);
        }
      },

      'Program:exit'() {
        if (!importsResend) return;
        for (const handler of postHandlers) {
          if (!handler.firstVerifyPos) {
            context.report({ node: handler.node, messageId: 'missingVerification' });
            continue;
          }

          if (handler.firstBodyPos && handler.firstVerifyPos.offset > handler.firstBodyPos.offset) {
            context.report({ node: handler.node, messageId: 'missingVerification' });
          }
        }
      },
    };
  },
};

export const resendWebhookSignatureRule = rule;

