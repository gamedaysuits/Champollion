"""shared_task module — validation refusals, content-free rows, loud fetches.

The edition umbrella (migration 047) is organizer-side registry machinery, so
everything here is tested against a monkeypatched service_request — no network,
mirroring test_contest_prep.py's registration tests.
"""

from __future__ import annotations

import pytest

import mt_eval_harness.sovereign_service as svc
from mt_eval_harness import shared_task as st


def _capture(monkeypatch, responses=None):
    """Monkeypatch service_request; record calls; pop canned responses."""
    calls = []
    canned = list(responses or [])

    def fake_service_request(method, path, **kw):
        calls.append((method, path, kw.get("data"), kw.get("params")))
        return canned.pop(0) if canned else []

    monkeypatch.setattr(svc, "service_request", fake_service_request)
    return calls


VALID = dict(
    shared_task_id="americasnlp-2026",
    name="AmericasNLP 2026 Shared Task",
    organizer="AmericasNLP organizing committee",
    year=2026,
)


# ---------------------------------------------------------------------------
# create_shared_task — refusals fire BEFORE any network call.
# ---------------------------------------------------------------------------

class TestCreateRefusals:
    @pytest.mark.parametrize("bad_id", ["", "AmericasNLP", "has_underscore",
                                        "-leading-dash", "with space"])
    def test_bad_slug_refused(self, monkeypatch, bad_id):
        calls = _capture(monkeypatch)
        with pytest.raises(st.SharedTaskError, match="slug"):
            st.create_shared_task(**{**VALID, "shared_task_id": bad_id})
        assert not calls, "validation must fire before any network call"

    def test_empty_name_refused(self, monkeypatch):
        calls = _capture(monkeypatch)
        with pytest.raises(st.SharedTaskError, match="name"):
            st.create_shared_task(**{**VALID, "name": "  "})
        assert not calls

    def test_empty_organizer_refused(self, monkeypatch):
        calls = _capture(monkeypatch)
        with pytest.raises(st.SharedTaskError, match="organizer"):
            st.create_shared_task(**{**VALID, "organizer": ""})
        assert not calls

    def test_bad_year_refused(self, monkeypatch):
        calls = _capture(monkeypatch)
        with pytest.raises(st.SharedTaskError, match="year"):
            st.create_shared_task(**{**VALID, "year": 26})
        assert not calls

    def test_bad_default_model_refused(self, monkeypatch):
        calls = _capture(monkeypatch)
        with pytest.raises(st.SharedTaskError, match="authorization"):
            st.create_shared_task(**VALID,
                                  default_authorization_model="vibes")
        assert not calls

    def test_bad_default_limit_refused(self, monkeypatch):
        calls = _capture(monkeypatch)
        with pytest.raises(st.SharedTaskError, match="limit"):
            st.create_shared_task(**VALID, default_intake_daily_limit=0)
        assert not calls


# ---------------------------------------------------------------------------
# create_shared_task — the row it writes is content-free and fail-closed.
# ---------------------------------------------------------------------------

class TestCreateRow:
    def test_posts_expected_row(self, monkeypatch):
        calls = _capture(monkeypatch, responses=[[{
            "shared_task_id": "americasnlp-2026", "organizer": "x",
            "year": 2026}]])
        row = st.create_shared_task(**VALID)
        assert row["shared_task_id"] == "americasnlp-2026"

        method, path, data, _params = calls[0]
        assert (method, path) == ("POST", "shared_tasks")
        assert data["shared_task_id"] == "americasnlp-2026"
        assert data["year"] == 2026
        # Fail-closed default posture unless the organizer chose otherwise.
        assert data["default_authorization_model"] == "per-submission"
        assert data["default_intake_daily_limit"] == 5
        assert data["status"] == "active"
        # Content-free: names + year + defaults only.
        for forbidden in ("source", "reference", "corpus", "content"):
            assert forbidden not in data

    def test_explicit_defaults_pass_through(self, monkeypatch):
        calls = _capture(monkeypatch)
        st.create_shared_task(**VALID, default_authorization_model="blanket",
                              default_intake_daily_limit=10,
                              description="Yearly multi-pair cycle.")
        data = calls[0][2]
        assert data["default_authorization_model"] == "blanket"
        assert data["default_intake_daily_limit"] == 10
        assert data["description"] == "Yearly multi-pair cycle."


# ---------------------------------------------------------------------------
# fetch / list.
# ---------------------------------------------------------------------------

class TestFetchAndList:
    def test_fetch_returns_the_row(self, monkeypatch):
        _capture(monkeypatch, responses=[[{"shared_task_id": "americasnlp-2026",
                                           "default_intake_daily_limit": 3}]])
        row = st.fetch_shared_task("americasnlp-2026")
        assert row["default_intake_daily_limit"] == 3

    def test_fetch_missing_fails_loud_with_the_create_hint(self, monkeypatch):
        _capture(monkeypatch, responses=[[]])
        with pytest.raises(st.SharedTaskError,
                           match="not registered.*shared-task create"):
            st.fetch_shared_task("americasnlp-2099")

    def test_list_filters(self, monkeypatch):
        calls = _capture(monkeypatch, responses=[[{"shared_task_id": "a"}]])
        rows = st.list_shared_tasks(year=2026)
        assert rows == [{"shared_task_id": "a"}]
        _method, path, _data, params = calls[0]
        assert path == "shared_tasks"
        assert params["year"] == "eq.2026"
        assert params["status"] == "eq.active"

    def test_list_can_include_archived(self, monkeypatch):
        calls = _capture(monkeypatch)
        st.list_shared_tasks(include_archived=True)
        params = calls[0][3]
        assert "status" not in params


# ---------------------------------------------------------------------------
# report_edition — the Findings-style edition report (practice 9).
#
# Frozen snapshots ONLY. The report transcribes what each close froze; it
# never re-ranks, never recomputes a score, and refuses rather than reporting
# a moving number. Anything a snapshot did not record is printed as
# "not recorded", never filled in.
# ---------------------------------------------------------------------------

EDITION_ROW = {
    "shared_task_id": "americasnlp-2026",
    "name": "AmericasNLP 2026 Shared Task",
    "organizer": "AmericasNLP organizing committee",
    "year": 2026,
    "description": "Spanish into eleven Indigenous languages.",
    "status": "active",
    "default_authorization_model": "per-submission",
    "default_intake_daily_limit": 5,
}


def _ranked_entry(rank, group, slug, value, **extra):
    entry = {
        "rank": rank,
        "tie_group": group,
        "run_card_id": f"rc-{slug}",
        "model_slug": slug,
        "submitter_label": slug.upper(),
        "team": f"team-{slug}",
        "primary": {"metric": "chrf_plus_plus", "value": value},
        "tie_evidence": {"method": "ci-overlap", "reason": "95% CIs overlap"},
    }
    entry.update(extra)
    return entry


def _frozen_ranking(**extra):
    ranking = {
        "metric": "chrf_plus_plus",
        "metric_label": "chrF++",
        "metric_source": "metadata.primary_metric",
        "trust_policy": "verified-only",
        "frozen": True,
        "frozen_at": "2026-09-06T12:00:00+00:00",
        "harness_version": "0.0.0-test",
        "entries": [
            _ranked_entry(1, 1, "alpha", 61.0, rank_min=1, rank_max=1,
                          execution={"runtime_seconds": 120.0,
                                     "runtime": "docker",
                                     "node_id": "lima-airgap-1"}),
            _ranked_entry(2, 2, "bravo", 55.0, rank_min=2, rank_max=3),
            _ranked_entry(2, 2, "charlie", 54.9, rank_min=2, rank_max=3),
        ],
        "unscored": [],
        "excluded": [{"run_card_id": "rc-zulu", "reason": "trust=disqualified"}],
        "ranking_method": {"tie_test": "ar", "alpha": 0.05,
                           "n_resamples": 1000, "seed": 12345,
                           "evidence_used": ["ci-overlap"],
                           "note": "Competition ranking (1, 1, 3)."},
    }
    ranking.update(extra)
    return ranking


def _contest_row(cid="c-agr", *, status="closed", ranking=None, **extra):
    row = {
        "id": cid,
        "name": f"ES→AGR 2026 ({cid})",
        "corpus_id": "sealed-agr-2026-v1",
        "language_pair": "spa>agr",
        "lane": "sealed",
        "status": status,
        "shared_task_id": "americasnlp-2026",
        "metadata": {},
    }
    if ranking is not None:
        row["metadata"] = {"final_ranking": ranking}
    row.update(extra)
    return row


SUBMISSION_ROWS = [
    {"contest_id": "c-agr", "run_card_id": "rc-alpha",
     "submitted_by": "a@example.org", "team": "team-alpha",
     "submitter_label": "ALPHA", "is_primary": True, "track": "constrained",
     "method_release_url": "https://example.org/alpha",
     "description": "A pipeline system.\nSecond line of the description."},
    {"contest_id": "c-agr", "run_card_id": "rc-bravo",
     "submitted_by": "b@example.org", "team": "team-bravo",
     "submitter_label": "BRAVO", "is_primary": False,
     "track": "unconstrained", "description": ""},
]


def _report_capture(monkeypatch, *, contests, edition=None,
                    submissions=None, submissions_error=None):
    """Route every service_request the report makes to canned data."""
    calls = []
    subs = SUBMISSION_ROWS if submissions is None else submissions

    def fake_service_request(method, path, **kw):
        params = kw.get("params") or {}
        calls.append((method, path, kw.get("data"), params))
        if path == "shared_tasks":
            if method == "PATCH":
                return [{**(edition or EDITION_ROW), **(kw.get("data") or {})}]
            return [edition or EDITION_ROW]
        if path == "contests":
            return list(contests)
        if path == "contest_submissions":
            if submissions_error:
                raise RuntimeError(submissions_error)
            cid = (params.get("contest_id") or "").removeprefix("eq.")
            return [r for r in subs if r.get("contest_id") == cid]
        raise AssertionError(f"unexpected table {path!r}")

    monkeypatch.setattr(svc, "service_request", fake_service_request)
    return calls


class TestReportEdition:
    def test_writes_the_findings_file_with_every_section(self, monkeypatch, tmp_path):
        _report_capture(monkeypatch,
                        contests=[_contest_row(ranking=_frozen_ranking())])
        path = st.report_edition("americasnlp-2026", out_dir=str(tmp_path))
        assert path.name == "americasnlp-2026-findings.md"
        text = path.read_text(encoding="utf-8")
        for heading in ("# AmericasNLP 2026 Shared Task — findings",
                        "## How to read this report",
                        "## Edition summary",
                        "## spa>agr — ES→AGR 2026 (c-agr)",
                        "### Track partitions",
                        "### Primary ranking",
                        "### How ties were decided",
                        "### Contrastive entries",
                        "### Exclusions",
                        "### Prize terms and eligibility",
                        "### Deferred results",
                        "### Execution facts",
                        "### System descriptions"):
            assert heading in text, heading

    def test_numbers_come_from_the_snapshot_only(self, monkeypatch, tmp_path):
        _report_capture(monkeypatch,
                        contests=[_contest_row(ranking=_frozen_ranking())])
        text = st.report_edition("americasnlp-2026",
                                 out_dir=str(tmp_path)).read_text()
        assert "`sealed-agr-2026-v1`" in text          # corpus card id
        assert "61" in text and "55" in text            # the frozen values
        assert "2–3" in text                            # the rank range
        assert "ci-overlap" in text                     # tie evidence method
        assert "trust=disqualified" in text             # exclusions
        assert "120" in text                            # execution runtime

    def test_tie_paragraph_is_generated_from_the_recorded_policy(
            self, monkeypatch, tmp_path):
        _report_capture(monkeypatch,
                        contests=[_contest_row(ranking=_frozen_ranking(
                            tie_policy={"tie_test": "bootstrap", "alpha": 0.01,
                                        "n_resamples": 2000, "seed": 7,
                                        "evidence_used": ["point-equality"]}))])
        text = st.report_edition("americasnlp-2026",
                                 out_dir=str(tmp_path)).read_text()
        assert "paired bootstrap (Koehn 2004)" in text
        assert "0.01" in text and "2000" in text
        assert "point-equality" in text
        # The sealed-lane honesty sentence is not optional.
        assert "sealed contests never reach this rung" in text

    def test_unrecorded_keys_are_reported_not_invented(self, monkeypatch, tmp_path):
        thin = _frozen_ranking()
        for key in ("ranking_method", "excluded"):
            thin.pop(key)
        _report_capture(monkeypatch, contests=[_contest_row(ranking=thin)])
        text = st.report_edition("americasnlp-2026",
                                 out_dir=str(tmp_path)).read_text()
        assert st.NOT_RECORDED in text
        # No fabricated test name where the snapshot recorded no policy.
        assert "approximate randomization" not in text

    def test_newer_keys_are_rendered_when_present(self, monkeypatch, tmp_path):
        _report_capture(monkeypatch, contests=[_contest_row(
            ranking=_frozen_ranking(
                by_track={"constrained": {"entries": [
                    _ranked_entry(1, 1, "alpha", 61.0)]},
                    "unconstrained": {"entries": []}},
                contrastive=[_ranked_entry(1, 1, "bravo-b", 50.0)],
                exclusions=[{"run_card_id": "rc-x", "reason": "no phase open"}],
                prize_eligibility={"rc-alpha": {"eligible": False,
                                                "reason": "handover not verified"}},
                deferred_results=[{"request_id": "authreq-1"}],
                identity_policy="revealed at close"))])
        text = st.report_edition("americasnlp-2026",
                                 out_dir=str(tmp_path)).read_text()
        assert "| constrained | 1 |" in text
        assert "bravo-b" in text
        assert "no phase open" in text
        assert "handover not verified" in text
        assert "1 result(s) were withheld until close" in text
        assert "revealed at close" in text

    def test_prize_rule_is_stated_under_R1(self, monkeypatch, tmp_path):
        _report_capture(monkeypatch,
                        contests=[_contest_row(ranking=_frozen_ranking())])
        text = st.report_edition("americasnlp-2026",
                                 out_dir=str(tmp_path)).read_text()
        assert st.PRIZE_RULE in text
        assert "sealed-lane" in text
        # R1-trinary (2026-09-07): the report states the three options and
        # never implies one mandatory condition for all.
        assert "pass_to_holders, retain_ip or release_open" in text
        assert "frozen before the first entry" in text
        assert "reproduces the declared term" in text

    def test_a_contest_without_terms_says_it_has_no_prize(
            self, monkeypatch, tmp_path):
        _report_capture(monkeypatch, contests=[_contest_row(
            ranking=_frozen_ranking(prize_terms={
                "declared": False, "terms": None, "terms_sha256": None,
                "gate": []}))])
        text = st.report_edition("americasnlp-2026",
                                 out_dir=str(tmp_path)).read_text()
        assert "no prize terms were declared" in text.lower()

    def test_declared_terms_are_reproduced_with_hash_and_gate(
            self, monkeypatch, tmp_path):
        from mt_eval_harness import contest_prize_terms as cpt

        declared = {"disposition": "release_open"}
        terms = cpt.normalize_prize_terms(declared)
        digest = cpt.terms_sha256(declared)
        _report_capture(monkeypatch, contests=[_contest_row(
            ranking=_frozen_ranking(
                prize_terms={"declared": True, "terms": terms,
                             "terms_sha256": digest,
                             "describe": cpt.describe(terms),
                             "gate": cpt.prize_gate(terms)},
                prize_eligibility={"rc-alpha": {
                    "eligible": False,
                    "reason": "release not recorded",
                    "gate": {"handover_verified": True,
                             "release_verified": False,
                             "assignment_recorded": None}}}))])
        text = st.report_edition("americasnlp-2026",
                                 out_dir=str(tmp_path)).read_text()
        # The OPTION is the headline, in its own words, and every derived
        # dimension is reproduced under it — not summarised.
        assert "The term this contest declared: `release_open`" in text
        assert cpt.DISPOSITION_HEADLINES["release_open"] in text
        for name, value in terms.items():
            assert f"`{value}`" in text
            if name != "disposition":
                assert f"`{name}`" in text
        assert digest in text
        assert "`release_verified`" in text
        # not-required steps read as a dash, never as a pass or a failure
        assert "─" in text
        assert "release not recorded" in text

    def test_descriptions_are_verbatim_and_contrastives_labelled(
            self, monkeypatch, tmp_path):
        _report_capture(monkeypatch,
                        contests=[_contest_row(ranking=_frozen_ranking())])
        text = st.report_edition("americasnlp-2026",
                                 out_dir=str(tmp_path)).read_text()
        assert "> A pipeline system." in text
        assert "> Second line of the description." in text
        assert "#### ALPHA" in text
        assert "https://example.org/alpha" in text
        # bravo wrote nothing — 1 of 2 carry a description.
        assert "1 of 2 submission(s) carry a description" in text

    def test_unreadable_descriptions_surface_the_db_error_verbatim(
            self, monkeypatch, tmp_path):
        _report_capture(
            monkeypatch, contests=[_contest_row(ranking=_frozen_ranking())],
            submissions_error='column contest_submissions.description does not exist')
        text = st.report_edition("americasnlp-2026",
                                 out_dir=str(tmp_path)).read_text()
        assert "column contest_submissions.description does not exist" in text
        assert "could not be read" in text

    def test_no_human_judgment_is_claimed_anywhere(self, monkeypatch, tmp_path):
        _report_capture(monkeypatch,
                        contests=[_contest_row(ranking=_frozen_ranking())])
        text = st.report_edition("americasnlp-2026",
                                 out_dir=str(tmp_path)).read_text()
        assert "No human judgment appears anywhere in this report" in text


class TestReportEditionRefusals:
    def test_an_open_contest_is_refused_by_name(self, monkeypatch, tmp_path):
        _report_capture(monkeypatch, contests=[
            _contest_row("c-agr", ranking=_frozen_ranking()),
            _contest_row("c-quy", status="open"),
        ])
        with pytest.raises(st.SharedTaskError,
                           match=r"c-quy \(open\).*FROZEN"):
            st.report_edition("americasnlp-2026", out_dir=str(tmp_path))
        assert not list(tmp_path.iterdir()), "no partial report may be written"

    def test_a_closed_contest_without_a_snapshot_is_refused(
            self, monkeypatch, tmp_path):
        _report_capture(monkeypatch, contests=[_contest_row("c-agr")])
        with pytest.raises(st.SharedTaskError, match="no.*final_ranking"):
            st.report_edition("americasnlp-2026", out_dir=str(tmp_path))

    def test_an_edition_with_no_contests_is_refused(self, monkeypatch, tmp_path):
        _report_capture(monkeypatch, contests=[])
        with pytest.raises(st.SharedTaskError, match="no contests attached"):
            st.report_edition("americasnlp-2026", out_dir=str(tmp_path))

    def test_an_unregistered_edition_is_refused_before_any_contest_read(
            self, monkeypatch, tmp_path):
        _capture(monkeypatch, responses=[[]])
        with pytest.raises(st.SharedTaskError, match="not registered"):
            st.report_edition("no-such-edition", out_dir=str(tmp_path))


class TestSetReportUrl:
    def test_patches_both_columns(self, monkeypatch):
        calls = _report_capture(monkeypatch, contests=[])
        row = st.set_report_url("americasnlp-2026",
                                "https://example.org/findings.pdf")
        patch = [c for c in calls if c[0] == "PATCH"][0]
        _method, path, data, params = patch
        assert path == "shared_tasks"
        assert params == {"shared_task_id": "eq.americasnlp-2026"}
        assert data["report_url"] == "https://example.org/findings.pdf"
        assert data["report_generated_at"].endswith("+00:00")
        assert row["report_url"] == "https://example.org/findings.pdf"

    @pytest.mark.parametrize("bad", ["", "   ", "example.org/report",
                                     "http://example.org/report",
                                     "https://has space/report"])
    def test_non_https_urls_are_refused(self, monkeypatch, bad):
        calls = _report_capture(monkeypatch, contests=[])
        with pytest.raises(st.SharedTaskError, match="https"):
            st.set_report_url("americasnlp-2026", bad)
        assert not [c for c in calls if c[0] == "PATCH"]

    def test_a_pre_074_stack_surfaces_the_db_error_verbatim(self, monkeypatch):
        def fake_service_request(method, path, **kw):
            if path == "shared_tasks" and method == "GET":
                return [EDITION_ROW]
            raise RuntimeError(
                "PGRST204: Column 'report_url' of relation 'shared_tasks' "
                "does not exist")
        monkeypatch.setattr(svc, "service_request", fake_service_request)
        with pytest.raises(st.SharedTaskError) as exc:
            st.set_report_url("americasnlp-2026", "https://example.org/r.pdf")
        msg = str(exc.value)
        assert "PGRST204" in msg and "report_url" in msg
        assert "migration 074" in msg
