/**
 * Flags a hand-rolled JWKS key resolver (TTL-cached fetch + `.find(k => k.kid
 * === header.kid)`) that never retries with a forced refresh when the kid
 * lookup misses — Auth0 key rotation then causes failures until the cache
 * naturally expires.
 */
const rule = {
  meta: {
    type: 'problem',
    docs: {
      description:
        'A hand-rolled JWKS key resolver must retry with a forced refresh when a kid is not found in the cache',
      category: 'reliability',
      rationale:
        "On signing-key rotation, Auth0 immediately starts issuing tokens signed with a new key while the old key stays valid in parallel. A worker whose local JWKS cache predates the rotation has the old key but not the new one, so every newly issued token fails to validate until that worker's cache naturally expires — up to the full TTL. Retrying with a forced refresh on a kid miss (instead of failing immediately) closes that window.",
      docsUrl: 'https://auth0.com/docs/get-started/tenant-settings/signing-keys/rotate-signing-keys',
      recommended: true,
    },
    messages: {
      noRefreshOnMiss:
        'This kid lookup has no retry-with-forced-refresh path. If the cached JWKS predates a key rotation, every token signed with the new key fails until the cache naturally expires.',
    },
  },
  create(context: any) {
    type Pos = { offset: number; line: number; column: number };
    type FnState = {
      node: any;
      start: Pos;
      end: Pos;
      findCallNode: any;
      sawKidComparison: boolean;
      fetchCallCount: number;
      sawForceRefresh: boolean;
    };

    const fnStates: FnState[] = [];

    function nodeStartPos(n: any): Pos {
      const rangeStart = typeof n?.range?.[0] === 'number' ? n.range[0] : null;
      const line = n?.loc?.start?.line ?? 1;
      const column = n?.loc?.start?.column ?? 0;
      return { offset: rangeStart ?? line * 1_000_000 + column, line, column };
    }

    function nodeEndPos(n: any): Pos {
      const rangeEnd = typeof n?.range?.[1] === 'number' ? n.range[1] : null;
      const line = n?.loc?.end?.line ?? n?.loc?.start?.line ?? 1;
      const column = n?.loc?.end?.column ?? n?.loc?.start?.column ?? 0;
      return { offset: rangeEnd ?? line * 1_000_000 + column, line, column };
    }

    function within(state: FnState, n: any): boolean {
      const p = nodeStartPos(n);
      return p.offset >= state.start.offset && p.offset <= state.end.offset;
    }

    function collectTopLevelFunctions(programNode: any): any[] {
      const fns: any[] = [];
      for (const stmt of programNode.body ?? []) {
        const decl = stmt?.type === 'ExportNamedDeclaration' && stmt.declaration ? stmt.declaration : stmt;
        if (decl?.type === 'FunctionDeclaration') {
          fns.push(decl);
        } else if (decl?.type === 'VariableDeclaration') {
          for (const d of decl.declarations ?? []) {
            if (d?.init?.type === 'ArrowFunctionExpression' || d?.init?.type === 'FunctionExpression') {
              fns.push(d.init);
            }
          }
        }
      }
      return fns;
    }

    function propName(node: any): string | undefined {
      if (!node) return undefined;
      if (node.type === 'Identifier') return node.name;
      if (node.type === 'Literal' && typeof node.value === 'string') return node.value;
      return undefined;
    }

    function isKidMember(node: any): boolean {
      if (node?.type !== 'MemberExpression') return false;
      return propName(node.property) === 'kid';
    }

    function isJwksFetchCallee(node: any): boolean {
      return node?.type === 'Identifier' && /jwks/i.test(node.name);
    }

    function callIndicatesForceRefresh(node: any): boolean {
      for (const arg of node.arguments ?? []) {
        if (arg?.type === 'Literal' && arg.value === true) return true;
        if (arg?.type === 'ObjectExpression') {
          for (const prop of arg.properties ?? []) {
            if (prop?.type !== 'Property') continue;
            const keyName = propName(prop.key);
            if (
              (keyName === 'forceRefresh' || keyName === 'force' || keyName === 'bypassCache') &&
              prop.value?.type === 'Literal' &&
              prop.value.value === true
            ) {
              return true;
            }
          }
        }
      }
      return false;
    }

    function stateFor(node: any): FnState | undefined {
      return fnStates.find((s) => within(s, node));
    }

    return {
      Program(node: any) {
        for (const fn of collectTopLevelFunctions(node)) {
          fnStates.push({
            node: fn,
            start: nodeStartPos(fn),
            end: nodeEndPos(fn),
            findCallNode: null,
            sawKidComparison: false,
            fetchCallCount: 0,
            sawForceRefresh: false,
          });
        }
      },

      CallExpression(node: any) {
        const state = stateFor(node);
        if (!state) return;

        const callee = node.callee;
        if (callee?.type === 'MemberExpression' && callee.property?.name === 'find') {
          if (!state.findCallNode) state.findCallNode = node;
        }

        if (isJwksFetchCallee(callee)) {
          state.fetchCallCount += 1;
          if (callIndicatesForceRefresh(node)) state.sawForceRefresh = true;
        }
      },

      BinaryExpression(node: any) {
        if (node.operator !== '===' && node.operator !== '==') return;
        const state = stateFor(node);
        if (!state) return;
        if (isKidMember(node.left) || isKidMember(node.right)) {
          state.sawKidComparison = true;
        }
      },

      'Program:exit'() {
        for (const state of fnStates) {
          if (!state.findCallNode || !state.sawKidComparison) continue;
          if (state.sawForceRefresh) continue;
          if (state.fetchCallCount >= 2) continue;
          context.report({ node: state.findCallNode, messageId: 'noRefreshOnMiss' });
        }
      },
    };
  },
};

export const auth0JwksRefreshOnUnknownKidRule = rule;
