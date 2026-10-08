---
sidebar_position: 3
title: "CI/CD"
---

# Intégration CI/CD

Automatisez les traductions dans votre pipeline de compilation.

Le CLI champollion est disponible sous la [PolyForm Noncommercial License 1.0.0](https://github.com/gamedaysuits/Champollion/blob/main/cli/LICENSE) : libre d'utilisation, de modification et de partage à des fins non commerciales. Son utilisation à des fins commerciales n'est pas couverte par cette licence ([qui peut l'utiliser](/docs/getting-started/who-may-use-this)).

## GitHub Actions : garder les traductions synchronisées

Un workflow complet : traduire ce qui a changé, vérifier le résultat et le
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

**Pourquoi le workflow est conçu ainsi.** `actions/cache` à lui seul ne sauvegarde le
cache que si l'ensemble du job réussit, et `sync` quitte avec le code `2` dès qu'une clé
est refusée — ainsi, une exécution partielle omettait à la fois le commit et la sauvegarde du cache,
et l'exécution suivante payait à nouveau pour les mêmes traductions. Ici, le cache est
restauré et sauvegardé en deux étapes (`actions/cache/restore`, puis
`actions/cache/save` avec `if: always()`), l'étape de synchronisation enregistre son code de sortie
au lieu d'échouer sur `2`, les fichiers traduits sont commités, et seulement ensuite
le job échoue — dans sa propre étape, avant `verify`, afin que l'étape défaillante en indique
la raison (un arrêt dû à `--max-cost`, ou des clés que la synchronisation n'a pas pu traduire) au lieu que
`verify` ne mentionne une clé manquante. La dernière étape est `verify --strict` : un simple
`verify` renvoie 0 en cas d'avertissements (notamment une forme plurielle superflue ou manquante), et
`--strict` fait échouer le job s'il y en a. Une clé refusée par le contrôle qualité est mémorisée : l'exécution
suivante ne la renvoie pas au même modèle (ce qui facturerait la même réponse) —
le journal de synchronisation la nomme ainsi que la commande `--redo keys:` pour la redemander.

**Une copie de cache par modification, pas par exécution.** L'étape de restauration récupère le
cache le plus récent de la branche (sa clé exacte, `…-newest`, n'étant jamais sauvegardée,
`restore-keys` sélectionne la plus récente). L'étape de sauvegarde associe le cache au
hash de ses propres fichiers (`hashFiles('.champollion/**')`) : une exécution ayant traduit
quelque chose — même partielle, ou dont le push a échoué — a modifié le cache,
elle obtient donc une nouvelle clé et est sauvegardée ; une exécution n'ayant rien ajouté (rien à
traduire, tout provient du cache, arrêt dû à `--max-cost`) conserve la clé qu'elle a
restaurée, la sauvegarde est donc ignorée et aucune nouvelle copie n'est stockée. Utiliser l'identifiant
d'exécution comme clé sauvegardait une copie complète à chaque passage ; utiliser les fichiers lock et source
comme clé restaurerait une copie plus ancienne par correspondance exacte après une exécution dont le push a été rejeté,
car le fichier lock commité n'a jamais reçu les modifications de cette exécution.

Dans un projet Node, vous pouvez ajouter `champollion` en tant que dépendance de développement et appeler
`npx champollion sync` à la place ; la version épinglée `champollion@0.5` ci-dessus fonctionne dans n'importe quel
dépôt et ne sélectionne jamais une version différente par surprise. Le job doit
alors l'installer : sur un runner vierge, `npx champollion` sans rien d'installé
récupère la dernière version, et non celle fixée par votre fichier lock. De plus, l'installation
génère `node_modules/`, que `git add --all` commite à moins que votre `.gitignore`
ne le liste (celui créé par `champollion init` ne liste que `.champollion/`) ; indexez donc
les fichiers de locale et le lock nommément, comme le fait le workflow Django ci-dessous :

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
enregistrent le texte source à partir duquel chaque traduction a été générée. C'est grâce à eux que
l'exécution suivante sait qu'une chaîne a changé. Un runner qui ne les voit jamais ne peut pas distinguer une
chaîne modifiée d'une chaîne intacte. **Ne commitez pas `.champollion/`** — il s'agit du
cache propre à chaque machine ; `champollion init` l'ajoute à `.gitignore`.

**`--max-cost`** interrompt une exécution avant qu'elle ne dépense plus que prévu ; réglez-le sur
le coût des modifications d'une journée normale. Lorsqu'il arrête une exécution, rien n'a été
traduit ni écrit et sync quitte avec le code `2` : il n'y a rien à commiter,
et l'étape « Stop when the sync was partial » fait échouer le job en le signalant. Une méthode sans tarif public (un
point de terminaison auto-hébergé sur une autre machine) ne peut pas être estimée, donc `--max-cost` s'arrête
dès qu'il y a quelque chose à traduire — désactivez-le dans ce cas. Un modèle
hébergé sur le runner lui-même (`local` sur `localhost`/`127.0.0.1`) est facturé
à 0 $ de coût d'API.

**Seuls les pushs qui modifient une chaîne source déclenchent le job.** Le filtre `paths:`
liste vos fichiers de locale source et `champollion.config.json` : un push
qui ne modifie que du code, ou uniquement les traductions et les fichiers lock, n'a rien
à traduire et ne déclenche donc aucun job. Modifiez les deux chemins de locale selon les fichiers mentionnés dans votre
configuration (`messages/en.json`, `lib/l10n/app_en.arb`, …) ; ajoutez votre
dossier `contentDir` lorsque sync traduit également le Markdown. **Run workflow** (le
déclencheur `workflow_dispatch`) permet toujours de le lancer manuellement.

**Le commit propre au job ne le redéclenche jamais** — et le filtre `paths:` n'y
est pour rien. L'étape de commit effectue le push avec le `GITHUB_TOKEN` du workflow,
et un push réalisé avec `GITHUB_TOKEN` ne déclenche jamais d'exécution de workflow (règle
de GitHub pour éviter qu'un workflow ne s'appelle lui-même). C'est pourquoi le workflow Django
ci-dessous peut surveiller `locale/**`, que chacun des commits du bot modifie.
Si vous effectuez le push avec un jeton d'accès personnel ou un jeton GitHub App (pour déclencher
d'autres workflows sur le commit du bot, par exemple), ce push relancera ce
workflow ; dans ce cas, c'est le filtre `paths:` qui intervient. Le filtre ci-dessus
exclut les fichiers traduits et les fichiers lock, de sorte que le commit du bot
ne lance aucune exécution. Le filtre Django `locale/**` englobe les catalogues commités
par le bot, donc chacun de ses commits déclenche une exécution supplémentaire — qui ne trouve rien
à traduire et ne commite rien. Avec un tel jeton, limitez-le au catalogue
source (`locale/en/**`) et ajoutez les langues via la configuration.

**La clé du fournisseur est requise à chaque exécution qui démarre**, même lorsque rien
n'est à traduire : sync vérifie que la méthode peut fonctionner avant d'examiner ce qui
a changé. Une exécution lancée manuellement sans modification source échoue tout de même sans le
secret `OPENROUTER_API_KEY` (ou la clé de votre méthode). `local` ne nécessite aucune clé, mais
un runner ne dispose d'aucun serveur de modèle : un projet traduisant avec `local` sur la
machine d'un développeur spécifie une méthode hébergée en CI (`--method` / `--model` — la
ligne commentée `SYNC_FLAGS` dans le workflow ci-dessus). Pour vérifier que le secret
parvient bien à l'étape, sans rien traduire, `sync --dry` signale si
l'exécution réelle s'arrêterait et nomme la variable manquante (le code de sortie reste 0 — un dry
run est un aperçu). Il vérifie que la variable est **définie**, pas que la clé
**fonctionne** : il n'envoie rien, de sorte que toute valeur non vide convient — y compris une valeur fictive.
Une clé erronée ou révoquée se révèle dès la première requête d'une exécution réelle (l'erreur
indique la réponse du fournisseur, par exemple HTTP 401). Pour faire échouer le job en cas de clé manquante
avant toute exécution, ajoutez [la vérification préalable à la synchronisation](#check-before-sync).

**Le cache est conservé par méthode.** Une traduction est mise en cache sous la méthode,
le registre et le fichier de coaching qui l'ont produite (un modèle différent de la même
méthode la réutilise — report de modèle). Un développeur traduisant avec `local`
et la CI traduisant avec un modèle hébergé ne partagent donc jamais d'entrées de cache —
et le cache de la CI lui est propre dans tous les cas (`.champollion/` n'étant pas commité). Cela
ne signifie pas que la CI retraduit l'ensemble du projet : ce qui se trouve déjà dans les fichiers de locale,
avec leur fichier lock commité, est considéré comme fait. La CI ne paie le modèle hébergé que pour
les chaînes nouvelles ou modifiées depuis le dernier commit — y compris celles qu'un
développeur aurait traduites localement sans les commiter — et rien pour le reste.
Retraduire l'intégralité du projet avec le modèle hébergé (`--redo all`) facture
chaque chaîne une seule fois.

**Sur planification** au lieu d'un déclenchement sur push : remplacez le bloc `on:` par
`schedule: [{ cron: '0 6 * * *' }]`.

### Vérifier avant la synchronisation : faire échouer le job au plus tôt {#check-before-sync}

Un dry run renvoie `0` quoi qu'il trouve — c'est un aperçu — ainsi `sync --dry
--max-cost 5` avertit que l'exécution réelle s'arrêterait à la limite fixée, tout en réussissant
en tant qu'étape de CI. Pour faire échouer un job lorsque l'exécution réelle s'arrêterait (clé manquante ou
`--max-cost`), lisez le résumé de `sync --dry --json`. Cette sortie se présente sous la forme
d'un objet JSON par ligne (NDJSON), chacun comportant un `level` — les lignes `info`, `ok` et
`event` sur stdout, les lignes `warn` et `error` sur stderr — et la dernière
ligne de stdout est le résumé, `{"level": "summary", "command": "sync", …}`.
Sélectionnez-la par son niveau. **Exécutez-la avec les mêmes options que la synchronisation** : sans
elles, elle vérifie la méthode indiquée dans la configuration ; ainsi, pour un projet dont la configuration
indique `local`, elle vérifierait la méthode locale — et non le modèle hébergé exécuté par le job —
et réussirait sur un runner dépourvu de clé. Intégrée en tant qu'étape dans le workflow ci-dessus,
avant « Sync translations », elle lit le même `SYNC_FLAGS` :

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

Ou dans un shell, en écrivant explicitement les options — les mêmes que pour la ligne sync :

```bash
SYNC_FLAGS="--method llm --model google/gemini-3.8-flash --max-cost 5"
out=$(npx --yes champollion@0.5 sync --dry $SYNC_FLAGS --json)
printf '%s\n' "$out" | jq -e 'select(.level == "summary") | .preflight.ready and (.maxCost.wouldStop | not)' > /dev/null \
  || printf '%s\n' "$out" | jq -r 'select(.level == "summary") | .error // "A real sync would exit \(.realRun.exitCode): \(.realRun.reasons | join("; "))"'
```

`preflight.ready` vaut `false` lorsqu'une clé requise par la méthode est manquante (non définie ou
vide — pas lorsqu'elle est invalide), qu'il y ait ou non des éléments à traduire : une
méthode hébergée n'est jamais prête sans sa clé. `maxCost.wouldStop` (présent avec
`--max-cost`) vaut `true` lorsque l'exécution réelle s'arrêterait au plafond de coût. `jq -e` renvoie
1 dans l'un ou l'autre cas, et l'étape affiche alors la raison dans le journal du job — par exemple
`A real sync would exit 1: it would stop before translating: No OpenRouter API
key (OPENROUTER_API_KEY) for en:fr`, or `A real sync would exit 2: --max-cost
would stop it before any API call (Estimated translation cost exceeds the
--max-cost cap: estimate ~$7.1200, cap $5.0000)`. Lorsque sync ne peut pas s'exécuter
du tout (configuration corrompue), l'étape affiche le `error` du résumé à la place. L'étape
ne redirige pas stderr vers `/dev/null`, les avertissements restent donc également visibles dans le journal. Le
champ `realRun.exitCode` du résumé indique le code de sortie qu'aurait l'exécution réelle,
dans la mesure de ce qu'un aperçu peut déterminer : `1` si la vérification préalable l'interrompait, `2`
si `--max-cost` le faisait, ou si elle se terminait de manière partielle — clés retenues ou
messages pluriels sur le disque sans une forme requise par la langue (`realRun.reasons`
précise laquelle). Un refus par le contrôle qualité, que seule l'exécution réelle détecte, peut
toujours transformer un `0` en `2`. Pour faire également échouer la vérification sur une prévision d'exécution partielle,
remplacez `.preflight.ready and (.maxCost.wouldStop | not)` par `.realRun.exitCode == 0`.

### Branche main protégée : proposer une pull request

Le workflow ci-dessus pousse les traductions directement sur `main`. Si `main` est
protégée (revues ou vérifications d'état obligatoires), ce push est rejeté — après
l'exécution de la synchronisation, de sorte que les traductions ont déjà été payées. Elles ne sont pas payées
à nouveau : le cache est sauvegardé avant l'étape de commit, même en cas d'échec d'une étape,
si bien que relancer le job ou le push suivant (chacun restaurant le cache le plus récent de la branche
grâce à `restore-keys`) les sert depuis le cache. Les
fichiers lock n'ayant jamais atteint `main`, l'exécution suivante trouve les mêmes chaînes
modifiées et les réécrit — depuis le cache, sans aucun surcoût.

Sur une branche `main` protégée, commitez sur une branche appartenant au bot et ouvrez (ou mettez à jour)
une pull request à la place. Conservez le workflow ci-dessus et modifiez deux éléments : les
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

**Quand utiliser l'une ou l'autre approche.** Poussez sur `main` lorsque le workflow y est autorisé : aucune
protection de branche, ou règle permettant à GitHub Actions de la contourner. Ouvrez une pull
request lorsque `main` est protégée, ou lorsqu'une personne — un locuteur de la langue —
doit relire les traductions avant leur déploiement.

- La branche appartient au bot. Tant que la pull request n'est pas fusionnée, les fichiers
  lock de `main` ne contiennent pas ses traductions ; chaque exécution propose donc à nouveau l'ensemble
  du lot — depuis le cache, de sorte que seules les chaînes modifiées depuis lors sont facturées. Les modifications
  poussées sur cette branche sont écrasées par l'exécution suivante : effectuez la revue dans la pull
  request, fusionnez, puis modifiez sur `main` (une réexécution globale ultérieure préserve la
  modification humaine).
- Le dépôt doit autoriser Actions à ouvrir des pull requests : Paramètres → Actions →
  Général → « Allow GitHub Actions to create and approve pull requests ».
- Une pull request ouverte avec le `GITHUB_TOKEN` du workflow ne lance aucun autre
  workflow ; les vérifications d'état requises ne s'y exécutent donc jamais. Si `main` les
  exige, ouvrez-la avec un jeton GitHub App ou un jeton à granularité fine conservé comme
  secret (`GH_TOKEN: ${{ secrets.<name> }}`), ou utilisez une action telle que
  `peter-evans/create-pull-request`, qui commite, met à jour la branche et
  édite la pull request ouverte pour vous (transmettez-lui le jeton de la même manière).

### gettext (Django, Babel) et Flutter

Sync traduit les catalogues existants ; il n'extrait pas les chaînes depuis
votre code. Un projet Django actualise les catalogues avant l'étape de synchronisation,
vérifie qu'ils compilent après celle-ci et ne commite que les catalogues.

`makemessages` et `compilemessages` importent tous deux vos paramètres ; le job
définit donc leurs prérequis en une seule fois pour chaque étape : toute variable lue par votre module de configuration
à l'import (`SECRET_KEY`, `DATABASE_URL`, …). Aucune de ces commandes ne touche à la
base de données, une valeur fictive est donc suffisante. `DJANGO_SETTINGS_MODULE`
est laissé en commentaire : le fichier `manage.py` généré par `startproject` le définit
lui-même, et une valeur définie dans le job écraserait celle-ci — un mauvais nom de module
compromettrait `makemessages`. Ne le définissez que si votre `manage.py` ne le fait pas.

Son filtre `paths:` diffère du workflow ci-dessus : les chaînes sources résident dans
votre code Python et vos gabarits, et `makemessages` les extrait au sein du job ;
une modification de code peut donc introduire une nouvelle chaîne. Restreignez les motifs à vos applications
(`myapp/**.py`) si chaque push modifie du code Python. Il surveille également `locale/**` :
une nouvelle langue se matérialise par un nouveau dossier de catalogue (`makemessages -l <code>`). Le
propre commit du bot modifie ces catalogues mais ne déclenche aucune exécution, car il est
poussé avec `GITHUB_TOKEN` (voir **Le commit propre au job ne le redéclenche jamais**
ci-dessus — et ce qu'il convient de restreindre en cas de push avec un autre jeton).

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

`--all` met à jour chaque catalogue existant ; ajoutez une langue une seule fois avec
`makemessages -l <code>` (ou `champollion init --langs <code>`).
`makemessages` s'exécute une fois par domaine : `django` pour Python et les gabarits,
`djangojs` (`-d djangojs`) pour JavaScript. Sync traduit le catalogue de chaque
domaine rencontré. La dernière étape exécute `verify --strict`. Une entrée de pluriel en russe
dont la traduction omet la forme `few` ou `many` est écrite avec la forme `other`
et marquée `# champollion:`. Chaque exécution de sync renvoie `2` tant qu'une telle entrée est
présente dans un catalogue — celle qui l'écrit et toutes les suivantes, de même que pour une clé retenue —
et son résumé nomme l'entrée ainsi que la commande pour la redemander ; la
ligne de vérification post-synchronisation indique alors que l'exécution est incomplète au lieu de `[OK]`.
L'étape « Stop when the sync was partial » fait donc échouer le job après le commit
jusqu'à ce que les formes soient rédigées. Utilisée seule, il s'agit d'un avertissement : un simple `verify`
renvoie 0, tandis que `--strict` échoue. `audit` comptabilise ces mêmes entrées comme
incomplètes.

`compilemessages` exécute `msgfmt --check-format`, qui vérifie également que chaque
`%(name)s` conserve son type — mais uniquement sur les entrées marquées `#, python-format`.
`makemessages` ajoute cet indicateur aux entrées extraites avec une variable substituée `%` ;
un catalogue conçu manuellement peut en être dépourvu, et ses entrées ne sont alors pas
vérifiées. `champollion
verify` compare les variables printf de chaque entrée (nom et lettre de type)
quels que soient ses indicateurs, et sync préserve les indicateurs de l'entrée source sur chaque entrée
traduite. L'étape de commit indexe `*.po` et
`.champollion.lock` par leur nom (ainsi que le registre des modifications remplacées s'il
existe) ; si votre projet suit ses fichiers `.mo`, ajoutez-y `'*.mo'`. Les
étapes de cache, l'enregistrement du code de sortie et `git pull --rebase` sont présents pour
les mêmes raisons que dans le workflow ci-dessus. Pour Babel : `pybabel extract` + `pybabel update --no-wrap` avant
la synchronisation, `pybabel compile` après.

Flutter ne nécessite aucune étape supplémentaire dans ce job : sync écrit les fichiers
`app_<locale>.arb`, et `flutter gen-l10n` (ou `flutter build`, qui l'exécute) correspond à l'étape
de build propre à votre application, où ils sont compilés en Dart.

#### Formes plurielles omises par un modèle {#plural-gaps}

Une entrée marquée n'est pas une traduction ; sync ne laisse donc pas une personne
s'en charger seule :

- **Une autre méthode ou un autre modèle la redemande automatiquement.** Une synchronisation dont la configuration
  (méthode, modèle, registre, coaching) n'a pas encore répondu à cette entrée la soumet
  de nouveau au modèle — et non au cache, qui conserve la réponse
  incomplète. Ainsi, lorsque le modèle local d'un développeur a omis des formes, le modèle
  hébergé du job (`SYNC_FLAGS`) les réclame lors de sa prochaine exécution, et l'estimation
  en calcule le coût. Le fichier lock (`.champollion.lock`, sous `gaps`) consigne chaque configuration
  ayant renvoyé une réponse sans les formes requises, évitant ainsi qu'une exécution locale et une exécution CI
  ne paient tour à tour pour la même réponse incomplète.
- **`sync --redo gaps` redemande chacune de ces entrées**, quel que soit le modèle l'ayant générée — dans les
  workflows ci-dessus, cochez `redo_gaps` sous **Run workflow**. Ajoutez `--model` à
  `SYNC_FLAGS` pour recourir à un modèle plus performant.
- **Si la nouvelle réponse omet également les formes, l'entrée reste marquée** et
  l'exécution quitte avec le code `2`, comme précédemment. Rédigez alors les formes manuellement et supprimez la
  ligne `# champollion:`.

Un dry run (`sync --dry`) liste les entrées qu'il redemanderait et évalue leur
coût ; son résumé `--json` dénombre celles qu'il n'inclurait pas (`totalPluralGaps`)
et indique que l'exécution réelle quitterait avec le code `2` à cause d'elles (`realRun.exitCode`).

## Autres méthodes

Les extraits ci-dessous indiquent la clé requise par chaque méthode ainsi que sa commande `sync`.
Utilisez-les **au sein** de l'étape « Sync translations » du workflow ci-dessus : remplacez
son `env`, insérez les options indiquées (`--method openai`, …) dans la ligne
`SYNC_FLAGS` du workflow — afin que la vérification en dry run utilise la même méthode — et conservez
le reste de l'étape (`id: sync` et les lignes consignant le code de sortie), afin qu'une
exécution partielle commite tout de même ce qu'elle a traduit et sauvegarde le cache.

## Méthode Google Translate

Si vous utilisez la méthode Google Translate intégrée au lieu d'OpenRouter :

```yaml
- name: Sync translations
  env:
    GOOGLE_TRANSLATE_API_KEY: ${{ secrets.GOOGLE_TRANSLATE_API_KEY }}
  run: npx --yes champollion@0.5 sync
```

## Fournisseurs LLM directs

Si vous utilisez les méthodes `openai`, `anthropic` ou `gemini` directement :

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

## API de traduction distante

Si vous utilisez un point de terminaison de traduction distant (par exemple, un service de traduction hébergé) :

```yaml
- name: Sync translations
  env:
    CHAMPOLLION_API_KEY: ${{ secrets.CHAMPOLLION_API_KEY }}
  run: npx --yes champollion@0.5 sync
```

## Un contrôle qualité avant le déploiement

Pour faire échouer un build si une locale est incomplète ou altérée, sans rien
traduire, lancez les vérifications séparément.

:::warning[Exécutez le contrôle après la synchronisation, pas avant]
Si la traduction ne s'exécute qu'après la fusion (le workflow ci-dessus), une pull request qui
ajoute une chaîne ne dispose pas encore de sa traduction, et `audit`/`verify` feront échouer
chacune de ces PR. Exécutez le contrôle là où les traductions existent déjà : sur `main` après
le job de synchronisation (`needs: sync`, ou `on: workflow_run` du workflow de synchronisation). Un
déclencheur `push` ne s'active pas sur les propres commits du bot de synchronisation — ils sont poussés
avec `GITHUB_TOKEN`, qui ne lance aucun workflow (voir plus haut). Sur les pull requests,
exécutez uniquement `lint`, ou lancez d'abord le job de synchronisation sur la branche de la PR.
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

| Contrôle | Commande | Échoue lorsque |
|-------|---------|------------|
| **Lint** | `lint` | Le code source contient des chaînes absentes d'un fichier de locale — ou aucun fichier source à vérifier n'a été trouvé (les dossiers analysés sont indiqués ; ciblez un autre emplacement avec `--src <dir>`) |
| **Audit** | `audit` | Une clé est manquante, vide ou correspond encore à une valeur de repli `[EN]` — ou une traduction est **obsolète** : générée à partir d'un texte source antérieur au texte actuel (modification source dont la retraduction a échoué) — ou un message pluriel est dépourvu d'une forme utilisée par la langue pour le décompte usuel (`few`/`many` en russe ; les entrées sur lesquelles `verify --strict` échoue), avec la commande pour la redemander |
| **Verify** | `verify` | Une traduction a altéré une variable substituée, un pluriel ICU, le balisage (balise ouverte, fermée ou imbriquée différemment) ou l'écriture (script) — ou une clé est manquante — ou un même texte se substitue à plusieurs chaînes sources distinctes (modèle répétant une phrase mémorisée) — ou aucun contenu à vérifier n'a été trouvé (le fichier source ou le dossier des locales n'est pas à l'emplacement indiqué dans la configuration) |
| **Verify, strict** | `verify --strict` | L'un des cas ci-dessus, ou n'importe quel avertissement |

`verify` renvoie `1` en cas d'erreur et `0` sinon. Les avertissements sont affichés mais ne
font pas échouer le job : répétition de la source, deux locales au texte identique,
traduction obsolète, traduction ayant omis le `?` ou `!` final de la source
(certaines langues marquant l'interrogation par une particule à la place),
ainsi que les avertissements de pluriel détaillés ci-dessous. Un texte unique produit pour plusieurs chaînes
sources différentes constitue une erreur : deux chaînes multi-mots manifestement distinctes traduites par
le même texte d'au moins quatre mots, ou d'au moins trois mots dans les autres cas. Ce critère est évalué
sur les valeurs des clés, chaque branche de pluriel et les pages Markdown de la locale, selon la
règle de refus du contrôle de `sync`. `verify --strict` transforme chaque avertissement en
erreur bloquante. Utilisez-le si, par exemple, des formes plurielles russes omises par le modèle doivent
bloquer un déploiement. Les traductions obsolètes constituent un avertissement dans `verify` (la
structure étant intacte) et une erreur bloquante dans `audit` (le contrôle d'exhaustivité), qui
affiche la commande permettant de les retraduire.

Les constatations relatives aux pluriels dépendent de la façon dont le format gère les formes plurielles :

| Format | Erreur (`verify` renvoie 1) | Avertissement (échoue uniquement avec `--strict`) |
|--------|--------------------------|--------------------------------------|
| Clés i18next avec suffixe (`count_one`, `count_other`, …) | Une forme requise par la locale est manquante (`count_many` en français) : il s'agit d'une clé manquante. | Clé correspondant à une forme absente de la locale (`count_two` en français ou en espagnol). `verify` indique la commande supprimant précisément ces clés, `sync --prune plural-extras` ; sync ne les supprime jamais sans cette instruction. |
| Messages ICU (`{count, plural, …}` dans next-intl, ARB, i18next ICU) | La structure du pluriel est altérée (variable, mot-clé ou sélecteur traduit, `#` manquant). | Une branche utilisée par la locale pour le décompte usuel est manquante (`few`, `many` en russe). L'absence d'une forme réservée aux grands nombres (`many` en français, pour 1 000 000) n'est pas signalée. |
| gettext (`msgid_plural`) | Entrée non traduite (vide ou `fuzzy`) : il s'agit d'une clé manquante. | Formes `msgstr[]` qui répètent la forme `other` alors que la langue possède sa propre forme pour le décompte usuel (signalé par un commentaire `# champollion:`). Nombre de lignes `msgstr[]` supérieur au `nplurals` du catalogue. Les formes plurielles sont dénombrées d'après l'en-tête `Plural-Forms` propre au catalogue. |

Une forme i18next traduite à partir du texte d'une autre forme peut comporter exactement le
texte de cette dernière (`count_many` identique à `count_other` en français). Le français pouvant
rédiger les deux formes de manière identique, cela ne constitue jamais un avertissement. Lorsque sync demande une forme au modèle, il
l'enregistre dans `.champollion.lock`, accompagné d'une empreinte numérique de la réponse. `verify`
consulte uniquement cet enregistrement, de sorte que chaque clone d'un commit obtient le même résultat. Le
cache de votre machine locale et un runner de CI vierge ne peuvent pas diverger. Une valeur sans enregistrement
(rédigée manuellement, par un autre outil, par un moteur de traduction automatique incapable
de distinguer la forme demandée, ou par une version antérieure) génère une ligne d'information indiquant la commande
pour la redemander. `--strict` n'échoue pas dans ce cas.
Verify valide la structure et non le sens : une validation confirme que les clés, les variables substituées,
les pluriels, le balisage et les scripts sont intacts, et non que le texte traduit exprime l'idée exacte voulue.

---

## Voir aussi

- [Référence CLI](/docs/reference/cli) — référence complète des commandes
- [Fonctionnement de la synchronisation](/docs/concepts/how-sync-works) — comprendre la synchronisation incrémentale
- [Mémoire de traduction](/docs/concepts/translation-memory) — mise en cache et économies de coûts
- [Méthodes de traduction](/docs/guides/translation-methods) — sélection de méthode par paire
- [Portail de qualité](/docs/concepts/quality-gate) — ce qui se passe en cas d'échec des traductions
- [Configuration](/docs/getting-started/configuration) — référence de configuration
