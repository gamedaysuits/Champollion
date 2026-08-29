"""Live training monitor — a local GUI that opens for the HUMAN even when an
agent is driving forge entirely through CLI/MCP.

Design (founder-specified, 2026-07-14): the panel is deliberately read-only.
Training is agent-driven; a human watching it gets the loss curves, the
schedule floor, the event feed — and exactly ONE control: a loud, two-step
"stop training" that kills the run. Anything else, they ask the agent.

Two modes:

* **Live** — ``RunMonitor`` is created by ``nmt-forge run`` (non-dummy
  backends), serves the panel from a background thread, receives loss points
  via ``emit()`` from a trainer callback, and exposes ``stop_requested()``
  which the callback polls; a human stop ends training at the next step
  boundary and the run aborts loudly (recorded, nonzero exit).
* **Attach** — ``nmt-forge monitor <run-dir> [--pid N]`` watches an ALREADY
  RUNNING run by polling the HF trainer's ``checkpoint-*/trainer_state.json``
  dumps (every eval-save), serving the same panel; its stop button SIGTERMs
  the given pid.

No dependencies beyond the stdlib; the page is a single embedded document
(no CDN, no external assets). Chart colors are the validated dark-surface
categorical slots (train ``#3987e5``, dev ``#199e70`` — CVD ΔE 69.8).
Disable auto-open (e.g. in CI) with ``NMT_FORGE_NO_MONITOR=1``.
"""

from __future__ import annotations

import json
import os
import signal
import threading
import time
import webbrowser
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path

STOP_BASENAME = "STOP_REQUESTED"


def monitor_enabled() -> bool:
    return os.environ.get("NMT_FORGE_NO_MONITOR", "") != "1"


class RunMonitor:
    """Serves the panel; collects points; carries the human stop flag."""

    def __init__(self, run_dir: str | Path, run_name: str, config_hash: str,
                 *, port: int = 0, open_browser: bool = True,
                 stop_pid: int | None = None):
        self.run_dir = Path(run_dir)
        self._lock = threading.Lock()
        self._state = {
            "run_name": run_name,
            "config_hash": config_hash,
            "status": "starting",       # starting|training|done|aborted
            "stage": "",
            "floor_steps": None,
            "planned_steps": None,
            "points": [],               # {step, train_loss?, dev_loss?}
            "events": [],               # {t, text}
            "stop_requested": False,
        }
        self._stop_pid = stop_pid
        monitor = self

        class Handler(BaseHTTPRequestHandler):
            def log_message(self, *a):   # keep the training log clean
                pass

            def _send(self, code, body: bytes, ctype: str):
                self.send_response(code)
                self.send_header("Content-Type", ctype)
                self.send_header("Content-Length", str(len(body)))
                self.send_header("Cache-Control", "no-store")
                self.end_headers()
                self.wfile.write(body)

            def do_GET(self):
                if self.path.startswith("/status"):
                    with monitor._lock:
                        body = json.dumps(monitor._state).encode()
                    self._send(200, body, "application/json")
                else:
                    self._send(200, PANEL_HTML.encode(), "text/html; charset=utf-8")

            def do_POST(self):
                if self.path.startswith("/stop"):
                    monitor.request_stop()
                    self._send(200, b'{"ok": true}', "application/json")
                else:
                    self._send(404, b"{}", "application/json")

        self._server = ThreadingHTTPServer(("127.0.0.1", port), Handler)
        self.port = self._server.server_address[1]
        self._thread = threading.Thread(target=self._server.serve_forever,
                                        daemon=True)
        self._thread.start()
        self.url = f"http://127.0.0.1:{self.port}"
        print(f"[monitor] live panel: {self.url} "
              "(read-only for humans; stop button only)", flush=True)
        if open_browser and monitor_enabled():
            try:
                webbrowser.open(self.url)
            except Exception:
                pass                      # headless is fine; URL is printed

    # -- state intake ---------------------------------------------------------

    def emit(self, kind: str, **data) -> None:
        with self._lock:
            s = self._state
            if kind == "train_loss":
                s["points"].append({"step": data["step"],
                                    "train_loss": data["loss"]})
                s["status"] = "training"
            elif kind == "dev_loss":
                s["points"].append({"step": data["step"],
                                    "dev_loss": data["loss"]})
            elif kind == "stage":
                s["stage"] = data["name"]
                s["floor_steps"] = data.get("floor_steps")
                s["planned_steps"] = data.get("planned_steps")
                s["events"].append({"t": time.strftime("%H:%M:%S"),
                                    "text": f"stage {data['name']} — floor "
                                            f"{data.get('floor_steps')} of "
                                            f"{data.get('planned_steps')} steps"})
            elif kind == "done":
                s["status"] = data.get("status", "done")
                s["events"].append({"t": time.strftime("%H:%M:%S"),
                                    "text": data.get("text", "run complete")})
            else:
                s["events"].append({"t": time.strftime("%H:%M:%S"),
                                    "text": str(data.get("text", kind))})

    # -- the one human control ------------------------------------------------

    def request_stop(self) -> None:
        with self._lock:
            self._state["stop_requested"] = True
            self._state["events"].append(
                {"t": time.strftime("%H:%M:%S"),
                 "text": "⛔ HUMAN STOP requested from the panel"})
        try:                              # cross-process breadcrumb
            (self.run_dir / STOP_BASENAME).write_text("stop\n")
        except OSError:
            pass
        if self._stop_pid:                # attach mode: kill the trainer
            try:
                os.kill(self._stop_pid, signal.SIGTERM)
            except OSError as e:
                self.emit("event", text=f"stop signal failed: {e}")

    def stop_requested(self) -> bool:
        with self._lock:
            if self._state["stop_requested"]:
                return True
        return (self.run_dir / STOP_BASENAME).exists()

    def shutdown(self) -> None:
        self._server.shutdown()


# -- attach mode ---------------------------------------------------------------

import re

_TQDM_STEP = re.compile(r"(\d+)/(\d+) \[")
_TQDM_RATE = re.compile(r"([\d.]+)(s/it|it/s)")
_LOSS_DICT = re.compile(r"\{'loss': ([\d.]+)")
_EVAL_DICT = re.compile(r"'eval_loss': ([\d.]+)")


def _parse_train_log(log_path: Path, tail_bytes: int = 262_144) -> dict:
    """Live signal from the trainer's stdout BEFORE any checkpoint exists.

    HF prints a tqdm stream (``809/12774 [1:19:30<34:38, 10.41s/it]``) and a
    ``{'loss': …}`` dict every logging step — but the dict carries no global
    step, so each loss is paired with the nearest step fragment printed
    before it. Reads only the file tail; safe to call every poll."""
    try:
        with open(log_path, "rb") as f:
            f.seek(0, 2)
            size = f.tell()
            f.seek(max(0, size - tail_bytes))
            text = f.read().decode("utf-8", "replace")
    except OSError:
        return {}
    steps = [(m.start(), int(m.group(1)), int(m.group(2)))
             for m in _TQDM_STEP.finditer(text)]
    if not steps:
        return {}

    def step_before(pos: int) -> int:
        best = steps[0][1]
        for s_pos, s, _ in steps:
            if s_pos > pos:
                break
            best = s
        return best

    points = []
    for m in _LOSS_DICT.finditer(text):
        points.append({"step": step_before(m.start()),
                       "train_loss": float(m.group(1))})
    for m in _EVAL_DICT.finditer(text):
        points.append({"step": step_before(m.start()),
                       "dev_loss": float(m.group(1))})
    # dedupe (a loss line can be re-printed across tqdm refreshes)
    seen, uniq = set(), []
    for p in points:
        key = tuple(sorted(p.items()))
        if key not in seen:
            seen.add(key)
            uniq.append(p)
    uniq.sort(key=lambda p: p["step"])
    last_rate = None
    for m in _TQDM_RATE.finditer(text):
        val, unit = float(m.group(1)), m.group(2)
        last_rate = val if unit == "s/it" else (1.0 / val if val else None)
    return {"points": uniq, "step": steps[-1][1], "planned": steps[-1][2],
            "sec_per_it": last_rate}


def _pid_alive(pid: int | None) -> bool | None:
    if not pid:
        return None
    try:
        os.kill(pid, 0)
        return True
    except OSError:
        return False


def _harvest_trainer_state(run_dir: Path) -> list[dict]:
    """Points from the newest HF ``trainer_state.json`` under run_dir.

    Each checkpoint dump carries the FULL log_history to that step, so the
    newest file is the whole curve (train loss every logging step, eval loss
    every eval step)."""
    newest, newest_step = None, -1
    for ts in run_dir.rglob("trainer_state.json"):
        try:
            data = json.loads(ts.read_text())
        except (OSError, json.JSONDecodeError):
            continue
        step = int(data.get("global_step", 0))
        if step > newest_step:
            newest, newest_step = data, step
    if not newest:
        return []
    points = []
    for entry in newest.get("log_history", []):
        step = int(entry.get("step", 0))
        if "loss" in entry:
            points.append({"step": step, "train_loss": entry["loss"]})
        if "eval_loss" in entry:
            points.append({"step": step, "dev_loss": entry["eval_loss"]})
    return points


def watch(run_dir: str | Path, *, pid: int | None = None, port: int = 8377,
          open_browser: bool = True, poll_seconds: float = 10.0,
          max_polls: int | None = None,
          log_path: str | Path | None = None) -> RunMonitor:
    """Attach to a running (or finished) run directory and serve the panel.

    ``log_path`` (the trainer's stdout log) makes the panel live from minute
    one — loss points every logging step plus step/rate/ETA — instead of
    waiting for the first checkpoint dump."""
    run_dir = Path(run_dir)
    name = run_dir.name
    manifest = run_dir / "run-manifest.json"
    config_hash = ""
    if manifest.is_file():
        try:
            config_hash = json.loads(manifest.read_text()).get("config_hash", "")
        except (OSError, json.JSONDecodeError):
            pass
    try:
        mon = RunMonitor(run_dir, name, config_hash, port=port,
                         open_browser=open_browser, stop_pid=pid)
    except OSError:                      # port taken → any free port
        mon = RunMonitor(run_dir, name, config_hash, port=0,
                         open_browser=open_browser, stop_pid=pid)
    mon.emit("event", text=f"attached to {run_dir} "
             f"(pid {pid or 'unknown'}; polling every {poll_seconds:.0f}s"
             + (f"; live-tailing {log_path}" if log_path else "") + ")")

    def poll_loop():
        polls = 0
        last_rate_report = 0.0
        while max_polls is None or polls < max_polls:
            polls += 1
            ckpt_points = _harvest_trainer_state(run_dir)
            log = _parse_train_log(Path(log_path)) if log_path else {}
            # checkpoint dumps are authoritative; log fills the gaps between
            points = ckpt_points or []
            have = {(p["step"], "train_loss" in p) for p in points}
            for p in log.get("points", []):
                if (p["step"], "train_loss" in p) not in have:
                    points.append(p)
            points.sort(key=lambda p: p["step"])
            alive = _pid_alive(pid)
            with mon._lock:
                if points:
                    mon._state["points"] = points
                    mon._state["status"] = "training"
                if log.get("planned"):
                    mon._state["planned_steps"] = (mon._state["planned_steps"]
                                                   or log["planned"])
                    mon._state["live_step"] = log.get("step")
                    mon._state["sec_per_it"] = log.get("sec_per_it")
                if alive is False and not manifest.is_file():
                    mon._state["status"] = "stopped"
            rate = log.get("sec_per_it")
            if rate and abs(rate - last_rate_report) > max(2.0, last_rate_report):
                remaining = (log["planned"] - log["step"]) * rate
                mon.emit("event", text=f"step {log['step']:,}/{log['planned']:,}"
                         f" at {rate:.1f}s/it — ~{remaining / 3600:.1f}h left "
                         "at this rate")
                last_rate_report = rate
            if manifest.is_file():
                mon.emit("done", text="run manifest present — training done")
                break
            if alive is False:
                mon.emit("done", status="stopped",
                         text="training process is gone and no manifest was "
                              "written — the run died or was killed")
                break
            time.sleep(poll_seconds)

    threading.Thread(target=poll_loop, daemon=True).start()
    return mon


def monitor_cli(args) -> int:
    mon = watch(args.run_dir, pid=args.pid, port=args.port,
                open_browser=not args.no_browser, log_path=args.log)
    print(f"[monitor] watching {args.run_dir} — Ctrl-C to detach "
          "(training keeps running)", flush=True)
    try:
        while True:
            time.sleep(3600)
    except KeyboardInterrupt:
        mon.shutdown()
        return 0


# -- the panel (single document, validated dark palette, no external assets) ---

PANEL_HTML = """<!doctype html>
<html><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>nmt-forge · training monitor</title>
<style>
:root{--page:#0d0d0d;--surface:#1a1a19;--ink:#fff;--ink2:#c3c2b7;
--muted:#898781;--grid:#2c2c2a;--axis:#383835;--train:#3987e5;--dev:#199e70;
--crit:#d03b3b;--border:rgba(255,255,255,.10)}
*{box-sizing:border-box;margin:0}
body{background:var(--page);color:var(--ink2);
font:14px/1.45 system-ui,-apple-system,sans-serif;padding:20px;max-width:980px;
margin:0 auto}
h1{color:var(--ink);font-size:17px;font-weight:650;letter-spacing:.2px}
.sub{color:var(--muted);font-size:12px;margin-top:2px}
.chip{display:inline-block;border:1px solid var(--border);border-radius:6px;
padding:1px 8px;font-family:ui-monospace,monospace;font-size:11px;
color:var(--ink2);margin-left:8px;vertical-align:middle}
.dot{display:inline-block;width:8px;height:8px;border-radius:50%;
margin-right:6px;background:var(--muted)}
.dot.training{background:var(--dev);animation:pulse 1.6s infinite}
.dot.aborted,.dot.stopped{background:var(--crit)}
@keyframes pulse{50%{opacity:.35}}
.card{background:var(--surface);border:1px solid var(--border);
border-radius:10px;padding:16px;margin-top:14px}
.row{display:flex;gap:14px;align-items:baseline;flex-wrap:wrap}
.notice{font-size:12.5px;color:var(--muted);border-left:2px solid var(--axis);
padding-left:10px}
.notice b{color:var(--ink2);font-weight:600}
.legend{display:flex;gap:18px;font-size:12px;margin:2px 0 8px}
.legend .sw{display:inline-block;width:14px;height:3px;border-radius:2px;
vertical-align:middle;margin-right:6px}
svg text{font:11px system-ui;fill:var(--muted)}
.bar{height:6px;background:var(--grid);border-radius:3px;overflow:hidden;
position:relative;margin-top:8px}
.bar>i{display:block;height:100%;background:var(--train)}
.bar>s{position:absolute;top:-2px;width:2px;height:10px;background:var(--muted)}
.meta{font-size:12px;color:var(--muted);margin-top:6px}
#events{font:11.5px ui-monospace,monospace;max-height:180px;overflow:auto;
white-space:pre-wrap;color:var(--ink2)}
button.stop{background:none;border:1.5px solid var(--crit);color:var(--crit);
border-radius:8px;padding:8px 18px;font-weight:650;font-size:13px;
cursor:pointer}
button.stop:hover{background:rgba(208,59,59,.12)}
#confirm{display:none;border:1px solid var(--crit);border-radius:10px;
padding:14px;margin-top:10px;background:rgba(208,59,59,.07)}
#confirm p{color:var(--ink);font-size:13px}
#confirm .warn{color:var(--crit);font-weight:700;font-size:13px}
#confirm button{margin-top:10px;margin-right:10px;border-radius:8px;
padding:8px 16px;font-size:13px;cursor:pointer;border:1px solid var(--border);
background:var(--surface);color:var(--ink2)}
#confirm button.kill{background:var(--crit);border-color:var(--crit);
color:#fff;font-weight:700}
.tt{position:fixed;pointer-events:none;background:var(--surface);
border:1px solid var(--border);border-radius:8px;padding:6px 10px;
font-size:12px;display:none;z-index:9}
.tt b{color:var(--ink)}
</style></head><body>
<div class="row" style="justify-content:space-between">
  <div><h1><span id="dot" class="dot"></span><span id="name">…</span>
    <span class="chip" id="hash"></span></h1>
    <div class="sub" id="stageline">connecting…</div></div>
  <div style="text-align:right">
    <button class="stop" onclick="document.getElementById('confirm').style.display='block'">⛔ Stop training</button>
  </div>
</div>

<div id="confirm">
  <p class="warn">⚠ THIS KILLS THE TRAINING RUN.</p>
  <p>Hours of compute will be lost. The abort is recorded in the run
  ledger/manifest. There is no resume. If you want anything gentler —
  evaluating the current checkpoint, changing settings, pausing at the next
  save — <b>ask the agent instead</b>.</p>
  <button class="kill" onclick="doStop()">Yes — kill the run</button>
  <button onclick="this.parentNode.style.display='none'">Cancel</button>
</div>

<div class="card">
  <div class="legend">
    <span><i class="sw" style="background:var(--train)"></i>train loss</span>
    <span><i class="sw" style="background:var(--dev)"></i>dev loss (real, fenced)</span>
    <span style="color:var(--muted)">┆ early-stop floor</span>
  </div>
  <svg id="chart" width="100%" height="300" viewBox="0 0 920 300"
       preserveAspectRatio="none" aria-label="loss curves"></svg>
  <div class="bar"><i id="prog" style="width:0%"></i><s id="floortick" style="left:0%"></s></div>
  <div class="meta" id="meta"></div>
</div>

<div class="card">
  <div class="notice"><b>This panel is read-only by design.</b> This training
  run is being driven by an AI agent through nmt-forge — the guards, schedule,
  and evaluation are the agent's job. If you want anything done (evaluate now,
  change a setting, interpret the curves), <b>talk to the agent</b>. The only
  direct control here is the stop button above.</div>
</div>

<div class="card"><div id="events"></div></div>
<div class="tt" id="tt"></div>

<script>
const S={points:[],events:[]};
function fmt(x){return x==null?"—":(+x).toFixed(3)}
function draw(){
  const svg=document.getElementById('chart');
  const P=S.points, W=920,H=300,L=46,R=14,T=12,B=26;
  const tr=P.filter(p=>p.train_loss!=null), dv=P.filter(p=>p.dev_loss!=null);
  if(!tr.length&&!dv.length){svg.innerHTML=
    '<text x="460" y="150" text-anchor="middle">waiting for first loss point…</text>';return}
  const all=tr.concat(dv);
  const xs=all.map(p=>p.step), maxX=Math.max(...xs, S.planned_steps||0);
  const ys=all.map(p=>p.train_loss??p.dev_loss);
  const minY=Math.min(...ys), maxY=Math.max(...ys), pad=(maxY-minY)*0.08||0.1;
  const y0=minY-pad, y1=maxY+pad;
  const X=s=>L+(W-L-R)*(s/(maxX||1)), Y=v=>T+(H-T-B)*(1-(v-y0)/(y1-y0));
  let g='';
  for(let i=0;i<=4;i++){const v=y0+(y1-y0)*i/4, y=Y(v);
    g+=`<line x1="${L}" x2="${W-R}" y1="${y}" y2="${y}" stroke="var(--grid)" stroke-width="1"/>`+
       `<text x="${L-6}" y="${y+4}" text-anchor="end">${v.toFixed(2)}</text>`}
  for(let i=0;i<=4;i++){const s=Math.round(maxX*i/4), x=X(s);
    g+=`<text x="${x}" y="${H-8}" text-anchor="middle">${s.toLocaleString()}</text>`}
  g+=`<line x1="${L}" x2="${W-R}" y1="${Y(y0)}" y2="${Y(y0)}" stroke="var(--axis)" stroke-width="1"/>`;
  if(S.floor_steps){const x=X(S.floor_steps);
    g+=`<line x1="${x}" x2="${x}" y1="${T}" y2="${H-B}" stroke="var(--muted)" stroke-width="1" stroke-dasharray="3 4"/>`}
  const line=(pts,key,color)=>{
    if(!pts.length)return'';
    const d=pts.map((p,i)=>(i?'L':'M')+X(p.step)+' '+Y(p[key])).join(' ');
    const last=pts[pts.length-1];
    return `<path d="${d}" fill="none" stroke="${color}" stroke-width="2" stroke-linejoin="round"/>`+
      pts.map(p=>`<circle cx="${X(p.step)}" cy="${Y(p[key])}" r="2.5" fill="${color}"/>`).join('')+
      `<text x="${Math.min(X(last.step)+6,W-R-30)}" y="${Y(last[key])-6}" fill="${color}">${fmt(last[key])}</text>`};
  g+=line(tr,'train_loss','var(--train)')+line(dv,'dev_loss','var(--dev)');
  svg.innerHTML=g;
  svg.onmousemove=e=>{
    const r=svg.getBoundingClientRect();
    const mx=(e.clientX-r.left)/r.width*W;
    let best=null,bd=1e9;
    for(const p of all){const d=Math.abs(X(p.step)-mx);if(d<bd){bd=d;best=p}}
    if(!best){return}
    const t=document.getElementById('tt');
    const trp=tr.filter(p=>p.step<=best.step).pop(), dvp=dv.filter(p=>p.step<=best.step).pop();
    t.innerHTML=`<b>step ${best.step.toLocaleString()}</b><br>train ${fmt(trp&&trp.train_loss)} · dev ${fmt(dvp&&dvp.dev_loss)}`;
    t.style.display='block';t.style.left=(e.clientX+14)+'px';t.style.top=(e.clientY+10)+'px'};
  svg.onmouseleave=()=>document.getElementById('tt').style.display='none';
}
async function tick(){
  try{
    const s=await (await fetch('/status')).json();
    Object.assign(S,s);
    document.getElementById('name').textContent=s.run_name;
    document.getElementById('hash').textContent=(s.config_hash||'').slice(0,12);
    document.getElementById('dot').className='dot '+s.status;
    const st=s.stop_requested?' · ⛔ stop requested':'';
    document.getElementById('stageline').textContent=
      (s.stage?('stage: '+s.stage+' · '):'')+s.status+st;
    const last=s.live_step||(s.points.length?s.points[s.points.length-1].step:0);
    const rate=s.sec_per_it?` · ${s.sec_per_it.toFixed(1)}s/it`:'';
    const eta=(s.sec_per_it&&s.planned_steps&&last)?
      ` · ~${((s.planned_steps-last)*s.sec_per_it/3600).toFixed(1)}h left at this rate`:'';
    if(s.planned_steps){
      document.getElementById('prog').style.width=Math.min(100,100*last/s.planned_steps)+'%';
      if(s.floor_steps)document.getElementById('floortick').style.left=
        Math.min(100,100*s.floor_steps/s.planned_steps)+'%';
      document.getElementById('meta').textContent=
        `step ${last.toLocaleString()} of ${s.planned_steps.toLocaleString()} planned${rate}${eta}`+(s.floor_steps?` · floor ${s.floor_steps.toLocaleString()}`:'');
    }else{
      document.getElementById('meta').textContent=`step ${last.toLocaleString()}${rate}`;
    }
    document.getElementById('events').textContent=
      s.events.map(e=>`[${e.t}] ${e.text}`).join('\\n');
    draw();
  }catch(e){document.getElementById('stageline').textContent='monitor unreachable (run may have exited) — last data shown';}
}
async function doStop(){
  document.getElementById('confirm').style.display='none';
  await fetch('/stop',{method:'POST'});
}
tick();setInterval(tick,2000);
</script></body></html>
"""
