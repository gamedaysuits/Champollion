"""nmt-forge curve: two fitted shapes, honest bars, a plot (2026-10-15)."""
import json
import math
import subprocess
import sys
from pathlib import Path

from nmt_forge.improve.curve import fit_log_linear, fit_saturating, project


def _logistic(n, L, k, x0):
    return L / (1 + math.exp(-k * (math.log2(n) - x0)))


def test_a_saturating_curve_is_recovered_and_a_bar_above_it_is_not_reached():
    pts = [(n, _logistic(n, 24.0, 1.0, 11.5)) for n in (400, 800, 1600, 3200, 6400, 12800, 25600)]
    L, k, x0 = fit_saturating(pts)
    assert abs(L - 24.0) < 1.0
    out = project(pts, predict=[39480], bars=[50, 20])
    assert "not reached" in out["saturating"]["pairs_needed"]["50"]["note"]
    assert out["saturating"]["pairs_needed"]["20"]["point"] < 25600


def test_the_per_doubling_line_says_points_per_doubling_and_pairs_needed():
    pts = [(3200, 10.0), (6400, 17.0), (12800, 24.0)]
    a0, b = fit_log_linear(pts)
    assert abs(b - 7.0) < 1e-9
    out = project(pts, predict=[25600], bars=[50])
    assert out["log_linear"]["predicted"]["25600"] == 31.0
    assert abs(math.log2(out["log_linear"]["pairs_needed"]["50"]) - math.log2(12800 * 2 ** (26 / 7))) < 0.01


def test_the_command_writes_a_plot_and_keeps_single_points_unfitted(tmp_path):
    pts = tmp_path / "points.jsonl"
    rows = [{"model": "small", "pairs": n, "score": _logistic(n, 60, 0.8, 11)} for n in (400, 1600, 3200, 6400, 12800)]
    rows.append({"model": "large", "pairs": 39480, "score": 55.0, "single": True})
    pts.write_text("".join(json.dumps(r) + "\n" for r in rows))
    out = tmp_path / "curve.svg"
    r = subprocess.run([sys.executable, "-m", "nmt_forge", "curve", "--points", str(pts), "--measure", "chrF++",
                        "--predict", "39480", "--out", str(out), "--json"], capture_output=True, text=True,
                       timeout=120, cwd=Path(__file__).resolve().parents[1])
    assert r.returncode == 0, r.stderr
    doc = json.loads(r.stdout)
    assert set(doc["models"]) == {"small"} and doc["single_points"]["large"] == [[39480.0, 55.0]]
    assert out.read_text().startswith("<svg") and "more of the same" in out.read_text().lower()
