---
sidebar_position: 3
title: "Ensembles de données d'évaluation"
related:
  - label: "Corpus Design Framework"
    to: /docs/network/specifications/corpus-design
    kind: spec
    note: "How evaluation corpora are constructed"
  - label: "Cookbook: Corpus Creation"
    to: /docs/network/tutorials/corpus-creation
    kind: cookbook
    note: "Build a corpus for your language"
  - label: "Benchmark Specification"
    to: /docs/network/specifications/benchmark
    kind: spec
  - label: "What Counts as a Language Here?"
    to: /docs/network/context/what-counts-as-a-language
    kind: doc
---

# Ensembles de données d'évaluation

> **Synthèse.** Cette page décrit les jeux de données d'évaluation disponibles pour l'évaluation comparative, y compris le schéma d'entrée du corpus, les niveaux de difficulté (1–5) et les exigences de provenance. Le catalogue comprend **environ 4 700 jeux de données d'évaluation récupérés à la source répartis sur 19 familles de corpus** (TICO-19, IN22, Tatoeba, GlobalVoices, SMOL, ALT, Turkic-x-WMT, WMT24++, les jeux de données à l'aveugle WMT newstest/General 2014–2025, MAFAND-MT, NusaX, NusaTranslation, LoResMT, AmericasNLP 2021, NICT-SAP, BSD, MENYO-20k, Gamayun, EdTeKLA) plus FLORES+ — le *contenu* des corpus n'est jamais hébergé ici ; chaque jeu de données est une fiche de métadonnées avec hachage SHA épinglé, reconstruite de manière déterministe à partir de son archive en amont épinglée. Une **voie non commerciale / réservée à la recherche** (Gamayun, EdTeKLA, MAFAND-MT, NusaTranslation, LoResMT, AmericasNLP, NICT-SAP, BSD, MENYO-20k et les jeux de données WMT à usage de recherche) est exclue de toute voie commerciale / de prix / d'API ; au sein de celle-ci, les corpus sous licences modifiées, sur mesure ou non spécifiées sont en outre **restreints par consentement** — l'évaluation via l'API de modèles distants est refusée à moins que le texte de la licence lui-même n'autorise l'utilisation à des fins d'évaluation (enregistrée comme une décision explicite par jeu de données, comme pour les jeux de données WMT à usage de recherche) ou que l'autorisation du titulaire des droits ne soit enregistrée sur l'entrée du jeu de données. Les deux jeux de données de référence vérifiés par des humains — EDTeKLA Dev v1 (Cri des plaines) et FLORES+ Devtest (870 paires de langues cataloguées, 1 012 phrases chacune) — sont détaillés ci-dessous ; la répartition détaillée du nombre d'entrées d'EdTeKLA est indiquée une seule fois, dans [sa section](#edtekla-development-set-v1).

Les ensembles de données sont les cibles fixes contre lesquelles le harnais s'exécute. Chaque ensemble de données est un fichier JSON contenant des paires source→cible avec des références de référence. Le harnais évalue les résultats du modèle par rapport à ces références — il ne les modifie jamais.

:::danger[NE PAS ENTRAÎNER sur les données d'évaluation]

⚠️ **Ces ensembles de données sont réservés à l'évaluation uniquement.** Les méthodes entraînées, affinées, peu-shot-invitées ou autrement exposées aux données d'évaluation produiront des scores artificiellement gonflés et seront **disqualifiées du classement.**

Utilisez des corpus distincts pour l'entraînement. Les ensembles d'évaluation doivent rester invisibles à votre modèle pendant le développement.
:::

---

## Format de l'ensemble de données {#dataset-format}

Chaque ensemble de données suit le même schéma JSON :

```json
{
  "dataset": {
    "id": "dataset-slug",
    "version": "1.0",
    "language_pair": "EN→CRK",
    "description": "Human-readable description of the dataset",
    "source_language": "en",
    "target_language": "crk",
    "created": "2025-05-01",
    "license": "CC-BY-NC-4.0",
    "provenance": ["gold_standard", "textbook"]
  },
  "entries": [
    {
      "id": 1,
      "source": "Hello",
      "reference": "tânisi",
      "difficulty": 1,
      "provenance": "gold_standard",
      "register": "conversational",
      "context": "greeting",
      "notes": "Common greeting, SRO orthography"
    }
  ]
}
```

:::info[Schéma canonique]
La [Spécification d'analyse comparative](/docs/network/specifications/benchmark) définit le corpus canonique et le schéma d'entrée. Cette page documente les ensembles de données disponibles et comment en créer de nouveaux.
:::

### Bloc `dataset` de niveau supérieur

| Champ | Type | Description |
|-------|------|-------------|
| `id` | `string` | Identifiant unique de l'ensemble de données (utilisé dans les cartes d'exécution et le classement) |
| `version` | `string` | Version sémantique. L'incrémentation invalide les comparaisons de cartes d'exécution antérieures |
| `language_pair` | `string` | Étiquette d'affichage (par exemple, `EN→CRK`) |
| `description` | `string` | Optionnel. Résumé lisible par l'homme |
| `source_language` | `string` | Code de langue source BCP 47 |
| `target_language` | `string` | Code de langue cible BCP 47 |
| `created` | `string` | Date de création ISO 8601 |
| `license` | `string` | Identifiant de licence SPDX |
| `provenance` | `string[]` | Liste des étiquettes de provenance utilisées dans les entrées |

### Champs d'entrée

| Champ | Type | Requis | Description |
|-------|------|--------|-------------|
| `id` | `integer` | ✅ | Identifiant unique d'entrée dans le corpus |
| `source` | `string` | ✅ | Le texte source à traduire |
| `reference` | `string` | ✅ | La traduction de référence de référence |
| `difficulty` | `integer` | ✅ | Niveau de difficulté 1–5 (voir ci-dessous) |
| `provenance` | `string` | ✅ | Origine de cette entrée (par exemple, `gold_standard`, `textbook`, `elicited`) |
| `register` | `string` | ✅ | Niveau de registre/formalité (par exemple, `conversational`, `formal`, `ceremonial`) |
| `context` | `string` | ✅ | Fonction communicative (par exemple, `greeting`, `declaration`, `instruction`) |
| `notes` | `string` | ❌ | Contexte optionnel pour les examinateurs humains |
| `morphological_analysis` | `string` | ❌ | Décomposition morphologique de référence |
| `variant_class` | `string` | ❌ | Étiquette de classe regroupant les variantes de traduction acceptables |

---

## Ensembles de données disponibles

Le catalogue comprend **environ 4 700 jeux de données d'évaluation récupérés à la source répartis sur 19 familles de corpus**, plus les deux jeux de données de référence vérifiés par des humains (EDTeKLA + FLORES) détaillés ci-dessous — soit un total dans le registre de **5 602 jeux de données** au 12-07-2026. Chaque corpus est une **fiche de métadonnées avec hachage SHA épinglé** — le contenu du corpus n'est jamais hébergé ici ; il est reconstruit de manière déterministe à partir de son archive en amont épinglée au moment de l'évaluation. Tous les jeux de données portent `do_not_train`. Une fiche source se déploie en de multiples jeux de données par paire, de sorte que le total du registre dépasse les quelque 1 417 fiches sources ; les jeux de données de la voie ouverte alimentent directement la file d'attente d'analyse ; la voie réservée à la recherche s'exécute à la demande lorsque sa licence le permet clairement (les licences modifiées/sur mesure/non spécifiées sont restreintes par consentement pour l'évaluation via l'API de modèles distants).

| Famille | Jeux de données | Créateur / source | Licence | Voie |
|--------|---------:|------------------|---------|------|
| **TICO-19** | 1 260 | Consortium TICO-19 (CMU, JHU, GMU, Amazon, Appen, Facebook, Google, Microsoft, Translated, TWB) | CC0-1.0 | ouverte |
| **IN22** (Conv + Gén) | 1 012 | AI4Bharat / IIT Madras | CC-BY-4.0 | ouverte (téléchargement restreint sur HF) |
| **Tatoeba** | 874 | [Communauté Tatoeba](https://tatoeba.org), via le Tatoeba Challenge | CC-BY-2.0 | ouverte |
| **GlobalVoices** | 493 | Global Voices / OPUS | CC-BY-3.0 | ouverte |
| **SMOL** (doc + phrase) | 490 | Google (SMOL) | CC-BY-4.0 | ouverte |
| **WMT newstest / General** (jeux de données à l'aveugle 2014–2025) | 178 | WMT (Conference on Machine Translation), via sacreBLEU | `LicenseRef-WMT-Research-Use` | **usage de recherche** |
| **ALT** | 156 | NICT / Projet ALT | CC-BY-4.0 | ouverte |
| **Turkic-x-WMT** | 90 | Turkic Interlingua (til-mt) | MIT | ouverte |
| **WMT24++** | 55 | Google / Unbabel | Apache-2.0 | ouverte |
| **MAFAND-MT** | 40 | Masakhane NLP | CC-BY-NC-4.0 | **non commerciale / réservée à la recherche** |
| **NusaX** | 22 | IndoNLP | CC-BY-SA-4.0 | ouverte (partage dans les mêmes conditions) |
| **NusaTranslation** | 20 | IndoNLP | `LicenseRef-NusaWrites-Unstated-Data-License` | **réservée à la recherche** |
| **LoResMT** (2020 + 2021) | 10 | Atelier LoResMT (organisateurs de la tâche partagée) | CC-BY-NC-SA-4.0 | **non commerciale / réservée à la recherche** |
| **AmericasNLP 2021** | 9 | Tâche partagée AmericasNLP (organisateurs) | `LicenseRef-AmericasNLP-Mixed-ResearchUse` | **réservée à la recherche** |
| **Gamayun** | 8 | CLEAR Global (anciennement Traducteurs sans frontières) | `LicenseRef-TWB-Gamayun` | **non commerciale / réservée à la recherche** |
| **NICT-SAP** | 8 | SAP SE | CC-BY-NC-4.0 | **non commerciale / réservée à la recherche** |
| **EDTeKLA / prix** | 3 | Groupe de recherche EdTeKLA, Université de l'Alberta | LicenseRef-EdTeKLA-Modified-CC-BY-NC-SA-4.0 | **non commerciale / réservée à la recherche (en quarantaine)** |
| **BSD** | 2 | Laboratoire Tsuruoka, Université de Tokyo | CC-BY-NC-SA-4.0 | **non commerciale / réservée à la recherche** |
| **MENYO-20k** | 2 | Masakhane / Université de la Sarre (uds-lsv) | CC-BY-NC-4.0 | **non commerciale / réservée à la recherche** |

*(FLORES+ devtest — 870 paires cataloguées, CC-BY-SA-4.0 — est l'ensemble de données de référence détaillé ci-dessous, portant le total du registre à 5 602.)*

:::info[La voie non commerciale réservée à la recherche]
La majeure partie du catalogue est sous licence permissive (CC0, CC-BY-2.0/3.0/4.0, MIT,
Apache-2.0) et utilisable dans toutes les voies. Un petit ensemble — **Gamayun** (licence
sur mesure de TWB) et **EDTeKLA** (une licence CC BY-NC-SA modifiée, à portée de souveraineté) — est **non commercial** : il est
exclu de toute voie commerciale, de prix ou d'API. Pour les corpus sous
licences modifiées, sur mesure ou non spécifiées, l'évaluation via l'API de modèles distants est
en outre **restreinte par consentement** : l'environnement de test refuse d'envoyer leur texte aux
API de modèles tiers à moins que le texte de la licence lui-même n'autorise l'utilisation à des fins d'évaluation
(enregistrée comme une décision explicite par jeu de données — les jeux de données WMT à usage de recherche
en comportent une) ou que l'autorisation explicite du titulaire des droits ne soit enregistrée sur
l'entrée du jeu de données (l'évaluation locale reste possible). L'éligibilité est **basée sur l'utilisation** : la voie commerciale est stricte,
la voie de recherche est souple, et la quarantaine prévaut toujours (ainsi, les tranches EdTeKLA inappropriées
ne peuvent jamais être classées). Consultez
[Enregistrement des corpus et voies d'exposition](/docs/network/sovereignty/registering-corpora) pour
savoir comment un corpus choisit sa voie.
:::

Les ensembles de données de référence sont détaillés ci-dessous ; les corpus familiaux suivent le même schéma JSON et sont répertoriés dans le registre des ensembles de données.

:::note[Un catalogue n'est pas un tableau rempli]
Un grand catalogue de corpus est ce contre quoi les méthodes *peuvent* être analysées — ce n'est pas un classement rempli de résultats. Le tableau lui-même est en phase d'amorçage ; consultez les [règles du classement](/docs/network/leaderboard/rules) et [Limitations honnêtes](/docs/network/honest-limitations).
:::

### Ensemble de développement EDTeKLA v1 {#edtekla-development-set-v1}

Le premier ensemble de données d'évaluation, construit pour la traduction anglais→cri des Plaines (SRO). Créé par le [groupe de recherche EdTeKLA](https://spaces.facsci.ualberta.ca/edtekla/) de l'Université de l'Alberta.

| Propriété | Valeur |
|----------|-------|
| **ID** | `edtekla-dev-v1` |
| **Version** | `1.0` |
| **Paire de langues** | EN → CRK (Cri des plaines, orthographe SRO) |
| **Nombre d'entrées** | Ensemble de développement de 436 entrées (`textbook_dev.json`). Chaîne : 589 lignes brutes alignées en amont → 486 paires valides uniques après normalisation/déduplication (un décompte dérivé par Champollion) → 436 de développement + 50 réservées (répartition déterministe avec la graine 42 de Champollion — EdTeKLA publie les fichiers bruts, pas une répartition). Un ensemble de référence distinct de 62 entrées (vérifié manuellement, réservé à la recherche, **ne provenant pas** du matériel d'EdTeKLA) porte la collection combinée d'évaluation en cri des plaines du projet à 548. |
| **Répartition de la difficulté** | Facile, Moyen, Difficile |
| **Provenance** | `gold_standard` (vérifié par des locuteurs), `textbook` (matériel éducatif publié) |
| **Licence** | [CC BY-NC-SA modifiée d'EdTeKLA](https://github.com/EdTeKLA/IndigenousLanguages_Corpora) (`LicenseRef-EdTeKLA-Modified-CC-BY-NC-SA-4.0` — à portée de souveraineté ; le manuel d'origine est sous CC BY-NC-ND 4.0) — **exclu des voies de classement, de prix et commerciales/d'API** (non commercial) |

> **Ceci est la référence canonique des décomptes de l'ensemble d'évaluation en cri des plaines.** Les autres
> pages renvoient ici plutôt que de les répéter. Les chiffres 486/436/50 sont
> dérivés par Champollion à partir des fichiers bruts alignés d'EdTeKLA (EdTeKLA elle-même ne publie
> ni décomptes ni répartitions) ; l'ensemble de référence de 62 entrées a une provenance distincte, n'émanant pas d'EdTeKLA.
> Le décompte ci-dessus est toujours associé à sa voie : EdTeKLA porte une licence CC BY-NC-SA modifiée,
> à portée de souveraineté, et est **exclu du classement, des prix et de la voie commerciale/d'API**.

**Ce qu'il teste :**

- Salutations de base et expressions courantes
- Animacité nominale et obviation
- Conjugaison verbale selon les personnes et les temps
- Constructions locatives
- Paradigmes possessifs
- Structures de phrases complexes

:::tip[Structure du corpus]
Le matériel dérivé d'EdTeKLA se divise en un ensemble de développement public et un ensemble réservé (la répartition par Champollion de l'alignement brut du manuel d'EdTeKLA — décomptes dans le tableau ci-dessus). L'ensemble de référence distinct de 62 entrées est vérifié manuellement à partir d'autres sources et ne fait pas partie du corpus EdTeKLA. Un jeu de données plus petit et de haute qualité avec des références vérifiées est plus utile qu'un grand jeu de données bruité — en particulier pour une langue peu dotée où les traductions « approximatives » sont souvent morphologiquement invalides.
:::

---

## Création d'un nouvel ensemble de données

Pour créer un ensemble de données pour une nouvelle paire de langues ou un nouveau domaine :

### 1. Structurer le JSON

Suivez le schéma [Format de l'ensemble de données](#dataset-format). Chaque entrée doit avoir `source`, `reference`, `difficulty`, `provenance`, `register` et `context`.

### 2. Attribuer un ID unique

Utilisez un slug descriptif : `{project}-{split}-v{version}` (par exemple, `edtekla-dev-v1`, `quechua-test-v1`).

### 3. Vérifier les références de référence

Chaque valeur `reference` doit être vérifiée par un locuteur courant ou provenir d'une ressource publiée et examinée par les pairs. Les références générées par machine contredisent l'objectif de l'évaluation.

### 4. Définir les niveaux de difficulté

Attribuez à chaque entrée un niveau de difficulté entier :

| Niveau | Description | Exemples |
|------|-------------|----------|
| 1 — Vocabulaire de base | Mots simples, salutations courantes, nombres | « hello » → « tânisi » |
| 2 — Phrases simples | Sujet-verbe ou SVO, temps présent | « I see the dog » |
| 3 — Complexité modérée | Temps passé/futur, possessifs, animacité | « I saw his dog yesterday » |
| 4 — Morphologie complexe | Obviation, voix passive, ordre conjoint | « the woman whose son went to the store » |
| 5 — Avancé | Multi-clause, registre formel, cérémoniel, idiomatique | Paragraphe complet avec ton approprié au registre |

### 5. Étiqueter la provenance

Chaque entrée doit indiquer d'où elle provient. Étiquettes courantes :

- `gold_standard` — Vérifiée par des locuteurs courants
- `textbook` — Provenant de matériels pédagogiques publiés
- `elicited` — Produite par des séances d'élicitation structurées
- `corpus` — Extraite d'un corpus parallèle

### 6. Valider le fichier

Exécutez le harnais contre votre ensemble de données avec n'importe quel modèle pour vérifier que le JSON est bien formé et que tous les champs requis sont présents :

```bash
mt-eval run --corpus path/to/your-dataset.json --dry-run
```

Le harnais génèrera une erreur sur les champs manquants, les indices en double ou les violations de schéma.

### 7. Soumettre pour inclusion

Ouvrez une demande de tirage contre le [référentiel du harnais d'évaluation](https://github.com/gamedaysuits/Champollion) qui ajoute une **carte de métadonnées fetch-from-source** — une entrée de registre pointant le harnais vers la source amont (chargeur/URL, épingle SHA, licence et provenance). **Ne validez jamais le contenu du corpus lui-même.** Champollion n'héberge ni ne suit le texte du corpus tiers ; le harnais récupère les références de la source amont au moment de l'exécution et évalue par rapport aux données fraîchement récupérées. Validez localement d'abord (étape 6), puis soumettez uniquement la carte. Incluez la documentation de votre méthodologie de vérification et de vos sources de provenance.

---

## FLORES+ Devtest

Un repère multilingue à couverture large maintenu par l'[Initiative de données de langue ouverte (OLDI)](https://huggingface.co/datasets/openlanguagedata/flores_plus). Utilisé pour les comparaisons de frontière multi-modèles de champollion.

| Propriété | Valeur |
|----------|-------|
| **ID** | Une carte par paire : `eval-flores-devtest-v1-<src>-<tgt>` (par exemple `eval-flores-devtest-v1-amh-fra`) |
| **Paires de langues** | 870 paires cataloguées et exécutables (812 d'entre elles entre deux langues non anglaises) |
| **Nombre d'entrées** | 1 012 phrases par paire |
| **Licence** | [CC BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0/) |
| **Source** | Meta FLORES-200, maintenant maintenu par OLDI — récupéré de la source, épinglé SHA par paire (le contenu du corpus n'est jamais suivi ici) |
| **Contamination** | **ÉLEVÉE** — relative uniquement, test / illustration uniquement (voir note) |

:::warning[CONTAMINATION ÉLEVÉE — relative uniquement, jamais un repère absolu]
FLORES+ est une donnée publique, extraite du web, que les modèles de pointe ont très probablement déjà vue. Champollion l'exécute dans une **voie relative uniquement** : utilisable pour comparer les méthodes tête-à-tête, mais **jamais rapportée comme un score de qualité absolue**, et **jamais utilisée comme arête de chaîne** sur la [carte de traduction](https://champollion.dev).
C'est pour **les tests et l'illustration uniquement**.
:::

:::danger[Évaluation uniquement]
FLORES+ est destiné uniquement à l'évaluation. Les conservateurs demandent explicitement qu'il **ne soit pas utilisé comme données d'entraînement**. Assurez-vous que son contenu est exclu de tous les corpus d'entraînement.
:::

---

## Voir aussi

- [Évaluation MT](/docs/network/leaderboard/rules) — aperçu du cadre d'évaluation et du classement
- [Harnais d'évaluation](/docs/network/specifications/harness) — comment exécuter les évaluations par rapport à ces ensembles de données
- [Spécification de la carte d'exécution](/docs/network/specifications/run-card) — le schéma JSON pour enregistrer les résultats
- [Classement des méthodes](https://champollion.dev/leaderboard) — scores d'évaluation comparative en direct
- [Projet EdTeKLA](https://spaces.facsci.ualberta.ca/edtekla/) — le groupe de recherche de l'Université de l'Alberta derrière l'ensemble de données Cree
