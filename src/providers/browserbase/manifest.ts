import type { ProviderManifest } from '../../types.js';
import { browserbaseCompatibility } from './compatibility.js';

export const browserbaseManifest: ProviderManifest = {
  name: 'browserbase',
  displayName: 'Browserbase',
  detect: {
    packages: ['@browserbasehq/sdk'],
    imports: ['@browserbasehq/sdk'],
    urlPatterns: ['api.browserbase.com'],
  },
  surface: {
    packages: ['@browserbasehq/sdk'],
    clientConstructors: ['Browserbase'],
    clientNamePattern: /^(bb|browserbase([-_]?client)?)$/i,
    docsUrl: 'https://docs.browserbase.com/reference/api/overview',
    // The version/commit this surface was last read against by hand. Bump both
    // together, only after re-reading the diff — `pnpm check:surface --local`
    // reports every SDK source commit landed since `commit`, including logic
    // changes that leave the method list untouched.
    verified: {
      version: '2.18.0',
      commit: 'ba34ebf73fd95632cdb1466a27cb69aff4e52cb7',
      at: '2026-08-19',
      sourceDir: 'src',
    },
    // Read for 2.18.0: 2.0.0 → 2.18.0 is purely additive at the method level
    // (compared across the published tarballs at 2.0.0/2.5.0/2.10.0/2.14.1/
    // 2.18.0 — nothing removed), so no within-2.x compatibility entry exists.
    // Two deprecations landed without removal and are NOT compatibility
    // findings, because the symbols still work: `contexts.update` is marked
    // @deprecated (resources/contexts.ts:33), and the `uploadUrl` field on
    // ContextCreateResponse/ContextUpdateResponse now always returns a
    // non-functional sentinel URL — Browserbase no longer supports context
    // uploads via the API (2.17.0, "Deprecate presigned-url context
    // uploads"). A caller still POSTing to that URL fails silently; that is a
    // correctness rule if it is anything, not a removed symbol.
    // The 1.x → 2.x break IS recorded, in compatibility.ts.
    // Verified against @browserbasehq/sdk@2.16.0 type declarations
    // (index.d.ts root class + resources/**/*.d.ts — multi-file Stainless
    // layout, resource classes resolved per file so the two distinct
    // `Downloads` classes map to sessions.downloads vs
    // sessions.recording.downloads) and cross-checked against the published
    // OpenAPI spec (https://docs.browserbase.com/reference/api/openapi.v1.yaml).
    // One SDK-side extra with no endpoint in the current spec copy:
    // sessions.downloads.list (GET /v1/sessions/{id}/downloads, the
    // per-session downloads archive — the spec now documents the newer
    // account-level /v1/downloads endpoints instead, which the SDK does not
    // wrap yet). Spec-side endpoints with no SDK method (SDK lags; nothing to
    // list here because no SDK call path exists): POST
    // /v1/agents/runs/{runId}/stop, the /v1/downloads trio, and the eleven
    // /v1/functions/* endpoints. Docs-page naming differs from the SDK in two
    // places: "Upload an Extension"/"Upload a Certificate" are
    // extensions.create/certificates.create, and "Fetch a Page" is
    // fetchAPI.create. Stagehand (@browserbasehq/stagehand) is deliberately
    // out of scope: it is an automation framework (page.act/extract/observe),
    // not a resource client for this API — its method paths would break the
    // closed endpoint vocabulary. Re-verify on SDK majors (`pnpm check:surface`).
    methods: [
      'agents.create',
      'agents.delete',
      'agents.list',
      'agents.retrieve',
      'agents.runs.create',
      'agents.runs.list',
      'agents.runs.listMessages',
      'agents.runs.retrieve',
      'agents.update',
      'certificates.create',
      'certificates.delete',
      'certificates.list',
      'certificates.retrieve',
      'contexts.create',
      'contexts.delete',
      'contexts.retrieve',
      'contexts.update',
      'extensions.create',
      'extensions.delete',
      'extensions.retrieve',
      'fetchAPI.create',
      'projects.list',
      'projects.retrieve',
      'projects.usage',
      'search.web',
      'sessions.create',
      'sessions.debug',
      'sessions.downloads.list',
      'sessions.list',
      'sessions.logs.list',
      'sessions.recording.downloads.create',
      'sessions.recording.downloads.list',
      'sessions.recording.retrieve',
      'sessions.replays.retrieve',
      'sessions.replays.retrievePage',
      'sessions.retrieve',
      'sessions.update',
      'sessions.uploads.create',
    ],
  },
  rules: [
    {
      key: 'browserbase-no-conditional-authz-on-anonymous-user',
      resultRule: 'browserbase/security/no-conditional-authz-on-anonymous-user',
      message: 'A Browserbase live-view/recording resource is gated only by a conditional authz check.',
      fix: 'Add an unconditional `if (!user) return ...` guard before the ownership check, so anonymous callers are rejected, not skipped past.',
      docsUrl: 'https://docs.browserbase.com/reference/api/session-live-urls',
      severity: 'error',
    },
    {
      key: 'browserbase-no-connect-url-in-api-response',
      resultRule: 'browserbase/security/no-connect-url-in-api-response',
      message: 'connectUrl (a bearer credential for the live browser) is included in an HTTP response.',
      fix: 'Omit connectUrl from the response body — keep it server-side only. Share debuggerFullscreenUrl from sessions.debug() instead.',
      docsUrl: 'https://docs.browserbase.com/reference/api/create-a-session',
      severity: 'error',
    },
    {
      key: 'browserbase-session-id-requires-ownership-check',
      resultRule: 'browserbase/security/session-id-requires-ownership-check',
      message: 'sessionId flows into a live-view/recording call with no ownership check.',
      fix: 'Look up the owning project/org by sessionId and verify the requesting user has access before calling sessions.debug()/recording.retrieve().',
      docsUrl: 'https://docs.browserbase.com/platform/browser/observability/session-live-view',
      severity: 'warning',
    },
    {
      key: 'browserbase-no-concurrent-shared-context',
      resultRule: 'browserbase/correctness/no-concurrent-shared-context',
      message: 'The same Context id is passed into every session in a concurrent Promise.all batch.',
      fix: 'Serialize sessions that share a context id, or create a fresh Context per concurrent run.',
      docsUrl: 'https://docs.browserbase.com/platform/browser/core-features/contexts',
      severity: 'error',
    },
    {
      key: 'browserbase-mobile-device-requires-os-setting',
      resultRule: 'browserbase/correctness/mobile-device-requires-os-setting',
      message: 'A "mobile" device branch resizes the viewport but never sets browserSettings.os.',
      fix: "Set browserSettings.os = 'mobile' (or 'tablet') alongside the viewport resize — the Node SDK's device-emulation lever is `os`, not a fingerprint object.",
      docsUrl: 'https://docs.browserbase.com/platform/identity/verified-customization',
      severity: 'error',
    },
    {
      key: 'browserbase-use-typed-exception-status-not-substring',
      resultRule: 'browserbase/correctness/use-typed-exception-status-not-substring',
      message: 'Error handling matches a substring of the stringified error instead of err.status.',
      fix: 'Check err.status (or `instanceof Browserbase.APIError`/`NotFoundError`) instead of matching message text.',
      docsUrl: 'https://docs.browserbase.com/reference/api/session-live-urls',
      severity: 'info',
    },
    {
      key: 'browserbase-release-session-on-connect-failure',
      resultRule: 'browserbase/reliability/release-session-on-connect-failure',
      message: 'A connect call after session creation has no catch that releases the session on failure.',
      fix: 'Wrap the connect call in try/catch and call sessions.update(id, { status: "REQUEST_RELEASE" }) on failure.',
      docsUrl: 'https://docs.browserbase.com/reference/api/update-a-session',
      severity: 'error',
    },
    {
      key: 'browserbase-dont-stack-custom-retry-on-sdk-retry',
      resultRule: 'browserbase/reliability/dont-stack-custom-retry-on-sdk-retry',
      message: 'sessions.create() is called inside a custom retry loop without disabling the SDK\'s own retry.',
      fix: 'Pass { maxRetries: 0 } to sessions.create() so the outer loop is the only thing retrying.',
      docsUrl: 'https://docs.browserbase.com/optimizations/concurrency/overview',
      severity: 'warning',
    },
    {
      key: 'browserbase-no-overbroad-error-substring-match',
      resultRule: 'browserbase/reliability/no-overbroad-error-substring-match',
      message: 'An error-message OR-chain includes an overly broad resource-name substring.',
      fix: 'Match on err.status/`instanceof` instead of a generic word like "session" that matches almost any error from this call.',
      docsUrl: 'https://docs.browserbase.com/reference/api/session-live-urls',
      severity: 'error',
    },
    {
      key: 'browserbase-use-sdk-not-raw-requests',
      resultRule: 'browserbase/reliability/use-sdk-not-raw-requests',
      message: 'A raw HTTP request targets a Browserbase API endpoint instead of using the SDK.',
      fix: 'Replace the raw fetch/axios/http call with the equivalent installed-SDK method.',
      docsUrl: 'https://docs.browserbase.com/reference/sdk/nodejs',
      severity: 'info',
    },
    {
      key: 'browserbase-centralize-request-release',
      resultRule: 'browserbase/reliability/centralize-request-release',
      message: 'REQUEST_RELEASE is hand-rolled inline instead of going through a shared abstraction.',
      fix: 'Route this call through a single designated release/provider method instead of inlining sessions.update(..., { status: "REQUEST_RELEASE" }).',
      docsUrl: 'https://docs.browserbase.com/reference/api/update-a-session',
      severity: 'warning',
    },
    {
      key: 'browserbase-removed-method',
      resultRule: 'browserbase/removed-method',
      message:
        'Code calls a @browserbasehq/sdk client method that does not exist in the installed SDK version.',
      fix: 'Move the call onto the 2.x resource client — createSession → sessions.create, listSessions → sessions.list, getSession → sessions.retrieve, getSessionLogs → sessions.logs.list, getDebugConnectionURLs → sessions.debug, createContext → contexts.create. Check the per-finding Verify line first: three of these changed arguments or dropped a retry loop, and getConnectURL has no successor at all.',
      docsUrl: 'https://docs.browserbase.com/reference/sdk/nodejs',
      severity: 'error',
      // The finding must name the installed version ("you have 2.18.0
      // installed") — that fact only exists at lint time.
      dynamicMessage: true,
    },
  ],
  compatibility: browserbaseCompatibility,
};
