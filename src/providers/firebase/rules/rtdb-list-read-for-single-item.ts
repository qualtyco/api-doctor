/**
 * firebase-rtdb-list-read-for-single-item (correctness)
 *
 * A page keyed by a single route param (e.g. `taskId` from `useParams()`)
 * that subscribes to the whole collection and then does
 * `items.find((item) => item.id === taskId)` downloads every row the user
 * has just to read one, and renders a false "not found" state until the
 * full list streams in.
 */
import { comparesIdentifier, someDescendant } from '../utils.js';

function isSetterName(name: string): boolean {
  return /^set[A-Z]/.test(name);
}

function stateVarFromSetter(name: string): string {
  return name.slice(3, 4).toLowerCase() + name.slice(4);
}

const rule = {
  meta: {
    type: 'suggestion',
    docs: {
      description: 'Pages keyed by a single id should not subscribe to the whole collection',
      category: 'correctness',
      rationale:
        'Subscribing to an entire collection and then Array.prototype.find()-ing by a route id param means the page renders a false "not found" state until the full list streams in, and downloads every row the user has just to read one. Use a single-node read/subscribe (ref(db, `path/${id}`)) instead.',
      docsUrl: 'https://firebase.google.com/docs/database/web/read-and-write',
      recommended: true,
    },
    messages: {
      listReadForSingleItem:
        'This subscribes to a whole collection and finds one item by a route id param. Read/subscribe to that single node directly instead.',
    },
    schema: [],
  },
  create(context: any) {
    let idParamName: string | undefined;
    const listStateVars = new Set<string>();
    const findCalls: Array<{ node: any; objectName: string; callback: any }> = [];

    return {
      VariableDeclarator(node: any) {
        if (
          node.init?.type === 'CallExpression' &&
          node.init.callee?.type === 'Identifier' &&
          node.init.callee.name === 'useParams' &&
          node.id?.type === 'ObjectPattern'
        ) {
          for (const p of node.id.properties ?? []) {
            if (p?.type === 'Property' && p.value?.type === 'Identifier' && /id$/i.test(p.value.name)) {
              idParamName = p.value.name;
            }
          }
        }
      },
      CallExpression(node: any) {
        for (const arg of node.arguments ?? []) {
          if (arg?.type === 'Identifier' && isSetterName(arg.name)) {
            listStateVars.add(stateVarFromSetter(arg.name));
          }
        }

        if (node.callee?.type !== 'MemberExpression' || node.callee.computed) return;
        if (node.callee.property?.type !== 'Identifier' || node.callee.property.name !== 'find') return;
        const obj = node.callee.object;
        if (obj?.type !== 'Identifier') return;
        findCalls.push({ node, objectName: obj.name, callback: node.arguments?.[0] });
      },
      'Program:exit'() {
        if (!idParamName) return;
        for (const { node, objectName, callback } of findCalls) {
          if (!listStateVars.has(objectName)) continue;
          if (!callback) continue;
          if (someDescendant(callback, (n) => comparesIdentifier(n, idParamName as string))) {
            context.report({ node, messageId: 'listReadForSingleItem' });
          }
        }
      },
    };
  },
};

export const firebaseRtdbListReadForSingleItemRule = rule;
export default rule;
