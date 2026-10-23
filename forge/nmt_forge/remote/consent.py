"""The people's yes to remote compute, one file at a time.

A file may be sent to a rented machine only when ALL of these hold:

1. its holders did not say "no model may train on this" (set/1 terms);
2. the harness's transmission policy does not seal it: local-only,
   held-out or gold-standard, quarantined, or a modified/unstated licence
   with no transmission consent on its card — those are refused whatever
   the yes (a yes to remote compute is not a licence decision);
3. its sidecar records the people's yes for remote compute
   (``remote_compute``), for THIS content (sha256), this provider, Secure
   Cloud, and every country the machine may be in.

The yes is recorded only by ``nmt-forge remote consent FILE [FILE …] --by NAME``
at a terminal: it shows what will happen once, then names each file with its
hash for an Enter (yes) or "n" (skip). It refuses when no person is at a terminal (an agent's tool
call has no terminal), so an agent cannot record it. That is a guard
against an agent acting on its own, not a lock against a determined
program on the same computer: the record says who said yes and when, and
the ledger keeps every use.
"""

from __future__ import annotations

import datetime as _dt
import hashlib
import json
import os
import sys
from pathlib import Path

from .. import _harness
from ..errors import RemoteComputeRefused

KEY = "remote_compute"
SIDECAR_SUFFIX = ".champollion.json"
PROVIDERS = ("runpod",)
CLOUD = "SECURE"


def sha256_file(path) -> str:
    h = hashlib.sha256()
    with open(path, "rb") as fh:
        for chunk in iter(lambda: fh.read(1 << 20), b""):
            h.update(chunk)
    return h.hexdigest()


def _sidecar(path) -> dict:
    try:
        return _harness.corpus_loader_mod().read_steward_sidecar(path) or {}
    except ValueError as e:
        raise RemoteComputeRefused(
            f"{Path(path).name}: its terms could not be read ({e})",
            why="an unreadable sidecar is not 'no terms': it may say the file must stay here",
            fix=f"correct {Path(path).name}{SIDECAR_SUFFIX} (a JSON object) and run again") from e


def _hard_refusal(path) -> tuple[str, str] | None:
    """(why, fix) when no yes can send this file, else None."""
    from ..privacy import training_not_allowed

    name = Path(path).name
    if training_not_allowed(path):
        return ("its holders said no model may be trained on it",
                f"leave {name} out of the run's training files")
    try:
        pol = _harness.corpus_transmission_policy(path)
    except ValueError as e:
        return (f"its terms could not be read ({e})", f"correct {name}{SIDECAR_SUFFIX} and run again")
    tp = _harness.transmission_policy_mod()
    if pol.mode == tp.MODE_SEALED:
        return (f"it may never leave this computer: {pol.reason}",
                "train on this computer (nmt-forge run without --remote); a file marked local-only stays here")
    if pol.mode == tp.MODE_CONSENT_REQUIRED:
        return (f"its licence needs its rights-holder's consent before it is sent anywhere: {pol.reason}",
                "the steward records transmission consent on the corpus card first (never an agent); until then, "
                "train on this computer")
    return None


def check_file(path, *, provider: str, countries: list[str]) -> dict:
    """{file, sha256, ok, why?, fix?} for one file that would be sent."""
    p = Path(path)
    out = {"file": str(p), "sha256": sha256_file(p) if p.is_file() else None, "ok": False}
    if not p.is_file():
        out.update(why="the file is missing", fix="check the config's data paths")
        return out
    hard = _hard_refusal(p)
    if hard:
        out.update(why=hard[0], fix=hard[1])
        return out
    yes = _sidecar(p).get(KEY)
    consent_cmd = (f"a person at this computer runs: nmt-forge remote consent {p} --by \"<their name>\" "
                   f"--country {','.join(countries)}")
    if not isinstance(yes, dict):
        out.update(why="the people have not said yes to sending this file to a rented machine", fix=consent_cmd)
        return out
    if yes.get("sha256") != out["sha256"]:
        out.update(why="the file has changed since the people said yes (the yes covers the exact contents)",
                   fix=consent_cmd)
        return out
    if yes.get("provider") != provider or yes.get("cloud") != CLOUD:
        out.update(why=f"the yes was for {yes.get('provider')!r} {yes.get('cloud')!r}, not {provider!r} {CLOUD!r}",
                   fix=consent_cmd)
        return out
    agreed = {str(c).upper() for c in yes.get("countries") or []}
    wanted = {c.upper() for c in countries}
    if not wanted or not wanted <= agreed:
        out.update(why=f"the yes covers {sorted(agreed) or 'no country'}, and this run may use "
                       f"{sorted(wanted) or 'any country'}", fix=consent_cmd)
        return out
    out.update(ok=True, granted_by=yes.get("granted_by"), date=yes.get("date"))
    return out


def require_consent(paths, *, provider: str, countries: list[str]) -> list[dict]:
    """Every file's check; refuses (listing every file that fails) unless all pass."""
    checks = [check_file(p, provider=provider, countries=countries) for p in paths]
    bad = [c for c in checks if not c["ok"]]
    if bad:
        lines = "\n".join(f"  - {Path(c['file']).name}: {c['why']}" for c in bad)
        raise RemoteComputeRefused(
            f"{len(bad)} of {len(checks)} file(s) may not be sent to a rented machine:\n{lines}",
            why="remote training sends the sentences to someone else's computer; each file needs its people's "
                "yes, and some files may never leave",
            fix=bad[0]["fix"],
            details={"files": [{k: c.get(k) for k in ("file", "sha256", "ok", "why")} for c in checks]})
    return checks


def terms_text(provider: str, countries: list[str]) -> str:
    """What a yes to remote compute means — shown once, before the files."""
    return (f"A yes lets the file be sent to a machine rented from {provider}:\n"
            f"  - only {provider}'s own datacentres (Secure Cloud), in: {', '.join(countries)};\n"
            "  - for training a model for this project, and nothing else;\n"
            "  - deleted from that machine, and the machine shut down, when the run ends;\n"
            "  - every use is written in this project's ledger.\n"
            "Each yes covers the file exactly as it is now: if it changes, forge asks again.")


def record_consent(path, *, granted_by: str, countries: list[str], provider: str = "runpod",
                   ask=input, is_tty=None, say=print, show_terms: bool = True) -> dict | None:
    """Record the people's yes in the file's sidecar: the terms shown (once,
    for several files — the caller passes show_terms=False after the first),
    the file named with its hash, Enter for yes, "n" to skip (returns None).
    Refuses without a terminal (founder 2026-10-14: "make it enter enter
    enter" — the terminal is the guard against an agent, not the typing)."""
    p = Path(path).resolve()
    tty = sys.stdin.isatty() if is_tty is None else is_tty()
    if not tty:
        raise RemoteComputeRefused(
            "the yes to remote compute must be typed by a person at this computer's terminal",
            why="it lets the people's sentences go to someone else's machine; an AI agent may never give it",
            fix=f"a person opens a terminal and runs: nmt-forge remote consent {p} --by \"<their name>\"")
    if provider not in PROVIDERS:
        raise RemoteComputeRefused(f"unknown provider {provider!r}", fix=f"one of: {', '.join(PROVIDERS)}")
    if not p.is_file():
        raise RemoteComputeRefused(f"{p}: no such file")
    if not granted_by.strip():
        raise RemoteComputeRefused("--by needs the name of the person saying yes")
    countries = sorted({c.strip().upper() for c in countries if c.strip()})
    if not countries:
        raise RemoteComputeRefused("--country needs at least one country code (e.g. CA)")
    hard = _hard_refusal(p)
    if hard:
        raise RemoteComputeRefused(f"{p.name} cannot be sent: {hard[0]}", fix=hard[1])
    digest = sha256_file(p)
    if show_terms:
        say(terms_text(provider, countries))
    answer = ask(f"  {p.name}  (sha256 {digest[:12]}…)  Enter = yes, n = skip: ").strip().lower()
    if answer not in ("", "y", "yes"):
        say(f"  skipped: {p.name} (no yes recorded)")
        return None
    side_path = Path(str(p) + SIDECAR_SUFFIX)
    side = _sidecar(p) if side_path.is_file() else {}
    side[KEY] = {"provider": provider, "cloud": CLOUD, "countries": countries, "sha256": digest,
                 "granted_by": granted_by.strip(), "date": _dt.date.today().isoformat(),
                 "purpose": "training a model for this project",
                 "recorded_with": "nmt-forge remote consent (confirmed at a terminal)"}
    tmp = side_path.with_name(side_path.name + ".tmp")
    tmp.write_text(json.dumps(side, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    os.replace(tmp, side_path)
    return side[KEY]
