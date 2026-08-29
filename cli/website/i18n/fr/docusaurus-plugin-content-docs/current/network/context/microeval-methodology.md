---
sidebar_position: 4
title: "Microeval : Évaluation spécifique à la langue pour la traduction automatique"
slug: '/network/context/microeval-methodology'
---

# Microeval : Métriques d'évaluation spécifiques à la langue pour la traduction automatique

***Une méthodologie pour construire des métriques d'évaluation adaptées à des langues individuelles en utilisant des FST, des dictionnaires et des règles d'équivalence curées par des linguistes — et pourquoi le domaine en a besoin***

---

> *« Les limites de mon langage signifient les limites de mon monde. »*
> — Ludwig Wittgenstein, *Tractatus Logico-Philosophicus* (1921)

---

## Introduction

La communauté d'évaluation de la traduction automatique a passé deux décennies à rechercher des métriques universelles — des mesures de qualité de traduction qui fonctionnent dans toutes les langues, tous les domaines, toutes les typologies. Cette recherche a produit des outils remarquables : BLEU (Papineni et al., 2002), chrF++ (Popović, 2017), COMET (Rei et al., 2020), MetricX (Juraska et al., 2023). Pour les ~20 langues qui dominent les tâches partagées WMT, ces outils fonctionnent.

Pour les ~7 000 autres langues, ce n'est pas le cas.

Cet article soutient que **la recherche de métriques universelles, lorsqu'elle est appliquée aux langues peu dotées en ressources et morphologiquement complexes, n'est pas seulement incomplète — c'est le mauvais paradigme**. Nous proposons **microeval** : une méthodologie pour construire des métriques d'évaluation adaptées à des langues individuelles en utilisant les meilleurs outils linguistiques disponibles — les transducteurs à états finis, les dictionnaires bilingues, les analyseurs morphologiques et les règles d'équivalence curées par des linguistes.

Microeval n'est pas une métrique. C'est une *pratique* — un processus systématique de construction d'une infrastructure d'évaluation qui encode les connaissances spécifiques à la langue. La pratique produit des métriques, que nous regroupons sous le nom de cadre **LYSS** (Linguistically-informed Yield & Structural Scoring). Mais la contribution est la méthodologie, et non une métrique particulière qu'elle produit.

Ce document accompagne :
- [Measuring the Immeasurable](/docs/network/context/mt-evaluation-landscape) — l'enquête sur le paysage d'évaluation, qui positionne LYSS parmi les métriques existantes
- [The Scoring Specification](/docs/network/specifications/scoring) — la spécification technique pour les définitions de métriques, les poids et la notation composite
- [The Corpus Partnership Strategy](/docs/network/specifications/corpus-partnership) — le flux de travail pratique pour établir des corpus d'évaluation

Ces documents décrivent *ce que* LYSS est et *où* il s'inscrit. Celui-ci aborde les questions plus profondes : *Pourquoi* l'évaluation spécifique à la langue est-elle nécessaire ? *Comment* la construire pour une nouvelle langue ? Et *qui* décide ce qui compte comme « correct » ?

---

## Partie 1 : Pourquoi les métriques universelles échouent sur les langues peu dotées en ressources

### 1.1 L'hypothèse d'universalité

Chaque métrique majeure d'évaluation de TA depuis BLEU repose sur une hypothèse implicite : que les *mécanismes* de la qualité de traduction sont indépendants de la langue, même si les *paramètres* diffèrent. BLEU compte le chevauchement des n-grammes. chrF++ compte le chevauchement des n-grammes de caractères. COMET entraîne un modèle de régression sur les jugements humains. Tous supposent que la structure du signal — ce qui rend une traduction « bonne » — peut être capturée par un algorithme indépendant de la langue, éventuellement affiné sur des données spécifiques à la langue.

Pour les paires de langues européennes à ressources élevées, cette hypothèse tient suffisamment bien. Les tâches partagées de métriques WMT démontrent une corrélation humaine élevée pour English↔German, English↔Czech, English↔Chinese. Les métriques ne sont pas d'accord sur les cas limites, mais elles s'accordent sur la distribution de la qualité.

Pour les langues polysynthétiques comme le cri des Plaines (nêhiyawêwin), l'hypothèse s'effondre à plusieurs niveaux :

**Opacité morphologique.** Un seul verbe cri peut contenir autant d'informations qu'une clause anglaise entière. Le mot *nikî-wîcihâw* (« je l'ai aidé ») encode la personne, le nombre, l'animacité, la direction et le temps dans une seule forme fléchie. Une métrique n-gramme voit un jeton ; un analyseur morphologique voit six morphèmes. Les métriques de surface ne peuvent pas distinguer entre un verbe correctement fléchi et une hallucination plausible qui viole l'accord d'animacité — les deux sont des jetons uniques de longueur de caractère similaire.

**Ordre des mots libre.** Le cri a un ordre des mots pragmatiquement libre (Wolfart, 1973, §3.2). Les phrases *atim niwâpamâw* et *niwâpamâw atim* (« je vois le chien ») sont toutes deux grammaticalement correctes — le choix est pragmatique, non syntaxique. Toute métrique qui pénalise la divergence d'ordre des mots par rapport à une traduction de référence générera des faux négatifs sur chaque paire de ce type.

**Équivalence morphologique.** Le cri a plusieurs représentations orthographiques valides du même mot (variantes SRO, alternances progressives/longueur de voyelle). Les traductions *nikî-atoskân* et *nikî-atoskên* peuvent être dialectalement équivalentes. Une métrique de correspondance de chaîne voit deux chaînes différentes ; un linguiste voit le même mot.

**Absence de données d'entraînement.** Les métriques neurales comme COMET nécessitent des données d'entraînement — des jugements de qualité humains sur des paires de traductions — pour apprendre ce que « bon » signifie. Pour le cri, ces données n'existent pas. COMET peut toujours produire des scores (il revient à son encodeur multilingue), mais ces scores n'ont pas été validés par rapport aux jugements de qualité d'un locuteur cri. Ce sont des extrapolations à partir de modèles de langues européennes, appliquées à une langue avec une structure fondamentalement différente.

### 1.2 Le paradoxe de l'évaluation des ressources faibles

Cela crée un paradoxe :

> Les langues qui ont le plus besoin de traduction automatique sont précisément les langues où les meilleurs outils d'évaluation sont les moins fiables.

Si nous ne pouvons pas mesurer la qualité de traduction pour ces langues, nous ne pouvons pas :
- Comparer objectivement les méthodes de traduction
- Détecter quand un modèle hallucine des non-sens plausibles
- Suivre si le domaine fait des progrès
- Tenir les fournisseurs de systèmes de TA responsables des affirmations de qualité

Le résultat est une **défaillance en cascade** : pas de données d'entraînement → pas de couverture d'encodeur → pas d'évaluation validée → pas de progrès mesurable → pas d'incitation à investir → pas de données d'entraînement.

Briser ce cycle nécessite des méthodes d'évaluation qui ne dépendent pas des ressources que nous n'avons pas (données d'entraînement, jugements humains à grande échelle, encodeurs neuraux affinés). Cela nécessite des méthodes qui exploitent les ressources que nous *avons*.

### 1.3 Ce que nous avons

Pour de nombreuses langues peu dotées en ressources, des décennies de travail de terrain linguistique ont produit des outils et des ressources que la communauté d'évaluation de la TA a largement ignorés :

| Ressource | Ce qu'elle fournit | Couverture |
|----------|-----------------|----------|
| **Transducteurs à états finis (FST)** | Analyse morphologique complète — chaque forme de mot valide dans la langue | ~100+ langues via GiellaLT, Apertium, NRC |
| **Dictionnaires bilingues** | Correspondances lemme-glose | Des centaines de langues (Wolvengrey 2001 pour le cri : environ 18 000 à 22 000 entrées selon l'édition et la méthode de comptage) |
| **Analyseurs morphologiques** | Étiquetage morphosyntaxique, lemmatisation, génération de paradigmes flexionnels | Des dizaines de langues avec une couverture variable |
| **Grammaires descriptives** | Règles régissant l'accord, l'ordre des mots, l'animéité, l'obviation | Disponibles pour la plupart des langues documentées |
| **Expertise linguistique** | Membres de la communauté capables d'identifier les traductions correctes et incorrectes | Existe par définition pour toute langue vivante |

Ces ressources ont été construites par des linguistes informatiques, des linguistes de terrain et des communautés linguistiques au cours de décennies — souvent sans aucun lien avec la communauté d'évaluation de la TA. Le FST pour le cri des Plaines a été construit à l'Université de l'Alberta par Antti Arppe et ses collègues comme un outil de documentation linguistique, et non comme une métrique d'évaluation. L'infrastructure GiellaLT à UiT a été construite pour la technologie des langues minoritaires, et non pour les tâches partagées WMT.

**Microeval est la pratique de transformer ces ressources existantes en métriques d'évaluation.**

---

## Partie 2 : La méthodologie microeval

### 2.1 Définition

**Microeval** est une méthodologie systématique pour construire des métriques d'évaluation de traduction automatique adaptées à une langue spécifique, en utilisant des outils et des ressources linguistiques spécifiques à la langue. Une suite microeval :

1. **Encode les connaissances spécifiques à la langue** qui ne peuvent pas être capturées par des métriques indépendantes de la langue
2. **Utilise l'infrastructure linguistique existante** (FST, dictionnaires, grammaires) plutôt que de nécessiter de nouvelles données d'entraînement
3. **Produit des scores déterministes et interprétables** — chaque score peut être tracé jusqu'à un jugement linguistique spécifique
4. **Est conçue par des linguistes**, et non seulement par des ingénieurs — les classes de variantes, les règles d'équivalence et la logique de validation reflètent l'expertise linguistique
5. **Complète plutôt que remplace** les métriques universelles — microeval comble les lacunes, pas tout l'espace

### 2.2 L'architecture à trois niveaux

Une suite microeval complète fonctionne à trois niveaux d'analyse, de la surface à la sémantique :

| Niveau | Question répondue | Outil utilisé | Composant LYSS |
|-------|------------------|-----------|----------------|
| **Validité morphologique** | « Chaque mot est-il une forme valide dans cette langue ? » | Transducteur à états finis (FST) | LYSS-fst |
| **Équivalence linguistique** | « Cette traduction est-elle une variante acceptable de la référence ? » | Linter déterministe avec classes de variantes curées par des linguistes | LYSS-eq |
| **Fidélité sémantique** | « Cette traduction préserve-t-elle le sens de la source ? » | Lemmatisation FST + glosses de dictionnaire + chevauchement de mots de contenu | LYSS-sem |

Ces niveaux sont **cumulatifs, non alternatifs**. Une traduction doit passer tous les trois pour être considérée comme entièrement correcte. Un mot halluciné échoue au niveau 1. Une variante dialectale qui est correcte mais diffère de la référence est détectée au niveau 2. Une traduction qui utilise des mots valides dans un ordre valide mais signifie quelque chose de différent est détectée au niveau 3.

### 2.3 Comment construire une suite microeval pour une nouvelle langue

Cette section décrit le processus étape par étape. Nous utilisons le cri des Plaines (CRK) comme exemple travaillé et généralisons où possible.

#### Étape 1 : Évaluer les ressources disponibles

Avant de construire quoi que ce soit, inventoriez ce qui existe :

| Ressource | Requise pour | Comment la trouver | Qualité minimale |
|-----------|-------------|----------------|-----------------|
| FST | Niveau 1 (LYSS-fst) | Vérifiez les catalogues GiellaLT, Apertium, NRC | Doit accepter >90% des formes de mots valides dans un corpus de test |
| Dictionnaire bilingue | Niveau 3 (LYSS-sem) | Vérifiez les projets de documentation linguistique, Wiktionary, ressources communautaires | >5 000 entrées avec mappages lemme-à-glose |
| Grammaire descriptive | Niveau 2 (LYSS-eq) | Grammaires publiées, thèses, références rédigées par la communauté | Doit documenter les paradigmes morphologiques principaux |
| Locuteurs bilingues | Tous les niveaux (validation) | Contacts communautaires, programmes de langues universitaires | Minimum 3 locuteurs pour les expériences de validation |

**Si aucun FST n'existe :** Ignorez le niveau 1. La suite fonctionne sur les niveaux 2–3 uniquement, ou revient aux métriques universelles (Profil B dans la notation LYSS). Ce n'est pas idéal, mais c'est mieux que rien.

**Si aucun dictionnaire n'existe :** Ignorez le niveau 3 ou utilisez une version réduite avec le vocabulaire disponible. Un dictionnaire de 500 entrées est moins utile qu'un dictionnaire de 18 000 entrées, mais il fournit toujours un signal.

#### Étape 2 : Configurer la porte de validité morphologique (LYSS-fst)

Si un FST est disponible :

1. **Installez le FST** en utilisant le binaire analyseur de la langue (format HFST `.hfstol` pour GiellaLT)
2. **Exécutez un test de couverture** sur un corpus représentatif : quel pourcentage de jetons le FST reconnaît-il ?
3. **Construisez une liste blanche** pour les lacunes FST attendues : mots d'emprunt, noms propres, néologismes, abréviations
4. **Calculez le taux de faux rejet de base** — le pourcentage de mots valides que le FST rejette incorrectement
5. **Définissez le seuil de notation** — en dessous de quel taux d'acceptation FST signalons-nous une traduction comme morphologiquement suspecte ?

La métrique clé est `fst_acceptance_rate` : la fraction de mots de sortie que le FST reconnaît. Un taux de 0,85 signifie que 85% des mots sont une morphologie cri valide ; 15% sont soit invalides, soit des mots d'emprunt, soit des lacunes de couverture FST.

**Décision de conception critique :** Le problème du faux rejet. Un FST entraîné sur la langue littéraire formelle rejettera les formes colloques valides. Un FST avec couverture de paradigme incomplète rejettera les inflexions valides mais rares. La liste blanche atténue cela, mais ne peut pas l'éliminer. *C'est pourquoi LYSS-fst seul n'est pas suffisant* — il doit être combiné avec les niveaux 2 et 3.

#### Étape 3 : Concevoir les classes de variantes (LYSS-eq)

C'est l'étape la plus exigeante sur le plan linguistique, et elle ne peut pas être automatisée. Un linguiste ayant une expertise dans la langue cible doit identifier :

**Quels types de différences entre une traduction candidate et une traduction de référence doivent être considérés comme « acceptables » ?**

Pour le cri des Plaines, nous avons identifié six classes de variantes :

| Classe de variante | Base linguistique | Exemple |
|------------------|------------------|---------|
| `WORD_ORDER` | Ordre des mots pragmatiquement libre (Wolfart 1973 §3.2) | *atim niwâpamâw* ≡ *niwâpamâw atim* |
| `ORTHOGRAPHIC` | Variantes d'orthographe SRO, alternance de longueur de voyelle | *nikî-atoskân* ≡ *nikî-atoskên* |
| `OPTIONAL_PARTICLE` | Particules de discours grammaticalement optionnelles | *êkwa nikî-atoskân* ≡ *nikî-atoskân* |
| `LEMMA_SYNONYM` | Synonymes attestés dans le dictionnaire | *wâpamêw* ≡ *kanawâpamêw* (pour « voit ») |
| `PROGRESSIVE_AMBIGUITY` | Formes progressives multiples valides | *ê-atoskêt* ≡ *atoskêw* |
| `INCLUSIVE_EXCLUSIVE` | Distinction première personne plurielle non en anglais | *ki-wîcihânaw* ≡ *ni-wîcihânân* |

**Ces classes sont spécifiques à la langue.** Une autre langue aurait des classes différentes — le turc pourrait avoir des classes pour les variantes d'harmonie vocalique, le japonais pour l'alternance de registre honorifique, l'inuktitut pour la variation de suffixe dialectal.

**Le processus de conception :**
1. Collectez 100+ paires de traductions (source + référence + candidate)
2. Identifiez tous les cas où la candidate est différente de la référence mais un locuteur bilingue la considérerait comme correcte
3. Catégorisez les différences — recherchez des modèles qui se répètent sur plusieurs paires
4. Formalisez chaque modèle comme une règle déterministe (regex, opération d'ensemble ou transduction FST)
5. Validez avec 3+ locuteurs bilingues : pour chaque classe de variante, sont-ils d'accord que c'est acceptable ?
6. Itérez : certaines classes auront besoin de raffinement, d'autres devront être divisées ou fusionnées

#### Étape 4 : Construire le validateur sémantique (LYSS-sem)

Le validateur sémantique répond : « Cette traduction signifie-t-elle la même chose que la référence ? » Il fonctionne en quatre étapes :

1. **Lemmatisez les deux traductions** en utilisant le FST (extrayez les formes racines, supprimez l'inflexion)
2. **Mappez les lemmes aux glosses** en utilisant le dictionnaire bilingue (lemme cri → glose anglaise)
3. **Comparez les ensembles de glosses** — les glosses de la candidate chevauchent-elles avec les glosses de la référence ?
4. **Vérifiez les contraintes structurelles** — la candidate viole-t-elle les règles de grammaire connues (accord d'animacité, forme de verbe, marquage de personne) ?

Le validateur produit des verdicts : `EXACT_MATCH`, `VALID`, `GRAMMAR_ISSUES`, `PARTIAL`, `INCOMPLETE`, `WRONG`, `NO_OUTPUT`. Chaque verdict est déterministe et traçable — vous pouvez expliquer *pourquoi* une traduction a reçu un verdict donné en examinant quelle étape l'a signalée.

**Version minimale viable :** Si vous avez un FST et un dictionnaire, vous pouvez construire un validateur sémantique simplifié qui ne fait que le chevauchement lemme-glose (étapes 1–3). L'étape 4 (vérification de la grammaire) nécessite plus d'ingénierie linguistique mais ajoute une valeur significative pour les langues morphologiquement complexes.

#### Étape 5 : Intégrer avec le harnais d'évaluation

La suite microeval est empaquetée comme un ensemble de plugins de métrique qui se branchent sur le harnais d'évaluation :

1. Chaque métrique implémente le protocole `MetricPlugin` : `compute(entry) → dict`, `aggregate(results) → dict`
2. Le système de découverte de plugins détecte automatiquement les plugins spécifiques à la langue en fonction du code de langue cible
3. Les scores sont alimentés à la fonction de notation composite, qui combine les métriques microeval avec les métriques universelles en utilisant des profils de poids spécifiques à la langue

### 2.4 Microeval minimum viable

Pas chaque langue n'a besoin de tous les trois niveaux immédiatement. Voici la configuration minimale utile à chaque niveau :

| Configuration | Ce dont vous avez besoin | Ce que vous obtenez | Temps de construction |
|--------------|------------------------|-------------|---------------------|
| **LYSS-fst uniquement** | FST + liste blanche | Porte de validité morphologique — détecte les formes de mots hallucinées | 1–2 semaines |
| **LYSS-fst + LYSS-eq** | FST + 3–6 classes de variantes + temps de linguiste | Porte de validité + détection d'équivalence — réduit les faux négatifs | 4–8 semaines |
| **LYSS complet** | FST + classes de variantes + dictionnaire + validateur sémantique | Évaluation complète spécifique à la langue | 8–16 semaines |

La recommandation est de commencer par LYSS-fst (rapide, impact élevé, nécessite seulement un FST qui existe probablement déjà) et d'ajouter des niveaux de manière incrémentale.

---

## Partie 3 : Le problème du faux rejet

### 3.1 Ce que c'est

Chaque métrique microeval a un taux de faux rejet : la probabilité qu'une traduction correcte soit notée comme incorrecte.

Pour LYSS-fst, le faux rejet se produit quand :
- Le FST ne couvre pas une forme de mot valide (tables de paradigme incomplètes)
- La traduction contient un mot d'emprunt que le FST ne reconnaît pas
- La traduction utilise un néologisme ou un nom de marque
- La traduction utilise une forme dialectale non dans le lexique du FST
- La traduction contient un nom propre non dans la liste blanche

Pour LYSS-eq, le faux rejet se produit quand :
- La traduction utilise une variante acceptable non couverte par aucune classe de variante
- Une nouvelle classe de variante est nécessaire mais n'a pas encore été identifiée

Pour LYSS-sem, le faux rejet se produit quand :
- Un lemme n'est pas dans le dictionnaire
- Une traduction valide utilise une stratégie de paraphrase qui ne correspond pas à l'ensemble de lemmes de la référence

### 3.2 Pourquoi c'est plus important que le faux positif

En évaluation, le faux rejet est pire que le faux positif. Un faux rejet signifie qu'une traduction *correcte* est notée comme *incorrecte* — cela décourage les constructeurs qui font du bon travail, et cela mine la confiance dans la métrique. Un faux positif signifie qu'une traduction *incorrecte* est notée comme *correcte* — c'est mauvais, mais c'est détecté par d'autres métriques dans la composition.

Le faux rejet se compose : si LYSS-fst a un taux de faux rejet de 10% par mot, et qu'une phrase a 5 mots, la probabilité qu'au moins un mot soit faussement rejeté est ~41%. Cela signifie que près de la moitié de toutes les phrases auront leur taux d'acceptation FST réduit d'au moins un mot — non pas parce que la traduction est incorrecte, mais parce que le FST est incomplet.

### 3.3 Stratégies d'atténuation

| Stratégie | Mécanisme | Efficacité |
|----------|----------|-----------|
| **Listes blanches** | Mettre en liste blanche les mots d'emprunt connus, les noms propres, les abréviations | Élevée pour les lacunes connues, zéro pour les lacunes inconnues |
| **Correspondance floue** | Accepter les mots à distance d'édition 1 d'une forme connue | Détecte les fautes de frappe et les variantes orthographiques mineures |
| **Notation de confiance** | Pondérer les résultats FST par la complétude du paradigme | Nécessite des métadonnées de couverture de paradigme |
| **Seuils spécifiques à la catégorie** | Différents seuils pour différents domaines (médical peut avoir plus de mots d'emprunt) | Nécessite des corpus étiquetés par domaine |
| **Listes blanches maintenues par la communauté** | Les locuteurs soumettent les mots que le FST devrait accepter | Plus durable à long terme ; nécessite une infrastructure d'engagement communautaire |

### 3.4 Mesurer le taux

Le taux de faux rejet doit être mesuré empiriquement, sur un corpus représentatif :

1. Prenez un corpus de 500+ phrases cri valides connues (manuels, traductions révisées)
2. Exécutez chaque mot à travers le FST
3. Pour chaque mot que le FST rejette, demandez à un locuteur bilingue de le classer : mot valide que le FST a manqué, ou genuinely invalide ?
4. `false_rejection_rate = valid_but_rejected / total_valid_words`

Cette mesure est l'une des expériences de validation requises (Spécification de notation §1.6).

---

## Partie 4 : Qui décide ce qui est « correct » ?

### 4.1 La dimension politique de l'évaluation

Les métriques d'évaluation ne sont pas des instruments neutres. Chaque métrique intègre une théorie de ce que signifie « traduction correcte », et cette théorie a des conséquences :

- Un FST construit à partir du cri littéraire pénalisera le cri colloque. C'est un choix *politique* sur quel registre de la langue est valorisé.
- Une classe de variante qui accepte une forme dialectale mais pas une autre standardise implicitement la langue. La standardisation est un acte politique avec une longue histoire coloniale.
- Un validateur sémantique qui nécessite un chevauchement exact de lemmes pénalise la paraphrase créative — une stratégie de traduction importante que les traducteurs compétents utilisent délibérément.

Microeval rend ces choix *explicites*. Chaque classe de variante, chaque entrée de liste blanche, chaque règle d'équivalence sémantique est une décision discrète, documentée et révisable. C'est une caractéristique, pas un bug : cela signifie que la communauté peut inspecter, contester et modifier les règles qui régissent la façon dont leur langue est évaluée.

### 4.2 Gouvernance communautaire des règles d'évaluation

Pour les langues autochtones en particulier, les décisions d'évaluation doivent être gouvernées par la communauté linguistique, et non par des chercheurs ou des ingénieurs externes. Ce n'est pas seulement un principe éthique (bien que ce le soit) — c'est une exigence de correction. Seuls les locuteurs courants peuvent déterminer si une variante est acceptable.

Le modèle de gouvernance :

1. **Les chercheurs proposent** des classes de variantes, des entrées de liste blanche et des règles sémantiques basées sur l'analyse linguistique
2. **Les locuteurs examinent** chaque proposition et l'approuvent, la rejettent ou la modifient
3. **Les règles approuvées** sont validées dans la base de code avec attribution du locuteur
4. **Les règles contestées** sont signalées pour discussion communautaire — elles sont exclues de la notation jusqu'à résolution
5. **La communauté peut révoquer** n'importe quelle règle à tout moment en la supprimant de l'ensemble approuvé

Ce modèle nécessite une infrastructure (le harnais d'évaluation, le contrôle de version, le protocole de validation du locuteur) et des relations (confiance entre chercheurs et membres de la communauté). La construction de cette infrastructure fait partie de la méthodologie microeval.

### 4.3 Variation dialectale

La question de gouvernance la plus difficile : quand deux dialectes d'une langue ne sont pas d'accord sur une forme, laquelle est « correcte » ?

La réponse de microeval : **les deux sont correctes.** Les variantes dialectales sont représentées comme des classes de variantes supplémentaires avec des étiquettes de dialecte. Le score composite peut être calculé par dialecte ou entre dialectes, selon ce que l'évaluation essaie de mesurer.

Cela nécessite que le corpus soit étiqueté par dialecte et que les classes de variantes soient conscientes du dialecte. Cela nécessite également que des locuteurs de plusieurs dialectes participent à la validation. Le document Corpus Partnership Strategy aborde ces exigences.

---

## Partie 5 : Relation aux travaux antérieurs

### 5.1 Ce que microeval N'EST PAS

| Affirmation que nous ne faisons PAS | Pourquoi pas |
|-----------------------------------|-----------|
| « Les métriques universelles sont inutiles » | Elles fournissent des lignes de base essentielles et une comparabilité entre langues. Microeval complète, ne remplace pas. |
| « Les métriques neurales ne peuvent pas fonctionner pour LRL » | Elles peuvent — avec un affinage sur des données spécifiques à la langue. Mais ces données n'existent rarement. Microeval fonctionne *maintenant*. |
| « L'évaluation basée sur FST est nouvelle » | Les FST sont utilisés en TAL depuis des décennies. La nouveauté est dans le déploiement systématique en tant que métriques d'évaluation de TA. |
| « LYSS est meilleur que COMET » | Nous ne savons pas — nous n'avons pas fait l'étude de corrélation humaine. Nous croyons que LYSS est plus *informatif* pour les langues polysynthétiques, mais nous ne pouvons pas affirmer qu'il est plus *précis* jusqu'à ce que nous ayons des preuves. |

### 5.2 Travaux antérieurs les plus proches

| Travail | Relation à microeval |
|--------|-------------------|
| **MorphEval** (Sánchez-Cartagena & Toral, 2024) | Tests contrastifs pour les phénomènes morphologiques — complémentaire. MorphEval teste si les systèmes *peuvent* produire de la morphologie ; LYSS teste s'ils l'*ont fait*. |
| **CheckList** (Ribeiro et al., 2020) | Méthodologie de test comportemental pour le TAL — paradigme analogue. CheckList est une méthodologie ; microeval est aussi une méthodologie, appliquée à l'évaluation plutôt qu'aux tests. |
| **HyTER** (Dreyer & Marcu, 2012) | Treillis d'équivalence sémantique — parallèle conceptuel le plus proche de LYSS-eq. HyTER énumère les paraphrases ; LYSS-eq énumère les variantes morphologiques. HyTER nécessite une construction manuelle de treillis par phrase ; les règles LYSS-eq s'appliquent à l'échelle du corpus. |
| **Couverture Apertium** | Utilise la couverture FST comme proxy pour la qualité de sortie de TA — anticipe directement LYSS-fst. Non formalisé comme une métrique ou intégré dans un cadre de notation. |
| **FUSE** (AmericasNLP 2025) | Évaluation basée sur les caractéristiques pour les langues autochtones américaines — plus similaire en esprit. FUSE propose des caractéristiques linguistiques comme dimensions d'évaluation ; LYSS implémente des caractéristiques spécifiques pour des langues spécifiques. Une comparaison directe est nécessaire. |
| **AfriCOMET** (Wang & Adelani, 2024) | COMET affiné pour les langues africaines — démontre que les métriques neurales *peuvent* être adaptées. Microeval est le complément basé sur les règles pour les langues où les données d'affinage n'existent pas. |

### 5.3 La distinction clé

Tous les travaux antérieurs en évaluation consciente de la morphologie soit :
1. **Proposent un cadre général** sans l'implémenter pour des langues spécifiques (FUSE, CheckList)
2. **Implémentent pour les langues à ressources élevées** où les données d'entraînement existent (MorphEval se concentre sur les paires européennes)
3. **Affinent les métriques neurales** ce qui nécessite les données que nous n'avons pas (AfriCOMET)

Microeval est spécifiquement conçu pour le cas où :
- Les outils linguistiques (FST, dictionnaires) existent
- Les données d'entraînement pour l'affinage de métrique neurale n'existent pas
- La complexité morphologique de la langue défait les métriques de surface
- L'évaluation doit être opérationnelle *maintenant*, pas après une campagne de collecte de données

---

## Partie 6 : Questions ouvertes et limitations honnêtes

### 6.1 Questions non résolues

1. **Les métriques LYSS corrèlent-elles avec les jugements de qualité humains ?** Nous ne savons pas. L'étude de corrélation humaine requise (200+ paires de phrases, 3+ locuteurs bilingues) n'a pas été menée. Jusqu'à ce qu'elle le soit, les scores LYSS sont des estimations d'ingénierie, pas des mesures de qualité validées.

2. **Comment les métriques LYSS se comportent-elles à mesure que les langues changent ?** Les langues vivantes évoluent — nouveaux mots d'emprunt, dialectes changeants, néologismes émergents. Les FST et les classes de variantes doivent être maintenus. Quel est le fardeau de maintenance ? Nous ne savons pas.

3. **Quelle est la qualité FST minimale pour un LYSS-fst utile ?** Si un FST ne couvre que 60% du lexique, LYSS-fst est-il toujours utile, ou le bruit submerge-t-il le signal ? Nous avons besoin de preuves empiriques.

4. **Microeval peut-il fonctionner pour les défis non morphologiques ?** Les langues avec des distinctions tonales, des consonnes cliquées ou des écritures logographiques présentent des défis d'évaluation que les FST ne traitent pas. Microeval peut ne pas s'appliquer — ou il peut nécessiter des outils différents.

5. **Comment gérons-nous le problème du démarrage à froid ?** Construire une suite microeval nécessite une expertise linguistique. Pour les langues sans communauté de linguistique informatique active, qui fait le travail ?

### 6.2 Limitations honnêtes de LYSS

| Limitation | Gravité | Atténuation |
|-----------|---------|-----------|
| Pas de données de corrélation humaine | 🔴 Critique | Expérience de validation requise #1 |
| Taux de faux rejet FST non mesuré | 🔴 Critique | Expérience de validation requise #2 |
| Implémenté uniquement pour une langue (CRK) | 🟡 Significatif | Port de deuxième langue (Sámi du Nord) prévu |
| Les classes de variantes peuvent être incomplètes | 🟡 Significatif | Examen communautaire + ajout continu |
| Le validateur sémantique nécessite spaCy | 🟡 Significatif | Dépendance optionnelle ; dégradation gracieuse |
| La couverture du dictionnaire affecte la qualité LYSS-sem | 🟡 Significatif | Exigences de taille minimale du dictionnaire documentées |
| Impossible de détecter la fluidité ou le naturel | 🟡 Significatif | Nécessite l'évaluation humaine ou les métriques neurales |
| Nécessite une expertise linguistique pour étendre | 🟡 Significatif | La documentation de la méthodologie (cet article) réduit la barrière |

### 6.3 La voie à suivre

> *« Si nous nous concentrons uniquement sur ce qui se généralise, nous oublierons inévitablement où cela ne fonctionne pas — et nous perdrons ces langues et toute leur connaissance et sagesse. »*

Microeval n'est pas une solution au problème d'évaluation. C'est une pratique — une discipline de prêter attention à ce qui rend chaque langue différente, et d'encoder cette attention dans du code fonctionnel. La pratique est laborieuse, spécifique à la langue et jamais terminée. Mais elle produit quelque chose que le paradigme de métrique universelle ne peut pas : une évaluation qui parle la langue qu'elle évalue.

---

## Annexe A : Articles clés

| Article | Année | Contribution | Pertinence |
|---------|-------|-------------|-----------|
| Papineni et al., « BLEU » | 2002 | Métrique n-gramme fondatrice | Métrique universelle de base |
| Popović, « chrF++ » | 2017 | Métrique n-gramme de caractères | Meilleure métrique de surface pour les langues morphologiquement riches |
| Rei et al., « COMET » | 2020 | Cadre d'évaluation neuronal | Métrique neurale universelle |
| Dreyer & Marcu, « HyTER » | 2012 | Sémantique d'équivalence | Prédécesseur conceptuel de LYSS-eq |
| Burlot & Yvon, « MorphEval » | 2017 | Évaluation morphologique | Test morphologique contrastif |
| Ribeiro et al., « CheckList » | 2020 | Test comportemental pour le TAL | Paradigme méthodologique |
| Sánchez-Cartagena & Toral, « MorphEval » | 2024 | Évaluation des capacités morphologiques | Complément diagnostique le plus proche |
| Wang & Adelani, « AfriCOMET » | 2024 | Métrique neurale adaptée pour les langues africaines | Démontre le besoin d'évaluation spécifique à la langue |
| Lindén et al., « HFST » | 2011 | Cadre de morphologie à états finis | Infrastructure pour LYSS-fst |
| Wolfart, « Plains Cree » | 1973 | Grammaire définitive du cri | Autorité linguistique pour microeval CRK |
| Wolvengrey, « Cree: Words » | 2001 | Dictionnaire du cri des Plaines | Ressource sous-jacente à LYSS-sem |
| Carroll et al., « CARE Principles » | 2020 | Gouvernance des données autochtones | Cadre de gouvernance pour microeval |

## Appendice B : Résumé des composants LYSS

| Composant | Nom de la métrique | Ce qu'elle mesure | Ressources requises | État de mise en œuvre |
|-----------|------------------|------------------|-------------------|-----------------------|
| LYSS-fst | `fst_acceptance_rate` | Validité morphologique des mots de sortie | FST GiellaLT | ✅ Opérationnel (CRK) |
| LYSS-eq | `equivalent_match_rate` | Détection de variante acceptable | Classes de variantes curées par des linguistes | ✅ Opérationnel (CRK, 6 classes) |
| LYSS-sem | `semantic_score` | Préservation du sens via chevauchement lemme-glose | FST + dictionnaire bilingue + spaCy | ✅ Opérationnel (CRK, nécessite spaCy) |

## Appendice C : Langues avec couverture FST GiellaLT

Les langues suivantes ont des FST disponibles via GiellaLT et sont candidates pour l'intégration LYSS-fst :

<!-- Cette liste doit être remplie avec les données de couverture GiellaLT réelles. -->
<!-- Voir : https://github.com/giellalt -->

| Langue | ISO 639-3 | Maturité FST | Faisabilité LYSS-fst |
|--------|-----------|-------------|---------------------|
| Cri des Plaines | crk | Production | ✅ Opérationnel |
| Sámi du Nord | sme | Production | 🟡 Prévu (premier port) |
| Sámi du Sud | sma | Production | 🟡 Candidat |
| Sámi de Lule | smj | Production | 🟡 Candidat |
| Sámi d'Inari | smn | Production | 🟡 Candidat |
| Sámi de Skolt | sms | Production | 🟡 Candidat |
| Finnois | fin | Production | 🟡 Candidat |
| Inuktitut | iku | Bêta | 🟡 Évaluation nécessaire |
| Basque | eus | Bêta | 🟡 Évaluation nécessaire |
| Gallois | cym | Bêta | 🟡 Évaluation nécessaire |
