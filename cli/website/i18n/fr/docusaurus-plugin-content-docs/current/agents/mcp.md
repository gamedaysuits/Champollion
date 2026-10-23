---
title: "Piloter les rails via MCP"
slug: /agents/mcp
description: "Connectez un client MCP au profil de rails de Champollion et parcourez un projet linguistique avec six outils : configuration par client, chaque argument et valeur de retour, la boucle, les modes d'étape, les refus et les sujets d'explication."
---

# Piloter les rails via MCP

Le profil par défaut du serveur MCP correspond aux rails : six outils qui guident un
projet linguistique depuis un dossier vide jusqu'à un modèle évalué sur le propre
ordinateur de l'utilisateur. Chaque outil exécute le CLI `champollion` en tant que
processus distinct et borné — les mêmes commandes que celles saisies par une personne. Le serveur transmet également à votre client
de brèves instructions de fonctionnement (`instructions-rails.md`) lors de la connexion.

## Connexion

Le serveur communique en MCP via stdio et requiert Node.js 20.11 ou une version plus récente. La
configuration acceptée par tout client configuré par fichier :

```json
{
  "mcpServers": {
    "champollion": { "command": "npx", "args": ["-y", "champollion-mcp-server"] }
  }
}
```

| Client | Emplacement |
|---|---|
| Claude desktop | Settings → Developer → Edit Config. Ajoutez l'entrée, enregistrez, redémarrez l'application |
| Claude Code | `claude mcp add champollion -- npx -y champollion-mcp-server` |
| Cursor | `mcp.json` dans le dossier `.cursor` du projet, ou dans `.cursor` dans le dossier personnel |

Les autres clients capables de démarrer un serveur stdio local utilisent la même commande ; cette
page décrit uniquement les trois ci-dessus.

**Chemins des outils.** Le serveur détecte lui-même le CLI dont il dépend. Il recherche
`nmt-forge` sur `PATH`, puis dans `UV_TOOL_BIN_DIR` (par défaut `~/.local/bin`,
où `uv tool install` le place) — un client lancé depuis une application de bureau dispose
souvent d'un `PATH` plus restreint qu'un terminal. Les surcharges s'effectuent via des variables d'environnement dans
l'objet `env` de l'entrée du serveur :

| Variable | Effet |
|---|---|
| `CHAMPOLLION_MCP_PROFILE` | `rails` (par défaut) ou `full` |
| `CHAMPOLLION_CLI_BIN` | le point d'entrée du CLI `champollion` à exécuter au lieu de celui fourni |
| `NMT_FORGE_BIN` | l'exécutable `nmt-forge` (le parcours du CLI respecte la même variable) |
| `UV_TOOL_BIN_DIR` | où chercher `nmt-forge` et `uv` après `PATH` |

## Profils

| Profil | Sélection | Description |
|---|---|---|
| rails | par défaut | Six outils et des instructions courtes ; un projet linguistique de bout en bout |
| full | `--profile full` dans `args`, ou `CHAMPOLLION_MCP_PROFILE=full` | Tous les outils : fiches de langues, corpus, benchmarks, file d'attente, concours, entraînement forge, publication |

Toute autre valeur interrompt le serveur : `unknown MCP profile "<value>" (rails or
full)`. L'ensemble complet est répertorié sur
[la page du serveur MCP](/docs/network/getting-started/mcp-server). Pour un
projet linguistique, conservez le profil rails : c'est celui dont chaque étape
est déduite des fichiers du projet.

## La boucle

1. Pas encore de projet → `start_project`. Son premier appel ne crée rien : transmettez son
   `ask_first` à la personne, puis effectuez l'appel qu'il fournit pour sa réponse.
2. `project_status` → lisez `step.mode`, `step.say`, `step.why`.
3. Exécutez ce qu'indique le mode, en utilisant `step.call` — l'appel exact qui franchit
   l'étape.
4. Retour au point 2. Après toute modification effectuée manuellement par vous ou la personne, appelez
   à nouveau `project_status` : l'étape suivante est toujours lue à partir des fichiers.
5. `step: null` → les rails sont terminés. Transmettez à la personne ce qu'indique `finished`.

| `step.mode` | Action requise | `step.call` |
|---|---|---|
| `auto` | Exécutez-la | `run_next_step` avec `project_dir`, `step_id` |
| `confirm` | Expliquez à la personne ce qu'elle fait (installations, entraînement) ; demandez oui ou non ; n'exécutez qu'en cas d'accord. En cas de « pas maintenant », enregistrez-le : rien ne s'exécute | `run_next_step` avec `confirmed: true` ajouté après le oui ; `declined: true` pour « pas maintenant » |
| `ask_user` | Posez `step.question` en des termes simples ; transmettez leurs réponses selon les clés de `step.answers`. Pour « pas maintenant » : lorsque `not-now` est l'une des valeurs de `enum` d'un champ, il s'agit d'une réponse — transmettez-la ; sinon, enregistrez-le : rien ne s'exécute | `run_next_step` avec `answers` — chaque champ noté `<…>`, à remplacer par les mots de la personne ; `declined: true` en cas de « pas maintenant » qui n'est pas l'une des réponses |
| `wait` | Une tâche est en cours d'exécution | `project_status` avec `wait_seconds: 120` ; répétez tant que le mode reste `wait` |
| `use_tool` | Exécutez-la maintenant avec `step.tool` ; ne la restituez pas | p. ex. `add_data` avec `path: "<each file the person named, where it is>"` |
| `human_only` | Une personne s'en charge : indiquez-lui `step.say` | aucun |

`step.command` correspond à ce que les rails exécutent — jamais à un nom d'outil. Un `<…>` dans un appel est
un champ réservé à la réponse ou au fichier de la personne ; un champ renvoyé tel quel est
refusé.

## Les six outils

### `start_project`

| Argument | Type | Signification |
|---|---|---|
| `folder` | chaîne, requis | Nouveau dossier pour le projet, relatif à `parent_dir` |
| `from` | chaîne, requis | La langue source : un code ou un nom |
| `to` | chaîne, requis | La langue cible : un code ou un nom |
| `target_name`, `source_name` | chaîne | L'autonyme de la langue ; requis pour un code à usage privé (`qaa`–`qtz`) |
| `purpose` | chaîne | L'objectif des traductions, selon les mots de la personne |
| `parent_dir` | chaîne | Emplacement où créer le dossier (par défaut : le répertoire de travail du serveur) |
| `confirmed` | booléen | `true` uniquement après accord de la personne sur la direction |

Sans `confirmed: true`, il exécute `champollion new --dry` et renvoie
`made: false`, `ask_first` (une phrase à formuler : *« Ce traducteur prend X et
restitue Y — vous saisissez X, et Y est produit. Est-ce bien dans ce sens
que vous le souhaitez ? »*), `if_yes` et `if_the_other_way` (chacun étant un appel complet) ainsi que
`languages` — la résolution de chaque nom, avec `matchedAs` lorsque le mot de
la personne correspond à un autre nom enregistré sur une fiche, et `alsoNamed` lorsque le même terme désigne
d'autres langues. Restituez les deux. Avec `confirmed: true`, il crée le projet
et renvoie `project`, `languages` et `next` (la première étape).

Si aucun nom ne figure sur une fiche et qu'aucun terme proche n'existe, le refus ajoute
`if_it_has_no_code`, soit le même appel avec `to: "qaa"` et leur nom comme
`target_name`. Ne l'utilisez que pour le nom fourni par la personne.

### `project_status`

Arguments : `project_dir` (requis) ; `wait_seconds` (0–120). Avec
`wait_seconds`, il effectue une relecture toutes les 5 secondes tant que l'étape est `wait`, puis
retourne dès que l'étape change ou que le délai expire.

Renvoie `project`, `stage` (`"2/6 Gather your data"`), `step` (`id`, `mode`,
`say`, `why`, `call`, et s'ils sont présents `question`, `answers`, `command`,
`tool`, `for_the_person`), ainsi que les éléments suivants lorsqu'ils s'appliquent :

| Champ | Description | Action requise |
|---|---|---|
| `true_now` | L'enregistrement propre à Forge, sous forme de phrases : modèles entraînés et leur meilleur chrF++ sur dev, verdict de l'audit de fuite par jeu de test, scores sur le jeu de test, indication d'un entraînement en cours, présence d'un modèle servi et son emplacement | Décrivez ce qui a été fait uniquement à partir de ces lignes, rien de plus |
| `waiting_for_agreement` | Fichiers pour lesquels les locuteurs n'ont pas encore donné leur accord (`speakers_agreed: not-yet`) : chacun avec `file`, `question`, `say` et son propre `call` | Posez chaque question une fois par session, avec tact ; n'effectuez son appel que lorsque la personne confirme que tout le monde a donné son accord |
| `files_not_added` | Fichiers refusés par `add_data` au cours de cette session et qui ne figurent toujours pas dans le projet, chacun avec son refus | Intégrez chacun d'eux (son refus indique la marche à suivre), ou précisez à la personne lequel est écarté et pour quelle raison |
| `model_in_use` | Dès qu'un modèle est servi, en marge des étapes des cycles d'amélioration : `say` (sa page d'essai et son mode d'utilisation) et `for_the_person` (la commande `champollion connect` qui l'intègre dans leur application ou site Web) | Informez la personne une seule fois ; elle exécutera la connexion lorsqu'elle le souhaitera |
| `blockers`, `warnings` | Ceux de Forge, in extenso | Transmettez-les mot pour mot |
| `finished` | Lorsqu'il ne reste aucune étape : ce que les utilisateurs peuvent faire à présent (essayer le modèle sur sa page ; une application) | Informez la personne |
| `error` | Raison pour laquelle aucune étape n'a pu être désignée | Transmettez-la |

Un dossier de projet inexistant ou dépourvu de `champollion.project.json`
est refusé avec la mention des projets trouvés à proximité.

### `run_next_step`

| Argument | Type | Signification |
|---|---|---|
| `project_dir` | chaîne, requis | Le dossier du projet |
| `step_id` | chaîne, requis | Le `step.id` (ou l'identifiant d'une entrée de `waiting_for_agreement`) qui vient d'être renvoyé |
| `answers` | objet de chaînes | `ask_user` : les réponses de la personne selon les clés de `step.answers` |
| `confirmed` | booléen | `confirm` : `true` uniquement après accord de la personne. Également : une étape ayant échoué deux fois, seulement si la personne demande de la réessayer telle quelle |
| `declined` | booléen | `true` lorsque la personne a répondu pas maintenant à une étape `confirm`, ou à une question n'ayant pas de réponse `not-now` propre : rien n'est exécuté, et la question n'est plus posée au cours de cette session. Lorsque `not-now` fait partie des réponses, transmettez-le dans `answers` |

Il relit l'étape suivante avant de lancer toute exécution. **Verrous :**

- Un identifiant différent est refusé : `the project changed since that step was named
  — call project_status again`, with `current`.
- `human_only` est refusé (`a person does this step: …`) ; une étape `human_only`
  qu'un agent effectue avec un outil est refusée en indiquant l'outil à utiliser.
- `wait` est refusé ; `confirm` sans `confirmed: true` est refusé (`ask the
  person first, then call again with confirmed: true`).
- `ask_user` : chaque réponse est requise (`missing the answer "<key>" — ask the
  person who holds the data; never answer for them`); a `<…>` est
  refusé ; une réponse hors `enum` est refusée.
- Seuls les programmes propres aux rails s'exécutent : `champollion`, `nmt-forge` et `uv tool
  install … nmt-forge`. A command using `|`, `;`, `<`, `>`, `` ` ``, `$` ou un
  `&` isolé est refusé ; `&&` joint les parties, exécutées dans l'ordre, en s'arrêtant au premier
  échec.
- Chaque partie est limitée à 10 minutes (l'installation de `uv` à 15).
- `declined: true` sur une étape qui n'est ni `confirm` ni `ask_user` est
  refusé : `this step does not wait on the person's yes (<mode>) — there is
  nothing to decline`.
- `declined: true` sur une étape dont les `answers` incluent `not-now` (aujourd'hui, le
  `try_it` de la proposition d'un modèle plus puissant) est refusé, et le refus indique le
  `answers` de l'étape : `"not now" is one of this step's own answers — pass it in
  answers (try_it: "not-now"): it is recorded, and this comes back only after
  more rounds; declined would ask again next session`.

Renvoie `ran` — par partie : `command`, `exit_code`, `timed_out` le cas échéant, ainsi que
les 40 dernières lignes de `output` — et `next`, l'étape suivante sous
le format de `project_status`.

#### « Pas maintenant »

Il existe deux manières de l'enregistrer, et l'étape détermine laquelle :

| L'étape | « Pas maintenant » est | Ce qui est enregistré | Quand elle réapparaît |
|---|---|---|---|
| Une étape `ask_user` dont `answers` inclut `not-now` (l'offre d'un modèle plus puissant : `try_it`, `yes` ou `not-now`) | Une réponse : `answers: {"try_it": "not-now"}` | Le registre de Forge (`model-change`, `answer: "not-now"`) ; rien d'autre ne change | Après deux cycles supplémentaires jugés **no-change** ou **worse** par le jeu de validation — toutes sessions confondues |
| Une étape `confirm` (entraînement, installation, mise en service d'un modèle) ou une question à laquelle la personne ne peut pas encore répondre | `declined: true` | La mémoire de ce serveur uniquement | Au redémarrage du serveur (la session suivante) |

`declined: true` n'exécute rien et renvoie `declined` (l'identifiant de l'étape), `ran: []`,
`say` (*« Rien n'a été exécuté. La question ne sera plus posée lors de cette session ; s'ils l'évoquent
et donnent leur accord, procédez alors. »*) et `next`. Le refus est conservé pendant la
durée de vie du serveur — une session ; un serveur redémarré l'aura oublié. Tant qu'il
est actif, cette étape revient de `project_status` et `run_next_step` avec
`declined_this_session` (horodatage, au format ISO) et son `say` commençant par *« Ils
ont répondu pas maintenant (HH:MM UTC) à ceci : … »* et se terminant par *« Ne posez plus la question lors de cette
session — rien de ce qui nécessite leur accord ne s'exécute. S'ils l'évoquent d'eux-mêmes
et donnent leur accord, traitez-la avec confirmed: true (ou leurs réponses). »* Un appel ultérieur avec
`confirmed: true`, ou avec les réponses, exécute l'étape et lève le refus.
**Remarque.** Ne redemandez pas lors de cette session, et ne contournez pas l'étape ; si
la personne l'aborde et donne son accord, procédez alors.

#### En cas d'échec d'une étape

**Verrou.** Une étape ayant échoué deux fois de suite (code de sortie non nul ou délai d'attente dépassé, comptabilisé
sur la durée de vie du serveur) est refusée une troisième fois sauf si `confirmed: true` est défini,
avec son `last_output`. **Remarque.** Ce drapeau vous appartient : indiquez à la personne
ce qui a été affiché, et soit elle corrige le problème (une commande corrigée exécutée dans un terminal
convient tout à fait — appelez ensuite `project_status`), soit elle demande de réessayer tel quel.

### `add_data`

| Argument | Type | Signification |
|---|---|---|
| `project_dir` | chaîne, requis | Le dossier du projet |
| `path` | chaîne, requis | L'emplacement du fichier : absolu, ou relatif au dossier du projet ou au répertoire de lancement du serveur |
| `into` | `parallel` (par défaut) · `test` · `lexicon` | Paires d'apprentissage ; phrases de test vérifiées ; liste de mots |
| `source_col`, `target_col` | chaîne | Une colonne sous forme de lettre (`A`), de numéro ou d'en-tête ; pour ELAN, le numéro de strate listé par le refus (ou un identifiant exact de strate saisi par la personne) ; pour LIFT, un code de langue |
| `sheet` | chaîne | La feuille ou la table concernée, lorsqu'il y en a plusieurs |
| `header` | booléen | `true` : la première ligne est un en-tête ; `false` : il s'agit de données |
| `usfm_source` | chaîne | Textes sacrés USFM uniquement : le texte de l'autre langue (un fichier ou dossier `.usfm`) |
| `replace` | booléen | Relire un fichier déjà ajouté (autre en-tête ou autres colonnes) ; les réponses des détenteurs des données sont conservées |

Il exécute `champollion data add`. Appelez-le d'abord avec le seul chemin : un en-tête
nommant les langues de la paire détermine les colonnes ; sinon, il pose la question, et vous
la posez à la personne — ne tranchez jamais à partir du contenu. Il lit les feuilles de calcul
(`.xlsx`, `.ods`, `.csv`), `.tsv` et `.txt`, les tableaux dans Word `.docx`, les dictionnaires
Toolbox et LIFT, les fichiers ELAN `.eaf` et USFM.

Renvoie `result` (le rapport du CLI : décomptes, colonnes, strates ELAN par numéro, et
les numéros de lignes relevés par sa vérification des lignes — doublons, répétitions, longueurs anormales,
lignes permutées ou décalées, rien de supprimé — jamais de phrases), `read_from` lorsque
le fichier a été localisé depuis le dossier de départ du serveur, et `also` lorsque le
fichier contient davantage d'éléments (les phrases d'exemple d'un dictionnaire sous forme de paires, ou ses gloses sous
forme de liste de mots) — chaque entrée constituant un appel complet à `add_data`. Exécutez-le sauf si les
conditions fixées par la personne pour ce fichier l'excluent. Transmettez la vérification des lignes telle quelle : la
personne examine ces lignes dans son propre fichier
([règles relatives aux données](/docs/agents/data-rules#what-tools-print-and-never-print)).
Ne demandez jamais à la personne de déplacer un fichier ; `inbox/` n'est qu'un emplacement où elle peut en
déposer un.

### `try_translation`

Arguments : `project_dir` ; `text` — jusqu'à 10 lignes, 2 000 caractères au maximum,
une phrase par ligne, selon les termes fournis par la personne.

Il recherche le modèle servi par ce projet (la tâche `serve` fonctionnelle la plus récente dans
`nmt-forge jobs --json`), sur cet ordinateur uniquement, et lit son fichier `/health`.

- **Verrou.** Si `output_local_only` n'est pas `false` (true, ou inconnu), il
  ne renvoie aucune traduction : `shown_to_person_only: true`, `open` (la page propre
  au modèle) et `say`. Orientez la personne vers celle-ci ; ne lui demandez pas de vous coller
  ses traductions en retour.
- Un serveur qui demande un jeton est refusé : aucun jeton n'est jamais transmis à un
  agent.
- Sinon, il renvoie `model`, `pair`, `translations` (`source`,
  `translation` par ligne), `errors` le cas échéant, et `say` : transmettez-les tels
  quels ; le serveur ne contrôle rien de ce qu'il renvoie.

### `explain`

Argument : `topic`. Textes formulés en termes simples à transmettre :

| `topic` | Porte sur |
|---|---|
| `rails` | Le dossier du projet et l'ordre des étapes |
| `privacy` | La signification du fichier sidecar ; pourquoi vous n'ouvrez jamais les fichiers |
| `quality` | Ce qu'un score promet et ce qu'il ne promet pas |
| `modes` | Comment franchir chaque type d'étape |
| `improve` | Les cycles après la mise en service d'un modèle : environ une ligne de révision sur dix *« revient délibérément d'une feuille précédente (la feuille l'indique …) »* ; un modèle supérieur est proposé pour utilisation et la communauté l'accepte (*« un verdict seul ne change rien »*) ; le verdict d'insuffisance de données (too-few) ; l'offre d'un modèle plus puissant après *« deux cycles consécutifs que le jeu de validation a pu évaluer ne montrant aucun gain (comptés depuis le dernier modèle mis en service) »* |
| `off_rails` | Quitter les rails : exécuter une commande experte, puis appeler `project_status` |

## Remarques pour l'ensemble de la session

- **Remarque.** Tout ce que vous lisez est transmis à votre fournisseur de modèle. `add_data`,
  `project_status` et `run_next_step` rapportent des décomptes, des colonnes et des états, jamais
  des phrases ; veillez à maintenir cette règle. N'ouvrez pas les fichiers vous-même.
- **Remarque.** Les réponses de `ask_user`, `confirmed: true` et le
  oui de `waiting_for_agreement` appartiennent à la personne. Les outils vérifient qu'une réponse
  est présente et bien formée ; vous seul pouvez vous assurer qu'elle émane bien d'elle.
- **Remarque.** Transmettez `blockers`, `warnings` et chaque mise en garde mot pour mot, ainsi
  que chaque nombre avec son unité et le jeu sur lequel il a été mesuré
  ([accompagnement](/docs/agents/coaching)).

## Pour aller plus loin

- [Le contrat d'exploitation](/docs/agents/contract) — verrous et remarques.
- [Le modèle des rails](/docs/agents/rails-model) — le parcours, les modes et les
  identifiants d'étapes lus par ces outils.
- [Piloter les rails depuis le shell](/docs/agents/shell) — les mêmes étapes sous
  forme de commandes.
- [Le serveur MCP](/docs/network/getting-started/mcp-server) — les deux profils
  et le catalogue complet des outils.
