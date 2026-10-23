---
sidebar_position: 3
title: "CI/CD"
---

# Pagsasama ng CI/CD

I-automate ang mga pagsasalin sa inyong build pipeline.

Ang champollion CLI ay source-available sa ilalim ng [PolyForm Noncommercial License 1.0.0](https://github.com/gamedaysuits/Champollion/blob/main/cli/LICENSE): libreng gamitin, baguhin, at ibahagi para sa mga layuning di-komersyal. Ang paggamit nito para sa isang komersyal na layunin ay hindi sakop ng lisensyang ito ([sino ang maaaring gumamit nito](/docs/getting-started/who-may-use-this)).

## GitHub Actions: panatilihing naka-sync ang mga pagsasalin

Isang kumpletong workflow: isalin ang mga nagbago, suriin ang resulta, at i-commit
ito pabalik. Gumagana ito para sa anumang proyekto — Node man o hindi (Django, Flutter, Hugo).

```yaml title=".github/workflows/i18n-sync.yml"
name: Sync translations
on:
  push:
    branches: [main]
    # Run only when something sync reads changed: the SOURCE locale files
    # (edit these to the files your config's "localesDir"/"localesPattern"
    # names) and the config. A push that changes neither has nothing to
    # translate, so it starts no job and needs no key.
    paths:
      - 'locales/en.json'       # one file per language
      - 'locales/en/**'         # or one folder per language (i18next: public/locales/en/**)
      - 'champollion.config.json'
  # Run workflow (by hand). The box asks again for plural forms a model
  # left out (--redo gaps; see "Plural forms a model left out" below).
  workflow_dispatch:
    inputs:
      redo_gaps:
        description: 'Ask again for plural forms a model left out (--redo gaps)'
        type: boolean
        default: false

permissions:
  contents: write          # lets the job push the translated files back

# One sync at a time per branch: two quick pushes would otherwise race to
# commit the same files. Queued, not cancelled — a cancelled run may have
# translated (and paid for) work it never committed.
concurrency:
  group: i18n-sync-${{ github.ref }}
  cancel-in-progress: false

# The flags of every `champollion sync` in this job — the sync step below,
# and the dry-run check further down this page, read this one line, so the
# check tests the method this job runs. The config's method runs as it is.
# A runner has no model server: if your config says "local" (a model on
# your machine), name a hosted model here instead, for these runs only
# (the config file is not changed):
#   SYNC_FLAGS: --method llm --model google/gemini-3.8-flash --max-cost 5
env:
  SYNC_FLAGS: --max-cost 5

jobs:
  sync:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 24   # a current LTS; champollion needs Node 20.11 or newer
      # The Translation Memory is a per-machine cache, so a fresh runner
      # starts empty. Restoring it means text translated before is served
      # free instead of billed again. No cache is saved under this exact
      # key: restore-keys brings back the branch's newest one.
      - name: Restore the translation cache
        id: cache
        uses: actions/cache/restore@v4
        with:
          path: .champollion
          key: champollion-tm-${{ github.ref_name }}-newest
          restore-keys: champollion-tm-${{ github.ref_name }}-
      - name: Sync translations
        id: sync
        env:
          OPENROUTER_API_KEY: ${{ secrets.OPENROUTER_API_KEY }}
        # Exit 2 = partial: some keys were translated, some were not (refused
        # by the quality gate, held back, a plural form the model left out, or
        # --max-cost stopped the run). What WAS translated is committed below,
        # then the job fails with the reason. Any other non-zero code stops here.
        #
        # $SYNC_FLAGS: the job's flags (env: above). The redo_gaps box of
        # "Run workflow" adds --redo gaps.
        run: |
          set +e
          npx --yes champollion@0.6 sync $SYNC_FLAGS ${{ inputs.redo_gaps && '--redo gaps' || '' }}
          code=$?
          echo "code=$code" >> "$GITHUB_OUTPUT"
          if [ "$code" -ne 0 ] && [ "$code" -ne 2 ]; then exit "$code"; fi
      # Saved even when a step failed: the translations this run paid for
      # stay cached, so the next run does not pay for them again. The key is
      # a hash of the cache's own files, so a run that added nothing to it
      # has the key it restored and skips the save (no new copy). Skipped too
      # when there is no cache folder (a push with nothing to translate on a
      # fresh runner creates none; saving it would log a path warning).
      - name: Save the translation cache
        if: always() && hashFiles('.champollion/**') != '' && steps.cache.outputs.cache-matched-key != format('champollion-tm-{0}-{1}', github.ref_name, hashFiles('.champollion/**'))
        uses: actions/cache/save@v4
        with:
          path: .champollion
          key: champollion-tm-${{ github.ref_name }}-${{ hashFiles('.champollion/**') }}
      - name: Commit updated translations
        run: |
          git config user.name "champollion"
          git config user.email "bot@example.com"
          # The translated files AND the lock files (.champollion.lock,
          # .champollion-content.lock), whatever your locale folders are called
          # — and .champollion-replaced-edits.jsonl when a sync wrote one.
          # .champollion/ (the cache) is in .gitignore — `champollion init` adds it.
          # (gettext: build steps write .mo files — stage only the catalogs; see below.)
          git add --all
          git diff --staged --quiet || git commit -m "chore: sync translations"
          # Someone may have pushed while this job ran: put this commit on
          # top of theirs, so the push does not fail (and waste the spend).
          git pull --rebase origin "$GITHUB_REF_NAME"
          git push origin "HEAD:$GITHUB_REF_NAME"
      # Right after the commit, before verify: on a partial run verify would
      # fail first on the missing keys, and the red step would name a key
      # while the reason sat in a green step.
      - name: Stop when the sync was partial
        if: steps.sync.outputs.code == '2'
        run: |
          echo "::error::champollion sync exit 2: the run stopped at --max-cost before translating, or some keys were not translated (refused by the quality gate, held back, or a plural form left out). What was translated is committed. The 'Sync translations' step's log says which."
          exit 1
      # --strict: a warning fails the job too. Plain verify passes on warnings
      # — an extra or missing plural form, a source echo, an out-of-date
      # translation — so they would ship with a green build.
      - name: Check every locale is complete and intact
        run: npx --yes champollion@0.6 verify --strict
```

**Bakit ganito ang pagkakabalangkas ng workflow.** Ang `actions/cache` sa sarili nito ay nagse-save lang ng
cache kapag nagtagumpay ang buong job, at ang `sync` ay nag-e-exit nang `2` tuwing mayroong key
na tinanggihan — kaya ang isang partial na pagpapatakbo ay dating lumalaktaw sa parehong pag-commit at pag-save ng cache,
at binayaran muli ng susunod na pagpapatakbo ang parehong mga pagsasalin. Dito, ang cache ay
nire-restore at sine-save bilang dalawang hakbang (`actions/cache/restore`, pagkatapos ay
`actions/cache/save` na may `if: always()`), itinatala ng hakbang ng pag-sync ang exit code nito
sa halip na mag-fail sa `2`, ang mga naisaling file ay kinokomit, at pagkatapos lamang
mag-fe-fail ang job — sa sarili nitong hakbang, bago ang `verify`, upang masabi ng nabigong hakbang
kung bakit (isang paghinto ng `--max-cost`, o mga key na hindi naisalin ng sync) sa halip na
`verify` na nagpapangalan sa nawawalang key. Ang huling hakbang ay `verify --strict`: ang payak na
`verify` ay nag-e-exit nang 0 sa mga babala (kabilang dito ang sobra o nawawalang anyong maramihan), at
ibinabagsak ng `--strict` ang job dahil sa mga ito. Natatandaan ang isang key na tinanggihan ng quality gate: hindi na ito
ipinapadala ng susunod na pagpapatakbo sa parehong modelo muli (sisingilin nito ang parehong sagot) —
pinapangalanan ito ng log ng sync at ang utos na `--redo keys:` na muling nagtatanong.

**Isang kopya ng cache bawat pagbabago, hindi bawat pagpapatakbo.** Ibabalik ng hakbang sa pag-restore ang
pinakabagong cache ng branch (ang eksaktong key nito, `…-newest`, ay hindi kailanman sine-save, kaya
pinipili ng `restore-keys` ang pinakabago). Isinasaayos ng hakbang sa pag-save ang key ng cache ayon sa
hash ng sarili nitong mga file (`hashFiles('.champollion/**')`): ang isang pagpapatakbo na may naisalin
— kahit isang partial na pagpapatakbo, o isa na nabigo ang pag-push — ay nagbago sa cache,
kaya nakakakuha ito ng bagong key at nai-save; ang isang pagpapatakbo na walang idinagdag (walang
isasalin, lahat ay mula sa cache, isang paghinto ng `--max-cost`) ay may key na
na-restore nito, kaya nilalaktawan ang pag-save at walang bagong kopya na iniimbak. Ang pag-key gamit ang run
id ay nagse-save ng buong kopya sa bawat pagpapatakbo; ang pag-key sa lock at mga source file ay
magre-restore ng mas lumang kopya ayon sa eksaktong tugma pagkatapos ng isang pagpapatakbo na tinanggihan ang push,
dahil ang na-commit na lock ay hindi kailanman nakuha ang mga pagbabago ng pagpapatakbong iyon.

Sa isang Node na proyekto, maaari ninyong idagdag ang `champollion` bilang dev dependency at tawagin
ang `npx champollion sync` sa halip; ang naka-pin na `champollion@0.6` sa itaas ay gumagana sa anumang
repositoryo at hindi kailanman kukuha ng ibang bersyon nang di-inaasahan. Dapat itong
i-install ng job: sa isang bagong runner, ang `npx champollion` na walang naka-install
ay kukuha ng pinakabagong bersyon, hindi ang naka-pin sa inyong lock file. At isinusulat ng pag-install
ang `node_modules/`, na iko-commit ng `git add --all` maliban kung nakalista ito sa inyong `.gitignore`
(ang nililikha ng `champollion init` ay naglilista lamang ng `.champollion/`), kaya
i-stage ang mga locale file at ang lock ayon sa pangalan, gaya ng ginagawa ng Django workflow sa ibaba:

```yaml title=".github/workflows/i18n-sync.yml (dev dependency)"
# … checkout and setup-node as above; then install the version your
# package-lock.json pins:
      - run: npm ci
# … the cache restore as above. In "Sync translations" and in the last step,
# the installed CLI replaces the pinned one (SYNC_FLAGS as above):
#   npx champollion sync $SYNC_FLAGS ${{ inputs.redo_gaps && '--redo gaps' || '' }}
#   npx champollion verify --strict
# … the cache save as above; then:
      - name: Commit updated translations
        run: |
          git config user.name "champollion"
          git config user.email "bot@example.com"
          # The locale files and the lock file only: not node_modules/ (npm ci
          # just wrote it) and not .champollion/ (the cache). Name your locale
          # folder (messages, public/locales, …); when sync translates Markdown
          # too, add the folders it writes and .champollion-content.lock.
          git add -- locales .champollion.lock
          # A replaced hand edit is recorded here — the only copy of that wording.
          if [ -f .champollion-replaced-edits.jsonl ]; then git add -- .champollion-replaced-edits.jsonl; fi
          git diff --staged --quiet || git commit -m "chore: sync translations"
          git pull --rebase origin "$GITHUB_REF_NAME"
          git push origin "HEAD:$GITHUB_REF_NAME"
```

**I-commit ang mga lock file.** Itinatala ng `.champollion.lock` at `.champollion-content.lock`
kung saang source text nagmula ang bawat pagsasalin. Sa pamamagitan ng mga ito nalalaman ng
susunod na pagpapatakbo kung nagbago ang isang string. Ang isang runner na hindi kailanman nakakakita sa mga ito ay hindi matutukoy ang
na-edit na string mula sa hindi nagalaw. **Huwag i-commit ang `.champollion/`** — ito ang
cache bawat machine; idinadagdag ito ng `champollion init` sa `.gitignore`.

Itinitigil ng **`--max-cost`** ang isang pagpapatakbo bago ito gumastos nang higit sa inyong inaasahan; itakda ito sa
halaga ng mga pagbabago sa isang karaniwang araw para sa inyo. Kapag pinahinto nito ang isang pagpapatakbo, walang
naisalin o naisulat at nag-e-exit ang sync gamit ang code na `2`: walang dapat i-commit,
at ibinabagsak ng hakbang na "Stop when the sync was partial" ang job nang may ganoong pahiwatig. Ang isang paraan na walang nai-publish na presyo (isang self-hosted
na endpoint sa ibang machine) ay hindi matatantiya, kaya humihinto ang `--max-cost`
tuwing mayroong isasalin — huwag itong paganahin para sa mga iyon. Ang isang modelong
naka-serve sa runner mismo (`local` sa `localhost`/`127.0.0.1`) ay may presyong
$0 API cost.

**Tanging mga push lamang na nagpapabago sa isang source string ang nagpapasimula sa job.** Inililista ng filter na `paths:`
ang inyong mga source locale file at `champollion.config.json`: ang isang push
na code lamang ang binabago, o mga pagsasalin at mga lock file lamang, ay walang
isasalin, kaya wala itong sisimulang job. I-edit ang dalawang path ng locale sa mga file na pinangalanan
ng inyong config (`messages/en.json`, `lib/l10n/app_en.arb`, …); idagdag ang inyong
folder na `contentDir` kapag nagsasalin din ang sync ng Markdown. Pinapatakbo pa rin ito nang manu-mano ng **Run workflow** (ang
trigger na `workflow_dispatch`).

**Ang sariling commit ng job ay hindi kailanman nagpapasimula rito muli** — at hindi ang filter na `paths:`
ang pumipigil dito. Nagpu-push ang hakbang sa pag-commit gamit ang `GITHUB_TOKEN` ng workflow,
at ang isang push na ginawa gamit ang `GITHUB_TOKEN` ay hindi kailanman nagti-trigger ng pagpapatakbo ng workflow (patakaran ng
GitHub, upang hindi masimulan ng workflow ang sarili nito). Iyon ang dahilan kung bakit maaaring bantayan ng Django workflow
sa ibaba ang `locale/**`, na binabago ng bawat commit ng bot.
Mag-push gamit ang personal access token o GitHub App token sa halip (upang magsimula
ng iba pang mga workflow sa commit ng bot, halimbawa) at sisimulan muli ng push na iyon ang
workflow na ito; kung gayon, ang filter na `paths:` ang magpapasya. Hindi isinasama ng filter sa itaas
ang mga naisaling file at ang mga lock file, kaya ang commit ng bot
ay hindi magsisimula ng pagpapatakbo. Isinasama ng `locale/**` ng filter ng Django ang mga catalog na kinokomit
ng bot, kaya ang bawat isa sa mga commit nito ay nagpapasimula ng isa pang pagpapatakbo — na walang makikitang
isasalin at walang iko-commit. Gamit ang gayong token, limitahan ito sa source
catalog (`locale/en/**`) at magdagdag ng mga wika sa pamamagitan ng config.

**Kailangan ang provider key sa bawat pagpapatakbong magsisimula**, maging kapag walang
kailangang isalin: sinusuri ng sync na maaaring tumakbo ang paraan bago nito tingnan kung ano
ang nagbago. Ang isang pagpapatakbong manu-manong sinimulan nang walang pagbabago sa source ay mabibigo pa rin nang wala ang
secret na `OPENROUTER_API_KEY` (o ang key ng inyong paraan). Hindi kailangan ng `local` ng key, ngunit
ang isang runner ay walang model server: ang isang proyektong nagsasalin gamit ang `local` sa
machine ng isang developer ay nagpapangalan ng isang hosted method sa CI (`--method` / `--model` — ang
naka-comment na linyang `SYNC_FLAGS` sa workflow sa itaas). Upang suriin kung nakakarating ang secret
sa hakbang, nang walang isinasalin, nagbababala ang `sync --dry` kapag hihinto ang
totoong pagpapatakbo at pinapangalanan ang nawawalang variable (nag-e-exit pa rin ito nang 0 — ang dry
run ay isang preview). Sinusuri nito na ang variable ay **nakatakda**, hindi na ang key ay
**gumagana**: wala itong ipinapadala, kaya ang anumang hindi bakanteng halaga ay papasa — pati ang isang placeholder.
Ang isang mali o binawing key ay makikita sa unang kahilingan ng isang totoong pagpapatakbo (pinapangalanan ng error
ang sagot ng provider, gaya ng HTTP 401). Upang ibagsak ang job dahil sa nawawalang
key bago may tumakbo, idagdag [ang pagsusuri bago ang sync](#check-before-sync).

**Pinapanatili ang cache bawat paraan.** Naka-cache ang isang pagsasalin sa ilalim ng paraan,
register, at coaching file na gumawa nito (muling ginagamit ito ng ibang modelo ng parehong
paraan — model carry-over). Samakatuwid, ang isang developer na nagsasalin gamit ang `local`
at ang CI na nagsasalin gamit ang hosted model ay hindi kailanman nagbabahagi ng mga cache entry —
at ang cache ng CI ay sarili nito (hindi naka-commit ang `.champollion/`). Hindi
nangangahulugang isinasalin muli ng CI ang proyekto: ang nasa mga locale file na,
nang naka-commit ang lock file nito, ay itinuturing nang tapos. Binabayaran ng CI ang hosted model para
sa mga string na bago o nagbago mula noong huling commit — kabilang ang anumang isinalin
ng isang developer nang lokal ngunit hindi na-commit — at wala para sa iba pa.
Ang muling pagsasalin sa buong proyekto gamit ang hosted model (`--redo all`) ay sumisingil
para sa bawat string nang isang beses.

**Ayon sa iskedyul** sa halip na sa push: palitan ang block na `on:` ng
`schedule: [{ cron: '0 6 * * *' }]`.

### Suriin bago ang sync: ibagsak nang maaga ang job {#check-before-sync}

Nag-e-exit ang isang dry run nang `0` anuman ang makita nito — ito ay isang preview — kaya nagbababala
ang `sync --dry --max-cost 5` na hihinto ang totoong pagpapatakbo sa limitasyon ngunit papasa pa rin
bilang hakbang sa CI. Upang ibagsak ang isang job kapag hihinto ang totoong pagpapatakbo (isang nawawalang key, o
`--max-cost`), basahin ang buod ng `sync --dry --json`. Ang output na iyon ay
isang JSON object bawat linya (NDJSON), bawat isa ay may `level` — mga linyang `info`, `ok`, at
`event` sa stdout, mga linyang `warn` at `error` sa stderr — at ang huling
linya sa stdout ay ang buod, `{"level": "summary", "command": "sync", …}`.
Piliin ito ayon sa antas nito. **Patakbuhin ito gamit ang parehong mga flag gaya ng sync**: kung wala
ang mga ito, sinusuri nito ang paraang pinangalanan ng config, kaya para sa isang proyektong nagsasabi ang config
ng `local`, susuriin nito ang lokal na paraan — hindi ang hosted model na pinapatakbo
ng job — at papasa sa isang runner na walang key. Bilang isang hakbang sa workflow sa itaas,
bago ang "Sync translations", binabasa nito ang parehong `SYNC_FLAGS`:

```yaml
      - name: Check the sync can run (translates nothing)
        env:
          OPENROUTER_API_KEY: ${{ secrets.OPENROUTER_API_KEY }}
        # The JSON lines go to $out; the warnings (stderr) stay in the log.
        # When the check fails, the step prints why: the summary's
        # realRun.reasons, or its error when sync could not run at all
        # (that exit code is not fatal here — the summary is read instead).
        run: |
          out=$(npx --yes champollion@0.6 sync --dry $SYNC_FLAGS --json) || true
          if ! printf '%s\n' "$out" | jq -e 'select(.level == "summary") | .preflight.ready and (.maxCost.wouldStop | not)' > /dev/null; then
            printf '%s\n' "$out" | jq -r 'select(.level == "summary") | "::error::" + (.error // "A real sync would exit \(.realRun.exitCode): \(.realRun.reasons | join("; "))")'
            exit 1
          fi
```

O sa isang shell, kung saan nakasulat nang buo ang mga flag — ang parehong mga flag sa linya ng sync:

```bash
SYNC_FLAGS="--method llm --model google/gemini-3.8-flash --max-cost 5"
out=$(npx --yes champollion@0.6 sync --dry $SYNC_FLAGS --json)
printf '%s\n' "$out" | jq -e 'select(.level == "summary") | .preflight.ready and (.maxCost.wouldStop | not)' > /dev/null \
  || printf '%s\n' "$out" | jq -r 'select(.level == "summary") | .error // "A real sync would exit \(.realRun.exitCode): \(.realRun.reasons | join("; "))"'
```

Ang `preflight.ready` ay `false` kapag ang isang key na kailangan ng paraan ay nawawala (hindi nakatakda o
walang laman — hindi kapag ito ay mali), may kailangan mang isalin o wala: ang isang
hosted method ay hindi kailanman handa nang wala ang key nito. Ang `maxCost.wouldStop` (kasama ng
`--max-cost`) ay `true` kapag ang totoong pagpapatakbo ay hihinto sa limitasyon. Nag-e-exit ang `jq -e`
nang 1 sa alinman sa mga ito, at ipiniprint ng hakbang ang dahilan sa log ng job — halimbawa
`A real sync would exit 1: it would stop before translating: No OpenRouter API
key (OPENROUTER_API_KEY) for en:fr`, or `A real sync would exit 2: --max-cost
would stop it before any API call (Estimated translation cost exceeds the
--max-cost cap: estimate ~$7.1200, cap $5.0000)`. Kapag hindi talaga makatakbo ang sync
(isang sirang config), ipiniprint ng hakbang ang `error` ng buod sa halip. Hindi
ipinapadala ng hakbang ang stderr sa `/dev/null`, kaya nananatili rin ang mga babala sa log. Sinasabi
ng `realRun.exitCode` ng buod kung ano ang magiging exit code ng totoong pagpapatakbo,
hangga't kayang matukoy ng isang preview: `1` kapag ihihinto ito ng preflight, `2`
kapag ihihinto ng `--max-cost`, o kapag magtatapos ito nang partial — mga key na pinigil, o
mga plural na mensahe sa disk na walang anyong ginagamit ng wika (sinasabi ng `realRun.reasons`
kung alin). Ang pagtanggi ng quality gate, na sa totoong pagpapatakbo lamang makikita, ay maaari
pa ring magpalit sa `0` upang maging `2`. Upang ibagsak din ang pagsusuri sa isang inaasahang partial na pagpapatakbo,
ilagay ang `.realRun.exitCode == 0` kapalit ng `.preflight.ready and (.maxCost.wouldStop | not)`.

### Isang protektadong main branch: magmungkahi ng pull request

Direktang nagpu-push ang workflow sa itaas ng mga pagsasalin sa `main`. Kung protektado ang `main`
(kinakailangang mga pagsusuri o status check), tatanggihan ang push na iyon — pagkatapos
tumakbo ng sync, kaya nabayaran na ang mga pagsasalin. Hindi na muling babayaran
ang mga ito: nai-save ang cache bago ang hakbang sa pag-commit, kahit mabigo ang isang hakbang,
kaya ang muling pagpapatakbo sa job o ang susunod na push (bawat isa ay nagre-restore ng pinakabagong
cache ng branch, sa pamamagitan ng `restore-keys`) ay naghahatid ng mga ito mula sa cache. Hindi
kailanman umabot ang mga lock file sa `main`, kaya makikita ng susunod na pagpapatakbo ang parehong mga string
na nagbago at muling isusulat ang mga ito — mula sa cache, nang walang karagdagang gastos.

Sa isang protektadong `main`, mag-commit sa isang branch na pagmamay-ari ng bot at magbukas (o mag-update) ng isang
pull request sa halip. Panatilihin ang workflow sa itaas at baguhin ang dalawang bagay: ang
mga pahintulot, at ang hakbang sa pag-commit.

```yaml title=".github/workflows/i18n-sync.yml (pull request)"
permissions:
  contents: write          # pushes the bot's branch
  pull-requests: write     # opens the pull request

# … checkout, setup-node, cache restore, "Sync translations" and the cache
# save as above; then, in place of "Commit updated translations":
      - name: Open or update the translations pull request
        env:
          GH_TOKEN: ${{ github.token }}
        run: |
          git config user.name "champollion"
          git config user.email "bot@example.com"
          branch=champollion/translations
          git switch -C "$branch"
          # Django: stage the catalogs and the lock by name, as in the
          # Django workflow below, instead of --all.
          git add --all
          if git diff --staged --quiet; then
            echo "Nothing to propose: the translations on $GITHUB_REF_NAME are up to date."
            exit 0
          fi
          git commit -m "chore: sync translations"
          # The branch is rebuilt from the latest $GITHUB_REF_NAME on every
          # run, so a force-push replaces the last proposal.
          git push --force origin "$branch"
          if [ -z "$(gh pr list --head "$branch" --base "$GITHUB_REF_NAME" --state open --json number --jq '.[].number')" ]; then
            gh pr create --head "$branch" --base "$GITHUB_REF_NAME" \
              --title "chore: sync translations" \
              --body "Translations and lock files from champollion sync (run $GITHUB_RUN_ID). Merge them together."
          fi
# "Stop when the sync was partial" and the verify --strict step stay as they
# are, after this one.
```

**Kailan dapat gamitin ang alinman.** Mag-push sa `main` kapag maaaring mag-push doon ang workflow: walang
proteksyon sa branch, o may patakaran na nagpapahintulot sa GitHub Actions na i-bypass ito. Magbukas ng pull
request kapag protektado ang `main`, o kapag kailangan munang basahin ng isang tao — isang nagsasalita ng wika
— ang mga pagsasalin bago mai-ship ang mga ito.

- Pagmamay-ari ng bot ang branch. Hangga't hindi pa nai-merge ang pull request, wala
  sa mga lock file ng `main` ang mga pagsasalin nito, kaya bawat pagpapatakbo ay nagmumungkahi ng buong set
  muli — mula sa cache, kaya tanging ang mga string na nagbago mula noon ang sisingilin. Ang mga pagbabagong
  nai-push sa branch na iyon ay pinapalitan ng susunod na pagpapatakbo: suriin sa pull
  request, i-merge, pagkatapos ay mag-edit sa `main` (pinapanatili ng isang pangkalahatang pag-uulit sa hinaharap ang pagbabago
  ng isang tao).
- Dapat pahintulutan ng repositoryo ang Actions na magbukas ng mga pull request: Settings → Actions →
  General → "Allow GitHub Actions to create and approve pull requests".
- Ang isang pull request na binuksan gamit ang `GITHUB_TOKEN` ng workflow ay hindi magsisimula ng iba pang
  workflow, kaya ang mga kinakailangang status check ay hindi kailanman tatakbo rito. Kung kinakailangan ito ng
  `main`, buksan ito gamit ang isang GitHub App token o isang fine-grained token na nakatago bilang isang
  secret (`GH_TOKEN: ${{ secrets.<name> }}`), o gumamit ng isang action gaya ng
  `peter-evans/create-pull-request`, na nagko-commit, nag-a-update ng branch, at
  nag-e-edit ng bukas na pull request para sa inyo (ipasa rito ang token sa parehong paraan).

### gettext (Django, Babel) at Flutter

Isinasalin ng Sync ang mga umiiral na catalog; hindi ito nag-e-extract ng mga string mula
sa inyong code. Nagre-refresh ang isang proyektong Django ng mga catalog bago ang hakbang sa pag-sync,
sinusuri na nagko-compile ang mga ito pagkatapos nito, at nagko-commit lamang ng mga catalog.

Parehong nag-i-import ang `makemessages` at `compilemessages` ng inyong mga setting, kaya itinatakda
ng job ang kailangan ng mga ito, nang isang beses, para sa bawat hakbang: anumang variable na binabasa ng inyong module ng mga setting
sa pag-import (`SECRET_KEY`, `DATABASE_URL`, …). Wala sa dalawang utos ang humihipo sa
database, kaya sapat na ang placeholder value para sa mga iyon. Ang `DJANGO_SETTINGS_MODULE`
ay iniwang naka-comment out: ang `manage.py` na isinusulat ng `startproject` ang nagtatakda
nito mismo, at ang isang value na itinakda sa job ay nago-override doon — ang maling pangalan ng module
ay sumisira sa `makemessages`. Itakda lamang ito kapag hindi ito ginagawa ng inyong `manage.py`.

Iba ang filter nitong `paths:` kumpara sa workflow sa itaas: nasa inyong Python code
at mga template ang mga source string, at ine-extract ang mga ito ng `makemessages` sa job, kaya
ang pagbabago sa code ay maaaring magdala ng bagong string. Limitahan ang mga pattern sa inyong mga app
(`myapp/**.py`) kung bawat push ay humihipo sa Python. Binabantayan din nito ang `locale/**`:
dumarating ang isang bagong wika bilang isang bagong folder ng catalog (`makemessages -l <code>`). Binabago
ng sariling commit ng bot ang mga catalog na iyon ngunit hindi nagsisimula ng pagpapatakbo, dahil nai-push
ito gamit ang `GITHUB_TOKEN` (tingnan ang **Ang sariling commit ng job ay hindi kailanman nagpapasimula rito muli**
sa itaas — at kung ano ang lilimitahan kapag nag-push gamit ang ibang token).

```yaml title=".github/workflows/i18n-sync.yml (Django)"
name: Sync translations
on:
  push:
    branches: [main]
    # makemessages finds new strings in your code and templates, so a code
    # change can bring a string to translate: watch those, the catalogs
    # and the config. A push that touches none of them starts no job.
    paths:
      - '**.py'
      - '**.html'
      - '**.txt'                # templates for emails and the like
      - '**.js'                 # djangojs strings; drop it if you have none
      - 'locale/**'
      - 'champollion.config.json'
  # Run workflow (by hand): the box asks again for plural forms a model left
  # out — Russian few/many marked "# champollion:" (--redo gaps).
  workflow_dispatch:
    inputs:
      redo_gaps:
        description: 'Ask again for plural forms a model left out (--redo gaps)'
        type: boolean
        default: false

permissions:
  contents: write

concurrency:
  group: i18n-sync-${{ github.ref }}
  cancel-in-progress: false

jobs:
  sync:
    runs-on: ubuntu-latest
    # For every step: makemessages and compilemessages both import your
    # settings, so set what your settings read at import (see above).
    # Placeholders are enough: neither command uses the database.
    env:
      # DJANGO_SETTINGS_MODULE: myproject.settings   # only if your manage.py does not set it
      SECRET_KEY: makemessages-only
      # The flags of every `champollion sync` in this job (the dry-run check
      # above reads them too). A runner has no model server: if your config
      # uses "local" (a model on your machine), a hosted method runs here,
      # for these runs only — the config file is not changed.
      SYNC_FLAGS: --method llm --model google/gemini-3.8-flash --max-cost 5
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 24
      - uses: actions/setup-python@v5
        with:
          python-version: '3.12'
      # A fresh runner's package index is empty: update it first, or the
      # install fails. gettext brings msgmerge and msgfmt, used below.
      - run: sudo apt-get update && sudo apt-get install -y gettext
      - run: python -m pip install -r requirements.txt   # the Python setup-python just installed
      - name: Restore the translation cache
        id: cache
        uses: actions/cache/restore@v4
        with:
          path: .champollion
          key: champollion-tm-${{ github.ref_name }}-newest
          restore-keys: champollion-tm-${{ github.ref_name }}-
      - name: Extract new strings into the catalogs
        # --no-wrap: champollion writes each msgstr on one line; without it
        # msgmerge re-wraps those lines at 79 columns on the next run, and
        # every sync commits whitespace-only changes. The second line
        # refreshes the JavaScript catalogs (djangojs.po); drop it if your
        # project has none.
        run: |
          python manage.py makemessages --all --no-wrap
          python manage.py makemessages --all --no-wrap -d djangojs
      - name: Sync translations
        id: sync
        env:
          OPENROUTER_API_KEY: ${{ secrets.OPENROUTER_API_KEY }}
        # $SYNC_FLAGS: the job's flags (env: above); the redo_gaps box of
        # "Run workflow" adds --redo gaps. Exit 2 (partial) is recorded, not
        # fatal: what was translated is committed, then the job fails.
        run: |
          set +e
          npx --yes champollion@0.6 sync $SYNC_FLAGS ${{ inputs.redo_gaps && '--redo gaps' || '' }}
          code=$?
          echo "code=$code" >> "$GITHUB_OUTPUT"
          if [ "$code" -ne 0 ] && [ "$code" -ne 2 ]; then exit "$code"; fi
      - name: Save the translation cache
        if: always() && hashFiles('.champollion/**') != '' && steps.cache.outputs.cache-matched-key != format('champollion-tm-{0}-{1}', github.ref_name, hashFiles('.champollion/**'))
        uses: actions/cache/save@v4
        with:
          path: .champollion
          key: champollion-tm-${{ github.ref_name }}-${{ hashFiles('.champollion/**') }}
      - name: Check the catalogs compile (placeholder types included)
        run: python manage.py compilemessages
      - name: Commit updated catalogs
        run: |
          git config user.name "champollion"
          git config user.email "bot@example.com"
          # The catalogs and the lock file only: not the .mo files
          # compilemessages just wrote, and not .champollion/ (the cache).
          git add -- '*.po' .champollion.lock
          # A replaced hand edit is recorded here — the only copy of that wording.
          if [ -f .champollion-replaced-edits.jsonl ]; then git add -- .champollion-replaced-edits.jsonl; fi
          # makemessages (msgmerge) writes a new POT-Creation-Date into every
          # catalog on each run: commit only when something else changed
          # (git diff -I needs git 2.30 or newer; GitHub's runners have it).
          if git diff --staged --quiet -I '^"POT-Creation-Date:'; then
            echo "Nothing to commit: only the catalogs' POT-Creation-Date changed."
          else
            git commit -m "chore: sync translations"
            git pull --rebase origin "$GITHUB_REF_NAME"
            git push origin "HEAD:$GITHUB_REF_NAME"
          fi
      # Right after the commit, before verify: on a partial run verify would
      # fail first on the missing keys, and the red step would name a key
      # while the reason sat in a green step.
      - name: Stop when the sync was partial
        if: steps.sync.outputs.code == '2'
        run: |
          echo "::error::champollion sync exit 2: the run stopped at --max-cost before translating, or some keys were not translated (refused by the quality gate, held back, or a plural form left out). What was translated is committed. The 'Sync translations' step's log says which."
          exit 1
      # --strict: a plural entry where the model left out a form the
      # language uses for everyday counts (Russian few/many) is a warning,
      # and plain verify passes on warnings. Strict fails on it, so wrong
      # plurals never ship with a green build.
      - name: Check every catalog is complete and intact
        run: npx --yes champollion@0.6 verify --strict
```

Ina-update ng `--all` ang bawat catalog na umiiral na; magdagdag ng wika gamit ang
`makemessages -l <code>` nang isang beses (o `champollion init --langs <code>`).
Tumatakbo ang `makemessages` nang isang beses bawat domain: `django` para sa Python at mga template,
`djangojs` (`-d djangojs`) para sa JavaScript. Isinasalin ng Sync ang catalog ng bawat domain
na makikita nito. Pinapatakbo ng huling hakbang ang `verify --strict`. Ang isang Russian plural entry
na ang pagsasalin ay walang anyong `few` o `many` ay isinusulat gamit ang anyong `other`
at minamarkahang `# champollion:`. Bawat sync ay nag-e-exit nang `2` habang ang gayong entry ay
nasa isang catalog — ang sumusulat nito at bawat kasunod, gaya ng sa isang key na pinigil
— at pinapangalanan ng buod nito ang entry at ang utos na muling magtatanong; sinasabi
naman ng linya ng pagpapatunay pagkatapos ng sync na hindi kumpleto ang pagpapatakbo sa halip na `[OK]`.
Kaya ibinabagsak ng hakbang na "Stop when the sync was partial" ang job pagkatapos ng commit
hanggang sa maisulat ang mga anyo. Kapag standalone, ito ay isang babala: ang payak na `verify`
ay nag-e-exit nang 0 dito, habang ang `--strict` ay bumabagsak. Binibilang ng `audit` ang parehong mga entry bilang
hindi kumpleto.

Pinapatakbo ng `compilemessages` ang `msgfmt --check-format`, na sumusuri rin na pinapanatili ng bawat
`%(name)s` ang uri nito — ngunit sa mga entry lamang na may flag na `#, python-format`.
Idinadagdag ng `makemessages` ang flag na iyon sa mga entry na ine-extract nito na may `%`
placeholder; maaaring wala nito ang isang manu-manong ginawang catalog, at hindi susuriin ang mga
entry nito. Inihahambing ng `champollion
verify` ang mga printf placeholder (pangalan at titik ng uri) ng bawat entry
anuman ang mga flag nito, at pinapanatili ng sync ang mga flag ng source entry sa bawat entry na
isinasalin nito. Isinasama ng hakbang sa pag-commit ang `*.po` at
`.champollion.lock` sa staging ayon sa pangalan (at ang talaan ng replaced-edits kung mayroon
nito); kung sinusubaybayan ng inyong proyekto ang mga file nitong `.mo`, idagdag ang `'*.mo'` dito. Ang
mga hakbang sa cache, ang naitalang exit code, at ang `git pull --rebase` ay naroroon sa
parehong mga dahilan gaya ng sa workflow sa itaas. Babel: `pybabel extract` + `pybabel update --no-wrap` bago
ang sync, `pybabel compile` pagkatapos nito.

Hindi nangangailangan ang Flutter ng dagdag na hakbang sa job na ito: isinusulat ng sync ang mga file na
`app_<locale>.arb`, at ang `flutter gen-l10n` (o `flutter build`, na nagpapatakbo rito) ay ang
sariling build step ng inyong app, kung saan ginagawa itong Dart.

#### Mga anyong maramihan na nakaligtaan ng modelo {#plural-gaps}

Ang isang minarkahang entry ay hindi isang pagsasalin, kaya hindi ito ipinapaubaya ng sync sa tao
lamang:

- **Kusang nagtatanong muli ang ibang paraan o modelo.** Ang isang sync na ang setup
  (paraan, modelo, register, coaching) ay hindi pa sumasagot sa entry na iyon ay ipinapadala
  ito sa modelo muli — hindi sa cache, na naglalaman ng hindi kumpletong
  sagot. Kaya kapag nakaligtaan ng lokal na modelo ng isang developer ang mga anyo, hihingin
  ang mga ito ng hosted model ng job (`SYNC_FLAGS`) sa susunod nitong pagpapatakbo, at itatakda
  ng pagtatantiya ang presyo nito. Itinatala ng lock (`.champollion.lock`, sa ilalim ng `gaps`) ang bawat setup
  na sumagot nang wala ang mga anyo, upang ang isang lokal na pagpapatakbo at isang CI run ay hindi kailanman maghalinhinan
  sa pagbabayad para sa parehong hindi kumpletong sagot.
- **Hinihingi ng `sync --redo gaps` ang bawat gayong entry**, sinuman ang nag-iwan nito — sa mga
  workflow sa itaas, lagyan ng tsek ang `redo_gaps` sa ilalim ng **Run workflow**. Idagdag ang `--model` sa
  `SYNC_FLAGS` para sa mas mahusay na modelo.
- **Kung kulang din sa mga anyo ang bagong sagot, mananatiling minarkahan ang entry** at mag-e-exit
  ang pagpapatakbo nang `2`, tulad ng dati. Pagkatapos ay isulat ang mga anyo nang manu-mano at tanggalin ang
  linyang `# champollion:`.

Pinapangalanan ng isang dry run (`sync --dry`) ang mga entry na muli nitong hihingin at tinatantya
ang presyo ng mga ito; binibilang ng `--json` na buod nito ang mga hindi nito hihingin (`totalPluralGaps`)
at sinasabi na ang totoong pagpapatakbo ay mag-e-exit nang `2` dahil sa mga ito (`realRun.exitCode`).

## Iba pang mga paraan

Ipinapakita ng mga snippet sa ibaba ang key na kailangan ng bawat paraan at ang utos nitong `sync`.
Gamitin ang mga ito **sa loob** ng hakbang na "Sync translations" ng workflow sa itaas: palitan
ang `env` nito, ilagay ang mga ipinakitang flag (`--method openai`, …) sa linyang `SYNC_FLAGS`
ng workflow — upang patakbuhin ng pagsusuri sa dry-run ang parehong paraan — at panatilihin ang
natitirang bahagi ng hakbang (`id: sync` at ang mga linyang nagtatala ng exit code), upang mai-commit pa rin
ng isang partial na pagpapatakbo ang naisalin nito at mai-save ang cache.

## Paraang Google Translate

Kung gagamitin ang built-in na paraang Google Translate sa halip na OpenRouter:

```yaml
- name: Sync translations
  env:
    GOOGLE_TRANSLATE_API_KEY: ${{ secrets.GOOGLE_TRANSLATE_API_KEY }}
  run: npx --yes champollion@0.6 sync
```

## Mga Direktang LLM Provider

Kung direktang gagamitin ang mga paraang `openai`, `anthropic`, o `gemini`:

```yaml
# OpenAI
- name: Sync translations
  env:
    OPENAI_API_KEY: ${{ secrets.OPENAI_API_KEY }}
  run: npx --yes champollion@0.6 sync --method openai

# Anthropic
- name: Sync translations
  env:
    ANTHROPIC_API_KEY: ${{ secrets.ANTHROPIC_API_KEY }}
  run: npx --yes champollion@0.6 sync --method anthropic

# Gemini (free tier available)
- name: Sync translations
  env:
    GEMINI_API_KEY: ${{ secrets.GEMINI_API_KEY }}
  run: npx --yes champollion@0.6 sync --method gemini
```

## DeepL

```yaml
- name: Sync translations
  env:
    DEEPL_API_KEY: ${{ secrets.DEEPL_API_KEY }}
  run: npx --yes champollion@0.6 sync --method deepl
```

## Remote Translation API

Kung gumagamit ng isang remote translation endpoint (hal., isang hosted translation service):

```yaml
- name: Sync translations
  env:
    CHAMPOLLION_API_KEY: ${{ secrets.CHAMPOLLION_API_KEY }}
  run: npx --yes champollion@0.6 sync
```

## Isang gate bago kayo mag-deploy

Upang ibagsak ang isang build kapag ang anumang locale ay hindi kumpleto o sira, nang walang isinasalin
na anuman, patakbuhin ang mga pagsusuri nang mag-isa.

:::warning[Patakbuhin ang gate pagkatapos ng sync, hindi bago ito]
Kung tumatakbo lamang ang pagsasalin pagkatapos ng merge (ang workflow sa itaas), ang isang pull request na
nagdaragdag ng string ay wala pang salin para rito, at ibabagsak ng `audit`/`verify` ang bawat
gayong PR. Patakbuhin ang gate kung saan umiiral na ang mga pagsasalin: sa `main` pagkatapos
ng sync job (`needs: sync`, o `on: workflow_run` ng sync workflow). Ang
isang trigger na `push` ay hindi gumagana sa sariling mga commit ng sync bot — nai-push ang mga ito
gamit ang `GITHUB_TOKEN`, na hindi nagpapasimula ng workflow (tingnan sa itaas). Sa mga pull request,
patakbuhin lamang ang `lint`, o patakbuhin muna ang sync job sa PR branch.
:::

```yaml
jobs:
  i18n-check:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 24
      # 1. Hardcoded strings that never reached a locale file (web projects)
      - run: npx --yes champollion@0.6 lint
      # 2. Every key present, nothing empty or left as an [EN] fallback
      - run: npx --yes champollion@0.6 audit
      # 3. Placeholders, ICU plurals, markup and scripts intact. --strict:
      #    warnings fail the build too (an extra or missing plural form, a
      #    source echo, an out-of-date translation pass plain verify).
      - run: npx --yes champollion@0.6 verify --strict
```

| Pagsusuri | Utos | Bumagsak kapag |
|-------|---------|------------|
| **Lint** | `lint` | May mga string ang source code na wala sa isang locale file — o wala itong nakitang source file na susuriin (pinapangalanan nito ang mga folder na hinalughog; ituro ito sa iba gamit ang `--src <dir>`) |
| **Audit** | `audit` | May nawawala, walang laman, o nananatiling `[EN]` fallback na key — o ang isang pagsasalin ay **luma na**: ginawa mula sa mas lumang source text kaysa sa kasalukuyan (isang source edit na nabigo ang muling pagsasalin) — o ang isang plural na mensahe ay walang anyong ginagamit ng wika para sa pang-araw-araw na pagbibilang (Russian na `few`/`many`; ang mga entry kung saan bumabagsak ang `verify --strict`), kasama ang utos na muling magtatanong |
| **Verify** | `verify` | Sinira ng pagsasalin ang isang placeholder, ICU plural, markup (isang tag na binuksan, isinara, o ini-nest nang magkaiba) o script — o may nawawalang key — o isang teksto ang ipinalit para sa ilang magkakaibang source string (isang modelong umuulit ng sinaulong pangungusap) — o wala itong nakitang susuriin (ang source file o locales folder ay wala kung saan nakaturo ang config) |
| **Verify, mahigpit** | `verify --strict` | Alinman sa mga nasa itaas, o anumang babala |

Nag-e-exit ang `verify` nang `1` sa anumang error at `0` kung hindi. Ipiniprint ang mga babala ngunit hindi
ibinabagsak ang job: isang echo ng source, dalawang locale na may magkatulad na teksto, isang
pagsasalin na luma na, isang pagsasalin na nag-alis sa pansarang `?` o `!` ng source (minamarkahan ng ilang wika ang tanong gamit ang isang partikulo sa halip),
at ang mga babala sa maramihan sa ibaba. Ang isang tekstong isinulat para sa ilang magkakaibang source
string ay isang error: dalawang malinaw na magkaibang multi-word string na sinagot
ng parehong teksto na may apat o higit pang salita, o tatlo o higit pa kung hindi. Binibilang ito
sa mga key value, bawat plural branch, at mga pahina ng Markdown ng locale, ayon sa
panuntunan kung saan tinatanggihan ito ng gate ng `sync`. Ginagawang pagkabigo ng `verify --strict` ang bawat babala.
Gamitin ito kapag, halimbawa, ang mga Russian plural form na nakaligtaan ng modelo ay dapat
humadlang sa pag-deploy. Ang mga lumang pagsasalin ay isang babala sa `verify` (buo
ang istruktura) at isang pagkabigo sa `audit` (ang completeness gate), na
nagpi-print ng utos na muling magsasalin sa mga ito.

Nakasalalay ang mga natuklasan sa maramihan sa kung paano iniimbak ng format ang mga anyong maramihan:

| Format | Error (nag-e-exit ang `verify` nang 1) | Babala (bumabagsak lamang kapag may `--strict`) |
|--------|--------------------------|--------------------------------------|
| mga suffixed key ng i18next (`count_one`, `count_other`, …) | Nawawala ang isang anyong kailangan ng locale (French `count_many`): ito ay isang nawawalang key. | Isang key para sa anyong wala ang locale (French o Spanish `count_two`). Ipiniprint ng `verify` ang utos na nagtatanggal sa mismong mga key na iyon, `sync --prune plural-extras`; hindi kailanman binubura ng sync ang mga ito nang wala iyon. |
| Mga mensaheng ICU (`{count, plural, …}` sa next-intl, ARB, i18next ICU) | Sira ang istruktura ng maramihan (isang naisaling variable, keyword, o selector, isang nawawalang `#`). | Nawawala ang isang branch na ginagamit ng locale para sa pang-araw-araw na pagbibilang (Russian `few`, `many`). Ang isang nawawalang anyo na ginagamit lamang para sa malalaking numero (French `many`, para sa 1 000 000) ay hindi inuulat. |
| gettext (`msgid_plural`) | Isang entry na walang pagsasalin (walang laman o `fuzzy`): ito ay isang nawawalang key. | Mga anyong `msgstr[]` na umuulit sa anyong `other` kung saan ang wika ay may sarili nitong anyo para sa pang-araw-araw na pagbibilang (minarkahan ng komentong `# champollion:`). Mas maraming linyang `msgstr[]` kaysa sa `nplurals` ng catalog. Binibilang ang mga anyong maramihan ayon sa sariling header na `Plural-Forms` ng catalog. |

Ang isang anyo sa i18next na isinalin mula sa teksto ng ibang anyo ay maaaring magtaglay ng eksaktong
teksto ng anyong iyon (French `count_many` na katumbas ng `count_other`). Maaaring isulat ng French ang
dalawa nang magkatulad, kaya hindi ito kailanman nagiging babala. Kapag humihingi ang sync sa modelo ng isang anyo,
itinatala nito iyon sa `.champollion.lock`, kasama ang isang fingerprint ng sagot. Binabasa lamang ng `verify`
ang talang iyon, kaya bawat clone ng isang commit ay nakakakuha ng parehong resulta. Hindi magkakaiba
ang cache ng inyong laptop at ng isang bagong CI runner. Ang isang halagang walang tala
(isinulat nang manu-mano, ng ibang tool, ng isang machine translation engine na hindi
masabihan tungkol sa anyo, o ng isang mas lumang bersyon) ay nakakakuha ng linyang info kasama ang utos
na muling nagtatanong. Hindi bumabagsak ang `--strict` dahil dito.
Istruktura ang sinusuri ng Verify, hindi kahulugan: sinasabi ng pagpasa na buo ang mga key, placeholder,
maramihan, markup, at script, hindi na tama ang sinasabi ng teksto.

---

## Tingnan Din

- [Sanggunian sa CLI](/docs/reference/cli) — buong sanggunian ng mga utos
- [Paano Gumagana ang Sync](/docs/concepts/how-sync-works) — pag-unawa sa incremental sync
- [Memorya ng Pagsasalin](/docs/concepts/translation-memory) — pag-cache at pagtitipid sa gastos
- [Mga Paraan ng Pagsasalin](/docs/guides/translation-methods) — pagpili ng paraan bawat pares
- [Quality Gate](/docs/concepts/quality-gate) — kung ano ang mangyayari kapag nabigo ang mga pagsasalin
- [Konpigurasyon](/docs/getting-started/configuration) — sanggunian sa config
