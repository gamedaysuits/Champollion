/**
 * Forced-TTY driver for the interactive init wizard.
 *
 * The wizard runs only when process.stdin.isTTY is true — a real PTY is
 * unavailable under the node test runner, so this driver substitutes a
 * PassThrough stdin that CLAIMS to be a TTY, then answers each readline
 * prompt the moment it is written to stdout (prompts end with ": ").
 *
 * WHY feed on-prompt instead of pre-piping lines: readline drops 'line'
 * events that arrive while no rl.question() is pending, so a burst of
 * piped answers loses everything after the first prompt.
 *
 * Usage: node wizard-driver.mjs '<answers-json-array>' '<flags-json>'
 *   - answers are consumed one per prompt; exhausted answers become ""
 *     (bare Enter, accepting the prompt's default)
 *   - runs init in process.cwd() — spawn with cwd set to a temp dir
 */
import { PassThrough } from 'node:stream';

const answers = JSON.parse(process.argv[2] || '[]');
const flags = JSON.parse(process.argv[3] || '{}');

const fakeStdin = new PassThrough();
fakeStdin.isTTY = true;
Object.defineProperty(process, 'stdin', { value: fakeStdin, configurable: true });

const realWrite = process.stdout.write.bind(process.stdout);
process.stdout.write = (chunk, ...rest) => {
  const ok = realWrite(chunk, ...rest);
  // rl.question() arms its callback before writing the prompt, so it is
  // safe to answer as soon as the prompt (always "...: ") hits stdout.
  if (String(chunk).endsWith(': ')) {
    const next = answers.length > 0 ? answers.shift() : '';
    setImmediate(() => fakeStdin.write(`${next}\n`));
  }
  return ok;
};

const { run } = await import('../../lib/commands/init.js');

try {
  const code = await run(flags, process.cwd());
  process.exit(code);
} catch (err) {
  realWrite(`WIZARD_DRIVER_ERROR: ${err?.stack || err}\n`);
  process.exit(1);
}
