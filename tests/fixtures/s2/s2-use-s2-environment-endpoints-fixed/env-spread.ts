// Documented env-aware construction: S2Environment.parse() picks up
// S2_ACCOUNT_ENDPOINT / S2_BASIN_ENDPOINT when set.
import { S2, S2Environment } from '@s2-dev/streamstore';

const accessToken = process.env.S2_ACCESS_TOKEN;
if (!accessToken) throw new Error('Set S2_ACCESS_TOKEN');

export const s2 = new S2({ ...S2Environment.parse(), accessToken });
