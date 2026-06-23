/**
 * Flags a try/catch around a `fetch()` to a known LLM provider host whose
 * catch block has no logging call — any failure (bad key, rate limit,
 * network error) becomes indistinguishable from "no key configured."
 */
import { containsKnownLlmHost } from '../utils.js';

const LOGGING_CONSOLE_METHODS = new Set(['error', 'warn', 'log', 'info']);

const rule = {
  meta: {
    type: 'suggestion',
    docs: {
      description: 'A catch block around an LLM provider call must log the failure',
      category: 'correctness',
      rationale:
        'Returning null/undefined from a bare catch with no logging makes every failure mode — missing key, expired key, rate limit, malformed response, network error — look identical to "no key configured." If a deployment\'s provider key starts failing in production, this is invisible: there is nothing in the browser or error-tracking logs to distinguish a real outage from an intentionally-unconfigured feature.',
      docsUrl: 'https://docs.lovable.dev/features/cloud',
      recommended: true,
    },
    messages: {
      silentCatch:
        'This catch block swallows a failed LLM provider call with no logging — a real failure (expired key, rate limit, network error) is indistinguishable from "no key configured."',
    },
  },
  create(context: any) {
    function findFetchToLlmHost(node: any, depth = 0): any {
      if (!node || typeof node !== 'object' || depth > 12) return null;
      if (Array.isArray(node)) {
        for (const n of node) {
          const found = findFetchToLlmHost(n, depth + 1);
          if (found) return found;
        }
        return null;
      }
      if (node.type === 'CallExpression' && node.callee?.type === 'Identifier' && node.callee.name === 'fetch') {
        const urlArg = node.arguments?.[0];
        if (containsKnownLlmHost(urlArg)) return node;
      }
      for (const key of Object.keys(node)) {
        if (key === 'parent' || key === 'loc' || key === 'range') continue;
        const val = (node as any)[key];
        if (val && typeof val === 'object') {
          const found = findFetchToLlmHost(val, depth + 1);
          if (found) return found;
        }
      }
      return null;
    }

    function containsLoggingCall(node: any, depth = 0): boolean {
      if (!node || typeof node !== 'object' || depth > 12) return false;
      if (Array.isArray(node)) return node.some((n) => containsLoggingCall(n, depth + 1));
      if (node.type === 'CallExpression') {
        const callee = node.callee;
        if (callee?.type === 'MemberExpression') {
          const objName = callee.object?.type === 'Identifier' ? callee.object.name : undefined;
          const propertyName = callee.property?.name;
          if (objName === 'console' && LOGGING_CONSOLE_METHODS.has(propertyName)) return true;
          if (propertyName === 'captureException') return true;
        }
        if (callee?.type === 'Identifier' && callee.name === 'reportError') return true;
      }
      for (const key of Object.keys(node)) {
        if (key === 'parent' || key === 'loc' || key === 'range') continue;
        const val = (node as any)[key];
        if (val && typeof val === 'object') {
          if (containsLoggingCall(val, depth + 1)) return true;
        }
      }
      return false;
    }

    return {
      TryStatement(node: any) {
        const fetchNode = findFetchToLlmHost(node.block);
        if (!fetchNode) return;

        const handler = node.handler;
        if (!handler) return;

        if (!containsLoggingCall(handler.body)) {
          context.report({ node: handler, messageId: 'silentCatch' });
        }
      },
    };
  },
};

export const lovableSilentCatchOnProviderCallRule = rule;
