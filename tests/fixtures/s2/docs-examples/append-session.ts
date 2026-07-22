// docs-example-source: https://s2.dev/docs/sdk/appending
// Verbatim append session sample: submit returns a ticket, ack() is
// durability, close() flushes.
import { AppendInput, AppendRecord } from "@s2-dev/streamstore";

declare const stream: any;

const session = await stream.appendSession();

const ticket = await session.submit(
	AppendInput.create([
		AppendRecord.string({ body: "event-1" }),
		AppendRecord.string({ body: "event-2" }),
	]),
);

const ack = await ticket.ack();
console.log(`Durable at seqNum ${ack.start.seqNum}`);

await session.close();
