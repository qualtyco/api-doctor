#!/usr/bin/env node

// src/cli.ts
import { Command } from "commander";
import { readFileSync } from "fs";
import { dirname as dirname2, join as join3, relative as relative2, resolve as resolve2 } from "path";
import { fileURLToPath } from "url";

// src/providers/resend/manifest.ts
var resendManifest = {
  name: "resend",
  displayName: "Resend",
  detect: {
    packages: ["resend"],
    imports: ["resend"],
    urlPatterns: ["api.resend.com"]
  },
  oxlintRules: [
    {
      key: "resend-webhook-signature",
      resultRule: "resend/webhook-signature-missing",
      message: "This webhook handler appears to process Resend events without verifying the webhook signature.",
      fix: "Verify incoming webhooks with Svix (Resend uses Svix signatures). Validate headers and payload before handling events.",
      docsUrl: "https://resend.com/docs/dashboard/webhooks/introduction#verify-webhook-signatures",
      severity: "error"
    },
    {
      key: "resend-api-key-hardcoded",
      resultRule: "resend/security/api-key-hardcoded",
      message: "Hardcoded Resend API key found in source code.",
      fix: "Move the key to an environment variable and read it via process.env.RESEND_API_KEY.",
      docsUrl: "https://resend.com/docs/send-with-nextjs#prerequisites",
      severity: "error"
    },
    {
      key: "resend-api-key-in-client-bundle",
      resultRule: "resend/security/api-key-in-client-bundle",
      message: "Resend SDK imported into client-bundled code, which can leak the API key.",
      fix: "Import and use Resend only in server code (route handlers, server actions, server components).",
      docsUrl: "https://resend.com/docs/send-with-nextjs",
      severity: "error"
    },
    {
      key: "resend-marketing-via-batch-send",
      resultRule: "resend/correctness/marketing-via-batch-send",
      message: "Marketing email sent via resend.batch.send instead of the Broadcasts API.",
      fix: "Use the Broadcasts API (resend.broadcasts.*) or the Dashboard Broadcasts workflow for marketing sends.",
      docsUrl: "https://resend.com/docs/dashboard/emails/batch-sending",
      severity: "error"
    },
    {
      key: "resend-marketing-missing-unsubscribe",
      resultRule: "resend/correctness/marketing-missing-unsubscribe",
      message: "Marketing email has no unsubscribe mechanism.",
      fix: "Add a List-Unsubscribe header (RFC 8058) or include {{{RESEND_UNSUBSCRIBE_URL}}} in the HTML, or send via Broadcasts.",
      docsUrl: "https://resend.com/docs/dashboard/broadcasts/introduction",
      severity: "error"
    },
    {
      key: "resend-test-domain-in-production-path",
      resultRule: "resend/correctness/test-domain-in-production-path",
      message: "Test-only sender onboarding@resend.dev used in production code.",
      fix: "Send from a verified domain configured via process.env.RESEND_FROM_EMAIL.",
      docsUrl: "https://resend.com/docs/send-with-nextjs",
      severity: "warning"
    },
    {
      key: "resend-from-address-not-friendly-format",
      resultRule: "resend/integration/from-address-not-friendly-format",
      message: 'From address is a bare email rather than the "Name <email>" format.',
      fix: 'Use a friendly-name sender, e.g. "Acme <onboarding@acme.com>".',
      docsUrl: "https://resend.com/docs/api-reference/emails/send-email",
      severity: "info"
    },
    {
      key: "resend-batch-size-not-enforced",
      resultRule: "resend/reliability/batch-size-not-enforced",
      message: "resend.batch.send called without enforcing the 100-email limit.",
      fix: "Guard the array length (max 100) before calling batch.send, or chunk the array.",
      docsUrl: "https://resend.com/docs/api-reference/emails/send-batch-emails",
      severity: "warning"
    },
    {
      key: "resend-missing-idempotency-key",
      resultRule: "resend/reliability/missing-idempotency-key",
      message: "Resend send/batch call has no idempotencyKey.",
      fix: "Pass an idempotencyKey (e.g. welcome/${userId}) to prevent duplicate sends on retry.",
      docsUrl: "https://resend.com/docs/send-with-nextjs",
      severity: "warning"
    },
    {
      key: "resend-no-error-code-mapping",
      resultRule: "resend/reliability/no-error-code-mapping",
      message: "Resend errors are returned as a blanket HTTP 500.",
      fix: "Map Resend error codes (400/401/403/422/429) to appropriate HTTP statuses instead of always 500.",
      docsUrl: "https://resend.com/docs/ai-onboarding",
      severity: "warning"
    },
    {
      key: "resend-webhook-no-idempotency",
      resultRule: "resend/reliability/webhook-no-idempotency",
      message: "Resend webhook handler does not deduplicate retried events.",
      fix: "Track processed event ids (e.g. event.data.email_id) in a store or set, since Resend retries for 24h.",
      docsUrl: "https://resend.com/docs/dashboard/webhooks/introduction",
      severity: "warning"
    },
    {
      key: "resend-missing-tags",
      resultRule: "resend/integration/missing-tags",
      message: "Resend send has no tags for deliverability segmentation.",
      fix: 'Add tags, e.g. tags: [{ name: "category", value: "welcome" }].',
      docsUrl: "https://resend.com/docs/dashboard/emails/tags",
      severity: "info"
    },
    {
      key: "resend-request-id-not-logged",
      resultRule: "resend/integration/request-id-not-logged",
      message: "Resend error handler does not log the request id.",
      fix: 'Log error.headers?.["x-request-id"] (or x-resend-request-id) alongside error.message.',
      docsUrl: "https://resend.com/docs/api-reference/errors",
      severity: "info"
    }
  ]
};

// src/providers/railway/manifest.ts
var railwayManifest = {
  name: "railway",
  displayName: "Railway",
  detect: {
    packages: ["pg"],
    imports: ["pg"],
    urlPatterns: ["railway.app", "railway.com", "rlwy.net"]
  },
  oxlintRules: [
    {
      key: "railway-cron-service-must-share-schema-bootstrap",
      resultRule: "railway/correctness/cron-service-must-share-schema-bootstrap",
      message: "This script queries a table directly but never bootstraps the schema (e.g. ensureSchema()).",
      fix: "Import and call the shared schema bootstrap (e.g. await ensureSchema()) before querying, so a cron service running before the web app has created the table does not crash on a missing relation.",
      docsUrl: "https://docs.railway.com/guides/cron-jobs",
      severity: "error"
    },
    {
      key: "railway-no-unauthenticated-public-write-endpoint",
      resultRule: "railway/security/no-unauthenticated-public-write-endpoint",
      message: "This write route handler persists request data without any authentication check.",
      fix: "Gate the handler behind an auth check (token header, session, or origin) before persisting \u2014 a Railway public domain turns this into an open write API.",
      docsUrl: "https://docs.railway.com/guides/public-networking",
      severity: "error"
    },
    {
      key: "railway-pg-pool-requires-error-handler",
      resultRule: "railway/reliability/pg-pool-requires-error-handler",
      message: 'pg Pool created without a pool.on("error", ...) handler.',
      fix: 'Attach pool.on("error", (err) => ...) \u2014 an idle client backend error with no listener throws and crashes the Node process when Railway drops connections.',
      docsUrl: "https://node-postgres.com/apis/pool#events",
      severity: "error"
    },
    {
      key: "railway-validate-request-payload-bounds",
      resultRule: "railway/security/validate-request-payload-bounds",
      message: "Persisted request payload is type-checked but has no length/size bound.",
      fix: "Add an explicit length cap (e.g. expression.length > 200) before persisting, to prevent unbounded growth of Railway-metered Postgres storage.",
      docsUrl: "https://docs.railway.com/guides/postgresql",
      severity: "warning"
    },
    {
      key: "railway-no-raw-error-logging-near-db-connection",
      resultRule: "railway/security/no-raw-error-logging-near-db-connection",
      message: "Raw error object logged in a database-connection context.",
      fix: "Log err.message instead of the whole error \u2014 pg connection errors can carry the DATABASE_URL (with password) into Railway logs.",
      docsUrl: "https://docs.railway.com/guides/logs",
      severity: "warning"
    },
    {
      key: "railway-no-ddl-in-request-handler",
      resultRule: "railway/correctness/no-ddl-in-request-handler",
      message: "Schema DDL (CREATE TABLE / ensureSchema) runs inside a request handler.",
      fix: "Run schema creation once at deploy time (e.g. a preDeployCommand migration) rather than on the hot request path, where CREATE TABLE IF NOT EXISTS can race across replicas.",
      docsUrl: "https://docs.railway.com/reference/config-as-code",
      severity: "warning"
    }
  ]
};

// src/providers/stripe/manifest.ts
var stripeManifest = {
  name: "stripe",
  displayName: "Stripe",
  detect: {
    packages: ["stripe", "@stripe/stripe-js"],
    imports: ["stripe", "@stripe/stripe-js"],
    urlPatterns: ["api.stripe.com"]
  },
  oxlintRules: []
};

// src/providers/supabase/manifest.ts
var supabaseManifest = {
  name: "supabase",
  displayName: "Supabase",
  detect: {
    packages: ["@supabase/supabase-js", "@supabase/ssr"],
    imports: ["@supabase/supabase-js", "@supabase/ssr"],
    urlPatterns: ["supabase.co"]
  },
  oxlintRules: []
};

// src/providers/index.ts
var providers = [
  resendManifest,
  railwayManifest,
  stripeManifest,
  supabaseManifest
];

// src/reporter/json-writer.ts
import { existsSync, mkdirSync, writeFileSync } from "fs";
import { basename, dirname } from "path";
var DEFAULT_REPORT_DIR = ".api-doctor";
var DEFAULT_REPORT_FILE = "report.json";
function writeReport(report, outputPath) {
  const dir = dirname(outputPath);
  mkdirSync(dir, { recursive: true });
  if (basename(dir) === DEFAULT_REPORT_DIR) {
    const gitignorePath = `${dir}/.gitignore`;
    if (!existsSync(gitignorePath)) {
      writeFileSync(gitignorePath, "*\n", "utf-8");
    }
  }
  writeFileSync(outputPath, `${JSON.stringify(report, null, 2)}
`, "utf-8");
}

// src/constants.ts
var PLUGIN_NAME = "api-doctor";

// src/providers/resend/rules/webhook-signature.ts
var rule = {
  meta: {
    type: "problem",
    docs: {
      description: "Resend webhook handlers must verify signatures before processing payloads",
      category: "security",
      cwe: "CWE-345",
      owasp: "API2:2023 Broken Authentication",
      rationale: "Webhook endpoints are public URLs, so anyone who learns the path can POST a forged payload. Without verifying the Svix signature first, an attacker can fake delivery, bounce, or complaint events and drive your application into the wrong state. Validating the signature against your webhook secret before reading the body ensures the event genuinely came from Resend.",
      docsUrl: "https://resend.com/docs/dashboard/webhooks/introduction#verify-webhook-signatures",
      recommended: true
    },
    messages: {
      missingVerification: "This webhook handler processes Resend events without verifying the signature first."
    }
  },
  // eslint-style rule API: `create(context)` returns visitor map.
  create(context) {
    let importsResend = false;
    const svixImports = /* @__PURE__ */ new Set();
    const postHandlers = [];
    function nodeStartPos(n) {
      const rangeStart = typeof n?.range?.[0] === "number" ? n.range[0] : null;
      const line = n?.loc?.start?.line ?? 1;
      const column = n?.loc?.start?.column ?? 0;
      const offset = rangeStart ?? line * 1e6 + column;
      return { offset, line, column };
    }
    function nodeEndPos(n) {
      const rangeEnd = typeof n?.range?.[1] === "number" ? n.range[1] : null;
      const line = n?.loc?.end?.line ?? n?.loc?.start?.line ?? 1;
      const column = n?.loc?.end?.column ?? n?.loc?.start?.column ?? 0;
      const offset = rangeEnd ?? line * 1e6 + column;
      return { offset, line, column };
    }
    function within(handler, n) {
      const p = nodeStartPos(n);
      return p.offset >= handler.start.offset && p.offset <= handler.end.offset;
    }
    function isExportedPostHandler(fnNode) {
      if (fnNode?.type === "FunctionDeclaration") return fnNode?.id?.name === "POST";
      return fnNode?.type === "ArrowFunctionExpression" || fnNode?.type === "FunctionExpression";
    }
    function getHandlerFromExportNamedDeclaration(node) {
      const handlers = [];
      const decl = node?.declaration;
      if (!decl) return handlers;
      if (decl.type === "FunctionDeclaration") {
        if (decl.id?.name === "POST") {
          handlers.push({
            node: decl,
            start: nodeStartPos(decl),
            end: nodeEndPos(decl),
            firstBodyPos: void 0,
            firstVerifyPos: void 0
          });
        }
        return handlers;
      }
      if (decl.type === "VariableDeclaration") {
        for (const d of decl.declarations ?? []) {
          const idName = d?.id?.type === "Identifier" ? d.id.name : null;
          if (idName !== "POST") continue;
          const init = d?.init;
          if (!init) continue;
          if (!isExportedPostHandler(init)) continue;
          handlers.push({
            node: init,
            start: nodeStartPos(init),
            end: nodeEndPos(init),
            firstBodyPos: void 0,
            firstVerifyPos: void 0
          });
        }
      }
      return handlers;
    }
    function isReqJsonCall(n) {
      if (n?.type !== "CallExpression") return false;
      const callee = n.callee;
      if (callee?.type !== "MemberExpression") return false;
      const prop = callee.property;
      if (prop?.type !== "Identifier" || prop.name !== "json") return false;
      const obj = callee.object;
      return obj?.type === "Identifier" && (obj.name === "req" || obj.name === "request");
    }
    function isBodyMember(n) {
      if (n?.type !== "MemberExpression") return false;
      const prop = n.property;
      if (prop?.type !== "Identifier" || prop.name !== "body") return false;
      const obj = n.object;
      return obj?.type === "Identifier" && (obj.name === "req" || obj.name === "request");
    }
    function isCryptoCreateHmacCall(n) {
      if (n?.type !== "CallExpression") return false;
      const callee = n.callee;
      if (callee?.type !== "MemberExpression") return false;
      const prop = callee.property;
      if (prop?.type !== "Identifier" || prop.name !== "createHmac") return false;
      return callee.object?.type === "Identifier" || callee.object?.type === "MemberExpression";
    }
    function isSvixVerifyCall(n) {
      if (n?.type !== "CallExpression") return false;
      const callee = n.callee;
      if (callee?.type !== "MemberExpression") return false;
      const prop = callee.property;
      if (prop?.type !== "Identifier" || prop.name !== "verify") return false;
      const obj = callee.object;
      return obj?.type === "Identifier" && svixImports.has(obj.name);
    }
    function recordFirst(posKey, handler, pos) {
      const existing = handler[posKey];
      if (!existing) {
        handler[posKey] = pos;
        return;
      }
      if (pos.offset < existing.offset) {
        handler[posKey] = pos;
      }
    }
    return {
      ImportDeclaration(node) {
        const importSource = node?.source?.value;
        if (importSource === "resend") importsResend = true;
        if (importSource === "svix") {
          for (const s of node.specifiers ?? []) {
            if (s?.type === "ImportSpecifier" && s.local?.type === "Identifier") {
              svixImports.add(s.local.name);
            }
            if ((s?.type === "ImportDefaultSpecifier" || s?.type === "ImportNamespaceSpecifier") && s.local?.type === "Identifier") {
              svixImports.add(s.local.name);
            }
          }
        }
      },
      ExportNamedDeclaration(node) {
        const handlers = getHandlerFromExportNamedDeclaration(node);
        for (const h of handlers) postHandlers.push(h);
      },
      CallExpression(node) {
        if (postHandlers.length === 0) return;
        const pos = nodeStartPos(node);
        for (const handler of postHandlers) {
          if (!within(handler, node)) continue;
          if (isReqJsonCall(node)) recordFirst("firstBodyPos", handler, pos);
          if (isSvixVerifyCall(node)) recordFirst("firstVerifyPos", handler, pos);
          if (isCryptoCreateHmacCall(node)) recordFirst("firstVerifyPos", handler, pos);
        }
      },
      MemberExpression(node) {
        if (postHandlers.length === 0) return;
        if (!isBodyMember(node)) return;
        const pos = nodeStartPos(node);
        for (const handler of postHandlers) {
          if (!within(handler, node)) continue;
          recordFirst("firstBodyPos", handler, pos);
        }
      },
      "Program:exit"() {
        if (!importsResend) return;
        for (const handler of postHandlers) {
          if (!handler.firstVerifyPos) {
            context.report({ node: handler.node, messageId: "missingVerification" });
            continue;
          }
          if (handler.firstBodyPos && handler.firstVerifyPos.offset > handler.firstBodyPos.offset) {
            context.report({ node: handler.node, messageId: "missingVerification" });
          }
        }
      }
    };
  }
};
var resendWebhookSignatureRule = rule;

// src/providers/resend/rules/api-key-hardcoded.ts
var RESEND_KEY_PATTERN = /\bre_[A-Za-z0-9_]+/;
var rule2 = {
  meta: {
    type: "problem",
    docs: {
      description: "Resend API keys must not be hardcoded; load them from environment variables",
      category: "security",
      cwe: "CWE-798",
      owasp: "API8:2023 Security Misconfiguration",
      rationale: "A hardcoded API key gets committed to version control, where it lives in git history forever and is exposed to anyone with repository access. Leaked Resend keys let attackers send mail from your domain, damaging sender reputation and deliverability. Reading the key from process.env.RESEND_API_KEY keeps the secret out of source code and lets you rotate it without a redeploy.",
      docsUrl: "https://resend.com/docs/send-with-nextjs#prerequisites",
      recommended: true
    },
    messages: {
      hardcodedApiKey: "Hardcoded Resend API key detected. Load the key from process.env.RESEND_API_KEY instead."
    },
    schema: []
  },
  create(context) {
    return {
      Literal(node) {
        if (typeof node.value !== "string") return;
        if (RESEND_KEY_PATTERN.test(node.value)) {
          context.report({ node, messageId: "hardcodedApiKey" });
        }
      },
      TemplateElement(node) {
        const cooked = node?.value?.cooked ?? node?.value?.raw;
        if (typeof cooked !== "string") return;
        if (RESEND_KEY_PATTERN.test(cooked)) {
          context.report({ node, messageId: "hardcodedApiKey" });
        }
      }
    };
  }
};
var resendApiKeyHardcodedRule = rule2;

// src/providers/resend/rules/api-key-in-client-bundle.ts
function isComponentsPath(filename) {
  return /[\\/]components[\\/]/.test(filename);
}
var rule3 = {
  meta: {
    type: "problem",
    docs: {
      description: "The Resend SDK must not be imported into client-bundled code",
      category: "security",
      cwe: "CWE-200",
      owasp: "API8:2023 Security Misconfiguration",
      rationale: 'The Resend SDK is server-only and is initialized with your secret API key. Importing it into a "use client" component or other browser-bundled code ships that key to every visitor, where it can be read straight from the page source. Keeping Resend imports in server code (route handlers, server actions, server components) ensures the key never reaches the client.',
      docsUrl: "https://resend.com/docs/send-with-nextjs",
      recommended: true
    },
    messages: {
      clientBundleImport: "Resend is imported into client-bundled code. Keep Resend (and its API key) on the server."
    },
    schema: []
  },
  create(context) {
    let resendImportNode = null;
    let hasUseClient = false;
    let hasJsx = false;
    return {
      Program(node) {
        for (const stmt of node.body ?? []) {
          if (stmt?.type !== "ExpressionStatement") continue;
          const directive = stmt.directive ?? (stmt.expression?.type === "Literal" ? stmt.expression.value : void 0);
          if (directive === "use client") {
            hasUseClient = true;
            break;
          }
        }
      },
      ImportDeclaration(node) {
        if (node?.source?.value !== "resend") return;
        if (node.importKind === "type") return;
        const allSpecifiersAreType = Array.isArray(node.specifiers) && node.specifiers.length > 0 && node.specifiers.every((s) => s.importKind === "type");
        if (allSpecifiersAreType) return;
        resendImportNode = node;
      },
      JSXElement() {
        hasJsx = true;
      },
      JSXFragment() {
        hasJsx = true;
      },
      "Program:exit"() {
        if (!resendImportNode) return;
        const inClientBundle = hasUseClient || isComponentsPath(String(context.filename ?? "")) && hasJsx;
        if (inClientBundle) {
          context.report({ node: resendImportNode, messageId: "clientBundleImport" });
        }
      }
    };
  }
};
var resendApiKeyInClientBundleRule = rule3;

// src/providers/resend/utils.ts
function isResendEmailsSendCall(node) {
  if (node?.type !== "CallExpression") return false;
  const callee = node.callee;
  if (callee?.type !== "MemberExpression") return false;
  if (callee.property?.type !== "Identifier" || callee.property.name !== "send") return false;
  const obj = callee.object;
  return obj?.type === "MemberExpression" && obj.property?.type === "Identifier" && obj.property.name === "emails";
}
function isResendBatchSendCall(node) {
  if (node?.type !== "CallExpression") return false;
  const callee = node.callee;
  if (callee?.type !== "MemberExpression") return false;
  if (callee.property?.type !== "Identifier" || callee.property.name !== "send") return false;
  const obj = callee.object;
  return obj?.type === "MemberExpression" && obj.property?.type === "Identifier" && obj.property.name === "batch";
}
function isResendSendCall(node) {
  return isResendEmailsSendCall(node) || isResendBatchSendCall(node);
}
function getObjectArg(node, index) {
  const arg = node?.arguments?.[index];
  return arg?.type === "ObjectExpression" ? arg : null;
}
function getSendOptionObjects(node) {
  if (isResendEmailsSendCall(node)) {
    const opts = getObjectArg(node, 0);
    return opts ? [opts] : [];
  }
  if (isResendBatchSendCall(node)) {
    const arr = node?.arguments?.[0];
    if (arr?.type !== "ArrayExpression") return [];
    return (arr.elements ?? []).filter((el) => el?.type === "ObjectExpression");
  }
  return [];
}
function findProperty(objectExpression, name) {
  if (objectExpression?.type !== "ObjectExpression") return void 0;
  return objectExpression.properties?.find(
    (p) => p?.type === "Property" && (p.key?.type === "Identifier" && p.key.name === name || p.key?.type === "Literal" && p.key.value === name)
  );
}
function isInsideTestFile(filename) {
  return /(^|[\\/])__tests__[\\/]|\.(test|spec)\.[cm]?[jt]sx?$/.test(filename);
}
function startOffset(n) {
  if (typeof n?.range?.[0] === "number") return n.range[0];
  if (typeof n?.start === "number") return n.start;
  return (n?.loc?.start?.line ?? 0) * 1e6 + (n?.loc?.start?.column ?? 0);
}
function endOffset(n) {
  if (typeof n?.range?.[1] === "number") return n.range[1];
  if (typeof n?.end === "number") return n.end;
  return (n?.loc?.end?.line ?? n?.loc?.start?.line ?? 0) * 1e6 + (n?.loc?.end?.column ?? 0);
}
function contains(outer, inner) {
  const s = startOffset(inner);
  return s >= startOffset(outer) && s <= endOffset(outer);
}

// src/providers/resend/rules/marketing-via-batch-send.ts
var MARKETING_PATH = /marketing|campaign|newsletter|promotion|broadcast/i;
var rule4 = {
  meta: {
    type: "problem",
    docs: {
      description: "Marketing emails should use the Broadcasts API, not resend.batch.send",
      category: "correctness",
      rationale: "resend.batch.send is the transactional batch API; Resend documents Broadcasts as the correct feature for marketing and campaign sends. Using batch send for promotional mail skips audience management, consent tracking, and the automatic unsubscribe handling that Broadcasts provide, which puts you out of step with CAN-SPAM/CASL. Sending campaigns through Broadcasts (or the Dashboard) keeps deliverability and compliance intact.",
      docsUrl: "https://resend.com/docs/dashboard/emails/batch-sending",
      recommended: true
    },
    messages: {
      marketingViaBatch: "Marketing/campaign email sent via resend.batch.send. Use the Broadcasts API for marketing sends."
    },
    schema: []
  },
  create(context) {
    const isMarketingFile = MARKETING_PATH.test(String(context.filename ?? ""));
    return {
      CallExpression(node) {
        if (!isMarketingFile) return;
        if (isResendBatchSendCall(node)) {
          context.report({ node, messageId: "marketingViaBatch" });
        }
      }
    };
  }
};
var resendMarketingViaBatchSendRule = rule4;

// src/providers/resend/rules/marketing-missing-unsubscribe.ts
var MARKETING_TAG = /marketing|campaign|newsletter|promotion/i;
var UNSUBSCRIBE_PLACEHOLDER = "{{{RESEND_UNSUBSCRIBE_URL}}}";
function literalString(node) {
  if (node?.type === "Literal" && typeof node.value === "string") return node.value;
  if (node?.type === "TemplateLiteral") {
    return (node.quasis ?? []).map((q) => q?.value?.cooked ?? q?.value?.raw ?? "").join(" ");
  }
  return void 0;
}
function hasMarketingTag(opts) {
  const tagsProp = findProperty(opts, "tags");
  const arr = tagsProp?.value;
  if (arr?.type !== "ArrayExpression") return false;
  for (const el of arr.elements ?? []) {
    if (el?.type !== "ObjectExpression") continue;
    const valueProp = findProperty(el, "value");
    const v = literalString(valueProp?.value);
    if (typeof v === "string" && MARKETING_TAG.test(v)) return true;
  }
  return false;
}
function hasListUnsubscribeHeader(opts) {
  const headersProp = findProperty(opts, "headers");
  const obj = headersProp?.value;
  if (obj?.type !== "ObjectExpression") return false;
  return (obj.properties ?? []).some((p) => {
    if (p?.type !== "Property") return false;
    const key = p.key?.type === "Literal" ? String(p.key.value) : p.key?.type === "Identifier" ? p.key.name : "";
    return key.toLowerCase() === "list-unsubscribe";
  });
}
function htmlHasUnsubscribePlaceholder(opts) {
  const htmlProp = findProperty(opts, "html");
  const text = literalString(htmlProp?.value);
  return typeof text === "string" && text.includes(UNSUBSCRIBE_PLACEHOLDER);
}
function hasUnsubscribeMechanism(opts) {
  return hasListUnsubscribeHeader(opts) || htmlHasUnsubscribePlaceholder(opts);
}
var rule5 = {
  meta: {
    type: "problem",
    docs: {
      description: "Marketing emails must include an unsubscribe mechanism",
      category: "correctness",
      rationale: 'Marketing email is regulated by laws like CAN-SPAM (US) and CASL (Canada), which require recipients to be able to opt out. A campaign with only static "you opted in" text and no working unsubscribe path exposes you to legal penalties and gets flagged as spam, hurting deliverability for all your mail. Adding a List-Unsubscribe header (RFC 8058) or the {{{RESEND_UNSUBSCRIBE_URL}}} placeholder gives recipients a real way to opt out.',
      docsUrl: "https://resend.com/docs/dashboard/broadcasts/introduction",
      recommended: true
    },
    messages: {
      missingUnsubscribe: "Marketing email has no unsubscribe mechanism (List-Unsubscribe header or {{{RESEND_UNSUBSCRIBE_URL}}})."
    },
    schema: []
  },
  create(context) {
    return {
      CallExpression(node) {
        for (const opts of getSendOptionObjects(node)) {
          if (hasMarketingTag(opts) && !hasUnsubscribeMechanism(opts)) {
            context.report({ node, messageId: "missingUnsubscribe" });
            return;
          }
        }
      }
    };
  }
};
var resendMarketingMissingUnsubscribeRule = rule5;

// src/providers/resend/rules/test-domain-in-production-path.ts
var TEST_DOMAIN = "onboarding@resend.dev";
var rule6 = {
  meta: {
    type: "suggestion",
    docs: {
      description: "Do not use the onboarding@resend.dev test domain in production code",
      category: "correctness",
      rationale: 'onboarding@resend.dev is a shared test sender that only delivers to the account owner; sending from it to any other recipient returns a 403 error. Shipping it to production \u2014 including as a `?? "onboarding@resend.dev"` fallback \u2014 means real users silently never receive their email. Sending from a verified domain configured via process.env.RESEND_FROM_EMAIL is the documented production requirement.',
      docsUrl: "https://resend.com/docs/send-with-nextjs",
      recommended: true
    },
    messages: {
      testDomain: "onboarding@resend.dev is a test-only sender. Use a verified domain (via process.env) in production."
    },
    schema: []
  },
  create(context) {
    if (isInsideTestFile(String(context.filename ?? ""))) return {};
    return {
      Literal(node) {
        if (typeof node.value === "string" && node.value.includes(TEST_DOMAIN)) {
          context.report({ node, messageId: "testDomain" });
        }
      },
      TemplateElement(node) {
        const cooked = node?.value?.cooked ?? node?.value?.raw;
        if (typeof cooked === "string" && cooked.includes(TEST_DOMAIN)) {
          context.report({ node, messageId: "testDomain" });
        }
      }
    };
  }
};
var resendTestDomainInProductionPathRule = rule6;

// src/providers/resend/rules/from-address-not-friendly-format.ts
var BARE_EMAIL = /^[^<>]+@[^<>]+$/;
var rule7 = {
  meta: {
    type: "suggestion",
    docs: {
      description: 'Resend from addresses should use the friendly-name format "Name <email>"',
      category: "integration",
      rationale: 'Every Resend doc example uses the friendly-name form "Acme <onboarding@acme.com>" rather than a bare email. A bare from address shows up in inboxes as a raw email string, which looks less trustworthy and can hurt open rates and brand recognition. Wrapping the address with a display name is a one-line change that matches the documented convention.',
      docsUrl: "https://resend.com/docs/api-reference/emails/send-email",
      recommended: true
    },
    messages: {
      bareFromAddress: 'From address is a bare email. Use the friendly format "Name <email@domain>" as shown in the docs.'
    },
    schema: []
  },
  create(context) {
    return {
      CallExpression(node) {
        for (const opts of getSendOptionObjects(node)) {
          const fromProp = findProperty(opts, "from");
          const value = fromProp?.value;
          if (value?.type === "Literal" && typeof value.value === "string" && BARE_EMAIL.test(value.value.trim())) {
            context.report({ node: value, messageId: "bareFromAddress" });
          }
        }
      }
    };
  }
};
var resendFromAddressNotFriendlyFormatRule = rule7;

// src/providers/resend/rules/batch-size-not-enforced.ts
var COMPARISON_OPERATORS = /* @__PURE__ */ new Set([">", ">=", "<", "<=", "===", "!==", "==", "!="]);
var rule8 = {
  meta: {
    type: "suggestion",
    docs: {
      description: "Enforce the 100-email batch limit before calling resend.batch.send",
      category: "reliability",
      rationale: "resend.batch.send accepts at most 100 emails per call. Passing a user- or data-driven array without a length guard means the request fails outright once the list grows past 100, so an entire batch of notifications silently never sends. Guarding the array length (or chunking it into <=100-sized slices) keeps the send reliable as volume scales.",
      docsUrl: "https://resend.com/docs/api-reference/emails/send-batch-emails",
      recommended: true
    },
    messages: {
      batchSizeNotEnforced: "resend.batch.send has a 100-email limit. Guard the array length (e.g. if (items.length > 100)) before sending."
    },
    schema: []
  },
  create(context) {
    const functions = [];
    const loops = [];
    const lengthChecks = /* @__PURE__ */ new Map();
    const batchCalls = [];
    function isLengthOfName(member) {
      if (member?.type !== "MemberExpression") return null;
      if (member.property?.type !== "Identifier" || member.property.name !== "length") return null;
      if (member.object?.type !== "Identifier") return null;
      return member.object.name;
    }
    return {
      FunctionDeclaration(node) {
        functions.push(node);
      },
      FunctionExpression(node) {
        functions.push(node);
      },
      ArrowFunctionExpression(node) {
        functions.push(node);
      },
      ForStatement(node) {
        loops.push(node);
      },
      ForOfStatement(node) {
        loops.push(node);
      },
      ForInStatement(node) {
        loops.push(node);
      },
      WhileStatement(node) {
        loops.push(node);
      },
      DoWhileStatement(node) {
        loops.push(node);
      },
      BinaryExpression(node) {
        if (!COMPARISON_OPERATORS.has(node.operator)) return;
        for (const side of [node.left, node.right]) {
          const name = isLengthOfName(side);
          if (name) {
            const list = lengthChecks.get(name) ?? [];
            list.push(node);
            lengthChecks.set(name, list);
          }
        }
      },
      CallExpression(node) {
        if (!isResendBatchSendCall(node)) return;
        const arg = node.arguments?.[0];
        if (arg?.type !== "Identifier") return;
        batchCalls.push({ node, argName: arg.name });
      },
      "Program:exit"() {
        for (const { node, argName } of batchCalls) {
          if (loops.some((loop) => contains(loop, node))) continue;
          const enclosing = functions.filter((fn) => contains(fn, node)).sort((a, b) => startOffset(b) - startOffset(a))[0];
          const checks = lengthChecks.get(argName) ?? [];
          const guarded = enclosing ? checks.some((chk) => contains(enclosing, chk)) : checks.length > 0;
          if (!guarded) {
            context.report({ node, messageId: "batchSizeNotEnforced" });
          }
        }
      }
    };
  }
};
var resendBatchSizeNotEnforcedRule = rule8;

// src/providers/resend/rules/missing-idempotency-key.ts
var rule9 = {
  meta: {
    type: "suggestion",
    docs: {
      description: "Resend send/batch calls should include an idempotencyKey",
      category: "reliability",
      rationale: "Without an idempotency key, if a network retry or webhook redelivery occurs, Resend will send the email multiple times. This causes duplicate charges, duplicate user notifications, and damaged sender reputation. Adding an idempotency key (a unique string per logical operation, like `welcome/${userId}`) makes the send safely retryable.",
      docsUrl: "https://resend.com/docs/send-with-nextjs",
      recommended: true
    },
    messages: {
      missingIdempotencyKey: "Resend send call has no idempotencyKey. Add one to prevent duplicate sends on retry."
    },
    schema: []
  },
  create(context) {
    return {
      CallExpression(node) {
        if (!isResendSendCall(node)) return;
        const hasKey = (node.arguments ?? []).some(
          (arg) => arg?.type === "ObjectExpression" && findProperty(arg, "idempotencyKey")
        );
        if (!hasKey) {
          context.report({ node, messageId: "missingIdempotencyKey" });
        }
      }
    };
  }
};
var resendMissingIdempotencyKeyRule = rule9;

// src/providers/resend/rules/no-error-code-mapping.ts
var rule10 = {
  meta: {
    type: "suggestion",
    docs: {
      description: "Resend errors should map to appropriate HTTP status codes, not a blanket 500",
      category: "reliability",
      rationale: "Resend returns different error classes that callers must treat differently: 400/422 mean fix the params and do not retry, 401/403 mean fix the key or domain, and 429/500 mean retry with backoff. Collapsing all of them into a blanket HTTP 500 tells the client to retry errors that will never succeed and hides the real cause from logs and monitoring. Mapping the SDK error code to the right status makes the API honest and lets clients react correctly.",
      docsUrl: "https://resend.com/docs/ai-onboarding",
      recommended: true
    },
    messages: {
      noErrorCodeMapping: "Resend errors are returned as a blanket HTTP 500. Map 400/401/403/422 to non-500 statuses."
    },
    schema: []
  },
  create(context) {
    const functions = [];
    const resendErrorBindings = [];
    const ifErrorStatements = [];
    const fiveHundredNodes = [];
    function initIsResendSend(init) {
      if (!init) return false;
      const expr = init.type === "AwaitExpression" ? init.argument : init;
      return isResendSendCall(expr);
    }
    function isNextResponse500(node) {
      const callee = node.callee;
      if (callee?.type !== "MemberExpression") return false;
      if (callee.property?.type !== "Identifier" || callee.property.name !== "json") return false;
      const opts = node.arguments?.[1];
      const statusProp = findProperty(opts, "status");
      return statusProp?.value?.type === "Literal" && statusProp.value.value === 500;
    }
    function isResStatus500(node) {
      const callee = node.callee;
      if (callee?.type !== "MemberExpression") return false;
      if (callee.property?.type !== "Identifier" || callee.property.name !== "status") return false;
      const arg = node.arguments?.[0];
      return arg?.type === "Literal" && arg.value === 500;
    }
    return {
      FunctionDeclaration(node) {
        functions.push(node);
      },
      FunctionExpression(node) {
        functions.push(node);
      },
      ArrowFunctionExpression(node) {
        functions.push(node);
      },
      VariableDeclarator(node) {
        if (!initIsResendSend(node.init)) return;
        if (node.id?.type !== "ObjectPattern") return;
        const errorProp = (node.id.properties ?? []).find(
          (p) => p?.type === "Property" && p.key?.type === "Identifier" && p.key.name === "error"
        );
        if (!errorProp) return;
        const localName = errorProp.value?.type === "Identifier" ? errorProp.value.name : "error";
        resendErrorBindings.push({ name: localName, pos: startOffset(node) });
      },
      IfStatement(node) {
        if (node.test?.type === "Identifier") {
          ifErrorStatements.push({ node, name: node.test.name, consequent: node.consequent });
        }
      },
      CallExpression(node) {
        if (isNextResponse500(node) || isResStatus500(node)) {
          fiveHundredNodes.push(node);
        }
      },
      "Program:exit"() {
        for (const { node, name, consequent } of ifErrorStatements) {
          const has500 = fiveHundredNodes.some((five) => contains(consequent, five));
          if (!has500) continue;
          const enclosing = functions.filter((fn) => contains(fn, node)).sort((a, b) => startOffset(b) - startOffset(a))[0];
          const boundFromResend = resendErrorBindings.some(
            (b) => b.name === name && (enclosing ? contains(enclosing, { range: [b.pos, b.pos] }) : true)
          );
          if (boundFromResend) {
            context.report({ node, messageId: "noErrorCodeMapping" });
          }
        }
      }
    };
  }
};
var resendNoErrorCodeMappingRule = rule10;

// src/providers/resend/rules/webhook-no-idempotency.ts
var DEDUP_OBJECTS = /* @__PURE__ */ new Set(["redis", "kv", "db", "prisma", "supabase", "cache", "store"]);
var DEDUP_METHODS = /* @__PURE__ */ new Set([
  "has",
  "add",
  "sadd",
  "sismember",
  "exists",
  "findUnique",
  "findFirst",
  "upsert"
]);
var EVENT_ID_PROPS = /* @__PURE__ */ new Set(["email_id", "eventId", "event_id"]);
var rule11 = {
  meta: {
    type: "suggestion",
    docs: {
      description: "Resend webhook handlers should deduplicate retried events",
      category: "reliability",
      rationale: "Resend retries failed webhook deliveries for up to 24 hours, so the same event can legitimately arrive more than once. A handler that acts on every delivery without deduplication will double-process events \u2014 sending duplicate downstream notifications, double-counting metrics, or corrupting state. Tracking processed event ids (e.g. event.data.email_id) in a store or set and skipping ones already seen makes the handler safely idempotent.",
      docsUrl: "https://resend.com/docs/dashboard/webhooks/introduction",
      recommended: true
    },
    messages: {
      noIdempotency: "Resend webhook handler has no deduplication. Resend retries for 24h; track processed event ids."
    },
    schema: []
  },
  create(context) {
    let importsSvix = false;
    const postHandlers = [];
    const dedupSignals = [];
    function collectPostHandler(decl) {
      if (!decl) return;
      if (decl.type === "FunctionDeclaration" && decl.id?.name === "POST") {
        postHandlers.push(decl);
        return;
      }
      if (decl.type === "VariableDeclaration") {
        for (const d of decl.declarations ?? []) {
          if (d?.id?.type === "Identifier" && d.id.name === "POST" && (d.init?.type === "ArrowFunctionExpression" || d.init?.type === "FunctionExpression")) {
            postHandlers.push(d.init);
          }
        }
      }
    }
    return {
      ImportDeclaration(node) {
        if (node?.source?.value === "svix") importsSvix = true;
      },
      ExportNamedDeclaration(node) {
        collectPostHandler(node.declaration);
      },
      NewExpression(node) {
        if (node.callee?.type === "Identifier" && (node.callee.name === "Map" || node.callee.name === "Set")) {
          dedupSignals.push(node);
        }
      },
      CallExpression(node) {
        const callee = node.callee;
        if (callee?.type !== "MemberExpression") return;
        const objName = callee.object?.type === "Identifier" ? callee.object.name : void 0;
        const methodName = callee.property?.type === "Identifier" ? callee.property.name : void 0;
        if (objName && DEDUP_OBJECTS.has(objName) || methodName && DEDUP_METHODS.has(methodName)) {
          dedupSignals.push(node);
        }
      },
      MemberExpression(node) {
        if (node.property?.type === "Identifier" && EVENT_ID_PROPS.has(node.property.name)) {
          dedupSignals.push(node);
        }
      },
      "Program:exit"() {
        if (!importsSvix) return;
        for (const handler of postHandlers) {
          const hasDedup = dedupSignals.some(
            (sig) => startOffset(sig) >= startOffset(handler) && endOffset(sig) <= endOffset(handler)
          );
          if (!hasDedup) {
            context.report({ node: handler, messageId: "noIdempotency" });
          }
        }
      }
    };
  }
};
var resendWebhookNoIdempotencyRule = rule11;

// src/providers/resend/rules/missing-tags.ts
var rule12 = {
  meta: {
    type: "suggestion",
    docs: {
      description: "Resend sends should include tags for deliverability segmentation",
      category: "integration",
      rationale: 'Tags are how Resend segments and filters email in the dashboard and analytics, so sends without them collapse into one undifferentiated stream. When deliverability dips or you need to trace a specific campaign, untagged mail gives you nothing to slice on. Adding tags such as [{ name: "category", value: "welcome" }] makes monitoring and debugging across email types possible.',
      docsUrl: "https://resend.com/docs/dashboard/emails/tags",
      recommended: true
    },
    messages: {
      missingTags: 'Resend send has no tags. Add tags (e.g. [{ name: "category", value: "welcome" }]) for segmentation.'
    },
    schema: []
  },
  create(context) {
    return {
      CallExpression(node) {
        if (!isResendSendCall(node)) return;
        const optionObjects = getSendOptionObjects(node);
        if (optionObjects.length === 0) return;
        const someMissingTags = optionObjects.some((opts) => !findProperty(opts, "tags"));
        if (someMissingTags) {
          context.report({ node, messageId: "missingTags" });
        }
      }
    };
  }
};
var resendMissingTagsRule = rule12;

// src/providers/resend/rules/request-id-not-logged.ts
var REQUEST_ID_HEADERS = /* @__PURE__ */ new Set(["x-request-id", "x-resend-request-id"]);
var rule13 = {
  meta: {
    type: "suggestion",
    docs: {
      description: "Log the Resend request id when handling errors",
      category: "integration",
      rationale: 'Every Resend API response carries a request id (x-request-id / x-resend-request-id) that uniquely identifies the call on their side. When something goes wrong, logging only error.message leaves you and Resend support with no way to find the exact failed request. Logging the request id alongside the message turns a vague "send failed" into a traceable incident that support can look up directly.',
      docsUrl: "https://resend.com/docs/api-reference/errors",
      recommended: true
    },
    messages: {
      requestIdNotLogged: "Error handler logs error.message but not the Resend request id (x-request-id / x-resend-request-id)."
    },
    schema: []
  },
  create(context) {
    let importsResend = false;
    const scopes = [];
    const messageAccesses = [];
    const requestIdPositions = [];
    function within(range, pos) {
      return pos >= range[0] && pos <= range[1];
    }
    return {
      ImportDeclaration(node) {
        if (node?.source?.value === "resend") importsResend = true;
      },
      CatchClause(node) {
        const param = node.param;
        if (param?.type === "Identifier" && node.body) {
          scopes.push({
            node,
            name: param.name,
            range: [startOffset(node.body), endOffset(node.body)]
          });
        }
      },
      IfStatement(node) {
        if (node.test?.type === "Identifier" && node.consequent) {
          scopes.push({
            node,
            name: node.test.name,
            range: [startOffset(node.consequent), endOffset(node.consequent)]
          });
        }
      },
      MemberExpression(node) {
        if (node.property?.type === "Identifier" && node.property.name === "message" && node.object?.type === "Identifier") {
          messageAccesses.push({ name: node.object.name, pos: startOffset(node) });
        }
      },
      Literal(node) {
        if (typeof node.value === "string" && REQUEST_ID_HEADERS.has(node.value.toLowerCase())) {
          requestIdPositions.push(startOffset(node));
        }
      },
      "Program:exit"() {
        if (!importsResend) return;
        for (const scope of scopes) {
          const logsMessage = messageAccesses.some(
            (m) => m.name === scope.name && within(scope.range, m.pos)
          );
          if (!logsMessage) continue;
          const logsRequestId = requestIdPositions.some((pos) => within(scope.range, pos));
          if (!logsRequestId) {
            context.report({ node: scope.node, messageId: "requestIdNotLogged" });
          }
        }
      }
    };
  }
};
var resendRequestIdNotLoggedRule = rule13;

// src/providers/railway/utils.ts
var HTTP_METHODS = /* @__PURE__ */ new Set([
  "GET",
  "POST",
  "PUT",
  "PATCH",
  "DELETE",
  "HEAD",
  "OPTIONS"
]);
var MUTATING_METHODS = /* @__PURE__ */ new Set(["POST", "PUT", "PATCH", "DELETE"]);
function startOffset2(n) {
  if (typeof n?.range?.[0] === "number") return n.range[0];
  if (typeof n?.start === "number") return n.start;
  return (n?.loc?.start?.line ?? 0) * 1e6 + (n?.loc?.start?.column ?? 0);
}
function endOffset2(n) {
  if (typeof n?.range?.[1] === "number") return n.range[1];
  if (typeof n?.end === "number") return n.end;
  return (n?.loc?.end?.line ?? n?.loc?.start?.line ?? 0) * 1e6 + (n?.loc?.end?.column ?? 0);
}
function contains2(outer, inner) {
  const s = startOffset2(inner);
  return s >= startOffset2(outer) && s <= endOffset2(outer);
}
function importSourceOf(node) {
  if (node?.type !== "ImportDeclaration") return null;
  return typeof node.source?.value === "string" ? node.source.value : null;
}
function requireSourceOf(node) {
  if (node?.type !== "CallExpression") return null;
  if (node.callee?.type !== "Identifier" || node.callee.name !== "require") return null;
  const arg = node.arguments?.[0];
  return arg?.type === "Literal" && typeof arg.value === "string" ? arg.value : null;
}
function isPgModule(source) {
  return source === "pg" || source === "pg-pool";
}
function getExportedHandlers(node) {
  const handlers = [];
  if (node?.type !== "ExportNamedDeclaration") return handlers;
  const decl = node.declaration;
  if (!decl) return handlers;
  if (decl.type === "FunctionDeclaration" && decl.id?.type === "Identifier") {
    if (HTTP_METHODS.has(decl.id.name)) handlers.push({ name: decl.id.name, node: decl });
    return handlers;
  }
  if (decl.type === "VariableDeclaration") {
    for (const d of decl.declarations ?? []) {
      if (d?.id?.type !== "Identifier" || !HTTP_METHODS.has(d.id.name)) continue;
      const init = d.init;
      if (init?.type === "ArrowFunctionExpression" || init?.type === "FunctionExpression") {
        handlers.push({ name: d.id.name, node: init });
      }
    }
  }
  return handlers;
}
function isQueryCall(node) {
  if (node?.type !== "CallExpression") return false;
  const callee = node.callee;
  if (callee?.type !== "MemberExpression") return false;
  const prop = callee.property;
  return prop?.type === "Identifier" && prop.name === "query" || prop?.type === "Literal" && prop.value === "query";
}
function getQuerySql(node) {
  const arg = node?.arguments?.[0];
  if (!arg) return null;
  if (arg.type === "Literal" && typeof arg.value === "string") return arg.value;
  if (arg.type === "TemplateLiteral") {
    const parts = (arg.quasis ?? []).map(
      (q) => q?.value?.cooked ?? q?.value?.raw ?? ""
    );
    return parts.join(" ");
  }
  return null;
}
var WRITE_SQL = /\b(insert\s+into|update|delete\s+from)\b/i;
var DDL_SQL = /\b(create|alter|drop)\s+(table|index|schema|materialized\s+view|view)\b/i;
var SELECT_FROM_SQL = /\bselect\b[\s\S]*\bfrom\s+\S/i;
var TABLE_DML = new RegExp(`${WRITE_SQL.source}|${SELECT_FROM_SQL.source}`, "i");
function sqlIsWrite(sql) {
  return WRITE_SQL.test(sql);
}
function sqlIsDDL(sql) {
  return DDL_SQL.test(sql);
}
function sqlTouchesTable(sql) {
  return TABLE_DML.test(sql);
}
var SCHEMA_BOOTSTRAP_NAMES = /^(ensureSchema|migrate|runMigrations?|createTables?|initSchema|bootstrapSchema|setupSchema)$/;
function isSchemaBootstrapCall(node) {
  if (node?.type !== "CallExpression") return false;
  const callee = node.callee;
  if (callee?.type === "Identifier") return SCHEMA_BOOTSTRAP_NAMES.test(callee.name);
  if (callee?.type === "MemberExpression" && callee.property?.type === "Identifier") {
    return SCHEMA_BOOTSTRAP_NAMES.test(callee.property.name);
  }
  return false;
}
function isConsoleCall(node) {
  if (node?.type !== "CallExpression") return false;
  const callee = node.callee;
  if (callee?.type !== "MemberExpression") return false;
  return callee.object?.type === "Identifier" && callee.object.name === "console";
}
function isBareErrorIdentifier(node) {
  return node?.type === "Identifier" && /^(err|error|e|ex|exception)$/.test(node.name);
}
function isNewPoolExpression(node) {
  if (node?.type !== "NewExpression") return false;
  const callee = node.callee;
  if (callee?.type === "Identifier") return callee.name === "Pool";
  if (callee?.type === "MemberExpression" && callee.property?.type === "Identifier") {
    return callee.property.name === "Pool";
  }
  return false;
}
function isOnErrorCall(node) {
  if (node?.type !== "CallExpression") return false;
  const callee = node.callee;
  if (callee?.type !== "MemberExpression") return false;
  const prop = callee.property;
  const isOn = prop?.type === "Identifier" && prop.name === "on" || prop?.type === "Literal" && prop.value === "on";
  if (!isOn) return false;
  const first = node.arguments?.[0];
  return first?.type === "Literal" && first.value === "error";
}
function isRequestJsonCall(node) {
  if (node?.type !== "CallExpression") return false;
  const callee = node.callee;
  if (callee?.type !== "MemberExpression") return false;
  const prop = callee.property;
  if (prop?.type !== "Identifier" || prop.name !== "json") return false;
  const obj = callee.object;
  return obj?.type === "Identifier" && (obj.name === "req" || obj.name === "request");
}
function isTypeofStringComparison(node) {
  if (node?.type !== "BinaryExpression") return false;
  if (node.operator !== "===" && node.operator !== "!==") return false;
  const sides = [node.left, node.right];
  const hasTypeof = sides.some((s) => s?.type === "UnaryExpression" && s.operator === "typeof");
  const hasStringLit = sides.some(
    (s) => s?.type === "Literal" && s.value === "string"
  );
  return hasTypeof && hasStringLit;
}
function isLengthMember(node) {
  return node?.type === "MemberExpression" && node.property?.type === "Identifier" && node.property.name === "length";
}

// src/providers/railway/rules/cron-service-must-share-schema-bootstrap.ts
var rule14 = {
  meta: {
    type: "problem",
    docs: {
      description: "A Railway cron/worker script must bootstrap the DB schema before querying tables the web app creates lazily",
      category: "correctness",
      docsUrl: "https://docs.railway.com/guides/cron-jobs",
      rationale: 'When the table is created lazily by the web app and the cron script queries it directly, the very first scheduled cron run after a fresh deploy can hit the table before any request has created it, throwing "relation does not exist". Railway does not retry a failed cron run before its next schedule, so the job silently stays broken. The script must call the same ensureSchema() bootstrap (or create the table itself) before querying.',
      recommended: true
    },
    messages: {
      missingSchemaBootstrap: "This script queries a table without bootstrapping the schema first. Call the shared ensureSchema() (or create the table) before querying, or the first Railway cron run can fail on a missing relation."
    },
    schema: []
  },
  create(context) {
    let usesPg = false;
    let bootstrapsSchema = false;
    let firstTableQuery = null;
    return {
      ImportDeclaration(node) {
        if (isPgModule(importSourceOf(node))) usesPg = true;
      },
      CallExpression(node) {
        if (isPgModule(requireSourceOf(node))) usesPg = true;
        if (isSchemaBootstrapCall(node)) bootstrapsSchema = true;
        if (isQueryCall(node)) {
          const sql = getQuerySql(node);
          if (sql && sqlIsDDL(sql)) bootstrapsSchema = true;
          if (sql && sqlTouchesTable(sql) && !firstTableQuery) firstTableQuery = node;
        }
      },
      "Program:exit"() {
        if (!usesPg) return;
        if (bootstrapsSchema) return;
        if (firstTableQuery) {
          context.report({ node: firstTableQuery, messageId: "missingSchemaBootstrap" });
        }
      }
    };
  }
};
var railwayCronServiceMustShareSchemaBootstrapRule = rule14;

// src/providers/railway/rules/no-unauthenticated-public-write-endpoint.ts
var ENV_SECRET = /(TOKEN|SECRET|KEY|PASSWORD|AUTH)/i;
var AUTH_FN = /^(auth|getAuth|getSession|getUser|getServerSession|verify|verifyAuth|authorize|authenticate|require\w*|checkAuth|isAuthorized|currentUser)$/;
var rule15 = {
  meta: {
    type: "problem",
    docs: {
      description: "Mutating Railway route handlers must authenticate before persisting, since a public domain makes them internet-reachable",
      category: "security",
      cwe: "CWE-306",
      owasp: "API2:2023 Broken Authentication",
      docsUrl: "https://docs.railway.com/guides/public-networking",
      rationale: "Generating a public domain for a Railway service exposes its routes to the entire internet. A write handler that persists request data with no token, session, or origin check becomes an open write API: anyone can insert arbitrary rows, growing metered Postgres storage and corrupting application data. Authenticate the request before persisting.",
      recommended: true
    },
    messages: {
      unauthenticatedWrite: "This {{method}} handler persists request data without an authentication check. Verify a token/session/origin before writing \u2014 a Railway public domain exposes it to the internet."
    },
    schema: []
  },
  create(context) {
    const handlers = [];
    function forEachHandlerContaining(node, fn) {
      for (const h of handlers) {
        if (contains2(h.node, node)) fn(h);
      }
    }
    return {
      ExportNamedDeclaration(node) {
        for (const h of getExportedHandlers(node)) {
          if (MUTATING_METHODS.has(h.name)) {
            handlers.push({ ...h, hasWrite: false, hasAuth: false });
          }
        }
      },
      MemberExpression(node) {
        if (node.property?.type === "Identifier" && node.property.name === "headers") {
          forEachHandlerContaining(node, (h) => {
            h.hasAuth = true;
          });
        }
        if (node.property?.type === "Identifier" && ENV_SECRET.test(node.property.name) && node.object?.type === "MemberExpression" && node.object.property?.type === "Identifier" && node.object.property.name === "env") {
          forEachHandlerContaining(node, (h) => {
            h.hasAuth = true;
          });
        }
      },
      CallExpression(node) {
        if (isQueryCall(node)) {
          const sql = getQuerySql(node);
          if (sql && sqlIsWrite(sql)) {
            forEachHandlerContaining(node, (h) => {
              h.hasWrite = true;
            });
          }
        }
        const callee = node.callee;
        const name = callee?.type === "Identifier" ? callee.name : callee?.type === "MemberExpression" && callee.property?.type === "Identifier" ? callee.property.name : null;
        if (name && AUTH_FN.test(name)) {
          forEachHandlerContaining(node, (h) => {
            h.hasAuth = true;
          });
        }
      },
      "Program:exit"() {
        for (const h of handlers) {
          if (h.hasWrite && !h.hasAuth) {
            context.report({
              node: h.node,
              messageId: "unauthenticatedWrite",
              data: { method: h.name }
            });
          }
        }
      }
    };
  }
};
var railwayNoUnauthenticatedPublicWriteEndpointRule = rule15;

// src/providers/railway/rules/pg-pool-requires-error-handler.ts
var rule16 = {
  meta: {
    type: "problem",
    docs: {
      description: 'A pg Pool on Railway must register a pool.on("error") handler',
      category: "reliability",
      docsUrl: "https://node-postgres.com/apis/pool#events",
      rationale: 'node-postgres emits backend errors on idle clients as an "error" event on the Pool. A Node EventEmitter with no "error" listener rethrows, crashing the process. Railway-managed Postgres routinely drops idle connections during maintenance and restarts, so a long-running server container without pool.on("error", ...) will eventually crash on an event it could have absorbed.',
      recommended: true
    },
    messages: {
      missingErrorHandler: 'This pg Pool has no pool.on("error", ...) handler. An idle-client backend error with no listener will crash the process when Railway drops the connection.'
    },
    schema: []
  },
  create(context) {
    let usesPg = false;
    let hasErrorHandler = false;
    const pools = [];
    return {
      ImportDeclaration(node) {
        if (isPgModule(importSourceOf(node))) usesPg = true;
      },
      CallExpression(node) {
        if (isPgModule(requireSourceOf(node))) usesPg = true;
        if (isOnErrorCall(node)) hasErrorHandler = true;
      },
      NewExpression(node) {
        if (isNewPoolExpression(node)) pools.push(node);
      },
      "Program:exit"() {
        if (!usesPg || hasErrorHandler) return;
        for (const pool of pools) {
          context.report({ node: pool, messageId: "missingErrorHandler" });
        }
      }
    };
  }
};
var railwayPgPoolRequiresErrorHandlerRule = rule16;

// src/providers/railway/rules/validate-request-payload-bounds.ts
var rule17 = {
  meta: {
    type: "suggestion",
    docs: {
      description: "Persisted request payloads on Railway must enforce length bounds, not just type checks",
      category: "security",
      cwe: "CWE-770",
      owasp: "API4:2023 Unrestricted Resource Consumption",
      docsUrl: "https://docs.railway.com/guides/postgresql",
      rationale: 'A handler that validates only the type of incoming fields (typeof === "string") but never their length lets a client persist arbitrarily large values. On Railway, Postgres storage is billed by volume size, so unbounded inserts grow cost indefinitely and a burst of abuse persists until an age-based cleanup eventually catches it. Enforce an explicit length cap before persisting.',
      recommended: true
    },
    messages: {
      missingBounds: "This {{method}} handler type-checks the payload but never bounds its length before persisting. Add an explicit length cap (e.g. value.length > 200) to prevent unbounded Railway Postgres growth."
    },
    schema: []
  },
  create(context) {
    const handlers = [];
    function forEach(node, fn) {
      for (const h of handlers) if (contains2(h.node, node)) fn(h);
    }
    return {
      ExportNamedDeclaration(node) {
        for (const h of getExportedHandlers(node)) {
          if (MUTATING_METHODS.has(h.name)) {
            handlers.push({
              ...h,
              readsJson: false,
              typeChecksString: false,
              hasWrite: false,
              hasLengthCheck: false
            });
          }
        }
      },
      CallExpression(node) {
        if (isRequestJsonCall(node)) forEach(node, (h) => h.readsJson = true);
        if (isQueryCall(node)) {
          const sql = getQuerySql(node);
          if (sql && sqlIsWrite(sql)) forEach(node, (h) => h.hasWrite = true);
        }
      },
      BinaryExpression(node) {
        if (isTypeofStringComparison(node)) forEach(node, (h) => h.typeChecksString = true);
      },
      MemberExpression(node) {
        if (isLengthMember(node)) forEach(node, (h) => h.hasLengthCheck = true);
      },
      "Program:exit"() {
        for (const h of handlers) {
          if (h.readsJson && h.typeChecksString && h.hasWrite && !h.hasLengthCheck) {
            context.report({
              node: h.node,
              messageId: "missingBounds",
              data: { method: h.name }
            });
          }
        }
      }
    };
  }
};
var railwayValidateRequestPayloadBoundsRule = rule17;

// src/providers/railway/rules/no-raw-error-logging-near-db-connection.ts
var rule18 = {
  meta: {
    type: "suggestion",
    docs: {
      description: "Do not log raw error objects in a Railway Postgres connection context \u2014 the DSN/password can leak into logs",
      category: "security",
      cwe: "CWE-532",
      owasp: "API8:2023 Security Misconfiguration",
      docsUrl: "https://docs.railway.com/guides/logs",
      rationale: "pg connection-failure errors can carry connection details \u2014 and in some driver versions the full DSN \u2014 in their message and stack. DATABASE_URL contains the Postgres password, so console.error(err) on a pool failure can write that password into Railway deploy/build logs, which may be exported to a third-party log drain or read by anyone with project access. Log err.message (a redacted, intentional field) instead of the whole error.",
      recommended: true
    },
    messages: {
      rawErrorLogged: "Logging a raw error object in a database-connection context can leak DATABASE_URL (with the Postgres password) into Railway logs. Log err.message instead."
    },
    schema: []
  },
  create(context) {
    let isDbContext = false;
    const rawLogCalls = [];
    return {
      ImportDeclaration(node) {
        if (isPgModule(importSourceOf(node))) isDbContext = true;
      },
      NewExpression(node) {
        if (isNewPoolExpression(node)) isDbContext = true;
      },
      MemberExpression(node) {
        if (node.property?.type === "Identifier" && node.property.name === "DATABASE_URL" && node.object?.type === "MemberExpression" && node.object.property?.type === "Identifier" && node.object.property.name === "env") {
          isDbContext = true;
        }
      },
      CallExpression(node) {
        if (isPgModule(requireSourceOf(node))) isDbContext = true;
        if (isConsoleCall(node)) {
          const hasBareError = (node.arguments ?? []).some((a) => isBareErrorIdentifier(a));
          if (hasBareError) rawLogCalls.push(node);
        }
      },
      "Program:exit"() {
        if (!isDbContext) return;
        for (const call of rawLogCalls) {
          context.report({ node: call, messageId: "rawErrorLogged" });
        }
      }
    };
  }
};
var railwayNoRawErrorLoggingNearDbConnectionRule = rule18;

// src/providers/railway/rules/no-ddl-in-request-handler.ts
var rule19 = {
  meta: {
    type: "suggestion",
    docs: {
      description: "Schema DDL must not run inside a Railway request handler",
      category: "correctness",
      docsUrl: "https://docs.railway.com/reference/config-as-code",
      rationale: "Running CREATE TABLE IF NOT EXISTS (directly or via ensureSchema()) on every request adds a catalog round-trip to the hot path and is not race-proof: when Railway runs more than one replica, two cold-starting instances can attempt the create simultaneously and one can fail with a duplicate-relation error. Run schema creation once at deploy time (e.g. a preDeployCommand migration) instead.",
      recommended: true
    },
    messages: {
      ddlInHandler: "Schema DDL runs inside the {{method}} request handler. Move schema creation to a one-time deploy step (e.g. preDeployCommand) \u2014 per-request CREATE TABLE can race across Railway replicas."
    },
    schema: []
  },
  create(context) {
    const handlers = [];
    const reported = /* @__PURE__ */ new Set();
    function reportInHandler(node) {
      for (const h of handlers) {
        if (contains2(h.node, node) && !reported.has(h.node)) {
          reported.add(h.node);
          context.report({ node: h.node, messageId: "ddlInHandler", data: { method: h.name } });
        }
      }
    }
    return {
      ExportNamedDeclaration(node) {
        for (const h of getExportedHandlers(node)) handlers.push(h);
      },
      CallExpression(node) {
        if (isSchemaBootstrapCall(node)) {
          reportInHandler(node);
          return;
        }
        if (isQueryCall(node)) {
          const sql = getQuerySql(node);
          if (sql && sqlIsDDL(sql)) reportInHandler(node);
        }
      }
    };
  }
};
var railwayNoDdlInRequestHandlerRule = rule19;

// src/plugin/index.ts
var plugin = {
  meta: { name: PLUGIN_NAME, version: "0.0.1" },
  rules: {
    "resend-webhook-signature": resendWebhookSignatureRule,
    "resend-api-key-hardcoded": resendApiKeyHardcodedRule,
    "resend-api-key-in-client-bundle": resendApiKeyInClientBundleRule,
    "resend-marketing-via-batch-send": resendMarketingViaBatchSendRule,
    "resend-marketing-missing-unsubscribe": resendMarketingMissingUnsubscribeRule,
    "resend-test-domain-in-production-path": resendTestDomainInProductionPathRule,
    "resend-from-address-not-friendly-format": resendFromAddressNotFriendlyFormatRule,
    "resend-batch-size-not-enforced": resendBatchSizeNotEnforcedRule,
    "resend-missing-idempotency-key": resendMissingIdempotencyKeyRule,
    "resend-no-error-code-mapping": resendNoErrorCodeMappingRule,
    "resend-webhook-no-idempotency": resendWebhookNoIdempotencyRule,
    "resend-missing-tags": resendMissingTagsRule,
    "resend-request-id-not-logged": resendRequestIdNotLoggedRule,
    "railway-cron-service-must-share-schema-bootstrap": railwayCronServiceMustShareSchemaBootstrapRule,
    "railway-no-unauthenticated-public-write-endpoint": railwayNoUnauthenticatedPublicWriteEndpointRule,
    "railway-pg-pool-requires-error-handler": railwayPgPoolRequiresErrorHandlerRule,
    "railway-validate-request-payload-bounds": railwayValidateRequestPayloadBoundsRule,
    "railway-no-raw-error-logging-near-db-connection": railwayNoRawErrorLoggingNearDbConnectionRule,
    "railway-no-ddl-in-request-handler": railwayNoDdlInRequestHandlerRule
  }
};

// src/plugin/rule-registry.ts
function buildRegistry() {
  const registry2 = /* @__PURE__ */ new Map();
  for (const [key, rule20] of Object.entries(plugin.rules)) {
    const docs = rule20?.meta?.docs ?? {};
    registry2.set(key, {
      category: docs.category,
      description: docs.description ?? "",
      rationale: docs.rationale ?? "",
      docsUrl: docs.docsUrl,
      cwe: docs.cwe,
      owasp: docs.owasp
    });
  }
  return registry2;
}
var registry = buildRegistry();
function getRuleDocsMeta(ruleKey) {
  return registry.get(ruleKey);
}

// src/reporter/snippet.ts
function extractCodeSnippet(content, line, contextLines = 2) {
  const allLines = content.split(/\r?\n/);
  const highlighted = Math.min(Math.max(line, 1), allLines.length || 1);
  const start = Math.max(1, highlighted - contextLines);
  const end = Math.min(allLines.length, highlighted + contextLines);
  const lines = [];
  for (let n = start; n <= end; n++) {
    lines.push({ number: n, text: allLines[n - 1] ?? "" });
  }
  return { lines, highlightedLine: highlighted };
}

// src/types.ts
var SEVERITY_ORDER = {
  error: 0,
  warning: 1,
  info: 2
};
function scoreToSeverityLabel(score) {
  if (score >= 80) return "excellent";
  if (score >= 60) return "good";
  if (score >= 40) return "needs-work";
  return "critical";
}

// src/reporter/report-builder.ts
function computeScore(errors, warnings) {
  return Math.max(0, 100 - errors * 15 - warnings * 5);
}
function buildSummary(results) {
  const errors = results.filter((r) => r.severity === "error").length;
  const warnings = results.filter((r) => r.severity === "warning").length;
  const info = results.filter((r) => r.severity === "info").length;
  const score = computeScore(errors, warnings);
  return {
    score,
    severity: scoreToSeverityLabel(score),
    errors,
    warnings,
    info,
    totalIssues: results.length
  };
}
function sortResults(results) {
  return [...results].sort((a, b) => {
    const bySeverity = SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity];
    if (bySeverity !== 0) return bySeverity;
    const byFile = a.file.localeCompare(b.file);
    if (byFile !== 0) return byFile;
    return a.line - b.line;
  });
}
function toFinding(result, sequence, content) {
  const docs = getRuleDocsMeta(result.ruleKey);
  return {
    id: `${result.ruleKey}-${sequence}`,
    rule: result.rule,
    category: docs?.category ?? "correctness",
    severity: result.severity,
    message: result.message,
    fix: result.fix,
    docsUrl: result.docsUrl ?? docs?.docsUrl,
    cwe: docs?.cwe,
    owasp: docs?.owasp,
    location: {
      file: result.file,
      line: result.line,
      column: result.column,
      endLine: result.endLine,
      endColumn: result.endColumn
    },
    codeSnippet: extractCodeSnippet(content, result.line)
  };
}
function buildReport(input) {
  const sorted = sortResults(input.results);
  const summary = buildSummary(input.results);
  const counters = /* @__PURE__ */ new Map();
  const findings = sorted.map((result) => {
    const next = (counters.get(result.ruleKey) ?? 0) + 1;
    counters.set(result.ruleKey, next);
    const content = input.filesContent.get(result.file) ?? "";
    return toFinding(result, next, content);
  });
  const providersDetected = input.detected.map((d) => {
    const manifest = providers.find((p) => p.name === d.name);
    return {
      name: d.name,
      detectedVia: d.source,
      rulesRun: d.checked ? manifest?.oxlintRules.length ?? 0 : 0
    };
  });
  return {
    schemaVersion: "1.0.0",
    tool: { name: "api-doctor", version: input.version },
    scanMeta: {
      directory: input.directory,
      scannedAt: (input.scannedAt ?? /* @__PURE__ */ new Date()).toISOString(),
      durationMs: Math.round(input.durationMs),
      filesScanned: input.filesScanned,
      providersDetected
    },
    summary,
    findings
  };
}

// src/scanner.ts
import { spawnSync } from "child_process";
import { mkdtempSync, rmSync, writeFileSync as writeFileSync2 } from "fs";
import { readdir, readFile as readFile2 } from "fs/promises";
import { createRequire } from "module";
import os from "os";
import { join as join2, relative, resolve } from "path";

// src/detector.ts
import { readFile } from "fs/promises";
import { join } from "path";
function hasImportPattern(source, pkg2) {
  return source.includes(`from '${pkg2}'`) || source.includes(`from "${pkg2}"`) || source.includes(`require('${pkg2}')`) || source.includes(`require("${pkg2}")`);
}
async function detectProviders(directory, filesContent) {
  const detected = /* @__PURE__ */ new Map();
  const allSources = [...filesContent.values()].join("\n");
  let deps = {};
  try {
    const raw = await readFile(join(directory, "package.json"), "utf-8");
    const pkg2 = JSON.parse(raw);
    deps = { ...pkg2.dependencies, ...pkg2.devDependencies };
  } catch {
  }
  for (const provider of providers) {
    if (detected.has(provider.name)) continue;
    const packages = provider.detect.packages ?? [];
    if (packages.some((p) => p in deps)) {
      detected.set(provider.name, {
        name: provider.name,
        source: "package.json",
        checked: provider.oxlintRules.length > 0
      });
      continue;
    }
    const imports = provider.detect.imports ?? [];
    if (imports.some((p) => [...filesContent.values()].some((s) => hasImportPattern(s, p)))) {
      detected.set(provider.name, {
        name: provider.name,
        source: "imports",
        checked: provider.oxlintRules.length > 0
      });
      continue;
    }
    const urls = provider.detect.urlPatterns ?? [];
    if (urls.some((u) => allSources.includes(u))) {
      detected.set(provider.name, {
        name: provider.name,
        source: "url-patterns",
        checked: provider.oxlintRules.length > 0
      });
    }
  }
  return [...detected.values()];
}

// src/scanner.ts
var SKIP_DIRS = /* @__PURE__ */ new Set(["node_modules", "dist", "build", ".next"]);
var SOURCE_EXT = /\.(tsx?|jsx?)$/;
async function walk(dir, root, files) {
  const entries = await readdir(dir, { withFileTypes: true });
  for (const entry of entries) {
    if (entry.name.startsWith(".")) continue;
    const full = join2(dir, entry.name);
    if (entry.isDirectory()) {
      if (SKIP_DIRS.has(entry.name)) continue;
      await walk(full, root, files);
    } else if (SOURCE_EXT.test(entry.name)) {
      files.push(relative(root, full));
    }
  }
}
var ScanError = class extends Error {
  constructor(message, cause) {
    super(message);
    this.cause = cause;
    this.name = "ScanError";
  }
  cause;
};
function buildOxlintConfig(detectedNames) {
  const oxlintRules = {};
  const ruleMetaByKey = /* @__PURE__ */ new Map();
  for (const provider of providers) {
    if (!detectedNames.has(provider.name)) continue;
    for (const rule20 of provider.oxlintRules) {
      oxlintRules[`${PLUGIN_NAME}/${rule20.key}`] = rule20.severity === "error" || rule20.severity === void 0 ? "error" : "warn";
      ruleMetaByKey.set(rule20.key, rule20);
    }
  }
  return { oxlintRules, ruleMetaByKey };
}
async function scan(directory, options = {}) {
  const absRoot = resolve(directory);
  const paths = [];
  try {
    await walk(absRoot, absRoot, paths);
  } catch (err) {
    throw new ScanError(`Could not read directory: ${absRoot}`, err);
  }
  const filesContent = /* @__PURE__ */ new Map();
  for (const rel of paths) {
    const content = await readFile2(join2(absRoot, rel), "utf-8");
    filesContent.set(rel, content);
  }
  let detected = await detectProviders(absRoot, filesContent);
  if (options.onlyProviders?.length) {
    const allowed = new Set(options.onlyProviders.map((p) => p.toLowerCase()));
    detected = detected.filter((d) => allowed.has(d.name));
  }
  const detectedNames = new Set(detected.map((d) => d.name));
  const { oxlintRules, ruleMetaByKey } = buildOxlintConfig(detectedNames);
  if (Object.keys(oxlintRules).length === 0) {
    return {
      results: [],
      detected,
      directory: absRoot,
      filesScanned: paths.length,
      filesContent
    };
  }
  const require2 = createRequire(import.meta.url);
  const pluginEntry = require2.resolve("api-doctor/plugin");
  const tmpDir = mkdtempSync(join2(os.tmpdir(), "api-doctor-oxlint-"));
  const configPath = join2(tmpDir, "oxlintrc.json");
  const config = {
    jsPlugins: [pluginEntry],
    rules: oxlintRules,
    ignorePatterns: Array.from(SKIP_DIRS)
  };
  writeFileSync2(configPath, JSON.stringify(config, null, 2), "utf-8");
  const res = spawnSync(
    "npx",
    ["oxlint", "--config", configPath, "--format", "json", "."],
    {
      cwd: absRoot,
      encoding: "utf8",
      maxBuffer: 10 * 1024 * 1024
    }
  );
  try {
    if (res.error) {
      throw new ScanError("Failed to run oxlint", res.error);
    }
    let parsed;
    try {
      parsed = JSON.parse(res.stdout);
    } catch (err) {
      const stderr = (res.stderr ?? "").toString().trim();
      throw new ScanError(
        `oxlint produced no parseable output${stderr ? `: ${stderr}` : ""}`,
        err
      );
    }
    const diagnostics = parsed.diagnostics ?? [];
    const results = [];
    for (const d of diagnostics) {
      const code = String(d.code ?? "");
      const matched = [...ruleMetaByKey.entries()].find(([key]) => code.includes(key));
      if (!matched) continue;
      const [ruleKey, meta] = matched;
      const relFile = (() => {
        const filename = String(d.filename ?? "");
        if (!filename) return "";
        if (filename.startsWith(absRoot)) return relative(absRoot, filename);
        return filename.replace(/^[.\\/]+/, "");
      })();
      const span = d.labels?.[0]?.span;
      const line = typeof span?.line === "number" ? span.line : 1;
      const column = typeof span?.column === "number" ? span.column : 1;
      const endLine = typeof span?.endLine === "number" ? span.endLine : void 0;
      const endColumn = typeof span?.endColumn === "number" ? span.endColumn : void 0;
      const content = filesContent.get(relFile) ?? "";
      const snippet = content.split(/\r?\n/)[line - 1]?.trim() ?? "";
      results.push({
        file: relFile,
        line,
        column,
        endLine,
        endColumn,
        snippet,
        ruleKey,
        rule: meta.resultRule,
        // The manifest declares the intended severity (including `info`, which
        // oxlint reports as a warning). Fall back to oxlint's severity.
        severity: meta.severity ?? (d.severity === "warning" ? "warning" : "error"),
        message: meta.message,
        fix: meta.fix,
        docsUrl: meta.docsUrl
      });
    }
    return {
      results,
      detected,
      directory: absRoot,
      filesScanned: paths.length,
      filesContent
    };
  } finally {
    rmSync(tmpDir, { recursive: true, force: true });
  }
}

// src/reporter/markdown.ts
import { basename as basename2 } from "path";
function rationaleByRule() {
  const map = /* @__PURE__ */ new Map();
  for (const provider of providers) {
    for (const rule20 of provider.oxlintRules) {
      const docs = getRuleDocsMeta(rule20.key);
      if (docs?.rationale) map.set(rule20.resultRule, docs.rationale);
    }
  }
  return map;
}
function codeBlock(finding) {
  const { lines, highlightedLine } = finding.codeSnippet;
  const body = lines.map((line) => line.number === highlightedLine ? `${line.text} // \u2190 issue` : line.text).join("\n");
  return ["```typescript", body, "```"].join("\n");
}
function references(finding) {
  const parts = [];
  if (finding.cwe) parts.push(finding.cwe);
  if (finding.owasp) parts.push(`OWASP ${finding.owasp}`);
  return parts.length > 0 ? parts.join(", ") : void 0;
}
var HANDOFF_PROMPT = "Please review these api-doctor findings and fix each one. Reference the docs links if you're uncertain about any fix. Process them in order \u2014 earlier issues may affect later ones.";
function renderMarkdown(report) {
  const { summary, scanMeta, tool, findings } = report;
  const rationales = rationaleByRule();
  const out = [];
  out.push("# api-doctor report");
  out.push("");
  out.push(`**Score:** ${summary.score}/100 (${summary.severity})`);
  out.push(`**Generated:** ${new Date(scanMeta.scannedAt).toUTCString()}`);
  out.push(`**Project:** ${basename2(scanMeta.directory)}`);
  out.push(`**Tool:** api-doctor v${tool.version}`);
  out.push("");
  out.push("## Summary");
  out.push("");
  out.push(`- ${summary.errors} errors`);
  out.push(`- ${summary.warnings} warnings`);
  out.push(`- ${summary.info} info notices`);
  out.push(
    `- ${summary.totalIssues} total issues across ${scanMeta.filesScanned} files`
  );
  out.push("");
  out.push("## Issues to fix");
  out.push("");
  if (findings.length === 0) {
    out.push("No issues found. Nothing to fix.");
    out.push("");
    return `${out.join("\n")}
`;
  }
  findings.forEach((finding, index) => {
    out.push(`### ${index + 1}. ${finding.message} [${finding.severity}]`);
    out.push(`**File:** \`${finding.location.file}:${finding.location.line}\``);
    out.push(`**Rule:** \`${finding.rule}\``);
    const refs = references(finding);
    if (refs) out.push(`**References:** ${refs}`);
    out.push("");
    out.push(codeBlock(finding));
    out.push("");
    const rationale = rationales.get(finding.rule);
    if (rationale) {
      out.push(`**Why this matters:** ${rationale}`);
      out.push("");
    }
    out.push(`**Fix:** ${finding.fix}`);
    out.push("");
    if (finding.docsUrl) {
      out.push(`**Docs:** ${finding.docsUrl}`);
      out.push("");
    }
    out.push("---");
    out.push("");
  });
  out.push("## How to fix these with a coding agent");
  out.push("");
  out.push(
    "Copy this entire file and paste it into Cursor, Claude Code, or any AI coding agent with a prompt like:"
  );
  out.push("");
  out.push(`> "${HANDOFF_PROMPT}"`);
  out.push("");
  return `${out.join("\n")}
`;
}

// src/reporter/terminal.ts
import pc from "picocolors";
var ISSUES_URL = "https://github.com/YOUR_ORG/api-doctor/issues";
var BAR_WIDTH = 24;
function displayNames(detected) {
  return detected.map((d) => providers.find((p) => p.name === d.name)?.displayName ?? d.name).join(", ");
}
function detectionSourceLabel(source) {
  switch (source) {
    case "package.json":
      return "package.json";
    case "imports":
      return "imports";
    case "url-patterns":
      return "URL patterns";
  }
}
function printDetectedProviders(detected) {
  console.log(pc.bold("Detected APIs & SDKs"));
  for (const d of detected) {
    const manifest = providers.find((p) => p.name === d.name);
    const label = manifest?.displayName ?? d.name;
    const via = pc.dim(`via ${detectionSourceLabel(d.source)}`);
    if (d.checked) {
      const ruleCount = manifest?.oxlintRules.length ?? 0;
      const checks = pc.dim(`\u2014 ${ruleCount} check${ruleCount === 1 ? "" : "s"}`);
      console.log(`  ${pc.green("\u2713")} ${label} ${via} ${checks}`);
    } else {
      console.log(`  ${pc.dim("\u25CB")} ${label} ${via} ${pc.dim("\u2014 no checks yet")}`);
    }
  }
  console.log("");
}
function scoreColor(score) {
  if (score >= 75) return pc.green;
  if (score >= 50) return pc.yellow;
  return pc.red;
}
function statusLabel(score) {
  if (score >= 75) return "Good";
  if (score >= 50) return "Needs work";
  return "Critical";
}
function headerIcon(score, color) {
  const box = (face) => [
    color("\u250C\u2500\u2500\u2500\u2500\u2510"),
    color(`\u2502${face[0]}\u2502`),
    color(`\u2502${face[1]}\u2502`),
    color("\u2514\u2500\u2500\u2500\u2500\u2518")
  ];
  if (score >= 75) return box([" ^^ ", " \u203F\u203F "]);
  if (score >= 50) return box([" \u2500\u2500 ", "  \u203F "]);
  return box([" \xD7\xD7 ", "  \u2228 "]);
}
function progressBar(score, color) {
  const filled = Math.round(score / 100 * BAR_WIDTH);
  const empty = BAR_WIDTH - filled;
  return color("\u2588".repeat(Math.max(0, filled))) + pc.dim("\u2591".repeat(Math.max(0, empty)));
}
function padVisible(text, width) {
  const plain = text.replace(/\u001b\[[0-9;]*m/g, "");
  const spaces = Math.max(0, width - plain.length);
  return text + " ".repeat(spaces);
}
function printHeader(score) {
  const color = scoreColor(score);
  const icon = headerIcon(score, color);
  const scoreText = `${color(String(score))}${pc.dim(" / 100")} ${color(statusLabel(score))}`;
  const bar = progressBar(score, color);
  const iconColWidth = 8;
  console.log(`${padVisible(icon[0], iconColWidth)}${scoreText}`);
  console.log(`${padVisible(icon[1], iconColWidth)}${bar}`);
  console.log(padVisible(icon[2], iconColWidth));
  console.log(padVisible(icon[3], iconColWidth));
}
function formatDuration(ms) {
  if (ms === void 0) return "";
  const sec = ms / 1e3;
  return sec < 10 ? `${sec.toFixed(1)}s` : `${Math.round(sec)}s`;
}
function groupResults(results) {
  const groups = /* @__PURE__ */ new Map();
  for (const r of results) {
    let group = groups.get(r.rule);
    if (!group) {
      group = { rule: r.rule, message: r.message, fix: r.fix, docsUrl: r.docsUrl, items: [] };
      groups.set(r.rule, group);
    }
    group.items.push(r);
  }
  return [...groups.values()];
}
function printSummary(errors, warnings, infos, fileCount, elapsedMs) {
  const parts = [];
  if (errors > 0) parts.push(pc.red(`${errors} error${errors === 1 ? "" : "s"}`));
  if (warnings > 0) parts.push(pc.yellow(`${warnings} warning${warnings === 1 ? "" : "s"}`));
  if (infos > 0) parts.push(pc.cyan(`${infos} info`));
  if (parts.length === 0) {
    console.log(pc.green("No issues found"));
    return;
  }
  const duration = formatDuration(elapsedMs);
  const tail = [
    fileCount > 0 ? `across ${fileCount} file${fileCount === 1 ? "" : "s"}` : "",
    duration ? `in ${duration}` : ""
  ].filter(Boolean).join(" ");
  console.log(`${parts.join(pc.dim(", "))}${tail ? pc.dim(` ${tail}`) : ""}`);
}
function printIssueGroups(groups, verbose) {
  for (const group of groups) {
    const count = group.items.length;
    const severity = group.items[0]?.severity;
    const countColor = severity === "warning" ? pc.yellow : severity === "info" ? pc.cyan : pc.red;
    const countLabel = count > 1 ? countColor(` (${count})`) : "";
    const prefix = severity === "warning" ? pc.yellow("\xD7") : severity === "info" ? pc.cyan("\u2139") : pc.red("\xD7");
    console.log(`${prefix} ${group.message}${countLabel}`);
    group.items.forEach((item, index) => {
      console.log(pc.dim(`    ${index + 1}. ${item.file}:${item.line}`));
      if (verbose) {
        console.log(pc.dim(`       ${item.snippet}`));
        console.log(pc.cyan(`       Fix: ${group.fix}`));
        if (group.docsUrl) console.log(pc.dim(`       Docs: ${group.docsUrl}`));
      }
    });
    if (!verbose && (group.fix || group.docsUrl)) {
      console.log(pc.cyan(`    \u2192 ${group.fix}`));
    }
    console.log("");
  }
}
function renderTerminalReport(results, detected, options = {}) {
  if (detected.length === 0) {
    const names = providers.map((p) => p.displayName).join(", ");
    console.log(pc.dim("No API providers detected in this project."));
    console.log(`Supported providers: ${names}`);
    console.log(`Request a provider: ${ISSUES_URL}`);
    return;
  }
  const errors = results.filter((r) => r.severity === "error").length;
  const warnings = results.filter((r) => r.severity === "warning").length;
  const infos = results.filter((r) => r.severity === "info").length;
  const score = Math.max(0, 100 - errors * 15 - warnings * 5);
  const fileCount = new Set(results.map((r) => r.file)).size;
  const checked = detected.filter((d) => d.checked);
  console.log("");
  printDetectedProviders(detected);
  printHeader(score);
  console.log("");
  if (results.length === 0) {
    const duration = formatDuration(options.elapsedMs);
    const scannedLabel = checked.length > 0 ? `Checked ${checked.map((d) => providers.find((p) => p.name === d.name)?.displayName ?? d.name).join(", ")}` : `Found ${displayNames(detected)}`;
    console.log(pc.dim(`${scannedLabel}${duration ? ` in ${duration}` : ""}`));
    console.log("");
    console.log(pc.green(`${pc.bold("\u2713")} No issues found`));
    return;
  }
  printSummary(errors, warnings, infos, fileCount, options.elapsedMs);
  console.log("");
  printIssueGroups(groupResults(results), options.verbose ?? false);
}
function countErrors(results) {
  return results.filter((r) => r.severity === "error").length;
}

// src/reporter/verbose.ts
import pc2 from "picocolors";
function severityTag(severity) {
  if (severity === "error") return pc2.red("error");
  if (severity === "warning") return pc2.yellow("warning");
  return pc2.cyan("info");
}
function printSnippet(report, index) {
  const finding = report.findings[index];
  const { lines, highlightedLine } = finding.codeSnippet;
  const gutterWidth = String(lines.at(-1)?.number ?? highlightedLine).length;
  for (const line of lines) {
    const num = String(line.number).padStart(gutterWidth, " ");
    const isIssue = line.number === highlightedLine;
    const marker = isIssue ? pc2.red(">") : " ";
    const body = `${marker} ${pc2.dim(`${num} |`)} ${line.text}`;
    console.log(isIssue ? body : pc2.dim(body));
  }
}
function renderVerboseReport(report) {
  const { summary, findings } = report;
  console.log("");
  console.log(
    pc2.bold(`api-doctor \u2014 ${summary.score}/100 (${summary.severity})`)
  );
  console.log(
    pc2.dim(
      `${summary.errors} errors, ${summary.warnings} warnings, ${summary.info} info across ${report.scanMeta.filesScanned} files`
    )
  );
  console.log("");
  if (findings.length === 0) {
    console.log(pc2.green(`${pc2.bold("\u2713")} No issues found`));
    return;
  }
  findings.forEach((finding, index) => {
    const loc = `${finding.location.file}:${finding.location.line}:${finding.location.column}`;
    console.log(
      `${severityTag(finding.severity)} ${pc2.bold(finding.message)} ${pc2.dim(`[${finding.rule}]`)}`
    );
    console.log(pc2.dim(`  ${loc}`));
    console.log("");
    printSnippet(report, index);
    console.log("");
    console.log(`  ${pc2.cyan("Fix:")} ${finding.fix}`);
    if (finding.docsUrl) console.log(`  ${pc2.dim("Docs:")} ${finding.docsUrl}`);
    console.log("");
  });
}

// src/reporter/index.ts
function emitReport(results, detected, report, options) {
  const writeFileReport = () => {
    if (!options.noReport) writeReport(report, options.outputPath);
  };
  if (options.format) {
    if (options.format === "json") {
      process.stdout.write(`${JSON.stringify(report, null, 2)}
`);
    } else if (options.format === "markdown") {
      process.stdout.write(renderMarkdown(report));
    } else if (options.format === "sarif") {
      throw new ScanError("SARIF output is not implemented yet");
    } else {
      throw new ScanError(`Unsupported format: ${options.format}`);
    }
    writeFileReport();
    return;
  }
  if (options.quiet) {
    writeFileReport();
    const parts = [`Score: ${report.summary.score}/100`];
    if (!options.noReport) parts.push(`\u2192 ${options.reportDisplayPath}`);
    console.log(parts.join("  "));
    return;
  }
  if (options.verbose) {
    renderVerboseReport(report);
  } else {
    renderTerminalReport(results, detected, { elapsedMs: options.elapsedMs });
  }
  writeFileReport();
  if (!options.noReport) {
    console.log(`\u2192 Report written to ${options.reportDisplayPath}`);
  }
}

// src/cli.ts
var __dirname2 = dirname2(fileURLToPath(import.meta.url));
var pkg = JSON.parse(
  readFileSync(join3(__dirname2, "../package.json"), "utf-8")
);
var VALID_FORMATS = ["json", "markdown", "sarif"];
function fail(message) {
  console.error(`api-doctor: ${message}`);
  process.exit(2);
}
var program = new Command();
program.name("api-doctor").description("Verification rules for AI-generated API integrations").version(pkg.version).argument("[directory]", "Project directory to scan", ".").option("--quiet", "Print only the score and report path").option("--verbose", "Print every finding inline with code snippets").option("--format <format>", "Emit structured output to stdout (json|markdown|sarif)").option("--output <path>", `Report file location (default: ${DEFAULT_REPORT_DIR}/${DEFAULT_REPORT_FILE})`).option("--no-report", "Do not write the report file").option("--max-warnings <n>", "Exit with code 1 if warnings exceed this number").option("--provider <names>", "Comma-separated providers to scan (e.g. resend)").option("--list-providers", "List supported API providers").action(async (directory, opts) => {
  if (opts.listProviders) {
    for (const p of providers) {
      console.log(`${p.name} \u2014 ${p.displayName}`);
    }
    process.exit(0);
  }
  let format;
  if (opts.format) {
    if (!VALID_FORMATS.includes(opts.format)) {
      fail(`unknown --format "${opts.format}" (expected json, markdown, or sarif)`);
    }
    format = opts.format;
  }
  let maxWarnings;
  if (opts.maxWarnings !== void 0) {
    maxWarnings = Number(opts.maxWarnings);
    if (!Number.isInteger(maxWarnings) || maxWarnings < 0) {
      fail(`--max-warnings expects a non-negative integer, got "${opts.maxWarnings}"`);
    }
  }
  const onlyProviders = opts.provider ? opts.provider.split(",").map((s) => s.trim()).filter(Boolean) : void 0;
  const start = performance.now();
  try {
    const { results, detected, directory: scannedDir, filesScanned, filesContent } = await scan(
      directory,
      { onlyProviders }
    );
    const elapsedMs = performance.now() - start;
    const report = buildReport({
      results,
      detected,
      directory: scannedDir,
      filesScanned,
      filesContent,
      durationMs: elapsedMs,
      version: pkg.version
    });
    const outputPath = opts.output ? resolve2(opts.output) : join3(scannedDir, DEFAULT_REPORT_DIR, DEFAULT_REPORT_FILE);
    const rel = relative2(scannedDir, outputPath);
    const reportDisplayPath = rel.startsWith("..") ? outputPath : rel;
    emitReport(results, detected, report, {
      quiet: opts.quiet,
      verbose: opts.verbose,
      format,
      noReport: opts.report === false,
      outputPath,
      reportDisplayPath,
      elapsedMs
    });
    const errors = countErrors(results);
    const warningsExceeded = maxWarnings !== void 0 && report.summary.warnings > maxWarnings;
    process.exit(errors > 0 || warningsExceeded ? 1 : 0);
  } catch (err) {
    if (err instanceof ScanError) {
      fail(err.message);
    }
    throw err;
  }
});
program.parse();
//# sourceMappingURL=cli.mjs.map