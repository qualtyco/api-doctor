declare const plugin: {
    readonly meta: {
        readonly name: "api-doctor";
        readonly version: "0.0.1";
    };
    readonly rules: {
        readonly 'resend-webhook-signature': {
            meta: {
                type: string;
                docs: {
                    description: string;
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
    };
};

export { plugin as default, plugin };
