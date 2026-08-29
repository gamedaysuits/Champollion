---
sidebar_position: 0
title: "Kaya Nais Ninyong I-train ang Sarili Ninyong Model"
description: "Isang agent-forward, end-to-end na walkthrough sa pag-train ng low-resource translation model gamit ang nmt-forge — kayo ang gumagabay sa isang coding agent, at awtomatikong nahuhuli ng mga guardrail ang mga pagkakamaling pangbaguhan."
related:
  - label: "MT Training in Plain Language"
    to: /docs/network/context/mt-training-concepts
    kind: doc
    note: "Read this first if any word below is unfamiliar"
  - label: "Train a Model Honestly (nmt-forge)"
    to: /docs/network/getting-started/training-honestly
    kind: guide
    note: "The guardrail catalogue, one page"
  - label: "Submit a Method"
    to: /docs/network/getting-started/submit-a-method
    kind: guide
    note: "Where a finished model goes"
  - label: "Metric Reliability"
    to: /docs/network/specifications/metric-reliability
    kind: spec
    note: "Know which score to trust before you optimize"
  - label: "Statistical Significance Testing"
    to: /docs/network/specifications/significance
    kind: spec
---

# Kaya Ninyong Sanayin ang Sarili Ninyong Model

Ito ay isang kumpletong walkthrough ng pagsasanay ng machine-translation model para sa isang
wikang may kakaunting resource — mula sa "sinasalita ko ang wikang ito at halos walang data"
hanggang sa isang model na maaari ninyong iulat nang tapat at isumite sa [Network](/docs/network/).
Isinulat ito para sa mga bagong dating, at ipinapalagay nito ang makabagong paraan ng paggawa ng gawaing ito:
**pinapatnubayan ninyo ang isang coding agent** (Claude Code, OpenAI Codex, Cursor, OpenCode,
Google Antigravity, o katulad), at ang agent ang nagpapatakbo ng mga tool.

Kaya pare-pareho ang anyo ng bawat hakbang sa ibaba:

- 🗣️ **Sabihin sa inyong agent** — kung ano ang hihingin, sa simpleng wika.
- 🛠️ **Ano ang ginagawa ng tool** — kung ano ang pinapatakbo ng [nmt-forge](/docs/network/getting-started/training-honestly)
  para sa inyo, at ang **guardrail** na humuhuli sa klasikong pagkakamali
  bago pa ito makapinsala.
- 👀 **Paano basahin ang resulta** — kung ano ang mukhang "maayos" at kung ano ang dapat ikabahala.

:::info[Una, ang bokabularyo]
Kung ang mga terminong tulad ng *dev set*, *decoding*, *chrF++*, *leakage*, o *round-trip
verification* ay hindi pa natural sa inyo, basahin muna ang
[**MT Training sa Simpleng Wika**](/docs/network/context/mt-training-concepts)
— tinutukoy nito ang bawat salitang ginagamit dito gamit ang isang worked example. Aasa
ang pahinang ito sa lahat ng iyon.
:::

:::note[Ang katapatan ang feature, hindi ang hadlang]
Sadyang may malinaw na paninindigan ang tool. Ginagawang mekanikal ng mga guardrail nito ang tunay at nasukat na
mga pagkakamaling nagawa ng isang totoong proyekto — kaya ang tapat na landas ang default, at ang
hindi tapat na mga shortcut ay **tatanggi na may mensaheng nagsasabi ng ayos**. Kapag nakakita kayo
ng pagtanggi sa gabay na ito, ginagawa lang ng tool ang trabaho nito. Iyan ang gusto ninyo.
:::

---

## Ano ang kailangan ninyo bago magsimula

- **Isang coding agent** na may access sa terminal at filesystem. Iyon ang driver.
- **Ilang tunay na isinaling pangungusap** para sa inyong language pair — kahit ilang
  daang human-made na pair ay puwede nang panimula. Bilingual textbooks, community
  archives, isinaling public records, educational material. Kalidad kaysa
  dami.
- **Opsyonal ngunit makapangyarihan:** monolingual text sa inyong target language, isang
  bilingual dictionary, isang inilathalang reference grammar, at isang morphological
  analyzer (FST). **Hindi** ninyo kailangang magkaroon ng lahat ng ito para magsimula — sasabihin
  ng tool nang eksakto kung alin ang naroon at kung alin ang nagbubukas ng aling capabilities.
- **Compute:** ang mga guardrail, splitting, synthesis, auditing, at scoring ay tumatakbo
  sa laptop. Tanging ang aktuwal na hakbang ng model-training ang nangangailangan ng GPU (at ang maliit
  na model na may LoRA ay kasya sa katamtamang hardware).

> 🗣️ **Sabihin sa inyong agent:** *"I-install ang nmt-forge mula sa
> `forge/` package ng Champollion monorepo at kumpirmahing tumatakbo ang
> `nmt-forge` command. Magsasanay tayo ng English → \<your language\> translation model, nang tapat."*

Maaaring tawagin ng inyong agent ang `get_training_guardrails` tool ng Champollion MCP server
upang i-load ang buong rulebook — ang sampung guardrail at ang pagkakamaling pinipigilan ng bawat isa —
sa sarili nitong context bago ito magsulat ng anumang command. Kung kayo ang nagpapatakbo ng isang agent,
hilingin muna rito na gawin iyon.

---

## Hakbang 1 — Pumili ng wika at tingnan kung ano talaga ang mayroon

Nagsisimula ang bawat proyekto sa tapat na pagtatanong sa index kung ano ang *mayroon* ang wika.

> 🗣️ **Sabihin sa inyong agent:** *"Patakbuhin ang `nmt-forge discover` para sa
> ISO 639-3 code ng aking target language at ibuod kung anong data ang mayroon at kung ano ang nawawala."*

```bash
nmt-forge discover nav        # Navajo, as an example
```

🛠️ **Ano ang ginagawa ng tool.** Binabasa nito ang **card** ng wika sa Champollion — ang
iisang source of truth para sa kung ano ang alam tungkol sa wikang iyon — at iniuulat ang
scripts, morphological analyzers, dictionaries, corpora, at eval datasets na
nakatala rito, pagkatapos ay inilalagay ang wika sa **asset ladder**:

```
THE ASSET LADDER — what this language can do TODAY:
  ✓ rung 1: parallel text → train with every guard (no pack needed)
  ? rung 2: monolingual text → the tagged backtranslation lane
  ? rung 3: dictionary (+ grammar) → a cited template pack is worth building
  ? rung 4: morphological analyzer → round-trip-VERIFIED synthesis
  ? rung 5: LYSS referee → the language's own metric in selection
```

👀 **Paano basahin ang resulta.** Ang mga markang `✓` ay ang magagawa ninyo ngayon; ang mga markang `?`
ay mga baitang na naghihintay ng asset. Napakahalaga, **ang kawalan sa card ay nangangahulugang
*hindi alam*, hindi kailanman "walang anuman ang wikang ito."** Ang sparse na card ay paanyayang
idagdag ang alam ninyo, hindi dead end — at kahit bare card ay nagbibigay sa inyo ng buong
guarded training loop sa rung 1. Ang rich card (tulad ng Plains Cree) ay awtomatikong nagwi-wire ng upper
rungs: dumarating ang mga eval set nito na naka-flag na **NEVER TRAIN ON THIS**, at
handa nang i-plug in ang language-specific referee nito.

Pagkatapos ay mag-scaffold ng proyekto:

> 🗣️ **Sabihin sa inyong agent:** *"Mag-scaffold ng project gamit ang `nmt-forge init` para sa
> language pair na ito at basahin sa akin ang `NEXT_STEPS.md` na ginagawa nito."*

```bash
nmt-forge init nav --dir my-nav-mt --pair eng-nav
```

🛠️ Lumilikha ito ng workspace (isang `.forge/` directory na kinokonsulta ng bawat guardrail),
isang **starter config**, at isang `NEXT_STEPS.md` brief na isinulat para sa *inyo
at sa inyong agent* — ang pagkakasunod-sunod ng command, ang asset ladder para sa inyong wika, at
ang mga non-negotiable. Ito ang mapa para sa lahat ng nasa ibaba.

---

## Hakbang 2 — Ituro sa analyzer at dictionary (kung mayroon kayo)

Ang hakbang na ito ay tungkol sa **rungs 3–4** ng ladder. Kung walang
analyzer ang inyong wika, lumaktaw sa [Hakbang 4](#step-4--split-your-real-data-safely) — magsasanay kayo
sa tunay (at backtranslated) na data lamang, na ganap na lehitimong landas.

Kung *mayroon* namang analyzer at dictionary, binubuksan nila ang kakayahang
*gumawa* ng verified training data — ang pinakamalaking lever para sa wikang
may kaunting parallel text.

> 🗣️ **Sabihin sa inyong agent:** *"Nakalista sa card ang isang morphological analyzer at isang
> dictionary para sa wikang ito. Kunin ang mga ito alinsunod sa install instructions sa
> card, ituro ang language pack sa kanila gamit ang documented environment
> variables, at kumpirmahing nagra-round-trip ang analyzer sa ilang kilalang salita."*

🛠️ **Ano ang ginagawa ng tool — at isang hangganang hindi nito tatawirin.** Ang mga analyzer (FST)
at dictionary ay **magkahiwalay na tool na kinukuha ng user sa ilalim ng sarili nilang mga lisensya**.
Ang suite ay **hindi kailanman nagbu-bundle o muling namamahagi ng mga ito** — itinuturo nito sa inyo kung saan
sila nagmumula at kung ano ang kanilang lisensya, at kayo ang kumukuha sa kanila. Hindi ito
burukrasya: maraming language resource ang may totoong mga hadlang sa pahintulot at sovereignty,
at iginagalang iyon ng tool ayon sa disenyo.

Ang connective tissue ay isang **language pack**: isang maliit na plugin na inaangkop ang *inyong*
analyzer, dictionary, orthography rules, at grammar-cited sentence templates sa
engine. Ang suite mismo ay **walang** kasamang packs — ang packs ay naninirahan kasama ng kanilang
mga wika (halimbawa, ang Plains Cree pack ay nasa sarili nitong project at
nagpi-plug in sa pamamagitan ng module path).

👀 **Paano basahin ang resulta.** Gusto ninyong **mag-round-trip** ang analyzer: baybayin ang isang
form, ibalik ang spelling bilang input, at makuha ang parehong grammatical tags. Kung hindi, malamang na
kailangan ng rule ng **canonicalizer** ng pack — ang iisang function na nagno-normalize ng spelling saanman
nagkikita ang dalawang component. Mahalaga itong maitama: isang
hindi naayos na character (`ý` vs `y`) ang minsang tahimik na nagtanggal ng 1,375 verbs
mula sa isang generation pipeline sa loob ng ilang linggo. Binibilang ng **funnel audit** ng tool ang
mga survivor sa bawat stage nang eksakto upang hindi makapagtago ang ganitong tahimik na drop.

---

## Hakbang 3 — Mag-synthesize ng training data mula sa grammar rules

Sa pamamagitan ng analyzer + dictionary + pack ng grammar-cited templates, maaari kayong
gumawa ng daan-daang libong verified pairs.

> 🗣️ **Sabihin sa inyong agent:** *"Gumawa ng synthetic training data gamit ang
> `nmt-forge synth` gamit ang aming language pack, pagkatapos ay ipakita sa akin ang coverage report."*

```bash
nmt-forge synth my_pack.module:get_pack --out data/synth.jsonl
```

🛠️ **Ano ang ginagawa ng tool — ang emit law.** Bawat row na umaabot sa output
ay dapat tumupad sa mga rule na hindi maaaring i-opt out ng anumang pack:

- **Round-trip verified** — bawat generated na salita ay pumapasa sa *generate → analyze →
  same analysis*, o itinatapon ang row. Walang unverified form ang kailanman ini-emit.
- **Grammar-cited** — bawat template kind ay nagbabanggit ng inilathalang grammar na
  tinatranscribe nito. Walang uncited templates; tatanggi ang code na i-load ang mga ito.
- **Coverage-checked** — ina-account ang templates laban sa checklist ng
  kinakailangang grammatical phenomena (imperatives, questions, possession, inverse
  forms…). Kung ang isang *required* phenomenon ay may zero examples, mabibigo ang build. Ito
  ang guard laban sa bitag na "isang milyong pangungusap, lahat ay magkakaparehong iilang hugis"
  — volume na nagtatago ng structural holes.
- **Provenance-stamped** — bawat synthetic row ay minamarkahan ng `synthetic: true`.
  Mabigat ang tungkulin ng stamp na iyon: **tatanggi** ang registry na i-register
  ang synthetic rows bilang test set. Tunay na data lamang ang tests.

👀 **Paano basahin ang resulta.** Tingnan ang coverage report para sa **zero-coverage
required items** (isang grammar phenomenon na hindi kailanman nagawa ng inyong templates) at ang
**kind distribution** — kung nangingibabaw ang dalawang template shapes, ire-rebalance sila ng per-kind
cap ng sampler (default 15%) upang walang iisang pattern ang maging kalahati ng
karanasan ng model.

:::tip[Walang analyzer? Gumamit na lang ng backtranslation]
Kung hindi kayo makapag-synthesize mula sa rules ngunit mayroon kayong **monolingual** target-language
text, hilingin sa inyong agent na patakbuhin ang **backtranslation** lane: `nmt-forge
backtranslate` ay nagma-machine-translate ng inyong monolingual text *papunta* sa English at ipina-pair
ang bawat resulta sa **tunay** na target sentence. Nananatiling authentic ang target side.
**Nagle-leak-audit muna ang tool sa monolingual text** — dahil maaaring palihim na
*maging* eval data ninyo ang text na iyon. Tingnan ang
[Back-Translation cookbook](/docs/network/tutorials/back-translation).
:::

---

## Hakbang 4 — Hatiin nang ligtas ang inyong tunay na data

Ngayon ay kunin ang inyong **tunay** na pairs at hatiin sila sa train / dev / test. Dito
nagtatago ang pinakamasamang pagkakamaling sumisira ng resulta sa low-resource MT, at dito
pinatutunayan ng guardrail ang halaga nito.

> 🗣️ **Sabihin sa inyong agent:** *"Hatiin ang real corpus sa test at dev set gamit ang
> `nmt-forge split`, group-disjoint, at i-register ang mga ito. Gumamit ng fixed seed upang
> reproducible ito."*

```bash
nmt-forge split corpus.jsonl --test 150 --dev 42 --seed 42 \
    --out data/split --register textbook
```

🛠️ **Ano ang ginagawa ng tool — ang split-guard.** Gumagawa ito ng **group-disjoint
splitting**: bawat pair na may parehong source *o* target ay itinatali sa iisang group,
at ang bawat buong group ay napupunta nang buo sa isang panig. Pagkatapos ay **vine-verify ang zero
overlap** at tumatangging magpatuloy kung mayroon.

```
{"verified": "0 shared canonical source/target keys across sides", ...}
```

Pinapatay nito ang **"Feed him" / "Feed her" leak**: iminamapa ng textbook ang parehong English
drills sa iisang target word (`asam`); inilalagay ng naïve random split ang isang copy sa train
at ang kambal nito sa test, kaya "pumapasa" ang model sa pamamagitan ng memory. Sa isang totoong project, 17
sa 54 test rows ang nag-leak sa ganitong paraan at nakakuha ng 83 vs 44 para sa malilinis na row — at bawat
finding na nakabatay sa numerong iyon ay walang bisa. Itinatala ng `--register textbook` ang dev at
test sets (bilang `textbook-dev` at `textbook-test`) sa workspace upang alam ng bawat
susunod na command na ang mga ito ay *eval sets na hindi ninyo kailanman dapat pag-train-an*.

👀 **Paano basahin ang resulta.** Gusto ninyong makita ang linyang **verified: 0 shared**.
Kung sa halip ay makakuha kayo ng `SplitLeakageError`, huwag mag-hand-delete ng rows — nire-reshuffle lang niyan
ang problema. Patakbuhin muli ang group-disjoint split; iyon ang ayos, at iyon ang
sinasabi ng error message.

:::danger[Huwag kailanman mag-train sa benchmark]
Kung kukuha kayo ng evaluation dataset mula sa shared registry (`nmt-forge registry
add-harness`), tatatakan ito ng tool at ituturing na off-limits para sa training —
**bawat** registry benchmark ay naka-flag na *do-not-train*. Mag-fine-tune sa anumang
lehitimong maaari ninyo; huwag lang kailanman sa test set. Ito ang
[iisang rule](/docs/network/leaderboard/rules) ng buong Network.
:::

---

## Hakbang 5 — Mag-train

Isang config file ang naglalarawan sa buong run; isang command ang nagpapatakbo nito,
nang reproducible.

> 🗣️ **Sabihin sa inyong agent:** *"Punan ang training config — ituro ang `dev` sa aming
> registered dev set, ilista ang gold at synthetic data lanes, pumili ng maliit na base
> model na may LoRA — pagkatapos ay patakbuhin ang `nmt-forge run` at bantayan ang schedule diagnostics."*

```jsonc
{
  "run_name": "my-first-run",
  "workspace": ".forge",
  "data": {
    "gold": ["data/train.jsonl"],
    "synthetic": [{"path": "data/synth.jsonl", "tag": "<synth>"}],
    "dev": "textbook-dev"            // registry name, role=dev — the fence
  },
  "mix": {"gold_upweight": 20, "kind_cap": 0.15, "seed": 42},
  "model": {"backend": "hf-seq2seq", "base": "facebook/nllb-200-distilled-600M"},
  "selection": {"metric": "generation:chrf++", "patience": 6},
  "decode": {"max_new_tokens": 256, "headroom_factor": 1.5},
  "regime": "auto"
}
```

```bash
nmt-forge run config.json
```

🛠️ **Ano ang ginagawa ng tool — apat na guardrail nang sabay.**

- **Leak-audit bago mag-training.** *Bawat* lane — gold, synthetic, at anumang
  backtranslated text — ay sini-screen laban sa *bawat* registered eval set. Ang exact
  hits, near-duplicate (reworded) hits, at whole-file matches sa test set ay
  fatal. Walang training na magsisimula hangga't hindi malinis ang mix.
- **Dev-fence.** **Tatangging magsimula ang training kung walang registered dev set**, at
  pipili lamang ito ng checkpoints sa dev set na iyon — kailanman ay hindi sa test set.
  (Kino-content-check pa nito ang dev rows laban sa test sets, upang mahuli ang
  `cp test.jsonl dev.jsonl` trick.) Maaaring gumamit ang checkpoint selection ng dev **loss** o
  dev **generation metric** — i-decode ang dev set at i-score ang tunay na output,
  ang mas tapat na signal.
- **Schedule-sanity.** Kung synthetic-heavy ang inyong mix, *diniderive* ng tool ang
  stopping floor mula sa laki ng inyong mix at pinananatili ang training sa buong
  **plateau** — ang phase kung saan tapos na ng model ang madaling synthetic
  learning at hindi pa nalilipat sa tunay na kalidad. Pinipigilan nito ang
  "half-epoch death," kung saan tumitigil ang naïve early stopping sa ikadalawampu ng
  plano. Bawat intervention ay nagpi-print ng dev-loss trajectory at dahilan, sa
  simpleng wika.
- **Exposure math + tagged synthetic.** Inu-upweight (inuulit) ang gold data upang
  hindi malunod ang kakaunting tunay na data; isinusulat ng manifest ang **effective
  exposure per unique sentence** upang manatiling patas ang A/B. May tag ang synthetic sources;
  nananatiling untagged ang gold kaya ito ang angkla ng output style.

👀 **Paano basahin ang resulta.** Nagpi-print ang run ng **dev report na may confidence
intervals** — walang bare-score output:

```
dev report (95% CIs):
n=42 · set=textbook-dev
  chrf++       44.31  [41.20, 47.15] 95% CI
```

Kung makakita kayo ng mensaheng `schedule-sanity` na nagpapaliwanag na *pinanatili* nito ang training lampas sa
premature stop, gumagana ang plateau guard — mabuti iyon. Nagsusulat din ang run ng
**manifest**: config hash, data file hashes, seeds, at derived schedule, kaya
reproducible ang buong run.

---

## Hakbang 6 — Mag-evaluate nang tapat

Mayroon na kayong model. Bago ninyo ito i-score sa test set, isusulat ninyo kung ano ang
inaasahan ninyo — *muna*.

> 🗣️ **Sabihin sa inyong agent:** *"Sumulat ng preregistration para sa test-set scoring —
> ang aming predicted metric, direction, at margin — pagkatapos ay i-decode ang test set at
> i-score ito."*

```bash
# 1. Predict BEFORE you peek
nmt-forge prereg new run1 --eval-set textbook-test --predictions preds.json

# 2. Now score (decode first, then score the actual output)
nmt-forge score --eval-set textbook-test --hyps decoded.txt
```

🛠️ **Ano ang ginagawa ng tool — ang mga anti-storytelling guard.**

- **Preregistration.** Ang pag-score ng registered **test** set ay nangangailangan ng
  preregistration na isinulat *bago* ang unang pagtingin. Kung wala ito, simpleng
  **tatanggi mag-render** ang comparison table:

  ```
  [preregister] no preregistration for eval set 'textbook-test'
    why: results looked at without written-down expectations become
         post-hoc stories
    fix: write one FIRST: nmt-forge prereg new ... — then score
  ```

  Ito ang guard laban sa pagpapanggap na ang postdictions ("siyempre bumuti ito sa
  oral stories") ay predictions. Ang pagsulat ng mga hulang *nabibigo* ang
  nagpapakatiwala sa mga nagtatagumpay.
- **Confidence intervals, palagi.** Bawat score ay nire-render kasama ang 95% bootstrap
  CI nito; walang output na walang CI. Ang `+0.5` bump na nag-o-overlap ang intervals ay hindi
  panalo.
- **Ang eval-ledger.** Bawat pagbasa ng bawat eval set ay naka-log (append-only,
  tamper-evident). Tanungin ang `nmt-forge ledger show --set textbook-test` kung gaano na "nagamit" ang
  isang set. Ang **Sealed** sets ay one-shot — ini-score nang isang beses, pagkatapos ay isinasara.

👀 **Paano basahin ang resulta.** Basahin ang numero **kasama ang interval at per
register** nito, at tingnan **kung aling metric ang paniniwalaan** bago kayo magdiwang:

```bash
nmt-forge score --eval-set textbook-test --hyps decoded.txt \
    --metric chrf++ --metric comet --target-lang nav
```

Ipinapakita ng `nmt-forge discover` ang **measured reliability** ng bawat metric para sa inyong
language family (mula sa WMT meta-evaluations). Para sa ilang family, halos hindi sinusundan ng metric na tulad ng
BLEU ang human judgment habang ang COMET ay sumusunod; para sa maraming low-resource
families, ang tapat na sagot ay *unmeasured* — kung ganoon, native-speaker
judgment, hindi anumang awtomatikong numero, ang tunay na signal. Tingnan ang
[Metric Reliability](/docs/network/specifications/metric-reliability).

:::tip[Sariling referee ng inyong wika]
Kung may LYSS eval standard ang inyong wika (isang linter na nakaaalam, halimbawa, na dalawang
spelling ay nagkakaiba lamang dahil sa documented long-vowel convention), i-plug in ito gamit ang
`--plugin` at magsi-score ito kasabay ng chrF++ — at maaari pa nitong *piliin* ang checkpoints,
kaya ang model na nananalo ay ang mas pinipili ng sariling referee ng wika. Bawat
plugin number ay nakakakuha rin ng confidence interval.
:::

---

## Hakbang 7 — Mag-iterate

Ngayon ay magpapahusay kayo — at bawat pagpapahusay ay sinusukat sa parehong tapat na paraan.

> 🗣️ **Sabihin sa inyong agent:** *"Baguhin ang isang bagay — magdagdag ng template kind / mas maraming
> backtranslated data / ibang base model — mag-retrain, at i-A/B ito laban sa
> nakaraang run sa dev set, na may significance."*

```bash
nmt-forge compare --eval-set textbook-dev \
    --hyps-a run1.txt --hyps-b run2.txt --metric chrf++
```

🛠️ **Ano ang ginagawa ng tool.** Nagpapatakbo ang `compare` ng **paired significance test**, hindi
lang subtraction, kaya ang "tinalo ng B ang A" ay claim na sinusuportahan ng statistics — hindi
ingay. Mag-iterate sa **dev** set (iyan ang gamit nito); panatilihin ang **test** set
para sa madalang at preregistered na checks; itabi ang anumang **sealed** set para sa pinakadulo.

👀 **Paano basahin ang resulta.** Nalalampasan ng tunay na pagpapahusay ang confidence interval nito
*at* ang significance test. Kung hindi, may natutunan pa rin kayo — mas mahina ang
lever na iyon kaysa inaasahan ninyo, na mahalagang malaman. Ibig sabihin ng plateau/coverage/
leak guards na mapagkakatiwalaan ang mga numerong ikinukumpara ninyo, kaya
maaari ninyong paniwalaan ang sarili ninyong iteration loop.

Karaniwang susunod na mga lever, humigit-kumulang ayon sa payoff para sa wikang kapos sa data:

1. **Mas malawak na coverage** sa synthesis — idagdag ang nawawalang grammar phenomena na
   na-flag ng coverage report.
2. **Backtranslation** — gawing mas maraming training pairs ang monolingual target text.
3. **Mas malaki o mas angkop na base model**, o LoRA rank/hyperparameter tuning.
4. **Curriculum** — mag-pretrain sa synthetic, pagkatapos ay mag-finetune sa real pairs.

---

## Hakbang 8 — Dalhin ito sa Network

Ang model na sinanay nang tapat ay eksaktong uri ng tinatanggap ng [Champollion Network](/docs/network/).

> 🗣️ **Sabihin sa inyong agent:** *"I-package ang model na ito bilang method at isumite ito sa
> leaderboard para sa aming language pair."*

- Ginagawang Network entry ng **[Magsumite ng Method](/docs/network/getting-started/submit-a-method)**
  ang inyong model, na isi-score sa public reference corpora at
  ia-attribute sa inyo.
- Dahil malinis ang inyong evaluation — group-disjoint, dev-fenced, leak-audited,
  may CI, preregistered — makaliligtas ang inyong submission sa pagsusuring nagpapabagsak sa karamihan ng
  low-resource MT claims. Ang anti-gaming architecture (secret community-owned
  test sets, reproducibility checks, native-speaker validation) ay hindi
  hadlang sa model na ginawa sa ganitong paraan; ito ay tatak ng credibility.
- Kung bukas ang isang **prize** para sa inyong wika, ang standing, better-than-baseline
  method na tapat ang pagkakagawa ay eksaktong ginagantimpalaan ng sponsored pool. At kapag
  gumagana ang isang method para sa isang Indigenous language, **maaaring ilipat ang ownership sa
  community** — binubuo ninyo ito rito at dine-deploy nila ito, sa kanilang mga tuntunin. Tingnan ang
  [Prize Specification](/docs/network/specifications/prizes) at
  [Ownership Transfer](/docs/network/sovereignty/ownership-transfer).

---

## Ang buong arc, sa isang hininga

1. **Tuklasin** kung ano ang mayroon ang wika (`discover`, `init`) — ang kawalan ay unknown, hindi zero.
2. **Ituro sa** analyzer + dictionary kung mayroon sila (rungs 3–4), na iginagalang ang kanilang mga lisensya.
3. **Mag-synthesize** ng verified, cited, coverage-checked training data (`synth`) — o **mag-backtranslate** ng monolingual text.
4. **Hatiin** ang real data nang group-disjoint at i-register ang eval sets (`split`).
5. **Mag-train** gamit ang isang config, dev-fenced, leak-audited, plateau-aware (`run`).
6. **Mag-evaluate** na naisulat muna ang predictions, laging may CIs, gamit ang tamang metric (`prereg`, `score`).
7. **Mag-iterate** gamit ang significance-tested A/Bs (`compare`).
8. **Magsumite** sa Network — kung saan ang tapat na gawain ang punto.

Hindi ninyo kailangang isaulo ang sampung paraan kung paano nagkakamali ang low-resource MT results. Ginawa ng
tool na default ang tapat na landas at tinanggihan ang mga shortcut na may
paliwanag. Iyan ang buong ideya: **hinuhuli ng mga guardrail ang amateur mistakes
upang makapagpokus kayo sa wika.**

## Magpatuloy

- [**MT Training sa Simpleng Wika**](/docs/network/context/mt-training-concepts) — bawat termino rito, tinukoy gamit ang halimbawa.
- [**Mag-train ng Model nang Tapat**](/docs/network/getting-started/training-honestly) — ang sampung guardrail sa isang pahina, bawat isa ay may nasukat na backstory.
- [**Fine-Tuned Model**](/docs/network/tutorials/fine-tuned-model) at [**Back-Translation**](/docs/network/tutorials/back-translation) — mas malalim na cookbooks tungkol sa partikular na techniques.
- [**Corpus Creation**](/docs/network/tutorials/corpus-creation) — pagbuo ng tunay na data na pinagbabatayan ng lahat ng iba pa.
