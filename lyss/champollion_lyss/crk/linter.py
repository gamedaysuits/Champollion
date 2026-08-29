"""
Deterministic Translation Linter for Plains Cree Evaluation
============================================================

Detects known variant classes between a candidate translation and a reference.
Produces a structured verdict: EXACT, EQUIVALENT (with variant classes), or MISS.

Variant Classes
---------------
WORD_ORDER
    Same morphemes in different sequence. Cree has relatively free word order;
    many permutations are dialectally valid. Detection: FST-analyze all words
    in both strings, compare as sorted multisets.

ORTHOGRAPHIC
    Hyphenation vs spacing for preverb attachment. The textbook corpus uses
    spaced preverbs (ê sîpihkwâki) while modern SRO prefers hyphens
    (ê-sîpihkwâki). Both are valid representations. Detection: normalize
    by joining space-separated preverb+stem into hyphenated form and compare.

LONG_VOWEL_MACRON
    Macron (ā ē ī ō) vs circumflex (â ê î ô) for long vowels. Both are
    valid SRO conventions for the same phonemes. The EdTeKLA corpus uses
    circumflexes; some LLMs (especially Claude) output macrons instead.
    Detection: normalize macrons → circumflexes and compare.

OPTIONAL_PARTICLE
    One string has an extra particle (ispîhk, ici, êkwa, kîspin, mêkwâc,
    pâtimâ) that is semantically redundant when the grammar already encodes
    the meaning (e.g., Fut+Cond already means "when/if", so ispîhk is
    optional). Detection: remove known optional particles and re-compare.

LEMMA_SYNONYM
    Different but interchangeable lemmas for the same concept. E.g.,
    takosin/takohtêw (both mean "arrive"), sipwêhtêw/kîwêw (context-dependent
    "leave"/"go home"). Detection: maintained synonym registry.

PROGRESSIVE_AMBIGUITY
    One string has PV/ati (progressive aspect) and the other doesn't, but the
    English source is genuinely ambiguous between simple and progressive aspect.
    E.g., "we'll leave" could be simple future or progressive departure.
    Detection: check if removing ati- from the candidate or adding it to the
    reference produces a match.

Scoring
-------
- exact_match:      Strict string equality
- equivalent_match: exact_match OR all detected variant classes are ACCEPTABLE
- variant_classes:  List of variant class names that were detected
"""

from __future__ import annotations

import re
from dataclasses import dataclass, field
from typing import Optional

# FST analysis via the harness's own adapter (not crk-translate's CrkGenerator).
# The adapter provides the same .analyze() interface using the harness's FST
# cache infrastructure. Falls back gracefully if pyhfst or FST not installed.
try:
    from champollion_lyss.crk.fst_adapter import FSTAnalyzer
    _GENERATOR = None  # lazy init

    def _get_generator() -> FSTAnalyzer:
        global _GENERATOR
        if _GENERATOR is None:
            _GENERATOR = FSTAnalyzer(lang_code="crk")
        return _GENERATOR
except ImportError:
    def _get_generator():
        return None


# ---------------------------------------------------------------------------
# Known variant registries
# ---------------------------------------------------------------------------
#
# PROVENANCE: the small lists below are widely-published, cross-referenced facts
# of Plains Cree (nêhiyawêwin) grammar — citable to multiple published grammars
# and lexica (e.g. Wolfart & Carroll, _Meet Cree_; Okimāsis, _Cree: Language of
# the Plains_; Ahenakew, _Cree Language Structures_ / Ahenakew & Wolfart;
# Wolvengrey, _nêhiyawêwin: itwêwina_). They are hand-curated references to
# published fact — NOT bulk-extracted dictionary data, and no gloss/lexicon
# content is shipped here. See the package NOTICE.

# Particles that are linguistically optional when the grammar already encodes their meaning.
# Each entry documents the textbook/grammar rule that supports optionality.
#
# Grounding:
#   - step3_grammar_spec.txt (line 21): "In Cree, 'when/while' is encoded by the
#     CONJUNCT VERB FORM ALONE. Do NOT add temporal particles (ispîhk). The conjunct
#     mood IS the subordination marker. Only add ispîhk if the English explicitly says
#     'at that time' as emphasis."
#   - CRITICAL_APPRAISAL.md §2.4: "Plains Cree has relatively free word order"
#   - Ahenakew & Wolfart (2000): Cree allows both bare conjunct and particle-marked
#     temporal clauses; the particle is emphatic, not obligatory.
#
# IMPORTANT: These particles are NOT wrong when present — they are emphatic/stylistic.
# The linter classifies their presence/absence as an acceptable variant, not an error.
OPTIONAL_PARTICLES = {
    # grammar_spec.txt line 21: conjunct mood IS the subordination marker.
    # ispîhk is emphatic only. Ahenakew & Wolfart (2000) confirm bare conjunct = 'when'.
    "ispîhk":  "Emphatic temporal; conjunct mood alone encodes 'when/while' (grammar_spec L21)",
    "ici":     "Discourse 'at that time'; optional emphasis alongside conjunct",
    "êkwa":    "Discourse connector 'now/then'; stylistic, not grammatically required",
    "mêkwâc":  "Temporal 'right now'; redundant with unmarked present tense",
    # grammar_spec.txt line 84: "Do NOT generate standalone pronouns. Person is
    # encoded on the verb." Emphatic pronouns are contrastive only — textbook uses
    # them inconsistently: "We ate already" has kiyânaw in sample #39 but niyanân
    # in remainder, or no pronoun at all.
    "niyanân":  "Emphatic 1Pl exclusive pronoun; person already on verb (grammar_spec L84)",
    "kiyânaw":  "Emphatic 12Pl inclusive pronoun; person already on verb",
    "nîstanân": "Emphatic 1Pl exclusive 'we too'; emphatic/contrastive only",
    "nîya":     "Emphatic 1Sg 'I myself'; person already on verb",
    "kîya":     "Emphatic 2Sg 'you yourself'; person already on verb",
    "wîya":     "Emphatic 3Sg 'he/she/it'; person already on verb",
    # EXCLUDED (not optional):
    #   kîspin  — conditional conjunction, changes clause semantics if removed
    #   anima   — demonstrative pronoun, not a discourse particle
    #   pâtimâ  — 'later/wait'; carries temporal meaning not encoded elsewhere
    #   ôma     — demonstrative 'this (inanimate)'; referential, not emphatic
}

# Known synonym pairs — lemmas that are interchangeable for specific meanings.
# Each pair is cross-referenced against multiple published lexica/grammars (e.g.
# Wolvengrey 2001; Ahenakew & Wolfart; Okimāsis 2004) as sharing a gloss — these
# are published facts, not extracted dictionary entries.
# AI/TI alternation (atoskêw/atoskâtam) is valid when object animacy is ambiguous.
LEMMA_SYNONYMS = [
    frozenset({"takosin", "takohtêw"}),       # both "arrive" — Wolvengrey
    frozenset({"sipwêhtêw", "sipwêtisahwêw"}), # "leave/depart" variants
    frozenset({"atoskêw", "atoskâtam"}),        # "work" AI vs TI
    frozenset({"mîcisow", "mîciw"}),            # "eat" AI vs TI
    frozenset({"pakâsimow", "pakâstêw"}),       # "swim" AI variants
    frozenset({"pimipahtâw", "sêsâwipahtâw"}),  # "run" vs "jog"
    # Contracted forms — Wolvengrey lists môya as informal variant of namôya.
    # Textbook remainder uses 'môya', gold uses 'namôya'.
    frozenset({"namôya", "môya"}),
    # Orthographic variant — both 'âha' and 'âhâ' are attested SRO spellings
    # for 'yes'. Final vowel length varies by dialect/orthographic convention.
    frozenset({"âha", "âhâ"}),
]

# Preverbs that attach as space-separated in textbook style but hyphenated in SRO.
# EdTeKLA uses spaces ('ê wâpiskâk'), modern SRO uses hyphens ('ê-wâpiskâk').
# Both are valid orthographic representations of the same morphology.
PREVERB_SURFACES = {
    "ê", "kâ", "kî", "ka", "nika", "kika", "niwî", "kiwî",
    "nikî", "kikî", "êkâ", "namôya", "ati",
}

# Long vowel diacritic mapping — macron ↔ circumflex.
# Both are valid SRO conventions for the same phonemes.
# EdTeKLA uses circumflexes; we normalize macrons → circumflexes.
#
# Linguistic grounding:
#   - Wolvengrey (2001) uses circumflexes
#   - LeClaire & Cardinal (1998) use macrons
#   - Ahenakew (2000) uses circumflexes
#   - Both are recognized by the Canadian Linguistic Association
#
# The mapping covers all Plains Cree long vowels:
#   ā→â  ē→ê  ī→î  ō→ô  (and uppercase equivalents)
_MACRON_TO_CIRCUMFLEX = str.maketrans(
    'āēīōūĀĒĪŌŪ',
    'âêîôûÂÊÎÔÛ',
)


# ---------------------------------------------------------------------------
# Data classes
# ---------------------------------------------------------------------------

@dataclass
class VariantClass:
    """A detected variant between candidate and reference."""
    name: str          # e.g., "WORD_ORDER", "ORTHOGRAPHIC"
    description: str   # Human-readable explanation of what differs
    acceptable: bool   # Whether this variant is linguistically acceptable


@dataclass
class LintResult:
    """Full linting verdict for a single translation pair."""
    expected: str
    got: str
    exact_match: bool
    equivalent_match: bool
    variant_classes: list[VariantClass] = field(default_factory=list)
    normalized_expected: str = ""
    normalized_got: str = ""

    @property
    def verdict(self) -> str:
        if self.exact_match:
            return "EXACT"
        elif self.equivalent_match:
            return "EQUIVALENT"
        else:
            return "MISS"

    @property
    def variant_names(self) -> list[str]:
        return [v.name for v in self.variant_classes]

    def summary(self) -> str:
        """One-line summary for logging."""
        if self.exact_match:
            return "EXACT"
        parts = [f"{v.name}({'✓' if v.acceptable else '✗'})" for v in self.variant_classes]
        return f"{self.verdict}: {', '.join(parts)}" if parts else "MISS"


# ---------------------------------------------------------------------------
# Normalization helpers
# ---------------------------------------------------------------------------

def _normalize_long_vowels(text: str) -> str:
    """Normalize macron long vowels (ā ē ī ō) to circumflex (â ê î ô).

    Both are valid SRO conventions for the same phonemes. EdTeKLA uses
    circumflexes, but some LLMs (especially Claude Fable 5) output macrons.
    This normalization is applied early so all downstream comparisons
    (word order, optional particle, etc.) also benefit.
    """
    return text.translate(_MACRON_TO_CIRCUMFLEX)


def _normalize_orthographic(text: str) -> str:
    """
    Normalize SRO orthographic conventions:
    - Normalize long vowel diacritics (macron → circumflex)
    - Join space-separated preverb+stem into hyphenated form
    - Normalize punctuation
    - Lowercase

    This handles:
    - Textbook 'ê wâpiskâk' vs SRO 'ê-wâpiskâk' (preverb attachment)
    - Macron 'ē wāpiskāk' vs circumflex 'ê wâpiskâk' (long vowel convention)
    """
    text = text.strip().lower()
    # Normalize long vowel diacritics first — macron → circumflex
    text = _normalize_long_vowels(text)
    # Remove sentence-final punctuation
    text = re.sub(r'[.,!?;:]+$', '', text).strip()
    # Remove internal commas
    text = text.replace(',', '')

    tokens = text.split()
    merged = []
    i = 0
    while i < len(tokens):
        # Check if this token is a preverb that should attach to the next word
        if i + 1 < len(tokens) and tokens[i] in PREVERB_SURFACES:
            # Merge preverb + next token with hyphen
            merged.append(f"{tokens[i]}-{tokens[i+1]}")
            i += 2
        else:
            merged.append(tokens[i])
            i += 1

    return " ".join(merged)


def _tokenize(text: str) -> list[str]:
    """Split into Cree words, stripping punctuation."""
    text = text.strip().lower()
    text = re.sub(r'[.,!?;:]+', '', text)
    return [t for t in text.split() if t]


def _get_morpheme_set(words: list[str]) -> list[str]:
    """
    FST-analyze each word and return sorted list of analysis strings.
    Falls back to surface forms if FST unavailable.
    """
    gen = _get_generator()
    analyses = []
    for w in words:
        if gen:
            result = gen.analyze(w)
            if hasattr(result, 'analyses') and result.analyses:
                # Use the first (best) analysis, strip Err/ tags for comparison
                analysis = result.analyses[0]
                analysis = re.sub(r'\+Err/\w+', '', analysis)
                analyses.append(analysis)
            else:
                analyses.append(w)  # fallback to surface form
        else:
            analyses.append(w)
    return sorted(analyses)


# ---------------------------------------------------------------------------
# Variant detectors
# ---------------------------------------------------------------------------

def _check_word_order(expected_tokens: list[str], got_tokens: list[str]) -> Optional[VariantClass]:
    """
    Check if both strings contain the same words in different order.
    Uses FST analysis to normalize morphological variants.
    """
    if sorted(expected_tokens) == sorted(got_tokens) and expected_tokens != got_tokens:
        # Cree word order is pragmatically governed (topic-comment), not syntactically
        # fixed. Both SOV and SVO are valid for the same semantic content.
        # See Wolfart (1973) §3.2, CRITICAL_APPRAISAL.md §2.4.
        return VariantClass(
            name="WORD_ORDER",
            description=f"Same words, different order: [{', '.join(got_tokens)}] vs [{', '.join(expected_tokens)}]",
            acceptable=True,
        )

    # Also check via FST morpheme analysis (catches takohtêci vs takohtêci-type matches)
    exp_morphemes = _get_morpheme_set(expected_tokens)
    got_morphemes = _get_morpheme_set(got_tokens)
    if exp_morphemes == got_morphemes and expected_tokens != got_tokens:
        return VariantClass(
            name="WORD_ORDER",
            description=f"Same morphemes in different order",
            acceptable=True,
        )

    return None


def _check_long_vowel_orthography(expected: str, got: str) -> Optional[VariantClass]:
    """Check if the only difference is macron vs circumflex long vowels.

    Detects when the model outputs macrons (ā ē ī ō) but the reference
    uses circumflexes (â ê î ô), or vice versa. Both are valid SRO.
    """
    exp_lower = expected.strip().lower()
    got_lower = got.strip().lower()

    if exp_lower == got_lower:
        return None  # Already identical

    # Normalize macrons → circumflexes in both and compare
    exp_norm = _normalize_long_vowels(exp_lower)
    got_norm = _normalize_long_vowels(got_lower)

    if exp_norm == got_norm:
        return VariantClass(
            name="LONG_VOWEL_MACRON",
            description=(
                "Difference is only in long vowel diacritics: "
                "macron (ā ē ī ō) vs circumflex (â ê î ô); "
                "both are valid SRO conventions for the same phonemes"
            ),
            acceptable=True,
        )
    return None


def _check_orthographic(expected: str, got: str) -> Optional[VariantClass]:
    """
    Check if the only difference is preverb hyphenation/spacing
    (after normalizing long vowel diacritics).

    Does NOT fire when the only difference is long vowel diacritics —
    that's already caught by _check_long_vowel_orthography.
    """
    norm_exp = _normalize_orthographic(expected)
    norm_got = _normalize_orthographic(got)
    if norm_exp == norm_got and expected.strip().lower() != got.strip().lower():
        # Check if long vowel normalization alone explains the difference.
        # If so, LONG_VOWEL_MACRON already caught it — don't double-tag.
        exp_vowel_norm = _normalize_long_vowels(expected.strip().lower())
        got_vowel_norm = _normalize_long_vowels(got.strip().lower())
        if exp_vowel_norm == got_vowel_norm:
            return None  # Pure long-vowel difference — skip ORTHOGRAPHIC

        return VariantClass(
            name="ORTHOGRAPHIC",
            description="Difference is only in preverb hyphenation/spacing (e.g., 'ê wâpiskâk' vs 'ê-wâpiskâk')",
            acceptable=True,
        )
    return None


def _check_optional_particle(expected_tokens: list[str], got_tokens: list[str]) -> Optional[VariantClass]:
    """
    Check if one string has an extra optional particle that the other lacks.
    """
    exp_set = set(expected_tokens)
    got_set = set(got_tokens)

    # Particles present in expected but absent in got
    missing_from_got = exp_set - got_set
    extra_in_got = got_set - exp_set

    # Check if all differences are optional particles
    missing_optional = {p for p in missing_from_got if p in OPTIONAL_PARTICLES}
    extra_optional = {p for p in extra_in_got if p in OPTIONAL_PARTICLES}

    # After removing optional particles, do the remaining words match?
    exp_core = [t for t in expected_tokens if t not in OPTIONAL_PARTICLES]
    got_core = [t for t in got_tokens if t not in OPTIONAL_PARTICLES]

    if sorted(exp_core) == sorted(got_core) and (missing_optional or extra_optional):
        particles = missing_optional | extra_optional
        reasons = [f"{p}: {OPTIONAL_PARTICLES[p]}" for p in particles]
        return VariantClass(
            name="OPTIONAL_PARTICLE",
            description=f"Optional particle difference: {'; '.join(reasons)}",
            acceptable=True,
        )
    return None


def _extract_lemma(gen, word: str) -> Optional[str]:
    """FST-analyze a word and return its lemma (first non-preverb, non-POS part)."""
    result = gen.analyze(word)
    if hasattr(result, 'analyses') and result.analyses:
        # Extract lemma from analysis string: it's after all PV/ prefixes
        analysis = result.analyses[0]
        # Pattern: optional PV/X+ ... then lemma+rest
        parts = analysis.split('+')
        for part in parts:
            if not part.startswith('PV/') and part not in ('V', 'N', 'Ipc', 'Pron'):
                return part
    return None


def _is_registered_synonym(el: str, gl: str) -> bool:
    """Are two (distinct) lemmas a registered interchangeable pair?"""
    if el == gl:
        return False
    return any(el in syn_set and gl in syn_set for syn_set in LEMMA_SYNONYMS)


def _unify_lemma_synonyms(expected: str, got: str) -> str:
    """Rewrite tokens in `got` to their `expected` counterpart when the pair is a
    registered lemma synonym. Mirrors _check_lemma_synonym's conditions exactly
    (positional alignment, FST lemma extraction, registry membership) so the
    verification pass accepts precisely what the detector accepted.
    """
    gen = _get_generator()
    if not gen:
        return got

    exp_tokens = _tokenize(expected)
    got_tokens = _tokenize(got)
    if len(exp_tokens) != len(got_tokens):
        return got

    out = []
    for et, gt in zip(exp_tokens, got_tokens):
        if et != gt:
            # Surface-form fallback: registry particles (môya, âha…) may have
            # no FST analysis — their registered lemma IS the surface form.
            el = _extract_lemma(gen, et) or et
            gl = _extract_lemma(gen, gt) or gt
            if _is_registered_synonym(el, gl):
                out.append(et)
                continue
        out.append(gt)
    return " ".join(out)


def _check_lemma_synonym(expected_tokens: list[str], got_tokens: list[str]) -> Optional[VariantClass]:
    """
    Check if the difference is a known synonym pair.
    Uses FST analysis to extract lemmas and compare against the synonym registry.
    """
    gen = _get_generator()
    if not gen:
        return None

    # Find words that differ between the two
    if len(expected_tokens) != len(got_tokens):
        return None  # length mismatch is more than synonym

    synonyms_found = []
    for et, gt in zip(expected_tokens, got_tokens):
        if et != gt:
            # Surface-form fallback: registry particles (môya, âha…) may have
            # no FST analysis — their registered lemma IS the surface form.
            el = _extract_lemma(gen, et) or et
            gl = _extract_lemma(gen, gt) or gt
            if _is_registered_synonym(el, gl):
                synonyms_found.append(f"{el} ↔ {gl}")

    if synonyms_found:
        return VariantClass(
            name="LEMMA_SYNONYM",
            description=f"Known synonym pair(s): {', '.join(synonyms_found)}",
            acceptable=True,
        )
    return None


def _check_inclusive_exclusive(
    expected: str, got: str,
    expected_tokens: list[str], got_tokens: list[str],
) -> Optional[VariantClass]:
    """
    Check if the difference is inclusive vs exclusive 'we'.

    LINGUISTIC GROUNDING:
    English 'we' is structurally ambiguous — it doesn't distinguish whether
    the listener is included (inclusive, 12Pl: ki-...-naw) or excluded
    (exclusive, 1Pl: ni-...-nân). Cree FORCES this distinction.

    The EdTeKLA textbook confirms both readings are valid for the same English:
      - "We will be on our way home" → nikahati kîwânân (EXCL, sample #11)
      - "We will be on our way home" → kikahati kîwânaw (INCL, remainder)
      - "We ate already" → kikî mîcisonaw (INCL, sample #39)
      - "We ate already" → nikî mîcisonân (EXCL, remainder)

    Therefore: if the only difference between expected and got is the
    inclusive/exclusive person marking, both are acceptable translations.
    """
    # Only map prefixes that are genuinely 1Pl/12Pl disambiguators.
    # ni-/ki- alone are 1Sg/2Sg — NOT 'we' markers.
    # niwî-/kiwî- are 1Sg/2Sg intentional — NOT 'we' markers.
    # The 'we' distinction lives in: kika-/nika- (future), kikî-/nikî- (past),
    # and the verb suffix (-naw vs -nân).
    INCL_TO_EXCL = {
        "kika": "nika", "kikî": "nikî",
        "kikahati": "nikahati", "kikîhati": "nikîhati",
    }

    def _swap_person(tokens: list[str], direction: str) -> list[str]:
        """Swap inclusive↔exclusive person markers in token list."""
        mapping = INCL_TO_EXCL if direction == "incl_to_excl" else {
            v: k for k, v in INCL_TO_EXCL.items()
        }
        result = []
        for t in tokens:
            swapped = t
            # Try prefix swap (longest match first)
            for src, dst in sorted(mapping.items(), key=lambda x: -len(x[0])):
                if t.startswith(src + "-") or t == src:
                    swapped = dst + t[len(src):]
                    break
            # Suffix swap: -naw ↔ -nân (the verb agreement suffix)
            if direction == "incl_to_excl":
                if swapped.endswith("naw"):
                    swapped = swapped[:-3] + "nân"
            else:
                if swapped.endswith("nân"):
                    swapped = swapped[:-3] + "naw"
            result.append(swapped)
        return result

    # Normalize orthography first for fair comparison
    norm_exp = _tokenize(_normalize_orthographic(expected))
    norm_got = _tokenize(_normalize_orthographic(got))

    if norm_exp == norm_got:
        return None  # Already matching

    # Try swapping expected inclusive→exclusive and vice versa
    exp_as_excl = _swap_person(norm_exp, "incl_to_excl")
    exp_as_incl = _swap_person(norm_exp, "excl_to_incl")

    # Guard: the swap must have actually changed something
    if exp_as_excl != norm_exp and sorted(exp_as_excl) == sorted(norm_got):
        return VariantClass(
            name="INCLUSIVE_EXCLUSIVE",
            description=(
                "Inclusive/exclusive 'we' difference; English 'we' is "
                "ambiguous between ki-...-naw (12Pl, inclusive) and "
                "ni-...-nân (1Pl, exclusive)"
            ),
            acceptable=True,
        )
    if exp_as_incl != norm_exp and sorted(exp_as_incl) == sorted(norm_got):
        return VariantClass(
            name="INCLUSIVE_EXCLUSIVE",
            description=(
                "Inclusive/exclusive 'we' difference; English 'we' is "
                "ambiguous between ki-...-naw (12Pl, inclusive) and "
                "ni-...-nân (1Pl, exclusive)"
            ),
            acceptable=True,
        )

    return None


def _check_progressive_ambiguity(
    expected: str, got: str,
    expected_tokens: list[str], got_tokens: list[str],
) -> Optional[VariantClass]:
    """
    Check if the difference is the presence/absence of ati- (progressive preverb).

    LINGUISTIC GROUNDING (from textbook corpus analysis):
    The EdTeKLA textbook uses ati- with motion/departure verbs (sipwêhtêw, kîwêw)
    even when the English source uses simple future ("we'll leave" → kikahati
    sipwêhtânaw). This means ati- is SEMANTICALLY ENTAILED for certain verbs
    in natural Cree, not merely "optional progressive aspect."

    Therefore this detector is DIRECTIONAL:
    - Model ADDS ati- that the reference lacks → EQUIVALENT (model over-specified
      progressive aspect; genuinely ambiguous from English source)
    - Model MISSES ati- that the reference has → PROGRESSIVE_UNDERSPEC (model
      under-specified; textbook expects ati- for this construction). Flagged but
      NOT counted as equivalent — the model got it wrong.

    Handles multiple patterns:
    - Hyphenated: 'kika-ati-sipwêhtânaw' vs 'kika-sipwêhtânaw'
    - Fused preverb fragment: 'kikahati sipwêhtânaw' vs 'kika sipwêhtânaw'
    - Mixed: 'kikahati sipwêhtânaw' vs 'kika-sipwêhtânaw'
    """
    # Known fused preverb+ati fragments used in textbook corpus
    FUSED_ATI_MAP = {
        "nikahati": "nika",     # nika + ati
        "kikahati": "kika",     # kika + ati
        "niwîhati": "niwî",    # niwî + ati
        "kiwîhati": "kiwî",    # kiwî + ati
        "êhati":    "ê",        # ê + ati (conjunct progressive)
        "nikîhati": "nikî",     # nikî + ati (past progressive)
        "kikîhati": "kikî",     # kikî + ati (past progressive)
    }

    def _normalize_ati(tokens: list[str]) -> list[str]:
        """Strip all ati- from a token list, handling fused and hyphenated forms."""
        result = []
        for t in tokens:
            if t in FUSED_ATI_MAP:
                result.append(FUSED_ATI_MAP[t])
                continue
            if '-ati-' in t:
                result.append(t.replace('-ati-', '-'))
                continue
            if t.startswith('ati-'):
                result.append(t[4:])
                continue
            result.append(t)
        return result

    # Strip ati- from raw tokens first, THEN orthographic-normalize.
    raw_exp = _tokenize(expected)
    raw_got = _tokenize(got)

    exp_stripped = _normalize_ati(raw_exp)
    got_stripped = _normalize_ati(raw_got)

    exp_changed = exp_stripped != raw_exp
    got_changed = got_stripped != raw_got

    # Only one side had ati- (genuine asymmetry)
    if exp_changed != got_changed:
        # Re-join and orthographic-normalize both sides after stripping
        exp_rejoined = _tokenize(_normalize_orthographic(" ".join(exp_stripped)))
        got_rejoined = _tokenize(_normalize_orthographic(" ".join(got_stripped)))

        if sorted(exp_rejoined) == sorted(got_rejoined):
            if got_changed and not exp_changed:
                # Model ADDED ati- that the reference lacks.
                # Genuinely ambiguous: English doesn't specify progressive.
                return VariantClass(
                    name="PROGRESSIVE_AMBIGUITY",
                    description=(
                        "Model added ati- (progressive aspect) not in reference; "
                        "English source is aspectually ambiguous, both readings valid"
                    ),
                    acceptable=True,
                )
            else:
                # Model MISSED ati- that the reference has.
                # Textbook expects ati- for this construction (often motion verbs).
                # Flag for diagnostics but do NOT count as equivalent.
                return VariantClass(
                    name="PROGRESSIVE_UNDERSPEC",
                    description=(
                        "Model omitted ati- that the textbook reference includes; "
                        "textbook treats ati- as expected for motion/departure verbs "
                        "even with simple future English source"
                    ),
                    acceptable=False,
                )

    return None


# ---------------------------------------------------------------------------
# Main linting function
# ---------------------------------------------------------------------------

def lint_translation(expected: str, got: str) -> LintResult:
    """
    Compare a candidate translation against a reference and detect variant classes.

    Returns a LintResult with:
    - exact_match: strict string equality
    - equivalent_match: True if all detected differences are acceptable variants
    - variant_classes: list of detected variant types with acceptability
    """
    # Strict exact match (case-insensitive, strip whitespace/punctuation)
    norm_exp = re.sub(r'[.,!?;:]+', '', expected.strip().lower()).strip()
    norm_got = re.sub(r'[.,!?;:]+', '', got.strip().lower()).strip()

    exact = norm_exp == norm_got

    if exact:
        return LintResult(
            expected=expected,
            got=got,
            exact_match=True,
            equivalent_match=True,
            normalized_expected=norm_exp,
            normalized_got=norm_got,
        )

    # Tokenize for word-level comparison
    exp_tokens = _tokenize(expected)
    got_tokens = _tokenize(got)

    # Run all variant detectors
    variants: list[VariantClass] = []

    # 0. Long vowel diacritics (macron vs circumflex)
    # Check this FIRST — it's the most common source of false negatives
    # when models output ā/ē/ī/ō instead of â/ê/î/ô.
    long_vowel = _check_long_vowel_orthography(expected, got)
    if long_vowel:
        variants.append(long_vowel)

    # 1. Orthographic (hyphenation/spacing)
    # _normalize_orthographic already applies long vowel normalization
    # internally, so this only fires for preverb attachment differences.
    ortho = _check_orthographic(expected, got)
    if ortho:
        variants.append(ortho)

    # 2. Word order
    # Normalize orthography first for fair word-order comparison
    ortho_exp_tokens = _tokenize(_normalize_orthographic(expected))
    ortho_got_tokens = _tokenize(_normalize_orthographic(got))
    word_order = _check_word_order(ortho_exp_tokens, ortho_got_tokens)
    if word_order:
        variants.append(word_order)

    # 3. Optional particle
    opt_particle = _check_optional_particle(ortho_exp_tokens, ortho_got_tokens)
    if opt_particle:
        variants.append(opt_particle)

    # 4. Lemma synonym
    lemma_syn = _check_lemma_synonym(exp_tokens, got_tokens)
    if lemma_syn:
        variants.append(lemma_syn)

    # 5. Progressive ambiguity
    prog = _check_progressive_ambiguity(expected, got, exp_tokens, got_tokens)
    if prog:
        variants.append(prog)

    # 6. Inclusive/exclusive 'we'
    incl_excl = _check_inclusive_exclusive(expected, got, exp_tokens, got_tokens)
    if incl_excl:
        variants.append(incl_excl)

    # Compound check: after applying ALL normalizations, do they match?
    # This catches cases where multiple variant classes combine
    # (e.g., word order + orthographic + optional particle)
    if not variants:
        # No individual variant detected — it's a genuine miss
        equivalent = False
    else:
        # Check if ALL detected variants are acceptable
        equivalent = all(v.acceptable for v in variants)

        # Double-check: apply all normalizations and verify convergence
        if equivalent and not _verify_equivalence_after_normalization(
            expected, got, variants
        ):
            # The normalizations don't fully explain the difference
            # Downgrade to MISS unless individual variants are strong enough
            equivalent = False

    return LintResult(
        expected=expected,
        got=got,
        exact_match=False,
        equivalent_match=equivalent,
        variant_classes=variants,
        normalized_expected=norm_exp,
        normalized_got=norm_got,
    )


def _verify_equivalence_after_normalization(
    expected: str, got: str, variants: list[VariantClass]
) -> bool:
    """
    Apply all detected normalizations and verify the strings actually converge.
    This prevents false equivalence claims when variant detectors fire
    but the overall strings are still substantially different.
    """
    variant_names = {v.name for v in variants}

    # Apply lemma-synonym unification on the raw strings FIRST — the detector
    # aligned raw tokens positionally, so unify before orthographic merging
    # can change token boundaries (e.g. preverb attachment).
    if "LEMMA_SYNONYM" in variant_names:
        got = _unify_lemma_synonyms(expected, got)

    # Start with orthographic normalization (includes long vowel normalization)
    norm_exp = _normalize_orthographic(expected)
    norm_got = _normalize_orthographic(got)

    # If orthographic normalization (which includes macron→circumflex) matches
    if norm_exp == norm_got:
        return True

    exp_tokens = norm_exp.split()
    got_tokens = norm_got.split()

    # Apply optional particle removal
    if "OPTIONAL_PARTICLE" in variant_names:
        exp_tokens = [t for t in exp_tokens if t not in OPTIONAL_PARTICLES]
        got_tokens = [t for t in got_tokens if t not in OPTIONAL_PARTICLES]

    # Apply progressive normalization
    if "PROGRESSIVE_AMBIGUITY" in variant_names:
        FUSED_ATI_MAP = {
            "nikahati": "nika", "kikahati": "kika",
            "niwîhati": "niwî", "kiwîhati": "kiwî",
            "êhati": "ê", "nikîhati": "nikî", "kikîhati": "kikî",
        }
        exp_tokens = [FUSED_ATI_MAP.get(t, t) for t in exp_tokens]
        got_tokens = [FUSED_ATI_MAP.get(t, t) for t in got_tokens]
        # Also handle hyphenated ati: 'kika-ati-sipwêhtânaw' -> 'kika-sipwêhtânaw'
        exp_tokens = [re.sub(r'-ati-', '-', t) for t in exp_tokens]
        got_tokens = [re.sub(r'-ati-', '-', t) for t in got_tokens]
        # Re-normalize orthography after stripping — 'kika sipwêhtânaw' may need
        # re-merging to 'kika-sipwêhtânaw' to match the other side's tokenization
        exp_tokens = _tokenize(_normalize_orthographic(" ".join(exp_tokens)))
        got_tokens = _tokenize(_normalize_orthographic(" ".join(got_tokens)))

    # Apply inclusive/exclusive normalization
    if "INCLUSIVE_EXCLUSIVE" in variant_names:
        # Normalize both sides to exclusive form for comparison
        INCL_TO_EXCL = {
            "kika": "nika", "kikî": "nikî",
            "kikahati": "nikahati", "kikîhati": "nikîhati",
        }
        def _to_excl(tokens):
            result = []
            for t in tokens:
                swapped = t
                for src, dst in sorted(INCL_TO_EXCL.items(), key=lambda x: -len(x[0])):
                    if t.startswith(src + "-") or t == src:
                        swapped = dst + t[len(src):]
                        break
                if swapped.endswith("naw"):
                    swapped = swapped[:-3] + "nân"
                result.append(swapped)
            return result
        exp_tokens = _to_excl(exp_tokens)
        got_tokens = _to_excl(got_tokens)

    # After all normalizations, check sorted equality (allows word order)
    if "WORD_ORDER" in variant_names:
        return sorted(exp_tokens) == sorted(got_tokens)
    else:
        return exp_tokens == got_tokens


# ---------------------------------------------------------------------------
# Batch scoring
# ---------------------------------------------------------------------------

@dataclass
class LintSummary:
    """Aggregate linting statistics for a batch of translations."""
    total: int = 0
    exact_matches: int = 0
    equivalent_matches: int = 0
    misses: int = 0
    variant_counts: dict[str, int] = field(default_factory=dict)

    @property
    def exact_pct(self) -> float:
        return (self.exact_matches / self.total * 100) if self.total else 0.0

    @property
    def equivalent_pct(self) -> float:
        return (self.equivalent_matches / self.total * 100) if self.total else 0.0

    @property
    def miss_pct(self) -> float:
        return (self.misses / self.total * 100) if self.total else 0.0

    def __str__(self) -> str:
        lines = [
            f"=== Lint Summary ({self.total} entries) ===",
            f"  Exact Match:      {self.exact_matches}/{self.total} ({self.exact_pct:.1f}%)",
            f"  Equivalent Match: {self.equivalent_matches}/{self.total} ({self.equivalent_pct:.1f}%)",
            f"  Miss:             {self.misses}/{self.total} ({self.miss_pct:.1f}%)",
        ]
        if self.variant_counts:
            lines.append("  Variant Classes Detected:")
            for name, count in sorted(self.variant_counts.items(), key=lambda x: -x[1]):
                lines.append(f"    {name}: {count}")
        return "\n".join(lines)


def lint_batch(pairs: list[tuple[str, str]]) -> tuple[list[LintResult], LintSummary]:
    """
    Lint a batch of (expected, got) pairs.
    Returns individual results and an aggregate summary.
    """
    results = []
    summary = LintSummary()

    for expected, got in pairs:
        result = lint_translation(expected, got)
        results.append(result)

        summary.total += 1
        if result.exact_match:
            summary.exact_matches += 1
            summary.equivalent_matches += 1  # exact is always equivalent
        elif result.equivalent_match:
            summary.equivalent_matches += 1
        else:
            summary.misses += 1

        for v in result.variant_classes:
            summary.variant_counts[v.name] = summary.variant_counts.get(v.name, 0) + 1

    return results, summary


# ---------------------------------------------------------------------------
# CLI entry point for testing
# ---------------------------------------------------------------------------

if __name__ == "__main__":
    # Test cases that demonstrate each variant class
    test_pairs = [
        # Exact match
        ("kî kimiwan otâkosîhk", "kî kimiwan otâkosîhk"),

        # LONG_VOWEL_MACRON: macron vs circumflex
        ("âstam", "āstam"),

        # LONG_VOWEL_MACRON: multi-word with macrons
        ("tâniwâ nâpêw", "tāniwā nāpēw"),

        # LONG_VOWEL_MACRON + ORTHOGRAPHIC: macron AND preverb spacing
        ("ê sîpihkwâki nâpêwasâkaya",
         "ē-sīpihkwāki nāpēwasākaya"),

        # ORTHOGRAPHIC: hyphen vs space (same diacritics)
        ("ê sîpihkwâki nâpêwasâkaya niwî kaskikwâtên",
         "ê-sîpihkwâki nâpêwasâkaya niwî-kaskikwâtên"),

        # WORD_ORDER: same words, different order
        ("ê sîpihkwâki nâpêwasâkaya niwî kaskikwâtên",
         "niwî kaskikwâtên ê sîpihkwâki nâpêwasâkaya"),

        # OPTIONAL_PARTICLE: extra ispîhk
        ("mîcisohkan ispîhk awâsisak takohtêtwâwi",
         "mîcisohkan awâsisak takohtêtwâwi"),

        # PROGRESSIVE_UNDERSPEC: model omitted ati- that textbook expects (NOT equivalent)
        ("takohtêci wîpac kikahati sipwêhtânaw",
         "takohtêci wîpac kika sipwêhtânaw"),

        # PROGRESSIVE_AMBIGUITY: model added ati- not in reference (EQUIVALENT)
        ("takohtêci wîpac kika sipwêhtânaw",
         "takohtêci wîpac kikahati sipwêhtânaw"),

        # INCLUSIVE_EXCLUSIVE: textbook uses both for "we" (EQUIVALENT)
        # "We will be on our way home" — textbook has both inclusive and exclusive
        ("sêmâk êkwa nikahati kîwânân",
         "sêmâk êkwa kikahati kîwânaw"),

        # Genuine miss (different content)
        ("nikî-wâpamâw", "nikî-kîmôtamawâw"),
    ]

    print("=" * 70)
    print("Translation Linter — Variant Class Detection")
    print("=" * 70)

    for exp, got in test_pairs:
        result = lint_translation(exp, got)
        print(f"\n  EXP: {exp}")
        print(f"  GOT: {got}")
        print(f"  → {result.summary()}")
        for v in result.variant_classes:
            print(f"    [{v.name}] {v.description}")

    # Batch summary
    results, summary = lint_batch(test_pairs)
    print(f"\n{summary}")
