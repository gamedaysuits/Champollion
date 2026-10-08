"""The teacher's TSV test file works in forge exactly as in mt-eval run."""

from __future__ import annotations

import pytest

from nmt_forge.registry import RegistryError, load_rows


def test_tsv_rows_become_source_target(tmp_path):
    p = tmp_path / "test.tsv"
    p.write_text("# teacher-checked\nThe library opens at nine.\tzub kef\n"
                 '"Quoted," she said.\tmol tav\n', encoding="utf-8")
    assert load_rows(p) == [
        {"source": "The library opens at nine.", "target": "zub kef"},
        {"source": '"Quoted," she said.', "target": "mol tav"},
    ]


def test_tsv_row_without_target_is_refused(tmp_path):
    p = tmp_path / "test.tsv"
    p.write_text("one\tuno\ntwo\n", encoding="utf-8")
    with pytest.raises(RegistryError, match="line\\(s\\) 2"):
        load_rows(p)
