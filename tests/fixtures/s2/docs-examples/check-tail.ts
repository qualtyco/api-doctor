// docs-example-source: https://s2.dev/docs/sdk/reading
// Verbatim check-tail sample: tail.seqNum is the record count (the
// exclusive end position).
import type { S2 } from "@s2-dev/streamstore";

declare const stream: any;

const { tail } = await stream.checkTail();
console.log(`Stream has ${tail.seqNum} records`);

export type { S2 };
