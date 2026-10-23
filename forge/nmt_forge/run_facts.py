"""What a run is training — the facts the human-facing panel heads with.

Founder, 2026-10-13: "I should be able to tell what we're running — this has
no details (language, corpus source and character (pair count, avg sentence
length, etc.))". ``nmt-forge run`` writes ``run-facts.json`` into the run
folder when it STARTS (the manifest comes only at the end), so a panel
attached to a run in progress (``nmt-forge monitor``) can say what it is:

* the language pair, the model, the training pairs (per file: how many,
  from which corpus, under which licence) and the practice (dev) set's size;
* the corpus's character: average sentence length in words on each side, and
  in characters and bytes on the target side (a byte model such as ByT5
  reads bytes; a syllabics letter is three);
* the share of training sentences longer than the model reads (added by the
  trainer once it has counted them), the training passes planned, and when
  the run started.

CONTENT-FREE, like every forge summary: names, counts and averages — never a
sentence, never a word of the corpus. Missing facts are left out, never shown
as 0 or "undefined".

A job that knows more than the config says (a calibration ladder's rung, the
corpus a scratch training file was cut from) passes it in the environment —
display only, never part of the run's identity or its config hash::

    NMT_FORGE_RUN_FACTS='{"label": "calibration ladder: 6,400 of 400–12,800 pairs, seed 1",
                          "corpus": "tatoeba", "licence": "CC-BY-2.0-FR",
                          "source_name": "English", "target_name": "Klingon", "target_code": "tlh"}'

The file records which facts were given that way (``given``), so a reader can
tell forge's own records from a job's word.
"""

from __future__ import annotations

import json
import os
from datetime import datetime
from pathlib import Path

FACTS_BASENAME = "run-facts.json"
GIVEN_ENV = "NMT_FORGE_RUN_FACTS"
GIVEN_KEYS = ("label", "corpus", "licence", "source_name", "target_name", "target_code")
_GIVEN_MAX = 200          # characters: a label, a name — never a paragraph


def given_facts(environ=None) -> dict:
    """The display facts a job passed in ``NMT_FORGE_RUN_FACTS`` (a JSON
    object of :data:`GIVEN_KEYS`), or ``{}``. An unreadable value or an
    unknown key is said once and left out: these facts only describe."""
    raw = (os.environ if environ is None else environ).get(GIVEN_ENV, "").strip()
    if not raw:
        return {}
    try:
        data = json.loads(raw)
    except ValueError:
        data = None
    if not isinstance(data, dict):
        print(f"[run-facts] {GIVEN_ENV} is not a JSON object — ignored "
              f"(it takes {', '.join(GIVEN_KEYS)})", flush=True)
        return {}
    unknown = sorted(set(data) - set(GIVEN_KEYS))
    if unknown:
        print(f"[run-facts] {GIVEN_ENV}: {', '.join(unknown)} ignored "
              f"(it takes {', '.join(GIVEN_KEYS)})", flush=True)
    out = {}
    for k in GIVEN_KEYS:
        v = data.get(k)
        if isinstance(v, (str, int, float)) and not isinstance(v, bool):
            text = " ".join(str(v).split())[:_GIVEN_MAX]
            if text:
                out[k] = text
    return out


def _resolve(path: str, roots: list[Path]) -> Path:
    q = Path(path)
    if q.is_absolute():
        return q
    for root in roots:
        if (root / q).exists():
            return root / q
    return q


def _corpus_terms(path: Path) -> dict:
    """The harness's merged view of a file's sidecar / envelope / registered
    card (``license``, ``id``) — {} when there is none or it cannot be read
    (the mix reads the same terms and refuses loudly; this only describes)."""
    try:
        from . import _harness

        return _harness.corpus_terms(path)["meta"] or {}
    except Exception:
        return {}


def _rights_of(rights: dict | None) -> dict:
    """A lane's free-form rights note ({source, license_note}) as facts."""
    rights = rights or {}
    out = {}
    if rights.get("source"):
        out["corpus"] = str(rights["source"])
    lic = rights.get("license_note") or rights.get("license") or rights.get("licence")
    if lic:
        out["licence"] = str(lic)
    return out


def _side_lengths(rows: list[dict]) -> dict:
    """Averages over the pairs: words (runs of text between spaces) on each
    side, characters and UTF-8 bytes on the target side. Numbers only."""
    n = len(rows)
    if not n:
        return {}
    tgt_chars = tgt_bytes = 0
    src_lens, tgt_lens = [], []
    for r in rows:
        s, t = r["source"], r["target"]
        src_lens.append(len(s.split()))
        tgt_lens.append(len(t.split()))
        tgt_chars += len(t)
        tgt_bytes += len(t.encode("utf-8"))
    src_words, tgt_words = sum(src_lens), sum(tgt_lens)
    return {"avg_words": {"source": round(src_words / n, 1), "target": round(tgt_words / n, 1)},
            "median_words": {"source": _median(src_lens), "target": _median(tgt_lens)},
            "avg_target_chars": round(tgt_chars / n, 1),
            "avg_target_bytes": round(tgt_bytes / n, 1)}


def _median(values: list[int]) -> float:
    v = sorted(values)
    mid = len(v) // 2
    return float(v[mid]) if len(v) % 2 else (v[mid - 1] + v[mid]) / 2


#: config.model keys the panel shows as the run's settings (2026-10-14
#: dashboard): what a person comparing two runs needs to know differed
_SETTING_KEYS = ("batch_size", "grad_accum", "lr", "warmup_ratio", "weight_decay", "eval_steps", "patience",
                 "floor_steps", "max_src", "max_tgt", "label_smoothing", "optim", "gradient_checkpointing",
                 "mps_memory_fraction", "time_budget_hours", "seed", "device", "logging_steps",
                 "save_total_limit", "eval_rows_max")
#: what tells one preset from another (the rest — lr, epochs — a job may tune)
_PRESET_IDENTITY = ("backend", "base", "optim", "gradient_checkpointing", "lora")


def _settings(cfg) -> dict:
    """The run's training settings, as its config states them (numbers and
    names; a key the config leaves to the trainer's default is left out)."""
    model = cfg.model or {}
    out = {}
    for k in _SETTING_KEYS:
        v = model.get(k)
        if isinstance(v, bool) or (isinstance(v, (int, float, str)) and v != ""):
            out[k] = v
    if isinstance(out.get("batch_size"), int) and isinstance(out.get("grad_accum"), int):
        out["effective_batch"] = out["batch_size"] * out["grad_accum"]
    if isinstance(model.get("lora"), dict) and model["lora"].get("r"):
        out["lora_rank"] = model["lora"]["r"]
    raw_sel = (getattr(cfg, "raw", None) or {}).get("selection") or {}
    if isinstance(raw_sel, dict) and raw_sel.get("metric"):
        out["selection_metric"] = str(raw_sel["metric"])
    return out


def _preset_of(model: dict) -> str | None:
    """The forge preset whose identity (backend, base model, optimizer,
    memory saving, adapter) the model block matches, or None — a run may
    tune a preset's learning rate or passes and stay that preset."""
    try:
        from .training.presets import MODEL_PRESETS
    except Exception:
        return None
    hits = []
    other_bases = {p["model"].get("base") for p in MODEL_PRESETS.values() if p["model"].get("base")}
    for name, preset in MODEL_PRESETS.items():
        pm = preset.get("model") or {}
        ok = True
        for k in _PRESET_IDENTITY:
            want, have = pm.get(k), model.get(k)
            if k == "base" and preset.get("requires_base"):
                ok = bool(have) and have not in other_bases
            elif k == "lora":
                ok = bool(want) == bool(have)
            elif bool(want) != bool(have) or (want and want != have):
                ok = False
            if not ok:
                break
        if ok:
            hits.append(name)
    return hits[0] if len(hits) == 1 else None


def _read_pairs(path: Path) -> list[dict] | None:
    try:
        from .registry import load_rows

        rows = load_rows(path)
    except Exception:
        return None
    return [{"source": str(r.get("source", "")),
             "target": str(r.get("target", r.get("reference", "")))} for r in rows]


def describe_run(cfg, *, dev_entry: dict | None = None, roots: list[Path] | None = None,
                 started: str | None = None, environ=None) -> dict:
    """The run's facts (see the module doc) from its config, the dev set's
    registry entry, the training files' sidecars and what the job gave in
    ``NMT_FORGE_RUN_FACTS``. ``roots``: where a relative training path is
    looked for. Never raises over a fact it cannot read: that fact is left
    out."""
    from .cards import is_private_use

    given = given_facts(environ)
    roots = roots or [Path.cwd()]
    facts: dict = {"version": 1, "run_name": cfg.run_name,
                   "started": started or datetime.now().astimezone().isoformat(timespec="seconds")}
    if given.get("label"):
        facts["label"] = given["label"]

    lang = cfg.language or {}
    src, tgt = str(lang.get("source") or ""), str(lang.get("target") or "")
    src_name = given.get("source_name") or lang.get("source_name") or src
    tgt_name = given.get("target_name") or lang.get("target_name") or tgt
    # the code beside the name — not a private-use code (qaa–qtz names no language)
    tgt_code = given.get("target_code") or (
        tgt if tgt and tgt_name != tgt and not is_private_use(tgt) else None)
    if src_name or tgt_name:
        facts["languages"] = {k: v for k, v in (("from", src_name), ("to", tgt_name),
                                                ("to_code", tgt_code)) if v}

    model = cfg.model or {}
    base = model.get("base")
    m = {"name": str(base).rstrip("/").split("/")[-1] if base else model.get("backend"),
         "base": base, "backend": model.get("backend")}
    if model.get("init_from"):
        m["starts_from"] = Path(str(model["init_from"])).name
    m["preset"] = _preset_of(model)
    facts["model"] = {k: v for k, v in m.items() if v}

    gold_rows: list[dict] = []
    files = []
    data_rights = _rights_of(cfg.data_rights)
    for f in cfg.gold:
        p = _resolve(f, roots)
        rows = _read_pairs(p)
        if rows is None:
            continue
        gold_rows += rows
        meta = _corpus_terms(p)
        entry = {"file": p.name, "pairs": len(rows), **data_rights}
        if meta.get("id"):
            entry["corpus"] = str(meta["id"])
        if meta.get("license"):
            entry["licence"] = str(meta["license"])
        files.append(entry)
    generated = []
    for lane in cfg.synthetic:
        p = _resolve(lane.path, roots)
        rows = _read_pairs(p)
        if rows is None:
            continue
        meta = _corpus_terms(p)
        entry = {"file": p.name, "pairs": len(rows), "tag": lane.tag, **_rights_of(lane.rights)}
        if lane.origin:
            entry["origin"] = lane.origin
        if lane.dataset_id or meta.get("id"):
            entry["corpus"] = str(lane.dataset_id or meta["id"])
        if meta.get("license"):
            entry["licence"] = str(meta["license"])
        generated.append(entry)
    training: dict = {}
    if files:
        training["pairs"] = sum(e["pairs"] for e in files)
        training["files"] = files
        training.update(_side_lengths(gold_rows))
    if generated:
        training["generated"] = generated
    for k in ("corpus", "licence"):        # the job's word for the training corpus as a whole
        if given.get(k):
            training[k] = given[k]
    if training:
        facts["training"] = training

    if dev_entry:
        dev = {"name": cfg.dev}
        if isinstance(dev_entry.get("rows"), int) and dev_entry["rows"] > 0:
            dev["sentences"] = dev_entry["rows"]
        facts["dev"] = dev
    epochs = model.get("epochs")
    if isinstance(epochs, (int, float)) and not isinstance(epochs, bool) and epochs > 0:
        facts["epochs"] = epochs
    settings = _settings(cfg)
    if settings:
        facts["settings"] = settings
    if given:
        facts["given"] = sorted(given)
    return facts


def write_facts(run_dir: str | Path, facts: dict) -> Path:
    """Write ``run-facts.json`` whole (a reader never sees half a file)."""
    path = Path(run_dir) / FACTS_BASENAME
    tmp = path.with_name(FACTS_BASENAME + ".tmp")
    tmp.write_text(json.dumps(facts, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    os.replace(tmp, path)
    return path


def read_facts(run_dir: str | Path) -> dict | None:
    """The run's ``run-facts.json`` (in the run folder, or the folder above
    a stage folder), or None."""
    run_dir = Path(run_dir)
    for d in (run_dir, run_dir.parent):
        try:
            data = json.loads((d / FACTS_BASENAME).read_text(encoding="utf-8"))
        except (OSError, ValueError):
            continue
        if isinstance(data, dict):
            return data
    return None


def add_facts(run_dir: str | Path, **more) -> None:
    """Merge facts learned during the run (the trainer's length-limit
    counts) into ``run-facts.json``."""
    facts = read_facts(run_dir) or {}
    facts.update(more)
    write_facts(run_dir, facts)


def recover_facts(run_dir: str | Path) -> dict | None:
    """Facts for a run that wrote no ``run-facts.json`` (one started by an
    earlier forge): rebuilt from its config — named by the workspace's run
    lock while it trains, carried in its manifest once it has finished — and
    the workspace's registry entry for its dev set. None when neither can be
    read."""
    from .training.config import RunConfig

    run_dir = Path(run_dir).resolve()
    ws_root = run_dir.parent.parent              # <workspace>/runs/<run>
    cfg = config_dir = started = None
    try:
        lock = json.loads((ws_root / "run.lock").read_text(encoding="utf-8"))
        if Path(lock.get("run_dir", "")).resolve() == run_dir and lock.get("config"):
            config_dir = Path(lock["config"]).parent
            cfg = RunConfig.from_file(lock["config"])
            if isinstance(lock.get("created"), (int, float)):
                started = datetime.fromtimestamp(lock["created"]).astimezone().isoformat(timespec="seconds")
    except Exception:
        cfg = None
    if cfg is None:
        try:
            manifest = json.loads((run_dir / "run-manifest.json").read_text(encoding="utf-8"))
            cfg = RunConfig.from_dict(manifest["config"])
        except Exception:
            return None
    try:
        sets = json.loads((ws_root / "eval-registry.json").read_text(encoding="utf-8")).get("sets") or {}
        dev_entry = sets.get(cfg.dev)
    except (OSError, ValueError, AttributeError):
        dev_entry = None
    roots = [r for r in (config_dir, ws_root.parent, Path.cwd()) if r is not None]
    try:
        facts = describe_run(cfg, dev_entry=dev_entry, roots=roots, started=started, environ={})
    except Exception:
        return None
    if started is None:
        facts.pop("started", None)        # "now" is not when it started
    return facts
