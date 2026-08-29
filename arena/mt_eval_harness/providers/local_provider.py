"""
LocalProvider — OpenAI-compatible local / self-hosted endpoint provider.

Defaults to Ollama (http://localhost:11434/v1). Works with vLLM, LM Studio,
llama.cpp servers, and any OpenAI-compatible gateway (Groq, Together,
Fireworks) by overriding the base_url. Inherits the entire OpenAI-format
``call()`` / retry / message-sanitization logic from OpenAIProvider — the wire
protocol is identical, so there is nothing to reimplement.

Endpoint resolution (most specific wins): constructor ``base_url`` →
``LOCAL_API_BASE`` env → ``OPENAI_API_BASE`` env → Ollama default.

FAIL-HONEST PRICING (load-bearing): ``fetch_pricing()`` returns ``{}`` on
purpose. Local/hosted-compatible token cost is genuinely unknown to the
harness, so every entry's cost resolves to None → the run total surfaces as
UNKNOWN. We must NOT fabricate ``$0`` even though local inference is "free" to
the operator — $0 would unfairly win cost-adjusted rankings and also
misrepresents hosted OpenAI-compatible vendors (Groq et al.) whose token cost
we likewise don't have. (Project rule: never invent pricing.)
"""

from __future__ import annotations

import ipaddress
import os
from urllib.parse import urlparse

import aiohttp

from mt_eval_harness.providers.openai_provider import OpenAIProvider

LOCAL_DEFAULT_BASE = "http://localhost:11434/v1"  # Ollama


class LocalProvider(OpenAIProvider):
    """OpenAI-compatible local / self-hosted provider (Ollama default)."""

    name = "local"
    base_url_env = "OPENAI_API_BASE"
    api_key_env = "OPENAI_API_KEY"

    def __init__(self, base_url: str | None = None) -> None:
        resolved = (
            base_url
            or os.environ.get("LOCAL_API_BASE")
            or os.environ.get(self.base_url_env)
            or LOCAL_DEFAULT_BASE
        )
        # Local servers ignore auth; a real key is used only if one is set.
        super().__init__(base_url=resolved, api_key_required=False)

    def is_loopback_endpoint(self) -> bool:
        """True only when ``base_url`` provably stays on this machine.

        The transmission policy treats a "local" run as one where sealed /
        consent-required corpus text never leaves the machine. The provider
        NAME cannot carry that guarantee — this class accepts any
        ``base_url`` (Groq, Together, ... are documented targets), so the
        policy must ask the ENDPOINT. Accepted: unix sockets, ``localhost``
        (and ``*.localhost``), loopback IPs (127.0.0.0/8, ::1), and the
        unspecified addresses ``0.0.0.0`` / ``::`` (bind-anything, resolves
        to this host as a client target). Everything else — public hosts AND
        LAN/private-range IPs — is not loopback: a LAN box is still another
        machine.
        """
        url = self.base_url
        if url.startswith(("unix:", "http+unix:")):
            return True
        parsed = urlparse(url if "//" in url else f"//{url}")
        host = parsed.hostname
        if not host:
            return False
        if host == "localhost" or host.endswith(".localhost"):
            return True
        try:
            ip = ipaddress.ip_address(host)
        except ValueError:
            return False
        return ip.is_loopback or ip.is_unspecified

    def strip_provider_prefix(self, model_id: str) -> str:
        """Strip a leading ``local/`` but never mangle real local model names.

        Local model ids like ``llama3.1:8b`` or ``Qwen/Qwen2.5-7B-Instruct``
        legitimately contain ``/`` or ``:`` and must pass through verbatim.
        """
        if model_id.startswith("local/"):
            return model_id[len("local/"):]
        return model_id

    async def fetch_pricing(
        self,
        session: aiohttp.ClientSession,
        api_key: str,
    ) -> dict[str, dict[str, float]]:
        # Deliberately empty — see the FAIL-HONEST PRICING note in the module
        # docstring. Unknown model cost → None → run total UNKNOWN, never $0.
        return {}
