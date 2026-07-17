# Severity & scoring

This applies to every provider's rules — severity is set per rule in `meta.docs` and drives the report score identically across providers.

| Severity | Affects score |
| -------- | ------------- |
| error    | −15 each      |
| warning  | −5 each       |
| info     | no penalty    |

Structured reports include each rule's `meta.docs.rationale` under **Why this matters** (markdown export).
