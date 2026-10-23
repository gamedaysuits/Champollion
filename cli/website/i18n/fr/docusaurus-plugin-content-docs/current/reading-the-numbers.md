---
title: "Lire les chiffres"
slug: /reading-the-numbers
description: "Ce que signifie chaque chiffre affiché par les rails, en mots simples : le score sur 100, la part de brouillons marqués comme corrects par le·la locuteur·rice, les fourchettes et « aucun changement mesurable »."
---

# Lire les chiffres

Les rails vous présentent des chiffres à chaque étape. Chacun d'entre eux n'est utile que si vous en connaissez trois aspects : **ce qu'il mesure**, **sur quelle échelle** et **sur quelles phrases**. Les outils indiquent ces trois éléments, et votre assistant a pour consigne de le faire également. Cette page détaille chaque catégorie.

## La part des propositions jugées correctes par la personne locutrice

**Le chiffre qui compte le plus.** À chaque cycle, une personne locutrice évalue les propositions du traducteur comme correctes ou incorrectes. *« 31 propositions sur 40 jugées correctes »* signifie exactement ce que cela indique : sur les 40 phrases que votre famille souhaitait faire traduire lors de ce cycle, la personne locutrice en a jugé 31 correctes.

Aucune mesure informatique ne remplace le jugement d'une personne locutrice. Mais cela dépend des phrases : une semaine facile et une semaine difficile peuvent donner des chiffres différents avec le même traducteur. C'est pourquoi les outils mesurent également de la même manière à chaque fois, sur les mêmes phrases — c'est le score.

## Le score, sur 100

Un **score** est un nombre de 0 à 100 indiquant à quel point les phrases du traducteur se rapprochent de la façon dont une personne locutrice a rédigé ces mêmes phrases. Il comptabilise les lettres et les mots correspondants et accorde un crédit partiel : une traduction presque exacte obtient un score plus élevé qu'une traduction très éloignée. 100 signifie identique.

Deux points essentiels :

- **Il mesure la proximité, non l'exactitude.** Une bonne traduction formulée différemment de celle de la personne locutrice peut obtenir un score faible. Une traduction fluide dont le sens est différent peut obtenir un score assez élevé. C'est pourquoi la vérification par une personne locutrice importe davantage.
- **Il ne s'agit pas d'un pourcentage de phrases correctes.** Un score de 60 ne signifie pas que 60 phrases sur 100 étaient correctes.

Pour aller plus loin : ce score s'appelle **chrF++**, et constitue la méthode usuelle dans ce domaine pour comparer des traducteurs. Les outils en rapportent également d'autres à ses côtés.

## Intervalles

La plupart des chiffres s'accompagnent d'un **intervalle**, comme *14–22*. Il ne s'agit pas de deux résultats distincts. Cela représente le degré de certitude des outils : la valeur réelle se situe très probablement dans cette plage. Avec peu de phrases, l'intervalle est large. Avec beaucoup de phrases, il se resserre.

Lorsque deux intervalles se chevauchent largement, les deux traducteurs peuvent en réalité être équivalents.

## Quelles phrases

Un chiffre précise toujours sur quelles phrases il a été mesuré :

- **Phrases de test** — celles vérifiées par une personne locutrice et sur lesquelles le traducteur n'a jamais appris. Utilisées pour les résultats déterminants, et seulement de temps à autre.
- **Phrases de pratique** — mises de côté à partir de vos données, et sur lesquelles le traducteur n'a jamais appris non plus. Utilisées pour évaluer chaque cycle, afin de préserver la nouveauté des phrases de test.
- **Phrases de votre cycle** — celles que votre famille souhaitait traduire ; les évaluations de la personne locutrice portent sur celles-ci.

Un chiffre mesuré sur des phrases ayant servi à l'apprentissage du traducteur n'aurait aucun sens ; les rails ne vous en présenteront donc jamais comme résultat.

## « Aucun changement mesurable »

Cela ne signifie pas que rien n'a changé. Cela signifie que tout changement éventuel était trop minime pour être distingué du hasard, compte tenu du nombre de phrases de pratique dont vous disposez. Les outils indiquent l'ampleur minimale du changement qu'ils *auraient pu* détecter. Disposer de davantage de phrases de pratique leur permet de déceler des changements plus faibles — c'est pourquoi, tant que l'ensemble de pratique reste restreint, certaines lignes de la feuille de chaque cycle sont laissées à la personne locutrice pour qu'elle les rédige.

## « Trop peu de phrases d'entraînement pour se prononcer »

Avec moins de 50 phrases d'entraînement, aucun score ne peut indiquer de manière fiable lequel de deux
traducteurs est le meilleur. Sur notre langue d'entraînement, avec 23 phrases d'entraînement,
la règle prudente a jugé différents deux traducteurs presque équivalents 9 fois sur
100 — et n'a détecté un gain réel d'environ 6 points sur 100 que 21 fois sur
100. Avec 50, ces chiffres étaient de 4 et 96. En dessous de 50, les outils ne se prononcent donc pas. Celui que vous utilisez est maintenu, et les évaluations du locuteur sur
la feuille suivante tranchent.

## Le seuil du dictionnaire

Si vous avez fourni une liste de mots, vous verrez un score correspondant à la *simple recherche de chaque mot*. C'est le niveau plancher : un traducteur ne vaut la peine d'être utilisé que lorsqu'il obtient un score supérieur. Avec très peu de phrases, un premier traducteur peut se situer en deçà. C'est une information utile, qui ne doit pas être dissimulée.

## Un chiffre présent sur nos pages : « sens exact »

Lorsque nous parlons de notre langue d'exercice fictive, vous verrez la mention *« 79 sur 100 exactement correctes »*. Il s'agit là d'une proportion de phrases : un ordinateur a vérifié chaque élément du sens de chaque traduction par rapport à la grammaire propre à cette langue inventée. Cela n'est possible que pour une langue que nous avons créée, dont la réponse exacte est connue avec précision. Pour une langue réelle, l'équivalent le plus proche réside dans les évaluations d'une personne locutrice.

**Étape suivante :** [Améliorer pas à pas, cycle après cycle →](/docs/make-it-better)

## Approfondir

- [Règles de mesure](/docs/agents/measurement) — les règles exactes : chrF++ avec son intervalle à 95 %, la comparaison appariée, les seuils de validation et les taux de refus.
- [Spécification du calcul des scores](/docs/network/specifications/scoring) — comment chaque score publié est calculé.
- [Significativité](/docs/network/specifications/significance) — comment il est déterminé qu'une amélioration « dépasse le simple hasard ».
