---
title: How a tokenizer decides which languages are cheap
sidebar_label: Tokenizers
description: "Before a language model reads a word, something chops it into pieces. That step is learned from data, optimises compression rather than meaning, and quietly decides which languages are expensive to use. A primer for readers starting from zero."
---

# How a tokenizer decides which languages are cheap

:::info[Who this is for]
Anyone. This page assumes no machine-learning background and no linguistics
background. If you know what a language model is — software that takes text and
produces text — that is enough.
:::

Every language model has an invisible first step. Before it reads a word, a
piece of software cuts that word into fragments. The fragments are what the
model actually sees.

That step is called **tokenization**, and almost nobody looks at it. It is worth
looking at, because it is the point where some languages become several times
more expensive to use than others — and the decision is made before anyone
thinks about quality, fairness, or coverage at all.

---

## 1. A model cannot read

A neural network does arithmetic on numbers. It has no notion of letters or
words. So text has to become numbers first.

A **tokenizer** is the piece of software that does that conversion, and reverses
it at the end. It turns a string into a list of integers, each integer pointing
at a row in a big lookup table.

It makes two decisions:

**The vocabulary** — the fixed inventory of pieces the model is allowed to see.
Not words: *pieces*. Common ones are whole words, but rarer material gets broken
down. The inventory has a fixed size, chosen in advance — often tens of
thousands of entries.

**The segmentation** — for any actual string, which pieces, in what order. The
word *unbelievable* might become `un` + `believ` + `able`, or a single piece, or
eleven single letters. Which one you get depends entirely on what is in the
vocabulary.

> **Worked example.** If `believ` is in the vocabulary, *unbelievable* costs
> three pieces. If it is not, the tokenizer falls back to smaller and smaller
> fragments until it can cover the word — possibly one piece per letter. Same
> word, same meaning, three times the pieces or eleven times the pieces,
> depending on a decision made long before you typed it.

---

## 2. The vocabulary is *learned*, and it optimises the wrong thing

Here is the part that surprises people.

The vocabulary is not designed by a linguist. It is **learned from a pile of
text**, by an algorithm whose goal is **compression** — cover this text in as
few pieces as possible.

Meaning plays no part. The algorithm has no idea what a word is, what a prefix
is, or that a language exists. It counts what occurs together often, and gives
frequent sequences their own entry because that makes the text shorter.

The consequence follows mechanically. Pieces get allocated to a language roughly
in proportion to **how much of that language was in the pile**. A language that
made up a large share gets many dedicated pieces, and its words come out whole
or nearly whole. A language that made up almost none gets almost no pieces of
its own, and its words get covered by whatever generic fragments happen to fit.

A language that was not in the pile at all gets **zero** dedicated pieces. It
still works — the tokenizer will always find *some* way to represent the text,
because it can fall back to individual characters or raw bytes. It just costs a
great deal more to say anything.

:::note[This is not a bug]
Nothing has malfunctioned. The compression algorithm did exactly what it was
asked. The problem is that "make the training text short" was accepted as a
proxy for "represent language well", and for languages absent from that text the
proxy fails completely.
:::

---

## 3. Fertility: the number that names the damage

**Fertility** is the average number of tokens a word costs.

For a language the tokenizer was trained on heavily, fertility is close to 1 —
most words are a single piece. For a language it never saw, the same measure can
be many times higher, because every word has to be assembled from fragments.

That single number cascades into four separate taxes:

| Tax | What it means |
|---|---|
| **Cost** | Most commercial models bill per token. More tokens per word means the same sentence costs more money to translate, summarise, or generate. |
| **Context** | Models have a fixed window. High fertility means less of your actual document fits. |
| **Compute** | Longer sequences are slower, everywhere, forever. |
| **Learning** | The hardest one. Meaning is now smeared across many low-information fragments, so the model has a harder problem to solve — even with identical data. |

The first three are unfair. The fourth is the one that damages quality.

**This is measured, not asserted.** Petrov, La Malfa, Torr and Bibi found that
the same text, translated into different languages, can differ in tokenized
length by **up to 15 times**, and that the disparity persists in tokenizers
built deliberately for multilingual use.

Their finding that complicates the obvious fix: character-level and byte-level
models — the intuitive answer, "just use letters, then every language is equal" —
still showed **over 4 times** the difference for some language pairs. Falling
back to smaller units narrows the gap. It does not close it.

> Aleksandar Petrov, Emanuele La Malfa, Philip Torr, Adel Bibi.
> *Language Model Tokenizers Introduce Unfairness Between Languages.*
> [NeurIPS 2023](https://proceedings.neurips.cc/paper_files/paper/2023/hash/74bb24dca8334adce292883b4b651eda-Abstract-Conference.html).

---

## 4. Why this hits some languages structurally, not just statistically

Under-representation in the training pile is one cause. There is a second, and
it does not go away by adding data.

Languages differ in how much work a single word does.

In English, a sentence is mostly separate words in a row: *I saw them*. Three
words, three concepts, whitespace between them. Tokenizers were built by people
working on languages that behave this way, and they assume it — most of them
literally treat a space as a piece boundary.

Other languages build a whole clause into **one word**, by stacking meaningful
parts together. Linguists call these **polysynthetic** languages, and they are
common among Indigenous languages of the Americas, and elsewhere.

> **Worked example.** In Plains Cree (nêhiyawêwin), *nikî-wâpamâwak* means
> roughly "I saw them". It is one word. Inside it are several meaningful parts:
> who is acting, that the action is in the past, the seeing itself, and who is
> being seen.
>
> An English speaker gets four words for that, and a tokenizer trained on
> English will likely spend four pieces. A tokenizer that has never seen Cree
> has no entry for any of those parts, so it shreds the single word into
> fragments that respect none of the boundaries that carry the meaning.

Two things are broken at once. The word costs far more pieces than it should —
and the pieces **cut across the units of meaning**, so the model has to
reassemble a structure the tokenizer just destroyed.

Adding more Cree text to the training pile improves the first problem. It only
partly helps the second, because the algorithm is still optimising compression,
and compression does not know that a boundary is meaningful.

---

## 5. From tokenization to a wrong answer

The chain from "bad segmentation" to "wrong output" is short.

1. The tokenizer breaks a word at boundaries that carry no meaning.
2. The model learns weaker associations, because the same concept appears under
   many different fragment spellings instead of one consistent piece.
3. When generating, the model assembles output fragment by fragment.
4. Fragments that are individually plausible can combine into a word that **does
   not exist** in the language.

That last step is the one to hold onto. In a language where words are built from
parts, a model can produce something that looks well-formed to anyone who does
not speak it — correct-looking pieces, assembled into a word no speaker would
ever say.

Standard automatic scoring often will not catch it, because those scores mostly
measure overlap with a reference answer, and a wrong word made of right-looking
fragments can still overlap.

:::danger[Why this matters beyond quality scores]
An output that is fluent and wrong is more dangerous than one that is obviously
broken. A reader who does not speak the language has no way to tell. This is a
large part of why Champollion insists on validation by people who speak the
language, and on structural checks that ask "is this a real word?" rather than
only "does this resemble the expected answer?"
:::

---

## 6. Who decides, and why that is the real point

Everything above follows from one choice: **which text went into the pile the
tokenizer learned from.**

Whoever makes that choice decides how every language will be cut up, how much it
will cost to use, and how hard the model will have to work to represent it. That
decision is made once, early, usually by a small group, and it is effectively
permanent for the life of that model — the tokenizer is not something you can
adjust afterwards.

It is also almost never discussed. Debates about language technology tend to be
about data, model size and quality scores. The step that decides whether a
language is representable at all sits underneath all of those, and is treated as
plumbing.

That is why this page exists. If a community wants genuine control over how its
language is handled by machines, controlling the data is not sufficient. The
question *"who decided how our words get cut into pieces?"* has an answer, and
for most of the world's languages that answer is currently: someone else, as a
side effect of compressing a pile of text that barely contained the language at
all.

---

## Where to go next

- [What Champollion Is](/docs/what-is-champollion) — the project this page belongs to, and what it does about the above.
- [How models get trained](/docs/network/context/mt-training-concepts) — the vocabulary for the step *after* tokenization, with the same starting-from-zero approach.
- [Honest Limitations](/docs/network/honest-limitations) — what this project does **not** claim.
- [Data Stewardship](/docs/network/sovereignty/data-sovereignty) — who holds the keys to a corpus, and what that means in practice.
