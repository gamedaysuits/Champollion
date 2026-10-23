/**
 * The neural metrics a run_benchmark plan names BEFORE the user confirms —
 * asked of the harness the run will use, never guessed.
 *
 * Round 13 (synthetic researcher): the run card said "MetricX-24 not run —
 * MetricX is opt-in (pass --metricx)", but run_benchmark had no way to pass
 * it, and nothing in the plan said whether COMET would be computed. What the
 * harness does (arena/mt_eval_harness/tester.py, cli.py; the public harness
 * spec's "Opt-in neural metrics"):
 *
 *   COMET     computed on EVERY run whose harness Python imports unbabel-comet
 *             — there is no run flag; `mt-eval setup --comet` installs it.
 *             `comet: true` here makes a run REQUIRE it: refused before it
 *             starts when COMET is not available, never silently missing.
 *   MetricX   opt-in: `mt-eval run --metricx [--metricx-model <ckpt>]`; needs
 *             the `metricx` extra plus Google's model code (not on PyPI).
 *   FUSE      opt-in: `mt-eval run --fuse`; needs the `fuse` extra.
 *
 * A requested metric the harness cannot compute here is REFUSED at confirm
 * (the harness itself would run on and report the score as not computed —
 * the user asked for it, so the run waits for the install instead). Whether
 * each is available is the harness's own flag (metrics_comet's
 * comet_unavailable_reason, metrics_metricx.HAS_METRICX,
 * metrics_fuse.HAS_LABSE), read through the Python the `mt-eval` on PATH
 * runs — bounded, no shell, nothing installed or downloaded. Separate from
 * the run-plan probe (and run beside it) because importing a metric's stack
 * loads PyTorch: a slow answer here never costs the plan its licence and
 * eval-pack lines.
 */

import { harnessInterpreter, runBounded } from './harness-fst.js';
import { stripAbsolutePaths } from './harness.js';
import { displayPath } from './state.js';

export const METRICS_PROBE_TIMEOUT_MS = 40_000;
const SENTINEL = 'CHAMPOLLION_METRICS_PROBE ';

/**
 * What each metric needs and costs, in the harness spec's own words
 * (cli/website/docs/network/specifications/harness.md, "Opt-in neural
 * metrics" — parity-checked by test/round13-metrics.test.js).
 */
export const METRIC_COSTS = Object.freeze({
  comet: 'about 300 MB to install, and about 2.3 GB of model on first use',
  metricx: 'the default google/metricx-24-hybrid-large-v2p6 checkpoint and the mT5-XL tokenizer download '
    + 'several GB from Hugging Face on first use; scoring is slow on a CPU',
  fuse: 'LaBSE downloads about 1.8 GB on first use',
});
const LOCAL = 'it runs on this machine (no API cost, no text sent anywhere), is reported beside the scores and '
  + 'is never blended into the chrF++ headline';

const PROBE_SCRIPT = `
import json, sys
def emit(doc):
    sys.stdout.write(${JSON.stringify(SENTINEL)} + json.dumps(doc, default=str) + "\\n")
out = {"python": sys.executable}
try:
    from mt_eval_harness import config as C
    from mt_eval_harness import language_cards as lc
except Exception as exc:
    emit({"error": "the harness does not import: %s: %s" % (type(exc).__name__, exc)})
    sys.exit(0)
a = json.loads(sys.argv[1])
# the target code COMET's model choice reads — the run's own resolution: the
# corpus's registry entry, else the code the corpus states, else the name
code = a.get("target_code") or None
ds = a.get("dataset_id") or ""
if not code and ds:
    try:
        for d in C.load_registry().get("datasets", []):
            if d.get("id") == ds or ds in (d.get("aliases") or []):
                res = d.get("language_resolution") or {}
                code = (res.get("target") or {}).get("resolved") or (d.get("language_pair") or {}).get("target")
                break
    except Exception:
        pass
if not code and a.get("target_name"):
    try:
        code = lc.resolve_name(a["target_name"]) or None
    except Exception:
        code = None
out["targetCode"] = code
try:
    from mt_eval_harness.setup_wizard import pip_install_hint as _hint
except Exception:
    _hint = None
def hint(*specs):
    if _hint is not None:
        try:
            return _hint(*specs)
        except Exception:
            pass
    return "python3 -m pip install " + " ".join("'%s'" % s if "[" in s else s for s in specs)
import importlib.util as _u
def absent(mods):
    return [label for mod, label in mods if _u.find_spec(mod) is None]
try:
    from mt_eval_harness import metrics_comet as MC
    reason = MC.comet_unavailable_reason()
    rec = {"available": reason is None, "reason": reason, "defaultModel": MC.DEFAULT_COMET_MODEL}
    try:
        rec["model"] = MC.resolve_comet_model(target_lang=code or "")
    except Exception:
        rec["model"] = MC.DEFAULT_COMET_MODEL
    out["comet"] = rec
except Exception as exc:
    out["comet"] = {"error": "%s: %s" % (type(exc).__name__, exc)}
if a.get("metricx"):
    try:
        from mt_eval_harness import metrics_metricx as MX
        rec = {"available": bool(MX.HAS_METRICX), "defaultModel": MX.DEFAULT_METRICX_MODEL,
               "tokenizer": getattr(MX, "DEFAULT_METRICX_TOKENIZER", None)}
        if not rec["available"]:
            rec["missing"] = absent((("torch", "PyTorch"), ("transformers", "Transformers"),
                                     ("sentencepiece", "SentencePiece")))
            if _u.find_spec("metricx24") is None and _u.find_spec("metricx25") is None:
                rec["missing"].append("Google's MetricX model code (the metricx24 package, not on PyPI)")
            rec["install"] = [hint("mt-eval-harness[metricx]"), hint("git+https://github.com/google-research/metricx")]
        out["metricx"] = rec
    except Exception as exc:
        out["metricx"] = {"error": "%s: %s" % (type(exc).__name__, exc)}
if a.get("fuse"):
    try:
        from mt_eval_harness import metrics_fuse as MF
        rec = {"available": bool(MF.HAS_LABSE), "phonetic": bool(getattr(MF, "HAS_PHONETIC", False)),
               "model": getattr(MF, "_LABSE_MODEL_NAME", None)}
        if not rec["available"] or not rec["phonetic"]:
            rec["missing"] = absent((("sentence_transformers", "sentence-transformers (LaBSE)"),
                                     ("jellyfish", "jellyfish (its phonetic part)")))
            rec["install"] = [hint("mt-eval-harness[fuse]")]
        out["fuse"] = rec
    except Exception as exc:
        out["fuse"] = {"error": "%s: %s" % (type(exc).__name__, exc)}
emit(out)
`;

/**
 * Ask the harness which neural metrics it can compute here. Never throws.
 *
 * @param {{metricx?: boolean, fuse?: boolean, datasetId?: string|null, targetCode?: string|null,
 *   targetName?: string|null}} input  COMET is always asked (it runs by default when installed)
 * @param {object} [deps]  env, which, readLauncher, python, run, timeoutMs
 * @returns {Promise<{status: 'ok', python: string, targetCode: string|null, comet: object,
 *   metricx?: object, fuse?: object} | {status: 'not-installed'|'error', error: string}>}
 */
export async function probeMetrics(input, {
  env = process.env, which, readLauncher, python = null, run = runBounded,
  timeoutMs = METRICS_PROBE_TIMEOUT_MS,
} = {}) {
  const found = harnessInterpreter({ env, ...(which ? { which } : {}), ...(readLauncher ? { readLauncher } : {}), python });
  if (!found.interp) return { status: found.status, error: found.error || found.how };
  const arg = JSON.stringify({
    metricx: input?.metricx === true, fuse: input?.fuse === true,
    dataset_id: input?.datasetId || '', target_code: input?.targetCode || '', target_name: input?.targetName || '',
  });
  const r = await run(found.interp.cmd, [...(found.interp.args || []), '-c', PROBE_SCRIPT, arg], { env, timeout: timeoutMs });
  if (r.timedOut) return { status: 'error', error: `the harness did not answer within ${Math.round(timeoutMs / 1000)}s` };
  if (r.spawnError) return { status: 'error', error: stripAbsolutePaths(`could not start the harness's Python (${r.spawnError})`) };
  const line = String(r.stdout || '').split(/\r?\n/).reverse().find((l) => l.startsWith(SENTINEL));
  if (!line) {
    const tail = String(r.stderr || '').trim().split(/\r?\n/).filter(Boolean).pop() || `exit ${r.code}`;
    return { status: 'error', error: stripAbsolutePaths(`the harness gave no answer (${tail.slice(0, 200)})`) };
  }
  let doc;
  try { doc = JSON.parse(line.slice(SENTINEL.length)); } catch (err) {
    return { status: 'error', error: `unreadable harness answer (${err.message})` };
  }
  if (doc.error) return { status: 'error', error: stripAbsolutePaths(String(doc.error)) };
  return { status: 'ok', ...doc };
}

/** The harness's Python, as the plan names it (where an install must go). */
function pythonLabel(probe) {
  return probe?.python ? `the Python \`mt-eval\` runs (${displayPath(probe.python)})` : 'the Python `mt-eval` runs';
}

/** One metric's state from the probe: 'ok' | 'missing' | 'unknown', with the record. */
function stateOf(probe, key) {
  if (!probe || probe.status !== 'ok') return { state: 'unknown', why: probe?.error || 'the harness was not asked' };
  const rec = probe[key];
  if (!rec) return { state: 'unknown', why: 'the harness gave no answer for it' };
  if (rec.error) return { state: 'unknown', why: `its check failed (${stripAbsolutePaths(rec.error)})` };
  if (key === 'fuse') return { state: rec.available && rec.phonetic ? 'ok' : 'missing', rec };
  return { state: rec.available ? 'ok' : 'missing', rec };
}

/** What a metric's absence is, in words: the missing pieces, or the harness's reason. */
function missingWhat(key, rec) {
  const pieces = Array.isArray(rec.missing) ? rec.missing : [];
  return pieces.length ? `missing ${pieces.join(', ')}` : 'installed but does not import in that Python';
}

/**
 * COMET's absence and the way out, from the harness's own reason: "not
 * installed — mt-eval setup --comet" gets the install's size; any other
 * reason (Python 3.14, an install that does not import) is relayed as the
 * harness says it — `setup --comet` would not fix those.
 */
function cometMissing(rec) {
  const reason = String(rec.reason || 'unbabel-comet does not import');
  const m = /^(.*?)\s+—\s+mt-eval setup --comet\s*$/.exec(reason);
  return m
    ? `${m[1]} — \`mt-eval setup --comet\` installs it (${METRIC_COSTS.comet}; the user's call, in a terminal)`
    : reason;
}

/**
 * The plan's metric lines: COMET always (it runs whenever installed), each
 * requested opt-in metric with what it needs and costs, and one line naming
 * the opt-ins when none was asked for.
 *
 * @param {object} probe  probeMetrics's answer
 * @param {{comet?: boolean, metricx?: boolean, fuse?: boolean, metricxModel?: string|null}} [want]
 * @returns {string[]}
 */
export function metricsPlanLines(probe, { comet = false, metricx = false, fuse = false, metricxModel = null } = {}) {
  const lines = [];
  const where = pythonLabel(probe?.status === 'ok' ? probe : null);
  const refuse = 'A confirmed run is REFUSED until it is (nothing is spent) — or drop the argument to score without it.';

  const c = stateOf(probe, 'comet');
  if (c.state === 'ok') {
    const model = c.rec.model || c.rec.defaultModel;
    lines.push(`COMET:    computed — unbabel-comet imports in ${where}; model ${model}`
      + `${model === c.rec.defaultModel ? ' (about 2.3 GB, downloaded on first use)' : ' (the target\'s card names it; downloaded on first use)'}; `
      + `${LOCAL}.${comet ? ' (comet: true — required, and available.)' : ''}`);
  } else if (c.state === 'missing') {
    lines.push(comet
      ? `⚠ COMET:  comet: true, but it is NOT available in ${where}: ${cometMissing(c.rec)}. ${refuse}`
      : `COMET:    not computed — ${cometMissing(c.rec)}. The run card marks COMET not computed; comet: true `
        + 'makes the run wait for it instead.');
  } else {
    lines.push(`COMET:    cannot tell whether it will be computed — ${c.why}. The harness computes it whenever `
      + `unbabel-comet is installed and the run card says when it is not${comet ? '; comet: true is checked again when the run is confirmed' : ''}.`);
  }

  const optIn = [
    ['metricx', metricx, 'MetricX-24', '--metricx', 'a lower-is-better neural error score (0–25)'],
    ['fuse', fuse, 'the FUSE-style comparator', '--fuse', 'untrained (an unweighted mean of its parts; flagged fuse_untrained)'],
  ];
  for (const [key, asked, name, flag, what] of optIn) {
    if (!asked) continue;
    const label = key === 'metricx' ? 'MetricX:  ' : 'FUSE:     ';
    const s = stateOf(probe, key);
    const model = key === 'metricx'
      ? (metricxModel ? `checkpoint ${metricxModel} (--metricx-model)` : `checkpoint ${s.rec?.defaultModel || 'google/metricx-24-hybrid-large-v2p6'}`)
      : `model ${s.rec?.model || 'sentence-transformers/LaBSE'}`;
    if (s.state === 'ok') {
      lines.push(`${label}requested (${flag}${key === 'metricx' && metricxModel ? ' --metricx-model' : ''}) — installed in ${where}; `
        + `${model}; ${METRIC_COSTS[key]}. ${name} is ${what}; ${LOCAL}.`);
    } else if (s.state === 'missing') {
      const install = (s.rec.install || []).join(' && ');
      lines.push(`⚠ ${label.trim()} requested (${flag}), but ${name} is NOT available in ${where}: ${missingWhat(key, s.rec)}. `
        + `To add it (the user's call, in a terminal, into that Python): ${install || 'see the harness spec'}; then ${METRIC_COSTS[key]}. ${refuse}`);
    } else {
      lines.push(`${label}requested (${flag}) — whether it is installed could not be checked (${s.why}); the flag is passed, `
        + `and if ${name} cannot load the run card marks it not computed.`);
    }
  }
  if (!metricx && !fuse) {
    lines.push('Opt-in:   MetricX-24 (metricx: true) and the FUSE-style comparator (fuse: true) are off — each loads a '
      + 'large model on this machine; the run card says "not run" for them.');
  }
  return lines;
}

/**
 * The refusal for a confirmed run that asked for a metric the harness here
 * definitely cannot compute — null when every requested metric is available
 * or could not be checked (the flag still goes to the harness, which reports
 * an absence on the run card).
 *
 * @returns {string|null}
 */
export function metricsRefusal(probe, { comet = false, metricx = false, fuse = false, metricxModel = null } = {}) {
  const missing = [
    comet && stateOf(probe, 'comet').state === 'missing' && 'COMET',
    metricx && stateOf(probe, 'metricx').state === 'missing' && 'MetricX-24',
    fuse && stateOf(probe, 'fuse').state === 'missing' && 'the FUSE-style comparator',
  ].filter(Boolean);
  if (!missing.length) return null;
  const lines = metricsPlanLines(probe, { comet, metricx, fuse, metricxModel }).filter((l) => l.startsWith('⚠'));
  return [`REFUSED — the run asks for ${missing.join(' and ')}, which the harness here cannot compute, so nothing was `
    + 'run or spent. A requested metric is never dropped silently.', '', ...lines, '',
  'Show the user the install step (their call, in a terminal), then confirm again; or call again without that '
    + 'argument to score without it (the run card marks it not computed).'].join('\n');
}
