---
sidebar_position: 3
title: "Entraîner votre premier modèle (avec votre agent)"
description: "Un guide étape par étape pour entraîner un modèle de traduction automatique à faibles ressources en dirigeant un agent de codage — ce que vous dites, ce que forge fait, à quoi ressemble un refus, et comment lire le diagnostic."
related:
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

Cette page est la boucle complète. Chaque étape est écrite comme **ce que vous dites à votre agent**, **ce que forge fait**, **à quoi ressemble un refus** (pour que ni l'un ni l'autre ne paniquiez quand l'un se déclenche — un refus, c'est l'outil qui fonctionne), et, à la fin, **comment lire le rapport**.

:::tip La seule règle pour votre agent
Dites-lui : *« Exécutez toujours `nmt-forge status --json` en premier, et après chaque étape.
Faites tout ce que son `next_command` dit. »* Cette seule habitude transforme forge en rail guidé. Si votre agent se connecte via MCP, la même boucle est l'outil `forge_status` — voir le [Guide de l'agent](/docs/network/getting-started/agent-guide).
:::

---

## Étape 0 — Pointez votre agent vers votre langue

**Vous dites :** *« Je veux entraîner un modèle anglais→[votre langue]. Commencez par découvrir ce que forge sait à ce sujet. Le code ISO 639-3 est `crk` »* (utilisez le code de votre langue).

**forge fait :** `nmt-forge discover crk` lit la fiche de la langue — scripts, dictionnaires, analyseurs morphologiques, corpus existants et ensembles d'évaluation (avec tous les drapeaux `do_not_train` / quarantaine), et métriques d'arbitrage par langue. Il place votre langue sur l'**échelle des ressources** : (1) texte parallèle → entraînement gardé ; (2) + monolingue → rétrotraduction étiquetée ; (3) + dictionnaire/grammaire → données synthétiques citées ; (4) + analyseur → synthèse vérifiée par aller-retour ; (5) + métrique d'arbitrage → métrique propre à la langue dans la notation et la sélection de points de contrôle.

**Un champ vide signifie INCONNU, jamais zéro.** Une fiche clairsemée ne signifie pas « cette langue n'a rien » — il se peut simplement que la ressource ne soit pas encore enregistrée. Vous pouvez toujours apporter votre propre corpus parallèle.

Ensuite : *« Échafaudez le projet. »* → `nmt-forge init crk` écrit un espace de travail, une configuration de démarrage, et un `NEXT_STEPS` résumé.

---

## Étape 1 — Créer une division qui ne peut pas tricher

**Vous dites :** *« Voici mon corpus parallèle `corpus.jsonl`. Divisez-le en train/dev/test et enregistrez les ensembles dev et test. »*

**forge fait :** `nmt-forge split corpus.jsonl --test 200 --dev 100 --seed 7
--out data/splits --register mypair`. Il crée une division **disjointe par groupe** : toute paire de phrases qui partagent une source *ou* une cible se retrouvent du **même** côté. C'est le moyen le plus courant de gonfler les scores en ressources limitées — un manuel mappe de nombreux exercices anglais à un seul mot cible, une division aléatoire naïve met une copie en train et son jumeau en test, et le modèle « traduit » les réponses qu'il a mémorisées.

**À quoi ressemble un refus :** si vous donnez à forge une division que vous avez faite vous-même et qu'elle n'est pas disjointe, `verify-split` s'arrête en nommant les clés partagées — *« ces lignes partagent une cible canonique entre train et test. »* Correction : laissez forge faire la division.

---

## Étape 2 — Dépister les fuites

**Vous dites :** *« Avant d'entraîner, vérifiez le corpus d'entraînement pour les fuites par rapport aux ensembles d'évaluation. »*

**forge fait :** `nmt-forge leak-audit corpus.jsonl`. Il dépiste votre corpus par rapport à tous les ensembles dev/test/scellés enregistrés :

- **Doublon exact ou quasi-exact du côté cible** (la réponse de référence est dans vos données d'entraînement) → **fatal**. C'est une fuite de réponse.
- **Quasi-doublon du côté source avec une réponse *différente*** → **informatif, conservé**. Même invite, traduction différente est une paire de contraste minimal légitime, pas une fuite — forge la signale mais ne la supprime jamais. (Cette distinction était un vrai bug que nous avons attrapé en testant nous-mêmes : une version antérieure signalait 44 lignes comme fatales alors que seules 17 étaient des fuites réelles.)

**À quoi ressemble un refus :** *« ligne 118 : quasi-doublon du côté cible de l'ensemble de test `mypair-test` (Jaccard 0,83) — fuite de réponse. »* Correction : votre agent exécute `nmt-forge leak-audit corpus.jsonl --clean-to corpus.clean.jsonl` et entraîne sur les survivants.

---

## Étape 3 — Prédire avant de regarder

**Vous dites :** *« Notez ce que nous attendons du modèle, puis nous entraînerons. »*

**forge fait :** `nmt-forge prereg new p1 --eval-set mypair-test --predictions
predictions.md`. Vous (ou votre agent, à haute voix) engagez des prédictions falsifiables — quelle métrique, quelle direction, quelle ampleur — **avant** qu'aucun score de test n'existe.

**À quoi ressemble un refus :** si votre agent essaie de noter l'ensemble de test sans préenregistrement, `score` refuse : *« noter un ensemble de test est refusé sans un préenregistrement qui précède la première lecture de notation. »* C'est ce qui distingue un résultat d'une narration basée sur les résultats. Correction : préenregistrez d'abord.

:::info Pourquoi cela semble être du travail supplémentaire
C'est le travail. Chaque garde ici est une erreur qui a trompé de vrais chercheurs.
L'outil rend le chemin honnête facile et le chemin malhonnête celui qui vous arrête.
:::

---

## Étape 4 — Vérifiez les portes, puis entraînez

**Vous dites :** *« L'exécution d'entraînement passera-t-elle tous ses contrôles ? Si oui, entraînez. »*

**forge fait :** `nmt-forge preflight run` énumère chaque porte que l'exécution franchira — dev-fence présent, audit de fuite propre, plancher d'horaire dérivé, marge de décodage vérifiée — chacun ✓ ou ✗ avec une correction. Quand tout est vert :
`nmt-forge run config.json`.

L'entraînement est la seule étape qui n'est **pas** un appel d'outil instantané — il utilise un GPU et prend des minutes à des heures. Votre agent l'exécute dans un terminal et regarde les lignes `[schedule-sanity]`. forge dérive le **plancher** d'arrêt anticipé de votre mélange de données, donc une exécution riche en synthétique ne meurt pas à mi-époque quand la perte réelle-dev vacille (un vrai mode de défaillance — voir [Diagnostiquer une exécution d'entraînement](/docs/network/getting-started/diagnosing-training)).

Quand il se termine, forge a **sélectionné un point de contrôle sur l'ensemble dev clôturé** (jamais sur l'ensemble de test) et écrit un `run-manifest.json`.

---

## Étape 5 — Fermer la boucle : évaluer et diagnostiquer

**Vous dites :** *« Notez le modèle sur la batterie de test et dites-moi ce qu'il faut améliorer. »*

**forge fait :** `nmt-forge evaluate .forge/runs/<run>/run-manifest.json --config
config.json`. Cela **ferme la boucle** en une seule commande : il décode la batterie de test avec le point de contrôle que l'exécution a sélectionné, le note (porté par prereg, avec des intervalles de confiance à 95 % sur chaque nombre), et ajoute une section **Diagnostic & Recommandations** en langage clair. (Avant que cette commande n'existe, vous deviez créer un lien symbolique du point de contrôle et exécuter un décodeur à la main — exactement où un novice s'égarait.)

### Comment lire le rapport battery-lint

Le rapport est un tableau de scores **par registre** (manuel, gouvernement, histoire orale, …), chacun avec son intervalle de confiance, suivi du diagnostic. Le diagnostic nomme vos **registres les plus faibles** et, pour chacun, la cause la plus probable et le **levier** à actionner ensuite :

| Si le diagnostic dit… | Cela signifie… | Le levier |
|---|---|---|
| `R1-vocabulary-gap` | le registre score bas **et** les sorties sont inachevées ; le modèle manque de mots | **VOCABULAIRE** — agrandissez le lexique, puis revérifiez l'entonnoir |
| `R2-structure-gap` | les mots sont connus mais les *formes* de phrases ne le sont pas | **STRUCTURE** — ajoutez les constructions manquantes (modèles/compositeur) |
| `R3-mixed-convention` | les sorties mélangent les orthographes | **ORTHOGRAPHE** — normalisez le corpus à une convention, réentraînez |
| `R4-optimism-bound` | le score « complet » est gonflé par des lignes d'évaluation quasi-jumelles | **MESURE** — citez le score strict pour la généralisation |
| `R5-low-power` | l'intervalle de confiance est large | **MESURE** — n'agissez pas sur les deltas plus petits que l'IC ; agrandissez l'ensemble d'évaluation |
| `R7-transfer-plateau` | excellent sur le synthétique, stagnant sur le texte réel | **DONNÉES RÉELLES** — rétrotraduisez les données monolingues ou obtenez de vraies phrases parallèles |

Chaque constatation porte la preuve sur laquelle elle s'est déclenchée. Pour les constatations `--json` sur lesquelles votre agent peut agir par programmation : `nmt-forge lint <battery-manifest.json>`.

---

## Ce que vous venez de faire

Vous avez entraîné un modèle dont vous pouvez réellement croire le score : pas de réponses fuies, un point de contrôle choisi sans regarder l'ensemble de test, des barres d'erreur sur chaque nombre, des prédictions écrites avant les résultats, et un diagnostic qui nomme le prochain levier au lieu de vous laisser deviner. C'est tout l'intérêt — **le résultat honnête est le défaut, et il n'a fallu aucune expertise en TA pour y arriver.**

Quand les chiffres déçoivent (ils le feront, la première fois), allez à [Diagnostiquer une exécution d'entraînement](/docs/network/getting-started/diagnosing-training) — c'est symptôme-d'abord, écrit pour exactement ce moment.
