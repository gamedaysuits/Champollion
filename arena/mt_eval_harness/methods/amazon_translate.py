"""
AmazonTranslateMethod — AWS Translate adapter (boto3 / SigV4).

AWS Translate is a neural MT engine. Unlike the other REST adapters it does not
use a simple header key — it uses AWS SigV4 request signing, which boto3 handles
for us. boto3 is an OPTIONAL dependency (the ``[aws]`` extra), lazy-imported so
the core wheel stays slim; a missing boto3 fails loud with an actionable message
rather than silently skipping.

    Client:    boto3.client("translate", region_name=<region>)
    Call:      translate_text(Text=, SourceLanguageCode=, TargetLanguageCode=)
    Auth:      standard AWS credential chain — AWS_ACCESS_KEY_ID /
               AWS_SECRET_ACCESS_KEY (+ AWS_SESSION_TOKEN), region AWS_REGION
    Env:       AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY, AWS_REGION
    Batch:     1 segment / call (real-time translate_text is per-text)
    Response:  resp["TranslatedText"]
    Locale:    ISO 639-1 (en, es, fr, …) read off the card via
               PROVIDER_CODE_FIELD; "auto" allowed for source.
    Cost:      ~$15 / 1M characters; free tier 2M chars/month for 12 months.

boto3 is synchronous, so each call runs in the default executor to honor the
async ``_translate_texts`` contract without blocking the event loop.
"""

from __future__ import annotations

import asyncio

from mt_eval_harness.methods.base_http_mt import (
    HttpMTMethod,
    MTConfigError,
    _env_first,
)


class AmazonTranslateMethod(HttpMTMethod):
    """AWS Translate system-under-test (boto3)."""

    name = "amazon-translate"
    MAX_BATCH = 1  # real-time translate_text takes a single Text

    method_id = "amazon-translate-v1"
    paradigm = "neural-nmt"  # method_class="api" inherited from the base
    # Amazon Translate uses ISO 639-1 codes (en, es, fr, zh, …) — read off the
    # card SSOT via _to_provider_base (base default already "iso639_1").
    PROVIDER_CODE_FIELD = "iso639_1"
    author = "Amazon Web Services"
    description = "Amazon Translate — AWS neural MT, 75+ languages."
    homepage = "https://aws.amazon.com/translate/"
    license = "Proprietary (AWS Service Terms)"
    commercial_ready = True
    cost_note = "~$15 / 1M characters (free tier 2M chars/month for 12 months)"

    # --- Locale mapping ---------------------------------------------------

    @staticmethod
    def _map_locale(code: str) -> str:
        """Amazon uses plain ISO 639-1; pass through (variants handled upstream)."""
        return code

    # --- Credentials ------------------------------------------------------

    def _resolve_credentials(self) -> dict:
        # boto3 reads the access key/secret from the standard AWS credential
        # chain; we only need a region here. Fail loud (not skip) if creds are
        # absent so an AWS run can't silently no-op.
        region = (
            self.options.get("aws_region")
            or _env_first("AWS_REGION", "AWS_DEFAULT_REGION")
        )
        access_key = _env_first("AWS_ACCESS_KEY_ID")
        if not access_key:
            raise MTConfigError(
                "Amazon Translate: no AWS_ACCESS_KEY_ID found. Set AWS_ACCESS_KEY_ID "
                "+ AWS_SECRET_ACCESS_KEY + AWS_REGION (IAM user with "
                "TranslateFullAccess)."
            )
        if not region:
            raise MTConfigError(
                "Amazon Translate: no AWS_REGION/AWS_DEFAULT_REGION set "
                "(e.g. ap-southeast-2)."
            )
        return {"region": region}

    def _client(self, region: str):
        """Build a boto3 translate client (lazy import — optional [aws] extra)."""
        try:
            import boto3  # noqa: PLC0415 - intentional lazy import
        except ImportError as exc:  # pragma: no cover - exercised via message
            raise MTConfigError(
                "Amazon Translate needs boto3. Install the optional extra: "
                "pip install 'mt-eval[aws]'  (or: pip install boto3)."
            ) from exc
        return boto3.client("translate", region_name=region)

    # --- Backend ----------------------------------------------------------

    async def _translate_texts(
        self,
        texts: list[str],
        src: str,
        tgt: str,
        creds: dict,
    ) -> list[str]:
        client = self._client(creds["region"])
        loop = asyncio.get_event_loop()
        source_code = self._map_locale(src)
        target_code = self._map_locale(tgt)

        def _call(text: str) -> str:
            resp = client.translate_text(
                Text=text,
                SourceLanguageCode=source_code,
                TargetLanguageCode=target_code,
            )
            return resp["TranslatedText"]

        out: list[str] = []
        for text in texts:
            # boto3 is sync — run off the event loop so we don't block it.
            out.append(await loop.run_in_executor(None, _call, text))
        return out
