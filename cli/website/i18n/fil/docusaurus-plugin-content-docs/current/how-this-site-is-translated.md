---
id: how-this-site-is-translated
title: "Paano isinalin ang site na ito"
description: "Ang bawat locale sa site na ito ay machine-translated po mismo ng Champollion — ang mismong CLI na inilalarawan ng docs na ito. Ginagamit po namin ang sarili naming tool (dogfooding)."
---

# Kung paano isinalin ang site na ito

Ang site na ito ay available sa 13 wika. Ang bawat locale maliban sa Ingles ay
**machine-translated ng mismong Champollion** — ang parehong CLI na inilalarawan ng mga docs
na ito (`npx champollion sync`). Ginagamit po namin ang aming sariling tool.

Sa ngayon, ang bawat pares ng wika ay gumagamit ng iisang model:
**`google/gemini-3.1-pro-preview`**, na nagsasalin gamit ang per-language
na register at gabay sa terminolohiya na inilalarawan sa ibaba. Sadyang pinili po namin ang isang model
bilang isang tapat na default habang binubuo naming muli ang aming benchmark-based
na pagpili ng model (tingnan sa ibaba) — kaya ito ay isang malinaw at dokumentadong pagpili, hindi isang
resulta na pinapalabas naming iba kaysa sa kung ano talaga ito.

Dalawang bagay na dapat ninyong malaman bilang isang mambabasa:

1. **Ang mga pahinang ito ay mga machine translation.** Ang mga ito ay ginawa gamit ang
   register at gabay sa terminolohiya na inilalarawan sa ibaba, ngunit walang tao na sumuri
   sa bawat pangungusap. Kung mayroong mali sa pagkakabasa, ang bersyong Ingles ang
   awtoritatibo — at ikalulugod po namin ang isang pagwawasto.
2. **Ang model ay isang default ngayon, pipiliin per benchmark bukas.**
   Ang disenyo ng Champollion ay piliin ang translation model *para sa bawat pares
   ng wika* sa pamamagitan ng benchmark — bigyan ng score ang bawat kandidato sa isang development corpus at
   isalin ang locale na iyon gamit ang may pinakamataas na score na paraan (ang mga statistical tie
   ay pinagpapasyahan batay sa gastos). Muli po naming pinapatakbo ang pagpiling iyon sa aming sariling
   integrity gate bago namin i-pin ang mga panalo per-pair dito. **Hanggang sa ang mga run na iyon
   ay mai-publish sa [Network leaderboard](/leaderboard), ang pahinang ito ay
   hindi mag-aangkin ng isang benchmark provenance na hindi nito maipapakita sa inyo.**

## Provenance ayon sa locale

| Locale | Wika | Paraan | Model | Register | Huling na-sync |
|--------|----------|--------|-------|----------|-------------|
| fr | Français | llm | `google/gemini-3.1-pro-preview` | pormal na *vous* | 2026-07-18 |
| de | Deutsch | llm | `google/gemini-3.1-pro-preview` | Sie-Form | 2026-07-18 |
| nl | Nederlands | llm | `google/gemini-3.1-pro-preview` | u-vorm | 2026-07-18 |
| fil | Filipino | llm | `google/gemini-3.1-pro-preview` | pormal | 2026-07-18 |
| es | Español | llm | `google/gemini-3.1-pro-preview` | neutral na Latin American | 2026-07-18 |
| zh | 简体中文 | llm | `google/gemini-3.1-pro-preview` | propesyonal na teknikal | 2026-07-18 |
| ja | 日本語 | llm | `google/gemini-3.1-pro-preview` | です/ます (magalang) | 2026-07-18 |
| ko | 한국어 | llm | `google/gemini-3.1-pro-preview` | 해요체 (magalang) | 2026-07-18 |
| pt | Português | llm | `google/gemini-3.1-pro-preview` | propesyonal | 2026-07-18 |
| th | ไทย | llm | `google/gemini-3.1-pro-preview` | neutral na propesyonal | 2026-07-18 |
| vi | Tiếng Việt | llm | `google/gemini-3.1-pro-preview` | neutral na *bạn*-form | 2026-07-18 |
| ar | العربية | llm | `google/gemini-3.1-pro-preview` | MSA, propesyonal | 2026-07-18 |

## Ang pagpili ng benchmark na binubuo naming muli

Ang nilalayong paraan — at kung paano naka-istruktura ang config upang gumana — ay
ang pagpili ng model per-pair na pinapatakbo ng aming sariling ebalwasyon: bigyan ng score ang bawat
kandidatong model sa development corpus ng pares, kunin ang pinakamataas na
composite score, at pagpasyahan ang mga statistical tie batay sa gastos. Ang buong loop ay
dokumentado para sa sinumang nais na kopyahin ito.

**Hindi** po kami nagpa-publish ng mga composite score o isang "benchmark winner" per
wika sa pahinang ito ngayon, dahil ang selection sweep na susuporta sa
mga numerong iyon ay muling pinapatakbo muna sa harness integrity gate.
Kapag ito ay nailabas na, ang mga run ay mapupunta sa pampublikong leaderboard, ang talahanayang ito ay
maglalaman ng nanalong model ng bawat pares kasama ang binanggit na run nito, at ang site config
ay muling magpi-pin ng mga panalo per-pair. Hanggang sa panahong iyon: isang tapat na default.

Ang *Composite score* ay ang blended quality metric ng Network (chrF++, exact
match, at mga naka-load na metric plugin, na-verify ng bootstrap-CI). Ang mga score ay maaari lamang
ipaghambing **sa loob ng isang pares ng wika**, at hindi kailanman sa iba't ibang pares — ang mga pagkakaiba sa script at
corpus ay nagpapawalang-saysay sa paghahambing ng cross-pair.

## Register at tono

Ang bawat wika ay isinasalin gamit ang isang tahasang register na pinili mula sa
mga language card ng Champollion, kaya ang pormalidad ay pare-pareho sa buong site:

- **Français** — vouvoiement (pormal na *vous*)
- **Deutsch** — Sie-Form
- **Nederlands** — u-vorm
- **Filipino** — pormal, na may mga karaniwang teknikal na termino
- **Español** — neutral na Latin American Spanish
- **简体中文** — propesyonal na teknikal na register
- **日本語** — です/ます (magalang na anyo)
- **한국어** — 해요체 (magalang)
- **Português** — propesyonal na register
- **ไทย** — neutral na propesyonal
- **Tiếng Việt** — neutral na *bạn*-form
- **العربية** — Modern Standard Arabic, propesyonal na register

## Ano ang hindi machine-translated

Ang mga code block, CLI command, configuration key, pangalan ng package, URL, at
mga pangngalang pantangi ay protektado sa panahon ng pagsasalin at nananatili sa Ingles ayon sa
disenyo.

## Nakahanap ng maling salin?

Magbukas po ng isang issue o PR — ang pinagmulan ng bawat isinaling pahina ay ang orihinal na
Ingles. Ang mga pagwawasto sa isang isinaling pahina ay pinapanatili sa mga susunod na sync hangga't
ang pinagmulang Ingles ng pahinang iyon ay hindi nagbabago (ang sync ay muling nagsasalin ng isang
pahina lamang kapag nagbago ang pinagmulang Ingles nito).

*Ang pahinang ito ay mismong machine-translated sa pamamagitan ng paraang inilalarawan sa itaas — inilalarawan
nito ang sarili nitong pagsasalin.*
