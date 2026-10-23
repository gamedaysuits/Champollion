"""The learning curve: how a measure grows with training pairs, and where it
is heading (founder 2026-10-15: "plot a curve and make sure Forge works for
doing such a thing, we have the start of the curve, what's its far point?").

Input: measured points — (training pairs, score on a fixed test set, 0-100),
one or more models. For each model, two shapes are fitted, because the two
honest readings of a short curve disagree:

- **saturating**: a logistic in log2(pairs), ``score = L / (1 + exp(-k (log2 N - x0)))``,
  whose L is the ceiling more of the SAME kind of data would reach;
- **log-linear**: a straight line in log2(pairs) through the last three
  sizes — points gained per doubling, no ceiling (the optimistic bound).

The range around each prediction comes from refitting with each training
size left out in turn. Bars (e.g. 50 = useful draft, 80 = working) are
answered with the pairs each shape needs, or "not reached" when the
saturating ceiling sits below the bar in every refit. A projection is a
statement about this model on this kind of data, never about another model
or another kind of data — the plot says so.
"""
from __future__ import annotations

import json
import math
from pathlib import Path

#: grid for the logistic's slope and midpoint (log2 pairs: 2^7 … 2^20)
_K = [x * 0.05 for x in range(4, 61)]
_X0 = [x * 0.1 for x in range(70, 201)]


def _logistic(n: float, L: float, k: float, x0: float) -> float:
    return L / (1 + math.exp(-k * (math.log2(n) - x0)))


def fit_saturating(points: list[tuple[float, float]]) -> tuple[float, float, float] | None:
    """(L, k, x0) by least squares; for each (k, x0) the best ceiling L is
    closed-form, held between the highest point and 100."""
    if len({n for n, _ in points}) < 3:
        return None
    top = max(y for _, y in points)
    best = None
    for k in _K:
        for x0 in _X0:
            s = [1 / (1 + math.exp(-k * (math.log2(n) - x0))) for n, _ in points]
            ss = sum(v * v for v in s)
            if ss == 0:
                continue
            L = min(100.0, max(top, sum(v * y for v, (_, y) in zip(s, points)) / ss))
            sse = sum((L * v - y) ** 2 for v, (_, y) in zip(s, points))
            if best is None or sse < best[0]:
                best = (sse, L, k, x0)
    return best[1:] if best else None


def fit_log_linear(points: list[tuple[float, float]], tail: int = 3) -> tuple[float, float] | None:
    """(intercept, points per doubling) through the ``tail`` largest sizes."""
    sizes = sorted({n for n, _ in points})[-tail:]
    pts = [(math.log2(n), y) for n, y in points if n in sizes]
    if len(sizes) < 2:
        return None
    mx = sum(x for x, _ in pts) / len(pts)
    my = sum(y for _, y in pts) / len(pts)
    sxx = sum((x - mx) ** 2 for x, _ in pts)
    if sxx == 0:
        return None
    b = sum((x - mx) * (y - my) for x, y in pts) / sxx
    return my - b * mx, b


def _needed_saturating(bar: float, f) -> float | None:
    L, k, x0 = f
    if bar >= L:
        return None
    return 2 ** (x0 - math.log((L / bar) - 1) / k)


def project(points: list[tuple[float, float]], *, predict: list[int], bars: list[float]) -> dict:
    """Both shapes, their leave-one-size-out ranges, predictions and the pairs
    each bar needs. Numbers only; the caller says what the measure is."""
    sizes = sorted({n for n, _ in points})
    full = fit_saturating(points)
    refits = [f for f in (fit_saturating([p for p in points if p[0] != s]) for s in sizes) if f] if full else []
    lin = fit_log_linear(points)
    out: dict = {"points": len(points), "sizes": sizes, "largest_measured": sizes[-1] if sizes else None}
    if full:
        allf = [full] + refits
        top = max(y for _, y in points)
        out["saturating"] = {
            "ceiling": round(full[0], 1), "ceiling_range": [round(min(f[0] for f in allf), 1),
                                                            round(max(f[0] for f in allf), 1)],
            # a ceiling the fit puts at the highest measured point is not evidence
            # of a ceiling: the points do not bend there (2026-10-15, Klingon: the
            # fit said 24% from points up to 12,800 pairs; 39,480 pairs measured 28.4%)
            "ceiling_identified": full[0] > top * 1.05,
            "midpoint_pairs": round(2 ** full[2]), "k": round(full[1], 3),
            "predicted": {str(n): {"point": round(_logistic(n, *full), 1),
                                   "range": [round(min(_logistic(n, *f) for f in allf), 1),
                                             round(max(_logistic(n, *f) for f in allf), 1)]} for n in predict},
            "pairs_needed": {}}
        for bar in bars:
            need = [_needed_saturating(bar, f) for f in allf]
            got = [x for x in need if x is not None]
            out["saturating"]["pairs_needed"][f"{bar:g}"] = (
                {"point": None, "range": None, "note": "not reached: the fitted ceiling is below the bar in every refit"}
                if not got else
                {"point": round(need[0]) if need[0] else None, "range": [round(min(got)), round(max(got))],
                 "refits_not_reaching": len(need) - len(got)})
    if lin:
        a0, b = lin
        out["log_linear"] = {
            "points_per_doubling": round(b, 2), "through_sizes": sizes[-3:],
            "predicted": {str(n): round(a0 + b * math.log2(n), 1) for n in predict},
            "pairs_needed": {f"{bar:g}": (round(2 ** ((bar - a0) / b)) if b > 0 else None) for bar in bars}}
    return out


# -- the plot ------------------------------------------------------------------------
_COLOURS = ["#0f766e", "#7c3aed", "#b45309", "#be123c", "#1d4ed8", "#4d7c0f"]


def svg(series: dict[str, list[tuple[float, float]]], fits: dict[str, dict], *, measure: str,
        bars: list[float], extra: dict[str, list[tuple[float, float]]] | None = None,
        title: str = "", note: str = "", x_max: float | None = None) -> str:
    """A standalone SVG: measured points (filled), each model's two fitted
    shapes (solid = saturating, dashed = log-linear) to x_max, bars as
    horizontal rules. ``extra`` are single points of other models (hollow)."""
    W, H, ml, mr, mt, mb = 860, 520, 64, 190, 48, 70
    pw, ph = W - ml - mr, H - mt - mb
    allx = [n for pts in series.values() for n, _ in pts] + [n for pts in (extra or {}).values() for n, _ in pts]
    lo = 2 ** math.floor(math.log2(min(allx)))
    hi = x_max or 2 ** math.ceil(math.log2(max(allx)) + 2)
    X = lambda n: ml + pw * (math.log2(n) - math.log2(lo)) / (math.log2(hi) - math.log2(lo))  # noqa: E731
    Y = lambda y: mt + ph * (1 - max(0.0, min(100.0, y)) / 100)  # noqa: E731
    o = [f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {W} {H}" font-family="system-ui,sans-serif" '
         f'font-size="12"><rect width="{W}" height="{H}" fill="#fff"/>',
         f'<text x="{ml}" y="24" font-size="15" font-weight="600">{_esc(title)}</text>']
    for t in range(0, 101, 20):
        o.append(f'<line x1="{ml}" x2="{ml + pw}" y1="{Y(t):.1f}" y2="{Y(t):.1f}" stroke="#eee"/>'
                 f'<text x="{ml - 8}" y="{Y(t) + 4:.1f}" text-anchor="end" fill="#555">{t}</text>')
    n = lo
    while n <= hi:
        lab = f"{n / 1000:g}k" if n >= 1000 else f"{n:g}"
        o.append(f'<line x1="{X(n):.1f}" x2="{X(n):.1f}" y1="{mt}" y2="{mt + ph}" stroke="#f3f3f3"/>'
                 f'<text x="{X(n):.1f}" y="{mt + ph + 18}" text-anchor="middle" fill="#555">{lab}</text>')
        n *= 2
    for b in bars:
        o.append(f'<line x1="{ml}" x2="{ml + pw}" y1="{Y(b):.1f}" y2="{Y(b):.1f}" stroke="#999" '
                 f'stroke-dasharray="2 4"/><text x="{ml + pw + 6}" y="{Y(b) + 4:.1f}" fill="#555">bar {b:g}</text>')
    o.append(f'<text x="{ml + pw / 2}" y="{H - 30}" text-anchor="middle" fill="#333">training pairs '
             f'(log scale; each step doubles)</text>'
             f'<text transform="translate(16 {mt + ph / 2}) rotate(-90)" text-anchor="middle" fill="#333">'
             f'{_esc(measure)}</text>')
    ly = mt
    for i, (name, pts) in enumerate(series.items()):
        c = _COLOURS[i % len(_COLOURS)]
        f = fits.get(name) or {}
        sat = f.get("_saturating_params")
        if sat:
            xs = [2 ** (math.log2(lo) + j * (math.log2(hi) - math.log2(lo)) / 120) for j in range(121)]
            o.append('<polyline fill="none" stroke="%s" stroke-width="2" points="%s"/>' % (
                c, " ".join(f"{X(x):.1f},{Y(_logistic(x, *sat)):.1f}" for x in xs)))
        lin = f.get("_log_linear_params")
        if lin:
            a0, b = lin
            x0 = max(pts)[0] / 4
            xs = [x0 * (hi / x0) ** (j / 40) for j in range(41)]
            o.append('<polyline fill="none" stroke="%s" stroke-width="1.5" stroke-dasharray="6 4" points="%s"/>' % (
                c, " ".join(f"{X(x):.1f},{Y(a0 + b * math.log2(x)):.1f}" for x in xs)))
        for nn, y in pts:
            o.append(f'<circle cx="{X(nn):.1f}" cy="{Y(y):.1f}" r="4" fill="{c}"/>')
        o.append(f'<circle cx="{ml + pw + 14}" cy="{ly + 40}" r="4" fill="{c}"/>'
                 f'<text x="{ml + pw + 24}" y="{ly + 44}">{_esc(name)}</text>')
        ly += 18
    for j, (name, pts) in enumerate((extra or {}).items()):
        c = _COLOURS[(len(series) + j) % len(_COLOURS)]
        for nn, y in pts:
            o.append(f'<circle cx="{X(nn):.1f}" cy="{Y(y):.1f}" r="5" fill="#fff" stroke="{c}" stroke-width="2"/>')
        o.append(f'<circle cx="{ml + pw + 14}" cy="{ly + 40}" r="5" fill="#fff" stroke="{c}" stroke-width="2"/>'
                 f'<text x="{ml + pw + 24}" y="{ly + 44}">{_esc(name)}</text>')
        ly += 18
    o.append(f'<text x="{ml + pw + 8}" y="{ly + 62}" fill="#555">solid: saturating fit</text>'
             f'<text x="{ml + pw + 8}" y="{ly + 78}" fill="#555">dashed: per-doubling line</text>')
    if note:
        o.append(f'<text x="{ml}" y="{H - 10}" fill="#666" font-size="11">{_esc(note)}</text>')
    o.append("</svg>")
    return "".join(o)


def _esc(s: str) -> str:
    return str(s).replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;")


def run_curve(points_file: str | Path, *, predict: list[int], bars: list[float], out_svg: str | Path | None,
              measure: str, title: str = "", x_max: float | None = None) -> dict:
    """Read points ({"model", "pairs", "score"} per line; ``"single": true``
    marks a model measured at one size only, plotted, not fitted), fit each
    model with three or more sizes, write the plot."""
    series: dict[str, list[tuple[float, float]]] = {}
    singles: dict[str, list[tuple[float, float]]] = {}
    for line in Path(points_file).read_text(encoding="utf-8").splitlines():
        if not line.strip():
            continue
        r = json.loads(line)
        (singles if r.get("single") else series).setdefault(str(r["model"]), []).append(
            (float(r["pairs"]), float(r["score"])))
    result: dict = {"measure": measure, "models": {}, "single_points": {k: v for k, v in singles.items()}}
    fits_for_plot: dict[str, dict] = {}
    for name, pts in series.items():
        p = project(pts, predict=predict, bars=bars)
        result["models"][name] = p
        fits_for_plot[name] = {"_saturating_params": fit_saturating(pts), "_log_linear_params": fit_log_linear(pts)}
    if out_svg:
        Path(out_svg).write_text(svg(series, fits_for_plot, measure=measure, bars=bars, extra=singles,
                                     title=title, x_max=x_max,
                                     note="A fit says where THIS model goes on MORE OF THE SAME data; "
                                          "other models and other kinds of data are measured, not projected."),
                                 encoding="utf-8")
        result["plot"] = str(out_svg)
    return result
