/**
 * Copies text to the system clipboard using whatever the platform ships.
 *
 * The fix handoff pastes rather than auto-submits: the prompt goes on the
 * clipboard and the agent session opens empty, so the developer reads it, edits
 * it if they want, and presses enter themselves. Failure is expected on a bare
 * Linux box with no clipboard tool — callers fall back to printing the prompt.
 */
import { spawn } from 'node:child_process';

interface ClipboardCommand {
  command: string;
  args: string[];
}

function candidates(): ClipboardCommand[] {
  if (process.platform === 'darwin') return [{ command: 'pbcopy', args: [] }];
  if (process.platform === 'win32') return [{ command: 'clip', args: [] }];
  return [
    { command: 'wl-copy', args: [] },
    { command: 'xclip', args: ['-selection', 'clipboard'] },
    { command: 'xsel', args: ['--clipboard', '--input'] },
  ];
}

function pipeTo(cmd: ClipboardCommand, text: string): Promise<boolean> {
  return new Promise((resolve) => {
    const child = spawn(cmd.command, cmd.args, { stdio: ['pipe', 'ignore', 'ignore'] });
    child.on('error', () => resolve(false));
    child.on('close', (code) => resolve(code === 0));
    child.stdin.on('error', () => resolve(false));
    child.stdin.end(text);
  });
}

/** True when the text made it onto the clipboard. */
export async function copyToClipboard(text: string): Promise<boolean> {
  for (const cmd of candidates()) {
    if (await pipeTo(cmd, text)) return true;
  }
  return false;
}
