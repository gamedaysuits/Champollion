---
sidebar_position: 2
title: "Cookbook: May Gabay na LLM Prompting"
related:
  - label: "Cookbook: Few-Shot Prompting"
    to: /docs/network/tutorials/few-shot-prompting
    kind: cookbook
  - label: "Cookbook: Fine-Tuned Model"
    to: /docs/network/tutorials/fine-tuned-model
    kind: cookbook
  - label: "Coaching Data"
    to: https://champollion.dev/docs/concepts/coaching-data
    kind: champollion
    note: "How coaching data ships to production"
  - label: "Submit a Method"
    to: /docs/network/getting-started/submit-a-method
    kind: guide
---

# Coached LLM Prompting

> **Ang ideya:** Direktang ipasok ang mga tuntunin sa gramatika, bilingual dictionaries, at style notes sa system prompt ng LLM. Walang training, walang fine-tuning — structured linguistic knowledge lamang na gumagabay sa output tungo sa wastong mga salin.

:::info[Isa itong cookbook, hindi isang tapos na implementasyon]
Binabalangkas ng gabay na ito ang pamamaraan at ang mahahalagang desisyon sa disenyo nito. Iangkop ito sa inyong pares ng wika, mga magagamit na mapagkukunan, at mga layunin sa pagsusuri.
:::

## Kailan Ito Gagamitin

- Mayroon kayong **linguistic knowledge** tungkol sa target language (grammar rules, dictionary entries, style preferences) ngunit hindi sapat ang parallel data para sa fine-tuning
- Nais ninyong **mabilis na mag-iterate** — naide-deploy ang prompt changes sa loob ng ilang segundo, walang retraining
- May **kilalang patterns** ang target language na madalas magkamali ang LLM (gender agreement, script conventions, formality levels)
- Nais ninyong i-benchmark ang coached prompting laban sa baseline at mag-iterate batay sa gumagana

## Paano Ito Gumagana

1. **Buuin ang coaching data** — grammar rules, isang bilingual dictionary, at style notes sa isang structured JSON file
2. **I-configure ang register** — isang system prompt prefix na nagtatakda ng language, script, at tone
3. **Patakbuhin ang harness** — ini-inject ang coaching data sa bawat LLM prompt
4. **Suriin ang failures** — tingnan kung ano ang nire-reject ng quality gate, magdagdag ng rules upang tugunan ang patterns
5. **Mag-iterate** — bawat revision ng coaching file ay bagong experiment; sinusubaybayan ng harness ang lahat ng ito

## Istruktura ng Coaching Data

```json title="coaching/<locale>.json"
{
  "grammar_rules": [
    "Adjectives agree in gender and number with the noun they modify",
    "Use formal register (vous) for all UI text",
    "Preserve interpolation variables exactly: {{name}}, {count}"
  ],
  "dictionary": {
    "dashboard": "tableau de bord",
    "settings": "paramètres",
    "deploy": "déployer"
  },
  "style_notes": "Prefer active voice. Avoid anglicisms where a native term exists. Keep sentences concise for UI readability."
}
```

## Mga Pangunahing Desisyon sa Disenyo

**Rule specificity vs. context window:** Mas maraming rules ang nagbibigay sa LLM ng mas maraming guidance, ngunit kumakain ito ng context window na available para sa aktuwal na translation. Magsimula sa 5–10 high-impact rules at magdagdag lamang kapag may nakikita kayong specific failure patterns.

**Dictionary coverage:** Hindi ninyo kailangan ng kumpletong dictionary — mag-focus sa terms na palaging nagkakamali ang LLM. Kahit 20–30 forced terms lamang ay maaaring makapagpabuti nang malaki sa consistency.

**Mahalaga ang rule ordering:** Ilagay muna ang pinakamahahalagang rules. Mas malakas ang pagtuon ng LLMs sa mga unang instruction.

## Pagpapatakbo ng Experiment

```bash
mt-eval run \
  --corpus eval-amh-fra-globalvoices-test-v1 \
  --model google/gemini-2.5-pro \
  --name coached-v1 \
  --coaching-file coaching/crk.json
```

## Mga Kalamangan at Kahinaan

| | |
|---|---|
| ✅ Walang training cost | ❌ Limitado ang quality ceiling ng base knowledge ng LLM |
| ✅ Instant iteration (baguhin ang prompt → patakbuhin muli) | ❌ Nililimitahan ng context window kung gaano karaming coaching ang kasya |
| ✅ Gumagana sa anumang LLM provider | ❌ Maaaring mag-conflict ang rules — ang pag-debug ng prompt interactions ay isang sining |
| ✅ Transparent — mababasa ninyo mismo kung ano ang nakikita ng LLM | ❌ Hindi ito lumilikha ng bagong knowledge, ginagabayan lamang nito ang umiiral na knowledge |

## Mahusay na Naipapares Sa

- **[FST-Gated Pipeline](./fst-gated-pipeline)** — nahuhuli ng coaching + morphological validation ang mga nakakaligtaan ng coaching lamang
- **[Dictionary-Augmented LLM](./dictionary-augmented-llm)** — ang forced terminology ay isang anyo ng coaching
- **[Few-Shot Prompting](./few-shot-prompting)** — mas makapangyarihan ang examples + rules nang magkasama kaysa sa alinman nang nag-iisa

## Tingnan Din

- [Method Interface](/docs/network/specifications/methods) — coaching data format at ang TranslationMethod protocol
- [Pagsuporta sa Low-Resource Language](/docs/network/community/low-resource-languages) — ang buong context
- [Eval Harness](/docs/network/specifications/harness) — kung paano magpatakbo ng experiments
