import json

from nmt_forge.training.backtranslation import backtranslate


def _fake_reverse(lines):
    return [f"english for {l}" for l in lines]


def test_bt_rows_tagged_and_provenance_stamped(ws, tmp_path):
    mono = [f"harvested line {i} tokens here" for i in range(5)]
    result = backtranslate(mono, _fake_reverse, ws, model_id="rev-v1")
    assert len(result.rows) == 5
    row = result.rows[0]
    assert row["source"].startswith("<bt> english for ")
    assert row["target"] == mono[0]
    assert row["synthetic"] is True
    assert "Caswell" in row["provenance"] and "rev-v1" in row["provenance"]


def test_bt_screens_mono_against_evals_first(ws, test_set, dev_set):
    # the Okimāsis catch: the "harvest" contains eval targets → screened out
    # BEFORE any translation is spent, and dev hits are screened too
    mono = [test_set[0]["reference"], dev_set[0]["reference"],
            "genuinely fresh line words"]
    calls = []

    def spy_reverse(lines):
        calls.append(list(lines))
        return _fake_reverse(lines)

    result = backtranslate(mono, spy_reverse, ws)
    assert result.manifest["leaking_lines_removed"] == 2
    assert len(result.rows) == 1
    # the reverse model never even SAW the eval lines
    assert calls == [["genuinely fresh line words"]]


def test_bt_writes_corpus_and_manifest(ws, tmp_path):
    mono = ["line one here now", "line two here now"]
    out = tmp_path / "bt.jsonl"
    backtranslate(mono, _fake_reverse, ws, out_path=out)
    rows = [json.loads(l) for l in out.read_text().splitlines()]
    assert len(rows) == 2
    manifest = json.loads((tmp_path / "bt-manifest.json").read_text())
    assert manifest["guard"] == "backtranslation"


def test_bt_misaligned_reverse_model_refused(ws):
    import pytest

    from nmt_forge.errors import ScoringError

    def broken(lines):
        return lines[:-1]  # silently drops one

    with pytest.raises(ScoringError, match="misaligns"):
        backtranslate(["a b c", "d e f"], broken, ws)


def test_bt_canonicalizes_targets(ws):
    result = backtranslate(["nikī nipān kwa"], _fake_reverse, ws,
                           canonicalizer=lambda t: t.translate(
                               str.maketrans("āēīōū", "âêîôû")))
    assert result.rows[0]["target"] == "nikî nipân kwa"
