#!/usr/bin/env bash
# Air-gap-node provisioning (run as the guest user, online, after 00-base.sh).
# ONLY a Python venv is created here. The harness itself arrives later through
# the real offline path: `mt-eval node bundle` on the organizer → USB (limactl
# copy) → `mt-eval node bundle --verify` → `pip install --no-index` inside this
# venv. Nothing else is installed, so the node's software surface is exactly
# what the bundle carries.
set -euo pipefail
VENV="${HOME}/.venvs/mt-eval"
printf '\n==> venv %s (empty until the offline bundle arrives)\n' "${VENV}"
python3 -m venv "${VENV}"
"${VENV}/bin/pip" install -q --upgrade pip
grep -q '.venvs/mt-eval/bin' "${HOME}/.profile" 2>/dev/null || echo 'export PATH="$HOME/.venvs/mt-eval/bin:$PATH"' >> "${HOME}/.profile"
mkdir -p "${HOME}/in" "${HOME}/out" "${HOME}/rehearsal-report"
python3 -c 'import json,sys; r=json.load(open("/var/lib/champollion-provision.json")); r["role"]="airgap-node"; json.dump(r, open(sys.argv[1],"w"), indent=2)' "${HOME}/.champollion-provision.json"
printf '==> air-gap node provisioning done (darken with guest/airgap-dark.sh before any ceremony)\n'
