import {
  collectOpenAIRealtimeUrlVarNames,
  collectStringVarValues,
  isOpenAIRealtimeNewWebSocket,
  resolveStringValue,
} from '../utils.js';

const DATED_PREVIEW_MODEL_PATTERN = /model=[^&'"`]*-preview-\d{4}-\d{2}-\d{2}/;

const rule = {
  meta: {
    type: 'suggestion',
    docs: {
      description: 'OpenAI Realtime connections should not pin to a dated preview model snapshot',
      category: 'correctness',
      docsUrl: 'https://developers.openai.com/api/docs/api-reference/realtime-sessions',
      rationale:
        "Dated preview snapshots are the category of model id OpenAI has historically retired with advance-notice sunset windows. Pinning to a dated preview snapshot rather than the floating GA alias (or a current dated GA snapshot) maximizes exposure to an eventual retirement, with no code path to detect or gracefully react to a model_not_found-style error if/when that happens.",
      recommended: true,
    },
    messages: {
      datedPreviewSnapshot:
        'This Realtime connection is pinned to a dated preview model snapshot instead of the GA alias.',
    },
    schema: [],
  },
  create(context: any) {
    let stringVarValues = new Map<string, string>();
    let urlVarNames = new Set<string>();

    return {
      Program(node: any) {
        stringVarValues = collectStringVarValues(node);
        urlVarNames = collectOpenAIRealtimeUrlVarNames(node);
      },

      NewExpression(node: any) {
        if (!isOpenAIRealtimeNewWebSocket(node, urlVarNames)) return;

        const urlArg = node.arguments?.[0];
        const urlString = resolveStringValue(urlArg, stringVarValues);
        if (!urlString) return;

        if (DATED_PREVIEW_MODEL_PATTERN.test(urlString)) {
          context.report({ node: urlArg, messageId: 'datedPreviewSnapshot' });
        }
      },
    };
  },
};

export const openaiRealtimeAvoidDatedPreviewSnapshotsRule = rule;
