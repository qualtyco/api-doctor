// Documented pattern: read the token from the environment and fail fast.
import { S2, S2Environment } from '@s2-dev/streamstore';

const accessToken = process.env.S2_ACCESS_TOKEN;
if (!accessToken) throw new Error('Set S2_ACCESS_TOKEN');

export const s2 = new S2({ ...S2Environment.parse(), accessToken });
