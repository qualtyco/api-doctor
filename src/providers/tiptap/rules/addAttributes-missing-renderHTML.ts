/**
 * tiptap-addAttributes-missing-renderHTML (correctness)
 *
 * Detects TipTap node/mark attribute descriptors that define `parseHTML` but
 * not `renderHTML`. Without `renderHTML`, TipTap serializes the attribute
 * using the plain attribute name, while `parseHTML` reads from `data-*`.
 * The mismatch silently drops attribute values on HTML round-trips.
 */
import { findProperty, walk } from '../utils.js';

const rule = {
  meta: {
    type: 'problem',
    docs: {
      description: 'TipTap addAttributes descriptors with parseHTML must also define renderHTML',
      category: 'correctness',
      rationale:
        'When an attribute defines parseHTML: (el) => el.getAttribute("data-label") but no renderHTML, TipTap emits the attribute as a plain HTML attribute (label="...") instead of data-label="...". On re-parse, getAttribute("data-label") returns null and the value falls back to the default, silently discarding any customization across HTML export/import cycles.',
      docsUrl: 'https://tiptap.dev/docs/editor/extensions/custom-extensions/create-new/node#attributes',
      recommended: true,
    },
    messages: {
      missingRenderHTML:
        'Attribute defines parseHTML but no renderHTML. TipTap will serialize this attribute with the default name, breaking the HTML round-trip. Add renderHTML: (attrs) => ({ "data-<name>": attrs.<name> }).',
    },
    schema: [],
  },
  create(context: any) {
    function checkAddAttributesReturn(returnObj: any): void {
      if (returnObj?.type !== 'ObjectExpression') return;
      for (const prop of returnObj.properties ?? []) {
        if (prop?.type !== 'Property') continue;
        const val = prop.value;
        if (val?.type !== 'ObjectExpression') continue;
        // Check if descriptor has parseHTML but not renderHTML
        if (findProperty(val, 'parseHTML') && !findProperty(val, 'renderHTML')) {
          context.report({ node: val, messageId: 'missingRenderHTML' });
        }
      }
    }

    function checkAddAttributesFunction(fn: any): void {
      // Find ReturnStatement(s) and check the returned object
      walk(fn, (node: any) => {
        if (node?.type === 'ReturnStatement' && node.argument) {
          checkAddAttributesReturn(node.argument);
        }
      });
    }

    return {
      // Handles: addAttributes() { return { ... } } as method shorthand
      // and addAttributes: function() { } / addAttributes: () => { }
      Property(node: any) {
        const keyName =
          node.key?.type === 'Identifier'
            ? node.key.name
            : node.key?.type === 'Literal'
            ? node.key.value
            : null;
        if (keyName !== 'addAttributes') return;

        const val = node.value;
        if (!val) return;

        if (
          val.type === 'FunctionExpression' ||
          val.type === 'ArrowFunctionExpression'
        ) {
          // Arrow with expression body: addAttributes: () => ({ ... })
          if (val.body?.type === 'ObjectExpression') {
            checkAddAttributesReturn(val.body);
          } else {
            checkAddAttributesFunction(val.body);
          }
        }
      },
    };
  },
};

export const tiptapAddAttributesMissingRenderHTMLRule = rule;
export default rule;
