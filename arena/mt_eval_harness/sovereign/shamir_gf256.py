"""shamir_gf256 — Shamir secret sharing over GF(2^8), vendored.

VENDORED PORT of HashiCorp Vault's `shamir` package
(https://github.com/hashicorp/vault, sdk/helper/shamir/shamir.go, MPL-2.0) —
one of the most widely deployed and audited Shamir implementations (it seals
every production Vault master key). The port is line-faithful where Go and
Python diverge only in syntax; the differences are:

  * polynomial coefficients come from ``secrets.token_bytes`` (CSPRNG),
  * the x-coordinate permutation uses ``random.SystemRandom`` (Vault uses
    math/rand for the permutation because x-coordinates are not secret; we
    use the CSPRNG anyway — strictly stronger, same distribution),
  * errors are exceptions, not returned values.

Field arithmetic is GF(2^8) with the AES reduction polynomial 0x11b, computed
branch-poor (no secret-indexed table lookups): multiplication is the
double-and-add loop and inversion is the fixed a^254 exponentiation chain,
both exactly as in Vault. The test suite (tests/test_sovereign_shamir.py)
validates the arithmetic against an independent schoolbook carry-less
multiply, and property-tests the scheme itself: any M of N shares
reconstructs; any M−1 shares are consistent with EVERY possible secret byte
(the information-theoretic zero-knowledge property), not merely "hard to
invert".

Share wire format (Vault's): a share of an L-byte secret is L+1 bytes — the
L y-values followed by the share's non-zero x-coordinate as the final byte.

WHY SHAMIR HERE AT ALL: the sandbox spec §12.5 rejects Shamir for the
*networked platform* because reconstruction assembles the key on one device.
The sovereign LOCAL node (this lane) is that one device — offline, community
-held — and reconstruction happens only in executor memory during a
quorum-authorized run (see sovereign/__init__.py HONESTY CONTRACT).
"""

from __future__ import annotations

import secrets
from random import SystemRandom

__all__ = ["ShamirError", "split", "combine", "SHARE_OVERHEAD"]

# One byte of x-coordinate appended to each share (Vault: ShareOverhead).
SHARE_OVERHEAD = 1


class ShamirError(ValueError):
    """Invalid split/combine inputs — always with the reason."""


# ---------------------------------------------------------------------------
# GF(2^8) arithmetic (AES field, reduction polynomial 0x11b). Ported 1:1 from
# Vault's add/mult/div/inverse.
# ---------------------------------------------------------------------------

def _add(a: int, b: int) -> int:
    """Addition in GF(2^8) is XOR."""
    return a ^ b


def _mult(a: int, b: int) -> int:
    """Multiply two field elements: MSB-first double-and-add, reduced mod
    0x11b at every doubling (Vault's branchless loop, arithmetic-masked)."""
    r = 0
    for i in range(7, -1, -1):
        # r *= x  (mod x^8 + x^4 + x^3 + x + 1)
        r = ((r << 1) & 0xFF) ^ ((r >> 7) * 0x1B)
        # if bit i of b: r += a
        r ^= ((b >> i) & 1) * a
    return r


def _inverse(a: int) -> int:
    """a^254 == a^-1 for a != 0 (Vault's fixed exponentiation chain)."""
    b = _mult(a, a)          # a^2
    c = _mult(a, b)          # a^3
    b = _mult(c, c)          # a^6
    b = _mult(b, b)          # a^12
    c = _mult(b, c)          # a^15
    b = _mult(b, b)          # a^24
    b = _mult(b, b)          # a^48
    b = _mult(b, c)          # a^63
    b = _mult(b, b)          # a^126
    b = _mult(a, b)          # a^127
    return _mult(b, b)       # a^254
    # (0^254 == 0; div() guards the only caller that would care.)


def _div(a: int, b: int) -> int:
    if b == 0:
        raise ShamirError("division by zero in GF(256)")
    return _mult(a, _inverse(b))


# ---------------------------------------------------------------------------
# Polynomials (Vault: makePolynomial / evaluate / interpolatePolynomial).
# ---------------------------------------------------------------------------

def _make_polynomial(intercept: int, degree: int) -> bytes:
    """Random polynomial of the given degree with the given intercept; the
    non-constant coefficients come from the CSPRNG."""
    return bytes([intercept]) + secrets.token_bytes(degree)


def _evaluate(coefficients: bytes, x: int) -> int:
    """Horner evaluation of the polynomial at x (x=0 short-circuits to the
    intercept, exactly as Vault does)."""
    if x == 0:
        return coefficients[0]
    out = coefficients[-1]
    for coeff in reversed(coefficients[:-1]):
        out = _add(_mult(out, x), coeff)
    return out


def _interpolate(x_samples: list[int], y_samples: list[int], x: int) -> int:
    """Lagrange interpolation of the sampled polynomial at x."""
    result = 0
    for i in range(len(x_samples)):
        basis = 1
        for j in range(len(x_samples)):
            if i == j:
                continue
            num = _add(x, x_samples[j])
            denom = _add(x_samples[i], x_samples[j])
            basis = _mult(basis, _div(num, denom))
        result = _add(result, _mult(y_samples[i], basis))
    return result


# ---------------------------------------------------------------------------
# split / combine (Vault: Split / Combine).
# ---------------------------------------------------------------------------

def split(secret: bytes, parts: int, threshold: int) -> list[bytes]:
    """Split ``secret`` into ``parts`` shares, any ``threshold`` of which
    reconstruct it. Each share is ``len(secret)+1`` bytes (x-coordinate
    last). Raises ShamirError on invalid parameters — never silently clamps.
    """
    if parts < threshold:
        raise ShamirError(
            f"parts ({parts}) cannot be less than threshold ({threshold})")
    if parts > 255:
        raise ShamirError(f"parts ({parts}) cannot exceed 255")
    if threshold < 2:
        raise ShamirError(
            f"threshold ({threshold}) must be at least 2 — a 1-of-N share IS "
            f"the secret; use a plain copy if that is truly intended")
    if threshold > 255:
        raise ShamirError(f"threshold ({threshold}) cannot exceed 255")
    if not secret:
        raise ShamirError("cannot split an empty secret")

    # Random, distinct, NON-ZERO x-coordinates (x=0 would leak the intercept).
    x_coordinates = [v + 1 for v in SystemRandom().sample(range(255), parts)]

    shares = [bytearray(len(secret) + SHARE_OVERHEAD) for _ in range(parts)]
    for idx, x in enumerate(x_coordinates):
        shares[idx][len(secret)] = x

    # One random polynomial per secret byte; share i holds p(x_i) per byte.
    for byte_idx, intercept in enumerate(secret):
        coefficients = _make_polynomial(intercept, threshold - 1)
        for share_idx, x in enumerate(x_coordinates):
            shares[share_idx][byte_idx] = _evaluate(coefficients, x)

    return [bytes(s) for s in shares]


def combine(parts: list[bytes]) -> bytes:
    """Reconstruct the secret from at least ``threshold`` shares.

    NOTE (inherent to Shamir, stated honestly): combine() cannot KNOW the
    original threshold. Fewer-than-threshold or corrupted shares yield
    garbage, not an error — the caller MUST verify the reconstruction
    against an independent commitment (the ceremony verifies the derived
    public key; see sovereign/ceremony.py). Structural problems (duplicate
    x, length mismatch) do raise.
    """
    if len(parts) < 2:
        raise ShamirError("at least two shares are required to combine")
    first_len = len(parts[0])
    if first_len < 2:
        raise ShamirError("shares must be at least two bytes long")
    for p in parts:
        if len(p) != first_len:
            raise ShamirError("all shares must be the same length")

    secret = bytearray(first_len - SHARE_OVERHEAD)
    x_samples: list[int] = []
    seen: set[int] = set()
    for p in parts:
        x = p[first_len - 1]
        if x in seen:
            raise ShamirError(
                "duplicate share detected (two shares carry the same "
                "x-coordinate) — each custodian share may be presented once")
        if x == 0:
            raise ShamirError("share has x-coordinate 0 — not a valid share")
        seen.add(x)
        x_samples.append(x)

    for byte_idx in range(len(secret)):
        y_samples = [p[byte_idx] for p in parts]
        secret[byte_idx] = _interpolate(x_samples, y_samples, 0)

    return bytes(secret)
