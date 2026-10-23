"""Remote compute: training on a rented GPU, under the rails' consent rules
(docs: RAILS_REMOTE_COMPUTE_AND_MODEL_COMPARISON_PLAN_2026-10-14 Part 2).

Remote compute sends a family's training sentences to a machine someone else
owns. So it is off by default and sits under the same rules as sending text
to a model API:

- **Consent per file.** Every file that would leave the computer needs the
  people's yes for remote compute, typed at a terminal and recorded in its
  sidecar (``consent.py``), bound to the file's exact contents. A sealed,
  local-only, quarantined or consent-required file is refused whatever the
  yes. An agent can never record the yes.
- **Where.** RunPod's own datacentres only (Secure Cloud), in the countries
  the people agreed to (Canada first); the placement is checked after the
  machine starts, and a machine placed elsewhere is shut down unused.
- **Money.** The live price, an estimate and a hard cap before anything
  starts; the cap is watched while the job runs.
- **Nothing left running, nothing left behind.** Every step is bounded; the
  pod is wiped and terminated on success, failure, a stall, a stop or the
  cap; ``nmt-forge remote status`` finds and stops a leftover.
- **The test set never leaves.** Only training files and the dev set go;
  forge's own guards (dev fence, leak audit against the test sets) run HERE,
  on the same files, before anything is sent.
- **A record.** The ledger notes file hashes (never text), where, when, how
  long, the cost and the deletion.

Modules: ``keys`` (the RunPod key, never shown), ``runpod`` (the API client),
``consent`` (the per-file yes), ``ssh`` (an ephemeral key per run, scp/ssh),
``lifecycle`` (plan, run, tear down), ``pod_main`` (what runs on the pod).
"""
