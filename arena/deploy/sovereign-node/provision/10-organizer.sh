#!/usr/bin/env bash
# Organizer-guest provisioning (run as the guest user, online, after 00-base.sh).
#   - Node.js (pinned major line, SHASUMS256-verified) for cli/bin/cli.js seal-corpus
#   - Supabase CLI (.deb, checksums-verified) for the local stack
#   - rsync of arena/ cli/ shared/ mt-eval-arena/ from the read-only repo mount
#     to ~/src/champollion (editable installs write into the tree)
#   - a venv with the harness installed editable with the [node,dev] extras
# Loud everywhere. PEP 668: every pip install goes through the venv.
set -euo pipefail

HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=../versions.env
source "${HERE}/../versions.env"
REPO_MOUNT="${REPO_MOUNT:-/workspace/champollion}"
SRC="${HOME}/src/champollion"
VENV="${HOME}/.venvs/mt-eval"
RECORD="${HOME}/.champollion-provision.json"

log() { printf '\n==> %s\n' "$*"; }
die() { printf '\n✗ %s\n' "$*" >&2; exit 1; }

[ -d "${REPO_MOUNT}/arena" ] || die "repo mount missing at ${REPO_MOUNT}"

log "node.js ${NODE_MAJOR}.x: resolve + verify against SHASUMS256.txt"
ARCH="$(uname -m)"; case "$ARCH" in aarch64) NARCH=arm64;; x86_64) NARCH=x64;; *) die "unsupported arch $ARCH";; esac
TMP="$(mktemp -d)"
curl -fsSL "https://nodejs.org/dist/latest-v${NODE_MAJOR}.x/SHASUMS256.txt" -o "${TMP}/SHASUMS256.txt"
NODE_TGZ="$(grep -oE "node-v${NODE_MAJOR}\.[0-9]+\.[0-9]+-linux-${NARCH}\.tar\.xz" "${TMP}/SHASUMS256.txt" | head -1)"
[ -n "${NODE_TGZ}" ] || die "no linux-${NARCH} tarball listed for v${NODE_MAJOR}.x"
NODE_VERSION="${NODE_TGZ#node-}"; NODE_VERSION="${NODE_VERSION%-linux-*}"
curl -fsSL "https://nodejs.org/dist/${NODE_VERSION}/${NODE_TGZ}" -o "${TMP}/${NODE_TGZ}"
(cd "${TMP}" && grep " ${NODE_TGZ}\$" SHASUMS256.txt | sha256sum -c -)
mkdir -p "${HOME}/.local/node"
tar -xJf "${TMP}/${NODE_TGZ}" -C "${HOME}/.local/node" --strip-components=1
export PATH="${HOME}/.local/node/bin:${PATH}"
grep -q '.local/node/bin' "${HOME}/.profile" 2>/dev/null || echo 'export PATH="$HOME/.local/node/bin:$PATH"' >> "${HOME}/.profile"
node --version

log "supabase CLI: latest release .deb, checksums-verified"
TAG="$(curl -fsSL "https://api.github.com/repos/${SUPABASE_CLI_REPO}/releases/latest" | jq -r .tag_name)"
[ -n "${TAG}" ] && [ "${TAG}" != "null" ] || die "could not resolve the supabase CLI release tag"
VER="${TAG#v}"
DEB="supabase_${VER}_linux_${NARCH}.deb"
curl -fsSL "https://github.com/${SUPABASE_CLI_REPO}/releases/download/${TAG}/${DEB}" -o "${TMP}/${DEB}"
# The release publishes one `checksums.txt` covering every asset (verified 2026-09-06, v2.116.0).
curl -fsSL "https://github.com/${SUPABASE_CLI_REPO}/releases/download/${TAG}/checksums.txt" -o "${TMP}/checksums.txt"
(cd "${TMP}" && grep " ${DEB}\$" checksums.txt | sha256sum -c -)
sudo dpkg -i "${TMP}/${DEB}"
supabase --version

log "rsync checkout → ${SRC} (arena, cli, shared, mt-eval-arena)"
mkdir -p "${SRC}"
# Only what the organizer runs: the harness (arena/), the sealing CLI + its
# shared SSOT (cli/bin, cli/lib, cli/shared, cli/package.json), shared/, and
# the migrations + local-stack workdir (mt-eval-arena/). The multi-gigabyte
# atlas data tree (cli/data), the website, tests' node deps and build output
# never cross — they are not part of a node and the rsync of cli/data hit a
# virtiofs I/O error on 2026-09-06.
rsync -a --delete \
  --exclude '/cli/data' --exclude '/cli/website' --exclude '/cli/test' --exclude '/cli/node_modules' \
  --exclude '/arena/datasets/.cache' --exclude '/arena/.venv' \
  --exclude 'node_modules' --exclude '__pycache__' --exclude '*.egg-info' \
  --exclude '/arena/dist' --exclude '/arena/build' --exclude '.cache' \
  "${REPO_MOUNT}/arena" "${REPO_MOUNT}/cli" "${REPO_MOUNT}/shared" "${REPO_MOUNT}/mt-eval-arena" \
  "${REPO_MOUNT}/CLAUDE.md" "${SRC}/"
# The local Supabase workdir symlinks ../../supabase/migrations; keep it live.
[ -L "${SRC}/mt-eval-arena/supabase-local/supabase/migrations" ] \
  || ln -sfn ../../supabase/migrations "${SRC}/mt-eval-arena/supabase-local/supabase/migrations"

log "venv ${VENV}: harness editable with [node,dev]"
python3 -m venv "${VENV}"
"${VENV}/bin/pip" install -q --upgrade pip wheel
"${VENV}/bin/pip" install -q -e "${SRC}/arena[node,dev]"
grep -q '.venvs/mt-eval/bin' "${HOME}/.profile" 2>/dev/null || echo 'export PATH="$HOME/.venvs/mt-eval/bin:$PATH"' >> "${HOME}/.profile"
"${VENV}/bin/mt-eval" --help >/dev/null

log "record"
python3 - "$RECORD" <<EOF
import json, sys, subprocess
rec = json.load(open("/var/lib/champollion-provision.json"))
rec.update({
  "node": "${NODE_VERSION}",
  "supabase_cli": "${TAG}",
  "venv": "${VENV}",
  "harness": subprocess.run(["${VENV}/bin/pip","show","mt-eval-harness"],capture_output=True,text=True).stdout.split("\n")[1] if True else "",
})
json.dump(rec, open(sys.argv[1], "w"), indent=2); print(json.dumps(rec, indent=2))
EOF
log "organizer provisioning done"
