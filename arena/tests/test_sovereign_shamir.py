"""Property tests for the vendored GF(256) Shamir (sovereign lane).

The vendor rule for crypto: never trust a port, prove it. These tests
validate the field arithmetic against an independent schoolbook
implementation, then property-test the scheme itself — any M of N shares
reconstruct; any M−1 shares are consistent with EVERY candidate secret
(the information-theoretic property, tested as a bijection, not a vibe).
"""

from __future__ import annotations

import secrets

import pytest

from mt_eval_harness.sovereign.shamir_gf256 import (
    ShamirError,
    _add,
    _div,
    _interpolate,
    _inverse,
    _mult,
    combine,
    split,
)


# ---------------------------------------------------------------------------
# Field arithmetic vs an independent reference.
# ---------------------------------------------------------------------------

def _ref_mult(a: int, b: int) -> int:
    """Schoolbook carry-less multiply mod 0x11b — deliberately a DIFFERENT
    algorithm from the module's double-and-add, so a shared bug is unlikely."""
    r = 0
    while b:
        if b & 1:
            r ^= a
        a <<= 1
        if a & 0x100:
            a ^= 0x11B
        b >>= 1
    return r


def test_mult_matches_independent_reference_exhaustively_sampled():
    rng = secrets.SystemRandom()
    for _ in range(5000):
        a, b = rng.randrange(256), rng.randrange(256)
        assert _mult(a, b) == _ref_mult(a, b)
    # Identity / absorbing elements, exhaustively.
    for a in range(256):
        assert _mult(a, 1) == a
        assert _mult(a, 0) == 0


def test_inverse_property_over_whole_field():
    for a in range(1, 256):
        assert _mult(a, _inverse(a)) == 1


def test_div_by_zero_raises():
    with pytest.raises(ShamirError):
        _div(7, 0)


def test_interpolation_recovers_a_known_polynomial():
    # p(x) = 5 + 3x + 7x^2 over GF(256); sample at 3 points, interpolate 0.
    coeffs = bytes([5, 3, 7])
    def p(x):
        return _add(_add(coeffs[0], _mult(coeffs[1], x)),
                    _mult(coeffs[2], _mult(x, x)))
    xs = [1, 2, 3]
    ys = [p(x) for x in xs]
    assert _interpolate(xs, ys, 0) == 5


# ---------------------------------------------------------------------------
# Scheme properties.
# ---------------------------------------------------------------------------

@pytest.mark.parametrize("m,n", [(2, 2), (2, 3), (3, 5), (4, 7), (5, 5)])
def test_any_m_of_n_reconstructs(m, n):
    secret = secrets.token_bytes(32)
    shares = split(secret, n, m)
    assert len(shares) == n
    assert all(len(s) == 33 for s in shares)
    # Every m-subset (bounded sampling for the larger combos).
    from itertools import combinations
    subsets = list(combinations(range(n), m))[:15]
    for subset in subsets:
        assert combine([shares[i] for i in subset]) == secret
    # More than m also reconstructs.
    if n > m:
        assert combine(shares) == secret


def test_fewer_than_m_yields_garbage_never_the_secret():
    secret = secrets.token_bytes(32)
    shares = split(secret, 5, 3)
    for k in (2,):
        result = combine(shares[:k])
        assert result != secret


def test_m_minus_one_shares_reveal_nothing_bijection():
    """The information-theoretic core: fix M−1 real shares of a 1-byte
    secret; sweeping the missing share's y over all 256 values sweeps the
    reconstructed secret over all 256 values (a bijection). Holding M−1
    shares therefore constrains the secret NOT AT ALL — every candidate
    secret is exactly as consistent as every other."""
    secret = bytes([170])
    shares = split(secret, 5, 3)
    two = [shares[0], shares[1]]
    forged_x = shares[2][-1]
    seen = set()
    for y in range(256):
        forged = bytes([y, forged_x])
        seen.add(combine(two + [forged])[0])
    assert seen == set(range(256))


def test_single_share_bytes_look_uniform():
    """Coarse distribution check: one share byte over many fresh splits of
    the SAME secret spreads over the byte space (no value hoards mass)."""
    secret = bytes([42]) * 16
    counts = [0] * 256
    rounds = 3000
    for _ in range(rounds):
        share = split(secret, 3, 2)[0]
        counts[share[0]] += 1
    assert len([c for c in counts if c > 0]) > 200
    assert max(counts) < rounds * 0.05  # no single value >5% of mass


def test_structural_refusals():
    secret = secrets.token_bytes(8)
    with pytest.raises(ShamirError):
        split(secret, 3, 4)          # parts < threshold
    with pytest.raises(ShamirError):
        split(secret, 300, 3)        # parts > 255
    with pytest.raises(ShamirError):
        split(secret, 5, 1)          # threshold < 2 (a 1-of-N IS the secret)
    with pytest.raises(ShamirError):
        split(b"", 5, 3)             # empty secret
    shares = split(secret, 5, 3)
    with pytest.raises(ShamirError):
        combine([shares[0]])         # one share
    with pytest.raises(ShamirError):
        combine([shares[0], shares[0], shares[1]])  # duplicate x
    with pytest.raises(ShamirError):
        combine([shares[0], shares[1][:-1] + b"\x00", shares[2]])  # x = 0
    with pytest.raises(ShamirError):
        combine([shares[0], shares[1][:5]])          # length mismatch


def test_x_coordinates_distinct_and_nonzero():
    shares = split(secrets.token_bytes(4), 200, 2)
    xs = [s[-1] for s in shares]
    assert len(set(xs)) == 200
    assert 0 not in xs
