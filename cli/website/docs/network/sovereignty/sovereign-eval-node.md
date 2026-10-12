---
sidebar_position: 9
title: "Sovereign Eval Node — Hardware & Air-Gap Operations"
description: "Reference hardware, air-gap discipline, and key-custody operations for running a community-controlled evaluation node: the secret test set never leaves your machine; methods come to the data."
related:
  - label: "Run a Sovereign Contest"
    to: /docs/network/sovereignty/run-a-sovereign-contest
    kind: doc
    note: "The organizer workflow this node runs"
  - label: "The Derived-Artifacts Commitment"
    to: /docs/network/sovereignty/derived-artifacts
    kind: doc
    note: "Who owns what comes out: you"
  - label: "Benchmark Specification §8 (sandbox)"
    to: /docs/network/specifications/benchmark
    kind: doc
    note: "The isolation model the executor implements"
---

# Sovereign Eval Node — Hardware & Air-Gap Operations

A sovereign eval node is a machine **you** control that holds a secret test
set and evaluates translation methods against it. Methods travel to the
data; the data never travels at all. Scores — and only scores — come out.

This page is the practical spec: what hardware to buy (or repurpose), how to
set it up, and the operating discipline that makes "the test set never left
the machine" a fact you can defend rather than a promise you have to trust.

:::info[What ships today vs. what is labeled in progress]
The organizer node software **ships today** in `mt-eval` — see the
[sovereign contest guide](/docs/network/sovereignty/run-a-sovereign-contest):
contest preparation and sealing, the public-qualifier gate **re-executed by
the node itself on every entry before any custodian is asked to approve
anything**, threshold-gated scoring, and the network-isolated method executor
with its import scan. What a node accepts is a **model or a method** — an
artifact it can run. Uploading translations of a source-public blind set was
retired as a contest entry path on 2026-09-06 and the verb deleted; a
source-public round survives only as an optional organizer diagnostic, and
self-reported scores belong on the open leaderboard, which is a public board
indexed by corpus and pair direction rather than a contest.
The **threshold key ceremony and sealed-at-rest workflow of §4 also ship
today**: `mt-eval node ceremony init|share|verify|restore`, `mt-eval node
seal`, quorum shares presented at run time
(`node run-method --offline --share …`), a hash-chained local
authorization ledger (`node ledger verify|head`), signed score manifests
(`node sign-manifest` / `node verify-manifest`), and the §2–§3 air-gap
tooling (`node bundle`, `node manifest`, `node egress-check`). Score
bundles are signed **on the node, in Python** — the offline bundle needs no
Node.js runtime — and the same detached-signature format verifies with
either implementation. Organizer-side **request staging also ships**:
`mt-eval node stage-request` writes the exact exchange request an online
relay would, from a bundle file and with no database at all (for a
rehearsal, or a deployment that never connects), pre-validated as import
would validate it and bound to the node's id; the scores that come back are
manifest-verifiable but are not relay-published, because no authorization
record exists to publish them against. The
single-keypair stand-in remains only for contests where the organizer
holds the references outright — every surface labels which lane is in
use. Stated plainly, what v1 does **not** include: hardware remote
attestation (TEE) is not claimed (§5), and platform-side threshold
*signing* (custodian phone approvals against hosted infrastructure) is
future work — on a sovereign node, custody is exercised by physically
presenting M of N shares at the machine (§4). And to be precise about the
cryptography: this is Shamir M-of-N secret sharing with the key
**reconstructed in the node's locked memory during an authorized run**
(then zeroed) — it is *not* multi-party computation, and the key does
briefly exist assembled on your offline machine. Finally, until the
community consent gate opens, the lane runs against **synthetic data
only**; real corpora wait on that consent.
:::

## 1. Reference hardware

The executor runs self-contained methods: local NMT decode, FST/morphology
validation, and metric computation. No cloud calls happen inside the air
gap (LLM-API methods are exactly the class an air-gapped node refuses — see
the [benchmark spec's](/docs/network/specifications/benchmark) method
classes).

| Tier | Spec | Fits | Rough cost (2026) |
|---|---|---|---|
| **Minimum** (works) | 4-core x86_64 or Apple/ARM, 16 GB RAM, 500 GB SSD | Metric + FST evaluation, CPU decode of small NMT models (slow but correct) | US$0 (a spare laptop) – $400 used |
| **Recommended** | 8-core, 32 GB RAM, 1 TB NVMe, NVIDIA GPU ≥ 12 GB VRAM (e.g. RTX 4070-class) | Comfortable NMT decode for full test batteries; parallel method evaluation | ~US$900–1,600 (small-form workstation) |
| **Institutional** | 16-core, 64–128 GB RAM, 2 TB NVMe, 24 GB+ VRAM | Many-method contests, large batteries, archived ciphertext store | ~US$2,500–4,000 |

Hard requirements at every tier:

- **No radios, or radios you can prove are off.** Best: a desktop with no
  Wi-Fi/Bluetooth card. Acceptable: a laptop whose wireless card is
  physically removed or disabled in firmware. "Airplane mode" is not an
  air gap.
- **A wired NIC you can leave unplugged.** The cable's absence is the most
  auditable network control there is.
- **Two dedicated USB drives** (labeled IN and OUT — see §3) and, ideally,
  a machine whose other ports you disable in firmware.
- **Full-disk encryption** (LUKS on Linux) so a stolen node is a brick, and
  a UPS if your power is unreliable — an evaluation interrupted mid-battery
  is recoverable, but why find out.

## 2. Software setup (once, ~an hour)

1. Install a current Linux LTS (Ubuntu/Debian) from a USB installer **with
   the network cable unplugged**; enable full-disk encryption at install.
2. On a separate, online machine with the harness installed
   (`python3 -m pip install mt-eval-harness`, 0.2.0 or later), build the offline bundle.
   `mt-eval node bundle --out <dir>` does four things:
   - wheels the installed harness and its dependencies (or a specific wheel,
     with `--wheel <file>`);
   - fetches the cryptography libraries against the hash-pinned list shipped
     inside the harness;
   - copies any `--include` artifacts;
   - writes a sha256 manifest over every file.

   Include the **language cards** for every language the node will score
   (`--include <cards-dir>`): the node names a run's language pair from a
   local card index and never fetches one. Neither installed package ships
   a per-language cards directory, so write it here with the `champollion`
   CLI, one `<code>.json` per language (`champollion network card eng --json >
   node-cards/eng.json`, then the same for your other language), and pass
   `--include node-cards`. On the node it sits at
   `<dir>/artifacts/node-cards`; point `cards_dir` there. Everything the node needs crosses
   on the IN drive once. Build on the same Python version the node runs
   (3.11 or 3.12); the pinned list refuses any other.
3. Transfer the bundle on the IN drive; verify every artifact's sha256
   against the manifest **on the node** before installing
   (`mt-eval node bundle --verify <dir>`). Then install from the bundled
   wheels only:
   `python3 -m pip install --no-index --find-links <dir>/wheels 'mt-eval-harness[node]'`.
   The `[node]` extra is the `cryptography` library that `mt-eval node
   keygen` and the custody ceremony need; a plain `mt-eval-harness` install
   lacks it.
4. Create the node's signing keypair (`mt-eval node keygen`) and record
   its public half — you will publish it so anyone can verify your score
   manifests (§5).
   The node also needs **Docker** (or Podman), which runs each submitted
   method in a container with no network; with neither on the `PATH`,
   `mt-eval node run-method` refuses in one line naming both, and the
   request stays runnable. It also needs a node config at
   `~/.mt-eval/node.json`. That file names the node, its cards directory
   (`cards_dir`, or `MT_EVAL_CARDS_DIR`), and the contests it serves.
   `mt-eval node init` writes a starter config with every key a scoring node
   reads, including the public qualifier gate (`qualifier` + `dev_corpus`,
   which the node re-runs every method against before it opens a sealed set)
   and the sealed holdout's slots (`holdout_set_id` + `holdout_corpus`;
   delete them for a contest without a holdout).
   `mt-eval node init --from-contest <out>` fills the contest's values from
   the manifest `contest prepare` wrote (the mapping is in the
   [sovereign contest guide](/docs/network/sovereignty/run-a-sovereign-contest#organizer-prerequisites)).
   Its `sandbox` block is the node's resource policy (4 GB RAM, 4 GB scratch,
   30 minutes per run, no GPU), and `contest submit-method` declares exactly
   those values by default, so publish your caps with the contest if you
   change them.
   A node config that declares only half of that gate is refused at startup.
   `mt-eval node ledger verify` checks the filled-in file: it refuses the
   first leftover `<...>` value or declared file that is not on the node,
   prints what it checked, then replays the local ledger's hash chain. The
   connected machine that relays requests to the node also needs the
   database's **service-role key** (`MT_EVAL_SUPABASE_SERVICE_KEY`). That key
   is never needed on the air-gapped node itself.
5. From then on the machine never sees a network — and a sealed run can
   be made to prove it first: `mt-eval node egress-check` (also enforced
   automatically with `assert_airgap` in the node config) refuses when a
   route, a probe, or DNS shows any way out. OS updates are a deliberate,
   bundled, hash-verified event — not a background service.

## 3. Transfer discipline (every contest, both directions)

The air gap is a *procedure*, not a product. The procedure:

- **IN drive** carries: submitted method or model bundles and their
  manifest. Before anything runs, the node verifies each package's
  hash against the manifest and the import scan runs (it refuses methods
  that import network libraries — this ships today).
- **OUT drive** carries: the signed score manifest — aggregate scores, the
  method/config hashes they belong to, the audit-log head — and *nothing
  else*. Per-segment outputs stay on the node under the organizer's
  control; publishing them is a separate, deliberate community decision.
- One direction per drive, ever. A drive that has touched the node never
  auto-mounts on an online machine — mount it `noexec,nodev` and copy the
  manifest off by hand.
- `mt-eval node manifest write <drive> --direction in|out` hashes every
  file on the drive before a crossing; `mt-eval node manifest verify`
  on the receiving side refuses anything added, changed, or missing.
- Log every crossing (date, drive, manifest hash) in the node's paper or
  on-node log. Boring is the point: the log is what lets you answer "did
  anything else ever leave?" with evidence.

## 4. Key custody (M-of-N, community-held)

The sealed test set is encrypted at rest; decryption requires a quorum of
key shares held by custodians **the community chooses** — an Elders'
council, a language authority, an education body. The design gives the
platform zero shares, so Champollion could not decrypt a sealed set, and
neither could any single custodian alone. The ceremony below has not yet
been run with real custodians.

The ceremony (one offline sitting; the shipped tooling automates it):
`mt-eval node ceremony init` generates the set key on the node, splits it
into N shares (any M reconstruct; fewer reveal nothing — the sharing is
information-theoretic), and zeroes the key in the same breath; `ceremony
share` emits each custodian's share as a file for a token plus a
printable paper backup; `ceremony verify` proves the distributed copies
reconstruct — without persisting anything; `ceremony share
--wipe-originals` then destroys the node's own copies. `mt-eval node
seal` encrypts the corpus to the ceremony's public key: the node stores
ciphertext and a content-free metadata card, nothing else. From then on,
running an evaluation means custodians physically present M of N shares
(`node run-method --offline --share …`): the key is rebuilt **in the
executor's locked memory only**, used for that one grant-bound run, and
zeroed — it never touches disk again. Every request, vote, grant, and use
is appended to a hash-chained local ledger (`node ledger verify`), and an
attempt without a quorum is refused *and* recorded.

One honest sentence about the mechanism: this is Shamir secret sharing
with reconstruction in the memory of the community-held offline machine —
not multi-party computation. During an authorized run the key briefly
exists, assembled, on hardware the community physically controls; the
properties it defends are *no standing key on disk*, *no run without a
quorum present*, and *every use chained into the inspectable ledger*.
Platform-side threshold signing, where the key never assembles anywhere,
remains future work and is labeled as such wherever it is mentioned.

Rotation and custodian replacement re-run the ceremony; loss of more than
N−M shares means the set is re-sealed from the community's source copy —
the community always retains its own plaintext original, because
[possession](/docs/network/sovereignty/data-sovereignty) was never ours to
hold.

## 5. What "attested" means here — and what it does not

Every evaluation produces a **signed score manifest**: the node's signature
over the scores, the method-package hashes, the corpus checksum, and the
head of the append-only audit log. Anyone holding the node's published
public key can verify it — `mt-eval node verify-manifest <manifest>
--pubkey <published .pub.json>` — that *this node* produced *these scores*
for *these exact inputs*, and the hash-chained log makes silent history
edits detectable.

That is **software attestation** — it proves integrity of the record, and
it is what v1 offers. It does **not** prove what silicon executed the run:
hardware remote attestation (TEEs) is future work and is deliberately not
claimed. The honest security statement for v1: the organizer's discipline
(§3) plus signed manifests plus the community's physical custody of the
machine is the trust anchor — which is exactly where a sovereignty-first
design wants the trust to sit anyway.

## 6. The operating loop

1. Announce the contest; publish the node's public key + dev-set threshold.
2. Receive submissions online (ordinary machine), assemble the IN manifest
   (`mt-eval node manifest write <drive> --direction in`).
3. Carry IN drive to the node; verify hashes (`node manifest verify`);
   import-scan (`node import-bundle`); queue methods. An entrant's offline
   proposal arrives *pending*. The node checks it first (`node run-method
   <id> --offline` re-executes the entrant's qualifier on the public dev set
   and checks a container runtime for a code entry, opens nothing sealed, and
   records a pass in the local ledger). Then a custodian records the decision
   on the node (`node approve <id> --offline --actor <custodian>`, refused
   until that check has passed, or `node deny … --offline --reason …`: a vote
   + authorization in the local ledger and a record signed with the node key;
   `node list --offline` shows what waits). The sealed run (`node run-method
   --offline` again) refuses a pending proposal until that approval is
   recorded and verifies.
4. Custodians authorize the run by presenting a quorum of shares (§4 —
   `node run-method <id> --offline --share … --share …`); the sealed set
   decrypts into the executor only. No quorum, no run — and the attempt
   is on the ledger.
5. Execute; scores computed; per-segment outputs retained node-side.
6. Teardown: working plaintext wiped; audit log appended; manifest signed.
7. Carry OUT drive back; publish scores + manifest; anyone verifies
   (`node verify-manifest`).
8. Log the crossing; drives stay dedicated; node stays dark.

