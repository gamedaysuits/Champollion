---
title: "Ang modelong rails"
slug: /agents/rails-model
description: "Kung paano binubuo ang isang proyekto sa rails ng Champollion: ang tree ng proyekto, ang anim na format na napatotohanan ng schema na binabasa ng bawat tool, ang nag-iisang pipeline mula sa tinanggap na input patungo sa nasukat na output, ang paglalakbay bilang data, at ang anyo ng bawat pagtanggi."
---

# Ang modelo ng rails

Ang isang proyekto sa rails ay isang folder ng mga payak na file. Ang bawat tool — ang
`champollion` CLI, `nmt-forge`, `mt-eval` at ang MCP server — ay katutubong nagbabasa sa parehong
mga file, laban sa parehong mga schema, na may parehong mga hatol. Ang susunod
na hakbang ay palaging binabasa mula sa mga file, hindi kailanman tinatandaan. (Dalawang bagay ang nasa
labas ng proyekto: binibilang ng MCP server ang mga pagkabigo ng isang hakbang para sa sarili nitong
itinatagal, at ang nmt-forge ay nagpapanatili ng isang pambuong-makinang training queue sa
`~/.nmt-forge`.) Baguhin ang isang file nang mano-mano, pagkatapos ay hingin ang susunod na hakbang, at ipapakita
ng sagot ang pagbabago.

Ang pahinang ito ang mapa. Ang mga panuntunan sa pagpapatakbo ay nasa
[ang kontrata](/docs/agents/contract); ang mga tool call ay nasa
[MCP](/docs/agents/mcp) at [ang shell](/docs/agents/shell).

## Ang mga tool

| Tool | Pag-install | Ang ginagawa nito sa rails |
|---|---|---|
| `champollion` | npm (Node 20.11+) | Nagsisimula ng mga proyekto, nagpapasok ng data, nagtatala ng mga tuntunin nito, nagpapangalan sa susunod na hakbang, nagpapatakbo ng mga improve round, nagkokonekta ng modelo sa isang app |
| `nmt-forge` | PyPI (`uv tool install --python 3.12 nmt-forge`) | Nagsasanay, nagsasala, naghahati, nagtatala ng mga hula, nag-iiskor ng mga modelo sa test set at nag-e-export ng mga ito, nagse-serve sa mga ito; nagpapanatili ng ledger |
| `mt-eval` | kasama sa `nmt-forge` (ang package na `mt-eval-harness`) | Nagpapatakbo ng pamamaraan sa isang test set, file, o kahilingan; naglalapat ng mga gate; nag-iiskor |
| `champollion-mcp-server` | npx | Pinatatakbo ang `champollion` CLI bilang mga bounded na child process; ang profile ng rails ay anim na tool |

Ang bawat tool ay tumatakbo bilang sarili nitong proseso. Pinatatakbo ng MCP server ang parehong mga utos na
itinatype ng isang tao (tinatanggihan ng `run_next_step` nito ang anumang program maliban sa
`champollion`, `nmt-forge`, at `uv tool install … nmt-forge`).

## Ang tree ng proyekto

Isinusulat ng `champollion new <folder> --from <language> --to <language>`:

```text
<folder>/
  champollion.project.json   project/1 — the decisions (kind, name, pair, purpose, defaults)
  README.md                  what goes where, for the people
  NEXT.md                    the next step, as a page (rewritten by `champollion next --write`)
  AGENTS.md                  the operating contract, for an AI agent working in the folder (an existing one is kept)
  .gitignore                 keeps data/, inbox/, consent/, models/, runs/, export*/, .forge/runs/, .champollion/ out of git
  inbox/                     files as the people have them
  data/parallel/             sentence pairs to learn from
  data/test/                 sentences a fluent speaker checked — never learned from
  data/lexicon/              word lists and dictionaries
  data/grammar/              grammar notes
  data/monolingual/          one-language text (kept; kept; not used for training)
  consent/                   notes recording who agreed to what, and when
```

Tinatanggihan nito ang isang folder na mayroon nang proyekto (exit 1) o anumang
hindi nakatagong file (exit 1), at isang `kind` maliban sa `language`: ang mga proyektong `task` at
`service` ay wala pa sa rails. Nilulutas ng `--dry` ang mga wika
at walang isinusulat.

Idinaragdag ng mga hakbang ang iba pa habang tumatakbo ang mga ito:

| Path | Isinulat ng | Nilalaman |
|---|---|---|
| `<file>.champollion.json` | `champollion data add`, `data mark`, `data combine`, `improve marks` | set/1 — ang mga termino ng file sa tabi nito |
| `data/combined-from/` | `champollion data combine` | ang mga orihinal na pinagsama ng combine (inilipat, hindi kailanman binura) |
| `data/not-for-training/` | `champollion data combine` | mga file kung saan sinabi ng mga may-hawak na walang modelong maaaring matuto mula sa mga ito |
| `.forge/` | `nmt-forge init` | ang workshop: `eval-registry.json`, `ledger.jsonl`, mga preregistration, `runs/` |
| `config.json`, `NEXT_STEPS.md` | `nmt-forge init` | ang config sa pagsasanay (isang preset ng modelo na pinalawak tungo sa hayagang mga numero) |
| `data/clean/` | `nmt-forge leak-audit --clean-to` | ang mga nasuring pares sa pagsasanay |
| `data/split/` | `nmt-forge split`, `champollion improve prepare` | ang dev set; ang training file ng bawat round |
| `data/dev/practice-round-<k>.tsv` | `champollion improve marks` | mga pangungusap na isinulat ng tagapagsalita para sa dev set — role na `dev`, lokal lamang, hindi kailanman ginamit sa pagsasanay |
| `improve/time.json` | `champollion improve time` | ang oras ng tagapagsalita, sa kanilang sariling mga salita |
| `improve/round-<k>/` | ang mga hakbang ng improve | `wishlist.md`, `to-translate.txt`, `review.csv`, `sheet-key.json` (kung aling mga hilera ang ibinalangkas ng kabilang modelo — isang mas bago na hindi ginagamit, o ang pinalitan ng isang promosyon: mga numero ng hilera, mga pangalan ng run, ang kaugnayan at ang bilang ng pares sa pagsasanay ng bawat modelo — at, mula sa round 2, `repeat_rows`: ang mga hilerang muling ipinakita, bawat `row`, `from_round`, `from_row` at ang naunang `mark`), `marks.json` (ang mga bilang, ang bahaging tama kasama ang interval nito, `blind`, at `repeats`: `shown`, `judged`, `agreed`, `agreement`, `wrong_to_right`, `right_to_wrong`, `wrong_before`, `rounds_apart_wrong_before`), `prepared.json`, `report.json` |
| `export*/` | `nmt-forge export` | isang na-export na modelo at ang method.json nito |
| `deploy/<name>.json` | `nmt-forge export` (sa loob ng isang rails project) | deployment/1 — kung ano ang naka-deploy |
| `gates/*.json` | mga tao | gate-chain/1 — mga pagsusuri sa pagitan ng output at ng inilalabas |
| `methods/<id>/method.json` | mga tao | method/1 (isinusulat din ng `nmt-forge export` sa isang folder ng modelo, `mt-eval export` at `champollion serve --emit-manifest`) |

## Ang mga format

Anim na framework schema ang nasa `shared/schemas/framework/`. Pinapangalanan ng bawat dokumento
ang schema nito sa `$schema`. Tinatanggihan ang mga hindi kilalang key; ang sarili ninyong key
ay napupunta sa ilalim ng `x-`.

| Format | `$schema` | Saan | Kung ano ito |
|---|---|---|---|
| project/1 | `https://champollion.dev/schemas/project/1.json` | `champollion.project.json` | Mga desisyon lamang: `kind`, `name`, `pair`, `purpose`, `defaults`, `created_with` |
| set/1 | `https://champollion.dev/schemas/set/1.json` | `<file>.champollion.json` | Mga tuntunin ng isang data file: `transmission`, `role`, `kind`, `pair`, `fields`, `terms`, mga field ng pagpaparehistro, `derived_from`, `holders_agreed` |
| method/1 | `https://champollion.dev/schemas/method/1.json` | `method.json` | Isang pamamaraan: `id`, `name`, `kind` at ang nag-iisang setting ng uring iyon, `pairs`, `decode`, `card`, `evidence` |
| gate-chain/1 | `https://champollion.dev/schemas/gate-chain/1.json` | `gates/*.json` | Nakaayos na mga gate ng `metric-threshold` at isang opsyonal na `fallback` |
| deployment/1 | `https://champollion.dev/schemas/deployment/1.json` | `deploy/*.json` | Isang pamamaraan, ang mga gate nito, isang pares; opsyonal na host at port ng `serve` |
| service-api/1 | `https://champollion.dev/schemas/service-api/1.json` | ang kontratang `/translate` | Mga dokumento ng request, response, error, at `/health` |

`project.defaults` — kung ano ang nakukuha ng data na idinagdag sa proyekto kapag walang nagsabi
ng iba. Isinusulat ng `champollion new` ang `{"transmission": "local-only",
"training": "ask", "share_scores": "ask"}`. The values: `transmission`
`local-only` o `ask`; `training` `allowed`, `not-allowed` o `ask`;
`share_scores` `never` o `ask`. Dahil sa `ask` humihinto ang mga tool at nagtatanong — hindi kailanman
nag-iimbento ng sagot ang rails.

Dalawa pang tala ang hindi mga framework schema ngunit bahagi ng modelo:

- **Ang forge ledger**, `.forge/ledger.jsonl`: append-only at hash-chained
  (naka-embed sa bawat entry ang hash ng nauna rito; nabibigo
  ang `nmt-forge ledger verify` sa anumang pag-edit). Itinatala nito ang mga pagpaparehistro,
  bawat pagbasa sa isang nakarehistrong set, mga preregistration, mga marka,
  mga paggamit sa sealed-set, mga override, mga hatol sa leak-audit, ang dictionary floor,
  mga pag-export, mga pagpili, mga serve, mga hatol sa round
  (`improve-compare`: `better`, `worse`, `no-change`, o `too-few` sa ilalim ng 50
  pangungusap sa dev), kung paano nagsasanay ang bawat round (`round-plan`), ang mga draft
  ng isa pang modelo para sa isang review sheet (`draft-newer`: mga pangalan ng run, `relation`, bilang
  ng training-pair ng bawat modelo at bilang ng mga draft), ang blind na hatol ng
  tagapagsalita sa isang mas bagong modelo (`improve-speaker`: mga pangalan ng run, apat na bilang, `z`,
  `clear`), mga pagbabago sa modelo (`model-change`, kabilang ang isang `not-now`) at kung ano
  ang inalis ng `nmt-forge tidy` (`tidy`: mga run at byte). Mga bilang, hash, at
  path — hindi kailanman isang pangungusap. Isa itong tamper-evident
  na bookkeeping, hindi kriptograpikong seguridad.
- **Ang run card**: kung ano ang itinatala ng `mt-eval run` para sa isang namarkahang run, at kung ano ang
  kalakip ng isang nailathalang resulta. Tingnan ang [run card spec](/docs/network/specifications/run-card).

**Lock.** Sinusuri ng `champollion validate [folder]` ang project file, bawat
sidecar, bawat `method.json` (sa root, sa `methods/*/` at
`.champollion/methods/*/`), `gates/*.json` at `deploy/*.json` laban sa mga
schema na ito. Binabasa ng harness ang parehong mga file na may parehong mga hatol. Exit 0 = walang
error, 1 = hindi wasto ang isang dokumento, 2 = error sa paggamit. Binubuksan lamang nito ang mga JSON
file na ito, hindi kailanman data file.

Muling isinusulat ng `champollion upgrade [folder]` ang mga sidecar na isinulat bago ang set/1 (walang
`$schema`) bilang set/1, na pinapanatili ang bawat halaga (ang isang key na hindi alam ng set/1 ay inililipat
sa ilalim ng `x-<key>`). Hinahayaan nitong mag-isa ang isang hindi wastong sidecar, at inililista ang mas lumang
`method.json` nang hindi binabago ito: binabasa pa rin ito ng bawat tool, bilang method/0,
nang may babala.

## Ang nag-iisang pipeline

Bawat paraan kung paano natutugunan ng isang pamamaraan ang teksto ay iisang pipeline sa evaluation engine:

1. **Tanggapin.** Binabasa ang mga tuntunin ng input (ang sidecar ng set/1, isang JSON
   envelope, ang registry entry) at ang patakaran nito sa transmission ay nilulutas at
   ipinapatupad bago isalin ang anupaman. Ang isang channel na hindi pinapahintulutan
   ng patakaran ay tinatanggihan dito (tingnan ang [mga panuntunan sa data](/docs/agents/data-rules)).
2. **Pamamaraan.** Isang pamamaraan ang nagsasalin (mga uri ng method/1: `llm`, `llm-coached`,
   `mt-api`, `local-model`, `nmt-checkpoint`, `lexicon`, `python`, `service`,
   `human`).
3. **Mga Gate.** Kung may pinangalanang gate chain, hinahatulan ang bawat segment; ang unang gate
   na tumanggi ang nagpapasya kung ano ang ilalabas (`drop`, `keep-source`, `flag`,
   `fallback`). Tingnan ang [mga pamamaraan at gate](/docs/agents/methods).
4. **Mga Output.** Isinusulat ang run log; ang mga file na hinugot mula sa isang minarkahang input ay nagdadala
   ng mga tuntunin nito sa isang sidecar sa tabi ng mga ito.
5. **Mga Sukatan.** Kapag may mga reference lamang: iniiskoran ng pangunahing sukatan kung ano ang inilabas,
   nakatabi rito ang iskor na walang gate. Tingnan ang [pagsukat](/docs/agents/measurement).

Ang mga mode ay ang parehong pipeline sa magkakaibang input:

| Mode | Utos | Input | Mga Sukatan |
|---|---|---|---|
| Sukatin | `mt-eval run` (muling nag-iiskor ang `mt-eval test` ng isang run log) | isang test o dev set | oo |
| Magsalin ng file | `mt-eval translate --out <file>` | source-only | hindi |
| Mag-serve | `mt-eval serve` | paisa-isang kahilingan | hindi |

**Ang isang deployment ay ang pipeline ng pagsukat sa source-only na input.** Sinusubukan
ang isang deployment/1 file (`mt-eval run --deployment`), pinapatakbo sa isang file
(`mt-eval translate --deployment`), at isineserve (`mt-eval serve --deployment`),
upang kung ano ang sinukat ay siya ring inilalabas. Sa pamamagitan ng `--deployment`, ang mga flag na ipinapasya
ng file (`--method`, `-m`/`--model`, `--gates`, `--target-script`) ay tinatanggihan.
Walang pinapangalanang iskor ang isang deployment: ang nasukat na bilang ay resulta ng run, na pinapanatili kasama
ng run. Tingnan ang [pag-serve](/docs/agents/serving).

## Ang paglalakbay, bilang data

Ang pagkakasunod-sunod ng trabaho ay isang file: `shared/journeys/language.json`. Ang
evaluator, `cli/lib/framework/journey.js`, ang nag-iisang mambabasa;
ang `champollion next`, ang profile ng rails sa MCP, at ang `NEXT.md` ay pare-parehong nagtatanong dito
ng iisang tanong. **Ang unang hakbang na hindi pa tapos ang susunod na hakbang.** Nagbabasa lamang ito
ng mga sidecar, ng project file, at ng registry at ledger ng forge — hindi kailanman teksto ng isang
data file — at walang pinapatakbo maliban sa `nmt-forge --version` (nakatakda sa hanggang
30 s) para sa hakbang ng pag-install at `nmt-forge status --json` (nakatakda sa hanggang 60 s)
kapag umabot na ang trabaho sa pagsasanay.

**Mga Yugto.** `start` → `gather` → `protect` → `tools` → `build` → `improve`.

Ang **isang hakbang** ay may `id`, `stage`, `mode`, mga payak na salita para sabihin sa tao
(`say`) at kung bakit ito mahalaga (`why`), at kadalasang may `command`. Mga opsyonal na field:

| Field | Kahulugan |
|---|---|
| `done_when` | Ang pagsusuri na nagsasabing tapos na ang hakbang. Kinakailangan (maliban sa isang delegating step) |
| `when` | Isang pagsusuri na dapat totoo para mailapat ang hakbang (nalalapat lamang ang dictionary floor kapag naglalaman ng file ang `data/lexicon/`) |
| `question`, `answers` | Ang tanong ng isang `ask_user` na hakbang at ang mga puwang ng sagot nito: `{"enum": [...]}` o `{"type": "string", "say": "…"}` |
| `agent`, `agent_tool` | Kung ano ang mismong ginagawa ng agent para sa hakbang ng isang tao (ipasok ang mga pinangalanang file gamit ang `add_data`) |
| `outdated` | Isang variant na ginagamit kapag natuklasan ng pagsusuri na masyadong luma ang tool |
| `delegate` | `"nmt-forge"`: ipasa sa sariling tagapayo ng forge |

Ang `{placeholders}` sa `say`, `question`, at `command` ay pinupunan mula sa project
file at sa mga nahanap na file.

Ang **mga pagsusuri** ay isang saradong set; nagtatapon ng error ang evaluator sa isang hindi kilala:
`project_valid`, `data_files`, `every_data_file_has_terms`,
`protected_test_set`, `tool_on_path` (kasama ang `min_version`), `path_exists`,
`forge_test_registered`, `single_file`, `forge_role_registered`,
`forge_ledger_event`, `screened_rows`, `lines_in_file`, `review_marked`,
`improve_prepared`, `forge_trained_on_current`.

**Mga Mode:**

| Mode | Sino ang kumikilos | Kung ano ang pinapayagan ng rails |
|---|---|---|
| `auto` | ang agent | patakbuhin ang utos |
| `confirm` | ang agent, pagkatapos ng oo | mga pag-install, pagsasanay, anupamang gumagastos o nagpa-publish; patakbuhin lamang pagkatapos sumang-ayon ang tao |
| `ask_user` | sumasagot ang tao | itanong ang `question`; ipasa ang kanilang mga sagot gamit ang mga key sa `answers`; huwag kailanman sasagot para sa kanila |
| `wait` | walang sinuman | may tumatakbo; magtanong muli mamaya |
| `human_only` | isang tao | magtipon ng mga pangungusap, markahan ang mga draft, pumili |
| `use_tool` | ang agent, gamit ang sarili nitong tool | MCP lamang: ang isang `human_only` na hakbang na may field na `agent` ay ipinapakita bilang `use_tool` na may `step.tool` |

**Delegasyon.** Sa hakbang na `forge`, itinatanong ng paglalakbay ang `nmt-forge status
--json` at kinukuha ang estado ng forge bilang hakbang. Ang mga estado ng forge ay tumutugma sa mga mode:
`training` → `wait`; `ready-to-train` at `needs-training-extra` → `confirm`;
`missing-preregistration` → `ask_user`; `choose-export` → `human_only`;
`improve-compare` → `auto`; `improve-promote` → `confirm`;
`improve-stronger-model` → `ask_user`. Anumang iba pang estado ay `auto` kapag nagpapangalan
ng utos ang forge, `human_only` kapag hindi. Tinatapos ng estadong `serving` ang
yugto ng build at nagsisimula ang yugto ng improve.

Dalawang uri ng hakbang ang nagmumula sa labas ng listahan ng mga hakbang:

- **Paghahatol sa hula.** Pagkatapos ng isang pag-export na naiskoran sa test set, naghihintay
  sa kanilang hatol ang isang hula na isinulat ng mga tao sa sarili nilang mga salita: isang
  `ask_user` na hakbang na may `answers` `verdict` (`held` o `missed`) at `by` (kung sino
  ang humatol dito), na nagpapatakbo ng `nmt-forge prereg verdict`.
- **Paghihintay sa kasunduan.** Bawat file na may sidecar na nagsasabing `speakers_agreed:
  not-yet` becomes its own `ask_user` question in `waiting`, sinasagot ng sarili
  nitong step id tuwing may sagot na ang tao. Hindi nito kailanman pinipigilan ang iba pang bahagi
  ng rails.

**Ang step id** ay `<journey step id>:<8 hex characters>` — isang hash ng hakbang
at ng napunang utos nito. Kung magbago ang proyekto, magbabago ang id, at ang isang
`run_next_step` na may lumang id ay tatanggihan (`the project changed since that
step was named`).

**Ang ibinabalik ng `champollion next --json`:** `project`, `kind`, `stage` (`n`,
`of`, `id`, `title`), `done` (mga step id), `step` (`id`, `mode`, `say`, `why`,
at kung mayroon `command`, `question`, `answers`, `agent`, `agent_tool`,
`file`, `source`), `now` (mga katotohanan ng forge — kung ano ang totoo ngayon), `waiting`,
`forge` (`state`, `blockers`, `warnings`), `finished` (kapag wala nang natitirang hakbang)
at `error`. Exit 1 kapag may error at walang hakbang.

## Mga anyo ng pagtanggi

Sinasabi ng bawat pagtanggi kung ano ang nangyari, at sinasabi ng karamihan kung bakit at ang solusyon.

| Tool | Output para sa tao | Output para sa makina | Exit |
|---|---|---|---|
| `nmt-forge` | `[guard] message`, pagkatapos ay `  why: …` at `  fix: …` | `--json`: `{"error": {"type", "guard", "message", "why", "fix", "how_to_get", "text"}}` sa stdout | 2 tinanggihan |
| `champollion` | `[ERR] message` sa stderr | `--json` kung saan sinusuportahan ito ng utos | 1 tinanggihan, 2 paggamit |
| Mga MCP rails tool | — | `{"refused": "<reason>", …}` na may `isError: true`, kasama ang retry kung mayroon (`if_it_has_no_code`, `current`, `last_output`, `question`, `answers`) | — |

Ang `type` sa error ng forge ay ang exception class (`UsageError` para sa
maling mga argument — tinatanggihan ng forge ang mga pinaikling flag sa halip na manghula). Kabilang
sa mga pangalan ng guard ng forge ang `split-guard`, `dev-fence`, `leak-audit`, `preregister`,
`eval-ledger`, `ci-scoring`, `registry`, `improve-loop` at `disk-room` (isang
training run na hindi kayang iimbak ng disk). Kapag ang isang error
ay magsisipi sana ng pangungusap mula sa isang withheld na corpus, mababasa sa pangungusap
ang `[sentence withheld]` at idinaragdag ng object ang `text_withheld`.

Ihatid ang isang pagtanggi sa payak na mga salita at sundin ang solusyon nito, o humingi muli
ng susunod na hakbang. Ang isang hakbang na dalawang beses nabigo ay hindi na muling patatakbuhin hanggang sa
magpasya ang tao ([MCP](/docs/agents/mcp#when-a-step-fails)).

## Magbasa pa

- [Ang kontrata sa pagpapatakbo](/docs/agents/contract) — ang mga panuntunan, lock, at tala.
- [Pagpapatakbo sa rails sa MCP](/docs/agents/mcp) at [mula sa shell](/docs/agents/shell).
- [Mga panuntunan sa data at transmission](/docs/agents/data-rules) — ang set/1 nang buo.
- [Mga pamamaraan at gate](/docs/agents/methods) at [pag-serve](/docs/agents/serving) — method/1, gate-chain/1, deployment/1, service-api/1.
- [Ang espesipikasyon ng run card](/docs/network/specifications/run-card) at ang
  [espesipikasyon ng harness](/docs/network/specifications/harness).
- [Sanggunian ng utos ng `mt-eval`](/docs/reference/mt-eval) at ang
  [sanggunian ng utos ng `nmt-forge`](/docs/network/getting-started/forge-command-reference).
