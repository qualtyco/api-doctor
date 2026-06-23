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
import { auth0RequiredAudienceValidationRule } from '../providers/auth0/rules/required-audience-validation.js';
import { auth0NoAccountLinkWithoutVerifiedEmailRule } from '../providers/auth0/rules/no-account-link-without-verified-email.js';
import { auth0DeadClaimVerificationCheckRule } from '../providers/auth0/rules/dead-claim-verification-check.js';
import { auth0JwksRefreshOnUnknownKidRule } from '../providers/auth0/rules/jwks-refresh-on-unknown-kid.js';
import { firebaseMissingAppCheckRule } from '../providers/firebase/rules/missing-app-check.js';
import { firebaseUnhandledAuthPopupRejectionRule } from '../providers/firebase/rules/unhandled-auth-popup-rejection.js';
import { firebaseRtdbListReadForSingleItemRule } from '../providers/firebase/rules/rtdb-list-read-for-single-item.js';
import { firebaseUnvalidatedExternalDataToRtdbRule } from '../providers/firebase/rules/unvalidated-external-data-to-rtdb.js';
import { firebaseRtdbBatchWriteNotAtomicRule } from '../providers/firebase/rules/rtdb-batch-write-not-atomic.js';
import { firebaseRtdbListenerErrorNotHandledRule } from '../providers/firebase/rules/rtdb-listener-error-not-handled.js';
import { firebaseEffectDepsWholeUserObjectRule } from '../providers/firebase/rules/effect-deps-whole-user-object.js';
import { firebaseRtdbWritePromiseNotHandledRule } from '../providers/firebase/rules/rtdb-write-promise-not-handled.js';
import { lovableNoClientSideSecretFetchRule } from '../providers/lovable/rules/no-client-side-secret-fetch.js';
import { lovablePaidFlagWithoutEdgeFunctionRule } from '../providers/lovable/rules/paid-flag-without-edge-function.js';
import { lovableExpiryColumnNeverCheckedRule } from '../providers/lovable/rules/expiry-column-never-checked.js';
import { lovableSilentCatchOnProviderCallRule } from '../providers/lovable/rules/silent-catch-on-provider-call.js';
import { browserbaseNoConditionalAuthzOnAnonymousUserRule } from '../providers/browserbase/rules/no-conditional-authz-on-anonymous-user.js';
import { browserbaseNoConnectUrlInApiResponseRule } from '../providers/browserbase/rules/no-connect-url-in-api-response.js';
import { browserbaseSessionIdRequiresOwnershipCheckRule } from '../providers/browserbase/rules/session-id-requires-ownership-check.js';
import { browserbaseNoConcurrentSharedContextRule } from '../providers/browserbase/rules/no-concurrent-shared-context.js';
import { browserbaseMobileDeviceRequiresOsSettingRule } from '../providers/browserbase/rules/mobile-device-requires-os-setting.js';
import { browserbaseUseTypedExceptionStatusNotSubstringRule } from '../providers/browserbase/rules/use-typed-exception-status-not-substring.js';
import { browserbaseReleaseSessionOnConnectFailureRule } from '../providers/browserbase/rules/release-session-on-connect-failure.js';
import { browserbaseDontStackCustomRetryOnSdkRetryRule } from '../providers/browserbase/rules/dont-stack-custom-retry-on-sdk-retry.js';
import { browserbaseNoOverbroadErrorSubstringMatchRule } from '../providers/browserbase/rules/no-overbroad-error-substring-match.js';
import { browserbaseUseSdkNotRawRequestsRule } from '../providers/browserbase/rules/use-sdk-not-raw-requests.js';
import { browserbaseCentralizeRequestReleaseRule } from '../providers/browserbase/rules/centralize-request-release.js';

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
    'auth0-required-audience-validation': auth0RequiredAudienceValidationRule,
    'auth0-no-account-link-without-verified-email': auth0NoAccountLinkWithoutVerifiedEmailRule,
    'auth0-dead-claim-verification-check': auth0DeadClaimVerificationCheckRule,
    'auth0-jwks-refresh-on-unknown-kid': auth0JwksRefreshOnUnknownKidRule,
    'firebase-missing-app-check': firebaseMissingAppCheckRule,
    'firebase-unhandled-auth-popup-rejection': firebaseUnhandledAuthPopupRejectionRule,
    'firebase-rtdb-list-read-for-single-item': firebaseRtdbListReadForSingleItemRule,
    'firebase-unvalidated-external-data-to-rtdb': firebaseUnvalidatedExternalDataToRtdbRule,
    'firebase-rtdb-batch-write-not-atomic': firebaseRtdbBatchWriteNotAtomicRule,
    'firebase-rtdb-listener-error-not-handled': firebaseRtdbListenerErrorNotHandledRule,
    'firebase-effect-deps-whole-user-object': firebaseEffectDepsWholeUserObjectRule,
    'firebase-rtdb-write-promise-not-handled': firebaseRtdbWritePromiseNotHandledRule,
    'lovable-no-client-side-secret-fetch': lovableNoClientSideSecretFetchRule,
    'lovable-paid-flag-without-edge-function': lovablePaidFlagWithoutEdgeFunctionRule,
    'lovable-expiry-column-never-checked': lovableExpiryColumnNeverCheckedRule,
    'lovable-silent-catch-on-provider-call': lovableSilentCatchOnProviderCallRule,
    'browserbase-no-conditional-authz-on-anonymous-user': browserbaseNoConditionalAuthzOnAnonymousUserRule,
    'browserbase-no-connect-url-in-api-response': browserbaseNoConnectUrlInApiResponseRule,
    'browserbase-session-id-requires-ownership-check': browserbaseSessionIdRequiresOwnershipCheckRule,
    'browserbase-no-concurrent-shared-context': browserbaseNoConcurrentSharedContextRule,
    'browserbase-mobile-device-requires-os-setting': browserbaseMobileDeviceRequiresOsSettingRule,
    'browserbase-use-typed-exception-status-not-substring': browserbaseUseTypedExceptionStatusNotSubstringRule,
    'browserbase-release-session-on-connect-failure': browserbaseReleaseSessionOnConnectFailureRule,
    'browserbase-dont-stack-custom-retry-on-sdk-retry': browserbaseDontStackCustomRetryOnSdkRetryRule,
    'browserbase-no-overbroad-error-substring-match': browserbaseNoOverbroadErrorSubstringMatchRule,
    'browserbase-use-sdk-not-raw-requests': browserbaseUseSdkNotRawRequestsRule,
    'browserbase-centralize-request-release': browserbaseCentralizeRequestReleaseRule,
  },
} as const;

export { plugin };
export default plugin;
