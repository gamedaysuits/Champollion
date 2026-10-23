"""Everyday English words by area of life — what a wishlist asks about first.

Written for this purpose (2026-10-11), not taken from a published list: the
areas a family talks about at home, visiting, in town and on the land, and
plain words in each. It is a starting point for prompts, not a claim about any
language: a word here becomes "a sentence with 'river'" only when the model
has never seen it. Nothing ceremonial or sacred is asked for — what a family
shares of that is theirs to offer, never a prompt's to request.
"""

from __future__ import annotations

EVERYDAY: dict[str, tuple[str, ...]] = {
    "family and people": (
        "mother", "father", "grandmother", "grandfather", "child", "baby",
        "boy", "girl", "man", "woman", "friend", "brother", "sister", "aunt",
        "uncle", "cousin", "son", "daughter", "wife", "husband", "elder",
        "neighbour", "family", "people"),
    "visiting": (
        "visit", "guest", "welcome", "thanks", "tea", "coffee", "door",
        "name", "phone", "news", "talk", "laugh"),
    "food and cooking": (
        "food", "bread", "meat", "fish", "soup", "berries", "potato", "egg",
        "milk", "sugar", "salt", "butter", "flour", "pot", "kettle", "plate",
        "spoon", "knife", "cup", "cook", "eat", "drink", "hungry", "breakfast",
        "supper"),
    "home": (
        "house", "room", "bed", "table", "chair", "window", "floor", "roof",
        "stove", "fire", "wood", "light", "blanket", "clothes", "shoes",
        "coat", "wash", "sleep", "sweep", "yard"),
    "animals": (
        "dog", "cat", "horse", "cow", "bird", "duck", "goose", "moose",
        "deer", "bear", "wolf", "fox", "rabbit", "mouse", "eagle", "owl",
        "frog", "snake", "chicken", "beaver"),
    "land and weather": (
        "land", "sky", "sun", "moon", "star", "rain", "snow", "wind", "cold",
        "hot", "warm", "cloud", "storm", "ice", "lake", "river", "water",
        "tree", "grass", "rock", "hill", "forest", "road", "trail", "field"),
    "time": (
        "day", "night", "morning", "evening", "today", "tomorrow",
        "yesterday", "week", "month", "year", "spring", "summer", "fall",
        "winter", "now", "later", "early", "late", "always", "sometimes"),
    "body and health": (
        "head", "hand", "foot", "eye", "ear", "mouth", "tooth", "hair",
        "heart", "back", "leg", "arm", "sick", "hurt", "doctor", "medicine",
        "tired", "better", "pain", "fever"),
    "feelings": (
        "happy", "sad", "angry", "afraid", "love", "like", "cry", "worry",
        "glad", "lonely", "proud", "miss", "sorry"),
    "work and making": (
        "work", "job", "money", "buy", "sell", "store", "pay", "build",
        "make", "fix", "sew", "hunt", "trap", "plant", "garden", "cut",
        "carry", "pick", "clean", "help"),
    "school and learning": (
        "school", "teacher", "student", "book", "read", "write", "learn",
        "teach", "word", "language", "speak", "understand", "remember",
        "forget", "question", "answer"),
    "going places": (
        "car", "truck", "boat", "canoe", "town", "city", "home", "church",
        "hospital", "office", "far", "near", "walk", "drive", "ride", "go",
        "come", "arrive", "leave", "bus"),
    "counting and amounts": (
        "one", "two", "three", "four", "five", "six", "seven", "eight",
        "nine", "ten", "many", "few", "all", "some", "half", "more", "less"),
    "how things are": (
        "red", "white", "black", "blue", "green", "yellow", "big", "small",
        "old", "new", "good", "bad", "long", "short", "heavy", "strong",
        "fast", "slow", "full", "empty"),
    "saying and thinking": (
        "say", "tell", "ask", "think", "know", "want", "need", "hope",
        "believe", "call", "sing", "show", "hear", "see", "listen", "look"),
    "getting together": (
        "gathering", "feast", "dance", "song", "game", "play", "birthday",
        "wedding", "party", "hockey", "music", "camp"),
}


def everyday_words() -> list[tuple[str, str]]:
    """(area, word) for every everyday word, areas in order, each word once."""
    seen: set[str] = set()
    out = []
    for area, ws in EVERYDAY.items():
        for w in ws:
            if w not in seen:
                seen.add(w)
                out.append((area, w))
    return out
