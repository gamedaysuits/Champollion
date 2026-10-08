---
sidebar_position: 1
title: "Sanggunian ng CLI"
related:
  - label: "Quick Start"
    to: /docs/getting-started/quick-start
    kind: guide
  - label: "Configuration"
    to: /docs/getting-started/configuration
    kind: reference
  - label: "CI/CD"
    to: /docs/guides/ci-cd
    kind: guide
  - label: "Troubleshooting"
    to: /docs/guides/troubleshooting
    kind: guide
---

# Sanggunian ng CLI

## Mga Command

```
champollion init              Interactive setup wizard (--yes for quick defaults)
champollion sync              Translate & sync all locale files
champollion watch             Auto-sync when the source file changes
champollion audit             List untranslated and out-of-date translations (CI completeness gate)
champollion lint              Scan source code for hardcoded strings
champollion wrap              Auto-wrap hardcoded strings in t() calls (with undo)
champollion seo <sub>         Generate hreflang, sitemap.xml, or JSON-LD schema
champollion integrity         Audit locale files for format/encoding issues
champollion repair-script     Restore romanization where script conversion was unwanted
champollion verify            Verify translations are present and correct (CI gate)
champollion status            Show pair configuration, plugins, and benchmark scores
champollion provenance        Audit translation resource licensing
champollion plugin <sub>      Manage method plugins (install, remove, list)
champollion fonts <sub>       Download web fonts for PUA script converters
champollion tm <sub>          Manage Translation Memory cache (stats, clear, seed, prune)
champollion xliff <sub>       Export/import XLIFF 1.2 for professional review
champollion models            List available models from a provider (--method <provider>)
champollion doctor            System health check (cards, config, FSTs, API keys, methods)
```

Ang mga command na gumagana sa shared index at leaderboard, sa halip na sa inyong
proyekto, ay nakapangkat sa ilalim ng `champollion network`. Gumagana rin ang bawat isa nang wala
ang prefix:

```
champollion network card <code>        What the index knows about a language (--json for raw output)
champollion network recommend <s> <t>  Methods you can run for a pair, with the evidence for each, and open models that declare the target (or one pair: eng-crk)
champollion network leaderboard        Published results; install a proven method (--install, --apply)
champollion network register-corpus    Register a test set without handing it over (local-only/private/public/sealed)
champollion network seal-corpus <sub>  Sealed-tier crypto verbs: keygen / seal / open (organizer-node bridge)
champollion network submit             Propose an index entry (review-gated): prints a pre-filled GitHub issue
```

Patakbuhin ang `champollion <command> --help` para sa detalyadong tulong sa anumang command
(inililista ng `champollion network` ang mga network command).

## Mga Global Option

```
--help, -h              Show help (global or per-command)
--version, -v           Print version and exit
--yes, -y               Skip interactive prompts, use defaults
--config <path>         Custom config file path
--dir <path>            Override locales directory
--content-dir <path>    Folder of Markdown/MDX to translate (a Hugo content/ or any folder); each translation is written beside its source as <name>.<locale>.md
--source <code>         Override source locale (default: en)
--model <model>         Translation model for this run only (an exact model slug; aliases and floating "-latest" ids are refused); the config is not changed — to switch for good, edit "model" in champollion.config.json
--method <method>       Translation method for this run only: llm, llm-coached, local, openai, anthropic, gemini, google-translate, deepl, … Overrides the config, including a pair's own method (sync says which); scope with --pair. To switch for good, edit "defaultMethod" (or the pair's "method")
--temperature <n>       LLM temperature (0.0–2.0, default: 0.3)
--coaching-file <path>  Path to free-text coaching prompt file (injected into system prompt)
--format <fmt>          Locale file format: json, toml, yaml, po, arb, or auto
--dry, --dry-run        Preview changes without writing files
--list-keys             With --dry: name every queued key per reason
--concurrency <n>       Max parallel API calls (sets both JSON and content, default: 48)
--json-concurrency <n>  Max parallel locale translations for JSON keys (default: 200)
--content-concurrency <n> Max parallel API calls for content translation (default: 48)
--redo <scope>          Translate again: all | keys:<k1,k2> | content | files:<glob> (repeatable). Cached text is still served, so a redo is cheap. gaps: every plural message on disk without a form its language uses for ordinary counts — asked from the model, not the cache
--prune plural-extras   sync: remove i18next plural keys for a form the language does not have (Spanish count_two) — only those, each one listed; never without this flag
--fresh                 Don't use the cache for what is queued — it is billed again
--files <glob>          Only these content files this run (repeatable; e.g. docs/intro.md, "posts/**")
--force                 Same as --redo all (whole-locale rebuild; scope with --pair)
--force-keys <keys>     Same as --redo keys:<keys> (namespace::key for one file of a multi-file language; \, for a comma inside a key; ctx\x04msgid — or ctx␄msgid — for a gettext entry with a context)
--force-content         Same as --redo content
--retranslate <glob>    Same as --redo files:<glob> --fresh (bypasses the lock and the cache — billed — and replaces paragraphs a person edited in the named files)
--no-tm                 Same as --fresh
--fresh-on-model-change Don't reuse the previous model's cached translations for what this run translates; with --redo all, the new model translates what an earlier model wrote
--pair <src:tgt>        Only these pairs this run, comma-separated (e.g. en:fr,en:de; en>fr and en-fr work too); unknown pairs fail loud (sync, verify, serve)
--max-cost <usd>        sync: stop before any API call if the estimated cost is over this USD cap, or unknown (exit 2, nothing spent)
--no-verify             Skip post-sync verification pass
--strict                verify: warnings fail the check too (exit 1)
--script <choice>       init: writing system of a language with two real orthographies, e.g. crk=Cans
--name <code=name>      init: display name of a language with no card (a private-use code), e.g. qaa="Ayta (variety not yet confirmed)"
--locale <code>         Target locale (xliff export, tm clear)
--quiet                 Errors and warnings only — suppress banner, progress bar, and info lines
--json                  Machine-readable NDJSON output — one JSON object per event
```

### Pagsulat ng language pair

Isinusulat ang project pair sa paraan kung paano ito ini-key ng `champollion.config.json`: `en:fr`. Binabasa rin ng `sync`, `verify` at `serve` ang `en>fr` at `en-fr`, at itinutugma ang `en-pt-BR` sa mga pares na inyong ikinumpigura. Isinusulat ng mga network command (`network register-corpus`, `leaderboard`, `recommend`, `submit`) ang isang pares bilang `eng>crk`, ang anyong iniimbak ng leaderboard at ginagamit ng `mt-eval`, at binabasa ang `eng-crk` at `eng:crk` sa parehong paraan. Gamit ang mga gitling lamang, ang isang pares ay binubuo ng dalawang code na may dalawa o tatlong titik (`eng-crk`). Ang isang code na may sariling gitling ay nangangailangan ng `>`: `--pair "eng>pt-BR"`. Tinatanggihan ang `eng-pt-BR`, hindi kailanman hinuhulaan. I-quote ang anyong `>` sa isang shell: kung hindi naka-quote, ipinapadala ng `--pair eng>crk` ang output sa isang file na pinangalanang `crk`.

---

## init

Interactive na setup wizard na lumilikha ng `champollion.config.json`. Ginagabayan kayo sa source locale, mga target na wika, file format, at translation model.

```bash
champollion init                          # interactive wizard
champollion init --yes                    # skip wizard, use defaults
champollion init --yes --langs fr,de,ja   # quick setup with specific languages
champollion init --source en --dir ./i18n # overrides with defaults
champollion init --yes --langs crk --content-dir newsletters  # also translate a folder of Markdown
champollion init --yes --langs abc --method api --endpoint http://127.0.0.1:8378/translate --accepts-instructions false
```

**Opsyon na `--content-dir`**: Isang folder ng mga Markdown/MDX file na isasalin pati na rin ang inyong mga locale file (nakasulat bilang `contentDir`). Dapat umiiral ang folder; hihinto ang `init` nang walang isinusulat kung wala ito.

**Ang isang proyektong may local-only na file ay nagde-default sa `local`**: Ang default na pamamaraan ay `llm` (OpenRouter, isang hosted service). Kapag ang isang file saanman sa proyekto ay minarkahang local-only — isang `<file>.champollion.json` sa tabi nito na may `"transmission": "local-only"`, gaya ng isinusulat ng `champollion network register-corpus --data <file> --tier local-only` — ang `init` (pati na rin ang `--yes`) ay nagde-default sa pamamaraang `local` sa halip: isang model na sini-serve sa makinang ito (ang default ng Ollama na `http://localhost:11434/v1`, o ang server na pinapangalanan ng `LOCAL_API_BASE`). Sinasabi nito kung bakit, pinapangalanan ang minarkahang file, at kung paano sadyang pipili ng isang hosted method: `champollion init --force --method llm --model <model>`. Palaging nananaig ang isang tahasang `--method`; itinatala naman ng `init` ang minarkahang file sa tabi ng kung saan napupunta ang teksto.

**Muling pagpapatakbo ng `init` (`--force`)**: Kung walang `--force`, hihinto ang `init` kapag umiiral ang `champollion.config.json`. Kung mayroon nito, magsisimula ang `init` mula sa file na iyon at muling isusulat lamang ang pinapangalanan ng mga flag: itinatakda ng `--langs` ang listahan ng target (pananatilihin ng isang wikang naroroon na ang entry nito — register, script, pangalan), ng `--method` ang default method (at ang model kasama nito, maliban kung nagpangalan ang `--model` ng isa), `--model`, `--temperature`, `--source`, `--dir`, `--format`, `--content-dir`, `--script`, `--name`, at ng `--method api` ang mga pares na pinapangalanan nito. Muli lamang nitong tutuklasin ang layout ng locale kapag hindi na mahanap ng file ang inyong mga source file (o nagpangalan ang `--dir` ng ibang folder). Ang bawat iba pang setting — `batchSize`, `pairs`, `glossary`, mga fallback, mga register na pinili ninyo — ay mananatili kung ano ito dati. Iniimprenta nito ang bawat field na binago nito at ang mga pinanatili nito, at kinokopya muna ang naunang file sa `champollion.config.json.bak` (kapag naglalaman na ang backup na iyon ng mas lumang file, ang susunod ay `.bak.2`, `.bak.3` …; hindi kailanman ino-overwrite ang mas lumang backup). Ang isang file na hindi wastong JSON ay hindi mapapanatili: iba-backup ito at susulatan ng bago. Upang baguhin ang isang setting, i-edit ito sa file — hindi na kailanman kailangang patakbuhin muli ang `init` para doon.

**Paghahanap sa inyong mga locale file**: Hinahanap ng `init` ang file ng inyong source language bago ito sumulat ng anuman. Sinusuri muna nito ang karaniwang folder ng inyong framework (next-intl `messages/`, i18next `public/locales/<lang>/` pagkatapos ay `locales/<lang>/`, vue-i18n `src/locales/`, Hugo `i18n/`), pagkatapos ay `locales`, `messages`, `i18n`, `lang`, `translations`, `public/locales`, `src/locales` at `src/i18n`, at iniimprenta ang nahanap nito. Hindi ito kailanman nagsusulat ng `localesDir` na hindi umiiral. Tingnan ang [Mga Layout ng Locale File](/docs/getting-started/configuration#locale-layouts).

**Opsyon na `--langs`**: Listahan ng mga code ng target language na pinaghihiwalay ng kuwit. Nilalaktawan ang prompt ng wika at inilalapat ang default register preset ng bawat wika — nakasulat sa config, kaya nakikita at mae-edit ang pagpili: `"languages": { "fr": "formal-vous", "es": "neutral-latam" }` (palitan ang isa ng ibang preset, o ng sarili ninyong mga salita na naglalarawan sa tono; ang isang wikang walang mga preset ay isinusulat bilang `{}`). Lumilikha rin ito ng mga blangkong target file sa inyong layout (`fr.json`, o `fr/common.json` para sa bawat namespace). Pagsamahin sa `--yes` para sa ganap na non-interactive na setup.

**`--method api --endpoint <url>`**: Isang server na sumusunod sa champollion API contract — halimbawa isang model na inyong sinanay, na sini-serve ng `nmt-forge serve`. Isinusulat ng `init` ang isang pares bawat target, ang parehong entry gaya ng `DEPLOY.md` sa tabi ng model: `"pairs": { "en:abc": { "method": "api", "endpoint": "http://127.0.0.1:8378/translate", "acceptsInstructions": false } }`. Sinasabi ng `--accepts-instructions true|false` kung sinusunod ng endpoint ang mga instruksiyon bawat key (ang isang model na sinanay gamit ang nmt-forge ay hindi); kung wala ito, kinukuha ng `init` ang halaga mula sa isang naka-install na plugin manifest para sa parehong endpoint (`.champollion/methods/<name>/method.json`), o iniiwan itong hindi nakasaad. Kailangan nito ang `--langs` (itinatakda ang endpoint bawat pares), at isang key para lamang sa isang endpoint na wala sa makinang ito (`CHAMPOLLION_API_KEY`). Magdagdag ng pamamaraang `fallback` sa pares nang manu-mano, gaya ng ipinapakita ng `DEPLOY.md`.

**Opsyon na `--script`**: Ang ilang wika ay isinusulat sa mahigit isang tunay na ortograpiya — Plains Cree (`crk`: `Latn` = Standard Roman Orthography, `Cans` = Syllabics), Serbian (`sr`: `Latn`, `Cyrl`). Hindi pumipili ang Champollion para sa isang komunidad: tumatanggi ang `sync` na isalin ang gayong wika hanggang sa magpangalan ang config ng isa. Nagtatanong ang wizard; gamit ang `--yes`, ipasa ang `--script crk=Cans` (marami: `--script crk=Cans,sr=Latn`; kapag may iisang target language, sapat na ang `--script Cans`), na nagsusulat ng `"languages": { "crk": { "script": "Cans" } }`. Kung wala ito, sinasabi ng `init --yes` kung aling mga wika ang nangangailangan ng pagpili, inililista ang mga pagpipilian, at iniimprenta ang linyang `"script"` na idaragdag sa entry ng wikang iyon sa config.

**Opsyon na `--name`**: Ang isang private-use code (`qaa`–`qtz`, para sa isang barayti na walang kumpirmadong code) ay walang language card, kaya sinasabi ito ng `init` sa halip na hilingin sa inyong suriin ang baybay. Ibinibigay ng `--name qaa="Ayta (variety not yet confirmed)"` dito ang display name na ginagamit ng mga prompt at ulat, na nakasulat bilang `"languages": { "qaa": { "name": "Ayta (variety not yet confirmed)" } }` (marami: `--name "qaa=…;qab=…"`). Sa tabi ng bawat register, iniimprenta rin ng `init` ang gabay sa kasarian (gender guidance) na dala ng mga LLM prompt para sa wika ([Gender guidance](/docs/getting-started/configuration#gender-guidance)).

**Mga language preset**: Kapag na-prompt para sa mga target na wika, maaari ninyong i-type ang mga preset name:
- `european` → fr, de, es, it, pt, nl
- `asian` → ja, zh, ko
- `global` → fr, es, de, ja, zh, ko, pt, ar
- `nordic` → da, fi, nb, sv

Paghaluin ang mga preset at indibidwal na code: `european, ja` → fr, de, es, it, pt, nl, ja

---

## sync

Isinasalin ang nawawala at luma nang mga key sa lahat ng locale file. Nagpapatakbo ng post-sync verification bilang default.

```bash
champollion sync                                   # translate everything
champollion sync --dry-run                         # preview only
champollion sync --dry --list-keys                 # preview AND name every queued key
champollion sync --redo keys:hero.title            # translate one key again (cache still serves)
champollion sync --redo "keys:a.title,a.subtitle"   # several keys
champollion sync --redo 'keys:Welcome\, %(name)s'  # a key with a comma in it (gettext)
champollion sync --pair en:tlh --redo all           # rebuild one whole locale
champollion sync --pair en:tlh --redo all --fresh   # ...bypassing a suspect cache (billed)
champollion sync --redo content                     # re-process all Markdown/MDX (cached text is free; reviewers' edits are kept)
champollion sync --files "docs/guides/**"           # only these content files
champollion sync --redo files:docs/intro.md --fresh # translate one file from scratch (billed)
champollion sync --redo gaps                        # ask again for plural forms a model left out
champollion sync --prune plural-extras              # remove plural keys for forms a language does not have
champollion sync --content-dir ./newsletters       # include a folder of Markdown (Hugo content/ or any folder)
champollion sync --method google-translate          # force Google Translate
champollion sync --concurrency 20                  # 20 parallel API calls (both phases)
champollion sync --json-concurrency 30              # 30 parallel locale translations (JSON)
champollion sync --content-concurrency 8            # 8 parallel content translations
champollion sync --no-verify                        # skip post-sync verification
champollion sync --no-tm                            # skip cache, fresh API calls
```

**Translation Memory**: Bilang default, nilo-load ng `sync` ang `.champollion/tm.json` at isinisilbi ang mga naka-cache na salin para sa mga hindi nagbagong source value. Ang pagpapalit ng model ay hindi nagtatapon niyon: ang tekstong naisalin na sa ilalim ng naunang model ay muling ginagamit nang walang bayad, at ipinapaalam ito ng sync bago ang pagtatantya ng gastos (cost estimate). Upang ipasalin ang mga iyon sa bagong model sa halip: `--redo all --fresh-on-model-change` — ipinapadala nito ang mga key na isinalin ng mas naunang model, at ang naisalin na ng bagong model ay nagmumula pa rin sa cache (sa sarili nito, nakakaapekto lamang ang `--fresh-on-model-change` sa mga key na isasalin pa rin naman ng pagpapatakbo). Gamitin ang `--no-tm` upang ganap na lampasan ang cache (kapaki-pakinabang kapag nagde-debug ng kalidad). Tingnan ang [Translation Memory](/docs/concepts/translation-memory).

**Pagtatantya ng gastos at `--max-cost`**: Kinakalkula lamang ng pagtatantya ang sisingilin sa pagpapatakbo. Ang mga key, front-matter field, at Markdown block na nasa Translation Memory na ay may presyong $0, at ipinapakita ng talahanayan ang natitipid ng cache. Ang isang model na sini-serve sa makinang ito (`local`, o isang `api` endpoint, sa `localhost`/`127.0.0.1`/`::1`) ay nagpapakita ng `$0 (local)` — walang singil sa API; hindi binibilang ang inyong hardware at kuryente. Inihahambing ng `--max-cost` ang numerong iyon. Kapag lumampas sa cap, o kung walang pagtatantya (isang pamamaraan na walang nai-publish na presyo, tulad ng `local` na nakaturo sa ibang makina), hihinto ang sync bago ang anumang API call at mag-e-exit nang `2`; walang isasalin o isusulat. Sinasabi ng pansarang linya kung gaano karaming key ang ipinadala sa model at kung gaano karami ang nagmula sa cache.

Sa ilalim ng talahanayan, ibinibigay ng isang linya ang rate kung saan pinresyuhan ang halaga at kung saan ito nagmula — para sa isang hosted model, ang presyo bawat 1M input at output token mula sa pampublikong listahan ng presyo ng OpenRouter, at kung kailan ito binasa (`Rate: google/gemini-3.8-flash $0.30 input / $2.50 output per 1M tokens — OpenRouter's price list, read 2026-10-04 14:02 UTC`); para sa isang direktang provider (`openai`, `anthropic`, `gemini`) ang parehong listahan ang kumakatawan sa sariling presyo ng provider, at kapag hindi mabasa ang listahan (o walang presyo para sa model) ginagamit ang isang kopyang nakatago sa champollion, kasama ang petsa kung kailan ito huling sinuri at kung bakit; ang DeepL, Google at Microsoft mula sa kanilang nai-publish na presyo bawat karakter, kasama ang petsa nito. Isa itong pagtatantya: sinasabi ng linya kung gaano karaming token (o karakter) bawat key ang ipinapalagay nito, at nakadepende ang singil sa mga tunay na haba. Gamit ang `--json`, dala ng pagtatantya ang detalye: ang `rate` ng bawat pares at ang `rates` ng pagpapatakbo (`inputPerMillion`, `outputPerMillion` o `perMillionChars`, `tokensPerKey`, `from`, `url`, `fetchedAt` o `verified`).

**Pagtingin sa request**: Iniimprenta ng `sync --dry --show-prompt [key]` ang eksaktong request na ipapadala sa pamamaraan ng pares — ang mga mensahe ng system at user (o, para sa isang `api` endpoint, ang katawan ng request), na binuo ng sariling code ng pamamaraan, na may mga redacted na API key — at walang ipinapadalang anuman. Gamit ang isang key (pinangalanan ayon sa pagpapangalan ng `--redo keys:` dito: `verb␄Open`, `common::nav.home`; ang isang gettext msgid na may kuwit ay maaaring ibigay nang buo) ipinapakita nito ang request ng key na iyon nakapila man ito o hindi. Kapag walang ipapadala ang totoong pagpapatakbo para dito (napapanahon ito, isinilbi mula sa cache, o pinigil), sinasabi nito ito at pinapangalanan ang command na `--redo keys:<key> --fresh` na magpapadala nito. Kung walang key, ipinapakita nito ang unang batch na ipapadala ng bawat file, o sinasabing walang ipapadala. Ito ang paraan upang matiyak na ang isang gettext `msgctxt`, isang komento ng `#.` o isang paglalarawan ng ARB ay nakakarating sa model. Ang mga machine-translation engine (DeepL, Google…) ay pinapadalhan ng source text lamang; ipinapaalam ito ng preview. Gamit ang `--json` ang bawat request ay isang linyang `{"level": "event", "event": "request", …}`.

**Mga dry run**: Walang isinasalin at walang isinusulat ang `--dry`, ngunit sinusuri muna nito kung ano ang susuriin ng totoong pagpapatakbo: kapag nawawala ang isang key na kailangan ng pamamaraan (`OPENROUTER_API_KEY`, `DEEPL_API_KEY`, …), nagbababala ito na hihinto ang totoong pagpapatakbo at pinapangalanan ang variable. Sinusuri nito na nakatakda ang key, hindi na gumagana ito: walang ipinapadala, kaya pumapasa ang isang placeholder. Nag-e-exit pa rin ito nang `0` — hindi kailanman nabibigo ang isang preview (tingnan ang [mga exit code](#sync-exit-codes)). Ganoon din para sa `--max-cost`: ang isang dry run ay hindi humihinto sa cap, ngunit kapag ang pagtatantya ay lampas dito (o hindi alam) sinasabi nito, nang isang beses, sa dulo, na ang totoong pagpapatakbo ay hihinto doon at mag-e-exit nang `2`. Gamit ang `--json` ang bawat linya ay isang JSON object na may `level` (`info`, `ok`, `event` sa stdout; `warn`, `error` sa stderr), at ang huling linya ng stdout ay ang buod, `{"level": "summary", "command": "sync", …}`, na may dalang `preflight: { ready, failures }`, na may cap na `maxCost: { cap, estimatedCost, wouldStop, exitCode }`, at `realRun: { exitCode, wouldStop, reasons }` — ang exit code kung saan magtatapos ang totoong pagpapatakbo, ayon sa kayang matukoy ng isang preview (tingnan ang [mga exit code](#sync-exit-codes)). Patakbuhin ito gamit ang mga flag na ginagamit ng totoong sync (`--method`, `--model`): kung wala ang mga ito sinusuri nito ang pamamaraang pinapangalanan ng config. Ang sariling exit code ng isang dry run ay hindi kailanman nagpapabagsak sa isang hakbang sa CI, kaya sinasabi ng babala nitong `--max-cost` kung paano mag-gate: basahin ang `maxCost.wouldStop` (o `realRun.exitCode`) mula sa buod ng `--json` — halimbawa `jq -e 'select(.level == "summary") | .preflight.ready and (.maxCost.wouldStop | not)'`. Ginagawa iyon ng [check step ng gabay sa CI](/docs/guides/ci-cd#check-before-sync) at, kapag nabigo ito, iniimprenta kung bakit (`realRun.reasons`) sa halip na isang simpleng `false`. Binibilang ng `totalPluralGaps` ng dry run ang mga plural message sa disk na walang anyong ginagamit ng wika na hindi na muling hihilingin ng totoong pagpapatakbo, at ang `verify` ay `{ "ran": false }` (walang isinulat, kaya walang na-verify).

**Muling pagsasalin**: Sinasabi ng `--redo` kung *ano* ang muling isasalin at sinasabi ng `--fresh` kung *magbabayad para dito*. Kung walang `--fresh`, ang anumang nasa cache na ay ibinabalik nang libre (at pumapasa pa rin sa quality gate); kung mayroon nito, ang lahat ng nakapila ay muling isasalin at sisingilin. Gumagana pa rin ang mas lumang mga flag (`--force`, `--force-keys`, `--force-content`, `--retranslate`, `--no-tm`) at eksaktong nangangahulugan ng sinasabi ng talahanayan.

**Pag-scope sa mga file**: Nililimitahan ng `--files` ang content step sa mga tumutugmang file, at pinipilit ng `--redo files:<glob> --fresh` ang mga bagong salin para sa mga tumutugmang file (ang nag-iisang sinasadyang muling paggastos). Itinutugma ng mga pattern ang mga path na iniimprenta ng sync (relative sa `contentDir`, `2026-10.md`) at ang parehong path mula sa project root (`newsletter/2026-10.md`): ang `*` ay nananatili sa loob ng isang folder at ang `**` ay tumatawid sa mga folder. Maaaring ulitin ang parehong flag. Ang isang pattern na hindi tumutugma sa anumang file ay nagpapahinto sa pagpapatakbo bago magastos ang anuman. Ang hakbang ng key-value ay incremental na at tumatakbo gaya ng dati.

**Mga kabiguan**: Ang pagkabigo ng isang content file ay hindi nagpapahinto sa iba. Itinatala ang mga file na nagtagumpay at kina-cache ang kanilang mga salin, at nagtatapos ang pagpapatakbo sa isang listahan ng mga nabigong file at kung ano ang kinahantungan ng bawat isa. Ang isang linya ng file ay hindi kailanman mababasa bilang `[OK]` kapag ang mga key sa loob nito ay hindi naisalin. Sinasabi ng buod ng kabiguan, bawat key, kung ano ang gagawin ng susunod na sync: muling magtatanong (walang magagamit na sagot), magtatanong nang isa pang beses (pending mula sa isang redo), o pipigilin ito (tinanggihan ng quality gate). Ang mga Markdown block at front-matter field na tinanggihan ng gate ay pinipigil sa parehong paraan, bawat pahina; ang `--redo files:<page>` o `--redo content` ay muling nagtatanong ([Quality Gate](/docs/concepts/quality-gate#refused-markdown-blocks-and-front-matter-fields)). Ang exit code ay `0` (lahat ay maayos), `2` (partial: may natapos na trabaho, may nabigo, pinigil o hindi na-verify, may naisulat na plural message nang walang anyong ginagamit ng wika para sa karaniwang bilang — o pinahinto ng `--max-cost` bago magastos ang anuman) o `1` (walang nagtagumpay).

**Change detection**: Nag-iimbak ang champollion ng mga SHA-256 hash sa `.champollion.lock`. Kapag nagbago ang mga source value, awtomatikong muling isinasalin ng susunod na sync ang mga key na iyon. I-commit ang lock file upang maibahagi ng lahat ng developer ang baseline. Itinatala rin ng lock, bawat target locale, ang fingerprint ng bawat value na isinulat ng sync (upang ang isang value na in-edit ng tao ay makilala at mapanatili ng mga maramihang redo — [Pag-edit ng mga salin](/docs/guides/professional-translators#editing-key-value-files)), ang mga key na hindi natapos ng isang redo (**pending**: muling hihilingin ng susunod na sync ang mga ito nang isa pang beses) at ang mga key na tinanggihan ng quality gate (**held back**: hindi na muling ipapadala sa parehong model sa isang payak na sync — [Quality Gate](/docs/concepts/quality-gate#refused-keys-are-held-back)).

**Mga manu-manong pag-edit at redo**: Pinapanatili ng `--redo all`, `--force` at ng pagpapalit ng model ang mga value na in-edit ng isang tao, at sinasabi kung alin; ang `--redo keys:<key>` na nagpapangalan ng isang key ay pumapalit dito; ang isang key na nagbago ang source ay muling isinasalin. Ang isang napalitang pag-edit ay iniimprenta at idinaragdag sa `.champollion-replaced-edits.jsonl` (sinusubaybayan — i-commit ito kasama ang lock).

**mga gettext key na may konteksto**: ang isang key ay `msgctxt` + U+0004 + `msgid`. Iniimprenta ng mga ulat ang separator bilang `␄`, na tinatanggap naman ng `--redo keys:` at `--force-keys`; upang mag-type ng isa, isulat ang `\x04`: `--redo 'keys:django::verb\x04Open'` (pinapanatili ng single quotes ang backslash). Gumagana ang parehong baybay. Iniimprenta ng mga repair command ang anyong `␄`, na sinusundan ng isang komento sa shell na nagpapangalan sa `\x04`.

**Isang pinangalanang key na walang tinutugmang anuman**: Ang `--redo keys:` / `--force-keys` na may pangalang wala sa anumang source key (isang typo, o isang msgid na umiiral lamang na may konteksto) ay nabibigo na may exit 1. Inililista ng error ang pinakamalapit na mga key, kabilang ang bawat context variant ng msgid na iyon, sa parehong baybay. Kapag walang tumugma sa alinman sa mga pangalan, walang tatakbo. Kapag may ilang tumugma, ang mga iyon ay muling gagawin, at pagkatapos ay mabibigo ang pagpapatakbo habang pinapangalanan ang iba pa.

**Isang pinangalanang key na isinilbi mula sa cache**: kung walang `--fresh`, isinisiwalat ng isang redo kung ano ang nasa cache (muling sinuri, nang walang bayad) at sinasabi ito, kasama ang command na `--fresh` na muling magtatanong sa model at ang gastos nito.

**Parallelism**: Parehong tumatakbo nang parallel ang JSON key translation at content translation. Sabay-sabay na isinasalin ang mga JSON locale (default: 200 concurrent locale), at naka-parallel din ang mga batch sa loob ng bawat locale (4 concurrent batch). Ang content translation (Markdown, MDX, mga blog post) ay tumatakbo sa isang flat work-item pool (default: 48 concurrent API call). I-override gamit ang `--json-concurrency`, `--content-concurrency`, o `--concurrency` (itinatakda ang pareho).

**Output**: Ipinapakita ng Sync ang isang version banner, pagtukoy sa format/framework, pagtataya ng gastos, at mga progress bar kada locale:

```
champollion v0.1.0

[INFO] Detected format: json (auto)
[INFO] Source: en.json (2,847 keys)
[INFO] Pairs: es-MX:llm, fr:deepl

[INFO] es-MX.json — 2,847 missing
     ████████████████████████████████ 2,847/2,847 keys
[INFO] fr.json — 2,847 missing
     ████████████████████████████████ 2,847/2,847 keys
[OK] Synced 5,694 keys total.
```

Nag-a-update in-place ang mga progress bar pagkatapos ng bawat batch (~80 key). Gamitin ang `--quiet` para sa mga error/warning lamang, o `--json` para sa machine-readable na NDJSON output. Parehong pinipigilan ng mga ito ang progress bar at banner. Gamit ang `--json`, dumarating ang isang `cost` event bago ang `--max-cost` gate, dumarating ang isang `file` event para sa bawat content file at locale, at isang `summary` ang nagsasara sa bawat pagpapatakbo.

### Mga exit code {#sync-exit-codes}

| Code | Isang totoong pagpapatakbo | Isang dry run (`--dry`) |
|------|------------|---------------------|
| `0` | Ang lahat ng nakapila ay naisalin at na-verify, o walang nakapila. | Tumakbo ito — kahit na sinasabi nitong hihinto ang totoong pagpapatakbo. |
| `2` | Partial: may natapos na trabaho, ngunit may nabigo, pinigil o hindi na-verify, o may naisulat na plural message nang walang anyong ginagamit ng wika para sa karaniwang bilang. Gayundin: pinahinto ng `--max-cost` ang pagpapatakbo bago may naipadalang anuman. | Hindi kailanman. |
| `1` | Walang nagtagumpay, o hindi masimulan ang pagpapatakbo: nawawala ang isang key na kailangan ng pamamaraan, hindi sumasagot ang model server na kailangan ng pagpapatakbo, ang isang key na pinangalanan para sa redo ay walang tinutugmang anuman, ang isang pattern ng `--files` ay hindi tumutugma sa anumang file, o hindi wasto ang config. | Ang dry run mismo ay hindi mapatakbo: ang isang key na pinangalanan para sa redo ay walang tinutugmang anuman, ang isang pattern ng `--files` ay hindi tumutugma sa anumang file, o hindi wasto ang config. |

Sadyang nag-e-exit nang `0` ang isang dry run: ito ang preview na inyong pinapatakbo bago magdesisyon, at ang isang hakbang sa CI na tumitingin lamang ay hindi dapat mabigo. Ang gagawin ng totoong pagpapatakbo ay nasa mga huling linya ng dry run at sa buod nitong `--json`: ang `preflight.ready: false` ay nangangahulugang hihinto ang totoong pagpapatakbo bago magsalin at mag-e-exit nang `1` (sinasabi ng `preflight.failures` kung bakit); ang `maxCost.wouldStop: true` ay nangangahulugang hihinto ito sa cap at mag-e-exit nang `2` (`maxCost.exitCode: 2`); ang `maxCost.exitCode: 1`, kasama ang `maxCost.stopsEarlier`, ay nangangahulugang papahintuin ito ng preflight bago masuri ang cap. Pinagsasama ng `realRun.exitCode` ang mga ito, kasama ang mag-iiwan sa totoong pagpapatakbo bilang partial: mga key na pinigil, o mga plural message sa disk na walang anyong ginagamit ng wika na hindi na muling hihilingin nito (`2`; pinapangalanan ng `realRun.reasons` ang mga ito, at sinasabi ito ng huling linya ng dry run). Ang pagtanggi ng quality gate o isang nabigong verification, na ang totoong pagpapatakbo lamang ang makakahanap, ay maaari pa ring magpalit sa isang hinulaang `0` tungo sa isang `2`. Ginagawa ng [check step ng gabay sa CI](/docs/guides/ci-cd#check-before-sync) ang mga ito na isang bumabagsak na hakbang sa CI na nag-iimprenta ng dahilan.

---

## watch

Awtomatikong nagse-sync kapag nagbago ang source locale file. Tumatakbo hanggang ihinto gamit ang `Ctrl+C`.

```bash
champollion watch
```

---

## audit

Ang completeness gate. Inililista ang bawat key na hindi naisalin — nawawala, walang laman, o nananatiling isang fallback na `[EN]` — at bawat salin na **out of date**: ginawa mula sa mas lumang source text kaysa sa kasalukuyan (ayon sa `.champollion.lock`; ang isang pag-edit sa source na nabigo ang muling pagsasalin ay nag-iiwan ng eksaktong ganito). Ang bawat listahan ng out-of-date ay nagtatapos sa command na muling nagsasalin nito. Nag-e-exit nang may code 1 kung may anumang natagpuan — gamitin bilang CI gate upang ibagsak ang mga build na may hindi kumpleto o lumang mga salin.

```bash
champollion audit
champollion audit --json   # summary carries untranslatedKeys and outOfDateKeys per locale
```

---

## verify

Muling binabasa ang lahat ng locale file mula sa disk at bine-verify na talagang naroon at tama ang mga salin. Ito ang parehong verification na awtomatikong tumatakbo sa dulo ng bawat `sync` (maliban kung ipapasa ang `--no-verify`).

```bash
champollion verify                    # verify all locale files
champollion verify --warn-only        # non-blocking
champollion verify --strict           # warnings fail too
champollion verify && echo "All good" # CI gate
champollion verify --json             # one "verify" record per locale (NDJSON)
```

**Ang mga sinusuri nito:**
- Key parity — lahat ng source key ay naroroon sa bawat target (para sa mga i18next plural key, ang mga key ng sariling CLDR plural form ng locale: kailangan din ng French ang `count_many`)
- Mga marker ng fallback na `[EN]` mula sa mga naunang pagpapatakbo
- Mga blangkong salin
- Script compliance — hindi dapat maglaman ng Latin-only na teksto ang isang non-Latin na locale; inuuri ang mga titik ayon sa Unicode script, kaya ibinibilang bilang Latin ang may accent at fullwidth na Latin. Ang mga fullwidth Latin letter ay isang error sa anumang locale sa labas ng tipograpiyang CJK
- Mga placeholder, bawat finding ay pinapangalanan ayon sa sintaks na sangkot — estruktura ng ICU MessageFormat (`ICU structure error`: isang argument na `{name}`, isang naisaling keyword o selector ng plural/select, isang nawawalang `#`), mga conversion ng printf (`printf/python-format placeholder mismatch`: `%s`, `%d`, `%(name)s` — ang nawawalang `%(name)s` ng isang gettext catalog ay pinapangalanan bilang printf, hindi ICU), interpolasyon ng i18next (`i18next {{…}} placeholder mismatch`: `{{name}}`, kabilang ang `{{name}}` na nakasulat bilang `{name}`, na iniimprenta ng i18next nang walang pagbabago), at isang single-brace na `{name}` sa labas ng isang mensahe ng ICU (`{…} placeholder mismatch`)
- Markup — bawat tag name ay may parehong pambungad, pansara, at self-closing tag gaya ng source, na naka-nest sa parehong paraan (isang error ang nawawalang `</strong>`)
- Mga isyu sa encoding — mga BOM marker, mga hindi nakikitang karakter
- Mga echo ng source — mga value na kapareho ng source (babala)
- Mga anyong plural — isang plural message na walang anyong ginagamit ng wika para sa karaniwang bilang (Russian `few`/`many`), isang gettext entry na inuulit lamang ng mga anyo nito ang `other` (minamarkahan ng sync ang mga iyon gamit ang isang komentong `# champollion:`), isang i18next key o `msgstr[n]` para sa isang anyong wala sa wika (mga babala)
- Magkakaparehong locale — dalawang target locale na may parehong teksto para sa karamihan ng mga key: malamang na ang isa ay nasa wika ng isa (babala)
- Parehong teksto, magkakaibang source — isang tekstong isinulat para sa ilang magkakaibang source string (isang model na nag-uulit ng isang sinaulong pangungusap): dalawang malinaw na magkaibang multi-word string na sinagot ng parehong teksto na may apat o higit pang salita, o tatlo o higit pa kung hindi; ang isang pangungusap na nahuli ng isang mas naunang sync na inulit ng model ay ibinibilang kahit minsan lamang. Binibilang ito sa mga key value, bawat branch ng ICU plural/select (ang mga branch ng isang plural ay ibinibilang bilang iisang source) at ang mga Markdown page ng locale (mga front-matter field at block; bukod ang `# ` at mga bantas sa dulo), sa pamamagitan ng parehong panuntunan kung saan ito tinatanggihan ng gate ng `sync` (error)
- Out of date — isang saling ginawa mula sa mas lumang source text kaysa sa kasalukuyan (babala rito; nabibigo ang `audit` dito)
- Isang natanggal na tandang pananong o padamdam — nagtatapos ang source sa `?` o `!` at ang salin ay hindi nagtatapos doon o sa katumbas ng target script (`？`, `؟`, Greek `;`, …). Isang babala: ang ilang wika ay nagmamarka ng tanong gamit ang isang salita o particle sa halip

Sinusuri nito ang estruktura, hindi ang kahulugan: sinasabi ng pagpasa na buo ang
mga key, placeholder, plural, markup, at script, hindi na tama ang sinasabi ng teksto —
ipasuri sa isang nagsasalita ng wika bago ito asahan.

**Aling mga locale.** Sinusuri ng `verify` ang bawat locale; sinusuri ng `verify --pair en:fr`
ang French lamang. Pagkatapos ng `sync --pair en:fr`, sinasaklaw ng post-sync check ang mga pares
na tumakbo, wala nang iba. Sinasabi ito ng isang naka-scope na pagsusuri sa pansarang linya nito — `Verification
passed for fr: … intact (only en:fr was synced; champollion verify checks every
locale)` — and never "in every locale"; with `--json` dala ng linyang iyon ang
`checked` (ang mga na-check na locale) at `scope`.

**Plural coverage.** Ang block ng bawat locale ay may isang linya bawat uri ng plural na
dala ng mga file nito — mga i18next suffixed key, mga mensahe ng ICU plural, mga gettext
`msgid_plural` entry — na pinapangalanan ang mga anyong inaasahang mayroon ang locale
(ang mga plural category ng CLDR para dito; sa isang gettext catalog, ang mga may slot ang
`Plural-Forms` nito) at kung mayroon nito ang bawat plural:

```text
  ── fr ──────────────────────────────────────
  [OK] 7/7 keys present
  Plural forms (CLDR fr): one, many, other ✓ — 2 i18next plural key group(s), every form present
```

Pinapangalanan ng `✗` ang mga plural na kulang sa isang anyo. Ang isang anyo na mga numero lamang na lampas sa 1000 o
mga praksiyon ang gumagamit (French `many` sa isang mensahe ng ICU) ay inihihiwalay: ang anyong `other`
ang kumakatawan para dito, na hindi itinuturing na finding. Ang linya ay isang buod — ang isang
nawawalang anyo ay isa ring finding sa itaas nito (isang nawawalang key, isang babala sa plural).

Nagsusulat ang **`--json`** ng isang JSON object bawat linya. Bawat locale ay nakakakuha ng record sa
stdout — `{"level": "event", "event": "verify", "locale": "fr", …}` — na may
`ok`, `keys` (`expected`, `present`, `missing`, `extra`), ang `errors` nito,
`warnings` at `infos`, `placeholders` (bawat finding kasama ang `syntax` nito: `icu`,
`printf`, `i18next`, `brace` o `markup`) at `plurals` (bawat uri at uri:
`categories`, `total`, `complete`, `incomplete`). Ang mga finding ay mga linya ring
`error`/`warn` sa stderr, at pinapanatili ng pansarang linya ang level at
mensahe nito (`ok` sa stdout kapag pumasa ang pagsusuri, `error` sa stderr kapag hindi
ito pumasa) at dala nito ang mga bilang ng `errors` at `warnings`. Pagkatapos ng isang sync, ang parehong
mga record ay nauuna sa sariling buod ng sync. (Ang mga record ng isang proyekto sa Docusaurus
ay walang dalang `keys` o `plurals`: ang mga string ng UI nito ay sinusuri nang bawat file.)

```bash
npx champollion verify --json 2>/dev/null | jq -c 'select(.event == "verify") | {locale, plurals}'
```

**Exit code:** `1` kapag nakakita ito ng error — o kapag wala itong masuri
kahit ano (ang source file o ang folder ng mga locale ay wala kung saan nakaturo ang config;
pinapangalanan ng linya ng error ang path at ang setting), `0` kung hindi. Hindi ito
ibinabagsak ng mga babala maliban kung ipapasa ninyo ang `--strict`, na nag-e-exit nang `1` sa anumang babala (isang CI na
hindi dapat mag-ship, halimbawa, ng mga Russian plural nang wala ang kanilang mga anyong `few`/`many`) at nagtatapos
sa isang linyang `[FAIL]`, hindi kailanman `[OK]`; pinag-e-exit din ng `--warn-only` ang mga error nang `0`.
Sinasabi ito ng isang locale na hindi tugma ang bilang ng key sa halip na `[OK]`:
`8 expected, 9 present (1 extra: count_two)`.

---

## lint

Ini-scan ang source code para sa hardcoded na mga user-facing string na dapat gumamit ng mga i18n translation call. Awtomatikong dine-detect ang inyong framework (next-intl, react-i18next, vue-i18n, Hugo).

```bash
champollion lint                    # exits 1 if issues found (or no source files were found)
champollion lint --warn-only        # always exits 0
champollion lint --src ./app        # custom source directory
champollion lint --min-length 4     # minimum string length to flag
```

**Ang nade-detect nito:**
- Hardcoded na mga string sa JSX text, `placeholder`, `alt`, `aria-label`, `title`
- Mga file na may user-facing content ngunit walang import ng i18n framework
- Dead keys — mga locale key na walang nire-reference na source file
- Coverage score — porsiyento ng mga string na dumadaan sa i18n

**Mga exclusion**: Gumawa ng `.champollionignore` sa project root ninyo (mga glob pattern, tulad ng `.gitignore`).

**Isang kabiguan ang kawalan ng ilo-lint**: kapag walang source file na tumugma (ang mga default na folder ng framework — `src/`, `app/`, `pages/`, `components/` para sa mga web project — o ang inyong `--src`), nag-e-exit ang lint nang `1` at pinapangalanan ang mga folder at extension na hinanap nito. Ang isang lint na walang nasuri ay hindi dapat makapasa sa isang CI gate; ituro ito sa inyong code gamit ang `--src <dir>` o `"lint": { "srcDir": "<dir>" }`.

---

## wrap

Awtomatikong bina-wrap ang hardcoded na mga string na na-detect ng `lint` sa mga `t()` call. Gumagawa ng awtomatikong backup bago baguhin ang mga file.

```bash
champollion wrap                    # auto-wrap with backup
champollion wrap --dry              # preview wrapping changes
champollion wrap --undo             # restore from .champollion-backup/
```

**Mga safety gate:**
1. Git-clean check (nilalaktawan sa dry-run)
2. Awtomatikong backup sa `.champollion-backup/`
3. Diff preview bago ang bawat pagsulat sa file
4. Suporta sa `--undo` upang mag-restore mula sa backup

---

## seo

Bumuo ng mga SEO artifact para sa multilingual na mga site.

```bash
champollion seo hreflang                                        # print hreflang tags
champollion seo sitemap --base-url https://example.com --out sitemap.xml
champollion seo jsonld --base-url https://example.com           # JSON-LD schema
```

| Subcommand | Output |
|------------|--------|
| `hreflang` | mga `<link rel="alternate" hreflang>` tag |
| `sitemap` | Multilingual na `sitemap.xml` |
| `jsonld` | JSON-LD WebSite language schema |

---

## integrity

Tinutukoy ang corruption at drift sa mga naisaling locale file.

```bash
champollion integrity               # exits 1 if issues found
champollion integrity --warn-only   # non-blocking
```

**Ang mga sinusuri nito:**
- Pagkasira ng placeholder (hal., `{name}` na nasa source ngunit nawawala sa target)
- Mga isyu sa encoding (mojibake, di-wastong Unicode)
- Mga hindi naisaling kopya (ang target value ay kapareho ng source) — hindi kasali ang mga key na [`noTranslate`](/docs/getting-started/configuration#no-translate), gayundin ang mga echo na kinukumpirma ng Translation Memory bilang ginawa ng pipeline at inaprubahan ng gate. Ang nananatiling naka-flag ay eksaktong kung ano ang muling pipilahan ng `sync` — hindi maaaring magkaiba ng pasya ang dalawang tool tungkol sa isang maayos na file
- No-translate drift (isang key na `noTranslate` na *hindi* kapareho ng source) — iniuulat kasama ang inaasahan/aktwal na mga value at naka-escape ang mga hindi nakikitang karakter; patakbuhin ang `champollion sync` upang kumpunihin
- Hindi inaasahang PUA (mga Private Use Area codepoint sa isang locale na naka-off ang [script conversion](/docs/getting-started/configuration#script-conversion) — nagre-render nang blangko nang walang espesyal na font); patakbuhin ang `champollion repair-script` upang kumpunihin
- Mga hollowed value (isang target na katulad ng source nito ngunit tinanggal ang mga titik — pinsala mula sa isang pipeline na mas luma kaysa sa content-preservation gate); muling isalin gamit ang `sync --force-keys <key>` o `sync --pair <pair> --force`
- Mga naulilang key (mga key sa target na wala sa source)
- Pagkakumpleto ng plural category sa ICU MessageFormat (hal., kailangan ng Arabic ng 6 na kategorya) — ayon sa parehong patakaran na ginagamit ng `sync` at `verify`: ang isang nawawalang anyo na naaabot ng mga karaniwang bilang (Russian `few`/`many`) ay isang babala; ang isa na mga numero lamang na lampas sa 1000 o mga praksiyon ang umaabot (French `many`, ginagamit para sa 1 000 000) ay isang paalala, dahil ang anyong `other` ang ginagamit doon

---

## repair-script

Binabaligtad ang script conversion na hindi dapat nangyari: ang mga PUA-encoded value (pIqaD, Tengwar, Kryptonian) sa mga locale na nagsasabing naka-off ang conversion sa kanilang configuration ay ibinabalik sa romanisasyon sa pamamagitan ng sariling reverse table ng converter.

```bash
champollion repair-script --dry     # preview
champollion repair-script           # repair in place
```

| Opsyon | Epekto |
|--------|--------|
| `--dry` | I-preview ang mga kumpuni nang hindi nagsusulat |
| `--locale <code>` | Kumpunihin ang isang locale lamang |
| `--json` | Machine-readable na JSON output |
| `--warn-only` | Mag-exit nang 0 kahit may nananatiling hindi maibabaligtad na PUA |

Eksaktong nababaligtad ang pIqaD. Hindi kayang bawiin ng mga pagbaligtad sa Tengwar at Kryptonian ang kapitalisasyon (minarkahan bilang case-lossy). Hindi kailangan ng kumpuni ng Translation Memory — nag-iimbak ito ng mga pre-conversion value. Nag-e-exit nang 1 kapag may nananatiling PUA na walang nakarehistrong converter ang makapagbabaligtad.

---

## tm

Pamahalaan ang Translation Memory cache (`.champollion/tm.json`). Iniimbak ng TM ang mga naunang salin at inihahatid ang mga ito sa mga susunod na sync sa halip na tumawag sa API.

```bash
champollion tm stats                  # show cache statistics
champollion tm clear                  # clear cache (with confirmation)
champollion tm clear --yes            # clear without confirmation
champollion tm clear --locale fr      # clear only French entries
```

| Subcommand | Output |
|------------|--------|
| `stats` | Bilang ng entry, laki ng file, breakdown kada locale |
| `clear` | Tanggalin ang cache file (buo o kada locale) |

| Option | Effect |
|--------|--------|
| `--locale <code>` | I-clear lamang ang mga entry para sa isang locale |
| `--yes` | Laktawan ang confirmation prompt |

Tingnan ang [Translation Memory](/docs/concepts/translation-memory) para sa kung paano gumagana ang TM at kung kailan ito dapat i-clear.

---

## xliff

Mag-export at mag-import ng mga XLIFF 1.2 file para sa pagsusuri ng propesyonal na tagasalin. Ang XLIFF ay ang universal exchange format na sinusuportahan ng mga CAT tool tulad ng memoQ, SDL Trados, at Phrase.

```bash
champollion xliff export --locale fr                   # export French XLIFF
champollion xliff export --locale ja --out ./review/   # custom output path
champollion xliff import .champollion/xliff/fr.xliff       # import reviewed file
champollion xliff import ./reviewed.xliff --dry        # preview import
```

| Subcommand | Output |
|------------|--------|
| `export` | Bumuo ng `.xliff` mula sa source + target locale files |
| `import` | I-merge ang mga nirepasong salin na `.xliff` sa mga locale file |

| Option | Effect |
|--------|--------|
| `--locale <code>` | Target na locale para sa export (kinakailangan) |
| `--out <path>` | Custom na output path o directory |
| `--dry` | I-preview ang import nang hindi nagsusulat |

Tingnan ang [Paggawa kasama ang mga Propesyonal na Tagasalin](/docs/guides/professional-translators) para sa buong workflow.

---

## status

Ipakita ang configuration ng pares, mga naka-install na plugin, at mga benchmark score.

Ipinapakita ito ng isang pares na ang config ay nagtatakda ng `qualityTier` (`standard`, `high`, `research` o
`verified`), sinabi ayon sa kung ano ito: isang label na inyong pinili, hindi isang
sukat — pareho ang pagsasalin ng sync anuman ang sinasabi nito, at iniaanunsyo ito ng
`serve`. Ang isang pares na hindi nagtatakda nito ay walang ipinapakita (ang `--json` ay mayroon pa ring
`qualityTier`, kasama ang `qualityTierSet: false`).

```bash
champollion status
```

Pagkatapos ng pagpapalit ng model sinasabi rin nito kung kailan naghahalo ang teksto mula sa higit sa
isang model sa mga file ng isang locale (mula sa Translation Memory: aling model ang gumawa ng bawat value
sa disk), kasama ang command na nag-uutos sa kasalukuyang model na isalin ang mga isinulat ng
isang mas naunang model — `sync --pair <pair> --redo all --fresh-on-model-change`.
Para sa isang pamamaraan na nagpapatakbo ng isang model na inyong pinili (`local`, `api`, `external`)
inuulit nito ang tala ng lisensya na minsan nang inimprenta ng unang sync. Para sa isang OpenAI-compatible
na pamamaraan (`local`, `openai`) ipinapakita nito ang address kung saan napupunta ang mga request at ang setting
na pumili rito: `LOCAL_API_BASE` sa environment o sa `.env`, o ang default
(Ollama, `http://localhost:11434/v1`). Gamit ang isang `contentDir` inililista nito ang content
folder sa tabi ng mga key-value file, kasama kung gaano karaming source page ang nilalaman nito at,
bawat wika, kung gaano karaming salin ang kasalukuyan, out of date o pending.
Ang ibig sabihin ng pending ay wala pang salin, o mga bahaging tinanggihan ng quality gate na iniwan sa source language (mababasa sa content lock ang `pending:<hash>`).
Sa ilalim ng bawat register ipinapakita nito ang gabay sa kasarian na dala ng mga LLM prompt at kung saan
ito nanggaling (ang default ng Champollion para sa wika, ang inyong config, o naka-off —
tingnan ang [Gender guidance](/docs/getting-started/configuration#gender-guidance)).
Para sa isang pares na may fallback, binibilang nito kung gaano karaming value sa mga file ang isinulat ng fallback,
at pinapangalanan ang unang iilan.
Dala ng `--json` ang parehong impormasyon gaya ng `requestsGoTo` (sa isang pares o fallback na may gayong endpoint), `content`, `genderGuidance` at `fallback.valuesInFiles`.

---

## provenance

I-audit ang licensing ng translation resource para sa lahat ng naka-install na plugin.

```bash
champollion provenance
```

---

## plugin

Pamahalaan ang mga translation method plugin. Ang mga plugin ay pre-packaged na translation recipe na naka-install sa `.champollion/methods/`.

```bash
champollion plugin list                      # show installed plugins
champollion plugin install ./my-method/      # install from local directory
champollion plugin remove my-method          # remove a plugin
```

Tingnan ang [Plugin Specification](/docs/reference/plugin-spec) para sa format ng plugin manifest.

---

## leaderboard

`champollion network leaderboard` (gumagana rin bilang `champollion leaderboard`). Mag-browse, maghanap, at mag-install ng mga pamamaraan ng pagsasalin mula sa leaderboard ng Network. Ang mga pamamaraang naka-install mula sa leaderboard ay may kasamang mga benchmark score at ang buong canonical na MethodConfig — ang eksaktong configuration na ginamit noong panahon ng ebalwasyon.

```bash
champollion network leaderboard                       # show leaderboard
champollion network leaderboard --pair "eng>fra"      # filter by language pair (quote the >)
champollion network leaderboard --install 1           # install the method ranked 1 as a plugin
champollion network leaderboard --install 1 --apply   # install + patch config
```

| Opsyon | Epekto |
|--------|--------|
| `--pair <pair>` | I-filter ayon sa language pair, ayon sa pagkakasulat ng board dito: `"eng>fra"` (ISO 639-3; i-quote ang `>`). Gumagana rin ang `eng-fra` at `eng:fra`, at nireresolba ang isang 2-titik na code (`en` → `eng`) |
| `--install <rank>` | I-install ang pamamaraan sa ranggong iyon (gaya ng nakalista) bilang isang plugin |
| `--apply` | Pagkatapos mag-install, awtomatikong idagdag ang `methodPlugin` sa `champollion.config.json` |

**`--apply` workflow:** Kapag nag-install kayo gamit ang `--apply`, isinusulat ng champollion ang method plugin sa `.champollion/methods/` **at** pini-patch ang inyong `champollion.config.json` upang gamitin ito para sa kaugnay na pair. Ito ang pinakamabilis na landas mula sa "ano ang may pinakamataas na score?" patungo sa "ginagamit ko na ito sa production."

---

## fonts

Nagda-download at namamahala ng mga PUA web font para sa mga constructed language script converter. Ang mga wikang gumagamit ng Private Use Area characters (Klingon, Sindarin, Kryptonian) ay nangangailangan ng custom na web fonts upang mai-render ang kanilang mga script. Dina-download ng command na ito ang mga ito mula sa mga verified open-source repository.

```bash
champollion fonts list                           # show needed fonts
champollion fonts install                        # download all needed fonts
champollion fonts install --css                  # also generate CSS snippet
champollion fonts install --dir ./public/fonts   # custom output directory
```

| Subcommand | Output |
|------------|--------|
| `list` | Ipinapakita kung aling mga PUA font ang kailangan at ang kanilang install status |
| `install` | Nagda-download ng mga font para sa mga naka-configure na wika |

| Option | Effect |
|--------|--------|
| `--dir <path>` | I-override ang font output directory (awtomatikong nade-detect mula sa project type) |
| `--css` | Bumuo ng isang `conlang-fonts.css` snippet kasabay ng mga font |
| `--config <path>` | Path papunta sa config file (ginagamit upang matukoy kung aling mga wika ang nangangailangan ng font) |

**Auto-detection:** Hinuhula ang output directory mula sa structure ng inyong proyekto:
- **Docusaurus** → `static/fonts/` o `website/static/fonts/`
- **Hugo** → `static/fonts/`
- **Default** → `public/fonts/`

Ang **Native Unicode converters** (`crk` → Cree Syllabics, `sr` → Serbian Cyrillic) ay HINDI nangangailangan ng font installation.

Tingnan ang [Conlangs, Scripts & Orthography](/docs/guides/conlangs-scripts-orthography) para sa kumpletong detalye ng PUA font.

## Three-Layer Pipeline

Gamitin ang `lint`, `sync`, at `audit` nang magkakasama para sa bulletproof na i18n:

```json title="package.json"
{
  "scripts": {
    "i18n:lint": "champollion lint",
    "i18n:sync": "champollion sync",
    "i18n:audit": "champollion audit"
  }
}
```

| Layer | Command | Kailan | Layunin |
|-------|---------|------|---------|
| **Lint** | `lint` | Pre-commit | Harangin ang mga commit na may hardcoded strings |
| **Sync** | `sync` | Post-commit / CI | Isalin ang nawawala at nagbagong mga key |
| **Verify** | `verify` | Post-sync / CI | Kumpirmahing naroroon at tama ang mga salin |
| **Audit** | `audit` | Build step | Pabiguin ang deployment kung may anumang locale na may mga marker na `[EN]` |

---

## Tingnan Din

- [Configuration](/docs/getting-started/configuration) — sanggunian ng config file
- [Translation Methods](/docs/guides/translation-methods) — pagpili ng method kada pair
- [Translation Memory](/docs/concepts/translation-memory) — caching at pagtitipid sa gastos
- [Paggawa kasama ang mga Propesyonal na Tagasalin](/docs/guides/professional-translators) — XLIFF workflow
- [Plugin Specification](/docs/reference/plugin-spec) — format ng plugin manifest
- [Gabay sa CI/CD](/docs/guides/ci-cd) — pag-automate ng mga CLI command sa inyong pipeline
- [Paano Gumagana ang Sync](/docs/concepts/how-sync-works) — pag-unawa sa sync pipeline
- [Quality Gate](/docs/concepts/quality-gate) — kung paano vina-validate ang mga salin
