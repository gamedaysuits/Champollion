---
sidebar_position: 3
title: "Sanayin ang Inyong Unang Model (gamit ang inyong agent)"
description: "Isang sunod-sunod na gabay para sa pagsasanay ng isang low-resource na MT model sa pamamagitan ng pagdidirekta sa isang coding agent — mag-install, protektahan ang inyong test set, magsanay sa CPU ng laptop, mag-score nang isang beses, at i-serve ang modelo sa champollion CLI. Kung ano ang inyong sasabihin, kung ano ang ginagawa ng forge, at kung ano ang hitsura ng isang pagtanggi."
related:
  - label: "Build MT for Your Language"
    to: /docs/build-mt-for-your-language
    kind: guide
    note: "The whole journey — this page is the forge part of its steps 2 and 4"
  - label: "Train a Model Honestly"
    to: /docs/network/getting-started/training-honestly
    kind: guide
    note: "The why behind every guard in this walkthrough"
  - label: "Diagnosing a Training Run"
    to: /docs/network/getting-started/diagnosing-training
    kind: guide
    note: "Symptom-first: what to do when the numbers disappoint"
  - label: "forge Command Reference"
    to: /docs/network/getting-started/forge-command-reference
    kind: reference
---

# Sanayin ang Inyong Unang Model (kasama ang inyong agent)

Hindi ninyo kailangang malaman kung paano magsanay ng neural machine-translation model. Kailangan
ninyong kayang **sabihin sa coding agent kung ano ang gusto ninyo** — Claude, o isang
Sonnet/Flash-class model, o anumang agent na kayang magpatakbo ng shell commands. Ang **nmt-forge**
ay binuo upang mapatakbo ito ng agent nang *mekanikal*: sa bawat hakbang, eksaktong sinasabi ng tool
sa agent kung ano ang susunod na gagawin, at tumatanggi — nang malinaw, kasama ang ayos — kapag ang isang
hakbang ay makasisira sa inyong mga resulta.

Ang pahinang ito ang kabuuang loop, mula sa `pip install` hanggang sa isang modelong matatawag ng champollion CLI. Bawat hakbang ay isinulat bilang **kung ano ang sasabihin ninyo sa inyong agent**, **kung ano ang ginagawa ng forge**, **kung ano ang hitsura ng pagtanggi (refusal)** (upang walang mag-panic sa inyo kapag may lumitaw — ang pagtanggi ay palatandaan na gumagana ang tool), at, sa dulo, **kung paano babasahin ang ulat**. Ito ang bahaging forge ng mga hakbang 2 at 4 ng [Bumuo ng MT para sa Inyong Wika](/docs/build-mt-for-your-language), na sumasaklaw sa mga nauna (paghahanap sa kung anong umiiral), sa pagitan (pagsukat sa mga umiiral na opsyon), at pagkatapos (pag-publish, pagsasama-sama ng mga pamamaraan).

**Mahalaga ang pagkakasunod-sunod.** Irehistro ang inyong test set, suriin ang inyong training data laban dito, at isulat ang inyong mga hula (Mga Hakbang 1–3) **bago mamarkahan ang anuman sa test set** — kabilang ang mga baseline na sinusukat ng hakbang 3 ng gabay gamit ang `mt-eval run`. Ang benchmark ay isang pagbasa para sa pagmamarka: binibilang ito ng forge, at tatanggihan ang isang hulang isinulat pagkatapos nito. Pagkatapos ay mag-split at magsanay (Hakbang 4).

:::tip Ang nag-iisang panuntunan para sa inyong agent
Sabihin dito: *"Palaging patakbuhin muna ang `nmt-forge status --json`, at pagkatapos ng bawat hakbang. Gawin ang anumang sinasabi ng `next_command` nito."* Ang nag-iisang gawaing iyon ay ginagawang isang gabay na riles ang forge. Tumatanggap ang bawat utos ng forge ng `--json`: eksaktong isang JSON document sa stdout, at ibinabalik ang pagtanggi bilang `{"error": {…, "why", "fix"}}` na may exit code 2. Kung kumokonekta ang inyong agent sa pamamagitan ng MCP, ang parehong loop ay ang tool na `forge_status` (`{ "project_dir": "<dir>" }`) — tingnan ang [Gabay sa Agent](/docs/network/getting-started/agent-guide).
:::

---

## Hakbang 0 — Mag-install, at ituro ang inyong agent sa inyong wika

**Sabihin ninyo:** *"I-install ang nmt-forge kasama ang training extra nito. Nais kong magsanay ng modelong Ingles→[inyong wika]. Magsimula sa pamamagitan ng pagtuklas sa kung ano ang alam ng forge tungkol dito. Ang ISO 639-3 code ay `crk`"* (gamitin ang code ng inyong wika).

```bash
python3 -m pip install 'nmt-forge[hf]'      # Python 3.11+; brings mt-eval-harness (the scorer)
```

Idinaragdag ng `[hf]` extra ang mga library sa pagsasanay (torch, transformers, accelerate, tokenizers, sentencepiece, peft). Sapat na ang mga CPU-only wheel para sa default na modelo. Ang payak na `python3 -m pip install nmt-forge` ay nagbibigay sa inyo ng mga guard, split, audit, at pagmamarka nang walang pagsasanay.

**Ginagawa ng forge:** Binabasa ng `nmt-forge discover crk` ang card ng wika — mga script, diksiyonaryo, morphological analyzer, umiiral na mga corpus at eval set (kasama ang anumang `do_not_train` / quarantine flag), at mga referee metric bawat wika. Hindi ninyo kailangan ng kopya ng repository ng Champollion: matatagpuan ang mga card sa isang direktoryong inyong papangalanan (`--cards-dir`), isang lokal na checkout o `node_modules/champollion`, o ang pampublikong index ng card (naka-cache, kaya gumagana ito offline pagkatapos). Pagkatapos ay inilalagay ng forge ang inyong wika sa **hagdan ng asset**: (1) parallel text → binabantayang pagsasanay; (2) + monolingual → naka-tag na backtranslation; (3) + diksiyonaryo/gramatika → siniping sintetikong data; (4) + analyzer → synthesis na na-verify sa round-trip; (5) + isang referee metric → ang sariling metric ng wika sa pagmamarka at pagpili ng checkpoint.

**Ang blangkong field ay nangangahulugang UNKNOWN, hindi kailanman zero.** Ang sparse card ay hindi nangangahulugang "walang anuman ang wikang ito" — maaaring hindi pa lamang nito naitatala ang resource. Maaari ninyong dalhin palagi ang sarili ninyong parallel corpus.

Pagkatapos: *"I-scaffold ang proyekto."*

```bash
nmt-forge init crk --dir school-mt && cd school-mt
```

Isinusulat nito ang isang workspace (`.forge/`), isang panimulang `config.json`, at isang brief na `NEXT_STEPS.md` na naglalaman ng eksaktong pagkakasunod-sunod ng utos. **Patakbuhin ang bawat susunod na utos mula sa loob ng direktoryo ng proyekto** — ang mga path ng config ay relative dito.

Ginagamit ng panimulang config ang model preset na **`cpu-tiny`** maliban kung pipili kayo ng iba:

| `--model` | Kung ano ito | Mga Kailangan | Inaasahan |
|---|---|---|---|
| `cpu-tiny` (default) | isang maliit na transformer (~6M parameter) na sinanay mula sa simula sa inyong mga pares; natututuhan lamang ang bokabularyo nito mula sa inyong mga row sa pagsasanay | isang CPU, walang download | mahina: sa 1–2 libong pares, humigit-kumulang 5–30 ang chrF++ (ang pinakamataas na dulo ay para lamang sa data na lubhang naka-template). Natututuhan nito ang mga parirala at pattern ng inyong data, hindi ang wika sa pangkalahatan |
| `cpu-finetune --base <hf-id>` | nag-fi-fine-tune ng isang maliit na pretrained na modelong Marian/opus-mt na inyong papangalanan (pumili ng isa para sa isang *magkaugnay* na pares ng wika) | isang CPU, ~300 MB na download | karaniwang mas mahusay kaysa sa `cpu-tiny` kapag may umiiral na magkaugnay na pares — sukatin ito sa inyong dev set, huwag magpalagay |
| `nllb-600m` | NLLB-200 distilled 600M na may LoRA | isang GPU, ~2.5 GB na download | ang pinakamalakas na simula; tinatanggihan ito ng wall-clock check ng forge sa isang CPU sa loob ng ilang minuto |

Isinusulat ang preset bilang mga tahasang numero sa `config.json` → `model`, kaya walang nakatago at ang pagbabago ng numero ay gumagawa ng bago at hiwalay na na-hash na run.

**Walang card para sa inyong wika?** Nag-i-scaffold pa rin ng proyekto ang `nmt-forge init <code> --no-card --name "<name>"`; ang lahat ng sasabihin sana ng isang card ay itinatala bilang hindi alam, at walang iniimbento.

---

## Hakbang 1 — Isantabi ang inyong test set, at irehistro ito {#step-1--set-your-test-set-aside-then-split}

**Sabihin ninyo:** *"Narito ang aking parallel corpus at, nang hiwalay, ang test set na sinuri ng guro. Panatilihing labas sa pagsasanay ang test set, at irehistro ito bago mamarkahan ang anuman dito."*

Maaaring `.tsv` ang mga file (source, isang TAB, pagkatapos ay ang salin, isang pares bawat linya; ang mga linyang nagsisimula sa `# ` ay mga komento) o `.jsonl` (`{"source": …, "target": …}` bawat linya). Kung pribado ang test set, markahan itong local-only **bago** basahin ito ng anuman — kabilang ang inyong agent:
`echo '{"transmission": "local-only"}' > ~/teacher-test.tsv.champollion.json`.
Pagkatapos ay hindi na kailanman ipiprint ng forge ang mga pangungusap nito.

**Ginagawa ng forge — kung mayroon kayong sariling test set** (ang karaniwang sitwasyon para sa isang paaralan o klinika):

```bash
nmt-forge registry add project-test ~/teacher-test.tsv --role test
```

Sinisimulan ng pagpaparehistro ang **read log** ng file (`<file>.reads.jsonl`): mula ngayon, binibilang ang bawat pagmamarka sa file na ito — ng forge, o ng `mt-eval run` / `mt-eval compare`. Iyon ang dahilan kung bakit nauuna ang pagpaparehistro: ang isang benchmark run na ginawa bago ito ay inililista sa pagpaparehistro, ngunit hindi ibinibilang.

**Kung wala kayong hiwalay na test set**, humati na lamang mula sa corpus —
`nmt-forge split pairs.tsv --test 150 --dev 100 --seed 42 --out data/split
--register project` registers `project-test` and `project-dev` sa isang hakbang
(ipinapaliwanag ng Hakbang 4 ang pag-split) — at magpatuloy sa Hakbang 3.

Pinapangalanan na ngayon ng `nmt-forge status` ang susunod na hakbang: ang mga hula (Hakbang 3), bago ang anumang benchmark — suriin muna ang inyong corpus (Hakbang 2).

---

## Hakbang 2 — Suriin para sa leakage

**Sabihin ninyo:** *"Bago tayo magsanay, suriin ang corpus laban sa test set at sabihin sa akin kung ano ang aalisin mo at bakit."*

```bash
nmt-forge leak-audit ~/pairs.tsv --clean-to pairs.clean.jsonl
```

**Ginagawa ng forge:** sinusuri nito ang bawat row laban sa bawat rehistradong dev/test/sealed set. Ang parehong corpus at ang parehong mga rehistradong set ay palaging nagbibigay ng parehong resulta. Ipinapaliwanag nito kung ano ang **aalisin** nito:

- **Magkaparehong prompt** — ang source sentence ng row ay katumbas ng source ng isang test row (pagkatapos balewalain ang case, bantas, at spacing). Inalis **kahit na iba ang salin ng row**: nagpraktis pa rin sana ang modelo sa eksaktong prompt ng pagsubok.
- **Magkaparehong sagot** — ang target ng row ay katumbas ng isang test reference.
- **Halos-duplicate na sagot** — ang target ng row ay nagbabahagi ng hindi bababa sa 60% ng mga salita nito sa isang sagot sa test (naka-fold ang mga accent, kaya ibinibilang ang mga variation sa pagbaybay) **at** naglalaman ng buong sagot, isang bahagi nito, o hindi bababa sa 90% na magkapareho. Maipapakita sa modelo ang karamihan sa sagot.

…at kung ano ang **sinadya nitong panatilihin**, iniulat ngunit hindi kailanman inalis:

- **Mga template sibling** — nagbabahagi ang row ng sentence frame sa isang sagot sa test ngunit nagpapalit ng isang salita sa bawat direksyon (*"I see the dog"* / *"I see the cat"*). Kailangan pa ring ilabas ng modelo ang salitang hindi nito kailanman nakita sa frame na iyon. Puno ng ganito ang mga naka-template na corpus ng textbook at paaralan. Inililista ng forge ang mga row sa test na may sibling sa pagsasanay; dahil itinatakda ng panimulang config ang `eval.near_dupe_corpus`, ipinapakita ng pampinideng ulat ang isang **"(strict)"** na marka sa mga row na walang ganoon katabi ng buong marka.
- **Katulad na prompt, ibang sagot** — ang source ay isang halos-duplicate (hindi isang magkaparehong kopya) ng isang source sa test, ngunit iba ang salin: isang lehitimong minimal contrast, hindi isang leak.

Narito ang ulat para sa isang 12-row na toy corpus na sinuri laban sa isang 3-row na test set (pinutol; ang mga toy sentence ay Ingles na may target na parang Pranses):

```
leak-audit: pairs.tsv — 12 rows screened against project-test [test, 3 rows]

DROPPED by --clean-to: 4 row(s) — the model would see an eval answer (or prompt)
  • identical PROMPT: the row's source equals an eval row's source ...
      project-test (test): 2
      e.g. line 2 "The library opens at nine." → project-test row 2
      e.g. line 3 "The library opens at nine!" → project-test row 2
  • identical ANSWER: the row's target equals an eval row's reference ...
      project-test (test): 1
  • near-duplicate ANSWER: the row's target overlaps an eval answer and only adds/removes words ...
      project-test (test): 1
      e.g. line 6 "ou est la grande grange rouge maintenant?" → project-test row 3 (contains the whole answer; overlap 0.86)

KEPT on purpose (reported, never removed): 1 row(s)
  • template sibling: shares a sentence frame with an eval answer but swaps a word each way ...
      e.g. line 1 "je vois le chat dans la maison." → project-test row 1 (swaps word(s); overlap 0.75)

Cleaned: 8 row(s) kept → pairs.clean.jsonl (audit manifest: pairs.clean.audit.json)
```

May *ibang* salin ang Linya 3 mula sa row sa test, at inalis pa rin: ang prompt nito ay ang test prompt.

Sumisipi ang mga halimbawa ng mga row ng **inyong corpus** ayon sa numero ng linya; hindi kailanman ipiniprint ang sariling teksto ng test file, at ang isang row na tumugma sa isang **sealed** na set ay ipinapakita lamang ayon sa numero ng linya. (Kapag ang isang row ng corpus ay katulad ng isang row sa test, o naglalaman nito, ang pagsipi sa row ng corpus ay nagpapakita rin sa pangungusap ng test na iyon — ipasa ang `--no-examples` kung ibabahagi ang output.)

Isinusulat ng `--clean-to pairs.clean.jsonl` ang mga natitirang row, kasama ang isang audit record na walang nilalaman sa tabi ng mga ito (`pairs.clean.audit.json`). Suriin ang corpus **bago** kayo mag-split (hinihiwalay ng Hakbang 4 ang nalinis na file). Huwag muling suriin ang buong corpus pagkatapos kumuha ng dev set mula rito — tutugma ang mga dev row sa kanilang sarili at aalisin. Suriin ang anumang *karagdagang* data (isang web harvest, monolingual na teksto) sa parehong paraan bago ito idagdag sa pagsasanay.

**Hindi nauubos ng pagsusuri ang inyong test set.** Binabasa ng leak-audit ang test set upang paghambingin ang mga row, at itinatala iyon ng forge bilang isang pagbasa para sa *audit*, hindi kailanman para sa pagmamarka: hindi ito nakakahadlang sa mga hulang isusulat ninyo sa Hakbang 3.

**Basahin muna ang hatol** (ang linya ng `VERDICT:`; kasama ang `--json`, ang key na `verdict`). Kung sinasabi nitong karamihan sa mga row ng test ay may halos-kambal sa inyong corpus, mamarkahan ng modelong sinanay sa kabuuan nito ang pag-alala sa mga parirala sa pagsasanay sa halip na pagsasalin. Sa isang nakapirming test set (sinuri ng guro o nars), karaniwan kayong magsasanay ng **dalawang modelo**: isa sa lahat ng data — karaniwang ang mas kapaki-pakinabang na i-deploy — at isang walang-kambal na ang marka ay nagsasabi kung paano pinangangasiwaan ng paraan ang mga bagong pangungusap. Ang twin-free na corpus ay nagmumula sa `--drop-test-twins`:

```bash
nmt-forge leak-audit ~/pairs.tsv --clean-to pairs.notwins.jsonl --drop-test-twins
```

Inaalis nito ang mga row sa pagsasanay na halos-kambal ng mga row sa test, iniuulat ang strict subset bago at pagkatapos, tumatanggi kung wala nang matitira para sanayin — at isinusulat ang config ng modelong walang kambal sa tabi ng inyo, **`config-notwins.json`**: ang parehong config na may sarili nitong `run_name`, at ang `data.gold` / `eval.near_dupe_corpus` na nakatakda sa twin-free na file (pinapangalanan ng `--companion-config <file>` ang isa pang file; hindi kailanman sinusulatan sa ibabaw ang isang umiiral na file). Ipiniprint nito ang utos na nagsasanay rito. Hanggang sa mairehistro ang dev set (Hakbang 4), sinasabi nitong hiwain muna ito at patakbuhin muli ang audit na ito, upang maalis din ang mga dev row sa twin-free na file. Pinapanatili ng `nmt-forge status` ang hatol — at pagkatapos ay ang hindi pa nasasanay na modelong walang kambal — sa mga babala nito hanggang sa kumilos kayo ukol dito.

**Ano ang hitsura ng pagtanggi:** hindi ninyo kailangang tandaang patakbuhin ito — sinusuri ng `nmt-forge run` ang bawat training file laban sa inyong mga test at sealed set at tinatanggihan ang isang leak: *"[leak-audit] corpus leaks into 1 test/sealed set(s) — project-test: 0 identical prompt(s), 3 identical answer(s), 1 near-duplicate answer(s) — plus 12 template sibling(s) … which are KEPT"*. Solusyon: `nmt-forge leak-audit <file> --clean-to <file.clean.jsonl>` at magsanay sa nalinis na file.

---

## Hakbang 3 — Mag-predict bago sumilip

**Sabihin ninyo:** *"Isulat kung ano ang inaasahan nating imamarka ng bawat modelo sa test set — bago tayo sumukat ng anuman dito."*

**Ginagawa ng forge:** isang preregistration bawat modelong balak ninyong sanayin, na ipinangalan sa modelo:

```bash
nmt-forge prereg template --out predictions.json    # then EDIT it
nmt-forge prereg new all-data --eval-set project-test --predictions predictions.json
nmt-forge prereg new notwins --eval-set project-test --predictions predictions-notwins.json   # only with a twin-free model
```

Ang isang predictions file ay isang JSON array ng mga hula. Bawat isa ay nagpapangalan ng isang metric at isang isang-pangungusap na rationale, kasama ang alinman sa direksyon laban sa isang baseline (`"direction": "increase", "baseline_score": 0, "margin": 5`) — awtomatikong sinusuri sa ibang pagkakataon — o isang free-text na inaasahan (`"expect": "between 10 and 30"`) na sinusuri ng isang tao. Isinusumite ninyo (o ng inyong agent, nang malakas) ang mga ito **bago** magkaroon ng anumang marka sa test — **at bago ang anumang benchmark ng isang umiiral na modelo sa test set**: ang mga baseline sa hakbang 3 ng [Bumuo ng MT para sa Inyong Wika](/docs/build-mt-for-your-language#3-measure-the-options) ay darating *pagkatapos* ng hakbang na ito. Kapag nag-export kayo, sinasabi ng `--prereg <id>` kung aling hula ang humuhusga sa aling modelo. O i-pin ang isang hula sa config ng modelo nito ngayon: `--config-hash <hash>` sa `prereg new`, gamit ang buong hash na ipiniprint ng `nmt-forge preflight run --config config-notwins.json`. Ang anumang pag-edit sa config na iyon sa ibang pagkakataon (halimbawa, badyet sa oras) ay nagbabago sa hash at nag-aalis sa pin, kaya ang pagpapangalan sa prereg sa pag-export ang mas simpleng paraan.

**Ano ang hitsura ng pagtanggi:** apat ang maaari ninyong makaharap dito.

- Ang hindi na-edit na template ay tinatanggihan: walang hinuhulaan ang mga placeholder nitong `REPLACE`. Isulat ang sarili ninyong inaasahan at rationale.
- Ang isang Markdown o prose file ay tinatanggihan kalakip ang format at ang utos ng template. May iisang format: ang JSON array.
- Ang isang preregistration na isinulat pagkatapos mamarkahan ang test set ay tinatanggihan: *"[preregister] eval set 'project-test' was already read for scoring … before this preregistration"*. May bilang ang benchmark. Umiiral lamang ang `--allow-after-reads` para sa mga hulang tunay na isinulat bago ang mga pagbasang iyon (halimbawa, sa papel); itinatala ito, at sasabihin ng bawat ulat, export, `DEPLOY.md`, at `nmt-forge status` na dumating ang mga hula pagkatapos ng N pagbasa para sa pagmamarka.
- Tinatanggihan ang pagmamarka sa isang test set na walang preregistration: *"[preregister] no preregistration for eval set 'project-test' … why: results looked at without written-down expectations become post-hoc stories"*. Ito ang naghihiwalay sa isang tunay na resulta mula sa pagkukuwentong inuuna ang resulta.

:::info Bakit ito parang dagdag na trabaho
Ito ang trabaho. Bawat guard dito ay isang pagkakamaling nakapanlinlang sa tunay na mga researcher.
Ginagawa ng tool na ang tapat na landas ang madaling landas at ang hindi tapat na landas ang siyang
pumipigil sa inyo.
:::

Ngayon sukatin ang mga umiiral na opsyon sa test set — hakbang 3 ng [Bumuo ng MT para sa Inyong Wika](/docs/build-mt-for-your-language#3-measure-the-options) — at bumalik upang magsanay.

---

## Hakbang 4 — Mag-split, suriin ang mga gate, pagkatapos ay magsanay {#step-4--check-the-gates-then-train}

**Sabihin ninyo:** *"I-split ang nalinis na corpus sa train at dev. Papasa ba ang training run sa lahat ng pagsusuri nito? Kung oo, magsanay."*

**Ginagawa ng forge — ang pag-split:**

```bash
nmt-forge split pairs.clean.jsonl --test 0 --dev 100 --seed 42 \
    --out data/split --register project
```

Humahati lamang ang `--test 0` ng train at dev, dahil umiiral na ang inyong test set bilang sarili nitong rehistradong file (sa isang hinating test set, nai-split na sa Hakbang 1). Itinatala ng `--register project` ang `project-dev` sa workspace — ang pangalang itinuturo na ng panimulang config.

Ang split ay **group-disjoint**: ang anumang dalawang pares ng pangungusap na nagbabahagi ng source *o* target ay napupunta sa **parehong** panig. Ito ang nag-iisang pinakakaraniwang dahilan kung bakit napapalobo ang mga marka sa low-resource — itinutugma ng isang textbook ang maraming drill sa Ingles sa iisang target na salita, naglalagay ang isang walang-muwang na random split ng isang kopya sa train at ang kambal nito sa test, at "isinasalin" ng modelo ang mga sagot na kinaulo nito. Sinasabi ng output kung ano ang nangyari:

```
split pairs.clean.jsonl: 1580 rows in 1544 share-groups (largest 4)
  train 1480 · dev 100 · test 0  → data/split/
  verified: 0 shared canonical source/target keys across sides
  test side: none (--test 0) — your test set is a separate file; ...
  registered project-dev (role=dev)
```

Dahil rehistrado na ang isang test set, sinusuri rin ng `split` ang mga bagong train at dev file laban dito sa mismong sandaling iyon at nagbababala kung may anumang row na tatanggihan sa ibang pagkakataon.

**Mga naka-template na corpus (mga phrasebook, drill).** Pinapanatili rin ng `--near-dupe 0.6` ang mga *halos*-duplicate — mga pangungusap na binuo sa parehong frame — sa isang panig, upang ang isang row sa dev o test ay hindi kailanman magkaroon ng template twin sa pagsasanay. Sa isang corpus na labis na naka-template, maaaring magkadugtong-dugtong ang mga frame sa isang dambuhalang grupo (*"Does your arm hurt?"* ~ *"Does your leg hurt?"* ~ *"Your leg looks swollen"* …), at maaari lamang mapunta ang isang grupo sa isang panig nang buo. Kapag magbibigay iyon sa isang panig ng mas marami pang row kaysa sa hiniling ninyo — higit sa **1.5×** ng kahilingan — o mag-iiwan sa pagsasanay ng mas mababa sa kalahati ng iniiwan ng kahilingan dito, tatanggi ang `split` at walang isusulat: *"[split-guard] split refused — nothing was written: the carve does not match the request (dev: asked for 100 rows, the carve put 663 there (6.63×); training keeps 210 of the 773 rows the request leaves it)"*, na susundan ng dahilan (ang pagkakadugtong-dugtong, kasama ang laki ng pinakamalaking grupo) at ang mga rutang gumagana: isang mas mataas na threshold, isang cap sa laki ng grupo (`--near-dupe 0.6 --max-group 51` — ang mga link ng halos-duplicate na lampas sa cap ay mananatiling hindi pinutol, at binibilang ang mga ito ng split), mga kambal ng isang nakapirming test set na inalis gamit ang `leak-audit --drop-test-twins`, o mga pangungusap sa dev/test na isinulat nang hiwalay sa materyal ng pagsasanay. Sinusuri mismo ng forge ang pagkakadugtong-dugtong: sa gayong corpus, ang payo nito ukol sa halos-kambal (dito, sa preflight, at sa DEPLOY.md ng export) ay hindi nagrerekomenda ng `--near-dupe 0.6`.

**Ano ang hitsura ng pagtanggi:** kung magbibigay kayo sa forge ng isang split na kayo mismo ang gumawa, tatanggi ang `nmt-forge verify-split train.jsonl dev.jsonl test.jsonl` kapag nag-o-overlap ang mga panig — *"[split-guard] 3 shared canonical source keys and 1 shared target keys between 'train' and 'test'"* — kalakip ang solusyon: muling humati gamit ang `split`; huwag manu-manong burahin ang mga lumalabag na row.

**Dalawang modelo?** Ngayong rehistrado na ang dev set, patakbuhin muli ang twin-free audit mula sa Hakbang 2 (aalis din ang mga dev row sa twin-free na file); sinasanay ng `config-notwins.json` nito ang ikalawang modelo sa ibaba.

**Ginagawa ng forge — ang mga gate:** Inililista ng `nmt-forge preflight run --config config.json` ang bawat gate na dadaanan ng run, ✓ o ✗, bawat ✗ kasama ang solusyon nito — kabilang ang kung naka-install ang training extra:

```
preflight: nmt-forge run

  ✓ config: config.json parses (config hash 9a85524275ff)
  ✓ dev-fence: config data.dev = 'project-dev': registered, role=dev
  ✓ training-data: 1 gold + 0 synthetic file(s) present
  ✗ backend-installed: backend 'hf-scratch' needs accelerate — not installed (the run would refuse)
      fix: python3 -m pip install 'nmt-forge[hf]'
  ✓ leak-audit: every gold and synthetic lane in the config will be audited ...
  ✓ schedule-sanity: regime, early-stop floor and eval cadence are derived from the config's data mix ...
  ✓ generation-headroom: decode cap is checked against dev reference lengths BEFORE training compute is spent

1 gate(s) would refuse — fix them first
```

Kapag berde na ang lahat: `nmt-forge run config.json` (at, para sa modelong walang kambal, `nmt-forge preflight run --config config-notwins.json && nmt-forge run config-notwins.json`).

Gamit ang default na preset na `cpu-tiny`, tumatakbo ito sa isang ordinaryong laptop CPU — walang GPU, walang download. Ang pagsasanay pa rin ang nag-iisang hakbang na **hindi** isang agarang tool call, kaya dapat itong patakbuhin ng inyong agent sa background nang nakaturo ang output sa isang log file, at panoorin lamang ang mga linyang mahalaga (`refused`, `Error`, `wall-clock`, `RUN EXIT`) sa halip na mag-poll. May magbubukas na live panel na may mga loss curve at stop button para sa **inyo** (sa `http://127.0.0.1:8377` kapag bakante ang port na iyon) — ito ay para sa inyo, hindi sa agent. Sa simula ng run, sinusukat ng forge ang bilis nito at tatanggihan — sa loob ng ilang minuto, hindi mga araw — ang isang run na hindi makakatapos sa loob ng `model.time_budget_hours` ng config.

Ipinapakita ng mga linyang `[schedule-sanity]` ang **floor** sa early-stopping na nakuha ng forge mula sa inyong data mix, upang ang isang run na mabigat sa synthetic data ay hindi huminto sa kalahating epoch kapag nag-wobble ang loss sa real-dev (isang totoong failure mode — tingnan ang [Pag-diagnose ng Training Run](/docs/network/getting-started/diagnosing-training)).

Kapag natapos ito, **nakapili na ang forge ng checkpoint sa binakurang dev set** (hindi kailanman sa test set), nakapagsulat ng `run-manifest.json`, at naiprint ang mga marka sa dev — palaging kasama ang kanilang 95% confidence intervals — na sinusundan ng susunod na utos.

---

## Hakbang 5 — Markahan ito nang isang beses, at i-package ito

**Sabihin ninyo:** *"Markahan ang modelo sa test set at i-package ito upang magamit natin ito."*

**Ginagawa ng forge:**

```bash
nmt-forge export .forge/runs/<run>/run-manifest.json --prereg all-data --out export/
```

Isang utos:

- dine-decode ang inyong test set gamit ang checkpoint na pinili ng run at minamarkahan ito — tatanggihan kung walang preregistration, itinatala sa ledger ng workspace, 95% confidence intervals sa bawat numero, at isang seksyon ng **Diagnosis at Mga Rekomendasyon** sa payak na wika;
- isinusulat ang resulta bilang isang **ulat ng mt-eval** sa `export/evaluation/`, kaya inilalagay ng `mt-eval compare` ang modelong ito katabi ng anumang sinukat ninyo gamit ang harness (halimbawa ang mga hosted model sa hakbang 3 ng [Bumuo ng MT para sa Inyong Wika](/docs/build-mt-for-your-language#3-measure-the-options));
- nagpe-package ng isang **self-contained na modelo** sa `export/model/` (mga weight at tokenizer, walang training state), `forge-model.json` (kung ano ito at paano ito sinukat), isang plugin manifest ng champollion, at `DEPLOY.md` kalakip ang mga eksaktong utos. Walang hawak na pangungusap sa test ang `export/model/`; ito lamang ang folder na inyong ide-deploy.

**Ang marka** ang pangunahing tampok ng harness: corpus chrF++ kasama ang 95% confidence interval nito, na isinusulat sa parehong paraan saanman ito ipinapakita ng forge — halimbawa `chrF++ 31.2 [28.4, 34.0]` — kasama ang sacreBLEU signature nito sa buong mga talaan (`forge-model.json`, ang buod ng export, `DEPLOY.md`). Ipinapakita ang BLEU, spBLEU, at TER sa tabi nito, hindi kailanman inihahalo rito; ang exact match at ang iba pang mga battery lane ay mga diagnostic. Walang bahagi ng forge ang nagpiprint ng composite o quality label: ang mga nagsasalita ng wika ang dapat humusga sa halaga ng output.

**Ang nagbibigay-kwalipikasyon sa marka ay sumasama rito.** Itinatala ng ulat ng mt-eval ang lahat ng naglilimita sa kahulugan ng marka — halimbawa ang isang *halos-palagiang output (near-constant output)* (nagbigay ang modelo ng isa sa iilang pangungusap sa maraming iba't ibang input, kaya hindi sumusunod ang mga output nito sa mga input nito), mga output na mas mahaba o mas maikli kaysa sa mga reference, o mga kopya ng source. Ipinapasa ng `export` ang bawat isa sa mga ito gamit ang sariling mga salita ng harness: sa buod nito (`score_caveats`), sa `forge-model.json`, at sa `DEPLOY.md` mismo sa ilalim ng marka. Ganoon din ang sinasabi ng `status`, `report`, `compare`, at `lint`. Ang isang markang may kasamang caveat ay hindi kailanman iniaalok bilang "ang numerong dapat sipiin" nang wala ito.

Kung may anumang mabigo, walang maiiwang kalahating naisulat na export. Dalawang pag-iingat: naglalaman ang `export/evaluation/` ng inyong mga pangungusap sa test — huwag kailanman kopyahin ito kasama ng modelo; panatilihin ito kasama ng test set. (Kapag minarkahang pribado ang test set, taglay ng bawat file doon ang parehong marka.) At ang isang **sealed** na test set ay isang beses lamang magagamit: ginagastos ito ng pag-export, at tatanggi ang ikalawang pag-export maliban kung ipapasa ninyo ang `--no-eval` (i-package ang modelo nang hindi muling nagmamarka).

Ang `nmt-forge evaluate <run-manifest>` ay ang kalahating para-sa-marka-lamang ng `export`, kung nais ninyo ang mga numero nang walang pag-package (isinusulat ng `--harness-out DIR` ang ulat ng mt-eval).

**Dalawang modelo sa isang test set** (halimbawa, isa na sinanay sa lahat ng data at isa na may `--drop-test-twins`): kapag naglalaman na ang workspace ng ikalawang run, ang linyang `NEXT` at `nmt-forge status` ng run ay nagpapangalan ng isang folder bawat run (`--out export-<run>/`). Hindi mahalaga ang pagkakasunod-sunod: alinmang modelo ang huling i-export, ang `DEPLOY.md` ng all-data na modelo ay nagtatapos sa pagsipi sa marka ng twin-free na modelo. Sa dalawang preregistration sa isang test set, sinasabi ng `nmt-forge status` at `nmt-forge report` kung alin ang nalalapat sa aling run (o na dapat magpasya ang `--prereg <id>` —
inihahambing ng export the twin-free model with `--prereg notwins`). `nmt-forge compare`
ang dalawa sa test set gamit ang A/B test at sinasabi, bawat modelo, kung gaano karaming row sa test ang may halos-kambal sa training data nito: ang panalo sa recall ay iniuulat bilang isa. Kinukuha nito ang mga hypothesis ng bawat modelo — `<export>/evaluation/battery-hyps.jsonl`, na pinangalanang `hypotheses` sa buod ng export — at ipinapasa ang mga caveat sa marka na isinulat ng mt-eval para sa export na iyon. Ang twin-free na marka ang dapat sipiin para sa mga bagong pangungusap kasama lamang ang anumang caveat dito: kung ang output ng twin-free na modelo ay halos-palagian, ang marka nito ay hindi katibayan na nagsasalin ito ng mga bagong pangungusap, at sinasabi iyon ng `DEPLOY.md` sa tabi ng numero.

**Ibinibilang ang mga pagbasa ng harness.** Kapag nagrehistro ang forge ng isang test set, nagsisimula ito ng isang maliit na read log sa tabi ng file (`<file>.reads.jsonl`), at nagdaragdag ang `mt-eval run` / `mt-eval compare` ng isang linyang walang nilalaman (run id, layunin, sha256 ng file, timestamp) sa bawat pagkakataong minamarkahan ng mga ito ang file na iyon. Binabasa ito ng forge: ang isang preregistration na isinulat pagkatapos ng gayong pagbasa ay tinatanggihan bilang isang postdiction (maliban kung `--allow-after-reads`, na inihahayag naman ng bawat ulat) — ang dahilan kung bakit nauuna ang Hakbang 3 sa mga baseline — ang isang sealed set na binasa ng `mt-eval` ay nagastos na, binibilang ng `status` at `ledger show --set` ang mga pagbasa, at sinasabi ng `DEPLOY.md` kung kailan ang na-export na marka ay hindi unang pagsilip.

### Paano basahin ang battery-lint report

Ang ulat ay isang talahanayan ng mga marka **ayon sa register** (textbook, pamahalaan, pasalitang kuwento, …) — o isang solong grupo, `all`, kapag hindi nagpapangalan ng register ang inyong mga test row — bawat isa ay may confidence interval nito, na sinusundan ng diagnosis. Pinapangalanan ng diagnosis ang inyong **mga pinakamahinang register** at, para sa bawat isa, ang pinakamalamang na dahilan at ang **pingga (lever)** na susunod na hihilahin:

| Kung sinasabi ng diagnosis na… | Ang ibig sabihin nito ay… | Ang pingga |
|---|---|---|
| `R1-vocabulary-gap` | mababa ang marka ng register **at** hindi tapos ang mga output; kulang ang modelo sa mga salita | **BOKABULARYO** — palakihin ang leksikon, pagkatapos ay suriin muli ang funnel |
| `R2-structure-gap` | alam ang mga salita ngunit hindi ang mga *hugis* ng pangungusap | **ISTRUKTURA** — idagdag ang mga nawawalang konstruksyon (mga template/compositor) |
| `R3-mixed-convention` | naghahalo ng mga pagbaybay ang mga output | **ORTOGRAPIYA** — i-normalize ang corpus sa isang kumbensiyon, magsanay muli |
| `R4-optimism-bound` | napalobo ang "buong" marka ng mga halos-kambal na test row | **PAGSUKAT** — sipiin ang strict score para sa generalization |
| `R5-low-power` | malawak ang confidence interval | **PAGSUKAT** — huwag kumilos sa mga delta na mas maliit kaysa sa CI; palakihin ang test set |
| `R7-transfer-plateau` | napakahusay sa synthetic, huminto sa totoong teksto | **TOTONG-DATA** — i-backtranslate ang monolingual na data o kumuha ng mga totoong parallel na pangungusap |
| `R9-harness-score-caveat` | nagbibigay-kwalipikasyon ang ulat ng mt-eval sa marka (halimbawa, isang halos-palagiang output); `high` kapag tinawag itong major ng mt-eval | **PAGSUKAT** — sipiin lamang ang marka kasama ang caveat, at magbasa ng ilang output bago ito tawaging kalidad ng pagsasalin |

Bawat natuklasan ay nagdadala ng ebidensyang pinagbatayan nito. Para sa mga natuklasang `--json` na maaaring aksyunan ng inyong agent sa pamamagitan ng program: `nmt-forge lint
export/evaluation/battery-hyps-battery.json --json`.

---

## Hakbang 6 — I-serve ito sa champollion CLI

**Sabihin ninyo:** *"I-serve ang na-export na modelo at isalin ang mga string ng aming app gamit ito."*

**Ginagawa ng forge:**

```bash
nmt-forge serve export/model                               # http://127.0.0.1:8378
LOCAL_API_BASE=http://127.0.0.1:8378/v1 champollion sync --method local
```

Sumasagot ang `serve` sa dalawang paraan: ang kontrata ng **api method** ng champollion (`POST /translate`) at isang **OpenAI-compatible** na `/v1/chat/completions`, na siyang kinakausap ng `champollion sync --method local`. Taglay ng `export/model/DEPLOY.md` ang snippet ng `champollion.config.json` para sa pamamaraang `api` (ang inirerekomenda nito) at para sa plugin manifest. Nakikinig ang server sa `127.0.0.1` lamang; upang ilantad ito sa isang network kailangan ninyo itong bigyan ng token (`--token`, o `NMT_FORGE_SERVE_TOKEN`), dahil magagamit ng sinumang makakaabot sa port ang inyong modelo. Hindi kailangan ng CLI ng key para sa loopback server; kailangan ng isang server na sinimulan gamit ang token ng parehong halaga sa `CHAMPOLLION_API_KEY`.

Sa dalawang na-export na modelo, nasa inyo ang pagpili kung alin ang ide-deploy: itinatala ito ng `nmt-forge choose export-<run>/model`, at pinapangalanan pagkatapos ng `nmt-forge status` ang modelong iyon. Ang pag-serve ng isa upang subukan ito ay itinatala bilang nai-serve, hindi bilang isang pagpili. Upang ipasok sa halip ang modelo sa isang sovereign contest, inililista ng `DEPLOY.md` §6 ang mga file na bumubuo sa isang declarative (Lane A) na lahok at ang eksaktong utos na `mt-eval contest submit-model`.

Alamin kung ano ang inyong dine-deploy: nagsasalin ng teksto ang isang modelong NMT; **hindi** ito sumusunod sa mga tagubilin, kaya binabalewala ang gabay sa tono, mga coaching file, at mga glosaryo na ipinapadala ng CLI sa mga pamamaraang LLM. At ang machine translation ng isang low-resource na wika ay nangangailangan ng pagsusuri ng isang matatas na tagapagsalita bago makarating ang anuman sa mga mambabasa.

---

## Ang katatapos lamang ninyong gawin

Nagsanay kayo ng isang modelo na talagang mapagkakatiwalaan ninyo ang marka: walang nag-leak na mga sagot, isang checkpoint na pinili nang hindi sumisilip sa test set, mga error bar sa bawat numero, mga hulang isinulat bago ang mga resulta, isang diagnosis na nagpapangalan sa susunod na pingga sa halip na iwan kayo sa panghuhula — at isang naka-package na modelo na matatawag ng CLI at direktang maihahambing sa bawat iba pang pamamaraang inyong sinukat. Iyon ang buong punto — **ang tapat na resulta ang default, at hindi ito nangailangan ng kadalubhasaan sa MT (o GPU) upang marating.**

Kapag nakakadismaya ang mga numero (mangyayari ito, sa unang pagkakataon — sadyang mahina ang default na modelo), pumunta sa [Pag-diagnose ng Training Run](/docs/network/getting-started/diagnosing-training) — inuuna nito ang sintomas, na isinulat para sa eksaktong sandaling iyon.
