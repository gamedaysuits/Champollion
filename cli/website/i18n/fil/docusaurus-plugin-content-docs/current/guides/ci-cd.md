---
sidebar_position: 3
title: "CI/CD"
---

# Integrasyon ng CI/CD

I-automate po ang mga pagsasalin sa inyong build pipeline.

Ang champollion CLI ay source-available sa ilalim ng [PolyForm Noncommercial License 1.0.0](https://github.com/gamedaysuits/Champollion/blob/main/cli/LICENSE): libreng gamitin, baguhin, at ibahagi para sa mga layuning di-komersyal. Ang paggamit nito para sa isang komersyal na layunin ay hindi saklaw ng lisensyang ito ([sino ang maaaring gumamit nito](/docs/getting-started/who-may-use-this)).

## GitHub Actions: panatilihing naka-sync ang mga salin

Isang kumpletong workflow: isalin ang nagbago, suriin ang resulta, at i-commit
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
          npx --yes champollion@0.5 sync $SYNC_FLAGS ${{ inputs.redo_gaps && '--redo gaps' || '' }}
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
        run: npx --yes champollion@0.5 verify --strict
```

**Bakit ganito binuo ang workflow.** Sa sarili nito, sine-save lamang ng `actions/cache` ang
cache kapag nagtagumpay ang buong job, at lumalabas ang `sync` na may `2` tuwing may
tinatanggihang key — kaya dati, ang isang partial na pagpapatakbo ay nilalaktawan ang parehong pag-commit at ang pag-save ng cache,
at nagbabayad muli ang susunod na pagpapatakbo para sa parehong mga salin. Dito, ang cache ay
ibinabalik at sine-save bilang dalawang hakbang (`actions/cache/restore`, pagkatapos ay
`actions/cache/save` na may `if: always()`), itinatala ng sync step ang exit code
nito sa halip na mabigo sa `2`, kino-commit ang mga naisaling file, at saka lamang
mabibigo ang job — sa sarili nitong hakbang, bago ang `verify`, upang sabihin ng nabigong hakbang
kung bakit (isang `--max-cost` stop, o mga key na hindi naisalin ng sync) sa halip na
`verify` na nagpapangalan ng nawawalang key. Ang huling hakbang ay `verify --strict`: ang payak na
`verify` ay naglalabas ng 0 sa mga babala (kabilang dito ang sobra o nawawalang plural form), at
ang `--strict` naman ay nagpapabigo sa job dahil sa mga ito. Tinatandaan ang isang key na tinanggihan ng quality gate: hindi na ito ipapadala
muli ng susunod na pagpapatakbo sa parehong modelo (sisingilin lamang nito ang parehong sagot) —
pinapangalanan ito ng log ng sync kasama ang `--redo keys:` command na magtatanong muli.

**Isang kopya ng cache bawat pagbabago, hindi bawat pagpapatakbo.** Ibinabalik ng restore step ang
pinakabagong cache ng branch (ang eksaktong key nito, `…-newest`, ay hindi kailanman sine-save, kaya
pinipili ng `restore-keys` ang pinakabago). Ginagawang key ng save step para sa cache ang isang
hash ng sarili nitong mga file (`hashFiles('.champollion/**')`): ang isang pagpapatakbo na may naisalin
— kahit isang partial na pagpapatakbo, o isa na nabigo ang push — ay nagbago sa cache,
kaya nakakakuha ito ng bagong key at nase-save; ang isang pagpapatakbo na walang idinagdag (walang dapat
isalin, lahat ay mula sa cache, isang `--max-cost` stop) ay may key na
ibinalik nito, kaya nilalaktawan ang pag-save at walang bagong kopyang iniimbak. Ang pag-key sa run
id ay nagse-save ng buong kopya sa bawat pagpapatakbo; ang pag-key sa lock at mga source file ay
magbabalik ng mas lumang kopya sa pamamagitan ng eksaktong pagtutugma pagkatapos ng isang pagpapatakbo na tinanggihan ang push,
dahil ang na-commit na lock ay hindi kailanman nakuha ang mga pagbabago ng pagpapatakbong iyon.

Sa isang proyektong Node, maaari ninyong idagdag ang `champollion` bilang isang dev dependency at tawagin
ang `npx champollion sync` sa halip; ang naka-pin na `champollion@0.5` sa itaas ay gumagana sa anumang
repository at hindi kailanman kukuha ng ibang bersyon nang hindi inaasahan. Dapat itong
i-install ng job pagkatapos: sa isang bagong runner, ang `npx champollion` na walang naka-install
ay kumukuha ng pinakabagong bersyon, hindi ang naka-pin sa inyong lock file. At isinusulat ng pag-install
ang `node_modules/`, na kino-commit ng `git add --all` maliban kung nakalista ito sa inyong `.gitignore`
(ang ginagawa ng `champollion init` ay naglilista lamang ng `.champollion/`), kaya
i-stage ang mga locale file at ang lock ayon sa pangalan, tulad ng ginagawa ng Django workflow sa ibaba:

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
kung aling source text ginawa ang bawat salin. Sa pamamagitan ng mga ito nalalaman ng
susunod na pagpapatakbo kung may nagbagong string. Ang isang runner na hindi kailanman nakakakita sa mga ito ay hindi matutukoy ang
na-edit na string mula sa hindi nagalaw. **Huwag i-commit ang `.champollion/`** — ito
ang cache bawat makina; idinadagdag ito ng `champollion init` sa `.gitignore`.

Pinipigilan ng **`--max-cost`** ang isang pagpapatakbo bago ito gumastos nang higit sa inyong inaasahan; itakda ito sa
halaga ng gastusin ng karaniwang mga pagbabago sa isang araw. Kapag pinigil nito ang isang pagpapatakbo, walang naisalin
o naisulat at lalabas ang sync na may code na `2`: walang dapat i-commit,
at ipapabigo ng hakbang na "Stop when the sync was partial" ang job, na sinasabi ito. Ang isang pamamaraan na walang nai-publish na presyo (isang self-hosted
endpoint sa ibang makina) ay hindi matatantiya, kaya hihinto ang `--max-cost`
tuwing may dapat isalin — huwag itong gamitin para sa mga iyon. Ang isang modelong
sineserve sa mismong runner (`local` sa `localhost`/`127.0.0.1`) ay may presyong
$0 API cost.

**Ang mga push lamang na nagbabago sa isang source string ang nagpapasimula sa job.** Inililista ng `paths:`
filter ang inyong mga source locale file at ang `champollion.config.json`: ang isang push
na code lamang ang binabago, o mga salin at mga lock file lamang, ay walang kailangang
isalin, kaya wala itong sisimulang job. I-edit ang dalawang path ng locale patungo sa mga file na
pinangalanan ng inyong config (`messages/en.json`, `lib/l10n/app_en.arb`, …); idagdag ang inyong
`contentDir` folder kapag nagsasalin din ng Markdown ang sync. Pinapatakbo pa rin ito nang manu-mano ng **Run workflow** (ang
trigger na `workflow_dispatch`).

**Hindi kailanman muling sisimulan ng sariling commit ng job ang sarili nito** — at hindi ang `paths:` filter ang
pumipigil dito. Nagpu-push ang commit step gamit ang `GITHUB_TOKEN` ng workflow,
at ang isang push na ginawa gamit ang `GITHUB_TOKEN` ay hindi kailanman nagti-trigger ng pagpapatakbo ng workflow (patakaran ng
GitHub, upang hindi masimulan ng isang workflow ang sarili nito). Kaya naman maaaring bantayan ng Django workflow
sa ibaba ang `locale/**`, na binabago ng bawat commit ng bot.
Mag-push gamit ang isang personal access token o isang GitHub App token sa halip (halimbawa, upang magsimula
ng iba pang workflow sa commit ng bot) at ang push na iyon ay muling magpapasimula sa
workflow na ito; pagkatapos ay ang `paths:` filter ang magpapasya. Hindi isinasama ng filter sa itaas
ang mga naisaling file at ang mga lock file, kaya walang pinasisimulang pagpapatakbo ang commit
ng bot. Sinasaklaw ng `locale/**` ng Django filter ang mga catalog na kino-commit
ng bot, kaya ang bawat commit nito ay nagsisimula ng isa pang pagpapatakbo — na walang makikitang dapat
isalin at walang iko-commit. Gamit ang naturang token, limitahan ito sa source
catalog (`locale/en/**`) at magdagdag ng mga wika sa pamamagitan ng config.

**Kailangan ang provider key sa bawat pagpapatakbong magsisimula**, kahit na walang kailangang
isalin: tinitingnan ng sync kung maaaring tumakbo ang pamamaraan bago nito suriin kung ano ang
nagbago. Ang isang pagpapatakbong manu-manong sinimulan nang walang pagbabago sa source ay mabibigo pa rin kung wala ang
`OPENROUTER_API_KEY` secret (o ang key ng inyong pamamaraan). Hindi kailangan ng `local` ng key, ngunit
walang model server ang isang runner: ang isang proyektong nagsasalin gamit ang `local` sa
makina ng developer ay tumutukoy ng isang hosted na pamamaraan sa CI (`--method` / `--model` — ang
naka-comment na linyang `SYNC_FLAGS` sa workflow sa itaas). Upang masuri kung nakakaabot ang secret
sa hakbang, nang walang isinasalin, nagbababala ang `sync --dry` kapag hihinto ang
totoong pagpapatakbo at pinapangalanan ang nawawalang variable (lumalabas pa rin ito nang may 0 — ang dry
run ay isang preview). Sinusuri nito na ang variable ay **nakatakda**, hindi kung **gumagana**
ang key: wala itong ipinapadala, kaya ang anumang value na hindi walang laman ay papasa — maging ang isang placeholder.
Ang mali o binawing key ay makikita sa unang kahilingan ng isang totoong pagpapatakbo (pinapangalanan
ng error ang sagot ng provider, tulad ng HTTP 401). Upang maipabigo ang job dahil sa nawawalang
key bago pa man may tumakbo, idagdag [ang pagsusuri bago ang sync](#check-before-sync).

**Pinapanatili ang cache bawat pamamaraan.** Ang isang salin ay naka-cache sa ilalim ng pamamaraan,
register, at coaching file na gumawa nito (muling ginagamit ito ng ibang modelo ng parehong
pamamaraan — model carry-over). Samakatuwid, ang isang developer na nagsasalin gamit ang `local`
at ang CI na nagsasalin gamit ang isang hosted model ay hindi kailanman nagbabahagi ng mga cache entry —
at bukod pa rito, sarili ng CI ang cache nito (hindi kino-commit ang `.champollion/`). Hindi ito
nangangahulugang muling isinasalin ng CI ang proyekto: ang nasa mga locale file na,
kung saan naka-commit ang lock file nito, ay itinuturing nang tapos. Binabayaran ng CI ang hosted model para
sa mga string na bago o binago mula noong huling commit — kabilang ang anuman na
isinalin ng developer nang lokal ngunit hindi nai-commit — at wala para sa iba pa.
Ang muling pagsasalin sa buong proyekto gamit ang hosted model (`--redo all`) ay naniningil
sa bawat string nang isang beses.

**Naka-iskedyul** sa halip na sa push: palitan ang `on:` block ng
`schedule: [{ cron: '0 6 * * *' }]`.

### Pagsusuri bago ang sync: maagang ipabigo ang job {#check-before-sync}

Lumalabas ang isang dry run na may `0` anuman ang makita nito — isa itong preview — kaya nagbababala ang `sync --dry
--max-cost 5` na hihinto ang totoong pagpapatakbo sa limitasyon at papasa pa rin
bilang isang hakbang sa CI. Upang maipabigo ang isang job kapag hihinto ang totoong pagpapatakbo (isang nawawalang key, o
`--max-cost`), basahin ang buod ng `sync --dry --json`. Ang output na iyon ay
isang JSON object bawat linya (NDJSON), bawat isa ay may `level` — mga linyang `info`, `ok`, at
`event` sa stdout, mga linyang `warn` at `error` sa stderr — at ang huling
linya ng stdout ay ang buod, `{"level": "summary", "command": "sync", …}`.
Piliin ito ayon sa level nito. **Patakbuhin ito gamit ang parehong mga flag gaya ng sync**: kung wala
ang mga ito, susuriin nito ang pamamaraang pinangalanan ng config, kaya para sa isang proyektong nagsasaad
ang config ng `local`, susuriin nito ang lokal na pamamaraan — hindi ang hosted model na pinapatakbo ng
job — at papasa sa isang runner na walang key. Bilang isang hakbang sa workflow sa itaas,
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
          out=$(npx --yes champollion@0.5 sync --dry $SYNC_FLAGS --json) || true
          if ! printf '%s\n' "$out" | jq -e 'select(.level == "summary") | .preflight.ready and (.maxCost.wouldStop | not)' > /dev/null; then
            printf '%s\n' "$out" | jq -r 'select(.level == "summary") | "::error::" + (.error // "A real sync would exit \(.realRun.exitCode): \(.realRun.reasons | join("; "))")'
            exit 1
          fi
```

O sa isang shell, kung saan nakasulat ang mga flag — ang parehong mga flag sa linya ng sync:

```bash
SYNC_FLAGS="--method llm --model google/gemini-3.8-flash --max-cost 5"
out=$(npx --yes champollion@0.5 sync --dry $SYNC_FLAGS --json)
printf '%s\n' "$out" | jq -e 'select(.level == "summary") | .preflight.ready and (.maxCost.wouldStop | not)' > /dev/null \
  || printf '%s\n' "$out" | jq -r 'select(.level == "summary") | .error // "A real sync would exit \(.realRun.exitCode): \(.realRun.reasons | join("; "))"'
```

Ang `preflight.ready` ay `false` kapag nawawala ang isang key na kailangan ng pamamaraan (unset o
walang laman — hindi kapag mali ito), may kailangan mang isalin o wala: ang isang
hosted na pamamaraan ay hindi kailanman handa kung wala ang key nito. Ang `maxCost.wouldStop` (naroroon kapag may
`--max-cost`) ay `true` kapag hihinto ang totoong pagpapatakbo sa cap. Ang `jq -e` ay lumalabas
na may 1 sa alinman sa mga ito, at ipiprint naman ng hakbang ang dahilan sa job log — halimbawa
`A real sync would exit 1: it would stop before translating: No OpenRouter API
key (OPENROUTER_API_KEY) for en:fr`, or `A real sync would exit 2: --max-cost
would stop it before any API call (Estimated translation cost exceeds the
--max-cost cap: estimate ~$7.1200, cap $5.0000)`. Kapag hindi talaga makatakbo ang sync
(sirang config), ipiprint ng hakbang ang `error` ng buod sa halip. Hindi
ipinapadala ng hakbang ang stderr sa `/dev/null`, kaya nananatili rin ang mga babala sa log. Sinasabi
ng `realRun.exitCode` ng buod kung anong exit code magtatapos
ang totoong pagpapatakbo, ayon sa kayang matukoy ng isang preview: `1` kapag pinigil ito ng preflight, `2`
kapag ang `--max-cost` ang pipigil, o kapag magtatapos ito nang partial — mga key na pinigil, o
mga plural message sa disk na walang form na ginagamit ng wika (sinasabi ng `realRun.reasons`
kung alin). Ang pagtanggi ng quality gate, na sa totoong pagpapatakbo lamang makikita, ay
maaari pa ring magpalit sa `0` patungong `2`. Upang maipabigo rin ang pagsusuri sa isang inaasahang partial run,
ilagay ang `.realRun.exitCode == 0` kapalit ng `.preflight.ready and (.maxCost.wouldStop | not)`.

### Isang protektadong main branch: magmungkahi ng pull request

Direktang nagpu-push ang workflow sa itaas ng mga salin sa `main`. Kung protektado ang `main`
(kinakailangang mga review o status check), tatanggihan ang push na iyon — pagkatapos
tumakbo ng sync, kaya nabayaran na ang mga salin. Hindi na muling babayaran
ang mga ito: nase-save ang cache bago ang hakbang sa pag-commit, kahit na may mabigong hakbang,
kaya ang muling pagpapatakbo ng job o ang susunod na push (bawat isa ay nagbabalik ng pinakabagong
cache ng branch, sa pamamagitan ng `restore-keys`) ay naghahatid ng mga ito mula sa cache. Hindi
kailanman nakarating ang mga lock file sa `main`, kaya makikita ng susunod na pagpapatakbo ang parehong mga string na
nagbago at muling isusulat ang mga ito — mula sa cache, nang walang karagdagang gastos.

Sa isang protektadong `main`, mag-commit sa isang branch na pagmamay-ari ng bot at magbukas (o mag-update) ng
pull request sa halip. Panatilihin ang workflow sa itaas at baguhin ang dalawang bagay: ang
mga permission, at ang hakbang sa pag-commit.

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

**Kailan dapat gamitin ang alinman.** Mag-push sa `main` kapag pinapayagang mag-push doon ang workflow: walang
proteksyon sa branch, o may patakarang nagpapahintulot sa GitHub Actions na i-bypass ito. Magbukas ng pull
request kapag protektado ang `main`, o kapag may isang tao — isang nagsasalita ng wika
— na dapat magbasa muna sa mga salin bago mai-ship ang mga ito.

- Pagmamay-ari ng bot ang branch. Hangga't hindi pa nai-merge ang pull request, wala sa mga lock file
  ng `main` ang mga salin nito, kaya bawat pagpapatakbo ay muling nagmumungkahi ng buong set
  — mula sa cache, kaya ang mga string lamang na nagbago mula noon ang sisingilin. Ang mga pagbabagong
  nai-push sa branch na iyon ay papalitan ng susunod na pagpapatakbo: suriin sa pull
  request, i-merge, pagkatapos ay mag-edit sa `main` (pinapanatili ng susunod na maramihang
  pag-redo ang edit ng tao).
- Dapat payagan ng repository ang Actions na magbukas ng mga pull request: Settings → Actions →
  General → "Allow GitHub Actions to create and approve pull requests".
- Ang isang pull request na binuksan gamit ang `GITHUB_TOKEN` ng workflow ay hindi magsisimula ng iba pang
  workflow, kaya hindi tatakbo dito ang mga kinakailangang status check. Kung kinakailangan ng `main`
  ang mga ito, buksan ito gamit ang isang GitHub App token o isang fine-grained token na nakatago bilang isang
  secret (`GH_TOKEN: ${{ secrets.<name> }}`), o gumamit ng isang action tulad ng
  `peter-evans/create-pull-request`, na nagko-commit, nag-a-update sa branch, at
  nag-e-edit sa nakabukas na pull request para sa inyo (ipasa ang token sa parehong paraan).

### gettext (Django, Babel) at Flutter

Isinasalin ng sync ang mga catalog na umiiral; hindi ito nag-e-extract ng mga string mula sa
inyong code. Nagre-refresh ang isang proyektong Django ng mga catalog bago ang hakbang sa sync,
sinusuri kung nagko-compile ang mga ito pagkatapos, at kino-commit lamang ang mga catalog.

Parehong nag-i-import ang `makemessages` at `compilemessages` ng inyong settings, kaya itinatakda
ng job ang kailangan ng mga ito, nang minsan, para sa bawat hakbang: anumang variable na binabasa ng inyong settings module
sa pag-import (`SECRET_KEY`, `DATABASE_URL`, …). Walang ginalaw na database ang alinmang command,
kaya sapat na ang isang placeholder value para sa mga iyon. Iniwan ang `DJANGO_SETTINGS_MODULE`
na naka-comment: itinatakda ito mismo ng `manage.py` na isinusulat ng `startproject`,
at ang isang value na itinakda sa job ay nago-override doon — ang maling pangalan ng module
ay sumisira sa `makemessages`. Itakda lamang ito kapag hindi ito ginagawa ng inyong `manage.py`.

Iba ang `paths:` filter nito sa workflow sa itaas: nasa inyong Python code at mga template ang mga source string,
at ine-extract ng `makemessages` ang mga ito sa job, kaya
maaaring magdala ng bagong string ang isang pagbabago sa code. Limitahan ang mga pattern sa inyong mga app
(`myapp/**.py`) kung bawat push ay may binabago sa Python. Binabantayan din nito ang `locale/**`:
dumarating ang bagong wika bilang isang bagong catalog folder (`makemessages -l <code>`). Binabago
ng sariling commit ng bot ang mga catalog na iyon ngunit hindi ito nagsisimula ng pagpapatakbo, dahil nai-push
ito gamit ang `GITHUB_TOKEN` (tingnan ang **Hindi kailanman muling sisimulan ng sariling commit ng job ang sarili nito**
sa itaas — at kung ano ang lilimitahan kapag nag-push kayo gamit ang ibang token).

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
          npx --yes champollion@0.5 sync $SYNC_FLAGS ${{ inputs.redo_gaps && '--redo gaps' || '' }}
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
        run: npx --yes champollion@0.5 verify --strict
```

Ina-update ng `--all` ang bawat catalog na umiiral na; magdagdag ng wika gamit ang
`makemessages -l <code>` nang minsan (o `champollion init --langs <code>`).
Tumatakbo ang `makemessages` nang minsan bawat domain: `django` para sa Python at mga template,
`djangojs` (`-d djangojs`) para sa JavaScript. Isinasalin ng sync ang catalog ng bawat domain na
makita nito. Pinapatakbo ng huling hakbang ang `verify --strict`. Ang isang Russian plural entry
na ang salin ay walang `few` o `many` form ay isinusulat gamit ang `other`
form at minamarkahang `# champollion:`. Bawat sync ay lumalabas na may `2` habang ang naturang entry ay
nasa isang catalog — ang sumulat nito at ang bawat kasunod nito, tulad ng sa isang key na pinigil
— at pinapangalanan ng buod nito ang entry at ang command na magtatanong muli; sinasabi
naman ng post-sync verification line na hindi kumpleto ang pagpapatakbo sa halip na `[OK]`.
Kaya ipinapabigo ng hakbang na "Stop when the sync was partial" ang job pagkatapos ng commit
hanggang sa maisulat ang mga form. Kung mag-isa, isa itong babala: ang payak na `verify`
ay lumalabas na may 0 dito, habang ang `--strict` ay nabibigo. Binibilang ng `audit` ang parehong mga entry bilang
hindi kumpleto.

Pinapatakbo ng `compilemessages` ang `msgfmt --check-format`, na sumusuri rin na pinapanatili ng bawat
`%(name)s` ang uri nito — ngunit sa mga entry lamang na may flag na `#, python-format`.
Idinadagdag ng `makemessages` ang flag na iyon sa mga entry na ine-extract nito na may `%`
placeholder; ang isang catalog na manu-manong ginawa ay maaaring wala nito, at hindi susuriin ang mga entry nito. Inihahambing ng `champollion
verify` ang mga printf placeholder ng bawat entry (pangalan at titik ng uri)
anuman ang mga flag nito, at pinapanatili ng sync ang mga flag ng source entry sa bawat entry na
isinasalin nito. Ini-stage ng hakbang sa pag-commit ang `*.po` at
`.champollion.lock` ayon sa pangalan (at ang talaan ng mga pinalitang pag-edit kapag mayroon);
kung sinusubaybayan nga ng inyong proyekto ang mga `.mo` file nito, idagdag ang `'*.mo'` dito. Naroroon
ang mga hakbang sa cache, ang naitalang exit code, at ang `git pull --rebase` para sa
parehong mga dahilan tulad ng sa workflow sa itaas. Babel: `pybabel extract` + `pybabel update --no-wrap` bago
ang sync, `pybabel compile` pagkatapos nito.

Hindi kailangan ng Flutter ng karagdagang hakbang sa job na ito: isinusulat ng sync ang mga `app_<locale>.arb`
file, at ang `flutter gen-l10n` (o `flutter build`, na nagpapatakbo nito) ay ang
sariling build step ng inyong app, kung saan ginagawa nitong Dart ang mga ito.

#### Mga plural form na hindi isinama ng isang modelo {#plural-gaps}

Ang isang minarkahang entry ay hindi isang salin, kaya hindi ito ipinapaubaya ng sync sa tao
lamang:

- **Kusa itong itinatanong muli ng ibang pamamaraan o modelo.** Ang isang sync na ang setup
  (pamamaraan, modelo, register, coaching) ay hindi pa sumasagot sa entry na iyon ay ipinapadala
  itong muli sa modelo — hindi sa cache, na naglalaman ng hindi kumpletong
  sagot. Kaya kapag hindi isinama ng lokal na modelo ng isang developer ang mga form, hihilingin
  ang mga ito ng hosted model ng job (`SYNC_FLAGS`) sa susunod na pagpapatakbo nito, at tinatantiyahan
  ito ng presyo. Itinatala ng lock (`.champollion.lock`, sa ilalim ng `gaps`) ang bawat setup
  na sumagot nang wala ang mga form, kaya hindi kailanman nagsasalitan ang isang lokal na pagpapatakbo at isang pagpapatakbo sa CI sa
  pagbabayad para sa parehong hindi kumpletong sagot.
- **Itinatanong ng `sync --redo gaps` ang bawat naturang entry**, sinuman ang nag-iwan nito — sa mga
  workflow sa itaas, lagyan ng tsek ang `redo_gaps` sa ilalim ng **Run workflow**. Idagdag ang `--model` sa
  `SYNC_FLAGS` para sa isang mas mahusay na modelo.
- **Kung kulang din sa mga form ang bagong sagot, mananatiling minarkahan ang entry** at lalabas
  ang pagpapatakbo na may `2`, tulad ng dati. Pagkatapos ay manu-manong isulat ang mga form at tanggalin ang
  linyang `# champollion:`.

Pinapangalanan ng isang dry run (`sync --dry`) ang mga entry na itatanong nitong muli at tinatantiyahan ang presyo
ng mga ito; binibilang ng buod nitong `--json` ang mga hindi nito itatanong (`totalPluralGaps`)
at sinasabing lalabas ang totoong pagpapatakbo na may `2` dahil sa mga ito (`realRun.exitCode`).

## Iba pang mga pamamaraan

Ipinapakita ng mga snippet sa ibaba ang key na kailangan ng bawat pamamaraan at ang `sync` command nito.
Gamitin ang mga ito **sa loob** ng hakbang na "Sync translations" ng workflow sa itaas: palitan
ang `env` nito, ilagay ang mga ipinakitang flag (`--method openai`, …) sa linya ng
`SYNC_FLAGS` ng workflow — upang patakbuhin ng pagsusuri ng dry-run ang parehong pamamaraan — at panatilihin ang
natitirang bahagi ng hakbang (`id: sync` at ang mga linyang nagtatala ng exit code), upang mai-commit
pa rin ng isang partial na pagpapatakbo ang naisalin nito at mai-save ang cache.

## Paraan ng Google Translate

Kung ginagamit po ang built-in na paraan ng Google Translate sa halip na OpenRouter:

```yaml
- name: Sync translations
  env:
    GOOGLE_TRANSLATE_API_KEY: ${{ secrets.GOOGLE_TRANSLATE_API_KEY }}
  run: npx --yes champollion@0.5 sync
```

## Mga Direktang LLM Provider

Kung direktang ginagamit po ang mga paraang `openai`, `anthropic`, o `gemini`:

```yaml
# OpenAI
- name: Sync translations
  env:
    OPENAI_API_KEY: ${{ secrets.OPENAI_API_KEY }}
  run: npx --yes champollion@0.5 sync --method openai

# Anthropic
- name: Sync translations
  env:
    ANTHROPIC_API_KEY: ${{ secrets.ANTHROPIC_API_KEY }}
  run: npx --yes champollion@0.5 sync --method anthropic

# Gemini (free tier available)
- name: Sync translations
  env:
    GEMINI_API_KEY: ${{ secrets.GEMINI_API_KEY }}
  run: npx --yes champollion@0.5 sync --method gemini
```

## DeepL

```yaml
- name: Sync translations
  env:
    DEEPL_API_KEY: ${{ secrets.DEEPL_API_KEY }}
  run: npx --yes champollion@0.5 sync --method deepl
```

## Remote Translation API

Kung gumagamit po ng remote translation endpoint (hal., isang hosted translation service):

```yaml
- name: Sync translations
  env:
    CHAMPOLLION_API_KEY: ${{ secrets.CHAMPOLLION_API_KEY }}
  run: npx --yes champollion@0.5 sync
```

## Isang gate bago kayo mag-deploy

Upang maipabigo ang isang build kapag ang anumang locale ay hindi kumpleto o sira, nang walang isinasalin,
patakbuhin ang mga pagsusuri nang mag-isa.

:::warning[Patakbuhin ang gate pagkatapos ng sync, hindi bago ito]
Kung tumatakbo lamang ang pagsasalin pagkatapos ng merge (ang workflow sa itaas), ang isang pull request na
nagdaragdag ng string ay wala pang salin para dito, at ipinapabigo ng `audit`/`verify` ang bawat
naturang PR. Patakbuhin ang gate kung saan umiiral na ang mga salin: sa `main` pagkatapos
ng sync job (`needs: sync`, o `on: workflow_run` ng sync workflow). Ang
trigger na `push` ay hindi gumagana sa sariling mga commit ng sync bot — nai-push ang mga ito
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
      - run: npx --yes champollion@0.5 lint
      # 2. Every key present, nothing empty or left as an [EN] fallback
      - run: npx --yes champollion@0.5 audit
      # 3. Placeholders, ICU plurals, markup and scripts intact. --strict:
      #    warnings fail the build too (an extra or missing plural form, a
      #    source echo, an out-of-date translation pass plain verify).
      - run: npx --yes champollion@0.5 verify --strict
```

| Pagsusuri | Command | Nabibigo kapag |
|-------|---------|------------|
| **Lint** | `lint` | May mga string ang source code na wala sa isang locale file — o walang nahanap na mga source file na susuriin (pinapangalanan nito ang mga folder na tiningnan nito; ituro ito sa ibang lugar gamit ang `--src <dir>`) |
| **Audit** | `audit` | Ang isang key ay nawawala, walang laman, o isa pa ring `[EN]` fallback — o ang isang salin ay **luma na**: ginawa mula sa mas lumang source text kaysa sa kasalukuyan (isang pag-edit sa source na nabigo ang muling pagsasalin) — o ang isang plural message ay walang form na ginagamit ng wika para sa pang-araw-araw na pagbibilang (Russian `few`/`many`; ang mga entry na nabibigo ang `verify --strict`), kasama ang command na magtatanong muli |
| **Verify** | `verify` | Sinira ng salin ang isang placeholder, ICU plural, markup (isang tag na binuksan, isinara, o na-nest nang magkaiba) o script — o may nawawalang key — o isang teksto ang pumapalit para sa ilang magkakaibang source string (isang modelong inuulit ang isang nakasaulong pangungusap) — o walang nahanap na susuriin (ang source file o folder ng mga locale ay wala kung saan itinuturo ng config) |
| **Verify, strict** | `verify --strict` | Alinman sa nasa itaas, o anumang babala |

Lumalabas ang `verify` na may `1` sa anumang error at `0` sa iba pa. Ipiniprint ang mga babala ngunit hindi
nito ipinapabigo ang job: isang echo ng source, dalawang locale na may magkatulad na teksto, isang
salin na luma na, isang salin na nag-alis sa pansarang `?` o `!` ng source
(minamarkahan ng ilang wika ang tanong gamit ang isang kataga sa halip),
at ang mga babala sa plural sa ibaba. Ang isang tekstong isinulat para sa ilang magkakaibang source
string ay isang error: dalawang malinaw na magkaibang multi-word string na sinagot ng
parehong teksto na may apat o higit pang salita, o tatlo o higit pa sa ibang sitwasyon. Binibilang ito
sa mga value ng key, bawat plural branch, at mga Markdown page ng locale, ayon sa
panuntunang ginagamit ng gate ng `sync` sa pagtanggi dito. Ginagawang pagkabigo ng `verify --strict` ang bawat babala.
Gamitin ito kapag, halimbawa, ang mga Russian plural form na hindi isinama ng modelo ay dapat
humarang sa isang deploy. Ang mga lumang salin ay isang babala sa `verify` (buo ang
estruktura) at isang pagkabigo sa `audit` (ang completeness gate), na
nagpiprint ng command na muling magsasalin sa mga ito.

Depende ang mga natuklasan sa plural sa kung paano iniimbak ng format ang mga plural:

| Format | Error (lumalabas ang `verify` nang may 1) | Babala (nabibigo lamang kapag may `--strict`) |
|--------|--------------------------|--------------------------------------|
| i18next suffixed keys (`count_one`, `count_other`, …) | Nawawala ang isang form na kailangan ng locale (French `count_many`): isa itong nawawalang key. | Isang key para sa isang form na wala sa locale (French o Spanish `count_two`). Ipiniprint ng `verify` ang command na nagtatanggal sa eksaktong mga key na iyon, `sync --prune plural-extras`; hindi kailanman binubura ng sync ang mga ito kung wala ito. |
| ICU messages (`{count, plural, …}` sa next-intl, ARB, i18next ICU) | Sira ang estruktura ng plural (isang naisaling variable, keyword, o selector, isang nawawalang `#`). | Nawawala ang isang branch na ginagamit ng locale para sa pang-araw-araw na pagbibilang (Russian `few`, `many`). Ang nawawalang form na ginagamit lamang para sa malalaking numero (French `many`, para sa 1 000 000) ay hindi iniuulat. |
| gettext (`msgid_plural`) | Isang entry na walang salin (walang laman o `fuzzy`): isa itong nawawalang key. | Mga `msgstr[]` form na nag-uulit sa `other` form kung saan may sariling form ang wika para sa pang-araw-araw na pagbibilang (minarkahan ng komento na `# champollion:`). Mas maraming linyang `msgstr[]` kaysa sa `nplurals` ng catalog. Binibilang ang mga plural form ayon sa sariling header na `Plural-Forms` ng catalog. |

Ang isang i18next form na isinalin mula sa teksto ng ibang form ay maaaring maglaman ng eksaktong
teksto ng form na iyon (French `count_many` na katumbas ng `count_other`). Maaaring isulat sa French ang
dalawa nang magkapareho, kaya hindi kailanman ito isang babala. Kapag humiling ang sync sa modelo para sa isang form,
itatala nito iyon sa `.champollion.lock`, kasama ang isang fingerprint ng sagot. Binabasa lamang ng `verify`
ang talang iyon, kaya bawat clone ng isang commit ay nakakakuha ng parehong resulta. Hindi
magkakaiba ang cache ng inyong laptop at ng isang bagong CI runner. Ang isang value na walang tala
(isinulat nang manu-mano, ng ibang tool, ng isang machine translation engine na hindi masasabihan
tungkol sa form, o ng isang mas lumang bersyon) ay nakakakuha ng isang info line kasama ang command
na magtatanong muli. Hindi nabibigo ang `--strict` dito.
Sinusuri ng verify ang estruktura, hindi ang kahulugan: ang pagpasa ay nagsasabing buo ang mga key, placeholder,
plural, markup, at script, hindi na tama ang sinasabi ng teksto.

---

## Tingnan Din

- [CLI Reference](/docs/reference/cli) — kumpletong command reference
- [Paano Gumagana ang Sync](/docs/concepts/how-sync-works) — pag-unawa sa incremental sync
- [Translation Memory](/docs/concepts/translation-memory) — caching at pagtitipid sa gastos
- [Mga Paraan ng Pagsasalin](/docs/guides/translation-methods) — pagpili ng paraan kada pair
- [Quality Gate](/docs/concepts/quality-gate) — kung ano ang nangyayari kapag nabigo ang mga pagsasalin
- [Configuration](/docs/getting-started/configuration) — config reference
