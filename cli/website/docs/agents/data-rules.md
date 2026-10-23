---
title: Data and transmission rules
slug: /agents/data-rules
description: "The rules every Champollion tool applies to the people's data: the set/1 sidecar field by field, local-only and its provisional default, training not-allowed, speakers and holders who agreed, what each tool prints and never prints, the four transmission modes, the registration tiers, and model outputs as derivatives."
---

# Data and transmission rules

The people who hold language data decide how it is used. The rails write their
decisions beside each file, and every tool obeys what is written — with
community ownership and control of language data as the design rule, not a
setting. This page is the rule set, exactly: what each field does, what the
tools refuse, and the parts only you can keep.

## The sidecar (set/1)

Beside any data file, `<file>.champollion.json`, `$schema`
`https://champollion.dev/schemas/set/1.json`. Unknown keys are refused; notes
go under `x-`. A sidecar written before set/1 (no `$schema`) is read as set/0
and stays valid (`champollion upgrade` rewrites it).

| Field | Values | Effect |
|---|---|---|
| `transmission` | `local-only` (the only value) | Only a model on this computer may see the text; every tool refuses to send it anywhere (`mt-eval project offer` included) |
| `role` | `train` · `dev` · `test` · `sealed` · `input` · `resource` | What the file is for. `test` and `sealed` are never trained on |
| `kind` | `parallel` · `monolingual` · `lexicon` · `grammar` · `glossary` | What it holds |
| `pair` | `{source, target}` | The direction its columns run, in the cards' codes |
| `fields` | `{source, target}` | Which column or JSON field holds which side |
| `terms.training` | `allowed` · `not-allowed` | `not-allowed`: no model may be trained on it |
| `terms.owner` | text | Who holds it, in the holder's words |
| `terms.speakers` | text | Whose words it holds, in the holder's words |
| `terms.speakers_agreed` | `yes` · `not-yet` · `some-said-no` | Whether the people whose words these are agreed |
| `terms.consent_record` | path | The consent note, relative to the file's folder |
| `holders_agreed` | `{by, date}` | Who among the holders agreed that a local-only output may sit where it is (loosens nothing) |
| `derived_from` | path | The protected file this one was made from; its marks were carried here |
| `id`, `name`, `license`, `tier`, `segment`, `sha256`, `rows`, `card`, `registeredAt` | | Written by `champollion network register-corpus`; a changed file (another sha256) no longer gets the card's id |
| `written_by` | text | The command that wrote it |

**Lock.** A sidecar only makes a file stricter: it never loosens what a corpus
envelope or a registry entry says.

## Local-only, and the provisional default

`champollion data add` marks the file it writes local-only when the project's
`defaults.transmission` is `local-only` (what `champollion new` writes), and
always for `--into test`. That mark is the tool's protection until the holders
answer, flagged `"x-transmission-default": true`.

- The holders' first answer decides. `champollion data mark <file>
  --may-leave` lifts a provisional mark; `--local-only` makes it theirs (the
  flag is removed).
- **Note.** The tool cannot tell who ran the command. Lift a provisional mark
  only with the holders' own answer.
- **Lock.** A local-only mark the holders made cannot be lifted by any
  command: *"this file is marked local-only, and a sidecar only ever gets
  stricter. Whether it may leave this computer is its holders' decision — if
  they agree, edit the sidecar by hand."*
- **Lock.** `data mark` on a file not yet local-only needs `--local-only` or
  `--may-leave`: *"whether this file's text may ever be sent to an outside AI
  service is its holders' decision, so it is never assumed"*.

What local-only means in each tool:

| Where | What happens |
|---|---|
| Any evaluation (`mt-eval run`, forge scoring) | The policy resolves to `sealed` (tier `local-only`): only a loopback endpoint, the harness's own in-process adapter (`local-model`), or an external method run with `--attest-local-transport` may see the text |
| Terminal and `--json` output | Its sentences are withheld; line numbers, ids, counts and scores are printed instead, with one line saying why |
| Files carved from it | Splits, cleaned copies, hypotheses and run logs keep the text (they are in the person's folders) and carry the mark in a sidecar of their own |
| A model trained on it | Its output is local-only too (`forge-model.json` `trained_on.terms`; unrecorded counts as local-only): `try_translation` returns only the model's page, `champollion connect`, `mt-eval serve` off loopback and `mt-eval translate` outside the project need `--holders-agreed-by`, and `sync` holds back its answers, through the `api` and the `local` method alike ([serving](/docs/agents/serving)) |
| A coaching file or dictionary | A coaching file with a sidecar carries its policy to the prompt; a lexicon run's outputs are withheld when its dictionary is local-only |

**Note.** `--attest-local-transport` declares a method's endpoint local. Pass
it only when you have verified the endpoint is on this machine: a loopback
address can be a proxy that forwards anywhere.

## Training

- **Lock.** nmt-forge refuses to train on a file whose sidecar says
  `terms.training: not-allowed`; an unreadable sidecar counts as a
  restriction, never as none.
- **Lock.** `champollion data combine` never joins a not-allowed file: it moves
  it, with its sidecar, to `data/not-for-training/`. It refuses a file whose
  holders have not answered yet — no `terms.training`, or no
  `terms.speakers_agreed` (*"nobody has said yet whether everyone whose words
  are in it agreed — champollion next asks the people; combine afterwards"*) —
  and the joined file carries the strictest of the files' terms (local-only if
  one is, not-allowed if one is, every owner named).
- **Lock.** The journey's terms step counts a file in `data/parallel/`,
  `data/lexicon/`, `data/grammar/` or `data/monolingual/` as answered only when
  its sidecar has both `terms.training` and `terms.speakers_agreed` (and the
  training answer is the holders', not the tool's caution below); until then
  it asks again, and the rails go no further.
- **Note.** nmt-forge reads `terms.training`, not `speakers_agreed`. With one
  pair file there is no combine, so only the terms step waits for that
  answer: never train a file whose speakers' answer is missing.
- **Lock.** A `test` or `sealed` file is never trained on: `--training
  allowed` is refused for it, and giving it another role is refused.
- **Lock.** `not-allowed` cannot become `allowed` by command (*"If its holders
  agree to training, edit the sidecar by hand"*) — with one exception below.
- Scripture (USFM) comes in with `terms.training: not-allowed` marked as the
  tool's caution (`"x-training-default": true`); the holders' answer replaces
  it.

## Whose words, and who agreed

`--speakers` records whose words the file holds; `--speakers-agreed` whether
they agreed.

| `speakers_agreed` | Effect |
|---|---|
| `yes` | Training as the holders said |
| `not-yet` | Training is forced to `not-allowed` until they all agree; the file appears in `waiting_for_agreement` |
| `some-said-no` | No model may learn from the file, ever: *"take their words out into another file, and mark the rest"* |
| (no answer) | The terms step keeps asking, and `data combine` refuses the file (above) |

**The one loosening a command makes:** `not-yet` → `yes` together with
`--training allowed`. A file `combine` had set aside then returns to
`data/parallel/` for the next combine.

**Note.** Ask the `waiting_for_agreement` question once a session, gently, and
answer it only with the person's yes that everyone agreed.

**`--holders-agreed-by "<who>"`** names a person among the data's holders who
agreed that a local-only output may go somewhere specific: into an app's locale
files (`champollion connect`, recorded as the pair's `holdersAgreed`), onto
an address other machines reach (`mt-eval serve`, `nmt-forge serve`, reported
on `/health`), or into a file outside the project (`mt-eval translate`,
recorded as the sidecar's `holders_agreed`). It loosens nothing else: the
output stays local-only for every tool. **Note.** Pass only the name the person
gave you.

## What tools print, and never print

| Tool | Prints | Never prints |
|---|---|---|
| `champollion data add` | Counts, columns (letter, fill rate, mean length, share of Latin letters), a header cell only when it names one of the pair's languages, ELAN tiers by number, and the row numbers its row check names | A sentence; any other header cell (its length instead); an ELAN tier's id |
| `champollion data mark`, `combine`, `next`, `validate` | Fields, counts, states | A data file's text — they never open it |
| `champollion improve …` | Counts and percentages | The sheets' sentences |
| `champollion sync` (the `local` and `api` methods) | The keys whose text holds words a forge model never saw in training, from the server's `meta.unseen_words` | The text, or the words themselves |
| `nmt-forge`, `mt-eval` | For a local-only, sealed or consent-required corpus: ids, line numbers, counts, scores; `[sentence withheld]` inside error messages | Its sentences, in human or `--json` output |
| MCP rails tools | What the CLI prints, trimmed | Sentences; the output of a local-only model |

**Note.** `--show-text` (nmt-forge; `mt-eval compare`) prints withheld
sentences. It is for a person at their own terminal, never for an agent —
what you read goes to your model provider.

**Note.** No tool can stop you from opening a file. Never open, print,
summarize or paste the people's data files, test sentences, word lists or
sheets — nor an export's `input-words.json`: it lists the words of their
training sentences, and stays beside the model folder, never in it
([serving](/docs/agents/serving#what-an-export-holds)).

**The row check.** As it brings a file in (pairs, a test set or a word list),
`data add` checks its rows against the file's own two columns — no
dictionary, nothing removed. It counts, and names by row number:

- copies: the translation is the source sentence again (a name or a loanword
  is fine; otherwise the translation is missing);
- repeats of an earlier pair;
- translations far longer or shorter than the file's usual ratio (cut off,
  or two sentences in one cell);
- rows that look swapped: the source reads like the file's translations, and
  the other way round;
- runs of rows that look one row off: their translations fit the next or
  previous row better — numbers, question marks and lengths line up one row
  away, and so do the words: how well a row's source words find matches
  among a translation's words, by how often the two occur together in the
  rest of the same file (rarer words weigh more; the row itself left out).
  This finds a shift in a file of templated sentences, whose lengths all look
  alike; it adds nothing when the file's words say too little.

It prints up to 12 row numbers a kind (up to 6 runs for rows one off) — for a
spreadsheet, the row in the person's own file, header counted — and records
the counts in the sidecar's `x-import.quality`. Length, swap and shift checks
need at least 20 pairs; a word list (`--into lexicon`) gets only copies and
repeats. **Note.** Pass the row numbers on: the people look at those rows in
their own file and decide. Never open the file to look yourself.

**ELAN files.** When `data add` cannot tell which tier is which (a side named
by no flag, with not exactly one tier recorded in its language), it refuses
and lists the tiers by number, in the file's order: `tier <n> (<language or
"no language">, <count> annotation(s))`, with `, under tier <m>` for a tier
that refers to another. Pass the numbers as `--source-col` and `--target-col`
(`champollion data add <file> --source-col <number> --target-col <number>`);
the sidecar records the numbers (`x-import.elan_tiers`). A number or id that
names no tier is refused (`no such tier — … Name a tier by its number`), and
so is a tier whose recorded language is not that side's. Two tiers are paired
only when one refers to the other or they share time slots — never by
guesswork. **Note.** A tier's id is whatever the file's maker typed and is
often a person's name, so `data add` never prints it. The person may type an
exact id themselves; you pass the number.
LIFT files are matched by their language codes, Toolbox files by their MDF
markers (`\ge` and `\xe` are English by the standard).

## Transmission modes

Every evaluation resolves its corpus to one mode before anything is sent
(`arena/mt_eval_harness/transmission_policy.py`), and records it in the run
log:

| Mode | When | Remote models |
|---|---|---|
| `cleared` | A licence cleared for redistribution | Allowed |
| `no-train` | A standard Creative Commons non-commercial or no-derivatives licence; or an unregistered corpus that declares no licence | Only over channels that do not train on inputs: OpenRouter pinned to `data_collection: deny`, first-party vendor APIs, or local. A no-training guarantee, not a no-retention one |
| `consent-required` | A modified, bespoke or unstated licence (`LicenseRef-*`) | Refused until the dataset's entry records a `transmission_consent` grant (`granted_by`, `date`, `scope`, `evidence`); local still works |
| `sealed` | A held-out or gold-standard segment, a quarantined set, or a steward's local-only mark | Refused, with no override |

- **Lock.** Text of a `consent-required` or `sealed` corpus is withheld from
  the terminal too.
- An external method (a plugin) on a `no-train` corpus is warned about, not
  refused: the harness cannot see the plugin's channel. On `consent-required`
  and `sealed` corpora it is refused unless `--attest-local-transport`.
- **Lock.** The local provider counts as local only when its endpoint is a
  loopback address (`localhost`, `127.0.0.1`, `::1`, a unix socket) — never
  because of its name.
- **Note.** Never record a `transmission_consent` grant, and never interpret a
  licence on the rights-holder's behalf. A grant is recorded by the dataset's
  steward once the rights-holder gives it.
- **Note.** `--allow-data-collection` lifts the no-train pin only for an
  unregistered corpus that declares no licence; it asserts the caller holds
  the rights. Pass it only when the person says they hold them.

## Registration tiers

Registering a corpus is optional: the rails never need it. It writes a
metadata card so the corpus can be named, compared and, if its holders choose,
listed. `champollion network register-corpus` is interactive at a terminal
and scriptable with flags (`--tier`, `--data`, `--license`, `--name`, …).
**Note.** The tier, like every term, is the holders' decision.

| Tier | The card | The text | What it refuses |
|---|---|---|---|
| `local-only` (default) | Written beside the `--data` file (or `--out`, or here), never into the shared card folder | Never leaves this computer; the sidecar gets `transmission: local-only` | — |
| `private` | Metadata with `quarantine: true`; from an npm install it stays local, and listing it is a separate request (`champollion network submit --type dataset`) | Never uploaded; no transmission mark — its licence decides the mode | — |
| `public` | Metadata plus a fetch-from-source pointer (`--repo-url`, `--builder`) | Never hosted: fetched from its source | A non-commercial, no-derivatives, restricted or unconfirmed licence (*"Register privately or local-only instead."*); `--data` |
| `sealed` | Metadata with `quarantine: true` and a sealed block (`--seal-input`, `--threshold-pubkey`, `--custodian-group`, `--qualifier-id`) | Only ciphertext exists, written to `<id>.sealed.json` or `--seal-out` | A file that is a byte copy of a public corpus; `--data` |

In every tier nothing is uploaded at registration (`--json` says
`uploadedContent: false`). The one network call, from an npm install, compares
the file's sha256 with the public catalogue's on this computer (the hash never
leaves); with `CHAMPOLLION_OFFLINE=1` the card says the comparison was not
made. With `--data`, the sidecar records `id`, `name`, `license`, `tier`,
`sha256`, `rows`, `card` and `registeredAt`. **Lock.** A registered id is
never re-derived: registering the file again under another id is refused, and
a changed file (another sha256) no longer gets the card's id or grade.

## Outputs are derivatives

A model's output over restricted sentences is a derivative of them, and an
evaluation makes such outputs at scale. The tools treat outputs the way they
treat their inputs:

- For every corpus that is not `cleared`, the run records and prints a notice:
  its predictions are machine derivatives of restricted sentences, not to be
  distributed.
- Where the text is withheld (local-only, sealed, consent-required), every
  file made from it — run logs, reports, comparisons, cache entries,
  `mt-eval translate` output, forge's split sides, cleaned corpora and
  hypotheses — gets a set/1 sidecar carrying the mark (`derived_from`,
  `written_by`). A `no-train` corpus gets the notice but no sidecar.
- A model trained on local-only text writes local-only output (above).
- `mt-eval publish` never uploads a local-only corpus's sentences, even with
  `--publish-entries`, and publishes a coached prompt only as its hash by
  default for such a corpus. For other corpora the prompt is published unless
  `--redact-coaching`.

**Note.** Publishing is the people's decision, made in their words, with the
preview (`--dry-run`) shown to them first. Never publish, paste or send a run's
outputs on their behalf.

## Go deeper

- [The operating contract](/docs/agents/contract) §1 and §3.
- [Your words, your rules](/docs/your-words-your-rules) — the people's version.
- [Registering corpora](/docs/network/sovereignty/registering-corpora) — the
  tiers, with every flag.
- [Serving and deployment](/docs/agents/serving) — local-only output in
  practice.
- [Data sovereignty, in plain words](/docs/learn/data-sovereignty).
