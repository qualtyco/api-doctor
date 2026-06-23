// src/constants.ts
var PLUGIN_NAME = "@api-doctor/cli";

// src/providers/resend/rules/webhook-signature.ts
var rule = {
  meta: {
    type: "problem",
    docs: {
      description: "Resend webhook handlers must verify signatures before processing payloads",
      category: "security",
      cwe: "CWE-345",
      owasp: "API2:2023 Broken Authentication",
      rationale: "Webhook endpoints are public URLs, so anyone who learns the path can POST a forged payload. Without verifying the Svix signature first, an attacker can fake delivery, bounce, or complaint events and drive your application into the wrong state. Validating the signature against your webhook secret before reading the body ensures the event genuinely came from Resend.",
      docsUrl: "https://resend.com/docs/dashboard/webhooks/introduction#verify-webhook-signatures",
      recommended: true
    },
    messages: {
      missingVerification: "This webhook handler processes Resend events without verifying the signature first."
    }
  },
  // eslint-style rule API: `create(context)` returns visitor map.
  create(context) {
    let importsResend = false;
    const svixImports = /* @__PURE__ */ new Set();
    const postHandlers = [];
    function nodeStartPos(n) {
      const rangeStart = typeof n?.range?.[0] === "number" ? n.range[0] : null;
      const line = n?.loc?.start?.line ?? 1;
      const column = n?.loc?.start?.column ?? 0;
      const offset = rangeStart ?? line * 1e6 + column;
      return { offset, line, column };
    }
    function nodeEndPos(n) {
      const rangeEnd = typeof n?.range?.[1] === "number" ? n.range[1] : null;
      const line = n?.loc?.end?.line ?? n?.loc?.start?.line ?? 1;
      const column = n?.loc?.end?.column ?? n?.loc?.start?.column ?? 0;
      const offset = rangeEnd ?? line * 1e6 + column;
      return { offset, line, column };
    }
    function within(handler, n) {
      const p = nodeStartPos(n);
      return p.offset >= handler.start.offset && p.offset <= handler.end.offset;
    }
    function isExportedPostHandler(fnNode) {
      if (fnNode?.type === "FunctionDeclaration") return fnNode?.id?.name === "POST";
      return fnNode?.type === "ArrowFunctionExpression" || fnNode?.type === "FunctionExpression";
    }
    function getHandlerFromExportNamedDeclaration(node) {
      const handlers = [];
      const decl = node?.declaration;
      if (!decl) return handlers;
      if (decl.type === "FunctionDeclaration") {
        if (decl.id?.name === "POST") {
          handlers.push({
            node: decl,
            start: nodeStartPos(decl),
            end: nodeEndPos(decl),
            firstBodyPos: void 0,
            firstVerifyPos: void 0
          });
        }
        return handlers;
      }
      if (decl.type === "VariableDeclaration") {
        for (const d of decl.declarations ?? []) {
          const idName = d?.id?.type === "Identifier" ? d.id.name : null;
          if (idName !== "POST") continue;
          const init = d?.init;
          if (!init) continue;
          if (!isExportedPostHandler(init)) continue;
          handlers.push({
            node: init,
            start: nodeStartPos(init),
            end: nodeEndPos(init),
            firstBodyPos: void 0,
            firstVerifyPos: void 0
          });
        }
      }
      return handlers;
    }
    function isReqJsonCall(n) {
      if (n?.type !== "CallExpression") return false;
      const callee = n.callee;
      if (callee?.type !== "MemberExpression") return false;
      const prop = callee.property;
      if (prop?.type !== "Identifier" || prop.name !== "json") return false;
      const obj = callee.object;
      return obj?.type === "Identifier" && (obj.name === "req" || obj.name === "request");
    }
    function isBodyMember(n) {
      if (n?.type !== "MemberExpression") return false;
      const prop = n.property;
      if (prop?.type !== "Identifier" || prop.name !== "body") return false;
      const obj = n.object;
      return obj?.type === "Identifier" && (obj.name === "req" || obj.name === "request");
    }
    function isCryptoCreateHmacCall(n) {
      if (n?.type !== "CallExpression") return false;
      const callee = n.callee;
      if (callee?.type !== "MemberExpression") return false;
      const prop = callee.property;
      if (prop?.type !== "Identifier" || prop.name !== "createHmac") return false;
      return callee.object?.type === "Identifier" || callee.object?.type === "MemberExpression";
    }
    function isSvixVerifyCall(n) {
      if (n?.type !== "CallExpression") return false;
      const callee = n.callee;
      if (callee?.type !== "MemberExpression") return false;
      const prop = callee.property;
      if (prop?.type !== "Identifier" || prop.name !== "verify") return false;
      const obj = callee.object;
      return obj?.type === "Identifier" && svixImports.has(obj.name);
    }
    function recordFirst(posKey, handler, pos) {
      const existing = handler[posKey];
      if (!existing) {
        handler[posKey] = pos;
        return;
      }
      if (pos.offset < existing.offset) {
        handler[posKey] = pos;
      }
    }
    return {
      ImportDeclaration(node) {
        const importSource = node?.source?.value;
        if (importSource === "resend") importsResend = true;
        if (importSource === "svix") {
          for (const s of node.specifiers ?? []) {
            if (s?.type === "ImportSpecifier" && s.local?.type === "Identifier") {
              svixImports.add(s.local.name);
            }
            if ((s?.type === "ImportDefaultSpecifier" || s?.type === "ImportNamespaceSpecifier") && s.local?.type === "Identifier") {
              svixImports.add(s.local.name);
            }
          }
        }
      },
      ExportNamedDeclaration(node) {
        const handlers = getHandlerFromExportNamedDeclaration(node);
        for (const h of handlers) postHandlers.push(h);
      },
      CallExpression(node) {
        if (postHandlers.length === 0) return;
        const pos = nodeStartPos(node);
        for (const handler of postHandlers) {
          if (!within(handler, node)) continue;
          if (isReqJsonCall(node)) recordFirst("firstBodyPos", handler, pos);
          if (isSvixVerifyCall(node)) recordFirst("firstVerifyPos", handler, pos);
          if (isCryptoCreateHmacCall(node)) recordFirst("firstVerifyPos", handler, pos);
        }
      },
      MemberExpression(node) {
        if (postHandlers.length === 0) return;
        if (!isBodyMember(node)) return;
        const pos = nodeStartPos(node);
        for (const handler of postHandlers) {
          if (!within(handler, node)) continue;
          recordFirst("firstBodyPos", handler, pos);
        }
      },
      "Program:exit"() {
        if (!importsResend) return;
        for (const handler of postHandlers) {
          if (!handler.firstVerifyPos) {
            context.report({ node: handler.node, messageId: "missingVerification" });
            continue;
          }
          if (handler.firstBodyPos && handler.firstVerifyPos.offset > handler.firstBodyPos.offset) {
            context.report({ node: handler.node, messageId: "missingVerification" });
          }
        }
      }
    };
  }
};
var resendWebhookSignatureRule = rule;

// src/providers/resend/rules/api-key-hardcoded.ts
var RESEND_KEY_PATTERN = /\bre_[A-Za-z0-9_]+/;
var rule2 = {
  meta: {
    type: "problem",
    docs: {
      description: "Resend API keys must not be hardcoded; load them from environment variables",
      category: "security",
      cwe: "CWE-798",
      owasp: "API8:2023 Security Misconfiguration",
      rationale: "A hardcoded API key gets committed to version control, where it lives in git history forever and is exposed to anyone with repository access. Leaked Resend keys let attackers send mail from your domain, damaging sender reputation and deliverability. Reading the key from process.env.RESEND_API_KEY keeps the secret out of source code and lets you rotate it without a redeploy.",
      docsUrl: "https://resend.com/docs/send-with-nextjs#prerequisites",
      recommended: true
    },
    messages: {
      hardcodedApiKey: "Hardcoded Resend API key detected. Load the key from process.env.RESEND_API_KEY instead."
    },
    schema: []
  },
  create(context) {
    return {
      Literal(node) {
        if (typeof node.value !== "string") return;
        if (RESEND_KEY_PATTERN.test(node.value)) {
          context.report({ node, messageId: "hardcodedApiKey" });
        }
      },
      TemplateElement(node) {
        const cooked = node?.value?.cooked ?? node?.value?.raw;
        if (typeof cooked !== "string") return;
        if (RESEND_KEY_PATTERN.test(cooked)) {
          context.report({ node, messageId: "hardcodedApiKey" });
        }
      }
    };
  }
};
var resendApiKeyHardcodedRule = rule2;

// src/providers/resend/rules/api-key-in-client-bundle.ts
function isComponentsPath(filename) {
  return /[\\/]components[\\/]/.test(filename);
}
var rule3 = {
  meta: {
    type: "problem",
    docs: {
      description: "The Resend SDK must not be imported into client-bundled code",
      category: "security",
      cwe: "CWE-200",
      owasp: "API8:2023 Security Misconfiguration",
      rationale: 'The Resend SDK is server-only and is initialized with your secret API key. Importing it into a "use client" component or other browser-bundled code ships that key to every visitor, where it can be read straight from the page source. Keeping Resend imports in server code (route handlers, server actions, server components) ensures the key never reaches the client.',
      docsUrl: "https://resend.com/docs/send-with-nextjs",
      recommended: true
    },
    messages: {
      clientBundleImport: "Resend is imported into client-bundled code. Keep Resend (and its API key) on the server."
    },
    schema: []
  },
  create(context) {
    let resendImportNode = null;
    let hasUseClient = false;
    let hasJsx = false;
    return {
      Program(node) {
        for (const stmt of node.body ?? []) {
          if (stmt?.type !== "ExpressionStatement") continue;
          const directive = stmt.directive ?? (stmt.expression?.type === "Literal" ? stmt.expression.value : void 0);
          if (directive === "use client") {
            hasUseClient = true;
            break;
          }
        }
      },
      ImportDeclaration(node) {
        if (node?.source?.value !== "resend") return;
        if (node.importKind === "type") return;
        const allSpecifiersAreType = Array.isArray(node.specifiers) && node.specifiers.length > 0 && node.specifiers.every((s) => s.importKind === "type");
        if (allSpecifiersAreType) return;
        resendImportNode = node;
      },
      JSXElement() {
        hasJsx = true;
      },
      JSXFragment() {
        hasJsx = true;
      },
      "Program:exit"() {
        if (!resendImportNode) return;
        const inClientBundle = hasUseClient || isComponentsPath(String(context.filename ?? "")) && hasJsx;
        if (inClientBundle) {
          context.report({ node: resendImportNode, messageId: "clientBundleImport" });
        }
      }
    };
  }
};
var resendApiKeyInClientBundleRule = rule3;

// src/providers/resend/utils.ts
function isResendEmailsSendCall(node) {
  if (node?.type !== "CallExpression") return false;
  const callee = node.callee;
  if (callee?.type !== "MemberExpression") return false;
  if (callee.property?.type !== "Identifier" || callee.property.name !== "send") return false;
  const obj = callee.object;
  return obj?.type === "MemberExpression" && obj.property?.type === "Identifier" && obj.property.name === "emails";
}
function isResendBatchSendCall(node) {
  if (node?.type !== "CallExpression") return false;
  const callee = node.callee;
  if (callee?.type !== "MemberExpression") return false;
  if (callee.property?.type !== "Identifier" || callee.property.name !== "send") return false;
  const obj = callee.object;
  return obj?.type === "MemberExpression" && obj.property?.type === "Identifier" && obj.property.name === "batch";
}
function isResendSendCall(node) {
  return isResendEmailsSendCall(node) || isResendBatchSendCall(node);
}
function getObjectArg(node, index) {
  const arg = node?.arguments?.[index];
  return arg?.type === "ObjectExpression" ? arg : null;
}
function getSendOptionObjects(node) {
  if (isResendEmailsSendCall(node)) {
    const opts = getObjectArg(node, 0);
    return opts ? [opts] : [];
  }
  if (isResendBatchSendCall(node)) {
    const arr = node?.arguments?.[0];
    if (arr?.type !== "ArrayExpression") return [];
    return (arr.elements ?? []).filter((el) => el?.type === "ObjectExpression");
  }
  return [];
}
function findProperty(objectExpression, name) {
  if (objectExpression?.type !== "ObjectExpression") return void 0;
  return objectExpression.properties?.find(
    (p) => p?.type === "Property" && (p.key?.type === "Identifier" && p.key.name === name || p.key?.type === "Literal" && p.key.value === name)
  );
}
function isInsideTestFile(filename) {
  return /(^|[\\/])__tests__[\\/]|\.(test|spec)\.[cm]?[jt]sx?$/.test(filename);
}
function startOffset(n) {
  if (typeof n?.range?.[0] === "number") return n.range[0];
  if (typeof n?.start === "number") return n.start;
  return (n?.loc?.start?.line ?? 0) * 1e6 + (n?.loc?.start?.column ?? 0);
}
function endOffset(n) {
  if (typeof n?.range?.[1] === "number") return n.range[1];
  if (typeof n?.end === "number") return n.end;
  return (n?.loc?.end?.line ?? n?.loc?.start?.line ?? 0) * 1e6 + (n?.loc?.end?.column ?? 0);
}
function contains(outer, inner) {
  const s = startOffset(inner);
  return s >= startOffset(outer) && s <= endOffset(outer);
}

// src/providers/resend/rules/marketing-via-batch-send.ts
var MARKETING_PATH = /marketing|campaign|newsletter|promotion|broadcast/i;
var rule4 = {
  meta: {
    type: "problem",
    docs: {
      description: "Marketing emails should use the Broadcasts API, not resend.batch.send",
      category: "correctness",
      rationale: "resend.batch.send is the transactional batch API; Resend documents Broadcasts as the correct feature for marketing and campaign sends. Using batch send for promotional mail skips audience management, consent tracking, and the automatic unsubscribe handling that Broadcasts provide, which puts you out of step with CAN-SPAM/CASL. Sending campaigns through Broadcasts (or the Dashboard) keeps deliverability and compliance intact.",
      docsUrl: "https://resend.com/docs/dashboard/emails/batch-sending",
      recommended: true
    },
    messages: {
      marketingViaBatch: "Marketing/campaign email sent via resend.batch.send. Use the Broadcasts API for marketing sends."
    },
    schema: []
  },
  create(context) {
    const isMarketingFile = MARKETING_PATH.test(String(context.filename ?? ""));
    return {
      CallExpression(node) {
        if (!isMarketingFile) return;
        if (isResendBatchSendCall(node)) {
          context.report({ node, messageId: "marketingViaBatch" });
        }
      }
    };
  }
};
var resendMarketingViaBatchSendRule = rule4;

// src/providers/resend/rules/marketing-missing-unsubscribe.ts
var MARKETING_TAG = /marketing|campaign|newsletter|promotion/i;
var UNSUBSCRIBE_PLACEHOLDER = "{{{RESEND_UNSUBSCRIBE_URL}}}";
function literalString(node) {
  if (node?.type === "Literal" && typeof node.value === "string") return node.value;
  if (node?.type === "TemplateLiteral") {
    return (node.quasis ?? []).map((q) => q?.value?.cooked ?? q?.value?.raw ?? "").join(" ");
  }
  return void 0;
}
function hasMarketingTag(opts) {
  const tagsProp = findProperty(opts, "tags");
  const arr = tagsProp?.value;
  if (arr?.type !== "ArrayExpression") return false;
  for (const el of arr.elements ?? []) {
    if (el?.type !== "ObjectExpression") continue;
    const valueProp = findProperty(el, "value");
    const v = literalString(valueProp?.value);
    if (typeof v === "string" && MARKETING_TAG.test(v)) return true;
  }
  return false;
}
function hasListUnsubscribeHeader(opts) {
  const headersProp = findProperty(opts, "headers");
  const obj = headersProp?.value;
  if (obj?.type !== "ObjectExpression") return false;
  return (obj.properties ?? []).some((p) => {
    if (p?.type !== "Property") return false;
    const key = p.key?.type === "Literal" ? String(p.key.value) : p.key?.type === "Identifier" ? p.key.name : "";
    return key.toLowerCase() === "list-unsubscribe";
  });
}
function htmlHasUnsubscribePlaceholder(opts) {
  const htmlProp = findProperty(opts, "html");
  const text = literalString(htmlProp?.value);
  return typeof text === "string" && text.includes(UNSUBSCRIBE_PLACEHOLDER);
}
function hasUnsubscribeMechanism(opts) {
  return hasListUnsubscribeHeader(opts) || htmlHasUnsubscribePlaceholder(opts);
}
var rule5 = {
  meta: {
    type: "problem",
    docs: {
      description: "Marketing emails must include an unsubscribe mechanism",
      category: "correctness",
      rationale: 'Marketing email is regulated by laws like CAN-SPAM (US) and CASL (Canada), which require recipients to be able to opt out. A campaign with only static "you opted in" text and no working unsubscribe path exposes you to legal penalties and gets flagged as spam, hurting deliverability for all your mail. Adding a List-Unsubscribe header (RFC 8058) or the {{{RESEND_UNSUBSCRIBE_URL}}} placeholder gives recipients a real way to opt out.',
      docsUrl: "https://resend.com/docs/dashboard/broadcasts/introduction",
      recommended: true
    },
    messages: {
      missingUnsubscribe: "Marketing email has no unsubscribe mechanism (List-Unsubscribe header or {{{RESEND_UNSUBSCRIBE_URL}}})."
    },
    schema: []
  },
  create(context) {
    return {
      CallExpression(node) {
        for (const opts of getSendOptionObjects(node)) {
          if (hasMarketingTag(opts) && !hasUnsubscribeMechanism(opts)) {
            context.report({ node, messageId: "missingUnsubscribe" });
            return;
          }
        }
      }
    };
  }
};
var resendMarketingMissingUnsubscribeRule = rule5;

// src/providers/resend/rules/test-domain-in-production-path.ts
var TEST_DOMAIN = "onboarding@resend.dev";
var rule6 = {
  meta: {
    type: "suggestion",
    docs: {
      description: "Do not use the onboarding@resend.dev test domain in production code",
      category: "correctness",
      rationale: 'onboarding@resend.dev is a shared test sender that only delivers to the account owner; sending from it to any other recipient returns a 403 error. Shipping it to production \u2014 including as a `?? "onboarding@resend.dev"` fallback \u2014 means real users silently never receive their email. Sending from a verified domain configured via process.env.RESEND_FROM_EMAIL is the documented production requirement.',
      docsUrl: "https://resend.com/docs/send-with-nextjs",
      recommended: true
    },
    messages: {
      testDomain: "onboarding@resend.dev is a test-only sender. Use a verified domain (via process.env) in production."
    },
    schema: []
  },
  create(context) {
    if (isInsideTestFile(String(context.filename ?? ""))) return {};
    return {
      Literal(node) {
        if (typeof node.value === "string" && node.value.includes(TEST_DOMAIN)) {
          context.report({ node, messageId: "testDomain" });
        }
      },
      TemplateElement(node) {
        const cooked = node?.value?.cooked ?? node?.value?.raw;
        if (typeof cooked === "string" && cooked.includes(TEST_DOMAIN)) {
          context.report({ node, messageId: "testDomain" });
        }
      }
    };
  }
};
var resendTestDomainInProductionPathRule = rule6;

// src/providers/resend/rules/from-address-not-friendly-format.ts
var BARE_EMAIL = /^[^<>]+@[^<>]+$/;
var rule7 = {
  meta: {
    type: "suggestion",
    docs: {
      description: 'Resend from addresses should use the friendly-name format "Name <email>"',
      category: "integration",
      rationale: 'Every Resend doc example uses the friendly-name form "Acme <onboarding@acme.com>" rather than a bare email. A bare from address shows up in inboxes as a raw email string, which looks less trustworthy and can hurt open rates and brand recognition. Wrapping the address with a display name is a one-line change that matches the documented convention.',
      docsUrl: "https://resend.com/docs/api-reference/emails/send-email",
      recommended: true
    },
    messages: {
      bareFromAddress: 'From address is a bare email. Use the friendly format "Name <email@domain>" as shown in the docs.'
    },
    schema: []
  },
  create(context) {
    return {
      CallExpression(node) {
        for (const opts of getSendOptionObjects(node)) {
          const fromProp = findProperty(opts, "from");
          const value = fromProp?.value;
          if (value?.type === "Literal" && typeof value.value === "string" && BARE_EMAIL.test(value.value.trim())) {
            context.report({ node: value, messageId: "bareFromAddress" });
          }
        }
      }
    };
  }
};
var resendFromAddressNotFriendlyFormatRule = rule7;

// src/providers/resend/rules/batch-size-not-enforced.ts
var COMPARISON_OPERATORS = /* @__PURE__ */ new Set([">", ">=", "<", "<=", "===", "!==", "==", "!="]);
var rule8 = {
  meta: {
    type: "suggestion",
    docs: {
      description: "Enforce the 100-email batch limit before calling resend.batch.send",
      category: "reliability",
      rationale: "resend.batch.send accepts at most 100 emails per call. Passing a user- or data-driven array without a length guard means the request fails outright once the list grows past 100, so an entire batch of notifications silently never sends. Guarding the array length (or chunking it into <=100-sized slices) keeps the send reliable as volume scales.",
      docsUrl: "https://resend.com/docs/api-reference/emails/send-batch-emails",
      recommended: true
    },
    messages: {
      batchSizeNotEnforced: "resend.batch.send has a 100-email limit. Guard the array length (e.g. if (items.length > 100)) before sending."
    },
    schema: []
  },
  create(context) {
    const functions = [];
    const loops = [];
    const lengthChecks = /* @__PURE__ */ new Map();
    const batchCalls = [];
    function isLengthOfName(member) {
      if (member?.type !== "MemberExpression") return null;
      if (member.property?.type !== "Identifier" || member.property.name !== "length") return null;
      if (member.object?.type !== "Identifier") return null;
      return member.object.name;
    }
    return {
      FunctionDeclaration(node) {
        functions.push(node);
      },
      FunctionExpression(node) {
        functions.push(node);
      },
      ArrowFunctionExpression(node) {
        functions.push(node);
      },
      ForStatement(node) {
        loops.push(node);
      },
      ForOfStatement(node) {
        loops.push(node);
      },
      ForInStatement(node) {
        loops.push(node);
      },
      WhileStatement(node) {
        loops.push(node);
      },
      DoWhileStatement(node) {
        loops.push(node);
      },
      BinaryExpression(node) {
        if (!COMPARISON_OPERATORS.has(node.operator)) return;
        for (const side of [node.left, node.right]) {
          const name = isLengthOfName(side);
          if (name) {
            const list = lengthChecks.get(name) ?? [];
            list.push(node);
            lengthChecks.set(name, list);
          }
        }
      },
      CallExpression(node) {
        if (!isResendBatchSendCall(node)) return;
        const arg = node.arguments?.[0];
        if (arg?.type !== "Identifier") return;
        batchCalls.push({ node, argName: arg.name });
      },
      "Program:exit"() {
        for (const { node, argName } of batchCalls) {
          if (loops.some((loop) => contains(loop, node))) continue;
          const enclosing = functions.filter((fn) => contains(fn, node)).sort((a, b) => startOffset(b) - startOffset(a))[0];
          const checks = lengthChecks.get(argName) ?? [];
          const guarded = enclosing ? checks.some((chk) => contains(enclosing, chk)) : checks.length > 0;
          if (!guarded) {
            context.report({ node, messageId: "batchSizeNotEnforced" });
          }
        }
      }
    };
  }
};
var resendBatchSizeNotEnforcedRule = rule8;

// src/providers/resend/rules/missing-idempotency-key.ts
var rule9 = {
  meta: {
    type: "suggestion",
    docs: {
      description: "Resend send/batch calls should include an idempotencyKey",
      category: "reliability",
      rationale: "Without an idempotency key, if a network retry or webhook redelivery occurs, Resend will send the email multiple times. This causes duplicate charges, duplicate user notifications, and damaged sender reputation. Adding an idempotency key (a unique string per logical operation, like `welcome/${userId}`) makes the send safely retryable.",
      docsUrl: "https://resend.com/docs/send-with-nextjs",
      recommended: true
    },
    messages: {
      missingIdempotencyKey: "Resend send call has no idempotencyKey. Add one to prevent duplicate sends on retry."
    },
    schema: []
  },
  create(context) {
    return {
      CallExpression(node) {
        if (!isResendSendCall(node)) return;
        const hasKey = (node.arguments ?? []).some(
          (arg) => arg?.type === "ObjectExpression" && findProperty(arg, "idempotencyKey")
        );
        if (!hasKey) {
          context.report({ node, messageId: "missingIdempotencyKey" });
        }
      }
    };
  }
};
var resendMissingIdempotencyKeyRule = rule9;

// src/providers/resend/rules/no-error-code-mapping.ts
var rule10 = {
  meta: {
    type: "suggestion",
    docs: {
      description: "Resend errors should map to appropriate HTTP status codes, not a blanket 500",
      category: "reliability",
      rationale: "Resend returns different error classes that callers must treat differently: 400/422 mean fix the params and do not retry, 401/403 mean fix the key or domain, and 429/500 mean retry with backoff. Collapsing all of them into a blanket HTTP 500 tells the client to retry errors that will never succeed and hides the real cause from logs and monitoring. Mapping the SDK error code to the right status makes the API honest and lets clients react correctly.",
      docsUrl: "https://resend.com/docs/ai-onboarding",
      recommended: true
    },
    messages: {
      noErrorCodeMapping: "Resend errors are returned as a blanket HTTP 500. Map 400/401/403/422 to non-500 statuses."
    },
    schema: []
  },
  create(context) {
    const functions = [];
    const resendErrorBindings = [];
    const ifErrorStatements = [];
    const fiveHundredNodes = [];
    function initIsResendSend(init) {
      if (!init) return false;
      const expr = init.type === "AwaitExpression" ? init.argument : init;
      return isResendSendCall(expr);
    }
    function isNextResponse500(node) {
      const callee = node.callee;
      if (callee?.type !== "MemberExpression") return false;
      if (callee.property?.type !== "Identifier" || callee.property.name !== "json") return false;
      const opts = node.arguments?.[1];
      const statusProp = findProperty(opts, "status");
      return statusProp?.value?.type === "Literal" && statusProp.value.value === 500;
    }
    function isResStatus500(node) {
      const callee = node.callee;
      if (callee?.type !== "MemberExpression") return false;
      if (callee.property?.type !== "Identifier" || callee.property.name !== "status") return false;
      const arg = node.arguments?.[0];
      return arg?.type === "Literal" && arg.value === 500;
    }
    return {
      FunctionDeclaration(node) {
        functions.push(node);
      },
      FunctionExpression(node) {
        functions.push(node);
      },
      ArrowFunctionExpression(node) {
        functions.push(node);
      },
      VariableDeclarator(node) {
        if (!initIsResendSend(node.init)) return;
        if (node.id?.type !== "ObjectPattern") return;
        const errorProp = (node.id.properties ?? []).find(
          (p) => p?.type === "Property" && p.key?.type === "Identifier" && p.key.name === "error"
        );
        if (!errorProp) return;
        const localName = errorProp.value?.type === "Identifier" ? errorProp.value.name : "error";
        resendErrorBindings.push({ name: localName, pos: startOffset(node) });
      },
      IfStatement(node) {
        if (node.test?.type === "Identifier") {
          ifErrorStatements.push({ node, name: node.test.name, consequent: node.consequent });
        }
      },
      CallExpression(node) {
        if (isNextResponse500(node) || isResStatus500(node)) {
          fiveHundredNodes.push(node);
        }
      },
      "Program:exit"() {
        for (const { node, name, consequent } of ifErrorStatements) {
          const has500 = fiveHundredNodes.some((five) => contains(consequent, five));
          if (!has500) continue;
          const enclosing = functions.filter((fn) => contains(fn, node)).sort((a, b) => startOffset(b) - startOffset(a))[0];
          const boundFromResend = resendErrorBindings.some(
            (b) => b.name === name && (enclosing ? contains(enclosing, { range: [b.pos, b.pos] }) : true)
          );
          if (boundFromResend) {
            context.report({ node, messageId: "noErrorCodeMapping" });
          }
        }
      }
    };
  }
};
var resendNoErrorCodeMappingRule = rule10;

// src/providers/resend/rules/webhook-no-idempotency.ts
var DEDUP_OBJECTS = /* @__PURE__ */ new Set(["redis", "kv", "db", "prisma", "supabase", "cache", "store"]);
var DEDUP_METHODS = /* @__PURE__ */ new Set([
  "has",
  "add",
  "sadd",
  "sismember",
  "exists",
  "findUnique",
  "findFirst",
  "upsert"
]);
var EVENT_ID_PROPS = /* @__PURE__ */ new Set(["email_id", "eventId", "event_id"]);
var rule11 = {
  meta: {
    type: "suggestion",
    docs: {
      description: "Resend webhook handlers should deduplicate retried events",
      category: "reliability",
      rationale: "Resend retries failed webhook deliveries for up to 24 hours, so the same event can legitimately arrive more than once. A handler that acts on every delivery without deduplication will double-process events \u2014 sending duplicate downstream notifications, double-counting metrics, or corrupting state. Tracking processed event ids (e.g. event.data.email_id) in a store or set and skipping ones already seen makes the handler safely idempotent.",
      docsUrl: "https://resend.com/docs/dashboard/webhooks/introduction",
      recommended: true
    },
    messages: {
      noIdempotency: "Resend webhook handler has no deduplication. Resend retries for 24h; track processed event ids."
    },
    schema: []
  },
  create(context) {
    let importsSvix = false;
    const postHandlers = [];
    const dedupSignals = [];
    function collectPostHandler(decl) {
      if (!decl) return;
      if (decl.type === "FunctionDeclaration" && decl.id?.name === "POST") {
        postHandlers.push(decl);
        return;
      }
      if (decl.type === "VariableDeclaration") {
        for (const d of decl.declarations ?? []) {
          if (d?.id?.type === "Identifier" && d.id.name === "POST" && (d.init?.type === "ArrowFunctionExpression" || d.init?.type === "FunctionExpression")) {
            postHandlers.push(d.init);
          }
        }
      }
    }
    return {
      ImportDeclaration(node) {
        if (node?.source?.value === "svix") importsSvix = true;
      },
      ExportNamedDeclaration(node) {
        collectPostHandler(node.declaration);
      },
      NewExpression(node) {
        if (node.callee?.type === "Identifier" && (node.callee.name === "Map" || node.callee.name === "Set")) {
          dedupSignals.push(node);
        }
      },
      CallExpression(node) {
        const callee = node.callee;
        if (callee?.type !== "MemberExpression") return;
        const objName = callee.object?.type === "Identifier" ? callee.object.name : void 0;
        const methodName = callee.property?.type === "Identifier" ? callee.property.name : void 0;
        if (objName && DEDUP_OBJECTS.has(objName) || methodName && DEDUP_METHODS.has(methodName)) {
          dedupSignals.push(node);
        }
      },
      MemberExpression(node) {
        if (node.property?.type === "Identifier" && EVENT_ID_PROPS.has(node.property.name)) {
          dedupSignals.push(node);
        }
      },
      "Program:exit"() {
        if (!importsSvix) return;
        for (const handler of postHandlers) {
          const hasDedup = dedupSignals.some(
            (sig) => startOffset(sig) >= startOffset(handler) && endOffset(sig) <= endOffset(handler)
          );
          if (!hasDedup) {
            context.report({ node: handler, messageId: "noIdempotency" });
          }
        }
      }
    };
  }
};
var resendWebhookNoIdempotencyRule = rule11;

// src/providers/resend/rules/missing-tags.ts
var rule12 = {
  meta: {
    type: "suggestion",
    docs: {
      description: "Resend sends should include tags for deliverability segmentation",
      category: "integration",
      rationale: 'Tags are how Resend segments and filters email in the dashboard and analytics, so sends without them collapse into one undifferentiated stream. When deliverability dips or you need to trace a specific campaign, untagged mail gives you nothing to slice on. Adding tags such as [{ name: "category", value: "welcome" }] makes monitoring and debugging across email types possible.',
      docsUrl: "https://resend.com/docs/dashboard/emails/tags",
      recommended: true
    },
    messages: {
      missingTags: 'Resend send has no tags. Add tags (e.g. [{ name: "category", value: "welcome" }]) for segmentation.'
    },
    schema: []
  },
  create(context) {
    return {
      CallExpression(node) {
        if (!isResendSendCall(node)) return;
        const optionObjects = getSendOptionObjects(node);
        if (optionObjects.length === 0) return;
        const someMissingTags = optionObjects.some((opts) => !findProperty(opts, "tags"));
        if (someMissingTags) {
          context.report({ node, messageId: "missingTags" });
        }
      }
    };
  }
};
var resendMissingTagsRule = rule12;

// src/providers/resend/rules/request-id-not-logged.ts
var REQUEST_ID_HEADERS = /* @__PURE__ */ new Set(["x-request-id", "x-resend-request-id"]);
var rule13 = {
  meta: {
    type: "suggestion",
    docs: {
      description: "Log the Resend request id when handling errors",
      category: "integration",
      rationale: 'Every Resend API response carries a request id (x-request-id / x-resend-request-id) that uniquely identifies the call on their side. When something goes wrong, logging only error.message leaves you and Resend support with no way to find the exact failed request. Logging the request id alongside the message turns a vague "send failed" into a traceable incident that support can look up directly.',
      docsUrl: "https://resend.com/docs/api-reference/errors",
      recommended: true
    },
    messages: {
      requestIdNotLogged: "Error handler logs error.message but not the Resend request id (x-request-id / x-resend-request-id)."
    },
    schema: []
  },
  create(context) {
    let importsResend = false;
    const scopes = [];
    const messageAccesses = [];
    const requestIdPositions = [];
    function within(range, pos) {
      return pos >= range[0] && pos <= range[1];
    }
    return {
      ImportDeclaration(node) {
        if (node?.source?.value === "resend") importsResend = true;
      },
      CatchClause(node) {
        const param = node.param;
        if (param?.type === "Identifier" && node.body) {
          scopes.push({
            node,
            name: param.name,
            range: [startOffset(node.body), endOffset(node.body)]
          });
        }
      },
      IfStatement(node) {
        if (node.test?.type === "Identifier" && node.consequent) {
          scopes.push({
            node,
            name: node.test.name,
            range: [startOffset(node.consequent), endOffset(node.consequent)]
          });
        }
      },
      MemberExpression(node) {
        if (node.property?.type === "Identifier" && node.property.name === "message" && node.object?.type === "Identifier") {
          messageAccesses.push({ name: node.object.name, pos: startOffset(node) });
        }
      },
      Literal(node) {
        if (typeof node.value === "string" && REQUEST_ID_HEADERS.has(node.value.toLowerCase())) {
          requestIdPositions.push(startOffset(node));
        }
      },
      "Program:exit"() {
        if (!importsResend) return;
        for (const scope of scopes) {
          const logsMessage = messageAccesses.some(
            (m) => m.name === scope.name && within(scope.range, m.pos)
          );
          if (!logsMessage) continue;
          const logsRequestId = requestIdPositions.some((pos) => within(scope.range, pos));
          if (!logsRequestId) {
            context.report({ node: scope.node, messageId: "requestIdNotLogged" });
          }
        }
      }
    };
  }
};
var resendRequestIdNotLoggedRule = rule13;

// src/providers/supabase/utils.ts
function memberPropName(node) {
  if (node?.type !== "CallExpression") return void 0;
  const callee = node.callee;
  if (callee?.type !== "MemberExpression") return void 0;
  const prop = callee.property;
  if (!callee.computed && prop?.type === "Identifier") return prop.name;
  if (callee.computed && prop?.type === "Literal" && typeof prop.value === "string") {
    return prop.value;
  }
  return void 0;
}
function chainObjectCall(node) {
  const obj = node?.callee?.object;
  return obj?.type === "CallExpression" ? obj : null;
}
function parseSelectColumns(arg) {
  if (arg?.type !== "Literal" || typeof arg.value !== "string") return [];
  return arg.value.split(",").map((c) => c.trim()).filter(Boolean);
}
function isTenantColumnName(name) {
  return /^[a-z][a-z0-9]*_id$/i.test(name) && name.toLowerCase() !== "id";
}
function isTimestampColumnName(name) {
  return /^[a-z][a-z0-9]*_at$/i.test(name);
}
function fromTableName(node) {
  let current = node;
  while (current?.type === "CallExpression") {
    if (memberPropName(current) === "from") {
      const arg = current.arguments?.[0];
      return arg?.type === "Literal" && typeof arg.value === "string" ? arg.value : void 0;
    }
    current = chainObjectCall(current);
  }
  return void 0;
}
function chainHasMethod(node, method) {
  let current = node;
  while (current?.type === "CallExpression") {
    if (memberPropName(current) === method) return true;
    current = chainObjectCall(current);
  }
  return false;
}
function isSupabaseMutationKind(node, kind) {
  if (!chainHasMethod(node, kind)) return false;
  let current = node;
  while (current?.type === "CallExpression") {
    if (memberPropName(current) === "from") return true;
    current = chainObjectCall(current);
  }
  return false;
}
var USER_METADATA_AUTHZ_KEYS = /* @__PURE__ */ new Set([
  "role",
  "roles",
  "admin",
  "is_admin",
  "permission",
  "permissions"
]);
function isUserMetadataAuthzRead(node) {
  if (node?.type !== "MemberExpression") return false;
  const parts = [];
  let current = node;
  while (current?.type === "MemberExpression") {
    const prop = current.property;
    const name = !current.computed && prop?.type === "Identifier" ? prop.name : prop?.type === "Literal" && typeof prop.value === "string" ? prop.value : void 0;
    if (name) parts.unshift(name);
    current = current.object;
  }
  const metaIdx = parts.indexOf("user_metadata");
  if (metaIdx === -1) return false;
  const field = parts[metaIdx + 1];
  return typeof field === "string" && USER_METADATA_AUTHZ_KEYS.has(field);
}
function destructuredNames(pattern) {
  const names = /* @__PURE__ */ new Set();
  if (!pattern) return names;
  if (pattern.type === "Identifier") {
    names.add(pattern.name);
    return names;
  }
  if (pattern.type !== "ObjectPattern") return names;
  for (const prop of pattern.properties ?? []) {
    if (prop?.type === "Property") {
      if (prop.value?.type === "Identifier") names.add(prop.value.name);
      else if (prop.key?.type === "Identifier" && prop.shorthand) names.add(prop.key.name);
      else if (prop.key?.type === "Identifier" && prop.value?.type === "Identifier") {
        names.add(prop.value.name);
      }
    } else if (prop?.type === "RestElement" && prop.argument?.type === "Identifier") {
      names.add(prop.argument.name);
    }
  }
  return names;
}
function resolvePropertyValueName(prop) {
  if (prop?.shorthand && prop.key?.type === "Identifier") return prop.key.name;
  const value = prop?.value;
  if (value?.type === "Identifier") return value.name;
  if (value?.type === "LogicalExpression" && (value.operator === "??" || value.operator === "||")) {
    if (value.left?.type === "Identifier") return value.left.name;
  }
  return void 0;
}
function typeofStringCheckTarget(node) {
  if (node?.type !== "BinaryExpression") return void 0;
  if (node.operator !== "===" && node.operator !== "!==") return void 0;
  const sides = [node.left, node.right];
  const typeofSide = sides.find(
    (s) => s?.type === "UnaryExpression" && s.operator === "typeof" && s.argument?.type === "Identifier"
  );
  const litSide = sides.find((s) => s?.type === "Literal" && s.value === "string");
  if (!typeofSide || !litSide) return void 0;
  return typeofSide.argument.name;
}

// src/providers/supabase/rules/scope-queries-by-tenant-column.ts
var rule14 = {
  meta: {
    type: "suggestion",
    docs: {
      description: "Supabase queries that select a tenant column must filter by it",
      category: "correctness",
      rationale: "A column like session_id or user_id existing in the schema (and being selected) signals intent to scope rows to one caller, but selecting it is not the same as filtering by it. Without an .eq()/.match()/.filter() on that column, the query returns every row for every tenant, turning a per-user feed into a single shared, cross-user one.",
      docsUrl: "https://supabase.com/docs/reference/javascript/eq",
      recommended: true
    },
    messages: {
      missingTenantFilter: 'This query selects "{{column}}" but never filters by it. Add .eq("{{column}}", ...) (or .match()/.filter()) to scope results to the caller.'
    },
    schema: []
  },
  create(context) {
    const chainStates = /* @__PURE__ */ new Map();
    const selectStates = [];
    function recordFilteredColumn(state, name) {
      if (typeof name === "string") state.filteredColumns.add(name);
      else state.filteredColumns.add("*");
    }
    return {
      "CallExpression:exit"(node) {
        const prop = memberPropName(node);
        if (!prop) return;
        const objCall = chainObjectCall(node);
        if (prop === "select" && objCall && memberPropName(objCall) === "from") {
          const columns = parseSelectColumns(node.arguments?.[0]);
          const tenantColumns = columns.filter(isTenantColumnName);
          if (tenantColumns.length === 0) return;
          const state2 = { selectNode: node, tenantColumns, filteredColumns: /* @__PURE__ */ new Set() };
          chainStates.set(node, state2);
          selectStates.push(state2);
          return;
        }
        const state = objCall ? chainStates.get(objCall) : void 0;
        if (!state) return;
        if (prop === "eq" || prop === "filter") {
          const colArg = node.arguments?.[0];
          recordFilteredColumn(state, colArg?.type === "Literal" ? colArg.value : void 0);
        } else if (prop === "match") {
          const objArg = node.arguments?.[0];
          if (objArg?.type === "ObjectExpression") {
            for (const p of objArg.properties ?? []) {
              if (p?.type !== "Property") continue;
              const name = p.key?.type === "Identifier" ? p.key.name : p.key?.type === "Literal" ? p.key.value : void 0;
              recordFilteredColumn(state, name);
            }
          } else {
            recordFilteredColumn(state, void 0);
          }
        }
        chainStates.set(node, state);
      },
      "Program:exit"() {
        for (const state of selectStates) {
          if (state.filteredColumns.has("*")) continue;
          const missing = state.tenantColumns.find((c) => !state.filteredColumns.has(c));
          if (missing) {
            context.report({
              node: state.selectNode,
              messageId: "missingTenantFilter",
              data: { column: missing }
            });
          }
        }
      }
    };
  }
};
var supabaseScopeQueriesByTenantColumnRule = rule14;

// src/providers/supabase/rules/validate-uuid-columns.ts
function regexSourceLooksUuidShaped(pattern) {
  return /[0-9a-f]{2,}/i.test(pattern) && pattern.includes("-");
}
var rule15 = {
  meta: {
    type: "suggestion",
    docs: {
      description: "Columns typed uuid must be validated for UUID shape, not just typeof string",
      category: "correctness",
      rationale: 'typeof === "string" accepts any string, including malformed UUIDs like "abc". When the underlying column is typed uuid, the database rejects it with a generic type-cast error that the app then has to collapse into an opaque 500 \u2014 masking a client-correctable 400 as a server failure. Validating the UUID shape (e.g. with a regex) before the insert lets the app return a precise 400 instead.',
      docsUrl: "https://supabase.com/docs/guides/database/tables#data-types",
      recommended: true
    },
    messages: {
      missingUuidValidation: 'Column "{{column}}" looks UUID-typed but the value is only checked with typeof === "string", not a UUID-shape regex. Validate the format before insert/upsert.'
    },
    schema: []
  },
  create(context) {
    const validations = /* @__PURE__ */ new Map();
    const regexVarPatterns = /* @__PURE__ */ new Map();
    function markValidation(name, key) {
      let v = validations.get(name);
      if (!v) {
        v = { typeofOnly: false, uuidChecked: false };
        validations.set(name, v);
      }
      v[key] = true;
    }
    return {
      VariableDeclarator(node) {
        if (node.id?.type === "Identifier" && node.init?.type === "Literal" && node.init.regex) {
          regexVarPatterns.set(node.id.name, node.init.regex.pattern);
        }
      },
      BinaryExpression(node) {
        const varName = typeofStringCheckTarget(node);
        if (varName) markValidation(varName, "typeofOnly");
      },
      CallExpression(node) {
        const prop = memberPropName(node);
        if (prop === "test") {
          const objNode = node.callee.object;
          let pattern;
          if (objNode?.type === "Literal" && objNode.regex) {
            pattern = objNode.regex.pattern;
          } else if (objNode?.type === "Identifier" && regexVarPatterns.has(objNode.name)) {
            pattern = regexVarPatterns.get(objNode.name);
          }
          if (pattern && regexSourceLooksUuidShaped(pattern)) {
            const arg2 = node.arguments?.[0];
            if (arg2?.type === "Identifier") markValidation(arg2.name, "uuidChecked");
          }
          return;
        }
        if (prop !== "insert" && prop !== "upsert") return;
        const objCall = chainObjectCall(node);
        if (!objCall || memberPropName(objCall) !== "from") return;
        const arg = node.arguments?.[0];
        if (arg?.type !== "ObjectExpression") return;
        for (const p of arg.properties ?? []) {
          if (p?.type !== "Property") continue;
          const keyName = p.key?.type === "Identifier" ? p.key.name : p.key?.type === "Literal" ? p.key.value : void 0;
          if (typeof keyName !== "string" || !isTenantColumnName(keyName)) continue;
          const valueName = resolvePropertyValueName(p);
          if (!valueName) continue;
          const v = validations.get(valueName);
          if (v?.typeofOnly && !v.uuidChecked) {
            context.report({ node: p, messageId: "missingUuidValidation", data: { column: keyName } });
          }
        }
      }
    };
  }
};
var supabaseValidateUuidColumnsRule = rule15;

// src/providers/supabase/rules/order-by-timestamp-not-identity.ts
var rule16 = {
  meta: {
    type: "suggestion",
    docs: {
      description: "Order by a selected timestamp column instead of the identity column",
      category: "correctness",
      rationale: "Ordering by a bigint identity PK only produces correct chronological order because the PK happens to be monotonic with insert order today. That assumption breaks under bulk inserts, backfills, or replication where PK order and time order can diverge. When the query already selects a timestamp column built for this purpose, order by it instead of the surrogate key.",
      docsUrl: "https://supabase.com/docs/reference/javascript/order",
      recommended: true
    },
    messages: {
      orderByIdentity: 'This query selects "{{column}}" but orders by "id" instead. Order by "{{column}}" so result order does not depend on PK/insert-order coincidence.'
    },
    schema: []
  },
  create(context) {
    const chainStates = /* @__PURE__ */ new Map();
    return {
      "CallExpression:exit"(node) {
        const prop = memberPropName(node);
        if (!prop) return;
        const objCall = chainObjectCall(node);
        if (prop === "select" && objCall && memberPropName(objCall) === "from") {
          const columns = parseSelectColumns(node.arguments?.[0]);
          const timestampColumns = columns.filter(isTimestampColumnName);
          chainStates.set(node, { timestampColumns });
          return;
        }
        const state = objCall ? chainStates.get(objCall) : void 0;
        if (!state) return;
        if (prop === "order") {
          const colArg = node.arguments?.[0];
          const orderColumn = colArg?.type === "Literal" ? colArg.value : void 0;
          if (typeof orderColumn === "string" && orderColumn.toLowerCase() === "id" && state.timestampColumns.length > 0) {
            context.report({
              node,
              messageId: "orderByIdentity",
              data: { column: state.timestampColumns[0] }
            });
          }
        }
        chainStates.set(node, state);
      }
    };
  }
};
var supabaseOrderByTimestampNotIdentityRule = rule16;

// src/providers/supabase/rules/consistent-input-length-limits.ts
var rule17 = {
  meta: {
    type: "suggestion",
    docs: {
      description: "Sibling string fields inserted together should share the same length cap discipline",
      category: "correctness",
      rationale: "A field with no length cap on an otherwise-validated, unauthenticated insert path lets a client persist arbitrarily large payloads repeatedly, growing storage with no bound. When sibling fields in the same insert already have explicit length caps, an uncapped field next to them is usually an oversight rather than an intentional choice.",
      docsUrl: "https://supabase.com/docs/guides/database/tables",
      recommended: true
    },
    messages: {
      inconsistentLengthLimit: 'Field "{{field}}" has no length cap, but sibling field "{{cappedField}}" in the same insert does. Add a .length check for "{{field}}" too.'
    },
    schema: []
  },
  create(context) {
    const validations = /* @__PURE__ */ new Map();
    function markValidation(name, key) {
      let v = validations.get(name);
      if (!v) {
        v = { typeofStringChecked: false, hasLengthCap: false };
        validations.set(name, v);
      }
      v[key] = true;
    }
    function lengthCapTarget(node) {
      if (node?.type !== "BinaryExpression") return void 0;
      if (node.operator !== ">" && node.operator !== ">=") return void 0;
      const left = node.left;
      const right = node.right;
      if (left?.type !== "MemberExpression") return void 0;
      if (left.property?.type !== "Identifier" || left.property.name !== "length") return void 0;
      if (left.object?.type !== "Identifier") return void 0;
      if (right?.type !== "Literal" || typeof right.value !== "number") return void 0;
      return left.object.name;
    }
    return {
      BinaryExpression(node) {
        const typeofVar = typeofStringCheckTarget(node);
        if (typeofVar) markValidation(typeofVar, "typeofStringChecked");
        const lengthVar = lengthCapTarget(node);
        if (lengthVar) markValidation(lengthVar, "hasLengthCap");
      },
      CallExpression(node) {
        const prop = memberPropName(node);
        if (prop !== "insert" && prop !== "upsert") return;
        const objCall = chainObjectCall(node);
        if (!objCall || memberPropName(objCall) !== "from") return;
        const arg = node.arguments?.[0];
        if (arg?.type !== "ObjectExpression") return;
        const stringFields = [];
        for (const p of arg.properties ?? []) {
          if (p?.type !== "Property") continue;
          const field = p.key?.type === "Identifier" ? p.key.name : p.key?.type === "Literal" ? p.key.value : void 0;
          if (typeof field !== "string") continue;
          const varName = resolvePropertyValueName(p);
          if (!varName) continue;
          const v = validations.get(varName);
          if (v?.typeofStringChecked) stringFields.push({ propNode: p, field, varName });
        }
        const capped = stringFields.filter((f) => validations.get(f.varName)?.hasLengthCap);
        const uncapped = stringFields.filter((f) => !validations.get(f.varName)?.hasLengthCap);
        if (capped.length === 0 || uncapped.length === 0) return;
        for (const f of uncapped) {
          context.report({
            node: f.propNode,
            messageId: "inconsistentLengthLimit",
            data: { field: f.field, cappedField: capped[0].field }
          });
        }
      }
    };
  }
};
var supabaseConsistentInputLengthLimitsRule = rule17;

// src/providers/supabase/rules/idempotent-mutations.ts
function objectHasIdempotencyKey(objectExpression) {
  if (objectExpression?.type !== "ObjectExpression") return false;
  return (objectExpression.properties ?? []).some((p) => {
    if (p?.type !== "Property") return false;
    const name = p.key?.type === "Identifier" ? p.key.name : p.key?.type === "Literal" ? p.key.value : void 0;
    return typeof name === "string" && /idempot|dedupe/i.test(name);
  });
}
function insertPayloadHasIdempotencyKey(arg) {
  if (arg?.type === "ObjectExpression") return objectHasIdempotencyKey(arg);
  if (arg?.type === "ArrayExpression") {
    return (arg.elements ?? []).some((el) => objectHasIdempotencyKey(el));
  }
  return false;
}
var rule18 = {
  meta: {
    type: "suggestion",
    docs: {
      description: "Supabase insert calls should be retry-safe via an idempotency key",
      category: "reliability",
      rationale: 'Nothing prevents a duplicate row if the client fetch behind an insert is retried (flaky network, double-click, browser replay) \u2014 there is no unique constraint or dedupe key visible in the payload, and no upsert semantics. Generate a client-side idempotency key per logical action and either include it as a field guarded by a unique constraint, or use .upsert(..., { onConflict: "<key column>" }).',
      docsUrl: "https://supabase.com/docs/reference/javascript/upsert",
      recommended: true
    },
    messages: {
      missingIdempotencyKey: 'This insert has no idempotency/dedupe key field, so a retried request can create a duplicate row. Add one, or use .upsert(..., { onConflict: "<key column>" }).'
    },
    schema: []
  },
  create(context) {
    return {
      CallExpression(node) {
        const prop = memberPropName(node);
        if (prop !== "insert") return;
        const objCall = chainObjectCall(node);
        if (!objCall || memberPropName(objCall) !== "from") return;
        const arg = node.arguments?.[0];
        if (!arg) return;
        if (insertPayloadHasIdempotencyKey(arg)) return;
        context.report({ node, messageId: "missingIdempotencyKey" });
      }
    };
  }
};
var supabaseIdempotentMutationsRule = rule18;

// src/providers/supabase/rules/fail-fast-env-validation.ts
function unwrapNonNull(node) {
  return node?.type === "TSNonNullExpression" ? node.expression : node;
}
function processEnvMemberName(node) {
  const n = unwrapNonNull(node);
  if (n?.type !== "MemberExpression" || n.computed) return void 0;
  const obj = n.object;
  if (obj?.type !== "MemberExpression" || obj.computed) return void 0;
  if (obj.object?.type !== "Identifier" || obj.object.name !== "process") return void 0;
  if (obj.property?.type !== "Identifier" || obj.property.name !== "env") return void 0;
  if (n.property?.type !== "Identifier") return void 0;
  return n.property.name;
}
function hasThrowOrReturn(node) {
  if (!node) return false;
  if (node.type === "ThrowStatement" || node.type === "ReturnStatement") return true;
  if (node.type === "BlockStatement") {
    return (node.body ?? []).some((s) => s.type === "ThrowStatement" || s.type === "ReturnStatement");
  }
  return false;
}
var rule19 = {
  meta: {
    type: "suggestion",
    docs: {
      description: "createClient must fail fast when required env vars are missing",
      category: "reliability",
      rationale: "createClient does not throw on undefined arguments \u2014 a missing env var surfaces later as an opaque error deep in a fetch call rather than a clear message at startup. Checking presence before calling createClient turns a confusing runtime failure (e.g. on a misconfigured second service) into an immediate, actionable one.",
      docsUrl: "https://supabase.com/docs/reference/javascript/initializing",
      recommended: true
    },
    messages: {
      missingEnvValidation: "createClient is called with {{vars}} with no presence check beforehand. Throw if it/they are unset before calling createClient."
    },
    schema: []
  },
  create(context) {
    let createClientLocalName;
    const envVarOfVariable = /* @__PURE__ */ new Map();
    const validatedVarNames = /* @__PURE__ */ new Set();
    const validatedEnvNames = /* @__PURE__ */ new Set();
    function addTarget(node) {
      const n = unwrapNonNull(node);
      if (n?.type === "Identifier") {
        validatedVarNames.add(n.name);
        return;
      }
      const envName = processEnvMemberName(n);
      if (envName) validatedEnvNames.add(envName);
    }
    function collectGuardTargets(node) {
      if (!node) return;
      if (node.type === "LogicalExpression" && node.operator === "||") {
        collectGuardTargets(node.left);
        collectGuardTargets(node.right);
        return;
      }
      if (node.type === "UnaryExpression" && node.operator === "!") {
        addTarget(node.argument);
        return;
      }
      if (node.type === "BinaryExpression" && (node.operator === "==" || node.operator === "===")) {
        const sides = [node.left, node.right];
        const isNullish = (n) => n?.type === "Literal" && n.value === null || n?.type === "Identifier" && n.name === "undefined";
        const target = sides.find((s) => !isNullish(s));
        const nullSide = sides.find(isNullish);
        if (target && nullSide) addTarget(target);
      }
    }
    return {
      ImportDeclaration(node) {
        if (node.source?.value !== "@supabase/supabase-js") return;
        for (const s of node.specifiers ?? []) {
          if (s?.type === "ImportSpecifier" && s.imported?.type === "Identifier" && s.imported.name === "createClient" && s.local?.type === "Identifier") {
            createClientLocalName = s.local.name;
          }
        }
      },
      VariableDeclarator(node) {
        if (node.id?.type !== "Identifier") return;
        const envName = processEnvMemberName(node.init);
        if (envName) envVarOfVariable.set(node.id.name, envName);
      },
      IfStatement(node) {
        if (!hasThrowOrReturn(node.consequent)) return;
        collectGuardTargets(node.test);
      },
      CallExpression(node) {
        if (!createClientLocalName) return;
        if (node.callee?.type !== "Identifier" || node.callee.name !== createClientLocalName) return;
        const missing = [];
        for (const rawArg of node.arguments ?? []) {
          const arg = unwrapNonNull(rawArg);
          let envName;
          let isValidated;
          if (arg?.type === "Identifier") {
            envName = envVarOfVariable.get(arg.name);
            if (!envName) continue;
            isValidated = validatedVarNames.has(arg.name);
          } else {
            envName = processEnvMemberName(arg);
            if (!envName) continue;
            isValidated = validatedEnvNames.has(envName);
          }
          if (!isValidated) missing.push(envName);
        }
        if (missing.length > 0) {
          context.report({ node, messageId: "missingEnvValidation", data: { vars: missing.join(", ") } });
        }
      }
    };
  }
};
var supabaseFailFastEnvValidationRule = rule19;

// src/providers/supabase/rules/no-user-metadata-authz.ts
var AUTHZ_DATA_KEYS = /* @__PURE__ */ new Set(["role", "roles", "admin", "is_admin", "permission", "permissions"]);
function objectHasAuthzDataKey(objectExpression) {
  if (objectExpression?.type !== "ObjectExpression") return false;
  return (objectExpression.properties ?? []).some((p) => {
    if (p?.type !== "Property") return false;
    const name = p.shorthand && p.key?.type === "Identifier" ? p.key.name : p.key?.type === "Identifier" ? p.key.name : p.key?.type === "Literal" ? p.key.value : void 0;
    return typeof name === "string" && AUTHZ_DATA_KEYS.has(name);
  });
}
function findAuthDataPayload(args) {
  for (const arg of args) {
    if (arg?.type !== "ObjectExpression") continue;
    for (const p of arg.properties ?? []) {
      if (p?.type !== "Property") continue;
      const key = p.key?.type === "Identifier" ? p.key.name : p.key?.type === "Literal" ? p.key.value : void 0;
      if (key === "data" && p.value?.type === "ObjectExpression") return p.value;
      if (key === "options" && p.value?.type === "ObjectExpression") {
        for (const opt of p.value.properties ?? []) {
          if (opt?.type !== "Property") continue;
          const optKey = opt.key?.type === "Identifier" ? opt.key.name : opt.key?.type === "Literal" ? opt.key.value : void 0;
          if (optKey === "data" && opt.value?.type === "ObjectExpression") return opt.value;
        }
      }
    }
  }
  return null;
}
function isAuthUserMetadataWrite(node) {
  const prop = memberPropName(node);
  if (prop !== "signUp" && prop !== "updateUser") return false;
  const dataPayload = findAuthDataPayload(node.arguments ?? []);
  return dataPayload ? objectHasAuthzDataKey(dataPayload) : false;
}
var rule20 = {
  meta: {
    type: "problem",
    docs: {
      description: "Do not store or read authorization data from user_metadata",
      category: "security",
      cwe: "CWE-285",
      owasp: "A01:2021 Broken Access Control",
      rationale: "Supabase documents raw_user_meta_data as client-writable and unsuitable for authorization. Reading user_metadata.role (or writing role into signUp/updateUser data) lets any signed-in user self-assign privileged roles from the browser. Store roles in app_metadata via a trusted server path, or in an RLS-protected profiles table.",
      docsUrl: "https://supabase.com/docs/guides/database/postgres/row-level-security",
      recommended: true
    },
    messages: {
      userMetadataAuthzRead: "Authorization is read from user_metadata, which the client can modify. Use app_metadata or a server-side role table instead.",
      userMetadataAuthzWrite: "Authorization data is written to user_metadata via signUp/updateUser, which the client can change later. Use app_metadata or a server-side role table instead."
    },
    schema: []
  },
  create(context) {
    return {
      MemberExpression(node) {
        if (isUserMetadataAuthzRead(node)) {
          context.report({ node, messageId: "userMetadataAuthzRead" });
        }
      },
      CallExpression(node) {
        if (isAuthUserMetadataWrite(node)) {
          context.report({ node, messageId: "userMetadataAuthzWrite" });
        }
      }
    };
  }
};
var supabaseNoUserMetadataAuthzRule = rule20;

// src/providers/supabase/rules/single-without-error-check.ts
function isSingleSupabaseQuery(awaitArg) {
  return awaitArg?.type === "CallExpression" && chainHasMethod(awaitArg, "single");
}
var rule21 = {
  meta: {
    type: "suggestion",
    docs: {
      description: "Supabase .single() calls must inspect the returned error field",
      category: "correctness",
      rationale: ".single() signals zero-or-one-row intent via the error field (PGRST116), not by leaving data undefined silently. Destructuring only data and never reading error produces infinite spinners on deleted rows, bad IDs, or RLS-denied reads. Prefer .maybeSingle() or branch on error before rendering.",
      docsUrl: "https://supabase.com/docs/reference/javascript/single",
      recommended: true
    },
    messages: {
      missingErrorCheck: "This .single() result ignores error \u2014 a missing or denied row will look like a perpetual load. Destructure error or use .maybeSingle()."
    },
    schema: []
  },
  create(context) {
    function checkAwaitBinding(node, pattern, awaitExpr) {
      if (!isSingleSupabaseQuery(awaitExpr.argument)) return;
      const names = destructuredNames(pattern);
      if (names.has("error")) return;
      context.report({ node, messageId: "missingErrorCheck" });
    }
    return {
      VariableDeclarator(node) {
        if (node.init?.type !== "AwaitExpression") return;
        checkAwaitBinding(node, node.id, node.init);
      },
      AssignmentExpression(node) {
        if (node.right?.type !== "AwaitExpression") return;
        checkAwaitBinding(node, node.left, node.right);
      },
      ExpressionStatement(node) {
        const expr = node.expression;
        if (expr?.type !== "AwaitExpression") return;
        if (!isSingleSupabaseQuery(expr.argument)) return;
        if (memberPropName(expr.argument) === "single") {
          context.report({ node, messageId: "missingErrorCheck" });
        }
      }
    };
  }
};
var supabaseSingleWithoutErrorCheckRule = rule21;

// src/providers/supabase/rules/non-atomic-replace-pattern.ts
function isSupabaseTableMutation(node, kind) {
  return isSupabaseMutationKind(node, kind);
}
var rule22 = {
  meta: {
    type: "suggestion",
    docs: {
      description: "Supabase delete-then-insert replace patterns should check errors or use RPC",
      category: "correctness",
      rationale: "Replacing child rows by deleting all rows for a user then re-inserting is a common Supabase pattern, but sequential client calls are not transactional. If delete succeeds and a later insert fails, existing rows are gone with no error shown. Wrap both steps in a Postgres RPC function or check error after each call.",
      docsUrl: "https://supabase.com/docs/guides/database/functions",
      recommended: true
    },
    messages: {
      nonAtomicReplace: "This function deletes then re-inserts rows without checking errors \u2014 a failed insert after a successful delete loses data silently."
    },
    schema: []
  },
  create(context) {
    const fnStack = [];
    const mutationsByFunction = /* @__PURE__ */ new Map();
    function currentFunction() {
      return fnStack[fnStack.length - 1];
    }
    function recordMutation(node, awaitExpr, pattern, kind) {
      const fn = currentFunction();
      if (!fn) return;
      if (!isSupabaseTableMutation(awaitExpr.argument, kind)) return;
      const checksError = pattern ? destructuredNames(pattern).has("error") : false;
      const list = mutationsByFunction.get(fn) ?? [];
      list.push({ node, table: fromTableName(awaitExpr.argument), kind, checksError });
      mutationsByFunction.set(fn, list);
    }
    function enterFunction(node) {
      fnStack.push(node);
    }
    function exitFunction(node) {
      const sites = mutationsByFunction.get(node);
      if (sites) {
        const deletes = sites.filter((s) => s.kind === "delete");
        const inserts = sites.filter((s) => s.kind === "insert");
        if (deletes.length > 0 && inserts.length > 0) {
          const uncheckedDelete = deletes.some((d) => !d.checksError);
          const uncheckedInsert = inserts.some((i) => !i.checksError);
          const sameTable = uncheckedDelete && uncheckedInsert && deletes.some((d) => inserts.some((i) => d.table && i.table && d.table === i.table));
          if (sameTable) {
            context.report({ node: inserts[0].node, messageId: "nonAtomicReplace" });
          }
        }
        mutationsByFunction.delete(node);
      }
      fnStack.pop();
    }
    return {
      FunctionDeclaration(node) {
        enterFunction(node);
      },
      "FunctionDeclaration:exit"(node) {
        exitFunction(node);
      },
      FunctionExpression(node) {
        enterFunction(node);
      },
      "FunctionExpression:exit"(node) {
        exitFunction(node);
      },
      ArrowFunctionExpression(node) {
        enterFunction(node);
      },
      "ArrowFunctionExpression:exit"(node) {
        exitFunction(node);
      },
      VariableDeclarator(node) {
        if (node.init?.type !== "AwaitExpression") return;
        const arg = node.init.argument;
        if (isSupabaseTableMutation(arg, "delete")) recordMutation(node, node.init, node.id, "delete");
        if (isSupabaseTableMutation(arg, "insert")) recordMutation(node, node.init, node.id, "insert");
      },
      ExpressionStatement(node) {
        const expr = node.expression;
        if (expr?.type !== "AwaitExpression") return;
        const arg = expr.argument;
        if (isSupabaseTableMutation(arg, "delete")) recordMutation(node, expr, void 0, "delete");
        if (isSupabaseTableMutation(arg, "insert")) recordMutation(node, expr, void 0, "insert");
      }
    };
  }
};
var supabaseNonAtomicReplacePatternRule = rule22;

// src/providers/supabase/rules/unchecked-mutation-error.ts
var MUTATIONS = ["insert", "update", "delete", "upsert"];
function isSupabaseMutationCall(node) {
  return MUTATIONS.some((kind) => isSupabaseMutationKind(node, kind));
}
var rule23 = {
  meta: {
    type: "suggestion",
    docs: {
      description: "Supabase mutations must check the returned error field",
      category: "correctness",
      rationale: "Unlike fetch(), Supabase client mutations return { data, error } and resolve even when RLS denies the write or a constraint fails. Fire-and-forget awaits or destructuring only data lets optimistic UI state diverge from the database with no toast or rollback.",
      docsUrl: "https://supabase.com/docs/reference/javascript/insert",
      recommended: true
    },
    messages: {
      uncheckedMutation: "This Supabase mutation never checks error \u2014 RLS denials and constraint failures will be silent."
    },
    schema: []
  },
  create(context) {
    function checkMutationAwait(node, pattern, awaitExpr) {
      if (!isSupabaseMutationCall(awaitExpr.argument)) return;
      if (!pattern) {
        context.report({ node, messageId: "uncheckedMutation" });
        return;
      }
      const names = destructuredNames(pattern);
      if (!names.has("error")) {
        context.report({ node, messageId: "uncheckedMutation" });
      }
    }
    return {
      ExpressionStatement(node) {
        const expr = node.expression;
        if (expr?.type !== "AwaitExpression") return;
        checkMutationAwait(node, void 0, expr);
      },
      VariableDeclarator(node) {
        if (node.init?.type !== "AwaitExpression") return;
        checkMutationAwait(node, node.id, node.init);
      },
      AssignmentExpression(node) {
        if (node.right?.type !== "AwaitExpression") return;
        checkMutationAwait(node, node.left, node.right);
      }
    };
  }
};
var supabaseUncheckedMutationErrorRule = rule23;

// src/providers/supabase/rules/realtime-missing-filter.ts
var rule24 = {
  meta: {
    type: "suggestion",
    docs: {
      description: "Supabase Realtime postgres_changes subscriptions should use a filter",
      category: "reliability",
      rationale: "Listening to postgres_changes on an entire table without a filter means every insert/update/delete by any user triggers the callback on every connected client. RLS still scopes the data, but the refetch storm scales with concurrent users and will degrade under real load. Scope subscriptions with the documented filter option (e.g. receiver_id=eq.{id}).",
      docsUrl: "https://supabase.com/docs/guides/realtime/postgres-changes#filtering",
      recommended: true
    },
    messages: {
      missingFilter: "This Realtime postgres_changes subscription has no filter and will fire on every row change in the table."
    },
    schema: []
  },
  create(context) {
    return {
      CallExpression(node) {
        if (memberPropName(node) !== "on") return;
        const eventArg = node.arguments?.[0];
        if (eventArg?.type !== "Literal" || eventArg.value !== "postgres_changes") return;
        const options = node.arguments?.[1];
        if (options?.type !== "ObjectExpression") return;
        const hasFilter = (options.properties ?? []).some((p) => {
          if (p?.type !== "Property") return false;
          const key = p.key?.type === "Identifier" ? p.key.name : p.key?.type === "Literal" ? p.key.value : void 0;
          return key === "filter";
        });
        if (!hasFilter) {
          context.report({ node, messageId: "missingFilter" });
        }
      }
    };
  }
};
var supabaseRealtimeMissingFilterRule = rule24;

// src/providers/supabase/rules/storage-error-not-surfaced.ts
function isStorageUploadCall(node) {
  let current = node;
  let sawStorage = false;
  let sawUpload = false;
  while (current?.type === "CallExpression") {
    const prop = memberPropName(current);
    if (prop === "storage") sawStorage = true;
    if (prop === "upload") sawUpload = true;
    current = chainObjectCall(current);
  }
  return sawStorage && sawUpload;
}
var rule25 = {
  meta: {
    type: "suggestion",
    docs: {
      description: "Supabase storage upload errors must be surfaced to the user",
      category: "reliability",
      rationale: "Storage uploads return { error } without throwing. An if (!uploadError) block with no else lets the caller fall through to a profile save and success toast even when the file never uploaded \u2014 the user only notices later that their avatar or resume did not change.",
      docsUrl: "https://supabase.com/docs/reference/javascript/storage-from-upload",
      recommended: true
    },
    messages: {
      uploadErrorNotSurfaced: "Storage upload failure is ignored when uploadError is set \u2014 add an else branch to stop and show an error."
    },
    schema: []
  },
  create(context) {
    const uploadAwaitVars = /* @__PURE__ */ new Set();
    return {
      VariableDeclarator(node) {
        if (node.init?.type !== "AwaitExpression") return;
        if (!isStorageUploadCall(node.init.argument)) return;
        if (node.id?.type === "ObjectPattern") {
          for (const p of node.id.properties ?? []) {
            if (p?.type !== "Property") continue;
            if (p.key?.type === "Identifier" && p.key.name === "error" && p.value?.type === "Identifier") {
              uploadAwaitVars.add(p.value.name);
            }
          }
        }
      },
      IfStatement(node) {
        const test = node.test;
        if (test?.type !== "UnaryExpression" || test.operator !== "!") return;
        const arg = test.argument;
        if (arg?.type !== "Identifier") return;
        if (!uploadAwaitVars.has(arg.name) && !/uploadError|uploadErr/i.test(arg.name)) return;
        if (node.alternate) return;
        context.report({ node, messageId: "uploadErrorNotSurfaced" });
      },
      "Program:exit"() {
        uploadAwaitVars.clear();
      }
    };
  }
};
var supabaseStorageErrorNotSurfacedRule = rule25;

// src/providers/auth0/rules/required-audience-validation.ts
var rule26 = {
  meta: {
    type: "problem",
    docs: {
      description: "Auth0 JWT verification must require audience validation, not skip it when unconfigured",
      category: "security",
      cwe: "CWE-345",
      owasp: "API2:2023 Broken Authentication",
      rationale: "Signature and issuer checks alone only prove a token was signed by the Auth0 tenant \u2014 they do not prove the token was issued for this API. Without a mandatory audience check, any validly signed token from the same tenant (including one issued for a completely different application) will authenticate successfully. If the audience check is only applied when a config value happens to be set, a misconfiguration silently disables it instead of failing closed.",
      docsUrl: "https://auth0.com/docs/secure/tokens/json-web-tokens/validate-json-web-tokens",
      recommended: true
    },
    messages: {
      missingAudience: "Auth0 JWT verification is configured without an audience check \u2014 any token signed by this tenant, regardless of which API it was issued for, will be accepted.",
      conditionalAudience: "Audience validation is only applied conditionally here \u2014 if the underlying config value is ever unset, the check silently disappears instead of failing closed."
    }
  },
  create(context) {
    const jwtImportNames = /* @__PURE__ */ new Set();
    const expressJwtImportNames = /* @__PURE__ */ new Set();
    function isRS256Algorithms(node) {
      if (node?.type !== "ArrayExpression") return false;
      return (node.elements ?? []).some(
        (el) => el?.type === "Literal" && el.value === "RS256"
      );
    }
    function isAuth0StyleOptions(objectExpr) {
      if (objectExpr?.type !== "ObjectExpression") return false;
      let hasRS256 = false;
      let hasIssuer = false;
      for (const prop of objectExpr.properties ?? []) {
        if (prop?.type !== "Property") continue;
        const keyName = prop.key?.type === "Identifier" ? prop.key.name : prop.key?.value;
        if (keyName === "algorithms" && isRS256Algorithms(prop.value)) hasRS256 = true;
        if (keyName === "issuer") hasIssuer = true;
      }
      return hasRS256 && hasIssuer;
    }
    function checkAudience(objectExpr) {
      let sawAudienceProperty = false;
      let sawConditionalSpread = false;
      for (const prop of objectExpr.properties ?? []) {
        if (prop?.type === "Property") {
          const keyName = prop.key?.type === "Identifier" ? prop.key.name : prop.key?.value;
          if (keyName === "audience") sawAudienceProperty = true;
        }
        if (prop?.type === "SpreadElement" && prop.argument?.type === "ConditionalExpression") {
          sawConditionalSpread = true;
        }
      }
      if (sawAudienceProperty) return "ok";
      if (sawConditionalSpread) return "conditional";
      return "missing";
    }
    function reportIfBad(objectExpr, reportNode) {
      if (!isAuth0StyleOptions(objectExpr)) return;
      const result = checkAudience(objectExpr);
      if (result === "missing") {
        context.report({ node: reportNode, messageId: "missingAudience" });
      } else if (result === "conditional") {
        context.report({ node: reportNode, messageId: "conditionalAudience" });
      }
    }
    return {
      ImportDeclaration(node) {
        const importSource = node?.source?.value;
        if (importSource === "jsonwebtoken") {
          for (const s of node.specifiers ?? []) {
            if ((s?.type === "ImportDefaultSpecifier" || s?.type === "ImportNamespaceSpecifier") && s.local?.type === "Identifier") {
              jwtImportNames.add(s.local.name);
            }
          }
        }
        if (importSource === "express-jwt") {
          for (const s of node.specifiers ?? []) {
            if (s?.local?.type === "Identifier") expressJwtImportNames.add(s.local.name);
          }
        }
      },
      CallExpression(node) {
        const callee = node?.callee;
        if (callee?.type === "MemberExpression" && callee.property?.type === "Identifier" && callee.property.name === "verify" && callee.object?.type === "Identifier" && jwtImportNames.has(callee.object.name)) {
          const optionsArg = node.arguments?.[2];
          if (optionsArg) reportIfBad(optionsArg, node);
          return;
        }
        if (callee?.type === "Identifier" && expressJwtImportNames.has(callee.name)) {
          const optionsArg = node.arguments?.[0];
          if (optionsArg) reportIfBad(optionsArg, node);
        }
      }
    };
  }
};
var auth0RequiredAudienceValidationRule = rule26;

// src/providers/auth0/rules/no-account-link-without-verified-email.ts
var CLAIMS_LIKE_NAMES = /* @__PURE__ */ new Set([
  "claims",
  "decoded",
  "payload",
  "profile",
  "userinfo",
  "userInfo",
  "idTokenClaims",
  "tokenClaims"
]);
var LOOKUP_METHODS = /* @__PURE__ */ new Set(["findOne", "findUnique", "findFirst"]);
var rule27 = {
  meta: {
    type: "problem",
    docs: {
      description: "Account-linking lookups keyed on an email claim must verify email_verified first",
      category: "security",
      cwe: "CWE-290",
      owasp: "API2:2023 Broken Authentication",
      rationale: "By default, Auth0 access tokens carry no email claim at all \u2014 the email most apps trust arrives via a custom namespaced claim or the /userinfo fallback, neither of which is cryptographically tied to proof of ownership the way `sub` is. Using that email to look up and re-link an existing account, without first checking `email_verified`, lets an attacker who controls (or can register) an Auth0 identity with an unverified or spoofed email silently take over any existing account that happens to share it.",
      docsUrl: "https://auth0.com/docs/manage-users/user-accounts/user-account-linking",
      recommended: true
    },
    messages: {
      unverifiedEmailLink: "This account lookup is keyed on an email claim, but nothing in this function checks email_verified first \u2014 an unverified or attacker-supplied email can silently take over an existing account."
    }
  },
  create(context) {
    const stack = [];
    const states = /* @__PURE__ */ new Map();
    function ensureState(fn) {
      let s = states.get(fn);
      if (!s) {
        s = { sawLookup: false, lookupNode: null, sawVerified: false };
        states.set(fn, s);
      }
      return s;
    }
    function top() {
      return stack[stack.length - 1];
    }
    function pushScope(node) {
      stack.push(node);
      ensureState(node);
    }
    function popScope() {
      stack.pop();
    }
    function propName2(node) {
      if (!node) return void 0;
      if (node.type === "Identifier") return node.name;
      if (node.type === "Literal" && typeof node.value === "string") return node.value;
      return void 0;
    }
    function isEmailFromClaims(node) {
      if (node?.type !== "MemberExpression") return false;
      const propertyName = node.computed ? propName2(node.property) : node.property?.name;
      if (propertyName !== "email") return false;
      const obj = node.object;
      return obj?.type === "Identifier" && CLAIMS_LIKE_NAMES.has(obj.name);
    }
    function objectHasEmailFromClaims(objExpr) {
      if (objExpr?.type !== "ObjectExpression") return false;
      for (const prop of objExpr.properties ?? []) {
        if (prop?.type !== "Property") continue;
        const keyName = propName2(prop.key);
        if (keyName === "email" && isEmailFromClaims(prop.value)) return true;
        if (keyName === "where" && objectHasEmailFromClaims(prop.value)) return true;
      }
      return false;
    }
    function markVerifiedSeen(name) {
      if (!name || !name.includes("email_verified")) return;
      const fn = top();
      if (fn) ensureState(fn).sawVerified = true;
    }
    return {
      Program(node) {
        pushScope(node);
      },
      "Program:exit"() {
        for (const state of states.values()) {
          if (state.sawLookup && !state.sawVerified) {
            context.report({ node: state.lookupNode, messageId: "unverifiedEmailLink" });
          }
        }
      },
      FunctionDeclaration(node) {
        pushScope(node);
      },
      "FunctionDeclaration:exit"() {
        popScope();
      },
      FunctionExpression(node) {
        pushScope(node);
      },
      "FunctionExpression:exit"() {
        popScope();
      },
      ArrowFunctionExpression(node) {
        pushScope(node);
      },
      "ArrowFunctionExpression:exit"() {
        popScope();
      },
      CallExpression(node) {
        const callee = node?.callee;
        if (callee?.type !== "MemberExpression") return;
        const methodName = callee.property?.name;
        if (!methodName || !LOOKUP_METHODS.has(methodName)) return;
        const arg = node.arguments?.[0];
        if (!objectHasEmailFromClaims(arg)) return;
        const fn = top();
        if (!fn) return;
        const state = ensureState(fn);
        state.sawLookup = true;
        state.lookupNode = node;
      },
      MemberExpression(node) {
        const propertyName = node.computed ? propName2(node.property) : node.property?.name;
        markVerifiedSeen(propertyName);
      },
      Literal(node) {
        if (typeof node.value === "string") markVerifiedSeen(node.value);
      }
    };
  }
};
var auth0NoAccountLinkWithoutVerifiedEmailRule = rule27;

// src/providers/auth0/rules/dead-claim-verification-check.ts
var rule28 = {
  meta: {
    type: "problem",
    docs: {
      description: "A stringified boolean OIDC claim is checked with .includes() against a substring it can never contain",
      category: "correctness",
      rationale: 'Boolean OIDC claims like email_verified/phone_verified stringify to exactly "true" or "false". A .includes() check against any other substring is always false, so the guard this code appears to implement never runs \u2014 silently disabling whatever verification it was meant to perform.',
      docsUrl: "https://auth0.com/docs/secure/tokens/json-web-tokens/json-web-token-claims",
      recommended: true
    },
    messages: {
      deadVerificationCheck: 'Stringifying this boolean claim only ever produces "true" or "false" \u2014 checking .includes("{{substring}}") against it is always false and never executes its guarded branch.'
    }
  },
  create(context) {
    function propName2(node) {
      if (!node) return void 0;
      if (node.type === "Identifier") return node.name;
      if (node.type === "Literal" && typeof node.value === "string") return node.value;
      return void 0;
    }
    function isBooleanClaimMember(node) {
      if (node?.type !== "MemberExpression") return false;
      const name = propName2(node.property);
      return typeof name === "string" && name.toLowerCase().endsWith("_verified");
    }
    function stringifiedClaimArg(callExpr) {
      if (callExpr?.type !== "CallExpression") return false;
      if (callExpr.callee?.type !== "Identifier" || callExpr.callee.name !== "String") return false;
      const arg = callExpr.arguments?.[0];
      if (isBooleanClaimMember(arg)) return true;
      if (arg?.type === "LogicalExpression" && arg.operator === "??") {
        return isBooleanClaimMember(arg.left);
      }
      return false;
    }
    function isClaimToStringCall(callExpr) {
      if (callExpr?.type !== "CallExpression") return false;
      const callee = callExpr.callee;
      if (callee?.type !== "MemberExpression") return false;
      if (callee.property?.name !== "toString") return false;
      return isBooleanClaimMember(callee.object);
    }
    return {
      CallExpression(node) {
        const callee = node?.callee;
        if (callee?.type !== "MemberExpression") return;
        if (callee.property?.name !== "includes") return;
        const subject = callee.object;
        const isDeadShape = stringifiedClaimArg(subject) || isClaimToStringCall(subject);
        if (!isDeadShape) return;
        const substringArg = node.arguments?.[0];
        if (substringArg?.type !== "Literal" || typeof substringArg.value !== "string") return;
        if (substringArg.value === "true" || substringArg.value === "false") return;
        context.report({
          node,
          messageId: "deadVerificationCheck",
          data: { substring: substringArg.value }
        });
      }
    };
  }
};
var auth0DeadClaimVerificationCheckRule = rule28;

// src/providers/auth0/rules/jwks-refresh-on-unknown-kid.ts
var rule29 = {
  meta: {
    type: "problem",
    docs: {
      description: "A hand-rolled JWKS key resolver must retry with a forced refresh when a kid is not found in the cache",
      category: "reliability",
      rationale: "On signing-key rotation, Auth0 immediately starts issuing tokens signed with a new key while the old key stays valid in parallel. A worker whose local JWKS cache predates the rotation has the old key but not the new one, so every newly issued token fails to validate until that worker's cache naturally expires \u2014 up to the full TTL. Retrying with a forced refresh on a kid miss (instead of failing immediately) closes that window.",
      docsUrl: "https://auth0.com/docs/get-started/tenant-settings/signing-keys/rotate-signing-keys",
      recommended: true
    },
    messages: {
      noRefreshOnMiss: "This kid lookup has no retry-with-forced-refresh path. If the cached JWKS predates a key rotation, every token signed with the new key fails until the cache naturally expires."
    }
  },
  create(context) {
    const fnStates = [];
    function nodeStartPos(n) {
      const rangeStart = typeof n?.range?.[0] === "number" ? n.range[0] : null;
      const line = n?.loc?.start?.line ?? 1;
      const column = n?.loc?.start?.column ?? 0;
      return { offset: rangeStart ?? line * 1e6 + column, line, column };
    }
    function nodeEndPos(n) {
      const rangeEnd = typeof n?.range?.[1] === "number" ? n.range[1] : null;
      const line = n?.loc?.end?.line ?? n?.loc?.start?.line ?? 1;
      const column = n?.loc?.end?.column ?? n?.loc?.start?.column ?? 0;
      return { offset: rangeEnd ?? line * 1e6 + column, line, column };
    }
    function within(state, n) {
      const p = nodeStartPos(n);
      return p.offset >= state.start.offset && p.offset <= state.end.offset;
    }
    function collectTopLevelFunctions(programNode) {
      const fns = [];
      for (const stmt of programNode.body ?? []) {
        const decl = stmt?.type === "ExportNamedDeclaration" && stmt.declaration ? stmt.declaration : stmt;
        if (decl?.type === "FunctionDeclaration") {
          fns.push(decl);
        } else if (decl?.type === "VariableDeclaration") {
          for (const d of decl.declarations ?? []) {
            if (d?.init?.type === "ArrowFunctionExpression" || d?.init?.type === "FunctionExpression") {
              fns.push(d.init);
            }
          }
        }
      }
      return fns;
    }
    function propName2(node) {
      if (!node) return void 0;
      if (node.type === "Identifier") return node.name;
      if (node.type === "Literal" && typeof node.value === "string") return node.value;
      return void 0;
    }
    function isKidMember(node) {
      if (node?.type !== "MemberExpression") return false;
      return propName2(node.property) === "kid";
    }
    function isJwksFetchCallee(node) {
      return node?.type === "Identifier" && /jwks/i.test(node.name);
    }
    function callIndicatesForceRefresh(node) {
      for (const arg of node.arguments ?? []) {
        if (arg?.type === "Literal" && arg.value === true) return true;
        if (arg?.type === "ObjectExpression") {
          for (const prop of arg.properties ?? []) {
            if (prop?.type !== "Property") continue;
            const keyName = propName2(prop.key);
            if ((keyName === "forceRefresh" || keyName === "force" || keyName === "bypassCache") && prop.value?.type === "Literal" && prop.value.value === true) {
              return true;
            }
          }
        }
      }
      return false;
    }
    function stateFor(node) {
      return fnStates.find((s) => within(s, node));
    }
    return {
      Program(node) {
        for (const fn of collectTopLevelFunctions(node)) {
          fnStates.push({
            node: fn,
            start: nodeStartPos(fn),
            end: nodeEndPos(fn),
            findCallNode: null,
            sawKidComparison: false,
            fetchCallCount: 0,
            sawForceRefresh: false
          });
        }
      },
      CallExpression(node) {
        const state = stateFor(node);
        if (!state) return;
        const callee = node.callee;
        if (callee?.type === "MemberExpression" && callee.property?.name === "find") {
          if (!state.findCallNode) state.findCallNode = node;
        }
        if (isJwksFetchCallee(callee)) {
          state.fetchCallCount += 1;
          if (callIndicatesForceRefresh(node)) state.sawForceRefresh = true;
        }
      },
      BinaryExpression(node) {
        if (node.operator !== "===" && node.operator !== "==") return;
        const state = stateFor(node);
        if (!state) return;
        if (isKidMember(node.left) || isKidMember(node.right)) {
          state.sawKidComparison = true;
        }
      },
      "Program:exit"() {
        for (const state of fnStates) {
          if (!state.findCallNode || !state.sawKidComparison) continue;
          if (state.sawForceRefresh) continue;
          if (state.fetchCallCount >= 2) continue;
          context.report({ node: state.findCallNode, messageId: "noRefreshOnMiss" });
        }
      }
    };
  }
};
var auth0JwksRefreshOnUnknownKidRule = rule29;

// src/providers/firebase/utils.ts
function namedImportsFrom(node, sourceValue) {
  const map = /* @__PURE__ */ new Map();
  if (node?.type !== "ImportDeclaration" || node.source?.value !== sourceValue) return map;
  for (const s of node.specifiers ?? []) {
    if (s?.type === "ImportSpecifier" && s.imported?.type === "Identifier" && s.local?.type === "Identifier") {
      map.set(s.imported.name, s.local.name);
    }
  }
  return map;
}
function namespaceImportFrom(node, sourceValue) {
  if (node?.type !== "ImportDeclaration" || node.source?.value !== sourceValue) return void 0;
  for (const s of node.specifiers ?? []) {
    if (s?.type === "ImportNamespaceSpecifier" && s.local?.type === "Identifier") return s.local.name;
  }
  return void 0;
}
function isIdentifierCall(node, name) {
  if (!name) return false;
  return node?.type === "CallExpression" && node.callee?.type === "Identifier" && node.callee.name === name;
}
function isNamespaceMemberCall(node, objName, name) {
  if (!objName) return false;
  if (node?.type !== "CallExpression" || node.callee?.type !== "MemberExpression") return false;
  const callee = node.callee;
  if (callee.computed) return false;
  return callee.object?.type === "Identifier" && callee.object.name === objName && callee.property?.type === "Identifier" && callee.property.name === name;
}
function memberPropName2(node) {
  if (node?.type !== "CallExpression") return void 0;
  const callee = node.callee;
  if (callee?.type !== "MemberExpression") return void 0;
  const prop = callee.property;
  if (!callee.computed && prop?.type === "Identifier") return prop.name;
  if (callee.computed && prop?.type === "Literal" && typeof prop.value === "string") return prop.value;
  return void 0;
}
function chainObjectCall2(node) {
  const obj = node?.callee?.object;
  return obj?.type === "CallExpression" ? obj : null;
}
function chainLinks(node) {
  const links = [];
  let current = node;
  while (current?.type === "CallExpression") {
    links.push(current);
    current = chainObjectCall2(current);
  }
  return links;
}
function startOffset2(n) {
  if (typeof n?.range?.[0] === "number") return n.range[0];
  if (typeof n?.start === "number") return n.start;
  return (n?.loc?.start?.line ?? 0) * 1e6 + (n?.loc?.start?.column ?? 0);
}
function endOffset2(n) {
  if (typeof n?.range?.[1] === "number") return n.range[1];
  if (typeof n?.end === "number") return n.end;
  return (n?.loc?.end?.line ?? n?.loc?.start?.line ?? 0) * 1e6 + (n?.loc?.end?.column ?? 0);
}
function contains2(outer, inner) {
  const s = startOffset2(inner);
  return s >= startOffset2(outer) && s <= endOffset2(outer);
}
function someDescendant(node, predicate) {
  let found = false;
  function visit(n) {
    if (found || !n || typeof n !== "object") return;
    if (Array.isArray(n)) {
      for (const item of n) visit(item);
      return;
    }
    if (typeof n.type !== "string") return;
    if (predicate(n)) {
      found = true;
      return;
    }
    for (const key of Object.keys(n)) {
      if (key === "parent" || key === "loc" || key === "range") continue;
      visit(n[key]);
    }
  }
  visit(node);
  return found;
}
function isUidMemberAccess(node, objName) {
  const n = node?.type === "ChainExpression" ? node.expression : node;
  if (n?.type !== "MemberExpression" || n.computed) return false;
  return n.object?.type === "Identifier" && n.object.name === objName && n.property?.type === "Identifier" && n.property.name === "uid";
}
function comparesIdentifier(node, name) {
  if (node?.type !== "BinaryExpression") return false;
  if (node.operator !== "===" && node.operator !== "==") return false;
  return [node.left, node.right].some((s) => s?.type === "Identifier" && s.name === name);
}
function isInsideTestFile2(filename) {
  return /(^|[\\/])__tests__[\\/]|\.(test|spec)\.[cm]?[jt]sx?$/.test(filename);
}

// src/providers/firebase/rules/missing-app-check.ts
var rule30 = {
  meta: {
    type: "suggestion",
    docs: {
      description: "Firebase app initialization should configure App Check",
      category: "security",
      cwe: "CWE-285",
      owasp: "A04:2021 Insecure Design",
      rationale: "Firebase web API keys are public by design and only identify the project to Google's backend \u2014 they are not a secret. The only things standing between an attacker who clones the client config and your database/auth quota are Security Rules and App Check. A file that calls initializeApp but never initializeAppCheck leaves App Check unconfigured, so any client presenting a valid project config (not necessarily yours) can reach Firebase Auth and, subject to rules, the database.",
      docsUrl: "https://firebase.google.com/docs/database/web/start",
      recommended: true
    },
    messages: {
      missingAppCheck: "This file initializes the Firebase app but never calls initializeAppCheck. Without App Check, only Security Rules gate access to a publicly-knowable project config."
    },
    schema: []
  },
  create(context) {
    if (isInsideTestFile2(String(context.filename ?? ""))) {
      return {};
    }
    let initializeAppLocalName;
    let initializeAppCheckLocalName;
    let appCheckNamespace;
    let initializeAppCallNode;
    let sawAppCheckCall = false;
    return {
      ImportDeclaration(node) {
        const appImports = namedImportsFrom(node, "firebase/app");
        if (appImports.has("initializeApp")) initializeAppLocalName = appImports.get("initializeApp");
        const appCheckImports = namedImportsFrom(node, "firebase/app-check");
        if (appCheckImports.has("initializeAppCheck")) {
          initializeAppCheckLocalName = appCheckImports.get("initializeAppCheck");
        }
        const ns = namespaceImportFrom(node, "firebase/app-check");
        if (ns) appCheckNamespace = ns;
      },
      CallExpression(node) {
        if (!initializeAppCallNode && isIdentifierCall(node, initializeAppLocalName)) {
          initializeAppCallNode = node;
        }
        if (isIdentifierCall(node, initializeAppCheckLocalName)) sawAppCheckCall = true;
        if (isNamespaceMemberCall(node, appCheckNamespace, "initializeAppCheck")) sawAppCheckCall = true;
      },
      "Program:exit"() {
        if (initializeAppCallNode && !sawAppCheckCall) {
          context.report({ node: initializeAppCallNode, messageId: "missingAppCheck" });
        }
      }
    };
  }
};
var firebaseMissingAppCheckRule = rule30;

// src/providers/firebase/rules/unhandled-auth-popup-rejection.ts
var rule31 = {
  meta: {
    type: "problem",
    docs: {
      description: "signInWithPopup calls must handle rejection",
      category: "correctness",
      rationale: "signInWithPopup rejects with auth/popup-closed-by-user, auth/popup-blocked, and auth/cancelled-popup-request \u2014 all common, expected outcomes, not edge cases. Without a try/catch (or a chained .catch), the rejection is unhandled: loading state set before the call never clears, and the user has no way to retry without reloading the page.",
      docsUrl: "https://firebase.google.com/docs/auth/web/google-signin",
      recommended: true
    },
    messages: {
      unhandledPopupRejection: "signInWithPopup is called with no try/catch and no chained .catch. Popup-closed and popup-blocked are expected rejections, not edge cases."
    },
    schema: []
  },
  create(context) {
    let signInLocalName;
    const calls = [];
    const tryBlocks = [];
    const caughtCalls = /* @__PURE__ */ new Set();
    return {
      ImportDeclaration(node) {
        const imports = namedImportsFrom(node, "firebase/auth");
        if (imports.has("signInWithPopup")) signInLocalName = imports.get("signInWithPopup");
      },
      TryStatement(node) {
        if (node.block) tryBlocks.push(node.block);
      },
      CallExpression(node) {
        if (isIdentifierCall(node, signInLocalName)) {
          calls.push(node);
          return;
        }
        const prop = memberPropName2(node);
        const isCatch = prop === "catch";
        const isTwoArgThen = prop === "then" && (node.arguments ?? []).length >= 2;
        if (!isCatch && !isTwoArgThen) return;
        for (const link of chainLinks(node)) {
          if (isIdentifierCall(link, signInLocalName)) caughtCalls.add(link);
        }
      },
      "Program:exit"() {
        for (const call of calls) {
          if (caughtCalls.has(call)) continue;
          if (tryBlocks.some((block) => contains2(block, call))) continue;
          context.report({ node: call, messageId: "unhandledPopupRejection" });
        }
      }
    };
  }
};
var firebaseUnhandledAuthPopupRejectionRule = rule31;

// src/providers/firebase/rules/rtdb-list-read-for-single-item.ts
function isSetterName(name) {
  return /^set[A-Z]/.test(name);
}
function stateVarFromSetter(name) {
  return name.slice(3, 4).toLowerCase() + name.slice(4);
}
var rule32 = {
  meta: {
    type: "suggestion",
    docs: {
      description: "Pages keyed by a single id should not subscribe to the whole collection",
      category: "correctness",
      rationale: 'Subscribing to an entire collection and then Array.prototype.find()-ing by a route id param means the page renders a false "not found" state until the full list streams in, and downloads every row the user has just to read one. Use a single-node read/subscribe (ref(db, `path/${id}`)) instead.',
      docsUrl: "https://firebase.google.com/docs/database/web/read-and-write",
      recommended: true
    },
    messages: {
      listReadForSingleItem: "This subscribes to a whole collection and finds one item by a route id param. Read/subscribe to that single node directly instead."
    },
    schema: []
  },
  create(context) {
    let idParamName;
    const listStateVars = /* @__PURE__ */ new Set();
    const findCalls = [];
    return {
      VariableDeclarator(node) {
        if (node.init?.type === "CallExpression" && node.init.callee?.type === "Identifier" && node.init.callee.name === "useParams" && node.id?.type === "ObjectPattern") {
          for (const p of node.id.properties ?? []) {
            if (p?.type === "Property" && p.value?.type === "Identifier" && /id$/i.test(p.value.name)) {
              idParamName = p.value.name;
            }
          }
        }
      },
      CallExpression(node) {
        for (const arg of node.arguments ?? []) {
          if (arg?.type === "Identifier" && isSetterName(arg.name)) {
            listStateVars.add(stateVarFromSetter(arg.name));
          }
        }
        if (node.callee?.type !== "MemberExpression" || node.callee.computed) return;
        if (node.callee.property?.type !== "Identifier" || node.callee.property.name !== "find") return;
        const obj = node.callee.object;
        if (obj?.type !== "Identifier") return;
        findCalls.push({ node, objectName: obj.name, callback: node.arguments?.[0] });
      },
      "Program:exit"() {
        if (!idParamName) return;
        for (const { node, objectName, callback } of findCalls) {
          if (!listStateVars.has(objectName)) continue;
          if (!callback) continue;
          if (someDescendant(callback, (n) => comparesIdentifier(n, idParamName))) {
            context.report({ node, messageId: "listReadForSingleItem" });
          }
        }
      }
    };
  }
};
var firebaseRtdbListReadForSingleItemRule = rule32;

// src/providers/firebase/rules/unvalidated-external-data-to-rtdb.ts
function isJsonParseCall(node) {
  return node?.type === "CallExpression" && node.callee?.type === "MemberExpression" && !node.callee.computed && node.callee.object?.type === "Identifier" && node.callee.object.name === "JSON" && node.callee.property?.type === "Identifier" && node.callee.property.name === "parse";
}
function isResponseJsonCall(node) {
  return node?.type === "CallExpression" && node.callee?.type === "MemberExpression" && !node.callee.computed && node.callee.property?.type === "Identifier" && node.callee.property.name === "json" && (node.arguments ?? []).length === 0;
}
function isValidationLikeCall(node) {
  if (node?.type !== "CallExpression") return false;
  const callee = node.callee;
  const name = callee?.type === "Identifier" ? callee.name : callee?.type === "MemberExpression" && !callee.computed && callee.property?.type === "Identifier" ? callee.property.name : void 0;
  if (!name) return false;
  return /valid|^test$|check|assert|schema/i.test(name);
}
var rule33 = {
  meta: {
    type: "problem",
    docs: {
      description: "Parsed external data must be validated before an RTDB write",
      category: "correctness",
      rationale: "Realtime Database has no client-side schema enforcement \u2014 data is written exactly as given. When a function parses an external response (e.g. an LLM completion) and forwards the result straight into set()/update()/push() with no validation call in between, a malformed or missing field silently corrupts the stored data with no error surfaced anywhere.",
      docsUrl: "https://firebase.google.com/docs/database/web/read-and-write",
      recommended: true
    },
    messages: {
      unvalidatedWrite: "Parsed external data flows into a Realtime Database write with no validation call in between. Validate shape/values before writing."
    },
    schema: []
  },
  create(context) {
    const writeLocalNames = /* @__PURE__ */ new Set();
    const scopes = [];
    function registerScope(node) {
      scopes.push({ node, start: startOffset2(node), end: endOffset2(node) });
    }
    function innermostScope(pos) {
      let best;
      for (const scope of scopes) {
        if (pos < scope.start || pos > scope.end) continue;
        if (!best || scope.end - scope.start < best.end - best.start) best = scope;
      }
      return best;
    }
    function enclosingScopes(pos) {
      return scopes.filter((scope) => pos >= scope.start && pos <= scope.end);
    }
    return {
      ImportDeclaration(node) {
        const imports = namedImportsFrom(node, "firebase/database");
        for (const name of ["set", "update", "push"]) {
          const local = imports.get(name);
          if (local) writeLocalNames.add(local);
        }
      },
      FunctionDeclaration(node) {
        registerScope(node);
      },
      FunctionExpression(node) {
        registerScope(node);
      },
      ArrowFunctionExpression(node) {
        registerScope(node);
      },
      CallExpression(node) {
        const pos = startOffset2(node);
        if (isValidationLikeCall(node)) {
          for (const scope2 of enclosingScopes(pos)) {
            if (scope2.validatePos === void 0 || pos < scope2.validatePos) scope2.validatePos = pos;
          }
          return;
        }
        const scope = innermostScope(pos);
        if (!scope) return;
        if (isJsonParseCall(node) || isResponseJsonCall(node)) {
          if (scope.parsePos === void 0 || pos < scope.parsePos) scope.parsePos = pos;
          return;
        }
        if (writeLocalNames.size > 0 && [...writeLocalNames].some((n) => isIdentifierCall(node, n))) {
          if (scope.writePos === void 0 || pos < scope.writePos) {
            scope.writePos = pos;
            scope.writeNode = node;
          }
        }
      },
      "Program:exit"() {
        for (const scope of scopes) {
          if (scope.parsePos === void 0 || scope.writePos === void 0) continue;
          if (scope.writePos < scope.parsePos) continue;
          const validatedBetween = scope.validatePos !== void 0 && scope.validatePos > scope.parsePos && scope.validatePos < scope.writePos;
          if (!validatedBetween) {
            context.report({ node: scope.writeNode, messageId: "unvalidatedWrite" });
          }
        }
      }
    };
  }
};
var firebaseUnvalidatedExternalDataToRtdbRule = rule33;

// src/providers/firebase/rules/rtdb-batch-write-not-atomic.ts
function isPromiseAllCall(node) {
  return node?.type === "CallExpression" && node.callee?.type === "MemberExpression" && !node.callee.computed && node.callee.object?.type === "Identifier" && node.callee.object.name === "Promise" && node.callee.property?.type === "Identifier" && node.callee.property.name === "all";
}
function isMapCall(node) {
  return node?.type === "CallExpression" && node.callee?.type === "MemberExpression" && !node.callee.computed && node.callee.property?.type === "Identifier" && node.callee.property.name === "map";
}
var rule34 = {
  meta: {
    type: "suggestion",
    docs: {
      description: "Promise.all over per-item push+set is not atomic",
      category: "correctness",
      rationale: "push() to generate a client-side unique key is correct, but firing one set() per item under Promise.all means N independent network writes. A partial failure mid-batch (permission revoked, connection drop) leaves some items committed and others not, with no atomicity. Building one update() call against the parent ref with all generated keys as fields commits the whole batch atomically instead.",
      docsUrl: "https://firebase.google.com/docs/database/web/read-and-write",
      recommended: true
    },
    messages: {
      batchWriteNotAtomic: "This batches per-item push()+set() calls under Promise.all, which is not atomic. Build one update() call against the parent ref instead."
    },
    schema: []
  },
  create(context) {
    let pushLocalName;
    let setLocalName;
    const mapCallsByVarName = /* @__PURE__ */ new Map();
    function isAtomicBatchMapCall(mapCallNode) {
      if (!isMapCall(mapCallNode)) return false;
      const callback = mapCallNode.arguments?.[mapCallNode.arguments.length - 1];
      if (!callback) return false;
      const hasPush = someDescendant(callback, (n) => isIdentifierCall(n, pushLocalName));
      const hasSet = someDescendant(callback, (n) => isIdentifierCall(n, setLocalName));
      return hasPush && hasSet;
    }
    return {
      ImportDeclaration(node) {
        const imports = namedImportsFrom(node, "firebase/database");
        if (imports.has("push")) pushLocalName = imports.get("push");
        if (imports.has("set")) setLocalName = imports.get("set");
      },
      VariableDeclarator(node) {
        if (node.id?.type === "Identifier" && isMapCall(node.init)) {
          mapCallsByVarName.set(node.id.name, node.init);
        }
      },
      CallExpression(node) {
        if (!isPromiseAllCall(node)) return;
        const arg = node.arguments?.[0];
        if (isAtomicBatchMapCall(arg)) {
          context.report({ node, messageId: "batchWriteNotAtomic" });
          return;
        }
        if (arg?.type === "Identifier") {
          const mapCall = mapCallsByVarName.get(arg.name);
          if (mapCall && isAtomicBatchMapCall(mapCall)) {
            context.report({ node, messageId: "batchWriteNotAtomic" });
          }
        }
      }
    };
  }
};
var firebaseRtdbBatchWriteNotAtomicRule = rule34;

// src/providers/firebase/rules/rtdb-listener-error-not-handled.ts
var rule35 = {
  meta: {
    type: "suggestion",
    docs: {
      description: "onValue listeners should handle the error callback",
      category: "reliability",
      rationale: "onValue's callback signature includes a documented error callback specifically for permission-denied and connection-loss cases. A call with only the success callback (2 arguments) silently drops that path, so a PERMISSION_DENIED or offline event produces no UI feedback and no console output.",
      docsUrl: "https://firebase.google.com/docs/reference/js/database.md#onvalue",
      recommended: true
    },
    messages: {
      listenerErrorNotHandled: "onValue is called with no error/cancel callback. Pass a 3rd argument so PERMISSION_DENIED and dropped connections surface somewhere."
    },
    schema: []
  },
  create(context) {
    let onValueLocalName;
    return {
      ImportDeclaration(node) {
        const imports = namedImportsFrom(node, "firebase/database");
        if (imports.has("onValue")) onValueLocalName = imports.get("onValue");
      },
      CallExpression(node) {
        if (!isIdentifierCall(node, onValueLocalName)) return;
        if ((node.arguments ?? []).length < 3) {
          context.report({ node, messageId: "listenerErrorNotHandled" });
        }
      }
    };
  }
};
var firebaseRtdbListenerErrorNotHandledRule = rule35;

// src/providers/firebase/rules/effect-deps-whole-user-object.ts
function isUseEffectCall(node) {
  return node?.type === "CallExpression" && node.callee?.type === "Identifier" && node.callee.name === "useEffect";
}
var rule36 = {
  meta: {
    type: "suggestion",
    docs: {
      description: "useEffect should depend on user?.uid, not the whole user object",
      category: "reliability",
      rationale: "onAuthStateChanged delivers a new user object reference on every internal token refresh (roughly hourly) even when uid is unchanged. An effect that only reads user.uid but lists the whole user object in its dependency array tears down and re-establishes its RTDB listener on every refresh \u2014 an avoidable unsubscribe/resubscribe cycle that briefly clears local state.",
      docsUrl: "https://firebase.google.com/docs/reference/js/auth.md#onauthstatechanged",
      recommended: true
    },
    messages: {
      wholeUserObjectDep: "This effect only reads {{name}}.uid but depends on the whole {{name}} object, which gets a new reference on every token refresh. Depend on {{name}}?.uid instead."
    },
    schema: []
  },
  create(context) {
    return {
      CallExpression(node) {
        if (!isUseEffectCall(node)) return;
        const [callback, depsArg] = node.arguments ?? [];
        if (!callback || depsArg?.type !== "ArrayExpression") return;
        for (const el of depsArg.elements ?? []) {
          if (el?.type !== "Identifier") continue;
          const name = el.name;
          if (someDescendant(callback, (n) => isUidMemberAccess(n, name))) {
            context.report({ node, messageId: "wholeUserObjectDep", data: { name } });
          }
        }
      }
    };
  }
};
var firebaseEffectDepsWholeUserObjectRule = rule36;

// src/providers/firebase/rules/rtdb-write-promise-not-handled.ts
var rule37 = {
  meta: {
    type: "problem",
    docs: {
      description: "Realtime Database write promises must be handled",
      category: "reliability",
      rationale: "set()/update()/remove() return promises specifically so a rejected write (offline, permission-denied, rules-rejected) can be handled. A bare fire-and-forget call, or an awaited call with no surrounding try/catch, means the caller proceeds \u2014 and may navigate away \u2014 as if the write succeeded, while the rejection is silently dropped.",
      docsUrl: "https://firebase.google.com/docs/database/web/read-and-write",
      recommended: true
    },
    messages: {
      writePromiseNotHandled: "This Realtime Database write is neither awaited inside a try/catch nor given a .catch handler. A rejected write will be silently dropped."
    },
    schema: []
  },
  create(context) {
    const writeLocalNames = /* @__PURE__ */ new Set();
    const writeCalls = /* @__PURE__ */ new Set();
    const safeReturns = /* @__PURE__ */ new Set();
    const awaitedCalls = /* @__PURE__ */ new Set();
    const caughtCalls = /* @__PURE__ */ new Set();
    const tryBlocks = [];
    function isWriteCall(node) {
      return [...writeLocalNames].some((n) => isIdentifierCall(node, n));
    }
    return {
      ImportDeclaration(node) {
        const imports = namedImportsFrom(node, "firebase/database");
        for (const name of ["set", "update", "remove"]) {
          const local = imports.get(name);
          if (local) writeLocalNames.add(local);
        }
      },
      TryStatement(node) {
        if (node.block) tryBlocks.push(node.block);
      },
      ReturnStatement(node) {
        if (isWriteCall(node.argument)) safeReturns.add(node.argument);
      },
      AwaitExpression(node) {
        if (isWriteCall(node.argument)) awaitedCalls.add(node.argument);
      },
      CallExpression(node) {
        if (isWriteCall(node)) writeCalls.add(node);
        const prop = memberPropName2(node);
        const isCatch = prop === "catch";
        const isTwoArgThen = prop === "then" && (node.arguments ?? []).length >= 2;
        if (isCatch || isTwoArgThen) {
          for (const link of chainLinks(node)) {
            if (isWriteCall(link)) caughtCalls.add(link);
          }
        }
      },
      "Program:exit"() {
        for (const call of writeCalls) {
          if (safeReturns.has(call)) continue;
          if (caughtCalls.has(call)) continue;
          if (awaitedCalls.has(call)) {
            if (tryBlocks.some((block) => contains2(block, call))) continue;
          }
          context.report({ node: call, messageId: "writePromiseNotHandled" });
        }
      }
    };
  }
};
var firebaseRtdbWritePromiseNotHandledRule = rule37;

// src/providers/lovable/utils.ts
var LLM_HOST_PATTERN = /api\.anthropic\.com|api\.openai\.com/;
function containsKnownLlmHost(node) {
  if (node?.type === "Literal" && typeof node.value === "string") {
    return LLM_HOST_PATTERN.test(node.value);
  }
  if (node?.type === "TemplateLiteral") {
    return (node.quasis ?? []).some((q) => LLM_HOST_PATTERN.test(q.value?.raw ?? ""));
  }
  return false;
}

// src/providers/lovable/rules/no-client-side-secret-fetch.ts
var rule38 = {
  meta: {
    type: "problem",
    docs: {
      description: "LLM provider calls must not run client-side with a VITE_-exposed API key",
      category: "security",
      cwe: "CWE-522",
      owasp: "A02:2021 \u2013 Cryptographic Failures",
      rationale: "Anything read from import.meta.env.VITE_* is inlined into the production JS bundle at build time and is visible to every site visitor via the Network tab or by reading the bundle \u2014 no git access required. Lovable documents Edge Functions specifically so the provider key stays server-side in Secrets and the browser calls your own Edge Function instead of the provider directly.",
      docsUrl: "https://docs.lovable.dev/features/security",
      recommended: true
    },
    messages: {
      clientSideSecretFetch: "This fetch() calls an LLM provider directly with a key sourced from import.meta.env.VITE_* \u2014 that key ships into the browser bundle and is visible to every visitor."
    }
  },
  create(context) {
    const viteVars = /* @__PURE__ */ new Set();
    function propName2(node) {
      if (!node) return void 0;
      if (node.type === "Identifier") return node.name;
      if (node.type === "Literal" && typeof node.value === "string") return node.value;
      return void 0;
    }
    function isImportMetaEnvViteAccess(node) {
      if (node?.type !== "MemberExpression" || node.computed) return false;
      const propertyName = node.property?.name;
      if (typeof propertyName !== "string" || !propertyName.startsWith("VITE_")) return false;
      const envMember = node.object;
      if (envMember?.type !== "MemberExpression" || envMember.computed) return false;
      if (envMember.property?.name !== "env") return false;
      const metaProp = envMember.object;
      return metaProp?.type === "MetaProperty" && metaProp.meta?.name === "import" && metaProp.property?.name === "meta";
    }
    function referencesViteSecret(node) {
      if (!node) return false;
      if (isImportMetaEnvViteAccess(node)) return true;
      if (node.type === "Identifier" && viteVars.has(node.name)) return true;
      if (node.type === "TemplateLiteral") {
        return (node.expressions ?? []).some((e) => referencesViteSecret(e));
      }
      return false;
    }
    return {
      VariableDeclarator(node) {
        if (node.id?.type === "Identifier" && isImportMetaEnvViteAccess(node.init)) {
          viteVars.add(node.id.name);
        }
      },
      CallExpression(node) {
        const callee = node.callee;
        if (callee?.type !== "Identifier" || callee.name !== "fetch") return;
        const urlArg = node.arguments?.[0];
        if (!containsKnownLlmHost(urlArg)) return;
        const optsArg = node.arguments?.[1];
        if (optsArg?.type !== "ObjectExpression") return;
        const headersProp = (optsArg.properties ?? []).find(
          (p) => p?.type === "Property" && propName2(p.key) === "headers"
        );
        if (!headersProp || headersProp.value?.type !== "ObjectExpression") return;
        for (const hp of headersProp.value.properties ?? []) {
          if (hp?.type !== "Property") continue;
          const keyName = propName2(hp.key)?.toLowerCase();
          if (keyName !== "x-api-key" && keyName !== "authorization") continue;
          if (referencesViteSecret(hp.value)) {
            context.report({ node, messageId: "clientSideSecretFetch" });
            return;
          }
        }
      }
    };
  }
};
var lovableNoClientSideSecretFetchRule = rule38;

// src/providers/lovable/rules/paid-flag-without-edge-function.ts
var PRICE_PATTERN = /\$\s?\d/;
var FLAG_PROPERTY_PATTERN = /^is_[a-z0-9_]+$/i;
var FLAG_SUFFIX_PATTERN = /_(unlocked|active|enabled)$/i;
var rule39 = {
  meta: {
    type: "problem",
    docs: {
      description: "A paid feature flag must not be set by a direct database update with no payment-provider call",
      category: "security",
      cwe: "CWE-840",
      owasp: "A04:2021 \u2013 Insecure Design",
      rationale: "Lovable documents payment processing as Edge Function territory specifically so purchase/premium-access flags are only ever set after a payment provider confirms payment server-side. A handler that writes a paid-looking flag straight from the client with no payment call in between either never actually charges anyone, or \u2014 even if a charge happens elsewhere \u2014 leaves the flag itself freely settable by any caller with write access to the row.",
      docsUrl: "https://docs.lovable.dev/features/cloud",
      recommended: true
    },
    messages: {
      paidFlagWithoutPayment: "This sets a paid-looking flag via a direct database update, but nothing in this function calls a payment provider or Edge Function first \u2014 the flag can be set without anyone paying."
    }
  },
  create(context) {
    const stack = [];
    const states = /* @__PURE__ */ new Map();
    let sawPriceLabel = false;
    function ensureState(fn) {
      let s = states.get(fn);
      if (!s) {
        s = { sawFlagUpdate: false, updateNode: null, sawPaymentCall: false };
        states.set(fn, s);
      }
      return s;
    }
    function top() {
      return stack[stack.length - 1];
    }
    function pushScope(node) {
      stack.push(node);
      ensureState(node);
    }
    function popScope() {
      stack.pop();
    }
    function propName2(node) {
      if (!node) return void 0;
      if (node.type === "Identifier") return node.name;
      if (node.type === "Literal" && typeof node.value === "string") return node.value;
      return void 0;
    }
    function isBooleanFlagProperty(name) {
      if (!name) return false;
      return FLAG_PROPERTY_PATTERN.test(name) || FLAG_SUFFIX_PATTERN.test(name);
    }
    function isSupabaseUpdateCall(node) {
      if (node?.type !== "CallExpression") return false;
      const callee = node.callee;
      return callee?.type === "MemberExpression" && callee.property?.name === "update";
    }
    function updateSetsBooleanFlag(node) {
      const arg = node.arguments?.[0];
      if (arg?.type !== "ObjectExpression") return false;
      return (arg.properties ?? []).some(
        (p) => p?.type === "Property" && isBooleanFlagProperty(propName2(p.key))
      );
    }
    function memberChainNames2(node, names = []) {
      if (node?.type === "MemberExpression") {
        memberChainNames2(node.object, names);
        const n = propName2(node.property);
        if (n) names.push(n);
      } else if (node?.type === "Identifier") {
        names.push(node.name);
      } else if (node?.type === "CallExpression") {
        memberChainNames2(node.callee, names);
      }
      return names;
    }
    function isPaymentRelatedCall(node) {
      if (node?.type !== "CallExpression") return false;
      const chain = memberChainNames2(node.callee).join(".").toLowerCase();
      if (/stripe|checkout|payment/.test(chain)) return true;
      if (chain.includes("functions") && chain.endsWith(".invoke")) return true;
      if (node.callee?.type === "Identifier" && node.callee.name === "fetch") {
        const urlArg = node.arguments?.[0];
        if (urlArg?.type === "Literal" && typeof urlArg.value === "string") {
          return urlArg.value.includes("/functions/");
        }
        if (urlArg?.type === "TemplateLiteral") {
          return (urlArg.quasis ?? []).some((q) => (q.value?.raw ?? "").includes("/functions/"));
        }
      }
      return false;
    }
    return {
      Program(node) {
        pushScope(node);
      },
      "Program:exit"() {
        if (!sawPriceLabel) return;
        for (const state of states.values()) {
          if (state.sawFlagUpdate && !state.sawPaymentCall) {
            context.report({ node: state.updateNode, messageId: "paidFlagWithoutPayment" });
          }
        }
      },
      FunctionDeclaration(node) {
        pushScope(node);
      },
      "FunctionDeclaration:exit"() {
        popScope();
      },
      FunctionExpression(node) {
        pushScope(node);
      },
      "FunctionExpression:exit"() {
        popScope();
      },
      ArrowFunctionExpression(node) {
        pushScope(node);
      },
      "ArrowFunctionExpression:exit"() {
        popScope();
      },
      Literal(node) {
        if (typeof node.value === "string" && PRICE_PATTERN.test(node.value)) sawPriceLabel = true;
      },
      JSXText(node) {
        if (typeof node.value === "string" && PRICE_PATTERN.test(node.value)) sawPriceLabel = true;
      },
      TemplateElement(node) {
        if (PRICE_PATTERN.test(node.value?.raw ?? "")) sawPriceLabel = true;
      },
      CallExpression(node) {
        const fn = top();
        if (!fn) return;
        const state = ensureState(fn);
        if (isSupabaseUpdateCall(node) && updateSetsBooleanFlag(node) && !state.sawFlagUpdate) {
          state.sawFlagUpdate = true;
          state.updateNode = node;
        }
        if (isPaymentRelatedCall(node)) {
          state.sawPaymentCall = true;
        }
      }
    };
  }
};
var lovablePaidFlagWithoutEdgeFunctionRule = rule39;

// src/providers/lovable/rules/expiry-column-never-checked.ts
var EXPIRY_COLUMN_PATTERN = /_(until|expires?_at|expiry)$/i;
var DATE_COMPARISON_OPERATORS = /* @__PURE__ */ new Set([">", "<", ">=", "<="]);
var FILTER_METHODS = /* @__PURE__ */ new Set(["gt", "gte", "lt", "lte"]);
var rule40 = {
  meta: {
    type: "suggestion",
    docs: {
      description: "An expiry column must be checked against the current time somewhere",
      category: "correctness",
      rationale: "Writing a *_until/*_expires_at column without ever comparing it to the current time anywhere in the codebase means the expiry is purely cosmetic \u2014 whatever it was meant to gate (a boost, a trial, a temporary unlock) never actually expires once granted, whether it was granted legitimately or through an unrelated bug.",
      docsUrl: "https://docs.lovable.dev/features/cloud",
      recommended: true
    },
    messages: {
      expiryNeverChecked: 'The "{{column}}" column is written here but is never compared against the current time anywhere in this file, so it never actually expires anything.'
    }
  },
  create(context) {
    const writtenColumns = /* @__PURE__ */ new Map();
    const readColumns = /* @__PURE__ */ new Set();
    function propName2(node) {
      if (!node) return void 0;
      if (node.type === "Identifier") return node.name;
      if (node.type === "Literal" && typeof node.value === "string") return node.value;
      return void 0;
    }
    function isSupabaseUpdateCall(node) {
      if (node?.type !== "CallExpression") return false;
      const callee = node.callee;
      return callee?.type === "MemberExpression" && callee.property?.name === "update";
    }
    function containsDateNowOrNewDate(node, depth = 0) {
      if (!node || typeof node !== "object" || depth > 6) return false;
      if (node.type === "NewExpression" && node.callee?.type === "Identifier" && node.callee.name === "Date") {
        return true;
      }
      if (node.type === "CallExpression" && node.callee?.type === "MemberExpression" && node.callee.object?.type === "Identifier" && node.callee.object.name === "Date" && node.callee.property?.name === "now") {
        return true;
      }
      if (node.type === "MemberExpression") {
        return containsDateNowOrNewDate(node.object, depth + 1) || containsDateNowOrNewDate(node.callee, depth + 1);
      }
      if (node.type === "CallExpression") {
        return containsDateNowOrNewDate(node.callee, depth + 1);
      }
      return false;
    }
    function memberPropertyName(node) {
      if (node?.type !== "MemberExpression") return void 0;
      return propName2(node.property);
    }
    return {
      CallExpression(node) {
        if (isSupabaseUpdateCall(node)) {
          const arg = node.arguments?.[0];
          if (arg?.type === "ObjectExpression") {
            for (const prop of arg.properties ?? []) {
              if (prop?.type !== "Property") continue;
              const keyName = propName2(prop.key);
              if (keyName && EXPIRY_COLUMN_PATTERN.test(keyName) && !writtenColumns.has(keyName)) {
                writtenColumns.set(keyName, node);
              }
            }
          }
        }
        const callee = node.callee;
        if (callee?.type === "MemberExpression" && FILTER_METHODS.has(callee.property?.name)) {
          const colArg = node.arguments?.[0];
          const colName = colArg?.type === "Literal" ? propName2(colArg) : void 0;
          if (colName && EXPIRY_COLUMN_PATTERN.test(colName)) {
            readColumns.add(colName);
          }
        }
      },
      BinaryExpression(node) {
        if (!DATE_COMPARISON_OPERATORS.has(node.operator)) return;
        const leftCol = memberPropertyName(node.left);
        const rightCol = memberPropertyName(node.right);
        if (leftCol && EXPIRY_COLUMN_PATTERN.test(leftCol) && containsDateNowOrNewDate(node.right)) {
          readColumns.add(leftCol);
        }
        if (rightCol && EXPIRY_COLUMN_PATTERN.test(rightCol) && containsDateNowOrNewDate(node.left)) {
          readColumns.add(rightCol);
        }
      },
      "Program:exit"() {
        for (const [column, node] of writtenColumns) {
          if (!readColumns.has(column)) {
            context.report({ node, messageId: "expiryNeverChecked", data: { column } });
          }
        }
      }
    };
  }
};
var lovableExpiryColumnNeverCheckedRule = rule40;

// src/providers/lovable/rules/silent-catch-on-provider-call.ts
var LOGGING_CONSOLE_METHODS = /* @__PURE__ */ new Set(["error", "warn", "log", "info"]);
var rule41 = {
  meta: {
    type: "suggestion",
    docs: {
      description: "A catch block around an LLM provider call must log the failure",
      category: "correctness",
      rationale: `Returning null/undefined from a bare catch with no logging makes every failure mode \u2014 missing key, expired key, rate limit, malformed response, network error \u2014 look identical to "no key configured." If a deployment's provider key starts failing in production, this is invisible: there is nothing in the browser or error-tracking logs to distinguish a real outage from an intentionally-unconfigured feature.`,
      docsUrl: "https://docs.lovable.dev/features/cloud",
      recommended: true
    },
    messages: {
      silentCatch: 'This catch block swallows a failed LLM provider call with no logging \u2014 a real failure (expired key, rate limit, network error) is indistinguishable from "no key configured."'
    }
  },
  create(context) {
    function findFetchToLlmHost(node, depth = 0) {
      if (!node || typeof node !== "object" || depth > 12) return null;
      if (Array.isArray(node)) {
        for (const n of node) {
          const found = findFetchToLlmHost(n, depth + 1);
          if (found) return found;
        }
        return null;
      }
      if (node.type === "CallExpression" && node.callee?.type === "Identifier" && node.callee.name === "fetch") {
        const urlArg = node.arguments?.[0];
        if (containsKnownLlmHost(urlArg)) return node;
      }
      for (const key of Object.keys(node)) {
        if (key === "parent" || key === "loc" || key === "range") continue;
        const val = node[key];
        if (val && typeof val === "object") {
          const found = findFetchToLlmHost(val, depth + 1);
          if (found) return found;
        }
      }
      return null;
    }
    function containsLoggingCall(node, depth = 0) {
      if (!node || typeof node !== "object" || depth > 12) return false;
      if (Array.isArray(node)) return node.some((n) => containsLoggingCall(n, depth + 1));
      if (node.type === "CallExpression") {
        const callee = node.callee;
        if (callee?.type === "MemberExpression") {
          const objName = callee.object?.type === "Identifier" ? callee.object.name : void 0;
          const propertyName = callee.property?.name;
          if (objName === "console" && LOGGING_CONSOLE_METHODS.has(propertyName)) return true;
          if (propertyName === "captureException") return true;
        }
        if (callee?.type === "Identifier" && callee.name === "reportError") return true;
      }
      for (const key of Object.keys(node)) {
        if (key === "parent" || key === "loc" || key === "range") continue;
        const val = node[key];
        if (val && typeof val === "object") {
          if (containsLoggingCall(val, depth + 1)) return true;
        }
      }
      return false;
    }
    return {
      TryStatement(node) {
        const fetchNode = findFetchToLlmHost(node.block);
        if (!fetchNode) return;
        const handler = node.handler;
        if (!handler) return;
        if (!containsLoggingCall(handler.body)) {
          context.report({ node: handler, messageId: "silentCatch" });
        }
      }
    };
  }
};
var lovableSilentCatchOnProviderCallRule = rule41;

// src/providers/browserbase/utils.ts
function memberPropName3(node) {
  if (node?.type !== "CallExpression") return void 0;
  const callee = node.callee;
  if (callee?.type !== "MemberExpression") return void 0;
  const prop = callee.property;
  if (!callee.computed && prop?.type === "Identifier") return prop.name;
  if (callee.computed && prop?.type === "Literal" && typeof prop.value === "string") return prop.value;
  return void 0;
}
function isSessionsCall(node, name) {
  if (memberPropName3(node) !== name) return false;
  const obj = node.callee.object;
  return obj?.type === "MemberExpression" && !obj.computed && obj.property?.type === "Identifier" && obj.property.name === "sessions";
}
function isSessionsRecordingCall(node, name) {
  if (memberPropName3(node) !== name) return false;
  const recordingObj = node.callee.object;
  if (recordingObj?.type !== "MemberExpression" || recordingObj.computed) return false;
  if (recordingObj.property?.type !== "Identifier" || recordingObj.property.name !== "recording") return false;
  const sessionsObj = recordingObj.object;
  return sessionsObj?.type === "MemberExpression" && !sessionsObj.computed && sessionsObj.property?.type === "Identifier" && sessionsObj.property.name === "sessions";
}
function findProperty2(objectExpression, name) {
  if (objectExpression?.type !== "ObjectExpression") return void 0;
  return objectExpression.properties?.find(
    (p) => p?.type === "Property" && (p.key?.type === "Identifier" && p.key.name === name || p.key?.type === "Literal" && p.key.value === name)
  );
}
function startOffset3(n) {
  if (typeof n?.range?.[0] === "number") return n.range[0];
  if (typeof n?.start === "number") return n.start;
  return (n?.loc?.start?.line ?? 0) * 1e6 + (n?.loc?.start?.column ?? 0);
}
function endOffset3(n) {
  if (typeof n?.range?.[1] === "number") return n.range[1];
  if (typeof n?.end === "number") return n.end;
  return (n?.loc?.end?.line ?? n?.loc?.start?.line ?? 0) * 1e6 + (n?.loc?.end?.column ?? 0);
}
function contains3(outer, inner) {
  const s = startOffset3(inner);
  return s >= startOffset3(outer) && s <= endOffset3(outer);
}
function someDescendant2(node, predicate) {
  let found = false;
  function visit(n) {
    if (found || !n || typeof n !== "object") return;
    if (Array.isArray(n)) {
      for (const item of n) visit(item);
      return;
    }
    if (typeof n.type !== "string") return;
    if (predicate(n)) {
      found = true;
      return;
    }
    for (const key of Object.keys(n)) {
      if (key === "parent" || key === "loc" || key === "range") continue;
      visit(n[key]);
    }
  }
  visit(node);
  return found;
}
function isResponseSendCall(node) {
  const name = memberPropName3(node);
  if (name !== "json" && name !== "send") return false;
  const obj = node.callee.object;
  if (obj?.type === "Identifier") {
    return /^(res|response)$/i.test(obj.name) || obj.name === "Response" || obj.name === "NextResponse";
  }
  return false;
}
function isInsideTestFile3(filename) {
  return /(^|[\\/])__tests__[\\/]|\.(test|spec)\.[cm]?[jt]sx?$/.test(filename);
}

// src/providers/browserbase/rules/no-conditional-authz-on-anonymous-user.ts
function isUserLikeExpr(node) {
  if (node?.type === "Identifier") return /user/i.test(node.name);
  if (node?.type === "MemberExpression" && !node.computed && node.property?.type === "Identifier") {
    return /user/i.test(node.property.name);
  }
  return false;
}
function isFalsyGuardTest(test) {
  if (test?.type === "UnaryExpression" && test.operator === "!") return isUserLikeExpr(test.argument);
  if (test?.type === "BinaryExpression" && (test.operator === "===" || test.operator === "==")) {
    const sides = [test.left, test.right];
    const isNullish = (n) => n?.type === "Literal" && n.value === null || n?.type === "Identifier" && n.name === "undefined";
    const nullSide = sides.find(isNullish);
    const otherSide = sides.find((s) => s !== nullSide);
    return !!nullSide && isUserLikeExpr(otherSide);
  }
  return false;
}
function hasReturnOrThrow(stmt) {
  if (!stmt) return false;
  if (stmt.type === "ReturnStatement" || stmt.type === "ThrowStatement") return true;
  if (stmt.type === "BlockStatement") {
    return (stmt.body ?? []).some((s) => s.type === "ReturnStatement" || s.type === "ThrowStatement");
  }
  return false;
}
function isTruthyGateTest(test) {
  if (isUserLikeExpr(test)) return true;
  if (test?.type === "LogicalExpression" && test.operator === "&&") {
    return isTruthyGateTest(test.left) || isTruthyGateTest(test.right);
  }
  return false;
}
var rule42 = {
  meta: {
    type: "problem",
    docs: {
      description: "Sensitive Browserbase resources must be guarded by unconditional authorization",
      category: "security",
      cwe: "CWE-862",
      owasp: "A01:2021 Broken Access Control",
      rationale: "bb.sessions.debug() and bb.sessions.recording.retrieve() return a live CDP debugger URL or a full rrweb session replay \u2014 high-value resources. Gating the ownership check behind `if (user) { ...check... }` with no unconditional `if (!user) return` guard means an anonymous caller (no credentials at all) simply skips the whole block and falls through to the sensitive call. Authorization must reject the unauthenticated case explicitly, not rely on a conditional that happens to be true for legitimate callers.",
      docsUrl: "https://docs.browserbase.com/reference/api/session-live-urls",
      recommended: true
    },
    messages: {
      conditionalAuthz: "This route returns a Browserbase live-view/recording resource gated only by `if (user) {...}` with no unconditional rejection for anonymous callers. Add an `if (!user) return ...` guard before this."
    },
    schema: []
  },
  create(context) {
    const scopes = [];
    const gates = [];
    const sensitiveCalls = [];
    function registerScope(node) {
      scopes.push({ node, start: startOffset3(node), end: endOffset3(node) });
    }
    function innermostScope(pos) {
      let best;
      for (const scope of scopes) {
        if (pos < scope.start || pos > scope.end) continue;
        if (!best || scope.end - scope.start < best.end - best.start) best = scope;
      }
      return best;
    }
    return {
      FunctionDeclaration(node) {
        registerScope(node);
      },
      FunctionExpression(node) {
        registerScope(node);
      },
      ArrowFunctionExpression(node) {
        registerScope(node);
      },
      IfStatement(node) {
        if (isFalsyGuardTest(node.test) && hasReturnOrThrow(node.consequent)) {
          const pos = startOffset3(node);
          const scope = innermostScope(pos);
          if (scope && (scope.guardPos === void 0 || pos < scope.guardPos)) scope.guardPos = pos;
          return;
        }
        if (isTruthyGateTest(node.test) && !node.alternate) {
          gates.push({ start: startOffset3(node), end: endOffset3(node) });
        }
      },
      CallExpression(node) {
        if (isSessionsCall(node, "debug") || isSessionsRecordingCall(node, "retrieve")) {
          sensitiveCalls.push(node);
        }
      },
      "Program:exit"() {
        for (const call of sensitiveCalls) {
          const gate = gates.find((g) => contains3(g, call));
          if (!gate) continue;
          const scope = innermostScope(startOffset3(call));
          const hasGuardBeforeGate = scope?.guardPos !== void 0 && scope.guardPos < gate.start;
          if (!hasGuardBeforeGate) {
            context.report({ node: call, messageId: "conditionalAuthz" });
          }
        }
      }
    };
  }
};
var browserbaseNoConditionalAuthzOnAnonymousUserRule = rule42;

// src/providers/browserbase/rules/no-connect-url-in-api-response.ts
var rule43 = {
  meta: {
    type: "problem",
    docs: {
      description: "connectUrl must never be placed in an HTTP response body",
      category: "security",
      cwe: "CWE-200",
      owasp: "A04:2021 Insecure Design",
      rationale: "session.connectUrl is the WebSocket CDP URL returned by sessions.create() \u2014 it is self-authenticating; connecting to it grants full read/write control of the live browser (arbitrary JS execution, cookie/localStorage read, simulated input), equivalent to a bearer token. Putting it in a response body widens its exposure (network tab, browser extensions, error trackers, logs) for callers that almost never need it client-side \u2014 the intended sharable artifact is debuggerFullscreenUrl from sessions.debug().",
      docsUrl: "https://docs.browserbase.com/reference/api/create-a-session",
      recommended: true
    },
    messages: {
      connectUrlInResponse: "connectUrl is included in an HTTP response body. Keep it server-side only \u2014 it is a bearer credential for the live browser, not a sharable URL."
    },
    schema: []
  },
  create(context) {
    return {
      CallExpression(node) {
        if (!isResponseSendCall(node)) return;
        const arg = node.arguments?.[0];
        if (arg?.type !== "ObjectExpression") return;
        if (findProperty2(arg, "connectUrl")) {
          context.report({ node, messageId: "connectUrlInResponse" });
        }
      }
    };
  }
};
var browserbaseNoConnectUrlInApiResponseRule = rule43;

// src/providers/browserbase/rules/session-id-requires-ownership-check.ts
function isOwnershipCheckCall(node) {
  if (node?.type !== "CallExpression") return false;
  const callee = node.callee;
  const name = callee?.type === "Identifier" ? callee.name : callee?.type === "MemberExpression" && !callee.computed && callee.property?.type === "Identifier" ? callee.property.name : void 0;
  if (!name) return false;
  return /owner|belongsto|hasaccess|authorize|verifyaccess|checkaccess|findproject|getproject/i.test(name);
}
function isSessionIdLikeArg(node) {
  if (node?.type === "Identifier") return /sessionid/i.test(node.name);
  if (node?.type === "MemberExpression" && !node.computed && node.property?.type === "Identifier") {
    return /sessionid/i.test(node.property.name);
  }
  return false;
}
var rule44 = {
  meta: {
    type: "suggestion",
    docs: {
      description: "Session id lookups must verify ownership before returning live-view data",
      category: "security",
      cwe: "CWE-862",
      rationale: "A session id alone is not an authorization token \u2014 it is an opaque identifier that can leak via links, logs, screenshots, or support tickets. A handler that resolves a sessionId straight into sessions.debug()/sessions.recording.retrieve() with no ownership/org-membership check lets any authenticated caller view or replay a session that belongs to someone else.",
      docsUrl: "https://docs.browserbase.com/features/session-live-view",
      recommended: true
    },
    messages: {
      missingOwnershipCheck: "sessionId is passed directly into a Browserbase live-view/recording call with no ownership check beforehand."
    },
    schema: []
  },
  create(context) {
    const scopes = [];
    const sensitiveCalls = [];
    function registerScope(node) {
      scopes.push({ node, start: startOffset3(node), end: endOffset3(node), sawOwnershipCheck: false });
    }
    function innermostScope(pos) {
      let best;
      for (const scope of scopes) {
        if (pos < scope.start || pos > scope.end) continue;
        if (!best || scope.end - scope.start < best.end - best.start) best = scope;
      }
      return best;
    }
    return {
      FunctionDeclaration(node) {
        registerScope(node);
      },
      FunctionExpression(node) {
        registerScope(node);
      },
      ArrowFunctionExpression(node) {
        registerScope(node);
      },
      CallExpression(node) {
        const pos = startOffset3(node);
        const scope = innermostScope(pos);
        if (isOwnershipCheckCall(node)) {
          for (const s of scopes) {
            if (pos >= s.start && pos <= s.end) s.sawOwnershipCheck = true;
          }
          return;
        }
        if (isSessionsCall(node, "debug") || isSessionsRecordingCall(node, "retrieve")) {
          const sessionIdArg = (node.arguments ?? []).some(isSessionIdLikeArg);
          if (sessionIdArg) sensitiveCalls.push({ node, scope });
        }
      },
      "Program:exit"() {
        for (const { node, scope } of sensitiveCalls) {
          if (!scope || !scope.sawOwnershipCheck) {
            context.report({ node, messageId: "missingOwnershipCheck" });
          }
        }
      }
    };
  }
};
var browserbaseSessionIdRequiresOwnershipCheckRule = rule44;

// src/providers/browserbase/rules/no-concurrent-shared-context.ts
function isPromiseAllCall2(node) {
  return node?.type === "CallExpression" && node.callee?.type === "MemberExpression" && !node.callee.computed && node.callee.object?.type === "Identifier" && node.callee.object.name === "Promise" && node.callee.property?.type === "Identifier" && node.callee.property.name === "all";
}
function isMapCall2(node) {
  return memberPropName3(node) === "map";
}
function callbackParamNames(callback) {
  const names = /* @__PURE__ */ new Set();
  const param = callback?.params?.[0];
  if (param?.type === "Identifier") {
    names.add(param.name);
  } else if (param?.type === "ObjectPattern") {
    for (const p of param.properties ?? []) {
      if (p?.type === "Property" && p.value?.type === "Identifier") names.add(p.value.name);
      else if (p?.type === "RestElement" && p.argument?.type === "Identifier") names.add(p.argument.name);
    }
  }
  return names;
}
function contextIdValueIsShared(callback, contextIdNode) {
  if (contextIdNode?.type !== "Identifier") return false;
  const params = callbackParamNames(callback);
  if (params.has(contextIdNode.name)) return false;
  return true;
}
function findSharedContextCreateCall(callback) {
  const body = callback?.body;
  if (!body) return null;
  let found = null;
  function visit(n) {
    if (found || !n || typeof n !== "object") return;
    if (Array.isArray(n)) {
      for (const item of n) visit(item);
      return;
    }
    if (typeof n.type !== "string") return;
    if (isSessionsCall(n, "create")) {
      const optsArg = n.arguments?.[0];
      const browserSettings = findProperty2(optsArg, "browserSettings")?.value;
      const ctxProp = findProperty2(browserSettings, "context")?.value;
      const idProp = findProperty2(ctxProp, "id");
      if (idProp && contextIdValueIsShared(callback, idProp.value)) {
        found = n;
        return;
      }
    }
    for (const key of Object.keys(n)) {
      if (key === "parent" || key === "loc" || key === "range") continue;
      visit(n[key]);
    }
  }
  visit(body);
  return found;
}
var rule45 = {
  meta: {
    type: "problem",
    docs: {
      description: "A Browserbase Context must not be attached to concurrent sessions",
      category: "correctness",
      rationale: `Browserbase's docs state explicitly: "Avoid having multiple sessions using the same Context at once. Sites may force a log out." Passing the same browserSettings.context.id into every iteration of a Promise.all(items.map(...)) batch creates 2+ Browserbase sessions simultaneously attached to one Context, producing non-deterministic, flaky failures when a site force-logs-out one session because another concurrently authenticated against the same context.`,
      docsUrl: "https://docs.browserbase.com/features/contexts",
      recommended: true
    },
    messages: {
      concurrentSharedContext: "The same browserSettings.context.id is passed into every concurrent sessions.create() call in this Promise.all batch. Sites may force a log out when 2+ sessions share a Context at once."
    },
    schema: []
  },
  create(context) {
    const mapCallsByVarName = /* @__PURE__ */ new Map();
    function checkMapCall(mapCallNode) {
      if (!isMapCall2(mapCallNode)) return;
      const callback = mapCallNode.arguments?.[mapCallNode.arguments.length - 1];
      if (!callback) return;
      const sharedCall = findSharedContextCreateCall(callback);
      if (sharedCall) {
        context.report({ node: sharedCall, messageId: "concurrentSharedContext" });
      }
    }
    return {
      VariableDeclarator(node) {
        if (node.id?.type === "Identifier" && isMapCall2(node.init)) {
          mapCallsByVarName.set(node.id.name, node.init);
        }
      },
      CallExpression(node) {
        if (!isPromiseAllCall2(node)) return;
        const arg = node.arguments?.[0];
        if (isMapCall2(arg)) {
          checkMapCall(arg);
          return;
        }
        if (arg?.type === "Identifier") {
          const mapCall = mapCallsByVarName.get(arg.name);
          if (mapCall) checkMapCall(mapCall);
        }
      }
    };
  }
};
var browserbaseNoConcurrentSharedContextRule = rule45;

// src/providers/browserbase/rules/mobile-device-requires-os-setting.ts
function isMobileLiteral(node) {
  return node?.type === "Literal" && (node.value === "mobile" || node.value === "tablet");
}
function testComparesToMobile(test) {
  if (test?.type !== "BinaryExpression") return false;
  if (test.operator !== "===" && test.operator !== "==") return false;
  return isMobileLiteral(test.left) || isMobileLiteral(test.right);
}
function isViewportReference(node) {
  if (node?.type === "Identifier") return /viewport/i.test(node.name);
  if (node?.type === "MemberExpression" && !node.computed && node.property?.type === "Identifier") {
    return /viewport|width|height/i.test(node.property.name);
  }
  if (node?.type === "Property") {
    return node.key?.type === "Identifier" && /viewport|width|height/i.test(node.key.name);
  }
  return false;
}
function setsViewport(node) {
  return someDescendant2(node, isViewportReference);
}
function isOsMobileSetting(node) {
  if (node?.type === "Property" && node.key?.type === "Identifier" && node.key.name === "os" && isMobileLiteral(node.value)) {
    return true;
  }
  if (node?.type === "AssignmentExpression" && node.left?.type === "MemberExpression" && !node.left.computed && node.left.property?.type === "Identifier" && node.left.property.name === "os" && isMobileLiteral(node.right)) {
    return true;
  }
  return false;
}
var rule46 = {
  meta: {
    type: "problem",
    docs: {
      description: "Mobile device combos must set browserSettings.os, not just resize the viewport",
      category: "correctness",
      rationale: `The Node SDK's device emulation lever is browserSettings.os: 'mobile' | 'tablet' \u2014 there is no fingerprint API in this SDK. A "mobile" session that only resizes the Playwright viewport is still a desktop Chrome browser with a desktop user-agent string in a small window. Sites that branch behavior on UA/touch capability (the majority of responsive sites) never actually exercise their mobile code path, silently undermining "test on mobile" results.`,
      docsUrl: "https://docs.browserbase.com/features/stealth-mode",
      recommended: true
    },
    messages: {
      missingOsSetting: 'A "mobile" branch resizes the viewport but never sets browserSettings.os to "mobile"/"tablet". Without it this is still a desktop browser in a small window.'
    },
    schema: []
  },
  create(context) {
    const mobileViewportBranches = [];
    let sawOsMobileSetting = false;
    return {
      IfStatement(node) {
        if (testComparesToMobile(node.test) && setsViewport(node.consequent)) {
          mobileViewportBranches.push(node);
        }
      },
      Property(node) {
        if (isOsMobileSetting(node)) sawOsMobileSetting = true;
      },
      AssignmentExpression(node) {
        if (isOsMobileSetting(node)) sawOsMobileSetting = true;
      },
      "Program:exit"() {
        if (sawOsMobileSetting) return;
        for (const branch of mobileViewportBranches) {
          context.report({ node: branch, messageId: "missingOsSetting" });
        }
      }
    };
  }
};
var browserbaseMobileDeviceRequiresOsSettingRule = rule46;

// src/providers/browserbase/rules/use-typed-exception-status-not-substring.ts
function isStringifiedErrorSource(node, errName) {
  if (node?.type === "CallExpression" && node.callee?.type === "Identifier" && node.callee.name === "String") {
    const arg = node.arguments?.[0];
    return arg?.type === "Identifier" && arg.name === errName;
  }
  if (node?.type === "CallExpression" && node.callee?.type === "MemberExpression") {
    const obj = node.callee.object;
    const prop = node.callee.property;
    if (obj?.type === "Identifier" && obj.name === errName && prop?.type === "Identifier" && prop.name === "toString") {
      return true;
    }
  }
  if (node?.type === "MemberExpression" && !node.computed) {
    const obj = node.object;
    const prop = node.property;
    if (obj?.type === "Identifier" && obj.name === errName && prop?.type === "Identifier" && prop.name === "message") {
      return true;
    }
  }
  return false;
}
function unwrapToLowerCase(node) {
  if (node?.type === "CallExpression" && node.callee?.type === "MemberExpression" && node.callee.property?.type === "Identifier" && node.callee.property.name === "toLowerCase") {
    return node.callee.object;
  }
  return node;
}
function usesTypedStatus(body, errName) {
  return someDescendant2(body, (n) => {
    if (n.type === "MemberExpression" && !n.computed && n.object?.type === "Identifier" && n.object.name === errName) {
      return n.property?.type === "Identifier" && n.property.name === "status";
    }
    if (n.type === "BinaryExpression" && n.operator === "instanceof" && n.left?.type === "Identifier" && n.left.name === errName) {
      return true;
    }
    return false;
  });
}
function usesSubstringMatch(body, errName, stringifiedVars) {
  return someDescendant2(body, (n) => {
    if (n.type !== "CallExpression") return false;
    if (n.callee?.type !== "MemberExpression" || n.callee.computed) return false;
    if (n.callee.property?.type !== "Identifier" || n.callee.property.name !== "includes") return false;
    const source = unwrapToLowerCase(n.callee.object);
    if (isStringifiedErrorSource(source, errName)) return true;
    return source?.type === "Identifier" && stringifiedVars.has(source.name);
  });
}
function collectStringifiedVars(body, errName) {
  const names = /* @__PURE__ */ new Set();
  someDescendant2(body, (n) => {
    if (n.type === "VariableDeclarator" && n.id?.type === "Identifier" && n.init) {
      const source = unwrapToLowerCase(n.init);
      if (isStringifiedErrorSource(source, errName)) names.add(n.id.name);
    }
    return false;
  });
  return names;
}
var rule47 = {
  meta: {
    type: "suggestion",
    docs: {
      description: "Branch on err.status, not a substring match of the stringified error",
      category: "correctness",
      rationale: 'The SDK raises typed Browserbase.APIError (and subclasses like NotFoundError) carrying a real .status: number and .headers. Matching err.message or String(err) against substrings like "410" or "Session stopped" is fragile \u2014 that human-readable text is an unversioned implementation detail the provider can change at any time without notice. Check err.status (or `instanceof`) instead.',
      docsUrl: "https://docs.browserbase.com/reference/api/session-live-urls",
      recommended: true
    },
    messages: {
      substringStatusMatch: "This catch block matches a substring of the stringified error instead of checking err.status or `instanceof Browserbase.APIError`."
    },
    schema: []
  },
  create(context) {
    return {
      CatchClause(node) {
        const param = node.param;
        const errName = param?.type === "Identifier" ? param.name : void 0;
        if (!errName || !node.body) return;
        if (usesTypedStatus(node.body, errName)) return;
        const stringifiedVars = collectStringifiedVars(node.body, errName);
        if (usesSubstringMatch(node.body, errName, stringifiedVars)) {
          context.report({ node, messageId: "substringStatusMatch" });
        }
      }
    };
  }
};
var browserbaseUseTypedExceptionStatusNotSubstringRule = rule47;

// src/providers/browserbase/rules/release-session-on-connect-failure.ts
function isSessionsCreateAwait(node) {
  return node?.type === "AwaitExpression" && isSessionsCall(node.argument, "create");
}
function isConnectCall(node) {
  if (node?.type !== "CallExpression") return false;
  const callee = node.callee;
  const name = callee?.type === "Identifier" ? callee.name : memberPropName3(node);
  return !!name && /connect/i.test(name);
}
function isReleaseCall(node) {
  if (node?.type !== "CallExpression") return false;
  if (isSessionsCall(node, "update")) {
    const optsArg = node.arguments?.[1];
    const statusProp = findProperty2(optsArg, "status");
    if (statusProp?.value?.type === "Literal" && statusProp.value.value === "REQUEST_RELEASE") return true;
  }
  const callee = node.callee;
  const name = callee?.type === "Identifier" ? callee.name : memberPropName3(node);
  return !!name && /requeststop|releasesession|release_session/i.test(name);
}
var rule48 = {
  meta: {
    type: "problem",
    docs: {
      description: "A failed connect after session creation must release the session",
      category: "reliability",
      rationale: `If the CDP connect call raises after sessions.create() already succeeded on Browserbase's side, the session stays RUNNING and only terminates once its timeout elapses (up to 6h) unless something explicitly calls sessions.update(id, { status: 'REQUEST_RELEASE' }). The SDK's own docs warn to do this before the timeout "to avoid additional charges." A connect call with no try/catch (or a catch that doesn't release) leaks the session on every connect failure.`,
      docsUrl: "https://docs.browserbase.com/reference/api/update-a-session",
      recommended: true
    },
    messages: {
      sessionNotReleasedOnFailure: 'A session was created but this connect call has no catch that releases it (sessions.update with status: "REQUEST_RELEASE") on failure. A failed connect will leak the session until its timeout.'
    },
    schema: []
  },
  create(context) {
    let sawSessionCreate = false;
    const connectCalls = [];
    const tryStatements = [];
    return {
      AwaitExpression(node) {
        if (isSessionsCreateAwait(node)) sawSessionCreate = true;
      },
      TryStatement(node) {
        tryStatements.push(node);
      },
      CallExpression(node) {
        if (isConnectCall(node)) connectCalls.push(node);
      },
      "Program:exit"() {
        if (!sawSessionCreate) return;
        for (const call of connectCalls) {
          const enclosingTry = tryStatements.find((t) => t.block && contains3(t.block, call));
          const handled = !!enclosingTry?.handler && someDescendant2(enclosingTry.handler, isReleaseCall);
          if (!handled) {
            context.report({ node: call, messageId: "sessionNotReleasedOnFailure" });
          }
        }
      }
    };
  }
};
var browserbaseReleaseSessionOnConnectFailureRule = rule48;

// src/providers/browserbase/rules/dont-stack-custom-retry-on-sdk-retry.ts
var rule49 = {
  meta: {
    type: "suggestion",
    docs: {
      description: "A custom retry loop around sessions.create must disable the SDK's own retry",
      category: "reliability",
      rationale: "The Browserbase client already retries internally (default maxRetries: 2, retrying 408/409/429/5xx with Retry-After-aware exponential backoff) before ever raising an exception back to the caller. A hand-rolled retry loop around sessions.create() that does not pass { maxRetries: 0 } stacks two independent, uncoordinated backoff schedules \u2014 a sustained 429 can trigger N outer attempts x (1 + 2 SDK-internal retries), multiplying worst-case latency well beyond what either layer alone would produce.",
      docsUrl: "https://docs.browserbase.com/optimizations/concurrency/overview",
      recommended: true
    },
    messages: {
      stackedRetry: "sessions.create() is called inside a custom retry loop with no { maxRetries: 0 } override \u2014 the SDK retries this call internally too, stacking two backoff schedules."
    },
    schema: []
  },
  create(context) {
    const loopRanges = [];
    return {
      ForStatement(node) {
        loopRanges.push(node);
      },
      WhileStatement(node) {
        loopRanges.push(node);
      },
      DoWhileStatement(node) {
        loopRanges.push(node);
      },
      CallExpression(node) {
        if (!isSessionsCall(node, "create")) return;
        const insideLoop = loopRanges.some((loop) => {
          const start = loop.range?.[0] ?? loop.start;
          const end = loop.range?.[1] ?? loop.end;
          const pos = node.range?.[0] ?? node.start;
          return pos >= start && pos <= end;
        });
        if (!insideLoop) return;
        const optsArg = node.arguments?.[1];
        const hasMaxRetries = optsArg?.type === "ObjectExpression" && !!findProperty2(optsArg, "maxRetries");
        if (!hasMaxRetries) {
          context.report({ node, messageId: "stackedRetry" });
        }
      }
    };
  }
};
var browserbaseDontStackCustomRetryOnSdkRetryRule = rule49;

// src/providers/browserbase/rules/no-overbroad-error-substring-match.ts
var OVERBROAD_TERMS = /* @__PURE__ */ new Set(["session", "context", "browser", "browserbase"]);
function collectIncludesLiterals(test, literals) {
  if (!test) return;
  if (test.type === "LogicalExpression" && test.operator === "||") {
    collectIncludesLiterals(test.left, literals);
    collectIncludesLiterals(test.right, literals);
    return;
  }
  if (test.type === "CallExpression" && memberPropName3(test) === "includes") {
    const arg = test.arguments?.[0];
    if (arg?.type === "Literal" && typeof arg.value === "string") literals.push(arg.value.toLowerCase());
  }
}
function isCleanupCall(node) {
  if (node?.type !== "CallExpression") return false;
  const callee = node.callee;
  const name = callee?.type === "Identifier" ? callee.name : memberPropName3(node);
  return !!name && /release|remove|cleanup|stop|teardown/i.test(name);
}
var rule50 = {
  meta: {
    type: "problem",
    docs: {
      description: "Error-message checks must not OR in a single generic resource-name substring",
      category: "reliability",
      rationale: 'A condition like `err.includes("not found") || err.includes("404") || err.includes("session")` looks like it is narrowing to a confirmed session-ended error, but the last clause matches a single generic word \u2014 the name of the resource being polled. Virtually any exception raised from a sessions.* call (a connection reset, an SSL error, a generic timeout that echoes the request URL) is likely to contain that substring too. A coincidental match then triggers the same destructive cleanup as a real 404/410, tearing down a healthy session on a transient blip.',
      docsUrl: "https://docs.browserbase.com/reference/api/session-live-urls",
      recommended: true
    },
    messages: {
      overbroadMatch: 'This OR-chain includes a generic substring check ("{{term}}") that matches almost any error from a sessions.* call, not just a confirmed session-ended response.'
    },
    schema: []
  },
  create(context) {
    return {
      IfStatement(node) {
        const literals = [];
        collectIncludesLiterals(node.test, literals);
        if (literals.length < 2) return;
        const overbroad = literals.find((l) => OVERBROAD_TERMS.has(l));
        if (!overbroad) return;
        if (someDescendant2(node.consequent, isCleanupCall)) {
          context.report({ node, messageId: "overbroadMatch", data: { term: overbroad } });
        }
      }
    };
  }
};
var browserbaseNoOverbroadErrorSubstringMatchRule = rule50;

// src/providers/browserbase/rules/use-sdk-not-raw-requests.ts
var BROWSERBASE_HOST = "api.browserbase.com";
function templateLiteralContainsHost(node) {
  return (node.quasis ?? []).some((q) => {
    const text = q?.value?.cooked ?? q?.value?.raw ?? "";
    return typeof text === "string" && text.includes(BROWSERBASE_HOST);
  });
}
function urlArgContainsHost(node) {
  if (node?.type === "Literal" && typeof node.value === "string") return node.value.includes(BROWSERBASE_HOST);
  if (node?.type === "TemplateLiteral") return templateLiteralContainsHost(node);
  return false;
}
function isRawHttpCall(node) {
  if (node?.type !== "CallExpression") return { isCall: false, urlArg: void 0 };
  const callee = node.callee;
  if (callee?.type === "Identifier" && callee.name === "fetch") {
    return { isCall: true, urlArg: node.arguments?.[0] };
  }
  if (callee?.type === "MemberExpression" && !callee.computed && callee.property?.type === "Identifier") {
    const objName = callee.object?.type === "Identifier" ? callee.object.name : void 0;
    const methodName = callee.property.name;
    if (objName && /^(axios|http|https)$/i.test(objName) && /^(get|post|put|patch|delete|request)$/i.test(methodName)) {
      return { isCall: true, urlArg: node.arguments?.[0] };
    }
  }
  if (callee?.type === "Identifier" && callee.name === "axios") {
    const arg = node.arguments?.[0];
    if (arg?.type === "ObjectExpression") {
      const urlProp = arg.properties?.find(
        (p) => p?.type === "Property" && p.key?.type === "Identifier" && p.key.name === "url"
      );
      return { isCall: true, urlArg: urlProp?.value };
    }
    return { isCall: true, urlArg: arg };
  }
  return { isCall: false, urlArg: void 0 };
}
var rule51 = {
  meta: {
    type: "suggestion",
    docs: {
      description: "Use the installed Browserbase SDK instead of hand-rolled HTTP requests",
      category: "integration",
      rationale: "A raw fetch/axios/http call to an api.browserbase.com endpoint duplicates a method the installed SDK already exposes (e.g. sessions.recording.retrieve()), forfeiting its typed exceptions, built-in retry/backoff, and consistent error handling \u2014 and risks drifting on auth header naming or response shape as the API evolves.",
      docsUrl: "https://docs.browserbase.com/reference/sdk/nodejs",
      recommended: true
    },
    messages: {
      rawRequestToBrowserbase: "This makes a raw HTTP request to a Browserbase API endpoint instead of using the installed SDK."
    },
    schema: []
  },
  create(context) {
    const urlVars = /* @__PURE__ */ new Map();
    return {
      VariableDeclarator(node) {
        if (node.id?.type === "Identifier" && urlArgContainsHost(node.init)) {
          urlVars.set(node.id.name, node.init);
        }
      },
      CallExpression(node) {
        const { isCall, urlArg } = isRawHttpCall(node);
        if (!isCall || !urlArg) return;
        const resolved = urlArg.type === "Identifier" ? urlVars.get(urlArg.name) ?? urlArg : urlArg;
        if (urlArgContainsHost(resolved)) {
          context.report({ node, messageId: "rawRequestToBrowserbase" });
        }
      }
    };
  }
};
var browserbaseUseSdkNotRawRequestsRule = rule51;

// src/providers/browserbase/rules/centralize-request-release.ts
var rule52 = {
  meta: {
    type: "suggestion",
    docs: {
      description: "Route REQUEST_RELEASE through a single shared abstraction",
      category: "integration",
      rationale: 'sessions.update(id, { status: "REQUEST_RELEASE" }) hand-rolled inline at each call site, with each one carrying slightly different error handling, means an API change (a new required field, a renamed status value) requires fixing every call site instead of one \u2014 and the duplicated copies already drift in error-handling quality. Centralize behind one designated provider method (e.g. requestStop()/releaseSession()) and call that everywhere instead.',
      docsUrl: "https://docs.browserbase.com/reference/api/update-a-session",
      recommended: true
    },
    messages: {
      inlineRequestRelease: 'sessions.update(..., { status: "REQUEST_RELEASE" }) is hand-rolled inline here. Route this through a single shared release/provider abstraction instead.'
    },
    schema: []
  },
  create(context) {
    const filename = String(context.filename ?? "");
    if (isInsideTestFile3(filename) || /provider|browserbaseclient/i.test(filename)) {
      return {};
    }
    return {
      CallExpression(node) {
        if (!isSessionsCall(node, "update")) return;
        const optsArg = node.arguments?.[1];
        const statusProp = findProperty2(optsArg, "status");
        const val = statusProp?.value;
        if (val?.type === "Literal" && val.value === "REQUEST_RELEASE") {
          context.report({ node, messageId: "inlineRequestRelease" });
        }
      }
    };
  }
};
var browserbaseCentralizeRequestReleaseRule = rule52;

// src/providers/openai-cua/rules/no-domain-allowlist.ts
var ACTION_METHOD_NAMES = /* @__PURE__ */ new Set(["click", "type", "press", "move", "goto", "fill", "dblclick", "dragAndDrop"]);
var rule53 = {
  meta: {
    type: "problem",
    docs: {
      description: "Computer-use action execution must check the page origin against an allowlist",
      category: "security",
      cwe: "CWE-284",
      owasp: "A01:2021 \u2013 Broken Access Control",
      rationale: `OpenAI's Computer Use guide instructs integrators to "keep an allow list of domains and actions your agent should use, and block everything else." Without an origin check before executing actions, a click that follows an off-domain redirect (phishing link, ad, malicious iframe) is executed exactly like any in-domain click \u2014 and a field-fill action has no origin awareness either, so credentials could be typed into a page the agent was never meant to reach.`,
      docsUrl: "https://developers.openai.com/api/docs/guides/tools-computer-use",
      recommended: true
    },
    messages: {
      noOriginCheck: "This function executes computer-use actions on the current page with no origin/domain allowlist check anywhere in it."
    }
  },
  create(context) {
    const stack = [];
    const states = /* @__PURE__ */ new Map();
    function ensureState(fn) {
      let s = states.get(fn);
      if (!s) {
        s = { sawAction: false, actionNode: null, sawOriginCheck: false };
        states.set(fn, s);
      }
      return s;
    }
    function top() {
      return stack[stack.length - 1];
    }
    function pushScope(node) {
      stack.push(node);
      ensureState(node);
    }
    function popScope() {
      stack.pop();
    }
    function propName2(node) {
      if (!node) return void 0;
      if (node.type === "Identifier") return node.name;
      if (node.type === "Literal" && typeof node.value === "string") return node.value;
      return void 0;
    }
    function memberChainNames2(node, names = []) {
      if (node?.type === "MemberExpression") {
        memberChainNames2(node.object, names);
        const n = propName2(node.property);
        if (n) names.push(n);
      } else if (node?.type === "Identifier") {
        names.push(node.name);
      }
      return names;
    }
    function isPageActionCall(node) {
      if (node?.type !== "CallExpression") return false;
      if (node.callee?.type !== "MemberExpression") return false;
      const chain = memberChainNames2(node.callee);
      if (chain.length === 0) return false;
      const last = chain[chain.length - 1];
      if (!ACTION_METHOD_NAMES.has(last)) return false;
      return chain.some((n) => /^page$/i.test(n) || /page$/i.test(n));
    }
    function markOriginCheckSeen() {
      const fn = top();
      if (fn) ensureState(fn).sawOriginCheck = true;
    }
    return {
      Program(node) {
        pushScope(node);
      },
      "Program:exit"() {
        for (const state of states.values()) {
          if (state.sawAction && !state.sawOriginCheck) {
            context.report({ node: state.actionNode, messageId: "noOriginCheck" });
          }
        }
      },
      FunctionDeclaration(node) {
        pushScope(node);
      },
      "FunctionDeclaration:exit"() {
        popScope();
      },
      FunctionExpression(node) {
        pushScope(node);
      },
      "FunctionExpression:exit"() {
        popScope();
      },
      ArrowFunctionExpression(node) {
        pushScope(node);
      },
      "ArrowFunctionExpression:exit"() {
        popScope();
      },
      CallExpression(node) {
        if (isPageActionCall(node)) {
          const fn = top();
          if (fn) {
            const state = ensureState(fn);
            if (!state.sawAction) {
              state.sawAction = true;
              state.actionNode = node;
            }
          }
        }
      },
      NewExpression(node) {
        if (node.callee?.type === "Identifier" && node.callee.name === "URL") {
          markOriginCheckSeen();
        }
      },
      MemberExpression(node) {
        const name = propName2(node.property);
        if (name === "hostname" || name === "origin") {
          markOriginCheckSeen();
        }
      },
      Identifier(node) {
        if (/allow.?list/i.test(node.name) || /allowed.?domain/i.test(node.name)) {
          markOriginCheckSeen();
        }
      }
    };
  }
};
var openaiCuaNoDomainAllowlistRule = rule53;

// src/providers/openai-cua/rules/scroll-delta-default-zero.ts
var VERTICAL_DELTA_NAME_PATTERN = /^(dy|delta_?y|scroll_?y)$/i;
var rule54 = {
  meta: {
    type: "problem",
    docs: {
      description: "A missing vertical scroll delta must default to 0, not an arbitrary non-zero value",
      category: "correctness",
      rationale: "The reference scroll handler in OpenAI's Computer Use guide defaults a missing scroll delta to 0 on both axes. Defaulting the vertical delta to any other value injects an unintended scroll the model never asked for whenever it omits that field, desyncing the model's mental model of the page from the page's actual state on the next turn.",
      docsUrl: "https://developers.openai.com/api/docs/guides/tools-computer-use",
      recommended: true
    },
    messages: {
      nonZeroDefault: "A missing vertical scroll delta defaults to {{value}} here instead of 0, injecting an unintended scroll the model never requested."
    }
  },
  create(context) {
    function propName2(node) {
      if (!node) return void 0;
      if (node.type === "Identifier") return node.name;
      if (node.type === "Literal" && typeof node.value === "string") return node.value;
      return void 0;
    }
    function targetName(node) {
      if (node?.type === "Identifier") return node.name;
      if (node?.type === "MemberExpression") return propName2(node.property);
      return void 0;
    }
    function isNonZeroNumberLiteral(node) {
      return node?.type === "Literal" && typeof node.value === "number" && node.value !== 0;
    }
    function reportIfBadDefault(targetNode, valueNode, reportNode) {
      const name = targetName(targetNode);
      if (!name || !VERTICAL_DELTA_NAME_PATTERN.test(name)) return;
      if (!isNonZeroNumberLiteral(valueNode)) return;
      context.report({ node: reportNode, messageId: "nonZeroDefault", data: { value: String(valueNode.value) } });
    }
    function findDirectAssignment(stmt) {
      let inner = stmt;
      if (inner?.type === "BlockStatement") {
        const exprStmts = (inner.body ?? []).filter((s) => s.type === "ExpressionStatement");
        if (exprStmts.length !== 1) return void 0;
        inner = exprStmts[0];
      }
      if (inner?.type !== "ExpressionStatement") return void 0;
      const expr = inner.expression;
      if (expr?.type !== "AssignmentExpression" || expr.operator !== "=") return void 0;
      return { target: expr.left, value: expr.right };
    }
    function undefinedCheckTargetName(test) {
      if (test?.type !== "BinaryExpression") return void 0;
      if (test.operator !== "===" && test.operator !== "==") return void 0;
      const sides = [test.left, test.right];
      const undefinedSide = sides.find(
        (s) => s?.type === "Identifier" && s.name === "undefined" || s?.type === "Literal" && s.value === null || s?.type === "UnaryExpression" && s.operator === "typeof"
      );
      const otherSide = sides.find((s) => s !== undefinedSide);
      if (!undefinedSide || !otherSide) return void 0;
      if (undefinedSide.type === "UnaryExpression") {
        return targetName(undefinedSide.argument);
      }
      return targetName(otherSide);
    }
    return {
      LogicalExpression(node) {
        if (node.operator !== "??") return;
        reportIfBadDefault(node.left, node.right, node);
      },
      IfStatement(node) {
        const name = undefinedCheckTargetName(node.test);
        if (!name) return;
        const assignment = findDirectAssignment(node.consequent);
        if (!assignment) return;
        reportIfBadDefault(assignment.target, assignment.value, node);
      }
    };
  }
};
var openaiCuaScrollDeltaDefaultZeroRule = rule54;

// src/providers/openai-cua/rules/structured-step-metadata-not-text-json.ts
var BRACE_SEARCH_METHODS = /* @__PURE__ */ new Set(["indexOf", "lastIndexOf"]);
var SLICE_METHODS = /* @__PURE__ */ new Set(["slice", "substring", "substr"]);
var rule55 = {
  meta: {
    type: "suggestion",
    docs: {
      description: "Step metadata must come from structured tool output, not brace-hunting in free text",
      category: "correctness",
      rationale: "Manually locating a JSON object inside a free-text model message (via indexOf/lastIndexOf plus a slice) is fragile by construction: it breaks if the model adds trailing commentary, wraps the JSON in a markdown fence, or reorders fields. The Responses API supports function tools and structured output specifically so required metadata is schema-validated by the API instead of regex/brace-scraped out of arbitrary text.",
      docsUrl: "https://developers.openai.com/api/docs/guides/tools-computer-use",
      recommended: true
    },
    messages: {
      textJsonExtraction: "This function locates a JSON object in free text via indexOf/lastIndexOf and parses a slice of it \u2014 use a function tool or structured output instead of brace-hunting in the model's text message."
    }
  },
  create(context) {
    const stack = [];
    const states = /* @__PURE__ */ new Map();
    function ensureState(fn) {
      let s = states.get(fn);
      if (!s) {
        s = { sawBraceSearch: false, sawJsonParseOnSlice: false, reportNode: null };
        states.set(fn, s);
      }
      return s;
    }
    function top() {
      return stack[stack.length - 1];
    }
    function pushScope(node) {
      stack.push(node);
      ensureState(node);
    }
    function popScope() {
      stack.pop();
    }
    function isBraceSearchCall(node) {
      if (node?.type !== "CallExpression") return false;
      const callee = node.callee;
      if (callee?.type !== "MemberExpression") return false;
      if (!BRACE_SEARCH_METHODS.has(callee.property?.name)) return false;
      const arg = node.arguments?.[0];
      return arg?.type === "Literal" && typeof arg.value === "string" && arg.value.includes("{");
    }
    function isJsonParseOnSliceCall(node) {
      if (node?.type !== "CallExpression") return false;
      const callee = node.callee;
      if (callee?.type !== "MemberExpression") return false;
      if (callee.object?.type !== "Identifier" || callee.object.name !== "JSON") return false;
      if (callee.property?.name !== "parse") return false;
      const arg = node.arguments?.[0];
      if (arg?.type !== "CallExpression") return false;
      const argCallee = arg.callee;
      return argCallee?.type === "MemberExpression" && SLICE_METHODS.has(argCallee.property?.name);
    }
    return {
      Program(node) {
        pushScope(node);
      },
      "Program:exit"() {
        for (const state of states.values()) {
          if (state.sawBraceSearch && state.sawJsonParseOnSlice) {
            context.report({ node: state.reportNode, messageId: "textJsonExtraction" });
          }
        }
      },
      FunctionDeclaration(node) {
        pushScope(node);
      },
      "FunctionDeclaration:exit"() {
        popScope();
      },
      FunctionExpression(node) {
        pushScope(node);
      },
      "FunctionExpression:exit"() {
        popScope();
      },
      ArrowFunctionExpression(node) {
        pushScope(node);
      },
      "ArrowFunctionExpression:exit"() {
        popScope();
      },
      CallExpression(node) {
        const fn = top();
        if (!fn) return;
        const state = ensureState(fn);
        if (isBraceSearchCall(node)) {
          state.sawBraceSearch = true;
          if (!state.reportNode) state.reportNode = node;
        }
        if (isJsonParseOnSliceCall(node)) {
          state.sawJsonParseOnSlice = true;
          if (!state.reportNode) state.reportNode = node;
        }
      }
    };
  }
};
var openaiCuaStructuredStepMetadataNotTextJsonRule = rule55;

// src/providers/openai-cua/rules/no-blind-safety-check-ack.ts
var rule56 = {
  meta: {
    type: "suggestion",
    docs: {
      description: "Acknowledging pending safety checks must evaluate each check, not blanket-pass them",
      category: "correctness",
      rationale: "`acknowledged_safety_checks` exists specifically so a developer can selectively confirm checks they have actually reviewed \u2014 each entry carries an id/code/message. A filter that only checks the row's shape (e.g. that it is an object) and never inspects `.code` or `.message` acknowledges every check present, defeating the purpose of the field entirely.",
      docsUrl: "https://developers.openai.com/api/docs/guides/tools-computer-use",
      recommended: true
    },
    messages: {
      blindAck: "This filter never inspects .code or .message on each safety check \u2014 it acknowledges every check present instead of evaluating it against a policy."
    }
  },
  create(context) {
    function propName2(node) {
      if (!node) return void 0;
      if (node.type === "Identifier") return node.name;
      if (node.type === "Literal" && typeof node.value === "string") return node.value;
      return void 0;
    }
    function sourceLooksLikeSafetyChecks(node) {
      if (!node) return false;
      const name = propName2(node) ?? (node.type === "MemberExpression" ? propName2(node.property) : void 0);
      if (name && /safety.?check/i.test(name)) return true;
      if (node.type === "LogicalExpression") {
        return sourceLooksLikeSafetyChecks(node.left) || sourceLooksLikeSafetyChecks(node.right);
      }
      if (node.type === "MemberExpression") {
        return sourceLooksLikeSafetyChecks(node.object) || sourceLooksLikeSafetyChecks(node.property);
      }
      return false;
    }
    function referencesCodeOrMessage(node, depth = 0) {
      if (!node || typeof node !== "object" || depth > 10) return false;
      if (Array.isArray(node)) return node.some((n) => referencesCodeOrMessage(n, depth + 1));
      if (node.type === "MemberExpression") {
        const name = propName2(node.property);
        if (name === "code" || name === "message") return true;
      }
      for (const key of Object.keys(node)) {
        if (key === "parent" || key === "loc" || key === "range") continue;
        const val = node[key];
        if (val && typeof val === "object") {
          if (referencesCodeOrMessage(val, depth + 1)) return true;
        }
      }
      return false;
    }
    return {
      CallExpression(node) {
        const callee = node.callee;
        if (callee?.type !== "MemberExpression" || callee.property?.name !== "filter") return;
        if (!sourceLooksLikeSafetyChecks(callee.object)) return;
        const fn = node.arguments?.[0];
        if (fn?.type !== "ArrowFunctionExpression" && fn?.type !== "FunctionExpression") return;
        if (!referencesCodeOrMessage(fn.body)) {
          context.report({ node, messageId: "blindAck" });
        }
      }
    };
  }
};
var openaiCuaNoBlindSafetyCheckAckRule = rule56;

// src/providers/openai-cua/utils.ts
function propName(node) {
  if (!node) return void 0;
  if (node.type === "Identifier") return node.name;
  if (node.type === "Literal" && typeof node.value === "string") return node.value;
  return void 0;
}
function memberChainNames(node, names = []) {
  if (node?.type === "MemberExpression") {
    memberChainNames(node.object, names);
    const n = propName(node.property);
    if (n) names.push(n);
  } else if (node?.type === "Identifier") {
    names.push(node.name);
  }
  return names;
}
function isResponsesCreateCall(node) {
  if (node?.type !== "CallExpression" || node.callee?.type !== "MemberExpression") return false;
  const chain = memberChainNames(node.callee);
  return chain.length >= 2 && chain[chain.length - 1] === "create" && chain[chain.length - 2] === "responses";
}
function findResponsesCreateCall(node, depth = 0) {
  if (!node || typeof node !== "object" || depth > 12) return null;
  if (Array.isArray(node)) {
    for (const n of node) {
      const found = findResponsesCreateCall(n, depth + 1);
      if (found) return found;
    }
    return null;
  }
  if (isResponsesCreateCall(node)) return node;
  for (const key of Object.keys(node)) {
    if (key === "parent" || key === "loc" || key === "range") continue;
    const val = node[key];
    if (val && typeof val === "object") {
      const found = findResponsesCreateCall(val, depth + 1);
      if (found) return found;
    }
  }
  return null;
}

// src/providers/openai-cua/rules/retry-transient-turn-errors.ts
var rule57 = {
  meta: {
    type: "problem",
    docs: {
      description: "A responses.create() call must be retried at the turn level on transient errors",
      category: "reliability",
      rationale: "The SDK's own internal retry budget (DEFAULT_MAX_RETRIES) is finite. Treating any exception that survives it as fatal for the whole run \u2014 instead of retrying that one turn with backoff \u2014 means a single transient RateLimitError/APIConnectionError/InternalServerError can discard a long-running, multi-turn, expensive agent loop that may have already executed dozens of prior turns.",
      docsUrl: "https://developers.openai.com/api/docs/guides/tools-computer-use",
      recommended: true
    },
    messages: {
      noTurnRetry: "This responses.create() call has no turn-level retry \u2014 neither a surrounding loop nor a retry call in the catch block \u2014 so any error beyond the SDK's own retry budget ends the entire run."
    }
  },
  create(context) {
    let loopDepth = 0;
    function propName2(node) {
      if (!node) return void 0;
      if (node.type === "Identifier") return node.name;
      if (node.type === "Literal" && typeof node.value === "string") return node.value;
      return void 0;
    }
    function catchHasRetryCall(node, depth = 0) {
      if (!node || typeof node !== "object" || depth > 12) return false;
      if (Array.isArray(node)) return node.some((n) => catchHasRetryCall(n, depth + 1));
      if (node.type === "CallExpression") {
        const callee = node.callee;
        const name = callee?.type === "Identifier" ? callee.name : callee?.type === "MemberExpression" ? propName2(callee.property) : void 0;
        if (name && /retry/i.test(name)) return true;
      }
      for (const key of Object.keys(node)) {
        if (key === "parent" || key === "loc" || key === "range") continue;
        const val = node[key];
        if (val && typeof val === "object") {
          if (catchHasRetryCall(val, depth + 1)) return true;
        }
      }
      return false;
    }
    return {
      ForStatement() {
        loopDepth += 1;
      },
      "ForStatement:exit"() {
        loopDepth -= 1;
      },
      WhileStatement() {
        loopDepth += 1;
      },
      "WhileStatement:exit"() {
        loopDepth -= 1;
      },
      DoWhileStatement() {
        loopDepth += 1;
      },
      "DoWhileStatement:exit"() {
        loopDepth -= 1;
      },
      ForOfStatement() {
        loopDepth += 1;
      },
      "ForOfStatement:exit"() {
        loopDepth -= 1;
      },
      ForInStatement() {
        loopDepth += 1;
      },
      "ForInStatement:exit"() {
        loopDepth -= 1;
      },
      TryStatement(node) {
        const createCall = findResponsesCreateCall(node.block);
        if (!createCall) return;
        if (loopDepth > 0) return;
        const handler = node.handler;
        if (!handler) return;
        if (catchHasRetryCall(handler.body)) return;
        context.report({ node: handler, messageId: "noTurnRetry" });
      }
    };
  }
};
var openaiCuaRetryTransientTurnErrorsRule = rule57;

// src/providers/openai-cua/rules/check-response-status-incomplete.ts
var rule58 = {
  meta: {
    type: "problem",
    docs: {
      description: 'A completion check must rule out response.status === "incomplete" before reporting success',
      category: "reliability",
      rationale: 'The Responses API can return status "incomplete" with zero visible message output when generation is cut off by the token budget \u2014 the same shape ("no computer_call, no message") a purely structural completion check treats as "the model voluntarily finished." Without checking response.status, a token-budget truncation can be silently reported as a successful task completion.',
      docsUrl: "https://developers.openai.com/api/docs/guides/tools-computer-use",
      recommended: true
    },
    messages: {
      missingIncompleteCheck: 'This treats the absence of tool calls as a successful completion, but never checks response.status === "incomplete" \u2014 a token-budget truncation can be misreported as success.'
    }
  },
  create(context) {
    const stack = [];
    const states = /* @__PURE__ */ new Map();
    function ensureState(fn) {
      let s = states.get(fn);
      if (!s) {
        s = { sawCreateCall: false, sawSuccessReturn: false, successNode: null, sawStatusCheck: false };
        states.set(fn, s);
      }
      return s;
    }
    function top() {
      return stack[stack.length - 1];
    }
    function pushScope(node) {
      stack.push(node);
      ensureState(node);
    }
    function popScope() {
      stack.pop();
    }
    function propName2(node) {
      if (!node) return void 0;
      if (node.type === "Identifier") return node.name;
      if (node.type === "Literal" && typeof node.value === "string") return node.value;
      return void 0;
    }
    function isSuccessObjectLiteral(node) {
      if (node?.type !== "ObjectExpression") return false;
      return (node.properties ?? []).some((p) => {
        if (p?.type !== "Property") return false;
        const keyName = propName2(p.key);
        return (keyName === "success" || keyName === "completed") && p.value?.type === "Literal" && p.value.value === true;
      });
    }
    return {
      Program(node) {
        pushScope(node);
      },
      "Program:exit"() {
        for (const state of states.values()) {
          if (state.sawCreateCall && state.sawSuccessReturn && !state.sawStatusCheck) {
            context.report({ node: state.successNode, messageId: "missingIncompleteCheck" });
          }
        }
      },
      FunctionDeclaration(node) {
        pushScope(node);
      },
      "FunctionDeclaration:exit"() {
        popScope();
      },
      FunctionExpression(node) {
        pushScope(node);
      },
      "FunctionExpression:exit"() {
        popScope();
      },
      ArrowFunctionExpression(node) {
        pushScope(node);
      },
      "ArrowFunctionExpression:exit"() {
        popScope();
      },
      CallExpression(node) {
        if (findResponsesCreateCall(node)) {
          const fn = top();
          if (fn) ensureState(fn).sawCreateCall = true;
        }
      },
      ObjectExpression(node) {
        if (isSuccessObjectLiteral(node)) {
          const fn = top();
          if (fn) {
            const state = ensureState(fn);
            if (!state.sawSuccessReturn) {
              state.sawSuccessReturn = true;
              state.successNode = node;
            }
          }
        }
      },
      BinaryExpression(node) {
        if (node.operator !== "===" && node.operator !== "==") return;
        const sides = [node.left, node.right];
        const statusSide = sides.find((s) => s?.type === "MemberExpression" && propName2(s.property) === "status");
        const valueSide = sides.find((s) => s !== statusSide);
        if (statusSide && valueSide?.type === "Literal" && valueSide.value === "incomplete") {
          const fn = top();
          if (fn) ensureState(fn).sawStatusCheck = true;
        }
      }
    };
  }
};
var openaiCuaCheckResponseStatusIncompleteRule = rule58;

// src/providers/openai-cua/rules/set-safety-identifier.ts
var rule59 = {
  meta: {
    type: "problem",
    docs: {
      description: "responses.create() must set safety_identifier for per-end-user policy attribution",
      category: "integration",
      rationale: "OpenAI documents that a stable per-end-user safety_identifier lets policy violations be attributed and acted on per end user. Without one on a multi-tenant integration routing many customers through a single shared API key, a single customer triggering a high-confidence policy-violation heuristic can result in access being temporarily revoked for the entire organization, not just the offending identifier.",
      docsUrl: "https://help.openai.com/en/articles/5428082-how-to-incorporate-a-safety-identifier",
      recommended: true
    },
    messages: {
      missingSafetyIdentifier: "This responses.create() call sets no safety_identifier (or user) \u2014 a policy violation here could be attributed to the entire shared API key instead of one end user."
    }
  },
  create(context) {
    function propName2(node) {
      if (!node) return void 0;
      if (node.type === "Identifier") return node.name;
      if (node.type === "Literal" && typeof node.value === "string") return node.value;
      return void 0;
    }
    return {
      CallExpression(node) {
        if (!isResponsesCreateCall(node)) return;
        const optionsArg = node.arguments?.[0];
        if (optionsArg?.type !== "ObjectExpression") return;
        const hasIdentifier = (optionsArg.properties ?? []).some((p) => {
          if (p?.type !== "Property") return false;
          const keyName = propName2(p.key);
          return keyName === "safety_identifier" || keyName === "user";
        });
        if (!hasIdentifier) {
          context.report({ node, messageId: "missingSafetyIdentifier" });
        }
      }
    };
  }
};
var openaiCuaSetSafetyIdentifierRule = rule59;

// src/plugin/index.ts
var plugin = {
  meta: { name: PLUGIN_NAME, version: "0.0.1" },
  rules: {
    "resend-webhook-signature": resendWebhookSignatureRule,
    "resend-api-key-hardcoded": resendApiKeyHardcodedRule,
    "resend-api-key-in-client-bundle": resendApiKeyInClientBundleRule,
    "resend-marketing-via-batch-send": resendMarketingViaBatchSendRule,
    "resend-marketing-missing-unsubscribe": resendMarketingMissingUnsubscribeRule,
    "resend-test-domain-in-production-path": resendTestDomainInProductionPathRule,
    "resend-from-address-not-friendly-format": resendFromAddressNotFriendlyFormatRule,
    "resend-batch-size-not-enforced": resendBatchSizeNotEnforcedRule,
    "resend-missing-idempotency-key": resendMissingIdempotencyKeyRule,
    "resend-no-error-code-mapping": resendNoErrorCodeMappingRule,
    "resend-webhook-no-idempotency": resendWebhookNoIdempotencyRule,
    "resend-missing-tags": resendMissingTagsRule,
    "resend-request-id-not-logged": resendRequestIdNotLoggedRule,
    "supabase-scope-queries-by-tenant-column": supabaseScopeQueriesByTenantColumnRule,
    "supabase-validate-uuid-columns": supabaseValidateUuidColumnsRule,
    "supabase-order-by-timestamp-not-identity": supabaseOrderByTimestampNotIdentityRule,
    "supabase-consistent-input-length-limits": supabaseConsistentInputLengthLimitsRule,
    "supabase-idempotent-mutations": supabaseIdempotentMutationsRule,
    "supabase-fail-fast-env-validation": supabaseFailFastEnvValidationRule,
    "supabase-no-user-metadata-authz": supabaseNoUserMetadataAuthzRule,
    "supabase-single-without-error-check": supabaseSingleWithoutErrorCheckRule,
    "supabase-non-atomic-replace-pattern": supabaseNonAtomicReplacePatternRule,
    "supabase-unchecked-mutation-error": supabaseUncheckedMutationErrorRule,
    "supabase-realtime-missing-filter": supabaseRealtimeMissingFilterRule,
    "supabase-storage-error-not-surfaced": supabaseStorageErrorNotSurfacedRule,
    "auth0-required-audience-validation": auth0RequiredAudienceValidationRule,
    "auth0-no-account-link-without-verified-email": auth0NoAccountLinkWithoutVerifiedEmailRule,
    "auth0-dead-claim-verification-check": auth0DeadClaimVerificationCheckRule,
    "auth0-jwks-refresh-on-unknown-kid": auth0JwksRefreshOnUnknownKidRule,
    "firebase-missing-app-check": firebaseMissingAppCheckRule,
    "firebase-unhandled-auth-popup-rejection": firebaseUnhandledAuthPopupRejectionRule,
    "firebase-rtdb-list-read-for-single-item": firebaseRtdbListReadForSingleItemRule,
    "firebase-unvalidated-external-data-to-rtdb": firebaseUnvalidatedExternalDataToRtdbRule,
    "firebase-rtdb-batch-write-not-atomic": firebaseRtdbBatchWriteNotAtomicRule,
    "firebase-rtdb-listener-error-not-handled": firebaseRtdbListenerErrorNotHandledRule,
    "firebase-effect-deps-whole-user-object": firebaseEffectDepsWholeUserObjectRule,
    "firebase-rtdb-write-promise-not-handled": firebaseRtdbWritePromiseNotHandledRule,
    "lovable-no-client-side-secret-fetch": lovableNoClientSideSecretFetchRule,
    "lovable-paid-flag-without-edge-function": lovablePaidFlagWithoutEdgeFunctionRule,
    "lovable-expiry-column-never-checked": lovableExpiryColumnNeverCheckedRule,
    "lovable-silent-catch-on-provider-call": lovableSilentCatchOnProviderCallRule,
    "browserbase-no-conditional-authz-on-anonymous-user": browserbaseNoConditionalAuthzOnAnonymousUserRule,
    "browserbase-no-connect-url-in-api-response": browserbaseNoConnectUrlInApiResponseRule,
    "browserbase-session-id-requires-ownership-check": browserbaseSessionIdRequiresOwnershipCheckRule,
    "browserbase-no-concurrent-shared-context": browserbaseNoConcurrentSharedContextRule,
    "browserbase-mobile-device-requires-os-setting": browserbaseMobileDeviceRequiresOsSettingRule,
    "browserbase-use-typed-exception-status-not-substring": browserbaseUseTypedExceptionStatusNotSubstringRule,
    "browserbase-release-session-on-connect-failure": browserbaseReleaseSessionOnConnectFailureRule,
    "browserbase-dont-stack-custom-retry-on-sdk-retry": browserbaseDontStackCustomRetryOnSdkRetryRule,
    "browserbase-no-overbroad-error-substring-match": browserbaseNoOverbroadErrorSubstringMatchRule,
    "browserbase-use-sdk-not-raw-requests": browserbaseUseSdkNotRawRequestsRule,
    "browserbase-centralize-request-release": browserbaseCentralizeRequestReleaseRule,
    "openai-cua-no-domain-allowlist": openaiCuaNoDomainAllowlistRule,
    "openai-cua-scroll-delta-default-zero": openaiCuaScrollDeltaDefaultZeroRule,
    "openai-cua-structured-step-metadata-not-text-json": openaiCuaStructuredStepMetadataNotTextJsonRule,
    "openai-cua-no-blind-safety-check-ack": openaiCuaNoBlindSafetyCheckAckRule,
    "openai-cua-retry-transient-turn-errors": openaiCuaRetryTransientTurnErrorsRule,
    "openai-cua-check-response-status-incomplete": openaiCuaCheckResponseStatusIncompleteRule,
    "openai-cua-set-safety-identifier": openaiCuaSetSafetyIdentifierRule
  }
};
var plugin_default = plugin;
export {
  plugin_default as default,
  plugin
};
//# sourceMappingURL=plugin.js.map