"""Small CLI defects from the docs review (2026-10-12): each said, never silent."""

import pytest

from nmt_forge import cli


def test_a_malformed_serving_port_is_said_and_ignored(monkeypatch, capsys):
    """#14: NMT_FORGE_SERVE_PORT=abc used to crash every nmt-forge command."""
    monkeypatch.setenv("NMT_FORGE_SERVE_PORT", "abc")
    assert cli._env_port() == 8378
    assert "is not a port" in capsys.readouterr().err
    monkeypatch.setenv("NMT_FORGE_SERVE_PORT", "8391")
    assert cli._env_port() == 8391


def test_strict_and_clean_to_together_are_refused(tmp_path, capsys):
    """#19: --strict was ignored when --clean-to was given."""
    corpus = tmp_path / "c.jsonl"
    corpus.write_text('{"source": "a", "target": "b"}\n')
    code = cli.main(["--workspace", str(tmp_path / ".forge"), "leak-audit", str(corpus), "--strict",
                     "--clean-to", str(tmp_path / "clean.jsonl")])
    assert code != 0
    assert "ask for opposite things" in capsys.readouterr().err


def test_use_model_needs_the_peoples_answer():
    """#16: --answer defaulted to yes."""
    with pytest.raises(cli.UsageError, match="--answer"):
        cli.build_parser().parse_args(["use-model", "byt5-small"])
