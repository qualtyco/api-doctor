import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { lintPythonFixture } from '../helpers/lint-python-rule.js';

const fixtures = join(dirname(fileURLToPath(import.meta.url)), '../fixtures/supabase');

describe('supabase-fail-fast-env-validation (python)', () => {
  it('flags create_client called with unguarded env vars', () => {
    const diags = lintPythonFixture(join(fixtures, 'supabase-fail-fast-env-validation-broken'), [
      'supabase-fail-fast-env-validation',
    ]);
    expect(diags.filter((d) => d.ruleKey === 'supabase-fail-fast-env-validation').length).toBeGreaterThanOrEqual(2);
  });

  it('allows guarded vars and non-env args', () => {
    const diags = lintPythonFixture(join(fixtures, 'supabase-fail-fast-env-validation-fixed'), [
      'supabase-fail-fast-env-validation',
    ]);
    expect(diags.filter((d) => d.ruleKey === 'supabase-fail-fast-env-validation')).toHaveLength(0);
  });
});

describe('supabase-realtime-missing-filter (python)', () => {
  it('flags on_postgres_changes subscriptions with no filter', () => {
    const diags = lintPythonFixture(join(fixtures, 'supabase-realtime-missing-filter-broken'), [
      'supabase-realtime-missing-filter',
    ]);
    expect(diags.filter((d) => d.ruleKey === 'supabase-realtime-missing-filter').length).toBeGreaterThanOrEqual(3);
  });

  it('allows filtered subscriptions and non-postgres_changes events', () => {
    const diags = lintPythonFixture(join(fixtures, 'supabase-realtime-missing-filter-fixed'), [
      'supabase-realtime-missing-filter',
    ]);
    expect(diags.filter((d) => d.ruleKey === 'supabase-realtime-missing-filter')).toHaveLength(0);
  });
});

describe('supabase-no-user-metadata-authz (python)', () => {
  it('flags user_metadata authz reads and signUp/updateUser authz writes', () => {
    const diags = lintPythonFixture(join(fixtures, 'supabase-no-user-metadata-authz-broken'), [
      'supabase-no-user-metadata-authz',
    ]);
    expect(diags.filter((d) => d.ruleKey === 'supabase-no-user-metadata-authz').length).toBeGreaterThanOrEqual(4);
  });

  it('allows app_metadata reads and non-authz user_metadata keys', () => {
    const diags = lintPythonFixture(join(fixtures, 'supabase-no-user-metadata-authz-fixed'), [
      'supabase-no-user-metadata-authz',
    ]);
    expect(diags.filter((d) => d.ruleKey === 'supabase-no-user-metadata-authz')).toHaveLength(0);
  });
});

describe('supabase-unchecked-mutation-error (python)', () => {
  it('flags mutations swallowed by a no-op except handler', () => {
    const diags = lintPythonFixture(join(fixtures, 'supabase-unchecked-mutation-error-broken'), [
      'supabase-unchecked-mutation-error',
    ]);
    expect(diags.filter((d) => d.ruleKey === 'supabase-unchecked-mutation-error').length).toBeGreaterThanOrEqual(2);
  });

  it('allows unwrapped mutations and except handlers that re-raise/return', () => {
    const diags = lintPythonFixture(join(fixtures, 'supabase-unchecked-mutation-error-fixed'), [
      'supabase-unchecked-mutation-error',
    ]);
    expect(diags.filter((d) => d.ruleKey === 'supabase-unchecked-mutation-error')).toHaveLength(0);
  });
});

describe('supabase-single-without-error-check (python)', () => {
  it('flags .single() calls swallowed by a no-op except handler', () => {
    const diags = lintPythonFixture(join(fixtures, 'supabase-single-without-error-check-broken'), [
      'supabase-single-without-error-check',
    ]);
    expect(diags.filter((d) => d.ruleKey === 'supabase-single-without-error-check').length).toBeGreaterThanOrEqual(2);
  });

  it('allows unwrapped .single() calls and handled/re-raised exceptions', () => {
    const diags = lintPythonFixture(join(fixtures, 'supabase-single-without-error-check-fixed'), [
      'supabase-single-without-error-check',
    ]);
    expect(diags.filter((d) => d.ruleKey === 'supabase-single-without-error-check')).toHaveLength(0);
  });
});

describe('supabase-idempotent-mutations (python)', () => {
  it('flags insert payloads without an idempotency/dedupe key', () => {
    const diags = lintPythonFixture(join(fixtures, 'supabase-idempotent-mutations-broken'), [
      'supabase-idempotent-mutations',
    ]);
    expect(diags.filter((d) => d.ruleKey === 'supabase-idempotent-mutations').length).toBeGreaterThanOrEqual(2);
  });

  it('allows inserts with an id field and upsert with on_conflict', () => {
    const diags = lintPythonFixture(join(fixtures, 'supabase-idempotent-mutations-fixed'), [
      'supabase-idempotent-mutations',
    ]);
    expect(diags.filter((d) => d.ruleKey === 'supabase-idempotent-mutations')).toHaveLength(0);
  });
});

describe('supabase-scope-queries-by-tenant-column (python)', () => {
  it('flags queries that select a tenant column without filtering by it', () => {
    const diags = lintPythonFixture(join(fixtures, 'supabase-scope-queries-by-tenant-column-broken'), [
      'supabase-scope-queries-by-tenant-column',
    ]);
    expect(diags.filter((d) => d.ruleKey === 'supabase-scope-queries-by-tenant-column').length).toBeGreaterThanOrEqual(2);
  });

  it('allows eq/match-filtered queries and select("*")', () => {
    const diags = lintPythonFixture(join(fixtures, 'supabase-scope-queries-by-tenant-column-fixed'), [
      'supabase-scope-queries-by-tenant-column',
    ]);
    expect(diags.filter((d) => d.ruleKey === 'supabase-scope-queries-by-tenant-column')).toHaveLength(0);
  });
});

describe('supabase-validate-uuid-columns (python)', () => {
  it('flags isinstance(x, str)-only checks before insert/upsert into a uuid column', () => {
    const diags = lintPythonFixture(join(fixtures, 'supabase-validate-uuid-columns-broken'), [
      'supabase-validate-uuid-columns',
    ]);
    expect(diags.filter((d) => d.ruleKey === 'supabase-validate-uuid-columns').length).toBeGreaterThanOrEqual(2);
  });

  it('allows uuid.UUID()/regex-validated columns and non-uuid-named fields', () => {
    const diags = lintPythonFixture(join(fixtures, 'supabase-validate-uuid-columns-fixed'), [
      'supabase-validate-uuid-columns',
    ]);
    expect(diags.filter((d) => d.ruleKey === 'supabase-validate-uuid-columns')).toHaveLength(0);
  });
});

describe('supabase-order-by-timestamp-not-identity (python)', () => {
  it('flags order("id") when the query also selects a timestamp column', () => {
    const diags = lintPythonFixture(join(fixtures, 'supabase-order-by-timestamp-not-identity-broken'), [
      'supabase-order-by-timestamp-not-identity',
    ]);
    expect(diags.filter((d) => d.ruleKey === 'supabase-order-by-timestamp-not-identity').length).toBeGreaterThanOrEqual(2);
  });

  it('allows ordering by the timestamp column and queries with no timestamp selected', () => {
    const diags = lintPythonFixture(join(fixtures, 'supabase-order-by-timestamp-not-identity-fixed'), [
      'supabase-order-by-timestamp-not-identity',
    ]);
    expect(diags.filter((d) => d.ruleKey === 'supabase-order-by-timestamp-not-identity')).toHaveLength(0);
  });
});

describe('supabase-consistent-input-length-limits (python)', () => {
  it('flags an uncapped sibling field next to a capped one', () => {
    const diags = lintPythonFixture(join(fixtures, 'supabase-consistent-input-length-limits-broken'), [
      'supabase-consistent-input-length-limits',
    ]);
    expect(diags.filter((d) => d.ruleKey === 'supabase-consistent-input-length-limits').length).toBeGreaterThanOrEqual(2);
  });

  it('allows all-capped and none-capped sibling sets', () => {
    const diags = lintPythonFixture(join(fixtures, 'supabase-consistent-input-length-limits-fixed'), [
      'supabase-consistent-input-length-limits',
    ]);
    expect(diags.filter((d) => d.ruleKey === 'supabase-consistent-input-length-limits')).toHaveLength(0);
  });
});

describe('supabase-non-atomic-replace-pattern (python)', () => {
  it('flags same-table delete+insert where either step is swallowed by a no-op except', () => {
    const diags = lintPythonFixture(join(fixtures, 'supabase-non-atomic-replace-pattern-broken'), [
      'supabase-non-atomic-replace-pattern',
    ]);
    expect(diags.filter((d) => d.ruleKey === 'supabase-non-atomic-replace-pattern').length).toBeGreaterThanOrEqual(2);
  });

  it('allows unwrapped replace sequences and delete-only/insert-only functions', () => {
    const diags = lintPythonFixture(join(fixtures, 'supabase-non-atomic-replace-pattern-fixed'), [
      'supabase-non-atomic-replace-pattern',
    ]);
    expect(diags.filter((d) => d.ruleKey === 'supabase-non-atomic-replace-pattern')).toHaveLength(0);
  });
});

describe('supabase-storage-error-not-surfaced (python)', () => {
  it('flags storage upload failures swallowed by a no-op except handler', () => {
    const diags = lintPythonFixture(join(fixtures, 'supabase-storage-error-not-surfaced-broken'), [
      'supabase-storage-error-not-surfaced',
    ]);
    expect(diags.filter((d) => d.ruleKey === 'supabase-storage-error-not-surfaced').length).toBeGreaterThanOrEqual(2);
  });

  it('allows unwrapped uploads and except handlers that surface the failure', () => {
    const diags = lintPythonFixture(join(fixtures, 'supabase-storage-error-not-surfaced-fixed'), [
      'supabase-storage-error-not-surfaced',
    ]);
    expect(diags.filter((d) => d.ruleKey === 'supabase-storage-error-not-surfaced')).toHaveLength(0);
  });
});
