import { resend } from './lib/resend';

// A bare reference is not a call — emails.cancel must not be recorded.
export const cancelRef = resend.emails.cancel;

// Destructured resources are a documented punt — domains.list must not be recorded.
const { domains } = resend;

export async function listDomains() {
  return domains.list();
}
