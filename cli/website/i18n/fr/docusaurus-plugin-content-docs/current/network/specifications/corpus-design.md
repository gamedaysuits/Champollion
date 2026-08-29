---
sidebar_position: 7
title: "Cadre de conception de corpus"
---

# Cadre de Conception du Corpus d'Évaluation

Lorsque vous évaluez un modèle de pointe sur FLORES+ et qu'il obtient un score de 85 chrF++, vous ne pouvez pas distinguer « le modèle est bon en traduction » de « le modèle a mémorisé ces paires de phrases spécifiques ». Cette seule ambiguïté explique la raison d'être de ce cadre : un corpus d'évaluation ne vaut la peine d'être construit que si ses scores signifient ce qu'ils prétendent, et cela nécessite une conception délibérée — des paires inédites, une provenance traçable, des domaines stratifiés, une difficulté échelonnée. Cette page est la source de vérité sur la façon dont les jeux de données d'évaluation de Champollion sont conçus, construits et maintenus.

> **Version :** 1.0 · **Statut :** Brouillon · Complément : le flux de travail [Partenariat de corpus](/docs/network/specifications/corpus-partnership) met cette méthodologie en pratique avec un département de recherche.

---

## 1. Principes de Conception

### 1.1 — Pourquoi pas les Benchmarks Publics ?

Les corpus parallèles publics (FLORES+, Tatoeba, ensembles de test WMT, OPUS) sont disponibles pour le développement et le débogage mais sont **exclus de l'évaluation officielle du classement**. La raison est simple :

**Contamination.** Les LLM de pointe sont entraînés sur d'énormes extractions de données du web. Tout texte parallèle ayant existé publiquement — en particulier dans des jeux de données de référence soigneusement sélectionnés et largement cités — se trouve probablement dans leurs données d'entraînement. Il ne s'agit pas d'une préoccupation théorique — [la recherche a démontré](https://arxiv.org/abs/2311.04850) des effets de contamination mesurables sur les benchmarks de traduction automatique. (Les benchmarks publics sont toujours exécutés ici — mais uniquement dans une piste de *comparaison relative* permettant de classer les méthodes les unes par rapport aux autres, jamais comme une mesure de qualité absolue.)

Pour Champollion, cela a une importance cruciale car :
- Le classement compare côte à côte les méthodes basées sur les LLM, les services de traduction automatique classiques et les systèmes conçus sur mesure
- Notre proposition de valeur est *une évaluation honnête et rigoureuse*
- Nos utilisateurs cibles (les communautés linguistiques) prennent des décisions de déploiement en fonction de ces scores

### 1.2 — Exigences Fondamentales

Chaque corpus d'évaluation de Champollion doit satisfaire :

| Exigence | Justification |
|----------|---------------|
| **Rédigé par des humains** | Pas de données synthétiques. Tout texte source et toute traduction de référence doivent être rédigés par des humains. Les LLM peuvent assister l'alignement et le formatage mais ne doivent jamais générer de contenu. |
| **Non disponible publiquement sous forme parallèle** | Le texte source peut être public ; les traductions de référence peuvent être publiques ; mais l'*appairage* spécifique ne doit pas exister en tant que corpus parallèle téléchargeable. |
| **Provenance tracée** | Chaque entrée doit avoir une origine documentée : document source, traducteur, licence, date. |
| **Linguistiquement informé** | La couverture doit être guidée par les caractéristiques typologiques, pas par un échantillonnage aléatoire. |
| **Stratifié par domaine** | Les entrées doivent couvrir des domaines de texte définis avec une représentation contrôlée. |
| **Échelonné par difficulté** | Les entrées doivent être assignées à des niveaux de difficulté (1–5) basés sur la complexité structurelle. |
| **Contrôlé par version** | Les versions de corpus sont hachées par contenu. Les scores ne sont comparables que dans la même version. |
| **Examinable par la communauté** | Les traductions de référence doivent être examinables par les membres de la communauté linguistique. |

### 1.3 — Neutralité du Type de Corpus, de la Longueur et du Style

Champollion est un hub d'évaluation de traduction ouvert qui est **neutre sur ce qu'est une unité de traduction**. Une entrée de corpus est du texte de longueur arbitraire — une courte phrase unique, une phrase longue multi-clause, un paragraphe ou un document entier — et la plateforme les évalue tous de la même manière. **Il n'y a aucune restriction au texte court ou facile.** Le harnais n'impose pas de limite de longueur (il définit délibérément une marge généreuse de jetons de sortie pour éviter de tronquer les traductions longues) ; les niveaux de difficulté (§3) et les domaines (§2.1) sont des *axes configurables*, pas des portes qui excluent le matériel difficile ou long.

Le hub est neutre et configurable sur :

| Axe | Plage |
|-----|-------|
| **Granularité** | phrase · phrase longue · paragraphe · document (`sizeUnit: entries \| sentences \| segments \| documents`) |
| **Longueur et complexité** | court → long ; simple → hautement complexe (niveaux de difficulté 1–5) |
| **Style et registre** | formel, informel, technique, littéraire, conversationnel, administratif (taxonomie de domaine, §2.1) |
| **Méthode** | tout `TranslationMethod` — LLM, NMT neuronal, basé sur des règles, hybride, humain |
| **Langue et paire** | toute paire dirigée ; pas de biais vers les ressources élevées intégré |

Un corpus déclare son propre type, granularité, registre et difficulté dans sa fiche, et le harnais honore ce que la fiche déclare. Les corpus de développement **par défaut** sourçés de Tatoeba sont des phrases courtes parce que Tatoeba l'est — c'est une propriété de ces corpus sources, **pas** une limite de plateforme. L'évaluation au niveau du document et les formes longues sont de première classe ; enregistrez-les de la même manière (et, par exemple, pour les entrées très longues, configurez un lot de requêtes plus petit).

---

## 2. Sélection du Texte Source

### 2.1 — Taxonomie des Domaines

Champollion évalue la traduction pour les **contextes de déploiement pratiques**, pas pour les exercices académiques. Chaque entrée de corpus est étiquetée avec un domaine de la **taxonomie canonique des domaines à 16 codes**, qui est validée au moment de la construction.

La taxonomie est définie une fois — dans [Spécification du Benchmark §2.7](/docs/network/specifications/benchmark#27-domain), la source unique de vérité — et n'est pas répétée ici pour éviter la dérive. Les codes sont : `conv`, `ecommerce`, `edu`, `financial`, `gov`, `legal`, `literary`, `marketing`, `medical`, `news`, `religious`, `scientific`, `subtitles`, `support`, `tech`, et `ui`. Consultez §2.7 pour la description de chaque code et les consommateurs typiques. N'introduisez pas de codes de domaine en dehors de cet ensemble.

### 2.2 — Distribution des Domaines

Un corpus d'évaluation standard devrait viser une répartition sur les domaines les plus pertinents pour la communauté cible. Les codes exacts et les pourcentages varient selon la paire linguistique ; le tableau ci-dessous est une distribution cible *illustrative*, utilisant les codes canoniques de §2.1 :

| Domaine | Code | Cible % | Justification |
|---------|------|---------|---------------|
| Interface logicielle | `ui` | 25% | Contexte de déploiement principal pour les utilisateurs de CLI champollion |
| Gouvernement / administratif | `gov` | 15% | Traduction à enjeux élevés avec implications juridiques |
| Éducatif | `edu` | 15% | Cas d'usage principal pour la revitalisation linguistique |
| Littéraire / narratif | `literary` | 10% | Teste la nuance culturelle et le registre littéraire |
| Conversationnel | `conv` | 10% | Teste le registre informel et les modèles de parole naturelle |
| Technique | `tech` | 10% | Teste la précision et la cohérence terminologique |
| Médical / santé | `medical` | 10% | Enjeux élevés, teste le vocabulaire spécifique au domaine |
| Actualités / journalistique | `news` | 5% | Teste le vocabulaire contemporain et le registre neutre |

### 2.3 — Critères de Sélection des Sources

Lors de la sélection de textes sources pour un nouveau corpus :

1. **Compatibilité de licence.** Le texte source doit être sous une licence qui permet son utilisation dans un corpus d'évaluation. Préférez CC BY, CC BY-SA ou domaine public. Documentez la licence.

2. **Actualité.** Préférez les textes publiés au cours des 10 dernières années. La langue évolue — en particulier le vocabulaire autour de la technologie, de la gouvernance et de la médecine.

3. **Diversité de registre.** Dans chaque domaine, recherchez des textes à différents niveaux de formalité. Un communiqué de presse gouvernemental (formel) et un message gouvernemental sur les réseaux sociaux (informel) sont tous deux du domaine `admin` mais avec des registres différents.

4. **Pertinence culturelle.** Pour les langues autochtones et minoritaires, priorisez les textes qui importent à la communauté — documents de gestion des terres, matériels éducatifs dans la langue, textes de préservation culturelle — plutôt que les textes qui se trouvent exister en parallèle.

5. **Pas de sources traduites par machine.** Si un document « parallèle » a été créé en exécutant l'original via Google Translate puis en post-édition, ce n'est PAS acceptable comme traduction de référence. La référence doit être une traduction humaine indépendante.

---

## 3. Système d'Échelonnement par Difficulté

### 3.1 — Définitions des Niveaux

Chaque entrée est assignée à un niveau de difficulté (1–5) basé sur la complexité structurelle du *texte source*, pas sur la difficulté de traduction (qui varie selon la méthode).

| Niveau | Étiquette | Caractéristiques Structurelles |
|--------|-----------|-------------------------------|
| 1 | **Élémentaire** | Phrases simples. Clause unique. Temps présent. Vocabulaire courant. Pas d'idiomes. Pas de structures imbriquées. |
| 2 | **Intermédiaire** | Phrases composées. Deux clauses jointes par une conjonction. Temps passé/futur. Vocabulaire de domaine. |
| 3 | **Avancé** | Phrases complexes. Clauses subordonnées, clauses relatives. Temps mixtes. Terminologie spécifique au domaine. Voix passive. |
| 4 | **Expert** | Clauses imbriquées multiples. Registre juridique/technique. Structures conditionnelles. Concepts abstraits. Références culturelles. |
| 5 | **Extrême** | Prose dense avec défis multiples simultanés : subordination imbriquée, référence pronominale ambiguë, idiomes culturels, registre mixte, vocabulaire rare. |

### 3.2 — Facteurs de Difficulté Linguistiquement Informés

Au-delà de la complexité structurelle, la difficulté est modulée par la **distance typologique** entre la langue source et la langue cible. Ces facteurs sont tirés des caractéristiques typologiques WALS et des données de classification de la fiche linguistique :

| Facteur | Faible Difficulté | Haute Difficulté |
|---------|------------------|------------------|
| **Ordre des mots** | Même ordre de base (p. ex., SVO→SVO) | Ordre de base différent (p. ex., SVO→SOV) |
| **Type morphologique** | Type similaire (p. ex., analytique→analytique) | Type différent (p. ex., analytique→polysynthétique) |
| **Genre grammatical** | Même système ou pas de genre | Source sans genre, cible avec genre complexe |
| **Honorifique/registre** | Pas de marquage de registre | Cible avec système de registre complexe (p. ex., japonais, coréen) |
| **Script** | Même script | Script différent (translittération requise) |
| **Animacité** | Pas de distinction d'animacité | Cible avec accord basé sur l'animacité (p. ex., Cree) |
| **Évidentialité** | Pas d'évidentialité | Cible marque la source d'information grammaticalement |

### 3.3 — Distribution des Niveaux

Un corpus standard devrait avoir approximativement :

| Niveau | Cible % | Justification |
|--------|---------|---------------|
| 1 | 15% | Établit la ligne de base — même les mauvaises méthodes devraient gérer celles-ci |
| 2 | 25% | Traduction pratique de base |
| 3 | 30% | Où les différences de qualité des méthodes deviennent visibles |
| 4 | 20% | Sépare les bonnes méthodes des excellentes |
| 5 | 10% | Test de plafond — très peu de méthodes géreront bien celles-ci |

---

## 4. Qualité de la Traduction de Référence

### 4.1 — Exigences pour les Traducteurs

Les traductions de référence doivent être produites par des humains qui sont :

1. **Locuteurs courants** de la langue cible (L1 ou équivalent)
2. **Alphabétisés** dans les deux langues source et cible
3. **Conscients du domaine** pour le domaine du texte (un traducteur médical pour les textes de santé, etc.)
4. **Indépendants** — le traducteur ne doit pas avoir accès à aucune sortie de traduction automatique pour le même texte pendant la traduction

### 4.2 — Cahier des Charges de Traduction

Chaque traducteur reçoit un cahier des charges qui inclut :

- Le **registre** à utiliser (formel, conversationnel, etc.)
- L'**audience cible** (grand public, spécialistes, enfants, etc.)
- Toute **convention terminologique** spécifique à la communauté linguistique
- Instruction explicite : « Traduisez le sens, pas les mots. Une traduction qui sonne naturelle est plus précieuse qu'une traduction littérale. »

### 4.3 — Assurance Qualité

1. **Traduction double.** Idéalement, chaque entrée a deux traductions de référence indépendantes par des traducteurs différents. Lorsque ce n'est pas possible, priorisez la traduction double pour les Niveaux 4–5.

2. **Examen communautaire.** Les traductions de référence doivent être examinées par au moins un locuteur supplémentaire qui n'a pas produit la traduction.

3. **Variantes acceptables.** Pour chaque référence, documentez les variantes acceptables connues (ordre des mots, conventions orthographiques, formes dialectales). Celles-ci alimentent la métrique `equivalent_match_rate`.

### 4.4 — Ce qui Rend une Référence Mauvaise

| Problème | Pourquoi Cela Invalide l'Évaluation |
|---------|-----------------------------------|
| Traduit par machine puis post-édité | La post-édition préserve la structure de la traduction automatique ; pénalise les méthodes qui produisent des traductions plus naturelles |
| Traduit par un apprenant, pas un locuteur courant | La référence peut contenir des erreurs qui pénalisent la sortie de traduction automatique correcte |
| Trop littéral | Les traductions naturelles obtiennent un score faible par rapport aux références littérales |
| Interprétation unique valide pour une source ambiguë | Pénalise les interprétations alternatives valides |

---

## 5. Prévention de la Contamination

### 5.1 — Modèle de Menace de Contamination

| Menace | Description | Atténuation |
|--------|-------------|------------|
| **Chevauchement des données d'entraînement** | Les LLM entraînés sur le corpus parallèle | Ne publiez pas le corpus parallèle publiquement |
| **Fuite de few-shot** | L'auteur de la méthode utilise les entrées d'évaluation comme exemples few-shot | Vérification d'empreinte : les entrées dans l'invite sont détectées et signalées |
| **Contamination indirecte** | Le texte source existe dans les données d'entraînement du LLM (monolingue) | Acceptable — le texte source monolingue est attendu. L'*appairage* doit être nouveau. |
| **Contamination de foule** | Les examinateurs communautaires partagent les entrées publiquement | Les conditions de licence interdisent la redistribution du corpus parallèle |

### 5.2 — Niveaux de Secret du Corpus

| Niveau | Visibilité | Utilisation |
|--------|-----------|------------|
| **Ensemble de développement public** | Entièrement public | Développement de méthode, débogage, tests de régression. Les scores ne sont PAS publiés au classement. |
| **Ensemble d'évaluation retenu** | Texte source visible, références secrètes | Évaluation officielle du classement. Les méthodes reçoivent le texte source et retournent les traductions ; le scoring se fait côté serveur. Les références ne sont jamais exposées à la méthode. |
| **Ensemble de référence or** | Entièrement secret, contrôlé par la communauté | Évaluation validée par la communauté. Géré par l'organisation de gouvernance. Utilisé pour la vérification du niveau « Validé par la Communauté ». |

### 5.3 — Politique de Rotation

Les corpus d'évaluation doivent être **rotatés** périodiquement :

1. Après qu'un corpus a été utilisé pendant 12 mois, commencez à construire un remplacement
2. Retirez l'ancien corpus au statut « ensemble de développement » (public)
3. Promouvez le nouveau corpus au statut « ensemble d'évaluation retenu »
4. Cela prévient la contamination progressive par optimisation itérative par rapport à une cible fixe

---

## 6. Flux de Travail de Construction du Corpus

### 6.1 — Processus Étape par Étape

```
Step 1: Language Pair Selection
    └─ Identify target language, read language card
    └─ Review typological features (WALS), contact influences, scripts
    └─ Identify which difficulty factors apply

Step 2: Source Text Curation
    └─ Identify candidate source documents per domain
    └─ Verify licenses
    └─ Extract candidate sentences/segments
    └─ Classify by domain and preliminary difficulty tier

Step 3: Segment Selection
    └─ Sample segments to match domain distribution (§2.2)
    └─ Sample segments to match difficulty distribution (§3.3)
    └─ Ensure linguistic phenomenon coverage (§6.2)
    └─ Target minimum corpus size (§6.3)

Step 4: Reference Translation
    └─ Assign segments to qualified translators
    └─ Provide translation brief
    └─ Collect translations
    └─ Dual-translate Tier 4–5 entries

Step 5: Quality Assurance
    └─ Community review of references
    └─ Document acceptable variants
    └─ Flag and resolve disagreements

Step 6: Metadata & Packaging
    └─ Assign final difficulty tiers
    └─ Add provenance metadata per entry
    └─ Content-hash the corpus for versioning
    └─ Package as corpus JSON per harness spec

Step 7: Registration
    └─ Register in Supabase datasets table
    └─ Add to ATTRIBUTION.md if new sources used
    └─ Document in arena website
```

### 6.2 — Couverture des Phénomènes Linguistiques

Chaque corpus devrait inclure des entrées qui testent des phénomènes linguistiques spécifiques pertinents pour la paire linguistique. Ceux-ci sont tirés des champs `linguisticChallenges` et `contactInfluences` de la fiche linguistique :

**Phénomènes universels (toutes les paires linguistiques) :**
- Résolution de pronoms (antécédents ambigus)
- Négation (simple, double, portée)
- Quantificateurs (tous, certains, aucun, la plupart)
- Expressions temporelles (dates relatives, durées)
- Entités nommées (personnes, lieux, organisations)
- Nombres et mesures
- Listes et énumération

**Phénomènes spécifiques à la paire (de la fiche linguistique) :**
- Pour les cibles polysynthétiques : morphologie verbale complexe, incorporation
- Pour les cibles genrées : accord de genre, référence neutre/inclusive
- Pour les cibles SOV : verbes en fin de clause, postpositions
- Pour les langues tonales : distinctions de sens dépendantes du ton
- Pour les langues honorifiques : marqueurs de registre, contexte social
- Pour les langues de contact : limites de code-switching, intégration des emprunts

### 6.3 — Taille Minimale du Corpus

La fiabilité statistique nécessite des nombres d'entrées minimums. Ceux-ci sont basés sur les exigences d'intervalle de confiance bootstrap appairé (de `significance.py`) :

| Objectif | Entrées Minimales | Recommandé |
|----------|------------------|-----------|
| Ensemble de développement | 50 | 100–200 |
| Ensemble d'évaluation retenu | 100 | 200–500 |
| Ensemble de référence or | 200 | 500+ |
| Minimum par domaine | 10 | 25+ |
| Minimum par niveau | 10 | 20+ |

**Pourquoi 100 minimum pour l'évaluation ?** Avec moins de ~100 entrées, les tests de signification bootstrap appairé (1 000 rééchantillonnages) ne peuvent pas détecter de manière fiable les différences inférieures à ~5 points chrF++. Avec 200+ entrées, nous pouvons détecter des différences de ~2 points à p<0,05.

---

## 7. Format JSON du Corpus

Chaque entrée de corpus suit la spécification du harnais :

```json
{
  "id": "edtekla-dev-v1-042",
  "source": "The school board will meet on Tuesday to discuss the new curriculum.",
  "reference": "ᑭᓯᑭᓄᐦᐊᒫᑐᐏᓐ ᑲ ᐃᔑ ᐱᒥᐸᔨᐦᑕᐦᒃ ᑭᔅᑭᓄᐦᐊᒫᑐᐏᓇ ᐁ ᐃᔑ ᒫᒥᑐᓀᔨᐦᑕᐦᒃ ᐅᔥᑭ ᑭᔅᑭᓄᐦᐊᒫᑫᐏᓂᔭ ᓂᔓ ᑭᔑᑲᐤ",
  "acceptable_variants": [
    "ᑭᔅᑭᓄᐦᐊᒫᑐᐏᓐ ᓂᔓ ᑭᔑᑲᐤ ᑲ ᐃᔑ ᒫᒥᑐᓀᔨᐦᑕᐦᒃ ᐅᔥᑭ ᑭᔅᑭᓄᐦᐊᒫᑫᐏᓂᔭ"
  ],
  "domain": "edu",
  "difficulty": 3,
  "phenomena": ["temporal_expression", "named_entity", "future_tense"],
  "provenance": {
    "source_doc": "EdTeKLA Module 4, Unit 7",
    "source_license": "LicenseRef-EdTeKLA-Modified-CC-BY-NC-SA-4.0",
    "translator": "anonymous-speaker-001",
    "translator_qualification": "L1 Plains Cree, certified translator",
    "translation_date": "2025-11-15",
    "reviewer": "anonymous-speaker-002",
    "review_date": "2025-12-01"
  }
}
```

---

## 8. Mesures Anti-Jeu

### 8.1 — Intégrité du Corpus

| Mesure | Implémentation |
|--------|----------------|
| **Hachage de contenu** | Version du corpus = SHA-256 des ID d'entrée triés + références. Toute modification produit une nouvelle version. |
| **Empreinte d'entrée** | Chaque entrée a un ID dérivé du contenu. Si quelqu'un soumet des résultats contre un corpus modifié, l'empreinte ne correspondra pas. |
| **Application de rétention** | Pour l'évaluation officielle, les méthodes reçoivent UNIQUEMENT le texte source. Les références ne sont jamais exposées. Le scoring se fait côté serveur. |
| **Calendrier de rotation** | Les corpus tournent annuellement pour prévenir l'optimisation à long terme par rapport à une cible fixe. |

### 8.2 — Intégrité de la Soumission

| Mesure | Implémentation |
|--------|----------------|
| **Empreinte déterministe** | La configuration d'exécution (modèle, température, invite, version du corpus) est hachée. Les configurations identiques produisent des empreintes identiques. |
| **Détection de sélection** | Les soumetteurs doivent divulguer toutes les exécutions, pas seulement la meilleure. Les soumissions multiples avec la même empreinte sont signalées. |
| **Vérification de contamination** | Si les entrées d'évaluation apparaissent verbatim dans l'invite ou les données de coaching de la méthode, la soumission est disqualifiée. |

---

## 9. Corpus Existants

### 9.1 — Ensemble de Développement EDTeKLA v1

| Propriété | Valeur |
|----------|-------|
| **ID** | `edtekla-dev-v1` |
| **Paire** | EN → CRK (Cri des plaines, SRO) |
| **Entrées** | Jeu de développement de 436 entrées (`textbook_dev.json`). La répartition complète est indiquée une fois sur la [page des jeux de données d'évaluation](/docs/network/leaderboard/datasets#edtekla-development-set-v1). |
| **Domaines** | Éducatif (100 %) |
| **Niveaux** | 1–5 (répartition à déterminer par l'audit des entrées) |
| **Licence** | CC BY-NC-SA modifiée d'EdTeKLA (`LicenseRef-EdTeKLA-Modified-CC-BY-NC-SA-4.0`, à portée de souveraineté) — **exclue des pistes du classement, des prix et des pistes commerciales/API** (non commerciale) |
| **Statut** | Jeu de développement (public) |

**Limitations :** Domaine unique (éducatif uniquement). Pas de stratification de domaine. Les assignations de niveau peuvent nécessiter un audit. La petite taille du corpus limite la puissance statistique pour les tests de signification.

### 9.2 — Corpus Prévus

| Corpus | Paire | Statut | Propriétaire |
|--------|-------|--------|-------------|
| Corpus personnalisé EN → TL (Tagalog) | EN → TL | Planifié | Propriétaire du projet |
| Ensemble retenu EN → CRK | EN → CRK | Futur (nécessite un partenaire communautaire) | Organisme de gouvernance communautaire |

---

## 10. Intégration de la Fiche Linguistique

Le cadre du corpus s'intègre au système de fiche linguistique :

1. **La sélection de domaine** est informée par `linguisticChallenges` de la fiche — si une langue a des défis uniques (polysynthèse, ton, animacité), le corpus doit inclure des entrées qui les testent.

2. **L'étalonnage de difficulté** utilise `classification` de la fiche — la distance typologique entre les familles source et cible affecte ce qui constitue « difficile ».

3. **La couverture de registre** utilise `registers` de la fiche — si une langue a des registres définis (formel-tagalog, taglish-professionnel, taglish-casual), le corpus devrait inclure des entrées à chaque niveau de registre.

4. **Le test d'influence de contact** utilise `contactInfluences` de la fiche — pour les langues avec des couches d'emprunt lourdes (Tagalog : espagnol + anglais + arabe), incluez des entrées qui testent si les méthodes gèrent correctement les emprunts par rapport à la sur-traduction.

5. **La gestion du script** utilise `scripts[]` de la fiche — pour les langues multi-script (serbe : cyrillique + latin), incluez des entrées qui testent la sélection correcte du script.

---

## Références

- **Spécification de Scoring de Champollion** — définit toutes les métriques, poids composites, niveaux de qualité
- **Spécification de Benchmark de Champollion** — protocole d'évaluation, format du corpus, souveraineté des données
- **WALS** (World Atlas of Language Structures) — base de données des caractéristiques typologiques
- **Glottolog** — source de vérité de classification linguistique
- **ISO 639-3** — norme d'identification linguistique
- **EdTeKLA** — source du premier corpus d'évaluation

---

*Ce document est une spécification vivante. Mettez-le à jour à mesure que de nouveaux corpus sont construits et que des leçons sont apprises.*
