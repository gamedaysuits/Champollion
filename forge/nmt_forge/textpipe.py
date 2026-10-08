"""What ``nmt-forge serve`` does to a string before the model sees it, and
after — the structure-protection layer between an app/document and a
sentence-level seq2seq model.

WHY (synthetic users, 2026-10): a forge model is trained on plain parallel
SENTENCES. Fed an app string it dropped ``{menu}``, ``{name}`` and the whole
ICU plural skeleton (the champollion quality gate then — correctly — refused
every such key), and fed a Markdown newsletter it had nothing it could use
at all. A model cannot be asked to "keep the placeholders"; the pipeline has
to keep them for it. So the model only ever sees plain text pieces
("units"), and everything structural is copied around them verbatim:

1. **Lines.** A string is processed line by line; blank lines, line breaks
   and fenced code blocks (``` / ~~~) are copied. A line's Markdown block
   prefix — indentation, ``>`` quotes, ``#`` headings, ``-``/``*``/``+``/
   ``1.`` list markers, ``[ ]`` task boxes, ``:::`` admonitions — is copied
   and only the text after it is translated; table rows are translated cell
   by cell. In ``markdown`` mode (document bodies), a paragraph hard-wrapped
   over several lines is joined into one line first, so a sentence is never
   translated in halves; in the default mode (app strings) every line break
   is kept exactly.
2. **Protected spans** are never shown to the model and come back
   byte-identical: ``{name}`` / ``{0}`` / ``{n, number}`` (ICU arguments),
   ``{{x}}`` (i18next, Vue, Handlebars, Hugo shortcodes), printf conversions
   (``%s``, ``%d``, ``%(name)s``, ``%1$s``, ``%%``), Rails ``%{x}`` /
   ``%<x>s``, i18next ``$t(key)``, vue-i18n ``@:key``, HTML/JSX tags and
   comments, HTML entities, inline code, URLs, the champollion CLI's own
   ``⟦PROTECTED_N⟧`` placeholders, Markdown emphasis markers and link/image
   syntax (the link TEXT is translated, the URL is not), backslash escapes.
3. **ICU plural / select / selectordinal**: the skeleton (variable name,
   keyword, ``offset:``, every selector, the braces, ``#``) is copied; the
   text of each branch is translated on its own and put back in its branch.
4. **Sentences.** The text between protected spans is split into sentences
   (after ``. ! ? …`` followed by a capital letter or digit; ``。！？``),
   because that is the unit the model was trained on.

The price, stated plainly: text on either side of a placeholder is
translated as separate pieces, so word order around a placeholder follows
the source — the structure is guaranteed, the fluency around it is not. A
string with nothing translatable (only placeholders, numbers, punctuation)
is returned unchanged. Identical pieces are translated once per request.
"""

from __future__ import annotations

import re
from dataclasses import dataclass, field
from typing import Callable

#: one line for /health and DEPLOY.md
DESCRIPTION = ("placeholders ({x}, {{x}}, %s, %(x)s), ICU plural/select "
               "skeletons, HTML/JSX tags, inline code, URLs, Markdown "
               "structure and the CLI's ⟦…⟧ placeholders are copied "
               "verbatim; the model translates only the text between them, "
               "sentence by sentence")

# -- protected spans -----------------------------------------------------------

# printf conversions — the SAME grammar the champollion quality gate checks
# (cli/lib/icu-structure.js printfConversions): positional %1$s, named
# %(name)s, flags/width/precision/length; "%%" is a literal percent. The
# space flag is deliberately not recognised, so "50% off" stays text.
_PRINTF = (r"%%|%(?:\d+\$)?(?:\([^)\s]+\))?[-+#0]*(?:\d+|\*)?"
           r"(?:\.(?:\d+|\*))?(?:hh|h|ll|l|L|q|j|z|t)?[sdifuxXoeEgGcpr@]")

_PROTECTED = re.compile("|".join([
    r"⟦[^⟦⟧\n]{1,80}⟧",                     # ⟦PROTECTED_N⟧ and kin
    r"\{\{.*?\}\}",                          # {{x}} / {{< shortcode >}}
    r"`+[^`\n]+?`+",                         # inline code
    r"<!--.*?-->",                           # HTML comment
    r"</?[A-Za-z][\w:.-]*(?:\s[^<>]*)?/?>",  # HTML/JSX tag
    r"</?>",                                 # JSX fragment
    r"<(?:https?|mailto|ftp):[^\s<>]+>",     # autolink
    r"(?:https?|ftp)://[^\s<>()\[\]]*[^\s<>()\[\].,;:!?'\"]",  # bare URL
    r"[\w.+-]+@[\w-]+(?:\.[\w-]+)+",         # e-mail address
    r"&(?:[A-Za-z][A-Za-z0-9]{1,31}|#\d{1,7}|#[xX][0-9A-Fa-f]{1,6});",
    r"\\[\\`*_{}\[\]()#+\-.!|~<>]",          # Markdown backslash escape
    r"%\{\w+\}|%<\w+>[sdif]?",                # Ruby/Rails %{count} %<n>s
    r"\$t\([^)\n]*\)",                        # i18next $t(key) nesting
    r"@(?:\.\w+)?:[\w.-]+",                      # vue-i18n @:key / @.lower:key
    _PRINTF,
]))

_EMPHASIS = re.compile(r"\*{1,3}|_{1,3}|~~")
_BRANCHING = ("plural", "select", "selectordinal")
_SELECTOR = re.compile(r"\s*(offset:\s*\d+\s*)?([^\s{}]+)\s*\{")

# -- line structure ------------------------------------------------------------

_FENCE = re.compile(r"^\s{0,3}(`{3,}|~{3,})")
_QUOTE = re.compile(r"^[ \t]*(?:>[ \t]?)+")
_BLOCK = re.compile(
    r"^[ \t]*(?:"
    r"#{1,6}(?=[ \t]|$)[ \t]*"                             # heading
    r"|[-*+](?=[ \t])[ \t]*(?:\[[ xX]\](?=[ \t])[ \t]*)?"  # bullet (+ task)
    r"|\d{1,9}[.)](?=[ \t])[ \t]*(?:\[[ xX]\](?=[ \t])[ \t]*)?"  # ordered
    r"|:{3,}[\w-]*[ \t]*"                                  # admonition
    r")")
_HEADING_CLOSE = re.compile(r"[ \t]+#+[ \t]*$")
_TRAILING_BREAK = re.compile(r"(?:\\|[ \t]+)$")
_TABLE_ROW = re.compile(r"^[ \t]*\|")

# -- sentences -----------------------------------------------------------------

_SENT_END = re.compile(r"[.!?…]+[\"”’»)\]]*\s+|[。！？]+\s*")
_OPENERS = "\"'“‘«([¿¡"


def _has_letters(text: str) -> bool:
    return any(ch.isalpha() for ch in text)


@dataclass
class Plan:
    """One string as literal pieces and model units: a piece is a ``str``
    (copied) or an ``int`` (the index of a unit in :attr:`units`)."""

    pieces: list = field(default_factory=list)
    units: list[str] = field(default_factory=list)

    def keep(self, text: str) -> None:
        if not text:
            return
        if self.pieces and isinstance(self.pieces[-1], str):
            self.pieces[-1] += text
        else:
            self.pieces.append(text)

    def unit(self, text: str) -> None:
        self.pieces.append(len(self.units))
        self.units.append(text)

    def render(self, outputs: list[str]) -> str:
        if len(outputs) != len(self.units):
            raise ValueError(f"{len(outputs)} outputs for {len(self.units)} "
                             "units")
        return "".join(p if isinstance(p, str) else outputs[p]
                       for p in self.pieces)


# -- inline tokenizer ----------------------------------------------------------

def _match_close(s: str, i: int, open_ch: str, close_ch: str) -> int:
    """Index of the bracket closing the one at ``s[i]`` (nesting-aware,
    single line), or -1."""
    depth = 0
    for j in range(i, len(s)):
        ch = s[j]
        if ch == "\n":
            return -1
        if ch == open_ch:
            depth += 1
        elif ch == close_ch:
            depth -= 1
            if depth == 0:
                return j
    return -1


def _icu(s: str, i: int, in_plural: bool) -> tuple[list, int] | None:
    """An ICU argument at ``s[i] == '{'``: ``(pieces, end)`` with each
    branch's text tokenized and everything else literal, or None when the
    brace never closes (it is then ordinary text)."""
    j = _match_close(s, i, "{", "}")
    if j < 0:
        return None
    whole = [("keep", s[i:j + 1])], j + 1
    name, comma, rest = s[i + 1:j].partition(",")
    if not comma:
        return whole                                  # {name} {0} {#id}
    kind_raw, comma2, body = rest.partition(",")
    kind = kind_raw.strip()
    if not comma2 or (kind not in _BRANCHING and not _SELECTOR.match(body)):
        return whole                                  # {n, number, ::x}
    # {name, kind, [offset:N] selector {message} selector {message} …}
    branch_plural = in_plural or kind != "select"
    pos = i + 1 + len(name) + 1 + len(kind_raw) + 1
    pieces: list = []
    literal_from = i
    while True:
        m = _SELECTOR.match(s, pos)
        if not m or m.end() > j:
            break
        open_at = m.end() - 1
        close_at = _match_close(s, open_at, "{", "}")
        if close_at < 0 or close_at >= j:
            return whole
        pieces.append(("keep", s[literal_from:open_at + 1]))
        pieces.extend(_inline(s[open_at + 1:close_at], branch_plural))
        literal_from = close_at
        pos = close_at + 1
    if not pieces or s[pos:j].strip():
        return whole           # not the branch grammar after all — keep it
    pieces.append(("keep", s[literal_from:j + 1]))
    return pieces, j + 1


def _link(s: str, i: int) -> tuple[list, int] | None:
    """``[text](url)`` / ``![alt](src)`` / ``[text][ref]`` at ``s[i]``: the
    text is tokenized, the brackets and the target are literal."""
    start = i + 1 if s.startswith("![", i) else i
    close = _match_close(s, start, "[", "]")
    if close < 0 or close + 1 >= len(s) or s[close + 1] not in "([":
        return None
    pair = ("(", ")") if s[close + 1] == "(" else ("[", "]")
    end = _match_close(s, close + 1, *pair)
    if end < 0:
        return None
    return ([("keep", s[i:start + 1]), *_inline(s[start + 1:close]),
             ("keep", s[close:end + 1])], end + 1)


def _flanking(s: str, i: int, j: int) -> bool:
    """CommonMark-ish: an emphasis delimiter run ``s[i:j]`` that can open
    (no letter/digit before, non-space after) or close (non-space before, no
    letter/digit after) — so snake_case and ``5 * 3`` stay text."""
    before = s[i - 1] if i > 0 else " "
    after = s[j] if j < len(s) else " "
    opens = not before.isalnum() and not after.isspace()
    closes = not before.isspace() and not after.isalnum()
    return opens or closes


def _inline(s: str, in_plural: bool = False) -> list:
    """Tokenize one line's content into ``("keep" | "text", str)`` pieces."""
    out: list = []
    text: list[str] = []
    i = 0

    def flush():
        if text:
            out.append(("text", "".join(text)))
            text.clear()

    while i < len(s):
        ch = s[i]
        got = None
        if in_plural and ch == "#":
            got = [("keep", "#")], i + 1
        if got is None:
            m = _PROTECTED.match(s, i)
            if m:
                got = [("keep", m.group(0))], m.end()
        if got is None and ch == "{":
            got = _icu(s, i, in_plural)
        if got is None and (ch == "[" or s.startswith("![", i)):
            got = _link(s, i)
        if got is None:
            m = _EMPHASIS.match(s, i)
            if m and _flanking(s, i, m.end()):
                got = [("keep", m.group(0))], m.end()
        if got is None:
            text.append(ch)
            i += 1
            continue
        flush()
        out.extend(got[0])
        i = got[1]
    flush()
    return out


def _translatable(content: str) -> bool:
    """Is there text for the model outside every protected span?"""
    return any(kind == "text" and _has_letters(value)
               for kind, value in _inline(content))


# -- sentences and lines -------------------------------------------------------

def split_sentences(run: str) -> list[str]:
    """Split a text run into sentences, each keeping its trailing
    whitespace, so ``"".join(split_sentences(x)) == x``."""
    parts = []
    start = 0
    for m in _SENT_END.finditer(run):
        end = m.end()
        if end >= len(run):
            break
        mark = m.group(0)[0]
        if mark not in "。！？":
            k = end
            while k < len(run) and run[k] in _OPENERS:
                k += 1
            if k >= len(run) or not (run[k].isupper() or run[k].isdigit()):
                continue
            if mark == ".":
                words = run[start:m.start()].split()
                prev = words[-1] if words else ""
                # an initial ("J. Smith") or a dotted abbreviation ("e.g.",
                # "U.S.") does not end a sentence
                if (len(prev) == 1 and prev.isalpha()) or "." in prev:
                    continue
        parts.append(run[start:end])
        start = end
    parts.append(run[start:])
    return [p for p in parts if p]


# punctuation a text piece STARTS with is the tail of what came before it
# (", you have" after "%s") — copied, not shown to the model
_LEAD_PUNCT = re.compile(r"[^\w\s\"'“‘«(\[¿¡]+\s*")


def _add_text(plan: Plan, text: str) -> None:
    for sentence in split_sentences(text):
        core = sentence.strip()
        if not _has_letters(core):
            plan.keep(sentence)
            continue
        plan.keep(sentence[:len(sentence) - len(sentence.lstrip())])
        lead = _LEAD_PUNCT.match(core)
        if lead:
            plan.keep(lead.group(0))
            core = core[lead.end():]
        plan.unit(core)
        plan.keep(sentence[len(sentence.rstrip()):])


def _add_inline(plan: Plan, content: str) -> None:
    for kind, value in _inline(content):
        if kind == "keep":
            plan.keep(value)
        else:
            _add_text(plan, value)


def _add_line_content(plan: Plan, content: str, *, heading: bool) -> None:
    """Content after the block prefix; a closing heading run (``## x ##``)
    and a trailing hard break (``\\`` or spaces) are copied."""
    m = (_HEADING_CLOSE.search(content) if heading else None) \
        or _TRAILING_BREAK.search(content)
    suffix = ""
    if m:
        content, suffix = content[:m.start()], content[m.start():]
    _add_inline(plan, content)
    plan.keep(suffix)


def _split_prefix(line: str) -> tuple[str, str]:
    q = _QUOTE.match(line)
    qlen = q.end() if q else 0
    b = _BLOCK.match(line, qlen)
    end = b.end() if b else qlen
    return line[:end], line[end:]


def _kind(prefix: str) -> str:
    """heading | admonition | item | quote | plain — from a line's prefix."""
    core = prefix.replace(">", "").strip()
    if core.startswith("#"):
        return "heading"
    if core.startswith(":"):
        return "admonition"
    if core:
        return "item"
    return "quote" if ">" in prefix else "plain"


def _table_row(plan: Plan, line: str) -> None:
    for i, cell in enumerate(re.split(r"(?<!\\)\|", line)):
        if i:
            plan.keep("|")
        _add_inline(plan, cell)


def plan_text(text: str, *, markdown: bool = False) -> Plan:
    """Plan one string (the rules are in the module docstring)."""
    plan = Plan()
    fence = ""              # the opening ``` / ~~~ run while inside a fence
    para: list[str] = []    # markdown: the open paragraph's content parts
    para_prefix = para_cr = ""
    para_heading = False
    code = False            # markdown: inside an indented code block
    in_list = False         # markdown: indented lines continue a list item
    prev_blank = True

    def close_para():
        if not para:
            return
        if len(para) == 1:
            content = para[0]
        else:
            content = " ".join([para[0].rstrip()]
                               + [p.strip() for p in para[1:-1]]
                               + [para[-1].lstrip()])
        plan.keep(para_prefix)
        _add_line_content(plan, content, heading=para_heading)
        plan.keep(para_cr)
        para.clear()

    for idx, raw in enumerate(text.split("\n")):
        cr = "\r" if raw.endswith("\r") else ""
        line = raw[:-1] if cr else raw
        blank = not line.strip()
        prefix, content = _split_prefix(line)
        kind = _kind(prefix)

        if para:
            continues = (
                not blank and not _FENCE.match(line)
                and not _TABLE_ROW.match(line)
                and (kind == "plain" or (kind == "quote" and para_prefix
                                         .replace(" ", "") == prefix
                                         .replace(" ", "")))
                and not re.search(r"(?:\\| {2,})$", para[-1])
                and _translatable(content))
            if continues:
                para.append(content)
                prev_blank = False
                continue
            close_para()
        if idx:
            plan.keep("\n")

        if fence:
            plan.keep(raw)
            stripped = line.strip()
            if stripped and set(stripped) == {fence[0]} and \
                    len(stripped) >= len(fence):
                fence = ""
            prev_blank = False
            continue
        f = _FENCE.match(line)
        if f:
            fence = f.group(1)
            plan.keep(raw)
            prev_blank = False
            continue
        if markdown:
            if blank:
                code = False
            elif code or (prev_blank and not in_list
                          and re.match(r"^(?: {4,}|\t)", line)):
                code = True                     # indented code block
                plan.keep(raw)
                prev_blank = False
                continue
            if kind == "item":
                in_list = True
            elif not blank and prev_blank and not line[:1].isspace():
                in_list = False
        prev_blank = blank

        if _TABLE_ROW.match(line):
            if _translatable(line):
                _table_row(plan, line)
                plan.keep(cr)
            else:
                plan.keep(raw)
            continue
        if blank or not _translatable(content):
            plan.keep(raw)
            continue
        if markdown and kind not in ("heading", "admonition"):
            para[:] = [content]
            para_prefix, para_cr, para_heading = prefix, cr, False
            continue
        plan.keep(prefix)
        _add_line_content(plan, content, heading=kind == "heading")
        plan.keep(cr)
    close_para()
    return plan


def _clean(output) -> str:
    """One model output as one line of text (a unit sits inside a line —
    a stray newline would break the Markdown structure around it)."""
    return re.sub(r"\s*\n\s*", " ", str(output).strip())


def translate_texts(texts: list[str],
                    translate: Callable[[list[str]], list[str]], *,
                    markdown: bool = False,
                    max_units: int | None = None) -> list[str]:
    """Translate whole strings through :func:`plan_text`: ONE model call for
    every distinct unit of every string; outputs index-aligned with
    ``texts``. Over ``max_units`` distinct units → ValueError, before any
    model work."""
    plans = [plan_text(t, markdown=markdown) for t in texts]
    distinct: dict[str, None] = {}
    for p in plans:
        for u in p.units:
            distinct.setdefault(u)
    if max_units is not None and len(distinct) > max_units:
        raise ValueError(f"{len(distinct)} pieces of text to translate — "
                         f"the limit is {max_units} per request")
    order = list(distinct)
    outs = list(translate(order)) if order else []
    if len(outs) != len(order):
        raise RuntimeError(f"the model returned {len(outs)} outputs for "
                           f"{len(order)} inputs")
    by_unit = {u: _clean(o) for u, o in zip(order, outs)}
    return [p.render([by_unit[u] for u in p.units]) for p in plans]
