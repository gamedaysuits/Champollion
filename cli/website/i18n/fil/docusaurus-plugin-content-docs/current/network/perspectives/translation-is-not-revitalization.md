---
sidebar_position: 1
title: "Ang Pagsasalin ay Hindi Pagpapasigla ng Wika"
slug: '/network/perspectives/translation-is-not-revitalization'
description: "Kung ano ang kaya at hindi kayang gawin ng machine translation para sa mga nanganganib na wika — malinaw na inilalahad. Ang MT ay imprastraktura para sa mga komunidad ng wika. Hindi nito kailanman napapalitan ang pakikipag-usap ng mga tao sa kapwa tao."
related:
  - label: "Working with speakers"
    to: /docs/working-with-speakers
    kind: position
  - label: "From Benchmark to Daily Use"
    to: /docs/put-it-to-work
    kind: position
    note: "The post-editing path from draft to published text"
  - label: "Data Sovereignty"
    to: /docs/your-words-your-rules
    kind: doc
    note: "Who decides what happens to language data, and consent before deployment"
---

# Ang Pagsasalin ay Hindi Revitalization

> **Posisyon.** Ang machine translation ay naglilipat ng teksto sa pagitan ng mga wika. Ang revitalization ay lumilikha ng mga bagong tagapagsalita. Magkaibang gawain ang mga ito na may magkaibang pamantayan ng tagumpay, at walang leaderboard score ang makapagpapabago niyan. Binubuo namin ang MT bilang infrastructure na naglilingkod sa mga layunin ng isang komunidad — kailanman ay hindi bilang kapalit ng intergenerational transmission. Natututo ang mga bata ng wika mula sa mga tao, hindi mula sa mga makina.

Noong 2026, madaling maniwala na kayang ayusin ng software ang kahit ano, kabilang ang isang wikang nawawalan ng mga tagapagsalita. Nais naming maging tiyak kung bakit mali ang paniniwalang iyon — at kung ano ang tunay na maiaambag ng translation technology.

Umiiral ang akdang ito dahil ang isang puna sa proyektong ito, na isinulat mula sa pananaw ng isang lingguwista, ay mariing naglatag ng argumento: hindi malulutas ng isang perpektong sistema ng pagsasalin ng English→Cree ang suliranin sa transmisyon (ang hindi pagkatuto ng mga bata ng wika sa tahanan), ang suliranin sa prestihiyo (English bilang wika ng kapangyarihang pang-ekonomiya), o ang suliraning pedagohikal (kakulangan ng mga paaralang immersion at mga sinanay na guro). Maaari pa nga nitong palalain ang sitwasyon, sa pamamagitan ng paglikha ng ilusyon na "nakapagsasalita ng Cree ang kompyuter" at pagpapahina sa pagiging apurahan ng transmisyon ng tao. Tinanggap namin ang malaking bahagi ng punang iyon, at inilalathala namin dito ang aming tugon sa halip na ibaon ito.

---

## Kung ano talaga ang kinakailangan ng revitalization

Consistent ang research literature tungkol sa language revitalization sa isang punto: nabubuhay ang mga wika kapag naipapasa ang mga ito sa pagitan ng mga henerasyon — kapag ginagamit ito ng mga magulang, lolo at lola, at mga komunidad sa pakikipag-usap sa mga bata, at lumalaki ang mga bata na ginagamit din ito sa pagsagot at pakikipag-usap (Fishman 1991; Hinton & Hale 2001). Lahat ng iba pa — mga paaralan, media, dictionaries, apps — ay sumusuporta sa transmission na iyon o wala itong sinusuportahan.

Walang translation system ang nakikilahok sa palitang iyon. Ang isang model na nagko-convert ng English document tungo sa Plains Cree ay hindi lumilikha ng speaker. Hindi nito pinupunan ang kakulangan sa staff ng isang immersion classroom, nagsasanay ng teacher, o nakikipag-upo sa isang bata sa hapag-kusina. Kung ilalarawan man ang aming gawain bilang "saving languages," mali ang paglalarawang iyon at sasabihin namin iyon.

## Kung ano ang hindi kayang gawin ng MT

Tahasan itong ipinapahayag, upang wala nang kalituhan sa hinaharap:

- **Hindi nito kayang palitan ang mga tagapagsalita.** Ang output na hindi nasuri ng isang matatas na tagapagsalita ay isang borador, hindi isang teksto. Itinuturing ng sarili naming [mga panuntunan sa pagmamarka](/docs/network/specifications/scoring) ang bawat awtomatikong marka bilang isang proxy; tanging pagsusuri lamang ng tao ang nagpapatunay kung magagamit ito.
- **Hindi nito kayang magturo ng unang wika.** Natututuhan ng mga bata ang wika sa pamamagitan ng pakikipag-ugnayan at imersyon, hindi sa pamamagitan ng mga isinaling dokumento.
- **Maaari itong lumikha ng isang mapaminsalang ilusyon.** Ang isang demo na "nagsasalita" ng isang wika ay maaaring magpahiwatig na ligtas ang wika kahit na hindi naman. Totoo ang panganib na ito sa prestihiyo, at itinuturing namin ito bilang isang bukas na tanong na dapat suriin *kasama* ang mga komunidad, hindi isang puntong pag-uusapan upang pamahalaan lamang.
- **Wala itong kakayahang magdesisyon.** Kung dapat bang magkaroon ng sistema ng pagsasalin para sa isang wika, at kung saan ito maaaring gamitin, ay pasya ng komunidad — kabilang ang pasya na huwag itong ipatupad kailanman. Ang kontrol na iyon ay nakapaloob sa arkitektura ng [paglilipat ng pagmamay-ari](/docs/network/sovereignty/ownership-transfer) at [soberanya ng data](/docs/your-words-your-rules), at saklaw nito ang mga konteksto: maaaring tanggapin ng isang komunidad ang MT para sa mga opisyal na dokumento at tanggihan ito para sa mga materyales sa silid-aralan.

## Kung ano ang tunay na kayang gawin ng MT

Sa kabila ng kontekstong iyon, may mga kongkreto at nakatakdang bagay na naiaambag ng translation infrastructure — bawat isa ay naglilingkod sa mga taong gumagawa na ng tunay na gawain.

**1. Throughput para sa mga tagapagsaling labis ang trabaho.** Humaharap ang mga tanggapan ng pagsasalin ng komunidad sa mas maraming dokumento na *dapat* umiral sa wika kaysa sa kayang buuin ng mga taong tagapagsalin mula sa simula. Binabago ng borador ng makina ang trabaho mula sa "isalin ang lahat" tungo sa "suriin at iwasto" — at natuklasan sa mga kontroladong pag-aaral na ang post-editing ay higit na mas mabilis kaysa sa pagsasalin mula sa simula, habang napapanatili o napapahusay ang kalidad (Plitt & Masselot 2010; Green, Heer & Manning 2013). Inilalarawan namin ang daloy ng gawaing ito nang detalyado sa [Gamitin ito sa gawain](/docs/put-it-to-work). Ang pag-iingat: sumaklaw ang mga pag-aaral na iyon sa mga pares ng wikang high-resource; wala pa kaming katumbas na patunay para sa mga wikang polysynthetic, na bahagi ng itinakdang sukatin ng proyektong ito.

**2. Praktikal na leverage para sa language rights.** Umiiral sa batas ang karapatan sa government services sa Indigenous languages sa ilang hurisdiksyon. Ang madalas na nawawala ay ang praktikal na kapasidad na makagawa ng mga pagsasalin sa bilis na hinihingi ng burukrasya. Ang isang komunidad na kayang gawing reviewed translation ang isang fifty-page policy document sa loob ng mga araw sa halip na mga buwan ay nasa mas matibay na posisyon sa negosasyon. Hindi nililikha ng technology ang karapatan; ginagawa nitong mas mahirap balewalain ang karapatan.

**3. Reusable linguistic infrastructure.** Ang morphological analyzer (FST) na ginagamit namin upang tiyaking naglalaman ang translation output ng totoong mga salita — hindi hallucinated ones — ay nag-e-encode ng *bakit* valid ang bawat word form. Ang parehong machinery na iyon ang pundasyon para sa learning tools: conjugation trainers, error-correcting writing aids, morphological explorers. Iisang artifact ang verification engine at ang pedagogical engine. Isa itong pathway, hindi pangako — kailangang buuin ang learning tools, at pasya ng komunidad kung bubuuin ang mga ito.

**4. Suporta para sa second-language learners.** Ang revitalization ay hindi lamang ang pagkatuto ng mga bata ng first language. Ito rin ay ang pagkatuto ng mga adult bilang second language — mga taong maaaring hindi kailanman umabot sa Elder-level fluency ngunit kayang magbasa ng community documents, makilahok nang may pag-unawa, at pataasin ang public presence ng wika sa pamamagitan ng paggamit nito. Para sa populasyong ito, tunay na tool ang translation aid, gaya ng dictionary bilang tool.

**5. Isang dahilan upang ang gawain ay mapondohan at maangkin sa sariling komunidad.** Sa aming modelo, ang mga napatunayang pamamaraan ay [inililipat nang ganap sa pagmamay-ari ng komunidad](/docs/network/sovereignty/ownership-transfer), at anuman ang kikitain ng isang komunidad mula sa isang ari-ariang pag-aari nito ay ganap na sa kanila ([Sino ang maaaring gumamit nito, at magkano ang halaga](/docs/getting-started/who-may-use-this)). Ang mga tagapagsalita ay [binabayaran para sa kanilang kadalubhasaan](/docs/working-with-speakers), hindi hinihilingang magboluntaryo nito. Wala rin sa alinman dito ang mismong muling pagbuhay — ngunit nagdidirekta ito ng mga mapagkukunan patungo sa mga taong nagsasagawa ng muling pagbuhay, sa halip na ilayo sa kanila.

## Ang tapat na framing

Mahaba ang kasaysayan ng field ng mga technology project na dumarating na may rescue narratives at umaalis na may publications (Bird 2020). Sinisikap naming panindigan ang mas makitid na claim: **ang MT ay infrastructure.** Ang infrastructure ay naglilingkod sa mga layuning itinakda ng ibang tao. Hindi nagpapasya ang mga kalsada kung saan kayo maglalakbay; hindi nagpapasya ang technology na ito kung mabubuhay ang isang wika. Ang mga speaker, pamilya, at komunidad ang nagpapasya — at tama ang framing ng [UNESCO International Decade of Indigenous Languages](https://idil2022-2032.org/) na ilagay ang Indigenous peoples, hindi ang tools, sa sentro.

Kung magpapasya ang isang komunidad na nakatutulong ang translation technology sa kanilang mga layunin, nais naming ito ang pinakamahusay at pinaka-accountable na bersyon na posible — pag-aari nila, validated ng kanilang mga speaker, at deployed sa kanilang mga tuntunin. Kung magpapasya ang isang komunidad na hindi ito nakatutulong, valid na outcome ng proyektong ito ang konklusyong iyon, hindi kabiguan nito. Parehong commitment ang dalawang bahagi ng pangungusap na iyon.

---

## Ano ang ibig sabihin nito para sa inyo

:::info[Kung isa kayong miyembro ng komunidad]
Hindi sasabihin sa inyo ng proyektong ito na kayang iligtas ng isang app ang inyong wika — hindi nito kaya. Limitado ang iniaalok nito: mas mabilis na pagsasalin ng dokumento sa ilalim ng pagsusuri ng matatas na tagapagsalita, imprastrakturang maaaring ganap na maangkin ng inyong komunidad, at kabayaran para sa kadalubhasaan ng mga tagapagsalita. Kung gagamitin man at paano gagamitin ang anuman dito ay desisyon ng inyong komunidad, kabilang ang desisyong huwag itong gamitin. Tingnan ang [Inyong mga salita, inyong mga panuntunan](/docs/your-words-your-rules) at [Pag-uulat ng mga Error at Pagmamay-ari ng mga Pagwawasto](/docs/network/perspectives/reporting-errors-and-owning-corrections).
:::

:::info[Kung isa kayong mananaliksik]
Ituring ang "MT para sa mga nanganganib na wika" bilang isang pag-angkin sa imprastraktura, hindi isang pag-angkin sa muling pagbuhay ng wika, at magbabago ang tanong sa inyong pagsusuri: hindi "mataas ba ang marka ng BLEU?" kundi "nasusukat ba nitong nababawasan ang dami ng trabaho ng mga taong gumagawa ng tunay na gawain, sa kanilang sariling mga tuntunin?" Ang [espesipikasyon ng benchmark](/docs/network/specifications/benchmark) at [Leaderboard at paglalathala](/docs/reference/leaderboard) ang mga lugar kung saan pinananagutan namin ang aming sarili sa pamantayang iyon.
:::

:::info[Kung isa kayong tagabuo]
Bumuo para sa daloy ng gawaing post-editing, hindi para sa demo. Ang gagamit ng inyong pamamaraan ay isang matatas na tagapagsalitang nagwawasto ng borador, at ang pinakamasamang anyo ng pagkabigo ay ang mga inimbentong salita na mukhang kapani-paniwala sa mga hindi tagapagsalita — kung kaya't ang morpolohikal na pagpapatunay ang sumasala sa lahat dito. Magsimula sa [Magsumite ng Pamamaraan](/docs/network/getting-started/submit-a-method) at [Gamitin ito sa gawain](/docs/put-it-to-work).
:::

---

## Mga Pinagmulan

- Fishman, J. A. (1991). *Reversing Language Shift: Theoretical and Empirical Foundations of Assistance to Threatened Languages.* Multilingual Matters.
- Hinton, L., & Hale, K. (eds.) (2001). *The Green Book of Language Revitalization in Practice.* Academic Press.
- Plitt, M., & Masselot, F. (2010). "A Productivity Test of Statistical Machine Translation Post-Editing in a Typical Localisation Context." *The Prague Bulletin of Mathematical Linguistics*, 93, 7–16. [PDF](https://ufal.mff.cuni.cz/pbml/93/art-plitt-masselot.pdf)
- Green, S., Heer, J., & Manning, C. D. (2013). "The Efficacy of Human Post-Editing for Language Translation." *Proceedings of CHI 2013.* [Paper](https://idl.uw.edu/papers/post-editing)
- Bird, S. (2020). "Decolonising Speech and Language Technology." *Proceedings of COLING 2020*, 3504–3519. [Paper](https://aclanthology.org/2020.coling-main.42/)
- UNESCO. *International Decade of Indigenous Languages 2022–2032.* [idil2022-2032.org](https://idil2022-2032.org/)

## Tingnan din

- [Pakikipagtulungan sa mga tagapagsalita](/docs/working-with-speakers) — ang modelo ng kabayaran, sa mga numero
- [Gamitin ito sa gawain](/docs/put-it-to-work) — ang landas ng post-editing
- [Leaderboard at paglalathala](/docs/reference/leaderboard) — ang buong arkitektura ng platform, kabilang ang §8 tungkol sa mga tensiyong hindi pa namin nareresolba
