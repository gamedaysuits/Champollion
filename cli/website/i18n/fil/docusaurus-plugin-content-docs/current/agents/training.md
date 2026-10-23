---
title: "Pagsasanay gamit ang nmt-forge"
slug: /agents/training
description: "Kung paano nagsasanay at sumusubok ng modelo ang nmt-forge sa rails: ang mga preset ng modelo at kung ano ang pinipili ng --model auto batay sa memorya, ang binabantayang loop sa bawat command, mga limitasyon sa pag-decode at haba, mga background job at ang pila para sa paisa-isang pagsasanay, espasyo sa disk (mga naitabing checkpoint, ang pagsusuri sa disk, tidy), pag-export at pag-serve, ang mga yugto ng pagpapahusay (ang hatol sa yugto, ang hatol ng tagapagsalita) at ang alok para sa mas malakas na modelo, sintetikong data, isang napatunayang talahanayan ng sintomas → sanhi → solusyon, at ang taksonomiya ng pagkabigo."
---

# Pagsasanay gamit ang nmt-forge

Nagsasanay ang `nmt-forge` ng modelo sa mga pares ng mga mamamayan, sa loob ng mga guardrail:
tinatanggihan nito ang anumang makakasira sa resulta, at ipinapaliwanag ng bawat pagtanggi
kung ano, bakit, at ang lunas. Wala itong sariling sukatan — bawat marka ay nagmumula sa
engine ng pagsusuri (`mt-eval`), ang mismong code na nagmamarka sa lahat ng iba pa.

Sa mga riles, bihirang i-type ninyo ang mga utos na ito: binabanggit ang mga ito ng `champollion next`,
at mula sa hakbang na `forge` pataas, inihahatid nito ang sariling tagapayo ng forge
(`nmt-forge status`). Inilalarawan ng pahinang ito kung ano ang ginagawa ng mga hakbang na iyon.

## Mga modelo

Isinusulat ng `nmt-forge init --model <preset>` ang isang preset sa `config.json` bilang
mga tahasang numero (naka-hash sa pagkakakilanlan ng bawat pagsasagawa: hindi
kailanman babaguhin ng mas bagong release ng forge ang mga pagsasagawa ng umiiral na proyekto). Inililipat
ng `nmt-forge use-model <preset>` ang isang proyekto.

| Preset | Ano ito | Kinakailangan | Ang sinasabi ng forge na dapat asahan |
|---|---|---|---|
| `cpu-tiny` | Isang maliit na transformer na sinanay mula sa simula sa mga pares, na may 4,000-pirasong bokabularyo na natutuhan mula sa mga row ng pagsasanay | CPU lamang · walang pag-download | "sa ~1–2k pares: chrF++ humigit-kumulang 5–30 (ang pinakamataas ay para lamang sa datos na may matinding template) — mga saulong parirala at mga template ng inyong datos, hindi pangkalahatang pagsasalin" |
| `byt5-small` | ByT5-small ng Google (300M parameters, nagbabasa ng mga byte — walang bokabularyong kailangang ibagay), na-fine-tune | ~1.2 GB na pag-download · inirerekomenda ang Apple silicon o isang CUDA GPU | "sa sariling mga pagsubok ng forge, higit na marami itong natutuhan mula sa parehong mga pares kaysa sa cpu-tiny — sukatin pa rin ito laban sa inyong ginagamit na modelo sa inyong dev set" |
| `byt5-small-lowmem` | Ang parehong modelo, learning rate, at mga limitasyon sa haba, na isinaayos para sa kompyuter na may 8–15 GB ng memory: Adafactor, gradient checkpointing, at mga batch ng 4 na pares na naipon nang 4 na beses (ang parehong 16 na pares bawat hakbang) — mas kaunting memory bawat hakbang, mas maraming oras. Hindi pa nasusukat sa isang 8 GB na kompyuter | tulad ng `byt5-small` | tulad ng `byt5-small` |
| `cpu-finetune` | Isang maliit na pretrained na modelong Marian/opus-mt, na-fine-tune sa CPU. Kayo ang magpapangalan sa base (`--base`); hindi ito kailanman hinuhulaan | CPU lamang · ~300 MB na pag-download | "nakadepende sa kung gaano kaugnay ang target na wika ng base — sukatin ito laban sa cpu-tiny sa inyong dev set" |
| `nllb-600m` | NLLB-200 distilled 600M na may LoRA | isang CUDA GPU (8 GB+) · ~2.5 GB na pag-download | "ang pinakamalakas sa tatlo kapag saklaw ng NLLB ang isang kaugnay na wika; sukatin pa rin ito — huwag kailanman magpalagay" |

Nagsasanay ang bawat preset gamit ang training extra ng forge (`nmt-forge[hf]`), na may seed 42.
Walang preset na nagtatakda ng nakalaang oras: ang bilang na iyon ay nasa pagpapasya ng mga mamamayan.

- **Kung walang `--model`**, isinusulat ng `init` ang `cpu-tiny`.
- **`--model auto`** (ang ipinapasa ng mga riles) ay nagbabasa ng memory ng GPU na
  mapagsasanayan ng forge — sa isang Mac na may Apple silicon, ang memory ng kompyuter (nakabahagi
  sa GPU); gamit ang `nvidia-smi` sa `PATH`, ang memory ng pinakamalaking NVIDIA card:
  16 GB o higit pa (o memory na hindi nito mabasa) → `byt5-small`; 8–15 GB →
  `byt5-small-lowmem`; mababa sa 8 GB → `cpu-tiny`. Kung walang GPU sa dalawa, `cpu-tiny`.
  Ang dahilan, kasama ang memory na natagpuan nito, ay ipiniprint (`chosen: …`) at ibinabalik
  bilang `model_choice` sa `--json`. Hindi nito sinusuri kung gumagana ang GPU.
  Ino-override ito ng `NMT_FORGE_AUTO_PRESET` (dapat itong magpahiwatig ng pangalan ng preset).
- **Ang mas malakas na modelong iniaalok ng mga round** ay napupunta lamang sa isang proyektong ang modelong
  ginagamit ay `cpu-tiny`: `byt5-small-lowmem` kung saan pipiliin ito ng `--model auto`,
  kung hindi ay `byt5-small` — gayundin sa isang kompyuter kung saan pipiliin ng `auto`
  ang `cpu-tiny`; binabanggit ng `why` ng alok ang kailangan nito.

**Paalala.** Huwag kailanman ilarawan ang inaasahan ng isang preset bilang isang pangako. Sukatin po ito sa
dev set.

## Ang binabantayang loop

Tumatanggap ang bawat utos ng `--json`; inilalagay ang `--workspace <dir>` (default na `.forge`)
bago ang subcommand. Tinatanggihan ng forge ang mga pinaikling flag.

| Hakbang | Utos | Ginagawa nito | Tinatanggihan nito |
|---|---|---|---|
| Workshop | `nmt-forge init <code> --dir . --pair <src>-<tgt> --model auto` | Isinusulat ang `.forge/`, `config.json`, `NEXT_STEPS.md` | Isang hindi mababasang `--pair`; `cpu-finetune` nang walang `--base` |
| Test set | `nmt-forge registry add project-test <file> --role test` | Ipinipirmi ang sha256 ng file; sinisimulan ang log ng pagbasa nito | Mga sintetikong hilera sa isang test o sealed set; isang pangalang nakarehistro na may ibang nilalaman (maliban kung `--allow-rotate`) |
| Screen | `nmt-forge leak-audit <corpus> --clean-to <clean.jsonl>` | Sinusuri ang bawat pares laban sa bawat nakarehistrong dev, test, at sealed set; nagsusulat ng malinis na kopya | Pagsulat sa ibabaw ng isang ginagamit na file (maliban kung `--overwrite`); isang resulta na walang natitirang pagsasanay |
| Predict | `nmt-forge prereg new <id> --eval-set <set> --expect "…" --rationale "…"` | Isinusulat ang prediksiyon ng mga tao bago ang anumang marka | Isang umiiral nang id; pagsusulat pagkatapos ng anumang pagbasa para sa pagmamarka ng set, ng forge o `mt-eval` (maliban kung `--allow-after-reads`, na nakasulat sa ledger) |
| Dev set | `nmt-forge split <clean.jsonl> --test 0 --dev <n> --seed 42 --near-dupe 0.6 --max-group <m> --out data/split --register project` | Isang group-disjoint na paghiwa ng dev, na nakarehistro bilang `project-dev`. Ang `<n>` ng mga rail: isa sa bawat sampu ng mga nasuring pares, hindi bababa sa 50, hindi hihigit sa 500 — sangkapat ng mga ito sa ilalim ng 200 pares ([shell](/docs/agents/shell#build-and-test-a-model)). Pinapanatili ng `--near-dupe 0.6` ang halos-magkatulad na mga kopya (pagkakapatong ng salita ≥ 0.6) sa isang panig, ang threshold na inilalapat sa pagsusuri ng bawat susunod na yugto; itinatakda ng mga rail ang `--max-group` sa kalahati ng laki ng dev dagdag ang isa, upang ang isang file na isinulat mula sa mga template ay nahahati pa rin | Isang panig na hihigit sa 1.5× ng kahilingan nito, o pagsasanay na nagpapanatili ng mas mababa sa kalahati ng mga hilera |
| Floor | `nmt-forge floor <word lists>` | Isinasalin ang dev set nang bawat salita mula sa diksiyonaryo at minamarkahan ito sa kaparehong paraan tulad ng marka sa dev ng isang run | Walang nakarehistrong dev set |
| Check | `nmt-forge preflight run --config config.json` | Pinapatakbo ang bawat gate na dadaanan ng run, kasama ang mga pag-aayos; exit 2 kapag mayroong nabigo | — |
| Pagsasanay | `nmt-forge run config.json --detach` | Nagsasanay, pinipili ang checkpoint sa dev, inaalis ang iba pang mga checkpoint ng run ([espasyo sa disk](#disk-space)), isinusulat ang `.forge/runs/<run name>-<8 hex>/` kasama ang `run-manifest.json`, `run-report.md`, `dev-outputs.jsonl` | Isang run na umiiral na (parehong config, mga file ng pagsasanay, at dev set); isang disk na walang espasyo para dito (`disk-room`, bago may maisulat; ino-override ng `--skip-disk-check`); isang run na kasalukuyang tumatakbo; mga hilera ng pagsasanay na tumatagas sa isang test o sealed set; mga hilera ng dev sa pagsasanay; datos na minarkahang huwag sanayin o naka-quarantine; `terms.training: not-allowed`; sintetikong datos na lumampas sa limitasyon nito; limitasyon sa pag-decode na masyadong maikli para sa mga sanggunian; hindi kilalang mga config key |
| Marka sa test | `nmt-forge export <run-manifest.json> --prereg <id> --out export/` | Minamarkahan ang test set nang isang beses, laban sa prediksiyon; ibinabalot ang modelo, kasama ang `input-words.json` sa tabi ng folder nito — ang mga salitang sinanay dito, upang mapangalanan ng isang server ang mga hindi pa nito nakita kailanman ([pagsisilbi](/docs/agents/serving#what-an-export-holds)) | Walang paunang rehistrasyon, o marami at walang `--prereg`; isang nagamit nang sealed set; isang hindi bakanteng `--out` na walang `--force` |
| Pagpili | `nmt-forge choose <export>/model` | Itinatala ang piniling modelo ng mga tao | Isang folder na hindi isang naitalang export na may modelo |
| Pagsisilbi | `nmt-forge serve <export>/model --detach` | Isinisilbi ito sa kompyuter na ito ([pagsisilbi](/docs/agents/serving#nmt-forge-serve)) | Hindi loopback nang walang token, o isang lokal lamang na modelo nang walang `--holders-agreed-by` |

Ang lahat ng mahalaga ay isinusulat sa hash-chained na ledger
(`.forge/ledger.jsonl`): mga rehistrasyon, mga pagbasa kalakip ang layunin ng mga ito, mga hula,
mga marka, mga paggamit ng sealed-set, mga override, mga hatol sa pag-audit, ang floor, mga export,
mga pagpili, mga pagsisilbi, at mga simula at pagtatapos ng job. Ang run manifest ang talaan ng isang
pagsasagawa.

**Mga preflight gate:** config (ipiniprint ang buong config hash), pagkakatugma ng workspace, walang
tumatakbong run, dev fence, datos ng pagsasanay, naka-install na backend, selection
plugins, mga test near-twin at dev near-twin (mga babala), audit sa pagtagas, mix ng
pagsasanay, headroom sa pagbuo, kaayusan ng iskedyul.

**Pag-decode.** Ang huling pag-decode sa dev, ang pagbasa sa test (`export`), ang isang ginagamit na modelong
nagsasalin muli sa dev set, at ang isiniserbisyong modelo ay gumagamit ng beam search na may
`decode.num_beams` (4 maliban kung iba ang sinasabi ng `config.json`); ang pagpili ng checkpoint,
na nagraranggo ng maraming checkpoint, ay nagde-decode nang greedy. Itinatala ng isang export
ang `beams_applied`, at nagde-decode ang `nmt-forge serve` sa paraang sumukat sa modelo:
ang isang mas lumang export na wala nito ay isineserve nang greedy.

**Mga limitasyon sa haba.** Natututo ang isang modelo mula sa hindi hihigit sa `model.max_src` token ng isang
pangungusap ng pinagmulan at `model.max_tgt` ng salin nito, nagbabasa ng hindi hihigit sa
`model.max_src` kapag nagsasalin ito, at nagsusulat ng hindi hihigit sa
`decode.max_new_tokens` (`byt5-small`: 320 byte bawat isa — humigit-kumulang 320 titik ng
isang Latin script, humigit-kumulang 100 ng syllabics; `cpu-tiny`: 256 piraso papasok, 384 palabas).
Walang pinuputol nang tahimik: binibilang ng pagsasanay ang mga pares na lumampas sa alinmang limitasyon bago
nito putulin ang mga ito, at binibilang ng huling dev decode ang mga pangungusap na naputol papasok at
mga saling huminto sa cap. Parehong napupunta ang mga ito sa run manifest
(`length_limits`), at nagbababala ang `status`, kasama ang lunas: hatiin ang mahahabang pangungusap, o
itaas ang `model.max_src` at `model.max_tgt` (at `decode.max_new_tokens`) sa
`config.json` — tatagal nga lamang ang pagsasanay.

**Paalala.** Hindi humihingi ang `nmt-forge run` mismo ng hula; hinihiling ito ng mga riles
bago magpatuloy. Huwag magsanay bago matapos ang hakbang ng paghula.

**Paalala.** Ang `export` ang hakbang na nagbabasa sa test set. Ang pagpapatakbo nito ay isang
mahalagang tagumpay, kung saan nakasulat na ang hula ng mga mamamayan — hindi kailanman isang karaniwang
pagsusuri.

## Mga background job

Sinisimulan ng `run --detach` at `serve --detach` ang isang pinamamahalaang job at bumabalik agad.

```bash
nmt-forge jobs                          # every job: state, stage, step, time left, last sign of life
nmt-forge jobs stop <name> --wait 120   # stop it, and wait up to 120 s (at most 180) for it to exit
```

- Mga estado: `running`, `finished`, `refused`, `crashed`, `stalled`,
  `deadline`, `interrupted`, `lost`. Ang `lost` ay isang job na nagwakas ang supervisor
  nang walang tala — kabilang pagkatapos mag-reboot, kung kailan ang process number nito ay pag-aari na
  ng ibang proseso.
- **Isang pagsasanay lamang sa bawat pagkakataon sa kompyuter na ito.** Pumipila ang mga training job
  sa buong makina, maunang dumating maunang pagsilbihan (`~/.nmt-forge/machine/train-queue`),
  sa lahat ng proyekto. Ang isang nakapilang job ay nananatiling `running`, kalakip ang `queued_behind`
  (ang job na hinihintay nito) sa `nmt-forge jobs --json`; ang `status` ay `training`
  at sinasabi kung kanino ito nakapila, at kusa itong nagsisimula. Ang paghinto habang
  naghihintay ito ay nagtatapos dito nang hindi nasisimulan (`interrupted`); ang 24-oras na paghihintay ay nagtatapos
  dito (`deadline`).
- **Mga hangganan** (mga training job): walang palatandaan ng pagtakbo sa loob ng 15 minuto sa pagsisimula
  (`--startup-minutes`); walang progreso sa mas mahaba sa 10 minuto at 30 beses
  ng median step time (`--stall-minutes`); isang deadline na `--deadline-hours`,
  kung hindi ay ang nakalaang oras sa config × 1.25, kung hindi ay 24 na oras. Ang isang job na lumampas sa hangganan ay
  ihihinto at itatala.
- **Paghinto**: humihinto ang run sa susunod nitong hakbang; nagpapasidhi ang supervisor upang
  mag-terminate pagkaraan ng 60 s at mag-kill pagkalipas ng 10 s pa.
- **Ang wall-clock gate** (mga Hugging Face backend): pagkatapos ng warm-up, kinukuha ng forge ang oras ng
  mga hakbang, tinatantya ang run, at tinatanggihan ang hindi kakasya sa nakalaang oras
  (`wall-clock budget exceeded: …`). Kung walang nakatakdang badyet ng oras, ang limitasyon ay isang 24-oras
  na kisame.
- Habang tumatakbo ang isang training job, ang `status` ay `training` at ang hakbang sa mga riles ay
  `wait`. Ang isang job na nabigo ay isang babala sa bawat susunod na status.
- **Pagpapatuloy.** Kapag ang huling training job ay nagwakas bilang `lost`, `crashed`, `stalled`
  o `deadline` pagkatapos mag-save ng isang checkpoint, binabanggit ng `status` ang `nmt-forge preflight
  run --config config.json && nmt-forge run config.json --resume --detach`:
  isang bagong run na nagsisimula mula sa huling checkpoint ng naantalang run (ang mga timbang nito,
  isang sariwang optimizer, ang natitira nitong mga epoch), at ang manifest nito ay nagsasabi kung
  saan ito nagpatuloy (`resumed_from`). Hindi ito kailanman iniaalok pagkatapos ng manu-manong paghinto.
- Ang mga detached job ay para sa POSIX lamang (macOS, Linux).

## Espasyo sa disk

Nagsusulat ng mga checkpoint ang pagsasanay: hanggang `model.save_total_limit` sa mga ito nang sabay-sabay
(4 maliban kung iba ang sinasabi ng `config.json`), mga 1.4 GB bawat isa para sa ByT5-small.
Bago ang mga panuntunang ito, nagpanatili ng humigit-kumulang 5.6 GB ang bawat yugto ng pagpapabuti ng isang proyekto ng ByT5-small,
walang nag-alis ng modelo ng naunang yugto, at pinatay ng punong disk ang isang
run habang nagse-save ito. Ang GB ng Forge ay 1024³ byte.

- **Pinapanatili lamang ng isang natapos na run ang napiling checkpoint nito.** Mawawala
  ang bawat iba pang folder na `checkpoint-*` ng run kapag napili na ang checkpoint:
  wala nang magbabasa muli sa mga ito (kinokopya ng `export` ang napili; ang susunod
  na round ay magsisimula mula sa ginagamit na modelo). Itinatala ng manifest ang `checkpoints_pruned`
  (`removed`, `bytes`, `kept`). Pinapanatili silang lahat ng `"keep_checkpoints": "all"` sa
  block na `model` ng `config.json`. Tinatanggihan ang anumang iba pang halaga kapag binasa
  ang config, bago ang anumang pagsasanay (`ConfigError`; dito para sa halagang `x`):
  `config.model.keep_checkpoints is "selected" (the default: only the checkpoint the run picks stays) or "all", not 'x'`.
- **Lock.** Tinatanggihan ang isang run na hindi kayang tanggapin ng disk bago pa man may
  maisulat (guard `disk-room`); agarang tinatanggihan ang isang detached na run, bago
  magsimula ang trabaho nito. Ang pagtatantya: ang laki ng isang checkpoint — ang napanatiling
  checkpoint ng isang naunang run ng parehong base sa workspace na ito, kundi'y ang sariling
  mga weight file ng base (isang lokal na folder, o ang cache ng Hugging Face) — pinarami nang
  `model.save_total_limit`, kasama ang 1 GB upang matapos; hindi kailanman bababa sa 2 GB. Mababasa
  sa pagtanggi ang
  `[disk-room] this computer has <free> free; training this model needs about <need> (<n> checkpoints of about <size> each while it trains, and room to finish)`
  — o, kapag walang alam na laki, *"(kahit ganoon man lang karami ay dapat manatiling libre
  anuman ang modelo)"* — pagkatapos ay
  `why: a disk that fills mid-training loses the run as it saves, and slows the whole computer`,
  at isang `fix` na nagpapangalan kung ano ang maaaring palayain ng `nmt-forge tidy` dito
  (kung may mapapalaya ito), paglilipat ng iba pang mga file mula sa disk, at `--skip-disk-check`.
- Nagsisimula pa rin ang `nmt-forge run … --skip-disk-check` (nang mayroon o walang `--detach`).
  Itinatala ng `disk_room` ng manifest ang pagsusuri — `free_bytes`,
  `checkpoint_bytes` (`null` kapag hindi alam), `checkpoints_at_once`,
  `need_bytes` — o `{"skipped": "--skip-disk-check"}`. **Paalala.** Maaaring magkamali
  ang pagtatantya; nasa pagpapasya po ng tao kung lalaktawan ang pagsusuri.
- Inililista ng **`nmt-forge tidy`** ang mga model weight mula sa mga naunang round na
  walang gumagamit — bawat run kasama ang laki nito, ang kabuuan, ang bakanteng espasyo —
  at walang inaalis. Inaalis ang mga ito ng `nmt-forge tidy --yes`. Hindi nito kailanman inaalis
  ang ginagamit na modelo, ang pinakabagong run, o ang modelong pinalitan ng kasalukuyang
  ginagamit (nagda-draft ang blind review sheet gamit ito); pinapangalanan ng linyang `Kept:`
  ng output ang bawat isa, kasama ang dahilan. Pinapanatili ng isang na-tidy na run ang
  talaan nito — manifest, mga salin ng dev, ulat — at nagkakaroon ang manifest nito ng
  `model_removed` (`at`, `by`, `bytes`, `why`); nakakakuha ang
  ledger ng isang entry na `tidy` (`runs`, `bytes`). Tinatanggihan ang
  isang na-tidy na run na hinilingang magsalin (isinasalin muli ng `compare-runs` ang dev
  set gamit ito):
  `run <name>'s model was removed by nmt-forge tidy on <time> to free disk space — its record stays, its weights do not`.
  **Paalala.** Nagbubura ng mga file ang `--yes`: ipakita po sa tao ang listahan, at
  patakbuhin lamang ito kapag sumang-ayon sila.
- **Nagbabala ang `status`** — isang linya sa `warnings`, na inihatid ng mga rail — kapag
  ang disk na naglalaman ng workspace ay may mas mababa sa 10 GB na libre, o maaaring magpalaya
  ang tidy ng 5 GB o higit pa: *"ang computer na ito ay may X GB na libre; ang mga modelo ng N
  (mga) naunang round na walang gumagamit ay kumukuha ng Y GB — inililista ang mga ito ng `nmt-forge tidy`,
  pinalalaya ng `nmt-forge tidy --yes` ang espasyo (ang ginagamit na modelo, ang pinakabago at ang
  pinalitan nito ay pinapanatili)"* (ang bahagi pagkatapos ng semicolon ay kapag may mapapalaya
  lamang ang tidy).

## Ang mga yugto ng pagpapabuti

Kapag ginagamit na ang isang modelo, nagsasanay ang bawat round ng isang bagong run sa mas maraming datos gamit ang
parehong dev set.

**Kung paano nagsasanay ang isang round.** Pinapatakbo ng `champollion improve prepare` ang `nmt-forge
round-plan --config config.json`, which rewrites `config.json` sa isa sa dalawang
paraan at isinusulat ang plano sa ledger (`round-plan`):

- **Pagpapatuloy mula sa modelong ginagamit** (`init_from` ang folder ng modelo nito): 4 na pasada
  (mga epoch) sa lahat ng pangungusap sa ngayon — pinipigilan ito ng mga luma na
  makalimot — sa kalahati ng learning rate. Higit na mas maikli kaysa sa pagsasanay mula sa
  simula. Naghihintay ang buong mga setting sa `config.json` sa ilalim ng `model_full`.
- **Mula sa simula**, na ibinalik ang buong mga setting, kapag wala pang modelong
  ginagamit; kapag pinalitan ang modelo (`use-model`, na nag-aalis din ng
  `model_full`); para sa `cpu-tiny`, na ang bokabularyo ay nagmumula sa mga pangungusap
  sa pagsasanay (nagsasanay ito sa loob ng ilang minuto); para sa isang adapter (LoRA) na modelo; at tuwing
  ika-4 na round, upang hindi magbago ang direksyon ng napakaraming maiikling pagpapatuloy.

Ipiniprinta ng `prepare` ang plano at ang dahilan nito, at itinatala ang `training` (`mode`,
`epochs`) sa `improve/round-<k>/prepared.json`. Sa alinmang paraan, hinahatulan ang bagong run
laban sa ginagamit na modelo sa parehong mga pangungusap sa dev. Pagkatapos (ang 1, 3, at
4 ay mga estadong pinapangalanan ng advisor ng forge; ang 2 ay itinatala ng mga rail):

1. **`improve-compare`** (`auto`): `nmt-forge compare-runs <in-use
   run-manifest.json> <new run-manifest.json>` — ang dalawang modelo,
   ipinapares pangungusap sa bawat pangungusap sa dev set. Kapag may mas mababa sa 50 pangungusap
   sa dev, ang hatol ay **too-few**, anuman ang mga marka: *"masyadong kakaunti ang mga
   pangungusap sa dev para matukoy: sa ibaba ng 50, ang pagkakaiba ay hindi mapagkakatiwalaang
   matukoy mula sa tsamba, anuman ang laki nito"*. Mula 50: **better** lamang kapag ang p ng
   paired test ay < 0.05 **at** ang 95% interval ng pagkakaiba ay higit sa zero; **worse** kapag
   p < 0.05 at ito ay mas mababa sa zero; kung hindi ay **no-change**. Sinasabi ng bawat hatol
   ang pinakamaliit na pagkakaibang mapagkakatiwalaang naipapakita ng dev set nito. Hindi
   kailanman binabasa ang test set. Tinatanggihan (`improve-loop`) para sa mga run sa magkaibang
   dev set, isang run na walang na-save na mga salin ng dev, o isang dev set na nabago simula
   noong bagong run.
2. **Ang hatol ng tagapagsalita**, kung saan hindi makapagdesisyon ang dev set. Ang modelo ng
   isang round na hindi ginamit ay nagda-draft ng kalahati ng mga na-draft na hilera ng
   susunod na review sheet, nang blind (`draft-newer`, sa ibaba), at itinatala ng
   `champollion improve marks` ang mga bilang ng tagapagsalita gamit ang forge:
   `nmt-forge speaker-verdict --newer <run> --in-use <run> --newer-right <n> --newer-judged <n> --in-use-right <n> --in-use-judged <n> --json`.
   Umaaksyon lamang dito ang forge pagkatapos ng hatol na **too-few** o **no-change**. Ang
   isang pooled two-proportion test, two-sided sa 5% (|z| > 1.96), ay nagbibigay ng `clear`:
   `newer`, `in-use` o `neither`; pinapanatili ng entry na `improve-speaker` ng ledger
   ang dalawang pangalan ng run, ang apat na bilang, `z` at `clear` — mga bilang lamang.
   Tinatanggihan nito ang mga bilang na mas mababa sa 0, mas marami ang tama kaysa sa hinatulan,
   at isang modelong walang hinatulang draft. Ang teksto nito: *"Sa pagmamarka nang blind sa
   parehong pagbisita, minarkahan ng tagapagsalita ang mas bagong modelo na tama sa A ng B
   bagong mga pangungusap (P%) at ang ginagamit na modelo sa C ng D (Q%)"*, pagkatapos ay
   *"malinaw na mas mahusay ang mas bagong modelo sa mga pangungusap na ito — nag-aalok ang forge
   na gamitin ito"*, *"malinaw na mas mahusay ang ginagamit na modelo sa mga pangungusap na ito —
   mananatili ito"* o *"walang malinaw na pagkakaiba sa mga pangungusap na ito — mananatili ang
   ginagamit na modelo"*.
3. **`improve-promote`** (`confirm`), sa **better** — o sa **too-few** o
   **no-change** kapag sinasabi ng pinakabagong `speaker-verdict` sa run na iyon ang
   `clear: newer` (hindi kailanman sa **worse**). Isa itong alok: ang hatol lamang ay walang
   inilalagay sa paggamit. Sa pagsang-ayon ng mga tao, iniluluwas nito ang bagong run nang
   hindi binabasa ang test set (`--no-eval`), itinatala ito bilang napili (`choose`),
   pinapahinto ang tumatakbong server at inihahatid ang bagong modelo sa parehong port. Ang
   `export` at `choose` lamang na iyon ang binibilang bilang paggamit sa isang modelo:
   hanggang sa mangyari iyon, mababasa sa ulat ng round ang *"masusukat na mas mahusay: hindi
   ginamit — hindi ito pinili ng mga tao"*, at hindi isinasama ng progress, projection, at overfit
   check nito ang modelo. Sa mga marka ng tagapagsalita, idinaragdag ng `why` nito ang
   kanilang mga bilang at *"isang malinaw na pagkakaiba: mas mahusay ang mas bagong modelo sa mga
   pangungusap na kailangan ng pamilya"*. Sa susunod na sheet, kalahati ng mga na-draft na hilera
   ay magmumula sa modelong pinalitan nito, upang masuri ng tagapagsalita ang promosyon nang
   blind (sa ibaba).
4. Kung hindi, mananatili ang ginagamit na modelo at magsisimula ang susunod na round — maliban
   kung ang huling dalawang hatol ng round simula noong huling pagpapalit ng modelo ay parehong
   **no-change** o **worse**, habang ginagamit ang `cpu-tiny`. Ang huling pagpapalit ng
   modelo ay ang pinakabagong `model-change` (isang paglipat ng preset o isang `not-now`) o
   entry na `choose` sa ledger — anumang modelong ginamit ng mga tao, kasama ang
   promosyon batay sa mga marka ng tagapagsalita. Ang round na **too-few** ay hindi isang
   hinatulang round: kapag alinman sa huling dalawa ay too-few, walang alok.
   Pagkatapos ay **`improve-stronger-model`** (`ask_user`):
   `nmt-forge use-model <preset> --config config.json --answer yes` (o
   `not-now`), ang preset na `byt5-small` o `byt5-small-lowmem`
   ([models](#models)). Ang puwang para sa sagot ay `try_it`. Muling isinusulat ng `yes`
   ang modelo ng config (pinapanatili ang time budget ng mga tao) at sinasanay ito ng susunod
   na hakbang; walang binabago ang `not-now`. Pareho silang isinusulat sa ledger
   (`model-change`), at babalik lamang ang alok pagkatapos ng dalawa pang ganoong round.
   Sa MCP, ang "not now" dito ay ang sagot na `try_it: "not-now"`;
   tinatanggihan ang `declined: true` sa hakbang na ito
   ([MCP](/docs/agents/mcp#not-now)). Hindi kailanman sinasabi ng `why` nito na ang mas
   maraming pangungusap ay hindi nakatutulong: kapag ang dev set ay masyadong maliit upang
   makita ang pakinabang ng isang round, *"maaaring may nakatagong maliliit na pakinabang"*;
   kung hindi, nagdulot ang mga round ng *"walang pagbabagong makikita ng mga pangungusap sa dev
   (humigit-kumulang X puntos ng chrF++ o higit pa): maaaring nagdaragdag ang mga round nang mas
   mababa kaysa roon, o wala talaga"* — malapit sa tuktok ng curve, ang isang round ay nagdaragdag
   ng humigit-kumulang kalahating puntos ng chrF++, mas mababa sa naipapakita ng 200 pangungusap
   sa dev.
   **Paalala.** Naka-default ang `--answer` sa `yes`: palaging ipasa nang tahasan
   ang sagot ng mga tao.

Pinapatakbo ng mga rail ang natitirang bahagi ng isang yugto (`champollion improve …`): isinusulat ng `nmt-forge
wishlist` ang sheet ng kung ano ang pinakamalaking maitutulong (40 prompt ayon sa default,
hindi bababa sa sangkapat ang iniwang bukas; ang mga salita nito na hindi pa nakita ng modelo ay humihingi ng dalawa o
tatlong pangungusap bawat isa, na bawat isa ay may ibang sinasabi — ang salitang nakita nang minsan
sa pagsasanay ay bihirang matutuhan
([pagsukat](/docs/agents/measurement#what-the-wishlist-steers-on))), hinahati-hati ng `nmt-forge analyze` ang dev chrF++ ayon sa uri
ng pangungusap, at idinaragdag ng `nmt-forge grow-dev` ang mga pansanay na pangungusap ng tagapagsalita sa
dev set sa ilalim ng parehong pangalan — hindi kailanman isang hilera na nasa dev na, hindi kailanman isa
na ang pinagmulan ay nasa isang test o sealed set. Gumagabay lamang ang isang uri ng pangungusap sa
wishlist kapag ang marka nito ay malinaw na mas mababa kaysa sa iba
([pagsukat](/docs/agents/measurement#what-the-wishlist-steers-on)).
Nagda-draft ang `nmt-forge draft-newer` (pinapatakbo ng `champollion improve sheet`) ng random na
kalahati ng mga hilera ng susunod na review sheet gamit ang kabilang modelo, nang walang marka, upang
mahatulan ng tagapagsalita ang dalawang modelo nang blind
([pagsukat](/docs/agents/measurement#the-speakers-marks)): ang pinakabagong
sinanay na modelo kapag hindi ito ang ginagamit (hindi ginamit ang yugto
nito), o, pagkatapos ng promosyon, ang modelong pinalitan ng ginagamit. Sinasabi ng `--json` nito
kung alin (`relation`: `newer` o `replaced`, `null` kapag walang ibang
modelo at bawat hilera ay sa ginagamit na modelo), kasama ang `other`, `in_use`, ang
mga pares sa pagsasanay sa likod ng bawat isa (`other_pairs`, `in_use_pairs`) at `n`; itinatala
rin ng entry na `draft-newer` ng ledger ang kapareho nito. Paano ipasa ang isang yugto:
[coaching](/docs/agents/coaching).

## Synthetic na datos at back-translation

- Pinapatakbo ng `nmt-forge synth <pack> --out <file>` ang generator ng isang language pack.
  Walang ipinapadalang mga pack ang forge. Bineberipika ang bawat row at tinatatakan ng `synthetic: true`.
- Nagsasanay ang isang synthetic na file bilang isang naka-tag na lane sa `config.json`
  (`data.synthetic`, `{"path", "tag": "<synth>"}`). Kapag lumampas sa 15% ng isang uri, tinatanggihan
  ang run maliban kung binabanggit ng config ang `mix.synthetic_sample`;
  kumukuha ang `nmt-forge sample --cap 0.15 --key kind` ng limitadong sample.
- **Walang command ang back-translation.** Isa itong library function
  (`nmt_forge.training.backtranslation.backtranslate`): kayo ang nagbibigay ng
  reverse model; sinasala muna nito ang monolingual na teksto laban sa bawat nakarehistrong set
  at tina-tag ang output nito bilang `<bt>`; pagkatapos ay nagsasanay ang output bilang isang synthetic
  na lane. Walang filter ng kalidad na pinapatakbo rito. Tinatanggihan ang `config.data.monolingual`.
- **Paalala.** Ang monolingual na teksto ay datos ng mga mamamayan tulad ng iba pa: nalalapat ang
  mga sidecar term nito, at ang isang reverse model na isang naka-host na LLM ay nagpapadala nito sa isang provider
  ([mga panuntunan sa datos](/docs/agents/data-rules)).

## Sintomas → sanhi → lunas

| Sintomas | Malamang na dahilan | Pag-aayos |
|---|---|---|
| Minamarkahan ang `cpu-tiny` sa pagitan ng 5 at 30 chrF++ sa dev | Sadyang mahina ito sa disenyo: isang phrasebook para sa mga pariralang tulad ng datos ng pagsasanay nito | Mas maraming totoong pares; sa Apple silicon o isang GPU, `byt5-small` (`nmt-forge use-model byt5-small`; `byt5-small-lowmem` kung saan ang GPU ay may 8–15 GB) |
| "Mahusay sa mga template, masama sa totoong teksto" | Panuntunan R7 (transfer plateau): sumayad ang dev loss bago ang huling checkpoint at tumaas nang 5% o higit pa. Gumagana ito sa anumang gayong pagtaas, anuman ang ginawa ng dev chrF++ — basahin ito kasama ang mga marka sa dev | Mas maraming totoong pares. Ipinapakita ng `nmt-forge lint <run-manifest.json>`, hindi sa pamamagitan ng export |
| Mukhang masyadong maganda ang marka | Mga kopya sa test o halos-magkatulad na kopya sa pagsasanay; o karamihan sa mga hilera sa test ay may kakambal sa pagsasanay (R4-recall-not-translation, sa kalahati o higit pa) | `leak-audit --drop-test-twins` para sa isang file na walang kakambal; iulat ang mga marka nang mayroon at walang kakambal |
| Maliit na pagkakaiba sa pagitan ng dalawang modelo | Malawak ang agwat (R5-low-power, agwat na mas malapad sa 8 puntos) | `nmt-forge compare` (ipinares na pagsubok); para sa mga yugto, `compare-runs`. Palakihin ang dev set |
| Sinasabi ng isang yugto na "masyadong kakaunti ang mga pangungusap sa dev upang matukoy" (`too-few`) | Naglalaman ang dev set ng mas mababa sa 50 pangungusap: walang paghahambing na makakapagpasya roon | Walang dapat ayusin: pinaghahalo ng susunod na sheet ang mga draft ng parehong modelo nang blind at ang mga marka ng tagapagsalita ang magpapasya; isa sa bawat dalawang hilera ng sheet ay pansanay na hilera hanggang sa maglaman ang dev set ng 50 |
| Sinasabi ng isang yugto na "walang masusukat na pagbabago" | Masyadong maliit ang dev set upang makita ang nakamit ng isang yugto | Palakihin ito mula sa mga pansanay na pangungusap ng tagapagsalita (`grow-dev`, na pinapatakbo ng `champollion improve prepare`) |
| Tinanggihan ang pagsasanay: `[disk-room] this computer has … free` | Hindi kayang tanggapin ng disk ang mga checkpoint ng run | Inililista ng `nmt-forge tidy` kung ano ang mapapalaya ng mga modelo ng mga naunang yugto; `nmt-forge tidy --yes` sa pagsang-ayon ng tao; o magbakante ng espasyo sa ibang lugar. `--skip-disk-check` lamang kapag nagpasya ang tao na mali ang pagtatantya |
| Hindi nahihigitan ng run ang floor ng diksiyonaryo | Walang natutuhan ang pagsasanay na hindi ibinibigay ng listahan ng mga salita | Mas maraming pares; suriin ang saklaw ng floor; sabihin ito sa mga tao |
| Saturated ang dev set | Ang ibabang hangganan ng agwat ay nasa 99% ng ceiling | Isang mas mahirap na dev set; hindi na maaaring tumaas pa ang marka |
| Tinanggihan bago magsanay | Tingnan ang hilerang "Pagsasanay" sa itaas; pinapangalanan ng `preflight run` ang bawat nabigong gate at ang pag-aayos dito | Sundin ang pag-aayos. Isang nawawalang training extra: `uv tool install --reinstall --python 3.12 'nmt-forge[hf]'` (o `pip` sa sariling Python ng forge) |
| Inihinto ng wall clock | Lumalampas ang inaasahang run sa badyet (24 oras kung walang nakatakda) | Isang mas maliit na modelo o mas kaunting mga epoch, o isang badyet na itinakda ng mga tao (`model.time_budget_hours`) |
| Nabigo ang isang background job | Ipinapakita ng `nmt-forge jobs` ang `crashed`, `stalled`, `deadline`, `lost` o `refused` | Basahin ang `stderr.log` nito sa `.forge/jobs/<name>/` at ayusin ito; pagkatapos ay magsanay muli, o magpatuloy mula sa huling checkpoint nito kapag pinangalanan ng `status` ang `--resume` |
| Naghihintay ang pagsasanay at hindi nagsisimula | May isa pang pagsasanay sa kompyuter na ito na tumatakbo; nakapila ito sa likod niyon (`queued_behind`) | Maghintay: kusa itong magsisimula. Huwag magsimula ng isa pa |
| Lumalabas na putol ang mahahabang pangungusap | Ang mga limitasyon sa haba: nagbabala ang `status` kasama ang mga bilang (mga pares na pinutol sa pagsasanay, mga pangungusap sa dev na pinutol sa pagpasok, mga salin na inihinto sa limitasyon) | Hatiin ang mahahabang pangungusap; o itaas ang `model.max_src`, `model.max_tgt` at `decode.max_new_tokens` (mas mahabang pagsasanay) |
| Lumalabas ang mga salita bilang hindi kilalang mga piraso (`cpu-tiny`) | Natututuhan lamang ang bokabularyo mula sa mga hilera ng pagsasanay | Mas maraming pares na gumagamit sa mga salitang iyon; o `byt5-small`, na nagbabasa ng mga byte |

## Ang taksonomiya ng kabiguan

Binuo ang forge mula sa isang talaan ng mga paraan kung paano niloloko ng isang proyekto sa pagsasanay ang sarili nito. Sa
buod — ang ibig sabihin ng ipinapatupad ay tinatanggihan ito ng mga tool:

| Pamilya | Mga Kabiguan | Sa code |
|---|---|---|
| Pagtulo (leakage) | Ang sagot ay nasa training set; mga halos-kopya; mga paraphrase na tumatawid sa pagkakahati; mga nakakadenang template | Ipinapatupad (leak audit, split guard). Pinapanatili at binibilang ang mga template sibling |
| Kontaminasyon sa dev/test | Pagpili ng mga checkpoint sa test set; paggamit ng isang sealed set nang dalawang beses; isang test score nang walang hula; panghuhula pagkatapos magbasa | Ipinapatupad (dev fence, eval ledger, preregistration) |
| Tokenizer at ortograpiya | Isang tokenizer na hindi makasulat ng script; magkahalong gawi sa pagbabaybay | Hindi sinusuri para sa mga tokenizer; ang magkahalong gawi ay isang lint, kapag binabanggit lamang ng config ang mga ito |
| Synthetic na datos | Pagsasanay sa synthetic mix; pinapatay ng maagang paghinto (early stopping) ang isang run na mabigat sa synthetic; pagbagsak; kumakain ang back-translation sa sarili nitong mga error | Ipinapatupad ang floor ng maagang paghinto; ang iba ay mga lint o tag |
| Saklaw (coverage) | Mga nawawalang salita para sa register | Isang lint, kapag nag-uulat ng saklaw ang isang plugin |
| Pagsukat | Isang delta na mas maliit sa agwat nito; isang malabong numero; matematika ng sukatan sa labas ng engine | Ipinapatupad: dala ng bawat marka ang agwat nito at nagmumula sa engine |
| Pag-decode | Putol na output; mga checkpoint na pinili ayon sa loss sa halip na output | Ipinapatupad: decode headroom, generation-metric selection; binibilang at binababalaan ang mga pagputol sa haba |
| Proseso | Hindi kilalang mga config key; do-not-train na datos; mga run na lumalampas sa kontrol | Ipinapatupad |

Mga kilalang puwang, na wala pang code sa kasalukuyan: saklaw ng tokenizer, kalidad ng back-translation,
pagkaputol ayon sa register, ang ratio ng gold/synthetic, pagkakaiba-iba sa mga seed.

## Output para sa mga programa

Naglalagay ang `--json` ng eksaktong isang JSON document sa stdout. Ang isang pagtanggi ay
`{"error": {"type", "guard", "message", "why", "fix", "how_to_get", "text"}}`
at exit 2 (idinagdag ang `details` para sa mga pagtanggi sa split at dev-fence). Ang exit 1 ay isang
hindi inaasahang crash. Nagtatapos ang `nmt-forge run` sa `RUN EXIT <code>` (0, 1, 2 o
130); nagbabalik ang `run --detach` ng 0 kalakip ang job document. `nmt-forge status
--json` is `{"snapshot", "advice": {"state", "next_command", "why", "ready",
"blockers", "warnings", "answers"}}`.

## Magbasa pa

- [Ang sanggunian sa utos ng `nmt-forge`](/docs/network/getting-started/forge-command-reference)
  — bawat subcommand at flag.
- [Mga panuntunan sa pagsukat](/docs/agents/measurement) — kung ano ang kahulugan ng mga marka.
- [Ang inyong unang tagasalin](/docs/your-first-translator) at
  [Gawing mas mahusay](/docs/make-it-better) — ang mga bersyon para sa mga mamamayan.
- [Pag-serve at deployment](/docs/agents/serving) — kung ano ang nilalaman ng isang export.
