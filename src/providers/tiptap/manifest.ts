import type { ProviderManifest } from '../../types.js';
import { tiptapCompatibility } from './compatibility.js';

export const tiptapManifest: ProviderManifest = {
  name: 'tiptap',
  displayName: 'Tiptap',
  detect: {
    packages: ['@tiptap/core', '@tiptap/react', '@tiptap/pm'],
    imports: ['@tiptap/core', '@tiptap/react', '@tiptap/pm'],
    urlPatterns: ['tiptap.dev'],
  },
  rules: [
    {
      key: 'tiptap-upload-validate-fn-void',
      resultRule: 'tiptap/security/upload-validate-fn-void',
      message: 'validateFn return value discarded — file validation never blocks uploads.',
      fix: 'Change validateFn return type to boolean and guard: if (validateFn && !validateFn(file)) return;',
      docsUrl: 'https://tiptap.dev/docs/editor/extensions/custom-extensions/node-views',
      severity: 'error',
    },
    {
      key: 'tiptap-script-src-hardcoded-api-key',
      resultRule: 'tiptap/security/script-src-hardcoded-api-key',
      message: 'script.src contains a hardcoded API key.',
      fix: 'Read the key from process.env and assemble the URL at runtime.',
      docsUrl: 'https://tiptap.dev/docs/editor/extensions/custom-extensions/node-views',
      severity: 'error',
    },
    {
      key: 'tiptap-dynamic-script-no-sri',
      resultRule: 'tiptap/security/dynamic-script-no-sri',
      message: 'Dynamically injected script appended without SRI integrity attribute.',
      fix: 'Add script.setAttribute("integrity", "sha384-...") before appending the script.',
      docsUrl: 'https://developer.mozilla.org/en-US/docs/Web/Security/Defenses/Subresource_Integrity',
      severity: 'warning',
    },
    {
      key: 'tiptap-addAttributes-missing-renderHTML',
      resultRule: 'tiptap/correctness/addAttributes-missing-renderHTML',
      message: 'Tiptap attribute parses from a different name than it renders — value lost on HTML round-trip.',
      fix: 'Add renderHTML to the attribute descriptor, writing back the same name parseHTML reads.',
      docsUrl: 'https://tiptap.dev/docs/editor/extensions/custom-extensions/create-new/node#attributes',
      severity: 'error',
    },
    {
      key: 'tiptap-appendTransaction-add-to-history',
      resultRule: 'tiptap/correctness/appendTransaction-add-to-history',
      message: 'appendTransaction mutates without setMeta("addToHistory", false) — pollutes undo stack.',
      fix: 'Chain .setMeta("addToHistory", false) onto the transaction before dispatching.',
      docsUrl: 'https://prosemirror.net/docs/ref/#state.Transaction.setMeta',
      severity: 'warning',
    },
    {
      key: 'tiptap-appendTransaction-full-scan',
      resultRule: 'tiptap/reliability/appendTransaction-full-scan',
      message: 'appendTransaction calls doc.descendants() on every transaction — O(n) per keystroke.',
      fix: 'Guard with: const docChanged = transactions.some(tr => tr.docChanged); if (!docChanged) return;',
      docsUrl: 'https://prosemirror.net/docs/ref/#state.PluginSpec.appendTransaction',
      severity: 'warning',
    },
    {
      key: 'tiptap-atom-node-wrap-in',
      resultRule: 'tiptap/correctness/atom-node-wrap-in',
      message: 'wrapIn() called with an atom node type — always silently returns false.',
      fix: 'Use replaceSelectionWith(nodeType.create()) instead of wrapIn().',
      docsUrl: 'https://tiptap.dev/docs/editor/extensions/custom-extensions/create-new/node',
      severity: 'warning',
    },
    {
      key: 'tiptap-drop-handler-pos-precedence',
      resultRule: 'tiptap/correctness/drop-handler-pos-precedence',
      message: 'Operator precedence bug: x ?? 0 - 1 evaluates to x ?? -1, not (x ?? 0) - 1.',
      fix: 'Add parentheses: (coordinates?.pos ?? 0) - 1',
      docsUrl: 'https://prosemirror.net/docs/ref/#view.EditorView.posAtCoords',
      severity: 'warning',
    },
    {
      key: 'tiptap-prefer-table-kit',
      resultRule: 'tiptap/correctness/prefer-table-kit',
      message: 'Individual Tiptap table extension imported — use TableKit instead.',
      fix: 'Import TableKit from @tiptap/extension-table and configure all table elements together.',
      docsUrl: 'https://tiptap.dev/docs/editor/extensions/functionality/table-kit',
      severity: 'info',
    },
    {
      key: 'tiptap-tiptap-markdown-missing-node-spec',
      resultRule: 'tiptap/reliability/tiptap-markdown-missing-node-spec',
      message: 'Tiptap node used with tiptap-markdown has no markdown serialization spec — content lost on export.',
      fix: 'Return a markdown serialize/parse spec (MarkdownNodeSpec) from addStorage — tiptap-markdown reads only extension.storage.markdown.',
      docsUrl: 'https://github.com/aguingand/tiptap-markdown',
      severity: 'warning',
    },
    {
      key: 'tiptap-removed-symbol',
      resultRule: 'tiptap/removed-symbol',
      message:
        'Code imports a React component from @tiptap/react that does not exist in the installed version.',
      fix: "Import BubbleMenu and FloatingMenu from '@tiptap/react/menus' instead of '@tiptap/react'. Check the per-finding Verify line before assuming the props carry over — the 2.x tippyOptions prop is 3.x options, and the components now forward a ref.",
      docsUrl: 'https://tiptap.dev/docs/editor/extensions/functionality/bubble-menu',
      severity: 'error',
      // The finding must name the installed version ("you have 3.30.2
      // installed") — that fact only exists at lint time.
      dynamicMessage: true,
    },
  ],
  compatibility: tiptapCompatibility,
};
