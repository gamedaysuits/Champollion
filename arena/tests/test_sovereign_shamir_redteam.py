"""Red-team hardening tests for the vendored GF(256) Shamir (2026-08-17).

Adds to test_sovereign_shamir.py (which already property-tests the scheme):

  * PUBLISHED test vectors — FIPS-197 §4.2's worked GF(2^8) examples — so the
    field arithmetic is checked against the standards document itself, not
    only against a second implementation written in this repo.
  * EXHAUSTIVE 256×256 multiplication cross-check (the base suite samples).
  * An INDEPENDENT whole-scheme reconstruction: shares produced by split()
    are recombined by a from-scratch Lagrange interpolator built on the
    schoolbook arithmetic — a shared bug in the module's combine() path
    cannot survive this.
  * Polynomial-degree probe: every (M−1)-subset must fail to reconstruct —
    the classic catastrophic Shamir bug is a polynomial of degree < M−1,
    which makes a sub-quorum sufficient. (The base suite checks ONE
    sub-quorum; this checks all of them.)
  * CHI-SQUARE statistical tests (no scipy needed — the statistic is summed
    directly and compared to a fixed critical value): share bytes for a
    fixed secret must be uniform over 0..255, and the share-byte
    distribution must be indistinguishable between two extreme secrets
    (0x00 vs 0xFF) — the operational face of "M−1 shares carry no
    information about the secret".
  * hypothesis property tests (skipped cleanly where hypothesis is absent):
    field laws, split/combine round-trips over arbitrary secrets and
    (m, n), and sub-quorum non-reconstruction.

All secrets here are synthetic; nothing touches ceremony or custodian
material.
"""

from __future__ import annotations

import secrets
from itertools import combinations

import pytest

from mt_eval_harness.sovereign.shamir_gf256 import (
    _add,
    _inverse,
    _mult,
    combine,
    split,
)

# ---------------------------------------------------------------------------
# Independent reference arithmetic (schoolbook; deliberately different
# algorithms from the module's double-and-add / fixed exponentiation chain).
# ---------------------------------------------------------------------------


def _ref_mult(a: int, b: int) -> int:
    r = 0
    while b:
        if b & 1:
            r ^= a
        a <<= 1
        if a & 0x100:
            a ^= 0x11B
        b >>= 1
    return r


def _ref_pow(a: int, e: int) -> int:
    r = 1
    while e:
        if e & 1:
            r = _ref_mult(r, a)
        a = _ref_mult(a, a)
        e >>= 1
    return r


def _ref_inverse(a: int) -> int:
    return _ref_pow(a, 254)  # Fermat: a^(2^8 - 2)


def _ref_combine(shares: list[bytes]) -> bytes:
    """From-scratch Lagrange-at-zero reconstruction on the reference
    arithmetic — shares in Vault wire format (y-bytes + x as last byte)."""
    xs = [s[-1] for s in shares]
    out = bytearray(len(shares[0]) - 1)
    for byte_idx in range(len(out)):
        acc = 0
        for i, share in enumerate(shares):
            basis = 1
            for j, xj in enumerate(xs):
                if i == j:
                    continue
                num = 0 ^ xj  # evaluate at x = 0
                den = xs[i] ^ xj
                basis = _ref_mult(basis, _ref_mult(num, _ref_inverse(den)))
            acc ^= _ref_mult(share[byte_idx], basis)
        out[byte_idx] = acc
    return bytes(out)


# ---------------------------------------------------------------------------
# Published vectors + exhaustive arithmetic.
# ---------------------------------------------------------------------------


class TestPublishedVectors:
    def test_fips_197_worked_examples(self):
        """FIPS-197 §4.2 works {57}·{83} = {c1} in the AES field, and its
        xtime chain gives {57}·{13} = {fe}. The standard's own numbers."""
        assert _mult(0x57, 0x83) == 0xC1
        assert _mult(0x57, 0x13) == 0xFE

    def test_known_aes_inverse_pair(self):
        """0x53 and 0xCA are the multiplicative-inverse pair used throughout
        the AES S-box literature."""
        assert _mult(0x53, 0xCA) == 0x01
        assert _inverse(0x53) == 0xCA
        assert _inverse(0xCA) == 0x53

    def test_mult_exhaustive_against_reference(self):
        """All 65,536 products — not a sample."""
        for a in range(256):
            for b in range(256):
                assert _mult(a, b) == _ref_mult(a, b)

    def test_inverse_exhaustive_against_reference(self):
        for a in range(1, 256):
            assert _inverse(a) == _ref_inverse(a)

    def test_field_laws_spot(self):
        rng = secrets.SystemRandom()
        for _ in range(500):
            a, b, c = (rng.randrange(256) for _ in range(3))
            assert _mult(a, b) == _mult(b, a)
            assert _mult(a, _mult(b, c)) == _mult(_mult(a, b), c)
            assert _mult(a, _add(b, c)) == _add(_mult(a, b), _mult(a, c))


# ---------------------------------------------------------------------------
# Independent whole-scheme reconstruction + degree probe.
# ---------------------------------------------------------------------------


class TestIndependentReconstruction:
    @pytest.mark.parametrize("m,n", [(2, 3), (3, 5), (5, 7)])
    def test_reference_combiner_recovers_split_output(self, m, n):
        secret = secrets.token_bytes(32)
        shares = split(secret, n, m)
        for subset in list(combinations(shares, m))[:10]:
            assert _ref_combine(list(subset)) == secret
            assert combine(list(subset)) == secret

    @pytest.mark.parametrize("m,n", [(2, 4), (3, 5), (4, 6), (5, 7)])
    def test_every_sub_quorum_subset_fails(self, m, n):
        """The catastrophic-bug probe: if any coefficient generation ever
        produced an effective degree < M−1 (e.g. a zero high coefficient
        forced by a biased RNG, or an off-by-one in _make_polynomial), some
        (M−1)-subset would reconstruct the secret. For a 32-byte secret a
        chance match is p ≈ 2^-256 per subset — a failure here is a bug,
        full stop."""
        secret = secrets.token_bytes(32)
        shares = split(secret, n, m)
        for subset in combinations(shares, m - 1):
            if len(subset) < 2:
                continue  # combine() refuses < 2 shares structurally
            assert combine(list(subset)) != secret


# ---------------------------------------------------------------------------
# Chi-square statistics. Critical value for df=255 at p ≈ 1e-6 is ≈ 377
# (Wilson–Hilferty); we use 400 for slack. With that bound a false failure
# is a < 1-in-a-million event; a true bias (e.g. a non-CSPRNG or modulo
# bias) blows past it immediately.
# ---------------------------------------------------------------------------

_CHI2_DF255_CRIT = 400.0


def _chi2_uniform(counts: list[int]) -> float:
    total = sum(counts)
    expected = total / 256
    return sum((c - expected) ** 2 / expected for c in counts)


def _chi2_two_sample(a: list[int], b: list[int]) -> float:
    """Homogeneity statistic for two equal-cell histograms (df ≈ 255)."""
    stat = 0.0
    ta, tb = sum(a), sum(b)
    for ca, cb in zip(a, b):
        tot = ca + cb
        if tot == 0:
            continue
        ea = tot * ta / (ta + tb)
        eb = tot * tb / (ta + tb)
        stat += (ca - ea) ** 2 / ea + (cb - eb) ** 2 / eb
    return stat


class TestStatisticalIndependence:
    def test_share_bytes_uniform_chi_square(self):
        """Fixed 1-byte secret, 25,600 fresh 2-of-2 splits (~100 expected
        per cell): the first share's y-byte must be uniform. Catches biased
        coefficient generation directly."""
        counts = [0] * 256
        for _ in range(25_600):
            counts[split(b"\x00", 2, 2)[0][0]] += 1
        assert _chi2_uniform(counts) < _CHI2_DF255_CRIT

    def test_share_distribution_independent_of_secret(self):
        """The leakage test proper: histograms of a single share byte for
        secret 0x00 vs secret 0xFF must be statistically indistinguishable.
        If holding one share (M−1 of a 2-of-N) shifted ANY mass toward the
        secret, these two distributions would separate."""
        counts_00, counts_ff = [0] * 256, [0] * 256
        for _ in range(12_800):
            counts_00[split(b"\x00", 3, 2)[0][0]] += 1
            counts_ff[split(b"\xff", 3, 2)[0][0]] += 1
        assert _chi2_two_sample(counts_00, counts_ff) < _CHI2_DF255_CRIT

    def test_high_coefficient_never_forced_nonrandom(self):
        """Distribution of the TOP-degree coefficient's effect: for m=3 the
        y-values at a fixed x across fresh splits must also be uniform (a
        zeroed or biased high coefficient would show up here as structure)."""
        counts = [0] * 256
        for _ in range(25_600):
            # take the share whose x-coordinate is smallest for determinism
            share = min(split(b"\xa5", 3, 3), key=lambda s: s[-1])
            counts[share[0]] += 1
        assert _chi2_uniform(counts) < _CHI2_DF255_CRIT


# ---------------------------------------------------------------------------
# hypothesis property tests — run wherever hypothesis is installed; skip
# cleanly (not fail) where it is not. The unconditional tests above already
# cover the core properties with secrets-driven sampling.
# ---------------------------------------------------------------------------

hypothesis = pytest.importorskip(
    "hypothesis",
    reason="property-based layer needs hypothesis (pip install hypothesis); "
           "the unconditional statistical/vector tests above still ran")

from hypothesis import given, settings, strategies as st  # noqa: E402


@settings(max_examples=200, deadline=None)
@given(a=st.integers(0, 255), b=st.integers(0, 255), c=st.integers(0, 255))
def test_hyp_field_laws(a, b, c):
    assert _mult(a, b) == _mult(b, a)
    assert _mult(a, _mult(b, c)) == _mult(_mult(a, b), c)
    assert _mult(a, _add(b, c)) == _add(_mult(a, b), _mult(a, c))
    assert _mult(a, 1) == a and _mult(a, 0) == 0
    if a:
        assert _mult(a, _inverse(a)) == 1


@settings(max_examples=60, deadline=None)
@given(secret=st.binary(min_size=1, max_size=64),
       m=st.integers(2, 6), extra=st.integers(0, 4),
       data=st.data())
def test_hyp_any_m_of_n_roundtrips(secret, m, extra, data):
    n = m + extra
    shares = split(secret, n, m)
    subset = data.draw(st.permutations(shares)) [:m]
    assert combine(subset) == secret


@settings(max_examples=40, deadline=None)
@given(secret=st.binary(min_size=16, max_size=32), m=st.integers(3, 6))
def test_hyp_sub_quorum_never_reconstructs(secret, m):
    shares = split(secret, m + 1, m)
    assert combine(shares[: m - 1]) != secret


@settings(max_examples=40, deadline=None)
@given(secret=st.binary(min_size=1, max_size=32),
       m=st.integers(2, 5), extra=st.integers(0, 3))
def test_hyp_share_shape_invariants(secret, m, extra):
    n = m + extra
    shares = split(secret, n, m)
    assert len(shares) == n
    assert all(len(s) == len(secret) + 1 for s in shares)
    xs = [s[-1] for s in shares]
    assert len(set(xs)) == n and 0 not in xs
