/**
 * Flags POST webhook routes that read req.body but never validate the
 * X-Twilio-Signature header via twilio.validateRequest()/RequestValidator
 * anywhere in the file (CWE-345, Finding A).
 */
import { isPostRouteRegistration, referencesRequestBody, findInSubtree } from '../utils.js';

const rule = {
  meta: {
    type: 'problem',
    docs: {
      description: 'Twilio webhook routes must validate the X-Twilio-Signature header before trusting the body',
      category: 'security',
      cwe: 'CWE-345',
      owasp: 'A07:2021 Identification and Authentication Failures',
      rationale:
        'Webhook URLs are public. Anyone who learns or guesses the path can POST a forged body — fake CallSid/From/TaskAttributes values — and the handler has no way to tell it apart from a real Twilio request. Without validating the signature first, an attacker can trigger outbound calls (toll/billing impact) or falsely invoke reservation/task callbacks to manipulate call state for an arbitrary caller.',
      docsUrl: 'https://www.twilio.com/docs/usage/webhooks/webhooks-security',
      recommended: true,
    },
    messages: {
      missingSignatureValidation:
        'This POST webhook route reads req.body but the file never validates the X-Twilio-Signature header via twilio.validateRequest()/RequestValidator — a forged request body is indistinguishable from a real Twilio callback.',
    },
  },
  create(context: any) {
    function isValidateRequestCall(n: any): boolean {
      if (n?.type !== 'CallExpression') return false;
      const callee = n.callee;
      if (callee?.type !== 'MemberExpression') return false;
      return callee.property?.type === 'Identifier' && callee.property.name === 'validateRequest';
    }

    function isRequestValidatorConstruction(n: any): boolean {
      return n?.type === 'NewExpression' && n.callee?.type === 'Identifier' && n.callee.name === 'RequestValidator';
    }

    return {
      'Program:exit'(program: any) {
        const hasValidation =
          !!findInSubtree(program, isValidateRequestCall) || !!findInSubtree(program, isRequestValidatorConstruction);
        if (hasValidation) return;

        const postRoutes: any[] = [];
        findInSubtree(program, (n) => {
          if (isPostRouteRegistration(n) && referencesRequestBody(n)) postRoutes.push(n);
          return false;
        });

        for (const route of postRoutes) {
          context.report({ node: route, messageId: 'missingSignatureValidation' });
        }
      },
    };
  },
};

export const twilioValidateWebhookSignatureRule = rule;
