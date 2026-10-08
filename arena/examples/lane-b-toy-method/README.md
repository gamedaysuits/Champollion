# Lane B toy method

The smallest runnable method bundle the organizer node accepts: a Dockerfile
that adds nothing to its base image and one Python script that reads stdin
and writes stdout. It exists to prove the **pipe** — packaging, the static
import scan, the `--network=none` build, the read-only container run, the
single scorer, the aggregates-only publish — end to end, on the harness's
synthetic `qaa>qab` fixture.

**It says nothing about translation quality.** The synthetic pair's whole
grammar is one rule (`w1 w2 w3 … → w2 w1vo`), and `method/translate.py`
implements exactly that rule, so it scores ~100 against the synthetic
references *by construction*. A green run means every stage of the lane
carried the bytes correctly; it is not evidence about any method or language.

## Layout

```
lane-b-toy-method/
├── Dockerfile             FROM python:3.12-slim; COPY method /method — nothing else
├── method/translate.py    stdin → stdout, one line per line; imports only `sys`
└── README.md
```

There is no data file and no lookup table: the rule is the method. (A table
of source/target pairs would be corpus-shaped content, which this repository
never tracks.)

## The container contract this bundle satisfies

This is what the node actually runs (`sandbox_runner.run_container_argv`,
sandbox evaluation spec §2.2, §6, §7). Your method sees exactly this and
nothing more:

| What | Value |
|------|-------|
| Command | `/bin/sh -c "cat /eval/source.txt \| python3 /method/translate.py > /output/translations.txt"` |
| `/method` | your bundle's `method/` directory, **read-only** bind mount |
| `/eval` | `source.txt` only — one source sentence per line, corpus order; **read-only**; references never enter the container |
| `/output` | writable bind mount; `translations.txt` must appear here, one line per input line, same order |
| `/tmp` | tmpfs scratch, sized by the manifest's `diskGB` |
| Environment | `PATH`, `HOME=/tmp`, `TMPDIR=/tmp` — the whole environment; nothing else is passed |
| Network | `--network=none` (no network namespace at all) — at build time **and** run time |
| Root filesystem | `--read-only`, `--cap-drop ALL`, `--security-opt no-new-privileges` |
| Limits | `--pids-limit` (default 512), `--memory` (manifest `ramGB`), `--cpus` (the node's `sandbox.cpus` — must not exceed the host's core count, the node refuses otherwise) |
| Entrypoint | `method/translate.py` in the manifest → `python3 /method/translate.py` (a `.sh` runs under `sh`; anything else runs directly) |
| Exit | non-zero exit, a missing `/output/translations.txt`, a line-count mismatch, or an over-limit `/output` all produce **no score** (spec §8) |

Because the image is built with `--network=none`, a Dockerfile that fetches
anything (`pip install` from an index, `apt-get`, `curl`, `wget`, `git clone`)
fails the build — and the static scan flags those tokens first, comments
included. Vendor everything into the bundle instead.

## Packaging and running it

Package it as a participant would (offline, no account needed) — the same
static checks the node runs happen locally first:

```bash
mt-eval contest submit-method <slug> --method-dir method --dockerfile Dockerfile \
    --name lane-b-toy --version 1.0.0 --entrypoint method/translate.py \
    --method-class pipeline --paradigm rule-based --pair qaa>qab \
    --developer "Example" --developer-email you@example.test --agree \
    --node-id <organizer-advertised node id> --secret-set <sealed set id> \
    --track constrained --parameter-count 0 \
    --training-data-file training-data.txt --primary \
    --offline --offline-qualifier-id <published qualifier id> \
    --offline-threshold 35 \
    --bundle-out ./exchange
```

### The declarations that submission carries

Every contest entry declares five things about how it was built and one thing
about what kind of entry it is. They are recorded on the submission and shown
in every ranking artifact.

| Flag | What it declares | Checked? |
|------|------------------|----------|
| `--track constrained\|unconstrained` | whether you trained only on the data the organizer allowed | no — your claim; the two tracks are ranked in separate partitions |
| `--parameter-count N` | total trainable parameters, or **0** for a method that has none | **yes in Lane A** (`submit-model`): the node reads the count back out of your safetensors header and refuses a claim off by more than 1%. In this code lane there is no header to read, so it is your claim. This method is a two-word reordering rule with no trainable parameters at all, so it declares **0** — the honest answer, and admissible since 2026-09-07 |
| `--weights-license TEXT` | SPDX id or `LicenseRef-…` for the weights — required when `--parameter-count` is above 0, left out at 0 (no weights) | no — your claim; it is what a prize or reuse conversation starts from |
| `--weights-public` / `--weights-private` | whether the weights are downloadable — required when `--parameter-count` is above 0, left out at 0 | no — your claim |
| `--training-data-file PATH` | the corpora you trained on (≤2000 chars) | no — your claim; **required** with `--track constrained`, because the track claim is a claim about this list |
| `--primary` / `--contrastive` | primary entries are ranked for the win; contrastive entries are scored and reported in their own section | structural: one primary per team |
| `--description-file PATH` | your system description (≤4000 chars) | no; required when the contest sets `require_description` |
| `--method-release-url URL` | optional public https release location | format only; never a condition of ranking |

The toy method has no weights, so it declares `--parameter-count 0` and no
weights licence or openness (the submission records them as not applicable),
plus a training-data file that says it was trained on nothing. Writing any
other number, or a licence for weights that do not exist, would be a false
claim about a system anyone can read in twelve lines.

Entry also needs a **passing qualifier receipt** — `mt-eval contest qualify`
self-scores your system on the contest's public dev set and writes
`~/.mt-eval/qualifier/<slug>.json` (use `--receipt-dir` to keep it elsewhere).
Offline there is nothing to look the contest's terms up against, so
`--offline-qualifier-id` and `--offline-threshold` carry the values the
organizer published, and they must match the receipt. The receipt is
self-reported by construction; the node re-executes your bundle on the same
dev set before any grant is claimed and denies on a miss.

Or, on the organizer side with no database at all (rehearsal / DB-less
deployment), stage an already-built tarball as an authorized exchange
request:

```bash
mt-eval node stage-request ./exchange/requests/<id>/method.tar.gz \
    --contest <slug> --out /Volumes/USB --requested-by you@example.test
```

Either way the airgapped node continues with
`mt-eval node import-bundle`, `node run-method <id> --offline`, and
`node export-scores`. To run the sandbox for real, set
`MT_EVAL_DOCKER_TESTS=1` with a Docker daemon available and run
`tests/test_lane_b_toy_example.py`; without both, that leg skips and says so.

## What the tests assert (`tests/test_lane_b_toy_example.py`)

- the bundle passes the §3 static checks with **zero** warnings;
- `translate.py` imports only `sys`;
- run as a subprocess, its output equals the synthetic blind-test fixture's
  references line for line (and agrees with the harness's own reference
  implementation of the rule on every source line of both fixtures);
- two independent builds of the bundle produce the same `method_sha`
  (deterministic tarball — the hash that enters the request fingerprint);
- with real Docker (gated as above), `execute_and_score` scores it >90 and
  labels the run with that same `method_sha`.
