"""The synthesis engine — rows exist only by passing the emit law.

There is no API for writing a raw pair to the corpus. A row is born from a
template's Candidate and survives, in order:

1. the template's named plausibility filters (drops counted per filter);
2. the round-trip law: every Unit generate-verifies against the pack's
   analyzer (mistakes it kills: unverified/garbled forms);
3. literal validation: every Lit is analyzer-accepted or cited in the pack's
   closed-class list — a bad Lit is a TEMPLATE BUG and fails the whole build
   loudly, not a data-attrition statistic;
4. orthography: the assembled target is canonicalized ONCE (guard #5), and
   the whole build is convention-linted incrementally — a pack whose
   canonicalizer leaks mixed conventions fails its own build;
5. provenance stamping: kind (citation guaranteed by Template), lemma,
   origin, the pack's ``champollion-derived`` provenance string, and
   ``synthetic: true`` (which is what lets the eval registry REFUSE synthetic
   rows in test sets — founder ruling: tests are real data only).

The build's exhaust is a funnel + kind counts + a coverage report against the
pack's cited grammar checklist, written as a manifest next to the corpus.
Volume can no longer hide a structural gap (guard #6) or silent attrition
(guard #4).
"""

from __future__ import annotations

import json
from collections import Counter
from pathlib import Path

from ..errors import ConventionError, SynthesisError
from ..guards.coverage_map import coverage
from ..guards.funnel_audit import Funnel
from .analyzer import accepts, generate_verified
from .packs import LanguagePack
from .templates import Candidate, Lit, Punct, Template, Unit

STAGES = ["candidates", "filtered", "verified", "emitted"]


class SynthesisEngine:
    def __init__(self, pack: LanguagePack, *, seed: int = 42):
        self.pack = pack
        self.seed = seed
        self.analyzer = pack.analyzer()
        self.closed = dict(pack.closed_class())
        self.conventions = pack.conventions()
        self.funnel = Funnel(f"synthesis:{pack.code}", STAGES)
        self.kind_counts: Counter[str] = Counter()
        self._gen_cache: dict[str, str | None] = {}
        self._lit_ok: set[str] = set()
        # all declared conventions start at 0 so the manifest shows the
        # absence of the non-canonical one, not just the presence of one
        self._convention_counts: Counter[str] = Counter(
            {s.name: 0 for s in self.conventions})
        self._mixed_rows = 0

    # -- the law, piece by piece ------------------------------------------------
    def _gen_verified(self, analysis: str) -> str | None:
        if analysis not in self._gen_cache:
            self._gen_cache[analysis] = generate_verified(self.analyzer, analysis)
        return self._gen_cache[analysis]

    def _check_lit(self, text: str, template: Template) -> None:
        if text in self._lit_ok:
            return
        if accepts(self.analyzer, text) or text in self.closed:
            self._lit_ok.add(text)
            return
        raise SynthesisError(
            f"template {template.kind!r} uses literal {text!r} — the analyzer "
            "does not accept it and the pack's closed_class list does not "
            "cite it",
            why="an unvalidated literal is exactly how unverifiable tokens "
                "reach training targets; literals are template code, so this "
                "is a bug, not data attrition",
            fix="fix the spelling, or add it to the pack's closed_class() "
                "with the grammar citation that attests it",
        )

    def _build_row(self, cand: Candidate, template: Template) -> dict | None:
        tokens: list[str] = []
        for piece in cand.target:
            if isinstance(piece, Unit):
                surface = self._gen_verified(piece.analysis)
                if surface is None:
                    self.funnel.drop("verified", "round_trip_fail",
                                     item=piece.analysis)
                    return None
                tokens.append(surface)
            elif isinstance(piece, Lit):
                self._check_lit(piece.text, template)
                tokens.append(piece.text)
            elif isinstance(piece, Punct):
                if tokens:
                    tokens[-1] += piece.text
                else:
                    tokens.append(piece.text)
            else:  # pragma: no cover - type gate
                raise SynthesisError(
                    f"template {template.kind!r} produced a target piece of "
                    f"type {type(piece).__name__}; targets are built from "
                    "Unit/Lit/Punct only",
                    fix="emit Unit(analysis) for generated words, Lit for "
                        "cited closed-class words, Punct for punctuation",
                )
        target = self.pack.canonicalize(" ".join(tokens))
        row = {
            "source": cand.source,
            "target": target,
            "kind": template.kind,
            "lemma": cand.lemma,
            "origin": f"forge:{self.pack.code}",
            "provenance": self.pack.provenance(),
            "synthetic": True,
        }
        extra = cand.meta.get("row_extra")
        if isinstance(extra, dict):
            for k, v in extra.items():
                row.setdefault(k, v)
        return row

    def _lint_row(self, target: str) -> None:
        present = [s.name for s in self.conventions if s.present_in(target)]
        for name in present:
            self._convention_counts[name] += 1
        if len(present) >= 2:
            self._mixed_rows += 1

    # -- the build ------------------------------------------------------------
    def run(self, out_path: str | Path, *, limit_per_kind: int | None = None) -> dict:
        out_path = Path(out_path)
        out_path.parent.mkdir(parents=True, exist_ok=True)
        templates = self.pack.templates()
        kinds = [t.kind for t in templates]
        dupes = [k for k, n in Counter(kinds).items() if n > 1]
        if dupes:
            raise SynthesisError(
                f"duplicate template kinds {dupes}",
                why="kind is the unit of coverage and strata accounting; a "
                    "duplicate splits its numbers invisibly",
                fix="give each template a distinct kind slug",
            )
        ctx = self.pack.context(seed=self.seed)

        with out_path.open("w", encoding="utf-8") as f:
            for t in templates:
                emitted = 0
                for cand in t.realize(ctx):
                    self.funnel.tick("candidates")
                    dropped_by = next(
                        (flt.name for flt in t.filters if not flt(cand)), None
                    )
                    if dropped_by is not None:
                        self.funnel.drop("filtered", f"filter:{dropped_by}")
                        continue
                    self.funnel.tick("filtered")
                    row = self._build_row(cand, t)
                    if row is None:
                        continue
                    self.funnel.tick("verified")
                    self._lint_row(row["target"])
                    f.write(json.dumps(row, ensure_ascii=False) + "\n")
                    self.funnel.tick("emitted")
                    self.kind_counts[t.kind] += 1
                    emitted += 1
                    if limit_per_kind is not None and emitted >= limit_per_kind:
                        break

        # guard #5, applied to our own output: a pack whose canonicalizer
        # leaks mixed conventions fails its own build.
        if self.conventions:
            present = [n for n, c in self._convention_counts.items() if c]
            if self._mixed_rows or len(present) >= 2:
                raise ConventionError(
                    f"synthesis output mixes orthographic conventions "
                    f"({self._mixed_rows} mixed rows; present: "
                    f"{dict(self._convention_counts)})",
                    why="the engine canonicalizes every target through the "
                        "pack — mixing here means the pack's canonicalizer "
                        "does not cover its own declared conventions",
                    fix="extend pack.canonicalize() to map every declared "
                        "convention onto the canonical one",
                )

        report = coverage(
            self.kind_counts,
            {t.kind: t.phenomena for t in templates},
            self.pack.checklist(),
        )
        manifest = {
            "generator": "nmt-forge synthesis-engine",
            "pack": {"code": self.pack.code, "name": self.pack.name,
                     "version": self.pack.version},
            "analyzer_id": getattr(self.analyzer, "analyzer_id",
                                   type(self.analyzer).__name__),
            "seed": self.seed,
            "limit_per_kind": limit_per_kind,
            "rows": sum(self.kind_counts.values()),
            "kind_counts": dict(self.kind_counts.most_common()),
            "template_citations": {t.kind: t.citation for t in templates},
            "funnel": self.funnel.report(),
            "coverage": report.to_manifest(),
            "conventions": dict(self._convention_counts),
            "provenance": self.pack.provenance(),
            "verification": "every Unit round-trip verified at generation; "
                            "every Lit analyzer-accepted or cited",
        }
        manifest_path = out_path.with_name(out_path.stem + "-manifest.json")
        manifest_path.write_text(
            json.dumps(manifest, indent=2, ensure_ascii=False) + "\n",
            encoding="utf-8",
        )
        return manifest
