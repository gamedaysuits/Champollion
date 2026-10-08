---
sidebar_position: 8
title: Registering Corpora & Exposure Lanes
slug: /network/sovereignty/registering-corpora
description: "Register an evaluation corpus without surrendering it. The four exposure tiers — local-only, private, public and sealed — the license lanes that run alongside them, and how fetch-from-source keeps corpus content out of our hands."
related:
  - label: "Data Stewardship"
    to: /docs/network/sovereignty/data-sovereignty
    kind: doc
    note: "The position these mechanics implement"
  - label: "Ownership & Terms"
    to: /docs/network/sovereignty/ownership-transfer
    kind: doc
  - label: "Evaluation Datasets"
    to: /docs/network/leaderboard/datasets
    kind: doc
    note: "The catalogue these lanes apply to"
  - label: "Corpus Design Framework"
    to: /docs/network/specifications/corpus-design
    kind: spec
---

# Registering Corpora & Exposure Lanes

> **Executive Summary.** You can register an evaluation corpus with the Network so
> methods can be benchmarked against it **without handing us the data**. Every
> corpus is registered as a sha-pinned *metadata card*, not content — the actual
> sentences are fetched from their source at evaluation time. When you register
> you make two independent choices: an **exposure tier** — how much leaves your
> machine (`local-only`, `private`, `public`, or `sealed`, where the corpus is
> encrypted on your device under an M-of-N custodian key) — and a **license
> lane**, which governs what the corpus may be used for (public, non-commercial
> research-only, or private). This is the mechanism that lets a community make
> its language *measurable* without making it *extractable*.

Machine-translation evaluation usually demands the opposite of data sovereignty:
"upload your test set so we can score against it." That is a non-starter for
Indigenous-language and other community-held corpora, where the data is owned by
the people it comes from. The Network is built so you never have to make that
trade.

---

## 1. Registration is metadata, not content

A registered corpus is a **card**: a small JSON record describing *where* the
corpus lives and *what it is*, with a content hash so the exact bytes can be
verified — but **no sentences**. A card carries:

| Field | What it is |
|-------|-----------|
| `url` | Where the corpus is fetched from (the upstream archive you control) |
| `sha256` | Content hash of the pinned archive — proves nobody swapped the data |
| `license` | SPDX identifier (or `LicenseRef-…` for a bespoke license) |
| `language_pair` | Source → target, e.g. `eng-crk` |
| `do_not_train` | Always set — evaluation data must never be trained on |
| `attribution` | The builder/linguist credit shown everywhere the corpus appears |

At evaluation time the harness **fetches from source**, verifies the `sha256`,
and scores against the freshly fetched references. The Network never stores, hosts,
or redistributes the corpus content. If you take the upstream archive offline,
the corpus simply stops being runnable — control stays with you. This is the
same fetch-from-source discipline applied to the whole catalogue (see
[Evaluation Datasets](/docs/network/leaderboard/datasets)).

:::info[Why a hash instead of a copy]
A content hash lets a self-reported score be **re-checked** against the real,
unmodified corpus without us ever holding that corpus. A run whose numbers don't
reproduce against the hash-pinned source is rejected. Verifiability and
non-possession are not in tension here — the hash is what makes both possible.
:::

---

## 2. Two separate choices

Registration asks you two independent questions, and it is worth keeping them
apart because they protect different things:

1. **What leaves your machine** — the *exposure tier*.
2. **What your corpus may be used for** — the *license lane*.

A corpus can be sealed and non-commercial, or public and commercially clear, or
any other combination. One does not imply the other.

### 2a. Exposure tiers — what leaves your machine

Four tiers, defined in `cli/lib/corpus-registration.mjs`. **Plaintext corpus
content is never uploaded in any of them** — that is not a policy setting, it is
true of every tier. Registration always defaults to the most private.

| Tier | Registered? | What we receive | Card tracked |
|---|:---:|---|:---:|
| **Private / local-only** | ❌ | Nothing. Card and text stay on your machine. **The default.** | ❌ |
| **Register privately** | ✅ | Metadata only — a WMT-style secret held-out set. You keep custody; results can be published without exposing the data. | ✅ |
| **Register publicly** | ✅ | Metadata + a fetch-from-source pointer. Your text is fetched from upstream on demand, never hosted here. Needs a redistribution-cleared license. | ✅ |
| **Sealed** | ✅ | A content-free card. The ciphertext stays with you. | ✅ |

#### Keep a test set away from every outside AI service

Not uploading your text is one guarantee. Not *sending* it to a model API
while you evaluate is another, and it matters most for a test set that
contains sensitive wording. Mark the file local-only by putting a small file
next to it, named after it with `.champollion.json` added:

```bash
# data/nurse_checked_test.tsv  →  data/nurse_checked_test.tsv.champollion.json
echo '{"transmission": "local-only"}' > data/nurse_checked_test.tsv.champollion.json
```

This works for any corpus format (TSV, JSONL, plain-text pairs, JSON). From
then on, `mt-eval run` treats the corpus as sealed:
- with a remote provider (OpenRouter, OpenAI, Anthropic, Gemini) the run is
  **refused before any text is sent**, and before any API key is asked for;
- with `--provider local` pointed at a model on this machine (a loopback
  address such as `http://localhost:11434/v1`), the run proceeds;
- with `--method local-model -m <model>` (an NLLB, OPUS-MT or MADLAD model
  the harness loads in its own process; `-m` is required), the run proceeds:
  no sentence leaves the
  machine, and downloading the weights moves model files, never your text;
- with an MT engine or a method plugin (`--method <plugin dir>`), the run is
  refused unless you attest that its transport is fully local
  (`--attest-local-transport`, recorded in the run log): the harness cannot
  see where a plugin or a service sends text;
- the language's own evaluation metrics from its language card are **not
  loaded**. They come from separate packages that can look words up on an
  outside service, such as an online dictionary. The run is scored without
  them, and the run card says they were withheld and why;
- `mt-eval publish` withholds the sentences and, by default, replaces a
  coaching or custom prompt with its sha256, so prompt examples drawn from
  your own sentences stay on this machine too. Some metadata about the corpus
  does go public with the score: its id, version, language pair, size, the
  file's sha256, its licence and attribution, its contamination grade, that
  it is marked local-only, and its segment names. For an id that is not a
  registered dataset, publishing also creates a public `datasets` row with
  the same id, pair, size and sha256, plus its domain and segment names and
  difficulty range. The `--dry-run` preview lists these for your run, beside
  what stays here: every sentence, the file and its path. Others then see a
  score on a test set they cannot open. It is self-benchmarked, nobody else
  can re-run it, and the sha256 lets only someone who holds the same file
  confirm it is that file;
- what the tools print leaves the sentences out, because an AI agent reading
  the terminal passes what it reads to its model provider. `mt-eval compare`
  shows entry ids and scores instead of the sentences, and an error message
  that quotes one is printed with it removed. `--show-text` prints them, for
  a person at the terminal. Files written into your results folder keep the
  text, and each one carries the corpus's mark: every run log, report,
  comparison file and dashboard the harness writes from the corpus gets its
  own `.champollion.json` with the same terms plus `derived_from`. The next
  tool, or a later run on that file, then treats it as protected too. The
  terminal names each file that holds the text;
- the translation cache keeps this corpus's entries apart: under
  `<cache-dir>/protected/<namespace>/` (by default
  `eval/cache/harness/protected/…`), in a namespace keyed by the run's
  settings, the corpus's sha256 and its terms, so an entry is only ever
  served back to a run on this same corpus — never to a run on another or an
  unmarked one. Every cache file there carries the same `.champollion.json`
  mark. (Entries cached before this protection existed sit in the ordinary
  cache unmarked; delete `eval/cache/harness/` once to clear them.)

The mark can only make a corpus stricter. No license and no
`--allow-data-collection` flag can loosen it. If the marker file is
unreadable, the run stops rather than ignoring it.

**Sealed is the strongest guarantee the system offers.** Your corpus is
encrypted **on your device**, to the custodian group's key, and the ciphertext
stays on your machine or your evaluation node. Champollion receives only the
content-free card. On the offline node the key is split so that it takes
**M of N** custodians together to authorize a run; that ceremony is built but
has not yet been used with real custodians. Sealed sets are catalogued but quarantined, and are paired with
a public *qualifier* corpus that a method must clear before a sealed run can
even be proposed. See [Run a Sovereign
Contest](/docs/network/sovereignty/run-a-sovereign-contest) and the [Sovereign
Eval Node](/docs/network/sovereignty/sovereign-eval-node).

### 2b. License lanes — what the corpus may be used for

Separately, the license governs where results may appear.

#### Public

An openly licensed corpus (e.g. CC0, CC-BY) whose references may appear on public
surfaces and whose runs may rank on the public leaderboard. The content is still
fetch-from-source — "public" governs *exposure of references and rankings*, not
hosting. Most of the catalogue (Tatoeba, GlobalVoices, TICO-19, IN22, SMOL, ALT,
Turkic-x-WMT, WMT24++) is in this lane.

#### Non-commercial research-only

A corpus under a non-commercial license (e.g. CC BY-NC-SA, or a bespoke
community/NGO license such as the Gamayun kits' `LicenseRef-TWB-Gamayun`). It can
be **benchmarked against for research** — methods run on it, scores are computed —
but it is **carved out of every commercial, prize, and API path.** Eligibility is
**use-based**, not corpus-based:

- the **commercial lane is strict** — anything not clearly commercial-licensed is
  excluded;
- the **research lane is lenient** — non-commercial corpora are welcome;
- **quarantine always wins** — a corpus flagged as an improper subset (or
  otherwise barred) can never rank in *any* lane, regardless of license.

This is how a community can let its corpus drive research progress while keeping
it out of anyone's product.

#### Private

A corpus registered for **your own scored runs**, where the references are never
published. You hold the source; you run the evaluation; you decide what, if
anything, is ever shown. A private corpus can be made public or non-commercial
later — exposure only ever *loosens* by an explicit, owner-driven decision, never
silently.

| License lane | Benchmarkable | References shown publicly | May rank on public board | In commercial / prize / API path |
|------|:---:|:---:|:---:|:---:|
| **Public** | ✅ | ✅ | ✅ | ✅ (if license permits) |
| **Non-commercial research-only** | ✅ | depends on license | research lane only | ❌ |
| **Private** | ✅ (your runs) | ❌ | ❌ | ❌ |

:::note[The commercial lane is a guardrail, not a business]
Champollion itself is non-commercial — there is no paid API or product behind
any of this. The commercial/prize lane exists as a *forward* guardrail: it
records, mechanically, which corpora could ever lawfully appear in a prize or
commercial context, so that no future use — by anyone — can drift past a
license or a steward's terms.
:::

---

## 3. Sovereignty guarantees

Registration is designed around the [data stewardship position](/docs/network/sovereignty/data-sovereignty).
Concretely:

- **Possession stays with the source.** We hold a hash and a URL, not the data.
- **Control is the owner's.** The lane is the owner's choice, and exposure only
  loosens by an explicit decision. Pulling the upstream archive revokes runnability.
- **Non-commercial means non-commercial.** NC corpora are mechanically excluded
  from commercial, prize, and API lanes — not by promise, by gate.
- **Improper subsets can never rank.** Quarantine overrides license, so a corpus
  barred from ranking stays barred everywhere.
- **Attribution is mandatory.** The builder/linguist credit travels with the card
  to every surface the corpus appears on.

For how per-language terms are set — including method-ownership transfer for
sponsored prizes — see [Ownership & Terms](/docs/network/sovereignty/ownership-transfer).

---

## 4. How to register

The corpus card schema and the build/verify tooling are documented in the
[Corpus Design Framework](/docs/network/specifications/corpus-design) and the
[Corpus Creation cookbook](/docs/network/tutorials/corpus-creation). In short:

1. Host the corpus archive somewhere you control (it stays there — it is never
   copied into the Network).
2. Write a card: `url`, `sha256`, `license`, `language_pair`, `attribution`,
   `do_not_train`.
3. Choose the exposure lane (public / non-commercial / private).
4. Register the card. Methods can now be benchmarked against the corpus
   fetch-from-source, under the lane's rules.

You never upload the sentences. You can stop at any time.

### The card id

`champollion register-corpus` writes the card for you and gives it an id of
the form `eval-<source>-<target>-<name>[-<role>]-v1`:

- **name** comes from `--name`: "Ward phrases" becomes `ward-phrases`. The
  publisher is used only when the name has no a–z or 0–9 characters, for
  example a name written only in syllabics.
- **role** says what the set is for: `--role test`, `--role dev` or
  `--role train`. It appears in the id only when you pass it. The tool never
  guesses a role, so a held-out test set is called a test set only if you
  say so.

```bash
champollion register-corpus --yes --name "Ward phrases" --pair "eng>xyz" \
  --license proprietary --tier private --role test --size 120 --domain medical
```

This registers `eval-eng-xyz-ward-phrases-test-v1`. To choose the id
yourself, pass `--id eval-…`; it is used exactly as given.

### Which licence id for a private test set

`--license` records the terms the people who own the data actually grant. It
is not a placeholder, and the tool does not choose one for you. Ask them
first (the families, the clinicians, the community's data steward), then pick
the id that says what they said:

| What the owners grant | `--license` |
|---|---|
| They already publish the text under a standard licence | its SPDX id, for example `CC-BY-NC-4.0` |
| Use it only to score systems: never train on it, never redistribute it, no paid scoring | `community-eval-grant-nc` (`LicenseRef-Champollion-Eval-Grant-NC`) |
| The same, but scoring for paying users is allowed | `community-eval-grant` (`LicenseRef-Champollion-Eval-Grant`) |
| No grant beyond their own use: all rights reserved | `proprietary` (`LicenseRef-Proprietary`) |
| Terms of their own that none of these says | `LicenseRef-<a name for their terms>`, typed as is, with the terms written down where the steward keeps them |

Every `LicenseRef-…` id in the table (the two evaluation grants and
`proprietary` included) is a bespoke grant: Champollion never reads it on
the owners' behalf. Remote evaluation against it is refused until the steward
records their permission, so only models on your own machine are tested
against it. If you are unsure, the most conservative choice that still lets
you measure is `community-eval-grant-nc`; write it down as provisional and
have the steward confirm it or name the right one.

The licence does not change where the sentences go. A local-only set (the
`.champollion.json` marker, or `--tier local-only`) stays on your machine
whatever its licence says: the marker refuses every remote model, and a
licence can never loosen it. The licence governs what others may do with
the set if it is ever shared, and which evaluation lanes it may enter. Once a file has
been registered with `--data`, its id is recorded in the
`.champollion.json` file next to it and never changes. Registering that file
again stops and asks you to pass the id with `--id`.

For a test set a model may be trained against (`--role test`, or a
local-only or private set with no role), the command then prints the
nmt-forge steps that must come before the set's first score: register it,
screen your training corpus against it, and write down your predictions.
The baseline `mt-eval run` comes after them. A benchmark is a scoring read,
and nmt-forge refuses predictions written after one.

`mt-eval run --corpus <that file>` finds the card through the same
`.champollion.json` file. The run's dataset id is the card's id, so every run
on the set carries the same name, and the file name stays on the run as its
corpus path. The card's contamination grade is reported as the card states
it. Both apply only while the file is the one you registered: if it has
changed since, the run says so and uses neither.

A `local-only`, `private` or `sealed` card says its text is unpublished
(`Contamination: NONE`), so registration first compares the file you pass
with `--data` (or `--seal-input`) with the public corpora. A repository
checkout compares it with the corpora cards it holds. An npm install, which
ships no corpora cards, compares it with the public corpus catalogue: the CLI
downloads the public corpora's ids and checksums and compares them on your
machine, so your file's checksum never leaves it. When the file is byte for
byte a public corpus (same sha256), registration stops and names that corpus.
Register it as public, use sentences that are genuinely private, or keep the
tier and state the exposure with `--contamination` (the card then records
that the text is public). A sealed set of public text is refused: it would
test nothing.

When no comparison can be made (you are offline, or the catalogue cannot be
reached), the card is graded `Contamination: UNCHECKED`, not `NONE`, unless
you state a grade yourself with `--contamination`. Re-register online to
compare it. `mt-eval` treats an `UNCHECKED` corpus like any corpus that is
not graded `LOW`: its scores go in the relative-comparison-only lane. The
check compares whole files, so a public set that was edited or reformatted is
not recognised; `mt-eval contest prepare` compares rows.
