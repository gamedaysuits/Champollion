# Traduction automatique : Un rapport de terrain (2013–2026)

*Un historique narratif pour quiconque entre dans le paysage de la TA*

---

## Table des matières

- [Partie 1 : La révolution neuronale (2013–2017)](#partie-1--la-révolution-neuronale-20132017)
- [Partie 2 : Le tournant multilingue (2018–2022)](#partie-2--le-tournant-multilingue-20182022)
- [Partie 3 : L'ère des LLM (2022–2026)](#partie-3--lère-des-llm-20222026)
- [Partie 4 : Le problème des ressources limitées](#partie-4--le-problème-des-ressources-limitées)
- [Partie 5 : Transducteurs à états finis et systèmes fondés sur des règles](#partie-5--transducteurs-à-états-finis-et-systèmes-fondés-sur-des-règles)
- [Partie 6 : Mesurer la qualité — Le problème de l'évaluation](#partie-6--mesurer-la-qualité--le-problème-de-lévaluation)
- [Partie 7 : Le paysage institutionnel](#partie-7--le-paysage-institutionnel)
- [Partie 8 : Frontières ouvertes](#partie-8--frontières-ouvertes)
- [Annexe A : Articles clés](#annexe-a--articles-clés)
- [Annexe B : Conférences et communautés](#annexe-b--conférences-et-communautés)
- [Annexe C : Outils, ensembles de données et ressources pratiques](#annexe-c--outils-ensembles-de-données-et-ressources-pratiques)
- [Annexe D : Glossaire](#annexe-d--glossaire)

---

## Partie 1 : La révolution neuronale (2013–2017)

### L'ancien régime : Traduction automatique statistique

Pour comprendre la révolution qui a remodelé la traduction automatique au milieu des années 2010, vous devez d'abord comprendre ce qui l'a précédée — et pourquoi cela s'est effondré.

De 2003 à 2015 environ, le paradigme dominant en TA était la **Traduction Automatique Statistique (TAS)**, en particulier la **TAS fondée sur des phrases**. L'idée centrale était trompeusement simple : plutôt que d'écrire des règles sur le fonctionnement du langage, vous rassemblez d'énormes quantités de texte parallèle — des documents traduits par des humains dans deux langues — et vous laissez les algorithmes statistiques apprendre les correspondances. Le système décomposerait une phrase source en phrases chevauchantes (non des phrases linguistiques, mais des fragments n-grammes arbitraires), trouverait des traductions statistiquement probables pour chaque fragment, puis assemblerait une phrase cible en utilisant un **modèle de langage** qui assurait que la sortie était fluide.

L'outil de travail de cette époque était **Moses**, une boîte à outils TAS open-source développée principalement à l'Université d'Édimbourg sous la direction de Philipp Koehn, lancée en 2006. Moses est devenu le Linux de la recherche en TA — pratiquement tous les laboratoires de recherche en TA du monde l'utilisaient. Son compagnon, **cdec** (développé par Chris Dyer à Carnegie Mellon), offrait des capacités similaires avec un formalisme différent. Ensemble, ces outils ont défini une décennie de recherche en TA.

La TAS fondée sur des phrases fonctionnait étonnamment bien pour les paires de langues disposant de données parallèles abondantes et d'un ordre des mots similaire — anglais–français, anglais–espagnol, anglais–allemand. Mais elle avait des limitations structurelles profondes. Le système n'avait aucune notion de sens. C'était de la reconnaissance de motifs sur des chaînes de surface, assemblant des traductions à partir de fragments mémorisés. Il avait du mal avec les dépendances à longue portée (un pronom se référant à un nom plusieurs clauses plus loin), avec la réorganisation entre langues typologiquement différentes (anglais–japonais, par exemple, où les verbes apparaissent dans des positions opposées), et avec tout phénomène nécessitant une véritable abstraction sur la structure du langage. Chaque amélioration exigeait une ingénierie de plus en plus baroque : règles de réorganisation faites à la main, caractéristiques éparses, modèles de langage massifs. L'architecture approchait de son plafond.

### La percée : Séquence-à-séquence avec attention

La première fissure dans le paradigme TAS ne venait pas de la communauté TA, mais de chercheurs en apprentissage profond travaillant sur des problèmes de modélisation de séquences.

En septembre 2014, **Dzmitry Bahdanau, Kyunghyun Cho et Yoshua Bengio** à l'Université de Montréal ont publié un article qui s'avérerait transformateur : [« Neural Machine Translation by Jointly Learning to Align and Translate »](https://arxiv.org/abs/1409.0473) (présenté à ICLR 2015). L'innovation clé était le **mécanisme d'attention**.

Pour comprendre pourquoi cela importait, vous avez besoin du contexte antérieur. Quelques mois plus tôt, Ilya Sutskever, Oriol Vinyals et Quoc V. Le chez Google avaient publié [« Sequence to Sequence Learning with Neural Networks »](https://arxiv.org/abs/1409.3215) (NIPS 2014), démontrant qu'un réseau de neurones avec une architecture **encodeur–décodeur** pouvait traduire des phrases. L'encodeur lit la phrase source mot par mot et la compresse en un seul vecteur de longueur fixe — un résumé numérique de l'ensemble de l'entrée. Le décodeur génère ensuite la phrase cible mot par mot à partir de ce vecteur.

C'était élégant mais avait un défaut critique : le vecteur unique était un **goulot d'étranglement**. Toute l'information dans une phrase source de trente mots devait être comprimée dans un vecteur de, disons, 1 000 nombres. Les phrases courtes se traduisaient raisonnablement bien ; les phrases longues se dégradaient mal, car le modèle oubliait les mots antérieurs au moment où il finissait d'encoder les mots ultérieurs.

Le mécanisme d'attention de Bahdanau a résolu ce problème. Au lieu de compresser l'ensemble de la source en un vecteur, le décodeur était autorisé à **regarder en arrière** tous les états cachés de l'encodeur — les représentations intermédiaires à chaque position source — et pondérer dynamiquement quelles positions étaient les plus pertinentes pour générer chaque mot cible. Lors de la production du mot anglais « cat », le modèle pouvait se concentrer fortement sur le mot français « chat » dans la source, même s'ils étaient loin l'un de l'autre dans la phrase. Le modèle a appris à *aligner* les mots source et cible dans le cadre du processus de traduction, plutôt que de s'appuyer sur un seul résumé comprimé.

C'était l'innovation fondatrice. L'attention n'a pas seulement amélioré la TA ; elle est devenue le mécanisme central de pratiquement tous les progrès ultérieurs du traitement du langage naturel.

### Google devient neuronal

Les résultats académiques de 2014–2015 étaient impressionnants mais pas encore prêts pour la production. Cela a changé à la fin de 2016.

En septembre 2016, une grande équipe chez Google dirigée par **Yonghui Wu** a publié [« Google's Neural Machine Translation System: Bridging the Gap Between Human and Machine Translation »](https://arxiv.org/abs/1609.08144). Le système, connu sous le nom de **GNMT** (Google Neural Machine Translation), était une architecture encodeur–décodeur à l'échelle industrielle avec attention, entraînée sur les vastes ressources de données parallèles de Google. L'article faisait une affirmation frappante : sur certaines paires de langues, GNMT réduisait les erreurs de traduction de 55–85 % par rapport au système TAS fondé sur des phrases existant de Google.

En novembre 2016, Google a commencé à basculer silencieusement Google Traduction de la TAS fondée sur des phrases vers GNMT pour les paires de langues majeures. La transition était essentiellement complète pour les paires à ressources élevées en 2017. Pour les utilisateurs, le changement était dramatique. Les traductions qui avaient auparavant lu comme raides, fragmentées et occasionnellement dénuées de sens sont devenues substantiellement plus fluides — parfois étonnamment. L'ère du « charabia de Google Traduction » comme plaisanterie prenait fin.

La réponse concurrentielle fut rapide. En août 2017, **DeepL**, fondé par **Gereon Frahling** à Cologne, en Allemagne, a lancé son service de traduction. DeepL était issu du projet de concordance bilingue Linguee et s'est différencié par la qualité perçue de ses traductions — en particulier pour les paires de langues européennes, où il a rapidement acquis une réputation auprès des traducteurs professionnels pour produire des résultats plus naturels et idiomatiques que Google. Le modèle économique de DeepL (freemium avec une API payante) et l'accent mis sur la qualité plutôt que sur l'étendue allaient définir sa position sur le marché à l'avenir. DeepL prend en charge environ 33 langues — bien moins que les 194 de la liste Cloud Translation de Google — mais avec un positionnement axé sur la qualité avant tout.

### Le Transformer

Si le mécanisme d'attention de Bahdanau était la fondation, alors le **Transformer** était le bâtiment construit dessus — et le bâtiment était un gratte-ciel.

En juin 2017, une équipe de huit chercheurs chez Google — **Ashish Vaswani, Noam Shazeer, Niki Parmar, Jakob Uszkoreit, Llion Jones, Aidan N. Gomez, Łukasz Kaiser et Illia Polosukhin** — ont publié [« Attention Is All You Need »](https://arxiv.org/abs/1706.03762) à NIPS 2017. Le titre n'était pas une hyperbole ; c'était une affirmation architecturale précise. Là où les modèles précédents utilisaient des réseaux de neurones récurrents (RNN) comme épine dorsale — traitant les mots séquentiellement, un à la fois, comme lire une phrase de gauche à droite — le Transformer a abandonné la récurrence entièrement et s'est appuyé uniquement sur l'attention.

Les innovations clés étaient :

1. **Auto-attention** : Chaque mot dans une phrase fait attention à tous les autres mots dans la même phrase, calculant les relations en parallèle plutôt que séquentiellement. Cela capture les dépendances à longue portée sans le goulot d'étranglement d'information des RNN, et — de manière cruciale — cela se parallélise sur le matériel moderne (GPU et TPU), rendant l'entraînement dramatiquement plus rapide.

2. **Attention multi-têtes** : Plutôt que de calculer un seul motif d'attention, le modèle calcule plusieurs motifs d'attention simultanément (« têtes »), chacun capturant potentiellement différents types de relations linguistiques — syntaxiques, sémantiques, positionnelles.

3. **Codage positionnel** : Puisque l'auto-attention traite tous les mots simultanément (contrairement aux RNN, qui traitent séquentiellement), le modèle n'a pas de notion inhérente de l'ordre des mots. Les codages positionnels — des fonctions mathématiques injectées dans l'entrée — fournissent cette information.

Le Transformer n'a pas seulement surpassé les modèles basés sur RNN sur les benchmarks de traduction. Il s'entraînait **des ordres de grandeur plus rapidement** en raison de son parallélisme. C'était probablement aussi important que l'amélioration de la qualité : les chercheurs pouvaient maintenant itérer plus rapidement, s'entraîner sur plus de données, et passer à l'échelle vers des modèles plus grands. Le cycle vertueux de l'échelle avait commencé.

En deux ans, l'architecture Transformer était devenue le substrat pour essentiellement tous les travaux de pointe en NLP — non seulement la TA, mais la modélisation du langage, la classification de texte, la réponse aux questions, la synthèse, et finalement les grands modèles de langage (GPT, BERT, LLaMA) qui remodelleraient le paysage plus large de l'IA. Chaque système discuté dans le reste de ce rapport est construit sur le Transformer.

### Le bassin versant de WMT 2016

La **Conférence sur la Traduction Automatique** (WMT), tenue annuellement en tant qu'atelier co-localisé avec les grandes conférences NLP, exécute des **tâches partagées** compétitives où les équipes de recherche soumettent des systèmes TA et sont classées les unes contre les autres sur des ensembles de tests standardisés. WMT est la chose la plus proche que le domaine de la TA ait d'un classement public.

À **WMT 2016**, les systèmes TA neuronaux ont surpassé de manière décisive les systèmes TAS fondés sur des phrases sur pratiquement toutes les paires de langues dans la tâche partagée. C'était le moment où le centre de gravité du domaine s'est déplacé. Les chercheurs qui avaient passé des carrières à construire des systèmes fondés sur des phrases ont commencé à se réoutiller pour le paradigme neuronal. En deux ans, les nouvelles publications utilisant la TAS fondée sur des phrases pour autre chose que la comparaison historique avaient essentiellement cessé. Moses, l'outil qui avait défini une décennie, était fonctionnellement retiré.

La transition a été remarquablement rapide selon les normes des changements de paradigme académiques — peut-être trois à quatre ans du document de Bahdanau en 2014 à la domination quasi-complète de la TA neuronale en 2018. Pour un chercheur entrant dans ce domaine aujourd'hui, la TAS fondée sur des phrases est un contexte historique, pas une direction de recherche active. Mais c'est un contexte essentiel, car les hypothèses, les benchmarks et les habitudes d'évaluation de l'ère TAS résonnent encore dans le domaine.

---

## Partie 2 : Le tournant multilingue (2018–2022)

### Un modèle, plusieurs langues

Les systèmes TA neuronaux de première génération étaient **bilingues** : un modèle par paire de langues. Anglais–français nécessitait un modèle ; français–anglais en nécessitait un séparé. Mettre à l'échelle cette approche à N langues nécessitait théoriquement N×(N−1) modèles — un goulot d'étranglement d'ingénierie et de données qui limitait effectivement la TA neuronale à une poignée de paires bien dotées en ressources.

La question qui a défini 2018–2022 était : *un seul modèle neuronal peut-il apprendre à traduire entre plusieurs langues à la fois ?* La réponse s'est avérée être oui, avec des conséquences profondes et compliquées.

### Représentations cross-lingues : mBERT et XLM-R

Avant l'arrivée des modèles de traduction multilingues, une découverte inattendue dans les modèles de *compréhension* du langage a préparé le terrain.

À la fin de 2018, Google a lancé **Multilingual BERT (mBERT)** — un seul modèle Transformer entraîné sur le texte Wikipedia de 104 langues. BERT (Bidirectional Encoder Representations from Transformers) n'était pas un modèle de traduction ; c'était un encodeur de langage à usage général, entraîné pour prédire les mots masqués dans le texte. Ce qui a surpris les chercheurs était une propriété émergente : mBERT a développé des **représentations cross-lingues** sans jamais être explicitement enseigné que les langues étaient liées. Si vous affiniez mBERT sur une tâche de classification de sentiment en anglais puis l'appliquiez au texte français — sans aucune donnée d'entraînement en français — il fonctionnait remarquablement bien. Ce phénomène, appelé **transfert cross-lingue zéro-shot**, suggérait que les modèles multilingues apprenaient une sorte d'espace de représentation partagé entre les langues.

En 2020, **Alexis Conneau** et ses collègues à Facebook AI Research (maintenant Meta) ont poussé cela plus loin avec **XLM-R** (Cross-lingual Language Model – RoBERTa). Entraîné sur 2,5 téraoctets de données CommonCrawl filtrées sur 100 langues, XLM-R a considérablement surpassé mBERT sur les benchmarks cross-lingues. Il a démontré qu'avec suffisamment de données et de capacité de modèle, un seul encodeur pouvait construire des représentations multilingues robustes.

Ces modèles n'étaient pas eux-mêmes des traducteurs, mais ils ont fourni la fondation conceptuelle et technique pour la TA multilingue. Si un modèle pouvait apprendre des représentations partagées sur 100 langues, alors un modèle de traduction devrait pouvoir traduire entre elles — du moins en principe.

### Traduction plusieurs-vers-plusieurs : M2M-100

Les systèmes TA multilingues traditionnels avaient un secret peu reluisant : ils acheminaient la plupart des traductions **par l'anglais**. Traduire du portugais vers le japonais signifiait d'abord traduire le portugais en anglais, puis l'anglais en japonais. Cette approche « centrée sur l'anglais » était pragmatique — la plupart des données parallèles impliquent l'anglais d'un côté — mais elle introduisait des erreurs composées et imposait la structure de la langue anglaise sur chaque traduction.

En octobre 2020, Facebook AI a publié **M2M-100** (Fan et al., [« Beyond English-Centric Multilingual Machine Translation »](https://arxiv.org/abs/2010.11125), JMLR 2021) : un modèle de traduction plusieurs-vers-plusieurs couvrant **100 langues et 2 200 directions de traduction** sans passer par l'anglais. C'était une percée conceptuelle. Le modèle pouvait traduire directement entre, disons, le bengali et le swahili, en utilisant des données parallèles extraites du web pour les paires non-anglaises.

M2M-100 a prouvé que le pivotage par l'anglais n'était pas une contrainte nécessaire de la TA multilingue. Mais il a aussi révélé les limites de l'approche : la qualité était très inégale entre les paires de langues, certaines directions étant à peine utilisables. L'écart entre « ce modèle *couvre* 2 200 directions » et « ce modèle *fonctionne bien* dans 2 200 directions » deviendrait un thème central.

### NLLB-200 : Aucune langue laissée de côté

L'effort TA multilingue le plus ambitieux de Meta est arrivé en juillet 2022 avec **NLLB-200** ([« No Language Left Behind: Scaling Human-Centered Machine Translation »](https://arxiv.org/abs/2207.04672), publié en tant que document de recherche Meta AI avec plus de 200 co-auteurs). L'objectif était explicite dans le nom : construire un seul modèle supportant 200 langues, avec un accent particulier sur les langues à ressources limitées précédemment ignorées par la TA commerciale.

Les contributions techniques de NLLB-200 étaient substantielles :

- **Architecture** : Un Transformer dense et une variante **Mixture-of-Experts (MoE)**, où différents sous-ensembles des paramètres du modèle s'activent pour différentes paires de langues. La plus grande variante, NLLB-200-MoE-54B, avait 54 milliards de paramètres. Une version distillée de 600M paramètres rendait le déploiement réalisable.

- **Extraction de données** : L'équipe a développé des outils automatisés pour extraire des phrases parallèles des crawls web, incluant un modèle d'identification de langue (couvrant 200+ langues) et un filtre de phrases parallèles. Ce pipeline était critique pour rassembler les données d'entraînement pour les langues avec une présence web minimale.

- **FLORES-200** : Un benchmark d'évaluation standardisé couvrant les 200 langues avec des phrases traduites professionnellement. FLORES-200 est devenu un outil essentiel pour le domaine — auparavant, aucun benchmark n'existait pour la plupart de ces langues.

- **Libération ouverte** : Le modèle et FLORES-200 ont tous deux été libérés ouvertement, permettant aux chercheurs du monde entier de construire sur le travail.

NLLB-200 était un repère, mais ses limitations sont tout aussi importantes à comprendre. La qualité variait énormément entre les langues. Pour les paires bien dotées en ressources (anglais–français, anglais–chinois), le modèle était compétent mais pas de pointe par rapport aux systèmes spécialisés. Pour les langues à ressources limitées, la qualité de la sortie variait de utile à essentiellement non-fonctionnelle, selon la quantité de données d'entraînement qui avait été extraite. Le modèle présentait également la **malédiction de la multilingualité** : ajouter plus de langues à un modèle de capacité fixe dilue la qualité de représentation pour chaque langue. Les langues à ressources limitées bénéficient de l'apprentissage par transfert (structure partagée avec les langues connexes), mais les langues à ressources élevées peuvent en fait *s'aggraver* à mesure que le modèle essaie de servir trop de maîtres. Ce n'est pas simplement un problème d'échelle — cela reflète une tension fondamentale dans la conception de modèles multilingues.

### La suite Seamless

Meta a continué à progresser sur la TA multilingue avec la famille de modèles **Seamless** en 2023–2024. **SeamlessM4T** (« Massively Multilingual and Multimodal Machine Translation », août 2023) était un seul modèle gérant la **traduction parole-à-parole, parole-à-texte, texte-à-parole et texte-à-texte** sur environ 100 langues (avec une couverture variable selon les modalités). Cela représentait une convergence de fils de recherche précédemment séparés — reconnaissance automatique de la parole (ASR), traduction de texte et synthèse vocale (TTS) — dans un système multilingue unifié.

La suite **Seamless Communication** ultérieure a ajouté des capacités de streaming (traduction quasi-temps réel) et la traduction vocale expressive (préservant les caractéristiques vocales comme l'émotion et le style d'élocution entre les langues). Ces systèmes restent des prototypes de recherche plutôt que des outils prêts pour la production, mais ils signalent la direction du domaine : multimodal, multilingue et en temps réel.

### Ce que « massivement multilingue » signifie en pratique

Pour un chercheur entrant dans ce domaine, il est crucial de distinguer la **couverture linguistique** d'un modèle de sa **qualité linguistique**. Un modèle qui « supporte 200 langues » peut fournir d'excellentes traductions pour 20 d'entre elles, une sortie acceptable pour 50, et essentiellement du texte aléatoire pour le reste. Le nombre de titre est trompeur sans évaluation de qualité par langue.

La **malédiction de la multilingualité** est le terme technique pour le problème de dilution de capacité : un modèle avec des paramètres finis ne peut pas représenter toutes les langues également bien. Ajouter plus de langues bénéficie aux langues les plus à ressources limitées (par transfert cross-lingue à partir de langues connexes) mais nuit aux plus à ressources élevées (en consommant la capacité qui aurait pu être dédiée à elles). Cela crée une tension de conception : construisez-vous un modèle universel ou plusieurs modèles spécialisés ? Le domaine n'a pas résolu cette question.

---

## Partie 3 : L'ère des LLM (2022–2026)

### Quand l'IA à usage général a appris à traduire

L'arrivée des grands modèles de langage (LLM) — GPT-3.5/4, Gemini, Claude, LLaMA — a créé une situation étrange dans le domaine de la TA. Ces modèles n'ont pas été entraînés spécifiquement pour la traduction. Ils ont été entraînés pour prédire le prochain token dans de vastes corpus de texte, principalement en anglais mais de plus en plus multilingues. Pourtant, lorsqu'on les invite avec des instructions comme « Traduisez la phrase française suivante en anglais », ils produisaient des traductions qui étaient, pour les paires de langues à ressources élevées, étonnamment bonnes.

Cela a présenté le domaine avec une question d'identité : si l'IA à usage général peut traduire aussi bien que les systèmes de traduction spécialisés, la « traduction automatique » reste-t-elle un domaine de recherche distinct ? La réponse, en 2026, est un oui qualifié — mais la relation entre la recherche en TA et le développement de LLM à usage général est devenue profondément enchevêtrée.

### Les premiers benchmarks : LLM vs. TA dédiée

L'évaluation systématique des LLM pour la traduction a commencé au début de 2023, peu après la sortie de ChatGPT (novembre 2022) et GPT-4 (mars 2023).

**Jiao et al. (2023)**, dans [« Is ChatGPT A Good Translator? Yes With GPT-4 As The Engine »](https://arxiv.org/abs/2301.08745), a fourni une évaluation précoce. Leurs conclusions ont établi un motif qui s'est avéré remarquablement stable : les LLM sont **hautement compétitifs pour les paires de langues européennes à ressources élevées** (anglais–allemand, anglais–français, anglais–chinois) et **significativement plus faibles pour les paires à ressources limitées et typologiquement distantes**. Ils ont également introduit le **pivotage par invite** — instruire le modèle de traduire par une langue intermédiaire — ce qui a amélioré les performances sur les paires difficiles.

**Hendy et al. (2023)** chez Microsoft ([arXiv:2302.09210](https://arxiv.org/abs/2302.09210)) ont mené une évaluation plus complète sur 18 directions de traduction. Leur conclusion : les modèles GPT rivalisaient avec la TA commerciale de pointe pour les paires à ressources élevées mais avaient une « capacité limitée » sur les langues à ressources limitées.

En 2024–2025, l'image s'était clarifiée. Pour les **paires à ressources élevées**, les meilleurs LLM (GPT-4o, Gemini 2.5 Pro, Claude 3.5 Sonnet) égalaient ou surpassaient les systèmes TA dédiés, en particulier pour les tâches nécessitant une compréhension contextuelle, une expression idiomatique et une cohérence au niveau du document — des domaines où la TA neuronale traditionnelle, qui traite les phrases isolément, a toujours eu du mal. Pour les **paires à ressources limitées**, les modèles multilingues dédiés comme NLLB-200 et les systèmes de traduction spécialisés de Google surpassent toujours les LLM, souvent de manière significative.

### BLOOM : Le moment multilingue ouvert

En juillet 2022, la collaboration **BigScience** — un effort d'un an impliquant des centaines de chercheurs bénévoles coordonnés par Hugging Face — a lancé **BLOOM** : un modèle de langage multilingue open-access de 176 milliards de paramètres couvrant **46 langues naturelles et 13 langues de programmation**. Entraîné sur le corpus ROOTS en utilisant le superordinateur Jean Zay en France, BLOOM était le premier véritable LLM multilingue massif open-access.

BLOOM n'était pas un traducteur dédié, mais son importance pour la TA était considérable. Il a démontré que les modèles open-source pouvaient supporter des dizaines de langues à l'échelle, fournissant une fondation pour la recherche multilingue en dehors des laboratoires d'entreprises. Sa variante affinée par instruction, **BLOOMZ**, a montré des capacités de généralisation cross-lingue — affinée sur des tâches dans une langue, elle pouvait les effectuer dans d'autres.

### LLaMA et l'explosion du fine-tuning

La série **LLaMA** (Large Language Model Meta AI) de Meta, commençant en février 2023, a emprunté un chemin différent. LLaMA 1 était principalement centré sur l'anglais, avec une capacité multilingue limitée. LLaMA 2 (juillet 2023) s'est amélioré marginalement mais a toujours classé l'utilisation non-anglaise comme « hors de portée ». Le point d'inflexion est venu avec **LLaMA 3** (avril 2024), qui a étendu les données d'entraînement sept fois et a introduit un vocabulaire de 128 000 tokens — améliorant dramatiquement l'encodage du texte non-anglais. LLaMA 3 supportait officiellement huit langues (anglais, allemand, français, italien, portugais, hindi, espagnol, thaï) avec une qualité variable pour beaucoup d'autres.

L'importance de LLaMA pour la TA réside moins dans sa capacité de traduction directe et plus dans son rôle de **modèle de fondation pour le fine-tuning**. Les deux LLM de traduction spécialisés discutés ci-dessous — Tower et ALMA — sont construits sur LLaMA. Les poids ouverts ont créé un écosystème florissant de dérivés spécialisés.

### LLM de traduction spécialisés : Tower et ALMA

Le développement le plus significatif de 2023–2024 a été l'émergence de LLM spécifiquement affinés pour la traduction — des systèmes hybrides qui héritent de la sophistication contextuelle des LLM à usage général mais sont optimisés pour la qualité de traduction.

**ALMA** (Advanced Language Model-based trAnslator), développé par **Haoran Xu** et ses collègues à l'Université Johns Hopkins, a démontré une idée clé : vous n'avez pas besoin de corpus parallèles massifs pour construire un excellent traducteur. ALMA a utilisé une approche **d'affinage en deux étapes** sur LLaMA-2 : d'abord, un pré-entraînement continu sur des données monolingues non-anglaises pour élargir les connaissances multilingues ; ensuite, un affinage sur un petit ensemble de données parallèles de haute qualité. Le suivi, **ALMA-R** (janvier 2024), a introduit l'**Optimisation de Préférence Contrastive (CPO)** — entraîner le modèle sur des données de préférence (meilleures vs. pires traductions) plutôt que simplement sur du texte parallèle. Le résultat : des modèles de 7B et 13B paramètres qui égalaient ou surpassaient GPT-4 sur les benchmarks de traduction. L'article a été publié à ICLR 2024 ([arXiv:2309.11674](https://arxiv.org/abs/2309.11674)). Une version ultérieure, **X-ALMA**, a étendu la couverture à 50 langues en utilisant des modules plug-and-play spécifiques à la langue.

**Tower**, développé par **Unbabel** (une entreprise portugaise de traduction IA) en collaboration avec SARDINE Lab et MICS Lab, a adopté une vue plus large. Plutôt que d'optimiser uniquement pour la traduction, Tower couvrait l'**ensemble du pipeline de traduction** : correction source, reconnaissance d'entités nommées, post-édition, classement de traduction et détection d'erreurs. Les modèles Tower initiaux (7B et 13B, basés sur LLaMA-2) surpassaient NLLB-200-54B. **Tower v2** (70B, présenté à WMT 2024) surpassait GPT-4o, Claude 3.5 Sonnet et DeepL. Le dernier **Tower+** (2025) a étendu à 22–27 langues et a abordé l'« oubli catastrophique » — la tendance des modèles affinés à perdre les capacités générales — par l'optimisation de préférence et l'apprentissage par renforcement.

### Invite vs. Fine-tuning : Le débat en cours

Une question persistante dans l'espace LLM-TA est s'il est préférable d'**inviter** un LLM à usage général pour la traduction (zéro-shot ou few-shot) ou d'**affiner** un modèle spécifiquement pour la traduction. Les preuves suggèrent que la réponse dépend de la tâche :

- L'**invite** préserve les capacités générales du LLM — direction de formalité, contrôle de style, cohérence au niveau du document — et ne nécessite aucun entraînement supplémentaire. C'est idéal pour l'itération rapide et la traduction créative ou contextuelle.
- L'**affinage** produit une précision plus élevée sur des paires de langues et des domaines spécifiques mais risque de dégrader d'autres capacités (« oubli catastrophique »). Il nécessite des données parallèles et du calcul.
- Les **approches hybrides** sont de plus en plus dominantes en pratique : modèles affinés pour la traduction initiale, avec des passes de post-édition ou d'auto-raffinement basées sur LLM.

### L'état actuel de l'art (2025–2026)

La réponse honnête à « quel est le meilleur système TA ? » est : **cela dépend**.

| Cas d'usage | Meilleure approche | Pourquoi |
|---|---|---|
| Ressources élevées, volume élevé | TA neuronale commerciale (Google, DeepL) | Vitesse, coût, cohérence |
| Ressources élevées, haute qualité | LLM (GPT-4o, Gemini 2.5 Pro) ou Tower+ | Compréhension contextuelle, gestion des idiomes |
| Ressources limitées, couverture large | Meta OMT, NLLB-200, Google Traduction | Couverture multilingue spécialisée |
| Ressources limitées, paire spécifique | NLLB affiné ou LLM affiné sur données de domaine | Amélioration de qualité ciblée |
| Recherche open-source | Tower+, ALMA-R, X-ALMA | Poids ouverts, reproductible, compétitif |

En mars 2026, Meta a lancé **OMT (Omnilingual Machine Translation)** — le successeur de NLLB-200, étendant la couverture de 200 à **1 600+ langues**. OMT aborde ce que Meta appelle le « goulot d'étranglement de génération » : les grands modèles de langage peuvent comprendre de nombreuses langues mais ont du mal à générer du texte fluide en elles. OMT vient en deux architectures — OMT-LLaMA (decoder-only, 1B–8B paramètres) et OMT-NLLB (encoder-decoder) — et introduit de nouveaux outils d'évaluation incluant BOUQuET et BLASER 3 (une métrique d'estimation de qualité sans référence). Les rapports précoces indiquent que les modèles de 1B–8B paramètres égalent ou surpassent les baselines LLM de 70B sur les tâches de traduction. Si OMT inclura finalement le Plains Cree ou d'autres langues algonquiennes reste à voir.

L'article des conclusions de la tâche partagée WMT 2024 était justement intitulé **« The LLM Era Is Here but MT Is Not Solved Yet. »** Les LLM ont élevé le plafond pour la traduction à ressources élevées mais n'ont pas résolu les défis fondamentaux de la TA à ressources limitées, l'adéquation de l'évaluation ou la complexité morphologique.

---

## Partie 4 : Le problème des ressources limitées

### Pourquoi la plupart des langues sont laissées de côté

Sur les quelque 7 000 langues vivantes dans le monde, les services de traduction automatique (TA) commerciaux déployés en couvrent environ 200, et toutes les formes de traduction automatique combinées n'atteignent qu'environ 550 langues ([comment nous comptons](/docs/network/context/coverage-counting)). La grande majorité des langues ne disposent d'**aucune traduction automatique**. Comprendre pourquoi nécessite de comprendre ce dont les systèmes de TA ont besoin et ce qui manque à la plupart des langues.

La TA neuronale nécessite des **données parallèles** : de grandes collections de phrases traduites entre deux langues par des humains. Pour l'anglais–français, ces données existent en abondance — les délibérations du Parlement européen (Europarl), les documents des Nations unies, les archives de nouvelles et les mémoires de traduction commerciaux fournissent des centaines de millions de phrases parallèles. Pour une langue comme le Plains Cree (*nêhiyawêwin*), parlée par environ 20 000 personnes principalement dans l'ouest du Canada, ces données n'existent essentiellement pas. Il n'y a pas de délibérations des Nations unies en Plains Cree. Il n'y a pas de corpus de nouvelles bilingues. Le texte parallèle total disponible pourrait être mesuré en milliers de phrases plutôt qu'en millions.

Le domaine utilise des niveaux de ressources approximatifs pour catégoriser les langues :

| Niveau | Données parallèles disponibles | Exemples |
|---|---|---|
| Ressources élevées | >10 millions de paires de phrases | Anglais, français, allemand, chinois, espagnol |
| Ressources moyennes | 1–10 millions de paires | Turc, vietnamien, swahili |
| Ressources limitées | 100K–1 million de paires | Yoruba, guaraní, maltais |
| Ressources extrêmement limitées | <100K paires | Plains Cree, quechua, la plupart des langues autochtones |
| Essentiellement zéro | <10K paires | Des milliers de langues dans le monde |

### Le problème du tokeniseur

Avant qu'un modèle neuronal puisse traiter du texte, il doit convertir les caractères en tokens numériques — un processus appelé **tokenisation**. L'algorithme de tokenisation dominant est **Byte Pair Encoding (BPE)**, popularisé par Sennrich et al. (2016) et implémenté dans des outils comme **SentencePiece** (Kudo & Richardson, 2018). BPE fonctionne en apprenant les séquences de caractères les plus courantes dans un corpus d'entraînement et en construisant un vocabulaire d'unités de sous-mots. En anglais, les mots courants comme « the » deviennent des tokens uniques ; les mots rares sont divisés en pièces de sous-mots (« unforgivable » → « un » + « forgiv » + « able »).

Le problème est que les vocabulaires BPE sont entraînés principalement sur les langues à ressources élevées, avec l'anglais dominant généralement. Pour les langues à ressources limitées, en particulier celles avec une morphologie complexe ou des scripts non-latins, les conséquences sont graves :

- **Sur-segmentation** : Un seul mot dans une langue polysynthétique comme le Plains Cree pourrait encoder une clause entière. Le mot *nikî-nipâw* (« j'ai dormi ») serait divisé en nombreux fragments — potentiellement des octets individuels — car l'algorithme BPE n'a jamais vu ces séquences de caractères auparavant. Ce qui est une unité significative pour un locuteur devient une douzaine de fragments dénués de sens pour le modèle.

- **Le problème de fertilité** : Un seul mot dans une langue morphologiquement complexe pourrait nécessiter 5–15 tokens, tandis que sa traduction anglaise en utilise 1–3. Cela crée une asymétrie massive dans la longueur de séquence qui dégrade l'alignement d'attention et la qualité de traduction.

- **Pénalités de script** : Les langues utilisant des scripts non-latins (syllabiques du Cree, éthiopien, dévanagari) sont tokenisées encore moins efficacement, tombant parfois sur des octets individuels. Cela signifie que la fenêtre de contexte effective du modèle est dramatiquement plus petite pour ces langues.

Ce n'est pas simplement une gêne technique. Le vocabulaire du tokeniseur encode effectivement un biais vers les langues bien dotées en ressources au niveau le plus fondamental du système. Un modèle qui dépense 15 tokens pour encoder un seul mot Cree a beaucoup moins de capacité restante pour comprendre le reste de la phrase par rapport à un modèle traitant l'anglais, où la même information pourrait occuper 3 tokens.

### Le problème de la qualité des données

Les données parallèles limitées qui existent pour les langues à ressources limitées proviennent souvent de **domaines étroits**. Les deux plus grandes sources de texte parallèle multilingue pour les langues sous-dotées en ressources sont :

1. **Traductions bibliques** : La Bible a été traduite dans plus de 700 langues et des portions dans plus de 3 000. Cela rend le texte religieux la ressource parallèle la plus largement disponible pour de nombreuses langues — mais un modèle entraîné principalement sur du texte biblique apprend un registre spécifique, un vocabulaire et un domaine. Il peut produire « tu ne dois pas » mais ne peut pas traduire « veuillez réserver un vol ».

2. **JW300** : Un ensemble de données extrait des publications des Témoins de Jéhovah, couvrant environ 300 langues. Bien que volumineux et multilingue, JW300 soulève à la fois des problèmes de biais de domaine (contenu religieux) et des préoccupations éthiques concernant la provenance et le consentement des traductions sous-jacentes.

La **contamination de benchmark** est une autre préoccupation sérieuse. Quand les données parallèles sont rares, le même texte peut se retrouver dans les ensembles d'entraînement et d'évaluation — une fuite de données qui gonfle les métriques de qualité. Plus le pool de données est petit, plus c'est difficile à prévenir et à détecter.

### Augmentation des données : Faire plus avec moins

Les chercheurs ont développé des techniques pour étirer les données limitées :

- **Backtranslation** (Sennrich et al., 2016) : Entraîner un modèle initial sur les données parallèles disponibles, puis l'utiliser pour traduire du texte **monolingue** en langue cible en langue source. Cela crée des données parallèles synthétiques qui sont bruyantes mais peuvent améliorer significativement la qualité du modèle. La backtranslation est devenue une technique standard sur tout le spectre des ressources.

- **Données synthétiques générées par LLM** : Utiliser de grands modèles de langage pour générer des données d'entraînement pour les paires à ressources limitées. C'est prometteur mais introduit des risques — le texte généré peut présenter de la « traductionèse » (motifs anormalement littéraux ou influencés par la source) et peut amplifier les biais existants dans le LLM.

- **Transfert cross-lingue** : Entraîner sur des données parallèles d'une langue connexe à ressources plus élevées (par exemple, utiliser des données espagnol–anglais pour amorcer la TA guaraní–anglais) et espérer que les caractéristiques structurelles partagées se transfèrent. Cela fonctionne mieux pour les langues étroitement liées que pour celles typologiquement distantes.

- **Segmentation morphologique** : Pré-traiter le texte pour diviser les mots en morphèmes (plus petites unités significatives) avant de les alimenter au modèle. Pour les langues agglutinatives et polysynthétiques, cela peut améliorer dramatiquement l'efficacité de la tokenisation et la qualité de traduction. Cette approche se connecte directement aux outils fondés sur des règles discutés dans la section suivante.

---

## Partie 5 : Transducteurs à états finis et systèmes fondés sur des règles

### Pourquoi les règles importent toujours

Le récit jusqu'à présent a été celui de la domination neuronale : les systèmes statistiques remplacés par les réseaux de neurones, les réseaux de neurones remplacés par les Transformers, les Transformers mis à l'échelle dans les LLM. Mais il existe une tradition parallèle en linguistique computationnelle qui n'a jamais disparu — et pour certaines langues, elle reste indispensable.

Les **systèmes fondés sur des règles** codent les connaissances linguistiques explicites : règles morphologiques, lexiques, motifs de transfert syntaxique. Ils n'apprennent pas à partir des données ; ils sont construits par des linguistes qui comprennent les langues impliquées. Pour les langues bien dotées en ressources, cette approche a longtemps été surpassée par les méthodes fondées sur les données. Mais pour les langues avec une morphologie complexe et des données minimales, les systèmes fondés sur des règles fournissent souvent la seule analyse fiable disponible.

### Transducteurs à états finis : Un amorce

Un **Transducteur à États Finis (TEF)** est un dispositif computationnel qui mappe entre deux niveaux de représentation — généralement entre une forme de surface (ce que vous voyez dans le texte) et une analyse sous-jacente (ce qu'elle signifie linguistiquement). Pensez-y comme une machine avec des états et des transitions : elle lit les symboles d'entrée, se déplace entre les états et produit les symboles de sortie.

Pour un exemple concret, considérez le mot Plains Cree *nikî-nipâw*. Un analyseur morphologique basé sur TEF peut prendre cette forme de surface et produire :

> nipâw + Verbe + AI + Indépendant + Passé + 1ère personne singulier

Cela vous dit que le mot est le verbe *nipâw* (« dormir ») à l'ordre indépendant, passé, première personne singulier — « j'ai dormi ». Le transducteur encode les règles de la morphologie du Cree : quels préfixes indiquent la personne, lesquels marquent le temps, quelles formes verbales prennent quels motifs d'inflexion. De manière cruciale, ce fonctionne **bidirectionnellement** : étant donné une analyse, le TEF peut générer la forme de surface correcte.

L'infrastructure technique pour construire des TEF inclut :

- **HFST** (Helsinki Finite-State Transducer Technology) : Une boîte à outils open-source maintenue à l'Université d'Helsinki, fournissant le cadre computationnel pour construire et exécuter les transducteurs. HFST implémente les formalismes développés à l'origine par Xerox (lexc, twolc, xfst) et est compatible avec **foma**, une autre boîte à outils TEF open-source.

- **lexc** : Un formalisme pour spécifier le **lexique** — l'inventaire des morphèmes (racines, préfixes, suffixes) et les motifs de formation de mots qui les combinent.

- **twolc** : Un formalisme pour spécifier les **règles morphophonologiques** — les changements sonores qui se produisent quand les morphèmes se combinent (par exemple, harmonie vocalique, mutation consonantique).

### GiellaLT : Infrastructure arctique

**GiellaLT** (du mot du Sámi du Nord *giella*, « langue ») est une infrastructure de technologie linguistique basée à **UiT — The Arctic University of Norway** à Tromsø. Elle représente l'effort le plus étendu au monde pour construire des outils basés sur TEF pour les langues autochtones et minoritaires.

Initialement connu sous les noms de **Giellatekno** (recherche) et **Divvun** (outils linguistiques), le projet — dirigé par les linguistes **Trond Trosterud** et **Sjur Nørstebø Moshagen** — a développé des analyseurs morphologiques, des correcteurs orthographiques et d'autres outils linguistiques pour plus de **100 langues**, en mettant l'accent sur les langues sames (same du Nord, same de Lule, same du Sud, entre autres), les langues ouraliennes et d'autres langues arctiques et autochtones.

GiellaLT utilise HFST comme backend computationnel et a développé une infrastructure partagée sophistiquée : un système de construction commun, des cadres de test partagés et des composants linguistiques réutilisables. Tout le code est open-source, hébergé sur [GitHub](https://github.com/giellalt), avec des centaines de dépôts incluant l'infrastructure centrale et les dépôts spécifiques à la langue (par exemple, `lang-sme` pour le Sámi du Nord, `lang-crk` pour le Plains Cree). La documentation du projet se trouve sur [giellalt.github.io](https://giellalt.github.io/). Le portail public, **[Borealium.org](https://borealium.org)** — financé par le Conseil nordique des ministres — fournit un accès gratuit aux outils de correction, claviers, dictionnaires, outils d'apprentissage des langues (Oahpa) et synthèse vocale pour les langues Sámi, le Kven, le féroïen, le groenlandais et autres.

La relation entre GiellaLT et la politique linguistique nationale est notable. Une grande partie du financement du projet provient du **Parlement Sámi norvégien** et des programmes de politique linguistique nordiques, reflétant un engagement politique envers la technologie linguistique autochtone qui est inhabituel en ampleur et durée.

### Apertium : TA open-source fondée sur des règles

**[Apertium](https://www.apertium.org/)** est une plateforme de traduction automatique open-source fondée sur des règles, développée à l'origine à l'Universitat d'Alacant (Espagne) avec un financement des gouvernements espagnol et catalan. Elle a commencé en 2004 avec un accent sur les paires de langues connexes (espagnol–catalan, espagnol–portugais) où les règles de transfert peu profondes — traduire mot par mot avec des ajustements morphologiques — produisent des résultats étonnamment bons. Les contributeurs clés incluent **Francis M. Tyers**, qui a été central au développement d'Apertium et à son adoption pour les langues sous-dotées en ressources.

L'architecture d'Apertium est un **pipeline** classique :

1. **Analyse morphologique** (basée sur TEF) : Identifier le lemme et les caractéristiques morphologiques de chaque mot
2. **Désambiguïsation de partie du discours** : Choisir l'analyse correcte quand les mots sont ambigus
3. **Transfert lexical** : Mapper les lemmes de la langue source aux lemmes de la langue cible
4. **Transfert structurel** : Appliquer les règles pour gérer les changements d'ordre des mots, l'accord et d'autres différences syntaxiques
5. **Génération morphologique** (basée sur TEF) : Produire la forme de surface correctement fléchie de la langue cible

En 2025, Apertium supporte des centaines de paires de langues à différents niveaux de qualité, tous hébergés sur [GitHub](https://github.com/apertium). Il reste activement développé par une communauté internationale et est particulièrement utile pour les paires de langues étroitement liées où son approche fondée sur des règles peut atteindre une qualité raisonnable sans données d'entraînement.

### Approches hybrides : TEF + neuronal

La frontière la plus prometteuse pour la TA à ressources limitées pourrait être les **architectures hybrides** qui combinent l'analyse morphologique fondée sur des règles avec la traduction neuronale. L'idée est simple : utiliser un TEF pour segmenter les mots en morphèmes (résolvant le problème de tokenisation décrit dans la Partie 4), puis alimenter le texte segmenté à un système TA neuronal.

Pour une langue polysynthétique comme le Plains Cree, cela signifie que le modèle neuronal reçoit une séquence d'unités significatives plutôt que des fragments d'octets arbitraires. Le **Alberta Language Technology Lab (ALT Lab)** à l'Université de l'Alberta, dirigé par **Antti Arppe**, a construit des analyseurs morphologiques complets basés sur TEF et des outils de dictionnaire accessibles à la communauté pour le Plains Cree en utilisant l'infrastructure GiellaLT. Leur travail publié le plus récent (Arppe 2025, AmericasNLP) démontre le mappage basé sur TEF entre les formes de mots Cree fléchis et les phrases anglaises — essentiellement une « traduction restreinte » via des méthodes à états finis, opérant au niveau du mot/phrase plutôt que des phrases complètes. Notamment, ALT Lab n'a **pas** publié de système TA hybride TEF+neuronal ; leur travail est linguistiquement fondé, fondé sur des règles et priorise la fiabilité et l'utilité communautaire par rapport aux approches expérimentales neuronales. Pendant ce temps, Nguyen, Hammerly et Silfverberg (2025, AmericasNLP) ont démontré un pipeline hybride LLM+TEF pour les verbes Ojibwe à UBC, atteignant des résultats forts (chrF 0,82) — l'analogue publié le plus proche d'une approche hybride pour une langue algonquienne.

Cette stratégie hybride représente une convergence des deux traditions qui ont traversé l'histoire de la TA : les connaissances explicites du linguiste et l'apprentissage statistique de l'ingénieur. Pour les langues qui ont le plus besoin de TA, aucune tradition seule n'est suffisante.

---

## Partie 6 : Mesurer la qualité — Le problème de l'évaluation

### Comment savez-vous si une traduction est bonne ?

Cette question semble simple. C'est, en fait, l'un des problèmes non résolus les plus difficiles du domaine, et la façon dont vous y répondez détermine quels systèmes semblent « fonctionner » et lesquels ne le font pas.

### BLEU : Le standard imparfait

Pendant plus de deux décennies, la métrique automatique dominante en TA a été **BLEU** (Bilingual Evaluation Understudy), introduite par Papineni et al. chez IBM en 2002. BLEU mesure combien les séquences de mots (n-grammes) de la traduction automatique chevauchent une ou plusieurs traductions de référence humaines. Elle inclut une pénalité de brièveté pour empêcher les systèmes de tricher avec des sorties courtes.

BLEU est devenue la monnaie du domaine car elle est rapide, bon marché, indépendante de la langue et reproductible. Pratiquement tous les articles de TA publiés entre 2002 et 2020 ont rapporté des scores BLEU. Les tâches partagées WMT l'ont utilisée comme métrique principale pendant des années.

Mais BLEU a des défauts profonds qui sont devenus de plus en plus apparents :

- **Pas de compréhension sémantique** : BLEU est pur appariement de surface. Si une traduction utilise un synonyme parfait qui ne se trouve pas dans la référence, BLEU la pénalise. La phrase « the cat sat on the mat » obtient un score zéro par rapport à une référence de « the feline rested on the rug ».
- **Discrimination faible au niveau de la phrase** : BLEU a été conçu comme une métrique au niveau du corpus. Au niveau de la phrase, elle est peu fiable et bruyante.
- **Cécité morphologique** : Pour les langues agglutinatives (turc, finnois, swahili), où un seul lemme peut avoir des dizaines de formes fléchies, l'appariement strict au niveau des mots échoue catastrophiquement. Un verbe correctement fléchi qui diffère d'un suffixe de la référence obtient un score zéro.
- **Corrélation faible avec le jugement humain** : Les méta-analyses, notamment Reiter (2018), ont montré que la corrélation de BLEU avec les évaluations de qualité humaines est souvent faible, en particulier pour les systèmes de haute qualité et pour les langues distantes de l'anglais.

### chrF et chrF++

**chrF** (character F-score), introduit par Maja Popović en 2015, aborde la cécité morphologique de BLEU en mesurant le chevauchement au **niveau des caractères** plutôt qu'au niveau des mots. Cela donne un crédit partiel pour les racines et radicaux partagés même quand les inflexions diffèrent — crucial pour les langues morphologiquement riches. **chrF++** (Popović, 2017) ajoute les n-grammes au niveau des mots, atteignant une meilleure corrélation avec le jugement humain que l'une ou l'autre des métriques seules. Les deux sont implémentées dans **sacreBLEU**, la boîte à outils d'évaluation standard, et sont devenues des métriques secondaires standard dans les tâches partagées WMT.

### COMET et xCOMET : Évaluation neuronale

L'avancée la plus significative en évaluation de TA a été le passage aux **métriques neuronales** — des modèles d'évaluation qui sont eux-mêmes des Transformers, entraînés pour prédire les jugements de qualité humains.

**COMET** (Crosslingual Optimized Metric for Evaluation of Translation), développé par Ricardo Rei et ses collègues à **Unbabel** (2020), utilise un encodeur cross-lingue (XLM-RoBERTa) pour intégrer la phrase source, la traduction et la référence, puis prédit un score de qualité. Contrairement à BLEU, COMET opère dans l'espace sémantique — il reconnaît les paraphrases, capture la préservation du sens et a montré une corrélation beaucoup plus élevée avec le jugement humain que les métriques au niveau de la surface. COMET a remporté ou s'est classé premier aux Tâches Partagées de Métriques WMT de 2020 à présent.

**xCOMET** (Guerreiro et al., 2024, publié dans TACL) va plus loin : en plus d'un score de qualité, il produit une **détection d'erreur fine-grained** — identifiant les erreurs spécifiques dans la traduction, les classifiant par type (précision, fluidité, terminologie) et sévérité (mineure, majeure, critique). Cela comble l'écart entre le scoring automatique et l'analyse linguistique humaine.

### AfriCOMET : Évaluation pour les sous-dotés

COMET standard, entraîné principalement sur les jugements humains de langues européennes, peut ne pas se généraliser bien aux langues typologiquement différentes. **AfriCOMET** (Wang, Adelani et al., NAACL 2024) aborde cela en affinant sur les données d'évaluation humaines de **13 langues africaines** et en utilisant **AfroXLM-R** — un encodeur multilingue spécifiquement entraîné pour mieux représenter les langues africaines. Ce travail, produit par la communauté Masakhane (voir Partie 7), démontre que les métriques d'évaluation elles-mêmes doivent être adaptées à la diversité linguistique.

### Évaluation humaine : MQM et Direct Assessment

Les métriques automatiques sont des approximations. La vérité fondamentale reste l'**évaluation humaine**, qui prend deux formes principales :

L'**Évaluation Directe (ED)** demande aux évaluateurs humains de noter les traductions sur une échelle 0–100. C'est relativement rapide et bon marché (les évaluateurs crowdsourcés peuvent être utilisés) et était la méthode d'évaluation humaine principale à WMT de 2017 à 2020. Sa faiblesse : à mesure que la qualité de la TA s'améliorait, les évaluateurs non-experts ne pouvaient plus distinguer entre les systèmes produisant une sortie quasi-professionnelle. L'ED est devenue peu fiable au sommet du spectre de qualité.

Les **Métriques de Qualité Multidimensionnelles (MQM)** ont remplacé l'ED comme méthode d'évaluation humaine principale de WMT à partir de 2021. MQM utilise des **traducteurs professionnels** qui marquent les étendues d'erreur spécifiques dans la traduction, classifient les erreurs par type (contresens, omission, grammaire, terminologie) et sévérité (mineure = 1 point, majeure = 5 points, critique = 25 points). Cela produit à la fois un score de qualité et des informations diagnostiques exploitables — vous savez non seulement *à quel point* une traduction est mauvaise, mais *exactement ce qui s'est mal passé*.

| Caractéristique | ED | MQM |
|---|---|---|
| Évaluateurs | Travailleurs crowdsourcés | Traducteurs professionnels |
| Méthode | Score holistique 0–100 | Annotation d'étendues d'erreur |
| Diagnostiques | Aucun | Classification d'erreur détaillée |
| Coût | Plus bas | Plus élevé |
| Fiabilité | Plus faible pour la TA de haute qualité | Standard or |
| Utilisation principale WMT | 2017–2020 | 2021–présent |

### La crise d'évaluation pour les langues à ressources limitées

Pour les langues à ressources limitées, le problème d'évaluation est aggravé par plusieurs facteurs :

- **Pas d'évaluateurs qualifiés** : MQM nécessite des traducteurs professionnels bilingues. Pour de nombreuses LRL, trouver de tels évaluateurs est extrêmement difficile.
- **Pas de traductions de référence** : COMET et BLEU nécessitent tous deux des traductions de référence pour la comparaison. Pour de nombreux domaines et langues, celles-ci n'existent pas.
- **Biais de métrique** : Les métriques de surface et les métriques neuronales ont été développées et validées sur les données de langues européennes. Leur comportement sur les langues typologiquement distantes est incertain.
- **Risque d'hallucination** : Dans les paramètres à ressources limitées, les modèles TA peuvent produire une sortie fluide qui est complètement sans rapport avec la source — un phénomène appelé **hallucination**. Les métriques de surface peuvent attribuer des scores non-zéro à la sortie hallucée si elle partage accidentellement des n-grammes avec la référence.

Construire des **ensembles d'évaluation personnalisés** — même petits de 200–500 paires de phrases soigneusement sélectionnées dans le domaine cible — est essentiel pour tout effort sérieux de TA à ressources limitées. S'appuyer uniquement sur les scores FLORES-200 ou BLEU sans évaluation spécifique au domaine est une recette pour une fausse confiance.

---

## Partie 7 : Le paysage institutionnel

### Acteurs corporatifs

Le domaine de la TA est façonné par une poignée d'acteurs corporatifs majeurs, chacun avec des stratégies distinctes :

**Google Translate** reste le système de TA le plus utilisé à l'échelle mondiale ; son API Cloud Translation répertorie **194 langues** ([liste publiée par Google](https://docs.cloud.google.com/translate/docs/languages) — le produit grand public en annonce davantage, mais Google ne publie aucune liste statique officielle à ce sujet). La **1000 Languages Initiative** de Google (annoncée en 2022) vise à créer des modèles d'IA couvrant les 1 000 langues les plus parlées au monde. L'API Cloud Translation propose deux niveaux : Basic (NMT hérité) et Advanced (modèles les plus récents). Google a de plus en plus intégré les capacités de son LLM Gemini dans Translate, avec des fonctionnalités de traduction idiomatique et sensible au contexte apparues en 2025.

**Meta** s'est positionnée comme le principal moteur de la TA multilingue open-source par le biais de NLLB-200, M2M-100, FLORES-200 et la suite Seamless. La philosophie de Meta de libération de modèles ouverts a été transformatrice pour la recherche académique, fournissant des baselines et des outils qui nécessiteraient autrement des ressources de calcul prohibitives.

**DeepL** occupe une niche axée sur la qualité, supportant environ **33 langues** — toutes relativement bien dotées en ressources — avec une réputation de sortie naturelle et idiomatique préférée par les traducteurs professionnels. Le modèle commercial de DeepL (freemium consommateur + API payante pour l'entreprise) et son paramètre de formalité (contrôlant le registre formel vs. informel) reflètent un accent sur les flux de travail de traduction professionnelle plutôt que la couverture linguistique large.

**Microsoft Translator** (qui fait partie d'Azure AI Services) fournit des traductions dans **135 langues** avec une intégration d'entreprise via Microsoft 365 et Teams. Sa fonctionnalité Custom Translator permet aux organisations d'affiner les modèles sur des données spécifiques à un domaine.

**Unbabel** combine la TA avec la post-édition humaine dans un flux de travail « humain-dans-la-boucle », aux côtés de ses contributions de recherche (COMET, xCOMET, Tower). Elle représente l'application commerciale du paradigme « TA + révision humaine ».

**LibreTranslate**, construit sur le moteur **Argos Translate**, fournit une alternative TA entièrement open-source et auto-hébergeable sans dépendance corporative — important pour les organisations ayant des exigences de souveraineté des données.

### Communautés de base

Certains des travaux les plus importants en TA — en particulier pour les langues sous-dotées — se font dans les organisations de recherche communautaires :

**[Masakhane](https://www.masakhane.io/)** (du isiZulu pour « nous construisons ensemble ») est une communauté de recherche de base axée sur le NLP pour les langues africaines, fondée en 2019. Avec des centaines de membres sur le continent et la diaspora, Masakhane a produit des ensembles de données fondamentaux (MasakhaNER, MAFAND-MT, MENYO-20k, AfriQA), des métriques d'évaluation (AfriCOMET) et une recherche qui a considérablement avancé le NLP des langues africaines. Les figures clés incluent **David Ifeoluwa Adelani** (Mila / UCL). Le code et les données sont hébergés sur [GitHub](https://github.com/masakhane-io) ; le hub de communication principal est leur espace Slack (rejoignez via masakhane.io), avec des réunions communautaires hebdomadaires. Masakhane opère selon les principes de propriété africaine de la technologie linguistique africaine — un contre-courant délibéré aux motifs de recherche extractifs où les institutions extérieures collectent des données auprès des communautés linguistiques sans collaboration significative. Ils découragent explicitement la « recherche parachute » où les étrangers extraient les données linguistiques sans partenariat significatif avec la communauté.

**AmericasNLP** est une série d'ateliers (co-localisée avec NAACL) axée sur le NLP pour les langues autochtones des Amériques. Organisée par des chercheurs incluant **Manuel Mager**, **Arturo Oncevay** et **Luis Chiruzzo**, elle exécute des tâches partagées sur la TA pour des langues telles que le quechua, le guaraní, l'aymara, le nahuatl, le rarámuri et autres. L'atelier met en évidence les défis de recherche uniques aux Amériques — morphologie polysynthétique, systèmes tonals, rareté extrême des données et les dimensions politiques de la technologie linguistique pour les peuples colonisés.

**[ALT Lab](https://altlab.ualberta.ca)** (Alberta Language Technology Lab) à l'Université de l'Alberta, dirigé par **Antti Arppe**, se concentre spécifiquement sur les outils computationnels pour le Plains Cree et d'autres langues autochtones de l'ouest du Canada. ALT Lab construit des analyseurs morphologiques basés sur TEF et des outils linguistiques accessibles à la communauté (utilisant l'infrastructure GiellaLT), et travaille en étroite collaboration avec les communautés de locuteurs Cree — un modèle pour le développement de technologie linguistique centré sur la communauté. Leur projet public **[21st Century Tools for Indigenous Languages](https://21c.tools)** fournit des dictionnaires en ligne et des outils morphologiques construits sur cette infrastructure.

**[NRC Indigenous Languages Technology](https://nrc.canada.ca)** (Conseil national de recherches Canada), dirigé par **Patrick Littell**, maintient un programme actif supportant 25+ langues autochtones à travers le Canada, incluant plusieurs dialectes du Cree, l'algonquin, l'innu et le michif. NRC ILT a publié une recherche en TA pour l'anglais–inuktitut (utilisant le corpus Hansard du Nunavut) et développe des outils open-source incluant **kiyânaw Transcribe** (transcription du Cree et de l'Ojibwe), des analyseurs morphologiques et **ReadAlong Studio** (alignement audio-texte). Tout le code est open-source et NRC ne revendique explicitement pas les droits d'auteur sur les données linguistiques communautaires.

**[Aya](https://cohere.com/research/aya)** (Cohere For AI) est une initiative LLM multilingue open-science avec 3 000+ contributeurs de 119+ pays. Bien que ne soit pas un système TA dédié, les modèles Aya (Aya-101 couvrant 101 langues, Aya 23 couvrant 23 langues à fort impact, Tiny Aya couvrant 70 langues à 3,35B paramètres) sont hautement efficaces pour les tâches de traduction. La **Collection Aya** — 513M instances de style instruction — est le plus grand ensemble de données d'instruction multilingue ouvert. Le modèle de gouvernance communautaire vaut la peine d'être étudié.

**[GhanaNLP / Khaya](https://ghananlp.org)** est une initiative NLP communautaire qui a produit la plateforme de traduction **Khaya** — l'un des rares systèmes TA gouvernés par la communauté réellement déployés pour un usage quotidien. Khaya fournit la traduction automatique neuronale, l'ASR et la TTS pour ~12 langues ghanéennes (Twi, Ewe, Ga, Fante, Kusaal et autres) via web, applications mobiles et API développeur. Leur approche — 40 000+ paires de phrases parallèles construites par la collaboration de linguistes et les retours de la communauté — démontre que la TA gouvernée par la communauté peut être opérationnelle, pas seulement aspirationnelle.

### Financement et politique

La recherche en TA pour les langues à ressources limitées dépend de flux de financement tout à fait différents de ceux du capital-risque et des revenus publicitaires qui soutiennent la TA commerciale :

- **Lacuna Fund** : Un fonds de données collaboratif soutenu par la Fondation Rockefeller, Google.org, l'ACDI du Canada et la GIZ de l'Allemagne. Lacuna finance spécifiquement la création d'**ensembles de données étiquetés** pour les langues sous-représentées — comblant l'écart de données qui est la cause première des écarts de qualité de TA.

- **AI4D** (Artificial Intelligence for Development) : Un programme supportant les bourses de recherche en IA pour la technologie linguistique africaine, opéré par le biais de l'ACDI et de l'Agence suédoise de coopération internationale au développement.

- **Décennie internationale des langues autochtones de l'UNESCO (2022–2032)** : Un cadre politique qui a élevé le profil de la technologie linguistique autochtone mondialement, bien que le financement concret de la recherche ait été modeste.

- **Banque interaméricaine de développement** : A financé le projet **GuaranIA** pour la TA guaraní–espagnol au Paraguay, un exemple de financement du développement supportant la technologie linguistique.

- **Conseils de recherche nationaux** : Une grande partie du travail en TA à ressources limitées est financée par les canaux académiques standard (NSF, NSERC, programmes Horizon UE), souvent comme composants de subventions plus larges en IA ou linguistique.

---

## Partie 8 : Frontières ouvertes

### Ce qui reste non résolu

Le domaine de la TA en 2026 est simultanément plus capable et plus honnête sur ses limitations qu'à tout point précédent. Plusieurs problèmes de frontière définissent le paysage de recherche actuel :

La **traduction au niveau du document** reste largement non résolue. La plupart des systèmes TA — incluant de nombreux LLM — traduisent phrase par phrase, perdant la cohérence du discours, la résolution des pronoms entre les limites de phrases et la cohérence stylistique. Un traducteur humain lit le document complet avant de traduire ; la plupart des systèmes TA traitent les phrases isolément. La recherche sur la TA au niveau du document est active mais n'a pas encore produit de systèmes qui maintiennent de manière fiable la cohérence sur les textes longs.

Le **discours et la pragmatique** — l'écart entre le sens littéral et l'intention communicative — continuent de défier la TA. L'ironie, la litote, les allusions culturelles et la sensibilité au registre (formel vs. informel, respectueux vs. désinvolte) sont partiellement capturées par les meilleurs LLM mais de manière incohérente. Un traducteur travaillant entre le japonais et l'anglais doit naviguer un système élaboré d'honorifiques ; les systèmes TA actuels gèrent cela de manière inégale au mieux.

La **traduction multimodale** — traduire en contexte avec des images, vidéos ou audio — est un domaine de recherche émergent. Un article de menu décrit comme « œufs de poisson volant » a un sens parfait avec une image d'accompagnement ; sans elle, la TA pourrait produire quelque chose d'étrange. La suite Seamless et les LLM multimodaux (Gemini, GPT-4o) ont commencé à aborder cela, mais la TA multimodale robuste reste une frontière.

La **traduction vocale-à-vocale en temps réel** avec une latence naturelle (délai inférieur à 3 secondes), préservation de l'identité du locuteur et transfert du ton émotionnel approche la disponibilité en production pour les paires à ressources élevées. Google, Meta et plusieurs startups ont démontré des systèmes prototype en 2025. Pour les langues à ressources limitées, la traduction vocale en temps réel reste lointaine.

Le **« dernier kilomètre » pour les langues à ressources limitées** est peut-être le problème le plus important non résolu du domaine. L'écart entre un score FLORES-200 de benchmark et l'utilité réelle pour une communauté linguistique est vaste. Un modèle qui obtient 15 BLEU sur la traduction Plains Cree–anglais n'est utile pour aucun objectif pratique. Combler cet écart nécessite non seulement de meilleurs modèles mais de meilleures données, une meilleure évaluation, une meilleure tokenisation et — de manière cruciale — une véritable collaboration avec les communautés linguistiques plutôt que l'extraction de ressources linguistiques pour les publications académiques.

La **post-édition et la collaboration humain-IA** devient le paradigme dominant pour la traduction professionnelle. Plutôt que de remplacer les traducteurs humains, la TA est de plus en plus positionnée comme un générateur de premier brouillon que les traducteurs humains affinent ensuite. Comprendre la science cognitive de la post-édition, mesurer l'effort de post-édition et concevoir des interfaces qui supportent la collaboration humain-IA sont des domaines de recherche actifs avec des implications commerciales directes.

### Les dimensions politiques

La TA n'est pas politiquement neutre. Le choix des langues à supporter, les données à collecter, qui contrôle les modèles et quelles normes de qualité s'appliquent sont tous des décisions avec des conséquences significatives pour les communautés linguistiques.

La domination de l'anglais comme langue pivot encode une vision particulière de la traduction comme quelque chose qui s'écoule par l'anglais. L'utilisation de textes bibliques et missionnaires comme données d'entraînement pour les langues autochtones soulève des questions sur le consentement et l'appropriatesse culturelle. La concentration de la capacité TA dans une poignée d'entreprises de la Silicon Valley crée des relations de dépendance que certaines communautés linguistiques résistent explicitement.

La **souveraineté des données** est une préoccupation centrale. Au Canada, les principes de souveraineté des données des Premières Nations affirment que les communautés autochtones sont propriétaires de leurs données, contrôlent la manière dont elles sont collectées et utilisées, y ont accès et les possèdent physiquement. Pour la TA, cela signifie que les données d'entraînement dérivées de textes en langues autochtones, les corpus d'évaluation construits à partir des connaissances de la communauté et les modèles de traduction entraînés sur des ressources détenues par la communauté relèvent tous de la gouvernance communautaire — et non de la gouvernance de l'institution de recherche ou de l'entreprise technologique qui a construit le modèle.

Cela a des implications techniques directes. Un système de TA construit avec des données communautaires ne peut pas simplement être rendu open source au sens conventionnel si la communauté n'y a pas consenti. Les bancs d'essai d'évaluation ne peuvent pas être publiés si les données de test incluent des éléments culturellement sensibles. Un « modèle appartenant à la communauté » n'est pas une contradiction — c'est une exigence de conception. Tout effort sérieux dans la TA à faibles ressources pour les langues autochtones doit être aspirant à la souveraineté par défaut — conçu pour la propriété et le contrôle communautaires des données linguistiques, et non après coup.

Ce ne sont pas simplement des notes éthiques — elles façonnent les priorités de recherche, les décisions de financement et les architectures techniques. « Construire une meilleure TA » est inséparable des questions sur qui en bénéficie, qui décide et dont les connaissances linguistiques sont valorisées.

---

## Annexe A : Articles clés

Une liste de lecture chronologique des articles qui ont défini la trajectoire du domaine. Chaque entrée inclut une brève note sur son importance.

| Année | Article | Auteurs | Importance |
|---|---|---|---|
| 2002 | [BLEU: a Method for Automatic Evaluation of MT](https://aclanthology.org/P02-1040/) | Papineni et al. (IBM) | A établi la métrique d'évaluation TA dominante pendant deux décennies |
| 2014 | [Sequence to Sequence Learning with Neural Networks](https://arxiv.org/abs/1409.3215) | Sutskever, Vinyals, Le (Google) | A démontré la traduction encodeur–décodeur neuronal |
| 2014 | [Neural MT by Jointly Learning to Align and Translate](https://arxiv.org/abs/1409.0473) | Bahdanau, Cho, Bengio | A introduit le mécanisme d'attention |
| 2016 | [Google's Neural MT System](https://arxiv.org/abs/1609.08144) | Wu et al. (Google) | A amené la TA neuronale à l'échelle de production |
| 2016 | [Neural MT of Rare Words with Subword Units](https://aclanthology.org/P16-1162/) | Sennrich, Haddow, Birch | A introduit la tokenisation BPE pour la TA |
| 2016 | [Improving NMT Models with Monolingual Data](https://aclanthology.org/P16-1009/) | Sennrich, Haddow, Birch | A introduit la backtranslation pour l'augmentation de données |
| 2017 | [Attention Is All You Need](https://arxiv.org/abs/1706.03762) | Vaswani et al. (Google) | A introduit l'architecture Transformer |
| 2020 | [Unsupervised Cross-lingual Representation Learning at Scale](https://arxiv.org/abs/1911.02116) | Conneau et al. (Facebook) | XLM-R : représentations cross-lingues pour 100 langues |
| 2020 | [Beyond English-Centric Multilingual MT](https://arxiv.org/abs/2010.11125) | Fan et al. (Facebook) | M2M-100 : plusieurs-vers-plusieurs sans pivotage par l'anglais |
| 2020 | [COMET: A Neural Framework for MT Evaluation](https://arxiv.org/abs/2009.09025) | Rei et al. (Unbabel) | Métrique d'évaluation neuronale avec corrélation humaine élevée |
| 2022 | [No Language Left Behind](https://arxiv.org/abs/2207.04672) | Équipe NLLB (Meta) | Modèle TA 200-langues + benchmark FLORES-200 |
| 2023 | [ALMA: A Paradigm Shift in MT](https://arxiv.org/abs/2309.11674) | Xu et al. (JHU) | Fine-tuning LLM pour la traduction SOTA avec peu de données |
| 2024 | [Tower: Open Multilingual LLM for Translation](https://arxiv.org/abs/2402.17733) | Alves et al. (Unbabel) | Pipeline de traduction complet dans un seul LLM |
| 2024 | [xCOMET: Transparent MT Evaluation](https://aclanthology.org/2024.tacl-1.54) | Guerreiro et al. | Détection d'erreur fine-grained en évaluation TA |
| 2024 | [AfriMTE and AfriCOMET](https://aclanthology.org/2024.naacl-long.334/) | Wang, Adelani et al. | Évaluation TA adaptée pour les langues africaines |

---

## Annexe B : Conférences et communautés

### Conférences majeures

L'écosystème des conférences sur le TAL (NLP) et la TA suit un rythme annuel. Le tableau ci-dessous répertorie les principaux lieux de rencontre, suivis des dates des éditions récentes.

| Conférence | Nom complet | Fréquence | Notes |
|---|---|---|---|
| **[WMT](https://statmt.org/wmt25/)** | Conference on Machine Translation | Annuelle | Le principal lieu compétitif du domaine ; les tâches partagées définissent les benchmarks |
| **[ACL](https://www.aclweb.org/)** | Association for Computational Linguistics | Annuelle | La conférence NLP phare |
| **EMNLP** | Empirical Methods in NLP | Annuelle | Conférence phare de second rang ; accueille généralement WMT |
| **NAACL** | North American Chapter of the ACL | Annuelle (alterne avec ACL) | Conférence régionale majeure |
| **EACL** | European Chapter of the ACL | Biennale | Conférence régionale européenne |
| **COLING** | Intl. Conf. on Computational Linguistics | Biennale | A été fusionnée avec LREC pour 2024 ; maintenant séparée à nouveau |
| **LREC** | Language Resources & Evaluation Conference | Biennale | Accent sur les données, ressources et évaluation |
| **[IWSLT](https://iwslt.org/)** | Intl. Workshop on Spoken Language Translation | Annuelle | Accent sur la traduction vocale |

#### Éditions récentes

*Dates uniquement — délibérément. Une colonne « statut » indiquant **À venir** est fausse le
jour où l'événement commence, et cette page ne peut pas connaître la date d'aujourd'hui. Comparez les dates
ci-dessous avec le calendrier vous-même ; les actes de tout événement déjà organisé se trouvent
sur l'[ACL Anthology](https://aclanthology.org).*

| Événement | Dates | Lieu |
|---|---|---|
| **COLING 2025** | 19–24 janv. 2025 | Abou Dabi, Émirats arabes unis |
| **EACL 2026** | 24–29 mars 2026 | Rabat, Maroc |
| **LREC 2026** | 11–16 mai 2026 | Palma de Majorque, Espagne |
| **ACL 2026** | 2–7 juil. 2026 | San Diego, États-Unis |
| **AmericasNLP 2026** | 3–4 juil. 2026 (co-localisé avec ACL) | San Diego, États-Unis |

*ACL 2025 (Vienne), EMNLP 2025 (Suzhou), WMT 2025 (Suzhou), IWSLT 2025 (Vienne) et PACLIC 39 (Hanoï) se sont tous déroulés en 2025. Leurs actes sont disponibles sur l'[ACL Anthology](https://aclanthology.org).*

#### Tâches partagées WMT 2025

Les tâches partagées WMT sont la chose la plus proche que le domaine de la TA ait d'une compétition publique. L'édition 2025 inclut :

- **General Machine Translation** — la tâche phare
- **Automated Translation Evaluation Systems** — métriques unifiées et estimation de qualité
- **Low-Resource Indic Language Translation**
- **Creole Language Translation**
- **Terminology Shared Task**
- **Model Compression** — rendre les modèles TA plus petits et plus rapides
- **Open Language Data** — améliorer les données d'entraînement ouvertes
- **Multilingual Instruction Shared Task (MIST)**
- **Limited Resources Slavic LLMs**

### Ateliers spécialisés

| Atelier | Domaine d'intérêt | Édition connue la plus récente | Co-localisé avec |
|---|---|---|---|
| **[AmericasNLP](https://americasnlp.org/)** | Langues autochtones des Amériques | 3–4 juil. 2026 (ACL 2026, San Diego) | ACL |
| **AfricaNLP** | TAL des langues africaines | 31 juil. 2025 (ACL 2025, Vienne) | ACL / ICLR |
| **LoResMT** | TA à faibles ressources | Généralement annuel lors des conférences *ACL | Divers |
| **SIGTYP** | SIG de l'ACL sur la typologie linguistique | Atelier annuel | ACL |

### Ressources communautaires clés

- **[machinetranslate.org](https://machinetranslate.org)** — Base de connaissances open-source communautaire sur la technologie TA. Gérée par la Machine Translate Foundation (association à but non lucratif, Zoug, Suisse, fondée 2021). Couvre les approches, API, modèles, support linguistique et actualités du secteur. Sous licence CC BY-SA 4.0. Un excellent point de départ pour tout sujet de ce rapport.

- **[ACL Anthology](https://aclanthology.org)** — L'archive open-access définitive de la recherche NLP/CL. Chaque article aux conférences ACL, EMNLP, NAACL, EACL, WMT et connexes est librement disponible ici.

---

## Annexe C : Outils, ensembles de données et ressources pratiques

Cette annexe couvre les outils concrets et les sources de données qui importent dans le travail de TA aujourd'hui. Elle est écrite pour les personnes qui savent se déplacer dans un terminal mais peuvent ne pas connaître l'écosystème TA.

### Cadres d'entraînement

Ce sont les packages logiciels utilisés pour *entraîner* les modèles TA neuronaux à partir de zéro (ou affiner les modèles existants). Vous utiliseriez ceux-ci si vous construisiez votre propre modèle de traduction plutôt que d'utiliser un modèle existant via une API.

| Cadre | Développeur | Langage | Notes |
|---|---|---|---|
| **[Marian NMT](https://marian-nmt.github.io/)** | Microsoft / U. Édimbourg | C++ | L'entraîneur TA open-source le plus rapide — peut entraîner un modèle 3–5× plus rapidement que les alternatives basées sur PyTorch. Écrit en C++ pur avec des dépendances minimales. Alimente Microsoft Translator. Chaque modèle OpusMT (voir ci-dessous) a été entraîné avec lui. Nommé d'après Marian Rejewski, le mathématicien polonais qui a aidé à casser Enigma. |
| **[fairseq](https://github.com/facebookresearch/fairseq)** | Meta AI | Python (PyTorch) | La boîte à outils de recherche de travail de Meta — utilisée pour construire M2M-100, NLLB-200 et la plupart des travaux TA publiés de Meta. Hautement modulaire : vous pouvez échanger les architectures, les fonctions de perte et le traitement des données. Le choix standard pour les chercheurs reproduisant ou étendant le travail de Meta. |
| **[OpenNMT](https://opennmt.net/)** | Harvard NLP / SYSTRAN | Python (PyTorch, TF) | Le point d'entrée le plus accessible pour entraîner des modèles TA personnalisés. Originaire d'un projet de recherche Harvard, maintenant géré par SYSTRAN (une entreprise TA commerciale). Inclut CTranslate2 pour le déploiement (voir ci-dessous). Bonne documentation pour les débutants. |

**Quand utiliseriez-vous ceux-ci ?** Si vous avez des données parallèles (même quelques milliers de paires de phrases) et voulez entraîner ou affiner un modèle de traduction dédié pour une paire de langues spécifique. Vous n'utiliseriez PAS ceux-ci pour la traduction basée sur LLM (inviter GPT/Claude/Gemini), qui ne nécessite aucun entraînement — juste des appels API.

### Inférence et déploiement

Ces outils exécutent les modèles *déjà entraînés* pour produire des traductions. Pensez aux cadres d'entraînement ci-dessus comme « l'atelier où la voiture est construite » et ceux-ci comme « la clé de contact qui démarre la voiture ».

| Outil | Ce qu'il fait | Quand l'utiliser |
|---|---|---|
| **[CTranslate2](https://github.com/OpenNMT/CTranslate2)** | Un moteur C++ qui exécute les modèles Transformer à haute vitesse avec peu de mémoire. Supporte la quantisation INT8/INT4 (réduisant les modèles à 1/4 de leur taille avec une perte de qualité minimale). S'exécute sur CPU ou GPU sans avoir besoin de PyTorch installé. Supporte NLLB, M2M-100, OpusMT, LLaMA, Whisper. | Quand vous voulez auto-héberger un modèle de traduction sur un serveur ou un ordinateur portable sans cluster GPU. Le choix incontournable pour le déploiement en production des modèles TA open-source. |
| **[Hugging Face Transformers](https://huggingface.co/models?pipeline_tag=translation)** | Bibliothèque Python qui charge et exécute les modèles avec quelques lignes de code : `pipe = pipeline('translation', model='Helsinki-NLP/opus-mt-en-fr'); pipe('Hello world')`. Fournit ~1 500 modèles OpusMT bilingues pré-entraînés plus NLLB-200, mBART, mT5 et M2M-100. | Quand vous voulez le chemin le plus rapide de « je veux traduire quelque chose » au code fonctionnel. Deux lignes de Python et vous traduisez. Débit inférieur à CTranslate2 mais beaucoup plus facile à configurer. |

### Familles de modèles pré-entraînés

Ce sont les modèles de traduction *déjà entraînés* que vous pouvez télécharger et utiliser immédiatement. Aucun entraînement requis — chargez simplement et traduisez.

| Famille de modèles | Langues | Développeur | Ce que c'est | Où trouver |
|---|---|---|---|---|
| **[OpusMT / Helsinki-NLP](https://huggingface.co/Helsinki-NLP)** | 1 000+ paires | Université d'Helsinki (Jörg Tiedemann) | La plus grande collection de modèles de traduction bilingues open-source. Chaque modèle gère une paire de langues (par exemple, `opus-mt-en-fr` pour anglais→français). Entraîné sur les données OPUS en utilisant Marian NMT, converti au format PyTorch pour Hugging Face. La qualité varie — excellente pour les paires bien dotées, marginale pour les ressources limitées. | Hugging Face (`Helsinki-NLP/opus-mt-*`) |
| **NLLB-200** | 200 langues | Meta | Un seul modèle multilingue qui traduit entre n'importe laquelle des 200 langues. Disponible en variantes 600M, 1.3B et 3.3B paramètres. La version 600M s'exécute sur un ordinateur portable ; la version 3.3B nécessite un GPU décent. La qualité varie énormément — forte pour les ressources moyennes, souvent faible pour les ressources vraiment limitées. | Hugging Face (`facebook/nllb-200-*`) |
| **M2M-100** | 100 langues | Meta | Le prédécesseur de NLLB-200 — premier modèle à traduire directement entre les paires non-anglaises (par exemple, bengali↔swahili) sans passer par l'anglais. Historiquement important ; largement supplanté par NLLB-200. | Hugging Face (`facebook/m2m100_*`) |
| **Tower / Tower+** | 22–27 langues | Unbabel | Pas seulement un traducteur — gère l'ensemble du pipeline de traduction (correction, NER, post-édition, estimation de qualité) dans un seul LLM. Affiné à partir de LLaMA. En 2025, Tower v2 (70B) surpasse GPT-4o et DeepL sur plusieurs benchmarks. | Hugging Face |
| **ALMA / X-ALMA** | 50 langues | Université Johns Hopkins | Modèles basés sur LLaMA affinés spécifiquement pour la traduction en utilisant l'optimisation de préférence (enseigner au modèle quelles traductions les humains préfèrent). Les versions 7B et 13B correspondent à la qualité GPT-4 sur les paires à ressources élevées. X-ALMA étend à 50 langues avec des modules adaptateurs spécifiques à la langue. | Hugging Face |

### Sources de données parallèles

Les données parallèles sont le carburant pour entraîner les modèles TA : des collections de phrases dans deux langues qui sont des traductions l'une de l'autre, alignées ligne par ligne. Sans données parallèles, vous ne pouvez pas entraîner un modèle TA conventionnel. (La traduction basée sur LLM contourne cela — vous pouvez inviter GPT à traduire sans aucune donnée parallèle — mais les modèles dédiés en ont toujours besoin.)

| Ensemble de données | Échelle | Ce que c'est | URL |
|---|---|---|---|
| **[OPUS](https://opus.nlpl.eu)** | 100B+ paires de phrases, 1 000+ langues | La ressource la plus importante pour les données TA. Une méta-collection qui agrège des dizaines de sous-corpus (voir ci-dessous) en un portail unique consultable. Créée et maintenue par Jörg Tiedemann à l'Université d'Helsinki. Si vous cherchez des données parallèles dans n'importe quelle langue, OPUS est où vous commencez. Accessible via portail web, package Python `opustools` et Hugging Face. | [opus.nlpl.eu](https://opus.nlpl.eu) |
| **[Europarl](http://www.statmt.org/europarl/)** | ~60M mots/langue, 21 langues officielles de l'UE | Délibérations du Parlement européen — discours de politiciens traduits dans toutes les langues officielles de l'UE. Créé par Philipp Koehn. Historiquement fondamental (l'ensemble de données qui a rendu la recherche TAS possible), mais limité aux langues de l'UE et au registre parlementaire. | [statmt.org/europarl](http://www.statmt.org/europarl/) |
| **[ParaCrawl](https://paracrawl.eu)** | Milliards de paires, 29+ paires de langues | Projet financé par l'UE qui crawle le web pour trouver du texte parallèle naturel (sites web bilingues, pages traduites). Beaucoup plus bruyant que les corpus organisés mais vastement plus grand. A lancé le pipeline de crawling open-source **Bitextor**, que n'importe qui peut utiliser pour extraire ses propres données parallèles du web. | [paracrawl.eu](https://paracrawl.eu) |
| **[CCAligned](http://www.statmt.org/cc-aligned/)** | 392M paires d'URL, 137 directions appairées à l'anglais | Documents parallèles extraits du web à partir de Common Crawl (Meta/JHU). Particulièrement utile pour les langues à ressources faibles à moyennes qui n'apparaissent pas dans les corpus organisés. La qualité est inférieure à Europarl mais la couverture est beaucoup plus large. | [statmt.org/cc-aligned](http://www.statmt.org/cc-aligned/) |
| **[WikiMatrix](https://github.com/facebookresearch/LASER)** | 135M phrases parallèles, 1 620 paires | Phrases parallèles automatiquement extraites de Wikipedia en utilisant les embeddings multilingues LASER (Meta). Utile car Wikipedia existe dans de nombreuses langues — mais l'alignement est automatique (non vérifié par l'humain), donc certaines paires sont bruyantes ou incorrectes. | GitHub (dépôt LASER) |
| **[Tatoeba](https://tatoeba.org)** | 500+ langues | Une collection maintenue par la communauté de phrases d'exemple et leurs traductions, contribuées par des bénévoles du monde entier. Phrases individuelles, pas des documents. Le **[Tatoeba Translation Challenge](https://github.com/Helsinki-NLP/Tatoeba-Challenge)** associé (Helsinki-NLP) fournit des divisions train/test propres pour des milliers de paires de langues — utilisées pour entraîner les modèles OpusMT. | [tatoeba.org](https://tatoeba.org) |
| **FLORES-200** | 200 langues | Un benchmark d'évaluation standardisé (PAS des données d'entraînement). Phrases traduites professionnellement utilisées pour comparer les systèmes sur un pied d'égalité. Créé par Meta aux côtés de NLLB-200. Si vous voulez comparer votre système contre les baselines publiées, c'est l'ensemble de test à utiliser. | Hugging Face |

### Sous-corpus clés dans OPUS

OPUS agrège de nombreux corpus parallèles indépendants. Quand vous cherchez des données dans une langue spécifique, ces sous-collections valent la peine d'être vérifiées :

- **OpenSubtitles** — Sous-titres de films et séries TV. Volume massif mais bruyant — les sous-titres sont souvent simplifiés, informels et peuvent contenir des erreurs de transcription.
- **JW300** — Publications des Témoins de Jéhovah, couvrant ~300 langues. La couverture linguistique la plus large de n'importe quel corpus unique, mais fortement biaisée vers le contenu religieux et éthiquement contestée (voir Partie 4).
- **Bible** — Traductions bibliques dans 700+ langues. Domaine le plus étroit de tous (texte religieux ancien), mais pour de nombreuses langues, le seul texte parallèle qui existe du tout.
- **Tanzil** — Traductions du Coran. Utile pour les données appairées à l'arabe.
- **GNOME / KDE** — Chaînes de localisation de logiciels (« Fichier → Enregistrer », « Êtes-vous sûr de vouloir supprimer ? »). Utile pour le domaine technique/UI mais très formulaïque.
- **EMEA** — Documents de l'Agence européenne des médicaments. Utile pour la traduction du domaine biomédical.

---

## Annexe D : Glossaire

**Mécanisme d'attention** : Un composant de réseau de neurones qui permet au modèle de se concentrer dynamiquement sur différentes parties de l'entrée lors de la production de chaque partie de la sortie. Introduit par Bahdanau et al. (2014) pour la TA ; généralisé dans le Transformer (2017).

**Backtranslation** : Une technique d'augmentation de données où le texte monolingue en langue cible est traduit en langue source par un système TA préliminaire, créant des données parallèles synthétiques pour l'entraînement.

**BLEU** : Bilingual Evaluation Understudy. Une métrique d'évaluation TA automatique basée sur le chevauchement de précision n-gramme avec les traductions de référence.

**BPE (Byte Pair Encoding)** : Un algorithme de tokenisation de sous-mots qui fusionne itérativement les paires de caractères les plus fréquentes pour construire un vocabulaire. Utilisé dans pratiquement tous les systèmes NMT et LLM modernes.

**COMET** : Une métrique d'évaluation TA neuronale qui utilise les embeddings cross-lingues pour prédire les jugements de qualité humains, opérant sur source + hypothèse + référence.

**Malédiction de la multilingualité** : Le phénomène où ajouter plus de langues à un modèle multilingue dilue la qualité par langue en raison de la capacité de modèle fixe.

**Encodeur–décodeur** : Une architecture neuronale où un encodeur traite la séquence d'entrée en représentations, et un décodeur génère la séquence de sortie à partir de ces représentations.

**FLORES-200** : Un benchmark d'évaluation TA standardisé couvrant 200 langues, créé par Meta aux côtés de NLLB-200.

**TEF (Transducteur à États Finis)** : Un dispositif computationnel qui mappe entre les séquences de symboles d'entrée et de sortie en utilisant des états et des transitions. Utilisé en morphologie computationnelle pour analyser et générer les formes de mots.

**Hallucination** : En TA, la production d'une sortie fluide qui n'est pas liée ou infidèle au texte source. Particulièrement courante dans les paramètres à ressources limitées.

**Langue à ressources élevées** : Une langue avec du texte numérique abondant et des données de traduction parallèles (généralement >10M paires de phrases avec l'anglais). Exemples : français, allemand, chinois, espagnol.

**LLM (Grand Modèle de Langage)** : Un modèle de langage neuronal avec des milliards de paramètres, entraîné sur de vastes corpus de texte pour prédire le prochain token. Exemples : GPT-4, Gemini, LLaMA, Claude.

**Langue à ressources limitées (LRL)** : Une langue avec du texte numérique limité et des données parallèles (<1M paires de phrases). La grande majorité des langues du monde relève de cette catégorie.

**MQM (Métriques de Qualité Multidimensionnelles)** : Un cadre d'évaluation humaine où les traducteurs professionnels annotent les étendues d'erreur spécifiques dans les traductions, classifiées par type et sévérité.

**NMT (Traduction Automatique Neuronale)** : TA utilisant les réseaux de neurones, par opposition aux approches statistiques (TAS) ou fondées sur des règles (RBMT).

**Données parallèles / corpus parallèle** : Une collection de textes dans deux langues qui sont des traductions l'une de l'autre, alignées au niveau de la phrase. La ressource d'entraînement principale pour la TA.

**Langue polysynthétique** : Une langue dans laquelle les mots sont composés de nombreux morphèmes, codant souvent des informations qui nécessiteraient une clause entière dans les langues analytiques comme l'anglais. Exemples : Plains Cree, Mohawk, Inuktitut.

**SentencePiece** : Un tokeniseur de sous-mots indépendant de la langue et un détokeniseur qui implémente BPE et la segmentation du modèle de langage unigramme. Largement utilisé en NLP multilingue.

**Transformer** : L'architecture neuronale dominante pour le NLP depuis 2017, basée entièrement sur les mécanismes d'auto-attention. Introduite dans « Attention Is All You Need » (Vaswani et al., 2017).

**Transfert cross-lingue zéro-shot** : Appliquer un modèle entraîné sur une langue (généralement l'anglais) à une autre langue sans aucune donnée d'entraînement en langue cible, s'appuyant sur les représentations multilingues partagées.

---

*Ce rapport a été compilé en juin 2026. Le domaine de la TA se déplace rapidement ; les capacités spécifiques des modèles et les résultats des benchmarks doivent être vérifiés par rapport aux sources actuelles. Pour les derniers développements, consultez [machinetranslate.org](https://machinetranslate.org), l'[ACL Anthology](https://aclanthology.org) et les actes de la tâche partagée WMT la plus récente.*

---

## Où cela mène-t-il sur ce site

L'écart que décrit cette note d'information — des centaines de langues sans aucune traduction
mesurée — est ce que le reste de ce site vise à combler. L'argumentaire
sur la méthode ([Ce qu'est Champollion](/docs/what-is-champollion)), l'économie
de la construction d'un ensemble d'évaluation plutôt que d'un corpus d'entraînement
([Qui en bénéficie — les chercheurs](/docs/network/who-benefits#researchers)), et
l'état de ce qui a été réellement mesuré jusqu'à présent
([Limites honnêtes](/docs/network/honest-limitations)) constituent les trois
prochaines lectures naturelles.
