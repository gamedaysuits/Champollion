---
title: "Le modèle sur rails"
slug: /agents/rails-model
description: "Comment est conçu un projet sur les rails de Champollion : l’arborescence du projet, les six formats validés par schéma que lit chaque outil, le pipeline unique allant de l’entrée admise à la sortie mesurée, le parcours sous forme de données et la forme de chaque refus."
---

# Le modèle des rails

Un projet sur les rails est un dossier de fichiers simples. Chaque outil — la
CLI `champollion`, `nmt-forge`, `mt-eval` et le serveur MCP — lit les mêmes
fichiers nativement, par rapport aux mêmes schémas, avec les mêmes verdicts. L'étape
suivante est toujours lue à partir des fichiers, jamais mémorisée. (Deux éléments résident
en dehors du projet : le serveur MCP compte les échecs d'une étape pour sa propre
durée de vie, et nmt-forge maintient une file d'attente d'entraînement pour l'ensemble de la machine dans
`~/.nmt-forge`.) Modifiez un fichier à la main, puis demandez l'étape suivante, et la réponse
reflète cette modification.

Cette page sert de carte. Les règles de fonctionnement se trouvent dans
[le contrat](/docs/agents/contract) ; les appels d'outils se trouvent dans
[MCP](/docs/agents/mcp) et [le shell](/docs/agents/shell).

## Les outils

| Outil | Installation | Ce qu'il fait sur les rails |
|---|---|---|
| `champollion` | npm (Node 20.11+) | Démarre les projets, importe les données, consigne leurs conditions, nomme l'étape suivante, exécute les cycles d'amélioration, connecte un modèle à une application |
| `nmt-forge` | PyPI (`uv tool install --python 3.12 nmt-forge`) | Entraîne, filtre, divise, enregistre les prédictions, évalue les modèles sur le jeu de test et les exporte, les sert ; tient le livre de comptes |
| `mt-eval` | fourni avec `nmt-forge` (le paquet `mt-eval-harness`) | Exécute une méthode sur un jeu de test, un fichier ou une requête ; applique les portes de contrôle ; calcule les scores |
| `champollion-mcp-server` | npx | Pilote la CLI `champollion` sous forme de processus enfants bornés ; le profil des rails comprend six outils |

Chaque outil s'exécute dans son propre processus. Le serveur MCP exécute les mêmes commandes qu'une
personne saisit (son `run_next_step` refuse tout programme autre que
`champollion`, `nmt-forge` et `uv tool install … nmt-forge`).

## L'arborescence du projet

`champollion new <folder> --from <language> --to <language>` écrit :

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

Il refuse un dossier contenant déjà un projet (code de sortie 1) ou tout
fichier non masqué (code de sortie 1), ainsi qu'un `kind` autre que `language` : les projets `task` et
`service` ne sont pas encore sur les rails. `--dry` résout les langues
et n'écrit rien.

Les étapes ajoutent le reste au fur et à mesure de leur exécution :

| Chemin | Écrit par | Contient |
|---|---|---|
| `<file>.champollion.json` | `champollion data add`, `data mark`, `data combine`, `improve marks` | set/1 — les conditions du fichier adjacent |
| `data/combined-from/` | `champollion data combine` | les originaux réunis par combine (déplacés, jamais supprimés) |
| `data/not-for-training/` | `champollion data combine` | fichiers dont les détenteurs ont indiqué qu'aucun modèle ne peut apprendre à partir d'eux |
| `.forge/` | `nmt-forge init` | l'atelier : `eval-registry.json`, `ledger.jsonl`, préenregistrements, `runs/` |
| `config.json`, `NEXT_STEPS.md` | `nmt-forge init` | la configuration d'entraînement (un préréglage de modèle développé en valeurs explicites) |
| `data/clean/` | `nmt-forge leak-audit --clean-to` | les paires d'entraînement sélectionnées |
| `data/split/` | `nmt-forge split`, `champollion improve prepare` | le jeu de développement ; le fichier d'entraînement de chaque cycle |
| `data/dev/practice-round-<k>.tsv` | `champollion improve marks` | phrases rédigées par le locuteur pour le jeu de développement — rôle `dev`, local uniquement, jamais utilisées pour l'entraînement |
| `improve/time.json` | `champollion improve time` | le temps du locuteur, avec ses propres mots |
| `improve/round-<k>/` | les étapes d'amélioration | `wishlist.md`, `to-translate.txt`, `review.csv`, `sheet-key.json` (les lignes rédigées par l'autre modèle — un modèle plus récent non utilisé, ou celui remplacé par une promotion : numéros de ligne, noms des exécutions, la relation et le nombre de paires d'entraînement de chaque modèle — et, à partir du cycle 2, `repeat_rows` : les lignes à nouveau présentées, chaque `row`, `from_round`, `from_row` et le `mark` antérieur), `marks.json` (les décomptes, la proportion correcte avec son intervalle, `blind` et `repeats` : `shown`, `judged`, `agreed`, `agreement`, `wrong_to_right`, `right_to_wrong`, `wrong_before`, `rounds_apart_wrong_before`), `prepared.json`, `report.json` |
| `export*/` | `nmt-forge export` | un modèle exporté et son method.json |
| `deploy/<name>.json` | `nmt-forge export` (au sein d'un projet rails) | deployment/1 — ce qui est déployé |
| `gates/*.json` | personnes | gate-chain/1 — vérifications entre la sortie et ce qui est livré |
| `methods/<id>/method.json` | personnes | method/1 (également écrit par `nmt-forge export` dans un dossier de modèle, `mt-eval export` et `champollion serve --emit-manifest`) |

## Les formats

Six schémas de cadre résident dans `shared/schemas/framework/`. Chaque document
indique son schéma dans `$schema`. Les clés inconnues sont refusées ; vos propres
clés se placent sous `x-`.

| Format | `$schema` | Emplacement | Description |
|---|---|---|---|
| project/1 | `https://champollion.dev/schemas/project/1.json` | `champollion.project.json` | Décisions uniquement : `kind`, `name`, `pair`, `purpose`, `defaults`, `created_with` |
| set/1 | `https://champollion.dev/schemas/set/1.json` | `<file>.champollion.json` | Conditions d'un fichier de données : `transmission`, `role`, `kind`, `pair`, `fields`, `terms`, champs d'inscription, `derived_from`, `holders_agreed` |
| method/1 | `https://champollion.dev/schemas/method/1.json` | `method.json` | Une méthode unique : `id`, `name`, `kind` et le paramètre unique de ce type, `pairs`, `decode`, `card`, `evidence` |
| gate-chain/1 | `https://champollion.dev/schemas/gate-chain/1.json` | `gates/*.json` | `metric-threshold` portes ordonnées et un `fallback` facultatif |
| deployment/1 | `https://champollion.dev/schemas/deployment/1.json` | `deploy/*.json` | Une méthode, ses portes, une paire ; hôte et port `serve` facultatifs |
| service-api/1 | `https://champollion.dev/schemas/service-api/1.json` | le contrat `/translate` | Documents de requête, de réponse, d'erreur et `/health` |

`project.defaults` — ce que reçoivent les données ajoutées au projet lorsque personne ne spécifie
le contraire. `champollion new` écrit `{"transmission": "local-only",
"training": "ask", "share_scores": "ask"}`. The values: `transmission`
`local-only` ou `ask` ; `training` `allowed`, `not-allowed` ou `ask` ;
`share_scores` `never` ou `ask`. `ask` force les outils à s'interrompre pour poser la question — les rails
n'inventent jamais de réponse.

Deux autres enregistrements ne constituent pas des schémas de cadre, mais font partie intégrante du modèle :

- **Le registre de forge**, `.forge/ledger.jsonl` : à ajout seul et chaîné par hachage
  (chaque entrée intègre le hachage de la précédente ; `nmt-forge ledger verify`
  échoue à la moindre modification). Il consigne les enregistrements, chaque lecture d'un jeu
  enregistré, les préinscriptions, les scores, les consommations de jeux scellés, les dérogations, les
  verdicts d'audit de fuite, le seuil de dictionnaire, les exportations, les choix, les mises en service, les verdicts de cycle
  (`improve-compare` : `better`, `worse`, `no-change` ou `too-few` pour moins de 50
  phrases de développement), la manière dont chaque cycle s'entraîne (`round-plan`), les brouillons
  de l'autre modèle pour une feuille de révision (`draft-newer` : noms d'exécution, `relation`, le
  nombre de paires d'entraînement de chaque modèle et un décompte des brouillons), le verdict à l'aveugle
  du locuteur sur un modèle plus récent (`improve-speaker` : noms d'exécution, quatre décomptes, `z`,
  `clear`), les modifications de modèle (`model-change`, y compris un `not-now`) et ce que
  `nmt-forge tidy` a supprimé (`tidy` : exécutions et octets). Des décomptes, des hachages et
  des chemins — jamais une phrase. Il s'agit d'une tenue de registre
  à détection d'altération, non d'une sécurité cryptographique.
- **La fiche d'exécution** : ce que `mt-eval run` enregistre pour une exécution évaluée, et ce qu'un
  résultat publié comporte. Consultez la [spécification de la fiche d'exécution](/docs/network/specifications/run-card).

**Verrouillage.** `champollion validate [folder]` valide le fichier de projet, chaque
fichier annexe, chaque `method.json` (à la racine, dans `methods/*/` et
`.champollion/methods/*/`), `gates/*.json` et `deploy/*.json` par rapport à ces
schémas. Le banc d'essai lit les mêmes fichiers avec les mêmes verdicts. Code de sortie 0 = aucune
erreur, 1 = un document est invalide, 2 = erreur d'utilisation. Il n'ouvre que ces fichiers JSON,
jamais un fichier de données.

`champollion upgrade [folder]` réécrit les fichiers annexes rédigés avant set/1 (sans
`$schema`) au format set/1, en conservant chaque valeur (une clé inconnue de set/1 est déplacée
sous `x-<key>`). Il laisse intact un fichier annexe invalide, et liste un ancien
`method.json` sans le modifier : chaque outil continue de le lire, comme method/0,
avec un avertissement.

## Le pipeline unique

Chaque façon dont une méthode interagit avec du texte constitue un pipeline unique au sein du moteur d'évaluation :

1. **Admission.** Les conditions de l'entrée sont lues (le fichier annexe set/1, une
   enveloppe JSON, l'entrée du registre) et sa politique de transmission est résolue et
   appliquée avant toute traduction. Tout canal non autorisé par la politique est
   refusé ici (voir les [règles de données](/docs/agents/data-rules)).
2. **Méthode.** Une méthode effectue la traduction (types method/1 : `llm`, `llm-coached`,
   `mt-api`, `local-model`, `nmt-checkpoint`, `lexicon`, `python`, `service`,
   `human`).
3. **Portes de contrôle.** Si une chaîne de portes est spécifiée, chaque segment est évalué ; la première porte
   qui refuse détermine ce qui est livré (`drop`, `keep-source`, `flag`,
   `fallback`). Voir [méthodes et portes](/docs/agents/methods).
4. **Sorties.** Le journal d'exécution est écrit ; les fichiers extraits d'une entrée marquée conservent
   ses conditions dans un fichier annexe placé à leurs côtés.
5. **Métriques.** Uniquement lorsque des références existent : le score principal évalue ce qui a été livré,
   le score sans filtrage figure à ses côtés. Voir la [mesure](/docs/agents/measurement).

Les modes appliquent ce même pipeline à des entrées différentes :

| Mode | Commande | Entrée | Métriques |
|---|---|---|---|
| Mesurer | `mt-eval run` (`mt-eval test` recalcule les scores d'un journal d'exécution) | un jeu de test ou de validation | oui |
| Traduire un fichier | `mt-eval translate --out <file>` | source uniquement | non |
| Servir | `mt-eval serve` | une requête à la fois | non |

**Un déploiement est le pipeline de mesure appliqué à une entrée source uniquement.** Un
fichier deployment/1 unique est testé (`mt-eval run --deployment`), exécuté sur un fichier
(`mt-eval translate --deployment`) et servi (`mt-eval serve --deployment`),
afin que ce qui a été mesuré corresponde exactement à ce qui est livré. Avec `--deployment`, les drapeaux déterminés
par le fichier (`--method`, `-m`/`--model`, `--gates`, `--target-script`) sont refusés.
Un déploiement ne mentionne aucun score : un résultat mesuré constitue un résultat d'exécution, conservé avec
l'exécution. Voir le [service](/docs/agents/serving).

## Le parcours, sous forme de données

L'ordre du travail est consigné dans un fichier : `shared/journeys/language.json`.
L'évaluateur, `cli/lib/framework/journey.js`, en est l'unique lecteur ;
`champollion next`, le profil rails de MCP et `NEXT.md` lui posent tous la même
question. **La première étape non accomplie est l'étape suivante.** Il lit uniquement
les fichiers annexes, le fichier de projet ainsi que le registre et le livre de comptes de forge — jamais le texte
d'un fichier de données — et n'exécute rien d'autre que `nmt-forge --version` (limité à
30 s) pour l'étape d'installation et `nmt-forge status --json` (limité à 60 s)
dès que le travail atteint la phase d'entraînement.

**Phases.** `start` → `gather` → `protect` → `tools` → `build` → `improve`.

**Une étape** possède un `id`, un `stage`, un `mode`, des termes simples destinés à la personne
(`say`) et la raison de son importance (`why`), et généralement une `command`. Champs facultatifs :

| Champ | Signification |
|---|---|
| `done_when` | La vérification qui confirme que l'étape est terminée. Obligatoire (sauf pour une étape avec délégation) |
| `when` | Une vérification qui doit être satisfaite pour que l'étape s'applique (le plancher du dictionnaire ne s'applique que lorsque `data/lexicon/` contient un fichier) |
| `question`, `answers` | La question d'une étape `ask_user` et ses emplacements de réponse : `{"enum": [...]}` ou `{"type": "string", "say": "…"}` |
| `agent`, `agent_tool` | Ce qu'un agent effectue lui-même pour l'étape d'une personne (importer les fichiers indiqués avec `add_data`) |
| `outdated` | Une variante utilisée lorsque la vérification détecte que l'outil est trop ancien |
| `delegate` | `"nmt-forge"` : passer le relais au conseiller propre de forge |

Les `{placeholders}` dans `say`, `question` et `command` sont renseignés à partir du fichier
de projet et des fichiers trouvés.

Les **vérifications** forment un ensemble fermé ; l'évaluateur renvoie une exception s'il en rencontre une inconnue :
`project_valid`, `data_files`, `every_data_file_has_terms`,
`protected_test_set`, `tool_on_path` (avec `min_version`), `path_exists`,
`forge_test_registered`, `single_file`, `forge_role_registered`,
`forge_ledger_event`, `screened_rows`, `lines_in_file`, `review_marked`,
`improve_prepared`, `forge_trained_on_current`.

**Modes :**

| Mode | Qui agit | Ce que les rails autorisent |
|---|---|---|
| `auto` | l'agent | exécuter la commande |
| `confirm` | l'agent, après confirmation | installations, entraînement, toute action qui consomme des ressources ou publie ; exécuter uniquement après accord explicite de la personne |
| `ask_user` | la personne répond | poser la question `question` ; transmettre ses réponses via les clés de `answers` ; ne jamais répondre à sa place |
| `wait` | personne | une opération est en cours ; demander à nouveau plus tard |
| `human_only` | une personne | rassembler des phrases, annoter des ébauches, choisir |
| `use_tool` | l'agent, avec son propre outil | MCP uniquement : une étape `human_only` avec un champ `agent` est affichée comme `use_tool` avec `step.tool` |

**Délégation.** À l'étape `forge`, le parcours exécute `nmt-forge status
--json` et adopte l'état de forge comme étape. Les états de forge correspondent à des modes :
`training` → `wait` ; `ready-to-train` et `needs-training-extra` → `confirm` ;
`missing-preregistration` → `ask_user` ; `choose-export` → `human_only` ;
`improve-compare` → `auto` ; `improve-promote` → `confirm` ;
`improve-stronger-model` → `ask_user`. Tout autre état devient `auto` lorsque forge
indique une commande, et `human_only` lorsqu'il n'en indique pas. L'état `serving` met fin à la
phase de construction, et la phase d'amélioration commence.

Deux types d'étapes proviennent de l'extérieur de la liste des étapes :

- **Évaluation de la prédiction.** Après un export évalué sur le jeu de test, une
  prédiction rédigée par les personnes avec leurs propres mots attend leur verdict : une
  étape `ask_user` avec `answers` `verdict` (`held` ou `missed`) et `by` (qui
  l'a évaluée), qui exécute `nmt-forge prereg verdict`.
- **Attente d'accord.** Tout fichier dont le fichier annexe indique `speakers_agreed:
  not-yet` becomes its own `ask_user` question in `waiting`, auquel on répond par son
  propre identifiant d'étape dès que la personne a la réponse. Cela ne bloque jamais le reste
  des rails.

**L'identifiant d'étape** est `<journey step id>:<8 hex characters>` — un hachage de l'étape
et de sa commande renseignée. Si le projet change, l'identifiant change, et tout
`run_next_step` utilisant l'ancien identifiant est refusé (`the project changed since that
step was named`).

**Ce que `champollion next --json` renvoie :** `project`, `kind`, `stage` (`n`,
`of`, `id`, `title`), `done` (identifiants d'étape), `step` (`id`, `mode`, `say`, `why`,
et le cas échéant `command`, `question`, `answers`, `agent`, `agent_tool`,
`file`, `source`), `now` (les faits de forge — ce qui est vrai à cet instant), `waiting`,
`forge` (`state`, `blockers`, `warnings`), `finished` (lorsqu'il ne reste aucune étape)
et `error`. Code de sortie 1 en cas d'erreur sans étape disponible.

## Formats de refus

Chaque refus indique ce qui s'est produit, et la plupart précisent la raison ainsi que la solution.

| Outil | Sortie humaine | Sortie machine | Sortie |
|---|---|---|---|
| `nmt-forge` | `[guard] message`, puis `  why: …` et `  fix: …` | `--json` : `{"error": {"type", "guard", "message", "why", "fix", "how_to_get", "text"}}` sur stdout | 2 refusé |
| `champollion` | `[ERR] message` sur stderr | `--json` lorsque la commande le prend en charge | 1 refusé, 2 utilisation |
| Outils rails de MCP | — | `{"refused": "<reason>", …}` avec `isError: true`, ainsi que la nouvelle tentative le cas échéant (`if_it_has_no_code`, `current`, `last_output`, `question`, `answers`) | — |

`type` dans l'erreur de forge correspond à la classe d'exception (`UsageError` pour les
arguments incorrects — forge refuse les options abrégées plutôt que de deviner). Les noms des gardes
de forge comprennent `split-guard`, `dev-fence`, `leak-audit`, `preregister`,
`eval-ledger`, `ci-scoring`, `registry`, `improve-loop` et `disk-room` (une
exécution d'entraînement que le disque ne peut contenir). Lorsqu'une erreur
devrait citer une phrase issue d'un corpus retenu, la phrase affiche
`[sentence withheld]` et l'objet ajoute `text_withheld`.

Transmettez un refus en termes simples et appliquez sa solution, ou demandez à nouveau
l'étape suivante. Une étape qui a échoué deux fois n'est plus exécutée tant que la personne n'en a pas décidé
([MCP](/docs/agents/mcp#when-a-step-fails)).

## Approfondir

- [Le contrat d'exploitation](/docs/agents/contract) — les règles, verrous et notes.
- [Piloter les rails via MCP](/docs/agents/mcp) et [depuis le shell](/docs/agents/shell).
- [Règles de données et de transmission](/docs/agents/data-rules) — set/1 en détail.
- [Méthodes et portes de contrôle](/docs/agents/methods) et [mise en service](/docs/agents/serving) — method/1, gate-chain/1, deployment/1, service-api/1.
- [La spécification de la run card](/docs/network/specifications/run-card) et la
  [spécification du banc d'essai](/docs/network/specifications/harness).
- [Référence des commandes `mt-eval`](/docs/reference/mt-eval) et la
  [référence des commandes `nmt-forge`](/docs/network/getting-started/forge-command-reference).
