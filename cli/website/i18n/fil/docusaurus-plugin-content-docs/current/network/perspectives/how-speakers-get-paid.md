---
sidebar_position: 2
title: "Paano Binabayaran ang mga Tagapagsalita"
slug: '/network/perspectives/how-speakers-get-paid'
description: "Kung ano ang ibinabayad sa mga community validator at translator para sa benchmark work, kung bakit hindi maaaring ikompromiso ang pagbabayad sa mga tagapagsalita, at kung paano lumalaki ang kompensasyon habang lumalago ang Network. Ang lahat ng bilang ay mula sa mga nailathalang specification."
related:
  - label: "Speaker Validation Protocol"
    to: /docs/network/specifications/speaker-validation
    kind: spec
    note: "The work validators are paid for"
  - label: "Prize Specification"
    to: /docs/network/specifications/prizes
    kind: spec
    note: "Where prize money goes, and why"
  - label: "The Economic Model"
    to: /docs/network/sovereignty/economic-model
    kind: doc
  - label: "Reporting Errors and Owning Corrections"
    to: /docs/network/perspectives/reporting-errors-and-owning-corrections
    kind: position
---

# Paano Binabayaran ang mga Tagapagsalita

> **Tala sa transparency.** Ang bawat bilang sa pahinang ito ay lumalabas na sa isang nailathalang specification — ang [Benchmark Specification §10](/docs/network/specifications/benchmark#10-cost-framework), ang [Speaker Validation Protocol](/docs/network/specifications/speaker-validation), at ang [Prize Specification](/docs/network/specifications/prizes). Pinagsasama-sama ng pahinang ito ang mga iyon sa iisang lugar, sa payak na wika, upang walang kailangang magbasa ng spec para malaman kung magkano ang halaga ng oras ng tagapagsalita rito. Wala itong ipinapangakong higit sa kung ano ang nakasaad na sa mga dokumentong iyon.

Ang bilingual na tagapagsalita na kayang humusga kung ang isang pangungusap na ginawa ng machine ay tunay, matatas, at tama ang kahulugan ang pinakabihira at pinakamahalagang kalahok sa buong sistemang ito. Ang lahat ng iba pa — harnesses, metrics, leaderboards — ay umiiral upang mapalawak ang maaabot ng maliit na bahagi ng oras ng taong iyon.

Kaya simple lamang ang unang panuntunan: **binabayaran ang mga tagapagsalita para sa kanilang oras, sa mga propesyonal na rate, anuman ang ipakita ng mga resulta** — kapag napondohan na ang gawaing ito. Walang pondo sa kasalukuyan, kaya walang gawaing isinasagawa ang mga tagapagsalita ngayon.

---

## Bakit hindi maaaring ipagpaliban ang pagbabayad sa mga tagapagsalita

Matagal nang nakasanayan ng pananaliksik sa language technology na ituring ang matatas na mga tagapagsalita bilang libreng resource — "community engagement" na lumilikha ng datasets, papers, at careers para sa lahat maliban sa mga tagapagsalita. Itinuturing namin ang pattern na iyon bilang mapagsamantala, at ang mga taong pinakakwalipikadong gawin ang gawaing ito ay siya ring mga taong ang oras ay nakalaan na sa agarang gawain ng pagtuturo, pagsasalin, at pagpapalaki ng mga bata sa wika.

Tatlong design consequences ang sumusunod:

1. **Walang volunteer pipeline.** Hindi namin hinihiling sa mga tagapagsalita na mag-abuloy ng gawaing pagsusuri bilang pabor sa pananaliksik. Ang pakikilahok ay isang binabayarang pakikipag-ugnayan, at walang anumang mawawala sa isang tagapagsalita kung tatanggihan ito.
2. **Walang pasubali ang pagbabayad.** Babayaran ang mga tagapagsalita gagamitin man o hindi ang kanilang mga rating, at ang bayad ay hindi nakasalalay sa mga resulta. Nangangako ang inilathalang protocol na magbayad sa loob ng dalawang linggo pagkatapos makumpleto ang bawat task block.
3. **Hindi lamang kabayaran ang kabuuang kasunduan.** Ang mga tagapagsalitang nag-aambag ng mga rating ay tumatanggap din ng pagkilala (pinangalanan o hindi nagpakilala, ayon sa kanilang nais), opsyonal na co-authorship sa mga publikasyong gumagamit ng kanilang mga rating, ang karapatang bawiin ang kanilang mga kontribusyon anumang oras, at kapangyarihang mag-veto sa paglalathala ng mga resultang itinuturing nilang may problema. Ang mga tuntuning iyon ay nasa [Speaker Validation Protocol §5–6](/docs/network/specifications/speaker-validation), hindi sa isang hiwalay na liham.

## Ang nailathalang mga rate

Itinakda ng benchmark cost framework ang compensation para sa bilingual na tagapagsalita sa **$50–65 CAD kada oras** para sa corpus at validation work. Ang ibig sabihin nito sa bawat tungkulin:

### Pagbuo ng benchmark corpus

Ang paggawa ng reference translations na siyang pinagbabatayan ng scoring ng bawat method ang foundational speaker task. Ang nailathalang establishment budget kada wika:

| Gawain | Nailathalang range | Batayan |
|------|-----------------|-------|
| Corpus curation (50–150 entries) | $2,500–6,000 | $50–65/hr, oras ng bilingual na tagapagsalita |
| Pagrereview ng method output | $500–1,500 | Parehong hourly rates |

Karaniwang umaabot nang humigit-kumulang 80 oras ang isang buong corpus para sa isang tagapagsalita; ang nakaplanong agent-assisted workflow (sentence drafting at formatting na hinahawakan ng tooling, ngunit ang pagsasalin ay palaging ng tao) ay idinisenyong ibaba iyon tungo sa 30–40 oras — mas kaunting oras sa paulit-ulit na gawain, parehong hourly rate, at ginagawa lamang ng tagapagsalita ang mga bahaging tunay na nangangailangan ng tao.

### Pag-validate ng metrics

Bago magkaroon ng anumang saysay ang automated scores, kailangang suriin ng mga tagapagsalita ang mga iyon laban sa human judgment. Inilalathala ng [Speaker Validation Protocol](/docs/network/specifications/speaker-validation) ang eksaktong tasks, oras, at bayad:

| Gawain | Oras | Bayad kada tagapagsalita |
|------|------|-----------------|
| A — Mag-rate ng 200 machine translations para sa adequacy at fluency | ~8 oras | $400–520 CAD |
| B — Magreview ng 50 "equivalent" translation pairs | ~2 oras | $100–130 CAD |
| C — Magreview ng 100 salita na nireject ng morphological analyzer | ~1.5 oras | $75–100 CAD |

Ang tagapagsalitang gagawa ng lahat ng tatlo ay maglalaan ng humigit-kumulang 11.5 oras sa loob ng dalawa hanggang apat na linggo kapalit ng **$575–750 CAD**. Ang buong three-speaker validation round ay nagkakahalaga sa proyekto ng $1,475–1,920 — at iyon ang punto: maliit na line item para sa proyekto ang speaker validation at hindi dapat kailanman maging lugar kung saan "nagtitipid" sa gastos.

### Pagrereview ng prize claims

Walang premyong ibinabayad batay lamang sa mga awtomatikong marka. Ang iminungkahing [Founder's Prize](/docs/network/specifications/prizes) ($10,000 CAD, English→Plains Cree — hindi pa bukas, at walang hawak na pondo sa kasalukuyan) ay mangangailangan na hindi bababa sa dalawang bilingguwal na tagapagsalita ang independiyenteng susuri sa isang stratified sample ng hindi bababa sa 30 output, at 70% o higit pa ang mabigyan ng rating na "katanggap-tanggap" o "mahusay." Ang pagsusuring iyon ay binabayarang gawain ng tagapagsalita sa ilalim ng parehong mga rate — at isa rin itong gate: maaaring ibasura ng mga tagapagsalita ang isang pag-angkin sa premyo, at sadya itong idinisenyo nang ganoon.

## Paano ito nag-scale sa contests

Idinisenyo ang model upang lumago ang speaker compensation kasabay ng platform sa halip na matunaw dahil dito:

- **Nagsisimula ang bawat bagong wika sa isang bayad na corpus engagement.** Ang nailathalang establishment cost kada wika ($3,350–8,500 all-in) ay karamihan ay speaker compensation — sadyang ito ang pinakamalaking single component.
- **May sarili nitong bayad na review ang bawat bagong prize pool.** Ang bawat sponsored contest na sumusunod sa [prize template](/docs/network/specifications/prizes#4-future-prize-pools) ay may parehong community-validation requirement, na nangangahulugang pinopondohan ng bawat contest ang speaker review work para sa wikang iyon.
- **Ang community-owned methods ay nananatiling community-funded assets.** Ang isang transferred method ay ganap na pag-aari ng governance organization — anumang kitain nito mula sa pag-deploy nito ay ganap na sa komunidad ([How the Work Is Funded](/docs/network/sovereignty/economic-model)), magagamit para sa patuloy na review, paglago ng corpus, at mga language program ayon sa kanilang pasya. Desisyon iyon ng komunidad, hindi namin.

## Ang *hindi* namin ipinangako

Kailangan ng katapatan na markahan ang mga hangganan:

- Ang mga rate sa itaas ay ang nilalayon naming ibayad para sa gawaing Plains Cree kapag napondohan na ito; walang ganoong gawaing pinopondohan o isinasagawa sa kasalukuyan. Ang mga rate para sa mga wika sa hinaharap ay itatakda kasama ang katuwang na komunidad at ilalathala sa parehong paraan — sa mga detalye, bago magsimula ang gawain.
- Ang Champollion ay di-komersyal, hindi kumikita ng sarili nitong revenue, at kasalukuyang **sariling pinopondohan ng tagapagtatag nito** — pondo mula sa grant at sponsor ang aming hinahanap, hindi ang mayroon kami ngayon. Inilalarawan ng [Paano Pinopondohan ang Gawain](/docs/network/sovereignty/economic-model) ang mekanismo, hindi isang garantiya.
- Ang "patas na binayaran" ay kailangan ngunit hindi sapat. Ang pagbabayad lamang ay hindi awtomatikong ginagawang di-extractive ang isang proyekto — pagmamay-ari at kontrol ang gumagawa nito, kung kaya ang kompensasyon ay nakapaloob sa [modelo ng pangangasiwa](/docs/network/sovereignty/data-sovereignty) sa halip na palitan ito.

---

## Ano ang ibig sabihin nito para sa inyo

:::info[Kung kayo ay miyembro ng komunidad]
Kung bilingual kayo sa isang wikang kulang sa suporta at sa English, ang inyong paghatol ang pinakamahalagang input sa sistemang ito, at ang mga nakasaad na kondisyon ay: $50–65 CAD/oras, flexible na iskedyul, bayad sa loob ng dalawang linggo, pagkilala ayon sa inyong mga tuntunin, at karapatang bawiin ang inyong mga kontribusyon. Hindi kailangan ang programming. Magsimula sa [Para sa mga Komunidad ng Wika](/docs/network/community/for-language-communities) o sa [Protokol sa Pagpapatunay ng Tagapagsalita §7](/docs/network/specifications/speaker-validation#7-how-to-get-started).
:::

:::info[Kung kayo ay researcher]
Ilaan sa badyet ang kabayaran sa mga tagapagsalita bilang pangunahing gastos sa pananaliksik — ang mga nakasaad na halaga ($1,475–1,920 para sa isang metric-validation round; $2,500–6,000 para sa corpus curation) ay maliit ayon sa mga pamantayan ng grant, at ang mga ito ang nagpapaging maipagtatanggol sa mga automated score. Ipinapakita ng [Estratehiya sa Pakikipag-partner para sa Corpus](/docs/network/specifications/corpus-partnership) kung paano makakakonekta rito ang isang academic department na may nakapaloob na pinopondohang gawain ng mga tagapagsalita.
:::

:::info[Kung kayo ay tagabuo]
Nakikinabang kayo sa bayad na gawain ng mga tagapagsalita kahit hindi ninyo ito kailanman pinopondohan: ang mga validated metric ang nagpapakahulugan sa inyong score sa leaderboard, at ang may bayad na pagsusuri ng komunidad ang nakatayo sa pagitan ng inyong method at ng isang premyo. Kung mananalo kayo, asahan na nabayaran ang mga tagapagsalita upang masusing suriin ang inyong output — at asahan ang [paglipat ng pagmamay-ari ng inyong method](/docs/network/sovereignty/ownership-transfer) sa komunidad na pinaglilingkuran ng wikang iyon.
:::

## Tingnan din

- [Ang Pagsasalin ay Hindi Revitalization](/docs/network/perspectives/translation-is-not-revitalization) — kung bakit hinuhubog ng authority ng tagapagsalita ang lahat ng iba pa
- [Pag-uulat ng Errors at Pagmamay-ari ng Corrections](/docs/network/perspectives/reporting-errors-and-owning-corrections) — authority ng tagapagsalita pagkatapos din ng benchmark
- [Benchmark Specification §10](/docs/network/specifications/benchmark#10-cost-framework) — ang buong cost framework na pinagmulan ng mga bilang na ito
