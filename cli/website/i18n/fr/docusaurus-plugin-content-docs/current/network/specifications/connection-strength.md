---
sidebar_position: 7
title: "Force de la connexion"
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

Lorsque la carte du réseau trace un arc entre deux langues, sa couleur répond
à une seule question : **cette paire a-t-elle réellement été mesurée ?**

C'est délibérément moins que ce que la carte prétendait auparavant. Jusqu'au 04-09-2026, un arc
était coloré selon un dégradé de force à cinq niveaux — à quel point la meilleure traduction
était *bonne*, sur une échelle corrigée du hasard. Ce dégradé a été retiré. Cette page
explique le chiffre qui le sous-tendait, pourquoi sa suppression était la décision la plus honnête,
et ce que la carte indique désormais.

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

Ce problème est réel, et c'est pourquoi la carte ne classe **pas** la force entre
les langues. Ce n'est pas un problème que nous avons résolu.

## La correction que nous avons conçue, et pourquoi elle ne colore plus la carte

Le **chrF++ corrigé du hasard (cchrF++)** rééchelonne un score de sorte que 0 signifie « pas
meilleur que le hasard » *dans cette langue* et 1 signifie parfait :

```
cchrF++ = (chrF++ − floor) / (100 − floor)
```

Les planchers sont mesurés et non supposés : pour chaque langue, nous exécutons une estimation
Monte-Carlo — des milliers de lignes de base aléatoires de même orthographe évaluées par rapport à de réelles
références — en utilisant uniquement du texte monolingue accessible au public (FLORES-200 dev,
récupéré à la source, jamais redistribué). Le tableau des planchers couvre 196
langues et constitue un artefact issu de Champollion.

**Ce que cette correction établit réellement.** Le plancher du hasard existe, varie
d'un facteur neuf environ selon les systèmes d'écriture, et peut être estimé à partir de texte monolingue
sans aucune étiquette de qualité humaine. Le soustraire élimine de manière démontrable
la composante aléatoire des lignes de base triviales : une triche consistant à copier la source,
qui obtient plus de 15 en score brut en finnois, chute à environ 2,5, et dans la plupart des langues à exactement
zéro. Le « hasard » ainsi éliminé relève de statistiques de surface, non d'un résidu de sens.

**Ce qu'elle n'établit pas.** Elle fait en sorte que **0** signifie la même chose dans chaque
langue. Elle ne fait pas en sorte que **40** signifie la même chose. Au-dessus du plancher, la
correction est un simple rééchelonnement linéaire, et la preuve qu'une *qualité* égale
aboutit à des scores corrigés égaux d'une langue à l'autre n'est démontrée qu'au
bas de l'échelle. Confrontée à des groupes de jugements humains, elle est utile lorsque les
planchers diffèrent réellement, n'a aucun effet lorsqu'ils ne diffèrent pas, et sur un groupe présentant
des planchers uniformément bas, elle a fait évoluer la concordance avec les évaluateurs humains dans la *mauvaise* direction — un
résultat que nous n'avons pas élucidé.

Colorer une carte publique avec un dégradé de force à cinq bandes affirmait plus que ce que
ces données probantes ne justifient, précisément pour les langues à faibles ressources où se tromper
a le plus d'impact. Le dégradé est donc retiré jusqu'à ce que des études complémentaires tranchent la question.

Notez que colorer plutôt selon le score chrF++ **brut** n'a jamais été envisageable : les scores
bruts ne sont absolument pas comparables d'une langue à l'autre, ce qui constitue la raison même
pour laquelle la correction a été conçue. Un encodage binaire est la solution de repli honnête, et non
une rétrogradation vers quelque chose de plus faible.

## La place de la mesure dans la hiérarchie

Du plus au moins digne de confiance :

1. **Vérification humaine** — des locuteurs maîtrisant la langue évaluant les résultats ([validation
   par les locuteurs](/docs/network/specifications/speaker-validation)). Rien
   d'automatique ne lui est supérieur.
2. **Annotation d'experts de type MQM** ([Multidimensional Quality
   Metrics](https://aclanthology.org/2014.tc-1.6/), Lommel et al.) — le
   protocole que WMT utilise pour ses jugements de référence ; coûteux, rare, excellent.
3. **Scores automatiques — au sein d'une seule paire de langues.** Le chrF++ brut, BLEU,
   COMET et les autres sont utiles pour comparer des systèmes sur la *même* paire ;
   consultez [Fiabilité des métriques](/docs/network/specifications/metric-reliability)
   pour constater à quel point chacun peut mal refléter le jugement humain sur votre paire.
4. **Force interlinguistique.** Nous ne publions aucun classement. Voir ci-dessus.

À mesure que les résultats vérifiés par l'homme et de qualité MQM entrent
dans le tableau, ils prennent précédence sur les scores automatiques pour la
même paire.

## Comment la carte le dessine

Chaque canal visuel porte exactement un sens :

| Canal | Signification |
|---------|---------|
| **Couleur** | mesuré. Une seule couleur, pas de dégradé — l'arc indique qu'une exécution a évalué cette paire, et ne dit rien sur la qualité |
| **Tireté + estompé** | provisoire : le jeu de test est sous le [seuil de significativité](/docs/network/specifications/significance) (n &lt; 100), où des écarts de score de l'ordre de ~5 chrF++ relèvent du bruit. Il s'agit d'une propriété de la taille de l'échantillon, indépendante de toute métrique |
| **Largeur** | constante. Il ne reste plus rien à encoder |

Seules les paires **mesurées** tracent un arc mesuré. Les paires enregistrées — en attente
de mesure mais pas encore évaluées — apparaissent sous la forme de fins traits estompés
en aplat de couleur dont la couleur indique uniquement *comment la paire est accessible aujourd'hui*
(API commerciale · modèle open-source · modèle frontière, sans fournisseur), et jamais à quel
point la traduction est bonne. Les deux vocabulaires sont délibérément disjoints :
des filets en aplat atténués = accessibilité, l'unique couleur mesurée = mesuré.
Le score sous-jacent d'un arc est la meilleure exécution mesurée pour cette paire sur le
tableau public, actualisé automatiquement à mesure que de nouvelles exécutions arrivent, et est affiché sous la
forme d'un chiffre propre à la paire lorsque vous ouvrez l'arc — jamais comme un rang interlinguistique.

## Les petits caractères

- Les planchers du hasard sont des propriétés métrique × orthographe estimées à partir
  de texte monolingue uniquement ; aucun contenu de corpus parallèle n'est impliqué ni stocké.
- L'atlas des planchers et la correction demeurent des recherches publiées, et le code
  reste dans le dépôt sous test. Ils ne sont reliés à aucune interface publique.
- **Elle corrige le plancher, pas le plafond.** Le score maximal qu'une traduction
  véritablement bonne peut atteindre varie toujours selon la langue, et la correction
  n'y change rien.
- **Elle ne protège pas contre la copie entre écritures partagées.** Un résultat qui
  copie simplement la source peut toujours obtenir un score supérieur au hasard lorsque la source et la cible partagent
  un système d'écriture.
- **Elle ne peut pas réordonner les systèmes au sein d'une même paire de langues.** Au-dessus du plancher, la
  correction est un simple rééchelonnement linéaire, de sorte que les classements intra-paire sont identiques
  avant et après — sa seule valeur potentielle concernait la comparaison entre paires.
- Un arc mesuré vous indique qu'une paire a été évaluée. Il ne valide **pas**
  le sens, le registre ou l'adéquation culturelle. Cela relève toujours de jugements humains ([limites
  honnêtes](/docs/network/honest-limitations)).
- La méthodologie des planchers du hasard est une recherche menée par Champollion, publiée ici
  précisément pour pouvoir être vérifiée et remise en question.
