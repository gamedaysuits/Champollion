---
sidebar_position: 0
title: "Isumite sa Index"
description: "Magmungkahi po ng dataset, resource, pamamaraan, serbisyo ng human translation, o external result — o magmungkahi ng pagwawasto sa language-card. Ang bawat isinusumite po ay sinusuri ng tao para sa pagsunod sa IP, lisensya, at soberanya — wala pong awtomatikong inaaprubahan."
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

# Magsumite sa Indeks

> **Maikling Buod.** Magmungkahi ng isang bagay para sa indeks ng Champollion — isang benchmark, resource, translation method, human translation service, o external published result. Maghahain kayo ng maikling structured form (sa inyong browser o mula sa CLI); **mano-manong sinusuri ng maintainer ang bawat submission** para sa IP, lisensiya, at pagsunod sa community/sovereignty bago ito maidagdag. **Walang awtomatikong inaaprubahan.**

Ang indeks ang pinagsasaluhang mapa: ang mga dataset na pinagbe-benchmark-an ng mga method, ang mga dictionary at tool na nakatutulong, ang mismong mga method, ang mga taong nagsasalin nang mano-mano, at ang mga resultang inilathala ng iba. Maaaring magmungkahi ng karagdagan ang sinuman. Dahil ito ay imprastraktura para sa mga komunidad ng wika, dumaraan muna ang bawat proposal sa isang human review gate.

---

## Ano ang maaari ninyong isumite

| Uri | Ano ito | Ano ang idinaragdag namin |
|---|---|---|
| **Benchmark / dataset** | Isang evaluation corpus o benchmark | Isang metadata card + isang *fetch-from-source* pointer — hindi kailanman ang nilalaman ng corpus |
| **Resource** | Isang diksiyonaryo, archive, app, FST (morphological analyzer), o tool | Isang listahan na may pointer + access level (open / restricted / consent-required) |
| **Paraan ng pagsasalin** | Isang MT engine, LLM provider, o pipeline | Isang method-registry entry upang ito ay mapatakbo at ma-benchmark |
| **Serbisyo ng pagsasalin ng tao** | Isang opt-in na opisina ng komunidad, ahensiya, o indibidwal na tagasalin | Isang per-pair na listahan (ang mga detalye sa pakikipag-ugnayan ay nananatiling out-of-band — hindi kailanman sa pampublikong isyu) |
| **Panlabas na inilathalang resulta** | Isang marka na iniulat ng ibang system o papel | Isang **citation** — ang mga panlabas na resulta ay binabanggit (cited), hindi kailanman muling bino-host o muling nira-rank bilang aming sariling sukat |
| **Pagwawasto sa language-card** | May mali, luma, o nawawala sa isang [language card](/catalogue) — isang pagtatantya sa bilang ng nagsasalita, isang status, isang script, isang resource na hindi namin nailista | Isang **cited fix na inilapat sa data source** (ang mga card ay binuo, kaya ang pagwawasto ay nananatili); kapag hindi magkasundo ang mga source, ipinapakita ng card ang lahat ng ito, na may kaukulang pagkilala |

Ang bawat language card ay mayroon ding link na **"Magmungkahi ng pagwawasto o karagdagan"**
na nagbubukas sa form ng pagwawasto kung saan ang wika ay naka-pre-fill na.

**Mga kahilingan ng komunidad para sa pag-alis at paghihigpit.** Kung kayo po ay miyembro ng komunidad
o awtoridad at nais ninyong higpitan o alisin ang data tungkol sa inyong wika, gamitin po ang
form ng pagwawasto (o makipag-ugnayan sa maintainer nang out-of-band kung mas gusto ninyong hindi ito
maging pampubliko). Dumadaan po ang mga ito sa [sovereignty review](/docs/network/sovereignty/data-sovereignty)
nang may prayoridad — hindi na kailangan ng citation.

---

## Paano gumagana ang review

Ito ang mahalagang bahagi: **ang mga submission ay sinusuri ng tao, hindi ng robot.** Kapag nagsumite kayo, nagbubukas kayo ng GitHub issue. Ang issue na iyon ang review queue. Binabasa ito ng maintainer at sinusuri alinsunod sa mga patakaran ng proyekto bago magdagdag ng anuman:

- **IP at lisensiya.** Dapat pinapayagan kaming ilista ito. Ang non-commercial, no-redistribute, o unclear-license na materyal ay maaari pa ring *i-catalogue*, ngunit ibinubukod ito sa anumang commercial / prize / public-fetch lane.
- **Community at sovereignty.** Ang Indigenous at community language data ay inililista lamang nang may pahintulot ng komunidad. Ang provider o custodian ay hindi kailanman pinapangalanan nang publiko bago sila makapag-confirm.
- **Hindi kami kailanman nagho-host ng corpus content.** Ang mga dataset ay inililista bilang metadata kasama ang pointer kung saan kinukuha ang data. **Huwag mag-paste ng source/reference sentences sa isang submission.**
- **Walang personal data.** Walang email, numero ng telepono, o iba pang PII sa isang public issue. Para sa human translation services, ang contact details ay ibinibigay sa maintainer out-of-band.
- **Saklaw.** Ang Bible / liturgical at iba pang colonial-imposition corpora ay wala sa saklaw at tatanggihan.

Nagtatapos ang bawat form sa kinakailangang attestation:

> *"Kinukumpirma kong ito ay maaaring ilista sa publiko, walang corpus content o personal data, at iginagalang ang lisensiya ng source at anumang community/sovereignty restrictions."*

---

## Dalawang paraan para magsumite

### Mula sa inyong browser

Buksan ang issue chooser at piliin ang form na tumutugma sa inyong isinusumite:

➡️ **[Magbukas ng submission form sa GitHub](https://github.com/gamedaysuits/Champollion/issues/new/choose)**

Hinihingi ng bawat form ang kailangan lamang ng katugmang indeks (pangalan, languages/pairs, lisensiya, source URL, at iba pa) at ang attestation checkbox.

### Mula sa CLI

Kung mayroon kayo ng [champollion CLI](/docs/network/getting-started/submit-a-method), `champollion submit` kinokolekta ang mga field at nagbibigay sa inyo ng **pre-filled** na bersyon ng parehong GitHub form:

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

Nagpi-print ang CLI ng URL — buksan ito, suriin ang attestation sa browser, at isumite. Idagdag ang `--out submission.json` upang mag-save din ng lokal at content-free na kopya ng inyong iminumungkahi. Hindi kailanman nag-a-upload ang CLI nang mag-isa at hindi kailanman nagsusulat sa indeks.

---

## Ano ang mangyayari pagkatapos ninyong magsumite

1. Dumarating ang inyong submission bilang GitHub issue — ang review queue.
2. Sinusuri ito ng maintainer alinsunod sa mga patakaran sa IP / lisensiya / sovereignty sa itaas.
3. **Kung tinanggap:** idinaragdag ng maintainer ang entry sa kaukulang source-of-truth (ang dataset registry, isang card, ang method o human-service registry, o ang external-results catalogue) sa pamamagitan ng normal na pagbabago, at nilalagyan ng label na **accepted** ang issue.
4. **Kung hindi ito maililista as-is:** nilalagyan ito ng maintainer ng label na **declined** (o humihingi ng karagdagang impormasyon) kasama ang dahilan.

Walang automatic merge at walang automatic publication. Tao ang nagpapasya sa bawat pagkakataon.

---

## Tingnan Din

- [Magsumite ng Method](/docs/network/getting-started/submit-a-method) — mayroon na kayong benchmark run? Direktang i-publish ang run card.
- [Pag-register ng Corpora](/docs/network/sovereignty/registering-corpora) — exposure tiers (local / private / public / sealed) para sa corpora na pagmamay-ari ninyo.
- [Data Sovereignty](/docs/network/sovereignty/data-sovereignty) — kung paano gumagana rito ang kontrol ng komunidad sa language data.
- [Para sa Mga Komunidad ng Wika](/docs/network/community/for-language-communities) — partnership, consent, at key custody.

