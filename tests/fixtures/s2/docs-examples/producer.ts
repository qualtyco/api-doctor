// docs-example-source: https://s2.dev/docs/sdk/appending
// Verbatim Producer sample. A Producer makes appendRetryPolicy "all" safe
// because it maintains matchSeqNum — retry rules must treat Producer/session
// writers differently from unary append.
import { AppendRecord, BatchTransform, Producer } from "@s2-dev/streamstore";

declare const stream: any;

const producer = new Producer(
	new BatchTransform({ lingerDurationMillis: 5 }),
	await stream.appendSession(),
);

const ticket = await producer.submit(
	AppendRecord.string({ body: "my event" }),
);

const ack = await ticket.ack();
console.log(`Record durable at seqNum ${ack.seqNum()}`);

await producer.close();
