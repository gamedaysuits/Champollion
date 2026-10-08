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

1. **Structured coaching data** (pamamaraang `llm-coached`) — Mga panuntunan sa gramatika, mga diksyunaryo, at mga tala sa estilo sa format na JSON. Nilo-load mula sa `.champollion/coaching/<locale>.json` o sa direktoryo ng `coaching/` ng isang plugin. Ang `dictionary` nito ay ang glosaryo rin ng proyekto: ipinapaalam sa bawat pamamaraan ng LLM (`llm`, `openai`, `anthropic`, `gemini`, `local`) ang mga termino sa glosaryo na nilalaman ng bawat batch, ipinapadala ito ng DeepL bilang isang glosaryo, at nagbababala ang sync kapag nilaktawan ng output ng alinmang pamamaraan ang isang termino. Ang mga panuntunan sa gramatika at mga tala sa estilo ay binabasa lamang ng `llm-coached` — sa alinmang provider (`"provider": "openai"`, `"local"`, …).
2. **Free-text coaching prompt** (field ng config na `coachingFile`) — Isang plain text file na may karagdagang gabay na isinisingit sa system prompt. Gumagana sa anumang paraan ng LLM, hindi lamang sa `llm-coached`. Itinatakda sa pamamagitan ng `coachingFile` sa inyong config o `--coaching-file` sa CLI.

Maaaring gamitin ang dalawa nang magkasama. Ginagamit ng eval harness ang eksaktong parehong prompt structure — kaya ipinapakita ng inyong benchmark scores ang aktuwal ninyong production prompts.

Dahil bahagi ng system message ang coaching data, nakikinabang ito sa **prompt caching** — ang mga provider tulad ng Anthropic at Google ay nagka-cache ng paulit-ulit na system prefixes, kaya isang beses lang ninyong babayaran ang coaching context sa bawat session, hindi sa bawat batch.

## Format ng Coaching File

Gumawa ng isang JSON file bawat locale sa `.champollion/coaching/`. Ang halimbawa
sa ibaba ay para sa isang inimbentong wika sa ilalim ng `qaa`, isang private-use code na walang totoong
wika ang nagtataglay: bawat panuntunan at termino rito ay pansamantalang pamalit lamang, hindi isang katotohanan tungkol sa alinmang
wika. Sumulat po ng inyong sarili, mainam kung kasama ang isang tagapagsalita ng wika, at kumuha ng
mga termino ng diksyunaryo mula sa isang mapagkukunang maaari ninyong pangalanan.

```json title=".champollion/coaching/qaa.json"
{
  "grammar_rules": [
    "One word can carry what English says in a whole clause: translate the meaning of the phrase, not word by word",
    "Nouns are animate or inanimate, and the verb ending follows the class: check the noun's class before choosing the verb form",
    "Write the standard Latin orthography; the script converter produces the display script",
    "Put the verb first in a command (button labels, menu items)"
  ],
  "dictionary": {
    "home": "<your term for home>",
    "settings": "<your term for settings>",
    "search": "<your term for search>",
    "welcome": "<your term for welcome>",
    "submit": "<your term for submit>",
    "cancel": "<your term for cancel>"
  },
  "style_notes": "Use the formal register. When the language has no term for an English technical word, write a descriptive phrase and keep the English word in parentheses after it."
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
[INFO] No coaching data for "qaa" at .champollion/coaching/qaa.json
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
"This language has animate and inanimate noun classes"

// ✅ Instructive (the LLM knows what to do)
"When translating a noun, look up whether it is animate (NA) or inanimate (NI) in the dictionary — the class decides the verb ending"
```

### Mga Diksyunaryo

Magtuon sa **domain-specific terms** na maaaring mali ang salin ng LLM o imbentuhin nito. Hindi na kailangang isama ang karaniwang mga salitang nahahawakan na ng LLM — magtuon sa mga terminong partikular sa UI ng inyong application.

**Sinusuri ang diksyunaryo para sa bawat pamamaraan.** Alinmang pamamaraan ang magsalin ng isang
pares — isang hosted model, ang inyong sariling modelo sa pamamagitan ng `local`, DeepL, isang endpoint ng `api`
— sinusuri ng `champollion sync` ang bawat isinaling string laban sa
diksyunaryo at nagpi-print ng babalang `[TERM]` na nagpapangalan sa anumang terminong hindi ginamit.
Tanging ang `llm-coached` (sa prompt) at `deepl` (bilang isang glosaryo ng DeepL) lamang ang
*naglalapat* din nito habang nagsasalin; para sa iba pa, ipinapaalam sa inyo ng pagsusuri kung aling mga
string ang dapat ayusin, halimbawa gamit ang `champollion sync --method llm-coached
--redo keys:<key>`.

### Mga Tala sa Estilo

Maging tiyak tungkol sa register, formality, at mga convention:

```json
"style_notes": "Use formal register (vous-form in French). Preserve brand names untranslated. UI labels should be imperative mood ('Save', not 'Saves'). Maximum 40 characters for button text."
```

## Pagsubok sa Coached Translations

Gamitin ang [MT Eval Harness](https://github.com/gamedaysuits/Champollion) upang i-benchmark ang inyong coached translations laban sa isang reference corpus:

```bash
# Install the harness
python3 -m pip install mt-eval-harness

# Run coached translations against your test corpus
mt-eval run --corpus data/crk-corpus.json --model google/gemini-3.1-pro-preview

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
