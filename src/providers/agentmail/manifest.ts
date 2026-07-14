import type { ProviderManifest } from '../../types.js';

export const agentmailManifest: ProviderManifest = {
  name: 'agentmail',
  displayName: 'AgentMail',
  detect: {
    packages: ['agentmail'],
    imports: ['agentmail'],
    urlPatterns: ['api.agentmail.to'],
  },
  oxlintRules: [
    {
      key: 'agentmail-verify-approval-reply-sender',
      resultRule: 'agentmail/verify-approval-reply-sender',
      message:
        'Approval/decline is parsed from an email reply without verifying who sent it — any thread participant (including the requester) can approve their own request.',
      fix: 'Before parsing a decision, check the message from address equals the authorized approver and that message.labels does not include "unauthenticated".',
      docsUrl: 'https://docs.agentmail.to/knowledge-base/human-in-the-loop',
      severity: 'warning',
    },
    {
      key: 'agentmail-inbox-create-client-id',
      resultRule: 'agentmail/inbox-create-client-id',
      message:
        'inboxes.create without clientId creates a brand-new inbox on every fresh run — the agent address changes and the plan inbox cap fills up.',
      fix: 'Pass a deterministic clientId (e.g. "support-inbox-v1") so retries and redeploys return the same inbox.',
      docsUrl: 'https://docs.agentmail.to/idempotency',
      severity: 'error',
    },
    {
      key: 'agentmail-handle-send-failure-status',
      resultRule: 'agentmail/handle-send-failure-status',
      message:
        'Send failures are blanket-caught: permanent errors (403 suppressed recipient) get retried forever, often with an LLM call per attempt.',
      fix: 'Inspect error.statusCode in the catch — on 403, transition the recipient out of the send queue; only leave transient errors for retry.',
      docsUrl: 'https://docs.agentmail.to/knowledge-base/api-403-error',
      severity: 'error',
    },
    {
      key: 'agentmail-check-unauthenticated-label',
      resultRule: 'agentmail/check-unauthenticated-label',
      message:
        'Sender-based authorization trusts the from address alone — mail with missing auth headers is delivered (labeled "unauthenticated") and spoofs this check.',
      fix: 'Require both: from address equals the authorized sender AND message.labels does not include "unauthenticated".',
      docsUrl: 'https://docs.agentmail.to/knowledge-base/inbound-emails-missing',
      severity: 'warning',
    },
    {
      key: 'agentmail-configure-recipient-guardrails',
      resultRule: 'agentmail/configure-recipient-guardrails',
      message:
        'This long-running agent auto-replies to any sender with no Lists guardrails — mail-loop and abuse exposure.',
      fix: 'Create hard platform boundaries: a receive-allowlist (client.inboxes.lists.create) for who can trigger the agent, and a send-allowlist (client.lists.create) for who it may email.',
      docsUrl: 'https://docs.agentmail.to/knowledge-base/allowlists-blocklists',
      severity: 'warning',
    },
    {
      key: 'agentmail-draft-create-client-id',
      resultRule: 'agentmail/draft-create-client-id',
      message:
        'drafts.create without clientId produces duplicate drafts when a crash lands between the create and the state update recording it.',
      fix: 'Pass a deterministic clientId derived from the triggering message (clientId cannot contain "@").',
      docsUrl: 'https://docs.agentmail.to/knowledge-base/preventing-duplicate-sends',
      severity: 'warning',
    },
    {
      key: 'agentmail-html-fallback-for-inbound-body',
      resultRule: 'agentmail/html-fallback-for-inbound-body',
      message:
        'Inbound body is built from text/extractedText only — HTML-only mail (common for Gmail/Outlook forwards) arrives with no text part and reads as empty.',
      fix: 'Fall back to converting message.html when text is absent, e.g. (m.extractedText ?? m.text)?.trim() || htmlToText(m.html ?? "").',
      docsUrl: 'https://docs.agentmail.to/messages',
      severity: 'warning',
    },
    {
      key: 'agentmail-throttle-bulk-sends',
      resultRule: 'agentmail/throttle-bulk-sends',
      message:
        'messages.send runs back-to-back inside a loop — the whole list bursts from one address as fast as the API accepts (429s, plan-volume burn, deliverability damage).',
      fix: 'Space bulk sends with a per-send delay or a queue with a daily budget; distribute real campaigns across inboxes.',
      docsUrl: 'https://docs.agentmail.to/knowledge-base/rate-limits',
      severity: 'warning',
    },
    {
      key: 'agentmail-label-failed-messages',
      resultRule: 'agentmail/label-failed-messages',
      message:
        'Failed message processing is swallowed without a label transition — the message stays "unread" and every poll retries it forever.',
      fix: 'On failure, move the message out of the poll set: messages.update(inboxId, messageId, { removeLabels: ["unread"], addLabels: ["processing-failed"] }).',
      docsUrl: 'https://docs.agentmail.to/knowledge-base/labels-track-state',
      severity: 'warning',
    },
    {
      key: 'agentmail-custom-domain-for-outreach',
      resultRule: 'agentmail/custom-domain-for-outreach',
      message:
        'Bulk outreach sends from the shared @agentmail.to domain — reputation is shared across all users and fresh-inbox bursts are a top spam-foldering cause.',
      fix: 'Create the outreach inbox on a verified custom subdomain (agents.yourcompany.com avoids MX conflicts) and warm it up gradually.',
      docsUrl: 'https://docs.agentmail.to/knowledge-base/emails-going-to-spam',
      severity: 'warning',
    },
    {
      key: 'agentmail-no-message-id-as-thread-id',
      resultRule: 'agentmail/no-message-id-as-thread-id',
      message:
        'threadId ?? messageId stores a message ID where a thread ID belongs — reply routing by thread will never match it and the conversation is dropped.',
      fix: 'Throw when send returns no threadId instead of substituting an identifier of a different type.',
      docsUrl: 'https://docs.agentmail.to/api-reference/inboxes/messages/send',
      severity: 'info',
    },
    {
      key: 'agentmail-prefer-webhooks-in-production',
      resultRule: 'agentmail/prefer-webhooks-in-production',
      message:
        'Long-running agent polls messages.list in a forever loop — webhooks are the recommended production mechanism (WebSockets when no public URL).',
      fix: 'Register a webhook (client.webhooks.create with the events you need), verify signatures with Svix, return 2xx immediately, process in the background.',
      docsUrl: 'https://docs.agentmail.to/knowledge-base/handling-inbound-emails',
      severity: 'info',
    },
    {
      key: 'agentmail-attachment-size-guard',
      resultRule: 'agentmail/attachment-size-guard',
      message:
        'Attachment content comes from a file/network read with no size check — AgentMail handlers cap inline base64 content at 6 MB.',
      fix: 'Check the payload size before attaching (raw bytes over ~4.5 MB exceed 6 MB once base64-encoded) and use the url attachment field (up to 30 MB) for larger files.',
      docsUrl: 'https://docs.agentmail.to/attachments',
      severity: 'warning',
    },
    {
      key: 'agentmail-html-requires-text',
      resultRule: 'agentmail/html-requires-text',
      message:
        'Email sent with an html body but no text part — text-only clients see nothing and spam filters penalize the missing text/plain part.',
      fix: 'Always provide a text version alongside html, generated from the same content.',
      docsUrl: 'https://docs.agentmail.to/knowledge-base/emails-going-to-spam',
      severity: 'info',
    },
  ],
};
