---
title: "Mga panuntunan sa pagsukat"
slug: /agents/measurement
description: "Kung paano sinusukat ng Champollion ang isang tagasalin, at kung paano ito inuulat ng isang agent: ang pamantayan sa pagmamarka (corpus chrF++ na may 95% bootstrap interval), mga gated score, dev laban sa test, mga prediksiyon, mga halos-kopya, ang dictionary floor, ang panuntunan sa paired verdict at ang 50-pangungusap na floor sa ilalim nito, kung saan ibinabatay ang paggabay ng wishlist, ang mga marka ng tagapagsalita, ang blind na paghahambing ng dalawang modelo, ang hatol ng tagapagsalita, mga hanay na muling ipinapakita (pagkakasundo, random na error, drift), at kung paano magpahayag ng numero."
---

# Mga panuntunan sa pagsukat

Ipinapangako ng mga rail na **malalaman** ng mga tao kung gaano kahusay ang isang modelo sa sarili nilang
mga pangungusap — hindi na ito ay mahusay. Nakasalalay ang pangakong iyon sa ilang panuntunan, na ang karamihan
ay ipinapatupad. Inilalahad ng pahinang ito ang mga iyon nang eksakto, at nagtatapos sa kung paano
magpahayag ng isang numero.

## Ang pamantayan sa pagmamarka (standard/1)

Bawat bagong run ay minamarkahan sa parehong paraan (`arena/mt_eval_harness/scoring.py`):

- **Ang headline:** **chrF++** sa antas ng corpus (sacreBLEU chrF na may word order
  2), mula 0 hanggang 100 — mas mataas ay nangangahulugang mas malapit sa mga sangguniang salin —
  kasama ang **95% bootstrap interval** nito at ang sacreBLEU signature nito. Isinusulat bilang
  `chrF++ 47.5 [45.9, 49.0]`.
- **Kung aling mga segment ang binibilang:** isang panuntunan para sa headline, sa interval nito, at sa bawat
  paghahambing. Ang isang segment na nabigo ang pagsasalin ay ibinibilang bilang walang lamang output —
  hindi kailanman inaalis, hindi kailanman minamarkahan bilang isang placeholder; ang segment na walang sanggunian
  ay hindi isinasama kahit saan.
- **Ang interval:** ang sarili ng headline — percentile bootstrap sa mga segment na
  iyon, 1,000 resample, seed 12345, α 0.05. Kapag mas mababa sa 30 segment, nagbababala ang mga tool
  na maaaring mahina ang coverage ng interval; kapag mas kaunti sa 2, wala nito.
- **Katabi nito, hindi kailanman pinagsasama:** BLEU, spBLEU, TER, at COMET kapag kinalkula
  ito, bawat isa ay may signature o model id nito.
- **Mga pagsusuri, nakahiwalay:** exact match, equivalent match, FST acceptance,
  morphological accuracy, semantic validator, code-switching, hallucination,
  terminology adherence, writing style. Hindi kailanman pumapasok ang mga ito sa headline at hindi
  nagraranggo.
- **Ang "Mas mahusay" ay isang paired significance test** sa chrF++, hindi kailanman dalawang numerong
  inihambing sa tingin lamang.
- **Walang mga label ng kalidad.** Pagsusuri lamang ng tao ang nagpapatunay ng kalidad.

**Hindi na ginagamit:** ang weighted composite score at ang mga label ng quality-tier. Ang
isang standard/1 run card ay naglalaman ng `composite: null` at `quality_tier: null`.
**Paalala.** Huwag kailanman magharap, magkalkula, o sumipi ng composite o tier, kahit mula sa isang
lumang card.

Ang **mga caveat sa marka** ay mga diagnostic na nakasulat sa tabi ng marka, hindi kailanman pagbabago
rito: `source_copy` (kalahati o higit pa sa mga output ay kinokopya ang source),
`length_inflation` at `length_deflation` (mga output na higit sa dalawang beses, o mas mababa sa kalahati,
ng haba ng sanggunian — sa karaniwan, o sa isang sangkapat o higit pa ng mga segment), `near_constant_output` (isang output na inuulit sa maraming
source), at `train_test_near_twin` (mga row ng pagsubok na may kakambal sa pagsasanay —
malubha kapag kalahati o higit pa ang mayroon). **Paalala.** Ipasa ang bawat caveat kasama ng marka,
salita por salita.

## Pagsukat na may gate

Kapag ang isang run ay may gate chain ([mga pamamaraan at gate](/docs/agents/methods#gate-chains)),
**ang sinusukat ay kung ano ang ipinapadala**:

- ang headline chrF++ ang nagmamarka sa gated na output;
- ang ungated na chrF++, kasama ang interval nito, ay nakatabi rito
  (`overall.gates.ungated`);
- ang **refusal rate** — mga segment na tinanggihan ng mga gate ÷ mga segment na hinatulan — ay isang
  sariling numero, na may mga bilang ayon sa gate at ayon sa kung ano ang ipinadala (`shipped_from`:
  pamamaraan, source, fallback, wala);
- ang **fingerprint** ng chain (sha256 ng canonical JSON nito) ay kasama ng
  ulat at ng anumang na-publish na run.

**Kandado.** Walang fallback sa pagsukat: tinatanggihan ng `mt-eval run` at `mt-eval test`
ang isang chain na ang mga gate ay nagpapasa ng mga tinanggihang segment sa isang fallback, bago pa man may
maisalin o magastos.

**Paalala.** Iulat ang gated na marka kasama ang ungated na marka nito at ang refusal rate.
Itinatago ng gated na marka lamang ang mga itinapon ng mga gate.

## Mga set at kung para saan ang bawat isa

| Tungkulin | Ginagamit para sa | Binabasa |
|---|---|---|
| `train` | Pagkatuto | Kailanman ay hindi binibigyan ng iskor bilang resulta |
| `dev` (pagsasanay) | Pagpili ng checkpoint; paghatol sa mga improve round (mula sa 50 pangungusap); ang floor ng diksiyonaryo | Malaya |
| `test` | Mga milestone: pagsubok sa isang modelo, laban sa hula ng mga tao | Ang bawat pagbasa para sa pag-iskor ay nangangailangan ng preregistration (forge); nakatala ang bawat pagbasa |
| `sealed` | Isang pagsubok na walang sinuman sa labas ng mga may-hawak nito ang nakakakita | Isang beses |

**Sa nmt-forge** (ang registry, `.forge/eval-registry.json`; ang ledger):

- **Kandado.** Bawat pagbasa sa isang nakarehistrong set ay isinusulat sa hash-chained
  na ledger kasama ang layunin nito (`score`, `dev-selection`, `audit`, `inspect`).
- **Kandado.** Ang pagmamarka sa isang test set ay nangangailangan ng wastong preregistration para sa
  kasalukuyang nilalaman nito.
- **Kandado.** Ang isang sealed set ay minamarkahan nang isang beses. Tinatanggihan ang pangalawang pagmamarka (`sealed
  set '<name>' has already been spent`); a single `mt-eval` na pagbasa sa sealed
  na file ay gumugugol din dito. Ang `--override-respend '<reason>'` (sa `nmt-forge score`
  at `nmt-forge compare`) ay isinusulat sa ledger. Ang `export` ay tumatangging
  gumugol muli at tinutukoy ang `--no-eval`.
- **Kandado.** Ang bakod ng dev: kailangan ng pagsasanay ng isang nakarehistrong `dev` set; hindi maaaring
  magbahagi ang mga dev row ng eksaktong source o target sa isang test o sealed set; walang training
  row ang maaaring maging dev row.

**Sa mt-eval:**

- **Paalala.** Minamarkahan ng `mt-eval run` at `mt-eval compare` ang isang test o sealed na file
  nang walang anumang preregistration at hindi kailanman tumatanggi batay sa bilang ng pagbasa. Ang `mt-eval run`
  ay nagdaragdag lamang ng linya sa read log ng file (`<file>.reads.jsonl`) kapag lumikha ang forge
  ng isa; walang itinatala ang `compare` at `test`. Huwag kailanman markahan ang test set gamit ang
  mt-eval bago maisulat ang hula ng mga tao.

## Mga hula

```bash
nmt-forge prereg new first-model --eval-set project-test --expect "<their words>" --rationale "<their reason>"
nmt-forge prereg new round-2 --eval-set project-test --predictions predictions.json
nmt-forge prereg template --out predictions.json
```

- `--expect` at `--rationale`: isang malayang-tekstong hula tungkol sa chrF++, sa sariling
  mga salita ng mga tao. Ang hatol nito ay sa mga tao: `nmt-forge prereg verdict
  <id> --prediction <n> --held` (or `--missed`) `--by "<who>"`.
- `--predictions <file>`: isang JSON array; tinutukoy ng bawat hula ang isang `metric` at
  isang `rationale`, at alinman sa isang `direction` (`increase`, `decrease`,
  `no_change`) na may `baseline_score` (at opsyonal na `margin`) — na hinahatulan ng mga
  tool — o malayang-tekstong `expect`.
- **Kandado.** Ang hulang isinulat pagkatapos ng anumang pagbasa para sa pagmamarka ng set (sa pamamagitan ng forge,
  o ng `mt-eval run`) ay tinatanggihan: *"eval set '…' was already read for scoring
  (N time(s): …) before this preregistration"*. Hinahayaan ito ng `--allow-after-reads`
  na makalusot, at sinasabi ito ng bawat ulat, export, at status.
- **Paalala.** Ang hula ay sa mga tao, isinulat bago pa magkaroon ng anumang marka,
  hindi kailanman binabago ang pananalita o pinakikitid ninyo. Walang iminumungkahing numero ang tanong ng mga rail
  (*"No number is suggested here, so the guess stays theirs"*); huwag din kayong mag-alok
  ng isa.

## Mga malapit na kopya

Inihahambing ng `nmt-forge leak-audit` ang bawat pares sa pagsasanay sa bawat nakarehistrong dev,
test, at sealed set:

| Nahanap | Panuntunan | Ang nangyayari |
|---|---|---|
| Parehong file | sha256 | Inaalis |
| Eksaktong kopya | Parehong source o parehong target pagkatapos ng normalisasyon | Inaalis |
| Malapit na kopya | Nag-o-overlap ang mga target word set nang ≥ 0.6 (Jaccard) kung saan naglalaman ang isa sa isa pa, o ≥ 0.9 | Inaalis |
| Kapatid na template | Parehong balangkas ng pangungusap, magkaibang sagot | **Pinapanatili** upang matuto mula rito, at binibilang, upang mabasa ang marka nang mayroon at walang mga test row na iyon |
| Tugma sa source lamang | Parehong prompt, magkaibang sagot | Pinapanatili, iniuulat |

Ang maiikling pangungusap ay inihahambing gamit ang character trigrams; ang napakaikli naman ay sa pamamagitan ng eksaktong
tugma lamang. Ang isang test row ay isang **near-twin** kapag ang isang training row ay kapareho o
nag-o-overlap dito nang ≥ 0.6 sa alinmang panig; kapag kalahati o higit pa sa mga test row ay may
kakambal, ang marka ay halos pagsasaulo, hindi pagsasalin, at ang caveat ay malubha.
Isinusulat ng `--clean-to` ang na-screen na file; inaalis din ng `--drop-test-twins` ang mga
training row na kakambal ng isang test row, para sa markang walang kakambal.

Inilalapat ng unang dev split ng mga rail ang parehong threshold: pinapanatili ng `--near-dupe 0.6` sa
`nmt-forge split` ang mga row na nag-o-overlap ang mga salita nang ≥ 0.6 sa isang panig ng
linya ng dev/training, upang ang unang marka ng dev ay hindi maglaman ng memorya ng malapit na kopya na tatanggihan
ng pagsusuri sa susunod na round. Nililimitahan ng `--max-group` ang isang pangkat ng malapit na kopya sa kalahati ng
laki ng dev dagdag ang isa, upang mahati pa rin ang isang file na isinulat mula sa mga template.

**Paalala.** Sabihin lamang ang "natuklasan ng leak audit ang …" mula sa `true_now` o sa sariling
output ng audit, huwag kailanman sabihin sa sarili ninyo na "malinis ang test set".

## Ang dictionary floor

Isinasalin ng `nmt-forge floor <word lists>` ang dev set nang salita-por-salita gamit ang
diksyunaryo (pinakamahabang parirala muna) at minamarkahan ito gamit ang parehong code gaya ng dev score
ng isang run: chrF++ kasama ang 95% interval nito. Tumatakbo ito sa kompyuter na ito, hindi kailanman binabasa
ang test set, at itinatala lamang ang mga pangalan ng diksyunaryo, mga hash, at bilang ng entry,
kung gaano karaming source word ang naabot ng mga ito, at ang mga marka. Ang isang run ay **tatalo sa
floor** lamang kapag ang mababang dulo ng dev interval nito ay mas mataas kaysa sa mataas na dulo ng
sa floor; nagbababala ang `nmt-forge status` tungkol sa isang run na hindi nakakagawa nito.

## Paghahambing ng dalawang modelo

**Isang improve round** (`nmt-forge compare-runs <in-use> <new>`): ang mga salin ng parehong modelo
sa **parehong mga pangungusap sa dev**, na ipinares nang row por row; isang paired
approximate-randomization test (1,000 trial) at isang 95% bootstrap interval sa
pagkakaiba.

| Hatol | Panuntunan |
|---|---|
| **masyadong kaunti** | mas kaunti sa 50 dev sentence, anuman ang mga marka — mananatili ang ginagamit na modelo, at ang mga blind mark ng tagapagsalita ang magpapasya (sa ibaba) |
| **mas mahusay** | 50 o higit pa, p < 0.05 **at** ang ibabang dulo ng interval ay higit sa 0 — iaalok ang bagong modelo para magamit; gagamitin lamang ito kapag sumang-ayon ang mga tao |
| **mas masahol** | 50 o higit pa, p < 0.05 at ang itaas na dulo ng interval ay mababa sa 0 |
| **walang pagbabago** | anupamang iba — mananatili ang ginagamit na modelo |

**Bakit 50.** Sinukat sa mga output ng ByT5-small ng inimbentong pansubok na wika, 100
random na set ng pagsasanay bawat laki, gamit ang panuntunang ito: sa 23 pangungusap ng dev,
tinawag nitong magkaiba ang dalawang halos magkapantay na modelo (0.7 chrF++ ang pagitan sa 500 pangungusap) nang 9 na beses
sa 100, at tinawag ang tunay na +5.9 chrF++ na pagtaas bilang **better** nang 21 beses lamang sa 100;
sa 50 pangungusap, 4 na beses at 96 na beses sa 100. Ang pinakamaliit na pagkakaibang nakita nang 8
beses sa 10 ay 8.1 puntos ng chrF++ sa 23 pangungusap, 5.8 sa 50, 4.0 sa 100, at
2.8 sa 200. Kaya isinasantabi ng unang paghahati ng rails ang hindi bababa sa 50 pangungusap ng dev
kapag may 200 pares o higit pa — isa sa bawat sampu ng mga na-screen na pares, nang hindi hihigit sa
500; kapag mas kaunti sa 200 pares, sangkapat ng mga ito, na mas mababa sa 50 — at
pinapalaki ng mga review sheet ang set gamit ang mga row ng pagsasanay: isang row sa bawat dalawa habang
ito ay mababa sa 50, isa sa bawat apat hanggang sa umabot ito sa 200.

Sinasabi rin ng bawat hatol ang pinakamaliit na pagkakaiba na mapagkakatiwalaang ipinapakita ng dev set nito
(8 beses sa 10): ang lapad ng interval × (1.96 + 0.84) ÷ (2 × 1.96). Kapag iyon
ay higit sa 3 puntos ng chrF++, ang "no-change" ay limitasyon ng dev set, hindi patunay na walang
nagawa ang round. Pinili rin ng dev set ang checkpoint ng bagong run, na
bahagyang pumapabor sa bagong modelo — **sabihin ito** kapag naghahatid kayo ng hatol.

Dahil sa blind preference ng tagapagsalita para sa mas bagong modelo (sa ibaba),
iniaalok lamang ito ng forge para magamit pagkatapos ng hatol na **too-few** o **no-change** — kailanman
ay hindi pagkatapos ng **worse** — at sumasang-ayon muna ang mga tao (`improve-promote`, mode
`confirm`). Ang blind preference para sa modelong pinalitan ng isang promosyon ay hindi kailanman
nagbabalik dito: ang aksiyon ng ulat ng round ang nagtatanong sa mga tao.

**Alinmang dalawang run** (`mt-eval compare <report> <report> --significance`):
approximate randomization bilang default (`--method paired_bootstrap` para sa
isa pa), 1,000 trial (`--n-bootstrap`), α 0.05, seed 12345, sa mga entry na pinagsasaluhan
ng mga ulat ayon sa id (isang babala kapag mas mababa sa 10). chrF++ muna, pagkatapos ay ang mga pangalawang
sukatan. Bawat pares ng mga run ay sinusubukan; walang pagwawasto para sa maramihang pagsubok,
at sinasabi ito ng output.

## Kung saan nagbabatay ang wishlist

Hinahati-hati ng `nmt-forge analyze` ang dev chrF++ ng isang run ayon sa uri ng pangungusap (na may
hindi bababa sa 5 pangungusap sa dev ng bawat uri). Ang isang uri ay **pinakamahina** — at nagbibigay-bigat sa
wishlist — kapag lamang ang 95% interval sa kung gaano kababa ang marka ng mga pangungusap nito kumpara
sa iba ay ganap na nasa itaas ng zero (Welch's interval sa antas ng pangungusap na chrF++).
Ang mas mababang marka na maaaring nagkataon lamang ay iniuulat bilang gayon (*"… could be chance —
the wishlist does not steer by it"*) at hindi kailanman nagbibigay-bigat sa sheet.

Ang seksyon nitong "Mga salitang hindi pa nito nakita kailanman" ay humihiling ng dalawa o tatlong pangungusap para sa
bawat salita, na bawat isa ay may ibang sinasabi, hindi isa lamang: sa inimbentong wikang pansubok,
ang isang salitang nakita nang isang beses sa pagsasanay ay lumabas nang tama 27–29% ng pagkakataon at
ang isang salitang nakita nang 2–4 na beses ay 63–95%; at sa 3,200 pangungusap sa pagsasanay, ang ByT5-small
na sinanay sa mga pangungusap na pinili para sa pinakamaraming bagong salita ay may 39.4% ng 500 held-out
na pangungusap na tama ang kahulugan, kumpara sa 53.4% para sa pang-araw-araw na mga pangungusap, sa
bahagyang mas maraming oras ng tagapagsalita (humigit-kumulang 57 oras kumpara sa 54).

## Ang mga marka ng tagapagsalita

Sa bawat improve round, minamarkahan ng tagapagsalita ang mga draft ng modelo para sa mga bagong pangungusap
bilang `Y`, `N` o `?`. Ang bahaging tama ay `Y ÷ (Y + N)` (hindi kasama ang `?`, walang marka, mga row ng
pagsasanay at mga row na muling ipinakita), na may 95% Wilson interval. Ang pagtaas sa pagitan ng mga round ay itinuturing na
**pagsulong** lamang kapag ang agwat ng huling round ay ganap na mas mataas kaysa
sa una, may modelo ng round na ginamit sa pagitan — pinili ng mga tao
(mga talaan ng `export` at `choose` ng forge), maging pagkatapos man ng hatol na **mas mahusay**,
batay sa mga blind na marka ng tagapagsalita o sa sarili nilang pagpili; ang hatol na **mas mahusay**
lamang ay hindi binibilang — **at** ang mga blind na pagsusuri ng tagapagsalita sa bawat promosyon
(sa ibaba), na pinagsama-sama sa mga round sa pagitan, ay nagmarka sa mga bagong modelo bilang tama
nang malinaw na mas madalas kaysa sa mga pinalitan ng mga ito (|z| > 1.96).
Ito ang mga pangungusap na hindi pa nakita ng anumang modelo: ang sukat na pinakamahalaga, at ang
dapat pangunahan ([coaching](/docs/agents/coaching)).

**Dalawang modelo, blind.** Ipinagagawa ng `champollion improve sheet` sa pangalawang modelo ang
isang seeded random na kalahati ng mga na-draft na row (`nmt-forge draft-newer`), nang walang marka:
ang pinakabagong sinanay na modelo kapag hindi ito ang kasalukuyang ginagamit — tulad ng pagkatapos ng isang round
na ang hatol ay masyadong kaunti, walang pagbabago o mas masahol — o, sa pagbisita pagkatapos ng isang
promosyon, ang modelong pinalitan ng kasalukuyang ginagamit. Kung aling mga row ang pagmamay-ari ng alin ay itinatago
sa tabi ng sheet sa `improve/round-<k>/sheet-key.json` (`in_use`, `other`,
`relation` `newer` o `replaced`, ang mga training pair ng bawat modelo na `in_use_pairs`
at `other_pairs`, `other_rows`, at `repeat_rows`, sa ibaba).
Pagkatapos ay hiwalay na binibilang ng `champollion improve marks` ang dalawang modelo, kung saan ang mga row na muling
ipinakita ay hindi kasama sa lahat ng ito:

- ang bahaging tama sa itaas — ang sukat ng pag-usad — ay nagbibilang lamang sa mga row ng kasalukuyang ginagamit na modelo;
- bawat draft na minarkahang tama at bawat pagwawasto ay nagiging pares sa pagsasanay, sinuman sa mga modelo ang nag-draft nito;
- sinasabi ng isang two-proportion test (pooled, two-sided sa 5%: |z| > 1.96) kung aling modelo ang minarkahang tama nang mas madalas ng tagapagsalita, kung mayroon man: ang `clear` ay `newer` o `replaced` (ang kabilang modelo), `in-use` o `neither`, na nakatala sa `marks.json` (`blind`) kasama ang parehong bilang (`in_use_right`, `in_use_judged`, `other_right`, `other_judged`, `in_use_share`, `other_share`), `other`, `relation` at parehong bilang ng pares sa pagsasanay; ang paghahambing sa mas bagong modelo ay nagpapanatili rin ng `newer`, `newer_right`, `newer_judged` at `newer_share`. Kapag ang alinmang modelo ay walang row na minarkahang `Y` o `N`, ang `clear` ay `null` at sinasabi ng teksto na *"masyadong kakaunting row ng isang modelo ang nahatulan upang maihambing"*;
- laban sa mas bagong modelo, kung may kahit isang draft ang bawat isa na nahatulan, mapupunta ang mga bilang sa forge (`nmt-forge speaker-verdict`), na nagpapatakbo ng parehong pagsubok at nagtatala ng `clear` (`newer`, `in-use` o `neither`) sa ledger nito (`improve-speaker`). Pagkatapos ng hatol na **too-few** o **no-change** sa run na iyon, dahil sa `clear: newer` ay iniaalok ng forge ang mas bagong modelo para magamit; pagkatapos ay ipinapakita ng `champollion improve marks` ang *"naitala ito ng forge: nag-aalok itong gamitin ang mas bagong modelo (sumasang-ayon muna ang mga tao)"* ([training](/docs/agents/training#the-improve-rounds)).

Itinalaga ang mga row nang sapalaran, sa isang sheet, hinatulan ng iisang tagapagsalita, sa
sariling mga bagong pangungusap ng pamilya — kaya ang isang malinaw na pagkakaiba ay may sinasabi na maaaring
napakaliit ng dev set para maipakita, at ang pagbabago sa kung gaano kaluwag magmarka ang tagapagsalita
ay nakaaapekto sa parehong modelo sa parehong paraan. **Paalala.** Huwag kailanman sabihin sa tagapagsalita kung aling mga row ang nagmula
sa aling modelo bago mabasa ang kanilang mga marka.

**Mga row na muling ipinakita.** Mula sa round 2, ibinabalik ng `champollion improve sheet` ang isang
row para sa bawat 10 bagong pangungusap sa sheet (`REPEAT_EVERY`; rounded down,
at mas kaunti kapag mas kaunti ang kwalipikado): isang draft na minarkahan ng tagapagsalita bilang `Y` o `N` sa isang
naunang sheet, kasama ang naunang draft nito, walang marka, sa isang seeded random na pwesto —
hinding-hindi isang row ng pagsasanay, isang row na pag-uulit mismo, isang naipakita na
nang muli, o isang pangungusap sa sheet na ito. Sinasabi ng unang linya ng sheet, sa itaas ng
header: *"Ang ilang row sa ibaba ay sadyang ibinalik mula sa mga naunang sheet.
Pakimarkahan ang mga ito muli, na parang bago: kung gaano kadalas magtugma ang mga marka ang magsasabi kung hanggang
saan mapagkakatiwalaan ang mga ito."* Hindi nito kailanman sinasabi kung alin; pinapanatili ng `sheet-key.json` ang mga ito bilang
`repeat_rows` (`row`, `from_round`, `from_row`, at `mark`, ang naunang
marka). Tumatagal ang mga ito nang humigit-kumulang 10 segundo bawat row para sa tagapagsalita.

Hinahatulan lamang ng `improve marks` ang bawat isa laban sa sariling naunang marka ng tagapagsalita: ang isang
pag-uulit ay hindi kailanman ibinibilang sa bahagi ng round, hindi na muling magiging training pair,
at hindi kailanman isasama sa blind na paghahambing. Nakakakuha ang `marks.json` ng `repeats`: `shown`,
`judged` (minarkahan bilang `Y` o `N` sa pagkakataong ito; ang `?` o blangko ay ipinapakita, hindi hinahatulan),
`agreed`, `agreement` (nagkatugma ÷ hinatulan), `wrong_to_right`,
`right_to_wrong`, `wrong_before` (mga hinatulang row na dating minarkahan bilang `N`) at
`rounds_apart_wrong_before`. Inilalathala nito ang *"Mga row na muling ipinakita: minarkahan
ng tagapagsalita ang A sa J tulad ng ginawa nila noon (P%) — W dating mali ngayon ay tama, R dating
tama ngayon ay mali. Hindi ibinibilang sa bahagi ng round na ito, at hindi na muling
pagsasanayan."*

Kapag pinagsama-sama sa mga round, kapag 10 o higit pa ang nahatulan na (`MIN_REPEATS`),
dalawang bagay ang binabasa ng ulat ng round mula sa mga ito:

- **Random error** `e`, mula sa mga pagbaligtad sa magkabilang direksyon nang magkatulad. Ang dalawang marka ng
  isang draft ay hindi nagkakatugma nang nagkataon lamang sa 2e(1 − e) ng pagkakataon, kalahati sa bawat direksyon; kapag
  d = 2 × min(`wrong_to_right`, `right_to_wrong`) ÷ `judged`,
  e = (1 − √(1 − 2d)) ÷ 2. Hinihila ng error ang bawat bahagi patungong 50%: ang isang draft na totoong
  tama sa bahaging p ng pagkakataon ay minamarkahang tama sa e + p(1 − 2e) ng pagkakataon, kaya
  sa e = 10% ang "totoong 80% na tama" ay nababasa bilang humigit-kumulang 74%.
- **Drift**: mga pagbaligtad sa isang direksyon nang higit sa pantay. Nagbababala ang ulat na
  maaaring nagiging mas maluwag ang pagmamarka kapag ang mga pagbaligtad na dating-mali-ngayong-tama ay malinaw na
  mas marami kaysa sa kabilang direksyon: 6 na pagbaligtad o higit pa at isang sign test,
  (`wrong_to_right` − flips ÷ 2) ÷ √(flips ÷ 4) > 1.96.

Ang linya ng pagsusuri nito: *"Minarkahan ng tagapagsalita ang A sa J na mga row na muling ipinakita tulad ng ginawa nila
noon (P%): humigit-kumulang E% ng mga marka ang napupunta sa kabilang direksyon nang random, na humihila sa bawat
bahaging minarkahang tama patungong 50% — isinasaalang-alang ito ng proyeksyon."* — at tungkol
sa drift, *"At W na mga draft na dating minarkahang mali ay minarkahan na ngayong tama, laban sa R sa
kabilang direksyon: maaaring nagiging mas maluwag ang pagmamarka, na hindi maipapakita ng pagtaas sa bahagi."* Kapag mas mababa sa 10 ang hinatulan: *"N na mga row na muling ipinakita ang hinatulan sa ngayon — ang
sariling error sa pagmamarka ng tagapagsalita ay tinatantiya mula sa 10."*

**Kung saan patungo ang mga round.** Ang proyeksyon ng ulat ng round ay ginagawa lamang mula sa
tunay na pagsulong (sa itaas) habang ang bahaging tama ay mas mababa sa 80%. Ang mga learning curve
ay tumataas nang halos pantay na mga hakbang sa log-odds sa bawat pagdodoble ng data ng pagsasanay, kaya
binabasa nito ang hakbang mula sa parehong mga blind na pagsusuri pagkatapos ng mga promosyon: ang kabuuan ng
`logit(in_use_share) − logit(other_share)` sa kabuuan ng
`log2(in_use_pairs ÷ other_pairs)` (mga bahaging nilimitahan sa 1–99%), na may 95% na
saklaw mula sa variance ng bawat bahagi, humigit-kumulang 1 ÷ (n·p·(1 − p)) para sa n na mga draft na
hinatulan. Mula sa mga training pair ng ginagamit na modelo, sinasabi nito kung ilan pa ang aabot sa
80% na minarkahang tama — ang tantiya — at ang mga oras ng tagapagsalita sa 70 segundo bawat
pangungusap. Sinasaklaw ng saklaw ang agwat ng hakbang (walang dulo sa itaas lampas sa anim pang
pagdodoble) at, kapag 10 row na muling ipinakita ang nahatulan na, kung saan maaaring pumuwesto ang "totoong tama sa
80%" sa mga marka ng tagapagsalitang ito: e + 0.8(1 − 2e) + 0.2 × K, hindi hihigit sa
97%, kung saan ang K ay ang drift bawat round (mga pagbaligtad lampas sa pantay, sa kung
ilang round ang pagitan ng dalawang marka ng mga row na dating mali) pinarami sa bilang ng mga round
sa pagitan ng una at huling mga marka, na may limitasyon na ±30%. Ang pinakakaunti ay ang mas maliit sa dalawang layunin sa upper bound
ng hakbang, ang pinakamarami ay ang mas malaki sa lower bound nito; ang pinakakaunti na 0 ay binabasa bilang
"wala". Pagkatapos ay idinaragdag ng teksto ang *"Ang sariling pagmamarka ng tagapagsalita: minarkahan nila ang A sa J
na mga row na muling ipinakita tulad ng ginawa nila noon (P%), kaya humigit-kumulang E% ng mga marka ang napupunta sa
kabilang direksyon nang random … ang mga draft na totoong tama sa 80% ay maaaring mamarkahang tama nang humigit-kumulang T%
ng pagkakataon sa kanilang mga marka — isinasama iyon ng saklaw."* (kasama, kapag ang K ay
1% o higit pa sa alinmang direksyon, kung gaano mas madalas o mas madalang na ang mga draft na minsang minarkahang mali
ay namarkahan na ngayong tama); bago iyon, *"(Ang sariling error sa pagmamarka ng tagapagsalita ay hindi pa
isinasaalang-alang: masyadong kaunting mga row na muling ipinakita ang nahatulan na.)"* Dinadala ng `report.json`
ang mga numero bilang `projection_numbers` (`more_sentences`, `range`,
`speaker_hours`).

Sa simulasyon — isang maingay na tagapagsalita, ang sariling dev split ng mga rail at ang mga panuntunang ito sa
hatol, 200 pagsubok bawat senaryo sa dalawang hanay ng mga seed — ang tantiya ay tumama
sa loob ng factor na 2 ng totoong bilang nang 69–78% ng pagkakataon sa 400 bagong
pangungusap bawat round at 53–56% sa 800, at ang totoong bilang ay pumatak sa loob ng
saklaw nang 89–94% at 76–80% ng pagkakataon (kung walang pag-uulit, 91–93% at 51–54%).
Ang paglilipat ng mismong tantiya sa mga marka ng tagapagsalita ay nakatulong sa 800 bawat round at
nakasama sa 400 (sa loob ng factor na 2: 64% at 19%), kaya nananatili ito sa payak na
80%. Sinubukan at inalis ang isang tala na ang modelo ay "maaaring gumagana na":
mali ito nang 2–3 beses sa bawat beses na tama ito. Isang magaspang na hula, tahasang sinabi.

## Ang hindi sinasabi ng mga numero

- Ang marka ay para sa sistema sa set na iyon, hindi para sa alinmang pangungusap: walang
  kumpiyansa bawat pangungusap.
- Sinusukat ng chrF++ ang pagkakatulad sa isang sanggunian. Ang isang mahusay na salin na may ibang
  pananalita ay maaaring makakuha ng mababang marka; ang isang matatas ngunit maling salin ay maaaring makakuha ng medyo mataas na marka.
- Sinasabi ng FST acceptance na umiiral ang mga salita, hindi na tama ang kahulugan ng isang pangungusap.
- Ang mga na-publish na row sa leaderboard ay self-reported bilang default; muling
  minamarkahan ng verifier ang mga isinumiteng output laban sa hash-pinned na corpus (sa loob ng 1.0
  chrF++), at hindi muling nagpapatakbo ng mga pamamaraan.

## Paano mag-ulat ng numero

Bawat numero ay nagdadala ng **yunit nito, kung ano ang sinusukat nito, at ang set kung saan ito
sinukat** — kasama ang laki ng set at ang saklaw kapag mayroon nito.

| Sabihin | Huwag kailanman |
|---|---|
| "chrF++ 24.1 mula sa 100 sa 50 pangungusap sa pagsasanay (dev), saklaw na 20.6–27.6" | "24.1" · "24% tumpak" |
| "minarkahang tama ng tagapagsalita ang 9 sa 24 na bagong draft — 38% (21%–57%)" | "38% katumpakan" |
| "walang masusukat na pagbabago: sa 50 pangungusap ng dev, pagkakaiba lamang na humigit-kumulang 5.8 puntos ang lumilitaw" | "bahagya itong bumuti" |
| "masyadong kakaunting pangungusap sa pagsasanay para masabi pa: mababa sa 50, walang paghahambing ang magpapasya — ang mga blind mark ng tagapagsalita ang magpapasya" | "walang pagbabago" para sa hatol na **too-few** |
| "sa 50 naka-lock na pansubok na pangungusap, nang isang beses, laban sa hulang isinulat ninyo: '…'" (ang kanilang mga salita, na binasa pabalik) | isang pansubok na iskor na walang set o hula |
| "blind, sa mga bagong pangungusap, minarkahang tama ng tagapagsalita ang mas bagong modelo sa 7 sa 12 at ang kasalukuyang ginagamit na modelo sa 5 sa 12 — walang malinaw na pagkakaiba sa 24 na pangungusap" | "mas mahusay ang bagong modelo" mula sa mga marka lamang |
| "chrF++ 31.0 gated (ang inihahatid), 33.5 ungated, 12% ang tinanggihan ng mga gate" | ang gated na iskor lamang |

- Ang saklaw ay kung gaano kasigurado ang mga tool, hindi dalawang resulta.
- Ang dalawang marka sa magkaibang set ay hindi maihahambing. Ang dalawang marka sa parehong set
  ay magkaiba lamang kapag sinabi ng paired test.
- Sipiin ang mga caveat at babala salita por salita.
- Huwag kailanman tawaging mabuti o masama ang isang marka; huwag kailanman magkabit ng salita ng kalidad. Isang matatas
  na tagapagsalita ang nagpapasya kung ano ang angkop na gamitin.

## Magbasa pa

- [Ang espesipikasyon sa pagmamarka](/docs/network/specifications/scoring) at
  [kabuluhan](/docs/network/specifications/significance).
- [Ang run card](/docs/network/specifications/run-card) — kung ano ang itinatala
  ng isang minarkahang run.
- [Pagkamaaasahan ng sukatan](/docs/network/specifications/metric-reliability) —
  kung aling sukatan ang nasuri laban sa mga paghatol ng tao para sa aling mga wika.
- [Ang mga teknikal na limitasyon](/docs/network/honest-limitations).
- [Ang mga guardrail](/docs/guardrails) — ang bersyon ng mga tao.
