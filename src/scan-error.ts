/** Thrown on tool-level failures (unreadable directory, oxlint crash). Maps to exit 2. */
export class ScanError extends Error {
  constructor(message: string, readonly cause?: unknown) {
    super(message);
    this.name = 'ScanError';
  }
}
