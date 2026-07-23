/**
 * Minimal AST walker for oxc-parser's ESTree output.
 *
 * Iterative by design: real files reach depths that blow the JS call stack
 * (a generated template built from thousands of concatenated string literals
 * nests one BinaryExpression per `+`). Coverage is informational, so it must
 * never be able to take down a scan.
 */
export function walkAst(root: any, visit: (n: any) => void): void {
  if (!root || typeof root !== 'object') return;
  const stack: any[] = [root];
  while (stack.length > 0) {
    const node = stack.pop();
    if (!node || typeof node !== 'object') continue;
    if (Array.isArray(node)) {
      for (let i = node.length - 1; i >= 0; i--) stack.push(node[i]);
      continue;
    }
    if (typeof node.type === 'string') visit(node);
    for (const key of Object.keys(node)) {
      if (key === 'loc') continue;
      const child = node[key];
      if (child && typeof child === 'object') stack.push(child);
    }
  }
}
