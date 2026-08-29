---
sidebar_position: 9
title: "Stratégie de partenariat de corpus"
slug: '/network/specifications/corpus-partnership'
---

# Stratégie de partenariat de corpus : établir des corpus d'évaluation par le biais de départements de linguistique universitaires

La constitution d'un corpus d'*entraînement* pour une langue peu dotée nécessite des centaines de
milliers de paires de phrases — un nombre bien trop important pour être vérifié, de sorte que la qualité varie d'une
manière que personne ne perçoit jusqu'à ce qu'un modèle entraîné sur ces données échoue. Un corpus
d'*évaluation* nécessite quelques centaines de paires, chacune d'entre elles étant révisée par une personne qui
connaît la langue, et il ne devient jamais obsolète : chaque nouveau modèle ou méthode qui
apparaît est mesuré à l'aune de celui-ci. Ce document décrit le flux de travail permettant de construire
cette seconde option, considérablement moins coûteuse — le seul livrable où
l'expertise d'un département touche chaque phrase individuelle — et ce qui se passe
ensuite : une fois une norme d'évaluation en place, un
[prix affiché](/docs/network/specifications/prizes) transforme votre langue
en un objectif que tout concepteur de méthodes dans le monde peut viser, et le
classement public évalue chaque tentative.

> **Objectif.** Le flux de travail complet pour établir un corpus d'évaluation de traduction automatique grâce à un partenariat avec un département de linguistique : ce que le département livre, à quoi le corpus doit ressembler, comment il est scellé cryptographiquement, comment fonctionne l'évaluation en bac à sable, et ce que le département obtient en retour. C'est le document que vous apportez lors d'une réunion avec un partenaire académique potentiel.
>
> **Public cible.** Chefs de département, chercheurs principaux, coordinateurs de recherche et directeurs de programmes de langues autochtones dans les universités ayant des programmes actifs de documentation linguistique ou de TAL.
>
> **Documents d'accompagnement :**
> - [Cadre de conception de corpus](/docs/network/specifications/corpus-design) — la méthodologie sous-tendant des corpus d'évaluation valides et fiables
> - [Spécification des prix](/docs/network/specifications/prizes) — le volet incitatif : proposer un prix pour votre ensemble scellé
> - [Enregistrement des corpus](/docs/network/sovereignty/registering-corpora) — comment un corpus rejoint le réseau sans quitter vos mains
> - [Protocole de validation par les locuteurs](/docs/network/specifications/speaker-validation) — la demande faite aux locuteurs bilingues de *noter* les traductions existantes (évaluation de la qualité, validation par linter, révision par FST)
> - [Spécification de référence](/docs/network/specifications/benchmark) — la spécification technique complète pour les corpus, les fiches d'exécution et les protocoles d'évaluation
> - [Souveraineté des données](/docs/network/sovereignty/data-sovereignty) — les principes autochtones de souveraineté des données, CARE, et pourquoi le transfert de propriété est important

---

## 1. Ce que ce partenariat produit

Un **corpus d'évaluation scellé** : un ensemble organisé de paires de textes parallèles (langue source → langue cible) qui devient la vérité de référence pour mesurer la qualité de la traduction automatique. Les méthodes sont testées par rapport à ce corpus dans un bac à sable — les développeurs ne voient jamais les données de test.

Le partenariat produit trois artefacts :

| Artefact | Ce que c'est | Qui le contrôle |
|----------|-----------|-----------------|
| **Corpus de développement** | 100–200+ paires de textes parallèles publiques pour le développement de méthodes | Publié ouvertement (CC BY-NC-SA 4.0 ou équivalent) |
| **Ensemble de test de référence** | 50–150 paires de textes parallèles secrètes pour l'évaluation officielle | Organisme de gouvernance communautaire (scellé cryptographiquement) |
| **Suite de tests diagnostiques** | 10–50 paires contrastives ciblées testant des phénomènes linguistiques spécifiques | Publié ouvertement |

Au total, cela représente 160 à 400 paires — un corpus qu'un groupe de recherche peut réellement
traiter selon des normes professionnelles, contrairement aux centaines de milliers qu'exigerait un
corpus d'entraînement. Le corpus de développement permet à quiconque de
concevoir des méthodes de traduction. L'ensemble de référence garantit que ces méthodes sont
testées honnêtement. La suite de diagnostic détecte les modes de défaillance spécifiques
(par exemple, « ce système peut-il gérer l'obviation ? »).

---

## 2. Ce que le département doit faire

### Phase 1 : Conception du corpus (2–4 semaines, temps de chercheur)

**Responsable :** PI ou postdoctorant ayant une expertise dans la langue cible.

1. **Sélectionner les domaines de matériel source.** Choisissez 4–6 domaines du monde réel où la traduction est réellement nécessaire pour la communauté linguistique. Notre taxonomie supporte 16 domaines (voir Spécification de référence §2.7) :

   | Priorité | Domaine | Pourquoi |
   |----------|--------|-----|
   | 🔴 Élevée | `edu` — Éducatif | Manuels scolaires, programmes d'études — besoin communautaire direct |
   | 🔴 Élevée | `gov` — Gouvernemental | Documents du conseil de bande, politique — besoin pratique quotidien |
   | 🔴 Élevée | `medical` — Santé | Formulaires d'admission à la clinique, informations de santé — critique pour la sécurité |
   | 🟡 Moyenne | `conv` — Conversationnel | Langage courant — établit la fluidité de base |
   | 🟡 Moyenne | `legal` — Juridique | Documents de droits, traités — importance communautaire |
   | 🟢 Inférieure | `literary` — Littéraire/Culturel | Histoires, histoires orales — préservation culturelle |

2. **Rédiger un document de conception du corpus** spécifiant :
   - Taille cible par segment (développement, gold_standard, diagnostique)
   - Distribution des niveaux de difficulté (voir §3.3 ci-dessous)
   - Couverture du registre et du domaine
   - Critères de sélection des phrases source (pas de texte synthétique, pas de Bible uniquement)
   - Plan de recrutement des locuteurs

3. **Soumettre la conception pour examen.** Nous la validons par rapport au schéma du corpus (Spécification de référence §2) et retournons des commentaires dans un délai d'une semaine.

### Phase 2 : Création de phrases source (4–8 semaines, temps de locuteur)

**Responsable :** Coordonnateur de recherche travaillant avec des locuteurs bilingues.

1. **Générer ou sélectionner des phrases source** dans les domaines et niveaux de difficulté prévus. Les sources peuvent être :
   - Des matériels bilingues publiés existants (manuels scolaires, documents gouvernementaux)
   - Des phrases nouvellement élicitées conçues pour couvrir des phénomènes linguistiques spécifiques
   - Adaptées à partir de documents du monde réel (ordres du jour du conseil de bande, formulaires de clinique, matériels éducatifs)

2. **Chaque phrase source doit avoir :**
   - Étiquette de domaine (à partir de la taxonomie de 16 codes)
   - Étiquette de registre (conversationnel, formel, technique, cérémoniel, éducatif)
   - Étiquette de contexte (salutation, déclaration, question, instruction, récit, étiquette, erreur)
   - Niveau de difficulté estimé (1–5, voir §3.3)
   - Étiquette de provenance (manuel scolaire, élicité, corpus, gold_standard)

3. **Traduire chaque phrase source** dans la langue cible, effectuée par des locuteurs bilingues. Plusieurs traductions de référence par entrée sont précieuses mais non obligatoires.

4. **Optionnellement, ajouter une analyse morphologique** pour chaque traduction de référence :
   - Glose interlinéaire (décomposition morphème par morphème)
   - Chaîne d'étiquette FST (si un automate fini existe pour la langue)
   - Notes du traducteur sur les variantes dialectales, l'ambiguïté ou le contexte culturel

### Phase 3 : Assurance qualité (2–4 semaines)

**Responsable :** Linguiste ayant une expertise dans la langue cible.

1. **Examen croisé.** Chaque traduction doit être examinée par au moins un locuteur bilingue supplémentaire qui n'a pas produit la traduction originale. L'examinateur vérifie :
   - La traduction est-elle exacte ?
   - Sonne-t-elle naturellement ?
   - L'évaluation de la difficulté est-elle correcte ?
   - Y a-t-il des variantes acceptables qui devraient être notées ?

2. **Exécuter via notre validateur de schéma.** Nous fournissons un script qui valide le corpus par rapport au schéma d'entrée (Spécification de référence §2.2). Il vérifie :
   - Les champs obligatoires sont présents
   - Les codes de domaine sont valides
   - Les niveaux de difficulté sont des entiers 1–5
   - Pas d'ID en double
   - Codage des caractères (normalisation UTF-8 NFC)

3. **Si un automate fini existe pour la langue,** exécutez les traductions de référence à travers celui-ci. Chaque mot de la référence doit être valide pour l'automate fini. Les mots qui ne le sont pas (emprunts, néologismes, noms propres) doivent être documentés dans une liste d'autorisation.

### Phase 4 : Segmentation et scellement (1 semaine, ingénierie Champollion)

**Responsable :** Équipe Champollion, avec examen du département.

1. **Division stratifiée.** Nous divisons le corpus en segments en utilisant l'échantillonnage aléatoire déterministe (graine documentée, reproductible) :

   | Segment | Taille cible | Accès |
   |---------|------------|--------|
   | `development` | 60% des entrées (min 100) | Public |
   | `gold_standard` | 30% des entrées (min 50) | Secret, scellé |
   | `held_out` | 10% des entrées (min 10) | Secret, scellé, jamais utilisé jusqu'à activation |

   La division préserve la distribution des niveaux de difficulté (échantillonnage stratifié) de sorte que chaque segment ait une représentation proportionnelle dans tous les niveaux.

2. **Scellement cryptographique** des segments gold_standard et held_out :

   ```
   1. SHA-256 hash of each entry (source + reference + metadata)
   2. SHA-256 hash of the complete segment file
   3. Segment file encrypted with AES-256-GCM
   4. Encryption key split using Shamir Secret Sharing (2-of-3 threshold)
   5. Key shares distributed to:
        - Share 1: Community governance organization
        - Share 2: Academic department partner
        - Share 3: Champollion project (escrow)
   6. Hash manifest published to a public commit (proves the corpus existed
      at a specific time without revealing its contents)
   ```

3. **Le segment de développement** est engagé dans le référentiel public et publié avec une licence complète.

4. **Le segment diagnostique** est également public — il teste des phénomènes linguistiques spécifiques (voir §3.4).

### Phase 5 : Intégration et lancement (1–2 semaines, ingénierie Champollion)

1. **Configuration du harnais.** Nous ajoutons la langue au harnais d'évaluation :
   - Fiche de langue créée ou vérifiée
   - Corpus enregistré dans le registre des ensembles de données
   - Métriques LYSS configurées (LYSS-fst si automate fini disponible, LYSS-eq si des règles de linter existent)
   - Profil de notation par défaut sélectionné (Profil A si automate fini disponible, Profil B sinon)

2. **Référence de base.** Nous exécutons un balayage de 12 modèles par rapport au segment de développement pour remplir le classement avec des scores initiaux.

3. **Annonce publique.** La langue apparaît sur le classement du réseau avec un référence de segment de développement en direct. Le département est crédité en tant que partenaire du corpus.

---

## 3. À quoi le corpus doit ressembler

### 3.1 Format

Chaque fichier de corpus est un document JSON suivant le schéma dans Spécification de référence §2.1–§2.2 :

```json
{
  "dataset": {
    "id": "crk-ualberta-v1",
    "version": "1.0",
    "language_pair": "EN→CRK",
    "source_language": "en",
    "target_language": "crk",
    "created": "2026-09-15",
    "license": "CC-BY-NC-SA-4.0",
    "provenance": ["textbook", "elicited", "gold_standard"]
  },
  "entries": [
    {
      "id": 1,
      "source": "I see the dog",
      "reference": "niwâpamâw atim",
      "segment": "development",
      "difficulty": 2,
      "provenance": "textbook",
      "register": "conversational",
      "context": "declaration",
      "domain": "edu",
      "morphological_analysis": "ni-wâpam-âw atim | 1sg-see.TA-3sg.DIR dog.AN",
      "notes": "Animate noun (atim); direct form because speaker is proximate"
    }
  ]
}
```

### 3.2 Exigences de taille minimale

| Segment | Entrées minimales | Recommandé |
|---------|----------------|-------------|
| `development` | 100 | 200–300 |
| `gold_standard` | 50 | 100–150 |
| `diagnostic` | 10 | 30–50 |
| `held_out` | 10 | 20–30 |
| **Total** | **170** | **350–530** |

### 3.3 Distribution de la difficulté

Le corpus doit inclure des entrées dans les cinq niveaux de difficulté, pondérés vers les niveaux 2–4 :

| Niveau | Description | Distribution cible |
|------|-------------|-------------------|
| 1 — Vocabulaire de base | Mots simples, salutations courantes, nombres | 10–15% |
| 2 — Phrases simples | SVO, temps présent | 25–30% |
| 3 — Complexité modérée | Temps passé/futur, possessifs, animacité | 30–35% |
| 4 — Morphologie complexe | Obviation, passif, ordre du conjoint, propositions relatives | 15–20% |
| 5 — Avancé | Multi-clause, registre formel, cérémoniel, idiomatique | 5–10% |

### 3.4 Suite de tests diagnostiques

Le segment diagnostique teste des phénomènes linguistiques spécifiques en utilisant des **paires contrastives** : une traduction correcte et une traduction incorrecte minimalement différente. Si la métrique d'un système note la traduction correcte plus haut, le test réussit.

Pour les langues polysynthétiques, la suite de tests diagnostiques doit cibler :

| Phénomène | Exemple (Cree) | Ce qu'il teste |
|-----------|----------------|--------------|
| **Accord d'animacité** | atim (AN) vs. maskisin (IN) — formes verbales différentes | Le système sait-il quels noms sont animés ? |
| **Obviation** | Troisième personne proximale vs. obviative | Suit-il la hiérarchie de la troisième personne ? |
| **Marquage inverse** | Formes verbales directes vs. inverses | Gère-t-il le patient qui surclasse l'agent ? |
| **Conjoint/Indépendant** | Verbe de clause principale vs. clause subordonnée | Utilise-t-il le bon paradigme verbal ? |
| **Inclusif/Exclusif** | « Nous (vous inclus) » vs. « Nous (vous exclu) » | Distingue-t-il les formes de première personne du pluriel ? |

Pour les autres familles linguistiques, identifiez les 3–5 phénomènes les plus diagnostiques qui distinguent une traduction compétente d'une traduction incompétente. L'expertise linguistique du département est essentielle ici — ce sont les tests que seul un spécialiste saurait écrire.

### 3.5 Ce que nous ne voulons PAS

| Anti-modèle | Pourquoi |
|-------------|-----|
| **Texte biblique uniquement** | Registre archaïque, vocabulaire liturgique, structure formulaïque. OMT-1600 a évalué 1 560 langues de cette façon — nous l'évitons délibérément. |
| **Paires d'évaluation synthétiques** | Les références générées par LLM contredisent l'objectif de l'évaluation. La référence doit être rédigée par un humain. |
| **Corpus à registre unique** | Tout formel, ou tout conversationnel. La traduction du monde réel s'étend sur plusieurs registres. |
| **Difficulté-1 uniquement** | Les mots simples et les salutations ne testent pas la traduction — ils testent la recherche de vocabulaire. |
| **Références traduites par machine** | Utiliser la sortie de Google Translate comme « référence » est circulaire. |
| **Phrases sans étiquette de contexte** | Nous avons besoin de connaître la fonction communicative pour l'analyse diagnostique. |

---

## 4. Scellement cryptographique et tests en bac à sable {#4-cryptographic-sealing-and-sandbox-testing}

### 4.1 Pourquoi sceller l'ensemble de test ?

Les repères ML conventionnels publient les ensembles de test ouvertement. Une fois publiés, les LLM de pointe finiront par s'entraîner dessus (intentionnellement ou par web scraping), rendant les scores peu fiables. Pour les données linguistiques autochtones, il y a une préoccupation supplémentaire : les données linguistiques publiées peuvent être utilisées sans consentement communautaire.

Le scellement garantit :
- **Intégrité de l'ensemble de test :** Les méthodes ne peuvent pas surapprentissage sur des données qu'elles n'ont jamais vues
- **Souveraineté des données :** La communauté contrôle qui évalue par rapport à ses données
- **Fraîcheur perpétuelle :** L'ensemble de test ne devient jamais contaminé

### 4.2 Comment fonctionne le test en bac à sable

```
Developer workflow:
  1. Developer builds a translation method using the PUBLIC development corpus
  2. Developer tests locally against the development segment (unlimited, self-serve)
  3. When ready, developer submits their complete method (code + config + coaching data)
  4. Governance org installs the method in the evaluation sandbox
  5. Sandbox runs the method against the SEALED gold-standard test set
  6. Only scores are returned to the developer
  7. Developer never sees the source sentences or reference translations

The sandbox:
  - Runs on governance-controlled infrastructure
  - Has selective network access (LLM APIs only, no exfiltration)
  - Produces a tamper-proof run card (SHA-256 hash of all inputs and outputs)
  - Logs all execution for audit purposes
  - Can be inspected by the governance org at any time
```

### 4.3 Gestion des clés

La clé de chiffrement pour l'ensemble de test scellé est divisée en utilisant le partage secret de Shamir avec un seuil de 2 sur 3 :

| Détenteur de part | Rôle | Pouvoir de révocation |
|-------------|------|-----------------|
| **Organisme de gouvernance communautaire** | Dépositaire principal | Peut révoquer l'accès à l'évaluation unilatéralement |
| **Partenaire du département académique** | Co-dépositaire | Peut participer à la reconstruction de la clé |
| **Projet Champollion** | Séquestre | Ne peut pas accéder aux données seul ; assure la continuité si les autres parties deviennent indisponibles |

N'importe quelle 2 des 3 parts reconstruit la clé. Cela signifie :
- La communauté + le département peuvent accéder aux données sans Champollion
- La communauté + Champollion peuvent accéder aux données sans le département
- Champollion seul ne peut JAMAIS accéder aux données

### 4.4 Manifestes de hachage

Lorsque le corpus est scellé, un **manifeste de hachage** est publié dans un commit Git public :

```json
{
  "corpus_id": "crk-ualberta-v1",
  "seal_date": "2026-09-15T00:00:00Z",
  "segments": {
    "development": {
      "entry_count": 200,
      "sha256": "a3f7c...",
      "access": "public"
    },
    "gold_standard": {
      "entry_count": 100,
      "sha256": "b8d2e...",
      "access": "sealed",
      "key_scheme": "shamir-2-of-3"
    },
    "held_out": {
      "entry_count": 20,
      "sha256": "c9e4f...",
      "access": "sealed",
      "key_scheme": "shamir-2-of-3"
    },
    "diagnostic": {
      "entry_count": 30,
      "sha256": "d1a3b...",
      "access": "public"
    }
  },
  "total_entries": 350,
  "manifest_sha256": "e2b5c..."
}
```

Cela prouve :
- Le corpus existait à une date spécifique
- Il a une taille et une structure connues
- Toute modification des segments scellés briserait la chaîne de hachage
- La communauté peut vérifier que ses données n'ont pas été altérées

---

## 5. Ce que le département reçoit

### 5.1 Infrastructure de recherche

| Actif | Description |
|-------|------------|
| **Harnais d'évaluation** | Un cadre d'évaluation fonctionnel et testé pour leur langue — économise des mois de construction d'outils |
| **Métriques LYSS** | Métriques d'évaluation spécifiques à la langue (LYSS-fst, LYSS-eq, LYSS-sem) configurées pour leur langue — si les ressources FST et dictionnaire existent |
| **Classement** | Un classement public et en direct montrant l'état de l'art pour leur paire linguistique |
| **Référence de base** | Balayage de 12 modèles fournissant immédiatement des références publiables |
| **Suite de tests diagnostiques** | Tests ciblés pour des phénomènes linguistiques spécifiques — réutilisables pour d'autres évaluations |

### 5.2 Publications

La construction du corpus et les résultats d'évaluation soutiennent plusieurs publications :

| Article | Lieu | Rôle du département |
|-------|-------|-----------------|
| Méthodologie de construction du corpus | LREC, ComputEL | Auteur principal ou co-auteur |
| Résultats d'évaluation de base | ACL, EMNLP | Co-auteur |
| Validation de la métrique LYSS | Tâche partagée WMT Metrics | Co-auteur |
| Conception de la suite de tests diagnostiques | SIGMORPHON, NAACL | Auteur principal ou co-auteur |
| Ressources PNL spécifiques à la langue | Lieux spécifiques à la langue | Auteur principal |

### 5.3 Positionnement des subventions

Le partenariat fournit des résultats concrets pour les propositions de subventions :

- « Infrastructure d'évaluation open-source pour la TA [langue] » — résultat démontrable
- « Souveraineté cryptographique des données pour les données linguistiques autochtones » — applique les cadres autochtones de souveraineté des données établis (CARE, Kaitiakitanga, Étiquettes TK) à l'évaluation de la TA ; publiable
- « Référence gouvernée par la communauté avec classement en direct » — métrique d'impact continu
- « Évaluation indépendante d'OMT-1600 / Google Translate pour [langue] » — opportun, haute visibilité

### 5.4 Impact communautaire

- La communauté linguistique gagne une **capacité d'évaluation indépendante** — elle peut évaluer si un système de TA (Google, Meta ou personnalisé) fonctionne réellement pour sa langue
- La communauté **contrôle les données de test** via la garde de clé cryptographique
- Toutes les méthodes prouvées par le référence **transfèrent la propriété** à la communauté (voir Spécification de référence §8.3), qui conserve tout ce qu'un déploiement gagne jamais — Champollion est non commercial et ne prend aucune part

### 5.5 Ce qu'il coûte au département

| Composant | Coût estimé | Qui paie |
|-----------|---------------|----------|
| Temps PI/postdoctorant (conception, supervision) | ~40 heures | Département (ou financé par subvention) |
| Compensation des locuteurs (traduction) | 2 500–6 000 $ | Financé par subvention ou Champollion |
| Compensation des locuteurs (examen) | 500–1 500 $ | Financé par subvention ou Champollion |
| Temps du coordonnateur de recherche | ~20 heures | Département |
| **Ingénierie, infrastructure, harnais** | **0 $** | **Projet Champollion** |

Nous fournissons toute l'ingénierie, la configuration du harnais, la configuration des métriques LYSS, l'intégration du classement et l'infrastructure continue sans frais pour le département. La contribution du département est l'expertise linguistique et l'accès aux locuteurs.

---

## 6. Calendrier

| Phase | Durée | Jalon clé |
|-------|----------|--------------|
| 1 : Conception du corpus | 2–4 semaines | Document de conception approuvé |
| 2 : Phrases source + Traduction | 4–8 semaines | Corpus brut complété |
| 3 : Assurance qualité | 2–4 semaines | Examen croisé, validation de schéma |
| 4 : Scellement | 1 semaine | Scellement de gold-standard, manifeste de hachage publié |
| 5 : Intégration | 1–2 semaines | Langue en direct sur le classement avec références de base |
| **Total** | **10–19 semaines** | **Classement en direct avec évaluation scellée** |

---

## 7. Comment commencer {#7-how-to-get-started}

1. **Nous contacter** — [email/contact du projet]. Nous planifierons un appel de 30 minutes pour discuter de votre langue, des ressources disponibles et de la logistique du partenariat.

2. **Nous fournissons :**
   - Ce document
   - Le schéma du corpus et les outils de validation
   - Des exemples de notre corpus Cree (CRK) existant
   - Un modèle de conception de corpus brouillon

3. **Vous fournissez :**
   - Un chercheur principal (PI) ou un postdoctorant pour diriger le travail linguistique
   - Un accès à des locuteurs bilingues (ou un plan pour les recruter)
   - Des informations sur les ressources disponibles (FST, dictionnaire, corpus existants)
   - L'approbation institutionnelle pour la gouvernance des données (conforme aux principes de souveraineté des données des Premières Nations, ou au propre cadre de la communauté)

4. **Nous co-concevons le corpus** — sélection des domaines, distribution de la difficulté, tests diagnostiques, calendrier et budget.

5. **Le travail commence.** Nous nous enregistrons hebdomadairement. Le département a une autonomie complète sur les décisions linguistiques ; nous gérons toute l'ingénierie.

---

## 8. Questions fréquemment posées

### « Nous avons déjà un corpus parallèle. Pouvons-nous l'utiliser ? »

Oui — si le corpus a une provenance claire, est rédigé par un humain et la licence permet l'utilisation dans l'évaluation. Nous vous aiderons à le formater selon notre schéma, à ajouter les métadonnées manquantes et à l'intégrer. Les corpus existants peuvent accélérer considérablement le calendrier (ignorer la Phase 2 ou la réduire à un exercice de remplissage des lacunes).

### « Nous n'avons pas d'automate fini pour notre langue. »

C'est bien. LYSS-fst (validité morphologique) nécessite un automate fini, mais le harnais fonctionne sans lui en utilisant les poids du Profil B (chrF++, BLEU, COMET, métriques comportementales). Si un automate fini GiellaLT existe pour une langue connexe, nous pourrions être en mesure de l'adapter. Sinon, le corpus permet toujours une évaluation précieuse — juste sans la porte de validité morphologique.

### « Nos locuteurs utilisent un script non-latin. »

Entièrement supporté. Le schéma du corpus gère n'importe quel script Unicode. Nous avons conçu pour SRO (Standard Roman Orthography) et les syllabaires pour le Cree, mais la même infrastructure fonctionne pour Devanagari, le script arabe, CJK, Éthiopique ou tout autre système d'écriture.

### « Qu'en est-il de la variation dialectale ? »

Étiquetez-la. Le schéma d'entrée du corpus inclut un champ `notes` pour les informations dialectales. Si plusieurs dialectes sont représentés, documentez-les. Les classes d'équivalence du linter (LYSS-eq) peuvent être configurées pour accepter les variantes dialectales comme équivalentes. La suite de tests diagnostiques peut inclure des contrastes spécifiques aux dialectes.

### « Qui possède le corpus ? »

La communauté linguistique, via l'organisme de gouvernance. Le département est crédité en tant que partenaire de recherche. Champollion détient une part de clé de séquestre pour la continuité opérationnelle mais ne peut pas accéder aux données scellées seul. Le segment de développement, déjà publié, reste public selon sa licence.

### « Que se passe-t-il si nous voulons arrêter ? »

La communauté peut révoquer l'accès à l'évaluation à tout moment en refusant de reconstruire la clé de chiffrement. Les données scellées ne sont jamais exposées. Le segment de développement, déjà publié, reste public selon sa licence. Les résultats de recherche du département (publications, présentations) sont les leurs à conserver indépendamment.

### « Que se passe-t-il si l'organisme de gouvernance n'existe pas encore ? »

Nous pouvons commencer par les Phases 1–3 (conception du corpus, création, assurance qualité) sans organisme de gouvernance. Le scellement (Phase 4) nécessite d'identifier un dépositaire de clé. Entre-temps, le département peut servir de co-dépositaire aux côtés du projet Champollion, avec la compréhension que la garde est transférée à l'organisme de gouvernance communautaire lorsqu'un est établi.

---

## Appendice : Étiquetage vs. Construction du corpus

Ce document couvre la **construction du corpus** — créer les paires de textes parallèles qui forment la vérité de référence d'évaluation. L'étiquetage (annotation morphologique, glose interlinéaire, chaînes d'étiquette FST) est une activité distincte qui enrichit le corpus mais n'est pas requise pour l'évaluation de base.

| Activité | Requise ? | Ce qu'elle permet |
|----------|-----------|-----------------|
| **Construction du corpus** (ce document) | ✅ Requise | Évaluation de base : chrF++, correspondance exacte, COMET, métriques comportementales |
| **Vérification de couverture FST** | 🟡 Optionnelle | Métrique de validité morphologique LYSS-fst **et** le `morphological_accuracy` dérivé de l'automate fini (correspondance de lemme — pas d'annotation nécessaire ; Spécification de notation §2.2) |
| **Annotation morphologique** | 🟡 Optionnelle | Permettrait une mise à niveau *validée par l'or* future de `morphological_accuracy` ; la version dérivée de l'automate fini (ci-dessus) n'en a besoin d'aucune |
| **Règles d'équivalence du linter** | 🟡 Optionnelle | Métrique de correspondance équivalente LYSS-eq |
| **Règles de validateur sémantique** | 🟡 Optionnelle | Métrique de validation sémantique LYSS-sem |
| **Évaluations de qualité des locuteurs** | Activité distincte | Validation des métriques (voir [Protocole de validation des locuteurs](/docs/network/specifications/speaker-validation)) |

L'étiquetage et la validation des locuteurs sont couverts par des documents distincts et peuvent procéder en parallèle ou après la construction du corpus.

