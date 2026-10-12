"""human_eval — budget allocation over a frozen ranking, and nothing else.

Two properties matter and are asserted from every angle here:

1. **A tie group is never cut in half.** If the budget line lands inside a
   group the significance test could not separate, the whole group is kept and
   the selection legitimately exceeds the budget — with BOTH numbers reported.
2. **No judgment is ever recorded.** Every selection carries the no-judgment
   note, and `write_selection` refuses a payload that lost it.

Plus the defensive-read contract: a frozen snapshot written by an older
harness has no `by_track` / `is_primary` / `rank_min` — those come back as the
NOT_RECORDED sentence, never as an invented value.
"""

from __future__ import annotations

import pytest

from mt_eval_harness import human_eval as he


# ---------------------------------------------------------------------------
# Fixtures — ranking dicts in the contest_rank.build_ranking shape.
# ---------------------------------------------------------------------------

def _entry(rank, group, slug, value, *, is_primary=None, phase=None,
           track=None, rank_min=None, rank_max=None, execution=None):
    e = {
        "rank": rank,
        "tie_group": group,
        "run_card_id": f"rc-{slug}",
        "model_slug": slug,
        "team": f"team-{slug}",
        "submitter_label": slug.upper(),
        "primary": {"metric": "chrf_plus_plus", "value": value},
        "tie_evidence": {"method": "ci-overlap", "reason": "95% CIs overlap"},
    }
    if is_primary is not None:
        e["is_primary"] = is_primary
    if phase is not None:
        e["phase"] = phase
    if track is not None:
        e["track"] = track
    if rank_min is not None:
        e["rank_min"] = rank_min
    if rank_max is not None:
        e["rank_max"] = rank_max
    if execution is not None:
        e["execution"] = execution
    return e


#: alpha alone at 1; bravo/charlie/delta tied at 2; echo at 5.
FLAT_ENTRIES = [
    _entry(1, 1, "alpha", 61.0),
    _entry(2, 2, "bravo", 55.0),
    _entry(2, 2, "charlie", 54.9),
    _entry(2, 2, "delta", 54.8),
    _entry(5, 5, "echo", 40.0),
]


def _ranking(entries=None, **extra):
    r = {
        "contest": {"id": "c-1", "name": "ES→AGR 2026",
                    "language_pair": "spa>agr", "corpus_id": "sealed-agr-v1"},
        "metric": "chrf_plus_plus",
        "metric_label": "chrF++",
        "entries": list(FLAT_ENTRIES if entries is None else entries),
        "frozen": True,
        "frozen_at": "2026-09-06T12:00:00+00:00",
        "generated_at": "2026-09-06T12:00:00+00:00",
        "harness_version": "0.0.0-test",
        "ranking_method": {"tie_test": "ar", "alpha": 0.05,
                           "n_resamples": 1000, "seed": 12345,
                           "evidence_used": ["ci-overlap"]},
    }
    r.update(extra)
    return r


# ---------------------------------------------------------------------------
# The tie-group rule.
# ---------------------------------------------------------------------------

class TestTieGroupsKeptWhole:
    def test_budget_inside_a_tie_group_keeps_the_whole_group(self):
        sel = he.select_for_human_eval(_ranking(), budget=2)
        section = sel["sections"][0]
        assert [e["model_slug"] for e in section["entries"]] == [
            "alpha", "bravo", "charlie", "delta"]
        # BOTH numbers reported — the overrun is never hidden.
        assert section["budget"] == 2
        assert section["selected_count"] == 4
        assert section["exceeds_budget_by"] == 2
        assert section["tie_group_kept_whole"] is True
        assert "kept whole" in section["cut_basis"]
        assert sel["selected_count"] == 4 and sel["budget"] == 2

    def test_budget_on_a_group_boundary_does_not_overrun(self):
        sel = he.select_for_human_eval(_ranking(), budget=1)
        section = sel["sections"][0]
        assert [e["model_slug"] for e in section["entries"]] == ["alpha"]
        assert section["tie_group_kept_whole"] is False
        assert section["exceeds_budget_by"] == 0
        assert "between tie groups" in section["cut_basis"]

    def test_no_keep_tie_groups_cuts_hard(self):
        sel = he.select_for_human_eval(_ranking(), budget=2,
                                       keep_tie_groups=False)
        section = sel["sections"][0]
        assert [e["model_slug"] for e in section["entries"]] == ["alpha", "bravo"]
        assert section["selected_count"] == 2
        assert "hard cut" in section["cut_basis"]
        assert sel["keep_tie_groups"] is False

    def test_budget_over_the_field_selects_everyone(self):
        sel = he.select_for_human_eval(_ranking(), budget=99)
        section = sel["sections"][0]
        assert section["selected_count"] == 5
        assert section["exceeds_budget_by"] == 0
        assert "covers every candidate" in section["cut_basis"]

    def test_unrecorded_tie_groups_cut_hard_and_say_so(self):
        entries = [{k: v for k, v in e.items() if k != "tie_group"}
                   for e in FLAT_ENTRIES]
        sel = he.select_for_human_eval(_ranking(entries), budget=2)
        section = sel["sections"][0]
        assert section["selected_count"] == 2
        assert he.NOT_RECORDED in section["cut_basis"]


# ---------------------------------------------------------------------------
# No judgment, ever.
# ---------------------------------------------------------------------------

class TestNoJudgmentRecorded:
    def test_note_is_present_and_exact(self):
        sel = he.select_for_human_eval(_ranking(), budget=3)
        assert sel["note"] == he.NO_JUDGMENT_NOTE
        assert "no human judgment recorded" in sel["note"]
        assert "Speaker Validation lane" in sel["note"]

    def test_no_score_or_rating_key_anywhere(self):
        import json
        sel = he.select_for_human_eval(_ranking(), budget=3)
        blob = json.dumps(sel)
        for forbidden in ('"rating"', '"judgment"', '"judgments"',
                          '"human_score"', '"verdict"', '"acceptable"'):
            assert forbidden not in blob, forbidden

    def test_entries_carry_identity_and_rank_only(self):
        sel = he.select_for_human_eval(_ranking(), budget=1)
        entry = sel["sections"][0]["entries"][0]
        assert entry["run_card_id"] == "rc-alpha"
        assert entry["primary_value"] == 61.0
        assert "scores" not in entry and "tie_evidence" not in entry


# ---------------------------------------------------------------------------
# Defensive reads of older frozen snapshots.
# ---------------------------------------------------------------------------

class TestDefensiveReads:
    def test_missing_by_track_gives_one_section_that_says_so(self):
        sel = he.select_for_human_eval(_ranking(), budget=2)
        assert len(sel["sections"]) == 1
        assert sel["sections"][0]["track"] == "all"
        assert he.NOT_RECORDED in sel["section_basis"]

    def test_missing_rank_range_is_reported_not_invented(self):
        sel = he.select_for_human_eval(_ranking(), budget=1)
        entry = sel["sections"][0]["entries"][0]
        assert entry["rank_min"] == he.NOT_RECORDED
        assert entry["rank_max"] == he.NOT_RECORDED

    def test_recorded_rank_range_passes_through(self):
        entries = [_entry(1, 1, "alpha", 61.0, rank_min=1, rank_max=1)]
        sel = he.select_for_human_eval(_ranking(entries), budget=1)
        entry = sel["sections"][0]["entries"][0]
        assert (entry["rank_min"], entry["rank_max"]) == (1, 1)

    def test_missing_is_primary_treats_everyone_as_a_candidate(self):
        sel = he.select_for_human_eval(_ranking(), budget=99)
        section = sel["sections"][0]
        assert section["candidates"] == 5
        assert he.NOT_RECORDED in section["primary_basis"]

    def test_missing_phase_treats_everyone_as_evaluation_phase(self):
        sel = he.select_for_human_eval(_ranking(), budget=99)
        assert he.NOT_RECORDED in sel["sections"][0]["phase_basis"]

    def test_a_ranking_without_entries_is_refused(self):
        with pytest.raises(he.HumanEvalError, match="no `entries` list"):
            he.select_for_human_eval({"contest": {"id": "c"}}, budget=3)

    def test_a_non_dict_ranking_is_refused(self):
        with pytest.raises(he.HumanEvalError, match="ranking dict"):
            he.select_for_human_eval([1, 2, 3], budget=3)

    @pytest.mark.parametrize("budget", [0, -1])
    def test_budget_below_one_is_refused(self, budget):
        with pytest.raises(he.HumanEvalError, match="budget"):
            he.select_for_human_eval(_ranking(), budget=budget)


# ---------------------------------------------------------------------------
# Primary / contrastive and phase filters, when the snapshot records them.
# ---------------------------------------------------------------------------

class TestFilters:
    def test_contrastive_entries_are_never_selected(self):
        entries = [
            _entry(1, 1, "alpha", 61.0, is_primary=True),
            _entry(2, 2, "alpha-b", 60.0, is_primary=False),
            _entry(3, 3, "bravo", 55.0, is_primary=True),
        ]
        sel = he.select_for_human_eval(_ranking(entries), budget=2)
        section = sel["sections"][0]
        assert [e["model_slug"] for e in section["entries"]] == ["alpha", "bravo"]
        assert section["primary_basis"] == "entry.is_primary"
        reasons = [x["reason"] for x in section["excluded"]]
        assert any("contrastive" in r for r in reasons)

    def test_non_evaluation_phase_entries_are_excluded(self):
        entries = [
            _entry(1, 1, "alpha", 61.0, phase="evaluation"),
            _entry(2, 2, "practice-run", 60.0, phase="practice"),
            _entry(3, 3, "bravo", 55.0, phase="evaluation"),
        ]
        sel = he.select_for_human_eval(_ranking(entries), budget=5)
        section = sel["sections"][0]
        assert [e["model_slug"] for e in section["entries"]] == ["alpha", "bravo"]
        assert section["phase_basis"] == "entry.phase"
        assert any("practice" in x["reason"] for x in section["excluded"])


class TestPerTrackBudget:
    """The budget is PER TRACK: constrained and unconstrained are separate
    competitions, so one shared budget would silently starve one of them."""

    BY_TRACK = {
        "constrained": {"entries": [_entry(1, 1, "c1", 50.0),
                                    _entry(2, 2, "c2", 45.0)]},
        "unconstrained": {"entries": [_entry(1, 1, "u1", 61.0),
                                      _entry(2, 2, "u2", 60.0),
                                      _entry(3, 3, "u3", 30.0)]},
    }

    def test_dict_shaped_by_track(self):
        sel = he.select_for_human_eval(
            _ranking(by_track=self.BY_TRACK), budget=1)
        assert sel["section_basis"] == "ranking.by_track"
        assert [s["track"] for s in sel["sections"]] == ["constrained",
                                                         "unconstrained"]
        assert all(s["selected_count"] == 1 for s in sel["sections"])
        assert sel["selected_count"] == 2

    def test_list_shaped_by_track(self):
        by_track = [{"track": t, **b} for t, b in self.BY_TRACK.items()]
        sel = he.select_for_human_eval(_ranking(by_track=by_track), budget=2)
        assert sel["section_basis"] == "ranking.by_track"
        assert sel["selected_count"] == 4

    def test_empty_by_track_falls_back_to_the_flat_list(self):
        sel = he.select_for_human_eval(_ranking(by_track={}), budget=1)
        assert he.NOT_RECORDED in sel["section_basis"]


# ---------------------------------------------------------------------------
# write_selection — closed contests only, read-merge-write, loud refusals.
# ---------------------------------------------------------------------------

class _Recorder:
    def __init__(self, contest, patch_result=None):
        self.contest = contest
        self.calls = []
        self.patch_result = (patch_result if patch_result is not None
                             else [{"id": contest["id"]}])

    def api_request(self, method, path, data=None, params=None, session=None,
                    prefer=None):
        self.calls.append((method, path, data, params))
        return self.patch_result

    def owned_contest(self, contest_id, session, email):
        return self.contest


def _install(monkeypatch, recorder):
    import mt_eval_harness.auth as auth
    import mt_eval_harness.contest as contest_mod
    monkeypatch.setattr(auth, "get_session", lambda: {"access_token": "t"})
    monkeypatch.setattr(auth, "get_submitter_email",
                        lambda session: "organizer@example.org")
    monkeypatch.setattr(contest_mod, "_owned_contest", recorder.owned_contest)
    monkeypatch.setattr(contest_mod, "_api_request", recorder.api_request)


class TestWriteSelection:
    def test_refuses_an_open_contest_by_name(self, monkeypatch):
        rec = _Recorder({"id": "c-1", "status": "open", "metadata": {}})
        _install(monkeypatch, rec)
        sel = he.select_for_human_eval(_ranking(), budget=2)
        with pytest.raises(he.HumanEvalError, match="only after .*close"):
            he.write_selection("c-1", sel)
        assert not rec.calls, "no write may be attempted on an open contest"

    def test_merges_metadata_client_side(self, monkeypatch):
        rec = _Recorder({"id": "c-1", "status": "closed", "metadata": {
            "primary_metric": "chrf_plus_plus",
            "final_ranking": {"frozen": True},
            "closed_at": "2026-09-06T12:00:00+00:00",
        }})
        _install(monkeypatch, rec)
        sel = he.select_for_human_eval(_ranking(), budget=2)
        he.write_selection("c-1", sel)

        method, path, data, params = rec.calls[0]
        assert (method, path) == ("PATCH", "contests")
        assert params == {"id": "eq.c-1"}
        # JSONB PATCH replaces the column, so every pre-existing key must
        # survive the merge — losing final_ranking would erase the result.
        assert data["metadata"]["final_ranking"] == {"frozen": True}
        assert data["metadata"]["primary_metric"] == "chrf_plus_plus"
        assert data["metadata"]["closed_at"] == "2026-09-06T12:00:00+00:00"
        assert data["metadata"]["human_eval_selection"]["note"] == he.NO_JUDGMENT_NOTE
        # Nothing but metadata is touched: status/intake stay the DB's.
        assert set(data) == {"metadata"}

    def test_zero_rows_updated_fails_loud(self, monkeypatch):
        rec = _Recorder({"id": "c-1", "status": "closed", "metadata": {}},
                        patch_result=[])
        _install(monkeypatch, rec)
        sel = he.select_for_human_eval(_ranking(), budget=2)
        with pytest.raises(he.HumanEvalError, match="matched no row"):
            he.write_selection("c-1", sel)

    def test_refuses_a_payload_that_lost_the_no_judgment_note(self, monkeypatch):
        rec = _Recorder({"id": "c-1", "status": "closed", "metadata": {}})
        _install(monkeypatch, rec)
        sel = he.select_for_human_eval(_ranking(), budget=2)
        sel["note"] = "top systems, validated by speakers"
        with pytest.raises(he.HumanEvalError, match="no-judgment note"):
            he.write_selection("c-1", sel)
        assert not rec.calls

    def test_refuses_an_empty_selection(self, monkeypatch):
        rec = _Recorder({"id": "c-1", "status": "closed", "metadata": {}})
        _install(monkeypatch, rec)
        with pytest.raises(he.HumanEvalError, match="select_for_human_eval"):
            he.write_selection("c-1", {})


class TestFormatSelection:
    def test_renders_without_raising_and_shows_the_note(self):
        sel = he.select_for_human_eval(_ranking(), budget=2)
        text = he.format_selection(sel)
        assert "Traceback" not in text
        assert he.NO_JUDGMENT_NOTE in text
        assert "alpha" in text and "delta" in text
        assert "tie group kept whole" in text

    def test_renders_a_sparse_snapshot(self):
        sel = he.select_for_human_eval(
            {"entries": [{"run_card_id": "rc-x"}]}, budget=1)
        text = he.format_selection(sel)
        assert "rc-x" in text and "Traceback" not in text
