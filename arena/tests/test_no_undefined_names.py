"""No module in the harness references a name that is never defined.

2026-10-03: the 0.2.0 release candidate shipped three NameErrors that only
fire at run time on paths the suite never exercised — corpus_build/sampling.py
(_DOMAIN_TO_REGISTER, CorpusEntry, Any: every fetch-from-source corpus build
crashed) and cli.py (logger, inside an error handler). A static check finds
the whole class at once.
"""

from pathlib import Path

import pytest

pyflakes_api = pytest.importorskip("pyflakes.api")
from pyflakes import reporter as pyflakes_reporter  # noqa: E402


def test_no_undefined_names():
    import io
    import mt_eval_harness

    root = Path(mt_eval_harness.__file__).parent
    out = io.StringIO()
    rep = pyflakes_reporter.Reporter(out, io.StringIO())
    for path in sorted(root.rglob("*.py")):
        pyflakes_api.checkPath(str(path), rep)
    undefined = [line for line in out.getvalue().splitlines() if "undefined name" in line]
    assert undefined == [], "\n".join(undefined)
