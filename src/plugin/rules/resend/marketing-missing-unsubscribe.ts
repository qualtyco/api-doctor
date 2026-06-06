/**
 * resend-marketing-missing-unsubscribe (correctness)
 *
 * Audit finding B [CRITICAL]: marketing emails must give recipients a way to
 * unsubscribe (CAN-SPAM / CASL). Flags a Resend send whose `tags` mark it as
 * marketing while the same call provides neither a `List-Unsubscribe` header
 * nor the `{{{RESEND_UNSUBSCRIBE_URL}}}` placeholder in its HTML.
 */
import { findProperty, getSendOptionObjects } from '../../utils/resend.js';

const MARKETING_TAG = /marketing|campaign|newsletter|promotion/i;
const UNSUBSCRIBE_PLACEHOLDER = '{{{RESEND_UNSUBSCRIBE_URL}}}';

function literalString(node: any): string | undefined {
  if (node?.type === 'Literal' && typeof node.value === 'string') return node.value;
  if (node?.type === 'TemplateLiteral') {
    return (node.quasis ?? [])
      .map((q: any) => q?.value?.cooked ?? q?.value?.raw ?? '')
      .join(' ');
  }
  return undefined;
}

function hasMarketingTag(opts: any): boolean {
  const tagsProp = findProperty(opts, 'tags');
  const arr = tagsProp?.value;
  if (arr?.type !== 'ArrayExpression') return false;
  for (const el of arr.elements ?? []) {
    if (el?.type !== 'ObjectExpression') continue;
    const valueProp = findProperty(el, 'value');
    const v = literalString(valueProp?.value);
    if (typeof v === 'string' && MARKETING_TAG.test(v)) return true;
  }
  return false;
}

function hasListUnsubscribeHeader(opts: any): boolean {
  const headersProp = findProperty(opts, 'headers');
  const obj = headersProp?.value;
  if (obj?.type !== 'ObjectExpression') return false;
  return (obj.properties ?? []).some((p: any) => {
    if (p?.type !== 'Property') return false;
    const key =
      p.key?.type === 'Literal'
        ? String(p.key.value)
        : p.key?.type === 'Identifier'
          ? p.key.name
          : '';
    return key.toLowerCase() === 'list-unsubscribe';
  });
}

function htmlHasUnsubscribePlaceholder(opts: any): boolean {
  const htmlProp = findProperty(opts, 'html');
  const text = literalString(htmlProp?.value);
  return typeof text === 'string' && text.includes(UNSUBSCRIBE_PLACEHOLDER);
}

function hasUnsubscribeMechanism(opts: any): boolean {
  return hasListUnsubscribeHeader(opts) || htmlHasUnsubscribePlaceholder(opts);
}

const rule = {
  meta: {
    type: 'problem',
    docs: {
      description: 'Marketing emails must include an unsubscribe mechanism',
      category: 'correctness',
      docsUrl: 'https://resend.com/docs/dashboard/broadcasts/introduction',
      recommended: true,
    },
    messages: {
      missingUnsubscribe:
        'Marketing email has no unsubscribe mechanism (List-Unsubscribe header or {{{RESEND_UNSUBSCRIBE_URL}}}).',
    },
    schema: [],
  },
  create(context: any) {
    return {
      CallExpression(node: any) {
        for (const opts of getSendOptionObjects(node)) {
          if (hasMarketingTag(opts) && !hasUnsubscribeMechanism(opts)) {
            context.report({ node, messageId: 'missingUnsubscribe' });
            return;
          }
        }
      },
    };
  },
};

export const resendMarketingMissingUnsubscribeRule = rule;
export default rule;
