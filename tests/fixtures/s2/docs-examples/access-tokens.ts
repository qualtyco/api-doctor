// docs-example-source: https://s2.dev/docs/sdk/access-tokens
// Verbatim access-token lifecycle: list (metadata), issue a scoped +
// expiring token, revoke by id. Note `basins: { prefix: "" }` is
// documented-correct here because streams and opGroups narrow the scope —
// a least-privilege rule must not flag it.
import type { S2 } from "@s2-dev/streamstore";

declare const client: S2;

const tokens = await client.accessTokens.list();

const { accessToken: issuedToken } = await client.accessTokens.issue({
	id: "user-1234-rw-token",
	scope: {
		basins: { prefix: "" }, // all basins
		streams: { prefix: "users/1234/" },
		opGroups: { stream: { read: true, write: true } },
	},
	expiresAt: new Date("2027-01-01"),
});

await client.accessTokens.revoke({ id: "user-1234-rw-token" });

export { tokens, issuedToken };
