---
sidebar_position: 2
title: "Entraîner un modèle honnêtement (nmt-forge)"
related:
  - label: "Build MT for Your Language"
    to: /docs/build-mt-for-your-language
    kind: guide
    note: "The whole journey; training is its step 4"
  - label: "MT Training in Plain Language"
    to: /docs/network/context/mt-training-concepts
    kind: doc
    note: "Zero-background glossary — read this if the vocabulary is new"
  - label: "So You Want to Train Your Own Model"
    to: /docs/network/tutorials/train-your-own-model
    kind: tutorial
    note: "The hands-on, agent-forward walkthrough"
  - label: "Submit a Method"
    to: /docs/network/getting-started/submit-a-method
    kind: guide
    note: "Where an honestly-trained model goes next"
  - label: "Statistical Significance Testing"
    to: /docs/network/specifications/significance
    kind: spec
    note: "The math behind the error bars forge insists on"
  - label: "Benchmark Specification"
    to: /docs/network/specifications/benchmark
    kind: spec
  - label: "Metric Reliability Specification"
    to: /docs/network/specifications/metric-reliability
    kind: spec
    note: "Know which metric to believe before you select checkpoints on it"
---

# Entraîner un modèle honnêtement (nmt-forge)

**En 30 secondes :** la plupart des « améliorations » en TA à faibles ressources
s'effondrent lors d'un réexamen — le jeu de test a fuité dans l'entraînement,
le jeu de test a servi à choisir le checkpoint, ou le gain n'était que du bruit
sans barres d'erreur. **nmt-forge** est une suite d'entraînement qui rend ces
erreurs structurellement difficiles : ses chemins normaux font ce qu'il faut,
et les mauvais chemins refusent d'opérer avec un message indiquant *ce qui*
s'est passé, *pourquoi* cela corrompt les résultats, et le *correctif* exact.
Il entraîne ; le [harnais d'évaluation](/docs/network/specifications/harness) évalue.
Chaque garde-fou mécanise une erreur que nous avons réellement commise, mesurée
et documentée lors de la création de la traduction pour le cri des plaines.
Il s'installe avec `python3 -m pip install 'nmt-forge[hf]'`, et son modèle par
défaut s'entraîne sur le processeur d'un ordinateur portable.

```bash
$ nmt-forge score --eval-set textbook-test --hyps decoded.txt

[preregister] no preregistration for eval set 'textbook-test' at its current content hash
  why: results looked at without written-down expectations become
       post-hoc stories; ...
  fix: write one FIRST: ... — then score
```

C'est toute la personnalité de la suite en un refus.

## L'histoire de cinq minutes

Voici l'échec dont la suite est née. Un manuel de cri mappe de nombreux exercices anglais à une cible unique : *« Feed him »* et *« Feed her »* se traduisent tous deux par `asam`. Un fractionnement aléatoire standard a mis une copie dans l'entraînement et son jumeau dans l'ensemble de test — donc le modèle avait littéralement vu 17 des 54 réponses « test », et ces lignes ont obtenu 83 chrF++ contre 44 pour les propres. Tout en aval (le modèle « champion », les conclusions construites dessus) a dû être jeté.

Le fractionnement de nmt-forge rend cela impossible **par construction** : les paires partageant une source *ou* une cible sont groupées, les groupes entiers atterrissent d'un côté, et une vérification de chevauchement zéro s'exécute après chaque découpe :

```bash
$ nmt-forge split corpus.jsonl --test 150 --dev 42 --seed 42 \
      --out data/split --register textbook
split corpus.jsonl: 1240 rows in 1187 share-groups (largest 4)
  train 1048 · dev 42 · test 150  → data/split/
  verified: 0 shared canonical source/target keys across sides
```

(Si votre jeu de test est déjà un fichier distinct et enregistré — un ensemble
vérifié par des enseignants que vous conservez privé — `--test 0` ne découpe
que train et dev.)

Tous les autres garde-fous ont la même forme — une erreur réelle, éliminée de
façon mécanisée. Ensemble, ils constituent les **garde-fous d'entraînement** :
lisez-les avant d'effectuer la séparation (`nmt-forge init` et `nmt-forge status`
renvoient ici à cette étape ; les agents reçoivent les mêmes règles, avec l'erreur
mesurée derrière chacune d'elles, depuis l'outil MCP `get_training_guardrails`).

| garde-fou | l'erreur qu'il élimine |
|---|---|
| **split-guard** | des réponses de test dissimulées dans l'entraînement par des sources ou cibles partagées |
| **dev-fence** | le jeu de test servant à choisir votre checkpoint (l'entraînement refuse de démarrer sans jeu de dev enregistré) |
| **leak-audit** | s'entraîner sur du texte d'évaluation — une invite identique (même avec une traduction différente), une réponse identique ou quasi-identique, ou le fichier entier. Il indique également ce qu'il *conserve* délibérément et pourquoi : les variantes issues d'un même modèle qui changent un mot (*« I see the dog »* / *« I see the cat »*) constituent de la pratique, pas la réponse, et sont signalées plutôt que supprimées — sauf si chaque ligne de test en possède une, auquel cas `--clean-to … --drop-test-twins` supprime les doublons d'entraînement d'un jeu de test fixé. Déterministe : même corpus, même résultat |
| **funnel-audit** | l'attrition silencieuse du pipeline (un caractère d'orthographe a autrefois supprimé 1 375 verbes de dictionnaire, de manière invisible, pendant des semaines) |
| **convention-lint** | s'entraîner sur des conventions orthographiques mixtes (le modèle les mélange ensuite en milieu de phrase) |
| **coverage-map** | un million de paires synthétiques sans impératifs, sans questions, sans possession — le volume masquant des lacunes structurelles |
| **sample-strata** | deux types de gabarits accaparant la moitié du signal d'entraînement |
| **ci-scoring** | des scores sans barres d'erreur (chaque nombre s'affiche avec son intervalle de confiance bootstrap à 95 % — il n'y a aucune sortie de score brut) |
| **schedule-sanity** | l'arrêt anticipé (early stopping) interrompant une exécution à forte composante synthétique à la moitié d'une époque : avec 97 % de données synthétiques et un jeu de dev *réel* honnête, la perte de dev atteint son minimum très tôt puis remonte — c'est le modèle qui s'ajuste à la masse synthétique, et non une convergence. Le seuil d'arrêt est dérivé automatiquement de votre mélange, et chaque intervention s'explique à l'aide de la trajectoire de la perte de dev. Cette anomalie a été découverte *grâce à* un protocole rigoureux — des configurations honnêtes révèlent de vrais bugs |
| **eval-ledger** | l'utilisation adaptative invisible des données d'évaluation (chaque lecture est journalisée ; les jeux scellés sont à usage unique) |
| **preregister** | des postdictions déguisées en prédictions (pas de préenregistrement → pas de score de test, pas de tableau de comparaison ; un seul format de prédictions, un tableau JSON — `nmt-forge prereg template` en génère un à modifier) |
| **score caveats** | citer un score assorti de réserves par le harnais d'évaluation — une *sortie quasi constante* (l'une de quelques phrases données pour de nombreuses entrées différentes : les sorties ne suivent pas les entrées), des sorties beaucoup plus longues ou plus courtes que les références, des copies de la source. forge ne calcule aucun de ces éléments ; il transmet chaque mise en garde formulée par le harnais, dans les propres termes du harnais, à côté du score — dans le résumé d'exportation, `forge-model.json`, `DEPLOY.md`, `status`, `report`, `compare` et `lint` — et ne présente jamais un score assorti de réserves comme « le chiffre à citer » sans sa mise en garde |

## N'importe quelle langue, n'importe quels actifs — commencez par la fiche

nmt-forge est un outil unique pour l'ensemble des ~8 700 langues de l'index de
Champollion, et il commence par interroger l'index sur ce dont dispose réellement
une langue :

```bash
$ nmt-forge discover nav        # Navajo — a sparse card
  ✓ rung 1: parallel text → train with every guard (no pack needed)
  ? rung 2: monolingual text → the tagged backtranslation lane
  ? rung 4: morphological analyzer → round-trip-VERIFIED synthesis
  note: no analyzer on the card → synthesis is off the menu until one
  exists; every guard and the training loop work regardless
```

Les marques `?` sont l'outil étant honnête : l'absence sur une fiche signifie **inconnu**, jamais « cette langue n'a rien ». Chaque langue grimpe la même **échelle d'actifs** — (1) le texte parallèle seul obtient déjà la boucle d'entraînement gardée complète ; (2) le texte monolingue ajoute la rétrotraduction ; (3) un dictionnaire plus une grammaire publiée rend un paquet de modèles cité digne d'être construit ; (4) un analyseur morphologique déverrouille la synthèse vérifiée ; (5) un arbitre LYSS met la métrique propre de la langue dans la notation et la sélection de points de contrôle. Une fiche riche (Cri des Plaines) câble les échelons 4–5 automatiquement — les ensembles d'évaluation arrivent marqués `NEVER TRAIN ON THIS`, et les voies de plugin de l'arbitre sont prêtes à coller.

`nmt-forge init <code>` génère ensuite l'échafaudage d'un projet à partir de la fiche : un
espace de travail, une configuration de départ et un brief `NEXT_STEPS.md` rédigé
pour vous *et votre agent* avec l'ordre exact des commandes. Il fonctionne à
partir d'un simple `pip install` — les fiches sont lues depuis un répertoire que
vous indiquez, un checkout local ou l'index public de fiches (mis en cache pour un
usage hors ligne) — et une langue ne disposant pas encore de fiche obtient
également un projet (`--no-card --name "<name>"`), chaque élément de la fiche étant consigné
comme inconnu plutôt qu'inventé.

## D'un ordinateur portable à un modèle servi

La boucle honnête ne nécessite pas de GPU. `init` inscrit l'un des trois
préréglages de modèle dans la configuration, sous forme de valeurs numériques
explicites :

| préréglage | prérequis | à quoi s'attendre |
|---|---|---|
| `cpu-tiny` (par défaut) — un petit transformer entraîné à partir de zéro, vocabulaire appris uniquement à partir de vos lignes d'entraînement | le processeur d'un ordinateur portable, aucun téléchargement | faible par conception : sur 1 à 2 milliers de paires, chrF++ d'environ 5 à 30 — les phrases et motifs de vos données, pas une traduction générale |
| `cpu-finetune --base <hf-id>` — un petit modèle Marian/opus-mt préentraîné que vous spécifiez, pour une paire apparentée | un processeur, ~300 Mo de téléchargement | généralement meilleur que `cpu-tiny` lorsqu'une paire apparentée existe — mesurez-le |
| `nllb-600m` — NLLB-200 distillé 600M avec LoRA | un GPU | le point de départ le plus robuste |

`cpu-tiny` est là pour rendre l'*ensemble* de la boucle concret dès le premier
jour — la barrière de dev, les audits, le test préenregistré, un modèle que la
CLI peut appeler — afin qu'un meilleur modèle puisse ultérieurement s'intégrer
au même projet et être évalué de la même façon. Après l'entraînement, deux commandes
terminent le travail :

```bash
nmt-forge export .forge/runs/<run>/run-manifest.json --prereg <id> --out export/
nmt-forge serve export/model     # http://127.0.0.1:8378
```

`export` évalue le jeu de test une seule fois (préenregistrement requis,
intervalles de confiance à 95 % ; `--prereg <id>` désigne le préenregistrement
rédigé pour ce modèle avec `nmt-forge prereg new <id>` — avec deux modèles sur un même jeu
de test, chacun étant évalué selon le sien, export refuse de deviner), enregistre
le résultat sous forme de rapport mt-eval que `mt-eval compare` lit, et package un
modèle autonome avec un manifeste de plugin champollion et un `DEPLOY.md`.
`serve` implémente le contrat api-method de champollion et un point de
terminaison compatible OpenAI, permettant ainsi à `champollion sync --method local` de traduire avec ;
il écoute uniquement sur localhost sauf si vous lui fournissez un jeton. Chaque
commande accepte `--json` pour les agents (un document JSON sur stdout ; les
refus sous forme de `{"error": {…, "why", "fix"}}`, code de sortie 2). Le guide pas à pas complet
se trouve dans [Entraîner votre premier modèle](/docs/network/getting-started/train-your-first-model) ;
une fois que vous disposez d'un résultat digne d'être testé,
[Soumettre une méthode](/docs/network/getting-started/submit-a-method) le convertit
en entrée du Réseau.

## Les données synthétiques que vous pouvez défendre

Pour les langues avec des analyseurs morphologiques (FST), forge fabrique des données d'entraînement via des **packs de langue** — et applique une *loi d'émission* dont aucun pack ne peut se soustraire : chaque mot généré doit faire un aller-retour par l'analyseur (générer → analyser → même analyse), chaque modèle cite la grammaire publiée qu'il transcrit, chaque filtre de plausibilité est nommé et compté, et chaque ligne est estampillée `synthetic: true`. Cet estampille est porteur de charge : le registre **refuse les lignes synthétiques dans les ensembles de test**. Les tests ne contiennent que des données réelles.

forge lui-même ne livre aucun pack de langue — c'est un outil à usage général. Les packs vivent avec leurs langues et se branchent par chemin de module ou point d'entrée (le pack cri des Plaines vit dans le projet crk-translate) :

```bash
nmt-forge synth nmt_forge_crk.pack:get_pack --out data/synth.jsonl
```

Les analyseurs et les dictionnaires restent séparés, des outils récupérés par l'utilisateur sous leurs propres licences — jamais regroupés, jamais redistribués.

## L'arbitre propre de votre langue, dans la boucle

Les normes d'évaluation LYSS (des linters par langue qui savent, par exemple, que deux orthographes du cri ne diffèrent que par une convention de voyelle longue documentée) se branchent sur chaque surface de notation — et dans la sélection de points de contrôle, donc le modèle qui gagne est celui que *l'arbitre de la langue* préfère, pas seulement chrF++ :

```bash
nmt-forge score --eval-set textbook-test --hyps decoded.txt \
    --plugin champollion_lyss.crk.metrics:CrkLinterMetric

  chrf++                            46.02  [43.11, 48.87] 95% CI
  crk_linter:equivalent_match_rate   0.31  [ 0.24,  0.38] 95% CI
```

Chaque numéro de plugin obtient un intervalle de confiance ; un arbitre dont les prérequis manquent rapporte *indisponible* plutôt qu'un score fabriqué.

Il en va de même pour la **pile de métriques du harnais complet** — nmt-forge parle tout ce que le [harnais d'évaluation](/docs/network/specifications/harness) parle, y compris les métriques neurales (COMET, COMET-QE, MetricX), avec l'inférence exécutée une fois et les intervalles de confiance amorcés à partir des scores par entrée mis en cache. Avant de sélectionner des points de contrôle sur n'importe quelle métrique automatique, `discover` affiche la [fiabilité mesurée](/docs/network/specifications/metric-reliability) de chaque métrique pour votre famille de langues — pour l'inuktitut, BLEU suit à peine le jugement humain (r=0,16) tandis que COMET le fait (r=0,86) ; pour la plupart des familles peu dotées, la réponse honnête est *non mesurée*. L'outil vous dit quel nombre croire avant d'optimiser vers lui.

## Où approfondir

- **Nouveau venu face au vocabulaire ?** [L'entraînement en TA en langage clair](/docs/network/context/mt-training-concepts) définit chaque terme — données d'entraînement vs d'évaluation, perte (loss) vs décodage, fuite (leakage), chrF++, rétrotraduction (backtranslation), le plateau — avec un exemple détaillé, conçu pour les personnes sans prérequis.
- **Prêt à construire ?** [Vous souhaitez entraîner votre propre modèle](/docs/network/tutorials/train-your-own-model) est le tutoriel pas à pas axé sur les agents : choisir une langue → rassembler les données → synthétiser → découper → entraîner → évaluer → itérer → servir et soumettre, chaque garde-fou étant illustré en interceptant son erreur. [Construire la TA pour votre langue](/docs/build-mt-for-your-language) replace l'entraînement dans le contexte du parcours global — découvrir ce qui existe, évaluer les options, déployer.
- **Entraîner, puis soumettre :** un modèle entraîné honnêtement devient une entrée du Réseau via [Soumettre une méthode](/docs/network/getting-started/submit-a-method).
- **Les barres d'erreur :** [Tests de significativité statistique](/docs/network/specifications/significance) décrit les principes mathématiques que forge applique par défaut.
- **À quelle métrique se fier :** consultez [Fiabilité des métriques](/docs/network/specifications/metric-reliability) avant de sélectionner des checkpoints selon une quelconque métrique automatique.
- **Chaque commande et option :** la [Référence des commandes forge](/docs/network/getting-started/forge-command-reference), générée directement depuis l'outil.
- **La taxonomie des défaillances** — chaque erreur, un exemple concret et le garde-fou qui l'intercepte — est fournie avec les sources de nmt-forge. Les agents reçoivent le même ensemble de règles via l'outil `get_training_guardrails` du serveur MCP (`topic` facultatif), et chaque refus détaille ce qui s'est passé, pourquoi et comment corriger.
