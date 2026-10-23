"""The improve loop: what happens after a family has a model in use.

Founder (2026-10-11): "Can a user go back and forth with the agent and get that
number legitimately up, and genuinely develop a working NMT model?" A model in
use is where the work starts, not where the rails end. Each ROUND adds data —
the speaker's review fixes, a wishlist's answers, resources found — trains
again (a new run: see ``training.run.run_identity``), and judges the new model
against the one in use on the SAME dev sentences, paired. The new model is
put to use only when it is measurably better; the test set is read at
milestones only, never every round.

Modules: ``compare`` (the round's verdict).
"""
