"""Kinds of English sentence, by plain rules — the improve loop's categories.

A round's diagnosis says WHICH KINDS of sentence the model gets wrong, never
which sentences: the names below are fixed, so a count of them can be told to
a hosted agent without telling it any of the people's text.

The rules read the English side of a pair (the side the people write in the
usual direction, or the reference when English is the target). They are
deliberately simple and generic — word lists and punctuation, the same for
every language the English is paired with — and never consult a language
pack: a kind is what an English speaker would call the sentence.
"""

from __future__ import annotations

import re

# kind → the plain name shown to people (order = display order)
KIND_NAMES = {
    "question": "questions",
    "negation": "sentences with not / never / nobody",
    "past": "things that happened (past)",
    "future": "things that will happen (future)",
    "command": "asking or telling someone to do something",
    "possession": "whose something is (my, your, Grandpa's)",
    "joined": "two things joined (and, but, because, when, if)",
    "number": "counting (two, three, ten)",
    "long": "long sentences (more than 10 words)",
    "short": "short phrases (4 words or fewer)",
}

_WORD = re.compile(r"[a-z]+(?:'[a-z]+)?")
_WH = {"who", "what", "where", "when", "why", "how", "which", "whose", "whom"}
_AUX = {"do", "does", "did", "is", "are", "was", "were", "can", "could", "will",
        "would", "should", "shall", "have", "has", "had", "may", "might", "am"}
_NEG = {"not", "never", "no", "nobody", "nothing", "nowhere", "none", "cannot",
        "neither", "nor", "noone"}
_PAST_WORDS = {"did", "was", "were", "had", "yesterday", "ago", "used"}
_IRREGULAR_PAST = {
    "went", "came", "saw", "ate", "took", "gave", "made", "said", "told",
    "found", "left", "ran", "sat", "stood", "slept", "drank", "knew",
    "thought", "brought", "bought", "caught", "taught", "heard", "felt",
    "kept", "met", "paid", "sent", "spent", "lost", "held", "sold", "wrote",
    "spoke", "broke", "chose", "drove", "rode", "fell", "got", "began",
    "sang", "swam", "won", "threw", "grew", "flew", "drew", "wore", "hid",
    "bit", "fed", "led", "built", "fought", "forgot", "lay", "woke", "became",
}
# words ending in -ed that are not past tense
_NOT_PAST_ED = {"need", "needed", "feed", "seed", "bed", "red", "speed",
                "indeed", "hundred", "sled", "shed", "weed", "proceed",
                "succeed", "exceed", "breed", "bleed", "naked", "sacred",
                "wicked", "beloved", "tired", "married", "used"}
_FUTURE = {"will", "shall", "tomorrow", "gonna", "'ll"}
_COMMAND_START = {
    "please", "let's", "come", "go", "give", "take", "bring", "sit", "look",
    "listen", "eat", "drink", "help", "tell", "wait", "stop", "put", "get",
    "make", "open", "close", "be", "don't", "do", "watch", "hold", "show",
    "call", "leave", "stay", "keep", "try", "remember", "say", "turn",
    "pass", "hurry", "move", "wash", "write", "read",
}
_SUBJECT_START = {"i", "you", "he", "she", "it", "we", "they", "this", "that",
                  "there", "my", "your", "his", "her", "our", "their", "the", "a"}
_POSSESSIVE = {"my", "your", "his", "her", "its", "our", "their", "mine",
               "yours", "ours", "theirs", "whose"}
# 's that is "is"/"us", not whose
_CONTRACTED_S = {"it's", "he's", "she's", "that's", "what's", "there's",
                 "let's", "here's", "who's", "where's", "how's", "when's",
                 "why's", "this's", "one's"}
_JOIN = {"and", "but", "or", "because", "when", "if", "so", "while",
         "until", "before", "after", "although", "since"}
_NUMBER_WORDS = {"one", "two", "three", "four", "five", "six", "seven",
                 "eight", "nine", "ten", "eleven", "twelve", "twenty",
                 "thirty", "hundred", "thousand", "first", "second", "third",
                 "dozen", "half", "both"}


def words(text: str) -> list[str]:
    """Lowercased English word tokens (apostrophe contractions kept whole)."""
    return _WORD.findall(str(text).lower().replace("’", "'"))


def kinds_of(text: str) -> set[str]:
    """Every kind an English sentence is, by the rules above."""
    raw = str(text).strip()
    w = words(raw)
    out: set[str] = set()
    if not w:
        return out
    first = w[0]
    if raw.endswith("?") or (first in _WH) or (first in _AUX and len(w) > 2 and raw.endswith("?")):
        out.add("question")
    if any(x in _NEG or x.endswith("n't") for x in w):
        out.add("negation")
    if any(x in _PAST_WORDS or x in _IRREGULAR_PAST
           or (x.endswith("ed") and len(x) > 4 and x not in _NOT_PAST_ED) for x in w):
        out.add("past")
    if any(x in _FUTURE or x.endswith("'ll") for x in w) or "going to" in " ".join(w):
        out.add("future")
    if "question" not in out and (raw.endswith("!") or first in _COMMAND_START) \
            and first not in _SUBJECT_START:
        out.add("command")
    if any(x in _POSSESSIVE or (x.endswith("'s") and x not in _CONTRACTED_S) for x in w) or re.search(r"\w+s'(\s|$)", raw.lower()):
        out.add("possession")
    if any(x in _JOIN for x in w[1:]):
        out.add("joined")
    if re.search(r"\d", raw) or any(x in _NUMBER_WORDS for x in w):
        out.add("number")
    if len(w) > 10:
        out.add("long")
    elif len(w) <= 4:
        out.add("short")
    return out
