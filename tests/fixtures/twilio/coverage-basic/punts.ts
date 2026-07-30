import { twilioClient } from './lib/twilio';

// A bare reference is not a call — messages.create must not be recorded.
export const sendRef = twilioClient.messages.create;

// Destructured resources are a documented punt — messages.list must not be recorded.
const { messages } = twilioClient;

export async function listDestructured() {
  return messages.list();
}

// Right shape, wrong root — a plain object's messages.create must not be recorded.
const offlineSms = { messages: { create: () => ({ sid: 'SM000' }) } };

export function sendOffline() {
  return offlineSms.messages.create();
}

// Known collector gap, documented: a factory call directly on require() is not
// traced to the SDK — nothing from this client is recorded, not even unknown.
const legacy = require('twilio')(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);

export function legacyList() {
  return legacy.messages.list();
}
