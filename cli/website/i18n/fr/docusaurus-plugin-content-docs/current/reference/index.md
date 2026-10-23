---
title: "Référence"
slug: /reference
description: "Tous les détails techniques réunis en une seule carte : les commandes, les formats de fichiers, les spécifications, les limites techniques, l'hébergement d'un test scellé, le classement, la traduction d'applications et de sites, l'Atlas et l'infrastructure réseau."
---

# Référence

La documentation technique complète, destinée aux développeurs, aux chercheurs et aux agents IA.
Les [pages tout public](/docs/) racontent la même histoire en termes simples, et
[le manuel des agents](/docs/agents) explique comment un agent la pilote ; chaque page
ci-dessous l'expose avec une précision totale.

## Commandes

- [`champollion`](/docs/reference/cli) — chaque commande et option de l'outil
  de projet et du traducteur d'applications et de sites web.
- [`nmt-forge`](/docs/network/getting-started/forge-command-reference) — chaque
  commande de la suite d'entraînement de modèles, générée à partir de son analyseur.
- [`mt-eval`](/docs/reference/mt-eval) — chaque commande du banc
  d'évaluation, générée à partir de son analyseur.
- [Le serveur MCP](/docs/network/getting-started/mcp-server) — les deux profils,
  chaque outil et chaque argument.

## Formats

- [Formats du framework](/docs/reference/formats) — project/1, set/1, method/1,
  gate-chain/1, deployment/1 et service-api/1, d'après leurs schémas.
- [Fiche d'exécution](/docs/network/specifications/run-card) — ce qu'une exécution
  évaluée consigne et publie.
- [Données de coaching](/docs/concepts/coaching-data) — les notes grammaticales et listes
  de mots fournies à une méthode basée sur un LLM.
- [Spécification des greffons](/docs/reference/plugin-spec) — le manifeste de greffon
  de méthode (`method.json`) sous lequel une méthode de traduction est livrée.
- [Fiche linguistique](/docs/reference/language-card-spec) — le schéma d'une fiche
  dans l'Atlas.

## Spécifications

- [Calcul des scores](/docs/network/specifications/scoring) — scoring standard/1 : la
  mesure principale chrF++ de corpus avec son intervalle de bootstrap à 95 %, les métriques
  standard à ses côtés et les diagnostics tenus à l'écart.
- [Significativité](/docs/network/specifications/significance) — tests appariés,
  et critères déterminant quand une exécution est meilleure qu'une autre.
- [Interface des méthodes](/docs/network/specifications/methods) — ce qu'est une méthode,
  ses classes et ses dépendances.
- [Fiabilité des métriques](/docs/network/specifications/metric-reliability) —
  à quelle métrique se fier selon le type de langue, d'après les jugements humains.
- [Benchmark](/docs/network/specifications/benchmark) — le protocole que chaque
  exécution valide suit.
- [Banc d'évaluation](/docs/network/specifications/harness) — comment `mt-eval` s'exécute,
  évalue et publie.
- [Validation par les locuteurs](/docs/network/specifications/speaker-validation) — l'évaluation
  humaine dont les scores automatiques tiennent lieu.

## Limites techniques

- [Limites techniques](/docs/network/honest-limitations) — ce qui n'est pas revendiqué :
  niveaux de confiance autodéclarés, absence actuelle de révision par des locuteurs, garde des tests scellés et absence d'indice de confiance par phrase.

## Héberger un test scellé

- [Organiser un concours souverain](/docs/network/sovereignty/run-a-sovereign-contest)
  — le guide opérationnel de bout en bout pour un jeu de test qui ne quitte jamais la machine de l'hôte.
- [Nœud d'évaluation souverain](/docs/network/sovereignty/sovereign-eval-node) — la
  machine de calcul des scores : matériel, isolation physique et cérémonie des clés.
- [Enregistrement de corpus](/docs/network/sovereignty/registering-corpora) —
  niveaux d'exposition et filières de licence pour un corpus en votre possession.
- [Propriété et conditions](/docs/network/sovereignty/ownership-transfer) et
  [Modèles de conditions](/docs/network/sovereignty/terms-templates) — ce qu'une soumission
  cède, déclaré avant toute participation.
- [Prix](/docs/network/specifications/prizes) — ce qu'exige un prix, si un
  commanditaire en ouvre un.

## Classement et publication

- [Classement et publication](/docs/reference/leaderboard) — ce qu'est le tableau
  de classement, les deux types de bancs d'essai et ce qu'une exécution publiée comporte.
- [Règles de soumission](/docs/network/leaderboard/rules) — ce qui est accepté,
  ce qui est disqualifié et les niveaux de vérification.
- [Jeux de données d'évaluation](/docs/network/leaderboard/datasets) — les jeux de
  données enregistrés et leurs filières de licence.
- [Soumettre une méthode](/docs/network/getting-started/submit-a-method) — exécuter le
  banc d'évaluation et publier une fiche d'exécution.
- [Contribuer de la puissance de calcul](/docs/network/getting-started/contributing-compute) —
  traiter des éléments de la file d'attente publique avec votre propre clé.
- [FAQ](/docs/network/getting-started/faq) — métriques, modèles, FST et
  disqualification.

## Traduction d'applications et de sites web

- [Traduction d'applications et de sites web](/docs/intro) — ce que fait `champollion sync`, et
  un guide pour chaque page qui s'y rapporte : démarrage rapide, installation, configuration,
  frameworks, CI/CD, méthodes, contenu, mémoire de traduction, porte de contrôle qualité,
  sécurité, scripts, traducteurs et dépannage.

## L'Atlas

- [L'Atlas](/docs/atlas) — ce qu'est l'index des langues et d'où proviennent ses faits.
- [Spécification des fiches linguistiques](/docs/reference/language-card-spec) et la
  [procédure de citation](/docs/reference/language-card-citation-procedure) —
  chaque champ, et la façon dont chacun est cité.
- [Ce qui compte comme une langue](/docs/network/context/what-counts-as-a-language)
  — les réponses apportées par l'index, et leurs raisons.
- [Contribuer à l'index](/docs/network/getting-started/submit-to-the-index) et
  [Signaler des erreurs](/docs/network/perspectives/reporting-errors-and-owning-corrections)
  — proposer une entrée ou une correction.

## Infrastructure du réseau

- [Construction de la file d'attente](/docs/network/specifications/queue-construction) et
  [pourquoi la file d'attente est construite ainsi](/docs/network/perspectives/why-the-queue)
  — comment la file de travail publique classe ce qu'il convient de mesurer ensuite.
- [Force de connexion](/docs/network/specifications/connection-strength) —
  ce qu'un arc sur la carte du réseau indique au sujet d'une paire, et l'échelle d'intensité
  qui a été retirée.
- [Contribuer de la puissance de calcul](/docs/network/getting-started/contributing-compute) —
  exécuter la file d'attente.
