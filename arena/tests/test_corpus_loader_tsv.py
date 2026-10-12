"""TSV corpora are split on TAB, with comments, and never score a blank reference.

Found 2026-10-03 from a clean install: a teacher's test file with two '# '
comment lines was scored as 41 entries — the comments became sentences with
empty references, a silent miss in every metric — and csv's default quoting
let a sentence opening with a double quote swallow the rows after it.
"""

from __future__ import annotations

import pytest

from mt_eval_harness.corpus_loader import _load_tsv


def _write(tmp_path, text, name="t.tsv", encoding="utf-8"):
    p = tmp_path / name
    p.write_text(text, encoding=encoding)
    return p


def test_comment_lines_are_not_entries(tmp_path):
    p = _write(tmp_path, "# SYNTHETIC TEST DATA\n#\n# columns: en<TAB>xx\n"
                         "one\tuno\ntwo\tdos\n")
    rows = _load_tsv(p)
    assert [r["source"] for r in rows] == ["one", "two"]


def test_a_hashtag_is_text(tmp_path):
    rows = _load_tsv(_write(tmp_path, "#topic today\t#tema hoy\n"))
    assert rows == [{"source": "#topic today", "reference": "#tema hoy"}]


def test_quotes_are_text_not_csv_quoting(tmp_path):
    p = _write(tmp_path, '"Hello," she said.\t"Hola", dijo.\n'
                         'Second line\tSegunda\n')
    rows = _load_tsv(p)
    assert len(rows) == 2
    assert rows[0] == {"source": '"Hello," she said.', "reference": '"Hola", dijo.'}


def test_bom_and_crlf_and_header(tmp_path):
    p = _write(tmp_path, "source\treference\r\nhi\thola\r\n", encoding="utf-8-sig")
    assert _load_tsv(p) == [{"source": "hi", "reference": "hola"}]


def test_some_rows_without_reference_are_refused_with_line_numbers(tmp_path):
    p = _write(tmp_path, "one\tuno\ntwo\n# note\nthree\t \nfour\tcuatro\n")
    with pytest.raises(ValueError, match=r"2 of 4 rows have no reference.*line\(s\) 2, 4"):
        _load_tsv(p)


def test_a_reference_free_file_still_loads(tmp_path):
    rows = _load_tsv(_write(tmp_path, "one\ntwo\n"))
    assert [r["source"] for r in rows] == ["one", "two"]
