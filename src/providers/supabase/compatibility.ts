/**
 * Hand-verified removals in @supabase/supabase-js, consumed by the
 * supabase-removed-method compatibility rule.
 *
 * All of these are method paths, not exported symbols: `createClient` is still
 * `createClient` and the import never changed, so nothing about the import
 * statement records that `supabase.auth.signIn(...)` cannot work. See
 * `_shared/removed-method.ts` for why that needs its own detection.
 *
 * Why v1 → v2 is worth encoding years after the fact: this is the single most
 * common thing an agent gets wrong about Supabase. v1 idioms (`auth.signIn`,
 * `auth.user()`, `auth.session()`) dominate the pre-2022 material these models
 * learned from and are still emitted constantly into projects that have v2
 * installed, where they are `undefined is not a function` at runtime. The rule
 * costs a pinned-v1 project nothing: it fires only when the installed version
 * is provably ≥ 2.0.0, so genuinely-v1 code stays silent forever, and it never
 * suggests upgrading.
 *
 * Every entry is verified by hand against the published tarballs
 * (implementation, not just the type diff): @supabase/gotrue-js@1.22.22 — the
 * auth client v1 depended on — against @supabase/auth-js@2.112.3, and
 * @supabase/supabase-js@1.35.7 against 2.112.3 for the client-level methods.
 *
 * The `MethodRemoval` shape and the rules for writing `verifyHint` live in
 * src/types.ts — this file is the Supabase data and nothing else.
 */
import type { MethodRemoval, ProviderCompatibility } from '../../types.js';

export const SUPABASE_PACKAGE = '@supabase/supabase-js';

const AUTH_EVIDENCE =
  'npm pack @supabase/gotrue-js@1.22.22 (the auth client supabase-js@1.35.7 depends on) vs @supabase/auth-js@2.112.3 (the one 2.112.3 depends on); public method lists taken from dist/module/GoTrueClient.d.ts in each.';

export const supabaseMethodRemovals: MethodRemoval[] = [
  {
    path: 'auth.signIn',
    removedIn: '2.0.0',
    replacements: [
      'auth.signInWithPassword',
      'auth.signInWithOtp',
      'auth.signInWithOAuth',
      'auth.signInWithIdToken',
    ],
    kind: 'split',
    wireIdentical: false,
    verifiedAt: '2026-08-19',
    evidence: `${AUTH_EVIDENCE} v1 GoTrueClient.js:124 \`signIn({ email, phone, password, refreshToken, provider, oidc })\` dispatches internally on which fields are present — email+password to _handleEmailSignIn, email alone to api.sendMagicLinkEmail, phone alone to api.sendMobileOTP, phone+password to _handlePhoneSignIn, refreshToken to _callRefreshToken. v2 has no \`signIn\`; those branches are the separate signInWith* methods.`,
    verifyHint:
      'The v1 call chose its behaviour from which fields you passed, so the successor depends on the arguments at this exact call site: email+password → signInWithPassword, email or phone alone → signInWithOtp (which SENDS a code and does not return a session — a call site that read `data.session` straight back will now get null), provider → signInWithOAuth, refreshToken → setSession. Check which branch this call was relying on before rewriting it.',
  },
  {
    path: 'auth.user',
    removedIn: '2.0.0',
    replacement: 'auth.getUser',
    kind: 'signature-change',
    wireIdentical: false,
    verifiedAt: '2026-08-19',
    evidence: `${AUTH_EVIDENCE} v1 GoTrueClient.js:222 \`user() { return this.currentUser }\` — a synchronous read of in-memory state, no request. v2 _getUser (GoTrueClient.js:2676) issues \`GET \${url}/user\` via _request and returns \`{ data: { user }, error }\`.`,
    verifyHint:
      'Synchronous became asynchronous AND local became networked: v1 `user()` returned the cached user object directly, v2 `getUser()` returns a Promise and makes a GET /user request that revalidates the token with the server. Add the await, unwrap `data.user` instead of using the return value directly, handle the `error` branch, and check any hot path or render function that called this — it is now a round trip. If you only need the cached session without a request, `getSession()` is the closer analogue.',
  },
  {
    path: 'auth.session',
    removedIn: '2.0.0',
    replacement: 'auth.getSession',
    kind: 'signature-change',
    wireIdentical: false,
    verifiedAt: '2026-08-19',
    evidence: `${AUTH_EVIDENCE} v1 GoTrueClient.js:228 \`session() { return this.currentSession }\` — synchronous. v2 \`async getSession()\` (GoTrueClient.js:2398) awaits initializePromise, acquires the storage lock and resolves \`{ data: { session }, error }\`.`,
    verifyHint:
      'Synchronous became asynchronous, and the return value is wrapped: v1 `session()` returned the session object itself, v2 `getSession()` returns a Promise of `{ data: { session }, error }`. Both read local state rather than the network, so there is no new request to budget for — but any code that used the result inline (a conditional, a header value, a render) now needs an await and `data.session`.',
  },
  {
    path: 'auth.update',
    removedIn: '2.0.0',
    replacement: 'auth.updateUser',
    kind: 'rename',
    // Same PUT /user with the same attributes object — verified in both
    // implementations, which is the only thing that licenses wireIdentical.
    wireIdentical: true,
    verifiedAt: '2026-08-19',
    evidence: `${AUTH_EVIDENCE} v1 update(attributes) → GoTrueApi.js:664 \`put(fetch, \${url}/user, attributes)\`; v2 updateUser(attributes) → GoTrueClient.js:2856 \`_request(fetch, 'PUT', \${url}/user, { body: attributes … })\`. Same method, same path, same bearer token, same attributes object.`,
    verifyHint:
      'Same PUT /user, same auth, same attributes object — no behavior change on the wire, this is a name change. The one difference is the return shape: v1 resolved `{ user, error }`, v2 resolves `{ data: { user }, error }`, so unwrap one level deeper at the call site.',
  },
  {
    path: 'auth.verifyOTP',
    removedIn: '2.0.0',
    replacement: 'auth.verifyOtp',
    kind: 'rename',
    // Capitalisation only, and the same POST /verify — verified in both.
    wireIdentical: true,
    verifiedAt: '2026-08-19',
    evidence: `${AUTH_EVIDENCE} v1 verifyOTP → GoTrueApi.js:290 \`post(fetch, \${url}/verify, { email, phone, token, type, redirect_to })\`; v2 verifyOtp → GoTrueClient.js:2036 \`_request(fetch, 'POST', \${url}/verify, …)\`. Same method, same path, same fields.`,
    verifyHint:
      'Same POST /verify, same request fields — the only change is the capitalisation of the method name (verifyOTP → verifyOtp). No behavior change on the wire. As with the other auth methods the result is now nested one level deeper under `data`.',
  },
  {
    path: 'auth.setAuth',
    removedIn: '2.0.0',
    kind: 'removed',
    wireIdentical: false,
    verifiedAt: '2026-08-19',
    evidence: `${AUTH_EVIDENCE} v1 GoTrueClient.js:302 \`setAuth(access_token)\` synthesised a session object in memory from a bare access token and fired a TOKEN_REFRESHED event. No equivalent exists in v2's method list.`,
    verifyHint:
      'There is no drop-in: v1 `setAuth` faked a session from an access token alone, with no refresh token, so nothing could renew it. If you have a full session, use `setSession({ access_token, refresh_token })`. If you only ever have a third-party token — the usual reason this call exists — pass an `accessToken: () => Promise<string>` function in the `createClient` options instead, which is the supported route and re-reads the token per request. Check that whatever refreshes the token still runs.',
  },
  {
    path: 'auth.getSessionFromUrl',
    removedIn: '2.0.0',
    kind: 'removed',
    wireIdentical: false,
    verifiedAt: '2026-08-19',
    evidence: `${AUTH_EVIDENCE} \`getSessionFromUrl\` is declared on v1's GoTrueClient and absent from v2's method list, which instead has \`exchangeCodeForSession\`.`,
    verifyHint:
      'Not a rename — the flow it belonged to changed. v2 parses the URL itself when `detectSessionInUrl` is on (the default in a browser), so the common case is to delete this call and read the session from `onAuthStateChange` or `getSession()`. For the PKCE flow, the explicit equivalent is `exchangeCodeForSession(code)`, which takes the `?code=` query parameter rather than the URL hash. Check which flow this call site is in before choosing.',
  },
  {
    path: 'removeAllSubscriptions',
    removedIn: '2.0.0',
    replacement: 'removeAllChannels',
    kind: 'rename',
    // Realtime v1 and v2 are different protocols — not a wire-identical swap.
    wireIdentical: false,
    verifiedAt: '2026-08-19',
    evidence:
      'npm pack @supabase/supabase-js 1.35.7 vs 2.112.3. v1 dist/module/SupabaseClient.d.ts declares removeAllSubscriptions/removeSubscription/getSubscriptions; none of the three appears anywhere in 2.112.3 dist/index.d.mts, which declares getChannels/removeChannel/removeAllChannels instead.',
    verifyHint:
      'The name is the smallest part of this change: v1 subscriptions and v2 channels are different realtime APIs, and the code that CREATED the thing being removed had to change too (`from(table).on(event, cb).subscribe()` became `channel(name).on("postgres_changes", filter, cb).subscribe()`). Check that the subscription setup in this file was migrated as well — a rewritten teardown against a v1-style setup will not compile.',
  },
  {
    path: 'removeSubscription',
    removedIn: '2.0.0',
    replacement: 'removeChannel',
    kind: 'rename',
    wireIdentical: false,
    verifiedAt: '2026-08-19',
    evidence:
      'npm pack @supabase/supabase-js 1.35.7 vs 2.112.3. Declared on v1 SupabaseClient (dist/module/SupabaseClient.d.ts), absent from 2.112.3 dist/index.d.mts, which declares `removeChannel(channel: RealtimeChannel)`.',
    verifyHint:
      'Takes a different object, not just a different name: v1 `removeSubscription` took a `RealtimeSubscription` from `.subscribe()` on a table listener, v2 `removeChannel` takes the `RealtimeChannel` returned by `client.channel(name)`. Check that the value passed here is the channel and that the matching subscribe call was migrated to the channel API.',
  },
  {
    path: 'getSubscriptions',
    removedIn: '2.0.0',
    replacement: 'getChannels',
    kind: 'rename',
    wireIdentical: false,
    verifiedAt: '2026-08-19',
    evidence:
      'npm pack @supabase/supabase-js 1.35.7 vs 2.112.3. Declared on v1 SupabaseClient (dist/module/SupabaseClient.d.ts), absent from 2.112.3 dist/index.d.mts, which declares `getChannels(): RealtimeChannel[]`.',
    verifyHint:
      'Returns a different element type: v1 gave `RealtimeSubscription[]`, v2 gives `RealtimeChannel[]`, so any property read off the elements (`.topic`, `.state`, per-subscription fields) needs rechecking against RealtimeChannel rather than assumed to carry over.',
  },
];

/**
 * Manifest-facing record. Declaring this on `supabaseManifest.compatibility`
 * is the only registration step.
 *
 * `removals` is empty on purpose: v1 → v2 kept `createClient` and every other
 * package-level export, so there is no exported-symbol removal to record. The
 * whole of Supabase's break is in the method paths above.
 */
export const supabaseCompatibility: ProviderCompatibility = {
  package: SUPABASE_PACKAGE,
  removals: [],
  methodRemovals: supabaseMethodRemovals,
};
