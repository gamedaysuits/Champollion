#!/usr/bin/env bash
# Base provisioning for BOTH guests (run as root, online, once).
#   - apt essentials, python3 venv tooling, nftables, rsync
#   - Docker Engine (docker-ce) from Docker's GPG-pinned apt repository, rootful
#   - the guest user in the `docker` group
#   - the Lane B base image pre-pulled (the darkened node cannot pull), digest recorded
# Every step is loud; nothing is skipped silently.
set -euo pipefail

HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=../versions.env
source "${HERE}/../versions.env"
GUEST_USER="${SUDO_USER:-${GUEST_USER:-$(id -un 1000 2>/dev/null || echo ubuntu)}}"
RECORD="/var/lib/champollion-provision.json"

log() { printf '\n==> %s\n' "$*"; }

log "apt: base packages"
export DEBIAN_FRONTEND=noninteractive
apt-get update -q
apt-get install -y -q ca-certificates curl gnupg lsb-release \
  python3 python3-venv python3-pip nftables rsync jq unzip xz-utils

log "docker-ce: GPG-pinned apt repository"
install -m 0755 -d /etc/apt/keyrings
# --batch --yes: re-runs must overwrite the keyring without a TTY prompt
curl -fsSL "${DOCKER_APT_GPG_URL}" | gpg --dearmor --batch --yes -o /etc/apt/keyrings/docker.gpg
chmod a+r /etc/apt/keyrings/docker.gpg
ARCH="$(dpkg --print-architecture)"
CODENAME="$(. /etc/os-release && echo "${VERSION_CODENAME}")"
echo "deb [arch=${ARCH} signed-by=/etc/apt/keyrings/docker.gpg] ${DOCKER_APT_REPO} ${CODENAME} stable" \
  > /etc/apt/sources.list.d/docker.list
apt-get update -q
apt-get install -y -q docker-ce docker-ce-cli containerd.io docker-buildx-plugin
systemctl enable --now docker
usermod -aG docker "${GUEST_USER}"
# The group change only applies to NEW logins, and Lima keeps one persistent
# SSH session per instance — so also grant the socket by ACL, which takes
# effect immediately (the group membership covers every later session).
apt-get install -y -q acl postgresql-client  # psql: supabase-local/sanity.sql + apply_migrations.sh
setfacl -m "u:${GUEST_USER}:rw" /var/run/docker.sock

log "docker: pre-pull ${PYTHON_BASE_IMAGE} (the darkened node cannot pull)"
docker pull "${PYTHON_BASE_IMAGE}"
IMAGE_DIGEST="$(docker image inspect --format '{{index .RepoDigests 0}}' "${PYTHON_BASE_IMAGE}")"

log "record versions"
python3 - "$RECORD" <<EOF
import json, subprocess, sys, platform
rec = {
  "os": platform.platform(),
  "python": platform.python_version(),
  "docker": subprocess.run(["docker","--version"],capture_output=True,text=True).stdout.strip(),
  "containerd": subprocess.run(["containerd","--version"],capture_output=True,text=True).stdout.strip(),
  "base_image": "${PYTHON_BASE_IMAGE}",
  "base_image_digest": "${IMAGE_DIGEST}",
  "guest_user": "${GUEST_USER}",
}
json.dump(rec, open(sys.argv[1], "w"), indent=2)
print(json.dumps(rec, indent=2))
EOF

log "base provisioning done (re-login or newgrp docker for the group to apply)"
