// Stand-in for a framework's generated wrapper module (Convex's
// _generated/server, a router factory, any higher-order registration helper).
// Exports no client — the CLI's binding pass puts `internalAction` on every
// provider's non-client list.
export function internalAction(definition: { handler: (...args: any[]) => any }) {
  return definition;
}
