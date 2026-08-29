---
sidebar_position: 7
title: "Force de connexion (cchrF++)"
slug: '/network/specifications/connection-strength'
related:
  - label: "Scoring Specification"
    to: /docs/network/specifications/scoring
    kind: spec
    note: "How individual runs are scored"
  - label: "Metric Reliability"
    to: /docs/network/specifications/metric-reliability
    kind: spec
    note: "How well each metric tracks human judgment, per language pair"
  - label: "Statistical Significance Testing"
    to: /docs/network/specifications/significance
    kind: spec
---

# Force de connexion

Lorsque la carte réseau trace un arc entre deux langues, sa couleur répond
à une question : **quelle est la qualité de la meilleure traduction mesurée
entre elles — honnêtement ?**

La partie honnête est plus difficile qu'il n'y paraît. Cette page explique,
en langage clair, le nombre derrière la couleur.

## Le problème : les scores bruts ne sont pas zéro à zéro

La plupart de nos scores sont **chrF++** (F-score des n-grammes de caractères,
[Popović 2017](https://aclanthology.org/W17-4770/)) — il mesure le chevauchement
des caractères et des mots d'une traduction avec une traduction de référence,
de 0 à 100.

Mais *le texte aléatoire n'est pas zéro*. Chaque système d'écriture offre un
chevauchement « gratuit » : une orthographe avec peu de caractères distincts,
ou des mots longs prévisibles, obtient un score mesurable au-dessus de zéro
même lorsque la « traduction » est du charabia. Ce chevauchement gratuit —
le **plancher aléatoire** — diffère selon la langue. Dans nos mesures, il
varie d'environ 1,6 (écriture chinoise) à plus de 13 (certaines langues à
script latin et arabe). Un chrF++ brut de 14 est du bruit quasi aléatoire
dans une langue et un vrai signal dans une autre — donc le chrF++ brut n'est
**pas comparable entre les langues**, et une carte coloriée selon celui-ci
favoriserait silencieusement certains systèmes d'écriture.

## La solution : soustraire le plancher

**Le chrF++ corrigé du hasard (cchrF++)** redimensionne le score de sorte que
0 signifie « pas mieux que le hasard » *dans cette langue* et 1 signifie
parfait :

```
cchrF++ = (chrF++ − floor) / (100 − floor)
```

Les planchers sont mesurés, non supposés : pour chaque langue, nous exécutons
une estimation de Monte-Carlo — des milliers de lignes de base aléatoires de
même orthographe évaluées par rapport à des références réelles — en utilisant
uniquement du texte monolingue disponible publiquement (FLORES-200 dev,
récupéré à la source, jamais redistribué). Le tableau des planchers couvre
actuellement 196 langues et est un artefact dérivé de Champollion
(`champollion-derived` provenance ; régénéré par
`cli/website/scripts/build-cchrf-floors.mjs`).

Deux règles conservatrices maintiennent la correction honnête :

- **Une paire n'est corrigée que lorsque LES DEUX côtés ont un plancher
  mesuré.** Si l'un des deux est manquant, l'arc s'affiche en ardoise neutre
  — *mesuré, plancher inconnu* — et ne monte jamais sur la rampe de couleur.
- **La paire utilise le PLUS ÉLEVÉ des deux planchers.** La correction peut
  sous-estimer la force, jamais la gonfler.

## Où se situe cchrF++ dans la hiérarchie

cchrF++ est notre meilleure mesure de force *automatique* — ce n'est pas le
sommet de la hiérarchie. Du plus au moins fiable :

1. **Vérification humaine** — des locuteurs courants jugeant la sortie
   ([validation par locuteur](/docs/network/specifications/speaker-validation)).
   Rien d'automatique ne la surpasse.
2. **Annotation d'expert de style MQM** ([Multidimensional Quality
   Metrics](https://aclanthology.org/2014.tc-1.6/), Lommel et al.) — le
   protocole que WMT utilise pour ses jugements de référence ; coûteux, rare,
   très bon.
3. **cchrF++** — corrigé du hasard, comparable entre les langues, bon marché
   à calculer partout.
4. **chrF++ brut / BLEU / métriques neurales** — utiles au sein d'un ensemble
   de données ; voir [Fiabilité des métriques](/docs/network/specifications/metric-reliability)
   pour voir à quel point chacune peut mal suivre le jugement humain sur votre
   paire.

À mesure que les résultats vérifiés par l'homme et de qualité MQM entrent
dans le tableau, ils prennent précédence sur les scores automatiques pour la
même paire.

## Comment la carte le dessine

Chaque canal visuel porte exactement un sens :

| Canal | Sens |
|---------|---------|
| **Couleur** | bande cchrF++ — cinq étapes, rouge à vert doux : *près du plancher* (&lt; 0,15), *faible* (0,15–0,35), *en développement* (0,35–0,55), *utilisable* (0,55–0,75), *fort* (≥ 0,75) |
| **Ardoise neutre** | mesuré, mais le plancher aléatoire est inconnu pour au moins un côté — jamais placé sur la rampe de couleur |
| **Pointillé + atténué** | provisoire : l'ensemble de test est en dessous du [plancher de signification](/docs/network/specifications/significance) (n &lt; 100), où les écarts de score dans ~5 chrF++ sont du bruit |
| **Largeur** | répète la bande de couleur (redondance d'accessibilité, pas une deuxième variable) |

Seules les paires **mesurées** montent la rampe de force. Les paires
enregistrées — en attente de mesure mais pas encore évaluées — apparaissent
comme des traits fins de couleur plate et pâles dont la couleur dit seulement
*comment la paire est accessible aujourd'hui* (API commercial · modèle
open-source · frontière, aucun fournisseur), jamais à quel point quelque chose
se traduit bien. Les deux vocabulaires sont délibérément disjoints : les fils
plats atténués = accessibilité, la rampe rouge→vert = force mesurée. Le score
sous-jacent d'un arc est la meilleure exécution mesurée pour cette paire sur
le tableau public, actualisé automatiquement à mesure que de nouvelles
exécutions arrivent.

## Les petits caractères

- Les planchers sont des propriétés de métrique × orthographe estimées à partir
  de texte monolingue uniquement ; aucun contenu de corpus parallèle n'est
  impliqué ou stocké.
- cchrF++ vous dit qu'une traduction bat le hasard et de combien — elle ne
  **valide pas** le sens, le registre ou l'adéquation culturelle. Ceux-ci
  restent des jugements humains ([limitations honnêtes](/docs/network/honest-limitations)).
- La méthodologie du plancher aléatoire est une recherche Champollion ; l'atlas
  des planchers et la correction sont publiés ici précisément pour qu'ils
  puissent être vérifiés et contestés.
