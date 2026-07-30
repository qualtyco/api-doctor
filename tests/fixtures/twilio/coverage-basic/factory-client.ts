// The documented default-export pattern: the default export is itself the
// client factory (`twilio(sid, token)` returns a Twilio client).
import twilio from 'twilio';

const client = twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);

export async function enqueueTask(workspaceSid: string, attributes: Record<string, unknown>) {
  // Everything past the workspace sid call is unattributable — this chain is
  // recorded as 'taskrouter.v1.workspaces'.
  return client.taskrouter.v1.workspaces(workspaceSid).tasks.create({
    attributes: JSON.stringify(attributes),
    workflowSid: process.env.TWILIO_WORKFLOW_SID,
  });
}

export async function dailyUsage() {
  return client.usage.records.daily.list({ limit: 30 });
}

export async function lookupNumber(phone: string) {
  // lookups is outside the surface scope — must count as unknown, never used.
  return client.lookups.v2.phoneNumbers(phone).fetch();
}
