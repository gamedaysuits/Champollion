"""pair_notation — one reading of a language pair, however it is written.

The harness writes a pair as ``src>tgt`` (``eng>crk``): the contest rows, the
manifests and the run cards all carry that form. People and the other tools
also write ``eng-crk`` (nmt-forge's ``--pair``, file names, corpus ids) and
``eng→crk``. Every harness command that takes a pair accepts all three and
stores ``src>tgt``.

A ``>`` is a shell redirect: ``--pair eng>crk`` unquoted runs the command with
``--pair eng`` and writes its output to a file named ``crk``. So every pair
the harness prints inside a command is quoted (:func:`quoted`), and the
hyphen form is accepted so nobody has to remember to quote.

The hyphen form is read as a pair only when it is exactly two language codes
(two or three letters each): ``eng-crk`` is a pair, while ``crk-Cans`` (a code
with a script subtag) is not. Write a pair whose sides carry subtags with
``>`` (``'eng>crk-Cans'``).
"""

from __future__ import annotations

import argparse
import re
import shlex

#: Arrows read as the pair separator, longest first.
_ARROWS = ("->", "→", ">")

#: The hyphen form: exactly two bare ISO 639 codes.
_HYPHEN_PAIR = re.compile(r"^([A-Za-z]{2,3})-([A-Za-z]{2,3})$")

PAIR_FORMS = ("'eng>crk' (quoted: an unquoted > is a shell redirect), "
              "eng-crk, or 'eng→crk'")


class PairNotationError(ValueError):
    """A pair that is not ``src>tgt``, ``src-tgt`` or ``src→tgt``."""


def parse_pair(text: str) -> tuple[str, str]:
    """``(src, tgt)`` from ``eng>crk``, ``eng-crk``, ``eng→crk`` or
    ``eng->crk`` (whitespace around either side is dropped). Raises
    :class:`PairNotationError` for anything else."""
    raw = str(text or "").strip()
    for arrow in _ARROWS:
        if arrow in raw:
            src, _, tgt = raw.partition(arrow)
            src, tgt = src.strip(), tgt.strip()
            if src and tgt and not any(a in tgt for a in _ARROWS):
                return src, tgt
            break
    else:
        m = _HYPHEN_PAIR.match(raw)
        if m:
            return m.group(1), m.group(2)
    raise PairNotationError(
        f"{text!r} is not a language pair — write it as {PAIR_FORMS}.")


def normalize_pair(text: str) -> str:
    """The stored form, ``src>tgt``."""
    src, tgt = parse_pair(text)
    return f"{src}>{tgt}"


def split_pair(text: str | None) -> tuple[str, str]:
    """``(src, tgt)`` for a pair the harness READS (a contest row, a node
    config): any accepted form, and ``("", "")`` for an empty or placeholder
    value (``">"``) instead of a refusal — the caller decides what an absent
    pair means."""
    try:
        return parse_pair(text or "")
    except PairNotationError:
        src, _, tgt = str(text or "").partition(">")
        return src.strip(), tgt.strip()


def argparse_pair(text: str) -> str:
    """``type=`` for a pair argument: accepts every form, stores
    ``src>tgt``; a bad value is an argparse error naming the forms."""
    try:
        return normalize_pair(text)
    except PairNotationError as exc:
        raise argparse.ArgumentTypeError(str(exc)) from exc


def quoted(pair: str) -> str:
    """A pair as it must appear inside a printed shell command:
    ``'eng>crk'``."""
    return shlex.quote(str(pair))
