#!/usr/bin/env bash
# Host orchestrator for the sovereign-node rehearsal.
#
#   Lima on a Mac (default):        rehearse.sh all
#   Any two Linux VMs over ssh:     TRANSPORT=ssh rehearse.sh all
#     (needs hosts.env — copy hosts.env.example; `up` then only checks
#      reachability + sudo, and `down` stops nothing: the VMs are yours)
#
#   rehearse.sh up organizer|airgap      create + start the Lima instance
#   rehearse.sh provision organizer|airgap   online provisioning (00-base, 10-role)
#   rehearse.sh verify-guest organizer|airgap
#   rehearse.sh supabase                  local stack from nothing: 71 migrations + sanity
#   rehearse.sh bundle                    organizer builds the offline bundle → IN drive → node
#   rehearse.sh dark                      darken the node (routes/DNS/nftables), prove egress is gone
#   rehearse.sh tier1                     ceremony / seal / keygen / refusals / re-key on the node
#   rehearse.sh phase-a                   organizer: prepare → intake → serve → approve → publish; stage + relay requests
#   rehearse.sh tier2                     node: import → sub-quorum refusal → quorum run → export signed scores
#   rehearse.sh verify                    host: manifests + Python-signed/JS-verified scores; organizer relay pass 2
#   rehearse.sh close                     organizer: rank (withheld) → refusals → close (publishes the
#                                         withheld main + holdout, reveals, freezes) → rank → export
#   rehearse.sh report                    assemble ~/sovereign-smoke/<date>/report.md
#   rehearse.sh down                      stop both instances (delete with `limactl delete`)
#   rehearse.sh all                       everything above in order
#
# Every stage asserts; the first failure stops the run with the stage named.
# All artefacts land OUTSIDE the repo under $SMOKE_DIR (default ~/sovereign-smoke/<UTC date>).
set -euo pipefail

HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO="${REPO:-$(cd "${HERE}/../../.." && pwd)}"
# shellcheck source=versions.env
source "${HERE}/versions.env"
DATE="${DATE:-$(date -u +%Y-%m-%d)}"
SMOKE_DIR="${SMOKE_DIR:-${HOME}/sovereign-smoke/${DATE}}"
ORG="${ORG:-champollion-organizer}"
NODE="${NODE:-champollion-airgap-node}"
VENV_BIN='$HOME/.venvs/mt-eval/bin'
mkdir -p "${SMOKE_DIR}"/{in,out,exchange,reports,logs}
# `limactl shell` starts the guest shell in the HOST cwd when that path is
# mounted in the guest. Run from $HOME so a guest shell never opens inside the
# virtiofs repo mount (a wedged mount there hangs every shell — seen 2026-09-06).
cd "${HOME}"

log()  { printf '\n\033[1m==> [%s] %s\033[0m\n' "$(date -u +%H:%M:%S)" "$*"; }
die()  { printf '\n\033[31m✗ %s\033[0m\n' "$*" >&2; exit 1; }
need() { command -v "$1" >/dev/null || die "missing on host: $1 (brew install $2)"; }
# ── Transport: lima (default, macOS) or ssh (any two Linux VMs) ─────────────
# TRANSPORT=ssh reads ORG_SSH / NODE_SSH from hosts.env (ssh host aliases; the
# node is usually reached through the organizer with ProxyJump in
# ~/.ssh/config). Every guest touch goes through these five functions, so the
# stages below are transport-agnostic.
TRANSPORT="${TRANSPORT:-lima}"
[[ -f "${HERE}/hosts.env" ]] && source "${HERE}/hosts.env"
# Where the organizer sees the checkout: Lima's read-only mount, or the copy
# the host pushes over ssh (stage_repo).
if [[ "${TRANSPORT}" == ssh ]]; then REPO_ON_ORG='~/repo-staging'; else REPO_ON_ORG=/workspace/champollion; fi
SSH_OPTS=(-o BatchMode=yes -o ServerAliveInterval=30)
ssh_target() {
  case "$1" in
    "${ORG}")  echo "${ORG_SSH:?TRANSPORT=ssh needs ORG_SSH in hosts.env}" ;;
    "${NODE}") echo "${NODE_SSH:?TRANSPORT=ssh needs NODE_SSH in hosts.env}" ;;
    *) die "unknown instance $1" ;;
  esac
}
gshell() { # instance, command...   (login shell so PATH from ~/.profile applies; cd ~ first)
  local inst="$1"; shift
  if [[ "${TRANSPORT}" == ssh ]]; then
    ssh "${SSH_OPTS[@]}" "$(ssh_target "${inst}")" "bash -lc $(printf %q "cd ~ && $*")"
  else
    limactl shell "${inst}" -- bash -lc "cd ~ && $*"
  fi
}
gsudo() {
  local inst="$1"; shift
  if [[ "${TRANSPORT}" == ssh ]]; then
    ssh "${SSH_OPTS[@]}" "$(ssh_target "${inst}")" "sudo bash -lc $(printf %q "cd /root && $*")"
  else
    limactl shell "${inst}" -- sudo bash -lc "cd /root && $*"
  fi
}
guest_home() { gshell "$1" 'printf %s "$HOME"'; }   # e.g. /home/<user>.linux
guest_user() { gshell "$1" 'printf %s "$USER"'; }
gcopy() { # [-r] SRC... DEST — guest paths are "<instance>:<path relative to guest HOME>"
  # `limactl copy` is a thin wrapper over scp, and the stages rely on scp's
  # semantics (several sources into an existing directory; "dir/." copies
  # contents). Under ssh, call scp itself with the instance names translated.
  if [[ "${TRANSPORT}" != ssh ]]; then
    limactl copy "$@"; return
  fi
  local args=() a inst
  for a in "$@"; do
    inst="${a%%:*}"
    if [[ "${a}" == *:* && ( "${inst}" == "${ORG}" || "${inst}" == "${NODE}" ) ]]; then
      args+=("$(ssh_target "${inst}"):${a#*:}")
    else
      args+=("${a}")
    fi
  done
  scp -q "${SSH_OPTS[@]}" "${args[@]}"
}
render_yaml() { # role → path of a rendered yaml with the host paths substituted
  local role="$1" out="${SMOKE_DIR}/${role}.lima.yaml"
  sed -e "s|__REPO__|${REPO}|g" -e "s|__SMOKE__|${SMOKE_DIR}|g" "${HERE}/lima/${role}.yaml" > "${out}"
  echo "${out}"
}
inst_of() { case "$1" in organizer) echo "${ORG}";; airgap|airgap-node) echo "${NODE}";; *) die "role must be organizer|airgap";; esac; }
role_yaml() { case "$1" in organizer) echo organizer;; airgap|airgap-node) echo airgap-node;; esac; }

cmd_up() {
  if [[ "${TRANSPORT}" == ssh ]]; then
    # The VMs are yours: up = prove they are reachable (and sudo works).
    local role="$1" inst; inst="$(inst_of "$role")"
    gshell "${inst}" 'echo "$(hostname): $(. /etc/os-release && echo "$PRETTY_NAME"), $(nproc) cpu, $(free -g | awk "/Mem:/ {print \$2}") GB"' \
      || die "cannot reach ${inst} over ssh ($(ssh_target "${inst}")) — check hosts.env and ~/.ssh/config"
    gsudo "${inst}" true || die "passwordless sudo is required on ${inst}"
    return
  fi
  need limactl lima
  local role="$1" inst; inst="$(inst_of "$role")"
  local yaml; yaml="$(render_yaml "$(role_yaml "$role")")"
  if limactl list --format '{{.Name}}' | grep -qx "${inst}"; then
    log "instance ${inst} exists → start"
    limactl start --tty=false "${inst}"
  else
    log "create + start ${inst} from ${yaml}"
    limactl start --tty=false --name="${inst}" "${yaml}"
  fi
  limactl list | grep "${inst}"
}

cmd_provision() {
  local role="$1" inst; inst="$(inst_of "$role")"
  log "copy deploy kit → ${inst}:~/deploy"
  gshell "${inst}" "rm -rf ~/deploy && mkdir -p ~/deploy"
  gcopy -r "${HERE}/provision" "${HERE}/guest" "${HERE}/templates" "${HERE}/versions.env" "${inst}:deploy/"
  gcopy "${REPO}/arena/scripts/sovereign_rehearsal.py" "${inst}:deploy/sovereign_rehearsal.py"
  log "00-base.sh (root, online)"
  local gh gu; gh="$(guest_home "${inst}")"; gu="$(guest_user "${inst}")"
  # under sudo, ~ is /root — address the kit by the guest user's absolute home
  gsudo "${inst}" "GUEST_USER=${gu} bash ${gh}/deploy/provision/00-base.sh" 2>&1 | tee "${SMOKE_DIR}/logs/${inst}-00-base.log"
  if [ "$role" = organizer ]; then
    log "10-organizer.sh"
    local mount_env=""
    if [[ "${TRANSPORT}" == ssh ]]; then
      stage_repo_initial
      mount_env="REPO_MOUNT=\$HOME/repo-staging"
    fi
    gshell "${inst}" "${mount_env} bash ~/deploy/provision/10-organizer.sh" 2>&1 | tee "${SMOKE_DIR}/logs/${inst}-10-organizer.log"
  else
    log "10-airgap-node.sh"
    gshell "${inst}" "bash ~/deploy/provision/10-airgap-node.sh" 2>&1 | tee "${SMOKE_DIR}/logs/${inst}-10-airgap.log"
  fi
  gcopy "${inst}:.champollion-provision.json" "${SMOKE_DIR}/reports/${inst}-provision.json"
}

push_kit() { # inst — re-copy the deploy kit + the guest runner from the CHECKOUT
  # A stage must never run a stale runner: the kit lands on the guest at
  # provision time, and the checkout moves on. Cheap (a few files), so every
  # stage that starts a leg refreshes it first.
  local inst="$1"
  gshell "${inst}" "mkdir -p ~/deploy"
  gcopy -r "${HERE}/guest" "${HERE}/templates" "${HERE}/versions.env" "${inst}:deploy/"
  gcopy "${REPO}/arena/scripts/sovereign_rehearsal.py" "${inst}:deploy/sovereign_rehearsal.py"
}

cmd_verify_guest() {
  local role="$1" inst; inst="$(inst_of "$role")"
  local r; r="$( [ "$role" = organizer ] && echo organizer || echo airgap )"
  log "verify-guest on ${inst}"
  gshell "${inst}" "bash ~/deploy/guest/verify-guest.sh --role ${r} --json ~/verify-guest.json" | tee "${SMOKE_DIR}/logs/${inst}-verify-guest.log"
  gcopy "${inst}:verify-guest.json" "${SMOKE_DIR}/reports/${inst}-verify-guest.json"
}

sync_src() { # re-sync the CHECKOUT into the organizer guest
  # Every stage that builds from source (the offline bundle) or applies
  # migrations must run against the checkout as it is NOW, not as it was at
  # provision time. Cheap and idempotent.
  log "re-sync the checkout's arena/ + mt-eval-arena/ into ${ORG}"
  if [[ "${TRANSPORT}" == ssh ]]; then
    # No shared mount: push the checkout from the host over ssh.
    stage_repo
    return
  fi
  gshell "${ORG}" "rsync -a --delete --exclude '.venv' --exclude '__pycache__' --exclude '*.egg-info' --exclude 'datasets/.cache' /workspace/champollion/arena/ ~/src/champollion/arena/ && rsync -a --delete --exclude 'supabase-local/supabase/migrations' /workspace/champollion/mt-eval-arena/ ~/src/champollion/mt-eval-arena/"
}

stage_repo_initial() { # first push, before ~/src/champollion exists
  local t; t="$(ssh_target "${ORG}")"
  rsync -a --delete -e "ssh ${SSH_OPTS[*]}" \
    --exclude '/cli/data' --exclude 'node_modules' --exclude '.venv' --exclude '__pycache__' \
    --exclude '*.egg-info' --exclude '/arena/datasets/.cache' --exclude '/cli/website' \
    --include '/arena/***' --include '/cli/***' --include '/shared/***' --include '/mt-eval-arena/***' \
    --exclude '*' "${REPO}/" "${t}:repo-staging/"
}
stage_repo() { # ssh: the host pushes the checkout subset the organizer needs
  # Same subset and exclusions as 10-organizer.sh (cli/data is 5 GB and not
  # part of a node; node_modules / venvs are rebuilt on the guest). Lands at
  # ~/repo-staging, which plays the role Lima's read-only /workspace mount
  # plays: provisioning and sync_src copy from it into ~/src/champollion.
  stage_repo_initial
  gshell "${ORG}" "rsync -a --delete --exclude '.venv' --exclude '__pycache__' --exclude '*.egg-info' --exclude 'datasets/.cache' ~/repo-staging/arena/ ~/src/champollion/arena/ && rsync -a --delete --exclude 'supabase-local/supabase/migrations' ~/repo-staging/mt-eval-arena/ ~/src/champollion/mt-eval-arena/"
}

cmd_supabase() {
  push_kit "${ORG}"; sync_src
  log "local Supabase from nothing on ${ORG} (historical + canonical migrations + sanity)"
  gshell "${ORG}" "bash ~/src/champollion/mt-eval-arena/supabase-local/reset.sh ~/supabase-out" 2>&1 | tee "${SMOKE_DIR}/logs/supabase-reset.log"
  # Named files only. `gcopy -r <dir> <existing-dir>/` unpacks the
  # CONTENTS, so the record never landed where the report looked for it — and
  # status.env carries the local stack's service-role key, which has no
  # business sitting in a report directory.
  rm -f "${SMOKE_DIR}/reports/supabase-record.json" "${SMOKE_DIR}/reports/supabase-reset.log"
  gcopy "${ORG}:supabase-out/record.json" "${SMOKE_DIR}/reports/supabase-record.json"
  gcopy "${ORG}:supabase-out/db-reset.log" "${SMOKE_DIR}/reports/supabase-reset-db.log" 2>/dev/null || true
  rm -f "${SMOKE_DIR}/reports/status.env"
}

cmd_bundle() {
  push_kit "${ORG}"; push_kit "${NODE}"; sync_src
  # The AIR-GAPPED node cannot look a language up: publish.assemble_run_card
  # resolves the pair through the language-card SSOT, and with no local cards
  # directory that reaches for prod Supabase and dies (measured 2026-09-07 —
  # the node could not score at all). A node therefore carries the cards for
  # the languages it scores, on the drive, like everything else. The rehearsal
  # carries a NAMED SUBSET (its own pair is synthetic and has no card at all);
  # a real deployment carries the cards for its contests' languages.
  log "organizer: assemble the card index the node will carry (${CARD_CODES:-eng crk fra})"
  gshell "${ORG}" "rm -rf ~/out/cards && mkdir -p ~/out/cards && n=0; \
      for c in ${CARD_CODES:-eng crk fra}; do \
        src=${REPO_ON_ORG}/cli/shared/language-cards/\$c.json; \
        if [ -f \"\$src\" ]; then cp \"\$src\" ~/out/cards/; n=\$((n+1)); fi; \
      done; \
      test \"\$n\" -ge 2 || { echo \"only \$n card(s) resolved — a node with an empty index cannot name a language\" >&2; exit 1; }; \
      echo \"card index: \$n card(s)\""
  log "organizer: mt-eval node bundle (+ fixture corpus, toy method, templates, the pinned constraints, the card index)"
  # The bundle is a directory ON the drive; the drive manifest sits BESIDE it.
  # (Writing drive-manifest.json inside the bundle made `node bundle --verify`
  # fail on it as an unlisted file — seen 2026-09-07.)
  gshell "${ORG}" "rm -rf ~/out/bundle-drive && mkdir -p ~/out/bundle-drive && ${VENV_BIN}/mt-eval node bundle --out ~/out/bundle-drive/bundle \
      --include ~/src/champollion/arena/tests/fixtures/contest_synthetic/corpus_blind_refs.json \
      --include ~/src/champollion/arena/constraints-node.txt \
      --include ~/out/cards \
      --include ~/src/champollion/arena/examples/lane-b-toy-method \
      --include ~/deploy/templates \
      --include ~/deploy/guest \
      --include ~/deploy/sovereign_rehearsal.py \
      --include ~/deploy/versions.env" 2>&1 | tee "${SMOKE_DIR}/logs/bundle.log"
  log "organizer: IN-drive manifest"
  gshell "${ORG}" "${VENV_BIN}/mt-eval node manifest write ~/out/bundle-drive --direction in --note 'rehearsal IN drive: offline bundle'"
  log "carry IN drive: organizer → host → node (the USB stick)"
  rm -rf "${SMOKE_DIR}/in/bundle-drive"; gcopy -r "${ORG}:out/bundle-drive" "${SMOKE_DIR}/in/bundle-drive"
  gshell "${NODE}" "rm -rf ~/in/bundle-drive ~/in/bundle"
  gcopy -r "${SMOKE_DIR}/in/bundle-drive" "${NODE}:in/bundle-drive"
  # The node has NO mt-eval yet — it arrives in this bundle — so the
  # integrity check before installing is the one INSTALL.md documents for
  # exactly that moment: re-hash every listed file with the stdlib and
  # compare against bundle-manifest.json. Only then install from the wheels.
  log "node: re-hash the bundle by hand (no mt-eval yet), then install from wheels (no index)"
  gshell "${NODE}" "${VENV_BIN}/python - ~/in/bundle-drive/bundle <<'PYEOF'
import hashlib, json, sys
from pathlib import Path
root = Path(sys.argv[1])
man = json.loads((root / 'bundle-manifest.json').read_text())
files = man['files'] if isinstance(man, dict) and 'files' in man else man
if isinstance(files, dict):
    files = [{'path': k, **v} for k, v in files.items()]
bad, n = [], 0
for entry in files:
    rel = entry.get('path') or entry.get('name')
    p = root / rel
    if not p.is_file():
        bad.append(f'{rel}: MISSING'); continue
    actual = hashlib.sha256(p.read_bytes()).hexdigest()
    if actual != entry['sha256']:
        bad.append(f'{rel}: {actual} != {entry[\"sha256\"]}')
    n += 1
if bad:
    raise SystemExit('bundle hand-verify FAILED:\\n  ' + '\\n  '.join(bad))
print(f'bundle hand-verify: {n} file(s) match bundle-manifest.json')
PYEOF" 2>&1 | tee "${SMOKE_DIR}/logs/node-bundle-verify.log"
  # Uninstall first so a re-run installs the wheel that is actually on the
  # drive: pip leaves an identically-versioned copy in place ("already
  # satisfied") and the node would then be scoring with older code than the
  # bundle it just verified.
  gshell "${NODE}" "set -o pipefail; ${VENV_BIN}/pip uninstall -y mt-eval-harness >/dev/null 2>&1; \
      ${VENV_BIN}/pip install --no-index --find-links ~/in/bundle-drive/bundle/wheels 'mt-eval-harness[node]' 2>&1 | tail -3" \
      2>&1 | tee -a "${SMOKE_DIR}/logs/node-bundle-verify.log"
  log "node: mt-eval present → verify the bundle + the drive manifest with the real verbs"
  gshell "${NODE}" "${VENV_BIN}/mt-eval node bundle --verify ~/in/bundle-drive/bundle && ${VENV_BIN}/mt-eval node manifest verify ~/in/bundle-drive" \
      2>&1 | tee -a "${SMOKE_DIR}/logs/node-bundle-verify.log"
  # Make the node OFFLINE-BY-CONFIGURATION, for every invocation and every
  # operator — not only for the rehearsal runner's subprocesses.
  log "node: point the harness at the carried card index and forbid remote lookups"
  gshell "${NODE}" "cat > ~/.mt-eval-node.env <<'ENVEOF'
# Written by rehearse.sh: this machine is an AIR-GAPPED scoring node.
# The language-card index is the one that came in on the drive; remote
# registry/card lookups are refused rather than attempted.
export MT_EVAL_CARDS_DIR=\"\$HOME/in/bundle-drive/bundle/artifacts/cards\"
export MT_EVAL_NO_REMOTE_REGISTRY=1
ENVEOF
      grep -q 'mt-eval-node.env' ~/.profile || printf '\n[ -f ~/.mt-eval-node.env ] && . ~/.mt-eval-node.env\n' >> ~/.profile"
  gshell "${NODE}" "test -d \"\$MT_EVAL_CARDS_DIR\" && echo \"card index on the node: \$(ls \"\$MT_EVAL_CARDS_DIR\" | wc -l) card(s) at \$MT_EVAL_CARDS_DIR\" && test \"\$MT_EVAL_NO_REMOTE_REGISTRY\" = 1"
  gshell "${NODE}" "bash ~/deploy/guest/verify-guest.sh --role airgap --json ~/verify-guest-after-bundle.json" | tee -a "${SMOKE_DIR}/logs/${NODE}-verify-guest.log"
}

cmd_dark() {
  push_kit "${NODE}"
  log "darken ${NODE}"
  gsudo "${NODE}" "bash $(guest_home "${NODE}")/deploy/guest/airgap-dark.sh" | tee "${SMOKE_DIR}/logs/airgap-dark.log"
  log "prove egress is gone"
  # $HOME, not /home/$USER: Lima's guest home is <user>.linux / <user>.guest
  # when it differs from the host account, so composing the path by hand
  # reads a file that is not there.
  gshell "${NODE}" "set -o pipefail; ${VENV_BIN}/mt-eval node egress-check --json | tee ~/egress-after-dark.json; \
      ${VENV_BIN}/python -c 'import json, pathlib; d=json.loads((pathlib.Path.home()/\"egress-after-dark.json\").read_text()); assert d[\"airgapped\"] is True, d; assert d[\"default_route\"] is False, d; assert d[\"dns_resolved\"] is False, d; print(\"egress-check: airgapped\", d[\"airgapped\"], \"default_route\", d[\"default_route\"], \"dns\", d[\"dns_resolved\"])'"
  gcopy "${NODE}:egress-after-dark.json" "${SMOKE_DIR}/reports/egress-after-dark.json"
}

run_guest_rehearsal() { # inst, args...
  local inst="$1"; shift
  push_kit "${inst}"
  gshell "${inst}" "${VENV_BIN}/python ~/deploy/sovereign_rehearsal.py $* --report-dir ~/rehearsal-report" 2>&1 | tee -a "${SMOKE_DIR}/logs/${inst}-rehearsal.log"
  gcopy -r "${inst}:rehearsal-report" "${SMOKE_DIR}/reports/${inst}-rehearsal"
}

cmd_tier1() { log "node Tier 1"; run_guest_rehearsal "${NODE}" --role airgap --tier 1;
  log "carry the node's public keys out (score-sign pub + ceremony.json)"; rm -rf "${SMOKE_DIR}/out/node-public"; gcopy -r "${NODE}:out" "${SMOKE_DIR}/out/node-public"; }

cmd_phase_a() {
  log "organizer Phase A (needs the node's ceremony.json + score-sign pub from tier1)"
  gshell "${ORG}" "rm -rf ~/node-public && mkdir -p ~/node-public"
  gcopy -r "${SMOKE_DIR}/out/node-public/." "${ORG}:node-public/"
  run_guest_rehearsal "${ORG}" --role organizer --phase a
  log "carry the exchange (requests) organizer → host → node"
  rm -rf "${SMOKE_DIR}/exchange/in"; gcopy -r "${ORG}:exchange" "${SMOKE_DIR}/exchange/in"
  gshell "${NODE}" "rm -rf ~/in/exchange"
  gcopy -r "${SMOKE_DIR}/exchange/in" "${NODE}:in/exchange"
}

cmd_tier2() { log "node Tier 2"; run_guest_rehearsal "${NODE}" --role airgap --tier 2;
  log "carry the OUT drive (signed scores) node → host"; rm -rf "${SMOKE_DIR}/out/exchange"; gcopy -r "${NODE}:out/exchange" "${SMOKE_DIR}/out/exchange"; }

cmd_verify() {
  log "host: manifest + signature verification (Python-signed → JS-verified)"
  local hv="${HOME}/.venvs/champollion-host"
  [ -x "${hv}/bin/mt-eval" ] || { python3 -m venv "${hv}" && "${hv}/bin/pip" install -q -e "${REPO}/arena[node]"; }
  "${hv}/bin/mt-eval" node manifest verify "${SMOKE_DIR}/out/exchange" | tee "${SMOKE_DIR}/logs/host-manifest-verify.log"
  local pub; pub="$(ls "${SMOKE_DIR}"/out/node-public/*.pub.json | head -1)"
  local ok=0
  for m in "${SMOKE_DIR}"/out/exchange/scores/*/score-bundle.json; do
    [ -f "$m" ] || continue
    "${hv}/bin/mt-eval" node verify-manifest "$m" --sig "$m.sig.json" --pubkey "$pub" && \
    node "${REPO}/cli/bin/cli.js" seal-corpus verify --payload "$m" --sig "$m.sig.json" --pubkey "$pub" && ok=$((ok+1))
    # a flipped byte must fail both. (BSD head has no negative -c, so the
    # copy is made portably rather than with a GNU-ism that silently produced
    # an empty file on macOS.)
    local tmp; tmp="$(mktemp)"
    python3 -c 'import sys,pathlib; b=bytearray(pathlib.Path(sys.argv[1]).read_bytes()); b[len(b)//2] ^= 0x20; pathlib.Path(sys.argv[2]).write_bytes(bytes(b))' "$m" "$tmp"
    cmp -s "$m" "$tmp" && die "the tamper copy is identical to the original — the flip did not happen"
    if "${hv}/bin/mt-eval" node verify-manifest "$tmp" --sig "$m.sig.json" --pubkey "$pub" >/dev/null 2>&1; then die "tampered bundle verified (Python)"; fi
    if node "${REPO}/cli/bin/cli.js" seal-corpus verify --payload "$tmp" --sig "$m.sig.json" --pubkey "$pub" >/dev/null 2>&1; then die "tampered bundle verified (JS)"; fi
  done
  [ "$ok" -ge 1 ] || die "no score bundle verified"
  echo "host verify: ${ok} score bundle(s) verified by BOTH implementations; tamper refused by both"
  log "organizer: relay pass 2 (publish the DB-backed request's scores)"
  gshell "${ORG}" "rm -rf ~/exchange-return && mkdir -p ~/exchange-return"
  gcopy -r "${SMOKE_DIR}/out/exchange/." "${ORG}:exchange-return/"
  run_guest_rehearsal "${ORG}" --role organizer --relay 2
}

cmd_close() {
  log "organizer: rank while open → refusals → close → rank closed → export"
  run_guest_rehearsal "${ORG}" --role organizer --close
  log "carry the ranking/export artefacts out"
  rm -rf "${SMOKE_DIR}/reports/close-out"; gcopy -r "${ORG}:close-out" "${SMOKE_DIR}/reports/close-out"
}

cmd_report() {
  log "assemble report"
  python3 - "${SMOKE_DIR}" <<'EOF'
import json, sys, glob, os, datetime
d = sys.argv[1]
md, rec = [], {"smoke_dir": d, "generated_at": datetime.datetime.now(datetime.timezone.utc).isoformat(),
               "guests": {}, "supabase": None, "legs": [], "close": {}, "totals": {}}
md.append(f"# Sovereign-node rehearsal — {os.path.basename(d)} "
          f"(generated {rec['generated_at']})\n")
for p in sorted(glob.glob(os.path.join(d, "reports", "*provision.json"))):
    j = json.load(open(p))
    rec["guests"].setdefault(os.path.basename(p).split("-provision")[0], {})["provision"] = j
    md.append(f"## {os.path.basename(p)}\n```json\n{json.dumps(j, indent=2)}\n```\n")
for p in sorted(glob.glob(os.path.join(d, "reports", "*verify-guest.json"))):
    j = json.load(open(p))
    ok = sum(1 for c in j["checks"] if c["ok"])
    rec["guests"].setdefault(os.path.basename(p).split("-verify-guest")[0], {})["verify_guest"] = {
        "failed": j["failed"], "ok": ok, "total": len(j["checks"])}
    md.append(f"- {os.path.basename(p)}: failed={j['failed']} ({ok}/{len(j['checks'])} ok)")
p = os.path.join(d, "reports", "supabase-record.json")
if os.path.exists(p):
    rec["supabase"] = json.load(open(p))
    md.append(f"\n## Local Supabase\n```json\n{json.dumps(rec['supabase'], indent=2)}\n```\n")
p = os.path.join(d, "reports", "egress-after-dark.json")
if os.path.exists(p):
    rec["egress_after_dark"] = json.load(open(p))
# one row per rehearsal leg, in run order
order = {"tier1": 0, "phase-a": 1, "tier2": 2, "relay2": 3, "close": 4}
legs = []
for p in glob.glob(os.path.join(d, "reports", "*-rehearsal", "report-*.json")):
    j = json.load(open(p))
    legs.append(j)
legs.sort(key=lambda j: order.get(j["mode"], 99))
passed = failed = skipped = 0
md.append("\n## Stage table\n")
md.append("| leg | # | step | result | s | detail |")
md.append("|---|---|---|---|---|---|")
for j in legs:
    steps = []
    for i, s_ in enumerate(j["steps"], 1):
        det = s_.get("error") or json.dumps(s_.get("detail", {}), ensure_ascii=False)
        result = "PASS" if s_["ok"] else "FAIL"
        if s_["ok"] and isinstance(s_.get("detail"), dict) and s_["detail"].get("skipped"):
            result = "SKIPPED"
        passed += result == "PASS"; failed += result == "FAIL"; skipped += result == "SKIPPED"
        steps.append({"n": i, "name": s_["name"], "result": result,
                      "seconds": s_["seconds"], "detail": s_.get("detail"),
                      "error": s_.get("error")})
        md.append(f"| {j['role']}/{j['mode']} | {i} | {s_['name']} | {result} | "
                  f"{s_['seconds']} | " + det.replace('|', '\\|').replace('\n', ' ')[:300] + " |")
    legs_rec = {"role": j["role"], "mode": j["mode"], "status": j["status"],
                "started": j["started"], "finished": j["finished"],
                "steps": steps, "artifacts": j.get("artifacts", {})}
    rec["legs"].append(legs_rec)
rec["totals"] = {"passed": passed, "failed": failed, "skipped": skipped,
                 "legs": [f"{j['role']}/{j['mode']}={j['status']}" for j in legs]}
for p in sorted(glob.glob(os.path.join(d, "reports", "close-out", "*.json"))):
    rec["close"][os.path.basename(p)] = json.load(open(p))
for p in sorted(glob.glob(os.path.join(d, "reports", "*-rehearsal", "report.md"))):
    md.append(f"\n## {p.split('/')[-2]}\n" + open(p).read())
p = os.path.join(d, "logs", "host-manifest-verify.log")
if os.path.exists(p):
    md.append("\n## Host verify\n```\n" + open(p).read()[-4000:] + "\n```\n")
open(os.path.join(d, "report.md"), "w").write("\n".join(md))
open(os.path.join(d, "report.json"), "w").write(json.dumps(rec, indent=2) + "\n")
print(os.path.join(d, "report.md"))
print(os.path.join(d, "report.json"))
print(f"steps: {passed} PASS / {failed} FAIL / {skipped} SKIPPED")
if failed:
    raise SystemExit(f"{failed} step(s) FAILED — see report.md")
EOF
}

cmd_down() {
  if [[ "${TRANSPORT}" == ssh ]]; then
    log "TRANSPORT=ssh: the VMs are yours — nothing stopped. Re-image the node VM before any real use (it held sealed material)."
    return
  fi
  log "stop instances"; limactl stop "${NODE}" 2>/dev/null || true; limactl stop "${ORG}" 2>/dev/null || true; limactl list; }

cmd_all() {
  cmd_up organizer; cmd_provision organizer; cmd_verify_guest organizer
  cmd_supabase
  cmd_up airgap; cmd_provision airgap; cmd_verify_guest airgap
  cmd_bundle; cmd_dark; cmd_tier1; cmd_phase_a; cmd_tier2; cmd_verify; cmd_close; cmd_report
}

case "${1:-}" in
  up) cmd_up "${2:?role}";; provision) cmd_provision "${2:?role}";; verify-guest) cmd_verify_guest "${2:?role}";;
  supabase) cmd_supabase;; bundle) cmd_bundle;; dark) cmd_dark;; tier1) cmd_tier1;; phase-a) cmd_phase_a;;
  tier2) cmd_tier2;; verify) cmd_verify;; close) cmd_close;; report) cmd_report;; down) cmd_down;; all) cmd_all;;
  *) sed -n '2,22p' "$0"; exit 2;;
esac
