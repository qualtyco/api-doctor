/**
 * Best-effort heuristic: flags a Media Streams `.send()`/socket.send() call
 * site that forwards `media` payloads but never passes `isLast`/a mark
 * argument anywhere in the same file (Finding H). Conservative by design —
 * the audit notes this is "mostly non-rule" and prone to false positives,
 * so this only fires when there is unambiguously zero mark-pacing signal
 * in the whole file.
 */
import { findInSubtree } from '../utils.js';

const rule = {
  meta: {
    type: 'suggestion',
    docs: {
      description: 'Media Streams audio forwarding should use mark-based pacing to avoid buffer overflow',
      category: 'reliability',
      rationale:
        'Twilio buffers at most 10 minutes of audio per bidirectional Stream. If audio chunks are forwarded with no mark events and no pacing, and the sender produces media faster than real-time (or playback stalls), Twilio stops accepting further audio for that Stream and emits warning 31931 ("Media Discarded") — silently dropping audio rather than erroring loudly.',
      docsUrl: 'https://www.twilio.com/docs/api/errors/31931',
      recommended: true,
    },
    messages: {
      noMarkPacing:
        'This file forwards media payloads via send() but never passes isLast/a mark argument anywhere — sustained high-throughput forwarding risks Twilio silently discarding buffered audio (warning 31931).',
    },
  },
  create(context: any) {
    function isMediaSendCall(n: any): boolean {
      if (n?.type !== 'CallExpression') return false;
      const callee = n.callee;
      if (callee?.type !== 'MemberExpression') return false;
      if (callee.property?.type !== 'Identifier' || callee.property.name !== 'send') return false;
      // Must be sending something that looks like media/delta payloads.
      const arg = n.arguments?.[0];
      const argText =
        (arg?.type === 'ArrayExpression' &&
          (arg.elements ?? []).some(
            (el: any) => el?.type === 'MemberExpression' && el.property?.type === 'Identifier' && el.property.name === 'delta',
          )) ||
        (arg?.type === 'Identifier' && /delta|payload|media/i.test(arg.name));
      return !!argText;
    }

    function hasIsLastOrMarkSignal(program: any): boolean {
      let found = false;
      function walk(n: any, depth = 0): void {
        if (found || !n || typeof n !== 'object' || depth > 60) return;
        if (Array.isArray(n)) {
          for (const item of n) walk(item, depth + 1);
          return;
        }
        // Skip TS type-only constructs (e.g. `isLast?: boolean` in a type
        // signature is not an actual pacing call site).
        if (typeof n.type === 'string' && n.type.startsWith('TS')) return;

        if (n.type === 'CallExpression') {
          const callee = n.callee;
          if (callee?.type === 'MemberExpression' && callee.property?.type === 'Identifier' && callee.property.name === 'send') {
            const second = n.arguments?.[1];
            if (second?.type === 'Literal' && second.value === true) {
              found = true;
              return;
            }
            if (second?.type === 'Identifier' && /isLast/i.test(second.name)) {
              found = true;
              return;
            }
          }
        }
        // explicit `isLast` value-position identifier (param default, destructure, variable)
        if (n.type === 'Identifier' && n.name === 'isLast') {
          found = true;
          return;
        }

        for (const key of Object.keys(n)) {
          if (key === 'parent' || key === 'loc' || key === 'range' || key === 'typeAnnotation' || key === 'returnType') continue;
          const val = n[key];
          if (val && typeof val === 'object') walk(val, depth + 1);
        }
      }
      walk(program);
      return found;
    }

    return {
      'Program:exit'(program: any) {
        const sendCalls: any[] = [];
        findInSubtree(program, (n) => {
          if (isMediaSendCall(n)) sendCalls.push(n);
          return false;
        });
        if (sendCalls.length === 0) return;
        if (hasIsLastOrMarkSignal(program)) return;

        // Report once per file at the first offending call site to keep
        // this conservative, per the audit's "mostly non-rule" guidance.
        context.report({ node: sendCalls[0], messageId: 'noMarkPacing' });
      },
    };
  },
};

export const twilioMediaStreamsMarkPacingRule = rule;
