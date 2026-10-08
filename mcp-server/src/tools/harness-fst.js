/**
 * Can the eval harness HERE use a language's FST? — asked of the harness.
 *
 * Two different facts, never merged:
 *
 *   the card     resources.fsts[] says an FST EXISTS (resource existence,
 *                cited on the card). Kalaallisut's card lists giellalt's
 *                lang-kal — true, and says nothing about evaluation.
 *   the harness  mt_eval_harness/data/fst-pins.json says WHICH build the
 *                harness installs and measures with. No pin → `mt-eval` can
 *                neither download nor load an FST for the language, and the
 *                FST metrics do not run there (plugin_discovery skips them).
 *
 * The pins are a property of the installed HARNESS VERSION ("a harness
 * version pins its FST version" — the file ships inside the wheel, and
 * MT_EVAL_FST_PINS can replace it on a federated or air-gapped host). No copy
 * travels with the champollion npm package, and a bundled copy would be wrong
 * by design: it would describe whichever harness the CLI was built beside, not
 * the one `run_benchmark` spawns. So this asks that one: the `mt-eval` on PATH
 * (what run_benchmark runs), through the Python interpreter its launcher
 * names, with the same environment — bounded, no shell. No harness, or no
 * answer, is reported as "cannot tell", never as "no pin".
 */

import { spawn } from 'node:child_process';
import { readFileSync } from 'node:fs';

import { whichSync } from './forge.js';
import { stripAbsolutePaths } from './harness.js';
import { displayPath } from './state.js';

export const FST_PROBE_TIMEOUT_MS = 20_000;

/**
 * Pin formats the harness downloads by itself — mirrors install_fst() in
 * arena/mt_eval_harness/plugins/fst_installer.py and the same list in
 * config.py's automation path. Any other format ("divvun", "manual", …) is
 * pinned but has to be installed by hand.
 */
export const AUTO_INSTALL_FORMATS = new Set(['giellalt-nightly-apt', 'legacy-zip', 'divvun-macos-pkg']);

const SENTINEL = 'CHAMPOLLION_FST_PROBE ';

// Works against every harness version: get_fst_install_info() exists in all
// of them (0.1.x read it from the cards, which the 2026-08-12 cutover emptied;
// 0.2.0+ reads the shipped pins file). Every lookup is guarded so one missing
// helper degrades to null instead of losing the answer.
const PROBE_SCRIPT = `
import json, os, sys
def emit(doc):
    sys.stdout.write(${JSON.stringify(SENTINEL)} + json.dumps(doc) + "\\n")
out = {}
try:
    from importlib.metadata import version as _version
    try:
        out["version"] = _version("mt-eval-harness")
    except Exception:
        out["version"] = None
    from mt_eval_harness import language_cards as lc
except Exception as exc:
    emit({"error": "the harness does not import: %s: %s" % (type(exc).__name__, exc)})
    sys.exit(0)
out["pinsShipped"] = hasattr(lc, "fst_pinned_codes")
out["pinsOverride"] = bool(os.environ.get("MT_EVAL_FST_PINS", "").strip())
# which Python answered — the one run_benchmark spawns; another tool (forge)
# asking another interpreter can see another runtime (Round 13)
out["python"] = sys.executable
# The runtime, as the harness's own fst_state reads it (it IMPORTS pyhfst — a
# present-but-broken install is missing, as the run will find it) when this
# harness has it; find_spec only for an older one, and said so.
try:
    from mt_eval_harness import config as _C
except Exception:
    _C = None
_has_state = _C is not None and hasattr(_C, "fst_state")
out["runtimeFrom"] = "fst_state" if _has_state else "find_spec"
if not _has_state:
    try:
        import importlib.util as _util
        out["pyhfst"] = _util.find_spec("pyhfst") is not None
    except Exception:
        out["pyhfst"] = None
else:
    out["pyhfst"] = None
try:
    from mt_eval_harness.plugins import fst_installer as fi
except Exception:
    fi = None
langs = {}
for code in sys.argv[1:]:
    try:
        info = lc.get_fst_install_info(code)
    except Exception as exc:
        emit({"error": "the harness could not read its FST pins: %s" % exc})
        sys.exit(0)
    pin = None
    if isinstance(info, dict):
        pin = {k: info.get(k) for k in ("repo", "format", "maturity", "kind", "langCommit", "releaseTag")}
        try:
            meta = lc.get_fst_pin(code) if hasattr(lc, "get_fst_pin") else None
        except Exception:
            meta = None
        if isinstance(meta, dict):
            pin["name"] = meta.get("name")
            pin["url"] = meta.get("url")
    rec = {"pin": pin}
    st = None
    if pin and _has_state:
        try:
            st = _C.fst_state(code)
        except Exception as exc:
            rec["stateError"] = "%s: %s" % (type(exc).__name__, exc)
    if isinstance(st, dict):
        # the harness's one reading of this machine's FST lane (config.fst_state)
        rec["installed"] = bool(st.get("analyzer_installed"))
        rec["runtime"] = bool(st.get("runtime_installed"))
        rec["missing"] = list(st.get("missing") or [])
        rec["setupCommand"] = st.get("setup_command")
        rec["stateLine"] = st.get("line")
        if out["pyhfst"] is None:
            out["pyhfst"] = rec["runtime"]
    else:
        try:
            rec["installed"] = bool(fi.is_fst_installed(code)) if fi else None
        except Exception:
            rec["installed"] = None
    try:
        rec["stale"] = (bool(fi.installed_pin_mismatch(code))
                        if rec["installed"] and pin and hasattr(fi, "installed_pin_mismatch") else False)
    except Exception:
        rec["stale"] = None
    try:
        pack = lc.get_eval_pack(code)
        rec["evalPackFst"] = bool(pack and pack.get("requiresFst"))
    except Exception:
        rec["evalPackFst"] = None
    rec.setdefault("stateLine", None)
    langs[code] = rec
out["langs"] = langs
if out["pyhfst"] is None and _has_state:
    # no pinned language asked: the runtime by the same import fst_state makes
    try:
        __import__("pyhfst")
        out["pyhfst"] = True
    except ImportError:
        out["pyhfst"] = False
    except Exception:
        out["pyhfst"] = None
emit(out)
`;

/**
 * The interpreter a console-script launcher runs, from its first lines.
 * Handles `#!/abs/python [flags]`, `#!/usr/bin/env python3`, and pip's
 * `#!/bin/sh` + `'''exec' "<python>" "$0" "$@"` form (used when the
 * interpreter path contains spaces). Null when it cannot tell — a Windows
 * .exe launcher, or not a Python script at all.
 *
 * @param {string} text  the launcher's head
 * @returns {{cmd: string, args: string[]}|null}
 */
export function interpreterFromLauncher(text) {
  const lines = String(text || '').split(/\r?\n/);
  const m = /^#!\s*(\S+)(?:[ \t]+(.*))?$/.exec(lines[0] || '');
  if (!m) return null;
  const prog = m[1];
  const rest = (m[2] || '').trim().split(/\s+/).filter(Boolean);
  const base = prog.split(/[\\/]/).pop();
  if (base === 'env') {
    const cmd = rest.find((a) => !a.startsWith('-'));
    return cmd ? { cmd, args: [] } : null;
  }
  if (base === 'sh' || base === 'bash') {
    const ex = /^'''exec'\s+(?:"([^"]+)"|'([^']+)'|(\S+))/.exec(lines[1] || '');
    const cmd = ex && (ex[1] || ex[2] || ex[3]);
    return cmd ? { cmd, args: [] } : null;
  }
  if (/python/i.test(base)) return { cmd: prog, args: rest };
  return null;
}

/** Run a command, bounded, no shell, stdin closed. Never throws. */
export function runBounded(cmd, args, { env, timeout }) {
  return new Promise((done) => {
    let proc;
    try {
      proc = spawn(cmd, args, { stdio: ['ignore', 'pipe', 'pipe'], env, timeout });
    } catch (err) {
      done({ code: null, stdout: '', stderr: '', spawnError: err.message });
      return;
    }
    let stdout = '';
    let stderr = '';
    proc.stdout.on('data', (d) => { stdout += d; });
    proc.stderr.on('data', (d) => { stderr += d; });
    proc.on('error', (err) => done({ code: null, stdout, stderr, spawnError: err.message }));
    proc.on('close', (code, signal) => done({ code, stdout, stderr, timedOut: code === null && Boolean(signal) }));
  });
}

const CODE_RE = /^[A-Za-z]{2,8}(?:[-_][A-Za-z0-9]{1,8})*$/;

/**
 * Ask the installed harness which of `codes` it has an FST pin for, whether
 * that FST is installed, and whether the pyhfst runtime is. Never throws.
 *
 * @param {string[]} codes
 * @param {object} [deps]  env, which, readLauncher, python ({cmd, args}), run, timeoutMs
 * @returns {Promise<
 *   {status: 'ok', how: string, version: string|null, pinsShipped: boolean,
 *    pinsOverride: boolean, pyhfst: boolean|null,
 *    langs: Object<string, {pin: object|null, installed: boolean|null, stale: boolean|null,
 *      evalPackFst: boolean|null}>}
 *   | {status: 'not-installed', how: string}
 *   | {status: 'error', how: string, error: string}>}
 */
/**
 * The Python interpreter the `mt-eval` on PATH runs — the one run_benchmark
 * spawns — read from its launcher (PYTHON_BIN when the launcher names none).
 *
 * @returns {{interp: {cmd: string, args: string[]}, how: string}
 *   | {status: 'not-installed', how: string} | {status: 'error', how: string, error: string}}
 */
export function harnessInterpreter({
  env = process.env,
  which = (cmd) => whichSync(cmd, env),
  readLauncher = (p) => readFileSync(p, 'utf8').slice(0, 4096),
  python = null,
} = {}) {
  if (python) return { interp: python, how: 'the given Python' };
  const launcher = which('mt-eval');
  if (!launcher) return { status: 'not-installed', how: 'no `mt-eval` on PATH' };
  let how = '`mt-eval` on PATH';
  let head = '';
  try { head = readLauncher(launcher); } catch { head = ''; }
  let interp = interpreterFromLauncher(head);
  if (!interp && env.PYTHON_BIN) {
    interp = { cmd: env.PYTHON_BIN, args: [] };
    how = `PYTHON_BIN (the Python behind \`mt-eval\` could not be read from its launcher)`;
  }
  if (!interp) {
    return { status: 'error', how, error: 'could not tell which Python `mt-eval` runs (its launcher names none); set PYTHON_BIN to it' };
  }
  return { interp, how };
}

export async function probeHarnessFst(codes, {
  env = process.env,
  which = (cmd) => whichSync(cmd, env),
  readLauncher = (p) => readFileSync(p, 'utf8').slice(0, 4096),
  python = null,
  run = runBounded,
  timeoutMs = FST_PROBE_TIMEOUT_MS,
} = {}) {
  const wanted = (codes || []).filter((c) => CODE_RE.test(String(c)));
  const found = harnessInterpreter({ env, which, readLauncher, python });
  if (!found.interp) return found;
  const { interp, how } = found;
  const r = await run(interp.cmd, [...(interp.args || []), '-c', PROBE_SCRIPT, ...wanted], { env, timeout: timeoutMs });
  if (r.timedOut) return { status: 'error', how, error: `the harness did not answer within ${Math.round(timeoutMs / 1000)}s` };
  if (r.spawnError) return { status: 'error', how, error: stripAbsolutePaths(`could not start the harness's Python: ${r.spawnError}`) };
  const line = String(r.stdout || '').split(/\r?\n/).reverse().find((l) => l.startsWith(SENTINEL));
  if (!line) {
    const tail = String(r.stderr || '').trim().split(/\r?\n/).filter(Boolean).pop() || `exit ${r.code}`;
    return { status: 'error', how, error: stripAbsolutePaths(`the harness gave no answer (${tail.slice(0, 200)})`) };
  }
  let doc;
  try { doc = JSON.parse(line.slice(SENTINEL.length)); } catch (err) {
    return { status: 'error', how, error: `unreadable harness answer (${err.message})` };
  }
  if (doc.error) return { status: 'error', how, error: stripAbsolutePaths(String(doc.error)) };
  return {
    status: 'ok',
    how,
    version: doc.version ?? null,
    pinsShipped: doc.pinsShipped === true,
    pinsOverride: doc.pinsOverride === true,
    pyhfst: typeof doc.pyhfst === 'boolean' ? doc.pyhfst : null,
    runtimeFrom: doc.runtimeFrom === 'fst_state' ? 'fst_state' : (doc.runtimeFrom ? 'find_spec' : null),
    python: typeof doc.python === 'string' ? doc.python : null,
    langs: doc.langs && typeof doc.langs === 'object' ? doc.langs : {},
  };
}

// ---------------------------------------------------------------------------
// Rendering — the card fact and the harness capability, side by side
// ---------------------------------------------------------------------------

/** owner/repo of a GitHub URL or an `owner/repo` slug, lowercased; else null. */
function repoKey(s) {
  const t = String(s || '').trim().toLowerCase()
    .replace(/^https?:\/\//, '').replace(/^(www\.)?github\.com\//, '')
    .replace(/\.git$/, '').replace(/\/+$/, '');
  const parts = t.split('/');
  return parts.length === 2 && parts[0] && parts[1] ? t : null;
}

/** Does this card FST entry name the build the harness pins? */
function isPinnedBuild(fst, pin) {
  const card = repoKey(fst.url);
  return Boolean(card) && [pin.repo, pin.url].some((p) => repoKey(p) === card);
}

function buildLabel(pin) {
  const ver = pin.langCommit ? ` @ ${String(pin.langCommit).slice(0, 8)}` : (pin.releaseTag ? ` ${pin.releaseTag}` : '');
  const tags = [
    pin.maturity && `GiellaLT maturity: ${pin.maturity}`,
    pin.kind === 'acceptor' && 'acceptor only — FST acceptance, not morphological accuracy',
  ].filter(Boolean);
  return `${pin.repo || pin.name || 'pinned build'}${ver}${tags.length ? `; ${tags.join('; ')}` : ''}`;
}

/** What the harness can do with its pin for `code`, given the probe. */
function pinCapability(code, rec, probe) {
  const pin = rec.pin;
  const runtime = probe.pyhfst === false
    ? ` The FST runtime (pyhfst) is not installed: \`${rec.evalPackFst ? `mt-eval setup --lang ${code}` : 'mt-eval setup --fst'}\`.`
    : '';
  if (!AUTO_INSTALL_FORMATS.has(pin.format)) {
    return `the harness pins it (${buildLabel(pin)}), but its "${pin.format || 'unstated'}" format cannot be downloaded automatically — `
      + (rec.installed
        ? 'installed here by hand.'
        : 'until it is installed by hand, FST metrics will not run for this language (`mt-eval setup --status` lists it as a manual install).')
      + runtime;
  }
  if (rec.installed && rec.stale) {
    return `the harness pins this build (${buildLabel(pin)}); an FST is installed here, but the harness cannot confirm it is the pinned build — `
      + 'runs measure with the installed one (the run card records which) until that cache is removed and the pin re-installed '
      + `(the harness's run-time warning names the directory).${runtime}`;
  }
  // The harness's own sentence when it gives one (one wording everywhere:
  // setup --status, the eval-pack lines, the run's advisory). This line used
  // to say the FST "downloads on the first evaluation" — nothing downloads by
  // itself (synthetic school persona, Round 8).
  if (rec.stateLine) return `the harness pins this build (${buildLabel(pin)}). ${rec.stateLine}`;
  if (rec.installed) return `the harness pins this build (${buildLabel(pin)}); installed here.${runtime}`;
  return `the harness pins this build (${buildLabel(pin)}); not installed here — nothing downloads by itself: `
    + `\`mt-eval setup --lang ${code}\` installs it; until then a run proceeds with FST acceptance marked not computed.`
    + runtime;
}

/**
 * The FST lines for the overview: one per FST the card lists, each with the
 * card fact first and the harness's answer after it. Empty when the card
 * lists none and the harness pins none (the Tooling line already says so).
 *
 * @param {string} code      the card's canonical code
 * @param {object[]} fsts    summary.resources.fsts (name, url, publisher, …)
 * @param {{ok: boolean, value?: object, error?: string}|null} section  the probe, as overview's section() returns it
 * @returns {string[]}
 */
export function formatFstLines(code, fsts, section) {
  const list = Array.isArray(fsts) ? fsts : [];
  const probe = section?.ok ? section.value : null;
  const rec = probe?.status === 'ok' ? (probe.langs?.[code] || { pin: null }) : null;
  const pin = rec?.pin || null;
  // Which harness answered, and in which Python (the one run_benchmark
  // spawns): another tool asking another interpreter — or the same one after
  // an install — can read the FST lane differently (Round 13: the overview
  // and forge_discover disagreed on pyhfst while another session installed it).
  const who = probe?.status === 'ok'
    ? `mt-eval-harness ${probe.version || '(version unknown)'}`
      + `${probe.python ? ` in ${displayPath(probe.python)}` : ''}`
      + `${probe.pinsOverride ? ', pins from MT_EVAL_FST_PINS' : ''}`
    : null;

  if (!list.length) {
    if (!pin) return [];
    return [`FSTs: the card lists none, but the harness here (${who}) pins one for ${code} — ${pinCapability(code, rec, probe)}`];
  }

  let cannotTell = null;
  if (!section?.ok) {
    cannotTell = `cannot tell whether the harness can use it — asking the harness failed (${section?.error || 'no answer'}).`;
  } else if (probe.status === 'not-installed') {
    cannotTell = 'harness not installed — cannot tell whether it can use this FST (`python3 -m pip install mt-eval-harness`; '
      + 'then `mt-eval setup --status` lists the FSTs it pins).';
  } else if (probe.status !== 'ok') {
    cannotTell = `cannot tell whether the harness can use it — the harness could not report its FST pins (${probe.error}).`;
  }

  const out = [`FSTs — the card records that each exists; whether the eval harness here${who ? ` (${who})` : ''} can download and load it is a separate check:`];
  const matched = pin ? list.filter((f) => isPinnedBuild(f, pin)) : [];
  for (const f of list) {
    const fact = `${f.name || 'FST'} (${f.publisher || 'publisher not stated'})${f.url ? ` <${f.url}>` : ''}: recorded on the card`;
    let harness;
    if (cannotTell) {
      harness = `; ${cannotTell}`;
    } else if (!pin) {
      harness = `, but the harness has no pin for ${code} yet — it cannot download or load it, `
        + 'so FST metrics will not run for this language.'
        + (probe.pinsShipped ? '' : ' (This harness predates the FST pins that ship inside it — `python3 -m pip install -U mt-eval-harness`, then re-check.)');
    } else if (matched.includes(f)) {
      harness = `; ${pinCapability(code, rec, probe)}`;
    } else {
      harness = `; not the build the harness pins for ${code} (${pin.repo || pin.name || 'a different build'}).`;
    }
    out.push(`  - ${fact}${harness}`);
  }
  if (pin && !matched.length) {
    out.push(`  - harness pin for ${code}, not among the card's entries: ${pinCapability(code, rec, probe)}`);
  }
  return out;
}
