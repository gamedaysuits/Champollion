#!/usr/bin/env python3
"""Tests for the audit runner (scripts/audit_runner.py).

These pin the three properties the runner exists to guarantee. Each one
corresponds to a real failure mode that was live in this repo on 2026-08-01:

  1. NO STDOUT-TEXT VERDICTS. scripts/steward_report.py decided pass/fail by
     grepping child stdout for "0 errors", "MISMATCH: 0", and
     "COUNTERFEIT                   0" — the last a column-width match that
     would flip green the day a total crossed a digit boundary. Reformatting a
     report could silently turn a red gate green.

  2. ABSENCE IS NEVER A PASS. A checker that cannot run, produces no parseable
     payload, or whose parser throws must be UNVERIFIABLE — not silence.
     verify-card-sources.py had NO sys.exit at all, so it always exited 0 while
     reporting 2 real mismatches, and every gate stayed green.

  3. A RATCHET CANNOT BE RESET BY REWORDING. baselineKey is derived from
     (ruleId, code) only. If it embedded the human message, editing a
     diagnostic's wording would silently un-waive or re-waive findings.

Run standalone:   python3 scripts/tests/test_audit_runner.py
Run under pytest: python3 -m pytest scripts/tests/
"""
import importlib.util
import json
import os
import tempfile
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]          # scripts/tests/ -> repo root
RUNNER = ROOT / "scripts" / "audit_runner.py"
STEWARD = ROOT / "scripts" / "steward_report.py"


def _load():
    spec = importlib.util.spec_from_file_location("audit_runner", RUNNER)
    mod = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mod)
    return mod


ar = _load()


def _py_checker(id, body, **kw):
    """A Checker backed by an inline python program, for deterministic fixtures."""
    kw.setdefault("parser", "parse_card_lint")
    parser = kw.pop("parser")
    return ar.Checker(id, ["python3", "-c", body], "static", parser, **kw)


class TestVerdictsComeFromJsonNotText(unittest.TestCase):
    """Property 1: the human text is decoration; the JSON is the contract."""

    LYING_PROSE = (
        "print('SUMMARY: 0 errors, 0 warnings');"
        "print('MISMATCH: 0');"
        "print('COUNTERFEIT                   0');"
    )

    def test_reassuring_prose_does_not_suppress_json_findings(self):
        """Output that says 'everything is fine' while the payload says otherwise."""
        payload = {"counts": {"errors": 1}, "dataFiles": {},
                   "diagnostics": [{"ruleId": "has-name", "severity": "error",
                                    "filename": "zzz.json", "message": "Missing name"}]}
        chk = _py_checker(
            "lying", self.LYING_PROSE + f"import json;print(json.dumps({payload!r}))")
        findings, rec = ar.run_checker(chk)
        self.assertTrue(rec["ran"])
        self.assertEqual(len(findings), 1, "the JSON finding was suppressed by prose")
        self.assertEqual(findings[0]["ruleId"], "has-name")

    def test_alarming_prose_does_not_invent_findings(self):
        """The mirror case: scary text, clean payload → still clean."""
        chk = _py_checker(
            "noisy",
            "print('✗✗ FAILED: 999 errors, COUNTERFEIT 42, MISMATCH: 17');"
            "import json;print(json.dumps({'counts':{'errors':0},"
            "'dataFiles':{},'diagnostics':[]}))")
        findings, rec = ar.run_checker(chk)
        self.assertTrue(rec["ran"])
        self.assertEqual(findings, [], "findings were invented from stdout text")


class TestAbsenceIsNeverAPass(unittest.TestCase):
    """Property 2: every way of not-checking yields UNVERIFIABLE."""

    def _assert_unverifiable(self, findings, rec, reason):
        self.assertFalse(rec.get("ran"), f"checker reported as run ({reason})")
        self.assertTrue(findings, f"no finding emitted for: {reason}")
        self.assertEqual(findings[0]["verdict"], "UNVERIFIABLE")
        self.assertEqual(findings[0]["severity"], "error")

    def test_missing_required_input(self):
        chk = _py_checker("needs-data", "print('{}')",
                          requires=["cli/data/definitely-not-here-9f3a"])
        findings, rec = ar.run_checker(chk)
        self._assert_unverifiable(findings, rec, "required input absent")
        self.assertEqual(rec["reason"], "missing-inputs")

    def test_zero_exit_with_no_json_is_not_clean(self):
        """The silent-pass guard.

        A checker wired to a JSON parser that exits 0 while printing nothing
        parseable must NOT read as clean — that is precisely how an unwired
        `--json-stdout` flag would have produced a green run.
        """
        chk = _py_checker("silent", "pass")
        findings, rec = ar.run_checker(chk)
        self._assert_unverifiable(findings, rec, "exit 0 but no JSON payload")
        self.assertEqual(rec["reason"], "no-json-payload")

    def test_parser_crash_degrades_this_checker_only(self):
        """A parser bug must not abort the run or be mistaken for a pass."""
        chk = _py_checker("bad-shape", "print('{\"diagnostics\": 12345}')")
        findings, rec = ar.run_checker(chk)
        self._assert_unverifiable(findings, rec, "parser raised on a bad payload")
        self.assertEqual(rec["reason"], "parser-error")

    def test_executable_missing(self):
        chk = ar.Checker("no-such-bin", ["definitely-not-a-binary-8b21"],
                         "static", "parse_exit_only")
        findings, rec = ar.run_checker(chk)
        self._assert_unverifiable(findings, rec, "executable absent")

    def test_crash_exit_is_unverifiable_not_violation(self):
        """'Could not run' and 'ran and found a problem' are different states."""
        chk = ar.Checker("crasher", ["python3", "-c", "raise SystemExit(1)"],
                         "static", "parse_exit_only")            # violation_exits=(3,)
        findings, _ = ar.run_checker(chk)
        self.assertEqual(findings[0]["verdict"], "UNVERIFIABLE")

        declared = ar.Checker("legacy", ["python3", "-c", "raise SystemExit(1)"],
                              "static", "parse_exit_only", violation_exits=(1,))
        findings, _ = ar.run_checker(declared)
        self.assertEqual(findings[0]["verdict"], "VIOLATION",
                         "a checker that DECLARES exit 1 as its violation "
                         "signal must be scored as a violation")


class TestRatchetIntegrity(unittest.TestCase):
    """Property 3: rewording a diagnostic cannot move a ratchet."""

    def test_baseline_key_ignores_the_message(self):
        a = ar.finding("c", "some-rule", "error", "schema", code="abc",
                       summary="Missing script field")
        b = ar.finding("c", "some-rule", "error", "schema", code="abc",
                       summary="COMPLETELY DIFFERENT WORDING")
        self.assertEqual(a["baselineKey"], b["baselineKey"])
        self.assertEqual(a["id"], b["id"], "finding id must be message-free too")

    def test_baseline_key_distinguishes_rule_and_code(self):
        base = ar.finding("c", "rule-x", "error", "schema", code="abc")
        self.assertNotEqual(
            base["baselineKey"],
            ar.finding("c", "rule-y", "error", "schema", code="abc")["baselineKey"])
        self.assertNotEqual(
            base["baselineKey"],
            ar.finding("c", "rule-x", "error", "schema", code="def")["baselineKey"])

    def test_malformed_baseline_is_refused(self):
        with tempfile.NamedTemporaryFile("w", suffix=".json", delete=False) as fh:
            json.dump({"no_rules_key": True}, fh)
            path = fh.name
        try:
            keys, err = ar.load_baseline(path)
            self.assertIsNone(keys)
            self.assertIn("malformed", err)
        finally:
            os.unlink(path)


class TestStewardHasNoSubstringVerdicts(unittest.TestCase):
    """The greps must stay deleted, not just be deleted once."""

    BANNED = ('"0 errors" not in', '"MISMATCH: 0" not in', '"COUNTERFEIT',
              '"0 errors" in', '"MISMATCH: 0" in')

    def test_no_stdout_substring_verdicts(self):
        src = STEWARD.read_text(encoding="utf-8")
        # Strip docstrings' explanatory mentions: only real code is in scope.
        code = "\n".join(l for l in src.splitlines()
                         if not l.lstrip().startswith("#"))
        for pat in self.BANNED:
            with self.subTest(pattern=pat):
                # The surviving mentions live inside the check_audit docstring,
                # which explains what was removed. Assert none appear in a
                # conditional.
                for line in code.splitlines():
                    if pat in line and ("if " in line or "elif " in line):
                        self.fail(f"steward_report.py still decides on stdout text: {line.strip()}")

    def test_steward_delegates_to_the_runner(self):
        src = STEWARD.read_text(encoding="utf-8")
        self.assertIn("audit_runner.py", src,
                      "steward_report.py must consume the runner, not re-implement it")


class TestRegisteredCheckersAreCoherent(unittest.TestCase):
    def test_every_checker_has_a_real_parser(self):
        for chk in ar.CHECKERS:
            with self.subTest(checker=chk.id):
                self.assertIn(chk.parser, ar.PARSERS)

    def test_every_checker_has_a_known_profile_and_category(self):
        for chk in ar.CHECKERS:
            with self.subTest(checker=chk.id):
                self.assertIn(chk.profile, ar.PROFILE_ORDER)
                self.assertIn(chk.category, ar.CATEGORIES)

    def test_checker_ids_are_unique(self):
        ids = [c.id for c in ar.CHECKERS]
        self.assertEqual(len(ids), len(set(ids)))

    def test_deep_checkers_declare_their_data_dependencies(self):
        """A deep checker with no `requires` would silently 'pass' on a clone
        that lacks the gitignored dumps — the exact absence-is-a-pass bug."""
        for chk in ar.CHECKERS:
            if chk.profile == "deep":
                with self.subTest(checker=chk.id):
                    self.assertTrue(chk.requires,
                                    f"{chk.id} is a deep checker but declares no requires[]")


if __name__ == "__main__":
    unittest.main(verbosity=2)
