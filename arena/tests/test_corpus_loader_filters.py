"""
Tests for _apply_filters — the --dataset / --ids entry selector.

Regression guard: the ID-range filter (e.g. --dataset 0-1) compared an int
bound against the entry id directly. Corpora store ids as ints (EdTeKLA) OR
strings (Tatoeba: 'tatoeba_2289'), so `start <= e["id"] <= end` raised
`TypeError: '<=' not supported between 'int' and 'str'` on any string-id corpus
— a hard crash in a documented, supported flag. The filter now coerces per
entry and skips non-numeric ids instead of crashing.
"""

from mt_eval_harness.corpus_loader import _apply_filters
from mt_eval_harness.config import RunConfig


def _cfg(**kw) -> RunConfig:
    kw.setdefault("corpus_path", None)
    return RunConfig(**kw)


class TestRangeFilter:
    def test_string_ids_do_not_crash(self):
        # The exact crash case: Tatoeba-style string ids + an int range.
        entries = [{"id": "tatoeba_10"}, {"id": "tatoeba_11"}]
        # No TypeError; string ids aren't numeric, so the range matches none.
        assert _apply_filters(entries, _cfg(dataset="0-1")) == []

    def test_int_ids_range_selects(self):
        entries = [{"id": 0}, {"id": 1}, {"id": 2}, {"id": 3}]
        out = _apply_filters(entries, _cfg(dataset="0-1"))
        assert [e["id"] for e in out] == [0, 1]

    def test_numeric_string_ids_range_selects(self):
        # Numeric ids stored as strings still match a numeric range.
        entries = [{"id": "0"}, {"id": "1"}, {"id": "2"}]
        out = _apply_filters(entries, _cfg(dataset="0-1"))
        assert [e["id"] for e in out] == ["0", "1"]

    def test_mixed_ids_skip_non_numeric(self):
        entries = [{"id": 0}, {"id": "tatoeba_99"}, {"id": 1}]
        out = _apply_filters(entries, _cfg(dataset="0-5"))
        assert [e["id"] for e in out] == [0, 1]

    def test_non_numeric_range_falls_through_to_error(self):
        # A dash that isn't a numeric range is still an unknown filter — the
        # try/except must not swallow it into a silent empty result.
        entries = [{"id": 0}]
        try:
            _apply_filters(entries, _cfg(dataset="a-b"))
        except ValueError as e:
            assert "Unknown dataset filter" in str(e)
        else:
            raise AssertionError("expected ValueError for 'a-b'")


class TestSingleIdFilter:
    def test_single_int_id(self):
        entries = [{"id": 0}, {"id": 1}, {"id": 2}]
        out = _apply_filters(entries, _cfg(dataset="2"))
        assert [e["id"] for e in out] == [2]

    def test_single_id_matches_numeric_string(self):
        # A single numeric filter matches a string-stored numeric id.
        entries = [{"id": "0"}, {"id": "1"}, {"id": "2"}]
        out = _apply_filters(entries, _cfg(dataset="1"))
        assert [e["id"] for e in out] == ["1"]

    def test_single_id_skips_non_numeric_without_crash(self):
        entries = [{"id": "tatoeba_1"}, {"id": 1}]
        out = _apply_filters(entries, _cfg(dataset="1"))
        assert [e["id"] for e in out] == [1]
