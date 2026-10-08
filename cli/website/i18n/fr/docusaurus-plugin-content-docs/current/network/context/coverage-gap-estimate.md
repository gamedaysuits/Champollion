---
sidebar_position: 5
title: "L'écart de couverture : comment nous l'estimons"
description: "Comment Champollion justifie le chiffre de « plus d'un milliard de personnes » — la méthode, les deux choix méthodologiques qui le sous-tendent, et pourquoi le site indique délibérément un plancher prudent. Les corrections et les débats sont les bienvenus."
---

# L'écart de couverture : comment nous l'estimons

> **Résumé analytique.** La page d'accueil de Champollion indique que *plus d'un milliard* de personnes en vie aujourd'hui n'ont pas accès à la traduction automatique dans leur langue maternelle. Cette page présente l'arithmétique derrière cette phrase, nomme les deux choix méthodologiques qui font varier ce nombre, et explique pourquoi nous publions un seuil prudent plutôt que le total brut plus élevé. Champollion est un index, non une autorité — chaque chiffre ici peut être déduit du build public, et toute correction est la bienvenue.

## La question que nous posons réellement

Non pas « combien de langues manquent de traduction automatique (TA) », mais **combien de personnes n'ont pas accès à la traduction automatique dans leur première langue.** La première langue (L1) d'une personne est celle dans laquelle elle pense et dans laquelle elle préférerait lire les actualités. Le bilinguisme ne soustrait personne de ce décompte : un bilingue quechua-espagnol dont la première langue est le quechua ne peut toujours pas lire une page web *en quechua*. La population cible est donc : toute personne dont la L1 est l'une des langues vivantes qu'aucun moteur de TA dédié ne prend en charge.

## Comment ce nombre est calculé

Deux éléments, tous deux présents dans le dépôt :

1. **Quelles langues vivantes disposent de la TA.** Le build croise l'union des listes de langues de neuf moteurs suivis (Google, Microsoft, DeepL, LibreTranslate, NLLB-200, OPUS-MT, M2M-100, MADLAD-400, Tilde — `shared/catalogue/method-coverage.json`, chaque liste étant citée et datée) avec les langues *individuelles vivantes* de la norme ISO 639-3 (`isoType: 'L'`) dans `data/tc-index.json`. Résultat : **552 langues vivantes couvertes, 6 525 non couvertes**, sur un total de **7 077** langues vivantes (`stats.coverage.dedicatedLiving` / `uncoveredLiving`).
2. **Combien de personnes parlent les langues non couvertes.** Pour chaque langue vivante non couverte, nous prenons son `speakerCount` (tiré des estimations citées dans la fiche de la langue) et nous en faisons la somme. Le build génère cela sous la forme `stats.coverageGap`. La somme brute pour l'ensemble des 6 525 langues non couvertes est d'environ **2,9 milliards** (`uncoveredSpeakerSumRaw` ≈ 2 974 871 273).

Ces 2,9 milliards représentent une estimation **plutôt haute**, et nous le disons clairement.

### Pourquoi la somme brute n'est pas parfaite

`speakerCount` mélange les locuteurs de première langue (L1) et le total des locuteurs (L1+L2) selon ce que chaque source rapporte, et une personne multilingue peut être comptabilisée dans plus d'une langue. L'indice révélateur : faire la somme de `speakerCount` pour *toutes* les 7 082 langues vivantes donne environ **10,8 milliards** — soit plus que les ~8,1 milliards de personnes en vie (Perspectives de la population mondiale de l'ONU). Un recensement L1 strict ne peut pas dépasser la population mondiale ; celui-ci le fait, ce qui prouve que le champ n'est pas purement L1.

## Deux choix méthodologiques (chacun modifiant le nombre)

**(a) Décomptes L1 uniquement contre décomptes totaux.** Se restreindre aux locuteurs de première langue réduirait l'estimation — les locuteurs L2 sont, par définition, des personnes qui *possèdent* une autre langue. Cependant, les chiffres L1 par langue ne sont pas uniformément disponibles dans les sources que nous citons, nous ne pouvons donc pas appliquer une règle strictement L1 partout sans inventer des nombres. L'utilisation du décompte mixte pousse l'estimation *vers le haut*.

**(b) Les 777 langues non couvertes sans décompte rapporté.** Sur les 6 525 langues vivantes non couvertes, **5 748 comportent un nombre de locuteurs et 777 n'en ont pas** (`uncoveredWithCount` / `uncoveredNoCount`). Mettre ces 777 langues de côté — ce que fait la somme brute — *sous-estime* le total, car il s'agit de langues réelles avec des locuteurs réels (non mesurés), la plupart d'entre elles étant minoritaires et menacées.

Ainsi, les deux biais pointent dans des directions opposées : le mélange L1/L2 gonfle le chiffre, et la traîne des 777 langues le dégonfle.

## Pourquoi nous rapportons un seuil de « plus d'un milliard »

La fourchette plausible s'étend d'un seuil proche de **1 milliard** jusqu'au chiffre brut d'**environ 2,9 milliards**. Même après avoir fortement déduit les doubles comptages L2 *et* mis de côté l'entièreté de la traîne non mesurée des 777 langues, la population de première langue des langues non couvertes reste largement supérieure à un milliard. Plutôt que de mettre en avant le nombre le plus élevé et le plus imprécis, le site rapporte l'extrémité prudente. « Plus d'un milliard » est l'affirmation dont nous sommes les plus convaincus qu'elle résistera à un examen minutieux.

## Ce qui pourrait modifier ce chiffre

Une estimation plus précise nécessite **des chiffres de locuteurs L1 par langue, chacun accompagné d'une citation**, afin que nous puissions additionner les L1 directement au lieu du mélange L1/L2, et que nous puissions attribuer une estimation justifiable aux 777 langues actuellement non comptabilisées. À mesure que les moteurs ajoutent des langues, le chiffre de 552 augmente et l'écart se réduit ; à mesure que les fiches obtiennent des décomptes mieux sourcés, la somme s'affine. Il s'agit d'une **estimation continue**, recalculée à chaque build — et non d'un fait figé.

## Corrections et débats bienvenus

Si vous disposez de meilleures données, si vous pensez qu'une décision ici est erronée, ou si vous pouvez sourcer les 777 langues manquantes, dites-le-nous. C'est là tout l'objectif. Ouvrez un ticket sur [github.com/gamedaysuits/Champollion/issues](https://github.com/gamedaysuits/Champollion/issues) ou envoyez un e-mail à [info@champollion.dev](mailto:info@champollion.dev).

---

## Sources

- **Couverture** — `cli/shared/catalogue/method-coverage.json` (neuf moteurs, chaque liste étant citée et datée) ∩ langues individuelles vivantes ISO 639-3 dans `cli/website/data/tc-index.json` ; exposées sous forme de `stats.coverage.dedicatedLiving` / `uncoveredLiving`. Dérivé de Champollion.
- **Sommes des locuteurs** — `speakerCount` sur les lignes `tc-index.json` (à partir du `speakerEstimates` cité dans chaque fiche de langue), additionnées par le build dans `stats.coverageGap` (`uncoveredSpeakerSumRaw`, `uncoveredWithCount`, `uncoveredNoCount`). Dérivé de Champollion ; mélange L1/L2 selon la source.
- **Population mondiale** — environ 8,1 milliards (Nations Unies, *Perspectives de la population mondiale*), utilisée uniquement comme limite de cohérence pour les sommes des locuteurs.

## Où cela mène-t-il sur ce site

Ces chiffres représentent l'ampleur du problème. La réponse du site à ce sujet commence
à [Ce qu'est Champollion](/docs/what-is-champollion) ; la méthodologie derrière
la séparation couverte/non couverte se trouve dans
[comment la couverture est comptabilisée](/docs/network/context/coverage-counting), et les
langues du mauvais côté de la ligne — classées selon qui pourrait le plus
vraisemblablement construire un ensemble d'évaluation ensuite — sont publiées dans la
[liste de souhaits de corpus](https://champollion.dev/corpus-wishlist.json).
