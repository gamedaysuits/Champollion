"""The proprietary corpus builder must never ship in the mt-eval distribution.

WHY THIS EXISTS
    `arena/scripts/corpora-builder/` declared `license = "Apache-2.0"` in its own
    pyproject while `arena/pyproject.toml` packed `corpora_builder*` into the
    AGPL-3.0-or-later `mt-eval` wheel — whose distribution carried only arena's
    AGPL text. One body of code made two incompatible licence statements and
    reached end users under neither of them deliberately.

    Founder ruling 2026-08-01: it is proprietary internal tooling and ships with
    nothing. This test is what keeps that true, because the packaging config is
    exactly the kind of line that gets "helpfully" restored by someone fixing a
    downstream ImportError.

RUN:  cd arena && python3 -m pytest tests/test_corpora_builder_not_packaged.py
"""
import re
from pathlib import Path

import pytest

ARENA = Path(__file__).resolve().parents[1]
BUILDER = ARENA / "scripts" / "corpora-builder"

#: In the PUBLIC cut the builder directory is deleted entirely — the
#: stronger form of the guarantee these tests pin. Skip rather than fail
#: there; the monorepo runs them in full.
_builder_absent = pytest.mark.skipif(
    not BUILDER.is_dir(),
    reason="corpora-builder absent (public cut) — its absence IS the guarantee",
)


def _read(p: Path) -> str:
    return p.read_text(encoding="utf-8")


class TestNotPackaged:
    def test_setuptools_does_not_include_corpora_builder(self):
        text = _read(ARENA / "pyproject.toml")
        find = re.search(
            r"\[tool\.setuptools\.packages\.find\](.*?)(?=\n\[|\Z)", text, re.S
        )
        assert find, "packages.find block not found in arena/pyproject.toml"
        block = find.group(1)

        assert "corpora_builder" not in block, (
            "corpora_builder is back in the mt-eval wheel. It is proprietary "
            "(arena/scripts/corpora-builder/LICENSE) and must not ship in an "
            "AGPL distribution.\n"
            "If you are here because a pip-installed harness raised an import "
            "error, the fix is NOT to repackage it — corpus building is "
            "monorepo-only and corpus_fetch.py already reports that clearly."
        )
        assert "scripts/corpora-builder" not in block, (
            "scripts/corpora-builder is back on the packages.find search path"
        )

    @_builder_absent
    def test_builder_declares_proprietary_not_open_source(self):
        text = _read(BUILDER / "pyproject.toml")
        m = re.search(r'^\s*license\s*=\s*["\']([^"\']+)["\']', text, re.M)
        assert m, "corpora-builder pyproject declares no license field"
        declared = m.group(1)
        assert declared == "LicenseRef-Champollion-Proprietary", (
            f"corpora-builder declares {declared!r}. It is proprietary internal "
            "tooling and must not carry an open-source licence."
        )

    @_builder_absent
    def test_builder_license_file_grants_nothing(self):
        path = BUILDER / "LICENSE"
        assert path.exists(), "corpora-builder has no LICENSE asserting reserved rights"
        text = _read(path)
        assert re.search(r"all rights reserved", text, re.I)
        assert re.search(r"no licen[cs]e is granted", text, re.I)
        # It must not accidentally become an open-source grant.
        for forbidden in ("Apache License", "MIT License", "GNU GENERAL PUBLIC",
                          "GNU AFFERO", "Creative Commons"):
            assert forbidden.lower() not in text.lower(), (
                f"corpora-builder LICENSE contains {forbidden!r} — it must grant nothing"
            )


class TestFetchPathNeedsNoPrivateBuilder:
    """The 2026-08-27 guarantee, replacing the old degrade-honestly one:
    corpus REBUILDS ship with the harness (mt_eval_harness.corpus_build),
    so a pip install or a public-repo clone can rebuild every
    fetch-from-source corpus. The private builder is not a dependency of
    the fetch path at all — the old behavior was a documented refusal."""

    def test_corpus_fetch_never_imports_the_private_builder(self):
        from mt_eval_harness import corpus_fetch
        source = Path(corpus_fetch.__file__).read_text(encoding="utf-8")
        assert "from corpora_builder" not in source, (
            "corpus_fetch regained a private-builder import — the public "
            "contributor lane breaks again (PRE_REVIEW_HARDENING_2026-08-27)"
        )

    def test_corpus_build_imports_without_the_private_builder(self):
        # Works in the monorepo AND the public cut alike.
        from mt_eval_harness.corpus_build.adapters import (  # noqa: F401
            lineparallel_adapter,
            tatoeba_challenge_adapter,
        )
        from mt_eval_harness.corpus_build.sampling import (  # noqa: F401
            _stratified_sample,
        )
