---
title: The guardrails
slug: /guardrails
description: "The mistakes that quietly ruin translation projects, and what the rails do about each one — in plain words."
---

# The guardrails, one by one

Most translation projects don't fail loudly. They fail quietly. Words shared
in trust end up somewhere they shouldn't. A translator looks wonderful —
because it's being tested on sentences it already memorized. A lucky round
looks like progress.

Each guardrail below stops one of these. The tools enforce most of them on
their own; a few depend on you and your assistant, and each one says so.

A word you'll see below: a **score** is a number for how close a translator's
sentences come to the way a speaker said them. A higher score means closer.

## 1. Your words leaving home

**What goes wrong.** Words shared in trust end up on someone else's computer,
or inside someone else's AI.

**What the rails do.** Each file gets a note, kept right beside it, saying what
the people it belongs to decided: may it ever leave this computer, and may a
translator learn from it. Every tool obeys the note.

- Files start out private, until the people they belong to answer.
- Once they answer, the tools can make the rules stricter, never looser. Only
  a person can loosen them, on purpose, by hand. If someone who hadn't been
  asked later says yes, that yes is added.
- Nobody's words are used to teach a translator until the people say those
  speakers agreed. Words from speakers who haven't agreed yet, or who said
  no, are left out.
- A translator that learned from private sentences is treated as private too,
  because it can repeat what it learned.
- For files kept on this computer, the tools show your AI assistant counts,
  not sentences.

**What depends on you.** Most AI assistants run on a company's computers and
send whatever they read to that company. If you ask one to open your files, it
can — no tool can stop that. For words you want kept private, use an assistant
that runs on your own computer, or don't ask it to open them. And the tools
can't tell who answered a question, so the people the words belong to should
answer for themselves. [Your words, your rules](/docs/your-words-your-rules) has the full
picture.

## 2. The test that's secretly the homework

**What goes wrong.** You test a translator on sentences it learned from. It
remembers them and looks brilliant — then stumbles on anything new. It's like
grading a student on the exact questions from last night's homework.

**What the rails do.** Before any teaching, you set aside test sentences that
a fluent speaker checked. They're marked so no translator ever learns from
them, and the tools leave them out of what they print unless a person asks to
see them.

## 3. Near-copies

**What goes wrong.** The exact test sentence isn't among the sentences the
translator learned from — but one almost like it is. *"We are going to the
store"* is tested, and *"We are going to the store now"* was learned. The
translator gets credit for memory, not for translating.

**What the rails do.** Before teaching starts, every sentence the translator
would learn from is checked against the test sentences. Copies and
near-copies are set aside. Sentences that only share a pattern are kept but
counted, so you can see how much they might make the score look better than
it is.

## 4. Peeking at the answers

**What goes wrong.** Check your translator against the test sentences after
every small change, and you slowly tune it to those sentences. The test stops
telling you anything new.

**What the rails do.** Day-to-day progress is judged on a separate set of
**practice sentences**, set aside from your data. Every time the training
tools score the test sentences, it's written down, and they won't show a test
score until a prediction has been written.

## 5. Deciding what you expected after you see the result

**What goes wrong.** Once a result is on the screen, it's easy to say *"that's
about what we thought."* Then the result can't surprise you, and it can't
teach you anything.

**What the rails do.** Before the first translator is taught, the people
building it write down what they expect, in their own words. The rails don't
move on until it's written, and later the result is checked against it.

## 6. Mistaking luck for progress

**What goes wrong.** Two translators can score a little differently just by
chance, especially on a small number of sentences. A lucky round looks like
progress, and a real gain can hide in the noise.

**What the rails do.** A new translator is compared with the one you're
using, sentence by sentence, on the same practice sentences. It's offered to
you only if it scores higher by more than luck would usually explain — and
even then, it takes over only when you say yes. Otherwise
the tools say *"no measurable change"* — and how small a gain is too small to
see with that many practice sentences. With fewer than 50 practice sentences,
no score can tell, so the tools don't decide at all: the speaker's marks, on
drafts from both without knowing which is which, decide instead.

## 7. Is it better than a dictionary?

**What goes wrong.** A score on its own means very little. A translator might
do no better than looking each word up in a word list.

**What the rails do.** If you have a word list, the tools first measure how
far looking each word up gets you. A translator is worth using only where it
beats that.

## 8. Two translators hiding in one score

**What goes wrong.** When a translator can't handle a sentence, a second,
backup translator can step in. That's fine when you're using it. But if a test score mixes the two,
you can't tell which one you measured.

**What the rails do.** A test score always comes from one translator. A backup
is allowed when you use the translator, never when you measure it.

## 9. Saying more than is true

**What goes wrong.** An eager assistant announces *"your translator is
ready!"* when it has barely been taught.

**What the rails do.** The tools keep a record of what really happened. Your
assistant is told to report only that, and to pass on every warning word for
word. This one depends on the assistant keeping its instructions.

---

None of this makes a translator good. It makes sure you always know where it
stands — and that the people whose language it is stay in charge.

**Next:** [What it can't do yet →](/docs/what-it-cant-do-yet)

## Go deeper

- [The operating contract for AI agents](/docs/agents/contract) — each rule,
  and whether the tools enforce it or only the assistant can keep it.
- [Every command, step by step](/docs/agents/shell) — where each
  check runs, with the exact commands.
- What "more than luck" means here: the new translator's chrF++ on the
  practice (dev) set must be higher in a paired test and its interval must
  stay above zero. The practice set also picked the new translator's best
  checkpoint, which slightly favours the new one.
- [Data stewardship](/docs/your-words-your-rules) — how data
  is used without being handed over.
