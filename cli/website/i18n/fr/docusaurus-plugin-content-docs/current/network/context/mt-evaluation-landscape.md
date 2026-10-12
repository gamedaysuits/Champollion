---
sidebar_position: 3
title: "Mesurer l'incommensurable"
---

# Mesurer l'incommensurable : le problème de l'évaluation en traduction automatique

**Un état des lieux sur la manière dont le domaine mesure la qualité de la traduction, ses défaillances et ce que LYSS (Linguistically-informed Yield & Structural Scoring) propose comme alternative**

---

> *« Les métriques automatiques sont un mensonge commode. Elles nous donnent un chiffre, ce chiffre nous permet de rédiger un article, et cet article nous permet de revendiquer des progrès. Savoir si de réels progrès ont été accomplis est une tout autre question. »*
> — Adapté d'un sentiment récurrent lors des WMT Metrics Shared Tasks

---

## Introduction

La traduction automatique a un problème de mesure.

Le domaine a passé deux décennies à concevoir des systèmes de plus en plus sophistiqués — des tables de syntagmes aux mécanismes d'attention, jusqu'aux modèles de langage de plusieurs billions de paramètres — et tout au long de cette trajectoire, il s'est heurté à une question d'une simplicité trompeuse : *comment savoir si une traduction est bonne ?*

Cette question n'est pas purement académique. La métrique que vous choisissez détermine quel système « gagne ». Elle détermine ce qui est financé, ce qui est publié, ce qui est déployé et — pour les langues qui ont le plus grand besoin de TA — si les traductions d'une communauté sont jugées comme des échecs alors qu'elles sont, en réalité, parfaitement correctes.

L'histoire de l'évaluation de la TA est, en miniature, une histoire des valeurs du domaine. La domination de BLEU pendant près de deux décennies révèle une préférence pour une mesure peu coûteuse, rapide et indépendante de la langue, au détriment d'une évaluation éclairée par la linguistique. L'essor des métriques neuronales comme COMET reflète la sophistication croissante du domaine — ainsi que sa dépendance continue envers des données d'entraînement centrées sur l'anglais. L'absence quasi totale d'évaluation sensible à la morphologie témoigne d'une discipline qui a été, jusqu'à récemment, bâtie par et pour des locuteurs de langues analytiques européennes.

Cet article retrace l'évolution de l'évaluation de la TA, de BLEU jusqu'à nos jours, met en évidence les défaillances systématiques des approches existantes face aux langues morphologiquement complexes et à faibles ressources, et examine à quoi pourrait ressembler une alternative linguistiquement fondée. Il constitue un complément aux autres documents contextuels du projet — [*De Pāṇini aux Transformers*](./history-of-language-and-computation.md) (qui retrace l'histoire intellectuelle du langage et du calcul) et le [*Tour d'horizon du domaine*](./mt-field-briefing.md) (qui dresse un panorama du paysage actuel de la TA). Là où ces documents s'interrogent sur « comment en sommes-nous arrivés là ? » et « qu'est-ce qui existe ? », celui-ci pose la question : « comment savons-nous si tout cela fonctionne réellement ? »

---

## Partie 1 : L'ère de la comparaison de chaînes (2002–2015)

### BLEU et la naissance de l'évaluation automatique



L'ère moderne de l'évaluation de la TA s'ouvre avec un article fondateur : « BLEU: a Method for Automatic Evaluation of Machine Translation », publié à l'ACL 2002 par Kishore Papineni, Salim Roukos, Todd Ward et Wei-Jing Zhu. BLEU (Bilingual Evaluation Understudy) mesure le degré de chevauchement entre les séquences de mots (n-grammes) d'une traduction automatique et une ou plusieurs traductions humaines de référence. Elle applique une pénalité de brièveté pour éviter que les systèmes ne biaisent le score avec des sorties courtes, et calcule une moyenne géométrique des précisions des n-grammes d'ordres 1 à 4.

BLEU est devenue la référence incontournable du domaine pour une raison très simple : elle était rapide, économique, reproductible et indépendante de la langue. Avant BLEU, l'évaluation d'un système de TA nécessitait une évaluation humaine, à la fois lente et onéreuse. BLEU a apporté un score numérique calculable en quelques millisecondes, comparable d'un article à l'autre et utilisable pour classer les systèmes lors des compétitions d'évaluation. En quelques années, elle est devenue incontournable — un article scientifique sans scores BLEU était tout simplement impubliable.

Cependant, BLEU présente des faiblesses profondes et amplement documentées, que la communauté s'est efforcée de contourner pendant deux décennies :

**Absence de compréhension sémantique.** BLEU repose sur une simple correspondance de surface. « The cat sat on the mat » reçoit un score nul face à la référence « the feline rested on the rug ». Chaque mot est un synonyme exact ; le sens est rigoureusement identique ; le score reste à zéro.

**Cécité morphologique.** Pour les langues agglutinantes et polysynthétiques, la comparaison stricte mot à mot échoue lamentablement. Un verbe cri correctement conjugué qui ne diffère de la référence que d'un seul morphème reçoit un score nul — même si cette différence n'est qu'une particule grammaticalement facultative ou un ordre des mots tout aussi valide.

**Faible pouvoir discriminant au niveau de la phrase.** BLEU a été conçue comme une métrique globale à l'échelle d'un corpus. Au niveau de la phrase individuelle, elle est bruitée et peu fiable — et pourtant, elle continue d'être systématiquement appliquée à des phrases isolées.

**Biais envers une référence unique.** BLEU postule qu'il n'existe qu'*une seule* traduction correcte (ou un échantillon restreint de références). Pour les langues à ordre des mots libre, aux vocabulaires riches en synonymes ou comportant des ambiguïtés structurelles (comme le « nous » inclusif/exclusif en cri), il peut exister des dizaines de traductions tout aussi recevables, et BLEU pénalise toutes celles qui ne correspondent pas par hasard à la référence.

**Faible corrélation avec le jugement humain.** Plusieurs méta-analyses — notamment celle de Reiter (2018, *Computational Linguistics*) — ont démontré que la corrélation entre BLEU et les évaluations qualitatives humaines est fréquemment médiocre, en particulier pour les systèmes très performants et pour les langues typologiquement éloignées de l'anglais.

Ces lacunes étaient connues presque dès le départ. Pourtant, BLEU a perduré, non pas parce que les alternatives étaient moins précises, mais parce qu'elles étaient moins pratiques. Le domaine s'est aligné sur la métrique qu'il pouvait calculer à moindre coût, plutôt que sur celle dont il avait véritablement besoin.

### NIST (Doddington, 2002)

La métrique NIST, publiée la même année que BLEU par George Doddington lors de HLT 2002, a modifié la formule de BLEU selon deux axes. Tout d'abord, elle a pondéré les n-grammes en fonction de leur **contenu informationnel** — les n-grammes rares se voyant attribuer un poids supérieur aux n-grammes fréquents, partant de l'intuition que traduire correctement une expression rare est plus informatif que de traduire correctement « of the ». Ensuite, elle a eu recours à une **moyenne arithmétique** plutôt qu'à la moyenne géométrique de BLEU, produisant des scores plus stables qui ne s'effondraient pas à zéro dès lors qu'un ordre de n-grammes ne présentait aucune correspondance. NIST a été largement employée dans les programmes d'évaluation DARPA TIDES et NIST OpenMT, sans toutefois parvenir à égaler la domination de BLEU au sein de la communauté de recherche générale. En dépit de ses améliorations, elle partageait la limite fondamentale de BLEU : une comparaison textuelle de surface, totalement dépourvue de notion de sens.

### METEOR (Banerjee & Lavie, 2005)

METEOR (Metric for Evaluation of Translation with Explicit ORdering) a constitué une tentative précoce pour pallier la rigidité de BLEU. Là où BLEU effectue une comparaison exacte de mots, METEOR a introduit trois innovations :

1. **La racinisation (stemming)** : Les mots sont réduits à leur racine avant comparaison, accordant ainsi un crédit partiel aux variantes morphologiques (par exemple, « running » correspond à « ran » après racinisation).
2. **La mise en correspondance des synonymes** : Grâce à WordNet, METEOR reconnaît que « car » et « automobile » représentent un même concept.
3. **L'alignement des mots** : Plutôt que de dénombrer les chevauchements de n-grammes, METEOR aligne explicitement les mots entre l'hypothèse et la référence, puis calcule la précision et le rappel avec une pénalité de fragmentation.

METEOR a régulièrement démontré une corrélation avec les jugements humains supérieure à celle de BLEU. Elle nécessitait toutefois des ressources linguistiques dédiées (outils de racinisation, bases de synonymes) qui restreignaient son applicabilité, et son calcul s'avérait plus lent. Pour l'anglais, l'amélioration était indéniable. Pour les langues à faibles ressources, les outils de racinisation et les bases de données lexicales étaient tout bonnement inexistants.

### TER (Snover et al., 2006)

Le Translation Edit Rate mesure le nombre minimal de modifications (insertions, suppressions, substitutions et *déplacements de syntagmes*) nécessaires pour transformer l'hypothèse en référence, normalisé par la longueur de celle-ci. L'opération de déplacement de syntagme — déplacer une séquence continue de mots vers une autre position — actait explicitement le fait que l'ordre des mots n'est pas fixe d'une langue à l'autre. L'approche par distance d'édition de TER est intuitive (elle quantifie « la charge de travail qu'un post-éditeur humain devrait accomplir »), mais hérite du même écueil fondamental : elle effectue sa comparaison face à une référence unique et n'a aucune appréhension du sens.

### chrF et chrF++ (Popović, 2015 ; 2017)

L'innovation la plus marquante entre BLEU et l'ère neuronale est due à Maja Popović. **chrF** (character F-score) évalue le chevauchement au niveau des *caractères* plutôt qu'au niveau des mots, en calculant la précision et le rappel sur les n-grammes de caractères. **chrF++** réintroduit ensuite les unigrammes et bigrammes au niveau des mots dans ce calcul.

Voici pourquoi cela est déterminant pour les langues à forte complexité morphologique : la comparaison au niveau des caractères accorde un *crédit partiel* aux morphèmes partagés. Les mots cris *nikî-nipâw* (« j'ai dormi ») et *kikî-nipâw* (« tu as dormi ») partagent la majorité de leurs n-grammes de caractères tout en étant des termes distincts. chrF accorde un crédit partiel substantiel, là où BLEU attribuerait un score nul.

chrF++ s'est imposée comme une métrique secondaire de référence lors des shared tasks du WMT, intégrée dans **sacreBLEU** (Post, 2018), et est unanimement reconnue comme supérieure à BLEU pour les langues morphologiquement riches. Elle demeure néanmoins une métrique de comparaison de chaînes — plus adaptée que BLEU, mais fondamentalement limitée par le même postulat voulant que la qualité de traduction puisse s'évaluer par la simple coïncidence de formes de surface.

---

## Partie 2 : La révolution des métriques neuronales (2018–Présent)



### Le déclic : apprendre à noter

Les métriques basées sur la comparaison de chaînes de la Partie 1 partagent un choix de conception fondamental : ce sont des formules heuristiques codées à la main. On a décrété un jour que la précision des n-grammes, le chevauchement de caractères ou la distance d'édition constituaient une approximation convenable de la qualité d'une traduction, et tout le domaine a appliqué cette formule pendant dix ans.

La révolution des métriques neuronales est née d'une interrogation différente : *et si nous entraînions un modèle à prédire la qualité d'une traduction, de la même manière que nous entraînons des modèles à traduire ?*

### BERTScore (Zhang et al., 2020)

BERTScore, publié à l'ICLR 2020 par Tianyi Zhang et ses collègues de Cornell et du MIT, a été la première métrique largement adoptée à faire basculer l'évaluation de la correspondance textuelle exacte vers la similarité sémantique. Le mécanisme est élégant : encoder à la fois l'hypothèse et la référence au moyen d'un modèle Transformer pré-entraîné (BERT, RoBERTa ou DeBERTa), calculer la similarité cosinus entre chaque paire de plongements de tokens (token embeddings), puis employer un appariement glouton (greedy matching) pour dériver la précision (la meilleure correspondance de chaque token de l'hypothèse dans la référence), le rappel (la meilleure correspondance de chaque token de la référence dans l'hypothèse) et le score F1.

BERTScore prend en charge les synonymes, les paraphrases et les variations de syntaxe de manière naturelle — « the feline rested on the rug » obtient une similarité élevée avec « the cat sat on the mat », car les plongements contextuels capturent leur équivalence sémantique. Grâce au BERT multilingue, elle s'étend à n'importe quelle langue couverte par le modèle.

Toutefois, BERTScore n'est pas *entraîné* sur des jugements qualitatifs humains. Il exploite des plongements pré-entraînés tels quels, ce qui signifie qu'il appréhende une similarité sémantique générale plutôt que d'apprendre spécifiquement les critères d'une *bonne traduction*. Cette nuance est capitale : une phrase peut être sémantiquement proche d'une référence tout en étant une mauvaise traduction (registre inadapté, omission d'une négation, modificateur halluciné). De plus, BERTScore hérite de tous les biais linguistiques inhérents au modèle sous-jacent — pour les langues sous-représentées dans les corpus d'entraînement de BERT, les plongements peuvent s'avérer incapables de discerner des nuances fondamentales.

### BLEURT (Sellam et al., 2020)

BLEURT (Bilingual Evaluation Understudy with Representations from Transformers), présenté à l'ACL 2020 par Thibault Sellam, Dipanjan Das et Ankur Parikh chez Google, a apporté une avancée majeure : un **pré-entraînement sur des perturbations synthétiques** précédant l'ajustement fin (fine-tuning) sur des jugements humains. Le constat était le suivant : ajuster directement un modèle de langage sur les volumes restreints des jeux de données d'évaluation humaine du WMT aboutissait à une métrique fragile — surajustée aux schémas spécifiques des données d'entraînement et défaillante sur des entrées hors distribution.

La réponse apportée par BLEURT consistait en un processus d'entraînement en deux étapes. Au cours de la première phase, des millions de paires de phrases synthétiques ont été générées au moyen de suppressions, d'insertions et de substitutions aléatoires de mots, ainsi que par rétro-traduction. Le modèle a été entraîné à prédire les scores de métriques automatiques existantes (BLEU, ROUGE, BERTScore, implication textuelle) sur ces paires — assimilant ainsi des concepts généraux de similarité textuelle. Lors de la seconde phase, le modèle pré-entraîné a été affiné sur les évaluations humaines Direct Assessment du WMT. Ce « préchauffage » a considérablement renforcé sa robustesse.

BLEURT-20 a par la suite élargi cette méthode à l'évaluation multilingue en s'appuyant sur l'encodeur RemBERT de Google. Néanmoins, BLEURT reste strictement tributaire de la référence — elle n'exploite pas le texte source, ce qui l'empêche de détecter des hallucinations par ailleurs parfaitement fluides, et dépend entièrement de la qualité de la référence fournie.

### COMET (Rei et al., 2020)

COMET (Crosslingual Optimized Metric for Evaluation of Translation) incarne l'état de l'art actuel en matière d'évaluation automatique de la TA. Conçue par Ricardo Rei et ses collègues chez **Unbabel**, COMET s'appuie sur un encodeur translinguistique (XLM-RoBERTa) pour projeter trois entrées — la phrase source, l'hypothèse de TA et la traduction de référence — et prédit un score de qualité entraîné sur des jugements humains Direct Assessment.

COMET a remporté ou s'est classée en tête de toutes les WMT Metrics Shared Tasks à partir de 2020. Sa corrélation avec le jugement humain est nettement supérieure à celle de toute métrique basée sur la comparaison de chaînes. Elle sait identifier les paraphrases, appréhende la préservation du sens et tolère les variations synonymiques que BLEU ignore totalement.

Cependant, COMET présente une faiblesse rédhibitoire au regard de nos objectifs : elle est entraînée sur des jugements humains issus du WMT, qui concernent en écrasante majorité des langues européennes. Son encodeur translinguistique (XLM-R) a été entraîné sur des données CommonCrawl au sein desquelles le cri des Plaines, le sami du Nord et la plupart des langues autochtones sont quasiment inexistants. Pour ces langues, les représentations internes de COMET manquent de fiabilité — la métrique peut renvoyer des scores, mais ces chiffres ne reposent sur aucune compréhension réelle de la structure linguistique sous-jacente.

### xCOMET (Guerreiro et al., 2024)

xCOMET, publié dans le TACL 2024 par Nuno Guerreiro, Ricardo Rei et leurs collègues d'Unbabel et de l'Instituto Superior Técnico, a fait évoluer COMET du statut de simple boîte noire de notation à celui d'**outil de diagnostic**. L'innovation centrale réside dans l'apprentissage multitâche : parallèlement au score de qualité à l'échelle de la phrase, xCOMET effectue un **étiquetage de séquences au niveau des sous-mots** afin d'isoler précisément les segments d'erreur (error spans) dans la traduction et de les catégoriser comme mineurs, majeurs ou critiques.

Cela fait le lien entre la notation automatique et l'analyse d'erreurs humaine selon les directives MQM. Au lieu de se contenter d'indiquer « cette traduction obtient 0,73 », xCOMET peut pointer du doigt les mots erronés et préciser le degré de gravité. L'entraînement repose sur un apprentissage par étapes (curriculum learning) : d'abord un entraînement sur les données Direct Assessment pour la régression au niveau de la phrase, puis l'adjonction de données annotées selon MQM avec étiquetage des segments d'erreur pour un entraînement conjoint.

xCOMET a atteint des performances de pointe simultanément au niveau de la phrase, du système et des segments d'erreur. Elle fonctionne aussi bien avec référence que sans référence. Elle exige toutefois des données d'entraînement annotées selon MQM — extrêmement coûteuses à produire et qui n'existent, pour l'essentiel, que pour les paires de langues européennes.

### AfriCOMET (Wang & Adelani, NAACL 2024)

AfriCOMET, publié à NAACL 2024 par Jiayi Wang, David Ifeoluwa Adelani et leurs confrères de la communauté Masakhane, apporte la démonstration la plus éclatante du fait que les métriques neuronales *doivent impérativement* être adaptées aux langues sous-dotées — elles ne se généralisent pas spontanément.

L'article a d'abord mis le problème en lumière : le modèle COMET standard, entraîné sur les données WMT issues de langues européennes, présentait une corrélation nettement plus faible avec les jugements humains lorsqu'il était appliqué à 13 langues africaines (dont l'amharique, le haoussa, l'igbo, le swahili, le yoruba et le zoulou). Pour y remédier, deux ajustements majeurs ont été nécessaires. Premièrement, le remplacement de XLM-R par **AfroXLM-R**, un encodeur translinguistique spécifiquement entraîné pour mieux représenter les langues africaines. Deuxièmement, la création d'**AfriMTE**, un nouveau jeu de données d'évaluation humaine reposant sur des directives MQM simplifiées, conçues pour des annotateurs non experts — recruter des traducteurs professionnels bilingues pour ces langues s'avérant très complexe.

AfriCOMET a validé le bien-fondé du concept : une métrique neuronale dédiée à une famille linguistique spécifique peut surclasser de façon spectaculaire la version générique. Mais elle a également mis en évidence son coût : il a fallu concevoir AfroXLM-R, recueillir des données de jugement humain pour 13 langues et entraîner un tout nouveau modèle. Pour le cri des Plaines, il n'existe à ce jour aucun encodeur équivalent, aucun jeu de données de jugements humains ni aucune métrique adaptée. Suivre la trajectoire d'AfriCOMET exigerait de créer l'intégralité de ces ressources de toutes pièces — un chantier de plusieurs années impliquant une évaluation humaine participative et probablement l'élaboration d'un encodeur dédié à la famille des langues algonquiennes.

### GEMBA : l'évaluation par LLM (Kocmi & Federmann, 2023)

GEMBA (GPT Estimation Metric Based Assessment), présenté à l'EAMT 2023 par Tom Kocmi et Christian Federmann de Microsoft, a posé une question provocatrice : et si l'on se contentait de *demander* à GPT-4 si une traduction est de qualité ?

L'approche est désarmante de simplicité. **GEMBA-DA** soumet la source et l'hypothèse au LLM au moyen d'un prompt et sollicite une note de qualité sur une échelle de 0 à 100. **GEMBA-MQM** fournit trois exemples annotés et invite le LLM à identifier les segments d'erreur spécifiques, à les classer par catégorie et niveau de gravité, et à générer un score calqué sur MQM. Aucun entraînement dédié à la métrique n'est nécessaire.

Les résultats ont été saisissants : à l'échelle du système, GEMBA a obtenu des corrélations compétitives voire supérieures à l'état de l'art par rapport aux jugements humains. Les annotations d'erreurs de GEMBA-MQM, bien que moins fiables que celles d'annotateurs humains, ont fourni des diagnostics interprétables sans nécessiter le moindre apprentissage spécialisé.

GEMBA soulève néanmoins de sérieuses inquiétudes. Elle dépend de modèles propriétaires fermés dont le comportement évolue d'une version d'API à l'autre. Au sens strict, les résultats ne sont pas reproductibles. L'approche est onéreuse à grande échelle (coûts d'API pour évaluer un jeu de test WMT complet). Enfin — point capital pour notre propos —, la maîtrise des langues à faibles ressources par ces LLM reste très incertaine. GPT-4 peut appréhender ou non la morphologie du cri des Plaines suffisamment bien pour en évaluer les traductions ; rien ne permet de le savoir sans tests préalables, et rien ne garantit que ce comportement demeure constant au gré des mises à jour du modèle. Kocmi et Federmann ont d'ailleurs eux-mêmes déconseillé d'invoquer GEMBA pour revendiquer des gains scientifiques dans des publications académiques, en raison de la nature opaque (« boîte noire ») de cette évaluation.

### MetricX et la WMT 2024 Metrics Shared Task

**MetricX-24**, développé par Juraj Juraska, Daniel Deutsch, Mara Finkelstein et Markus Freitag chez Google, a remporté la WMT 2024 Metrics Shared Task. Reposant sur **mT5** (Multilingual T5, un modèle encodeur-décodeur à la différence de l'architecture purement encodeur XLM-R exploitée par COMET), MetricX adopte une voie architecturale distincte. Elle fait appel à un ajustement fin en deux étapes — d'abord sur des données Direct Assessment, puis sur des scores MQM — avec une **augmentation massive de données synthétiques** ciblant les défaillances connues des métriques (sous-traduction, traductions fluides mais incorrectes, hallucinations).

L'article synthétisant les résultats du WMT 2024, intitulé **« Are LLMs Breaking MT Metrics? »**, cherchait à déterminer si les traductions générées par les LLM avaient mis à mal l'écosystème des métriques. La réponse a été un non nuancé : les métriques neuronales ajustées (MetricX-24, variantes de COMET) sont restées efficaces, même si les métriques basées sur les LLM (variantes de GEMBA) ont démontré une robustesse surprenante au niveau du système. Principaux enseignements :

- Les **métriques sensibles à la source** (exploitant source + référence + hypothèse) ont constamment surpassé les métriques exploitant la seule référence
- Les **modèles hybrides**, capables d'opérer aussi bien avec que sans référence à partir d'une architecture unifiée, constituent la direction émergente
- La **fracture des faibles ressources** persiste : toutes les métriques obtiennent de moins bons résultats sur les langues sous-représentées, et cet écart ne se comble pas
- Les **métriques entraînées sur MQM** (exploitant des annotations fines d'erreurs) surclassent systématiquement les métriques entraînées sur DA (reposant sur de simples scores scalaires)

Les implications pour l'évaluation des langues à faibles ressources sont manifestes : le domaine converge vers de volumineuses métriques neuronales entraînées, sensibles à la source, érigées en standard d'excellence. Ces métriques requièrent un volume considérable de données d'entraînement, de puissance de calcul et — point critique — de données d'évaluation humaine dans la langue cible. Pour les langues privées de l'ensemble de ces ressources, la chaîne de métriques de pointe s'avère tout bonnement inapplicable.

### Le problème du biais : métriques neuronales et langues à faibles ressources

La révolution des métriques neuronales a été, dans son écrasante majorité, un phénomène réservé aux langues dotées de ressources abondantes. Chaque métrique entraînée mentionnée dans les sections précédentes a été ajustée sur des données de jugement humain du WMT, qui couvrent environ une vingtaine de paires de langues — toutes impliquant des langues européennes, le chinois ou le japonais. Les encodeurs sous-jacents (XLM-R, mT5, InfoXLM) ont été entraînés sur des données CommonCrawl où la représentation est proportionnelle à la présence sur le web : l'anglais domine, les langues européennes sont largement couvertes, et l'immense majorité des plus de 7 000 langues du monde en est pratiquement absente.

Pour une langue comme le cri des Plaines, cela engendre une cascade de défaillances :

1. **Absence de données d'entraînement** : Il n'existe aucun jugement humain WMT pour les traductions en cri, aucune métrique n'a donc pu être entraînée pour les évaluer.
2. **Absence de couverture dans l'encodeur** : Le vocabulaire de XLM-R a été forgé sur CommonCrawl, où les écrits en cri sont rarissimes. Le segmenteur sur-découpe les mots cris en fragments d'octets arbitraires, et les plongements contextuels de ces fragments sont très mal entraînés.
3. **Absence de validation** : Personne n'a mesuré si COMET, BLEURT ou MetricX génèrent des scores pertinents pour le cri. Ils peuvent renvoyer des *chiffres*, mais rien ne prouve que ces chiffres correspondent à une qualité réelle de traduction.
4. **Impasse technique d'amélioration** : L'approche AfriCOMET — concevoir un encodeur dédié à une famille de langues, recueillir des données d'évaluation humaine, entraîner une nouvelle métrique — représente un chantier s'étalant sur plusieurs années et mobilisant plusieurs institutions. Pour une communauté linguistique de 20 000 locuteurs, l'infrastructure de recherche permettant de soutenir un tel effort n'existe pas actuellement.

Il en résulte un paradoxe : les langues qui ont le besoin le plus impérieux d'évaluation en TA (parce que leurs systèmes sont les plus fragiles et réclament l'analyse la plus rigoureuse) sont précisément celles pour lesquelles les meilleurs outils d'évaluation s'avèrent les moins fiables. La réponse du milieu a consisté à préconiser chrF++ comme solution « acceptable » — et elle se montre effectivement supérieure à BLEU —, mais chrF++ demeure une métrique de comparaison de chaînes incapable de déceler une équivalence sémantique, inapte à gérer l'ordre libre des mots et totalement dépourvue de compréhension de la validité morphologique.

---

## Partie 3 : Au-delà du score brut — Évaluation diagnostique et linguistique

### La dichotomie Adéquation / Fluidité

Avant l'avènement des métriques automatiques, l'évaluation humaine de la TA s'articulait autour d'un cadre à deux dimensions : l'**adéquation** (la traduction transmet-elle fidèlement le sens de la source ?) et la **fluidité** (la traduction est-elle grammaticale et naturelle dans la langue cible ?). Cette distinction, formalisée lors des premières évaluations de TA de la DARPA puis reprise par le NIST, consacrait un principe que les métriques automatiques allaient s'efforcer de reconquérir pendant deux décennies : la qualité d'une traduction n'est pas unidimensionnelle.

Le paradigme adéquation/fluidité a perdu la faveur des chercheurs lorsque le WMT lui a substitué le Direct Assessment (un score scalaire unique). Pourtant, le principe fondamental reste incontournable : une traduction peut être fluide mais totalement fausse (hallucination), ou maladroite mais rigoureusement exacte sur le plan du sens (variante morphologique). Aucun score unique ne peut rendre compte de ces deux réalités simultanément.

### MQM : Le standard d'excellence (Lommel et al., 2014 ; Freitag et al., 2021)

Le système **Multidimensional Quality Metrics (MQM)** s'est substitué au Direct Assessment pour devenir la principale méthode d'évaluation humaine du WMT à partir de 2021. MQM mobilise des traducteurs professionnels chargés de repérer des segments d'erreur précis, de les classifier par type (contre-sens, omission, ajout, grammaire, terminologie) et par degré de gravité (mineur = 1 point, majeur = 5 points, critique = 25 points). Cela produit à la fois une note qualitative et un diagnostic directement exploitable.

MQM représente ce qui se rapproche le plus d'une méthodologie d'évaluation « rigoureuse » — elle n'indique pas seulement *à quel point* une traduction est mauvaise, mais *ce qui fait précisément défaut*. Elle exige toutefois le concours de traducteurs professionnels bilingues, qui, pour la plupart des langues sous-dotées, n'existent pas en effectif suffisant pour permettre une évaluation statistiquement fiable.

### MorphEval : Évaluation morphologique contrastive (Burlot & Yvon, 2017)

MorphEval constitue le précédent le plus direct d'une évaluation de TA sensible à la morphologie. Introduit par Franck Burlot et François Yvon lors du WMT 2017 et complété en 2018, MorphEval évalue la *compétence* morphologique à l'aide de **jeux de tests contrastifs** (contrastive test suites).

**Fonctionnement :** Le jeu de test est constitué de paires de phrases dans la langue source qui ne diffèrent que par un unique contraste morphologique — par exemple, singulier c. pluriel, présent c. passé, masculin c. féminin. Le système de TA traduit les deux phrases. S'il restitue convenablement l'opposition dans ses traductions (en générant par exemple une cible au pluriel lorsque la source est au pluriel, et une cible au singulier lorsque la source est au singulier), le contraste est comptabilisé comme validé.

**Langues couvertes :** Anglais→Tchèque, Anglais→Letton (v1, WMT 2017) ; étendu à Anglais→Français, Anglais→Allemand, Anglais→Finnois, Turc→Anglais (v2, WMT 2018).

**Enseignements clés :** MorphEval a mis en évidence le fait que même les systèmes de TA neuronale les plus performants présentaient des défaillances morphologiques systématiques — produisant des phrases très fluides mais erronées quant au temps, au nombre ou au cas. Ces erreurs demeuraient indétectables pour BLEU et n'étaient que partiellement décelées par COMET.

**Disponibilité :** Open source sur GitHub ([franckbrl/morpheval](https://github.com/franckbrl/morpheval), [franckbrl/morpheval_v2](https://github.com/franckbrl/morpheval_v2)).

**Limites :** MorphEval impose de concevoir des jeux de tests contrastifs sur mesure pour chaque langue cible, élaborés par des linguistes maîtrisant les oppositions morphologiques de ladite langue. Il n'existe aucun jeu de test de cette nature pour la moindre langue polysynthétique. De surcroît, la méthode évalue une *compétence* (le système gère-t-il cette opposition ?) plutôt qu'une *validité* (le système a-t-il généré de véritables mots ?) ou une *équivalence* (ces deux traductions distinctes sont-elles toutes deux correctes ?).

### CheckList : Tests comportementaux pour le TALN (Ribeiro et al., ACL 2020)

**CheckList**, présenté à l'ACL 2020 par Marco Tulio Ribeiro et ses collègues (couronné du prix du Meilleur Article), a transposé un concept du génie logiciel à l'évaluation du TALN : les **tests unitaires**. Au lieu de jauger la performance globale d'un modèle sur un banc d'essai, CheckList établit une matrice croisant des **capacités** (vocabulaire, négation, entités nommées, raisonnement temporel, coréférence) avec des **types de tests** :

- **Tests de fonctionnalité minimale (MFT)** : Cas de test simples et ciblés que tout modèle compétent se doit de réussir.
- **Tests d'invariance (INV)** : Perturbations de l'entrée qui *ne doivent pas* altérer la sortie (par exemple, remplacer un prénom ne doit pas modifier la polarité du sentiment).
- **Tests d'attente directionnelle (DIR)** : Perturbations qui *doivent* modifier la sortie dans une direction prévisible.

Conçu à l'origine pour l'analyse de sentiment et l'inférence en langage naturel (NLI), le paradigme CheckList s'applique directement à la TA. Il devient envisageable d'élaborer des MFT pour des faits morphologiques (« le système produit-il la forme correcte du pluriel ? »), des tests INV pour la liberté d'agencement syntaxique (« modifier l'ordre des mots en cri altère-t-il la traduction anglaise ? ») et des tests DIR pour les traits morphologiques (« basculer la source du passé au présent modifie-t-il le temps du texte cible ? »).

Le paradigme CheckList est d'autant plus pertinent qu'il formalise la démarche intuitive de MorphEval : sonder des capacités déterminées plutôt que de calculer des scores agrégés. Les classes de variantes de notre linter (WORD_ORDER, ORTHOGRAPHIC, OPTIONAL_PARTICLE, etc.) constituent, concrètement, des règles d'invariance — elles définissent des transformations qui ne doivent en rien altérer le verdict d'évaluation.

### Jeux de défis (Challenge Sets) et évaluation ciblée

Le cadre plus large des **jeux de défis** (challenge sets) — des jeux de tests spécialement élaborés pour cibler des phénomènes linguistiques précis — s'est imposé comme une méthodologie d'évaluation complémentaire reconnue au sein du WMT depuis 2017 environ.

**Isabelle, Cherry & Foster (2017)**, au CNRC (Canada), ont été les pionniers de cette approche en TA en concevant des corpus de test manuels ciblant les divergences structurelles entre langues — des cas de figure où une traduction littérale aboutit immanquablement à une faute. Leurs travaux ultérieurs (Isabelle & Kuhn, 2018) ont élaboré 506 phrases françaises ciblant des difficultés spécifiques de traduction, dressant ainsi un portrait d'une grande précision des capacités des systèmes.

**LingEval97** (Sennrich, EACL 2017) a bâti 97 000 paires de traduction contrastives Anglais→Allemand visant à tester si les modèles de TAN attribuent une probabilité supérieure aux traductions correctes face à des paires comportant des fautes morphosyntaxiques induites. Conclusion marquante : les modèles au niveau des caractères excellaient dans la translittération, mais peinaient nettement plus sur les accords morphosyntaxiques à longue distance.

**ACES** (Amrhein, Moghe & Guillou, 2022–2023) a porté cette approche des jeux de défis à une tout autre échelle : 36 476 exemples couvrant 146 paires de langues et évaluant 68 phénomènes linguistiques distincts. ACES a servi à méta-évaluer les métriques soumises à la WMT Metrics Shared Task — vérifiant ainsi si les *métriques* étaient en mesure de repérer les contrastes, et pas seulement si les *systèmes* savaient les produire. Le projet s'est ensuite enrichi de **SPAN-ACES**, qui intègre des annotations sur les segments d'erreur.

**MT-GenEval** (Currey et al., EMNLP 2022) et **WinoMT** (Stanovsky, Smith & Zettlemoyer, ACL 2019) se focalisent spécifiquement sur la justesse du genre grammatical. WinoMT se distingue par le recours explicite à l'**analyse morphologique** sur la langue cible pour valider le genre des dénominations de métiers traduites — l'un des rares cas où un analyseur morphologique est directement employé comme composant d'un outil d'évaluation de TA.

**Hjerson** (Popović & Ney, 2011) est un outil open source de classification automatique des erreurs de TA qui utilise des **lemmes et des étiquettes morphosyntaxiques (POS)** pour catégoriser les erreurs en cinq classes : morphologiques, d'ordonnancement, mots manquants, mots superflus et erreurs lexicales. Il s'agit probablement du travail le plus proche de notre linter dans l'esprit — exploitant l'analyse linguistique pour fournir des catégories diagnostiques plutôt qu'un chiffre unique.

Le dénominateur commun est limpide : le milieu de la recherche a admis, à maintes reprises, que les scores agrégés ne suffisent pas. L'évaluation diagnostique apporte la granularité indispensable pour comprendre *pourquoi* un système achoppe. Cependant, ces démarches diagnostiques requièrent une expertise linguistique dédiée pour chaque langue, et cette expertise demeure très largement concentrée sur les langues européennes.

### AmericasNLP : L'évaluation sur le terrain

La série d'ateliers AmericasNLP (associée à NAACL), consacrée au traitement automatique des langues autochtones des Amériques, constitue le point de comparaison le plus direct pour nos problématiques d'évaluation.

De 2021 à 2023, la compétition partagée a adopté **chrF** comme métrique d'évaluation principale — retenue pour sa robustesse en contexte de faibles ressources et son principe de comparaison au niveau des caractères, qui accorde un crédit partiel aux chevauchements morphologiques. Les organisateurs reconnaissaient volontiers les limites de chrF, mais ne disposaient d'aucune meilleure alternative capable de fonctionner à travers la diversité des typologies représentées (quechua, guarani, aymara, nahuatl, rarámuri, entre autres).

En 2025, AmericasNLP a mis en place une **Shared Task 3** spécifiquement dévolue à l'élaboration de métriques d'évaluation de la TA pour les langues autochtones — actant pour la première fois de façon explicite l'inadéquation des métriques conventionnelles pour ces idiomes. La soumission lauréate, **FUSE** (Feature-Union Scorer), combine des plongements de phrases multilingues (LaBSE affiné), la similarité lexicale, la similarité phonétique et un appariement flou de tokens via régression Ridge et Gradient Boosting. FUSE ne fait appel à aucun analyseur morphologique — son ingénierie de variables (feature engineering) est agnostique à la langue.

C'est précisément dans cette brèche que s'inscrit notre démarche. AmericasNLP a cerné l'écueil (les métriques conventionnelles échouent sur les langues autochtones) et amorcé la mise au point d'alternatives (FUSE). Mais aucune de ces pistes n'exploite le savoir morphologique modélisé par les FST. La communauté d'AmericasNLP s'appuie sur chrF++ faute de mieux parmi les outils génériques, tandis que la communauté GiellaLT conçoit des outils morphologiques sophistiqués qui ne sont jamais intégrés aux processus d'évaluation de TA. Ces deux sphères de recherche ont évolué sans converger.

---

## Partie 4 : Évaluation sans référence et estimation de la qualité

Certains des indicateurs d'évaluation les plus cruciaux de notre banc de test ne réclament absolument aucune traduction de référence. Le contrôle de validité par FST (« ce mot existe-t-il dans la langue ? ») n'examine que la sortie de la TA. Le détecteur d'hallucinations s'appuie uniquement sur la source et l'hypothèse. Le détecteur d'alternance codique n'a besoin que de l'hypothèse et de la connaissance du système d'écriture de la langue cible. Il est indispensable de comprendre où se situent ces outils dans le paysage plus général de l'évaluation sans référence pour les positionner avec exactitude.

### Le paradigme de l'estimation de la qualité (Quality Estimation)

L'**estimation de la qualité (QE)** est le sous-domaine de l'évaluation de la TA dédié à prédire la qualité d'une traduction *en l'absence* de traductions de référence. Ce champ fait l'objet d'une tâche dédiée au WMT depuis 2012, motivée par le besoin opérationnel d'estimer la fiabilité de la TA au moment de son déploiement — lorsque l'on traduit un texte inédit pour lequel aucune référence humaine n'existe.

La QE a traversé trois générations successives. La **QE basée sur des descripteurs** (2012–2016) extrayait des caractéristiques manuelles à partir de la source et de l'hypothèse — perplexité du modèle de langue, fréquence des termes, chevauchement de n-grammes avec des corpus monolingues — et entraînait des classifieurs pour estimer la qualité. La **QE neuronale** (2017–2021) a substitué des représentations apprises à ces descripteurs manuels, le plus souvent à l'aide d'encodeurs bilingues. La **QE actuelle** (2022–présent) est dominée par les approches dérivées de COMET, au premier rang desquelles figure **CometKiwi**.

### CometKiwi et COMET sans référence

**CometKiwi** (Rei et al., WMT 2022), la déclinaison sans référence de COMET, exploite InfoXLM pour encoder la phrase source et l'hypothèse de TA (en faisant abstraction de toute référence) et prédit un score qualitatif. Elle s'est hissée au sommet des benchmarks lors des tâches de QE du WMT en 2022 et 2023.

Le résultat est remarquable : la version sans référence de CometKiwi rivalise presque avec les corrélations humaines atteintes par le COMET avec référence. Cela met en lumière le fait que, pour les langues abondamment dotées, le texte source véhicule presque autant de signal évaluatif que la traduction de référence. La même réserve s'applique toutefois : l'encodeur de CometKiwi ne dispose que d'une représentation dérisoire des langues à faibles ressources, rendant ses prédictions sans référence peu fiables pour le cri ou le sami.

C'est précisément là que nos métriques reposant sur des FST proposent une rupture méthodologique. La validation par FST constitue un **signal de qualité déterministe et sans référence** qui ne fait appel à aucun modèle entraîné ni à aucun jeu de données de jugement humain. Si le FST indique qu'une unité lexicale n'est pas un mot cri recevable, ce mot n'est tout simplement pas recevable en cri — sous réserve de faux rejets concernant les emprunts, les néologismes et les noms propres. Ce type d'indicateur qualitatif strict, fondé sur des règles immuables, n'a aucun équivalent dans l'écosystème de la QE neuronale.

### Détection des hallucinations en TA

L'hallucination en TA — une sortie fluide mais qui n'a aucun rapport avec la source — représente un mode d'échec critique, tout particulièrement dans les contextes à faibles ressources où les modèles ne disposent pas de données d'entraînement suffisantes pour apprendre des correspondances source-cible fiables.

L'état de l'art académique en matière de détection des hallucinations repose sur plusieurs méthodologies :

- **Détection par plongements vectoriels** : Comparaison des plongements de la source et de l'hypothèse dans un espace partagé (LASER, LaBSE) et identification des occurrences où la similarité plonge sous un seuil défini.
- **Détection probabiliste** : Utilisation des scores de confiance propres au modèle de TA — les hallucinations ayant tendance à présenter une probabilité de sortie élevée mais une probabilité conditionnée par la source très faible.
- **Perturbation contrastive** : Comparaison de la sortie de TA obtenue pour la source réelle face à celle d'une source perturbée ou sans lien ; si les sorties sont étrangement proches, le modèle s'avère ignorer le texte source.
- **LLM comme juge** : Utilisation d'un prompt invitant un LLM à vérifier la fidélité de la traduction vis-à-vis de la source.

Notre banc de test intègre un **plugin de détection heuristique** qui agrège quatre signaux : le gonflement de la longueur (hypothèse anormalement plus longue que prévu), la répétition (boucles de syntagmes répétés), l'inadéquation des entités (entités nommées de la source absentes de l'hypothèse) et l'écho de la source (l'hypothèse est trop similaire au texte source, trahissant une copie non traduite). Cette approche reste basique comparée à l'état de l'art académique — elle repère les hallucinations massives mais laissera passer des dérives plus subtiles. Sa force réside dans son rôle de **filtre économique, rapide et sans référence**, capable de signaler les anomalies les plus flagrantes sans solliciter de GPU ni consommer de requête d'API.

### Détection de l'alternance codique

L'alternance codique (code-switching) dans les sorties de TA — situation où le système restitue des mots dans la langue source au lieu de les traduire — constitue un mode de défaillance distinct de l'hallucination. Elle survient typiquement lorsque le modèle bute sur un terme qu'il ne sait pas traduire et se rabat sur la copie pure et simple de la source.

Notre plugin de détection de l'alternance codique s'appuie sur une **analyse des blocs Unicode** (détection de caractères relevant du système d'écriture de la langue source au sein de ce qui devrait être une sortie en langue cible) et sur des **listes de mots fréquents** (identification des termes courants de la langue source demeurés non traduits). Pour le cri, qui s'écrit aussi bien en alphabet latin standardisé (SRO) qu'en syllabaire, cela requiert certaines précautions — l'anglais et le SRO partageant l'alphabet latin, la simple analyse des blocs Unicode ne saurait suffire.

La littérature scientifique portant sur la détection de l'alternance codique en sortie de TA est rare comparée aux travaux sur les hallucinations. La plupart des recherches traitent de l'alternance codique dans les textes d'*entrée* (locuteurs bilingues panachant deux langues) plutôt que dans les textes de *sortie* (systèmes de TA incapables de traduire). Notre approche heuristique ne présente, à notre connaissance, aucun retard significatif par rapport à l'état de l'art publié sur cette problématique précise.

---

## Partie 5 : La fracture morphologique

### Ce que les métriques existantes ne voient pas

C'est ici que se noue la thèse centrale de ce document, et elle appelle une démonstration tangible.

Examinons cette paire d'énoncés en cri des Plaines :

| | Texte |
|--|------|
| **Source (anglais)** | "I saw the man" |
| **Référence (cri)** | *nikî-wâpamâw nâpêw* |
| **Hypothèse A** | *nâpêw nikî-wâpamâw* |
| **Hypothèse B** | *nikî-wâpamikow nâpêsis* |

L'**Hypothèse A** est une traduction irréprochable — elle contient exactement les mêmes termes agencés dans un ordre différent, ce qui est parfaitement grammatical en cri (la langue admettant un ordre des mots libre). L'**Hypothèse B** signifie quant à elle « le garçon a été vu par moi » — inversion de l'orientation de l'action (*-ikow* étant la marque de la voix inverse), et erreur sur le référent (*nâpêsis* = « garçon », et non « homme »).

| Métrique | Hypothèse A (correcte) | Hypothèse B (incorrecte) | Sait-elle faire la distinction ? |
|--------|----------------------|---------------------|------------------------|
| BLEU | ~30 % | ~20 % | À peine |
| chrF++ | ~65 % | ~55 % | Un peu |
| COMET | Inconnu (pas de données d'entraînement en cri) | Inconnu | Non fiable |
| **Validation par FST** | 100 % | 100 % | Non (les deux sont du cri valide) |
| **Linter** | EQUIVALENT (WORD_ORDER) | MISS | **Oui** |
| **Validateur sémantique** | VALID | WRONG | **Oui** |

Le linter et le validateur sémantique réussissent là où BLEU, chrF++ et COMET échouent — non pas parce qu'ils représenteraient des « métriques supérieures » dans l'absolu, mais parce qu'ils ont accès à un **savoir linguistique** hors de portée des métriques de surface et neuronales. Ils savent que le cri admet un ordre syntaxique libre. Ils savent que *wâpamêw* et *wâpamikow* sont des lemmes distincts régissant des structures d'arguments différentes. Ils savent que *nâpêw* et *nâpêsis* sont deux mots distincts.

Cette connaissance est issue du FST (qui encode la grammaire morphologique), du dictionnaire bilingue (qui fournit les gloses anglaises de chaque lemme) et des classes de variantes définies manuellement (qui encodent des règles d'équivalence linguistiquement fondées). Aucune de ces informations n'est accessible à une métrique qui traite la traduction comme une simple chaîne de caractères.

### Pourquoi la recherche n'a pas résolu ce problème

La fracture morphologique dans l'évaluation de la TA n'a rien d'un secret. Le domaine est conscient de son existence. Sa persistance tient à des facteurs structurels :

1. **Le biais d'échelle.** La communauté de l'évaluation en TA optimise ses recherches au profit de métriques fonctionnant sur l'intégralité des paires de langues du WMT. Les métriques basées sur des FST s'appliquent à environ 30 langues. COMET fonctionne sur plus de 100 langues. chrF++ fonctionne sur toutes les langues disposant d'un système d'écriture. Le milieu valorise l'universalité au détriment de la précision.

2. **Le cloisonnement disciplinaire.** Les concepteurs de FST (linguistes computationnels de l'UiT Tromsø, du CNRC Canada, de l'Université de l'Alberta) et les développeurs de métriques d'évaluation (chercheurs en apprentissage automatique chez Google, Unbabel, ou au sein du WMT) fréquentent des conférences distinctes, publient dans des revues différentes et répondent à des logiques de valorisation divergentes. Le croisement de compétences indispensable pour concevoir des métriques d'évaluation fondées sur des FST n'a pas eu lieu — non pas en raison d'un échec technique, mais parce que ces deux communautés ne se sont jamais rencontrées.

3. **L'inquiétude liée à la couverture lexicale.** Les FST souffrent de faux rejets documentés : les emprunts, les néologismes et les noms propres risquent d'être rejetés comme invalides alors qu'ils sont parfaitement légitimes. Cela rend les chercheurs réticents à utiliser les FST comme métriques — un faux rejet gonflant artificiellement le taux d'erreur. Cette préoccupation est légitime mais parfaitement mesurable : quantifier le taux de faux rejets sur des textes de référence validés est une démarche méthodologique élémentaire.

4. **L'insuffisance de la demande.** Très peu d'équipes développent des systèmes de TA pour des langues polysynthétiques, et celles qui s'y attellent (ALT Lab, CNRC, participants d'AmericasNLP) emploient majoritairement chrF++ parce qu'il s'agit du seul outil disponible. Aucune revendication concertée n'a émergé de la communauté de la TA pour langues à faibles ressources en faveur d'une évaluation sensible à la morphologie, d'une part en raison de la taille réduite de cette communauté, d'autre part parce que bâtir de telles métriques réclame une double compétence en ingénierie TALN et dans la morphologie précise de la langue cible.

5. **Le postulat de la métrique neuronale.** Depuis 2020, l'opinion dominante présume que les métriques neuronales résoudront d'elles-mêmes la question morphologique grâce à leurs représentations apprises. L'argument veut que si l'on entraîne COMET sur des volumes suffisants de données issues de langues riches en morphologie, elle apprendra implicitement à gérer les variations morphologiques. Cette intuition peut s'avérer exacte pour des langues morphologiquement denses mais abondamment documentées (finnois, turc, tchèque). Elle a en revanche très peu de chances de se vérifier pour des langues dont la présence est rigoureusement nulle dans les données d'entraînement.

---

## Partie 6 : LYSS — Une alternative linguistiquement fondée

### Ce que champollion a bâti : LYSS (Linguistically-informed Yield & Structural Scoring)

Le banc d'évaluation du projet champollion produit un ensemble de diagnostics linguistiquement informés appelé **LYSS**, présenté aux côtés des métriques conventionnelles. Les exécutions sont classées selon la méthodologie standard, par le score chrF++ à l'échelle du corpus, assorti de son intervalle de confiance et de sa signature sacreBLEU ; les quatre catégories de métriques LYSS ci-dessous sont restituées séparément sous forme de diagnostics et ne sont jamais amalgamées dans ce score principal ([Modalités de notation des exécutions](/docs/network/specifications/scoring#how-runs-are-scored)). Cette dénomination traduit la finalité du système : quantifier le *rendement* (yield — quelle part de sens subsiste après traduction) par une *notation structurelle* (structural scoring — des vérifications déterministes reposant sur la linguistique plutôt que sur des plongements statistiques).

#### 1. Barrière de validité morphologique (Métrique FST GiellaLT)

La métrique la plus simple et la plus largement généralisable : soumettre chaque mot généré par la TA à l'analyseur morphologique à états finis GiellaLT de la langue cible. Si le FST est en mesure d'analyser le terme (s'il renvoie au moins une analyse), le mot est morphologiquement valide. Dans le cas contraire, le terme n'existe pas dans la langue cible — il s'agit alors soit d'une hallucination lexicale, d'une faute morphologique, d'une coquille orthographique, ou d'un emprunt absent du lexique.

**Sortie :** `fst_validity_rate` (0,0–1,0, une valeur plus élevée étant préférable). Macro-moyenne (moyenne des taux par segment) et micro-moyenne (nombre total de mots valides / nombre total de mots).

**Dépendances :** `pyhfst` (interfaces Python pour Helsinki Finite-State Technology), un fichier d'analyseur `.hfstol` compilé pour la langue cible.

**Extensibilité :** Opérationnel pour toute langue disposant d'un analyseur FST GiellaLT — soit plus d'une trentaine de langues à l'heure actuelle, essentiellement des langues samies, ouraliennes et autochtones de l'Arctique.

**Positionnement vis-à-vis des travaux antérieurs :** MorphEval évalue l'aptitude d'un système à gérer des contrastes précis. La métrique FST contrôle si les sorties du système sont constituées de mots réels. Ces approches sont complémentaires : MorphEval mesure la compétence, la métrique FST vérifie la validité.

#### 2. Classes d'équivalence linguistique (Linter CRK)

Le linter s'attaque à ce qui constitue sans doute le biais le plus pernicieux de l'évaluation sur référence : **pénaliser des traductions correctes parce qu'elles s'écartent de la référence fournie**.

Le linter pour le cri des Plaines (844 lignes de code) implémente six **classes de variantes**, chacune traduisant une règle d'équivalence linguistiquement motivée :

- **WORD_ORDER** : Le cri dispose d'un ordre des mots pragmatiquement libre (Wolfart, 1973 §3.2). *nikî-wâpamâw nâpêw* et *nâpêw nikî-wâpamâw* expriment rigoureusement la même réalité. Le linter génère l'ensemble des permutations et vérifie si l'hypothèse coïncide avec l'une d'elles.
- **ORTHOGRAPHIC** : La Standard Roman Orthography comporte des points de variation documentés — accent circonflexe c. macron (*â* c. *ā*), présence ou absence de traits d'union pour les préverbes (*nikî-nipâw* c. *nikî nipâw* c. *nikînipâw*). Le linter procède à leur normalisation.
- **OPTIONAL_PARTICLE** : Certaines particules de discours (*mâka*, *êkwa*, *êwako*) peuvent être insérées ou omises sans que le contenu sémantique fondamental ne change. Le linter contrôle si l'hypothèse concorde avec la référence une fois la particule retirée.
- **LEMMA_SYNONYM** : Certains lemmes cris sont interchangeables dans des contextes donnés. Le module s'appuie sur une nomenclature de synonymes ciblés (notamment des variantes dialectales) et, lorsque le FST est disponible, contrôle si l'hypothèse et la référence partagent les mêmes analyses morphologiques.
- **PROGRESSIVE_AMBIGUITY** : Les formes progressives de l'anglais (« is walking ») peuvent se rendre en cri par différentes tournures syntaxiques. Le linter les identifie comme équivalentes.
- **INCLUSIVE_EXCLUSIVE** : Le cri marque formellement la distinction entre le « nous » inclusif (préfixe *ki-*) et le « nous » exclusif (préfixe *ni-*) — une nuance que l'anglais neutralise sous un unique pronom. Le linter admet la validité de l'une ou l'autre forme dès lors que l'anglais source s'avère ambigu.

Le linter aboutit à trois statuts d'évaluation : **EXACT** (l'hypothèse est identique à la référence), **EQUIVALENT** (l'hypothèse diffère mais relève d'une variante reconnue valide) ou **MISS** (aucune correspondance identifiée). À l'échelle globale, il établit un `equivalent_match_rate` — la proportion de traductions classées exactes ou équivalentes.

**Positionnement vis-à-vis des travaux antérieurs :** Le parallèle le plus immédiat est **HyTER** (Dreyer & Marcu, NAACL-HLT 2012), qui modélise une infinité combinatoire de traductions valides sous forme de réseaux de paraphrases et mesure la distance d'édition jusqu'à la forme valide la plus proche. Notre linter adopte une démarche conceptuellement voisine — en délimitant un espace de traductions valides pour chaque référence —, mais s'appuie sur des règles de transformation d'ordre linguistique plutôt que sur des bases de données de paraphrases. HyTER a été conçu pour l'anglais ; personne n'a développé de réseaux de paraphrases pour le cri. Nos classes de variantes constituent, concrètement, une approximation compacte et fondée sur des règles de ce que HyTER réalise au moyen de graphes.

Au sein du cadre d'analyse CheckList, nos classes de variantes se comportent comme des **tests d'invariance** : des transformations qui ne doivent pas modifier la décision d'évaluation. La différence réside dans le fait que les tests CheckList s'appliquent habituellement au *modèle* ; nos règles de variantes s'appliquent quant à elles à la *métrique*.

#### 3. Validation sémantique déterministe (Métrique sémantique CRK)

Le validateur sémantique (792 lignes de code) vise un objectif plus ambitieux : la **comparaison sémantique déterministe** sans faire appel aux plongements vectoriels neuronaux. Il opère en quatre étapes successives :

1. **Analyse morphologique** : L'hypothèse et la référence sont toutes deux traitées par l'analyseur FST du cri (CRK), qui extrait le lemme et les traits morphologiques de chaque mot.
2. **Résolution des gloses** : Chaque lemme fait l'objet d'une requête sur l'API du dictionnaire itwêwina — qui fédère l'ouvrage de Wolvengrey (2001) ainsi que les dictionnaires de Maskwacîs et des Aînés de l'Alberta — afin d'en extraire les gloses en anglais.
3. **Extraction des mots pleins** : Grâce au pipeline anglais de spaCy (`en_core_web_md`), les mots grammaticaux ou mots-vides sont éliminés à la fois des gloses anglaises et du texte source d'origine.
4. **Calcul du chevauchement** : Le taux de recouvrement des mots pleins entre les gloses de l'hypothèse et celles de la référence détermine le verdict sémantique final.

Le validateur émet des verdicts qualitatifs catégoriels : **EXACT_MATCH**, **VALID** (mots différents mais sémantique préservée), **GRAMMAR_ISSUES** (lemmes corrects mais anomalies grammaticales à l'échelle de la phrase — accords, animacité, morphologie verbale), **PARTIAL** (sens partiellement restitué), **INCOMPLETE** (éléments de sens omis), **WRONG** (sens dénaturé) ou **NO_OUTPUT**.

**Positionnement vis-à-vis des travaux antérieurs :** Il s'agit, au fond, d'une **approximation déterministe du calcul de similarité sémantique opéré par COMET**. Là où COMET mobilise des plongements translinguistiques appris pour juger si deux phrases partagent le même sens, notre validateur enchaîne une série de résolutions déterministes : FST → dictionnaire → spaCy. L'avantage réside dans la transparence (chaque étape est entièrement traçable et reproductible) et l'affranchissement vis-à-vis des données d'entraînement. L'inconvénient réside dans sa rigidité : la pertinence du jugement repose entièrement sur la couverture du FST et l'exhaustivité du dictionnaire.

Cette démarche se rapproche conceptuellement de **MEANT** (Lo & Wu, 2011 ; Lo, 2017), qui recourait à l'étiquetage en rôles sémantiques (SRL) pour contrôler si la structure « qui a fait quoi à qui » subsistait après traduction. Notre approche est plus globale (recouvrement de mots pleins plutôt qu'analyse fine des rôles sémantiques), mais elle s'applique à une langue pour laquelle aucun outil d'étiquetage en rôles sémantiques n'existe.

#### 4. Plugins de détection comportementale (Hallucination, alternance codique, terminologie)

Trois modules complémentaires apportent des **indicateurs qualitatifs comportementaux** qui enrichissent les métriques morphologiques :

- **Détection des hallucinations** (259 lignes) : Agrégation pondérée de quatre signaux heuristiques — gonflement de longueur (40 %), répétitions (30 %), disparité d'entités (20 %), écho de la source (10 %). Ces garde-fous économiques et sans référence interceptent les affabulations grossières des modèles.
- **Détection de l'alternance codique** (~280 lignes) : Analyse conjointe des blocs Unicode et de listes de vocabulaire usuel afin de repérer les tokens non traduits issus de la langue source. Renvoie un `code_switching_rate` (0,0–1,0).
- **Conformité terminologique** (199 lignes) : Contrôle si les termes définis dans un lexique sont traduits avec constance. Renvoie un `terminology_adherence` (0,0–1,0) ou None si aucun lexique n'a été spécifié.

Ces composants se positionnent en toute transparence comme des **détecteurs heuristiques de base**, sans prétendre rivaliser avec l'état de l'art. Leur mérite est de fournir des signaux rapides, interprétables et peu coûteux à évaluer en parallèle des métriques morphologiques plus élaborées. Ils sont présentés en tant qu'éléments de diagnostic et n'interviennent en aucun cas dans le calcul du score principal chrF++.

### Limites admises en toute transparence

Ce dispositif comporte des faiblesses notables qui doivent être clairement formulées avant d'émettre la moindre revendication d'innovation ou de portée générale :

1. **Taux de faux rejets du FST.** Le FST rejettera inévitablement des mots pourtant recevables s'ils ne figurent pas dans son lexique de base — emprunts, néologismes, noms propres, termes en alternance codique. Cela majore artificiellement le taux d'erreur morphologique. Ce taux de faux rejets n'a pas fait l'objet d'une quantification rigoureuse sur un corpus représentatif de textes en cri. Faute d'une telle mesure, la précision brute de la métrique de validité FST demeure indéterminée.

2. **Couverture du dictionnaire.** La fiabilité du validateur sémantique est étroitement tributaire de la complétude du dictionnaire Wolvengrey. Tout mot cri absent de cette nomenclature ne produit aucune glose, ce que le validateur interprète à tort comme un déficit de sens. Le dictionnaire rassemble approximativement entre 18 000 et 22 000 entrées (selon les éditions et les critères de comptage) — un ensemble substantiel, mais loin d'être exhaustif.

3. **Complétude des classes de variantes.** Les six classes de variantes du linter ont été établies à partir de la littérature linguistique et de l'observation empirique des défauts récurrents de la TA. D'autres classes d'équivalence ont pu échapper à cette formalisation — variantes dialectales fines, écarts de registre, synonymes discursifs. Aucun processus formel ne permet d'en garantir l'exhaustivité.

4. **Absence d'étude de corrélation humaine.** Il s'agit de la lacune la plus déterminante : personne n'a à ce jour mesuré si les statuts attribués par le linter (EXACT/EQUIVALENT/MISS) ou par le validateur sémantique sont corrélés aux jugements portés par des locuteurs humains sur la qualité des traductions. Les métriques neuronales consacrent des années à étayer cette corrélation (notamment via les campagnes d'évaluation WMT). Nos métriques ne disposent pas d'une telle validation empirique.

5. **Spécificité linguistique.** Les classes de variantes, les listes de synonymes et les règles d'élision des particules ont été développées exclusivement pour le cri des Plaines. Les adapter au sami du Nord, à l'inuktitut ou à tout autre idiome requiert le concours de linguistes spécialistes de la morphologie, de la syntaxe et des normes orthographiques de ces langues. Le *cadre méthodologique* est transposable ; les *règles* ne le sont pas.

6. **Lacunes d'intégration logicielle.** À l'heure où ces lignes sont écrites, plusieurs métriques de LYSS (semantic_score, equivalent_match_rate, orthographic_accuracy) ne font l'objet que d'une intégration partielle ou en cours de développement dans le banc de test de l'arène ; par conséquent, tous les diagnostics ne sont pas systématiquement produits pour chaque exécution. Auparavant, ces métriques alimentaient un score composite pondéré qui masquait ces manques en redistribuant les coefficients ; ce composite est aujourd'hui abandonné ([pourquoi](/docs/network/specifications/scoring#why-the-composite-was-retired)), et un diagnostic non calculé est tout simplement omis de la fiche de résultats.

### Ce qui serait requis pour valider cette approche

Pour que ce travail atteigne les exigences d'une publication scientifique — quelle que soit la tribune, avec toute la rigueur académique de mise —, la réalisation des expérimentations suivantes s'avère indispensable :

1. **Étude de corrélation avec les jugements humains.** Recueillir des évaluations qualitatives humaines sur un échantillon de traductions Anglais→Cri (idéalement plus de 200 paires de phrases examinées par au moins 3 locuteurs bilingues). Calculer les corrélations statistiques entre ces notes humaines et chacune de nos métriques. C'est l'étape de validation majeure. Sans elle, ces métriques restent de purs artefacts d'ingénierie logicielle, et non des outils d'évaluation validés.

2. **Mesure du taux de faux rejets du FST.** Exécuter l'analyseur FST sur un corpus de textes cris de référence incontestable (textes édités, corpus parallèles vérifiés) et quantifier la proportion de termes légitimes rejetés. Cette mesure permettra d'établir précisément la précision de la métrique de validité FST.

3. **Validation sur une seconde langue.** Porter la métrique de validité FST sur une seconde langue issue de GiellaLT (très probablement le sami du Nord, qui bénéficie de l'analyseur FST le plus abouti de cet écosystème). Démontrer que la métrique produit des résultats pertinents sur des sorties de TA en sami. Cela donnera du poids à notre argument d'extensibilité.

4. **Comparaison face à COMET.** Évaluer COMET sur les mêmes données en cri et confronter ses résultats à nos métriques ainsi qu'aux jugements humains. Si COMET fournit des scores sensés pour le cri (ce dont nous doutons fortement, sans avoir pu l'éprouver), nos métriques devront la surpasser pour justifier leur utilité. Si COMET ne génère qu'un bruit statistique aléatoire (ce à quoi nous nous attendons), cela viendra légitimer la nécessité de notre méthodologie.

5. **Complément diagnostique inspiré de MorphEval.** Structurer un jeu de test ciblé (de 50 à 100 contrastes) inspiré de MorphEval pour le cri des Plaines, articulé autour des traits morphologiques les plus saillants de la langue (obviatif, voix inverse, ordres conjonctif/indépendant, nous inclusif/exclusif). Y soumettre différents systèmes de TA et démontrer que les diagnostics obtenus sont directement exploitables pour l'ingénierie linguistique.

6. **Audit d'intégration logicielle.** Corriger les insuffisances d'intégration des plugins répertoriées dans la base de code, de telle sorte que chaque diagnostic LYSS génère systématiquement une valeur dès lors que ses ressources associées (FST, dictionnaire, règles du linter) sont présentes.

---

## Partie 7 : Positionnement et travaux futurs

### Positionnement de LYSS dans le paysage de l'évaluation

Une taxonomie objective des différentes méthodologies d'évaluation en TA :

| Dimension | Métriques de surface (BLEU, chrF++) | Métriques neuronales (COMET, MetricX) | LLM comme juge (GEMBA) | Diagnostic (MorphEval, CheckList) | **LYSS** |
|-----------|-------------------------------|---|----|-------|--------|
| Nature du signal | Chevauchement de surface | Similarité sémantique apprise | Jugement ouvert | Sondes ciblées de capacités | Validité morphologique + équivalence par règles |
| Données d'entraînement requises | Aucune | Jugements humains (plusieurs milliers) | LLM pré-entraîné | Jeux de tests conçus par des linguistes | FST + dictionnaire + règles de variantes |
| Applicabilité aux langues peu dotées (LRL) | Universelle mais faible | Restreinte par la couverture de l'encodeur | Restreinte par la couverture du LLM | Restreinte par la conception des jeux de tests | Restreinte par l'existence d'un FST (~30 langues) |
| Référence requise | Oui | Oui (ou QE sur source seule) | Optionnelle | Oui (contrastive) | Oui (LYSS-eq/LYSS-sem) / Non (LYSS-fst) |
| Interprétabilité | Faible (score numérique) | Faible (score numérique) | Élevée (justification textuelle) | Élevée (succès/échec par phénomène) | Élevée (décisions explicites + classes de variantes) |

**LYSS n'est pas** : un substitut à COMET pour les langues abondamment dotées, une métrique universelle, ni la toute première initiative d'évaluation sensible à la morphologie.

**LYSS est** : un cadre méthodologique intégré qui restitue la validation morphologique par FST sous forme de diagnostics aux côtés des métriques de référence (sans remplacer ni altérer le score principal chrF++), conçu spécifiquement pour les langues où les métriques neuronales font défaut mais pour lesquelles des ressources formelles (FST, dictionnaires) sont disponibles. Il s'articule autour de trois modules fondamentaux :
- **LYSS-fst** — Contrôle de validité morphologique par FST (`fst_acceptance_rate`)
- **LYSS-eq** — Équivalence linguistique établie par le linter (`equivalent_match_rate`)
- **LYSS-sem** — Validation sémantique déterministe (`semantic_score`)

**LYSS étend** : l'intuition centrale de MorphEval (mobiliser des outils morphologiques pour l'évaluation), en faisant évoluer un test diagnostique de compétence vers des métriques d'évaluation continues à l'échelle d'un corpus.

**LYSS complète** : chrF++ (qui accorde un crédit partiel aux morphèmes partagés sans pouvoir constater d'équivalence syntaxique), COMET (qui raisonne dans un espace sémantique mais manque de données pour les langues peu dotées) et FUSE (qui s'appuie sur une ingénierie de descripteurs sans recourir aux analyseurs morphologiques).

**Les antécédents les plus directs sont** : Hjerson (classification linguistique des erreurs) + HyTER (classes d'équivalence modélisées par graphes de paraphrases) + la métrique de couverture naïve d'Apertium (validation lexicale par FST). L'apport de LYSS ne réside pas dans une technique isolée, mais dans l'articulation cohérente de ces approches — en particulier la validité par FST et l'équivalence par règles — au sein d'un environnement d'évaluation opérationnel dédié à une langue polysynthétique.

### Intégration de MorphEval

La démarche de jeux d'évaluation contrastifs de MorphEval et notre principe de notation continue fonctionnent de manière complémentaire :

- **MorphEval** répond à : « Ce système maîtrise-t-il la marque du temps ? L'accord en nombre ? L'assignation des cas ? »
- **Notre métrique FST** répond à : « Ce système a-t-il généré des mots réels ? »
- **Notre linter** répond à : « Cette traduction est-elle équivalente à la référence malgré leurs divergences de surface ? »
- **Notre validateur sémantique** répond à : « Cette traduction exprime-t-elle le sens attendu ? »

MorphEval est un projet open source. Développer un banc d'essai contrastif pour le cri des Plaines nécessiterait qu'un linguiste formalise des paires contrastives représentatives des spécificités morphologiques du cri (obviation, voix inverse, ordres conjonctif et indépendant, pronom « nous » inclusif/exclusif, chaînes de préverbes). Ce travail représente un investissement substantiel mais bien délimité — quelques semaines, et non des mois — et conférerait des capacités de diagnostic qu'aucun autre outil d'évaluation n'offre actuellement pour le cri.

### La question de l'extensibilité

Quelles autres langues pourraient tirer parti de cette méthodologie ? Le facteur contraignant réside dans la disponibilité d'un FST. L'infrastructure GiellaLT fournit des analyseurs morphologiques pour plus d'une trentaine de langues, regroupées pour l'essentiel en trois familles :

- **Langues samies** (sami du Nord, sami de Lule, sami du Sud, sami skolt, sami d'Inari) : Des analyseurs FST très matures avec une large couverture. Le sami du Nord représente la cible d'adaptation la plus immédiate.
- **Langues ouraliennes** (finnois, estonien, komi, erza, mokcha) : Analyseurs très aboutis, bien que le finnois et l'estonien n'aient pas un besoin aussi pressant d'évaluation par FST (bénéficiant d'une bien meilleure couverture par les métriques neuronales).
- **Langues autochtones de l'Arctique** (inuktitut via Uqailaut, groenlandais) : Des analyseurs sont disponibles, bien que leur complétude soit variable.
- **Autres langues GiellaLT** : Féroïen, irlandais, cornique, live, et d'autres présentant divers stades de maturité pour leurs FST.

Au-delà de GiellaLT, la plateforme **Apertium** met à disposition des analyseurs morphologiques pour une quarantaine de paires de langues. L'écosystème **HFST** (Helsinki Finite-State Technology) constitue l'infrastructure sous-jacente partagée à la fois par GiellaLT et Apertium ; tout analyseur issu d'Apertium pourrait donc être intégré selon les mêmes modalités dans notre métrique de validité FST.

L'obstacle pratique majeur ne se situe pas dans l'accès aux FST, mais dans la **définition des classes de variantes**. Les règles d'équivalence du linter imposent une expertise linguistique approfondie propre à chaque langue cible. Pour le sami du Nord, cela exigerait d'assimiler la flexibilité syntaxique de la langue, ses conventions graphiques et ses variations dialectales. Pour l'inuktitut, il faudrait modéliser une morphologie polysynthétique à un niveau d'exigence comparable à ce qui a été réalisé pour le cri. En revanche, la métrique de validité morphologique par FST peut être mise en service immédiatement pour toute langue disposant d'un analyseur GiellaLT — sans exiger le moindre travail linguistique préalable.

### Vers une publication scientifique

Une valorisation académique issue de ces travaux s'adresserait naturellement à l'une des conférences suivantes :

- **WMT Metrics Shared Task** (adossée à EMNLP) : Le lieu de diffusion le plus naturel. Cela nécessiterait de soumettre les métriques dans le cadre de la compétition et de les tester sur les corpus d'évaluation du WMT — qui n'intègrent pour l'instant aucune langue polysynthétique. Une contribution sous forme d'article synthétique (« findings ») ou une participation à la sous-tâche des challenge sets serait envisageable.
- **LREC-COLING** (Language Resources and Evaluation Conference) : Parfaitement adapté pour un article de type ressources et outils (resource/tool paper) détaillant l'architecture d'évaluation et les ressources linguistiques sollicitées (FST, dictionnaires, règles de variantes).
- **ACL ou NAACL** (conférence générale) : Exigerait impérativement l'étude de corrélation humaine ainsi qu'une démonstration sur au moins une seconde langue pour franchir les critères d'acceptation d'une conférence principale.
- **Atelier AmericasNLP** : Le public le plus réceptif aux problématiques de TA pour les langues autochtones. Les exigences de publication y sont plus souples, mais l'impact au sein de la communauté directement concernée est maximal.
- **ComputEL** (Computational Approaches to Endangered Languages) : Tribune ciblée et sur mesure pour ce type de démarche.

Tout projet de publication devra associer des co-auteurs possédant une solide expertise en linguistique du cri (pour valider les classes de variantes et éclairer l'interprétation des résultats) et, idéalement, des locuteurs cris bilingues (pour assurer les évaluations qualitatives humaines au cœur de l'étude de corrélation). Cette condition n'est pas négociable — un article traitant de l'évaluation de la TA pour le cri conçu exclusivement par des personnes extérieures à la langue ne serait, au mieux, qu'incomplet, et au pire, une perpétuation des approches de recherche extractives que notre milieu s'efforce désormais de dépasser.

---

## Annexe A : Matrice des prérequis par métrique

| Métrique | Référence requise ? | Source requise ? | Modèle entraîné ? | Ressources linguistiques dédiées ? | Opérationnelle sur LRL ? |
|--------|-------------------|---------------|----------------|------------------------------|----------------|
| BLEU | Oui | Non | Non | Non | Médiocre |
| chrF++ | Oui | Non | Non | Non | Supérieure à BLEU |
| METEOR | Oui | Non | Non | Outil de racinisation + WordNet | Uniquement si les ressources existent |
| TER | Oui | Non | Non | Non | Identique à BLEU |
| BERTScore | Oui | Non | Oui (mBERT) | Non | Tributaire de la couverture du modèle |
| BLEURT | Oui | Non | Oui (entraîné) | Non | Tributaire des données d'entraînement |
| COMET | Oui | Oui | Oui (XLM-R) | Non | Tributaire de la couverture de XLM-R |
| CometKiwi | Non | Oui | Oui (XLM-R) | Non | Tributaire de la couverture de XLM-R |
| GEMBA | Optionnelle | Oui | Oui (LLM) | Non | Tributaire de la couverture du LLM |
| **Validation par FST** | **Non** | **Non** | **Non** | **Oui (analyseur FST)** | **Oui, si un FST existe** |
| **Linter CRK** | **Oui** | **Non** | **Non** | **Oui (FST + règles de variantes)** | **Oui, si les ressources existent** |
| **Métrique sémantique CRK** | **Oui** | **Optionnelle** | **Non** | **Oui (FST + dictionnaire + spaCy)** | **Oui, si les ressources existent** |
| Détection d'hallucinations | Non | Oui | Non | Non | Oui |
| Détection d'alternance codique | Optionnelle | Oui | Non | Minimes | Oui |
| MorphEval | Oui (contrastive) | Oui | Non | Oui (jeu de test + analyseur) | Uniquement si le jeu de test existe |

## Annexe B : Publications de référence

| Référence | Conférence / Revue | Pertinence |
|----------|-------|-----------|
| Papineni et al. (2002). BLEU: a Method for Automatic Evaluation of Machine Translation | ACL 2002 | La métrique qui a façonné le domaine |
| Doddington (2002). Automatic Evaluation of Machine Translation Quality Using N-gram Co-Occurrence Statistics | HLT 2002 | Pondération de l'appariement de n-grammes par le contenu d'information |
| Banerjee & Lavie (2005). METEOR: An Automatic Metric for MT Evaluation | ACL 2005 Workshop | Racinisation, synonymes, alignement de mots |
| Snover et al. (2006). A Study of Translation Edit Rate | AMTA 2006 | Distance d'édition avec déplacements de syntagmes |
| Popović & Ney (2011). Morphemes and POS tags for n-gram based evaluation metrics | WMT 2011 | Classification des erreurs par Hjerson |
| Dreyer & Marcu (2012). HyTER: Meaning-Equivalent Semantics for Translation Evaluation | NAACL-HLT 2012 | Classes d'équivalence via réseaux de paraphrases |
| Lommel et al. (2014). Multidimensional Quality Metrics | — | Typologie d'erreurs MQM |
| Popović (2015). chrF: character n-gram F-score for automatic MT evaluation | WMT 2015 | Évaluation au niveau des caractères |
| Popović (2017). chrF++: words helping character n-grams | WMT 2017 | Évaluation conjointe n-grammes de caractères et de mots |
| Burlot & Yvon (2017). Evaluating the Morphological Competence of Machine Translation Systems | WMT 2017 | Jeux de tests morphologiques contrastifs |
| Sennrich (2017). How Grammatical is Character-level Neural Machine Translation? | EACL 2017 | Paires contrastives de LingEval97 |
| Isabelle, Cherry & Foster (2017). A Challenge Set Approach to Evaluating Machine Translation | EMNLP 2017 | Tests ciblés sur les divergences structurelles |
| Post (2018). A Call for Clarity in Reporting BLEU Scores | WMT 2018 | Standardisation avec sacreBLEU |
| Reiter (2018). A Structured Review of the Validity of BLEU | Computational Linguistics | Méta-analyse de la corrélation entre BLEU et les jugements humains |
| Stanovsky, Smith & Zettlemoyer (2019). Evaluating Gender Bias in Machine Translation | ACL 2019 | Évaluation des biais de genre avec WinoMT |
| Ribeiro et al. (2020). Beyond Accuracy: Behavioral Testing of NLP Models with CheckList | ACL 2020 (Meilleur article) | Tests unitaires par capacités pour le TALN |
| Zhang et al. (2020). BERTScore: Evaluating Text Generation with BERT | ICLR 2020 | Similarité sémantique par plongements vectoriels |
| Sellam et al. (2020). BLEURT: Learning Robust Metrics for Text Generation | ACL 2020 | Métrique pré-entraînée et ajustée |
| Rei et al. (2020). COMET: A Neural Framework for MT Evaluation | EMNLP 2020 | Évaluation trilingue translinguistique |
| Freitag et al. (2021). Results of the WMT 2021 Metrics Shared Task | WMT 2021 | Méta-évaluation reposant sur MQM |
| Thompson & Post (2020). PRISM: Automatic MT Evaluation via Zero-Shot Paraphrasing | EMNLP 2020 | TAN multilingue comme estimateur de paraphrase |
| Currey et al. (2022). MT-GenEval | EMNLP 2022 | Exactitude contrefactuelle du genre |
| Amrhein et al. (2022). ACES: Translation Accuracy Challenge Sets | WMT 2022 | 68 phénomènes linguistiques, 146 paires de langues |
| Kocmi & Federmann (2023). GEMBA: Large Language Models Are State-of-the-Art Evaluators | EAMT 2023 | Les LLM comme évaluateurs |
| Guerreiro et al. (2024). xCOMET: Transparent MT Evaluation through Fine-grained Error Detection | TACL 2024 | Détection fine des segments d'erreur |
| Wang & Adelani (2024). AfriMTE and AfriCOMET | NAACL 2024 | Métriques neuronales pour les langues africaines |
| Juraska et al. (2024). MetricX-24 | WMT 2024 | Métrique lauréate basée sur mT5 |

## Annexe C : Glossaire des termes d'évaluation

| Terme | Définition |
|------|------------|
| **Adéquation** | Propriété d'une traduction qui transmet fidèlement le sens de la source. |
| **Fluidité** | Propriété d'une traduction qui est grammaticale et naturelle dans la langue cible. |
| **Direct Assessment (DA)** | Méthode d'évaluation humaine où les annotateurs notent les traductions sur une échelle continue de 0 à 100. |
| **MQM** | Multidimensional Quality Metrics — méthode d'évaluation humaine basée sur l'annotation de segments d'erreur typés avec gravité pondérée. |
| **Estimation de la qualité (QE)** | Prédiction de la qualité d'une traduction en l'absence de toute traduction de référence. |
| **FST** | Transducteur à états finis (Finite-State Transducer) — automate computationnel qui encode les règles morphologiques d'une langue. |
| **GiellaLT** | Infrastructure logicielle pour technologies langagières à base de règles, dédiée principalement aux langues samies et arctiques. |
| **HFST** | Helsinki Finite-State Technology — socle logiciel sur lequel s'appuient GiellaLT et Apertium. |
| **SRO** | Standard Roman Orthography — système d'écriture basé sur l'alphabet latin utilisé pour le cri des Plaines. |
| **Syllabaire** | Syllabaire autochtone canadien — système d'écriture de type abugida employé pour le cri et d'autres langues algonquiennes. |
| **Polysynthétique** | Type de langue où un mot unique peut exprimer l'équivalent d'une phrase entière grâce à un riche système d'affixation. |
| **Obviation** | Catégorie grammaticale des langues algonquiennes distinguant deux référents de troisième personne (proximatif c. obviatif). |
| **Voix inverse** | Catégorie actancielle des langues algonquiennes indiquant que le patient surpasse l'agent sur l'échelle d'animacité. |
| **WMT** | Conference on Machine Translation — conférence et campagne d'évaluation de référence pour la traduction automatique. |
| **Évaluation contrastive** | Approche consistant à tester la capacité d'un système à discriminer des entrées minimalement différentes nécessitant des sorties distinctes. |
| **Jeu de défis (Challenge set)** | Jeu de données d'évaluation ciblé conçu pour éprouver des phénomènes linguistiques spécifiques. |
| **Classe d'équivalence** | Ensemble de formulations de surface distinctes qui partagent le même sens et doivent recevoir une note identique. |

## Où cela mène-t-il sur ce site

Les réponses propres apportées par Champollion aux défis décrits ici sont exposées dans la
[Spécification de notation](/docs/network/specifications/scoring) (quelle métrique
est prise en compte, et dans quel contexte), la [Fiabilité des métriques](/docs/network/specifications/metric-reliability)
(à quelle métrique se fier selon la langue cible), ainsi que le
[Cadre de conception des corpus](/docs/network/specifications/corpus-design)
(comment un jeu de données de test acquiert sa légitimité méthodologique).
