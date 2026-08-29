---
sidebar_position: 9
title: Run a Sovereign Contest
slug: /network/sovereignty/run-a-sovereign-contest
description: "The self-serve, end-to-end path for a community or organization to run an MT contest against its own sealed, held-out corpus — without Champollion ever holding the data or the prize money."
related:
  - label: "Registering Corpora & Exposure Lanes"
    to: /docs/network/sovereignty/registering-corpora
    kind: doc
    note: "The registration lane this path builds on"
  - label: "Data Stewardship"
    to: /docs/network/sovereignty/data-sovereignty
    kind: doc
  - label: "Terms Templates"
    to: /docs/network/sovereignty/terms-templates
    kind: doc
    note: "Adaptable terms ideas, including trojan-horse risks"
  - label: "Prize Specification"
    to: /docs/network/specifications/prizes
    kind: spec
---

# Run a Sovereign Contest

> **Executive Summary.** A community or organization can run an evaluation
> contest — including a sponsored prize — against a held-out test corpus that
> **never leaves its own infrastructure**. You build the corpus, encrypt it,
> host it, and hold the keys; the Network registers only a content-free
> metadata card and a ciphertext digest. Methods qualify on public corpora
> first; every run against your sealed set requires your custodians'
> authorization; only **scores** ever come out. Prize funds are **sponsor-held**
> — by your organization or a trust you designate — and **Champollion never
> touches the money or the data.** This page is the end-to-end, self-serve
> runbook.

:::warning[What is live today vs. in development]
Be clear-eyed before you start — this is an evolving, non-commercial research
project, and we would rather you check us than trust us:

- ✅ **Live:** corpus registration (metadata cards, hash-pinning, exposure
  lanes), the sealed-set registry (digest + custodian group + qualifier, no
  content), the contest machinery with the sealed lane, the authorization
  request/grant/audit data layer (pending → M-of-N decision → single-use
  time-boxed grant, append-only hash-chained audit log), and scores-only
  emission enforced at the database layer.
- ✅ **Live: the organizer scoring node + hypotheses lane.** One
  command splits your corpus into a public dev set (the qualifier), a blind
  test set (source released, references sealed at rest on YOUR machine), and
  optionally a fully-secret set (`mt-eval contest prepare`). Registering the
  sealed set(s), qualifier, and contest is **self-serve from your own
  sign-in** — `contest prepare --self-serve`, or `mt-eval contest register
  --manifest` for a contest you prepared earlier — with every row
  identity-bound at the database layer; no curator in the loop and no
  privileged key (see Step 4 for the honest limits). Participants
  submit their translations with `mt-eval contest submit-hypotheses` (the CLI
  self-scores the dev set locally and refuses uploads below your threshold);
  YOUR self-hosted node (`mt-eval node serve`) re-scores the dev evidence
  itself, gates on the qualifier, authorizes per your contest's model
  (`per-submission` — a custodian approves each scoring — or `blanket` /
  `open`), scores the blind set against references that never leave your
  machine, and publishes **aggregates-only** run cards. What this lane does
  NOT prove: that the named method produced the hypotheses (method identity is
  participant-claimed and labeled as such on every run card), and it cannot
  stop a determined adversary extracting reference signal across many distinct
  submissions — rate limits, byte-identical dedup, and the audit chain slow
  that down; the method-execution lane below is the real answer.
- ✅ **Live: two secret-set method lanes.** Participants with a published
  hypotheses-lane record can propose their method against your secret set. The
  node picks the lane from the submission:
  - **Lane A — declarative model (preferred).** A standard neural model is
    DATA: `mt-eval contest submit-model` sends safetensors weights + a
    declarative tokenizer + a config — **no code, no Dockerfile.** Your node
    validates it is code-free (safetensors not pickle; no
    `trust_remote_code`/`auto_map`; data-only files) and runs the weights in
    its OWN trusted engine (`transformers`, `trust_remote_code=False`, offline).
    Architecture is permissive by default (any your engine loads natively); a
    careful host can pin an allowlist. Nothing untrusted executes, so there
    is nothing to sandbox. Published `declarative-model`, method identity
    **code-free by construction**.
  - **Lane B — runnable bundle (sandbox fallback).** For methods that ARE code:
    `mt-eval contest submit-method` sends a Dockerfile + entrypoint. After your
    custodian approves, YOUR node executes it inside a network-isolated
    container (`--network=none` — the network stack does not exist inside;
    read-only root, dropped capabilities, sanitized environment), with
    automated static checks first and references never entering the container.
    Published `method-execution` with **execution-verified** identity.
  Either lane: the bundle hash is frozen into the authorization request (what
  runs is provably what was proposed), and scores publish through the same
  aggregates-only path. For maximum isolation the scoring machine can be a true
  airgap: authorized requests and Ed25519-signed scores-only bundles cross by
  removable media (`mt-eval node relay` / `import-bundle` / `export-scores`) —
  the secret text never reaches even the connected machine. What these lanes do
  NOT include yet: hardware attestation of the node (identity is self-reported),
  formal dispute machinery, and — for Lane B specifically — deeper container
  hardening beyond the removed network stack (seccomp profiles, microVMs; this
  is a reason to prefer Lane A). See
  [Honest Limitations](/docs/network/honest-limitations).
- 🔲 **In development: threshold signing.** M-of-N custodian approval is
  *recorded* in the authorization and audit tables today; the cryptographic
  threshold-key tooling that makes a grant unmintable without M shares is not
  yet built — the current sealing key is a labeled single-keypair stand-in
  (`champollion seal-corpus keygen`), and the airgap score-bundle signature
  is a single node key (`seal-corpus sign-keygen`), not a steward ceremony.
- ❌ **Not a thing, by design:** Champollion hosting your corpus, holding your
  keys, or holding prize funds. Participant hypotheses (their own translations)
  transit our storage; your corpus content never does.

If a step below depends on something in the 🔲 list, the step says so.
:::

---

## The shape of the deal

| Who | Holds | Never holds |
|-----|-------|-------------|
| **You (community/org)** | The corpus, the encryption keys (via your custodians), the prize funds, the award decision | — |
| **Champollion / the Network** | A metadata card, a ciphertext digest, the authorization + audit record, the published scores | Your corpus content, your keys, your money |
| **Method developers** | Their method | Your test data — they see scores, never sentences |

Everything below is the mechanical expansion of that table.

---

## Organizer prerequisites

Before Step 1, know what running the node side actually requires:

- **docker or podman** — required for the method-execution lane. The node
  autodetects docker, then podman; if neither is present it refuses loudly.
  There is **no fallback** — container isolation with `--network=none` is the
  load-bearing guarantee, so nothing runs without a container runtime.
- **Node.js 20.11+ and the `champollion` npm CLI** — the harness does not
  re-implement the sealing cipher. `champollion seal-corpus` (verbs: `keygen`,
  `seal`, `open`, `sign-keygen`, `sign`, `verify`) is the one cipher
  implementation (X25519-ECDH → HKDF-SHA256 → AES-256-GCM), and the organizer
  node shells out to it.
- **A node config at `~/.mt-eval/node.json`.** Every `mt-eval node` command
  refuses to start without one — run any of them once and the error message
  names the config path and where the template lives (it ships in the harness
  source, in `mt_eval_harness/contest_node.py`). The config carries your
  self-reported `node_id` (bound into every request fingerprint) and a
  `contests` map pointing at your dev references and sealed artifacts.
- **A sign-in.** There is no separate account-creation step: the first command
  that needs an identity (e.g. `mt-eval contest prepare --self-serve` or
  `mt-eval publish`) opens a browser OAuth sign-in via **GitHub or Google**
  (Supabase Auth). That account's email is the identity every registry row is
  bound to — use one your organization controls.
- **The intake throttle.** Participant submissions are rate-limited per
  submitter to **5 per 24 hours by default** (anti-probing; set per contest
  with `--intake-daily-limit` at prepare time, or as a shared-task edition
  default). Budget your contest timeline around it.

**One honest caveat on self-serve registration.** On the **default
network-hosted endpoint**, self-serve registration (`contest prepare
--self-serve` / `contest register`) currently stops at a production-endpoint
guard: the CLI refuses with an explicit message rather than writing to the
production project, pending a policy decision on opening that door. Federated
hosts (your own Supabase project) are not affected. If you hit the guard on
the default host, that is the current state of the world, not a
misconfiguration on your end — [open an issue](https://github.com/gamedaysuits)
and we will walk the registration through.

---

## Step 1 — Build your held-out test corpus

Design the corpus you will measure against, and keep it held out from day one:
nothing in it should ever have been published, posted, or shared with a model
provider.

- Follow the [Corpus Design Framework](/docs/network/specifications/corpus-design)
  for entry structure, difficulty tiers, and register coverage, and the
  [Corpus Creation cookbook](/docs/network/tutorials/corpus-creation) for
  tooling.
- Have entries checked by fluent speakers before sealing — the
  [Speaker Validation Protocol](/docs/network/specifications/speaker-validation)
  describes a review structure you can reuse for corpus QA, not just method
  review.
- Decide the corpus **version** label now (e.g. `v1`). Authorization grants are
  bound to a specific version, so versioning is part of the security model, not
  bookkeeping.

## Step 2 — Encrypt it and host it on YOUR infrastructure

Encrypt the corpus at rest (any modern AEAD scheme — e.g. `age`/x25519 or
AES-256-GCM) and host the **ciphertext** somewhere you control. Champollion
never receives the plaintext *or* the ciphertext.

Publish exactly one artifact: the **SHA-256 digest of the ciphertext blob**.

```bash
shasum -a 256 sealed-corpus-v1.age
# → 3b5f0c…e91a  sealed-corpus-v1.age
```

The digest is public; the data is not. Anyone can later verify that the blob
evaluated against is byte-identical to the blob you sealed — integrity without
possession. This is the same hash-instead-of-copy discipline as
[ordinary corpus registration](/docs/network/sovereignty/registering-corpora#1-registration-is-metadata-not-content).

## Step 3 — Register the metadata card

Register the corpus through the standard, fail-private
[registration lane](/docs/network/sovereignty/registering-corpora): a card with
`language_pair`, `license`, `attribution`, and `do_not_train` — **no
sentences**. Choose the **private** exposure lane; the sealed-set registration
in the next step is what makes it contest-eligible.

## Step 4 — Register it as a sealed set

A sealed set is a content-free registry entry that puts three things on the
public record:

| Field | What it commits you to |
|-------|------------------------|
| `ciphertext_digest` | The exact bytes that count as "the corpus" |
| `custodian_group_id` | An opaque id for the group that controls access (never a public org/nation name before consent) |
| `current_qualifier_id` | The public round a method must clear before a sealed run can even be proposed |

Registration is **self-serve, from your own sign-in** — no curator in the loop
and no privileged key:

```bash
# Register a contest you prepared with `mt-eval contest prepare --no-register`
mt-eval contest register --manifest local/manifest.json

# Or do it in one shot at prepare time
mt-eval contest prepare … --self-serve
```

The manifest stays on your machine — registration sends only the content-free
ids, digests, and thresholds. Every registry row is **identity-bound**: the
database records the signed-in account that registered it and freezes that
binding against later edits, and a qualifier may only gate a sealed set the
**same** identity registered. Sealed sets are born quarantined (they can never
back an ordinary contest or rank on the public leaderboard), qualifiers are
born in a safe state, and registration is rate-limited — all enforced by
database triggers beneath every client, including ours. The registry itself is
publicly readable, so you can verify your entry says exactly what you sealed —
and nothing more.

**Honest limits.** The self-serve door is registration-only (insert-only at
the database layer). **Qualifier rotation and sealed-set retirement remain
curator-mediated** — open an issue or contact the project via
[GitHub](https://github.com/gamedaysuits). And running the organizer scoring
node in the later steps (lifecycle advances, authorization grants, audit
operations) is a separate, service-credentialed lane on your own node —
self-serve stops at the public record.

## Step 5 — Choose custodians and the M-of-N rule

Pick the people or institutions who must jointly approve every evaluation
against your corpus, and the threshold (e.g. **3 of 5**). Custodians should be
accountable to your community, not to Champollion — see
[Data Stewardship](/docs/network/sovereignty/data-sovereignty) and
[Ownership & Terms](/docs/network/sovereignty/ownership-transfer) for how
per-community terms are set.

**Honesty box:** the threshold-*cryptography* tooling (key shares such that a
grant literally cannot be minted without M signatures) is **in development**.
Today, the M-of-N rule is enforced as recorded process: every access request
enters a **pending** queue, custodian decisions are recorded, a grant is minted
only for an authorized request, each grant is **single-use, time-boxed, and
bound to one specific (method, corpus version, evaluation node) fingerprint**,
and every event — including blocked attempts — lands in an **append-only,
hash-chained, publicly readable audit log**. The database refuses illegal state
transitions beneath every client and key. What it cannot yet refuse is a
compromise of the platform operator itself — that is what threshold signing
closes, and until it ships you should treat "Champollion holds zero key shares"
as the design goal being built toward, not a property you can verify today.

## Step 6 — Set the prize

Decide, and publish with the contest:

- **Amount and currency.**
- **Sponsor** — who is putting up the money.
- **Where the funds sit** — your organization's account, or a community trust
  you designate. **Champollion never holds, escrows, or routes prize funds.**
  Publishing the holder's identity up front is what makes the prize credible;
  see the [sponsor-default risk note](/docs/network/sovereignty/terms-templates#trojan-horse-risks)
  in the terms templates.
- **Threshold conditions** — the score bar a method must clear, written
  per the [Prize Specification](/docs/network/specifications/prizes): metric
  thresholds, speaker-validation requirements, reproducibility. Make the award
  conditions verifiable from the published scores, so nobody has to take your
  word (or ours) for whether the bar was cleared.

## Step 7 — Create the contest

Contests over sealed sets use the explicit **sealed lane**. Eligibility is
fail-closed: the contest is refused unless your sealed-set registration exists
and is active — and creating the contest grants **no one** any access to the
corpus.

```bash
mt-eval contest create \
  --name "EN→CRK Community Challenge 2026" \
  --corpus sealed-eng-crk-v1 \
  --language-pair "en>crk" \
  --visibility public \
  --use-context non-commercial \
  --description "Community-custodied held-out set; scores-only; prize held by <your org/trust>."
```

*(The `--corpus` value is your registered `sealed_set_id`. The sealed lane is
selected **automatically** from the sealed-set registration — no extra flag; a
sealed set can never back an ordinary contest, and an ordinary quarantined
dataset can never back any contest. Both rules are enforced in the database,
beneath every client. If you registered in Step 4 with `contest register` or
`prepare --self-serve`, the contest row **already exists** — skip this step;
`contest create` by hand is only for assembling a contest from an
already-registered sealed set.)*

## Step 8 — Methods qualify in public first

Developers build and score their methods on **public** corpora for your
language pair — the normal
[submit-a-method](/docs/network/getting-started/submit-a-method) path. Your
sealed set's `current_qualifier_id` names the public round a method must clear
before a sealed run can even be requested. This keeps probing pressure off your
corpus: nobody gets to aim at the sealed set until they have shown real
performance in the open.

:::note[Participants: which endpoint does your contest live on?]
A **network-hosted** contest needs no setup — the default endpoint the harness
ships with carries the contest machinery (hypotheses intake, the qualifier
gate, method proposals), and `mt-eval contest submit-hypotheses` /
`submit-method` work out of the box.

A **federated** contest — the organizer runs the machinery on their own
Supabase project, so submissions never transit ours — publishes its endpoint
with the contest materials. Export it before submitting:

```bash
export MT_EVAL_SUPABASE_URL=https://<contest-host>.supabase.co
export MT_EVAL_SUPABASE_ANON_KEY=<contest-anon-key>
```

If the harness is pointed at an endpoint that doesn't have the contest
machinery (say, a federated host missing a migration), the command stops with
*"the contest lane isn't available on this Supabase endpoint yet"* and tells
you which endpoint it was talking to. (Federated organizers: publish these two
values next to your corpus release, `--node-id`, and `--corpus-version`.)
:::

## Step 9 — Sealed runs: request, authorize, execute, scores out

For each qualifying method:

1. A **request** is filed against your sealed set — it enters `pending` and
   carries an immutable fingerprint of (method tarball hash, corpus id, corpus
   version, `scores-only`, evaluation-node measurement).
2. Your **custodians decide** (M-of-N). Approval mints a **grant**: single-use,
   expiring, valid only for that exact fingerprint.
3. The evaluation runs in the network-isolated sandbox on **your** node
   (`mt-eval node run-method`): automated static checks, a container with no
   network stack, references held outside it — or, for maximum isolation, on
   a true-airgap machine with signed scores-only bundles crossing by
   removable media (see the status box above for what is and isn't covered).
4. **Only scores leave.** The `scores-only` emission rule is pinned at the
   database layer; per-entry text from your corpus is never published.
5. Every step — request, votes, grant, use, and any blocked attempt — is
   appended to the public, hash-chained audit log you (and anyone) can replay.

## Submitting a method (for participants) — two lanes

Most NMT entries are not exotic: a standard fine-tuned transformer and its
weights. For those, there is a **preferred, code-free lane** — and a sandbox
fallback for methods that genuinely are code.

### Lane A — declarative model (preferred for standard NMT)

If your method is a standard neural model, you submit it as **data** — the
weights, tokenizer, and config — and the organizer runs it in their own trusted
inference engine. **No Dockerfile, no code, no sandbox.** Because nothing you
submit executes, the organizer's safety check is a decidable format validation
instead of trying to prove arbitrary code is safe — a strictly stronger
guarantee for you and for the corpus.

```bash
mt-eval contest submit-model <contest-slug> \
  --model-dir ./my-model \          # config.json + model.safetensors + tokenizer.* at the ROOT
  --name "My NMT" --version 2.0 \
  --architecture MarianMTModel \    # must be on the organizer's trusted whitelist
  --method-class pipeline --paradigm neural-nmt \
  --developer "Your Name" --node-id <organizer-advertised-node-id> --agree
```

The rules your bundle must satisfy (validated locally before upload, and again
by the organizer's node):

- **Weights are `safetensors`, never pickle.** A PyTorch `.bin`/`.pt`/`.ckpt`
  is a pickle — arbitrary code on load — and is refused. Export to
  `model.safetensors` (`safetensors` / `transformers` do this natively).
- **An architecture the organizer's engine loads natively.** `config.json`'s
  `architectures` can be any architecture the host's `transformers` implements
  (Marian, NLLB/M2M100, mBART, T5, Pegasus, and many more) — hosts are
  **permissive by default**, because with `trust_remote_code=False` the safety
  comes from the code-free format, not the architecture name (an unsupported
  architecture simply fails to load, running nothing). A careful host may
  publish an allowlist. No `auto_map`, no `trust_remote_code` — those smuggle
  custom code back in and are always refused.
- **A declarative tokenizer** (`tokenizer.json` or a `sentencepiece` `.model` +
  vocab), and **data files only** — no `.py`/scripts/binaries in the bundle.

The organizer runs it with `trust_remote_code=False`, offline, and only scores
leave — published as `declarative-model`, method identity **code-free by
construction**. (Multi-GB weights: use `--bundle-out` for the sneakernet lane,
same as below.)

### Lane B — runnable bundle (the sandbox, for code methods)

If your method is genuinely code — a pipeline, an LLM-coached hybrid, a custom
decoder — it can't be run declaratively, so it goes through the network-isolated
sandbox instead. This is the honestly-weaker lane (it contains untrusted code
rather than refusing to run it), so use Lane A whenever your method is a
standard model.

**The runnable-bundle contract is stdin/stdout.** Your bundle declares an
entrypoint (e.g. `method/translate.py`). Inside the container, the organizer's
node runs exactly:

```
cat /eval/source.txt | <your entrypoint> > /output/translations.txt
```

Source sentences arrive one per line on stdin; you write one translation per
line to stdout. Everything you passed as `--method-dir` is packed under
`method/` in the bundle and mounted **read-only at `/method`** at run time —
weights included, no copying into the image needed. The container has no
network stack (`--network=none`), a read-only root, and a writable `/tmp`.

**A minimal Hugging Face transformers wrapper:**

```python title="method/translate.py"
#!/usr/bin/env python3
import sys
from transformers import AutoModelForSeq2SeqLM, AutoTokenizer

tok = AutoTokenizer.from_pretrained("/method/weights")
model = AutoModelForSeq2SeqLM.from_pretrained("/method/weights")

for line in sys.stdin:
    inputs = tok(line.strip(), return_tensors="pt", truncation=True)
    out = model.generate(**inputs, max_new_tokens=256)
    print(tok.decode(out[0], skip_special_tokens=True), flush=True)
```

**The Dockerfile must build with no network.** The organizer builds your image
with `--network=none` — the air-gap build test *is* the build — so every
dependency must be **vendored into the bundle** (a `pip install` that reaches
PyPI fails the build, and the pre-flight static scan flags network calls
before anything is even sent). Ship wheels inside your method dir and install
from them:

```dockerfile title="Dockerfile"
FROM python:3.11-slim
# The build context is the bundle root: Dockerfile + method/
COPY method/wheels/ /wheels/
RUN pip install --no-index --find-links=/wheels torch transformers sentencepiece
# Weights are NOT copied — /method is mounted read-only at run time.
```

Submit it with:

```bash
mt-eval contest submit-method <contest-slug> \
  --method-dir ./my-method --dockerfile ./Dockerfile \
  --name "My NMT" --version 1.0 \
  --entrypoint method/translate.py \
  --method-class pipeline --paradigm neural-nmt \
  --developer "Your Name" --node-id <organizer-advertised-node-id> \
  --agree
```

(You need a published hypotheses-lane record for the contest first — Step 9's
T1 gate — and `--agree` acknowledges the method-submission terms.)

**Multi-GB weights: use the sneakernet lane.** The hosted intake path uploads
your tarball as a **single POST** to the contest host's storage, so it is
bounded by that host's storage upload limit — fine for code and small models,
not for multi-GB checkpoints. The bundle contract itself allows far larger
artifacts (tarballs up to 100 GB, built images up to 150 GB). For big weights,
skip the hosted upload:

```bash
# Package + write an exchange directory, no upload:
mt-eval contest submit-method … --offline --bundle-out ./exchange \
  --secret-set <sealed-set-id> --pair eng>crk --developer-email you@example.org
```

The exchange directory travels to the organizer by removable media (or any
channel you both trust); they ingest it with `mt-eval node import-bundle`. The
bundle's SHA-256 is frozen into the authorization request either way, so what
runs is provably what you proposed.

**Organizers: pre-load base images on airgap machines.** Because the image
build runs with `--network=none`, the Dockerfile's `FROM` base image must
already be in the machine's local image store. On a connected machine,
`docker pull python:3.11-slim && docker save -o base.tar python:3.11-slim`;
carry `base.tar` over with the bundle; on the airgap machine,
`docker load -i base.tar` before running `mt-eval node run-method`. Agree on
the base image(s) with participants in your published contest materials.

## Step 10 — Publish scores, award per your published threshold

Scores-only results publish to the [leaderboard](/docs/network/leaderboard/rules)
like any other run, marked as sealed-set evaluations. If a method clears the
threshold conditions you published in Step 6 — including
[speaker validation](/docs/network/specifications/speaker-validation), which is
your community's gate, not an automated one — **you** (or your trust) award the
prize, per your own published terms. Champollion's role ends at measurement.

---

## What you keep, forever

- **The corpus.** It never left your infrastructure. Take the ciphertext
  offline and the sealed set simply stops being runnable.
- **The keys.** Access dies when your custodians stop granting it.
- **The money.** It was never anywhere else.
- **The record.** The audit log's head digest is publishable, so the history of
  who ran what against your corpus cannot be quietly rewritten — by anyone,
  including us.

For terms language you can adapt — ownership, scores-only licensing, and an
explicit tour of the ways a contest can be attacked —
see [Terms Templates](/docs/network/sovereignty/terms-templates).
