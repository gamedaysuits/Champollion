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
- ✅ **Live: the organizer scoring node.** One command splits your corpus
  into a public dev set (the qualifier entrants self-score on) and a sealed
  secret set your node executes entries against, and seals the secret half at
  rest on YOUR machine (`mt-eval contest prepare`). Registering the sealed
  set(s), qualifier, and contest is **self-serve from your own sign-in** —
  `contest prepare --self-serve`, or `mt-eval contest register --manifest`
  for a contest you prepared earlier — with every row identity-bound at the
  database layer; no curator in the loop and no privileged key (see Step 4
  for the honest limits).
- ✅ **Live: entries are METHODS, not translations.** A contest is entered by
  handing your node something it can RUN. An entrant self-scores the public
  dev set (`mt-eval contest qualify`) to get a receipt, then submits a model
  or a method; your node re-executes that receipt's score on its own copy of
  the dev set before any custodian is asked to approve anything, and denies
  on a miss. The node picks the lane from the submission:
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
- ✅ **The promise layer is live (2026-09-07).** Entry declarations
  (primary/contrastive, tracks), submission phases, withheld results
  (`hidden_until_close`), and the freeze that makes your declared promises
  un-editable once entries exist are enforced in the database on the
  network-hosted endpoint. A federated host gets the same rules by applying the
  migration that ships with the harness; against an older endpoint the harness
  falls back to the base set and says so (`declarations_available: false`)
  rather than pretending. Where a step below says *the database freezes /
  withholds*, it means it.
- 🔲 **In development: threshold signing.** For a set sealed with
  `champollion seal-corpus`, M-of-N custodian approval is *recorded* in the
  authorization and audit tables, and the sealing key is a labeled
  single-keypair stand-in (`champollion seal-corpus keygen`). A set sealed on
  the offline node (`mt-eval node seal`) uses the node's built **key
  ceremony** (`mt-eval node ceremony`): the set key is split M-of-N and
  re-assembled only in memory during a quorum-authorized run. That ceremony
  has never been used with a real custodian, and its shares are plain files
  in v1. Neither path has threshold *signing*: the airgap score-bundle
  signature is a single node key (`seal-corpus sign-keygen`).
- ❌ **Not a thing, by design:** Champollion hosting your corpus, holding your
  keys, or holding prize funds. An entrant's bundle (their own model or code)
  transits our storage on its way to your node; your corpus content never does.
- ❌ **Deleted rather than left as a trap.** `contest submit-hypotheses` (retired 2026-09-06) uploaded
  translations of a source-public blind set; `contest submit` (retired 2026-09-06) linked a score you
  published yourself. Neither
  is a contest entry path any more. A source-public blind round survives only
  as an optional organizer diagnostic, and self-reported scores still belong
  on the open leaderboard — which is a public board indexed by corpus and pair
  direction, not a contest.

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

- **The harness with its node extra:**
  `python3 -m pip install 'mt-eval-harness[node]'` (0.2.0 or later; use
  `python3 -m pip`, which works in any environment the harness runs in —
  a bare `pip` is not on the `PATH` in every virtual environment). The `[node]` extra
  adds the `cryptography` library that `mt-eval node keygen`, the custodian
  ceremony and score-manifest signing use. A plain
  `python3 -m pip install mt-eval-harness` lacks it, and those commands stop and name
  this install.
- **docker or podman** — required for the method-execution lane. The node
  autodetects docker, then podman (`sandbox.runtime` in `node.json` is `null`
  by default; name one there to insist on it). If neither is on the `PATH`,
  `mt-eval node run-method` refuses with one line naming both, before it runs
  anything, and the request is left as it was so you can run it once a
  runtime is installed. There is **no fallback**. Container isolation with
  `--network=none` is the load-bearing guarantee, so nothing runs without a
  container runtime.
- **Node.js 20.11+ and the `champollion` npm CLI** — the harness does not
  re-implement the sealing cipher. `champollion seal-corpus` (verbs: `keygen`,
  `seal`, `open`, `sign-keygen`, `sign`, `verify`) is the one cipher
  implementation (X25519-ECDH → HKDF-SHA256 → AES-256-GCM), and the organizer
  node shells out to it.
- **A node config at `~/.mt-eval/node.json`.** Every `mt-eval node` command
  refuses to start without one. `mt-eval node init` writes a starter config
  there (`--print` shows it instead). It holds your self-reported `node_id`
  (bound into every request fingerprint) and a `contests` map pointing at your
  dev set, your sealed set (`secret_set_id` + `secret_artifact`), your sealed
  holdout if you prepared one (`holdout_set_id` + `holdout_corpus`; delete
  both keys if you did not) and the public qualifier gate (`qualifier` +
  `dev_corpus`, the threshold on the 0–100 qualifier scale). Once you have run
  `contest prepare` (Step 1), `mt-eval node init --from-contest ./mytask`
  writes the starter config with the contest's values already filled in from
  `./mytask/local/manifest.json`, and lists what is left for you. The mapping
  it applies (fill by hand if you prefer):

  | `local/manifest.json` | `node.json` (under `contests.<contest-id>`) |
  |---|---|
  | `contest.language_pair` | `language_pair` |
  | `secret.sealed_set_id` | `secret_set_id` |
  | `secret.corpus_sealed_artifact` | `secret_artifact` |
  | `holdout.sealed_set_id` / `holdout.corpus_sealed_artifact` | `holdout_set_id` / `holdout_corpus` (both removed when there is no holdout) |
  | `qualifier.corpus_file` | `dev_corpus` |
  | `qualifier.qualifier_id`, `corpus_card_id`, `threshold`, `metric`, `year` | `qualifier.*` (same names) |
  | `test_suites[].suite_id` / `sha256`, `test_suite_local_copies` | `test_suites[].suite_id` / `corpus_sha256` / `corpus_path`: the copy `contest prepare` read (`--test-suite <id>=<path>`, or one it found), when it is on this machine with the pinned bytes; otherwise you set `corpus_path` |
  | `secret.sealed_block.keyScheme` | `custody`: `single-key` for a set sealed to one keypair (then set `secret_privkey`), `threshold-quorum` for a ceremony |
  | `registration.prize_terms` (recorded by `contest prepare` and `contest register`) | `prize_terms_sha256`: the terms' SHA-256, the hash entrants pass to `--accept-terms` (left out when the contest declares no prize) |

  The contest id is the `--slug` you gave `contest prepare` (`mytask` in the
  example below). Prepare records it in the manifest, registration creates
  the contest under it, and it is the id entrants pass to `contest qualify`
  and `submit-method`, so announce it with the dev release; `--contest-id`
  overrides it. (A manifest written before the id was recorded keeps the id
  registration derived from its name, `"My Task 2026"` → `my-task-2026`,
  because that is what its contest, receipts and node configs already use.) No
  manifest knows `node_id`, `cards_dir`, `signing_key` or your private key
  file, so those stay as `<...>` for you to fill.
  `mt-eval node ledger verify` then checks it and says what it checked: it
  loads the config (custody, the whole qualifier gate, the holdout pair, the
  local card index), refuses the first value that is still a `<...>`
  placeholder or a declared file that is not on this machine, prints each
  contest's sets and files, and only then replays the authorization ledger's
  hash chain (zero entries on a new node).
- **A local language-card index the node carries.** Scoring names the run's
  language pair, and the node never looks a language up over the network.
  Point `cards_dir` in `node.json` at a directory holding a card for every
  language your node scores (or set `MT_EVAL_CARDS_DIR`); a node with no local
  index refuses at startup rather than fetching one. Neither installed
  package ships a per-language cards directory, so write one on a connected
  machine with the `champollion` CLI, one `<code>.json` file per language of
  your pair:

  ```bash
  mkdir -p node-cards
  champollion network card eng --json > node-cards/eng.json
  champollion network card crk --json > node-cards/crk.json
  ```

  Then set `"cards_dir"` to that directory's absolute path. For an
  air-gapped node, carry it in the offline bundle
  (`mt-eval node bundle --out <dir> --include node-cards`); it lands at
  `<dir>/artifacts/node-cards`, and `cards_dir` points there on the node.
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
misconfiguration on your end — [open an issue](https://github.com/gamedaysuits/Champollion/issues)
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

### How the corpus is split

One command takes your master corpus and produces every tier, deterministically
from a seed you choose and record:

```bash
mt-eval contest prepare --corpus master.json --slug mytask --name "My Task 2026" \
    --pair 'eng>crk' --seed 20260906 --qualifier-threshold 35 \
    --dev-size 400 --secret-size 500 --sealed-holdout-size 250 \
    --test-suite <a public corpus card id> \
    --license <the licence the rights-holder grants> \
    --custodian-group <opaque id> --threshold-pubkey ./contest.pub.json \
    --out ./mytask
```

`--qualifier-threshold` is the score a method must reach on the public dev set
before your node will run it on the sealed set and the sealed holdout. It is
on the **0–100 qualifier scale**: the qualifier score is **corpus chrF++**
(sacreBLEU chrF, `word_order=2`) of the dev outputs against the released dev
references — the scoring standard's headline metric, and the same number an
`mt-eval run` card headlines for the same outputs. Nothing else is blended
into it; exact match is shown beside it as a diagnostic and never gates. Your
node computes the same number when it re-runs a method, so an entrant's
receipt and your node's measurement are comparable.

Set the threshold from chrF++ scores you have measured on this dev set (run
`contest qualify` on a baseline's dev outputs), not from scores on other
evaluation sets: chrF++ levels differ a lot between languages and corpora.
A qualifier registered before the
[scoring standard](/docs/network/specifications/scoring#how-runs-are-scored)
with the retired composite as its metric still works: its threshold is read
on the chrF++ scale, and qualify says so every time, so confirm the number or
rotate to a new qualifier.

`--license` is required. It names the licence the released dev set is offered
under, and mt-eval never picks one for you. The released file carries it as
`dataset.license`, which is what `mt-eval run`, `contest qualify` and
`publish` read, so an entrant's runs are gated by your licence. Use the rights-holder's own grant
as an SPDX id. With `CC-BY-4.0`, entrants may evaluate with any model service.
With a non-commercial licence such as `CC-BY-NC-4.0`, remote models run only
over no-training channels. With your own terms (`LicenseRef-<name>`), remote
evaluation is refused until the rights-holder's permission is recorded, so
entrants use local models.

The released files also state the master's other terms, read from the
master's own card (the corpus card `champollion network register-corpus`
wrote, through its `<file>.champollion.json` sidecar) and its own envelope:
`dataset.do_not_train` and, when the master is marked local-only,
`dataset.transmission: "local-only"` (entrants may then run the dev set only
with a model on their own machine), with `dataset.terms_from` naming where
each came from. When the master's card does not state a training term, pass
`--do-not-train true` or `false`; the flag can tighten the master's term,
never loosen it (`--do-not-train false` on a `doNotTrain: true` master is
refused). prepare prints these terms, and warns when the master's card says
redistribution is prohibited: releasing `public/` is redistribution, so do
not release it until the rights-holder agrees.

| Split | Who sees it | What it is for |
|-------|-------------|----------------|
| **Public dev set** (`--dev-size`) | everyone — source *and* references are released | the **qualifier**: entrants self-score on it before they may submit at all (Step 8) |
| **Sealed set** (`--secret-size`) | nobody but your node — source *and* references stay encrypted | what an entry is actually scored on |
| **Sealed holdout** (`--sealed-holdout-size`, optional) | nobody but your node | a **second** sealed split, scored in the same run, with its scores withheld until you close the contest |
| *Blind set* (`--blind-size`, default 0) | source released, references withheld | an optional diagnostic round of your own. It is **not** an entry path: a contest is entered by handing over a method, never by uploading translations |

The splits are disjoint and reproducible: same corpus, same seed, same split,
forever. The recipe stays in an organizer-local manifest that never leaves your
machine.

**Repeated sentences stay on one side.** The split is group-disjoint
(`group-disjoint/1`, recorded in the manifest's `split` block): rows that share
a source or a reference, exactly or after normalizing case, punctuation and
spacing, form one group, and a group lands whole in one split. So no sealed
row repeats a row of the released dev set. The groups are shuffled with your
seed and placed dev, blind, secret, holdout in that order; a master with no
repeated sentence gets exactly the split a row-by-row shuffle gives. If whole
groups cannot fill the sizes you asked for, prepare refuses, with the number
of repeated rows and the fix: remove the repeats (keep one row of each group),
or ask for a total below the master's size so some groups can be left out.

**`public/` is releasable; run logs go to `runs/`.** prepare writes a marker
file, `.champollion-releasable.json`, into `public/`. Run logs, reports and
translation caches are never written there: `mt-eval run` refuses an
`--output-dir` or `--cache-dir` inside it and names `runs/` beside it
(`<out>/runs/`) instead, and the MCP server's `run_benchmark` puts a run on
the released dev set (the baseline you run to set the threshold) in `runs/`
on its own and says so. A contest prepared before the marker existed is
recognised by its layout (`public/` beside `local/manifest.json`).

**Why a holdout.** A single sealed set can still be tuned against over a long
contest — every submission is a probe, and enough probes leak a little. A second
split that is scored in the same authorized run but whose numbers nobody sees
until close gives you a clean read at the end: if a system's rank moves between
the two, you learn something about how much was tuning and how much was
translation. Both sets are covered by **one** authorization, so it costs your
custodians no extra ceremonies.

**Third-party test suites.** `--test-suite` names a public diagnostic corpus —
someone else's, sha-pinned and publicly downloadable — that every entry is also
run on. Those numbers are **reported and never ranked**: they are there so a
reader can see whether a strong sealed-set score also holds up on a set your
contest did not design. Champollion refuses a suite that is quarantined,
unpinned, not for your language pair, or one of your own splits.

**A sealed row that is already public is not sealed.** `contest prepare`
compares your sealed set and sealed holdout with everything public: the dev
set it releases (the group-disjoint split above keeps this at zero), the
blind source release if any, and every declared test suite. It matches
exactly and after normalizing case, punctuation and spacing (the same
comparison the split groups by), then prints each overlap with a count (for
example "30 of 30 rows also appear in test suite …") and records the counts
in `local/manifest.json`. For a third-party suite it warns rather than
refuses: the suite is someone else's public text, and you decide whether to
remove those rows from the master or drop the suite, and prepare again. To check a suite, prepare needs its
sentences. It uses a copy already on your machine, and never downloads
during preparation. Name your copy with `--test-suite <id>=<path>`; its
sha256 must match the registry's pin. If no copy is found, the warning says
the suite was **not checked**, never that it was clean. The manifest records
the path of each copy prepare read, so `node init --from-contest` can point
your node at it.

Your declared holdout and suites become promises: once the first entry arrives,
the contest freezes them, so you cannot add or drop a test suite mid-contest.

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
ids, digests, and thresholds. You can read exactly what it sends before
anything goes: `contest prepare --no-register` prints the registration plan,
every row `contest register` will write, in order — each sealed set's id and
the SHA-256 of its ciphertext (with how many rows stay sealed on your machine),
the custodian group, the qualifier id and threshold, the contest row with its
recorded promises, the policy columns, and any holdout, test suites and prize
terms merged into the contest's metadata. The plan is built by the same code
that sends the rows, so it cannot describe something other than what is sent.
Every registry row is **identity-bound**: the
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
[GitHub](https://github.com/gamedaysuits/Champollion/issues). And running the organizer scoring
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

**Honesty box:** threshold *signing* (a grant that literally cannot be minted
without M signatures) is **in development**. The offline node's key ceremony
(`mt-eval node ceremony`, Shamir M-of-N) is built but has not yet been used
with a real custodian. Otherwise, the M-of-N rule is enforced as recorded
process: every access request
enters a **pending** queue, custodian decisions are recorded, a grant is minted
only for an authorized request, each grant is **single-use, time-boxed, and
bound to one specific (method, corpus version, evaluation node) fingerprint**,
and every event — including blocked attempts — lands in an **append-only,
hash-chained, publicly readable audit log**. The database refuses illegal state
transitions beneath every client and key. What it cannot yet refuse is a
compromise of the platform operator itself — that is what threshold signing
closes, and until it ships you should treat "Champollion holds zero key shares"
as the design goal being built toward, not a property you can verify today.

## Step 6 — Set the prize, and declare its terms

A prize is optional. **A contest with no declared prize terms simply has no
prize** — that is the default, and it is not a lesser contest.

If you are offering one, decide and publish with the contest:

- **Amount and currency.**
- **Sponsor** — who is putting up the money.
- **Where the funds sit** — your organization's account, or a community trust
  you designate. **Champollion never holds, escrows, or routes prize funds.**
  Publishing the holder's identity up front is what makes the prize credible;
  see the [sponsor-default risk note](/docs/network/sovereignty/terms-templates#trojan-horse-risks)
  in the terms templates.
- **Threshold conditions** — the score bar a method must clear, written
  per the [Prize Specification](/docs/network/specifications/prizes): a chrF++
  threshold, any diagnostic gates you want (such as a minimum FST acceptance —
  a gate an entry must pass, never the score), speaker-validation
  requirements, reproducibility. Make the award
  conditions verifiable from the published scores, so nobody has to take your
  word (or ours) for whether the bar was cleared.
- **The prize terms** — what happens to the entry itself.

### The prize term is yours to choose

Execution is fixed: in a sovereign contest the entrant hands you a model or a
method and your node runs it. What happens to it *after* that is your choice,
and it is one of three:

| The term | What you are telling entrants |
|---|---|
| `pass_to_holders` — *pass to holders* | The method passes to you, the sovereign benchmark holders. You score it and keep it, regardless of who wins. |
| `retain_ip` — *retain IP* | The entrant keeps ownership. You score the entry and keep at most a sealed copy for audit. |
| `release_open` — *release open* | The entrant keeps ownership but must publish the method under an open licence. That release is the prize condition. |

The detail follows from the term, so there is no matrix to fill in: what you
keep (`retention`), whether any rights move (`rights`), what you may use it for
(`host_use`) and whether the entrant must publish (`release`) are all
**derived** from the option you picked. Two of the options let you narrow one
field:

- under `retain_ip`, `--prize-retention delete_after_scoring` destroys the artifact once it has been scored (the default keeps a sealed audit copy);
- under `release_open`, `--prize-release-timing` moves the release to `required_before_scores` or `required_after_prize` (the default is `required_before_prize`), and `--prize-release-license` names the licence instead of accepting any OSI-approved one (`any_osi`).

The full derived table, and how each option is verified before a payout, is in
the [Prize Specification §2.1, condition 7](/docs/network/specifications/prizes#condition-7-in-detail-the-term-is-one-choice-of-three).

```bash
# The term…
mt-eval contest prepare … --prize-disposition retain_ip

# …with the one narrowing that option offers
mt-eval contest prepare … --prize-disposition retain_ip \
  --prize-retention delete_after_scoring

# …or the same declaration from a JSON file
mt-eval contest prepare … --prize-terms my-terms.json
```

Whichever you choose, the term is printed back to you in plain language with
a **SHA-256** before anything is written. That hash is the acceptance token:
an entrant passes `--accept-terms <hash>`, the acceptance is packed into their
bundle and covered by its content hash, and your node refuses a bundle that
accepted anything else. The term freezes the moment your contest has its first
entry, so nobody can be held to terms they never read.

Money is deliberately *not* part of the term: the amount, the currency and the
sponsor are contest information, and a term about who owns a method is a
different kind of statement from a term about how much is being paid.

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
  --prize-disposition retain_ip \
  --results-visibility hidden_until_close \
  --anonymize-until-close \
  --description "Community-custodied held-out set; scores-only; prize held by <your org/trust>."
```

Two of those flags are fixed or frozen by the database whatever you do
afterwards, and three more are **promises**:

- `--use-context` is part of the contest's identity: it is fixed the moment
  the contest is registered and can never change (create a new contest
  instead). The default is `non-commercial`.
- `--primary-metric` (default `chrf_plus_plus`), the metric the ranking uses,
  is frozen once the contest has its first entry. A new contest that names the
  retired `composite` is refused with the reason; contests registered before
  the [scoring standard](/docs/network/specifications/scoring#how-runs-are-scored)
  keep working.
- `--visibility` (default `public`), `--description` and whether intake is
  open are not frozen.

The three promises are frozen the moment your contest has its first entry:

- `--prize-disposition` / `--prize-terms` — the term from Step 6. Omit both and
  the contest has no prize.
- `--results-visibility hidden_until_close` — every score your node measures
  is **withheld** until you close the contest, so nobody tunes against the
  sealed set from their own results. This is the default; the example states
  it so the promise is visible in your own notes. Pass
  `--results-visibility immediate` if you want a live board instead, with each
  card published as your node finishes it.
- `--anonymize-until-close` — entrants appear under stable pseudonyms in your
  ranking while the contest is open. (This is your ranking view; it does not
  anonymise a card once it is published to the open board.)

The same three flags are available on `contest prepare` and `contest register`,
which is where most organizers will set them, because those doors create the
contest for you. With `contest prepare --no-register`, the registration
flags you pass (`--results-visibility`, `--anonymize-until-close`,
`--primary-metric`, the prize flags, `--visibility`, `--use-context`,
`--closed-intake`) are recorded in `local/manifest.json`, and
`contest register --manifest` applies them unless you pass its own flags,
saying so when one replaces a recorded value. Prepare prints every one of
these terms with its value, whether you gave it or it is the default, and
when it stops being changeable, before anything is registered. Its
`--help` names each default.

*(The `--corpus` value is your registered `sealed_set_id`. The sealed lane is
selected **automatically** from the sealed-set registration — no extra flag; a
sealed set can never back an ordinary contest, and an ordinary quarantined
dataset can never back any contest. Both rules are enforced in the database,
beneath every client. If you registered in Step 4 with `contest register` or
`prepare --self-serve`, the contest row **already exists** — skip this step;
`contest create` by hand is only for assembling a contest from an
already-registered sealed set.)*

## Step 8 — Methods qualify in public first

Developers build and score their methods on the **public dev set** you released
in Step 1. Your sealed set's `current_qualifier_id` names that round, and a
method must clear its threshold before a sealed run can even be requested. This
keeps probing pressure off your corpus: nobody gets to aim at the sealed set
until they have shown real performance in the open.

An entrant runs it themselves, offline, in one command:

```bash
mt-eval contest qualify <contest-id> --dev my-dev-output.txt \
    --dev-corpus <the dev corpus you released> \
    --system "acme-nmt" --method-class pipeline \
    --offline-qualifier-id <qualifier id> --offline-threshold <threshold>
```

The qualifier id and the threshold are the two facts the scoring needs from
you, so publish both with the dev release. For a contest made with `contest
prepare`, the qualifier id is the dev corpus's own id (its
`dataset.corpus_id`), and prepare writes the threshold into the dev corpus's
description. Without the two `--offline-…` flags, qualify reads them from the
contest database instead. That works only once the contest is registered on
the endpoint the entrant is pointed at. When it is not there, or the database
cannot be reached, qualify stops and prints the offline command above, filled
in with the entrant's own arguments.

`--dev` takes the entrant's translations of the dev set one per line in
corpus order, as JSON keyed by entry id, or as the run log that `mt-eval run
--corpus <the dev corpus>` wrote (or its `_report.json`). A run log is read by
entry id and checked to be a run on that same dev corpus; one with errored
entries is refused, because every entry is scored. The summary then says the
outputs were made by the harness in that run and re-scored from its file
(with that run's cost), never that they were made outside the harness; only
a plain hypotheses file is described that way.

**A pass is not yet a submission.** After the verdict, qualify says what it
can already tell about submitting. For a run of a method plugin whose folder
is on the machine, it runs the same static scan `submit-method` and your node
run (network libraries, shell network tools, forbidden filesystem paths) and
shows anything that would be refused, such as a plugin that imports `urllib`
to call a model server. For a run of the harness's own LLM path (a model
reached through a provider), it says there is no method to submit as it is:
the node runs an entry with no network, so the model has to travel inside it
(see *Bundle every model your method calls* below). Otherwise the pass line
names the checks still ahead at submit time. None of this changes the
verdict or the receipt.

It prints the qualifier score (what gates) and the threshold side by side,
both on the 0–100 chrF++ qualifier scale, then what the score is: corpus
chrF++ with its sacreBLEU signature, the other standard metrics beside it
(never blended), exact match as a diagnostic that never gates, and any score
caveats. Qualify publishes nothing. A system whose dev
outputs are mostly copies of their source text is refused whatever it scores:
when half or more of them are the source (case, accents and punctuation
ignored, and leaving out lines whose reference is the source itself, such as
names), the entrant is not translating. The same rule refuses it again when
your node re-executes it. That writes a **qualifier receipt** on their
machine, which `submit-model` and `submit-method` refuse to build a
submission without. Receipts are kept per contest and per system (`--system`),
so an entrant who qualifies two systems keeps both; re-qualifying the same
system keeps the earlier receipt alongside. `submit-method` and
`submit-model` use the receipt for `--system` (default: the one for `--name`,
else the contest's only receipt) and refuse, with the list, when that is
ambiguous. The receipt is
self-reported by construction — so it is not what gates. Before any grant is
claimed, **your node re-executes the submitted method on the same dev set** and
compares its own measurement to the claim; a receipt that overstates the method
is denied there, with claimed-vs-measured in the denial.

**A receipt names the run it came from.** When `--dev` is a run log (or its
`_report.json`), the receipt records the run and the model it ran: for
`mt-eval run --method local-model -m <model>`, the Hugging Face id and
revision, or the model directory with a SHA-256 over its files. A
`local-model` run log that names no model is refused — earlier 0.2.0 builds
did not pass `-m` to that engine, which then ran a fallback English→Spanish
model in its place. `submit-model` then checks that the weights it packs are
among the files the receipt names, and refuses, naming both hashes, when they
are not. A receipt scored from a plain hypotheses file names no model; the
node's re-execution is the check for it.

**A gap between the receipt and the node is flagged.** Both numbers are
computed the same way — the same scorer, the same dev set, and for a model
the same decode-length rule — so the same weights land within a fraction of
a point. When the node's number and the receipt's differ by more than **2.0
points** on the 0–100 qualifier scale, the node says so after its
re-execution; an air-gapped node also records the gap with its check in its
local ledger and prints it again for the custodian at `node approve
--offline`. It is a flag, never a refusal:
the node's own number is what gates. (The 2.0 bound is a deliberately
conservative choice that flags readily; it is a policy value an organizer
may want to revisit.)

### Entrants can rehearse everything before they submit

Nobody should learn that their bundle was malformed from a rejection days
later. `mt-eval contest validate` runs, on the entrant's machine and with no
network, exactly what your node runs first:

```bash
# the static checks your node runs on a bundle
mt-eval contest validate ./my-bundle.tar.gz

# …and the qualifier: does my dev output line up, and does it clear the bar?
mt-eval contest validate ./my-bundle.tar.gz --contest <contest-id> \
    --dev my-dev-output.txt --dev-corpus <released dev corpus>
```

It prints a findings table and exits non-zero if anything would be refused
(`--json` for tooling). Point entrants at it in your call for participation:
it costs them one command and saves you the denials.

`validate` writes nothing. It re-scores the dev output without writing a
receipt, then checks a receipt:

- **A packed bundle** (the `.tar.gz` a submit command wrote) carries the
  receipt it was packaged with, and that copy is the one your node reads. So
  validate checks the rehearsal against that copy. It also finds the receipt
  on the entrant's machine the copy came from and names its system, whatever
  the bundle's method is called. It warns when `--system` names a different
  receipt, and when the entrant has qualified that system again since
  packaging (the bundle still carries the older receipt). Without
  `--offline-…` flags, the qualifier id and threshold also come from that
  copy, which means they are the values the entrant gave `contest qualify`.
  The finding says so.
- **A source directory** packed for the check with `--manifest`: validate
  uses the receipt `submit-method` and `submit-model` will embed, found the
  way they find it: `--system`, else the receipt named like the bundle's
  method, else the contest's only receipt.

It warns when that receipt covers different dev output, another dev file or
another qualifier. It also warns when there is no receipt. Receipts come from
`contest qualify` only.

It is a rehearsal, and it says so. Your node still builds the image with no
network, runs the container, and re-runs the qualifier itself. A clean validate
means nothing is *already known* to be wrong — not that the run will score.

:::note[Participants: which endpoint does your contest live on?]
A **network-hosted** contest needs no endpoint setup — the default endpoint the
harness ships with carries the contest machinery (the qualifier gate, method
proposals, authorization), and `mt-eval contest submit-model` /
`submit-method` talk to it directly. You need harness **0.2.0 or later**
(`mt-eval --version`); earlier releases lack `qualify`, `validate`, `rank` and
`close`. Network-hosted contests open only when an organizer is registered
through the door described in the caveat above, so most contests today are
**federated**.

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

For each entry:

1. A **request** is filed against your sealed set — it enters `pending` and
   carries an immutable fingerprint of (bundle hash, corpus id, corpus
   version, `scores-only`, evaluation-node measurement).
2. Your node runs its **own static checks** on the bundle. For a code entry
   (Lane B) it then checks it can run it at all: a container runtime is
   present, and the RAM, scratch disk and runtime the bundle declares fit
   your `sandbox` caps. A miss there is not a verdict on the method. The
   refusal names every mismatch ("8 GB RAM requested, this node allows 4 GB
   (sandbox.max_ram_gb)"), nothing is run or rejected, and the request stays
   as it was. You can raise the cap in `node.json` and re-run
   `mt-eval node run-method <id>` with no resubmission. Or the entrant can
   repackage with the flags the refusal prints (for example `--ram-gb 4`);
   the requirements are inside the bundle's hash, so that is a new request.
   Then the node **re-executes the entrant's qualifier claim** on its own
   copy of the public dev set. Their receipt is a claim; this is the
   measurement. A miss is
   denied here — before any custodian is asked to approve anything, and before
   the sealed set is opened — and the denial says what was claimed, what was
   measured, and what the bar was. A bundle that accepted prize terms other
   than the ones your contest declares is refused at the same point.
3. Your **custodians decide** (M-of-N). Approval mints a **grant**: single-use,
   expiring, valid only for that exact fingerprint.
4. The evaluation runs in the network-isolated sandbox on **your** node
   (`mt-eval node run-method`): a container with no network stack, references
   held outside it — or, for maximum isolation, on a true-airgap machine with
   signed scores-only bundles crossing by removable media (see the status box
   above for what is and isn't covered). A dark node uploads nothing: you
   carry its signed score bundle out and publish the run card from a connected
   machine (`mt-eval node relay`). Your sealed holdout and any declared
   third-party test suites run inside the **same** authorized run, so they cost
   your custodians no extra ceremony.
5. **Only scores leave.** The `scores-only` emission rule is pinned at the
   database layer; per-entry text from your corpus is never published.
6. If your contest promised `hidden_until_close`, the score does not publish
   yet: it is **withheld** as a deferred result that only you can see, and
   `contest close` publishes every withheld card before it freezes the
   ranking. A withheld result is never a lost one.
7. Every step — request, votes, grant, use, and any blocked attempt — is
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
mt-eval contest submit-model <contest-id> \
  --model-dir ./my-model \          # config.json + model.safetensors + tokenizer.* at the ROOT
  --name "My NMT" --version 2.0 \
  --architecture MarianMTModel \    # must be on the organizer's trusted whitelist
  --method-class pipeline --paradigm neural-nmt \
  --track constrained --training-data-file ./training-data.txt \
  --parameter-count 92487 \
  --weights-license Apache-2.0 --weights-public \
  --developer "Your Name" --node-id <organizer-advertised-node-id> --agree
```

**A model trained with NMT Forge.** `nmt-forge export` writes the
deployable folder `export/model/`. Besides the weights, config and tokenizer
it holds `forge-model.json` (that model's scores on your private test set,
and local paths), `DEPLOY.md` and `champollion-plugin/`, none of which is
part of an entry. `submit-model` packs only the files transformers reads
(weights, `config.json`, `generation_config.json`, the tokenizer files) and
prints everything it left out, so those three stay out by themselves.
Section 6 of that `DEPLOY.md` lists the files that make the entry, the
architecture from `config.json`, and the parameter count read from the
weights file's header, with the exact command. To send exactly the files you
have looked at, copy them into a folder of their own and pass it as
`--model-dir`:

```bash
mkdir -p lane-a
cp export/model/config.json export/model/generation_config.json \
   export/model/model.safetensors export/model/tokenizer.json \
   export/model/tokenizer_config.json lane-a/      # the files DEPLOY.md §6 lists
mt-eval contest submit-model <contest-id> --model-dir lane-a \
  --architecture MarianMTModel --paradigm neural-nmt …
```

**Which parameter count.** Lane A checks `--parameter-count` against the
weights file. It adds up the tensor sizes in the `safetensors` header and
refuses a claim more than 1% off. That is what the file stores, and it can
differ from a count taken in torch. A tied or shared weight is stored once. A
table the model rebuilds when it loads, such as sinusoidal positions, may not
be saved at all. The refusal prints the file's count; declare that number.

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

**What `submit-model` packs.** The data files at the root of `--model-dir`
(`.safetensors`, `.json`, `.model`, `.txt`, `.spm`, `.vocab`, `.merges`): the
weights, config, tokenizer and generation config. Everything else — a
`README.md` or `DEPLOY.md`, a subfolder, a pickle checkpoint beside the
safetensors — is left out, and the command lists what it left out. So the
`model/` folder `nmt-forge export` writes submits as it is: its `DEPLOY.md`
and `champollion-plugin/` stay behind. `contest validate` packs the same way
and reports the left-out files as an INFO finding. Your node's check is
unchanged: a bundle that carries a non-data file is still refused there.

**How long outputs can be.** Your node decodes with an explicit length,
always: the `max_new_tokens` or `max_length` the model declares (its
`generation_config.json`), else up to `max(64, 4 × source tokens)` new tokens
per sentence, capped at the decoder's positions. `mt-eval run --method
local-model` decodes by the same rule, so an entrant's receipt and your
node's re-execution agree. `submit-model` prints the length that will apply
and writes it into the manifest (`model.decodeLength`); the node records the
length it applied in the run's execution facts (`execution.generation`).
Without an explicit length, the transformers library stops at about 20
tokens, and every entry would be scored on cut-off output.

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

**Bundle every model your method calls.** The node runs your entry with no
network at all, so a method that calls a hosted model API (an LLM-coached
hybrid that asks a cloud LLM, an MT service) gets no answer and scores
nothing. An LLM-coached hybrid qualifies only with its LLM inside the bundle:
open weights under `/method`, run in-process or by a local server your
entrypoint starts. The same goes for any dictionary, FST or other data your
method reads at run time. (The [methods specification](/docs/network/specifications/methods#method-validity-and-dependency-classes)
calls a method that needs a hosted LLM dependency class A1; the gateway that
would let one run in the sandbox is not built.)

**The runnable-bundle contract is stdin/stdout.** Inside the container, the
organizer's node runs exactly:

```
cat /eval/source.txt | <your entrypoint> > /output/translations.txt
```

Source sentences arrive one per line on stdin; you write one translation per
line to stdout. The container has no network stack (`--network=none`), a
read-only root, and a writable `/tmp`.

**Where your files go.** Everything in the folder you pass as `--method-dir`
is packed under `method/` in the bundle and mounted **read-only at `/method`**
at run time, weights included, so nothing needs copying into the image. Lay it
out like this:

```text
my-method/              ← --method-dir ./my-method
  translate.py          ← --entrypoint translate.py   (runs as /method/translate.py)
  weights/              ← read at /method/weights
  wheels/               ← vendored dependencies (see the Dockerfile below)
Dockerfile              ← --dockerfile ./Dockerfile
training-data.txt       ← --training-data-file ./training-data.txt
```

`--entrypoint` is the script's path inside `--method-dir`. Its bundle path,
`method/translate.py`, is accepted too. If a name could mean two different
files, the command refuses and names both; if the file is missing, it names
every path it looked for.

**A minimal Hugging Face transformers wrapper:**

```python title="my-method/translate.py"
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
RUN python3 -m pip install --no-index --find-links=/wheels torch transformers sentencepiece
# Weights are NOT copied — /method is mounted read-only at run time.
```

**What every submission must carry.** These are required, and the command
stops before any network step if one is missing:

- `--method-dir`, `--dockerfile`, `--entrypoint`, `--name`, `--version`,
  `--method-class`, `--developer`, `--node-id`, and `--agree`;
- a **passing `mt-eval contest qualify` receipt** for this contest and this
  system (Step 8; `--system` names it when you have qualified more than one);
- two declarations, recorded as your claims: `--track constrained` or
  `--track unconstrained` (there is no default), and `--parameter-count`;
- for a method with trained weights (`--parameter-count` above 0): also
  `--weights-license <SPDX id or LicenseRef-…>` and one of `--weights-public`
  or `--weights-private`;
- for a method with **no trained weights** (rule-based, a dictionary, an FST):
  `--parameter-count 0` and no weights flags. The submission records the
  weights licence and openness as not applicable, rather than a licence you
  would have to make up;
- for a method that **prompts an LLM** (it trains nothing, it only writes
  prompts): the count is the parameters of every model the bundle runs, the
  LLM included, although you did not train it. Take it from the LLM's model
  card or its weights header, and pass the LLM's licence as
  `--weights-license` with `--weights-public` when its weights are openly
  downloadable. `--parameter-count 0` would misstate the system: 0 means the
  method runs no model at all. A method that calls a hosted LLM cannot enter
  a sealed contest at all: the node has no network, and the gateway that
  would carry such calls is not built (see *Bundle every model your method
  calls* above). `contest qualify` already says so when the outputs it
  scores came through a provider;
- with `--track constrained`: `--training-data-file`, a plain-text list of the
  data you trained on (a method trained on nothing says so in the file);
- if the contest declares prize terms: `--accept-terms <hash>` (run once
  without it and the terms are printed with the hash to pass back); if it
  requires descriptions: `--description-file`.

**The resources your method declares.** The bundle states the RAM, scratch
disk and wall-clock time it needs, and the organizer's node refuses one that
asks for more than its `sandbox` caps. The defaults are the caps in the
node template that `mt-eval node init` writes: `--ram-gb 4`, `--disk-gb 4`,
`--max-runtime-minutes 30`, no GPU. A bundle packaged with the defaults
therefore runs on a node configured with the template's defaults. If your
method needs more, say so with those flags (and `--gpu`), and check that the
organizer's node allows it. Organizers who change the caps should publish
them with the contest. If the node refuses, the refusal names each value
and what the node allows.

Submit it with:

```bash
mt-eval contest submit-method <contest-id> \
  --method-dir ./my-method --dockerfile ./Dockerfile \
  --name "My NMT" --version 1.0 \
  --entrypoint translate.py \
  --method-class pipeline --paradigm neural-nmt \
  --developer "Your Name" --node-id <organizer-advertised-node-id> \
  --track constrained --parameter-count 78000000 \
  --weights-license Apache-2.0 --weights-public \
  --training-data-file ./training-data.txt \
  --primary \
  --agree
```

The organizer's node re-executes your method on its own copy of the public dev
set before any custodian is asked to approve the run. `--agree` acknowledges
the method-submission terms.

**Multi-GB weights, or no connection: use the sneakernet lane.** The hosted
intake path uploads your tarball as a **single POST** to the contest host's
storage, so it is bounded by that host's storage upload limit — fine for code
and small models, not for multi-GB checkpoints. The bundle contract itself
allows far larger artifacts (tarballs up to 100 GB, built images up to
150 GB). `--offline` packages the bundle and writes an exchange directory
with no network at all. With no connection there is no contest row to read,
so it also needs the values the organizer published: `--bundle-out`,
`--secret-set`, `--pair`, `--developer-email`, `--offline-qualifier-id` and
`--offline-threshold` (the threshold on the 0–100 qualifier scale). A rule-based method
with no weights, packaged offline:

```bash
mt-eval contest submit-method <contest-id> \
  --method-dir ./my-method --dockerfile ./Dockerfile \
  --name "My Rules" --version 1.0 \
  --entrypoint translate.py \
  --method-class pipeline --paradigm rule-based \
  --developer "Your Name" --developer-email you@example.org \
  --node-id <organizer-advertised-node-id> \
  --track constrained --parameter-count 0 \
  --training-data-file ./training-data.txt \
  --agree \
  --offline --bundle-out ./exchange \
  --secret-set <sealed-set-id> --pair 'eng>crk' \
  --offline-qualifier-id <published-qualifier-id> --offline-threshold 35
```

The exchange directory travels to the organizer by removable media (or any
channel you both trust); they ingest it with `mt-eval node import-bundle`. The
bundle's SHA-256 is frozen into the authorization request either way, so what
runs is provably what you proposed.

**Organizers: an offline proposal waits for a custodian, as an online one
does — and the node checks it first, in the Step 9 order.** It arrives as a
*pending* request, and the air-gapped node records both its own checks and
the custodian's decision itself, with no database and no service key:

```bash
mt-eval node import-bundle ./exchange               # stages it: PENDING custodian approval
mt-eval node run-method <request-id> --offline      # the node's checks: re-runs the entrant's qualifier, checks the container runtime
mt-eval node list --offline                         # what is staged, checked, approved or waiting, and the next command
mt-eval node approve <request-id> --offline --actor <custodian>
#   or: mt-eval node deny <request-id> --offline --actor <custodian> --reason "…"
mt-eval node run-method <request-id> --offline      # the sealed run: refuses until the approval is recorded
mt-eval node export-scores ./exchange               # signed scores, or the signed refusal
```

The first `node run-method --offline` on a pending proposal opens nothing
sealed. It re-executes the entrant's qualifier on the public dev set (the
`qualifier` + `dev_corpus` your `node.json` declares; `node init
--from-contest` fills both), and, for a code entry, checks that a container
runtime is present and that the bundle's declared RAM, scratch disk and
runtime fit your `sandbox` caps. A pass is written to the node's
hash-chained local ledger. A qualifier miss is refused there, recorded as the
node's denial, and travels back as a signed refusal: no custodian is asked.
A node that cannot run the entry (no runtime, a cap too small) refuses as a
node problem and records nothing, and the request stays as it was.

`node approve --offline` refuses until that passing check is in the ledger
for this request's exact fingerprint and bundle, and its error names the
command to run first. It then writes a vote and the authorization to the
same ledger (the one the custodian-share ceremony uses) and a decision record
signed with the node's `signing_key`, naming the check it was given on. The
second `node run-method --offline` checks all three before anything sealed
runs (the ledger verifies, it shows this request authorized under the
fingerprint that was imported, and the signed record verifies and names this
request), so a pending proposal never runs on an operator's say-so alone. It
then re-runs the runtime check and the qualifier before the sealed set opens.
A denial is recorded the same way and travels back to the entrant as a signed
refusal; a custodian may deny at any point, checked or not.
Requests that arrive already authorized — a relay export (authorized in the
contest database) or `node stage-request` (the staging organizer is the
authorization) — need no second decision.

**Organizers: pre-load base images on airgap machines.** Because the image
build runs with `--network=none`, the Dockerfile's `FROM` base image must
already be in the machine's local image store. On a connected machine,
`docker pull python:3.11-slim && docker save -o base.tar python:3.11-slim`;
carry `base.tar` over with the bundle; on the airgap machine,
`docker load -i base.tar` before running `mt-eval node run-method`. Agree on
the base image(s) with participants in your published contest materials.

## Step 10 — Rank, close, export

Scores-only results publish to the [leaderboard](/docs/network/leaderboard/rules)
like any other run, marked as sealed-set evaluations. The contest's own
ranking is yours to build, freeze and publish:

```bash
mt-eval contest open-intake <contest-id>     # entry intake on — submit-model / submit-method admitted (owner only)
mt-eval contest close-intake <contest-id>    # intake off — work already received still scores
mt-eval contest rank <contest-id> --json     # provisional ranking, any time
mt-eval contest close <contest-id>           # one-way: freezes the ranking, shuts intake
mt-eval contest export <contest-id> --format csv --out results.csv
```

What `rank` does, so you can say it in your rules: entries are ranked on the
contest's **recorded primary metric** (`--primary-metric` at creation; chrF++
by default), then chrF++ → BLEU → COMET → earliest submission. It is
**verified-only by default** — the run cards the node published — and counts
any self-reported cards it hid. Every adjacent pair carries a labelled tie
verdict: a per-segment paired significance test where per-segment rows exist,
otherwise **95 % confidence-interval overlap**, otherwise point equality.
**A sealed contest never publishes per-segment rows** (aggregates only, by
design), so its paired test runs on your node instead. Before closing, run
`mt-eval node verdicts --contest <id> --out verdicts.json` on the node; it
writes signed verdicts only (per pair: p-value, score difference, interval,
segment count — no text). Then close with `--node-verdicts verdicts.json
--verify-key <the node's .pub.json>`. Without verdicts, ties come from CI
overlap. Either way the output names the evidence it used, and tied systems
share a rank (`1, 1, 3`).

`close` is one-way. It ranks on the recorded metric, refuses while
submissions are still being scored (unless you force it), shows you the
table, asks, and then freezes the ranking into the contest record. `export`
returns that frozen result verbatim, as JSON or CSV, for your Findings or
results page. Cards scored on any other set (a fully-secret T2 set, a stray
dev-set card) are listed separately and never mixed into the main ranking.

### Deciding when results appear

Two promises you make at creation, and cannot quietly change afterwards — the
database freezes both the moment your contest has an entry:

```bash
mt-eval contest create … \
  --results-visibility hidden_until_close \   # no score is visible while the contest runs
  --anonymize-until-close                     # pseudonyms in YOUR ranking artifacts
```

**`--results-visibility hidden_until_close` is the one that actually hides a
score.** Under it, every card your node scores is held back rather than
published: the method still ran, the authorization was still consumed, and the
card is assembled, validated and stored verbatim — it simply is not on the
board. `contest close` publishes every held card **first**, then builds and
freezes the ranking, so nothing is lost and the frozen result ranks everything
you hold. That happens on a forced close too: forcing is about ranking work
still in flight, never about withholding a score your contest owes. The frozen
snapshot lists exactly which results the close published.

Withheld is a **recorded state, not a lost run**: the held card cannot be
edited, and the pointer that says where it was published is written once and
never re-pointed — both enforced in the database, beneath every client. While
the contest is open, `rank` tells you how many results are being withheld, so
a provisional ranking never reads as complete when it is not.

**`--anonymize-until-close` does less, and it is worth being precise about
what.** It replaces entrant names with deterministic pseudonyms in *your*
ranking artifacts — the `rank` table, its JSON, the CSV — while the contest is
open, and `close` reveals them. It does **not** anonymise the public
leaderboard: a card that has been published shows the byline the entry
declared. If you want entrants unable to see each other's results before the
end, that is `--results-visibility hidden_until_close`; this flag is not a
substitute for it.

If a method clears the threshold conditions you published in Step 6 —
including [speaker validation](/docs/network/specifications/speaker-validation),
which is your community's gate, not an automated one — **you** (or your trust)
award the prize, per your own published terms. Champollion's role ends at
measurement.

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
