import { management } from './lib/auth0';

// A bare reference is not a call — users.delete must not be recorded.
export const deleteRef = management.users.delete;

// Destructured resources are a documented punt — roles.list must not be
// recorded (and must not count as an unknown SDK call either).
const { roles } = management;

export async function listRoles() {
  return roles.list();
}

// Right call shape, wrong root — a local object is never a verified client.
const db = { users: { get: async (_id: string) => ({}) } };

export async function localLookup(id: string) {
  return db.users.get(id);
}
