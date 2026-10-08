"""engine_model — the model an MT engine ran, as every surface records it.

An engine that runs a model it is GIVEN (``takes_model``: the harness's
``local-model`` adapter) records what actually loaded, resolved before the
run by ``LocalModelMethod.resolve_identity`` and completed after it
(``model_identity()``: a hub model's revision, the decode length that
applied). This module is the one reading of that record for the run header,
the terminal run card, the publish preview, the published run card, the
fingerprint and `contest qualify`'s receipt — so they can never disagree
about which model a number belongs to.

Why it exists: ``mt-eval run --method local-model -m ./my-model`` used to
drop ``-m``, run a different model downloaded from the Hugging Face hub, and
record the run as model ``local-model`` with an empty ``method_model``. A
contest receipt was then minted from that run and nothing anywhere named the
model that produced it (synthetic researcher, Round 10).
"""

from __future__ import annotations

#: The fields of the record that are safe to publish: never the absolute
#: directory path (it names the user's home and folders).
PUBLIC_FIELDS = ("given", "kind", "id", "sha256", "revision", "family",
                 "backend", "decode", "pair_mismatch")


def from_run(config: dict | None, provenance: dict | None = None) -> dict | None:
    """The engine-model record of a run log (provenance first, then config —
    a TestReport carries only config), or None when the run recorded none."""
    for block in ((provenance or {}).get("engine_model"),
                  (config or {}).get("engine_model")):
        if isinstance(block, dict) and block.get("id"):
            return block
    return None


def engine_requires_model(config: dict | None) -> bool:
    """True when the run's engine runs a model it is given (local-model), so
    a run log that records none cannot say what produced its outputs."""
    mt = str((config or {}).get("mt_method") or "").strip().lower()
    if not mt:
        return False
    from mt_eval_harness.methods.registry import MT_METHOD_REGISTRY
    return bool(getattr(MT_METHOD_REGISTRY.get(mt), "takes_model", False))


def label(record: dict | None) -> str:
    """One line: what loaded and how it is identified."""
    if not record:
        return "not recorded"
    if record.get("kind") == "directory":
        n = len(record.get("files") or [])
        text = (f"{record.get('id')} (local directory, sha256 "
                f"{str(record.get('sha256') or '')[:12]}… over "
                f"{n} file{'s' if n != 1 else ''})")
    else:
        rev = record.get("revision")
        text = (f"{record.get('id')} (Hugging Face hub"
                + (f", revision {str(rev)[:12]}" if rev else
                   ", downloaded or read from the hub cache on first use")
                + ")")
    return text


def header_lines(record: dict) -> list[str]:
    """The run header's lines for the model that will load."""
    lines = [f"  Model:       {label(record)}"]
    if record.get("kind") == "directory" and record.get("path"):
        lines.append(f"               {record['path']}")
    lines.append(f"               from {record.get('from') or '-m/--model'}; "
                 f"{record.get('family')} family, "
                 f"{record.get('backend')} backend")
    mismatch = record.get("pair_mismatch")
    if mismatch:
        lines.append(f"  ⚠ Pair:      the model is for "
                     f"{mismatch.get('model_pair')}, this run is "
                     f"{mismatch.get('run_pair')} — run on purpose "
                     f"(--allow-model-pair-mismatch); recorded on the run")
    return lines


def public_block(record: dict | None) -> dict | None:
    """The record as the published run card carries it (no local paths)."""
    if not record:
        return None
    return {k: record.get(k) for k in PUBLIC_FIELDS if record.get(k) is not None}


def method_config_model(record: dict | None) -> str:
    """What `method_config.model` says for an engine run: the hub id (with
    its revision), or the directory's name and content hash — enough to
    reproduce or check it, never a local path."""
    if not record:
        return ""
    if record.get("kind") == "directory":
        return f"{record.get('id')}@sha256:{record.get('sha256')}"
    rev = record.get("revision")
    return f"{record.get('id')}@{rev}" if rev else str(record.get("id"))


def fingerprint_components(record: dict | None) -> dict:
    """The fingerprint components an engine-model run adds: the model and its
    content hash (directory) or revision (hub). Empty for a run that
    recorded no model, so every other run's fingerprint is unchanged."""
    if not record:
        return {}
    return {"method_model": record.get("id"),
            "method_model_sha256": record.get("sha256") or record.get("revision")}


def file_sha256s(record: dict | None) -> set[str]:
    """The per-file sha256s of a directory model (empty for a hub id)."""
    return {f.get("sha256") for f in (record or {}).get("files") or []
            if isinstance(f, dict) and f.get("sha256")}
