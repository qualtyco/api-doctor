// docs-example-source: https://s2.dev/docs/sdk/retries-timeouts
// Verbatim retry + timeout configuration samples (TypeScript tabs), with the
// env-derived accessToken the official runnable file uses. Note:
// `appendRetryPolicy` is absent (defaults to "all") — no rule may flag a
// config block merely for omitting it, and a deliberate retry/timeout config
// must not trip the endpoints advisory either.
import { S2 } from "@s2-dev/streamstore";

const accessToken = process.env.S2_ACCESS_TOKEN!;

const client = new S2({
	accessToken: accessToken,
	connectionTimeoutMillis: 5000,
	requestTimeoutMillis: 10000,
});

const client2 = new S2({
	accessToken: accessToken,
	retry: {
		maxAttempts: 5,
		minBaseDelayMillis: 100,
		maxBaseDelayMillis: 2000,
	},
});

export { client, client2 };
