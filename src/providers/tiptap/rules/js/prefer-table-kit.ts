/**
 * tiptap-prefer-table-kit (correctness)
 *
 * Detects when individual Tiptap table sub-packages are imported instead of
 * using TableKit from @tiptap/extension-table. Individual imports miss the
 * coordinated configuration TableKit provides.
 *
 * Bindings used only as an `.extend()` base are exempt: TableKit registers
 * extensions, it cannot produce a subclassed node, so `TableRow.extend(...)`
 * *requires* the sub-package import and has no TableKit equivalent.
 */
import { walk } from '../../utils.js';

const INDIVIDUAL_TABLE_PACKAGES = new Set([
  '@tiptap/extension-table-row',
  '@tiptap/extension-table-cell',
  '@tiptap/extension-table-header',
]);

const rule = {
  meta: {
    type: 'suggestion',
    docs: {
      description: 'Use TableKit from @tiptap/extension-table instead of individual table packages',
      category: 'correctness',
      rationale:
        'Importing table extensions individually from their separate packages bypasses the coordinated wiring that TableKit provides: shared configuration and consistent HTMLAttributes across all table elements, configured in one place. TableKit from @tiptap/extension-table is the documented way to register the full table feature set. Bindings whose only use is `.extend()` are excluded — subclassing a table node requires importing the node itself, and TableKit cannot express it.',
      docsUrl: 'https://tiptap.dev/docs/editor/extensions/functionality/table-kit',
      recommended: true,
    },
    messages: {
      preferTableKit:
        'Individual Tiptap table extension imported. Use TableKit from @tiptap/extension-table to configure all table elements together.',
    },
    schema: [],
  },
  create(context: any) {
    const individualImports: any[] = [];

    /** Local binding names introduced by an ImportDeclaration. */
    function localNames(node: any): string[] {
      return (node?.specifiers ?? [])
        .map((s: any) => s?.local?.name)
        .filter((n: any): n is string => typeof n === 'string');
    }

    /**
     * Splits every identifier reference in the program into two buckets:
     * names used as the base of `X.extend(...)`, and names used any other way.
     * Import declarations are skipped so a specifier's own local binding is
     * not mistaken for a use.
     */
    function collectReferences(program: any): { extendBases: Set<string>; otherRefs: Set<string> } {
      const extendBases = new Set<string>();
      const otherRefs = new Set<string>();
      // Identifier nodes already accounted for by an enclosing construct
      // (member property, object key, `.extend()` receiver). Populated on the
      // parent, which `walk` visits before descending into it.
      const consumed = new Set<any>();

      walk(program, (node: any) => {
        if (node?.type === 'ImportDeclaration') return false;

        if (node?.type === 'CallExpression') {
          const callee = node.callee;
          if (
            callee?.type === 'MemberExpression' &&
            !callee.computed &&
            callee.object?.type === 'Identifier' &&
            callee.property?.type === 'Identifier' &&
            callee.property.name === 'extend'
          ) {
            extendBases.add(callee.object.name);
            consumed.add(callee.object);
          }
          return;
        }

        // `foo.TableRow` — the property is not a reference to a binding.
        if (node?.type === 'MemberExpression' && !node.computed) consumed.add(node.property);
        // `{ TableRow: ... }` — likewise for a non-computed key.
        if (node?.type === 'Property' && !node.computed) consumed.add(node.key);

        if (node?.type === 'Identifier' && !consumed.has(node)) otherRefs.add(node.name);
      });

      return { extendBases, otherRefs };
    }

    return {
      ImportDeclaration(node: any) {
        const src: string = node?.source?.value ?? '';
        if (INDIVIDUAL_TABLE_PACKAGES.has(src)) {
          individualImports.push(node);
        }
      },

      'Program:exit'(program: any) {
        if (individualImports.length < 2) return;

        const { extendBases, otherRefs } = collectReferences(program);
        const registered = individualImports.filter((node) => {
          const names = localNames(node);
          if (names.length === 0) return true;
          // Exempt only when every binding from this import is an extend base
          // and is never referenced any other way.
          return !names.every((name) => extendBases.has(name) && !otherRefs.has(name));
        });

        // One report per file: the anti-pattern is the split registration as a
        // whole, not each import line.
        if (registered.length >= 2) {
          context.report({ node: registered[0], messageId: 'preferTableKit' });
        }
      },
    };
  },
};

export const tiptapPreferTableKitRule = rule;
