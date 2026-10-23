---
title: "Piloter les rails depuis le shell"
slug: /agents/shell
description: "Chaque étape des rails sous la forme d'une commande ordinaire : installer, démarrer un projet, importer des données, enregistrer ses termes, entraîner et tester un modèle avec nmt-forge, exécuter les cycles d'amélioration, traduire et servir avec mt-eval — ainsi que le mode hors ligne, les variables d'environnement lues par les outils et les codes de sortie."
---

# Piloter les rails depuis le shell

Chaque étape sur les rails est une commande ordinaire. Un agent sans MCP — ou une
personne devant un terminal — parcourt les mêmes rails à l'aide de trois programmes :
`champollion`, `nmt-forge` et `mt-eval`. Il n'est jamais nécessaire de mémoriser
l'ordre : `champollion next` indique l'étape suivante, avec son mode et la
commande exacte, lue depuis les fichiers du projet.

Les règles sont les mêmes que via MCP. Une étape `confirm` ne s'exécute qu'après
l'accord explicite de la personne ; les réponses d'une étape `ask_user` lui appartiennent
([le contrat](/docs/agents/contract)).

## Installation

```bash
npm install -g champollion                  # Node.js 20.11 or newer
uv tool install --python 3.12 nmt-forge     # brings mt-eval (mt-eval-harness) with it
```

**Remarque.** Tous deux téléchargent des paquets : mode `confirm` — demander d'abord. Si `uv
--version` échoue, la personne installe uv depuis https://docs.astral.sh/uv/ ;
un agent ne télécharge pas d'installateurs. L'entraînement requiert également l'extra d'entraînement
de forge (PyTorch et transformers de Hugging Face, plusieurs centaines de Mo). Forge l'indique
lorsqu'il est manquant (état `needs-training-extra`) :

```bash
uv tool install --reinstall --python 3.12 'nmt-forge[hf]'
```

Les rails requièrent `nmt-forge` 0.3.0 ou plus récent ; une version plus ancienne est signalée avec sa
commande de mise à niveau (`uv tool install --upgrade --python 3.12 nmt-forge`).

## La boucle

```bash
champollion next              # the next step: what to say, why, the command, how to take it
champollion next --json       # the same, for a program (see the rails model page for the shape)
champollion next --write      # also rewrite NEXT.md, the person's copy
```

`How:` dans la sortie destinée aux humains correspond au mode : `run it` (`auto`), `demander d'abord, puis
l'exécuter` (`confirm`), `demander à la personne détentrice des données — ne jamais répondre à sa
place` (`ask_user`), `attendre, puis redemander` (`wait`), `une personne s'en charge`
(`human_only`). Exécutez la commande indiquée, puis demandez à nouveau. Il est tout à fait possible de quitter les
rails — exécutez n'importe quelle commande experte, puis `champollion next` : l'étape suivante
est lue à partir des fichiers.

## Démarrer

```bash
champollion new family --from English --to qaa --target-name "Our language" --dry
champollion new family --from English --to qaa --target-name "Our language" --purpose "notes for the grandchildren"
cd family
```

Les langues sont des codes ou des noms, résolus par le biais des fiches de langue. Une variété
dépourvue de code prend un code à usage privé (`qaa`–`qtz`) et le nom que sa
communauté lui donne (`--target-name`, `--source-name`). **Remarque.** Répétez la direction
avant la création du projet : `--dry` résout les deux langues et n'écrit
rien. Transmettez chaque langue exactement telle que la personne l'a nommée.

## Rassembler et enregistrer les conditions

```bash
champollion data add ../family-files/grandpa.xlsx                     # pairs → data/parallel/
champollion data add ../family-files/grandpa.xlsx --source-col A --target-col B --header
champollion data add ../family-files/words.lift --into lexicon        # a word list → data/lexicon/
champollion data add ../family-files/recording.eaf --source-col <number> --target-col <number>   # ELAN: tier numbers
```

`data add` lit les fichiers `.xlsx`, `.ods`, `.csv`, `.tsv`, `.txt`, les tableaux
Word `.docx`, les dictionnaires Toolbox et LIFT, les fichiers ELAN `.eaf` et USFM
(`--usfm-source`). Il écrit `<stem>.tsv` et son sidecar, laisse l'original
intact et affiche les décomptes, les colonnes et les numéros de ligne que sa vérification des
lignes signale (doublons, répétitions, longueurs anormales, lignes interverties ou décalées — rien
n'est supprimé) — jamais de phrases. Lorsqu'il ne parvient pas à déterminer quelle colonne (ou tier
ELAN, par numéro, ou langue LIFT) correspond à quoi, il refuse et pose la question ; demandez à la
personne. `--replace` lit à nouveau le même original avec d'autres colonnes, en conservant
les réponses des détenteurs ; `--name <stem>` ajoute un autre fichier sous un autre nom.
Voir les [règles relatives aux données](/docs/agents/data-rules#what-tools-print-and-never-print).

Puis les conditions, un fichier à la fois, à partir des réponses de la personne :

```bash
champollion data mark data/parallel/grandpa.tsv --speakers "grandpa" --speakers-agreed yes \
  --owner "our family" --training allowed --local-only
```

`--local-only` ou `--may-leave` est requis pour un fichier qui n'est pas encore strictement local.
L'étape des conditions du parcours interroge sur chaque fichier dans `data/parallel/`,
`data/lexicon/`, `data/grammar/` et `data/monolingual/` jusqu'à ce que sa
réponse concernant l'entraînement et `--speakers-agreed` soient enregistrées. Chaque valeur appartient
aux détenteurs — voir les [règles relatives aux données](/docs/agents/data-rules) pour savoir ce que chacune fait et
ce que la commande refuse.

## Protéger le jeu de test

```bash
champollion data add ../family-files/checked.tsv --into test
champollion data mark data/test/checked.tsv --role test --training not-allowed --local-only
```

## Construire et tester un modèle

Le parcours les indique dans l'ordre (leurs `{placeholders}` renseignés à partir du
projet) :

```bash
nmt-forge init qaa --dir . --pair eng-qaa --no-card --name "Our language" --model auto
nmt-forge registry add project-test data/test/checked.tsv --role test
champollion data combine
nmt-forge leak-audit data/parallel/combined.tsv --clean-to data/clean/combined.clean.jsonl
nmt-forge prereg new first-model --eval-set project-test --expect "<their words>" --rationale "<their reason>"
nmt-forge split data/clean/combined.clean.jsonl --test 0 --dev 50 --seed 42 --near-dupe 0.6 --max-group 26 --out data/split --register project
nmt-forge floor data/lexicon/words.tsv
```

- `init --model auto` choisit le modèle le plus puissant que cet ordinateur peut entraîner en
  quelques heures, selon sa mémoire ([entraînement](/docs/agents/training#models)). Avec une
  fiche de langue, `--no-card --name` est laissé de côté.
- `data combine` ne s'exécute que lorsque `data/parallel/` contient plus d'un fichier. Il
  applique les conditions les plus strictes des fichiers qu'il réunit et refuse tout fichier dont
  les détenteurs n'ont pas encore répondu — quant à savoir si un modèle peut apprendre à partir de lui, et
  si toutes les personnes dont les propos y figurent ont donné leur accord.
- `prereg new` est une étape `ask_user` : `--expect` et `--rationale` sont les
  mots des personnes, exactement tels qu'elles les ont prononcés, rédigés avant même qu'un score n'existe.
  La question ne suggère aucun chiffre, et vous non plus.
- La taille du jeu de validation (dev) que le parcours renseigne (`dev_n`) correspond à un dixième des
  paires filtrées, au moins 50 et au plus 500 ; avec moins de 200 paires, elle en représente
  plutôt un quart, afin que l'entraînement conserve la majeure partie — et cela reste inférieur à 50.
  Ainsi : 40 phrases de validation pour 160 paires, 50 pour 200 à 500 paires, 160 pour
  1 600, 500 pour 5 000 ou plus. En dessous de 50, aucune session ne peut être évaluée sur le jeu
  de validation ([mesure](/docs/agents/measurement#comparing-two-models)).
  `--near-dupe 0.6` conserve les quasi-doublons d'un même côté ; `--max-group` correspond à la moitié de la
  taille du jeu de validation, arrondie à l'entier inférieur, plus un.
- `floor` ne s'applique que lorsque `data/lexicon/` contient une liste de mots.

À partir d'ici, le conseiller propre à forge indique chaque étape. `champollion next` la relaie ;
`nmt-forge status` la formule directement :

```bash
nmt-forge preflight run --config config.json && nmt-forge run config.json --detach
nmt-forge jobs                      # what is running
nmt-forge status                    # the next step, with what is ready and what blocks it
nmt-forge export <run-manifest.json> --prereg first-model --out export/
nmt-forge serve export/model --detach
nmt-forge tidy                      # earlier rounds' model weights nothing uses, and the space they take
```

L'entraînement est `confirm` (il consomme de la puissance de calcul, de quelques minutes à plusieurs heures) ; pendant qu'une
exécution détachée s'entraîne, l'étape est `wait`. `nmt-forge run` refuse une exécution que le disque ne peut
pas accueillir avant qu'elle ne commence (`[disk-room]`), en indiquant l'espace libre, son estimation et
ce que `nmt-forge tidy` libérerait ; `nmt-forge tidy --yes` le libère, et
`--skip-disk-check` sur `run` démarre quand même, consigné dans l'exécution. Ces deux décisions
relèvent du choix de la personne, non du vôtre ([entraînement](/docs/agents/training#disk-space)).
L'exportation évalue le modèle une fois sur le jeu de test, par rapport à la prédiction.
Choisir parmi plusieurs exportations relève de la personne
(`nmt-forge choose <model folder>`). Après un score sur le jeu de test, les personnes évaluent
leur prédiction :

```bash
nmt-forge prereg verdict first-model --prediction 1 --held --by "grandma"
```

(`--missed` si elle ne s'est pas vérifiée ; `--prediction` est le numéro de la prédiction,
1 pour un seul `--expect` ; `--by` indique qui l'a évaluée, exactement comme cela a été formulé.) Voir
[l'entraînement](/docs/agents/training) pour chaque commande et chaque refus de forge.

## Les cycles d'amélioration

Une fois qu'un modèle est servi, les cycles commencent :

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

- `improve sheet` : tant que l'ensemble de développement (pratique) compte moins de 200 phrases, certaines
  lignes ne comportent aucun brouillon — une sur deux tant qu'il en compte moins de 50, une sur quatre à partir de 50
  — et le locuteur les rédige. `improve marks` les écrit dans `data/dev/`
  et `improve prepare` les ajoute à l'ensemble de développement (`nmt-forge grow-dev`),
  jamais à l'entraînement. Il exécute également `nmt-forge draft-newer`. Lorsqu'il existe
  un autre modèle — le plus récemment entraîné lorsqu'il n'est pas utilisé (non mis en
  service après son cycle : effectif trop restreint pour trancher, absence d'évolution mesurable, ou pire), ou,
  après une promotion, le modèle que celui en service a remplacé — ce modèle rédige une
  moitié aléatoire des lignes avec brouillon, sans marquage, et la clé reste à côté de la
  feuille (`sheet-key.json`). `improve marks` comptabilise ensuite chaque modèle séparément —
  la comparaison à l'aveugle, qui après une promotion constitue la vérification dont le rapport
  a besoin avant de qualifier une hausse de réel progrès
  ([mesure](/docs/agents/measurement#the-speakers-marks)).
- `improve sheet`, à partir du cycle 2 : une ligne pour 10 nouvelles phrases
  (arrondi à l'inférieur) est un brouillon que le locuteur a annoté `Y` ou `N` sur une feuille
  antérieure, réinjecté sans indication à un emplacement aléatoire. La première ligne de la feuille indique que quelques
  lignes réapparaissent à dessein, sans jamais préciser lesquelles ; `sheet-key.json` en dresse la liste
  (`repeat_rows`). La commande affiche le nombre de lignes réapparues, *« (lesquelles n'est pas
  indiqué) »*, et précise qu'elles requièrent *« environ 10 secondes par ligne, plus jamais entraînées »*.
- `improve marks` évalue une ligne réapparue uniquement par rapport à
  l'annotation antérieure du locuteur — jamais dans la part du cycle, les paires d'entraînement ou la
  comparaison à l'aveugle —, consigne `repeats` dans `marks.json`, et affiche *« Lignes
  réapparues : le locuteur en a annoté A sur J de la même façon qu'auparavant (P %) — W
  autrefois incorrect désormais correct, R autrefois correct désormais incorrect. Non comptabilisées dans la part
  de ce cycle, et plus jamais entraînées. »*
- `improve marks`, lorsque l'autre modèle est le plus récent et que le locuteur
  a évalué au moins un brouillon de chacun, consigne les décomptes avec forge (les décomptes
  uniquement, jamais une phrase) :

  ```bash
  nmt-forge speaker-verdict --newer <run> --in-use <run> --newer-right <n> --newer-judged <n> --in-use-right <n> --in-use-judged <n> --json
  ```

  Lorsque la locutrice ou le locuteur a jugé le modèle le plus récent correct nettement plus souvent, il
  affiche *"forge recorded it: it offers to put the newer model to use (the people say yes first)"* ;
  lorsque forge n'est pas installé ou refuse, il indique
  que les évaluations n'ont pas été enregistrées, et pourquoi.
- `improve prepare` se termine par `nmt-forge round-plan` : la session se poursuit
  à partir du modèle en service (4 passes sur toutes les phrases jusqu'ici) ou s'entraîne
  depuis le début, et en indique la raison ([entraînement](/docs/agents/training#the-improve-rounds)).

Forge compare ensuite le nouveau modèle à celui en cours d'utilisation
(`nmt-forge compare-runs <in-use run-manifest.json> <new run-manifest.json>`,
`auto`) et ne propose de le mettre en service (`confirm`) que s'il est mesurablement
meilleur — ou, lorsque les données étaient trop restreintes pour se prononcer (moins de 50 phrases de dev)
ou en l'absence de changement mesurable, dès lors que les évaluations à l'aveugle du locuteur lui ont nettement accordé
la préférence. Un verdict seul ne met rien en service : seul le « oui » des personnes (`nmt-forge export` et `nmt-forge choose`
de cette étape) le fait. Les nouvelles paires issues de `improve marks` reçoivent d'abord leurs propres termes — le
parcours pose la question. Comment relayer le rapport : [coaching](/docs/agents/coaching).

## Traduire et servir avec mt-eval

`nmt-forge export` au sein d'un projet écrit `deploy/<name>.json` (deployment/1).
Le même fichier permet d'évaluer, de traduire et de servir :

```bash
mt-eval translate --deployment deploy/<name>.json --source-file <input file> --out <output file>
mt-eval serve --deployment deploy/<name>.json      # http://127.0.0.1:8379 by default
mt-eval run --deployment deploy/<name>.json --corpus <dev or test file>
```

- **Remarque.** `mt-eval run` sur un fichier de test ne nécessite aucun pré-enregistrement — il se contente
  d'enregistrer la lecture dans le journal. Évaluez le jeu de test par l'intermédiaire de `nmt-forge export` (ou après la
  rédaction de la prédiction), jamais avant.
- `--gates gates/<chain>.json` ajoute une chaîne de portes à `run`, `translate` ou
  `serve` (sans `--deployment`) ; `run` et `test` refusent une chaîne qui effectue un
  repli. Voir [méthodes et portes](/docs/agents/methods) et
  [mise en service](/docs/agents/serving).

## Hors des rails : ce qui existe pour une langue

```bash
champollion network card <code>                    # the cited language card
champollion network recommend <source> <target>    # methods that can run, with their evidence
mt-eval corpora --source <source> --target <target>   # registered test sets for the pair
nmt-forge discover <code>                          # what a training project can use
```

## Vérifier et mettre à niveau les fichiers

```bash
champollion validate        # project file, sidecars, method.json, gates/, deploy/ — 0 ok, 1 invalid, 2 usage
champollion upgrade --dry   # what upgrading older sidecars to set/1 would change; drop --dry to write
```

## Hors ligne

`CHAMPOLLION_OFFLINE=1` empêche la CLI `champollion` d'accéder au réseau :
les fiches de langue proviennent uniquement de l'ensemble intégré et du cache local (une
fiche pour une langue de la longue traîne n'est pas récupérée), le rafraîchissement quotidien du cache de fiches est ignoré, et
`register-corpus` ne compare pas le hachage d'un fichier avec le catalogue public
(il consigne la comparaison comme non effectuée). Cela ne modifie pas ce qu'une méthode
envoie : une méthode qui appelle un fournisseur a toujours besoin du réseau, et les
règles de transmission continuent de s'appliquer.

`MT_EVAL_NO_REMOTE_REGISTRY=1` empêche `mt-eval` de récupérer son registre de jeux de données
sur le web (pour une machine isolée du réseau).

Ce qui nécessite le réseau sur les rails malgré tout : l'installation des outils,
l'extra d'entraînement et le premier téléchargement d'un modèle pré-entraîné (`byt5-small` ou
`byt5-small-lowmem`, environ 1,2 Go ; `cpu-tiny` ne télécharge rien).

## Variables d'environnement

Lues par le code, pour un opérateur. Les clés d'API des fournisseurs ne sont requises que par
les méthodes qui font appel à un fournisseur, jamais sur le parcours par défaut des rails.

| Variable | Lue par | Effet |
|---|---|---|
| `CHAMPOLLION_MCP_PROFILE` | Serveur MCP | `rails` (valeur par défaut) ou `full` |
| `CHAMPOLLION_CLI_BIN` | Serveur MCP | Le point d'entrée `champollion` à exécuter |
| `NMT_FORGE_BIN` | `champollion`, serveur MCP | L'exécutable `nmt-forge` |
| `UV_TOOL_BIN_DIR` | `champollion`, serveur MCP | Emplacement où chercher `nmt-forge` et `uv` après `PATH` (valeur par défaut : `~/.local/bin`) |
| `CHAMPOLLION_OFFLINE` | `champollion` | `1` : aucun accès réseau pour les fiches ou les consultations du catalogue |
| `CHAMPOLLION_CARDS_CACHE_DIR` | `champollion` | Le cache de fiches par utilisateur (valeur par défaut : `~/.champollion/cards`) |
| `CHAMPOLLION_CARDS_TTL_HOURS` | `champollion` | Fréquence de vérification des mises à jour du cache de fiches (valeur par défaut : 24) |
| `NMT_FORGE_AUTO_PRESET` | `nmt-forge init --model auto` | Fixe le préréglage sélectionné par `auto` (doit être un nom de préréglage) |
| `NMT_FORGE_SERVE_PORT` | `nmt-forge serve` | Port par défaut (8378 en son absence) |
| `NMT_FORGE_SERVE_TOKEN` | `nmt-forge serve` | Le jeton Bearer ; requis hors boucle locale |
| `NMT_FORGE_NO_MONITOR` | `nmt-forge run` | `1` : aucun panneau d'entraînement en direct |
| `MT_EVAL_SERVE_TOKEN` | `mt-eval serve` | Le jeton Bearer (jamais sous forme de valeur en ligne de commande) |
| `CHAMPOLLION_SERVE_TOKEN` | `champollion serve` | Le jeton Bearer pour le serveur propre à la CLI |
| `MT_EVAL_NO_REMOTE_REGISTRY` | `mt-eval` | `1` : aucune récupération du registre |
| `MT_EVAL_DATA_ROOT` | `mt-eval` | Emplacement où les chemins des jeux de données enregistrés sont résolus en priorité |
| `OPENROUTER_API_KEY` | `champollion`, `mt-eval` | La clé du fournisseur de modèle hébergé par défaut |

## Sortie destinée aux programmes

| Outil | Sortie machine | Codes de sortie |
|---|---|---|
| `champollion` | `--json` sur les commandes des rails (`new`, `next`, `data add`, `data mark`, `data combine`, `improve report`, `improve status`, `connect`, `upgrade`) | 0 ok · 1 refusé · 2 utilisation |
| `nmt-forge` | `--json` sur chaque sous-commande : un document JSON sur stdout, tout le reste sur stderr | 0 ok · 2 refusé (`{"error": …}`) |
| `mt-eval` | `--json` et `--non-interactive` sur chaque sous-commande | 0 ok · non nul refusé |

Formats des refus : [le modèle des rails](/docs/agents/rails-model#refusal-shapes).

## Approfondir

- [La référence des commandes `champollion`](/docs/reference/cli),
  [`nmt-forge`](/docs/network/getting-started/forge-command-reference) et
  [`mt-eval`](/docs/reference/mt-eval).
- [Le modèle des rails](/docs/agents/rails-model) — le parcours et `next --json`.
- [Piloter les rails via MCP](/docs/agents/mcp) — les mêmes étapes sous la forme de six outils.
- [Entraînement avec nmt-forge](/docs/agents/training) et
  [règles relatives aux données](/docs/agents/data-rules).
