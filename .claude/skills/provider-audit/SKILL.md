---
name: provider-audit
description: Audits AI-generated integration code for an API provider by cross-referencing it against the provider's MCP and docs. Produces a categorized findings report at docs/audits/<provider>-audit-<YYYY-MM-DD>.md. Use when Reuben says "audit <provider>," "find what agents get wrong with <provider>," or "produce the audit for the next rule pack."
---

# Provider Audit Skill

Produce a structured audit report of agent-generated integration code, cross-referenced against the provider's MCP and official docs. The report is the source of truth for the `rule-author` skill in a separate session.

**Do not fix the code. Do not write rules. Just produce the report.**

## Required inputs

Confirm before starting:

1. Provider name (e.g., Stripe)
2. Provider docs URL (e.g., docs.stripe.com)
3. Provider MCP install command, or "unavailable"
4. SDK npm package name, or "N/A" if no app-facing SDK applies
5. Path to the sample project to audit
6. Which agent(s) generated the sample (Cursor / Claude Code / both)

If anything is unclear, stop and ask. Do not invent provider facts.

**Strongly recommended:** generate the sample project with **two agents in parallel** (e.g., `sample-project/cursor/` and `sample-project/claude-code/`). Bugs that appear in both are universal; bugs that appear in only one are agent-specific. Single-agent audits are valid but must be disclosed as such in the report's Notes section.

## Process

### 1. Set up

Install the provider's MCP server if available. Verify it works with a basic factual question. If unavailable or broken, note this in the report and fall back to docs only.

### 2. Audit

For every relevant file in the sample project, cross-reference against sources in this priority order:

1. Provider's MCP server
2. Provider's official documentation (live fetch, not training-data recall)
3. Provider's official SDK source code on GitHub
4. Provider's changelog / migration guides

**Verify time-sensitive claims twice.** API version numbers, enum values, deprecated method names, and config schema fields drift between provider releases and agent training cutoffs. Before including any such claim in a finding, re-fetch the relevant docs page a second time to confirm. Disclose this verification in the Notes section.

**Do not modify any code in the sample project.** This is observation-only.

### 3. Balance

Before producing the final report, add:

- **At least 2 adversarial findings**: code that *looks* wrong but is actually correct. These become negative test cases for rule writing. Each adversarial must include a "why it's actually correct" explanation with a docs reference.
- **At least 1 partial-credit finding**: a bug where the agent got most of it right but missed a detail (e.g., signature verified *after* body processing; idempotency key generated with `Math.random()`; correct Railway-specific behavior but no portable fallback).

This prevents the rule pack from becoming one-sided.

### 4. Look for root-cause clusters

After all findings are recorded, scan for clusters: multiple findings that share an underlying gap in how agents model the provider. Examples from past audits:

- Railway: 5 findings all stemmed from agents not modeling deploy-time vs. runtime separation
- Resend: multiple findings stemmed from agents not modeling marketing-vs-transactional email distinctions

If you find a cluster of 3+ findings sharing a root cause, document it in a "Root-cause clusters" section of the report. This is valuable for both rule design (cluster findings sometimes consolidate into fewer rules) and for content/marketing (clusters make publishable blog posts).

Do not invent clusters. If no 3+ finding cluster exists, omit the section.

### 5. Categorize and check coverage

Sort findings into four categories. Minimums:

| Category | Minimum |
|---|---|
| Security | 3 |
| Correctness | 4 |
| Reliability | 3 |
| Integration | 3 |

**Total minimum: 13 findings.** If a category falls short, note why in the report (e.g., "provider has no webhook surface"). Do not pad with fake findings.

## Severity rubric

Apply this rubric strictly. Each level has an operational test.

- **Critical**: A user following the documented happy path encounters user harm, security breach, data loss, financial damage, or compliance violation. Operational test: *"If I deploy this code exactly as the README/docs say, does someone get hurt?"* If yes → critical.
- **High**: Significantly degrades behavior, violates explicit provider warnings, or causes recoverable production failures (not first-deploy-blocking, but real). Operational test: *"Will this break in production within a week of moderate usage?"*
- **Medium**: Violates documented best practices, affects operations or observability, or creates risk under specific conditions. Operational test: *"Will an experienced engineer reading the code think 'they should have known better'?"*
- **Low**: Stylistic or convention-level violations with minor practical impact. Operational test: *"Would I bring this up in code review but not block on it?"*

Severity reflects impact, not how clearly the code violates a guideline. A clearly-violated low-impact convention is still low. A subtly-violated high-impact pattern is still high.

## Output schema

Write to `docs/audits/<provider>-audit-<YYYY-MM-DD>.md`:

````markdown
# <Provider> Audit Report

**Date:** YYYY-MM-DD
**Provider:** <name>
**Docs:** <URL>
**MCP:** <install cmd or "unavailable">
**SDK:** `<npm-name>` or "N/A"
**Sample project:** <path>
**Agent(s) used:** <Cursor | Claude Code | both>

## Summary

- Total findings: N
- Critical: n / High: n / Medium: n / Low: n
- Adversarial findings: n
- Root-cause clusters identified: n (or "none")

## Coverage

| Category | Findings | Minimum | Status |
|---|---|---|---|
| Security | n | 3 | ✓/✗ |
| Correctness | n | 4 | ✓/✗ |
| Reliability | n | 3 | ✓/✗ |
| Integration | n | 3 | ✓/✗ |

## Findings

### Finding A: <one-sentence title>

- **Severity:** critical | high | medium | low
- **Category:** security | correctness | reliability | integration
- **CWE / OWASP:** <if security, else N/A>
- **Detectable via AST:** Y | N | partial
- **Reproducibility:** reliable | sometimes | rare
- **Rule status:** `<provider>/<kebab-name>` | non-rule (reason) | n/a (out of provider scope)

**Affected files:**
- `path/to/file.ts:24-32` (tight ranges only — point at the specific construct, not the whole file)

**What's wrong:** <2-3 sentences>

**What should happen:**

```typescript
<correct pattern, brief>
```

**Docs:** <specific URL backing the finding>

---

[repeat for findings B, C, ...]

## Adversarial findings

### Adversarial A: <title>

- **Why this looks suspicious:** <1 sentence>
- **Why it's actually correct:** <1-2 sentences + docs reference>
- **Affected files:** <paths>

```typescript
<the code>
```

[repeat for at least 2 adversarial findings]

## Root-cause clusters

*(Omit this section if no 3+ finding cluster exists.)*

### Cluster 1: <name of underlying gap, e.g. "deploy-time vs runtime separation">

Findings <list>: all stem from <root cause described in 2-3 sentences>. Implication for rule design: <e.g., "consider one anchor rule + supporting rules" or "5 peer rules is correct because each detects independently">. Implication for content: <e.g., "publishable as a blog post: '5 ways agents get X wrong'">.

## Recommended rule list

Checkbox summary. Full details in the findings above.

- [ ] `<provider>/<rule-name-1>` — critical, security (Finding A)
- [ ] `<provider>/<rule-name-2>` — critical, correctness (Finding D)
- [ ] `<provider>/<rule-name-3>` — high, reliability (Finding H)
...

## Non-rule findings

*(Findings that are real provider-integration issues but cannot be expressed as static AST rules. The rule-author skill will skip these.)*

- **Finding I (cron retry/alerting gap)**: operational concern, detectability=N. Document in provider best-practices guide instead.
- **Finding L (missing DB provisioning docs)**: documentation gap, not code pattern. Surface as a separate "provider onboarding" content piece.

## Out of scope

*(Items considered but excluded because they don't belong in a provider audit at all.)*

- **<short description>**: <reason — e.g., "general code review concern, not provider-specific" or "client-side app logic with no provider surface">

## Notes

- MCP used: yes / no / partial — <describe which tools queried, if any>
- Sample scenarios audited: N
- Agent that generated sample: <Cursor | Claude Code | both>
- **Time-sensitive claims verified twice:** <list which findings (typically version numbers, enum values, deprecated APIs) were re-verified with a second docs fetch>
- Limitations: <e.g., "single-agent generation — findings may be Claude Code-specific failure modes rather than universal">
- Docs snapshot date: <YYYY-MM-DD>
- SDK version examined: <version, if applicable>
````

## Quality rules

1. **Don't invent provider facts.** If unsure about an event name, header, error code, method signature, or config schema, query the MCP/docs or ask the user. Inaccuracy here propagates into rules and gets caught publicly.
2. **Verify time-sensitive claims twice.** API versions, enum values, deprecated names, schema fields drift constantly. Re-fetch before including. Disclose in Notes.
3. **Findings must be verifiable in under 5 minutes** against the linked docs page by a skeptical reader.
4. **Read the code line by line.** Don't grep for known antipatterns; find what the agent actually did.
5. **Line ranges must be tight.** `file.ts:24-32` (pointing at the specific construct), not `file.ts:1-100` (covering everything).
6. **Apply the severity rubric strictly.** Each finding's severity passes the rubric's operational test, not vibes.
7. **Prefer fewer-but-correct over more-but-shaky.** 13 defensible findings > 20 mixed-quality ones.
8. **Separate non-rule from out-of-scope.** Non-rule findings are real provider issues that can't be static-detected; out-of-scope items don't belong in the audit at all.

## Common failure modes

- **Severity inflation under pressure to find criticals.** Don't promote `high` to `critical` because the audit "needs" more criticals. The rubric is the rubric.
- **Padding findings to hit category minimums.** If a category is genuinely thin, note why; don't fabricate.
- **Single-agent generation reported as if universal.** Always disclose which agent generated the sample. "AI agents get X wrong" overclaims if you only tested one.
- **Listing app-logic bugs in a provider audit.** General code-quality issues belong in code review, not in a provider integration audit. Filter ruthlessly.
- **Cluster invention.** If 3+ findings don't genuinely share a root cause, don't manufacture one. The Root-cause clusters section is optional.

## What this skill does NOT do

- Write rules (that's `rule-author`)
- Fix any code in the sample project
- Publish anything
- Modify the api-doctor monorepo
- Decide which provider to audit next (that's a strategic call)