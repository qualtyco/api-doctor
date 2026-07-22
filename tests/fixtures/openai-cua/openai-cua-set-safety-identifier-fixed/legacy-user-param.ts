// Looks like the broken shape (no `safety_identifier` literal present),
// but it sets the older `user` parameter, which the docs still recognize
// for the same per-end-user attribution purpose.
export async function runTurn(client: any, model: string, input: any[], userId: string) {
  return client.responses.create({
    model,
    input,
    user: userId,
  });
}
