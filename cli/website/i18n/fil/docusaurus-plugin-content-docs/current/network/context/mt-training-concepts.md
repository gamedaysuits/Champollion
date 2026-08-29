---
sidebar_position: 0
title: "MT Training sa Payak na Wika"
description: "Isang glossary para sa walang paunang kaalaman tungkol sa bokabularyong kailangan ninyo upang mag-train ng translation model — bawat termino ay may kahulugan at worked example, isinulat para sa mga taong nagdidirekta ng coding agent."
related:
  - label: "So You Want to Train Your Own Model"
    to: /docs/network/tutorials/train-your-own-model
    kind: tutorial
    note: "The hands-on walkthrough these words are for"
  - label: "Train a Model Honestly (nmt-forge)"
    to: /docs/network/getting-started/training-honestly
    kind: guide
    note: "The suite that turns every rule here into a guardrail"
  - label: "MT Field Briefing"
    to: /docs/network/context/mt-field-briefing
    kind: doc
    note: "Broader context on where machine translation stands"
  - label: "Statistical Significance Testing"
    to: /docs/network/specifications/significance
    kind: spec
    note: "The math behind error bars — why one number is never enough"
  - label: "Metric Reliability"
    to: /docs/network/specifications/metric-reliability
    kind: spec
    note: "Which score to believe for your language"
---

# Pagsasanay sa MT sa Payak na Wika

Ang pagsasanay ng modelong machine-translation (MT) ay may sarili nitong bokabularyo, at karamihan
dito ay hindi kailanman ipinapaliwanag sa mga baguhan — ipinagpapalagay na alam na ito. Walang ipinagpapalagay ang pahinang ito.
Ang bawat termino sa ibaba ay tinutukoy sa payak na salita at ikinakabit sa isang konkretong halimbawa,
upang kapag binasa ninyo ang [training walkthrough](/docs/network/tutorials/train-your-own-model)
o pinanood ang inyong coding agent na magpatakbo ng command, alam ninyo ang ibig sabihin ng mga salita at,
mas mahalaga, **alin sa mga ito ang nagtatago ng mga pagkakamaling tahimik na sumisira
sa mga resulta.**

:::info[Para kanino ito]
Hindi ninyo kailangang magsulat ng Python. Ang inaasahang paraan para gawin ang gawaing ito ngayon ay
**magdirekta ng coding agent** — Claude Code, OpenAI Codex, Cursor, OpenCode,
Google Antigravity, o katulad — na nagpapatakbo ng mga tool para sa inyo. Ang tungkulin ninyo ay
maunawaan nang sapat ang mga konsepto upang makapagbigay ng mabubuting tagubilin at mabasa nang tapat ang
mga resulta. Iyon mismo ang layunin ng pahinang ito. Kapag binanggit namin ang isang
tool, ang ibig naming sabihin ay [**nmt-forge**](/docs/network/getting-started/training-honestly),
ang training suite kung saan nakapaloob ang mga ideyang ito; ang mga salita, gayunman, ay pag-aari ng
buong larangan, hindi amin.
:::

Isang patuloy na halimbawa ang mag-uugnay sa pahina. Ipagpalagay na nais ninyong bumuo ng modelong
nagsasalin ng **English → isang low-resource language** — tawagin natin itong inyong *target
language* — kung saan halos walang umiiral na naisaling teksto. Ang lahat sa ibaba ay isang
bahagi ng proyektong iyon.

---

## 1. Ang dalawang tumpok: training data at evaluation data

Ang **parallel data** ay tekstong ipinares sa salin nito — parehong kahulugan sa
dalawang wika, nakahanay pangungusap sa pangungusap.

> `The children are playing.` → `awâsisak mêtawêwak.`

Natututo ang isang modelo sa pag-aaral ng libo-libong ganitong pares. Ngunit dapat ninyong panatilihin ang mga pares
sa **dalawang tumpok na hindi kailanman nagkakahalo**:

- **Training data** — ang mga pares na *pinahihintulutang pag-aralan* ng modelo. Binabasa nito
  ang mga ito nang paulit-ulit at inaayos ang sarili upang muling makagawa ng katulad ng mga ito.
- **Evaluation data** (o **eval data**) — mga pares na *hindi kailanman pinahihintulutang
  makita sa panahon ng training* ng modelo. Itinatago ninyo ang mga salin, pinapasalin sa modelo ang
  source side nang walang tulong, at inihahambing ang sagot nito sa nakatagong katotohanan.
  Ito ang tanging tapat na sukat kung natuto ba itong *magsalin* sa halip na *magsaulo*.

:::tip[Ang bersyong isang pangungusap ng lahat ng nasa pahinang ito]
May saysay lamang ang isang test kung hindi pa kailanman nakita ng modelo ang mga sagot. Halos
bawat pagkakamali sa ibaba ay ibang paraan kung paano tumatagas ang mga sagot mula sa eval pile papunta sa
training pile nang walang nakakapansin.
:::

### Real vs. synthetic parallel data

- Ang **real (o *gold*) parallel data** ay gawa ng tao: bilingual na aklat-aralin,
  mga rekord ng pamahalaan na isinalin ng mga tao, mga kuwentong inarkibo ng komunidad. Mapagkakatiwalaan ito ngunit, para sa karamihan ng mga wika, masakit ang kakulangan — madalas ay ilang
  daang sentence pairs lamang.
- Ang **synthetic parallel data** ay *ginagawa* ng isang program sa halip na
  isulat ng tao. Kapag 400 real pairs lamang ang mayroon kayo, hindi kayo makakapagsanay ng
  usable na modelo — kaya bumubuo kayo ng daan-daang libong karagdagang pares mula sa
  mga rule (higit pa kung paano sa [§7](#7-manufacturing-data-when-you-dont-have-enough)).

Napakalaki ng kahalagahan ng ugnayan:

> **Worked example.** May 435 real English→Cree pairs ang isang proyekto at
> gumagawa ito ng ~1,000,000 synthetic ones. Nagtetrain ang modelo sa malaking
> synthetic pile *kasama* ang ilang daang real pairs. Ang synthetic data ay nagbibigay ng
> coverage; ang real data ang nag-aangkla sa modelo sa kung paano aktuwal na ginagamit ang wika.
> Ang buong kasanayan ay (a) gawing saklaw ng synthetic pile ang pinakamaraming bahagi ng
> wika hangga't maaari, at (b) magsukat lamang sa real text na hindi kailanman
> nahawakan ng modelo.

:::danger[Huwag kailanman mag-test sa synthetic data]
Ang evaluation set ay dapat **real data lamang**. Kung magte-test kayo sa manufactured
sentences, sinusukat ninyo kung tumutugma ang modelo sa inyong *generator* — hindi
kung kaya nitong magsalin. Ang mabuting training suite ay tumatangging magrehistro ng synthetic
rows bilang test set kahit kailan.
:::

---

## 2. Splitting: train, dev, at test

Nagsisimula kayo sa isang tumpok ng real pairs at **hinahati** ito sa tatlong tungkulin.

| Split | Tinatawag din | Para saan ito | Nakikita ba ito ng modelo sa training? |
|---|---|---|---|
| **train** | training set | Ang mga pares na pinag-aaralan ng modelo | Oo |
| **dev** | validation set, held-in | Pagpapasya kung *kailan titigil* at *aling bersyon ang pinakamainam* | Hindi (ini-*score* lamang, hindi kailanman pinag-aaralan) |
| **test** | held-out, evaluation set | Ang panghuling tapat na grado | **Hindi kailanman** |

Dalawang ideya ang nakatago sa talahanayang iyon:

- Ang **held-out** ay nangangahulugan lamang na "itinabi at inilayo sa training." Ang test set
  ay sadyang held out.
- Ang **dev set** ang matalinong gitnang anak. Hindi ito kailanman *pinag-aaralan* ng modelo, ngunit
  *sinisilip* ninyo kung gaano kahusay ang modelo dito habang nagte-training upang gumawa ng
  mga desisyon — parang practice exam na nagsasabi kung dapat pa kayong mag-aral,
  nang hindi ito ang tunay na exam. Lehitimo ang paggamit sa dev set sa ganitong paraan;
  ang paggamit sa *test* set sa ganitong paraan ay pandaraya (tingnan ang [§4](#4-contamination-and-leakage-the-mistake-that-eats-results)).

### Sealed sets at re-splits

- Ang **sealed set** ay test set na maaaring i-score nang **eksaktong isang beses**. Sa
  sandaling makita ninyo ang inyong score dito, ito ay "gastos" na — dahil kapag alam na ninyo
  ang numero, ang bawat susunod na desisyon ninyo ay banayad nang naiimpluwensiyahan nito. Ang sealed
  sets ang paraan ng mga kompetisyon at komunidad upang panatilihing tunay na panghuli ang final grade.
- Ang **re-split** ay kapag binuo ninyong muli mula sa simula ang paghahati ng train/dev/test —
  karaniwan dahil natuklasan ninyong contaminated ang lumang split. Hindi ninyo
  maaayos ang leaky split sa pagtanggal lamang ng ilang row; muling pinapangkat ang lahat at
  hinahati uli ([§4](#4-contamination-and-leakage-the-mistake-that-eats-results) ang nagpapaliwanag kung bakit).

---

## 3. Ano talaga ang ginagawa ng "training": loss, at ang dalawang mukha nito

Ang training ay isang loop. Gumagawa ng prediction ang modelo, nakikita kung gaano ito kamali, at
bahagyang inaayos ang mga internal number nito upang maging mas hindi mali sa susunod — milyon-milyong
ulit.

Ang **loss** ang iisang numerong sumusukat kung "gaano kamali." Mas mababa ay mas mabuti. Ngunit
may *dalawang* loss, at klasikong bitag ang pagkalito sa mga ito:

- **Training loss** — kung gaano kamali ang modelo sa mga pares na aktibo nitong
  pinag-aaralan. Halos lagi itong patuloy na bumababa, dahil sa huli ay maaari lamang
  *isaulo* ng modelo ang training pairs.
- **Dev loss** (validation loss) — kung gaano kamali ang modelo sa itinabing dev
  set na *hindi* nito pinag-aaralan. Ito ang tapat na signal. Kapag tumigil sa
  pagbuti ang dev loss habang patuloy na bumababa ang training loss, tumigil na ang modelo sa
  *pagkatuto ng wika* at nagsimula nang *magsaulo ng training set*.

> **Worked example.** Makalipas ang ilang panahon, nakikita ninyong nasa 0.8 at pababa pa ang training loss,
> ngunit nakapako sa 1.9 ang dev loss at dahan-dahang *tumataas*. Ang puwang na iyon ang senyales: ang modelo
> ay gumagaling sa pagbigkas muli ng training pairs nito at hindi bumubuti — mas lumalala pa nga —
> sa pagsasalin ng anumang bago.

### Ang loss ay proxy. Ang decoding ang tunay na bagay.

Narito ang isang subtlety na halos lahat ay nasasabit. Sinusukat ng loss kung
nagbibigay ang modelo ng mataas na probability sa tamang susunod na salita *kapag ang tamang
sagot ay nasa harap na nito*. **Hindi** ito pareho ng aktuwal na
paggawa ng modelo ng magandang salin nang mag-isa.

- Ang **decoding** (tinatawag ding *generation* o *inference*) ay ang **aktuwal na
  pagsasalin** ng modelo: ibinigay lamang ang source sentence, naglalabas ito ng target sentence
  salita sa salita, nang walang masasandalan.
- Ang **loss** ay murang *proxy* na kinukuwenta habang nagte-training. May kaugnayan ito sa
  quality, ngunit hindi perpekto.

> **Worked example.** May dalawang checkpoint na halos magkapareho ang dev loss, ngunit kapag
> *di-necode* ninyo ang dev sentences at in-score ang aktuwal na translations, malinaw na
> mas matatas ang isa. Hindi nakita ng loss ang pagkakaibang iyon; nakita ito ng decoding. Ito
> ang dahilan kung bakit ang seryosong checkpoint selection ay nagde-decode ng dev set at ini-score ang tunay na
> output, sa halip na magtiwala sa loss lamang.

:::note[Ang "Sinusundan ba ng dev loss ang quality?" ay bukas na tanong, hindi sabi-sabi]
Makakarinig kayo ng kumpiyansang pahayag na "nagsisinungaling ang eval loss." Ituring iyon bilang
**hindi pa napagpapasyahan**, hindi napatunayan — marami sa folklore na iyon ay nagmula sa contaminated
experiments. Ang tapat na posisyon: ang dev loss ay kapaki-pakinabang at murang signal; ang dev
**generation metric** (decode, pagkatapos ay score) ay mas direktang signal. Piliin ang
direktang signal para sa final decisions, at huwag ulitin bilang katotohanan ang "loss lies."
:::

---

## 4. Contamination at leakage: ang pagkakamaling kumakain ng mga resulta

Ang **contamination** (o **leakage**) ay nangangahulugang palihim na napunta ang eval answers sa
training pile. Pagkatapos ay "na-aace ang test" ng modelo sa pamamagitan ng memory, mukhang
maganda ang inyong score, at walang halaga ang resulta. Ito ang pinakakaraniwang paraan
kung paano lumalabas na peke ang low-resource MT results — at ang pinakamahalagang bagay na
ibinababala sa inyo ng buong pahinang ito.

Ang klasikong, palihim na anyo ay **shared-target minimal pair**:

> **Worked example — "Feed him" / "Feed her".** Ang isang language textbook ay nagmamapa ng maraming
> magkakaibang English drills sa **isang** target word. Parehong nagsasalin ang *"Feed him"* at *"Feed
> her"* sa parehong anyo, `asam`. Ang naïve random split ay naglalagay ng
> *"Feed him"* → `asam` sa **training** at *"Feed her"* → `asam` sa
> **test set**. Ang target answer, `asam`, ay nasa dalawang tumpok na ngayon. Naisaulo ng modelo ang
> `asam` mula sa training at "nakukuha ito nang tama" sa test — ngunit wala itong
> natutunan. Sa isang tunay na proyekto, 17 sa 54 na "test" rows ang tumagas sa ganitong paraan,
> at ang mga row na iyon ay nakakuha ng **83** sa quality metric kumpara sa **44** para sa malilinis na
> rows. Kailangang itapon ang bawat finding na nakabatay sa numerong iyon.

May ilang mukha ang leakage, at sinusuri ng maayos na **leak audit** ang lahat ng ito:

- **Exact overlap** — lumilitaw sa magkabilang panig ang parehong source *o* parehong target
  (ang halimbawa sa itaas).
- **Near-duplicate overlap** — hindi magkapareho, ngunit may *muling binigkas* na bersyon ng
  test sentence sa training. Nagbabahagi ng paraphrases ang same-domain documents;
  hindi nahuhuli ng exact matching ang mga ito, kaya sumusukat din ang audits ng word-overlap similarity.
- **Whole-file overlap** — may aksidenteng nag-train sa kopya ng mismong test
  file. (Talagang nangyayari ito: ang isang "training" harvest ay lumabas na *siya palang*
  gold textbook, tugma ang 489 sa 489 lines.)

### Group-disjoint splitting — ang ayos

Hindi ninyo maaayos ang leakage sa pagtanggal ng mga offending row nang paisa-isa; lilitaw lang muli ang pattern.
Ang ayos ay **group-disjoint splitting**: bago mag-split, itali
ang bawat pares na nagbabahagi ng source *o* target sa isang **group**, pagkatapos
ipadala ang bawat *buong group* sa eksaktong isang panig. Ngayon ang `asam` at lahat ng nagbabahagi
nito ay naninirahan nang buo sa train *o* nang buo sa test — hindi kailanman pareho. Pagkatapos ng carve,
**vine-verify ninyo ang zero overlap** at tumatangging magpatuloy kung mayroon pang natitira.

:::tip[Ito ang ginagawa ng "split-guard" para sa inyo]
Kapag pinatakbo ng inyong agent ang splitter, ginagawa nito ang group-disjoint splitting bilang default
at awtomatikong vine-verify ang zero overlap. Hindi ninyo kailangang alalahanin ang "Feed
him / Feed her" trap — pinahihirap ng tool na magawa ito, at kung iikot kayo
sa paligid nito, tatanggi ito na may mensaheng nagpapangalan sa ayos.
:::

---

## 5. Overfitting, early stopping, at ang plateau

Ang **overfitting** ay ang nangyayari kapag patuloy na nag-aaral ang modelo lampas sa punto ng
pagkatuto at nagsisimula nang *magsaulo*. Napakaganda tingnan ng training loss nito; lumalala ang tunay na
translation quality nito. Ang [§3](#3-what-training-actually-does-loss-and-its-two-faces)
loss gap ang paraan upang makita ito.

Ang **early stopping** ang depensa: bantayan ang dev signal, at kapag tumigil ito sa
pagbuti para sa itinakdang bilang ng checks (ang **patience** nito), ihinto ang training at panatilihin
ang pinakamahusay na naunang bersyon — ang pinakamahusay na **checkpoint** (isang naka-save na snapshot ng
modelo sa kalagitnaan ng training). Sabay na pinipigilan ng early stopping ang nasasayang na compute at
overfitting.

Ngunit may tanyag na failure mode ang early stopping kapag nagte-train kayo nang karamihan sa synthetic
data — ang **synthetic→real transfer plateau**:

> **Worked example — ang half-epoch death.** Nagtetrain ang isang modelo sa mix na
> 97.5% synthetic at hinuhusgahan sa *real* dev set na may 42 pangungusap. Sa simula,
> mabilis na gumagaling ang modelo sa synthetic mass, kaya mabilis na bumababa ang dev loss sa real
> sentences, umaabot sa pinakamababa sa bandang step 8,000 — pagkatapos ay dahan-dahang *tumataas*.
> Nakikita ng naïve early stopping ang "tumaas ang dev loss sa 6 checks sunod-sunod" at idinedeklara ang
> tagumpay sa epoch 0.52, isang ikadalawampu ng planadong training. Ngunit hindi pa
> tapos ang modelo; natapos lamang nito ang *madaling* synthetic learning at hindi pa
> nagsisimula ang mabagal na **transfer** tungo sa real-language quality. Itinigil ito sa
> plateau, bago ang payoff.

Ang aral: sa synthetic-heavy mix, ang *maagang* pagbaba-at-pagtaas sa dev loss ay
**inaasahan**, hindi convergence. Kailangang sapat ang talino ng stopping rule upang panatilihin ang
training sa panahon ng plateau — isang floor na hinango mula sa laki ng inyong mix, hindi isang
magic number na dapat ninyong malaman.

:::note[Inilalantad ng tapat na setups ang tunay na bugs]
Hindi nakita ang plateau bug na iyon nang ilang buwan — dahil ang mga naunang run ay
(illegitimately) gumamit ng *test* set bilang dev set, na nagkubli rito. Ang unang
*clean* run ang naglantad nito. Ito ang paulit-ulit na tema: ang paggawa nito nang tapat
ay hindi lang nagpapanatili sa inyong matapat, ginagawa rin nitong nakikita ang tunay na problema.
:::

---

## 6. Pagsukat ng quality: metrics, batteries, registers

Kapag *dinecode* ng modelo ang isang test sentence, paano ninyo is-score ang sagot nito laban
sa reference translation?

### Partial-credit metrics: chrF++ at BLEU

Bihirang eksaktong kapareho ng reference word-for-word ang isang translation, ngunit maaari itong maging
ganap na mahusay. Kaya gumagamit ang MT ng **partial-credit** metrics na nagbibigay-gantimpala sa *overlap*
sa halip na humingi ng exact match:

- Ang **chrF++** ay nag-i-score ng overlap ng **character sequences** (kasama ang ilang word
  sequences) sa pagitan ng output ng modelo at ng reference. Dahil gumagana ito sa
  character level, nagbibigay ito ng partial credit kapag *halos* tama ang isang salita —
  ang tamang stem na may maling ending ay nakakakuha pa rin ng puntos. Ginagawa nitong angkop ito sa morphologically rich languages, kung saan ang isang root ay nagkakaroon ng
  maraming anyo. Mas mataas ay mas mabuti; karaniwan itong iniuulat sa 0–100 scale.
- Ang **BLEU** ang mas lumang standard. Nag-i-score ito ng overlap ng **whole-word** chunks
  (n-grams). Malawak pa rin itong iniuulat, ngunit malupit ito sa mga wikang
  maraming inflected forms ang mga salita, dahil ang near-miss sa ending ay binibilang bilang
  full miss.

> **Worked example.** Reference: `awâsisak mêtawêwak`. Model output:
> `awâsisak mêtawêw` (tamang root, maling huling pantig). Nakikita ng BLEU ang ikalawang
> salita bilang simpleng mali. Nakikita ng chrF++ na tumutugma ang karamihan sa characters at
> nagbibigay ng partial credit. Parehong output, napakaibang score — kaya binabago ng
> metric na pipiliin ninyo ang kuwento.

:::tip[Ang aling metric ang paniniwalaan ay tanong na sinusukat]
Hindi lahat ng metric ay pantay na sumusunod sa human judgment para sa bawat wika. Para sa ilang
family, halos hindi nagko-correlate ang BLEU sa iniisip ng mga tao; para sa iba, ang fancy
neural metric ang hindi maaasahan. Bago kayo mag-optimize tungo sa *anumang* metric,
tingnan ang [Metric Reliability](/docs/network/specifications/metric-reliability)
evidence para sa inyong language family — at kung ang tapat na sagot ay "unmeasured,"
sabihin iyon sa halip na basta magtiwala sa isang numero.
:::

### Neural metrics: COMET, MetricX

Higit sa character/word overlap, gumagamit ang **neural metrics** (COMET, COMET-QE, MetricX)
ng trained model upang *humusga* ng translations na mas katulad ng gagawin ng tao. Maaari silang
maging higit na maaasahan — ngunit para lamang sa mga wikang sinanay silang husgahan, na
hindi kasama ang karamihan ng low-resource ones. Direction-dependent din silang tumatakbo:
ang **MetricX** ay **lower-is-better**, kabaligtaran ng chrF++ — isang detalyeng mabuting
malaman bago kayo maghambing ng mga numero.

### Error bars: huwag kailanman magtiwala sa isang numero

Bitag ang iisang score na walang uncertainty. Sa maliliit na test sets, madalas na ingay lamang ang mga pagkakaiba.

> **Worked example.** Ang "The model improved from 16.7 to 18.1 on the oral-story
> set" ay parang progreso — hanggang mapansin ninyong may 37 pangungusap lang ang set. Sa
> ganoon kaliit na data, purong tsamba ang ±3-point swing. Ang tapat na report ay
> `17.4 [15.1, 19.8] 95% CI`: ang numero, kasama ang **confidence interval (CI)**
> — ang saklaw kung saan kapani-paniwalang naroroon ang tunay na value. Kung mabigat ang overlap ng intervals
> ng dalawang modelo, hindi ninyo maaaring sabihing mas mahusay ang isa.

Ang mabuting tooling ay tumatangging mag-print ng score nang walang CI nito, at gumagamit ng
[significance test](/docs/network/specifications/significance) bago magdeklara
ng A-beats-B win.

### Batteries at registers

Ang tunay na wika ay hindi iisang patag na bagay. Ang **register** (o **domain**) ay isang *uri*
ng wika: kaswal na usapan, textbook drill, artikulo sa balita, oral
story, pormal na prosa ng pamahalaan. Maaaring mahusay ang modelo sa isa at mahina sa iba.

Ang **battery** ay evaluation set na sadyang hinati sa ilang registers,
ini-score nang **hiwa-hiwalay**, upang hindi maitago ng iisang average ang kahinaan.

> **Worked example.** Nakakuha ang modelo ng 46 overall — kagalang-galang. Ngunit ipinapakita ng battery
> breakdown ang 58 sa textbook drills at 22 sa oral stories. Itinatago ng average
> ang halos ganap na kabiguan sa natural speech. Tanging ang per-register
> battery ang naglantad nito.

---

## 7. Paggawa ng data kapag hindi sapat ang mayroon kayo

Kapag kakaunti ang real pairs, gumagawa kayo ng synthetic ones. Dalawang teknik ang
nangingibabaw, at parehong nakasalalay sa isang salita: **verification**.

### FSTs at morphological analyzers

Ang **morphological analyzer** ay tool na nakakaalam ng word-grammar ng isang wika:
kung paano nagsasama ang roots sa prefixes at suffixes upang makabuo ng valid words. Marami ang
binuo bilang **FSTs** — *finite-state transducers*, isang tumpak at rule-based na
teknolohiya (hindi neural network) na maaaring tumakbo sa dalawang direksyon:

- **analyze**: ibinigay ang isang salita, hatiin ito sa root + grammatical tags
  (`nipâw` → "sleep, 3rd-person singular").
- **generate**: ibinigay ang root + tags, baybayin ang tamang word form
  (`sleep + 3sg` → `nipâw`).

Para sa polysynthetic language — kung saan ang isang salita ay maaaring magdala ng kailangan ng English
ng buong pangungusap — ginto ang FST: kaya nitong baybayin ang *anumang* valid form ng *anumang*
known root, na siya mismong raw material para sa paggawa ng training data.

### Round-trip verification — ang rule na nagpapagawang mapagkakatiwalaan ang synthetic data

Mapanganib ang paggawa ng data: maaaring tahimik na maglabas ng kalokohan ang generator. Ang
disiplinang pumipigil dito ay ang **round-trip law**: bawat manufactured word
ay dapat makaligtas sa *generate → analyze → parehong analysis na pinagsimulan ninyo*. Kung hilingin ninyo
sa FST na baybayin ang isang form at pagkatapos ay ibalik ang spelling na iyon at hindi ninyo makuha ang
tags, itinatapon ang salita. Walang nabigong round trip ang kailanman pinapapasok
sa training data.

> **Worked example — ang one-character leak.** Isang dictionary ang nagbaybay ng isang tunog
> gamit ang titik na `ý`; ang analyzer ay umaasa sa plain `y`. Dahil walang
> nagkasundo sa dalawang spelling sa boundary, *1,375 verbs* ang tahimik na
> hinusgahang "unknown" at inalis sa generation — sa loob ng ilang linggo, nang hindi nakikita. Ang ayos
> ay **canonicalizer**: isang function na nagno-normalize ng spelling sa iisang
> convention *saanman* nagtatagpo ang dalawang component, kasama ang **funnel audit** na
> nagbibilang kung ilang item ang nakaliligtas sa bawat pipeline stage upang hindi na muling makapagtago ang tahimik na 1,375-item drop.

### Coverage, hindi lang volume

Ang isang milyong manufactured sentences ay parang komprehensibo. Hindi ganoon, kung isang
milyong variation lamang ito ng iilang parehong hugis.

> **Worked example.** Lumabas na ang 1,000,000-pair synthetic corpus ay may
> **walang imperatives** ("Vote!"), **walang wh-questions** ("who/where/when"), **walang
> possession** ("my dog"), at **walang inverse forms** ("she sees *me*" — core
> grammar sa maraming wika). Kayang i-generate ng analyzer ang lahat ng ito; hindi lang kailanman
> hiniling ng templates. Itinago ng volume ang structural hole.

Ang depensa ay **coverage checklist** na kinopya mula sa published grammar:
ang kinakailangang grammatical phenomena, bawat isa ay may citation, upang mag-fail ang build kung zero examples ang isang required
one. At pinipigilan ng **per-kind cap** na mangibabaw ang anumang isang template shape —
sa isang corpus, dalawang shape ang 54% ng data, kaya kalahati ng
"karanasan" ng modelo ay dalawang sentence patterns.

### Backtranslation

Ang **backtranslation** ang isa pang malaking synthetic technique, at matalino ito. Kung
mayroon kayong plain, *untranslated* text sa inyong target language (isang **monolingual**
corpus — mas madaling hanapin kaysa parallel text), maaari kayong:

1. kumuha ng *reverse* model (target → English),
2. i-machine-translate ang inyong monolingual target text *papuntang* English,
3. ipares ang bawat machine-English sentence sa **real** target sentence na
   pinagsimulan ninyo, at
4. i-train ang inyong forward (English → target) model sa mga pares na iyon.

Tunay na wika ang target side; synthetic lamang ang English side —
karaniwang magandang trade-off.

> **Worked example.** Mayroon kayong 50,000 real sentences sa inyong target language
> ngunit 400 parallel pairs lamang. I-backtranslate ang 50,000 sa magaspang na English, at
> nagawa ninyong 50,000 training pairs ang monolingual text na ang *target* side
> ay authentic.

:::danger[I-leak-audit din ang inyong monolingual text]
Mukhang ligtas ang backtranslation dahil "monolingual text lang ito" — ngunit maaaring ang text na iyon
ay *maging* inyong eval data na nakabalatkayo. Sa isang proyekto, nahuli ng leak audit ang
monolingual harvest na eksaktong tumutugma sa gold test set. I-audit ang **bawat**
input laban sa **bawat** eval set, kasama ang synthetic at monolingual — hindi lamang
ang halatang parallel corpus ninyo.
:::

### Pag-tag sa synthetic data

Isang huling practice: **i-tag** ang synthetic sources gamit ang marker (tulad ng `<synth>` o
`<bt>`) at iwanang walang tag ang real (gold) data. Pinapayagan nitong masabi ng modelo ang "practice
material" mula sa "the real thing," kaya inaangkla ng authentic data ang output
style nito; sa translation time hindi ninyo idinaragdag ang tag, at sumasandal ang modelo sa natutunan nito
mula sa gold. (Tingnan ang [Back-Translation cookbook](/docs/network/tutorials/back-translation)
para sa mas malalim na pagtalakay sa technique na ito.)

---

## 8. Paano nag-uugnay ang mga bahagi

Basahin mula itaas pababa, ito ay isang workflow:

1. Magtipon ng **real parallel data** ([§1](#1-the-two-piles-training-data-and-evaluation-data)) — karaniwang sobrang kaunti.
2. **I-split** ito nang group-disjoint sa train / dev / test ([§2](#2-splitting-train-dev-and-test), [§4](#4-contamination-and-leakage-the-mistake-that-eats-results)).
3. **Gumawa** ng synthetic data upang punan ang puwang — round-trip-verified, coverage-checked, leak-audited ([§7](#7-manufacturing-data-when-you-dont-have-enough)).
4. **Mag-train** sa mix, binabantayan ang **dev loss / dev generation** upang maiwasan ang **overfitting** at malampasan ang **plateau** ([§3](#3-what-training-actually-does-loss-and-its-two-faces), [§5](#5-overfitting-early-stopping-and-the-plateau)).
5. **I-decode** ang held-out **test battery** at i-score ito gamit ang **partial-credit metrics + confidence intervals**, per **register** ([§6](#6-measuring-quality-metrics-batteries-registers)).
6. Gawin ang lahat ng ito nang hindi kailanman hinahayaang dumikit ang eval answers sa training ([§4](#4-contamination-and-leakage-the-mistake-that-eats-results)) — ang rule na pinaglilingkuran ng iba pang lima.

Bawat rule dito ay tumutugma sa tunay at nasukat na pagkakamaling ginawa at dinokumento ng isang tunay na proyekto.
Hindi ninyo kailangang isaulo ang mga ito: mina-mechanize ng training suite
ang bawat isa upang ang tapat na landas ang default at ang mga hindi tapat na landas
ay tumanggi na may paliwanag. Iyon ang paksa ng susunod na pahina.

## Pagdidirekta sa inyong agent gamit ang bokabularyong ito

Dahil dadaan kayo sa coding agent, ang praktikal na pakinabang ng pahinang ito
ay kaya na ninyong magbigay — at magsuri — ng mga tagubiling tulad nito:

- *"I-split ang corpus nang group-disjoint at i-verify ang zero overlap bago mag-training."*
- *"Mag-carve ng dev set mula sa training side; huwag kailanman pumili ng checkpoints sa test set."*
- *"I-leak-audit ang bawat input laban sa bawat eval set, kasama ang synthetic at monolingual data."*
- *"I-report ang chrF++ na may 95% confidence intervals, hinati ayon sa register."*
- *"Suriin ang metric reliability para sa language family na ito bago tayo mag-optimize tungo sa anumang score."*

Kung available sa inyong agent ang Champollion MCP server, maaari nitong tawagin ang
`get_training_guardrails` upang kunin ang mga rule na ito — at ang pagkakamaling pinapatay ng bawat isa —
direkta sa context nito bago ito magsulat ng kahit isang command.

**Susunod:** gamitin ito sa
[**So You Want to Train Your Own Model**](/docs/network/tutorials/train-your-own-model),
ang step-by-step walkthrough — o basahin ang
[**Train a Model Honestly**](/docs/network/getting-started/training-honestly)
para sa kung paano ginagawang automatic guardrail ng suite ang bawat konsepto dito.

Kung hindi pa rin po malinaw ang mga terminong tulad ng *tokenizer*, ang panimulang gabay mula sa simula ay ang [Tokenizers](/docs/learn/tokenizers) — basahin po ito nang isang beses at magiging mas madali na po ang lahat ng nasa itaas.
