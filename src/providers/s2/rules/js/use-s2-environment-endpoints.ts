/**
 * s2-use-s2-environment-endpoints (reliability, advisory)
 *
 * Flags `new S2({ accessToken })` constructions that read the token from the
 * environment but ignore endpoint configuration entirely — no
 * `...S2Environment.parse()` spread and no `endpoints` field. Such a client
 * is pinned to the cloud service: S2_ACCOUNT_ENDPOINT/S2_BASIN_ENDPOINT are
 * silently ignored, so s2-lite/self-hosted/local development can't be
 * targeted. Advisory: the minimal form is documented-correct for
 * quickstarts, so this fires as info, never as an error.
 */
import { createS2FileTracker, findProperty, getObjectArg, processEnvVarName, unwrapExpr } from '../../utils.js';

const rule = {
  meta: {
    type: 'suggestion',
    docs: {
      description: 'Spread S2Environment.parse() (or pass endpoints) so endpoint overrides work',
      category: 'reliability',
      rationale:
        'The SDK reads S2_ACCOUNT_ENDPOINT and S2_BASIN_ENDPOINT via S2Environment.parse(); constructing new S2({ accessToken }) without it (or an explicit endpoints field) hard-pins the app to the production cloud endpoints. Code that already reads its token from the environment clearly expects env-based deployment config, so wire endpoints the same way to keep s2-lite and self-hosted targets working.',
      docsUrl: 'https://s2.dev/docs/sdk/endpoints',
      recommended: false,
    },
    messages: {
      ignoresEndpoints:
        'This client reads its token from the environment but ignores endpoint overrides. Use new S2({ ...S2Environment.parse(), accessToken }) or pass endpoints explicitly.',
    },
    schema: [],
  },
  create(context: any) {
    const tracker = createS2FileTracker();
    const envVarByName = new Map<string, string>();
    const candidates: Array<{ node: any; tokenValue: any }> = [];

    return {
      ImportDeclaration(node: any) {
        tracker.visitImport(node);
      },

      VariableDeclarator(node: any) {
        if (node?.id?.type !== 'Identifier' || !node.init) return;
        const envName = processEnvVarName(node.init);
        if (envName) envVarByName.set(node.id.name, envName);
      },

      NewExpression(node: any) {
        tracker.visitNew(node);
        const callee = unwrapExpr(node?.callee);
        if (callee?.type !== 'Identifier') return;
        if (callee.name !== 'S2' && !tracker.localNames('S2').has(callee.name)) return;

        const config = getObjectArg(node, 0);
        if (!config) return;
        // Only the minimal `{ accessToken }` form is flagged: a config that
        // sets anything else (retry, timeouts, endpoints, a spread) is a
        // deliberate configuration per the docs' retry/timeout samples.
        const properties = config.properties ?? [];
        if (properties.length !== 1) return;
        const accessToken = findProperty(config, 'accessToken');
        if (!accessToken) return;
        candidates.push({ node, tokenValue: accessToken.value });
      },

      'Program:exit'() {
        if (!tracker.isS2File()) return;
        for (const { node, tokenValue } of candidates) {
          const value = unwrapExpr(tokenValue);
          const envDerived =
            processEnvVarName(value) !== null ||
            (value?.type === 'Identifier' && envVarByName.has(value.name));
          if (envDerived) {
            context.report({ node, messageId: 'ignoresEndpoints' });
          }
        }
      },
    };
  },
};

export const s2UseS2EnvironmentEndpointsRule = rule;
export default rule;
