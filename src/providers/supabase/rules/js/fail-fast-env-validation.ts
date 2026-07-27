/**
 * supabase-fail-fast-env-validation (reliability)
 *
 * `createClient(process.env.X, process.env.Y)` with a missing env var throws
 * the SDK's own error ("supabaseUrl is required." / "supabaseKey is
 * required.") — which names the SDK parameter, not YOUR env var. An explicit
 * presence check produces an actionable message naming the exact variable to
 * set (especially confusing otherwise with Next.js NEXT_PUBLIC_* build-time
 * inlining, where the fix is a rebuild, not a restart).
 *
 * Tracks (in source order, since guards precede the call they protect):
 *   - which local names the client factories were imported as
 *     (`createClient` from @supabase/supabase-js, `createBrowserClient` /
 *     `createServerClient` from @supabase/ssr)
 *   - which local variables were assigned directly from `process.env.X`
 *   - which variables/env-vars an `if (!x || ...) throw/return` guard covers
 * then, at the factory call, flags any argument that resolves to a
 * `process.env` value with no matching guard.
 */

function unwrapNonNull(node: any): any {
  return node?.type === 'TSNonNullExpression' ? node.expression : node;
}

function processEnvMemberName(node: any): string | undefined {
  const n = unwrapNonNull(node);
  if (n?.type !== 'MemberExpression' || n.computed) return undefined;
  const obj = n.object;
  if (obj?.type !== 'MemberExpression' || obj.computed) return undefined;
  if (obj.object?.type !== 'Identifier' || obj.object.name !== 'process') return undefined;
  if (obj.property?.type !== 'Identifier' || obj.property.name !== 'env') return undefined;
  if (n.property?.type !== 'Identifier') return undefined;
  return n.property.name;
}

function hasThrowOrReturn(node: any): boolean {
  if (!node) return false;
  if (node.type === 'ThrowStatement' || node.type === 'ReturnStatement') return true;
  if (node.type === 'BlockStatement') {
    return (node.body ?? []).some((s: any) => s.type === 'ThrowStatement' || s.type === 'ReturnStatement');
  }
  return false;
}

const rule = {
  meta: {
    type: 'suggestion',
    docs: {
      description: 'createClient must fail fast when required env vars are missing',
      category: 'reliability',
      rationale:
        'createClient throws immediately when an argument is missing, but with the SDK\'s message ("supabaseKey is required.") — it names the SDK parameter, not your env var. An explicit presence check produces an error naming the exact variable to set, which matters most with Next.js NEXT_PUBLIC_* inlining where the fix is a rebuild with the var present, not a server restart.',
      docsUrl: 'https://supabase.com/docs/reference/javascript/initializing',
      recommended: true,
    },
    messages: {
      missingEnvValidation:
        'createClient is called with {{vars}} with no presence check beforehand. Throw if it/they are unset before calling createClient.',
    },
    schema: [],
  },
  create(context: any) {
    const FACTORY_IMPORTS: Record<string, string[]> = {
      '@supabase/supabase-js': ['createClient'],
      '@supabase/ssr': ['createBrowserClient', 'createServerClient'],
    };
    const factoryLocalNames = new Set<string>();
    const envVarOfVariable = new Map<string, string>();
    const validatedVarNames = new Set<string>();
    const validatedEnvNames = new Set<string>();

    function addTarget(node: any) {
      const n = unwrapNonNull(node);
      if (n?.type === 'Identifier') {
        validatedVarNames.add(n.name);
        return;
      }
      const envName = processEnvMemberName(n);
      if (envName) validatedEnvNames.add(envName);
    }

    function collectGuardTargets(node: any) {
      if (!node) return;
      if (node.type === 'LogicalExpression' && node.operator === '||') {
        collectGuardTargets(node.left);
        collectGuardTargets(node.right);
        return;
      }
      if (node.type === 'UnaryExpression' && node.operator === '!') {
        addTarget(node.argument);
        return;
      }
      if (node.type === 'BinaryExpression' && (node.operator === '==' || node.operator === '===')) {
        const sides = [node.left, node.right];
        const isNullish = (n: any) =>
          (n?.type === 'Literal' && n.value === null) || (n?.type === 'Identifier' && n.name === 'undefined');
        const target = sides.find((s: any) => !isNullish(s));
        const nullSide = sides.find(isNullish);
        if (target && nullSide) addTarget(target);
      }
    }

    return {
      ImportDeclaration(node: any) {
        const factories = FACTORY_IMPORTS[node.source?.value];
        if (!factories) return;
        for (const s of node.specifiers ?? []) {
          if (
            s?.type === 'ImportSpecifier' &&
            s.imported?.type === 'Identifier' &&
            factories.includes(s.imported.name) &&
            s.local?.type === 'Identifier'
          ) {
            factoryLocalNames.add(s.local.name);
          }
        }
      },

      VariableDeclarator(node: any) {
        if (node.id?.type !== 'Identifier') return;
        const envName = processEnvMemberName(node.init);
        if (envName) envVarOfVariable.set(node.id.name, envName);
      },

      IfStatement(node: any) {
        if (!hasThrowOrReturn(node.consequent)) return;
        collectGuardTargets(node.test);
      },

      CallExpression(node: any) {
        if (factoryLocalNames.size === 0) return;
        if (node.callee?.type !== 'Identifier' || !factoryLocalNames.has(node.callee.name)) return;

        const missing: string[] = [];
        for (const rawArg of node.arguments ?? []) {
          const arg = unwrapNonNull(rawArg);
          let envName: string | undefined;
          let isValidated: boolean;

          if (arg?.type === 'Identifier') {
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
          context.report({ node, messageId: 'missingEnvValidation', data: { vars: missing.join(', ') } });
        }
      },
    };
  },
};

export const supabaseFailFastEnvValidationRule = rule;
export default rule;
