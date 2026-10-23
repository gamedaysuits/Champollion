/**
 * What a run_benchmark plan tells the user BEFORE they confirm, asked of the
 * harness the run will use: the corpus's licence and do_not_train terms (the
 * run passes `--yes`, which accepts the upstream licence when the harness
 * fetches the corpus), and whether the target language's evaluation pack is
 * installed (a missing FST is an advisory — the run proceeds, FST marked not
 * computed; any other missing piece stops the run before translating).
 *
 * Round 7: the plan passed `--yes` without naming what it accepted, and said
 * nothing about the Plains Cree pack (FST runtime + FST) — the first confirmed
 * run then failed on it. The harness's own `mt-eval run --dry-run` resolves
 * the corpus (a registry id may be FETCHED, under `--yes` accepting its
 * licence), so a plan must not run it; this asks the same pieces instead —
 * the registry entry the run would load (config.load_registry), and the
 * eval-pack gate the run applies (config._check_eval_pack, plus the FST gate
 * plugin discovery applies for a pinned FST) — through the Python the `mt-eval`
 * on PATH runs, bounded, no shell (harness-fst.js). Nothing is installed,
 * fetched or read from the corpus. A value the harness cannot give is
 * "unknown", never invented; a probe that fails says so and the run's own
 * gates still apply.
 */

import { harnessInterpreter, runBounded } from './harness-fst.js';
import { stripAbsolutePaths } from './harness.js';

export const RUN_PLAN_PROBE_TIMEOUT_MS = 25_000;
const SENTINEL = 'CHAMPOLLION_RUN_PLAN_PROBE ';

const PROBE_SCRIPT = `
import contextlib, io, json, sys
def emit(doc):
    sys.stdout.write(${JSON.stringify(SENTINEL)} + json.dumps(doc, default=str) + "\\n")
out = {}
try:
    from importlib.metadata import version as _version
    try:
        out["version"] = _version("mt-eval-harness")
    except Exception:
        out["version"] = None
    from mt_eval_harness import config as C
    from mt_eval_harness import language_cards as lc
except Exception as exc:
    emit({"error": "the harness does not import: %s: %s" % (type(exc).__name__, exc)})
    sys.exit(0)
a = json.loads(sys.argv[1])
entry = None
ds = a.get("dataset_id") or ""
if ds:
    try:
        reg = C.load_registry()
        for d in reg.get("datasets", []):
            if d.get("id") == ds or ds in (d.get("aliases") or []):
                entry = d
                break
        out["registered"] = entry is not None
    except Exception as exc:
        out["registryError"] = "%s: %s" % (type(exc).__name__, exc)
if entry is not None:
    out["entry"] = {k: entry.get(k) for k in ("id", "license", "access", "gated", "terms_url", "segment")}
    out["entry"]["do_not_train"] = entry["do_not_train"] if "do_not_train" in entry else "unstated"
# the code the run's own gates use: a registered corpus's entry (resolve_dataset
# checks the pack on it), else the --target-lang name (RunConfig resolves it)
code, frm = None, None
if entry is not None:
    res = entry.get("language_resolution") or {}
    code = (res.get("target") or {}).get("resolved") or (entry.get("language_pair") or {}).get("target")
    frm = "the corpus's registry entry" if code else None
name = (a.get("target_name") or "").strip()
if not code and name:
    try:
        code = lc.resolve_name(name) or None
        frm = "the target language name" if code else None
    except Exception:
        code = None
if not code and a.get("target_code"):
    code, frm = a["target_code"], a.get("target_code_from") or "the corpus card"
if code:
    try:
        lname = lc.get_name(code)
    except Exception:
        lname = None
    # the scripts the target's card lists, read through the harness's card
    # adapter (get_card normalizes it) — never a bare JSON read. A remote
    # (pip-install) card's list is the published projection's {name, source}
    # entries: script_codes reads every shape (older harness: name too).
    scripts = []
    try:
        card = lc.get_card(code)
        if hasattr(lc, "script_codes"):
            scripts = list(lc.script_codes(card or {}))
        else:
            for s in ((card or {}).get("scripts") or []):
                c = s if isinstance(s, str) else ((s or {}).get("code") or (s or {}).get("name"))
                if isinstance(c, str) and c and c not in scripts:
                    scripts.append(c)
    except Exception:
        scripts = None
    private_use = False
    try:
        private_use = bool(lc.is_private_use(code)) if hasattr(lc, "is_private_use") else False
    except Exception:
        private_use = False
    out["target"] = {"code": code, "name": lname, "from": frm, "scripts": scripts,
                     "privateUse": private_use}
    skip_fst = bool(a.get("skip_fst"))
    skip_std = bool(a.get("skip_eval_standard"))
    pack = {}
    withheld = bool(a.get("local_only"))
    if entry is not None and hasattr(C, "_registry_entry_is_sealed"):
        try:
            withheld = withheld or bool(C._registry_entry_is_sealed(entry))
        except Exception:
            pass
    gate_entry = dict(entry) if entry is not None else {"id": a.get("label") or "(this corpus)",
                                                        "language_pair": {"target": code}}
    if not hasattr(C, "_check_eval_pack"):
        pack["error"] = "this mt-eval-harness has no eval-pack check to ask (config._check_eval_pack) — upgrade it"
    else:
        buf = io.StringIO()
        try:
            with contextlib.redirect_stdout(buf):
                C._check_eval_pack(gate_entry, card_metrics_withheld=withheld,
                                   skip_fst=skip_fst, skip_eval_standard=skip_std)
            pack["message"] = None
        except RuntimeError as exc:
            pack["message"] = str(exc)
        except TypeError as exc:
            pack["error"] = "this mt-eval-harness's eval-pack check predates --skip-fst / --skip-eval-standard (%s) — upgrade it" % exc
        except Exception as exc:
            pack["error"] = "the eval-pack check failed: %s: %s" % (type(exc).__name__, exc)
        pack["notes"] = [l.strip() for l in buf.getvalue().splitlines() if l.strip()]
    # the dry run's own report of the same check (mt-eval run --dry-run
    # prints exactly these lines), when this harness has it — one wording
    if hasattr(C, "eval_pack_status") and hasattr(C, "eval_pack_lines"):
        try:
            st = C.eval_pack_status(gate_entry, card_metrics_withheld=withheld,
                                    skip_fst=skip_fst, skip_eval_standard=skip_std)
            pack["harnessStatus"] = st.get("status")
            # None from a harness older than the FST advisory (2026-10-04):
            # there every missing piece stopped the run
            pack["harnessStopsRun"] = st.get("stops_run")
            if isinstance(st.get("fst"), dict):
                pack["fstLine"] = st["fst"].get("line")
            # a code with no card (private use, qaa-qtz) has no card name, and
            # the harness then labels the language by its code alone: the name
            # the run's prompt uses (target_language) is its name. Only the
            # label changes; the verdict is the harness's.
            shown = st
            if not lname and name and st.get("language_name") in (None, code):
                shown = dict(st, language_name=name)
            pack["harnessLines"] = list(C.eval_pack_lines(
                shown, blocks_run=True, language_label=lname or name or code))
        except Exception as exc:
            pack["harnessLinesError"] = "%s: %s" % (type(exc).__name__, exc)
    try:
        pin = lc.get_fst_install_info(code)
    except Exception:
        pin = None
    pack["fstPinned"] = pin is not None
    if pin is not None:
        pack["fstRepo"] = pin.get("repo") or pin.get("name")
        # the analyzer and its runtime as the harness's own fst_state reads
        # them (it imports pyhfst, as the run will) — the reading the
        # overview, setup --status and forge use; the older checks only for
        # a harness without it (Round 13)
        st = None
        if hasattr(C, "fst_state"):
            try:
                st = C.fst_state(code)
            except Exception:
                st = None
        if isinstance(st, dict):
            pack["fstInstalled"] = bool(st.get("analyzer_installed"))
            pack["pyhfst"] = bool(st.get("runtime_installed"))
            pack["runtimeFrom"] = "fst_state"
        else:
            try:
                from mt_eval_harness.plugins import fst_installer as fi
                pack["fstInstalled"] = bool(fi.is_fst_installed(code))
            except Exception:
                pack["fstInstalled"] = None
            try:
                import importlib.util as _util
                pack["pyhfst"] = _util.find_spec("pyhfst") is not None
            except Exception:
                pack["pyhfst"] = None
            pack["runtimeFrom"] = "find_spec"
    try:
        declared = lc.get_eval_pack(code)
    except Exception:
        declared = None
    pack["declared"] = bool(declared)
    pack["description"] = (declared or {}).get("description")
    out["evalPack"] = pack
# What the model will be told: the harness's own prompt builder
# (prompt_plan.plan_for) on the run's inputs. The built-in prompt comes back
# whole (the harness's template and the language names); a coaching file by
# its first line (withheld for a local-only corpus), hash and length only —
# never its text. A file corpus's references are read for their SCRIPT SHARE
# only — an aggregate; no sentence is emitted.
pp = a.get("prompt")
if isinstance(pp, dict):
    try:
        from mt_eval_harness import prompt_plan as PP
    except Exception as exc:
        out["prompt"] = {"unavailable": "this mt-eval-harness cannot preview the prompt (%s: %s) — upgrade it; the run header prints it" % (type(exc).__name__, exc)}
    else:
        try:
            tc = pp.get("target_code") or ""
            sc = pp.get("source_code") or ""
            if entry is not None:
                lp = entry.get("language_pair") or {}
                res = entry.get("language_resolution") or {}
                if not isinstance(lp, dict):
                    lp = {}
                tc = tc or (res.get("target") or {}).get("resolved") or lp.get("target") or ""
                sc = sc or (res.get("source") or {}).get("resolved") or lp.get("source") or ""
            # the code the plan resolved above (from the name, the entry or the file)
            tc = tc or (code or "")
            plan = PP.plan_for(target_lang=pp.get("target_lang") or "", source_lang=pp.get("source_lang") or "",
                               target_code=tc, source_code=sc, coaching_file=pp.get("coaching_file") or "",
                               target_script=pp.get("target_script") or "", corpus_path=pp.get("corpus_path") or "",
                               source_field=pp.get("source_field") or "", target_field=pp.get("target_field") or "")
            keep = ("kind", "sha256", "chars", "coaching_file", "replaces_builtin", "builtin", "first_line", "script_line",
                    "names_target", "named_as", "target_lang", "source_lang", "target_resolution", "notes", "error", "script")
            shown = {k: plan.get(k) for k in keep if k in plan}
            if plan.get("kind") == "naive":
                shown["text"] = plan.get("text")
            if a.get("local_only"):
                shown.pop("first_line", None)
            shown["target_code"] = tc or None
            out["prompt"] = shown
        except Exception as exc:
            out["prompt"] = {"error": "%s: %s" % (type(exc).__name__, exc)}
emit(out)
`;

/**
 * Ask the harness for the facts a plan names. Never throws.
 *
 * @param {object} input
 * @param {string|null} [input.datasetId]     a registry id (registry corpora and queue items)
 * @param {string|null} [input.targetName]    the run's --target-lang
 * @param {string|null} [input.targetCode]    a code the corpus card states (file runs)
 * @param {boolean} [input.localOnly]         the steward's local-only mark
 * @param {boolean} [input.skipFst]
 * @param {boolean} [input.skipEvalStandard]
 * @param {object} [deps]  env, which, readLauncher, python, run, timeoutMs
 * @returns {Promise<{status: 'ok', version: string|null, registered?: boolean, registryError?: string,
 *   entry?: object, target?: {code: string, name: string|null, from: string}, evalPack?: object}
 *   | {status: 'not-installed'|'error', error: string}>}
 */
export async function probeRunPlan(input, {
  env = process.env, which, readLauncher, python = null, run = runBounded,
  timeoutMs = RUN_PLAN_PROBE_TIMEOUT_MS,
} = {}) {
  const found = harnessInterpreter({ env, ...(which ? { which } : {}), ...(readLauncher ? { readLauncher } : {}), python });
  if (!found.interp) return { status: found.status, error: found.error || found.how };
  const arg = JSON.stringify({
    dataset_id: input.datasetId || '', target_name: input.targetName || '',
    target_code: input.targetCode || '', target_code_from: input.targetCodeFrom || '',
    local_only: input.localOnly === true, skip_fst: input.skipFst === true,
    skip_eval_standard: input.skipEvalStandard === true, label: input.label || '',
    prompt: input.prompt ? {
      target_lang: input.prompt.targetLang || '', target_code: input.prompt.targetCode || '',
      source_lang: input.prompt.sourceLang || '', source_code: input.prompt.sourceCode || '',
      coaching_file: input.prompt.coachingFile || '', target_script: input.prompt.targetScript || '',
      corpus_path: input.prompt.corpusPath || '', source_field: input.prompt.sourceField || '',
      target_field: input.prompt.targetField || '',
    } : null,
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

// ---------------------------------------------------------------------------
// Rendering
// ---------------------------------------------------------------------------

const SKIP_ARGS = {
  '--skip-fst': 'skip_fst: true (no FST acceptance)',
  '--skip-eval-standard': 'skip_eval_standard: true (no eval-standard metrics)',
};

/** The pieces of the harness's own "EVAL PACK REQUIRED" message. */
export function parseEvalPackMessage(message) {
  const lines = String(message || '').split('\n').map((l) => l.trim());
  const missing = lines.filter((l) => l.startsWith('✗ ')).map((l) => l.slice(2).trim());
  const commands = [];
  const i = lines.findIndex((l) => /^Install them/.test(l));
  if (i >= 0) {
    for (const l of lines.slice(i + 1)) {
      if (!l) break;
      commands.push(l);
    }
  }
  const skips = lines.map((l) => /^(--skip-[a-z-]+)/.exec(l)?.[1]).filter(Boolean);
  return { missing, commands, skips };
}

/**
 * The plan's eval-pack lines, in the vocabulary the harness's own dry run
 * prints (`EVAL PACK: missing — …; set it up with: …` / `EVAL PACK: ready
 * (…)` / `EVAL PACK: none needed for …`).
 *
 * @param {object} probe  probeRunPlan's answer
 * @param {{skipFst?: boolean, skipEvalStandard?: boolean, targetName?: string|null}} [opts]
 *   targetName: the target_language the run passes (--target-lang) — the
 *   language's name when no card gives one.
 * @returns {{state: 'missing'|'ready'|'none'|'unknown', lines: string[]}}
 */
export function evalPackPlanLines(probe, { skipFst = false, skipEvalStandard = false, targetName = null } = {}) {
  const atRunStart = 'The harness checks it again when the run starts: a missing FST (analyzer or pyhfst runtime) '
    + 'never stops the run — FST acceptance is marked not computed; any other missing piece stops it before '
    + 'translating (nothing is spent); skip_fst / skip_eval_standard score without those pieces.';
  if (!probe || probe.status !== 'ok') {
    return { state: 'unknown', lines: [`EVAL PACK: cannot tell — asking the harness failed (${probe?.error || 'no answer'}). ${atRunStart}`] };
  }
  const given = typeof targetName === 'string' && targetName.trim() ? targetName.trim() : null;
  const t = probe.target;
  if (!t?.code) {
    // A name WAS given and resolves to no card (Round 8 hospital persona: "Ayta
    // (variety not yet confirmed)") — telling the user to pass target_language
    // again was advice they had already followed. The harness's own words for
    // this case, and why: the run's gate resolves the same name the same way.
    if (given) {
      return { state: 'none', lines: [
        `EVAL PACK: none needed for "${given}" (no language card resolved for the target) — the harness resolves `
          + 'no code from that target_language and the corpus states none, so no card declares evaluation tools '
          + 'for it; the prompt names the language as given.',
        '  If it is a language with a card under another name, search_languages finds the name or code the card uses.',
      ] };
    }
    return { state: 'unknown', lines: ['EVAL PACK: not checked — the plan names no target language the harness can resolve; '
      + 'pass target_language (e.g. "Plains Cree") so the language\'s evaluation tools are checked before the run.'] };
  }
  // A code with no card name (a private-use code, qaa–qtz, has no card at
  // all): the name the caller passed IS the language's name.
  const shownName = t.name || given;
  const lang = shownName ? `${shownName} (${t.code})` : t.code;
  const p = probe.evalPack || {};
  if (p.error) return { state: 'unknown', lines: [`EVAL PACK: cannot tell for ${lang} — ${p.error}. ${atRunStart}`] };

  // The FST gate plugin discovery applies for a pinned FST, pack or no pack
  // — a gap the card's evalPack check alone may not list.
  const fstGap = p.fstPinned && !skipFst && (p.fstInstalled === false || p.pyhfst === false);
  if (Array.isArray(p.harnessLines) && p.harnessLines.length && !p.error
      && !(fstGap && p.harnessStatus !== 'missing')) {
    // the harness's own dry-run lines for the same check: one wording
    const state = { missing: 'missing', ready: 'ready', not_needed: 'none' }[p.harnessStatus] || 'unknown';
    const notes = (p.notes || []).map((n) => `  ${n.replace(/^Note:\s*/, 'Note: ')}`);
    // Only the FST lane missing (harness 2026-10-04+): the run PROCEEDS, the
    // FST marked not computed — the plan must not read as a stop (Round 8:
    // a school's agent host refused both the install and skip_fst, and got
    // no baseline at all while the harness would stop).
    const advisoryOnly = state === 'missing' && p.harnessStopsRun === false;
    const how = state !== 'missing' ? []
      : advisoryOnly
        ? ['  The run PROCEEDS without it — FST acceptance and morphology are marked not computed on its card; '
          + 'nothing is downloaded. Installing is the user\'s call (the command says what it installs; run it in a '
          + 'terminal); afterwards `mt-eval test <run log>` adds the FST score to the finished run without '
          + 're-translating. skip_fst: true only leaves this notice out.']
        : ['  The install is the user\'s call (the command says what it installs; run it in a terminal); '
          + 'or score without it — skip_fst / skip_eval_standard (the run card marks those metrics not computed).'];
    return { state, lines: [...p.harnessLines.map(stripAbsolutePaths), ...how, ...(state === 'missing' ? [] : notes)] };
  }

  const parsed = parseEvalPackMessage(p.message);
  const missing = [...parsed.missing];
  const commands = [...parsed.commands];
  const skips = new Set(parsed.skips);
  // The FST gate plugin discovery applies for a pinned FST, pack or no pack.
  if (p.fstPinned && !skipFst) {
    const mentionsFst = missing.some((m) => /\bFST\b/.test(m));
    if (p.fstInstalled === false && !mentionsFst) {
      missing.push(`the ${t.name || t.code} FST (${p.fstRepo || 'the pinned build'})`);
      commands.push(`mt-eval setup --lang ${t.code}`);
      skips.add('--skip-fst');
    }
    if (p.pyhfst === false && !missing.some((m) => /pyhfst/.test(m))) {
      missing.push('the FST runtime (pyhfst)');
      commands.push(`mt-eval setup --lang ${t.code}`);
      skips.add('--skip-fst');
    }
  }
  const notes = (p.notes || []).map((n) => `  ${n.replace(/^Note:\s*/, 'Note: ')}`);
  if (missing.length || p.message) {
    const cmds = [...new Set(commands)];
    const head = `EVAL PACK: missing — ${missing.length ? missing.join(', ') : 'see the harness message below'}`
      + `${cmds.length ? `; set it up with: ${cmds.join(' && ')}` : ''}`;
    const how = [...skips].map((f) => SKIP_ARGS[f] || f);
    return {
      state: 'missing',
      lines: [
        head,
        `  for ${lang}. Without it the run STOPS before translating (nothing is spent). The install is the user's`
          + ' call (the command says what it installs; run it in a terminal).'
          + (how.length ? ` Or score without it — the run card marks it not computed: ${how.join(', ')}.` : ''),
        ...(missing.length ? [] : String(p.message).split('\n').filter((l) => l.trim()).map((l) => `  ${stripAbsolutePaths(l.trim())}`)),
        ...notes,
      ],
    };
  }
  if (!p.declared && !p.fstPinned) {
    return { state: 'none', lines: [`EVAL PACK: none needed for ${lang}`, ...notes] };
  }
  const parts = [
    p.fstPinned && (skipFst
      ? 'FST skipped (skip_fst — FST acceptance marked not computed)'
      : `FST ${p.fstRepo || 'pinned build'} installed${p.pyhfst ? ', runtime pyhfst' : ''}`),
    p.declared && !skipEvalStandard && (p.description || 'the language card\'s evaluation pack'),
    skipEvalStandard && 'eval-standard metrics skipped (skip_eval_standard — marked not computed)',
  ].filter(Boolean);
  return { state: 'ready', lines: [`EVAL PACK: ready for ${lang} (${parts.join('; ')})`, ...notes] };
}

/**
 * The plan's script lines (Round 9: Plains Cree is written in Cans syllabics
 * and Latn SRO; translate/sync refuse crk until one is chosen, but a benchmark
 * neither asked nor told the model, and a model writing the other script
 * scores near zero for the wrong reason). The scripts come from the
 * harness's card adapter (the run-plan probe), never a bare card read.
 *
 * @param {object} probe  probeRunPlan's answer
 * @param {{script?: {code: string, from: string}|null, methodRun?: boolean}} [opts]
 * @returns {string[]}
 */
export function scriptPlanLines(probe, { script = null, methodRun = false } = {}) {
  const t = probe?.status === 'ok' ? probe.target : null;
  const scripts = Array.isArray(t?.scripts) ? t.scripts : [];
  const lang = t ? (t.name ? `${t.name} (${t.code})` : t.code) : 'the target';
  // The references' own script, read by the harness as an aggregate share
  // (Round 11 Cree school: the persona inferred SRO by counting letters in
  // its training pairs, since it must not read its test file).
  const refs = probe?.status === 'ok' ? probe.prompt?.script : null;
  if (!script?.code && !methodRun && refs && !refs.error && refs.shares && Object.keys(refs.shares).length) {
    const pct = (x) => `${Math.round(x * 100)}%`;
    const shown = Object.entries(refs.shares).sort((x, y) => y[1] - x[1])
      .filter(([, v]) => Math.round(v * 100) > 0).map(([c, v]) => `${pct(v)} ${c}`).join(', ');
    const listed = (refs.card_scripts || scripts).join(', ');
    return [refs.chosen
      ? `Script:   ${refs.chosen} — the references are ${shown} (counted on this machine over their letters; no `
        + `sentence is shown), so the prompt asks for ${refs.chosen}; the ${lang} card lists ${listed}. The harness `
        + 'reads them the same way when the run starts, says so in its header and records it on the run log. '
        + 'Pass script to choose another.'
      : `⚠ Script: the ${lang} card lists ${listed} and the references are mixed (${shown}) — no script is asked `
        + 'for, so the model picks one. Ask the user which script the references should be scored in, and pass script.'];
  }
  if (script?.code) {
    const listed = scripts.length && !scripts.includes(script.code)
      ? ` — but the ${lang} card lists ${scripts.join(', ')}: the harness REFUSES ${script.code} before `
        + 'translating (nothing is spent); pass one of those'
      : '';
    return [`Script:   ${script.code} — from ${script.from}; the prompt asks for it (--target-script)${listed}.`];
  }
  if (scripts.length < 2) return [];
  if (methodRun) {
    return [`Script:   ${lang} is written in ${scripts.length} scripts per its card (${scripts.join(', ')}); a `
      + 'method writes whatever script it writes — check its output is in the script your references use, '
      + 'or the scores measure the script mismatch, not the translation.'];
  }
  return [
    `⚠ Script: ${lang} is written in ${scripts.length} scripts per its card (${scripts.join(', ')}) and this run `
      + 'names none. When the run loads the references the harness counts their letters by script (an '
      + 'aggregate — no sentence is shown) and prompts for the one that holds 90% or more, saying so in the run '
      + 'header; if they are mixed it asks for none and the model picks — a reference in the other script then '
      + `scores near zero for the wrong reason. To be sure, ask the user which script the test set's references `
      + `are written in and pass script (${scripts.map((x) => `"${x}"`).join(' or ')}).`,
  ];
}

/** What the plan says in place of a coaching file's first line on a local-only corpus — and why. */
export const COACHING_LINE_WITHHELD = 'its first line is not shown — the corpus is marked local-only, and a '
  + 'coaching file can be built from the corpus\'s own sentences (examples or a glossary cut from it), so none '
  + 'of its text is shown for a protected corpus';

/**
 * The plan's prompt lines: what the model will be told, from the harness's
 * own prompt builder (the run-plan probe's `prompt`, prompt_plan.plan_for) —
 * the built-in prompt whole; a coaching file by its first line (withheld for
 * a local-only corpus, with the reason: COACHING_LINE_WITHHELD) and hash,
 * with the fact that it REPLACES the built-in prompt and one verdict on
 * whether it names the target language (coachingVerdict; Round 11 researcher:
 * neither the plan nor the run card showed the prompt, and a code reached it
 * word for word).
 *
 * @param {object} probe  probeRunPlan's answer
 * @param {{localOnly?: boolean}} [opts]
 * @returns {string[]}
 */
export function promptPlanLines(probe, { localOnly = false } = {}) {
  const p = probe?.status === 'ok' ? probe.prompt : null;
  if (!p) {
    return [`Prompt:   cannot preview — ${probe?.status === 'ok' ? 'the harness gave no prompt plan' : (probe?.error || 'asking the harness failed')}; `
      + 'the run header prints it (System prompt / Prompt text lines).'];
  }
  if (p.unavailable) return [`Prompt:   cannot preview — ${p.unavailable}.`];
  if (p.error) return [`Prompt:   cannot be built — ${p.error} (the run stops on it before translating).`];
  const sha = String(p.sha256 || '').slice(0, 12);
  const one = (t) => String(t || '').split(/\s+/).join(' ').trim();
  if (p.kind === 'naive') {
    return [`Prompt:   the harness's built-in prompt (sha256 ${sha}…): "${one(p.text)}"`];
  }
  if (p.kind === 'provider') return [`Prompt:   from a prompt plugin, ${p.chars} chars (sha256 ${sha}…).`];
  const name = String(p.coaching_file || 'the coaching file').split(/[\\/]/).pop();
  // Round 12 (synthetic school persona): the plan withheld the line without
  // saying why, which read as hiding the user's own instructions. The why: a
  // coaching file can be built from the corpus's own sentences (examples or a
  // glossary cut from the test set), so for a protected corpus none of its
  // text is shown — only its length and hash. Withheld on the mark alone,
  // whatever the probe returned.
  const first = localOnly
    ? `; ${COACHING_LINE_WITHHELD}`
    : (p.first_line ? `; first line: "${p.first_line}"` : '');
  return [
    `Prompt:   ${name} REPLACES the harness's built-in prompt — the model gets the file as written`
      + `${p.script_line ? ' plus the script line' : ''} (${p.chars} chars, sha256 ${sha}…${first}).`,
    coachingVerdict(p, name),
  ];
}

/** Case- and diacritic-insensitive form — the harness's prompt_plan._fold. */
function fold(text) {
  return String(text ?? '').normalize('NFD').replace(/\p{M}/gu, '').toLowerCase();
}

/**
 * ONE plain verdict on a coaching file — the harness's own
 * prompt_plan.coaching_verdict, same sentence: the built-in prompt it
 * replaces, and whether the file names the target language (✓ / ⚠), by the
 * name or code it matched (`named_as`). It used to print 'Not sent: "<built-in>"
 * — the file must say what the model needs' beside a separate warning, which
 * read as a failure even when the file named the language — and with the
 * first line withheld for a protected corpus, nobody could tell whether it
 * passed (synthetic Cree school, Round 13).
 *
 * @param {object} p     the run-plan probe's prompt plan (kind "coaching")
 * @param {string} name  the coaching file's name
 * @returns {string}
 */
export function coachingVerdict(p, name) {
  const replaces = `it replaces the built-in "${String(p.builtin || '').split(/\s+/).join(' ').trim()}"`;
  const who = p.target_lang || 'the target language';
  if (p.names_target === true) {
    const named = p.named_as || who;
    const said = fold(named) === fold(who) ? `names ${who}` : `names ${who} (as "${named}")`;
    return `✓ Coaching: ${name}: ${replaces} and ${said} — the model is told which language to write.`;
  }
  if (p.names_target === false) {
    const code = p.target_code && p.target_code !== who ? ` (${p.target_code})` : '';
    return `⚠ Coaching: ${name}: ${replaces} but names neither ${who} nor its code${code} — the model is never told `
      + 'which language to write. Name the language in the file.';
  }
  return `Coaching: ${name}: ${replaces}; no name or code is known for the target language, so whether the file `
    + 'names it was not checked.';
}

/**
 * The plan's licence and do_not_train lines for a REGISTERED corpus (a
 * registry id, or a queue item's corpus), from the harness's registry entry.
 *
 * @param {object} probe     probeRunPlan's answer
 * @param {string} datasetId
 * @param {{fallbackLicense?: string|null}} [opts]  a queue item's own corpus_license
 * @returns {string[]}
 */
export function registryTermsLines(probe, datasetId, { fallbackLicense = null } = {}) {
  const e = probe?.status === 'ok' ? probe.entry : null;
  if (!e) {
    const why = probe?.status !== 'ok'
      ? `asking the harness failed (${probe?.error || 'no answer'})`
      : probe.registryError
        ? `the harness's registry could not be read (${stripAbsolutePaths(probe.registryError)})`
        : `the harness's registry has no entry for ${datasetId}`;
    return [
      fallbackLicense
        ? `Licence:  ${fallbackLicense} — as the queue item states it; ${why}`
        : `Licence:  unknown — ${why}`,
      'Training: do_not_train unknown — the same reason; treat the corpus as evaluation-only until it is known',
    ];
  }
  const dnt = e.do_not_train;
  const fetched = e.access === 'fetch-from-source';
  return [
    `Licence:  ${e.license || 'unknown — the registry entry states none'} — the harness's registry entry for ${e.id}`
      + (fetched ? '; the run passes --yes, which ACCEPTS this licence when the harness fetches the corpus from its upstream'
        : '; the run passes --yes (it skips the harness\'s confirmation prompts)'),
    dnt === true
      ? 'Training: do_not_train: true — evaluation only: never put this corpus, or text derived from it, in a training mix'
      : dnt === false
        ? 'Training: do_not_train: false — the registry does not forbid training on it; its licence still governs any use'
        : 'Training: do_not_train unknown — the registry entry does not state it; treat the corpus as evaluation-only until it is known',
    ...(e.gated ? [`Access:   gated — needs its access token and terms${e.terms_url ? ` (${e.terms_url})` : ''}; `
      + '--yes does not accept those for the user'] : []),
  ];
}
