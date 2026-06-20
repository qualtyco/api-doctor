/**
 * Minimal terminal animation primitives: a frame-based spinner and a small
 * per-line reveal delay. Both are no-ops unless stdout is an interactive TTY
 * (and `CI` is unset), so piped output, --format/--quiet modes, and tests
 * are never affected — only a human watching a real terminal sees them.
 */

const SPINNER_FRAMES = ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏'];
const SPINNER_INTERVAL_MS = 80;
/** Pause between major reveals: a detected provider, a finding group, the header. */
const GROUP_DELAY_MS = 220;
/** Pause between minor sub-lines within a reveal: a header line, a file location. */
const LINE_DELAY_MS = 45;

export function isAnimated(): boolean {
  return Boolean(process.stdout.isTTY) && !process.env.CI;
}

export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** Pause between revealed groups (providers, finding groups); instant when not animated. */
export async function revealDelay(): Promise<void> {
  if (!isAnimated()) return;
  await sleep(GROUP_DELAY_MS);
}

/** Shorter pause between sub-lines inside a reveal; instant when not animated. */
export async function lineDelay(): Promise<void> {
  if (!isAnimated()) return;
  await sleep(LINE_DELAY_MS);
}

export interface Spinner {
  stop(): void;
}

/** Animated braille spinner on stderr; a no-op when output isn't an interactive TTY. */
export function createSpinner(label: string): Spinner {
  if (!isAnimated()) {
    return { stop() {} };
  }

  let frame = 0;
  const render = (): void => {
    process.stderr.write(`\r${SPINNER_FRAMES[frame % SPINNER_FRAMES.length]} ${label}`);
    frame += 1;
  };
  render();
  const timer = setInterval(render, SPINNER_INTERVAL_MS);

  return {
    stop(): void {
      clearInterval(timer);
      process.stderr.write(`\r${' '.repeat(label.length + 2)}\r`);
    },
  };
}
