# Dogfooding forge on the Q-gate program: failures to guard against

*Written 2026-09-08 from the e13 Q-gate study (exact FST gate inside training and decoding, six-language
learning-curve program). Every row is something that actually broke, or nearly did, while running this work
outside forge. The point of the list: each row is a guard forge should grow so the next study cannot make the
same mistake silently. Format follows FAILURE_TAXONOMY.md: **failure → what we saw → the guard → where it lives.**
GAP = forge has nothing for it today.*

## A. Grammar-derived artefacts (the FST gate)

1. **A tool silently changed the language.** `hfst-eliminate-flags` (HFST 3.16.2) dropped every locative form
   (askihkohk, atimohk) from the surface acceptor; the build exited 0 and the automaton looked healthy
   (480k states). → **Guard:** any automaton or lexicon *derived* from a grammar must pass an equivalence check
   against the grammar's own reference lookup before it may license anything: bounded exhaustive enumeration in
   both directions, an independent flag simulator, deep random walks, the full sweep, mutants at edit distance 1–2,
   prefix soundness (trimness). Refuse the artefact on one disagreement. → `forge/guards/derived_automaton.py`
   (GAP).
2. **The checker itself was wrong and reported success.** The first exactness check parsed
   `hfst-optimized-lookup`'s three-column rejection line (`w\tw\t+?`) as an acceptance, so the reference accepted
   *everything*, including `asîwâwâwâwâwâ`. → **Guard:** every reference parser ships with canaries: known positives
   *and* known negatives (degenerate strings, `qqqq`); a check whose reference never rejects is broken and must
   fail loud. → the same guard module; canary set in `forge/tests/`.
3. **A wordlist trie is a partial proxy for an FST.** The old decode gate's fast path was a 737,881-form generator
   sweep; a train-time prefix gate built on it would have licensed a subset of the language (founder caught
   this). → **Guard:** when a grammar exists, the licensed language is the grammar's surface projection, never an
   enumeration; when only a wordlist exists, every output carries the label `constraint: partial (wordlist)`.
   → constraint layer config + a lint that rejects `wordlist` as a gate source when an FST is registered.
4. **Verification sets chosen by hand prove nothing.** The first check's positives were dominated by the sweep,
   i.e. the forms most likely to be fine. → **Guard:** verification inputs must be *generated* (enumeration,
   random walks, mutation) and the generator recorded; a hand-listed positive set is allowed only as an extra.
5. **Multichar surface symbols.** The analyzer's surface alphabet carried `@_SPACE_@` (multiword lexemes); a
   character-level walker would have mis-stepped. → **Guard:** alphabet audit before building any piece-level
   structure; fail loud on any symbol longer than one code point that is not explicitly mapped.
6. **Snapshots that move.** `~/.crk-translate/models/fst-b1-…/*.hfstol` were symlinks into a live build directory
   (now B2); the "pinned" snapshot was not pinned. → **Guard:** a snapshot is real files plus a sha256 manifest;
   forge refuses to run when the manifest does not match the bytes. → `forge/registry` (partially exists for
   corpora; extend to grammars).

## B. Training and decoding

7. **Unbounded steps.** A pure-Python transducer looped 4 h 51 min on one degenerate word and nothing noticed. →
   **Guard:** every external call and every chain step has a wall-clock budget; degenerate-input pre-filters
   (`(.{2,3})\1{3,}`, length caps); a stall watchdog that reads the *step's own* log, not the driver's.
8. **Decoders tested on the best checkpoint.** The hang came from the *worst* model's output. → **Guard:** decoder
   smoke on the weakest checkpoint (2–3 sentences, hard gate) is a required pre-flight of any chain.
9. **Tuple-shaped beam state.** A beam hypothesis was built as `(score, prefix, state)` in one place and read as
   `(prefix, score, state)` in another; the crash surfaced only in the smoke. → **Guard:** typed hypothesis
   records (dataclass), and the smoke in row 8.
10. **Loss functions that differ between arms.** Label smoothing over the licensed set vs the whole vocabulary
    makes eval losses incomparable. → **Guard:** eval metric = plain gold-token NLL; both arms run the same loss
    code with the mask as the only difference; the run manifest names the loss.
11. **Leak checks either too strict or too loose.** An English line shared by train and test with *different*
    Cree targets tripped a hard assert. → **Guard:** leak classes are explicit — pair, target, source-only — with
    a policy per class (pair/target: halt; source-only: count and report).
12. **Gold outside the gate's language.** A dev sentence with a word the FST lacks would have crashed a masked
    trainer (−inf at the gold position). → **Guard:** training gold is licensed by construction (training words
    are unioned in); dev/test sentences outside the language are scored unmasked and *counted*.
13. **Two GPU jobs, or CPU jobs beside a GPU job with no headroom.** Two CPU decodes beside stage-1 training and
    two idle VMs pushed swap to 17 GB. → **Guard:** a headroom check (free RAM, swap used) before any job starts;
    queue instead of run; one accelerator job at a time via a lock file, not process-name greps (row 14).
14. **Process-name mutexes.** Sibling chains guarded the GPU with `pgrep -f "train_s2.py|…"`; a new script was
    invisible to them until it carried a fake token in its argv. → **Guard:** one job queue / lock file for the
    machine; chains acquire it, never grep for each other.
15. **Quadratic corpus selection.** A greedy coverage selection over Arapaho's 36k training sentences was O(n²)
    and blew past its budget. → **Guard:** builders declare complexity and run under a budget with a seeded
    candidate pool.

## C. Data and evaluation

16. **Format assumptions on third-party corpora.** Nyangbo shipped without translation lines; Lezgi and Natugu's
    glosses do not align token-by-token (590/773 records). → **Guard:** builders validate required fields and
    alignment per record, report drop counts by reason, never skip silently; a language with >20 % drops is
    excluded with the reason in the manifest.
17. **Confounds across languages.** Words per sentence 3 (Arapaho) vs 9 (Tsez); characters per word 3 vs 10; test
    vocabulary coverage 2 % vs 50 %. → **Guard:** every cross-language table carries the confound columns and the
    in-configuration / in-vocabulary slices; a number without its coverage is not publishable.
18. **Metrics a gate can move vs metrics it cannot.** chrF barely moves with a gate; morphology-judged
    configuration accuracy does. → **Guard:** the harness names the primary metric in the pre-registration and
    forge refuses to headline another.
19. **Case-sensitive grammars.** Sentence-initial capitals fail FST lookup. → **Guard:** lower-case retry in every
    analyzer call, counted.
20. **Constraint-grammar disambiguation that empties a reading set.** → **Guard:** never let disambiguation
    return an empty list; fall back to the raw readings and count.

## D. Process

21. **Chains edited while running.** A bash script read incrementally will execute the edited text. → **Guard:**
    chains are copied to a run directory at launch; edits go to the copy for the next run.
22. **Paths with spaces.** A scorer failed on `$P` unquoted. → **Guard:** arrays and quoting; a test fixture whose
    path contains a space.
23. **zsh vs bash word splitting** (`set -- $L`). → **Guard:** every chain starts with `#!/bin/bash` and `set -u`,
    and is `bash -n`-checked plus dry-run in CI.
24. **argparse abbreviations.** `--m` matched `--metric` on one Python and not another. → **Guard:**
    `allow_abbrev=False` everywhere (already in the harness; add to forge).
25. **Monitors that watch the wrong log** (the driver's tail, not the step's). → row 7.
26. **Pre-registration drift.** The founder's questions changed twice in a night (Q-data vs Q-gate; decode gate vs
    train-time gate). → **Guard:** the pre-registration is a versioned file with dated amendments; forge stamps
    each run with the amendment it ran under.

## E. Found after the first version of this note (same night)

27. **The piece-level mask disagreed with the character-level walk.** The piece trie was built from the FST's alphabet
    only; a training word with a letter outside it (a capitalised name) was licensed by the character walk but had no
    licensed pieces, so one gold token per few batches was masked out and its loss was ~10,000. → **Guard:** the mask
    builder asserts, per training row, that every gold piece is in its own allowed set; and any eval loss *above* the
    unmasked loss halts the run — a mask that only removes competitors can never raise the gold token's loss.
28. **A collator that mutates dataset items.** `f.pop("allowed")` removed the mask lists from the dataset on the first
    pass; epoch two would have trained unmasked with no error. → **Guard:** collators copy; a checksum of the dataset
    items after epoch one equals the checksum before.
29. **A decision procedure that assumed both automata were trim.** The flagged automaton keeps configurations that can
    never accept; treating "has configurations" as "alive" produced a false witness ("nw"). → **Guard:** equivalence
    checks state which side is trim and explore dead-side pairs until the other side empties; a witness must be
    confirmed by the reference lookup before it is reported.
30. **Bounded exhaustive testing presented as proof.** Length-9 enumeration plus sampling is evidence; the founder
    correctly refused it as a proof for a language of unbounded length. → **Guard:** when the artefact is regular, run
    the pair-BFS decision for all lengths and publish its reachable-pair count; sampling is a supplement.

31. **Process-name guards matched the watchers.** `pgrep -f "train_s2.py|…"` matched the *monitor shells* whose command
    lines quote those names, and the sibling chain scripts that wait all night; the chain deadlocked for 25 minutes. →
    **Guard:** row 14 (one lock file), and until then match only interpreter + script (`bin/python … name.py`).
32. **Killing a chain script orphans its running step.** `pkill -f run_chain.sh` removed the bash parent; its `nohup`ed
    python child kept training, and the relaunched chain started the same tag again — two trainings writing one
    directory. → **Guard:** chains run steps in a process group and the kill targets the group; a run directory holds a
    lock with the owner PID and a second writer refuses.

33. **Unquoted variable holding a path with a space, again** (`$LEX="--lexicon …/UofA work/…"` split into two arguments; the
    glossed languages' scoring failed while their decodes succeeded). Row 22 had already recorded this failure class once
    tonight. → **Guard:** chains pass option bundles as bash arrays only; a lint rejects an unquoted `$VAR` that expands to
    more than one word; and the fixture path with a space (row 22) is mandatory in the chain's dry run.

## Ranked gaps for forge (highest value first)

1. Derived-automaton equivalence guard with canaries and the all-lengths decision (rows 1, 2, 4, 5, 27, 29, 30) — the failure that would have invalidated
   the whole study, twice in one hour.
2. Machine job lock + headroom check (rows 13, 14).
3. Budgets and stall watchdog on the step's own log (rows 7, 25).
4. Snapshot manifests for grammars (row 6).
5. Corpus-builder validation and confound columns (rows 16, 17).
6. Typed decoder state + worst-checkpoint smoke (rows 8, 9).
