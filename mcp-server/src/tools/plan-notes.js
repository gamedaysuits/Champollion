/**
 * Two things a corpus-mode run_benchmark plan must say BEFORE the user
 * confirms, which the harness's own plan cannot:
 *
 *   forgeOrderLines   a benchmark of the user's test file is a SCORING read.
 *                     If a model may be trained against that file, forge's
 *                     register → leak-audit → preregistration come first:
 *                     forge refuses a preregistration written after a scoring
 *                     read (founder rule, unchanged). Round 10 (school +
 *                     hospital): every hint before this went straight to the
 *                     benchmark, so the order was learned from the refusal.
 *
 *   localModelWeightsLines
 *                     method "local-model" with a Hugging Face id downloads
 *                     the weights on the first run. The plan used to say only
 *                     "ON THIS MACHINE — nothing leaves the machine" and
 *                     "$0 API cost" (Round 10 school persona), so confirming
 *                     started a multi-gigabyte download nobody had agreed to.
 *                     The plan now says whether a download happens, where the
 *                     files go (the Hugging Face cache transformers uses), and
 *                     how big it is — from the Hub's own file listing, or
 *                     "unknown" when the Hub does not answer. Never guessed.
 *
 * Both read only metadata: the read log's first lines (content-free, written
 * by forge) and, for the size, the Hub's public file listing for the model id.
 */

import { existsSync, readFileSync, statSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';

import { displayPath } from './state.js';
import { forgeBeforeBaselineSteps, BENCHMARK_IS_A_SCORING_READ } from './register-corpus-hint.js';

/** The read log forge starts beside a registered test/sealed file. */
export const READ_LOG_SUFFIX = '.reads.jsonl';

/**
 * Whether forge registered this file (its read log's `watch` lines), never
 * its content.
 *
 * @returns {{registered: boolean, sets: Array<{set: string, role: string}>}}
 */
export function forgeRegistration(corpusPath, { exists = existsSync, read = readFileSync } = {}) {
  const log = `${corpusPath}${READ_LOG_SUFFIX}`;
  if (!corpusPath || !exists(log)) return { registered: false, sets: [], log };
  const sets = [];
  let text = '';
  try { text = String(read(log, 'utf-8')); } catch { return { registered: true, sets, log }; }
  for (const line of text.split('\n')) {
    if (!line.includes('"watch"')) continue;
    try {
      const rec = JSON.parse(line);
      if (rec?.event === 'watch' && rec.set && !sets.some((s) => s.set === rec.set)) {
        sets.push({ set: String(rec.set), role: String(rec.role || 'test') });
      }
    } catch { /* a line the log's owner wrote badly: not ours to judge */ }
  }
  return { registered: true, sets, log };
}

/**
 * The plan's "Forge:" lines for a run on a file the user holds.
 *
 * @param {string} corpusPath  the resolved file
 * @param {object} [fs]  injected exists/read (tests)
 * @returns {string[]}
 */
export function forgeOrderLines(corpusPath, fs = {}) {
  const reg = forgeRegistration(corpusPath, fs);
  if (reg.registered) {
    const named = reg.sets.length
      ? reg.sets.map((s) => `${s.set} (role ${s.role})`).join(', ')
      : 'a test set';
    return [
      `Forge:    this file is registered with nmt-forge as ${named}; its read log `
        + `(${displayPath(reg.log)}) will record this run as a scoring read. Write every planned model's `
        + 'preregistration BEFORE you confirm (forge_prereg_template → forge_prereg, one per model) — '
        + 'forge refuses one written after a scoring read. forge_status says whether they exist '
        + '(state missing-preregistration means they do not).',
    ];
  }
  return [
    `Forge:    ${BENCHMARK_IS_A_SCORING_READ}. If a model may ever be trained against this file, do forge's `
      + `steps FIRST: ${forgeBeforeBaselineSteps()}. Not training? Nothing to do.`,
  ];
}

/**
 * Where transformers keeps downloaded models (huggingface_hub's rule):
 * HF_HUB_CACHE, else HF_HOME/hub, else XDG_CACHE_HOME/huggingface/hub,
 * else ~/.cache/huggingface/hub.
 */
export function huggingFaceHubCache(env = process.env) {
  const v = (k) => String(env[k] || '').trim();
  if (v('HF_HUB_CACHE')) return v('HF_HUB_CACHE');
  if (v('HUGGINGFACE_HUB_CACHE')) return v('HUGGINGFACE_HUB_CACHE');
  if (v('HF_HOME')) return join(v('HF_HOME'), 'hub');
  if (v('XDG_CACHE_HOME')) return join(v('XDG_CACHE_HOME'), 'huggingface', 'hub');
  return join(homedir(), '.cache', 'huggingface', 'hub');
}

/** A Hub id (`org/name`) — not a path on this machine. */
export function looksLikeHubId(model) {
  return /^[A-Za-z0-9][\w.-]*\/[\w.-]+$/.test(String(model || ''));
}

function fmtBytes(n) {
  if (!Number.isFinite(n) || n <= 0) return null;
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  let i = 0;
  let x = n;
  while (x >= 1000 && i < units.length - 1) { x /= 1000; i += 1; }
  return `${x >= 100 || i === 0 ? Math.round(x) : x.toFixed(1)} ${units[i]}`;
}

/**
 * The files `from_pretrained` downloads, sized from the Hub's listing:
 * the top-level weights (safetensors when the repo has them, else the
 * PyTorch .bin files) plus the top-level config/tokenizer files. Files in
 * subfolders (onnx/, other formats) are not fetched and are not counted.
 *
 * @param {Array<{rfilename: string, size?: number}>} siblings
 * @returns {{bytes: number|null, weights: string, repoBytes: number|null}}
 */
export function downloadSize(siblings) {
  const top = (siblings || []).filter((s) => s && typeof s.rfilename === 'string' && !s.rfilename.includes('/'));
  const sized = (list) => (list.every((s) => Number.isFinite(s.size)) ? list.reduce((n, s) => n + s.size, 0) : null);
  const safet = top.filter((s) => s.rfilename.endsWith('.safetensors'));
  const bins = top.filter((s) => /\.bin$/.test(s.rfilename) && /pytorch_model|model/.test(s.rfilename));
  const weights = safet.length ? safet : bins;
  const small = top.filter((s) => /\.(json|model|txt|spm|vocab)$/i.test(s.rfilename) || /sentencepiece|tokenizer|vocab|config/i.test(s.rfilename))
    .filter((s) => !weights.includes(s));
  const w = sized(weights);
  const extra = sized(small);
  const all = sized((siblings || []).filter((s) => s && typeof s.rfilename === 'string'));
  return {
    bytes: weights.length && w != null ? w + (extra ?? 0) : null,
    weights: safet.length ? '.safetensors weights' : bins.length ? 'PyTorch .bin weights' : 'no weights file listed',
    repoBytes: all,
  };
}

/** Ask the Hub for a model's file listing (sizes included), bounded. */
export async function hubFileListing(model, { fetchImpl = globalThis.fetch, timeoutMs = 8000 } = {}) {
  if (typeof fetchImpl !== 'function') return { ok: false, error: 'no fetch in this Node' };
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const url = `https://huggingface.co/api/models/${model.split('/').map(encodeURIComponent).join('/')}?blobs=true`;
    const res = await fetchImpl(url, { signal: ctrl.signal, headers: { accept: 'application/json' } });
    if (!res.ok) return { ok: false, error: `the Hub answered HTTP ${res.status}` };
    const doc = await res.json();
    return { ok: true, siblings: Array.isArray(doc?.siblings) ? doc.siblings : [] };
  } catch (err) {
    return { ok: false, error: err?.name === 'AbortError' ? `the Hub did not answer within ${timeoutMs / 1000} s` : String(err?.message || err) };
  } finally {
    clearTimeout(timer);
  }
}

/**
 * The plan's "Weights:" lines for method "local-model".
 *
 * @param {string} model  a Hub id or a directory
 * @param {object} [deps]  env, exists, isDir, listing (async (model) => hubFileListing result)
 * @returns {Promise<string[]>}
 */
export async function localModelWeightsLines(model, {
  env = process.env, exists = existsSync,
  isDir = (p) => { try { return statSync(p).isDirectory(); } catch { return false; } },
  listing = (m) => hubFileListing(m),
} = {}) {
  const m = String(model || '').trim();
  if (!m) return [];
  if (isDir(m)) {
    return [`Weights:  loaded from the directory ${displayPath(m)} on this machine — nothing is downloaded.`];
  }
  if (!looksLikeHubId(m)) {
    return [`Weights:  "${m}" is neither a directory here nor a Hugging Face id (org/name) — the run will fail to load it.`];
  }
  const cache = huggingFaceHubCache(env);
  const entry = join(cache, `models--${m.replace('/', '--')}`);
  if (exists(entry)) {
    return [`Weights:  ${m} is already in the Hugging Face cache (${displayPath(entry)}) — confirming downloads `
      + 'nothing more unless files are missing there.'];
  }
  const l = await listing(m);
  let size = 'size unknown';
  if (l?.ok) {
    const d = downloadSize(l.siblings);
    size = d.bytes != null
      ? `about ${fmtBytes(d.bytes)} (the ${d.weights} plus config and tokenizer files, from the Hub's file listing)`
      : `size not listed by the Hub (${d.weights})`;
  } else if (l?.error) {
    size = `size unknown — ${l.error}`;
  }
  return [
    `Weights:  confirming DOWNLOADS ${m} from huggingface.co into ${displayPath(cache)} (the Hugging Face cache `
      + `transformers uses; HF_HOME or HF_HUB_CACHE moves it): ${size}. Only the model id is sent; your test `
      + 'sentences never leave this machine. Ask the user before confirming a large download.',
  ];
}
