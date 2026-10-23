"""A community file forge can't read is refused with what/why/fix, never a
traceback.

Found 2026-10-09 (rails journey design): `nmt-forge registry add x.csv`
sent the CSV to json.loads; the JSONDecodeError was not one of _execute's
refusal types, so the user got a raw traceback (and, under --json, no JSON).
The refusal must also stay content-free: it names the file and line, never a
sentence from it.
"""

from __future__ import annotations

import json

import pytest

from nmt_forge.cli import main
from nmt_forge.errors import UnreadableRowsFile
from nmt_forge.registry import RegistryError, load_rows

SECRET = "grandpa-checked-sentence-zub"


def test_csv_is_refused_with_a_fix(tmp_path):
    p = tmp_path / "words.csv"
    p.write_text(f"english,cree\nhello,{SECRET}\n", encoding="utf-8")
    with pytest.raises(UnreadableRowsFile) as ei:
        load_rows(p)
    msg = str(ei.value)
    assert "does not read '.csv'" in msg
    assert "fix:" in msg and "words.tsv" in msg
    assert SECRET not in msg
    assert isinstance(ei.value, RegistryError)   # existing callers catch this


def test_utf16_text_is_refused_not_misread(tmp_path):
    p = tmp_path / "pairs.jsonl"
    p.write_bytes(json.dumps({"source": "a", "target": SECRET}).encode("utf-16"))
    with pytest.raises(UnreadableRowsFile, match="not UTF-8"):
        load_rows(p)


def test_bad_jsonl_line_names_the_line_not_the_text(tmp_path):
    p = tmp_path / "pairs.jsonl"
    p.write_text('{"source": "a", "target": "b"}\n' + SECRET + "\n",
                 encoding="utf-8")
    with pytest.raises(UnreadableRowsFile) as ei:
        load_rows(p)
    assert "line 2 is not JSON" in str(ei.value)
    assert SECRET not in str(ei.value)


def test_cli_registry_add_csv_exits_2_with_json_error(tmp_path, capsys):
    ws = tmp_path / "proj"
    assert main(["--workspace", str(ws), "init", "qaa", "--dir", str(ws),
                 "--no-card", "--name", "Our language"]) == 0
    capsys.readouterr()
    p = tmp_path / "checked.csv"
    p.write_text(f"english,ours\nhello,{SECRET}\n", encoding="utf-8")
    code = main(["--workspace", str(ws), "registry", "add",
                 "project-test", str(p), "--role", "test", "--json"])
    out = capsys.readouterr()
    assert code == 2
    payload = json.loads(out.out)
    assert payload["error"]["guard"] == "registry"
    assert "tab-separated" in payload["error"]["fix"]
    assert SECRET not in out.out + out.err
