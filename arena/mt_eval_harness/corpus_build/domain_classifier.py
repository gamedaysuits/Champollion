# Ported from the internal corpora-builder (founder decision 2026-08-27):
# the fetch-on-miss corpus REBUILD path must work in the open-source harness
# — 5,595 of 5,602 registry corpora are fetch-from-source and corpus content
# is never tracked, so without these primitives a public clone could browse
# the queue and rebuild nothing (docs/PRE_REVIEW_HARDENING_2026-08-27.md).
# The intake/probe/recipe-authoring tooling remains in the private builder;
# this subpackage ships with the harness under the harness's license.
# Byte-parity with the private builder's copy is protected by the per-pair
# sha guards: a divergent rebuild fails loudly at publish, never silently.
"""
Rule-based domain classification for parallel text entries.

Uses keyword-matching heuristics to assign one of the 16 keyword-classifiable
domain codes to each corpus entry. (The full taxonomy is 17 codes — the 17th,
``humanitarian``, is label-only and never auto-assigned; see LABEL_ONLY_DOMAINS
and shared/domain-taxonomy.json.) This is intentionally rule-based rather than
ML-based because:

    1. The 16 domains are well-defined and keyword-separable for the
       kind of text found in Tatoeba and OPUS (short, topically clear).
    2. A rule-based classifier is fully deterministic — the same input
       always produces the same domain, which matters for reproducible
       corpus builds.
    3. Zero external dependencies. No models to download or GPU to provision.
    4. Easy to audit. Anyone can read the keyword lists and understand
       exactly why a sentence was classified a certain way.

Limitations:
    - Short ambiguous sentences may not match any keywords. The fallback
      domain is ``"conv"`` (conversational), which is a reasonable default
      for Tatoeba-style general sentences.
    - Keyword overlap between domains (e.g. "contract" in both legal and
      ecommerce) is resolved by whichever domain accumulates more total
      keyword matches.
"""

from __future__ import annotations

import re
from dataclasses import dataclass



# ---------------------------------------------------------------------------
# Domain keyword registry
# ---------------------------------------------------------------------------
# Each domain maps to a frozenset of lowercase keywords/phrases.
# Phrases with spaces (e.g. "interest rate") are matched as substrings
# after normalization, so multi-word patterns work correctly.
#
# Why frozensets? Immutable, hashable, and O(1) lookup per keyword.
# The actual matching iterates over keywords and checks substring
# containment in the normalized text, so the frozenset is iterated
# rather than used for membership testing — but frozenset still
# communicates "this collection is fixed at module load time."
# ---------------------------------------------------------------------------

DOMAIN_KEYWORDS: dict[str, frozenset[str]] = {
    "ui": frozenset({
        "click", "button", "menu", "settings", "dialog", "install",
        "download", "save", "open", "file", "window", "app",
        "notification", "login", "password", "preferences", "toolbar",
    }),
    "legal": frozenset({
        "court", "judge", "law", "statute", "plaintiff", "defendant",
        "contract", "clause", "liability", "jurisdiction", "attorney",
        "counsel", "verdict", "testimony", "regulation", "compliance",
        "pursuant",
    }),
    "medical": frozenset({
        "patient", "diagnosis", "treatment", "dosage", "symptoms",
        "prescription", "clinical", "surgery", "therapy", "medication",
        "contraindication", "prognosis", "adverse", "vital signs",
    }),
    "financial": frozenset({
        "account", "balance", "transaction", "interest rate", "deposit",
        "withdrawal", "investment", "portfolio", "dividend", "equity",
        "liability", "audit", "revenue", "fiscal",
    }),
    "edu": frozenset({
        "student", "teacher", "curriculum", "lesson", "exam",
        "classroom", "textbook", "homework", "grade", "lecture",
        "assignment", "semester", "academic", "university",
    }),
    "ecommerce": frozenset({
        "price", "cart", "shipping", "order", "product", "review",
        "checkout", "warranty", "return", "refund", "delivery",
        "catalog", "discount", "inventory",
    }),
    "marketing": frozenset({
        "brand", "campaign", "audience", "engagement", "conversion",
        "click-through", "impression", "reach", "demographic", "viral",
        "slogan", "testimonial",
    }),
    "gov": frozenset({
        "citizen", "policy", "regulation", "ministry", "parliament",
        "legislation", "amendment", "public service", "municipal",
        "federal", "provincial", "enforcement",
    }),
    "scientific": frozenset({
        "hypothesis", "experiment", "methodology", "results",
        "conclusion", "abstract", "peer-reviewed", "sample size",
        "statistical", "variable", "correlation",
    }),
    "religious": frozenset({
        "prayer", "faith", "scripture", "worship", "congregation",
        "blessing", "sacred", "divine", "spiritual", "ceremony",
        "ritual", "salvation",
    }),
    "support": frozenset({
        "troubleshoot", "error", "help", "faq", "ticket", "issue",
        "resolve", "contact", "response time", "escalate", "workaround",
    }),
    "subtitles": frozenset({
        # Subtitles are detected structurally rather than by topic keywords.
        # Dialogue markers (leading dashes) and bracket-enclosed stage
        # directions are the primary signals.
    }),
    "news": frozenset({
        "reported", "according to", "sources say", "breaking",
        "investigation", "official", "spokesperson", "press release",
        "analyst",
    }),
    "literary": frozenset({
        "chapter", "novel", "poem", "verse", "narrative", "protagonist",
        "metaphor", "imagery", "stanza", "prose",
    }),
    "conv": frozenset({
        "hey", "thanks", "sure", "yeah", "gonna", "wanna", "lol",
        "btw", "sorry", "awesome", "cool", "ok",
    }),
    "tech": frozenset({
        "api", "server", "database", "deploy", "configuration",
        "protocol", "algorithm", "authentication", "encryption",
        "middleware", "endpoint",
    }),
}

# Label-only domain codes: valid as a corpus label but NOT keyword-classifiable.
# These never have keywords (so classify_domain never auto-assigns them) — they
# are assigned as a deliberate card fact. "humanitarian" (crisis-response /
# humanitarian text, e.g. TICO-19, Gamayun / CLEAR Global) is one such code: it
# names a real niche the 16 keyword domains don't, but humanitarian text isn't
# keyword-separable from medical/news/gov, so it stays author-assigned.
LABEL_ONLY_DOMAINS: frozenset[str] = frozenset({"humanitarian"})

# All valid domain codes = the 16 keyword-classifiable domains + the label-only
# codes. This is the 17-code taxonomy and must stay in sync with the SSOT at
# shared/domain-taxonomy.json and cli/shared/schemas/corpora-card.schema.json.
VALID_DOMAINS: frozenset[str] = frozenset(DOMAIN_KEYWORDS.keys()) | LABEL_ONLY_DOMAINS

# The default domain for sentences that match no keywords or have
# a tie. Conversational is the safest fallback because Tatoeba and
# general-purpose corpora skew heavily toward everyday speech.
DEFAULT_DOMAIN: str = "conv"


# ---------------------------------------------------------------------------
# Subtitle structural patterns
# ---------------------------------------------------------------------------
# Subtitles are identified by structural cues rather than topic keywords.
# These patterns detect dialogue dashes, bracketed stage directions,
# and very short standalone lines typical of film/TV subtitles.

_SUBTITLE_PATTERNS: list[re.Pattern[str]] = [
    # Leading dialogue dashes: "- Hello" or "-- Hello"
    re.compile(r"^\s*-{1,2}\s"),
    # Bracketed stage directions: "[laughs]", "(sighs)", "{music}"
    re.compile(r"[\[\(\{][a-z\s]+[\]\)\}]", re.IGNORECASE),
]


@dataclass(frozen=True)
class ClassificationResult:
    """Result of domain classification for a single text.

    Attributes:
        domain: The assigned domain code (one of 16).
        confidence: Confidence score from 0.0 to 1.0, based on
            how many keywords matched relative to the total
            keywords in the winning domain.
        keyword_matches: Dict mapping each domain to the count
            of keywords that matched, for debugging/auditing.
    """

    domain: str
    confidence: float
    keyword_matches: dict[str, int]


def _normalize_text(text: str) -> str:
    """Lowercase and strip non-alphanumeric characters except spaces and hyphens.

    Hyphens are preserved because several keywords contain them
    (e.g. ``"click-through"``, ``"peer-reviewed"``). Everything else
    that isn't a letter, digit, space, or hyphen is removed.
    """
    lowered = text.lower()
    # Keep letters, digits, spaces, and hyphens
    cleaned = re.sub(r"[^a-z0-9\s\-]", " ", lowered)
    # Collapse multiple spaces into one
    cleaned = re.sub(r"\s+", " ", cleaned).strip()
    return cleaned


def _count_subtitle_signals(text: str) -> int:
    """Count structural signals that suggest subtitle/dialogue text.

    Returns the number of subtitle-indicative patterns found. Each
    pattern match counts as one signal, analogous to a keyword match
    in other domains.
    """
    signal_count = 0
    for pattern in _SUBTITLE_PATTERNS:
        if pattern.search(text):
            signal_count += 1

    # Very short lines (≤5 words) without punctuation are also
    # characteristic of subtitles — but only if at least one
    # structural signal is present, to avoid false positives on
    # normal short sentences.
    word_count = len(text.split())
    if word_count <= 5 and signal_count > 0:
        signal_count += 1

    return signal_count


def classify_domain(text: str) -> ClassificationResult:
    """Classify a text string into one of 16 domains.

    The classifier normalizes the input text, then counts how many
    keywords from each domain appear as substrings. The domain with
    the highest match count wins. Ties and zero-match cases fall
    back to the default domain (``"conv"``).

    Args:
        text: The source text to classify. Typically the English
            side of a parallel entry, since keyword lists are
            English-centric.

    Returns:
        A ClassificationResult with the assigned domain, confidence
        score, and per-domain keyword match counts.
    """
    normalized = _normalize_text(text)
    match_counts: dict[str, int] = {}

    # Count keyword matches for each domain
    for domain, keywords in DOMAIN_KEYWORDS.items():
        count = 0
        for keyword in keywords:
            # Substring matching rather than exact word matching, because
            # some keywords are multi-word phrases ("interest rate") and
            # we want those to match naturally.
            if keyword in normalized:
                count += 1
        match_counts[domain] = count

    # Handle subtitle detection separately since it uses structural
    # patterns rather than keyword content
    subtitle_signals = _count_subtitle_signals(text)
    match_counts["subtitles"] = subtitle_signals

    # Find the domain with the highest match count
    best_domain = DEFAULT_DOMAIN
    best_count = 0

    for domain, count in match_counts.items():
        if count > best_count:
            best_count = count
            best_domain = domain
        # On ties, the iteration order of DOMAIN_KEYWORDS determines
        # priority (dict insertion order in Python 3.7+). This is
        # acceptable because ties are rare and the difference between
        # two equally-matched domains is negligible for corpus building.

    # Confidence: ratio of matched keywords to total keywords in the
    # winning domain. A domain with 3/17 matches gets ~0.18 confidence.
    # This gives downstream consumers a signal about classification
    # certainty without requiring a probability model.
    if best_count > 0:
        total_keywords_in_domain = len(DOMAIN_KEYWORDS.get(best_domain, frozenset()))
        # Subtitle domain has no static keywords, so use the signal count
        # as both numerator and denominator proxy
        if best_domain == "subtitles":
            # Cap at 1.0 — more structural signals = higher confidence,
            # but 3 signals out of 3 possible is full confidence
            max_subtitle_signals = len(_SUBTITLE_PATTERNS) + 1
            confidence = min(best_count / max_subtitle_signals, 1.0)
        elif total_keywords_in_domain > 0:
            confidence = best_count / total_keywords_in_domain
        else:
            confidence = 0.0
    else:
        # No keywords matched at all — we fell back to the default domain
        confidence = 0.0

    return ClassificationResult(
        domain=best_domain,
        confidence=round(confidence, 4),
        keyword_matches=match_counts,
    )
