"""The structure-protection layer `nmt-forge serve` puts between the
champollion CLI and a sentence-level model (synthetic users, 2026-10: the
trained model dropped {menu}/{name}/ICU plurals, so the CLI's gate refused
those keys, and a Markdown newsletter body could not be translated at all).

The stand-in model wraps every input in ⟨…⟩ and records what it was shown,
so each test asserts two things: what the MODEL saw (only plain text) and
what came BACK (the structure, byte-identical)."""

import pytest

from nmt_forge.textpipe import plan_text, split_sentences, translate_texts


class Model:
    def __init__(self):
        self.seen = []

    def __call__(self, texts):
        self.seen.extend(texts)
        return [f"⟨{t}⟩" for t in texts]


def run(text, *, markdown=False):
    m = Model()
    out = translate_texts([text], m, markdown=markdown)[0]
    return out, m.seen


# -- placeholders (item 2) -------------------------------------------------------

@pytest.mark.parametrize("src, expected, shown", [
    ("Lunch today: {menu}", "⟨Lunch today:⟩ {menu}", ["Lunch today:"]),
    ("Thank you, {name}!", "⟨Thank you,⟩ {name}!", ["Thank you,"]),
    ("Hi {{name}}, welcome", "⟨Hi⟩ {{name}}, ⟨welcome⟩", ["Hi", "welcome"]),
    ("Hello %s, you have %(n)d new %1$s", "⟨Hello⟩ %s, ⟨you have⟩ %(n)d "
     "⟨new⟩ %1$s", ["Hello", "you have", "new"]),
    ("Save 100%% now", "⟨Save 100⟩%% ⟨now⟩", ["Save 100", "now"]),
    ("Read <b>this</b> &amp; <Trans>that</Trans>",
     "⟨Read⟩ <b>⟨this⟩</b> &amp; <Trans>⟨that⟩</Trans>",
     ["Read", "this", "that"]),
    ("Run `npm test` then see https://x.org/a_b.",
     "⟨Run⟩ `npm test` ⟨then see⟩ https://x.org/a_b.", ["Run", "then see"]),
    ("Mail info@school.example today", "⟨Mail⟩ info@school.example ⟨today⟩",
     ["Mail", "today"]),
    ("Total: %{count} items, %<name>s", "⟨Total:⟩ %{count} ⟨items,⟩ "
     "%<name>s", ["Total:", "items,"]),
    ("See $t(common.more) or @:nav.home", "⟨See⟩ $t(common.more) ⟨or⟩ "
     "@:nav.home", ["See", "or"]),
    ("Pay {amount, number, ::currency/CAD} now",
     "⟨Pay⟩ {amount, number, ::currency/CAD} ⟨now⟩", ["Pay", "now"]),
])
def test_placeholders_never_reach_the_model_and_come_back_intact(
        src, expected, shown):
    out, seen = run(src)
    assert out == expected
    assert seen == shown


def test_icu_plural_skeleton_is_kept_and_each_branch_translated():
    src = "{count, plural, one {# event this week} other {# events this week}}"
    out, seen = run(src)
    assert out == ("{count, plural, one {# ⟨event this week⟩} "
                   "other {# ⟨events this week⟩}}")
    assert seen == ["event this week", "events this week"]


def test_icu_offset_exact_selectors_select_and_nesting():
    out, _ = run("{n, plural, offset:1 =0 {Nobody} one {You and {name}} "
                 "other {You and # others}}")
    assert out == ("{n, plural, offset:1 =0 {⟨Nobody⟩} one {⟨You and⟩ "
                   "{name}} other {⟨You and⟩ # ⟨others⟩}}")
    out, _ = run("{g, select, male {He} female {She} other {They}} came.")
    assert out == ("{g, select, male {⟨He⟩} female {⟨She⟩} other "
                   "{⟨They⟩}} ⟨came.⟩")
    # `#` is the plural's number even inside a nested select
    out, _ = run("{n, plural, other {{g, select, other {# items}}}}")
    assert out == "{n, plural, other {{g, select, other {# ⟨items⟩}}}}"


def test_the_cli_gate_accepts_the_structure():
    """The champollion quality gate's ICU/printf check (cli/lib/
    icu-structure.js) compares argument names, keywords, selectors, # and
    printf conversions; the pipeline output must keep all of them."""
    import re

    for src in ["{count, plural, one {# day left} other {# days left}}",
                "Welcome back, {name}. You have {n} messages.",
                "%(user)s liked %d of your %s"]:
        out, _ = run(src)
        args = re.findall(r"\{(\w+)", src)
        assert re.findall(r"\{(\w+)", out) == args
        assert re.findall(r"%\(?\w*\)?[sd]", out) == re.findall(
            r"%\(?\w*\)?[sd]", src)


def test_nothing_to_translate_is_returned_unchanged():
    for src in ["{count}", "{{x}} · {y}", "42", "%s / %d", "⟦PROTECTED_3⟧",
                "---", ""]:
        out, seen = run(src)
        assert out == src and seen == []


def test_literal_braces_and_snake_case_and_arithmetic_are_text():
    out, seen = run("Price: 5 * 3 for user_id **now**")
    assert out == "⟨Price: 5 * 3 for user_id⟩ **⟨now⟩**"
    out, _ = run("Press {Enter to continue")          # unclosed brace
    assert out == "⟨Press {Enter to continue⟩"


# -- Markdown structure (item 1) ---------------------------------------------------

def test_markdown_lines_keep_their_prefixes():
    out, _ = run("# October at our school\n## Feast ##\n- item one\n"
                 "- [x] item two\n1. first\n> quoted *text*\n:::tip Remember\n"
                 "Body\n:::", markdown=True)
    assert out == ("# ⟨October at our school⟩\n## ⟨Feast⟩ ##\n- ⟨item one⟩\n"
                   "- [x] ⟨item two⟩\n1. ⟨first⟩\n> ⟨quoted⟩ *⟨text⟩*\n"
                   ":::tip ⟨Remember⟩\n⟨Body⟩\n:::")


def test_links_images_and_emphasis():
    out, seen = run("Read the [terms of use](https://x.org/t) and "
                    "![a cat](cat.png) **today**.")
    assert out == ("⟨Read the⟩ [⟨terms of use⟩](https://x.org/t) ⟨and⟩ "
                   "![⟨a cat⟩](cat.png) **⟨today⟩**.")
    assert "https://x.org/t" not in " ".join(seen)


def test_tables_translate_cell_by_cell():
    out, _ = run("| Name | Day |\n|---|:---:|\n| Feast | Friday |",
                 markdown=True)
    assert out == ("| ⟨Name⟩ | ⟨Day⟩ |\n|---|:---:|\n| ⟨Feast⟩ | ⟨Friday⟩ |")


def test_code_is_never_translated():
    src = ("Before.\n\n```sh\necho \"Hello there\"\n```\n\n~~~\nPlain words\n"
           "~~~\n\n    indented code line\n    more code\n\nAfter.")
    out, seen = run(src, markdown=True)
    assert out == src.replace("Before.", "⟨Before.⟩").replace(
        "After.", "⟨After.⟩")
    assert seen == ["Before.", "After."]


def test_a_list_items_indented_continuation_is_text_not_code():
    out, _ = run("- An item\n\n    its second paragraph", markdown=True)
    assert out == "- ⟨An item⟩\n\n    ⟨its second paragraph⟩"


def test_markdown_paragraphs_are_joined_app_string_lines_are_not():
    src = "The bus driver brings\nthe photos at the feast.\n\nNext one."
    out, seen = run(src, markdown=True)
    assert out == "⟨The bus driver brings the photos at the feast.⟩\n\n⟨Next one.⟩"
    assert seen[0] == "The bus driver brings the photos at the feast."
    # an app string's line break is meaningful — kept, line by line
    out, _ = run("Line one\nLine two")
    assert out == "⟨Line one⟩\n⟨Line two⟩"
    # a hard break ends the joined run and is kept
    out, _ = run("Text  \nafter break", markdown=True)
    assert out == "⟨Text⟩  \n⟨after break⟩"
    # quotes and list items join their own continuations
    out, _ = run("> quote one\n> quote two\n- item that\n  continues",
                 markdown=True)
    assert out == "> ⟨quote one quote two⟩\n- ⟨item that continues⟩"


def test_cli_placeholders_and_blank_lines_survive():
    src = "⟦PROTECTED_0⟧\n\nThe students read ⟦PROTECTED_1⟧ at the library.\n"
    out, _ = run(src, markdown=True)
    assert out == ("⟦PROTECTED_0⟧\n\n⟨The students read⟩ ⟦PROTECTED_1⟧ "
                   "⟨at the library.⟩\n")


def test_crlf_and_surrounding_whitespace_are_kept():
    out, _ = run("  Hello there.  \r\nSecond line\r\n")
    assert out == "  ⟨Hello there.⟩  \r\n⟨Second line⟩\r\n"


# -- sentences ---------------------------------------------------------------------

def test_sentences_split_conservatively_and_losslessly():
    text = ("The elders visit the class tomorrow. Please bring the forms! "
            "J. Smith and e.g. this stay. Done? yes. 終わり。次")
    parts = split_sentences(text)
    assert "".join(parts) == text
    assert parts == ["The elders visit the class tomorrow. ",
                     "Please bring the forms! ",
                     "J. Smith and e.g. this stay. ",
                     "Done? yes. 終わり。", "次"]


# -- the batch contract --------------------------------------------------------------

def test_one_model_call_dedups_and_keeps_alignment():
    calls = []

    def model(texts):
        calls.append(list(texts))
        return [t.upper() for t in texts]

    texts = ["Hello {name}.", "Hello", "", "{n}", "Hello. Hello"]
    outs = translate_texts(texts, model)
    assert len(calls) == 1 and calls[0] == ["Hello", "Hello."]
    assert outs == ["HELLO {name}.", "HELLO", "", "{n}", "HELLO. HELLO"]


def test_model_output_newlines_cannot_break_structure():
    outs = translate_texts(["| A | B |"], lambda xs: ["x\ny" for _ in xs],
                           markdown=True)
    assert outs == ["| x y | x y |"]


def test_unit_cap_refuses_before_any_model_work():
    called = []
    with pytest.raises(ValueError, match="limit is 2"):
        translate_texts(["One. Two. Three."], lambda xs: called.append(1),
                        max_units=2)
    assert called == []


def test_a_model_returning_the_wrong_count_is_an_error_not_a_misalignment():
    with pytest.raises(RuntimeError, match="2 inputs"):
        translate_texts(["A {x} B"], lambda xs: ["only one"])


def test_plan_is_lossless_for_identity():
    for src in ["# T\n\n- a {x}\n\n| c | d |", "{n, plural, one {# a} other "
                "{# b}}", "x <b>y</b> z", "  a\n\n\nb  "]:
        for md in (False, True):
            p = plan_text(src, markdown=md)
            if not md or "\n" not in src.strip():
                assert p.render(p.units) == src
