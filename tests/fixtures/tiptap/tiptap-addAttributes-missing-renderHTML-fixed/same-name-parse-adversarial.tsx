import { Node } from '@tiptap/core';
import Link from '@tiptap/extension-link';

function normalizeHref(raw: string | null) {
  if (!raw) return raw;
  return /^\S+@\S+\.\S+$/.test(raw) ? `mailto:${raw}` : raw;
}

// Adversarial: parseHTML reads the attribute's OWN name and transforms the
// value. Tiptap's default serialization writes `href` back, so this round-trips
// exactly — the missing renderHTML is not a defect.
export const NormalizedLink = Link.extend({
  addAttributes() {
    return {
      ...this.parent?.(),

      href: {
        parseHTML: (element) => normalizeHref(element.getAttribute('href')),
      },

      title: { default: null },
    };
  },
});

export const Embed = Node.create({
  name: 'embed',
  group: 'block',
  atom: true,

  addOptions() {
    return { allowFullscreen: true };
  },

  addAttributes() {
    return {
      // Adversarial: parseHTML ignores the element entirely and returns an
      // option. The parsed value never depends on HTML, so nothing is lost.
      allowfullscreen: {
        default: this.options.allowFullscreen,
        parseHTML: () => this.options.allowFullscreen,
      },

      // Adversarial: `rendered: false` opts out of serialization altogether.
      internalId: {
        default: null,
        rendered: false,
        parseHTML: (element) => element.getAttribute('data-internal-id'),
      },

      // Adversarial: the read name is computed, so no mismatch is provable.
      dynamic: {
        default: null,
        parseHTML: (element) => element.getAttribute(`data-${'dynamic'}-${Math.random()}`),
      },
    };
  },

  parseHTML() {
    return [{ tag: 'iframe' }];
  },

  renderHTML({ HTMLAttributes }) {
    return ['iframe', HTMLAttributes];
  },
});
