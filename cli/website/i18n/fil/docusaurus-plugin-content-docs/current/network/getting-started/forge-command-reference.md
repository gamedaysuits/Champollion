---
sidebar_position: 5
title: "Sanggunian ng forge Command"
description: "Bawat nmt-forge subcommand, ang mga argument nito, at kung ano ang binabantayan nito — binuo mula sa CLI parser upang hindi ito kailanman malihis."
---

<!-- BINUO ng forge/scripts/gen_command_reference.py — huwag i-edit nang mano-mano.
     Patakbuhin muli ang generator pagkatapos ng anumang pagbabago sa CLI. -->

# Sanggunian ng forge Command

Bawat `nmt-forge` subcommand, binuo nang direkta mula sa CLI parser upang ang
pahinang ito ay hindi malihis mula sa tool. Para sa *bakit* sa likod ng bawat guard, tingnan ang
[Sanayin ang Model nang Tapat](/docs/network/getting-started/training-honestly); para sa
pagpapatakbo ng forge mula sa isang agent, tingnan ang
[Sanayin ang Inyong Unang Model (kasama ang inyong agent)](/docs/network/getting-started/train-your-first-model).

**Ang global flag:** `--workspace <dir>` (default `./.forge`) ay nauuna sa bawat
subcommand at pinapangalanan ang proyektong inyong pinapatakbo.

Mga agent: tawagin muna ang `nmt-forge status --json` — sinasabi nito sa inyo kung alin sa mga ito ang
susunod na patatakbuhin.


## `discover`

ano ang mayroon ang wikang ito? (binabasa ang SSOT language card; kawalan = hindi alam, hindi kailanman zero)

**Mga Argumento:**

- `code` — ISO 639-3 code (hal. crk, fra, nav, arb)

**Mga Opsyon:**

- `--cards-dir` — language-cards directory (default: $CHAMPOLLION_CARDS_DIR o monorepo walk-up)
- `--json` — 
- `--no-registry` — laktawan ang mt-eval registry cross-check ng mga eval dataset

## `init`

mag-scaffold ng proyekto mula sa isang language card: workspace + starter config + NEXT_STEPS.md

**Mga Argumento:**

- `code` — ISO 639-3 code ng TARGET language

**Mga Opsyon:**

- `--dir` — project directory (default .)
- `--pair` — language pair bilang SRC-TGT (default eng-<code>)
- `--cards-dir` — 

## `status`

nasaan ako? state table + ANG susunod na command (mga agent: tawagin muna ito, gamitin ang --json)

**Mga Opsyon:**

- `--json` — 

## `preflight`

tatanggi ba ang <command>? bawat gate na dadaanan nito, kasama ang mga pag-aayos (exit 2 kung may anumang gate na mabigo)

**Mga Argumento:**

- `target` — command na i-preflight: run|score|split|prereg|leak-audit

**Mga Opsyon:**

- `--json` — 

## `lint`

i-diagnose ang isang battery manifest: mahihinang register → pinakaposibleng sanhi → ang lever na susunod na gagalawin

**Mga Argumento:**

- `manifest` — battery manifest json (guard: ci-scoring/battery)

**Mga Opsyon:**

- `--run-manifest` — run manifest para sa mga schedule/transfer-plateau signal
- `--json` — 

## `registry`

registry ng eval-set

### `registry add`

**Mga Argumento:**

- `name` — 
- `path` — 

**Mga Opsyon:**

- `--role` *(kinakailangan)* (isa sa: dev, test, sealed) — 
- `--source-field` — 
- `--target-field` — 
- `--note` — 
- `--allow-rotate` — 

### `registry list`

### `registry add-harness`

**Mga Argumento:**

- `dataset_id` — 

**Mga Opsyon:**

- `--role` (isa sa: dev, test, sealed) — 
- `--yes` — tanggapin ang mga fetch prompt ng harness nang non-interactive

## `split`

group-disjoint train/dev/test carve

**Mga Argumento:**

- `corpus` — 

**Mga Opsyon:**

- `--test` *(kinakailangan)* — 
- `--dev` — 
- `--seed` *(kinakailangan)* — 
- `--out` *(kinakailangan)* — 
- `--source-field` — 
- `--target-field` — 
- `--register` — i-register din ang PREFIX-test / PREFIX-dev sa workspace

## `verify-split`

zero-overlap check sa mga umiiral na file

**Mga Argumento:**

- `sides` — train/dev/test files (anumang subset)

**Mga Opsyon:**

- `--source-field` — 
- `--target-field` — 

## `leak-audit`

i-screen ang isang corpus laban sa mga naka-register na eval

**Mga Argumento:**

- `corpus` — 

**Mga Opsyon:**

- `--strict` — hard-fail sa mga test/sealed hit
- `--clean-to` — isulat dito ang mga surviving row sa halip na mabigo
- `--manifest` — 
- `--target-field` — 

## `sample`

per-kind capped reservoir sample

**Mga Argumento:**

- `corpus` — 

**Mga Opsyon:**

- `--n` *(kinakailangan)* — 
- `--cap` — 
- `--key` — 
- `--seed` *(kinakailangan)* — 
- `--out` *(kinakailangan)* — 

## `ledger`

inspeksyon ng eval-ledger

### `ledger show`

**Mga Opsyon:**

- `--set` — spend report para sa isang set

### `ledger verify`

## `prereg`

preregistration

### `prereg new`

**Mga Argumento:**

- `id` — 

**Mga Opsyon:**

- `--eval-set` *(kinakailangan)* — 
- `--predictions` *(kinakailangan)* — JSON file: isang listahan ng mga prediction object
- `--author` — 
- `--config-hash` — 
- `--consequences` — 

### `prereg check`

**Mga Argumento:**

- `id` — 

**Mga Opsyon:**

- `--results` *(kinakailangan)* — isang ScoreReport manifest JSON

## `score`

i-score ang mga hypothesis sa isang naka-register na set (palaging may mga CI)

**Mga Opsyon:**

- `--eval-set` — 
- `--config` — run-config path: pinapatakbo ang battery mula sa eval block nito (naka-register na battery, grouping, plugins, canonicalizer, prereg binding) — isang file, buong eval
- `--hyps` *(kinakailangan)* — 
- `--config-hash` — 
- `--metric` — lane na i-score (maaaring ulitin): chrf++, bleu, exact_match, comet, comet-qe, metricx (default: chrf++/bleu/exact_match)
- `--target-lang` — ISO 639-3 target code — niresolba ang tamang neural metric model at ang low-resource warning nito
- `--plugin` — LYSS-protocol metric plugin, 'module.path:ClassName' (maaaring ulitin); ang mga numeric aggregate nito ay nagiging mga lane na may CI
- `--card-plugins` — patakbuhin ang plugin discovery ng harness para sa wikang ito (card evalMetrics + FST validity + behavioral linters)
- `--override-respend` — 
- `--json-out` — 

## `compare`

A/B sa isang naka-register na set (prereg-gated)

**Mga Opsyon:**

- `--eval-set` *(kinakailangan)* — 
- `--hyps-a` *(kinakailangan)* — 
- `--hyps-b` *(kinakailangan)* — 
- `--label-a` — 
- `--label-b` — 
- `--config-hash` — 
- `--metric` — lane na ikukumpara (maaaring ulitin; default chrf++) — kasama ang comet/comet-qe/metricx
- `--target-lang` — 
- `--plugin` — LYSS-protocol metric plugin (maaaring ulitin)
- `--card-plugins` — harness plugin discovery para sa wikang ito
- `--override-respend` — 

## `synth`

patakbuhin ang synthesis ng isang language pack

**Mga Argumento:**

- `pack` — isang 'module.path:get_pack' spec (hal. nmt_forge_crk.pack:get_pack) o entry-point name ng isang naka-install na pack (hal. crk)

**Mga Opsyon:**

- `--out` *(kinakailangan)* — 
- `--seed` — 
- `--limit` — 

## `run`

single-command reproducible training run

**Mga Argumento:**

- `config` — 

## `evaluate`

isara ang loop: i-decode ang battery ng config gamit ang SELECTED checkpoint ng run, i-score ito (mga CI, prereg-gated) at awtomatikong i-diagnose — walang manual decode

**Mga Argumento:**

- `run_manifest` — run-manifest.json na isinulat ng `nmt-forge run`

**Mga Opsyon:**

- `--config` — run-config path (default ay ang config na naka-embed sa run manifest); dapat may eval block
- `--out-hyps` — kung saan isusulat ang decoded battery hypotheses (default: katabi ng run manifest)

## `report`

i-render muli ang ulat sa payak na wika mula sa isang run o battery manifest

**Mga Argumento:**

- `manifest` —
