/**
 * resend-missing-tags (integration)
 *
 * Tags power deliverability segmentation in the Resend dashboard. Flags a
 * Resend send whose statically-visible email option object(s) omit a `tags`
 * property. Dynamic argument shapes (e.g. batch built via `.map()`) are skipped
 * to avoid false positives. Advisory only (info).
 */
import { findProperty, getSendOptionObjects, isResendSendCall } from '../../utils/resend.js';

const rule = {
  meta: {
    type: 'suggestion',
    docs: {
      description: 'Resend sends should include tags for deliverability segmentation',
      category: 'integration',
      docsUrl: 'https://resend.com/docs/dashboard/emails/tags',
      recommended: true,
    },
    messages: {
      missingTags:
        'Resend send has no tags. Add tags (e.g. [{ name: "category", value: "welcome" }]) for segmentation.',
    },
    schema: [],
  },
  create(context: any) {
    return {
      CallExpression(node: any) {
        if (!isResendSendCall(node)) return;
        const optionObjects = getSendOptionObjects(node);
        if (optionObjects.length === 0) return; // dynamic shape: cannot tell
        const someMissingTags = optionObjects.some((opts) => !findProperty(opts, 'tags'));
        if (someMissingTags) {
          context.report({ node, messageId: 'missingTags' });
        }
      },
    };
  },
};

export const resendMissingTagsRule = rule;
export default rule;
