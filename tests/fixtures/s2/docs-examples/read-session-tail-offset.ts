// docs-example-source: https://s2.dev/docs/sdk/reading
// Verbatim "starting from a tail offset" read session. The docs snippet
// omits clamp: true (every *runnable* official example adds it), so the
// advisory clamp rule fires here by design.
// docs-example-expected: s2/tail-offset-clamp
import type { S2 } from "@s2-dev/streamstore";

declare const stream: any;

// Start reading from 10 records before the current tail
const session = await stream.readSession({
	start: { from: { tailOffset: 10 } },
});

for await (const record of session) {
	console.log(`[${record.seqNum}] ${record.body}`);
}

export type { S2 };
