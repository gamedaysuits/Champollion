---
sidebar_position: 4
title: "Spécification de la Carte de Langue"
description: "Schéma canonique pour les cartes de configuration par langue de Champollion."
# This page renders its canonical example from the live corpus via an MDX
# component; `mdx.format` opts this one .md file into the MDX processor.
mdx:
  format: mdx
related:
  - label: "Language Card Citation Procedure"
    to: /docs/reference/language-card-citation-procedure
    kind: reference
    note: "How every card fact gets its source"
  - label: "Trading Cards"
    to: /trading-cards
    kind: card
    note: "The cards rendered from this schema"
  - label: "Supported Languages"
    to: /docs/reference/supported-languages
    kind: reference
  - label: "Morphology"
    to: /glossary#term-morphology
    kind: glossary
---

import CardSpecExample from '@site/src/components/CardSpecExample';

# Spécification de la Fiche Langue

> **Source unique de vérité.** Ce document définit la structure canonique de chaque carte de langue. Une carte n'affirme que ce qu'une source citée affirme : un champ qu'aucune source n'affirme est **omis, et non nul** — un champ manquant signifie « aucune source ne s'est prononcée », jamais « il n'y a rien à savoir ». Le schéma vérifiable par machine est fourni en tant que `shared/schemas/language-card.schema.json` dans le paquet npm, et l'[exemple canonique ci-dessous](#canonical-template) est généré à partir du corpus en direct à chaque compilation du site, de sorte que cette page ne peut pas s'écarter des cartes qu'elle décrit.

## La reconstruction de l'atlas de 2026-08 — ce qui a changé dans ce schéma

Le corpus de cartes est désormais un **résultat de compilation** : chaque carte est projetée à partir d'un stockage d'instantanés en amont épinglés, et reconstruite — jamais éditée — lorsqu'un fait change. Quatre éléments concernant la structure ont changé avec cette reconstruction :

1. **Les champs contestés comportent une enveloppe d'attribution.** Lorsque les sources citées sont véritablement en désaccord, le champ n'est pas une valeur simple mais `{"agreement": "...", "consensus": <value?>, "values": [{"value": ..., "source": "..."}]}`. This applies to `name`, `classification.family`, `speakerEstimates`, `endangerment`, et tout champ qu'une nouvelle source rend contesté. Les consommateurs doivent lire les cartes via l'adaptateur publié (`normalizeCard()` dans le paquet npm) plutôt que de supposer des valeurs simples — `display()` résout une enveloppe en sa valeur convenue et ne renvoie délibérément rien en cas de véritable litige plutôt que d'élire un vainqueur.

2. **Champs renommés.** `endonym` a remplacé `nativeName` · `codeAliases` a remplacé `aliases` · `scripts[]` (toutes les écritures attestées) a remplacé le champ simple `script`, l'écriture principale étant dérivée de l'étiquette BCP 47 maximale de la carte · `endangerment` (l'évaluation de chaque source, sur la propre échelle de cette source) a remplacé l'objet unique `vitality` · `isoLanguageType` et `isoScope` portent désormais les propres mots de la norme ISO 639-3 (« Living », « Macrolanguage ») plutôt que des initiales. Nouveaux champs : `modality` (« spoken »/« signed », dérivé de l'ascendance de Glottolog), `glottologBucket` (les catégories non généalogiques de Glottolog, maintenues hors de l'emplacement de la famille), `locale`/`localeScoped`.

3. **Les champs non affirmés sont omis, et non nuls.** Un champ qu'aucune source n'affirme est absent de la carte. La règle précédente (« chaque carte DOIT contenir chaque champ de premier niveau, même s'il est nul ») est retirée : une valeur vide sur une surface publique est interprétée comme une affirmation qu'il n'y a rien à savoir, ce qui n'est pas la même chose que de ne pas avoir cherché.

4. **Les cartes de paramètres régionaux (locales) existent.** Aux côtés des cartes de langue, les projections de paramètres régionaux (`fra-CA`, `cmn-Hant`) portent les faits de leur langue résolus pour un territoire ou une écriture, identifiés par un bloc `locale: {language, region, script}`. Un paramètre régional n'est pas une langue : excluez les paramètres régionaux des décomptes de langues grâce à ce bloc.

## Principes de Conception

1. **Tout sourcer.** Chaque affirmation factuelle remonte à une source primaire nommée et versionnée. Les affirmations non sourcées sont des affirmations invérifiables. La carte `_fieldSources` (et les annotations `source` par champ dans les sous-objets) rendent la provenance explicite.

2. **Préserver les désaccords.** Lorsque les autorités sont en désaccord (une source indique 50 000 locuteurs, une autre 20 000), la carte stocke *les deux* avec l'attribution de la source — la structure en enveloppe ci-dessus. Nous ne faisons pas de moyenne, ne résolvons pas et ne prenons pas parti. Les utilisateurs peuvent naviguer dans la nuance.

3. **Absent signifie non affirmé.** Un champ manquant signifie qu'aucune source n'affirme de valeur. Lorsqu'une propriété ne s'applique véritablement pas (par exemple, le genre grammatical pour une langue qui n'en a pas), la valeur citée le dit explicitement plutôt que d'être vide.

4. **Reconstruit, jamais corrigé.** Les cartes sont projetées à partir de sources épinglées par une compilation déterministe. Un défaut factuel est corrigé au niveau de son gestionnaire de source et le corpus est reconstruit — aucune modification sur place, aucune couche d'enrichissement par fusion uniquement.

---

## Architecture à Trois Couches

| Couche | Localisation | Objectif |
|-------|----------|---------|
| **Fiches langue** | `shared/language-cards/<code>.json` | Configuration par langue : identité, classification, ressources, tout |
| **Fiches genre** | `shared/language-cards/genera/<genus>.json` | Propriétés d'exécution partagées pour les langues connexes (curées, non auto-générées) |
| **Arbre des langues** | `shared/language-cards/language-tree.json` | Hiérarchie Glottolog complète — données de référence pour l'interface Lab et la découverte de langues |

---

## Modèle d'Héritage

> **Largement historique depuis la reconstruction de l'atlas.** Aucune carte de langue sur le disque ne porte plus `extends` — chaque carte est entièrement matérialisée par la compilation, car la prose héritée n'était pas citable (une affirmation au niveau de la famille portait une adresse au niveau de la langue). Le mécanisme lui-même survit à un seul endroit : le paquet hors ligne du paquet npm fournit les cartes de paramètres régionaux sous forme de deltas `extends` compacts par rapport à leur langue, résolus par la même fusion décrite ici.

Lorsqu'une fiche définit `"extends": "family-dravidian"`, l'exécution fusionne la fiche parent
dans l'enfant en utilisant `_deepMerge()` (dans `lib/registers.js`). Cela permet aux fiches genre de définir des registres partagés, des systèmes de formalité et des conseils de genre qui
s'écoulent vers toutes les langues membres — sans dupliquer les données sur des centaines de
fiches individuelles.

### Sémantique de Fusion

| Valeur enfant | Comportement | Pourquoi |
|-------------|----------|-----|
| `null` | Hériter du parent | `null` signifie « je ne définis pas ceci » — la valeur du parent s'écoule |
| Non-null | Remplacer le parent | Les données de l'enfant sont plus spécifiques — ont priorité |
| Objet imbriqué | Fusion récursive | Les champs enfants remplacent, les champs parents sont préservés |
| Tableau | Remplacer entièrement | Les tableaux ne fusionnent pas élément par élément — le tableau enfant gagne |

### Champs d'Identité (Jamais Hérités)

Certains champs appartiennent à la fiche elle-même et ne doivent JAMAIS être hérités d'un parent :

```
code, extends, _migration, aliases, iso639_1, iso639_3
```

Même si une fiche parent définit `aliases: ["macro-code"]`, une fiche enfant n'héritera PAS
de ces alias. Ces champs sont toujours les propres valeurs de l'enfant (y compris
`null` s'il n'est pas défini).

**Pourquoi :** Sans cette règle, chaque langue crie hériterait `aliases: ["cre"]`
du parent macrolangue, rendant chaque variété un alias de la macro.

### Exemple : Comment une Fiche Crie se Résout

```
┌───────────────────────┐
│  family-algic.json    │  formality: null, registers: null
│  (no registers)       │
└──────────┬────────────┘
           │ extends
┌──────────┴────────────┐
│  genus-cree.json      │  formality: { system: "obviative-animate", ... }
│  (sourced registers)  │  registers: { formal: {...}, informal: {...} }
└──────────┬────────────┘
           │ extends
┌──────────┴────────────┐
│  crk.json             │  code: "crk", extends: "genus-cree"
│  (Plains Cree)        │  formality: null → inherits from genus-cree
│                       │  registers: null → inherits from genus-cree
│                       │  script: "Cans"  → own value, no inheritance
│                       │  code: "crk"     → identity field, never inherited
└───────────────────────┘
```

À l'exécution, `getLanguageCard("crk")` retourne un objet fusionné avec les registres de genus-cree + les propriétés de family-algic (le cas échéant) + l'identité et les métadonnées propres de crk.

### Modèle de Fiche Genre

Les fiches genre vivent dans `shared/language-cards/genera/` et définissent les propriétés partagées
pour un groupe de langues. Elles suivent le même schéma que les fiches régulières mais avec
des conventions différentes :

```jsonc
{
  // Identity — genus cards use a prefixed code, NOT an ISO 639-3 code
  "code": "genus-cree",           // "genus-", "family-", or "macrolanguage-" prefix
  "name": "Cree Languages",      // Human-readable group name
  "extends": "family-algic",     // Genus cards can extend family cards (chaining)

  // Formality — shared across the group, sourced from typological databases
  "formality": {
    "system": "obviative-animate",
    "description": "Cree languages use an obviative/proximate system...",
    "default": "formal",
    "source": "WALS 37A, 38A + Wolfart 1973"
  },

  // Registers — shared presets, if the group shares a formality system
  "registers": {
    "formal": {
      "label": "Formal (Proximate)",
      "description": "...",
      "prompt": "...",
      "isDefault": true
    },
    "informal": {
      "label": "Informal",
      "description": "...",
      "prompt": "..."
    }
  },

  // Gender — shared grammatical gender behavior
  "gender": {
    "grammatical": false,       // Cree doesn't have grammatical gender
    "inclusiveGuidance": null   //   so no inclusive guidance needed
  },

  // Everything else is null — individual cards provide their own
  // classification, geography, resources, etc.
  "classification": null,
  "methodSupport": null,
  // ...
}
```

**Règle clé :** Les fiches genre ne doivent contenir QUE les données véritablement partagées dans
l'ensemble du groupe et sourcées à partir de références faisant autorité. Si un système de formalité
varie entre les membres, il appartient aux fiches individuelles, pas au genre.

## Exemple canonique \{#canonical-template}

> **Généré, non rédigé.** Tout ce qui se trouve dans cette section est dérivé du corpus en direct au moment de la compilation : la carte complète `crk` (Cri des plaines), octet par octet, plus un extrait de paramètre régional `fra-CA`. Lorsque le corpus est reconstruit, la compilation suivante du site redérive cette page. Il ne reste aucun modèle maintenu manuellement susceptible de devenir obsolète — le précédent avait dérivé d'une génération entière de schéma par rapport aux cartes et a été retiré le 16-08-2026.

L'exemple montre la **structure sur le disque** — ce que vous obtenez si vous ouvrez le fichier. Les consommateurs doivent toujours lire les cartes via l'adaptateur publié (`normalizeCard()` dans le paquet npm) : il résout les enveloppes, fait le pont avec les noms d'avant la transition, et dérive les valeurs destinées uniquement à l'affichage (écriture principale, niveau de vitalité) que la carte brute ne porte délibérément pas.

Ce qu'il faut remarquer lors de la lecture :

1. **Enveloppes d'attribution.** `name`, `classification.family`, `endangerment`, `speakerEstimates`, `endonym`, `bcp47FullTag`, et `politenessDistinction` portent chacun `{agreement, consensus?, values: [{value, source}]}`, every value attributed to its source. `endangerment` a `"agreement": "incommensurable"` : ses sources évaluent sur des échelles différentes, de sorte que chaque valeur nomme son `scale` au lieu d'être convertie sur celle d'un vainqueur.

2. **Omis signifie non affirmé.** La carte n'a pas de `iso639_1` (le cri des plaines n'a pas de code ISO 639-1) et pas de `phonologicalInventory` (aucune source ingérée n'en affirme un) — ces champs sont simplement absents, jamais `null` ou `[]`.

3. **La provenance est une couche de premier ordre.** `_fieldSources` mappe chaque champ à la ou aux sources qui l'ont affirmé, avec `champollion-derived-v1` marquant les valeurs calculées par Champollion. `_card` estampille le type, l'identifiant, la révision de la carte, et quels champs la voie de correction peut toucher ; `_atlas` estampille la version du corpus.

4. **Aucun résultat d'exécution.** Rien sur la carte n'est un score mesuré de résultat de méthode — chrF, les taux d'acceptation FST, et leurs semblables sont des résultats d'exécution indexés par (méthode, jeu de données, métrique) et se trouvent dans le classement. La carte affirme uniquement que les ressources *existent* (`resources`, `lexicalResources`, `methodSupport`).

<CardSpecExample variant="language" />

### Une carte de paramètre régional est une projection, pas une langue \{#locale-card-example}

À côté des cartes de langue se trouvent les cartes de paramètres régionaux (`fra-CA`, `cmn-Hant`) : les faits d'une langue **résolus pour un territoire ou une écriture**, identifiés par leur bloc `locale` — jamais par la forme du code. Une carte de paramètre régional hérite des faits de sa langue, résout ceux dont la portée est l'écriture et le territoire (`script`, `localeScoped`), et n'est **pas une langue** : excluez les cartes de paramètres régionaux de chaque décompte de langues et de chaque liste par langue grâce à ce bloc `locale`.

<CardSpecExample variant="locale" />

---

## Référence des champs \{#field-reference}

Deux conventions s'appliquent à chaque tableau ci-dessous :

- **« enveloppe »** désigne une enveloppe d'attribution — `{agreement, consensus?, values: [{value, source, note?, scale?}]}` — portant l'affirmation de *chaque* source. Un champ répertorié comme `envelope` peut apparaître comme une valeur simple sur les cartes où une seule source s'exprime (par exemple, les languoïdes exclusifs à Glottolog portent un `name` simple) ; les consommateurs doivent gérer les deux, ce que fait l'adaptateur publié.
- Aucun champ n'est requis au-delà de `code` et `name` ; tout le reste est **omis lorsqu'aucune source ne l'affirme**. La ou les sources affirmant chaque champ sont enregistrées par carte dans `_fieldSources`, de sorte que les tableaux décrivent le *type* de source plutôt que d'épingler des versions qui dériveraient.

### § 1. Champs d'Identité

| Champ | Structure | Notes |
|-------|-------|-------|
| `code` | `string` | **Requis.** L'identifiant de la carte et le nom du fichier. ISO 639-3 pour les cartes de langue (`crk`) ; les languoïdes exclusifs à Glottolog portent leur glottocode ; les cartes de paramètres régionaux portent un code de paramètre régional (`fra-CA`). |
| `name` | enveloppe | **Requis.** Nom de référence en anglais (registre ISO 639-3, LinguaMeta, Glottolog). |
| `endonym` | enveloppe | A remplacé `nativeName`. Ce que les locuteurs appellent la langue, dans la langue (LinguaMeta, Wikidata). Absent lorsqu'aucune source n'en affirme un — un endonyme n'est jamais inventé ou translittéré par nos soins. |
| `alternateNames` | `string[]` | Autres noms anglais attestés. |
| `iso639_1` | `string` | Présent uniquement lorsqu'un code ISO 639-1 à deux lettres existe (`fra` → `"fr"`). |
| `isoScope` | `string` | Les propres mots de la norme ISO 639-3 — `"Individual"`, `"Macrolanguage"`, `"Special"` (a remplacé les initiales `"I"`/`"M"`/`"S"`). |
| `isoLanguageType` | `string` | A remplacé `isoType`. Les propres mots de la norme ISO 639-3 — `"Living"`, `"Extinct"`, `"Ancient"`, `"Historical"`, `"Constructed"`. |
| `macrolanguage` | `string` | La macrolangue à laquelle cette langue appartient (`crk` → `"cre"`). Mappages de macrolangues ISO 639-3. |
| `macrolanguageMembers` | `string[]` | Sur les cartes de plateformes de macrolangues : les codes des membres individuels (`nor` → `["nno", "nob"]`). |
| `canonicalisedMembers` | enveloppe | Sur les cartes de macrolangues : les membres dont les étiquettes sont intégrées par les registres BCP 47 dans l'étiquette de cette macrolangue (table d'alias CLDR + langtags SIL, chacun attribué). |
| `supersededCodes` | `string[]` | Codes ISO 639-3 retirés que SIL dirige désormais vers cette langue — enregistrés sur le successeur afin que les corpus publiés sous un ancien code soient toujours résolus. |
| `codeAliases` | `string[]` | A remplacé `aliases`. Identifiants au niveau du code qui se résolvent vers cette carte. |
| `bcp47` | `string` | L'étiquette BCP 47 de la langue telle qu'affirmée (LinguaMeta). |
| `bcp47Tag` | enveloppe | Dérivé par Champollion : l'étiquette RFC 5646 (le code ISO 639 le plus court l'emporte). |
| `bcp47FullTag` | enveloppe | La forme maximale langue–écriture–région (likelySubtags CLDR + langtags SIL). L'adaptateur dérive l'**écriture principale** à partir de cette étiquette. |
| `modality` | `string` | `"spoken"` ou `"signed"`, dérivé de l'ascendance de Glottolog. L'écriture est un attribut d'orthographe, pas une modalité — une langue non écrite est toujours entièrement parlée ou signée. |
| `locale` | `object` | **Cartes de paramètres régionaux uniquement.** `{language, region, script, publishedTag, source, note}` — L'identité du paramètre régional. Excluez les cartes de paramètres régionaux des décomptes de langues grâce à ce bloc, jamais par la forme du code. |
| `localeScoped` | `object` | Cartes de paramètres régionaux uniquement : valeurs résolues pour le territoire/l'écriture du paramètre régional (par ex. `scriptName`, `cldrOfficialStatus`). |

### § 2. Champs de Classification

| Champ | Structure | Notes |
|-------|-------|-------|
| `glottocode` | `string` | L'identifiant de Glottolog pour ce languoïde (`crk` → `"plai1258"`). Les languoïdes exclusifs à Glottolog — les langues que Glottolog enregistre mais pas la norme ISO 639-3 — utilisent le glottocode comme `code` de leur carte. |
| `classification` | `object` | Conteneur pour les champs de placement ci-dessous. Chacun est sourcé indépendamment et omis indépendamment — un isolat, ou une langue classée dans une catégorie Glottolog, ne porte légitimement qu'une partie de cet objet. |
| `classification.family` | enveloppe | La famille de premier niveau affirmée par chaque autorité de classification. Glottolog et WALS sont des taxonomies distinctes qui ne sont pas toujours d'accord, les deux sont donc conservées et attribuées. La règle de lint R5 vérifie la valeur Glottolog à l'intérieur de l'enveloppe par rapport au propre arbre de Glottolog : WALS peut être en désaccord avec Glottolog, mais Glottolog ne peut pas être mal cité. Les isolats ne portent aucune famille du tout. |
| `classification.familyGlottocode` | `string` | Glottocode de cette famille de premier niveau (`crk` → `"algi1248"`). |
| `classification.genus` | `string` | Nœud de classification intermédiaire de WALS (`crk` → `"Algonquian"`). Un concept WALS, et **non** un concept Glottolog — Glottolog publie un arbre de profondeur arbitraire sans niveau de genre — il n'est donc présent que là où WALS code la langue. |
| `classification.ancestry` | `string[]` | Chemin de descendance de Glottolog sous forme de glottocodes ancêtres, la racine en premier (`["algi1248", …, "plai1264"]`). L'ordre **est** l'affirmation : il s'agit d'un chemin, jamais d'un ensemble classé par ordre alphabétique. |
| `classification.glottologBucket` | `string` | Catégories non généalogiques de Glottolog — `"Artificial Language"`, `"Pidgin"`, `"Mixed Language"`, `"Speech Register"`, `"Unclassifiable"`, `"Unattested"`. Maintenues hors de l'emplacement de la famille car une catégorie classe par type, et non par descendance : une carte avec une catégorie n'a pas de famille, et c'est le résultat honnête. |
| `isIsolate` | `boolean` | Indique si Glottolog classe cette langue comme un isolat. |

La carte d'avant la transition portait également un `genusGlottocode`. Il est retiré en même temps que l'erreur de catégorie qui l'a produit : le genre est le concept de WALS, et l'habiller d'un identifiant Glottolog affirmait un nœud d'arbre que Glottolog n'a pas. La hiérarchie Glottolog est portée par `ancestry` à la place.

### § 3. Champs de Géographie

| Champ | Structure | Notes |
|-------|-------|-------|
| `macroarea` | `string` | Macro-zone de Glottolog — `"Africa"`, `"Australia"`, `"Eurasia"`, `"North America"`, `"Papunesia"` ou `"South America"`. |
| `coordinates` | `object` | `{lat, lng}` — Point représentatif de Glottolog. Un point, pas un territoire : il place la langue sur une carte et n'affirme rien sur l'étendue ou les frontières. |
| `countries` | `string[]` | Codes ISO 3166-1 alpha-2 des pays que Glottolog associe à la langue (`["CA", "US"]`). |
| `cldrOfficialStatus` | `string` | Un statut officiel qu'un territoire accorde à la langue, tel que CLDR l'enregistre (porté via LinguaMeta) — `"Official"`, `"Regional official"`. Sur une carte de paramètre régional, le statut résolu pour le territoire de *ce paramètre régional* se trouve dans `localeScoped.cldrOfficialStatus`. |

Le tableau `regions` d'avant la transition (répartitions des locuteurs par pays avec codes administratifs) et `arealContext` (appartenance à un Sprachbund) sont retirés : aucune source ingérée ne les affirme, et la curation non sourcée ne survit pas à une reconstruction. Les affirmations de locuteurs au niveau régional pourront revenir le jour où une source citable atterrira dans le pipeline ; d'ici là, l'absence est l'état honnête.

### § 4. Champs de Système d'Écriture

| Champ | Structure | Notes |
|-------|-------|-------|
| `scripts` | `string[]` | A remplacé le champ simple `script`. **Tous** les codes ISO 15924 attestés (`crk` → `["Cans", "Latn"]`), non ordonnés — ne lisez jamais `scripts[0]` comme « l' » écriture. L'écriture principale est dérivée par l'adaptateur à partir de l'étiquette maximale de `bcp47FullTag`. |
| `scriptNames` | `string[]` | Noms d'affichage dérivés par Champollion pour `scripts[]` (`"Unified Canadian Aboriginal Syllabics"`). |
| `textDirection` | `string` | A remplacé `dir`. Les propres mots de la source — `"left-to-right"` / `"right-to-left"` (était `"ltr"`/`"rtl"`). |
| `suppressScript` | `string` | Suppress-Script de CLDR : l'écriture si canonique pour la langue que les étiquettes BCP 47 l'omettent (`fra` → `"Latn"`). |
| `script` | `string` | **Cartes de paramètres régionaux uniquement** : l'écriture résolue pour le paramètre régional (`fra-CA` → `"Latn"`, `cmn-Hant` → `"Hant"`). Les cartes de langue ne portent aucun champ d'écriture simple. |

Une langue sans écriture attestée n'a tout simplement **aucun champ `scripts`** — l'absence signifie qu'aucune source n'a affirmé d'écriture, et non une affirmation selon laquelle la langue est « non écrite ». (Les langues des signes constituent le groupe le plus important de ce type : aucun système de notation n'a d'adoption standard par la communauté pour l'alphabétisation quotidienne.)

### § 5. Champs Démographiques et de Vitalité

| Champ | Structure | Notes |
|-------|-------|-------|
| `speakerEstimates` | enveloppe | L'estimation de chaque source, attribuée. Les valeurs peuvent être des décomptes exacts ou les propres chaînes de plages de la source (`"10000-99999"`), avec les mises en garde de la source portées textuellement dans `note`. `"agreement": "conflicting"` est courant — montrer le conflit *est* le produit ; rien n'est moyenné ou élu. |
| `endangerment` | enveloppe | A remplacé l'objet unique `vitality`. L'évaluation de chaque source **sur la propre échelle de cette source** — chaque valeur porte un champ `scale`, et `"agreement": "incommensurable"` est la norme car les vocabulaires ELCat, Glottolog AES et LinguaMeta ne sont pas des traductions les uns des autres. L'adaptateur dérive un *niveau de vitalité* d'affichage à partir d'une seule source nommée selon l'ordre d'autorité déclaré ; ce niveau est uniquement destiné à l'affichage — l'ensemble complet attribué reste sur la carte. |

Un décompte de locuteurs *affiché* n'importe où dans Champollion doit correspondre à l'une des entrées `speakerEstimates` citées ou porter une provenance `champollion-derived` explicite — appliqué par les règles d'intégrité des cartes.

### § 5.5 Champs de Documentation et de Présence Numérique

| Champ | Structure | Notes |
|-------|-------|-------|
| `documentation` | `object` | A remplacé `documentationDepth`. L'enregistrement par Glottolog de la qualité de la description de la langue, dans les propres termes de Glottolog. |
| `documentation.medLevel` | `string` | Le niveau de description la plus étendue (Most Extensive Description) de Glottolog, textuellement — `"long grammar"`, `"grammar"`, `"grammar sketch"`, `"phonology"`, `"wordlist"`. |
| `documentation.medSourceId` | `string` | La clé bibliographique de cette description la plus étendue dans le catalogue de référence de Glottolog. |
| `documentation.firstDocumented` | `number` | La propre colonne de première année de documentation de Glottolog, textuellement — déplacée ici depuis le champ de premier niveau d'avant la transition. Présent sur seulement quelques centaines de langues, et la rareté est en soi une information utile. |
| `documentation.lastDocumented` | `number` | La colonne de dernière année de documentation de Glottolog, textuellement — présente sur environ un millier de langues. |
| `wikipediaEdition` | `object` | A remplacé `digitalPresence`. `{site, url, name}` — une édition Wikipédia ouverte existe dans cette langue (`afr` → `af.wikipedia.org`). Existence uniquement, délibérément **sans décompte d'articles** : plusieurs éditions sont largement générées par des bots, et une édition énorme n'est pas « mieux documentée » qu'une petite dans un sens utilisable par un traducteur. |
| `dialectCount` | `number` | La propre colonne `child_dialect_count` de Glottolog, textuellement — dialectes enfants directs uniquement, pas l'ensemble du sous-arbre. Il s'agit de l'affirmation de Glottolog, pas de notre arithmétique : une règle antérieure l'estampillait `champollion-derived` et faisait en sorte que des milliers de cartes s'attribuent le mérite du décompte de Glottolog. |

Le reste du bloc `digitalPresence` d'avant la transition (heures Common Voice, décomptes de phrases Tatoeba) est retiré jusqu'à ce que ces sources atterrissent dans le pipeline — le corpus Tatoeba lui-même apparaît déjà là où il doit être, en tant que corpus parallèle sous `resources.corpora` (§ 9).

### § 6. Champs de Formalité, Registre et Genre

Le corpus projeté porte exactement un champ ici — le fait cité :

| Champ | Structure | Notes |
|-------|-------|-------|
| `politenessDistinction` | enveloppe | Indique si la langue grammaticalise la politesse dans les formes de la deuxième personne. Attribué à travers Grambank GB415 (binaire : absent/présent) et WALS 45A (quatre niveaux : aucune distinction / binaire / multiple / pronoms évités). Ce sont des échelles différentes, donc chaque valeur nomme son `scale` et l'enveloppe les signale comme **incommensurables** plutôt que comme un désaccord. |

**Le système de registres est une configuration, pas un fait de carte.** Le corpus d'avant la transition stockait la prose `formality` et les invites `registers` sur près de mille huit cents cartes chacune — presque tout étant généré à partir des deux mêmes sources ci-dessus, puis porté comme s'il s'agissait d'une configuration organisée manuellement. L'atlas conserve le fait ; les surfaces de configuration — `formality`, `registers`, `gender`, `codeSwitching` — font toujours partie du **schéma organisé du paquet npm** (`language-card.schema.json`), résident sur les cartes de plateformes de genres/familles organisées, et atteignent la CLI via la fusion `extends` du système de registres décrite dans le [Modèle d'héritage](#inheritance-model). Ce ne sont pas des champs d'atlas projetés : aucune carte du corpus projeté ne les porte, et la compilation de l'atlas ne les écrira jamais. Les directives de la section [Rédiger de bons préréglages de registres](#writing-good-register-presets) s'appliquent à cette voie organisée.

### § 7. Champs de Profil Linguistique

| Champ | Structure | Notes |
|-------|-------|-------|
| `typologicalProfile` | `object` | Une clé par caractéristique typologique ingérée, chaque valeur étant le propre codage de la source, chaque clé étant présente uniquement là où la source code cette langue. Les booléens proviennent des caractéristiques Grambank, les chaînes de catégories des chapitres WALS ; le registre de décisions nomme le paramètre exact en amont pour chaque clé. |
| `phonologicalInventory` | `object` | `{consonants, vowels, tones, totalPhonemes, hasTone}` — décomptes calculés par Champollion sur un inventaire PHOIBLE cité (PHOIBLE publie une ligne par segment et n'affirme aucun décompte), de sorte que chaque valeur porte la provenance `champollion-derived`. **PHOIBLE est la seule autorité en matière de tons** (lint R1) : Grambank n'a pas de caractéristique de ton, et rien d'autre sur la carte ne peut affirmer la tonalité. |
| `numeralSystem` | `object` | `{base}` — la base numérale, textuellement d'après *Numeral Systems of the World's Languages* de Chan (`"decimal"`, `"quinary-vigesimal"`, `"body tally"` ; près d'une centaine de valeurs distinctes). Absent lorsque la propre colonne de base de Chan est vide — environ la moitié des langues étudiées — car un générateur précédent remplissait le vide avec `"decimal"` et inventait des valeurs pour deux mille langues. |
| `pluralCategories` | `string[]` | Les catégories de pluriel cardinal que CLDR indique pour cette langue — l'arabe distingue `["zero", "one", "two", "few", "many", "other"]`, le français trois d'entre elles, le chinois une. Lu à partir des clés du propre ensemble de règles de CLDR, il s'agit donc de l'affirmation de CLDR, pas de notre dérivation. A remplacé `rules.plurals.categories` d'avant la transition ; un pipeline i18n en a besoin pour savoir combien de formes plurielles un message doit fournir. |

Les clés `typologicalProfile` actuellement projetées, avec leurs paramètres en amont :

- **Chapitres WALS** (chaînes de catégories, les propres étiquettes de valeurs de WALS) : `fusion` (20A), `verbSynthesis` (22A), `affixPreference` (26A), `reduplication` (27A), `genderCount` (30A), `caseCount` (49A), `wordOrder` (81A), `subjectVerbOrder` (82A), `verbalAlignment` (100A), `negationOrder` (143A)
- **Caractéristiques Grambank** (booléens) : `hasGenderInPronouns` (GB030), `hasSexBasedGender` (GB051), `hasNumeralClassifiers` (GB057), `hasCoreCase` (GB070), `hasObliqueCase` (GB071), `marksPastTense` (GB083), `marksPresentTense` (GB084)

Les blocs `linguisticChallenges` et `contactInfluences` d'avant la transition ne sont pas projetés — la prose issue de recherches sans source ingérée reste sur le schéma organisé du paquet npm, tout comme les surfaces de registres au § 6 (les tableaux [Types d'influence de contact](#contact-influence-types) ci-dessous servent cette voie). Le bloc `rules` est retiré : ce qui y était citable survit en tant que `pluralCategories` ici et dans les champs d'écriture au § 4.

### § 8. Champs Encyclopédiques

Retiré des cartes. Les blocs `encyclopedic` (essais sur l'histoire et les dialectes, liens institutionnels), `culturalAphorism` et `varieties` d'avant la transition étaient de la prose organisée manuellement au niveau de la carte, que la reconstruction supprime par conception. Les faits d'appartenance que `varieties` esquissait sont désormais des champs d'identité cités (§ 1 `macrolanguageMembers` et `canonicalisedMembers`), et la couverture des outils par variété trouve sa réponse dans la propre carte de chaque membre (`methodSupport`, `resources`). Un dicton représentatif pourra revenir via une voie de contribution communautaire avec consentement et citation ; il ne reviendra pas en tant que champ de carte non cité.

### § 9. Champs de Ressources Numériques

Tout ce qui se trouve dans cette section affirme **l'existence et la capacité, jamais la qualité** : qu'une ressource est publiée et qui la publie — jamais qu'elle est bonne, complète ou utilisable, et jamais un score mesuré. Tout score mesuré de résultat de méthode est un résultat d'exécution indexé par (méthode, jeu de données, métrique), se trouve dans le classement, et est interdit sur les cartes (lint R3).

| Champ | Structure | Notes |
|-------|-------|-------|
| `resources` | `object` | Conteneur : chaque sous-champ ci-dessous est une liste sourcée indépendamment, omise lorsqu'aucune source ne l'affirme. |
| `resources.fsts` | `object[]` | Analyseurs morphologiques à états finis publiés : `{name, url, publisher, license, licenceEstablished, archived}`. La licence voyage avec chaque entrée plutôt que d'être supposée uniforme dans un catalogue — les limites de licence nécessitent les termes réels. Pour une langue polysynthétique, un FST est souvent la seule vérification structurelle qui existe. |
| `resources.corpora` | `object[]` | Corpus parallèles attestant cette langue : `{corpus, corpusId, pairCount, topPartners, alignmentPairsTotal, …}`. Déclaré par **paires**, car un corpus parallèle n'atteste une langue qu'à travers une paire — « couvre le swahili » sans dire par rapport à quoi répond à une question que personne n'a posée. Existence et taille, jamais qualité. |
| `resources.monolingualCorpora` | `object[]` | Corpus monolingues — maintenus séparés de `corpora` afin que « a un corpus » ne signifie jamais deux choses incomparables. |
| `resources.speech` | `object[]` | Ressources vocales publiées. Existence uniquement. |
| `resources.keyboards` | `object[]` | Dispositions de clavier publiées. Simple mais fondamental : pour une orthographe nécessitant des caractères qu'aucune disposition standard ne produit, une disposition fait la différence entre le fait que la langue puisse être tapée ou non. |
| `resources.typology` | `object[]` | Jeux de données typologiques qui *codent* cette langue, avec l'étendue : `{dataset, featuresCoded, datasetFeatureTotal}`. Existence et étendue, jamais contenu — ce que dit une caractéristique reste hors de la carte jusqu'à ce qu'une personne écrive la carte de paramètres qui l'accepte (celles acceptées font surface dans `typologicalProfile` au § 7). Les décomptes de caractéristiques sont notre arithmétique, ils portent donc la provenance `champollion-derived`. |
| `lexicalResources` | `object` | Conteneur pour les faits d'existence lexicale. |
| `lexicalResources.datasets` | `object[]` | Listes de mots publiées avec leur couverture : `{dataset, forms, concepts, release}`. |
| `lexicalResources.dictionaries` | `object[]` | Dictionnaires publiés — existence, jamais qualité, et **dirigés** là où l'éditeur les dirige : un dictionnaire qui va dans un sens est une ressource différente de celui qui va dans l'autre. Les entrées n'ont pas une structure uniforme (un jeu de données CLDF connaît son nombre d'entrées ; un dépôt connaît sa paire et sa direction) ; chacune nomme sa propre source, et la licence ainsi que l'état archivé voyagent par entrée. |
| `lexicalResources.colexificationConcepts` / `colexifyingForms` | `number` | Décomptes calculés par Champollion sur CLICS³ : concepts attestés pour cette langue, et formes qui correspondent à deux concepts distincts ou plus. `champollion-derived`. |
| `methodSupport` | `object` | Quelles méthodes de traduction couvrent cette langue — capacité, jamais un score. Structure : `{total, byTier, named, truncated}`. L'anglais porte des milliers de liens de méthodes et la langue médiane quelques dizaines, la carte conserve donc la *structure* des preuves — `total` plus les décomptes `byTier` par niveau de confiance (`fetched`, `partially-confirmed`, `model-card-declared`) — et ne nomme que les entrées les plus fortes (chaque `{value, variant, source, confidence}`), avec un plafond. Les **services** de registre sont toujours nommés en entier, au-dessus du plafond, de sorte que l'absence d'un service dans `named` est une vraie réponse ; l'absence d'une entrée de carte de modèle signifie seulement « pas parmi les plus fortes », et chaque lien reste interrogeable dans le stockage de l'atlas. |
| `metricModelSupport` | enveloppe | Modèles de métriques d'évaluation qui publient une couverture de cette langue, avec l'identifiant de modèle qu'un harnais charge (`masakhane/africomet-mtl`). Pilote un comportement réel — la sélection du modèle COMET — et reste une capacité, jamais un score. |

**Intégrés dans les champs ci-dessus :** `keyboardSupport` (→ `resources.keyboards`), `corpusAvailability` (→ `resources.corpora` / `resources.monolingualCorpora`) et `databaseCoverage` (→ `resources.typology` plus `lexicalResources` — une entrée de base de données est désormais un fait de couverture cité avec une étendue, et non un booléen) d'avant la transition.

**Retirés des cartes :** `omt1600`, `evalDatasets`, `pipelineReadiness` et `metricPlugins` — aucun n'est affirmé par une source ingérée, et un niveau de préparation est un jugement, pas une citation.

**Organisés, non projetés :** les surfaces de déclaration de norme d'évaluation (`evalStandard`, `evalMetrics`, `evalPack`) restent dans le schéma organisé du paquet npm. Elles indiquent au harnais d'évaluation quel paquet d'arbitre externe évalue une langue (des arbitres, pas des concurrents — le cœur du harnais ne fournit aucun code d'évaluation spécifique à une langue) ; le harnais les lit sur une carte lorsqu'elles sont présentes, mais aucune carte du corpus projeté ne les porte actuellement, et la compilation de l'atlas ne les écrit pas. Il en va de même pour le bloc `install` que l'installateur FST du harnais lit à partir des entrées `resources.fsts[]` (`get_fst_install_info()` dans `language_cards.py`) : les entrées projetées ne portent que des faits d'existence.

### § 10. Champs de Provenance

| Champ | Structure | Notes |
|-------|-------|-------|
| `_fieldSources` | `object` | Sur chaque carte. Mappe chaque chemin de champ sur la carte (`"classification.family"`, `"coordinates.lat"`) aux identifiants de sources triés qui l'ont affirmé (`["glottolog-v5.3", "wals-v2020.5"]`). Les valeurs calculées par Champollion portent `champollion-derived-v1`. Les identifiants de sources sont versionnés — `grambank-v1.0.3`, `iso639-3-20260715` — de sorte que chaque affirmation remonte à la version exacte qui l'a faite. |
| `coverage` | `object` | Sur chaque carte, et **calculé par le projecteur, non affirmé par une source** : `{sourceCount, componentsPresent, componentsTotal, notAttested}` — combien de sources distinctes parlent de cette langue, combien de composants de la carte portent une valeur sur le nombre total existant à remplir, et combien de valeurs une source a positivement enregistrées comme *absentes* (a cherché et a dit non — un fait différent de n'avoir jamais cherché). C'est ce qui permet à une carte peu fournie de dire **pourquoi** elle l'est au lieu de paraître négligée. |
| `_card` | `object` | Les propres métadonnées de la carte : `{type, id, revision, correctableFields}`. `type` est `"language"` ou `"locale"` (les cartes de méthodes et de corpus utilisent le même projecteur) ; `revision` est un hachage de contenu, de sorte que toute modification du contenu de la carte le modifie ; `correctableFields` liste les chemins de champs portant des valeurs — les champs que la voie de correction peut toucher. |
| `_atlas` | `object` | `{version}` — l'estampille de version du corpus (`"unreleased"` entre les versions). Délibérément un identifiant de version, et **non** un horodatage de compilation : un horodatage ferait différer deux compilations issues d'épingles identiques selon le calendrier, détruisant la propriété qui permet à quiconque de vérifier l'atlas — mêmes épingles en entrée, mêmes octets en sortie. |

Le bloc de provenance d'avant la transition est retiré en bloc : `dataSources` (remplacé par la carte `_fieldSources` par champ), `supportTier` (un jugement calculé, remplacé par les décomptes neutres `coverage`), `_generated` (l'ensemble du corpus est généré ; l'estampille est `_card.revision` plus `_atlas.version`), `humanReviewed` et `notes` (une curation qui appartient à des voies ayant leurs propres enregistrements), et les champs de premier niveau `firstDocumented`/`lastDocumented` (déplacés dans `documentation` au § 5.5, là où leur source les affirme réellement).

---

## Politique de Code de Langue

Champollion utilise **ISO 639-3** comme identifiant canonique. Les autres codes standards
sont enregistrés comme alias et se résolvent au code ISO 639-3 à l'exécution.

| Priorité | Norme | Exemple | Champ | Utilisation |
|----------|----------|---------|-------|-----|
| 1 (canonique) | ISO 639-3 | `crk` | `code` | Nom de fichier de la carte, clés de configuration, paramètres d'API |
| 2 (alias) | ISO 639-1 | `iu` | `codeAliases[]` | Accepté dans la CLI, résolu en ISO 639-3 |
| 3 (alias) | BCP 47 | `fil` | `codeAliases[]` | Accepté dans la CLI, résolu en ISO 639-3 |
| Référence | Glottocode | `plai1258` | `glottocode` | Classification uniquement, pas pour l'exécution |

**Ordre de résolution :** Lorsqu'un utilisateur fournit un code :
1. Correspondance directe sur `card.code` → trouvé
2. Correspondance sur `card.codeAliases[]` → trouvé, renvoie la carte canonique
3. Correspondance sur `card.iso639_1` → trouvé (solution de repli)
4. Non trouvé → erreur

### Historique de Migration : ISO 639-1 → ISO 639-3

Avant la v8, les noms de fichiers de fiche utilisaient les codes ISO 639-1 lorsqu'ils étaient disponibles (`fr.json`,
`de.json`, `ja.json`). Dans la migration 639-3, toutes les fiches ont été renommées en leurs
équivalents ISO 639-3 :

| Avant | Après | Pourquoi |
|--------|-------|-----|
| `fr.json` | `fra.json` | 639-3 est canonique |
| `de.json` | `deu.json` | 639-3 est canonique |
| `zh.json` | `cmn.json` | Macrolangue → individuelle par défaut |
| `ar.json` | `arb.json` | Macrolangue → Arabe standard moderne |
| `ms.json` | `zsm.json` | Macrolangue → Malais standard |

**Qu'est-il arrivé aux anciens codes ?**
- L'ancien code 639-1 se trouve dans `card.iso639_1`
- L'ancien code 639-1 se trouve dans `card.codeAliases[]` (`fra` → `["fr"]`)
- `resolveCode("fr")` renvoie `"fra"` à l'exécution — rétrocompatible
- Les utilisateurs peuvent toujours écrire `"fr"` dans leur configuration — il se résout de manière transparente

**Ce qui a changé architecturalement :**
- `_deepMerge()` ignore maintenant les valeurs `null` (hérite du parent)
- `_deepMerge()` a maintenant un champ d'identité défini (code, extends, alias jamais hérités)
- `formality.default` est maintenant dérivé des drapeaux de registre `isDefault: true`
- 205 fiches dérivées de Grambank ont reçu une correction structurelle `formality.default`
- 38 fiches genre/famille/macrolangue fournissent des cibles d'héritage

---

## Cas Limites

### Langues des signes
Les langues des signes (par ex., ASE — American Sign Language) sont des langues légitimes avec des codes ISO 639-3. Elles ont une géographie et des décomptes de locuteurs mais :
- `modality` est `"signed"` — l'affirmation positive de la carte sur ce qu'est la langue ; l'absence d'un système d'écriture est un fait distinct
- `scripts` est généralement absent (aucun système de notation n'a d'adoption standard par la communauté), bien que `"Sgnw"` (SignWriting) apparaisse là où une source l'affirme
- `textDirection` est absent
- `linguisticChallenges` doit aborder la grammaire spatiale, les classificateurs, etc.

### Langues anciennes et historiques
Des langues comme le latin (`lat`, isoLanguageType `"Historical"`) et le sanskrit (`san`) sont toujours utilisées dans des contextes spécifiques (liturgiques, académiques) mais n'ont pas de locuteurs natifs :
- `isoLanguageType` porte le propre mot de statut de l'ISO (`"Ancient"`, `"Historical"`, `"Extinct"`) — la carte ne l'atténue ni ne le remplace jamais
- `endangerment` et `speakerEstimates` rapportent ce que les sources citées évaluent réellement, avec les mises en garde textuelles (les décomptes de la communauté L2 restent étiquetés tels que leurs sources les étiquettent)
- `firstDocumented` / `lastDocumented` les situent dans le temps

### Langues construites
L'espéranto (`epo`, isoLanguageType `"Constructed"`), le lojban, etc. :
- `classification` peut être absent — Glottolog classe les langues construites (conlangs) dans une catégorie non généalogique, et la catégorie n'est jamais affichée comme une famille
- `contactInfluences` reflète le matériel source (par ex., l'espéranto s'inspire des langues romanes, germaniques, slaves)
- `endangerment` est inhabituel — communauté de locuteurs en croissance mais pas de patrie d'origine

### Macrolangues
L'arabe (`ara`), le chinois (`zho`), le cri (`cre`), le quechua (`que`) sont des macrolangues qui englobent plusieurs langues individuelles :
- `isoScope: "Macrolanguage"` — une plateforme de navigation, jamais une cible de référence (benchmark)
- `macrolanguageMembers` liste les codes des membres individuels ; `canonicalisedMembers` enregistre quels membres les registres BCP 47 intègrent dans l'étiquette de la macrolangue (chaque registre étant attribué)
- `methodSupport` reflète ce que la *carte de la macrolangue* prend en charge (généralement la variété standardisée)
- Les membres individuels ont leurs propres cartes, portant `macrolanguage` pour renvoyer vers la plateforme

### Langues sans orthographe standardisée
De nombreuses langues (en particulier les langues de tradition orale) n'ont pas de système d'écriture standardisé, ou ont des orthographes concurrentes :
- `scripts`, `scriptNames` et `textDirection` sont absents — aucune source n'a affirmé d'écriture, ce qui n'est pas la même affirmation que « non écrit »
- `notes` doit expliquer la situation orthographique
- `linguisticChallenges` doit noter comment cela affecte la traduction automatique (MT) (par ex., pas de données d'entraînement)

### Diglossie
Les langues comme l'arabe (MSA vs. dialectes) ou le guarani (Jopará vs. guarani pur) :
- `codeSwitching` capture la situation de variété mixte
- `registers` peut offrir des présets pour différents niveaux
- `varieties` peut lister la paire diglossique

---

## Types d'Influence de Contact

| Type | Signification | Exemple |
|------|---------|---------|
| `superstrate` | Langue dominante imposée à une communauté | Français → Anglais (post-1066) |
| `substrate` | Langue native influençant une langue imposée | Celtique → Anglais |
| `adstrate` | Langue voisine avec influence mutuelle | Norrois → Anglais |
| `learned_borrowing` | Emprunts par l'éducation/l'érudition | Latin → Anglais |
| `lexical_borrowing` | Emprunts de vocabulaire directs par contact | Espagnol → Philippin |
| `relexification` | Remplacement de vocabulaire en gros | Portugais → Papiamento |

## Profondeurs d'Influence de Contact

| Profondeur | Signification |
|-------|---------|
| `light` | Quelques emprunts, impact structurel minimal |
| `moderate` | Vocabulaire significatif dans des domaines spécifiques |
| `heavy` | Vocabulaire omniprésent et certaines caractéristiques structurelles |
| `structural` | Grammaire, syntaxe et phonologie affectées |
| `defining` | Identité centrale façonnée par le contact (créoles, langues mixtes) |

---

## Rédiger de Bons Présets de Registre

**Bons présets d'invite :**
- Nommer explicitement la caractéristique de formalité (par ex., « 해요체 », « forme vous », « forme siz »)
- Expliquer le pronom ou la forme verbale spécifique à utiliser
- Donner un contexte pour quand ce registre est approprié
- Mentionner les considérations de script si applicable

**Ne pas** mettre les conseils d'inclusion de genre dans l'invite de preset. Les conseils de genre
appartiennent à `card.gender.inclusiveGuidance` — ils sont injectés séparément.

```
❌ Bad:  "Standard Thai. Professional register."
✔ Good: "Professional Thai. Use คุณ (khun) for second person, เรา (rao)
         for first person when needed. Clear, concise phrasing
         appropriate for digital interfaces."
```

### Convention de Nommage des Presets

Les clés de preset doivent être descriptives et en minuscules avec tirets :
- Langues T-V : `formal-vous`, `informal-tu`, `formal-Sie`, `casual-du`
- Niveaux de discours : `polite-haeyo`, `formal-hapsyo`, `casual-hae`
- Neutre : `professional`, `neutral-professional`
- Alternance de code : `taglish-professional`, `pure-filipino`

---

## Comment les faits des cartes sont mis à jour

Les cartes sont des **résultats de compilation** — une projection déterministe à partir d'instantanés en amont épinglés. Il n'y a plus de procédure d'enrichissement par carte : la voie du script `enrich-*` exécuté manuellement est retirée, et une modification apportée directement à un fichier de carte est supprimée par la compilation suivante. Pour modifier un fait :

1. **Enregistrer la décision.** Chaque champ correspond à une ligne dans le registre de décisions de la compilation : quel paramètre en amont l'alimente, comment il se projette, et ce que signifie une valeur absente.
2. **Corriger la couche d'ingestion.** Une valeur erronée est un défaut dans le gestionnaire de source (ou une épingle en amont obsolète), jamais quelque chose à corriger sur la carte.
3. **Reconstruire et basculer.** La compilation reprojette chaque carte à partir des instantanés épinglés ; les portes de validation refusent les compilations partielles, les valeurs nulles/vides, et les cartes qui échouent aux règles d'intégrité.

### Gestion des Conflits

Lorsque les sources sont en désaccord :
1. **Les stocker toutes** avec l'attribution de la source — c'est à cela que sert l'enveloppe d'attribution
2. **NE PAS faire de moyenne** ni prendre parti — `consensus` n'apparaît que lorsque les sources sont réellement d'accord
3. **Porter les mises en garde de chaque source** textuellement dans le `note` de cette valeur
4. Une valeur unique pour l'affichage ou le calcul est **dérivée par l'adaptateur** à partir de l'ordre d'autorité déclaré — la carte elle-même conserve l'éventail complet

---

## Validation

Exécutez le linter après toute reconstruction :

```bash
node scripts/lint-language-cards.mjs              # all cards
node scripts/lint-language-cards.mjs --lang crk    # single card
```

### Liste de Contrôle de PR

Lors de la soumission d'une modification qui touche les cartes (rappelez-vous : modifiez la compilation, pas la carte) :

- [ ] Le correctif se trouve dans un gestionnaire d'ingestion ou dans le registre de décisions — aucun fichier de carte n'est édité manuellement
- [ ] Les champs ne portent que des valeurs affirmées par la source — rien n'est rempli avec `null` ou `[]` pour « compléter » une carte
- [ ] `classification` provient de Glottolog (non construit manuellement)
- [ ] La provenance de chaque champ touché atterrit dans `_fieldSources`, les valeurs calculées par Champollion portant la provenance `champollion-derived`
- [ ] Aucun score mesuré de résultat de méthode n'apparaît nulle part sur une carte
- [ ] Le linter et la porte d'intégrité des cartes passent sans erreur

---

## Références Professionnelles

| Standard | Maintenu Par | Notre Utilisation |
|----------|---------------|---------|
| [ISO 639-3](https://iso639-3.sil.org) | SIL International | Codes de langue canoniques, relations de macrolangues |
| [Glottolog](https://glottolog.org) | Institut Max Planck | Classification, coordonnées, endangérment AES |
| [WALS](https://wals.info) | Institut Max Planck | Définitions de genre, caractéristiques typologiques |
| [ISO 15924](https://unicode.org/iso15924/) | Unicode/ISO | Codes de script |
| [CLDR](https://cldr.unicode.org) | Consortium Unicode | Données de locale, règles de pluriel, typographie |
| [Wikidata](https://www.wikidata.org) | Fondation Wikimedia | Comptages de locuteurs, endonymies, données de script |
| [Ethnologue](https://www.ethnologue.com) | SIL International | EGIDS, estimations de locuteurs, DLS |
| [Atlas UNESCO](http://www.unesco.org/languages-atlas/) | UNESCO | Classification d'endangérment |
| [Katig Collective](https://linguistics.upd.edu.ph/the-katig-collective/) | UP Diliman | Capsules de langues philippines |

Voir aussi : [Procédure de Citation de Fiche Langue](/docs/reference/language-card-citation-procedure)
pour des conseils détaillés source par source.
