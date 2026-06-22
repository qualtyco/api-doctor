#!/usr/bin/env node
"use strict";
var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
  // If the importer is in node compatibility mode or this is not an ESM
  // file that has been converted to a CommonJS file using a Babel-
  // compatible transform (i.e. "__esModule" has not been set), then set
  // "default" to the CommonJS "module.exports" for node compatibility.
  isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
  mod
));

// node_modules/.pnpm/tsup@8.5.1_postcss@8.5.15_typescript@5.9.3/node_modules/tsup/assets/cjs_shims.js
var getImportMetaUrl = () => typeof document === "undefined" ? new URL(`file:${__filename}`).href : document.currentScript && document.currentScript.tagName.toUpperCase() === "SCRIPT" ? document.currentScript.src : new URL("main.js", document.baseURI).href;
var importMetaUrl = /* @__PURE__ */ getImportMetaUrl();

// src/cli.ts
var import_commander = require("commander");
var import_node_fs4 = require("fs");
var import_node_path6 = require("path");
var import_node_url2 = require("url");

// src/install.ts
var import_node_fs = require("fs");
var import_node_path = require("path");
var import_node_url = require("url");
var SKILL_RELATIVE_PATH = (0, import_node_path.join)("skills", "api-doctor", "SKILL.md");
function isAgentSkillInstalled(directory) {
  return (0, import_node_fs.existsSync)((0, import_node_path.join)(directory, SKILL_RELATIVE_PATH));
}
var INSTALL_COMMAND = "npx @api-doctor/cli install";
var AGENTS_MARKER_START = "<!-- api-doctor:start -->";
var AGENTS_MARKER_END = "<!-- api-doctor:end -->";
function bundledSkillPath() {
  const packageRoot = (0, import_node_path.join)((0, import_node_path.dirname)((0, import_node_url.fileURLToPath)(importMetaUrl)), "..");
  const skillPath = (0, import_node_path.join)(packageRoot, SKILL_RELATIVE_PATH);
  if (!(0, import_node_fs.existsSync)(skillPath)) {
    throw new Error(`Bundled skill not found at ${skillPath}`);
  }
  return skillPath;
}
function cursorRule() {
  return {
    path: (0, import_node_path.join)(".cursor", "rules", "api-doctor.mdc"),
    content: `---
description: api-doctor \u2014 handle integration audit findings
alwaysApply: false
---

@skills/api-doctor/SKILL.md
`
  };
}
function agentsSection() {
  return `${AGENTS_MARKER_START}
## api-doctor

Follow [skills/api-doctor/SKILL.md](skills/api-doctor/SKILL.md).
${AGENTS_MARKER_END}`;
}
function installCanonicalSkill(directory, force, created, updated, skipped) {
  const destPath = (0, import_node_path.join)(directory, SKILL_RELATIVE_PATH);
  (0, import_node_fs.mkdirSync)((0, import_node_path.dirname)(destPath), { recursive: true });
  if ((0, import_node_fs.existsSync)(destPath) && !force) {
    skipped.push(SKILL_RELATIVE_PATH);
    return;
  }
  const isNew = !(0, import_node_fs.existsSync)(destPath);
  (0, import_node_fs.copyFileSync)(bundledSkillPath(), destPath);
  (isNew ? created : updated).push(SKILL_RELATIVE_PATH);
}
function installClaudeSymlink(directory, updated) {
  const claudeDir = (0, import_node_path.join)(directory, ".claude", "skills", "api-doctor");
  const claudeSkillPath = (0, import_node_path.join)(claudeDir, "SKILL.md");
  const canonicalPath = (0, import_node_path.join)(directory, SKILL_RELATIVE_PATH);
  const linkTarget = (0, import_node_path.relative)(claudeDir, canonicalPath);
  (0, import_node_fs.mkdirSync)(claudeDir, { recursive: true });
  if ((0, import_node_fs.existsSync)(claudeSkillPath)) {
    try {
      (0, import_node_fs.unlinkSync)(claudeSkillPath);
    } catch {
    }
  }
  try {
    (0, import_node_fs.symlinkSync)(linkTarget, claudeSkillPath, "file");
    updated.push(`${(0, import_node_path.join)(".claude", "skills", "api-doctor", "SKILL.md")} \u2192 ${SKILL_RELATIVE_PATH}`);
  } catch {
    const fallback = `---
name: api-doctor
description: Check AI-generated API integration code for silent bugs before shipping.
---

Read and follow [skills/api-doctor/SKILL.md](../../../skills/api-doctor/SKILL.md).
`;
    (0, import_node_fs.writeFileSync)(claudeSkillPath, fallback, "utf-8");
    updated.push((0, import_node_path.join)(".claude", "skills", "api-doctor", "SKILL.md"));
  }
}
function installAgentFiles(directory, options = {}) {
  const { force = false } = options;
  const created = [];
  const updated = [];
  const skipped = [];
  installCanonicalSkill(directory, force, created, updated, skipped);
  installClaudeSymlink(directory, updated);
  for (const file of [cursorRule()]) {
    const fullPath = (0, import_node_path.join)(directory, file.path);
    (0, import_node_fs.mkdirSync)((0, import_node_path.dirname)(fullPath), { recursive: true });
    const isNew = !(0, import_node_fs.existsSync)(fullPath);
    (0, import_node_fs.writeFileSync)(fullPath, file.content, "utf-8");
    (isNew ? created : updated).push(file.path);
  }
  const agentsPath = (0, import_node_path.join)(directory, "AGENTS.md");
  const section = agentsSection();
  if ((0, import_node_fs.existsSync)(agentsPath)) {
    const existing = (0, import_node_fs.readFileSync)(agentsPath, "utf-8");
    const startIdx = existing.indexOf(AGENTS_MARKER_START);
    const endIdx = existing.indexOf(AGENTS_MARKER_END);
    const next = startIdx !== -1 && endIdx !== -1 ? existing.slice(0, startIdx) + section + existing.slice(endIdx + AGENTS_MARKER_END.length) : `${existing.trimEnd()}

${section}
`;
    (0, import_node_fs.writeFileSync)(agentsPath, next, "utf-8");
    updated.push("AGENTS.md");
  } else {
    (0, import_node_fs.writeFileSync)(agentsPath, `# Agent instructions

${section}
`, "utf-8");
    created.push("AGENTS.md");
  }
  return { created, updated, skipped };
}

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

// src/providers/supabase/manifest.ts
var supabaseManifest = {
  name: "supabase",
  displayName: "Supabase",
  detect: {
    packages: ["@supabase/supabase-js"],
    imports: ["@supabase/supabase-js"],
    urlPatterns: ["supabase.co"]
  },
  oxlintRules: [
    {
      key: "supabase-scope-queries-by-tenant-column",
      resultRule: "supabase/correctness/scope-queries-by-tenant-column",
      message: "Query selects a tenant column but never filters by it.",
      fix: 'Add .eq("<column>", value) (or .match()/.filter()) to scope results to the caller.',
      docsUrl: "https://supabase.com/docs/reference/javascript/eq",
      severity: "error"
    },
    {
      key: "supabase-validate-uuid-columns",
      resultRule: "supabase/correctness/validate-uuid-columns",
      message: 'Value passed to a uuid-typed column is only checked with typeof === "string".',
      fix: "Validate UUID shape with a regex (e.g. /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i) before insert/upsert.",
      docsUrl: "https://supabase.com/docs/guides/database/tables#data-types",
      severity: "info"
    },
    {
      key: "supabase-order-by-timestamp-not-identity",
      resultRule: "supabase/correctness/order-by-timestamp-not-identity",
      message: 'Query orders by "id" instead of a selected timestamp column.',
      fix: 'Order by the timestamp column (e.g. .order("created_at", { ascending: false })) instead of the surrogate key.',
      docsUrl: "https://supabase.com/docs/reference/javascript/order",
      severity: "info"
    },
    {
      key: "supabase-consistent-input-length-limits",
      resultRule: "supabase/correctness/consistent-input-length-limits",
      message: "A sibling string field in this insert has no length cap, unlike the others.",
      fix: "Apply the same length cap pattern used for the other fields, e.g. field.length > 2000.",
      docsUrl: "https://supabase.com/docs/guides/database/tables",
      severity: "warning"
    },
    {
      key: "supabase-idempotent-mutations",
      resultRule: "supabase/reliability/idempotent-mutations",
      message: "Insert has no idempotency/dedupe key, so a retry can create a duplicate row.",
      fix: 'Add a client-generated idempotency key field backed by a unique constraint, or use .upsert(..., { onConflict: "<key column>" }).',
      docsUrl: "https://supabase.com/docs/reference/javascript/upsert",
      severity: "warning"
    },
    {
      key: "supabase-fail-fast-env-validation",
      resultRule: "supabase/reliability/fail-fast-env-validation",
      message: "createClient is called with env vars that have no presence check.",
      fix: "Throw a clear error (e.g. if (!url || !key) throw new Error(...)) before calling createClient.",
      docsUrl: "https://supabase.com/docs/reference/javascript/initializing",
      severity: "warning"
    },
    {
      key: "supabase-no-user-metadata-authz",
      resultRule: "supabase/security/no-user-metadata-authz",
      message: "Authorization data is read from or written to user_metadata, which clients can modify.",
      fix: "Store roles in app_metadata via a trusted server path, or in an RLS-protected profiles table \u2014 never user_metadata.",
      docsUrl: "https://supabase.com/docs/guides/database/postgres/row-level-security",
      severity: "error"
    },
    {
      key: "supabase-single-without-error-check",
      resultRule: "supabase/correctness/single-without-error-check",
      message: "A .single() query ignores the returned error field.",
      fix: "Destructure and check error, or use .maybeSingle() and handle a missing row explicitly.",
      docsUrl: "https://supabase.com/docs/reference/javascript/single",
      severity: "warning"
    },
    {
      key: "supabase-non-atomic-replace-pattern",
      resultRule: "supabase/correctness/non-atomic-replace-pattern",
      message: "Child rows are replaced via delete-then-insert without checking errors.",
      fix: "Wrap delete+insert in a Postgres RPC (single transaction) and surface error from each step.",
      docsUrl: "https://supabase.com/docs/guides/database/functions",
      severity: "warning"
    },
    {
      key: "supabase-unchecked-mutation-error",
      resultRule: "supabase/correctness/unchecked-mutation-error",
      message: "A Supabase insert/update/delete never checks the returned error field.",
      fix: "Destructure { error } from every mutation and revert optimistic UI or show a toast on failure.",
      docsUrl: "https://supabase.com/docs/reference/javascript/insert",
      severity: "warning"
    },
    {
      key: "supabase-realtime-missing-filter",
      resultRule: "supabase/reliability/realtime-missing-filter",
      message: "A Realtime postgres_changes subscription listens to an entire table with no filter.",
      fix: "Add a filter option scoped to the current user (e.g. filter: `receiver_id=eq.${user.id}`).",
      docsUrl: "https://supabase.com/docs/guides/realtime/postgres-changes#filtering",
      severity: "error"
    },
    {
      key: "supabase-storage-error-not-surfaced",
      resultRule: "supabase/reliability/storage-error-not-surfaced",
      message: "A storage upload failure is ignored and execution continues.",
      fix: "On uploadError, stop and show an error instead of saving a stale URL.",
      docsUrl: "https://supabase.com/docs/reference/javascript/storage-from-upload",
      severity: "warning"
    }
  ]
};

// src/providers/index.ts
var providers = [
  resendManifest,
  supabaseManifest
];

// src/reporter/animate.ts
var SPINNER_FRAMES = ["\u280B", "\u2819", "\u2839", "\u2838", "\u283C", "\u2834", "\u2826", "\u2827", "\u2807", "\u280F"];
var SPINNER_INTERVAL_MS = 80;
var GROUP_DELAY_MS = 220;
var LINE_DELAY_MS = 45;
function isAnimated() {
  return Boolean(process.stdout.isTTY) && !process.env.CI;
}
function sleep(ms) {
  return new Promise((resolve3) => setTimeout(resolve3, ms));
}
async function revealDelay() {
  if (!isAnimated()) return;
  await sleep(GROUP_DELAY_MS);
}
async function lineDelay() {
  if (!isAnimated()) return;
  await sleep(LINE_DELAY_MS);
}
function createSpinner(label) {
  if (!isAnimated()) {
    return { stop() {
    } };
  }
  let frame = 0;
  const render = () => {
    process.stderr.write(`\r${SPINNER_FRAMES[frame % SPINNER_FRAMES.length]} ${label}`);
    frame += 1;
  };
  render();
  const timer = setInterval(render, SPINNER_INTERVAL_MS);
  return {
    stop() {
      clearInterval(timer);
      process.stderr.write(`\r${" ".repeat(label.length + 2)}\r`);
    }
  };
}

// src/reporter/json-writer.ts
var import_node_fs2 = require("fs");
var import_node_path2 = require("path");
var DEFAULT_REPORT_DIR = ".api-doctor";
var DEFAULT_REPORT_FILE = "report.json";
function writeReport(report, outputPath) {
  const dir = (0, import_node_path2.dirname)(outputPath);
  (0, import_node_fs2.mkdirSync)(dir, { recursive: true });
  if ((0, import_node_path2.basename)(dir) === DEFAULT_REPORT_DIR) {
    const gitignorePath = `${dir}/.gitignore`;
    if (!(0, import_node_fs2.existsSync)(gitignorePath)) {
      (0, import_node_fs2.writeFileSync)(gitignorePath, "*\n", "utf-8");
    }
  }
  (0, import_node_fs2.writeFileSync)(outputPath, `${JSON.stringify(report, null, 2)}
`, "utf-8");
}

// src/constants.ts
var PLUGIN_NAME = "@api-doctor/cli";

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

// src/providers/supabase/utils.ts
function memberPropName(node) {
  if (node?.type !== "CallExpression") return void 0;
  const callee = node.callee;
  if (callee?.type !== "MemberExpression") return void 0;
  const prop = callee.property;
  if (!callee.computed && prop?.type === "Identifier") return prop.name;
  if (callee.computed && prop?.type === "Literal" && typeof prop.value === "string") {
    return prop.value;
  }
  return void 0;
}
function chainObjectCall(node) {
  const obj = node?.callee?.object;
  return obj?.type === "CallExpression" ? obj : null;
}
function parseSelectColumns(arg) {
  if (arg?.type !== "Literal" || typeof arg.value !== "string") return [];
  return arg.value.split(",").map((c) => c.trim()).filter(Boolean);
}
function isTenantColumnName(name) {
  return /^[a-z][a-z0-9]*_id$/i.test(name) && name.toLowerCase() !== "id";
}
function isTimestampColumnName(name) {
  return /^[a-z][a-z0-9]*_at$/i.test(name);
}
function fromTableName(node) {
  let current = node;
  while (current?.type === "CallExpression") {
    if (memberPropName(current) === "from") {
      const arg = current.arguments?.[0];
      return arg?.type === "Literal" && typeof arg.value === "string" ? arg.value : void 0;
    }
    current = chainObjectCall(current);
  }
  return void 0;
}
function chainHasMethod(node, method) {
  let current = node;
  while (current?.type === "CallExpression") {
    if (memberPropName(current) === method) return true;
    current = chainObjectCall(current);
  }
  return false;
}
function isSupabaseMutationKind(node, kind) {
  if (!chainHasMethod(node, kind)) return false;
  let current = node;
  while (current?.type === "CallExpression") {
    if (memberPropName(current) === "from") return true;
    current = chainObjectCall(current);
  }
  return false;
}
var USER_METADATA_AUTHZ_KEYS = /* @__PURE__ */ new Set([
  "role",
  "roles",
  "admin",
  "is_admin",
  "permission",
  "permissions"
]);
function isUserMetadataAuthzRead(node) {
  if (node?.type !== "MemberExpression") return false;
  const parts = [];
  let current = node;
  while (current?.type === "MemberExpression") {
    const prop = current.property;
    const name = !current.computed && prop?.type === "Identifier" ? prop.name : prop?.type === "Literal" && typeof prop.value === "string" ? prop.value : void 0;
    if (name) parts.unshift(name);
    current = current.object;
  }
  const metaIdx = parts.indexOf("user_metadata");
  if (metaIdx === -1) return false;
  const field = parts[metaIdx + 1];
  return typeof field === "string" && USER_METADATA_AUTHZ_KEYS.has(field);
}
function destructuredNames(pattern) {
  const names = /* @__PURE__ */ new Set();
  if (!pattern) return names;
  if (pattern.type === "Identifier") {
    names.add(pattern.name);
    return names;
  }
  if (pattern.type !== "ObjectPattern") return names;
  for (const prop of pattern.properties ?? []) {
    if (prop?.type === "Property") {
      if (prop.value?.type === "Identifier") names.add(prop.value.name);
      else if (prop.key?.type === "Identifier" && prop.shorthand) names.add(prop.key.name);
      else if (prop.key?.type === "Identifier" && prop.value?.type === "Identifier") {
        names.add(prop.value.name);
      }
    } else if (prop?.type === "RestElement" && prop.argument?.type === "Identifier") {
      names.add(prop.argument.name);
    }
  }
  return names;
}
function resolvePropertyValueName(prop) {
  if (prop?.shorthand && prop.key?.type === "Identifier") return prop.key.name;
  const value = prop?.value;
  if (value?.type === "Identifier") return value.name;
  if (value?.type === "LogicalExpression" && (value.operator === "??" || value.operator === "||")) {
    if (value.left?.type === "Identifier") return value.left.name;
  }
  return void 0;
}
function typeofStringCheckTarget(node) {
  if (node?.type !== "BinaryExpression") return void 0;
  if (node.operator !== "===" && node.operator !== "!==") return void 0;
  const sides = [node.left, node.right];
  const typeofSide = sides.find(
    (s) => s?.type === "UnaryExpression" && s.operator === "typeof" && s.argument?.type === "Identifier"
  );
  const litSide = sides.find((s) => s?.type === "Literal" && s.value === "string");
  if (!typeofSide || !litSide) return void 0;
  return typeofSide.argument.name;
}

// src/providers/supabase/rules/scope-queries-by-tenant-column.ts
var rule14 = {
  meta: {
    type: "suggestion",
    docs: {
      description: "Supabase queries that select a tenant column must filter by it",
      category: "correctness",
      rationale: "A column like session_id or user_id existing in the schema (and being selected) signals intent to scope rows to one caller, but selecting it is not the same as filtering by it. Without an .eq()/.match()/.filter() on that column, the query returns every row for every tenant, turning a per-user feed into a single shared, cross-user one.",
      docsUrl: "https://supabase.com/docs/reference/javascript/eq",
      recommended: true
    },
    messages: {
      missingTenantFilter: 'This query selects "{{column}}" but never filters by it. Add .eq("{{column}}", ...) (or .match()/.filter()) to scope results to the caller.'
    },
    schema: []
  },
  create(context) {
    const chainStates = /* @__PURE__ */ new Map();
    const selectStates = [];
    function recordFilteredColumn(state, name) {
      if (typeof name === "string") state.filteredColumns.add(name);
      else state.filteredColumns.add("*");
    }
    return {
      "CallExpression:exit"(node) {
        const prop = memberPropName(node);
        if (!prop) return;
        const objCall = chainObjectCall(node);
        if (prop === "select" && objCall && memberPropName(objCall) === "from") {
          const columns = parseSelectColumns(node.arguments?.[0]);
          const tenantColumns = columns.filter(isTenantColumnName);
          if (tenantColumns.length === 0) return;
          const state2 = { selectNode: node, tenantColumns, filteredColumns: /* @__PURE__ */ new Set() };
          chainStates.set(node, state2);
          selectStates.push(state2);
          return;
        }
        const state = objCall ? chainStates.get(objCall) : void 0;
        if (!state) return;
        if (prop === "eq" || prop === "filter") {
          const colArg = node.arguments?.[0];
          recordFilteredColumn(state, colArg?.type === "Literal" ? colArg.value : void 0);
        } else if (prop === "match") {
          const objArg = node.arguments?.[0];
          if (objArg?.type === "ObjectExpression") {
            for (const p of objArg.properties ?? []) {
              if (p?.type !== "Property") continue;
              const name = p.key?.type === "Identifier" ? p.key.name : p.key?.type === "Literal" ? p.key.value : void 0;
              recordFilteredColumn(state, name);
            }
          } else {
            recordFilteredColumn(state, void 0);
          }
        }
        chainStates.set(node, state);
      },
      "Program:exit"() {
        for (const state of selectStates) {
          if (state.filteredColumns.has("*")) continue;
          const missing = state.tenantColumns.find((c) => !state.filteredColumns.has(c));
          if (missing) {
            context.report({
              node: state.selectNode,
              messageId: "missingTenantFilter",
              data: { column: missing }
            });
          }
        }
      }
    };
  }
};
var supabaseScopeQueriesByTenantColumnRule = rule14;

// src/providers/supabase/rules/validate-uuid-columns.ts
function regexSourceLooksUuidShaped(pattern) {
  return /[0-9a-f]{2,}/i.test(pattern) && pattern.includes("-");
}
var rule15 = {
  meta: {
    type: "suggestion",
    docs: {
      description: "Columns typed uuid must be validated for UUID shape, not just typeof string",
      category: "correctness",
      rationale: 'typeof === "string" accepts any string, including malformed UUIDs like "abc". When the underlying column is typed uuid, the database rejects it with a generic type-cast error that the app then has to collapse into an opaque 500 \u2014 masking a client-correctable 400 as a server failure. Validating the UUID shape (e.g. with a regex) before the insert lets the app return a precise 400 instead.',
      docsUrl: "https://supabase.com/docs/guides/database/tables#data-types",
      recommended: true
    },
    messages: {
      missingUuidValidation: 'Column "{{column}}" looks UUID-typed but the value is only checked with typeof === "string", not a UUID-shape regex. Validate the format before insert/upsert.'
    },
    schema: []
  },
  create(context) {
    const validations = /* @__PURE__ */ new Map();
    const regexVarPatterns = /* @__PURE__ */ new Map();
    function markValidation(name, key) {
      let v = validations.get(name);
      if (!v) {
        v = { typeofOnly: false, uuidChecked: false };
        validations.set(name, v);
      }
      v[key] = true;
    }
    return {
      VariableDeclarator(node) {
        if (node.id?.type === "Identifier" && node.init?.type === "Literal" && node.init.regex) {
          regexVarPatterns.set(node.id.name, node.init.regex.pattern);
        }
      },
      BinaryExpression(node) {
        const varName = typeofStringCheckTarget(node);
        if (varName) markValidation(varName, "typeofOnly");
      },
      CallExpression(node) {
        const prop = memberPropName(node);
        if (prop === "test") {
          const objNode = node.callee.object;
          let pattern;
          if (objNode?.type === "Literal" && objNode.regex) {
            pattern = objNode.regex.pattern;
          } else if (objNode?.type === "Identifier" && regexVarPatterns.has(objNode.name)) {
            pattern = regexVarPatterns.get(objNode.name);
          }
          if (pattern && regexSourceLooksUuidShaped(pattern)) {
            const arg2 = node.arguments?.[0];
            if (arg2?.type === "Identifier") markValidation(arg2.name, "uuidChecked");
          }
          return;
        }
        if (prop !== "insert" && prop !== "upsert") return;
        const objCall = chainObjectCall(node);
        if (!objCall || memberPropName(objCall) !== "from") return;
        const arg = node.arguments?.[0];
        if (arg?.type !== "ObjectExpression") return;
        for (const p of arg.properties ?? []) {
          if (p?.type !== "Property") continue;
          const keyName = p.key?.type === "Identifier" ? p.key.name : p.key?.type === "Literal" ? p.key.value : void 0;
          if (typeof keyName !== "string" || !isTenantColumnName(keyName)) continue;
          const valueName = resolvePropertyValueName(p);
          if (!valueName) continue;
          const v = validations.get(valueName);
          if (v?.typeofOnly && !v.uuidChecked) {
            context.report({ node: p, messageId: "missingUuidValidation", data: { column: keyName } });
          }
        }
      }
    };
  }
};
var supabaseValidateUuidColumnsRule = rule15;

// src/providers/supabase/rules/order-by-timestamp-not-identity.ts
var rule16 = {
  meta: {
    type: "suggestion",
    docs: {
      description: "Order by a selected timestamp column instead of the identity column",
      category: "correctness",
      rationale: "Ordering by a bigint identity PK only produces correct chronological order because the PK happens to be monotonic with insert order today. That assumption breaks under bulk inserts, backfills, or replication where PK order and time order can diverge. When the query already selects a timestamp column built for this purpose, order by it instead of the surrogate key.",
      docsUrl: "https://supabase.com/docs/reference/javascript/order",
      recommended: true
    },
    messages: {
      orderByIdentity: 'This query selects "{{column}}" but orders by "id" instead. Order by "{{column}}" so result order does not depend on PK/insert-order coincidence.'
    },
    schema: []
  },
  create(context) {
    const chainStates = /* @__PURE__ */ new Map();
    return {
      "CallExpression:exit"(node) {
        const prop = memberPropName(node);
        if (!prop) return;
        const objCall = chainObjectCall(node);
        if (prop === "select" && objCall && memberPropName(objCall) === "from") {
          const columns = parseSelectColumns(node.arguments?.[0]);
          const timestampColumns = columns.filter(isTimestampColumnName);
          chainStates.set(node, { timestampColumns });
          return;
        }
        const state = objCall ? chainStates.get(objCall) : void 0;
        if (!state) return;
        if (prop === "order") {
          const colArg = node.arguments?.[0];
          const orderColumn = colArg?.type === "Literal" ? colArg.value : void 0;
          if (typeof orderColumn === "string" && orderColumn.toLowerCase() === "id" && state.timestampColumns.length > 0) {
            context.report({
              node,
              messageId: "orderByIdentity",
              data: { column: state.timestampColumns[0] }
            });
          }
        }
        chainStates.set(node, state);
      }
    };
  }
};
var supabaseOrderByTimestampNotIdentityRule = rule16;

// src/providers/supabase/rules/consistent-input-length-limits.ts
var rule17 = {
  meta: {
    type: "suggestion",
    docs: {
      description: "Sibling string fields inserted together should share the same length cap discipline",
      category: "correctness",
      rationale: "A field with no length cap on an otherwise-validated, unauthenticated insert path lets a client persist arbitrarily large payloads repeatedly, growing storage with no bound. When sibling fields in the same insert already have explicit length caps, an uncapped field next to them is usually an oversight rather than an intentional choice.",
      docsUrl: "https://supabase.com/docs/guides/database/tables",
      recommended: true
    },
    messages: {
      inconsistentLengthLimit: 'Field "{{field}}" has no length cap, but sibling field "{{cappedField}}" in the same insert does. Add a .length check for "{{field}}" too.'
    },
    schema: []
  },
  create(context) {
    const validations = /* @__PURE__ */ new Map();
    function markValidation(name, key) {
      let v = validations.get(name);
      if (!v) {
        v = { typeofStringChecked: false, hasLengthCap: false };
        validations.set(name, v);
      }
      v[key] = true;
    }
    function lengthCapTarget(node) {
      if (node?.type !== "BinaryExpression") return void 0;
      if (node.operator !== ">" && node.operator !== ">=") return void 0;
      const left = node.left;
      const right = node.right;
      if (left?.type !== "MemberExpression") return void 0;
      if (left.property?.type !== "Identifier" || left.property.name !== "length") return void 0;
      if (left.object?.type !== "Identifier") return void 0;
      if (right?.type !== "Literal" || typeof right.value !== "number") return void 0;
      return left.object.name;
    }
    return {
      BinaryExpression(node) {
        const typeofVar = typeofStringCheckTarget(node);
        if (typeofVar) markValidation(typeofVar, "typeofStringChecked");
        const lengthVar = lengthCapTarget(node);
        if (lengthVar) markValidation(lengthVar, "hasLengthCap");
      },
      CallExpression(node) {
        const prop = memberPropName(node);
        if (prop !== "insert" && prop !== "upsert") return;
        const objCall = chainObjectCall(node);
        if (!objCall || memberPropName(objCall) !== "from") return;
        const arg = node.arguments?.[0];
        if (arg?.type !== "ObjectExpression") return;
        const stringFields = [];
        for (const p of arg.properties ?? []) {
          if (p?.type !== "Property") continue;
          const field = p.key?.type === "Identifier" ? p.key.name : p.key?.type === "Literal" ? p.key.value : void 0;
          if (typeof field !== "string") continue;
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
            messageId: "inconsistentLengthLimit",
            data: { field: f.field, cappedField: capped[0].field }
          });
        }
      }
    };
  }
};
var supabaseConsistentInputLengthLimitsRule = rule17;

// src/providers/supabase/rules/idempotent-mutations.ts
function objectHasIdempotencyKey(objectExpression) {
  if (objectExpression?.type !== "ObjectExpression") return false;
  return (objectExpression.properties ?? []).some((p) => {
    if (p?.type !== "Property") return false;
    const name = p.key?.type === "Identifier" ? p.key.name : p.key?.type === "Literal" ? p.key.value : void 0;
    return typeof name === "string" && /idempot|dedupe/i.test(name);
  });
}
function insertPayloadHasIdempotencyKey(arg) {
  if (arg?.type === "ObjectExpression") return objectHasIdempotencyKey(arg);
  if (arg?.type === "ArrayExpression") {
    return (arg.elements ?? []).some((el) => objectHasIdempotencyKey(el));
  }
  return false;
}
var rule18 = {
  meta: {
    type: "suggestion",
    docs: {
      description: "Supabase insert calls should be retry-safe via an idempotency key",
      category: "reliability",
      rationale: 'Nothing prevents a duplicate row if the client fetch behind an insert is retried (flaky network, double-click, browser replay) \u2014 there is no unique constraint or dedupe key visible in the payload, and no upsert semantics. Generate a client-side idempotency key per logical action and either include it as a field guarded by a unique constraint, or use .upsert(..., { onConflict: "<key column>" }).',
      docsUrl: "https://supabase.com/docs/reference/javascript/upsert",
      recommended: true
    },
    messages: {
      missingIdempotencyKey: 'This insert has no idempotency/dedupe key field, so a retried request can create a duplicate row. Add one, or use .upsert(..., { onConflict: "<key column>" }).'
    },
    schema: []
  },
  create(context) {
    return {
      CallExpression(node) {
        const prop = memberPropName(node);
        if (prop !== "insert") return;
        const objCall = chainObjectCall(node);
        if (!objCall || memberPropName(objCall) !== "from") return;
        const arg = node.arguments?.[0];
        if (!arg) return;
        if (insertPayloadHasIdempotencyKey(arg)) return;
        context.report({ node, messageId: "missingIdempotencyKey" });
      }
    };
  }
};
var supabaseIdempotentMutationsRule = rule18;

// src/providers/supabase/rules/fail-fast-env-validation.ts
function unwrapNonNull(node) {
  return node?.type === "TSNonNullExpression" ? node.expression : node;
}
function processEnvMemberName(node) {
  const n = unwrapNonNull(node);
  if (n?.type !== "MemberExpression" || n.computed) return void 0;
  const obj = n.object;
  if (obj?.type !== "MemberExpression" || obj.computed) return void 0;
  if (obj.object?.type !== "Identifier" || obj.object.name !== "process") return void 0;
  if (obj.property?.type !== "Identifier" || obj.property.name !== "env") return void 0;
  if (n.property?.type !== "Identifier") return void 0;
  return n.property.name;
}
function hasThrowOrReturn(node) {
  if (!node) return false;
  if (node.type === "ThrowStatement" || node.type === "ReturnStatement") return true;
  if (node.type === "BlockStatement") {
    return (node.body ?? []).some((s) => s.type === "ThrowStatement" || s.type === "ReturnStatement");
  }
  return false;
}
var rule19 = {
  meta: {
    type: "suggestion",
    docs: {
      description: "createClient must fail fast when required env vars are missing",
      category: "reliability",
      rationale: "createClient does not throw on undefined arguments \u2014 a missing env var surfaces later as an opaque error deep in a fetch call rather than a clear message at startup. Checking presence before calling createClient turns a confusing runtime failure (e.g. on a misconfigured second service) into an immediate, actionable one.",
      docsUrl: "https://supabase.com/docs/reference/javascript/initializing",
      recommended: true
    },
    messages: {
      missingEnvValidation: "createClient is called with {{vars}} with no presence check beforehand. Throw if it/they are unset before calling createClient."
    },
    schema: []
  },
  create(context) {
    let createClientLocalName;
    const envVarOfVariable = /* @__PURE__ */ new Map();
    const validatedVarNames = /* @__PURE__ */ new Set();
    const validatedEnvNames = /* @__PURE__ */ new Set();
    function addTarget(node) {
      const n = unwrapNonNull(node);
      if (n?.type === "Identifier") {
        validatedVarNames.add(n.name);
        return;
      }
      const envName = processEnvMemberName(n);
      if (envName) validatedEnvNames.add(envName);
    }
    function collectGuardTargets(node) {
      if (!node) return;
      if (node.type === "LogicalExpression" && node.operator === "||") {
        collectGuardTargets(node.left);
        collectGuardTargets(node.right);
        return;
      }
      if (node.type === "UnaryExpression" && node.operator === "!") {
        addTarget(node.argument);
        return;
      }
      if (node.type === "BinaryExpression" && (node.operator === "==" || node.operator === "===")) {
        const sides = [node.left, node.right];
        const isNullish = (n) => n?.type === "Literal" && n.value === null || n?.type === "Identifier" && n.name === "undefined";
        const target = sides.find((s) => !isNullish(s));
        const nullSide = sides.find(isNullish);
        if (target && nullSide) addTarget(target);
      }
    }
    return {
      ImportDeclaration(node) {
        if (node.source?.value !== "@supabase/supabase-js") return;
        for (const s of node.specifiers ?? []) {
          if (s?.type === "ImportSpecifier" && s.imported?.type === "Identifier" && s.imported.name === "createClient" && s.local?.type === "Identifier") {
            createClientLocalName = s.local.name;
          }
        }
      },
      VariableDeclarator(node) {
        if (node.id?.type !== "Identifier") return;
        const envName = processEnvMemberName(node.init);
        if (envName) envVarOfVariable.set(node.id.name, envName);
      },
      IfStatement(node) {
        if (!hasThrowOrReturn(node.consequent)) return;
        collectGuardTargets(node.test);
      },
      CallExpression(node) {
        if (!createClientLocalName) return;
        if (node.callee?.type !== "Identifier" || node.callee.name !== createClientLocalName) return;
        const missing = [];
        for (const rawArg of node.arguments ?? []) {
          const arg = unwrapNonNull(rawArg);
          let envName;
          let isValidated;
          if (arg?.type === "Identifier") {
            envName = envVarOfVariable.get(arg.name);
            if (!envName) continue;
            isValidated = validatedVarNames.has(arg.name);
          } else {
            envName = processEnvMemberName(arg);
            if (!envName) continue;
            isValidated = validatedEnvNames.has(envName);
          }
          if (!isValidated) missing.push(envName);
        }
        if (missing.length > 0) {
          context.report({ node, messageId: "missingEnvValidation", data: { vars: missing.join(", ") } });
        }
      }
    };
  }
};
var supabaseFailFastEnvValidationRule = rule19;

// src/providers/supabase/rules/no-user-metadata-authz.ts
var AUTHZ_DATA_KEYS = /* @__PURE__ */ new Set(["role", "roles", "admin", "is_admin", "permission", "permissions"]);
function objectHasAuthzDataKey(objectExpression) {
  if (objectExpression?.type !== "ObjectExpression") return false;
  return (objectExpression.properties ?? []).some((p) => {
    if (p?.type !== "Property") return false;
    const name = p.shorthand && p.key?.type === "Identifier" ? p.key.name : p.key?.type === "Identifier" ? p.key.name : p.key?.type === "Literal" ? p.key.value : void 0;
    return typeof name === "string" && AUTHZ_DATA_KEYS.has(name);
  });
}
function findAuthDataPayload(args) {
  for (const arg of args) {
    if (arg?.type !== "ObjectExpression") continue;
    for (const p of arg.properties ?? []) {
      if (p?.type !== "Property") continue;
      const key = p.key?.type === "Identifier" ? p.key.name : p.key?.type === "Literal" ? p.key.value : void 0;
      if (key === "data" && p.value?.type === "ObjectExpression") return p.value;
      if (key === "options" && p.value?.type === "ObjectExpression") {
        for (const opt of p.value.properties ?? []) {
          if (opt?.type !== "Property") continue;
          const optKey = opt.key?.type === "Identifier" ? opt.key.name : opt.key?.type === "Literal" ? opt.key.value : void 0;
          if (optKey === "data" && opt.value?.type === "ObjectExpression") return opt.value;
        }
      }
    }
  }
  return null;
}
function isAuthUserMetadataWrite(node) {
  const prop = memberPropName(node);
  if (prop !== "signUp" && prop !== "updateUser") return false;
  const dataPayload = findAuthDataPayload(node.arguments ?? []);
  return dataPayload ? objectHasAuthzDataKey(dataPayload) : false;
}
var rule20 = {
  meta: {
    type: "problem",
    docs: {
      description: "Do not store or read authorization data from user_metadata",
      category: "security",
      cwe: "CWE-285",
      owasp: "A01:2021 Broken Access Control",
      rationale: "Supabase documents raw_user_meta_data as client-writable and unsuitable for authorization. Reading user_metadata.role (or writing role into signUp/updateUser data) lets any signed-in user self-assign privileged roles from the browser. Store roles in app_metadata via a trusted server path, or in an RLS-protected profiles table.",
      docsUrl: "https://supabase.com/docs/guides/database/postgres/row-level-security",
      recommended: true
    },
    messages: {
      userMetadataAuthzRead: "Authorization is read from user_metadata, which the client can modify. Use app_metadata or a server-side role table instead.",
      userMetadataAuthzWrite: "Authorization data is written to user_metadata via signUp/updateUser, which the client can change later. Use app_metadata or a server-side role table instead."
    },
    schema: []
  },
  create(context) {
    return {
      MemberExpression(node) {
        if (isUserMetadataAuthzRead(node)) {
          context.report({ node, messageId: "userMetadataAuthzRead" });
        }
      },
      CallExpression(node) {
        if (isAuthUserMetadataWrite(node)) {
          context.report({ node, messageId: "userMetadataAuthzWrite" });
        }
      }
    };
  }
};
var supabaseNoUserMetadataAuthzRule = rule20;

// src/providers/supabase/rules/single-without-error-check.ts
function isSingleSupabaseQuery(awaitArg) {
  return awaitArg?.type === "CallExpression" && chainHasMethod(awaitArg, "single");
}
var rule21 = {
  meta: {
    type: "suggestion",
    docs: {
      description: "Supabase .single() calls must inspect the returned error field",
      category: "correctness",
      rationale: ".single() signals zero-or-one-row intent via the error field (PGRST116), not by leaving data undefined silently. Destructuring only data and never reading error produces infinite spinners on deleted rows, bad IDs, or RLS-denied reads. Prefer .maybeSingle() or branch on error before rendering.",
      docsUrl: "https://supabase.com/docs/reference/javascript/single",
      recommended: true
    },
    messages: {
      missingErrorCheck: "This .single() result ignores error \u2014 a missing or denied row will look like a perpetual load. Destructure error or use .maybeSingle()."
    },
    schema: []
  },
  create(context) {
    function checkAwaitBinding(node, pattern, awaitExpr) {
      if (!isSingleSupabaseQuery(awaitExpr.argument)) return;
      const names = destructuredNames(pattern);
      if (names.has("error")) return;
      context.report({ node, messageId: "missingErrorCheck" });
    }
    return {
      VariableDeclarator(node) {
        if (node.init?.type !== "AwaitExpression") return;
        checkAwaitBinding(node, node.id, node.init);
      },
      AssignmentExpression(node) {
        if (node.right?.type !== "AwaitExpression") return;
        checkAwaitBinding(node, node.left, node.right);
      },
      ExpressionStatement(node) {
        const expr = node.expression;
        if (expr?.type !== "AwaitExpression") return;
        if (!isSingleSupabaseQuery(expr.argument)) return;
        if (memberPropName(expr.argument) === "single") {
          context.report({ node, messageId: "missingErrorCheck" });
        }
      }
    };
  }
};
var supabaseSingleWithoutErrorCheckRule = rule21;

// src/providers/supabase/rules/non-atomic-replace-pattern.ts
function isSupabaseTableMutation(node, kind) {
  return isSupabaseMutationKind(node, kind);
}
var rule22 = {
  meta: {
    type: "suggestion",
    docs: {
      description: "Supabase delete-then-insert replace patterns should check errors or use RPC",
      category: "correctness",
      rationale: "Replacing child rows by deleting all rows for a user then re-inserting is a common Supabase pattern, but sequential client calls are not transactional. If delete succeeds and a later insert fails, existing rows are gone with no error shown. Wrap both steps in a Postgres RPC function or check error after each call.",
      docsUrl: "https://supabase.com/docs/guides/database/functions",
      recommended: true
    },
    messages: {
      nonAtomicReplace: "This function deletes then re-inserts rows without checking errors \u2014 a failed insert after a successful delete loses data silently."
    },
    schema: []
  },
  create(context) {
    const fnStack = [];
    const mutationsByFunction = /* @__PURE__ */ new Map();
    function currentFunction() {
      return fnStack[fnStack.length - 1];
    }
    function recordMutation(node, awaitExpr, pattern, kind) {
      const fn = currentFunction();
      if (!fn) return;
      if (!isSupabaseTableMutation(awaitExpr.argument, kind)) return;
      const checksError = pattern ? destructuredNames(pattern).has("error") : false;
      const list = mutationsByFunction.get(fn) ?? [];
      list.push({ node, table: fromTableName(awaitExpr.argument), kind, checksError });
      mutationsByFunction.set(fn, list);
    }
    function enterFunction(node) {
      fnStack.push(node);
    }
    function exitFunction(node) {
      const sites = mutationsByFunction.get(node);
      if (sites) {
        const deletes = sites.filter((s) => s.kind === "delete");
        const inserts = sites.filter((s) => s.kind === "insert");
        if (deletes.length > 0 && inserts.length > 0) {
          const uncheckedDelete = deletes.some((d) => !d.checksError);
          const uncheckedInsert = inserts.some((i) => !i.checksError);
          const sameTable = uncheckedDelete && uncheckedInsert && deletes.some((d) => inserts.some((i) => d.table && i.table && d.table === i.table));
          if (sameTable) {
            context.report({ node: inserts[0].node, messageId: "nonAtomicReplace" });
          }
        }
        mutationsByFunction.delete(node);
      }
      fnStack.pop();
    }
    return {
      FunctionDeclaration(node) {
        enterFunction(node);
      },
      "FunctionDeclaration:exit"(node) {
        exitFunction(node);
      },
      FunctionExpression(node) {
        enterFunction(node);
      },
      "FunctionExpression:exit"(node) {
        exitFunction(node);
      },
      ArrowFunctionExpression(node) {
        enterFunction(node);
      },
      "ArrowFunctionExpression:exit"(node) {
        exitFunction(node);
      },
      VariableDeclarator(node) {
        if (node.init?.type !== "AwaitExpression") return;
        const arg = node.init.argument;
        if (isSupabaseTableMutation(arg, "delete")) recordMutation(node, node.init, node.id, "delete");
        if (isSupabaseTableMutation(arg, "insert")) recordMutation(node, node.init, node.id, "insert");
      },
      ExpressionStatement(node) {
        const expr = node.expression;
        if (expr?.type !== "AwaitExpression") return;
        const arg = expr.argument;
        if (isSupabaseTableMutation(arg, "delete")) recordMutation(node, expr, void 0, "delete");
        if (isSupabaseTableMutation(arg, "insert")) recordMutation(node, expr, void 0, "insert");
      }
    };
  }
};
var supabaseNonAtomicReplacePatternRule = rule22;

// src/providers/supabase/rules/unchecked-mutation-error.ts
var MUTATIONS = ["insert", "update", "delete", "upsert"];
function isSupabaseMutationCall(node) {
  return MUTATIONS.some((kind) => isSupabaseMutationKind(node, kind));
}
var rule23 = {
  meta: {
    type: "suggestion",
    docs: {
      description: "Supabase mutations must check the returned error field",
      category: "correctness",
      rationale: "Unlike fetch(), Supabase client mutations return { data, error } and resolve even when RLS denies the write or a constraint fails. Fire-and-forget awaits or destructuring only data lets optimistic UI state diverge from the database with no toast or rollback.",
      docsUrl: "https://supabase.com/docs/reference/javascript/insert",
      recommended: true
    },
    messages: {
      uncheckedMutation: "This Supabase mutation never checks error \u2014 RLS denials and constraint failures will be silent."
    },
    schema: []
  },
  create(context) {
    function checkMutationAwait(node, pattern, awaitExpr) {
      if (!isSupabaseMutationCall(awaitExpr.argument)) return;
      if (!pattern) {
        context.report({ node, messageId: "uncheckedMutation" });
        return;
      }
      const names = destructuredNames(pattern);
      if (!names.has("error")) {
        context.report({ node, messageId: "uncheckedMutation" });
      }
    }
    return {
      ExpressionStatement(node) {
        const expr = node.expression;
        if (expr?.type !== "AwaitExpression") return;
        checkMutationAwait(node, void 0, expr);
      },
      VariableDeclarator(node) {
        if (node.init?.type !== "AwaitExpression") return;
        checkMutationAwait(node, node.id, node.init);
      },
      AssignmentExpression(node) {
        if (node.right?.type !== "AwaitExpression") return;
        checkMutationAwait(node, node.left, node.right);
      }
    };
  }
};
var supabaseUncheckedMutationErrorRule = rule23;

// src/providers/supabase/rules/realtime-missing-filter.ts
var rule24 = {
  meta: {
    type: "suggestion",
    docs: {
      description: "Supabase Realtime postgres_changes subscriptions should use a filter",
      category: "reliability",
      rationale: "Listening to postgres_changes on an entire table without a filter means every insert/update/delete by any user triggers the callback on every connected client. RLS still scopes the data, but the refetch storm scales with concurrent users and will degrade under real load. Scope subscriptions with the documented filter option (e.g. receiver_id=eq.{id}).",
      docsUrl: "https://supabase.com/docs/guides/realtime/postgres-changes#filtering",
      recommended: true
    },
    messages: {
      missingFilter: "This Realtime postgres_changes subscription has no filter and will fire on every row change in the table."
    },
    schema: []
  },
  create(context) {
    return {
      CallExpression(node) {
        if (memberPropName(node) !== "on") return;
        const eventArg = node.arguments?.[0];
        if (eventArg?.type !== "Literal" || eventArg.value !== "postgres_changes") return;
        const options = node.arguments?.[1];
        if (options?.type !== "ObjectExpression") return;
        const hasFilter = (options.properties ?? []).some((p) => {
          if (p?.type !== "Property") return false;
          const key = p.key?.type === "Identifier" ? p.key.name : p.key?.type === "Literal" ? p.key.value : void 0;
          return key === "filter";
        });
        if (!hasFilter) {
          context.report({ node, messageId: "missingFilter" });
        }
      }
    };
  }
};
var supabaseRealtimeMissingFilterRule = rule24;

// src/providers/supabase/rules/storage-error-not-surfaced.ts
function isStorageUploadCall(node) {
  let current = node;
  let sawStorage = false;
  let sawUpload = false;
  while (current?.type === "CallExpression") {
    const prop = memberPropName(current);
    if (prop === "storage") sawStorage = true;
    if (prop === "upload") sawUpload = true;
    current = chainObjectCall(current);
  }
  return sawStorage && sawUpload;
}
var rule25 = {
  meta: {
    type: "suggestion",
    docs: {
      description: "Supabase storage upload errors must be surfaced to the user",
      category: "reliability",
      rationale: "Storage uploads return { error } without throwing. An if (!uploadError) block with no else lets the caller fall through to a profile save and success toast even when the file never uploaded \u2014 the user only notices later that their avatar or resume did not change.",
      docsUrl: "https://supabase.com/docs/reference/javascript/storage-from-upload",
      recommended: true
    },
    messages: {
      uploadErrorNotSurfaced: "Storage upload failure is ignored when uploadError is set \u2014 add an else branch to stop and show an error."
    },
    schema: []
  },
  create(context) {
    const uploadAwaitVars = /* @__PURE__ */ new Set();
    return {
      VariableDeclarator(node) {
        if (node.init?.type !== "AwaitExpression") return;
        if (!isStorageUploadCall(node.init.argument)) return;
        if (node.id?.type === "ObjectPattern") {
          for (const p of node.id.properties ?? []) {
            if (p?.type !== "Property") continue;
            if (p.key?.type === "Identifier" && p.key.name === "error" && p.value?.type === "Identifier") {
              uploadAwaitVars.add(p.value.name);
            }
          }
        }
      },
      IfStatement(node) {
        const test = node.test;
        if (test?.type !== "UnaryExpression" || test.operator !== "!") return;
        const arg = test.argument;
        if (arg?.type !== "Identifier") return;
        if (!uploadAwaitVars.has(arg.name) && !/uploadError|uploadErr/i.test(arg.name)) return;
        if (node.alternate) return;
        context.report({ node, messageId: "uploadErrorNotSurfaced" });
      },
      "Program:exit"() {
        uploadAwaitVars.clear();
      }
    };
  }
};
var supabaseStorageErrorNotSurfacedRule = rule25;

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
    "supabase-scope-queries-by-tenant-column": supabaseScopeQueriesByTenantColumnRule,
    "supabase-validate-uuid-columns": supabaseValidateUuidColumnsRule,
    "supabase-order-by-timestamp-not-identity": supabaseOrderByTimestampNotIdentityRule,
    "supabase-consistent-input-length-limits": supabaseConsistentInputLengthLimitsRule,
    "supabase-idempotent-mutations": supabaseIdempotentMutationsRule,
    "supabase-fail-fast-env-validation": supabaseFailFastEnvValidationRule,
    "supabase-no-user-metadata-authz": supabaseNoUserMetadataAuthzRule,
    "supabase-single-without-error-check": supabaseSingleWithoutErrorCheckRule,
    "supabase-non-atomic-replace-pattern": supabaseNonAtomicReplacePatternRule,
    "supabase-unchecked-mutation-error": supabaseUncheckedMutationErrorRule,
    "supabase-realtime-missing-filter": supabaseRealtimeMissingFilterRule,
    "supabase-storage-error-not-surfaced": supabaseStorageErrorNotSurfacedRule
  }
};

// src/plugin/rule-registry.ts
function buildRegistry() {
  const registry2 = /* @__PURE__ */ new Map();
  for (const [key, rule26] of Object.entries(plugin.rules)) {
    const docs = rule26?.meta?.docs ?? {};
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
var import_node_child_process = require("child_process");
var import_node_fs3 = require("fs");
var import_promises2 = require("fs/promises");
var import_node_module = require("module");
var import_node_os = __toESM(require("os"), 1);
var import_node_path4 = require("path");

// src/detector.ts
var import_promises = require("fs/promises");
var import_node_path3 = require("path");
function hasImportPattern(source, pkg2) {
  return source.includes(`from '${pkg2}'`) || source.includes(`from "${pkg2}"`) || source.includes(`require('${pkg2}')`) || source.includes(`require("${pkg2}")`);
}
async function detectProviders(directory, filesContent) {
  const detected = /* @__PURE__ */ new Map();
  const allSources = [...filesContent.values()].join("\n");
  let deps = {};
  try {
    const raw = await (0, import_promises.readFile)((0, import_node_path3.join)(directory, "package.json"), "utf-8");
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
function runOxlint(args, cwd) {
  return new Promise((resolveRun) => {
    const child = (0, import_node_child_process.spawn)("npx", args, { cwd });
    let stdout = "";
    let stderr = "";
    child.stdout?.on("data", (chunk) => {
      stdout += chunk;
    });
    child.stderr?.on("data", (chunk) => {
      stderr += chunk;
    });
    child.on("error", (error) => resolveRun({ stdout, stderr, error }));
    child.on("close", () => resolveRun({ stdout, stderr }));
  });
}
async function walk(dir, root, files) {
  const entries = await (0, import_promises2.readdir)(dir, { withFileTypes: true });
  for (const entry of entries) {
    if (entry.name.startsWith(".")) continue;
    const full = (0, import_node_path4.join)(dir, entry.name);
    if (entry.isDirectory()) {
      if (SKIP_DIRS.has(entry.name)) continue;
      await walk(full, root, files);
    } else if (SOURCE_EXT.test(entry.name)) {
      files.push((0, import_node_path4.relative)(root, full));
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
    for (const rule26 of provider.oxlintRules) {
      oxlintRules[`${PLUGIN_NAME}/${rule26.key}`] = rule26.severity === "error" || rule26.severity === void 0 ? "error" : "warn";
      ruleMetaByKey.set(rule26.key, rule26);
    }
  }
  return { oxlintRules, ruleMetaByKey };
}
async function scan(directory, options = {}) {
  const absRoot = (0, import_node_path4.resolve)(directory);
  const paths = [];
  try {
    await walk(absRoot, absRoot, paths);
  } catch (err) {
    throw new ScanError(`Could not read directory: ${absRoot}`, err);
  }
  const filesContent = /* @__PURE__ */ new Map();
  for (const rel of paths) {
    const content = await (0, import_promises2.readFile)((0, import_node_path4.join)(absRoot, rel), "utf-8");
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
  const require2 = (0, import_node_module.createRequire)(importMetaUrl);
  const pluginEntry = require2.resolve("@api-doctor/cli/plugin");
  const tmpDir = (0, import_node_fs3.mkdtempSync)((0, import_node_path4.join)(import_node_os.default.tmpdir(), "api-doctor-oxlint-"));
  const configPath = (0, import_node_path4.join)(tmpDir, "oxlintrc.json");
  const config = {
    jsPlugins: [pluginEntry],
    rules: oxlintRules,
    ignorePatterns: Array.from(SKIP_DIRS)
  };
  (0, import_node_fs3.writeFileSync)(configPath, JSON.stringify(config, null, 2), "utf-8");
  const res = await runOxlint(
    ["oxlint", "--config", configPath, "--format", "json", "."],
    absRoot
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
        if (filename.startsWith(absRoot)) return (0, import_node_path4.relative)(absRoot, filename);
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
    (0, import_node_fs3.rmSync)(tmpDir, { recursive: true, force: true });
  }
}

// src/reporter/markdown.ts
var import_node_path5 = require("path");
function rationaleByRule() {
  const map = /* @__PURE__ */ new Map();
  for (const provider of providers) {
    for (const rule26 of provider.oxlintRules) {
      const docs = getRuleDocsMeta(rule26.key);
      if (docs?.rationale) map.set(rule26.resultRule, docs.rationale);
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
  out.push(`**Project:** ${(0, import_node_path5.basename)(scanMeta.directory)}`);
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
var import_picocolors = __toESM(require("picocolors"), 1);
var ISSUES_URL = "https://github.com/qualtyco/api-doctor/issues";
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
async function printDetectedProviders(detected) {
  console.log(import_picocolors.default.bold("Detected APIs & SDKs"));
  for (const d of detected) {
    const manifest = providers.find((p) => p.name === d.name);
    const label = manifest?.displayName ?? d.name;
    const via = import_picocolors.default.dim(`via ${detectionSourceLabel(d.source)}`);
    if (d.checked) {
      const ruleCount = manifest?.oxlintRules.length ?? 0;
      const checks = import_picocolors.default.dim(`\u2014 ${ruleCount} check${ruleCount === 1 ? "" : "s"}`);
      console.log(`  ${import_picocolors.default.green("\u2713")} ${label} ${via} ${checks}`);
    } else {
      console.log(`  ${import_picocolors.default.dim("\u25CB")} ${label} ${via} ${import_picocolors.default.dim("\u2014 no checks yet")}`);
    }
    await revealDelay();
  }
  console.log("");
}
function scoreColor(score) {
  if (score >= 75) return import_picocolors.default.green;
  if (score >= 50) return import_picocolors.default.yellow;
  return import_picocolors.default.red;
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
  if (score >= 50) return box([" o o", " __ "]);
  return box([" >< ", " == "]);
}
function progressBar(score, color) {
  const filled = Math.round(score / 100 * BAR_WIDTH);
  const empty = BAR_WIDTH - filled;
  return color("\u2588".repeat(Math.max(0, filled))) + import_picocolors.default.dim("\u2591".repeat(Math.max(0, empty)));
}
function padVisible(text, width) {
  const plain = text.replace(/\u001b\[[0-9;]*m/g, "");
  const spaces = Math.max(0, width - plain.length);
  return text + " ".repeat(spaces);
}
async function printHeader(score) {
  const color = scoreColor(score);
  const scoreText = `${color(String(score))}${import_picocolors.default.dim(" / 100")} ${color(statusLabel(score))}`;
  const bar = progressBar(score, color);
  const icon = headerIcon(score, color);
  const iconColWidth = 8;
  const lines = [
    `${padVisible(icon[0], iconColWidth)}${scoreText}`,
    `${padVisible(icon[1], iconColWidth)}${bar}`,
    padVisible(icon[2], iconColWidth),
    padVisible(icon[3], iconColWidth)
  ];
  for (const line of lines) {
    console.log(line);
    await lineDelay();
  }
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
  if (errors > 0) parts.push(import_picocolors.default.red(`${errors} error${errors === 1 ? "" : "s"}`));
  if (warnings > 0) parts.push(import_picocolors.default.yellow(`${warnings} warning${warnings === 1 ? "" : "s"}`));
  if (infos > 0) parts.push(import_picocolors.default.cyan(`${infos} info`));
  if (parts.length === 0) {
    console.log(import_picocolors.default.green("No issues found"));
    return;
  }
  const duration = formatDuration(elapsedMs);
  const tail = [
    fileCount > 0 ? `across ${fileCount} file${fileCount === 1 ? "" : "s"}` : "",
    duration ? `in ${duration}` : ""
  ].filter(Boolean).join(" ");
  console.log(`${parts.join(import_picocolors.default.dim(", "))}${tail ? import_picocolors.default.dim(` ${tail}`) : ""}`);
}
async function printIssueGroups(groups, verbose) {
  for (const group of groups) {
    const count = group.items.length;
    const severity = group.items[0]?.severity;
    const countColor = severity === "warning" ? import_picocolors.default.yellow : severity === "info" ? import_picocolors.default.cyan : import_picocolors.default.red;
    const countLabel = count > 1 ? countColor(` (${count})`) : "";
    const prefix = severity === "warning" ? import_picocolors.default.yellow("\xD7") : severity === "info" ? import_picocolors.default.cyan("\u2139") : import_picocolors.default.red("\xD7");
    console.log(`${prefix} ${group.message}${countLabel}`);
    await lineDelay();
    for (const [index, item] of group.items.entries()) {
      console.log(import_picocolors.default.dim(`    ${index + 1}. ${item.file}:${item.line}`));
      if (verbose) {
        console.log(import_picocolors.default.dim(`       ${item.snippet}`));
        console.log(import_picocolors.default.cyan(`       Fix: ${group.fix}`));
        if (group.docsUrl) console.log(import_picocolors.default.dim(`       Docs: ${group.docsUrl}`));
      }
      if (group.items.length > 1) await lineDelay();
    }
    if (!verbose && (group.fix || group.docsUrl)) {
      console.log(import_picocolors.default.cyan(`    \u2192 ${group.fix}`));
    }
    console.log("");
    await revealDelay();
  }
}
async function renderTerminalReport(results, detected, options = {}) {
  if (detected.length === 0) {
    const names = providers.map((p) => p.displayName).join(", ");
    console.log(import_picocolors.default.dim("No API providers detected in this project."));
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
  await printDetectedProviders(detected);
  await printHeader(score);
  console.log("");
  await revealDelay();
  if (results.length === 0) {
    const duration = formatDuration(options.elapsedMs);
    const scannedLabel = checked.length > 0 ? `Checked ${checked.map((d) => providers.find((p) => p.name === d.name)?.displayName ?? d.name).join(", ")}` : `Found ${displayNames(detected)}`;
    console.log(import_picocolors.default.dim(`${scannedLabel}${duration ? ` in ${duration}` : ""}`));
    console.log("");
    console.log(import_picocolors.default.green(`${import_picocolors.default.bold("\u2713")} No issues found`));
    return;
  }
  printSummary(errors, warnings, infos, fileCount, options.elapsedMs);
  console.log("");
  await printIssueGroups(groupResults(results), options.verbose ?? false);
}
function countErrors(results) {
  return results.filter((r) => r.severity === "error").length;
}
function renderInstallHint() {
  console.log("");
  console.log(import_picocolors.default.cyan("\u2192 Hook up your coding agent (one-time):"));
  console.log(import_picocolors.default.bold(`  ${INSTALL_COMMAND}`));
}

// src/reporter/verbose.ts
var import_picocolors2 = __toESM(require("picocolors"), 1);
function severityTag(severity) {
  if (severity === "error") return import_picocolors2.default.red("error");
  if (severity === "warning") return import_picocolors2.default.yellow("warning");
  return import_picocolors2.default.cyan("info");
}
function printSnippet(report, index) {
  const finding = report.findings[index];
  const { lines, highlightedLine } = finding.codeSnippet;
  const gutterWidth = String(lines.at(-1)?.number ?? highlightedLine).length;
  for (const line of lines) {
    const num = String(line.number).padStart(gutterWidth, " ");
    const isIssue = line.number === highlightedLine;
    const marker = isIssue ? import_picocolors2.default.red(">") : " ";
    const body = `${marker} ${import_picocolors2.default.dim(`${num} |`)} ${line.text}`;
    console.log(isIssue ? body : import_picocolors2.default.dim(body));
  }
}
async function renderVerboseReport(report) {
  const { summary, findings } = report;
  console.log("");
  console.log(
    import_picocolors2.default.bold(`api-doctor \u2014 ${summary.score}/100 (${summary.severity})`)
  );
  console.log(
    import_picocolors2.default.dim(
      `${summary.errors} errors, ${summary.warnings} warnings, ${summary.info} info across ${report.scanMeta.filesScanned} files`
    )
  );
  console.log("");
  if (findings.length === 0) {
    console.log(import_picocolors2.default.green(`${import_picocolors2.default.bold("\u2713")} No issues found`));
    return;
  }
  for (let index = 0; index < findings.length; index++) {
    const finding = findings[index];
    const loc = `${finding.location.file}:${finding.location.line}:${finding.location.column}`;
    console.log(
      `${severityTag(finding.severity)} ${import_picocolors2.default.bold(finding.message)} ${import_picocolors2.default.dim(`[${finding.rule}]`)}`
    );
    console.log(import_picocolors2.default.dim(`  ${loc}`));
    console.log("");
    printSnippet(report, index);
    console.log("");
    console.log(`  ${import_picocolors2.default.cyan("Fix:")} ${finding.fix}`);
    if (finding.docsUrl) console.log(`  ${import_picocolors2.default.dim("Docs:")} ${finding.docsUrl}`);
    console.log("");
    await revealDelay();
  }
}

// src/reporter/index.ts
async function emitReport(results, detected, report, options) {
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
    await renderVerboseReport(report);
  } else {
    await renderTerminalReport(results, detected, { elapsedMs: options.elapsedMs });
  }
  writeFileReport();
  if (!options.noReport) {
    console.log(`\u2192 Report written to ${options.reportDisplayPath}`);
  }
  if (!isAgentSkillInstalled(report.scanMeta.directory)) {
    renderInstallHint();
  }
}

// src/cli.ts
var __dirname = (0, import_node_path6.dirname)((0, import_node_url2.fileURLToPath)(importMetaUrl));
var pkg = JSON.parse(
  (0, import_node_fs4.readFileSync)((0, import_node_path6.join)(__dirname, "../package.json"), "utf-8")
);
var VALID_FORMATS = ["json", "markdown", "sarif"];
function fail(message) {
  console.error(`api-doctor: ${message}`);
  process.exit(2);
}
var program = new import_commander.Command();
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
    const spinner = createSpinner("Scanning for API integrations\u2026");
    let scanOutput;
    try {
      scanOutput = await scan(directory, { onlyProviders });
    } finally {
      spinner.stop();
    }
    const { results, detected, directory: scannedDir, filesScanned, filesContent } = scanOutput;
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
    const outputPath = opts.output ? (0, import_node_path6.resolve)(opts.output) : (0, import_node_path6.join)(scannedDir, DEFAULT_REPORT_DIR, DEFAULT_REPORT_FILE);
    const rel = (0, import_node_path6.relative)(scannedDir, outputPath);
    const reportDisplayPath = rel.startsWith("..") ? outputPath : rel;
    await emitReport(results, detected, report, {
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
program.command("install").description("Install api-doctor as a skill/rule for Claude Code, Cursor, Codex, and other agents").argument("[directory]", "Project directory to install into", ".").option("--force", "Overwrite an existing skills/api-doctor/SKILL.md from the package").action((directory, options) => {
  const { created, updated, skipped } = installAgentFiles((0, import_node_path6.resolve)(directory), {
    force: options.force
  });
  for (const path of created) console.log(`api-doctor: created ${path}`);
  for (const path of updated) console.log(`api-doctor: updated ${path}`);
  for (const path of skipped) {
    console.log(`api-doctor: skipped ${path} (already exists; use --force to refresh)`);
  }
  console.log(
    "api-doctor: edit skills/api-doctor/SKILL.md \u2014 all agents reference that file."
  );
});
program.parse();
//# sourceMappingURL=cli.cjs.map