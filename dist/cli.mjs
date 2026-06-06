#!/usr/bin/env node

// src/cli.ts
import { Command } from "commander";
import { readFileSync } from "fs";
import { dirname, join as join3 } from "path";
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
var providers = [resendManifest, stripeManifest, supabaseManifest];

// src/reporter.ts
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
function report(results, detected, options = {}) {
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

// src/scanner.ts
import { spawnSync } from "child_process";
import { mkdtempSync, rmSync, writeFileSync } from "fs";
import { readdir, readFile as readFile2 } from "fs/promises";
import { createRequire } from "module";
import os from "os";
import { join as join2, relative, resolve } from "path";

// src/constants.ts
var PLUGIN_NAME = "api-doctor";

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
function buildOxlintConfig(detectedNames) {
  const oxlintRules = {};
  const ruleMetaByKey = /* @__PURE__ */ new Map();
  for (const provider of providers) {
    if (!detectedNames.has(provider.name)) continue;
    for (const rule of provider.oxlintRules) {
      oxlintRules[`${PLUGIN_NAME}/${rule.key}`] = rule.severity === "error" || rule.severity === void 0 ? "error" : "warn";
      ruleMetaByKey.set(rule.key, rule);
    }
  }
  return { oxlintRules, ruleMetaByKey };
}
async function scan(directory, options = {}) {
  const absRoot = resolve(directory);
  const paths = [];
  await walk(absRoot, absRoot, paths);
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
    return { results: [], detected };
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
  writeFileSync(configPath, JSON.stringify(config, null, 2), "utf-8");
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
    const parsed = JSON.parse(res.stdout);
    const diagnostics = parsed.diagnostics ?? [];
    const results = [];
    for (const d of diagnostics) {
      const code = String(d.code ?? "");
      const meta = [...ruleMetaByKey.entries()].find(([key]) => code.includes(key))?.[1];
      if (!meta) continue;
      const relFile = (() => {
        const filename = String(d.filename ?? "");
        if (!filename) return "";
        if (filename.startsWith(absRoot)) return relative(absRoot, filename);
        return filename.replace(/^[.\\/]+/, "");
      })();
      const span = d.labels?.[0]?.span;
      const line = typeof span?.line === "number" ? span.line : 1;
      const content = filesContent.get(relFile) ?? "";
      const snippet = content.split(/\r?\n/)[line - 1]?.trim() ?? "";
      results.push({
        file: relFile,
        line,
        snippet,
        rule: meta.resultRule,
        // The manifest declares the intended severity (including `info`, which
        // oxlint reports as a warning). Fall back to oxlint's severity.
        severity: meta.severity ?? (d.severity === "warning" ? "warning" : "error"),
        message: meta.message,
        fix: meta.fix,
        docsUrl: meta.docsUrl
      });
    }
    return { results, detected };
  } finally {
    rmSync(tmpDir, { recursive: true, force: true });
  }
}

// src/cli.ts
var __dirname2 = dirname(fileURLToPath(import.meta.url));
var pkg = JSON.parse(
  readFileSync(join3(__dirname2, "../package.json"), "utf-8")
);
var program = new Command();
program.name("api-doctor").description("Verification rules for AI-generated API integrations").version(pkg.version).argument("[directory]", "Project directory to scan", ".").option("--verbose", "Show file paths for each issue").option("--provider <names>", "Comma-separated providers to scan (e.g. resend)").option("--list-providers", "List supported API providers").action(async (directory, opts) => {
  if (opts.listProviders) {
    for (const p of providers) {
      console.log(`${p.name} \u2014 ${p.displayName}`);
    }
    process.exit(0);
  }
  const onlyProviders = opts.provider ? opts.provider.split(",").map((s) => s.trim()).filter(Boolean) : void 0;
  const start = performance.now();
  const { results, detected } = await scan(directory, { onlyProviders });
  report(results, detected, {
    verbose: opts.verbose,
    elapsedMs: performance.now() - start
  });
  const errors = countErrors(results);
  process.exit(errors > 0 ? 1 : 0);
});
program.parse();
//# sourceMappingURL=cli.mjs.map