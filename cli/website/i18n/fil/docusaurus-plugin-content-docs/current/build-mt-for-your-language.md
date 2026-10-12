---
slug: /build-mt-for-your-language
title: "Bumuo ng MT para sa Inyong Wika"
description: "Mula sa “paano tayo magsisimula?” hanggang sa isang nasubukang workflow ng pagsasalin: alamin kung ano ang umiiral, protektahan ang inyong test set, sukatin ang mga opsyon, bumuo ng mas mahusay, patunayan ito, at i-deploy ito — kalakip ang mga eksaktong command at MCP tool call para sa bawat hakbang."
---

# Gumawa ng machine translation para sa inyong wika

Dadalhin kayo ng pahinang ito mula sa *"nais namin ng pagsasalin para sa aming wika — paano kami magsisimula?"* patungo sa isang workflow ng pagsasalin na **sinukat ninyo sa sarili ninyong mga pangungusap** at ginamit sa aktwal na gawain. Isinulat ito para sa mga tao at para sa mga AI agent: bawat hakbang ay nagbibigay ng command na dapat patakbuhin at, kung mayroon, ang [MCP tool](/docs/network/getting-started/mcp-server) na tinatawagan ng agent bilang kapalit.

Dalawang patuloy na halimbawa:

- **Isang paaralan** ang nagnanais ng Ingles → Plains Cree para sa kanilang newsletter at isang maliit na app. Sinuri ng mga guro ang ilang daang pangungusap at nais nilang panatilihing pribado ang mga ito.
- **Isang ospital** ang nagnanais ng Ingles → isang wikang halos hindi saklaw ng index, para sa isang bedside phrasebook. Naglalaman ng klinikal na pananalita ang mga pansubok na pangungusap nito at hindi kailanman dapat ipadala sa isang panlabas na serbisyo ng AI.

Magtatapos kayo na mayroong: isang pribadong test set, mga marka para sa ilang pamamaraan dito, isang mas mahusay na pamamaraan (isang coached model o isang modelong kayo mismo ang nagsanay), at ang pamamaraang iyon na naka-deploy sa pamamagitan ng CLI — kung saan bawat numero ay matutunton sa kung ano ang lumikha nito.

:::info[Ang hindi ginagawa nito]
Walang anuman dito ang gumagawang tama sa isang salin. Sinasabi sa inyo ng mga marka kung aling opsyon ang *hindi gaanong mali sa inyong mga pangungusap*; isang matatas na tagapagsalita pa rin ang nagpapasya kung ano ang angkop gamitin. Basahin ang [Mga Tapat na Limitasyon](/docs/network/honest-limitations) bago kayo umasa sa anumang numero.
:::

:::warning[Mga Agent: bago ninyo buksan ang alinman sa mga file ng user]
Kung ang isang test set ay maaaring pribado (sinuri ng guro, sinuri ng nars, anumang hindi pa nailalathala ng komunidad), huwag itong basahin — walang `cat`, `head` o preview, kahit upang makita lamang ang format nito. Ang anumang binabasa ninyo ay napupunta sa inyong model provider. Tanungin ang user, at markahan muna ito bilang local-only ([hakbang 2](#2-gather-your-data--and-protect-your-test-set)).
:::

## 0. Pag-install

```bash
npm install -g champollion        # translate + deploy        (Node 20.11+)
python3 -m pip install mt-eval-harness       # measure                   (Python 3.11+)
python3 -m pip install 'nmt-forge[hf]'       # train a model (optional; a CPU is enough to start)
```

Para sa isang agent, idagdag ang MCP server sa configuration nito:

```json
{
  "mcpServers": {
    "champollion": { "command": "npx", "args": ["-y", "champollion-mcp-server"] }
  }
}
```

## 1. Alamin kung ano ang umiiral

Kung ano na ang nalalaman tungkol sa wika — mga diksyunaryo, gramatika, corpora, analyzer (mga FST), modelo, nailathalang resulta, serbisyo — at kung saan nagmumula ang bawat datos.

```bash
champollion network card crk                 # the cited language card
champollion network recommend eng crk        # methods you can run, with the evidence for each
mt-eval corpora --source eng --target crk   # registered test sets for the pair
nmt-forge discover crk               # what a training project can use
```

**Agent:** Nahahanap ng `search_languages { "query": "Atya" }` ang code kahit mula sa maling baybay (mga pinakamalapit na pangalan ayon sa edit distance). Ipinapakita ng bawat resulta kung saan sinasalita ang wika kapag may binabanggit na pinagmulan ang card nito para doon, at ipinapakita ang pinagmulang iyon, upang makapamili ang user sa pagitan ng mga wikang may magkakatulad na pangalan. Hindi kailanman ipinapakita ang lokasyong walang pinagmulan: isinasaad ito ng linya at inili-link sa halip ang talaan sa Glottolog ng wika, kung saan maaaring ihambing ang mga kandidato sa mismong pinagmulan. Mula sa isang pag-install sa npm, ang isang wikang nasa labas ng bundled core set ay pinupunan mula sa mga nailathalang card table ng champollion.dev, na wala pang mga pinagmulan bawat field sa kasalukuyan (darating ang mga ito sa susunod na upload ng mga talahanayan), kaya ang linya nito ay may link sa Glottolog sa halip na lokasyon. Kapag walang anumang ipinapakita na nagpapaiba sa mga kandidato, ang mga tagapagsalita ang magpapasya (sa ibaba). Pagkatapos ay nagbibigay ang `language_overview { "code": "<code>" }` ng isang pahina: kung ano ang umiiral, aling mga benchmark at resulta ang mayroon, at mga may bilang na susunod na hakbang. Ang anumang tool na tumatanggap ng isang wika ay tumatanggap din dito bilang `language`.

Basahin ang card sa paraan ng pagkakasulat nito: **ang kawalan ay nangangahulugang hindi alam, hindi zero.** Ang card na walang nakatalang diksyunaryo ay nangangahulugang wala pang naitala ang index — hindi dahil sa walang umiiral. Kung saan hindi nagtutugma ang mga pinagmulan (madalas sa bilang ng mga tagapagsalita), ipinapakita ng card ang lahat ng ito.

Kung ang inyong wika ay walang card, magagawa pa rin ninyo ang lahat ng nasa ibaba; mas kaunti lamang ang nalalaman ng mga tool tungkol dito (sinisimulan pa rin ng `nmt-forge init <code> --no-card --name <name>` ang isang proyekto sa pagsasanay).

### Kapag hindi pa nakumpirma ang barayti

Maaaring umangkop ang isang pangalan sa ilang wika. Halimbawa, ang "Ayta" ay tumutugma sa anim na wikang Ayta sa Pilipinas, bawat isa ay may sariling code. **Tanungin muna ang mga tagapagsalita.** Alam ng komunidad kung aling barayti ang kanilang sinasalita, at ang isang code na pinili para sa kanila ay isang pagpapalagay tungkol sa kanila.

Kung kailangan ninyong magsimula bago sila makasagot, gumamit ng private-use code: inilalaan ng ISO 639 ang `qaa` hanggang `qtz` para mismo rito. Bigyan ito ng display name, upang mapangalanan ng mga prompt at ulat ang wika:

```bash
champollion init --yes --langs qaa --name qaa="Ayta (variety not yet confirmed)"
```

na nagsusulat, sa `champollion.config.json`:

```json
"languages": { "qaa": { "name": "Ayta (variety not yet confirmed)" } }
```

Sinasabi ng `init` na ang code ay isang private-use code na walang language card (hindi nito hinihiling sa inyo na suriin ang baybay).

Tinatanggap lahat ng `init`, `sync`, `verify`, at `network register-corpus` ang isang private-use code. Ang magiging kabawasan sa inyo, hanggang sa mapalitan ito ng totoong code:

- **Walang mga datos mula sa card.** Walang mga preset ng rehistro, panuntunan sa maramihan (plural rules), o script mula sa isang language card. Gumagamit ang sync ng mga generic na setting, kaya suriin ang mga unang resulta sa isang tagapagsalita.
- **Walang FST.** Walang morphological analyzer na nakalakip sa isang private-use code, kaya walang nasusuri nang salita-sa-salita.
- **Walang mga naunang resulta.** Ang mga nailathalang benchmark at ang queue ay naka-key sa mga totoong code, kaya walang maipakikita ang `recommend` at `corpora` para dito.

Kapag kinumpirma ng komunidad ang barayti, lumipat sa code nito:

1. Sa `champollion.config.json`, palitan ang `qaa` ng code (at alisin ang `name` kung angkop ang pangalan ng card).
2. Palitan ang pangalan ng mga locale file (`messages/qaa.json` → `messages/ayt.json`). Mananatiling balido ang mga salin: pananatilihin ng susunod na `champollion sync` ang mga ito at isasalin lamang ang bago.
3. Irehistro muli ang test set sa ilalim ng totoong pares:
   `champollion network register-corpus --pair "eng>ayt" --data <file> --role test …`.
   Ipi-print ng command ang `--id` na ipapasa, dahil pinapanatili ng isang nakarehistrong file ang id nito maliban kung pipili kayo ng bago. (Tinatanggap ng `--pair` ang `eng-ayt` o `"eng>ayt"` dito at sa `nmt-forge init`; i-quote ang anyong `>`, dahil binabasa ng shell ang hubad na `>` bilang "sumulat sa isang file".)

## 2. Tipunin ang inyong data — at protektahan ang inyong test set

**Ihiwalay muna ang test set.** Isantabi ang mga pangungusap na gagamitin ninyo sa paghusga sa lahat (ang mga sinuri ng guro, ang mga sinuri ng nars) bago kayo magsanay o mag-tune ng anuman, at huwag kailanman magsanay gamit ang mga ito.

Ang test set ay isang TSV file: isang pares ng pangungusap bawat linya, source, isang TAB, pagkatapos ay ang reference na salin. Ang mga linyang nagsisimula sa `# ` ay mga komento.

```text
# teacher-checked, 2026 term 1
The library opens at nine.	<the teacher's translation>
```

Pagkatapos ay magpasya kung hanggang saan ito maaaring makarating:

| Nais ninyo na… | Gawin ito |
|---|---|
| Walang aalis sa makinang ito — walang panlabas na serbisyo ng AI ang maaaring makakita sa mga pangungusap na ito kailanman | Maglagay ng marker file sa tabi nito (sa ibaba). Tanging modelo lamang sa sarili ninyong makina ang maaaring subukan laban dito. |
| Makikita ng iba na umiiral ang test set, ngunit hindi kailanman ang mga nilalaman nito | Nagrerehistro lamang ng metadata ang `champollion network register-corpus --tier private --role test …` |
| Isang paligsahan para dito, na pinapatakbo sa makinang kontrolado ninyo, na posibleng air-gapped | `--tier sealed` kasama ang [sovereign node](/docs/network/sovereignty/sovereign-eval-node) |
| Ito ay pampubliko at bukas ang lisensya | Itinuturo ng `--tier public` kung saan ito nakalagay; hindi pa rin namin ito kailanman hino-host |

Ang marker para sa "hindi kailanman aalis sa makinang ito":

```bash
echo '{"transmission": "local-only"}' > data/nurse_checked_test.tsv.champollion.json
```

Kapag nakalagay ito, tinatanggihan ng `mt-eval run` ang bawat remote provider para sa file na iyon at tumatakbo lamang laban sa isang modelo sa loopback. Mga detalye:
[Pagpaparehistro ng Corpora](/docs/network/sovereignty/registering-corpora).

**Aling licence id.** Humihingi ang pagrerehistro ng `--license`: ang mga tuntuning talagang ipinagkaloob ng mga may-ari ng data, hindi kailanman isang placeholder. Tanungin sila, pagkatapos ay piliin ang id na nagsasaad nito: isang SPDX id kung inilalathala na nila ang teksto sa ilalim nito; `community-eval-grant-nc` para sa "upang magmarka lamang ng mga sistema, huwag kailanman magsanay, huwag kailanman magbahagi, walang bayad na pagmamarka"; `community-eval-grant` para sa parehong kundisyon ngunit pinapayagan ang may bayad na pagmamarka; `proprietary` para sa all rights reserved; o `LicenseRef-<name>` para sa sarili nilang mga tuntunin. Ang huling apat ay mga `LicenseRef-…` id, mga pasadyang pahintulot (bespoke grants): tatanggihan ang remote evaluation laban sa mga ito hanggang sa maitala ng steward ang pahintulot. Hanggang sa makumpirma ng steward, itala ang inyong pinili bilang provisional. Ang local-only ay nananatiling lokal anuman ang lisensya: ang marker, hindi ang lisensya, ang nagpapasya kung saan pupunta ang mga pangungusap.
[Aling licence id para sa isang pribadong test set](/docs/network/sovereignty/registering-corpora#which-licence-id-for-a-private-test-set).

**Mga Agent: huwag basahin ang isang local-only test file.** Walang `cat`, `head` o pagbubukas nito upang sumilip. Ang anumang binabasa ninyo ay napupunta sa inyong model provider, na siyang lugar kung saan sinasabi ng marker na hindi dapat mapunta ang mga pangungusap na ito. Hindi ninyo kailangang gawin ito: pinapanatili ng mga tool ang mga pangungusap nito sa labas ng kanilang ipiniprint (nagpapakita sa halip ang `mt-eval compare` ng mga entry id at marka), at ang `--show-text` ay para lamang sa taong nasa terminal.

**Agent:** Inililista ng `language_overview { "code": "<code>" }` ang mga opsyon sa proteksyon para sa wika; iginagalang ng `run_benchmark` ang marker at nagbabalik ng pagtanggi (kasama ang dahilan) sa halip na ipadala palabas ang mga protektadong pangungusap.

### Kung maaari kayong magsanay ng modelo kalaunan: magrehistro, mag-screen, maghula — bago ang anumang pagmamarka

Gawin ang tatlong bagay na ito ngayon, sa ganitong pagkakasunod-sunod, bago sumukat ang hakbang 3 ng anuman sa test set. Binibilang ng Forge ang bawat pagtingin sa isang test set, at ang isang benchmark (hakbang 3) ay isang scoring read: tinatanggihan ang isang preregistration na isinulat pagkatapos nito. Mahalaga ang pagkakasunod-sunod; hindi magiging pareho kung gagawin ito mamaya.

1. **Irehistro ang test set sa NMT Forge.** Nagsisimula rito ang read log nito, kaya binibilang ang bawat susunod na pagbasa (ang score read bago ang pagpaparehistro ay nakalista, ngunit hindi binibilang).
2. **I-screen ang inyong training corpus laban dito** (`leak-audit`). Binabasa nito ang test set para sa isang audit, hindi kailanman para sa marka, kaya hindi ito nabibilang laban sa inyong mga hula. Basahin ang hatol nito: kung ang karamihan sa mga row ng pagsubok ay may halos-kambal (near-twin) sa inyong corpus, ang isang modelong sinanay sa kabuuan nito ay magmamarka sa pagkaalala ng mga parirala sa pagsasanay, hindi sa pagsasalin. Karaniwan kayong magsasanay ng dalawang modelo pagkatapos: isa sa lahat ng data, at isa na walang kambal (isinusulat ng `--drop-test-twins` ang corpus at config nito, `config-notwins.json`).
3. **Isulat kung ano ang inyong inaasahan, isang preregistration bawat modelong balak ninyong sanayin**, na ipinangalan sa modelo. Ang mga hulang ito ang pagbabatayan sa paghusga sa mga marka ng pagsubok kalaunan: hinuhusgahan ng export ang bawat modelo laban sa pinangalanan ninyo gamit ang `--prereg <id>` (kung may dalawa sa iisang test set, tatanggi itong manghula). Maaari din ninyong i-pin ang isang hula sa config ng modelo nito gamit ang `--config-hash <hash>`, ang buong hash na ipiniprint ng `nmt-forge preflight run --config config-notwins.json`. Anumang susunod na pag-edit sa config na iyon (halimbawa, badyet sa oras) ay magpapabago sa hash at mag-aalis sa pin, kaya ang pagpapangalan sa prereg sa pag-export ang mas simpleng paraan.

```bash
nmt-forge init crk --dir school-crk
cd school-crk
nmt-forge registry add project-test ../data/test.tsv --role test
nmt-forge leak-audit ../data/corpus.tsv --clean-to corpus.clean.jsonl
nmt-forge prereg template --out predictions.json      # edit it: what you expect, and why
nmt-forge prereg new all-data --eval-set project-test --predictions predictions.json
cd ..                                                 # step 3 runs from here
```

Kung ang hatol ay SEVERE, idagdag ang twin-free na modelo at ang sarili nitong mga hula (sa `school-crk/`):

```bash
nmt-forge leak-audit ../data/corpus.tsv --clean-to corpus.notwins.jsonl --drop-test-twins
nmt-forge prereg new notwins --eval-set project-test --predictions predictions-notwins.json  # your edited copy
```

Nagkakaroon ng sariling file ang twin-free corpus. Nananatiling all-data corpus ang `corpus.clean.jsonl`: tumatanggi ang leak-audit na magsulat sa ibabaw ng isang file na binabasa ng isang config, run, o split, o isinulat ng isa pang audit (sinasadyang palitan ng `--overwrite` ang isa). Inililista ng sagot nitong `--json` ang unang ilang numero ng row ng bawat listahan; pinapanatili ng `.audit.json` file sa tabi ng nilinis na corpus ang lahat ng ito.

Umiiral lamang ang `--allow-after-reads` para sa mga hulang totoong naisulat bago ang mga pagbasa (sa papel, halimbawa). Naitala ito, at bawat ulat,
export and DEPLOY.md then says the predictions came after the scores.

**Agent:** `forge_init { "code": "<code>", "dir": "<dir>" }`, pagkatapos ay `forge_register_eval { "name": "project-test", "path": "../data/test.tsv", "role": "test", "project_dir": "<dir>" }`, `forge_leak_audit { "corpus": "../data/corpus.tsv", "clean_to": "corpus.clean.jsonl", "project_dir": "<dir>" }` (binabasa ang mga path mula sa `project_dir`, dahil ang mga command sa itaas ay pinapatakbo mula sa loob ng proyekto; gumagana ang absolute path kahit saan), pagkatapos ay `forge_prereg_template` → `forge_prereg { id, eval_set, predictions }` kasama ang user, isa bawat modelo, bawat isa ay ipinangalan sa modelo nito (tatanggapin pagkatapos ng `forge_export` ang id na iyon bilang `prereg`; ang `config_hash` sa `forge_prereg` ay nag-i-pin sa halip sa config nito). Ipinapangalan ng `forge_status` ang hakbang na ito sa sandaling marehistro ang isang test set. Nagsasanay ang Hakbang 4 sa parehong proyekto. Inililista rin ng `language_overview` ang mga hakbang na ito sa ganitong pagkakasunod-sunod.

## 3. Sukatin ang mga opsyon

Patakbuhin ang bawat kandidato laban sa **inyong** test set (nakarehistro, na-screen, at na-preregister muna sa forge, kung maaari kayong magsanay kalaunan — [hakbang 2](#2-gather-your-data--and-protect-your-test-set)). Minamarkahan ng harness ang bawat isa sa parehong paraan, sa paraang nag-uulat ang larangan ng pagsusuri ng MT: ang pangunahing datos ay ang corpus chrF++ kasama ang 95% confidence interval nito, na may BLEU, spBLEU, at TER sa tabi nito (hindi kailanman pinagsasama sa iisang numero). Ang eksaktong tugma at mga pagsusuri sa gawi (maling-script na output, mga hudyat ng hallucination) ay iniuulat bilang mga diagnostic, kasabay ng gastos at bilis. Kung saan may naka-pin na morphological analyzer ang harness para sa wika, nagdaragdag ito ng pagtanggap ng FST at morphological accuracy bilang mga diagnostic; inililista ng `mt-eval setup --status` ang mga wikang iyon, at nagdaragdag ang `mt-eval setup --comet` ng COMET kung saan ito naaangkop.

```bash
# a hosted model (needs OPENROUTER_API_KEY); --max-cost stops before spending more
mt-eval run --corpus data/test.tsv --source-lang English --target-lang "Plains Cree" \
  --target-lang-code crk --provider openrouter --model google/gemini-3.8-flash \
  --max-cost 1 -n gemini-3.8-flash -o results

# a model on your own machine (Ollama, llama.cpp, vLLM — anything OpenAI-compatible)
mt-eval run --corpus data/test.tsv --source-lang English --target-lang "Plains Cree" \
  --target-lang-code crk --provider local --base-url http://127.0.0.1:11434/v1 \
  --model llama3.1 -n local-llama -o results

mt-eval compare results/*_report.json --significance
```

Sinasabi ng `compare` kung totoo ang isang pagkakaiba o nasa loob lamang ng ingay (paired approximate randomization). Ang pagkakaibang nasa loob ng mga confidence interval ay hindi isang ranking. Nagsusulat ito ng `comparison-<hash>.json`, na ipinangalan para sa mga run na inihahambing nito, sa tabi ng mga ulat kapag magkasama sila sa isang folder, o sa isang `comparisons/` folder sa itaas ng mga ito kapag hindi, at hindi kailanman sa sariling folder ng isang run. Hindi ito kailanman ino-overwrite ng isa pang paghahambing.

**Mga evaluation pack.** May ilang wika na nagdedeklara ng mga karagdagang tool na kailangan ng kanilang mga sukatan (para sa Plains Cree, isang morphological analyzer). Pinapangalanan ng unang `mt-eval run` kung ano ang nawawala. Ang isang nawawalang analyzer ay hindi kailanman nagpapatigil sa pagpapatakbo: mamarkahan ang pagtanggap ng FST bilang not computed, ini-install ito ng `mt-eval setup --lang crk` (minsan bawat makina), at idinadagdag pagkatapos ng `mt-eval test <run log>` ang marka nang hindi na muling nagsasalin.

**Agent:** `run_benchmark { "corpus": "data/test.tsv", "provider": "local",
"base_url": "http://127.0.0.1:11434/v1", "model": "llama3.1",
"target_language": "crk" }` plans first and runs only with `confirm: true`;
ibinabalik ng `get_run_status { "job_id": "<id>" }` ang mga marka. Wala itong inilalathala maliban kung ipapasa ninyo ang `publish: true`. Ang code bilang `target_language` ay pinapangalanan mula sa language card nito ("Plains Cree") bago ito makarating sa prompt, at ipinapakita ng plano ang prompt na matatanggap ng modelo. Pinapalitan ng coaching file ang prompt na iyon, at isinasaad ito ng plano. Kapag naglista ang card ng dalawang script at wala kayong ipinasang `script`, binabasa ng plano kung aling script ang ginagamit ng mga reference (binibilang ang mga titik sa inyong makina, walang pangungusap na ipinapakita) at hinihiling ang isang iyon. Dumarating ang mga ulat nito sa tabi ng test file, sa `data/results/mcp-run-<id>/`, kasama ang translation cache ng harness sa `data/results/cache/`. Ipiniprint ng `get_run_status` ang command na `mt-eval compare` para sa mga ito, at para sa mga pagpapatakbo sa isang rehistradong corpus id, inililista nito ang mga ulat ayon sa path. Sinasabi muna ng isang planong `local-model` kung gaano karami ang idina-download ng pagkumpirma, at kung saan.

**Aling sukatan ang pagkakatiwalaan** ay nakadepende sa wika:
iniuulat ng `get_metric_reliability { "language": "<code>" }` (MCP) kung mayroon nang anumang awtomatikong sukatan na napatunayan laban sa mga paghuhusga ng tao para dito. Para sa karamihan ng mga low-resource na wika ay wala pa, kaya chrF++ ang kinaugalian — basahin ito bilang paghahambing sa pagitan ng mga pamamaraan sa parehong test set, hindi bilang isang grado.

## 4. Bumuo ng mas mahusay

Dalawang ruta. Sukatin ang pareho sa parehong paraan tulad ng hakbang 3.

**Sanayin (coach) ang isang pangkalahatang modelo.** Bigyan ito ng talasalitaan (glossary) at gabay, pagkatapos ay patakbuhin muli ang hakbang 3 kasama ang coaching:

```bash
mt-eval run --corpus data/test.tsv --source-lang English --target-lang "Plains Cree" \
  --target-lang-code crk --provider openrouter --model google/gemini-3.8-flash \
  --coaching-file coaching.json -n gemini-coached -o results
```

Tinatanggap ng `--coaching-file` ang Markdown, plain text, o JSON; ang buong teksto ng file ang mga tagubilin ng modelo, na ipinapadala nang ayon sa pagkakasulat.

Upang markahan ang terminolohiya (lumalabas ba ang bawat nakalistang termino bilang kinakailangang salin nito?), bigyan ang bawat pagpapatakbo na inihahambing ninyo ng parehong listahan ng termino gamit ang `--glossary terms.json` (`{"blood pressure": "…"}`, o isang listahan ng mga tinatanggap na anyo bawat termino). Ginagamit lamang ang talasalitaan para sa pagmamarka; hindi ito kailanman ipinapadala sa modelo, kaya ang karaniwang pagpapatakbo at ang coached na pagpapatakbo ay minamarkahan sa parehong mga termino. Kung walang `--glossary`, ang `dictionary` ng isang JSON coaching file (ang hubog ng [coached prompting](/docs/network/tutorials/coached-llm-prompting): `grammar_rules`, `dictionary`, `style_notes`) ang ginagamit sa halip. Sa sitwasyong iyon, ang pagpapatakbo ay minamarkahan laban sa sarili nitong coaching, at isinasaad ito ng output. Ang isang Markdown coaching file ay nagtuturo sa parehong paraan ngunit hindi nagbibigay ng talasalitaan.

Tingnan ang [coached prompting](/docs/network/tutorials/coached-llm-prompting) at [dictionary-augmented prompting](/docs/network/tutorials/dictionary-augmented-llm).

**Sanayin ang sarili ninyong modelo** gamit ang NMT Forge, na tumatanggi sa mga pagkakamaling nagpapamukhang mas maganda ang mga resulta ng maliit na data kaysa sa totoong kalagayan (mga tumagas na pansubok na pangungusap, masasamang split, pagpili ng checkpoint sa test set, pagbasa sa ingay bilang pagsulong):

```bash
cd school-crk     # after step 2: registered, screened, preregistered
nmt-forge split corpus.clean.jsonl --test 0 --dev 100 --seed 42 --out data/split --register project
nmt-forge preflight run --config config.json          # every check run makes, with fixes
nmt-forge run config.json
nmt-forge export .forge/runs/<run>/run-manifest.json --prereg all-data --out export/
```

Isinasagawa ng `preflight run` ang mga pagsusuring ginagawa ng `run` bago magsanay — ang dev set, ang leak audit ng bawat training file, ang decode length — kaya ang isang run na naipasa nito ay hindi tatanggi sa simula. Binabasa ng `config.json` ang split mula sa `data/split/`; sinasabi ng split na nakasulat sa ibang lugar kung aling mga linya ang dapat baguhin.

Inilalagay ang mga pares sa pagsasanay sa isang TSV tulad ng test set (o JSONL na may `source` at `target`); inalis ng `leak-audit` (hakbang 2) ang anuman na magpapatagas ng test set sa pagsasanay at ipinaliwanag ang bawat isa. Dalawang modelo? Pagkatapos ng split, patakbuhin muli ang twin-free leak-audit mula sa hakbang 2 (dahil nakarehistro ang dev set, aalis din ang mga row nito sa twin-free file), pagkatapos ay `nmt-forge run config-notwins.json` at
export it to its own folder with `--prereg notwins`. `nmt-forge status` names
ang susunod na command sa anumang punto. Nagsasanay ang default na modelo sa isang CPU sa loob ng ilang minuto; sa 1–2 libong pares ng pangungusap, asahan ang chrF++ sa bandang 5–30 — natututunan nito ang mga parirala at pattern ng inyong data, hindi ang wika sa pangkalahatan. Minamarkahan ng `export` ang test set nang isang beses at nagsusulat ng isang mt-eval report, kaya maihahambing ang sinanay na modelo sa lahat ng mula sa hakbang 3. Buong walk-through: [Sanayin ang Inyong Unang Modelo](/docs/network/getting-started/train-your-first-model).

**Agent:** `forge_status { "project_dir": "<dir>" }` muna at pagkatapos ng bawat hakbang; pagkatapos ng `forge_init`, `forge_register_eval`, `forge_leak_audit`, at `forge_prereg` ng hakbang 2: `forge_split { corpus, test, seed, out }`, `forge_preflight { "target": "run" }`, pagkatapos — kasunod ng `nmt-forge run` sa isang terminal — `forge_export { run_manifest, out, prereg }`. Tawagan ang `get_training_guardrails` nang isang beses bago ang `forge_split`: inililista nito ang bawat panuntunang ipinapatupad ng forge at ang pagkakamaling pinipigilan ng panuntunan. Tumatanggap ang `register` ng `forge_split` ng prefix o `true` (`project`), at nagde-default ang `out` sa `data/split`. Bawat forge tool pagkatapos ng `forge_init` ay tumatanggap ng `project_dir` na ibinabalik nito. Ipinaliliwanag ng `get_training_guardrails` (opsyonal ang `topic`) ang bawat panuntunan. Bawat argumento ng bawat tool:
[MCP Server](/docs/network/getting-started/mcp-server#arguments).

## 5. Patunayan ito — nang pribado, o sa publiko

Sa inyo ang inyong mga marka. Walang inilalathala maliban kung pipiliin ninyo.

```bash
mt-eval publish results/<run-id>_report.json --dry-run   # shows exactly what would leave, and what is withheld
mt-eval publish results/<run-id>_report.json --scores-only --prod
```

Ang isang pribado o local-only na test set ay hindi kailanman nag-a-upload ng mga pangungusap nito; isinasaad ito ng `--dry-run` sa bawat linya. Upang hayaan ang iba na makipagkumpetensya sa inyong test set nang hindi ito nakikita kailanman, magpatakbo ng paligsahan sa isang makinang kontrolado ninyo: ipinapasa ng mga kalahok ang kanilang pamamaraan, tatakbo ito sa inyong node, at mga marka lamang ang lalabas. Itinatago ng mga bagong paligsahan ang lahat ng marka hanggang sa magsara ang paligsahan, upang walang sinumang makapag-tune laban sa inyong test set. Tingnan ang [Magpatakbo ng Sovereign na Paligsahan](/docs/network/sovereignty/run-a-sovereign-contest). Upang ipasok ang isang modelong sinanay ninyo sa paligsahan ng iba, pinapangalanan ng `DEPLOY.md` §6 sa export nito ang mga file na bumubuo sa entry at ang eksaktong command na `mt-eval contest submit-model`.

**Agent:** `list_contests { "language": "<code>" }`, `get_contest { id }`; `get_results { "target_language": "<code>" }` at `get_run_card { id }` para sa pampublikong board.

## 6. Pagsamahin ang pinakamahusay

**Pumili muna sa sarili ninyong mga pagsukat.** Ang lahat ng minarkahan ninyo sa inyong test set ay isang ulat ng mt-eval: ang mga baseline at coached run mula sa mga hakbang 3 at 4 at ang export ng bawat sinanay na modelo (`evaluation/runlog_report.json` sa export folder). A terminal run with `-o results` writes to
`results/*_report.json` nito; ang isang run na sinimulan gamit ang MCP na `run_benchmark` ay nagsusulat sa tabi ng test file, sa `data/results/mcp-run-<id>/`). Ihambing ang lahat ng ito nang sabay-sabay — ang unang glob para sa mga terminal run, ang pangalawa para sa mga agent run (gamitin ang tumutugma sa inyong mga run; humihinto ang zsh sa glob na walang tinutugmaang anuman):

```bash
mt-eval compare results/*_report.json school-crk/export*/evaluation/runlog_report.json --significance
mt-eval compare data/results/mcp-run-*/*_report.json school-crk/export*/evaluation/runlog_report.json --significance
```

Ang pagkakaibang nasa loob ng mga confidence interval ay hindi isang ranking, at ang isang sinanay na modelo na ang mga pansubok na row ay may mga near-twin sa datos ng pagsasanay nito ay nagmarka sa recall: banggitin ang twin-free na numero nito sa tabi nito (sinasabi ng DEPLOY.md at `nmt-forge report` kung alin), kasama ang anumang **score caveat** na inilagay ng mt-eval sa numerong iyon. Ang babalang *near-constant output* (isa sa iilang pangungusap na ibinigay sa maraming magkakaibang pansubok na pangungusap) ay nangangahulugang hindi sumusunod ang mga output sa mga input, anuman ang marka; ipiniprint ito ng forge sa tabi ng marka sa `export`, `DEPLOY.md`, `status`, `report`, `compare`, at `lint`. Kapag may ilang na-export na modelo, inililista ng `nmt-forge status` ang bawat isa kasama ang marka nito, twin-free na marka, at babala, at hinihiling sa inyo na pumili kung alin ang ide-deploy. Itala ang pagpili gamit ang `nmt-forge choose <export>/model` (o `nmt-forge serve <export>/model --choose`). Ang pag-serve ng isang modelo upang subukan ito ay naitatala bilang served, hindi bilang inyong pinili, kaya patuloy na magtatanong ang `status` hanggang sa kayo ay pumili.

**Agent:** `forge_status { "project_dir": "<dir>" }` — sa estadong `choose-export`, ipakita sa user ang `result.advice.exports`, ang marka ng bawat export kasama ang `score_caveats` nito, at itanong kung aling modelo ang ide-deploy; naitatala ang sagot ng user gamit ang `nmt-forge choose` sa isang terminal. Ang isang pansamantalang pag-serve ay hindi sumasagot sa tanong. Pinaghahambing (A/B) ng `forge_compare { eval_set, hyps_a, hyps_b }` ang dalawang forge model kasama ang babala sa near-twin ng bawat isa at ang mga babala sa marka ng mt-eval sa tabi ng nagwagi; ang hypotheses file ng bawat modelo ay ang `hypotheses` path na ibinabalik ng `forge_export` (`<export>/evaluation/battery-hyps.jsonl`).

Pagkatapos ay tumingin lampas sa sarili ninyong mga run. Iba't ibang pamamaraan ang nagwawagi para sa iba't ibang pares at iba't ibang uri ng teksto. Inililista ng [Network](/docs/network/) ang mga pamamaraan at serbisyong umiiral at ang ebidensya para sa bawat isa — kung ano ang nailathala, hindi ang inyong sinukat:

```bash
champollion network recommend eng crk               # runnable methods + cited evidence for the pair
champollion network leaderboard --pair "eng>crk"     # published results for the pair
```

Ang isang pamamaraang nailathala sa leaderboard kasama ang configuration nito ay maaaring i-install nang eksakto kung paano ito minarkahan: idinadagdag ito ng `champollion network leaderboard --install <method> --apply` sa inyong proyekto para sa pares na iyon. Kino-configure ng CLI ang isang pamamaraan **bawat pares ng wika**, kaya ang Cree ng newsletter ay maaaring gumamit ng inyong sinanay na modelo habang ang French ay gumagamit ng isang hosted na modelo. Ang pagkakawing-kawing ng mga pamamaraan (hal. isang modelo na sinusundan ng isang checker) ay tinatalakay sa [mga nakakawing na modelo](/docs/network/tutorials/chained-models).

## 7. Gamitin ito

I-deploy ang pamamaraang inyong sinukat — hindi ang iba.

```bash
nmt-forge serve export/model                     # your trained model on http://127.0.0.1:8378
LOCAL_API_BASE=http://127.0.0.1:8378/v1 champollion sync --method local
```

Habang tumatakbo ito, sinasabi ng `nmt-forge status` ang `serving` (sinusuri nito kung sumasagot pa rin ang server); pagkatapos huminto ng server, pinapangalanan nitong muli ang command na `serve`, sa parehong port.

O, para sa isang coached na hosted model, itakda ito sa pares sa `champollion.config.json`. Alinman sa dalawa:

```bash
champollion init --langs crk     # detects your app's locale files
champollion sync                 # translates only what changed
champollion verify               # placeholders, scripts, key parity
```

**Ang hindi pa kayang gawin ng sarili ninyong modelo.** Ang isang maliit na modelong sinanay sa ilang libong pangungusap ay natututunan ang kanilang mga parirala. Madalas nitong nasisira ang mga placeholder (`{name}`), mga anyong maramihan, at markup, o ginagawang pangungusap ang isang maikling label tulad ng "Home". Tinatanggihan ng quality gate ang mga output na iyon; walang nasirang isinusulat. Bigyan ang pares ng isang **fallback**, at mapupunta ang mga string na iyon sa pangalawang pamamaraan sa parehong sync:

```json
"pairs": {
  "en:crk": {
    "method": "api",
    "endpoint": "http://127.0.0.1:8378/translate",
    "fallback": { "method": "llm-coached", "model": "google/gemini-3.8-flash" }
  }
}
```

Kung walang teksto ang maaaring lumabas sa inyong mga makina, gawing isang modelong pinapatakbo rin doon ang fallback: nagpapadala ang `"fallback": { "method": "local", "model": "<your local model>" }` sa isang OpenAI-compatible na server sa makinang ito (Ollama, llama.cpp, vLLM), sa $0 na gastos sa API. Ang isang hosted model ay karaniwang ang mas matatag na pangalawang opinyon; gamitin ito kapag maaaring ipadala ang teksto sa provider nito.

Isinasalin ng inyong modelo ang lahat ng kaya nito. Nakukuha lamang ng fallback ang tinanggihan ng gate mula rito, at ang mga Markdown block na naalis o nasira nito, at dumadaan ang output nito sa parehong gate. Nagpi-print ang `sync` ng linyang `[FALLBACK]` bawat pares na may mga bilang, at inililista ng `champollion verify` ang anuman na hindi naisalin ng alinmang pamamaraan. Tingnan ang [Paraan ng fallback](/docs/getting-started/configuration#fallback).

Para sa isahang pagkakataon sa halip, isalin lamang ang mga string na iyon sa ibang paraan:

```bash
champollion sync --method llm-coached --redo keys:nav.home,greeting
```

…o mano-mano, o sa pamamagitan ng isang reviewer gamit ang `champollion xliff export`. At ilagay ang sariling mga string ng app sa inyong test set: ang isang modelong may mataas na marka sa mga pangungusap ng guro ay maaari pa ring magkamali sa "Saan ang masakit?".

**Mga sistema ng pagsulat.** Kung ang wika ay isinusulat sa higit sa isang script (Plains Cree: Standard Roman Orthography at syllabics), hihilingin sa inyo ng CLI na pumili bago ito magsalin. Itakda ang `"script"` para sa wikang iyon sa config; inililista ng mensahe ang mga opsyon.

Ang translation memory ay nangangahulugang ang isang hindi nagbagong pangungusap ay hindi kailanman binabayaran nang dalawang beses, at ang pagpapalit ng mga modelo ay hindi muling nagsasalin sa lahat. Ikonekta ito sa CI gamit ang [Gabay sa CI/CD](/docs/guides/ci-cd). Nasa `export/model/DEPLOY.md` (mula sa hakbang 4) ang eksaktong configuration para sa isang sinanay na modelo, kabilang ang pamamaraang `api` at kung paano ito ilantad sa isang network nang ligtas.

**Agent:** Pinapatakbo ng `translate { texts, source_language, target_language }` ang mga string sa parehong pipeline. Idagdag ang `method: "local"` at `base_url`, o `method: "api"` at `endpoint`, para sa isang modelong kayo mismo ang nagse-serve, at `script` para sa isang wikang isinusulat sa higit sa isang script.

## Mga desisyon sa proseso

| Desisyon | Piliin ang… | Kailan |
|---|---|---|
| Kung saan nakalagay ang test set | local-only | Sensitibo ito, o hindi pa ninyo natatanong ang mga taong sumulat nito |
| | private / sealed | Nais ninyong malaman ng iba na umiiral ito, o makipagkumpetensya dito, nang hindi ito nakikita |
| Mag-coach o magsanay | Mag-coach ng hosted model | Mayroon kayong talasalitaan at kaunting parallel text, at katanggap-tanggap ang mga panlabas na serbisyo |
| | Magsanay gamit ang forge | Mayroon kayong ilang libong pares o higit pa, o dapat manatili ang data sa inyong mga makina |
| Maglathala | Mga marka lamang | Default para sa anumang hindi kayo mismo ang sumulat |
| | Wala | Laging pinapayagan — kapaki-pakinabang ang pagsukat nang pribado |

## Magkano ang aabutin nito

- Libre ang mga tool para sa di-komersyal na paggamit: saklaw ang isang paaralan, isang pampublikong ospital o klinika, isang charity, o isang proyektong pampananaliksik (ang CLI, nmt-forge, at ang MCP server ay PolyForm Noncommercial 1.0.0; ang evaluation harness ay open source, AGPL-3.0-or-later). [Sino ang maaaring gumamit nito](/docs/getting-started/who-may-use-this).
- Ang gastos sa hosted model ay kung magkano ang sinisingil ng provider nito; pinapahinto ng `--max-cost` ang isang run bago ito gumastos nang higit sa inyong pinahihintulutan, at ipinapakita ng ulat ang gastos bawat pangungusap. Walang anumang gastos ang isang lokal na modelo maliban sa oras ng inyong makina.
- Ang pagsasanay sa default na forge model ay nangangailangan lamang ng CPU at ilang minuto; ang mas malalaking preset ay nangangailangan ng GPU.
