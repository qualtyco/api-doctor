/**
 * tiptap-prefer-table-kit (integration)
 *
 * Detects when individual TipTap table sub-packages are imported instead of
 * using TableKit from @tiptap/extension-table. Individual imports miss the
 * coordinated configuration and the mergeOrSplit command.
 */

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
      category: 'integration',
      rationale:
        'Importing table extensions individually from their separate packages bypasses the coordinated wiring that TableKit provides: shared configuration, the mergeOrSplit command, and consistent HTMLAttributes across all table elements. Individual imports also leave TableCell and TableHeader unconfigured by default.',
      docsUrl: 'https://tiptap.dev/docs/editor/extensions/functionality/table-kit',
      recommended: true,
    },
    messages: {
      preferTableKit:
        'Individual TipTap table extension imported. Use TableKit from @tiptap/extension-table for coordinated configuration and the mergeOrSplit command.',
    },
    schema: [],
  },
  create(context: any) {
    const individualImports: any[] = [];

    return {
      ImportDeclaration(node: any) {
        const src: string = node?.source?.value ?? '';
        if (INDIVIDUAL_TABLE_PACKAGES.has(src)) {
          individualImports.push(node);
        }
      },

      'Program:exit'() {
        if (individualImports.length >= 2) {
          for (const node of individualImports) {
            context.report({ node, messageId: 'preferTableKit' });
          }
        }
      },
    };
  },
};

export const tiptapPreferTableKitRule = rule;
export default rule;
