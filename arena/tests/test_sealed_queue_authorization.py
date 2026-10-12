"""Tests for the sealed-set `pending-authorization` queue state (Wave 1).

A sealed (sovereign held-out) queue item must NOT auto-run on pickup — it stays
pending-authorization until a valid (unused, unexpired, fingerprint-matching)
grant exists for it (the sovereign multisig plan, M2). The real M-of-N
threshold signing that mints a grant is Wave 2; here we assert the QUEUE-side
data-layer behavior:

  - the request fingerprint recipe is deterministic and binds method + sealed
    corpus version + node measurement,
  - grant validity is single-use + expiry + fingerprint-bound,
  - a sealed item WITHOUT a valid grant does not run (fail-closed default),
  - open (non-sealed) items are completely unaffected.

The crypto is stubbed (the grant_lookup callable is injected) — the data-layer
contract is what's under test.
"""

from __future__ import annotations

import json
from datetime import datetime, timedelta, timezone

import pytest

from mt_eval_harness import queue_runner as q
from mt_eval_harness.queue_runner import (
    PENDING_AUTHORIZATION,
    QueueItemError,
    compute_request_fingerprint,
    grant_is_valid,
    item_requires_authorization,
    partition_authorization,
    select_valid_grant,
)

NOW = datetime(2026, 6, 22, 12, 0, 0, tzinfo=timezone.utc)


def _sealed_item(**over):
    item = {
        "id": "seal-1",
        "sealed": True,
        "sealed_set_id": "sealed-eng-crk-v1",
        "method_sha": "a" * 64,
        "corpus_id": "sealed-eng-crk",
        "corpus_version": "v1",
        "model": "my-method",
        "target_language": "Plains Cree (nêhiyawêwin, SRO)",
        "language_pair": "eng>crk",
        "condition": "sealed",
        "est_cost_usd": 0.10,
    }
    item.update(over)
    return item


def _open_item(**over):
    item = {
        "id": "open-1",
        "corpus_id": "eval-amh-fra-globalvoices-test-v1",
        "model": "google/gemini",
        "target_language": "French",
        "language_pair": "amh>fra",
        "condition": "naive",
        "est_cost_usd": 0.02,
    }
    item.update(over)
    return item


def _grant(fingerprint, *, used=False, expires=None, grant_id="g1"):
    return {
        "grant_id": grant_id,
        "fingerprint": fingerprint,
        "used": used,
        "expires_at": (expires or (NOW + timedelta(hours=1))).isoformat(),
    }


# ---------------------------------------------------------------------------
# item_requires_authorization
# ---------------------------------------------------------------------------

class TestRequiresAuthorization:
    def test_sealed_flag_requires_auth(self):
        assert item_requires_authorization({"sealed": True}) is True

    def test_sealed_set_id_requires_auth(self):
        assert item_requires_authorization({"sealed_set_id": "x"}) is True

    def test_open_item_does_not(self):
        assert item_requires_authorization(_open_item()) is False


# ---------------------------------------------------------------------------
# compute_request_fingerprint — deterministic, recipe-bound, fail-loud
# ---------------------------------------------------------------------------

class TestFingerprint:
    def test_deterministic_64_hex(self):
        fp = compute_request_fingerprint(_sealed_item(), node_measurement="n")
        assert len(fp) == 64 and all(c in "0123456789abcdef" for c in fp)
        assert fp == compute_request_fingerprint(_sealed_item(),
                                                 node_measurement="n")

    def test_matches_documented_recipe(self):
        import hashlib
        it = _sealed_item()
        payload = "\n".join([it["method_sha"], it["corpus_id"],
                             it["corpus_version"], "scores-only", "node-Z"])
        assert (compute_request_fingerprint(it, node_measurement="node-Z")
                == hashlib.sha256(payload.encode()).hexdigest())

    def test_binds_method_corpus_version_and_node(self):
        base = compute_request_fingerprint(_sealed_item(), node_measurement="n")
        assert base != compute_request_fingerprint(
            _sealed_item(method_sha="b" * 64), node_measurement="n")
        assert base != compute_request_fingerprint(
            _sealed_item(corpus_version="v2"), node_measurement="n")
        assert base != compute_request_fingerprint(
            _sealed_item(), node_measurement="other-node")

    def test_missing_field_raises_so_item_is_held(self):
        bad = _sealed_item()
        del bad["method_sha"]
        with pytest.raises(QueueItemError):
            compute_request_fingerprint(bad, node_measurement="n")

    def test_node_measurement_defaults_to_unattested(self, monkeypatch):
        monkeypatch.delenv(q.NODE_MEASUREMENT_ENV, raising=False)
        import hashlib
        it = _sealed_item()
        payload = "\n".join([it["method_sha"], it["corpus_id"],
                             it["corpus_version"], "scores-only", "unattested"])
        assert (compute_request_fingerprint(it)
                == hashlib.sha256(payload.encode()).hexdigest())


# ---------------------------------------------------------------------------
# grant validity — single-use + expiry + fingerprint-binding
# ---------------------------------------------------------------------------

class TestGrantValidity:
    def test_valid_grant(self):
        fp = "f" * 64
        assert grant_is_valid(_grant(fp), fp, now=NOW) is True

    def test_used_grant_invalid(self):
        fp = "f" * 64
        assert grant_is_valid(_grant(fp, used=True), fp, now=NOW) is False

    def test_expired_grant_invalid(self):
        fp = "f" * 64
        past = NOW - timedelta(minutes=1)
        assert grant_is_valid(_grant(fp, expires=past), fp, now=NOW) is False

    def test_fingerprint_mismatch_invalid(self):
        assert grant_is_valid(_grant("f" * 64), "g" * 64, now=NOW) is False

    def test_missing_expiry_invalid_failclosed(self):
        assert grant_is_valid({"fingerprint": "f", "used": False}, "f",
                              now=NOW) is False

    def test_non_dict_invalid(self):
        assert grant_is_valid(None, "f", now=NOW) is False

    def test_select_first_valid(self):
        fp = "f" * 64
        grants = [_grant(fp, used=True, grant_id="used"),
                  _grant("other", grant_id="mismatch"),
                  _grant(fp, grant_id="good")]
        assert select_valid_grant(grants, fp, now=NOW)["grant_id"] == "good"

    def test_select_none_when_no_valid(self):
        fp = "f" * 64
        assert select_valid_grant([_grant(fp, used=True)], fp, now=NOW) is None


# ---------------------------------------------------------------------------
# partition_authorization — the core "sealed item does not run" guarantee
# ---------------------------------------------------------------------------

class TestPartition:
    def test_open_items_always_authorized(self):
        auth, pending = partition_authorization([_open_item()])
        assert len(auth) == 1 and pending == []

    def test_sealed_without_grant_is_held_not_run(self):
        """The headline guarantee: default (fail-closed) lookup -> sealed item
        is pending-authorization, NOT in the authorized (runnable) set."""
        auth, pending = partition_authorization([_sealed_item()])
        assert auth == []
        assert len(pending) == 1
        assert PENDING_AUTHORIZATION in pending[0][1]

    def test_sealed_with_valid_grant_runs(self):
        captured = {}

        def lookup(fp, item):
            captured["fp"] = fp
            return [_grant(fp)]

        auth, pending = partition_authorization(
            [_sealed_item()], grant_lookup=lookup,
            node_measurement="node-Z", now=NOW)
        assert len(auth) == 1 and pending == []
        # The binding is recorded on the item for the run to present at claim.
        assert auth[0]["_auth_grant_id"] == "g1"
        assert auth[0]["_auth_fingerprint"] == captured["fp"]

    def test_sealed_with_expired_grant_is_held(self):
        lookup = lambda fp, it: [_grant(fp, expires=NOW - timedelta(minutes=1))]
        auth, pending = partition_authorization(
            [_sealed_item()], grant_lookup=lookup, now=NOW)
        assert auth == [] and len(pending) == 1

    def test_sealed_with_used_grant_is_held(self):
        lookup = lambda fp, it: [_grant(fp, used=True)]
        auth, pending = partition_authorization(
            [_sealed_item()], grant_lookup=lookup, now=NOW)
        assert auth == [] and len(pending) == 1

    def test_sealed_with_mismatched_grant_is_held(self):
        lookup = lambda fp, it: [_grant("wrong" * 12)]
        auth, pending = partition_authorization(
            [_sealed_item()], grant_lookup=lookup, now=NOW)
        assert auth == [] and len(pending) == 1

    def test_sealed_missing_fingerprint_field_is_held(self):
        bad = _sealed_item()
        del bad["corpus_version"]
        # A grant would be valid IF a fingerprint could be computed — but it
        # can't, so the item is held (never run), not crashed.
        lookup = lambda fp, it: [_grant(fp)]
        auth, pending = partition_authorization([bad], grant_lookup=lookup)
        assert auth == []
        assert "not runnable" in pending[0][1]

    def test_mixed_batch_separates_cleanly(self):
        auth, pending = partition_authorization(
            [_open_item(), _sealed_item(), _open_item(id="open-2")])
        assert {i["id"] for i in auth} == {"open-1", "open-2"}
        assert [i["id"] for i, _ in pending] == ["seal-1"]


# ---------------------------------------------------------------------------
# Integration through run_from_args (--dry-run, spends nothing) — proves a
# sealed item is excluded from the run plan and reported honestly.
# ---------------------------------------------------------------------------

def _run(args_list, tmp_path, queue, monkeypatch, capsys):
    monkeypatch.setenv("MT_EVAL_NO_COVERAGE_SKIP", "1")  # no network
    qfile = tmp_path / "queue.json"
    qfile.write_text(json.dumps(queue))
    from mt_eval_harness.cli import build_parser
    args = build_parser().parse_args(
        args_list + ["--queue", str(qfile), "--no-publish"])
    rc = q.run_from_args(args)
    return rc, capsys.readouterr().out


class TestRunFromArgsGating:
    def test_dry_run_excludes_sealed_from_plan(self, tmp_path, monkeypatch,
                                               capsys):
        queue = {"metadata": {}, "items": [_open_item(), _sealed_item()]}
        rc, out = _run(["queue", "--top", "5", "--dry-run"],
                       tmp_path, queue, monkeypatch, capsys)
        assert rc == 0
        # Exactly one item in the plan — the open one. The sealed item is held.
        assert "Plan: 1 item" in out
        assert PENDING_AUTHORIZATION in out
        assert "nothing executed" in out

    def test_all_sealed_runs_nothing(self, tmp_path, monkeypatch, capsys):
        queue = {"metadata": {}, "items": [_sealed_item()]}
        rc, out = _run(["queue", "--top", "5"],
                       tmp_path, queue, monkeypatch, capsys)
        # No authorized items -> returns 1 BEFORE any auth/spend step.
        assert rc == 1
        assert "all held pending-authorization" in out
