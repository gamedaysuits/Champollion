---
title: Hosting a sealed test, and joining a project
slug: /agents/hosting-and-joining
description: "Two ways in beyond building: host a sealed test with mt-eval contest and mt-eval node (it works, it is not on the rails yet, and the organizer's chosen custodians hold the key shares), and join a registered project with mt-eval project — every command, what it sends where, and what it never shows."
---

# Hosting a sealed test, and joining a project

Two lanes beside the build rails. Both are plain `mt-eval` commands; neither
is a step `champollion next` names.

## Hosting a sealed test

**Honest status.**

- It works: preparing a sealed set, a key ceremony, running entries on an
  air-gapped node, verdicts and ranking are all commands with tests.
- **It is not on the rails yet.** `champollion new --kind task` is refused;
  the only journey is the language one. Expect a longer manual walk, and
  follow the [contest runbook](/docs/network/sovereignty/run-a-sovereign-contest).
- **The key shares are held by custodians the organizer names.** Nothing in
  the code appoints or vets them. No community key custodians have been
  appointed for any test.
- **Champollion holds no key share and no private key.** The ceremony runs on
  the organizer's machine, and registration sends only identifiers, digests
  and the qualifier threshold — never a key, a share or the sentences.

**Note.** Hosting decides what happens to people's sentences and who can
unlock them. Every step below is the organizer's decision; run each only
when they ask for it.

### What gets made

`mt-eval contest prepare` splits the organizer's corpus:

| Flag | Set | Who sees it |
|---|---|---|
| `--dev-size` (required) | The qualifier: source and references | Public, released from `<out>/public/` |
| `--secret-size` | The sealed test the contest is registered against | Nobody: sealed in `<out>/local/` |
| `--sealed-holdout-size` (needs `--secret-size`) | A second sealed split, scored but withheld until close | Nobody |

`--seed`, `--qualifier-threshold` (above 0) and `--license` are required — no
licence is assumed. `--custodian-group` and `--threshold-pubkey` are required
(the key the sealed sets are encrypted to). The plaintext of each sealed set
is deleted after sealing; `<out>/local/manifest.json` holds the recipe and
never leaves the machine. Sealing runs `champollion network seal-corpus seal`, so the
`champollion` CLI must be installed.

### Custody

**Threshold custody (M-of-N).** On the air-gapped node:

```bash
mt-eval node ceremony init --dir <ceremony> --set <sealed set id> --group <group id> --quorum 3 --shares 5 \
  --custodian <name 1> --custodian <name 2> --custodian <name 3> --custodian <name 4> --custodian <name 5>
mt-eval node ceremony share --dir <ceremony> --custodian <name 1> --dest <their token>
mt-eval node ceremony verify --dir <ceremony> --share <a> --share <b> --share <c>
mt-eval node ceremony share --dir <ceremony> --wipe-originals
```

`init` generates the key, splits it with Shamir's scheme and zeroes it in one
call; it writes `ceremony.json` (the public record) and one share file per
custodian. `--set` must be the secret set's id and `--group` the
`--custodian-group` prepare will use — prepare does not check them, and a
mismatch is found only when a run is refused. Give prepare the ceremony's
record: `--threshold-pubkey <ceremony>/ceremony.json`.

**Lock.** A sealed set is decrypted only by `mt-eval node run-method <id>
--offline --share … --share …` with at least M shares from distinct
custodians whose ids match the set. Threshold custody runs only on this
offline lane.

**Single key.** `champollion network seal-corpus keygen --out <dir>` makes one
keypair; whoever holds its key file can decrypt alone. It is what the
connected node lane uses.

### The organizer's walk (threshold custody)

```bash
mt-eval node bundle --out <bundle>                    # on a connected machine: the node's install
mt-eval node bundle --verify <bundle>                 # on the node
mt-eval node keygen --out <keys>
# the ceremony, above
mt-eval contest prepare --corpus master.json --slug <slug> --name "<name>" --pair '<src>><tgt>' \
  --dev-size <n> --secret-size <n> --seed <n> --qualifier-threshold <chrF++> --license <licence> \
  --custodian-group <group id> --threshold-pubkey <ceremony>/ceremony.json --out ./<slug> --no-register
mt-eval contest register --manifest ./<slug>/local/manifest.json
mt-eval node init --from-contest ./<slug>
mt-eval node egress-check
mt-eval node import-bundle <exchange>                 # entries, carried in
mt-eval node run-method <request id> --offline --share <s1> --share <s2> --share <s3>
mt-eval node export-scores <exchange>
mt-eval node verdicts --contest <slug> --out verdicts.json --metric chrf_plus_plus --tie-test ar \
  --alpha <a> --n-resamples <n> --seed <n>
mt-eval contest rank <slug>
mt-eval contest close <slug> --node-verdicts verdicts.json --verify-key <score-signing public key>
```

`node init --from-contest` sets threshold custody when the set was sealed to
a ceremony key. Entrants qualify on the public dev set (`mt-eval contest
qualify`) and submit methods or models (`mt-eval contest submit-method`,
`mt-eval contest submit-model`, both with an `--offline --bundle-out` path).
The [node guide](/docs/network/sovereignty/sovereign-eval-node) has every
node command.

### What needs a connection, and whose

| Works offline | Needs a sign-in | Needs the database's service key |
|---|---|---|
| `contest prepare --no-register`, `contest qualify` (with `--offline-qualifier-id`, `--offline-threshold`), `contest validate`, `submit-* --offline`, every `node ceremony`, `node seal`, `node keygen`, `node init`, `node import-bundle`, `node run-method --offline`, `node export-scores`, `node verdicts`, `node egress-check` | `contest register`, `contest create`, online `submit-*`, `contest open-intake`, `contest close-intake`, `contest close` | `contest prepare` without `--no-register` or `--self-serve`, `node serve`, `node list`, `node approve`, `node deny`, online `node run-method`, `node relay`, and `contest close` when results were withheld |

The service key belongs to whoever runs the database. An outside organizer
runs these against a database of their own (`MT_EVAL_SUPABASE_URL` and its
keys), or keeps to the offline lane — whose scores are verifiable from their
signed manifests but get no public board entry. **Note.** Never set
`MT_EVAL_ALLOW_PROD`: it lifts the tools' refusal to write to the default
production database, and that is not an agent's call.

## Joining a project

A **registered project** is a language project its owner listed so others
can help, with files: sentences, word lists or methods (review time and
computing are not offered yet). The `mt-eval
project` commands below talk to the project database
(`MT_EVAL_SUPABASE_URL`). Every subcommand except `list` (anonymous) and
`review` (the operator's) signs in (a cached
session, `MT_EVAL_REFRESH_TOKEN`, or an interactive GitHub or Google
sign-in); the account is the sign-in's email.

**The rules.**

- **Reviewed before listing.** A new project starts `pending_review`; it is
  listed only after review. An owner can close a project, never list it.
- **The owner is named as they choose** (`--owner-name`). The project row
  holds no email; the owner's account is kept apart, readable only by them.
- **No email in a listing.** `project list` is anonymous and shows names and
  counts; `project offers` prints helpers by the name they gave (`--as`).
  The owner's account can still read a helper's account email in the offer's
  record, and the consent note records both accounts.
- **Offers are held by both.** Accepting writes a consent note naming who
  submitted it and who authorized it.
- **Nothing is printed from a file.** Names, counts and states only.

### Owner

```bash
mt-eval project register --project . --name "<project name>" --owner-name "<as they want to be named>" \
  --purpose "<what the translations are for>"
mt-eval project ask <slug> --kind sentences --what "<what would help>" --how-many 200 --terms "<their terms>"
mt-eval project offers <slug>
mt-eval project accept <offer id> --into .
mt-eval project decline <offer id> --why "<reason>"
```

- `register` reads the pair from `champollion.project.json` (and the purpose,
  unless `--purpose`); optional `--slug`, `--domain`, `--register`, `--about`.
  At most 5 registrations per account per 24 hours.
- `ask` `--kind` is `sentences`, `word-list` or `method`; asks show only while
  the project is listed.
- `accept` downloads the file, **verifies its sha256** (refused on a
  mismatch), writes `inbox/offer-<offer id>-<file name>` and
  `consent/offer-<offer id>.json` (`offer_id`, `file`, `sha256`,
  `submitted_by`, `authorized_by`, `terms`, `note`, `held_by`), then marks the
  offer accepted. The file then comes in like any other —
  `champollion data add inbox/<file>` — and its holders' terms are asked.
- **Note.** The helper's `--terms` are in the consent note. The answers you
  record with `champollion data mark` must not loosen them.

### Helper

```bash
mt-eval project list
mt-eval project offer <slug> <file> --as "<your name>" --terms "<what it may be used for>" --ask <ask id> --note "<note>"
mt-eval project withdraw <offer id>
```

- `offer` uploads one non-empty file of at most 50 MB to the project's
  private storage, with its sha256, to a listed project only. At most 24
  offers per helper per 24 hours.
- An offer moves once: `offered` → `accepted`, `declined` or `withdrawn`.
- **Note.** Withdrawing or declining changes the offer's state; it does not
  delete the uploaded file from storage. Say so before a helper offers
  anything they may want back.
- **Lock.** `offer` reads the file's sidecar before uploading anything. It
  refuses a `local-only` file, a `sealed` set, and a file whose
  `speakers_agreed` is `not-yet` or `some-said-no`; an unreadable sidecar
  stops the offer. There is no override: the mark is the holders' to change.
  A `training: not-allowed` term is added to the offer's terms, so the owner
  sees it.
- **Note.** An offer sends the file off the helper's computer to the project
  database's storage. Ask the helper, and never offer a file for them.

`mt-eval project review` is the database operator's (it uses the service
key). It is not an agent's command.

## Go deeper

- [Host a sealed test](/docs/host-a-sealed-test) and
  [Join a project](/docs/join-a-project) — the people's versions.
- [Run a sovereign contest](/docs/network/sovereignty/run-a-sovereign-contest)
  and [the sovereign eval node](/docs/network/sovereignty/sovereign-eval-node).
- [Ownership transfer](/docs/network/sovereignty/ownership-transfer) and
  [terms templates](/docs/network/sovereignty/terms-templates).
- [Data and transmission rules](/docs/agents/data-rules) — sealed sets and
  local-only files.
- [`mt-eval` reference](/docs/reference/mt-eval).
