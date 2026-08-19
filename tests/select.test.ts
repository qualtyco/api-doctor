/**
 * Drives the arrow-key menu against a fake TTY: a PassThrough standing in for
 * stdin, and a sink for stdout. Keys go in as the byte sequences a real
 * terminal sends, so the parsing is exercised rather than mocked away.
 */
import { PassThrough } from 'node:stream';
import { afterEach, describe, expect, it } from 'vitest';
import { canPrompt, selectFromList } from '../src/select.js';

const ITEMS = [
  { value: 'claude', label: 'Claude Code' },
  { value: 'cursor', label: 'Cursor', hint: 'not installed' },
  { value: 'codex', label: 'Codex' },
  { value: 'skip', label: 'Skip for now' },
];

const realStdin = process.stdin;
const realStdout = process.stdout;

interface Harness {
  press(sequence: string): void;
  output(): string;
}

function withFakeTty(isTty = true): Harness {
  const stdin = new PassThrough() as PassThrough & { isRaw?: boolean; setRawMode?: unknown };
  Object.assign(stdin, { isTTY: isTty, isRaw: false, setRawMode: () => stdin });

  let written = '';
  const stdout = new PassThrough();
  stdout.on('data', (chunk) => {
    written += String(chunk);
  });
  Object.assign(stdout, { isTTY: isTty });

  Object.defineProperty(process, 'stdin', { value: stdin, configurable: true });
  Object.defineProperty(process, 'stdout', { value: stdout, configurable: true });

  return {
    press: (sequence: string) => stdin.write(sequence),
    output: () => written,
  };
}

afterEach(() => {
  Object.defineProperty(process, 'stdin', { value: realStdin, configurable: true });
  Object.defineProperty(process, 'stdout', { value: realStdout, configurable: true });
});

/** Lets the menu attach its keypress listener before any key is sent. */
function nextTick(): Promise<void> {
  return new Promise((resolve) => setImmediate(resolve));
}

describe('selectFromList', () => {
  it('returns the highlighted row on enter', async () => {
    const tty = withFakeTty();
    const choice = selectFromList({ title: 'Open them in:', items: ITEMS });

    await nextTick();
    tty.press('\r');

    expect(await choice).toBe('claude');
  });

  it('moves with the arrow keys', async () => {
    const tty = withFakeTty();
    const choice = selectFromList({ title: 'Open them in:', items: ITEMS });

    await nextTick();
    tty.press('\x1b[B'); // down
    tty.press('\x1b[B');
    tty.press('\x1b[A'); // up
    tty.press('\r');

    expect(await choice).toBe('cursor');
  });

  it('wraps around the ends of the list', async () => {
    const tty = withFakeTty();
    const choice = selectFromList({ title: 'Open them in:', items: ITEMS });

    await nextTick();
    tty.press('\x1b[A'); // up from the first row
    tty.press('\r');

    expect(await choice).toBe('skip');
  });

  it('opens on the requested row', async () => {
    const tty = withFakeTty();
    const choice = selectFromList({ title: 'Open them in:', items: ITEMS, initialIndex: 2 });

    await nextTick();
    tty.press('\r');

    expect(await choice).toBe('codex');
  });

  it('takes a number key as a direct pick', async () => {
    const tty = withFakeTty();
    const choice = selectFromList({ title: 'Open them in:', items: ITEMS });

    await nextTick();
    tty.press('3');

    expect(await choice).toBe('codex');
  });

  it('cancels on escape', async () => {
    const tty = withFakeTty();
    const choice = selectFromList({ title: 'Open them in:', items: ITEMS });

    await nextTick();
    tty.press('\x1b');

    expect(await choice).toBeUndefined();
  });

  it('cancels on ctrl-c rather than leaving the user stuck', async () => {
    const tty = withFakeTty();
    const choice = selectFromList({ title: 'Open them in:', items: ITEMS });

    await nextTick();
    tty.press('\x03');

    expect(await choice).toBeUndefined();
  });

  it('renders every label, the hints, and restores the cursor', async () => {
    const tty = withFakeTty();
    const choice = selectFromList({ title: 'Open them in:', items: ITEMS });

    await nextTick();
    tty.press('\r');
    await choice;

    const out = tty.output();
    for (const item of ITEMS) expect(out).toContain(item.label);
    expect(out).toContain('not installed');
    expect(out).toContain('enter to select');
    expect(out).toContain('\x1b[?25h'); // cursor shown again
  });

  it('never prompts without a terminal — a piped run would hang forever', async () => {
    withFakeTty(false);

    expect(canPrompt()).toBe(false);
    expect(await selectFromList({ title: 'Open them in:', items: ITEMS })).toBeUndefined();
  });

  it('returns undefined for an empty list', async () => {
    withFakeTty();

    expect(await selectFromList({ title: 'Open them in:', items: [] })).toBeUndefined();
  });
});
