/**
 * Flags TwiML built as a raw template literal containing `<Response>`/XML
 * tags, instead of the twilio SDK's VoiceResponse builder, which XML-escapes
 * interpolated values automatically (CWE-91, Finding C).
 */
const rule = {
  meta: {
    type: 'suggestion',
    docs: {
      description: 'TwiML responses must be built with the VoiceResponse builder, not raw XML template strings',
      category: 'security',
      cwe: 'CWE-91',
      rationale:
        'The VoiceResponse builder XML-escapes every interpolated value automatically. A raw template literal that interpolates values directly into XML attribute or text positions has no such protection — if either value\'s source ever changes to something attacker-influenced (e.g. a SIP header instead of a Twilio-controlled CallSid), unescaped `<`/`"`/`&` characters can break out of the intended XML structure.',
      docsUrl: 'https://www.twilio.com/docs/voice/twiml/stream',
      recommended: true,
    },
    messages: {
      rawTwimlTemplate:
        'TwiML is built here as a raw template literal with interpolated values instead of the VoiceResponse builder — interpolated values are not XML-escaped, unlike new VoiceResponse().',
    },
  },
  create(context: any) {
    function looksLikeTwimlXml(raw: string): boolean {
      return /<Response>|<Connect>|<Say>|<Stream\b|<Enqueue\b|<Dial\b/.test(raw);
    }

    return {
      TemplateLiteral(node: any) {
        if ((node.expressions ?? []).length === 0) return;
        const raw = (node.quasis ?? []).map((q: any) => q.value?.raw ?? '').join('');
        if (!looksLikeTwimlXml(raw)) return;

        context.report({ node, messageId: 'rawTwimlTemplate' });
      },
    };
  },
};

export const twilioUseTwimlBuilderNotStringTemplatesRule = rule;
