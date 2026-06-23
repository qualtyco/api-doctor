/** Shared AST helpers for Lovable rules. */
export const LLM_HOST_PATTERN = /api\.anthropic\.com|api\.openai\.com/;

/** True if a string/template-literal AST node's text matches a known LLM provider host. */
export function containsKnownLlmHost(node: any): boolean {
  if (node?.type === 'Literal' && typeof node.value === 'string') {
    return LLM_HOST_PATTERN.test(node.value);
  }
  if (node?.type === 'TemplateLiteral') {
    return (node.quasis ?? []).some((q: any) => LLM_HOST_PATTERN.test(q.value?.raw ?? ''));
  }
  return false;
}
