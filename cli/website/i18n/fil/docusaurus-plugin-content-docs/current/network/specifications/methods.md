---
sidebar_position: 4
title: "Interface ng Method"
related:
  - label: "Submit a Method"
    to: /docs/network/getting-started/submit-a-method
    kind: guide
    note: "Put this interface on the leaderboard"
  - label: "Eval Harness v2.0"
    to: /docs/network/specifications/harness
    kind: spec
  - label: "Run Card Specification"
    to: /docs/network/specifications/run-card
    kind: spec
  - label: "Cookbook: FST-Gated Translation Pipeline"
    to: /docs/network/tutorials/fst-gated-pipeline
    kind: cookbook
    note: "A full method, built end-to-end"
---

# Pinagsasaluhang Interface ng Pamamaraan

> **Ehekutibong Buod.** Tinutukoy ng pahinang ito ang protocol na `TranslationMethod` na dapat ipatupad ng lahat ng pamamaraan ng Network, ang anim na klase ng pamamaraan (`raw-llm`, `coached-llm`, `pipeline`, `custom-plugin`, `api`, `human`), ang orthogonal na axis ng **paradigm** (`rule-based`, `statistical`, `neural-nmt`, `llm`, `hybrid`, …) na ginagawang maihahambing sa iba’t ibang system ang *paraan ng pagsasalin ng isang pamamaraan*, ang format ng method plugin, at ang **mga klase ng dependency** (S/O/A1/A2/X) na tumutukoy kung maaaring tumakbo ang isang pamamaraan sa evaluation sandbox at maging kwalipikado para sa mga premyo. Ang mga ito ay tatlong magkakahiwalay na axis. Maaaring i-benchmark ang anumang approach na nagpapatupad ng protocol na ito; ang mga dependency nito ang tumutukoy kung saan ito maaaring makipagkompetensiya.

May pinagsasaluhang konsepto ang eval harness at champollion ng **pamamaraan ng pagsasalin**. Ang pamamaraan ay anumang proseso na tumatanggap ng source text at gumagawa ng isinaling text — direkta man itong LLM call, multi-stage pipeline, third-party API, o taong tagasalin.

## Arkitektura

```
Method Plugin (v2 Spec)
├── method.json           ← Manifest (name, class, entry_point, dependencies, metadata)
├── method_card.json      ← Leaderboard description (what, not how)
├── pipeline.py           ← Python module implementing TranslationMethod
└── (optional helpers)    ← Additional Python modules
```

Nilo-load sa pamamagitan ng `--method path/to/dir`. Walang awtomatikong dini-discover ang harness.

## Dalawang System, Isang Interface

| | Eval Harness | champollion |
|---|---|---|
| **Wika** | Python | Node.js |
| **Entry point** | `translate.py` | `translate.js` |
| **Interface** | protocol na `TranslationMethod` | config na `methodPlugin` |
| **Layunin** | Batch evaluation na may scoring | Live localization sa dev/CI |
| **Output** | Run card na may mga metric | Isinaling locale files |

Ang pamamaraang sumusuporta sa parehong system ay nagbibigay ng dalawang entry point — isa para sa bawat language runtime. Ang **method card** ang tulay: inilalarawan nito ang pamamaraan sa format na nauunawaan ng parehong system.

## Method Card {#method-card}

Inilalarawan ng method card kung *ano* ang isang pamamaraan ng pagsasalin nang hindi inilalantad ang proprietary details tulad ng buong system prompt. Sinasagot nito ang:

- Anong klase ng pamamaraan ito? (raw LLM, coached LLM, pipeline, API, atbp.)
- Anong **paradigm** ang ginagamit nito? (rule-based, statistical, neural-nmt, llm, hybrid)
- Anong mga tool ang ginagamit nito? (FST analyzer, dictionary, atbp.)
- Open source ba ang implementation?
- Anong mga language pair ang sinusuportahan nito?

Tingnan ang [Spec ng Method Card](/docs/network/specifications/methods#method-card) para sa buong JSON schema.

### Halimbawa

```json
{
  "method_id": "fst-gated-v8",
  "name": "FST-Gated Coached Translation v8",
  "class": "pipeline",
  "paradigm": "hybrid",
  "description": "LLM translation with morphological validation. Failed words are retried with FST feedback.",
  "author": "Curtis Forbes",
  "tools_used": ["HFST morphological analyzer", "Wolvengrey dictionary"],
  "open_source": false,
  "dependency_class": "A2",
  "supported_pairs": ["eng>crk"]
}
```

Binubuod ng field na `dependency_class` kung ano ang kailangan ng pamamaraan upang tumakbo at mailipat — tingnan ang [Validity ng Pamamaraan at mga Klase ng Dependency](#method-validity-and-dependency-classes) sa ibaba. Inilalagay ng field na `paradigm` ang pamamaraan sa **paradigm axis** (dito `hybrid`: isang LLM na ginagate ng rule-based FST) — tingnan ang [Mga Paradigm](#paradigms) sa ibaba.

### Mga Klase ng Pamamaraan

| Klase | Paglalarawan |
|-------|-------------|
| `raw-llm` | Direktang LLM call na may minimal na instruction |
| `coached-llm` | LLM na may structured prompt, mga halimbawa, at constraints |
| `pipeline` | Multi-stage pipeline na may deterministic components |
| `custom-plugin` | External process na nagpapatupad ng protocol na `TranslationMethod` |
| `api` | Third-party translation API (Google Translate, DeepL, atbp.) |
| `human` | Pagsasalin ng tao (para sa pagtatakda ng mga baseline) |

### Mga Paradigm {#paradigms}

Ang **paradigm** ay ikatlong, hiwalay na axis: *kung paano nagsasalin ang isang pamamaraan sa algorithmic na antas*. Orthogonal ito sa parehong method class at dependency class. LLM-centric ang method class lamang — parehong napupunta sa `pipeline`/`api` ang isang rule-based [Apertium](https://www.apertium.org/) system at Google Translate, kaya hindi makikita ang "rule-based vs neural" kung wala ito. Ginagawa ng paradigm axis na first-class at filterable sa leaderboard ang paghahambing na iyon.

| Paradigm | Paglalarawan | Mga Halimbawa |
|----------|-------------|----------|
| `rule-based` | Finite-state transducers, hand-written grammars, morphological transfer | Apertium, GiellaLT FST generation |
| `statistical` | Phrase-based / statistical MT (SMT) na natutunan mula sa parallel corpora | classic Moses |
| `neural-nmt` | Isang dedikadong neural encoder–decoder MT model | Google Translate, DeepL, Microsoft Translator, OPUS-MT, LibreTranslate, Tilde MT, Translated (Lara) |
| `llm` | Isang general-purpose large language model na pinrompt upang magsalin | isang raw o coached GPT / Claude / Gemini call |
| `hybrid` | Pinagsasama ang dalawa o higit pang paradigm sa isang pamamaraan | isang LLM na ginagate ng rule-based FST (crk-translate); NMT + rule-based post-editing |
| `human` | Pagsasalin ng tao (baseline sa antas ng paradigm) | baseline ng tagasalin ng komunidad |
| `unknown` | Hindi tinukoy — walang idineklarang paradigm ang card | back-compat default para sa mga card bago ang paradigm |

Magkakahiwalay ang mga axis. Ilang ginawang halimbawa:

| Pamamaraan | `class` | `paradigm` | `dependency_class` |
|--------|---------|-----------|--------------------|
| Google Translate | `api` | `neural-nmt` | A2 |
| Tilde MT / Translated (Lara) | `api` | `neural-nmt` | A2 |
| LibreTranslate (self-hosted, OSS) | `api` | `neural-nmt` | O |
| Apertium | `pipeline` | `rule-based` | O |
| crk-translate (FST-gated, LLM-coached) | `pipeline` | `hybrid` | A2 |
| Raw GPT call | `raw-llm` | `llm` | A1 |

**Optional** ang paradigm sa isang method card; ang absent na paradigm ay itinatala bilang `unknown` (hindi nito kailanman hinaharangan ang publishing — additive ang axis). Ang enum sa itaas ang canonical at suportadong vocabulary, na ine-enforce ng harness (`config.VALID_PARADIGMS`). Dahil app-side ang enforcement sa halip na database constraint, maaaring magdagdag ng mga bagong paradigm sa hinaharap nang walang migration; tanging ang pagpapalit ng pangalan o pag-aalis ng value kapag umaasa na rito ang mga pamamaraan ang magastos.

## Validity ng Pamamaraan at mga Klase ng Dependency {#method-validity-and-dependency-classes}

Ang isang pamamaraan ay kasing-runnable at kasing-transferable lamang ng pinaka-hindi available nitong dependency. Dalawang mekanismo ng Network ang nakadepende sa eksaktong pagkaalam kung ano ang kailangan ng isang pamamaraan:

1. **Sandboxed evaluation** ([Benchmark Specification §8.2](/docs/network/specifications/benchmark)) — nagmumula ang opisyal na gold-standard scores sa sandbox na ang network policy ay **default-deny**. Ang pamamaraang tahimik na nangangailangan ng external service ay hindi makapagbibigay ng opisyal na score.
2. **Prize transfer** ([Prize Specification](/docs/network/specifications/prizes)) — ang mga prize-winning method ay inililipat sa governance organization ng language community. Ang pamamaraang may bundled content na walang karapatang isama ng submitter ay hindi maaaring mailipat nang legal. Dapat hawak ng submitter (o naibigay sa kanya) ang mga karapatan sa lahat ng nasa kahon.

Upang gawing mechanical sa halip na ad hoc ang parehong check, nagdedeklara ang bawat pamamaraan ng **dependency class**, na derived mula sa **dependency manifest** sa `method.json`.

> **Tala sa pagpapangalan — tatlong magkakahiwalay na axis.** Inilalarawan ng *method class* (§sa itaas: `raw-llm`, `pipeline`, …) ang *anyo* ng isang pamamaraan — ang interface contract na ipinapakita nito. Inilalarawan ng *paradigm* ([§Mga Paradigm](#paradigms): `rule-based`, `neural-nmt`, `llm`, …) kung *paano ito nagsasalin sa algorithmic na paraan*. Inilalarawan ng *dependency class* (seksyong ito) kung *ano ang kailangan nito upang tumakbo at mailipat*. Orthogonal ang tatlo: ang pamamaraang `pipeline` ay maaaring `rule-based` o `hybrid`, at maaaring maging anumang dependency class. (Sadyang hiwalay ang class at paradigm dahil LLM-centric ang class lamang — hindi nito masasabi ang rule-based system mula sa neural system kapag parehong nagpapakita bilang `pipeline` o `api`.)

### Ang Limang Klase ng Dependency

| Klase | Pangalan | Depinisyon | Runnable sa sandbox? | Kwalipikado sa premyo? |
|-------|------|-----------|-------------------|-----------------|
| **S** | Self-contained | Lahat ng code, data, models, at weights ay kasama sa loob ng method directory, sa ilalim ng mga lisensyang nagpapahintulot ng redistribution at community transfer. | ✅ Oo, as-is | ✅ Oo |
| **O** | Open external | Umaasa sa externally hosted artifacts sa ilalim ng open licenses na nagpapahintulot ng redistribution (kabilang ang copyleft licenses tulad ng AGPL) — hal., FST na dinownload sa install time. | ✅ Oo — pinned ang mga artifact at **mino-mirror sa submission** | ✅ Oo, may license-compatibility conditions: pinananatili ang copyleft terms sa buong transfer, at natatanggap ng komunidad ang parehong mga karapatang ibinibigay ng lisensya sa lahat |
| **A1** | API-dependent, substitutable | Nangangailangan ng runtime LLM inference, kung saan ang model ay **substitutable configuration** — maaaring ipasok ang anumang sapat ang kakayahang model. Nasa prompts, coaching data, at code ang value ng pamamaraan, hindi sa model ng iisang provider. | ⚠️ Sa pamamagitan lamang ng **LLM gateway** na tinutukoy ng sandbox specification (🔲 nakaplano — tingnan sa ibaba) | ⚠️ Conditional — tingnan sa ibaba |
| **A2** | API-dependent, non-substitutable | Nangangailangan ng runtime calls sa external data o service API na hindi maaaring i-mirror o palitan — karaniwan dahil proprietary o unlicensed ang served content (hal., dictionary API na walang public license ang underlying dictionary). | ❌ Hindi — hindi maaaring umiral ang dependency sa sandbox nang walang pahintulot ng rights holder | ❌ Hindi hanggang magbigay ang rights holder ng mga pahintulot para sa sandbox-inclusion **at** transfer. Pinapayagan sa open (development-segment) leaderboard na may nakikitang flag na **"external dependency"** |
| **X** | Closed | May bundled content na walang karapatang i-redistribute ang submitter — unlicensed datasets, scraped proprietary content, license-incompatible components. | ❌ | ❌ Hindi tinatanggap sa anumang lane. Ang pag-bundle ng content nang walang karapatan ay paglabag sa lisensya saanman tumakbo ang pamamaraan |

**Effective class.** Ang dependency class ng pamamaraan ay ang *pinaka-restrictive* na class sa lahat ng idineklarang dependencies nito, sa order na S < O < A1 < A2 < X. Ang isang unlicensed dictionary ay ginagawang Class A2 ang isang kung hindi man ay self-contained pipeline (kung ina-access sa runtime) o Class X (kung naka-bundle nang walang karapatan).

### Ang Pagkakaiba ng A1/A2: Substitutability

Karamihan ng mga pamamaraan ay tumatawag sa LLMs. Hindi nagpapanggap ang Network na iba ang sitwasyon — ngunit pinaghihiwalay nito ang dalawang magkaibang uri ng API dependency:

- **A1 (substitutable):** Nagbibigay ang API ng commodity LLM inference. Configuration ang model identifier: dapat tumakbo ang pamamaraan end-to-end laban sa anumang compatible inference endpoint, kabilang ang community-hosted open-weight model. Maaaring magkaiba ang output quality sa iba’t ibang model — iyon ang risk ng developer, at nakatali ang opisyal na scores sa pinned model na ginamit sa evaluation. Ang pamamaraang nakadepende sa **provider-side state** (fine-tune na hosted lamang sa provider, provider file stores, provider-specific assistants) ay *hindi* substitutable: hindi maaaring palitan ang state na iyon, kaya A2 ang dependency maliban kung kasama sa submission ang underlying weights o data.
- **A2 (non-substitutable):** Naghahatid ang API ng bagay na natatangi — karaniwang proprietary o unlicensed data. Walang alternative endpoint na makapagbibigay nito, at hindi maaaring i-mirror ang content sa sandbox nang walang pahintulot ng rights holder. Gumagana ang pamamaraan sa open leaderboard (may flag), ngunit hindi makapagbibigay ng official sandbox scores o maging kwalipikado para sa mga premyo hanggang mayroon nang mga pahintulot.

**Ano ang aktuwal na inililipat ng A1 prize transfer.** Hindi natatanggap ng komunidad ang model — walang makapaglilipat ng weights ng Anthropic, Google, o OpenAI. Saklaw ng transfer ang kumpletong recipe *sa paligid* ng model: lahat ng prompts, coaching data, pipeline code, retry logic, configuration, at dokumentadong model requirements. Dahil substitutable by construction ang model, maaaring ituro ng komunidad ang nailipat na pamamaraan sa anumang provider na pipiliin nila — o sa open-weight model sa sarili nilang hardware — nang walang involvement ng developer. Pag-aari ang recipe; inuupahan at napapalitan ang engine.

### Dependency Manifest (`method.json`)

Idinedeklara ng bawat pamamaraan ang dependencies nito sa manifest na `method.json`. Itinatala ng bawat entry kung ano ang artifact, saan ito nagmumula, anong lisensya ang sumasaklaw dito, at kung paano ito ina-access ng pamamaraan:

```json
{
  "name": "FST-Gated Coached Translation v8",
  "method_id": "fst-gated-v8",
  "class": "pipeline",
  "paradigm": "hybrid",
  "entry_point": "pipeline:PipelineMethod",
  "supported_pairs": ["eng>crk"],
  "dependency_class": "A2",
  "dependencies": [
    {
      "id": "giellalt-lang-crk-fst",
      "kind": "software",
      "license": "AGPL-3.0-or-later",
      "access": "mirrored",
      "source": "https://github.com/giellalt/lang-crk",
      "pin": "sha256:3f1a…",
      "redistributable": true,
      "transferable": true
    },
    {
      "id": "llm-inference",
      "kind": "model",
      "license": "proprietary",
      "access": "gateway",
      "source": "openrouter:google/gemini-2.5-flash",
      "substitutable": true,
      "redistributable": false,
      "transferable": false,
      "notes": "Any compatible chat-completions endpoint works; the model slug is configuration."
    },
    {
      "id": "crk-dictionary-api",
      "kind": "service",
      "license": "none",
      "access": "external-api",
      "source": "https://itwewina.altlab.app/",
      "redistributable": false,
      "transferable": false,
      "notes": "Dictionary content has no public license; runtime lookups only. Class A2 until the rights holders grant permission."
    }
  ]
}
```

| Field | Required | Paglalarawan |
|-------|----------|-------------|
| `id` | ✅ | Stable identifier para sa dependency |
| `kind` | ✅ | `data`, `model`, `software`, o `service` |
| `license` | ✅ | SPDX identifier, `proprietary`, o `none`. Ang `none` ay nangangahulugang walang public license — tinatrato bilang all-rights-reserved |
| `access` | ✅ | `bundled` (kasama sa method directory), `mirrored` (kinukuha sa install, pinned, naka-vendor sa submission), `gateway` (runtime LLM inference sa pamamagitan ng evaluation gateway), `external-api` (anumang ibang runtime network call) |
| `source` | ✅ | Canonical URL o identifier na `provider:slug` |
| `pin` | para sa `mirrored` | Version, commit, o content hash na nagpi-pin ng eksaktong artifact |
| `substitutable` | para sa `gateway`/`external-api` | Kung maaaring i-serve ng anumang compatible endpoint ang dependency na ito |
| `redistributable` | ✅ | Kung pinapayagan ng lisensya ang redistribution ng artifact |
| `transferable` | ✅ | Kung maaaring maipasa sa komunidad ang artifact (o mga karapatan dito) sa ilalim ng prize transfer terms |
| `notes` | ❌ | Free-form context |

**Class derivation.** Nag-aambag ng class ang bawat dependency; ang `dependency_class` ng pamamaraan ang pinaka-restrictive:

| Profile ng dependency | Nag-aambag |
|--------------------|-------------|
| `bundled` + pinapayagan ng lisensya ang redistribution at transfer | S |
| `mirrored` + open license na nagpapahintulot ng redistribution (kasama ang copyleft) | O |
| `gateway` + `substitutable: true` (LLM inference) | A1 |
| `external-api`, o `gateway` na may `substitutable: false` | A2 |
| `bundled` + `license: none` o redistribution-incompatible license | X |

Dapat tumugma ang idineklarang `dependency_class` sa class na dini-derive ng harness mula sa manifest. Validation error ang mismatch.

Ang pamamaraang **walang** external dependencies ay nagdedeklara ng `"dependency_class": "S"` at `"dependencies": []`. Ang empty array ay affirmative statement, na ina-audit tulad ng iba pa.

### Paano Bine-verify ang Validity

Tatlong layer, mula sa pinakamura hanggang sa pinaka-authoritative:

1. **Manifest audit.** Dini-derive ng harness ang effective class mula sa manifest at nire-reject ang mismatches. Tinitingnan ng reviewers ang bawat idineklarang dependency laban sa stated license at source nito — bumabagsak sa review ang dependency na idineklarang `redistributable: true` kung iba ang sinasabi ng upstream license nito.
2. **Static analysis.** Ini-scan ang submitted code para sa network calls, dynamic downloads, at filesystem access na hindi isinasaalang-alang ng manifest. Ang *undeclared* dependency na natagpuan sa review ay batayan para sa rejection anuman ang magiging class nito — dapat kumpleto ang manifest, hindi lamang accurate.
3. **Sandbox network policy.** Kinakailangan ng sandbox specification ang **default-deny egress**: walang network access ang method containers maliban kung tahasang naka-allowlist ang isang path. Ang tanging egress path na tinutukoy ng specification ay ang **LLM gateway** — isang inference proxy na pinapatakbo ng evaluation infrastructure, limitado sa explicit allowlist ng pinned models, na may bawat request at response na naka-log para sa post-run audit. Ang anumang wala sa allowlist ay nabibigo sa network layer, hindi sa policy layer. Tingnan ang [Benchmark Specification §8.6](/docs/network/specifications/benchmark) para sa network policy at gateway design.

> **Dalawang magkaibang sandbox — isang nakaplano, isang live.** Basahin po ito nang mabuti, dahil ang salitang "sandbox" ay tumutukoy sa dalawang magkaibang bagay:
>
> - 🔲 **Nakaplano: ang platform sandbox at ang LLM gateway nito.** Ang environment na pinatatakbo ng evaluation infrastructure na inilalarawan sa seksyong ito — ang may LLM gateway na magpapahintulot sa mga Class A1 method na makagawa ng mga opisyal na gold-standard score — ay tinukoy na ngunit hindi pa nagagawa. Hangga't wala pa ito, ang mga Class A1 method ay kwalipikado sa premyo *sa prinsipyo* ngunit hindi pa makakagawa ng mga opisyal na gold-standard score.
> - ✅ **Live: ang organizer-node method-execution lane.** Ang sariling scoring node ng isang contest organizer ay nagpapatakbo na ng mga iminungkahing method bundle sa loob ng network-isolated container (`mt-eval node run-method`): binuo at pinapatakbo gamit ang `--network=none`, read-only root, naka-vendor ang dependencies — na naglilimita rito sa mga method na hindi nangangailangan ng runtime network (Class S/O by construction). Maaari itong tumakbo sa isang tunay na airgap machine, kung saan signed scores-only bundles lamang ang tumatawid sa pamamagitan ng removable media. Tingnan ang [Magpatakbo ng Sovereign Contest](/docs/network/sovereignty/run-a-sovereign-contest) para sa end-to-end na path.
>
> Inilalarawan ng seksyong ito kung ano ang hinihingi ng platform specification, hindi kung ano ang kasalukuyang tumatakbo sa platform.

### Display ng Leaderboard

- Ipinapakita ng leaderboard ang dependency class ng bawat pamamaraan kasama ng method class badge nito.
- Ang mga method na Class A2 sa open leaderboard ay may nakikitang flag na **"external dependency"**: nakadepende ang kanilang scores sa third-party service na maaaring magbago o mawala, at hindi sila kasalukuyang prize-eligible.
- Hindi nililista ang mga method na Class X.

## Eval Harness: TranslationMethod Protocol {#eval-harness-translationmethod-protocol}

Gumagamit ang eval harness ng structural typing ng Python (`Protocol`) para sa mga plugin. Gumagana ang anumang class na may tamang mga member — hindi kailangan ng inheritance. May **tatlong** kinakailangang member ang protocol, hindi lamang `translate`:

1. **`name`** (`str`) — human-readable na pangalan ng method, ginagamit sa mga run ID at log.
2. **`method_card()`** (`-> dict | None`) — metadata ng method para sa provenance tracking, naka-embed sa run log at na-publish na run card. Ibalik ang `None` kung walang card ang method.
3. **`async translate(entries, config)`** (`-> list[dict]`) — ang mismong pagsasalin: isang batch ng mga entry ang input, isang result dict bawat entry ang output.

Kapag nag-load ang harness ng plugin sa pamamagitan ng `--method path/to/dir`, vine-validate nito na callable ang `translate` at pagkatapos ay binabasa ang `method.name` at tinatawag ang `method.method_card()` nang walang kondisyon — ang plugin na kulang sa alinman sa dalawa ay magka-crash sa load time, sa halip na maayos na mabigo.

```python
class MyMethod:
    name = "My Pipeline v1"  # required — run IDs and logs

    def method_card(self) -> dict | None:
        # required — provenance metadata (or None for no card)
        return {
            "method_id": "my-pipeline-v1",
            "name": self.name,
            "class": "pipeline",
        }

    async def translate(self, entries: list[dict], config: RunConfig) -> list[dict]:
        results = []
        for entry in entries:
            translation = await self.do_translation(entry["source"])
            results.append({
                "id": entry["id"],
                "predicted": translation,
                "latency_s": 0.5,
                "usage": {"prompt_tokens": 0, "completion_tokens": 0},
                "error": None,
                "tool_calls": [],
                "tool_call_count": 0,
                "metadata": {},
            })
        return results
```

Kailangan ng plugin directory ng `method.json` manifest na may hindi bababa sa `name` at `entry_point` (`"module_name:ClassName"` — nilo-load ang module mula sa plugin directory at ini-instantiate ang class). Kung ang ibinalik na method card ay nagdedeklara ng `class` o `paradigm`, dapat nitong gamitin ang kanonikal na bokabularyo sa itaas — ang card na wala sa taxonomy ay mabibigong ma-validate sa load time sa halip na tahimik na mawala sa mga filter ng leaderboard.

Para sa isang kumpletong worked example — pagbuo, pagpapatakbo, at pagsusumite ng plugin mula simula hanggang wakas — tingnan ang [Magsumite ng Method](/docs/network/getting-started/submit-a-method) at ang [FST-Gated Pipeline cookbook](/docs/network/tutorials/fst-gated-pipeline).

## champollion: methodPlugin Config

Sa champollion, nire-register ang mga pamamaraan per language pair sa `champollion.config.json`:

```json
{
  "version": 3,
  "pairs": {
    "en:crk": {
      "methodPlugin": "crk-coached-v1"
    }
  }
}
```

Tingnan ang [Plugin Spec](https://champollion.dev/docs/reference/plugin-spec) para sa champollion-side interface.

## Integrasyon sa Leaderboard

Kapag naka-attach ang method card sa isang run (sa pamamagitan ng `--method-card`), naka-embed ito sa run card at ipinapakita sa leaderboard:

```bash
# Run with method card attached
mt-eval run \
  --method path/to/my-method \
  --corpus eval-amh-fra-globalvoices-test-v1 \
  --method-card method_card.json

# Publish to the leaderboard
mt-eval publish eval/logs/harness/your-run-card.json
```

Kung walang ibinigay na `--method-card`, naglulunsad ang `mt-eval publish` ng interactive wizard na gagabay sa inyo sa paglalarawan ng inyong pamamaraan.

Ipinapakita ng leaderboard ang:
- **Class badge** — visual indicator (hal., "pipeline", "coached-llm")
- **Paradigm** — ang algorithmic paradigm (hal., "rule-based", "neural-nmt", "llm", "hybrid"), isang filterable column (tingnan ang [Mga Paradigm](#paradigms))
- **Dependency class** — S/O/A1/A2 (tingnan ang [Validity ng Pamamaraan at mga Klase ng Dependency](#method-validity-and-dependency-classes)); may flag na "external dependency" ang mga method na A2
- **Pangalan ng pamamaraan** — mula sa method card
- **Mga tool na ginamit** — nakalista mula sa method card
- **Open source indicator**

Kapag walang naka-attach na method card, ipinapakita ng leaderboard ang harness-native configuration (model, prompt version, temperature, enabled tools).

:::danger[HUWAG MAG-TRAIN sa evaluation data]
Ang mga method na ang proseso ng development ay kinabilangan ng exposure sa evaluation dataset — bilang training data, few-shot examples, dictionary entries, o prompt tuning material — ay **madidiskwalipika** mula sa leaderboard. Tingnan ang [MT Evaluation](/docs/network/leaderboard/rules) para sa kung ano ang nagpapakita ng pagkakaiba ng mabuting method sa masamang method.
:::

---

## Tingnan Din

- [MT Evaluation](/docs/network/leaderboard/rules) — overview, halaga ng leaderboard, at gabay sa mabuti/masamang pamamaraan
- [Eval Harness](/docs/network/specifications/harness) — kung paano magpatakbo ng evaluations
- [Evaluation Datasets](/docs/network/leaderboard/datasets) — available datasets (EDTeKLA, FLORES+)
- [Run Card Specification](/docs/network/specifications/run-card) — ang JSON schema ng run card
- [Plugin Spec](https://champollion.dev/docs/reference/plugin-spec) — champollion-side plugin interface
- [Method Leaderboard](https://champollion.dev/leaderboard) — live benchmark scores
- [Benchmark Specification](/docs/network/specifications/benchmark) — evaluation protocol, corpus format, run card schema
- [Scoring Specification](/docs/network/specifications/scoring) — SSOT para sa metrics, composite weights, at quality tiers
