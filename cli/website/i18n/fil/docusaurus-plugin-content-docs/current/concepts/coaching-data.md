---
sidebar_position: 5
title: "Data ng Coaching"
related:
  - label: "Build a Translation Plugin"
    to: /docs/tutorials/build-a-plugin
    kind: tutorial
    note: "Develop and ship coaching data end-to-end"
  - label: "Plugin Specification"
    to: /docs/reference/plugin-spec
    kind: reference
  - label: "Cookbook: Coached LLM Prompting"
    to: /docs/network/tutorials/coached-llm-prompting
    kind: arena
    note: "The eval-side cookbook for coached methods"
  - label: "Quality Gate"
    to: /docs/concepts/quality-gate
    kind: concept
---

# Datos sa Coaching

Ang coaching data ay mekanismo ng champollion para turuan ang mga LLM tungkol sa mga wikang hindi kasama sa kanilang training. Sa pamamagitan ng pagbibigay ng mga tuntunin sa gramatika, mga diksyunaryo, at mga tala sa estilo kasama ng bawat translation request, ginagawa ninyo ang isang general-purpose LLM bilang context-aware translator para sa anumang wika — kabilang ang mga wikang walang umiiral na suporta sa MT.

## Paano Ito Gumagana

Kapag itinakda ninyo ang method ng isang pair sa `llm-coached`, nilo-load ng champollion ang isang coaching file mula sa `.champollion/coaching/<locale>.json` at ini-inject ang nilalaman nito sa bawat LLM prompt bilang bahagi ng system message. Nakikita ng LLM ang inyong mga tuntuning pangwika kasama ng translation request, kaya nakagagawa ito ng output na sumusunod sa inyong gramatika at terminolohiya sa halip na manghula.

```
┌──────────────────────────────────────────────────────┐
│ System Message (cached across batches)               │
│ ┌──────────────────────────────────────────────────┐ │
│ │ Base translation rules                           │ │
│ │ + Register instructions                          │ │
│ │ + Coaching guidance (from coachingFile, if set)   │ │
│ │ + Grammar rules (from coaching data)             │ │
│ │ + Dictionary entries (from coaching data)         │ │
│ │ + Style notes (from coaching data)               │ │
│ └──────────────────────────────────────────────────┘ │
├──────────────────────────────────────────────────────┤
│ User Message (per batch)                             │
│ ┌──────────────────────────────────────────────────┐ │
│ │ Keys to translate (JSON)                         │ │
│ └──────────────────────────────────────────────────┘ │
└──────────────────────────────────────────────────────┘
```

May dalawang uri ng coaching content:

1. **Structured coaching data** (`llm-coached` method) — Mga tuntunin sa gramatika, mga diksyunaryo, at mga tala sa estilo sa JSON format. Nilo-load mula sa `.champollion/coaching/<locale>.json` o mula sa directory na `coaching/` ng isang plugin.
2. **Free-text coaching prompt** (`coachingFile` config field) — Isang plain text file na may karagdagang gabay na ini-inject sa system prompt. Gumagana sa anumang LLM method, hindi lamang sa `llm-coached`. Itakda sa pamamagitan ng `coachingFile` sa inyong config o `--coaching-file` sa CLI.

Maaaring gamitin ang dalawa nang magkasama. Ginagamit ng eval harness ang eksaktong parehong prompt structure — kaya ipinapakita ng inyong benchmark scores ang aktuwal ninyong production prompts.

Dahil bahagi ng system message ang coaching data, nakikinabang ito sa **prompt caching** — ang mga provider tulad ng Anthropic at Google ay nagka-cache ng paulit-ulit na system prefixes, kaya isang beses lang ninyong babayaran ang coaching context sa bawat session, hindi sa bawat batch.

## Format ng Coaching File

Gumawa ng isang JSON file para sa bawat locale sa `.champollion/coaching/`:

```json title=".champollion/coaching/crk.json"
{
  "grammar_rules": [
    "Plains Cree is polysynthetic — a single word can express what English needs a full sentence for",
    "Animate/inanimate noun distinction affects verb conjugation",
    "Use SRO (Standard Roman Orthography) unless script converter handles conversion",
    "Verb stems are modified by prefixes and suffixes to indicate person, number, tense, and evidentiality"
  ],
  "dictionary": {
    "home": "kīwēwin",
    "settings": "isi-nākatohkēwin",
    "search": "nānātawāpahtam",
    "welcome": "tānisi",
    "submit": "ispīhci",
    "cancel": "pōni"
  },
  "style_notes": "Use formal register. Preserve English technical terms in parentheses when no Cree equivalent exists. Avoid loanwords when a descriptive Cree expression exists."
}
```

### Mga Field

| Field | Uri | Kailangan | Paglalarawan |
|-------|------|----------|-------------|
| `grammar_rules` | `string[]` | Hindi | Array ng mga tuntunin sa gramatika na ini-inject sa system prompt. Dapat maikli at maisasagawa na tagubilin ang bawat tuntunin na kayang sundin ng LLM. |
| `dictionary` | `object` | Hindi | Key-value map ng English term → target language term. Ginagamit para sa domain-specific vocabulary na hindi malalaman ng LLM. |
| `style_notes` | `string` | Hindi | Free-form na mga tagubilin sa estilo (register, tono, mga convention sa formality). |

Opsyonal ang lahat ng field — maaari kayong magsimula sa isang diksyunaryo lamang at magdagdag ng mga tuntunin sa gramatika habang pinapahusay ninyo ito.

## Fallback Behavior

Kung naka-configure ang isang pair para sa `llm-coached` ngunit walang coaching file para sa locale na iyon, **magfa-fallback ang champollion sa standard na `llm` method** na may console warning:

```
[INFO] No coaching data for "crk" at .champollion/coaching/crk.json
       Falling back to standard LLM method. Create coaching data for better results.
```

Ibig sabihin nito, maaari ninyong ligtas na itakda ang `"defaultMethod": "llm-coached"` nang global — gagamitin ito ng mga wikang may coaching data, at makakakuha ang iba ng standard na LLM translation nang walang error.

## Kailan Gagamit ng Coaching

| Scenario | Inirerekomendang Method |
|----------|-------------------|
| Mga wikang Tier 1 (French, Spanish, German) | `llm` o `google-translate` — alam na ito nang mabuti ng mga LLM |
| Mga wikang Tier 2 (Korean, Turkish, Thai) | `llm` na may register — sapat na nahahawakan ng mga LLM ang mga ito kapag may gabay sa estilo |
| Mga wikang Tier 3 (Plains Cree, Yoruba, Quechua) | `llm-coached` — kailangan ng mga LLM ng mga tuntunin sa gramatika at mga diksyunaryo |
| Mga conlang (Klingon, Sindarin, Kryptonian) | `llm-coached` — may ilang training data ang mga LLM ngunit kailangan ng mga pagwawasto |

## Pagbuo ng Mahusay na Coaching Data

### Mga Tuntunin sa Gramatika

Isulat ang mga tuntunin bilang **mga tagubilin**, hindi mga paglalarawan. Mas mahusay sumusunod ang LLM sa mga tagubilin kaysa mag-interpret ng teoryang pangwika.

```json
// ❌ Descriptive (the LLM learns nothing actionable)
"Plains Cree has animate and inanimate noun classes"

// ✅ Instructive (the LLM knows what to do)
"When translating nouns, check whether the Cree equivalent is animate (NA) or inanimate (NI) — this affects which verb conjugation to use"
```

### Mga Diksyunaryo

Magtuon sa **domain-specific terms** na maaaring mali ang salin ng LLM o imbentuhin nito. Hindi na kailangang isama ang karaniwang mga salitang nahahawakan na ng LLM — magtuon sa mga terminong partikular sa UI ng inyong application.

### Mga Tala sa Estilo

Maging tiyak tungkol sa register, formality, at mga convention:

```json
"style_notes": "Use formal register (vous-form in French). Preserve brand names untranslated. UI labels should be imperative mood ('Save', not 'Saves'). Maximum 40 characters for button text."
```

## Pagsubok sa Coached Translations

Gamitin ang [MT Eval Harness](https://github.com/gamedaysuits/Champollion) upang i-benchmark ang inyong coached translations laban sa isang reference corpus:

```bash
# Install the harness
pip install mt-eval-harness

# Run coached translations against your test corpus
mt-eval run --corpus data/crk-corpus.json --model google/gemini-2.5-pro

# Score the results
mt-eval test eval/logs/run_*.json
```

Nagbibigay ito sa inyo ng chrF++, BLEU, at exact match scores. Gumawa ng maraming bersyon ng coaching file at ihambing — mas mainam ang mga obhetibong metric kaysa subjective review.

---

## Tingnan Din

- [Mga Paraan ng Pagsasalin](/docs/guides/translation-methods) — ang llm-coached method
- [Suportahan ang Low-Resource Language](/docs/network/community/low-resource-languages) — coaching sa aktuwal na paggamit
- [Plugin Specification](/docs/reference/plugin-spec) — pag-package ng coaching data sa isang plugin
- [Quality Gate](/docs/concepts/quality-gate) — kung paano vini-validate ang coached translations
- [Configuration](/docs/getting-started/configuration) — per-pair coaching config
