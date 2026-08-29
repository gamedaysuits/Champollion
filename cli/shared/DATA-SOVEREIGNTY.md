# Data Sovereignty Field Reference

> **Version:** 1.0
> **Date:** 2026-06-09
> **Schema:** `cli/shared/schemas/corpora-card.schema.json`
> **Audience:** Contributors, eval set authors, governance tool implementers, downstream consumers

This document describes the sovereignty, stewardship, submission, and usage restriction fields in the Champollion corpora card schema. For each field you will find the JSON key, type, allowed values, a plain-English description, and guidance on when to use `null`.

For corpus identity, license, contamination, and split fields see the schema directly.
For language card fields see [LANGUAGE-CARD-FIELDS.md](./LANGUAGE-CARD-FIELDS.md).
For attribution and license obligations see [ATTRIBUTION.md](./ATTRIBUTION.md).

---

## 1. Purpose

The sovereignty fields record **governance facts** about a corpus:

- Who has formal authority over this data (if anyone).
- What frameworks the governing body has invoked (if any).
- What the community has said about acceptable use.
- How steward authorization and prize evaluation work.

They do **not** record:

- Invented governance where none exists. If no governance body has been identified, `sovereignty` is `null`.
- Inferred classifications. A language's endangerment status does not automatically populate sovereignty fields.
- Platform opinions about how data *should* be governed. That's the community's decision.
- Legal interpretations. The `license` field records legal facts. Sovereignty records governance assertions.

The fields are forward-looking infrastructure. Many corpora will have `sovereignty: null` and `usageRestrictions` that simply defer to the license. That's correct — it means no governance body has asserted terms beyond what the license already says.

---

## 2. Standards Map

Each sovereignty-related field maps to one or more external standards. The table below shows which standard provides the conceptual basis for each field and where to find the standard's specification.

| Field / Concept | Primary Standard | Standard URL | Relationship |
|---|---|---|---|
| `sovereignty.frameworks` | CARE, Te Mana Raraunga, FAIR, IEEE 2890, community ownership-and-control assertions | See individual URLs below | Records which frameworks have been **explicitly invoked** by the governing body |
| `sovereignty.governanceOrg` | Community ownership | — | Who owns the data |
| `sovereignty.custodian` | Community possession | — | Who physically holds the data |
| `sovereignty.consentModel` | Community control, CARE Authority | [https://www.gida-global.org/care](https://www.gida-global.org/care) | Who controls access — maps to CARE's Authority to Control principle |
| `sovereignty.tkLabels[]` | Local Contexts TK/BC Labels | [https://localcontexts.org/](https://localcontexts.org/) | Community-applied labels from the Local Contexts Hub |
| `usageRestrictions.training` | DUO (Data Use Ontology), ODRL | [DUO](https://github.com/EBISPOT/DUO), [ODRL](https://www.w3.org/TR/odrl-model/) | `prohibited-by-license` maps to DUO:0000004 (no general methods research) and ODRL `odrl:prohibition`. `prohibited-by-community` maps to a governance assertion (no DUO equivalent — DUO is license-derived) |
| `usageRestrictions.commercialUse` | DUO:0000018 (not for profit), ODRL | [DUO](https://github.com/EBISPOT/DUO), [ODRL](https://www.w3.org/TR/odrl-model/) | `prohibited-by-license` maps to DUO:0000018 and ODRL `odrl:prohibition` with `odrl:commercialize` action |
| `usageRestrictions.redistribution` | ODRL `odrl:distribute` | [ODRL](https://www.w3.org/TR/odrl-model/) | Maps to an ODRL permission/prohibition on the `odrl:distribute` action |
| `usageRestrictions.communityNotes` | CARE Ethics | [https://www.gida-global.org/care](https://www.gida-global.org/care) | Maps to CARE's Ethics principle — ensuring legitimate concerns are surfaced |
| `doNotTrain` | IEEE 2890 | No public URL (IEEE standard, paywall) | Methodological constraint for evaluation data; IEEE 2890 §7.4 recommends flagging datasets not intended for model training |
| `stewardship.authorizationModel` | Community control | — | Community controls how evaluation access is granted |
| `submission.transfer.*` | Community ownership + possession, CARE Collective Benefit | [CARE](https://www.gida-global.org/care) | Transfer provisions mean the community owns and possesses the method. Revenue model maps to CARE Collective Benefit |
| `submission.admissibility.selfHostable` | Community possession | — | If the community can't run it independently, they don't possess it |

### Standard References

| Standard | Full Name | URL |
|---|---|---|
| ODRL | Open Digital Rights Language 2.2 | [https://www.w3.org/TR/odrl-model/](https://www.w3.org/TR/odrl-model/) |
| DUO | Data Use Ontology | [https://github.com/EBISPOT/DUO](https://github.com/EBISPOT/DUO) |
| Local Contexts | TK and BC Labels | [https://localcontexts.org/](https://localcontexts.org/) |
| CARE | Collective Benefit, Authority to Control, Responsibility, Ethics | [https://www.gida-global.org/care](https://www.gida-global.org/care) |
| IEEE 2890 | IEEE Standard for Recommended Practice for Provenance of Datasets | IEEE (paywall; no stable public URL) |
| Te Mana Raraunga | Māori Data Sovereignty Network | [https://www.temanararaunga.maori.nz/](https://www.temanararaunga.maori.nz/) |
| FAIR | Findable, Accessible, Interoperable, Reusable | [https://www.go-fair.org/fair-principles/](https://www.go-fair.org/fair-principles/) |

---

## 3. Three-Source Restriction Model

Usage restrictions in `usageRestrictions` use enum values that encode **who imposed the restriction**, not just what the restriction is. This is deliberate — compliance tools need to know whether a restriction is legally binding or advisory.

### The Three Sources

| Source | Enum suffix / value | Meaning | Legal force | Example |
|---|---|---|---|---|
| **License** | `prohibited-by-license` | The license text explicitly prohibits this use | Legally binding — violation is a license breach | CC-BY-NC-4.0 prohibits commercial use |
| **Community** | `prohibited-by-community` | A governance body has asserted this restriction, independent of the license | Advisory — not directly enforceable as contract, but ethically binding and may carry institutional consequences | A language trust requests no ML training, even though the license is CC-BY-4.0 |
| **Nobody** | `permitted` | No restriction from any source | Permitted under both license and community governance | CC-BY-4.0 corpus with no community governance body |

### Why the Source Matters

1. **Compliance automation.** A tool filtering datasets for training needs to know: "Is this a hard legal constraint or a community request?" Both should be respected, but they have different implications for institutional compliance workflows.

2. **Layered restrictions.** `usageRestrictions` **adds to** the license — it never weakens it. If the license says non-commercial, `commercialUse` should be `prohibited-by-license`. If the license permits commercial use but the community objects, `commercialUse` should be `prohibited-by-community`.

3. **Transparency.** Users see where each restriction comes from. No opaque "this is restricted" without knowing who said so and why.

### The `null` / Defer-to-License Pattern

Several `usageRestrictions` fields accept `null`. Null means: "No additional guidance beyond what the `license` field already says." This avoids restating what's already in the license.

| `usageRestrictions` field | When to use `null` |
|---|---|
| `commercialUse` | The license `commercial` boolean already captures the full picture. No community has added restrictions or context. |
| `redistribution` | The license `redistribution` boolean already captures the full picture. |

The `training` field is **required** (not nullable) because the training question is central to evaluation corpora and must always be explicitly answered.

---

## 4. `sovereignty` Field Reference

The `sovereignty` object records governance structures that actually exist for this data. It is `null` when no formal governance structures are in place. That's not a failure state — most reference corpora (`ref-*` type) will have `sovereignty: null`.

| Field | Type | Allowed Values | Description | When to use `null` |
|---|---|---|---|---|
| `sovereignty` | `object \| null` | — | Container for governance metadata. | No governance body has been identified. No frameworks have been invoked. No labels have been applied. |
| `.frameworks` | `array` of `string` | `"community-ownership-control"`, `"CARE"`, `"Te-Mana-Raraunga"`, `"FAIR"`, `"IEEE-2890"` | Data sovereignty frameworks the data creators or governing body have **explicitly invoked**. Only list frameworks where there is documented evidence of adoption. | *(Field is an array — use `[]` if sovereignty object exists but no frameworks have been invoked. But if no sovereignty object at all, the whole object is null.)* |
| `.governanceOrg` | `string \| null` | Free text | Organization or body with governance authority. For Indigenous-governed corpora, this is the language trust, tribal council, or delegated body. | No governance body has been identified or established. |
| `.custodian` | `string \| null` | Free text | Who physically holds the data. Distinct from `governanceOrg` — a university may be custodian while a community is the governance authority. | Custodian is the same as `source.publisher` (no need to repeat). |
| `.consentModel` | `string \| null` | `"per-submission"`, `"blanket"`, `"open-access"` | How consent is structured for use of this data in method evaluation. | No consent model has been established. |
| `.tkLabels` | `array` of objects | See sub-fields below | Local Contexts Traditional Knowledge or Biocultural Labels applied by the data's governing community. Empty array `[]` = sovereignty exists but no labels applied. | *(Field is an array — use `[]` when no labels applied.)* |
| `.tkLabels[].labelType` | `string` | TK/BC label codes (e.g., `"TK-A"`, `"TK-NC"`, `"BC-P"`) | Local Contexts label code. **Required** within each label entry. Only populated if the community has actually applied labels via the Local Contexts Hub. | *(Required — not nullable.)* |
| `.tkLabels[].projectId` | `string \| null` | Local Contexts Hub project ID | Enables dynamic label updates by communities without touching Champollion metadata. | Labels are referenced but not registered on the Hub. |
| `.tkLabels[].url` | `string \| null` (URI format) | URL | Direct link to the label on the Local Contexts Hub. | No Hub URL available. |
| `.notes` | `string \| null` | Free text | Governance context that structured fields can't capture. Use this for nuance. | No additional context needed. |

### Example: Sovereignty with active governance

```json
{
  "sovereignty": {
    "frameworks": ["community-ownership-control", "CARE"],
    "governanceOrg": "Plains Cree Language Trust (hypothetical)",
    "custodian": "University of Alberta — ALTLab",
    "consentModel": "per-submission",
    "tkLabels": [
      {
        "labelType": "TK-A",
        "projectId": "abc-123",
        "url": "https://localcontextshub.org/projects/abc-123/labels/TK-A"
      }
    ],
    "notes": "Governance body identification in progress."
  }
}
```

### Example: No governance (most reference corpora)

```json
{
  "sovereignty": null
}
```

---

## 5. `usageRestrictions` Field Reference

The `usageRestrictions` object records community assertions and guidance beyond what the `license` field captures. Required for `eval`-type cards. The license records legal facts. `usageRestrictions` records what communities have said — even when it differs from or supplements the license.

| Field | Type | Allowed Values | Description | When to use `null` |
|---|---|---|---|---|
| `usageRestrictions` | `object \| null` | — | Container for usage guidance. Required for eval-type cards. | Only null for reference-type cards where no community guidance exists beyond the license. |
| `.training` | `string` | `"prohibited-by-license"`, `"prohibited-by-community"`, `"discouraged"`, `"permitted"` | Whether this data may be used for ML model training. The enum value identifies **who** imposed the restriction. **Required.** | *(Not nullable — must always be explicitly set.)* |
| `.commercialUse` | `string \| null` | `"prohibited-by-license"`, `"prohibited-by-community"`, `"requires-agreement"`, `"permitted"` | Commercial use restrictions. Identifies source of restriction. | Defer to `license.commercial` — no additional community guidance exists. |
| `.redistribution` | `string \| null` | `"prohibited"`, `"same-terms"`, `"permitted"` | Redistribution restrictions. | Defer to `license.redistribution` — no additional community guidance exists. |
| `.communityNotes` | `string \| null` | Free text | Documented community concerns, context, or guidance that users should know about — even if the license technically permits the use. This is where legitimate community objections get surfaced. | No community concerns documented. |

### `training` Enum Values

| Value | Who decided | Meaning | Consistency rule |
|---|---|---|---|
| `prohibited-by-license` | License author | The license text explicitly prohibits use in ML training | `doNotTrain` must be `true` |
| `prohibited-by-community` | Governance body | A community governance body prohibits training use, independent of license terms | `doNotTrain` must be `true` |
| `discouraged` | Community / custodian | Not prohibited, but the data custodians prefer it not be used for training | `doNotTrain` may be `true` or `false` depending on methodological need |
| `permitted` | Nobody (no restriction) | No restriction from any source | `doNotTrain` must not be `true` unless the corpus is also an eval set (see §8) |

### `commercialUse` Enum Values

| Value | Who decided | Meaning |
|---|---|---|
| `prohibited-by-license` | License author | License terms prohibit commercial use (e.g., CC-NC) |
| `prohibited-by-community` | Governance body | Community prohibits commercial use, even if license permits |
| `requires-agreement` | Governance body / custodian | Commercial use is possible but requires a separate agreement |
| `permitted` | Nobody (no restriction) | No commercial use restrictions from any source |

### Example: Community-governed eval corpus

```json
{
  "usageRestrictions": {
    "training": "prohibited-by-community",
    "commercialUse": "prohibited-by-community",
    "redistribution": null,
    "communityNotes": "Plains Cree is severely endangered; data created by L1 educators for educational purposes. Community interests in language revitalization should be considered."
  }
}
```

### Example: Open reference corpus with no extra restrictions

```json
{
  "usageRestrictions": {
    "training": "permitted",
    "commercialUse": null,
    "redistribution": null,
    "communityNotes": null
  }
}
```

---

## 6. Prize Corpus Model

Prize evaluation sets use four coordinated structures to enable secure, community-controlled benchmarking. These four structures are defined across separate fields in the corpora card schema.

### The Four Components

| Component | Schema field | Visibility | Purpose |
|---|---|---|---|
| **Dev split** | `dev` | Public | Local development and prompt tuning. Distributed openly. |
| **Public test** | `test` | Public | The non-secured portion of the test corpus. Published for reproducibility. Distinct from `dev` — `test` is for scoring, `dev` is for iteration. |
| **Secret test** | `secretTest` | Encrypted | Cryptographically secured holdout. Encrypted at rest, decrypted only inside the air-gapped evaluation sandbox. Never distributed. Steward authorization (TSS threshold signature) required for each evaluation run. |
| **Stewardship** | `stewardship` | Public metadata | Community steward roster, multi-signature threshold, and authorization model. Stewards are chosen by the language community. |

### How They Work Together

```
┌────────────────────────────────────────────────────────────────────┐
│  Researcher                                                        │
│                                                                    │
│  1. Downloads dev split → iterates on method locally               │
│  2. Downloads test split → validates scores locally                │
│  3. Submits self-hostable method for prize evaluation               │
│                                                                    │
├────────────────────────────────────────────────────────────────────┤
│  Stewards (community-chosen, minimum 5)                            │
│                                                                    │
│  4. Review submission                                              │
│  5. Threshold-sign authorization (e.g., 3 of 5)                   │
│                                                                    │
├────────────────────────────────────────────────────────────────────┤
│  Air-gapped sandbox (no network)                                   │
│                                                                    │
│  6. Decrypts secretTest with steward-authorized key                │
│  7. Runs submitted method against secret test data                 │
│  8. Returns scores — never exposes test data                       │
└────────────────────────────────────────────────────────────────────┘
```

### Conditional Requirements

The schema enforces: when `secretTest.status` is `"active"`, the card **must** have:
- A `stewardship` object with at least 5 stewards
- `stewardship.threshold` and `stewardship.authorizationModel` defined

This is a schema-level `allOf` conditional, not a soft guideline.

### `submission` — The Prize Deal

The `submission` field (§7) defines what happens when a method is accepted: what transfers to the governance org, what the researcher retains, and what methods are admissible.

> [!NOTE]
> The sandbox evaluation infrastructure (VPS endpoints, key ceremonies, TSS implementation) is not yet established. The schema fields are forward-looking — they define the data model for when infrastructure is deployed. `secretTest.serverEndpoint` and steward `publicKey` fields will be `null` until then.

---

## 7. Admissibility Rules

The `submission.admissibility` fields define what methods are eligible for prize evaluation. These constraints are technical, not arbitrary — they flow directly from the community-possession requirement (the community must be able to hold and run the method itself) and the air-gapped sandbox architecture.

### Why Coached API Calls Are Inadmissible

A "coached API call" is a method that wraps a third-party API (e.g., GPT-4, Google Translate) with prompt engineering. These are inadmissible for prize evaluation because:

1. **Community-possession violation.** The community cannot possess a method that depends on someone else's API. When the API key expires, the method dies. The community doesn't control the model, its weights, or its availability.

2. **Non-reproducible.** API providers change models, pricing, and availability without notice. A score measured today may not be reproducible tomorrow.

3. **Sandbox incompatibility.** The evaluation sandbox is air-gapped — no network access. Methods that phone home cannot execute.

### What "Self-Hostable" Means

`admissibility.selfHostable: true` requires that the submitted method can run on community infrastructure without any third-party dependencies. Concretely:

- All model weights must be included in the submission
- All source code must be included
- No network calls during inference
- No license-restricted runtime dependencies that the community cannot independently obtain
- The community can inspect, modify, and deploy the method on their own hardware

### Community-Possession Logic

The community-possession principle states that the community must physically hold the data and tools. In the context of prize evaluation:

| What | Possession requirement |
|---|---|
| Evaluation data (secretTest) | Encrypted, held by stewards. Decryption requires threshold signature. |
| Submitted method (source + weights) | Transferred to governance org upon acceptance. Community possesses every byte. |
| Evaluation infrastructure | Community-controlled sandbox. Not a platform service. |

### Air-Gapped Sandbox Architecture

The evaluation sandbox operates with no network access:

- Methods are loaded as self-contained packages
- Secret test data is decrypted inside the sandbox
- Scoring happens locally — results exit, data does not
- The sandbox is a technical enforcement of Possession — if it can't run without network, the community doesn't possess it

### `submission.admissibility` Fields

| Field | Type | Description |
|---|---|---|
| `selfHostable` | `boolean` | Method must run on community infrastructure without any third-party dependencies. |
| `inadmissible` | `array` of `string` | Explicitly inadmissible method types. e.g., `"coached-api-calls"`, `"proprietary-api-wrappers"`, `"external-api-dependencies"`. |
| `notes` | `string \| null` | Rationale for admissibility constraints. Should reference community possession and the air-gapped sandbox architecture. |

### `submission.transfer` Fields — What the Community Gets

| Field | Type | Description | Sovereignty/CARE mapping |
|---|---|---|---|
| `sourceCode` | `boolean` | Source code ownership transfers to governance org | Community ownership + possession |
| `modelWeights` | `boolean` | Trained model weights transfer to governance org | Community possession |
| `deploymentRights` | `boolean` | Exclusive deployment rights transfer to governance org | Community control |
| `revenueModel` | `string \| null` | Community-set terms for any commercial deployment, held by the governance org (e.g., `"commercial use by written permission only"`) — Champollion is non-commercial and takes no share | CARE Collective Benefit |

### `submission.retained` Fields — What the Researcher Keeps

| Field | Type | Description |
|---|---|---|
| `publicationRights` | `boolean` | Right to publish about the method |
| `techniqueReuse` | `boolean` | Right to reuse techniques and architectural ideas in other work |
| `attribution` | `boolean` | Attribution credit as the method's creator |

---

## 8. `doNotTrain` vs `usageRestrictions.training`

These two fields record two independent facts. They share the word "training" but operate on different axes.

### `doNotTrain`: Methodological Constraint

`doNotTrain` is a **boolean** consumed by the evaluation harness. When `true`, it means: "This data must not be used for training any ML model."

For evaluation corpora, the primary reason is **methodological** — if the test data leaks into a model's training set, the benchmark is contaminated and scores become meaningless. This is a data science concern, not a governance one.

### `usageRestrictions.training`: Governance / Legal Fact

`usageRestrictions.training` records **who** said training is restricted and **why**:

- `"prohibited-by-license"` — the license prohibits it (legal fact)
- `"prohibited-by-community"` — a governance body prohibits it (governance assertion)
- `"discouraged"` — not prohibited but unwanted
- `"permitted"` — no restriction

### Independence of the Two Axes

| Scenario | `doNotTrain` | `usageRestrictions.training` | Why both values coexist |
|---|---|---|---|
| Eval corpus, license permits training | `true` | `"permitted"` | Training is methodologically invalid (contaminates the benchmark) but the license doesn't prohibit it. |
| Eval corpus, community prohibits training | `true` | `"prohibited-by-community"` | Both axes agree: don't train. But for different reasons — one methodological, one governance. |
| Reference corpus, NC license | `false` | `"prohibited-by-license"` | Not an eval set (no methodological concern), but the license prohibits training. |
| Open reference corpus | `false` | `"permitted"` | No restrictions from either axis. |

### Consistency Rule

The schema description states: "These must be consistent: if `doNotTrain` is `true`, `usageRestrictions.training` must not be `'permitted'`" — **except** when `doNotTrain` is `true` for purely methodological reasons on an eval corpus where the license genuinely permits training. In that case, `usageRestrictions.training` being `"permitted"` is accurate (no one prohibited it; we're just not doing it because it would contaminate the eval).

> [!IMPORTANT]
> If `usageRestrictions.training` is `"prohibited-by-license"` or `"prohibited-by-community"`, then `doNotTrain` **must** be `true`. The converse is not always true — `doNotTrain` can be `true` for methodological reasons alone.

---

## 9. Croissant Export Mapping

When corpora card metadata is exported to [Croissant ML 1.1](https://mlcommons.org/croissant/) JSON-LD, the sovereignty and usage restriction fields map as follows. Croissant uses Schema.org vocabulary, ODRL policies, and DUO codes.

### Field-by-Field Mapping

| Corpora card field | Croissant ML 1.1 property | Notes |
|---|---|---|
| `license.spdx` | `schema:license` | Direct mapping. SPDX identifier or URL to license text. |
| `doNotTrain` | `schema:usageInfo` | When `true`, emit `"This dataset must not be used for ML model training."` in `schema:usageInfo`. |
| `usageRestrictions.training = "prohibited-by-license"` | ODRL `odrl:prohibition` with `odrl:action = odrl:use` scoped to training | Emit an ODRL policy prohibiting training use. Also emit DUO:0000004 (no general methods research) as `schema:additionalType`. |
| `usageRestrictions.training = "prohibited-by-community"` | `schema:usageInfo` + custom annotation | No standard ODRL/DUO mapping for community assertions. Emit in `schema:usageInfo` as free text with `schema:creator` pointing to `sovereignty.governanceOrg`. |
| `usageRestrictions.commercialUse = "prohibited-by-license"` | ODRL `odrl:prohibition` with `odrl:action = odrl:commercialize` | Standard ODRL mapping. Also emit DUO:0000018 (not for profit, non-commercial use only). |
| `usageRestrictions.commercialUse = "prohibited-by-community"` | `schema:usageInfo` | Community assertion — no ODRL equivalent. Document in `schema:usageInfo`. |
| `usageRestrictions.redistribution = "prohibited"` | ODRL `odrl:prohibition` with `odrl:action = odrl:distribute` | Standard ODRL mapping. |
| `usageRestrictions.redistribution = "same-terms"` | ODRL `odrl:duty` with `odrl:action = odrl:shareAlike` | Maps to share-alike duty. |
| `sovereignty.frameworks` | `schema:additionalType` (array) | Emit framework URIs as type annotations on the dataset. |
| `sovereignty.governanceOrg` | `schema:maintainer` or `schema:funder` | Use `schema:maintainer` for governance authority. Distinct from `schema:publisher` (which maps to `source.publisher`). |
| `sovereignty.tkLabels[]` | `schema:usageInfo` + `schema:url` | No native Croissant support for TK Labels. Emit label codes in `schema:usageInfo` and link to Local Contexts Hub URLs. |
| `sovereignty.consentModel` | `schema:conditionsOfAccess` | Maps to Croissant's access conditions. `"per-submission"` → `"Authorization required per use."` |
| `usageRestrictions.communityNotes` | `schema:usageInfo` (appended) | Free text appended to usage info. |

### DUO Code Mapping

| `usageRestrictions` value | DUO Code | DUO Term |
|---|---|---|
| `training = "prohibited-by-license"` | DUO:0000004 | No general methods research |
| `commercialUse = "prohibited-by-license"` | DUO:0000018 | Not for profit, non-commercial use only |
| `commercialUse = "requires-agreement"` | DUO:0000021 | Ethics approval required |

> [!NOTE]
> DUO codes only apply to license-derived restrictions. Community governance assertions (`*-by-community`) have no DUO equivalent — DUO is designed for consent-based data access in biomedical contexts, not Indigenous data sovereignty. Community assertions are emitted as `schema:usageInfo` free text.

### ODRL Policy Structure

```json
{
  "@context": "http://www.w3.org/ns/odrl.jsonld",
  "@type": "odrl:Set",
  "odrl:prohibition": [
    {
      "odrl:action": "odrl:use",
      "odrl:constraint": {
        "odrl:leftOperand": "odrl:purpose",
        "odrl:operator": "odrl:eq",
        "odrl:rightOperand": "model-training"
      }
    }
  ]
}
```

> [!IMPORTANT]
> Croissant export is not yet implemented. The mappings above are the design specification. Implementation is a follow-up task.

---

## 10. Anti-Patterns

These are documented mistakes to avoid when populating sovereignty fields. Each anti-pattern is paired with the correct approach.

### Don't invent governance

**Wrong:** Populating `sovereignty.governanceOrg` with a best-guess organization because a governance body "probably" exists.

**Right:** If no governance body has been identified, `sovereignty` is `null`. The `sovereignty.notes` field can document "Governance body identification in progress" if there's an active effort, but the structured fields remain empty until there's a confirmed answer.

### Don't derive sovereignty from vitality

**Wrong:** Seeing that a language is `"severely-endangered"` in `vitality.unescoStatus` and automatically populating sovereignty frameworks, TK Labels, or consent models.

**Right:** Sovereignty fields are populated from **documented evidence of governance adoption** — a formal resolution, a published data governance policy, or a registered Local Contexts Hub project. Endangerment status and sovereignty are orthogonal. A safe, widely-spoken language may have strong data sovereignty frameworks (e.g., Māori → Te Mana Raraunga). A critically endangered language may have no formal governance body.

### Don't assign TK Labels

**Wrong:** A Champollion contributor decides that a corpus "should" have a TK-NC (Non-Commercial) label and adds it to `sovereignty.tkLabels`.

**Right:** TK and BC Labels are **community-asserted**. They can only be applied by the data's governing community through the [Local Contexts Hub](https://localcontexts.org/). Champollion records labels that communities have applied — it never assigns them. If no labels have been applied, use an empty array `[]`.

### Don't suppress community objections

**Wrong:** A corpus has a permissive license (CC-BY-4.0) and the contributor sets `communityNotes: null` even though the community has expressed concerns about training use.

**Right:** `usageRestrictions.communityNotes` exists precisely to surface legitimate community concerns that the license doesn't capture. If a community has documented objections, record them — even when the license technically permits the use. The CARE Ethics principle requires surfacing these concerns.

### Don't duplicate the license

**Wrong:** Setting `usageRestrictions.commercialUse` to `"prohibited-by-license"` and also writing "non-commercial use only" in `communityNotes` and also noting it in `sovereignty.notes`.

**Right:** `usageRestrictions` **adds to** the license, it doesn't restate it. If the license already captures a restriction, use `null` for the corresponding `usageRestrictions` field (the defer-to-license pattern, §3). Only populate `usageRestrictions` fields when there's information **beyond** what the license says.

### Don't conflate custodian with governance

**Wrong:** Setting `sovereignty.governanceOrg` to `"University of Alberta"` because the university hosts the data.

**Right:** `governanceOrg` is who has governance **authority**. `custodian` is who physically holds the data. A university may be custodian while a tribal council is the governance authority. If there's no distinct custodian (i.e., the `source.publisher` is also the custodian), set `custodian` to `null`.

### Don't populate sovereignty for reference corpora that don't need it

**Wrong:** Adding a skeleton `sovereignty` object with all-null fields to a FLORES+ reference card "just in case."

**Right:** If no governance structures exist, `sovereignty` is `null`. The schema accepts null. Don't create empty shells.

---

## 11. SQLite Design Note

Corpora metadata follows the atlas data architecture, where the **atlas store** (`cli/data/atlas.db`, projected into the language cards) is the single source of truth (SSOT) for structured data. (The earlier v2 database, `cli/data/champollion.db`, was retired and deleted 2026-08-18 — see `shared/cldf/deprecations.json`.) In this model:

- Structured data lives in SQLite (the atlas store, built by the ingest pipeline)
- JSON cards (language cards, corpora cards) become **generated output** — projected from the store, not edited directly
- Provenance is pinned per-value in the store, not per-card

For corpora cards specifically, this means:

| Current state | Future state |
|---|---|
| Corpora cards are hand-authored JSON files | Corpora metadata is stored in SQLite with sovereignty, stewardship, and restriction facts as structured rows |
| Schema validation checks JSON files directly | Schema validation runs against database-generated output |
| Sovereignty fields are populated by contributors editing JSON | Sovereignty facts are entered via ingestion scripts and validated against the database |

**This is a follow-up implementation.** The current corpora card schema defines the data model. The SQLite migration for corpora metadata has not yet been built. Until it is, corpora cards remain hand-authored JSON files validated against `corpora-card.schema.json`.

The data architecture behind this — the SQLite schema, the ingestion
pipeline, the CLDF strategy and the migration plan — is internal planning
material and is not published. The parts that affect anyone consuming this
package are the schemas shipped alongside it in `schemas/`, and the public
data-stewardship documentation at
<https://champollion.dev/docs/network/sovereignty/data-sovereignty>.
