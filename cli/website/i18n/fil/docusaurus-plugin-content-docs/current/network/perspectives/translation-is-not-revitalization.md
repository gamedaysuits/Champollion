---
sidebar_position: 1
title: "Ang Pagsasalin ay Hindi Pagpapasigla ng Wika"
slug: '/network/perspectives/translation-is-not-revitalization'
description: "Kung ano ang kaya at hindi kayang gawin ng machine translation para sa mga nanganganib na wika — malinaw na inilalahad. Ang MT ay imprastraktura para sa mga komunidad ng wika. Hindi nito kailanman napapalitan ang pakikipag-usap ng mga tao sa kapwa tao."
related:
  - label: "How Speakers Get Paid"
    to: /docs/network/perspectives/how-speakers-get-paid
    kind: position
  - label: "From Benchmark to Daily Use"
    to: /docs/network/perspectives/from-benchmark-to-daily-use
    kind: position
    note: "The post-editing path from draft to published text"
  - label: "Data Sovereignty"
    to: /docs/network/sovereignty/data-sovereignty
    kind: doc
    note: "Data-sovereignty principles, CARE, and consent before deployment"
  - label: "For Language Communities"
    to: /docs/network/community/for-language-communities
    kind: doc
---

# Ang Pagsasalin ay Hindi Revitalization

> **Posisyon.** Ang machine translation ay naglilipat ng teksto sa pagitan ng mga wika. Ang revitalization ay lumilikha ng mga bagong tagapagsalita. Magkaibang gawain ang mga ito na may magkaibang pamantayan ng tagumpay, at walang leaderboard score ang makapagpapabago niyan. Binubuo namin ang MT bilang infrastructure na naglilingkod sa mga layunin ng isang komunidad — kailanman ay hindi bilang kapalit ng intergenerational transmission. Natututo ang mga bata ng wika mula sa mga tao, hindi mula sa mga makina.

Noong 2026, madaling maniwala na kayang ayusin ng software ang kahit ano, kabilang ang isang wikang nawawalan ng mga tagapagsalita. Nais naming maging tiyak kung bakit mali ang paniniwalang iyon — at kung ano ang tunay na maiaambag ng translation technology.

Umiiral ang tekstong ito dahil mariing ipinahayag ng isang linguist na inimbitahan naming pumuna sa proyektong ito ang argumentong ito: hindi malulutas ng isang perpektong English→Cree translation system ang problema sa transmission (hindi natututuhan ng mga bata ang wika sa tahanan), ang problema sa prestige (English bilang wika ng kapangyarihang pang-ekonomiya), o ang problemang pedagogical (hindi sapat ang immersion schools at trained teachers). Maaari pa nga nitong palalain ang mga bagay, sa pamamagitan ng paglikha ng ilusyon na "the computer can speak Cree" at pagpapahina sa pagkaapurahan ng human transmission. Tinanggap namin ang malaking bahagi ng kritikang iyon, at inilalathala namin dito ang aming tugon sa halip na itago ito.

---

## Kung ano talaga ang kinakailangan ng revitalization

Consistent ang research literature tungkol sa language revitalization sa isang punto: nabubuhay ang mga wika kapag naipapasa ang mga ito sa pagitan ng mga henerasyon — kapag ginagamit ito ng mga magulang, lolo at lola, at mga komunidad sa pakikipag-usap sa mga bata, at lumalaki ang mga bata na ginagamit din ito sa pagsagot at pakikipag-usap (Fishman 1991; Hinton & Hale 2001). Lahat ng iba pa — mga paaralan, media, dictionaries, apps — ay sumusuporta sa transmission na iyon o wala itong sinusuportahan.

Walang translation system ang nakikilahok sa palitang iyon. Ang isang model na nagko-convert ng English document tungo sa Plains Cree ay hindi lumilikha ng speaker. Hindi nito pinupunan ang kakulangan sa staff ng isang immersion classroom, nagsasanay ng teacher, o nakikipag-upo sa isang bata sa hapag-kusina. Kung ilalarawan man ang aming gawain bilang "saving languages," mali ang paglalarawang iyon at sasabihin namin iyon.

## Kung ano ang hindi kayang gawin ng MT

Tahasan itong ipinapahayag, upang wala nang kalituhan sa hinaharap:

- **Hindi nito kayang palitan ang mga speaker.** Ang output na hindi pa nasusuri ng fluent speaker ay draft, hindi text. Itinuturing ng sarili naming [scoring rules](/docs/network/specifications/scoring) ang bawat automated score bilang proxy; tanging human review lamang ang nagkukumpirma ng usability.
- **Hindi nito kayang magturo ng first language.** Natututuhan ng mga bata ang wika sa pamamagitan ng ugnayan at immersion, hindi sa pamamagitan ng translated documents.
- **Maaari itong lumikha ng mapaminsalang ilusyon.** Maaaring ipahiwatig ng isang demo na "nagsasalita" ng isang wika na ligtas ang wikang iyon kahit hindi naman. Totoo ang prestige risk na ito, at itinuturing namin ito bilang isang bukas na tanong na dapat suriin *kasama* ang mga komunidad, hindi bilang talking point na dapat pamahalaan.
- **Hindi nito kayang magpasya ng anuman.** Kung dapat bang umiral ang isang translation system para sa isang wika, at kung saan ito maaaring gamitin, ay pasya ng komunidad — kabilang ang pasyang huwag itong i-deploy kailanman. Nakapaloob ang kontrol na iyon sa architecture ng [ownership transfer](/docs/network/sovereignty/ownership-transfer) at [data sovereignty](/docs/network/sovereignty/data-sovereignty), at kabilang dito ang mga konteksto: maaaring tanggapin ng isang komunidad ang MT para sa official documents at tanggihan ito para sa classroom materials.

## Kung ano ang tunay na kayang gawin ng MT

Sa kabila ng kontekstong iyon, may mga kongkreto at nakatakdang bagay na naiaambag ng translation infrastructure — bawat isa ay naglilingkod sa mga taong gumagawa na ng tunay na gawain.

**1. Throughput para sa overloaded translators.** Humaharap ang community translation offices sa mas maraming dokumentong *dapat* umiral sa wika kaysa sa kayang likhain ng human translators mula sa simula. Binabago ng machine draft ang trabaho mula sa "translate everything" tungo sa "review and correct" — at natuklasan ng controlled studies na makabuluhang mas mabilis ang post-editing kaysa pagsasalin mula sa simula, na napapanatili o napapahusay ang kalidad (Plitt & Masselot 2010; Green, Heer & Manning 2013). Inilalarawan namin nang detalyado ang workflow na ito sa [Mula Benchmark Hanggang Pang-araw-araw na Paggamit](/docs/network/perspectives/from-benchmark-to-daily-use). Ang caveat: sinaklaw ng mga pag-aaral na iyon ang high-resource language pairs; wala pa kaming katumbas na ebidensiya para sa polysynthetic languages, na bahagi ng itinatakdang sukatin ng proyektong ito.

**2. Praktikal na leverage para sa language rights.** Umiiral sa batas ang karapatan sa government services sa Indigenous languages sa ilang hurisdiksyon. Ang madalas na nawawala ay ang praktikal na kapasidad na makagawa ng mga pagsasalin sa bilis na hinihingi ng burukrasya. Ang isang komunidad na kayang gawing reviewed translation ang isang fifty-page policy document sa loob ng mga araw sa halip na mga buwan ay nasa mas matibay na posisyon sa negosasyon. Hindi nililikha ng technology ang karapatan; ginagawa nitong mas mahirap balewalain ang karapatan.

**3. Reusable linguistic infrastructure.** Ang morphological analyzer (FST) na ginagamit namin upang tiyaking naglalaman ang translation output ng totoong mga salita — hindi hallucinated ones — ay nag-e-encode ng *bakit* valid ang bawat word form. Ang parehong machinery na iyon ang pundasyon para sa learning tools: conjugation trainers, error-correcting writing aids, morphological explorers. Iisang artifact ang verification engine at ang pedagogical engine. Isa itong pathway, hindi pangako — kailangang buuin ang learning tools, at pasya ng komunidad kung bubuuin ang mga ito.

**4. Suporta para sa second-language learners.** Ang revitalization ay hindi lamang ang pagkatuto ng mga bata ng first language. Ito rin ay ang pagkatuto ng mga adult bilang second language — mga taong maaaring hindi kailanman umabot sa Elder-level fluency ngunit kayang magbasa ng community documents, makilahok nang may pag-unawa, at pataasin ang public presence ng wika sa pamamagitan ng paggamit nito. Para sa populasyong ito, tunay na tool ang translation aid, gaya ng dictionary bilang tool.

**5. Isang dahilan upang mapondohan at mapasakamay ng sariling komunidad ang gawain.** Sa aming model, ang mga napatunayang method ay tuwirang [inililipat sa community ownership](/docs/network/sovereignty/ownership-transfer), at anumang kitain ng isang komunidad mula sa asset na pag-aari nito ay ganap na sa kanila ([kung paano pinopondohan ang gawain](/docs/network/sovereignty/economic-model)). Ang mga speaker ay [binabayaran para sa kanilang expertise](/docs/network/perspectives/how-speakers-get-paid), hindi hinihinging magboluntaryo nito. Hindi rin revitalization ang alinman doon — ngunit idinidirekta nito ang resources patungo sa mga taong gumagawa ng revitalization, sa halip na palayo sa kanila.

## Ang tapat na framing

Mahaba ang kasaysayan ng field ng mga technology project na dumarating na may rescue narratives at umaalis na may publications (Bird 2020). Sinisikap naming panindigan ang mas makitid na claim: **ang MT ay infrastructure.** Ang infrastructure ay naglilingkod sa mga layuning itinakda ng ibang tao. Hindi nagpapasya ang mga kalsada kung saan kayo maglalakbay; hindi nagpapasya ang technology na ito kung mabubuhay ang isang wika. Ang mga speaker, pamilya, at komunidad ang nagpapasya — at tama ang framing ng [UNESCO International Decade of Indigenous Languages](https://idil2022-2032.org/) na ilagay ang Indigenous peoples, hindi ang tools, sa sentro.

Kung magpapasya ang isang komunidad na nakatutulong ang translation technology sa kanilang mga layunin, nais naming ito ang pinakamahusay at pinaka-accountable na bersyon na posible — pag-aari nila, validated ng kanilang mga speaker, at deployed sa kanilang mga tuntunin. Kung magpapasya ang isang komunidad na hindi ito nakatutulong, valid na outcome ng proyektong ito ang konklusyong iyon, hindi kabiguan nito. Parehong commitment ang dalawang bahagi ng pangungusap na iyon.

---

## Ano ang ibig sabihin nito para sa inyo

:::info[Kung kayo ay kasapi ng komunidad]
Hindi sasabihin ng proyektong ito na maililigtas ng isang app ang inyong wika — hindi nito kaya. Ang iniaalok nito ay may hangganan: mas mabilis na pagsasalin ng dokumento sa ilalim ng pagsusuri ng matatas na tagapagsalita, imprastrakturang maaaring ganap na pagmamay-arian ng inyong komunidad, at kabayaran para sa kadalubhasaan ng mga tagapagsalita. Kung gagamitin man ito at paano ito gagamitin ay desisyon ng inyong komunidad, kabilang ang desisyong huwag itong gamitin. Tingnan ang [Para sa mga Komunidad ng Wika](/docs/network/community/for-language-communities) at [Pag-uulat ng mga Error at Pagmamay-ari sa mga Pagwawasto](/docs/network/perspectives/reporting-errors-and-owning-corrections).
:::

:::info[Kung kayo ay isang mananaliksik]
Ituring ang "MT para sa mga nanganganib na wika" bilang pahayag tungkol sa imprastraktura, hindi bilang pahayag ng revitalisasyon, at magbabago ang inyong tanong sa pagsusuri: hindi "mataas ba ang BLEU score?" kundi "nasusukat ba nitong nababawasan ang workload ng mga taong gumagawa ng tunay na gawain, ayon sa kanilang mga kundisyon?" Ang [espesipikasyon ng benchmark](/docs/network/specifications/benchmark) at [Paano Ito Gumagana §8 (Mga Tensiyon at Limitasyon)](/docs/network/how-it-works#8-tensions-and-limitations) ang mga lugar kung saan pinananagot namin ang aming sarili sa pamantayang iyon.
:::

:::info[Kung kayo ay isang tagabuo]
Magbuo para sa post-editing workflow, hindi para sa demo. Ang user ng inyong pamamaraan ay isang matatas na tagapagsalita na nagwawasto ng draft, at ang pinakamasamang failure mode ay mga hallucinated na salitang mukhang kapani-paniwala sa mga hindi tagapagsalita — kaya lahat dito ay dumaraan sa morphological validation. Magsimula sa [Magsumite ng Pamamaraan](/docs/network/getting-started/submit-a-method) at [Mula Benchmark hanggang Pang-araw-araw na Paggamit](/docs/network/perspectives/from-benchmark-to-daily-use).
:::

---

## Sources

- Fishman, J. A. (1991). *Reversing Language Shift: Theoretical and Empirical Foundations of Assistance to Threatened Languages.* Multilingual Matters.
- Hinton, L., & Hale, K. (eds.) (2001). *The Green Book of Language Revitalization in Practice.* Academic Press.
- Plitt, M., & Masselot, F. (2010). "A Productivity Test of Statistical Machine Translation Post-Editing in a Typical Localisation Context." *The Prague Bulletin of Mathematical Linguistics*, 93, 7–16. [PDF](https://ufal.mff.cuni.cz/pbml/93/art-plitt-masselot.pdf)
- Green, S., Heer, J., & Manning, C. D. (2013). "The Efficacy of Human Post-Editing for Language Translation." *Proceedings of CHI 2013.* [Paper](https://idl.uw.edu/papers/post-editing)
- Bird, S. (2020). "Decolonising Speech and Language Technology." *Proceedings of COLING 2020*, 3504–3519. [Paper](https://aclanthology.org/2020.coling-main.42/)
- UNESCO. *International Decade of Indigenous Languages 2022–2032.* [idil2022-2032.org](https://idil2022-2032.org/)

## Tingnan din

- [Paano Binabayaran ang mga Speaker](/docs/network/perspectives/how-speakers-get-paid) — ang compensation model, sa mga numero
- [Mula Benchmark Hanggang Pang-araw-araw na Paggamit](/docs/network/perspectives/from-benchmark-to-daily-use) — ang post-editing path
- [How It Works](/docs/network/how-it-works) — ang buong platform architecture, kabilang ang §8 tungkol sa tensions na hindi pa namin nareresolba
