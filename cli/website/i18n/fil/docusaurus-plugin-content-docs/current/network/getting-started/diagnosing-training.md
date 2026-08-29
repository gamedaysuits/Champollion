---
sidebar_position: 4
title: "Pag-diagnose ng Training Run"
description: "Pag-troubleshoot na inuuna ang sintomas para sa low-resource MT training — magsimula sa nakikita ninyo, tukuyin ang malamang na sanhi, at hanapin ang forge lever na makalulutas nito."
related:
  - label: "Train Your First Model (with your agent)"
    to: /docs/network/getting-started/train-your-first-model
    kind: guide
  - label: "Train a Model Honestly"
    to: /docs/network/getting-started/training-honestly
    kind: guide
  - label: "forge Command Reference"
    to: /docs/network/getting-started/forge-command-reference
    kind: reference
---

# Pag-diagnose ng Training Run

Nagsanay ang inyong model. Hindi ang mga numero ang inaasahan ninyo. Nagsisimula ang pahinang ito mula sa
**nakikita ninyo** at gagabayan kayo papunta sa malamang na sanhi at sa forge tool na
mag-aayos nito. Karamihan sa mga ito ay awtomatiko — nagdaragdag ang `nmt-forge evaluate` ng
seksyong **Diagnosis at Mga Rekomendasyon** na pinapangalanan ang finding at ang lever;
ang gabay na ito ang bersyong nasa karaniwang wika, kasama ang ilang bagay na kaya lamang
*i-babala* ng forge (minarkahan bilang ⚠ **bantayan ito**).

Sabihin sa inyong agent: *"Patakbuhin ang `nmt-forge lint <battery-manifest.json> --json` at kumilos batay sa
finding na may pinakamataas na severity."* Pagkatapos ay itugma ang iniulat nito sa mga seksyon
sa ibaba.

---

## "Mahusay sa aking mga halimbawa sa textbook, pero napakasama sa tunay na mga pangungusap"

**Ang nag-iisang pinakakaraniwang patibong sa low-resource.** Napakaganda ng iskor ng inyong synthetic/templated data;
bumibigay naman ang tunay na text.

**Ano ang nangyayari:** isang **transfer plateau**. Sa panahon ng training, ang loss sa inyong
tunay na dev set ay maagang umabot sa pinakamababa at pagkatapos ay umangat habang patuloy na
bumababa ang training loss — pinagkadalubhasaan ng model ang synthetic na *dami*, hindi natututong
magsalin. **Hindi** makakatulong ang mas maraming synthetic data.

**forge finding:** `R7-transfer-plateau` (mula sa schedule
story ng run manifest). **Lever: REAL-DATA.**

**Ayos:** magdagdag ng tunay na text. I-backtranslate ang monolingual target-language data
(`nmt_forge.training.backtranslation`), o kumuha ng tunay na parallel sentences.
Hindi ang dami ng synthetic data ang lever — kundi ang sari-saring *tunay* na data.

⚠ **bantayan ito:** kung ang inyong mix ay ~99% synthetic laban sa maliit na tunay na dev set,
nasa panganib na kayo nito *bago* pa ninyo ito makita sa mga iskor. Wala pang pre-flight
lint para sa pathological na ratio — suriin ang gold/synthetic
counts ng inyong mix manifest.

---

## "Ang isang rehistro ay mas masama kaysa sa iba"

Tingnan ang per-register table. Ang isang rehistro (halimbawa, government o legal) ay
malayong mas mababa kaysa sa iba.

**Dalawang magkaibang sanhi — pinag-iiba ng diagnosis ang mga ito sa pamamagitan ng pagtingin sa *coverage*
at kung *hindi tapos* ang mga output:**

- **Kulang ang model sa mga salita** (`R1-vocabulary-gap`: mababang coverage **at** mataas na
  incomplete rate). **Lever: VOCABULARY.** Palawakin ang lexicon (dictionary /
  attestation harvest), pagkatapos ay patakbuhin ang `nmt-forge` funnel accounting upang kumpirmahing ang mga bagong
  entry ay talagang umaabot sa corpus — dati nang tahimik na nakapagbura ng libu-libong salita ang
  isang one-character orthography mismatch.
- **May mga salita ang model ngunit wala ang mga anyo ng pangungusap** (`R2-structure-gap`:
  OK ang coverage, hindi pa rin tapos). **Lever: STRUCTURE.** Patakbuhin ang coverage map
  laban sa inyong grammar checklist at idagdag ang mga nawawalang konstruksyon
  (imperatives, wh-questions, possession, inverse — anuman ang hindi kailanman
  hiniling ng inyong templates).

---

## "Pinaghahalo ng mga output ang mga baybay sa loob ng pangungusap"

Isinusulat ng model ang parehong tunog sa dalawang paraan, minsan sa iisang pangungusap.

**Ano ang nangyayari:** itinuro ng inyong training targets na mapagpapalit-palit ang
mga convention — naglaman ang corpus ng parehong content sa maraming
ortograpiya.

**forge finding:** `R3-mixed-convention`. **Lever: ORTHOGRAPHY.**

**Ayos:** `convention-lint` ang corpus, i-normalize sa **iisang** canonical convention
sa data boundary, at mag-retrain. Panatilihin ang mixed-convention rate sa inyong battery
upang makita ninyong bumababa ito.

---

## "Tinalo ng model B ang model A — pero kaunti lang"

Inihambing ninyo ang dalawang model at nauuna ang isa nang maliit na bahagi ng isang punto.

**Ano ang nangyayari:** maaaring mas maliit ang pagkakaiba kaysa sa ingay. Sa 80
pangungusap, ang 0.4 chrF++ gap ay parang toss coin.

**forge finding:** `R5-low-power` (mas malapad ang confidence interval kaysa sa
delta). **Lever: MEASUREMENT.**

**Ayos:** huwag kumilos batay sa mga delta na mas maliit kaysa sa CI. Palakihin ang eval set para sa
rehistrong iyon, o gamitin ang `nmt-forge compare` na nag-uulat ng *paired* significance test
sa halip na dalawang overlapping interval. Hindi kailanman nagre-render ang forge ng bare score — palaging naroon ang
interval nang eksakto upang makita ninyo ito.

⚠ **bantayan ito:** ang resulta mula sa **iisang seed** ay walang
variance-across-seeds band. Hindi totoo ang gain na hindi nakaliligtas sa muling pag-seed.
Kung mahalaga ang desisyon, patakbuhin muli gamit ang 2–3 seed.

---

## "Mukhang masyadong maganda ang iskor"

Kahina-hinalang mataas, lalo na nang maaga o sa kaunting data. Pagkatiwalaan ang hinala.

**Suriin, sa pagkakasunod-sunod:**

1. **Leakage.** `nmt-forge leak-audit <corpus>` — napunta ba sa
   training ang sagot sa test? May dahilan kung bakit fatal ang target-side hits.
2. **Checkpoint selection.** Pinili ba ang checkpoint sa isang **fenced dev set**,
   hindi sa test set? Tumanggi ang forge na mag-train nang walang dev set upang
   maiwasan mismo ito, ngunit hindi ganoon ang hand-rolled pipeline.
3. **Optimism mula sa near-twins.** `R4-optimism-bound`: kung ang "full" battery score
   ay ilang puntos na mas mataas kaysa sa "strict" (near-dupe-excluded) score, ang gap ay
   drill-sibling optimism. **I-cite ang strict number** para sa anumang generalization
   claim.

---

## "Halos agad tumigil ang training"

Natapos ang run pagkatapos ng ilang daang step; halos hindi nakita ng model ang data nito.

**Ano ang nangyayari:** napagkamalan ng early stopping na convergence ang inaasahang synthetic-heavy dev
wobble.

**Gawi ng forge:** *pinipigilan* ito bilang default — kumukuha ang `nmt-forge run` ng
stopping **floor** mula sa inyong mix at pinipigil ang early stops sa ibaba nito, habang nila-log ang
dahilan sa mga linyang `[schedule-sanity]`. Kung makakita kayo ng stop na hindi ninyo inaasahan,
basahin ang mga linyang iyon; eksaktong itinatala ng run manifest kung ano ang nangyari at bakit.

---

## "Ang metric na gusto ko ay basta… wala sa report"

Tapat ang report ngunit blangko sa isang axis (COMET, isang FST validity check).

**forge finding:** `R6-referee-unavailable` — pinapangalanan ang lane bilang unavailable
kasama ang dahilan. **Lever: REFEREE.**

**Ayos:** i-install/i-configure ang pinangalanang referee at mag-re-score. Tapat pa rin ang mga iskor na mayroon
kayo — bulag lang ang mga ito sa axis na iyon hanggang naroon na ang referee.

---

## "Naglalabas ang model ng `<unk>` o magulong mga character"

Lalo na sa syllabic o extended-Latin script.

⚠ **bantayan ito — hindi pa awtomatiko.** Maaaring hindi
naipapakita ng **tokenizer** ng base model ang inyong target script. Hindi pa ina-audit ng forge ang tokenizer coverage bago
mag-training (ito ang pangunahing item sa aming gap list). Suriin ang tokenizer ng inyong base model
laban sa mga sample ng inyong target script; mas piliin ang base na sakop ng vocabulary ang
script (maraming low-resource language ang sakop ng NLLB-family bases) o palawakin
ang tokenizer bago mag-training.

---

## Kapag tumanggi ang forge at hindi ninyo nauunawaan kung bakit

Palaging sinasabi ng pagtanggi kung **ano** ang nangyari, **bakit** nito sinisira ang mga resulta, at ang
**ayos**. Kung hindi pa rin malinaw:

- `nmt-forge status` — kung nasaan kayo at ang iisang susunod na command.
- `nmt-forge preflight <command>` — bawat gate na tatamaan ng command na iyon, ✓/✗, kasama
  ang ayos para sa bawat ✗, upang maresolba ninyo ang lahat nang sabay-sabay sa halip na paisa-isa.

Ang pagtanggi ay hindi error sa inyong setup — ito ay ang tool na humuhuli ng pagkakamali bago
ito umabot sa inyong mga resulta. Iyon ang buong disenyo.
