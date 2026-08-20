/**
 * Hand-verified symbol removals in @tiptap/react, consumed by the
 * tiptap-removed-symbol compatibility rule.
 *
 * The rule fires only on a mismatch between code and the INSTALLED version —
 * it never suggests upgrading. A project pinned to Tiptap 2.x importing
 * `BubbleMenu` from `@tiptap/react` is correct and stays silent forever.
 *
 * Tiptap is a client-side editor, not an HTTP SDK: there is no request for two
 * symbols to agree on, so `wireIdentical` is `false` on every entry here by
 * definition rather than by finding. The thing that actually changed is stated
 * in `verifyHint`.
 *
 * The `SymbolRemoval` shape and the rules for writing `verifyHint` live in
 * src/types.ts — this file is the Tiptap data and nothing else.
 */
import type { ProviderCompatibility, SymbolRemoval } from '../../types.js';

export const TIPTAP_REACT_PACKAGE = '@tiptap/react';
export const TIPTAP_MENUS_MODULE = '@tiptap/react/menus';

export const tiptapRemovals: SymbolRemoval[] = [
  {
    symbol: 'BubbleMenu',
    removedIn: '3.0.1',
    replacement: 'BubbleMenu',
    movedTo: TIPTAP_MENUS_MODULE,
    kind: 'moved',
    // No wire call exists to be identical — see the file header.
    wireIdentical: false,
    verifiedAt: '2026-08-19',
    evidence:
      "npm pack @tiptap/react 2.27.2 / 3.0.0 / 3.0.1 / 3.30.2. 3.0.0's types entry (dist/packages/react/src/index.d.ts, per its own package.json) still has `export * from './BubbleMenu.js'`; 3.0.1 drops it from dist/index.d.ts and adds the './menus' export condition (dist/menus/index.d.ts exports BubbleMenu, FloatingMenu). Removed from the runtime bundle too — `BubbleMenu` does not appear in 3.0.1's dist/index.js. Repo commit 38146b740 'refactor: extract bubble-menu & floating-menu to own export (#5993)'. Props compared in @tiptap/extension-bubble-menu: 2.27.2 dist/bubble-menu-plugin.d.ts:26 `tippyOptions?: Partial<Props>` (Tippy.js) vs 3.30.2 dist/index.d.ts:73 `options?: {…}` (Floating UI).",
    verifyHint:
      "The component is the same feature but not the same signature: in 2.x it was a plain function component taking `editor` plus `tippyOptions`; in 3.x it is a forwardRef component whose `editor` prop is optional (it reads the editor from context) and which spreads HTMLAttributes onto its own wrapper div. After changing the import, check that any `tippyOptions` prop is translated to `options` and that a `ref` you passed still lands where you expect.",
  },
  {
    symbol: 'FloatingMenu',
    removedIn: '3.0.1',
    replacement: 'FloatingMenu',
    movedTo: TIPTAP_MENUS_MODULE,
    kind: 'moved',
    wireIdentical: false,
    verifiedAt: '2026-08-19',
    evidence:
      "npm pack @tiptap/react 2.27.2 / 3.0.0 / 3.0.1 / 3.30.2. Same boundary as BubbleMenu: present in 3.0.0's types entry, absent from 3.0.1's dist/index.d.ts and dist/index.js, present in dist/menus/index.d.ts. Repo commit 38146b740. Props compared in @tiptap/extension-floating-menu: 2.27.2 dist/floating-menu-plugin.d.ts:26 `tippyOptions?: Partial<Props>` vs 3.30.2 dist/index.d.ts:64 `options?: {…}`.",
    verifyHint:
      "Same component, new module, but the props moved too: 3.x keeps `editor` (nullable) and replaces the 2.x `tippyOptions` prop with `options`, and the component now forwards a ref and spreads HTMLAttributes onto its wrapper. After changing the import, check the `options`/`tippyOptions` prop name and the `shouldShow` signature at each call site.",
  },
];

/**
 * Manifest-facing record. Declaring this on `tiptapManifest.compatibility` is
 * the only registration step — nothing else needs to learn that Tiptap has
 * removals.
 */
export const tiptapCompatibility: ProviderCompatibility = {
  package: TIPTAP_REACT_PACKAGE,
  removals: tiptapRemovals,
};
