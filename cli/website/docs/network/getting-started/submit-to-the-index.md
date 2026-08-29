---
sidebar_position: 0
title: Submit to the Index
description: "Propose a dataset, resource, method, human translation service, or external result — or suggest a language-card correction. Every submission is human-reviewed for IP, license, and sovereignty compliance — nothing is auto-approved."
related:
  - label: "Submit a Method"
    to: /docs/network/getting-started/submit-a-method
    kind: guide
    note: "Already have a benchmark run? Publish the run card instead."
  - label: "Registering Corpora"
    to: /docs/network/sovereignty/registering-corpora
    kind: guide
    note: "Exposure tiers for corpora you own"
  - label: "Data Sovereignty"
    to: /docs/network/sovereignty/data-sovereignty
    kind: doc
  - label: "Honest Limitations"
    to: /docs/network/honest-limitations
    kind: doc
---

# Submit to the Index

> **Executive Summary.** Propose something for the Champollion index — a benchmark, a resource, a translation method, a human translation service, or an external published result. You file a short structured form (in your browser or from the CLI); a **maintainer reviews every submission by hand** for IP, license, and community/sovereignty compliance before anything is added. **Nothing is auto-approved.**

The index is the shared map: the datasets methods are benchmarked on, the dictionaries and tools that help, the methods themselves, the people who translate by hand, and the results others have published. Anyone can propose an addition. Because this is infrastructure for language communities, every proposal passes through a human review gate first.

---

## What you can submit

| Type | What it is | What we add |
|---|---|---|
| **Benchmark / dataset** | An evaluation corpus or benchmark | A metadata card + a *fetch-from-source* pointer — never the corpus content |
| **Resource** | A dictionary, archive, app, FST (morphological analyzer), or tool | A listing with a pointer + access level (open / restricted / consent-required) |
| **Translation method** | An MT engine, LLM provider, or pipeline | A method-registry entry so it can be run and benchmarked |
| **Human translation service** | An opt-in community office, agency, or individual translator | A per-pair listing (contact details stay out-of-band — never in the public issue) |
| **External published result** | A score reported by another system or paper | A **citation** — external results are cited, never re-hosted or re-ranked as our own measurement |
| **Language-card correction** | Something on a [language card](/catalogue) is wrong, outdated, or missing — a speaker estimate, a status, a script, a resource we haven't listed | A **cited fix applied at the data source** (cards are generated, so the correction sticks); when sources disagree, the card shows all of them, attributed |

Every language card also carries a **"Suggest a correction or addition"** link
that opens the correction form with the language pre-filled.

**Community removal and restriction requests.** If you are a community member
or authority and want data about your language restricted or removed, use the
correction form (or contact the maintainer out-of-band if you prefer it not be
public). These go through the [sovereignty review](/docs/network/sovereignty/data-sovereignty)
with priority — no citation required.

---

## How review works

This is the important part: **submissions are reviewed by a human, not a robot.** When you submit, you open a GitHub issue. That issue is the review queue. A maintainer reads it and checks it against the project's rules before adding anything:

- **IP & license.** We must be allowed to list it. Non-commercial, no-redistribute, or unclear-license material can still be *catalogued*, but it is walled out of any commercial / prize / public-fetch lane.
- **Community & sovereignty.** Indigenous and community language data is listed only with the community's consent. A provider or custodian is never named publicly before they've confirmed.
- **We never host corpus content.** Datasets are listed as metadata plus a pointer to where the data is fetched from. **Do not paste source/reference sentences into a submission.**
- **No personal data.** No emails, phone numbers, or other PII in a public issue. For human translation services, contact details are supplied to the maintainer out-of-band.
- **Scope.** Bible / liturgical and other colonial-imposition corpora are out of scope and will be declined.

Every form ends with a required attestation:

> *"I confirm this is publicly listable, contains NO corpus content or personal data, and respects the source's license and any community/sovereignty restrictions."*

---

## Two ways to submit

### From your browser

Open the issue chooser and pick the form that matches what you're submitting:

➡️ **[Open a submission form on GitHub](https://github.com/gamedaysuits/Champollion/issues/new/choose)**

Each form asks only for what the matching index needs (name, languages/pairs, license, source URL, and so on) and the attestation checkbox.

### From the CLI

If you have the [champollion CLI](/docs/network/getting-started/submit-a-method), `champollion submit` gathers the fields and hands you a **pre-filled** version of the same GitHub form:

```bash
# Interactive — pick a type and answer the prompts
champollion submit

# See the submission types
champollion submit --list

# Fully scripted (prints a pre-filled GitHub issue URL)
champollion submit --yes --type dataset --attest \
  --field dataset-name="GlobalVoices eng-amh" \
  --field pairs=eng-amh \
  --field license=CC-BY-4.0 \
  --field source-url=https://globalvoices.org
```

The CLI prints a URL — open it, review the attestation in the browser, and submit. Add `--out submission.json` to also save a local, content-free copy of what you're proposing. The CLI never uploads anything itself and never writes to the index.

---

## What happens after you submit

1. Your submission arrives as a GitHub issue — the review queue.
2. A maintainer reviews it against the IP / license / sovereignty rules above.
3. **If accepted:** the maintainer adds the entry to the relevant source-of-truth (the dataset registry, a card, the method or human-service registry, or the external-results catalogue) through a normal change, and labels the issue **accepted**.
4. **If it can't be listed as-is:** the maintainer labels it **declined** (or asks for more information) with the reason.

There is no automatic merge and no automatic publication. A person makes the call every time.

---

## See Also

- [Submit a Method](/docs/network/getting-started/submit-a-method) — already have a benchmark run? Publish the run card directly.
- [Registering Corpora](/docs/network/sovereignty/registering-corpora) — exposure tiers (local / private / public / sealed) for corpora you own.
- [Data Sovereignty](/docs/network/sovereignty/data-sovereignty) — how community control of language data works here.
- [For Language Communities](/docs/network/community/for-language-communities) — partnership, consent, and key custody.

