# Building a translator for your language: a guide for communities

*For a teacher or language-program lead deciding whether to build a
translator with forge. The agent follows the
[agent's playbook](AGENT_PLAYBOOK_DEPLOYABLE_TRANSLATOR.md); every number is
sourced in the [evidence appendix](EVIDENCE_DEPLOYABLE_TRANSLATOR.md). The agent
quotes this page and never paraphrases its cautions. Draft, 2026-10-14.*

**Words used here.** *The authority*: the body that can say yes for the
language community. *The language team*: the people doing the work. *A pair*:
an English sentence and its translation. *Meaning-right*: a fluent speaker says
the translation means what the English means.

## Step 0. Who may say yes

- **A teacher, a department or a school cannot authorise use of a language for
  its community.** Name the authority: a Nation's council, a language
  authority, an Elders' committee, or a school board acting with them. Get its
  decision in writing, with who on the team may decide what.
- **Two layers of consent for every item:** the speaker or their family, and
  the authority. Consent given for documentation does not cover machine
  learning; ask again. For a speaker who has passed on, the family normally
  decides.
- **Other approvals:** research-ethics approval for a university team (in
  Canada, TCPS 2, chapter 9); the board's approval for a school, and guardians'
  consent for anything students contribute.
- **Decide with the authority, early:** which dialects and spellings; who keeps
  the master copy (backups the community controls, a successor when someone
  leaves); who owns any model, and whether it may ever leave the community.
- **Withdrawal:** the model is retrained without the withdrawn files and old
  copies are deleted. forge keeps each model's list of source files for this.
- **The agent records these decisions and reminds you of them. It never makes
  them, and it starts no training until they are written down.**

## Step 1. Is a translator the right tool?

| What you need | Often the better tool | Speaker time | Risk if wrong |
|---|---|---|---|
| Learners practising word forms | A conjugator built on a word analyser, if one exists | Small | Low |
| Looking up and hearing words | A talking dictionary | Moderate | Low |
| Fixed classroom or public phrases | A phrasebook, every item reviewed by a speaker | Small | None once reviewed |
| Drafts a fluent speaker will correct | A translator, "useful draft" level | Hundreds of hours | Moderate |
| Translation read by people who cannot check it | A translator, "working" level | Unknown; may not be reachable | High |

Ask who will read the output, whether they can tell when it is wrong, and who
checks it first. Fluent speakers' time shrinks year by year, so recordings and a
dictionary often come before any model. **Learners never see unreviewed machine output**, only a bank a
speaker has checked. **Health information is not a use for this translator:**
use human translation and a qualified interpreter.

## Step 2. What you hold, and what you may use

Keep one inventory row per item (recordings, transcripts, interlinear texts,
dictionaries, worksheets, learners' work) with: what it is, its dialect,
speakers, date and spelling; who holds the master copy; who holds rights, layer
by layer (publisher, speaker or family, community protocol, archive access
level, Traditional Knowledge label); what consent covered when it was made;
and what it is **cleared for** (nothing, internal use, training, release), by
whom and when.

**Published is not permitted.** Classic text collections often hold sacred or
ceremonial narratives, recorded under consent that never foresaw machine
learning. Nothing goes in until a reviewer the authority appoints classes it as
open, community-only or excluded; anything not yet classed is excluded. Sacred
and ceremonial material stays out unless the authority itself clears it, and
then only on your own computer. **The agent never fetches language text from
the web or an archive on its own.** Religious translations are your call either
way.

## Step 3. Caring for speakers

- **Every plan shows hours and money,** at a rate the community sets, and who
  pays. The agent plans no collection without that line.
- **Short sessions; the speaker sets the pace;** any prompt may be skipped
  without a reason. Ask about local protocol and follow it.
- **Count everyone's time.** When an elder dictates to someone who writes, two
  people's hours go into each sentence. Ask how many fluent speakers can read
  and type the language.
- **Spread the load:** the same elder does not write the training sentences,
  the test sentences *and* judge the results.
- **Give back along the way:** copies of their recordings and sentences to
  speakers, credit by name if they wish, and early results for the school (a
  cleaned word list, a cleared text set to teach from).

## Step 4. What a working translator takes

- **Time:** plan 24 to 30 hours per 1,000 short pairs (about 6 English words
  each) at a professional translator's pace; a community speaker may be slower.
  Time the first session and re-plan. One speaker giving 2 hours a week adds
  about 70 to 80 short pairs a week.
- **On Klingon,** a constructed language easier than yours (regular grammar,
  Latin letters, one main writer, short sentences), about 1 short everyday
  sentence in 5 came out exactly right at 6,400 pairs and 1 in 4 at 12,800.
  **Expect lower for your language.**
- **No published system for a language like yours, and no forge run on a real
  language, has been shown to get 8 in 10 sentences meaning-right.**
- **A yardstick first:** practice and test sentences written fresh by speakers
  and kept on your computer; at milestones, fluent speakers judge 100 to 200 new
  sentences without knowing which model wrote them.
- **Reading a result:** with 100 sentences, 80 judged right means the true rate
  is probably between about 7 and 9 in 10.
- **The bar is yours.** forge offers two defaults: "useful draft" (at least half
  meaning-right; a speaker corrects the rest) and "working" (8 in 10, counted
  on the cautious end of that range).

## Step 5. What forge will and will not promise

**forge will** keep your test set on your computer; send no file to a rented
computer without a typed yes for that file; never let a general-purpose AI
model write your language; show every score with its uncertainty; say plainly
and early when your time cannot reach your bar; and check whether a model that
lists your language can actually translate it (one that listed Klingon got 0
of 1,000 sentences right).

**forge will not promise** that any number of pairs reaches 8 in 10, that a
score means the output is usable, that results from other languages apply to
yours, or legal advice about licences.
