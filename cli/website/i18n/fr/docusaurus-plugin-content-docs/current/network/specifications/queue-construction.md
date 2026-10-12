---
sidebar_position: 8
title: "Spécification de construction de file d'attente"
slug: '/network/specifications/queue-construction'
description: "La formule transparente derrière la file d'attente de calcul communautaire : classement par valeur de chaîne attendue, chaque composant publié, chaque rang redérivable à la main."
related:
  - label: "Why the Queue Is Built This Way"
    to: /docs/network/perspectives/why-the-queue
    kind: position
    note: "The philosophy behind this formula"
  - label: "Contributing Compute"
    to: /docs/network/getting-started/contributing-compute
    kind: guide
    note: "How to actually run queue items"
  - label: "Scoring Specification"
    to: /docs/network/specifications/scoring
    kind: spec
  - label: "Corpus Design Framework"
    to: /docs/network/specifications/corpus-design
    kind: spec
    note: "Small-corpus floors and noise thresholds the formula inherits"
---

# Spécification de la construction de la file d'attente

**Version de la formule : `ecv-v3` (valeur de chaîne attendue avec fiabilité du pont).** Ce document est la définition normative de la façon dont [champollion.dev/queue.json](https://champollion.dev/queue.json) est ordonnée. L'implémentation (`arena/scripts/generate_sweep_queue.py` dans le dépôt public du harnais) reflète cette page section par section ; les métadonnées de la file d'attente reprennent les valeurs de paramètres exactes utilisées au moment de la génération, et **chaque élément porte sa décomposition de formule complète**, de sorte que tout classement peut être redérivé à la main à partir du JSON publié seul. Si cette page et la file d'attente ne s'accordent jamais, c'est un bogue — veuillez le signaler.

**La file d'attente aujourd'hui, en un paragraphe.** La file d'attente publique contient à la fois des éléments LLM (conditions de prompt naïves et guidées) et des éléments de moteurs de services de traduction automatique (TA) sur un seul tableau, classés selon l'ordre d'exploration (`map`, §2.2) : première lumière à travers les paires, les langues et les familles par dollar, avec un bonus de première lecture pour les langues qui n'ont jamais été mesurées (§2.2), des paliers budgétaires publiés dans l'aperçu (§2.1.1), et le classement complet servi depuis la base de données (le fichier statique contient la tranche supérieure lorsque le classement complet dépasse sa limite de taille, et l'indique). Les sections ci-dessous constituent la définition normative, conservée avec l'historique daté de leurs décisions — les métadonnées de toute file d'attente servie nomment les paramètres exacts qui l'ont classée.

> **v3 (2026-06-13).** Chaque arête est maintenant un *pont* avec deux nombres — qualité et fiabilité — et la matrice de chaîne s'exécute sur leur produit (§1.5). 62 éléments de vocabulaire d'un seul mot exécutés une fois ne peuvent plus ressembler à un chemin ; les réplications, les corpus plus grands, les corpus plus riches et les intervalles de confiance plus serrés portent tous une valeur tarifée. Les files d'attente v2 (qualité uniquement) restent interprétables via leurs propres métadonnées.

## 1. L'objectif : un maillage pondéré par la qualité

La mission est *chaque langue vers chaque langue par chaînes de paires mesurées individuellement*. Une traduction entre deux langues sans référence directe est servie par **chaînage** de paires de référence (X→pivot→Y), de sorte que ce que vaut la référence n'est pas son nombre de corpus mais la **capacité de chaîne de son graphe**.

**Définitions.** Soit le *graphe de référence* avoir un nœud par langue et, pour chaque paire de langues avec au moins une exécution publiée et non disqualifiée, une **force d'arête**

```
s(e) = (best published corpus-level chrF++ on that pair) / 100   ∈ [0, 1]
```

Le chrF++ au niveau du corpus est le nombre publié canonique (voir la [Spécification de notation](/docs/network/specifications/scoring)) ; *meilleur* parce qu'une chaîne acheminerait par le meilleur système démontré par saut. Les paires sans exécutions publiées ont s(e) = 0.

La **force de chaîne estimée** d'un chemin P entre deux langues est

```
strength(P) = λ^(|P|−1) · Π_{e ∈ P} s(e)
```

— les qualités d'arête se composent multiplicativement, et chaque *jonction* (chaque pivot intermédiaire) coûte un facteur de fidélité supplémentaire **λ < 1**. Les deux choix sont fondés sur la littérature de traduction par pivot : la traduction par un pivot perd de manière fiable en qualité par rapport à la traduction directe, au-delà de ce que la composition naïve suggère (Utiyama & Isahara 2007 ; Wu & Wang 2007), la taille de la perte dépend du pivot choisi (Paul et al. 2009), et la construction de paires *directes* non centrées sur l'anglais surpasse clairement le pivotage par l'anglais à grande échelle — d'environ 10 BLEU dans le cadre many-to-many de M2M-100 (Fan et al. 2021). λ est le rappel permanent de la formule qu'une chaîne estimée n'est pas une mesure : seule une exécution directe supprime la remise.

La **matrice de meilleure chaîne** et l'**objectif de maillage** sont alors

```
Q(u,v) = max over paths P from u to v of strength(P)      (1 if u = v, 0 if disconnected)

Φ = mean over ordered language pairs (u ≠ v) of Q(u,v)    ∈ [0, 1]
```

Q est calculé exactement comme un problème de chemin le plus court sous la transformation logarithmique standard (poids d'arête −ln(λ·s(e)) ≥ 0, Dijkstra, puis Q = exp(−d)/λ). Φ est la construction *d'efficacité globale* de [Latora & Marchiori (2001)](https://arxiv.org/abs/cond-mat/0101396) avec le noyau 1/distance remplacé par la fidélité de chaîne multiplicative — le noyau naturel quand les arêtes portent la rétention de qualité par saut plutôt que des longueurs unitaires. (La file d'attente v1 classée par gain d'efficacité globale non pondérée — le cas particulier de cette famille où tout ce que vous savez sur une arête est si elle existe.)

### 1.5 Fiabilité : un pont est (q, r)

Un score éclatant sur un corpus minuscule, mince et jamais répliqué n'est pas un pont. v3 divise donc chaque arête mesurée en :

```
quality      q(e)   = best published corpus-level chrF++ / 100
reliability  r(e)   = f_size · f_rich · f_conf · f_repl        ∈ [0, 1]
effective    s_eff(e) = q(e) · r(e)        ← what chains compose over
```

| Facteur | Définition | Crédit complet à | Ancrage |
|---|---|---|---|
| `f_size` | min(1, n/100), n = entrées évaluées de la meilleure exécution | 100 entrées | le plancher de signification de la [conception de corpus](/docs/network/specifications/corpus-design) ; Koehn (2004) valide les tests d'amorçage sur des ensembles d'environ 300 phrases — même 300 est « petit », donc la taille réduit la fiabilité plutôt que de simplement gater l'affichage |
| `f_rich` | min(1, L̄/5), L̄ = longueur source *effective* moyenne | 5 mots effectifs | AmericasNLP (Mager et al. 2021) a adopté chrF parce que les unités au niveau des mots se cassent sur la morphologie riche ; Mager et al. (2022) documentent les jetons d'espace blanc comme la mauvaise unité |
| `f_conf` | min(1, 5/h), h = la demi-largeur IC chrF 95% de la meilleure exécution (proxy `50/√n` quand non publié) | IC ≤ ±5 chrF | le plancher de bruit en dessous duquel les deltas sont indistinguibles sur les petits corpus ; Kocmi et al. (2021) montrent que les deltas intra-IC contredisent fréquemment les préférences humaines |
| `f_repl` | min(1, exécutions/2) | 2 exécutions publiées | Marie, Fujita & Rubino (2021), méta-évaluant 769 articles : les comparaisons simples non répliquées sont l'échec de crédibilité documenté du domaine |

La **longueur effective** est mesurée en unités de contenu, pas en mots d'espace blanc : `L̄ = mean source chars / c(L)`, où l'*économie de caractères* `c(L)` est la médiane des caractères du côté de la langue L par mot anglais du côté aligné, mesurée à partir des corpus parallèles propres de ce projet (7 400+ entrées alignées au moment de la livraison v3 : cmn 1,6, jpn 2,3, kor 2,6 ; baseline eng 5,0 ; deu 6,0 ; crk 4,7 — mots polysynthétiques tarifés par le contenu qu'ils portent). Pas de tables de consultation de typologie ; l'estimation s'affine à mesure que les corpus se développent ; les langues sans données appariées à l'eng utilisent l'économie par défaut. Estampillé par corpus dans le registre (bloc `richness`).

**Niveaux de pont** (vocabulaire d'affichage) : **établi** — n ≥ 100, L̄ ≥ 5, h ≤ 5, exécutions ≥ 2 ; **provisoire** — mesuré mais échouant à l'un quelconque ; **enregistré** — pas d'exécutions publiées. Une affirmation de chaîne (« vous pouvez aller de X à Y ») n'est aussi forte que le niveau du saut le plus faible, et la visualisation du maillage montre la fiabilité comme l'opacité des arêtes.

**Vérifications travaillées** (à partir du script de vérification archivé, exécuté avant la livraison v3) : *62 éléments de vocabulaire d'un seul mot, une exécution* → r ≈ **0,04** (pas un chemin) ; *200 phrases, ±3 IC, 3 exécutions* → r = **1,00** ; un corpus japonais de 101 entrées dont le nombre de mots naïf est 1,0 (artefact de script) se réhabilite à 6,5 mots effectifs et `f_rich` complet. Les limites et la monotonie par facteur sont testées par propriété.

**Valeur d'une exécution sous v3.** Une exécution peut améliorer un pont de deux façons, et ΔΦ prend le meilleur de : **(a)** elle devient la meilleure exécution de l'arête — `ŝ_eff = qualité prédite × r(n du corpus, richesse, proxy IC, exécutions+1)` ; ou **(b)** elle réplique simplement — la meilleure actuelle reste, `f_repl` augmente. La réplication sur une arête à exécution unique est donc une valeur réelle, tarifée, et un corpus plus grand ou plus riche sur une paire mesurée surpasse une ré-exécution du petit. Les éléments exposent `edge_quality`, `edge_reliability`, `edge_tier`, `effective_strength`, `post_run_reliability`, et `predicted_effective` aux côtés des champs de prédiction v2.

**Ce que Φ n'est pas.** Φ est la devise de priorisation interne de la file d'attente, pas une affirmation de capacité. Ses entrées sont des scores d'ensemble de développement avec toutes les mises en garde du [Cadre de conception de corpus](/docs/network/specifications/corpus-design) : la contamination possible des données d'entraînement rend chaque score une limite supérieure, les valeurs chrF++ ne sont pas strictement comparables entre les langues, et les petits corpus portent des intervalles de confiance larges. La formule n'a besoin que de Φ pour *classer les exécutions par utilité* ; elle n'est jamais publiée comme une garantie de qualité.

## 2. Le problème de décision

Les éléments ouverts de la file d'attente sont toutes les combinaisons (corpus, modèle, condition) qui sont éligibles (jeu de développement, licence redistribuable, non mises en quarantaine, éligibles à la transmission, et **résolubles pour l'évaluation** — voir la barrière d'identité linguistique au §2.2) et qui ne figurent pas encore dans le classement. Les réexécutions identiques de combinaisons couvertes sont exclues — les empreintes des fiches d'exécution les dédoublonnent lors de la publication — mais les nouveaux modèles ou conditions sur une paire déjà mesurée restent des éléments ouverts.

Le calcul contribué est un budget. Choisir quel élément ouvert exécuter ensuite de sorte que le maillage s'améliore le plus rapidement est une maximisation de style couverture budgétée, et l'approche canonique est la sélection gourmande par **valeur marginale par unité de coût** : pour les objectifs submodulaires monotones, la règle gourmande porte la garantie classique (1 − 1/e) (Nemhauser, Wolsey & Fisher 1978), et sa forme de ratio bénéfice/coût est l'algorithme standard sous budgets (Khuller, Moss & Naor 1999). Nous utilisons la règle de ratio comme notre principe de classement. (Note d'honnêteté : notre objectif a des rendements décroissants de style couverture dans son noyau déterministe, mais la couche de prédiction stochastique signifie que nous citons la garantie gourmande comme *motivation*, pas comme un théorème sur ce système exact.)

```
ECV(item) = ΔΦ(item) / max(est_cost_usd, COST_FLOOR)
```

Les éléments sont classés par ECV décroissant. Les égalités se cassent : naïf avant entraîné, moins cher d'abord, puis id d'élément.

### 2.1 Remèdes de classement — 2026-07-12

Quatre ajustements superposés à la règle ECV gourmande, chacun répercuté dans les métadonnées de la file d'attente (`priority_parameters.contamination_ecv_factors`,
`priority_parameters.frontier_interleave`, `metadata.preview_policy`) :

1. **Multiplicateur de contamination.** L'ECV de chaque élément est multiplié par un facteur provenant de la note de contamination de son corpus : **LOW 1.0 / MEDIUM 0.4 / HIGH 0.1**, une note inconnue ou manquante étant traitée comme MEDIUM (ne jamais supposer une pureté). Justification : le graphe de chaîne propre n'admet que les arêtes de contamination LOW, donc une exécution non-LOW ne peut pas y entrer et ne doit pas surclasser le travail de maille propre à coût égal. Les éléments non-LOW restent en file d'attente — les comparaisons de voies relatives ont une valeur réelle — ils se classent simplement derrière le travail propre.
2. **Entrelacement de frontière.** Après le tri gourmand, chaque 5e emplacement de priorité porte l'élément le mieux classé non encore placé de l'ensemble du modèle de frontière (maintenu comme donnée dans le générateur et répercuté dans les métadonnées), de sorte que la preuve de frontière atteint les priors de prédiction tôt au lieu de seulement après la saturation des niveaux bon marché. Réorganisation pure : rien n'est supprimé ou dupliqué, un élément de frontière qui a gagné un emplacement naturel le conserve, et les priorités sont numérotées à partir de l'ordre tissé — le classement publié est la vérité.
3. **Plafond du hub source d'aperçu.** L'aperçu public des 25 premiers affiche au maximum **6** éléments partageant une langue source, de sorte qu'un hub bien doté d'une seule ressource ne peut pas monopoliser la vitrine. Les éléments au-delà du plafond conservent leur priorité réelle dans la file d'attente complète ; l'aperçu extrait simplement l'élément admissible suivant dans l'ordre de classement.
4. **Exclusion de langue construite d'aperçu.** Les éléments dont la source ou la cible est une langue construite sont ignorés par l'aperçu. La détermination est pilotée par la famille de cartes (le compartiment Langue artificielle de Glottolog, lu à partir des cartes de langue — jamais un ensemble de langue codé en dur), et la liste de codes dérivée est publiée dans `metadata.preview_policy` de sorte que les actualisations côté serveur appliquent la même sélection.

(3) et (4) sont **une politique de présentation uniquement** : la `queue.json` complète, son classement et ses priorités ne sont pas affectés.

### 2.1.1 Paliers budgétaires — « qu'est-ce que X $ permettent d'acheter ? » (2026-08-24)

`queue-preview.json` contient un tableau `budget_tiers` résumant, pour des budgets de **1 $ / 10 $ / 100 $ / 1000 $**, le préfixe abordable glouton du classement publié : parcourez les éléments par ordre de priorité, prenez chaque élément dont le coût estimé rentre encore dans le budget, ignorez ceux pour lesquels ce n'est pas le cas, et continuez à remplir avec des éléments ultérieurs moins chers. Chaque palier indique combien d'éléments cela permet d'acheter, leur coût estimé total, combien de paires de langues et de modèles distincts ils concernent, et jusqu'à quelle profondeur dans le classement le budget permet d'aller (`max_priority`).

Parce que le classement est déjà basé sur la valeur marginale par coût (§2), le préfixe abordable glouton **est** l'allocation que ce modèle recommande pour cette dépense — un petit contributeur et un grand contributeur lisent chacun une réponse concrète et optimale à partir du même classement publié, plutôt qu'une liste implicitement dimensionnée pour personne. Les paliers ne sont que des résumés : l'allocation elle-même n'est que le classement, parcouru dans l'ordre en fonction de votre propre budget. Les actualisations côté serveur recalculent les paliers sur les éléments restants avec le même parcours (le générateur et la fonction d'actualisation l'implémentent comme des jumeaux, testés des deux côtés).

### 2.2 Voies et modes de classement — 2026-07-19

La file d'attente servie déclare, dans ses propres métadonnées, quelle **voie** elle contient et quel **mode de classement** l'a ordonnée. Les métadonnées font autorité ; cette section définit le vocabulaire.

**Voies** (`metadata.lane`, `metadata.lane_policy`). Depuis le 2026-08-27, la file d'attente publique contient la voie **both** (les deux) : les éléments LLM (modèle × condition de prompt) **et** les éléments de services de TA (condition `engine` — DeepL, Google Translate, Microsoft Translator, LibreTranslate, Tilde ; chacun n'est mis en file d'attente que pour les paires figurant dans sa propre liste de couverture publiée). La voie **llm** du 2026-07-19 — éléments LLM uniquement, restreints aux paires dont au moins un côté est en dehors de la couverture publiée de tous les services de TA — réservait l'évaluation des services à des campagnes gérées par les organisateurs qui n'ont jamais été exécutées, ce qui a parqué la majeure partie du catalogue ; la mesure des services *est* l'épine dorsale de la carte de couverture, de sorte que les deux types de travaux se trouvent désormais sur un seul tableau. L'union des couvertures (avec des alias de macrolangues via les fiches de langues) est toujours répercutée en tant que `service_coverage_methods` et `service_covered_languages`, et une file d'attente de la voie llm signale toujours ses paires exclues en tant que `pairs_dropped_fully_covered`.

**Limite de taille du blob** (2026-08-27). Le `queue.json` servi est un fichier statique avec un plafond d'hébergement strict, donc lorsque le classement complet le dépasse, le fichier contient la **tranche supérieure** du classement et l'indique dans `metadata.blob_truncated {kept, total}` — il ne s'agit jamais d'une limite silencieuse. La file d'attente de la base de données (`queue_top()` / `queue_pairs()`) sert toujours le classement **complet** et constitue la liste de travail faisant autorité ; l'agrégation des paires et les paliers budgétaires de l'aperçu décrivent l'artefact avec lequel ils sont livrés.

**Barrière d'identité linguistique** (2026-07-19). Les éléments de la file d'attente ciblent uniquement les **codes ISO 639-3 individuels actifs** — un score par rapport à une macrolangue (« Arabe ») ou à un code de famille collectif (« Langues berbères ») serait une affirmation irréfutable concernant des variétés jamais évaluées (le même raisonnement que FLORES-200/NLLB suit en codant les données comme `arb`/`quy`/`zsm`). Les étiquettes de corpus en amont sont *résolues*, jamais suivies aveuglément ou ignorées : les balises d'écriture sont retirées mécaniquement (un corpus `eng→cmn-Hans` est mis en file d'attente pour `eng→cmn`, l'écriture étant conservée comme métadonnée d'affichage de l'élément `source_script`/ `target_script`) ; les codes proprement retirés suivent leur successeur ISO officiel ; et un corpus macro-étiqueté n'est mis en file d'attente que sous une **résolution de variété** enregistrée et citée sur son entrée de registre (par exemple, FLORES+ documente son quechua comme `quy`). Les corpus qui ne se résolvent sur aucune de ces voies sont exclus avec des raisons lisibles par machine publiées dans `metadata.doctrine_exclusions` (total, décomptes par raison, raisons par corpus) et comptabilisés dans le registre des déserts (`service_landscape.invisible_reasons.corpus_excluded_by_doctrine`) — des exclusions visibles, jamais des abandons silencieux. Les résultats historiques sur des corpus étiquetés de manière globale conservent leur propre nœud de maillage nommé honnêtement (nœud `scope` : `macrolanguage` / `collective` / `retired`), et ne sont jamais fusionnés dans une variété membre. Les entrées de résolution sont toutes publiées : les tampons `language_resolution` par entrée du registre contiennent les codes résolus, les portées et les citations de référence.

**Modes de classement** (`metadata.rank_mode`, décrits dans `metadata.priority_model`). Deux ordonnancements des mêmes éléments :

- **ecv** — la règle gloutonne de la valeur attendue de la chaîne (expected-chain-value) des §2–§3 : amélioration du maillage par dollar estimé. L'ordre d'exploitation ; approprié lorsque le tableau est suffisamment dense pour que les prédictions et ΔΦ portent un signal.
- **map** (map-value v2) — l'ordre d'exploration :
  `MapValue = novelty × uncertainty × promise × connectivity ×
  corpus-quality × contamination ÷ cost`, assemblé par une trace gloutonne exacte. La *nouveauté* (novelty) est un crédit positionnel de première lumière qui diminue à mesure que les éléments déjà placés occupent la même paire dirigée (1/(1+n)), langue cible, famille cible, cellule méthode × famille cible, et cellule cible × domaine (chacun 1/√(1+n) ; les familles proviennent des fiches de langues, les domaines de la taxonomie du registre de corpus — la couverture initiale d'une cible doit s'étendre sur les registres, et non répéter le premier domaine mesuré). L'*incertitude* (uncertainty) est la profondeur de repli de la prédiction du §3.1 (paire 0.25 · langue cible 0.55 · langue source 0.75 · global 1.0) × 1/(1+exécutions publiées sur l'arête). La *promesse* (promise) est la force prédite du §3.1 avec un plancher à 0.25 — les inconnues susceptibles de fonctionner sont en tête, et cartographier un désert probable conserve de la valeur. La *connectivité* (connectivity) classe plus haut les paires qui **relient le réseau mesuré à une langue qu'il ne peut pas encore atteindre** : un point d'extrémité est *établi* lorsqu'il se trouve sur une arête de maillage mesurée (`mesh.json`, statut `measured`) ou dans la liste de couverture publiée de n'importe quel service de TA (avec alias de macrolangues, le même aliasing que la barrière de voie ci-dessus) ; les **ponts** (exactement un point d'extrémité établi) et les **îles** (aucun) obtiennent tous deux un score de 1.0 — depuis le 2026-08-27, la première lumière d'un désert déconnecté compte pleinement (les îles obtenaient un score de 0.5 sous le dimensionnement de croissance à partir du réseau du 2026-07-19, ce qui rétrogradait structurellement la queue la plus profonde) — tandis que la densification **intérieure** (les deux établis) obtient un score de 0.5 : le renforcement entre des points connus est le travail du mode ecv. Un **bonus de première lecture** (×2.0) multiplie en outre la valeur d'exploration de tout élément dont la langue source ou cible a ZÉRO mesure publiée nulle part — le neuvième principe, énoncé clairement : **la première lecture d'une langue prime sur le raffinement**. Le facteur d'incertitude seul ne peut pas exprimer cela (il note une paire non mesurée entre deux langues bien mesurées de manière identique à une langue jamais mesurée) ; le bonus fait de la première lumière de la longue traîne un objectif déclaré plutôt qu'un accident émergent. Les deux facteurs sont portés par `metadata.map_value_parameters` et s'appliquent de manière identique dans la composante d'exploration d'edv (§2.3).

  L'autre moitié du neuvième principe vit EN DEHORS du classement : aucun ordonnancement d'éléments existants ne peut atteindre une langue sans aucun corpus (environ 7 500 langues vivantes à code individuel aujourd'hui). La **liste de souhaits de corpus** (`/corpus-wishlist.json`, régénérée à côté de la file d'attente) publie cette frontière d'acquisition : chaque langue vivante, à code individuel et sans corpus, classée par son meilleur nombre de locuteurs cité — le nombre de locuteurs servant d'indicateur de faisabilité pour une communauté qui pourrait réellement construire un corpus — chaque décompte étant attribué à sa source et jamais arbitré.
  La *qualité du corpus* (corpus-quality) est le potentiel de fiabilité intrinsèque du corpus `f_size × f_rich` du §1.5 — l'exploration doit atterrir sur des corpus capables de supporter la charge, de sorte qu'une liste de vocabulaire de mots simples de 62 entrées ne figure plus en tête simplement parce qu'elle est bon marché ; une mesure de richesse manquante reste neutre (l'absence de mesure n'est pas une preuve de pauvreté). La discipline en matière de coût et de contamination est identique à ecv. L'entrelacement de la frontière et les départages (§2.1) s'appliquent sans changement. Approprié pour la phase d'exploration : cela maximise ce que la *carte apprend* par dollar — premières mesures à travers les paires, les langues, les familles, les cellules de méthode et les domaines, en se développant à partir du réseau mesuré au lieu de s'éparpiller — au prix délibéré d'une croissance plus lente de la force du maillage.

> **map-value v2 (2026-07-19).** Deux ajouts dirigés par le fondateur à l'ordre d'exploration : les paires qui *font le pont vers le réseau mesuré* se classent désormais devant les sondes déconnectées et la densification intérieure, et la qualité du corpus (plancher de taille × richesse effective, §1.5) plus la répartition des domaines par cible pondèrent le classement — la puissance de calcul des contributeurs doit relier les chemins établis aux nouveaux, sur des corpus suffisamment bons pour supporter la charge. La licence reste une **barrière, pas une pondération** : les règles de licence et de canal de transmission décident de ce qui peut être mis en file d'attente (§2, et le `transmission_note` de la file d'attente) ; parmi les corpus éligibles, le classement est aveugle aux licences, de sorte que les ensembles de recherche restreints mais épinglés — souvent le seul corpus d'une paire — ne sont jamais systématiquement privés de ressources. Les files d'attente v1 (nouveauté × incertitude × promesse uniquement) restent interprétables via leurs propres métadonnées.

Les valeurs exactes des facteurs utilisées lors de la génération sont incluses dans `metadata.map_value_parameters` ; les entrées de connectivité et de qualité peuvent être recalculées à partir du `mesh.json` publié (arêtes mesurées), de l'union de la couverture des services répercutée dans les métadonnées, et de `registry.json` (nombre d'entrées + richesse). Chaque élément conserve en outre les champs de diagnostic complets d'ecv-v3 quel que soit le mode, de sorte que l'un ou l'autre ordonnancement peut être recalculé à partir des mêmes artefacts.

### 2.3 Mode de classement `edv` — valeur de décision attendue (2026-08-27)

*Statut : implémenté, désactivé par défaut en attendant la comparaison mesurée au §2.3.6. Le paramètre par défaut publié reste `map` d'ici là.*

La file d'attente achète exactement deux produits : la **carte des capacités** (quelle méthode est bonne à quoi, avec une incertitude honnête) et le **maillage de routage** (paires mesurées qui s'enchaînent en itinéraires). `edv` évalue chaque élément candidat en fonction de la mesure dans laquelle il fait progresser les deux, sous forme de portefeuille pondéré :

```
EDV(item) = [ w_judge·Ĵ + w_mesh·M̂ + w_survey·Ŝ ] × contamination ÷ max(cost, COST_FLOOR)
```

avec les valeurs par défaut `w_judge = 0.35, w_mesh = 0.25, w_survey = 0.40`
(réglables par le fondateur ; chaque génération répercute les pondérations réellement utilisées dans `metadata.edv_parameters`). Le facteur de contamination (remède 1 du §2.1) est appliqué exactement une fois, en tant que multiplicateur externe. Les licences et la transmission restent des **barrières, pas des pondérations** — l'éligibilité est décidée avant qu'aucune valeur ne soit calculée, et le classement est aveugle aux licences parmi les corpus éligibles.

#### 2.3.1 Ĵ — valeur de jugement de méthode

Évalue dans quelle mesure l'exécution fait progresser la **résolution des comparaisons de méthodes sur un même corpus** — la seule affirmation inter-méthodes que la propre recherche de mesure de ce projet autorise. (L'étude de transfert de difficulté W2 a rejeté la liaison des capacités inter-langues ; son résultat positif autorisé — l'ajustement additif méthode × corpus intra-langue — est exactement ce que ce composant utilise. Les scores sont utilisés uniquement pour l'ordonnancement et la séparation, jamais convertis en probabilités d'acceptabilité, conformément au pilote d'étalonnage.)

Pour un candidat (corpus C, méthode M, condition) : les **partenaires de contraste** sont les méthodes M′ qui ont déjà une exécution publiée sur (C, même condition). Pour chaque partenaire, avec `sep` la séparation des scores en points chrF sur les demi-largeurs d'IC regroupées (IC enregistrés ; proxy `50/√n` lorsqu'ils ne sont pas publiés), et `sep_pred` la même chose calculée par rapport au score prédit du §3.1 :

| état de contraste de {M, M′} sur la paire | crédit |
|---|---|
| **non rencontré** — aucun corpus partagé pour le moment | `JUDGE_FIRST = 1.0` |
| **contesté** — des corpus partagés existent, tous `sep < Z_DEC` | `JUDGE_CONTESTED = 0.8 × clip(sep_pred / Z_DEC, 0, 1)` |
| **décidé** — certains `sep ≥ Z_DEC`, n_dec corpus le décident | `JUDGE_DECIDED = 0.25 / (1 + n_dec)` |

chacun multiplié par `w_top = 1/√(rank(M)·rank(M′))` — décider de la première place contre la deuxième vaut plus que la septième contre la huitième. Le classement des méthodes par paire utilise l'ajustement additif autorisé méthode × corpus (moindres carrés alternés sur les cellules observées) lorsque la paire a ≥2 méthodes × ≥2 corpus mesurés, sinon le meilleur score par méthode ; l'ajustement est **strictement par paire, jamais regroupé entre les langues**. `Z_DEC = 1.96`.

Un contraste guidé contre naïf sur le même (C, M) ajoute `JUDGE_COND = 0.5 / (1 + n_cond)`. Les contrastes d'un élément sont additionnés avec des rendements décroissants (`JUDGE_GAMMA = 0.7` par contraste supplémentaire, triés par ordre décroissant), plus un **terme d'amorçage** `JUDGE_SEED = 0.25 × min(1, m_C/3) × corpus-quality` (m_C = autres méthodes de la sélection avec un élément en file d'attente sur C) de sorte qu'un tableau vide préfère toujours les corpus où les comparaisons futures pourront être jugées — valeur de lieu, jamais un score emprunté. Lors de l'assemblage, le composant juge décroît `1/(1 + items already placed on the same pair and condition lane)`.

#### 2.3.2 M̂ et Ŝ

`M̂` est le gain de maillage attendu (ΔΦ) du §3, inchangé, avec la matrice de chaîne figée au moment de la génération. `Ŝ` est le cœur de map-value v2 du §2.2 — `uncertainty × promise × connectivity × corpus-quality` avec la décroissance de nouveauté positionnelle — inchangé. Le *niveau* de score prédit (promesse) ne réside que dans Ŝ ; Ĵ n'utilise que les *séparations* de scores — les deux composants ne peuvent pas compter deux fois le même optimisme.

#### 2.3.3 Normalisation

Les trois composants existent sur des échelles incommensurables, de sorte que chaque composant statique est divisé par son 95e centile sur l'ensemble des candidats (plafonné à `EDV_NORM_CAP = 4.0`) ; les trois normalisateurs sont inclus dans `metadata.edv_parameters.normalizers`, ce qui rend chaque valeur EDV publiée recalculable à partir de ses propres artefacts.

#### 2.3.4 Assemblage

L'ordonnancement est exactement la même trace gloutonne paresseuse (lazy-greedy) que le mode map : chaque multiplicateur dépendant de l'ordre (nouveauté d'exploration, décroissance de placement du juge) est monotone décroissante à mesure que les éléments sont placés, de sorte qu'une entrée de tas obsolète ne peut que surestimer — l'invariant glouton paresseux est maintenu et la trace équivaut à un algorithme glouton par force brute. L'entrelacement de la frontière, la politique d'aperçu et les paliers budgétaires s'appliquent sans changement.

#### 2.3.5 Explicabilité

Chaque élément conserve, dans ses diagnostics : la liste de contrastes pour laquelle il a été crédité (partenaire, état, séparation prédite, pondération de rang), les termes d'amorçage et de décroissance, tous les champs des §2.2 et §3, les pondérations et les normalisateurs — la valeur EDV publiée est exactement recalculable à partir de la ligne. Il est possible de répondre à la question « Comment cet élément a-t-il obtenu ce rang ? » sans aucun état externe.

#### 2.3.6 Critère d'adoption

`edv` ne devient le paramètre par défaut publié qu'après une comparaison mesurée par rapport à `map` et `ecv` sur le même tableau : à moins de 10 % de map sur chaque métrique d'exploration (centiles de profondeur de première lumière, paires/langues/familles distinctes en profondeur, taux de nouvelles paires marginales), strictement meilleur sur les deux métriques de juge (contrastes contestés résolus par 1 000 $ simulés ; récupération du classement des méthodes à dépense fixe), et une croissance du maillage par dollar non inférieure à map. Le rapport de comparaison est publié en même temps que le basculement.

## 3. La valeur d'une exécution

### 3.1 Prédire le score avant d'exécuter

Le score attendu d'une (paire, modèle, condition) non exécutée est une somme délibérément simple et entièrement inspectable — une prédiction d'effets principaux bidirectionnels plus l'optimisme structuré, chaque terme publié sur l'élément :

```
ŝ = clip( pair_prior + model_offset + condition_offset + exploration_bonus,  0, S_CAP )
```

- **`pair_prior`** — retour hiérarchique sur les forces publiées : moyenne sur cette paire → moyenne sur cette langue cible → moyenne sur cette langue source → moyenne globale → `S0_FALLBACK`. Le niveau utilisé est publié comme `prior_basis`.
- **`model_offset`** — comment ce modèle se comporte par rapport aux *autres* modèles sur la même paire, en moyenne sur toutes les paires où une comparaison existe. Zéro pour les modèles jamais vus.
- **`condition_offset`** — le delta entraîné-moins-naïf observé sur la même paire (revenant à la même langue cible), et **zéro sinon** : les gains d'entraînement sont réels où mesurés mais ne sont pas supposés se transférer entre les langues, donc sur les paires non évidencées la convention baseline-first tient.
- **`exploration_bonus`** — l'optimisme face à l'incertitude, avec l'horaire UCB1 (Auer, Cesa-Bianchi & Fischer 2002) : `κ·sqrt(2·ln(1+N)/(1+n))`, où N est le nombre total d'exécutions notées publiées et n le nombre sur cette (paire, modèle). Les cellules jamais essayées obtiennent le plus grand bonus ; les cellules bien mesurées décroissent vers zéro. Nous empruntons l'horaire — la forme qui fait réapparaître les bras sous-explorés au bon rythme — pas le théorème de regret, qui suppose un bandit stationnaire que ce système n'est pas.

### 3.2 Le gain de maillage, sous forme fermée

Une exécution ne peut améliorer le maillage qu'en élevant l'arête de sa paire à `s' = max(s(e), ŝ)`. Pour un changement d'arête unique, la nouvelle meilleure chaîne entre deux langues quelconques ignore soit la nouvelle arête, soit l'utilise exactement une fois, de sorte que la matrice mise à niveau — et donc ΔΦ — a une forme exacte d'une ligne (pas de ré-résolution du graphe entier) :

```
Q'(u,v) = max( Q(u,v),  E(u,a)·s'·E(b,v),  E(u,b)·s'·E(a,v) )

E(x,y) = λ·Q(x,y) for x ≠ y;  E(x,x) = 1        (edge e = {a, b})

ΔΦ = mean over ordered pairs of (Q'(u,v) − Q(u,v))
```

E est « la meilleure chaîne vers le point d'extrémité de la nouvelle arête, en payant la jonction pour l'épissurer » ; les deux termes sont les deux directions de traversée de l'arête. Ceci est testé dans la suite du harnais contre le recalcul par force brute de Φ.

Une prédiction qui ne peut pas battre la force d'arête actuelle donne ΔΦ = 0 : la formule dépense l'argent des donateurs en confirmant l'inconnu, pas en re-mesurant le démontré. (Le bonus d'exploration empêche les cellules faibles ou sous-échantillonnées d'être affamées à jamais.)

### 3.3 Ce qui compte comme preuve par rapport à ce qui peut être mis en file d'attente

Deux portes différentes, délibérément asymétriques :

- La **preuve** provient de *chaque* exécution publiée et non disqualifiée — y compris les exécutions sur des corpus qui ne peuvent pas être publiquement mis en file d'attente (par exemple, des ensembles sous licence non commerciale). Une mesure publiée d'une paire est une connaissance indépendamment du fait que vous pourriez la ré-exécuter.
- Les **actions** (éléments de file d'attente) proviennent uniquement de corpus ouvertement exécutables : division de développement, licence CC-BY-family, récupérable par n'importe qui.

Les langues accessibles uniquement par des corpus non-queueables restent dans le graphe : améliorer les arêtes *autour* d'elles change leurs valeurs de chaîne, et la formule en tient compte.

## 4. Paramètres

| Paramètre | Défaut | Signification et justification |
|---|---|---|
| `λ` (`lambda_junction_discount`) | **0,9** | Rétention de fidélité par jonction d'une chaîne *estimée*. Encode « la mesure directe surpasse le chaînage égal en produit » (Utiyama & Isahara 2007 ; Wu & Wang 2007 ; Fan et al. 2021). La réduction d'environ 10% est un choix de calibrage, revisité à mesure que les triangles de chaîne mesurés s'accumulent (§6). |
| `κ` (`kappa_exploration_scale`) | **0,05** | Échelle de bonus d'exploration, en unités de force. 0,05 ≡ 5 points chrF++ — le plancher de bruit en dessous duquel les différences de score sont indistinguibles sur les corpus sub-100-entry ([Corpus Design §6.3](/docs/network/specifications/corpus-design)). L'optimisme est plafonné à la résolution de l'instrument. |
| `S_CAP` | **0,95** | Plafond de prédiction — aucune arête estimée ne peut prétendre à une fidélité quasi-parfaite qu'elle n'a pas démontrée. |
| `S0_FALLBACK` | **0,5** | Prior de paire en dernier recours, utilisé uniquement quand il n'y a aucun résultat publié du tout (la moyenne globale observée — ≈ 0,54 sur les 429 premières exécutions — est préférée chaque fois qu'un résultat existe). |
| `COST_FLOOR` | **0,01 $** | Plancher pour le dénominateur ECV, de sorte que les exécutions quasi-gratuites ne peuvent pas prétendre à une valeur illimitée par dollar. |
| `N_FULL` | **100** | Entrées évaluées pour crédit de taille complet (§1.5). |
| `L_HEALTHY` | **5,0** | Mots effectifs pour crédit de richesse complet (§1.5). |
| `H_NOISE` | **±5 chrF** | Demi-largeur IC pour crédit de confiance complet ; les IC manquants proxy comme 50/√n (ancrés à ±5 à n=100). |
| `RUNS_FULL` | **2** | Exécutions publiées pour crédit de réplication complet. |

**Versioning.** Les changements de paramètre ou de formule augmentent `formula_version` (métadonnées) et la ligne de version de cette page. La file d'attente reprend toujours les valeurs exactes utilisées sous `metadata.priority_parameters`, y compris le Φ actuel, de sorte que les files d'attente historiques restent interprétables. Les exécutions de sensibilité sont à un drapeau de distance : `generate_sweep_queue.py --lam 0.8 --kappa 0.1`.

## 5. Exemple travaillé (valeurs en direct, 2026-06-12)

Génération contre 424 exécutions notées, 59 arêtes mesurées, 60 langues ; **Φ = 0,272**. L'élément supérieur :

```
eng>fao · claude-haiku-4.5 · naive
  edge_strength        0.0      (no published eng→fao runs)
  pair_prior           0.613    basis: target-language (Faroese runs exist via dan→fao)
  model_offset        −0.114    (haiku trails other models on shared pairs)
  condition_offset     0.0      (no coaching evidence for fao)
  exploration_bonus   +0.174    (never-run cell: κ·√(2·ln 425 / 1))
  predicted_strength   0.673
  expected_mesh_gain   0.0181   (eng→fao is a near-component join)
  est_cost_usd         0.0101
  ecv_per_usd          1.79     ← rank #1
```

Relisez-le : le féroïen n'est connecté au maillage que par le danois, donc une arête eng→fao mesurée raccourcit une énorme famille de chaînes (le grand ΔΦ) ; le modèle est prédit mid-pack sur une paire comme celle-ci (prior + offset), personne n'a jamais essayé cette cellule (grand bonus), et l'exécution coûte un centime. Rien d'autre dans la file d'attente n'achète plus de maillage par dollar. L'arithmétique identique, avec chaque entrée publiée, produit chaque autre classement.

## 6. Limitations connues (et ce qui les corrigerait)

1. **chrF++ n'est pas comparable entre les langues.** La morphologie déplace l'échelle ; une arête 0,5 vers le basque n'est pas le même accomplissement que vers le néerlandais. Atténuation : les priorités sont dominées par la *structure* (transitions s = 0 → s > 0) où les effets d'échelle sont du second ordre. Correction : normalisation de score par langue, ou métriques avec meilleure calibration cross-linguale à mesure qu'elles deviennent disponibles pour ces langues.
2. **Le modèle de chaîne produit-λ est un prior, pas une mesure.** Il est directionnellement soutenu par la littérature de pivot mais non calibré pour la traduction LLM. Correction (prévue) : le maillage contient maintenant des triangles mesurés (par exemple deu→fra direct aux côtés de deu→eng→fra), de sorte que la sortie chaînée peut être notée directement et λ ajusté aux données au lieu d'être choisi.
3. **Contamination et statut d'ensemble de développement.** Les forces d'arête héritent de chaque mise en garde des ensembles de développement publics — traitez Φ comme un signal de planification de limite supérieure, jamais une affirmation de capacité ([Corpus Design](/docs/network/specifications/corpus-design)).
4. **Cécité de domaine.** Une arête mesurée sur du texte conversationnel est traitée comme un nombre ; les chaînes traversant les domaines se dégraderont plus que λ ne le prédit.
5. **Directionnalité.** Les arêtes sont actuellement non dirigées (la preuve X→Y éclaire X↔Y). Quand la composition de chaîne devient sensible à la direction en pratique, les forces se divisent par direction — la formule est inchangée, le graphe double simplement.

## 7. Références

- Latora, V. & Marchiori, M. (2001). *Efficient Behavior of Small-World Networks.* Physical Review Letters 87, 198701. [arXiv:cond-mat/0101396](https://arxiv.org/abs/cond-mat/0101396)
- Auer, P., Cesa-Bianchi, N. & Fischer, P. (2002). *Finite-time Analysis of the Multiarmed Bandit Problem.* Machine Learning 47, 235–256. [doi:10.1023/A:1013689704352](https://link.springer.com/article/10.1023/A:1013689704352)
- Nemhauser, G., Wolsey, L. & Fisher, M. (1978). *An Analysis of Approximations for Maximizing Submodular Set Functions—I.* Mathematical Programming 14, 265–294. [doi:10.1007/BF01588971](https://link.springer.com/article/10.1007/BF01588971)
- Khuller, S., Moss, A. & Naor, J. (1999). *The Budgeted Maximum Coverage Problem.* Information Processing Letters 70(1), 39–45. [doi:10.1016/S0020-0190(99)00031-9](https://dl.acm.org/doi/10.1016/S0020-0190(99)00031-9)
- Utiyama, M. & Isahara, H. (2007). *A Comparison of Pivot Methods for Phrase-Based Statistical Machine Translation.* HLT-NAACL 2007, 484–491. [ACL Anthology N07-1061](https://aclanthology.org/N07-1061/)
- Wu, H. & Wang, H. (2007). *Pivot Language Approach for Phrase-Based Statistical Machine Translation.* ACL 2007 ; version journal Machine Translation 21(3), 165–181. [doi:10.1007/s10590-008-9041-6](https://link.springer.com/article/10.1007/s10590-008-9041-6)
- Paul, M., Yamamoto, H., Sumita, E. & Nakamura, S. (2009). *On the Importance of Pivot Language Selection for Statistical Machine Translation.* NAACL-HLT 2009 Short Papers, 221–224. [ACL Anthology N09-2056](https://aclanthology.org/N09-2056/)
- Haffari, G., Roy, M. & Sarkar, A. (2009). *Active Learning for Statistical Phrase-Based Machine Translation.* NAACL-HLT 2009, 415–423. [ACL Anthology N09-1047](https://aclanthology.org/N09-1047/)
- Fan, A. et al. (2021). *Beyond English-Centric Multilingual Machine Translation.* Journal of Machine Learning Research 22(107), 1–48. [arXiv:2010.11125](https://arxiv.org/abs/2010.11125)
