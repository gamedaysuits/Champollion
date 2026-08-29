---
sidebar_position: 6
title: "Spécification de fiabilité des métriques"
slug: '/network/specifications/metric-reliability'
related:
  - label: "Scoring Specification"
    to: /docs/network/specifications/scoring
    kind: spec
    note: "What each metric measures and how the harness computes it"
  - label: "Statistical Significance Testing"
    to: /docs/network/specifications/significance
    kind: spec
    note: "When a score difference actually means something"
  - label: "Benchmark Specification"
    to: /docs/network/specifications/benchmark
    kind: spec
  - label: "Eval Harness v2.0"
    to: /docs/network/specifications/harness
    kind: spec
---

# Spécification de fiabilité des métriques

> **Résumé exécutif.** Un score de référence n'est aussi significatif que la
> métrique qui le sous-tend — et les métriques automatiques ne concordent pas
> avec le jugement humain de manière égale selon les langues. Ce document
> spécifie comment Champollion mesure la **fiabilité des métriques** : pour
> chaque famille linguistique, la force avec laquelle chaque métrique
> automatique (BLEU, spBLEU, chrF, chrF++, COMET, MetricX) se corrèle avec
> les jugements de qualité humains, calculée à partir des archives de la
> tâche partagée WMT Metrics (2019–2025). Le résultat est un artefact
> d'évidence publié et lisible par machine que le harnais, l'interface de
> ligne de commande et le serveur MCP consultent avant de présenter un score
> comme digne de confiance. À notre connaissance, aucune autre infrastructure
> d'évaluation ne publie cette évidence par langue ; c'est ce qui transforme
> « nous avons exécuté une métrique » en « voici à quel point il faut la
> croire ».
>
> **Portée.** Ce document définit *ce que l'évidence de fiabilité est, d'où
> elle provient, exactement comment elle est calculée, et ce qu'elle exclut
> délibérément*. Les définitions des métriques elles-mêmes se trouvent dans
> la [Spécification de notation](/docs/network/specifications/scoring) ;
> les tests statistiques des différences de scores se trouvent dans
> [Signification](/docs/network/specifications/significance). L'importateur
> qui régénère l'artefact est `arena/scripts/import_wmt_metaeval.py` dans le dépôt du harnais — le
> code est la parole finale sur les détails d'implémentation, et il est
> ouvert à l'examen.

---

## 1. Le problème que cela résout

La qualité de la traduction automatique est, en fin de compte, un jugement
humain. Les métriques automatiques existent parce que l'évaluation humaine
est lente et coûteuse ; chaque score automatique est un *substitut* de ce
qu'un bilingue compétent dirait. Le raccourci du domaine entier — « le
système A surpasse le système B de 2 BLEU » — suppose silencieusement que
le substitut est fidèle.

Cette hypothèse a été testée pendant des années par la tâche partagée WMT
Metrics, mais presque toujours *en agrégat* : les métriques sont classées
par corrélation moyenne avec le jugement humain sur les paires de langues
que la campagne de cette année couvrait — principalement des paires
européennes à ressources élevées plus le chinois et le japonais. Le détail
par langue existe dans les données brutes et dans les articles de résultats
par année, mais il n'est publié nulle part en tant que couche d'évidence
interrogeable par famille linguistique que un pipeline d'évaluation peut
consulter.

Le détail importe énormément pour les langues à faibles ressources et
morphologiquement riches. Deux résultats de notre propre importation
illustrent les enjeux (§7 contient le tableau complet) :

- **Anglais→Inuktitut (wmt20).** La corrélation au niveau du système de BLEU
  avec le jugement humain est **+0,16** — essentiellement non informatif.
  chrF atteint +0,35. COMET atteint +0,86. Un classement fondé sur BLEU
  pour cette paire classerait du bruit ; le même classement fondé sur COMET
  porte un signal.
- **Anglais→Maasai (wmt25).** L'inverse de l'échec : la corrélation de
  MetricX-25 est **−0,09** — une métrique *apprise* de pointe notant une
  langue absente de ses données d'entraînement produit des nombres non
  corrélés avec le jugement humain, tandis que chrF++ calculé (une métrique
  de chaîne « bête » sans données d'entraînement à manquer) atteint +0,50.

Aucun mode d'échec n'est visible dans une moyenne mondiale, et ils pointent
dans des directions opposées : pour une langue la métrique apprise est la
seule utilisable ; pour une autre elle est la seule *inutilisable*. Toute
infrastructure qui note des centaines de paires de langues avec une suite
de métriques fixe — comme le fait Champollion — doit cette évidence à ses
utilisateurs.

## 2. Définitions

Les définitions ci-dessous sont le minimum nécessaire pour lire le reste du
document avec précision. Les lecteurs familiers avec l'évaluation de la TA
peuvent parcourir jusqu'à §3.

**Métrique automatique.** Une fonction de (sortie du système, traduction de
référence, et parfois la source) vers un nombre. Les *métriques de chaîne*
— BLEU, spBLEU, chrF, chrF++ — comparent le chevauchement de surface entre
la sortie et la référence. Les *métriques apprises* — COMET, MetricX,
BLEURT — sont des modèles de réseau de neurones entraînés sur des jugements
humains passés pour prédire la qualité. Les identifiants canoniques pour
toutes les métriques de ce document proviennent du registre de métriques de
Champollion (`shared/metric-registry.json`) : `bleu`, `spbleu`, `chrf_plain`,
`chrf_plus_plus`, `comet_score`, `metricx_score`.

**Protocoles de jugement humain.** Les campagnes WMT ont collecté des scores
de qualité humains selon plusieurs protocoles, que cet artefact garde
distincts :

- **DA (Évaluation directe)** — les travailleurs de la foule ou les
  chercheurs notent une traduction 0–100. *DA normalisée en z* (écrite
  `wmt-z`) normalise les scores de chaque évaluateur à moyenne 0,
  variance 1, supprimant les effets de générosité de l'évaluateur.
- **DA+SQM** (`da-sqm`, `wmt`) — DA collectée sur une échelle
  0–100 annotée avec des descriptions d'ancrage de métrique de qualité
  scalaire ; utilisée à partir de WMT22.
- **MQM (Métriques de qualité multidimensionnelles)** (`mqm`) —
  les annotateurs professionnels marquent et classifient les étendues
  d'erreurs individuelles avec des sévérités ; le nombre d'erreurs pondéré
  devient un score de segment. Lent, coûteux, et le signal le plus fiable
  disponible ; collecté uniquement pour quelques paires à ressources élevées
  par année (les annotations proviennent des versions `wmt-mqm-human-evaluation` de
  Google).
- **ESA (Annotation d'étendue d'erreur)** (`esa`, `esa-merged`)
  — le protocole de WMT24 et WMT25 combinant le marquage d'étendue d'erreur
  avec une notation scalaire ; moins cher que MQM, plus informatif que DA.

**Méta-évaluation.** Évaluer les évaluateurs : mesurer la concordance de
chaque score de métrique automatique avec les scores humains sur les mêmes
traductions. La concordance est mesurée à deux niveaux :

- **Niveau du système** (`sys`) : chaque système de TA obtient un
  score humain agrégé et un score de métrique agrégé pour un ensemble de
  test ; la concordance est calculée entre les systèmes. Cela demande :
  *la métrique classe-t-elle les systèmes entiers comme les humains le
  font ?* — la question qu'un classement se pose.
- **Niveau du segment** (`seg`) : concordance entre les paires
  individuelles (système, phrase). Cela demande : *la métrique peut-elle
  distinguer une bonne phrase d'une mauvaise ?* — la question que
  l'estimation de qualité et le filtrage de données se posent. C'est
  beaucoup plus difficile, et les corrélations sont systématiquement plus
  basses.

**Statistiques de corrélation.** Quatre statistiques standard, définies ici
exactement comme calculées :

- **r de Pearson** — corrélation linéaire entre les deux vecteurs de scores.
- **ρ de Spearman** — r de Pearson calculé sur les rangs moyens ; mesure la
  concordance monotone, insensible à l'échelle.
- **τ-b de Kendall** — parmi toutes les paires d'éléments, l'excès (ajusté
  pour les égalités) de paires ordonnées de manière concordante sur les
  paires ordonnées de manière discordante. Nous utilisons la formulation
  standard τ-b ajustée pour les égalités (équivalente à `scipy.stats.kendalltau` ;
  notre implémentation est sans dépendance et est vérifiée de manière
  croisée contre une référence par force brute dans la suite de tests).
- **Précision du classement par paires** (niveau du système uniquement) —
  parmi toutes les paires de systèmes que les humains ordonnent
  *strictement*, la fraction que la métrique ordonne de la même manière,
  avec une égalité de métrique comptée comme un échec à reproduire l'ordre.
  C'est la statistique de précision de Kocmi et al. (2021), que les
  campagnes WMT récentes utilisent comme leur nombre de titre au niveau du
  système.

**Famille linguistique.** Le groupement généalogique de la *langue cible*
(la langue en laquelle on traduit), tel qu'enregistré dans la base de
données des langues de Champollion (`languages.family`, dérivée de Glottolog).
§5 discute pourquoi le côté cible, et ce qu'une famille peut et ne peut pas
servir de proxy pour.

## 3. Données

### 3.1 Sources, épinglées

| Source | Ce qu'elle fournit | Épingle |
|---|---|---|
| `google-research/mt-metrics-eval` (archive de données v2) | Scores humains, scores de métriques, sorties du système, sources et références pour chaque ensemble de test de la tâche WMT Metrics, wmt19–wmt25 | commit de code `68a481ae…` ; tarball de données `mt-metrics-eval-v2.tgz` de `data.statmt.org`, épinglé **sha256 `6708eec9aaa8a9deca5e370bdd0e23db4881aeca129f29d5281575eaa66c7e10`**, ETag `36579a46-64ff8bb1d3080`, Last-Modified 2026-04-21, 911 710 790 octets |
| `google/wmt-mqm-human-evaluation` | L'origine en amont des annotations d'experts MQM que mt-metrics-eval redistribue sous forme fusionnée ; Apache-2.0 | commit `7fadea28…` |

Deux faits d'intégrité des données façonnent la discipline d'épinglage.
Premièrement, **le tarball de données n'est pas immuable** — il est
republié sur place à mesure que les campagnes sont ajoutées — donc
l'artefact enregistre la somme de contrôle, l'ETag et l'horodatage de la
copie exacte à partir de laquelle les nombres ont été calculés, et
l'importateur refuse de s'exécuter sans une somme de contrôle. Deuxièmement,
la concession Apache-2.0 de la boîte à outils couvre son *code* ; **les
données de jugement humain et d'ensemble de test groupées ne portent aucune
déclaration de licence explicite**. Les conséquences en sont à §8.

Le contenu de l'archive (≈4,2 Go décompressés : jugements humains,
références et sorties complètes du système pour chaque campagne) sont
**jamais stockés dans ce dépôt ou redistribués par Champollion**. Ils sont
récupérés de la source dans un cache local ; seuls les nombres de
corrélation dérivés sont publiés. C'est la même posture de récupération à
partir de la source que chaque référence Champollion suit.

### 3.2 Ce que chaque campagne contribue

| Ensemble de test | Paires avec jugements humains | Protocole(s) humain(s) utilisé(s) ici |
|---|---|---|
| wmt19 | 18 | DA-z |
| wmt20 | 18 (incl. en→iu, en→ta, km→en, ps→en) | DA-z ; MQM (en→de, zh→en) |
| wmt21.news | 16 (incl. en→ha, en→is) | DA-z ; MQM (en→de, zh→en, en→ru) |
| wmt21.tedtalks | 3 | MQM |
| wmt21.flores | 4 (bn↔hi, xh↔zu) | DA-z |
| wmt22 | 17 (incl. en→liv, sah→ru, cs↔uk) | DA-SQM ; MQM (en→de, zh→en, en→ru) |
| wmt23 | 9 (incl. he→en) | DA-SQM ; MQM |
| wmt23.sent | 1 | MQM |
| wmt24 | 11 (incl. en→is, en→hi) | ESA ; MQM |
| wmt25 | 16 (incl. en→bho, en→mas, en→ar) | ESA-fusionnée ; MQM |

**Exclu : wmt24pp.** La version WMT24++ étend la couverture à 55 paires de
langues mais ne fournit que *références et sorties du système* — pas de
jugements humains — donc aucune corrélation ne peut en être calculée. Elle
est listée dans le registre d'exclusion de l'artefact plutôt que d'être
silencieusement supprimée.

## 4. Méthode

L'importateur parcourt chaque (ensemble de test, paire de langues) et
calcule une **cellule** par (voie de jugement humain, niveau, métrique) :

1. **Découvrir les voies humaines.** Tous les fichiers de scores humains
   disponibles pour la paire sont mis en correspondance avec une liste
   d'autorisation explicite (§4.1). Les fichiers au niveau des évaluateurs,
   les fichiers d'étendues d'erreur brutes et les scores au niveau du
   document/domaine sont hors de portée.
2. **Exclure les « systèmes » humains.** Les fichiers de scores WMT incluent
   les traductions de référence elles-mêmes en tant que systèmes notés
   (`refA`, `refb`, `HUMAN.0`…). Corréler une métrique
   contre sa propre référence est dénué de sens, donc tout système
   correspondant à l'ensemble de références de la paire ou aux préfixes
   `ref`/`human`/`synthetic` est exclu partout.
3. **Aligner.** Niveau du système : l'intersection des systèmes ayant à la
   fois un score humain et un score de métrique (les valeurs manquantes sont
   supprimées, jamais coercées à zéro). Niveau du segment : chaque (système,
   segment) avec les deux scores, regroupés entre les systèmes sans
   groupement — c'est l'aplatissement « sans moyenne » de mt-metrics-eval.
   Les fichiers irréguliers (nombres de segments mal appariés) font échouer
   la cellule plutôt que de s'aligner approximativement.
4. **Calculer.** Pearson, Spearman et Kendall τ-b aux deux niveaux ;
   précision du classement par paires au niveau du système. Les cellules
   avec moins de 3 systèmes alignés (sys) ou moins de 10 points alignés sur
   au moins 2 systèmes (seg), ou avec variance zéro de chaque côté, sont
   enregistrées dans le registre d'exclusion comme dégénérées (20 cellules
   dans la construction actuelle).
5. **Regrouper.** Par famille linguistique cible, par métrique, par niveau :
   la moyenne pondérée par n de chaque statistique sur les cellules
   *préférées* (§4.1), avec la liste (ensemble de test, paire) contributive
   conservée pour que tout agrégat puisse être décomposé en ses entrées.

### 4.1 Préférence de voie humaine

Lorsqu'une paire a plusieurs voies de jugement humain, toutes sont
calculées, mais exactement une est marquée **préférée** et seules les
cellules préférées entrent dans le regroupement familial — sinon une paire
jugée sous MQM et DA compterait deux fois. L'ordre de préférence est par
qualité du signal :

```
mqm > esa-merged > esa > da-sqm > wmt-z > wmt-appraise-z > wmt-appraise > wmt > wmt-raw
```

L'annotation d'erreur d'expert (MQM) surclasse les protocoles d'étendue
d'erreur (ESA), qui surclassent l'évaluation directe scalaire ; dans DA, les
voies normalisées en z surclassent les voies brutes. Les cellules non
préférées restent dans l'artefact pour quiconque souhaite étudier les effets
du protocole.

### 4.2 Identité et versioning des métriques

Les métriques apprises changent d'année en année (COMET-20, COMET-22,
MetricX-23/24/25 sont des modèles différents), et les traiter comme une
métrique brouille exactement la distinction pour laquelle la méta-évaluation
existe. Chaque cellule enregistre donc le **nom de score en amont verbatim**
(`COMET-22`, `MetricX-25-Ref`, `metricx_xxl_MQM_2020`…) aux côtés de l'id du
registre canonique, et l'artefact liste les noms en amont qui ont alimenté
chaque id. Lorsqu'une campagne a noté une métrique contre plusieurs
références, le flux de référence utilisé est également enregistré par
cellule.

Les scores sont utilisés exactement comme l'archive les distribue (toutes
les voies plus-c'est-mieux ; les scores d'erreur MQM et MetricX sont
stockés négés en amont). Aucun retournement de signe ou redimensionnement
n'est appliqué ; les corrélations sont invariantes à l'échelle et la
convention d'orientation a été vérifiée empiriquement avant l'importation.

### 4.3 La voie chrF++ calculée

chrF++ — la métrique de chaîne principale du harnais — n'a été soumise qu'à
la campagne wmt20, donc les scores en amont existent pour une année. Pour
chaque autre ensemble de test, l'importateur calcule chrF++ lui-même
(sacreBLEU, `word_order=2`) à partir des sorties du système en cache par
rapport à la référence enregistrée. Ces cellules sont marquées
`computed: true` et leur nom en amont le dit : un score calculé par
Champollion n'est jamais présenté comme une soumission WMT. Toutes les
autres cellules de métrique sont des valeurs en amont verbatim ; la seule
chose que Champollion ajoute à celles-ci est l'arithmétique de corrélation.

## 5. Choix de conception, alternatives et justification

Ce sont les décisions qu'un examinateur devrait interroger. Chacune énumère
ce qui a été choisi, ce qui ne l'a pas été, et pourquoi.

**Clé par famille linguistique cible.** *Choisi :* agréger par la famille
de la langue en laquelle on traduit. *Alternatives :* par paire uniquement
(pas d'agrégation) ; typologie du côté source ou au niveau de la paire ;
vecteurs de caractéristiques typologiques au lieu de généalogie. *Justification :*
la fiabilité des métriques est dominée par la difficulté de la *langue de
sortie* à noter — la richesse morphologique gonfle l'inadéquation de surface
pour les métriques de chaîne, et la rareté des données d'entraînement
dégrade les métriques apprises — les deux propriétés de la cible. La famille
est une clé grossière mais universellement disponible (chaque langue dans la
base de données de Champollion en a une) ; les caractéristiques typologiques
seraient plus fines mais manquent ou sont contestées pour exactement les
langues à faibles ressources pour lesquelles cela existe. Les cellules par
paire sont conservées en intégralité, donc les re-agrégations plus fines
(par genre, par type morphologique) peuvent être construites à partir de
l'artefact sans réimportation.

**Corrélation au niveau du segment aplatie.** *Choisi :* Kendall τ-b sur le
vecteur (système, segment) regroupé. *Alternatives :* précision par paires
groupée par élément avec calibrage des égalités (l'acc*-eq des résultats WMT
récents) ; τ par segment moyenné entre les segments. *Justification :* la
statistique aplatie est le choix le plus simple défendable, est exactement
reproductible à partir de sa définition sans une procédure de calibrage des
égalités, et préserve la comparabilité entre langues que cet artefact
nécessite. Ce n'est *pas* la statistique de titre WMT la plus récente, et
§8 l'énumère comme une limitation plutôt que de prétendre l'équivalence.

**Les égalités de métrique comptent contre la métrique** dans la précision
du classement par paires. Une métrique qui ne peut pas séparer deux systèmes
que les humains séparent a échoué à reproduire l'ordre humain ; donner un
crédit partiel récompenserait la quantification des scores.

**Moyennes pondérées dans le regroupement.** Les agrégats familiaux
pondèrent chaque cellule par sa taille d'échantillon (systèmes au niveau
sys, points au niveau seg), donc une paire MQM à 17 systèmes compte plus
qu'une paire DA à 6 systèmes. Les valeurs par cellule non pondérées restent
disponibles.

**Seuils.** Les cellules ont besoin de ≥3 systèmes alignés (une corrélation
sur 2 points est dénuée de sens) ou ≥10 points de segment alignés sur ≥2
systèmes. Ce sont des planchers contre l'arithmétique dégénérée, pas des
revendications de signification — §8.

**Discipline verbatim-en amont.** Champollion ne recalcule rien qu'il peut
citer (sauf la voie chrF++ marquée), car les métriques apprises re-notées
introduiraient une dérive de version et d'environnement que les noms en
amont par cellule existent pour prévenir. Le compromis — les lacunes de
couverture où une campagne n'a pas exécuté une métrique — est visible comme
des cellules manquantes plutôt que d'être dissimulées.

**Exclusions honnêtes.** Tout ce qui est ignoré (un ensemble de test sans
jugements humains, un code de langue non résolvable, une cellule dégénérée)
est écrit dans un registre d'exclusion avec une raison. Un lecteur de
l'artefact peut énumérer ce qui n'y est *pas* — la propriété que la plupart
des rapports d'agrégat manquent.

## 6. L'artefact publié

L'évidence est expédiée en tant qu'un fichier JSON lisible par machine,
suivi dans le monodépôt (délibérément non groupé dans les paquets npm/PyPI) :

```
shared/catalogue/metric-reliability.json    # the artifact (≈0.6 MB)
shared/schemas/metric-reliability.schema.json  # its JSON-Schema contract
```

Construction actuelle : **1 810 cellules** (1 052 préférées) sur **57 paires
de langues**, **10 ensembles de test**, **11 familles cibles**, avec 21
exclusions du registre. Blocs de niveau supérieur : `sources` et
`provenance` épinglés (chaque valeur dérivée porte la provenance
`champollion-derived` nommant les en amont — les corrélations sont les nôtres, les
jugements ne le sont pas) ; `correlation_definitions` (les définitions exactes des
statistiques de §2) ; `metrics` (id du registre ↔ noms en amont) ;
`languages` (code → famille/genre) ; `families` (le regroupement) ;
`cells` (chaque corrélation, entièrement attribuée) ; `excluded`
(le registre).

Trois surfaces de consommation le lisent aujourd'hui :

- **Harnais CLI :** `mt-eval recommend SRC TGT` rend un bloc « confiance de métrique
  pour la cible » aux côtés de la disponibilité de la méthode et des
  résultats cités.
- **Champollion CLI :** `champollion recommend SRC TGT` (même contrat de charge utile ;
  l'artefact est suivi dans le monodépôt, donc les installations empaquetées
  se dégradent en une note explicite « index non disponible »).
- **Serveur MCP :** l'outil `get_metric_reliability` répond « quelle métrique
  devrais-je faire confiance pour la langue X ? » pour tout agent IA
  connecté, y compris une réponse explicite UNMEASURED pour les langues
  qu'aucune campagne WMT n'a jugées.

## 7. Aperçu des résultats

Corrélation de Pearson au niveau du système avec la voie humaine préférée,
moyenne pondérée par famille cible (construction actuelle ; les nombres au
niveau du segment, Spearman, τ-b et la précision du classement par paires
sont dans l'artefact) :

| Famille cible | Paires | BLEU | spBLEU | chrF | chrF++ | COMET | MetricX |
|---|---|---|---|---|---|---|---|
| Afro-asiatique | 2 | +0,88 | +0,95 | +0,85 | +0,87 | +0,67 | **−0,62** |
| Dravidienne | 1 | +0,88 | — | +0,94 | +0,93 | +0,94 | — |
| Esquimo-aléoute | 1 | **+0,16** | — | +0,35 | +0,33 | **+0,86** | — |
| Indo-européenne | 42 | +0,75 | +0,76 | +0,79 | +0,76 | +0,81 | +0,84 |
| Japonique | 1 | +0,52 | +0,89 | +0,93 | +0,84 | +0,73 | +0,74 |
| Coréanique | 1 | +0,89 | +0,87 | +0,87 | +0,88 | +0,55 | +0,77 |
| Niger-Congo | 2 | +0,94 | — | +1,00 | +1,00 | +1,00 | — |
| Nilotique | 1 | — | — | — | +0,50 | — | **−0,09** |
| Sino-tibétaine | 2 | +0,49 | +0,68 | +0,68 | +0,62 | +0,72 | +0,82 |
| Turcique | 1 | +0,85 | — | +0,97 | +0,97 | — | — |
| Ouralienne | 3 | +0,85 | +0,88 | +0,91 | +0,91 | +0,75 | +0,81 |

Comment lire ceci — et comment ne pas le faire :

- **Le motif général correspond aux résultats d'agrégat du domaine.** Sur
  l'ensemble Indo-européen à 42 paires, les métriques apprises mènent
  (MetricX +0,84, COMET +0,81) avec chrF derrière et BLEU en dernier — le
  résultat WMT standard, reproduit ici à partir des données brutes comme
  ancre de santé.
- **Les écarts par famille sont la charge utile.** Pour l'inuktitut
  polysynthétique, les métriques de chaîne s'effondrent et COMET est le
  seul signal utilisable. Pour le Maasai et pour l'anglais→arabe dans wmt25,
  MetricX se corrèle *négativement* tandis que les métriques de chaîne
  restent utilisables — une métrique apprise extrapolant au-delà de sa
  distribution d'entraînement échoue silencieusement, avec des scores
  confiants. Ce sont précisément les cas qu'une moyenne mondiale efface.
- **Les familles à paire unique sont une évidence, pas des conclusions.**
  Huit des onze familles reposent sur une ou deux paires d'une seule
  campagne. La lecture honnête de « Esquimo-aléoute : BLEU +0,16 » est
  *« dans la seule campagne où les humains ont jugé en→iu, BLEU était non
  informatif »* — une mesure documentée, un drapeau rouge, et une raison de
  collecter plus, pas une loi sur la famille.
- **Une cellule négative ne signifie pas que la métrique est cassée
  partout.** Cela signifie : sur cette paire, dans le pool de systèmes de
  cette campagne, la métrique a ordonné les systèmes contre le jugement
  humain. La restriction de plage (voir §8) peut déprimer toute corrélation
  lorsque les systèmes se regroupent étroitement en qualité.

## 8. Limitations

Énoncées clairement, car la valeur de l'artefact est son honnêteté :

1. **La famille est un proxy, pas un mécanisme.** La famille généalogique se
   corrèle avec, mais ne détermine pas, les propriétés morphologiques qui
   conduisent le comportement des métriques. Les cellules par paire (avec le
   genre enregistré par langue) permettent un découpage plus fin ; la clé
   familiale est une requête par défaut, pas une revendication de causalité
   typologique.
2. **La couverture est ce que WMT a jugé, pas ce que le monde parle.** 57
   paires, fortement pondérées vers l'Europe ; chaque paire xx→anglais se
   déverse dans Indo-européenne ; des macro-familles entières (Algonquienne,
   Austronésienne, Quechua, …) n'ont *aucune couverture de jugement humain*.
   Pour celles-ci, les surfaces de Champollion répondent UNMEASURED plutôt
   que d'emprunter le nombre d'un voisin. Le programme de référence
   souverain de Champollion — des ensembles de test contrôlés par la
   communauté avec validation de locuteur natif — est la correction à long
   terme pour exactement cette lacune.
3. **Le transfert intra-familial est une hypothèse.** Lorsqu'une langue
   interrogée n'a jamais été directement jugée, l'évidence au niveau
   familial provient d'*autres* langues de la famille, et chaque surface
   consommatrice le dit explicitement.
4. **Pas encore d'intervalles de confiance.** Les cellules portent des
   tailles d'échantillon mais pas d'intervalles bootstrap ; les agrégats
   familiaux à paire unique en particulier devraient être lus avec les
   largeurs que §7 implique. L'ajout d'IC bootstrap par cellule (le harnais
   a déjà la machinerie pour les IC de score) est un travail prévu.
5. **Restriction de plage.** Les corrélations sont calculées sur les
   systèmes soumis de chaque campagne. Les campagnes récentes regroupent de
   nombreux systèmes forts étroitement ensemble, ce qui déprime les
   corrélations pour toutes les métriques — une partie de la raison pour
   laquelle les cellules dérivées de wmt25 (Maasai, Arabe) montrent des
   valeurs extrêmes. L'attribution par ensemble de test sur chaque cellule
   garde cela inspectable.
6. **Choix de statistique au niveau du segment.** Le τ-b aplati est simple
   et reproductible mais n'est pas la précision groupée calibrée pour les
   égalités des articles de résultats WMT les plus récents ; les nombres ici
   ne devraient pas être comparés chiffre par chiffre contre ces
   publications.
7. **Licence des données.** Les données de jugement humain en amont ne
   portent aucune déclaration de licence explicite (§3.1). Champollion n'en
   redistribue aucune, publie uniquement des statistiques dérivées avec
   attribution complète, et tient cet artefact dans une **voie d'évidence
   non commerciale** (`license_lane.commercial_ok: false`) jusqu'à ce que la posture soit
   résolue. Les voies MQM tracent en outre vers les versions Apache-2.0 des
   annotations de Google.
8. **L'archive est une cible mouvante.** Les nouvelles campagnes sont
   ajoutées au même URL de tarball. Les épingles identifient notre
   instantané exactement ; la régénération par rapport à un instantané plus
   récent est une nouvelle version d'artefact avec de nouvelles épingles,
   jamais une mise à jour silencieuse.

## 9. Reproduction

L'artefact est régénérable à partir de la source par quiconque :

```bash
# 1. Fetch the archive (912 MB compressed; NOT immutable — keep the pins)
mkdir -p ~/.mt-eval/mt-metrics-eval && cd ~/.mt-eval/mt-metrics-eval
curl -sSL -D mt-metrics-eval-v2.headers -o mt-metrics-eval-v2.tgz \
     https://data.statmt.org/wmt26/mt-metrics-eval-v2.tgz
shasum -a 256 mt-metrics-eval-v2.tgz > mt-metrics-eval-v2.sha256
tar xzf mt-metrics-eval-v2.tgz

# 2. Regenerate (refuses to run without a checksum pin)
python3 arena/scripts/import_wmt_metaeval.py
```

Notez que le README de l'archive elle-même pointe vers une URL
storage.googleapis.com retirée ; `data.statmt.org` est l'hôte en direct.
L'importateur est une bibliothèque standard Python pure (sacreBLEU
uniquement pour la voie chrF++ calculée) ; ses implémentations de
corrélation sont vérifiées de manière croisée contre des références par
force brute dans `arena/tests/test_wmt_metaeval.py`, et le contrat structurel de l'artefact est
appliqué par son schéma JSON plus les tests d'intégrité dans les deux
runtimes.

## 10. Crédits et citation

Les jugements humains résumés ici sont l'œuvre des **organisateurs et
annotateurs de la tâche partagée WMT Metrics** — y compris Markus Freitag,
Nitika Mathur, Tom Kocmi et de nombreux collaborateurs à travers les
campagnes 2019–2025 — et du **programme d'annotation MQM de Google**
(Freitag et al., *Experts, Errors, and Context*, TACL 2021 ;
`google/wmt-mqm-human-evaluation`). L'archive et la boîte à outils sont maintenues en tant que
`google-research/mt-metrics-eval`. La précision du classement par paires suit Kocmi, Federmann
et al. (2021), *To Ship or Not to Ship*. La contribution de Champollion est
l'organisation par famille linguistique, le calcul de corrélation et
l'échafaudage d'honnêteté autour — chaque nombre de l'artefact porte la
provenance `champollion-derived` nommant l'en amont dont il dérive, et aucun de
leur texte, jugements ou scores n'est redistribué.

Lors de la citation de nombres de fiabilité de cet artefact, citez à la
fois la ou les campagne(s) WMT que les cellules attribuent et la version
d'artefact de Champollion (le bloc `sources` porte les épingles de
données exactes), et respectez la voie d'évidence non commerciale décrite
à §8.
