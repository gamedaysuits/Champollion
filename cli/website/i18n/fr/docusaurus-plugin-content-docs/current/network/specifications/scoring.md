---
sidebar_position: 5
title: "Spécification de notation"
slug: '/network/specifications/scoring'
related:
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
    note: "The tool that computes these metrics"
  - label: "MT Evaluation Rules"
    to: /docs/network/leaderboard/rules
    kind: doc
  - label: "Live Leaderboard"
    to: https://champollion.dev/leaderboard
    kind: leaderboard
    note: "These scores, live"
---

# Spécification de notation

> **Résumé opérationnel.** Ce document constitue la source unique de vérité quant à la manière dont les exécutions sont évaluées dans l'écosystème d'évaluation de TA de Champollion : la métrique principale unique, les autres métriques standards rapportées à ses côtés, les diagnostics présentés séparément, ainsi que le coût et la rapidité. Les exécutions sont évaluées selon les pratiques du domaine : **chrF++ au niveau du corpus avec sa signature sacreBLEU et un intervalle de confiance bootstrap à 95 %**, BLEU, spBLEU, TER et COMET à ses côtés, ainsi que des tests de significativité appariés pour déterminer si un système est supérieur à un autre. Les diagnostics spécifiques à une langue (validité morphologique FST, classes d'équivalence de linter, validation sémantique déterministe) sont collectivement désignés sous le nom de **LYSS** (*Linguistically-informed Yield & Structural Scoring*). Le score composite pondéré et les labels de niveaux de qualité utilisés auparavant sont **retirés** (§4, §5) ; leurs tableaux ne figurent ici que pour permettre la vérification des anciennes fiches. Le code, la documentation et les schémas de base de données découlent de ce document. En cas de divergence, ce document fait autorité.
>
> **Périmètre.** Ce document définit *ce que* nous mesurons et *comment nous l'évaluons*. Il ne définit pas le schéma des fiches d'exécution (voir BENCHMARK_SPEC §3), le protocole de benchmark (BENCHMARK_SPEC §6) ni les règles du tableau de classement (voir la documentation de l'arène). Ces documents se réfèrent au présent document pour les définitions des métriques et la logique de notation.


---

## Comment les exécutions sont évaluées {#how-runs-are-scored}

Chaque nouvelle exécution est évaluée selon la **norme d'évaluation `standard/1`**. La fiche d'exécution l'indique explicitement : `scores.scoring_standard` vaut `"standard/1"` et `scores.primary_metric` vaut `"chrf_plus_plus"`.

| Rôle | Quoi | Emplacement d'affichage |
|------|------|-------------------------|
| **Métrique principale et de classement** | **chrF++** au niveau du corpus (chrF sacreBLEU avec `word_order=2`), 0–100, avec son intervalle de confiance bootstrap à 95 % et sa signature sacreBLEU | Noté sous la forme `chrF++ 47.5 [45.9, 49.0]`, suivi de la signature. Fiche d'exécution : `scores.chrf_plus_plus`, l'IC dans `scores.confidence_intervals.corpus_chrf`, la signature dans `scores.sacrebleu_signatures.chrf`. Base de données : `chrf_plus_plus`, `chrf_ci_lower`, `chrf_ci_upper`. |
| **Autres métriques standards** | BLEU, spBLEU (FLORES-200 SentencePiece), TER et COMET lorsqu'il a été calculé | Affichées aux côtés de chrF++, chacune avec sa signature ou l'identifiant du modèle COMET. Jamais combinées avec chrF++ ni entre elles. |
| **Diagnostics** | Correspondance exacte, acceptation FST, précision morphologique, alternance codique, hallucination, respect de la terminologie, style d'écriture et chaque avertissement de score (§2.8) | Rapportés séparément et étiquetés comme diagnostics. Ils ne figurent jamais dans un chiffre principal et ne classent jamais une exécution. Les avertissements restent bien visibles aux côtés du chiffre principal. |
| **Coût et rapidité** | Tokens, dollars, latence (§6, §7) | Rapportés aux côtés du score, jamais combinés avec lui. |

**Déterminer la « supériorité ».** Deux exécutions sur le même ensemble d'évaluation sont comparées au moyen d'un test de significativité apparié sur chrF++ (randomisation approchée par défaut, rééchantillonnage bootstrap apparié en option ; §8.2). Les autres métriques standards sont également testées et présentées. Une différence non significative est signalée comme telle, quelles que soient les deux valeurs numériques.

**Aucun label de qualité.** Un score automatique n'est pas un verdict sur la qualité. Les nouvelles fiches ne comportent aucun niveau ni aucun label tel que « fonctionnel » ou « déployable » ; seule une évaluation humaine par des locuteurs certifie la qualité ([BENCHMARK_SPEC §7](/docs/network/specifications/benchmark#7-human-validation)).

**Ce qui est retiré.** Les nouvelles fiches publient `composite: null`, `quality_tier: null` et `cost_adjusted: null` (le score ajusté au coût correspondait au composite divisé par un facteur de coût ; le coût lui-même reste rapporté). Aucune nouvelle sortie n'affiche de score composite ni de niveau. Les fiches publiées avant la norme conservent leur composite stocké et restent vérifiables : le vérificateur recalcule une fiche dépourvue de `scoring_standard` en utilisant le calcul hérité (§4), et une fiche `standard/1` en recalculant chrF++. Partout où le composite d'une ancienne fiche est encore affiché, il est étiqueté **composite hérité (retiré)**.

**Pourquoi il s'agit de la norme.** C'est ainsi que le domaine rapporte l'évaluation de la TA :

- **WMT** classe les systèmes de ses tâches partagées par évaluation humaine et rapporte des métriques automatiques à ses côtés avec les signatures sacreBLEU afin que les chiffres puissent être reproduits (Post 2018 ; Kocmi et al. 2024).
- **FLORES-200** (NLLB Team 2022) rapporte chrF++ et spBLEU pour 200 langues, la plupart à faibles ressources.
- Les tâches partagées d'**AmericasNLP** sur la traduction vers les langues autochtones des Amériques classent les systèmes par chrF (Mager et al. 2021 ; Ebrahimi et al. 2023), car les n-grammes de caractères gèrent mieux la morphologie riche que le BLEU au niveau du mot (Popović 2015, 2017).
- Kocmi et al. (2021), en comparant les métriques automatiques à des milliers de jugements humains, ont constaté que l'ampleur d'une différence de métrique et sa significativité statistique sont ce qui prédit la préférence humaine, raison pour laquelle les comparaisons se font ici par tests de significativité appariés (Koehn 2004 ; Riezler & Maxwell 2005), et non par deux chiffres côte à côte.

**Concours.** Le critère de qualification d'un concours repose uniquement sur chrF++, sur une échelle de 0 à 100, et le paramètre `primary_metric` d'un concours prend la valeur par défaut `chrf_plus_plus`. Un nouveau concours exigeant `composite` comme métrique est refusé avec motif ; les concours créés avant la norme continuent de fonctionner. Un organisateur peut toujours définir des critères d'admissibilité diagnostiques dans les modalités du prix (par exemple une acceptation FST minimale), comme des filtres qu'une soumission doit franchir, mais jamais comme le score lui-même ([Spécification des prix](/docs/network/specifications/prizes)).

**Modifier la norme.** La métrique principale ne change qu'avec une nouvelle version de la norme (`standard/2`). Chaque fiche mentionne la norme selon laquelle elle a été évaluée et fait l'objet d'une vérification sous cette norme.

---

## 1. Philosophie de notation

### 1.1 Philosophie de la microévaluation

> *« Si nous nous concentrons uniquement sur ce qui se généralise, nous oublierons inévitablement où cela ne fonctionne pas — et nous perdrons ces langues et toute leur connaissance et sagesse. »*

Ce projet pratique le **développement de microévaluation** : construire des métriques d'évaluation adaptées à des langues spécifiques en utilisant les meilleurs outils linguistiques disponibles — transducteurs à états finis, dictionnaires bilingues, analyseurs morphologiques, règles d'équivalence curées par des linguistes. C'est l'opposé du paradigme dominant en évaluation TA, qui cherche des métriques universelles fonctionnant pour toutes les langues. Les métriques universelles sont précieuses, mais elles sont les plus faibles précisément là où elles sont les plus nécessaires : pour les langues à morphologie complexe, données d'entraînement limitées et sans représentation dans les ensembles d'entraînement des métriques neurales.

Nous ne faisons pas de progrès en traduction automatique pour de nombreuses langues du monde non seulement parce que nous manquons de corpus, mais parce que **nous ne savons même pas à quoi ressemble le progrès** — nous manquons des outils d'évaluation automatisés pour mesurer si un système de traduction s'améliore. LYSS est notre tentative de construire ces outils, langue par langue, en utilisant les ressources linguistiques disponibles.

### 1.2 Les métriques automatisées sont des approximations

Toutes les métriques définies ici sont calculées par machine. Elles sont utiles pour l'itération rapide, la comparaison systématique et la détection des régressions. Elles ne **remplacent pas le jugement humain**, raison pour laquelle aucun score automatique ne porte de label de qualité — seule une révision humaine peut confirmer l'utilisabilité réelle.

### 1.3 Une métrique principale, de multiples signaux

Aucune métrique isolée ne reflète la qualité d'une traduction. Une traduction peut présenter un chevauchement chrF++ élevé tout en échouant à la validation morphologique. Elle peut réussir les contrôles FST mais transmettre un contresens. Elle peut être sémantiquement exacte mais stylistiquement étrangère à la langue cible. C'est pourquoi chaque exécution rapporte de nombreux signaux — mais un seul d'entre eux, chrF++, constitue la métrique principale et de classement, les autres étant présentés à ses côtés sans jamais y être mélangés. Une combinaison de signaux aux significations divergentes selon les langues peut être détournée par un système performant sur les signaux faciles à satisfaire (§4 consigne la façon dont le composite retiré l'était), et le lecteur ne peut discerner, à partir d'un chiffre combiné, quel signal a évolué.

### 1.4 Extensibilité

Cet inventaire de métriques n'est pas figé. De nouvelles langues introduisent de nouvelles exigences : l'exactitude tonale pour les langues à tons, la précision des signes diacritiques pour les écritures sémitiques, la correction syllabique pour le cri. L'architecture (protocole MetricPlugin) permet d'ajouter des diagnostics sans modifier aucun score principal. Les métriques spécifiques à une langue (par ex. le linter et le validateur sémantique du CRK) sont déclarées sur les fiches de langue sous `evalMetrics` et chargées depuis `eval_standards/` — le banc d'essai n'intègre par défaut que des métriques comportementales génériques (alternance codique, hallucination, terminologie).

### 1.5 Trois dimensions d'évaluation

Chaque carte d'exécution mesure trois dimensions indépendantes :

```
Quality   — How close is the translation to the reference?   (chrF++ headline + standard metrics + diagnostics)
Cost      — How much does it cost?                           (cost metrics, §6)
Speed     — How fast does it run?                            (speed metrics, §7)
```

Il s'agit d'axes indépendants. Une méthode peut obtenir un bon score tout en étant coûteuse, être rapide mais imprécise, ou toute autre combinaison. Le tableau de classement permet le tri selon n'importe quelle dimension. Aucun chiffre publié ne les combine (le score ajusté au coût qui le faisait, §6.3, est retiré).

### 1.6 Statut de validation

Chaque métrique de cette spécification a un **statut de validation** distinct de son statut d'implémentation (§3). Le statut d'implémentation suit si le code existe. Le statut de validation suit si la métrique a été montrée comme corrélée aux jugements de qualité humains.

| Niveau de validation | Signification | Métriques actuelles |
|------------------|---------|----------------|
| **✅ Validée en externe** | Des études de corrélation humaine publiées existent (WMT, articles académiques) | `chrf_plus_plus`, `bleu`, `comet_score` *(paires à ressources élevées uniquement)* |
| **⚡ Validée par proxy** | Validée pour les langues à ressources élevées ; non validée pour nos LRL cibles | `comet_score` *(pour les LRL : validée sur les paires à ressources élevées/UE, extrapolée à par exemple CRK — directionnellement utile mais non calibrée)* |

| **🔶 Heuristique d'ingénierie** | Conçue à partir de principes linguistiques ou de modes de défaillance observés ; aucune donnée de corrélation humaine | `fst_acceptance_rate`, `morphological_accuracy` (dérivée de FST, appariée par lemme, recalculée par le vérificateur), `equivalent_match_rate`, `semantic_score`, `code_switching_rate`, `hallucination_rate`, `terminology_adherence` |
| **🔲 Non validée** | Pas encore testée sur des données réelles | `orthographic_accuracy`, `consistency_score` |

> **Pourquoi `comet_score` apparaît sur deux lignes.** Il s'agit d'une distinction par niveau de ressources, et non d'une contradiction. COMET est *validé de manière externe* lorsqu'il existe des études de corrélation humaine WMT — paires à fortes ressources, principalement européennes. Pour nos langues cibles à faibles ressources, il n'existe pas de telles études : la même métrique n'est donc que *validée par approximation* (le modèle extrapole à partir de langues dotées de systèmes morphologiques différents). Elle est affichée aux côtés de chrF++ avec son identifiant de modèle et un avertissement d'étalonnage, sans jamais être combinée.

> **Ce que cela implique en pratique.** La métrique principale (chrF++) est une métrique validée de manière externe, utilisée selon les standards du domaine. Chaque heuristique d'ingénierie ci-dessus constitue un **diagnostic** : elle peut expliquer *pourquoi* une exécution a obtenu tel résultat (les mots ne sont pas des formes valides, la sortie a basculé vers l'anglais), mais elle ne constitue jamais un score et ne classe jamais une exécution. Le score composite retiré (§4) intégrait des heuristiques de tous niveaux de validation dans la métrique principale, et un système pouvait en obtenir l'essentiel sans traduire (§4).
>
> **Expériences de validation requises** (voir `mt-evaluation-landscape.md` §6 et `speaker-validation.md`) :
> 1. Étude de corrélation avec des jugements humains : 200+ paires de phrases évaluées par au moins 3 locuteurs bilingues
> 2. Mesure du taux de faux rejets du FST sur un corpus représentatif
> 3. Portage vers une seconde langue (same du Nord) pour vérifier la généralisation
> 4. Comparaison directe avec COMET sur les mêmes données


---

## 2. Inventaire des métriques {#2-metric-inventory}

Les métriques sont réparties en six catégories (de surface, structurelles, sémantiques, comportementales, de conformité et comparateurs rapportés). Chaque métrique dispose d'un statut d'implémentation, d'une échelle et d'un niveau (par entrée, au niveau du corpus, ou les deux), ainsi que de l'un des trois rôles prévus par la norme : **principale** (chrF++ uniquement), **standard** (BLEU, spBLEU, TER, COMET — affichées aux côtés de la métrique principale) ou **diagnostic** (tout le reste — rapporté séparément).

### 2.1 Métriques de surface

Les métriques de surface comparent la traduction prédite à la traduction de référence au niveau de la chaîne. Elles ne nécessitent aucun outil linguistique — juste une comparaison de chaînes.

| ID | Métrique | Statut | Échelle | Niveau | Implémentation |
|----|----------|--------|---------|--------|----------------|
| `exact_match_rate` | Correspondance exacte | ✅ Implémentée | 0.0–1.0 | Les deux | **Diagnostic.** Binaire : la prédiction == la référence ? Taux sur le corpus = correspondances / total. |
| `equivalent_match_rate` | Correspondance équivalente | ⚡ Partielle | 0.0–1.0 | Les deux | **Diagnostic.** La sortie prédite correspond-elle à une variante acceptée ? Pour CRK : implémentée via `CrkLinterMetric` de la norme d'évaluation CRK (dans `eval_standards/crk/`) à l'aide de règles déterministes de classes de variantes (ordre des mots, orthographe, particule optionnelle, synonyme de lemme, ambiguïté progressive). Chargée automatiquement via la déclaration `evalMetrics` de la fiche de langue CRK. L'implémentation interlangue générique nécessite `variants[]` par entrée dans le corpus. |
| `chrf_plus_plus` | chrF++ | ✅ Implémentée | 0–100 | Les deux | **Métrique principale et de classement.** F-score de n-grammes de caractères avec unigrammes et bigrammes de mots (sacreBLEU chrF, `word_order=2` ; Popović 2017). Robuste aux variations morphologiques. La valeur publiée est au niveau du corpus (`corpus_chrf`), avec un IC bootstrap à 95 % et sa signature sacreBLEU ; les valeurs par entrée (`sentence_chrf`) alimentent les tests de significativité. |
| `bleu` | BLEU | ✅ Implémentée | 0–100 | Corpus | **Métrique standard, affichée aux côtés de chrF++** (fiche d'exécution et base de données `corpus_bleu`, avec sa signature sacreBLEU). Précision de n-grammes au niveau du mot (Papineni et al. 2002). Non retenue comme métrique principale car la correspondance mot à mot traite un mot correct doté d'un suffixe différent comme un échec total, ce qui pénalise les langues à morphologie riche. |
| `ter` | Taux d'édition de traduction (TER) | ✅ Implémentée | 0–∞ (plus bas = meilleur) | Les deux | **Métrique standard, affichée aux côtés de chrF++** (`scores.ter`, avec sa signature sacreBLEU). Distance d'édition minimale entre prédiction et référence, normalisée par la longueur de la référence (sacreBLEU `corpus_ter` ; Snover et al. 2006). |
| `length_ratio` | Ratio de longueur | ✅ Implémentée | 0–∞ (1.0 est idéal) | Les deux | **Diagnostic.** `len(predicted) / len(reference)` en caractères. Détecte la troncature (<0.5) et l'inflation/hallucination (>2.0). Moyenne calculée sur l'ensemble des entrées au niveau du corpus. |

### 2.2 Métriques structurelles

Les métriques structurelles valident la bonne formation linguistique de la traduction. Elles nécessitent des outils spécifiques à la langue (analyseurs FST, analyseurs morphologiques) et sont les signaux les plus forts pour les langues morphologiquement riches.

| ID | Métrique | Statut | Échelle | Niveau | Implémentation |
|----|----------|--------|---------|--------|----------------|
| `fst_acceptance_rate` | Acceptation FST | ✅ Implémentée | 0.0–1.0 | Les deux | **Diagnostic.** Acceptation des mots produits par un transducteur à états finis (GiellaLT). Un mot est « valide » si le FST renvoie au moins une analyse morphologique. **Agrégation :** la valeur publiée pour le corpus est la **moyenne des taux par entrée** — mots acceptés de chaque entrée ÷ son total de mots, moyennés sur les entrées analysées par le FST, une sortie vide comptant pour 0 (le paramètre `avg_fst_validity` du plugin). Le taux global de mots (total des mots acceptés ÷ total des mots, `corpus_validity_rate`) est rapporté à côté dans le rapport d'exécution et sur la fiche d'exécution mais n'est pas la valeur publiée ; les deux diffèrent lorsque les entrées ont des longueurs variables. Disponible pour toute langue disposant d'un analyseur GiellaLT `.hfstol`. **Casse :** un mot est recherché tel quel ; si le FST le rejette et qu'il commence par une majuscule, il est recherché à nouveau avec sa première lettre en minuscule (`Mun` → `mun`), et un mot EN MAJUSCULES sous forme Majuscule Initiale puis en minuscules (`OSLO` → `Oslo`, `GIITU` → `giitu`). Jamais dans le sens inverse : un nom propre écrit en minuscules (`oslo`) reste rejeté. Les accepteurs de correcteur orthographique de GiellaLT (same du Nord, amharique, basque) et l'analyseur strict de Plains Cree d'ALTLab ne répertorient la plupart des mots qu'en minuscules et laissent la gestion de la casse au programme englobant ; sans cela, une majuscule correcte en début de phrase comptait comme un mot invalide. Il s'agit de la version de calcul `case-fallback/1`, mentionnée dans le rapport (`fst_acceptance_method`, avec `total_case_folded_words` et le `fst_case_folded_words` de chaque entrée) et sur la fiche d'exécution (`fst_provenance.acceptance_method`). Un rapport sans cette mention a été évalué en tenant compte de la casse et affiche un résultat inférieur pour le texte avec majuscules ; `mt-eval compare` le signale lors de la comparaison des deux, et `mt-eval test <run log>` réévalue une ancienne exécution. Le vérificateur recalcule les scores dérivés de FST d'une fiche publiée avec la méthode indiquée sur celle-ci, et avec sensibilité à la casse pour une fiche n'en mentionnant aucune, afin que la fiche soit vérifiée selon le calcul avec lequel elle a été publiée. |
| `morphological_accuracy` | Précision morphologique | ✅ Implémentée (recalculée par le vérificateur) | 0.0–1.0 | Les deux | **Diagnostic.** Un mot peut être valide au sens du FST mais présenter une mauvaise flexion (bonne racine, mauvais suffixe). **Calculé** par `plugins/giellalt_fst.py` : pour chaque mot prédit analysable, trouver un mot de référence partageant son **lemme** (racine) et vérifier si la **flexion** prédite (étiquettes morphologiques FST) correspond. L'appariement par lemme — et non par position — évite l'alignement mot à mot : un choix lexical différent ou une paire mal alignée n'est simplement pas *couverte* (jamais pénalisée à tort). **Aucune annotation de référence requise** — l'analyse FST de la référence *constitue* la vérité terrain. Les mots que le FST ne peut analyser, ou dont la racine est absente de la référence, sont hors couverture ; `morph_coverage` (la fraction appariée par lemme) est divulgué, et en dessous de `MORPH_COVERAGE_FLOOR` (0.25), la valeur est signalée comme indicative. Le calcul est **tolérant en cas d'ambiguïté FST** (un mot prédit comportant plusieurs analyses est « correct » si *l'une quelconque* correspond → borne supérieure, mentionnée). Nécessite un **analyseur** : un FST qui n'est qu'un **accepteur** de vérification orthographique (les paquets Divvun speller installés pour le same du Nord, l'amharique et le basque) indique si un mot existe mais ne fournit ni lemme ni étiquette. Pour ceux-ci, `morphological_accuracy` et `morph_coverage` sont nuls et `metric_availability` en précise la raison ; l'acceptation FST reste rapportée. Le verrouillage FST le déclare (`kind: "acceptor"`), et la métrique détecte également un transducteur qui ne renvoie jamais d'étiquette. Elle est **recalculée par le vérificateur** par rapport au corpus canonique (`verifier.recompute_corpus_morph`, qui réexécute le FST fixé par la fiche — échec strict si le FST est absent, même contrat que COMET). Sous le score composite retiré, elle recevait un poids de 0.15 dans le profil fst-coverage (§4.3). |
| `orthographic_accuracy` | Précision orthographique | 🔲 Prévue | 0.0–1.0 | Les deux | **Diagnostic (prévu).** Valide l'exactitude propre à l'écriture : usage du macron/accent circonflexe SRO pour le cri, signes diacritiques pour l'inuktitut, marqueurs de longueur vocalique pour l'ojibwé. Jeux de règles par langue. |

> **Ce qu'apportent les métriques structurelles, et pourquoi elles sont des diagnostics.** L'OMT-1600 de Meta — le plus grand système de TA jamais publié (1 600 langues ; Meta AI, *Omnilingual MT*, arXiv:2603.16309, 2026) — évalue avec ChrF++, xCOMET, MetricX et BLASER 3. Aucun de ces outils ne valide la correction morphologique : chrF++ mesure le chevauchement de n-grammes de caractères et récompense les chaînes qui *ressemblent* à la référence, si bien qu'un mot morphologiquement invalide partageant de nombreux caractères avec la référence reçoit tout de même des points. L'acceptation FST répond à une question distincte : chaque mot est-il une forme valide dans la langue ? Cela en fait un diagnostic précieux pour les langues polysynthétiques. Il ne s'agit pas d'un score de traduction : il n'examine jamais la source ni la référence, si bien qu'un système générant une unique phrase valide pour chaque entrée la réussit parfaitement (§4 en détaille le cas mesuré). ChrF++ présente également un **plancher de hasard non nul** qui varie selon l'orthographe — un texte aléatoire dans la même écriture obtient un score mesurable supérieur à zéro, davantage dans certains systèmes d'écriture que d'autres —, de sorte que le chrF++ brut n'est pas comparable entre les langues ; il classe uniquement les systèmes sur le même ensemble d'évaluation. La carte du réseau ne classe donc **aucunement** la force relative entre les langues — un arc signifie que la paire a été mesurée, rien de plus. La correction du plancher de hasard que nous avons développée à cet effet (cchrF++) relève de la recherche publiée et n'est raccordée à aucune interface publique ; le document [Force de connexion](/docs/network/specifications/connection-strength) explicite ce qu'elle établit et ce qu'elle n'établit pas.

### 2.3 Métriques sémantiques

Les métriques sémantiques mesurent la préservation du sens en utilisant des plongements ou des modèles appris. Elles capturent les traductions qui sont superficiellement différentes mais sémantiquement équivalentes, et signalent les traductions qui sont superficiellement similaires mais sémantiquement erronées.

| ID | Métrique | Statut | Échelle | Niveau | Implémentation |
|----|----------|--------|---------|--------|----------------|
| `semantic_score` | Similarité sémantique | ⚡ Partielle | 0.0–1.0 | Les deux | **Diagnostic.** CRK : score pondéré par verdict issu de `CrkSemanticMetric` de la norme d'évaluation CRK (dans `eval_standards/crk/`, approximation). Universel : similarité cosinus des plongements de phrases (source + prédiction vs source + référence). Modèle à déterminer — doit prendre en charge les langues à faibles ressources, ce qui exclut la plupart des modèles de plongement centrés sur l'anglais. |
| `comet_score` | COMET | ✅ Implémentée | ~0.0–1.0 | Les deux | **Métrique standard lorsqu'elle est calculée, affichée aux côtés de chrF++ avec l'identifiant de son modèle** (`comet_model`). Métrique d'évaluation de TA apprise (Rei et al. 2020). Jamais combinée avec chrF++. Recalculée par le vérificateur, de sorte qu'une valeur rapportée doit être reproductible. Assortie d'un avertissement d'étalonnage pour les langues à faibles ressources comme le cri des Plaines. Calculée lorsque `unbabel-comet` est installé. Pour 35 langues africaines, le banc d'essai sélectionne automatiquement AfriCOMET (`masakhane/africomet-mtl`) via `resolve_comet_model()`, qui offre une meilleure corrélation avec les jugements humains pour ces langues. |

> **Pourquoi COMET se situe aux côtés de la métrique principale, et non en titre.** COMET est entraîné sur les données d'évaluation humaine de WMT, composées très majoritairement de paires européennes à fortes ressources. Pour les paires véritablement à fortes ressources (allemand, français, …), le modèle par défaut `Unbabel/wmt22-comet-da` est bien validé par WMT, et `resolve_comet_model()` le sélectionne. Appliqué au cri des Plaines ou à d'autres langues à faibles ressources, le modèle extrapole à partir de langues dotées de systèmes morphologiques différents — utile sur le plan directionnel mais non étalonné, ce que la fiche signale. Il nécessite également un modèle de 2,3 Go, et n'est donc pas calculé pour chaque exécution. chrF++ est reproductible à partir du seul corpus pour chaque langue, raison pour laquelle il constitue la métrique principale et COMET est rapporté à ses côtés dès lors qu'il a été calculé.

> **AfriCOMET pour les langues africaines.** Chaque carte de langue a un champ `metricModelSupport` (voir spécification de carte de langue §9) qui déclare quels modèles COMET spécialisés sont entraînés pour cette langue. Pour 35 langues africaines (yor, hau, ibo, amh, swa, etc.), la carte déclare AfriCOMET (`masakhane/africomet-mtl`) — un modèle COMET affiné sur les jugements TA de langues africaines par la communauté Masakhane. Le harnais sélectionne automatiquement le modèle recommandé via `resolve_comet_model()` lisant les cartes de langue, mais cela peut être remplacé avec `--comet-model`. L'ajout de nouveaux mappages langue→modèle se fait en enrichissant la carte de langue (pas en éditant le code Python).

### 2.4 Métriques comportementales

Les métriques comportementales détectent des modes de défaillance spécifiques dans la sortie de traduction. Elles ne mesurent pas directement la qualité — elles détectent des anomalies. Toutes constituent des **diagnostics**.

| ID | Métrique | Statut | Échelle | Niveau | Implémentation |
|----|----------|--------|---------|--------|----------------|
| `code_switching_rate` | Taux d'alternance codique | ✅ Implémentée | 0.0–1.0 (plus bas = meilleur) | Les deux | Proportion de mots produits appartenant à la langue source (généralement l'anglais). Détecté par analyse de l'écriture Unicode et/ou liste de mots de la langue source. Mode de défaillance très fréquent des LLM : le modèle insère des mots anglais lorsqu'il ignore l'équivalent dans la langue cible. |
| `hallucination_rate` | Taux d'hallucination | ✅ Implémentée | 0.0–1.0 (plus bas = meilleur) | Les deux | Proportion du contenu produit n'ayant aucun équivalent dans la source. Détecté par alignement de mots ou chevauchement de plongements translingues. Repère les cas où le modèle génère des traductions plausibles mais inventées de toutes pièces. |
| `terminology_adherence` | Respect de la terminologie | ✅ Implémentée | 0.0–1.0 | Les deux | Pour les méthodes guidées : proportion des termes prescrits apparaissant dans la sortie. Nécessite un glossaire (`{"source term": "translation"}`, ou une liste de traductions acceptées par terme). La source est `--glossary <file.json>`, une entrée d'évaluation qui n'est jamais transmise au modèle et qui est fournie à chaque exécution comparée. Sinon, il s'agit de l'objet `dictionary` d'un `--coaching-file` JSON : l'exécution est alors évaluée par rapport à ses propres consignes, ce que la sortie de l'exécution indique. Sans l'un ni l'autre, la métrique est inactive (nulle). Mesure si le modèle respecte le vocabulaire validé par des experts. |
| `consistency_score` | Cohérence inter-entrées | 🔲 Prévue | 0.0–1.0 | Corpus uniquement | Le modèle traduit-il le même terme source de la même manière sur l'ensemble des entrées ? Une faible cohérence suggère que le modèle procède par devinette plutôt qu'en appliquant des motifs appris. Nécessite des termes répétés à travers les entrées du corpus. |

### 2.5 Métriques de conformité

Les métriques de conformité vérifient que les traductions préservent l'intégrité structurelle — variables de substitution, mise en forme et conventions typographiques. Il s'agit de vérifications d'admissibilité (contrôles qualité), et non de scores de qualité ; elles constituent des diagnostics sous la norme.

| ID | Métrique | Statut | Échelle | Niveau | Implémentation |
|----|----------|--------|---------|--------|----------------|
| `compliance_index` | Conformité double passe | 🔲 Prévue | 0.0–1.0 | Les deux | Composite pondéré : 60 % intégrité des variables (les variables `{placeholder}` sont-elles préservées ?) + 20 % conformité des guillemets (caractères de guillemets de la langue cible) + 20 % conformité de la casse (aucune fuite de lettres latines pour les langues sans casse). Calculé à la fois sur la sortie brute et post-traitée. Une classe `DoublePassCompliancePlugin` existe, mais aucune exécution d'évaluation ne la charge, et aucune source référencée pour les conventions de guillemets et de casse par langue n'existe encore. Les fiches de langue ne les contiennent pas. Sans cette source, seul le terme d'intégrité des variables mesure quelque chose. |
| `repair_effectiveness` | Efficacité de réparation | 🔲 Prévue | 0.0–1.0 | Corpus | Proportion des violations de conformité ayant été automatiquement réparées par les crochets de post-traduction. Mesure à quel point le filtre de qualité a amélioré la sortie brute. Prévue pour la même raison que `compliance_index`. |

> **Pourquoi la conformité est un filtre et non un score.** Les métriques de conformité mesurent la préservation structurelle (variables, guillemets), et non la qualité linguistique de la traduction. Une traduction peut être parfaite sur le plan linguistique mais échouer à la conformité pour avoir omis une variable `{name}`. Elles sont conçues comme des filtres qualité destinés à bloquer la livraison d'une sortie défectueuse, et non pour classer la qualité de traduction.

### 2.6 Comparateurs rapportés

spBLEU fait partie des métriques standards présentées aux côtés de chrF++ ; chrF brut et le comparateur de style FUSE sont rapportés pour permettre la comparaison avec d'autres publications. Aucun d'entre eux n'est combiné avec d'autres métriques :

| ID | Métrique | Statut | Remarques |
|----|----------|--------|-----------|
| `spbleu` | spBLEU (tokeniseur FLORES-200) | ✅ Implémentée | **Métrique standard, affichée aux côtés de chrF++** (`scores.spbleu`, avec sa signature sacreBLEU). BLEU sur la tokenisation SentencePiece de FLORES-200 (Goyal et al. 2022) — comparable entre écritures et segmentations (la *lingua franca* NLLB/FLORES). Nécessite `sentencepiece` (dépendance principale). |
| `chrf_plain` | Plain chrF (`word_order=0`) | ✅ Implémentée | Le score chrF rapporté par AmericasNLP et de nombreux tableaux WMT, aux côtés de notre métrique principale chrF++ (`word_order=2`). Sa signature est `sacrebleu_signatures.chrf_plain`. |
| `fuse_score` | Comparateur de style FUSE | ⚡ Optionnel (`--fuse`) | Une **réimplémentation NON ENTRAÎNÉE** de l'approche FUSE d'AmericasNLP-2025 (Raja & Vats) : sémantique LaBSE + F1 lexical par token + Soundex phonétique + difflib flou, combinés sous forme de *moyenne non pondérée* (nous ne disposons d'aucune donnée d'entraînement issue de jugements humains pour ajuster le modèle Ridge/GBM d'origine, et nous l'indiquons clairement). LaBSE/Soundex constituent l'option facultative `fuse` ; sans LaBSE, `compute_fuse` renvoie `None` (signalé) plutôt que de simuler un score fictif. Chaque composant exécuté est listé dans `fuse_components` ; le résultat est marqué `fuse_untrained=true`. Comparateur diagnostique uniquement. |

### 2.7 Espaces de noms de métriques {#2-7-metric-namespaces}

Une seule métrique porte jusqu'à quatre noms coordonnés dans la pile : l'**id canonique** (la clé `scores` dans une carte d'exécution, par exemple `equivalent_match_rate`), le **nom du plugin** Python qui la calcule (par exemple `crk_linter`), la clé **`evalMetrics`** de la carte de langue qui la déclare (par exemple `lyss-eq`), et la colonne **`run_cards`** dénormalisée sur le classement (par exemple `equivalent_match_rate`). Ceux-ci sont délibérément distincts — le nom du plugin énonce l'*outil*, l'id de métrique énonce la *mesure* — mais ils doivent rester synchronisés.

La source unique de vérité pour cette correspondance est `shared/metric-registry.json`, chargé
par `mt_eval_harness.metric_manifest`. Chaque entrée consigne les quatre désignations ainsi que `scale`,
`direction` (plus élevé / plus faible / neutre), `level` (entrée / corpus / les deux), `in_composite`
(indiquant s'il figurait dans le composite retiré ; conservé pour vérifier les anciennes fiches) et
`verifier_reproducible`. Un test de parité échoue si les tables de `scoring.py` ou les clés
`scores` de la fiche d'exécution générées par `publish.py` divergent du registre, empêchant ainsi la livraison
d'une nouvelle métrique partiellement configurée.

Deux champs de carte d'exécution connexes rendent la provenance de métrique explicite :

- **`scores.metric_availability`** — un bloc `{metric: reason}` qui lève l'ambiguïté sur un score
  `null` : `not_applicable` (la langue/l'exécution ne l'utilise pas), `unavailable`
  (une dépendance optionnelle était manquante), `below_coverage_floor` (présente mais trop
  éparse pour dépasser le statut indicatif), `not_run` (optionnelle et non sollicitée) ou
  `not_implemented` (prévue). Une métrique absente de ce bloc a été calculée normalement.
- **`fst_version`** / **`fst_provenance`** — la version du transducteur GiellaLT installé
  et de `pyhfst` sous-tendant toute métrique dérivée de FST, capturées de la même manière
  que les signatures sacreBLEU afin qu'un score structurel puisse être rattaché à une version
  exacte de l'analyseur. `fst_provenance.acceptance_method` précise la façon dont l'acceptation a été
  calculée à partir des réponses du transducteur (`case-fallback/1`, §1) ; une fiche qui en est
  dépourvue a été évaluée avec sensibilité à la casse.
- **`scores.sacrebleu_signatures`** — la signature sacreBLEU de chaque
  métrique sacreBLEU calculée par l'exécution : `chrf` (la métrique principale chrF++,
  `word_order=2`), `chrf_plain`, `bleu`, `spbleu`, `ter`. Deux scores chrF++ ne sont
  comparables que si leurs signatures concordent (Post 2018).

### 2.8 Avertissements de score {#2-8-score-caveats}

Un score peut être calculé correctement tout en ne reflétant pas ce que son libellé indique. Le
banc d'essai examine chaque exécution pour détecter les mécanismes connus produisant ce phénomène et, lorsqu'un cas se déclenche,
l'affiche à côté de la métrique principale dans le résumé de test, `mt-eval compare`,
l'aperçu de publication et le tableau de bord, et la fiche publiée le consigne sous la clé
`score_caveats` pour que le tableau de classement l'affiche également. Un avertissement ne modifie jamais un score ;
il précise ce qui en limite la portée. Chacun constitue un diagnostic doté d'une `severity` (`major` ou
`minor`) et d'un message d'une seule phrase mentionnant des décomptes chiffrés, jamais les sorties
elles-mêmes.

| Avertissement | Se déclenche lorsque |
|---------------|----------------------|
| `source_copy` | Au moins la moitié des sorties évaluées sont identiques à leur source (casse, accents et ponctuation ignorés). Une entrée dont la référence est elle-même la source (un nom, un chiffre) est exclue du calcul. |
| `length_deflation` | Les sorties mesurent en moyenne moins de 0,5× la longueur de référence, ou au moins un quart d'entre elles présentent cette caractéristique — des mots ont été omis. L'acceptation FST et l'alternance codique n'évaluent que les mots présents : supprimer des mots a donc pour effet d'augmenter ces scores. |
| `length_inflation` | Les sorties dépassent en moyenne 2× la longueur de référence, ou au moins un quart d'entre elles présentent cette caractéristique (par exemple, des exemples few-shot se propageant dans chaque sortie). |
| `near_constant_output` | Une sortie identique est produite pour de nombreuses entrées distinctes : les répétitions couvrent au moins un quart des sources distinctes, et au moins 5 d'entre elles. Une sortie est considérée comme une répétition lorsque 3 sources l'ont obtenue (pour une sortie de trois mots ou plus) ou 5 sources (pour une sortie d'un ou deux mots, dans la mesure où des réponses courtes telles que « Oui. » peuvent légitimement réapparaître) ; une sortie identique à sa propre référence constitue une réponse correcte, non une répétition. Avant d'arrêter ces seuils, la règle a été éprouvée sur 2 161 sorties et références de systèmes réels issues des tâches de métriques WMT 2019–2025 ; les cinq cas signalés correspondaient tous à des sorties défaillantes. |
| `train_test_near_twin` | Rédigé par nmt-forge : chaque ligne de test (ou presque) possède un quasi-double dans les données d'entraînement, si bien que le score mesure la restitution de syntagmes mémorisés lors de l'entraînement, et non une aptitude à la traduction. |

---

## 3. Niveaux de statut de métrique

Chaque métrique du §2 tombe dans l'un des quatre niveaux d'implémentation :

| Niveau | Signification | Comportement de la carte d'exécution |
|------|---------|-------------------|
| **✅ Implémentée** | Le code existe, testé, produisant des valeurs dans les cartes d'exécution aujourd'hui | Valeur numérique dans la carte d'exécution |
| **⚡ Partielle** | Un proxy spécifique à la langue existe (par exemple, CRK) mais l'implémentation universelle est en attente | Valeur numérique quand le proxy s'applique, `null` sinon |
| **🔲 Planifiée** | Spécifiée mais pas encore implémentée | `null` dans la carte d'exécution (champ présent, valeur absente) |
| **💡 Proposée** | En discussion, pas encore spécifiée | Pas dans la carte d'exécution |

Une métrique passe de Planifiée → Partielle quand :
1. Une implémentation spécifique à la langue est fusionnée et testée
2. Elle produit des valeurs pour au moins une paire de langues
3. L'implémentation universelle reste en attente (documentée dans cette spécification)

Une métrique passe de Partielle → Implémentée quand :
1. Une implémentation indépendante de la langue est fusionnée et testée
2. Elle produit des valeurs pour n'importe quelle paire de langues sans plugins spécifiques à la langue
3. Ce document est mis à jour pour refléter le statut ✅

Une métrique passe de Planifiée → Implémentée quand :
1. L'implémentation est fusionnée et testée
2. Elle a été validée sur au moins une exécution d'évaluation réelle
3. Ce document est mis à jour avec ses détails d'implémentation

Une métrique passe de Proposée → Planifiée quand :
1. Sa définition, son échelle et sa méthode de calcul sont convenus
2. Elle est ajoutée à ce document avec un statut `🔲 Planned`
3. Un espace réservé nul est ajouté au schéma de la carte d'exécution

---

## 4. Retiré : le composite (hérité) {#4-composite-score}

> [!CAUTION]
> **Aucune nouvelle exécution n'est évaluée avec le composite.** Il a été retiré par la norme d'évaluation `standard/1` ([Comment les exécutions sont évaluées](#how-runs-are-scored)). Les nouvelles fiches publient `composite: null`. Cette section n'est conservée **que** pour permettre la lecture et la vérification des fiches publiées avant l'entrée en vigueur de la norme : le vérificateur recalcule le composite stocké de toute fiche dépourvue de `scores.scoring_standard`, en appliquant rigoureusement la formule et les tableaux ci-dessous. Partout où le composite d'une ancienne fiche est encore affiché, il est étiqueté **composite hérité (retiré)**, et n'est jamais comparé à chrF++ ni à une nouvelle fiche.

### Pourquoi il a été retiré {#why-the-composite-was-retired}

Le composite était une moyenne pondérée de chrF++/100, de la correspondance exacte, de l'acceptation FST (poids de 0,25), de la précision morphologique, du score sémantique, de l'alternance codique, de l'hallucination et de la terminologie, avec des poids fixés par jugement d'ingénierie sans jamais avoir été ajustés sur des jugements humains. Étant donné que plusieurs de ses composantes ne comparent jamais la sortie à la source ni à la référence, un système pouvait en obtenir l'essentiel sans traduire :

- **Une seule phrase pour chaque entrée.** Un modèle non entraîné anglais→same du Nord répétant une unique phrase valide en same du Nord pour chaque entrée obtenait un composite de **0,6244** — qualifié de « fonctionnel » — avec un **chrF++ de 5,5**. Les mots répétés étant du same valide, l'acceptation FST atteignait 100 %, et pour une langue dont le FST est un accepteur orthographique, l'acceptation FST représentait environ 45 % du composite une fois les métriques absentes redistribuées.
- **Omettre ce qu'il ne sait pas traduire.** Un glossaire rudimentaire omettant chaque mot inconnu obtenait **0,6612**, car l'acceptation FST et l'alternance codique n'évaluent que les mots contenus dans une sortie.
- **Copier la source.** L'anglais recopié tel quel en guise de sortie en « same du Nord » accumulait tout de même des points FST, dans la mesure où un correcteur accepte les mots avec majuscule initiale et certains mots anglais.

Aucune évaluation standard ne classerait ces systèmes devant une traduction réelle, et chrF++ ne s'y trompe pas : il compare chaque sortie à sa référence. Les avertissements du banc d'essai (§2.8) interceptent également ces comportements, et restent bien en évidence à côté du score principal chrF++.

### 4.1 Formule (héritée)

Le score composite était une moyenne pondérée de toutes les métriques *disponibles*, renormalisée de manière à ce que la somme des poids des métriques disponibles soit égale à 1,0 :

```
composite = Σ (weight_i × value_i)    for all available metrics
             ─────────────────────
             Σ weight_i               (re-normalization denominator)
```

Une métrique est dite « disponible » si sa valeur sur la fiche d'exécution est un nombre (et non `null`). Lorsqu'une métrique n'était pas disponible — parce que la langue ne dispose d'aucun FST, ou parce qu'une métrique n'est pas encore implémentée —, son poids était redistribué proportionnellement sur les métriques restantes. Les scores composites calculés à partir d'ensembles de métriques différents n'étaient jamais comparables ; chaque ancienne fiche consigne son `scores.scoring_profile` et son `scores.metric_availability` (§2.7), afin que le vérificateur sache quel ensemble appliquer.

### 4.2 Normalisation des entrées (héritée)

Avant d'entrer dans la formule composite, chaque métrique était ramenée sur une **échelle de 0,0 à 1,0** où 1,0 = parfait :

| Métrique | Échelle native | Normalisation |
|--------|-------------|---------------|
| `exact_match_rate` | 0.0–1.0 | Aucune (déjà normalisée) |
| `equivalent_match_rate` | 0.0–1.0 | Aucune |
| `fst_acceptance_rate` | 0.0–1.0 | Aucune |
| `morphological_accuracy` | 0.0–1.0 | Aucune |
| `chrf_plus_plus` | 0–100 | **Diviser par 100** |
| `semantic_score` | 0.0–1.0 | Aucune |
| `code_switching_rate` | 0.0–1.0 (inférieur = mieux) | **`1.0 - value`** (inverser : 0% changement de code = 1.0) |
| `hallucination_rate` | 0.0–1.0 (inférieur = mieux) | **`1.0 - value`** (inverser) |
| `terminology_adherence` | 0.0–1.0 | Aucune |

### 4.3 Tableaux de pondération (hérités) {#43-weight-tables}

Chaque langue renvoyait à un **profil nommé** via `language_cards.resolve_scoring_profile()` (`fst-coverage` lorsqu'un FST évaluait l'exécution, sinon `surface-only`, sauf si la fiche de langue déclarait `scoringProfile.basis`) ; le profil est répercuté dans `PROFILE_REGISTRY` de `scoring.py` et consigné sur chaque ancienne fiche sous la clé `scores.scoring_profile`. `orthographic_accuracy` est répertorié dans `scoring.INACTIVE_METRICS` et n'a jamais été calculé, de sorte que son poids a toujours été redistribué. `morphological_accuracy` n'intervenait que lorsque `morph_coverage ≥ 0.25`. Les métriques neuronales (`comet_score`, `qe_score` ; `scoring.NEURAL_METRICS`) n'ont jamais figuré dans aucun composite.

#### `fst-coverage` (Profil A) : Langues AVEC couverture FST

| Métrique | Poids cible | Justification |
|--------|--------------|-----------|
| `fst_acceptance_rate` | **0.25** | Poids le plus élevé. Si le FST rejette un mot, ce n'est pas une forme valide dans la langue — indépendamment de ce que disent les autres métriques. Binaire, structurellement fondée. |
| `morphological_accuracy` | **0.15** | Un mot peut être valide FST mais morphologiquement faux (bonne racine, mauvaise inflexion). Ensemble avec FST, les métriques structurelles portent 40%. |
| `chrf_plus_plus` | **0.15** | Chevauchement de n-grammes de caractères : le meilleur proxy de surface pour les langues polysynthétiques. Gère mieux la morphologie agglutinative que les métriques au niveau des mots. |
| `semantic_score` | **0.15** | Préservation du sens quand la forme de surface diverge. Capture les traductions sémantiquement erronées qui passent les vérifications structurelles. |
| `equivalent_match_rate` | **0.10** | Récompense les variantes acceptables, pas seulement la traduction de référence unique. Important pour les langues avec ordre des mots flexible. |
| `code_switching_rate` | **0.05** | Pénalise la fuite de la langue source. Inversée : 0% changement de code = 1.0. |
| `terminology_adherence` | **0.05** | Récompense les méthodes coachées qui respectent le vocabulaire prescrit. Actif uniquement quand les données de coaching sont présentes. |
| `hallucination_rate` | **0.05** | Pénalise le contenu fabriqué. Inversée : 0% hallucination = 1.0. |
| `exact_match_rate` | **0.05** | Poids le plus bas. Trop strict pour les langues polysynthétiques — plusieurs traductions correctes existent. Gardé comme vérification de plafond. |

> **Total : 1,00.** En l'absence de `morphological_accuracy` (aucun analyseur FST, FST de type accepteur seul, ou couverture inférieure à 0,25), les 8 métriques restantes (total 0,85) étaient chacune multipliées par 1/0,85 ≈ 1,176. Pour une langue dotée d'un FST accepteur seul (same du Nord, amharique, basque) sans norme d'évaluation ni glossaire, seules subsistaient l'acceptation FST (0,25), chrF++ (0,15), l'alternance codique, l'hallucination et la correspondance exacte (0,05 chacune) — total 0,55 —, de sorte que l'acceptation FST représentait **0,25/0,55 ≈ 45 %** du composite. C'est précisément cette pondération que les exemples ci-dessus ont exploitée.

#### `surface-only` (Profil B) : Langues SANS couverture FST

| Métrique | Poids cible | Justification |
|--------|--------------|-----------|
| `semantic_score` | **0.25** | Sans validation structurelle, la préservation du sens est le signal disponible le plus fort. |
| `chrf_plus_plus` | **0.25** | Sans FST, le chevauchement au niveau des caractères devient la vérification de surface principale. |
| `equivalent_match_rate` | **0.15** | L'appariement de variante fournit une évaluation de qualité structurée sans nécessiter d'outils morphologiques. |
| `exact_match_rate` | **0.10** | Sans FST, la correspondance exacte porte plus de poids comme seul proxy de validation structurelle. |
| `code_switching_rate` | **0.10** | La fuite de la langue source importe plus quand il n'y a pas de FST pour attraper la mauvaise sortie. |
| `terminology_adherence` | **0.05** | Conformité du vocabulaire coaché. |
| `hallucination_rate` | **0.05** | Détection de contenu fabriqué. |
| `orthographic_accuracy` | **0.05** | La correction spécifique au script comble partiellement le vide laissé par le FST absent. |

> **Total : 1,00.** `orthographic_accuracy` n'ayant jamais été calculé, les 7 métriques restantes (total 0,95) étaient multipliées par 1/0,95 ≈ 1,053.

#### `no-reference` : exécutions SANS référence or

| Métrique | Poids cible | Justification |
|--------|--------------|-----------|
| `fst_acceptance_rate` | **0.40** | La validité morphologique n'a pas besoin de référence ; le signal déterministe le plus fort quand un FST existe. |
| `code_switching_rate` | **0.25** | Fuite de la langue source (inversée). |
| `hallucination_rate` | **0.20** | Contenu fabriqué (inversé). |
| `terminology_adherence` | **0.15** | Conformité du vocabulaire coaché. |

> **Total : 1,00.** Pour les exécutions dont le corpus ne disposait d'aucune référence de vérité terrain. Lorsqu'une telle exécution ne disposait d'aucun FST, le composite était renormalisé sur les seuls contrôles comportementaux.

### 4.4 Ajouter une nouvelle métrique

Une nouvelle métrique est ajoutée en tant que **diagnostic** ; elle ne modifie jamais la métrique principale :

1. **La définir** au §2 avec le statut `🔲 Planned`, en précisant l'échelle, le niveau, le sens d'optimisation et la méthode de calcul.
2. **L'implémenter** sous forme de MetricPlugin (ou dans `tester.py` pour les métriques de base).
3. **L'enregistrer** dans `shared/metric-registry.json` et ajouter un espace réservé nul dans le bloc des scores de la fiche d'exécution.
4. **Mettre à jour BENCHMARK_SPEC.md** §3 si le schéma de la fiche d'exécution évolue.
5. **Lancer un benchmark de validation** pour confirmer que la métrique produit des valeurs cohérentes sur des données réelles.
6. **Mettre à jour ce document** pour faire passer le statut de `🔲` à `✅`.

Modifier la métrique principale ou de classement ne relève pas de l'« ajout d'une métrique » : cela requiert une nouvelle version de la norme d'évaluation ([Comment les exécutions sont évaluées](#how-runs-are-scored)).

---

## 5. Retiré : niveaux de qualité (hérités) {#5-quality-tiers}

> [!CAUTION]
> **Aucune nouvelle fiche ne comporte de niveau de qualité.** Les nouvelles fiches publient `quality_tier: null`, et aucune nouvelle sortie n'affiche de niveau ni de label tel que « fonctionnel » ou « déployable ». Un score automatique ne constitue pas un verdict sur la qualité : une même valeur numérique revêt des significations distinctes selon les langues et les ensembles d'évaluation, et les niveaux retirés ont qualifié de « fonctionnel » un système qui répétait une seule et même phrase pour chaque entrée (§4). Seule une évaluation humaine menée par des locuteurs certifie la qualité ([BENCHMARK_SPEC §7](/docs/network/specifications/benchmark#7-human-validation)).

Les niveaux étaient des labels déduits du score composite hérité. Les anciennes fiches les conservent en mémoire ; ils ne figurent ici que pour permettre la relecture d'une ancienne fiche, et ne constituent en rien des garanties de qualité.

| Niveau hérité | Plage du composite hérité |
|---------------|---------------------------|
| De base (*Baseline*) | 0.00–0.30 |
| Émergent (*Emerging*) | 0.30–0.50 |
| Fonctionnel (*Functional*) | 0.50–0.70 |
| Déployable (*Deployable*) | 0.70–0.85 |
| Fluide (*Fluent*) | 0.85–1.00 |

### 5.1 Seuils des niveaux (lisibles par machine, hérités)

Les seuils hérités (évalués de haut en bas, la première correspondance l'emporte) :

```
composite >= 0.85  →  "fluent"
composite >= 0.70  →  "deployable"
composite >= 0.50  →  "functional"
composite >= 0.30  →  "emerging"
composite >= 0.00  →  "baseline"
composite is null  →  "unscored"
```

---

## 6. Métriques de coût

Les métriques de coût évaluent l'efficacité financière d'une méthode de traduction. Elles sont rapportées aux côtés du score sans jamais être combinées avec lui.

### 6.1 Métriques de token

| ID | Métrique | Calcul |
|----|--------|-------------|
| `prompt_tokens` | Total des tokens d'entrée | Somme de `usage.prompt_tokens` sur tous les appels API |
| `completion_tokens` | Total des tokens de sortie | Somme de `usage.completion_tokens` |
| `reasoning_tokens` | Tokens de chaîne de pensée | Somme de `usage.completion_tokens_details.reasoning_tokens` (0 pour la plupart des modèles) |
| `cached_tokens` | Tokens en cache du fournisseur | Somme de `usage.prompt_tokens_details.cached_tokens` |
| `total_tokens` | Total des tokens consommés | `prompt_tokens + completion_tokens` |
| `tokens_per_entry` | Moyenne de tokens par traduction | ✅ `total_tokens / entry_count` |

### 6.2 Métriques de coût

| ID | Métrique | Calcul | Cas d'usage |
|----|--------|-------------|----------|
| `total_cost_usd` | Coût total de l'exécution | Tarification rapportée par le fournisseur × comptes de tokens | « Combien a coûté ce test ? » |
| `cost_per_entry_usd` | Coût par entrée du corpus | `total_cost_usd / entry_count` | Comparaison des méthodes sur le même corpus |
| `cost_per_1k_tokens` | Coût par 1 000 tokens | ✅ `total_cost_usd / total_tokens × 1000` | Efficacité LLM universelle — comparable entre les corpus |
| `cost_per_source_char` | Coût par caractère source | `total_cost_usd / total_source_chars` | Comparable entre les langues avec tokenisation différente |

> **Pourquoi plusieurs métriques de coût ?** Une « entrée » varie en longueur — une phrase de 3 mots coûte moins qu'un paragraphe. `cost_per_entry_usd` est utile pour comparer les méthodes sur le *même* corpus (mêmes entrées = mêmes longueurs = comparaison équitable). `cost_per_1k_tokens` est la métrique d'efficacité LLM standard, comparable *entre* les corpus. `cost_per_source_char` normalise les différences de tokenisation — la même phrase peut se tokeniser en différents nombres de tokens selon le vocabulaire du modèle.

### 6.3 Score ajusté au coût (retiré)

Les anciennes fiches comportent un score ajusté au coût, calculé à partir du composite retiré :

```
cost_adjusted = composite / log2(1 + cost_per_entry_usd × 1000)
```

Il a été retiré en même temps que le composite : les nouvelles fiches publient `cost_adjusted: null`. Pour mettre en balance le coût et la qualité, examinez chrF++ (avec son IC) et `cost_per_entry_usd` côte à côte ; le tableau de classement permet de trier selon l'un ou l'autre de ces critères.

---

## 7. Métriques de vitesse

Les métriques de rapidité mesurent la latence et le débit d'une méthode de traduction. Tout comme le coût, la rapidité est rapportée aux côtés du score sans jamais être combinée avec lui.

| ID | Métrique | Calcul | Niveau |
|----|--------|-------------|-------|
| `elapsed_seconds` | Durée d'exécution en temps réel | `time_end - time_start` | Exécution |
| `avg_latency_seconds` | Latence moyenne par entrée | `Σ latency_s / n_entries` | Corpus |
| `median_latency_seconds` | Latence médiane par entrée | 50e percentile de `latency_s` | Corpus |
| `p95_latency_seconds` | Latence du 95e percentile | 95e percentile de `latency_s` | Corpus |
| `tokens_per_second` | Débit | `total_tokens / elapsed_seconds` | Exécution |
| `entries_per_minute` | Taux de traduction | `entry_count / (elapsed_seconds / 60)` | Exécution |

---

## 8. Confiance et signification

### 8.1 Intervalles de confiance bootstrap

Les intervalles de confiance sont des intervalles bootstrap percentiles calculés sur les segments de l'ensemble d'évaluation (n=1000 rééchantillonnages, α=0,05 ; Koehn 2004). L'intervalle de chrF++ fait partie intégrante de la métrique principale : `chrF++ 47.5 [45.9, 49.0]`. Avec un ensemble d'évaluation restreint, l'intervalle est large, et le banc d'essai avertit l'utilisateur lorsqu'un sous-ensemble est trop petit pour produire un intervalle significatif.

| Métrique | IC rapporté |
|----------|-------------|
| `chrf_plus_plus` (principale) | ✅ fiche d'exécution `confidence_intervals.corpus_chrf` ; base de données `chrf_ci_lower`, `chrf_ci_upper` |
| `exact_match_rate` | ✅ `exact_match_ci_lower`, `exact_match_ci_upper` |
| `fst_acceptance_rate` | ✅ `fst_ci_lower`, `fst_ci_upper` (calculé uniquement en présence de données FST) |
| `comet_score` | ✅ `comet_ci_lower`, `comet_ci_upper` (obtenu par bootstrap sur les scores par entrée mis en cache — aucune inférence neuronale redondante) |
| `composite` | Anciennes fiches uniquement (`composite_ci_lower`, `composite_ci_upper`) ; non calculé pour les nouvelles exécutions |
| IC par niveau | ✅ `confidence_intervals_by_tier` — IC chrF++ et exact_match par niveau de difficulté (Niveaux 1 à 5) |

### 8.2 Tests de significativité appariés {#82-paired-significance-tests}

La supériorité d'une exécution sur une autre est tranchée par un test de significativité apparié sur chrF++ sur les segments traduits par les deux exécutions, jamais par la simple comparaison de deux valeurs. `mt-eval compare --significance` exécute :

- **Randomisation approchée** (par défaut ; Riezler & Maxwell 2005, également le choix par défaut de sacreBLEU) : les sorties des deux systèmes sont permutées segment par segment de façon aléatoire, 1 000 fois, pour observer la fréquence à laquelle une différence au moins aussi importante apparaît par le simple fait du hasard.
- **Rééchantillonnage bootstrap apparié** (`--method paired_bootstrap` ; Koehn 2004) : les segments sont rééchantillonnés avec remise et la différence est recalculée sur chaque échantillon. Il s'agit d'une estimation plus prudente, proposée pour faciliter la comparaison avec les publications plus anciennes.

```
H₀: The two methods perform equally on this evaluation set.
H₁: One method is better.
```

Chaque écart est assorti de son intervalle de confiance à 95 % et est consigné comme significatif dès lors que p < 0,05. BLEU, spBLEU, TER ainsi que les diagnostics présents dans les deux exécutions sont également testés et affichés (les p-valeurs sont données par métrique sans correction pour tests multiples), mais le verdict sur la « supériorité » repose sur le test chrF++. Deux chiffres chrF++ ne sont comparables que si leurs signatures sacreBLEU correspondent. Si l'un des rapports comparés est un ancien rapport hérité, l'outil de comparaison indique que son composite est retiré et ne le compare pas. Méthode complète : [Tests de significativité statistique](/docs/network/specifications/significance).

---

## 9. Schéma des scores de la carte d'exécution

Cette section définit la structure hiérarchique du bloc `scores` dans une carte d'exécution. Ce schéma est dérivé des métriques définies dans §2–§7 et doit être gardé en synchronisation.

```jsonc
{
  "scores": {
    // The scoring standard
    "scoring_standard":       "standard/1", // absent on legacy cards → "legacy-composite"
    "primary_metric":         "chrf_plus_plus",

    // HEADLINE (§2.1): corpus chrF++, 0–100; CI in confidence_intervals.corpus_chrf,
    // signature in sacrebleu_signatures.chrf
    "chrf_plus_plus":         47.52,

    // Other standard metrics — shown beside chrF++, never blended
    // (BLEU rides at the card's top level as "corpus_bleu"; COMET below)
    "spbleu":                 24.01,        // FLORES-200 SentencePiece BLEU
    "ter":                    61.2,         // 0–∞ (lower=better)
    "chrf_plain":             44.10,        // plain chrF (word_order=0), for comparison with published tables
    "sacrebleu_signatures": {
      "chrf":   "nrefs:1|case:mixed|eff:yes|nc:6|nw:2|space:no|version:2.4.3",
      "bleu":   "nrefs:1|case:mixed|eff:no|tok:13a|smooth:exp|version:2.4.3"
      // also chrf_plain, spbleu, ter
    },

    // Diagnostics (§2) — reported separately, never in a headline
    "exact_match_rate":       0.1613,       // 0.0–1.0
    "exact_matches":          10,           // count
    "equivalent_match_rate":  null,         // ⚡ partial (CRK: eval_standards/crk CrkLinterMetric)
    "equivalent_matches":     null,
    "length_ratio":           1.03,         // ideal=1.0
    "fst_acceptance_rate":    0.92,         // 0.0–1.0
    "fst_accepted":           274,          // count
    "morphological_accuracy": 0.63,         // FST-derived, lemma-matched, verifier-re-derived
    "morph_coverage":         0.41,         // fraction of analyzable predicted words lemma-matched to the reference
    "morph_in_composite":     false,        // legacy key; always false on a standard/1 card
    "orthographic_accuracy":  null,         // 🔲 planned
    "semantic_score":         null,         // ⚡ partial (CRK: eval_standards/crk CrkSemanticMetric)
    "code_switching_rate":    0.03,         // lower=better
    "hallucination_rate":     0.01,         // lower=better
    "terminology_adherence":  null,         // null when no glossary
    "style_consistency_rate": null,         // writing style
    "consistency_score":      null,         // 🔲 planned

    // COMET — a standard metric when computed (model id beside it)
    "comet_score":            0.712,        // null when not computed
    "comet_model":            "Unbabel/wmt22-comet-da",

    // Retired (§4, §5, §6.3) — always null on a standard/1 card
    "composite":              null,
    "quality_tier":           null,
    "cost_adjusted":          null,

    // §7 Speed metrics (merged into scores block)
    "tokens_per_second":      4462.5,       // ✅ total_tokens / elapsed
    "entries_per_minute":     82.30,        // ✅ entry_count / (elapsed/60)
    "avg_latency_seconds":    0.234,
    "median_latency_seconds": 0.190,
    "p95_latency_seconds":    0.415,

    // §8.1 Confidence intervals
    "confidence_intervals": {
      "corpus_chrf":        { "ci_lower": 45.9, "ci_upper": 49.0 },   // the headline's CI
      "exact_match_rate":   { "ci_lower": 0.08, "ci_upper": 0.25 },
      "corpus_comet":       { "ci_lower": 0.69, "ci_upper": 0.73 }
    },
    "confidence_intervals_by_tier": {
      "1": { "corpus_chrf": { "ci_lower": 68.1, "ci_upper": 76.5 } },
      "3": { "corpus_chrf": { "ci_lower": 36.2, "ci_upper": 47.0 } }
    },

    // Breakdowns
    "by_difficulty":          {},           // scores grouped by difficulty tier
    "by_provenance":          {},           // scores grouped by entry provenance

    // Counts
    "total":                  62,
    "evaluated":              62,
    "errors":                 0
  },

  "totals": {
    // §6.1 Token metrics
    "prompt_tokens":          13985,
    "completion_tokens":      187822,
    "reasoning_tokens":       175726,
    "cached_tokens":          0,
    // §6.2 Cost metrics
    "total_cost_usd":         1.7114,
    "cost_per_entry_usd":     0.027603,
    "cost_per_source_char":   null          // 🔲 needs source char counting
  }
}
```

Les avertissements de score (§2.8) figurent au niveau racine de la fiche sous la clé `score_caveats`, une liste d'objets `{kind, source, severity, message, …}` ; BLEU y figure sous la clé `corpus_bleu`.

> **Historique du schéma.** Les brouillons de spécification antérieurs proposaient des blocs `cost`, `speed` et `tokens` séparés. Ceux-ci ont été fusionnés dans `scores` et `totals` respectivement pour la simplicité. Les métriques de vitesse (`tokens_per_second`, `entries_per_minute`, latences) vivent dans `scores` ; les comptes de tokens et les chiffres de coût vivent dans `totals`.

### 9.1 Mappage schéma–base de données

Le JSON de la carte d'exécution est stocké en entier comme colonne `jsonb` dans Supabase. Les métriques clés sont également dénormalisées dans les colonnes de niveau supérieur pour les performances de tri/filtre :

| Champ de la fiche d'exécution | Colonne Supabase | Type | Index |
|------------------------------|------------------|------|-------|
| `scores.chrf_plus_plus` | `chrf_plus_plus` | `real` | `idx_leaderboard` |
| `scores.confidence_intervals.corpus_chrf` | `chrf_ci_lower`, `chrf_ci_upper` | `real` | — |
| `scores.composite` | `composite_score` | `real` | `idx_composite` — anciennes fiches uniquement ; null pour `standard/1` |
| `scores.quality_tier` | `quality_tier` | `text` | — anciennes fiches uniquement ; null pour `standard/1` |
| `scores.exact_match_rate` | `exact_match_rate` | `real` | — |
| `scores.fst_acceptance_rate` | `fst_acceptance_rate` | `real` | — |
| `corpus_bleu` | `corpus_bleu` | `real` | — |
| `scores.comet_score` | `comet_score` | `real` | — |
| `totals.total_cost_usd` | `total_cost_usd` | `real` | — |
| `totals.cost_per_entry_usd` | `cost_per_entry_usd` | `real` | — |
| `totals.cost_per_source_char` | `cost_per_source_char` | `real` | — |
| `scores.avg_latency_seconds` | `avg_latency_seconds` | `real` | — |
| `model_slug` | `model_slug` | `text` | `idx_model` |
| `condition` | `condition` | `text` | — |
| `dataset.id` | `dataset_id` | `text` | `idx_leaderboard` |
| `dataset.language_pair` | `language_pair` | `text` | — |
| `fingerprint.hash` | `fingerprint_hash` | `text` | `idx_fingerprint` |
| `scores.equivalent_match_rate` | `equivalent_match_rate` | `real` | — |
| `scores.semantic_score` | `semantic_score` | `real` | — |
| `scores.ter` | `ter` | `real` | — |
| `scores.length_ratio` | `length_ratio` | `real` | — |
| `scores.code_switching_rate` | `code_switching_rate` | `real` | — |
| `scores.hallucination_rate` | `hallucination_rate` | `real` | — |
| `scores.terminology_adherence` | `terminology_adherence` | `real` | — |
| `scores.tokens_per_second` | `tokens_per_second` | `real` | — |
| `scores.entries_per_minute` | `entries_per_minute` | `real` | — |
| `elapsed_seconds` | `elapsed_seconds` | `real` | — |
| *(fiche complète)* | `run_card` | `jsonb` | — |

Quand de nouvelles métriques sont implémentées, la colonne correspondante doit être ajoutée via une migration numérotée dans `arena/migrations/`.

---

## 10. Synchronisation code–spécification

### 10.1 Source canonique

Ce document constitue la source canonique pour :
- La norme d'évaluation : la métrique principale, les métriques standards l'accompagnant et les diagnostics ([Comment les exécutions sont évaluées](#how-runs-are-scored))
- Les définitions des métriques (§2) et les avertissements de score (§2.8)
- Les tableaux de pondération (§4.3) et seuils de niveaux (§5.1) du composite hérité, conservés pour vérifier les anciennes fiches
- Les formules des métriques de coût (§6.2)
- Le schéma des scores des fiches d'exécution (§9)

### 10.2 Miroir de code

Le fichier `arena/mt_eval_harness/scoring.py` constitue l'implémentation logicielle de ce document : les rôles de métriques de la norme (`SCORING_STANDARD`, `PRIMARY_METRIC`, `SECONDARY_METRICS`, `DIAGNOSTIC_METRICS`) et, à leur suite, les tableaux composites et seuils de niveaux hérités utilisés uniquement pour la vérification des anciennes fiches. Aucun autre module ne les définit ; les tests du banc d'essai verrouillent les deux. Lorsque ce document est mis à jour, adaptez `scoring.py` en conséquence et relancez les tests du banc d'essai.

### 10.3 Documents qui font référence à cette spécification

| Document | Ce qu'il référence | Comment maintenir la synchronisation |
|----------|---------------------|---------------------------------------|
| [Spécification du benchmark](/docs/network/specifications/benchmark) §4–§5 | Métrique principale, classement, composite hérité | Faire référence à ce doc ; ne pas dupliquer les tableaux |
| [Tests de significativité statistique](/docs/network/specifications/significance) | Décision de « supériorité » | Doit concorder avec le §8.2 |
| [FAQ](/docs/network/getting-started/faq) et [Fonctionnement](/docs/network/how-it-works) | Synthèse vulgarisée de la norme | Renvoyer vers ce doc |
| `publish.py` via `scoring.py` | `standard_score_fields()` et le composite hérité | Les tests du banc d'essai valident la concordance |

---

## Annexe A : Pourquoi chrF++ est la métrique principale (et non les autres)

| Métrique | Rôle | Pourquoi |
|----------|------|----------|
| **chrF++** | Principale | Les n-grammes de caractères accordent un crédit partiel à un mot doté de la bonne racine et d'un suffixe différent, gérant ainsi la morphologie riche bien plus efficacement que les métriques au niveau du mot (Popović 2015, 2017). Reproductible à partir du seul corpus pour chaque langue et système d'écriture, c'est ce que rapportent FLORES-200 et les tâches partagées d'AmericasNLP. |
| **BLEU** | Standard, d'accompagnement | L'appariement au niveau du mot assimile une légère variation flexionnelle à un échec complet, pénalisant lourdement les langues polysynthétiques. Rapporté pour permettre la comparaison avec la littérature spécialisée en TA. |
| **spBLEU** | Standard, d'accompagnement | BLEU sur une tokenisation partagée SentencePiece, comparable d'un système d'écriture à l'autre ; rapporté par FLORES-200. |
| **TER** | Standard, d'accompagnement | Distance d'édition ; corrélée avec chrF++ pour la plupart des cas d'usage. |
| **COMET** | Standard, d'accompagnement (si calculé) | Entraîné sur les données WMT (paires européennes à fortes ressources). Pour les langues à faibles ressources (ex. le cri), le modèle extrapole et n'est pas étalonné ; nécessitant un modèle volumineux, il ne peut être le chiffre unique présent sur chaque exécution. Recalculé par le vérificateur. |
| **Ratio de longueur** | Diagnostic | Un ratio de 1,02 ou de 0,98 est parfaitement acceptable. Seules les valeurs extrêmes trahissent des anomalies (§2.8). |
| **Acceptation FST, précision morphologique, LYSS** | Diagnostic | Heuristiques d'ingénierie dépourvues de données de corrélation humaine ; l'acceptation FST n'examine jamais la source ni la référence (§4). |
| **Score de cohérence** | Diagnostic (prévu) | Une certaine variabilité est légitime (un même mot anglais → des traductions différentes dans la langue cible selon le contexte). |
| **Indice de conformité** | Filtre (prévu) | Mesure la préservation structurelle (variables, guillemets), non la précision de traduction. |

## Appendice B : LYSS — Implémentations de métriques spécifiques à la langue

Le cadre **LYSS** (Linguistically-informed Yield & Structural Scoring) fournit des métriques spécifiques à la langue qui vont au-delà de la comparaison de chaînes de surface. LYSS a trois composants principaux :

- **LYSS-fst** — Validité morphologique (`fst_acceptance_rate`) : Chaque mot est-il une forme valide dans la langue cible ?
- **LYSS-eq** — Équivalence linguistique (`equivalent_match_rate`) : La sortie est-elle une variante acceptable de la référence ?
- **LYSS-sem** — Validation sémantique (`semantic_score`) : La sortie préserve-t-elle le sens source ?

Tous trois constituent des **diagnostics** au regard de la norme d'évaluation : présentés aux côtés de la métrique principale chrF++, jamais intégrés à celle-ci.

> **Statut de validation : 🔶 Heuristique d'ingénierie.** Les métriques LYSS n'ont PAS été validées contre les jugements de qualité humains. Elles sont conçues à partir de principes linguistiques (FST, dictionnaires, règles de grammaire construites par des linguistes au ALTLab UAlberta), mais la corrélation entre les scores LYSS et la qualité réelle de traduction n'a pas été mesurée. Voir le [Protocole de validation des locuteurs](/docs/network/specifications/speaker-validation) pour les expériences de validation requises.

| Langue | Plugin | Emplacement | Composant LYSS | Clé de métrique | Remarques |
|--------|--------|-------------|----------------|-----------------|-----------|
| CRK (cri des Plaines) | `CrkLinterMetric` | `eval_standards/crk/metrics.py` | **LYSS-eq** | `equivalent_match_rate` | Règles déterministes de classes de variantes : ordre des mots, orthographe, particule optionnelle, synonyme de lemme, ambiguïté progressive, inclusif/exclusif. Produit `lint_verdict` par entrée (EXACT/EQUIVALENT/MISS/NO_OUTPUT). |
| CRK | `CrkSemanticMetric` | `eval_standards/crk/metrics.py` | **LYSS-sem** | `semantic_score` | Déterministe : extraction de lemmes FST + gloses de dictionnaire + chevauchement de mots de contenu spaCy. Émet des verdicts (EXACT_MATCH/VALID/GRAMMAR_ISSUES/PARTIAL/INCOMPLETE/WRONG/NO_OUTPUT). |
| Langues GiellaLT | `GiellaLTFSTMetric` | `plugins/giellalt_fst.py` | **LYSS-fst** | `fst_acceptance_rate` | Générique : toute langue dotée d'un FST verrouillé dans le banc d'essai (`mt_eval_harness/data/fst-pins.json`). Un FST d'analyse fournit également `morphological_accuracy` ; un correcteur orthographique accepteur seul (les paquets Divvun verrouillés pour le same du Nord, l'amharique et le basque) rapporte uniquement l'acceptation. Faire l'objet d'une évaluation FST en pratique requiert également un ensemble d'évaluation pour la paire permettant le classement : les deux ensembles de cri des Plaines (EdTeKLA) sont des labels mis en quarantaine pour lesquels la base de données refuse d'attribuer un score, tandis que plusieurs autres langues à FST disposent d'ensembles ouverts (Tatoeba, WMT, WMT24++). La [page des jeux de données](/docs/network/leaderboard/datasets) répertorie le catalogue, et `mt-eval corpora --source eng --target <code>` liste ce qui peut s'exécuter pour une paire donnée (voir [Limites en toute transparence](/docs/network/honest-limitations)). |

> **Note d'architecture (juin 2026).** Les métriques LYSS propres à une langue sont désormais déclarées sur la fiche de langue sous `evalMetrics` et chargées depuis `eval_standards/<lang>/` par `plugin_discovery.py`. Elles constituent des **normes d'évaluation** (arbitre) et non des métriques de plugin de méthode (candidat). Cela signifie que toute méthode de traduction ciblant le CRK fait automatiquement l'objet des diagnostics LYSS — sans nécessiter de configuration propre à la méthode. `CrkFSTMetric` a été supprimé ; ses fonctionnalités sont intégralement prises en charge par l'élément générique `GiellaLTFSTMetric`.

## Appendice C : Métriques en considération

Ce sont des idées en cours d'évaluation mais pas encore assez spécifiées pour §2 :

| Idée | Ce qu'elle mesurerait | Bloqueurs |
|------|----------------------|----------|
| Fluidité (perplexité LM) | La sortie est-elle bien formée en prose dans la langue cible ? | Nécessite un LM de langue cible. Aucun bon modèle n'existe pour la plupart des LRL. |
| Appariement de registre | La traduction correspond-elle au niveau de formalité attendu ? | Nécessite des classificateurs sociolinguistiques. Problème de recherche. |
| Appropriateness culturelle | Les références culturelles sont-elles traitées correctement ? | Ne peut pas être automatisée — nécessite intrinsèquement l'examen humain. |
| Cohérence du discours | Les traductions consécutives forment-elles un passage cohérent ? | Nécessite l'évaluation au niveau du document, pas au niveau de la phrase. |

---

## Références

Articles académiques, outils et ressources linguistiques cités dans cette spécification.

### Métriques de surface

1. Popović, M. (2017). « chrF++ : words helping character n-grams. » *Proceedings of the Second Conference on Machine Translation (WMT 2017)*, pp. 612–618. Copenhague, Danemark.

1a. Popović, M. (2015). « chrF: character n-gram F-score for automatic MT evaluation ». *Proceedings of the Tenth Workshop on Statistical Machine Translation (WMT 2015)*. Lisbonne, Portugal.

2. Papineni, K., Roukos, S., Ward, T., & Zhu, W.-J. (2002). « BLEU: a method for automatic evaluation of machine translation. » *Proceedings of the 40th Annual Meeting of the Association for Computational Linguistics (ACL 2002)*, pp. 311–318. Philadelphie, PA.

3. Post, M. (2018). « A Call for Clarity in Reporting BLEU Scores. » *Proceedings of the Third Conference on Machine Translation (WMT 2018)*, pp. 186–191. Belgique, Bruxelles. Implémentation de référence : [sacrebleu](https://github.com/mjpost/sacrebleu).

4. Snover, M., Dorr, B., Schwartz, R., Micciulla, L., & Makhoul, J. (2006). « A Study of Translation Edit Rate with Targeted Human Annotation. » *Proceedings of the 7th Conference of the Association for Machine Translation in the Americas (AMTA 2006)*, pp. 223–231. Cambridge, MA.

### Pratiques d'évaluation et tests de significativité

S1. Koehn, P. (2004). « Statistical Significance Tests for Machine Translation Evaluation ». *Proceedings of the 2004 Conference on Empirical Methods in Natural Language Processing (EMNLP 2004)*. Barcelone, Espagne.

S2. Riezler, S. & Maxwell, J. T. (2005). « On Some Pitfalls in Automatic Evaluation and Significance Testing for MT ». *Proceedings of the ACL Workshop on Intrinsic and Extrinsic Evaluation Measures for Machine Translation and/or Summarization*. Ann Arbor, MI.

S3. Kocmi, T., Federmann, C., Grundkiewicz, R., Junczys-Dowmunt, M., Matsushita, H., & Menezes, A. (2021). « To Ship or Not to Ship: An Extensive Evaluation of Automatic Metrics for Machine Translation ». *Proceedings of the Sixth Conference on Machine Translation (WMT 2021)*.

S4. Kocmi, T., et al. (2024). « Findings of the WMT24 General Machine Translation Shared Task ». *Proceedings of the Ninth Conference on Machine Translation (WMT 2024)*.

S5. NLLB Team, Costa-jussà, M. R., et al. (2022). « No Language Left Behind: Scaling Human-Centered Machine Translation ». arXiv:2207.04672. (FLORES-200 ; rapporte chrF++ et spBLEU.)

S6. Goyal, N., Gao, C., Chaudhary, V., et al. (2022). « The Flores-101 Evaluation Benchmark for Low-Resource and Multilingual Machine Translation ». *Transactions of the Association for Computational Linguistics*, vol. 10. (spBLEU.)

S7. Mager, M., Oncevay, A., Ebrahimi, A., et al. (2021). « Findings of the AmericasNLP 2021 Shared Task on Open Machine Translation for Indigenous Languages of the Americas ». *Proceedings of the First Workshop on Natural Language Processing for Indigenous Languages of the Americas*.

S8. Ebrahimi, A., Mager, M., Rijhwani, S., et al. (2023). « Findings of the AmericasNLP 2023 Shared Task on Machine Translation into Indigenous Languages ». *Proceedings of the Workshop on Natural Language Processing for Indigenous Languages of the Americas (AmericasNLP 2023)*.

### Métriques neurales

5. Rei, R., Stewart, C., Farinha, A. C., & Lavie, A. (2020). « COMET: A Neural Framework for MT Evaluation. » *Proceedings of the 2020 Conference on Empirical Methods in Natural Language Processing (EMNLP 2020)*, pp. 2685–2702. En ligne.

6. Juraska, J., Finkelstein, M., Deutsch, D., Siddhant, A., Mirzazadeh, M., & Freitag, M. (2023). « MetricX-23: The Google Submission to the WMT 2023 Metrics Shared Task. » *Proceedings of the Eighth Conference on Machine Translation (WMT 2023)*, Singapour. (ACL Anthology 2023.wmt-1.63)

7. Zhang, T., Kishore, V., Wu, F., Weinberger, K. Q., & Artzi, Y. (2020). « BERTScore: Evaluating Text Generation with BERT. » *Proceedings of the Eighth International Conference on Learning Representations (ICLR 2020)*. Addis-Abeba, Éthiopie.

8. Sellam, T., Das, D., & Parikh, A. (2020). « BLEURT: Learning Robust Metrics for Text Generation. » *Proceedings of the 58th Annual Meeting of the Association for Computational Linguistics (ACL 2020)*, pp. 7881–7892. En ligne.

### Outils morphologiques et linguistiques

9. Lindén, K., Silfverberg, M., Axelson, E., Hardwick, S., & Pirinen, T. (2011). « HFST—Framework for Compiling and Applying Morphologies. » *Systems and Frameworks for Computational Morphology (SFCM 2011)*, Communications in Computer and Information Science, vol. 100, pp. 67–85. Springer, Berlin, Heidelberg.

10. Sánchez-Cartagena, V. M., & Toral, A. (2024). « MorphEval: Automatic Evaluation of Morphological Capabilities of Machine Translation Systems. » *Machine Translation*, vol. 38, pp. 1–28.

### Classification d'erreurs et évaluation diagnostique

11. Popović, M. (2011). « Hjerson: An Open Source Tool for Automatic Error Classification of Machine Translation Output. » *The Prague Bulletin of Mathematical Linguistics*, no. 96, pp. 59–68.

12. Dreyer, M. & Marcu, D. (2012). « HyTER: Meaning-Equivalent Semantics for Translation Evaluation. » *Proceedings of the 2012 Conference of the North American Chapter of the Association for Computational Linguistics: Human Language Technologies (NAACL 2012)*, pp. 162–171. Montréal, Canada.

13. Reiter, E. & Belz, A. (2009). « An Investigation into the Validity of Some Metrics for Automatically Evaluating Natural Language Generation Systems. » *Computational Linguistics*, vol. 35, no. 4, pp. 529–558. (Travaux connexes sur les métriques d'évaluation basées sur les caractéristiques, incluant FUSE.)

### Détection d'hallucination

14. Raunak, V., Menezes, A., & Junczys-Dowmunt, M. (2021). « The Curious Case of Hallucinations in Neural Machine Translation. » *Proceedings of the 2021 Conference of the North American Chapter of the Association for Computational Linguistics: Human Language Technologies (NAACL 2021)*, pp. 1172–1183. En ligne.

15. Guerreiro, N. M., Voita, E., & Martins, A. F. T. (2023). « Looking for a Needle in a Haystack: A Comprehensive Study of Hallucinations in Neural Machine Translation. » *Proceedings of the 17th Conference of the European Chapter of the Association for Computational Linguistics (EACL 2023)*, pp. 1059–1075. Dubrovnik, Croatie.

### Ressources de la langue Cree

16. Wolfart, H. C. (1973). « Plains Cree: A Grammatical Study. » *Transactions of the American Philosophical Society*, vol. 63, no. 5, pp. 1–90.

17. Wolvengrey, A. (2001). *nêhiyawêwin: itwêwina / Cree: Words.* Canadian Plains Research Center, Université de Regina.

### Gouvernance des données

18. Global Indigenous Data Alliance. « CARE Principles for Indigenous Data Governance ». [https://www.gida-global.org/care](https://www.gida-global.org/care).

19. Carroll, S. R., Garba, I., Figueroa-Rodríguez, O. L., Holbrook, J., Lovett, R., Materechera, S., Parsons, M., Raseroka, K., Rodriguez-Lonebear, D., Rowe, R., Sara, R., Walker, J. D., Anderson, J., & Hudson, M. (2020). « The CARE Principles for Indigenous Data Governance. » *Data Science Journal*, vol. 19, no. 1, p. 43.
