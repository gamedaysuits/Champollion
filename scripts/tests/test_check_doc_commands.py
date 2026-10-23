#!/usr/bin/env python3
"""Tests for the doc-command gate's site mode (scripts/check_doc_commands.py).

The site's own pages showed a command the CLI does not have (`npx champollion
run`, on the old seam's badge) and no gate looked: the checker read only
cli/website/docs. It now reads what a JS page SHOWS as a command — and must
not read prose that merely mentions a tool, or the gate would cry wolf.

Run standalone:        python3 scripts/tests/test_check_doc_commands.py
Run under pytest:       python3 -m pytest scripts/tests/
"""
import importlib.util
import tempfile
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
spec = importlib.util.spec_from_file_location("check_doc_commands", ROOT / "scripts" / "check_doc_commands.py")
cdc = importlib.util.module_from_spec(spec)
spec.loader.exec_module(cdc)

PAGE = r"""
export default function Page() {
  const props = {group: 'MEASURE', what: 'mt-eval — the benchmark runner'};
  const prose = 'mt-eval harness that produced these results';
  /* the `mt-eval run` ring that used to play here was cut */
  const steps = [{name: 'Install', cmd: 'npx champollion init --yes'}];
  const prompt = `then run \`mt-eval publish --anonymous\` on the report`;
  const slot = `npx champollion sync --dir ${dir}`;
  return (<div>
    <CodeBlock language="bash">champollion next</CodeBlock>
    <span>npx champollion launch</span>
    <code>nmt-forge status</code>
    <p>champollion translates your app</p>
    <span>npx champollion fly</span> {/* doc-commands: ignore — a joke */}
  </div>);
}
"""


class SiteModeReadsWhatAPageShows(unittest.TestCase):
    def test_commands_are_read_and_prose_is_not(self):
        with tempfile.TemporaryDirectory() as d:
            f = Path(d) / "page.js"
            f.write_text(PAGE, encoding="utf-8")
            got = sorted(text for _, text in cdc.commands_in_js(f))
        self.assertEqual(got, sorted([
            "npx champollion init --yes",           # a cmd: value
            "mt-eval publish --anonymous",           # inline code inside a template
            "npx champollion sync --dir <value>",    # ${…} is a placeholder
            "champollion next",                      # <CodeBlock>
            "npx champollion launch",                # an npx line in JSX text
            "nmt-forge status",                      # <code>
        ]))

    def test_the_real_site_shows_only_commands_that_exist(self):
        champ = cdc.champollion_model()
        for f, reader in cdc.site_files():
            for line_no, text in reader(f):
                inv = cdc.split_invocation(text)
                if inv and inv[0].endswith("champollion"):
                    import shlex
                    tokens = shlex.split(cdc.PLACEHOLDER.sub(cdc.SENTINEL, inv[1]))
                    tokens = [t for t in tokens if cdc.SENTINEL not in t or t.startswith("-")]
                    self.assertEqual(cdc.check_champollion(tokens, champ), [], f"{f}:{line_no}: {text}")


if __name__ == "__main__":
    unittest.main()
