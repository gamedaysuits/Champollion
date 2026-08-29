---
sidebar_position: 1
title: "Para sa mga Komunidad ng Wika"
---

# Para sa mga Komunidad ng Wika

> **Ehekutibong Buod.** Maaaring ariin ng inyong komunidad ang sarili nitong test set — ang "susi ng sagot" na pinagbabatayan ng pagsukat sa bawat paraan ng pagsasalin — at magpatakbo ng sarili nitong paligsahan ayon sa sarili nitong mga tuntunin, nang hindi kailanman ipinapasa ang data. Ipinapaliwanag ng pahinang ito kung ano ang hinihingi ng Network mula sa mga komunidad ng wika (mga reference translation, pagsusuri ng pagsasalin, coaching data), kung ano ang makukuha ninyo bilang kapalit (bayad na trabaho sa mga nakapaskil na rate, pagmamay-ari ng code, ganap na kontrol sa deployment), at ang mga garantiya ng soberanya na nauuna sa lahat. Hindi kailangan ang programming, at wala rito ang nangangailangang magtiwala sa amin: ang mga garantiya ay nakapaloob sa istruktura, hindi mga pangako lamang.

Hindi po ninyo kailangang maging programmer para makapag-ambag sa Network. Kung nagsasalita kayo ng isang Katutubo o low-resource na wika, kayo ang pinakamahalagang tao sa ecosystem na ito.

---

## Nauuna ang Soberanya

Bago kami humingi ng anuman mula sa inyo, ito ang pangunahing patakaran: **ang data ng inyong wika ay sa inyo.** Ang data ng wika ay *biodata* — dala nito ang identidad at mga ugnayan ng inyong komunidad at hindi ito maaaring gawing tunay na anonymous sa makabuluhang paraan — kaya ang mga taong nagbibigay nito ang may hawak ng mga susi rito, at sa anumang sinusukat laban dito. Ang Network ay nakabatay sa [mga prinsipyo ng Indigenous data sovereignty](/docs/network/sovereignty/data-sovereignty):

- Hindi namin kailanman kinokolekta o iniimbak ang inyong linguistic data sa aming mga server
- Ginagamit ng mga paraan ng pagsasalin ang arkitekturang `api` — nananatili ang lahat ng coaching data, diksyunaryo, at tuntunin sa gramatika sa imprastrukturang kontrolado ninyo
- Kayo ang nagpapasya kung sino ang maaaring bumuo ng mga paraan para sa inyong wika
- Pinatutunayan ng mga score sa leaderboard na gumagana ang isang paraan; hindi ito nagbibigay ng pahintulot na i-deploy ito

:::note[Kalagayan nito sa kasalukuyan]
Ang modelo ng paglilipat ng pagmamay-ari na inilalarawan sa ibaba ay isang **nakatalagang disenyo, hindi pa isang tumatakbong programa.** Bukas ang leaderboard para sa mga pagsusumite at sa kasalukuyan ay wala pang na-publish na mga run, at wala pang pamamaraan na naililipat sa isang komunidad. Inilalarawan namin kung paano ito idinisenyong gumana upang maaari ninyo kaming panagutin dito — hindi upang magmungkahi na ito ay kasalukuyan nang isinasagawa. Ang ugnayan, at ang inyong awtoridad sa inyong data, ang inuuna; ang iba pa ay sumusunod mula roon.
:::

---

## Ariin ang Inyong Test Set

Ang pinakamalakas na posisyong maaaring hawakan ng isang komunidad sa sistemang ito ay **ang pagmamay-ari sa
benchmark mismo**. Ang test set ang susi ng sagot: sinumang may hawak nito ang nagpapasya
kung ano ang ibig sabihin ng "mahusay na pagsasalin" para sa wika, at bawat paraan — ang amin,
sa isang korporasyon, o sa sinuman — ay sinusukat laban sa *inyong* pamantayan.

- **Metadata ang registration, hindi content.** Ang pag-register ng corpus sa
  Network ay nangangahulugang pag-publish ng isang descriptive card — hindi kailanman pag-upload ng corpus.
  Pinipili ninyo ang [exposure lane](/docs/network/sovereignty/registering-corpora) nito:
  open, gated, o fully sovereign.
- **Nananatiling lihim ang mga sovereign benchmark.** Sa sovereign lane, ang test set ay
  hindi kailanman umaalis sa imprastruktura ng komunidad at hindi namin ito kailanman nakikita. Ang mga paraan ay
  sini-score laban dito sa inyong panig; ang score lamang ang lumalabas.
- **Maaari kayong magpatakbo ng sarili ninyong paligsahan.** Ang step-by-step runbook —
  [Magpatakbo ng Sovereign Contest](/docs/network/sovereignty/run-a-sovereign-contest)
  — ay gumagabay sa pag-host ng isang community-controlled na evaluation ayon sa sarili ninyong
  mga tuntunin: ang inyong test set, ang inyong mga patakaran, ang inyong pasya tungkol sa kung ano (kung mayroon man)
  ang ipa-publish.

Ang mga garantiya sa likod ng lahat ng ito ay nakasulat, hindi ipinapalagay:
[Data Stewardship](/docs/network/sovereignty/data-sovereignty) (ang posisyong data-sovereignty/CARE
at kung ano ang ipinagbabawal nitong gawin namin) at
[Pagmamay-ari at Mga Tuntunin](/docs/network/sovereignty/ownership-transfer) (kung ano ang
nangyayari, ayon sa kontrata, kapag nanalo ang isang paraan).

---

## Ang Kailangan Namin Mula sa Inyo

### Mga reference translation

Kailangan namin ng mga curated na pares ng pagsasalin para sa evaluation — English sa isang panig, ang inyong wika sa kabila. Nagiging "susi ng sagot" ang mga ito na pinagbabatayan ng pag-score sa lahat ng paraan ng pagsasalin.

Maaari ninyong likhain ang mga ito mula sa:
- **Mga materyales pang-edukasyon** — mga exercise sa textbook, lesson plan, worksheet
- **Mga dokumento ng komunidad** — minutes ng pulong, newsletter, anunsyo
- **Mga pang-araw-araw na parirala** — UI string, label ng app, karaniwang ekspresyon
- **Nilalamang pangkultura** — mga kuwento, awit, o paglalarawan (na may naaangkop na mga pahintulot)

Simple ang format na JSON:
```json
{
  "entries": [
    { "id": 1, "source": "Hello", "reference": "tânisi" },
    { "id": 2, "source": "Thank you", "reference": "kinanâskomitin" }
  ]
}
```

### Pagsusuri ng pagsasalin

Ang bawat paraan na nagsasabing nakagagawa ito ng gumaganang mga pagsasalin ay nangangailangan ng human validation. Sinusuri ng mga bilingual speaker ang mga output at sinasabi sa amin kung nakuha ito nang tama ng computer — at higit sa lahat, *bakit* ito nagkamali.

### Coaching data

Mga tuntunin sa gramatika, entry sa diksyunaryo, morphological pattern — ito ang mga linguistic resource na nagpapagana sa mga paraan ng pagsasalin. Ang inyong kaalaman kung paano gumagana ang inyong wika ay hindi mapapalitan ng anumang AI model.

---

## Ang Makukuha Ninyo Bilang Kapalit

### Pagmamay-ari

Kapag may paraan ng pagsasalin na binuo para sa inyong wika at na-validate sa Network, ang [pagmamay-ari ay inililipat](/docs/network/sovereignty/ownership-transfer) sa governance organization ng inyong komunidad. Pag-aari ninyo ang code, ang model weights, at ang deployment.

### Bayad na trabaho, hindi pagkuha nang walang kapalit

Ang pagbuo ng corpus at pagsusuri ng pagsasalin ay propesyonal na trabaho, binabayaran sa
[mga nakapaskil na rate](/docs/network/perspectives/how-speakers-get-paid) — at
hindi binibili ng bayad ang inyong data. Binabayaran kayo para sa trabaho *at* nananatili kayong
may-ari ng inyong binubuo. Ang Champollion ay isang non-commercial na research project: wala itong
ibinebenta, wala itong mine-meter, at [hindi kumukuha ng bahagi](/docs/network/sovereignty/economic-model)
sa anumang kailanman kikitain ng inyong komunidad mula sa isang paraang pag-aari nito.

### Kontrol

Kontrolado ng inyong governance organization ang:
- Sino ang maaaring maka-access sa paraan
- Kung maaari itong gamitin nang commercial — at kung oo, ayon sa inyong mga tuntunin, habang pinapanatili ang lahat ng kinikita nito
- Kailan at paano ito ina-update
- Anong data ang ginagamit para sa karagdagang development

---

## Paano Makilahok

:::tip[Isang bagay na maaaring gawin ng mga tagapagsalita ngayon]
Hindi bumubuo o nagho-host ng corpora ang Champollion — ang test data ay palaging kinukuha
mula sa pinagmulan nito. Kung nais ng mga tagapagsalita sa inyong komunidad na mag-ambag ng mga pangungusap
*sa ngayon mismo*, tumatanggap ang [Tatoeba](https://tatoeba.org) ng paisa-isang pangungusap na
kontribusyon sa anumang wika, at ang mga bukas na koleksiyon tulad ng
[OPUS](https://opus.nlpl.eu/) ay nagtitipon ng parallel text na ginagamit ng Network upang bumuo ng
benchmarks. Ang mga pangungusap na idinagdag doon ay maaaring maging evaluation data rito sa
susunod na corpus build. Ang isang direktang app para sa kontribusyon ng mga tagapagsalita at corpus builder
ang nakaplanong susunod na hakbang sa aming roadmap.
:::

1. **Makipag-ugnayan** — Magbukas ng issue sa [Network repository](https://github.com/gamedaysuits/Champollion) o mag-email sa [info@champollion.dev](mailto:info@champollion.dev)
2. **Ilarawan ang inyong wika** — Anong pamilya ito kabilang? Ilan ang mga speaker? Anong mga writing system ang ginagamit? Anong computational resources ang umiiral (FSTs, dictionaries, corpora)?
3. **Magsimula sa maliit** — Kahit 50 curated na pares ng pagsasalin ay sapat upang makalikha ng evaluation dataset at magbukas ng bagong leaderboard track. Ang corpus work ay [binabayaran sa mga nakapaskil na rate](/docs/network/perspectives/how-speakers-get-paid)
4. **Panatilihin itong sa inyo** — I-register ang corpus bilang metadata sa lane na pipiliin ninyo ([Pag-register ng Corpora](/docs/network/sovereignty/registering-corpora)); kung nais ninyong manatiling ganap na lihim ang test set, ang [sovereign contest runbook](/docs/network/sovereignty/run-a-sovereign-contest) ang daan
5. **Ikonekta kami sa governance** — Sino sa inyong komunidad ang may awtoridad sa data ng wika at teknolohiya? Nangangailangan ang sovereignty model ng Network ng governance partner

---

## Tingnan Din

- [Magpatakbo ng Sovereign Contest](/docs/network/sovereignty/run-a-sovereign-contest) — ang runbook para sa isang community-controlled na evaluation
- [Mga Template ng Tuntunin](/docs/network/sovereignty/terms-templates) — legal na simple, trustless-leaning na mga tuntuning maaaring iakma ng inyong komunidad, kasama ang malinaw na paglalahad ng mga panganib na trojan-horse
- [Data Stewardship](/docs/network/sovereignty/data-sovereignty) — ang posisyon, at ang mga framework (mga prinsipyo ng Indigenous data sovereignty, CARE, Te Mana Raraunga) na humubog dito
- [Pagmamay-ari at Mga Tuntunin](/docs/network/sovereignty/ownership-transfer) — mga tuntunin kada wika at kung ano ang nangyayari kapag nanalo ang isang paraan
- [Paano Pinopondohan ang Trabaho](/docs/network/sovereignty/economic-model) — kung saan gumagalaw ang pera sa isang non-commercial na proyekto
- [Sumuporta sa isang Low-Resource na Wika](/docs/network/community/low-resource-languages) — teknikal na konteksto para sa mga researcher na nakikipagtulungan sa mga komunidad

