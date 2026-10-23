"""Remote compute (nmt_forge.remote): the key, the RunPod client, the
people's per-file yes, the plan, and a whole remote run against a fake
RunPod whose "machine" is a folder here — forge's own pod_main trains on the
dummy backend inside it, from the bundle alone. No network, no spend."""

from __future__ import annotations

import json
import os
import re
import subprocess
import sys
import tarfile
from pathlib import Path

import pytest

from nmt_forge.errors import RemoteComputeRefused
from nmt_forge.remote import consent, keys, lifecycle
from nmt_forge.remote.runpod import RunPod, RunPodError
from tests.conftest import write_jsonl

KEY = "rpa_TESTKEY_never_printed_123"


# -- the key -------------------------------------------------------------------------
def test_key_from_env_local_and_never_shown(tmp_path, monkeypatch):
    monkeypatch.delenv(keys.VAR, raising=False)
    (tmp_path / ".env.local").write_text(f'OTHER=1\nexport {keys.VAR}="{KEY}"\n')
    (tmp_path / "sub").mkdir()
    s = keys.find_key(tmp_path / "sub")
    assert s.reveal() == KEY
    assert KEY not in repr(s) and KEY not in str(s) and ".env.local" in s.where


def test_no_key_is_refused_with_the_fix(tmp_path, monkeypatch):
    monkeypatch.delenv(keys.VAR, raising=False)
    monkeypatch.chdir(tmp_path)
    with pytest.raises(RemoteComputeRefused) as e:
        keys.require_key(tmp_path)
    assert ".env.local" in str(e.value) and "never paste" in str(e.value)


# -- the client ----------------------------------------------------------------------
class Recorder:
    def __init__(self, answers):
        self.answers, self.calls = list(answers), []

    def __call__(self, method, url, headers, body, timeout):
        self.calls.append((method, url, headers, body))
        return self.answers.pop(0)


def test_client_sends_the_key_only_in_the_header_and_retries_bounded():
    rec = Recorder([(503, {"title": "busy"}), (200, {"gpus": [{"id": "G"}]})])
    rp = RunPod(keys.Secret(KEY, "test"), send=rec, sleep=lambda s: None)
    assert rp.gpus(countries=["ca"]) == [{"id": "G"}]
    method, url, headers, _ = rec.calls[-1]
    assert headers["Authorization"] == f"Bearer {KEY}" and KEY not in url
    assert "countryCodes=CA" in url and "cloud=SECURE" in url and len(rec.calls) == 2


def test_client_errors_never_carry_the_key():
    rp = RunPod(keys.Secret(KEY, "test"), send=Recorder([(401, {"title": "Unauthorized"})]), sleep=lambda s: None)
    with pytest.raises(RunPodError) as e:
        rp.list_pods()
    assert KEY not in str(e.value) and "RUNPOD_API_KEY" in str(e.value)


def test_a_gone_pod_reads_as_none_and_terminating_it_is_done():
    rp = RunPod(keys.Secret(KEY, "t"), send=Recorder([(404, None), (404, None)]), sleep=lambda s: None)
    assert rp.get_pod("p1") is None
    rp.terminate_pod("p1")


# -- the people's yes -----------------------------------------------------------------
def yes(path, countries=("CA",)):
    return consent.record_consent(path, granted_by="Kokum", countries=list(countries), ask=lambda q: "",
                                  is_tty=lambda: True, say=lambda s: None)          # Enter = yes


def test_a_file_needs_the_yes_and_the_yes_binds_its_contents(tmp_path):
    f = write_jsonl(tmp_path / "gold.jsonl", [{"source": "a b", "target": "c d"}])
    assert not consent.check_file(f, provider="runpod", countries=["CA"])["ok"]
    rec = yes(f)
    assert rec["sha256"] == consent.sha256_file(f) and rec["cloud"] == "SECURE"
    assert consent.check_file(f, provider="runpod", countries=["CA"])["ok"]
    assert not consent.check_file(f, provider="runpod", countries=["US"])["ok"]       # not agreed there
    f.write_text(f.read_text() + json.dumps({"source": "e", "target": "f"}) + "\n")
    c = consent.check_file(f, provider="runpod", countries=["CA"])
    assert not c["ok"] and "changed" in c["why"]


def test_the_yes_needs_a_person_at_a_terminal(tmp_path):
    f = write_jsonl(tmp_path / "gold.jsonl", [{"source": "a", "target": "b"}])
    with pytest.raises(RemoteComputeRefused, match="typed by a person"):
        consent.record_consent(f, granted_by="X", countries=["CA"], is_tty=lambda: False)
    # "n" skips: nothing recorded
    assert consent.record_consent(f, granted_by="X", countries=["CA"], is_tty=lambda: True, ask=lambda q: "n",
                                  say=lambda s: None) is None
    assert not Path(str(f) + ".champollion.json").exists()


def test_several_files_show_the_terms_once_then_enter_for_each(tmp_path):
    files = [write_jsonl(tmp_path / f"g{i}.jsonl", [{"source": f"a{i}", "target": "b"}]) for i in range(3)]
    said, asked = [], []
    answers = iter(["", "n", ""])
    for i, f in enumerate(files):
        consent.record_consent(f, granted_by="X", countries=["CA"], is_tty=lambda: True, show_terms=(i == 0),
                               ask=lambda q: (asked.append(q), next(answers))[1], say=said.append)
    assert sum("Secure Cloud" in s for s in said) == 1                     # the terms once
    assert all("Enter = yes" in q and "sha256" in q for q in asked)        # one line per file
    assert [consent.check_file(f, provider="runpod", countries=["CA"])["ok"] for f in files] == [True, False, True]


@pytest.mark.parametrize("side", [{"transmission": "local-only"}, {"terms": {"training": "not-allowed"}}])
def test_no_yes_sends_a_local_only_or_no_training_file(tmp_path, side):
    f = write_jsonl(tmp_path / "gold.jsonl", [{"source": "a", "target": "b"}])
    Path(str(f) + ".champollion.json").write_text(json.dumps(side))
    with pytest.raises(RemoteComputeRefused, match="cannot be sent"):
        yes(f)
    c = consent.check_file(f, provider="runpod", countries=["CA"])
    assert not c["ok"]


# -- a fake RunPod and a fake machine -------------------------------------------------
GPUS = [{"id": "NVIDIA RTX A5000", "name": "RTX A5000", "memory": 24, "secure": True,
         "price": {"secure": 0.27}, "dataCenters": [{"id": "CA-MTL-1", "availability": "HIGH"}]},
        {"id": "NVIDIA A40", "name": "A40", "memory": 48, "secure": True,
         "price": {"secure": 0.40}, "dataCenters": [{"id": "CA-MTL-1", "availability": "LOW"}]},
        {"id": "NVIDIA RTX 4000 Ada", "name": "RTX 4000 Ada", "memory": 20, "secure": True,
         "price": {"secure": 0.20}, "dataCenters": [{"id": "CA-MTL-1", "availability": "HIGH"}]}]


class FakeRunPod:
    def __init__(self, *, placed="CA-MTL-1", status="RUNNING", cost=0.27):
        self.placed, self.status, self.cost = placed, status, cost
        self.pods, self.created, self.terminated = {}, [], []

    def gpus(self, *, countries=None):
        return GPUS

    def create_pod(self, spec):
        self.created.append(spec)
        pid = f"pod{len(self.created)}"
        self.pods[pid] = {"id": pid, "name": spec["name"], "status": "PROVISIONING", "cost": self.cost}
        return dict(self.pods[pid])

    def get_pod(self, pid):
        p = self.pods.get(pid)
        if p is None:
            return None
        if p["status"] == "PROVISIONING":
            p.update(status=self.status, dataCenterId=self.placed,
                     ssh={"direct": {"host": "203.0.113.9", "port": 10022, "username": "root"}})
        return dict(p)

    def list_pods(self):
        return [dict(p) for p in self.pods.values()]

    def terminate_pod(self, pid):
        self.terminated.append(pid)
        self.pods.pop(pid, None)


class FakeKey:
    def __init__(self):
        self.public, self.closed = "ssh-ed25519 AAAAtest nmt-forge-run", False

    def close(self):
        self.closed = True


class FakeMachine:
    """The pod's disk is a folder here; commands run for real with /root/nmtf
    mapped into it. The pip install is skipped (the test's python has the
    packages); pod_main runs to the end at once, unless ``train=False``."""

    def __init__(self, root: Path, *, train=True, gpu=True):
        self.job = root / "nmtf"
        self.train, self.gpu, self.commands, self.puts = train, gpu, [], []
        root.mkdir(parents=True, exist_ok=True)

    def factory(self, key, host, port):
        assert (host, port) == ("203.0.113.9", 10022)
        return self

    def _map(self, s: str) -> str:
        return s.replace(lifecycle.JOB, str(self.job))

    def run(self, command, *, timeout=120, check=True):
        self.commands.append(command)
        if "install.sh" in command:
            # a PyTorch the driver can run, held while forge's packages install
            # (the 2026-10-14 first and second real runs lost the image's one)
            script = (self.job / "install.sh").read_text()
            assert "nvidia-smi" in script and "-c constraints.txt" in script and "torch.__version__" in script
            (self.job / "versions.txt").write_text("torch==2.13.0+cu128\ntransformers==5.1.0\nsomething==1\n")
            return subprocess.CompletedProcess(command, 0, "", "")
        if "x @ x" in command:                         # the GPU speed probe
            return subprocess.CompletedProcess(command, 0, "150.0\n" if self.gpu else "3.0\n", "")
        if "torch.cuda.is_available" in command:
            return subprocess.CompletedProcess(command, 0 if self.gpu else 3,
                                               "2.13.0+cu128 12.8 " + ("True" if self.gpu else "False"), "")
        if "nmt_forge.remote.pod_main" in command:
            if self.train:
                env = {**os.environ, "PYTHONPATH": str(self.job / "src" / "forge"),
                       "NMT_FORGE_MACHINE_DIR": str(self.job.parent / "machine")}
                r = subprocess.run([sys.executable, "-m", "nmt_forge.remote.pod_main", str(self.job)], env=env,
                                   capture_output=True, text=True, timeout=600, cwd=self.job)
                assert r.returncode == 0, r.stdout + r.stderr + (self.job / "done.json").read_text()
            else:                                     # a long run: alive, never done
                (self.job / "heartbeat.json").write_text(json.dumps({"stage": "train", "step": 1, "t": 1.0}))
            return subprocess.CompletedProcess(command, 0, "", "")
        if "heartbeat.json" in command and not self.train:
            hb = json.loads((self.job / "heartbeat.json").read_text())
            hb["t"] += 1
            (self.job / "heartbeat.json").write_text(json.dumps(hb))
        return subprocess.run(self._map(command), shell=True, capture_output=True, text=True, timeout=timeout)

    def put(self, local, remote, *, timeout=1800):
        self.puts.append(remote)
        Path(self._map(remote)).write_bytes(Path(local).read_bytes())

    def get(self, remote, local, *, timeout=3600):
        Path(local).write_bytes(Path(self._map(remote)).read_bytes())


class Clock:
    def __init__(self):
        self.t = 0.0

    def now(self):
        return self.t

    def sleep(self, s):
        self.t += s


def _project(ws, tmp_path):
    gold = write_jsonl(tmp_path / "gold.jsonl",
                       [{"source": f"the florp {i} sings", "target": f"florpa{i} zam"} for i in range(6)])
    raw = {"run_name": "far", "workspace": str(ws.root), "data": {"gold": [str(gold)], "dev": "toy-dev"},
           "model": {"backend": "dummy", "time_budget_hours": 2}, "selection": {"metric": "loss"},
           "decode": {"max_new_tokens": 64}}
    cfg = tmp_path / "config.json"
    cfg.write_text(json.dumps(raw))
    return cfg, gold, Path(ws.registry.get("toy-dev")["path"])


@pytest.fixture
def project(ws, dev_set, test_set, tmp_path):
    cfg, gold, dev = _project(ws, tmp_path)
    yes(gold)
    yes(dev)
    return cfg


def test_plan_spends_nothing_and_picks_the_cheapest_fit(project):
    plan = lifecycle.plan_remote(project, client=FakeRunPod(), countries=["CA"])
    assert plan["gpu"]["id"] == "NVIDIA RTX A5000"            # 24 GB+: the 20 GB card is too small
    assert plan["most_usd"] == round(0.27 * (2 + lifecycle.SETUP_HOURS), 2)
    assert {f["role"] for f in plan["files"]} == {"train", "dev"} and "test" in plan["never_sent"]


def test_plan_refuses_without_every_files_yes(ws, dev_set, test_set, tmp_path):
    cfg, gold, dev = _project(ws, tmp_path)
    yes(gold)                                                  # the dev set has no yes
    with pytest.raises(RemoteComputeRefused, match="1 of 2 file"):
        lifecycle.plan_remote(cfg, client=FakeRunPod(), countries=["CA"])


def test_plan_refuses_what_a_pod_cannot_carry_and_a_cap_too_small(project):
    raw = json.loads(project.read_text())
    raw["model"]["init_from"] = "/somewhere/checkpoint-9"
    project.write_text(json.dumps(raw))
    with pytest.raises(RemoteComputeRefused, match="init_from"):
        lifecycle.plan_remote(project, client=FakeRunPod())
    del raw["model"]["init_from"]
    project.write_text(json.dumps(raw))
    with pytest.raises(RemoteComputeRefused, match="does not cover"):
        lifecycle.plan_remote(project, client=FakeRunPod(), max_cost=0.05)


def test_the_rented_disk_is_sized_from_the_model(project, monkeypatch):
    # 2026-10-15: every machine got 50 GB whatever the model; a 3B base (13 GB
    # a checkpoint, 17.6 GB to download) would have filled it mid-save
    monkeypatch.setattr(lifecycle, "_model_gb", lambda base: (13.2, 17.6, "3,300M parameters"))
    plan = lifecycle.plan_remote(project, client=FakeRunPod(), countries=["CA"])
    assert plan["disk"]["gb"] == 100 and plan["disk"]["checkpoints_at_once"] == 5   # 17.6 + 5 x 13.2 + 15
    raw = json.loads(project.read_text())
    raw["model"]["remote_disk_gb"] = 60
    project.write_text(json.dumps(raw))
    with pytest.raises(RemoteComputeRefused, match="needs about 100 GB"):
        lifecycle.plan_remote(project, client=FakeRunPod(), countries=["CA"])
    # a small model, or one whose size is unknown here, keeps the 50 GB least, said so
    monkeypatch.setattr(lifecycle, "_model_gb", lambda base: (None, None, "the size is not known here"))
    del raw["model"]["remote_disk_gb"]
    project.write_text(json.dumps(raw))
    d = lifecycle.plan_remote(project, client=FakeRunPod(), countries=["CA"])["disk"]
    assert d["gb"] == lifecycle.DISK_GB and d["need_gb"] is None and "default" in d["basis"]


def _go(project, rp, machine, clock, cap=5.0):
    plan = lifecycle.plan_remote(project, client=rp, countries=["CA"])
    keys_made = []

    def key_factory():
        keys_made.append(FakeKey())
        return keys_made[-1]

    try:
        return lifecycle.run_remote(project, plan=plan, client=rp, max_cost=cap, key_factory=key_factory,
                                    transport_factory=machine.factory, now=clock.now, sleep=clock.sleep,
                                    say=lambda s: None), keys_made
    finally:
        assert all(k.closed for k in keys_made)


def test_a_remote_run_trains_there_comes_back_here_and_leaves_nothing(ws, project, tmp_path, test_set):
    rp, machine = FakeRunPod(), FakeMachine(tmp_path / "pod")
    manifest, _ = _go(project, rp, machine, Clock())
    # the run is here, under the LOCAL identity, its checkpoint on this disk
    from nmt_forge.training.config import RunConfig
    from nmt_forge.training.run import run_identity

    ident = run_identity(RunConfig.from_file(project), ws)
    assert manifest["run_identity"]["id"] == ident["id"]
    run_dir = ws.runs_dir / f"far-{ident['id'][:8]}"
    on_disk = json.loads((run_dir / "run-manifest.json").read_text())
    assert on_disk["remote"]["datacenter"] == "CA-MTL-1" and on_disk["remote"]["test_sets_sent"] is False
    # the selected checkpoint's path now points here (the dummy backend writes no weights)
    assert on_disk["selected_path"].startswith(str(run_dir) + "/")
    assert (run_dir / "run-report.md").is_file() and (run_dir / "dev-outputs.jsonl").is_file()
    # the machine: Secure Cloud, the agreed place, no volume; wiped; terminated
    spec = rp.created[0]
    assert spec["cloud"] == "SECURE" and spec["dataCenterIds"] == ["CA-MTL-1"] and "mounts" not in spec
    assert spec["disk"] == on_disk["remote"]["disk_gb"] >= lifecycle.DISK_GB
    # it came back as a plain tar (weights do not compress), its size recorded
    assert any(f"tar -cf {lifecycle.JOB}/out.tar" in c for c in machine.commands)
    assert not any("tar -czf" in c for c in machine.commands)
    assert rp.terminated == ["pod1"] and not machine.job.exists()
    assert any(c.startswith(f"rm -rf {lifecycle.JOB}") for c in machine.commands)
    # the record: hashes, never text; the end says wiped and terminated
    events = [json.loads(x) for x in (ws.root / "ledger.jsonl").read_text().splitlines()]
    start = next(e for e in events if e["event"] == "remote-start")
    end = next(e for e in events if e["event"] == "remote-end")
    assert all(re.fullmatch(r"[0-9a-f]{64}", f["sha256"]) for f in start["files"])
    assert end["terminated"] and end["wiped"] and end["fetched"] and end["outcome"] == "trained"
    assert "florp" not in json.dumps(start) + json.dumps(end)


def test_the_bundle_never_holds_a_test_set(ws, project, tmp_path, test_set):
    from nmt_forge.training.config import RunConfig

    cfg = RunConfig.from_file(project)
    tgz, spec = lifecycle.build_bundle(cfg, ws, tmp_path / "b")
    with tarfile.open(tgz) as t:
        names = t.getnames()
        data = b"".join(t.extractfile(m).read() for m in t.getmembers()
                        if m.isfile() and "/data/" in "/" + m.name)
    assert not any("toy-test" in n for n in names)
    assert b"tozer" not in data                               # the test set's invented words
    assert any(n.endswith("data/gold0-gold.jsonl.champollion.json") for n in names)   # terms travel...
    assert b"Kokum" not in data and b"remote_compute" not in data                       # ...not who said yes
    assert "eval" not in spec["config"]


def test_a_machine_placed_elsewhere_is_shut_down_before_anything_is_sent(project, tmp_path):
    rp, machine = FakeRunPod(placed="US-TX-3"), FakeMachine(tmp_path / "pod")
    with pytest.raises(RemoteComputeRefused, match="outside the datacentres agreed"):
        _go(project, rp, machine, Clock())
    assert rp.terminated == ["pod1"] and machine.puts == []


def test_the_cost_cap_stops_and_shuts_the_machine_down(ws, project, tmp_path):
    rp, machine = FakeRunPod(cost=6.0), FakeMachine(tmp_path / "pod", train=False)
    clock = Clock()
    with pytest.raises(RemoteComputeRefused, match="stopped"):
        _go(project, rp, machine, clock, cap=1.0)
    assert rp.terminated == ["pod1"]
    assert clock.t * 6.0 / 3600 <= 1.0 + 6.0 * lifecycle.POLL_S / 3600      # never past the cap by more than a poll
    assert any("STOP_REQUESTED" in c for c in machine.commands)               # asked forge there to stop first
    end = [json.loads(x) for x in (ws.root / "ledger.jsonl").read_text().splitlines()][-1]
    assert end["event"] == "remote-end" and end["terminated"] and not end["fetched"]
    assert not list(ws.runs_dir.glob("far-*"))                                # no half run left here


def test_a_gpu_pytorch_cannot_use_stops_before_any_training(project, tmp_path):
    """2026-10-14, the first real run: the install replaced the image's CUDA
    PyTorch with one its driver could not run, and training fell to the CPU."""
    rp, machine = FakeRunPod(), FakeMachine(tmp_path / "pod", gpu=False)
    with pytest.raises(RemoteComputeRefused, match="GPU is not usable"):
        _go(project, rp, machine, Clock())
    assert rp.terminated == ["pod1"]
    assert not any("pod_main" in c for c in machine.commands)


def test_the_run_records_the_machines_pytorch_and_packages(ws, project, tmp_path):
    manifest, _ = _go(project, FakeRunPod(), FakeMachine(tmp_path / "pod"), Clock())
    r = manifest["remote"]
    assert "12.8 True" in r["gpu_check"] and "torch==2.13.0+cu128" in r["packages"]
    assert not any(p.startswith("something") for p in r["packages"])
    reqs = lifecycle._requirements()
    assert not any(q.split("==")[0] == "torch" for q in reqs) and not any("==" in q for q in reqs)


def test_a_machine_that_fails_to_start_is_terminated(project, tmp_path):
    rp = FakeRunPod(status="ERROR")
    with pytest.raises(RemoteComputeRefused, match="did not start"):
        _go(project, rp, FakeMachine(tmp_path / "pod"), Clock())
    assert rp.terminated == ["pod1"]


def test_leftover_forge_machines_are_found_and_stopped():
    rp = FakeRunPod()
    rp.create_pod({"name": "nmt-forge-x"})
    rp.create_pod({"name": "someone-elses"})
    assert [p["name"] for p in lifecycle.forge_pods(rp)] == ["nmt-forge-x"]
    assert [p["id"] for p in lifecycle.stop_forge_pods(rp)] == ["pod1"] and "pod2" in rp.pods



# -- the panel sees a remote run while it trains (2026-10-14) -------------------------------

class _Answers:
    """A transport whose answers are given: records every command."""

    def __init__(self, text="", fail=False):
        self.text, self.fail, self.commands = text, fail, []

    def run(self, command, *, timeout=120, check=True):
        self.commands.append(command)
        if self.fail:
            raise OSError("the machine went away")
        return subprocess.CompletedProcess(command, 0, self.text, "")


def test_progress_is_copied_home_once_per_checkpoint_and_never_ends_a_run(tmp_path):
    from nmt_forge.monitor import REMOTE_MIRROR, REMOTE_PROGRESS

    run_dir = tmp_path / "far-1"
    run_dir.mkdir()
    state = {"global_step": 50, "max_steps": 500, "log_history": [{"step": 50, "loss": 2.0, "text": "never"}]}
    t = _Answers(json.dumps(state))
    prog, said = {"moved": 100.0, "mirrored": None, "warned": False}, []
    path = f"{lifecycle.JOB}/ws/runs/far-1/train/checkpoint-50/trainer_state.json"
    hb = {"stage": "train", "step": 52, "max_steps": 500, "pid": 7}
    lifecycle._copy_progress(t, run_dir, hb, path + "\n", prog, 0.42, said.append)
    assert t.commands == [f"cat {path}"] and prog["mirrored"] == path
    doc = json.loads((run_dir / REMOTE_PROGRESS).read_text())
    assert (doc["step"], doc["max_steps"], doc["stage"], doc["changed"], doc["usd_estimated"]) == (52, 500, "train", 100.0, 0.42)
    assert "pid" not in doc and "never" not in (run_dir / REMOTE_MIRROR / "trainer_state.json").read_text()
    lifecycle._copy_progress(t, run_dir, hb, path, prog, 0.43, said.append)      # the same checkpoint: no second read
    assert len(t.commands) == 1
    for odd in ("/etc/passwd", f"{lifecycle.JOB}/ws/../../etc/passwd", f"{lifecycle.JOB}/x y.json", f"{lifecycle.JOB}/a;rm -rf /"):
        lifecycle._copy_progress(t, run_dir, hb, odd, prog, 0.5, said.append)
    assert len(t.commands) == 1                                                 # nothing outside the job folder is read
    broken = _Answers(fail=True)
    for _ in range(3):
        lifecycle._copy_progress(broken, run_dir, hb, path.replace("-50", "-100"), prog, 0.6, said.append)
    assert len(said) == 1 and "training goes on" in said[0]                     # said once; the run is untouched


class _WatchingClock(Clock):
    """Looks into the local run folder at every wait, as the panel would."""

    def __init__(self, runs_dir):
        super().__init__()
        self.runs_dir, self.seen = runs_dir, []

    def sleep(self, s):
        super().sleep(s)
        for f in self.runs_dir.glob("far-*/remote-progress.json"):
            self.seen.append(json.loads(f.read_text()))


def test_a_remote_run_shows_its_progress_here_while_it_trains(ws, project, tmp_path):
    rp, machine = FakeRunPod(cost=6.0), FakeMachine(tmp_path / "pod", train=False)
    clock = _WatchingClock(ws.runs_dir)
    with pytest.raises(RemoteComputeRefused, match="stopped"):
        _go(project, rp, machine, clock, cap=1.0)
    assert clock.seen and clock.seen[-1]["stage"] == "train" and clock.seen[-1]["step"] == 1
    assert clock.seen[-1]["usd_estimated"] > 0
    assert any(lifecycle.WATCH_SEP in c and "trainer_state.json" in c for c in machine.commands)
    assert not list(ws.runs_dir.glob("far-*"))                                  # nothing came back: no half run left


def test_a_finished_remote_run_leaves_no_progress_copies(ws, project, tmp_path):
    manifest, _ = _go(project, FakeRunPod(), FakeMachine(tmp_path / "pod"), Clock())
    run_dir = Path(manifest["manifest_path"]).parent
    assert (run_dir / "run-manifest.json").is_file()
    assert not (run_dir / "remote-progress.json").exists() and not (run_dir / "remote-progress").exists()


# -- the CLI ------------------------------------------------------------------------
def _cli(capsys, *argv):
    from nmt_forge.cli import main

    code = main(list(argv))
    return code, capsys.readouterr()


def test_cli_run_remote_needs_a_cap(capsys, tmp_path):
    code, out = _cli(capsys, "run", str(tmp_path / "config.json"), "--remote", "runpod", "--json")
    err = json.loads(out.out)["error"]
    assert code == 2 and err["guard"] == "remote-compute" and "--max-cost" in err["message"]


def test_cli_consent_refuses_without_a_terminal(capsys, tmp_path, monkeypatch):
    f = write_jsonl(tmp_path / "gold.jsonl", [{"source": "a", "target": "b"}])
    monkeypatch.setattr(sys.stdin, "isatty", lambda: False, raising=False)
    code, out = _cli(capsys, "remote", "consent", str(f), "--by", "Agent", "--json")
    assert code == 2 and json.loads(out.out)["error"]["guard"] == "remote-compute"
    assert not Path(str(f) + ".champollion.json").exists()
