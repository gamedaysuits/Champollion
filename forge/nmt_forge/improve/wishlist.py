"""The wishlist: what the people could write next that would help the model most.

A printable sheet for the family (journey plan, Phase 2 step 3), in their
project folder — never typed into a chat. Three parts:

  new words        everyday words, and the family's own dictionary's words,
                   that the model has never seen in training — "a sentence
                   with 'river'". Words the people already asked to have
                   translated, and the model has not learned, come first.
  kinds            the kinds of sentence it gets wrong most on the dev set
                   (``analysis``), or the kinds the people want and training
                   lacks — "ask a question you'd really ask".
  open             at least a quarter: anything at all they would say. A
                   wishlist that only chases gaps teaches a narrow model.

What a wishlist never does: take a word or a sentence from the dev or test
set (the words come from training coverage, the family's dictionary, the
people's own wanted sentences and the everyday list; the dev set only names
WHICH KINDS score worst), or print a word to the screen. The summary it
returns is counts and fixed kind names.
"""

from __future__ import annotations

import json
import math
import random
from collections import Counter
from pathlib import Path

from ..errors import ForgeError
from ..registry import load_rows
from ..training.config import RunConfig
from ..workspace import Workspace
from .analysis import MIN_KIND, analyze, english_side, project_pair, training_text
from .compare import RoundError, _manifest
from .everyday import everyday_words
from .kinds import KIND_NAMES, kinds_of, words

IMPROVE_WISHLIST = "improve-wishlist"
OPEN_SHARE = 0.25
WORD_SHARE = 0.45
MAX_KINDS = 3
DEFAULT_KINDS = ("question", "negation", "past", "command")

KIND_PROMPTS = {
    "question": ("Ask a question you'd really ask — who, what, where, when, why or how.",
                 "Ask a yes-or-no question you'd really ask."),
    "negation": ("Say something that is not so, or did not happen (not, never, nobody).",
                 "Say what someone does not want, or cannot do."),
    "past": ("Say something that happened yesterday, or long ago.",
             "Say what someone did this week."),
    "future": ("Say something that will happen tomorrow, or next week.",
               "Say what someone is going to do."),
    "command": ("Ask or tell someone to do something.",
                "Tell a child what to do, or not to do."),
    "possession": ("Say whose something is — mine, yours, ours, someone's.",
                   "Talk about someone's family, or someone's things."),
    "joined": ("Say two things in one sentence, joined with and, but, because, when or if.",
               "Say why something happened, in one sentence."),
    "number": ("Count something — how many people, days, animals or things.",
               "Say how many, or how much, of something."),
    "long": ("Say something longer, the way you would tell it — more than ten words.",),
    "short": ("A short everyday phrase — two to four words.",),
}

OPEN_PROMPTS = (
    "Anything you'd say at home today.",
    "Something you'd say to a child.",
    "Something you'd say to someone visiting.",
    "Something about the weather, or the land.",
    "Something you'd say in town, or at the store.",
    "Something you'd say on the phone.",
    "Something you did, or saw, this week.",
    "Something you'd say at a meal.",
    "Something you'd say to an old friend.",
    "Anything at all you'd want to be able to say.",
)

ASK_FOR = {
    "word list": "A word list or dictionary of the language, on paper or in a file.",
    "both languages": ("Anything already written in both languages — school sheets, signs, "
                       "letters, forms, a book with the two side by side."),
    "recordings": "Recordings that someone has already written down.",
}

# one rule for "seen", shared with the server's unseen-word check
from ..seen_words import covered  # noqa: E402,F401


def newest_run(ws: Workspace) -> Path:
    """The most recently trained run's manifest in this workspace."""
    found = sorted(Path(ws.runs_dir).glob("*/run-manifest.json"), key=lambda p: p.stat().st_mtime)
    if not found:
        raise RoundError("no trained run in this workspace yet",
                         why="a wishlist reads what the newest model was trained on and where it goes wrong",
                         fix="train a model first (`nmt-forge run config.json`)")
    return found[-1]


def _english_lines(paths) -> list[str]:
    out = []
    for p in paths or []:
        try:
            out += [ln.strip() for ln in Path(p).read_text(encoding="utf-8-sig").splitlines() if ln.strip()]
        except (OSError, UnicodeDecodeError):
            continue
    return out


def _lexicon_words(paths, side: str | None) -> tuple[list[str], list[str]]:
    """(single-word English entries of the family's word lists in file order,
    the names of lists that could not be read — said, never skipped quietly)."""
    if side is None:
        return [], []
    from .. import _harness
    _harness.load_harness()
    from mt_eval_harness.methods.lexicon import load_lexicon

    out: list[str] = []
    unread: list[str] = []
    for p in paths or []:
        try:
            entries = load_lexicon(p)
        except Exception:
            unread.append(Path(p).name)
            continue
        for key, targets in entries.items():
            cands = [" ".join(key)] if side == "source" else list(targets)
            for c in cands:
                ws_ = words(c)
                if len(ws_) == 1 and ws_[0] not in out:
                    out.append(ws_[0])
    return out, unread


def _guard_grams(ws: Workspace) -> set[tuple[str, ...]]:
    """Every word 4-gram of the dev and test sources: no prompt may share one."""
    grams: set[tuple[str, ...]] = set()
    for name in ws.registry.names(roles=("dev", "test")):
        try:
            entry = ws.registry.get(name)
            rows = load_rows(entry["path"])
        except Exception:        # a set not on this computer has nothing to collide with here
            continue
        field = entry.get("source_field") or "source"
        for r in rows:
            w = words(str(r.get(field, "")))
            grams.update(tuple(w[i:i + 4]) for i in range(len(w) - 3))
    return grams


def _allocate(n: int, weights: dict[str, float]) -> dict[str, int]:
    if n <= 0 or not weights:
        return {}
    total = sum(weights.values())
    raw = {k: n * v / total for k, v in weights.items()}
    out = {k: max(1, int(math.floor(x))) for k, x in raw.items()}
    while sum(out.values()) > n:
        k = max(out, key=lambda k: out[k])
        out[k] -= 1
    for k in sorted(raw, key=lambda k: -(raw[k] - math.floor(raw[k]))):
        if sum(out.values()) >= n:
            break
        out[k] += 1
    return {k: v for k, v in out.items() if v > 0}


def make_wishlist(ws: Workspace, *, out: str | Path, run_manifest: str | Path | None = None,
                  n: int = 40, wanted=(), lexicons=(), round_no: int | None = None,
                  seed: int = 0) -> dict:
    """Write the sheet (``out``, markdown) and ``wishlist.json`` beside it;
    return the content-free summary (and ledger it)."""
    if n < 8:
        raise RoundError(f"a wishlist of {n} prompts is too short to be useful",
                         why="a quarter of it is open prompts; the rest needs room for words and kinds",
                         fix="ask for 8 or more (--n 40 is about one sitting)")
    manifest = Path(run_manifest) if run_manifest else newest_run(ws)
    m = _manifest(manifest)
    cfg = RunConfig.from_dict(m["config"])
    source, target = project_pair(ws)
    side = english_side(source, target)
    tr_src, tr_tgt, _notes = training_text(ws, cfg, (m.get("run_identity") or {}).get("training_files"))
    english_train = tr_src if side == "source" else tr_tgt if side == "target" else []
    known = {w for s in english_train for w in words(s)}

    # the diagnosis: which kinds it gets wrong on dev (kind names only)
    try:
        report = analyze(ws, manifest, ledger=False)
        diagnosis_note = None
    except ForgeError as e:      # no dev translations kept, or the dev set moved: said, not hidden
        report, diagnosis_note = None, f"the kinds are not chosen from its errors: {str(e).splitlines()[0]}"

    # words, in priority order: wanted-and-unseen, everyday-and-in-their-list,
    # everyday, the rest of their list
    wanted_lines = _english_lines(wanted) if side == "source" else []
    lex, lex_unread = _lexicon_words(lexicons, side)
    lex_set = set(lex)
    picked: list[tuple[str, str]] = []          # (area, word)
    seen: set[str] = set()

    def take(area, w):
        if w not in seen and not covered(w, known):
            seen.add(w)
            picked.append((area, w))

    every = everyday_words() if side else []
    every_words = {w for _, w in every}
    want_counts = Counter(w for ln in wanted_lines for w in words(ln) if len(w) > 2)
    area_of = {w: a for a, w in every}
    for w, _c in want_counts.most_common():
        take(area_of.get(w, "words you asked about"), w)
    for a, w in every:
        if w in lex_set:
            take(a, w)
    for a, w in every:
        take(a, w)
    rng = random.Random(seed)
    rest = [w for w in lex if w not in every_words]
    rng.shuffle(rest)
    for w in rest:
        take("from your word list", w)

    n_open = math.ceil(OPEN_SHARE * n)
    n_words = min(len(picked), round(WORD_SHARE * n))

    # kinds: the dev diagnosis first, then what the people want and training lacks
    weights: dict[str, float] = {}
    chosen_from = None
    if report and report["weakest"]:
        weights = {k: report["kinds"][k]["gap"] for k in report["weakest"]}
        chosen_from = "dev errors"
    elif side and wanted_lines and english_train:
        want_share = Counter(k for ln in wanted_lines for k in kinds_of(ln))
        have_share = Counter(k for s in english_train for k in kinds_of(s))
        gaps = {k: want_share[k] / len(wanted_lines) - have_share[k] / len(english_train)
                for k in KIND_NAMES if want_share[k] >= MIN_KIND}
        weights = dict(sorted(((k, g) for k, g in gaps.items() if g > 0), key=lambda kv: -kv[1])[:MAX_KINDS])
        chosen_from = "what you want" if weights else None
    if not weights and side:
        weights = {k: 1.0 for k in DEFAULT_KINDS}
        chosen_from = "a starting set"
    n_kinds = n - n_open - n_words if weights else 0
    if not weights:                         # no English side: words and open only
        n_words = min(len(picked), n - n_open)
    n_open = n - n_words - n_kinds
    kind_counts = _allocate(n_kinds, weights)

    grams = _guard_grams(ws)

    def clean(line: str) -> bool:
        w = words(line)
        return not any(tuple(w[i:i + 4]) in grams for i in range(len(w) - 3))

    word_items = [(a, w) for a, w in picked[:n_words] if clean(f"a sentence with {w}")]
    kind_items = []
    for k, c in kind_counts.items():
        prompts = KIND_PROMPTS[k]
        kind_items += [(k, prompts[i % len(prompts)]) for i in range(c)]
    kind_items = [(k, p) for k, p in kind_items if clean(p)]
    opens = list(OPEN_PROMPTS)
    rng.shuffle(opens)
    n_open = n - len(word_items) - len(kind_items)
    open_items = [p for p in (opens * (n_open // len(opens) + 1))[:n_open] if clean(p)]

    has_lexicon = bool(lexicons)
    ask_for = [k for k in ASK_FOR if not (k == "word list" and has_lexicon)]

    sheet = Path(out)
    sheet.parent.mkdir(parents=True, exist_ok=True)
    sheet.write_text(_render(round_no, report, word_items, kind_items, open_items, ask_for,
                             chosen_from, side), encoding="utf-8")
    (sheet.parent / "wishlist.json").write_text(json.dumps({
        "round": round_no, "run": m["run_name"],
        "words": [{"area": a, "word": w} for a, w in word_items],
        "kinds": [{"kind": k, "prompt": p} for k, p in kind_items],
        "open": open_items, "ask_for": ask_for,
    }, ensure_ascii=False, indent=1) + "\n", encoding="utf-8")

    summary = {
        "round": round_no, "run": m["run_name"], "sheet": str(sheet),
        "prompts": len(word_items) + len(kind_items) + len(open_items),
        "new_words": len(word_items), "unseen_words_left": max(0, len(picked) - len(word_items)),
        "kinds": dict(Counter(k for k, _ in kind_items)), "kinds_chosen_from": chosen_from,
        "open": len(open_items), "ask_for": ask_for, "word_lists_unread": lex_unread,
        "diagnosis": ({k: v for k, v in report.items() if k not in ("text", "notes", "manifest")}
                      if report else None),
        "diagnosis_note": diagnosis_note,
    }
    summary["text"] = wishlist_text(summary, report)
    ws.ledger.append(IMPROVE_WISHLIST, **{k: v for k, v in summary.items() if k != "text"})
    return summary


def wishlist_text(s: dict, report: dict | None) -> list[str]:
    kinds = ", ".join(f"{KIND_NAMES[k]} {c}" for k, c in s["kinds"].items())
    head = (f"{s['prompts']} prompts: {s['new_words']} new words"
            + (f", {sum(s['kinds'].values())} kinds of sentence ({kinds})" if s["kinds"] else "")
            + f", {s['open']} open — on the sheet at {s['sheet']}.")
    lines = [head]
    if report:
        lines += report["text"]
    if s.get("diagnosis_note"):
        lines.append(s["diagnosis_note"])
    if s.get("word_lists_unread"):
        lines.append(f"{len(s['word_lists_unread'])} word list(s) could not be read, so their words are not on "
                     "the sheet — `nmt-forge floor <list>` says why")
    if s["kinds_chosen_from"] == "a starting set":
        lines.append("The kinds are a starting set, not chosen from its errors: "
                     "no kind of sentence scored measurably below the whole yet.")
    return lines


def _render(round_no, report, word_items, kind_items, open_items, ask_for, chosen_from, side) -> str:
    title = f"Round {round_no} — " if round_no else ""
    lines = [f"# {title}sentences that would help the model most", "",
             "Write sentences you would really want translated — one per line, in "
             "to-translate.txt beside this sheet. These prompts point at what the model "
             "knows least; any sentence you would really say is welcome, and you can skip "
             "any prompt. The model drafts them; the speaker fixes the drafts.", ""]
    if word_items:
        # several sentences a word: on the test language a word the model saw
        # once came out right 27-29% of the time, seen 2-4 times 63-95%, and
        # sentences chosen for the most new words taught less than everyday
        # ones (stress test 4, G1-cross, 2026-10-13)
        lines += ["## Words it has never seen", "",
                  "Two or three sentences with each word you need, each saying something different — "
                  "the way you would really use it. A word the model meets only once is rarely learned. "
                  "Fewer words, each in a few sentences, teach it more than many words once.", ""]
        by_area: dict[str, list[str]] = {}
        for a, w in word_items:
            by_area.setdefault(a, []).append(w)
        for a, ws_ in by_area.items():
            lines.append(f"**{a.capitalize()}:** " + ", ".join(f"“{w}”" for w in ws_))
        lines.append("")
    if kind_items:
        why = {"dev errors": "the kinds of sentence it gets wrong most often",
               "what you want": "the kinds you ask for most and it has seen least",
               "a starting set": "a starting set of kinds"}.get(chosen_from, "")
        lines += ["## Kinds of sentence", "", f"These are {why}.", ""]
        lines += [f"- [ ] {p}" for _, p in kind_items]
        lines.append("")
    if open_items:
        lines += ["## Anything at all", ""] + [f"- [ ] {p}" for p in open_items] + [""]
    if ask_for:
        lines += ["## Do you have any of these?", "",
                  "If you do, tell the agent where the file is — it brings files in where they are, "
                  "and nothing leaves this computer unless you say so.", ""]
        lines += [f"- {ASK_FOR[k]}" for k in ask_for] + [""]
    return "\n".join(lines)
