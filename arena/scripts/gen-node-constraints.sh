#!/usr/bin/env bash
# gen-node-constraints.sh — regenerate arena/constraints-node.txt: the
# hash-pinned cryptography closure the sovereign offline bundle enforces
# (`mt-eval node bundle` → build_offline_bundle → pip wheel --require-hashes).
#
# Hashes are wheel-identity and therefore PLATFORM + PYTHON-VERSION specific.
# cryptography ships an abi3 wheel (one hash serves 3.11+), but cffi is
# version-tagged (cp311 / cp312 …), so the file must carry one hash per
# (platform × Python) it is meant to serve. Ubuntu 24.04 — the sovereign-node
# deploy spec's base — ships CPython 3.12; macOS/Homebrew build hosts vary.
# The default target set below covers CPython 3.11 AND 3.12 on the three
# common sovereign-node platforms; every stanza merges all matching hashes
# under one name==version line, which is how pip's --require-hashes expects
# multi-wheel pins.
#
# Run this on an ONLINE machine (it is a cross-target `pip download`, so the
# build host need not run the target Python), then commit the result:
#
#   arena/scripts/gen-node-constraints.sh > arena/constraints-node.txt
#
# Override the target set:
#   PYVERS="3.12 3.13" PLATFORMS="manylinux2014_x86_64 macosx_11_0_arm64" \
#     arena/scripts/gen-node-constraints.sh > arena/constraints-node.txt
set -euo pipefail

PYVERS="${PYVERS:-3.11 3.12}"
PLATFORMS="${PLATFORMS:-manylinux2014_x86_64 manylinux2014_aarch64 macosx_11_0_arm64}"
# The cryptography closure on CPython: cryptography -> cffi -> pycparser.
SPEC=("cryptography>=42,<50" "cffi>=2.0.0" "pycparser")

workdir="$(mktemp -d)"
trap 'rm -rf "$workdir"' EXIT

for pyver in $PYVERS; do
  abi="cp${pyver//./}"
  for plat in $PLATFORMS; do
    python3 -m pip download --only-binary=:all: \
      --platform "$plat" --python-version "$pyver" \
      --implementation cp --abi "$abi" \
      -d "$workdir" "${SPEC[@]}" >/dev/null
  done
done

generated_on="$(date -u +%Y-%m-%d)"
cat <<EOF
# constraints-node.txt — hash-pinned CRYPTOGRAPHY closure for the sovereign
# offline bundle (\`mt-eval node bundle\`). This is the security-critical
# dependency the 2026-08-17 sovereign-layer red-team flagged (finding F4): the
# offline bundle used to \`pip wheel\` cryptography straight from PyPI with no
# hash pinning, then sha256-manifest whatever arrived — attesting transfer,
# not provenance. build_offline_bundle now fetches this closure with
# \`pip wheel --require-hashes --only-binary=:all: -r constraints-node.txt\`, so
# a compromised mirror or a dependency-confusion swap fails the hash check
# BEFORE the wheel is ever bundled or carried across the air gap.
#
# TARGET: CPython ${PYVERS// / and } on: ${PLATFORMS// /, }
# Hashes are wheel-identity, so they are PLATFORM- and PYTHON-VERSION-specific
# (cryptography ships an abi3 wheel that serves 3.11+, but cffi is
# version-tagged: each name==version stanza below carries one hash per
# target wheel, so a Python version or platform NOT listed above will fail
# the hash check — that is fail-closed, not a bug). Regenerate for your
# build machine with:
#
#   arena/scripts/gen-node-constraints.sh > arena/constraints-node.txt
#
# The remaining runtime deps (aiohttp, requests, sacrebleu, sentencepiece,
# python-dotenv) are still fetched by version range in the same bundle build;
# extend this file to pin them too if your threat model requires it.
#
# Generated ${generated_on} by gen-node-constraints.sh from PyPI via
# \`pip download\` (do not hand-edit hashes).

EOF
# One stanza per distinct (name==version), all matching-wheel hashes attached
# (cp311 + cp312 + every platform merge under the one line).
python3 - "$workdir" <<'PY'
import sys, glob, hashlib, os, re
from collections import defaultdict

wheels = sorted(glob.glob(os.path.join(sys.argv[1], "*.whl")))
if not wheels:
    sys.exit("gen-node-constraints: pip download produced no wheels")
by_nv = defaultdict(set)
for w in wheels:
    name, ver = os.path.basename(w).split("-")[:2]
    name = re.sub(r"[-_.]+", "-", name).lower()
    h = hashlib.sha256(open(w, "rb").read()).hexdigest()
    by_nv[(name, ver)].add(h)

for (name, ver), hashes in sorted(by_nv.items()):
    lines = [f"{name}=={ver}"] + [f"--hash=sha256:{h}" for h in sorted(hashes)]
    print(" \\\n    ".join(lines))
    print()
PY
