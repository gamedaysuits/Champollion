---
sidebar_position: 0
title: "Kaya Nais Ninyong I-train ang Sarili Ninyong Model"
description: "Isang agent-forward at end-to-end na walkthrough sa pagsasanay ng isang low-resource translation model gamit ang nmt-forge — mula python3 -m pip install hanggang sa isang modelong naka-serve sa champollion CLI. Kayo ang magdidirekta sa isang coding agent; awtomatikong sinasalo ng mga guardrail ang mga pagkakamali ng baguhan."
related:
  - label: "Build MT for Your Language"
    to: /docs/build-mt-for-your-language
    kind: guide
    note: "The whole journey: find what exists, measure, build, prove, deploy"
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

Ito ay isang kumpletong gabay sa pagsasanay ng isang modelo ng machine-translation para sa isang wikang may kakaunting datos (low-resource language) — mula sa "Sinasalita ko ang wikang ito at halos walang datos" patungo sa isang modelong maaari ninyong maiulat nang tapat, maihatid sa sarili ninyong app sa pamamagitan ng champollion CLI, at maisumite sa [Network](/docs/network/). Ang pagsasanay ay isang hakbang sa mas mahabang proseso (alamin kung ano ang mayroon, sukatin ang mga opsyon, bumuo ng mas mahusay, patunayan ito, i-deploy ito); ang [Build MT for Your Language](/docs/build-mt-for-your-language) ang pangkalahatang-ideya ng lahat ng ito. Isinulat ito para sa mga baguhan, at ipinagpapalagay nito ang makabagong paraan ng paggawa nito: **kayo ang nagdidirekta sa isang coding agent** (Claude Code, OpenAI Codex, Cursor, OpenCode, Google Antigravity, o katulad nito), at ang agent ang nagpapatakbo ng mga tool.

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

- **Isang coding agent** na may terminal at access sa filesystem. Iyon ang tagapagpatakbo.
- **Ilang totoong isinaling pangungusap** para sa inyong pares ng wika — kahit ilang daang pares na ginawa ng tao ay isa nang mabuting simula. Mga bilingguwal na aklat-aralin, mga archive ng komunidad, mga isinaling pampublikong tala, materyales sa edukasyon. Kalidad bago dami.
- **Opsyonal ngunit makapangyarihan:** monolingual na teksto sa inyong target na wika, isang bilingguwal na diksiyonaryo, isang nailathalang reference grammar, at isang morphological analyzer (FST). **Hindi** ninyo kailangan ang lahat ng ito upang magsimula — eksaktong sasabihin sa inyo ng tool kung alin ang mayroon at kung alin ang nagbubukas ng aling mga kakayahan.
- **Compute:** isang laptop. Ang mga guardrail, paghahati (splitting), synthesis, pag-audit, at pag-score ay tumatakbo lahat sa CPU, gayundin ang pagsasanay sa default na modelo (isang maliit na transformer na sinanay mula sa simula). Mahalaga lamang ang isang GPU kung pipiliin ninyo ang pinakamalaking preset (`nllb-600m`) — tingnan ang [Hakbang 5](#step-5--train).

> 🗣️ **Sabihin sa inyong agent:** *"I-install ang nmt-forge kasama ang training extra nito (`python3 -m pip install 'nmt-forge[hf]'`) at kumpirmahing tumatakbo ang utos na `nmt-forge`. Magsasanay tayo ng modelong pagsasalin mula Ingles → \<your language\>, nang tapat."*

```bash
python3 -m pip install 'nmt-forge[hf]'     # Python 3.11+; brings mt-eval-harness, the scorer
```

Ang extra na `[hf]` ay ang training stack (torch, transformers, accelerate, tokenizers, sentencepiece, peft); ayos lang ang mga wheel na CPU-only. Wala nang iba pang kailangan — walang pag-clone ng repository ng Champollion. Tumatanggap ang bawat utos ng `--json` (isang JSON document sa stdout; ibinabalik ang pagtanggi bilang `{"error": {…, "why", "fix"}}` with exit code 2), and `nmt-forge status` na nagsasaad ng susunod na utos sa anumang punto.

Maaaring tawagin ng inyong agent ang tool na `get_training_guardrails` ng Champollion MCP server (walang mga argumento; opsyonal na `topic`) upang i-load ang buong talaan ng mga panuntunan — ang sampung guardrail at ang pagkakamaling pinipigilan ng bawat isa — sa sarili nitong konteksto bago ito magsulat ng anumang mga utos. Kung nagdidirekta kayo ng isang agent, hilingin dito na gawin muna iyon.

---

## Hakbang 1 — Pumili ng wika at tingnan kung ano talaga ang mayroon

Nagsisimula ang bawat proyekto sa tapat na pagtatanong sa index kung ano ang *mayroon* ang wika.

> 🗣️ **Sabihin sa inyong agent:** *"Patakbuhin ang `nmt-forge discover` para sa
> ISO 639-3 code ng aking target language at ibuod kung anong data ang mayroon at kung ano ang nawawala."*

```bash
nmt-forge discover nav        # Navajo, as an example
```

🛠️ **Ang ginagawa ng tool.** Binabasa nito ang **card** ng Champollion para sa wika — ang nag-iisang pinagmumulan ng katotohanan para sa nalalaman tungkol sa wikang iyon — at iniuulat ang mga script, morphological analyzer, diksiyonaryo, corpus, at eval dataset na nakatala rito, pagkatapos ay inilalagay ang wika sa **hagdan ng asset (asset ladder)**. (Nagmumula ang mga card sa isang direktoryo na inyong tinukoy gamit ang `--cards-dir`, isang lokal na checkout o `node_modules/champollion`, o ang pampublikong index ng card — naka-cache, kaya gumagana ito offline pagkatapos ng unang pagkuha. Kung offline nang walang cache, i-export ang card gamit ang `champollion network card <code> --json` patungo sa isang direktoryo at ipasa ang `--cards-dir`.)

```
THE ASSET LADDER — what this language can do TODAY:
  ✓ rung 1: parallel text → train with every guard (no pack needed)
  ? rung 2: monolingual text → the tagged backtranslation lane
  ? rung 3: dictionary (+ grammar) → a cited template pack is worth building
  ? rung 4: morphological analyzer → round-trip-VERIFIED synthesis
  ? rung 5: LYSS referee → the language's own metric in selection
```

👀 **Paano basahin ang resulta.** Ang mga markang `✓` ay ang mga magagawa ninyo ngayon; ang mga markang `?` ay mga baytang na naghihintay ng asset. Higit sa lahat, **ang kawalan sa isang card ay nangangahulugang *hindi alam*, hindi kailanman "walang anuman ang wikang ito."** Ang isang card na kakaunti ang laman ay isang paanyaya na idagdag ang inyong nalalaman, hindi isang dead end — at kahit ang isang simpleng card ay nagbibigay sa inyo ng buong protektadong loop ng pagsasanay sa baytang 1. Ang isang mayamang card (tulad ng Plains Cree) ay awtomatikong nagkokonekta sa matataas na baytang: dumarating ang mga eval set nito na may markang **NEVER TRAIN ON THIS**, at ang referee na partikular sa wika ay handa nang ikabit. Minamarkahan lamang ang Baytang 5 kapag naka-install dito ang package ng referee na iyon; kung hindi, nakasaad dito ang ✗ *UNAVAILABLE* kasama ang utos sa pag-install — at hindi kailanman nilo-load ang referee para sa lokal lamang o selyadong test set, dahil maaari itong maghanap ng mga salita sa isang panlabas na serbisyo.

Pagkatapos ay mag-scaffold ng proyekto:

> 🗣️ **Sabihin sa inyong agent:** *"Mag-scaffold ng project gamit ang `nmt-forge init` para sa
> language pair na ito at basahin sa akin ang `NEXT_STEPS.md` na ginagawa nito."*

```bash
nmt-forge init nav --dir my-nav-mt --pair eng-nav
cd my-nav-mt                     # run every later command from here
```

🛠️ Lumilikha ito ng isang workspace (isang direktoryong `.forge/` na sinasangguni ng bawat guardrail), isang **starter config**, at isang maikling gabay na `NEXT_STEPS.md` na isinulat para sa *inyo at sa inyong agent* — ang pagkakasunod-sunod ng utos, ang hagdan ng asset para sa inyong wika, at ang mga bagay na hindi maaaring ipagkasundo (non-negotiables). Ito ang mapa para sa lahat ng nasa ibaba. Relatibo ang mga path ng config, kaya patakbuhin ang forge mula sa loob ng direktoryo ng proyekto.

Pinipili rin ng `init` ang **modelo** na inyong sasanayin (`--model`, nakasulat bilang tahasang mga numero sa `config.json`): `cpu-tiny` bilang default, `cpu-finetune --base <hf-id>`, or `nllb-600m`. Ipinapaliwanag ng [Hakbang 5](#step-5--train) ang pagpipilian. Kung wala pang card ang inyong wika, itinatayo pa rin ng `nmt-forge init <code> --no-card --name "<name>"` ang balangkas ng proyekto — ang bawat katotohanan sa card ay itinatala bilang hindi alam, walang inimbento.

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
Kung hindi kayo makapag-synthesize mula sa mga panuntunan ngunit mayroon kayong **monolingual** na teksto sa target na wika, hilingin sa inyong agent na gamitin ang daanan ng **backtranslation**: isinasalin nito sa pamamagitan ng machine translation ang inyong monolingual na teksto *patungong* Ingles gamit ang isang reverse model na inyong ibibigay at ipinapares ang bawat resulta sa **totoong** target na pangungusap. Nananatiling awtentiko ang panig ng target. Ito ay isang tawag sa library ng Python (`nmt_forge.training.backtranslation.backtranslate`), hindi isang subcommand ng CLI: magsusulat ang inyong agent ng isang maikling script para dito at idaragdag ang na-tag na output file sa mga daanang `data.synthetic` ng config. **Ina-audit muna para sa leak ng tawag ang monolingual na teksto** — dahil ang tekstong iyon ay maaaring lihim na *maging* inyong eval data. Tingnan ang [cookbook ng Back-Translation](/docs/network/tutorials/back-translation).
:::

---

## Hakbang 4 — Hatiin nang ligtas ang inyong tunay na data

Ngayon, kunin ang inyong mga **totoong** pares at ibukod ang mga pangungusap na gagamitin ninyo sa paghusga sa lahat. Dito nagtatago ang pinakamapanirang pagkakamali sa MT para sa mga low-resource na wika, at dito pinatutunayan ng guardrail ang kahalagahan nito.

Maaaring `.tsv` ang inyong mga file (source, isang TAB, pagkatapos ay ang salin, isang pares bawat linya; mga komento ang mga linyang nagsisimula sa `# `) o `.jsonl` (`{"source": …, "target": …}` bawat linya).

**Kung mayroon na kayong test set** — sinuri ng guro, sinuri ng nars, pribado — panatilihin itong hiwalay na file, irehistro ito, suriin ang corpus laban dito, at hatiin lamang ang train at dev:

> 🗣️ **Sabihin sa inyong agent:** *"Irehistro ang ating test set, i-leak-audit ang corpus laban dito, pagkatapos ay hatiin ang nalinis na corpus sa train at dev gamit ang `nmt-forge split`, group-disjoint, na may fixed seed."*

```bash
nmt-forge registry add project-test ~/teacher-test.tsv --role test
nmt-forge leak-audit ~/corpus.tsv --clean-to corpus.clean.jsonl
nmt-forge split corpus.clean.jsonl --test 0 --dev 100 --seed 42 \
    --out data/split --register project
```

**Kung wala**, ihiwalay ang test set mula sa corpus sa parehong hakbang:

```bash
nmt-forge split corpus.tsv --test 150 --dev 100 --seed 42 \
    --out data/split --register project
```

🛠️ **Ang ginagawa ng tool — ang split-guard.** Nagsasagawa ito ng **group-disjoint splitting**: bawat pares na may magkaparehong source *o* target ay pinagsasama sa isang grupo, at ang bawat buong grupo ay napupunta nang buo sa isang panig. Pagkatapos ay **bineberipika nito na walang overlap** at tumatangging magpatuloy kung mayroon man:

```
split corpus.clean.jsonl: 1580 rows in 1544 share-groups (largest 4)
  train 1480 · dev 100 · test 0  → data/split/
  verified: 0 shared canonical source/target keys across sides
  registered project-dev (role=dev)
```

Pinapatay nito ang **"Feed him" / "Feed her" leak**: itinutugma ng isang aklat-aralin ang parehong drill sa Ingles sa iisang salita sa target na wika (`asam`); inilalagay ng isang payak na random split ang isang kopya sa train at ang kakambal nito sa test, kaya "pumapasa" ang modelo sa pamamagitan ng memorya. Sa isang totoong proyekto, 17 sa 54 na row ng test ang nag-leak sa ganitong paraan at nakapuntos ng 83 laban sa 44 para sa malilinis na row — at nawalan ng bisa ang bawat natuklasan batay sa numerong iyon. Itinatala ng `--register project` ang dev set (at ang test set, kapag inihiwalay) bilang `project-dev` / `project-test` — ang mga pangalang itinuturo na ng starter config — upang malaman ng bawat susunod na utos na ang mga ito ay *mga eval set na hindi kailanman dapat sanayan*. Kapag nakarehistro na ang isang test set, sinusuri rin agad ng `split` ang mga bagong train at dev file laban dito.

🛠️ **At ang leak-audit.** Sinusuri ng `leak-audit` ang mga row laban sa bawat nakarehistrong eval set at sinasabi, na may mga halimbawa mula sa sarili ninyong corpus, kung ano ang **itatapon** nito — isang row na ang source ay kapareho ng prompt sa test (kahit magkaiba ang salin nito), isang row na ang target ay kapareho ng sagot sa test, at isang row na ang target ay halos kapareho ng sagot sa test (naglalaman ito ng sagot, isang bahagi nito, o hindi bababa sa 90% na kapareho kahit may pagkakaiba sa mga accent) — at kung ano ang **sinasadya nitong panatilihin**: mga *template sibling* na may parehong balangkas ng pangungusap ngunit may ibang salita (*"I see the dog"* / *"I see the cat"*), at mga prompt na halos kapareho na may ibang sagot. Nakalista ang mga test row na may template sibling sa training, at — dahil itinatakda ng starter config ang `eval.near_dupe_corpus` sa inyong training file — hiwalay na ini-score ng huling ulat ang mga test row na *walang* sibling, bilang isang "(strict)" na marka, upang makita ang optimismo na idinaragdag ng mga sibling. Kapag ang karamihan sa mga test row ay may sibling at naayos na ang test set, inaalis din ng `--clean-to <file> --drop-test-twins` ang mga kakambal na iyon sa training (iniuulat nito ang strict subset bago at pagkatapos, at tumatangging alisin ang lahat sa training). Bigyan ito ng sarili nitong file (`corpus.notwins.jsonl`): ito ang corpus ng modelong walang kakambal, katabi ng may buong datos, at tumatanggi ang leak-audit na magsulat sa ibabaw ng isang file na binabasa na ng isang config, pagpapatakbo, o paghahati. Deterministiko ang resulta, at hindi kailanman ipinapakita ang mismong teksto ng test file.

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

Inilalarawan ng isang config file ang buong pagpapatakbo; isinasagawa ito ng isang utos, nang mauulit (reproducibly). Naisulat na ito ng `nmt-forge init`.

> 🗣️ **Sabihin sa inyong agent:** *"Basahin ang `config.json`, idagdag ang ating synthetic lane kung gumawa tayo, patakbuhin ang `nmt-forge preflight run --config config.json`, ayusin ang anumang itinatala nito, pagkatapos ay patakbuhin ang `nmt-forge run config.json` at bantayan ang mga diagnostic ng iskedyul."*

Isang sipi ng starter config, kasama ang default na modelong `cpu-tiny` at idinagdag na synthetic lane:

```jsonc
{
  "run_name": "nav-baseline",
  "workspace": ".forge",
  "data": {
    "gold": ["data/split/train.jsonl"],
    "synthetic": [{"path": "data/synth.jsonl", "tag": "<synth>"}],
    "dev": "project-dev"              // registry name, role=dev — the fence
  },
  "mix": {"gold_upweight": 20, "kind_cap": 0.15, "seed": 42},
  "regime": "auto",
  "model": {"backend": "hf-scratch", "device": "cpu", "d_model": 256,
            "layers": 3, "epochs": 60, ...},   // no time_budget_hours: init writes none
  "selection": {"metric": "generation:chrf++", "top_k": 3},
  "decode": {"max_new_tokens": 384, "headroom_factor": 1.5},
  "eval": {"battery": "project-test", "metrics": ["chrf++"],
           "near_dupe_corpus": "data/split/train.jsonl"}
}
```

**Aling modelo?** Piliin ito kapag pinatakbo ninyo ang `init` (`--model`); bawat numero ay napupunta sa `config.json`:

| preset | kung ano ito | mga kailangan | tapat na inaasahan |
|---|---|---|---|
| `cpu-tiny` (default) | isang maliit na transformer (~6M parameters) na sinanay mula sa simula; ang bokabularyo nito ay natutunan mula sa inyong mga row sa **training** lamang | isang laptop CPU, walang pag-download | mahina: sa 1–2 libong pares, ang chrF++ ay humigit-kumulang 5–30 (ang pinakamataas ay para lamang sa data na lubhang naka-template) — mga parirala at pattern ng inyong datos, hindi pangkalahatang pagsasalin |
| `cpu-finetune --base <hf-id>` | nag-fi-fine-tune ng isang maliit na pretrained na modelong Marian/opus-mt na inyong tutukuyin — pumili ng isa para sa isang *magkaugnay* na pares ng wika | isang CPU, ~300 MB na pag-download | karaniwang mas mahusay kaysa sa `cpu-tiny` kapag may umiiral na magkaugnay na pares — sukatin ito sa dev, huwag ipagpalagay |
| `nllb-600m` | NLLB-200 distilled 600M na may LoRA | isang GPU, ~2.5 GB na pag-download | ang pinakamalakas na simula; sa isang CPU, tatanggihan ito ng pagsusuri ng wall-clock sa loob ng ilang minuto |

Ang layunin ng `cpu-tiny` ay hindi ang marka nito. Ginagawa nitong totoo ang **buong** loop — ang bakod, ang mga audit, ang preregistered na test, isang modelong matatawag ng CLI — upang ang isang mas mahusay na modelo sa kalaunan ay maipasok sa parehong proyekto at masukat sa parehong paraan.

Inililista ng `preflight` ang bawat gate na dadaanan ng pagpapatakbo, ✓ o ✗, kasama ang solusyon para sa bawat ✗ — kabilang kung naka-install ang training extra (`✗ backend-installed: … fix: python3 -m pip install 'nmt-forge[hf]'`).

```bash
nmt-forge preflight run --config config.json
nmt-forge run config.json
```

🛠️ **Ano ang ginagawa ng tool — apat na guardrail nang sabay.**

- **Leak-audit bago ang pagsasanay.** *Bawat* daanan — gold, synthetic, at anumang na-backtranslate na teksto — ay sinusuri laban sa *bawat* nakarehistrong test at sealed set. Fatal ang pagtagas ng sagot (magkaparehong mga prompt o sagot, halos magkaparehong sagot) at mga tugma sa buong file; pinapanatili at iniuulat ang mga template sibling (inaalis ng `--drop-test-twins` ang mga ito para sa isang nakapirming test set). Walang magsasanay hangga't hindi malinis ang halo.
- **Dev-fence.** Ang pagsasanay ay **tumatangging magsimula nang walang nakarehistrong dev set**, at pipili lamang kailanman ng mga checkpoint sa dev set na iyon — hindi kailanman sa test set. (Sinusuri pa nito ang nilalaman ng mga row ng dev laban sa mga test set, upang mahuli ang pandarayang `cp test.jsonl dev.jsonl`.) Ang pagpili ng checkpoint ay maaaring gumamit ng dev **loss** o isang dev **generation metric** — i-decode ang dev set at i-score ang totoong output, ang mas tapat na signal (ginagamit ng starter config ang chrF++ sa na-decode na dev output).
- **Schedule-sanity.** Kung mabigat sa synthetic ang inyong halo, *hinuha* ng tool ang minimum na hinto (stopping floor) mula sa laki ng inyong halo at pinapanatili ang pagsasanay sa panahon ng **plateau** — ang yugto kung saan natapos ng modelo ang madaling pagkatuto sa synthetic at hindi pa naililipat sa totoong kalidad. Pinipigilan nito ang "half-epoch death," kung saan ang walang pag-iingat na maagang paghinto (early stopping) ay humihinto sa ika-dalawampung bahagi ng plano. Hango rin sa laki ng pagpapatakbo kung gaano kadalas sinusuri ang dev set, upang masuri pa rin ang isang maliit na pagpapatakbo. Ipinapakita ng bawat interbensiyon ang takbo ng dev-loss at ang dahilan, sa malinaw na pananalita.
- **Exposure math + tagged synthetic.** Binibigyan ng mas mataas na timbang (inuulit) ang gold data upang hindi malunod ang kakaunting totoong datos; isinusulat ng manifest ang **epektibong exposure bawat natatanging pangungusap** upang manatiling patas ang isang A/B. Nagdadala ng tag ang mga synthetic source; nananatiling walang tag ang gold upang ito ang magsilbing angkla sa estilo ng output.

Ang pagsasanay ang nag-iisang hakbang na tumatagal. Dapat itong patakbuhin ng inyong agent sa background na may output sa isang log file at bantayan ang mga linyang mahalaga (`refused`, `Error`, `wall-clock`, `RUN EXIT`) sa halip na mag-poll. Isang live panel na nagpapakita ng mga kurba ng loss at may stop button ang magbubukas para sa **inyo** (sa `http://127.0.0.1:8377` kapag bakante ang port na iyon). Sa mga unang minuto, sinusukat ng forge ang bilis ng pagsasanay at nagpi-print ng pagtatantya ng wall-clock, una ay maagang pagtatantya, pagkatapos ay isang steady-state na pagtatantya. Walang itinatakdang time budget ang `init`, dahil ang budget ay inyong numero, hindi isang numerong inimbento ng tool. Basahin ang pagtatantya, magpasya kung gaano katagal ang inyong tatanggapin, at idagdag ang `"time_budget_hours": <hours>` sa `config.json` sa ilalim ng `model`. Mula noon, tatanggihan ng forge ang isang pagpapatakbo na hindi matatapos sa loob nito, upang mabilis na mabigo ang isang maling sukat na pagpapatakbo. Hangga't wala kayong itinatakda, ang safety ceiling lamang ng forge ang nalalapat: pinapahinto nito ang pagpapatakbong aabutin ng ilang araw, at ipinapakita ito ng bawat pagtatantya bilang "walang nakatakdang budget; … ceiling", hindi bilang isang budget na pinili ng sinuman.

👀 **Paano basahin ang resulta.** Nagpi-print ang pagpapatakbo ng isang **ulat ng dev na may mga confidence interval** — walang output na purong marka lamang — at pagkatapos ay ang susunod na utos (naglalarawan lamang ang mga numero sa ibaba):

```
dev report (95% CIs — there is no bare-score rendering):
n=100 · set=project-dev
  chrf++       21.40  [18.95, 23.90] 95% CI

NEXT: nmt-forge export .forge/runs/nav-baseline-…/run-manifest.json --out export/
```

Kung makakita kayo ng mensaheng `schedule-sanity` na nagpapaliwanag na *pinanatili* nito ang training lampas sa
premature stop, gumagana ang plateau guard — mabuti iyon. Nagsusulat din ang run ng
**manifest**: config hash, data file hashes, seeds, at derived schedule, kaya
reproducible ang buong run.

---

## Hakbang 6 — Mag-evaluate nang tapat

Mayroon na kayong model. Bago ninyo ito i-score sa test set, isusulat ninyo kung ano ang
inaasahan ninyo — *muna*.

> 🗣️ **Sabihin sa inyong agent:** *"Magsulat ng preregistration para sa pag-score ng test-set — ang ating hinulaang metric, direksyon, at margin, na may isang linyang dahilan — pagkatapos ay i-export ang pagpapatakbo, na nag-i-score sa test set nang isang beses."*

```bash
# 1. Predict BEFORE you peek — the one format is a JSON array; edit the template
nmt-forge prereg template --out predictions.json
nmt-forge prereg new run1 --eval-set project-test --predictions predictions.json

# 2. Score the test set once against that prediction, and package the model
nmt-forge export .forge/runs/<run>/run-manifest.json --prereg run1 --out export/
```

Tinutukoy ng `--prereg` ang preregistration na humahatol sa modelong ito. Sa isa sa test set, kusa itong mahahanap ng export; sa pangalawang modelo at sarili nitong preregistration sa parehong test set, tumatangging manghula ang export, kaya tukuyin ang bawat isa.

(Maaaring gawin ang preregistration anumang oras bago ang unang marka sa test — hinihiling ito ng `nmt-forge status` bago ang pagsasanay.)

🛠️ **Ano ang ginagawa ng tool — ang mga anti-storytelling guard.**

- **Preregistration.** Ang pag-score sa isang nakarehistrong **test** set ay nangangailangan ng preregistration na isinulat *bago* ang unang pagsilip. Ang file ng mga hula (predictions file) ay isang JSON array: tinutukoy ng bawat hula ang isang metric at isang batayan (rationale), kasama ang alinman sa direksyon laban sa isang baseline (awtomatikong sinusuri ng `nmt-forge prereg check`) o isang malayang tekstong inaasahan na sinusuri ng isang tao. Ang hindi na-edit na template, Markdown, at tuluyan (prose) ay tatanggihan kasama ang format at ang solusyon. Kung walang preregistration, simpleng **tumatanggi** ang pag-score:

  ```
  [preregister] no preregistration for eval set 'project-test' at its current content hash
    why: results looked at without written-down expectations become
         post-hoc stories; ...
    fix: write one FIRST: ... — then score
  ```

  Ito ang proteksyon laban sa pagpapanggap ng mga postdiction ("siyempre bumuti ito sa mga pasalitang kwento") bilang mga prediksiyon. Ang pagsulat ng mga hula na *nabigo* ang nagbibigay ng tiwala sa mga nagtagumpay.
- **Mga confidence interval, palagi.** Ang bawat marka ay inilalabas kasama ang 95% bootstrap CI nito; walang output na walang CI. Ang pagtaas ng `+0.5` na ang mga interval ay nagpapatong (overlap) ay hindi isang panalo.
- **Ang eval-ledger.** Ang bawat pagbasa ng bawat eval set ay naitatala (append-only, tamper-evident). Tanungin ang `nmt-forge ledger show --set project-test` kung gaano na "nagamit" ang isang set. Ang mga **sealed** na set ay one-shot — ini-score nang isang beses, pagkatapos ay isinasara (tumatanggi ang pangalawang `export`; nagpa-package ang `--no-eval` nang hindi muling nag-i-score).

Dine-decode ng `export` ang test set gamit ang checkpoint na pinili ng dev, ini-score ito, at nagdaragdag ng seksyong **Diagnosis & Recommendations** sa payak na pananalita. Isinusulat din nito ang resulta bilang isang **ulat ng mt-eval** (`export/evaluation/`), upang maitabi ng `mt-eval compare` ang inyong modelo sa anumang iba pang pamamaraang sinukat gamit ang harness sa parehong test set, at ipinapakete ang mismong modelo (Hakbang 8) sa `export/model/`, na walang hawak na anumang pangungusap sa test. Naglalaman ang `export/evaluation/` ng inyong mga pangungusap sa test: huwag kailanman kopyahin ito kasama ng modelo, at panatilihin ito kasama ng test set. Ang `nmt-forge evaluate <run-manifest>` ay ang bahaging score-only, kung ayaw ninyo ng package.

👀 **Paano basahin ang resulta.** Basahin ang numero **kasama ang interval nito at bawat rehistro (register)**, tingnan ang "(strict)" na marka kung ang inyong datos sa training ay may kaparehong mga template ng pangungusap sa test set, at suriin **kung aling metric ang paniniwalaan** bago kayo magdiwang. Upang i-score ang output file ng ibang sistema sa parehong nakarehistrong set, na may higit pang mga metric:

```bash
nmt-forge score --eval-set project-test --hyps decoded.txt \
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

> 🗣️ **Sabihin sa inyong agent:** *"Magbago ng isang bagay — magdagdag ng uri ng template / mas maraming na-backtranslate na datos / ibang preset ng modelo — magsanay muli, at magsagawa ng A/B laban sa naunang pagpapatakbo sa dev set, na may significance."*

Nagpi-print na ang bawat pagpapatakbo ng marka nito sa dev na may confidence interval. Para sa isang paired test, i-decode ang dev set sa bawat pagpapatakbo — `nmt-forge evaluate <run-manifest> --config dev-eval.json --out-hyps run1-dev.jsonl`, where `dev-eval.json` ay isang kopya ng inyong config na ang `eval.battery` ay `project-dev` — pagkatapos:

```bash
nmt-forge compare --eval-set project-dev \
    --hyps-a run1-dev.jsonl --hyps-b run2-dev.jsonl --metric chrf++
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

1. **Mas maraming totoong pares** — sa ilang libong pangungusap, ang bawat karagdagang totoong pares ay mas mahalaga kaysa sa anumang setting.
2. **Mas malawak na saklaw (coverage)** sa synthesis — idagdag ang mga nawawalang kababalaghan sa gramatika (grammar phenomena) na tinukoy ng ulat ng saklaw.
3. **Backtranslation** — gawing higit pang mga pares sa pagsasanay ang monolingual na teksto sa target.
4. **Isang mas malakas na panimulang punto** — `cpu-finetune` na may base model para sa isang magkaugnay na pares, o `nllb-600m` sa isang GPU — nasusukat laban sa `cpu-tiny` sa parehong dev set.
5. **Kurikulum (Curriculum)** — mag-pretrain sa synthetic, pagkatapos ay mag-finetune sa mga totoong pares.

---

## Hakbang 8 — Gamitin ito, at dalhin ito sa Network

Ang isang modelong sinanay nang tapat ay isang bagay na magagamit ninyo ngayon, at eksaktong binuo upang tanggapin ng [Champollion Network](/docs/network/).

**Gamitin ito sa sarili ninyo.** Naipakete na ng `export` ang modelo: isang pansariling direktoryo ng modelo, `forge-model.json` (kung ano ito at paano ito sinukat), isang manifest ng plugin ng champollion (`method.json`), at `DEPLOY.md` kasama ang eksaktong mga utos.

> 🗣️ **Sabihin sa inyong agent:** *"I-serve ang na-export na modelo at gamitin ito upang isalin ang mga string ng ating app gamit ang champollion CLI."*

```bash
nmt-forge serve export/model                               # http://127.0.0.1:8378
LOCAL_API_BASE=http://127.0.0.1:8378/v1 champollion sync --method local
```

Sinusuportahan ng `serve` ang kontrata ng **api method** ng champollion (`POST /translate`) at isang **OpenAI-compatible** na `/v1/chat/completions` — ang pangalawa ang ginagamit ng `--method local`; taglay ng `DEPLOY.md` ang snippet ng `champollion.config.json` para sa una. Nakikinig lamang ito sa `127.0.0.1`; ang paglalantad nito sa isang network ay nangangailangan ng token (`--token` o `NMT_FORGE_SERVE_TOKEN`). Nagsasalin ng teksto ang isang modelong NMT at binabalewala ang mga tagubilin, kaya ang mga tone prompt, coaching file, at glosaryo na ipinapadala ng CLI sa mga pamamaraan ng LLM ay walang epekto rito — at kailangan ng output nito ang pagsusuri ng isang matatas na tagapagsalita bago ito makarating sa mga mambabasa.

**Dalhin ito sa Network.**

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

1. **Tuklasin** kung ano ang mayroon ang wika (`discover`, `init`) — ang kawalan ay hindi alam, hindi sero.
2. **Ituro** ang isang analyzer + diksiyonaryo kung mayroon (mga baytang 3–4), na iginagalang ang kanilang mga lisensya.
3. **Mag-synthesize** ng napatunayan, may sipi, at nasuri sa saklaw na datos sa pagsasanay (`synth`) — o **mag-backtranslate** ng monolingual na teksto.
4. **Hatiin** ang totoong datos nang group-disjoint, suriin ito laban sa inyong test set, at irehistro ang mga eval set (`registry add`, `leak-audit`, `split`).
5. **Magsanay** ng isang config — sa isang CPU bilang default — dev-fenced, leak-audited, plateau-aware (`preflight`, `run`).
6. **Mag-evaluate** nang may mga prediksiyon na isinulat muna, mga CI palagi, ang tamang metric (`prereg`, `export`).
7. **Mag-iterate** gamit ang mga A/B na nasubok sa significance (`compare`).
8. **Gamitin** ang modelo sa pamamagitan ng CLI (`serve`) at **isumite** ito sa Network — kung saan ang tapat na gawain ang pinakamahalaga.

Hindi ninyo kailangang isaulo ang sampung paraan kung paano nagkakamali ang low-resource MT results. Ginawa ng
tool na default ang tapat na landas at tinanggihan ang mga shortcut na may
paliwanag. Iyan ang buong ideya: **hinuhuli ng mga guardrail ang amateur mistakes
upang makapagpokus kayo sa wika.**

## Magpatuloy

- [**MT Training sa Simpleng Wika**](/docs/network/context/mt-training-concepts) — bawat termino rito, tinukoy gamit ang halimbawa.
- [**Mag-train ng Model nang Tapat**](/docs/network/getting-started/training-honestly) — ang sampung guardrail sa isang pahina, bawat isa ay may nasukat na backstory.
- [**Fine-Tuned Model**](/docs/network/tutorials/fine-tuned-model) at [**Back-Translation**](/docs/network/tutorials/back-translation) — mas malalim na cookbooks tungkol sa partikular na techniques.
- [**Corpus Creation**](/docs/network/tutorials/corpus-creation) — pagbuo ng tunay na data na pinagbabatayan ng lahat ng iba pa.
