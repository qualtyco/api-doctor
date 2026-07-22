// docs-example-source: https://s2.dev/docs/sdk/languages
// Verbatim "create client" sample (SDK overview). The docs show both this
// minimal form and the env-aware `...S2Environment.parse()` variant; the
// endpoint rule is advisory by design and nudges the minimal form toward
// env-aware endpoints, so it is expected here.
// docs-example-expected: s2/use-s2-environment-endpoints
import { S2 } from "@s2-dev/streamstore";

const client = new S2({
	accessToken: process.env.S2_ACCESS_TOKEN!,
});

const basin = client.basin("my-basin");
const stream = basin.stream("my-stream");

export { basin, stream };
