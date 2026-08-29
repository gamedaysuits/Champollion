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
    note: "The quality thresholds behind the path"
  - label: "Translation Is Not Revitalization"
    to: /docs/network/perspectives/translation-is-not-revitalization
    kind: position
---

# Mula Benchmark hanggang Pang-araw-araw na Paggamit: Ang Landas ng Post-Editing

> **Ang maikling bersyon.** Ang score sa leaderboard ay hindi produkto. Ang landas mula sa "ang pamamaraang ito ay nakakuha ng 0.78" hanggang sa "ang band office ay naglalathala ng mga dokumento sa wika bawat linggo" ay dumaraan sa eksaktong isang workflow: gumagawa ang makina ng draft, itinatama ito ng isang matatas na tagapagsalita, at ang naitama lamang na teksto ang inilalathala. Ang bawat quality threshold sa aming specs ay naka-calibrate sa workflow na iyon — hindi sa machine output na walang pangangasiwa, na hindi namin ineendorso para sa anumang wika sa platform na ito.

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

## Ano ang ibig sabihin ng mga quality tier para sa tunay na paggamit

Sinu-score ng leaderboard ang mga paraan gamit ang composite ng mga automated metric ([Scoring Specification](/docs/network/specifications/scoring)), at tumutugma ang mga score sa mga pinangalanang tier. Narito ang tapat na pagsasalin ng mga tier na iyon sa mga termino ng pang-araw-araw na paggamit:

| Tier (composite) | Ano ang ibig sabihin nito para sa landas ng post-editing |
|---|---|
| **Baseline** (0.00–0.30) | Hindi magagamit para sa anumang bagay. Ang output ay halos hindi ang target na wika. Kapaki-pakinabang lamang bilang research floor. |
| **Emerging** (0.30–0.50) | Hindi pa rin drafting tool. Lumilitaw ang mga tamang fragment, ngunit mas marami pang oras ang gugugulin ng tagapagsalita sa pag-aayos kaysa sa pagsusulat ng bago. |
| **Functional** (0.50–0.70) | Ang unang tier kung saan *maaaring* mas mainam ang post-editing kaysa pagsasalin mula sa simula para sa mga madaling teksto — nararapat i-pilot kasama ang isang tagapagsalita, ngunit hindi pa nararapat asahan. Nananatili ang madalas na morphological errors. |
| **Deployable** (0.70–0.85) | Ang target tier para sa workflow sa itaas: mga draft kung saan tama ang karamihan sa morphology at mas mabilis na makapagtatama nang makabuluhan ang isang matatas na tagapagsalita kaysa muling magsalin. **Ang "Deployable" ay nangangahulugang deployable *sa isang post-editing workflow* — hindi kailanman "ilathala nang walang pagsusuri."** |
| **Fluent** (0.85–1.00) | Papalapit sa mahusay na human translation; bihira at maliliit ang mga error. Nananatili ang review pass — mas bumibilis lamang ito. |

Dalawang pangunahing patakaran ng katapatan ang nakapatong sa talahang ito, tuwiran mula sa [Benchmark Specification §5 at §7](/docs/network/specifications/benchmark#5-quality-tiers):

- **Ang mga automated tier ay pansamantalang label, hindi hatol.** Mga nominasyon ang mga ito para sa human review. Muling ika-calibrate ang mga threshold habang naiipon ang speaker validation data, at maaaring magkaiba ang kalalabasan para sa iba’t ibang wika.
- **Walang paraan ang maaaring mag-claim ng Deployable o mas mataas nang walang community review.** Isang stratified sample ng output nito ang ibinibigay sa mga bilingual na tagapagsalita, na nagre-rate sa bawat salin bilang *tanggihan / diwa lamang / katanggap-tanggap / mahusay*. Ang governance organization — hindi ang leaderboard — ang nagpapasya kung uusad ang paraan.

Para sa paghahambing, inilalarawan ng threshold ng [Founder's Prize](/docs/network/specifications/prizes) (composite ≥ 0.80, ≥99% morphologically valid words, ≥70% speaker-rated acceptable-or-better) ang isang paraan na ang natitirang mga pagkakamali ay *real-language errors* — maling inflection, hindi inimbentong mga salita. Iyon ang anyo ng "isang draft na karapat-dapat sa oras ng isang tagapagsalita" kapag nasa mga numero.

## Mula sa isang nanalong paraan tungo sa gumaganang tanggapan

Ipagpalagay na nalampasan ng isang paraan ang mga gate na iyon. Ang natitirang mga hakbang ay pang-organisasyon, at tinutukoy ang mga ito sa halip na iniimbento habang ginagawa:

1. **Nalilipat ang pagmamay-ari.** Ang code ng paraan ay nagiging pag-aari ng governance organization ng komunidad — pinananatili ng developer ang attribution at publication rights ([Ownership Transfer](/docs/network/sovereignty/ownership-transfer)).
2. **Nagiging serbisyo ang paraan — serbisyo ng komunidad.** Ipinapakete ito bilang plugin na maaaring patakbuhin ng governance organization sa sarili nitong infrastructure, na kinokontrol ang access at mga pinahihintulutang gamit ([Deploy to Production](/docs/network/getting-started/deploy-to-production)). Kung pipiliin ng komunidad na ialok ito nang komersiyal, negosyo iyon ng komunidad sa bawat kahulugan — walang kinukuhang bahagi ang Champollion ([How the Work Is Funded](/docs/network/sovereignty/economic-model)).
3. **Isinasaksak ito ng mga tagasalin sa kanilang araw-araw na gawain.** Itinuturo ng isang tanggapan ng pagsasalin ang umiiral nitong document workflow sa API ng paraan: source text papasok, draft palabas, post-edit, publish. Taglay ng nailathalang teksto ang pangalan at awtoridad ng tagasalin — ang makina ay kasangkapan sa kanilang mesa, tulad ng diksyunaryo.

## Nasaan na ito ngayon

Sa malinaw na salita: tinukoy na ang buong landas mula simula hanggang dulo, at bahagya na itong nagawa. Umiiral ang evaluation harness, metrics, run cards, at pampublikong leaderboard; umiiral ang Plains Cree development corpus at aktibong prize; umiiral ang deployment platform. Ang community review interface, evaluation sandbox, at corrected-text feedback loop ay tinukoy na ngunit hindi pa operational — minamarkahan ng specs ang mga ito bilang planned, at ganoon din kami. Wala pang paraang nakakumpleto sa buong paglalakbay mula benchmark hanggang pang-araw-araw na paggamit ng komunidad. Ang paglalakbay na iyon ang depinisyon ng tagumpay ng proyekto, kaya nga hindi namin ito aangkinin nang maaga.

---

## Ano ang ibig sabihin nito para sa inyo

:::info[Kung kayo ay miyembro ng komunidad]
Ang badge na "Deployable" sa leaderboard ay hindi kailanman nangangahulugang maglalathala ang isang machine sa inyong wika nang walang pangangasiwa — nangangahulugan ito na maaaring handa na ang isang generator ng draft na *mag-audition* para sa inyong mga tagapagsalin, ayon sa inyong mga kondisyon, kasama ang inyong mga tagapagsalita bilang mga hurado (mga binabayaran — tingnan ang [Paano Binabayaran ang mga Tagapagsalita](/docs/network/perspectives/how-speakers-get-paid)). Kung nagpapatakbo ang inyong komunidad ng tanggapan ng pagsasalin, ang may-kaugnayang tanong na dapat ninyong dalhin sa amin ay: "ano ang magiging hitsura ng isang pilot, at sino ang magsusuri ng output?"
:::

:::info[Kung kayo ay researcher]
Binabago ng pagbabalangkas ng post-editing kung ano ang karapat-dapat sukatin: oras-hanggang-sa-katanggap-tanggap-na-teksto na may tagapagsalita sa proseso, hindi lamang composite score. Ang metrics ng Network ay mga proxy para rito ([Scoring Specification §1](/docs/network/specifications/scoring)), at ang mga pag-aaral ng post-editing sa bawat wika para sa mga wikang kumplikado ang morpolohiya ay isang bukas na agwat sa pananaliksik na idinisenyong suportahan ng imprastrakturang ito.
:::

:::info[Kung kayo ay builder]
Mag-optimize para sa editor, hindi para sa metric. Ang pamamaraang lumilikha ng tunay na mga salita na may paminsan-minsang maling inflection ay naaayos sa loob ng ilang segundo ng isang tagapagsalita; ang pamamaraang nagha-hallucinate ng mga anyong mukhang kapani-paniwala ay nilalason ang buong workflow — kaya naman mahigpit na naka-gate dito ang morphological validity. Magsimula sa [Magsumite ng Method](/docs/network/getting-started/submit-a-method), at basahin ang [Method Interface](/docs/network/specifications/methods) para sa kung ano ang kalaunan ninyong ipapasa kung mananalo kayo.
:::

## Tingnan din

- [Ang Pagsasalin ay Hindi Revitalization](/docs/network/perspectives/translation-is-not-revitalization) — kung bakit ang human gate ang punto, hindi isang limitasyon
- [Pag-uulat ng Mga Error at Pagmamay-ari ng Mga Pagwawasto](/docs/network/perspectives/reporting-errors-and-owning-corrections) — ano ang nangyayari kapag mali pa rin ang nailathalang teksto
- [Benchmark Specification §7](/docs/network/specifications/benchmark#7-human-validation) — ang human validation gate, sa pormal na paraan
