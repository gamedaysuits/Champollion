"""Tests for scripts/import_wmt_metaeval.py — the B3 metric meta-eval importer.

The script is stdlib-only (sacrebleu only inside the optional computed-chrF++
lane; the language index resolves through the card corpus via the harness's
display() adapter) and not a package; it is imported via importlib like the
other script tests. Correlation statistics are cross-checked against
independent brute-force reference implementations (no scipy anywhere in the
harness), and the end-to-end artifact build runs on a synthetic
mt-metrics-eval-shaped tree + a fixture card corpus in tmp_path — no real WMT
content is (or may ever be) checked in.
"""

from __future__ import annotations

import importlib.util
import json
import math
import random
from pathlib import Path

import pytest

ARENA_ROOT = Path(__file__).resolve().parent.parent
SCRIPT = ARENA_ROOT / "scripts" / "import_wmt_metaeval.py"


@pytest.fixture(scope="module")
def mod():
    spec = importlib.util.spec_from_file_location("import_wmt_metaeval", SCRIPT)
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


# ---------------------------------------------------------------------------
# Correlation statistics vs. brute-force references
# ---------------------------------------------------------------------------

def _tau_b_reference(xs, ys):
    """O(n^2) textbook tau-b — the independent check for the merge-sort one."""
    n = len(xs)
    con = dis = xtie = ytie = 0
    for i in range(n):
        for j in range(i + 1, n):
            dx = xs[i] - xs[j]
            dy = ys[i] - ys[j]
            if dx == 0:
                xtie += 1
            if dy == 0:
                ytie += 1
            if dx != 0 and dy != 0:
                if (dx > 0) == (dy > 0):
                    con += 1
                else:
                    dis += 1
    tot = n * (n - 1) // 2
    denom = math.sqrt((tot - xtie) * (tot - ytie))
    if denom == 0:
        return None
    return (con - dis) / denom


def test_pearson_known_values(mod):
    assert mod.pearson([1, 2, 3, 4], [2, 4, 6, 8]) == pytest.approx(1.0)
    assert mod.pearson([1, 2, 3, 4], [8, 6, 4, 2]) == pytest.approx(-1.0)
    assert mod.pearson([1, 2], [1, 2]) is None  # fewer than 3 points
    assert mod.pearson([1, 1, 1], [1, 2, 3]) is None  # zero variance


def test_spearman_monotonic_nonlinear(mod):
    # Monotonic but nonlinear -> Spearman 1.0, Pearson < 1.0
    xs = [1.0, 2.0, 3.0, 4.0, 5.0]
    ys = [1.0, 8.0, 27.0, 64.0, 125.0]
    assert mod.spearman(xs, ys) == pytest.approx(1.0)
    assert mod.pearson(xs, ys) < 1.0


def test_spearman_ties_use_average_ranks(mod):
    xs = [1.0, 2.0, 2.0, 3.0]
    assert mod._average_ranks(xs) == [1.0, 2.5, 2.5, 4.0]


def test_kendall_tau_b_matches_bruteforce_with_ties(mod):
    rng = random.Random(42)
    for trial in range(20):
        n = rng.randint(5, 200)
        # Small integer ranges force plenty of x-, y- and xy-ties.
        xs = [float(rng.randint(0, 8)) for _ in range(n)]
        ys = [float(rng.randint(0, 8)) for _ in range(n)]
        fast = mod.kendall_tau_b(xs, ys)
        ref = _tau_b_reference(xs, ys)
        if ref is None:
            assert fast is None, f"trial {trial}: expected degenerate"
        else:
            assert fast == pytest.approx(ref, abs=1e-12), f"trial {trial}"


def test_kendall_tau_b_perfect_and_degenerate(mod):
    assert mod.kendall_tau_b([1, 2, 3, 4], [10, 20, 30, 40]) == pytest.approx(1.0)
    assert mod.kendall_tau_b([1, 2, 3, 4], [40, 30, 20, 10]) == pytest.approx(-1.0)
    assert mod.kendall_tau_b([1, 1, 1], [1, 2, 3]) is None  # all-tied x
    assert mod.kendall_tau_b([1, 2], [1, 2]) is None


def test_pairwise_accuracy_metric_tie_is_disagreement(mod):
    humans = [1.0, 2.0, 3.0]
    assert mod.pairwise_accuracy(humans, [10.0, 20.0, 30.0]) == pytest.approx(1.0)
    assert mod.pairwise_accuracy(humans, [30.0, 20.0, 10.0]) == pytest.approx(0.0)
    # Metric ties on every pair -> 0 correct, never "half credit".
    assert mod.pairwise_accuracy(humans, [5.0, 5.0, 5.0]) == pytest.approx(0.0)
    # No strictly-ordered human pair -> undefined, not 0.
    assert mod.pairwise_accuracy([1.0, 1.0], [1.0, 2.0]) is None


# ---------------------------------------------------------------------------
# Archive parsing helpers
# ---------------------------------------------------------------------------

def test_score_file_parsing_with_none(mod, tmp_path):
    sys_file = tmp_path / "x.sys.score"
    sys_file.write_text("sysA\t1.5\nsysB\tNone\n", encoding="utf-8")
    assert mod.load_sys_scores(sys_file) == {"sysA": 1.5, "sysB": None}

    seg_file = tmp_path / "x.seg.score"
    seg_file.write_text(
        "sysA\t1.0\nsysA\tNone\nsysB\t-0.5\nsysB\t2.0\n", encoding="utf-8")
    assert mod.load_seg_scores(seg_file) == {
        "sysA": [1.0, None], "sysB": [-0.5, 2.0]}


def test_score_file_parsing_wmt20_space_separated(mod, tmp_path):
    # The wmt20 mqm exports separate with a space, not a tab, and an empty
    # score field means missing.
    f = tmp_path / "y.sys.score"
    f.write_text("eTranslation.737 -2.332464\nrefb -0.667461\nsysX\t\n",
                 encoding="utf-8")
    assert mod.load_sys_scores(f) == {
        "eTranslation.737": -2.332464, "refb": -0.667461, "sysX": None}


def test_score_file_parsing_fails_loudly_on_garbage(mod, tmp_path):
    f = tmp_path / "z.sys.score"
    f.write_text("justonetoken\n", encoding="utf-8")
    with pytest.raises(ValueError, match="malformed"):
        mod.load_sys_scores(f)
    f.write_text("sysA\tnot-a-number\n", encoding="utf-8")
    with pytest.raises(ValueError, match="non-numeric"):
        mod.load_sys_scores(f)


def test_normalize_pair_strips_wmt25_locale_suffixes(mod):
    assert mod.normalize_pair("en-de") == ("en", "de", "en-de")
    assert mod.normalize_pair("en-sr_Cyrl_RS") == ("en", "sr", "en-sr")
    assert mod.normalize_pair("en-bho_IN") == ("en", "bho", "en-bho")
    assert mod.normalize_pair("cs-de_DE") == ("cs", "de", "cs-de")


def test_is_human_system_excludes_refs_and_humans(mod):
    refs = {"refA", "refb"}
    assert mod.is_human_system("refA", refs)
    assert mod.is_human_system("refB", refs)  # prefix rule, not just the set
    assert mod.is_human_system("HUMAN.0", refs)
    assert mod.is_human_system("synthetic_ref", refs)
    assert not mod.is_human_system("Online-B", refs)
    assert not mod.is_human_system("NLLB_Greedy", refs)


# ---------------------------------------------------------------------------
# Language resolution (fixture cards in the atlas card-corpus shape)
# ---------------------------------------------------------------------------


def _write_card(cards_dir: Path, code: str, **fields):
    cards_dir.mkdir(parents=True, exist_ok=True)
    (cards_dir / f"{code}.json").write_text(
        json.dumps({"code": code, **fields}), encoding="utf-8")


@pytest.fixture()
def lang_db(tmp_path):
    """A miniature language-card corpus exercising the resolver's edges:
    plain fields, attribution envelopes (consensus and disagreement), a
    locale card that must be excluded, and the macro-language overrides."""
    cards = tmp_path / "language-cards"
    _write_card(cards, "xxx", name="Xish", bcp47="xx",
                classification={"family": "Family-X", "genus": "Genus-X"})
    _write_card(cards, "yyy", name="Yish", bcp47="yy",
                classification={"family": "Family-Y", "genus": "Genus-Y"})
    # Envelope with consensus — resolves via display() without a source pick.
    _write_card(cards, "spa", name="Spanish", bcp47="es", classification={
        "family": {"agreement": "unanimous", "consensus": "Indo-European",
                   "values": [
                       {"value": "Indo-European", "source": "glottolog-v5.3"},
                       {"value": "Indo-European", "source": "wals-v2020.5"}]},
        "genus": "Castilic"})
    # Locale card: identified by its locale block, never by code shape —
    # a projection of its language, excluded from the index entirely.
    _write_card(cards, "spa-MX", name="Spanish (MX)", bcp47="es-MX",
                locale={"language": "spa", "region": "MX"},
                classification={"family": "Indo-European", "genus": "Castilic-MX"})
    # Genuine disagreement — display() refuses; the glottolog claim wins.
    _write_card(cards, "cmn", name="Mandarin", bcp47="cmn", classification={
        "family": {"agreement": "conflicting", "values": [
            {"value": "Sino-Tibetan", "source": "glottolog-v5.3"},
            {"value": "Sinitic", "source": "wals-v2020.5"}]},
        "genus": "Mandarinic"})
    _write_card(cards, "arb", name="Arabic (Standard)", bcp47="arb",
                classification={"family": "Afro-Asiatic", "genus": "Arabic"})
    return cards


def test_language_index_from_cards(mod, lang_db):
    index = mod.load_language_index(lang_db)
    assert index["es"]["iso639_3"] == "spa"
    assert "es-MX" not in index                       # locale card excluded
    assert index["xx"]["family"] == "Family-X"
    assert index["es"]["family"] == "Indo-European"   # envelope consensus
    assert index["zh"]["iso639_3"] == "cmn"           # override
    assert index["zh"]["family"] == "Sino-Tibetan"    # glottolog claim on dispute
    assert index["ar"]["iso639_3"] == "arb"           # override
    assert "nonexistent" not in index


def test_language_index_fails_loud_on_missing_dir(mod, tmp_path):
    with pytest.raises(FileNotFoundError, match="language-cards"):
        mod.load_language_index(tmp_path / "nope")


# ---------------------------------------------------------------------------
# End-to-end artifact build on a synthetic archive
# ---------------------------------------------------------------------------

SYSTEMS = ["sysA", "sysB", "sysC", "sysD", "sysE"]
HUMAN_SYS = {"sysA": 5.0, "sysB": 4.0, "sysC": 3.0, "sysD": 2.0, "sysE": 1.0}
N_SEGS = 12


def _write_synthetic_testset(root: Path, testset: str, pair: str):
    """mt-metrics-eval-shaped tree: mqm + wmt-z human lanes, BLEU/chrF metric
    files (sys via BLEU, seg only via sentBLEU — exercises the fallback), a
    refA 'system' that must be excluded, and a None entry."""
    ts = root / testset
    (ts / "human-scores").mkdir(parents=True)
    (ts / "metric-scores" / pair).mkdir(parents=True)
    (ts / "references").mkdir()
    (ts / "system-outputs" / pair).mkdir(parents=True)

    def sys_lines(scores):
        return "".join(f"{s}\t{v}\n" for s, v in scores.items())

    def seg_lines(per_system):
        return "".join(
            f"{s}\t{v}\n" for s, vals in per_system.items() for v in vals)

    # Human: mqm (preferred) tracks HUMAN_SYS exactly; wmt-z is a noisier copy.
    mqm_sys = dict(HUMAN_SYS, refA=9.9, sysF=None)
    (ts / "human-scores" / f"{pair}.mqm.sys.score").write_text(
        sys_lines(mqm_sys), encoding="utf-8")
    (ts / "human-scores" / f"{pair}.wmt-z.sys.score").write_text(
        sys_lines(HUMAN_SYS), encoding="utf-8")
    human_seg = {
        s: [HUMAN_SYS[s] + 0.1 * (i % 3) if i != 5 else None
            for i in range(N_SEGS)]
        for s in SYSTEMS
    }
    human_seg["refA"] = [9.9] * N_SEGS
    (ts / "human-scores" / f"{pair}.mqm.seg.score").write_text(
        seg_lines(human_seg), encoding="utf-8")
    # Per-rater / span files must be ignored by discovery.
    (ts / "human-scores" / f"{pair}.mqm.rater1.seg.rating").write_text(
        "sysA\t0\n", encoding="utf-8")

    # Metrics: BLEU at sys level; the seg-level BLEU stream is sentBLEU.
    bleu_sys = {s: HUMAN_SYS[s] * 10 for s in SYSTEMS}
    bleu_sys["refA"] = 99.0
    (ts / "metric-scores" / pair / "BLEU-refA.sys.score").write_text(
        sys_lines(bleu_sys), encoding="utf-8")
    metric_seg = {s: [HUMAN_SYS[s] * 10 + (i % 4) for i in range(N_SEGS)]
                  for s in SYSTEMS}
    metric_seg["refA"] = [99.0] * N_SEGS
    (ts / "metric-scores" / pair / "sentBLEU-refA.seg.score").write_text(
        seg_lines(metric_seg), encoding="utf-8")
    # chrF anti-correlated at sys level -> pearson must land near -1.
    chrf_sys = {s: 100 - HUMAN_SYS[s] * 10 for s in SYSTEMS}
    (ts / "metric-scores" / pair / "chrF-refA.sys.score").write_text(
        sys_lines(chrf_sys), encoding="utf-8")

    (ts / "references" / f"{pair}.refA.txt").write_text(
        "aaa bbb\n" * 3, encoding="utf-8")


@pytest.fixture()
def synthetic_archive(tmp_path):
    data = tmp_path / "data"
    _write_synthetic_testset(data, "wmtTEST", "xx-yy")
    (data / "wmtEMPTY").mkdir()  # no human-scores -> excluded with a reason
    return data


def test_build_cells_end_to_end(mod, synthetic_archive, lang_db):
    lang_index = mod.load_language_index(lang_db)
    cells, excluded, languages = mod.build_cells(
        synthetic_archive, lang_index, None, computed_chrfpp=False)

    assert {"xx", "yy"} == set(languages)
    # wmtEMPTY is excluded honestly, not silently dropped.
    assert any(e.get("testset") == "wmtEMPTY" and "human judgments" in e["reason"]
               for e in excluded)

    by_key = {(c["human"], c["level"], c["metric"]): c for c in cells}

    bleu_sys = by_key[("mqm", "sys", "bleu")]
    assert bleu_sys["preferred"] is True
    assert bleu_sys["upstream_metric"] == "BLEU"
    assert bleu_sys["n_sys"] == 5          # refA + None-valued sysF excluded
    assert bleu_sys["pearson"] == pytest.approx(1.0)
    assert bleu_sys["pairwise_accuracy"] == pytest.approx(1.0)

    chrf_sys = by_key[("mqm", "sys", "chrf_plain")]
    assert chrf_sys["pearson"] == pytest.approx(-1.0)

    # wmt-z lane exists but mqm outranks it: not preferred.
    assert by_key[("wmt-z", "sys", "bleu")]["preferred"] is False

    bleu_seg = by_key[("mqm", "seg", "bleu")]
    assert bleu_seg["upstream_metric"] == "sentBLEU"  # seg fallback stream
    assert bleu_seg["n_sys"] == 5
    # 12 segments minus the one None, times 5 systems.
    assert bleu_seg["n_points"] == 5 * (N_SEGS - 1)
    assert bleu_seg["pair_verbatim"] == "xx-yy"


def test_build_artifact_provenance_discipline(mod, synthetic_archive, lang_db):
    pins = {"sha256": "ab" * 32, "etag": "etag-123", "last_modified": "then",
            "bytes": 42}
    artifact = mod.build_artifact(
        synthetic_archive, lang_db, pins, computed_chrfpp=False,
        retrieved="2026-07-07")

    assert "champollion-derived" in artifact["provenance"]
    assert "derived from" in artifact["provenance"]
    assert artifact["license_lane"]["commercial_ok"] is False
    assert artifact["version"] == 1 and artifact["provider"] == "wmt-metrics-metaeval"

    srcs = {s["name"]: s for s in artifact["sources"]}
    meval = next(s for n, s in srcs.items() if "mt-metrics-eval" in n)
    assert meval["data_sha256"] == "ab" * 32
    assert meval["data_etag"] == "etag-123"
    assert len(meval["commit"]) == 40
    mqm = srcs["google/wmt-mqm-human-evaluation"]
    assert mqm["license"] == "Apache-2.0"
    assert len(mqm["commit"]) == 40
    for s in artifact["sources"]:
        assert len(s["credit"]) >= 10  # always-cite-work

    # Family roll-up keyed by TARGET family, preferred (mqm) cells only.
    fam = artifact["families"]["Family-Y"]
    assert fam["metrics"]["bleu"]["sys"]["n_cells"] == 1
    assert fam["metrics"]["bleu"]["sys"]["pearson_weighted_mean"] == pytest.approx(1.0)
    assert artifact["counts"]["cells"] == len(artifact["cells"])
    # Every metric used by a cell is declared in the metrics block.
    assert {c["metric"] for c in artifact["cells"]} <= set(artifact["metrics"])
    # Every src/tgt code used by a cell resolves in the languages block.
    assert {c["tgt"] for c in artifact["cells"]} <= set(artifact["languages"])
    json.dumps(artifact)  # must be serializable as-is


def test_degenerate_cells_land_in_excluded(mod, tmp_path, lang_db):
    data = tmp_path / "data2"
    ts = data / "wmtTINY"
    (ts / "human-scores").mkdir(parents=True)
    (ts / "metric-scores" / "xx-yy").mkdir(parents=True)
    (ts / "references").mkdir()
    # Only 2 systems -> below the 3-system floor.
    (ts / "human-scores" / "xx-yy.mqm.sys.score").write_text(
        "sysA\t1.0\nsysB\t2.0\n", encoding="utf-8")
    (ts / "metric-scores" / "xx-yy" / "BLEU-refA.sys.score").write_text(
        "sysA\t10.0\nsysB\t20.0\n", encoding="utf-8")
    lang_index = mod.load_language_index(lang_db)
    cells, excluded, _ = mod.build_cells(data, lang_index, None, False)
    assert cells == []
    assert any(e.get("metric") == "bleu" and "degenerate" in e["reason"]
               for e in excluded)


def test_unresolvable_language_is_excluded_with_reason(mod, tmp_path, lang_db):
    data = tmp_path / "data3"
    _write_synthetic_testset(data, "wmtTEST", "qq-yy")  # qq not in fixture db
    lang_index = mod.load_language_index(lang_db)
    cells, excluded, _ = mod.build_cells(data, lang_index, None, False)
    assert cells == []
    assert any("unresolvable language code" in e["reason"] and "qq" in e["reason"]
               for e in excluded)


# ---------------------------------------------------------------------------
# Computed chrF++ lane (sacrebleu is a harness core dependency)
# ---------------------------------------------------------------------------

def test_chrfpp_computer_scores_and_length_guard(mod, tmp_path):
    ts = tmp_path / "wmtC"
    (ts / "references").mkdir(parents=True)
    (ts / "system-outputs" / "xx-yy").mkdir(parents=True)
    (ts / "references" / "xx-yy.refA.txt").write_text(
        "aaa bbb ccc\nddd eee fff\nggg hhh iii\n", encoding="utf-8")
    (ts / "system-outputs" / "xx-yy" / "good.txt").write_text(
        "aaa bbb ccc\nddd eee xxx\nzzz hhh iii\n", encoding="utf-8")
    (ts / "system-outputs" / "xx-yy" / "ragged.txt").write_text(
        "aaa\n", encoding="utf-8")

    comp = mod.ChrfPPComputer()
    sys_scores, ref = comp.scores(ts, "xx-yy", ["good", "ragged", "missing"], "sys")
    assert ref == "refA"
    assert set(sys_scores) == {"good"}          # ragged + missing fail honestly
    assert 0.0 < sys_scores["good"] <= 100.0

    seg_scores, _ = comp.scores(ts, "xx-yy", ["good"], "seg")
    assert len(seg_scores["good"]) == 3
    assert seg_scores["good"][0] > seg_scores["good"][1]  # exact line beats noisy


# ---------------------------------------------------------------------------
# Pin discovery
# ---------------------------------------------------------------------------

def test_read_pins_from_sidecars(mod, tmp_path):
    tgz = tmp_path / "mt-metrics-eval-v2.tgz"
    tgz.write_bytes(b"not really a tarball")
    (tmp_path / "mt-metrics-eval-v2.headers").write_text(
        "HTTP/1.1 200 OK\r\nETag: \"abc-123\"\r\n"
        "Last-Modified: Tue, 21 Apr 2026 13:52:50 GMT\r\n"
        "Content-Length: 911710790\r\n", encoding="utf-8")
    (tmp_path / "mt-metrics-eval-v2.sha256").write_text(
        f"{'0' * 64}  mt-metrics-eval-v2.tgz\n", encoding="utf-8")
    pins = mod.read_pins(tgz)
    assert pins["etag"] == "abc-123"
    assert pins["last_modified"] == "Tue, 21 Apr 2026 13:52:50 GMT"
    assert pins["bytes"] == 911710790
    assert pins["sha256"] == "0" * 64


def test_read_pins_without_sidecars_has_no_sha(mod, tmp_path):
    tgz = tmp_path / "x.tgz"
    tgz.write_bytes(b"12345")
    pins = mod.read_pins(tgz)
    assert pins["sha256"] is None
    assert pins["bytes"] == 5  # falls back to the file size


# ---------------------------------------------------------------------------
# The tracked artifact (when present) validates against its schema contract
# ---------------------------------------------------------------------------

ARTIFACT = ARENA_ROOT.parent / "shared" / "catalogue" / "metric-reliability.json"


@pytest.mark.skipif(not ARTIFACT.exists(),
                    reason="metric-reliability.json not generated yet")
def test_tracked_artifact_integrity(mod):
    artifact = json.loads(ARTIFACT.read_text(encoding="utf-8"))
    assert artifact["provider"] == "wmt-metrics-metaeval"
    assert "champollion-derived" in artifact["provenance"]
    assert artifact["license_lane"]["commercial_ok"] is False
    meval = artifact["sources"][0]
    assert meval["data_sha256"] and len(meval["data_sha256"]) == 64
    assert meval["data_etag"]
    # The low-resource lanes the import exists for are actually present.
    pairs = {c["pair"] for c in artifact["cells"]}
    for expected in ("en-gu", "en-kk", "en-iu", "xh-zu", "en-liv", "sah-ru",
                     "en-bho", "en-mas"):
        assert expected in pairs or expected in {
            p for p in pairs}, f"missing low-resource pair {expected}"
    # No correlation leaks outside [-1, 1]; no weight is negative.
    for c in artifact["cells"]:
        for k in ("pearson", "spearman", "kendall_tau_b"):
            v = c.get(k)
            assert v is None or -1.0 <= v <= 1.0
        acc = c.get("pairwise_accuracy")
        assert acc is None or 0.0 <= acc <= 1.0
    # Preferred cells are unique per (testset, pair, level, metric, computed).
    seen = set()
    for c in artifact["cells"]:
        if c["preferred"]:
            key = (c["testset"], c["pair"], c["level"], c["metric"], c["computed"])
            assert key not in seen, f"duplicate preferred cell {key}"
            seen.add(key)
