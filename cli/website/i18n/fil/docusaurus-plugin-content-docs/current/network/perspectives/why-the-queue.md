---
sidebar_position: 5
title: "Bakit Ganito ang Pagkakabuo ng Queue"
slug: '/network/perspectives/why-the-queue'
description: "Ang pilosopiya sa likod ng community-compute queue: ang mga ipinagkaloob na token ay isang budget, ang mesh ang misyon, at ang listahan ng priyoridad ay isang hanay ng mga paniniwalang dapat isulat, punahin, at maaaring mapabulaanan."
related:
  - label: "Queue Construction Specification"
    to: /docs/network/specifications/queue-construction
    kind: spec
    note: "The formula this philosophy commits us to"
  - label: "Contributing Compute"
    to: /docs/network/getting-started/contributing-compute
    kind: guide
  - label: "Corpus Design Framework"
    to: /docs/network/specifications/corpus-design
    kind: spec
---

# Bakit Ganito ang Pagkakabuo ng Queue

Ang queue ang pinakamahalagang editorial artifact na inilalathala namin.
Sinasabi ng bawat item dito: *kung handa kayong gumastos ng ilang sentimo ng
API credit para sa low-resource machine translation, ito ang pinakamainam na lugar
na alam naming paglaanan nito.* May kaakibat na mga pananagutan ang pangungusap na iyon. Ang pahinang ito ay
tungkol sa kung ano ang mga iyon at kung paano ito tinutupad ng
[formula sa pagbuo ng queue](/docs/network/specifications/queue-construction).

## Ang priority list ay isang hanay ng mga paniniwala

Ang anumang pagkakasunud-sunod ng gawain ay nag-e-encode ng mga sagot sa tatlong tanong, naisulat man
o hindi ng sinuman ang mga ito:

1. **Ano ang pinahahalagahan natin?** Ano ba talaga ang *halaga* ng isang nakumpletong run?
2. **Ano ang pinaniniwalaan natin?** Ano ang inaasahan nating mangyari kapag isinagawa ang isang run na
   hindi pa natin nasusubukan?
3. **Ano ang inaamin nating hindi natin alam?** Saan dapat manaig ang pag-usisa
   kaysa prediksyon?

Karaniwang sinasagot ito ng karamihan sa mga benchmark queue nang implicit — "pinakamalaking gap muna,"
"pinakabagong model muna," spreadsheet ng kung sino man. Naniniwala kaming ang isang proyektong humihiling sa
mga estranghero na gumastos ng pera ay nararapat magkaroon ng mga tahasang sagot, sa isang formula
na maaaring muling kuwentahin ng sinuman, na nakalathala ang bawat input. Hindi dahil neutral
ang mga formula — hindi sila neutral, ine-encode ng sa amin ang aming misyon at mga kutob —
kundi dahil **ang bias na nakasulat ay maaaring pagtalunan, at ang hindi nakasulat
ay hindi.**

## Ang pinahahalagahan natin: mga chain, hindi mga checkmark

Ang aming misyon ay *bawat wika tungo sa bawat wika sa pamamagitan ng nasukat na
mga individual pair chain*. English-centric ang imprastraktura ng pagsasalin sa mundo;
ganoon din nagsimula ang sa amin — isang bituin ng mga benchmark na eng→X.
Ngunit iisang bagay lang ang nasusukat ng isang bituin: layo mula sa
English. Nararapat sa mga wika ng mundo ang isang *mesh*: kapag walang direktang
benchmark sa pagitan ng dalawang wika, dapat may chain ng mga nasukat na pair
— at ang kalidad nito ay dapat isang bagay na matatantiya natin mula sa
mga sukat sa halip na basta igiit.

Kaya ang halaga ng isang nakumpletong run ay hindi "isa pang row sa leaderboard." Ito
ay **kung gaano mas tumitibay ang buong mesh**: ang gain sa aming
quality-weighted chain-capacity objective Φ, na nagtatanong, para sa bawat
ordered pair ng mga wika sa Earth na sinusubaybayan namin, *gaano kahusay ang
pinakamainam na chain sa pagitan nila ngayon?* Ang run na kumokonekta sa isang isolated
na wika ay nagkakahalaga ng daan-daang run na nagpapakintab sa isa nang maliwanag
na sulok — at eksaktong sinasabi ng formula kung ilang daan, sa halip na
ipaubaya ito sa kutob. Ito rin ang instinct na nagtulak sa M2M-100 na
magmina ng "bridge languages" sa iba't ibang pamilya sa halip na mas maraming
English-paired data (Fan et al. 2021) — ginawang tuloy-tuloy, at itinuro
sa evaluation sa halip na training.

Dalawang kahihinatnan ang sadyang tinatanggap namin:

- **Ang murang maliit na run sa isang hindi pa nasusukat na pair ay karaniwang mas mataas kaysa isang mahal
  na run sa isang nasukat na.** Budget ang contributed compute; niraranggo namin ayon sa
  mesh gain *bawat dolyar* (ang klasikong greedy rule para masaklaw ang
  pinakamarami sa ilalim ng budget — Khuller, Moss & Naor 1999). Mas malaki ang nagagawa ng
  pagpapailaw sa ika-isandaang edge para sa misyon kaysa sa pag-gold-plate sa
  una.
- **Mas mababa ang halaga ng estimated chains kaysa measured edges.** Minumultiply ng aming chain
  model ang edge qualities at naniningil ng fidelity discount bawat
  pivot junction, dahil sinasabi ng apatnapung taon ng mga resulta sa pivot-translation
  na mas malaki ang nawawala kapag idinaan sa intermediate language kaysa ipinahihiwatig ng naive
  composition (Utiyama & Isahara 2007; Wu & Wang 2007). Ang
  discount ay permanenteng insentibo ng formula na *sukatin ang
  direct pair* sa halip na umasa sa isang mukhang kapani-paniwalang chain.

## Ang pinaniniwalaan natin: mga prediksyong sapat ang simple para ma-audit

Upang pahalagahan ang isang hindi pa naisagawang experiment, kailangan ninyong hulaan ang kinalabasan nito. May
spectrum dito, mula sa "huwag mag-assume ng kahit ano" hanggang sa "mag-train ng model para manghula." Sadya kaming
humihinto nang maaga sa spectrum na iyon: ang aming prediksyon ay isang sum na
masusuri ng isang contributor sa papel — *paano karaniwang nag-i-score ang language pair na ito,
paano karaniwang lumilihis ang model na ito, may coaching evidence ba para sa eksaktong wikang ito*
— at wala nang iba. Walang learned weights, walang embeddings, walang model na ang sariling mga bias
ay kailangan ding i-audit.

Binabawasan nito ang aming accuracy. Mas mahusay manghula ang isang gradient-boosted predictor sa ibabaw ng language
features. Ipinagpapalit namin ang accuracy na iyon para sa isang katangiang mas pinahahalagahan namin:
**ang bawat rank sa queue ay maaaring muling makuha sa kamay mula sa
mga numerong naka-print mismo sa item.** Kapag may nagtanong "bakit #1 ang Faroese run na ito?",
ang sagot ay apat na nakalathalang numero at isang
pangungusap, hindi "sabi ng model." Matagal nang binabalanse ng active-learning research
ang sophistication ng selection laban sa trust at inspectability
(Haffari, Roy & Sarkar 2009 ang nagdala mismo ng trade-off na ito sa machine
translation); ang volunteer-funded benchmark ay nararapat na nasa inspectable
na dulo.

## Ang hindi natin alam: pag-usisa na may budget

May failure mode ang queue na purong pinatatakbo ng mga prediksyon: kumpiyansa nitong
pinagkakaitan ang lahat ng mahina nitong mahulaan, at hindi kailanman
nalalaman na mali pala ito. Ang klasikong sagot mula sa bandit literature
ay *optimism in the face of uncertainty*: bigyan ang bawat hindi pa nasusubukang option ng
bonus na lumiliit habang naiipon ang ebidensya (Auer, Cesa-Bianchi &
Fischer 2002). Eksaktong bitbit ng aming queue ang bonus na iyon — naka-scale, hindi
nagkataon, sa noise floor ng aming mga instrumento: hindi kailanman
lalampas ang optimism sa ~5 chrF++ points na hindi rin kayang ipagkaiba ng maliliit
na dev corpora ([Corpus Design §6.3](/docs/network/specifications/corpus-design)).

Makikita rin ang parehong kababaang-loob sa dalawang asymmetry na dapat pangalanan:

- **Lahat ng inilathala ay ebidensya; open corpora lamang ang mga action.**
  Ang mga resulta sa restricted-license corpora ay nagbibigay-kaalaman sa kaalaman ng mesh,
  ngunit hinihiling lamang ng queue sa mga contributor na patakbuhin ang malayang
  mapapatakbo ng sinuman.
- **Hindi naglalakbay ang coaching evidence.** Kapag tinalo ng coached runs ang naive
  ones, nasukat na katotohanan iyon para sa wikang iyon — at katahimikan tungkol
  sa bawat iba pa. Pinananatili ng queue ang baseline-first ordering saanman
  hindi pa nasusukat ang coaching, sa halip na ipalagay na nagge-generalize ang gains
  ng isang wika.

## Ang tinatanggihan naming gawin

- **Walang engagement optimization.** Hindi kailanman inaayos ang mga item upang i-maximize
  ang clicks, streaks, o kasiyahan sa pagkumpleto. Ang mesh objective ang
  tanging objective.
- **Walang nakatagong editorial thumb.** Kung kailangan naming i-boost ang isang pair (isang
  community partnership, isang deadline), lalabas ito bilang isang pinangalanan,
  naka-version na term sa spec — hindi bilang tahimik na re-sort.
- **Walang claim-locking.** Maaaring patakbuhin ng sinuman ang anumang item anumang oras; ang magkakaparehong
  runs ay nade-deduplicate sa pamamagitan ng fingerprint at ang independent replications ay
  malugod na tinatanggap na ebidensya. Payo ang posisyon sa queue, hindi pahintulot.
- **Walang capability theater.** Ang Φ at bawat score na nagpapakain dito ay
  development-set numbers na may mga kilalang caveat (contamination upper
  bounds, cross-language scale differences). Ginagabayan nila ang paggastos; hindi sila
  kailanman sinisipi bilang kung ano ang "kayang gawin" ng isang model.

## Binuo upang magkamali sa publiko

Naka-version ang formula (`ecv-v2`), inuulit ang mga parameter nito sa
bawat inilalathalang queue, at ang sentral nitong modeling assumption — na
ang chain quality ay nagko-compose nang multiplicatively na may per-junction discount —
ay ngayon ay *masusubok gamit ang aming sariling data*: naglalaman ang mesh ng mga nasukat na
triangle (direct deu→fra kasabay ng deu→eng at eng→fra), kaya maaari naming
i-score ang aktuwal na chained translations laban sa mga prediksyon ng model at
i-fit ang discount nang empirically sa halip na piliin lamang ito. Kapag nangyari iyon,
sasabihin ito ng v3, at ipapaliwanag ng pahinang ito kung ano ang nagbago at
bakit. Iyon ang pamantayang nais naming ipatupad sa amin: hindi queue na
laging tama, kundi queue na laging nakatala ang pangangatwiran.

*Ang math, defaults, worked example, at buong citations ay nasa
[Queue Construction Specification](/docs/network/specifications/queue-construction).*
