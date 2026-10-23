---
sidebar_position: 3
title: "CI/CD"
---

# Intégration CI/CD

Automatisez les traductions dans votre pipeline de build.

L'interface en ligne de commande (CLI) de Champollion est à code source accessible sous la [licence PolyForm Noncommercial 1.0.0](https://github.com/gamedaysuits/Champollion/blob/main/cli/LICENSE) : libre d'utilisation, de modification et de partage à des fins non commerciales. Son utilisation à des fins commerciales n'est pas couverte par cette licence ([qui peut l'utiliser](/docs/getting-started/who-may-use-this)).

## GitHub Actions : maintenir les traductions synchronisées

Un flux de travail complet : traduire ce qui a changé, vérifier le résultat et le
commiter en retour. Il fonctionne pour n'importe quel projet — Node ou non (Django, Flutter, Hugo).

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

**Pourquoi le flux de travail est conçu ainsi.** `actions/cache` seul n'enregistre le
cache que si l'ensemble du job réussit, et `sync` quitte avec le code `2` dès qu'une clé
est refusée — ainsi, une exécution partielle omettait à la fois le commit et la sauvegarde du cache,
et l'exécution suivante payait à nouveau pour les mêmes traductions. Ici, le cache est
restauré et sauvegardé en deux étapes distinctes (`actions/cache/restore`, puis
`actions/cache/save` avec `if: always()`), l'étape de synchronisation enregistre son code de sortie
au lieu d'échouer sur `2`, les fichiers traduits sont commités, et ce n'est qu'alors
que le job échoue — dans sa propre étape, avant `verify`, afin que l'étape en échec indique
la cause (un arrêt lié à `--max-cost`, ou des clés que la synchronisation n'a pas pu traduire) au lieu que
`verify` ne signale une clé manquante. La dernière étape est `verify --strict` : un simple
`verify` quitte avec le code 0 en présence d'avertissements (notamment une forme plurielle manquante ou superflue), et
`--strict` fait échouer le job dans ce cas. Une clé refusée par la barrière de qualité est mémorisée : l'exécution suivante
ne la renvoie pas au même modèle (ce qui facturerait la même réponse) —
le journal de synchronisation la nomme, ainsi que la commande `--redo keys:` pour la solliciter à nouveau.

**Une copie de cache par modification, et non par exécution.** L'étape de restauration récupère le
cache le plus récent de la branche (sa clé exacte, `…-newest`, n'étant jamais enregistrée,
`restore-keys` sélectionne la plus récente). L'étape de sauvegarde indexe le cache sur un
hachage de ses propres fichiers (`hashFiles('.champollion/**')`) : une exécution ayant traduit
quelque chose — même partielle, ou dont le push a échoué — a modifié le cache ;
elle obtient donc une nouvelle clé et est sauvegardée. Une exécution n'ayant rien ajouté (rien à
traduire, tout provenant du cache, un arrêt lié à `--max-cost`) conserve la clé qu'elle
a restaurée ; la sauvegarde est donc ignorée et aucune nouvelle copie n'est stockée. L'indexation sur l'identifiant
d'exécution enregistrait une copie complète à chaque fois ; l'indexation sur le fichier lock et les fichiers sources
restaurerait une copie plus ancienne par correspondance exacte après une exécution dont le push a été rejeté,
car le fichier lock commité n'a jamais reçu les modifications de cette exécution.

Dans un projet Node, vous pouvez ajouter `champollion` en tant que dépendance de développement et exécuter
`npx champollion sync` à la place ; la version épinglée `champollion@0.6` ci-dessus fonctionne dans n'importe quel
dépôt et ne sélectionne jamais une version différente à l'improviste. Le job doit
alors l'installer : sur un exécuteur vierge, `npx champollion` sans rien d'installé
récupère la dernière version, et non celle que votre fichier lock épingle. De plus, l'installation
écrit `node_modules/`, que `git add --all` commite à moins que votre `.gitignore`
ne le liste (celui créé par `champollion init` ne liste que `.champollion/`) ; indexez donc
les fichiers de paramètres régionaux et le fichier lock par leur nom, comme le fait le flux de travail Django ci-dessous :

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

**Commitez les fichiers lock.** `.champollion.lock` et `.champollion-content.lock`
enregistrent le texte source à partir duquel chaque traduction a été réalisée. C'est ainsi que
l'exécution suivante sait qu'une chaîne a été modifiée. Un exécuteur qui ne les voit jamais ne peut distinguer une
chaîne modifiée d'une chaîne intacte. **Ne commitez pas `.champollion/`** — il s'agit du
cache propre à la machine ; `champollion init` l'ajoute à `.gitignore`.

**`--max-cost`** interrompt une exécution avant qu'elle ne dépense plus que prévu ; configurez-le
en fonction du coût habituel de vos modifications quotidiennes. Lorsqu'il interrompt une exécution, rien n'a été
traduit ni écrit et sync se termine avec le code `2` : il n'y a rien à commiter,
et l'étape « Stop when the sync was partial » fait échouer le job en l'indiquant. Une méthode sans tarif publié (un point
de terminaison auto-hébergé sur une autre machine) ne peut pas être estimée ; par conséquent, `--max-cost` s'interrompt
dès qu'il y a quelque chose à traduire — désactivez-le dans ce cas. Un modèle
servi sur l'exécuteur lui-même (`local` sur `localhost`/`127.0.0.1`) est évalué
à 0 $ de coût d'API.

**Seuls les pushes qui modifient une chaîne source démarrent le job.** Le filtre `paths:`
liste vos fichiers de paramètres régionaux sources et `champollion.config.json` : un push
qui ne modifie que du code, ou uniquement les traductions et les fichiers lock, n'a rien
à traduire et ne lance donc aucun job. Modifiez les deux chemins de paramètres régionaux pour pointer vers les fichiers spécifiés
dans votre configuration (`messages/en.json`, `lib/l10n/app_en.arb`, …) ; ajoutez votre
dossier `contentDir` lorsque sync traduit également du Markdown. Le déclencheur `workflow_dispatch` (**Run workflow**)
permet toujours de l'exécuter manuellement.

**Le propre commit du job ne le redémarre jamais** — et le filtre `paths:` n'est
pas ce qui l'en empêche. L'étape de commit effectue le push avec le `GITHUB_TOKEN` du flux de travail,
et un push effectué avec `GITHUB_TOKEN` ne déclenche jamais d'exécution de flux de travail (règle imposée par GitHub
pour éviter qu'un flux de travail ne s'auto-déclenche). C'est pourquoi le flux de travail Django
ci-dessous peut surveiller `locale/**`, que chacun des commits du robot modifie.
Si vous effectuez le push avec un jeton d'accès personnel ou un jeton GitHub App (par exemple pour déclencher
d'autres flux de travail sur le commit du robot), ce push redéclenche ce flux
de travail ; c'est alors le filtre `paths:` qui fait office d'arbitre. Le filtre ci-dessus
exclut les fichiers traduits et les fichiers lock, de sorte que le commit du robot
ne déclenche aucune exécution. Le filtre `locale/**` de Django englobe les catalogues que le robot
commite, si bien que chacun de ses commits démarre une nouvelle exécution — laquelle ne trouve rien à
traduire et ne commite rien. Avec un tel jeton, limitez le filtre au catalogue
source (`locale/en/**`) et ajoutez les langues via la configuration.

**La clé du fournisseur est requise à chaque exécution qui démarre**, même lorsque rien
ne nécessite de traduction : sync vérifie que la méthode peut s'exécuter avant d'examiner ce qui
a changé. Une exécution lancée manuellement sans modification source échouera tout de même sans le
secret `OPENROUTER_API_KEY` (ou la clé de votre méthode). `local` ne requiert aucune clé, mais
un exécuteur ne dispose d'aucun serveur de modèles : un projet qui traduit avec `local` sur la
machine d'un développeur désignera une méthode hébergée en CI (`--method` / `--model` — la
ligne `SYNC_FLAGS` commentée dans le flux de travail ci-dessus). Pour vérifier que le secret
parvient bien à l'étape sans rien traduire, `sync --dry` avertit si
l'exécution réelle s'arrêterait et nomme la variable manquante (il quitte toujours avec le code 0 — une exécution
à blanc est un aperçu). Il vérifie que la variable est **définie**, non que la clé
**fonctionne** : aucune requête n'étant envoyée, toute valeur non vide est acceptée — y compris un paramètre fictif.
Une clé erronée ou révoquée se manifestera dès la première requête d'une exécution réelle (l'erreur
indique la réponse du fournisseur, par exemple HTTP 401). Pour faire échouer le job en cas de clé manquante
avant toute exécution, ajoutez [la vérification préalable à la synchronisation](#check-before-sync).

**Le cache est conservé par méthode.** Une traduction est mise en cache selon la méthode,
le registre et le fichier de coaching qui l'ont produite (un modèle différent au sein de la même
méthode la réutilise — report de modèle). Un développeur traduisant avec `local`
et une CI traduisant avec un modèle hébergé ne partagent donc jamais d'entrées de cache —
et le cache de la CI est de toute façon autonome (`.champollion/` n'étant pas commité). Cela ne
signifie pas que la CI retraduit l'ensemble du projet : ce qui se trouve déjà dans les fichiers de paramètres régionaux,
avec leur fichier lock commité, est considéré comme acquis. La CI ne paie le modèle hébergé que pour
les chaînes nouvelles ou modifiées depuis le dernier commit — y compris celles qu'un
développeur a traduites localement sans les commiter — et rien pour le reste.
Retraduire l'intégralité du projet avec le modèle hébergé (`--redo all`) facture
chaque chaîne une seule fois.

**Selon une planification** plutôt que lors d'un push : remplacez le bloc `on:` par
`schedule: [{ cron: '0 6 * * *' }]`.

### Vérification préalable à la synchronisation : faire échouer le job au plus tôt {#check-before-sync}

Une exécution à blanc quitte avec le code `0` quoi qu'elle trouve — c'est un aperçu — ainsi `sync --dry
--max-cost 5` avertit que l'exécution réelle s'arrêterait au plafond tout en validant
l'étape de CI. Pour faire échouer un job lorsque l'exécution réelle s'arrêterait (clé manquante ou
`--max-cost`), lisez le résumé de `sync --dry --json`. Cette sortie se compose d'un
objet JSON par ligne (NDJSON), chacun comportant un champ `level` — lignes `info`, `ok` et
`event` sur stdout, lignes `warn` et `error` sur stderr — et la dernière
ligne de stdout est le résumé, `{"level": "summary", "command": "sync", …}`.
Sélectionnez-la par son niveau. **Exécutez-la avec les mêmes drapeaux que la synchronisation** : sans
eux, elle vérifie la méthode indiquée dans la configuration ; ainsi, pour un projet dont la configuration
spécifie `local`, elle vérifierait la méthode locale — et non le modèle hébergé qu'exécute le
job — et réussirait sur un exécuteur sans clé. Insérée comme étape dans le flux de travail ci-dessus,
avant « Sync translations », elle lit les mêmes `SYNC_FLAGS` :

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

Ou dans un shell, avec les options explicitées — identiques à celles de la commande de synchronisation :

```bash
SYNC_FLAGS="--method llm --model google/gemini-3.8-flash --max-cost 5"
out=$(npx --yes champollion@0.6 sync --dry $SYNC_FLAGS --json)
printf '%s\n' "$out" | jq -e 'select(.level == "summary") | .preflight.ready and (.maxCost.wouldStop | not)' > /dev/null \
  || printf '%s\n' "$out" | jq -r 'select(.level == "summary") | .error // "A real sync would exit \(.realRun.exitCode): \(.realRun.reasons | join("; "))"'
```

`preflight.ready` vaut `false` lorsqu'une clé requise par la méthode est manquante (non définie ou
vide — non lorsqu'elle est invalide), que des éléments soient à traduire ou non : une
méthode hébergée n'est jamais prête sans sa clé. `maxCost.wouldStop` (présent avec
`--max-cost`) vaut `true` lorsque l'exécution réelle s'arrêterait au plafond. `jq -e` quitte avec le code
1 dans l'un ou l'autre cas, et l'étape affiche alors le motif dans le journal du job — par exemple
`A real sync would exit 1: it would stop before translating: No OpenRouter API
key (OPENROUTER_API_KEY) for en:fr`, or `A real sync would exit 2: --max-cost
would stop it before any API call (Estimated translation cost exceeds the
--max-cost cap: estimate ~$7.1200, cap $5.0000)`. Lorsque sync ne peut pas du tout
s'exécuter (configuration corrompue), l'étape affiche à la place le champ `error` du résumé. L'étape
ne redirige pas stderr vers `/dev/null`, les avertissements restent donc également dans le journal. Le champ
`realRun.exitCode` du résumé indique le code avec lequel l'exécution réelle se
terminerait, dans la mesure de ce qu'un aperçu peut prévoir : `1` lorsque la vérification préalable l'arrêterait, `2`
lorsque `--max-cost` le ferait, ou lorsqu'elle se terminerait de manière partielle — clés retenues, ou
messages pluriels sur le disque sans une forme requise par la langue (`realRun.reasons`
précise lesquelles). Un refus par la barrière de qualité, que seule l'exécution réelle peut détecter, peut
toujours faire passer le code de `0` à `2`. Pour faire également échouer la vérification sur une exécution partielle prévue,
remplacez `.preflight.ready and (.maxCost.wouldStop | not)` par `.realRun.exitCode == 0`.

### Branche principale protégée : proposer une pull request

Le flux de travail ci-dessus pousse les traductions directement vers `main`. Si `main` est
protégée (revues ou vérifications d'état obligatoires), ce push est rejeté — après
l'exécution de la synchronisation, les traductions ont donc déjà été payées. Elles ne sont pas
payées une seconde fois : le cache étant sauvegardé avant l'étape de commit, même en cas d'échec d'une étape,
la réexécution du job ou le push suivant (chacun restaurant le cache le plus récent
de la branche via `restore-keys`) les récupère directement depuis le cache. Les
fichiers lock n'ayant jamais atteint `main`, l'exécution suivante détecte à nouveau les mêmes chaînes
modifiées et les réécrit — à partir du cache, sans coût supplémentaire.

Sur une branche `main` protégée, commitez plutôt sur une branche appartenant au robot et ouvrez (ou mettez à jour) une
pull request. Conservez le flux de travail ci-dessus en modifiant deux éléments : les
permissions et l'étape de commit.

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

**Quelle approche choisir.** Effectuez un push vers `main` lorsque le flux de travail y est autorisé : aucune
protection de branche, ou une règle permettant à GitHub Actions de la contourner. Ouvrez une pull
request lorsque `main` est protégée, ou lorsqu'une personne — un locuteur de la langue
— doit relire les traductions avant leur déploiement.

- La branche appartient au robot. Tant que la pull request n'est pas fusionnée, les fichiers
  lock de `main` ne contiennent pas ses traductions ; chaque exécution repropose donc l'ensemble
  complet — depuis le cache, de sorte que seules les chaînes modifiées depuis lors sont facturées. Les modifications
  poussées sur cette branche sont écrasées par l'exécution suivante : relisez dans la pull
  request, fusionnez, puis éditez sur `main` (une réexécution globale ultérieure préserve la modification
  effectuée par un humain).
- Le dépôt doit autoriser GitHub Actions à ouvrir des pull requests : Paramètres → Actions →
  Général → « Autoriser GitHub Actions à créer et approuver des pull requests ».
- Une pull request ouverte avec le `GITHUB_TOKEN` du flux de travail ne lance aucun autre
  flux de travail ; les vérifications d'état obligatoires ne s'y exécutent donc jamais. Si `main` les
  exige, ouvrez-la avec un jeton GitHub App ou un jeton à granularité fine conservé comme
  secret (`GH_TOKEN: ${{ secrets.<name> }}`), ou utilisez une action telle que
  `peter-evans/create-pull-request`, qui commite, met à jour la branche et
  modifie la pull request ouverte à votre place (transmettez-lui le jeton de la même manière).

### gettext (Django, Babel) et Flutter

Sync traduit les catalogues existants ; il n'extrait pas les chaînes depuis
votre code. Un projet Django actualise les catalogues avant l'étape de synchronisation,
vérifie qu'ils compilent après celle-ci et ne commite que les catalogues.

`makemessages` et `compilemessages` importent tous deux vos paramètres ; le job
définit donc ce dont ils ont besoin, une seule fois pour chaque étape : toute variable lue par
votre module de paramètres lors de l'import (`SECRET_KEY`, `DATABASE_URL`, …). Aucune de ces commandes ne touchant à la
base de données, une valeur fictive suffit pour celles-ci. `DJANGO_SETTINGS_MODULE`
est laissée en commentaire : le fichier `manage.py` généré par `startproject` la définit
lui-même, et une valeur définie dans le job écraserait celle-ci — un nom de module erroné
provoquerait l'échec de `makemessages`. Ne la définissez que si votre `manage.py` ne le fait pas.

Son filtre `paths:` diffère de celui du flux de travail ci-dessus : les chaînes sources résident dans
votre code Python et vos modèles (templates), et `makemessages` les extrait au cours du job ;
une modification de code peut donc introduire une nouvelle chaîne. Restreignez les motifs à vos applications
(`myapp/**.py`) si chaque push modifie du code Python. Il surveille également `locale/**` :
une nouvelle langue se matérialise par un nouveau dossier de catalogue (`makemessages -l <code>`). Le
propre commit du robot modifie ces catalogues mais ne déclenche aucune exécution, car il est
poussé avec `GITHUB_TOKEN` (voir **Le propre commit du job ne le redémarre jamais**
ci-dessus — ainsi que les éléments à restreindre en cas de push avec un autre jeton).

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

`--all` met à jour chaque catalogue existant ; ajoutez une langue avec
`makemessages -l <code>` une fois (ou `champollion init --langs <code>`).
`makemessages` s'exécute une fois par domaine : `django` pour Python et les modèles,
`djangojs` (`-d djangojs`) pour JavaScript. Sync traduit le catalogue de chaque domaine
qu'il rencontre. La dernière étape exécute `verify --strict`. Une entrée de pluriel en russe
dont la traduction omet la forme `few` ou `many` est écrite avec la forme `other`
et marquée `# champollion:`. Chaque synchronisation quitte avec le code `2` tant qu'une telle entrée
se trouve dans un catalogue — celle qui l'écrit et toutes les suivantes, de même que pour une clé
retenue — et son résumé nomme l'entrée ainsi que la commande pour la solliciter à nouveau ; la
ligne de vérification post-synchronisation indique alors que l'exécution est incomplète au lieu de `[OK]`.
L'étape « Stop when the sync was partial » fait donc échouer le job après le commit
tant que les formes ne sont pas rédigées. Utilisée seule, il s'agit d'un avertissement : un simple `verify`
quitte avec 0, tandis que `--strict` échoue. `audit` comptabilise ces mêmes entrées comme
incomplètes.

`compilemessages` exécute `msgfmt --check-format`, qui vérifie également que chaque
`%(name)s` conserve son type — mais uniquement sur les entrées dotées du drapeau `#, python-format`.
`makemessages` ajoute ce drapeau aux entrées qu'il extrait avec un espace réservé `%` ;
un catalogue créé manuellement peut en être dépourvu, et ses entrées ne sont alors pas
vérifiées. `champollion verify` compare les espaces réservés printf de chaque entrée (nom et lettre de type)
quels que soient ses drapeaux, et sync conserve les drapeaux de l'entrée source sur chaque entrée qu'il
traduit. L'étape de commit indexe `*.po` et
`.champollion.lock` par leur nom (ainsi que le registre des modifications remplacées lorsqu'il y en a
un) ; si votre projet suit ses fichiers `.mo`, ajoutez-y `'*.mo'`. Les
étapes de cache, l'enregistrement du code de sortie et `git pull --rebase` sont présents pour
les mêmes raisons que dans le flux de travail ci-dessus. Pour Babel : `pybabel extract` + `pybabel update --no-wrap` avant
la synchronisation, `pybabel compile` après celle-ci.

Flutter ne nécessite aucune étape supplémentaire dans ce job : sync écrit les fichiers
`app_<locale>.arb`, et `flutter gen-l10n` (ou `flutter build`, qui l'exécute) correspond à l'étape
de build propre à votre application, lors de laquelle elle les convertit en Dart.

#### Formes plurielles omises par un modèle {#plural-gaps}

Une entrée marquée n'est pas une traduction ; sync ne la laisse donc pas à la charge
d'une personne seule :

- **Une autre méthode ou un autre modèle la sollicite de nouveau automatiquement.** Une synchronisation dont la configuration
  (méthode, modèle, registre, coaching) n'a pas encore répondu pour cette entrée la soumet
  à nouveau au modèle — et non au cache, qui conserve la réponse
  incomplète. Ainsi, lorsqu'un modèle local d'un développeur a omis les formes requises, le modèle
  hébergé du job (`SYNC_FLAGS`) les demande lors de son exécution suivante, et l'estimation
  en calcule le coût. Le fichier lock (`.champollion.lock`, sous `gaps`) consigne chaque configuration
  ayant répondu sans les formes nécessaires, évitant ainsi qu'une exécution locale et une exécution CI ne paient
  tour à tour pour la même réponse incomplète.
- **`sync --redo gaps` sollicite à nouveau chacune de ces entrées**, quelle que soit la méthode l'ayant produite — dans les
  flux de travail ci-dessus, cochez `redo_gaps` sous **Run workflow**. Ajoutez `--model` à
  `SYNC_FLAGS` pour utiliser un modèle plus performant.
- **Si la nouvelle réponse omet également ces formes, l'entrée reste marquée** et
  l'exécution se termine avec le code `2`, comme précédemment. Rédigez alors les formes manuellement et supprimez la
  ligne `# champollion:`.

Une exécution à blanc (`sync --dry`) nomme les entrées qu'elle redemanderait et évalue
leur coût ; son résumé `--json` comptabilise celles qu'elle ne redemanderait pas (`totalPluralGaps`)
et indique que l'exécution réelle quitterait avec le code `2` à cause d'elles (`realRun.exitCode`).

## Autres méthodes

Les extraits ci-dessous présentent la clé requise par chaque méthode ainsi que sa commande `sync`.
Utilisez-les **à l'intérieur** de l'étape « Sync translations » du flux de travail ci-dessus : remplacez
son `env`, insérez les drapeaux indiqués (`--method openai`, …) dans la ligne `SYNC_FLAGS`
du flux de travail — afin que la vérification à blanc utilise la même méthode — et conservez le
reste de l'étape (`id: sync` et les lignes qui enregistrent le code de sortie), pour qu'une
exécution partielle commite tout de même les éléments traduits et sauvegarde le cache.

## Méthode Google Translate

En cas d'utilisation de la méthode intégrée Google Translate à la place d'OpenRouter :

```yaml
- name: Sync translations
  env:
    GOOGLE_TRANSLATE_API_KEY: ${{ secrets.GOOGLE_TRANSLATE_API_KEY }}
  run: npx --yes champollion@0.6 sync
```

## Fournisseurs de LLM directs

En cas d'utilisation directe des méthodes `openai`, `anthropic` ou `gemini` :

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

## API de traduction distante

En cas d'utilisation d'un point de terminaison de traduction distant (par ex. un service de traduction hébergé) :

```yaml
- name: Sync translations
  env:
    CHAMPOLLION_API_KEY: ${{ secrets.CHAMPOLLION_API_KEY }}
  run: npx --yes champollion@0.6 sync
```

## Une barrière de validation avant le déploiement

Pour faire échouer un build dès qu'un paramètre régional est incomplet ou corrompu, sans traduire
quoi que ce soit, exécutez les vérifications de manière autonome.

:::warning[Exécutez la barrière de validation après la synchronisation, non avant]
Si la traduction ne s'exécute qu'après la fusion (le flux de travail ci-dessus), une pull request qui
ajoute une chaîne n'en a pas encore la traduction, et `audit`/`verify` font échouer chacune
de ces PR. Exécutez la barrière de validation là où les traductions existent déjà : sur `main` après
le job de synchronisation (`needs: sync`, ou `on: workflow_run` du flux de travail de synchronisation). Un
déclencheur `push` ne se déclenche pas sur les propres commits du robot de synchronisation — ils sont poussés
avec `GITHUB_TOKEN`, qui ne démarre aucun flux de travail (voir plus haut). Sur les pull requests,
exécutez uniquement `lint`, ou exécutez d'abord le job de synchronisation sur la branche de la PR.
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

| Contrôle | Commande | Échoue lorsque |
|----------|----------|----------------|
| **Lint** | `lint` | Le code source contient des chaînes absentes d'un fichier de paramètres régionaux — ou aucun fichier source à vérifier n'a été trouvé (la commande nomme les dossiers examinés ; réorientez-la avec `--src <dir>`) |
| **Audit** | `audit` | Une clé est manquante, vide ou constitue encore un repli `[EN]` — ou une traduction est **obsolète** : issue d'un texte source plus ancien que le texte actuel (modification source dont la retraduction a échoué) — ou un message pluriel est dépourvu d'une forme requise par la langue pour le comptage courant (`few`/`many` en russe ; les entrées sur lesquelles `verify --strict` échoue), avec la commande pour la solliciter à nouveau |
| **Verify** | `verify` | Une traduction a altéré un espace réservé, un pluriel ICU, le balisage (balise ouverte, fermée ou imbriquée différemment) ou le script — ou une clé est manquante — ou un même texte remplace plusieurs chaînes sources distinctes (un modèle répétant une phrase mémorisée) — ou aucun élément à vérifier n'a été trouvé (le fichier source ou le dossier de paramètres régionaux n'est pas à l'emplacement indiqué par la configuration) |
| **Verify, strict** | `verify --strict` | L'un des cas ci-dessus se présente, ou en présence d'un avertissement |

`verify` quitte avec `1` en cas d'erreur et avec `0` dans le cas contraire. Les avertissements sont affichés mais ne font
pas échouer le job : écho de la source, deux langues avec un texte identique,
traduction obsolète, traduction ayant omis le `?` ou `!` final de la source
(certaines langues marquant l'interrogation par une particule plutôt que par un signe),
ainsi que les avertissements relatifs aux pluriels détaillés ci-dessous. Un même texte appliqué à plusieurs chaînes
sources différentes constitue une erreur : deux chaînes de plusieurs mots manifestement distinctes recevant
le même texte traduit de quatre mots ou plus, ou de trois mots ou plus dans les autres cas. Ce décompte s'applique
aux valeurs des clés, à chaque branche de pluriel et aux pages Markdown de la langue, selon la
règle par laquelle la barrière de validation de `sync` la refuse. `verify --strict` transforme chaque avertissement
en échec. Utilisez-le si, par exemple, des formes plurielles russes omises par le modèle doivent
bloquer un déploiement. Les traductions obsolètes constituent un simple avertissement dans `verify` (la
structure étant intacte) et un échec dans `audit` (la barrière d'exhaustivité), qui
affiche la commande permettant de les retraduire.

Les constats relatifs aux formes plurielles dépendent de la façon dont le format les structure :

| Format | Erreur (`verify` quitte avec le code 1) | Avertissement (échoue uniquement avec `--strict`) |
|--------|------------------------------------------------|--------------------------------------------------------|
| Clés à suffixe i18next (`count_one`, `count_other`, …) | Une forme requise par la langue est absente (`count_many` en français) : il s'agit d'une clé manquante. | Clé correspondant à une forme inexistante dans la langue (`count_two` en français ou en espagnol). `verify` affiche la commande supprimant précisément ces clés, `sync --prune plural-extras` ; sync ne les supprime jamais sans cette option. |
| Messages ICU (`{count, plural, …}` dans next-intl, ARB, i18next ICU) | La structure du pluriel est endommagée (variable, mot-clé ou sélecteur traduit, `#` manquant). | Une branche utilisée par la langue pour le comptage courant est absente (`few`, `many` en russe). L'absence d'une forme employée uniquement pour les grands nombres (`many` en français, pour 1 000 000) n'est pas signalée. |
| gettext (`msgid_plural`) | Entrée sans traduction (vide ou `fuzzy`) : il s'agit d'une clé manquante. | Formes `msgstr[]` qui répètent la forme `other` alors que la langue dispose d'une forme propre pour le comptage courant (signalées par un commentaire `# champollion:`). Nombre de lignes `msgstr[]` supérieur au `nplurals` du catalogue. Les formes plurielles sont dénombrées d'après l'en-tête `Plural-Forms` propre au catalogue. |

Une forme i18next traduite à partir du texte d'une autre forme peut contenir exactement le
texte de cette forme (en français, `count_many` identique à `count_other`). Le français pouvant orthographier les
deux à l'identique, cela ne génère jamais d'avertissement. Lorsque sync sollicite une forme auprès du modèle, il
l'enregistre dans `.champollion.lock`, avec une empreinte de la réponse. `verify`
ne lit que cet enregistrement ; ainsi, chaque clone d'un commit obtient le même résultat. Le
cache de votre ordinateur portable et un exécuteur CI vierge ne peuvent pas diverger. Une valeur sans enregistrement
(rédigée à la main, par un autre outil, par un moteur de traduction automatique auquel la forme ne peut
pas être spécifiée, ou par une version antérieure) reçoit une ligne d'information avec la commande
permettant de la redemander. `--strict` n'échoue pas dans ce cas.
Verify contrôle la structure, non le sens : une validation indique que les clés, espaces réservés,
pluriels, balises et scripts sont intacts, non que le texte exprime la notion
exacte.

---

## Voir aussi

- [Référence du CLI](/docs/reference/cli) — référence complète des commandes
- [Fonctionnement de sync](/docs/concepts/how-sync-works) — comprendre la synchronisation incrémentale
- [Mémoire de traduction](/docs/concepts/translation-memory) — mise en cache et réductions de coûts
- [Méthodes de traduction](/docs/guides/translation-methods) — sélection de la méthode par paire
- [Barrière de qualité](/docs/concepts/quality-gate) — que se passe-t-il lorsque les traductions échouent
- [Configuration](/docs/getting-started/configuration) — référence de la configuration
