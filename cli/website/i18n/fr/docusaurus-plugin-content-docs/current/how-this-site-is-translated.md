---
id: how-this-site-is-translated
title: "Comment ce site est traduit"
description: "Chaque locale sur ce site est traduite automatiquement par Champollion lui-même — la même CLI que celle décrite dans cette documentation. Nous utilisons notre propre outil."
---

# Comment ce site est traduit

Ce site est disponible en 13 langues. Chaque paramètre régional, à l'exception de l'anglais, est
**traduit automatiquement par Champollion lui-même** — la même interface en ligne de commande (CLI) que cette documentation
décrit (`npx champollion sync`). Nous utilisons notre propre outil en interne.

Actuellement, chaque paire de langues utilise un modèle unique :
**`google/gemini-3.1-pro-preview`**, traduisant avec le registre
et les directives terminologiques spécifiques à chaque langue décrits ci-dessous. Nous avons délibérément choisi un seul modèle
comme valeur par défaut honnête pendant que nous reconstruisons notre sélection de modèles
basée sur des bancs d'essai (voir ci-dessous) — il s'agit donc d'un choix simple et documenté, et non d'un
résultat que nous présentons pour ce qu'il n'est pas.

Deux choses que vous devez savoir en tant que lecteur :

1. **Ces pages sont des traductions automatiques.** Elles sont produites avec le
   registre et les directives terminologiques décrits ci-dessous, mais aucun humain n'a révisé
   chaque phrase. Si quelque chose semble incorrect, la version anglaise fait
   autorité — et nous serions ravis de recevoir une correction.
2. **Le modèle est une valeur par défaut aujourd'hui, choisi par banc d'essai demain.**
   La conception de Champollion consiste à choisir le modèle de traduction *pour chaque paire
   de langues* par banc d'essai — évaluer chaque candidat sur un corpus de développement et
   traduire ce paramètre régional avec la méthode ayant obtenu le score le plus élevé (les égalités statistiques
   étant départagées par le coût). Nous relançons cette sélection à travers notre propre
   passerelle d'intégrité avant de figer les gagnants par paire ici. **Tant que ces exécutions
   ne sont pas publiées sur le [classement du réseau](/leaderboard), cette page ne
   revendiquera pas une provenance de banc d'essai qu'elle ne peut vous montrer.**

## Provenance par paramètre régional

| Paramètre régional | Langue | Méthode | Modèle | Registre | Dernière synchronisation |
|--------|----------|--------|-------|----------|-------------|
| fr | Français | llm | `google/gemini-3.1-pro-preview` | formel *vous* | 2026-07-18 |
| de | Deutsch | llm | `google/gemini-3.1-pro-preview` | Sie-Form | 2026-07-18 |
| nl | Nederlands | llm | `google/gemini-3.1-pro-preview` | u-vorm | 2026-07-18 |
| fil | Filipino | llm | `google/gemini-3.1-pro-preview` | formel | 2026-07-18 |
| es | Español | llm | `google/gemini-3.1-pro-preview` | latino-américain neutre | 2026-07-18 |
| zh | 简体中文 | llm | `google/gemini-3.1-pro-preview` | technique professionnel | 2026-07-18 |
| ja | 日本語 | llm | `google/gemini-3.1-pro-preview` | です/ます (poli) | 2026-07-18 |
| ko | 한국어 | llm | `google/gemini-3.1-pro-preview` | 해요체 (poli) | 2026-07-18 |
| pt | Português | llm | `google/gemini-3.1-pro-preview` | professionnel | 2026-07-18 |
| th | ไทย | llm | `google/gemini-3.1-pro-preview` | professionnel neutre | 2026-07-18 |
| vi | Tiếng Việt | llm | `google/gemini-3.1-pro-preview` | forme *bạn* neutre | 2026-07-18 |
| ar | العربية | llm | `google/gemini-3.1-pro-preview` | arabe standard moderne, professionnel | 2026-07-18 |

## La sélection par banc d'essai que nous reconstruisons

La méthode prévue — et la façon dont la configuration est structurée pour fonctionner — est
la sélection de modèles par paire, pilotée par notre propre évaluation : évaluer chaque
modèle candidat sur le corpus de développement de la paire, retenir le score
composite le plus élevé, et départager les égalités statistiques par le coût. La boucle complète est
documentée pour quiconque souhaite la reproduire.

Nous ne publions **pas** de scores composites ni de « gagnant du banc d'essai » par
langue sur cette page aujourd'hui, car la campagne de sélection qui justifierait
ces chiffres est d'abord relancée à travers la passerelle d'intégrité du harnais de test.
Lorsqu'elle aboutira, les exécutions figureront sur le classement public, ce tableau
indiquera le modèle gagnant de chaque paire avec son exécution citée, et la configuration du site
figera à nouveau les gagnants par paire. D'ici là : une seule valeur par défaut honnête.

Le *score composite* est la métrique de qualité combinée du réseau (chrF++, correspondance
exacte, et plugins de métriques chargés, vérifiés par bootstrap-CI). Les scores ne sont
comparables **qu'au sein d'une même paire de langues**, jamais entre les paires — les différences d'écriture et
de corpus rendent toute comparaison entre paires dénuée de sens.

## Registre et ton

Chaque langue est traduite avec un registre explicite choisi à partir
des fiches de langue de Champollion, afin que le niveau de formalité soit cohérent sur l'ensemble du site :

- **Français** — vouvoiement (formel *vous*)
- **Deutsch** — Sie-Form
- **Nederlands** — u-vorm
- **Filipino** — formel, avec des termes techniques standards
- **Español** — espagnol latino-américain neutre
- **简体中文** — registre technique professionnel
- **日本語** — です/ます (forme polie)
- **한국어** — 해요체 (poli)
- **Português** — registre professionnel
- **ไทย** — professionnel neutre
- **Tiếng Việt** — forme *bạn* neutre
- **العربية** — arabe standard moderne, registre professionnel

## Ce qui n'est pas traduit automatiquement

Les blocs de code, les commandes CLI, les clés de configuration, les noms de paquets, les URL et
les noms propres sont protégés pendant la traduction et restent en anglais par
conception.

## Vous avez trouvé une erreur de traduction ?

Ouvrez un ticket (issue) ou une demande d'intégration (PR) — la source de chaque page traduite est l'original
en anglais. Les corrections apportées à une page traduite sont préservées lors des synchronisations futures tant
que la source anglaise de cette page reste inchangée (la synchronisation ne retraduit une
page que lorsque sa source anglaise est modifiée).

*Cette page est elle-même traduite automatiquement par la méthode décrite ci-dessus — elle
décrit sa propre traduction.*
