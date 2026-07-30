import axios from 'axios';
import { WorkspaceUser } from '../models/workspace-user';

// /userinfo fallback feeds the same unverified-email sink: the email it
// returns is used to find and re-point an existing WorkspaceUser, with no
// email_verified check anywhere in this function.
export async function linkWorkspaceUserFromUserinfo(domain: string, token: string, sub: string) {
  const resp = await axios.get(`https://${domain}/userinfo`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const profile = resp.data;

  const existing = await WorkspaceUser.findFirst({
    email: profile.email,
  });

  if (existing) {
    existing.authSub = sub;
    await existing.save();
  }

  return existing;
}

export const linkFromDefaultTenant = (token: string, sub: string) =>
  linkWorkspaceUserFromUserinfo('qualty.us.auth0.com', token, sub);
