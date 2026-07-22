import { createClient } from '@supabase/supabase-js';

// Adversarial: this calls createClient with no apparent presence check,
// which could look like the same bug at a glance — but neither argument is
// derived from process.env at all (they're plain function parameters, e.g.
// a test helper that wires in fixed credentials), so there's nothing to
// fail-fast validate and this must not be flagged.
export function createTestClient(url: string, key: string) {
  return createClient(url, key);
}
