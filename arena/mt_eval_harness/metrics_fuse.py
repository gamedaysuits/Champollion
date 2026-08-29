"""FUSE-style comparator metric — a reimplementation of the AmericasNLP-2025 approach.

FUSE (Raja & Vats, "FUSE: A Ridge and Random-Forest-Based Metric for Evaluating MT
in Indigenous Languages", AmericasNLP 2025) won the shared task on MT metrics for
Indigenous languages by BLENDING multilingual sentence embeddings (LaBSE), lexical
similarity, phonetic similarity, and fuzzy token matching, fitted with Ridge /
Gradient-Boosting regressors trained on human-judgment dev sets.

THIS IS A REIMPLEMENTATION OF THE *APPROACH*, NOT THE ORIGINAL TRAINED MODEL.
We have no human-judgment training data for the relevant language pairs, so we
cannot reproduce the trained Ridge/GBM. Instead we compute the FUSE feature set
and combine it with a TRANSPARENT, UNTRAINED blend (mean of the available,
normalized components). It is a REPORTED COMPARATOR — never part of the composite —
so the leaderboard can show FST-gated/structural scoring against a FUSE-style
baseline. Every component that actually ran is disclosed (``components_used``);
nothing is silently assumed, and the result is labelled ``untrained=True``.

License: this reimplementation is Champollion's own code (Apache-2.0). LaBSE
(sentence-transformers) is Apache-2.0; jellyfish (phonetic) is BSD.

Optional dependencies (install the ``fuse`` extra): sentence-transformers (LaBSE),
jellyfish (Soundex). Without LaBSE — the semantic heart of FUSE — compute_fuse
returns None rather than pretending to compute a FUSE-style score.
"""

from __future__ import annotations

import difflib
from collections import Counter
from dataclasses import dataclass

try:
    from sentence_transformers import SentenceTransformer, util as _st_util
    HAS_LABSE = True
except ImportError:
    HAS_LABSE = False

try:
    import jellyfish as _jellyfish
    HAS_PHONETIC = True
except ImportError:
    HAS_PHONETIC = False


_LABSE_MODEL_NAME = "sentence-transformers/LaBSE"
_LABSE_MODEL = None


def _load_labse():
    """Load + cache the LaBSE model (downloads ~1.8 GB on first use)."""
    global _LABSE_MODEL
    if _LABSE_MODEL is None:
        _LABSE_MODEL = SentenceTransformer(_LABSE_MODEL_NAME)
    return _LABSE_MODEL


def lexical_similarity(hyp: str, ref: str) -> float:
    """Token-overlap F1 (case-insensitive). 0.0–1.0. No dependencies."""
    h = hyp.lower().split()
    r = ref.lower().split()
    if not h and not r:
        return 1.0
    if not h or not r:
        return 0.0
    overlap = sum((Counter(h) & Counter(r)).values())
    prec = overlap / len(h)
    rec = overlap / len(r)
    return 0.0 if (prec + rec) == 0 else 2 * prec * rec / (prec + rec)


def fuzzy_similarity(hyp: str, ref: str) -> float:
    """Character-level fuzzy ratio via stdlib difflib (no deps). 0.0–1.0."""
    return difflib.SequenceMatcher(None, hyp.lower(), ref.lower()).ratio()


def phonetic_similarity(hyp: str, ref: str) -> float | None:
    """Token-position Soundex agreement rate. None if jellyfish is unavailable.

    NOTE: Soundex is English-oriented; for non-English targets it is a crude
    proxy (as in the original FUSE). Treated as one weak component of the blend.
    """
    if not HAS_PHONETIC:
        return None
    h = hyp.lower().split()
    r = ref.lower().split()
    if not h or not r:
        return 0.0
    n = min(len(h), len(r))
    matches = 0
    for i in range(n):
        try:
            if _jellyfish.soundex(h[i]) == _jellyfish.soundex(r[i]):
                matches += 1
        except Exception:
            pass
    return matches / max(len(h), len(r))


@dataclass
class FuseResult:
    corpus_score: float          # mean per-entry FUSE-style blend (0.0–1.0)
    per_entry_scores: list[float]
    n_entries: int
    components_used: list[str]   # which feature components actually ran
    untrained: bool = True       # ALWAYS True — this is NOT the trained FUSE model


def compute_fuse(entries: list[dict], batch_size: int = 64) -> FuseResult | None:
    """Compute the FUSE-style comparator over entries with 'expected' + 'predicted'.

    Returns None when LaBSE (the semantic backbone) is unavailable — we do NOT
    pretend to compute a FUSE-style score without its core component. The caller
    treats fuse_score as a REPORTED COMPARATOR (never in the composite).
    """
    if not HAS_LABSE:
        return None

    valid = [
        e for e in entries
        if not e.get("error")
        and (e.get("expected") or "").strip()
        and (e.get("predicted") or "").strip()
    ]
    if not valid:
        return None

    hyps = [e["predicted"] for e in valid]
    refs = [e["expected"] for e in valid]

    model = _load_labse()
    h_emb = model.encode(
        hyps, batch_size=batch_size, convert_to_tensor=True, normalize_embeddings=True
    )
    r_emb = model.encode(
        refs, batch_size=batch_size, convert_to_tensor=True, normalize_embeddings=True
    )
    sem = [float(_st_util.cos_sim(h_emb[i], r_emb[i])) for i in range(len(valid))]

    components = ["semantic(LaBSE)", "lexical(token-F1)", "fuzzy(difflib)"]
    if HAS_PHONETIC:
        components.append("phonetic(soundex)")

    per_entry: list[float] = []
    for i in range(len(valid)):
        feats = [
            max(0.0, min(1.0, sem[i])),            # clamp cosine to 0–1
            lexical_similarity(hyps[i], refs[i]),
            fuzzy_similarity(hyps[i], refs[i]),
        ]
        ph = phonetic_similarity(hyps[i], refs[i])
        if ph is not None:
            feats.append(ph)
        per_entry.append(sum(feats) / len(feats))  # untrained mean blend

    corpus = sum(per_entry) / len(per_entry)
    return FuseResult(
        corpus_score=round(corpus, 4),
        per_entry_scores=[round(s, 4) for s in per_entry],
        n_entries=len(valid),
        components_used=components,
        untrained=True,
    )
