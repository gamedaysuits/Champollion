/**
 * A tiny OpenAI-compatible chat server for end-to-end tests that drive the
 * real CLI (bin/cli.js) with the `local` method — no network, no key.
 *
 * The CLI's user message ends with the batch as a pretty-printed JSON object
 * ({ "<key>": "<source text>", … }); the server parses it and answers with
 * whatever `translate(key, source, ctx)` returns for each key (undefined =
 * leave the key out of the answer, as a model that skips one would).
 *
 * A Markdown block-batch prompt (numbered ⟦SEG_N⟧ segments, lib/segment.js)
 * is answered segment by segment: `translate('seg:N', segmentText, ctx)`,
 * echoed under its marker (undefined = drop the segment).
 *
 * A whole-page prompt (contentSegmentation: "page", lib/content.js
 * buildContentPrompt — the body after its '---' line) is answered with
 * `translate('page', body, ctx)` as the raw reply (undefined = an empty reply).
 * Its call is recorded with keys ['page'].
 *
 * Every translation request is recorded in `calls` ({ model, keys, prompt,
 * system }) so a test can assert what was actually sent to the model; a block
 * batch's keys are its 'seg:N' names. A GET (the model listing a readiness
 * check asks for) is answered with an empty list and not recorded.
 */
import http from 'node:http';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';

export const CLI = fileURLToPath(new URL('../../bin/cli.js', import.meta.url));

/** The trailing `{ … }` object of a prompt (the batch the CLI sent). */
function batchOf(prompt) {
  const start = prompt.search(/^\{/m);
  if (start < 0) return {};
  try { return JSON.parse(prompt.slice(start)); } catch { return {}; }
}

/** The body of a whole-page Markdown prompt, or null for any other prompt. */
function pageOf(prompt) {
  if (!/^You are translating Markdown content from /.test(prompt)) return null;
  const at = prompt.indexOf('\n---\n');
  return at < 0 ? null : prompt.slice(at + 5);
}

/** The numbered segments of a Markdown block-batch prompt ([] for any other prompt). */
function segmentsOf(prompt) {
  const out = [];
  const re = /^⟦SEG_(\d+)⟧\n([\s\S]*?)(?=\n\n⟦SEG_\d+⟧\n|$(?![\s\S]))/gm;
  let m;
  while ((m = re.exec(prompt)) !== null) out.push({ id: Number(m[1]), text: m[2] });
  return out;
}

/**
 * @param {(key: string, source: string, ctx: { model: string, prompt: string }) => (string|undefined)} translate
 * @returns {Promise<{ url: string, calls: Array<{ model: string, keys: string[], prompt: string, system: string }>, close: () => Promise<void> }>}
 */
export async function startFakeModel(translate) {
  const calls = [];
  const server = http.createServer((req, res) => {
    // A listing (GET /v1/models — what the "local" method's readiness check
    // asks to see that a server answers) is answered and not recorded: it
    // is not a translation request.
    if (req.method === 'GET') {
      req.resume();
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ object: 'list', data: [] }));
      return;
    }
    let body = '';
    req.on('data', (c) => { body += c; });
    req.on('end', () => {
      let parsed = {};
      try { parsed = JSON.parse(body || '{}'); } catch { /* not JSON */ }
      const messages = Array.isArray(parsed.messages) ? parsed.messages : [];
      const user = [...messages].reverse().find(m => m.role === 'user');
      const prompt = typeof user?.content === 'string' ? user.content : '';
      const sys = messages.find(m => m.role === 'system');
      const system = typeof sys?.content === 'string' ? sys.content : '';
      const page = pageOf(prompt);
      if (page !== null) {
        calls.push({ model: parsed.model, keys: ['page'], prompt, system });
        const answer = translate('page', page, { model: parsed.model, prompt });
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
          choices: [{ message: { role: 'assistant', content: answer === undefined ? '' : answer } }],
          usage: { prompt_tokens: 1, completion_tokens: 1 },
        }));
        return;
      }
      const segments = segmentsOf(prompt);
      if (segments.length > 0) {
        calls.push({ model: parsed.model, keys: segments.map(sg => `seg:${sg.id}`), prompt, system });
        const answer = segments
          .map(sg => [sg, translate(`seg:${sg.id}`, sg.text, { model: parsed.model, prompt })])
          .filter(([, t]) => t !== undefined)
          .map(([sg, t]) => `⟦SEG_${sg.id}⟧\n${t}`)
          .join('\n\n');
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
          choices: [{ message: { role: 'assistant', content: answer } }],
          usage: { prompt_tokens: 1, completion_tokens: 1 },
        }));
        return;
      }
      const batch = batchOf(prompt);
      calls.push({ model: parsed.model, keys: Object.keys(batch), prompt, system });
      const out = {};
      for (const [key, source] of Object.entries(batch)) {
        const t = translate(key, source, { model: parsed.model, prompt });
        if (t !== undefined) out[key] = t;
      }
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        choices: [{ message: { role: 'assistant', content: JSON.stringify(out) } }],
        usage: { prompt_tokens: 1, completion_tokens: 1 },
      }));
    });
  });
  await new Promise(r => server.listen(0, '127.0.0.1', r));
  return {
    url: `http://127.0.0.1:${server.address().port}/v1`,
    calls,
    close: () => new Promise(r => server.close(() => r())),
  };
}

/**
 * Run the real CLI. stdout and stderr are captured separately and together.
 *
 * @returns {Promise<{ code: number, out: string, stdout: string, stderr: string }>}
 */
export function runCli(args, cwd, env = {}) {
  return new Promise((resolve) => {
    // A key a developer exported must not turn a keyless test into a billed one.
    const base = { ...process.env };
    for (const k of ['OPENROUTER_API_KEY', 'OPENAI_API_KEY', 'ANTHROPIC_API_KEY', 'GEMINI_API_KEY',
      'GOOGLE_API_KEY', 'GOOGLE_TRANSLATE_API_KEY', 'DEEPL_API_KEY', 'LOCAL_API_BASE', 'OPENAI_API_BASE',
      'OPENAI_BASE_URL']) delete base[k];
    const p = spawn(process.execPath, [CLI, ...args], { cwd, env: { ...base, ...env } });
    let out = '';
    let stdout = '';
    let stderr = '';
    p.stdout.on('data', (d) => { out += d; stdout += d; });
    p.stderr.on('data', (d) => { out += d; stderr += d; });
    p.on('close', (code) => resolve({ code, out, stdout, stderr }));
  });
}
