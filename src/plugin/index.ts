/**
 * Oxlint JS plugin entrypoint. Rules are AST-based; no string matching.
 */
import { PLUGIN_NAME } from '../constants.js';
import { resendWebhookSignatureRule } from './rules/resend/webhook-signature.js';
import { resendApiKeyHardcodedRule } from './rules/resend/api-key-hardcoded.js';
import { resendApiKeyInClientBundleRule } from './rules/resend/api-key-in-client-bundle.js';
import { resendMarketingViaBatchSendRule } from './rules/resend/marketing-via-batch-send.js';
import { resendMarketingMissingUnsubscribeRule } from './rules/resend/marketing-missing-unsubscribe.js';
import { resendTestDomainInProductionPathRule } from './rules/resend/test-domain-in-production-path.js';
import { resendFromAddressNotFriendlyFormatRule } from './rules/resend/from-address-not-friendly-format.js';
import { resendBatchSizeNotEnforcedRule } from './rules/resend/batch-size-not-enforced.js';
import { resendMissingIdempotencyKeyRule } from './rules/resend/missing-idempotency-key.js';
import { resendNoErrorCodeMappingRule } from './rules/resend/no-error-code-mapping.js';
import { resendWebhookNoIdempotencyRule } from './rules/resend/webhook-no-idempotency.js';
import { resendMissingTagsRule } from './rules/resend/missing-tags.js';
import { resendRequestIdNotLoggedRule } from './rules/resend/request-id-not-logged.js';

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
  },
} as const;

export { plugin };
export default plugin;
