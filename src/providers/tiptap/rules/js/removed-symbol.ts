/**
 * tiptap-removed-symbol (compatibility)
 *
 * Data and prose only — the detection lives in the shared factory
 * (`providers/_shared/removed-symbol.ts`), which every provider's
 * compatibility rule is built from. What is Tiptap-specific is the package,
 * the hand-verified removals in `compatibility.ts`, and the rationale below.
 */
import { createRemovedSymbolRule } from '../../../_shared/removed-symbol.js';
import { TIPTAP_REACT_PACKAGE, tiptapRemovals } from '../../compatibility.js';

export const tiptapRemovedSymbolRule = createRemovedSymbolRule({
  packageName: TIPTAP_REACT_PACKAGE,
  removals: tiptapRemovals,
  description:
    'React component imported from @tiptap/react does not exist in the installed version',
  rationale:
    "Tiptap 3 moved BubbleMenu and FloatingMenu out of the @tiptap/react root and into the @tiptap/react/menus subpath, so the v2 import that agents overwhelmingly write — `import { BubbleMenu } from '@tiptap/react'` — resolves to undefined on an installed v3 and renders nothing, with no build error in a plain .jsx file. The check compares code against the version resolved from the project itself and only fires on a provable mismatch: a project pinned to Tiptap 2 using the root import is correct and is never flagged. The import from the new subpath is never flagged either, which matters here because the fix is a longer path under the same package name.",
  docsUrl: 'https://tiptap.dev/docs/editor/extensions/functionality/bubble-menu',
});
