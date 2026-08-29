---
sidebar_position: 1
title: "De Pāṇini aux Transformers"
---

# De Pāṇini aux Transformers : Langage, calcul et l'œuvre inachevée de la traduction

**Une histoire des idées derrière champollion**

---

> *« Quand je regarde un article en russe, je me dis : « C'est vraiment écrit en anglais, mais c'est codé dans des symboles étranges. Je vais maintenant procéder au décodage. »*
> — Warren Weaver, 1949

---

## Introduction

Le rêve d'une machine capable de traduire entre les langues humaines est plus ancien que l'ordinateur lui-même. C'est, en quelque sorte, *le* problème originel de l'intelligence artificielle—plus ancien que les programmes jouant aux échecs, plus ancien que les systèmes experts, plus ancien que les réseaux de neurones. Ce désir est souvent encadré par des paraboles européennes comme la Tour de Babel, qui positionne la diversité linguistique comme une punition ou un problème à résoudre, contournant la réalité que les sociétés autochtones précédant le contact ont longtemps navigué une diversité linguistique vertigineuse par le biais de langues commerciales sophistiquées (comme le Chinook Jargon) et de systèmes de signes (comme la Langue des Signes des Plaines) sans chercher une homogénéisation universelle.

Mais l'histoire qui mène à ce moment—à un monde où les grands modèles de langage peuvent traduire un français passable mais hallucinent des absurdités en cri—n'est pas une ligne droite. C'est une tresse d'au moins quatre fils distincts : l'étude formelle du langage, la théorie mathématique du calcul, la révolution statistique en apprentissage automatique, et une histoire plus sombre qui explique *pourquoi* les langues ayant le plus besoin de technologie sont précisément celles pour lesquelles elle n'existe pas. Ce quatrième fil est l'histoire de la suppression linguistique coloniale et du génocide culturel—la destruction délibérée et systématique des langues autochtones sur chaque continent où les puissances européennes ont établi leur domination. Sans comprendre cette histoire, le problème technique ressemble à un accident de rareté des données. Ce n'en est pas un.

Cet article retrace les quatre fils depuis leurs origines jusqu'à leur convergence au présent. C'est, il faut l'admettre, quelque peu whiggiste—il raconte l'histoire comme si elle menait toujours ici. L'histoire, bien sûr, ne savait pas où elle allait. Mais les fils sont réels, les connexions sont authentiques, et les comprendre est essentiel pour comprendre pourquoi des projets comme champollion existent, pourquoi ils sont construits comme ils le sont, et pourquoi ils importent maintenant.

---

## I. La grammaire de tout : De Pāṇini à Chomsky

### La première grammaire formelle (vers le 4e siècle avant notre ère)

L'histoire commence non pas dans une université européenne mais dans l'Inde ancienne, avec un érudit nommé Pāṇini. Vers le 4e siècle avant notre ère, Pāṇini a composé l'*Aṣṭādhyāyī*—une grammaire du sanskrit comprenant environ 4 000 règles. Ce n'était pas une grammaire au sens vague et pédagogique. C'était une grammaire *générative* : un ensemble fini de règles capable, en principe, de produire chaque énoncé valide de la langue.

Le système de Pāṇini utilisait ce que nous reconnaîtrions maintenant comme des règles de réécriture formelles, avec des variables, de la récursion et une application ordonnée. Le linguiste Paul Kiparsky a soutenu que l'*Aṣṭādhyāyī* est « la grammaire générative la plus complète de toute langue jamais écrite » (Kiparsky, 1993). L'informaticien Gerard Huet a montré que les règles de Pāṇini peuvent être modélisées comme un transducteur à états finis—le même formalisme computationnel qui, vingt-cinq siècles plus tard, deviendrait central pour l'analyse morphologique des langues polysynthétiques.

Pāṇini ne savait pas qu'il faisait de l'informatique. Mais il en faisait.

### La Pierre de Rosette et la naissance de la linguistique comparée (1799)

Pendant la majeure partie de l'histoire enregistrée, l'étude du langage était principalement l'étude de *sa propre* langue—ou, au mieux, l'étude d'une langue sacrée ou classique à des fins liturgiques. La révolution intellectuelle qui a créé la linguistique moderne a commencé avec une pierre.

La Pierre de Rosette, découverte par les soldats de Napoléon en 1799, portait le même décret en trois écritures : hiéroglyphes égyptiens, écriture démotique et grec ancien. Le déchiffrement des hiéroglyphes par Jean-François Champollion en 1822 était plus qu'un triomphe archéologique. Il a démontré un principe qui deviendrait fondamental : que les langues pouvaient être comprises *par le biais les unes des autres*. La traduction n'était pas simplement une compétence pratique ; c'était une méthode d'investigation scientifique.

### William Jones et l'hypothèse indo-européenne (1786)

Même avant Champollion, le philologue britannique Sir William Jones avait livré sa célèbre conférence à la Société asiatique du Bengale en 1786, observant que le sanskrit portait au grec et au latin « une affinité plus forte, tant dans les racines des verbes que dans les formes de la grammaire, que ce qui aurait pu être produit par le hasard ». Jones a proposé que les trois descendaient d'un ancêtre commun « qui, peut-être, n'existe plus ».

C'était la naissance de la linguistique historique et comparée. Elle a établi que les langues n'étaient pas des entités isolées et statiques mais des membres de familles—liées par la descendance, façonnées par le temps, soumises à des lois régulières de changement. C'était, en quelque sorte, une théorie de l'évolution des décennies avant Darwin.

### Les arbres linguistiques d'August Schleicher (1861)

C'est August Schleicher, un linguiste allemand, qui a rendu la connexion darwinienne explicite. En 1861—seulement deux ans après *De l'origine des espèces*—Schleicher a publié son modèle *Stammbaum* (arbre généalogique) des langues indo-européennes. Ses diagrammes ressemblent presque indistinctement aux arbres phylogénétiques en biologie. Les langues, comme les espèces, se ramifiaient, divergeaient et s'éteignaient occasionnellement.

Les arbres de Schleicher étaient une simplification (les langues *convergent* aussi par le contact, l'emprunt et la créolisation), mais le modèle s'avéra extrêmement productif. Il a établi le principe que la diversité linguistique n'était pas du bruit aléatoire mais des données structurées, susceptibles d'une analyse systématique. Et il a posé, implicitement, une question qui reste centrale pour notre projet : que se passe-t-il pour les branches qui meurent ?

### Ferdinand de Saussure et l'architecture du langage (1916)

La révolution suivante est venue de Ferdinand de Saussure, dont le *Cours de linguistique générale* (publié à titre posthume en 1916 à partir des notes des étudiants) a établi la linguistique structurale. Saussure a tracé une distinction nette entre *langue* (le système abstrait d'une langue) et *parole* (la parole réelle). Il a soutenu que les signes linguistiques étaient *arbitraires*—le mot « arbre » n'a aucune connexion inhérente aux arbres—et que le sens provenait des *différences* au sein d'un système, non d'un contenu positif quelconque.

Le diagramme clé de Saussure—l'ovale divisé entre *signifié* (le concept) et *signifiant* (l'image acoustique), liés par des flèches montrant leur relation inséparable—est devenu l'une des images les plus reproduites dans les sciences humaines. Il a établi le principe qu'une langue est un *système de systèmes*, où chaque élément tire sa valeur de ses relations avec tous les autres.

Cela avait des implications profondes pour la traduction. Si le sens est relationnel et systémique, alors la traduction n'est pas une question d'échange de mots. Elle nécessite de comprendre l'architecture entière d'une langue. Deux langues peuvent découper le monde de manières fondamentalement différentes—une intuition qui serait développée ultérieurement (et parfois exagérée) par Edward Sapir et Benjamin Lee Whorf.

### Sapir, Bloomfield et l'étude des langues autochtones

En Amérique du Nord, le début du 20e siècle a apporté une tradition différente de travail de terrain linguistique. Edward Sapir et Leonard Bloomfield ont travaillé extensivement avec les langues autochtones—Sapir avec le navajo, le nootka et beaucoup d'autres ; Bloomfield avec le menomini et d'autres langues algonquiennes. Ils ont rencontré des structures linguistiques radicalement différentes de tout ce qui existait dans la famille indo-européenne.

Sapir, en particulier, a développé un cadre typologique qui classait les langues selon plusieurs axes, y compris la distinction critique entre les langues *analytiques* (comme l'anglais, où les mots tendent à être courts et le sens est porté par l'ordre des mots) et les langues *polysynthétiques* (comme le cri, où un seul mot peut encoder ce que l'anglais exprimerait comme une phrase entière). Une seule forme verbale en cri pourrait incorporer le sujet, l'objet, le temps, l'aspect, l'évidentialité et plusieurs éléments modificateurs en un seul mot morphologiquement complexe.

Ce travail a établi deux faits qui restent centraux pour notre projet. Premièrement : la diversité structurale des langues du monde est bien plus grande que tout modèle centré sur l'Europe ne le suggérerait. Deuxièmement : beaucoup de ces langues étaient déjà en danger. Cependant, bien que les premiers linguistes structuralistes aient documenté cette complexité, ils ont souvent participé à l'« anthropologie de sauvetage »—un modèle académique extractif qui traitait les peuples autochtones simplement comme des « informateurs » pour construire des carrières académiques occidentales. Cette approche a sevré les langues de leurs racines épistémologiques, ouvrant la voie à traiter le langage comme des données désincarnées et extractibles plutôt que comme des systèmes vivants et relationnels.

### La révolution Chomsky (1957)

En 1957, un linguiste du MIT âgé de 28 ans nommé Noam Chomsky a publié *Syntactic Structures*, un mince livre qui a explosé comme une bombe dans le domaine. Chomsky a soutenu que l'objectif de la linguistique devrait être de découvrir la *grammaire générative* d'une langue—un ensemble fini de règles capable de produire tous et seulement les énoncés grammaticaux de cette langue.

Plus provocateur encore, Chomsky a proposé la *hiérarchie de Chomsky* : une classification des grammaires formelles selon leur puissance computationnelle. La hiérarchie a quatre niveaux :

- **Type 3 (Régulier)** : Reconnu par les automates finis. Motifs simples.
- **Type 2 (Sans contexte)** : Reconnu par les automates à pile. Structures récursives comme les parenthèses imbriquées.
- **Type 1 (Sensible au contexte)** : Reconnu par les automates linéairement bornés. Dépendances plus complexes.
- **Type 0 (Récursivement énumérable)** : Reconnu par les machines de Turing. Tout ce qui est calculable.

Chomsky a soutenu que les langues naturelles nécessitaient au moins des grammaires sans contexte, et possiblement plus. C'était un pont direct entre la linguistique et la théorie mathématique du calcul. Les mêmes outils formels qu'Alan Turing avait développés pour raisonner sur les limites du calcul pouvaient maintenant être appliqués au langage humain.

Chomsky a également proposé l'idée de *Grammaire universelle*—que la capacité pour le langage est innée, que toutes les langues humaines partagent des propriétés structurelles profondes, et que la diversité des formes de surface masque une unité sous-jacente. Cela reste controversé (de nombreux typologues et fonctionnalistes ne sont pas d'accord), mais les outils formels que Chomsky a introduits—les règles de structure de phrase, les grammaires transformationnelles, la hiérarchie elle-même—sont devenus la fondation de la linguistique computationnelle.

---

## II. Le rêve de la traduction universelle

### La machine pensante de Ramon Llull (1305)

Le rêve de mécaniser la pensée—et avec elle, le rêve de la traduction mécanique—est remarquablement ancien. Ramon Llull, un mystique catalan du 13e siècle, a conçu l'*Ars Magna* : un système de disques concentriques rotatifs inscrits de concepts fondamentaux, dont les combinaisons étaient censées générer toutes les vérités possibles. Les roues de Llull étaient, en un sens, la première machine de logique combinatoire. Leibniz citerait plus tard Llull comme une inspiration.

### Athanasius Kircher et la Polygraphia Nova (1663)

Athanasius Kircher, le grand polymathe jésuite, a publié *Polygraphia Nova et Universalis* en 1663—un système d'« écriture universelle » destiné à permettre la communication au-delà des barrières linguistiques. Le système de Kircher assignait des nombres aux concepts, qui pouvaient ensuite être décodés dans n'importe quelle langue avec la table appropriée. C'était, en essence, une interlingue—une représentation du sens indépendante de la langue.

Le système ne fonctionnait pas très bien. Mais l'*idée* a persisté : qu'entre deux langues quelconques existe un espace conceptuel commun, et que la traduction est une question de cartographie à travers lui. Cette hypothèse d'interlingue n'était pas simplement une expérience scientifique défectueuse ; c'était une extension épistémologique du contrôle colonial, incapable de cartographier les ontologies divergentes. Le philosophe W.V.O. Quine formalisera plus tard cet échec avec son concept d'*indétermination de la traduction* (1960), arguant que la traduction radicale est intrinsèquement indéterminée. La cartographie universelle et sans contexte entre des systèmes linguistiques fondamentalement divergents est une impossibilité philosophique, non simplement un obstacle technique.

### John Wilkins et la Langue philosophique (1668)

Seulement cinq ans après Kircher, le naturaliste anglais John Wilkins a publié *An Essay towards a Real Character, and a Philosophical Language*—une tentative de créer une langue dont la structure *reflétait parfaitement la structure de la réalité*. Chaque concept serait classé dans une grande taxonomie, et son nom encoderait sa position dans cette taxonomie.

Le projet de Wilkins a échoué (la réalité s'est avérée résistante à la classification soignée), mais il anticipait quelque chose d'important : l'idée que le langage pouvait être *conçu*, que la relation entre les mots et les sens pouvait être rendue systématique et explicite. C'est, en un sens profond, ce que font les linguistes computationnels quand ils construisent des ontologies et des graphes de connaissances.

### Leibniz et la Characteristica Universalis

Gottfried Wilhelm Leibniz, qui a indépendamment inventé le calcul et conçu une calculatrice mécanique, a rêvé d'une *characteristica universalis*—un langage formel universel dans lequel toute la connaissance humaine pourrait être exprimée—et d'un *calculus ratiocinator*—une machine qui pourrait raisonner dans ce langage. « Si des controverses devaient surgir, » a écrit Leibniz, « il n'y aurait plus besoin de dispute entre deux philosophes que entre deux comptables. Car il suffirait de prendre leurs crayons à la main, de s'asseoir à leurs ardoises, et de se dire l'un à l'autre : Calculons. »

Leibniz a également inventé l'arithmétique binaire—le système numérique qui, des siècles plus tard, deviendrait le langage des ordinateurs numériques. Son article de 1703 *Explication de l'Arithmétique Binaire* a montré que tout nombre pouvait être représenté en utilisant seulement 0 et 1. Il y voyait un reflet de la création divine (quelque chose du néant), mais cela s'avérerait être la fondation de tout calcul numérique.

### Le mémorandum de Warren Weaver (1949)

L'ère moderne de la traduction automatique commence par un mémorandum. En juillet 1949, le mathématicien et administrateur scientifique américain Warren Weaver a écrit à Norbert Wiener, proposant que les nouveaux ordinateurs électroniques pourraient être appliqués au problème de la traduction. Son mémorandum contenait le passage remarquable cité à l'ouverture de cet article : l'idée qu'un texte russe est « vraiment écrit en anglais, mais... codé dans des symboles étranges ».

La métaphore de Weaver était tirée de l'analyse cryptographique en temps de guerre—l'idée que la traduction était fondamentalement un problème de *décodage*. Ce n'était pas simplement une analogie. Les mêmes outils statistiques et théoriques de l'information qui avaient été développés pour casser les chiffres ennemis pourraient, suggérait Weaver, être applicables au problème de la traduction.

Le mémorandum était extrêmement optimiste, mais il a lancé un programme de recherche. En moins de cinq ans, la première démonstration de traduction automatique aurait lieu.

---

## III. La machinerie de la pensée : Calcul et information

### George Boole et l'algèbre de la logique (1854)

En 1854, George Boole a publié *An Investigation of the Laws of Thought*—une œuvre qui a réduit le raisonnement logique à des opérations algébriques. Boole a montré que les propositions de la logique pouvaient être manipulées en utilisant les mêmes règles que l'algèbre, avec ET correspondant à la multiplication, OU à l'addition, et NON au complément.

L'algèbre booléenne semblait être une curiosité mathématique à l'époque. Elle deviendrait le principe de fonctionnement de chaque circuit numérique jamais construit.

### Charles Babbage et Ada Lovelace (1837–1843)

Charles Babbage a conçu (mais n'a jamais terminé) la Machine analytique—un ordinateur mécanique, alimenté à la vapeur, à usage général. Contrairement à sa Machine à différences antérieure (une calculatrice spécialisée), la Machine analytique avait une mémoire (« le Magasin »), une unité de traitement (« le Moulin »), des branchements conditionnels et des boucles. Elle était, en principe, Turing-complète.

Ada Lovelace, travaillant à partir d'une description de la Machine, a écrit un ensemble de notes détaillées qui incluaient ce qui est largement considéré comme le premier programme informatique publié : un algorithme pour calculer les nombres de Bernoulli (Note G, 1843). Mais la contribution la plus profonde de Lovelace était conceptuelle. Elle a vu que la Machine pouvait manipuler des *symboles*, pas seulement des nombres. « La Machine analytique tisse des motifs algébriques, » a-t-elle écrit, « tout comme le métier à tisser Jacquard tisse des fleurs et des feuilles. » L'implication—que le calcul pouvait être appliqué à n'importe quel domaine ayant une structure formelle, y compris le langage—était visionnaire.

### Alan Turing et la machine universelle (1936)

En 1936, Alan Turing a publié « On Computable Numbers, with an Application to the Entscheidungsproblem »—un article qui a simultanément défini le calcul, prouvé ses limites et inventé l'ordinateur moderne (sous forme abstraite).

L'intuition clé de Turing était la *machine universelle* : une seule machine qui, avec les bonnes instructions codées sur son ruban, pouvait simuler *n'importe quelle autre* machine. Cela a établi qu'il n'y avait aucune différence essentielle entre le matériel et le logiciel, entre la machine et le programme. Un seul appareil, correctement programmé, pouvait calculer tout ce qui était calculable.

Le travail de Turing a également établi les limites du calcul (le problème de l'arrêt) et a jeté les bases de son exploration ultérieure de l'intelligence des machines. Son article de 1950 « Computing Machinery and Intelligence », qui a proposé le célèbre Test de Turing, a encadré la question de l'intelligence des machines explicitement en termes de *langage* : une machine est intelligente si, par la conversation, elle ne peut pas être distinguée d'un humain.

### Claude Shannon et la théorie de l'information (1948)

En 1948, Claude Shannon a publié « A Mathematical Theory of Communication » dans le *Bell System Technical Journal*—un article qui a fondé le domaine de la théorie de l'information. Shannon a montré que la communication pouvait être modélisée comme un système : une *source d'information* génère un *message*, qu'un *transmetteur* encode en un *signal*, qui passe par un *canal* (soumis au *bruit*), qu'un *récepteur* décode en un message pour une *destination*.

La contribution clé de Shannon était le concept d'*entropie*—une mesure de l'incertitude ou du contenu informatif d'un message. Il a prouvé que pour tout canal avec un niveau de bruit donné, il existe un taux maximum auquel l'information peut être transmise de manière fiable (la capacité du canal), et que ce taux peut être atteint avec un codage suffisamment ingénieux.

La connexion à la traduction est profonde. Shannon lui-même, dans un article de 1951, a utilisé la théorie de l'information pour analyser la structure statistique de l'anglais. Il a montré que le texte anglais est hautement redondant—qu'un locuteur natif, étant donné une séquence de lettres, peut prédire la lettre suivante avec une grande précision. Cette redondance est ce qui rend la communication robuste contre le bruit, mais cela signifie aussi que le *contenu informatif* du langage est beaucoup plus faible que le nombre de symboles bruts ne le suggérerait.

Warren Weaver a immédiatement vu la connexion : si la traduction est un décodage, et si la structure statistique du langage peut être modélisée, alors la traduction est un problème théorique de l'information. Cette intuition prendrait des décennies pour porter ses fruits, mais quand elle l'a fait, elle a transformé le domaine.

### Von Neumann et l'ordinateur à programme enregistré (1945)

Le rapport de John von Neumann de 1945 sur l'EDVAC (Electronic Discrete Variable Automatic Computer) décrivait ce que nous appelons maintenant l'*architecture de von Neumann* : un ordinateur avec un seul magasin de mémoire pour les données et les instructions, une unité centrale de traitement et des mécanismes d'entrée/sortie. Cette architecture—les données et les programmes partageant la même mémoire, traitées séquentiellement par une CPU—reste la conception fondamentale de presque tous les ordinateurs en usage aujourd'hui.

L'architecture de von Neumann a rendu le logiciel pratique. Les programmes pouvaient être stockés, modifiés et même générés par d'autres programmes. C'était la précondition technologique pour tout ce qui a suivi : les compilateurs, les systèmes d'exploitation et finalement les cadres de réseaux de neurones qui alimentent la traduction automatique moderne.

---

## IV. La traduction automatique : Le premier problème de l'IA

### L'expérience Georgetown-IBM et la Guerre froide (1954)

Le 7 janvier 1954, des chercheurs de l'Université de Georgetown et d'IBM ont démontré le premier système public de traduction automatique. Le système a traduit 60 phrases russes en anglais en utilisant un vocabulaire de 250 mots et six règles de grammaire. Les phrases ont été soigneusement sélectionnées pour être dans les capacités du système, mais la démonstration a généré un enthousiasme énorme.

Le *New York Times* a rapporté que l'expérience présageait un avenir où « un traducteur électronique à bouton-poussoir » rendrait toute la littérature scientifique du monde instantanément accessible. Cependant, cet optimisme public masquait la réalité matérielle du financement du projet. L'expérience Georgetown-IBM—et le domaine de la traduction automatique au début—n'était pas motivée par un désir utopique de communication universelle. Elle était financée par l'appareil militaire et de renseignement américain (y compris la CIA et la DARPA) comme une urgence impérative de la Guerre froide pour surveiller et intercepter les textes scientifiques et militaires soviétiques.

La vision du langage comme un « code à casser » (comme l'a dit Weaver) était intrinsèquement liée à la surveillance militarisée. Les chercheurs ont prédit que la traduction automatique serait un problème résolu en cinq ans. Ils se sont trompés de plus de la moitié d'un siècle.

### Le rapport ALPAC et le premier hiver de l'IA (1966)

En 1966, le Comité consultatif sur le traitement automatique des langues (ALPAC), convoqué par le gouvernement américain, a publié un rapport dévastateur. Après avoir examiné une décennie de recherche en TA, l'ALPAC a conclu que la traduction automatique était plus lente, moins précise et plus coûteuse que la traduction humaine, et a recommandé que le financement soit réorienté vers la recherche fondamentale en linguistique computationnelle.

Le rapport ALPAC a effectivement tué le financement de la recherche en TA aux États-Unis pendant plus d'une décennie. C'était le premier « hiver de l'IA »—un motif qui se répéterait : des promesses extravagantes, des résultats modestes, la désillusion, l'effondrement du financement.

Mais le rapport contenait aussi une intuition plus profonde. La traduction automatique avait échoué, en partie, parce que le langage était plus difficile que quiconque ne l'avait prévu. L'approche basée sur les règles—écrire des règles de grammaire explicites pour analyser et générer des phrases—fonctionnait pour les cas simples mais s'effondrait catastrophiquement sur le texte réel. Le langage était trop ambigu, trop dépendant du contexte, trop *vivant* pour que des règles rigides le capturent.

### TA basée sur les règles et basée sur le transfert (années 1970–1980)

La recherche a continué, plus discrètement, dans les années 1970 et 1980. Des systèmes comme SYSTRAN (qui alimentaient les premiers services de traduction de la Commission européenne) utilisaient de grands dictionnaires et des règles de transfert élaborés à la main pour mapper entre les paires de langues. Ces systèmes pouvaient produire des traductions approximatives utiles pour les domaines restreints, mais ils nécessitaient un effort d'ingénierie énorme pour chaque paire de langues, et ils géraient rarement le texte sans restriction avec grâce.

Le problème fondamental était clair : le langage n'est pas un chiffre. Vous ne pouvez pas traduire en cherchant des mots dans un dictionnaire et en les réarrangeant selon les règles grammaticales, car le sens dépend du contexte, de la connaissance du monde, de l'intention du locuteur, de toute l'histoire d'une conversation. L'approche interlingue—traduire par le biais d'une représentation abstraite indépendante de la langue—était théoriquement élégante mais pratiquement impossible. Personne ne pouvait définir l'interlingue.

### La révolution statistique (années 1990)

La percée est venue non pas de meilleures règles mais de meilleures données. À la fin des années 1980 et au début des années 1990, des chercheurs chez IBM (Peter Brown, Stephen Della Pietra, Vincent Della Pietra et Robert Mercer) ont développé une série de modèles statistiques pour la traduction automatique—les célèbres modèles IBM 1 à 5.

L'intuition clé était la vieille idée de Weaver, enfin rendue rigoureuse : la traduction comme décodage. Étant donné une phrase étrangère *f*, trouvez la phrase anglaise *e* qui maximise P(e|f). Par le théorème de Bayes, cela équivaut à maximiser P(f|e) × P(e)—un *modèle de traduction* (quelle est la probabilité de cette phrase étrangère étant donné cette phrase anglaise ?) multiplié par un *modèle de langage* (quelle est la probabilité de cette phrase anglaise en elle-même ?).

Les modèles IBM ont appris ces probabilités à partir de grands *corpus parallèles*—des collections de textes qui existaient dans les deux langues (comme les Hansards parlementaires canadiens, qui ont été publiés en anglais et en français). Aucune règle élaborée à la main n'était requise. Le système a appris à traduire en observant des millions d'exemples de traduction humaine.

La TA statistique a fonctionné dramatiquement mieux que la TA basée sur les règles pour les langues avec des données parallèles abondantes. Elle a également introduit un élément critique d'infrastructure : le **score BLEU** (Papineni et al., 2002), une métrique pour évaluer automatiquement la qualité de la traduction en comparant la sortie de la machine aux traductions de référence humaines. BLEU a rendu possible de mesurer les progrès quantitativement et d'exécuter des expériences à grande échelle.

Mais la TA statistique avait une hypothèse fatale intégrée : elle nécessitait des *corpus parallèles*. Pour les principales paires de langues du monde—anglais-français, anglais-chinois, anglais-espagnol—les données parallèles étaient abondantes. Pour la grande majorité des 7 000 langues du monde, elles n'existaient simplement pas.

### La révolution neurale : Seq2Seq, Attention, Transformers (2014–2017)

La transformation suivante est venue avec l'apprentissage profond. En 2014, Ilya Sutskever, Oriol Vinyals et Quoc Le ont démontré des modèles *sequence-to-sequence* (seq2seq) pour la TA : des réseaux de neurones qui pouvaient lire une phrase entière dans une langue et générer une traduction dans une autre, sans aucun alignement explicite ou table de phrases.

En 2015, Dzmitry Bahdanau, Kyunghyun Cho et Yoshua Bengio ont introduit le *mécanisme d'attention*—permettant au décodeur de « regarder en arrière » différentes parties de la phrase source tout en générant chaque mot de la traduction. Cela a considérablement amélioré les performances sur les phrases longues.

Et en 2017, Vaswani et al. chez Google ont publié « Attention Is All You Need », introduisant l'architecture *Transformer*. Le Transformer a abandonné la récurrence entièrement, traitant les séquences entières en parallèle en utilisant l'auto-attention. C'était plus rapide à entraîner, plus facile à mettre à l'échelle et produisait de meilleures traductions que tout ce qui était venu avant.

Les Transformers ont directement mené aux grands modèles de langage (LLM) des années 2020 : GPT, BERT, PaLM, LLaMA et leurs descendants. Ces modèles, entraînés sur de vastes quantités de texte provenant d'Internet, peuvent traduire entre des centaines de paires de langues avec une fluidité remarquable.

Mais « fluidité remarquable » n'est pas la même chose que « précision fiable ». Et pour les langues peu dotées en ressources du monde, la situation est bien pire qu'elle n'y paraît.

---

## V. L'autre histoire : Langage, pouvoir et génocide culturel

Les quatre sections précédentes racontent l'histoire des idées—des grammairiens, des mathématiciens et des ingénieurs construisant vers la traduction automatique. Mais il y a une autre histoire, se déroulant en parallèle, qui explique *pourquoi* les langues ayant le plus besoin de technologie de traduction sont précisément celles pour lesquelles elle n'existe pas. Ce n'est pas une histoire de rareté des données comme un fait neutre. C'est une histoire de destruction délibérée.

La raison pour laquelle le cri des Plaines n'a pas de support de traduction automatique n'est pas principalement parce que le cri est une langue difficile pour les ordinateurs (bien qu'il le soit). C'est parce que, pendant plus d'un siècle, les gouvernements du Canada et des États-Unis ont géré des programmes systématiques pour éradiquer les langues autochtones de la bouche des enfants. La « rareté des données » qui rend la TA peu dotée en ressources si difficile est, en grande partie, la *conséquence en aval du génocide culturel*. Tout compte honnête de la raison pour laquelle ces langues ont besoin de technologie doit se confronter à la raison pour laquelle elles ont été amenées au bord de l'extinction en premier lieu.

### Avant le contact : Un continent de langues

La diversité linguistique des Amériques précédant le contact était vertigineuse. Au moment du contact européen, l'Amérique du Nord seule était le foyer d'un nombre estimé entre 300 et 600 langues distinctes, organisées en des dizaines de familles linguistiques sans rapport—plus de diversité génétique que dans toute l'Europe. L'Amérique du Sud en avait peut-être 1 500 ou plus (Campbell, 1997). L'Australie en avait plus de 250. Les îles du Pacifique, l'Afrique subsaharienne et l'Asie du Sud-Est continentale étaient également diverses.

Ce n'étaient pas des langues « primitives » ou « simples ». Beaucoup des langues les plus structurellement complexes jamais documentées sont autochtones. La morphologie polysynthétique des langues algonquiennes (y compris le cri, l'ojibwé et le blackfoot), les systèmes tonals du navajo, le marquage élaboré de l'évidentialité du quechua, les consonnes cliquées des langues khoisan—celles-ci représentent la gamme complète de ce que le langage humain peut être. Elles encodent des systèmes sophistiqués de connaissance sur la parenté, l'écologie, le droit, la spiritualité et l'histoire. Chaque langue est une bibliothèque—un enregistrement irremplaçable de la façon dont une communauté comprend et organise le monde.

Edward Sapir l'a reconnu clairement. Écrivant en 1921, il a observé que « quand il s'agit de forme linguistique, Platon marche avec le porcher macédonien, Confucius avec le sauvage chasseur de têtes d'Assam. » Les langues des peuples autochtones n'étaient pas inférieures. Elles étaient différentes—et leurs différences contenaient une connaissance qu'aucune autre langue ne possédait.

### La mécanique de la mort des langues

Les langues ne meurent pas de causes naturelles. Elles meurent quand les conditions de leur transmission sont perturbées—quand les enfants cessent de les apprendre, quand les locuteurs sont punis pour les utiliser, quand les incitations sociales et économiques changent de sorte que parler la langue dominante devient une condition de survie.

Cette perturbation peut se produire graduellement, par la pression économique et démographique. Mais dans le monde colonial, elle était écrasamment *délibérée*. La suppression des langues autochtones n'était pas un effet secondaire de la colonisation. C'était un objectif politique déclaré.

### Canada : Le système des pensionnats indiens (1831–1996)

Au Canada, le système des pensionnats indiens a fonctionné pendant plus de 160 ans, avec l'objectif explicite d'éliminer les langues et cultures autochtones. Un nombre estimé à 150 000 enfants des Premières Nations, métis et inuits ont été retirés de leurs familles et communautés et placés dans des pensionnats financés par le gouvernement et exploités par l'église.

La politique centrale a été articulée avec une clarté glaçante par Duncan Campbell Scott, le sous-ministre des Affaires indiennes, en 1920 : « Je veux me débarrasser du problème indien... Notre objectif est de continuer jusqu'à ce qu'il n'y ait pas un seul Indien au Canada qui n'ait pas été absorbé dans le corps politique et qu'il n'y ait pas de question indienne et pas de ministère des Affaires indiennes. »

Le mécanisme était le langage. Les enfants ont été interdits de parler leurs langues maternelles. Les punitions pour avoir parlé une langue autochtone allaient des coups à l'isolement à avoir des aiguilles poussées à travers leurs langues. Les enfants arrivaient parlant le cri, l'ojibwé, l'inuktitut, le dene, le haida ou l'une des dizaines d'autres langues. Ils ont été punis jusqu'à ce qu'ils arrêtent.

La Commission de vérité et réconciliation du Canada (2015) a documenté la nature systématique de cet assaut. Son rapport final a conclu que le système des pensionnats constituait un *génocide culturel*—la destruction des structures et des pratiques qui permettent à un groupe de continuer en tant que groupe. Le langage était la cible principale. Sans langage, la cérémonie est perturbée, l'histoire orale est brisée, les systèmes de parenté deviennent inintelligibles, et la transmission intergénérationnelle des connaissances cesse.

Le dernier pensionnat exploité par le gouvernement fédéral au Canada a fermé en 1996. Beaucoup des Aînés qui sont les derniers locuteurs couramment de leurs langues aujourd'hui sont des survivants des pensionnats. Leur fluidité n'est pas simplement une ressource linguistique. C'est un acte de résistance.

### États-Unis : Pensionnats indiens (années 1860–1960)

Les États-Unis ont exploité un système parallèle. Le capitaine Richard Henry Pratt, fondateur de la Carlisle Indian Industrial School en 1879, a inventé la phrase qui a défini l'époque : « Tuez l'Indien, sauvez l'homme. » Plus de 350 pensionnats financés par le gouvernement ont fonctionné aux États-Unis, avec des politiques presque identiques à celles du Canada. Les enfants autochtones ont été interdits de parler leurs langues, forcés d'adopter des noms anglais et soumis à un effacement culturel systématique.

Un rapport de 2022 du Département de l'intérieur américain a identifié plus de 400 pensionnats indiens fédéraux dans 37 États, documentant les décès d'au moins 500 enfants dans le système—un nombre que le rapport a reconnu était presque certainement un sous-compte significatif. L'enquête a constaté que le système était conçu non seulement pour éduquer mais pour « assimiler culturellement les enfants indiens en les relocalisant de force de leurs familles et communautés ».

Les conséquences linguistiques ont été catastrophiques. Des environ 300 langues autochtones parlées sur le territoire qui est devenu les États-Unis, plus de la moitié sont maintenant éteintes. De celles qui survivent, la plupart ont moins de 1 000 locuteurs couramment, et beaucoup en ont moins de 10. Le Endangered Languages Project classe la majorité des langues autochtones survivantes comme « gravement » ou « critiquement » en danger.

### Australie : Les générations volées (1910–1970)

En Australie, les politiques gouvernementales entre 1910 et 1970 ont retiré de force les enfants autochtones et des îles du détroit de Torres de leurs familles. Ces enfants—connus sous le nom de Générations volées—ont été placés dans des missions, des réserves et des familles d'accueil blanches. L'objectif explicite était l'assimilation : éliminer l'identité autochtone en quelques générations.

Les langues autochtones ont été supprimées dans les missions et les institutions gouvernementales. Les enfants qui parlaient leurs langues ont été punis. Le rapport Bringing Them Home (1997), produit par la Commission australienne des droits de l'homme, a documenté la nature systématique de ces retraits et leurs effets dévastateurs sur le langage, la culture et la famille.

Des environ 250 langues autochtones australiennes parlées au moment du contact européen, moins de 20 sont transmises aux enfants aujourd'hui (Marmion et al., 2014). Plus de 100 sont complètement éteintes. Les langues restantes survivent largement grâce aux efforts des locuteurs âgés travaillant avec des linguistes et des organisations communautaires dans une course contre le temps.

### Scandinavie : Les langues sámi

La suppression des langues autochtones n'était pas limitée aux États coloniaux de peuplement dans l'hémisphère sud. En Norvège, en Suède et en Finlande, les enfants sámi ont été soumis à des systèmes de pensionnats (*internatskoler*) du milieu du 19e siècle aux années 1960. Les langues sámi ont été interdites dans les écoles ; les enfants ont été punis pour les avoir parlées. La politique de « norvégianisation » (*fornorskingspolitikk*) de la Norvège visait explicitement à éliminer la langue sámi et à la remplacer par le norvégien.

Des neuf langues sámi survivantes, plusieurs ont moins de 500 locuteurs. Le sámi ume en a environ 20. Le sámi pite en a moins de 30. Les langues survivent en partie grâce à des programmes de revitalisation qui ont commencé dans les années 1970, y compris l'établissement d'écoles de langue sámi et de médias—des programmes qui sont arrivés juste à temps pour certains dialectes et trop tard pour d'autres.

### Aotearoa Nouvelle-Zélande : Te Reo Māori

La langue māori (te reo māori) était la langue majoritaire d'Aotearoa jusqu'au milieu du 20e siècle. Les politiques d'éducation coloniales britanniques, commençant dans les années 1860, ont progressivement marginalisé te reo dans les écoles. Dans les années 1970, moins de 20 % des Māori étaient des locuteurs couramment, et la langue risquait l'extinction en une génération.

La réponse māori a été l'un des premiers et des plus réussis mouvements de revitalisation des langues au monde. Les kōhanga reo (nids de langue) pour les enfants d'âge préscolaire, établis en 1982, ont immergé les nourrissons et les tout-petits dans te reo dès la naissance. Les kura kaupapa māori (écoles de langue māori) ont suivi. Ces programmes, aux côtés de la Māori Language Act de 1987 (qui a fait de te reo une langue officielle), ont stabilisé la langue—bien que les locuteurs couramment constituent toujours une minorité de la population māori.

La Nouvelle-Zélande a également produit l'un des cadres les plus importants pour la gouvernance des données autochtones : *Te Mana Raraunga*, le Réseau de souveraineté des données māori. Ce cadre affirme que les données māori—y compris les données linguistiques—sont un taonga (trésor) soumis aux droits et responsabilités de kaitiakitanga (gardiennage). Il a directement informé le développement des principes CARE pour la gouvernance des données autochtones et est une référence fondatrice pour les mécanismes de souveraineté des données dans champollion.

### Le motif : Le langage comme cible du pouvoir colonial

Les spécificités géographiques et culturelles diffèrent, mais le motif est remarquablement cohérent. Au Canada, aux États-Unis, en Australie, en Scandinavie et en Nouvelle-Zélande—et dans de nombreux autres endroits, de Taïwan à la Sibérie aux hauts plateaux andins—les États coloniaux et post-coloniaux ont identifié les langues autochtones comme des obstacles à l'assimilation et les ont ciblées pour l'élimination. Les outils étaient similaires partout : retirer les enfants de leurs familles, interdire l'utilisation des langues autochtones, punir les transgressions et récompenser l'adoption de la langue coloniale.

Ce n'était pas une note de bas de page historique. Le dernier pensionnat au Canada a fermé en *1996*. Le dernier pensionnat indien aux États-Unis a fermé dans les *années 1960*. Beaucoup de personnes qui ont survécu à ces systèmes sont toujours vivantes. Le traumatisme est intergénérationnel. Et les dommages linguistiques sont en cours : les langues qui ont perdu une génération de locuteurs à l'époque des pensionnats perdent maintenant leurs derniers Aînés couramment.

### Du génocide culturel à la « rareté des données »

Cette histoire est directement pertinente pour le problème technique de la traduction automatique. Quand les informaticiens décrivent une langue comme « peu dotée en ressources », ils signifient généralement : il y a peu de textes numériques, peu de corpus parallèles, peu de dictionnaires et peu d'ensembles de données annotées. L'encadrement est neutre, comme si la rareté des données était un acte de la nature, comme un désert avec peu de pluie.

Ce n'est pas le cas. La « rareté des données » des langues autochtones est la *conséquence en aval* des politiques de suppression linguistique. Les langues qui ont été interdites dans les écoles ont produit moins de textes écrits. Les langues dont les locuteurs ont été punis pour les avoir parlées ont développé moins d'usages institutionnels. Les langues qui ont perdu une génération de transmission ont produit moins de locuteurs bilingues qui pourraient créer des corpus parallèles.

Le pipeline du génocide culturel à la rareté des données est direct :

1. **Suppression** → Les enfants sont punis pour avoir parlé la langue
2. **Transmission perturbée** → Moins d'enfants apprennent la langue
3. **Base de locuteurs réduite** → Moins d'adultes l'utilisent dans la vie quotidienne
4. **Utilisation institutionnelle réduite** → Moins de documents écrits, moins de textes numériques
5. **Rareté des données** → Les modèles d'apprentissage automatique n'ont rien sur quoi s'entraîner
6. **Pas de support de TA** → La langue est invisible pour la technologie
7. **Déclin accéléré** → La technologie renforce la marginalisation que la politique a commencée

Ce pipeline signifie que tout projet technologique travaillant avec des langues autochtones hérite d'un contexte politique et moral, qu'il le reconnaisse ou non. Un système de traduction automatique qui traite les données linguistiques du cri comme de la matière première à ingérer par les modèles continue, cependant involontairement, la dynamique extractive qui a commencé avec les pensionnats. Les données ont été rendues rares par la violence. Les locuteurs qui ont créé les données qui existent l'ont fait contre des obstacles énormes. Tout système qui utilise ces données sans le contrôle significatif de la communauté aggrave le tort original.

### La complicité des sciences et de l'idéologie occidentale

Il est critique de reconnaître que la science et la technologie n'étaient pas des spectateurs innocents de ce projet colonial ; elles en étaient des participants actifs. L'idéologie des « Lumières » qui cherchait à catégoriser, quantifier et standardiser le monde traitait souvent les peuples autochtones et leurs langues simplement comme des sujets de recherche ou des curiosités pour une « anthropologie de sauvetage ». Cette pratique extractive a enfermé la connaissance dans les universités occidentales tout en faisant peu pour arrêter la machinerie politique détruisant ces communautés.

Ce projet contraste fortement avec des méthodologies comme l'étude de la syphilis de Tuskegee ou l'anthropologie linguistique extractive, qui traitent les personnes BIPOC comme des sujets expérimentaux ou des fournisseurs passifs de données brutes. Nous ne sommes pas ici pour expérimenter sur les peuples autochtones, extraire leurs connaissances ou leur imposer une idéologie culturelle monolithique occidentale. Notre objectif est de faciliter leurs *propres* façons de connaître et leurs *propres* normes de valeur. Nous fournissons l'infrastructure ; les communautés linguistiques construisent les ensembles de test, définissent les métriques et maintiennent l'adhésion. Sans leur adhésion, rien de cela ne fonctionne.

### Pourquoi cette histoire façonne notre conception

C'est pourquoi le modèle de gouvernance de champollion n'est pas une fonctionnalité—c'est la fondation. Chaque décision de conception majeure du projet est une *réponse directe* à l'histoire décrite ci-dessus. L'objectif est la souveraineté des données : soutenir les communautés dans la durabilité, la revitalisation et la gouvernance de leurs langues vivantes entièrement selon leurs propres termes.

**Pourquoi les données de test sont chiffrées et détenues par des fiducies communautaires.** Parce que les données linguistiques autochtones ont été extraites, publiées et exploitées sans consentement pendant plus d'un siècle. La linguistique missionnaire, comme les efforts de l'Institut d'été de linguistique (SIL), a historiquement monopolisé les corpus parallèles autochtones selon un cadre extractif et assimilationniste. De plus, contrairement à de nombreux projets modernes de TAL qui s'appuient fortement sur les Bibles traduites comme corpus principal pour les langues peu dotées en ressources, nous n'utilisons explicitement pas les Bibles traduites comme corpus. L'ensemble de test chiffré, avec les clés détenues uniquement par l'organisation de gouvernance de la communauté, est un mécanisme technique qui rend *architecturalement impossible* de répéter les motifs extractifs.

**Pourquoi nous utilisons l'exécution en bac à sable au lieu d'ensembles de test ouverts.** Parce qu'une fois que les données linguistiques sont publiées ouvertement, la communauté perd le contrôle sur elles de manière permanente. Les repères d'apprentissage automatique conventionnels publient leurs ensembles de test—n'importe qui peut les télécharger, s'entraîner dessus ou les utiliser à n'importe quelle fin. Ce raclage de données d'IA moderne représente une nouvelle forme de « colonialisme des données » et d'« enclosure numérique ». Pour les communautés dont les langues ont été presque éradiquées par la force, perdre le contrôle sur leurs ressources linguistiques restantes n'est pas un inconvénient mineur. C'est une continuation directe de la dépossession territoriale historique. L'exécution en bac à sable garantit que les données de la communauté ne quittent jamais son infrastructure.

**Pourquoi la propriété de la méthode est transférée à la communauté.** Parce que l'histoire d'« aider » les communautés autochtones est, écrasamment, une histoire d'étrangers construisant des choses *sur* les peuples autochtones plutôt que *pour* ou *avec* eux. Les articles académiques sont publiés, les subventions sont collectées, les carrières sont avancées—et la communauté ne reste avec rien. Le mécanisme de transfert de propriété garantit que quand un ingénieur en apprentissage automatique construit une méthode de traduction fonctionnelle pour le cri des Plaines, la communauté du cri des Plaines *possède cette méthode*. L'ingénieur garde le crédit et l'attribution. La communauté garde l'actif.

**Pourquoi tout ce qu'une méthode détenue par la communauté gagne appartient entièrement à la communauté.** Parce que la revitalisation des langues est coûteuse, et les communautés faisant le travail le plus difficile—les Aînés enseignant, les parents envoyant les enfants aux écoles d'immersion, les activistes gérant les nids de langue—sont chroniquement sous-financées. De plus, l'infrastructure d'IA même que nous utilisons (par exemple, les centres de données, l'exploitation minière, l'utilisation de l'eau) exerce un coût matériel disproportionné sur les terres autochtones mondialement. Champollion est un projet non commercial et ne revendique rien sur aucun d'eux : si une méthode de traduction du cri génère jamais de la valeur, cette valeur devrait financer les programmes de langue du cri. La technologie devrait être un outil qui sert les communautés, pas un mécanisme qui extrait de la valeur d'elles.

**Pourquoi nous disons « aspirant à la souveraineté » plutôt que de revendiquer la conformité.** Les cadres autochtones de souveraineté des données ont été développés par des peuples spécifiques pour des contextes spécifiques — les principes de souveraineté des données des Premières Nations au Canada, CARE (Bénéfice collectif, Autorité de contrôle, Responsabilité, Éthique), Te Mana Raraunga (Souveraineté des données maories) et les principes FAIR abordent chacun ces préoccupations à partir de positions culturelles et juridiques différentes. Nous ne prétendons mettre en œuvre aucun d'entre eux dans son intégralité ; cette détermination appartient aux communautés qui en sont les auteures. Nous disons que notre conception est *aspirante à la souveraineté* : elle est construite de manière à ce que les communautés *puissent* exercer la propriété, le contrôle, l'accès et la possession de leurs données et des technologies qui en dérivent. L'architecture tend vers la souveraineté ; il appartient aux communautés de décider si elle l'atteint. Nous considérons cela comme un travail inachevé, accueillons favorablement les objections et y donnerons suite.

**Pourquoi la plateforme évalue les *méthodes*, pas les *modèles*.** Parce que les communautés linguistiques autochtones ne devraient pas dépendre du modèle d'une seule corporation. L'architecture ouverte d'une « méthode » signifie que la solution n'a même pas besoin d'être un LLM coûteux et lourd en matériaux. Elle pourrait être un système hautement efficace basé sur les règles, hébergé par la communauté, fonctionnant sur du matériel informatique traditionnel. Si la meilleure méthode de traduction pour le cri utilise Gemini de Google aujourd'hui, la communauté devrait pouvoir passer à une alternative open-source ou déterministe demain sans tout reconstruire. L'évaluation au niveau de la méthode garantit que l'actif de la communauté est une *recette*, pas une dépendance.

**Pourquoi la communauté doit construire cette infrastructure maintenant.** Le paradoxe de tirer parti de l'IA tout en critiquant son extraction matérielle est résolu par une réalité stratégique brutale : si ce problème n'est pas résolu par la communauté selon ses propres termes souverains, il sera inévitablement « résolu » par d'autres selon des termes extractifs. Même si une grande corporation finit par construire un modèle de traduction pour une langue autochtone donnée, la communauté nécessite sa propre infrastructure de benchmarking indépendante et en bac à sable pour vérifier *quand* et *si* elle a réellement réussi selon les normes communautaires—et pour garantir que la communauté capture la valeur de ce succès.

Ce n'est pas de la politique boulonnée à la technologie. C'est de la technologie conçue par des personnes qui comprennent l'histoire.

---

## VI. Le moment actuel : 6 800 langues laissées de côté

### L'ampleur du problème

Sur les quelque 7 000 langues vivantes parlées sur Terre aujourd'hui, seules environ 550 disposent d'une traduction automatique sous une forme ou une autre — et à peine 200 sont prises en charge par un service commercial déployé ([comment nous comptons](/docs/network/context/coverage-counting)). Les autres sont invisibles pour la technologie — non pas parce qu'elles sont moins dignes d'intérêt, mais parce que les approches statistiques et neuronales qui dominent la traduction automatique moderne sont fondamentalement *avides de données*. Elles nécessitent des millions de phrases parallèles pour apprendre. Pour la plupart des langues du monde, ces phrases n'existent pas.

Les langues les plus affectées sont précisément celles les plus en danger : les langues autochtones, les langues minoritaires, les traditions orales avec des enregistrements écrits limités. Ce sont les langues dont les locuteurs sont souvent âgés, dont les communautés sont petites, dont le pouvoir politique est minimal. Ce sont les langues qui ont le plus besoin de support technologique pour la préservation et la revitalisation—et ce sont les langues pour lesquelles la technologie existante est la moins utile.

### Le défi polysynthétique

Le problème n'est pas simplement celui de la rareté des données. Beaucoup des langues les plus en danger du monde sont *polysynthétiques*—elles ont des systèmes morphologiques d'une complexité extraordinaire qui brisent fondamentalement les hypothèses de la TAL standard.

Considérez le cri des Plaines (nêhiyawêwin), une langue algonquienne parlée dans les prairies canadiennes. Un seul verbe en cri peut encoder des informations que l'anglais étendrait sur une clause entière : le sujet, l'objet, le temps, l'aspect, l'évidentialité, la modalité et diverses autres catégories grammaticales, tous compactés en un seul mot par un système de préfixes, de suffixes et de modifications internes.

Cela crée plusieurs problèmes pour les approches de TA standard :

1. **Échec de la tokenisation.** Les tokeniseurs de sous-mots comme BPE (Byte Pair Encoding), conçus pour les langues analytiques comme l'anglais, fragmentent les mots polysynthétiques en fragments dénués de sens. La structure morphologique est détruite avant que le modèle ne la voie jamais. BPE n'est pas neutre ; il représente une épistémologie purement empiriste et superficielle qui s'oppose fondamentalement aux hiérarchies morphologiques profondes et basées sur les règles inhérentes aux langues polysynthétiques. C'est un biais architectural qui démantèle activement la morphologie structurale.

2. **Explosion combinatoire.** Une langue polysynthétique peut avoir des millions de formes de mots possibles pour une seule racine verbale. Aucun corpus d'entraînement, aussi grand soit-il, ne peut en contenir plus qu'une infime fraction. Les modèles de neurones n'ont aucun moyen de *généraliser* aux formes non vues.

3. **Hallucination.** Les grands modèles de langage, quand on leur demande de traduire dans des langues polysynthétiques, génèrent souvent des formes morphologiquement invalides—des mots qu'aucun locuteur natif ne produirait jamais. Le modèle a appris des motifs statistiques à partir de données limitées mais n'a aucune compréhension des règles morphologiques de la langue.

### Transducteurs à états finis : Le pont

Il existe, cependant, une technologie qui *gère bien* la complexité morphologique : le **Transducteur à états finis** (FST). Un FST est un appareil computationnel formel qui mappe entre une chaîne d'entrée et une chaîne de sortie par une série de transitions d'état. Pour l'analyse morphologique, un FST peut mapper une forme de mot de surface à sa structure morphologique sous-jacente (et vice versa), gérant la complexité combinatoire complète de la morphologie de la langue.

Les FST sont les descendants directs des règles de réécriture de Pāṇini. Ce sont les grammaires de type 3 (régulières) de Chomsky sous forme computationnelle. Elles sont l'incarnation vivante de la connexion entre la linguistique formelle et le calcul.

En associant les FST aux LLM, `champollion` exécute une synthèse philosophique cruciale : elle réconcilie la tradition structurale *rationaliste* (règles) avec le paradigme statistique *empiriste* (probabilité) pour contrecarrer les biais affamés de données et majoritaires de l'IA moderne.

Pour les langues polysynthétiques, les FST peuvent fournir quelque chose que les modèles de neurones ne peuvent pas : *vérification déterministe*. Étant donné une forme de mot, un FST peut dire définitivement si c'est une forme valide dans la langue—non pas probabilistiquement, non pas « cela semble correct », mais *oui* ou *non*. C'est la réponse à la requête centrale qui hante la TA neurale pour les langues peu dotées en ressources : *Comment vérifiez-vous qu'un mot généré est réel sans un humain dans la boucle ?*

La réponse technique est : vous utilisez la grammaire formelle. Vous utilisez les très outils que Pāṇini a inventés il y a vingt-cinq siècles, codés dans le formalisme computationnel que Turing et Chomsky ont rendu rigoureux.

Cependant, nous devons reconnaître que ce pouvoir déterministe porte ses propres risques. Imposer une validation « oui » ou « non » sur une langue orale et fluide risque d'imposer une rigidité Standard Language Ideology. Quand un FST dicte ce qui est « correct », il peut inadvertamment récapituler la très normatitivité coloniale qu'il était conçu pour éviter—aplatissant la variation dialectale, punissant le code-switching et imposant une grammaire singulière et normalisée sur une communauté diverse. Parce que les FST représentent juste une métrique d'exactitude formelle, leur empirisme rigide doit être tempéré. C'est précisément pourquoi la communauté doit tenir le stylo. La communauté définit la norme, construit les règles et définit ce que la machine accepte comme valide, construisant des FST qui créent de l'espace pour la fluidité orale et les dialectes régionaux. La grammaire formelle n'est pas une vérité universelle remise par les informaticiens ; c'est une infrastructure exploitée par les locuteurs eux-mêmes.

### champollion : Où les fils convergent

C'est ici que le projet champollion entre dans l'histoire. Il se situe au point exact de convergence de tous les fils que nous avons retracés :

- **De Pāṇini** : Le principe que le langage peut être décrit par des règles formelles et génératives.
- **De Schleicher et Sapir** : La compréhension que les langues du monde sont diverses, structurées et souvent en danger.
- **Des pensionnats et leurs conséquences** : La compréhension que la « rareté des données » n'est pas un fait technique neutre mais la conséquence de la suppression linguistique délibérée—et que toute technologie touchant ces langues doit être construite avec la souveraineté à la fondation.
- **De Chomsky** : La hiérarchie formelle des grammaires qui connecte la linguistique au calcul.
- **De Shannon** : Le cadre mathématique pour comprendre la communication, le bruit et le signal.
- **De Turing et von Neumann** : Les machines universelles qui peuvent exécuter n'importe quelle fonction calculable.
- **De Weaver et les modèles IBM** : L'intuition que la traduction peut être traitée comme un problème statistique.
- **De la révolution Transformer** : Les puissants modèles de neurones qui peuvent traduire—mais seulement quand ils ont suffisamment de données.
- **De la tradition FST** : Les outils formels qui peuvent gérer la complexité morphologique où les modèles de neurones échouent.
- **Des cadres autochtones de souveraineté des données — CARE, Te Mana Raraunga et leurs pairs** : Les cadres de gouvernance qui garantissent que la technologie sert les communautés plutôt que d'en extraire.

champollion est une plateforme conçue pour diriger l'énergie compétitive de la communauté d'apprentissage automatique vers les langues que le marché a abandonnées. Elle fournit une infrastructure de benchmarking où n'importe qui peut soumettre une méthode de traduction—neurale, basée sur les règles, hybride ou nouvelle—et l'avoir évaluée selon des normes rigoureuses. De manière cruciale, elle utilise la validation basée sur FST pour garantir que les formes générées sont morphologiquement valides, et elle s'appuie sur la vérification par des locuteurs natifs comme la vérité fondamentale ultime.

La plateforme incarne plusieurs principes que cette histoire rend clairs :

**Aucune approche unique n'est suffisante.** L'histoire de la TA est une histoire de changements de paradigme—des règles aux statistiques aux réseaux de neurones. Chaque nouveau paradigme a résolu les problèmes que le précédent ne pouvait pas, mais chacun avait aussi des angles morts. Pour les langues polysynthétiques peu dotées en ressources, la réponse est presque certainement *hybride* : la fluidité neurale contrainte par l'exactitude formelle.

**La souveraineté des données n'est pas facultative — c'est une réponse structurelle aux préjudices historiques.** Comme la section V le documente en détail, les langues autochtones ne sont pas simplement « pauvres en données » par accident. Elles ont été rendues rares par des politiques délibérées. La conception aspirante à la souveraineté du projet — garantissant que les données linguistiques restent sous le contrôle des communautés autochtones, que les clés de déchiffrement sont détenues par des fiducies communautaires et que la propriété des algorithmes est transférée aux locuteurs — n'est pas une réflexion après coup. C'est une réponse directe à des siècles de pratiques extractives, allant de la documentation réalisée par des étrangers à l'époque des pensionnats autochtones jusqu'au moissonnage de jeux de données moderne.

Une version antérieure de ce paragraphe affirmait que l'architecture rendait la répétition de ces schémas *techniquement impossible*. C'était une affirmation exagérée et elle a été retirée. Les mécanismes sont réels et spécifiques — un corpus est chiffré sur le propre appareil du détenteur avant que quoi que ce soit n'en sorte, le déchiffrement nécessite l'action conjointe de plusieurs gardiens plutôt que d'une seule partie, et le contenu du corpus est récupéré depuis sa source plutôt qu'hébergé ici — mais « impossible » n'est pas une propriété que l'un d'entre eux puisse revêtir. Les logiciels ont des bugs, les opérateurs font des erreurs, et une partie déterminée disposant de suffisamment de rôles adéquats constitue un risque résiduel qu'aucune conception ne peut éliminer. L'affirmation honnête est que les voies faciles sont fermées et que les voies difficiles laissent des traces. Ce que ce projet peut promettre, ce sont des mécanismes et de la transparence, pas l'impossibilité.

**Le jeu long est la revitalisation.** La traduction est le *terrain d'essai*, mais le vrai prix est la revitalisation des langues par l'enseignement. Les grammaires formelles et les modèles morphologiques construits pour la traduction automatique sont précisément les fondations techniques nécessaires pour l'apprentissage des langues assisté par machine. Si nous pouvons construire un FST qui valide les formes verbales du cri pour un système de traduction, nous pouvons aussi utiliser ce FST pour aider un étudiant à apprendre à conjuguer les verbes du cri.

### Pourquoi ce moment

Nous vivons un moment unique dans l'histoire de la technologie des langues. Plusieurs facteurs ont convergé :

1. **Les outils open-source sont matures.** Les boîtes à outils FST (comme HFST et Foma), les cadres de TA neurale (comme OpenNMT et Fairseq) et l'infrastructure d'évaluation peuvent maintenant être assemblés par une petite équipe à un coût minimal.

2. **L'organisation communautaire s'accélère.** Les communautés linguistiques autochtones sont de plus en plus sophistiquées dans leur utilisation de la technologie et leur affirmation de la souveraineté des données. Des organisations comme l'initiative First Voices, le Projet technologique des langues autochtones canadiennes et de nombreux efforts menés par la communauté construisent l'infrastructure humaine que la technologie seule ne peut pas fournir.

3. **Les capacités d'IA ont atteint un seuil.** Les grands modèles de langage, bien qu'insuffisants en eux-mêmes pour la TA peu dotée en ressources, peuvent servir de composants puissants dans les systèmes hybrides—générant des traductions candidates qui sont ensuite vérifiées et contraintes par des méthodes formelles.

4. **Le coût s'est effondré.** Ce qui aurait nécessité un laboratoire gouvernemental en 1954 ou une grande corporation en 2000 peut maintenant être fait avec des crédits de calcul en nuage et des logiciels open-source. Le goulot d'étranglement n'est plus la technologie ou l'argent. C'est la *volonté*.

La question n'est pas si la technologie peut être construite. Elle peut. La question est si elle sera construite *correctement*—avec la bonne gouvernance, les bonnes incitations et le bon respect pour les communautés qu'elle est censée servir.

C'est la question à laquelle ce projet existe pour répondre.

---

## Références

- Bahdanau, D., Cho, K., & Bengio, Y. (2015). Neural Machine Translation by Jointly Learning to Align and Translate. *ICLR*.
- Boole, G. (1854). *An Investigation of the Laws of Thought*. Walton and Maberly.
- Bringing Them Home: Report of the National Inquiry into the Separation of Aboriginal and Torres Strait Islander Children from Their Families. (1997). Australian Human Rights Commission.
- Brown, P., Della Pietra, S., Della Pietra, V., & Mercer, R. (1993). The Mathematics of Statistical Machine Translation. *Computational Linguistics*, 19(2).
- Campbell, L. (1997). *American Indian Languages: The Historical Linguistics of Native America*. Oxford University Press.
- Champollion, J.-F. (1822). *Lettre à M. Dacier relative à l'alphabet des hiéroglyphes phonétiques*.
- Chomsky, N. (1957). *Syntactic Structures*. Mouton.
- Chomsky, N. (1956). Three Models for the Description of Language. *IRE Transactions on Information Theory*, 2(3).
- Huet, G. (2006). Lexicon-directed Segmentation and Tagging of Sanskrit. In *Proceedings of the XIIth World Sanskrit Conference*.
- Jones, W. (1786). The Third Anniversary Discourse. *Asiatick Researches*, 1.
- Kiparsky, P. (1993). Paninian Linguistics. In R. E. Asher (Ed.), *The Encyclopedia of Language and Linguistics*. Pergamon.
- Kircher, A. (1663). *Polygraphia Nova et Universalis*.
- Leibniz, G. W. (1703). Explication de l'Arithmétique Binaire. *Mémoires de l'Académie Royale des Sciences*.
- Llull, R. (c. 1305). *Ars Magna*.
- Lovelace, A. (1843). Notes by the Translator (Note G). In L. F. Menabrea, *Sketch of the Analytical Engine Invented by Charles Babbage*.
- Marmion, D., Obata, K., & Troy, J. (2014). *Community, Identity, Wellbeing: The Report of the Second National Indigenous Languages Survey*. Australian Institute of Aboriginal and Torres Strait Islander Studies.
- National Research Council. (1966). *Language and Machines: Computers in Translation and Linguistics* (ALPAC Report). National Academy of Sciences.
- Papineni, K., Roukos, S., Ward, T., & Zhu, W.-J. (2002). BLEU: A Method for Automatic Evaluation of Machine Translation. *ACL*.
- Saussure, F. de. (1916). *Cours de linguistique générale* (C. Bally & A. Sechehaye, Eds.). Payot.
- Schleicher, A. (1861). *Compendium der vergleichenden Grammatik der indogermanischen Sprachen*.
- Shannon, C. E. (1948). A Mathematical Theory of Communication. *Bell System Technical Journal*, 27(3).
- Shannon, C. E. (1951). Prediction and Entropy of Printed English. *Bell System Technical Journal*, 30(1).
- Sutskever, I., Vinyals, O., & Le, Q. V. (2014). Sequence to Sequence Learning with Neural Networks. *NeurIPS*.
- Truth and Reconciliation Commission of Canada. (2015). *Honouring the Truth, Reconciling for the Future: Summary of the Final Report*. Government of Canada.
- Turing, A. M. (1936). On Computable Numbers, with an Application to the Entscheidungsproblem. *Proceedings of the London Mathematical Society*, 2(42).
- Turing, A. M. (1950). Computing Machinery and Intelligence. *Mind*, 59(236).
- Vaswani, A., et al. (2017). Attention Is All You Need. *NeurIPS*.
- von Neumann, J. (1945). *First Draft of a Report on the EDVAC*. University of Pennsylvania.
- Weaver, W. (1949). Translation. Memorandum, Rockefeller Foundation.
- Wilkins, J. (1668). *An Essay towards a Real Character, and a Philosophical Language*. Royal Society.
- U.S. Department of the Interior. (2022). *Federal Indian Boarding School Initiative Investigative Report*. Bureau of Indian Affairs.

---

*Ce document fait partie de la documentation du projet champollion. Il est publié sous la même licence que le projet lui-même.*

---

## Où cela mène-t-il sur ce site

L'histoire se termine là où ce projet commence : la plupart des langues vivantes sont encore
en dehors de la technologie. [Ce qu'est Champollion](/docs/what-is-champollion)
expose le plan en cinq minutes, et
[comment la couverture est comptée](/docs/network/context/coverage-counting) montre
exactement où se situe la limite aujourd'hui.
