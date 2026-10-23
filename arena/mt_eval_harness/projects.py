"""Registered projects — "Join a project" (migration 079; founder 2026-10-12).

A project building a translator on the rails can register: a language pair with
task parameters, and an owner. After a short review the curator lists it; helpers
see what it asks for and offer files; the owner accepts or declines each offer —
an accepted file is held by both, submitted by the helper and authorized by the
owner. Nothing of the project's own data passes through here.

  mt-eval project register --project <dir> --name "…" --owner-name "…" [--about …] [--domain …] [--register …]
  mt-eval project list                                   the listed projects and what they ask for
  mt-eval project ask <slug> --kind sentences|word-list|method --what "…" [--how-many N] [--terms "…"]
  mt-eval project offer <slug> <file> --as "<your name>" --terms "…" [--ask <id>] [--note "…"]
  mt-eval project offers <slug>                          (owner) the offers to your project
  mt-eval project accept <offer-id> --into <project dir> (owner) into inbox/, with a consent note
  mt-eval project decline <offer-id> [--why "…"]          (owner)
  mt-eval project withdraw <offer-id>                    (the helper who offered it)
  mt-eval project review [<slug> --list | --pause | --decline "why"]   (curator, service key)

Every command signs in as you (the same sign-in as `mt-eval publish`), except
`list`, which reads only what is public, and `review`, the curator's
service-role lane (never the live database without MT_EVAL_ALLOW_PROD=1).
On the screen: names, counts and states — never the contents of a file.
"""

from __future__ import annotations

import argparse
import hashlib
import json
import re
import sys
import urllib.error
import urllib.parse
import urllib.request
import uuid
from pathlib import Path
from typing import Any

BUCKET = "project-offers"
MAX_BYTES = 50 * 1024 * 1024                 # 079: offered files are at most 50 MB
ASK_KINDS = ("sentences", "word-list", "method")
PUBLIC_COLUMNS = ("slug,display_name,owner_display,source_code,source_name,target_code,target_name,"
                  "purpose,domain,register,about,status,listed_at")


class ProjectError(RuntimeError):
    """A project command that cannot go ahead, said plainly."""


# ---------------------------------------------------------------------------
# the wire (PostgREST + Storage), the user's own session
# ---------------------------------------------------------------------------

def _endpoint() -> tuple[str, str]:
    from .auth import SUPABASE_ANON_KEY, SUPABASE_URL

    return SUPABASE_URL, SUPABASE_ANON_KEY


def _quote(v: Any) -> str:
    # PostgREST operators and lists stay readable ("eq.x", "a,b"); anything
    # that would end or split the URL is encoded
    return urllib.parse.quote(str(v), safe=".,:()*-_")


def _request(method: str, path: str, *, session: dict | None = None, data: Any = None,
             params: dict | None = None, prefer: str = "return=minimal") -> Any:
    url, anon = _endpoint()
    full = f"{url}/rest/v1/{path}"
    if params:
        full += "?" + "&".join(f"{k}={_quote(v)}" for k, v in params.items())
    headers = {"apikey": anon, "Content-Type": "application/json", "Prefer": prefer}
    if session:
        headers["Authorization"] = f"Bearer {session['access_token']}"
    body = json.dumps(data).encode() if data is not None else None
    req = urllib.request.Request(full, data=body, headers=headers, method=method)
    try:
        with urllib.request.urlopen(req, timeout=30) as resp:
            raw = resp.read().decode()
            return json.loads(raw) if raw else None
    except urllib.error.HTTPError as e:
        detail = e.read().decode() if e.fp else ""
        raise ProjectError(_said(detail) or f"the database answered {e.code}") from e
    except (urllib.error.URLError, OSError) as e:
        raise ProjectError(f"could not reach the database: {e}") from e


def _said(detail: str) -> str:
    """The guard's own sentence from a PostgREST error body (a trigger's
    RAISE EXCEPTION comes back as its message)."""
    try:
        return str(json.loads(detail).get("message") or "")
    except ValueError:
        return detail.strip()[:400]


def _storage(method: str, object_path: str, *, session: dict, data: bytes | None = None) -> bytes:
    url, anon = _endpoint()
    full = f"{url}/storage/v1/object/{BUCKET}/{urllib.parse.quote(object_path)}"
    headers = {"apikey": anon, "Authorization": f"Bearer {session['access_token']}"}
    if data is not None:
        headers.update({"Content-Type": "application/octet-stream", "x-upsert": "false"})
    req = urllib.request.Request(full, data=data, headers=headers, method=method)
    try:
        with urllib.request.urlopen(req, timeout=300) as resp:
            return resp.read()
    except urllib.error.HTTPError as e:
        detail = e.read().decode() if e.fp else ""
        raise ProjectError(f"the file store answered {e.code}: {_said(detail)}") from e
    except (urllib.error.URLError, OSError) as e:
        raise ProjectError(f"could not reach the file store: {e}") from e


def _session() -> dict:
    from .auth import get_session

    return get_session()


def _email(session: dict) -> str:
    from .auth import get_submitter_email

    return get_submitter_email(session)


def _account(session: dict) -> str:
    """The helper's account id (the JWT sub, a random UUID): what an offer and
    its storage folder are keyed by — never the email, which the project's
    owner would read (migration 080; docs review 2026-10-12, #2)."""
    uid = str((session.get("user") or {}).get("id") or "").strip()
    if not uid:
        raise ProjectError("your session names no account id — sign in again: mt-eval logout, then retry")
    return uid


def _remove(path: str, session: dict) -> str | None:
    """Remove a stored file (a withdrawn or declined offer's, or an upload whose
    offer was never written); None, or why it could not be (said, never hidden)."""
    try:
        _storage("DELETE", path, session=session)
        return None
    except ProjectError as e:
        return str(e)


# ---------------------------------------------------------------------------
# helpers
# ---------------------------------------------------------------------------

def slugify(text: str) -> str:
    s = re.sub(r"[^a-z0-9]+", "-", str(text).lower()).strip("-")
    return s[:63] or "project"


def safe_file_name(name: str) -> str:
    stem = re.sub(r"-+(?=\.)", "", re.sub(r"[^A-Za-z0-9._-]+", "-", Path(name).name)).strip("-.")
    return (stem or "file")[:120]


def read_project_file(project_dir: str | Path) -> dict:
    """The rails project file — the pair and its purpose (the task)."""
    p = Path(project_dir) / "champollion.project.json"
    if not p.is_file():
        raise ProjectError(f"no champollion.project.json in {project_dir} — register a rails project "
                           "(`champollion new` makes one)")
    doc = json.loads(p.read_text(encoding="utf-8"))
    pair = doc.get("pair") or {}
    if not pair.get("source") or not pair.get("target"):
        raise ProjectError(f"{p} names no language pair")
    return doc


def _project_by_slug(slug: str, session: dict | None) -> dict:
    rows = _request("GET", "projects", session=session, prefer="return=representation",
                    params={"slug": f"eq.{slug}", "select": f"id,{PUBLIC_COLUMNS}"})
    if not rows:
        raise ProjectError(f"no project {slug!r} that you can see — `mt-eval project list` shows the listed ones")
    return rows[0]


def _offer(offer_id: str, session: dict) -> dict:
    rows = _request("GET", "project_offers", session=session, prefer="return=representation",
                    params={"offer_id": f"eq.{offer_id}", "select": "*"})
    if not rows:
        raise ProjectError(f"no offer {offer_id!r} that you can see (offers are private to the helper and the owner)")
    return rows[0]


def _language(code: str, name: str | None) -> str:
    return f"{name} ({code})" if name else code


# ---------------------------------------------------------------------------
# commands
# ---------------------------------------------------------------------------

def register(args) -> str:
    doc = read_project_file(args.project)
    pair = doc["pair"]
    purpose = (args.purpose or doc.get("purpose") or "").strip()
    if not purpose:
        raise ProjectError("say what the translations are for (--purpose, or `purpose` in the project file) — "
                           "it is the project's main task parameter")
    slug = slugify(args.slug or args.name)
    row = {
        "slug": slug, "display_name": args.name.strip(), "owner_display": args.owner_name.strip(),
        "source_code": pair["source"], "source_name": pair.get("source_name"),
        "target_code": pair["target"], "target_name": pair.get("target_name"),
        "purpose": purpose, "domain": args.domain, "register": args.register, "about": args.about,
    }
    session = _session()
    _request("POST", "projects", session=session, data=row)
    got = _project_by_slug(slug, session)
    pair_text = f"{_language(got['source_code'], got.get('source_name'))} → {_language(got['target_code'], got.get('target_name'))}"
    return (f"registered {got['display_name']} ({slug}): {pair_text}, for {got['purpose']}\n"
            f"  status: {got['status']} — a short review comes before it is listed on Join a project\n"
            f"  next: say what you ask helpers for — mt-eval project ask {slug} --kind sentences --what \"…\"")


def list_projects(args) -> str:
    rows = _request("GET", "projects", prefer="return=representation",
                    params={"status": "eq.listed", "select": f"id,{PUBLIC_COLUMNS}", "order": "listed_at.desc"}) or []
    if not rows:
        return "No projects are listed yet."
    asks = _request("GET", "project_asks", prefer="return=representation",
                    params={"status": "eq.open", "select": "id,project_id,kind,what,how_many,terms"}) or []
    lines = []
    for p in rows:
        lines.append(f"{p['display_name']} ({p['slug']}) — "
                     f"{_language(p['source_code'], p.get('source_name'))} → {_language(p['target_code'], p.get('target_name'))}; "
                     f"owner {p['owner_display']}; for {p['purpose']}"
                     + (f"; {p['domain']}" if p.get("domain") else "") + (f"; {p['register']}" if p.get("register") else ""))
        for a in (a for a in asks if a["project_id"] == p["id"]):
            lines.append(f"    ask {a['id']}: {a['kind']}"
                         + (f" ×{a['how_many']}" if a.get("how_many") else "") + f" — {a['what']}"
                         + (f" (terms: {a['terms']})" if a.get("terms") else ""))
    return "\n".join(lines)


def ask(args) -> str:
    if args.kind not in ASK_KINDS:
        raise ProjectError(f"--kind is one of {', '.join(ASK_KINDS)} (review and compute come later)")
    session = _session()
    proj = _project_by_slug(args.slug, session)
    _request("POST", "project_asks", session=session, data={
        "project_id": proj["id"], "kind": args.kind, "what": args.what.strip(),
        "how_many": args.how_many, "terms": args.terms})
    return (f"{proj['display_name']} now asks for {args.kind}"
            + (f" (×{args.how_many})" if args.how_many else "")
            + (" — shown on Join a project" if proj["status"] == "listed" else " — shown once the project is listed"))


def _file_terms(src: Path) -> str:
    """What the file's own sidecar says, checked before anything is uploaded.

    An offer sends the file to the project's storage, outside this computer,
    so the holders' marks decide first (docs review 2026-10-13 — `offer`
    uploaded a local-only file without reading its sidecar). A local-only or
    sealed file is refused, and so is one whose speakers have not agreed: the
    mark is the holders' to change, never this tool's. A training refusal
    travels with the offer, in its terms. Returns that text, or "".
    """
    from mt_eval_harness.framework import read_set

    side = read_set(src)
    if side["errors"]:
        raise ProjectError(f"{Path(side['path']).name} could not be read ({'; '.join(side['errors'])}) — "
                           "it states how this file may be used, so nothing is offered until it is fixed")
    data = side["data"] or {}
    why = None
    if data.get("transmission") == "local-only":
        why = "it is marked local-only: only a model on this computer may ever see it"
    elif data.get("role") == "sealed":
        why = "it is a sealed set: no one outside its holders sees it"
    elif (data.get("terms") or {}).get("speakers_agreed") in ("not-yet", "some-said-no"):
        why = ("the people whose words it holds have not all agreed to its use "
               f"(speakers_agreed: {data['terms']['speakers_agreed']})")
    if why:
        raise ProjectError(
            f"{src.name} is not offered — {why}, and an offer uploads it to the project's storage. "
            f"If its holders decide it may go to this project, they change its mark themselves "
            f"({Path(side['path']).name}); mt-eval never does.")
    if (data.get("terms") or {}).get("training") == "not-allowed":
        return "no model may be trained on it (the file's own terms)"
    return ""


def offer(args) -> str:
    src = Path(args.file)
    if not src.is_file():
        raise ProjectError(f"no file {src}")
    own_terms = _file_terms(src)
    terms = "; ".join(t for t in (args.terms.strip(), own_terms) if t)
    if not 1 <= len(terms) <= 600:
        raise ProjectError(f"the offer's terms are {len(terms)} characters"
                           + (f", with the file's own ({own_terms})" if own_terms else "")
                           + " — they are 1 to 600")
    data = src.read_bytes()
    if not data:
        raise ProjectError(f"{src} is empty")
    if len(data) > MAX_BYTES:
        raise ProjectError(f"{src} is {len(data) // (1024 * 1024)} MB — an offer is at most 50 MB")
    session = _session()
    account = _account(session)
    proj = _project_by_slug(args.slug, session)
    if proj["status"] != "listed":
        raise ProjectError(f"{proj['display_name']} is not listed, so it takes no offers")
    offer_id = uuid.uuid4().hex[:16]
    name = safe_file_name(src.name)
    path = f"{proj['slug']}/{account}/{offer_id}/{name}"
    _storage("POST", path, session=session, data=data)
    try:
        _request("POST", "project_offers", session=session, data={
            "offer_id": offer_id, "project_id": proj["id"], "ask_id": args.ask,
            "submitted_by": account, "helper_display": args.as_name.strip(), "note": args.note,
            "terms": terms, "file_name": name, "storage_path": path,
            "sha256": hashlib.sha256(data).hexdigest(), "bytes": len(data)})
    except ProjectError as e:
        # the offer was refused: its file does not stay behind in the store
        left = _remove(path, session)
        raise ProjectError(f"{e}" + (f" (and its uploaded file could not be removed: {left})" if left else "")) from e
    return (f"offered {name} ({len(data)} bytes) to {proj['display_name']} as {args.as_name} — offer {offer_id}\n"
            "  its owner accepts or declines it; until then you can withdraw it: "
            f"mt-eval project withdraw {offer_id}")


def offers(args) -> str:
    session = _session()
    proj = _project_by_slug(args.slug, session)
    rows = _request("GET", "project_offers", session=session, prefer="return=representation",
                    params={"project_id": f"eq.{proj['id']}", "order": "created_at.asc",
                            "select": "offer_id,ask_id,helper_display,terms,file_name,bytes,status,created_at"}) or []
    if not rows:
        return f"No offers to {proj['display_name']} yet."
    return "\n".join(f"{o['offer_id']}: {o['file_name']} ({o['bytes']} bytes) from {o['helper_display']}"
                     + (f" for ask {o['ask_id']}" if o.get("ask_id") else "")
                     + f" — {o['status']}; terms: {o['terms']}" for o in rows)


def accept(args) -> str:
    """Bring an offered file into the project: inbox/ for `data add` (which
    asks the owner the usual terms questions), and a consent note recording
    who offered it, who authorized it, and on what terms."""
    root = Path(args.into)
    read_project_file(root)
    session = _session()
    o = _offer(args.offer_id, session)
    if o["status"] != "offered":
        raise ProjectError(f"offer {args.offer_id} is {o['status']}")
    data = _storage("GET", o["storage_path"], session=session)
    if hashlib.sha256(data).hexdigest() != o["sha256"]:
        raise ProjectError(f"the stored file for offer {args.offer_id} does not match what was offered "
                           "(its checksum differs) — not brought in")
    (root / "inbox").mkdir(parents=True, exist_ok=True)
    (root / "consent").mkdir(parents=True, exist_ok=True)
    dest = root / "inbox" / f"offer-{o['offer_id']}-{o['file_name']}"
    dest.write_bytes(data)
    note = root / "consent" / f"offer-{o['offer_id']}.json"
    note.write_text(json.dumps({
        "offer_id": o["offer_id"], "file": str(dest.relative_to(root)), "sha256": o["sha256"],
        "submitted_by": {"name": o["helper_display"], "account": o["submitted_by"]},
        "authorized_by": {"account": _email(session)},
        "terms": o["terms"], "note": o.get("note"),
        "held_by": "both: submitted by the helper, authorized by the project's owner",
    }, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    _request("PATCH", "project_offers", session=session, params={"offer_id": f"eq.{o['offer_id']}"},
             data={"status": "accepted"})
    rel = dest.relative_to(root)
    return (f"accepted offer {o['offer_id']} from {o['helper_display']}: {rel} ({len(data)} bytes)\n"
            f"  the consent note: {note.relative_to(root)}\n"
            f"  next: champollion data add {rel} — it asks whose words these are and how they may be used")


def decline(args) -> str:
    session = _session()
    o = _offer(args.offer_id, session)
    _request("PATCH", "project_offers", session=session, params={"offer_id": f"eq.{args.offer_id}"},
             data={"status": "declined", "decline_reason": args.why})
    left = _remove(o["storage_path"], session)        # a declined file does not stay in the store
    return (f"declined offer {args.offer_id}" + (f" — {args.why}" if args.why else "")
            + (f"\n  its file could not be removed from the store: {left}" if left else "; its file is removed"))


def withdraw(args) -> str:
    session = _session()
    o = _offer(args.offer_id, session)
    _request("PATCH", "project_offers", session=session, params={"offer_id": f"eq.{args.offer_id}"},
             data={"status": "withdrawn"})
    left = _remove(o["storage_path"], session)        # a withdrawn file does not stay in the store
    return (f"withdrew offer {args.offer_id}"
            + (f"\n  its file could not be removed from the store: {left}" if left else "; its file is removed"))


def review(args) -> str:
    """The curator's short review (service role; refuses the live database
    unless MT_EVAL_ALLOW_PROD=1)."""
    from .sovereign_service import service_request

    if not args.slug:
        rows = service_request("GET", "projects", params={
            "status": "eq.pending_review", "order": "created_at.asc", "select": PUBLIC_COLUMNS}) or []
        if not rows:
            return "No project is waiting for review."
        return "\n".join(f"{p['slug']}: {p['display_name']} — {_language(p['source_code'], p.get('source_name'))} → "
                         f"{_language(p['target_code'], p.get('target_name'))}; owner {p['owner_display']}; "
                         f"for {p['purpose']}" for p in rows)
    moves = [m for m in (args.list, args.pause, args.decline is not None) if m]
    if len(moves) != 1:
        raise ProjectError("say one of --list, --pause or --decline \"why\"")
    if args.list:
        patch = {"status": "listed"}
    elif args.pause:
        patch = {"status": "paused"}
    else:
        patch = {"status": "declined", "review_note": args.decline}
    service_request("PATCH", "projects", params={"slug": f"eq.{args.slug}"}, data=patch, prefer="return=minimal")
    return f"{args.slug}: {patch['status']}"


COMMANDS = {"register": register, "list": list_projects, "ask": ask, "offer": offer, "offers": offers,
            "accept": accept, "decline": decline, "withdraw": withdraw, "review": review}


def add_project_parser(sub) -> None:
    p = sub.add_parser("project", help="Join a project: register yours, list them, offer files, accept offers")
    ps = p.add_subparsers(dest="project_command")
    r = ps.add_parser("register", help="register a rails project (a short review comes before it is listed)")
    r.add_argument("--project", default=".", help="the rails project folder (champollion.project.json)")
    r.add_argument("--name", required=True, help="the project's name, as the public will see it")
    r.add_argument("--owner-name", required=True, help="the owner's name as shown (never your email)")
    r.add_argument("--slug", default=None, help="its short id (default: from --name)")
    r.add_argument("--purpose", default=None, help="what the translations are for (default: the project file's)")
    r.add_argument("--domain", default=None, help="a task parameter: the domain (e.g. 'everyday', 'health')")
    r.add_argument("--register", default=None, help="a task parameter: the register (e.g. 'spoken', 'formal')")
    r.add_argument("--about", default=None, help="a short text about the project (at most 1,200 characters)")
    ps.add_parser("list", help="the listed projects and what they ask for")
    a = ps.add_parser("ask", help="(owner) say what you ask helpers for")
    a.add_argument("slug")
    a.add_argument("--kind", required=True, choices=ASK_KINDS)
    a.add_argument("--what", required=True)
    a.add_argument("--how-many", type=int, default=None)
    a.add_argument("--terms", default=None, help="the terms offered files come under")
    o = ps.add_parser("offer", help="offer a file to a listed project")
    o.add_argument("slug")
    o.add_argument("file")
    o.add_argument("--as", dest="as_name", required=True, help="your name, as the owner will see it")
    o.add_argument("--terms", required=True, help="the terms you offer it under")
    o.add_argument("--ask", type=int, default=None, help="the ask it answers (mt-eval project list shows ids)")
    o.add_argument("--note", default=None)
    of = ps.add_parser("offers", help="(owner) the offers to your project")
    of.add_argument("slug")
    ac = ps.add_parser("accept", help="(owner) bring an offered file into your project's inbox/")
    ac.add_argument("offer_id")
    ac.add_argument("--into", required=True, help="your rails project folder")
    de = ps.add_parser("decline", help="(owner) decline an offer")
    de.add_argument("offer_id")
    de.add_argument("--why", default=None)
    wd = ps.add_parser("withdraw", help="withdraw an offer you made")
    wd.add_argument("offer_id")
    rv = ps.add_parser("review", help="(curator) the short review: list projects waiting, or list/pause/decline one")
    rv.add_argument("slug", nargs="?", default=None)
    rv.add_argument("--list", action="store_true")
    rv.add_argument("--pause", action="store_true")
    rv.add_argument("--decline", default=None, metavar="WHY")


def run_project_command(args) -> int:
    fn = COMMANDS.get(getattr(args, "project_command", None) or "")
    if fn is None:
        print("usage: mt-eval project register | list | ask | offer | offers | accept | decline | withdraw | review",
              file=sys.stderr)
        return 2
    as_json = bool(getattr(args, "json", False))
    try:
        text = fn(args)
    except ProjectError as e:
        if as_json:
            print(json.dumps({"ok": False, "command": args.project_command, "error": str(e)}))
        else:
            print(f"\n  ✗ {e}", file=sys.stderr)
        return 1
    # --json (the global flag): the same words, in a shape an agent can read
    print(json.dumps({"ok": True, "command": args.project_command, "text": text}) if as_json else text)
    return 0
