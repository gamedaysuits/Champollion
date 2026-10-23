---
title: "Règles de mesure"
slug: /agents/measurement
description: "Comment Champollion évalue un traducteur et comment un agent en rend compte : la norme d’évaluation (chrF++ sur corpus avec un intervalle de bootstrap à 95 %), les scores conditionnels, dev par rapport à test, les prédictions, les quasi-copies, le plancher du dictionnaire, la règle du verdict apparié et le plancher de 50 phrases sous-jacent, ce qui oriente la liste de souhaits, les notes du·de la locuteur·rice, la comparaison à l’aveugle entre deux modèles, le verdict du·de la locuteur·rice, les lignes réaffichées (accord, erreur aléatoire, dérive) et la manière d’énoncer un nombre."
---

# Règles de mesure

Les rails garantissent que la communauté **saura** à quel point un modèle est
performant sur ses propres phrases — non pas qu'il est bon. Cette promesse repose sur
quelques règles, pour la plupart appliquées de façon stricte. Cette page les énonce
avec exactitude et se termine sur la manière d'énoncer un résultat chiffré.

## La norme d'évaluation (standard/1)

Chaque nouvelle exécution est évaluée de la même manière (`arena/mt_eval_harness/scoring.py`) :

- **Le résultat principal :** le **chrF++** au niveau du corpus (sacreBLEU chrF avec ordre des
  mots égal à 2), de 0 à 100 — plus la valeur est élevée, plus elle est proche des traductions de référence —
  avec son **intervalle de confiance bootstrap à 95 %** et sa signature sacreBLEU. Noté
  `chrF++ 47.5 [45.9, 49.0]`.
- **Les segments pris en compte :** une règle unique s'applique au résultat principal, à son intervalle et à chaque
  comparaison. Un segment dont la traduction a échoué compte comme une sortie vide —
  jamais écarté, jamais évalué comme un texte de remplacement ; un segment sans référence
  est exclu partout.
- **L'intervalle :** celui du résultat principal — bootstrap par centiles sur ces
  segments, 1 000 rééchantillonnages, graine 12345, α 0,05. En dessous de 30 segments, les outils
  signalent que l'intervalle peut avoir une faible couverture ; avec moins de 2 segments, il n'y en a
  aucun.
- **À ses côtés, jamais mélangés :** BLEU, spBLEU, TER et COMET lorsqu'il a été
  calculé, chacun avec sa signature ou son identifiant de modèle.
- **Les diagnostics, séparés :** correspondance exacte, correspondance équivalente, acceptation FST,
  exactitude morphologique, validateur sémantique, alternance codique, hallucination,
  respect de la terminologie, style d'écriture. Ils n'entrent jamais dans un résultat principal et ne
  servent jamais à établir un classement.
- **« Meilleur » désigne un test de significativité apparié** sur chrF++, jamais deux nombres
  comparés à l'œil nu.
- **Aucune étiquette de qualité.** Seule l'évaluation humaine certifie la qualité.

**Abandonnés :** le score composite pondéré et les étiquettes de niveau de qualité. Une
fiche d'exécution standard/1 porte `composite: null` et `quality_tier: null`.
**Remarque.** Ne présentez, ne calculez et ne citez jamais de composite ou de niveau, même issu d'une
ancienne fiche.

**Les avertissements sur le score** sont des diagnostics inscrits à côté d'un score, et ne le modifient
jamais : `source_copy` (la moitié ou plus des sorties copient la source),
`length_inflation` et `length_deflation` (sorties de plus du double ou de moins de la moitié
de la longueur de référence — en moyenne, ou dans un quart ou plus des segments), `near_constant_output` (une même sortie répétée pour de nombreuses
sources), et `train_test_near_twin` (lignes de test ayant une jumelle dans l'entraînement —
majeur lorsque la moitié ou plus en ont une). **Remarque.** Transmettez chaque avertissement avec le score,
mot pour mot.

## Mesure avec portes

Lorsqu'une exécution comporte une chaîne de portes ([méthodes et portes](/docs/agents/methods#gate-chains)),
**ce qui est mesuré correspond à ce qui est livré** :

- le chrF++ principal évalue la sortie filtrée par les portes ;
- le chrF++ sans portes, avec son intervalle, figure à ses côtés
  (`overall.gates.ungated`) ;
- le **taux de refus** — segments refusés par les portes ÷ segments évalués — constitue un
  nombre distinct, accompagné des décomptes par porte et selon ce qui a été livré (`shipped_from` :
  méthode, source, repli, rien) ;
- l'**empreinte** de la chaîne (sha256 de son JSON canonique) accompagne le
  rapport et toute exécution publiée.

**Verrou.** Aucun repli lors de la mesure : `mt-eval run` et `mt-eval test` refusent
une chaîne dont les portes transmettent les segments refusés à une solution de repli, avant que quoi que ce soit ne soit
traduit ou consommé.

**Remarque.** Communiquez tout score avec portes avec son score sans portes et son taux de refus.
Un score avec portes seul dissimule ce que les portes ont écarté.

## Les jeux de données et leur utilité respective

| Rôle | Utilisé pour | Lecture |
|---|---|---|
| `train` | Apprentissage | Jamais évalué comme résultat |
| `dev` (pratique) | Choix du point de contrôle ; évaluation des cycles d'amélioration (à partir de 50 phrases) ; plancher du dictionnaire | Libre |
| `test` | Jalons : tester un modèle par rapport aux prédictions de la communauté | Chaque lecture d'évaluation nécessite un pré-enregistrement (forge) ; chaque lecture est journalisée |
| `sealed` | Un test que personne en dehors de ses détenteurs ne voit | Une seule fois |

**Dans nmt-forge** (le registre, `.forge/eval-registry.json` ; le grand livre) :

- **Verrou.** Chaque lecture d'un jeu enregistré est inscrite dans le grand
  livre à chaîne de hachage avec sa finalité (`score`, `dev-selection`, `audit`, `inspect`).
- **Verrou.** L'évaluation d'un jeu de test exige un pré-enregistrement valide pour son
  contenu actuel.
- **Verrou.** Un jeu scellé n'est évalué qu'une seule fois. Une seconde évaluation est refusée (`sealed
  set '<name>' has already been spent`); a single `mt-eval` lecture du fichier scellé
  le consomme également. `--override-respend '<reason>'` (sur `nmt-forge score`
  et `nmt-forge compare`) est consigné dans le grand livre. `export` refuse de
  le consommer à nouveau et indique `--no-eval`.
- **Verrou.** La clôture de dev : l'entraînement nécessite un jeu `dev` enregistré ; les lignes de dev ne
  doivent partager aucune source ou cible exacte avec un jeu de test ou scellé ; aucune ligne
  d'entraînement ne peut être une ligne de dev.

**Dans mt-eval :**

- **Remarque.** `mt-eval run` et `mt-eval compare` évaluent un fichier de test ou scellé
  sans aucun pré-enregistrement et ne refusent jamais en fonction du nombre de lectures. `mt-eval run`
  ajoute seulement une ligne au journal de lecture du fichier (`<file>.reads.jsonl`) lorsque forge
  en a créé un ; `compare` et `test` ne consignent rien. N'évaluez jamais le jeu de test avec
  mt-eval avant que la prédiction de la communauté ne soit rédigée.

## Prédictions

```bash
nmt-forge prereg new first-model --eval-set project-test --expect "<their words>" --rationale "<their reason>"
nmt-forge prereg new round-2 --eval-set project-test --predictions predictions.json
nmt-forge prereg template --out predictions.json
```

- `--expect` et `--rationale` : une prédiction en texte libre concernant le chrF++, selon les
  propres termes de la communauté. Son verdict appartient à la communauté : `nmt-forge prereg verdict
  <id> --prediction <n> --held` (or `--missed`) `--by "<who>"`.
- `--predictions <file>` : un tableau JSON ; chaque prédiction indique un `metric` et
  un `rationale`, et soit une `direction` (`increase`, `decrease`,
  `no_change`) avec une `baseline_score` (et un `margin` facultatif) — évaluée par les
  outils — soit du texte libre `expect`.
- **Verrou.** Une prédiction formulée après toute lecture d'évaluation du jeu (par forge
  ou par `mt-eval run`) est refusée : *« eval set '…' was already read for scoring
  (N time(s): …) before this preregistration »*. `--allow-after-reads` permet de la faire
  passer, et chaque rapport, export et état le mentionne.
- **Remarque.** La prédiction appartient à la communauté, rédigée avant qu'aucun score n'existe,
  sans jamais être reformulée ni restreinte par vos soins. La question des rails ne suggère aucun chiffre
  (*« Aucun nombre n'est suggéré ici, afin que l'estimation reste la leur »*) ; n'en proposez
  pas non plus.

## Quasi-doublons

`nmt-forge leak-audit` compare chaque paire d'entraînement avec chaque jeu de dev,
de test et scellé enregistré :

| Élément détecté | Règle | Action |
|---|---|---|
| Même fichier | sha256 | Écarté |
| Copie exacte | Même source ou même cible après normalisation | Écarté |
| Quasi-copie | Chevauchement des ensembles de mots cibles ≥ 0,6 (Jaccard) lorsque l'un contient l'autre, ou ≥ 0,9 | Écarté |
| Variante de gabarit | Même structure de phrase, réponse différente | **Conservé** pour l'apprentissage et comptabilisé, afin que le score puisse être lu avec et sans ces lignes de test |
| Correspondance source uniquement | Même invite, réponse différente | Conservé, signalé |

Les phrases courtes sont comparées par trigrammes de caractères ; les très courtes par
correspondance exacte uniquement. Une ligne de test est une **quasi-jumelle** lorsqu'une ligne d'entraînement est identique ou
présente un chevauchement ≥ 0,6 d'un côté ou de l'autre ; lorsque la moitié ou plus des lignes de test ont
des jumelles, le score relève principalement de la mémorisation et non de la traduction, et l'avertissement est majeur.
`--clean-to` écrit le fichier filtré ; `--drop-test-twins` supprime également les
lignes d'entraînement jumelées à une ligne de test, pour un score exempt de jumelles.

Le premier découpage de dev des rails applique le même seuil : `--near-dupe 0.6` sur
`nmt-forge split` conserve les lignes dont les mots se chevauchent à ≥ 0,6 d'un côté de la
frontière dev/entraînement, de sorte que le premier score de dev ne contienne aucune mémoire de quasi-copie qu'un filtrage
lors d'un cycle ultérieur rejetterait. `--max-group` plafonne un groupe de quasi-copies à la moitié de la
taille du jeu de dev plus un, afin qu'un fichier rédigé à partir de gabarits puisse tout de même être scindé.

**Remarque.** Ne formulez « l'audit de fuite a détecté… » qu'à partir de `true_now` ou de la propre
sortie de l'audit, et n'affirmez jamais de vous-même que « le jeu de test est propre ».

## Le seuil du dictionnaire

`nmt-forge floor <word lists>` traduit le jeu de dev mot à mot à l'aide du
dictionnaire (locution la plus longue en premier) et l'évalue avec le même code que le score
de dev d'une exécution : chrF++ accompagné de son intervalle à 95 %. Il s'exécute sur cette machine, ne lit jamais
le jeu de test, et n'enregistre que les noms, hachages et nombres d'entrées des dictionnaires,
le nombre de mots sources atteints et les scores. Une exécution **dépasse le
seuil** uniquement lorsque la borne inférieure de son intervalle de dev est supérieure à la borne supérieure de
celui du seuil ; `nmt-forge status` émet un avertissement pour toute exécution qui ne le fait pas.

## Comparer deux modèles

**Un cycle d'amélioration** (`nmt-forge compare-runs <in-use> <new>`) : les traductions par les deux modèles des
**mêmes phrases de dev**, appariées ligne par ligne ; un test de
randomisation approchée apparié (1 000 tirages) et un intervalle bootstrap à 95 % sur
la différence.

| Verdict | Règle |
|---|---|
| **too-few** | moins de 50 phrases de développement, quels que soient les scores — le modèle en service est maintenu, et les évaluations à l'aveugle du locuteur tranchent (ci-dessous) |
| **better** | 50 ou plus, p < 0,05 **et** la borne inférieure de l'intervalle au-dessus de 0 — le nouveau modèle est proposé à l'utilisation ; il n'est mis en service qu'avec l'accord de la communauté |
| **worse** | 50 ou plus, p < 0,05 et la borne supérieure de l'intervalle au-dessous de 0 |
| **no-change** | tout autre cas — le modèle en service est maintenu |

**Pourquoi 50.** Mesuré sur les sorties ByT5-small de la langue de test inventée, 100
ensembles de pratique aléatoires par taille, avec cette règle : à 23 phrases de dev,
elle qualifiait deux modèles presque identiques (écart de 0,7 chrF++ sur 500 phrases)
de différents 9 fois sur 100, et ne qualifiait un gain réel de +5,9 chrF++ de **better**
que 21 fois sur 100 ; à 50 phrases, 4 fois et 96 fois sur 100. La plus petite
différence observée 8 fois sur 10 était de 8,1 points chrF++ à 23 phrases, 5,8 à 50,
4,0 à 100 et 2,8 à 200. Ainsi, le premier découpage des rails réserve au moins 50 phrases
de dev lorsqu'il y a 200 paires ou plus — une sur dix parmi les paires filtrées, au maximum
500 ; avec moins de 200 paires, un quart d'entre elles, ce qui est inférieur à 50 — et
les feuilles de révision enrichissent l'ensemble avec des lignes de pratique : une ligne
sur deux tant qu'il y en a moins de 50, une sur quatre jusqu'à ce qu'il atteigne 200.

Chaque verdict indique également la plus petite différence que son jeu de dev met en évidence de manière fiable
(8 fois sur 10) : la largeur de l'intervalle × (1,96 + 0,84) ÷ (2 × 1,96). Lorsque cette valeur
dépasse 3 points de chrF++, le verdict « no-change » constitue la limite du jeu de dev, et non la preuve que le
cycle n'a rien apporté. Le jeu de dev a également servi à choisir le point de contrôle de la nouvelle exécution, ce qui
avantage légèrement le nouveau modèle — **mentionnez-le** lorsque vous transmettez un verdict.

Une préférence à l'aveugle du locuteur pour le modèle le plus récent (ci-dessous) fait
que forge ne le propose à l'utilisation qu'après un verdict **too-few** ou **no-change** — jamais
après **worse** — et la communauté donne son accord au préalable (`improve-promote`, mode
`confirm`). Une préférence à l'aveugle pour le modèle qu'une promotion a remplacé ne le
réintègre jamais d'office : l'action du rapport de cycle consulte la communauté.

**Deux exécutions quelconques** (`mt-eval compare <report> <report> --significance`) :
randomisation approchée par défaut (`--method paired_bootstrap` pour
l'autre méthode), 1 000 essais (`--n-bootstrap`), α 0,05, graine 12345, sur les entrées que les
rapports partagent par identifiant (avertissement en dessous de 10). chrF++ en premier, puis les métriques
secondaires. Chaque paire d'exécutions est testée ; il n'y a pas de correction pour
comparaisons multiples, et la sortie l'indique.

## Ce sur quoi s'oriente la liste de souhaits

`nmt-forge analyze` décompose le chrF++ de dev d'une exécution par type de phrase (avec
au moins 5 phrases de dev d'un type donné). Un type est considéré comme le **plus faible** — et pèse sur la
liste de souhaits — uniquement lorsque l'intervalle à 95 % mesurant l'écart négatif de ses phrases par rapport
au reste se situe entièrement au-dessus de zéro (intervalle de Welch sur le chrF++ au niveau de la phrase).
Un score inférieur pouvant être dû au hasard est signalé comme tel (*« … could be chance —
the wishlist does not steer by it »*) et ne pèse jamais sur la feuille.

Sa section « Mots jamais vus » demande deux ou trois phrases pour
chaque mot, chacune exprimant quelque chose de différent, et non une seule : sur la langue
de test inventée, un mot vu une seule fois lors de l'entraînement était traduit correctement dans 27 à 29 % des cas, et
un mot vu 2 à 4 fois dans 63 à 95 % des cas ; et à 3 200 phrases d'entraînement, ByT5-small
entraîné sur des phrases sélectionnées pour maximiser les nouveaux mots obtenait un sens correct sur 39,4 % de 500 phrases
mises de côté, contre 53,4 % pour des phrases de la vie courante, pour un temps de travail du locuteur
légèrement supérieur (environ 57 heures contre 54).

## Les évaluations du locuteur

À chaque cycle d'amélioration, le locuteur évalue les propositions du modèle pour de nouvelles phrases
par `Y`, `N` ou `?`. La part de réponses correctes est `Y ÷ (Y + N)` (`?`, lignes non évaluées,
lignes d'entraînement et lignes réaffichées exclues), avec un intervalle de Wilson à 95 %. Une hausse entre les cycles ne compte comme
un **progrès** que lorsque l'intervalle du dernier cycle se situe entièrement au-dessus de celui
du premier, qu'un modèle d'un cycle a été mis en service entre-temps — choisi par la communauté
(enregistrements `export` et `choose` de forge), que ce soit après un verdict **meilleur**,
d'après les évaluations à l'aveugle du locuteur ou selon leur propre choix ; un verdict **meilleur**
seul ne suffit pas — **et** que les vérifications à l'aveugle de chaque promotion par le locuteur
(ci-dessous), regroupées sur les cycles intermédiaires, ont jugé les nouveaux modèles corrects
nettement plus souvent que ceux qu'ils remplaçaient (|z| > 1,96).
Il s'agit de phrases qu'aucun modèle n'avait vues : la mesure qui compte le plus, et celle
par laquelle commencer ([accompagnement](/docs/agents/coaching)).

**Deux modèles, à l'aveugle.** `champollion improve sheet` fait générer par un second modèle
une moitié aléatoire (avec graine) des lignes proposées (`nmt-forge draft-newer`), non marquée :
le modèle entraîné le plus récent lorsqu'il n'est pas celui en service — comme après un cycle
dont le verdict était trop peu, sans changement ou pire — ou, lors de la visite suivant une
promotion, le modèle que celui en service a remplacé. La correspondance des lignes avec chaque modèle est conservée
à côté de la feuille dans `improve/round-<k>/sheet-key.json` (`in_use`, `other`,
`relation` `newer` ou `replaced`, les paires d'entraînement de chaque modèle `in_use_pairs`
et `other_pairs`, `other_rows` et `repeat_rows`, ci-dessous).
`champollion improve marks` décompte ensuite les deux modèles séparément, les lignes réaffichées
étant exclues de l'ensemble :

- la proportion de réponses correctes ci-dessus — la mesure du progrès — ne comptabilise
  que les lignes du modèle en service ;
- chaque ébauche marquée comme correcte et chaque correction devient une paire d'entraînement,
  quel que soit le modèle qui l'a rédigée ;
- un test à deux proportions (combiné, bilatéral à 5 % : |z| > 1,96) indique quel
  modèle le locuteur a jugé correct plus souvent, le cas échéant : `clear` vaut `newer`
  ou `replaced` (l'autre modèle), `in-use` ou `neither`, consigné dans
  `marks.json` (`blind`) avec les deux décomptes (`in_use_right`, `in_use_judged`,
  `other_right`, `other_judged`, `in_use_share`, `other_share`), `other`,
  `relation` et les décomptes de paires d'entraînement respectifs ; une comparaison avec un modèle
  plus récent conserve également `newer`, `newer_right`, `newer_judged` et `newer_share`. Lorsque
  l'un des deux modèles n'a aucune ligne marquée `Y` ou `N`, `clear` prend la valeur `null` et le texte
  indique *"trop peu de lignes d'un modèle ont été jugées pour comparer"* ;
- face à un modèle plus récent, dès lors qu'au moins une ébauche de chacun a été jugée, les décomptes
  sont transmis à forge (`nmt-forge speaker-verdict`), qui effectue le même test et
  enregistre `clear` (`newer`, `in-use` ou `neither`) dans son registre
  (`improve-speaker`). Après un verdict **too-few** ou **no-change** lors de cette
  exécution, `clear: newer` amène forge à proposer le modèle le plus récent pour l'utilisation ;
  `champollion improve marks` affiche alors *"forge l'a enregistré : il propose de mettre en service le modèle le plus récent (la communauté donne son accord au préalable)"*
  ([entraînement](/docs/agents/training#the-improve-rounds)).

Les lignes ont été attribuées au hasard, sur une même feuille, évaluées par le même locuteur, sur
les nouvelles phrases propres à la famille — ainsi, une nette différence révèle un élément que le jeu
de dev est peut-être trop restreint pour mettre en lumière, et toute variation dans l'indulgence de notation du locuteur
affecte les deux modèles de façon égale. **Remarque.** N'indiquez jamais au locuteur quelles lignes proviennent
de quel modèle avant que ses évaluations ne soient relevées.

**Lignes réaffichées.** À partir du cycle 2, `champollion improve sheet` réinsère une
ligne pour 10 nouvelles phrases sur la feuille (`REPEAT_EVERY` ; arrondi à l'inférieur,
et moins lorsqu'il y en a moins d'éligibles) : une proposition que le locuteur a marquée `Y` ou `N` sur une
feuille précédente, avec sa proposition antérieure, non marquée, à un emplacement aléatoire déterminé par graine —
jamais une ligne d'entraînement, une ligne qui était elle-même une répétition, une ligne déjà réaffichée,
ou une phrase présente sur cette feuille. La première ligne de la feuille, au-dessus de
l'en-tête, indique : *« Quelques lignes ci-dessous proviennent volontairement de feuilles antérieures.
Veuillez les évaluer à nouveau, comme si elles étaient nouvelles : la fréquence à laquelle les évaluations concordent indique dans quelle mesure
on peut s'y fier. »* Elle n'indique jamais lesquelles ; `sheet-key.json` les conserve sous la forme
`repeat_rows` (`row`, `from_round`, `from_row` et `mark`, l'évaluation
précédente). Elles demandent environ 10 secondes par ligne au locuteur.

`improve marks` évalue chacune uniquement par rapport à l'évaluation précédente du locuteur lui-même : une
répétition n'est jamais comptabilisée dans la part du cycle, n'est plus jamais une paire d'entraînement,
n'apparaît jamais dans la comparaison à l'aveugle. `marks.json` intègre `repeats` : `shown`,
`judged` (marqué `Y` ou `N` cette fois-ci ; `?` ou vide est affiché, non jugé),
`agreed`, `agreement` (concordance ÷ jugé), `wrong_to_right`,
`right_to_wrong`, `wrong_before` (lignes jugées précédemment marquées `N`) et
`rounds_apart_wrong_before`. Il affiche *« Lignes réaffichées : le locuteur
a évalué A sur J comme il l'avait fait auparavant (P %) — W autrefois incorrectes maintenant correctes, R autrefois
correctes maintenant incorrectes. Non comptabilisées dans la part de ce cycle, et exclues d'un nouvel entraînement. »*

Regroupées sur l'ensemble des cycles, dès lors que 10 lignes ou plus sont évaluées (`MIN_REPEATS`), le
rapport de cycle en tire deux enseignements :

- **Erreur aléatoire** `e`, issue des revirements qui se produisent de manière équilibrée dans les deux sens. Deux évaluations d'une
  même proposition sont en désaccord par hasard dans 2e(1 − e) des cas, pour moitié dans chaque sens ; avec
  d = 2 × min(`wrong_to_right`, `right_to_wrong`) ÷ `judged`,
  e = (1 − √(1 − 2d)) ÷ 2. L'erreur attire chaque proportion vers 50 % : une proposition réellement
  correcte une part p du temps est marquée correcte e + p(1 − 2e) du temps, ainsi
  à e = 10 %, « réellement correcte à 80 % » se lit environ 74 %.
- **Dérive** : les revirements dans un sens au-delà des revirements équilibrés. Le rapport avertit que
  l'évaluation devient peut-être plus indulgente lorsque les revirements d'incorrect à correct surpassent nettement
  ceux dans l'autre sens : 6 revirements ou plus et un test des signes,
  (`wrong_to_right` − revirements ÷ 2) ÷ √(revirements ÷ 4) > 1,96.

Sa ligne de contrôle : *« Le locuteur a évalué A lignes réaffichées sur J de la même manière qu'auparavant (P %) : environ E % des évaluations changent de sens au hasard, ce qui attire chaque
part marquée correcte vers 50 % — la projection en tient compte. »* — et concernant
la dérive, *« Et W propositions autrefois marquées incorrectes sont à présent marquées correctes, contre R dans
l'autre sens : l'évaluation devient peut-être plus indulgente, ce qu'une hausse de la part n'indiquerait
pas. »* En dessous de 10 lignes évaluées : *« N lignes réaffichées évaluées jusqu'ici — l'erreur
d'évaluation propre au locuteur est estimée à partir de 10. »*

**La trajectoire des cycles.** La projection du rapport de cycle est établie uniquement à partir
des progrès réels (ci-dessus) tant que la part de réponses correctes est inférieure à 80 %. Les courbes d'apprentissage
progressent par paliers à peu près constants en log-odds par doublement des données d'entraînement, de sorte
qu'il déduit le palier à partir des mêmes vérifications à l'aveugle après promotions : la somme de
`logit(in_use_share) − logit(other_share)` divisée par la somme de
`log2(in_use_pairs ÷ other_pairs)` (parts bornées entre 1 et 99 %), avec un intervalle
à 95 % issu de la variance de chaque part, environ 1 ÷ (n·p·(1 − p)) pour n propositions
évaluées. À partir des paires d'entraînement du modèle en service, il indique combien de paires supplémentaires
sont nécessaires pour atteindre 80 % de réponses marquées correctes — l'estimation — ainsi que le temps en heures du locuteur à raison de 70 secondes par
phrase. L'intervalle couvre la plage du palier (pas de borne supérieure au-delà de six
doublements supplémentaires) et, dès lors que 10 lignes réaffichées sont évaluées, l'endroit où « réellement correct à
80 % » peut se situer d'après les évaluations de ce locuteur : e + 0,8(1 − 2e) + 0,2 × K, au maximum
97 %, où K représente la dérive par cycle (les revirements au-delà des revirements équilibrés, rapportés au
nombre de cycles séparant les deux évaluations des lignes autrefois incorrectes) multipliée par les cycles
écoulés entre la première et la dernière évaluation, plafonnée à ±30 %. Le minimum correspond au plus petit des deux objectifs à la borne
supérieure du palier, le maximum au plus grand à sa borne inférieure ; un minimum de 0 s'affiche
« aucun ». Le texte ajoute ensuite *« L'évaluation propre au locuteur : il a évalué A lignes réaffichées
sur J de la même manière qu'auparavant (P %), si bien qu'environ E % des évaluations changent de sens au hasard … les propositions réellement correctes à 80 % peuvent être marquées correctes environ T %
du temps selon ses évaluations — l'intervalle en tient compte. »* (avec, lorsque K est
de 1 % ou plus dans un sens ou dans l'autre, la fréquence à laquelle les propositions autrefois marquées incorrectes
sont désormais marquées correctes, en plus ou en moins) ; avant ce stade, *« (L'erreur d'évaluation propre au locuteur n'est pas encore
prise en compte : trop peu de lignes réaffichées ont été évaluées.) »* `report.json`
transmet ces données sous la forme `projection_numbers` (`more_sentences`, `range`,
`speaker_hours`).

En simulation — un locuteur bruité, le jeu de développement propre aux rails et ces règles
de verdict, 200 essais par scénario sur deux jeux de graines — l'estimation s'est située
à un facteur 2 près du décompte réel 69–78 % du temps avec 400 nouvelles
phrases par cycle et 53–56 % avec 800, et le décompte réel s'est inscrit dans
l'intervalle 89–94 % et 76–80 % du temps (sans répétitions, 91–93 % et 51–54 %).
Ajuster l'estimation elle-même aux évaluations du locuteur s'est avéré bénéfique à 800 phrases par cycle et
défavorable à 400 (à un facteur 2 près : 64 % et 19 %), elle est donc maintenue au seuil brut de
80 %. L'ajout d'une mention indiquant que le modèle « fonctionne peut-être déjà » a été testé puis abandonné :
il s'est révélé faux 2 à 3 fois pour chaque fois où il était exact. Une simple approximation, présentée comme telle.

## Ce que les chiffres ne disent pas

- Un score vaut pour le système sur ce jeu de données précis, non pour une phrase isolée : il n'existe aucune
  mesure de confiance par phrase.
- Le chrF++ mesure le chevauchement avec une référence. Une bonne traduction formulée
  différemment peut obtenir un score faible ; une traduction fluide mais erronée peut obtenir un score relativement élevé.
- L'acceptation par FST indique que les mots existent, et non que la phrase a le sens voulu.
- Les lignes du classement publiées sont auto-déclarées par défaut ; le vérificateur
  réévalue les sorties soumises par rapport au corpus vérifié par empreinte de hachage (à 1,0 point de
  chrF++ près) et ne réexécute pas les méthodes.

## Comment communiquer un résultat chiffré

Chaque chiffre doit mentionner **son unité, ce qu'il mesure et le jeu sur lequel il a été
mesuré** — accompagnés de la taille du jeu et de l'intervalle lorsqu'il en existe un.

| Dire | Ne jamais dire |
|---|---|
| « chrF++ 24,1 sur 100 sur les 50 phrases de pratique (dev), plage 20,6–27,6 » | « 24,1 » · « précis à 24 % » |
| « le locuteur a jugé correctes 9 des 24 nouvelles ébauches — 38 % (21 %–57 %) » | « précision de 38 % » |
| « aucun changement mesurable : sur 50 phrases de dev, seule une différence d'environ 5,8 points est détectable » | « amélioration légère » |
| « trop peu de phrases de pratique pour se prononcer : en dessous de 50, aucune comparaison ne tranche — les évaluations à l'aveugle du locuteur le feront » | « aucun changement » pour un verdict **too-few** |
| « sur les 50 phrases de test verrouillées, une seule fois, par rapport à la prédiction que vous avez formulée : "…" » (leurs propres mots, relus) | un score de test sans jeu de données ni prédiction |
| « à l'aveugle, sur de nouvelles phrases, le locuteur a jugé le modèle le plus récent correct sur 7 ébauches sur 12 et le modèle en service sur 5 sur 12 — aucune différence nette sur 24 phrases » | « le nouveau modèle est meilleur » à partir des seules évaluations |
| « chrF++ 31,0 avec filtres (ce qui est déployé), 33,5 sans filtre, 12 % refusés par les filtres » | le score avec filtres seul |

- Un intervalle exprime le degré de certitude des outils, et non deux résultats distincts.
- Deux scores établis sur des jeux différents ne sont pas comparables. Deux scores sur le même jeu
  ne diffèrent que lorsque le test apparié l'établit.
- Citez les avertissements et mises en garde mot pour mot.
- Ne qualifiez jamais un score de bon ou de mauvais ; n'y associez aucun qualificatif de qualité. C'est à un locuteur
  courant de décider de ce qui est apte à l'usage.

## Approfondir

- [La spécification d'évaluation](/docs/network/specifications/scoring) et
  [la significativité](/docs/network/specifications/significance).
- [La fiche d'exécution](/docs/network/specifications/run-card) — ce qu'enregistre une exécution
  évaluée.
- [La fiabilité des métriques](/docs/network/specifications/metric-reliability) —
  quelles métriques ont été vérifiées par rapport aux jugements humains et pour quelles langues.
- [Les limites techniques](/docs/network/honest-limitations).
- [Les garde-fous](/docs/guardrails) — la version destinée à la communauté.
