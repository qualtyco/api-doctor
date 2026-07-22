// docs-example-source: https://s2.dev/docs/sdk/metrics
// Verbatim TypeScript metrics samples: start/end are Date objects and
// timeseries sets carry an interval. (The Python tab uses epoch ints —
// that pattern must not be copied into TS.)
import type { S2 } from "@s2-dev/streamstore";

declare const client: S2;
declare const thirtyDaysAgo: Date;
declare const sixHoursAgo: Date;
declare const now: Date;

const accountMetrics = await client.metrics.account({
	set: "active-basins",
	start: thirtyDaysAgo,
	end: now,
});

const basinMetrics = await client.metrics.basin({
	basin: "events",
	set: "storage",
	start: sixHoursAgo,
	end: now,
	interval: "hour",
});

export { accountMetrics, basinMetrics };
