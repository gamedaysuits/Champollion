---
sidebar_position: 3
title: CI/CD
---

# CI/CD Integration

Automate translations in your build pipeline.

The champollion CLI is source-available under the [PolyForm Noncommercial License 1.0.0](https://github.com/gamedaysuits/Champollion/blob/main/cli/LICENSE): free to use, change and share for noncommercial purposes. Using it for a commercial purpose is not covered by this license ([who may use this](/docs/getting-started/who-may-use-this)).

## GitHub Actions: keep translations in sync

A complete workflow: translate what changed, check the result, and commit it
back. It works for any project — Node or not (Django, Flutter, Hugo).

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

**Why the workflow is shaped this way.** `actions/cache` on its own saves the
cache only when the whole job succeeds, and `sync` exits `2` whenever any key
is refused — so a partial run used to skip both the commit and the cache save,
and the next run paid for the same translations again. Here the cache is
restored and saved as two steps (`actions/cache/restore`, then
`actions/cache/save` with `if: always()`), the sync step records its exit code
instead of failing on `2`, the translated files are committed, and only then
does the job fail — in its own step, before `verify`, so the failing step says
why (a `--max-cost` stop, or keys the sync could not translate) instead of
`verify` naming a missing key. The last step is `verify --strict`: plain
`verify` exits 0 on warnings (an extra or missing plural form among them), and
`--strict` fails the job on them. A key the quality gate refused is remembered: the next run
does not send it to the same model again (it would bill the same answer) —
the sync log names it and the `--redo keys:` command that asks again.

**One cache copy per change, not per run.** The restore step brings back the
branch's newest cache (its exact key, `…-newest`, is never saved, so
`restore-keys` picks the most recent one). The save step keys the cache on a
hash of its own files (`hashFiles('.champollion/**')`): a run that translated
something — even a partial run, or one whose push failed — changed the cache,
so it gets a new key and is saved; a run that added nothing (nothing to
translate, everything from the cache, a `--max-cost` stop) has the key it
restored, so the save is skipped and no new copy is stored. Keying on the run
id saved a full copy on every run; keying on the lock and source files would
restore an older copy by exact match after a run whose push was rejected,
because the committed lock never got that run's changes.

In a Node project you can add `champollion` as a dev dependency and call
`npx champollion sync` instead; the pinned `champollion@0.5` above works in any
repository and never picks up a different version by surprise. The job must
then install it: on a fresh runner, `npx champollion` with nothing installed
fetches the latest version, not the one your lock file pins. And the install
writes `node_modules/`, which `git add --all` commits unless your `.gitignore`
lists it (the one `champollion init` creates lists only `.champollion/`), so
stage the locale files and the lock by name, as the Django workflow below does:

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

**Commit the lock files.** `.champollion.lock` and `.champollion-content.lock`
record which source text each translation was made from. They are how the
next run knows a string changed. A runner that never sees them cannot tell an
edited string from an untouched one. **Do not commit `.champollion/`** — it is
the per-machine cache; `champollion init` adds it to `.gitignore`.

**`--max-cost`** stops a run before it spends more than you expect; set it to
what a normal day's changes cost you. When it stops a run, nothing has been
translated or written and sync exits with code `2`: there is nothing to commit,
and the "Stop when the sync was partial" step fails the job, saying so. A method with no published price (a self-hosted
endpoint on another machine) cannot be estimated, so `--max-cost` stops
whenever there is something to translate — leave it off for those. A model
served on the runner itself (`local` at `localhost`/`127.0.0.1`) is priced
at $0 API cost.

**Only pushes that change a source string start the job.** The `paths:`
filter lists your source locale files and `champollion.config.json`: a push
that changes only code, or only translations and the lock files, has nothing
to translate, so it starts no job. Edit the two locale paths to the files your
config names (`messages/en.json`, `lib/l10n/app_en.arb`, …); add your
`contentDir` folder when sync translates Markdown too. **Run workflow** (the
`workflow_dispatch` trigger) still runs it by hand.

**The job's own commit never starts it again** — and the `paths:` filter is
not what stops it. The commit step pushes with the workflow's `GITHUB_TOKEN`,
and a push made with `GITHUB_TOKEN` never triggers a workflow run (GitHub's
rule, so a workflow cannot start itself). That is why the Django workflow
below can watch `locale/**`, which every one of the bot's commits changes.
Push with a personal access token or a GitHub App token instead (to start
other workflows on the bot's commit, say) and that push does start this
workflow again; then the `paths:` filter is what decides. The filter above
leaves out the translated files and the lock files, so the bot's commit
starts no run. The Django filter's `locale/**` takes in the catalogs the bot
commits, so each of its commits starts one more run — which finds nothing to
translate and commits nothing. With such a token, narrow it to the source
catalog (`locale/en/**`) and add languages through the config.

**The provider key is needed on every run that starts**, also when nothing
needs translating: sync checks that the method can run before it looks at what
changed. A run started by hand with no source change still fails without the
`OPENROUTER_API_KEY` secret (or your method's key). `local` needs no key, but
a runner has no model server: a project that translates with `local` on a
developer's machine names a hosted method in CI (`--method` / `--model` — the
commented `SYNC_FLAGS` line in the workflow above). To check that the secret
reaches the step, without translating anything, `sync --dry` warns when the
real run would stop and names the missing variable (it still exits 0 — a dry
run is a preview). It checks that the variable is **set**, not that the key
**works**: it sends nothing, so any non-empty value passes — a placeholder too.
A wrong or revoked key shows on the first request of a real run (the error
names the provider's answer, such as HTTP 401). To fail the job on a missing
key before anything runs, add [the check before the sync](#check-before-sync).

**The cache is kept per method.** A translation is cached under the method,
register and coaching file that made it (a different model of the same
method reuses it — model carry-over). A developer translating with `local`
and CI translating with a hosted model therefore never share cache entries —
and CI's cache is its own anyway (`.champollion/` is not committed). That does
not mean CI re-translates the project: what is already in the locale files,
with its lock file committed, counts as done. CI pays the hosted model for
the strings that are new or changed since the last commit — including any a
developer translated locally but did not commit — and nothing for the rest.
Re-translating the whole project with the hosted model (`--redo all`) bills
every string once.

**On a schedule** instead of on push: replace the `on:` block with
`schedule: [{ cron: '0 6 * * *' }]`.

### Check before the sync: fail the job early {#check-before-sync}

A dry run exits `0` whatever it finds — it is a preview — so `sync --dry
--max-cost 5` warns that the real run would stop at the cap and still passes
as a CI step. To fail a job when the real run would stop (a missing key, or
`--max-cost`), read the summary of `sync --dry --json`. That output is
one JSON object per line (NDJSON), each with a `level` — `info`, `ok` and
`event` lines on stdout, `warn` and `error` lines on stderr — and the last
stdout line is the summary, `{"level": "summary", "command": "sync", …}`.
Select it by its level. **Run it with the same flags as the sync**: without
them it checks the method the config names, so for a project whose config
says `local` it would check the local method — not the hosted model the job
runs — and pass on a runner with no key. As a step in the workflow above,
before "Sync translations", it reads the same `SYNC_FLAGS`:

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

Or in a shell, with the flags written out — the same ones as the sync line:

```bash
SYNC_FLAGS="--method llm --model google/gemini-3.8-flash --max-cost 5"
out=$(npx --yes champollion@0.5 sync --dry $SYNC_FLAGS --json)
printf '%s\n' "$out" | jq -e 'select(.level == "summary") | .preflight.ready and (.maxCost.wouldStop | not)' > /dev/null \
  || printf '%s\n' "$out" | jq -r 'select(.level == "summary") | .error // "A real sync would exit \(.realRun.exitCode): \(.realRun.reasons | join("; "))"'
```

`preflight.ready` is `false` when a key the method needs is missing (unset or
empty — not when it is wrong), whether or not anything needs translating: a
hosted method is never ready without its key. `maxCost.wouldStop` (present with
`--max-cost`) is `true` when the real run would stop at the cap. `jq -e` exits
1 on either, and the step then prints the reason in the job log — for example
`A real sync would exit 1: it would stop before translating: No OpenRouter API
key (OPENROUTER_API_KEY) for en:fr`, or `A real sync would exit 2: --max-cost
would stop it before any API call (Estimated translation cost exceeds the
--max-cost cap: estimate ~$7.1200, cap $5.0000)`. When sync cannot run at
all (a broken config), the step prints the summary's `error` instead. The step
does not send stderr to `/dev/null`, so the warnings stay in the log too. The
summary's `realRun.exitCode` says what the real run would exit
with, as far as a preview can tell: `1` when the preflight would stop it, `2`
when `--max-cost` would, or when it would end partial — keys held back, or
plural messages on disk without a form the language uses (`realRun.reasons`
says which). A refusal by the quality gate, which only the real run finds, can
still turn a `0` into a `2`. To fail the check on a predicted partial run too,
put `.realRun.exitCode == 0` in place of `.preflight.ready and (.maxCost.wouldStop | not)`.

### A protected main branch: propose a pull request

The workflow above pushes the translations straight to `main`. If `main` is
protected (required reviews or status checks), that push is rejected — after
the sync has run, so the translations are already paid for. They are not paid
for again: the cache is saved before the commit step, even when a step fails,
so re-running the job or the next push (each restores the branch's newest
cache, through `restore-keys`) serves them from the cache. The
lock files never reached `main`, so the next run finds the same strings
changed and writes them again — from the cache, at no cost.

On a protected `main`, commit to a branch the bot owns and open (or update) a
pull request instead. Keep the workflow above and change two things: the
permissions, and the commit step.

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

**When to use which.** Push to `main` when the workflow may push there: no
branch protection, or a rule that lets GitHub Actions bypass it. Open a pull
request when `main` is protected, or when a person — a speaker of the language
— should read the translations before they ship.

- The branch belongs to the bot. Until the pull request is merged, `main`'s
  lock files do not have its translations, so every run proposes the whole set
  again — from the cache, so only strings changed since are billed. Edits
  pushed to that branch are replaced by the next run: review in the pull
  request, merge, then edit on `main` (a later bulk redo keeps a person's
  edit).
- The repository must let Actions open pull requests: Settings → Actions →
  General → "Allow GitHub Actions to create and approve pull requests".
- A pull request opened with the workflow's `GITHUB_TOKEN` starts no other
  workflow, so required status checks never run on it. If `main` requires
  them, open it with a GitHub App token or a fine-grained token kept as a
  secret (`GH_TOKEN: ${{ secrets.<name> }}`), or use an action such as
  `peter-evans/create-pull-request`, which commits, updates the branch and
  edits the open pull request for you (pass it the token the same way).

### gettext (Django, Babel) and Flutter

Sync translates the catalogs that exist; it does not extract strings from
your code. A Django project refreshes the catalogs before the sync step,
checks they compile after it, and commits only the catalogs.

`makemessages` and `compilemessages` both import your settings, so the job
sets what they need, once, for every step: any variable your settings module
reads at import (`SECRET_KEY`, `DATABASE_URL`, …). Neither command touches the
database, so a placeholder value is enough for those. `DJANGO_SETTINGS_MODULE`
is left commented out: the `manage.py` that `startproject` writes sets it
itself, and a value set in the job overrides that one — a wrong module name
breaks `makemessages`. Set it only when your `manage.py` does not.

Its `paths:` filter differs from the workflow above: the source strings live in
your Python code and templates, and `makemessages` extracts them in the job, so
a code change can bring a new string. Narrow the patterns to your apps
(`myapp/**.py`) if every push touches Python. It watches `locale/**` as well:
a new language arrives as a new catalog folder (`makemessages -l <code>`). The
bot's own commit changes those catalogs but starts no run, because it is
pushed with `GITHUB_TOKEN` (see **The job's own commit never starts it again**
above — and what to narrow when you push with another token).

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

`--all` updates every catalog that already exists; add a language with
`makemessages -l <code>` once (or `champollion init --langs <code>`).
`makemessages` runs once per domain: `django` for Python and templates,
`djangojs` (`-d djangojs`) for JavaScript. Sync translates every domain's
catalog it finds. The last step runs `verify --strict`. A Russian plural entry
whose translation lacks the `few` or `many` form is written with the `other`
form and marked `# champollion:`. Every sync exits `2` while such an entry is
in a catalog — the one that writes it and every one after, as for a key held
back — and its summary names the entry and the command that asks again; the
post-sync verification line then says the run is incomplete instead of `[OK]`.
So the "Stop when the sync was partial" step fails the job after the commit
until the forms are written. Standalone, it is a warning: plain `verify`
exits 0 on it, while `--strict` fails. `audit` counts the same entries as
incomplete.

`compilemessages` runs `msgfmt --check-format`, which also checks that each
`%(name)s` keeps its type — but only on entries flagged `#, python-format`.
`makemessages` adds that flag to the entries it extracts with a `%`
placeholder; a catalog made by hand may lack it, and its entries are then not
checked. `champollion
verify` compares every entry's printf placeholders (name and type letter)
whatever its flags, and sync keeps the source entry's flags on each entry it
translates. The commit step stages `*.po` and
`.champollion.lock` by name (and the replaced-edits record when there is
one); if your project does track its `.mo` files, add `'*.mo'` to it. The
cache steps, the recorded exit code and the `git pull --rebase` are there for
the same reasons as in the workflow above. Babel: `pybabel extract` + `pybabel update --no-wrap` before
the sync, `pybabel compile` after it.

Flutter needs no extra step in this job: sync writes the `app_<locale>.arb`
files, and `flutter gen-l10n` (or `flutter build`, which runs it) is your
app's own build step, where it turns them into Dart.

#### Plural forms a model left out {#plural-gaps}

A marked entry is not a translation, so sync does not leave it to a person
alone:

- **Another method or model asks again by itself.** A sync whose setup
  (method, model, register, coaching) has not answered that entry yet sends
  it to the model again — not to the cache, which holds the incomplete
  answer. So when a developer's local model left the forms out, the job's
  hosted model (`SYNC_FLAGS`) asks for them on its next run, and the estimate
  prices it. The lock (`.champollion.lock`, under `gaps`) records each setup
  that answered without the forms, so a local run and a CI run never take
  turns paying for the same incomplete answer.
- **`sync --redo gaps` asks for every such entry**, whoever left it — in the
  workflows above, tick `redo_gaps` under **Run workflow**. Add `--model` to
  `SYNC_FLAGS` for a stronger model.
- **If the new answer lacks the forms too, the entry stays marked** and the
  run exits `2`, as before. Then write the forms by hand and delete the
  `# champollion:` line.

A dry run (`sync --dry`) names the entries it would ask for again and prices
them; its `--json` summary counts the ones it would not (`totalPluralGaps`)
and says the real run would exit `2` over them (`realRun.exitCode`).

## Other methods

The snippets below show the key each method needs and its `sync` command.
Use them **inside** the "Sync translations" step of the workflow above: swap
its `env`, put the flags shown (`--method openai`, …) in the workflow's
`SYNC_FLAGS` line — so the dry-run check runs the same method — and keep the
rest of the step (`id: sync` and the lines that record the exit code), so a
partial run still commits what it translated and saves the cache.

## Google Translate Method

If using the built-in Google Translate method instead of OpenRouter:

```yaml
- name: Sync translations
  env:
    GOOGLE_TRANSLATE_API_KEY: ${{ secrets.GOOGLE_TRANSLATE_API_KEY }}
  run: npx --yes champollion@0.5 sync
```

## Direct LLM Providers

If using `openai`, `anthropic`, or `gemini` methods directly:

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

If using a remote translation endpoint (e.g., a hosted translation service):

```yaml
- name: Sync translations
  env:
    CHAMPOLLION_API_KEY: ${{ secrets.CHAMPOLLION_API_KEY }}
  run: npx --yes champollion@0.5 sync
```

## A gate before you deploy

To fail a build when any locale is incomplete or damaged, without translating
anything, run the checks on their own.

:::warning[Run the gate after the sync, not before it]
If translation only runs after merge (the workflow above), a pull request that
adds a string has no translation for it yet, and `audit`/`verify` fail every
such PR. Run the gate where the translations already exist: on `main` after
the sync job (`needs: sync`, or `on: workflow_run` of the sync workflow). A
`push` trigger does not fire on the sync bot's own commits — they are pushed
with `GITHUB_TOKEN`, which starts no workflow (see above). On pull requests,
run `lint` only, or run the sync job on the PR branch first.
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

| Check | Command | Fails when |
|-------|---------|------------|
| **Lint** | `lint` | Source code has strings that are not in a locale file — or it found no source files to check (it names the folders it looked in; point it elsewhere with `--src <dir>`) |
| **Audit** | `audit` | A key is missing, empty, or still an `[EN]` fallback — or a translation is **out of date**: made from an older source text than the current one (a source edit whose re-translation failed) — or a plural message lacks a form the language uses for everyday counts (Russian `few`/`many`; the entries `verify --strict` fails on), with the command that asks again |
| **Verify** | `verify` | A translation damaged a placeholder, ICU plural, markup (a tag opened, closed or nested differently) or script — or a key is missing — or one text stands in for several different source strings (a model repeating a memorized sentence) — or it found nothing to check (the source file or locales folder is not where the config points) |
| **Verify, strict** | `verify --strict` | Any of the above, or any warning |

`verify` exits `1` on any error and `0` otherwise. Warnings are printed but do
not fail the job: a source echo, two locales with identical text, a
translation that is out of date, a translation that dropped the source's
closing `?` or `!` (some languages mark a question with a particle instead),
and the plural warnings below. One text written for several different source
strings is an error: two clearly different multi-word strings answered with
the same text of four or more words, or three or more otherwise. It is counted
over key values, each plural branch and the locale's Markdown pages, by the
rule `sync`'s gate refuses it with. `verify --strict` turns every warning into
a failure. Use it when, say, Russian plural forms the model left out must
block a deploy. Out-of-date translations are a warning in `verify` (the
structure is intact) and a failure in `audit` (the completeness gate), which
prints the command that re-translates them.

Plural findings depend on how the format stores plurals:

| Format | Error (`verify` exits 1) | Warning (fails only with `--strict`) |
|--------|--------------------------|--------------------------------------|
| i18next suffixed keys (`count_one`, `count_other`, …) | A form the locale needs is missing (French `count_many`): it is a missing key. | A key for a form the locale does not have (French or Spanish `count_two`). `verify` prints the command that removes exactly those keys, `sync --prune plural-extras`; sync never deletes them without it. |
| ICU messages (`{count, plural, …}` in next-intl, ARB, i18next ICU) | The plural structure is damaged (a translated variable, keyword or selector, a lost `#`). | A branch the locale uses for everyday counts is missing (Russian `few`, `many`). A missing form used only for large numbers (French `many`, for 1 000 000) is not reported. |
| gettext (`msgid_plural`) | An entry with no translation (empty or `fuzzy`): it is a missing key. | `msgstr[]` forms that repeat the `other` form where the language has its own form for everyday counts (marked with a `# champollion:` comment). More `msgstr[]` lines than the catalog's `nplurals`. Plural forms are counted by the catalog's own `Plural-Forms` header. |

An i18next form translated from another form's text can hold exactly that
form's text (French `count_many` equal to `count_other`). French may write the
two alike, so this is never a warning. When sync asks the model for a form, it
records that in `.champollion.lock`, with a fingerprint of the answer. `verify`
reads only that record, so every clone of a commit gets the same result. Your
laptop's cache and a fresh CI runner cannot disagree. A value with no record
(written by hand, by another tool, by a machine translation engine that cannot
be told the form, or by an older version) gets an info line with the command
that asks again. `--strict` does not fail on it.
Verify checks structure, not meaning: a pass says the keys, placeholders,
plurals, markup and script are intact, not that the text says the right
thing.

---

## See Also

- [CLI Reference](/docs/reference/cli) — full command reference
- [How Sync Works](/docs/concepts/how-sync-works) — understanding incremental sync
- [Translation Memory](/docs/concepts/translation-memory) — caching and cost savings
- [Translation Methods](/docs/guides/translation-methods) — method selection per pair
- [Quality Gate](/docs/concepts/quality-gate) — what happens when translations fail
- [Configuration](/docs/getting-started/configuration) — config reference
