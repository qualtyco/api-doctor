// docs-example-source: https://s2.dev/docs/sdk/appending
// Verbatim single-batch append. The `ack.end.seqNum - 1` is the correct
// handling of the exclusive end position — no rule may flag it.
import { AppendInput, AppendRecord } from "@s2-dev/streamstore";

declare const basin: any;
declare const streamName: string;

const stream = basin.stream(streamName);
const ack = await stream.append(
	AppendInput.create([
		AppendRecord.string({ body: "first event" }),
		AppendRecord.string({ body: "second event" }),
	]),
);

// ack tells us where the records landed
console.log(`Wrote records ${ack.start.seqNum} through ${ack.end.seqNum - 1}`);
