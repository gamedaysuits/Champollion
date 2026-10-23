"""A small client for RunPod's REST API v2 (https://api.runpod.io/v2; checked
against docs.runpod.io 2026-10-14): the catalog (GPU types with live Secure
Cloud prices, datacentres) and pods (create, read, list, terminate).

Every request is bounded (30 s, at most 3 tries on a rate limit, a server
error or a dropped connection). The key goes in the Authorization header and
nowhere else; errors carry RunPod's own title and detail, never the key.
``send`` is injectable so tests run against a fake RunPod.
"""

from __future__ import annotations

import json
import time
import urllib.error
import urllib.parse
import urllib.request

from ..errors import ForgeError

BASE = "https://api.runpod.io/v2"
TIMEOUT_S = 30
TRIES = 3
#: pods forge creates carry this prefix, so `remote status` finds its own
POD_PREFIX = "nmt-forge-"


class RunPodError(ForgeError):
    """RunPod refused or failed a request (status, title, detail; never the key)."""

    def __init__(self, status: int, what: str, detail: str = ""):
        self.status = status
        hint = ""
        if status in (401, 403):
            hint = ("\n  fix: check the key in .env.local (RUNPOD_API_KEY) on the RunPod console's API keys page; "
                    "it needs read and write access to pods")
        elif status == 429:
            hint = "\n  fix: RunPod is rate-limiting this account; wait a minute and run the command again"
        super().__init__(f"RunPod: {what} failed ({status}){': ' + detail if detail else ''}{hint}")


def _urllib_send(method: str, url: str, headers: dict, body: bytes | None, timeout: float):
    req = urllib.request.Request(url, data=body, method=method, headers=headers)
    try:
        with urllib.request.urlopen(req, timeout=timeout) as r:
            raw = r.read()
            return r.status, (json.loads(raw) if raw else None)
    except urllib.error.HTTPError as e:
        raw = e.read() or b""
        try:
            doc = json.loads(raw) if raw else None
        except ValueError:
            doc = {"detail": raw[:300].decode("utf-8", "replace")}
        return e.code, doc


class RunPod:
    def __init__(self, key, *, base: str = BASE, send=None, sleep=time.sleep):
        self._key = key                      # a keys.Secret
        self.base = base.rstrip("/")
        self._send = send or _urllib_send
        self._sleep = sleep

    # -- plumbing -----------------------------------------------------------
    def _call(self, method: str, path: str, what: str, *, query: dict | None = None, body: dict | None = None,
              ok=(200,)):
        url = self.base + path + ("?" + urllib.parse.urlencode(query) if query else "")
        headers = {"Authorization": f"Bearer {self._key.reveal()}", "Accept": "application/json"}
        data = None
        if body is not None:
            headers["Content-Type"] = "application/json"
            data = json.dumps(body).encode("utf-8")
        last = None
        for attempt in range(TRIES):
            try:
                status, doc = self._send(method, url, headers, data, TIMEOUT_S)
            except (urllib.error.URLError, TimeoutError, ConnectionError, OSError) as e:
                last = RunPodError(0, what, f"no answer ({type(e).__name__})")
            else:
                if status in ok:
                    return doc
                detail = ""
                if isinstance(doc, dict):
                    detail = " — ".join(str(doc[k]) for k in ("title", "detail", "error", "message") if doc.get(k))
                last = RunPodError(status, what, detail)
                if status not in (429, 500, 502, 503, 504):
                    raise last
            if attempt < TRIES - 1:
                self._sleep(2 * 2 ** attempt)
        raise last

    # -- the catalog --------------------------------------------------------
    def gpus(self, *, countries: list[str] | None = None) -> list[dict]:
        """GPU types for pods on Secure Cloud, with availability (and the
        datacentres that have each) in ``countries`` when given."""
        q = {"include": "AVAILABILITY", "product": "POD", "cloud": "SECURE"}
        if countries:
            q["countryCodes"] = ",".join(c.upper() for c in countries)
        doc = self._call("GET", "/catalog/gpus", "listing GPU types", query=q)
        return list((doc or {}).get("gpus") or (doc if isinstance(doc, list) else []))

    def datacenters(self) -> list[dict]:
        doc = self._call("GET", "/catalog/datacenters", "listing datacentres", query={"include": "GPU_AVAILABILITY"})
        return list((doc or {}).get("dataCenters") or (doc if isinstance(doc, list) else []))

    # -- pods ---------------------------------------------------------------
    def create_pod(self, spec: dict) -> dict:
        return self._call("POST", "/pods", "starting a machine", body=spec, ok=(200, 201))

    def get_pod(self, pod_id: str) -> dict | None:
        """The pod, or None once it no longer exists."""
        try:
            return self._call("GET", f"/pods/{urllib.parse.quote(pod_id)}", "reading a machine")
        except RunPodError as e:
            if e.status == 404:
                return None
            raise

    def list_pods(self) -> list[dict]:
        doc = self._call("GET", "/pods", "listing machines")
        if isinstance(doc, list):
            return doc
        return list((doc or {}).get("pods") or (doc or {}).get("data") or [])

    def terminate_pod(self, pod_id: str) -> None:
        """Terminate (delete) a pod. Already gone counts as done."""
        try:
            self._call("DELETE", f"/pods/{urllib.parse.quote(pod_id)}", "shutting a machine down", ok=(200, 202, 204))
        except RunPodError as e:
            if e.status != 404:
                raise


def secure_price(gpu: dict) -> float | None:
    """A GPU type's Secure Cloud price, USD an hour per GPU, or None."""
    p = (gpu.get("price") or {}).get("secure")
    try:
        return float(p) if p is not None else None
    except (TypeError, ValueError):
        return None


def available_datacenters(gpu: dict) -> list[str]:
    """Datacentre ids where this GPU type is available (not NONE)."""
    return [d["id"] for d in gpu.get("dataCenters") or []
            if d.get("id") and str(d.get("availability") or "").upper() not in ("", "NONE")]
