# Oxlint rules by provider

One subfolder per API/SDK. Each `.ts` file is one oxlint rule (AST visitors).

```
rules/
  resend/
    webhook-signature.ts
  stripe/          ← add rules here when contributing Stripe
    ...
```

Register every rule in `src/plugin/index.ts`. Link each rule to its manifest entry via the shared `key`.

**Contributing?** See [`../providers/README.md`](../providers/README.md).
