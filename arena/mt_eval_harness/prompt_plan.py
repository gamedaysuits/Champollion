"""What the model is told: the language names a prompt uses, and the prompt.

One reading for the run header, the dry run and an agent's plan (the MCP
server's run-plan probe asks :func:`plan_for`), so the three never disagree.

**Language names.** The harness's prompt names the target language
("Translate the given English text to Northern Sami."). A run given a CODE
where the name belongs (``--target-lang sme`` — the MCP server's
``target_language`` takes a code or a name, and its own guide passes
``"crk"``) used to put the code into the prompt word for word: "… text to
sme." Nothing showed the prompt, so a naive baseline was quietly
handicapped against a coached run that named the language (synthetic
researcher, Round 11). A code-shaped name is now resolved to the language's
name through the card adapter (``language_cards.get_name`` — the
normalized card, never a bare JSON read) and the run says so; when no card
names it, the code stays and the run warns.

**The prompt.** A coaching file REPLACES the harness's built-in prompt: the
model gets the file as written (plus the --target-script line). That is how
coached runs are defined and published, and it is not changed here — but the
plan and the header now say it, show the built-in prompt the file replaces,
and warn when the coaching text names neither the target language nor its
code (the model is then never told which language to write).
"""

from __future__ import annotations

import hashlib
import re
import unicodedata
from pathlib import Path
from typing import Any

#: A BCP-47-shaped language tag: a 2–3 letter lowercase primary subtag and
#: optional subtags (``sme``, ``crk-Cans``, ``fr-CA``, ``cmn_Hans``). A
#: capitalised word ("Ewe", "Tok Pisin") is a name, never a code — names are
#: written capitalised in every card and every example.
CODE_SHAPED_RE = re.compile(r"^[a-z]{2,3}(?:[-_][A-Za-z0-9]{2,8})*$")


def is_code_shaped(value: Any) -> bool:
    """True when ``value`` looks like a language code rather than a name."""
    return isinstance(value, str) and bool(CODE_SHAPED_RE.match(value.strip()))


def resolve_language_name(given: str) -> dict:
    """The language's name for a code-shaped value, through the card adapter.

    Returns ``{"given", "code", "name", "resolved", "why"}``: ``name`` is the
    card's name when one resolves (``resolved`` True), else the code itself
    with ``why`` saying why no name was found. Never raises — a card index
    that cannot be read is reported as the reason.
    """
    code = given.strip().replace("_", "-")
    out = {"given": given, "code": code, "name": code, "resolved": False,
           "why": None}
    from mt_eval_harness import language_cards as lc
    if lc.is_private_use(code.split("-", 1)[0]):
        out["why"] = ("it is a private-use code (qaa–qtz), which no language "
                      "card names, by design")
        return out
    try:
        name = lc.get_name(code)
        canonical = lc.resolve_code(code)
    except Exception as exc:  # noqa: BLE001 — reported, never swallowed
        out["why"] = (f"the language-card index could not be read "
                      f"({type(exc).__name__}: {exc})")
        return out
    if name and name.strip() and name.strip() != code:
        out.update(name=name.strip(), resolved=True,
                   code=canonical or code)
        return out
    out["why"] = "no language card names it"
    return out


def apply_language_names(config) -> list[str]:
    """Give the prompt NAMES where the run was given codes.

    For the target and the source side: when ``config.<side>_lang`` is
    code-shaped, resolve the language's name through the cards and use it;
    record what happened on ``config.<side>_lang_resolution`` (serialized
    into the run log). A target code that was not otherwise recorded becomes
    ``target_code``. Returns the header lines to print (empty when nothing
    was code-shaped). Idempotent: a value already resolved is a name.
    """
    lines: list[str] = []
    for side, label in (("target", "Target lang"), ("source", "Source lang")):
        attr = f"{side}_lang"
        given = (getattr(config, attr, "") or "").strip()
        if not is_code_shaped(given):
            continue
        r = resolve_language_name(given)
        setattr(config, f"{side}_lang_resolution", r)
        code_attr = f"{side}_code"
        if not (getattr(config, code_attr, "") or "").strip():
            setattr(config, code_attr, r["code"])
        if r["resolved"]:
            setattr(config, attr, r["name"])
            lines.append(
                f"  {label}: {r['name']} — the code '{given}' resolved through "
                f"its language card; the prompt names the language, not the "
                f"code")
        else:
            fix = (f"Pass --target-lang <the language's name> (and "
                   f"--target-lang-code {given} to record the code)"
                   if side == "target"
                   else "Pass --source-lang <the language's name>")
            lines.append(
                f"  ⚠ {label}: '{given}' is a language code, and {r['why']} — "
                f"the prompt will say \"{given}\", not a language name. {fix}.")
    return lines


# ---------------------------------------------------------------------------
# The prompt
# ---------------------------------------------------------------------------

def _fold(text: str) -> str:
    """Case- and diacritic-insensitive form for a whole-word search."""
    decomposed = unicodedata.normalize("NFD", str(text or ""))
    return "".join(ch for ch in decomposed
                   if not unicodedata.combining(ch)).casefold()


def target_terms(config) -> list[str]:
    """Every way a coaching text could name the run's target language: the
    name the prompt uses, the card's name and every recorded endonym and
    alternate name (read through the card adapter), and the code. Codes of
    two letters are left out — "se" or "fr" turn up as ordinary words."""
    terms: list[str] = []

    def add(v):
        if isinstance(v, (list, tuple)):
            for x in v:
                add(x)
            return
        if isinstance(v, str):
            s = v.strip()
            if len(s) >= 3 and s not in terms:
                terms.append(s)

    add(getattr(config, "target_lang", ""))
    res = getattr(config, "target_lang_resolution", None) or {}
    add(res.get("given"))
    code = (getattr(config, "target_code", "") or
            getattr(config, "target_lang_code", "") or res.get("code") or "")
    add(code)
    if code:
        try:
            from mt_eval_harness import language_cards as lc
            card = lc.get_card(code) or {}
            add(card.get("name"))
            add(card.get("nativeName"))
            for field in ("endonym", "alternateNames"):
                for claim in lc.attributions(card.get(field)):
                    add(claim.get("value"))
        except Exception:  # noqa: BLE001 — the names given still count
            pass
    return terms


def named_target_term(text: str, terms: list[str]) -> str | None:
    """The first of ``terms`` that ``text`` names as a whole word, or None."""
    folded = _fold(text)
    for term in terms:
        t = _fold(term)
        if t and re.search(r"(?<!\w)" + re.escape(t) + r"(?!\w)", folded):
            return term
    return None


def names_target(text: str, terms: list[str]) -> bool:
    """True when ``text`` names any of ``terms`` as a whole word."""
    return named_target_term(text, terms) is not None


def _first_line(text: str, limit: int = 100) -> str:
    for line in str(text or "").splitlines():
        s = line.strip()
        if s:
            return s if len(s) <= limit else s[: limit - 1] + "…"
    return ""


def prompt_plan(config, prompt_providers: list | None = None) -> dict:
    """What the model will be instructed with, without sending anything.

    ``kind``: ``naive`` (the harness's built-in prompt), ``coaching`` (a
    coaching file or legacy custom prompt — it REPLACES the built-in one) or
    ``provider`` (a registered prompt plugin). ``text`` / ``sha256`` /
    ``chars``: the prompt exactly as the run would send it (the sha256 the
    run records and the cache keys on). For ``coaching``: ``builtin`` is the
    built-in prompt the file replaces, ``names_target`` whether the file
    names the target language or its code, ``first_line`` its first line.
    ``error``: why no prompt could be built (the real run stops on it).
    """
    from mt_eval_harness.runner import (
        build_naive_prompt, load_system_prompt, script_instruction)
    coaching = (getattr(config, "coaching_file", None)
                or (getattr(config, "custom_prompt_path", None)
                    if getattr(config, "prompt_version", "") == "custom" else None))
    plan: dict = {"kind": ("coaching" if coaching
                           else "naive" if config.prompt_version == "naive"
                           else "provider"),
                  "coaching_file": str(coaching) if coaching else None}
    try:
        text = load_system_prompt(config, prompt_providers)
    except (ValueError, OSError) as exc:
        plan["error"] = str(exc)
        return plan
    plan.update(text=text, chars=len(text),
                sha256=hashlib.sha256(text.encode("utf-8")).hexdigest(),
                script_line=script_instruction(config) or None)
    if plan["kind"] == "coaching":
        plan["replaces_builtin"] = True
        plan["builtin"] = build_naive_prompt(config)
        plan["first_line"] = _first_line(text)
        terms = target_terms(config)
        plan["target_terms"] = terms
        named = named_target_term(text, terms) if terms else None
        plan["names_target"] = (named is not None) if terms else None
        # Which name it used — the plan's verdict quotes it (Round 13).
        plan["named_as"] = named
    return plan


#: Why a coaching file's first line is withheld for a protected corpus —
#: the MCP plan says the same (mcp-server run-plan.js COACHING_LINE_WITHHELD).
COACHING_LINE_WITHHELD = (
    "first line withheld — the corpus is protected (local-only, sealed or "
    "consent-required), and a coaching file can be built from its own "
    "sentences (examples or a glossary cut from it), so none of its text is "
    "shown")


def prompt_plan_lines(plan: dict, *, target_name: str = "",
                      target_code: str = "",
                      show_coaching_line: bool = True) -> list[str]:
    """The header / dry-run lines for :func:`prompt_plan`'s answer. The
    built-in prompt is shown whole (it is the harness's template and the
    language names, nothing from the corpus); a coaching file is shown by
    its first line and hash only — its text is the user's. With
    ``show_coaching_line`` False (a protected corpus: the runner passes it
    for local-only / sealed / consent-required corpora) the first line is
    withheld and the line says why (:data:`COACHING_LINE_WITHHELD`) — the
    run header printed it beside "Steward: marked local-only" while the MCP
    plan withheld it (synthetic Cree school, Round 12)."""
    if plan.get("error"):
        return [f"  Prompt text: cannot be built — {plan['error']}"]
    sha = (plan.get("sha256") or "")[:12]
    if plan.get("kind") == "naive":
        return [f"  Prompt text: the harness's built-in prompt (sha256 {sha}…): "
                f"\"{' '.join(plan['text'].split())}\""]
    if plan.get("kind") == "provider":
        return [f"  Prompt text: from a prompt plugin, {plan['chars']:,} chars "
                f"(sha256 {sha}…)"]
    name = Path(plan.get("coaching_file") or "coaching").name
    first = plan.get("first_line") or ""
    lines = [
        f"  Prompt text: {name} REPLACES the harness's built-in prompt — the "
        f"model gets the file as written"
        + (" plus the script line" if plan.get("script_line") else "")
        + f" ({plan['chars']:,} chars, sha256 "
        f"{sha}…" + ((f"; first line: \"{first}\"" if first else "")
                     if show_coaching_line
                     else f"; {COACHING_LINE_WITHHELD}") + ").",
    ]
    lines.append("  " + coaching_verdict(plan, target_name=target_name,
                                         target_code=target_code))
    return lines


def coaching_verdict(plan: dict, *, target_name: str = "",
                     target_code: str = "") -> str:
    """ONE plain verdict on a coaching file: the built-in prompt it replaces,
    and whether it names the target language (✓ / ⚠).

    It used to print 'Not sent: "<built-in>" — the file must say what the
    model needs', which read as a failure even when the file named the
    language — and with the first line withheld for a protected corpus,
    nobody could tell whether it passed (synthetic Cree school, Round 13).
    The MCP plan prints the same sentence (mcp-server run-plan.js)."""
    name = Path(plan.get("coaching_file") or "coaching").name
    builtin = " ".join(str(plan.get("builtin") or "").split())
    replaces = f'it replaces the built-in "{builtin}"'
    who = target_name or "the target language"
    code = (f" ({target_code})" if target_code and target_code != who
            else "")
    verdict = plan.get("names_target")
    if verdict is True:
        named = plan.get("named_as") or who
        said = (f"names {who}" if _fold(named) == _fold(who)
                else f"names {who} (as \"{named}\")")
        return (f"✓ Coaching:   {name}: {replaces} and {said} — the model is "
                f"told which language to write.")
    if verdict is False:
        return (f"⚠ Coaching:   {name}: {replaces} but names neither {who} nor "
                f"its code{code} — the model is never told which language to "
                f"write. Name the language in the file.")
    return (f"  Coaching:   {name}: {replaces}; no name or code is known for "
            f"the target language, so whether the file names it was not "
            f"checked.")


def plan_for(*, target_lang: str = "", source_lang: str = "",
             target_code: str = "", source_code: str = "",
             coaching_file: str = "", target_script: str = "",
             corpus_path: str = "", source_field: str = "",
             target_field: str = "") -> dict:
    """The prompt plan for a run that has not started — an agent's plan (the
    MCP server's run-plan probe). Builds the RunConfig the run would build
    from the same inputs, names the languages as the run would
    (:func:`apply_language_names`, else the code's card name as the corpus
    loader does) and returns :func:`prompt_plan` plus the name resolutions.

    ``corpus_path`` (a file on this machine, never a registry id — that may
    need a fetch): its references are read, as the run reads them, ONLY for
    :func:`script_from_references` — an aggregate script share; no sentence
    leaves this function. Nothing else is read but the coaching file and
    the cards."""
    from mt_eval_harness.config import RunConfig
    from mt_eval_harness import language_cards as lc
    cfg = RunConfig(model="(plan)", target_lang=target_lang or "",
                    source_lang=source_lang or "",
                    coaching_file=coaching_file or None,
                    target_script=target_script or "")
    cfg.target_code = target_code or ""
    cfg.source_code = source_code or ""
    if source_field:
        cfg.source_field = source_field
    if target_field:
        cfg.target_field = target_field
    if coaching_file:
        cfg.prompt_version = "coached"
    notes = apply_language_names(cfg)
    for side in ("target", "source"):
        if not getattr(cfg, f"{side}_lang") and getattr(cfg, f"{side}_code"):
            try:
                name = lc.get_name(getattr(cfg, f"{side}_code"))
            except Exception:  # noqa: BLE001 — the code stands in
                name = None
            setattr(cfg, f"{side}_lang", name or getattr(cfg, f"{side}_code"))
    script = None
    if corpus_path and not target_script and Path(corpus_path).is_file():
        import contextlib
        import io
        from mt_eval_harness.corpus_loader import load_corpus
        cfg.corpus_path = corpus_path
        try:
            with contextlib.redirect_stdout(io.StringIO()):
                entries, _meta = load_corpus(cfg)
            lines = script_from_references(cfg, entries)
            src = getattr(cfg, "target_script_source", None)
            script = {"lines": [ln.strip() for ln in lines],
                      "chosen": (src or {}).get("chosen"),
                      "shares": (src or {}).get("shares"),
                      "letters": (src or {}).get("letters"),
                      "card_scripts": (src or {}).get("card_scripts")}
        except Exception as exc:  # noqa: BLE001 — said, the run reads it again
            script = {"error": f"{type(exc).__name__}: {exc}"}
    plan = prompt_plan(cfg)
    plan["script"] = script
    plan["target_lang"] = cfg.target_lang
    plan["source_lang"] = cfg.source_lang
    plan["target_resolution"] = getattr(cfg, "target_lang_resolution", None)
    plan["source_resolution"] = getattr(cfg, "source_lang_resolution", None)
    plan["notes"] = [n.strip() for n in notes]
    return plan


# ---------------------------------------------------------------------------
# The script the references are written in
# ---------------------------------------------------------------------------

#: The share of a reference side's letters one script must hold before the
#: harness prompts for it on its own. Below it the references are mixed and
#: the choice stays the user's (the run warns with the shares).
DOMINANT_SCRIPT_SHARE = 0.9


def reference_script_shares(texts, scripts: list[str]) -> dict:
    """Unicode script shares over the letters of ``texts`` — an AGGREGATE:
    ``{"letters": n, "shares": {code: fraction, ...}, "other": fraction}``
    for the ISO 15924 ``scripts`` given (the target card's list). Never
    returns, prints or stores any text: only counts leave this function, so
    it is safe on a local-only or sealed corpus's references (they are
    already on this machine; nothing is sent anywhere)."""
    import regex  # a sacrebleu dependency; declared by the harness too
    probes = {}
    for code in scripts:
        try:
            probes[code] = regex.compile(r"\p{Script=" + code + r"}")
        except regex.error:
            continue  # not a script Unicode encodes (pIqaD …): never counted
    counts = {code: 0 for code in probes}
    letters = other = 0
    for text in texts:
        for ch in str(text or ""):
            if not ch.isalpha():
                continue
            letters += 1
            for code, rx in probes.items():
                if rx.match(ch):
                    counts[code] += 1
                    break
            else:
                other += 1
    if not letters:
        return {"letters": 0, "shares": {}, "other": 0.0}
    return {"letters": letters,
            "shares": {c: n / letters for c, n in counts.items()},
            "other": other / letters}


def _pct(x: float) -> str:
    return f"{round(x * 100)}%"


def script_from_references(config, corpus: list[dict]) -> list[str]:
    """When the target's card lists more than one script and the run names
    none, read the script off the REFERENCES (an aggregate share — see
    :func:`reference_script_shares`) and prompt for the dominant one.

    Round 9 made the plan warn; the Round 11 Cree school still had to infer
    SRO by counting letters in its training pairs, because its test file was
    one it must not read. The harness reads the references locally anyway
    (to score them), so it can say which script they are in without showing
    a sentence. Sets ``config.target_script`` and records
    ``config.target_script_source`` when one script holds at least
    :data:`DOMINANT_SCRIPT_SHARE` of the letters; returns the lines to print.
    No-op for an MT engine or method plugin (no prompt), a run that named a
    script, or a card with fewer than two scripts.
    """
    if (getattr(config, "target_script", "") or config.mt_method
            or (config.method_path or "").strip()):
        return []
    from mt_eval_harness.config import target_card_scripts
    scripts, label = target_card_scripts(config)
    if len(scripts) < 2:
        return []
    field = config.target_field or "reference"
    refs = [e.get(field) for e in corpus or [] if e.get(field)]
    tally = reference_script_shares(refs, scripts)
    shares = tally["shares"]
    if not tally["letters"] or not shares:
        return []
    shown = ", ".join(f"{_pct(v)} {c}" for c, v in
                      sorted(shares.items(), key=lambda kv: -kv[1])
                      if round(v * 100))
    if tally["other"]:
        shown += f", {_pct(tally['other'])} other"
    best = max(shares, key=shares.get)
    record = {"from": "references", "letters": tally["letters"],
              "shares": {c: round(v, 4) for c, v in shares.items()},
              "other": round(tally["other"], 4),
              "card_scripts": scripts,
              "threshold": DOMINANT_SCRIPT_SHARE}
    if shares[best] >= DOMINANT_SCRIPT_SHARE:
        config.target_script = best
        config.target_script_source = dict(record, chosen=best)
        return [f"  Script:      references are {shown} → prompting for "
                f"{best} ({label}'s card lists {', '.join(scripts)}; counted "
                f"over the references' letters, no sentence shown; pass "
                f"--target-script to choose another)"]
    config.target_script_source = dict(record, chosen=None)
    return [f"  ⚠ Script:    {label}'s card lists {', '.join(scripts)} and the "
            f"references are mixed ({shown}) — no script is asked for. Pass "
            f"--target-script <{'|'.join(scripts)}> (the script the references "
            f"should be scored in)."]
