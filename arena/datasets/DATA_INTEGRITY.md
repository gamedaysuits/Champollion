# Data Integrity — Current Certified State

- Every corpus in `registry.json` declares its segment: `development`, `held_out`, or `gold_standard`.
- Sealed segments (`held_out`, `gold_standard`) are kept separated from development and public sets.
- The active held-out evaluation set has been verified clean: zero overlap with any development or public corpus.
- Corpora with verified overlap are quarantined, withdrawn from held-out evaluation, and marked as such in `registry.json` notes.
- Quarantine is enforced: quarantined files must never be used for held-out scoring; results computed on them are treated as development results.
- Automated cross-segment contamination checks (`corpora_builder.contamination`) run on every dataset build and exit non-zero on any critical finding.
- Registry entries are content-hashed (`sha256`) and versioned, so any corpus change is detectable.
- Questions about a specific dataset's status: see its `registry.json` entry.
