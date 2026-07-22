// Basin variant: tenant provisioning route that throws 409 for any tenant
// that already has a basin.
import { S2, S2Environment } from '@s2-dev/streamstore';

const s2 = new S2({ ...S2Environment.parse(), accessToken: process.env.S2_ACCESS_TOKEN! });

export async function POST(request: Request) {
  const { tenant } = await request.json();

  const basin = await s2.basins.create({ basin: `tenant-${tenant}` });

  return Response.json({ basin: basin.name });
}
