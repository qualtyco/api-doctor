/**
 * Oxlint JS plugin entrypoint. Rules are AST-based; no string matching.
 */
import { PLUGIN_NAME } from '../constants.js';
import { resendWebhookSignatureRule } from '../providers/resend/rules/js/webhook-signature.js';
import { resendApiKeyHardcodedRule } from '../providers/resend/rules/js/api-key-hardcoded.js';
import { resendApiKeyInClientBundleRule } from '../providers/resend/rules/js/api-key-in-client-bundle.js';
import { resendMarketingViaBatchSendRule } from '../providers/resend/rules/js/marketing-via-batch-send.js';
import { resendMarketingMissingUnsubscribeRule } from '../providers/resend/rules/js/marketing-missing-unsubscribe.js';
import { resendTestDomainInProductionPathRule } from '../providers/resend/rules/js/test-domain-in-production-path.js';
import { resendFromAddressNotFriendlyFormatRule } from '../providers/resend/rules/js/from-address-not-friendly-format.js';
import { resendBatchSizeNotEnforcedRule } from '../providers/resend/rules/js/batch-size-not-enforced.js';
import { resendMissingIdempotencyKeyRule } from '../providers/resend/rules/js/missing-idempotency-key.js';
import { resendNoErrorCodeMappingRule } from '../providers/resend/rules/js/no-error-code-mapping.js';
import { resendWebhookNoIdempotencyRule } from '../providers/resend/rules/js/webhook-no-idempotency.js';
import { resendMissingTagsRule } from '../providers/resend/rules/js/missing-tags.js';
import { resendRequestIdNotLoggedRule } from '../providers/resend/rules/js/request-id-not-logged.js';
import { supabaseScopeQueriesByTenantColumnRule } from '../providers/supabase/rules/js/scope-queries-by-tenant-column.js';
import { supabaseValidateUuidColumnsRule } from '../providers/supabase/rules/js/validate-uuid-columns.js';
import { supabaseOrderByTimestampNotIdentityRule } from '../providers/supabase/rules/js/order-by-timestamp-not-identity.js';
import { supabaseConsistentInputLengthLimitsRule } from '../providers/supabase/rules/js/consistent-input-length-limits.js';
import { supabaseIdempotentMutationsRule } from '../providers/supabase/rules/js/idempotent-mutations.js';
import { supabaseFailFastEnvValidationRule } from '../providers/supabase/rules/js/fail-fast-env-validation.js';
import { supabaseNoUserMetadataAuthzRule } from '../providers/supabase/rules/js/no-user-metadata-authz.js';
import { supabaseSingleWithoutErrorCheckRule } from '../providers/supabase/rules/js/single-without-error-check.js';
import { supabaseNonAtomicReplacePatternRule } from '../providers/supabase/rules/js/non-atomic-replace-pattern.js';
import { supabaseUncheckedMutationErrorRule } from '../providers/supabase/rules/js/unchecked-mutation-error.js';
import { supabaseRealtimeMissingFilterRule } from '../providers/supabase/rules/js/realtime-missing-filter.js';
import { supabaseStorageErrorNotSurfacedRule } from '../providers/supabase/rules/js/storage-error-not-surfaced.js';
import { auth0RequiredAudienceValidationRule } from '../providers/auth0/rules/js/required-audience-validation.js';
import { auth0NoAccountLinkWithoutVerifiedEmailRule } from '../providers/auth0/rules/js/no-account-link-without-verified-email.js';
import { auth0DeadClaimVerificationCheckRule } from '../providers/auth0/rules/js/dead-claim-verification-check.js';
import { auth0JwksRefreshOnUnknownKidRule } from '../providers/auth0/rules/js/jwks-refresh-on-unknown-kid.js';
import { firebaseMissingAppCheckRule } from '../providers/firebase/rules/js/missing-app-check.js';
import { firebaseUnhandledAuthPopupRejectionRule } from '../providers/firebase/rules/js/unhandled-auth-popup-rejection.js';
import { firebaseRtdbListReadForSingleItemRule } from '../providers/firebase/rules/js/rtdb-list-read-for-single-item.js';
import { firebaseUnvalidatedExternalDataToRtdbRule } from '../providers/firebase/rules/js/unvalidated-external-data-to-rtdb.js';
import { firebaseRtdbBatchWriteNotAtomicRule } from '../providers/firebase/rules/js/rtdb-batch-write-not-atomic.js';
import { firebaseRtdbListenerErrorNotHandledRule } from '../providers/firebase/rules/js/rtdb-listener-error-not-handled.js';
import { firebaseEffectDepsWholeUserObjectRule } from '../providers/firebase/rules/js/effect-deps-whole-user-object.js';
import { firebaseRtdbWritePromiseNotHandledRule } from '../providers/firebase/rules/js/rtdb-write-promise-not-handled.js';
import { firebaseFirestoreRulesExpiredRule } from '../providers/firebase/rules/js/firestore-rules-expired.js';
import { firebaseIdTokenCookieFlagsRule } from '../providers/firebase/rules/js/id-token-cookie-flags.js';
import { firebaseHardcodedUserIdRule } from '../providers/firebase/rules/js/hardcoded-user-id.js';
import { firebaseAuthUserNotFoundDisclosureRule } from '../providers/firebase/rules/js/auth-user-not-found-disclosure.js';
import { firebaseSignupPasswordConfirmRule } from '../providers/firebase/rules/js/signup-password-confirm.js';
import { firebaseUseArrayUnionRemoveRule } from '../providers/firebase/rules/js/use-array-union-remove.js';
import { firebaseDuplicateInitializeAppRule } from '../providers/firebase/rules/js/duplicate-initialize-app.js';
import { firebaseOnSnapshotAsyncThrowRule } from '../providers/firebase/rules/js/onSnapshot-async-throw.js';
import { firebaseOnSnapshotMissingErrorCallbackRule } from '../providers/firebase/rules/js/onSnapshot-missing-error-callback.js';
import { firebaseFirestoreDocumentSizeGuardRule } from '../providers/firebase/rules/js/firestore-document-size-guard.js';
import { firebaseUseTimestampNowRule } from '../providers/firebase/rules/js/use-timestamp-now.js';

import { lovableNoClientSideSecretFetchRule } from '../providers/lovable/rules/js/no-client-side-secret-fetch.js';
import { lovablePaidFlagWithoutEdgeFunctionRule } from '../providers/lovable/rules/js/paid-flag-without-edge-function.js';
import { lovableExpiryColumnNeverCheckedRule } from '../providers/lovable/rules/js/expiry-column-never-checked.js';
import { lovableSilentCatchOnProviderCallRule } from '../providers/lovable/rules/js/silent-catch-on-provider-call.js';
import { browserbaseNoConditionalAuthzOnAnonymousUserRule } from '../providers/browserbase/rules/js/no-conditional-authz-on-anonymous-user.js';
import { browserbaseNoConnectUrlInApiResponseRule } from '../providers/browserbase/rules/js/no-connect-url-in-api-response.js';
import { browserbaseSessionIdRequiresOwnershipCheckRule } from '../providers/browserbase/rules/js/session-id-requires-ownership-check.js';
import { browserbaseNoConcurrentSharedContextRule } from '../providers/browserbase/rules/js/no-concurrent-shared-context.js';
import { browserbaseMobileDeviceRequiresOsSettingRule } from '../providers/browserbase/rules/js/mobile-device-requires-os-setting.js';
import { browserbaseUseTypedExceptionStatusNotSubstringRule } from '../providers/browserbase/rules/js/use-typed-exception-status-not-substring.js';
import { browserbaseReleaseSessionOnConnectFailureRule } from '../providers/browserbase/rules/js/release-session-on-connect-failure.js';
import { browserbaseDontStackCustomRetryOnSdkRetryRule } from '../providers/browserbase/rules/js/dont-stack-custom-retry-on-sdk-retry.js';
import { browserbaseNoOverbroadErrorSubstringMatchRule } from '../providers/browserbase/rules/js/no-overbroad-error-substring-match.js';
import { browserbaseUseSdkNotRawRequestsRule } from '../providers/browserbase/rules/js/use-sdk-not-raw-requests.js';
import { browserbaseCentralizeRequestReleaseRule } from '../providers/browserbase/rules/js/centralize-request-release.js';
import { openaiCuaNoDomainAllowlistRule } from '../providers/openai-cua/rules/js/no-domain-allowlist.js';
import { openaiCuaScrollDeltaDefaultZeroRule } from '../providers/openai-cua/rules/js/scroll-delta-default-zero.js';
import { openaiCuaStructuredStepMetadataNotTextJsonRule } from '../providers/openai-cua/rules/js/structured-step-metadata-not-text-json.js';
import { openaiCuaNoBlindSafetyCheckAckRule } from '../providers/openai-cua/rules/js/no-blind-safety-check-ack.js';
import { openaiCuaRetryTransientTurnErrorsRule } from '../providers/openai-cua/rules/js/retry-transient-turn-errors.js';
import { openaiCuaCheckResponseStatusIncompleteRule } from '../providers/openai-cua/rules/js/check-response-status-incomplete.js';
import { openaiCuaSetSafetyIdentifierRule } from '../providers/openai-cua/rules/js/set-safety-identifier.js';
import { tiptapUploadValidateFnVoidRule } from '../providers/tiptap/rules/js/upload-validate-fn-void.js';
import { tiptapScriptSrcHardcodedApiKeyRule } from '../providers/tiptap/rules/js/script-src-hardcoded-api-key.js';
import { tiptapDynamicScriptNoSriRule } from '../providers/tiptap/rules/js/dynamic-script-no-sri.js';
import { tiptapAddAttributesMissingRenderHTMLRule } from '../providers/tiptap/rules/js/addAttributes-missing-renderHTML.js';
import { tiptapAppendTransactionAddToHistoryRule } from '../providers/tiptap/rules/js/appendTransaction-add-to-history.js';
import { tiptapAppendTransactionFullScanRule } from '../providers/tiptap/rules/js/appendTransaction-full-scan.js';
import { tiptapAtomNodeWrapInRule } from '../providers/tiptap/rules/js/atom-node-wrap-in.js';
import { tiptapDropHandlerPosPrecedenceRule } from '../providers/tiptap/rules/js/drop-handler-pos-precedence.js';
import { tiptapPreferTableKitRule } from '../providers/tiptap/rules/js/prefer-table-kit.js';
import { tiptapTiptapMarkdownMissingNodeSpecRule } from '../providers/tiptap/rules/js/tiptap-markdown-missing-node-spec.js';
import { elevenlabsValidateSignedUrlResponseRule } from '../providers/elevenlabs/rules/js/validate-signed-url-response.js';
import { elevenlabsNoErrorObjectLoggingRule } from '../providers/elevenlabs/rules/js/no-error-object-logging.js';
import { elevenlabsFetchTimeoutRequiredRule } from '../providers/elevenlabs/rules/js/fetch-timeout-required.js';
import { elevenlabsValidateAgentIdFormatRule } from '../providers/elevenlabs/rules/js/validate-agent-id-format.js';
import { elevenlabsSecureSessionIdGenerationRule } from '../providers/elevenlabs/rules/js/secure-session-id-generation.js';
import { elevenlabsConversationErrorRecoveryRule } from '../providers/elevenlabs/rules/js/conversation-error-recovery.js';
import { elevenlabsApiVersionPinningRule } from '../providers/elevenlabs/rules/js/api-version-pinning.js';
import { elevenlabsCheckHttpStatusBeforeJsonRule } from '../providers/elevenlabs/rules/js/check-http-status-before-json.js';
import { elevenlabsConversationCleanupOnErrorRule } from '../providers/elevenlabs/rules/js/conversation-cleanup-on-error.js';
import { elevenlabsEnvVarValidationRule } from '../providers/elevenlabs/rules/js/env-var-validation.js';
import { twilioValidateWebhookSignatureRule } from '../providers/twilio/rules/js/validate-webhook-signature.js';
import { twilioTaskrouterAttributesMatchConsumerRule } from '../providers/twilio/rules/js/taskrouter-attributes-match-consumer.js';
import { twilioEnqueueTaskJsonStringifyRule } from '../providers/twilio/rules/js/enqueue-task-json-stringify.js';
import { twilioMediaStreamsKeyByCallSidRule } from '../providers/twilio/rules/js/media-streams-key-by-call-sid.js';
import { twilioAwaitOrCatchRestCallsInEventHandlersRule } from '../providers/twilio/rules/js/await-or-catch-rest-calls-in-event-handlers.js';
import { twilioUseTwimlBuilderNotStringTemplatesRule } from '../providers/twilio/rules/js/use-twiml-builder-not-string-templates.js';
import { twilioMediaStreamsMarkPacingRule } from '../providers/twilio/rules/js/media-streams-mark-pacing.js';
import { twilioValidateAllRequestInputsRule } from '../providers/twilio/rules/js/validate-all-request-inputs.js';
import { twilioMediaStreamsMarkNameStringRule } from '../providers/twilio/rules/js/media-streams-mark-name-string.js';
import { openaiRealtimeMigrateBetaToGaRule } from '../providers/openai-realtime/rules/js/migrate-beta-to-ga.js';
import { openaiRealtimeNoLogRawMessagePayloadsRule } from '../providers/openai-realtime/rules/js/no-log-raw-message-payloads.js';
import { openaiRealtimeHandleErrorServerEventRule } from '../providers/openai-realtime/rules/js/handle-error-server-event.js';
import { openaiRealtimeReconnectOnDropRule } from '../providers/openai-realtime/rules/js/reconnect-on-drop.js';
import { openaiRealtimeAvoidDatedPreviewSnapshotsRule } from '../providers/openai-realtime/rules/js/avoid-dated-preview-snapshots.js';
import { openaiRealtimeVerifyDeprecatedSessionFieldsRule } from '../providers/openai-realtime/rules/js/verify-deprecated-session-fields.js';
import { openaiRealtimeBufferAudioUntilSessionReadyRule } from '../providers/openai-realtime/rules/js/buffer-audio-until-session-ready.js';
import { openaiRealtimeSendSafetyIdentifierRule } from '../providers/openai-realtime/rules/js/send-safety-identifier.js';
import { openaiRealtimeTranscriptionModelChoiceRule } from '../providers/openai-realtime/rules/js/transcription-model-choice.js';
import { s2ScopedTokenForClientRule } from '../providers/s2/rules/js/scoped-token-for-client.js';
import { s2AppendRetryDuplicatesRule } from '../providers/s2/rules/js/append-retry-duplicates.js';
import { s2NoHardcodedAccessTokenRule } from '../providers/s2/rules/js/no-hardcoded-access-token.js';
import { s2AppendBatchLimitRule } from '../providers/s2/rules/js/append-batch-limit.js';
import { s2AppendSessionForStreamsRule } from '../providers/s2/rules/js/append-session-for-streams.js';
import { s2TokenExpiryAndLeastPrivilegeRule } from '../providers/s2/rules/js/token-expiry-and-least-privilege.js';
import { s2AwaitAppendDurabilityRule } from '../providers/s2/rules/js/await-append-durability.js';
import { s2NoManualAppendRetryLoopRule } from '../providers/s2/rules/js/no-manual-append-retry-loop.js';
import { s2TailIsEndNotLastRecordRule } from '../providers/s2/rules/js/tail-is-end-not-last-record.js';
import { s2SingleReadIsCappedRule } from '../providers/s2/rules/js/single-read-is-capped.js';
import { s2ReadSessionTerminatesRule } from '../providers/s2/rules/js/read-session-terminates.js';
import { s2TailOffsetClampRule } from '../providers/s2/rules/js/tail-offset-clamp.js';
import { s2IdempotentResourceCreateRule } from '../providers/s2/rules/js/idempotent-resource-create.js';
import { s2CloseStreamClientRule } from '../providers/s2/rules/js/close-stream-client.js';
import { s2UseS2EnvironmentEndpointsRule } from '../providers/s2/rules/js/use-s2-environment-endpoints.js';
import { s2MetricsDateArgumentsRule } from '../providers/s2/rules/js/metrics-date-arguments.js';
import { s2TokenSecretHandlingRule } from '../providers/s2/rules/js/token-secret-handling.js';
import { agentmailVerifyApprovalReplySenderRule } from '../providers/agentmail/rules/js/verify-approval-reply-sender.js';
import { agentmailInboxCreateClientIdRule } from '../providers/agentmail/rules/js/inbox-create-client-id.js';
import { agentmailHandleSendFailureStatusRule } from '../providers/agentmail/rules/js/handle-send-failure-status.js';
import { agentmailCheckUnauthenticatedLabelRule } from '../providers/agentmail/rules/js/check-unauthenticated-label.js';
import { agentmailConfigureRecipientGuardrailsRule } from '../providers/agentmail/rules/js/configure-recipient-guardrails.js';
import { agentmailDraftCreateClientIdRule } from '../providers/agentmail/rules/js/draft-create-client-id.js';
import { agentmailHtmlFallbackForInboundBodyRule } from '../providers/agentmail/rules/js/html-fallback-for-inbound-body.js';
import { agentmailThrottleBulkSendsRule } from '../providers/agentmail/rules/js/throttle-bulk-sends.js';
import { agentmailLabelFailedMessagesRule } from '../providers/agentmail/rules/js/label-failed-messages.js';
import { agentmailCustomDomainForOutreachRule } from '../providers/agentmail/rules/js/custom-domain-for-outreach.js';
import { agentmailNoMessageIdAsThreadIdRule } from '../providers/agentmail/rules/js/no-message-id-as-thread-id.js';
import { agentmailPreferWebhooksInProductionRule } from '../providers/agentmail/rules/js/prefer-webhooks-in-production.js';
import { agentmailHtmlRequiresTextRule } from '../providers/agentmail/rules/js/html-requires-text.js';
import { agentmailAttachmentSizeGuardRule } from '../providers/agentmail/rules/js/attachment-size-guard.js';

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
    'firebase-firestore-rules-expired': firebaseFirestoreRulesExpiredRule,
    'firebase-id-token-cookie-flags': firebaseIdTokenCookieFlagsRule,
    'firebase-hardcoded-user-id': firebaseHardcodedUserIdRule,
    'firebase-auth-user-not-found-disclosure': firebaseAuthUserNotFoundDisclosureRule,
    'firebase-signup-password-confirm': firebaseSignupPasswordConfirmRule,
    'firebase-use-array-union-remove': firebaseUseArrayUnionRemoveRule,
    'firebase-duplicate-initialize-app': firebaseDuplicateInitializeAppRule,
    'firebase-onSnapshot-async-throw': firebaseOnSnapshotAsyncThrowRule,
    'firebase-onSnapshot-missing-error-callback': firebaseOnSnapshotMissingErrorCallbackRule,
    'firebase-firestore-document-size-guard': firebaseFirestoreDocumentSizeGuardRule,
    'firebase-use-timestamp-now': firebaseUseTimestampNowRule,

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

    'openai-cua-no-domain-allowlist': openaiCuaNoDomainAllowlistRule,
    'openai-cua-scroll-delta-default-zero': openaiCuaScrollDeltaDefaultZeroRule,
    'openai-cua-structured-step-metadata-not-text-json': openaiCuaStructuredStepMetadataNotTextJsonRule,
    'openai-cua-no-blind-safety-check-ack': openaiCuaNoBlindSafetyCheckAckRule,
    'openai-cua-retry-transient-turn-errors': openaiCuaRetryTransientTurnErrorsRule,
    'openai-cua-check-response-status-incomplete': openaiCuaCheckResponseStatusIncompleteRule,
    'openai-cua-set-safety-identifier': openaiCuaSetSafetyIdentifierRule,

    'tiptap-upload-validate-fn-void': tiptapUploadValidateFnVoidRule,
    'tiptap-script-src-hardcoded-api-key': tiptapScriptSrcHardcodedApiKeyRule,
    'tiptap-dynamic-script-no-sri': tiptapDynamicScriptNoSriRule,
    'tiptap-addAttributes-missing-renderHTML': tiptapAddAttributesMissingRenderHTMLRule,
    'tiptap-appendTransaction-add-to-history': tiptapAppendTransactionAddToHistoryRule,
    'tiptap-appendTransaction-full-scan': tiptapAppendTransactionFullScanRule,
    'tiptap-atom-node-wrap-in': tiptapAtomNodeWrapInRule,
    'tiptap-drop-handler-pos-precedence': tiptapDropHandlerPosPrecedenceRule,
    'tiptap-prefer-table-kit': tiptapPreferTableKitRule,
    'tiptap-tiptap-markdown-missing-node-spec': tiptapTiptapMarkdownMissingNodeSpecRule,

    'elevenlabs-validate-signed-url-response': elevenlabsValidateSignedUrlResponseRule,
    'elevenlabs-no-error-object-logging': elevenlabsNoErrorObjectLoggingRule,
    'elevenlabs-fetch-timeout-required': elevenlabsFetchTimeoutRequiredRule,
    'elevenlabs-validate-agent-id-format': elevenlabsValidateAgentIdFormatRule,
    'elevenlabs-secure-session-id-generation': elevenlabsSecureSessionIdGenerationRule,
    'elevenlabs-conversation-error-recovery': elevenlabsConversationErrorRecoveryRule,
    'elevenlabs-api-version-pinning': elevenlabsApiVersionPinningRule,
    'elevenlabs-check-http-status-before-json': elevenlabsCheckHttpStatusBeforeJsonRule,
    'elevenlabs-conversation-cleanup-on-error': elevenlabsConversationCleanupOnErrorRule,
    'elevenlabs-env-var-validation': elevenlabsEnvVarValidationRule,

    'twilio-validate-webhook-signature': twilioValidateWebhookSignatureRule,
    'twilio-taskrouter-attributes-match-consumer': twilioTaskrouterAttributesMatchConsumerRule,
    'twilio-enqueue-task-json-stringify': twilioEnqueueTaskJsonStringifyRule,
    'twilio-media-streams-key-by-call-sid': twilioMediaStreamsKeyByCallSidRule,
    'twilio-await-or-catch-rest-calls-in-event-handlers': twilioAwaitOrCatchRestCallsInEventHandlersRule,
    'twilio-use-twiml-builder-not-string-templates': twilioUseTwimlBuilderNotStringTemplatesRule,
    'twilio-media-streams-mark-pacing': twilioMediaStreamsMarkPacingRule,
    'twilio-validate-all-request-inputs': twilioValidateAllRequestInputsRule,
    'twilio-media-streams-mark-name-string': twilioMediaStreamsMarkNameStringRule,

    'openai-realtime-migrate-beta-to-ga': openaiRealtimeMigrateBetaToGaRule,
    'openai-realtime-no-log-raw-message-payloads': openaiRealtimeNoLogRawMessagePayloadsRule,
    'openai-realtime-handle-error-server-event': openaiRealtimeHandleErrorServerEventRule,
    'openai-realtime-reconnect-on-drop': openaiRealtimeReconnectOnDropRule,
    'openai-realtime-avoid-dated-preview-snapshots': openaiRealtimeAvoidDatedPreviewSnapshotsRule,
    'openai-realtime-verify-deprecated-session-fields': openaiRealtimeVerifyDeprecatedSessionFieldsRule,
    'openai-realtime-buffer-audio-until-session-ready': openaiRealtimeBufferAudioUntilSessionReadyRule,
    'openai-realtime-send-safety-identifier': openaiRealtimeSendSafetyIdentifierRule,
    'openai-realtime-transcription-model-choice': openaiRealtimeTranscriptionModelChoiceRule,

    's2-scoped-token-for-client': s2ScopedTokenForClientRule,
    's2-append-retry-duplicates': s2AppendRetryDuplicatesRule,
    's2-no-hardcoded-access-token': s2NoHardcodedAccessTokenRule,
    's2-append-batch-limit': s2AppendBatchLimitRule,
    's2-append-session-for-streams': s2AppendSessionForStreamsRule,
    's2-token-expiry-and-least-privilege': s2TokenExpiryAndLeastPrivilegeRule,
    's2-await-append-durability': s2AwaitAppendDurabilityRule,
    's2-no-manual-append-retry-loop': s2NoManualAppendRetryLoopRule,
    's2-tail-is-end-not-last-record': s2TailIsEndNotLastRecordRule,
    's2-single-read-is-capped': s2SingleReadIsCappedRule,
    's2-read-session-terminates': s2ReadSessionTerminatesRule,
    's2-tail-offset-clamp': s2TailOffsetClampRule,
    's2-idempotent-resource-create': s2IdempotentResourceCreateRule,
    's2-close-stream-client': s2CloseStreamClientRule,
    's2-use-s2-environment-endpoints': s2UseS2EnvironmentEndpointsRule,
    's2-metrics-date-arguments': s2MetricsDateArgumentsRule,
    's2-token-secret-handling': s2TokenSecretHandlingRule,

    'agentmail-verify-approval-reply-sender': agentmailVerifyApprovalReplySenderRule,
    'agentmail-inbox-create-client-id': agentmailInboxCreateClientIdRule,
    'agentmail-handle-send-failure-status': agentmailHandleSendFailureStatusRule,
    'agentmail-check-unauthenticated-label': agentmailCheckUnauthenticatedLabelRule,
    'agentmail-configure-recipient-guardrails': agentmailConfigureRecipientGuardrailsRule,
    'agentmail-draft-create-client-id': agentmailDraftCreateClientIdRule,
    'agentmail-html-fallback-for-inbound-body': agentmailHtmlFallbackForInboundBodyRule,
    'agentmail-throttle-bulk-sends': agentmailThrottleBulkSendsRule,
    'agentmail-label-failed-messages': agentmailLabelFailedMessagesRule,
    'agentmail-custom-domain-for-outreach': agentmailCustomDomainForOutreachRule,
    'agentmail-no-message-id-as-thread-id': agentmailNoMessageIdAsThreadIdRule,
    'agentmail-prefer-webhooks-in-production': agentmailPreferWebhooksInProductionRule,
    'agentmail-html-requires-text': agentmailHtmlRequiresTextRule,
    'agentmail-attachment-size-guard': agentmailAttachmentSizeGuardRule,
  },
} as const;

export { plugin };
export default plugin;
