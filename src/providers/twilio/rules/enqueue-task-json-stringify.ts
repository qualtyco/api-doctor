/**
 * Flags `.task(...)` (TaskRouter Enqueue attributes) built by hand-interpolating
 * a request field into a template-literal/string JSON instead of using
 * JSON.stringify() (CWE-116/CWE-91, Finding B).
 */
const rule = {
  meta: {
    type: 'problem',
    docs: {
      description: 'TaskRouter .task() attributes must be built with JSON.stringify(), not raw string interpolation',
      category: 'security',
      cwe: 'CWE-116',
      owasp: 'CWE-91 XML/JSON Injection',
      rationale:
        'Hand-building the Task attributes JSON by interpolating an unvalidated request field directly into a string literal breaks the moment that field contains a `"` or `\\`. The resulting body is invalid JSON, and Twilio rejects the Enqueue with error 14221 ("Provided Attributes JSON was not valid") — turning a single unexpected character in a caller-controlled field (like a name with a quote in it) into a hard failure of the call flow.',
      docsUrl: 'https://www.twilio.com/docs/api/errors/14221',
      recommended: true,
    },
    messages: {
      rawJsonInterpolation:
        'This .task() call builds JSON attributes via raw string interpolation instead of JSON.stringify() — a "/\\\\ character in the interpolated value produces invalid JSON and Twilio error 14221.',
    },
  },
  create(context: any) {
    function isTaskCall(n: any): boolean {
      if (n?.type !== 'CallExpression') return false;
      const callee = n.callee;
      if (callee?.type !== 'MemberExpression') return false;
      return callee.property?.type === 'Identifier' && callee.property.name === 'task';
    }

    function hasInterpolatedExpression(templateLiteral: any): boolean {
      return (templateLiteral.expressions ?? []).length > 0;
    }

    return {
      CallExpression(node: any) {
        if (!isTaskCall(node)) return;
        const arg = node.arguments?.[0];
        if (!arg) return;

        if (arg.type === 'TemplateLiteral' && hasInterpolatedExpression(arg)) {
          context.report({ node, messageId: 'rawJsonInterpolation' });
          return;
        }

        // `'{ "name": "' + req.body.Caller + '", ... }'` concatenation form.
        if (arg.type === 'BinaryExpression' && arg.operator === '+') {
          context.report({ node, messageId: 'rawJsonInterpolation' });
        }
      },
    };
  },
};

export const twilioEnqueueTaskJsonStringifyRule = rule;
