---
sidebar_position: 4
title: "Pag-uulat ng mga Kamalian at Pananagutan sa mga Pagwawasto"
slug: '/network/perspectives/reporting-errors-and-owning-corrections'
description: "Kung paano nag-uulat ang isang tagapagsalita ng maling impormasyon o hindi magandang salin, kung sino ang nagpapasya kung ano ang susunod na mangyayari, kung paano taglay ng mga pagwawasto ang provenance, at kung bakit may kapangyarihang mag-veto ang mga komunidad sa kanilang data ng wika."
related:
  - label: "Data Sovereignty"
    to: /docs/your-words-your-rules
    kind: doc
    note: "Who holds veto power over language data"
  - label: "Ownership Transfer"
    to: /docs/network/sovereignty/ownership-transfer
    kind: doc
  - label: "Speaker Validation Protocol"
    to: /docs/network/specifications/speaker-validation
    kind: spec
  - label: "Working with speakers"
    to: /docs/working-with-speakers
    kind: position
---

# Pag-uulat ng mga Error at Pananagutan sa mga Pagwawasto

> **Paninindigan.** Hindi maiiwasan ang pagkakaroon ng mali para sa isang platform na naglalathala ng mga katotohanan at ebalwasyon tungkol sa maraming wika. Ang *hindi* maiiwasan ay kung sino ang pinaniniwalaan kapag may iniulat na pagkakamali, at kung sino ang nagmamay-ari ng pagwawasto. Ang aming sagot: mas matimbang ang ulat ng isang matatas na tagapagsalita kaysa sa aming automation, bawat pagwawasto ay may talaan ng pinagmulan na nagsasaad kung sino ang nagbago ng ano at bakit, at maaaring bawiin o i-veto ng isang komunidad ang paggamit ng data ng kanilang wika — hindi bilang kagandahang-loob, kundi bilang ipinapatupad na katangian ng arkitektura.

Itinuturing ng karamihan sa mga data platform ang mga ulat ng error bilang mga support ticket: may user na nagrereklamo, may maintainer na nagpapasya, at tahimik na nagbabago ang record. Para sa datos ng mga wikang Katutubo, baligtad ang modelong iyon. Karaniwang mas awtoritatibo ang taong nag-uulat ng error kaysa sa platform — ang isang tagapagsalita na nagsasabi sa amin na mali ang isang salita ay hindi isang "user," sila ang ground truth na nagwawasto sa isang proxy. Ang disenyo sa ibaba ay nagmumula sa seryosong pagtanggap dito.

---

## Dalawang uri ng error, isang prinsipyo

Naglalathala ang platform ng dalawang uri ng claim na maaaring mali:

1. **Mga katotohanan tungkol sa isang wika** — ang mga language card na nagpapatakbo sa pagsusuri: datos ng klasipikasyon, ortograpiya, mga katangiang lingguwistiko, kung aling mga metric ang naaangkop. Maaaring magsaad ang isang card ng maling pagtatantya sa dami ng tagapagsalita, maling ugnayan ng diyalekto, o maling katayuan ng sistema ng pagsulat.
2. **Mga paghatol tungkol sa mga salin** — isang sangguniang salin sa isang corpus na itinuturing ng isang tagapagsalita na mali o hindi natural; isang awtomatikong metric na tumatanggi sa isang wastong salita o tumatanggap ng hindi wasto; isang mataas na awtomatikong marka sa output na hindi tatanggapin ng mga tagapagsalita.

Ang prinsipyong sumasaklaw sa dalawa, na umiiral na sa [Scoring Specification](/docs/network/specifications/scoring) at [Benchmark Specification §7](/docs/network/specifications/benchmark#7-human-validation): **ang mga automated output ay mga proxy; ang mga tagapagsalita ang ground truth.** Tahasan itong inilalagay ng nailathalang pangako sa [Speaker Validation Protocol §6](/docs/network/specifications/speaker-validation#6-what-speakers-get): kung sinabi ng tagapagsalita na mali ang linter tungkol sa isang bagay, aayusin namin ang linter.

## Paano dumaraan ang isang ulat

Narito ang landas na tinatahak ng isang ulat, kasama ang tapat na mga status marker — tumatakbo na ngayon ang ilan dito, ang iba ay nakatukoy pa lamang at hindi pa nagagawa.

**Pag-uulat ng maling salin o paghatol ng sukatan (kasalukuyang tumatakbo, sa pamamagitan ng direktang channel).** Ang isang tagapagsalita na makakakita ng maling sangguniang salin, maling tinanggihang salita, o hindi katanggap-tanggap na "katumbas" ay maaaring mag-ulat nito sa pamamagitan ng issue tracker ng pampublikong repositoryo ng proyekto o sa pamamagitan ng direktang pakikipag-ugnayan sa proyekto. Ang structured na bersyon nito — mga screen ng pagmamarka na may mga opsiyong *reject / gist / acceptable / excellent* at mga tala sa malayang teksto — ay ang interface ng pagsusuri ng komunidad, na tinukoy sa [Benchmark Specification §7.3](/docs/network/specifications/benchmark#7-human-validation) ngunit hindi pa live. Hanggang sa maging live ito, ang mga ulat ay pinangangasiwaan nang personal (person-to-person), at ang mismong mga gawain sa pagpapatunay (binabayaran, structured na pagsusuri ng tagapagsalita — tingnan ang [Pakikipagtulungan sa mga tagapagsalita](/docs/working-with-speakers)) ang pangunahing pipeline ng pagwawasto.

**Pag-uulat ng maling katotohanan sa isang language card (tumatakbo ngayon, parehong mga channel).** Sumusunod ang mga pagwawasto sa card sa parehong landas: ulat, review, versioned change. Dahil pinatatakbo ng mga card ang evaluation behavior — kung aling metrics ang nilo-load, kung aling models ang inirerekomenda — maaaring baguhin ng card fix ang mga score, kaya inilalapat ang mga pagwawasto bilang mga naitalang pagbabago sa datos, hindi kailanman bilang tahimik na edits.

**Ano ang susunod na mangyayari — sino ang nagpapasya:**

- **Ang mga lingguwistikong pagpapasiya ay pag-aari ng mga tagapagsalita ng wikang iyon.** Maging kung wasto ang isang anyo, kung magkatumbas ang dalawang pagkakaparirala, o kung angkop ang isang rehistro — ipinapatupad ng platform ang sagot; hindi ito ang nagbibigay nito. Kung saan hindi nagkakasundo ang mga tagapagsalita (mga diyalekto, kumbensiyon sa ortograpiya), itinatala ang sagot bilang baryasyon, hindi namin hinahatulan — sinusuportahan ng mga schema ng corpus at linter ang pag-tag sa mga diyalektal na baryant bilang mga katanggap-tanggap na alternatibo sa halip na magpataw ng iisang panalo.
- **Ang mga desisyon tungkol sa data ng isang komunidad ay pag-aari ng organisasyon ng pamamahala nito.** Para sa mga wikang may organisasyon ng pamamahala, ang mga pagbabago sa mga corpus ng ebalwasyon, pagtanggap ng mga pagwawasto sa mga nakasarang test set, at mga kahihinatnan ng pag-deploy ay dumaraan sa kanila — iyon ang pagkontrol ng komunidad sa data ng wika — tingnan ang [Inyong mga salita, inyong mga panuntunan](/docs/your-words-your-rules) — ipinapatupad bilang proseso, hindi poster.
- **Ang mga mekanikal na pagkakamali ay inaayos lang.** Isang typo, sirang link, maling na-parse na field — iniulat, iniwasto, inila-log. Hindi lahat ay nangangailangan ng sanggunian.

## May provenance ang mga pagwawasto

Ang pagwawastong hindi ninyo matutunton ay isa lamang mas bagong opinyon. Tatlong tuntunin ng provenance ang nalalapat sa bawat katotohanan at bawat pag-aayos:

1. **Pangalan ng pinagmulan ang bawat katotohanan.** Itinatala ng mga language card at entry sa corpus kung saan nagmula ang bawat halaga — isang inilathalang dataset, isang kontribusyon ng komunidad, isang pagsusuri ng tagapagsalita.
2. **Ang mga hinangong halaga ay may tatak na amin, hindi sa upstream.** Kapag may kinakalkula ang platform — isang aggregate, isang recoding, isang composite — itinatala ito bilang hinango ng platform *mula sa* upstream source, at hindi kailanman isinusulat sa ilalim ng pangalan ng upstream. Hindi dapat kailanman sisihin, o bigyan ng papuri, ang isang upstream dataset para sa isang numerong hindi nito inilathala.
3. **Ang mga pagwawasto ay nagiging bahagi ng talaan.** Ang pagwawasto ng isang tagapagsalita ay itinatala bilang isang bago at may atribusyong pahayag (pinangalanan o hindi nagpapakilala, ayon sa nais ng tagapagsalita — katulad ng mga tuntunin sa gawaing pagpapatunay) na pumapalit sa lumang halaga; nananatiling maaaring ma-audit ang kasaysayan ng kung ano ang nagbago. Ang mga bersyon ng corpus ay may hash-manifest ([Pagrerehistro ng mga corpus](/docs/network/sovereignty/registering-corpora)), kaya ang isang iniwastong corpus ay kitang-kitang bagong bersyon, at itinatala ng bawat run card nang eksakto kung aling bersyon ito namarkahan — nananatiling maipaliliwanag ang mga lumang marka, habang sumasalamin naman ang mga bagong marka sa ginawang pag-aayos.

## Ang veto, nang kongkreto

Madaling i-claim ang "community control." Narito kung ano ang katumbas nito sa nailathalang arkitektura:

- **Maaaring bawiin ng mga tagapagsalita ang kanilang mga kontribusyon.** Maaaring bawiin ng isang tagapagsalita ang kanyang mga marka sa anumang oras, at aalisin ng pagbawi ang mga ito mula sa lahat ng pagsusuri ([Speaker Validation §5](/docs/network/specifications/speaker-validation#5-data-governance)). Mayroon ding kapangyarihang mag-veto ang mga tagapagsalita sa paglalathala ng mga resultang itinuturing nilang may problema.
- **Maaaring tuluyang ihinto ng mga komunidad ang ebalwasyon.** Naka-encrypt ang mga selyadong test set, at walang hawak na key share ang Champollion, kaya hindi kailanman muling mabubuo ng platform nang mag-isa ang mga ito. Sa kasalukuyan, ang mga susi ng isang selyadong set ay hawak ng tagapag-organisa — mga tagapangalaga ng susi ng komunidad: wala pang itinatalaga. Kapag ang mga tagapangalagang pinangalanan ng isang komunidad ay may hawak na ng mga share ng susi ng isang set, maaari nilang ihinto ang ebalwasyon sa pamamagitan ng pagtangging lumahok sa muling pagbuo ng susi ([Pagrerehistro ng mga corpus](/docs/network/sovereignty/registering-corpora)). Ang tanong na "Paano kung nais naming huminto?" ay may tinukoy na sagot: hindi kailanman ilalantad ang selyadong data, at magtatapos ang ebalwasyon.
- **Walang markang mangingibabaw sa desisyon ng komunidad.** Ang isang puwesto sa leaderboard ay hindi nagbibigay ng pahintulot kaninuman na mag-deploy ng paraan sa wika ng isang komunidad ([Paglilipat ng Pagmamay-ari](/docs/network/sovereignty/ownership-transfer)) — at ang isang komunidad na nagpasyang hindi dapat i-deploy ang MT para sa kanilang wika kailanman ay ginagamit ang sistema ayon sa idinisenyo rito, hindi ito sinisira (tingnan ang [Ang Pagsasalin ay Hindi Pagbuhay-muli ng Wika](/docs/network/perspectives/translation-is-not-revitalization)).

## Ang hindi pa namin nagagawa

Alinsunod sa diwa ng iba pang bahagi ng shelf na ito: ang interface para sa pagsusuri ng komunidad ay pinaplano pa lamang, hindi pa live. Wala pang naitatatag na mga organisasyon ng pamamahala para sa alinman sa mga kasalukuyang wika — walang mga tagapangalaga ng komunidad na naitalaga para sa anumang benchmark, kabilang ang Plains Cree, at hindi kami nagpapangalan ng mga tagapangalaga sa publiko bago sila magbigay ng pahintulot. Hanggang sa umiral ang mga bahaging iyon, dumaraan ang mga pagwawasto sa mga direkta at naitututok na channel, at ang mga nailathalang spec — hindi ang pahinang ito — ang nananatiling umiiral na paglalarawan ng proseso. Kung magkaiba man ang pahinang ito at ang isang spec, ang spec ang mananaig, at ituturing din naming isang bug na karapat-dapat iulat ang hindi pagkakatugmang iyon.

---

## Ano ang ibig sabihin nito para sa inyo

:::info[Kung kayo ay isang miyembro ng komunidad]
Kung may mali tungkol sa inyong wika sa platform na ito — isang katotohanan, isang salin, isang label — ang inyong ulat ay patotoo mula sa batayang katotohanan, hindi isang reklamo na kailangang i-triage. Kayo po ang nagpapasiya kung kikilalanin ang inyong pagwawasto ayon sa inyong pangalan; maaaring bawiin ang inyong kontribusyon sa ibang pagkakataon; at maaaring tuluyang pahintuin ng inyong komunidad ang paggamit ng data nito. Magsimula sa [Inyong mga salita, inyong mga panuntunan](/docs/your-words-your-rules), o magbukas lamang po ng isang issue sa pampublikong repositoryo.
:::

:::info[Kung kayo ay mananaliksik]
Ang mga pagwawasto rito ay datos na may provenance, hindi tahimik na mga edit: naka-hash ang mga bersyon ng corpus, ipinapirmi ng run cards ang eksaktong bersyon kung saan sila na-score, at nilalagyan ng label ang mga derived value bilang mga derivation. Kung gagamit kayo ng Network scores o corpora bilang batayan, banggitin ang bersyon — at ituring ang correction wave na pinamumunuan ng mga speaker bilang finding tungkol sa validity ng metric, dahil iyon talaga ito.
:::

:::info[Kung kayo ay builder]
Maaaring lehitimong magbago ang score ng inyong method kahit hindi nagbabago ang inyong code — na-allowlist ang isang salitang maling na-reject, naitama ang isang reference translation, o naayos ang isang variant class. Idisenyo ito nang naaayon: i-pin ang mga bersyon ng corpus sa inyong run cards ([spec ng Run Card](/docs/network/specifications/run-card)), subaybayan ang mga changelog ng dataset, at ituring ang mga pagwawastong mula sa mga speaker bilang pinakamaaasahang error signal na makukuha ninyo nang libre.
:::

## Tingnan din

- [Pakikipagtulungan sa mga tagapagsalita](/docs/working-with-speakers) — ang parehong awtoridad ng tagapagsalita, sa yugto ng benchmark
- [Isagawa ito](/docs/put-it-to-work) — kung saan nagtatagpo ang mga pagwawasto at ang daloy ng gawain sa paglalathala
- [Ang inyong mga salita, ang inyong mga patakaran](/docs/your-words-your-rules) — kung sino ang nagpapasya kung ano ang mangyayari sa data ng wika, kung ano ang ipinapatupad ng mga tool, at kung ano ang hindi kayang pigilan ng anumang tool
