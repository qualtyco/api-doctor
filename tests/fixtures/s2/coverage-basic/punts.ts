import { s2 } from '@/lib/s2';

// Reference, not a call — must not count.
export const listBasinsOp = s2.basins.list;

// Destructured resource — documented punt, must not count.
const { accessTokens } = s2;
export async function listTokens() {
  return accessTokens.list();
}

// Wrong-root object with a colliding shape — must never count.
const fake = { basins: { list: async () => [] as unknown[] } };
export async function fakeList() {
  return fake.basins.list();
}
