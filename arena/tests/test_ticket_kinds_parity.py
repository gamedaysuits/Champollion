"""``tickets.kind`` parity — the SSOT that used to be held by a comment.

The ticket vocabulary lives in FOUR places, in four languages, and nothing
before this file checked that they agreed:

1. **The database** — ``tickets_kind_check`` in
   ``mt-eval-arena/supabase/migrations/074_contest_entries_phases_and_promises.sql``
   (065's five kinds, plus ``flag``). This one is the floor: it is what
   actually refuses a bad row.
2. **The edge function** — ``TICKET_KINDS`` in
   ``mt-eval-arena/supabase/functions/submit-ticket/lib.ts`` (Deno/TypeScript),
   the only writer of that table.
3. **The docent client** — the ticket-type picker in
   ``cli/website/src/components/Docent/index.js`` (React), the only browser
   door that files a ticket today.
4. **Python** — ``mt_eval_harness.contest_policy.TICKET_KINDS``, the constant
   the harness-side tests read.

Until now the first three were kept in step by a *comment* in ``lib.ts``
("Change them together with 065"). A comment is not a gate: a kind added to
the DB and the function but not the picker is invisible to visitors, and a kind
offered in the picker but missing from the CHECK is a 400 the visitor cannot
act on. This module replaces that comment — it reads all four sources as text
and fails on any drift.

It also pins the second half of the flagging contract (migration 074, practice
13): ``tickets.subject_run_card_id`` has ONE shape rule, and the SQL CHECK, the
TypeScript validator and the browser client must all spell it the same way.

Offline and dependency-free: regex over the four files, in the style of
``tests/test_contest_entries_migration.py``. The live behaviour is proved on
the local Supabase stack, not here.
"""

from __future__ import annotations

import re
from pathlib import Path

import pytest

from mt_eval_harness.contest_policy import TICKET_KINDS

REPO = Path(__file__).resolve().parents[2]
MIGRATION = (
    REPO / "mt-eval-arena" / "supabase" / "migrations"
    / "074_contest_entries_phases_and_promises.sql"
)
EDGE_LIB = (
    REPO / "mt-eval-arena" / "supabase" / "functions" / "submit-ticket" / "lib.ts"
)
DOCENT = REPO / "cli" / "website" / "src" / "components" / "Docent" / "index.js"
DOCENT_CLIENT = REPO / "cli" / "website" / "src" / "utils" / "docentClient.js"

# The shape of a run card id, as migration 074 writes it. Every other copy of
# this rule is compared against this literal.
RUN_CARD_ID_RULE = "^[0-9a-f-]{36}$"


def _read(path: Path) -> str:
    assert path.exists(), f"missing SSOT file: {path}"
    return path.read_text()


def _sql_body() -> str:
    """The migration's executable SQL — comment lines dropped, because the
    ROLLBACK recipe in the header quotes the *pre-074* CHECK verbatim."""
    return "\n".join(
        line
        for line in _read(MIGRATION).splitlines()
        if not line.lstrip().startswith("--")
    )


# ---------------------------------------------------------------------------
# The four readers
# ---------------------------------------------------------------------------


def db_kinds() -> tuple[str, ...]:
    """The vocabulary the database will actually accept."""
    m = re.search(r"CHECK \(kind IN \(([^)]*)\)\)", _sql_body())
    assert m, "tickets_kind_check not found in migration 074"
    return tuple(s.strip().strip("'") for s in m.group(1).split(",") if s.strip())


def edge_function_kinds() -> tuple[str, ...]:
    """``TICKET_KINDS`` as declared in the Deno edge function."""
    src = _read(EDGE_LIB)
    m = re.search(
        r"export const TICKET_KINDS: ReadonlySet<string> = new Set\(\[(.*?)\]\)",
        src,
        re.S,
    )
    assert m, "TICKET_KINDS not found in submit-ticket/lib.ts"
    return tuple(re.findall(r'"([^"]+)"', m.group(1)))


def _js_string_consts(src: str) -> dict[str, str]:
    """``export const NAME = 'value';`` pairs from a browser module."""
    return {
        name: value
        for name, value in re.findall(
            r"export const ([A-Z][A-Z0-9_]*) = ['\"]([^'\"]*)['\"]", src
        )
    }


def docent_kinds() -> tuple[str, ...]:
    """The ticket-type list the browser client offers, in picker order.

    An entry's ``value`` is either a literal or an imported constant (``flag``
    is ``FLAG_KIND``, shared with the payload builder) — identifiers are
    resolved against ``docentClient.js`` so the indirection cannot hide a
    mismatch.
    """
    src = _read(DOCENT)
    m = re.search(r"const TICKET_KINDS = \[(.*?)\n\];", src, re.S)
    assert m, "TICKET_KINDS not found in Docent/index.js"
    consts = _js_string_consts(_read(DOCENT_CLIENT))
    values: list[str] = []
    for raw in re.findall(r"\{\s*value:\s*([^,]+),", m.group(1)):
        token = raw.strip()
        if token[:1] in "'\"":
            values.append(token.strip("'\""))
        else:
            assert token in consts, (
                f"Docent kind value {token!r} is not an exported string constant "
                f"of docentClient.js — the parity test cannot resolve it"
            )
            values.append(consts[token])
    return tuple(values)


def docent_subject_required() -> tuple[str, ...]:
    """The kinds the picker will not offer without a subject in context."""
    src = _read(DOCENT)
    m = re.search(r"const TICKET_KINDS = \[(.*?)\n\];", src, re.S)
    assert m
    consts = _js_string_consts(_read(DOCENT_CLIENT))
    out: list[str] = []
    for entry in re.findall(r"\{(.*?)\}", m.group(1), re.S):
        if "subjectRequired: true" not in entry:
            continue
        token = re.search(r"value:\s*([^,]+),", entry).group(1).strip()
        out.append(consts.get(token, token.strip("'\"")))
    return tuple(out)


# ---------------------------------------------------------------------------
# Parity
# ---------------------------------------------------------------------------


class TestKindVocabularyParity:
    def test_every_source_is_readable(self):
        for reader in (db_kinds, edge_function_kinds, docent_kinds):
            assert reader(), f"{reader.__name__} returned nothing"

    def test_database_and_edge_function_agree_in_order(self):
        # The function is the only writer of the table: an order mismatch is a
        # cheap early warning that one of the two lists was edited alone.
        assert edge_function_kinds() == db_kinds()

    def test_database_and_python_ssot_agree(self):
        assert db_kinds() == TICKET_KINDS

    def test_docent_offers_exactly_the_accepted_kinds(self):
        # Sets, not order: the picker is display-ordered (question first, the
        # kind a visitor most often wants), the CHECK is not.
        assert set(docent_kinds()) == set(db_kinds())
        assert len(set(docent_kinds())) == len(docent_kinds()), "duplicate picker entry"

    def test_flag_is_present_everywhere(self):
        for name, kinds in (
            ("database", db_kinds()),
            ("edge function", edge_function_kinds()),
            ("docent", docent_kinds()),
            ("python", TICKET_KINDS),
        ):
            assert "flag" in kinds, f"'flag' missing from the {name} vocabulary"


class TestFlagSubjectContract:
    """``kind='flag'`` names a run card. All three halves say so identically."""

    def test_migration_carries_the_shape_rule_and_no_foreign_key(self):
        body = _sql_body()
        assert "subject_run_card_id" in body
        assert RUN_CARD_ID_RULE in body, "the 074 CHECK is the shape floor"
        # No FK by design: a flag must survive the row it names, including a
        # card removed by the very takedown the flag asked for.
        m = re.search(
            r"ADD COLUMN IF NOT EXISTS subject_run_card_id(.*?);", body, re.S
        )
        assert m, "subject_run_card_id column not found"
        assert "REFERENCES" not in m.group(1).upper()

    def test_edge_function_spells_the_same_rule(self):
        src = _read(EDGE_LIB)
        m = re.search(r"export const RUN_CARD_ID_PATTERN = /(.*?)/;", src)
        assert m, "RUN_CARD_ID_PATTERN not found in submit-ticket/lib.ts"
        assert m.group(1) == RUN_CARD_ID_RULE

    def test_browser_client_spells_the_same_rule(self):
        src = _read(DOCENT_CLIENT)
        m = re.search(r"export const RUN_CARD_ID_PATTERN = /(.*?)/;", src)
        assert m, "RUN_CARD_ID_PATTERN not found in docentClient.js"
        assert m.group(1) == RUN_CARD_ID_RULE

    def test_edge_function_requires_the_subject_on_a_flag_only(self):
        src = _read(EDGE_LIB)
        assert "subject_run_card_id is required for a flag" in src
        # Refused, not silently dropped, on any other kind.
        assert "is only accepted on a" in src

    def test_flag_is_the_only_subject_requiring_kind_in_the_picker(self):
        assert docent_subject_required() == ("flag",)

    def test_no_public_flag_count_is_rendered(self):
        # The plan forbids a public count outright: it is a gaming surface.
        # An upheld flag shows up only as run_cards.trust = 'disqualified'.
        forbidden = re.compile(
            r"flag[_a-zA-Z]*[Cc]ount|[Cc]ount[_a-zA-Z]*[Ff]lag", re.I
        )
        for path in (DOCENT, DOCENT_CLIENT, EDGE_LIB):
            assert not forbidden.search(_read(path)), (
                f"{path.name} looks like it counts flags"
            )


class TestDriftIsActuallyCaught:
    """The test above is only worth having if it fails on real drift."""

    @pytest.mark.parametrize(
        "reader", [db_kinds, edge_function_kinds, docent_kinds]
    )
    def test_reader_returns_a_tuple_of_plain_kind_strings(self, reader):
        for kind in reader():
            assert kind and kind.islower() and kind.replace("-", "").isalpha(), (
                f"{reader.__name__} parsed a non-kind token: {kind!r}"
            )

    def test_a_kind_added_to_only_one_source_would_fail(self):
        # Proves the comparison is over CONTENT, not merely over lengths.
        assert set(docent_kinds()) == set(db_kinds())
        assert set(db_kinds()) | {"invented"} != set(docent_kinds())
