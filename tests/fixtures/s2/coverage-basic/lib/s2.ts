import { S2 } from '@s2-dev/streamstore';

const accessToken = process.env.S2_ACCESS_TOKEN;
if (!accessToken) throw new Error('S2_ACCESS_TOKEN is not set');

export const s2 = new S2({ accessToken });
