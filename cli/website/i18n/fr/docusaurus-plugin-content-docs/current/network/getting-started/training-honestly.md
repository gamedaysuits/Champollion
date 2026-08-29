---
sidebar_position: 2
title: "Entraîner un modèle honnêtement (nmt-forge)"
related:
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

**La version 30 secondes :** la plupart des « améliorations » en traduction automatique pour langues peu dotées meurent à la réexamination — l'ensemble de test a fui dans l'entraînement, l'ensemble de test a choisi le point de contrôle, ou le gain était du bruit sans barres d'erreur. **nmt-forge** est une suite d'entraînement qui rend ces erreurs structurellement difficiles : ses chemins normaux font la bonne chose, et les mauvais chemins refusent avec un message qui dit *quoi* s'est passé, *pourquoi* cela corrompt les résultats, et le *correctif* exact. Elle entraîne ; le [harnais d'évaluation](/docs/network/specifications/harness) note. Chaque garde en elle mécanise une erreur que nous avons réellement commise, mesurée et documentée lors de la construction de la traduction en cri des Plaines.

```bash
$ nmt-forge score --eval-set textbook-test --hyps decoded.txt

[preregister] no preregistration for eval set 'textbook-test'
  why: results looked at without written-down expectations become
       post-hoc stories
  fix: write one FIRST: nmt-forge prereg new ... — then score
```

C'est toute la personnalité de la suite en un refus.

## L'histoire de cinq minutes

Voici l'échec dont la suite est née. Un manuel de cri mappe de nombreux exercices anglais à une cible unique : *« Feed him »* et *« Feed her »* se traduisent tous deux par `asam`. Un fractionnement aléatoire standard a mis une copie dans l'entraînement et son jumeau dans l'ensemble de test — donc le modèle avait littéralement vu 17 des 54 réponses « test », et ces lignes ont obtenu 83 chrF++ contre 44 pour les propres. Tout en aval (le modèle « champion », les conclusions construites dessus) a dû être jeté.

Le fractionnement de nmt-forge rend cela impossible **par construction** : les paires partageant une source *ou* une cible sont groupées, les groupes entiers atterrissent d'un côté, et une vérification de chevauchement zéro s'exécute après chaque découpe :

```bash
$ nmt-forge split corpus.jsonl --test 150 --dev 42 --seed 42 \
      --out data/split --register textbook
{"verified": "0 shared canonical source/target keys across sides", ...}
```

Chaque autre garde a la même forme — une erreur réelle, mécanisée :

| garde | l'erreur qu'elle élimine |
|---|---|
| **split-guard** | les réponses de test cachées dans l'entraînement via des sources/cibles partagées |
| **dev-fence** | l'ensemble de test choisissant votre point de contrôle (l'entraînement refuse de démarrer sans un ensemble de développement enregistré) |
| **leak-audit** | l'entraînement sur du texte d'évaluation — exact, reformulé (Jaccard), ou le fichier entier |
| **funnel-audit** | l'attrition silencieuse du pipeline (un caractère d'orthographe a une fois supprimé 1 375 verbes de dictionnaire, invisiblement, pendant des semaines) |
| **convention-lint** | l'entraînement sur des conventions d'orthographe mixtes (le modèle les mélange alors en milieu de phrase) |
| **coverage-map** | un million de paires synthétiques sans impératifs, sans questions, sans possession — le volume cachant des lacunes structurelles |
| **sample-strata** | deux types de modèles monopolisant la moitié du signal d'entraînement |
| **ci-scoring** | les scores sans barres d'erreur (chaque nombre s'affiche avec son IC de bootstrap à 95 % — il n'y a pas de sortie de score nu) |
| **schedule-sanity** | l'arrêt précoce tuant une exécution synthétique-lourde à mi-époque : avec 97 % de données synthétiques et un ensemble de développement *réel* honnête, la perte de développement atteint un minimum tôt et dérive vers le haut — c'est le modèle s'adaptant à la masse synthétique, pas la convergence. Le plancher d'arrêt est dérivé de votre mélange automatiquement, et chaque intervention s'explique avec la trajectoire de perte de développement. Celui-ci a été trouvé *par* un protocole propre — les configurations honnêtes font remonter les vrais bugs |
| **eval-ledger** | l'utilisation adaptative invisible des données d'évaluation (chaque lecture est enregistrée ; les ensembles scellés sont à usage unique) |
| **preregister** | les postdictions déguisées en prédictions (pas de préenregistrement → pas de tableau de comparaison) |

## N'importe quelle langue, n'importe quels actifs — commencez par la fiche

nmt-forge est un outil unique pour les ~8 700 langues de l'index de Champollion, et
il commence par interroger l'index sur ce dont une langue dispose réellement :

```bash
$ nmt-forge discover nav        # Navajo — a sparse card
  ✓ rung 1: parallel text → train with every guard (no pack needed)
  ? rung 2: monolingual text → the tagged backtranslation lane
  ? rung 4: morphological analyzer → round-trip-VERIFIED synthesis
  note: no analyzer on the card → synthesis is off the menu until one
  exists; every guard and the training loop work regardless
```

Les marques `?` sont l'outil étant honnête : l'absence sur une fiche signifie **inconnu**, jamais « cette langue n'a rien ». Chaque langue grimpe la même **échelle d'actifs** — (1) le texte parallèle seul obtient déjà la boucle d'entraînement gardée complète ; (2) le texte monolingue ajoute la rétrotraduction ; (3) un dictionnaire plus une grammaire publiée rend un paquet de modèles cité digne d'être construit ; (4) un analyseur morphologique déverrouille la synthèse vérifiée ; (5) un arbitre LYSS met la métrique propre de la langue dans la notation et la sélection de points de contrôle. Une fiche riche (Cri des Plaines) câble les échelons 4–5 automatiquement — les ensembles d'évaluation arrivent marqués `NEVER TRAIN ON THIS`, et les voies de plugin de l'arbitre sont prêtes à coller.

`nmt-forge init <code>` échafaude ensuite un projet à partir de la fiche : un espace de travail, une configuration de démarrage, et un résumé `NEXT_STEPS.md` écrit pour vous *et votre agent* — se terminant à [Soumettre une méthode](/docs/network/getting-started/submit-a-method) une fois que vous avez quelque chose qui vaut la peine d'être testé.

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

- **Nouveau au vocabulaire ?** [La traduction automatique en langage clair](/docs/network/context/mt-training-concepts) définit chaque terme — données d'entraînement vs. d'évaluation, perte vs. décodage, fuite, chrF++, rétrotraduction, le plateau — avec un exemple travaillé, écrit pour zéro connaissance préalable.
- **Prêt à construire ?** [Donc vous voulez entraîner votre propre modèle](/docs/network/tutorials/train-your-own-model) est la procédure pas à pas, orientée agent : choisir une langue → rassembler les données → synthétiser → fractionner → entraîner → évaluer → itérer → soumettre, avec chaque garde-fou montré attrapant son erreur.
- **Entraîner, puis soumettre :** un modèle entraîné honnêtement devient une entrée du Réseau via [Soumettre une méthode](/docs/network/getting-started/submit-a-method).
- **Les barres d'erreur :** [Test de signification statistique](/docs/network/specifications/significance) est les mathématiques que forge applique par défaut.
- **Quelle métrique faire confiance :** consultez [Fiabilité des métriques](/docs/network/specifications/metric-reliability) avant de sélectionner des points de contrôle sur n'importe quelle métrique automatique.
- **La conception complète** — l'histoire mesurée de chaque garde, l'interface du pack, les valeurs par défaut de la boucle d'entraînement — vit avec le code dans le référentiel (`forge/DESIGN.md`).
