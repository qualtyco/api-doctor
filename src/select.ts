/**
 * A single-choice arrow-key menu for the terminal.
 *
 * Deliberately tiny and dependency-free: it renders a list, moves a cursor with
 * the arrow keys (or j/k, or a number), and returns on Enter. Escape and Ctrl-C
 * cancel, and cancelling is always a real outcome — every caller here is about
 * to start something the user should be able to back out of.
 *
 * Never prompts unless both stdin and stdout are TTYs, so piped and CI runs
 * cannot block waiting for a keypress that will never come.
 */
import pc from 'picocolors';

export interface SelectItem {
  /** Returned to the caller when this row is chosen. */
  value: string;
  label: string;
  /** Dimmed suffix — availability, a shortcut, whatever the row needs. */
  hint?: string;
}

export interface SelectOptions {
  title: string;
  items: SelectItem[];
  /** Row highlighted when the menu opens. */
  initialIndex?: number;
}

const HIDE_CURSOR = '\x1b[?25l';
const SHOW_CURSOR = '\x1b[?25h';
const CLEAR_LINE = '\x1b[2K';

export function canPrompt(): boolean {
  return Boolean(process.stdin.isTTY && process.stdout.isTTY);
}

/**
 * Renders the menu and resolves with the chosen value, or undefined if the user
 * cancelled or there is no terminal to ask on.
 */
export async function selectFromList(options: SelectOptions): Promise<string | undefined> {
  const { title, items } = options;
  if (items.length === 0 || !canPrompt()) return undefined;

  const { emitKeypressEvents } = await import('node:readline');
  const stdin = process.stdin;
  const stdout = process.stdout;

  let index = Math.min(Math.max(options.initialIndex ?? 0, 0), items.length - 1);
  let rendered = 0;

  const draw = (): void => {
    // Redraw in place: rewind over the rows written last time, never the title.
    if (rendered > 0) stdout.write(`\x1b[${rendered}A`);
    for (const [i, item] of items.entries()) {
      const selected = i === index;
      const pointer = selected ? pc.cyan('❯') : ' ';
      const label = selected ? pc.cyan(pc.bold(item.label)) : item.label;
      const hint = item.hint ? ` ${pc.dim(item.hint)}` : '';
      stdout.write(`${CLEAR_LINE}${pointer} ${label}${hint}\n`);
    }
    rendered = items.length;
  };

  stdout.write(`\n${title}\n`);
  stdout.write(pc.dim('  ↑/↓ to move · enter to select · esc to skip\n\n'));
  stdout.write(HIDE_CURSOR);
  draw();

  emitKeypressEvents(stdin);
  const wasRaw = stdin.isRaw;
  stdin.setRawMode(true);
  stdin.resume();

  return new Promise<string | undefined>((resolve) => {
    const finish = (value: string | undefined): void => {
      stdin.off('keypress', onKeypress);
      stdin.setRawMode(Boolean(wasRaw));
      stdin.pause();
      stdout.write(SHOW_CURSOR);
      resolve(value);
    };

    function onKeypress(str: string, key: { name?: string; ctrl?: boolean }): void {
      if (key?.ctrl && key.name === 'c') {
        finish(undefined);
        return;
      }
      switch (key?.name) {
        case 'up':
        case 'k':
          index = (index - 1 + items.length) % items.length;
          draw();
          return;
        case 'down':
        case 'j':
        case 'tab':
          index = (index + 1) % items.length;
          draw();
          return;
        case 'return':
        case 'space':
          finish(items[index]?.value);
          return;
        case 'escape':
          finish(undefined);
          return;
        default:
          break;
      }
      // Number keys pick a row directly — faster than arrowing through five.
      const digit = Number(str);
      if (Number.isInteger(digit) && digit >= 1 && digit <= items.length) {
        index = digit - 1;
        draw();
        finish(items[index]?.value);
      }
    }

    stdin.on('keypress', onKeypress);
  });
}

/**
 * Holds the terminal until the user acknowledges something, then returns.
 *
 * This exists because the agent session clears the screen the instant it
 * starts: anything printed immediately before the handoff is technically
 * written and never read. A keypress is the only way to know a message about
 * to be wiped was actually seen.
 *
 * Returns straight away when there is no terminal to wait on, so a piped or
 * CI run can never hang here.
 */
export async function waitForAcknowledgement(prompt: string): Promise<void> {
  if (!canPrompt()) return;

  const { emitKeypressEvents } = await import('node:readline');
  const stdin = process.stdin;
  const stdout = process.stdout;

  stdout.write(`${pc.dim(prompt)}`);
  emitKeypressEvents(stdin);
  const wasRaw = stdin.isRaw;
  stdin.setRawMode(true);
  stdin.resume();

  await new Promise<void>((resolvePromise) => {
    const done = (): void => {
      stdin.off('keypress', onKeypress);
      stdin.off('end', done);
      stdin.off('close', done);
      stdin.setRawMode(Boolean(wasRaw));
      stdin.pause();
      // Erase the prompt: the agent is about to own this screen anyway, and a
      // stale "press enter" line is the last thing the user should scroll to.
      stdout.write(`\r${CLEAR_LINE}`);
      resolvePromise();
    };
    const onKeypress = (_str: string, key: { ctrl?: boolean; name?: string }): void => {
      // Ctrl-C still means Ctrl-C. It reaches this handler instead of the
      // default one because raw mode is on, so it has to be re-raised by hand.
      if (key?.ctrl && key.name === 'c') {
        done();
        process.exit(130);
      }
      done();
    };
    stdin.on('keypress', onKeypress);
    // A keypress that can never arrive must not hold the process. stdin being
    // a TTY makes this unlikely rather than impossible, and hanging before the
    // agent opens is the one failure here with no way out.
    stdin.once('end', done);
    stdin.once('close', done);
  });
}
