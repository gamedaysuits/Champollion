"""service-api/1: `mt-eval serve` answers the shared /translate vectors the
way every server must (nmt-forge serve is held to the same file in forge's
suite). Invented vocabulary only."""

from __future__ import annotations

import json
import threading
from pathlib import Path

import pytest

from mt_eval_harness.framework.service_api import check_body, run_vectors
from mt_eval_harness.serve import ServedMethod, build_server

ROOT = Path(__file__).resolve().parents[2]
VECTORS = ROOT / "shared" / "test-fixtures" / "framework" / "service-api-vectors.json"
BUNDLED = Path(__file__).resolve().parents[1] / "mt_eval_harness" / "data" / "schemas" / "framework"

needs_vectors = pytest.mark.skipif(not VECTORS.is_file(), reason="monorepo shared/ absent")


@pytest.fixture
def serve(tmp_path):
    started = []

    def start(local_only: bool):
        words = tmp_path / "words.tsv"
        words.write_text("house\tmol\nwater\tkef\n", encoding="utf-8")
        side = tmp_path / "words.tsv.champollion.json"
        if local_only:
            side.write_text(json.dumps({"transmission": "local-only"}))
        elif side.exists():
            side.unlink()
        httpd = build_server(ServedMethod("lexicon", model=str(words), source="eng", target="qaa"), port=0)
        threading.Thread(target=httpd.serve_forever, daemon=True).start()
        started.append(httpd)
        return f"http://127.0.0.1:{httpd.server_address[1]}"

    yield start
    for h in started:
        h.shutdown()
        h.server_close()


@needs_vectors
@pytest.mark.parametrize("local_only", [False, True])
def test_mt_eval_serve_follows_service_api_1(serve, local_only):
    vectors = json.loads(VECTORS.read_text(encoding="utf-8"))
    assert len(vectors["cases"]) >= 9, "the vector set shrank"
    failures = run_vectors(serve(local_only), vectors, source="eng", target="qaa", other="fra", word="house")
    assert failures == []


def test_the_checker_catches_what_breaks_the_contract():
    assert check_body({"status": "ok", "pair": "eng→qaa", "output_gates": "none"}, "health") == [
        "$: missing required property 'output_local_only'"]
    assert check_body({"status": "ok", "pair": "eng→qaa", "output_gates": "none",
                       "output_local_only": "yes"}, "health")
    assert check_body({"translations": {"a": 1}, "meta": {}}, "translate_response")
    assert check_body({"error": {"message": ""}}, "error_response")
    with pytest.raises(ValueError, match="unknown service-api/1 part"):
        check_body({}, "nope")


def test_the_bundled_schema_matches_shared():
    name = "service-api.v1.schema.json"
    shared = ROOT / "shared" / "schemas" / "framework" / name
    if not shared.is_file():
        pytest.skip("monorepo shared/ absent (standalone install)")
    assert (BUNDLED / name).read_bytes() == shared.read_bytes(), (
        f"mt_eval_harness/data/schemas/framework/{name} has drifted from "
        f"shared/schemas/framework/{name} — copy it.")
