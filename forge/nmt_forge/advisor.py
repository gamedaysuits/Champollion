"""advisor — the stateful next-action driver (agent-first UX).

The static NEXT_STEPS.md tells an agent the generic recipe; this module
reads the ACTUAL workspace (registry roles, preregistrations, runs, ledger)
and answers the two questions a driving agent needs answered mechanically:

    nmt-forge status      where am I? (state table + THE next command)
    nmt-forge preflight X will command X refuse? (every gate, ✓/✗, with fixes)

Design rules:
  * Deterministic: same workspace state → same advice. No cleverness.
  * Every suggestion is an exact command string (placeholders in <angle
    brackets> only where the value is genuinely the user's, e.g. file paths).
  * ``--json`` output for agents; human rendering for terminals.
  * ``status`` never mutates anything and never reads corpus content. A run
    in progress (the workspace run lock, see :mod:`nmt_forge.runlock`) is a
    state of its own — ``training`` — whose advice never starts a run.
    A served model is the other live state: ``serving`` when the recorded
    server still answers (a pid check and one loopback ``/health`` request,
    :func:`serve_liveness` — Round 12), else the serve command again.
  * ``preflight run`` reads the training files and the test battery for ONE
    content-free count — the test rows with a near-twin in training — the
    same audited read leak-audit makes (ledgered as purpose ``audit``).
"""

from __future__ import annotations

import json
from dataclasses import dataclass, field
from pathlib import Path

from .workspace import Workspace

#: The ledger events `nmt-forge serve` writes: when it starts serving (its
#: address, pid and host — Round 12) and when it stops cleanly.
SERVE_EVENT = "serve"
SERVE_STOP_EVENT = "serve-stop"
_SERVE_KEYS = ("model_dir", "model", "url", "host", "port", "pid",
               "hostname", "started")


# -- state snapshot -----------------------------------------------------------

def snapshot(ws: Workspace) -> dict:
    """Content-free picture of the workspace: what exists, what's missing."""
    roles: dict[str, list[str]] = {"dev": [], "test": [], "sealed": []}
    for role in roles:
        try:
            roles[role] = ws.registry.names(roles=(role,))
        except Exception:
            roles[role] = []

    from .guards.preregister import after_reads_info

    preregs = []
    for f in sorted(ws.prereg_dir.glob("*.json")):
        try:
            data = json.loads(f.read_text())
            ev = data.get("eval_set") or data.get("eval") or ""
            if isinstance(ev, dict):          # prereg v1: {"name":…, "sha256":…}
                ev = ev.get("name", "")
            preregs.append({"id": f.stem, "eval": str(ev)})
        except Exception:
            preregs.append({"id": f.stem, "eval": "(unreadable)"})
        try:
            # written after scoring reads (--allow-after-reads): the size of
            # the override, said wherever this prereg's verdict is (Round 9)
            preregs[-1]["after_reads"] = after_reads_info(ws, f.stem)
        except Exception:
            preregs[-1]["after_reads"] = None

    runs = []
    # oldest first by when the manifest was written, so runs[-1] is the
    # NEWEST run — not the alphabetically last run directory
    run_dirs = (sorted((d for d in ws.runs_dir.iterdir() if d.is_dir()),
                       key=_manifest_mtime)
                if ws.runs_dir.exists() else [])
    for d in run_dirs:
        # `nmt-forge run` writes run-manifest.json; accept the bare name too
        man = d / "run-manifest.json"
        if not man.is_file():
            man = d / "manifest.json"
        if man.is_file():
            try:
                m = json.loads(man.read_text())
                runs.append({
                    "run": m.get("run_name", d.name),
                    "config_hash": m.get("config_hash", ""),
                    "selected_checkpoint": m.get("selected_checkpoint"),
                    "manifest": str(man),
                    **_run_dev(m),
                    "prereg": _run_prereg(ws, m),
                    # the files it trained on (paths only): which corpus —
                    # all data, or the twin-free one — this run is
                    "training_files": _run_training_files(ws, m),
                    # its run checked that no training row IS a dev row
                    # (Round 12); runs before that check carry no record
                    "dev_overlap_checked": "training_overlap" in (
                        m.get("dev_set") or {}),
                })
            except Exception:
                runs.append({"run": d.name, "manifest": str(man),
                             "config_hash": "", "selected_checkpoint": None,
                             "dev_set": None, "dev_score": None,
                             "dev_saturated": None, "prereg": None,
                             "training_files": [],
                             "dev_overlap_checked": False})

    # reads mt-eval made of the test/sealed files (the read log beside each
    # file): they count, though they never reach forge's ledger (Round 7)
    harness_reads: dict[str, dict] = {}
    for name in roles["test"] + roles["sealed"]:
        try:
            hr = ws.registry.harness_reads(name)
        except Exception:
            continue
        if (hr["reads"] or hr["other_content"] or not hr["watched"]
                or hr.get("before_registration")):
            harness_reads[name] = hr

    # which run each preregistration applies to (two preregs on one test
    # set: Round 7 school persona could not tell)
    for p in preregs:
        p["runs"] = [r["run"] for r in runs
                     if (r.get("prereg") or {}).get("id") == p["id"]]

    events: dict[str, int] = {}
    exports: list[dict] = []
    served: list[str] = []
    serves: list[dict] = []
    chosen: list[str] = []
    try:
        for e in ws.ledger.entries():
            if e.get("event") == SERVE_EVENT and e.get("model_dir"):
                serves.append({**{k: e.get(k) for k in _SERVE_KEYS},
                               "ts": e.get("ts"), "stopped": None})
            elif e.get("event") == SERVE_STOP_EVENT:
                for rec in reversed(serves):
                    if (rec["stopped"] is None and rec.get("pid") == e.get("pid")
                            and rec.get("url") == e.get("url")):
                        rec["stopped"] = e.get("ts")
                        break
            events[e.get("event", "?")] = events.get(e.get("event", "?"), 0) + 1
            if e.get("event") == "export":
                exports.append({"run": e.get("run"), "dir": e.get("dir"),
                                # the deployable directory (<dir>/model);
                                # exports before 2026-10-03 served <dir>
                                "model_dir": e.get("model_dir"),
                                "manifest": e.get("run_manifest"),
                                "exported_utc": e.get("ts"),
                                # ledger rows before 0.2.0 carry no flag;
                                # those exports always included the model
                                "model_included": e.get("model_included", True)})
            elif e.get("event") == "serve" and e.get("model_dir"):
                served.append(e["model_dir"])
            elif e.get("event") == "choose" and e.get("model_dir"):
                chosen.append(e["model_dir"])
    except Exception:
        pass
    # an export re-written to the same directory replaces the earlier one
    latest: dict[str, dict] = {}
    for x in exports:
        latest[x.get("dir") or ""] = x
    exports = [x for x in exports if latest.get(x.get("dir") or "") is x]
    for x in exports:
        x.update(_export_measure(x, ws))
    _pair_twin_free(exports)
    # every run says whether (and where) it was exported
    for r in runs:
        mine = [x for x in exports if x.get("manifest")
                and _same_path(x["manifest"], r["manifest"])]
        r["exports"] = [{"dir": x.get("dir"), "model_dir": x.get("model_dir"),
                         "model_included": x.get("model_included", True),
                         "score": x.get("score")} for x in mine]
        r["exported"] = bool(mine)

    from .runlock import public, read_lock

    lock = read_lock(ws)
    active = lock if lock and lock["state"] in ("held", "unverifiable") \
        else None
    stale = lock if lock and lock["state"] in ("stale", "corrupt") else None
    return {"workspace": str(ws.root), "roles": roles, "preregs": preregs,
            "runs": runs, "exports": exports, "ledger_events": events,
            "harness_reads": harness_reads,
            # per test/sealed set: what leak-audit's verdicts said (a SEVERE
            # near-twin verdict, the twin-free corpus written for it, and
            # whether a run has trained on that corpus) — Round 9
            "leak_audits": _leak_audit_state(ws, runs),
            # the newest file a plain `leak-audit --clean-to` wrote (still on
            # disk): what the split carves — or None
            "last_clean": _last_clean(ws),
            # the project `nmt-forge init` scaffolded around this workspace
            # (its config.json), or None
            "project": _project_info(ws),
            # model directories `nmt-forge serve` was started on, in order —
            # a trial or a provisional pick, NEVER the choice (Round 10)
            "served": served,
            # each serve as recorded: {model_dir, model, url, host, port, pid,
            # hostname, started, ts, stopped} (url/pid absent in records
            # older than Round 12) — liveness is judged by `serve_liveness`
            "serve_records": serves,
            # model directories `nmt-forge choose` (or `serve --choose`)
            # recorded, in order — the user's deployment choice
            "chosen": chosen,
            # a run in progress: its lock record (pid, host, run_name,
            # run_dir, created) — or None
            "active_run": public(active),
            "stale_run_lock": public(stale)}


def _resolve_project_path(ws: Workspace, p) -> str:
    """A config path as `nmt-forge run` read it: absolute, or relative to the
    project directory around the workspace (where forge runs)."""
    q = Path(str(p))
    if not q.is_absolute():
        q = ws.root.parent / q
    try:
        return str(q.resolve())
    except (OSError, ValueError):
        return str(q)


def _run_training_files(ws: Workspace, manifest: dict) -> list[str]:
    """The gold + synthetic files a run manifest's config trained on,
    resolved (paths only — never their content)."""
    cfg = manifest.get("config") or {}
    data = cfg.get("data") or {}
    files = [str(g) for g in data.get("gold") or []]
    files += [str(lane.get("path")) for lane in data.get("synthetic") or []
              if isinstance(lane, dict) and lane.get("path")]
    return [_resolve_project_path(ws, f) for f in files]


#: The ledger event `nmt-forge leak-audit` writes with its verdict (content-
#: free: paths, counts) — so `status` can carry a SEVERE verdict and the
#: two-model decision after the audit's own output has scrolled away.
AUDIT_EVENT = "audit-verdict"


def _leak_audit_state(ws: Workspace, runs: list[dict]) -> dict[str, dict]:
    """Per registered test/sealed set, from the leak-audit verdicts in the
    ledger: ``{severe: [{corpus, n, near_twin_rows, strict_n, ts}] (the
    corpora whose LATEST plain audit was severe for this set), twin_free:
    {clean_to, corpus, companion_config, n, strict_n, near_twin_rows, ts,
    predates_dev} | None (the newest --drop-test-twins file still on disk),
    twin_free_trained: bool (a run trained on it)}``. Sets no audit judged
    are absent.

    ``predates_dev`` names the registered dev sets whose current content was
    registered AFTER that twin-free audit, in ledger order: the audit could
    not drop their rows, and a split of the same corpus puts some of them in
    the twin-free file (Round 12 hospital persona: 111 dev rows; status and
    preflight said nothing). Content-free — the ledger's order, no row."""
    try:
        entries = list(ws.ledger.entries())
    except Exception:
        return {}
    dev_at = _dev_registered_at(ws, entries)
    plain: dict[str, dict[str, dict]] = {}
    out: dict[str, dict] = {}
    for i, e in enumerate(entries):
        if e.get("event") != AUDIT_EVENT:
            continue
        for name, st in (e.get("sets") or {}).items():
            cur = out.setdefault(name, {"severe": [], "twin_free": None,
                                        "twin_free_trained": False})
            rec = {"n": st.get("n"), "near_twin_rows": st.get("near_twin_rows"),
                   "strict_n": st.get("strict_n"), "ts": e.get("ts")}
            if e.get("drop_test_twins"):
                if e.get("clean_to") and Path(e["clean_to"]).is_file():
                    cur["twin_free"] = {
                        "clean_to": e["clean_to"], "corpus": e.get("corpus"),
                        "companion_config": e.get("companion_config"),
                        "predates_dev": sorted(d for d, at in dev_at.items()
                                               if at > i),
                        **rec}
            else:
                plain.setdefault(name, {})[str(e.get("corpus"))] = {
                    "corpus": e.get("corpus"), "severe": bool(st.get("severe")),
                    **rec}
    for name, by_corpus in plain.items():
        out[name]["severe"] = [{k: v for k, v in r.items() if k != "severe"}
                               for r in by_corpus.values() if r["severe"]]
    for st in out.values():
        tf = st["twin_free"]
        if tf:
            clean = _resolve_project_path(ws, tf["clean_to"])
            st["twin_free_trained"] = any(
                clean in (r.get("training_files") or []) for r in runs)
    return out


def _dev_registered_at(ws: Workspace, entries: list[dict]) -> dict[str, int]:
    """Each registered dev set → the ledger position of the register/rotate
    event that registered its CURRENT content (the newest such event)."""
    try:
        devs = {n: ws.registry.get(n)["sha256"]
                for n in ws.registry.names(roles=("dev",))}
    except Exception:
        return {}
    at: dict[str, int] = {}
    for i, e in enumerate(entries):
        if (e.get("event") in ("register", "rotate")
                and e.get("set") in devs
                and e.get("sha256") == devs[e["set"]]):
            at[e["set"]] = i
    return at


def reaudit_command(ws: Workspace, tf: dict) -> str:
    """The twin-free audit, re-run into its own file: ``tf`` is a
    ``leak_audits[set]["twin_free"]`` record. Paths as the project sees
    them."""
    project = ws.root.parent
    corpus = _rel_to(tf.get("corpus") or "<corpus>", project)
    return (f"nmt-forge leak-audit {corpus} --clean-to "
            f"{_rel_to(tf['clean_to'], project)} --drop-test-twins")


def predates_dev_text(ws: Workspace, tf: dict, *, command: bool = True) -> str:
    """Why a twin-free corpus written before the dev set's registration
    must be re-audited — one clause, said by status, split and preflight
    (``command=False`` when the caller prints the re-audit itself)."""
    devs = ", ".join(tf.get("predates_dev") or []) or "the dev set"
    return (f"the twin-free corpus {_rel_to(tf['clean_to'], ws.root.parent)} "
            f"was written BEFORE the dev set {devs} was registered, so that "
            "audit could not drop the dev set's rows — a split of the same "
            "corpus puts some of them in it, and `nmt-forge run` refuses "
            "training rows that ARE dev rows (preflight's dev-fence gate "
            "counts them)"
            + (f". Re-run the twin-free audit first: "
               f"`{reaudit_command(ws, tf)}`" if command else ""))


def dev_overlap_fix(ws: Workspace, file, dev_name: str | None = None) -> str:
    """The exact fix for a training ``file`` that holds rows of the dev set
    (``DevFence.require_disjoint_training``), from what the ledger and the
    split say about that file — content-free (Round 12 hospital persona).

    - the twin-free corpus an audit wrote: re-run that audit (with the dev
      set registered it drops the dev set's rows too);
    - the corpus a registered split carved the dev set from: train on the
      split's train side;
    - anything else: screen it into a new file and train on that."""
    project = ws.root.parent
    target = _resolve_project_path(ws, file)
    shown = _rel_to(target, project)
    last = None
    try:
        for e in ws.ledger.find(AUDIT_EVENT):
            if e.get("clean_to") and _same_path(e["clean_to"], target):
                last = e
    except Exception:
        last = None
    if last is not None and last.get("drop_test_twins"):
        tf = {"clean_to": last["clean_to"], "corpus": last.get("corpus")}
        return (f"{shown} is the twin-free corpus leak-audit wrote "
                f"({last.get('ts')}); re-run that audit now that the dev set "
                f"is registered — it drops the dev set's rows too: "
                f"`{reaudit_command(ws, tf)}` (the same audit may rewrite its "
                "own file while only a config reads it), then preflight again")
    train = None
    carved_from = None
    if dev_name:
        try:
            entry = ws.registry.get(dev_name)
            split_dir = Path(entry["path"]).parent
            if (split_dir / "train.jsonl").is_file():
                train = split_dir / "train.jsonl"
            sm = split_dir / "split-manifest.json"
            if sm.is_file():
                carved_from = (json.loads(sm.read_text(encoding="utf-8"))
                               .get("source_corpus") or {}).get("path")
        except Exception:
            pass
    if train is not None and carved_from and _same_path(
            _resolve_project_path(ws, carved_from), target):
        t = _rel_to(train, project)
        return (f"{shown} is the corpus the split carved the dev set from — "
                f"train on the split's train side instead: set data.gold to "
                f"[\"{t}\"] (and eval.near_dupe_corpus to \"{t}\")")
    stem = Path(str(file)).with_suffix("").name
    return (f"`nmt-forge leak-audit {shown} --clean-to {stem}.nodev.jsonl` "
            "writes it without the dev set's rows (and any test leak); point "
            "the config at that file")


def _last_clean(ws: Workspace) -> str | None:
    try:
        events = ws.ledger.find(AUDIT_EVENT)
    except Exception:
        return None
    for e in reversed(events):
        if (e.get("clean_to") and not e.get("drop_test_twins")
                and Path(e["clean_to"]).is_file()):
            return e["clean_to"]
    return None


def _manifest_mtime(d: Path) -> tuple:
    for name in ("run-manifest.json", "manifest.json"):
        f = d / name
        if f.is_file():
            return (f.stat().st_mtime, d.name)
    return (d.stat().st_mtime, d.name)


def _same_path(a, b) -> bool:
    try:
        return Path(a).resolve() == Path(b).resolve()
    except (OSError, ValueError):
        return str(a) == str(b)


def _run_dev(m: dict) -> dict:
    """A run manifest's dev reading, content-free: the set, the selection
    metric's score with its CI, and whether it was saturated."""
    from .guards.ci_scoring import run_dev_saturation

    dev = m.get("dev_report") or {}
    scores = dev.get("scores") or {}
    stages = m.get("stages") or []
    sel = (stages[-1].get("selection") or {}) if stages else {}
    metric = str(sel.get("metric") or "")
    metric = metric.split(":", 1)[1] if metric.startswith("generation:") \
        else None
    if metric not in scores:
        metric = next((k for k, v in scores.items()
                       if isinstance(v, dict) and "score" in v), None)
    s = scores.get(metric) if metric else None
    return {"dev_set": (m.get("dev_set") or {}).get("name"),
            "dev_score": ({"metric": metric, "score": s["score"],
                           "ci": ([s["ci_lower"], s["ci_upper"]]
                                  if "ci_lower" in s else None)}
                          if s else None),
            "dev_saturated": bool(run_dev_saturation(m))}


def _project_info(ws: Workspace) -> dict | None:
    """The project around the workspace, as `nmt-forge init` left it: its
    config.json and the eval-set names that config expects (content-free).
    None when the workspace has no config.json beside it."""
    cfg = ws.root.parent / "config.json"
    if not cfg.is_file():
        return None
    try:
        raw = json.loads(cfg.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError):
        return {"config": str(cfg), "readable": False}
    data = raw.get("data") or {}
    ev = raw.get("eval") or {}
    return {"config": str(cfg), "readable": True,
            "next_steps": (str(ws.root.parent / "NEXT_STEPS.md")
                           if (ws.root.parent / "NEXT_STEPS.md").is_file()
                           else None),
            "dev": data.get("dev"), "battery": ev.get("battery"),
            "gold": list(data.get("gold") or []),
            "run_name": raw.get("run_name")}


def _export_measure(x: dict, ws: Workspace | None = None) -> dict:
    """What an export measured, read from its forge-model.json: the test set,
    the headline score with its CI, the twin-free (strict) score, the
    near-twin caveat and the prereg verdict. Content-free. ``{}`` fields when
    the export cannot be read (it may have been moved)."""
    from .export import find_forge_model

    out: dict = {"test_set": None, "score": None, "strict_score": None,
                 "caveat": None, "prereg": None, "readable": False,
                 "twin_free": False, "n": None, "score_caveats": None}
    fm = find_forge_model(x["dir"]) if x.get("dir") else None
    if fm is None:
        out["caveat"] = "forge-model.json not found (moved or deleted?)"
        return out
    try:
        doc = json.loads(fm.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError) as e:
        out["caveat"] = f"forge-model.json unreadable ({e})"
        return out
    out["readable"] = True
    tr = doc.get("test_report") or {}
    if not tr:
        out["caveat"] = "not evaluated on a test set (exported with --no-eval)"
        return out
    out["test_set"] = tr.get("set")
    from .scoring_standard import for_export as headline_for_export
    from .scoring_standard import from_scores, short

    # scoring standard/1: the headline is the export's corpus chrF++ with
    # its 95% CI (its mt-eval TestReport; a single-group battery's chrF++
    # for an export without one) — never the first metric listed, never a
    # weighted mean across groups, never a composite
    out["score"] = short(headline_for_export(fm, doc))
    strict = tr.get("strict_overall")
    out["strict_score"] = short(from_scores(strict)) if strict else None
    nt = tr.get("near_twin") or {}
    if nt.get("message"):
        out["caveat"] = nt["message"]
        out["recall_not_translation"] = bool(nt.get("recall_not_translation"))
    pre = tr.get("prereg") or {}
    if pre.get("id"):
        from .guards.preregister import attach_human_verdicts, verdict_counts

        rows = [{**r, "number": r.get("number") or i}
                for i, r in enumerate(pre.get("verdicts") or [], 1)]
        after = pre.get("after_reads")
        if ws is not None:
            # a person's verdicts recorded since the export, counted apart
            rows = attach_human_verdicts(ws, pre["id"], rows)
            if after is None:          # exports before Round 9: read it live
                from .guards.preregister import after_reads_info

                after = after_reads_info(ws, pre["id"])
        out["prereg"] = {"id": pre["id"], **verdict_counts(rows),
                         "after_reads": after}
    out["twin_free"] = (bool(nt.get("checked"))
                        and nt.get("near_twin_rows") == 0)
    out["n"] = tr.get("n")
    # what mt-eval says qualifies this score, verbatim (forge-model.json, or
    # the export's TestReport for an export written before Round 13); None
    # = it says nothing. `caveat` above is forge's own near-twin reading.
    from .harness_caveats import for_export

    got = for_export(fm, doc)
    out["score_caveats"] = got["score_caveats"]
    if got.get("error"):
        out["score_caveats_error"] = got["error"]
    # the hypotheses file `nmt-forge compare` takes (--hyps-a/--hyps-b)
    if tr.get("battery_manifest"):
        hyps = (fm.parent / tr["battery_manifest"]).parent \
            / "battery-hyps.jsonl"
        if hyps.is_file():
            out["hypotheses"] = str(hyps.resolve())
    return out


def _export_line(x: dict) -> str:
    """One export, as a person chooses between them: where, what it scored
    (with its CI), the twin-free score, and the caveat."""
    from .scoring_standard import cite

    sc = x.get("score") or {}
    bits = [f"{x.get('run')} → {x.get('model_dir') or x.get('dir')}"]
    if isinstance(sc.get("score"), (int, float)):
        bits.append(cite(sc))
    st = x.get("strict_score") or {}
    if isinstance(st.get("score"), (int, float)):
        bits.append(f"twin-free subset {cite(st)}")
    if x.get("caveat"):
        bits.append(("⚠ " if x.get("recall_not_translation") else "")
                    + x["caveat"])
    from .harness_caveats import majors, text_lines

    # mt-eval's caveats on this score, in its words (Round 13)
    bits += text_lines(x.get("score_caveats"))
    for s in x.get("twin_free_siblings") or []:
        bits.append(f"quote beside it: twin-free {s['run']} "
                    f"{cite(s.get('score'))}"
                    + (" — with that model's SCORE CAVEAT (listed with it)"
                       if majors(s.get("score_caveats")) else ""))
    if x.get("prereg"):
        from .guards.preregister import counts_text

        p = x["prereg"]
        bits.append(f"prereg {p['id']}: {counts_text(p)}"
                    + (f" (⚠ written after {p['after_reads']['reads']} "
                       "scoring read(s), under --allow-after-reads — not "
                       "blind)" if p.get("after_reads") else ""))
    return " · ".join(bits)


def _flagged_twin_free_note(exports: list[dict]) -> str:
    """When mt-eval puts a MAJOR caveat on a twin-free export's score, the
    advice that says to cite that score says so too — never "cite it" bare
    (Round 13: the cited twin-free model's output was near-constant)."""
    from .harness_caveats import majors, short_label

    flagged = [x for x in exports if x.get("twin_free")
               and majors(x.get("score_caveats"))]
    if not flagged:
        return ""
    return (" — but mt-eval puts a SCORE CAVEAT on "
            + ", ".join(f"{x.get('run')}'s score ("
                        + ", ".join(short_label(c)
                                    for c in majors(x.get("score_caveats")))
                        + ")" for x in flagged)
            + ": cite that score only with its caveat, as listed above")


def _pair_twin_free(exports: list[dict]) -> None:
    """Each inflated export (most test rows twinned) gets the twin-free
    exports of the same test set beside it — the number to quote."""
    for x in exports:
        if not x.get("recall_not_translation") or not x.get("test_set"):
            continue
        x["twin_free_siblings"] = [
            {"run": y.get("run"), "dir": y.get("model_dir") or y.get("dir"),
             "score": y.get("score"),
             # its harness caveats travel with its score (Round 13)
             "score_caveats": y.get("score_caveats")}
            for y in exports if y is not x and y.get("twin_free")
            and y.get("test_set") == x["test_set"] and y.get("score")]


# -- next action --------------------------------------------------------------

@dataclass
class Advice:
    state: str                    # short name of the detected state
    command: str                  # THE next command, exact
    why: str
    ready: list[str] = field(default_factory=list)   # ✓ items
    blockers: list[str] = field(default_factory=list)
    # the servable exports with what each measured, when there is a choice
    # to make (or to confirm) — content-free
    exports: list[dict] | None = None
    # things that pass but must be read before trusting a number (a
    # saturated dev set) — never a blocker
    warnings: list[str] = field(default_factory=list)
    # every trained run: checkpoint, dev score, exported or not
    runs: list[dict] | None = None
    # THE step order (scaffold.STEP_ORDER) when the state is where it starts
    order: list[dict] | None = None

    def to_json(self) -> dict:
        out = {"state": self.state, "next_command": self.command,
               "why": self.why, "ready": self.ready,
               "blockers": self.blockers, "warnings": self.warnings}
        if self.exports is not None:
            out["exports"] = self.exports
        if self.runs is not None:
            out["runs"] = self.runs
        if self.order is not None:
            out["order"] = self.order
        return out


def _training_advice(s: dict) -> Advice:
    """A run holds the workspace lock: the one safe move is to wait. The
    command re-checks; it can never start a second run."""
    from .runlock import describe

    rec = s["active_run"]
    verified = rec.get("state") == "held"
    why = (f"a training run is in progress: {describe(rec)} — WAIT for it "
           "to finish. Do NOT start another run: two runs fight for the same "
           "CPU/GPU and memory, and `nmt-forge run` refuses while this one "
           f"holds {rec.get('path')}. Run `nmt-forge status` again after the "
           "training process has exited (when you launched it in the "
           "background, wait on that process or its log — do not poll on a "
           "timer); status will then name the next step.")
    if rec.get("run_dir"):
        why += f" Its run directory (checkpoints) is {rec['run_dir']}."
    if not verified:
        why += (f" (forge cannot verify this run from here — "
                f"{rec.get('why', 'unverifiable')}; if you KNOW it has "
                f"ended, delete {rec.get('path')} and run status again)")
    blockers = [f"training in progress — wait ({describe(rec)})"]
    prereg_evals = {p["eval"] for p in s["preregs"] if p["eval"]}
    missing = [t for t in s["roles"]["test"] + s["roles"]["sealed"]
               if t not in prereg_evals]
    if missing:
        # useful while waiting, and it starts nothing
        blockers.append(
            f"no preregistration bound to {missing[0]!r} — write it while "
            "the model trains (before any test score exists): nmt-forge "
            "prereg template --out predictions.json && nmt-forge prereg new "
            f"<id> --eval-set {missing[0]} --predictions predictions.json")
    return Advice(state="training", command="nmt-forge status", why=why,
                  blockers=blockers)


def next_action(ws: Workspace) -> Advice:
    """The decision ladder (:func:`_ladder`), plus the standing warnings
    that hold in every state: a preregistration written after scoring reads,
    a SEVERE leak-audit verdict and the two-model decision, a twin-free
    corpus whose model is not trained yet (Round 9)."""
    s = snapshot(ws)
    a = _ladder(ws, s)
    for w in _standing_warnings(s, ws) + _dev_twin_warnings(ws, s):
        if w not in a.warnings:
            a.warnings.append(w)
    return a


def _dev_twin_warnings(ws: Workspace, s: dict) -> list[str]:
    """THE dev twin verdict split / ``preflight run`` recorded for each
    registered dev set (its current content), in their words — until a run
    has trained on those files with that dev set (its report and the
    saturation note take over then). A clean dev set says nothing."""
    out: list[str] = []
    for name in s["roles"]["dev"]:
        for rec in dev_twin_records(ws, name):
            if not rec.get("near_twin_rows"):
                continue
            files = sorted(rec.get("compared_with") or [])
            if any(r.get("dev_set") == name
                   and sorted(r.get("training_files") or []) == files
                   for r in s.get("runs") or []):
                continue
            out.append(dev_twin_line(ws, rec))
    return out


def twin_free_prereg_clause(ws: Workspace, eval_set: str,
                            companion_config=None) -> str:
    """Where the twin-free model's preregistration stands on ``eval_set`` —
    one clause, said by ``status`` and by ``leak-audit --drop-test-twins``
    (Round 11: both kept saying "write it" after "notwins" was written).

    A prereg pinned to the companion config's hash is the twin-free model's
    for certain; with two or more binding the set, nothing is left to write
    if one of them is its; with fewer, the twin-free model still needs its
    own. Names, ids and hashes only."""
    from .guards.preregister import find_for

    try:
        docs = find_for(ws, eval_set)
    except Exception:
        docs = []
    ids = [d["id"] for d in docs if d.get("id")]
    pinned_hash = None
    if companion_config:
        from .training.config import RunConfig

        try:
            pinned_hash = RunConfig.from_file(companion_config).hash()
        except Exception:
            pinned_hash = None
    pinned = [d["id"] for d in docs
              if pinned_hash and d.get("config_hash") == pinned_hash]
    if pinned:
        shown = _rel_to(companion_config, ws.root.parent)
        return (f"its preregistration is written: {pinned[0]}, pinned to "
                f"{shown} (export binds it without --prereg)")
    if len(ids) >= 2:
        return (f"{len(ids)} preregistrations bind {eval_set} "
                f"({', '.join(ids)}) — nothing more to write if one of them "
                "is the twin-free model's; on export name the one that "
                "predicted each model (`--prereg <id>`): with two on one "
                "test set, export refuses to guess")
    return ((f"1 preregistration binds {eval_set} ({ids[0]}): one model's. "
             "The" if ids else "the")
            + " twin-free model is judged against its OWN "
            "preregistration, named after it — write it before any "
            f"benchmark run on {eval_set} (`nmt-forge prereg new notwins "
            f"--eval-set {eval_set} --predictions <file>`); `--prereg <id>` "
            "on export names which prereg judges which model")


def _standing_warnings(s: dict, ws: Workspace) -> list[str]:
    """What must be read before trusting a number, whatever the state."""
    from .guards.ci_scoring import TWIN_DECISION_NOTE

    out: list[str] = []
    for p in s.get("preregs") or []:
        after = p.get("after_reads")
        if after:
            out.append(f"{_sentence_case_first(after['text'])} — say so "
                       "wherever you report its verdicts (export, DEPLOY.md, "
                       "`nmt-forge report` and `prereg check` do)")
    project = Path(s["workspace"]).parent
    for name, st in sorted((s.get("leak_audits") or {}).items()):
        tf = st.get("twin_free")
        if tf and not st.get("twin_free_trained"):
            cc = tf.get("companion_config")
            clean = _rel_to(tf["clean_to"], project)
            stale = bool(tf.get("predates_dev"))
            cmd = ((f"`{reaudit_command(ws, tf)} && " if stale else "`")
                   + f"nmt-forge preflight run --config {_rel_to(cc, project)} "
                   f"&& nmt-forge run {_rel_to(cc, project)}`" if cc else
                   f"a config whose data.gold and eval.near_dupe_corpus are "
                   f"{clean}")
            out.append(
                f"twin-free corpus for {name}: {clean} ({tf.get('strict_n')} "
                f"of {tf.get('n')} test rows have no near-twin in it) — its "
                f"model is not trained yet: {cmd}. "
                # Round 12 hospital persona: written before the split, it
                # held the dev set's rows and nothing here said so
                + (_sentence_case_first(predates_dev_text(
                    ws, tf, command=False)) + " — hence the re-audit first. "
                   if stale else "")
                + _sentence_case_first(twin_free_prereg_clause(
                    ws, name, cc)))
        elif tf and tf.get("predates_dev") and (trained := [
                r["run"] for r in s.get("runs") or []
                if _resolve_project_path(ws, tf["clean_to"])
                in (r.get("training_files") or [])
                # a run since Round 12 refused dev rows in training: it
                # trained on none
                and not r.get("dev_overlap_checked")]):
            cc = _rel_to(tf.get("companion_config") or "config-notwins.json",
                         project)
            out.append(
                f"twin-free corpus for {name}: run(s) {', '.join(trained)} "
                f"trained on it, and {predates_dev_text(ws, tf)}, then "
                "retrain: that model's dev score may come from rows it "
                f"trained on (`nmt-forge preflight run --config {cc}` counts "
                "them)")
        elif st.get("severe") and not tf:
            sv = st["severe"][-1]
            corpus = _rel_to(sv.get("corpus"), project)
            stem = Path(str(sv.get("corpus") or "corpus")).stem
            head = (f"leak-audit verdict SEVERE for {name}: "
                    f"{sv.get('near_twin_rows')} of {sv.get('n')} test rows "
                    f"have a near-twin in {corpus} ({sv.get('ts')}) — a model "
                    "trained on it scores recall of training phrases, not "
                    "translation")
            fix = (f"`nmt-forge leak-audit {corpus} --clean-to {stem}"
                   ".notwins.jsonl --drop-test-twins` writes the twin-free "
                   "corpus and a config for its model")
            if s.get("runs"):
                out.append(f"{head}. Exports of models trained on that data "
                           f"say so; for a twin-free number: {fix}")
            else:
                out.append(f"{head}. Decide with the user BEFORE training — "
                           f"{_sentence_case_first(TWIN_DECISION_NOTE)}. "
                           f"{_sentence_case_first(fix)}; then one "
                           "preregistration per model, before any benchmark "
                           f"run on {name}")
    return out


def _rel_to(path, base: Path) -> str:
    """``path`` relative to the project directory when it is inside it."""
    if not path:
        return str(path)
    try:
        return str(Path(str(path)).resolve().relative_to(base.resolve()))
    except (ValueError, OSError):
        return str(path)


def _ladder(ws: Workspace, s: dict) -> Advice:
    """The decision ladder. Ordered: each rung assumes the previous ones —
    except a run in progress, which overrides every rung: the only safe
    next move then is to wait."""
    if s.get("active_run"):
        return _training_advice(s)
    ready: list[str] = []
    dev, test, sealed = s["roles"]["dev"], s["roles"]["test"], s["roles"]["sealed"]

    if not (dev or test or sealed) and s.get("project"):
        return _initialized_advice(s)
    if not (dev or test or sealed):
        return Advice(
            state="empty-workspace",
            command="nmt-forge discover <iso639-3>   # then: nmt-forge init "
                    "<iso639-3>; if you ALREADY have a parallel corpus, go "
                    "straight to: nmt-forge split <corpus.jsonl> --dev <N> "
                    "--test <M> --seed <S> --out data/splits --register mypair",
            why="no eval sets are registered — start by discovering what "
                "assets exist for your language, then init a project "
                "(init writes NEXT_STEPS.md and the language block). If you "
                "already have parallel data, the concrete next move is a "
                "group-disjoint split that registers a dev AND a test set in "
                "one step (--register)",
            blockers=["no dev/test/sealed sets registered"],
        )
    if test:
        ready.append(f"test set(s) registered: {', '.join(test)}")
    if sealed:
        ready.append(f"sealed set(s) registered: {', '.join(sealed)}")
    if dev:
        ready.append(f"dev set registered: {', '.join(dev)}")

    # the preregistration comes BEFORE any benchmark of the test set — and a
    # benchmark can happen the moment the set is registered (the guide's
    # baselines), so it is the next step as soon as a test set exists, even
    # before the dev set: a read blocks every later prereg (Round 9 school
    # persona: the documented order guaranteed that refusal)
    prereg_evals = {p["eval"] for p in s["preregs"] if p["eval"]}
    unpreregged = [t for t in test + sealed if t not in prereg_evals]
    if unpreregged:
        name = unpreregged[0]
        hr = (s.get("harness_reads") or {}).get(name) or {}
        why = ("scoring a test/sealed set is refused without a "
               "preregistration (predictions written BEFORE results); "
               f"{name!r} has none. Write it NOW, before any benchmark of "
               "an existing model on its file (`mt-eval run`, the MCP "
               "run_benchmark): a benchmark is a scoring read, and forge "
               "refuses a preregistration written after one. `prereg "
               "template` writes a valid predictions.json to EDIT (its "
               "REPLACE placeholders are refused until you write your own "
               "expectations). Screen your training corpus first if you have "
               "not (`nmt-forge leak-audit <corpus>` reads the test set for "
               "an audit, never a score): its verdict says whether you will "
               "train one model or two (all data, and twin-free) — write one "
               "preregistration per model, named after it (export's "
               "`--prereg <id>` says which judges which)")
        if hr.get("reads"):
            why += (f". mt-eval has ALREADY scored {name!r} {hr['reads']}× "
                    "(`nmt-forge status` lists the runs): a preregistration "
                    "written now is refused. Only if these predictions were "
                    "written down BEFORE those reads (on paper, say) add "
                    "--allow-after-reads — the override is ledgered and said "
                    "beside every verdict")
        blockers = [f"no preregistration bound to {name!r}"]
        if not dev:
            blockers.append("no dev set registered yet — carve it after the "
                            "preregistration (the split reads no test row): "
                            "nmt-forge split <corpus> --test 0 --dev <N> "
                            "--seed <S> --out data/split --register project")
        return Advice(
            state="missing-preregistration",
            command=("nmt-forge prereg template --out predictions.json "
                     "&& nmt-forge prereg new <id> "
                     f"--eval-set {name} --predictions predictions.json"),
            why=why, ready=ready, blockers=blockers,
        )
    if prereg_evals:
        ready.append(f"preregistration(s): {', '.join(sorted(prereg_evals))}")

    if not dev:
        test_carve = "0" if (test or sealed) else "<M>"
        # the file leak-audit cleaned is the one to split (Round 9)
        clean = s.get("last_clean")
        corpus = (_rel_to(clean, Path(s["workspace"]).parent) if clean
                  else "<your-parallel-corpus.jsonl>")
        from .scaffold import GUARDRAILS_PAGE

        notes = ((["--test 0: your registered test set stays a separate "
                   "file"] if (test or sealed) else [])
                 + (["the file leak-audit cleaned"] if clean else [])
                 # the one place before the split (Round 13: the rules
                 # were read after splitting) — no later state repeats it
                 + ["BEFORE it, read the training guardrails once: "
                    f"get_training_guardrails (MCP) or {GUARDRAILS_PAGE}"])
        return Advice(
            state="no-dev-set",
            command=f"nmt-forge split {corpus} "
                    f"--test {test_carve} --dev <N> --seed <S> "
                    "--out data/split --register project   # "
                    + "; ".join(notes),
            why="checkpoint selection needs a fenced dev set (role=dev); the "
                "split-guard carves train/dev/test group-disjointly so "
                "answer-sharing rows can never straddle the split. Before "
                "splitting, read the training guardrails once — the rules "
                "the split, the dev fence and the leak audit enforce, with "
                "the measured mistake behind each: the MCP tool "
                "get_training_guardrails (agents), or "
                f"{GUARDRAILS_PAGE} (at a terminal)",
            ready=ready,
            blockers=["no dev set registered — training will be refused by "
                      "the dev-fence"],
        )

    if not s["runs"]:
        stale = [(n, st["twin_free"]) for n, st in sorted(
            (s.get("leak_audits") or {}).items())
            if (st.get("twin_free") or {}).get("predates_dev")
            and not st.get("twin_free_trained")]
        if stale:
            # the guide's order: split, THEN the twin-free audit again —
            # status named neither (Round 12 hospital persona: the twin-free
            # file still held 111 rows of the dev set)
            name, tf = stale[0]
            return Advice(
                state="ready-to-train",
                command=(f"{reaudit_command(ws, tf)}   # first: the twin-free "
                         "corpus predates the dev set; then train: nmt-forge "
                         "preflight run --config config.json && nmt-forge run "
                         "config.json"),
                why=(f"the dev set is registered, so re-run the twin-free "
                     f"audit for {name} before any training: "
                     f"{predates_dev_text(ws, tf, command=False)}. The "
                     "all-data model "
                     "(config.json, on the split's train side) is not "
                     "affected; train it after the audit, then the twin-free "
                     "model (status names it)"),
                ready=ready,
                blockers=[f"twin-free corpus {_rel_to(tf['clean_to'], Path(s['workspace']).parent)} "
                          "predates the dev set — re-audit before training "
                          "the twin-free model"],
            )
        return Advice(
            state="ready-to-train",
            command="nmt-forge preflight run --config config.json && "
                    "nmt-forge run config.json",
            why="evals are registered, dev is fenced, predictions are "
                "preregistered — preflight checks every gate the run will "
                "hit (including the training extra), then train through the "
                "guarded loop (leak-audit, schedule floor, checkpoint "
                "selection all run inside)",
            ready=ready,
        )
    last = s["runs"][-1]
    # EVERY run, not just the newest: with a full model and a twin-free one
    # in one workspace, the older run vanished from status (Round 6)
    warnings: list[str] = []
    for r in s["runs"]:
        ready.append(_run_line(r))
        if r.get("dev_saturated"):
            warnings.append(
                f"run {r['run']}: the dev set is SATURATED ({_dev_text(r)}) — "
                "checkpoint selection had nothing to choose between; read "
                f"`nmt-forge report {r['manifest']}` for what to do")
    runs = [{k: r.get(k) for k in ("run", "manifest", "selected_checkpoint",
                                   "dev_set", "dev_score", "dev_saturated",
                                   "exported", "exports", "prereg")}
            for r in s["runs"]]
    # Only an export that carries the model can be served: `export
    # --no-model` writes the evaluation and harness report alone. EVERY
    # run's exports count: with two models on one test set (all data / twins
    # dropped) the newest is not necessarily the one to deploy (Round 5).
    servable = [e for e in s.get("exports", [])
                if e.get("dir") and e.get("model_included", True)]
    last_exported = any(e.get("manifest") == last["manifest"]
                        for e in servable)
    if servable and last_exported:
        a = _serve_advice(s, servable, ready)
        a.warnings, a.runs = warnings, runs
        pending = [r for r in s["runs"] if not r.get("exported")]
        if pending:
            from .export import EXPORT_ORDER_NOTE, suggest_export_dir

            # an earlier run that was never exported must not vanish behind
            # the serve advice (two models, one exported: Round 7)
            a.why += (". Not exported yet: " + "; ".join(
                f"nmt-forge export {r['manifest']}"
                f"{_prereg_arg(ws, s, r)[0]} --out "
                f"{suggest_export_dir(r['run'], workspace=ws)}"
                for r in pending)
                + f" — {EXPORT_ORDER_NOTE}")
            for r in pending:
                note = _prereg_arg(ws, s, r)[1]
                if note:
                    a.why += f". {_sentence_case_first(note)}"
        return a
    if servable:
        ready.append("exported earlier: " + "; ".join(
            _export_line(x) for x in servable))
    from .export import EXPORT_ORDER_NOTE, suggest_export_dir

    out_dir = suggest_export_dir(last["run"], workspace=ws)
    several = len(s["runs"]) >= 2
    others = [r for r in s["runs"][:-1] if not r.get("exported")]
    why = ("a trained run exists — `export` decodes your test battery with "
           "the dev-selected checkpoint, scores it (prereg-gated, CI'd, with "
           "the Diagnosis), writes an mt-eval RunLog + TestReport into "
           f"{out_dir}evaluation/ (your test sentences — never deployed), and "
           f"packages the model you can serve into {out_dir}model/ — one "
           "step. (`nmt-forge evaluate <manifest>` is the score-only half of "
           "it.)")
    if several:
        why += (" This workspace holds several runs: each exports to its own "
                "folder"
                + ("" if not others else " — also: " + "; ".join(
                    f"nmt-forge export {r['manifest']}"
                    f"{_prereg_arg(ws, s, r)[0]} --out "
                    f"{suggest_export_dir(r['run'], workspace=ws)}"
                    for r in others))
                + f". {_sentence_case_first(EXPORT_ORDER_NOTE)}.")
    # two preregistrations on one test set: the command carries the
    # --prereg export needs (or the user's choice of it), never leaves it out
    prereg_flag, prereg_note = _prereg_arg(ws, s, last)
    if prereg_note:
        why += f" {_sentence_case_first(prereg_note)}."
    for r in others:
        note = _prereg_arg(ws, s, r)[1]
        if note:
            why += f" {_sentence_case_first(note)}."
    return Advice(
        state="ready-to-score",
        command=f"nmt-forge export {last['manifest']}{prereg_flag} "
                f"--out {out_dir}"
                + ("   # a folder of its own: this workspace holds several "
                   "runs" if several else
                   "   # export/ holds another run's export — a fresh folder"
                   if out_dir != "export/" else ""),
        warnings=warnings, runs=runs,
        why=why,
        ready=ready,
    )


def _sentence_case_first(text: str) -> str:
    return text[:1].upper() + text[1:]


def _name_tokens(text) -> list[str]:
    """``text`` as lowercase alphanumeric tokens: "qaa-nmt-cpu-tiny-notwins"
    → [qaa, nmt, cpu, tiny, notwins]; "all_data" → [all, data]."""
    import re

    return [t for t in re.split(r"[^0-9a-z]+", str(text or "").lower()) if t]


def _named_after(prereg_id: str, name) -> bool:
    """Does preregistration ``prereg_id`` carry ``name``'s run/config name —
    its tokens a contiguous run of the name's tokens ("notwins" in
    "qaa-nmt-cpu-tiny-notwins")?"""
    p, n = _name_tokens(prereg_id), _name_tokens(name)
    return bool(p) and any(n[i:i + len(p)] == p
                           for i in range(len(n) - len(p) + 1))


def export_prereg_arg(run: dict, preregs: list[dict],
                      other_names=()) -> tuple[str, str]:
    """The ``--prereg`` an export of ``run`` needs: ``(" --prereg <id>", why)``,
    or ``("", "")`` when export picks the prereg itself.

    Only an AMBIGUOUS binding needs it — two or more preregistrations bind
    the run's test set and nothing records which one predicted this run, so
    export refuses without the flag. Status said "export needs --prereg"
    while its next_command left the flag out, so a mechanical follower hit
    the refusal (Round 8, school and hospital personas). When exactly one
    candidate is not already judged against ANOTHER run, it is named (with
    the reason, and the way out if it is the wrong one).

    Otherwise the names decide when they can (Round 12 school persona: both
    runs' NEXT lines said ``--prereg <all-data|notwins>``, although forge
    tells the user to name each prereg after its model): the one candidate
    named after this run ("notwins" for run "…-notwins"), or — when every
    other candidate is named after another run (``other_names``: the
    workspace's other runs and the twin-free companion's run name) — the
    one left. Ambiguous names leave the choice to the user, with the reason
    and the candidate ids."""
    b = run.get("prereg") or {}
    if b.get("state") != "ambiguous":
        return "", ""
    cands = list(b.get("candidates") or [])
    elsewhere = {p["id"]: [r for r in (p.get("runs") or [])
                           if r != run.get("run")] for p in preregs}
    free = [c for c in cands if not elsewhere.get(c)]
    taken = [c for c in cands if elsewhere.get(c)]
    head = (f"{len(cands)} preregistrations bind {b.get('set')!r} "
            f"({', '.join(cands)}) and nothing records which one predicted "
            f"run {run.get('run')!r} — export refuses without --prereg")
    if len(free) == 1:
        return (f" --prereg {free[0]}",
                f"{head}; {free[0]} is the only one not already judged "
                "against another run ("
                + "; ".join(f"{c} → run {', '.join(elsewhere[c])}"
                            for c in taken)
                + f"). If a different one was written for {run.get('run')!r}, "
                  "pass its id instead")
    opts = free or cands
    mine = [c for c in opts if _named_after(c, run.get("run"))]
    others = [n for n in other_names if n and n != run.get("run")]
    theirs = {c: [n for n in others if _named_after(c, n)
                  and not _named_after(c, run.get("run"))] for c in opts}
    left = [c for c in opts if not theirs[c]]
    if len(mine) == 1:
        pick, how = mine[0], (f"{mine[0]} is the one named after run "
                              f"{run.get('run')!r}")
    elif not mine and len(left) == 1:
        pick = left[0]
        how = (f"{pick} is the one not named after another run ("
               + "; ".join(f"{c} → {', '.join(theirs[c])}"
                           for c in opts if theirs[c]) + ")")
    else:
        pick = None
    if pick:
        return (f" --prereg {pick}",
                f"{head}; {how} — forge asks each prereg to be named after "
                f"its model. If a different one was written for "
                f"{run.get('run')!r}, pass its id instead")
    names = (f"{len(mine)} of them ({', '.join(mine)}) are named after run "
             f"{run.get('run')!r}" if len(mine) > 1 else
             "each is named after another run" if not left else
             f"none is named after this run, and {', '.join(left)} name no "
             "other run either")
    return (f" --prereg <{'|'.join(opts)}>",
            f"{head}, and their names do not say ({names}); which one was "
            f"written for this run is the user's answer (ask them) — pass "
            "that id. To avoid the choice next "
            "time, pin a prereg to its run when you write it (`nmt-forge "
            "prereg new <id> … --config-hash <hash>`, the full config hash "
            "`nmt-forge preflight run --config <its config>` prints — any "
            "later edit of that config changes it)")


def export_prereg_for(ws: Workspace, manifest_path) -> tuple[str, str]:
    """:func:`export_prereg_arg` for the run whose manifest is
    ``manifest_path`` (``("", "")`` when the workspace holds no such run) —
    the run's own NEXT line uses it."""
    s = snapshot(ws)
    run = next((r for r in s["runs"]
                if _same_path(r["manifest"], manifest_path)), None)
    if run is None:
        return "", ""
    return _prereg_arg(ws, s, run)


def run_names(ws: Workspace, s: dict) -> list[str]:
    """Every run name the workspace knows: its trained runs, the project
    config's run_name and each twin-free companion config's (a model not
    trained yet still has its name) — what a preregistration is named
    after."""
    names = [r["run"] for r in s.get("runs") or [] if r.get("run")]
    proj = s.get("project") or {}
    if proj.get("run_name"):
        names.append(str(proj["run_name"]))
    for st in (s.get("leak_audits") or {}).values():
        cc = (st.get("twin_free") or {}).get("companion_config")
        if not cc:
            continue
        try:
            name = json.loads(Path(cc).read_text(encoding="utf-8")).get(
                "run_name")
        except (OSError, json.JSONDecodeError, AttributeError):
            name = None
        if name:
            names.append(str(name))
    return list(dict.fromkeys(names))


def _prereg_arg(ws: Workspace, s: dict, run: dict) -> tuple[str, str]:
    """:func:`export_prereg_arg` with the workspace's other run names."""
    return export_prereg_arg(run, s["preregs"], run_names(ws, s))


def _run_prereg(ws: Workspace, manifest: dict) -> dict | None:
    """``preregister.run_binding`` for a run manifest's test battery, plus
    the set's name; None when the run has no registered battery."""
    from .guards.preregister import run_binding

    battery = ((manifest.get("config") or {}).get("eval") or {}).get(
        "battery")
    if not battery:
        return None
    try:
        ws.registry.get(battery)
        return {"set": battery, **run_binding(ws, battery,
                                              manifest.get("config_hash"))}
    except Exception:          # an unregistered / unreadable set: say nothing
        return None


def before_registration_text(runs: list[dict]) -> str:
    """mt-eval runs of a test file made before forge registered it, in one
    clause: they happened, and forge's read accounting does not count them."""
    shown = ", ".join(f"{r['run_id']}" + (f" ({r['ts']})" if r.get("ts")
                                           else "") for r in runs[:3])
    more = f" and {len(runs) - 3} more" if len(runs) > 3 else ""
    return (f"reads before registration (not counted): {len(runs)} mt-eval "
            f"run(s) scored this exact file before forge registered it — "
            f"{shown}{more}")


def harness_reads_line(name: str, hr: dict) -> str:
    """What mt-eval's reads of a test/sealed file mean, in one line."""
    before = hr.get("before_registration") or []
    tail = (f"; {before_registration_text(before)} — forge's read log "
            "started at registration, so they are not in it: count them "
            "when you judge a test score" if before else "")
    if not hr.get("watched"):
        return (f"outside forge: {name} — no read log beside the file "
                f"({hr['log']}), so reads by mt-eval are NOT tracked; any "
                "forge read of the set creates it" + tail)
    if not hr["reads"]:
        if not hr.get("other_content"):
            return f"outside forge: {name}{tail.replace('; ', ' — ', 1)}"
        return (f"outside forge: {name} — mt-eval scored only an earlier "
                f"content of this file ({hr['other_content']}×)" + tail)
    kinds = ", ".join(f"{p} ×{n}" for p, n in sorted(hr["by_purpose"].items()))
    return (f"outside forge: {name} was scored {hr['reads']}× by mt-eval "
            f"({kinds}; last {hr['last']}) — those reads count: a prereg "
            "written now is a postdiction (`--allow-after-reads`), a sealed "
            "set is spent, and export says the score is not a first look"
            + tail)


def _prereg_text(b: dict | None) -> str:
    """One run's binding, for the run line."""
    if not b:
        return ""
    if b["state"] == "judged":
        return f" · prereg {b['id']} (judged against it)"
    if b["state"] == "would-bind":
        return f" · prereg {b['id']} ({b['how']})"
    if b["state"] == "ambiguous":
        return (f" · prereg AMBIGUOUS ({', '.join(b['candidates'])}) — "
                "export needs --prereg <id>")
    return " · no preregistration binds it yet"


def _dev_text(r: dict) -> str:
    d = r.get("dev_score") or {}
    if not isinstance(d.get("score"), (int, float)):
        return "no dev score"
    ci = d.get("ci")
    from .scoring_standard import label

    return (f"dev {label(d['metric'])} {d['score']:.2f}"
            + (f" [{ci[0]:.2f}, {ci[1]:.2f}]" if ci else ""))


def _run_line(r: dict) -> str:
    """One trained run: checkpoint, dev score (⚠ when saturated), and where
    it was exported — or that it was not."""
    exp = r.get("exports") or []
    where = ("exported → " + ", ".join(
        (x.get("model_dir") or x.get("dir") or "?")
        + ("" if x.get("model_included", True) else " (evaluation only)")
        for x in exp)) if exp else "not exported"
    return (f"run {r['run']}: checkpoint "
            f"{r.get('selected_checkpoint') or 'see manifest'} · "
            f"{_dev_text(r)}" + (" ⚠ SATURATED" if r.get("dev_saturated")
                                 else "") + f" · {where}"
            + _prereg_text(r.get("prereg")))


def _initialized_advice(s: dict) -> Advice:
    """`nmt-forge init` ran (config.json beside the workspace) but no eval
    set is registered yet: the next step is the split — never "discover,
    then init" again (Round 6 hospital persona)."""
    from .scaffold import step_order, step_order_text

    proj = s["project"] or {}
    dev = proj.get("dev") or "project-dev"
    battery = proj.get("battery") or "project-test"
    prefix = dev[:-4] if dev.endswith("-dev") else "project"
    # THE order (scaffold.STEP_ORDER), own test set first — the guide's
    # route (Round 11: init's note, its next step and the guide disagreed).
    # The chain stops after the audit: status then names the
    # preregistration (Round 9); the split follows it
    own_test = (f"nmt-forge registry add {battery} <your-test.jsonl> --role "
                f"test && nmt-forge leak-audit <corpus.jsonl> --clean-to "
                f"corpus.clean.jsonl   # then the predictions (status names "
                f"them) BEFORE any benchmark on the test set, then: "
                f"nmt-forge split corpus.clean.jsonl --test 0 --dev <N> --seed "
                f"<S> --out data/split --register {prefix}")
    carve = (f"nmt-forge split <corpus.jsonl> --test <M> --dev <N> --seed "
             f"<S> --out data/split --register {prefix}")
    names_ok = (dev == f"{prefix}-dev" and battery == f"{prefix}-test")
    return Advice(
        state="initialized",
        command=f"{own_test}   # OR, with no test set of your own: {carve}",
        why=("the project is initialized (config.json at "
             f"{proj.get('config')}) and no eval set is registered yet. Get "
             "a parallel corpus locally (a .jsonl of {\"source\", "
             "\"target\"} rows, or a .tsv). With your OWN test set (teacher- "
             "or nurse-checked, private) kept as a separate file, the order "
             f"is: {step_order_text()} — the first command runs the first "
             "two steps. Mark a private test file local-only before "
             "anything reads it (NEXT_STEPS.md, step 2). Register it with "
             "forge before any benchmark run on it, so every read is "
             "counted (its read log starts at registration; earlier mt-eval "
             "runs found in the harness's run logs are listed as reads "
             "before registration, not counted) — and write the predictions "
             "(`nmt-forge prereg …`, status names it next) before any "
             "benchmark too: a benchmark is a scoring read, and a "
             "preregistration written after one is refused. With no test "
             "set of your own, the second command carves a group-disjoint "
             f"split instead of the first two steps: --register {prefix} "
             f"registers {prefix}-dev (checkpoint selection) and "
             f"{prefix}-test (the scored test set) — the names config.json "
             "already points at"
             + ("" if names_ok else
                f" (config.json expects dev {dev!r} and test {battery!r}: "
                "register those names, or edit config.json)")
             + "; the predictions still come before any score."),
        ready=[f"project initialized: {proj.get('config')}"]
        + ([f"brief: {proj['next_steps']}"] if proj.get("next_steps") else []),
        blockers=["no dev/test/sealed sets registered yet"],
        order=step_order(test=battery, prefix=prefix),
    )


_SERVE_WHY = (
    "serve it and point the champollion CLI at it (DEPLOY.md in the model "
    "directory has the exact champollion.config.json snippet, with a "
    "fallback for the strings the model cannot do); deploy the model "
    "directory only — the evaluation/ folder beside it holds your test "
    "sentences, and its mt-eval report compares with any mt-eval run")


#: How long ``status`` waits for a served model's ``/health`` (seconds).
HEALTH_PROBE_TIMEOUT_S = 1.0


def serve_liveness(rec: dict) -> dict:
    """Is the server a serve record (``snapshot()["serve_records"]``)
    describes still answering? ``{state, why}``:

    - ``up``: its ``/health`` answers, naming this model;
    - ``down``: stopped cleanly (``serve-stop``), its process is gone (pid
      check on this host — the run lock's), or nothing (or another model)
      answers at its address;
    - ``unknown``: a record older than Round 12 (no address, no pid), or a
      server on another host.

    One loopback request with a short timeout — the only thing ``status``
    does that is not a file read (Round 12 hospital persona: status said
    "serve <chosen>/model" while that model was being served)."""
    import socket

    if rec.get("stopped"):
        return {"state": "down",
                "why": f"its server stopped at {rec['stopped']}"}
    url = rec.get("url")
    if not url or not rec.get("pid"):
        return {"state": "unknown",
                "why": "this serve record (written by an nmt-forge older "
                       "than 2026-10-04) carries no address or process id"}
    if rec.get("hostname") and rec["hostname"] != socket.gethostname():
        return {"state": "unknown",
                "why": f"it was served on host {rec['hostname']!r} — not "
                       "checkable from here"}
    from .runlock import _pid_state

    try:
        pid_state = _pid_state(int(rec["pid"]), rec.get("started"))
    except (TypeError, ValueError):
        pid_state = "unknown"
    if pid_state in ("dead", "reused"):
        return {"state": "down",
                "why": f"its process ({rec['pid']}) is gone"}
    import urllib.request

    probe = str(url).replace("://0.0.0.0:", "://127.0.0.1:") + "/health"
    # loopback, never through a proxy from the environment
    opener = urllib.request.build_opener(urllib.request.ProxyHandler({}))
    try:
        with opener.open(probe, timeout=HEALTH_PROBE_TIMEOUT_S) as r:
            doc = json.loads(r.read().decode("utf-8"))
    except (OSError, ValueError) as e:
        return {"state": "down",
                "why": f"nothing answers at {url}/health "
                       f"({type(e).__name__})"}
    if not isinstance(doc, dict) or doc.get("model") != rec.get("model"):
        return {"state": "down",
                "why": f"{url} answers, but as "
                       f"{(doc or {}).get('model') if isinstance(doc, dict) else doc!r}"
                       f", not {rec.get('model')!r}"}
    return {"state": "up",
            "why": f"{url}/health answers as {rec.get('model')} (process "
                   f"{rec.get('pid')}, serving since {rec.get('ts')})"}


def _latest_serve(s: dict, model_dir) -> dict | None:
    """The newest serve record of ``model_dir`` (resolved), or None."""
    for rec in reversed(s.get("serve_records") or []):
        if _same_path(rec.get("model_dir"), model_dir):
            return rec
    return None


def _serve_advice(s: dict, servable: list[dict], ready: list[str]) -> Advice:
    """Which export to serve: the one the user chose (the last one `nmt-forge
    choose` / `serve --choose` recorded), the only one, or — with several and
    no choice recorded — a CHOICE for the user, every export listed with what
    it measured. Never the newest by default, and never the one merely
    served (Round 10: an agent's provisional serve read as the user's
    choice)."""
    def model_dir(x):
        return x.get("model_dir") or x["dir"]

    listed = [{k: x.get(k) for k in ("run", "dir", "model_dir", "test_set",
                                     "score", "strict_score", "caveat",
                                     "score_caveats", "hypotheses",
                                     "recall_not_translation", "twin_free",
                                     "twin_free_siblings", "prereg",
                                     "exported_utc")}
              for x in servable]
    by_dir = {str(Path(model_dir(x)).resolve()): x for x in servable}
    chosen = next((by_dir[str(Path(d).resolve())]
                   for d in reversed(s.get("chosen") or [])
                   if str(Path(d).resolve()) in by_dir), None)
    served = next((by_dir[str(Path(d).resolve())]
                   for d in reversed(s.get("served") or [])
                   if str(Path(d).resolve()) in by_dir), None)
    if chosen is not None or len(servable) == 1:
        pick = chosen or servable[0]
        ready.append(f"exported: {_export_line(pick)}")
        others = [x for x in servable if x is not pick]
        other_text = (". Other exports: " + "; ".join(_export_line(x)
                                                      for x in others)
                      if others else "")
        # served already? (Round 12 hospital persona: the state never moved
        # past "serve" while the chosen model was serving the app)
        rec = _latest_serve(s, model_dir(pick))
        live = serve_liveness(rec) if rec else None
        if live and live["state"] == "up":
            ready.append(f"served: {rec['url']} — {live['why']}")
            return Advice(
                state="serving",
                command=(f"npx champollion sync   # in your app, with "
                         f"{model_dir(pick)}/DEPLOY.md's api method (endpoint "
                         f"{rec['url']}/translate)"),
                why=("the " + ("chosen " if chosen is not None else "")
                     + f"model is served and answering at {rec['url']} — "
                     "forge has nothing left to run. What is left is the "
                     "app's: point the champollion CLI at it (DEPLOY.md §2a "
                     "has the champollion.config.json snippet, with a "
                     "fallback for what the model cannot do), then `npx "
                     "champollion sync` and `npx champollion verify` in the "
                     "app; a speaker reviews the strings before anyone "
                     "relies on them. Deploy the model directory only. To "
                     f"stop serving: Ctrl-C in its terminal (process "
                     f"{rec.get('pid')})" + other_text),
                ready=ready, exports=listed if others else None)
        cmd = f"nmt-forge serve {model_dir(pick)}"
        why = ("the run is evaluated and exported — " if chosen is None else
               "the export the user chose (recorded by `nmt-forge choose`) "
               "— ") + _SERVE_WHY
        if live and live["state"] == "down" and rec.get("port"):
            # the same address, so an app configured for it keeps working
            cmd += f" --port {rec['port']}"
            if rec.get("host") and rec["host"] != "127.0.0.1":
                cmd += f" --host {rec['host']}"
            why = (f"it was served at {rec['url']} ({rec.get('ts')}) and is "
                   f"not now — {live['why']}: start it again at the same "
                   "address, so an app configured for it keeps working. "
                   + _sentence_case_first(why))
        elif live:
            why = (f"a serve of it was recorded ({rec.get('ts')}), but "
                   f"{live['why']} — if that server still answers, nothing "
                   "is left to run here; otherwise start it: "
                   + why)
        return Advice(state="exported", command=cmd,
                      why=why + other_text, ready=ready,
                      exports=listed if others else None)
    lines = "; ".join(f"({i}) {_export_line(x)}"
                      for i, x in enumerate(servable, 1))
    trial = (f" Currently served (a trial, NOT the choice): "
             f"{model_dir(served)}." if served is not None else "")
    if served is not None:
        ready.append(f"served (not chosen): {model_dir(served)}")
    return Advice(
        state="choose-export",
        command="nmt-forge choose <the model directory the user chooses: "
                + " | ".join(model_dir(x) for x in servable) + ">",
        why=(f"{len(servable)} exported models — the USER chooses which one "
             "to deploy; forge never picks the newest for them, and serving "
             f"one to try it is not a choice.{trial} {lines}. A model "
             "trained on all the data is usually the more useful one, but "
             "cite the twin-free score as how it handles new sentences "
             "(DEPLOY.md says so)" + _flagged_twin_free_note(servable)
             + ". The user's answer is recorded by "
             "`nmt-forge choose <model dir>` (or `nmt-forge serve <model dir> "
             "--choose`); `nmt-forge status` then points at it. "
             + _SERVE_WHY),
        ready=ready,
        blockers=[f"{len(servable)} exports and no recorded choice — ask the "
                  "user which model to deploy"],
        exports=listed,
    )


# -- preflight ----------------------------------------------------------------

@dataclass
class Gate:
    name: str
    ok: bool
    detail: str
    fix: str = ""
    # a WARNING passes (ok stays True, the exit code is unaffected) but says
    # something the user should act on before spending compute
    warning: bool = False

    def to_json(self) -> dict:
        return {"gate": self.name, "ok": self.ok, "detail": self.detail,
                "fix": self.fix, "warning": self.warning}


_KNOWN = ("run", "score", "split", "prereg", "leak-audit", "evaluate",
          "export", "serve")
_NEEDS_CONFIG = ("run", "evaluate", "export")


def _load_config(config_path: str | Path | None):
    """(RunConfig | None, Gate) — the config gate every config-driven
    preflight starts with. A missing --config falls back to ./config.json
    (what `nmt-forge init` writes)."""
    from .training.config import RunConfig

    path = Path(config_path) if config_path else Path("config.json")
    if not path.is_file():
        return None, Gate(
            "config", False,
            f"no run config at {path}"
            + ("" if config_path else " (pass --config <path>)"),
            fix="nmt-forge init <iso639-3> writes config.json; then "
                "nmt-forge preflight run --config config.json")
    try:
        cfg = RunConfig.from_file(path)
    except Exception as e:      # ConfigError/JSON — shown, not raised
        return None, Gate("config", False, f"{path}: {e}",
                          fix="fix the config (unknown keys are refused, "
                              "never guessed)")
    # the FULL hash: the value `prereg new --config-hash` pins (a prefix
    # never matches the run manifest's config_hash)
    return cfg, Gate("config", True,
                     f"{path} parses (config hash {cfg.hash()})")


def _backend_gate(cfg) -> Gate:
    from .training.backends import HF_BACKENDS, HF_INSTALL, hf_missing

    backend = (cfg.model or {}).get("backend")
    if backend not in HF_BACKENDS:
        return Gate("backend-installed", True,
                    f"backend {backend!r} needs no extra")
    missing = hf_missing(cfg.model)
    if missing:
        return Gate("backend-installed", False,
                    f"backend {backend!r} needs {', '.join(missing)} — not "
                    "installed (the run would refuse)",
                    fix=HF_INSTALL)
    base = (cfg.model or {}).get("base")
    note = ""
    if backend == "hf-seq2seq" and base and not Path(str(base)).exists():
        note = (f"; base {base!r} downloads from the Hugging Face hub on first "
                "use (once, then cached)")
    return Gate("backend-installed", True,
                f"backend {backend!r}: torch/transformers/accelerate "
                f"importable{note}")


def _plugins_gate(cfg) -> Gate:
    """selection.plugins are imported at the START of a run — a missing
    referee package refuses before any training, so preflight says so."""
    from .plugins import spec_importable

    specs = list(cfg.selection.plugins or ())
    if not specs:
        return Gate("selection-plugins", True, "no selection plugins")
    missing = sorted({str(sp).partition(":")[0] for sp in specs
                      if not spec_importable(sp)})
    return Gate(
        "selection-plugins", not missing,
        (f"not importable: {missing}" if missing
         else f"{len(specs)} plugin(s) importable"),
        fix="these lanes are OPTIONAL — remove the entries from "
            "selection.plugins to train without them, or install the "
            "package that provides them (`nmt-forge discover <code>` names "
            "it, e.g. the separately licensed champollion-lyss for crk)")


def _run_lock_gate(ws: Workspace) -> Gate:
    from .runlock import describe, read_lock

    rec = read_lock(ws)
    if rec and rec["state"] in ("held", "unverifiable"):
        return Gate("no-run-in-progress", False,
                    f"a training run holds this workspace: {describe(rec)}",
                    fix="wait for it to finish — `nmt-forge status` reports "
                        "`training` until it does; never start a second run"
                        + ("" if rec["state"] == "held" else
                           f" (unverifiable from here: {rec.get('why')}; if "
                           f"you KNOW it ended, delete {rec['path']})"))
    detail = "no run in progress"
    if rec:
        detail += (f" (a stale lock remains — {rec.get('why', rec['state'])}"
                   "; `nmt-forge run` clears it)")
    return Gate("no-run-in-progress", True, detail)


def _what_fix(e: Exception) -> tuple[str, str]:
    """A forge refusal as (what, fix): the first line without its
    ``[guard]`` tag, and its fix (a GuardrailViolation's attribute, or the
    ``fix:`` line a plain ForgeError carries in its text)."""
    text = str(e)
    lines = text.splitlines() or [""]
    what = lines[0]
    if what.startswith("[") and "] " in what:
        what = what.split("] ", 1)[1]
    fix = getattr(e, "fix", "") or ""
    if not fix:
        for line in lines[1:]:
            if line.strip().startswith("fix:"):
                fix = line.strip()[4:].strip()
                break
    return what, fix


def config_training_files(cfg) -> list[str]:
    """Every gold and synthetic file a run config trains on, across its
    curriculum stages (a stage may override ``gold`` / ``synthetic``), in
    order, once each — paths as the config gives them."""
    out: list[str] = []
    for stage in (cfg.curriculum or [{}]):
        stage = stage or {}
        files = [str(g) for g in stage.get("gold", cfg.gold) or []]
        for lane in stage.get("synthetic", cfg.synthetic) or []:
            p = (getattr(lane, "path", None)
                 or (lane.get("path") if isinstance(lane, dict) else None))
            if p:
                files.append(str(p))
        out += [f for f in files if f not in out]
    return out


def _dev_fence_gate(ws: Workspace, cfg, dev: list[str]):
    """The dev fence run applies (``DevFence.require_dev``): registered, role
    dev, unchanged since registration, no row shared with a registered
    test/sealed set — and (``require_disjoint_training``, Round 12) no
    training row that IS a dev row, in every file the config trains on. Read
    here with purpose ``audit`` — a preflight is not a checkpoint selection.
    ``(Gate, dev rows | None, {training file: rows that are dev rows})``."""
    from .errors import DevFenceError, ForgeError
    from .guards.dev_fence import DevFence

    fix = ("nmt-forge split <corpus> --test <M|0> --dev <N> --seed <S> --out "
           "data/split --register project  (registers project-dev), or point "
           "data.dev at a registered dev set")
    try:
        entry = ws.registry.get(cfg.dev)
    except Exception:
        entry = None
    if not entry or entry["role"] != "dev":
        return Gate(
            "dev-fence", False,
            f"config data.dev = {cfg.dev!r}: "
            + (f"registered as role={entry['role']!r}" if entry
               else "NOT registered") + f" (dev sets: {dev or 'NONE'})",
            fix=fix), None, {}
    fence = DevFence(ws)
    try:
        rows = ws.registry.open_eval(cfg.dev, "audit")
        fence.check_rows(rows, source_field=entry["source_field"],
                         target_field=entry["target_field"],
                         _context=f"registered dev set {cfg.dev!r}")
    except ForgeError as e:
        what, efix = _what_fix(e)
        return Gate("dev-fence", False,
                    f"config data.dev = {cfg.dev!r}: {what}",
                    fix=efix or fix), None, {}
    dev_rows = [{"source": str(r.get(entry["source_field"], "")),
                 "target": str(r.get(entry["target_field"], ""))}
                for r in rows]
    files = config_training_files(cfg)
    try:
        overlap = fence.require_disjoint_training(
            cfg.dev, rows, files, source_field=entry["source_field"],
            target_field=entry["target_field"],
            fix_for=lambda f: dev_overlap_fix(ws, f, cfg.dev))
    except DevFenceError as e:
        # THE check run makes before training (same function, same files):
        # the twin-free corpus written before the split held 111 dev rows
        # and this gate passed (Round 12 hospital persona)
        what, efix = _what_fix(e)
        return (Gate("dev-fence", False,
                     f"config data.dev = {cfg.dev!r}: {what}", fix=efix),
                dev_rows, getattr(e, "overlap", None) or {})
    except (ForgeError, OSError, ValueError, KeyError) as e:
        # an unreadable training file: the training-mix gate reports it
        overlap = {}
        note = f"; training files not compared ({str(e).splitlines()[0]})"
    else:
        note = (f"; no row of the {len(overlap)} training file(s) is a dev "
                "row" if overlap else "")
    return Gate("dev-fence", True,
                f"config data.dev = {cfg.dev!r}: registered, role=dev, "
                f"unchanged, {len(rows)} row(s), no row shared with a "
                f"test/sealed set{note}"), dev_rows, overlap


def _training_data_fix(ws: Workspace, cfg, missing: list[str]) -> str:
    """Where the missing training file most likely is: the train side of the
    split that registered the config's dev set (Round 10 researcher: a split
    written to another --out left config.json naming data/split/train.jsonl,
    which did not exist, and nothing said so)."""
    base = ("carve the split first (it writes data/split/train.jsonl), or fix "
            "the paths in config.data (relative paths are read from the "
            "directory you run forge in)")
    if not missing:
        return base
    try:
        entry = ws.registry.get(cfg.dev)
        train = Path(entry["path"]).parent / "train.jsonl"
    except Exception:
        return base
    if not train.is_file():
        return base
    try:
        shown = str(train.resolve().relative_to(Path.cwd().resolve()))
    except ValueError:
        shown = str(train)
    return (f"the split that registered {cfg.dev!r} wrote its train side to "
            f"{shown}: set config data.gold to [\"{shown}\"] (and "
            f"eval.near_dupe_corpus to \"{shown}\"), or carve the split again "
            "with --out data/split")


def _mix_gates(ws: Workspace, cfg, missing: list[str]) -> list[Gate]:
    """The data guards run applies when it builds the training mix — the SAME
    ``build_mix`` call, stage by stage: the leak-audit of every gold and
    synthetic lane (fatal on an answer leak into a test/sealed set), the
    synthetic validity floor, lane tags and the kind cap. ``leak-audit``
    fails on a leak; ``training-mix`` on any other refusal."""
    from .errors import ForgeError, LeakageError
    from .training.mix import build_mix

    if missing or not (cfg.gold or cfg.synthetic):
        why = "not checked: training file(s) not there yet (see training-data)"
        return [Gate("leak-audit", False, why,
                     fix="fix the training-data gate first"),
                Gate("training-mix", False, why,
                     fix="fix the training-data gate first")]
    lanes = len(cfg.gold) + len(cfg.synthetic)
    try:
        for stage in (cfg.curriculum or [{}]):
            build_mix(cfg, ws, stage_overrides=stage or None)
    except LeakageError as e:
        what, _ = _what_fix(e)
        files = ", ".join([str(g) for g in cfg.gold]
                          + [str(l.path) for l in cfg.synthetic])
        return [Gate("leak-audit", False,
                     f"run would refuse: {what} (training files: {files})",
                     fix=("screen each file first — nmt-forge leak-audit "
                          "<file> --clean-to <file stem>.clean.jsonl — and "
                          "point the config (data.gold / the lane) at the "
                          "cleaned file; template siblings are kept")),
                Gate("training-mix", True, "not reached (the leak-audit "
                                           "refusal comes first)")]
    except ForgeError as e:
        what, efix = _what_fix(e)
        return [Gate("leak-audit", True,
                     f"{lanes} lane(s) audited against "
                     f"{len(ws.registry.names(roles=('test', 'sealed')))} "
                     "test/sealed set(s): no answer leaks"),
                Gate("training-mix", False, f"run would refuse: {what}",
                     fix=efix)]
    except (OSError, ValueError, KeyError) as e:
        return [Gate("leak-audit", False,
                     f"could not build the training mix: {e}",
                     fix="fix the training files the config names")]
    return [Gate("leak-audit", True,
                 f"{lanes} lane(s) audited against "
                 f"{len(ws.registry.names(roles=('test', 'sealed')))} "
                 "test/sealed set(s), as run audits them: no answer leaks "
                 "(template siblings are kept and reported)"),
            Gate("training-mix", True,
                 "the mix run builds passes every data guard (validity "
                 "floor, lane tags, kind cap)")]


def _headroom_gate(cfg, dev_rows, backend_gate: Gate) -> Gate:
    """Run's generation-headroom guard, the same function on the same dev
    references with the same backend tokenizer, before any compute."""
    from .errors import ForgeError
    from .training.backends import make_backend
    from .training.selection import check_generation_headroom

    if dev_rows is None:
        return Gate("generation-headroom", False,
                    "not checked: the dev set is not readable (see dev-fence)",
                    fix="fix the dev-fence gate first")
    if not backend_gate.ok:
        return Gate("generation-headroom", False,
                    "not checked: the backend is not installed (see "
                    "backend-installed) — its tokenizer measures the "
                    "references", fix=backend_gate.fix)
    try:
        backend = make_backend(cfg.model)
        h = check_generation_headroom(
            [r["target"] for r in dev_rows], cfg.decode.max_new_tokens,
            backend.token_len, headroom_factor=cfg.decode.headroom_factor)
    except ForgeError as e:
        what, efix = _what_fix(e)
        return Gate("generation-headroom", False, f"run would refuse: {what}",
                    fix=efix)
    except Exception as e:      # a tokenizer that cannot load: run fails too
        return Gate("generation-headroom", False,
                    f"could not measure the dev references: "
                    f"{type(e).__name__}: {str(e).splitlines()[0] if str(e) else ''}",
                    fix="fix what the message names — run measures the same "
                        "way and would fail here")
    return Gate("generation-headroom", True,
                f"decode.max_new_tokens {h['max_new_tokens']} ≥ "
                f"{h['required_min']} (longest dev reference "
                f"{h['max_ref_tokens']} tokens × {h['headroom_factor']})")


def twin_free_pair(ws: Workspace, battery: str, train_files,
                   snap: dict | None = None) -> dict | None:
    """The twin-free companion of a model trained on ``train_files`` (the
    all-data model) for test set ``battery``, when leak-audit
    ``--drop-test-twins`` wrote one: ``{clean_to, companion_config,
    trained}`` — or None (none written, or ``train_files`` IS the twin-free
    corpus). Read from the leak-audit verdicts in the ledger
    (``leak_audits``); split and preflight's test-near-twins gate both ask
    it, so both recognise the two-model route (Round 11)."""
    if snap is None:
        snap = snapshot(ws)
    la = ((snap or {}).get("leak_audits") or {}).get(battery) or {}
    tf = la.get("twin_free")
    if not tf or not tf.get("clean_to"):
        return None
    clean = _resolve_project_path(ws, tf["clean_to"])
    if any(_resolve_project_path(ws, g) == clean for g in train_files):
        return None                 # this IS the twin-free model's data
    return {"clean_to": tf["clean_to"],
            "companion_config": tf.get("companion_config"),
            "trained": bool(la.get("twin_free_trained")),
            # written before the dev set was registered (Round 12)
            "corpus": tf.get("corpus"),
            "predates_dev": list(tf.get("predates_dev") or [])}


def _two_model_state(ws: Workspace, cfg, battery: str, snap: dict | None):
    """:func:`twin_free_pair` for a run config's gold files."""
    return twin_free_pair(ws, battery, list(cfg.gold), snap)


def twin_free_export_caveats(ws: Workspace, clean_to) -> list[dict]:
    """The MAJOR mt-eval caveats on the exported score of every run trained
    on the twin-free file ``clean_to`` (verbatim; [] when none is exported
    or none is flagged)."""
    from .harness_caveats import majors

    s = snapshot(ws)
    clean = _resolve_project_path(ws, clean_to)
    manifests = [r["manifest"] for r in s.get("runs") or []
                 if clean in (r.get("training_files") or [])]
    out: list[dict] = []
    for x in s.get("exports") or []:
        if any(x.get("manifest") and _same_path(x["manifest"], m)
               for m in manifests):
            out += majors(x.get("score_caveats"))
    return out


def two_model_note(ws: Workspace, battery: str, message: str | None,
                   pair: dict) -> tuple[str, str]:
    """What the all-data model's test near-twins mean on the two-model
    route, as ``(detail, fix)`` — said by preflight's test-near-twins gate
    and by split, in the same words: the twins are expected for this model,
    the twin-free model's score is the measure of new sentences, and (until
    it is trained) the command that trains it. ``message`` (the measure) is
    left out when the caller already printed it."""
    project = ws.root.parent
    companion = (_rel_to(pair["companion_config"], project)
                 if pair.get("companion_config") else None)
    twin_free = _rel_to(pair["clean_to"], project)
    detail = ((f"{battery}: {message} — expected" if message else
               f"{battery}: these twins are expected")
              + " for the ALL-DATA "
              "model of the two-model route: its test score is recall of "
              "training phrases. The twin-free model "
              + (f"({companion}, " if companion else "(")
              + f"trained on {twin_free}) is the measure of new sentences: "
              "quote its score beside this one, never this one alone")
    flagged = (twin_free_export_caveats(ws, pair["clean_to"])
               if pair.get("trained") else [])
    if flagged:
        # its exported score carries a MAJOR mt-eval caveat: never "the
        # measure of new sentences" bare (Round 13)
        from .harness_caveats import short_label

        detail += (" — but mt-eval puts a SCORE CAVEAT on that model's "
                   "exported score (" + ", ".join(short_label(c)
                                                  for c in flagged)
                   + "; `nmt-forge status` lists it): quote it only with "
                     "that caveat")
    fix = ("" if pair["trained"] else
           "train the twin-free model too: "
           + (f"nmt-forge preflight run --config {companion} && "
              f"nmt-forge run {companion}" if companion else
              "a config with data.gold and eval.near_dupe_corpus set to "
              f"{twin_free}"))
    if fix and pair.get("predates_dev"):
        # the split that just registered the dev set carved it from the
        # corpus the twin-free file was cut from (Round 12 hospital persona)
        fix = (predates_dev_text(ws, pair) + "; then t" + fix[1:])
    return detail, fix


#: The ledger event split and ``preflight run`` write with THE dev twin
#: verdict (``ci_scoring.dev_twin_verdict``, content-free) — so ``status``
#: says the same verdict after their output has scrolled away (Round 11).
DEV_TWIN_EVENT = "dev-twin-verdict"


def record_dev_twin_verdict(ws: Workspace, dev_name: str, forecast: dict, *,
                            compared_with: list[str],
                            carve_check: dict | None = None,
                            capped: dict | None = None) -> None:
    """Ledger the dev near-twin measure and its verdict for registered dev
    set ``dev_name`` at its current content, against the training files
    ``compared_with`` (resolved paths). A repeat of the newest record (same
    numbers, same verdict) is not written again."""
    from .guards.ci_scoring import _chained

    try:
        sha = ws.registry.get(dev_name)["sha256"]
    except Exception:
        return
    v = forecast.get("verdict") or {}
    rec = {"set": dev_name, "sha256": sha,
           "compared_with": [str(x) for x in compared_with],
           "n": forecast.get("n"),
           "near_twin_rows": forecast.get("near_twin_rows"),
           "near_twin_share": forecast.get("near_twin_share"),
           "message": forecast.get("message"),
           "state": v.get("state"), "final": bool(v.get("final")),
           "carve_check": carve_check if _chained(carve_check) else None,
           "capped": capped}
    try:
        prior = [e for e in ws.ledger.find(DEV_TWIN_EVENT, set=dev_name)
                 if e.get("sha256") == sha
                 and e.get("compared_with") == rec["compared_with"]]
    except Exception:
        prior = []
    if prior and all(prior[-1].get(k) == rec[k] for k in rec):
        return
    ws.ledger.append(DEV_TWIN_EVENT, **rec)


def dev_twin_records(ws: Workspace, dev_name: str) -> list[dict]:
    """The newest :data:`DEV_TWIN_EVENT` per training-file set for
    ``dev_name`` at its CURRENT content (a rotated dev set's verdicts no
    longer apply)."""
    try:
        sha = ws.registry.get(dev_name)["sha256"]
        events = ws.ledger.find(DEV_TWIN_EVENT, set=dev_name)
    except Exception:
        return []
    latest: dict[tuple, dict] = {}
    for e in events:
        if e.get("sha256") == sha:
            latest[tuple(e.get("compared_with") or [])] = e
    return list(latest.values())


def dev_twin_line(ws: Workspace, rec: dict) -> str:
    """One recorded dev twin verdict, in the words split and preflight
    used (:func:`ci_scoring.dev_twin_verdict` rebuilt from the record)."""
    from .guards.ci_scoring import dev_twin_verdict

    project = ws.root.parent
    files = ", ".join(_rel_to(f, project) for f in rec.get("compared_with")
                      or [])
    v = dev_twin_verdict(rec.get("carve_check"), dev_name=rec.get("set"),
                         capped=rec.get("capped"))
    return (f"dev set {rec.get('set')}: {rec.get('message')} (compared with "
            f"{files}) — {v['advice']}")


def _near_twin_gate(ws: Workspace, cfg, snap: dict | None = None) -> Gate:
    """WARNING, never a block: what share of the test battery's rows have a
    near-twin in the training data — the count export reports AFTER scoring,
    measured here while the test set is unspent. With a twin-free companion
    already written (the two-model route), it says what this model's score
    is and what to quote beside it — not to fix it (Round 10)."""
    from .guards.ci_scoring import registered_near_twin_forecast

    name = "test-near-twins"
    ev = cfg.eval_battery or {}
    battery = ev.get("battery")
    if not battery:
        return Gate(name, True, "not checked: the config has no eval block "
                                "(no test battery to compare with training)")
    try:
        entry = ws.registry.get(battery)
    except Exception:
        return Gate(name, True, f"not checked: eval.battery {battery!r} is "
                                "not registered yet")
    if entry["role"] not in ("test", "sealed"):
        return Gate(name, True, f"not checked: {battery!r} is role="
                                f"{entry['role']}, not a test set")
    train_files = ([ev["near_dupe_corpus"]] if ev.get("near_dupe_corpus")
                   else list(cfg.gold) + [l.path for l in cfg.synthetic])
    missing = [f for f in train_files if not Path(f).is_file()]
    if not train_files or missing:
        return Gate(name, True, "not checked: training file(s) not there yet"
                                + (f" ({missing})" if missing else ""))
    from .errors import ForgeError
    from .registry import load_rows

    try:
        rows: list[dict] = []
        for f in train_files:
            rows.extend(load_rows(f))
        forecast = registered_near_twin_forecast(
            ws, rows, names=[battery])[battery]
        if forecast.get("near_twin_rows"):
            # name the near-dupe re-split only where it can work (Round 7)
            from .guards.ci_scoring import near_dupe_carve_check, near_twin_advice

            forecast["advice"] = near_twin_advice(near_dupe_carve_check(rows))
    except (ForgeError, OSError, KeyError, ValueError) as e:
        # the run's own gates report broken files/sets; this check says
        # only that it could not be made
        return Gate(name, True, f"not checked: {str(e).splitlines()[0]}")
    flagged = bool(forecast.get("near_twin_rows"))
    pair = _two_model_state(ws, cfg, battery, snap) if flagged else None
    if pair:
        detail, fix = two_model_note(ws, battery, forecast["message"], pair)
        return Gate(name, True, detail, fix=fix, warning=True)
    return Gate(name, True,
                f"{battery}: {forecast['message']}"
                + (f" (compared with {', '.join(train_files)})"
                   if flagged else ""),
                fix=forecast.get("advice") or "", warning=flagged)


def _dev_near_twin_gate(ws: Workspace, cfg,
                        dev_overlap: dict | None = None) -> Gate:
    """WARNING, never a block: dev rows with a near-twin in the training
    files — the test forecast's measure and threshold, for the set
    checkpoint selection reads (Round 6: preflight was green while 7
    training rows near-duplicated the dev set). Not measured while training
    rows ARE dev rows (``dev_overlap``, the dev-fence gate's count): the
    near-twin reading assumes a split that shares no exact sentence, and no
    dev twin verdict is recorded for such a file (Round 12)."""
    from .errors import ForgeError
    from .guards.ci_scoring import dev_near_twin_forecast
    from .registry import load_rows

    name = "dev-near-twins"
    hit = {f: n for f, n in (dev_overlap or {}).items() if n}
    if hit:
        return Gate(name, True, "not checked: "
                    + ", ".join(f"{n} row(s) of {f}" for f, n in hit.items())
                    + f" ARE rows of {cfg.dev} (see dev-fence) — measured "
                    "once the training files hold no dev row")
    try:
        entry = ws.registry.get(cfg.dev)
    except Exception:
        return Gate(name, True, f"not checked: data.dev {cfg.dev!r} is not "
                                "registered yet")
    train_files = list(cfg.gold) + [l.path for l in cfg.synthetic]
    missing = [f for f in train_files if not Path(f).is_file()]
    if not train_files or missing:
        return Gate(name, True, "not checked: training file(s) not there yet"
                                + (f" ({missing})" if missing else ""))
    try:
        rows: list[dict] = []
        for f in train_files:
            rows.extend(load_rows(f))
        # the registry's audited path (purpose audit — ledgered, no spend)
        dev_rows = ws.registry.open_eval(cfg.dev, "audit")
        f = dev_near_twin_forecast(
            dev_rows, rows, dev_source_field=entry["source_field"],
            dev_target_field=entry["target_field"])
        check = capped = None
        if f.get("near_twin_rows"):
            # a re-split carves train + dev: can --near-dupe work on them?
            from .guards.ci_scoring import (apply_dev_twin_verdict,
                                            near_dupe_carve_check)

            both = [{"source": str(r.get("source", "")),
                     "target": str(r.get("target", r.get("reference", "")))}
                    for r in rows]
            both += [{"source": str(r.get(entry["source_field"], "")),
                      "target": str(r.get(entry["target_field"], ""))}
                     for r in dev_rows]
            check = near_dupe_carve_check(both, target_field="target")
            # a dev set carved with --max-group, measured against the
            # split's own train side: split recorded the cap
            files = [_resolve_project_path(ws, t) for t in train_files]
            capped = next((r.get("capped") for r in dev_twin_records(
                ws, cfg.dev) if r.get("capped")
                and r.get("compared_with") == files), None)
            apply_dev_twin_verdict(f, check, dev_name=cfg.dev, capped=capped)
        if f.get("checked"):
            record_dev_twin_verdict(
                ws, cfg.dev, f,
                compared_with=[_resolve_project_path(ws, t)
                               for t in train_files],
                carve_check=check, capped=capped)
    except (ForgeError, OSError, KeyError, ValueError) as e:
        return Gate(name, True, f"not checked: {str(e).splitlines()[0]}")
    flagged = bool(f.get("near_twin_rows"))
    return Gate(name, True, f"{cfg.dev}: {f['message']}"
                + (f" (compared with {', '.join(train_files)})"
                   if flagged else ""),
                fix=f.get("advice") or "", warning=flagged)


def _workspace_gate(ws: Workspace, cfg) -> Gate:
    cfg_ws = Path(cfg.workspace).resolve()
    same = cfg_ws == ws.root
    return Gate("workspace-match", same,
                f"config.workspace → {cfg_ws}"
                + ("" if same else f", but you are inspecting {ws.root}"),
                fix="run forge from the project directory (cd <project>), or "
                    "pass --workspace to match config.workspace — otherwise "
                    "the run reads a different registry than split/prereg "
                    "wrote")


def preflight(ws: Workspace, command: str,
              config_path: str | Path | None = None) -> list[Gate]:
    """Every gate ``command`` will hit, evaluated against workspace state
    (and, for run/evaluate/export, the run config).

    Deliberately conservative: gates that depend on runtime arguments
    (file paths) are reported as informational with the check they will
    trigger, so the agent knows what is COMING even when it can't be
    verified yet. A green preflight must never be followed by a refusal the
    preflight could have predicted — that is the contract.
    """
    if command not in _KNOWN:
        return [Gate("known-command", False,
                     f"{command!r} has no preflight profile",
                     fix=f"one of: {', '.join(_KNOWN)}")]
    s = snapshot(ws)
    dev, test, sealed = s["roles"]["dev"], s["roles"]["test"], s["roles"]["sealed"]
    prereg_evals = {p["eval"] for p in s["preregs"] if p["eval"]}
    gates: list[Gate] = []

    cfg = None
    if command in _NEEDS_CONFIG:
        cfg, g = _load_config(config_path)
        gates.append(g)
        if cfg is not None:
            gates.append(_workspace_gate(ws, cfg))

    if command == "run":
        gates.append(_run_lock_gate(ws))
        if cfg is not None:
            # Round 10 (researcher): preflight passed twice, then `nmt-forge
            # run` refused — on decode headroom and on a leak-audit. Every
            # gate below runs the SAME check run runs, on the same files,
            # with the same severity: a green preflight is a run that does
            # not refuse before training starts.
            fence_gate, dev_rows, dev_overlap = _dev_fence_gate(ws, cfg, dev)
            gates.append(fence_gate)
            missing = [g for g in cfg.gold if not Path(g).is_file()]
            missing += [l.path for l in cfg.synthetic
                        if not Path(l.path).is_file()]
            gates.append(Gate(
                "training-data", bool(cfg.gold or cfg.synthetic) and not missing,
                (f"missing: {missing}" if missing else
                 f"{len(cfg.gold)} gold + {len(cfg.synthetic)} synthetic "
                 "file(s) present") if (cfg.gold or cfg.synthetic)
                else "config.data lists no gold/synthetic files",
                fix=_training_data_fix(ws, cfg, missing)))
            backend_gate = _backend_gate(cfg)
            gates.append(backend_gate)
            gates.append(_plugins_gate(cfg))
            gates.append(_near_twin_gate(ws, cfg, s))
            gates.append(_dev_near_twin_gate(ws, cfg, dev_overlap))
            gates.extend(_mix_gates(ws, cfg, missing))
            gates.append(_headroom_gate(cfg, dev_rows, backend_gate))
        else:
            gates.append(Gate("dev-fence", bool(dev),
                              f"dev set registered: {dev or 'NONE'}",
                              fix="split your corpus and register the dev "
                                  "file with role=dev"))
            gates.append(Gate("leak-audit", False,
                              "not checked: no readable run config — the "
                              "audit run applies needs the config's files",
                              fix="fix the config gate first"))
            gates.append(Gate("generation-headroom", False,
                              "not checked: no readable run config — run "
                              "measures the decode cap against the config's "
                              "dev set",
                              fix="fix the config gate first"))
        gates.append(Gate("schedule-sanity", True,
                          "regime, early-stop floor and eval cadence are "
                          "derived from the config's data mix — no flags "
                          "needed (never a refusal)"))
    elif command in ("evaluate", "export"):
        ev = (cfg.eval_battery if cfg is not None else None) or {}
        battery = ev.get("battery")
        entry = None
        if battery:
            try:
                entry = ws.registry.get(battery)
            except Exception:
                entry = None
        gates.append(Gate(
            "eval-battery", bool(entry),
            (f"eval.battery = {battery!r}: "
             + (f"registered, role={entry['role']}" if entry
                else "NOT registered")) if battery
            else "config has no eval block",
            fix='add "eval": {"battery": "<registered test set>"} to the '
                "config and register that set (nmt-forge registry add …)"
                + (" — or export with --no-eval to package the model only"
                   if command == "export" else "")))
        if entry and entry["role"] in ("test", "sealed"):
            gates.append(Gate(
                "preregistration", battery in prereg_evals,
                f"prereg bound for {battery!r}: "
                + ("yes" if battery in prereg_evals else "NO"),
                fix="nmt-forge prereg template --out predictions.json; edit "
                    f"it; nmt-forge prereg new <id> --eval-set {battery} "
                    "--predictions predictions.json"))
        if entry and entry["role"] == "sealed":
            spent = ws.ledger.sealed_spent(battery)
            gates.append(Gate("sealed-unspent", not spent,
                              f"sealed set {battery!r} "
                              + ("ALREADY SPENT" if spent else "unspent"),
                              fix="a sealed set is one-shot — export with "
                                  "--no-eval to package without re-scoring"))
        runs_ok = bool(s["runs"])
        gates.append(Gate("trained-run", runs_ok,
                          f"run manifests: {len(s['runs'])}",
                          fix="nmt-forge run config.json"))
        if cfg is not None:
            gates.append(_backend_gate(cfg))
    elif command == "serve":
        from .training.backends import HF_INSTALL, hf_missing

        missing = hf_missing({"backend": "hf-seq2seq"})
        gates.append(Gate("backend-installed", not missing,
                          "serving loads the exported model with "
                          "torch/transformers"
                          + (f" — missing {', '.join(missing)}" if missing
                             else ""),
                          fix=HF_INSTALL))
        servable = [e.get("model_dir") or e["dir"]
                    for e in s.get("exports", [])
                    if e.get("model_included", True) and e.get("dir")]
        gates.append(Gate("export-dir", bool(servable),
                          f"exports with a model: {servable or 'NONE'}",
                          fix="nmt-forge export <run-manifest> --out export/ "
                              "(without --no-model)"))
    elif command == "score":
        target_sets = test + sealed
        gates.append(Gate("eval-registered", bool(target_sets),
                          f"test/sealed set(s): {target_sets or 'NONE'}",
                          fix="nmt-forge registry add <name> <file> --role test"))
        missing = [t for t in target_sets if t not in prereg_evals]
        gates.append(Gate("preregistration", not missing,
                          "prereg bound for: "
                          f"{sorted(prereg_evals) or 'NONE'}"
                          + (f"; MISSING for: {missing}" if missing else ""),
                          fix="nmt-forge prereg template --out "
                              "predictions.json; edit it; nmt-forge prereg "
                              "new <id> --eval-set <name> --predictions "
                              "predictions.json"))
        spent = [name for name in sealed if ws.ledger.sealed_spent(name)]
        gates.append(Gate("sealed-unspent", not spent,
                          f"sealed sets already spent: {spent or 'none'}",
                          fix="a sealed set is one-shot; there is no fix — "
                              "that is the point"))
    elif command == "split":
        gates.append(Gate("group-disjoint", True,
                          "pairs sharing a canonical source OR target land "
                          "on ONE side; verified after the carve, crash on "
                          "any overlap"))
        if test or sealed:
            gates.append(Gate(
                "external-test", True,
                f"registered test/sealed set(s): {test + sealed} — carve with "
                "--test 0 to keep them separate files, and screen the corpus "
                "against them first (leak-audit --clean-to)"))
    elif command == "prereg":
        gates.append(Gate("eval-registered", bool(test or sealed),
                          f"needs a registered test/sealed set: "
                          f"{(test + sealed) or 'NONE'}",
                          fix="register the eval first"))
        gates.append(Gate("predictions-format", True,
                          "predictions must be a .json ARRAY of prediction "
                          "objects — `nmt-forge prereg template` writes a "
                          "valid file to edit"))
    elif command == "leak-audit":
        gates.append(Gate("evals-registered", bool(dev or test or sealed),
                          "audit screens against registered dev/test/sealed "
                          f"sets: {dev + test + sealed or 'NONE'}",
                          fix="register your eval sets first or pass "
                              "prebuilt key sets"))
    return gates


# -- rendering ----------------------------------------------------------------

def render_status(ws: Workspace) -> str:
    s = snapshot(ws)
    a = next_action(ws)
    lines = [f"workspace: {s['workspace']}", ""]
    for role in ("dev", "test", "sealed"):
        names = s["roles"][role]
        lines.append(f"  {role:<7} {', '.join(names) if names else '—'}")
    lines.append("  prereg  " + ("; ".join(
        f"{p['id']} → "
        + (("run " + ", ".join(p["runs"])) if p.get("runs") else
           "no run yet") + f" ({p['eval']})"
        + (f" ⚠ written after {p['after_reads']['reads']} scoring read(s) "
           "— --allow-after-reads override" if p.get("after_reads") else "")
        for p in s["preregs"]) or "—"))
    for name, hr in (s.get("harness_reads") or {}).items():
        lines.append("  " + harness_reads_line(name, hr))
    lines.append(f"  runs    {len(s['runs']) or '—'}")
    for r in s["runs"]:
        lines.append(f"    · {_run_line(r)}")
    if s.get("active_run"):
        from .runlock import describe

        lines.append(f"  training NOW: {describe(s['active_run'])}")
    elif s.get("stale_run_lock"):
        lk = s["stale_run_lock"]
        lines.append(f"  (a stale run lock remains — {lk.get('why', lk['state'])}; "
                     "the next `nmt-forge run` clears it)")
    lines.append("")
    for r in a.ready:
        if r.startswith("run ") and s["runs"]:
            continue          # listed under `runs` above
        lines.append(f"  ✓ {r}")
    for w in a.warnings:
        lines.append(f"  ⚠ {w}")
    for b in a.blockers:
        lines.append(f"  ✗ {b}")
    lines.append("")
    lines.append(f"NEXT: {a.command}")
    lines.append(f"      ({a.why})")
    return "\n".join(lines)


def render_preflight(ws: Workspace, command: str,
                     config_path: str | Path | None = None,
                     gates: list[Gate] | None = None) -> str:
    gates = gates if gates is not None else preflight(ws, command, config_path)
    lines = [f"preflight: nmt-forge {command}", ""]
    for g in gates:
        mark = "✗" if not g.ok else ("⚠" if g.warning else "✓")
        lines.append(f"  {mark} {g.name}: {g.detail}")
        if (not g.ok or g.warning) and g.fix:
            lines.append(f"      {'fix' if not g.ok else 'what to do'}: "
                         f"{g.fix}")
    lines.append("")
    warnings = sum(g.ok and g.warning for g in gates)
    lines.append(("ALL GATES PASS" if all(g.ok for g in gates)
                  else f"{sum(not g.ok for g in gates)} gate(s) would refuse "
                       "— fix them first")
                 + (f" · {warnings} warning(s) — read them before spending "
                    "compute" if warnings else ""))
    return "\n".join(lines)
