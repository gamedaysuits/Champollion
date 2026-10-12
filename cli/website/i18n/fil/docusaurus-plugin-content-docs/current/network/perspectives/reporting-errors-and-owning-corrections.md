---
sidebar_position: 4
title: "Pag-uulat ng mga Kamalian at Pananagutan sa mga Pagwawasto"
slug: '/network/perspectives/reporting-errors-and-owning-corrections'
description: "Kung paano nag-uulat ang isang tagapagsalita ng maling impormasyon o hindi magandang salin, kung sino ang nagpapasya kung ano ang susunod na mangyayari, kung paano taglay ng mga pagwawasto ang provenance, at kung bakit may kapangyarihang mag-veto ang mga komunidad sa kanilang data ng wika."
related:
  - label: "Data Sovereignty"
    to: /docs/network/sovereignty/data-sovereignty
    kind: doc
    note: "Who holds veto power over language data"
  - label: "Ownership Transfer"
    to: /docs/network/sovereignty/ownership-transfer
    kind: doc
  - label: "Speaker Validation Protocol"
    to: /docs/network/specifications/speaker-validation
    kind: spec
  - label: "How Speakers Get Paid"
    to: /docs/network/perspectives/how-speakers-get-paid
    kind: position
---

# Pag-uulat ng mga Error at Pananagutan sa mga Pagwawasto

> **Posisyon.** Hindi maiiwasan ang pagkakamali para sa isang platform na naglalathala ng mga katotohanan at pagsusuri tungkol sa libu-libong wika. Ang *hindi* maiiwasan ay kung sino ang pinaniniwalaan kapag may iniulat na error, at kung sino ang nananagot sa pagwawasto. Ang aming sagot: mas nangingibabaw ang ulat ng isang matatas na tagapagsalita kaysa sa aming automation, bawat pagwawasto ay may provenance na nagsasaad kung sino ang nagbago ng ano at bakit, at maaaring bawiin o i-veto ng isang komunidad ang paggamit ng datos ng kanilang wika — hindi bilang pakonsuwelo, kundi bilang ipinapatupad na katangian ng arkitektura.

Itinuturing ng karamihan sa mga data platform ang mga ulat ng error bilang mga support ticket: may user na nagrereklamo, may maintainer na nagpapasya, at tahimik na nagbabago ang record. Para sa datos ng mga wikang Katutubo, baligtad ang modelong iyon. Karaniwang mas awtoritatibo ang taong nag-uulat ng error kaysa sa platform — ang isang tagapagsalita na nagsasabi sa amin na mali ang isang salita ay hindi isang "user," sila ang ground truth na nagwawasto sa isang proxy. Ang disenyo sa ibaba ay nagmumula sa seryosong pagtanggap dito.

---

## Dalawang uri ng error, isang prinsipyo

Naglalathala ang platform ng dalawang uri ng claim na maaaring mali:

1. **Mga katotohanan tungkol sa isang wika** — ang mga language card na nagpapatakbo sa pagsusuri: datos ng klasipikasyon, ortograpiya, mga katangiang lingguwistiko, kung aling mga metric ang naaangkop. Maaaring magsaad ang isang card ng maling pagtatantya sa dami ng tagapagsalita, maling ugnayan ng diyalekto, o maling katayuan ng sistema ng pagsulat.
2. **Mga paghatol tungkol sa mga salin** — isang sangguniang salin sa isang corpus na itinuturing ng isang tagapagsalita na mali o hindi natural; isang awtomatikong metric na tumatanggi sa isang wastong salita o tumatanggap ng hindi wasto; isang mataas na awtomatikong marka sa output na hindi tatanggapin ng mga tagapagsalita.

Ang prinsipyong sumasaklaw sa dalawa, na umiiral na sa [Scoring Specification](/docs/network/specifications/scoring) at [Benchmark Specification §7](/docs/network/specifications/benchmark#7-human-validation): **ang mga automated output ay mga proxy; ang mga tagapagsalita ang ground truth.** Tahasan itong inilalagay ng nailathalang pangako sa [Speaker Validation Protocol §6](/docs/network/specifications/speaker-validation#6-what-speakers-get): kung sinabi ng tagapagsalita na mali ang linter tungkol sa isang bagay, aayusin namin ang linter.

## Paano dumaraan ang isang ulat

Narito ang landas na tinatahak ng isang ulat, kasama ang tapat na mga status marker — tumatakbo na ngayon ang ilan dito, ang iba ay nakatukoy pa lamang at hindi pa nagagawa.

**Pag-uulat ng masamang salin o paghatol ng metric (tumatakbo ngayon, sa pamamagitan ng direktang channel).** Ang isang tagapagsalita na nakakita ng maling reference translation, salitang maling tinanggihan, o hindi katanggap-tanggap na "katumbas" ay maaaring mag-ulat nito sa pamamagitan ng public repository issue tracker ng proyekto o sa direktang pakikipag-ugnayan sa proyekto. Ang structured na bersyon nito — mga rating screen na may mga opsyong *tanggihan / diwa / katanggap-tanggap / mahusay* at free-text notes — ay ang community review interface, na nakatukoy sa [Benchmark Specification §7.3](/docs/network/specifications/benchmark#7-human-validation) ngunit hindi pa live. Hangga't hindi pa ito live, hinahawakan ang mga ulat nang tao-sa-tao, at ang mismong validation tasks (bayad at structured na pagsusuri ng tagapagsalita — tingnan ang [Paano Binabayaran ang mga Tagapagsalita](/docs/network/perspectives/how-speakers-get-paid)) ang pangunahing correction pipeline.

**Pag-uulat ng maling katotohanan sa isang language card (tumatakbo ngayon, parehong mga channel).** Sumusunod ang mga pagwawasto sa card sa parehong landas: ulat, review, versioned change. Dahil pinatatakbo ng mga card ang evaluation behavior — kung aling metrics ang nilo-load, kung aling models ang inirerekomenda — maaaring baguhin ng card fix ang mga score, kaya inilalapat ang mga pagwawasto bilang mga naitalang pagbabago sa datos, hindi kailanman bilang tahimik na edits.

**Ano ang susunod na mangyayari — sino ang nagpapasya:**

- **Ang mga lingguwistikong pagpapasiya ay nauukol sa mga tagapagsalita ng wikang iyon.** Wasto man ang isang anyo, magkatumbas man ang dalawang pagpapahayag, angkop man ang isang register — ipinapatupad ng platform ang sagot; hindi ito ang nagtatakda nito. Kung saan hindi nagkakasundo ang mga tagapagsalita (mga diyalekto, mga kombensiyon sa ortograpiya), itinatala ang sagot bilang baryasyon, hindi hinahatulan sa aming panig — sinusuportahan ng corpus at mga schema ng linter ang pag-tag sa mga baryant ng diyalekto bilang mga katanggap-tanggap na alternatibo sa halip na magpataw ng iisang panalo.
- **Ang mga desisyon tungkol sa datos ng isang komunidad ay nauukol sa organisasyon ng pamamahala nito.** Para sa mga wikang may organisasyon ng pamamahala, ang mga pagbabago sa mga corpus ng pagsusuri, pagtanggap ng mga pagwawasto sa mga selyadong test set, at mga kahihinatnan sa deployment ay dumaraan sa kanila — iyon ang kontrol ng komunidad sa datos ng wika — tingnan ang [Soberanya ng Datos](/docs/network/sovereignty/data-sovereignty) — ipinatutupad bilang proseso, hindi poster.
- **Ang mga mekanikal na error ay inaayos na lamang.** Isang typo, sirang link, maling na-parse na field — iniulat, itinuwid, naitala. Hindi lahat ay nangangailangan ng kapulungan.

## May provenance ang mga pagwawasto

Ang pagwawastong hindi ninyo matutunton ay isa lamang mas bagong opinyon. Tatlong tuntunin ng provenance ang nalalapat sa bawat katotohanan at bawat pag-aayos:

1. **Pinapangalanan ng bawat katotohanan ang pinagmulan nito.** Itinatala ng mga language card at corpus entries kung saan nanggaling ang bawat value — isang published dataset, community contribution, o review ng tagapagsalita.
2. **Ang derived values ay nilalagyan ng label bilang amin, hindi ng upstream.** Kapag may kinakalkula ang platform — aggregate, recoding, composite — itinatala ito bilang platform derivation *mula sa* upstream source, at hindi kailanman isinusulat sa pangalan ng upstream. Hindi dapat sisihin o bigyan ng kredito ang isang upstream dataset para sa numerong hindi nito inilathala.
3. **Nagiging bahagi ng record ang mga pagwawasto.** Itinatala ang pagwawasto ng tagapagsalita bilang bagong attributed assertion (may pangalan o anonymous, ayon sa pasya ng tagapagsalita — kaparehong terms ng validation work) na pumapalit sa lumang value; nananatiling auditable ang kasaysayan ng kung ano ang nagbago. Ang mga corpus version ay hash-manifested ([Corpus Partnership §4.4](/docs/network/specifications/corpus-partnership)), kaya ang naituwid na corpus ay isang nakikitang bagong bersyon, at itinatala ng bawat run card ang eksaktong bersyon kung saan ito na-score — nananatiling maiintindihan ang mga lumang score, at ipinapakita ng mga bagong score ang pagwawasto.

## Ang veto, nang kongkreto

Madaling i-claim ang "community control." Narito kung ano ang katumbas nito sa nailathalang arkitektura:

- **Maaaring bawiin ng mga tagapagsalita ang kanilang mga kontribusyon.** Maaaring bawiin ng tagapagsalita ang kanilang ratings anumang oras, at tinatanggal sila ng withdrawal mula sa lahat ng analyses ([Speaker Validation §5](/docs/network/specifications/speaker-validation#5-data-governance)). Hawak din ng mga tagapagsalita ang veto power sa paglalathala ng mga resultang itinuturing nilang problematiko.
- **Maaaring ihinto ng mga komunidad ang evaluation nang buo.** Naka-encrypt ang sealed test sets, na may mga susi na hinahawakan upang hindi kailanman magawang buuing muli ng platform nang mag-isa ang mga ito; maaaring bawiin ng komunidad ang evaluation access sa pamamagitan ng pagtangging lumahok sa key reconstruction ([Corpus Partnership §4.3](/docs/network/specifications/corpus-partnership#4-cryptographic-sealing-and-sandbox-testing)). May nakatakdang sagot ang "Paano kung gusto naming huminto?": hindi kailanman inilalantad ang sealed data, at nagtatapos ang evaluation.
- **Walang score ang nangingibabaw sa desisyon ng komunidad.** Ang paraang nangunguna sa leaderboard ay made-deploy lamang kung sinabi ng governance organization na maaari ito ([Ownership Transfer](/docs/network/sovereignty/ownership-transfer)) — at ang komunidad na nagpapasyang hindi dapat i-deploy ang MT para sa kanilang wika ay ginagamit ang system ayon sa disenyo nito, hindi sinisira ito (tingnan ang [Ang Translation ay Hindi Revitalization](/docs/network/perspectives/translation-is-not-revitalization)).

## Ang hindi pa namin nagagawa

Alinsunod sa diwa ng iba pang bahagi ng shelf na ito: ang interface para sa pagsusuri ng komunidad ay pinaplano pa lamang, hindi pa live. Wala pang naitatatag na mga organisasyon ng pamamahala para sa alinman sa mga kasalukuyang wika — walang mga tagapangalaga ng komunidad na naitalaga para sa anumang benchmark, kabilang ang Plains Cree, at hindi kami nagpapangalan ng mga tagapangalaga sa publiko bago sila magbigay ng pahintulot. Hanggang sa umiral ang mga bahaging iyon, dumaraan ang mga pagwawasto sa mga direkta at naitututok na channel, at ang mga nailathalang spec — hindi ang pahinang ito — ang nananatiling umiiral na paglalarawan ng proseso. Kung magkaiba man ang pahinang ito at ang isang spec, ang spec ang mananaig, at ituturing din naming isang bug na karapat-dapat iulat ang hindi pagkakatugmang iyon.

---

## Ano ang ibig sabihin nito para sa inyo

:::info[Kung kayo ay miyembro ng komunidad]
Kung may mali tungkol sa inyong wika sa platform na ito — isang katotohanan, salin, o label — ang inyong ulat ay patotoo mula sa mismong pinagmumulan ng katotohanan, hindi reklamo na kailangang i-triage. Kayo ang magpapasya kung ang inyong pagwawasto ay kikilalanin sa pangalan; maaaring bawiin ang inyong kontribusyon sa kalaunan; at maaaring ganap na ihinto ng inyong komunidad ang paggamit ng datos nito. Magsimula sa [Para sa mga Komunidad ng Wika](/docs/network/community/for-language-communities), o magbukas lamang ng issue sa pampublikong repository.
:::

:::info[Kung kayo ay mananaliksik]
Ang mga pagwawasto rito ay datos na may provenance, hindi tahimik na mga edit: naka-hash ang mga bersyon ng corpus, ipinapirmi ng run cards ang eksaktong bersyon kung saan sila na-score, at nilalagyan ng label ang mga derived value bilang mga derivation. Kung gagamit kayo ng Network scores o corpora bilang batayan, banggitin ang bersyon — at ituring ang correction wave na pinamumunuan ng mga speaker bilang finding tungkol sa validity ng metric, dahil iyon talaga ito.
:::

:::info[Kung kayo ay builder]
Maaaring lehitimong magbago ang score ng inyong method kahit hindi nagbabago ang inyong code — na-allowlist ang isang salitang maling na-reject, naitama ang isang reference translation, o naayos ang isang variant class. Idisenyo ito nang naaayon: i-pin ang mga bersyon ng corpus sa inyong run cards ([spec ng Run Card](/docs/network/specifications/run-card)), subaybayan ang mga changelog ng dataset, at ituring ang mga pagwawastong mula sa mga speaker bilang pinakamaaasahang error signal na makukuha ninyo nang libre.
:::

## Tingnan din

- [Kung Paano Binabayaran ang mga Tagapagsalita](/docs/network/perspectives/how-speakers-get-paid) — ang parehong awtoridad ng tagapagsalita, sa yugto ng benchmark
- [Mula Benchmark Hanggang sa Pang-araw-araw na Paggamit](/docs/network/perspectives/from-benchmark-to-daily-use) — kung saan nagtatagpo ang mga pagwawasto at ang workflow ng paglalathala
- [Soberanya ng Datos](/docs/network/sovereignty/data-sovereignty) — Mga prinsipyo ng Katutubong soberanya ng datos, CARE, at Te Mana Raraunga — ang mga prinsipyong nasa likod ng disenyong ito
