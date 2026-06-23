declare const plugin: {
    readonly meta: {
        readonly name: "@api-doctor/cli";
        readonly version: "0.0.1";
    };
    readonly rules: {
        readonly 'resend-webhook-signature': {
            meta: {
                type: string;
                docs: {
                    description: string;
                    category: string;
                    cwe: string;
                    owasp: string;
                    rationale: string;
                    docsUrl: string;
                    recommended: boolean;
                };
                messages: {
                    missingVerification: string;
                };
            };
            create(context: any): {
                ImportDeclaration(node: any): void;
                ExportNamedDeclaration(node: any): void;
                CallExpression(node: any): void;
                MemberExpression(node: any): void;
                'Program:exit'(): void;
            };
        };
        readonly 'resend-api-key-hardcoded': {
            meta: {
                type: string;
                docs: {
                    description: string;
                    category: string;
                    cwe: string;
                    owasp: string;
                    rationale: string;
                    docsUrl: string;
                    recommended: boolean;
                };
                messages: {
                    hardcodedApiKey: string;
                };
                schema: never[];
            };
            create(context: any): {
                Literal(node: any): void;
                TemplateElement(node: any): void;
            };
        };
        readonly 'resend-api-key-in-client-bundle': {
            meta: {
                type: string;
                docs: {
                    description: string;
                    category: string;
                    cwe: string;
                    owasp: string;
                    rationale: string;
                    docsUrl: string;
                    recommended: boolean;
                };
                messages: {
                    clientBundleImport: string;
                };
                schema: never[];
            };
            create(context: any): {
                Program(node: any): void;
                ImportDeclaration(node: any): void;
                JSXElement(): void;
                JSXFragment(): void;
                'Program:exit'(): void;
            };
        };
        readonly 'resend-marketing-via-batch-send': {
            meta: {
                type: string;
                docs: {
                    description: string;
                    category: string;
                    rationale: string;
                    docsUrl: string;
                    recommended: boolean;
                };
                messages: {
                    marketingViaBatch: string;
                };
                schema: never[];
            };
            create(context: any): {
                CallExpression(node: any): void;
            };
        };
        readonly 'resend-marketing-missing-unsubscribe': {
            meta: {
                type: string;
                docs: {
                    description: string;
                    category: string;
                    rationale: string;
                    docsUrl: string;
                    recommended: boolean;
                };
                messages: {
                    missingUnsubscribe: string;
                };
                schema: never[];
            };
            create(context: any): {
                CallExpression(node: any): void;
            };
        };
        readonly 'resend-test-domain-in-production-path': {
            meta: {
                type: string;
                docs: {
                    description: string;
                    category: string;
                    rationale: string;
                    docsUrl: string;
                    recommended: boolean;
                };
                messages: {
                    testDomain: string;
                };
                schema: never[];
            };
            create(context: any): {
                Literal?: undefined;
                TemplateElement?: undefined;
            } | {
                Literal(node: any): void;
                TemplateElement(node: any): void;
            };
        };
        readonly 'resend-from-address-not-friendly-format': {
            meta: {
                type: string;
                docs: {
                    description: string;
                    category: string;
                    rationale: string;
                    docsUrl: string;
                    recommended: boolean;
                };
                messages: {
                    bareFromAddress: string;
                };
                schema: never[];
            };
            create(context: any): {
                CallExpression(node: any): void;
            };
        };
        readonly 'resend-batch-size-not-enforced': {
            meta: {
                type: string;
                docs: {
                    description: string;
                    category: string;
                    rationale: string;
                    docsUrl: string;
                    recommended: boolean;
                };
                messages: {
                    batchSizeNotEnforced: string;
                };
                schema: never[];
            };
            create(context: any): {
                FunctionDeclaration(node: any): void;
                FunctionExpression(node: any): void;
                ArrowFunctionExpression(node: any): void;
                ForStatement(node: any): void;
                ForOfStatement(node: any): void;
                ForInStatement(node: any): void;
                WhileStatement(node: any): void;
                DoWhileStatement(node: any): void;
                BinaryExpression(node: any): void;
                CallExpression(node: any): void;
                'Program:exit'(): void;
            };
        };
        readonly 'resend-missing-idempotency-key': {
            meta: {
                type: string;
                docs: {
                    description: string;
                    category: string;
                    rationale: string;
                    docsUrl: string;
                    recommended: boolean;
                };
                messages: {
                    missingIdempotencyKey: string;
                };
                schema: never[];
            };
            create(context: any): {
                CallExpression(node: any): void;
            };
        };
        readonly 'resend-no-error-code-mapping': {
            meta: {
                type: string;
                docs: {
                    description: string;
                    category: string;
                    rationale: string;
                    docsUrl: string;
                    recommended: boolean;
                };
                messages: {
                    noErrorCodeMapping: string;
                };
                schema: never[];
            };
            create(context: any): {
                FunctionDeclaration(node: any): void;
                FunctionExpression(node: any): void;
                ArrowFunctionExpression(node: any): void;
                VariableDeclarator(node: any): void;
                IfStatement(node: any): void;
                CallExpression(node: any): void;
                'Program:exit'(): void;
            };
        };
        readonly 'resend-webhook-no-idempotency': {
            meta: {
                type: string;
                docs: {
                    description: string;
                    category: string;
                    rationale: string;
                    docsUrl: string;
                    recommended: boolean;
                };
                messages: {
                    noIdempotency: string;
                };
                schema: never[];
            };
            create(context: any): {
                ImportDeclaration(node: any): void;
                ExportNamedDeclaration(node: any): void;
                NewExpression(node: any): void;
                CallExpression(node: any): void;
                MemberExpression(node: any): void;
                'Program:exit'(): void;
            };
        };
        readonly 'resend-missing-tags': {
            meta: {
                type: string;
                docs: {
                    description: string;
                    category: string;
                    rationale: string;
                    docsUrl: string;
                    recommended: boolean;
                };
                messages: {
                    missingTags: string;
                };
                schema: never[];
            };
            create(context: any): {
                CallExpression(node: any): void;
            };
        };
        readonly 'resend-request-id-not-logged': {
            meta: {
                type: string;
                docs: {
                    description: string;
                    category: string;
                    rationale: string;
                    docsUrl: string;
                    recommended: boolean;
                };
                messages: {
                    requestIdNotLogged: string;
                };
                schema: never[];
            };
            create(context: any): {
                ImportDeclaration(node: any): void;
                CatchClause(node: any): void;
                IfStatement(node: any): void;
                MemberExpression(node: any): void;
                Literal(node: any): void;
                'Program:exit'(): void;
            };
        };
        readonly 'supabase-scope-queries-by-tenant-column': {
            meta: {
                type: string;
                docs: {
                    description: string;
                    category: string;
                    rationale: string;
                    docsUrl: string;
                    recommended: boolean;
                };
                messages: {
                    missingTenantFilter: string;
                };
                schema: never[];
            };
            create(context: any): {
                'CallExpression:exit'(node: any): void;
                'Program:exit'(): void;
            };
        };
        readonly 'supabase-validate-uuid-columns': {
            meta: {
                type: string;
                docs: {
                    description: string;
                    category: string;
                    rationale: string;
                    docsUrl: string;
                    recommended: boolean;
                };
                messages: {
                    missingUuidValidation: string;
                };
                schema: never[];
            };
            create(context: any): {
                VariableDeclarator(node: any): void;
                BinaryExpression(node: any): void;
                CallExpression(node: any): void;
            };
        };
        readonly 'supabase-order-by-timestamp-not-identity': {
            meta: {
                type: string;
                docs: {
                    description: string;
                    category: string;
                    rationale: string;
                    docsUrl: string;
                    recommended: boolean;
                };
                messages: {
                    orderByIdentity: string;
                };
                schema: never[];
            };
            create(context: any): {
                'CallExpression:exit'(node: any): void;
            };
        };
        readonly 'supabase-consistent-input-length-limits': {
            meta: {
                type: string;
                docs: {
                    description: string;
                    category: string;
                    rationale: string;
                    docsUrl: string;
                    recommended: boolean;
                };
                messages: {
                    inconsistentLengthLimit: string;
                };
                schema: never[];
            };
            create(context: any): {
                BinaryExpression(node: any): void;
                CallExpression(node: any): void;
            };
        };
        readonly 'supabase-idempotent-mutations': {
            meta: {
                type: string;
                docs: {
                    description: string;
                    category: string;
                    rationale: string;
                    docsUrl: string;
                    recommended: boolean;
                };
                messages: {
                    missingIdempotencyKey: string;
                };
                schema: never[];
            };
            create(context: any): {
                CallExpression(node: any): void;
            };
        };
        readonly 'supabase-fail-fast-env-validation': {
            meta: {
                type: string;
                docs: {
                    description: string;
                    category: string;
                    rationale: string;
                    docsUrl: string;
                    recommended: boolean;
                };
                messages: {
                    missingEnvValidation: string;
                };
                schema: never[];
            };
            create(context: any): {
                ImportDeclaration(node: any): void;
                VariableDeclarator(node: any): void;
                IfStatement(node: any): void;
                CallExpression(node: any): void;
            };
        };
        readonly 'supabase-no-user-metadata-authz': {
            meta: {
                type: string;
                docs: {
                    description: string;
                    category: string;
                    cwe: string;
                    owasp: string;
                    rationale: string;
                    docsUrl: string;
                    recommended: boolean;
                };
                messages: {
                    userMetadataAuthzRead: string;
                    userMetadataAuthzWrite: string;
                };
                schema: never[];
            };
            create(context: any): {
                MemberExpression(node: any): void;
                CallExpression(node: any): void;
            };
        };
        readonly 'supabase-single-without-error-check': {
            meta: {
                type: string;
                docs: {
                    description: string;
                    category: string;
                    rationale: string;
                    docsUrl: string;
                    recommended: boolean;
                };
                messages: {
                    missingErrorCheck: string;
                };
                schema: never[];
            };
            create(context: any): {
                VariableDeclarator(node: any): void;
                AssignmentExpression(node: any): void;
                ExpressionStatement(node: any): void;
            };
        };
        readonly 'supabase-non-atomic-replace-pattern': {
            meta: {
                type: string;
                docs: {
                    description: string;
                    category: string;
                    rationale: string;
                    docsUrl: string;
                    recommended: boolean;
                };
                messages: {
                    nonAtomicReplace: string;
                };
                schema: never[];
            };
            create(context: any): {
                FunctionDeclaration(node: any): void;
                'FunctionDeclaration:exit'(node: any): void;
                FunctionExpression(node: any): void;
                'FunctionExpression:exit'(node: any): void;
                ArrowFunctionExpression(node: any): void;
                'ArrowFunctionExpression:exit'(node: any): void;
                VariableDeclarator(node: any): void;
                ExpressionStatement(node: any): void;
            };
        };
        readonly 'supabase-unchecked-mutation-error': {
            meta: {
                type: string;
                docs: {
                    description: string;
                    category: string;
                    rationale: string;
                    docsUrl: string;
                    recommended: boolean;
                };
                messages: {
                    uncheckedMutation: string;
                };
                schema: never[];
            };
            create(context: any): {
                ExpressionStatement(node: any): void;
                VariableDeclarator(node: any): void;
                AssignmentExpression(node: any): void;
            };
        };
        readonly 'supabase-realtime-missing-filter': {
            meta: {
                type: string;
                docs: {
                    description: string;
                    category: string;
                    rationale: string;
                    docsUrl: string;
                    recommended: boolean;
                };
                messages: {
                    missingFilter: string;
                };
                schema: never[];
            };
            create(context: any): {
                CallExpression(node: any): void;
            };
        };
        readonly 'supabase-storage-error-not-surfaced': {
            meta: {
                type: string;
                docs: {
                    description: string;
                    category: string;
                    rationale: string;
                    docsUrl: string;
                    recommended: boolean;
                };
                messages: {
                    uploadErrorNotSurfaced: string;
                };
                schema: never[];
            };
            create(context: any): {
                VariableDeclarator(node: any): void;
                IfStatement(node: any): void;
                'Program:exit'(): void;
            };
        };
        readonly 'auth0-required-audience-validation': {
            meta: {
                type: string;
                docs: {
                    description: string;
                    category: string;
                    cwe: string;
                    owasp: string;
                    rationale: string;
                    docsUrl: string;
                    recommended: boolean;
                };
                messages: {
                    missingAudience: string;
                    conditionalAudience: string;
                };
            };
            create(context: any): {
                ImportDeclaration(node: any): void;
                CallExpression(node: any): void;
            };
        };
        readonly 'auth0-no-account-link-without-verified-email': {
            meta: {
                type: string;
                docs: {
                    description: string;
                    category: string;
                    cwe: string;
                    owasp: string;
                    rationale: string;
                    docsUrl: string;
                    recommended: boolean;
                };
                messages: {
                    unverifiedEmailLink: string;
                };
            };
            create(context: any): {
                Program(node: any): void;
                'Program:exit'(): void;
                FunctionDeclaration(node: any): void;
                'FunctionDeclaration:exit'(): void;
                FunctionExpression(node: any): void;
                'FunctionExpression:exit'(): void;
                ArrowFunctionExpression(node: any): void;
                'ArrowFunctionExpression:exit'(): void;
                CallExpression(node: any): void;
                MemberExpression(node: any): void;
                Literal(node: any): void;
            };
        };
        readonly 'auth0-dead-claim-verification-check': {
            meta: {
                type: string;
                docs: {
                    description: string;
                    category: string;
                    rationale: string;
                    docsUrl: string;
                    recommended: boolean;
                };
                messages: {
                    deadVerificationCheck: string;
                };
            };
            create(context: any): {
                CallExpression(node: any): void;
            };
        };
        readonly 'auth0-jwks-refresh-on-unknown-kid': {
            meta: {
                type: string;
                docs: {
                    description: string;
                    category: string;
                    rationale: string;
                    docsUrl: string;
                    recommended: boolean;
                };
                messages: {
                    noRefreshOnMiss: string;
                };
            };
            create(context: any): {
                Program(node: any): void;
                CallExpression(node: any): void;
                BinaryExpression(node: any): void;
                'Program:exit'(): void;
            };
        };
        readonly 'firebase-missing-app-check': {
            meta: {
                type: string;
                docs: {
                    description: string;
                    category: string;
                    cwe: string;
                    owasp: string;
                    rationale: string;
                    docsUrl: string;
                    recommended: boolean;
                };
                messages: {
                    missingAppCheck: string;
                };
                schema: never[];
            };
            create(context: any): {
                ImportDeclaration?: undefined;
                CallExpression?: undefined;
                'Program:exit'?: undefined;
            } | {
                ImportDeclaration(node: any): void;
                CallExpression(node: any): void;
                'Program:exit'(): void;
            };
        };
        readonly 'firebase-unhandled-auth-popup-rejection': {
            meta: {
                type: string;
                docs: {
                    description: string;
                    category: string;
                    rationale: string;
                    docsUrl: string;
                    recommended: boolean;
                };
                messages: {
                    unhandledPopupRejection: string;
                };
                schema: never[];
            };
            create(context: any): {
                ImportDeclaration(node: any): void;
                TryStatement(node: any): void;
                CallExpression(node: any): void;
                'Program:exit'(): void;
            };
        };
        readonly 'firebase-rtdb-list-read-for-single-item': {
            meta: {
                type: string;
                docs: {
                    description: string;
                    category: string;
                    rationale: string;
                    docsUrl: string;
                    recommended: boolean;
                };
                messages: {
                    listReadForSingleItem: string;
                };
                schema: never[];
            };
            create(context: any): {
                VariableDeclarator(node: any): void;
                CallExpression(node: any): void;
                'Program:exit'(): void;
            };
        };
        readonly 'firebase-unvalidated-external-data-to-rtdb': {
            meta: {
                type: string;
                docs: {
                    description: string;
                    category: string;
                    rationale: string;
                    docsUrl: string;
                    recommended: boolean;
                };
                messages: {
                    unvalidatedWrite: string;
                };
                schema: never[];
            };
            create(context: any): {
                ImportDeclaration(node: any): void;
                FunctionDeclaration(node: any): void;
                FunctionExpression(node: any): void;
                ArrowFunctionExpression(node: any): void;
                CallExpression(node: any): void;
                'Program:exit'(): void;
            };
        };
        readonly 'firebase-rtdb-batch-write-not-atomic': {
            meta: {
                type: string;
                docs: {
                    description: string;
                    category: string;
                    rationale: string;
                    docsUrl: string;
                    recommended: boolean;
                };
                messages: {
                    batchWriteNotAtomic: string;
                };
                schema: never[];
            };
            create(context: any): {
                ImportDeclaration(node: any): void;
                VariableDeclarator(node: any): void;
                CallExpression(node: any): void;
            };
        };
        readonly 'firebase-rtdb-listener-error-not-handled': {
            meta: {
                type: string;
                docs: {
                    description: string;
                    category: string;
                    rationale: string;
                    docsUrl: string;
                    recommended: boolean;
                };
                messages: {
                    listenerErrorNotHandled: string;
                };
                schema: never[];
            };
            create(context: any): {
                ImportDeclaration(node: any): void;
                CallExpression(node: any): void;
            };
        };
        readonly 'firebase-effect-deps-whole-user-object': {
            meta: {
                type: string;
                docs: {
                    description: string;
                    category: string;
                    rationale: string;
                    docsUrl: string;
                    recommended: boolean;
                };
                messages: {
                    wholeUserObjectDep: string;
                };
                schema: never[];
            };
            create(context: any): {
                CallExpression(node: any): void;
            };
        };
        readonly 'firebase-rtdb-write-promise-not-handled': {
            meta: {
                type: string;
                docs: {
                    description: string;
                    category: string;
                    rationale: string;
                    docsUrl: string;
                    recommended: boolean;
                };
                messages: {
                    writePromiseNotHandled: string;
                };
                schema: never[];
            };
            create(context: any): {
                ImportDeclaration(node: any): void;
                TryStatement(node: any): void;
                ReturnStatement(node: any): void;
                AwaitExpression(node: any): void;
                CallExpression(node: any): void;
                'Program:exit'(): void;
            };
        };
        readonly 'lovable-no-client-side-secret-fetch': {
            meta: {
                type: string;
                docs: {
                    description: string;
                    category: string;
                    cwe: string;
                    owasp: string;
                    rationale: string;
                    docsUrl: string;
                    recommended: boolean;
                };
                messages: {
                    clientSideSecretFetch: string;
                };
            };
            create(context: any): {
                VariableDeclarator(node: any): void;
                CallExpression(node: any): void;
            };
        };
        readonly 'lovable-paid-flag-without-edge-function': {
            meta: {
                type: string;
                docs: {
                    description: string;
                    category: string;
                    cwe: string;
                    owasp: string;
                    rationale: string;
                    docsUrl: string;
                    recommended: boolean;
                };
                messages: {
                    paidFlagWithoutPayment: string;
                };
            };
            create(context: any): {
                Program(node: any): void;
                'Program:exit'(): void;
                FunctionDeclaration(node: any): void;
                'FunctionDeclaration:exit'(): void;
                FunctionExpression(node: any): void;
                'FunctionExpression:exit'(): void;
                ArrowFunctionExpression(node: any): void;
                'ArrowFunctionExpression:exit'(): void;
                Literal(node: any): void;
                JSXText(node: any): void;
                TemplateElement(node: any): void;
                CallExpression(node: any): void;
            };
        };
        readonly 'lovable-expiry-column-never-checked': {
            meta: {
                type: string;
                docs: {
                    description: string;
                    category: string;
                    rationale: string;
                    docsUrl: string;
                    recommended: boolean;
                };
                messages: {
                    expiryNeverChecked: string;
                };
            };
            create(context: any): {
                CallExpression(node: any): void;
                BinaryExpression(node: any): void;
                'Program:exit'(): void;
            };
        };
        readonly 'lovable-silent-catch-on-provider-call': {
            meta: {
                type: string;
                docs: {
                    description: string;
                    category: string;
                    rationale: string;
                    docsUrl: string;
                    recommended: boolean;
                };
                messages: {
                    silentCatch: string;
                };
            };
            create(context: any): {
                TryStatement(node: any): void;
            };
        };
        readonly 'browserbase-no-conditional-authz-on-anonymous-user': {
            meta: {
                type: string;
                docs: {
                    description: string;
                    category: string;
                    cwe: string;
                    owasp: string;
                    rationale: string;
                    docsUrl: string;
                    recommended: boolean;
                };
                messages: {
                    conditionalAuthz: string;
                };
                schema: never[];
            };
            create(context: any): {
                FunctionDeclaration(node: any): void;
                FunctionExpression(node: any): void;
                ArrowFunctionExpression(node: any): void;
                IfStatement(node: any): void;
                CallExpression(node: any): void;
                'Program:exit'(): void;
            };
        };
        readonly 'browserbase-no-connect-url-in-api-response': {
            meta: {
                type: string;
                docs: {
                    description: string;
                    category: string;
                    cwe: string;
                    owasp: string;
                    rationale: string;
                    docsUrl: string;
                    recommended: boolean;
                };
                messages: {
                    connectUrlInResponse: string;
                };
                schema: never[];
            };
            create(context: any): {
                CallExpression(node: any): void;
            };
        };
        readonly 'browserbase-session-id-requires-ownership-check': {
            meta: {
                type: string;
                docs: {
                    description: string;
                    category: string;
                    cwe: string;
                    rationale: string;
                    docsUrl: string;
                    recommended: boolean;
                };
                messages: {
                    missingOwnershipCheck: string;
                };
                schema: never[];
            };
            create(context: any): {
                FunctionDeclaration(node: any): void;
                FunctionExpression(node: any): void;
                ArrowFunctionExpression(node: any): void;
                CallExpression(node: any): void;
                'Program:exit'(): void;
            };
        };
        readonly 'browserbase-no-concurrent-shared-context': {
            meta: {
                type: string;
                docs: {
                    description: string;
                    category: string;
                    rationale: string;
                    docsUrl: string;
                    recommended: boolean;
                };
                messages: {
                    concurrentSharedContext: string;
                };
                schema: never[];
            };
            create(context: any): {
                VariableDeclarator(node: any): void;
                CallExpression(node: any): void;
            };
        };
        readonly 'browserbase-mobile-device-requires-os-setting': {
            meta: {
                type: string;
                docs: {
                    description: string;
                    category: string;
                    rationale: string;
                    docsUrl: string;
                    recommended: boolean;
                };
                messages: {
                    missingOsSetting: string;
                };
                schema: never[];
            };
            create(context: any): {
                IfStatement(node: any): void;
                Property(node: any): void;
                AssignmentExpression(node: any): void;
                'Program:exit'(): void;
            };
        };
        readonly 'browserbase-use-typed-exception-status-not-substring': {
            meta: {
                type: string;
                docs: {
                    description: string;
                    category: string;
                    rationale: string;
                    docsUrl: string;
                    recommended: boolean;
                };
                messages: {
                    substringStatusMatch: string;
                };
                schema: never[];
            };
            create(context: any): {
                CatchClause(node: any): void;
            };
        };
        readonly 'browserbase-release-session-on-connect-failure': {
            meta: {
                type: string;
                docs: {
                    description: string;
                    category: string;
                    rationale: string;
                    docsUrl: string;
                    recommended: boolean;
                };
                messages: {
                    sessionNotReleasedOnFailure: string;
                };
                schema: never[];
            };
            create(context: any): {
                AwaitExpression(node: any): void;
                TryStatement(node: any): void;
                CallExpression(node: any): void;
                'Program:exit'(): void;
            };
        };
        readonly 'browserbase-dont-stack-custom-retry-on-sdk-retry': {
            meta: {
                type: string;
                docs: {
                    description: string;
                    category: string;
                    rationale: string;
                    docsUrl: string;
                    recommended: boolean;
                };
                messages: {
                    stackedRetry: string;
                };
                schema: never[];
            };
            create(context: any): {
                ForStatement(node: any): void;
                WhileStatement(node: any): void;
                DoWhileStatement(node: any): void;
                CallExpression(node: any): void;
            };
        };
        readonly 'browserbase-no-overbroad-error-substring-match': {
            meta: {
                type: string;
                docs: {
                    description: string;
                    category: string;
                    rationale: string;
                    docsUrl: string;
                    recommended: boolean;
                };
                messages: {
                    overbroadMatch: string;
                };
                schema: never[];
            };
            create(context: any): {
                IfStatement(node: any): void;
            };
        };
        readonly 'browserbase-use-sdk-not-raw-requests': {
            meta: {
                type: string;
                docs: {
                    description: string;
                    category: string;
                    rationale: string;
                    docsUrl: string;
                    recommended: boolean;
                };
                messages: {
                    rawRequestToBrowserbase: string;
                };
                schema: never[];
            };
            create(context: any): {
                VariableDeclarator(node: any): void;
                CallExpression(node: any): void;
            };
        };
        readonly 'browserbase-centralize-request-release': {
            meta: {
                type: string;
                docs: {
                    description: string;
                    category: string;
                    rationale: string;
                    docsUrl: string;
                    recommended: boolean;
                };
                messages: {
                    inlineRequestRelease: string;
                };
                schema: never[];
            };
            create(context: any): {
                CallExpression?: undefined;
            } | {
                CallExpression(node: any): void;
            };
        };
        readonly 'openai-cua-no-domain-allowlist': {
            meta: {
                type: string;
                docs: {
                    description: string;
                    category: string;
                    cwe: string;
                    owasp: string;
                    rationale: string;
                    docsUrl: string;
                    recommended: boolean;
                };
                messages: {
                    noOriginCheck: string;
                };
            };
            create(context: any): {
                Program(node: any): void;
                'Program:exit'(): void;
                FunctionDeclaration(node: any): void;
                'FunctionDeclaration:exit'(): void;
                FunctionExpression(node: any): void;
                'FunctionExpression:exit'(): void;
                ArrowFunctionExpression(node: any): void;
                'ArrowFunctionExpression:exit'(): void;
                CallExpression(node: any): void;
                NewExpression(node: any): void;
                MemberExpression(node: any): void;
                Identifier(node: any): void;
            };
        };
        readonly 'openai-cua-scroll-delta-default-zero': {
            meta: {
                type: string;
                docs: {
                    description: string;
                    category: string;
                    rationale: string;
                    docsUrl: string;
                    recommended: boolean;
                };
                messages: {
                    nonZeroDefault: string;
                };
            };
            create(context: any): {
                LogicalExpression(node: any): void;
                IfStatement(node: any): void;
            };
        };
        readonly 'openai-cua-structured-step-metadata-not-text-json': {
            meta: {
                type: string;
                docs: {
                    description: string;
                    category: string;
                    rationale: string;
                    docsUrl: string;
                    recommended: boolean;
                };
                messages: {
                    textJsonExtraction: string;
                };
            };
            create(context: any): {
                Program(node: any): void;
                'Program:exit'(): void;
                FunctionDeclaration(node: any): void;
                'FunctionDeclaration:exit'(): void;
                FunctionExpression(node: any): void;
                'FunctionExpression:exit'(): void;
                ArrowFunctionExpression(node: any): void;
                'ArrowFunctionExpression:exit'(): void;
                CallExpression(node: any): void;
            };
        };
        readonly 'openai-cua-no-blind-safety-check-ack': {
            meta: {
                type: string;
                docs: {
                    description: string;
                    category: string;
                    rationale: string;
                    docsUrl: string;
                    recommended: boolean;
                };
                messages: {
                    blindAck: string;
                };
            };
            create(context: any): {
                CallExpression(node: any): void;
            };
        };
        readonly 'openai-cua-retry-transient-turn-errors': {
            meta: {
                type: string;
                docs: {
                    description: string;
                    category: string;
                    rationale: string;
                    docsUrl: string;
                    recommended: boolean;
                };
                messages: {
                    noTurnRetry: string;
                };
            };
            create(context: any): {
                ForStatement(): void;
                'ForStatement:exit'(): void;
                WhileStatement(): void;
                'WhileStatement:exit'(): void;
                DoWhileStatement(): void;
                'DoWhileStatement:exit'(): void;
                ForOfStatement(): void;
                'ForOfStatement:exit'(): void;
                ForInStatement(): void;
                'ForInStatement:exit'(): void;
                TryStatement(node: any): void;
            };
        };
        readonly 'openai-cua-check-response-status-incomplete': {
            meta: {
                type: string;
                docs: {
                    description: string;
                    category: string;
                    rationale: string;
                    docsUrl: string;
                    recommended: boolean;
                };
                messages: {
                    missingIncompleteCheck: string;
                };
            };
            create(context: any): {
                Program(node: any): void;
                'Program:exit'(): void;
                FunctionDeclaration(node: any): void;
                'FunctionDeclaration:exit'(): void;
                FunctionExpression(node: any): void;
                'FunctionExpression:exit'(): void;
                ArrowFunctionExpression(node: any): void;
                'ArrowFunctionExpression:exit'(): void;
                CallExpression(node: any): void;
                ObjectExpression(node: any): void;
                BinaryExpression(node: any): void;
            };
        };
        readonly 'openai-cua-set-safety-identifier': {
            meta: {
                type: string;
                docs: {
                    description: string;
                    category: string;
                    rationale: string;
                    docsUrl: string;
                    recommended: boolean;
                };
                messages: {
                    missingSafetyIdentifier: string;
                };
            };
            create(context: any): {
                CallExpression(node: any): void;
            };
        };
    };
};

export { plugin as default, plugin };
