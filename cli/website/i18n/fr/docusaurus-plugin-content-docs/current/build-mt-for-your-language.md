---
slug: /build-mt-for-your-language
title: "Développer un système de traduction automatique pour votre langue"
description: "De « Par où commencer ? » à un flux de travail de traduction éprouvé : identifiez l'existant, protégez votre jeu de test, évaluez les options, concevez une solution plus performante, faites-en la preuve et déployez-la — avec les commandes exactes et les appels d'outils MCP pour chaque étape."
---

# Créer une traduction automatique pour votre langue

Cette page vous guide depuis *« nous voulons la traduction pour notre langue — par où
commencer ? »* jusqu'à un flux de traduction que vous avez **évalué sur vos
propres phrases** et mis en production. Elle est conçue pour les humains et
pour les agents IA : chaque étape indique la commande à exécuter et,
lorsqu'il existe, l'[outil MCP](/docs/network/getting-started/mcp-server)
qu'un agent peut appeler à la place.

Deux exemples récurrents :

- **Une école** souhaite traduire de l'anglais vers le cri des plaines pour son
  bulletin d'information et une petite application. Les enseignants ont vérifié
  quelques centaines de phrases et souhaitent les garder privées.
- **Un hôpital** souhaite traduire de l'anglais vers une langue que l'index
  couvre à peine, pour un lexique de chevet. Ses phrases de test contiennent
  des formulations cliniques et ne doivent jamais être transmises à un
  service d'IA externe.

Vous obtiendrez : un jeu de test privé, des scores pour plusieurs méthodes
appliquées à celui-ci, une méthode supérieure (un modèle guidé ou que vous
avez entraîné vous-même), et cette méthode déployée via la CLI — chaque
chiffre étant traçable jusqu'à sa source.

:::info[Ce que ceci ne fait pas]
Rien ici ne rend une traduction automatiquement correcte. Les scores vous
indiquent quelle option est *la moins erronée sur vos phrases* ; une personne
parlant couramment la langue décide toujours de ce qui est prêt à l'emploi.
Veuillez lire les [Limites en toute franchise](/docs/network/honest-limitations)
avant de vous fier au moindre chiffre.
:::

:::warning[Agents : avant d'ouvrir le moindre fichier de l'utilisateur]
Si un jeu de test risque d'être privé (vérifié par des enseignants, des
infirmiers, ou tout contenu qu'une communauté n'a pas publié), ne le lisez
pas — aucun `cat`, `head` ni aperçu, pas même pour vérifier son
format. Tout ce que vous lisez est transmis à votre fournisseur de modèles.
Demandez d'abord à l'utilisateur et marquez-le comme local uniquement
([étape 2](#2-gather-your-data--and-protect-your-test-set)).
:::

## 0. Installation

```bash
npm install -g champollion        # translate + deploy        (Node 20.11+)
python3 -m pip install mt-eval-harness       # measure                   (Python 3.11+)
python3 -m pip install 'nmt-forge[hf]'       # train a model (optional; a CPU is enough to start)
```

Pour un agent, ajoutez le serveur MCP à sa configuration :

```json
{
  "mcpServers": {
    "champollion": { "command": "npx", "args": ["-y", "champollion-mcp-server"] }
  }
}
```

## 1. Découvrir ce qui existe

Ce qui est déjà connu au sujet de la langue — dictionnaires, grammaires,
corpus, analyseurs (FST), modèles, résultats publiés, services — et la
provenance de chaque élément.

```bash
champollion network card crk                 # the cited language card
champollion network recommend eng crk        # methods you can run, with the evidence for each
mt-eval corpora --source eng --target crk   # registered test sets for the pair
nmt-forge discover crk               # what a training project can use
```

**Agent :** `search_languages { "query": "Atya" }` trouve le code même à partir d'une
faute d'orthographe (noms les plus proches par distance d'édition). Chaque
résultat n'indique le lieu où la langue est parlée que si sa fiche cite une
source à ce sujet, et affiche cette source afin que l'utilisateur puisse
choisir entre des langues aux noms proches. Une localisation sans source n'est
jamais affichée : la ligne l'indique et renvoie plutôt vers la fiche Glottolog
de la langue, où les candidats peuvent être comparés à la source. Depuis une
installation npm, une langue située en dehors de l'ensemble de base inclus est
renseignée à partir des tables de fiches publiées de champollion.dev, qui ne
comportent pas encore de sources par champ (elles arriveront lors de la
prochaine mise à jour des tables) ; sa ligne comporte donc le lien Glottolog
plutôt qu'une localisation. Lorsque rien dans les éléments affichés ne permet
de départager les candidats, ce sont les locuteurs qui décident (ci-dessous).
Ensuite, `language_overview { "code": "<code>" }` produit une page synthétique : ce qui
existe, les références (benchmarks) et résultats disponibles, ainsi que les
prochaines étapes numérotées. Tout outil acceptant une langue l'accepte
également sous la forme `language`.

Lisez la fiche telle qu'elle est rédigée : **l'absence d'information
signifie inconnu, pas zéro.** Une fiche ne mentionnant aucun dictionnaire
signifie que l'index n'en a enregistré aucun — et non qu'il n'en existe pas.
Lorsque les sources divergent (ce qui est souvent le cas pour le nombre de
locuteurs), la fiche les mentionne toutes.

Si votre langue ne possède aucune fiche, vous pouvez tout de même effectuer
l'ensemble des étapes ci-dessous ; les outils en savent simplement moins à son
sujet (`nmt-forge init <code> --no-card --name <name>` démarre un projet d'entraînement
malgré tout).

### Lorsque la variété n'est pas encore confirmée

Un même nom peut correspondre à plusieurs langues. Par exemple, « Ayta »
correspond à six langues ayta des Philippines, chacune ayant son propre code.
**Consultez d'abord les locuteurs.** La communauté sait quelle variété elle
parle, et lui attribuer un code arbitrairement constitue une affirmation sur
son identité.

Si vous devez commencer avant d'avoir obtenu leur réponse, utilisez un code à
usage privé : l'ISO 639 réserve `qaa` à `qtz` précisément à cette
fin. Attribuez-lui un nom d'affichage pour que les prompts et les rapports
nomment la langue :

```bash
champollion init --yes --langs qaa --name qaa="Ayta (variety not yet confirmed)"
```

ce qui inscrit, dans `champollion.config.json` :

```json
"languages": { "qaa": { "name": "Ayta (variety not yet confirmed)" } }
```

`init` indique que le code est à usage privé et sans fiche de langue
(il ne vous demande pas de vérifier l'orthographe).

`init`, `sync`, `verify` et `network register-corpus` acceptent tous un
code à usage privé. Voici ce que cela implique, jusqu'à ce que le code réel
vienne le remplacer :

- **Aucune donnée de fiche.** Pas de préréglages de registre, de règles de
  pluriel ou d'écriture issus d'une fiche de langue. La synchronisation
  utilise des paramètres génériques, vérifiez donc les premiers résultats
  auprès d'un locuteur.
- **Aucun FST.** Aucun analyseur morphologique n'étant rattaché à un code à
  usage privé, rien n'est vérifié mot à mot.
- **Aucun résultat antérieur.** Les bancs d'essai publiés et la file d'attente
  sont indexés par des codes réels, de sorte que `recommend` et
  `corpora` n'ont rien à afficher pour celui-ci.

Lorsque la communauté confirme la variété, passez à son code officiel :

1. Dans `champollion.config.json`, remplacez `qaa` par le code (et supprimez
   `name` si le nom de la fiche convient).
2. Renommez les fichiers de locale (`messages/qaa.json` → `messages/ayt.json`). Les
   traductions restent valides : la prochaine exécution de `champollion sync` les
   conserve et ne traduit que les nouveautés.
3. Enregistrez de nouveau le jeu de test sous la véritable paire :
   `champollion network register-corpus --pair "eng>ayt" --data <file> --role test …`.
   La commande affiche l'argument `--id` à transmettre, car un fichier enregistré
   conserve son identifiant à moins que vous n'en choisissiez un nouveau.
   (`--pair` accepte `eng-ayt` ou `"eng>ayt"` ici ainsi que dans `nmt-forge init` ;
   placez la forme `>` entre guillemets, car un shell interprète un
   `>` brut comme une redirection d'écriture vers un fichier.)

## 2. Rassembler vos données — et protéger votre jeu de test

**Isolez le jeu de test en premier.** Mettez de côté les phrases sur lesquelles
vous baserez toutes vos évaluations (celles vérifiées par les enseignants ou
les infirmiers) avant d'entraîner ou d'ajuster quoi que ce soit, et ne
réalisez jamais d'entraînement dessus.

Un jeu de test est un fichier TSV : une paire de phrases par ligne, la source,
une tabulation (TAB), puis la traduction de référence. Les lignes commençant
par `# ` sont des commentaires.

```text
# teacher-checked, 2026 term 1
The library opens at nine.	<the teacher's translation>
```

Décidez ensuite de son périmètre de diffusion :

| Vous souhaitez… | Procédez ainsi |
|---|---|
| Que rien ne quitte cette machine — aucun service d'IA externe ne doit voir ces phrases | Placez un fichier marqueur à côté (ci-dessous). Seul un modèle situé sur votre propre machine pourra être évalué dessus. |
| Que les tiers puissent voir que le jeu de test existe, mais jamais son contenu | `champollion network register-corpus --tier private --role test …` n'enregistre que les métadonnées |
| Organiser une compétition dessus, exécutée sur une machine sous votre contrôle, potentiellement isolée du réseau (air-gap) | `--tier sealed` ainsi que le [nœud souverain](/docs/network/sovereignty/sovereign-eval-node) |
| Qu'il soit public et sous licence libre | `--tier public` pointe vers son emplacement ; nous ne l'hébergeons jamais |

Le marqueur indiquant « ne quitte jamais cette machine » :

```bash
echo '{"transmission": "local-only"}' > data/nurse_checked_test.tsv.champollion.json
```

Une fois celui-ci en place, `mt-eval run` rejette tout fournisseur distant
pour ce fichier et s'exécute uniquement contre un modèle en boucle locale
(loopback). Détails :
[Enregistrement de corpus](/docs/network/sovereignty/registering-corpora).

**Quel identifiant de licence choisir.** L'enregistrement demande
`--license` : les conditions réellement accordées par les propriétaires
des données, jamais une valeur fictive. Consultez-les, puis choisissez
l'identifiant qui y correspond : un identifiant SPDX s'ils publient déjà le
texte sous une licence répertoriée ; `community-eval-grant-nc` pour « uniquement
pour évaluer des systèmes, jamais pour l'entraînement, jamais de partage,
aucune évaluation payante » ; `community-eval-grant` pour la même chose avec
évaluation payante autorisée ; `proprietary` pour tous droits réservés ;
ou `LicenseRef-<name>` pour des conditions personnalisées. Les quatre derniers
sont des identifiants `LicenseRef-…`, des concessions sur mesure : toute
évaluation distante sur ces données est refusée tant que le responsable n'a
pas enregistré d'autorisation. Tant que le responsable ne confirme pas,
enregistrez votre choix comme provisoire. Le mode strictement local reste local
quelle que soit la licence : c'est le marqueur, et non la licence, qui régit
la destination des phrases.
[Quel identifiant de licence pour un jeu de test privé](/docs/network/sovereignty/registering-corpora#which-licence-id-for-a-private-test-set).

**Agents : ne lisez pas un fichier de test strictement local.** Pas de
`cat`, `head` ni d'ouverture pour y jeter un coup d'œil. Tout
ce que vous lisez est transmis à votre fournisseur de modèles, c'est-à-dire
précisément là où le marqueur interdit que ces phrases soient envoyées. Vous
n'en avez d'ailleurs pas besoin : les outils excluent ses phrases de ce
qu'ils affichent (`mt-eval compare` affiche à la place les identifiants d'entrées
et les scores), et `--show-text` n'est destiné qu'à une personne présente
devant le terminal.

**Agent :** `language_overview { "code": "<code>" }` répertorie les options de protection pour la
langue ; `run_benchmark` respecte le marqueur et renvoie un refus (avec le motif)
au lieu d'envoyer des phrases protégées à l'extérieur.

### Si vous prévoyez d'entraîner un modèle ultérieurement : enregistrez, filtrez, prédisez — avant toute évaluation

Effectuez ces trois actions dès maintenant, dans cet ordre, avant que l'étape 3
ne mesure quoi que ce soit sur le jeu de test. Forge comptabilise chaque
consultation d'un jeu de test, et un benchmark (étape 3) constitue une lecture
avec attribution de score : tout préenregistrement rédigé après coup sera
refusé. L'ordre est essentiel ; le faire plus tard n'a pas la même valeur.

1. **Enregistrez le jeu de test auprès de NMT Forge.** Son journal de lecture
   commence ici, de sorte que chaque lecture ultérieure est comptabilisée (une
   lecture de score effectuée avant l'enregistrement est répertoriée, mais pas
   décomptée).
2. **Filtrez votre corpus d'entraînement par rapport à celui-ci** (`leak-audit`).
   Cela lit le jeu de test pour un audit, jamais pour un score, et n'est donc
   pas décompté de vos prédictions. Prenez connaissance du verdict : si la
   plupart des lignes de test ont un quasi-doublon dans votre corpus, un modèle
   entraîné sur l'ensemble des données évaluera la mémorisation de phrases
   d'entraînement, et non la traduction. Vous entraînerez alors généralement
   deux modèles : un sur l'ensemble des données, et un sans doublons
   (`--drop-test-twins` génère son corpus et sa configuration, `config-notwins.json`).
3. **Notez vos attentes, un préenregistrement par modèle prévu**, nommé d'après
   le modèle. C'est à ces prédictions que les scores de test seront comparés
   ultérieurement : l'exportation évalue chaque modèle par rapport à celui
   que vous désignez avec `--prereg <id>` (s'il y en a deux sur un même jeu de
   test, il refuse de deviner). Vous pouvez également associer une prédiction
   à la configuration de son modèle avec `--config-hash <hash>`, le hachage complet
   affiché par `nmt-forge preflight run --config config-notwins.json`. Toute modification ultérieure de cette configuration
   (un budget temps, par exemple) modifie le hachage et rompt l'association ;
   nommer le préenregistrement lors de l'exportation reste donc la méthode la plus
   simple.

```bash
nmt-forge init crk --dir school-crk
cd school-crk
nmt-forge registry add project-test ../data/test.tsv --role test
nmt-forge leak-audit ../data/corpus.tsv --clean-to corpus.clean.jsonl
nmt-forge prereg template --out predictions.json      # edit it: what you expect, and why
nmt-forge prereg new all-data --eval-set project-test --predictions predictions.json
cd ..                                                 # step 3 runs from here
```

Si le verdict était SEVERE, ajoutez le modèle sans doublons et ses propres
prédictions (dans `school-crk/`) :

```bash
nmt-forge leak-audit ../data/corpus.tsv --clean-to corpus.notwins.jsonl --drop-test-twins
nmt-forge prereg new notwins --eval-set project-test --predictions predictions-notwins.json  # your edited copy
```

Le corpus sans doublons est enregistré dans un fichier distinct. `corpus.clean.jsonl`
reste le corpus contenant toutes les données : leak-audit refuse d'écraser un
fichier lu par une configuration, une exécution ou un découpage, ou généré par
un autre audit (`--overwrite` permet d'en remplacer un intentionnellement). Sa
réponse dans `--json` liste les premiers numéros de ligne de chaque
liste ; le fichier `.audit.json` situé à côté du corpus nettoyé les conserve
tous.

`--allow-after-reads` n'existe que pour les prédictions qui ont été véritablement
consignées par écrit avant les lectures (sur papier, par exemple). Cela est
enregistré, et chaque rapport, export and DEPLOY.md then says the predictions came after the scores.

**Agent :** `forge_init { "code": "<code>", "dir": "<dir>" }`, puis
`forge_register_eval { "name": "project-test", "path": "../data/test.tsv", "role": "test", "project_dir": "<dir>" }`,
`forge_leak_audit { "corpus": "../data/corpus.tsv", "clean_to": "corpus.clean.jsonl", "project_dir": "<dir>" }`
(les chemins sont lus depuis `project_dir`, car les commandes ci-dessus sont
exécutées depuis l'intérieur du projet ; un chemin absolu fonctionne partout),
puis `forge_prereg_template` → `forge_prereg { id, eval_set, predictions }`
avec l'utilisateur, un par modèle, chacun portant le nom de son modèle
(`forge_export` prend alors cet identifiant comme `prereg` ; `config_hash`
sur `forge_prereg` permet plutôt d'en lier un à sa configuration).
`forge_status` mentionne cette étape dès qu'un jeu de test est enregistré.
L'étape 4 effectue l'entraînement au sein du même projet.
`language_overview` liste également ces étapes dans cet ordre.

## 3. Évaluer les options

Exécutez chaque candidat sur **votre** jeu de test (enregistré, filtré et
préenregistré au préalable avec forge si vous prévoyez un entraînement ultérieur —
[étape 2](#2-gather-your-data--and-protect-your-test-set)). Le banc d'évaluation
note chacun de la même façon, selon les standards d'évaluation en TA :
l'indicateur principal est le chrF++ au niveau du corpus avec son intervalle
de confiance à 95 %, accompagné de BLEU, spBLEU et TER (jamais combinés en un
chiffre unique). La correspondance exacte et les contrôles comportementaux
(sortie dans une mauvaise écriture, signaux d'hallucination) sont rapportés
sous forme de diagnostics, aux côtés du coût et de la vitesse. Lorsque le banc
dispose d'un analyseur morphologique assigné à la langue, il ajoute
l'acceptation FST et la précision morphologique comme diagnostics ;
`mt-eval setup --status` répertorie ces langues, et `mt-eval setup --comet`
ajoute COMET là où il est applicable.

```bash
# a hosted model (needs OPENROUTER_API_KEY); --max-cost stops before spending more
mt-eval run --corpus data/test.tsv --source-lang English --target-lang "Plains Cree" \
  --target-lang-code crk --provider openrouter --model google/gemini-3.8-flash \
  --max-cost 1 -n gemini-3.8-flash -o results

# a model on your own machine (Ollama, llama.cpp, vLLM — anything OpenAI-compatible)
mt-eval run --corpus data/test.tsv --source-lang English --target-lang "Plains Cree" \
  --target-lang-code crk --provider local --base-url http://127.0.0.1:11434/v1 \
  --model llama3.1 -n local-llama -o results

mt-eval compare results/*_report.json --significance
```

`compare` indique si une différence est significative ou relève du bruit
statistique (randomisation approximative appariée). Une différence située à
l'intérieur des intervalles de confiance ne constitue pas un classement. Il
écrit `comparison-<hash>.json`, nommé d'après les exécutions comparées, à côté des
rapports lorsqu'ils partagent un dossier, ou dans un dossier `comparisons/`
situé au-dessus d'eux lorsqu'ils ne le partagent pas, jamais dans le dossier
propre d'une seule exécution. Une autre comparaison ne l'écrase jamais.

**Packs d'évaluation.** Certaines langues requièrent des outils supplémentaires
pour leurs métriques (pour le cri des plaines, un analyseur morphologique). Le
premier `mt-eval run` indique ce qui manque. Un analyseur manquant n'interrompt
jamais l'exécution : l'acceptation FST est marquée comme non calculée,
`mt-eval setup --lang crk` l'installe (une seule fois par machine), puis
`mt-eval test <run log>` ajoute le score sans retraduire.

**Agent :** `run_benchmark { "corpus": "data/test.tsv", "provider": "local",
"base_url": "http://127.0.0.1:11434/v1", "model": "llama3.1",
"target_language": "crk" }` plans first and runs only with `confirm: true` ;
`get_run_status { "job_id": "<id>" }` renvoie les scores. Il ne publie rien à moins que vous ne
passiez `publish: true`. Un code sous la forme `target_language` est résolu avec
son nom d'après sa fiche de langue (« Plains Cree ») avant d'atteindre le
prompt, et le plan affiche le prompt que le modèle recevra. Un fichier
d'instructions (coaching) remplace ce prompt, et le plan le précise. Lorsque la
fiche mentionne deux écritures et que vous ne fournissez aucun `script`,
le plan identifie l'écriture utilisée par les références (caractères dénombrés
sur votre machine, aucune phrase n'est transmise) et demande celle-ci. Ses
rapports sont générés à côté du fichier de test, dans `data/results/mcp-run-<id>/`, avec le
cache de traduction du banc dans `data/results/cache/`. `get_run_status` affiche la
commande `mt-eval compare` correspondante, et pour les exécutions basées sur un
identifiant de corpus enregistré, il liste les rapports par chemin d'accès. Un
plan `local-model` précise d'abord le volume téléchargé lors de la
confirmation, ainsi que la destination.

**À quelle métrique se fier** dépend de la langue :
`get_metric_reliability { "language": "<code>" }` (MCP) indique si une métrique automatique a déjà été
validée par rapport à des jugements humains pour celle-ci. Pour la plupart
des langues à faibles ressources, aucune ne l'a été ; chrF++ constitue donc
la convention — interprétez-la comme une comparaison entre des méthodes sur
un même jeu de test, et non comme une note absolue.

## 4. Construire une solution supérieure

Deux voies possibles. Évaluez-les toutes deux de la même manière qu'à
l'étape 3.

**Guider un modèle généraliste.** Fournissez-lui un glossaire et des
consignes, puis réexécutez l'étape 3 avec ces instructions :

```bash
mt-eval run --corpus data/test.tsv --source-lang English --target-lang "Plains Cree" \
  --target-lang-code crk --provider openrouter --model google/gemini-3.8-flash \
  --coaching-file coaching.json -n gemini-coached -o results
```

`--coaching-file` accepte du Markdown, du texte brut ou du JSON ; l'intégralité
du texte du fichier constitue les instructions du modèle, transmises telles
quelles.

Pour évaluer la terminologie (chaque terme répertorié ressort-il avec la
traduction requise ?), fournissez à chaque exécution comparée la même liste
de termes avec `--glossary terms.json` (`{"blood pressure": "…"}`, ou une liste de formes
acceptées par terme). Le glossaire ne sert qu'à l'évaluation ; il n'est
jamais transmis au modèle, ce qui permet d'évaluer une exécution brute et une
exécution guidée sur les mêmes termes. Sans `--glossary`, le champ
`dictionary` d'un fichier de guidage JSON (la structure de
[prompting guidé](/docs/network/tutorials/coached-llm-prompting) :
`grammar_rules`, `dictionary`, `style_notes`) est utilisé à la place. Dans
ce cas, l'exécution est évaluée par rapport à son propre guidage, et la
sortie l'indique. Un fichier de guidage en Markdown guide de la même manière,
mais ne fournit aucun glossaire.

Consultez le [prompting guidé](/docs/network/tutorials/coached-llm-prompting) et
le [prompting enrichi par dictionnaire](/docs/network/tutorials/dictionary-augmented-llm).

**Entraînez votre propre modèle** avec NMT Forge, qui prévient les erreurs
faisant paraître les résultats sur petits volumes de données meilleurs qu'ils
ne le sont réellement (fuite de phrases de test, mauvais découpages, sélection
du point de contrôle sur le jeu de test, interprétation du bruit comme une
progression) :

```bash
cd school-crk     # after step 2: registered, screened, preregistered
nmt-forge split corpus.clean.jsonl --test 0 --dev 100 --seed 42 --out data/split --register project
nmt-forge preflight run --config config.json          # every check run makes, with fixes
nmt-forge run config.json
nmt-forge export .forge/runs/<run>/run-manifest.json --prereg all-data --out export/
```

`preflight run` effectue les vérifications que `run` réalise avant
l'entraînement — le jeu de validation (dev set), l'audit de fuite de chaque
fichier d'entraînement, la longueur de décodage — afin qu'une exécution qu'il
valide ne soit pas rejetée au démarrage. `config.json` lit le découpage
depuis `data/split/` ; un découpage enregistré ailleurs indique les lignes à
modifier.

Les paires d'entraînement sont placées dans un fichier TSV similaire au jeu de
test (ou JSONL avec `source` et `target`) ; `leak-audit` (étape 2)
a exclu toutes celles qui risquaient de faire fuiter le jeu de test dans
l'entraînement, avec des explications pour chacune. Deux modèles ? Après le
découpage, réexécutez l'audit de fuite sans doublons de l'étape 2 (le jeu de
validation étant enregistré, ses lignes sont également retirées du fichier
sans doublons), puis `nmt-forge run config-notwins.json` et
export it to its own folder with `--prereg notwins`. `nmt-forge status` names
la commande suivante à tout moment. Le modèle par défaut s'entraîne sur
processeur (CPU) en quelques minutes ; sur 1 à 2 milliers de paires de
phrases, comptez sur un chrF++ d'environ 5 à 30 — il apprend les expressions
et structures de vos données, et non la langue en général. `export`
évalue le jeu de test une fois et rédige un rapport mt-eval, permettant ainsi
de comparer le modèle entraîné à tous les éléments de l'étape 3. Guide complet :
[Entraîner votre premier modèle](/docs/network/getting-started/train-your-first-model).

**Agent :** `forge_status { "project_dir": "<dir>" }` en premier et après chaque
étape ; après `forge_init`, `forge_register_eval`, `forge_leak_audit`
et `forge_prereg` de l'étape 2 : `forge_split { corpus, test, seed, out }`,
`forge_preflight { "target": "run" }`, puis — après `nmt-forge run` dans un
terminal — `forge_export { run_manifest, out, prereg }`. Appelez
`get_training_guardrails` une fois avant `forge_split` : il énumère chaque règle
imposée par forge et l'erreur que cette règle prévient. Le paramètre
`register` de `forge_split` prend un préfixe ou `true`
(`project`), et `out` vaut par défaut `data/split`. Chaque
outil forge après `forge_init` prend le `project_dir` renvoyé par celui-ci.
`get_training_guardrails` (avec `topic` optionnel) explique chaque règle. Pour
chaque argument de chaque outil :
[Serveur MCP](/docs/network/getting-started/mcp-server#arguments).

## 5. Faire la preuve des résultats — en privé ou publiquement

Vos scores vous appartiennent. Rien n'est publié à moins que vous ne le
décidiez.

```bash
mt-eval publish results/<run-id>_report.json --dry-run   # shows exactly what would leave, and what is withheld
mt-eval publish results/<run-id>_report.json --scores-only --prod
```

Un jeu de test privé ou strictement local ne téléverse jamais ses phrases ;
`--dry-run` le confirme ligne par ligne. Pour permettre à des tiers de
se mesurer sur votre jeu de test sans jamais le voir, organisez une compétition
sur une machine sous votre contrôle : les participants soumettent leur
méthode, celle-ci s'exécute sur votre nœud, et seuls les scores en sortent.
Les nouvelles compétitions masquent l'ensemble des scores jusqu'à leur
clôture, de sorte que personne ne peut s'ajuster sur votre jeu de test. Voir
[Organiser une compétition souveraine](/docs/network/sovereignty/run-a-sovereign-contest).
Pour inscrire un modèle que vous avez entraîné au concours d'un tiers, la
section §6 de `DEPLOY.md` dans son export indique les fichiers constituant
la soumission ainsi que la commande exacte `mt-eval contest submit-model`.

**Agent :** `list_contests { "language": "<code>" }`, `get_contest { id }` ;
`get_results { "target_language": "<code>" }` et `get_run_card { id }` pour
le tableau public.

## 6. Combiner le meilleur

**Faites d'abord votre choix parmi vos propres mesures.** Tout ce que vous avez
évalué sur votre jeu de test constitue un rapport mt-eval : les références de
base et les exécutions guidées des étapes 3 et 4, ainsi que l'export de chaque
modèle entraîné (`evaluation/runlog_report.json` dans son
export folder). A terminal run with `-o results` writes to
`results/*_report.json` ; une exécution lancée avec le MCP `run_benchmark` écrit
à côté du fichier de test, dans `data/results/mcp-run-<id>/`). Comparez-les tous
simultanément — le premier motif générique (glob) pour les exécutions en
terminal, le second pour celles d'un agent (utilisez celui qui correspond à
vos exécutions ; zsh s'interrompt sur un motif ne correspondant à rien) :

```bash
mt-eval compare results/*_report.json school-crk/export*/evaluation/runlog_report.json --significance
mt-eval compare data/results/mcp-run-*/*_report.json school-crk/export*/evaluation/runlog_report.json --significance
```

Une différence située à l'intérieur des intervalles de confiance ne constitue
pas un classement, et un modèle entraîné dont les lignes de test comportent
des quasi-doublons dans ses données d'entraînement a été noté sur sa
mémorisation : indiquez son résultat sans doublons à ses côtés (DEPLOY.md et
`nmt-forge report` précisent lequel), ainsi que toute **mise en garde sur le
score** (score caveat) formulée par mt-eval. Une mise en garde de type
*near-constant output* (sortie quasi constante, où une poignée de phrases est
renvoyée pour de nombreuses phrases de test distinctes) signifie que les
sorties ne suivent pas les entrées, quel que soit le score ; forge l'affiche
à côté du score dans `export`, `DEPLOY.md`, `status`,
`report`, `compare` et `lint`. Lorsque plusieurs modèles
sont exportés, `nmt-forge status` liste chacun avec son score, son score sans
doublons et sa mise en garde, puis vous demande de choisir celui à déployer.
Enregistrez votre choix avec `nmt-forge choose <export>/model` (ou `nmt-forge serve
<export>/model --choose`). Servir un modèle pour le tester est
consigné comme servi, et non comme votre choix définitif ; `status`
continuera donc de poser la question tant que vous n'aurez pas choisi.

**Agent :** `forge_status { "project_dir": "<dir>" }` — dans l'état
`choose-export`, présentez à l'utilisateur `result.advice.exports`, le score de chaque
export avec son `score_caveats`, et demandez-lui quel modèle déployer ; la
réponse de l'utilisateur est enregistrée avec `nmt-forge choose` dans un terminal.
Un service provisoire ne répond pas à la question. `forge_compare { eval_set, hyps_a, hyps_b }` compare en
A/B deux modèles forge en affichant pour chacun la mise en garde sur les
quasi-doublons et les mises en garde de score mt-eval à côté du vainqueur ; le
fichier d'hypothèses de chaque modèle correspond au chemin `hypotheses`
renvoyé par `forge_export` (`<export>/evaluation/battery-hyps.jsonl`).

Regardez ensuite au-delà de vos propres exécutions. Selon la paire de langues
et le type de texte, différentes méthodes s'avèrent gagnantes. Le
[Réseau](/docs/network/) répertorie les méthodes et services existants ainsi
que les preuves associées à chacun — ce qui a été publié, et non ce que vous
avez vous-même mesuré :

```bash
champollion network recommend eng crk               # runnable methods + cited evidence for the pair
champollion network leaderboard --pair "eng>crk"     # published results for the pair
```

Une méthode publiée sur le tableau de classement avec sa configuration peut
être installée exactement telle qu'elle a été évaluée : `champollion network
leaderboard --install <method> --apply` l'ajoute à votre projet pour
cette paire. La CLI configure une méthode **par paire de langues** ; ainsi,
le cri du bulletin d'information peut utiliser votre modèle entraîné tandis que
le français utilise un modèle hébergé. Le chaînage de méthodes (par exemple
un modèle suivi d'un vérificateur) est traité dans
[Modèles chaînés](/docs/network/tutorials/chained-models).

## 7. L'utiliser

Déployez la méthode que vous avez évaluée — pas une autre.

```bash
nmt-forge serve export/model                     # your trained model on http://127.0.0.1:8378
LOCAL_API_BASE=http://127.0.0.1:8378/v1 champollion sync --method local
```

Pendant son exécution, `nmt-forge status` affiche `serving` (il vérifie que
le serveur répond toujours) ; une fois le serveur arrêté, il indique à nouveau
la commande `serve`, sur le même port.

Ou bien, pour un modèle hébergé guidé, configurez-le sur la paire dans
`champollion.config.json`. Dans les deux cas :

```bash
champollion init --langs crk     # detects your app's locale files
champollion sync                 # translates only what changed
champollion verify               # placeholders, scripts, key parity
```

**Ce que votre propre modèle ne sait pas encore faire.** Un petit modèle
entraîné sur quelques milliers de phrases mémorise leurs tournures. Il altère
souvent les balises de remplacement (`{name}`), les formes de pluriel et
le balisage, ou transforme un libellé court tel que « Accueil » en une phrase
complète. La barrière de qualité (quality gate) refuse ces sorties ; aucun
élément altéré n'est enregistré. Attribuez une **solution de repli
(fallback)** à la paire, et ces chaînes seront alors transmises à une seconde
méthode au cours de la même synchronisation :

```json
"pairs": {
  "en:crk": {
    "method": "api",
    "endpoint": "http://127.0.0.1:8378/translate",
    "fallback": { "method": "llm-coached", "model": "google/gemini-3.8-flash" }
  }
}
```

Si aucun texte ne doit quitter vos machines, configurez comme solution de
repli un modèle que vous exécutez également en local : `"fallback": { "method": "local", "model": "<your local model>" }` envoie
les requêtes à un serveur compatible OpenAI situé sur cette machine (Ollama,
llama.cpp, vLLM), pour un coût d'API de 0 $. Un modèle hébergé constitue
généralement un second avis plus robuste ; utilisez-le lorsque le texte peut
être transmis à son fournisseur.

Votre modèle traduit tout ce qu'il peut. La solution de repli ne reçoit que ce
que la barrière de contrôle a refusé, ainsi que les blocs Markdown qu'il a omis
ou corrompus, et ses résultats passent par la même barrière de contrôle.
`sync` affiche une ligne `[FALLBACK]` par paire avec les
décomptes, et `champollion verify` liste tout ce qu'aucune des deux méthodes n'a pu
traduire. Voir [Méthode de repli](/docs/getting-started/configuration#fallback).

Pour une opération ponctuelle, traduisez simplement ces chaînes par un autre
moyen :

```bash
champollion sync --method llm-coached --redo keys:nav.home,greeting
```

…ou manuellement, ou par l'intermédiaire d'un réviseur avec `champollion xliff export`.
Et intégrez les chaînes propres à l'application dans votre jeu de test : un
modèle qui obtient de bons scores sur des phrases d'enseignants peut toujours
se tromper sur « Où avez-vous mal ? ».

**Systèmes d'écriture.** Si la langue s'écrit dans plusieurs systèmes
d'écriture (cri des plaines : orthographe romaine standard et syllabaire), la
CLI vous demande de choisir avant de traduire. Définissez `"script"` pour
cette langue dans la configuration ; le message liste les options disponibles.

La mémoire de traduction garantit qu'une phrase inchangée n'est jamais payée
deux fois, et changer de modèle ne retraduit pas l'intégralité du contenu.
Intégrez-la dans votre CI grâce au [guide CI/CD](/docs/guides/ci-cd).
`export/model/DEPLOY.md` (obtenu à l'étape 4) contient la configuration exacte pour un
modèle entraîné, y compris la méthode `api` et la manière de
l'exposer sur un réseau en toute sécurité.

**Agent :** `translate { texts, source_language, target_language }` traite les chaînes via le
même pipeline. Ajoutez `method: "local"` et `base_url`, ou `method: "api"`
et `endpoint`, pour un modèle que vous servez vous-même, ainsi que
`script` pour une langue écrite dans plusieurs systèmes d'écriture.

## Décisions à prendre en cours de route

| Décision | Choisir… | Quand |
|---|---|---|
| Emplacement du jeu de test | local-only | Les données sont sensibles, ou vous n'avez pas consulté leurs auteurs |
| | private / sealed | Vous voulez que les tiers sachent qu'il existe, ou concourent dessus, sans le voir |
| Guider ou entraîner | Guider un modèle hébergé | Vous avez un glossaire et peu de texte parallèle, et les services externes sont acceptables |
| | Entraîner avec forge | Vous avez quelques milliers de paires ou plus, ou les données doivent rester sur vos machines |
| Publication | Scores uniquement | Option par défaut pour tout ce que vous n'avez pas rédigé vous-même |
| | Rien | Toujours autorisé — l'évaluation reste utile en usage privé |

## Coûts associés

- Les outils sont gratuits pour un usage non commercial : une école, un
  hôpital ou une clinique publique, une association caritative ou un projet de
  recherche sont couverts (la CLI, nmt-forge et le serveur MCP sont sous licence
  PolyForm Noncommercial 1.0.0 ; le banc d'évaluation est open source, sous
  licence AGPL-3.0-or-later). [Qui peut utiliser cet outil](/docs/getting-started/who-may-use-this).
- Un modèle hébergé coûte le tarif facturé par son fournisseur ;
  `--max-cost` interrompt une exécution avant qu'elle ne dépasse la limite
  budgétaire autorisée, et le rapport affiche le coût par phrase. Un modèle
  local ne coûte rien d'autre que le temps de calcul de votre machine.
- L'entraînement du modèle forge par défaut ne nécessite qu'un processeur (CPU)
  et quelques minutes ; les préréglages plus volumineux requièrent un
  processeur graphique (GPU).
