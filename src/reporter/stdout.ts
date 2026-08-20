/**
 * Writing to stdout in a process that calls `process.exit()`.
 *
 * When stdout is a pipe — which is every `--format json | jq`, every CI step,
 * every `> report.json` — Node's writes are asynchronous, and `process.exit()`
 * discards whatever is still buffered. A report under the pipe buffer survives
 * by luck; a larger one is cut off mid-token.
 *
 * This was not hypothetical: `--format json` on a real project emitted exactly
 * 65536 bytes of a much longer document and exited 0. Truncated JSON with a
 * success status is the worst possible failure for a machine-readable mode —
 * the consumer sees a clean exit and a parse error, and the tool looks like it
 * produced garbage rather than like it lost the tail.
 *
 * So every large stdout write goes through here and is awaited. The callback
 * form of `write` fires once that chunk has been handed to the OS, which is the
 * point after which `process.exit()` is safe.
 */
export function writeStdout(text: string): Promise<void> {
  return new Promise((resolve, reject) => {
    process.stdout.write(text, (err) => (err ? reject(err) : resolve()));
  });
}
