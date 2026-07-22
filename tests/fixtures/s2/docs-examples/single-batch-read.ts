// docs-example-source: https://s2.dev/docs/sdk/reading
// Verbatim single-batch read. Reads from seqNum 0 with a deliberate count
// cap; the advisory capped-read rule fires by design, nudging history reads
// toward a readSession.
// docs-example-expected: s2/single-read-is-capped
import type { S2 } from "@s2-dev/streamstore";

declare const stream: any;

const batch = await stream.read({
	start: { from: { seqNum: 0 } },
	stop: { limits: { count: 100 } },
});

for (const record of batch.records) {
	console.log(`[${record.seqNum}] ${record.body}`);
}

export type { S2 };
