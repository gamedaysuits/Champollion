---
sidebar_position: 3
title: "Mula Benchmark Hanggang Pang-araw-araw na Paggamit: Ang Landas ng Post-Editing"
slug: '/network/perspectives/from-benchmark-to-daily-use'
description: "Kung paano nagiging workflow ng pagsasalin ng komunidad ang isang benchmarked na paraan ng pagsasalin: machine draft, post-edit ng matatas na speaker, inilathalang teksto — na may tapat na mga threshold ng kalidad sa bawat hakbang."
related:
  - label: "Deploy to Production"
    to: /docs/network/getting-started/deploy-to-production
    kind: guide
    note: "From proven method to live translation"
  - label: "Cookbook: Partial Translation (Human + Machine)"
    to: /docs/network/tutorials/partial-translation
    kind: cookbook
  - label: "Scoring Specification"
    to: /docs/network/specifications/scoring
    kind: spec
    note: "How runs are scored, and why no score is a quality label"
  - label: "Translation Is Not Revitalization"
    to: /docs/network/perspectives/translation-is-not-revitalization
    kind: position
---

# Mula Benchmark hanggang Pang-araw-araw na Paggamit: Ang Landas ng Post-Editing

> **Ang maikling bersyon.** Ang marka sa leaderboard ay hindi isang produkto. Ang landas mula sa "ang pamamaraang ito ay may markang chrF++ 47.5" patungo sa "ang tanggapan ng komunidad ay naglalathala ng mga dokumento sa wika linggo-linggo" ay dumadaan sa iisang partikular na workflow: gumagawa ang makina ng draft, iwinawasto ito ng isang matatas na tagapagsalita, at tanging ang naiwastong teksto lamang ang inilalathala. Bawat threshold ng kalidad sa aming mga espisipikasyon ay naka-calibrate sa workflow na iyon — hindi sa output ng makina na walang nangangasiwa, na hindi namin ineendorso para sa anumang wika sa platform na ito.

Minsan ay nagtatanong ang mga tao kung kailan magiging "sapat na mahusay para basta gamitin" ang isang paraan ng pagsasalin. Para sa mga wikang pinaglilingkuran ng Network na ito, may patibong ang tanong na iyon. Ang tapat na sagot ay hindi "sapat na mahusay para ilathala nang hindi sinusuri" ang pamantayang dapat tunguhin — ito ay **"sapat na mahusay na mas mainam ang pagsusuri sa draft kaysa pagsasalin mula sa simula."** Mas mababa ang pamantayang iyon, nasusukat ito, at kapag nalampasan ito, nagbabago kung ano ang kayang magawa ng isang tanggapan ng pagsasalin ng komunidad sa loob ng isang linggo.

---

## Ang workflow, mula simula hanggang dulo

```
 English source document
        │
        ▼
 Machine draft  ←  a benchmarked, community-owned method
        │
        ▼
 Fluent-speaker post-edit  ←  the human gate; nothing skips it
        │
        ▼
 Published text  ←  carries human approval, not a machine score
        │
        ▼
 (Optional, community-controlled) corrections become
 data that improves the next version of the method
```

Tatlong bagay ang dapat pansinin:

1. **Hindi kailanman naglalathala ang makina.** Draft ang yunit ng output. Ang pass ng pagwawasto ng tagapagsalita ay hindi quality assurance na idinagdag lamang sa dulo — ito ang workflow.
2. **Ang oras ng tagapagsalita ang resource na ino-optimize.** Mas mabuti ang isang paraan kaysa sa ibang paraan kung mas kaunti ang iniiwan nitong kailangang ayusin ng tagapagsalita. Ang pananaliksik sa post-editing para sa mga wikang may sapat na resources ay palagiang nakikitang mas mabilis ito kaysa pagsasalin mula sa simula sa katamtamang kalidad ng MT (Plitt & Masselot 2010; Green, Heer & Manning 2013, parehong binanggit na may mga link sa [Ang Pagsasalin ay Hindi Revitalization](/docs/network/perspectives/translation-is-not-revitalization)). Kung totoo rin iyon para sa mga wikang polysynthetic ay eksaktong dahilan kung bakit umiiral ang benchmark — itinuturing namin ito bilang hypothesis na dapat beripikahin bawat wika, hindi bilang palagay.
3. **Pagmamay-ari ang feedback loop.** Ang bawat naitamang dokumento ay potensyal na training at coaching data — at pag-aari ito ng komunidad, upang ibalik (o hindi) sa kanilang sariling mga tuntunin sa ilalim ng mga patakaran sa [data sovereignty](/docs/network/sovereignty/data-sovereignty). Ang mekanismo ng feedback ay isang layunin sa disenyo ng platform, hindi pa built feature; tingnan ang [Pag-uulat ng Mga Error at Pagmamay-ari ng Mga Pagwawasto](/docs/network/perspectives/reporting-errors-and-owning-corrections) para sa kung paano nakatakdang gumana ang mga pagwawasto at provenance.

## Ang kayang sabihin at hindi kayang sabihin sa inyo ng isang marka sa leaderboard

Iniraranggo ng leaderboard ang mga pamamaraan sa paraang ginagawa ng larangan ng MT: sa pamamagitan ng antas-ng-corpus na **chrF++** (0–100) kalakip ang 95% confidence interval nito at lagda ng sacreBLEU, kasabay ang BLEU, spBLEU, TER at COMET sa tabi nito at ang mga pagsusuri tulad ng pagtanggap ng FST na iniuulat nang magkahiwalay ([Espisipikasyon ng Pagmamarka](/docs/network/specifications/scoring#how-runs-are-scored)). Kung ang isang pamamaraan ay mas mahusay kaysa sa isa pa sa parehong hanay ng ebalwasyon ay pinagpapasyahan sa pamamagitan ng isang paired significance test, hindi sa pamamagitan lamang ng pagtingin sa dalawang numero ([Significance Testing](/docs/network/specifications/significance)).

Ang sinasabi niyan sa isang komunidad: aling mga pamamaraan ang gumagawa ng output na mas malapit sa mga pinagkakatiwalaang sangguniang salin, at kung totoo nga ba ang agwat sa pagitan ng dalawang pamamaraan. Ang hindi nito masasabi sa inyo: kung ang isang draft ba ay karapat-dapat paglaanan ng oras ng isang tagapagsalita. Ang parehong numero ng chrF++ ay may magkakaibang kahulugan para sa iba't ibang wika at hanay ng ebalwasyon, kaya walang awtomatikong marka rito ang may dalang tatak ng kalidad. Dati nang nagmamapa ang Network ng isang weighted composite sa mga pinangalanang antas ("functional", "deployable", …); ang mga tatak na iyon ay ibinasura na, dahil sa bahagi na ang isang sistemang nag-uulit ng isang wastong pangungusap para sa bawat input ay tinatakan noon bilang "functional" ([kung bakit ibinasura ang composite](/docs/network/specifications/scoring#why-the-composite-was-retired)).

Kasunod nito ang dalawang patakaran sa istruktural na katapatan, mula sa [Espisipikasyon ng Benchmark §7](/docs/network/specifications/benchmark#7-human-validation):

- **Ang isang marka ay isang nominasyon para sa pagsusuri ng tao, hindi isang hatol.** Ang mataas na chrF++ ay ginagawang kapaki-pakinabang ang isang pamamaraan para sa pilot testing kasama ang mga tagapagsalita; hindi nito ibig sabihin na handa na ito.
- **Tanging ang pagsusuri ng komunidad ang makapagsasabi na handa na ang isang pamamaraan para sa isang post-editing workflow.** Ang isang stratified sample ng output nito ay ipinapadala sa mga bilingguwal na tagapagsalita, na nagmamarka sa bawat salin bilang *reject / gist / acceptable / excellent*. Ang organisasyon ng pamamahala — hindi ang leaderboard — ang nagpapasiya kung susulong ba ang pamamaraan.

Bilang paghahambing, ang mga kondisyon ng [Gantimpala ng Tagapagtatag](/docs/network/specifications/prizes) (isang minimum na chrF++, ≥99% na mga salitang may wastong morpolohiya bilang pamantayan, ≥70% na minarkahan ng tagapagsalita bilang acceptable-or-better) ay naglalarawan ng isang pamamaraang ang mga natitirang pagkakamali ay *mga kamalian sa totoong wika* — maling pagbabanghay, hindi mga inimbentong salita. Iyan ang hitsura sa mga numero ng "isang draft na karapat-dapat paglaanan ng oras ng isang tagapagsalita", at ang hatol ng mga tagapagsalita ang kondisyong nagtatakda nito.

## Mula sa isang nanalong paraan tungo sa gumaganang tanggapan

Ipagpalagay na nalampasan ng isang paraan ang mga gate na iyon. Ang natitirang mga hakbang ay pang-organisasyon, at tinutukoy ang mga ito sa halip na iniimbento habang ginagawa:

1. **Nalilipat ang pagmamay-ari.** Ang code ng paraan ay nagiging pag-aari ng governance organization ng komunidad — pinananatili ng developer ang attribution at publication rights ([Ownership Transfer](/docs/network/sovereignty/ownership-transfer)).
2. **Nagiging serbisyo ang paraan — serbisyo ng komunidad.** Ipinapakete ito bilang plugin na maaaring patakbuhin ng governance organization sa sarili nitong infrastructure, na kinokontrol ang access at mga pinahihintulutang gamit ([Deploy to Production](/docs/network/getting-started/deploy-to-production)). Kung pipiliin ng komunidad na ialok ito nang komersiyal, negosyo iyon ng komunidad sa bawat kahulugan — walang kinukuhang bahagi ang Champollion ([How the Work Is Funded](/docs/network/sovereignty/economic-model)).
3. **Isinasaksak ito ng mga tagasalin sa kanilang araw-araw na gawain.** Itinuturo ng isang tanggapan ng pagsasalin ang umiiral nitong document workflow sa API ng paraan: source text papasok, draft palabas, post-edit, publish. Taglay ng nailathalang teksto ang pangalan at awtoridad ng tagasalin — ang makina ay kasangkapan sa kanilang mesa, tulad ng diksyunaryo.

## Nasaan na ito ngayon

Sa madaling salita: ang buong landas ay tinukoy mula simula hanggang dulo, at bahagyang naitayo. Ang harness ng ebalwasyon, mga sukatan, mga run card, at pampublikong leaderboard ay umiiral na; ang sandbox ng ebalwasyon ay naitayo na ngunit sinubukan pa lamang gamit ang isang toy method; ang isang Plains Cree development corpus ay umiiral sa upstream; may iminungkahing gantimpala, ngunit wala pang bukas; ang platform para sa pag-deploy ay umiiral na. Ang interface para sa pagsusuri ng komunidad at ang feedback loop para sa naiwastong teksto ay tinukoy na ngunit hindi pa gumagana — minarkahan ang mga ito sa mga espisipikasyon bilang planado pa, at gayon din kami. Wala pang pamamaraan ang nakakumpleto sa buong paglalakbay mula sa benchmark patungo sa pang-araw-araw na paggamit ng komunidad. Ang paglalakbay na iyon ang depinisyon ng tagumpay ng proyekto, at iyon mismo ang dahilan kung bakit hindi namin ito aangkatin nang maaga.

---

## Ano ang ibig sabihin nito para sa inyo

:::info[Kung kayo ay isang miyembro ng komunidad]
Ang mataas na marka sa leaderboard ay hindi kailanman nangangahulugang maglalathala ang isang makina sa inyong wika nang walang nangangasiwa — nangangahulugan ito na ang isang tagagawa ng draft ay maaaring handa nang *mag-audition* para sa inyong mga tagapagsalin, ayon sa inyong mga tuntunin, kasama ang inyong mga tagapagsalita bilang mga hurado (mga binabayarang hurado — tingnan ang [Kung Paano Binabayaran ang mga Tagapagsalita](/docs/network/perspectives/how-speakers-get-paid)). Kung nagpapatakbo ang inyong komunidad ng isang tanggapan ng pagsasalin, ang kaugnay na tanong na maipaparating sa amin ay: "ano ang magiging hitsura ng isang pilot project, at sino ang susuri sa output?"
:::

:::info[Kung kayo ay isang mananaliksik]
Binabago ng post-editing framing ang bagay na karapat-dapat sukatin: ang bilis ng paggawa ng katanggap-tanggap na teksto (time-to-acceptable-text) kasama ang isang tagapagsalita sa proseso, hindi lamang ang chrF++. Ang mga sukatan ng Network ay mga proxy para diyan ([Espisipikasyon ng Pagmamarka §1](/docs/network/specifications/scoring)), at ang mga pag-aaral sa post-editing para sa bawat wika para sa mga wikang may masalimuot na morpolohiya ay isang bukas na puwang sa pananaliksik na idinisenyo upang suportahan ng imprastrakturang ito.
:::

:::info[Kung kayo ay builder]
Mag-optimize para sa editor, hindi para sa metric. Ang pamamaraang lumilikha ng tunay na mga salita na may paminsan-minsang maling inflection ay naaayos sa loob ng ilang segundo ng isang tagapagsalita; ang pamamaraang nagha-hallucinate ng mga anyong mukhang kapani-paniwala ay nilalason ang buong workflow — kaya naman mahigpit na naka-gate dito ang morphological validity. Magsimula sa [Magsumite ng Method](/docs/network/getting-started/submit-a-method), at basahin ang [Method Interface](/docs/network/specifications/methods) para sa kung ano ang kalaunan ninyong ipapasa kung mananalo kayo.
:::

## Tingnan din

- [Ang Pagsasalin ay Hindi Revitalization](/docs/network/perspectives/translation-is-not-revitalization) — kung bakit ang human gate ang punto, hindi isang limitasyon
- [Pag-uulat ng Mga Error at Pagmamay-ari ng Mga Pagwawasto](/docs/network/perspectives/reporting-errors-and-owning-corrections) — ano ang nangyayari kapag mali pa rin ang nailathalang teksto
- [Benchmark Specification §7](/docs/network/specifications/benchmark#7-human-validation) — ang human validation gate, sa pormal na paraan
