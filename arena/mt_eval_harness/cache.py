"""
Deterministic File Cache — Cache translation results to avoid re-running.

Caching strategy:
    - batch_size=1: cache key = hash(config_hash + source_text)
    - batch_size>1: cache key = hash(config_hash + sorted batch source texts)

Cache files are plain JSON, one per cached result. The cache directory
is organized by config hash to prevent cross-contamination between
different configurations.

Design decisions:
    - File-per-entry (not SQLite) for easy inspection and git-friendliness
    - Config hash isolation: changing any relevant config parameter
      (model, prompt, tools, temperature) invalidates all prior cache
    - Human-readable filenames for debugging
"""

from __future__ import annotations

import hashlib
import json
from datetime import datetime, timezone
from pathlib import Path
from typing import TYPE_CHECKING

if TYPE_CHECKING:
    from mt_eval_harness.config import RunConfig


def _errored(result: dict) -> bool:
    """Canonical "did this result fail?" check for cache admission.

    Results mark failure via the ``error`` key (see strategies/single.py,
    strategies/batch.py, pipeline.apply_hooks); the batch error path also
    stamps an ``[ERROR: ...]`` translation. Check both — belt and braces —
    so a failure can never be cached and served forever (the only retry
    path used to be --no-cache, i.e. a full-corpus re-spend).
    """
    return bool(result.get("error")) or str(
        result.get("predicted", "")
    ).startswith("[ERROR:")


#: Dropped into the run-output and cache directories mt-eval makes. They hold
#: copies of the test sentences (sources, references, predictions) and sit
#: inside the user's project by default (eval/logs/harness, eval/cache/
#: harness) — one `git add --all` from being committed and pushed
#: (synthetic Cree-school persona, 2026-10-03). `*` ignores everything in the
#: directory, this file included, so the directory never shows up in git.
PRIVATE_DIR_GITIGNORE = (
    "# Written by mt-eval. Run logs, reports and caches in this directory\n"
    "# hold copies of your corpus sentences, so git ignores all of it.\n"
    "# To keep results in git, write them somewhere you choose with\n"
    "# --output-dir; mt-eval only adds this file to its default directories\n"
    "# and to directories it creates itself.\n"
    "*\n"
)


def ensure_private_dir(path, *, harness_default: bool = False) -> Path:
    """Create ``path`` (with parents) and keep it out of git.

    The ``.gitignore`` is written only if absent, and only into a directory
    mt-eval creates itself or one of its own default locations
    (``harness_default``) — a directory the user already had and pointed
    --output-dir at is theirs to manage.
    """
    p = Path(path)
    created = not p.exists()
    p.mkdir(parents=True, exist_ok=True)
    ignore = p / ".gitignore"
    if (created or harness_default) and not ignore.exists():
        ignore.write_text(PRIVATE_DIR_GITIGNORE, encoding="utf-8")
    return p


#: Where the cache keeps entries written for a PROTECTED corpus (local-only,
#: sealed or consent-required): <cache_dir>/protected/<namespace>/, never the
#: plain <cache_dir>/<config_hash>/ directory an ordinary run reads.
PROTECTED_SUBDIR = "protected"


def cache_protection(config, *, dataset_meta: dict | None, corpus_sha256: str,
                     corpus: list[dict] | None = None) -> dict | None:
    """The protection a run's cache entries carry, or None for an ordinary
    corpus.

    The translation cache holds copies of the test sentences (sources and
    model outputs). For a corpus whose sentences the harness withholds —
    local-only (a steward's mark), sealed or consent-required — those copies
    used to sit in the shared cache with no mark at all, keyed only by the
    config and the sentence (synthetic Cree-school persona, Round 4): any
    tool or agent reading eval/cache/harness/ saw private text with nothing
    saying so, a later `mt-eval run --corpus <cache file>` treated it as
    unrestricted, and an unmarked corpus run with the same config and the
    same sentence could be served the protected entry. With protection:

    * ``mark`` — the corpus's own terms (corpus_loader.derived_mark: the
      same mark the run log and report carry); every cache file gets a
      ``<file>.champollion.json`` sidecar with it, which every loader
      already honours (read_steward_sidecar);
    * ``corpus_key`` — the corpus's sha256 (or, for parallel text files, a
      sha256 over its loaded source/reference pairs), folded with the mark
      into the cache NAMESPACE, so an entry is only ever served to a run on
      the same protected corpus under the same terms — never to an unmarked
      corpus, never to another protected one.
    """
    from mt_eval_harness.corpus_loader import derived_mark
    to_dict = getattr(config, "to_dict", None)
    cfg = to_dict() if callable(to_dict) else dict(config or {})
    mark = derived_mark({"config": cfg,
                         "provenance": {"dataset_meta": dataset_meta or {}}})
    if not mark:
        return None
    key = str(corpus_sha256 or "").strip()
    if not key:
        src_f = cfg.get("source_field") or "source"
        ref_f = cfg.get("target_field") or "reference"
        pairs = [[str(e.get(src_f) or ""), str(e.get(ref_f) or "")]
                 for e in corpus or []]
        key = hashlib.sha256(json.dumps(pairs, ensure_ascii=False)
                             .encode("utf-8")).hexdigest()
    label = (Path(str(cfg.get("corpus_path"))).name if cfg.get("corpus_path")
             else cfg.get("dataset_id") or Path(str(cfg.get("source_file")
                                                    or "corpus")).name)
    return {"mark": mark, "corpus_key": key, "derived_from": label}


class ResultCache:
    """File-based deterministic cache for translation results.

    Each unique (config + input) combination maps to exactly one
    cached result file. The config_hash ensures that changing any
    parameter that affects output (model, prompt, tools, etc.)
    automatically creates a new cache namespace.
    """

    def __init__(self, config: "RunConfig", protection: dict | None = None):
        self.enabled = config.cache_enabled
        self.config_hash = config.config_hash()
        # A protected corpus (cache_protection) gets its own namespace, keyed
        # by the config AND the corpus AND its terms, under protected/ — an
        # ordinary run never reads there — and every file it writes carries
        # the corpus's mark in a sidecar.
        self.protection = protection or None
        if self.protection:
            self.key_seed = hashlib.sha256(json.dumps({
                "config_hash": self.config_hash,
                "corpus_key": self.protection["corpus_key"],
                "mark": self.protection["mark"],
            }, sort_keys=True, ensure_ascii=False).encode("utf-8")
            ).hexdigest()[:16]
            self.cache_dir = (Path(config.cache_dir) / PROTECTED_SUBDIR
                              / self.key_seed)
        else:
            self.key_seed = self.config_hash
            # Organize cache by config hash to prevent cross-contamination
            self.cache_dir = Path(config.cache_dir) / self.config_hash
        if self.enabled:
            from mt_eval_harness.config import DEFAULT_CACHE_DIR
            # The .gitignore goes at the cache ROOT, covering every hash dir.
            ensure_private_dir(
                config.cache_dir,
                harness_default=str(config.cache_dir) == DEFAULT_CACHE_DIR)
            self.cache_dir.mkdir(parents=True, exist_ok=True)

    def _entry_key(self, source_text: str) -> str:
        """Generate cache key for a single entry."""
        raw = f"{self.key_seed}|{source_text.strip()}"
        return hashlib.sha256(raw.encode()).hexdigest()[:16]

    def _batch_key(self, source_texts: list[str]) -> str:
        """Generate cache key for a batch of entries.

        The key incorporates all texts in their batch order so that
        the same entries in a different order produce a different key.
        This is intentional: batch composition affects the API response
        (the model sees all entries together in a numbered list).
        """
        combined = "|".join(t.strip() for t in source_texts)
        raw = f"{self.key_seed}|batch|{combined}"
        return hashlib.sha256(raw.encode()).hexdigest()[:16]

    def get(self, source_text: str) -> dict | None:
        """Load a cached single-entry result, or None if not cached."""
        if not self.enabled:
            return None
        key = self._entry_key(source_text)
        path = self.cache_dir / f"{key}.json"
        if path.exists():
            try:
                data = json.loads(path.read_text(encoding="utf-8"))
                return data.get("result")
            except (json.JSONDecodeError, KeyError):
                return None
        return None

    def put(self, source_text: str, result: dict) -> None:
        """Cache a single-entry result.

        Errored results are NEVER cached: a cached failure would be served
        on every subsequent run, and the only way to retry it would be
        --no-cache (re-spending the entire corpus). Skipping the write means
        the failed entry is simply retried on the next run, while successful
        entries still hit the cache.
        """
        if not self.enabled:
            return
        if _errored(result):
            return  # never cache failures — leave the entry retryable
        key = self._entry_key(source_text)
        path = self.cache_dir / f"{key}.json"
        payload = {
            "config_hash": self.config_hash,
            "source_text": source_text,
            "result": result,
            "cached_at": datetime.now(timezone.utc).isoformat(),
        }
        path.write_text(
            json.dumps(payload, ensure_ascii=False, indent=2),
            encoding="utf-8",
        )
        self._mark(path)

    def _mark(self, path: Path) -> None:
        """Give a protected entry its corpus's mark (a sidecar every loader
        honours) — written right after the entry, so no protected copy of a
        sentence ever sits in the cache unmarked."""
        if not self.protection:
            return
        from mt_eval_harness.corpus_loader import write_derived_sidecar
        write_derived_sidecar(path, self.protection["mark"],
                              derived_from=self.protection["derived_from"],
                              written_by="mt-eval cache")

    def has(self, source_text: str) -> bool:
        """Cheap single-entry existence check (a stat, no JSON load).

        Used by the pre-spend cost estimator (api.estimate_run_cost) to
        subtract already-cached entries without loading the whole cache.
        """
        if not self.enabled:
            return False
        return (self.cache_dir / f"{self._entry_key(source_text)}.json").exists()

    def has_batch(self, source_texts: list[str]) -> bool:
        """Cheap batch existence check (a stat, no JSON load) — see has()."""
        if not self.enabled:
            return False
        key = self._batch_key(source_texts)
        return (self.cache_dir / f"batch_{key}.json").exists()

    def get_batch(self, source_texts: list[str]) -> list[dict] | None:
        """Load cached batch results, or None if any entry is missing."""
        if not self.enabled:
            return None
        key = self._batch_key(source_texts)
        path = self.cache_dir / f"batch_{key}.json"
        if path.exists():
            try:
                data = json.loads(path.read_text(encoding="utf-8"))
                results = data.get("results", [])
                if len(results) == len(source_texts):
                    return results
            except (json.JSONDecodeError, KeyError):
                pass
        return None

    def put_batch(self, source_texts: list[str], results: list[dict]) -> None:
        """Cache a batch of results.

        A batch containing ANY errored entry is not cached at all. The batch
        cache format demands the full ordered batch (the key covers every
        source text in order, and get_batch requires len(results) ==
        len(source_texts)), so per-entry filtering is impossible without a
        format change. TRADEOFF: one transient failure inside a batch means
        the whole batch (up to batch_size entries) is re-bought on the retry
        run — bounded and cheap next to the alternative, where the cached
        failure is served forever and the only retry path is a --no-cache
        full-corpus re-spend.
        """
        if not self.enabled:
            return
        if len(source_texts) != len(results):
            return  # Safety: don't cache mismatched batches
        if any(_errored(r) for r in results):
            return  # never cache failures — leave the batch retryable
        key = self._batch_key(source_texts)
        path = self.cache_dir / f"batch_{key}.json"
        payload = {
            "config_hash": self.config_hash,
            "batch_size": len(source_texts),
            "source_texts": source_texts,
            "results": results,
            "cached_at": datetime.now(timezone.utc).isoformat(),
        }
        path.write_text(
            json.dumps(payload, ensure_ascii=False, indent=2),
            encoding="utf-8",
        )
        self._mark(path)

    def stats(self) -> dict:
        """Return cache statistics for the current config namespace."""
        if not self.enabled or not self.cache_dir.exists():
            return {"enabled": self.enabled, "entries": 0, "batches": 0}

        files = [f for f in self.cache_dir.glob("*.json")
                 if not f.name.endswith(".champollion.json")]
        entries = sum(1 for f in files if not f.name.startswith("batch_"))
        batches = sum(1 for f in files if f.name.startswith("batch_"))
        return {
            "enabled": True,
            "config_hash": self.config_hash,
            "protected": bool(self.protection),
            "cache_dir": str(self.cache_dir),
            "entries": entries,
            "batches": batches,
            "total_files": len(files),
        }
