import { contains, endOffset, findProperty, isInsideTestFile, memberPropName, startOffset } from '../_shared/ast.js';
export { contains, endOffset, findProperty, isInsideTestFile, memberPropName, startOffset };

/**
 * Shared AST helpers for S2 (@s2-dev/streamstore) rules.
 *
 * S2 calls are matched by member shape (`.append(...)`, `.accessTokens.issue(...)`)
 * rather than the base identifier name, so clients stored as `s2`, `client`,
 * `adminClient`, etc. are still recognized. File-level provider relevance is
 * tracked via createS2FileTracker so rules also fire on wrapper layouts like
 * `import { s2 } from '@/lib/s2'`.
 */

/** Unwraps TS/chain wrappers: `expr!`, `expr as T`, `expr satisfies T`, `expr?.`. */
export function unwrapExpr(node: any): any {
  let n = node;
  while (
    n &&
    (n.type === 'TSNonNullExpression' ||
      n.type === 'TSAsExpression' ||
      n.type === 'TSSatisfiesExpression' ||
      n.type === 'ChainExpression' ||
      n.type === 'ParenthesizedExpression')
  ) {
    n = n.expression;
  }
  return n;
}

/**
 * If `node` is a call of the form `<obj>.<name>(...)` (including dynamic
 * `<obj>["<name>"](...)`), returns the callee object; else null.
 */
export function memberCallObject(node: any, name: string): any | null {
  if (node?.type !== 'CallExpression') return null;
  const callee = unwrapExpr(node.callee);
  if (memberPropName(callee) !== name) return null;
  return callee.object;
}

/** Returns `arguments[index]` if it is an ObjectExpression, else null. */
export function getObjectArg(node: any, index: number): any | null {
  const arg = unwrapExpr(node?.arguments?.[index]);
  return arg?.type === 'ObjectExpression' ? arg : null;
}

/** If `node` reads `process.env.<NAME>` (or `process.env["<NAME>"]`), returns NAME. */
export function processEnvVarName(node: any): string | null {
  const n = unwrapExpr(node);
  if (n?.type !== 'MemberExpression') return null;
  const envMember = n.object;
  if (envMember?.type !== 'MemberExpression') return null;
  if (envMember.object?.type !== 'Identifier' || envMember.object.name !== 'process') return null;
  if (memberPropName(envMember) !== 'env') return null;
  const prop = n.property;
  if (!n.computed && prop?.type === 'Identifier') return prop.name;
  if (n.computed && prop?.type === 'Literal' && typeof prop.value === 'string') return prop.value;
  return null;
}

export interface S2FileTracker {
  /** Feed every ImportDeclaration to the tracker. */
  visitImport(node: any): void;
  /** Feed every NewExpression to the tracker (recognizes `new S2(...)`). */
  visitNew(node: any): void;
  /** True once the file shows any S2 evidence (SDK import, s2-named binding, `new S2`). */
  isS2File(): boolean;
  /** Local binding names for a named export of the SDK, e.g. "AppendInput". */
  localNames(imported: string): Set<string>;
}

/**
 * Tracks whether a file is S2-relevant. Accepts:
 *  - direct imports from `@s2-dev/*`
 *  - wrapper imports whose local binding is s2-ish (`import { s2 } from '@/lib/s2'`)
 *  - `new S2(...)` constructions (renamed imports included via localNames)
 */
export function createS2FileTracker(): S2FileTracker {
  let s2Evidence = false;
  const importedLocals = new Map<string, Set<string>>();

  function addLocal(imported: string, local: string): void {
    let set = importedLocals.get(imported);
    if (!set) {
      set = new Set();
      importedLocals.set(imported, set);
    }
    set.add(local);
  }

  return {
    visitImport(node: any): void {
      const source = node?.source?.value;
      const fromSdk = typeof source === 'string' && source.startsWith('@s2-dev/');
      if (fromSdk) s2Evidence = true;
      for (const s of node?.specifiers ?? []) {
        const local = s?.local?.type === 'Identifier' ? s.local.name : null;
        if (!local) continue;
        if (fromSdk) {
          const imported =
            s.type === 'ImportSpecifier' && s.imported?.type === 'Identifier'
              ? s.imported.name
              : local;
          addLocal(imported, local);
        } else if (/^s2(client)?$/i.test(local)) {
          // Wrapper module re-exporting a configured client, e.g. `@/lib/s2`.
          s2Evidence = true;
        }
      }
    },
    visitNew(node: any): void {
      const callee = unwrapExpr(node?.callee);
      if (callee?.type !== 'Identifier') return;
      if (callee.name === 'S2' || importedLocals.get('S2')?.has(callee.name)) {
        s2Evidence = true;
      }
    },
    isS2File(): boolean {
      return s2Evidence;
    },
    localNames(imported: string): Set<string> {
      // Fall back to the canonical name so unimported references (declared
      // elsewhere, injected) still match by convention.
      return importedLocals.get(imported) ?? new Set([imported]);
    },
  };
}
