/**
 * What a publish would put on the public board — asked of the harness BEFORE
 * the run, and acknowledged in words before a real publish.
 *
 * The harness's own `mt-eval publish <report> --dry-run` says, per run, that
 * N rows WITH their source, reference and output text go to the public
 * run_card_entries table (or that the text is withheld, scores only), and
 * that the system/coaching prompt is published with the card unless it is
 * redacted. `run_benchmark { publish: true }` used to show only the command
 * and the target (synthetic researcher, Round 6), so an agent following it
 * would never tell the user any of that.
 *
 * A dry-run publish needs a finished report, which a plan does not have. So
 * this asks the same two gates the publish step applies — publish.
 * _entry_content_publishable (sentence text vs scores only: the steward's
 * local-only mark, the registry entry's licence and segment) and publish.
 * _coaching_prompt_content_gate (a local-only corpus redacts a coached
 * prompt by default) — through the harness Python that `mt-eval` on PATH
 * runs, bounded, no shell. The publish step itself re-applies both to the
 * finished report (and refuses a coaching prompt that embeds the corpus's
 * pairs); its preview lines land in the job output.
 *
 * When the harness cannot answer (an old version, an error), a real publish
 * is REFUSED with how to see the facts instead — never published blind.
 */

import { readFileSync } from 'node:fs';

import { whichSync } from './forge.js';
import { interpreterFromLauncher, runBounded } from './harness-fst.js';

export const PUBLISH_PROBE_TIMEOUT_MS = 20_000;
const SENTINEL = 'CHAMPOLLION_PUBLISH_PROBE ';

const PROBE_SCRIPT = `
import contextlib, io, json, sys
def emit(doc):
    sys.stdout.write(${JSON.stringify(SENTINEL)} + json.dumps(doc) + "\\n")
try:
    from mt_eval_harness import publish as P
except Exception as exc:
    emit({"error": "the harness does not import: %s: %s" % (type(exc).__name__, exc)})
    sys.exit(0)
need = [n for n in ("_entry_content_publishable", "_lookup_registry_entry",
                    "_coaching_prompt_content_gate") if not hasattr(P, n)]
if need:
    emit({"error": "this mt-eval-harness predates the publish gates the preview asks (%s) — upgrade it" % ", ".join(need)})
    sys.exit(0)
a = json.loads(sys.argv[1])
entry = P._lookup_registry_entry(a.get("dataset_id") or "")
allow, why = P._entry_content_publishable(
    entry, scores_only=False, override=False, local_only=bool(a.get("local_only")))
prompt = None
if a.get("prompt"):
    coached = bool(a.get("coached"))
    card = {"system_prompt_used": "x", "system_prompt_sha256": "",
            "condition": "coached" if coached else "naive",
            "coaching_data_sha256": "c" if coached else None}
    buf = io.StringIO()
    try:
        with contextlib.redirect_stdout(buf):
            red = P._coaching_prompt_content_gate(
                card, [], entry, redact=False, local_only=bool(a.get("local_only")))
    except SystemExit:
        red = None
    prompt = {"redacted": red}
emit({"entries": {"allowed": bool(allow), "why": why},
      "registered": entry is not None, "prompt": prompt})
`;

/**
 * Ask the harness what a publish of this run would expose. Never throws.
 *
 * @param {{datasetId: string|null, localOnly: boolean, prompt: boolean, coached: boolean}} input
 * @param {object} [deps]  env, which, readLauncher, python ({cmd, args}), run, timeoutMs
 * @returns {Promise<{status: 'ok', entries: {allowed: boolean, why: string}, registered: boolean,
 *   prompt: {redacted: string|null}|null} | {status: 'error', error: string}>}
 */
export async function probePublishGates(input, {
  env = process.env,
  which = (cmd) => whichSync(cmd, env),
  readLauncher = (p) => readFileSync(p, 'utf8').slice(0, 4096),
  python = null,
  run = runBounded,
  timeoutMs = PUBLISH_PROBE_TIMEOUT_MS,
} = {}) {
  let interp = python;
  if (!interp) {
    const launcher = which('mt-eval');
    if (!launcher) return { status: 'error', error: 'no `mt-eval` on PATH' };
    let head = '';
    try { head = readLauncher(launcher); } catch { head = ''; }
    interp = interpreterFromLauncher(head) || (env.PYTHON_BIN ? { cmd: env.PYTHON_BIN, args: [] } : null);
    if (!interp) return { status: 'error', error: 'could not tell which Python `mt-eval` runs (set PYTHON_BIN to it)' };
  }
  const arg = JSON.stringify({
    dataset_id: input.datasetId || '', local_only: input.localOnly === true,
    prompt: input.prompt === true, coached: input.coached === true,
  });
  const r = await run(interp.cmd, [...(interp.args || []), '-c', PROBE_SCRIPT, arg], { env, timeout: timeoutMs });
  if (r.timedOut) return { status: 'error', error: `the harness did not answer within ${Math.round(timeoutMs / 1000)}s` };
  if (r.spawnError) return { status: 'error', error: `could not start the harness's Python (${r.spawnError})` };
  const line = String(r.stdout || '').split(/\r?\n/).reverse().find((l) => l.startsWith(SENTINEL));
  if (!line) {
    const tail = String(r.stderr || '').trim().split(/\r?\n/).filter(Boolean).pop() || `exit ${r.code}`;
    return { status: 'error', error: `the harness gave no answer (${tail.slice(0, 200)})` };
  }
  let doc;
  try { doc = JSON.parse(line.slice(SENTINEL.length)); } catch (err) {
    return { status: 'error', error: `unreadable harness answer (${err.message})` };
  }
  if (doc.error) return { status: 'error', error: String(doc.error) };
  return {
    status: 'ok',
    entries: { allowed: doc.entries?.allowed === true, why: String(doc.entries?.why || '') },
    registered: doc.registered === true,
    prompt: doc.prompt && typeof doc.prompt === 'object' ? { redacted: doc.prompt.redacted ?? null } : null,
  };
}

/**
 * The facts a publish would expose, and the exact acknowledgement the user
 * gives before a real publish. `kind`: 'run' (an item or corpus run, gated
 * by the probe) or 'queue' (many items, each gated by the harness).
 *
 * @returns {{ok: boolean, lines: string[], ack: string|null, error?: string}}
 */
export function publishFacts({ kind, probe, target, methodRun = false, coached = false }) {
  const where = target.prod ? 'production' : 'non-production';
  if (kind === 'queue') {
    return {
      ok: true,
      ack: `publish to ${where}: queue results`,
      lines: [
        'WHAT GETS PUBLISHED (the harness decides per item, at publish time):',
        `  • each item's run card — its scores — goes to ${target.label}`,
        '  • sentence text (source, reference, the model\'s output) goes to the PUBLIC run_card_entries table',
        '    only for a corpus whose licence clears redistribution; NC / restricted / sealed corpora publish scores only',
        '  • each card carries the harness\'s own prompt template (it names only the languages) — queue items are never coached',
      ],
    };
  }
  if (!probe || probe.status !== 'ok') {
    return {
      ok: false,
      ack: null,
      error: probe?.error || 'the harness was not asked',
      lines: [
        `WHAT GETS PUBLISHED: could not be checked — ${probe?.error || 'the harness was not asked'}.`,
        '  A publish from this tool is refused until it can be: run WITHOUT publish, then call preview_publish',
        '  on the finished report — it asks the harness\'s own `mt-eval publish <report> --dry-run` which rows',
        '  and which prompt would go public (read-only) — and publish_report publishes only with the user\'s',
        '  exact acknowledgement.',
      ],
    };
  }
  const text = probe.entries.allowed;
  const promptState = methodRun || !probe.prompt ? 'none'
    : (probe.prompt.redacted ? 'redacted' : 'published');
  const lines = [
    'WHAT GETS PUBLISHED (the harness\'s own publish gates, asked before the run — the publish step',
    'applies them again to the finished report, and the job output shows its "Entries:" / "Prompt:" lines):',
    `  • the run card — scores, model, settings — goes to ${target.label}`,
    text
      ? `  • EVERY row WITH its source, reference and model output text goes to the PUBLIC run_card_entries table (${probe.entries.why})`
      : `  • sentence text is WITHHELD — scores only (${probe.entries.why})`,
    promptState === 'none'
      ? '  • no prompt: the method translates by itself'
      : promptState === 'redacted'
        ? `  • the ${coached ? 'coaching' : 'system'} prompt is REDACTED on the card — only its sha256 is published (${probe.prompt.redacted})`
        : coached
          ? '  • the coaching file\'s FULL TEXT is published with the card as its prompt — also when sentence text is withheld; '
            + 'the publish step refuses it if it embeds this corpus\'s source/reference pairs (a restricted corpus); to '
            + 'publish only its sha256, run without publish, then preview_publish and publish_report with redact_coaching: true'
          : '  • the harness\'s own prompt template (it names only the languages) is published with the card',
  ];
  const ack = `publish to ${where}: ${text ? 'sentence text' : 'scores only'}, `
    + `${promptState === 'none' ? 'no prompt' : `prompt ${promptState}`}`;
  return { ok: true, lines, ack };
}

/** The lines asking for the acknowledgement (plan) or refusing without it (real run). */
export function ackLines(facts, { refused = false, given = null } = {}) {
  if (!facts.ok) return [];
  const head = refused
    ? (given == null
      ? 'REFUSED — publish: true needs the user\'s acknowledgement of what goes public, in these exact words:'
      : `REFUSED — publish_ack ${JSON.stringify(given)} does not match what this run would publish. The exact words:`)
    : 'Before a real publish, show the user the lines above. If they agree, call again with confirm: true and:';
  return [head, `  publish_ack: ${JSON.stringify(facts.ack)}`];
}
