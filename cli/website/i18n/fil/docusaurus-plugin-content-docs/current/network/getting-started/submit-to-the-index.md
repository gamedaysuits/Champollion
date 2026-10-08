---
sidebar_position: 0
title: "Isumite sa Index"
description: "Magmungkahi ng dataset, resource, pamamaraan, serbisyo ng pagsasalin ng tao, o panlabas na resulta — o magmungkahi ng pagwawasto sa language-card. Ang bawat pagsusumite ay sinusuri ng tao para sa pagsunod sa IP, lisensya, at soberanya — walang awtomatikong inaaprubahan."
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

| Uri | Ano ito | Ano ang aming idinaragdag |
|---|---|---|
| **Benchmark / dataset** | Isang corpus para sa ebalwasyon o benchmark | Isang metadata card + isang pointer para sa *fetch-from-source* — hinding-hindi ang nilalaman ng corpus |
| **Resource** | Isang diksiyonaryo, archive, app, FST (morphological analyzer), o tool | Isang listing na may pointer + antas ng access (open / restricted / kailangan ng pahintulot) |
| **Translation method** | Isang MT engine, LLM provider, o pipeline | Isang entry sa registry ng pamamaraan upang maaari itong patakbuhin at ma-benchmark |
| **Human translation service** | Isang opt-in na tanggapan ng komunidad, ahensya, o indibidwal na tagasalin | Isang listing bawat pares ng wika (ang mga detalye sa pakikipag-ugnayan ay nananatiling out-of-band — hinding-hindi sa pampublikong issue) |
| **External published result** | Isang score na iniulat ng isa pang sistema o papel | Isang **pagsipi (citation)** — ang mga panlabas na resulta ay sinisipi, hinding-hindi muling ino-host o muling niraranggo bilang sarili nating sukat |
| **Language-card correction** | May mali, luma, o nawawala sa isang [language card](/catalogue) — isang pagtatantya ng bilang ng tagapagsalita, isang katayuan, isang script, isang resource na hindi pa namin nailista | Isang **siniping pagwawasto na inilapat sa mismong data source** (awtomatikong nabubuo ang mga card, kaya nananatili ang pagwawasto); kapag hindi nagtutugma ang mga source, ipinapakita ng card ang lahat ng mga ito, na may pagkilala |

Naglalaman din ang bawat language card ng link na **"Suggest a correction or addition"**
na nagbubukas sa form ng pagwawasto kung saan paunang napunan na ang wika.

**Mga kahilingan ng komunidad para sa pag-aalis at paghihigpit.** Kung kayo ay miyembro
ng komunidad o may awtoridad at nais ninyong paghigpitan o alisin ang data tungkol sa inyong wika, gamitin ang
form ng pagwawasto (o makipag-ugnayan sa maintainer nang out-of-band kung nais ninyong hindi ito
maging pampubliko). Dumaraan ang mga ito sa [pagsusuri ng soberanya](/docs/network/sovereignty/data-sovereignty)
nang may prayoridad — walang kinakailangang pagsipi.

---

## Paano gumagana ang review

Ito ang mahalagang bahagi: **ang mga submission ay sinusuri ng tao, hindi ng robot.** Kapag nagsumite kayo, nagbubukas kayo ng GitHub issue. Ang issue na iyon ang review queue. Binabasa ito ng maintainer at sinusuri alinsunod sa mga patakaran ng proyekto bago magdagdag ng anuman:

- **IP at lisensya.** Dapat ay may pahintulot kaming ilista ito. Ang materyal na non-commercial, no-redistribute, o hindi malinaw ang lisensya ay maaari pa ring *ikatalogo*, ngunit hindi ito isasama sa anumang commercial / prize / public-fetch na lane.
- **Komunidad at soberanya.** Ang data ng wikang Katutubo at pangkomunidad ay inililista lamang nang may pahintulot ng komunidad. Hinding-hindi pampublikong papangalanan ang isang tagapagbigay o tagapangalaga bago nila ito kumpirmahin.
- **Hinding-hindi kami nagho-host ng nilalaman ng corpus.** Ang mga dataset ay inililista bilang metadata kasama ang isang pointer patungo sa kung saan kinukuha ang data. **Huwag mag-paste ng mga pangungusap na source/reference sa isang pagsusumite.**
- **Walang personal na data.** Walang mga email, numero ng telepono, o iba pang PII sa isang pampublikong issue. Para sa mga serbisyo ng pagsasalin ng tao, ang mga detalye sa pakikipag-ugnayan ay ibinibigay sa maintainer nang out-of-band.
- **Saklaw.** Ang mga corpus ng Bibliya / liturhikal at iba pang kolonyal na pagpapataw ay hindi saklaw at tatanggihan.

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
