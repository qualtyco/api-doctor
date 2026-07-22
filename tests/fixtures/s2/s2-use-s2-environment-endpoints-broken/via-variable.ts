// Same pinning, with the env token passing through a validated const.
import { S2 } from '@s2-dev/streamstore';

const accessToken = process.env.S2_ACCESS_TOKEN;
if (!accessToken) throw new Error('Set S2_ACCESS_TOKEN');

export const s2 = new S2({ accessToken });
