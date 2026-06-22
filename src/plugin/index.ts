/**
 * Oxlint JS plugin entrypoint. Rules are AST-based; no string matching.
 */
import { PLUGIN_NAME } from '../constants.js';
import { resendWebhookSignatureRule } from '../providers/resend/rules/webhook-signature.js';
import { resendApiKeyHardcodedRule } from '../providers/resend/rules/api-key-hardcoded.js';
import { resendApiKeyInClientBundleRule } from '../providers/resend/rules/api-key-in-client-bundle.js';
import { resendMarketingViaBatchSendRule } from '../providers/resend/rules/marketing-via-batch-send.js';
import { resendMarketingMissingUnsubscribeRule } from '../providers/resend/rules/marketing-missing-unsubscribe.js';
import { resendTestDomainInProductionPathRule } from '../providers/resend/rules/test-domain-in-production-path.js';
import { resendFromAddressNotFriendlyFormatRule } from '../providers/resend/rules/from-address-not-friendly-format.js';
import { resendBatchSizeNotEnforcedRule } from '../providers/resend/rules/batch-size-not-enforced.js';
import { resendMissingIdempotencyKeyRule } from '../providers/resend/rules/missing-idempotency-key.js';
import { resendNoErrorCodeMappingRule } from '../providers/resend/rules/no-error-code-mapping.js';
import { resendWebhookNoIdempotencyRule } from '../providers/resend/rules/webhook-no-idempotency.js';
import { resendMissingTagsRule } from '../providers/resend/rules/missing-tags.js';
import { resendRequestIdNotLoggedRule } from '../providers/resend/rules/request-id-not-logged.js';
import { supabaseScopeQueriesByTenantColumnRule } from '../providers/supabase/rules/scope-queries-by-tenant-column.js';
import { supabaseValidateUuidColumnsRule } from '../providers/supabase/rules/validate-uuid-columns.js';
import { supabaseOrderByTimestampNotIdentityRule } from '../providers/supabase/rules/order-by-timestamp-not-identity.js';
import { supabaseConsistentInputLengthLimitsRule } from '../providers/supabase/rules/consistent-input-length-limits.js';
import { supabaseIdempotentMutationsRule } from '../providers/supabase/rules/idempotent-mutations.js';
import { supabaseFailFastEnvValidationRule } from '../providers/supabase/rules/fail-fast-env-validation.js';
import { supabaseNoUserMetadataAuthzRule } from '../providers/supabase/rules/no-user-metadata-authz.js';
import { supabaseSingleWithoutErrorCheckRule } from '../providers/supabase/rules/single-without-error-check.js';
import { supabaseNonAtomicReplacePatternRule } from '../providers/supabase/rules/non-atomic-replace-pattern.js';
import { supabaseUncheckedMutationErrorRule } from '../providers/supabase/rules/unchecked-mutation-error.js';
import { supabaseRealtimeMissingFilterRule } from '../providers/supabase/rules/realtime-missing-filter.js';
import { supabaseStorageErrorNotSurfacedRule } from '../providers/supabase/rules/storage-error-not-surfaced.js';

const plugin = {
  meta: { name: PLUGIN_NAME, version: '0.0.1' },
  rules: {
    'resend-webhook-signature': resendWebhookSignatureRule,
    'resend-api-key-hardcoded': resendApiKeyHardcodedRule,
    'resend-api-key-in-client-bundle': resendApiKeyInClientBundleRule,
    'resend-marketing-via-batch-send': resendMarketingViaBatchSendRule,
    'resend-marketing-missing-unsubscribe': resendMarketingMissingUnsubscribeRule,
    'resend-test-domain-in-production-path': resendTestDomainInProductionPathRule,
    'resend-from-address-not-friendly-format': resendFromAddressNotFriendlyFormatRule,
    'resend-batch-size-not-enforced': resendBatchSizeNotEnforcedRule,
    'resend-missing-idempotency-key': resendMissingIdempotencyKeyRule,
    'resend-no-error-code-mapping': resendNoErrorCodeMappingRule,
    'resend-webhook-no-idempotency': resendWebhookNoIdempotencyRule,
    'resend-missing-tags': resendMissingTagsRule,
    'resend-request-id-not-logged': resendRequestIdNotLoggedRule,
    'supabase-scope-queries-by-tenant-column': supabaseScopeQueriesByTenantColumnRule,
    'supabase-validate-uuid-columns': supabaseValidateUuidColumnsRule,
    'supabase-order-by-timestamp-not-identity': supabaseOrderByTimestampNotIdentityRule,
    'supabase-consistent-input-length-limits': supabaseConsistentInputLengthLimitsRule,
    'supabase-idempotent-mutations': supabaseIdempotentMutationsRule,
    'supabase-fail-fast-env-validation': supabaseFailFastEnvValidationRule,
    'supabase-no-user-metadata-authz': supabaseNoUserMetadataAuthzRule,
    'supabase-single-without-error-check': supabaseSingleWithoutErrorCheckRule,
    'supabase-non-atomic-replace-pattern': supabaseNonAtomicReplacePatternRule,
    'supabase-unchecked-mutation-error': supabaseUncheckedMutationErrorRule,
    'supabase-realtime-missing-filter': supabaseRealtimeMissingFilterRule,
    'supabase-storage-error-not-surfaced': supabaseStorageErrorNotSurfacedRule,
  },
} as const;

export { plugin };
export default plugin;
