# {name}

A machine-translation project on the rails: {source_name} → {target_name}.
{purpose_line}
Ask what to do next at any time:

```bash
champollion next
```

## Where things go

| Folder | What goes in it |
|---|---|
| `data/parallel/` | Sentence pairs to learn from — one pair per line, source TAB translation, saved as `.tsv` |
| `data/test/` | The sentences a fluent speaker checked, used to judge every model. Never put them in `data/parallel/` |
| `data/lexicon/` | Word lists and dictionaries |
| `data/grammar/` | Grammar notes |
| `data/monolingual/` | Text in one language only (kept; not used for training yet) |
| `consent/` | Notes recording who agreed to what, and when |
| `inbox/` | Files as you have them (a spreadsheet, a Word table, a .csv). `champollion data add inbox/<file>` brings the pairs in |

Beside each data file, a small `<file>.champollion.json` records what the people
who hold it decided: who holds it, whether a model may be trained on it, and
whether its text may ever leave this computer. Every tool obeys it.
`champollion data mark <file> …` writes it; `champollion validate` checks it.

## What stays on this computer

Everything. Nothing in this folder is uploaded by the tools unless you choose a
step that says so and say yes. The `.gitignore` here keeps your data, consent
notes and models out of any git repository you push. Remove a line from it only
if the people who hold that data agree.

## The rails

1. Gather your data and record its terms.
2. Protect a test set that no model learns from.
3. Install the training tools.
4. Build a model and prove it on the test set — honestly, with the caveats shown.
5. Use it where you need it.

A small model trained on a few thousand pairs is usually a phrasebook for
phrases like the ones it saw, not a general translator. The tools tell you how
good it is on your own test sentences — a fluent speaker decides what is fit to
use.
