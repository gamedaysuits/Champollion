---
sidebar_position: 8
title: "Ang Paninindigan sa mga Derived-Artifact"
description: "Sino po ang nagmamay-ari ng mga model, translation memory, at evaluation standard na binuo mula sa datos ng wika ng komunidad: hindi po kami. Ang Champollion ay isang infrastructure para sa mga komunidad upang makabuo at magmay-ari ng sarili nila."
related:
  - label: "Data Stewardship"
    to: /docs/network/sovereignty/data-sovereignty
    kind: doc
    note: "The corpus-side position: data stays with its stewards"
  - label: "Ownership Transfer"
    to: /docs/network/sovereignty/ownership-transfer
    kind: doc
    note: "How infrastructure custody hands over to communities"
  - label: "For Language Communities"
    to: /docs/network/community/for-language-communities
    kind: doc
    note: "The ground rules, in plain language"
---

# Ang Pangako sa mga Derived-Artifact

Sinasaklaw ng posisyon ng [Data Stewardship](/docs/network/sovereignty/data-sovereignty) ang mga *input*: nananatili ang mga corpora sa kanilang mga tagapangasiwa, hindi po namin kailanman hina-host o muling ipinapamahagi ang data ng komunidad. Sinasaklaw ng pahinang ito ang mga *output* — ang mga bagay na **binuo mula** sa data ng wika: mga trained model at ang kanilang mga weight, mga translation memory, mga fine-tune, mga coaching set, mga evaluation standard, at mga run artifact.

Ang pangako, sa isang pangungusap:

> **Wala po kaming inaangking pagmamay-ari sa anumang language model o language-derived artifact na binuo mula sa data ng isang komunidad — at wala po kaming pagnanais na gawin ito. Ang buong layunin ng proyektong ito ay maibigay ang development-level at ownership-level na kontrol ng mga teknolohiyang ito sa mga kamay ng mga nagsasalita nito.**

Ang Champollion ay isang **infrastructure**. Hindi pagmamay-ari ng isang kalsada ang mga kalakal na naglalakbay rito.

## Ano ang kongkretong ibig sabihin nito

**Ang mga model ay pagmamay-ari ng mga tao na ang wika ay kanilang sinasalita.** Kung ang isang model ay na-train sa data ng isang komunidad — gamit ang aming tooling o sa iba man — ang mga weight, ang mga fine-tune, at ang bawat derivative ay sumusunod sa mga tuntunin ng komunidad, hindi po sa amin. Hindi po kami kumukuha ng mga kopya, hindi po kami nagre-relicense, at hindi po namin itinuturing ang "kami ang sumulat ng training script" bilang isang karapatan sa pagmamay-ari sa kung ano ang ginawa nito. Ang aral ay historikal, hindi hipotetikal: paulit-ulit na nasaksihan ng mga komunidad ng wika ang mga panlabas na organisasyon na nagre-record, nagko-compile, o nagte-train sa kanilang wika at pagkatapos ay pinanghahawakan ang mga resulta — mga copyright sa mga recording ng mga nakatatanda, mga model na na-train sa mga na-scrape na pananalita — habang ang mga mismong nagsasalita ay kailangang humingi ng pahintulot para sa kanilang sariling mga boses. Ang anyo ng kabiguang iyon ang dahilan kung bakit umiiral ang pangakong ito upang alisin.

**Ang gawain sa Plains Cree (nêhiyawêwin) ay ang test case, at ang sagot ay nakatakda na.** Walang anumang binuo para sa Cree sa proyektong ito ang sa amin — hindi ang training corpus (na ginamit sa ilalim ng pahintulot ng mga may hawak nito at hindi kailanman muling ipinamahagi), hindi ang mga coached pipeline, hindi ang anumang trained model. Anumang Cree model na ginawa sa gawaing ito ay ilalabas **lamang sa isang kinikilalang awtoridad ng komunidad** — isang awtoridad sa edukasyon, isang konseho ng mga Nakatatanda, o alinmang lupon na itinalaga mismo ng komunidad — sa ilalim ng sariling mga tuntunin ng komunidad, at wala nang iba pa. Walang bersyon nito kung saan ang isang Cree model ay ipapadala bilang isang produkto. Ang gawain sa evaluation ng Cree ay gayundin na **non-commercial sa kabuuan**: sa pinakamataas, pinapanatili ng Champollion ang *generic* na evaluation methodology (ang LYSS standard — ang ideya ng intensional, morphology-aware, at fail-honest na pagmamarka). Ang **Cree instantiation** ng standard na iyon — ang linguistic knowledge na ini-encode at bini-validate nito — ay hindi po namin pagmamay-ari; ang komersyal na paggamit nito ay nakareserba habang hinihintay ang konsultasyon sa komunidad ng wikang nêhiyaw, at ang mga tuntunin ng komunidad ang masusunod.

**Naglalakbay ang mga score; ang mga artifact ay hindi.** Ang leaderboard ay naglalathala ng mga *measurement* — isang chrF++ value, isang validation rate, isang confidence interval — na may tinukoy na method at corpus. Hindi po ito kailanman naglalathala, nagho-host, o nangangailangan ng mismong model, ng nilalaman ng corpus, o ng mga output nang higit pa sa pinapayagan ng mga tuntunin ng tagapangasiwa. Kung nais ng isang komunidad na alisin ang row ng kanilang wika mula sa pampublikong paningin, ang mga [registration lane](/docs/network/sovereignty/registering-corpora) ay umiiral nang tiyak upang ang exposure ay nasa kanilang kontrol, hindi po sa amin.

## Ang ibig sabihin ng infrastructure ay: inyong data, inyong build, inyong mga key

Tatlong kongkretong anyo kung ano ang hitsura ng "kami ay infrastructure lamang" sa praktika:

1. **Bumubuo ang isang komunidad ng sarili nilang corpus.** Ginagamit nila ang CLI sa kanilang sariling mga makina; ang corpus ay nananatili kung saan nila ito inilagay. Kung pipiliin nilang i-register ito para sa benchmarking, ang registry ay nag-iimbak ng isang *pointer at isang checksum* — fetch-from-source, sa ilalim ng kanilang lisensya, at maaaring i-delist sa kanilang kahilingan. Ang corpus ay hindi kailanman pumapasok sa aming repository o sa aming storage. Ipinapatupad po ito ng makinarya na maaari ninyong suriin: ang pampublikong repo ay nagpapadala ng mga quarantine gate at mga database trigger na ginagawang structurally impossible ang pag-host ng nilalaman ng komunidad, hindi lamang impolite.

2. **Nagte-train ang isang komunidad ng sarili nilang model.** Ang training suite ([nmt-forge](https://github.com/gamedaysuits/Champollion)) ay tumatakbo sa kanilang hardware; ang mga checkpoint at weight ay umiiral lamang doon. Ang eval harness ang nagmamarka rito; ang board ang nagtatala ng score. Hindi po namin kailanman inaangkin ang model. Kung gusto nilang maging pribado ito magpakailanman, mangyayari po ito — isang score row lamang ang tanging pampublikong bakas, at kung maglalathala lamang sila nito.

3. **Nagpapatakbo ang isang komunidad ng sarili nilang benchmark.** Gamit ang mga [sovereign contest](/docs/network/sovereignty/run-a-sovereign-contest), ang test set ay nananatiling selyado sa infrastructure na kontrolado ng komunidad; ang mga method ay pumupunta *sa* data; tanging mga aggregate score lamang ang lumalabas. Ang komunidad ang nagpapasya kung sino ang maaaring mag-evaluate, sa anong mga tuntunin, at maaaring huminto anumang oras.

Sa bawat kaso, ang direksyon ng paglalakbay ay pareho: ang kakayahan ay patungo sa komunidad; ang data at ang mga derivative nito ay hindi lumalayo mula rito.

## Ang mga framework na aming tinitingala

Kami po ay **na-inspire ng, at naghahangad patungo sa,** mga Indigenous data-governance framework na mismong mga komunidad ang bumuo. Hindi po nasa amin ang pagpapasya na ituring ang aming mga sarili na sumusunod sa alinman sa mga ito — ang paghuhusgang iyon ay kabilang sa mga komunidad at institusyon na sumulat sa mga ito. Ang maaari po naming gawin ay magdisenyo patungo sa kanilang direksyon, pangalanan sila bilang mga standard-setter, at sabihin nang malinaw na lubos naming pinahahalagahan ang pagkakataong makinig at makipagtulungan sa mga ekspertong ito upang mapabuti ang sistemang ito sa kanilang diwa:

- **Mga prinsipyo ng data sovereignty ng First Nations** — pagmamay-ari, kontrol, pag-access, at pag-aari ng isang komunidad sa sarili nitong impormasyon: eksaktong ang apat na kakayahan na ipinapangako ng pahinang ito na panatilihin sa mga kamay ng komunidad.
- **Ang mga CARE Principles for Indigenous Data Governance** (Collective Benefit, Authority to Control, Responsibility, Ethics), mula sa Global Indigenous Data Alliance — ang corrective lens sa purong "open" na data: ang pagiging bukas ay hindi isang birtud kapag inaalis nito ang awtoridad ng isang tao sa kanilang sariling kaalaman.
- **Te Mana Raraunga**, ang charter ng Māori Data Sovereignty Network — ang data bilang isang buhay na taonga (kayamanan), na may mga karapatan at responsibilidad na sumusunod dito.
- **Ang Kaitiakitanga License** (Te Hiku Media) — sa aming kaalaman, ang pinakamalinaw na gumaganang halimbawa ng derived-artifact sovereignty sa teknolohiya ng wika: bumuo ang Te Hiku ng mga speech model *mula* at *para* sa te reo Māori at naglilisensya ng access sa ilalim ng mga tuntunin ng pangangalaga, upang ang mga model ay mapakinabangan ng mga Māori at manatili sa ilalim ng pamamahala ng mga Māori. Kapag sinabi naming "ang mga model ay pagmamay-ari ng mga nagsasalita," ang Te Hiku ang patunay ng pag-iral na ito ay gumagana.
- **Ang participatory research model ng Masakhane** — African NLP na binuo ng mga speaker-researcher bilang mga co-author at may-ari sa halip na mga data source; ang demonstrasyon na ang *proseso* ng pagbuo ng teknolohiya ng wika ay maaari mismong maging paglipat ng kakayahan.

Ang mga ito ay magkakaibang framework mula sa magkakaibang mga tao na may magkakaibang legal at kultural na posisyon — pinapangalanan po namin sila nang magkakatabi sa halip na pagsamahin sila sa iisang label. Kung saan ang aming disenyo ay nagkukulang sa kanilang diwa, iyon ay isang depekto na dapat ayusin, at mas gugustuhin po naming marinig ito mula sa mga eksperto kaysa matuklasan ito sa isang postmortem. Kung nagtatrabaho po kayo sa espasyong ito at handang sabihin sa amin kung ano ang aming pagkakamali: **ang pag-uusap na iyon ang pinakamahalagang kontribusyon na matatanggap ng proyektong ito.** Makipag-ugnayan po sa amin sa pamamagitan ng [Get Involved](/get-involved).

## Kung ano ang aming pagmamay-ari

Para sa kalinawan, ang mga bagay na *inaangkin* ng Champollion: ang infrastructure code (CLI, harness, training suite — bawat isa ay nasa ilalim ng inilathalang lisensya nito), ang generic na evaluation methodology, at ang mga *derived measurement* ng index (na nagdadala ng `champollion-derived` provenance nang tiyak upang hindi kailanman maling maiugnay ang mga ito sa isang komunidad o sa isang upstream source). Iyan po ang toolbox. Kung ano ang inyong bubuuin gamit ito ay inyo.

