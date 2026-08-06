/**
 * tiptap-addAttributes-missing-renderHTML (correctness)
 *
 * Detects Tiptap node/mark attribute descriptors that define `parseHTML` but
 * not `renderHTML`, *and* whose `parseHTML` reads the value from somewhere
 * other than the attribute's own name.
 *
 * The absence of `renderHTML` is not itself a defect. Tiptap's
 * `getRenderedAttributes` falls back to `{ [name]: attrs[name] }`, so a
 * descriptor whose `parseHTML` reads the same-named attribute round-trips
 * correctly — `href: { parseHTML: (el) => normalize(el.getAttribute('href')) }`
 * is a value transform, not a lost attribute. The bug only exists when the
 * read name and the written name disagree (`data-label` in, `label` out), or
 * when the value is read from somewhere an attribute cannot be written back
 * to at all (inline styles, text content).
 */
import { findProperty, getLiteralString, walk } from '../../utils.js';

/**
 * Sources a `parseHTML` can read that no default attribute serialization can
 * write back, whatever the attribute is called. Distinct from real attribute
 * names so they can never compare equal to the descriptor key.
 */
const STYLE_SOURCE = '<style>';
const CONTENT_SOURCE = '<content>';

/** A read whose name is computed at runtime — unresolvable, so never reported. */
const UNKNOWN_SOURCE = '<unknown>';

const CONTENT_PROPERTIES = new Set(['textContent', 'innerText', 'innerHTML', 'outerHTML']);
const ATTRIBUTE_READERS = new Set(['getAttribute', 'hasAttribute', 'getAttributeNS']);

/** `fooBar` → `data-foo-bar`, matching the DOM's dataset ↔ attribute mapping. */
function datasetKeyToAttributeName(key: string): string {
  return `data-${key.replace(/[A-Z]/g, (c) => `-${c.toLowerCase()}`)}`;
}

/** True when `node` is a non-computed member access named `name`. */
function isMemberNamed(node: any, name: string): boolean {
  return (
    node?.type === 'MemberExpression' &&
    !node.computed &&
    node.property?.type === 'Identifier' &&
    node.property.name === name
  );
}

/**
 * Collects every source name a `parseHTML` implementation reads from.
 * Returns real HTML attribute names lowercased, plus the two sentinels above.
 * An empty set means nothing recognisable was read — the descriptor's value
 * does not come from the DOM, so there is no round-trip to break.
 */
function collectReadSources(parseHTMLValue: any): Set<string> {
  const sources = new Set<string>();

  walk(parseHTMLValue, (node: any) => {
    if (node?.type === 'CallExpression') {
      const callee = node.callee;
      if (callee?.type === 'MemberExpression' && !callee.computed && callee.property?.type === 'Identifier') {
        const method = callee.property.name;

        // el.getAttribute('data-label') / el.hasAttribute('x')
        if (ATTRIBUTE_READERS.has(method)) {
          // getAttributeNS takes (namespace, name); the others take (name).
          const nameArg = method === 'getAttributeNS' ? node.arguments?.[1] : node.arguments?.[0];
          const name = getLiteralString(nameArg);
          // A computed name is unresolvable — stay silent rather than guess.
          sources.add(name === null ? UNKNOWN_SOURCE : name.toLowerCase());
        }

        // el.style.getPropertyValue('font-size')
        if (method === 'getPropertyValue' && isMemberNamed(callee.object, 'style')) {
          sources.add(STYLE_SOURCE);
        }
      }
      return;
    }

    if (node?.type === 'MemberExpression') {
      // el.dataset.fooBar → data-foo-bar; el.dataset['foo-bar'] → data-foo-bar
      if (isMemberNamed(node.object, 'dataset')) {
        const key = node.computed
          ? getLiteralString(node.property)
          : node.property?.type === 'Identifier'
          ? node.property.name
          : null;
        sources.add(key === null ? UNKNOWN_SOURCE : datasetKeyToAttributeName(key).toLowerCase());
      }

      // el.style.fontSize — an inline style, not an attribute of its own
      if (!node.computed && isMemberNamed(node.object, 'style')) sources.add(STYLE_SOURCE);

      // el.textContent, el.innerHTML — content, not an attribute
      if (!node.computed && node.property?.type === 'Identifier' && CONTENT_PROPERTIES.has(node.property.name)) {
        sources.add(CONTENT_SOURCE);
      }
    }
  });

  return sources;
}

const rule = {
  meta: {
    type: 'problem',
    docs: {
      description: 'Tiptap addAttributes descriptors that parse from a different name must define renderHTML',
      category: 'correctness',
      rationale:
        'When an attribute defines parseHTML: (el) => el.getAttribute("data-label") but no renderHTML, Tiptap emits the attribute as a plain HTML attribute (label="...") instead of data-label="...". On re-parse, getAttribute("data-label") returns null and the value falls back to the default, silently discarding any customization across HTML export/import cycles. Only a name mismatch causes this: Tiptap\'s getRenderedAttributes falls back to { [name]: attrs[name] }, so parsing the attribute\'s own name — el.getAttribute("href") on an href attribute — round-trips correctly and is not reported, and neither is a parseHTML that reads nothing from the element.',
      docsUrl: 'https://tiptap.dev/docs/editor/extensions/custom-extensions/create-new/node#attributes',
      recommended: true,
    },
    messages: {
      missingRenderHTML:
        'Attribute "{{name}}" parses from {{source}} but has no renderHTML, so Tiptap serializes it as {{name}}="…". On re-parse the value is not found and falls back to the default. Add renderHTML: (attrs) => ({ "{{source}}": attrs.{{name}} }).',
      missingRenderHTMLStyle:
        'Attribute "{{name}}" parses from an inline style but has no renderHTML, so Tiptap serializes it as {{name}}="…" and never writes the style back. On re-parse the value falls back to the default. Add a renderHTML that emits the style, e.g. (attrs) => ({ style: `…: ${attrs.{{name}}}` }).',
      missingRenderHTMLContent:
        'Attribute "{{name}}" parses from the element\'s text content but has no renderHTML, so Tiptap serializes it as {{name}}="…" while re-parsing reads the text instead. Add a renderHTML that writes the value where parseHTML reads it.',
    },
    schema: [],
  },
  create(context: any) {
    /** The descriptor key, however it was written. */
    function propertyName(prop: any): string | null {
      if (prop?.key?.type === 'Identifier' && !prop.computed) return prop.key.name;
      if (prop?.key?.type === 'Literal' && typeof prop.key.value === 'string') return prop.key.value;
      return null;
    }

    /**
     * True when the extension's own node/mark-level `renderHTML` mentions this
     * attribute — by value (`attrs.label`, `{ label }`) or by output name
     * (`'data-label'`). Serialization is then hand-written there and the
     * per-attribute `renderHTML` is redundant.
     */
    function extensionRenderHTMLHandles(extensionRenderHTML: any, name: string, source: string): boolean {
      if (!extensionRenderHTML) return false;
      let handled = false;
      walk(extensionRenderHTML, (node: any) => {
        if (handled) return false;
        if (node?.type === 'Identifier' && node.name === name) handled = true;
        const literal = getLiteralString(node);
        if (literal !== null && (literal === name || literal === source)) handled = true;
      });
      return handled;
    }

    function checkAddAttributesReturn(returnObj: any, extensionRenderHTML: any): void {
      if (returnObj?.type !== 'ObjectExpression') return;
      for (const prop of returnObj.properties ?? []) {
        if (prop?.type !== 'Property') continue;
        const val = prop.value;
        if (val?.type !== 'ObjectExpression') continue;

        const parseHTML = findProperty(val, 'parseHTML');
        if (!parseHTML || findProperty(val, 'renderHTML')) continue;

        const name = propertyName(prop);
        if (name === null) continue;

        // `rendered: false` opts the attribute out of HTML serialization
        // entirely — there is no round-trip to break.
        const rendered = findProperty(val, 'rendered');
        if (rendered?.value?.type === 'Literal' && rendered.value.value === false) continue;

        const sources = collectReadSources(parseHTML.value);

        // Nothing read from the DOM (a constant, an option, a helper call), or
        // a name resolvable only at runtime — no provable mismatch.
        if (sources.size === 0 || sources.has(UNKNOWN_SOURCE)) continue;

        // Reading the attribute's own name is exactly what the default
        // serialization writes back. `href: (el) => norm(el.getAttribute('href'))`
        // is a value transform and round-trips cleanly.
        if (sources.has(name.toLowerCase())) continue;

        // Report the first source; a descriptor reading several is rare, and
        // one concrete name is more actionable than a list.
        const [source] = sources;

        if (extensionRenderHTMLHandles(extensionRenderHTML, name, source)) continue;

        const messageId =
          source === STYLE_SOURCE
            ? 'missingRenderHTMLStyle'
            : source === CONTENT_SOURCE
            ? 'missingRenderHTMLContent'
            : 'missingRenderHTML';
        context.report({ node: val, messageId, data: { name, source } });
      }
    }

    function checkAddAttributesFunction(fn: any, extensionRenderHTML: any): void {
      // Find ReturnStatement(s) and check the returned object
      walk(fn, (node: any) => {
        if (node?.type === 'ReturnStatement' && node.argument) {
          checkAddAttributesReturn(node.argument, extensionRenderHTML);
        }
      });
    }

    return {
      // The extension config object, so `addAttributes` is read alongside its
      // sibling `renderHTML`. Handles addAttributes as a method shorthand and
      // as addAttributes: function() {} / addAttributes: () => {}.
      ObjectExpression(config: any) {
        const addAttributes = findProperty(config, 'addAttributes');
        if (!addAttributes) return;

        const extensionRenderHTML = findProperty(config, 'renderHTML')?.value ?? null;

        const val = addAttributes.value;
        if (!val) return;

        if (
          val.type === 'FunctionExpression' ||
          val.type === 'ArrowFunctionExpression'
        ) {
          // Arrow with expression body: addAttributes: () => ({ ... })
          if (val.body?.type === 'ObjectExpression') {
            checkAddAttributesReturn(val.body, extensionRenderHTML);
          } else {
            checkAddAttributesFunction(val.body, extensionRenderHTML);
          }
        }
      },
    };
  },
};

export const tiptapAddAttributesMissingRenderHTMLRule = rule;
export default rule;
