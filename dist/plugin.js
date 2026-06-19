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

// src/providers/railway/utils.ts
var HTTP_METHODS = /* @__PURE__ */ new Set([
  "GET",
  "POST",
  "PUT",
  "PATCH",
  "DELETE",
  "HEAD",
  "OPTIONS"
]);
var MUTATING_METHODS = /* @__PURE__ */ new Set(["POST", "PUT", "PATCH", "DELETE"]);
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
function importSourceOf(node) {
  if (node?.type !== "ImportDeclaration") return null;
  return typeof node.source?.value === "string" ? node.source.value : null;
}
function requireSourceOf(node) {
  if (node?.type !== "CallExpression") return null;
  if (node.callee?.type !== "Identifier" || node.callee.name !== "require") return null;
  const arg = node.arguments?.[0];
  return arg?.type === "Literal" && typeof arg.value === "string" ? arg.value : null;
}
function isPgModule(source) {
  return source === "pg" || source === "pg-pool";
}
function getExportedHandlers(node) {
  const handlers = [];
  if (node?.type !== "ExportNamedDeclaration") return handlers;
  const decl = node.declaration;
  if (!decl) return handlers;
  if (decl.type === "FunctionDeclaration" && decl.id?.type === "Identifier") {
    if (HTTP_METHODS.has(decl.id.name)) handlers.push({ name: decl.id.name, node: decl });
    return handlers;
  }
  if (decl.type === "VariableDeclaration") {
    for (const d of decl.declarations ?? []) {
      if (d?.id?.type !== "Identifier" || !HTTP_METHODS.has(d.id.name)) continue;
      const init = d.init;
      if (init?.type === "ArrowFunctionExpression" || init?.type === "FunctionExpression") {
        handlers.push({ name: d.id.name, node: init });
      }
    }
  }
  return handlers;
}
function isQueryCall(node) {
  if (node?.type !== "CallExpression") return false;
  const callee = node.callee;
  if (callee?.type !== "MemberExpression") return false;
  const prop = callee.property;
  return prop?.type === "Identifier" && prop.name === "query" || prop?.type === "Literal" && prop.value === "query";
}
function getQuerySql(node) {
  const arg = node?.arguments?.[0];
  if (!arg) return null;
  if (arg.type === "Literal" && typeof arg.value === "string") return arg.value;
  if (arg.type === "TemplateLiteral") {
    const parts = (arg.quasis ?? []).map(
      (q) => q?.value?.cooked ?? q?.value?.raw ?? ""
    );
    return parts.join(" ");
  }
  return null;
}
var WRITE_SQL = /\b(insert\s+into|update|delete\s+from)\b/i;
var DDL_SQL = /\b(create|alter|drop)\s+(table|index|schema|materialized\s+view|view)\b/i;
var SELECT_FROM_SQL = /\bselect\b[\s\S]*\bfrom\s+\S/i;
var TABLE_DML = new RegExp(`${WRITE_SQL.source}|${SELECT_FROM_SQL.source}`, "i");
function sqlIsWrite(sql) {
  return WRITE_SQL.test(sql);
}
function sqlIsDDL(sql) {
  return DDL_SQL.test(sql);
}
function sqlTouchesTable(sql) {
  return TABLE_DML.test(sql);
}
var SCHEMA_BOOTSTRAP_NAMES = /^(ensureSchema|migrate|runMigrations?|createTables?|initSchema|bootstrapSchema|setupSchema)$/;
function isSchemaBootstrapCall(node) {
  if (node?.type !== "CallExpression") return false;
  const callee = node.callee;
  if (callee?.type === "Identifier") return SCHEMA_BOOTSTRAP_NAMES.test(callee.name);
  if (callee?.type === "MemberExpression" && callee.property?.type === "Identifier") {
    return SCHEMA_BOOTSTRAP_NAMES.test(callee.property.name);
  }
  return false;
}
function isConsoleCall(node) {
  if (node?.type !== "CallExpression") return false;
  const callee = node.callee;
  if (callee?.type !== "MemberExpression") return false;
  return callee.object?.type === "Identifier" && callee.object.name === "console";
}
function isBareErrorIdentifier(node) {
  return node?.type === "Identifier" && /^(err|error|e|ex|exception)$/.test(node.name);
}
function isNewPoolExpression(node) {
  if (node?.type !== "NewExpression") return false;
  const callee = node.callee;
  if (callee?.type === "Identifier") return callee.name === "Pool";
  if (callee?.type === "MemberExpression" && callee.property?.type === "Identifier") {
    return callee.property.name === "Pool";
  }
  return false;
}
function isOnErrorCall(node) {
  if (node?.type !== "CallExpression") return false;
  const callee = node.callee;
  if (callee?.type !== "MemberExpression") return false;
  const prop = callee.property;
  const isOn = prop?.type === "Identifier" && prop.name === "on" || prop?.type === "Literal" && prop.value === "on";
  if (!isOn) return false;
  const first = node.arguments?.[0];
  return first?.type === "Literal" && first.value === "error";
}
function isRequestJsonCall(node) {
  if (node?.type !== "CallExpression") return false;
  const callee = node.callee;
  if (callee?.type !== "MemberExpression") return false;
  const prop = callee.property;
  if (prop?.type !== "Identifier" || prop.name !== "json") return false;
  const obj = callee.object;
  return obj?.type === "Identifier" && (obj.name === "req" || obj.name === "request");
}
function isTypeofStringComparison(node) {
  if (node?.type !== "BinaryExpression") return false;
  if (node.operator !== "===" && node.operator !== "!==") return false;
  const sides = [node.left, node.right];
  const hasTypeof = sides.some((s) => s?.type === "UnaryExpression" && s.operator === "typeof");
  const hasStringLit = sides.some(
    (s) => s?.type === "Literal" && s.value === "string"
  );
  return hasTypeof && hasStringLit;
}
function isLengthMember(node) {
  return node?.type === "MemberExpression" && node.property?.type === "Identifier" && node.property.name === "length";
}

// src/providers/railway/rules/cron-service-must-share-schema-bootstrap.ts
var rule14 = {
  meta: {
    type: "problem",
    docs: {
      description: "A Railway cron/worker script must bootstrap the DB schema before querying tables the web app creates lazily",
      category: "correctness",
      docsUrl: "https://docs.railway.com/guides/cron-jobs",
      rationale: 'When the table is created lazily by the web app and the cron script queries it directly, the very first scheduled cron run after a fresh deploy can hit the table before any request has created it, throwing "relation does not exist". Railway does not retry a failed cron run before its next schedule, so the job silently stays broken. The script must call the same ensureSchema() bootstrap (or create the table itself) before querying.',
      recommended: true
    },
    messages: {
      missingSchemaBootstrap: "This script queries a table without bootstrapping the schema first. Call the shared ensureSchema() (or create the table) before querying, or the first Railway cron run can fail on a missing relation."
    },
    schema: []
  },
  create(context) {
    let usesPg = false;
    let bootstrapsSchema = false;
    let firstTableQuery = null;
    return {
      ImportDeclaration(node) {
        if (isPgModule(importSourceOf(node))) usesPg = true;
      },
      CallExpression(node) {
        if (isPgModule(requireSourceOf(node))) usesPg = true;
        if (isSchemaBootstrapCall(node)) bootstrapsSchema = true;
        if (isQueryCall(node)) {
          const sql = getQuerySql(node);
          if (sql && sqlIsDDL(sql)) bootstrapsSchema = true;
          if (sql && sqlTouchesTable(sql) && !firstTableQuery) firstTableQuery = node;
        }
      },
      "Program:exit"() {
        if (!usesPg) return;
        if (bootstrapsSchema) return;
        if (firstTableQuery) {
          context.report({ node: firstTableQuery, messageId: "missingSchemaBootstrap" });
        }
      }
    };
  }
};
var railwayCronServiceMustShareSchemaBootstrapRule = rule14;

// src/providers/railway/rules/no-unauthenticated-public-write-endpoint.ts
var ENV_SECRET = /(TOKEN|SECRET|KEY|PASSWORD|AUTH)/i;
var AUTH_FN = /^(auth|getAuth|getSession|getUser|getServerSession|verify|verifyAuth|authorize|authenticate|require\w*|checkAuth|isAuthorized|currentUser)$/;
var rule15 = {
  meta: {
    type: "problem",
    docs: {
      description: "Mutating Railway route handlers must authenticate before persisting, since a public domain makes them internet-reachable",
      category: "security",
      cwe: "CWE-306",
      owasp: "API2:2023 Broken Authentication",
      docsUrl: "https://docs.railway.com/guides/public-networking",
      rationale: "Generating a public domain for a Railway service exposes its routes to the entire internet. A write handler that persists request data with no token, session, or origin check becomes an open write API: anyone can insert arbitrary rows, growing metered Postgres storage and corrupting application data. Authenticate the request before persisting.",
      recommended: true
    },
    messages: {
      unauthenticatedWrite: "This {{method}} handler persists request data without an authentication check. Verify a token/session/origin before writing \u2014 a Railway public domain exposes it to the internet."
    },
    schema: []
  },
  create(context) {
    const handlers = [];
    function forEachHandlerContaining(node, fn) {
      for (const h of handlers) {
        if (contains2(h.node, node)) fn(h);
      }
    }
    return {
      ExportNamedDeclaration(node) {
        for (const h of getExportedHandlers(node)) {
          if (MUTATING_METHODS.has(h.name)) {
            handlers.push({ ...h, hasWrite: false, hasAuth: false });
          }
        }
      },
      MemberExpression(node) {
        if (node.property?.type === "Identifier" && node.property.name === "headers") {
          forEachHandlerContaining(node, (h) => {
            h.hasAuth = true;
          });
        }
        if (node.property?.type === "Identifier" && ENV_SECRET.test(node.property.name) && node.object?.type === "MemberExpression" && node.object.property?.type === "Identifier" && node.object.property.name === "env") {
          forEachHandlerContaining(node, (h) => {
            h.hasAuth = true;
          });
        }
      },
      CallExpression(node) {
        if (isQueryCall(node)) {
          const sql = getQuerySql(node);
          if (sql && sqlIsWrite(sql)) {
            forEachHandlerContaining(node, (h) => {
              h.hasWrite = true;
            });
          }
        }
        const callee = node.callee;
        const name = callee?.type === "Identifier" ? callee.name : callee?.type === "MemberExpression" && callee.property?.type === "Identifier" ? callee.property.name : null;
        if (name && AUTH_FN.test(name)) {
          forEachHandlerContaining(node, (h) => {
            h.hasAuth = true;
          });
        }
      },
      "Program:exit"() {
        for (const h of handlers) {
          if (h.hasWrite && !h.hasAuth) {
            context.report({
              node: h.node,
              messageId: "unauthenticatedWrite",
              data: { method: h.name }
            });
          }
        }
      }
    };
  }
};
var railwayNoUnauthenticatedPublicWriteEndpointRule = rule15;

// src/providers/railway/rules/pg-pool-requires-error-handler.ts
var rule16 = {
  meta: {
    type: "problem",
    docs: {
      description: 'A pg Pool on Railway must register a pool.on("error") handler',
      category: "reliability",
      docsUrl: "https://node-postgres.com/apis/pool#events",
      rationale: 'node-postgres emits backend errors on idle clients as an "error" event on the Pool. A Node EventEmitter with no "error" listener rethrows, crashing the process. Railway-managed Postgres routinely drops idle connections during maintenance and restarts, so a long-running server container without pool.on("error", ...) will eventually crash on an event it could have absorbed.',
      recommended: true
    },
    messages: {
      missingErrorHandler: 'This pg Pool has no pool.on("error", ...) handler. An idle-client backend error with no listener will crash the process when Railway drops the connection.'
    },
    schema: []
  },
  create(context) {
    let usesPg = false;
    let hasErrorHandler = false;
    const pools = [];
    return {
      ImportDeclaration(node) {
        if (isPgModule(importSourceOf(node))) usesPg = true;
      },
      CallExpression(node) {
        if (isPgModule(requireSourceOf(node))) usesPg = true;
        if (isOnErrorCall(node)) hasErrorHandler = true;
      },
      NewExpression(node) {
        if (isNewPoolExpression(node)) pools.push(node);
      },
      "Program:exit"() {
        if (!usesPg || hasErrorHandler) return;
        for (const pool of pools) {
          context.report({ node: pool, messageId: "missingErrorHandler" });
        }
      }
    };
  }
};
var railwayPgPoolRequiresErrorHandlerRule = rule16;

// src/providers/railway/rules/validate-request-payload-bounds.ts
var rule17 = {
  meta: {
    type: "suggestion",
    docs: {
      description: "Persisted request payloads on Railway must enforce length bounds, not just type checks",
      category: "security",
      cwe: "CWE-770",
      owasp: "API4:2023 Unrestricted Resource Consumption",
      docsUrl: "https://docs.railway.com/guides/postgresql",
      rationale: 'A handler that validates only the type of incoming fields (typeof === "string") but never their length lets a client persist arbitrarily large values. On Railway, Postgres storage is billed by volume size, so unbounded inserts grow cost indefinitely and a burst of abuse persists until an age-based cleanup eventually catches it. Enforce an explicit length cap before persisting.',
      recommended: true
    },
    messages: {
      missingBounds: "This {{method}} handler type-checks the payload but never bounds its length before persisting. Add an explicit length cap (e.g. value.length > 200) to prevent unbounded Railway Postgres growth."
    },
    schema: []
  },
  create(context) {
    const handlers = [];
    function forEach(node, fn) {
      for (const h of handlers) if (contains2(h.node, node)) fn(h);
    }
    return {
      ExportNamedDeclaration(node) {
        for (const h of getExportedHandlers(node)) {
          if (MUTATING_METHODS.has(h.name)) {
            handlers.push({
              ...h,
              readsJson: false,
              typeChecksString: false,
              hasWrite: false,
              hasLengthCheck: false
            });
          }
        }
      },
      CallExpression(node) {
        if (isRequestJsonCall(node)) forEach(node, (h) => h.readsJson = true);
        if (isQueryCall(node)) {
          const sql = getQuerySql(node);
          if (sql && sqlIsWrite(sql)) forEach(node, (h) => h.hasWrite = true);
        }
      },
      BinaryExpression(node) {
        if (isTypeofStringComparison(node)) forEach(node, (h) => h.typeChecksString = true);
      },
      MemberExpression(node) {
        if (isLengthMember(node)) forEach(node, (h) => h.hasLengthCheck = true);
      },
      "Program:exit"() {
        for (const h of handlers) {
          if (h.readsJson && h.typeChecksString && h.hasWrite && !h.hasLengthCheck) {
            context.report({
              node: h.node,
              messageId: "missingBounds",
              data: { method: h.name }
            });
          }
        }
      }
    };
  }
};
var railwayValidateRequestPayloadBoundsRule = rule17;

// src/providers/railway/rules/no-raw-error-logging-near-db-connection.ts
var rule18 = {
  meta: {
    type: "suggestion",
    docs: {
      description: "Do not log raw error objects in a Railway Postgres connection context \u2014 the DSN/password can leak into logs",
      category: "security",
      cwe: "CWE-532",
      owasp: "API8:2023 Security Misconfiguration",
      docsUrl: "https://docs.railway.com/guides/logs",
      rationale: "pg connection-failure errors can carry connection details \u2014 and in some driver versions the full DSN \u2014 in their message and stack. DATABASE_URL contains the Postgres password, so console.error(err) on a pool failure can write that password into Railway deploy/build logs, which may be exported to a third-party log drain or read by anyone with project access. Log err.message (a redacted, intentional field) instead of the whole error.",
      recommended: true
    },
    messages: {
      rawErrorLogged: "Logging a raw error object in a database-connection context can leak DATABASE_URL (with the Postgres password) into Railway logs. Log err.message instead."
    },
    schema: []
  },
  create(context) {
    let isDbContext = false;
    const rawLogCalls = [];
    return {
      ImportDeclaration(node) {
        if (isPgModule(importSourceOf(node))) isDbContext = true;
      },
      NewExpression(node) {
        if (isNewPoolExpression(node)) isDbContext = true;
      },
      MemberExpression(node) {
        if (node.property?.type === "Identifier" && node.property.name === "DATABASE_URL" && node.object?.type === "MemberExpression" && node.object.property?.type === "Identifier" && node.object.property.name === "env") {
          isDbContext = true;
        }
      },
      CallExpression(node) {
        if (isPgModule(requireSourceOf(node))) isDbContext = true;
        if (isConsoleCall(node)) {
          const hasBareError = (node.arguments ?? []).some((a) => isBareErrorIdentifier(a));
          if (hasBareError) rawLogCalls.push(node);
        }
      },
      "Program:exit"() {
        if (!isDbContext) return;
        for (const call of rawLogCalls) {
          context.report({ node: call, messageId: "rawErrorLogged" });
        }
      }
    };
  }
};
var railwayNoRawErrorLoggingNearDbConnectionRule = rule18;

// src/providers/railway/rules/no-ddl-in-request-handler.ts
var rule19 = {
  meta: {
    type: "suggestion",
    docs: {
      description: "Schema DDL must not run inside a Railway request handler",
      category: "correctness",
      docsUrl: "https://docs.railway.com/reference/config-as-code",
      rationale: "Running CREATE TABLE IF NOT EXISTS (directly or via ensureSchema()) on every request adds a catalog round-trip to the hot path and is not race-proof: when Railway runs more than one replica, two cold-starting instances can attempt the create simultaneously and one can fail with a duplicate-relation error. Run schema creation once at deploy time (e.g. a preDeployCommand migration) instead.",
      recommended: true
    },
    messages: {
      ddlInHandler: "Schema DDL runs inside the {{method}} request handler. Move schema creation to a one-time deploy step (e.g. preDeployCommand) \u2014 per-request CREATE TABLE can race across Railway replicas."
    },
    schema: []
  },
  create(context) {
    const handlers = [];
    const reported = /* @__PURE__ */ new Set();
    function reportInHandler(node) {
      for (const h of handlers) {
        if (contains2(h.node, node) && !reported.has(h.node)) {
          reported.add(h.node);
          context.report({ node: h.node, messageId: "ddlInHandler", data: { method: h.name } });
        }
      }
    }
    return {
      ExportNamedDeclaration(node) {
        for (const h of getExportedHandlers(node)) handlers.push(h);
      },
      CallExpression(node) {
        if (isSchemaBootstrapCall(node)) {
          reportInHandler(node);
          return;
        }
        if (isQueryCall(node)) {
          const sql = getQuerySql(node);
          if (sql && sqlIsDDL(sql)) reportInHandler(node);
        }
      }
    };
  }
};
var railwayNoDdlInRequestHandlerRule = rule19;

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
var rule20 = {
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
var supabaseScopeQueriesByTenantColumnRule = rule20;

// src/providers/supabase/rules/validate-uuid-columns.ts
function regexSourceLooksUuidShaped(pattern) {
  return /[0-9a-f]{2,}/i.test(pattern) && pattern.includes("-");
}
var rule21 = {
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
var supabaseValidateUuidColumnsRule = rule21;

// src/providers/supabase/rules/order-by-timestamp-not-identity.ts
var rule22 = {
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
var supabaseOrderByTimestampNotIdentityRule = rule22;

// src/providers/supabase/rules/consistent-input-length-limits.ts
var rule23 = {
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
var supabaseConsistentInputLengthLimitsRule = rule23;

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
var rule24 = {
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
var supabaseIdempotentMutationsRule = rule24;

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
var rule25 = {
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
var supabaseFailFastEnvValidationRule = rule25;

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
    "railway-cron-service-must-share-schema-bootstrap": railwayCronServiceMustShareSchemaBootstrapRule,
    "railway-no-unauthenticated-public-write-endpoint": railwayNoUnauthenticatedPublicWriteEndpointRule,
    "railway-pg-pool-requires-error-handler": railwayPgPoolRequiresErrorHandlerRule,
    "railway-validate-request-payload-bounds": railwayValidateRequestPayloadBoundsRule,
    "railway-no-raw-error-logging-near-db-connection": railwayNoRawErrorLoggingNearDbConnectionRule,
    "railway-no-ddl-in-request-handler": railwayNoDdlInRequestHandlerRule,
    "supabase-scope-queries-by-tenant-column": supabaseScopeQueriesByTenantColumnRule,
    "supabase-validate-uuid-columns": supabaseValidateUuidColumnsRule,
    "supabase-order-by-timestamp-not-identity": supabaseOrderByTimestampNotIdentityRule,
    "supabase-consistent-input-length-limits": supabaseConsistentInputLengthLimitsRule,
    "supabase-idempotent-mutations": supabaseIdempotentMutationsRule,
    "supabase-fail-fast-env-validation": supabaseFailFastEnvValidationRule
  }
};
var plugin_default = plugin;
export {
  plugin_default as default,
  plugin
};
//# sourceMappingURL=plugin.js.map