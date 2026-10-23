"""Plan, run and tear down one training run on a rented machine.

``plan_remote`` spends nothing: it runs forge's own pre-run checks HERE
(``advisor.preflight``: the dev fence, the leak audit against every test
set, the mix gates), checks every file's yes (``consent``), reads the live
Secure Cloud prices and the datacentres in the agreed countries, and says
what the run would cost at most.

``run_remote`` then, every step bounded and the machine always shut down:

  1. a fresh SSH key; the run lock; a ``remote-start`` ledger record
     (file hashes, never text);
  2. starts a pod (Secure Cloud, the agreed datacentres, no volume);
     a pod placed anywhere else is shut down unused;
  3. sends the bundle (forge + the harness as source, the training files
     and the dev set with their sidecars — never a test set), installs the
     pinned packages, starts ``pod_main``;
  4. watches its heartbeat and the cost: past the cap less a margin it asks
     forge there to stop (forge keeps the best checkpoint so far); at the cap
     it shuts the machine down; a STOP here is passed there;
  5. brings back the run folder (the selected checkpoint, manifest, report,
     dev outputs), wipes the job folder there, terminates the pod and checks
     it is gone; a ``remote-end`` record says what happened and what it cost.

The run's folder and identity are the LOCAL ones (config + training files'
hashes + dev set), so a remote run compares with local runs on the rails.
"""

from __future__ import annotations

import importlib.metadata as md
import json
import re
import shutil
import signal
import tarfile
import tempfile
import time
from pathlib import Path

from .. import _harness
from ..errors import RemoteComputeRefused
from ..monitor import clear_remote_progress
from .consent import KEY as CONSENT_KEY
from .consent import require_consent
from .runpod import POD_PREFIX, RunPodError, available_datacenters, secure_price

PROVIDER = "runpod"
#: what a remote run is, said wherever it shows (plan, run, manifest, ledger):
#: the sentences go to a rented machine, under the people's yes per file —
#: not forge's sovereign default, where nothing leaves this computer
SOVEREIGNTY = "semi-sovereign"
SOVEREIGNTY_TEXT = ("semi-sovereign: the training sentences go to a machine rented from RunPod (its own "
                    "datacentres, in the countries agreed), each file only with the people's typed yes; the test "
                    "sets never leave this computer; the machine is wiped and shut down at the end")
#: RunPod's PyTorch image (Docker Hub runpod/pytorch, tagged 2026-09-30):
#: CUDA 12.8.1, torch 2.13, Ubuntu 22.04; it installs $PUBLIC_KEY for ssh
IMAGE = "runpod/pytorch:1.4.0-cu1281-torch2130-ubuntu2204"
MIN_CUDA = "12.8"
JOB = "/root/nmtf"
DISK_GB = 50                 # the least a machine gets; larger models get what they need
#: what the rented disk holds besides the model: a PyTorch that fits the
#: driver when the image's does not, forge's packages, the data, the logs
DISK_OVERHEAD_GB = 15
DEFAULT_COUNTRIES = ("CA",)
DEFAULT_MIN_GPU_GB = 24
SETUP_HOURS = 0.5            # start, install, send, fetch, wipe: added to the estimate
STARTUP_S = 20 * 60          # a pod running and reachable by ssh
INSTALL_S = 30 * 60
POLL_S = 30
#: separates the parts of the one watch command's answer (a run name may hold "---")
WATCH_SEP = "@@nmt-forge-watch@@"
STALL_S = 30 * 60            # no heartbeat progress for this long: stalled
STOP_GRACE_S = 15 * 60       # after asking forge there to stop
GONE_S = 120                 # terminate → no longer listed
#: forge's run options a remote run cannot carry yet (they read files or
#: plugins that live only on this computer)
UNSUPPORTED = {
    "curriculum": "a curriculum (several stages)",
    "model.init_from": "starting from an earlier checkpoint (model.init_from)",
    "selection.plugins": "selection plugins (selection.plugins)",
    "selection.auto_plugins": "language plugins (selection.auto_plugins)",
    "mix.validator": "a target-validity gate (mix.validator)",
    "decode.hook": "a decode hook (decode.hook)",
    "data.monolingual": "monolingual text (data.monolingual)",
}


# -- what a run would send ---------------------------------------------------------
def _resolve(path: str, ws) -> Path:
    q = Path(path).expanduser()
    if not q.is_absolute():
        q = q if q.exists() else ws.root.parent / q
    return q.resolve()


def _unsupported(cfg) -> list[str]:
    raw = cfg.raw
    found = []
    for key, what in UNSUPPORTED.items():
        node = raw
        for part in key.split("."):
            node = node.get(part) if isinstance(node, dict) else None
        if node:
            found.append(what)
    return found


def _load(config_path):
    from ..training.config import RunConfig
    from ..workspace import Workspace

    cfg = RunConfig.from_file(config_path)
    ws = Workspace(cfg.workspace)
    return cfg, ws


def _sendable_files(cfg, ws) -> tuple[list[Path], list[Path], dict, Path]:
    gold = [_resolve(g, ws) for g in cfg.gold]
    lanes = [_resolve(l.path, ws) for l in cfg.synthetic]
    entry = ws.registry.get(cfg.dev)
    dev = _resolve(entry["path"], ws)
    return gold, lanes, entry, dev


def _model_gb(base: str) -> tuple[float | None, float | None, str]:
    """(one checkpoint, the download), in GB, for a Hugging Face base — from
    its config alone, counted on PyTorch's "meta" device: no weights are read
    or fetched here. (None, None, why) when that cannot be known."""
    try:
        import torch
        from transformers import AutoConfig, AutoModelForSeq2SeqLM

        conf = AutoConfig.from_pretrained(base)
        with torch.device("meta"):
            params = sum(p.numel() for p in AutoModelForSeq2SeqLM.from_config(conf).parameters())
    except Exception as e:                       # noqa: BLE001 — unknown size is said, never guessed
        return None, None, f"the size of {base!r} is not known here ({type(e).__name__})"
    ckpt = params * 4 / 1024 ** 3                # forge's checkpoints hold fp32 weights
    download = ckpt
    try:                                         # a sharded base names its own size
        from huggingface_hub import try_to_load_from_cache

        for idx in ("model.safetensors.index.json", "pytorch_model.bin.index.json"):
            hit = try_to_load_from_cache(base, idx)
            if isinstance(hit, str):
                total = (json.loads(Path(hit).read_text(encoding="utf-8")).get("metadata") or {}).get("total_size")
                if total:
                    download = max(download, int(total) / 1024 ** 3)
                break
    except Exception:                            # noqa: BLE001 — the fp32 size stands in
        pass
    return round(ckpt, 1), round(download, 1), f"{params / 1e6:,.0f}M parameters (counted from its config)"


def disk_plan(cfg) -> dict:
    """The rented disk a run needs: the base as downloaded, the checkpoints
    training keeps at once (save_total_limit, plus the one being written) and
    the packages. 2026-10-15: every machine got 50 GB whatever the model — a
    3B base (13 GB a checkpoint, 17 GB to download) would have filled it
    mid-save, losing the run it was paying for. ``model.remote_disk_gb`` asks
    for more; asking for less than the need is refused."""
    import math

    ckpt, download, basis = _model_gb(str(cfg.model.get("base") or ""))
    kept = int(cfg.model.get("save_total_limit", 4))
    need = (math.ceil((download + (kept + 1) * ckpt + DISK_OVERHEAD_GB) / 10) * 10
            if ckpt is not None else None)
    asked = cfg.model.get("remote_disk_gb")
    if asked is not None and need is not None and int(asked) < need:
        raise RemoteComputeRefused(
            f"model.remote_disk_gb is {int(asked)}, but this run needs about {need} GB there",
            why=f"{basis}: about {ckpt} GB a checkpoint, {kept + 1} at once while training, {download} GB to "
                f"download the base, {DISK_OVERHEAD_GB} GB of packages; a disk that fills mid-save loses the run",
            fix=f"leave model.remote_disk_gb out (forge sizes it) or set it to {need} or more")
    gb = int(asked) if asked is not None else max(DISK_GB, need or 0)
    return {"gb": gb, "need_gb": need, "checkpoint_gb": ckpt, "download_gb": download,
            "checkpoints_at_once": kept + 1,
            "basis": basis if need is not None else basis + f"; {gb} GB, the default"}


def _preflight_failures(ws, config_path) -> list[dict]:
    from ..advisor import preflight

    return [g.to_json() for g in preflight(ws, "run", config_path) if not g.ok]


def plan_remote(config_path, *, client, countries=DEFAULT_COUNTRIES, gpu: str | None = None,
                min_gpu_gb: int = DEFAULT_MIN_GPU_GB, max_cost: float | None = None) -> dict:
    """Everything a remote run would do and cost; spends nothing. Refuses
    (RemoteComputeRefused) when a check fails."""
    countries = [c.upper() for c in countries]
    cfg, ws = _load(config_path)
    missing = _unsupported(cfg)
    if missing:
        raise RemoteComputeRefused(
            "this run uses " + ", ".join(missing) + ", which a remote run cannot carry yet",
            why="those options read files or plugins that live only on this computer",
            fix="train it here (nmt-forge run without --remote), or leave those options out of the config")
    failed = _preflight_failures(ws, config_path)
    if failed:
        raise RemoteComputeRefused(
            f"the pre-run checks fail ({', '.join(f['gate'] for f in failed)}): nothing is sent until they pass",
            why="the dev fence and the leak audit against the test sets run HERE, because the test sets never "
                "leave; a run they would refuse here is not sent elsewhere",
            fix=failed[0].get("fix") or "nmt-forge preflight run --config " + str(config_path),
            details={"gates": failed})
    gold, lanes, dev_entry, dev = _sendable_files(cfg, ws)
    checks = require_consent([*gold, *lanes, dev], provider=PROVIDER, countries=countries)

    gpus = client.gpus(countries=countries)
    fits = []
    for g in gpus:
        price, dcs = secure_price(g), available_datacenters(g)
        if price is None or not dcs or not g.get("secure", True):
            continue
        if gpu and gpu not in (g.get("id"), g.get("name")):
            continue
        if not gpu and int(g.get("memory") or 0) < min_gpu_gb:
            continue
        fits.append({"id": g["id"], "name": g.get("name"), "memory_gb": g.get("memory"), "usd_per_hour": price,
                     "datacenters": dcs})
    if not fits:
        raise RemoteComputeRefused(
            f"no {'GPU ' + repr(gpu) if gpu else f'GPU with {min_gpu_gb} GB or more'} is available on RunPod's "
            f"Secure Cloud in {', '.join(countries)} right now",
            why="the run goes only where the people agreed, and only to RunPod's own datacentres",
            fix="try again later, choose another GPU (nmt-forge remote doctor lists them), or train here")
    choice = min(fits, key=lambda f: f["usd_per_hour"])
    hours = float(cfg.model.get("time_budget_hours") or 6)
    most = round(choice["usd_per_hour"] * (hours + SETUP_HOURS), 2)
    if max_cost is not None and max_cost < choice["usd_per_hour"] * SETUP_HOURS:
        raise RemoteComputeRefused(
            f"a cap of ${max_cost:.2f} does not cover even starting the machine "
            f"(${choice['usd_per_hour']:.2f} an hour; setting up takes about {SETUP_HOURS:g} h)",
            fix=f"a cap of at least ${choice['usd_per_hour'] * (SETUP_HOURS + 1):.2f}, or train here")
    return {
        "sovereignty": SOVEREIGNTY, "sovereignty_text": SOVEREIGNTY_TEXT,
        "provider": PROVIDER, "cloud": "SECURE", "countries": countries, "image": IMAGE,
        "gpu": choice, "other_gpus": [f for f in fits if f is not choice][:5],
        "time_budget_hours": hours, "most_usd": most, "cap_usd": max_cost,
        "stops_early_at_cap": bool(max_cost is not None and most > max_cost),
        "files": [{"file": Path(c["file"]).name, "sha256": c["sha256"], "granted_by": c.get("granted_by"),
                   "role": "dev" if Path(c["file"]) == dev else "train"} for c in checks],
        "never_sent": "the test sets (scored here, on the model that comes back)",
        "disk": disk_plan(cfg),
        "returns": "the selected checkpoint and the run's records" + (
            " (weights in bf16)" if cfg.model.get("remote_return_dtype") == "bf16" else ""),
    }


# -- the bundle ---------------------------------------------------------------------
_SAFE = re.compile(r"[^A-Za-z0-9._-]+")


def _safe(name: str) -> str:
    return _SAFE.sub("_", name)[:120] or "file"


def _requirements() -> list[str]:
    """forge's [hf] and the harness's dependencies, as forge declares them.

    Not pinned to this computer's versions: on 2026-10-14 the first real run's
    pins pulled a newer PyTorch onto the machine, built for a newer CUDA than
    its driver, and training fell to the CPU (~25 s a step on a GPU billed by
    the hour). The machine's own GPU build of PyTorch is held by a constraints
    file at install time (``INSTALL``), pip picks the rest within these
    ranges, and the versions installed are recorded with the run."""
    import tomllib

    def from_pyproject(path: Path, extras=()) -> list[str]:
        doc = tomllib.loads(path.read_text(encoding="utf-8"))["project"]
        out = list(doc.get("dependencies") or [])
        for e in extras:
            out += (doc.get("optional-dependencies") or {}).get(e) or []
        return out

    import nmt_forge

    harness_dir = Path(_harness.load_harness().__file__).resolve().parent
    specs = []
    for name, pyproject, extras in (("nmt-forge", Path(nmt_forge.__file__).resolve().parents[1] / "pyproject.toml",
                                     ("hf",)),
                                    ("mt-eval-harness", harness_dir.parent / "pyproject.toml", ())):
        if pyproject.is_file():
            specs += from_pyproject(pyproject, extras)
        else:
            for r in md.requires(name) or []:
                req, _, marker = r.partition(";")
                if not marker.strip() or any(f'extra == "{e}"' in marker for e in extras):
                    specs.append(req.strip())
    out, seen = [], set()
    for s in specs:
        m = re.match(r"\s*([A-Za-z0-9_.-]+)", s)
        if not m:
            continue
        name = m.group(1).lower().replace("_", "-")
        if name in seen or name in ("torch", "nmt-forge", "mt-eval-harness"):
            continue
        seen.add(name)
        out.append(s.strip())
    return out


#: what runs on the machine before training (sent in the bundle as install.sh).
#: A PyTorch the GPU's driver can run, then forge's packages AROUND it:
#: - keep the image's PyTorch when its CUDA is no newer than the driver's and it sees the GPU;
#: - else install the newest PyTorch build for a CUDA the driver supports (PyTorch's own index);
#: - hold that version (read from PyTorch itself — `pip freeze` lists a wheel
#:   installed from a URL as "torch @ https://…", which a "torch==" pattern
#:   missed on 2026-10-14's second real run) while forge's packages install;
#: - record every version installed.
INSTALL_SH = r"""#!/usr/bin/env bash
set -euo pipefail
cd {job}
drv=$(nvidia-smi 2>/dev/null | sed -n 's/.*CUDA Version: *\([0-9][0-9]*\)\.\([0-9]\).*/\1\2/p' | head -1)
[ -n "$drv" ] || {{ echo "no NVIDIA driver visible (nvidia-smi)"; exit 3; }}
have=$(python3 -c "import torch; print(torch.version.cuda or '')" 2>/dev/null | tr -d . || true)
if [ -z "$have" ] || [ "$have" -gt "$drv" ] || \
   ! python3 -c "import sys, torch; sys.exit(0 if torch.cuda.is_available() else 1)" 2>/dev/null; then
  tag=""
  for t in 130 128 126 124 121 118; do if [ "$drv" -ge "$t" ]; then tag=$t; break; fi; done
  [ -n "$tag" ] || {{ echo "the GPU driver's CUDA ($drv) is older than any PyTorch build forge installs"; exit 3; }}
  python3 -m pip install --no-cache-dir -q --upgrade torch --index-url "https://download.pytorch.org/whl/cu$tag"
fi
python3 -c "import torch; print('torch==' + torch.__version__)" > constraints.txt
python3 -m pip install --no-cache-dir -q -c constraints.txt -r requirements.txt
python3 -m pip freeze > versions.txt
""".format(job=JOB)
INSTALL = f"bash {JOB}/install.sh"
#: …and refuse before training unless PyTorch can use the GPU being paid for
#: …and measure what it delivers: bf16 matrix multiply, TFLOPS (an A40 gives
#: ~100+, an H100 ~500+); under MIN_TFLOPS forge refuses before training
GPU_PROBE = ("python3 -c \"import time, torch; x = torch.randn(4096, 4096, device='cuda', dtype=torch.bfloat16); "
             "[x @ x for _ in range(3)]; torch.cuda.synchronize(); t = time.time(); "
             "[x @ x for _ in range(50)]; torch.cuda.synchronize(); "
             "print(round(50 * 2 * 4096 ** 3 / (time.time() - t) / 1e12, 1))\"")
MIN_TFLOPS = 20.0
GPU_CHECK = ("python3 -c \"import sys, torch; ok = torch.cuda.is_available(); "
             "print(torch.__version__, torch.version.cuda, ok); sys.exit(0 if ok else 3)\"")


def build_bundle(cfg, ws, folder: Path) -> tuple[Path, dict]:
    """The tar.gz sent to the pod, and the job spec in it. Content: forge and
    the harness as source, the training files and the dev set (each with
    its sidecar), job.json, requirements.txt."""
    import nmt_forge

    root = folder / "bundle"
    (root / "data").mkdir(parents=True)
    ignore = shutil.ignore_patterns("__pycache__", "*.pyc", "tests")
    shutil.copytree(Path(nmt_forge.__file__).resolve().parent, root / "src" / "forge" / "nmt_forge", ignore=ignore)
    shutil.copytree(Path(_harness.load_harness().__file__).resolve().parent,
                    root / "src" / "arena" / "mt_eval_harness", ignore=ignore)
    gold, lanes, dev_entry, dev = _sendable_files(cfg, ws)

    def put(src: Path, name: str) -> str:
        shutil.copy2(src, root / "data" / name)
        side = Path(str(src) + ".champollion.json")
        if side.is_file():
            # the file's terms travel with it (forge there records what the model
            # trained on); the record of who said yes stays here
            terms = json.loads(side.read_text(encoding="utf-8"))
            terms.pop(CONSENT_KEY, None)
            (root / "data" / (name + ".champollion.json")).write_text(json.dumps(terms, indent=2), encoding="utf-8")
        return f"data/{name}"

    raw = json.loads(json.dumps(cfg.raw))
    data = raw.setdefault("data", {})
    data["gold"] = [put(p, f"gold{i}-{_safe(p.name)}") for i, p in enumerate(gold)]
    data["synthetic"] = [{**lane_raw, "path": put(p, f"lane{i}-{_safe(p.name)}")}
                         for i, (lane_raw, p) in enumerate(zip(data.get("synthetic") or [], lanes))]
    raw.pop("eval", None)                     # scoring on the test sets happens here, never there
    # model.remote_return_dtype "bf16": the chosen checkpoint comes back at half
    # the size (a 3B model's 13 GB of fp32 weights → 6.5 GB) for decoding here
    spec = {"run_name": cfg.run_name, "config": raw, "return_dtype": cfg.model.get("remote_return_dtype"),
            "dev": {"name": cfg.dev, "file": put(dev, f"dev-{_safe(dev.name)}"),
                    "source_field": dev_entry.get("source_field", "source"),
                    "target_field": dev_entry.get("target_field", "target")}}
    (root / "job.json").write_text(json.dumps(spec, indent=2), encoding="utf-8")
    (root / "requirements.txt").write_text("\n".join(_requirements()) + "\n", encoding="utf-8")
    (root / "install.sh").write_text(INSTALL_SH, encoding="utf-8")
    tgz = folder / "nmtf.tgz"
    with tarfile.open(tgz, "w:gz") as t:
        t.add(root, arcname=".")
    return tgz, spec


# -- the run ------------------------------------------------------------------------
def _ssh_endpoint(pod: dict) -> tuple[str, int] | None:
    direct = (pod.get("ssh") or {}).get("direct") or {}
    if direct.get("host") and direct.get("port"):
        return str(direct["host"]), int(direct["port"])
    for p in ((pod.get("runtime") or {}).get("ports") or []):
        if int(p.get("private") or p.get("privatePort") or 0) == 22 and p.get("ip") and p.get("public"):
            return str(p["ip"]), int(p["public"])
    return None


class _Stopped(Exception):
    pass


def run_remote(config_path, *, plan: dict, client, max_cost: float, key_factory=None, transport_factory=None,
               now=time.monotonic, sleep=time.sleep, say=None) -> dict:
    """Train ``config_path`` on a rented machine per ``plan`` (plan_remote's),
    never past ``max_cost`` USD. Returns the local run manifest."""
    # every line at once, even into a log file: a remote run is watched by its log
    say = say or (lambda s: print(s, flush=True))
    from ..runlock import run_lock
    from ..training import heartbeat
    from ..training.run import run_identity
    from .ssh import EphemeralKey, Transport

    key_factory = key_factory or EphemeralKey
    transport_factory = transport_factory or Transport
    cfg, ws = _load(config_path)
    identity = run_identity(cfg, ws)
    run_dir = ws.runs_dir / f"{cfg.run_name}-{identity['id'][:8]}"
    if (run_dir / "run-manifest.json").is_file():
        raise RemoteComputeRefused(f"this run already exists: {run_dir}",
                                   fix="add or change the training data, or change the config")
    price = float(plan["gpu"]["usd_per_hour"])
    state = {"pod": None, "t0": None, "usd_per_hour": price, "outcome": "not started", "fetched": False,
             "wiped": False, "terminated": False, "reason": ""}

    def spent() -> float:
        return 0.0 if state["t0"] is None else state["usd_per_hour"] * (now() - state["t0"]) / 3600

    def on_term(signum, frame):
        raise _Stopped("stopped (signal)")

    try:                           # a SIGTERM (a job's stop) ends the run through the teardown below
        old_term = signal.signal(signal.SIGTERM, on_term)
    except ValueError:             # not the main thread: the caller owns signals
        old_term = None
    key = transport = None
    tmp = Path(tempfile.mkdtemp(prefix="nmt-forge-remote-"))
    try:
        with run_lock(ws, run_name=cfg.run_name, run_dir=run_dir, config_hash=cfg.hash(), config_path=config_path):
            run_dir.mkdir(parents=True, exist_ok=True)
            heartbeat.beat("remote: preparing", force=True, run_dir=str(run_dir))
            tgz, spec = build_bundle(cfg, ws, tmp)
            ws.ledger.append("remote-start", sovereignty=SOVEREIGNTY, provider=PROVIDER, cloud="SECURE",
                             gpu=plan["gpu"]["id"],
                             usd_per_hour=price, cap_usd=max_cost, countries=plan["countries"],
                             datacenters=plan["gpu"]["datacenters"], run=run_dir.name,
                             files=[{"file": f["file"], "sha256": f["sha256"], "role": f["role"]}
                                    for f in plan["files"]])
            key = key_factory()
            pod_name = (POD_PREFIX + _safe(f"{cfg.run_name}-{identity['id'][:8]}"))[:60]
            say(f"starting a {plan['gpu']['name'] or plan['gpu']['id']} on RunPod Secure Cloud "
                f"({', '.join(plan['gpu']['datacenters'])}; ${price:.2f} an hour; cap ${max_cost:.2f})")
            pod = client.create_pod({"name": pod_name, "image": plan["image"], "cloud": "SECURE",
                                     "gpu": {"id": plan["gpu"]["id"], "count": 1, "minCudaVersion": MIN_CUDA},
                                     "dataCenterIds": plan["gpu"]["datacenters"],
                                     "disk": int(plan["disk"]["gb"]),
                                     "ports": ["22/tcp"],
                                     "env": {"PUBLIC_KEY": key.public, "SSH_PUBLIC_KEY": key.public}})
            state["pod"], state["t0"] = pod["id"], now()
            if pod.get("cost"):
                state["usd_per_hour"] = float(pod["cost"])
            # -- running, reachable, and where it was agreed ----------------------
            end = now() + STARTUP_S
            endpoint = None
            while True:
                pod = client.get_pod(state["pod"]) or {}
                if pod.get("status") in ("ERROR", "TERMINATED", "EXITED"):
                    raise RemoteComputeRefused(f"the machine did not start ({pod.get('status')})",
                                               fix="try again, or another GPU")
                if pod.get("status") == "RUNNING":
                    endpoint = _ssh_endpoint(pod)
                    if endpoint:
                        break
                if now() > end:
                    raise RemoteComputeRefused(f"the machine was not reachable within {STARTUP_S // 60} minutes",
                                               fix="try again later, or another GPU")
                sleep(10)
            where = pod.get("dataCenterId")
            if where not in plan["gpu"]["datacenters"]:
                raise RemoteComputeRefused(
                    f"RunPod placed the machine in {where!r}, outside the datacentres agreed "
                    f"({', '.join(plan['gpu']['datacenters'])}): it was shut down before anything was sent",
                    why="the people agreed to these places only")
            if pod.get("cost"):
                state["usd_per_hour"] = float(pod["cost"])
            # -- send, install, start ---------------------------------------------------
            transport = transport_factory(key, *endpoint)
            heartbeat.beat("remote: sending", force=True, run_dir=str(run_dir))
            transport.run(f"mkdir -p {JOB}", timeout=60)
            transport.put(tgz, f"{JOB}.tgz")
            transport.run(f"tar -xzf {JOB}.tgz -C {JOB} && rm -f {JOB}.tgz", timeout=300)
            say("sent; installing forge's packages there")
            heartbeat.beat("remote: installing", force=True, run_dir=str(run_dir))
            transport.run(INSTALL, timeout=INSTALL_S)
            gpu = transport.run(GPU_CHECK, timeout=120, check=False)
            if gpu.returncode != 0:
                raise RemoteComputeRefused(
                    f"the rented machine's GPU is not usable by PyTorch there ({(gpu.stdout or gpu.stderr).strip()[-200:]}): "
                    "nothing was trained, and the machine is shut down",
                    why="training on a rented GPU's CPU is slow and billed by the hour",
                    fix="try again (another machine), or another GPU type: nmt-forge remote doctor")
            state["gpu_check"] = (gpu.stdout or "").strip()[-120:]
            # what the GPU really delivers (2026-10-14: an H100 run trained at a laptop's
            # pace and burned its cap before anyone could see why)
            probe = transport.run(GPU_PROBE, timeout=180, check=False)
            try:
                tflops = float((probe.stdout or "").strip().splitlines()[-1])
            except (ValueError, IndexError):
                tflops = None
            state["gpu_tflops"] = tflops
            if tflops is not None and tflops < MIN_TFLOPS:
                raise RemoteComputeRefused(
                    f"the rented GPU measured {tflops:.1f} TFLOPS (bf16 matrix multiply), far below what the card "
                    "should give: nothing was trained, and the machine is shut down",
                    why="a slow or shared GPU bills by the hour for little work",
                    fix="try again (another machine), or another GPU type: nmt-forge remote doctor")
            say(f"GPU check: {state['gpu_check']}; measured {tflops if tflops is None else round(tflops)} TFLOPS")
            transport.run(f"cd {JOB} && (PYTHONPATH={JOB}/src/forge:{JOB}/src/arena setsid nohup python3 -m nmt_forge.remote.pod_main "
                          f"{JOB} > {JOB}/pod.log 2>&1 < /dev/null &)", timeout=60)
            state["outcome"] = "training"
            say("training there; this computer watches the progress and the cost")
            # -- watch ------------------------------------------------------------------
            last_t, last_change, asked_stop, done = None, now(), None, None
            # for the panel (monitor.py): when the heartbeat last moved, on this computer's clock,
            # and which trainer state was last copied here (numbers only)
            progress = {"moved": time.time(), "mirrored": None, "warned": False}
            margin = state["usd_per_hour"] * 0.25          # what fetching and wiping take
            while done is None:
                sleep(POLL_S)
                r = transport.run(f"cat {JOB}/heartbeat.json 2>/dev/null; echo; echo {WATCH_SEP}; "
                                  f"cat {JOB}/done.json 2>/dev/null; echo; echo {WATCH_SEP}; "
                                  f"ls -t {JOB}/ws/runs/*/checkpoint-*/trainer_state.json "
                                  f"{JOB}/ws/runs/*/*/checkpoint-*/trainer_state.json 2>/dev/null | head -n 1; "
                                  f"echo {WATCH_SEP}; "
                                  "nvidia-smi --query-gpu=utilization.gpu,memory.used "
                                  "--format=csv,noheader,nounits 2>/dev/null | head -1",
                                  timeout=60, check=False)
                hb_txt, done_txt, ts_txt, smi = ((r.stdout or "").split(WATCH_SEP) + ["", "", ""])[:4]
                try:
                    util, mem = (int(float(x)) for x in smi.strip().split(",")[:2])
                    state.setdefault("gpu_util", []).append(util)
                    state["gpu_mem_mb"] = max(state.get("gpu_mem_mb", 0), mem)
                except ValueError:
                    pass
                try:
                    hb = json.loads(hb_txt.strip()) if hb_txt.strip() else {}
                except ValueError:
                    hb = {}
                try:
                    done = json.loads(done_txt.strip()) if done_txt.strip() else None
                except ValueError:
                    done = None
                if hb.get("t") != last_t:
                    last_t, last_change = hb.get("t"), now()
                    progress["moved"] = time.time()
                heartbeat.beat(f"remote: {hb.get('stage') or 'starting'}", hb.get("step"), hb.get("max_steps"),
                               run_dir=str(run_dir))
                polls = state["polls"] = state.get("polls", 0) + 1
                if polls % 6 == 1:                        # every ~3 minutes, a line someone can read
                    util = state.get("gpu_util") or []
                    say(f"there: {hb.get('stage') or 'starting'} step {hb.get('step')} of {hb.get('max_steps')}; "
                        f"GPU {util[-1] if util else '?'}% busy, {state.get('gpu_mem_mb', 0) / 1024:.1f} GB; "
                        f"${spent():.2f} of ${max_cost:.2f}")
                cost = spent()
                _copy_progress(transport, run_dir, hb, ts_txt, progress, cost, say)
                if cost >= max_cost:
                    state["reason"] = f"the cost reached the cap (${cost:.2f} of ${max_cost:.2f})"
                    raise _Stopped(state["reason"])
                stop_here = (run_dir / "STOP_REQUESTED").is_file()
                if asked_stop is None and (stop_here or cost >= max_cost - margin):
                    state["reason"] = ("a stop was asked for here" if stop_here else
                                       f"the cost neared the cap (${cost:.2f} of ${max_cost:.2f})")
                    say(f"{state['reason']}: asking forge there to stop and keep its best checkpoint")
                    # forge's own stop flag in the run folder there (the one run in that workspace)
                    transport.run(f'for d in {JOB}/ws/runs/*/; do touch "$d"STOP_REQUESTED; done',
                                  timeout=60, check=False)
                    asked_stop = now()
                if asked_stop is not None and now() - asked_stop > STOP_GRACE_S:
                    raise _Stopped(f"{state['reason']}; forge there did not stop within "
                                   f"{STOP_GRACE_S // 60} minutes")
                if now() - last_change > STALL_S:
                    raise _Stopped(f"no progress there for {STALL_S // 60} minutes (stalled)")
            if not done.get("ok"):
                state["outcome"] = "failed there"
                tail = transport.run(f"tail -n 15 {JOB}/pod.log 2>/dev/null | cut -c1-240", timeout=60, check=False)
                util = state.get("gpu_util") or []
                raise RemoteComputeRefused(
                    f"training failed on the rented machine: {done.get('error')}\n"
                    f"  GPU there: {state.get('gpu_check')}; {state.get('gpu_tflops')} TFLOPS measured; busy "
                    f"{round(sum(util) / len(util)) if util else '?'}% on average over {len(util)} checks\n"
                    f"  the end of its log:\n    " + "\n    ".join((tail.stdout or "").strip().splitlines()[-15:]),
                    fix=f"read the error; the same config runs here with: nmt-forge run {config_path}")
            # -- bring it back --------------------------------------------------------
            heartbeat.beat("remote: fetching", force=True, run_dir=str(run_dir))
            remote_run = done["run_dir"]
            if not re.fullmatch(r"[A-Za-z0-9/._-]+", remote_run):
                raise RemoteComputeRefused(f"unexpected run folder name there: {remote_run!r}")
            # uncompressed: weights do not compress, and gzip on one core held a
            # billed GPU idle for minutes; the run folder holds only the
            # selected checkpoint by now (forge prunes the rest)
            transport.run(f"tar -cf {JOB}/out.tar -C {remote_run} .", timeout=1800)
            sz = transport.run(f"stat -c %s {JOB}/out.tar", timeout=60, check=False)
            state["returned_bytes"] = int((sz.stdout or "0").strip() or 0) if (sz.stdout or "").strip().isdigit() else None
            transport.get(f"{JOB}/out.tar", tmp / "out.tar")
            # the versions the machine trained with (the model's own record)
            vr = transport.run(f"cat {JOB}/versions.txt 2>/dev/null", timeout=60, check=False)
            packages = [ln.strip() for ln in (vr.stdout or "").splitlines()
                        if re.match(r"(?i)(torch|transformers|accelerate|peft|tokenizers|sentencepiece|sacrebleu)==",
                                    ln.strip())]
            with tarfile.open(tmp / "out.tar") as t:
                t.extractall(run_dir, filter="data")
            clear_remote_progress(run_dir)                   # the panel's copies: superseded by the real run
            state["fetched"] = True
            manifest = json.loads((run_dir / "run-manifest.json").read_text(encoding="utf-8"))
            sel = Path(manifest["selected_path"])
            local_sel = run_dir / sel.relative_to(Path(remote_run))
            manifest.update({"remote_identity": manifest.get("run_identity"), "run_identity": identity,
                             "config": cfg.raw, "selected_path": str(local_sel), "run_name": cfg.run_name,
                             "manifest_path": str(run_dir / "run-manifest.json")})
            state["outcome"] = "trained" if not state["reason"] else "stopped early, best checkpoint kept"
            manifest["remote"] = {"sovereignty": SOVEREIGNTY, "provider": PROVIDER, "cloud": "SECURE",
                                  "datacenter": where,
                                  "gpu": plan["gpu"]["id"], "usd_per_hour": state["usd_per_hour"],
                                  "hours": round((now() - state["t0"]) / 3600, 3), "usd": round(spent(), 2),
                                  "cap_usd": max_cost, "outcome": state["outcome"], "stop_reason": state["reason"],
                                  "files_sent": plan["files"], "test_sets_sent": False,
                                  "gpu_check": state.get("gpu_check"), "packages": packages,
                                  "returned_weights": spec.get("return_dtype") or "as trained",
                                  "gpu_tflops": state.get("gpu_tflops"),
                                  "gpu_busy_mean_pct": (round(sum(state["gpu_util"]) / len(state["gpu_util"]))
                                                        if state.get("gpu_util") else None),
                                  "gpu_memory_peak_gb": round(state.get("gpu_mem_mb", 0) / 1024, 1) or None,
                                  "disk_gb": plan["disk"]["gb"],
                                  "returned_gb": (round(state["returned_bytes"] / 1024 ** 3, 2)
                                                  if state.get("returned_bytes") else None)}
            tmp_m = run_dir / "run-manifest.json.tmp"
            tmp_m.write_text(json.dumps(manifest, indent=2), encoding="utf-8")
            tmp_m.replace(run_dir / "run-manifest.json")
            return manifest
    except _Stopped as e:
        state["outcome"] = "stopped"
        state["reason"] = str(e)
        raise RemoteComputeRefused(f"the remote run was stopped: {e}",
                                   why="a remote run never goes past its cap, a stall or a stop; the machine is "
                                       "shut down as the run ends (see below)",
                                   details={"usd_estimated": round(spent(), 2)}) from e
    except KeyboardInterrupt:
        state["outcome"] = "interrupted"
        raise
    except Exception:
        if state["outcome"] in ("not started", "training"):
            state["outcome"] = "failed"
        raise
    finally:
        if old_term is not None:
            signal.signal(signal.SIGTERM, old_term)
        try:
            _teardown(client, transport, state, say=say, now=now, sleep=sleep)
        finally:
            if key is not None:
                key.close()
            shutil.rmtree(tmp, ignore_errors=True)
            if not state["fetched"] and run_dir.is_dir() and not (run_dir / "run-manifest.json").is_file():
                shutil.rmtree(run_dir, ignore_errors=True)       # nothing came back: no half run left here
            try:
                ws.ledger.append("remote-end", provider=PROVIDER, pod=state["pod"], run=run_dir.name,
                                 outcome=state["outcome"], reason=state["reason"],
                                 hours=round((now() - state["t0"]) / 3600, 3) if state["t0"] else 0,
                                 usd_estimated=round(spent(), 2), fetched=state["fetched"],
                                 wiped=state["wiped"], terminated=state["terminated"])
            except OSError as e:
                say(f"[remote] the ledger could not be written: {e}")


def _copy_progress(transport, run_dir: Path, hb: dict, ts_txt: str, progress: dict, cost: float, say) -> None:
    """For the panel: write what this poll read (stage, step of steps, when the heartbeat last
    moved, the cost so far) into the local run folder, and — when the machine has saved a new
    checkpoint — a numbers-only copy of its trainer state, so a semi-sovereign run shows its
    curves while it trains. One extra bounded read per checkpoint. Never fails the run: a copy
    that cannot be made is said once, and training goes on."""
    from ..monitor import mirror_trainer_state, write_remote_progress

    try:
        write_remote_progress(run_dir, heartbeat=hb, changed=progress["moved"], polled=time.time(), usd=cost)
        path = (ts_txt or "").strip().splitlines()[0].strip() if (ts_txt or "").strip() else ""
        if path and path != progress["mirrored"] and path.startswith(f"{JOB}/") \
                and re.fullmatch(r"[A-Za-z0-9/._-]+", path) and ".." not in path:
            got = transport.run(f"cat {path}", timeout=60, check=False)
            if got.returncode == 0 and mirror_trainer_state(run_dir, got.stdout or ""):
                progress["mirrored"] = path
    except Exception as e:                       # noqa: BLE001 — the panel's copy never ends a paid run
        if not progress["warned"]:
            progress["warned"] = True
            say(f"[remote] the progress copy for the panel failed ({type(e).__name__}: {str(e)[:160]}); "
                "training goes on, and the curves come back with the model")


def _teardown(client, transport, state, *, say, now, sleep) -> None:
    """Wipe the job folder there, terminate the pod, check it is gone."""
    pod_id = state["pod"]
    if not pod_id:
        return
    if transport is not None:
        try:
            transport.run(f"rm -rf {JOB} {JOB}.tgz", timeout=120, check=False)
            state["wiped"] = True
        except Exception as e:                      # noqa: BLE001 — termination below still runs
            say(f"[remote] could not wipe the job folder there ({e}); terminating the machine destroys its disk")
    try:
        client.terminate_pod(pod_id)
        end = now() + GONE_S
        while True:
            pod = client.get_pod(pod_id)
            if pod is None or pod.get("status") == "TERMINATED":
                state["terminated"] = True
                break
            if now() > end:
                break
            sleep(5)
    except RunPodError as e:
        say(f"[remote] terminating the machine failed: {e}")
    if not state["terminated"]:
        say(f"[remote] WARNING: machine {pod_id} may still be running and billing. Stop it now with: "
            "nmt-forge remote status --stop (or on the RunPod console)")


# -- leftovers ----------------------------------------------------------------------
def forge_pods(client) -> list[dict]:
    return [{"id": p.get("id"), "name": p.get("name"), "status": p.get("status"),
             "usd_per_hour": p.get("cost"), "datacenter": p.get("dataCenterId")}
            for p in client.list_pods() if str(p.get("name") or "").startswith(POD_PREFIX)]


def stop_forge_pods(client) -> list[dict]:
    stopped = []
    for p in forge_pods(client):
        if p["status"] != "TERMINATED":
            client.terminate_pod(p["id"])
            stopped.append(p)
    return stopped


def doctor(client, *, countries=DEFAULT_COUNTRIES) -> dict:
    """The key works; what Secure Cloud GPUs are available in ``countries``,
    at what price; whether ssh is here. Spends nothing."""
    gpus = client.gpus(countries=list(countries))
    usable = sorted(({"id": g["id"], "name": g.get("name"), "memory_gb": g.get("memory"),
                      "usd_per_hour": secure_price(g), "datacenters": available_datacenters(g)}
                     for g in gpus if secure_price(g) is not None and available_datacenters(g)),
                    key=lambda g: (g["usd_per_hour"], -(g["memory_gb"] or 0)))
    return {"key": "accepted", "countries": list(countries), "gpus_available": usable,
            "ssh_tools": all(shutil.which(t) for t in ("ssh", "scp", "ssh-keygen")),
            "forge_pods_now": forge_pods(client)}
