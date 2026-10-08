---
sidebar_position: 4
title: "Pag-diagnose ng Training Run"
description: "Pag-troubleshoot na inuuna ang sintomas para sa low-resource MT training — magsimula sa nakikita ninyo, tukuyin ang malamang na sanhi, at hanapin ang forge lever na makalulutas nito."
related:
  - label: "Build MT for Your Language"
    to: /docs/build-mt-for-your-language
    kind: guide
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

Natapos na ang pagsasanay ng inyong modelo. Hindi ang mga numero ang inyong inaasahan. Nagsisimula ang pahinang ito mula sa
**kung ano ang inyong nakikita** at gagabayan kayo patungo sa malamang na dahilan at sa forge tool na
nag-aayos nito. Karamihan sa mga ito ay automated — nagdaragdag ang `nmt-forge export` (at ang score-only
na kalahati nito, ang `nmt-forge evaluate`) ng seksyong **Diagnosis & Recommendations**
na nagtutukoy sa natuklasan at sa lever; ang gabay na ito ang bersyong nasa payak na wika,
kasama ang ilang bagay na maaari lamang *ibabala* ng forge (minarkahang ⚠ **bantayan ito**).

Sabihin sa inyong agent: *"Patakbuhin ang `nmt-forge lint <battery-manifest.json> --json` at kumilos ayon sa
natuklasang may pinakamataas na kalubhaan (severity)."* Pagkatapos ng pag-export, ang battery manifest ay
`export/evaluation/battery-hyps-battery.json`. Pagkatapos ay itugma ang iniuulat nito sa mga
seksyon sa ibaba.

---

## "Mababa ang score ng default na modelo"

Nagsanay kayo gamit ang default na preset na `cpu-tiny` at ang test score ay nasa pagitan
ng 5 at 30 chrF++.

**Ang nangyayari:** iyon talaga ang ginagawa ng preset na ito. Isa itong maliit na transformer
na sinanay mula sa simula sa inyong mga pares lamang, kaya sa 1–2 libong pares natututuhan nito
ang mga parirala at pattern ng pangungusap ng inyong data, hindi ang wika sa pangkalahatan — ang
mataas na dulo ng saklaw na iyon ay lumalabas lamang kapag ang data ay lubos na naka-template. Ang layunin nito ay
gawing totoo ang buong loop (fenced dev, na-audit na data, preregistered na test, isang modelong
matatawag ng CLI), hindi upang maging modelong inyong ipapadala (ship).

**Solusyon:** baguhin ang isang bagay at sukatin ito sa dev set, humigit-kumulang ayon sa laki ng
kapakinabangan:

1. **Mas maraming totoong pares.** Sa laking ito, tinatalo ng data ang bawat setting.
2. **Isang pretrained na panimula.** Ang `nmt-forge init <code> --model cpu-finetune --base
   <hf-id>` ay nagfi-fine-tune ng isang maliit na pretrained na Marian/opus-mt na modelo sa CPU — pumili
   ng isa para sa isang *kaugnay* na pares ng wika, at ihambing ito sa `cpu-tiny` sa dev
   sa halip na ipalagay na mananalo ito. Ang `--model nllb-600m` ang pinakamalakas na panimula
   at nangangailangan ng GPU.
3. **Higit pang data mula sa mayroon kayo** — backtranslation ng monolingual na teksto, o
   beripikadong synthesis kung ang inyong wika ay may analyzer (tingnan ang
   [Kung Nais Ninyong Sanayin ang Sarili Ninyong Modelo](/docs/network/tutorials/train-your-own-model)).

⚠ **bantayan ito:** ang mataas na score mula sa `cpu-tiny` ay dapat munang pagdudahan bago
ipagdiwang — tingnan ang ["Mukhang napakaganda ng score"](#the-score-looks-too-good).

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

**natuklasan ng forge:** `R3-mixed-convention`. **Lever: ORTHOGRAPHY.**

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

1. **Leakage.** `nmt-forge leak-audit <corpus>` — napunta ba ang isang pansubok na pangungusap sa
   pagsasanay? Tinatanggal nito ang mga hilera na ang prompt ay kapareho ng pansubok na prompt (kahit na may
   ibang salin), mga hilera na ang sagot ay kapareho ng pansubok na sagot,
   at mga hilera na naglalaman, piraso ng, o ≥90% na kapareho ng pansubok
   na sagot. Tinatanggihan ng `nmt-forge run` ang mga hilera ng pagsasanay na tumagas sa isang rehistradong
   test o sealed set, kaya pinakamahalaga ito para sa data o pipeline sa labas
   ng forge — o isang test set na hindi ninyo kailanman nirehistro.
2. **Pagpili ng checkpoint.** Napili ba ang checkpoint sa isang **fenced dev set**,
   at hindi sa test set? Tumanggi ang forge na magsanay nang walang dev set upang maiwasan
   ito, ngunit hindi ito gagawin ng isang mano-manong ginawang pipeline.
3. **Optimismo mula sa near-twins.** `R4-optimism-bound`: kung ang "buong" battery score
   ay mas mataas nang ilang puntos kaysa sa "mahigpit" (strict) na score, ang agwat ay optimismo
   mula sa drill-sibling. Sadyang *pinapanatili* ng `leak-audit` ang mga template sibling (*"I see the
   dog"* sa pagsasanay, *"I see the cat"* sa test set) at inililista ang mga pansubok na hilera
   na mayroon nito; kapag ang `eval.near_dupe_corpus` ay nakatakda sa inyong training file (ginagawa ito ng
   starter config), hiwalay na minamarkahan ng ulat ang mga pansubok na hilera na *walang*
   sibling, na minarkahang "(strict)". **Banggitin ang strict na bilang** para sa anumang
   pag-angkin ng heneralisasyon. Kung ang *bawat* pansubok na hilera ay may sibling (`R4-recall-not-translation`:
   walang laman ang strict subset, kaya sinusukat ng score ang recall ng mga parirala sa
   pagsasanay), at permanente na ang test set, magsulat ng twin-free na corpus sa sarili nitong
   file gamit ang `nmt-forge leak-audit <train> --clean-to <train>.notwins.jsonl
   --drop-test-twins` at magsanay ng pangalawang modelong twin-free dito (hindi
   papatungan ng leak-audit ang file kung saan nagsasanay ang unang modelo) — o kumuha ng mga pansubok
   na pangungusap na isinulat nang hiwalay mula sa mga template ng pagsasanay.
4. **Hindi sumusunod ang mga output sa mga input.** `R9-harness-score-caveat`: sinasabi
   ng ulat ng mt-eval na kwalipikado ang score — kadalasan ay isang **halos palagiang
   output (near-constant output)**: maraming magkakaibang pansubok na pangungusap ang nakakuha ng iilang magkakaparehong output (isang
   modelo sa ospital ang sumagot sa 150 magkakaibang pangungusap gamit ang 9 na output; nakakuha pa rin
   ito ng chrF++ 48, dahil ang karaniwang parirala ay nagbabahagi ng maraming character sa
   maraming sanggunian). Ang twin-free na modelo ang karaniwang pinaghihinalaan: kapag inalis ang mga template
   ng pagsasanay nito, maaaring bumalik ang isang maliit na modelo sa mga pinakamadalas nitong
   pangungusap. Ipinapasa ng forge ang babala ayon sa mismong mga salita ng harness —
   sa buod ng export, `DEPLOY.md`, `status`, `report`, `compare` at
   `lint` — at hindi kailanman tinatawag ang naturang score bilang "ang bilang na dapat banggitin" nang wala ito.
   Basahin ang ilan sa mga output (`<export>/evaluation/battery-hyps.jsonl`, sa
   makinang naglalaman ng test set) bago ninyo iulat ang score bilang
   kalidad ng pagsasalin; mas marami at totoong magkakaibang pares sa pagsasanay ang lever.

---

## "Halos agad tumigil ang training"

Natapos ang run pagkatapos ng ilang daang step; halos hindi nakita ng model ang data nito.

**Ano ang nangyayari:** napagkamalan ng early stopping na convergence ang inaasahang synthetic-heavy dev
wobble.

**Gawi ng forge:** ito ay *pinipigilan* bilang default — kinukuha ng `nmt-forge run` ang
isang **floor** sa paghinto mula sa inyong mix at pinipigilan ang mga maagang paghinto sa ibaba nito, habang itinatala ang
dahilan sa mga linyang `[schedule-sanity]`. Ang dalas ng pagsusuri sa dev set ay
kinukuha rin mula sa laki ng run, kaya ang isang maliit na run ay hindi naiiwan nang hindi nasusuri. Kung
makakita kayo ng paghinto na hindi ninyo inaasahan, basahin ang mga linyang iyon; itinatala ng run manifest
ang eksaktong nangyari at kung bakit. (Ang isang run na naabot lamang ang huling nakaplanong hakbang nito
ay iniuulat bilang tapos na, hindi bilang maagang paghinto.)

---

## "Tumanggi ang run bago pa ito tuluyang nagsimula"

**Ang nangyayari:** may gate na nag-trigger — na mas matipid kaysa sa isang run na pumapalya
pagkaraan ng ilang oras. Ang mga karaniwan:

- **Nawawala ang training extra** — `nmt-forge preflight run --config
  config.json` shows `✗ backend-installed` kasama ang solusyon,
  `python3 -m pip install 'nmt-forge[hf]'`.
- **Walang dev set, o mali ito** — tinatanggihan ng dev-fence ang isang run kung ang
  `data.dev` nito ay hindi isang rehistradong set na may tungkuling `dev`. Humati ng isa gamit ang
  `nmt-forge split … --register project`.
- **Leakage** — may training file na nagbabahagi ng mga prompt o sagot sa isang rehistradong
  test o sealed set. Linisin ito gamit ang `nmt-forge leak-audit <file> --clean-to
  <file.clean.jsonl>` at ituro ang config sa nalinis na file.
- **Wall-clock** — sa mga unang minuto, sinusukat ng forge ang bilis ng pagsasanay at
  tinatanggihan ang isang run na tinatayang lalampas sa `model.time_budget_hours`. Sa isang CPU,
  karaniwang nangangahulugan ito na kailangan ng preset ng GPU (`nllb-600m`), o ang mix ay higit na mas malaki
  kaysa sa inyong nilalayon. Tinutukoy ng mensahe ang mga lever: mas maliit na mix, mas maiikling
  sequence, o mas malaking budget kung talagang tanggap ninyo ang paghihintay.

**Solusyon:** patakbuhin ang `nmt-forge preflight run --config config.json` bago ang bawat run;
inililista nito ang bawat gate, ✓/✗, kasama ang solusyon para sa bawat ✗.

---

## "Ang metric na gusto ko ay basta… wala sa report"

Tapat ang report ngunit blangko sa isang axis (COMET, isang FST validity check).

**forge finding:** `R6-referee-unavailable` — pinapangalanan ang lane bilang unavailable
kasama ang dahilan. **Lever: REFEREE.**

**Solusyon:** i-install/i-configure ang tinukoy na referee at mag-score muli. Kapag
idineklara ng language card ang referee, tinutukoy ng mensahe ng forge ang command sa pag-install
(`mt-eval setup --lang <code>`). Tapat pa rin ang mga score na mayroon kayo —
bulag lamang ang mga ito sa isang axis na iyon hanggang sa maging handa ang referee.

---

## "Naglalabas ang model ng `<unk>` o magulong mga character"

Lalo na sa syllabic o extended-Latin script.

**Depende ito sa preset.**

- Ang **`cpu-tiny`** ay natututo ng sarili nitong bokabularyo mula sa inyong mga hilera ng pagsasanay, kaya sakop
  ang bawat character na lumilitaw sa pagsasanay. Ang `<unk>` dito ay nangangahulugang naglalaman ang input
  ng isang character na hindi kailanman lumitaw sa pagsasanay — isang bihirang titik o
  diacritic, o ibang anyong Unicode nito (naka-normalize ang teksto sa NFC, kaya
  pareho ang pagturing sa mga composed at decomposed na accent). Tiyaking gumagamit ng parehong
  ortograpiya ang inyong data sa pagsasanay at test data.
- Ang **`cpu-finetune` at `nllb-600m`** ay gumagamit ng tokenizer ng pretrained na base model.

⚠ **bantayan ito — hindi pa automated (mga pretrained base).** Maaaring hindi
**kinakatawan ng tokenizer ng base model ang inyong target script**. Hindi pa nag-a-audit ang forge
ng saklaw ng tokenizer bago magsanay. Suriin ang tokenizer ng inyong base model laban sa
mga sample ng inyong target script; mas piliin ang isang base na sumasaklaw ang bokabularyo sa script
(maraming low-resource na wika ang sakop ng mga base ng pamilyang NLLB) o palawigin ang
tokenizer bago magsanay.

---

## Kapag tumanggi ang forge at hindi ninyo nauunawaan kung bakit

Palaging sinasabi ng pagtanggi kung **ano** ang nangyari, **bakit** nito sinisira ang mga resulta, at ang
**ayos**. Kung hindi pa rin malinaw:

- `nmt-forge status` — kung nasaan kayo at ang nag-iisang susunod na command.
- `nmt-forge preflight <command>` — bawat gate na tatamaan ng command na iyon, ✓/✗, kasama
  ang solusyon para sa bawat ✗, upang malutas ninyo ang lahat ng ito nang sabay-sabay sa halip na isa-isa
  (para sa `run`, `evaluate` at `export`, idagdag ang `--config config.json`).
- Idagdag ang `--json` sa anumang command kapag binabasa ng isang agent ang resulta: darating
  ang pagtanggi bilang isang JSON object — `{"error": {"type", "guard", "message",
  "why", "fix", …}}` — na may exit code 2.

Ang pagtanggi ay hindi error sa inyong setup — ito ay ang tool na humuhuli ng pagkakamali bago
ito umabot sa inyong mga resulta. Iyon ang buong disenyo.
