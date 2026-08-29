---
sidebar_position: 3
title: "Mesurer l'incommensurable"
---

# Mesurer l'incommensurable : le problème de l'évaluation en traduction automatique

**Une étude sur la façon dont le domaine mesure la qualité de la traduction, ses échecs et ce que LYSS (Linguistically-informed Yield & Structural Scoring) propose comme alternative**

---

> *"Les métriques automatiques sont un mensonge commode. Elles nous donnent un nombre, et ce nombre nous permet d'écrire un article, et cet article nous permet de revendiquer des progrès. Savoir si des progrès ont réellement eu lieu est une toute autre question."*
> — Adapté d'un sentiment récurrent lors des tâches partagées sur les métriques du WMT (WMT Metrics Shared Tasks)

---

## Introduction

La traduction automatique a un problème de mesure.

Le domaine a passé deux décennies à construire des systèmes de plus en plus sophistiqués — des tables de phrases aux mécanismes d'attention en passant par les modèles de langage à mille milliards de paramètres — et tout au long de cette évolution, il a lutté avec une question d'une simplicité trompeuse : *comment savoir si une traduction est bonne ?*

Cette question n'est pas purement théorique. La métrique que vous choisissez détermine quel système "gagne". Elle détermine ce qui est financé, ce qui est publié, ce qui est déployé et — pour les langues qui ont le plus besoin de la traduction automatique — si les traductions d'une communauté sont jugées comme des échecs alors qu'elles sont, en fait, correctes.

L'histoire de l'évaluation de la traduction automatique est, en miniature, l'histoire des valeurs du domaine. La domination de BLEU pendant près de deux décennies révèle une préférence pour une mesure peu coûteuse, rapide et indépendante de la langue, au détriment d'une évaluation linguistiquement informée. L'essor des métriques neuronales comme COMET reflète la sophistication croissante du domaine — et sa dépendance continue à l'égard des données d'entraînement centrées sur l'anglais. L'absence quasi totale d'évaluation tenant compte de la morphologie reflète un domaine qui, jusqu'à récemment, a été construit par et pour des locuteurs de langues européennes analytiques.

Cet article retrace l'évolution de l'évaluation de la traduction automatique, de BLEU à nos jours, identifie les points où les approches existantes échouent systématiquement pour les langues morphologiquement complexes et peu dotées, et examine à quoi pourrait ressembler une alternative fondée sur la linguistique. Il accompagne les autres documents de contexte du projet — [*From Pāṇini to Transformers*](./history-of-language-and-computation.md) (qui retrace l'histoire intellectuelle du langage et de l'informatique) et le [*Field Briefing*](./mt-field-briefing.md) (qui dresse un panorama du paysage actuel de la traduction automatique). Là où ces documents demandent "comment en sommes-nous arrivés là ?" et "qu'est-ce qui existe ?", celui-ci demande : "comment savons-nous si tout cela fonctionne ?"

---

## Partie 1 : L'ère de la correspondance de chaînes (2002–2015)

### BLEU et la naissance de l'évaluation automatique



L'ère moderne de l'évaluation de la traduction automatique commence avec un seul article : "BLEU: a Method for Automatic Evaluation of Machine Translation" de Kishore Papineni, Salim Roukos, Todd Ward et Wei-Jing Zhu, publié à l'ACL 2002. BLEU (Bilingual Evaluation Understudy) mesure dans quelle mesure les séquences de mots (n-grammes) d'une traduction automatique chevauchent une ou plusieurs traductions de référence humaines. Il inclut une pénalité de brièveté pour empêcher les systèmes de manipuler le score avec des sorties courtes, et il calcule une moyenne géométrique des précisions des n-grammes aux ordres 1 à 4.

BLEU est devenu la monnaie d'échange du domaine pour une raison simple : il était rapide, peu coûteux, reproductible et indépendant de la langue. Avant BLEU, l'évaluation d'un système de traduction automatique nécessitait une évaluation humaine coûteuse et lente. BLEU offrait un nombre qui pouvait être calculé en quelques millisecondes, comparé entre les articles et utilisé pour classer les systèmes dans des tâches partagées. En quelques années, il est devenu pratiquement obligatoire — un article sans scores BLEU était impubliable.

Mais BLEU présente des défauts profonds et bien documentés que le domaine a passé deux décennies à essayer de contourner :

**Aucune compréhension sémantique.** BLEU est une pure correspondance de surface. "The cat sat on the mat" obtient un score de zéro par rapport à une référence de "the feline rested on the rug". Chaque mot est un synonyme correct ; le sens est identique ; le score est de zéro.

**Cécité morphologique.** Pour les langues agglutinantes et polysynthétiques, la correspondance stricte au niveau du mot échoue de manière catastrophique. Un verbe en Plains Cree correctement conjugué qui diffère d'un morphème par rapport à la référence obtient un score de zéro — même si la différence est une particule grammaticalement facultative ou un ordre des mots tout aussi valide.

**Faible discrimination au niveau de la phrase.** BLEU a été conçu comme une métrique au niveau du corpus. Au niveau de la phrase, il est bruyant et peu fiable — pourtant, il est couramment appliqué à des phrases individuelles.

**Biais de la référence unique.** BLEU suppose qu'il existe *une* traduction correcte (ou un petit ensemble de références). Pour les langues à ordre des mots libre, aux vocabulaires riches en synonymes ou aux ambiguïtés systématiques (comme le "nous" inclusif/exclusif du Plains Cree), il peut y avoir des dizaines de traductions tout aussi correctes, et BLEU pénalise toutes celles qui ne correspondent pas à la référence.

**Faible corrélation avec le jugement humain.** Des méta-analyses — notamment Reiter (2018, *Computational Linguistics*) — ont montré que la corrélation de BLEU avec les évaluations humaines de la qualité est souvent faible, en particulier pour les systèmes de haute qualité et pour les langues éloignées de l'anglais.

Ces défauts étaient connus presque depuis le début. Pourtant, BLEU a persisté parce que les alternatives étaient pires — non pas en termes de précision, mais de commodité. Le domaine a optimisé pour la métrique qu'il pouvait calculer, et non pour la métrique dont il avait besoin.

### NIST (Doddington, 2002)

La métrique NIST, publiée la même année que BLEU par George Doddington à HLT 2002, a modifié la formule de BLEU de deux manières. Premièrement, elle a pondéré les n-grammes en fonction de leur **contenu en information** — les n-grammes rares recevaient un poids plus élevé que les n-grammes courants, selon l'intuition que traduire correctement une expression inhabituelle est plus informatif que de traduire correctement "de la". Deuxièmement, elle a utilisé une **moyenne arithmétique** au lieu de la moyenne géométrique de BLEU, produisant des scores plus stables qui ne s'effondraient pas à zéro lorsqu'un ordre de n-gramme n'avait aucune correspondance. NIST a été largement utilisé dans les programmes d'évaluation DARPA TIDES et NIST OpenMT, mais n'a jamais atteint la domination de BLEU dans la communauté de recherche au sens large. Malgré ses améliorations, il partageait la limitation fondamentale de BLEU : une correspondance de chaînes au niveau de la surface sans aucun concept de sens.

### METEOR (Banerjee & Lavie, 2005)

METEOR (Metric for Evaluation of Translation with Explicit ORdering) a été une première tentative pour remédier à la rigidité de BLEU. Là où BLEU effectue une correspondance exacte des mots, METEOR a introduit trois innovations :

1. **Racinisation (Stemming)** : Les mots sont réduits à leur racine avant comparaison, accordant un crédit partiel pour les variantes morphologiques (par exemple, "running" correspond à "ran" après racinisation).
2. **Correspondance des synonymes** : En utilisant WordNet, METEOR reconnaît que "car" et "automobile" sont le même concept.
3. **Alignement des mots** : Plutôt que de compter les chevauchements de n-grammes, METEOR aligne explicitement les mots entre l'hypothèse et la référence, puis calcule la précision et le rappel avec une pénalité de fragmentation.

METEOR a systématiquement montré une corrélation plus élevée avec les jugements humains que BLEU. Mais il nécessitait des ressources spécifiques à la langue (raciniseurs, bases de données de synonymes) qui limitaient son applicabilité, et il était plus lent à calculer. Pour l'anglais, c'était mieux. Pour les langues peu dotées, les raciniseurs et les bases de données de synonymes n'existaient tout simplement pas.

### TER (Snover et al., 2006)

Le Translation Edit Rate (taux d'édition de traduction) mesure le nombre minimum de modifications (insertions, suppressions, substitutions et *déplacements de phrases*) nécessaires pour transformer l'hypothèse en référence, normalisé par la longueur de la référence. L'opération de déplacement de phrase — déplacer une séquence contiguë de mots vers une position différente — était une reconnaissance directe que l'ordre des mots n'est pas fixe d'une langue à l'autre. L'approche par distance d'édition de TER est intuitive (elle mesure "quelle quantité de travail un post-éditeur humain devrait-il fournir ?") mais hérite de la même limitation fondamentale : elle compare par rapport à une seule référence et n'a aucun concept de sens.

### chrF et chrF++ (Popović, 2015 ; 2017)

L'innovation métrique la plus importante entre BLEU et l'ère neuronale est venue de Maja Popović. **chrF** (character F-score) mesure le chevauchement au niveau du *caractère* plutôt qu'au niveau du mot, en calculant la précision et le rappel des n-grammes de caractères. **chrF++** réintègre les unigrammes et bigrammes au niveau du mot dans le calcul.

Pourquoi cela est important pour les langues morphologiquement riches : la correspondance au niveau des caractères accorde un *crédit partiel* pour les morphèmes partagés. Les mots en Plains Cree *nikî-nipâw* ("j'ai dormi") et *kikî-nipâw* ("tu as dormi") partagent la plupart de leurs n-grammes de caractères bien qu'ils soient des mots différents. chrF accorderait un crédit partiel substantiel ; BLEU accorderait zéro.

chrF++ est devenu une métrique secondaire standard lors des tâches partagées du WMT, implémentée dans **sacreBLEU** (Post, 2018), et est largement reconnue comme supérieure à BLEU pour les langues morphologiquement riches. Mais elle reste une métrique de correspondance de chaînes — meilleure que BLEU, mais fondamentalement limitée par la même hypothèse selon laquelle la qualité de la traduction peut être mesurée par le chevauchement des formes de surface.

---

## Partie 2 : La révolution des métriques neuronales (2018–Présent)



### L'idée clé : apprendre à évaluer

Les métriques de correspondance de chaînes de la Partie 1 partagent un choix de conception fondamental : ce sont des formules élaborées manuellement. Quelqu'un a décidé que la précision des n-grammes, le chevauchement des caractères ou la distance d'édition était un bon indicateur de la qualité de la traduction, et ensuite tout le monde a utilisé cette formule pendant une décennie.

La révolution des métriques neuronales a commencé avec une question différente : *et si nous entraînions un modèle à prédire la qualité de la traduction, de la même manière que nous entraînons des modèles à traduire ?*

### BERTScore (Zhang et al., 2020)

BERTScore, publié à l'ICLR 2020 par Tianyi Zhang et ses collègues de Cornell et du MIT, a été la première métrique largement adoptée à faire passer l'évaluation de la correspondance exacte de chaînes à la similarité sémantique. Le mécanisme est élégant : encoder à la fois l'hypothèse et la référence via un modèle Transformer pré-entraîné (BERT, RoBERTa ou DeBERTa), calculer la similarité cosinus entre chaque paire de plongements (embeddings) de tokens, puis utiliser une correspondance gloutonne (greedy matching) pour calculer la précision (la meilleure correspondance de chaque token de l'hypothèse dans la référence), le rappel (la meilleure correspondance de chaque token de la référence dans l'hypothèse) et le score F1.

BERTScore gère naturellement les synonymes, les paraphrases et les variations de l'ordre des mots — "the feline rested on the rug" obtient une forte similarité avec "the cat sat on the mat" car les plongements contextuels capturent l'équivalence sémantique. Avec le modèle BERT multilingue, il s'étend à toutes les langues couvertes par le modèle.

Mais BERTScore n'est pas *entraîné* sur des jugements de qualité humains. Il utilise des plongements pré-entraînés tels quels, ce qui signifie qu'il capture la similarité sémantique générale plutôt que d'apprendre spécifiquement ce qui fait qu'une *traduction* est bonne. Cette distinction est importante : une phrase peut être sémantiquement similaire à une référence tout en étant une mauvaise traduction (mauvais registre, négation omise, qualificatif halluciné). BERTScore hérite également des biais linguistiques existant dans le modèle sous-jacent — pour les langues sous-représentées dans les données d'entraînement de BERT, les plongements peuvent ne pas capturer de distinctions significatives.

### BLEURT (Sellam et al., 2020)

BLEURT (Bilingual Evaluation Understudy with Representations from Transformers), publié à l'ACL 2020 par Thibault Sellam, Dipanjan Das et Ankur Parikh chez Google, a introduit une innovation clé : **le pré-entraînement sur des perturbations synthétiques** avant l'ajustement fin (fine-tuning) sur des jugements humains. L'idée était que l'ajustement fin d'un modèle de langage directement sur les petits ensembles de données de jugements humains du WMT produisait une métrique fragile — elle surajustait (overfit) aux modèles spécifiques des données d'entraînement et échouait sur des entrées hors distribution.

La solution de BLEURT a été une recette d'entraînement en deux phases. Dans la première phase, des millions de paires de phrases synthétiques ont été générées par des suppressions aléatoires de mots, des insertions, des substitutions et de la rétrotraduction (backtranslation). Le modèle a été entraîné à prédire les scores des métriques automatiques existantes (BLEU, ROUGE, BERTScore, implication) pour ces paires — apprenant ainsi des notions générales de similarité textuelle. Dans la deuxième phase, le modèle pré-entraîné a été ajusté finement sur les évaluations de l'Évaluation Directe du WMT. Cet "échauffement" a considérablement amélioré la robustesse.

BLEURT-20 a étendu l'approche à l'évaluation multilingue en utilisant l'encodeur RemBERT de Google. Mais BLEURT reste basé uniquement sur la référence — il n'utilise pas le texte source, ce qui signifie qu'il ne peut pas détecter les hallucinations qui s'avèrent fluides, et il dépend entièrement de la qualité de la référence.

### COMET (Rei et al., 2020)

COMET (Crosslingual Optimized Metric for Evaluation of Translation) représente l'état de l'art actuel en matière d'évaluation automatique de la traduction automatique. Développé par Ricardo Rei et ses collègues chez **Unbabel**, COMET utilise un encodeur multilingue (XLM-RoBERTa) pour intégrer trois entrées — la phrase source, l'hypothèse de traduction automatique et la traduction de référence — et prédit un score de qualité entraîné sur les jugements de l'Évaluation Directe humaine.

COMET a remporté ou s'est classé premier dans les tâches partagées sur les métriques du WMT à partir de 2020. Sa corrélation avec le jugement humain est considérablement plus élevée que n'importe quelle métrique de correspondance de chaînes. Il reconnaît les paraphrases, capture la préservation du sens et gère les variations de synonymes qui échappent totalement à BLEU.

Mais COMET présente une limitation critique pour nos objectifs : il est entraîné sur des jugements humains du WMT, qui sont massivement dans des langues européennes. Son encodeur multilingue (XLM-R) a été entraîné sur des données CommonCrawl où le Plains Cree, le North Sámi et la plupart des langues autochtones sont pratiquement absents. Pour ces langues, les représentations internes de COMET ne sont pas fiables — il peut produire des scores, mais ces scores ne sont fondés sur aucune compréhension réelle de la structure de la langue.

### xCOMET (Guerreiro et al., 2024)

xCOMET, publié dans TACL 2024 par Nuno Guerreiro, Ricardo Rei et leurs collègues d'Unbabel et de l'Instituto Superior Técnico, a fait passer COMET d'un évaluateur boîte noire à un **outil de diagnostic**. L'innovation clé est l'apprentissage multi-tâches : parallèlement au score de qualité au niveau de la phrase, xCOMET effectue un **étiquetage de séquence au niveau des sous-mots** pour identifier des étendues d'erreurs spécifiques dans la traduction et les classer comme mineures, majeures ou critiques.

Cela comble le fossé entre l'évaluation automatique et l'analyse des erreurs humaines de type MQM. Au lieu de simplement signaler "cette traduction obtient un score de 0,73", xCOMET peut pointer les mots spécifiques qui sont incorrects et indiquer la gravité de l'erreur. L'entraînement utilise une approche d'apprentissage par curriculum : d'abord s'entraîner sur les données de l'Évaluation Directe pour la régression au niveau de la phrase, puis ajouter des données annotées MQM avec des étiquettes d'étendue d'erreur pour un entraînement conjoint.

xCOMET a atteint des performances de pointe simultanément au niveau de la phrase, au niveau du système et au niveau de l'étendue de l'erreur. Il fonctionne à la fois en mode basé sur la référence et sans référence. Mais il nécessite des données d'entraînement annotées MQM — qui sont coûteuses à créer et existent massivement pour les paires de langues européennes.

### AfriCOMET (Wang & Adelani, NAACL 2024)

AfriCOMET, publié à NAACL 2024 par Jiayi Wang, David Ifeoluwa Adelani et leurs collègues de la communauté Masakhane, est la preuve la plus importante que les métriques neuronales *doivent* être adaptées pour les langues mal desservies — elles ne se généralisent pas d'emblée.

L'article a d'abord démontré le problème : le COMET standard, entraîné sur les données WMT de langues européennes, a montré une corrélation significativement plus faible avec les jugements humains lorsqu'il a été appliqué à 13 langues africaines (dont l'amharique, le haoussa, l'igbo, le swahili, le yoruba et le zoulou). La solution a nécessité deux changements. Premièrement, remplacer XLM-R par **AfroXLM-R**, un encodeur multilingue spécifiquement entraîné pour mieux représenter les langues africaines. Deuxièmement, créer **AfriMTE**, un nouvel ensemble de données d'évaluation humaine avec des directives MQM simplifiées conçues pour des annotateurs non experts — car trouver des traducteurs professionnels bilingues pour ces langues est difficile.

AfriCOMET a prouvé le concept : une métrique neuronale spécifique à une famille de langues peut surpasser de manière spectaculaire la version générique. Mais il a également prouvé le coût : quelqu'un a dû construire AfroXLM-R, collecter des données de jugement humain pour 13 langues et entraîner un nouveau modèle. Pour le Plains Cree, il n'existe aucun encodeur équivalent, aucun ensemble de données de jugement humain, ni aucune métrique adaptée. La voie d'AfriCOMET nécessiterait de créer tout cela à partir de zéro — un effort de plusieurs années impliquant une évaluation humaine communautaire et probablement un encodeur dédié à la famille algonquienne.

### GEMBA : LLM comme évaluateur (Kocmi & Federmann, 2023)

GEMBA (GPT Estimation Metric Based Assessment), publié à l'EAMT 2023 par Tom Kocmi et Christian Federmann chez Microsoft, a posé une question radicale : et si vous *demandiez* simplement à GPT-4 si une traduction était bonne ?

L'approche est d'une simplicité désarmante. **GEMBA-DA** fournit au LLM la source et l'hypothèse et demande une évaluation de la qualité sur une échelle de 0 à 100. **GEMBA-MQM** fournit trois exemples annotés et demande au LLM d'identifier des étendues d'erreurs spécifiques, de les classer par type et par gravité, et de produire un score de type MQM. Aucun entraînement spécifique à la métrique n'est requis.

Les résultats ont été frappants : au niveau du système, GEMBA a atteint une corrélation compétitive ou de pointe avec les jugements humains. Les annotations d'erreurs de GEMBA-MQM, bien qu'elles ne soient pas aussi fiables que celles des annotateurs humains, ont fourni des informations de diagnostic interprétables sans aucun entraînement spécialisé.

Mais GEMBA soulève de sérieuses inquiétudes. Il dépend de modèles propriétaires à source fermée dont le comportement change d'une version d'API à l'autre. Les résultats ne sont pas reproductibles au sens strict. Il est coûteux à grande échelle (coûts d'API pour évaluer un ensemble de test WMT complet). Et — point critique pour nos objectifs — la connaissance qu'a le LLM des langues peu dotées est incertaine. GPT-4 peut ou non comprendre la morphologie du Plains Cree suffisamment bien pour évaluer des traductions ; il n'y a aucun moyen de le savoir sans tester, et aucune garantie que le comportement sera cohérent au fil des mises à jour du modèle. Kocmi et Federmann eux-mêmes ont déconseillé d'utiliser GEMBA pour revendiquer des améliorations dans des articles universitaires en raison de la nature de boîte noire de l'évaluation.

### MetricX et la tâche partagée sur les métriques du WMT 2024

**MetricX-24**, développé par Juraj Juraska, Daniel Deutsch, Mara Finkelstein et Markus Freitag chez Google, a remporté la tâche partagée sur les métriques du WMT 2024. Construit sur **mT5** (Multilingual T5, un modèle encodeur-décodeur plutôt que l'encodeur seul XLM-R utilisé par COMET), MetricX emprunte une voie architecturale différente. Il utilise un ajustement fin en deux étapes — d'abord sur les données de l'Évaluation Directe, puis sur les scores MQM — avec une vaste **augmentation de données synthétiques** ciblant les modes d'échec connus des métriques (sous-traduction, traductions fluides mais erronées, hallucinations).

L'article sur les conclusions du WMT 2024, intitulé **"Are LLMs Breaking MT Metrics?"**, demandait si les traductions générées par les LLM avaient brisé l'écosystème des métriques. La réponse a été un non nuancé : les métriques neuronales ajustées finement (MetricX-24, variantes de COMET) sont restées efficaces, bien que les métriques basées sur les LLM (variantes de GEMBA) aient montré une force surprenante au niveau du système. Principales conclusions :

- **Les métriques tenant compte de la source** (utilisant source + référence + hypothèse) ont systématiquement surpassé les métriques basées uniquement sur la référence
- **Les modèles hybrides** qui fonctionnent à la fois en mode basé sur la référence et sans référence à partir d'une architecture unique constituent la direction émergente
- Le **fossé des faibles ressources** persiste : toutes les métriques sont moins performantes sur les langues sous-représentées, et l'écart ne se réduit pas
- **Les métriques entraînées sur MQM** (utilisant des annotations d'erreurs à grain fin) surpassent systématiquement les métriques entraînées sur DA (utilisant des scores scalaires)

Les implications pour l'évaluation des langues peu dotées sont claires : le domaine converge vers de grandes métriques neuronales entraînées et tenant compte de la source comme référence absolue. Ces métriques nécessitent des données d'entraînement substantielles, de la puissance de calcul et — point critique — des données d'évaluation humaine dans la langue cible. Pour les langues dépourvues de toutes ces ressources, le pipeline de métriques de pointe ne s'applique tout simplement pas.

### Le problème des biais : métriques neuronales et langues peu dotées

La révolution des métriques neuronales a été, dans sa très grande majorité, un phénomène lié aux langues bien dotées. Chaque métrique entraînée dans les sections précédentes a été entraînée sur les données de jugement humain du WMT, qui couvrent environ 20 paires de langues — toutes impliquant des langues européennes, le chinois ou le japonais. Les encodeurs sous-jacents (XLM-R, mT5, InfoXLM) ont été entraînés sur des données CommonCrawl où la représentation est proportionnelle à la présence sur le web : l'anglais domine, les langues européennes sont bien couvertes, et la grande majorité des plus de 7 000 langues du monde sont effectivement absentes.

Pour une langue comme le Plains Cree, cela crée une défaillance en cascade :

1. **Aucune donnée d'entraînement** : Il n'y a pas de jugements humains WMT pour les traductions en cri, donc aucune métrique n'a été entraînée pour les évaluer.
2. **Aucune couverture de l'encodeur** : Le vocabulaire de XLM-R a été construit sur CommonCrawl, où le texte en cri est extrêmement rare. Le tokeniseur sur-segmente les mots cris en fragments d'octets arbitraires, et les plongements contextuels pour ces fragments sont mal entraînés.
3. **Aucune validation** : Personne n'a mesuré si COMET, BLEURT ou MetricX produisent des scores significatifs pour le cri. Ils peuvent produire des *nombres*, mais il n'y a aucune preuve que ces nombres soient corrélés à la qualité réelle de la traduction.
4. **Aucune voie d'amélioration** : L'approche AfriCOMET — construire un encodeur spécifique à une famille de langues, collecter des données d'évaluation humaine, entraîner une nouvelle métrique — est un effort de plusieurs années et de plusieurs institutions. Pour une communauté linguistique de 20 000 locuteurs, l'infrastructure de recherche pour soutenir cela n'existe pas actuellement.

Le résultat est un paradoxe : les langues qui ont le plus urgemment besoin d'une évaluation de la traduction automatique (parce que leurs systèmes de TA sont les plus faibles et nécessitent l'évaluation la plus minutieuse) sont précisément les langues pour lesquelles les meilleurs outils d'évaluation sont les moins fiables. La réponse du domaine a été de recommander chrF++ comme une alternative "suffisamment bonne" — et elle est meilleure que BLEU — mais chrF++ reste une métrique de correspondance de chaînes qui ne peut pas détecter l'équivalence, ne peut pas gérer l'ordre libre des mots et n'a aucun concept de validité morphologique.

---

## Partie 3 : Au-delà de la notation — Évaluation diagnostique et linguistique

### La division Adéquation/Fluidité

Avant l'existence des métriques automatiques, l'évaluation humaine de la traduction automatique utilisait un cadre à deux dimensions : **l'adéquation** (la traduction transmet-elle le sens de la source ?) et **la fluidité** (la traduction est-elle grammaticale et naturelle dans la langue cible ?). Cette distinction, codifiée dans les premières évaluations de TA de la DARPA et plus tard au NIST, reconnaissait une chose que les métriques automatiques passeraient deux décennies à essayer de retrouver : la qualité de la traduction n'est pas unidimensionnelle.

Le cadre adéquation/fluidité est tombé en disgrâce lorsque l'Évaluation Directe (un score scalaire unique) l'a remplacé au WMT. Mais l'idée sous-jacente reste essentielle : une traduction peut être fluide mais erronée (hallucination), ou peu fluide mais correcte (variante morphologique). Aucun score unique ne capture les deux.

### MQM : La référence absolue (Lommel et al., 2014 ; Freitag et al., 2021)

Les **Multidimensional Quality Metrics (MQM)** ont remplacé l'Évaluation Directe comme principale évaluation humaine du WMT à partir de 2021. MQM fait appel à des traducteurs professionnels qui marquent des étendues d'erreurs spécifiques, les classent par type (erreur de traduction, omission, ajout, grammaire, terminologie) et par gravité (mineure = 1 point, majeure = 5 points, critique = 25 points). Cela produit à la fois un score de qualité et des informations de diagnostic exploitables.

MQM est ce qui se rapproche le plus d'une méthodologie d'évaluation "correcte" — il vous dit non seulement *à quel point* une traduction est mauvaise, mais *ce qui a spécifiquement mal tourné*. Mais il nécessite des traducteurs professionnels bilingues, qui, pour la plupart des langues peu dotées, n'existent pas en nombre suffisant pour une évaluation statistiquement fiable.

### MorphEval : Évaluation morphologique contrastive (Burlot & Yvon, 2017)

MorphEval est l'art antérieur le plus direct pour l'évaluation de la traduction automatique tenant compte de la morphologie. Introduit par Franck Burlot et François Yvon au WMT 2017 et étendu en 2018, MorphEval évalue la *compétence* morphologique à l'aide de **suites de tests contrastifs**.

**Comment ça fonctionne :** La suite de tests se compose de paires de phrases dans la langue source qui diffèrent par exactement un contraste morphologique — par exemple, singulier vs pluriel, présent vs passé, masculin vs féminin. Le système de TA traduit les deux phrases. Si le système transmet correctement le contraste dans ses traductions (par exemple, en produisant une cible au pluriel lorsque la source est au pluriel et une cible au singulier lorsque la source est au singulier), le contraste est noté comme correct.

**Langues couvertes :** Anglais→Tchèque, Anglais→Letton (v1, WMT 2017) ; étendu à Anglais→Français, Anglais→Allemand, Anglais→Finnois, Turc→Anglais (v2, WMT 2018).

**Principales conclusions :** MorphEval a révélé que même les systèmes de TA neuronale les plus performants présentaient des défaillances morphologiques systématiques — ils pouvaient produire des sorties fluides tout en se trompant sur le temps, le nombre ou le cas. Ces erreurs étaient invisibles pour BLEU et même partiellement invisibles pour COMET.

**Disponibilité :** Open source sur GitHub ([franckbrl/morpheval](https://github.com/franckbrl/morpheval), [franckbrl/morpheval_v2](https://github.com/franckbrl/morpheval_v2)).

**Limites :** MorphEval nécessite des suites de tests contrastifs élaborées pour chaque langue cible, conçues par des linguistes qui comprennent les contrastes morphologiques de cette langue. Il n'existe aucune suite de tests pour aucune langue polysynthétique. La méthodologie teste la *compétence* (le système peut-il gérer ce contraste ?) plutôt que la *validité* (le système a-il produit de vrais mots ?) ou *l'équivalence* (ces deux traductions différentes sont-elles toutes deux correctes ?).

### CheckList : Tests comportementaux pour le TAL (Ribeiro et al., ACL 2020)

**CheckList**, publié à l'ACL 2020 par Marco Tulio Ribeiro et ses collègues (remportant le prix du meilleur article), a importé une idée du génie logiciel dans l'évaluation du TAL (Traitement Automatique des Langues) : **les tests unitaires**. Plutôt que d'évaluer les performances globales d'un modèle sur un benchmark, CheckList définit une matrice de **capacités** (vocabulaire, négation, entités nommées, raisonnement temporel, coréférence) croisées avec des **types de tests** :

- **Tests de fonctionnalité minimale (MFT)** : Cas de test simples et ciblés que tout modèle compétent devrait réussir.
- **Tests d'invariance (INV)** : Perturbations de l'entrée qui ne devraient *pas* modifier la sortie (par exemple, changer un nom ne devrait pas changer le sentiment).
- **Tests d'attente directionnelle (DIR)** : Perturbations qui *devraient* modifier la sortie dans une direction prévisible.

CheckList a été initialement conçu pour l'analyse de sentiments et l'inférence en langage naturel (NLI), mais le paradigme est directement applicable à la TA. On pourrait créer des MFT pour des phénomènes morphologiques ("le système produit-il la forme plurielle correcte ?"), des tests INV pour l'ordre libre des mots ("la modification de l'ordre des mots en cri change-t-elle la traduction anglaise ?") et des tests DIR pour les traits morphologiques ("le passage de la source du passé au présent change-t-il le temps de la cible ?").

Le paradigme CheckList est particulièrement pertinent car il formalise ce que MorphEval fait intuitivement : tester des capacités spécifiques plutôt que de mesurer des scores globaux. Les classes de variantes de notre linter (WORD_ORDER, ORTHOGRAPHIC, OPTIONAL_PARTICLE, etc.) sont, en effet, des règles d'invariance — elles définissent des perturbations qui ne devraient pas modifier le verdict de l'évaluation.

### Ensembles de défis et évaluation ciblée

Le paradigme plus large des **ensembles de défis (challenge sets)** — des suites de tests élaborées ciblant des phénomènes linguistiques spécifiques — est devenu une méthodologie d'évaluation complémentaire établie au WMT depuis environ 2017.

**Isabelle, Cherry & Foster (2017)**, au CNRC (Canada), ont été les pionniers de l'approche pour la TA avec des ensembles de tests créés manuellement isolant les divergences structurelles entre les langues — des cas où la traduction littérale est susceptible d'être incorrecte. Leurs travaux ultérieurs (Isabelle & Kuhn, 2018) ont construit 506 phrases en français ciblant des défis de traduction spécifiques, fournissant des images détaillées des capacités du système.

**LingEval97** (Sennrich, EACL 2017) a créé 97 000 paires de traduction contrastives Anglais→Allemand testant si les modèles de TA neuronale attribuent une probabilité plus élevée aux traductions correctes par rapport aux paires avec des erreurs morphosyntaxiques introduites. Une conclusion clé : les modèles au niveau des caractères excellaient dans la translittération mais étaient moins performants dans l'accord morphosyntaxique à longue distance.

**ACES** (Amrhein, Moghe & Guillou, 2022–2023) a considérablement mis à l'échelle l'approche des ensembles de défis : 36 476 exemples couvrant 146 paires de langues testant 68 phénomènes linguistiques distincts. ACES a été utilisé pour méta-évaluer les métriques soumises à la tâche partagée sur les métriques du WMT — testant si les *métriques* pouvaient détecter les contrastes, et non pas seulement si les *systèmes* pouvaient les produire. Étendu à **SPAN-ACES** avec des annotations d'étendues d'erreurs.

**MT-GenEval** (Currey et al., EMNLP 2022) et **WinoMT** (Stanovsky, Smith & Zettlemoyer, ACL 2019) ciblent spécifiquement l'exactitude du genre. WinoMT est remarquable car il utilise explicitement **l'analyse morphologique** sur la langue cible pour vérifier le genre des professions traduites — l'un des rares cas où un analyseur morphologique est utilisé dans le cadre d'un outil d'évaluation de la TA.

**Hjerson** (Popović & Ney, 2011) est un outil open source pour la classification automatique des erreurs de TA qui utilise **des lemmes et des étiquettes POS (parties du discours)** pour catégoriser les erreurs en cinq types : morphologiques, de réordonnancement, mots manquants, mots supplémentaires et erreurs lexicales. C'est peut-être l'art antérieur le plus proche de notre linter dans l'esprit — il utilise l'analyse linguistique pour fournir des catégories d'erreurs diagnostiques plutôt qu'un score unique.

Le fil conducteur : le domaine a reconnu, à maintes reprises, que les scores globaux sont insuffisants. L'évaluation diagnostique fournit la granularité nécessaire pour comprendre *pourquoi* un système échoue. Mais les approches diagnostiques nécessitent une expertise linguistique pour chaque langue, et cette expertise est concentrée sur les langues européennes.

### AmericasNLP : L'évaluation sur le terrain

La série d'ateliers AmericasNLP (co-localisée avec NAACL), axée sur le TAL pour les langues autochtones des Amériques, fournit le point de comparaison le plus direct pour nos défis d'évaluation.

De 2021 à 2023, la tâche partagée a utilisé **chrF** comme principale métrique d'évaluation — choisie pour sa robustesse dans les contextes de faibles ressources et sa correspondance au niveau des caractères, qui fournit un crédit partiel pour le chevauchement morphologique. Les organisateurs ont reconnu les limites de chrF mais n'avaient pas de meilleure alternative pouvant fonctionner à travers les diverses typologies représentées (quechua, guaraní, aymara, nahuatl, rarámuri et autres).

En 2025, AmericasNLP a introduit une **Tâche Partagée 3 (Shared Task 3)** dédiée spécifiquement au développement de métriques d'évaluation de la TA pour les langues autochtones — la première fois que le domaine reconnaissait explicitement que les métriques existantes sont inadéquates pour ces langues. La soumission gagnante, **FUSE** (Feature-Union Scorer), combinait des plongements de phrases multilingues (LaBSE ajusté finement), la similarité lexicale, la similarité phonétique et la correspondance floue de tokens via la régression Ridge et le Gradient Boosting. FUSE n'utilise pas d'analyseurs morphologiques — l'ingénierie des caractéristiques est indépendante de la langue.

C'est le vide que notre travail vient combler. AmericasNLP a identifié le problème (les métriques standard échouent pour les langues autochtones) et a commencé à développer des alternatives (FUSE). Mais aucune des alternatives n'utilise les connaissances morphologiques fournies par les FST. La communauté AmericasNLP utilise chrF++ parce que c'est la meilleure option générique disponible, tandis que la communauté GiellaLT construit des outils morphologiques sophistiqués qui ne sont jamais intégrés à l'évaluation de la TA. Les deux communautés n'ont pas convergé.

---

## Partie 4 : Évaluation sans référence et estimation de la qualité

Certains des signaux d'évaluation les plus importants de notre harnais ne nécessitent aucune traduction de référence. La vérification de validité FST ("est-ce un vrai mot ?") n'a besoin que de la sortie de la TA. Le détecteur d'hallucinations a besoin de la source et de l'hypothèse. Le détecteur d'alternance codique n'a besoin que de l'hypothèse et de la connaissance de l'écriture de la langue cible. Comprendre où ceux-ci s'intègrent dans le paysage plus large de l'évaluation sans référence est essentiel pour les positionner correctement.

### Le paradigme de l'estimation de la qualité

**L'estimation de la qualité (Quality Estimation - QE)** est le sous-domaine de l'évaluation de la TA concerné par la prédiction de la qualité de la traduction *sans* traductions de référence. Il s'agit d'une tâche partagée dédiée au WMT depuis 2012, motivée par le besoin pratique d'évaluer la qualité de la TA au moment du déploiement — lorsque vous traduisez un nouveau texte et que vous n'avez aucune référence humaine à laquelle le comparer.

La tâche de QE a évolué à travers trois générations. **La QE basée sur les caractéristiques** (2012–2016) extrayait des caractéristiques élaborées manuellement à partir de la source et de l'hypothèse — perplexité du modèle de langage, fréquence des mots, chevauchement des n-grammes avec des données monolingues — et entraînait des classificateurs pour prédire la qualité. **La QE neuronale** (2017–2021) a remplacé les caractéristiques manuelles par des représentations apprises, utilisant généralement des encodeurs bilingues. **La QE actuelle** (2022–présent) est dominée par des approches basées sur COMET, en particulier **CometKiwi**.

### CometKiwi et COMET sans référence

**CometKiwi** (Rei et al., WMT 2022), la variante sans référence de COMET, utilise InfoXLM pour encoder la phrase source et l'hypothèse de TA (sans référence) et prédit un score de qualité. Il a obtenu des résultats de pointe dans les tâches partagées de QE du WMT 2022 et 2023.

La découverte remarquable : CometKiwi sans référence s'approche de la corrélation avec le jugement humain obtenue par COMET basé sur la référence. Cela suggère que, pour les langues bien dotées, le texte source contient presque autant de signal d'évaluation que la traduction de référence. Mais la même mise en garde s'applique : l'encodeur de CometKiwi a une représentation minimale pour les langues peu dotées, de sorte que ses prédictions sans référence pour le cri ou le same ne sont pas fiables.

C'est là que nos métriques basées sur les FST offrent quelque chose de véritablement différent. La vérification de validité FST est un **signal de qualité déterministe et sans référence** qui ne nécessite aucun modèle entraîné ni aucune donnée de jugement humain. Si le FST dit qu'un mot n'est pas un mot cri valide, ce mot n'est pas un mot cri valide — avec la mise en garde des faux rejets pour les emprunts, les néologismes et les noms propres. Ce type de signal de qualité strict, basé sur des règles, n'a pas d'équivalent dans l'écosystème de la QE neuronale.

### Détection des hallucinations en TA

L'hallucination en TA — une sortie fluide qui n'a aucun rapport avec la source — est un mode d'échec grave, en particulier dans les contextes de faibles ressources où les modèles n'ont pas suffisamment de données d'entraînement pour apprendre des correspondances source-cible fiables.

L'état de l'art académique en matière de détection des hallucinations utilise plusieurs approches :

- **Détection basée sur les plongements** : Comparer les plongements de la source et de l'hypothèse dans un espace partagé (LASER, LaBSE) et signaler les cas où la similarité est inférieure à un seuil.
- **Détection basée sur la probabilité** : Utiliser les propres scores de confiance du modèle de TA — les hallucinations ont tendance à avoir une probabilité de sortie élevée mais une probabilité conditionnée par la source faible.
- **Perturbation contrastive** : Comparer la sortie de la TA pour la source réelle avec la sortie pour une source perturbée ou non liée ; si les sorties sont curieusement similaires, le modèle ignore la source.
- **LLM comme juge** : Demander à un LLM d'évaluer si la traduction est fidèle à la source.

Notre harnais utilise un **plugin de détection heuristique** qui combine quatre signaux : l'inflation de la longueur (hypothèse beaucoup plus longue que prévu), la répétition (phrases répétées), l'inadéquation des entités (entités nommées dans la source absentes de l'hypothèse) et l'écho de la source (l'hypothèse est trop similaire au texte source, suggérant une copie non traduite). Il s'agit d'un niveau de base par rapport à l'état de l'art académique — il détecte les hallucinations grossières mais manquera les plus subtiles. Sa valeur réside dans le fait qu'il s'agit d'un **filtre sans référence, rapide et peu coûteux** qui peut signaler les pires échecs sans nécessiter de GPU ou d'appel d'API.

### Détection de l'alternance codique

L'alternance codique (code-switching) dans la sortie de la TA — où le système produit des mots dans la langue source plutôt que de les traduire — est un mode d'échec distinct de l'hallucination. Cela se produit généralement lorsque le modèle rencontre un mot qu'il ne peut pas traduire et se rabat sur la copie de la source.

Notre plugin de détection de l'alternance codique utilise **l'analyse des blocs Unicode** (détection de caractères de l'écriture de la langue source dans ce qui devrait être une sortie dans la langue cible) et **des listes de mots courants** (identification de mots très fréquents de la langue source qui apparaissent non traduits). Pour le cri, qui utilise à la fois le SRO (basé sur le latin) et les caractères syllabiques, cela nécessite une certaine prudence — l'anglais et le SRO partagent l'alphabet latin, l'analyse des blocs Unicode seule est donc insuffisante.

La littérature académique sur la détection de l'alternance codique en TA est rare par rapport à la détection des hallucinations. La plupart des travaux se concentrent sur l'alternance codique dans le texte *d'entrée* (locuteurs bilingues mélangeant les langues) plutôt que dans le texte *de sortie* (systèmes de TA ne parvenant pas à traduire). Notre approche heuristique n'est, à notre connaissance, pas significativement en retard par rapport à tout état de l'art publié pour ce problème spécifique.

---

## Partie 5 : Le fossé morphologique

### Ce que les métriques existantes ne peuvent pas voir

C'est l'argument central de cet article, et il nécessite une démonstration concrète.

Considérez la paire de phrases en Plains Cree :

| | Texte |
|--|------|
| **Source (Anglais)** | "I saw the man" |
| **Référence (Cri)** | *nikî-wâpamâw nâpêw* |
| **Hypothèse A** | *nâpêw nikî-wâpamâw* |
| **Hypothèse B** | *nikî-wâpamikow nâpêsis* |

**L'hypothèse A** est une traduction parfaite — elle comporte les mêmes mots dans un ordre différent, ce qui est grammatical en cri (ordre libre des mots). **L'hypothèse B** signifie "le garçon a été vu par moi" — mauvaise direction de l'action (*-ikow* est inverse), mauvais référent (*nâpêsis* = "garçon", pas "homme").

| Métrique | Hypothèse A (correcte) | Hypothèse B (erronée) | Peut-elle les différencier ? |
|--------|----------------------|---------------------|------------------------|
| BLEU | ~30% | ~20% | À peine |
| chrF++ | ~65% | ~55% | Un peu |
| COMET | Inconnu (pas de données d'entraînement en cri) | Inconnu | Non fiable |
| **Acceptation FST** | 100% | 100% | Non (les deux sont du cri valide) |
| **Linter** | ÉQUIVALENT (WORD_ORDER) | ÉCHEC (MISS) | **Oui** |
| **Validateur sémantique** | VALIDE | ERRONÉ | **Oui** |

Le linter et le validateur sémantique réussissent là où BLEU, chrF++ et COMET échouent — non pas parce qu'ils sont de "meilleures métriques" dans un sens universel, mais parce qu'ils ont accès à des *connaissances linguistiques* que les métriques de correspondance de chaînes et neuronales n'ont pas. Ils savent que le cri a un ordre des mots libre. Ils savent que *wâpamêw* et *wâpamikow* sont des lemmes différents avec des structures d'arguments différentes. Ils savent que *nâpêw* et *nâpêsis* sont des mots différents.

Ces connaissances proviennent du FST (qui encode la grammaire morphologique), du dictionnaire bilingue (qui fournit des gloses en anglais pour chaque lemme) et des classes de variantes définies manuellement (qui encodent des règles d'équivalence fondées sur la linguistique). Aucune de ces connaissances n'est disponible pour une métrique qui traite la traduction comme une chaîne de caractères.

### Pourquoi le domaine ne s'est pas penché sur ce problème

Le fossé morphologique dans l'évaluation de la TA n'est pas un mystère. Le domaine sait qu'il existe. Les raisons pour lesquelles il persiste sont structurelles :

1. **Biais d'échelle.** La communauté de l'évaluation de la TA optimise pour des métriques qui fonctionnent sur toutes les paires de langues du WMT. Les métriques basées sur les FST fonctionnent pour environ 30 langues. COMET fonctionne pour plus de 100. chrF++ fonctionne pour toutes les langues dotées d'un système d'écriture. La communauté récompense l'universalité au détriment de la précision.

2. **Silos communautaires.** Les personnes qui construisent des FST (linguistes informatiques à l'UiT Tromsø, au CNRC Canada, à l'Université de l'Alberta) et les personnes qui construisent des métriques d'évaluation (chercheurs en apprentissage automatique chez Google, Unbabel, WMT) assistent à des conférences différentes, publient dans des lieux différents et opèrent sous des structures d'incitation différentes. La pollinisation croisée qui serait nécessaire pour construire des métriques d'évaluation basées sur les FST ne s'est pas produite — non pas parce qu'elle a été tentée et a échoué, mais parce que les communautés n'ont jamais convergé.

3. **Anxiété liée à la couverture.** Les FST ont des problèmes connus de faux rejets : les emprunts, les néologismes et les noms propres peuvent être rejetés comme invalides même lorsqu'ils sont parfaitement acceptables. Cela rend les chercheurs nerveux à l'idée d'utiliser les FST comme métriques — un faux rejet gonfle le taux d'erreur. L'inquiétude est valable mais quantifiable : mesurer le taux de faux rejets sur un texte connu comme étant correct est simple.

4. **Demande insuffisante.** Très peu de personnes construisent des systèmes de TA pour les langues polysynthétiques, et celles qui le font (ALT Lab, CNRC, participants à AmericasNLP) utilisent généralement chrF++ parce que c'est ce qui existe. Il n'y a pas eu de pression concertée de la part de la communauté de la TA pour les langues peu dotées en faveur d'une évaluation tenant compte de la morphologie, en partie parce que la communauté est petite et en partie parce que la construction de telles métriques nécessite une expertise à la fois en ingénierie du TAL et dans la morphologie spécifique de la langue cible.

5. **L'hypothèse de la métrique neuronale.** L'hypothèse dominante depuis 2020 est que les métriques neuronales finiront par résoudre le problème morphologique grâce à des représentations apprises. Si vous entraînez COMET sur suffisamment de données provenant de langues morphologiquement riches, selon l'argument, il apprendra à gérer la variation morphologique de manière implicite. Cela peut être vrai pour les langues morphologiquement riches bien dotées (finnois, turc, tchèque). Il est peu probable que ce soit vrai pour les langues ayant une représentation pratiquement nulle dans les données d'entraînement.

---

## Partie 6 : LYSS — Une alternative fondée sur la linguistique

### Ce que Champollion a construit : LYSS (Linguistically-informed Yield & Structural Scoring)

Le harnais d'évaluation du projet Champollion implémente un cadre de notation composite appelé **LYSS** qui combine des métriques standard (chrF++, correspondance exacte) avec quatre catégories de métriques linguistiquement informées. Le nom reflète l'objectif du cadre : mesurer le *rendement* (yield - quelle part du sens survit au processus de traduction) par le biais d'une *notation structurelle* (structural scoring - des vérifications déterministes et fondées sur la linguistique plutôt que des plongements appris).

#### 1. Porte de validité morphologique (Métrique FST GiellaLT)

La métrique la plus simple et la plus largement applicable : faire passer chaque mot de la sortie de la TA par l'analyseur morphologique à états finis GiellaLT pour la langue cible. Si le FST peut analyser un mot (renvoie au moins une analyse), le mot est morphologiquement valide. Sinon, le mot n'existe pas dans la langue cible — il s'agit soit d'un mot halluciné, d'une erreur morphologique, d'une faute d'orthographe ou d'un emprunt qui n'est pas dans le lexique.

**Sortie :** `fst_validity_rate` (0.0–1.0, plus élevé = meilleur). Macro-moyenne (moyenne des taux par entrée) et micro-moyenne (total des mots valides / total des mots).

**Dépendances :** `pyhfst` (liaisons Python pour Helsinki Finite-State Technology), un fichier d'analyseur `.hfstol` compilé pour la langue cible.

**Extensibilité :** Fonctionne pour toute langue disposant d'un analyseur FST GiellaLT — actuellement plus de 30 langues, principalement les langues sames, ouraliennes et autochtones de l'Arctique.

**Relation avec l'art antérieur :** MorphEval teste si un système peut gérer des contrastes spécifiques. La métrique FST teste si la sortie du système est constituée de vrais mots. Ces approches sont complémentaires : MorphEval teste la compétence, la métrique FST teste la validité.

#### 2. Classes d'équivalence linguistique (Linter CRK)

Le linter s'attaque à ce qui est peut-être le mode d'échec le plus insidieux de l'évaluation basée sur la référence : **pénaliser les traductions correctes qui diffèrent de la référence**.

Le linter pour le Plains Cree (844 lignes) implémente six **classes de variantes**, chacune encodant une règle d'équivalence fondée sur la linguistique :

- **WORD_ORDER** : Le cri a un ordre des mots pragmatiquement libre (Wolfart, 1973 §3.2). *nikî-wâpamâw nâpêw* et *nâpêw nikî-wâpamâw* signifient la même chose. Le linter génère toutes les permutations et vérifie si l'hypothèse correspond à l'une d'entre elles.
- **ORTHOGRAPHIC** : L'orthographe romaine standard (SRO) présente des points de variation connus — accent circonflexe vs macron (*â* vs *ā*), trait d'union des préverbes (*nikî-nipâw* vs *nikî nipâw* vs *nikînipâw*). Le linter les normalise.
- **OPTIONAL_PARTICLE** : Certaines particules de discours (*mâka*, *êkwa*, *êwako*) peuvent être présentes ou absentes sans modifier la proposition centrale. Le linter vérifie si l'hypothèse correspond à la référence après la suppression des particules.
- **LEMMA_SYNONYM** : Certains lemmes cris sont interchangeables dans des contextes spécifiques. Cela utilise une liste de synonymes organisée (par exemple, des variantes dialectales) et, lorsque le FST est disponible, vérifie si l'hypothèse et la référence partagent des analyses morphologiques.
- **PROGRESSIVE_AMBIGUITY** : Les formes progressives anglaises ("is walking") peuvent être traduites en cri en utilisant différentes constructions. Le linter les reconnaît comme équivalentes.
- **INCLUSIVE_EXCLUSIVE** : Le cri distingue le "nous" inclusif (préfixe *ki-*) du "nous" exclusif (préfixe *ni-*) — une distinction que l'anglais réduit à un seul pronom. Le linter reconnaît que l'une ou l'autre forme peut être correcte lorsque la source anglaise est ambiguë.

Le linter produit trois verdicts : **EXACT** (l'hypothèse correspond à la référence), **EQUIVALENT** (l'hypothèse diffère mais est classée comme une variante valide), ou **MISS** (aucune correspondance trouvée). Au niveau global, il calcule un `equivalent_match_rate` — la proportion de traductions qui sont exactes ou équivalentes.

**Relation avec l'art antérieur :** Le parallèle le plus proche est **HyTER** (Dreyer & Marcu, NAACL-HLT 2012), qui encode un nombre exponentiel de traductions valides sous forme de réseaux de paraphrases et mesure la distance d'édition jusqu'à la forme valide la plus proche. Notre linter est conceptuellement similaire — il définit un ensemble de traductions valides pour chaque référence — mais utilise des règles de transformation définies linguistiquement plutôt que des bases de données de paraphrases. HyTER a été conçu pour l'anglais ; personne n'a construit de réseaux de paraphrases pour le cri. Nos classes de variantes sont, en effet, une approximation compacte et basée sur des règles de ce que HyTER fait avec des graphes.

Dans le cadre CheckList, nos classes de variantes fonctionnent comme des **tests d'invariance** : des transformations qui ne devraient pas modifier le verdict de l'évaluation. La différence est que les tests CheckList sont généralement appliqués au *modèle* ; nos règles de variantes sont appliquées à la *métrique*.

#### 3. Validation sémantique déterministe (Métrique sémantique CRK)

Le validateur sémantique (792 lignes) tente quelque chose de plus ambitieux : **une comparaison de sens déterministe** sans plongements neuronaux. Il fonctionne en quatre étapes :

1. **Analyse morphologique** : L'hypothèse et la référence sont toutes deux passées par l'analyseur FST CRK, qui renvoie le lemme et les traits morphologiques pour chaque mot.
2. **Résolution des gloses** : Chaque lemme est recherché via l'API du dictionnaire itwêwina — qui sert Wolvengrey (2001) aux côtés des dictionnaires de Maskwacîs et des Aînés de l'Alberta — pour obtenir des gloses en anglais.
3. **Extraction des mots de contenu** : En utilisant le pipeline anglais de spaCy (`en_core_web_md`), les mots grammaticaux sont filtrés à la fois des gloses anglaises et du texte source.
4. **Notation du chevauchement** : Le chevauchement des mots de contenu entre les gloses de l'hypothèse et les gloses de la référence détermine le verdict sémantique.

Le validateur produit des verdicts catégoriques : **EXACT_MATCH**, **VALID** (mots différents mais même sens), **GRAMMAR_ISSUES** (lemmes corrects mais problèmes de grammaire au niveau de la phrase — accord, animacité, forme verbale), **PARTIAL** (une partie du sens est préservée), **INCOMPLETE** (le sens est partiellement manquant), **WRONG** (sens différent), ou **NO_OUTPUT**.

**Relation avec l'art antérieur :** Il s'agit, en effet, d'une **approximation déterministe du calcul de similarité sémantique de COMET**. Là où COMET utilise des plongements multilingues appris pour évaluer si deux phrases signifient la même chose, notre validateur utilise une chaîne de recherches déterministes : FST → dictionnaire → spaCy. L'avantage est la transparence (chaque étape est inspectable et déterministe) et l'indépendance vis-à-vis des données d'entraînement. L'inconvénient est la fragilité : la qualité de l'évaluation dépend entièrement de la couverture du FST et de l'exhaustivité du dictionnaire.

L'approche est conceptuellement liée à **MEANT** (Lo & Wu, 2011 ; Lo, 2017), qui utilisait l'étiquetage des rôles sémantiques pour évaluer si la structure "qui a fait quoi à qui" était préservée dans la traduction. Notre approche est plus grossière (chevauchement des mots de contenu plutôt que rôles sémantiques) mais opère sur une langue où il n'existe aucun outil d'étiquetage des rôles sémantiques (SRL).

#### 4. Plugins de détection comportementale (Hallucination, Alternance codique, Terminologie)

Trois plugins supplémentaires fournissent des **signaux de qualité comportementale** qui complètent les métriques morphologiques :

- **Détection des hallucinations** (259 lignes) : Quatre signaux heuristiques pondérés et combinés — inflation de la longueur (40 %), répétition (30 %), inadéquation des entités (20 %), écho de la source (10 %). Ce sont des filtres sans référence et peu coûteux qui détectent les fabrications grossières.
- **Détection de l'alternance codique** (~280 lignes) : Analyse des blocs Unicode plus listes de mots courants pour détecter les tokens non traduits de la langue source. Produit un `code_switching_rate` (0.0–1.0).
- **Respect de la terminologie** (199 lignes) : Vérifie si les termes du glossaire spécifiés sont traduits de manière cohérente. Renvoie `terminology_adherence` (0.0–1.0) ou None si aucun glossaire n'est configuré.

Ces plugins sont honnêtement positionnés comme des **détecteurs heuristiques de base**, et non comme l'état de l'art. Leur valeur réside dans la fourniture de signaux peu coûteux, rapides et interprétables qui peuvent être calculés parallèlement aux métriques morphologiques plus sophistiquées. Dans le cadre de notation composite, ils ont des poids faibles (0,05 chacun).

### Limites honnêtes

Cette approche présente des limites importantes qui doivent être reconnues avant toute revendication de nouveauté ou d'utilité :

1. **Taux de faux rejets du FST.** Le FST rejettera les mots valides qui ne sont pas dans son lexique — emprunts, néologismes, noms propres, termes à code mixte. Cela gonfle le taux d'erreur morphologique. Le taux de faux rejets n'a pas été formellement mesuré sur un corpus représentatif de textes en cri. Sans cette mesure, la précision de la métrique de validité FST est inconnue.

2. **Couverture du dictionnaire.** La qualité du validateur sémantique dépend entièrement de la couverture du dictionnaire Wolvengrey. Les mots cris qui ne figurent pas dans le dictionnaire ne produisent aucune glose, ce que le validateur traite comme une lacune de sens. Le dictionnaire contient environ 18 000 à 22 000 entrées (les comptes varient selon l'édition et la méthode de comptage) — ce qui est substantiel, mais pas exhaustif.

3. **Exhaustivité des classes de variantes.** Les six classes de variantes du linter ont été conçues sur la base de la littérature linguistique et de l'observation des modèles de sortie de la TA. Il peut y avoir des classes d'équivalence supplémentaires non capturées — variations dialectales, différences de registre, synonymes au niveau du discours. Aucun processus formel ne garantit l'exhaustivité.

4. **Aucune étude de corrélation humaine.** La lacune la plus critique : personne n'a mesuré si les verdicts du linter (EXACT/EQUIVALENT/MISS) ou les verdicts du validateur sémantique sont corrélés aux jugements humains sur la qualité de la traduction. Les métriques neuronales passent des années à établir une corrélation avec l'évaluation humaine (tâches partagées du WMT). Nos métriques n'ont aucune validation de ce type.

5. **Spécificité de la langue.** Les classes de variantes, les listes de synonymes et les règles de particules facultatives sont spécifiques au Plains Cree. Les porter vers le North Sámi, l'inuktitut ou toute autre langue nécessite des linguistes qui comprennent la morphologie, la flexibilité de l'ordre des mots et la variation orthographique de cette langue. Le *cadre* est portable ; les *règles* ne le sont pas.

6. **Lacunes dans le câblage des métriques.** Au moment de la rédaction de ce document, quatre des neuf métriques du profil de notation composite (semantic_score, morphological_accuracy, equivalent_match_rate, orthographic_accuracy) ont un câblage de plugin incomplet ou peu clair dans le harnais de l'arène. Le score composite est effectivement calculé à partir d'environ cinq métriques avec des poids redistribués.

### Ce qui serait nécessaire pour valider cette approche

Pour rendre ce travail publiable — dans n'importe quel lieu, à n'importe quel niveau de sérieux académique — les expériences suivantes seraient nécessaires :

1. **Étude de corrélation avec le jugement humain.** Collecter des évaluations humaines de la qualité pour un ensemble de traductions Anglais→Cri (idéalement plus de 200 paires de phrases évaluées par plus de 3 locuteurs bilingues). Calculer les corrélations entre les scores humains et chacune de nos métriques. C'est la validation la plus importante. Sans elle, les métriques sont des artefacts d'ingénierie, pas des outils d'évaluation.

2. **Mesure du taux de faux rejets du FST.** Exécuter l'analyseur FST sur un corpus de textes en cri connus comme étant corrects (par exemple, des textes en cri publiés, des corpus parallèles validés) et mesurer quel pourcentage de mots valides est rejeté. Cela quantifie la précision de la métrique de validité FST.

3. **Validation sur une deuxième langue.** Porter la métrique de validité FST vers une deuxième langue GiellaLT (très probablement le North Sámi, qui possède l'analyseur FST le plus mature de l'écosystème GiellaLT). Démontrer que la métrique produit des résultats sensés sur la sortie de la TA en same. Cela valide la revendication d'extensibilité.

4. **Comparaison avec COMET.** Exécuter COMET sur les mêmes données en cri et comparer ses scores avec nos métriques et avec les jugements humains. Si COMET produit des scores significatifs pour le cri (ce dont nous doutons, mais que nous n'avons pas testé), nos métriques doivent le surpasser pour être utiles. Si COMET produit du bruit (ce à quoi nous nous attendons), cela valide la nécessité de notre approche.

5. **Complément diagnostique MorphEval.** Construire une petite suite de tests de type MorphEval (50 à 100 contrastes) pour le Plains Cree ciblant les caractéristiques morphologiques les plus distinctives de la langue (obviatif, inverse, ordre conjoint/indépendant, inclusif/exclusif). Exécuter les systèmes de TA sur cette suite et montrer que les informations de diagnostic sont exploitables.

6. **Audit de câblage et d'intégration.** Corriger les lacunes de câblage du profil de notation identifiées dans l'inventaire de la base de code. S'assurer que les neuf métriques composites produisent des valeurs et que le score global est calculé correctement.

---

## Partie 7 : Positionnement et travaux futurs

### Où se situe LYSS dans le paysage de l'évaluation

Une taxonomie des approches d'évaluation de la TA, positionnée honnêtement :

| Dimension | Métriques de chaînes (BLEU, chrF++) | Métriques neuronales (COMET, MetricX) | LLM comme juge (GEMBA) | Diagnostique (MorphEval, CheckList) | **LYSS** |
|-----------|-------------------------------|---|----|-------|--------|
| Type de signal | Chevauchement de surface | Similarité sémantique apprise | Jugement ouvert | Sondes de capacités ciblées | Validité morphologique + équivalence basée sur des règles |
| Données d'entraînement nécessaires | Aucune | Jugements humains (des milliers) | LLM pré-entraîné | Suites de tests conçues par des linguistes | FST + dictionnaire + règles de variantes |
| Applicabilité aux langues peu dotées (LRL) | Universelle mais faible | Limitée par la couverture de l'encodeur | Limitée par la couverture du LLM | Limitée par la création de suites de tests | Limitée par la disponibilité du FST (~30 langues) |
| Référence nécessaire | Oui | Oui (ou QE source uniquement) | Facultatif | Oui (contrastif) | Oui (LYSS-eq/LYSS-sem) / Non (LYSS-fst) |
| Interprétabilité | Faible (un nombre) | Faible (un nombre) | Élevée (justification textuelle) | Élevée (réussite/échec par phénomène) | Élevée (verdicts + classes de variantes) |

**LYSS n'est pas** : un remplacement de COMET pour les langues bien dotées, une métrique universelle, ou la première évaluation tenant compte de la morphologie.

**LYSS est** : un cadre intégré qui combine la validation morphologique basée sur les FST avec des métriques standard pour le cas spécifique des langues où les métriques neuronales manquent de couverture et où des outils basés sur des règles (FST, dictionnaires) existent. Il comporte trois composants principaux :
- **LYSS-fst** — Validité morphologique via FST (`fst_acceptance_rate`)
- **LYSS-eq** — Équivalence linguistique via le linter (`equivalent_match_rate`)
- **LYSS-sem** — Validation sémantique déterministe (`semantic_score`)

**LYSS étend** : l'idée centrale de MorphEval (utiliser des outils morphologiques pour l'évaluation) du test de compétence diagnostique à la notation continue de la qualité.

**LYSS complète** : chrF++ (qui accorde un crédit partiel pour les morphèmes partagés mais ne peut pas détecter l'équivalence), COMET (qui opère dans l'espace sémantique mais manque de données d'entraînement pour les langues peu dotées) et FUSE (qui utilise l'ingénierie des caractéristiques mais pas d'analyseurs morphologiques).

**L'art antérieur le plus proche est** : Hjerson (classification des erreurs linguistiques) + HyTER (classes d'équivalence via des réseaux de paraphrases) + la métrique de couverture naïve d'Apertium (vérification de validité basée sur les FST). La contribution de LYSS n'est pas une technique unique mais l'intégration de ces idées — en particulier la validité basée sur les FST et l'équivalence basée sur des règles — dans un harnais d'évaluation fonctionnel pour une langue polysynthétique.

### Intégration de MorphEval

La méthodologie de la suite de tests contrastifs de MorphEval et notre approche de notation continue sont complémentaires :

- **MorphEval** répond à : "Ce système peut-il gérer le marquage du temps ? L'accord en nombre ? L'attribution des cas ?"
- **Notre métrique FST** répond à : "Ce système a-t-il produit de vrais mots ?"
- **Notre linter** répond à : "Cette traduction est-elle équivalente à la référence malgré des différences de surface ?"
- **Notre validateur sémantique** répond à : "Cette traduction a-t-elle le bon sens ?"

MorphEval est open source. La création d'une suite de tests pour le Plains Cree nécessiterait qu'un linguiste conçoive des paires contrastives couvrant les contrastes morphologiques spécifiques au cri (obviation, marquage inverse, ordre conjoint/indépendant, "nous" inclusif/exclusif, chaînes de préverbes). Il s'agit d'un travail substantiel mais délimité — des semaines, pas des mois — et cela fournirait une capacité de diagnostic qu'aucun autre outil d'évaluation n'offre pour le cri.

### La question de l'extensibilité

Quelles autres langues pourraient adopter cette approche ? La principale contrainte est la disponibilité des FST. L'infrastructure GiellaLT fournit des analyseurs morphologiques pour plus de 30 langues, principalement dans trois familles :

- **Langues sames** (North Sámi, Lule Sámi, South Sámi, Skolt Sámi, Inari Sámi) : FST matures avec une large couverture. Le North Sámi est la cible la plus immédiatement portable.
- **Langues ouraliennes** (finnois, estonien, komi, erzya, mokcha) : Analyseurs bien développés, bien que le finnois et l'estonien puissent ne pas avoir un besoin aussi urgent d'une évaluation basée sur les FST (ils ont une plus grande couverture par les métriques neuronales).
- **Langues autochtones de l'Arctique** (inuktitut via Uqailaut, groenlandais) : Des analyseurs existent mais la couverture varie.
- **Autres langues GiellaLT** : Féroïen, irlandais, cornique, live et d'autres avec des niveaux variables de maturité des FST.

Au-delà de GiellaLT, la plateforme **Apertium** fournit des analyseurs morphologiques pour environ plus de 40 paires de langues. L'écosystème **HFST** (Helsinki Finite-State Technology) est l'infrastructure partagée qu'utilisent à la fois GiellaLT et Apertium, ce qui signifie que tout analyseur Apertium pourrait en principe être intégré à la même métrique de validité FST.

La contrainte pratique n'est pas la disponibilité des FST mais **la curation des classes de variantes**. Les règles d'équivalence du linter nécessitent une expertise linguistique pour chaque langue cible. Pour le North Sámi, cela nécessiterait de comprendre la flexibilité de l'ordre des mots same, les conventions orthographiques et les variations dialectales. Pour l'inuktitut, cela nécessiterait de comprendre la morphologie polysynthétique à un niveau comparable à ce qui a été fait pour le cri. La métrique de validité FST, cependant, peut être déployée immédiatement pour toute langue disposant d'un analyseur GiellaLT — aucun travail linguistique supplémentaire n'est requis.

### Vers un article

Une publication basée sur ce travail ciblerait le plus naturellement l'un de ces lieux :

- **WMT Metrics Shared Task** (co-localisée avec EMNLP) : Le lieu le plus direct. Nécessiterait d'implémenter les métriques en tant que soumission à une tâche partagée et de les évaluer sur les ensembles de tests du WMT — qui n'incluent actuellement aucune langue polysynthétique. Pourrait être soumis en tant qu'article de "conclusions" (findings) ou participer à la sous-tâche des ensembles de défis.
- **LREC-COLING** (Language Resources and Evaluation Conference) : Choix naturel pour un article sur les ressources/outils décrivant le cadre d'évaluation et les ressources linguistiques qu'il utilise (FST, dictionnaires, règles de variantes).
- **ACL ou NAACL** (conférence principale) : Nécessiterait l'étude de corrélation humaine et au moins une langue supplémentaire pour atteindre le niveau d'exigence d'un article de conférence principale.
- **Atelier AmericasNLP** : Le public le plus réceptif pour l'évaluation de la TA des langues autochtones. Niveau d'exigence de publication plus bas, mais fort impact au sein de la communauté cible.
- **ComputEL** (Computational Approaches to Endangered Languages) : Lieu ciblé pour exactement ce type de travail.

Toute publication nécessiterait des co-auteurs ayant une expertise en linguistique crie (pour valider les classes de variantes et interpréter les résultats) et idéalement des locuteurs bilingues cris (pour fournir les évaluations humaines de la qualité pour l'étude de corrélation). Ce n'est pas facultatif — un article sur l'évaluation de la TA en cri écrit entièrement par des non-locuteurs du cri serait, au mieux, incomplet, et au pire, une continuation des dynamiques de recherche extractives que le domaine essaie de dépasser.

---

## Annexe A : Matrice des exigences des métriques

| Métrique | Référence nécessaire ? | Source nécessaire ? | Modèle entraîné ? | Ressources spécifiques à la langue ? | Fonctionne pour les LRL ? |
|--------|-------------------|---------------|----------------|------------------------------|----------------|
| BLEU | Oui | Non | Non | Non | Médiocrement |
| chrF++ | Oui | Non | Non | Non | Mieux que BLEU |
| METEOR | Oui | Non | Non | Raciniseur + WordNet | Seulement si les ressources existent |
| TER | Oui | Non | Non | Non | Identique à BLEU |
| BERTScore | Oui | Non | Oui (mBERT) | Non | Dépend de la couverture du modèle |
| BLEURT | Oui | Non | Oui (entraîné) | Non | Dépend des données d'entraînement |
| COMET | Oui | Oui | Oui (XLM-R) | Non | Dépend de la couverture de XLM-R |
| CometKiwi | Non | Oui | Oui (XLM-R) | Non | Dépend de la couverture de XLM-R |
| GEMBA | Facultatif | Oui | Oui (LLM) | Non | Dépend de la couverture du LLM |
| **Acceptation FST** | **Non** | **Non** | **Non** | **Oui (Analyseur FST)** | **Oui, si le FST existe** |
| **Linter CRK** | **Oui** | **Non** | **Non** | **Oui (FST + règles de variantes)** | **Oui, si les ressources existent** |
| **Sémantique CRK** | **Oui** | **Facultatif** | **Non** | **Oui (FST + dictionnaire + spaCy)** | **Oui, si les ressources existent** |
| Dét. d'hallucinations | Non | Oui | Non | Non | Oui |
| Dét. d'alternance codique | Facultatif | Oui | Non | Minimales | Oui |
| MorphEval | Oui (contrastif) | Oui | Non | Oui (suite de tests + analyseur) | Seulement si la suite de tests existe |

## Annexe B : Articles clés

| Citation | Lieu | Pertinence |
|----------|-------|-----------|
| Papineni et al. (2002). BLEU: a Method for Automatic Evaluation of Machine Translation | ACL 2002 | La métrique qui a défini le domaine |
| Doddington (2002). Automatic Evaluation of Machine Translation Quality Using N-gram Co-Occurrence Statistics | HLT 2002 | Correspondance de n-grammes pondérée par l'information |
| Banerjee & Lavie (2005). METEOR: An Automatic Metric for MT Evaluation | Atelier ACL 2005 | Racinisation, synonymes, alignement de mots |
| Snover et al. (2006). A Study of Translation Edit Rate | AMTA 2006 | Distance d'édition avec déplacements de phrases |
| Popović & Ney (2011). Morphemes and POS tags for n-gram based evaluation metrics | WMT 2011 | Classification des erreurs Hjerson |
| Dreyer & Marcu (2012). HyTER: Meaning-Equivalent Semantics for Translation Evaluation | NAACL-HLT 2012 | Classes d'équivalence via des réseaux de paraphrases |
| Lommel et al. (2014). Multidimensional Quality Metrics | — | Typologie des erreurs MQM |
| Popović (2015). chrF: character n-gram F-score for automatic MT evaluation | WMT 2015 | Évaluation au niveau des caractères |
| Popović (2017). chrF++: words helping character n-grams | WMT 2017 | Évaluation des n-grammes de caractères + mots |
| Burlot & Yvon (2017). Evaluating the Morphological Competence of Machine Translation Systems | WMT 2017 | Suites de tests morphologiques contrastifs |
| Sennrich (2017). How Grammatical is Character-level Neural Machine Translation? | EACL 2017 | Paires contrastives LingEval97 |
| Isabelle, Cherry & Foster (2017). A Challenge Set Approach to Evaluating Machine Translation | EMNLP 2017 | Test ciblé des divergences structurelles |
| Post (2018). A Call for Clarity in Reporting BLEU Scores | WMT 2018 | Standardisation sacreBLEU |
| Reiter (2018). A Structured Review of the Validity of BLEU | Computational Linguistics | Méta-analyse de la corrélation de BLEU avec le jugement humain |
| Stanovsky, Smith & Zettlemoyer (2019). Evaluating Gender Bias in Machine Translation | ACL 2019 | Évaluation du genre WinoMT |
| Ribeiro et al. (2020). Beyond Accuracy: Behavioral Testing of NLP Models with CheckList | ACL 2020 (Meilleur article) | Tests unitaires basés sur les capacités pour le TAL |
| Zhang et al. (2020). BERTScore: Evaluating Text Generation with BERT | ICLR 2020 | Similarité sémantique basée sur les plongements |
| Sellam et al. (2020). BLEURT: Learning Robust Metrics for Text Generation | ACL 2020 | Métrique pré-entraînée + ajustée finement |
| Rei et al. (2020). COMET: A Neural Framework for MT Evaluation | EMNLP 2020 | Évaluation trilingue multilingue |
| Freitag et al. (2021). Results of the WMT 2021 Metrics Shared Task | WMT 2021 | Méta-évaluation basée sur MQM |
| Thompson & Post (2020). PRISM: Automatic MT Evaluation via Zero-Shot Paraphrasing | EMNLP 2020 | TA neuronale multilingue comme évaluateur de paraphrases |
| Currey et al. (2022). MT-GenEval | EMNLP 2022 | Exactitude contrefactuelle du genre |
| Amrhein et al. (2022). ACES: Translation Accuracy Challenge Sets | WMT 2022 | 68 phénomènes, 146 paires de langues |
| Kocmi & Federmann (2023). GEMBA: Large Language Models Are State-of-the-Art Evaluators | EAMT 2023 | LLM comme évaluateur |
| Guerreiro et al. (2024). xCOMET: Transparent MT Evaluation through Fine-grained Error Detection | TACL 2024 | Détection des étendues d'erreurs |
| Wang & Adelani (2024). AfriMTE and AfriCOMET | NAACL 2024 | Métriques neuronales pour les langues africaines |
| Juraska et al. (2024). MetricX-24 | WMT 2024 | Métrique gagnante basée sur mT5 |

## Annexe C : Glossaire des termes d'évaluation

| Terme | Définition |
|------|------------|
| **Adéquation (Adequacy)** | Si une traduction transmet le sens de la source. |
| **Fluidité (Fluency)** | Si une traduction est grammaticale et naturelle dans la langue cible. |
| **Évaluation Directe (DA)** | Méthode d'évaluation humaine où les annotateurs évaluent les traductions sur une échelle de 0 à 100. |
| **MQM** | Multidimensional Quality Metrics — évaluation humaine basée sur les étendues d'erreurs avec des gravités typées. |
| **Estimation de la qualité (QE)** | Prédiction de la qualité de la traduction sans traduction de référence. |
| **FST** | Transducteur à états finis (Finite-State Transducer) — un dispositif informatique qui encode les règles morphologiques d'une langue. |
| **GiellaLT** | Infrastructure pour la technologie linguistique basée sur des règles, principalement pour les langues sames et d'autres langues de l'Arctique. |
| **HFST** | Helsinki Finite-State Technology — le cadre logiciel sous-jacent à GiellaLT et Apertium. |
| **SRO** | Orthographe romaine standard (Standard Roman Orthography) — le système d'écriture basé sur le latin pour le Plains Cree. |
| **Syllabique** | Syllabaire autochtone canadien — un système d'écriture abugida utilisé pour le cri et d'autres langues algonquiennes. |
| **Polysynthétique** | Un type de langue où un seul mot peut encoder l'équivalent d'une phrase entière en anglais grâce à une affixation extensive. |
| **Obviation** | Une catégorie grammaticale dans les langues algonquiennes qui distingue deux référents à la troisième personne. |
| **Inverse** | Une catégorie de type voix dans les langues algonquiennes marquant que le patient surclasse l'agent dans la hiérarchie d'animacité. |
| **WMT** | Conference on Machine Translation — le lieu principal pour les tâches partagées et l'évaluation de la TA. |
| **Évaluation contrastive** | Tester si un système peut distinguer des entrées minimalement différentes qui nécessitent des sorties différentes. |
| **Ensemble de défis (Challenge set)** | Une suite de tests élaborée ciblant des phénomènes linguistiques spécifiques. |
| **Classe d'équivalence** | Un ensemble de formes de surface différentes qui représentent le même sens et devraient recevoir le même score d'évaluation. |

## Où cela mène-t-il sur ce site

Les propres réponses de Champollion aux problèmes catalogués ici sont la [Spécification de notation](/docs/network/specifications/scoring) (quelle métrique compte, et quand), la [Fiabilité des métriques](/docs/network/specifications/metric-reliability) (à quelle métrique se fier par langue cible), et le [Cadre de conception de corpus](/docs/network/specifications/corpus-design) (comment un ensemble de tests gagne le droit d'être cru).
