/**
 * The compatibility rule, once, for every provider.
 *
 * Fires when code references an SDK symbol that does not exist in the version
 * the project has INSTALLED. It never suggests upgrading: code using an old
 * symbol on an old version is correct and stays silent forever. The finding is
 * a call that will fail at runtime against what is actually in node_modules —
 * in plain .js files, nothing else catches that.
 *
 * Detection is deliberately narrow to keep precision:
 *   - named imports (or require destructuring) of a removed symbol from a
 *     source belonging to the provider's package, and calls of those bindings;
 *   - member calls of a removed symbol on a namespace import of the package.
 * A local function that happens to share the name never matches, because a
 * bare call is only flagged when the binding traces to the SDK import.
 *
 * Stays silent whenever the installed version cannot be resolved — an
 * unresolvable version must never be treated as "latest".
 *
 * None of the above is provider-specific, which is why it lives here: a
 * provider gains a compatibility rule by supplying its package, its
 * hand-verified removals, and the prose that explains them. Forking this file
 * per provider would mean maintaining the same AST reasoning in N places and
 * letting the precision guarantees drift apart.
 */
import { compareSemver, resolveInstalledVersion } from '../../plugin/installed-version.js';
import { migrationTargetFor } from '../../plugin/migration-target.js';
import type { SymbolRemoval } from '../../types.js';

export interface RemovedSymbolRuleOptions {
  /** npm package the removals belong to (e.g. '@s2-dev/streamstore'). */
  packageName: string;
  /**
   * Provider name as the manifests spell it. Used only to ask whether THIS
   * provider is the one being migrated — the detection below is import-based
   * and needs no provider attribution beyond the package match.
   */
  provider: string;
  /** Hand-verified removals for that package. */
  removals: SymbolRemoval[];
  /** One-line rule description for the registry. */
  description: string;
  /** Why this rule exists, in the developer's terms. Provider-specific prose. */
  rationale: string;
  /** Provider docs page for the affected symbols. */
  docsUrl: string;
}

/**
 * Builds one provider's removed-symbol rule.
 *
 * The two message templates are shared on purpose. A wire-identical rename is
 * the only case where the fix is safe to state as a rename and nothing more;
 * everything else gets the bare removal message, so a signature change is
 * never described in words that imply a drop-in replacement.
 */
/**
 * Which forward-looking message a removal gets in migration mode. Mirrors the
 * same helper in `removed-method.ts`, including why the `signature-change`
 * case names its successor here and not in the backward set: a plan has to
 * state a destination, a defect report must not imply a drop-in.
 */
function migrationMessageId(removal: SymbolRemoval): string {
  if (removal.kind === 'rename' && removal.wireIdentical && removal.replacement) {
    return 'migrateRenamedSymbol';
  }
  if (removal.kind === 'moved' && removal.movedTo) return 'migrateMovedSymbol';
  if (removal.replacement) return 'migrateChangedSymbol';
  return 'migrateRemovedSymbol';
}

export function createRemovedSymbolRule(options: RemovedSymbolRuleOptions) {
  const { packageName, provider, removals, description, rationale, docsUrl } = options;
  const removalsBySymbol = new Map(removals.map((r) => [r.symbol, r]));

  /**
   * Import sources that are the CURE, not the disease.
   *
   * A symbol that moved to a subpath (`@tiptap/react` → `@tiptap/react/menus`)
   * is still exported under the same name, and `isProviderSource` matches the
   * package AND its subpaths — so without this the rule would flag the exact
   * import that fixes the finding, on every correctly-migrated file. Sourced
   * from the removals themselves so the exclusion cannot drift from the data.
   */
  const survivingSources = new Set(
    removals.map((r) => r.movedTo).filter((m): m is string => typeof m === 'string'),
  );

  const isProviderSource = (source: unknown): boolean =>
    typeof source === 'string' &&
    !survivingSources.has(source) &&
    (source === packageName || source.startsWith(`${packageName}/`));

  return {
    meta: {
      type: 'problem',
      docs: {
        description,
        category: 'compatibility',
        rationale,
        docsUrl,
        recommended: true,
      },
      messages: {
        renamedSymbol:
          '{{symbol}} was removed in {{removedIn}} — you have {{installed}} installed. Renamed to {{replacement}}. Same request, same arguments.',
        movedSymbol:
          "{{symbol}} was removed from '{{packageName}}' in {{removedIn}} — you have {{installed}} installed. Import it from '{{movedTo}}' instead.",
        removedSymbol:
          '{{symbol}} was removed in {{removedIn}} — you have {{installed}} installed.',
        // Migration mode: same facts, opposite tense. Nothing here is broken
        // yet, so none of these may read as a defect.
        migrateRenamedSymbol:
          '{{symbol}} becomes {{replacement}} in {{removedIn}} — a rename, same request and same arguments.',
        migrateMovedSymbol:
          "{{symbol}} moves to '{{movedTo}}' in {{removedIn}} — same symbol, new import path.",
        migrateChangedSymbol:
          '{{symbol}} becomes {{replacement}} in {{removedIn}}, with a different contract — read the Verify line before rewriting this call.',
        migrateRemovedSymbol: '{{symbol}} is removed in {{removedIn}} with no successor.',
      },
      schema: [],
    },
    create(context: any) {
      /** symbol -> import/require nodes that bind it from a provider source. */
      const importedFrom = new Map<string, any[]>();
      /** Local names bound by `import * as ns from '<package>...'`. */
      const namespaceBindings = new Set<string>();
      /** symbol -> call expressions referencing it. */
      const calls = new Map<string, any[]>();
      /** Symbols whose bare-identifier calls were seen before import resolution. */
      const bareCalls: Array<{ symbol: string; node: any }> = [];

      function recordImport(symbol: string, node: any): void {
        const list = importedFrom.get(symbol) ?? [];
        list.push(node);
        importedFrom.set(symbol, list);
      }

      function recordCall(symbol: string, node: any): void {
        const list = calls.get(symbol) ?? [];
        list.push(node);
        calls.set(symbol, list);
      }

      return {
        ImportDeclaration(node: any) {
          if (!isProviderSource(node?.source?.value)) return;
          for (const spec of node?.specifiers ?? []) {
            if (spec?.type === 'ImportSpecifier') {
              const imported = spec.imported?.name ?? spec.imported?.value;
              if (typeof imported === 'string' && removalsBySymbol.has(imported)) {
                recordImport(imported, spec);
              }
            } else if (spec?.type === 'ImportNamespaceSpecifier') {
              const local = spec.local?.name;
              if (typeof local === 'string') namespaceBindings.add(local);
            }
          }
        },

        VariableDeclarator(node: any) {
          // const { createOrReconfigureBasin } = require('@s2-dev/streamstore')
          const init = node?.init;
          const isRequire =
            init?.type === 'CallExpression' &&
            init.callee?.type === 'Identifier' &&
            init.callee.name === 'require' &&
            isProviderSource(init.arguments?.[0]?.value);
          if (!isRequire) return;
          if (node.id?.type === 'ObjectPattern') {
            for (const prop of node.id.properties ?? []) {
              const key = prop?.key?.name ?? prop?.key?.value;
              if (typeof key === 'string' && removalsBySymbol.has(key)) {
                recordImport(key, prop);
              }
            }
          } else if (node.id?.type === 'Identifier') {
            // const sdk = require('<package>') — namespace-style use.
            namespaceBindings.add(node.id.name);
          }
        },

        CallExpression(node: any) {
          const callee = node?.callee;
          if (callee?.type === 'Identifier' && removalsBySymbol.has(callee.name)) {
            bareCalls.push({ symbol: callee.name, node });
            return;
          }
          if (
            callee?.type === 'MemberExpression' &&
            !callee.computed &&
            callee.object?.type === 'Identifier' &&
            callee.property?.type === 'Identifier' &&
            removalsBySymbol.has(callee.property.name) &&
            namespaceBindings.has(callee.object.name)
          ) {
            recordCall(callee.property.name, node);
          }
        },

        'Program:exit'() {
          // Bare calls count only when the binding came from the SDK import —
          // a project's own helper sharing the name must never match.
          for (const { symbol, node } of bareCalls) {
            if (importedFrom.has(symbol)) recordCall(symbol, node);
          }

          const referenced = new Set([...importedFrom.keys(), ...calls.keys()]);
          if (referenced.size === 0) return;

          const filename = String(
            context.physicalFilename ?? context.filename ?? context.getFilename?.() ?? '',
          );
          if (!filename) return;
          const installed = resolveInstalledVersion(filename, packageName);
          if (!installed) return; // cannot resolve → stay silent, never assume latest

          // Undefined on every ordinary run, and on any run migrating a
          // different provider. Its presence is the only thing that reverses
          // the comparison below.
          const migrate = migrationTargetFor(provider);

          for (const symbol of referenced) {
            const removal = removalsBySymbol.get(symbol)!;
            const cmp = compareSemver(installed, removal.removedIn);
            if (cmp === null) continue; // unparseable stays silent in both directions

            if (migrate) {
              // Forward: below removedIn today, at or past it after the move.
              if (cmp >= 0) continue;
              const reach = compareSemver(migrate.target, removal.removedIn);
              if (reach === null || reach < 0) continue;
            } else {
              // Backward: fire only when installed >= removedIn.
              if (cmp < 0) continue;
            }

            const data = {
              symbol,
              removedIn: removal.removedIn,
              installed,
              packageName,
              replacement: removal.replacement ?? '',
              movedTo: removal.movedTo ?? '',
            };
            const messageId = migrate
              ? migrationMessageId(removal)
              : removal.kind === 'rename' && removal.wireIdentical && removal.replacement
                ? 'renamedSymbol'
                : removal.kind === 'moved' && removal.movedTo
                  ? 'movedSymbol'
                  : 'removedSymbol';

            // Prefer call sites; fall back to the import when never called.
            const nodes = calls.get(symbol) ?? importedFrom.get(symbol) ?? [];
            for (const node of nodes) {
              context.report({ node, messageId, data });
            }
          }
        },
      };
    },
  };
}
