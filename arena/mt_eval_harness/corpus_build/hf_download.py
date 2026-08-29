# Ported from the internal corpora-builder (founder decision 2026-08-27):
# the fetch-on-miss corpus REBUILD path must work in the open-source harness
# — 5,595 of 5,602 registry corpora are fetch-from-source and corpus content
# is never tracked, so without these primitives a public clone could browse
# the queue and rebuild nothing (docs/PRE_REVIEW_HARDENING_2026-08-27.md).
# The intake/probe/recipe-authoring tooling remains in the private builder;
# this subpackage ships with the harness under the harness's license.
# Byte-parity with the private builder's copy is protected by the per-pair
# sha guards: a divergent rebuild fails loudly at publish, never silently.
"""
Robust, fail-honest HuggingFace gated downloads.

Single home for every HF-sourced gated fetch in the corpus builders. The
download is standardized on the official ``huggingface_hub`` client, lazily
imported so the core wheel stays slim — when ``huggingface_hub`` is absent we
fail with an actionable ``pip install huggingface_hub`` message rather than
silently degrading to a hand-rolled request.

Auth resolves via HuggingFace's standard chain: the ``HF_TOKEN`` env var (plus
the other conventional names and a card-declared ``tokenEnv``), then
``huggingface_hub.get_token()`` (which honours ``huggingface-cli login`` and
``~/.cache/huggingface/token``), then the legacy token files.

The three failure modes a user can actually FIX are DISTINGUISHED in the error
message so the TUI and the agent both know what to tell the user:

  (a) NO token at all          → "set HF_TOKEN or run huggingface-cli login"
  (b) token present but gated  → "accept this dataset's terms at <exact URL>"
  (c) network / other          → transient; check connectivity and retry

Each failure is also a distinct exception subclass carrying a ``.kind`` string
so callers can branch programmatically (e.g. emit machine-readable JSON).
"""

from __future__ import annotations

import hashlib
import os
import shutil
from pathlib import Path

# Conventional HF token env var names. HF_TOKEN is the canonical / default one
# the cards declare via download.tokenEnv.
TOKEN_ENV_VARS = (
    "HF_TOKEN", "HUGGING_FACE_HUB_TOKEN", "HUGGINGFACE_TOKEN", "HF_API_TOKEN",
)
# Legacy on-disk token locations, checked after huggingface_hub.get_token().
TOKEN_FILES = (
    Path.home() / ".cache" / "huggingface" / "token",
    Path.home() / ".huggingface" / "token",
)

DEFAULT_TOKEN_ENV = "HF_TOKEN"


# ---------------------------------------------------------------------------
# Typed errors — each carries a stable .kind for programmatic branching
# ---------------------------------------------------------------------------

class HfDownloadError(RuntimeError):
    """Base class for every fail-honest HuggingFace download error."""

    kind = "error"


class HfHubNotInstalled(HfDownloadError):
    """The official huggingface_hub client is required but not installed."""

    kind = "hub-not-installed"


class HfNoTokenError(HfDownloadError):
    """No HF token could be resolved for a gated dataset (branch a)."""

    kind = "no-token"


class HfGatedTermsError(HfDownloadError):
    """A token was found but the gated repo refused access (branch b).

    Almost always: the dataset's terms have not been accepted on this account.
    """

    kind = "gated-terms"


class HfNetworkError(HfDownloadError):
    """A network / transient failure, unrelated to gating or auth (branch c)."""

    kind = "network"


# ---------------------------------------------------------------------------
# huggingface_hub lazy import
# ---------------------------------------------------------------------------

def _try_import_hub():
    """Return the huggingface_hub module, or None if it isn't installed.

    Isolated in a function so tests can monkeypatch it to simulate an
    environment with / without the client.
    """
    try:
        import huggingface_hub  # noqa: PLC0415
    except Exception:  # pragma: no cover - import guard
        return None
    return huggingface_hub


# ---------------------------------------------------------------------------
# Token resolution — HF's standard chain
# ---------------------------------------------------------------------------

def resolve_hf_token(token_env: str = DEFAULT_TOKEN_ENV) -> str | None:
    """Resolve an HF token via the standard chain, or None if absent.

    Order: the card-declared ``token_env`` and the conventional env names,
    then ``huggingface_hub.get_token()`` (login token / HF_TOKEN_PATH), then
    the legacy on-disk token files. Never raises.
    """
    seen = set()
    for var in (token_env, *TOKEN_ENV_VARS):
        if not var or var in seen:
            continue
        seen.add(var)
        val = os.environ.get(var)
        if val and val.strip():
            return val.strip()

    hub = _try_import_hub()
    if hub is not None:
        try:
            tok = hub.get_token()
            if tok and tok.strip():
                return tok.strip()
        except Exception:  # pragma: no cover - defensive
            pass

    for path in TOKEN_FILES:
        try:
            if path.is_file():
                tok = path.read_text(encoding="utf-8").strip()
                if tok:
                    return tok
        except OSError:  # pragma: no cover - defensive
            pass
    return None


# ---------------------------------------------------------------------------
# Error classification — pure, fully testable without huggingface_hub
# ---------------------------------------------------------------------------

def _is_auth_failure(exc: BaseException) -> bool:
    """True when an HF exception is an auth / gating refusal (401/403)."""
    name = type(exc).__name__
    if name in ("GatedRepoError", "LocalTokenNotFoundError"):
        return True
    resp = getattr(exc, "response", None)
    code = getattr(resp, "status_code", None)
    return code in (401, 403)


def _is_network_failure(exc: BaseException) -> bool:
    """True when an HF exception looks transient / connectivity-related."""
    name = type(exc).__name__
    if name in (
        "ConnectionError", "ConnectTimeout", "ReadTimeout", "Timeout",
        "ConnectTimeoutError", "ReadTimeoutError", "RequestException",
        "OfflineModeIsEnabled",
    ):
        return True
    resp = getattr(exc, "response", None)
    code = getattr(resp, "status_code", None)
    return bool(code and 500 <= code < 600)


def classify_download_failure(
    *,
    token_present: bool,
    repo_id: str,
    terms_url: str | None,
    token_env: str = DEFAULT_TOKEN_ENV,
    network: bool = False,
    detail: str = "",
) -> HfDownloadError:
    """Map a failure into the correct distinct, actionable error.

    Pure function — the single source of truth for which of the three
    branches (no-token / gated-terms / network) a failure belongs to and what
    message it carries. Tested directly without huggingface_hub installed.
    """
    terms_url = terms_url or f"https://huggingface.co/datasets/{repo_id}"
    if network:
        return HfNetworkError(_network_message(repo_id, detail))
    if not token_present:
        return HfNoTokenError(_no_token_message(repo_id, terms_url, token_env))
    return HfGatedTermsError(_gated_terms_message(repo_id, terms_url, token_env))


# ---------------------------------------------------------------------------
# Messages — kept distinctive so they're greppable and unambiguous
# ---------------------------------------------------------------------------

def _no_token_message(repo_id: str, terms_url: str, token_env: str) -> str:
    return (
        f"No HuggingFace token found for gated dataset '{repo_id}'.\n"
        f"  This dataset is GATED — fetching it requires BOTH accepting its "
        f"terms AND an access token:\n"
        f"    1. Sign in at https://huggingface.co and open {terms_url}\n"
        f"    2. Click 'Agree and access repository' to accept the terms.\n"
        f"    3. Create a token at https://huggingface.co/settings/tokens and "
        f"expose it:\n"
        f"         export {token_env}=hf_xxx        (or run `huggingface-cli "
        f"login`)\n"
        f"  Then re-run. This builder never substitutes a different corpus "
        f"when the gated source is unavailable."
    )


def _gated_terms_message(repo_id: str, terms_url: str, token_env: str) -> str:
    return (
        f"HuggingFace token found, but the download of gated dataset "
        f"'{repo_id}' was refused (HTTP 401/403).\n"
        f"  For a gated dataset this almost always means the terms have not "
        f"been accepted on THIS account yet:\n"
        f"    → Open {terms_url} and click 'Agree and access repository'.\n"
        f"  If you have already accepted the terms, your {token_env} may be "
        f"invalid or missing read scope — regenerate it at "
        f"https://huggingface.co/settings/tokens and re-export it."
    )


def _network_message(repo_id: str, detail: str) -> str:
    tail = f" ({detail})" if detail else ""
    return (
        f"Network error fetching gated dataset '{repo_id}' from "
        f"HuggingFace{tail}.\n"
        f"  This is usually transient — check your connection and retry. "
        f"(Your token and terms acceptance are not the problem here.)"
    )


def _hub_not_installed_message(repo_id: str) -> str:
    return (
        f"The official 'huggingface_hub' client is required to fetch gated "
        f"dataset '{repo_id}', but it is not installed.\n"
        f"  Install it:  pip install huggingface_hub\n"
        f"  (or:         pip install 'mt-eval[hf]')"
    )


def _sha_mismatch_message(
    repo_id: str, filename: str, expected: str, actual: str,
) -> str:
    return (
        f"HuggingFace download sha mismatch for {repo_id}:{filename}:\n"
        f"  Expected: {expected}\n"
        f"  Got:      {actual}\n"
        f"  Upstream may have changed since the card was pinned — re-verify "
        f"the card's download.sha256."
    )


def _sha256_file(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


# ---------------------------------------------------------------------------
# The download entry point
# ---------------------------------------------------------------------------

def download_gated_file(
    *,
    repo_id: str,
    filename: str,
    dest_dir: Path,
    dest_name: str | None = None,
    repo_type: str = "dataset",
    terms_url: str | None = None,
    token_env: str = DEFAULT_TOKEN_ENV,
    expected_sha256: str | None = None,
    revision: str = "main",
) -> Path:
    """Download (and cache) one file from a GATED HuggingFace repo.

    Caches into ``dest_dir`` for offline reuse + sha verification (a cached
    file that still matches ``expected_sha256`` is returned without any
    network or token at all). Fail-honest: every failure raises a typed
    :class:`HfDownloadError` whose message distinguishes the three fixable
    modes (no token / terms-not-accepted / network).

    Raises:
        HfNoTokenError, HfGatedTermsError, HfNetworkError, HfHubNotInstalled
        ValueError: on a post-download sha mismatch.
    """
    dest_dir = Path(dest_dir)
    dest_dir.mkdir(parents=True, exist_ok=True)
    dest_name = dest_name or filename.split("/")[-1]
    local = dest_dir / dest_name
    terms_url = terms_url or f"https://huggingface.co/datasets/{repo_id}"

    # Offline reuse — a cached, still-valid artifact needs neither token nor
    # network. A cached-but-stale artifact is dropped and re-fetched.
    if local.exists():
        if not expected_sha256 or _sha256_file(local) == expected_sha256:
            return local
        local.unlink()

    # Branch (a): no token at all — detectable WITHOUT huggingface_hub, so a
    # tokenless user gets the right message even on a slim install.
    token = resolve_hf_token(token_env)
    if not token:
        raise classify_download_failure(
            token_present=False, repo_id=repo_id, terms_url=terms_url,
            token_env=token_env,
        )

    hub = _try_import_hub()
    if hub is None:
        raise HfHubNotInstalled(_hub_not_installed_message(repo_id))

    try:
        src = hub.hf_hub_download(
            repo_id=repo_id,
            filename=filename,
            repo_type=repo_type,
            revision=revision,
            token=token,
        )
    except Exception as exc:  # noqa: BLE001 - re-classified into typed errors
        if _is_network_failure(exc):
            raise classify_download_failure(
                token_present=True, repo_id=repo_id, terms_url=terms_url,
                token_env=token_env, network=True, detail=str(exc),
            ) from exc
        if _is_auth_failure(exc):
            # Branch (b): token present but the gated repo refused us.
            raise classify_download_failure(
                token_present=True, repo_id=repo_id, terms_url=terms_url,
                token_env=token_env,
            ) from exc
        # Unknown HF/HTTP error — treat as transient/other so we never claim a
        # gating problem we can't substantiate.
        raise classify_download_failure(
            token_present=True, repo_id=repo_id, terms_url=terms_url,
            token_env=token_env, network=True, detail=str(exc),
        ) from exc

    # Copy out of HF's cache into our dest_dir for locality, sha verification,
    # and future offline reuse.
    shutil.copyfile(src, local)

    if expected_sha256:
        actual = _sha256_file(local)
        if actual != expected_sha256:
            local.unlink()
            raise ValueError(
                _sha_mismatch_message(repo_id, filename, expected_sha256, actual)
            )
    return local
