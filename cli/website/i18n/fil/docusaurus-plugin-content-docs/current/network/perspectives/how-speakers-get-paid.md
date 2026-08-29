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

Kaya simple ang unang tuntunin: **binabayaran ang mga tagapagsalita para sa kanilang oras, sa propesyonal na mga rate, anuman ang ipakita ng mga resulta.**

---

## Bakit hindi maaaring ipagpaliban ang pagbabayad sa mga tagapagsalita

Matagal nang nakasanayan ng pananaliksik sa language technology na ituring ang matatas na mga tagapagsalita bilang libreng resource — "community engagement" na lumilikha ng datasets, papers, at careers para sa lahat maliban sa mga tagapagsalita. Itinuturing namin ang pattern na iyon bilang mapagsamantala, at ang mga taong pinakakwalipikadong gawin ang gawaing ito ay siya ring mga taong ang oras ay nakalaan na sa agarang gawain ng pagtuturo, pagsasalin, at pagpapalaki ng mga bata sa wika.

Tatlong design consequences ang sumusunod:

1. **Walang volunteer pipeline.** Hindi namin hinihiling sa mga tagapagsalita na mag-donate ng evaluation work bilang pabor sa pananaliksik. Ang participation ay bayad na engagement, at walang mawawala sa tagapagsalita kung tatanggihan nila ito.
2. **Walang kondisyon ang bayad.** Binabayaran ang mga tagapagsalita gamitin man o hindi ang kanilang ratings, at hindi nakadepende ang bayad sa mga resulta. Nangangako ang nailathalang protocol ng bayad sa loob ng dalawang linggo matapos makumpleto ang bawat task block.
3. **Hindi kabuuan ng usapan ang compensation.** Ang mga tagapagsalitang nag-aambag ng ratings ay tumatanggap din ng credit (nakapangalan o anonymous, ayon sa kanilang pili), optional co-authorship sa mga publication na gumagamit ng kanilang ratings, karapatang bawiin ang kanilang mga kontribusyon anumang oras, at veto power sa paglalathala ng mga resultang nakikita nilang problematic. Ang mga tuntuning iyon ay nasa [Speaker Validation Protocol §5–6](/docs/network/specifications/speaker-validation), hindi sa isang side letter.

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

Walang prize na binabayaran batay lamang sa automated scores. Kinakailangan ng [Founder's Prize](/docs/network/specifications/prizes) ($10,000 CAD, English→Plains Cree) na hindi bababa sa dalawang bilingual na tagapagsalita ang independent na magreview ng stratified sample na may hindi bababa sa 30 outputs, at 70% o higit pa ang ma-rate bilang "katanggap-tanggap" o "napakahusay." Ang review na iyon ay bayad na speaker work sa ilalim ng parehong mga rate — at isa rin itong gate: maaaring pabagsakin ng mga tagapagsalita ang isang prize claim, at sinadya iyon sa design.

## Paano ito nag-scale sa contests

Idinisenyo ang model upang lumago ang speaker compensation kasabay ng platform sa halip na matunaw dahil dito:

- **Nagsisimula ang bawat bagong wika sa isang bayad na corpus engagement.** Ang nailathalang establishment cost kada wika ($3,350–8,500 all-in) ay karamihan ay speaker compensation — sadyang ito ang pinakamalaking single component.
- **May sarili nitong bayad na review ang bawat bagong prize pool.** Ang bawat sponsored contest na sumusunod sa [prize template](/docs/network/specifications/prizes#4-future-prize-pools) ay may parehong community-validation requirement, na nangangahulugang pinopondohan ng bawat contest ang speaker review work para sa wikang iyon.
- **Ang community-owned methods ay nananatiling community-funded assets.** Ang isang transferred method ay ganap na pag-aari ng governance organization — anumang kitain nito mula sa pag-deploy nito ay ganap na sa komunidad ([How the Work Is Funded](/docs/network/sovereignty/economic-model)), magagamit para sa patuloy na review, paglago ng corpus, at mga language program ayon sa kanilang pasya. Desisyon iyon ng komunidad, hindi namin.

## Ang *hindi* namin ipinangako

Kailangan ng katapatan na markahan ang mga hangganan:

- Ang mga rate sa itaas ay ang nailathalang mga rate para sa kasalukuyang Plains Cree work. Ang mga rate para sa mga wika sa hinaharap ay itatakda kasama ang partner community at ilalathala sa parehong paraan — sa specs, bago magsimula ang gawain.
- Ang Champollion ay non-commercial, walang sariling revenue na nalilikha, at kasalukuyang **self-funded ng founder nito** — grant at sponsor funding ang hinahanap namin, hindi ang mayroon na kami. Inilalarawan ng [How the Work Is Funded](/docs/network/sovereignty/economic-model) ang mechanism, hindi isang garantiya.
- Kailangan ang "makatarungang bayad" ngunit hindi ito sapat. Ang bayad sa sarili nito ay hindi gumagawa sa isang proyekto na hindi mapagsamantala — ownership at control ang gumagawa nito, kaya ang compensation ay nakapaloob sa [stewardship model](/docs/network/sovereignty/data-sovereignty) sa halip na palitan ito.

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
