#!/usr/bin/env python3
"""Tests for the OCAP® exclusion gate (scripts/check_sovereignty_usage.py).

Since 2026-08-29 the gate bans ANY occurrence of the token on public
surfaces (OCAP® is FNIGC's registered trademark; not ours to invoke in any
framing, including the retired "OCAP®-aspirant" house term). The
load-bearing proof is the false-positive guard: language names can contain
the letter sequence mid-word ("Docapúaraye", the Tuyuca endonym) and must
never trip the gate, while every real form — bare OCAP, OCAP®, ocap_review,
fnigc.ca/ocap-training — must.

Run standalone:   python3 scripts/tests/test_check_sovereignty_usage.py
Run under pytest: python3 -m pytest scripts/tests/
"""
import importlib.util
import subprocess
import sys
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]          # scripts/tests/ -> repo root
GATE = ROOT / "scripts" / "check_sovereignty_usage.py"


def _load():
    spec = importlib.util.spec_from_file_location("check_sovereignty_usage", GATE)
    mod = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mod)
    return mod


MOD = _load()


def _line_hits(line: str):
    """Matches on one line that the gate would report."""
    return [m for m in MOD.TOKEN.finditer(line)
            if not MOD.is_inside_word(line, m.start(), m.end())]


class TestCaught(unittest.TestCase):
    CASES = [
        "aligned with OCAP principles",
        "OCAP® is a registered trademark",
        "we are OCAP®-aspirant",           # the retired house term is banned too
        "OCAP-compliant evaluation infrastructure",
        '"ocap_review": "pending"',        # identifiers are violations
        "https://fnigc.ca/ocap-training/",
        "see NOTICE (OCAP®).",
        "the M2 flow of OCAP_MULTISIG_PLAN",
    ]

    def test_all_real_forms_caught(self):
        for line in self.CASES:
            with self.subTest(line=line):
                self.assertTrue(_line_hits(line), f"should be caught: {line!r}")


class TestFalsePositives(unittest.TestCase):
    CASES = [
        '"localname": "Docapúaraye",',     # Tuyuca endonym — letters both sides
        "Borá-Tuyuka, Docapúaraye, Dokapuara",
        "docapuara",                       # ascii variant, still mid-word
    ]

    def test_language_names_skipped(self):
        for line in self.CASES:
            with self.subTest(line=line):
                self.assertFalse(_line_hits(line), f"false positive: {line!r}")


class TestExclusions(unittest.TestCase):
    def test_gate_and_docent_surfaces_excluded(self):
        files = set()
        for root in MOD.PUBLIC_ROOTS:
            if (ROOT / root).exists():
                files.update(MOD.iter_files(root))
        joined = "\n".join(files)
        self.assertNotIn("check_sovereignty_usage.py", joined)
        self.assertNotIn("docent_eval", joined)
        self.assertNotIn("cli/data/", joined)

    def test_lyss_and_readme_scanned(self):
        files = set()
        for root in MOD.PUBLIC_ROOTS:
            if (ROOT / root).exists():
                files.update(MOD.iter_files(root))
        self.assertIn("README.md", files)
        self.assertTrue(any(f.startswith("lyss/") or f.startswith("lyss" + "\\")
                            for f in files), "lyss/ must be scanned")


class TestLiveTree(unittest.TestCase):
    def test_gate_runs_clean_on_tree(self):
        r = subprocess.run([sys.executable, str(GATE), "--quiet"],
                           capture_output=True, text=True)
        self.assertEqual(r.returncode, 0,
                         f"gate reports violations:\n{r.stdout}{r.stderr}")


if __name__ == "__main__":
    unittest.main()
