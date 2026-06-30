const rule = {
  meta: {
    type: 'suggestion',
    docs: {
      description: 'Firestore array field updated with read-modify-write spread/filter instead of arrayUnion/arrayRemove',
      category: 'correctness',
      rationale:
        'Spreading an array or using filter() inside updateDoc() performs a non-atomic read-modify-write that loses concurrent updates. Firestore provides arrayUnion() and arrayRemove() specifically for atomic array updates that do not require reading the document first.',
      docsUrl: 'https://firebase.google.com/docs/firestore/manage-data/add-data#update_elements_in_an_array',
      recommended: true,
    },
    messages: {
      useArrayUnionRemove:
        'Firestore array updated with read-modify-write spread/filter. Use arrayUnion() or arrayRemove() for atomic updates that do not require reading the document first.',
    },
    schema: [],
  },
  create(context: any) {
    function hasSpreadOrFilterValue(obj: any): boolean {
      if (obj?.type !== 'ObjectExpression') return false;
      for (const prop of obj.properties ?? []) {
        if (prop?.type !== 'Property') continue;
        const val = prop.value;
        // [...existing, newItem]
        if (val?.type === 'ArrayExpression') {
          if ((val.elements ?? []).some((el: any) => el?.type === 'SpreadElement')) {
            return true;
          }
        }
        // existingArray.filter(...)
        if (
          val?.type === 'CallExpression' &&
          val.callee?.type === 'MemberExpression' &&
          val.callee.property?.type === 'Identifier' &&
          val.callee.property.name === 'filter'
        ) {
          return true;
        }
      }
      return false;
    }

    return {
      CallExpression(node: any) {
        const callee = node.callee;
        if (callee?.type !== 'Identifier' || callee.name !== 'updateDoc') return;
        const args = node.arguments ?? [];
        if (args.length < 2) return;
        const payload = args[1];
        if (hasSpreadOrFilterValue(payload)) {
          context.report({ node, messageId: 'useArrayUnionRemove' });
        }
      },
    };
  },
};

export const firebaseUseArrayUnionRemoveRule = rule;
export default rule;
