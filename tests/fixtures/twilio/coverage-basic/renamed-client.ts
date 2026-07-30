import { Twilio as RestClient } from 'twilio';

const voice = new RestClient(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);

export async function redirectCall(callSid: string, url: string) {
  // Instance operations pass through the callable accessor — the collector
  // attributes this chain as the accessor's own path, 'calls'.
  return voice.calls(callSid).update({ url, method: 'POST' });
}

export async function startCall(to: string, from: string, twimlUrl: string) {
  return voice.calls.create({ to, from, url: twimlUrl });
}
