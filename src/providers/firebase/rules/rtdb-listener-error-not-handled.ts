/**
 * firebase-rtdb-listener-error-not-handled (reliability)
 *
 * `onValue`'s documented signature accepts a 3rd argument (a cancel/error
 * callback, or listen options). A 2-argument call drops that error path
 * entirely, so a PERMISSION_DENIED or dropped connection produces no UI
 * feedback and no console output.
 */
import { isIdentifierCall, namedImportsFrom } from '../utils.js';

const rule = {
  meta: {
    type: 'suggestion',
    docs: {
      description: 'onValue listeners should handle the error callback',
      category: 'reliability',
      rationale:
        "onValue's callback signature includes a documented error callback specifically for permission-denied and connection-loss cases. A call with only the success callback (2 arguments) silently drops that path, so a PERMISSION_DENIED or offline event produces no UI feedback and no console output.",
      docsUrl: 'https://firebase.google.com/docs/reference/js/database.md#onvalue',
      recommended: true,
    },
    messages: {
      listenerErrorNotHandled:
        'onValue is called with no error/cancel callback. Pass a 3rd argument so PERMISSION_DENIED and dropped connections surface somewhere.',
    },
    schema: [],
  },
  create(context: any) {
    let onValueLocalName: string | undefined;

    return {
      ImportDeclaration(node: any) {
        const imports = namedImportsFrom(node, 'firebase/database');
        if (imports.has('onValue')) onValueLocalName = imports.get('onValue');
      },
      CallExpression(node: any) {
        if (!isIdentifierCall(node, onValueLocalName)) return;
        if ((node.arguments ?? []).length < 3) {
          context.report({ node, messageId: 'listenerErrorNotHandled' });
        }
      },
    };
  },
};

export const firebaseRtdbListenerErrorNotHandledRule = rule;
export default rule;
