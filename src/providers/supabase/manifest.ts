import type { ProviderManifest } from '../../types.js';

export const supabaseManifest: ProviderManifest = {
  name: 'supabase',
  displayName: 'Supabase',
  detect: {
    packages: ['@supabase/supabase-js'],
    imports: ['@supabase/supabase-js'],
    urlPatterns: ['supabase.co'],
  },
  oxlintRules: [
    {
      key: 'supabase-scope-queries-by-tenant-column',
      resultRule: 'supabase/correctness/scope-queries-by-tenant-column',
      message: 'Query selects a tenant column but never filters by it.',
      fix: 'Add .eq("<column>", value) (or .match()/.filter()) to scope results to the caller.',
      docsUrl: 'https://supabase.com/docs/reference/javascript/eq',
      severity: 'error',
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
      message: 'Insert has no idempotency/dedupe key, so a retry can create a duplicate row.',
      fix: 'Add a client-generated idempotency key field backed by a unique constraint, or use .upsert(..., { onConflict: "<key column>" }).',
      docsUrl: 'https://supabase.com/docs/reference/javascript/upsert',
      severity: 'warning',
    },
    {
      key: 'supabase-fail-fast-env-validation',
      resultRule: 'supabase/reliability/fail-fast-env-validation',
      message: 'createClient is called with env vars that have no presence check.',
      fix: 'Throw a clear error (e.g. if (!url || !key) throw new Error(...)) before calling createClient.',
      docsUrl: 'https://supabase.com/docs/reference/javascript/initializing',
      severity: 'warning',
    },
  ],
};
