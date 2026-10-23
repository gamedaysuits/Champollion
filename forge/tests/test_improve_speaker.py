"""Where the practice set is too small to judge a round (under 50 sentences),
the speaker's blind marks decide (2026-10-13; stress test 6)."""

import pytest

from nmt_forge.advisor import next_action
from nmt_forge.errors import ForgeError
from nmt_forge.improve.compare import compare_runs
from nmt_forge.improve.speaker import IMPROVE_SPEAKER, record_speaker_verdict, speaker_verdict_for
from tests.test_improve_advisor import _round_two


def test_the_speakers_blind_marks_are_recorded_counts_only(ws):
    e = record_speaker_verdict(ws, newer="r2", in_use="r1", newer_right=16, newer_judged=20,
                               in_use_right=6, in_use_judged=20)
    assert e["clear"] == "newer" and e["z"] > 1.96
    assert ws.ledger.find(IMPROVE_SPEAKER)[-1]["newer_right"] == 16
    assert speaker_verdict_for(ws, "r2")["clear"] == "newer" and speaker_verdict_for(ws, "r9") is None
    e = record_speaker_verdict(ws, newer="r3", in_use="r1", newer_right=6, newer_judged=10,
                               in_use_right=5, in_use_judged=10)
    assert e["clear"] == "neither"
    with pytest.raises(ForgeError, match="more drafts marked right than were judged"):
        record_speaker_verdict(ws, newer="r4", in_use="r1", newer_right=11, newer_judged=10,
                               in_use_right=5, in_use_judged=10)
    with pytest.raises(ForgeError, match="at least one judged draft"):
        record_speaker_verdict(ws, newer="r4", in_use="r1", newer_right=0, newer_judged=0,
                               in_use_right=5, in_use_judged=10)


def test_too_few_to_tell_then_the_speaker_prefers_the_newer_model_offers_it(ws, dev_set, tmp_path):
    first, second = _round_two(ws, tmp_path)
    v = compare_runs(ws, first["manifest_path"], second["manifest_path"], n_trials=200, n_bootstrap=200)
    assert v["verdict"] == "too-few"
    assert next_action(ws).state != "improve-promote", "no speaker verdict yet: the model in use stays"
    record_speaker_verdict(ws, newer=second["run_name"], in_use=first["run_name"], newer_right=15,
                           newer_judged=20, in_use_right=5, in_use_judged=20)
    a = next_action(ws)
    assert a.state == "improve-promote", a.why
    assert "Marking blind on the same visit, the speaker marked the newer model right on 15 of 20" in a.why
    assert "ask them first" in a.why


def test_no_clear_preference_keeps_the_model_in_use(ws, dev_set, tmp_path):
    first, second = _round_two(ws, tmp_path)
    compare_runs(ws, first["manifest_path"], second["manifest_path"], n_trials=200, n_bootstrap=200)
    record_speaker_verdict(ws, newer=second["run_name"], in_use=first["run_name"], newer_right=11,
                           newer_judged=20, in_use_right=10, in_use_judged=20)
    assert next_action(ws).state != "improve-promote"
