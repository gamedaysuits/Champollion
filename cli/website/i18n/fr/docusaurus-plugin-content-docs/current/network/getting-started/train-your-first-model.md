---
sidebar_position: 3
title: "Entraîner votre premier modèle (avec votre agent)"
description: "Un guide pas à pas pour entraîner un modèle de traduction automatique pour langues à faibles ressources en pilotant un agent de programmation — installer, protéger votre jeu de test, entraîner sur le CPU d'un ordinateur portable, évaluer une fois et servir le modèle à la CLI champollion. Ce que vous dites, ce que fait forge, à quoi ressemble un refus."
related:
  - label: "Build MT for Your Language"
    to: /docs/build-mt-for-your-language
    kind: guide
    note: "The whole journey — this page is the forge part of its steps 2 and 4"
  - label: "Train a Model Honestly"
    to: /docs/network/getting-started/training-honestly
    kind: guide
    note: "The why behind every guard in this walkthrough"
  - label: "Diagnosing a Training Run"
    to: /docs/network/getting-started/diagnosing-training
    kind: guide
    note: "Symptom-first: what to do when the numbers disappoint"
  - label: "forge Command Reference"
    to: /docs/network/getting-started/forge-command-reference
    kind: reference
---

# Entraîner votre premier modèle (avec votre agent)

Vous n'avez pas besoin de savoir comment entraîner un modèle de traduction automatique neuronale. Vous devez être capable de **dire à un agent de codage ce que vous voulez** — Claude, ou un modèle de classe Sonnet/Flash, ou tout agent capable d'exécuter des commandes shell. **nmt-forge** est construit pour que l'agent puisse le piloter *mécaniquement* : à chaque étape, l'outil indique exactement à l'agent ce qu'il faut faire ensuite, et refuse — bruyamment, avec une correction — quand une étape risquerait de corrompre vos résultats.

Cette page décrit l'ensemble de la boucle, depuis `pip install` jusqu'à un modèle que la CLI Champollion
peut appeler. Chaque étape est structurée selon **ce que vous dites à votre agent**, **ce que fait forge**, **à quoi ressemble un refus** (afin qu'aucun de vous ne panique lorsqu'un refus se déclenche — un refus signifie que l'outil fonctionne comme prévu) et, à la fin, **comment lire le rapport**. Il s'agit de la composante forge des étapes 2 et 4 du guide [Construire une TA pour votre langue](/docs/build-mt-for-your-language), qui couvre les étapes préalables (identifier ce qui existe déjà), intermédiaires (mesurer les options existantes) et ultérieures (publier, combiner des méthodes).

**L'ordre a son importance.** Enregistrez votre jeu de test, filtrez vos données d'entraînement
par rapport à celui-ci et consignez vos prédictions (Étapes 1 à 3) **avant que quoi que ce soit ne soit
évalué sur le jeu de test** — y compris les références (*baselines*) que l'étape 3 du guide
mesure avec `mt-eval run`. Un benchmark constitue une lecture d'évaluation : forge la comptabilise
et refuse toute prédiction formulée ultérieurement. Ensuite, procédez au découpage (*split*) et à l'entraînement (Étape 4).

:::tip La règle unique pour votre agent
Dites-lui : *« Exécutez toujours `nmt-forge status --json` en premier, et après chaque étape.
Faites tout ce qu'indique son `next_command`. »* Cette simple habitude transforme forge en un
parcours guidé. Chaque commande forge accepte `--json` : exactement un document JSON sur
stdout, et un refus est renvoyé sous la forme `{"error": {…, "why", "fix"}}` avec le code de
sortie 2. Si votre agent se connecte via MCP, la même boucle correspond à l'outil `forge_status`
(`{ "project_dir": "<dir>" }`) — voir le [Guide de l'agent](/docs/network/getting-started/agent-guide).
:::

---

## Étape 0 — Installer et orienter votre agent vers votre langue

**Vous dites :** *« Installez nmt-forge avec son extra d'entraînement. Je veux entraîner un
modèle anglais→[votre langue]. Commencez par découvrir ce que forge sait à son sujet.
Le code ISO 639-3 est `crk` »* (utilisez le code de votre langue).

```bash
python3 -m pip install 'nmt-forge[hf]'      # Python 3.11+; brings mt-eval-harness (the scorer)
```

L'extra `[hf]` ajoute les bibliothèques d'entraînement (torch, transformers, accelerate,
tokenizers, sentencepiece, peft). Les wheels CPU uniquement suffisent pour le modèle
par défaut. Le paquet simple `python3 -m pip install nmt-forge` fournit les garde-fous, les découpages, les audits et
l'évaluation sans l'entraînement.

**forge fait :** `nmt-forge discover crk` lit la fiche (*card*) de la langue — écritures (*scripts*),
dictionnaires, analyseurs morphologiques, corpus et jeux d'évaluation existants (avec tout
drapeau `do_not_train` / de quarantaine éventuel), ainsi que les métriques arbitres propres à la langue. Vous n'avez
pas besoin d'une copie du dépôt Champollion : les fiches sont trouvées dans un répertoire que vous
désignez (`--cards-dir`), une copie locale (*checkout*) ou `node_modules/champollion`, ou dans l'index
public des fiches (mis en cache, ce qui permet de fonctionner hors ligne par la suite). forge positionne ensuite
votre langue sur **l'échelle des ressources** : (1) texte parallèle → entraînement avec garde-fous ;
(2) + monolingue → rétro-traduction balisée ; (3) + dictionnaire/grammaire → données
synthétiques avec citations ; (4) + analyseur → synthèse vérifiée par aller-retour ; (5) + métrique arbitre
→ métrique propre à la langue pour l'évaluation et la sélection des points de contrôle (*checkpoints*).

**Un champ vide signifie INCONNU, jamais zéro.** Une fiche clairsemée ne signifie pas « cette langue n'a rien » — il se peut simplement que la ressource ne soit pas encore enregistrée. Vous pouvez toujours apporter votre propre corpus parallèle.

Puis : *« Initialisez la structure du projet. »*

```bash
nmt-forge init crk --dir school-mt && cd school-mt
```

Cela génère un espace de travail (`.forge/`), un fichier initial `config.json` et un
brief `NEXT_STEPS.md` indiquant l'ordre exact des commandes. **Exécutez toutes les commandes
ultérieures depuis le répertoire du projet** — les chemins de configuration y sont relatifs.

La configuration initiale utilise le profil prédéfini de modèle **`cpu-tiny`**, sauf si vous en choisissez un autre :

| `--model` | Description | Prérequis | Résultats attendus |
|---|---|---|---|
| `cpu-tiny` (par défaut) | un petit transformer (~6M de paramètres) entraîné à partir de zéro (*from scratch*) sur vos paires ; son vocabulaire est appris uniquement à partir de vos lignes d'entraînement | un CPU, aucun téléchargement | faibles : sur 1 à 2 milliers de paires, score chrF++ d'environ 5 à 30 (la fourchette haute uniquement pour des données très répétitives/gabarits). Il apprend les phrases et les structures de vos données, pas la langue en général |
| `cpu-finetune --base <hf-id>` | ajuste finement (*fine-tune*) un petit modèle pré-entraîné Marian/opus-mt que vous spécifiez (choisissez-en un pour une paire de langues *apparentée*) | un CPU, ~300 Mo de téléchargement | généralement meilleur que `cpu-tiny` lorsqu'une paire apparentée existe — mesurez-le sur votre jeu de développement, ne faites pas de suppositions |
| `nllb-600m` | NLLB-200 distillé 600M avec LoRA | un GPU, ~2,5 Go de téléchargement | le point de départ le plus robuste ; la vérification de temps d'horloge de forge le refuse sur un CPU en quelques minutes |

Le profil prédéfini est consigné sous forme de valeurs numériques explicites dans `config.json` → `model`, de sorte
que rien n'est masqué et que la modification d'une valeur crée une nouvelle exécution hachée séparément.

**Aucune fiche pour votre langue ?** `nmt-forge init <code> --no-card --name "<name>"`
génère tout de même la structure du projet ; tout ce qu'une fiche aurait indiqué est enregistré comme
inconnu, et rien n'est inventé.

---

## Étape 1 — Mettre votre jeu de test de côté et l'enregistrer {#step-1--set-your-test-set-aside-then-split}

**Vous dites :** *« Voici mon corpus parallèle et, séparément, le jeu de
test vérifié par un enseignant. Gardez le jeu de test à l'écart de l'entraînement et enregistrez-le avant
que quoi que ce soit ne soit évalué dessus. »*

Les fichiers peuvent être au format `.tsv` (source, une tabulation, puis la traduction, une paire par ligne ;
les lignes commençant par `# ` sont des commentaires) ou `.jsonl` (`{"source": …, "target": …}`
par ligne). Si le jeu de test est privé, marquez-le comme strictement local **avant** que quoi que ce soit
ne le lise — votre agent y compris :
`echo '{"transmission": "local-only"}' > ~/teacher-test.tsv.champollion.json`.
Dès lors, forge n'affiche jamais ses phrases.

**forge fait — si vous disposez de votre propre jeu de test** (le cas habituel pour une école ou
un centre de santé) :

```bash
nmt-forge registry add project-test ~/teacher-test.tsv --role test
```

L'enregistrement initialise le **journal de lecture** du fichier (`<file>.reads.jsonl`) : à partir de cet instant,
chaque évaluation de ce fichier — par forge, ou par `mt-eval run` / `mt-eval compare`
— est comptabilisée. C'est la raison pour laquelle l'enregistrement passe en premier : une exécution de benchmark effectuée
auparavant est répertoriée lors de l'enregistrement, mais n'est pas prise en compte dans le décompte.

**Si vous n'avez pas de jeu de test distinct**, extrayez-en un depuis le corpus à la place —
`nmt-forge split pairs.tsv --test 150 --dev 100 --seed 42 --out data/split
--register project` registers `project-test` and `project-dev` en une seule étape
(l'Étape 4 explique le découpage) — et passez à l'Étape 3.

`nmt-forge status` indique à présent l'étape suivante : les prédictions (Étape 3), avant
tout benchmark — filtrez d'abord votre corpus (Étape 2).

---

## Étape 2 — Dépister les fuites

**Vous dites :** *« Avant de lancer l'entraînement, vérifiez le corpus par rapport au jeu de test et indiquez-moi
ce que vous supprimeriez et pourquoi. »*

```bash
nmt-forge leak-audit ~/pairs.tsv --clean-to pairs.clean.jsonl
```

**forge fait :** il filtre chaque ligne par rapport à chaque jeu dev/test/scellé (*sealed*)
enregistré. Un même corpus et les mêmes jeux enregistrés
donnent systématiquement le même résultat. Il explique ce qu'il **supprimerait** :

- **Invite identique (*prompt*)** — la phrase source de la ligne est identique à la source d'une ligne de test
  (après exclusion de la casse, de la ponctuation et des espaces). Supprimée **même lorsque la traduction
  de la ligne est différente** : le modèle se serait tout de même entraîné sur l'invite exacte
  du test.
- **Réponse identique** — la cible de la ligne est égale à une référence du test.
- **Réponse quasi-doublon** — la cible de la ligne partage au moins 60 % de ses mots
  avec une réponse de test (accents normalisés, de sorte que les variantes orthographiques comptent) **et** soit
  contient l'intégralité de la réponse, en constitue un fragment, soit est identique à au moins 90 %.
  La majeure partie de la réponse aurait ainsi été exposée au modèle.

…et ce qu'il **conserve intentionnellement**, signalé mais jamais supprimé :

- **Variantes de gabarit (*template siblings*)** — la ligne partage une structure de phrase avec une réponse
  de test mais remplace un mot de part et d'autre (*« I see the dog »* / *« I see the cat »*). Le modèle
  doit tout de même produire le mot qu'il n'a jamais vu dans cette structure. Les manuels scolaires et les
  corpus pédagogiques structurés en regorgent. forge répertorie les lignes de test qui possèdent une
  variante dans l'entraînement ; comme la configuration initiale définit
  `eval.near_dupe_corpus`, le rapport final affiche un score **« (strict) »** sur les
  lignes qui n'en ont pas, à côté du score global.
- **Invite similaire, réponse différente** — la source est un quasi-doublon (et non une copie
  identique) d'une source de test, mais la traduction est différente : il s'agit d'une
  paire minimale légitime, non d'une fuite (*leak*).

Voici le rapport pour un corpus d'exemple de 12 lignes filtré par rapport à un jeu de test de 3 lignes
(tronqué ; les phrases de test sont en anglais avec une cible inspirée du français) :

```
leak-audit: pairs.tsv — 12 rows screened against project-test [test, 3 rows]

DROPPED by --clean-to: 4 row(s) — the model would see an eval answer (or prompt)
  • identical PROMPT: the row's source equals an eval row's source ...
      project-test (test): 2
      e.g. line 2 "The library opens at nine." → project-test row 2
      e.g. line 3 "The library opens at nine!" → project-test row 2
  • identical ANSWER: the row's target equals an eval row's reference ...
      project-test (test): 1
  • near-duplicate ANSWER: the row's target overlaps an eval answer and only adds/removes words ...
      project-test (test): 1
      e.g. line 6 "ou est la grande grange rouge maintenant?" → project-test row 3 (contains the whole answer; overlap 0.86)

KEPT on purpose (reported, never removed): 1 row(s)
  • template sibling: shares a sentence frame with an eval answer but swaps a word each way ...
      e.g. line 1 "je vois le chat dans la maison." → project-test row 1 (swaps word(s); overlap 0.75)

Cleaned: 8 row(s) kept → pairs.clean.jsonl (audit manifest: pairs.clean.audit.json)
```

La ligne 3 comporte une traduction *différente* de la ligne de test, et elle est tout de même supprimée :
son invite correspond à l'invite du test.

Les exemples citent les lignes de **votre corpus** par leur numéro de ligne ; le texte du fichier de test
lui-même n'est jamais imprimé, et une ligne qui correspond à un jeu **scellé** (*sealed*) est affichée uniquement
par son numéro de ligne. (Lorsqu'une ligne du corpus est identique à une ligne de test, ou la contient, citer
la ligne du corpus révèle également cette phrase de test — transmettez `--no-examples` si la
sortie est destinée à être partagée.)

`--clean-to pairs.clean.jsonl` écrit les lignes conservées, accompagnées d'un enregistrement
d'audit sans contenu à côté d'elles (`pairs.clean.audit.json`). Filtrez le corpus
**avant** d'effectuer le découpage (l'Étape 4 découpe le fichier nettoyé). Ne refiltrez pas l'ensemble
du corpus après en avoir extrait un jeu de validation (*dev*) — les lignes dev correspondraient à elles-mêmes
et seraient supprimées. Filtrez toute donnée *supplémentaire* (collecte web, texte monolingue)
de la même manière avant de l'ajouter à l'entraînement.

**Le filtrage ne consomme pas votre jeu de test.** leak-audit lit le jeu de test pour
comparer les lignes, et forge enregistre cela comme une lecture d'*audit*, jamais comme une lecture d'évaluation :
cela ne fait donc pas obstacle aux prédictions que vous formulez à l'Étape 3.

**Lisez le verdict en premier** (la ligne `VERDICT:` ; avec `--json`, la clé `verdict`).
S'il indique que la plupart des lignes de test ont un quasi-jumeau dans votre corpus, un modèle
entraîné sur l'intégralité de celui-ci évaluera le rappel de phrases d'entraînement plutôt que
la traduction. Avec un jeu de test fixe (vérifié par un enseignant ou un soignant), vous entraînerez alors
généralement **deux modèles** : un sur l'ensemble des données — souvent le plus utile
à déployer — et un sans doublons (*twin-free*) dont le score indique comment l'approche traite de nouvelles
phrases. Le corpus sans doublons est obtenu via `--drop-test-twins` :

```bash
nmt-forge leak-audit ~/pairs.tsv --clean-to pairs.notwins.jsonl --drop-test-twins
```

Cette commande supprime les lignes d'entraînement qui sont des quasi-jumelles de lignes de test, indique le
sous-ensemble strict avant et après, refuse l'opération si cela ne laissait plus rien pour l'entraînement
— et écrit la configuration du modèle sans doublons à côté de la vôtre,
**`config-notwins.json`** : la même configuration avec son propre `run_name`, et
`data.gold` / `eval.near_dupe_corpus` définis vers le fichier sans doublons
(`--companion-config <file>` permet de spécifier un autre fichier ; un fichier existant n'est jamais
écrasé). Elle affiche la commande qui l'entraîne. Tant que le jeu de validation n'est pas
enregistré (Étape 4), elle indique de l'extraire d'abord et de relancer cet audit, afin que les
lignes de validation quittent également le fichier sans doublons. `nmt-forge status` conserve le verdict —
puis le modèle sans doublons non entraîné — dans ses avertissements jusqu'à ce que vous agissiez.

**À quoi ressemble un refus :** vous n'avez pas besoin de penser à l'exécuter — `nmt-forge
run` audite chaque fichier d'entraînement par rapport à vos jeux de test et scellés et refuse toute
fuite : *« [leak-audit] corpus leaks into 1 test/sealed set(s) — project-test: 0
identical prompt(s), 3 identical answer(s), 1 near-duplicate answer(s) — plus 12
template sibling(s) … which are KEPT »*. Correction : `nmt-forge leak-audit <file>
--clean-to <file.clean.jsonl>` et entraînez sur le fichier nettoyé.

---

## Étape 3 — Prédire avant de regarder

**Vous dites :** *« Consignez les scores que nous attendons de chaque modèle sur le jeu de test —
avant que nous ne mesurions quoi que ce soit dessus. »*

**forge fait :** un pré-enregistrement (*preregistration*) par modèle que vous prévoyez d'entraîner, nommé d'après
le modèle :

```bash
nmt-forge prereg template --out predictions.json    # then EDIT it
nmt-forge prereg new all-data --eval-set project-test --predictions predictions.json
nmt-forge prereg new notwins --eval-set project-test --predictions predictions-notwins.json   # only with a twin-free model
```

Un fichier de prédictions est un tableau JSON de prédictions. Chacune spécifie une métrique et une
justification en une phrase, ainsi que soit une direction par rapport à une référence (*baseline*)
(`"direction": "increase", "baseline_score": 0, "margin": 5`) — vérifiée
automatiquement plus tard —, soit une attente en texte libre (`"expect": "between 10 and
30"`) qu'une personne vérifie. Vous (ou votre agent, explicitement) validez ces éléments
**avant** qu'aucun score de test n'existe — **et avant tout benchmark d'un modèle
existant sur le jeu de test** : les références de l'étape 3 du guide [Construire une TA pour
votre langue](/docs/build-mt-for-your-language#3-measure-the-options) interviennent
*après* cette étape. Lors de l'export, `--prereg <id>` indique quelle prédiction
évalue quel modèle. Ou bien rattachez dès maintenant une prédiction à la configuration de son modèle :
`--config-hash <hash>` sur `prereg new`, avec le hachage complet
qu'affiche `nmt-forge preflight run --config config-notwins.json`. Toute modification ultérieure
de cette configuration (un budget de temps, par exemple) modifie le hachage et supprime le rattachement ;
spécifier le pré-enregistrement lors de l'export reste donc la méthode la plus simple.

**À quoi ressemble un refus :** en voici quatre auxquels vous pourriez être confronté ici.

- Le modèle de base non modifié est refusé : ses espaces réservés `REPLACE` ne prédisent
  rien. Rédigez vos propres attentes et justifications.
- Un fichier en Markdown ou en prose est refusé en rappelant le format et la commande du modèle.
  Il n'y a qu'un seul format : le tableau JSON.
- Un pré-enregistrement rédigé après que le jeu de test a déjà été évalué est refusé :
  *« [preregister] eval set 'project-test' was already read for scoring … before
  this preregistration »*. Un benchmark compte comme une lecture. `--allow-after-reads` n'existe
  que pour les prédictions qui ont réellement été consignées avant ces lectures (sur papier,
  par exemple) ; cela est enregistré, et chaque rapport, export, `DEPLOY.md` et
  `nmt-forge status` mentionne alors que les prédictions sont intervenues après N lectures d'évaluation.
- L'évaluation d'un jeu de test sans pré-enregistrement est refusée : *« [preregister] no
  preregistration for eval set 'project-test' … why: results looked at without
  written-down expectations become post-hoc stories »*. C'est ce qui distingue un
  résultat d'une narration construite a posteriori.

:::info Pourquoi cela semble être du travail supplémentaire
C'est le travail. Chaque garde ici est une erreur qui a trompé de vrais chercheurs.
L'outil rend le chemin honnête facile et le chemin malhonnête celui qui vous arrête.
:::

Mesurez à présent les options existantes sur le jeu de test — étape 3 de [Construire une TA
pour votre langue](/docs/build-mt-for-your-language#3-measure-the-options) — et
revenez pour l'entraînement.

---

## Étape 4 — Découper, vérifier les barrières de contrôle, puis entraîner {#step-4--check-the-gates-then-train}

**Vous dites :** *« Découpez le corpus nettoyé en train et dev. L'exécution de l'entraînement
passera-t-elle toutes ses vérifications ? Si oui, lancez l'entraînement. »*

**forge fait — le découpage (*split*) :**

```bash
nmt-forge split pairs.clean.jsonl --test 0 --dev 100 --seed 42 \
    --out data/split --register project
```

`--test 0` extrait uniquement train et dev, car votre jeu de test existe déjà sous la
forme d'un fichier enregistré distinct (dans le cas d'un jeu de test extrait du corpus, l'Étape 1 a déjà réalisé le découpage).
`--register project` enregistre `project-dev` dans l'espace de travail — le nom vers lequel
la configuration initiale pointe déjà.

Le découpage est **disjoint par groupe** (*group-disjoint*) : deux paires de phrases partageant une source *ou*
une cible se retrouvent du **même** côté. C'est la cause la plus fréquente
de surévaluation des scores en faibles ressources — un manuel associe de nombreux exercices d'anglais à un
unique mot cible, un découpage aléatoire naïf place une copie dans train et sa jumelle dans test,
et le modèle « traduit » en réalité des réponses qu'il a mémorisées. La sortie indique ce qui s'est produit :

```
split pairs.clean.jsonl: 1580 rows in 1544 share-groups (largest 4)
  train 1480 · dev 100 · test 0  → data/split/
  verified: 0 shared canonical source/target keys across sides
  test side: none (--test 0) — your test set is a separate file; ...
  registered project-dev (role=dev)
```

Avec un jeu de test déjà enregistré, `split` filtre également sur-le-champ les nouveaux fichiers
train et dev par rapport à celui-ci et avertit si une ligne quelconque venait à être refusée plus tard.

**Corpus basés sur des gabarits (guides de conversation, exercices).** `--near-dupe 0.6` conserve également
les *quasi*-doublons — les phrases construites sur le même canevas — du même côté, de sorte qu'une ligne de dev
ou de test n'ait jamais de jumelle de gabarit dans l'entraînement. Sur un corpus fortement basé
sur des gabarits, les structures peuvent s'enchaîner en un groupe géant (*« Does your arm hurt? »* ~
*« Does your leg hurt? »* ~ *« Your leg looks swollen »*…), et un groupe ne peut être affecté
qu'en entier d'un seul côté. Lorsque cela attribuerait à un côté bien plus de lignes que demandé
— plus de **1,5×** la demande — ou laisserait à l'entraînement moins de la moitié de
ce que la demande lui destinait, `split` refuse et n'écrit rien : *« [split-guard]
split refused — nothing was written: the carve does not match the request (dev:
asked for 100 rows, the carve put 663 there (6.63×); training keeps 210 of the
773 rows the request leaves it) »*, suivi de la raison (le chaînage, avec la
taille du plus grand groupe) et des solutions possibles : un seuil plus élevé, un plafond sur
la taille du groupe (`--near-dupe 0.6 --max-group 51` — les liens de quasi-doublons au-delà du
plafond restent non coupés, et le découpage les comptabilise), la suppression des jumeaux d'un jeu de test fixe
avec `leak-audit --drop-test-twins`, ou des phrases de dev/test rédigées
indépendamment du matériel d'entraînement. forge vérifie lui-même le chaînage : sur
un tel corpus, ses recommandations concernant les quasi-jumeaux (ici, dans preflight et dans le fichier
DEPLOY.md de l'export) ne conseillent pas `--near-dupe 0.6`.

**À quoi ressemble un refus :** si vous fournissez à forge un découpage réalisé par vos soins,
`nmt-forge verify-split train.jsonl dev.jsonl test.jsonl` le refuse lorsque les ensembles
se chevauchent — *« [split-guard] 3 shared canonical source keys and 1 shared target
keys between 'train' and 'test' »* — avec la solution : procédez à une nouvelle extraction avec `split` ; ne
supprimez pas les lignes problématiques à la main.

**Deux modèles ?** Maintenant que le jeu de validation est enregistré, réexécutez l'audit
sans doublons de l'Étape 2 (les lignes dev quittent également le fichier sans doublons) ; son
`config-notwins.json` entraîne le second modèle ci-dessous.

**forge fait — les barrières de contrôle :** `nmt-forge preflight run --config config.json` liste chaque barrière
que l'exécution rencontrera, ✓ ou ✗, chaque ✗ étant assorti de sa solution — y compris si l'extra
d'entraînement est bien installé :

```
preflight: nmt-forge run

  ✓ config: config.json parses (config hash 9a85524275ff)
  ✓ dev-fence: config data.dev = 'project-dev': registered, role=dev
  ✓ training-data: 1 gold + 0 synthetic file(s) present
  ✗ backend-installed: backend 'hf-scratch' needs accelerate — not installed (the run would refuse)
      fix: python3 -m pip install 'nmt-forge[hf]'
  ✓ leak-audit: every gold and synthetic lane in the config will be audited ...
  ✓ schedule-sanity: regime, early-stop floor and eval cadence are derived from the config's data mix ...
  ✓ generation-headroom: decode cap is checked against dev reference lengths BEFORE training compute is spent

1 gate(s) would refuse — fix them first
```

Lorsque tout est au vert : `nmt-forge run config.json` (et, pour le modèle sans doublons,
`nmt-forge preflight run --config config-notwins.json && nmt-forge run
config-notwins.json`).

Avec le profil par défaut `cpu-tiny`, l'exécution s'effectue sur un processeur d'ordinateur portable classique — aucun GPU,
aucun téléchargement. L'entraînement reste la seule étape qui n'est **pas** un appel
d'outil instantané ; votre agent doit donc l'exécuter en arrière-plan en redirigeant la sortie vers un fichier
journal, et surveiller uniquement les lignes pertinentes (`refused`, `Error`,
`wall-clock`, `RUN EXIT`) plutôt que de scruter en boucle. Un panneau en direct affichant les courbes de perte
et un bouton d'arrêt s'ouvre pour **vous** (sur `http://127.0.0.1:8377` lorsque ce
port est disponible) — il vous est destiné, et non à l'agent. Au début de
l'exécution, forge mesure sa vitesse et refuse — en quelques minutes, non en quelques jours — toute exécution qui
ne peut pas se terminer dans la limite du `model.time_budget_hours` de la configuration.

Les lignes `[schedule-sanity]` indiquent le **plancher** d'arrêt anticipé (*early-stopping floor*) que forge a déduit
de votre composition de données, afin qu'une exécution riche en données synthétiques ne s'interrompe pas au bout d'une demi-époque lorsque
la perte sur le jeu de validation réel fluctue (un cas de défaillance bien réel — voir
[Diagnostiquer une exécution d'entraînement](/docs/network/getting-started/diagnosing-training)).

À la fin de l'exécution, forge a **sélectionné un point de contrôle sur le jeu de validation isolé** (jamais
sur le jeu de test), généré un fichier `run-manifest.json` et affiché les scores de validation —
toujours accompagnés de leurs intervalles de confiance à 95 % — suivis de la commande suivante.

---

## Étape 5 — Évaluer une seule fois et empaqueter le modèle

**Vous dites :** *« Évaluez le modèle sur le jeu de test et empaquetez-le pour que nous puissions l'utiliser. »*

**forge fait :**

```bash
nmt-forge export .forge/runs/<run>/run-manifest.json --prereg all-data --out export/
```

Une seule commande :

- décode votre jeu de test avec le point de contrôle sélectionné par l'entraînement et l'évalue —
  refusé en l'absence de pré-enregistrement, consigné dans le registre de l'espace de travail, avec des intervalles
  de confiance à 95 % pour chaque chiffre, et une section **Diagnostic et recommandations**
  en langage clair ;
- consigne le résultat sous la forme d'un **rapport mt-eval** dans `export/evaluation/`, afin que
  `mt-eval compare` place ce modèle aux côtés de tout ce que vous avez mesuré avec le
  banc d'essai (*harness*) (par exemple les modèles hébergés à l'étape 3 du guide
  [Construire une TA pour votre langue](/docs/build-mt-for-your-language#3-measure-the-options)) ;
- empaquette un **modèle autonome** dans `export/model/` (poids et tokeniseur,
  aucun état d'entraînement), `forge-model.json` (nature du modèle et méthode de mesure), un
  manifeste de plugin Champollion, et `DEPLOY.md` avec les commandes exactes.
  `export/model/` ne contient aucune phrase de test ; c'est le seul dossier que vous déployez.

**Le score** constitue le chiffre principal du banc d'évaluation : le chrF++ au niveau du corpus avec son intervalle
de confiance à 95 %, présenté de façon identique partout où forge l'affiche — par
exemple `chrF++ 31.2 [28.4, 34.0]` — avec sa signature sacreBLEU dans les enregistrements
complets (`forge-model.json`, le résumé de l'export, `DEPLOY.md`). BLEU, spBLEU et
TER sont affichés à côté, sans jamais être mélangés à celui-ci ; la correspondance exacte (*exact match*) et les autres
volets de la batterie de tests sont des diagnostics. Aucune interface de forge n'affiche de note composite ou de
label de qualité : la valeur de la sortie relève exclusivement du jugement des locuteurs de la langue.

**Les réserves qui qualifient le score l'accompagnent systématiquement.** Le rapport mt-eval consigne
tout ce qui nuance la signification du score — par exemple une *sortie quasi constante*
(le modèle a renvoyé l'une de quelques phrases prédéfinies pour de nombreuses entrées
différentes, de sorte que ses sorties ne suivent pas ses entrées), des sorties bien plus longues ou
plus courtes que les références, ou des copies de la source. `export` transmet chacun
de ces éléments dans les termes mêmes du banc d'évaluation : dans son résumé
(`score_caveats`), dans `forge-model.json`, et dans `DEPLOY.md` juste en dessous du
score. `status`, `report`, `compare` et `lint` indiquent la même chose. Un score
assorti d'une mise en garde n'est jamais présenté comme « le chiffre à citer » sans celle-ci.

Si une défaillance survient, aucun export à moitié écrit n'est conservé. Deux mises en garde :
`export/evaluation/` contient vos phrases de test — ne le copiez jamais avec le
modèle ; conservez-le avec le jeu de test. (Lorsque le jeu de test est marqué comme privé, chaque
fichier qui s'y trouve porte la même marque.) De plus, un
jeu de test **scellé** (*sealed*) est à usage unique : l'exportation le consomme, et une seconde exportation
sera refusée à moins de transmettre `--no-eval` (empaqueter le modèle sans recalculer le score).

`nmt-forge evaluate <run-manifest>` est le pendant d'évaluation seule de `export`, si vous
souhaitez obtenir les chiffres sans l'empaquetage (`--harness-out DIR` écrit le rapport
mt-eval).

**Deux modèles sur un même jeu de test** (par exemple, un entraîné sur l'ensemble des données et un avec
`--drop-test-twins`) : dès que l'espace de travail contient une seconde exécution, la ligne `NEXT`
de l'exécution et `nmt-forge status` désignent un dossier par exécution (`--out export-<run>/`).
L'ordre n'a pas d'importance : quel que soit le modèle exporté en second, le fichier `DEPLOY.md` du modèle
entraîné sur toutes les données finit par citer le score du modèle sans doublons. Avec deux
pré-enregistrements sur un même jeu de test, `nmt-forge status` et `nmt-forge report`
indiquent lequel s'applique à quelle exécution (ou que `--prereg <id>` doit trancher —
export the twin-free model with `--prereg notwins`). `nmt-forge compare`
compare en A/B les deux modèles sur le jeu de test et indique, par modèle, combien de lignes de test ont un
quasi-jumeau dans ses données d'entraînement : un gain par rappel mémorisé est signalé comme tel. Il prend
les hypothèses de chaque modèle — `<export>/evaluation/battery-hyps.jsonl`, désigné par
`hypotheses` dans le résumé d'export — et répercute les réserves sur le score que mt-eval
a émises pour cet export. Le score sans doublons est celui qu'il convient de citer pour de nouvelles
phrases, uniquement accompagné de ses éventuelles réserves : si la sortie du modèle sans doublons
est quasi constante, son score ne prouve pas qu'il traduit de nouvelles
phrases, et `DEPLOY.md` le précise à côté du chiffre.

**Les lectures par le banc d'évaluation comptent.** Lorsque forge enregistre un jeu de test, il initialise un
petit journal de lecture à côté du fichier (`<file>.reads.jsonl`), et `mt-eval run` /
`mt-eval compare` ajoutent une ligne sans contenu (identifiant d'exécution, finalité, sha256
du fichier, horodatage) à chaque fois qu'ils évaluent ce fichier. forge le lit : un
pré-enregistrement formulé après une telle lecture est refusé en tant que postdiction (sauf
mention `--allow-after-reads`, que chaque rapport divulgue par la suite) — raison pour laquelle l'Étape 3
précède les références — un jeu scellé lu par `mt-eval` est consommé, `status` et
`ledger show --set` comptent les lectures, et `DEPLOY.md` indique quand le score
exporté n'était pas une découverte initiale (*first look*).

### Comment lire le rapport battery-lint

Le rapport se présente sous la forme d'un tableau de scores **par registre** (manuel, administratif, récit
oral, …) — ou d'un groupe unique, `all`, lorsque vos lignes de test ne précisent pas de
registre — chacun assorti de son intervalle de confiance, suivi du diagnostic. Le
diagnostic désigne vos **registres les plus faibles** et, pour chacun, la cause la plus probable et
le **levier** à activer ensuite :

| Si le diagnostic indique… | Cela signifie… | Le levier |
|---|---|---|
| `R1-vocabulary-gap` | le registre obtient un score bas **et** les sorties sont incomplètes ; le modèle manque de vocabulaire | **VOCABULAIRE** — étoffer le lexique, puis revérifier l'entonnoir (*funnel*) |
| `R2-structure-gap` | les mots sont connus mais les *structures* de phrases ne le sont pas | **STRUCTURE** — ajouter les constructions manquantes (gabarits/compositeur) |
| `R3-mixed-convention` | les sorties mélangent différentes orthographes | **ORTHOGRAPHE** — normaliser le corpus selon une convention unique, réentraîner |
| `R4-optimism-bound` | le score « complet » est gonflé par des lignes de test quasi-jumelles | **MESURE** — citer le score strict pour évaluer la généralisation |
| `R5-low-power` | l'intervalle de confiance est large | **MESURE** — ne pas prendre de décisions sur des écarts inférieurs à l'IC ; agrandir le jeu de test |
| `R7-transfer-plateau` | excellent sur les données synthétiques, au point mort sur le texte réel | **DONNÉES RÉELLES** — rétro-traduire des données monolingues ou obtenir de vraies phrases parallèles |
| `R9-harness-score-caveat` | le rapport mt-eval émet des réserves sur le score (par exemple une sortie quasi constante) ; `high` lorsque mt-eval juge l'anomalie majeure | **MESURE** — ne citer le score qu'accompagné de sa mise en garde, et examiner quelques sorties avant de parler de qualité de traduction |

Chaque constat détaille les éléments probants sur lesquels il s'est déclenché. Pour les constats `--json`, votre
agent peut intervenir par voie programmatique : `nmt-forge lint
export/evaluation/battery-hyps-battery.json --json`.

---

## Étape 6 — Le mettre à disposition de la CLI Champollion

**Vous dites :** *« Servez le modèle exporté et traduisez les chaînes de caractères de notre application avec
celui-ci. »*

**forge fait :**

```bash
nmt-forge serve export/model                               # http://127.0.0.1:8378
LOCAL_API_BASE=http://127.0.0.1:8378/v1 champollion sync --method local
```

`serve` répond de deux manières : selon le contrat de la **méthode api** de Champollion
(`POST /translate`) et via un point de terminaison `/v1/chat/completions` **compatible avec OpenAI**,
avec lequel `champollion sync --method local` communique. `export/model/DEPLOY.md` contient l'extrait
`champollion.config.json` pour la méthode `api` (celle qu'il recommande)
ainsi que pour le manifeste de plugin. Le serveur écoute sur `127.0.0.1` uniquement ; pour l'exposer
sur un réseau, vous devez lui attribuer un jeton (`--token` ou
`NMT_FORGE_SERVE_TOKEN`), car toute personne pouvant joindre le port peut utiliser votre
modèle. La CLI n'a besoin d'aucune clé pour le serveur en boucle locale (*loopback*) ; un serveur démarré avec un
jeton nécessite la même valeur dans `CHAMPOLLION_API_KEY`.

Avec deux modèles exportés, le choix de celui à déployer vous revient :
`nmt-forge choose export-<run>/model` l'enregistre, et `nmt-forge status`
désigne ensuite ce modèle. Mettre en service un modèle pour le tester est consigné comme une mise en service (*served*), non comme un
choix. Pour inscrire plutôt le modèle dans un concours souverain, `DEPLOY.md` §6
liste les fichiers constituant une soumission déclarative (Voie A / *Lane A*) ainsi que la commande
`mt-eval contest submit-model` exacte.

Sachez ce que vous déployez : un modèle de TAN (traduction automatique neuronale) traduit du texte ; il ne suit **pas**
d'instructions, de sorte que les consignes de ton, les fichiers d'accompagnement (*coaching files*) et les glossaires que
la CLI transmet aux méthodes LLM sont ignorés. De plus, la traduction automatique d'une langue à
faibles ressources nécessite la relecture d'un locuteur fluide avant que quoi que ce soit ne parvienne aux lecteurs.

---

## Ce que vous venez de faire

Vous avez entraîné un modèle dont le score est réellement digne de confiance : aucune fuite de réponses, un
point de contrôle sélectionné sans jeter un œil au jeu de test, des barres d'erreur sur chaque valeur,
des prédictions consignées avant l'obtention des résultats, un diagnostic qui désigne le levier suivant
au lieu de vous laisser deviner — et un modèle empaqueté que la CLI peut appeler
et qui se compare directement à toutes les autres méthodes que vous avez mesurées. C'est là tout
l'enjeu — **l'honnêteté du résultat est le comportement par défaut, et aucune expertise en TA
(ni GPU) n'a été nécessaire pour y parvenir.**

Si les chiffres déçoivent (ce sera le cas la première fois — le modèle par défaut est
modeste par conception), consultez
[Diagnostiquer une exécution d'entraînement](/docs/network/getting-started/diagnosing-training) —
ce guide s'articule autour des symptômes et a été rédigé précisément pour cette situation.
