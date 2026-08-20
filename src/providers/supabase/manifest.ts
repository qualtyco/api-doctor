import type { ProviderManifest } from '../../types.js';
import { supabaseCompatibility } from './compatibility.js';

export const supabaseManifest: ProviderManifest = {
  name: 'supabase',
  displayName: 'Supabase',
  detect: {
    packages: ['@supabase/supabase-js'],
    imports: ['@supabase/supabase-js', '@supabase/ssr'],
    urlPatterns: ['supabase.co'],
  },
  surface: {
    // @supabase/ssr's createBrowserClient/createServerClient return the same
    // SupabaseClient, so ssr imports verify a client without a separate list.
    packages: ['@supabase/supabase-js', '@supabase/ssr'],
    clientConstructors: ['createClient', 'createBrowserClient', 'createServerClient'],
    clientNamePattern: /^supabase([-_]?(client|admin))?$/i,
    docsUrl: 'https://supabase.com/docs/reference/javascript/introduction',
    // The version/commit this surface was last read against by hand. Bump both
    // together, only after re-reading the diff — `pnpm check:surface --local`
    // reports every SDK source commit landed since `commit`, including logic
    // changes that leave the method list untouched.
    //
    // supabase-js moved to an nx monorepo (packages/core, packages/shared)
    // that versions every sub-client in lockstep with the root, which is why
    // one `verified` block covers auth-js/storage-js/functions-js/realtime-js
    // too: they are published from this commit at this same version.
    verified: {
      version: '2.112.3',
      commit: 'a249594bc5790929ff090baa64f2d5bb3a40c286',
      at: '2026-08-19',
      sourceDir: 'packages/core',
    },
    // Read for 2.112.3: 2.111.0 → 2.112.3 is behaviour-only and adds no
    // client-rooted method. Tracing moved to an opt-in /tracing subpath
    // (#2583, a new entry point rather than a client method); maybeSingle now
    // honours throwOnError when it finds multiple rows (#2580); realtime
    // stopped duplicating `on` bindings (#2594), clears a stale join payload
    // on sign-out (#2597) and keeps token refresh alive across setAuth
    // (#2592); auth preserves 5xx error messages (#2587) and accepts
    // uppercase UUIDs (#2467); storage exposes a service error code on
    // StorageApiError (#2537). None is a removal or a rename, so nothing was
    // added to compatibility.ts for the 2.x line — the entries there are all
    // the v1 → v2 boundary.
    // Verified against @supabase/supabase-js@2.111.0 dist/index.d.mts
    // (SupabaseClient) and its lockstep-pinned sub-clients: @supabase/auth-js
    // 2.111.0 (GoTrueClient/GoTrueAdminApi + MFA/OAuth/passkey APIs),
    // @supabase/storage-js 2.111.0 (StorageClient + vectors/analytics),
    // @supabase/functions-js 2.111.0 (FunctionsClient), @supabase/realtime-js
    // 2.111.0 (RealtimeClient); cross-checked against the JS reference docs.
    //
    // supabase-js is a fluent builder API, so this list is deliberately
    // truncated at builder boundaries: it holds only client-rooted paths the
    // coverage collector can attribute (pure member chains off a verified
    // client). Builder-stage methods — everything called on the value
    // returned by from()/schema()/rpc()/channel()/storage.from()/
    // storage.vectors.from()/storage.analytics.from(), i.e. the docs'
    // Database select/insert/update/upsert/delete, all Filters and Modifiers,
    // Storage file operations (upload/download/…), vector index/data
    // operations, and Realtime channel methods (on/subscribe/send/track/…) —
    // pass through an intermediate call, are invisible to the collector
    // (never counted, not even as unknown), and are intentionally absent.
    // "supabase.from used" therefore means "queries tables", not which query
    // verbs run. Two entries are SDK-side extras absent from the docs nav:
    // auth.isThrowOnErrorEnabled and the auth.mfa.webauthn.* namespace (docs
    // fold webauthn into the mfa enroll/challenge/verify overload pages).
    // Excluded on purpose: the throwOnError()/setHeader() config-chain
    // helpers storage classes inherit from BaseApiClient (builder-stage
    // config, not API calls) and the corsHeaders module export (not a client
    // method). Re-verify on supabase-js majors (`pnpm check:surface`).
    methods: [
      'auth.admin.createUser',
      'auth.admin.customProviders.createProvider',
      'auth.admin.customProviders.deleteProvider',
      'auth.admin.customProviders.getProvider',
      'auth.admin.customProviders.listProviders',
      'auth.admin.customProviders.updateProvider',
      'auth.admin.deleteUser',
      'auth.admin.generateLink',
      'auth.admin.getUserById',
      'auth.admin.inviteUserByEmail',
      'auth.admin.listUsers',
      'auth.admin.mfa.deleteFactor',
      'auth.admin.mfa.listFactors',
      'auth.admin.oauth.createClient',
      'auth.admin.oauth.deleteClient',
      'auth.admin.oauth.getClient',
      'auth.admin.oauth.listClients',
      'auth.admin.oauth.regenerateClientSecret',
      'auth.admin.oauth.updateClient',
      'auth.admin.passkey.deletePasskey',
      'auth.admin.passkey.listPasskeys',
      'auth.admin.signOut',
      'auth.admin.updateUserById',
      'auth.dispose',
      'auth.exchangeCodeForSession',
      'auth.getClaims',
      'auth.getSession',
      'auth.getUser',
      'auth.getUserIdentities',
      'auth.initialize',
      'auth.isThrowOnErrorEnabled',
      'auth.linkIdentity',
      'auth.mfa.challenge',
      'auth.mfa.challengeAndVerify',
      'auth.mfa.enroll',
      'auth.mfa.getAuthenticatorAssuranceLevel',
      'auth.mfa.listFactors',
      'auth.mfa.unenroll',
      'auth.mfa.verify',
      'auth.mfa.webauthn.authenticate',
      'auth.mfa.webauthn.challenge',
      'auth.mfa.webauthn.enroll',
      'auth.mfa.webauthn.register',
      'auth.mfa.webauthn.verify',
      'auth.oauth.approveAuthorization',
      'auth.oauth.denyAuthorization',
      'auth.oauth.getAuthorizationDetails',
      'auth.oauth.listGrants',
      'auth.oauth.revokeGrant',
      'auth.onAuthStateChange',
      'auth.passkey.delete',
      'auth.passkey.list',
      'auth.passkey.startAuthentication',
      'auth.passkey.startRegistration',
      'auth.passkey.update',
      'auth.passkey.verifyAuthentication',
      'auth.passkey.verifyRegistration',
      'auth.reauthenticate',
      'auth.refreshSession',
      'auth.registerPasskey',
      'auth.resend',
      'auth.resetPasswordForEmail',
      'auth.setSession',
      'auth.signInAnonymously',
      'auth.signInWithIdToken',
      'auth.signInWithOAuth',
      'auth.signInWithOtp',
      'auth.signInWithPasskey',
      'auth.signInWithPassword',
      'auth.signInWithSSO',
      'auth.signInWithWeb3',
      'auth.signOut',
      'auth.signUp',
      'auth.startAutoRefresh',
      'auth.stopAutoRefresh',
      'auth.unlinkIdentity',
      'auth.updateUser',
      'auth.verifyOtp',
      'channel',
      'from',
      'functions.invoke',
      'functions.setAuth',
      'getChannels',
      'realtime.channel',
      'realtime.connect',
      'realtime.connectionState',
      'realtime.disconnect',
      'realtime.endpointURL',
      'realtime.getChannels',
      'realtime.isConnected',
      'realtime.isConnecting',
      'realtime.isDisconnecting',
      'realtime.log',
      'realtime.onHeartbeat',
      'realtime.push',
      'realtime.removeAllChannels',
      'realtime.removeChannel',
      'realtime.sendHeartbeat',
      'realtime.setAuth',
      'removeAllChannels',
      'removeChannel',
      'rpc',
      'schema',
      'storage.analytics.createBucket',
      'storage.analytics.deleteBucket',
      'storage.analytics.from',
      'storage.analytics.listBuckets',
      'storage.createBucket',
      'storage.deleteBucket',
      'storage.emptyBucket',
      'storage.from',
      'storage.getBucket',
      'storage.listBuckets',
      'storage.purgeBucketCache',
      'storage.updateBucket',
      'storage.vectors.createBucket',
      'storage.vectors.deleteBucket',
      'storage.vectors.from',
      'storage.vectors.getBucket',
      'storage.vectors.listBuckets',
    ],
  },
  rules: [
    {
      key: 'supabase-scope-queries-by-tenant-column',
      resultRule: 'supabase/correctness/scope-queries-by-tenant-column',
      message: 'Query selects a tenant column but never filters by it.',
      fix: 'Add .eq("<column>", value) (or .match()/.filter()) to scope results to the caller. If RLS scopes this table the filter is still worth adding — defense-in-depth, and it avoids overfetching.',
      docsUrl: 'https://supabase.com/docs/reference/javascript/eq',
      severity: 'warning',
    },
    {
      key: 'supabase-validate-uuid-columns',
      resultRule: 'supabase/correctness/validate-uuid-columns',
      message: 'Value passed to a uuid-typed column is only checked with typeof === "string".',
      fix: 'Validate UUID shape with a regex (e.g. /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i) before insert/upsert.',
      docsUrl: 'https://supabase.com/docs/guides/database/tables#data-types',
      severity: 'info',
    },
    {
      key: 'supabase-order-by-timestamp-not-identity',
      resultRule: 'supabase/correctness/order-by-timestamp-not-identity',
      message: 'Query orders by "id" instead of a selected timestamp column.',
      fix: 'Order by the timestamp column (e.g. .order("created_at", { ascending: false })) instead of the surrogate key.',
      docsUrl: 'https://supabase.com/docs/reference/javascript/order',
      severity: 'info',
    },
    {
      key: 'supabase-consistent-input-length-limits',
      resultRule: 'supabase/correctness/consistent-input-length-limits',
      message: 'A sibling string field in this insert has no length cap, unlike the others.',
      fix: 'Apply the same length cap pattern used for the other fields, e.g. field.length > 2000.',
      docsUrl: 'https://supabase.com/docs/guides/database/tables',
      severity: 'warning',
    },
    {
      key: 'supabase-idempotent-mutations',
      resultRule: 'supabase/reliability/idempotent-mutations',
      message: 'Insert payload has no unique/idempotency key field, so a retried request can create a duplicate row.',
      fix: 'Include a client-generated unique key (e.g. an id or *_key field backed by a unique constraint), or use .upsert(..., { onConflict: "<key column>" }).',
      docsUrl: 'https://supabase.com/docs/reference/javascript/upsert',
      severity: 'info',
    },
    {
      key: 'supabase-fail-fast-env-validation',
      resultRule: 'supabase/reliability/fail-fast-env-validation',
      message: 'createClient is called with env vars that have no presence check.',
      fix: 'Throw an error naming the env var (e.g. if (!url || !key) throw new Error("SUPABASE_URL/KEY must be set")) before creating the client — the SDK\'s own error ("supabaseKey is required.") does not say which variable to fix.',
      docsUrl: 'https://supabase.com/docs/reference/javascript/initializing',
      severity: 'info',
    },
    {
      key: 'supabase-no-user-metadata-authz',
      resultRule: 'supabase/security/no-user-metadata-authz',
      message: 'Authorization data is read from or written to user_metadata, which clients can modify.',
      fix: 'Store roles in app_metadata via a trusted server path, or in an RLS-protected profiles table — never user_metadata.',
      docsUrl: 'https://supabase.com/docs/guides/auth/users',
      severity: 'error',
    },
    {
      key: 'supabase-single-without-error-check',
      resultRule: 'supabase/correctness/single-without-error-check',
      message: 'A .single() query ignores the returned error field.',
      fix: 'Destructure and check error, or use .maybeSingle() and handle a missing row explicitly.',
      docsUrl: 'https://supabase.com/docs/reference/javascript/single',
      severity: 'warning',
    },
    {
      key: 'supabase-non-atomic-replace-pattern',
      resultRule: 'supabase/correctness/non-atomic-replace-pattern',
      message: 'Child rows are replaced via delete-then-insert without checking errors.',
      fix: 'Wrap delete+insert in a Postgres RPC (single transaction) and surface error from each step.',
      docsUrl: 'https://supabase.com/docs/guides/database/functions',
      severity: 'warning',
    },
    {
      key: 'supabase-unchecked-mutation-error',
      resultRule: 'supabase/correctness/unchecked-mutation-error',
      message: 'A Supabase insert/update/delete never checks the returned error field.',
      fix: 'Destructure { error } from every mutation and revert optimistic UI or show a toast on failure.',
      docsUrl: 'https://supabase.com/docs/reference/javascript/insert',
      severity: 'warning',
    },
    {
      key: 'supabase-realtime-missing-filter',
      resultRule: 'supabase/reliability/realtime-missing-filter',
      message:
        'postgres_changes subscription has no filter — every row change on the table will notify this client (often intentional for admin/global views; prefer a filter for per-user feeds).',
      fix:
        'If this should be scoped to one user/row, add filter: `receiver_id=eq.${user.id}`. Leave unfiltered only for deliberate whole-table listens.',
      docsUrl: 'https://supabase.com/docs/guides/realtime/postgres-changes#filtering',
      severity: 'warning',
    },
    {
      key: 'supabase-storage-error-not-surfaced',
      resultRule: 'supabase/reliability/storage-error-not-surfaced',
      message: 'A storage upload failure is ignored and execution continues.',
      fix: 'On uploadError, stop and show an error instead of saving a stale URL.',
      docsUrl: 'https://supabase.com/docs/reference/javascript/storage-from-upload',
      severity: 'warning',
    },
    {
      key: 'supabase-removed-method',
      resultRule: 'supabase/removed-method',
      message:
        'Code calls a @supabase/supabase-js auth or realtime method that does not exist in the installed SDK version.',
      fix: 'Move the call to its v2 equivalent — auth.user() → auth.getUser(), auth.session() → auth.getSession() (both now async and wrapped in { data, error }), auth.update() → auth.updateUser(), auth.verifyOTP() → auth.verifyOtp(), removeSubscription/getSubscriptions → removeChannel/getChannels. auth.signIn() has no single successor: read the per-finding Verify line, which names the branch each argument shape maps to.',
      docsUrl: 'https://supabase.com/docs/reference/javascript/v1/upgrade-guide',
      severity: 'error',
      // The finding must name the installed version ("you have 2.112.3
      // installed") — that fact only exists at lint time.
      dynamicMessage: true,
    },
  ],
  compatibility: supabaseCompatibility,
};
