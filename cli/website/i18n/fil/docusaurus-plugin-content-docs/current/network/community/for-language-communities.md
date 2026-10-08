---
sidebar_position: 1
title: "Para sa mga Komunidad ng Wika"
---

# Para sa mga Komunidad ng Wika

> **Pangkalahatang Buod.** Maaaring ariin ng inyong komunidad ang sarili nitong test set — ang "answer key" kung saan sinusukat ang bawat pamamaraan ng pagsasalin — at magpatakbo ng sarili nitong paligsahan ayon sa sarili nitong mga tuntunin, nang hindi kailanman isinusuko ang datos. Ipinapaliwanag ng pahinang ito kung ano ang hinihiling ng Network mula sa mga komunidad ng wika (mga sangguniang salin, pagsusuri ng salin, datos sa paggabay), kung ano ang inyong matatanggap bilang kapalit (bayad na trabaho ayon sa nai-publish na mga rate kapag napondohan na ang gawain — walang pondong hawak sa kasalukuyan — kasama ang pagmamay-ari ng code at ganap na kontrol sa deployment), at ang mga proteksyon sa soberanya na siyang inuuna. Walang kinakailangang programming. Ang ilang proteksyon ay nakapaloob na sa software at sa database; ang iba naman ay mga pangako pa rin, at tinutukoy ng [Mga Tapat na Limitasyon](/docs/network/honest-limitations) kung alin ang mga ito.

Hindi po ninyo kailangang maging programmer para makapag-ambag sa Network. Kung nagsasalita kayo ng isang Katutubo o low-resource na wika, kayo ang pinakamahalagang tao sa ecosystem na ito.

---

## Nauuna ang Soberanya

Bago kami humingi ng anuman mula sa inyo, narito ang pangunahing tuntunin: **ang datos ng inyong wika ay sa inyo.** Ang datos ng wika ay *biodata* — dala nito ang pagkakakilanlan at mga ugnayan ng inyong komunidad at hindi ito maaaring gawing ganap na di-kilala sa makabuluhang paraan — kaya ang mga taong nagbibigay nito ang may hawak ng mga susi rito, at sa anumang sinusukat laban dito. Ang Network ay binuo batay sa [mga prinsipyo ng soberanya ng datos ng mga Katutubo](/docs/network/sovereignty/data-sovereignty):

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

Ang mga garantiya sa likod ng lahat ng ito ay nakasulat, hindi ipinahihiwatig lamang:
[Pangangasiwa ng Datos](/docs/network/sovereignty/data-sovereignty) (ang posisyon sa
soberanya ng datos/CARE at kung ano ang ipinagbabawal nitong gawin namin) at
[Pagmamay-ari at mga Tuntunin](/docs/network/sovereignty/ownership-transfer) (kung ano ang
nangyayari, ayon sa kontrata, kapag nanalo ang isang pamamaraan).

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

Ang pagbuo ng corpus at pagsusuri ng salin ay gawaing propesyonal, na babayaran ayon sa
[mga nai-publish na rate](/docs/network/perspectives/how-speakers-get-paid) kapag napondohan na
(walang pondo na hawak sa kasalukuyan) — at ang kabayaran ay hindi nangangahulugang binibili ang inyong datos. Binabayaran kayo para sa trabaho *at* nananatili kayong
may-ari ng anumang inyong binuo. Ang Champollion ay isang di-komersyal na proyektong pampananaliksik: wala itong
ibinibenta, walang sinusukat na singilin, at [walang kinukuhang bahagi](/docs/network/sovereignty/economic-model)
mula sa anumang kikitain ng inyong komunidad mula sa isang pamamaraang pagmamay-ari nito.

### Kontrol

Kontrolado ng inyong governance organization ang:
- Sino ang maaaring maka-access sa paraan
- Kung maaari itong gamitin nang commercial — at kung oo, ayon sa inyong mga tuntunin, habang pinapanatili ang lahat ng kinikita nito
- Kailan at paano ito ina-update
- Anong data ang ginagamit para sa karagdagang development

---

## Paano Makilahok

:::tip[Isang bagay na maaaring gawin ng mga tagapagsalita ngayon — kung sumasang-ayon ang komunidad]
Hindi nagtatayo o nagho-host ang Champollion ng mga corpus — palaging kinukuha ang datos ng pagsubok
mula sa pinagmulan nito. Kung nais ng mga tagapagsalita sa inyong komunidad na mag-ambag ng mga pangungusap
*ngayon na*, tumatanggap ang [Tatoeba](https://tatoeba.org) ng bawat-pangungusap na mga ambag
sa anumang wika, at ang mga bukas na koleksyon tulad ng
[OPUS](https://opus.nlpl.eu/) ay nagtitipon ng magkatulad na teksto (parallel text) kung saan bumubuo
ang Network ng mga benchmark. Ang mga pangungusap na idinagdag doon ay maaaring maging datos ng ebalwasyon dito.

Alamin muna ang kapalit: inilalathala ng Tatoeba ang mga pangungusap sa ilalim ng isang bukas na lisensya
(CC BY 2.0 FR bilang default), kaya maaaring kopyahin ng sinuman ang mga ito — kabilang ang pagsasanay ng mga modelo ng AI
— at ang mga kopyang nagawa na ay hindi na maaaring bawiin. Maaaring ito ang tamang
pagpipilian para sa mga pang-araw-araw na pangungusap. Para sa anumang nais panatilihin ng inyong komunidad
sa ilalim ng sarili nitong kontrol, panatilihin ninyo mismo ang datos at gumamit sa halip ng isang
[selyadong test set](/docs/network/sovereignty/run-a-sovereign-contest).
Ang isang app para sa direktang ambag ng tagapagsalita at tagabuo ng corpus ay nakaplano ngunit hindi
pa nagagawa sa kasalukuyan.
:::

1. **Makipag-ugnayan** — Magbukas ng issue sa [Network repository](https://github.com/gamedaysuits/Champollion) o mag-email sa [info@champollion.dev](mailto:info@champollion.dev)
2. **Ilarawan ang inyong wika** — Saang pamilya ito nabibilang? Ilan ang mga tagapagsalita? Anong mga sistema ng pagsulat ang ginagamit? Anong mga computational resource ang umiiral (mga FST, diksiyonaryo, corpus)?
3. **Magsimula sa maliit** — Kahit 50 na maingat na piniling pares ng salin ay sapat na upang makagawa ng evaluation dataset at magbukas ng bagong track sa leaderboard. Ang gawaing corpus ay [binabayaran ayon sa nai-publish na mga rate](/docs/network/perspectives/how-speakers-get-paid) kapag napondohan na; walang pondo na hawak sa kasalukuyan
4. **Panatilihin itong sa inyo** — Irehistro ang corpus bilang metadata sa lane na inyong pinili ([Pagrerehistro ng mga Corpus](/docs/network/sovereignty/registering-corpora)); kung nais ninyong maging ganap na lihim ang test set, ang [runbook ng soberanong paligsahan](/docs/network/sovereignty/run-a-sovereign-contest) ang landas
5. **Ikonekta kami sa pamamahala** — Sino sa inyong komunidad ang may awtoridad sa datos ng wika at teknolohiya? Nangangailangan ang modelo ng soberanya ng Network ng isang katuwang sa pamamahala

---

## Tingnan Din

- [Magpatakbo ng Soberanong Paligsahan](/docs/network/sovereignty/run-a-sovereign-contest) — ang runbook para sa ebalwasyong kontrolado ng komunidad
- [Mga Template ng Tuntunin](/docs/network/sovereignty/terms-templates) — mga tuntuning simple ayon sa batas at nakakiling sa trustless na maaaring ibagay ng inyong komunidad, kung saan malinaw na ipinapaliwanag ang mga panganib ng trojan-horse
- [Pangangasiwa ng Datos](/docs/network/sovereignty/data-sovereignty) — ang posisyon, at ang mga balangkas (CARE, Te Mana Raraunga, at iba pang instrumento sa soberanya ng datos ng mga Katutubo) na humubog dito
- [Pagmamay-ari at mga Tuntunin](/docs/network/sovereignty/ownership-transfer) — mga tuntunin para sa bawat wika at kung ano ang nangyayari kapag nanalo ang isang pamamaraan
- [Kung Paano Pinopondohan ang Gawain](/docs/network/sovereignty/economic-model) — kung saan dumadaloy ang salapi sa isang di-komersyal na proyekto
- [Suportahan ang Wikang May Limitadong Sanggunian](/docs/network/community/low-resource-languages) — teknikal na konteksto para sa mga mananaliksik na nakikipagtulungan sa mga komunidad
