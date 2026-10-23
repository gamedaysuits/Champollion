---
title: "Pagpapatakbo sa rails mula sa shell"
slug: /agents/shell
description: "Bawat hakbang sa rails bilang isang karaniwang command: mag-install, magsimula ng proyekto, magpasok ng data, itala ang mga termino nito, magsanay at sumubok ng modelo gamit ang nmt-forge, patakbuhin ang mga round ng pagpapahusay, magsalin at mag-serve gamit ang mt-eval — kasama ang offline mode, ang mga environment variable na binabasa ng mga tool, at ang mga exit code."
---

# Pagpapatakbo sa mga riles mula sa shell

Bawat hakbang sa mga riles ay isang karaniwang command. Ang isang agent na walang MCP — o ang isang
tao sa terminal — ay dumaraan sa parehong mga riles gamit ang tatlong programa:
`champollion`, `nmt-forge` at `mt-eval`. Hindi kailanman kailangang isaulo
ang pagkakasunod-sunod: tinutukoy ng `champollion next` ang susunod na hakbang, kasama ang mode nito at ang
eksaktong command, na binasa mula sa mga file ng proyekto.

Ang mga patakaran ay pareho sa MCP. Ang hakbang na `confirm` ay tatakbo lamang pagkatapos
pumayag ang tao; ang mga sagot sa hakbang na `ask_user` ay sa kanila
([ang kontrata](/docs/agents/contract)).

## I-install

```bash
npm install -g champollion                  # Node.js 20.11 or newer
uv tool install --python 3.12 nmt-forge     # brings mt-eval (mt-eval-harness) with it
```

**Paalala.** Parehong nagda-download ng mga package ang dalawa: mode na `confirm` — magtanong muna. Kung
mabigo ang `uv --version`, ii-install ng tao ang uv mula sa https://docs.astral.sh/uv/;
hindi nagda-download ng mga installer ang isang agent. Nangangailangan din ang pagsasanay ng training
extra ng forge (PyTorch at Hugging Face transformers, ilang daang MB). Tinutukoy ito ng forge
kapag nawawala ito (estado `needs-training-extra`):

```bash
uv tool install --reinstall --python 3.12 'nmt-forge[hf]'
```

Kailangan ng mga riles ang `nmt-forge` 0.3.0 o mas bago; ang mas lumang bersyon ay tutukuyin kasama ang
command sa pag-upgrade nito (`uv tool install --upgrade --python 3.12 nmt-forge`).

## Ang loop

```bash
champollion next              # the next step: what to say, why, the command, how to take it
champollion next --json       # the same, for a program (see the rails model page for the shape)
champollion next --write      # also rewrite NEXT.md, the person's copy
```

Ang `How:` sa output para sa tao ay ang mode: `run it` (`auto`), `magtanong muna, bago
patakbuhin ito` (`confirm`), `itanong sa taong may hawak ng data — huwag kailanman sagutin para
sa kanila` (`ask_user`), `maghintay, pagkatapos ay magtanong muli` (`wait`), `isang tao ang gumagawa nito`
(`human_only`). Patakbuhin ang command na tinukoy nito, pagkatapos ay magtanong muli. Ayos lang ang
paglabas sa mga riles — magpatakbo ng anumang pampakarubhasang command, pagkatapos ay `champollion next`: ang susunod na hakbang
ay binabasa mula sa mga file.

## Simulan

```bash
champollion new family --from English --to qaa --target-name "Our language" --dry
champollion new family --from English --to qaa --target-name "Our language" --purpose "notes for the grandchildren"
cd family
```

Ang mga wika ay mga code o mga pangalan, na tinutukoy sa pamamagitan ng mga language card. Ang isang barayti
na walang code ay gumagamit ng private-use code (`qaa`–`qtz`) at ng pangalang ibinigay
ng mga tao nito (`--target-name`, `--source-name`). **Paalala.** Sabihing muli ang direksyon
bago gawin ang proyekto: tinutukoy ng `--dry` ang parehong wika at wala itong
isinusulat. Ipasa ang bawat wika nang eksakto kung paano ito pinangalanan ng tao.

## Tipunin at itala ang mga tuntunin

```bash
champollion data add ../family-files/grandpa.xlsx                     # pairs → data/parallel/
champollion data add ../family-files/grandpa.xlsx --source-col A --target-col B --header
champollion data add ../family-files/words.lift --into lexicon        # a word list → data/lexicon/
champollion data add ../family-files/recording.eaf --source-col <number> --target-col <number>   # ELAN: tier numbers
```

Binabasa ng `data add` ang `.xlsx`, `.ods`, `.csv`, `.tsv`, `.txt`, mga talahanayan
ng Word `.docx`, mga diksiyonaryo ng Toolbox at LIFT, ELAN `.eaf` at USFM
(`--usfm-source`). Isinusulat nito ang `<stem>.tsv` at ang sidecar nito, hindi binabago ang orihinal,
at ipinapakita ang mga bilang, column at ang mga numero ng hilera na tinutukoy ng pagsusuri nito sa
mga hilera (mga kopya, pag-uulit, kakaibang haba, nagkapalit o nausog na mga hilera — walang
inaalis) — hindi kailanman mga pangungusap. Kapag hindi nito matukoy kung aling column (o ELAN
tier, ayon sa numero, o wika ng LIFT) ang alin, tatanggi ito at magtatanong; magtanong sa
tao. Binabasa muli ng `--replace` ang parehong orihinal gamit ang iba pang mga column, habang pinapanatili
ang mga sagot ng mga may-hawak; nagdaragdag ang `--name <stem>` ng isa pang file sa ilalim ng ibang pangalan.
Tingnan ang [mga patakaran sa data](/docs/agents/data-rules#what-tools-print-and-never-print).

Pagkatapos ay ang mga tuntunin, isang file bawat pagkakataon, mula sa mga sagot ng tao:

```bash
champollion data mark data/parallel/grandpa.tsv --speakers "grandpa" --speakers-agreed yes \
  --owner "our family" --training allowed --local-only
```

Kinakailangan ang `--local-only` o `--may-leave` sa isang file na hindi pa local-only.
Nagtatanong ang hakbang sa mga tuntunin ng journey tungkol sa bawat file sa `data/parallel/`,
`data/lexicon/`, `data/grammar/` at `data/monolingual/` hanggang sa maitala ang parehong
sagot nito sa pagsasanay at ang `--speakers-agreed`. Bawat halaga ay sa mga
may-hawak — tingnan ang [mga patakaran sa data](/docs/agents/data-rules) para sa kung ano ang ginagawa ng bawat isa at
kung ano ang tinatanggihan ng command.

## Protektahan ang test set

```bash
champollion data add ../family-files/checked.tsv --into test
champollion data mark data/test/checked.tsv --role test --training not-allowed --local-only
```

## Bumuo at sumubok ng modelo

Tinutukoy ito ng journey nang sunod-sunod (ang kanilang `{placeholders}` ay pinunan mula sa
proyekto):

```bash
nmt-forge init qaa --dir . --pair eng-qaa --no-card --name "Our language" --model auto
nmt-forge registry add project-test data/test/checked.tsv --role test
champollion data combine
nmt-forge leak-audit data/parallel/combined.tsv --clean-to data/clean/combined.clean.jsonl
nmt-forge prereg new first-model --eval-set project-test --expect "<their words>" --rationale "<their reason>"
nmt-forge split data/clean/combined.clean.jsonl --test 0 --dev 50 --seed 42 --near-dupe 0.6 --max-group 26 --out data/split --register project
nmt-forge floor data/lexicon/words.tsv
```

- Pinipili ng `init --model auto` ang pinakamalakas na model na kayang sanayin ng kompyuter na ito sa loob ng ilang oras, batay sa memory nito ([pagsasanay](/docs/agents/training#models)). Kapag may language card, hindi isinasama ang `--no-card --name`.
- Gumagana lamang ang `data combine` kapag ang `data/parallel/` ay mayroong higit sa isang file. Pinapanatili nito ang pinakamahigpit na mga tuntunin ng mga file na pinagsasama nito at tinatanggihan ang isang file na hindi pa sinasagot ng mga may-ari nito — kung maaaring matuto ang isang model mula rito, at kung sumang-ayon ang bawat taong naroroon ang mga salita.
- Ang `prereg new` ay isang hakbang ng `ask_user`: ang `--expect` at `--rationale` ay ang mga salita ng mga tao, eksakto kung paano nila sinabi ang mga ito, na isinulat bago magkaroon ng anumang marka. Walang iminumungkahing numero ang tanong, at huwag din po kayong magmungkahi.
- Ang laki ng dev na inilalagay ng journey (`dev_n`) ay isa sa bawat sampu ng mga nasuring pares, hindi bababa sa 50 at hindi hihigit sa 500; kapag mas kaunti sa 200 pares, sangkapat ng mga ito ang ginagamit sa halip, upang mapanatili sa pagsasanay ang karamihan — at iyon ay mababa sa 50. Samakatuwid: 40 pangungusap sa dev mula sa 160 pares, 50 mula sa 200 hanggang 500 pares, 160 mula sa 1,600, 500 mula sa 5,000 o higit pa. Kapag mababa sa 50, walang yugto ang maaaring husgahan sa dev set ([pagsukat](/docs/agents/measurement#comparing-two-models)). Pinapanatili ng `--near-dupe 0.6` ang mga halos magkakatulad na kopya sa isang panig; ang `--max-group` ay kalahati ng laki ng dev, na ibinaba sa pinakamalapit na buong bilang, dagdag ang isa.
- Nalalapat lamang ang `floor` kapag ang `data/lexicon/` ay naglalaman ng listahan ng mga salita.

Mula rito, ang sariling tagapayo ng forge ang tumutukoy sa bawat hakbang. Ipinapasa ito ng `champollion next`;
direkta itong sinasabi ng `nmt-forge status`:

```bash
nmt-forge preflight run --config config.json && nmt-forge run config.json --detach
nmt-forge jobs                      # what is running
nmt-forge status                    # the next step, with what is ready and what blocks it
nmt-forge export <run-manifest.json> --prereg first-model --out export/
nmt-forge serve export/model --detach
nmt-forge tidy                      # earlier rounds' model weights nothing uses, and the space they take
```

Ang pagsasanay ay `confirm` (gumagamit ito ng compute, mula minuto hanggang oras); habang nagsasanay ang isang hiwalay na run, ang hakbang ay `wait`. Tinatanggihan ng `nmt-forge run` ang isang run na hindi kayang tanggapin ng disk bago ito magsimula (`[disk-room]`), kasama ang bakanteng espasyo, ang pagtatantya nito, at kung ano ang mapapalaya ng `nmt-forge tidy`; pinalalaya ito ng `nmt-forge tidy --yes`, at ang `--skip-disk-check` sa `run` ay magsisimula pa rin, na itinatala sa run. Ang dalawang iyon ay pasya ng tao, hindi sa inyo ([pagsasanay](/docs/agents/training#disk-space)). Minamarkahan ng export ang model nang isang beses sa test set, laban sa prediksiyon. Nasa tao ang pagpili mula sa ilang export (`nmt-forge choose <model folder>`). Pagkatapos ng marka sa test-set, hinuhusgahan ng mga tao ang kanilang prediksiyon:

```bash
nmt-forge prereg verdict first-model --prediction 1 --held --by "grandma"
```

(`--missed` kapag hindi ito nagkatotoo; ang `--prediction` ay ang numero ng hula,
1 para sa iisang `--expect`; tinutukoy ng `--by` kung sino ang humatol nito, ayon sa sinabi nila.) Tingnan ang
[pagsasanay](/docs/agents/training) para sa bawat command at pagtanggi ng forge.

## Ang mga yugto ng pagpapabuti

Kapag nai-serve na ang isang modelo, magsisimula ang mga yugto:

```bash
champollion improve time --per-week "about 30 sentences" --total "maybe 800"
champollion improve wishlist        # improve/round-<k>/wishlist.md, a printable sheet
# the people write 20 or more sentences in improve/round-<k>/to-translate.txt
champollion improve sheet           # the model in use drafts them → improve/round-<k>/review.csv
# the speaker marks the Right? column: Y, N (and how it is said), or ?
champollion improve marks           # counts the marks; fixes and confirmed drafts become pairs
champollion improve report          # the round's report
champollion improve prepare         # grows the dev set, screens, points config.json at the round's file, plans the training
nmt-forge preflight run --config config.json && nmt-forge run config.json --detach
champollion improve status          # the rounds so far: marks, and each verdict in the round report's words
```

- `improve sheet`: habang ang dev (pagsasanay) na set ay wala pang 200 pangungusap, ang ilang
  hanay ay walang draft — isa sa bawat dalawa habang ito ay wala pang 50, isa sa bawat apat mula 50
  — at ang tagapagsalita ang sumusulat ng mga ito. Isinusulat ang mga ito ng `improve marks` sa `data/dev/`
  at idinaragdag ang mga ito ng `improve prepare` sa dev set (`nmt-forge grow-dev`),
  hindi kailanman sa pagsasanay. Pinatatakbo rin nito ang `nmt-forge draft-newer`. Kapag may
  isa pang modelo — ang pinakabagong sinanay kapag hindi ito ginagamit (hindi ginamit
  pagkatapos ng round nito: kakaunti para masabi, walang masusukat na pagbabago, o mas malala), o,
  pagkatapos ng promosyon, ang modelong pinalitan ng kasalukuyang ginagamit — nagda-draft
  ang modelong iyon ng random na kalahati ng mga na-draft na hanay, nang walang marka, at ang
  susi ay nananatili sa tabi ng sheet (`sheet-key.json`). Binibilang naman ng `improve marks` ang
  bawat modelo nang magkahiwalay — ang blind comparison, na pagkatapos ng isang promosyon ay siyang
  pagsusuring kailangan ng ulat bago nito tawaging tunay na pag-usad ang isang pagtaas
  ([pagsukat](/docs/agents/measurement#the-speakers-marks)).
- `improve sheet`, mula sa round 2: isang hanay para sa bawat 10 bagong pangungusap
  (pababang ini-round) ay isang draft na minarkahan ng tagapagsalita na `Y` o `N` sa isang naunang
  sheet, na ibinalik nang walang marka sa isang random na puwesto. Sinasabi sa unang linya ng sheet na may ilang
  hanay na sadyang ibinabalik, hindi kailanman kung alin; itinatala ang mga ito ng `sheet-key.json`
  (`repeat_rows`). Inilalabas ng command kung ilan ang naibalik, *"(kung alin ay
  hindi minarkahan)"*, at na ang mga ito ay tumatagal nang *"humigit-kumulang 10 segundo bawat hanay, hindi na muling
  sasanayin"*.
- Hinahatulan ng `improve marks` ang isang hanay na muling ipinakita laban lamang sa naunang
  marka ng tagapagsalita — hindi kailanman sa bahagi ng round, sa mga pares ng pagsasanay o sa
  blind comparison — isinusulat ang `repeats` sa `marks.json`, at inilalabas ang *"Mga hanay
  na muling ipinakita: minarkahan ng tagapagsalita ang A ng J sa paraang katulad ng dati (P%) — W
  dating mali ngayon ay tama, R dating tama ngayon ay mali. Hindi ibinilang sa bahagi ng round
  na ito, at hindi na muling sasanayin."*
- Ang `improve marks`, kapag ang kabilang modelo ang mas bago at hinatulan ng tagapagsalita
  ang kahit isang draft ng bawat isa, ay nagtatala ng mga bilang gamit ang forge (mga bilang
  lamang, hindi kailanman isang pangungusap):

  ```bash
  nmt-forge speaker-verdict --newer <run> --in-use <run> --newer-right <n> --newer-judged <n> --in-use-right <n> --in-use-judged <n> --json
  ```

  Kapag minarkahan ng tagapagsalita ang mas bagong model bilang tama nang mas madalas, ipinapakita nito ang *"naitala ito ng forge: nag-aalok itong gamitin ang mas bagong model (pumapayag muna ang mga tao)"*; kapag hindi naka-install ang forge o tumanggi ito, sinasabi nitong hindi naitala ang mga marka, at kung bakit.
- Nagtatapos ang `improve prepare` sa `nmt-forge round-plan`: nagpapatuloy ang yugto mula sa model na ginagamit (4 na beses sa lahat ng mga pangungusap sa ngayon) o nagsasanay mula sa simula, at sinasabi kung bakit ([pagsasanay](/docs/agents/training#the-improve-rounds)).

Hahatulan naman ng Forge ang bagong modelo laban sa kasalukuyang ginagamit
(`nmt-forge compare-runs <in-use run-manifest.json> <new run-manifest.json>`,
`auto`), at mag-aalok na gamitin ito (`confirm`) kung ito ay mas mahusay lamang
nang masusukat — o, kung saan ang hatol ay masyadong kakaunti upang matukoy (mas mababa sa 50 dev sentence)
o walang masusukat na pagbabago, kapag malinaw itong mas pinili ng mga blind mark ng tagapagsalita.
Walang ipinapagamit ang hatol lamang: tanging ang pagsang-ayon ng mga tao (ang
`nmt-forge export` at `nmt-forge choose` ng hakbang na iyon) ang gumagawa nito. Ang mga bagong pares mula sa `improve marks` ay unang magkakaroon ng sarili nilang mga termino — nagtatanong
ang paglalakbay. Paano ihatid ang ulat: [coaching](/docs/agents/coaching).

## Magsalin at mag-serve gamit ang mt-eval

Ang `nmt-forge export` sa loob ng isang proyekto ay nagsusulat ng `deploy/<name>.json` (deployment/1).
Ang parehong file ay sumusukat, nagsasalin, at nagse-serve:

```bash
mt-eval translate --deployment deploy/<name>.json --source-file <input file> --out <output file>
mt-eval serve --deployment deploy/<name>.json      # http://127.0.0.1:8379 by default
mt-eval run --deployment deploy/<name>.json --corpus <dev or test file>
```

- **Paalala.** Ang `mt-eval run` sa isang test file ay hindi nangangailangan ng paunang pagpaparehistro — itinatala lamang
  nito ang pagbasa. Markahan ang test set sa pamamagitan ng `nmt-forge export` (o pagkatapos maisulat
  ang hula), huwag bago nito.
- Nagdaragdag ang `--gates gates/<chain>.json` ng gate chain sa `run`, `translate` o
  `serve` (nang walang `--deployment`); tinatanggihan ng `run` at `test` ang isang chain na nagfo-fallback. Tingnan ang [mga pamamaraan at gate](/docs/agents/methods) at
  [pag-serve](/docs/agents/serving).

## Sa labas ng mga riles: kung ano ang mayroon para sa isang wika

```bash
champollion network card <code>                    # the cited language card
champollion network recommend <source> <target>    # methods that can run, with their evidence
mt-eval corpora --source <source> --target <target>   # registered test sets for the pair
nmt-forge discover <code>                          # what a training project can use
```

## Suriin at i-upgrade ang mga file

```bash
champollion validate        # project file, sidecars, method.json, gates/, deploy/ — 0 ok, 1 invalid, 2 usage
champollion upgrade --dry   # what upgrading older sidecars to set/1 would change; drop --dry to write
```

## Offline

Pinipigilan ng `CHAMPOLLION_OFFLINE=1` ang `champollion` CLI sa pag-access sa network:
ang mga language card ay magmumula lamang sa kasamang set at sa lokal na cache (hindi
kinukuha ang isang long-tail card), nilalaktawan ang araw-araw na pag-refresh ng cache ng card, at
hindi inihahambing ng `register-corpus` ang hash ng file sa pampublikong katalogo
(itinatala nito ang paghahambing bilang hindi ginawa). Hindi nito binabago kung ano ang ipinapadala
ng isang pamamaraan: ang isang pamamaraang tumatawag sa provider ay nangangailangan pa rin ng network, at
nalalapat pa rin ang mga patakaran sa pagpapadala.

Pinipigilan ng `MT_EVAL_NO_REMOTE_REGISTRY=1` ang `mt-eval` sa pagkuha ng dataset registry nito
mula sa web (para sa isang air-gapped na makina).

Ang mga nangangailangan pa rin ng network sa mga riles kahit ano pa man: pag-install ng mga tool, ang
training extra, at ang unang pag-download ng pretrained model (`byt5-small` o
`byt5-small-lowmem`, humigit-kumulang 1.2 GB; walang dina-download ang `cpu-tiny`).

## Mga environment variable

Binabasa ng code, para sa isang operator. Ang mga API key ng provider ay kailangan lamang ng
mga pamamaraang tumatawag sa provider, hindi kailanman sa default na landas ng mga riles.

| Variable | Binabasa ng | Epekto |
|---|---|---|
| `CHAMPOLLION_MCP_PROFILE` | MCP server | `rails` (default) o `full` |
| `CHAMPOLLION_CLI_BIN` | MCP server | Ang `champollion` entry point na patatakbuhin |
| `NMT_FORGE_BIN` | `champollion`, MCP server | Ang `nmt-forge` executable |
| `UV_TOOL_BIN_DIR` | `champollion`, MCP server | Kung saan hahanapin ang `nmt-forge` at `uv` pagkatapos ng `PATH` (default `~/.local/bin`) |
| `CHAMPOLLION_OFFLINE` | `champollion` | `1`: walang network para sa mga card o paghahanap sa katalogo |
| `CHAMPOLLION_CARDS_CACHE_DIR` | `champollion` | Ang card cache bawat user (default `~/.champollion/cards`) |
| `CHAMPOLLION_CARDS_TTL_HOURS` | `champollion` | Gaano kadalas sinusuri ang card cache para sa mga update (default 24) |
| `NMT_FORGE_AUTO_PRESET` | `nmt-forge init --model auto` | Ipinipirmi ang preset na pinipili ng `auto` (dapat ay pangalan ng preset) |
| `NMT_FORGE_SERVE_PORT` | `nmt-forge serve` | Default na port (8378 kung wala ito) |
| `NMT_FORGE_SERVE_TOKEN` | `nmt-forge serve` | Ang bearer token; kailangan sa labas ng loopback |
| `NMT_FORGE_NO_MONITOR` | `nmt-forge run` | `1`: walang live training panel |
| `MT_EVAL_SERVE_TOKEN` | `mt-eval serve` | Ang bearer token (hindi kailanman halaga sa command-line) |
| `CHAMPOLLION_SERVE_TOKEN` | `champollion serve` | Ang bearer token para sa sariling server ng CLI |
| `MT_EVAL_NO_REMOTE_REGISTRY` | `mt-eval` | `1`: walang pagkuha ng registry |
| `MT_EVAL_DATA_ROOT` | `mt-eval` | Kung saan unang nilulutas ang mga path ng mga nakarehistrong dataset |
| `OPENROUTER_API_KEY` | `champollion`, `mt-eval` | Ang key ng default na hosted-model provider |

## Output para sa mga programa

| Tool | Output para sa makina | Mga exit code |
|---|---|---|
| `champollion` | `--json` sa mga command ng mga riles (`new`, `next`, `data add`, `data mark`, `data combine`, `improve report`, `improve status`, `connect`, `upgrade`) | 0 ok · 1 tinanggihan · 2 paggamit |
| `nmt-forge` | `--json` sa bawat subcommand: isang JSON document sa stdout, lahat ng iba pa sa stderr | 0 ok · 2 tinanggihan (`{"error": …}`) |
| `mt-eval` | `--json` at `--non-interactive` sa bawat subcommand | 0 ok · hindi zero kapag tinanggihan |

Mga anyo ng pagtanggi: [ang modelo ng mga riles](/docs/agents/rails-model#refusal-shapes).

## Magbasa pa

- [Ang sanggunian sa command ng `champollion`](/docs/reference/cli),
  [`nmt-forge`](/docs/network/getting-started/forge-command-reference) at
  [`mt-eval`](/docs/reference/mt-eval).
- [Ang modelo ng mga riles](/docs/agents/rails-model) — ang journey at `next --json`.
- [Pagpapatakbo sa mga riles sa MCP](/docs/agents/mcp) — ang parehong mga hakbang bilang anim na tool.
- [Pagsasanay gamit ang nmt-forge](/docs/agents/training) at
  [mga patakaran sa data](/docs/agents/data-rules).
