"""`mt-eval project` — Join a project (migration 079), over a fake database and
file store: register (the public row carries no email), list (honest when
empty), offer (into the helper's own folder of a listed project, with its
checksum), accept (checksum verified; inbox file + a consent note naming both
helper and owner), and the curator's review. Content-free on the screen."""

from __future__ import annotations

import argparse
import hashlib
import json

import pytest

from mt_eval_harness import projects as P


class FakeWire:
    def __init__(self):
        self.calls = []
        self.tables = {"projects": [], "project_asks": [], "project_offers": []}
        self.files = {}

    def request(self, method, path, *, session=None, data=None, params=None, prefer="return=minimal"):
        self.calls.append((method, path, data, params, bool(session)))
        rows = self.tables[path]
        if method == "POST":
            row = dict(data, id=len(rows) + 1)
            if path == "projects":
                row.update(status="pending_review", listed_at=None)
            if path == "project_offers":
                row.setdefault("status", "offered")
            rows.append(row)
            return None
        match = [r for r in rows if all(
            str(r.get(k)) == str(v).split(".", 1)[1] for k, v in (params or {}).items()
            if k not in ("select", "order") and str(v).startswith("eq."))]
        if method == "GET":
            return [dict(r) for r in match]
        if method == "PATCH":
            for r in match:
                r.update(data)
            return None
        raise AssertionError(method)

    def storage(self, method, object_path, *, session, data=None):
        if method == "POST":
            self.files[object_path] = data
            return b""
        if method == "DELETE":
            self.files.pop(object_path, None)
            return b""
        return self.files[object_path]


HELPER = "bbbbbbbb-0000-0000-0000-000000000002"


@pytest.fixture
def wire(monkeypatch):
    w = FakeWire()
    monkeypatch.setattr(P, "_request", w.request)
    monkeypatch.setattr(P, "_storage", w.storage)
    monkeypatch.setattr(P, "_session", lambda: {"access_token": "t", "user": {"id": HELPER, "email": "helper@example.org"}})
    monkeypatch.setattr(P, "_email", lambda s: "helper@example.org")
    return w


@pytest.fixture
def rails_project(tmp_path):
    root = tmp_path / "family"
    root.mkdir()
    (root / "champollion.project.json").write_text(json.dumps({
        "kind": "language", "name": "English → Our language",
        "pair": {"source": "eng", "target": "qaa", "target_name": "Our language"},
        "purpose": "everyday family phrases"}))
    return root


def test_register_puts_up_the_pair_task_and_owner_and_no_email(wire, rails_project):
    out = P.register(argparse.Namespace(project=str(rails_project), name="Grandpa's words", owner_name="The Ray family",
                                        slug=None, purpose=None, domain="everyday", register="spoken", about=None))
    row = wire.tables["projects"][0]
    assert row["slug"] == "grandpa-s-words"
    assert (row["source_code"], row["target_code"], row["target_name"]) == ("eng", "qaa", "Our language")
    assert row["purpose"] == "everyday family phrases" and row["domain"] == "everyday"
    assert not any("@" in str(v) for v in row.values()), "the public face carries no email"
    assert "status: pending_review — a short review comes before it is listed" in out
    post = next(c for c in wire.calls if c[0] == "POST")
    assert post[4], "registering signs in"


def test_list_is_honest_when_empty_and_shows_asks(wire):
    assert P.list_projects(argparse.Namespace()) == "No projects are listed yet."
    wire.tables["projects"].append({"id": 1, "slug": "p", "display_name": "P", "owner_display": "O", "source_code": "eng",
                                    "target_code": "qaa", "target_name": "Ours", "purpose": "school",
                                    "status": "listed", "listed_at": "now"})
    wire.tables["project_asks"].append({"id": 7, "project_id": 1, "kind": "sentences", "what": "greetings",
                                        "how_many": 40, "terms": "for training", "status": "open"})
    out = P.list_projects(argparse.Namespace())
    assert "P (p) — eng → Ours (qaa); owner O; for school" in out
    assert "ask 7: sentences ×40 — greetings (terms: for training)" in out


def test_an_offer_goes_into_the_helpers_own_folder_with_its_checksum(wire, tmp_path):
    wire.tables["projects"].append({"id": 1, "slug": "p", "display_name": "P", "status": "listed"})
    f = tmp_path / "my sentences.tsv"
    f.write_text("hello\tzub\n")
    out = P.offer(argparse.Namespace(slug="p", file=str(f), as_name="Ana", terms="for training only", ask=None, note=None))
    o = wire.tables["project_offers"][0]
    # the helper's account id, never their email: the owner reads this row (migration 080)
    assert o["storage_path"] == f"p/{HELPER}/{o['offer_id']}/my-sentences.tsv"
    assert o["submitted_by"] == HELPER and "@" not in json.dumps(o)
    assert o["sha256"] == hashlib.sha256(f.read_bytes()).hexdigest() and o["bytes"] == f.stat().st_size
    assert wire.files[o["storage_path"]] == f.read_bytes()
    assert "zub" not in out and "hello" not in out, "never the file's contents"


@pytest.mark.parametrize("marks, why", [
    ({"transmission": "local-only"}, "local-only"),
    ({"role": "sealed"}, "sealed set"),
    ({"terms": {"speakers_agreed": "not-yet"}}, "have not all agreed"),
    ({"terms": {"speakers_agreed": "some-said-no"}}, "have not all agreed"),
])
def test_a_file_its_holders_keep_here_is_never_uploaded(wire, tmp_path, marks, why):
    # docs review 2026-10-13: offer uploaded a local-only file without
    # reading its sidecar
    wire.tables["projects"].append({"id": 1, "slug": "p", "display_name": "P", "status": "listed"})
    f = tmp_path / "ours.tsv"
    f.write_text("hello\tzub\n")
    (tmp_path / "ours.tsv.champollion.json").write_text(json.dumps(marks))
    with pytest.raises(P.ProjectError, match=why) as ei:
        P.offer(argparse.Namespace(slug="p", file=str(f), as_name="Ana", terms="t", ask=None, note=None))
    assert "mt-eval never does" in str(ei.value)
    assert not wire.files and not wire.tables["project_offers"]


def test_an_unreadable_sidecar_stops_the_offer(wire, tmp_path):
    wire.tables["projects"].append({"id": 1, "slug": "p", "display_name": "P", "status": "listed"})
    f = tmp_path / "ours.tsv"
    f.write_text("hello\tzub\n")
    (tmp_path / "ours.tsv.champollion.json").write_text('{"transmission": "local-only",')
    with pytest.raises(P.ProjectError, match="could not be read"):
        P.offer(argparse.Namespace(slug="p", file=str(f), as_name="Ana", terms="t", ask=None, note=None))
    assert not wire.files


def test_a_training_refusal_travels_with_the_offer(wire, tmp_path):
    wire.tables["projects"].append({"id": 1, "slug": "p", "display_name": "P", "status": "listed"})
    f = tmp_path / "ours.tsv"
    f.write_text("hello\tzub\n")
    (tmp_path / "ours.tsv.champollion.json").write_text(json.dumps(
        {"terms": {"training": "not-allowed", "speakers_agreed": "yes"}}))
    P.offer(argparse.Namespace(slug="p", file=str(f), as_name="Ana", terms="for testing", ask=None, note=None))
    assert wire.tables["project_offers"][0]["terms"] == \
        "for testing; no model may be trained on it (the file's own terms)"


def test_no_offer_to_a_project_that_is_not_listed(wire, tmp_path):
    wire.tables["projects"].append({"id": 1, "slug": "p", "display_name": "P", "status": "pending_review"})
    f = tmp_path / "a.tsv"
    f.write_text("x\ty\n")
    with pytest.raises(P.ProjectError, match="is not listed"):
        P.offer(argparse.Namespace(slug="p", file=str(f), as_name="Ana", terms="t", ask=None, note=None))


def test_accept_brings_it_in_held_by_both_and_checks_it_is_the_file_offered(wire, rails_project, monkeypatch):
    data = b"hello\tzub\n"
    wire.files["p/helper@example.org/abcd1234/a.tsv"] = data
    wire.tables["project_offers"].append({"id": 1, "offer_id": "abcd1234", "project_id": 1, "status": "offered",
                                          "storage_path": "p/helper@example.org/abcd1234/a.tsv", "file_name": "a.tsv",
                                          "sha256": hashlib.sha256(data).hexdigest(), "helper_display": "Ana",
                                          "submitted_by": "helper@example.org", "terms": "for training only"})
    monkeypatch.setattr(P, "_email", lambda s: "owner@example.org")
    out = P.accept(argparse.Namespace(offer_id="abcd1234", into=str(rails_project)))
    assert (rails_project / "inbox" / "offer-abcd1234-a.tsv").read_bytes() == data
    note = json.loads((rails_project / "consent" / "offer-abcd1234.json").read_text())
    assert note["submitted_by"]["name"] == "Ana" and note["authorized_by"]["account"] == "owner@example.org"
    assert note["held_by"].startswith("both") and note["terms"] == "for training only"
    assert wire.tables["project_offers"][0]["status"] == "accepted"
    assert "champollion data add inbox/offer-abcd1234-a.tsv" in out
    # a stored file that is not the one offered is refused, nothing written
    wire.tables["project_offers"].append({"id": 2, "offer_id": "efgh5678", "project_id": 1, "status": "offered",
                                          "storage_path": "p/x/efgh5678/b.tsv", "file_name": "b.tsv", "sha256": "0" * 64,
                                          "helper_display": "B", "submitted_by": "x", "terms": "t"})
    wire.files["p/x/efgh5678/b.tsv"] = b"other"
    with pytest.raises(P.ProjectError, match="checksum differs"):
        P.accept(argparse.Namespace(offer_id="efgh5678", into=str(rails_project)))
    assert not (rails_project / "inbox" / "offer-efgh5678-b.tsv").exists()


def test_review_says_one_move(monkeypatch):
    seen = []
    monkeypatch.setattr("mt_eval_harness.sovereign_service.service_request",
                        lambda method, path, **kw: seen.append((method, path, kw)) or [])
    assert P.review(argparse.Namespace(slug=None, list=False, pause=False, decline=None)) == "No project is waiting for review."
    with pytest.raises(P.ProjectError, match="say one of"):
        P.review(argparse.Namespace(slug="p", list=True, pause=True, decline=None))
    assert P.review(argparse.Namespace(slug="p", list=False, pause=False, decline="not this pair")) == "p: declined"
    assert seen[-1][2]["data"] == {"status": "declined", "review_note": "not this pair"}


def test_names_and_slugs():
    assert P.slugify("Grandpa's Words!") == "grandpa-s-words"
    assert P.safe_file_name("../my notes (v2).txt") == "my-notes-v2.txt"


def test_a_refused_offer_leaves_no_file_behind(wire, tmp_path, monkeypatch):
    """Docs review 2026-10-12 (#24): an upload whose offer row was refused stayed in the store."""
    wire.tables["projects"].append({"id": 1, "slug": "p", "display_name": "P", "status": "listed"})
    f = tmp_path / "a.tsv"
    f.write_text("x\ty\n")
    real = wire.request

    def refuse_offers(method, path, **kw):
        if method == "POST" and path == "project_offers":
            raise P.ProjectError("OFFER GUARD: you have made 24 offers in the last 24 hours (limit 24).")
        return real(method, path, **kw)

    monkeypatch.setattr(P, "_request", refuse_offers)
    with pytest.raises(P.ProjectError, match="limit 24"):
        P.offer(argparse.Namespace(slug="p", file=str(f), as_name="Ana", terms="t", ask=None, note=None))
    assert wire.files == {}, "the uploaded file was removed"


def test_withdraw_and_decline_remove_the_stored_file(wire):
    for oid, how in (("w1", "withdraw"), ("d1", "decline")):
        path = f"p/{HELPER}/{oid}/a.tsv"
        wire.files[path] = b"x"
        wire.tables["project_offers"].append({"id": len(wire.tables["project_offers"]) + 1, "offer_id": oid,
                                              "project_id": 1, "status": "offered", "storage_path": path})
        ns = argparse.Namespace(offer_id=oid, why="not what we asked for")
        out = (P.withdraw if how == "withdraw" else P.decline)(ns)
        assert path not in wire.files and "its file is removed" in out


def test_json_is_honoured(wire, capsys):
    rc = P.run_project_command(argparse.Namespace(project_command="list", json=True))
    got = json.loads(capsys.readouterr().out)
    assert rc == 0 and got["ok"] is True and got["command"] == "list" and "text" in got
