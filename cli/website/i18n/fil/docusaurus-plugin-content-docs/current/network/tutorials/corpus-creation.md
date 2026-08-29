---
sidebar_position: 11
title: "Cookbook: Paglikha ng Corpus"
---

# Gabay sa Paglikha ng Corpus

> **Ang ideya:** Bago ninyo masuri ang isang paraan ng pagsasalin, kailangan ninyo ng corpus para sa pagsusuri. Sinasaklaw ng gabay na ito kung paano bumuo nito mula sa simula — paghahanap ng datos, mga kinakailangan sa format, mga pamantayan sa kalidad, paglilisensiya, at pag-aambag sa Network.

:::info[Hindi ito isang paraan ng pagsasalin]
Ang gabay na ito ay prerequisite para sa maraming pamamaraan. Ang isang mahusay na corpus ng pagsusuri ang pundasyong nagpapaging posible sa lahat ng iba pa. Kahit 50 na na-curate na pares ay sapat upang magbukas ng bagong track sa leaderboard.
:::

## Kailan Ito Gagamitin

- Nais ninyong **magdagdag ng bagong pares ng wika** sa leaderboard ng Network
- Kayo ay isang **guro ng wika** na nais mag-benchmark ng mga salin ng mag-aaral
- Kayo ay isang **tagapagtaguyod ng wika sa komunidad** na may access sa mga materyal na bilingguwal
- Kayo ay isang **mananaliksik** na nangangailangan ng standardized na evaluation set para sa inyong pares ng wika

## Format ng Corpus

Tumatanggap ang harness ng simpleng JSON:

```json title="my-corpus.json"
{
  "metadata": {
    "name": "Quechua Dev v1",
    "version": "1.0.0",
    "source_language": "eng",
    "target_language": "que",
    "entry_count": 75,
    "license": "CC-BY-SA-4.0",
    "author": "Your Name / Organization",
    "description": "75 English-Quechua pairs from educational materials"
  },
  "entries": [
    {
      "id": 1,
      "source": "Hello, how are you?",
      "reference": "Allillanchu, imaynallan kashanki?"
    },
    {
      "id": 2,
      "source": "The sun is shining today",
      "reference": "Kunan p'unchay inti k'anchashan"
    }
  ]
}
```

## Saan Kukuha ng Datos

| Pinagmulan | Kalidad | Dami | Paglilisensiya |
|--------|---------|--------|-----------|
| **Mga aklat-aralin / materyal na pang-edukasyon** | Mataas (sinuri ng eksperto) | Mababa-katamtaman | Suriin sa publisher |
| **Mga dokumento ng pamahalaan** | Katamtaman (pormal na register) | Katamtaman-mataas | Madalas na public domain |
| **Mga bilingguwal na diksyunaryo** | Mataas (beripikadong entries) | Katamtaman | Nag-iiba-iba |
| **Mga nakatatanda / tagapagsalita sa komunidad** | Pinakamataas (katutubong intuitisyon) | Mababa (limitadong oras) | Pinamamahalaan ng komunidad |
| **Mga tekstong panrelihiyon** | Katamtaman (partikular sa domain) | Mataas | Karaniwang bukas |
| **Umiiral na corpora** (Hansard, FLORES) | Katamtaman-mataas | Mataas | Suriin ang lisensiya |
| **Mano-manong ginawa** | Pinakamataas | Mababa | Pag-aari ninyo ito |

## Mga Pamantayan sa Kalidad

Ang mahusay na corpus para sa pagsusuri ay may:

1. **Iba’t ibang nilalaman** — hindi lamang mga pagbati o simpleng parirala. Isama ang mga tanong, utos, kumplikadong pangungusap, at mga terminong partikular sa domain
2. **Beripikadong mga salin** — nirepaso ng hindi bababa sa isang matatas na tagapagsalita, mas mainam kung dalawa
3. **Konsistent na ortograpiya** — isang script, isang kumbensiyon sa pagbabaybay sa kabuuan
4. **Independiyenteng mga pinagmulan** — hindi hinango mula sa parehong teksto na pagsasanayan ng mga paraan
5. **Malinaw na paglilisensiya** — tahasang lisensiyang nagpapahintulot ng paggamit para sa pagsusuri

:::danger[Kontaminasyon ng corpus]
Ang corpus ng pagsusuri ay dapat na **independent** sa anumang training data. Kung ang isang pamamaraan ay na-train o na-prompt gamit ang data mula sa corpus ng pagsusuri, ito ay madidisqualify. Idisenyo ang inyong corpus upang maging held-out mula sa unang araw.
:::

## Mga Gabay sa Laki

| Laki | Ano ang Nagagawa Nito |
|------|----------------|
| **50 entries** | Pinakamababang praktikal na pagsusuri — sapat upang matukoy ang malalaking pagkakaiba sa kalidad |
| **100–200 entries** | Maaasahang ranking — sapat para sa statistical significance sa pagitan ng mga paraan |
| **500+ entries** | Antas-pananaliksik — matatag na composite scores, confidence intervals |
| **1,000+ entries** | Gold standard — katumbas ng coverage ng FLORES devtest |

Magsimula sa maliit. Sapat na ang 50 entries upang magbukas ng leaderboard track. Maaari ninyo itong palawakin kalaunan.

## Pag-aambag sa Network

1. **Gawin ang inyong corpus** sa JSON format sa itaas
2. **Lisensiyahan ito** — inirerekomenda ang CC BY-SA 4.0 para sa bukas na pagsusuri; CC BY-NC-SA 4.0 para sa restricted use
3. **I-host ito sa isang matatag na source** (inyong sariling repository, isang institutional archive, o isang data registry) — hindi kailanman nagho-host o nagta-track ang Champollion ng nilalaman ng corpus
4. **Magsumite ng fetch-from-source metadata card** — magbukas ng PR laban sa [pampublikong repo](https://github.com/gamedaysuits/Champollion) na nagdaragdag ng registry entry na nagtuturo sa harness sa inyong upstream source (loader/URL, SHA pin, license, provenance); tingnan ang [Mga Dataset](/docs/network/leaderboard/datasets#creating-a-new-dataset) para sa format ng card
5. **Magbubukas ang leaderboard** para sa inyong language pair kapag na-merge na ang card

## Para sa mga Komunidad ng Katutubong Wika

Ang paglikha ng corpus ay isang gawain ng **soberanya sa wika**. Ang inyong corpus, ang inyong mga kondisyon:

- Kayo ang magpapasya sa lisensiya at mga kondisyon ng access
- Maaari kayong mag-ambag ng **pampublikong development set** (para sa pagbuo ng paraan) habang pinananatili ang isang **lihim na test set** (para sa opisyal na pagsusuri) sa ilalim ng kontrol ng komunidad
- Pinoprotektahan ng [framework ng soberanya](/docs/network/sovereignty/data-sovereignty) ang inyong datos sa bawat antas

Kahit ang maliit na corpus ay isang **estratehikong asset** — ito ang benchmark na nagpapasya kung ano ang ibig sabihin ng "sapat na mabuti" para sa inyong wika.

## Mahusay na Naipapares Sa

- **[Bahagyang Pagsasalin](./partial-translation)** — ang paglikha ng corpus ANG hakbang ng pagsasaling pantao
- **[Back-Translation](./back-translation)** — ang synthetic data ay pandagdag sa mga corpus na ginawa ng tao
- Bawat iba pang cookbook — lahat sila ay nangangailangan ng corpus para sa pagsusuri

## Tingnan Din

- [Mga Dataset para sa Pagsusuri](/docs/network/leaderboard/datasets) — mga umiiral na corpus (EDTeKLA, FLORES+)
- [Soberanya sa Datos](/docs/network/sovereignty/data-sovereignty) — pagmamay-ari at kontrol
- [Para sa mga Komunidad ng Wika](/docs/network/community/for-language-communities) — pakikilahok ng komunidad
- [Suportahan ang Isang Low-Resource na Wika](/docs/network/community/low-resource-languages) — ang kabuuang larawan
