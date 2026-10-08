# Sovereign evaluation node — deploy spec and rehearsal kit

This directory is the runnable answer to "how do I stand up a sovereign
evaluation node and run a sealed evaluation end to end?". It provisions two
Linux guests on a Mac with [Lima](https://lima-vm.io), rehearses the whole
loop — custodian ceremony → sealed corpus → staged method request → air-gapped
import → M-of-N quorum unseal → the method runs in a `--network=none`
container → scores signed → verified on the host by two independent
implementations — and, on the connected guest, brings up a local Supabase
stack from nothing and proves every migration applies.

Everything here is real: no mock daemon, no faked container, no faked
database. Every stage asserts and the first failure names itself.

## Topology

| Instance | Role | Size | Mounts | Network |
|---|---|---|---|---|
| `champollion-organizer` | connected organizer: local Supabase, participant CLI, `mt-eval node serve`, the air-gap relay | 4 vCPU / 8 GiB / 60 GiB | the monorepo **read-only** at `/workspace/champollion`; `~/sovereign-smoke/<date>` writable at `/smoke` | normal; ports 54321/54322 forwarded |
| `champollion-airgap-node` | the sovereign node | 4 / 6 GiB / 30 GiB | **none** | provisioned online once, then **software-darkened** (`guest/airgap-dark.sh`) |

Two instances, not one: collapsing them would make "air-gapped" depend on
which containers happen to be running. Files cross only by `limactl copy`
(the USB stick), bracketed by `mt-eval node manifest write|verify`.

## Quick start

```bash
brew install lima
arena/deploy/sovereign-node/rehearse.sh all      # ~30–45 min on an M-series Mac, network for provisioning
open ~/sovereign-smoke/$(date -u +%F)/report.md
```

Stages can be run one at a time (`up`, `provision`, `verify-guest`,
`supabase`, `bundle`, `dark`, `tier1`, `phase-a`, `tier2`, `verify`,
`close`, `report`, `down`); run `rehearse.sh` with no argument for the list.

Order matters in three places. `bundle` must precede `tier1` (Tier 1 shreds
the fixture corpus out of the bundle it seals, so the drive is re-carried each
pass) and rebuilds the wheel from the current checkout. `tier1` must precede
`phase-a` (the organizer seals the relay contest to the ceremony Tier 1 just
created, and needs both `ceremony.json` files). And `verify` is not idempotent
against a database that already holds the relayed result — a withheld score is
a recorded score and the second attempt is correctly refused; reset the stack
with `supabase` and re-run from `tier1`.

## On your own Linux VMs (TRANSPORT=ssh)

The same stages run on any two Linux VMs, without Lima. That is the closer
rehearsal of a real deployment, and the only one where the node's network
can be cut at the hypervisor rather than in software.

1. Two Ubuntu 24.04 VMs (x86_64 or arm64), each with ≥4 vCPU / 16 GB /
   80 GB. They need passwordless sudo and key-based ssh from your machine.
   The organizer needs internet. The node needs internet **only while it is
   provisioned**. Put the node on an isolated bridge that only the organizer
   can reach; it then needs no route of its own.
2. `cp hosts.env.example hosts.env` and name the two ssh aliases. Reach the
   node through the organizer with `ProxyJump` in `~/.ssh/config`.
3. `TRANSPORT=ssh arena/deploy/sovereign-node/rehearse.sh all`.

What changes under ssh:
- `up` checks reachability and sudo instead of creating instances, and `down`
  stops nothing.
- Files cross by `scp` (still bracketed by `mt-eval node manifest
  write|verify`).
- The organizer gets the checkout as a copy the host pushes to
  `~/repo-staging`, instead of the read-only `/workspace` mount.
- `guest/airgap-dark.sh` reads the node's real interface and gateway, and
  saves them so `airgap-light.sh` can restore them.

**Strongest tier:** after `rehearse.sh provision airgap`, detach the node's
NAT NIC in the hypervisor. The software darkening then becomes a second wall,
and `egress-check` proves both.

## What each piece is

- `versions.env` — the pins (Ubuntu 24.04, Node 20 line, Docker CE apt repo,
  `python:3.12-slim`, 3-of-5 ceremony). Every resolved version is recorded in
  the report.
- `lima/*.yaml` — the two instance definitions (`vz`, virtiofs). `rehearse.sh`
  substitutes the host paths.
- `provision/00-base.sh` (root, both) — apt, Docker CE (GPG-pinned repo,
  rootful, guest user in `docker`), base image pre-pulled with its digest
  recorded. `10-organizer.sh` — Node.js (SHASUMS-verified), Supabase CLI
  (checksums-verified), rsync of `arena/ cli/ shared/ mt-eval-arena/` to
  `~/src/champollion`, a venv with the harness installed editable with
  `[node,dev]`. `10-airgap-node.sh` — a venv only: the harness reaches the node
  through the real offline path (`mt-eval node bundle` → `--verify` →
  `pip install --no-index`).
- `guest/verify-guest.sh` — acceptance checks (hardened `--network=none`
  container runs and has no egress; tools present; `egress-check` reports
  NOT air-gapped before darkening and air-gapped after).
- `guest/airgap-dark.sh` — writes a networkd drop-in so the DHCP client can
  no longer install routes, DNS or a gateway (the *address* is kept, so the
  management shell survives — without this the next lease renewal quietly
  restores the default route and a sealed run then refuses to start), drops
  the default routes, kills DNS, and applies an nftables OUTPUT policy drop
  (loopback + established/related accepted so `limactl shell` survives) with a
  FORWARD drop that closes Docker's bridge even for a container not started
  with `--network=none`. It proves its own result before exiting.
  `airgap-light.sh` is the operator restore; the honest restore for a node
  that held real shares is `limactl delete`.
- `templates/node.*.json` — `~/.mt-eval/node.json` templates. The air-gap one
  declares `custody: threshold-quorum` and has **no** `secret_privkey`
  anywhere (the loader refuses one). It also documents the two keys an
  air-gapped node needs because it cannot read the database: the contest's
  frozen `prize_terms_sha256` (without it the entry's terms acceptance can
  only be WARNed about, never checked) and the `holdout_set_id` /
  `holdout_corpus` pair for the second sealed split.
- **The card index.** `publish.assemble_run_card` resolves a language pair
  through the language-card SSOT, which with no local directory fetches from
  Supabase — a node with no route out simply cannot name a language. So the
  drive carries the cards for the languages the node scores, and
  `rehearse.sh bundle` writes `MT_EVAL_CARDS_DIR` +
  `MT_EVAL_NO_REMOTE_REGISTRY=1` into the node's `~/.profile`. The rehearsal
  carries three cards (`eng crk fra`, overridable with `CARD_CODES=`) because
  its own pair is synthetic and has no card at all; a real deployment carries
  the cards for its contests' languages.
- `rehearse.sh` — the host orchestrator. `arena/scripts/sovereign_rehearsal.py`
  — the guest runner (every step shells out to `mt-eval …`, asserts, and
  writes `report.json` + `report.md`).

## What the rehearsal proves — and what it does not

Proves, with real software: the ceremony verbs and their refusals
(sub-quorum, missing custodian, wiped originals, re-key, and a quorum from
*another* sealed set's custodians — one ceremony per set), the seal, the
fail-closed egress check, the public qualifier gate **re-executed by the
scoring machine** before anything sealed is opened (from the exchange for a
relayed request, from `node.json` for a DB-less staged one), the quorum gate
(`single_party_attempt_blocked` on the ledger for a 2-of-5 attempt), one
custodian ceremony opening the secret set **and** its holdout with the ledger
naming both artifacts and the splits the grant covered, a real Docker
`--network=none` run of a Lane B method over both splits, teardown (no image,
no container, no scratch), that no token from a sealed split survives outside
the node's `runs/` directory (the canaries are derived from what was actually
sealed, not hardcoded), Ed25519 score bundles verified by both the Python and
the JavaScript implementation with tamper refused by both, every migration
applying from nothing, the Phase A connected loop (qualify → submit-method →
authorize → grant → score → aggregates-only publish) against a real Postgres
with every trigger live, and the publication policy end to end: the relay
**withholds** a result the contest promised to withhold, and `contest close`
publishes the withheld main and holdout, reveals identities and freezes a
ranking that reports the holdout without ranking it.

Does not prove: physical air-gap discipline (this is a software-darkened VM
on an online host with a hypervisor console — node-spec §1 is a hardware
practice, and the software gap has to be *maintained*: a DHCP renewal used to
restore the default route on its own), Lane A declarative-model execution
(needs `torch`/`transformers`, not installed), hardware attestation (none is
claimed anywhere), platform-side threshold signing (the key is reconstructed
in the node's locked memory — Shamir M-of-N, not MPC), or anything about MT
quality: the toy method implements the synthetic rule the fixtures encode and
scores ~100 by construction. The connected organizer's own sealed set is
opened with a single-key stand-in, labelled as one in every report; the
threshold ceremony belongs to the air-gapped node.

## Outputs

`~/sovereign-smoke/<UTC date>/` — logs per stage, `reports/*.json`, the IN
and OUT drives as carried, the exchange directory, the ranking/export
artefacts from `close`, and `report.md` + `report.json` (a PASS/FAIL/SKIPPED
row per step; `report` exits non-zero if anything failed). Nothing is written
into the repository, and the local stack's `status.env` — a service-role key,
local or not — is deliberately not collected.
