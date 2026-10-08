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

> **Source unique de vérité.** Ce document définit la structure canonique de
> chaque fiche de langue. Une fiche n'affirme que ce qu'une source citée affirme : un
> champ qu'aucune source n'affirme est **omis, non pas nul** — un champ manquant signifie
> « aucune source ne s'est prononcée », jamais « il n'y a rien à savoir ». Le schéma
> vérifiable par machine est fourni sous la forme `shared/schemas/language-card.schema.json` dans le paquet
> npm, et l'[exemple canonique ci-dessous](#canonical-template) est
> généré à partir du corpus en direct lors de chaque compilation du site, de sorte que cette page ne peut
> diverger des fiches qu'elle décrit.

## La reconstruction de l'atlas d'août 2026 — ce qui a changé dans ce schéma

Le corpus de fiches est désormais un **résultat de compilation** : chaque fiche est projetée à partir d'un magasin
d'instantanés amont épinglés, et reconstruite — jamais modifiée — lorsqu'un fait
change. Quatre aspects relatifs à la structure ont changé avec cette reconstruction :

1. **Les champs contestés comportent une enveloppe d'attribution.** Lorsque les sources citées
   sont véritablement en désaccord, le champ n'est pas une valeur brute mais
   `{"agreement": "...", "consensus": <value?>, "values": [{"value": ...,
   "source": "..."}]}`. This applies to `name`, `classification.family`,
   `speakerEstimates`, `endangerment`, et tout champ qu'une nouvelle source rend
   contesté. Les consommateurs doivent lire les fiches par l'intermédiaire de l'adaptateur publié
   (`normalizeCard()` dans le paquet npm) plutôt que de présumer des valeurs brutes —
   `display()` résout une enveloppe vers sa valeur convenue et ne renvoie
   délibérément rien en cas de litige réel plutôt que de choisir un gagnant.

2. **Champs renommés.** `endonym` a remplacé `nativeName` · `codeAliases`
   a remplacé `aliases` · `scripts[]` (toutes les écritures attestées) a remplacé le champ brut
   `script`, l'écriture principale étant dérivée de l'étiquette BCP 47 maximale
   de la fiche · `endangerment` (l'évaluation de chaque source, sur sa propre
   échelle) a remplacé l'objet unique `vitality` · `isoLanguageType` et
   `isoScope` portent désormais les termes mêmes de l'ISO 639-3 (« Living », « Macrolanguage »)
   plutôt que des initiales. Nouveaux champs : `modality` (« spoken »/« signed », dérivé
   de l'ascendance Glottolog), `glottologBucket` (les catégories non généalogiques de Glottolog,
   tenues à l'écart de l'emplacement de famille), `locale`/`localeScoped`.

3. **Les champs non affirmés sont omis, non nuls.** Un champ qu'aucune source n'affirme est
   absent de la fiche. L'ancienne règle (« chaque fiche DOIT contenir chaque
   champ de premier niveau, même s'il est nul ») est abandonnée : une valeur vide sur une
   surface publique se lit comme l'affirmation qu'il n'y a rien à savoir, ce qui n'est pas la
   même chose que de ne pas avoir cherché.

4. **Les fiches de locale existent.** Aux côtés des fiches de langues, les projections de locale
   (`fra-CA`, `cmn-Hant`) portent les faits de leur langue résolus pour un
   territoire ou une écriture, identifiés par un bloc
   `locale: {language, region, script}`. Une locale n'est pas une langue : excluez les locales des décomptes de langues au moyen de
   ce bloc.

## Principes de Conception

1. **Sourcer l'ensemble des données.** Chaque affirmation factuelle remonte à une source
   primaire nommée et versionnée. Les affirmations non sourcées sont invérifiables. Le
   mappage `_fieldSources` (et les annotations `source` par champ dans les sous-objets)
   rendent la provenance explicite.

2. **Préserver les désaccords.** Lorsque les autorités divergent (une source indique
   50 000 locuteurs, une autre en indique 20 000), la fiche stocke *les deux* avec l'attribution
   de la source — la structure d'enveloppe ci-dessus. Nous ne faisons pas de moyenne, nous ne tranchons pas et ne prenons
   pas parti. Les utilisateurs peuvent appréhender la nuance.

3. **Absent signifie non affirmé.** Un champ manquant signifie qu'aucune source n'affirme de
   valeur. Lorsqu'une propriété ne s'applique véritablement pas (par ex., le genre grammatical
   pour une langue qui n'en possède pas), la valeur citée l'indique explicitement plutôt que
   de rester vide.

4. **Reconstruit, jamais rafistolé.** Les fiches sont projetées à partir de sources épinglées par une
   compilation déterministe. Une anomalie factuelle est corrigée au niveau de son gestionnaire de source et le
   corpus est reconstruit — aucune modification directe, aucune couche d'enrichissement par simple fusion.

---

## Architecture à Trois Couches

| Couche | Localisation | Objectif |
|-------|----------|---------|
| **Fiches langue** | `shared/language-cards/<code>.json` | Configuration par langue : identité, classification, ressources, tout |
| **Fiches genre** | `shared/language-cards/genera/<genus>.json` | Propriétés d'exécution partagées pour les langues connexes (curées, non auto-générées) |
| **Arbre des langues** | `shared/language-cards/language-tree.json` | Hiérarchie Glottolog complète — données de référence pour l'interface Lab et la découverte de langues |

---

## Modèle d'Héritage

> **Largement historique depuis la reconstruction de l'atlas.** Aucune fiche de langue sur disque
> ne porte plus `extends` — chaque fiche est entièrement matérialisée par la compilation,
> car la prose héritée n'était pas citable (une affirmation au niveau de la famille portait une
> adresse au niveau de la langue). Le mécanisme lui-même subsiste à un seul endroit : le
> paquet hors ligne du paquet npm fournit les fiches de locale sous forme de deltas `extends` compacts
> par rapport à leur langue, résolus par la même fusion décrite ici.

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

> **Généré, non écrit.** Tout dans cette section est dérivé du
> corpus en direct au moment de la compilation : la fiche complète de `crk` (cri des plaines), à l'octet près,
> ainsi qu'un extrait de locale `fra-CA`. Lorsque le corpus est reconstruit, la prochaine
> compilation du site redérive cette page. Il ne reste aucun modèle maintenu à la main susceptible de
> devenir obsolète — le précédent accusait un retard d'une génération entière de schéma
> par rapport aux fiches et a été retiré le 16 août 2026.

L'exemple montre la **forme sur disque** — ce que vous obtenez si vous ouvrez le fichier.
Les consommateurs doivent toujours lire les fiches par l'intermédiaire de l'adaptateur publié
(`normalizeCard()` dans le paquet npm) : il résout les enveloppes, fait le pont avec les
noms antérieurs à la transition et dérive les valeurs destinées uniquement à l'affichage (écriture principale,
niveau de vitalité) que la fiche brute ne contient délibérément pas.

Ce qu'il convient de remarquer lors de la lecture :

1. **Enveloppes d'attribution.** `name`, `classification.family`,
   `endangerment`, `speakerEstimates`, `endonym`, `bcp47FullTag` et
   `politenessDistinction` portent chacune `{agreement, consensus?, values:
   [{value, source}]}`, every value attributed to its source. `endangerment`
   comporte `"agreement": "incommensurable"` : ses sources évaluent selon différentes
   échelles, de sorte que chaque valeur indique son `scale` au lieu d'être convertie sur celle
   d'un gagnant.

2. **Omis signifie non affirmé.** La fiche ne comporte aucun `iso639_1` (le cri des plaines n'a
   aucun code ISO 639-1) et aucun `phonologicalInventory` (aucune source ingérée
   n'en affirme) — ces champs sont simplement absents, jamais `null` ou `[]`.

3. **La provenance est une couche de premier ordre.** `_fieldSources` mappe chaque champ vers
   la ou les sources qui l'ont affirmé, `champollion-derived-v1` marquant
   les valeurs calculées par Champollion. `_card` enregistre le type, l'identifiant et la révision de la fiche,
   ainsi que les champs auxquels le flux de correction peut toucher ; `_atlas` appose la marque de version
   du corpus.

4. **Aucun résultat d'exécution.** Rien sur la fiche n'est un score mesuré de
   sortie de méthode — chrF, taux d'acceptation FST et leurs équivalents sont des résultats d'exécution indexés
   par (méthode, jeu de données, métrique) et résident sur le tableau de classement. La fiche affirme seulement
   que les ressources *existent* (`resources`, `lexicalResources`,
   `methodSupport`).

<CardSpecExample variant="language" />

### Une fiche de locale est une projection, pas une langue \{#locale-card-example}

À côté des fiches de langues se trouvent les fiches de locale (`fra-CA`, `cmn-Hant`) : les
faits d'une langue **résolus pour un territoire ou une écriture**, identifiés par leur
bloc `locale` — jamais par la forme du code. Une fiche de locale hérite des faits de sa
langue, résout ceux propres à l'écriture et au territoire (`script`,
`localeScoped`), et n'est **pas une langue** : excluez les fiches de locale de tout
décompte de langues et de toute liste par langue grâce à ce bloc `locale`.

<CardSpecExample variant="locale" />

---

## Référence des champs \{#field-reference}

Deux conventions s'appliquent à chaque tableau ci-dessous :

- **« envelope »** désigne une enveloppe d'attribution — `{agreement, consensus?,
  values: [{value, source, note?, scale?}]}` — portant l'affirmation de *chaque*
  source. Un champ listé comme `envelope` peut apparaître sous forme de valeur brute sur les fiches
  où une seule source s'exprime (par exemple, les languoïdes propres à Glottolog portent un
  champ brut `name`) ; les consommateurs doivent gérer les deux cas, ce que fait l'adaptateur
  publié.
- Aucun champ n'est obligatoire en dehors de `code` et `name` ; tout le reste est
  **omis lorsqu'aucune source ne l'affirme**. La ou les sources affirmant chaque champ
  sont enregistrées par fiche dans `_fieldSources`, de sorte que les tableaux décrivent le
  *type* de source plutôt que de figer des versions qui dériveraient.

### § 1. Champs d'Identité

| Champ | Forme | Notes |
|-------|-------|-------|
| `code` | `string` | **Obligatoire.** L'identifiant de la fiche et le nom de fichier. ISO 639-3 pour les fiches de langues (`crk`) ; les languoïdes propres à Glottolog portent leur glottocode ; les fiches de locale portent un code de locale (`fra-CA`). |
| `name` | envelope | **Obligatoire.** Nom de référence en anglais (registre ISO 639-3, LinguaMeta, Glottolog). |
| `endonym` | envelope | A remplacé `nativeName`. Ce que les locuteurs appellent la langue, dans la langue elle-même (LinguaMeta, Wikidata). Absent lorsqu'aucune source n'en affirme — un endonyme n'est jamais inventé ni translittéré par nos soins. |
| `alternateNames` | `string[]` | Autres noms anglais attestés. |
| `iso639_1` | `string` | Présent uniquement lorsqu'un code ISO 639-1 à deux lettres existe (`fra` → `"fr"`). |
| `isoScope` | `string` | Termes mêmes de l'ISO 639-3 — `"Individual"`, `"Macrolanguage"`, `"Special"` (a remplacé les initiales `"I"`/`"M"`/`"S"`). |
| `isoLanguageType` | `string` | A remplacé `isoType`. Termes mêmes de l'ISO 639-3 — `"Living"`, `"Extinct"`, `"Ancient"`, `"Historical"`, `"Constructed"`. |
| `macrolanguage` | `string` | La macrolangue à laquelle cette langue appartient (`crk` → `"cre"`). Correspondances de macrolangues ISO 639-3. |
| `macrolanguageMembers` | `string[]` | Sur les fiches pivots de macrolangue : les codes des langues membres individuelles (`nor` → `["nno", "nob"]`). |
| `canonicalisedMembers` | envelope | Sur les fiches de macrolangue : membres dont les étiquettes sont fusionnées par les registres BCP 47 dans l'étiquette de cette macrolangue (table d'alias CLDR + langtags SIL, chacun attribué). |
| `supersededCodes` | `string[]` | Anciens codes ISO 639-3 retirés que SIL redirige désormais vers cette langue — enregistrés sur le successeur pour que les corpus publiés sous un ancien code soient toujours résolus. |
| `codeAliases` | `string[]` | A remplacé `aliases`. Identifiants au niveau du code qui se résolvent vers cette fiche. |
| `bcp47` | `string` | L'étiquette BCP 47 de la langue telle qu'affirmée (LinguaMeta). |
| `bcp47Tag` | envelope | Dérivé par Champollion : l'étiquette RFC 5646 (le code ISO 639 le plus court l'emporte). |
| `bcp47FullTag` | envelope | La forme maximale langue-écriture-région (likelySubtags de CLDR + langtags de SIL). L'adaptateur dérive l'**écriture principale** à partir de cette étiquette. |
| `modality` | `string` | `"spoken"` ou `"signed"`, dérivé de l'ascendance Glottolog. L'écriture est un attribut orthographique, non une modalité — une langue non écrite demeure pleinement parlée ou signée. |
| `locale` | `object` | **Fiches de locale uniquement.** `{language, region, script, publishedTag, source, note}` — L'identité de la locale. Excluez les fiches de locale des décomptes de langues au moyen de ce bloc, jamais par la forme du code. |
| `localeScoped` | `object` | Fiches de locale uniquement : valeurs résolues pour le territoire/l'écriture de la locale (par ex. `scriptName`, `cldrOfficialStatus`). |

### § 2. Champs de Classification

| Champ | Forme | Notes |
|-------|-------|-------|
| `glottocode` | `string` | L'identifiant Glottolog pour ce languoïde (`crk` → `"plai1258"`). Les languoïdes propres à Glottolog — langues enregistrées par Glottolog mais non par l'ISO 639-3 — utilisent le glottocode comme `code` de leur fiche. |
| `classification` | `object` | Conteneur pour les champs de classification ci-dessous. Chacun est sourcé et omis de manière indépendante — un isolat, ou une langue classée dans une catégorie Glottolog, ne porte légitimement qu'une partie de cet objet. |
| `classification.family` | envelope | La famille de premier niveau affirmée par chaque autorité de classification. Glottolog et WALS sont des taxonomies distinctes qui ne concordent pas toujours ; les deux sont donc conservées et attribuées. La règle de lint R5 vérifie la valeur Glottolog dans l'enveloppe par rapport à l'arbre propre de Glottolog : WALS peut diverger de Glottolog, mais Glottolog ne doit pas être cité de manière erronée. Les isolats ne portent aucune famille. |
| `classification.familyGlottocode` | `string` | Glottocode de cette famille de premier niveau (`crk` → `"algi1248"`). |
| `classification.genus` | `string` | Nœud de classification intermédiaire de WALS (`crk` → `"Algonquian"`). Un concept propre à WALS, et **non** à Glottolog — Glottolog publie un arbre de profondeur arbitraire sans niveau de genre — il n'est donc présent que là où WALS code la langue. |
| `classification.ancestry` | `string[]` | Chemin de descendance de Glottolog sous forme de glottocodes ancêtres, racine en premier (`["algi1248", …, "plai1264"]`). L'ordre **constitue** l'affirmation : il s'agit d'un chemin, jamais d'un ensemble alphabétique. |
| `classification.glottologBucket` | `string` | Catégories non généalogiques de Glottolog — `"Artificial Language"`, `"Pidgin"`, `"Mixed Language"`, `"Speech Register"`, `"Unclassifiable"`, `"Unattested"`. Maintenues hors de l'emplacement de famille car une telle catégorie classe par type et non par filiation : une fiche comportant une catégorie n'a pas de famille, et c'est là le résultat honnête. |
| `isIsolate` | `boolean` | Indique si Glottolog classe cette langue comme un isolat. |

La fiche antérieure à la transition comportait également un champ `genusGlottocode`. Il a été retiré en même
temps que l'erreur de catégorie qui l'avait produit : le genre est un concept propre à WALS, et
l'affubler d'un identifiant Glottolog revenait à affirmer un nœud d'arbre que Glottolog ne
possède pas. La hiérarchie de Glottolog est portée à la place par `ancestry`.

### § 3. Champs de Géographie

| Champ | Forme | Notes |
|-------|-------|-------|
| `macroarea` | `string` | Macro-aire de Glottolog — `"Africa"`, `"Australia"`, `"Eurasia"`, `"North America"`, `"Papunesia"` ou `"South America"`. |
| `coordinates` | `object` | `{lat, lng}` — Point représentatif selon Glottolog. Un point, non un territoire : il situe la langue sur une carte et n'affirme rien quant à son étendue ou ses frontières. |
| `countries` | `string[]` | Codes ISO 3166-1 alpha-2 des pays que Glottolog associe à la langue (`["CA", "US"]`). |
| `cldrOfficialStatus` | `string` | Statut officiel qu'un territoire accorde à la langue, tel qu'enregistré par CLDR (transmis via LinguaMeta) — `"Official"`, `"Regional official"`. Sur une fiche de locale, le statut résolu pour le territoire de *cette locale* se trouve dans `localeScoped.cldrOfficialStatus`. |

Le tableau `regions` antérieur à la transition (répartitions des locuteurs par pays avec codes
administratifs) et `arealContext` (appartenance à un Sprachbund) sont retirés : aucune
source ingérée ne les affirme, et une curation non sourcée ne survit pas à une reconstruction.
Les affirmations relatives aux locuteurs à l'échelle régionale pourront réapparaître le jour où une source citable sera intégrée
au pipeline ; d'ici là, l'absence est l'état le plus honnête.

### § 4. Champs de Système d'Écriture

| Champ | Forme | Notes |
|-------|-------|-------|
| `scripts` | `string[]` | A remplacé le champ brut `script`. **Tous** les codes ISO 15924 attestés (`crk` → `["Cans", "Latn"]`), non ordonnés — ne lisez jamais `scripts[0]` comme « l' » écriture. L'écriture principale est dérivée par l'adaptateur à partir de l'étiquette maximale de `bcp47FullTag`. |
| `scriptNames` | `string[]` | Noms d'affichage dérivés par Champollion pour `scripts[]` (`"Unified Canadian Aboriginal Syllabics"`). |
| `textDirection` | `string` | A remplacé `dir`. Les termes mêmes de la source — `"left-to-right"` / `"right-to-left"` (auparavant `"ltr"`/`"rtl"`). |
| `suppressScript` | `string` | Suppress-Script CLDR : l'écriture tellement canonique pour la langue que les étiquettes BCP 47 l'omettent (`fra` → `"Latn"`). |
| `script` | `string` | **Fiches de locale uniquement** : l'écriture résolue pour la locale (`fra-CA` → `"Latn"`, `cmn-Hant` → `"Hant"`). Les fiches de langues ne portent aucun champ d'écriture brut. |

Une langue sans écriture attestée ne possède tout simplement **aucun champ `scripts`** —
l'absence signifie qu'aucune source n'a affirmé d'écriture, et non l'affirmation que la langue est
« non écrite ». (Les langues des signes constituent le groupe le plus important dans ce cas : aucun système de notation
ne fait l'objet d'une adoption standardisée par la communauté pour l'alphabétisation au quotidien.)

### § 5. Champs Démographiques et de Vitalité

| Champ | Forme | Notes |
|-------|-------|-------|
| `speakerEstimates` | envelope | Estimation de chaque source, attribuée. Les valeurs peuvent être des décomptes exacts ou les chaînes de plages de la source elle-même (`"10000-99999"`), les réserves de la source étant reprises mot pour mot dans `note`. `"agreement": "conflicting"` est courant — montrer le conflit *est* le produit ; rien n'est moyenné ni élu. |
| `endangerment` | envelope | A remplacé l'objet unique `vitality`. Évaluation de chaque source **sur la propre échelle de cette source** — chaque valeur comporte un champ `scale`, et `"agreement": "incommensurable"` est la norme car les vocabulaires d'ELCat, Glottolog AES et LinguaMeta ne sont pas des traductions les uns des autres. L'adaptateur dérive un *niveau de vitalité* d'affichage à partir d'une seule source nommée selon l'ordre d'autorité déclaré ; ce niveau est réservé à l'affichage — l'ensemble complet attribué reste sur la fiche. |

Tout décompte de locuteurs *affiché* dans Champollion doit correspondre à l'une des
entrées `speakerEstimates` citées ou comporter une provenance
`champollion-derived` explicite — règle appliquée par les contrôles d'intégrité des fiches.

### § 5.5 Champs de Documentation et de Présence Numérique

| Champ | Forme | Notes |
|-------|-------|-------|
| `documentation` | `object` | A remplacé `documentationDepth`. Données de Glottolog sur le niveau de description de la langue, selon les termes propres de Glottolog. |
| `documentation.medLevel` | `string` | Niveau de description le plus approfondi (Most Extensive Description) selon Glottolog, tel quel — `"long grammar"`, `"grammar"`, `"grammar sketch"`, `"phonology"`, `"wordlist"`. |
| `documentation.medSourceId` | `string` | Clé bibliographique de cette description la plus approfondie dans le catalogue de références de Glottolog. |
| `documentation.firstDocumented` | `number` | Colonne propre à Glottolog indiquant la première année de documentation, telle quelle — déplacée ici depuis le champ de premier niveau antérieur à la transition. Présente pour quelques centaines de langues seulement, et cette rareté est en soi une information digne d'intérêt. |
| `documentation.lastDocumented` | `number` | Colonne propre à Glottolog indiquant la dernière année de documentation, telle quelle — présente pour environ un millier de langues. |
| `wikipediaEdition` | `object` | A remplacé `digitalPresence`. `{site, url, name}` — une édition ouverte de Wikipédia existe dans cette langue (`afr` → `af.wikipedia.org`). Existence uniquement, délibérément **sans décompte d'articles** : plusieurs éditions sont en grande partie générées par des robots, et une édition imposante n'est en rien « mieux documentée » qu'une petite dans un sens exploitable par un traducteur. |
| `dialectCount` | `number` | Colonne `child_dialect_count` propre à Glottolog, telle quelle — dialectes enfants directs uniquement, pas l'arborescence entière. Il s'agit de l'affirmation de Glottolog, non de notre calcul : une règle précédente l'estampillait `champollion-derived` et attribuait à des milliers de fiches le mérite du décompte de Glottolog. |

Le reste du bloc `digitalPresence` antérieur à la transition (heures Common Voice,
décomptes de phrases Tatoeba) est retiré jusqu'à ce que ces sources soient intégrées au pipeline —
le corpus Tatoeba lui-même apparaît déjà là où il a sa place, en tant que corpus
parallèle sous `resources.corpora` (§ 9).

### § 6. Champs de Formalité, Registre et Genre

Le corpus projeté ne porte exactement qu'un seul champ ici — le fait cité :

| Champ | Forme | Notes |
|-------|-------|-------|
| `politenessDistinction` | envelope | Indique si la langue grammaticalise la politesse dans les formes de deuxième personne. Attribué selon Grambank GB415 (binaire : absent/présent) et WALS 45A (quatre niveaux : aucune distinction / binaire / multiple / pronoms évités). Il s'agit d'échelles différentes, chaque valeur indique donc son `scale` et l'enveloppe les signale comme **incommensurables** plutôt que comme un désaccord. |

**Le système de registres relève de la configuration, non d'un fait de fiche.** Le corpus
antérieur à la transition stockait la prose `formality` et les invites `registers` sur près de dix-huit
cents fiches chacun — la quasi-totalité étant générée à partir des deux mêmes sources
ci-dessus, puis conservée comme s'il s'agissait d'une configuration organisée à la main. L'atlas
conserve le fait ; les surfaces de configuration — `formality`, `registers`,
`gender`, `codeSwitching` — font toujours partie du **schéma organisé du paquet
npm** (`language-card.schema.json`), résident sur les fiches pivots organisées de genre/famille
et parviennent au CLI via la fusion `extends` du système de registres
décrite dans le [Modèle d'héritage](#inheritance-model). Ce ne sont pas
des champs projetés de l'atlas : aucune fiche du corpus projeté ne les porte, et la
compilation de l'atlas ne les écrira jamais. Les conseils de la section
[Rédiger de bons préréglages de registre](#writing-good-register-presets) s'appliquent à
ce flux organisé.

### § 7. Champs de Profil Linguistique

| Champ | Forme | Notes |
|-------|-------|-------|
| `typologicalProfile` | `object` | Une clé par trait typologique ingéré, chaque valeur étant le codage propre de la source, chaque clé n'étant présente que là où la source code cette langue. Les booléens proviennent des traits de Grambank, les chaînes de catégories des chapitres de WALS ; le registre de décisions nomme le paramètre amont exact pour chaque clé. |
| `phonologicalInventory` | `object` | `{consonants, vowels, tones, totalPhonemes, hasTone}` — décomptes calculés par Champollion sur un inventaire PHOIBLE cité (PHOIBLE publie une ligne par segment et n'affirme aucun décompte), chaque valeur portant donc une provenance `champollion-derived`. **PHOIBLE est la seule autorité pour les tons** (règle de lint R1) : Grambank n'a aucun trait relatif aux tons, et rien d'autre sur la fiche ne peut revendiquer la tonalité. |
| `numeralSystem` | `object` | `{base}` — la base numérale, telle quelle d'après *Numeral Systems of the World's Languages* de Chan (`"decimal"`, `"quinary-vigesimal"`, `"body tally"` ; près d'une centaine de valeurs distinctes). Absent lorsque la colonne de base de Chan est elle-même vide — environ la moitié des langues recensées — parce qu'un générateur précédent remplissait le vide par `"decimal"` et inventait des valeurs pour deux mille langues. |
| `pluralCategories` | `string[]` | Les catégories de pluriel cardinal que CLDR indique pour cette langue — l'arabe en distingue `["zero", "one", "two", "few", "many", "other"]`, le français trois, le chinois une. Lu à partir des clés du jeu de règles propre à CLDR, il s'agit donc d'une affirmation de CLDR et non de notre dérivation. A remplacé le champ `rules.plurals.categories` antérieur à la transition ; un pipeline d'i18n en a besoin pour savoir combien de formes plurielles un message doit fournir. |

Les clés `typologicalProfile` actuellement projetées, avec leurs paramètres
amont :

- **Chapitres WALS** (chaînes de catégories, étiquettes de valeur propres à WALS) : `fusion`
  (20A), `verbSynthesis` (22A), `affixPreference` (26A), `reduplication`
  (27A), `genderCount` (30A), `caseCount` (49A), `wordOrder` (81A),
  `subjectVerbOrder` (82A), `verbalAlignment` (100A), `negationOrder` (143A)
- **Traits Grambank** (booléens) : `hasGenderInPronouns` (GB030),
  `hasSexBasedGender` (GB051), `hasNumeralClassifiers` (GB057), `hasCoreCase`
  (GB070), `hasObliqueCase` (GB072), `marksPastTense` (GB083),
  `marksPresentTense` (GB082)

Les blocs `linguisticChallenges` et `contactInfluences` antérieurs à la transition ne sont pas
projetés — la prose issue de recherches sans source ingérée demeure dans le schéma
organisé du paquet npm, à l'instar des surfaces de registre du § 6 (les
tableaux des [Types d'influence de contact](#contact-influence-types) ci-dessous alimentent
ce flux). Le bloc `rules` est retiré : ce qui y était citable survit sous la forme
de `pluralCategories` ici et des champs d'écriture au § 4.

### § 8. Champs Encyclopédiques

Retirés des fiches. Les blocs antérieurs à la transition `encyclopedic` (textes sur l'histoire et les dialectes,
liens institutionnels), `culturalAphorism` et `varieties` étaient de la prose
rédigée à la main au niveau de la fiche, que la reconstruction supprime par conception. Les
faits d'appartenance esquissés par `varieties` sont désormais des champs d'identité cités
(§ 1 `macrolanguageMembers` et `canonicalisedMembers`), et la couverture des outils
par variété est renseignée par la propre fiche de chaque membre (`methodSupport`,
`resources`). Un proverbe représentatif pourra réintégrer le corpus par le biais d'une filière de contribution
communautaire avec consentement et citation ; il ne reviendra pas sous forme de champ de fiche non cité.

### § 9. Champs de Ressources Numériques

Tout dans cette section affirme **l'existence et la capacité, jamais la
qualité** : qu'une ressource est publiée et qui la publie — jamais qu'elle
est bonne, complète ou exploitable, et jamais un score mesuré. Tout score mesuré
de sortie de méthode est un résultat d'exécution indexé par (méthode, jeu de données, métrique), réside sur
le tableau de classement et est interdit sur les fiches (règle de lint R3).

| Champ | Forme | Notes |
|-------|-------|-------|
| `resources` | `object` | Conteneur : chaque sous-champ ci-dessous est une liste sourcée de manière indépendante, omise lorsqu'aucune source ne l'affirme. |
| `resources.fsts` | `object[]` | Analyseurs morphologiques à états finis publiés : `{name, url, publisher, license, licenceEstablished, archived}`. La licence accompagne chaque entrée au lieu d'être présumée uniforme sur l'ensemble d'un catalogue — les limites de licence exigent les conditions réelles. Pour une langue polysynthétique, un FST constitue fréquemment la seule vérification structurelle qui existe. |
| `resources.corpora` | `object[]` | Corpus parallèles attestant cette langue : `{corpus, corpusId, pairCount, topPartners, alignmentPairsTotal, …}`. Énoncés par **paires**, car un corpus parallèle n'atteste une langue qu'à travers une paire — « couvre le swahili » sans préciser par rapport à quoi répond à une question que personne n'a posée. Existence et taille, jamais qualité. |
| `resources.monolingualCorpora` | `object[]` | Corpus monolingues — tenus séparés de `corpora` afin que « possède un corpus » ne désigne jamais deux choses incomparables. |
| `resources.speech` | `object[]` | Ressources vocales publiées. Existence uniquement. |
| `resources.keyboards` | `object[]` | Dispositions de clavier publiées. Sobre mais fondamental : pour une orthographe nécessitant des caractères qu'aucune disposition standard ne produit, une disposition fait la différence entre une langue saisissable au clavier ou non. |
| `resources.typology` | `object[]` | Jeux de données typologiques qui *codent* cette langue, avec leur étendue : `{dataset, featuresCoded, datasetFeatureTotal}`. Existence et étendue, jamais le contenu — ce qu'un trait indique reste hors de la fiche jusqu'à ce qu'une personne écrive le mappage de paramètres qui l'accepte (ceux acceptés apparaissent dans `typologicalProfile` au § 7). Les décomptes de traits relèvent de notre calcul et portent donc une provenance `champollion-derived`. |
| `lexicalResources` | `object` | Conteneur pour les faits d'existence lexicale. |
| `lexicalResources.datasets` | `object[]` | Listes de mots publiées avec leur couverture : `{dataset, forms, concepts, release}`. |
| `lexicalResources.dictionaries` | `object[]` | Dictionnaires publiés — existence, jamais qualité, et **orientés** là où l'éditeur les oriente : un dictionnaire unidirectionnel dans un sens est une ressource différente d'un dictionnaire dans l'autre sens. Les entrées ne sont pas uniformes dans leur forme (un jeu de données CLDF connaît son nombre d'entrées ; un dépôt connaît sa paire et sa direction) ; chacune nomme sa propre source, et la licence ainsi que l'état archivé accompagnent chaque entrée. |
| `lexicalResources.colexificationConcepts` / `colexifyingForms` | `number` | Décomptes calculés par Champollion sur CLICS³ : concepts attestés pour cette langue, et formes qui correspondent à deux concepts distincts ou plus. `champollion-derived`. |
| `methodSupport` | `object` | Méthodes de traduction qui couvrent cette langue — capacité, jamais un score. Forme : `{total, byTier, named, truncated}`. L'anglais compte des milliers de liens de méthodes et la langue médiane une vingtaine ; la fiche conserve donc la *forme* de la preuve — `total` plus décomptes `byTier` par niveau de confiance (`fetched`, `partially-confirmed`, `model-card-declared`) — et ne nomme que les entrées les plus solides (chacune `{value, variant, source, confidence}`), avec un plafond. Les **services** du registre sont toujours cités intégralement, au-delà du plafond, de sorte que l'absence d'un service dans `named` constitue une vraie réponse ; l'absence d'une entrée de fiche de modèle signifie seulement « ne figure pas parmi les plus solides », et chaque lien reste interrogeable dans le magasin de l'atlas. |
| `metricModelSupport` | envelope | Modèles de métriques d'évaluation qui publient une couverture de cette langue, avec l'identifiant de modèle chargé par un banc d'essai (`masakhane/africomet-mtl`). Pilote un comportement réel — la sélection de modèle COMET — et reste une capacité, jamais un score. |

**Intégrés dans les champs ci-dessus :** les champs antérieurs à la transition `keyboardSupport` (→
`resources.keyboards`), `corpusAvailability` (→ `resources.corpora` /
`resources.monolingualCorpora`), et `databaseCoverage` (→
`resources.typology` plus `lexicalResources` — une entrée de base de données est désormais un
fait de couverture cité avec une étendue, et non un booléen).

**Retirés des fiches :** `omt1600`, `evalDatasets`, `pipelineReadiness` et
`metricPlugins` — aucun n'est affirmé par une source ingérée, et un niveau
de préparation est un jugement, non une citation.

**Organisés manuellement, non projetés :** les surfaces de déclaration des standards d'évaluation
(`evalStandard`, `evalMetrics`, `evalPack`) restent dans le schéma organisé
du paquet npm. Elles indiquent au banc d'évaluation quel paquet arbitre externe
évalue une langue (des arbitres, pas des concurrents — le cœur du banc n'embarque aucun
code d'évaluation spécifique à une langue) ; le banc les lit sur une fiche lorsqu'elles sont
présentes, mais aucune fiche du corpus projeté ne les porte actuellement, et la
compilation de l'atlas ne les écrit pas. Il en va de même pour le bloc `install` que
l'installateur FST du banc lit à partir des entrées `resources.fsts[]`
(`get_fst_install_info()` dans `language_cards.py`) : les entrées projetées
ne portent que des faits d'existence.

### § 10. Champs de Provenance

| Champ | Forme | Notes |
|-------|-------|-------|
| `_fieldSources` | `object` | Sur chaque fiche. Mappe chaque chemin de champ sur la fiche (`"classification.family"`, `"coordinates.lat"`) vers les identifiants de source triés qui l'ont affirmé (`["glottolog-v5.3", "wals-v2020.5"]`). Les valeurs calculées par Champollion portent `champollion-derived-v1`. Les identifiants de source sont versionnés — `grambank-v1.0.3`, `iso639-3-20260715` — afin que chaque affirmation remonte à la version exacte qui l'a formulée. |
| `coverage` | `object` | Sur chaque fiche, et **calculé par le projecteur, non affirmé par une quelconque source** : `{sourceCount, componentsPresent, componentsTotal, notAttested}` — combien de sources distinctes s'expriment sur cette langue, combien de composants de fiche portent une valeur sur le total pouvant être rempli, et combien de valeurs une source a explicitement enregistrées comme *absentes* (a vérifié et a conclu par la négative — un fait différent de ne jamais avoir vérifié). C'est ce qui permet à une fiche peu fournie d'expliquer **pourquoi** elle l'est au lieu de paraître délaissée. |
| `_card` | `object` | Métadonnées propres à la fiche : `{type, id, revision, correctableFields}`. `type` vaut `"language"` ou `"locale"` (les fiches de méthode et de corpus empruntent le même projecteur) ; `revision` est un hachage de contenu, de sorte que toute modification apportée au contenu de la fiche le modifie ; `correctableFields` énumère les chemins de champs portant des valeurs — les champs auxquels le flux de correction peut toucher. |
| `_atlas` | `object` | `{version}` — l'estampille de publication du corpus (`"unreleased"` entre les publications). Délibérément un identifiant de publication, **non** un horodatage de compilation : un horodatage ferait différer selon le calendrier deux compilations issues d'épinglages identiques, détruisant ainsi la propriété permettant à quiconque de vérifier l'atlas — mêmes épinglages en entrée, mêmes octets en sortie. |

Le bloc de provenance antérieur à la transition est intégralement retiré : `dataSources`
(remplacé par le mappage `_fieldSources` par champ), `supportTier` (un jugement
calculé, remplacé par les décomptes neutres `coverage`), `_generated` (l'ensemble
du corpus est généré ; l'estampille est `_card.revision` plus
`_atlas.version`), `humanReviewed` et `notes` (curation relevant de
filières ayant leurs propres enregistrements), ainsi que les champs de premier niveau
`firstDocumented`/`lastDocumented` (déplacés dans `documentation` au § 5.5,
où leur source les affirme réellement).

---

## Politique de Code de Langue

Champollion utilise **ISO 639-3** comme identifiant canonique. Les autres codes standards
sont enregistrés comme alias et se résolvent au code ISO 639-3 à l'exécution.

| Priorité | Standard | Exemple | Champ | Utilisation |
|----------|----------|---------|-------|-----|
| 1 (canonique) | ISO 639-3 | `crk` | `code` | Nom de fichier de fiche, clés de configuration, paramètres d'API |
| 2 (alias) | ISO 639-1 | `iu` | `codeAliases[]` | Accepté dans le CLI, résolu vers l'ISO 639-3 |
| 3 (alias) | BCP 47 | `fil` | `codeAliases[]` | Accepté dans le CLI, résolu vers l'ISO 639-3 |
| Référence | Glottocode | `plai1258` | `glottocode` | Classification uniquement, pas pour l'exécution |

**Ordre de résolution :** Lorsqu'un utilisateur fournit un code :
1. Correspondance directe sur `card.code` → trouvé
2. Correspondance sur `card.codeAliases[]` → trouvé, renvoie la fiche canonique
3. Correspondance sur `card.iso639_1` → trouvé (repli)
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

**Qu'est-il advenu des anciens codes ?**
- L'ancien code 639-1 se trouve dans `card.iso639_1`
- L'ancien code 639-1 se trouve dans `card.codeAliases[]` (`fra` → `["fr"]`)
- `resolveCode("fr")` renvoie `"fra"` à l'exécution — rétrocompatible
- Les utilisateurs peuvent toujours écrire `"fr"` dans leur configuration — la résolution s'opère de manière transparente

**Ce qui a changé architecturalement :**
- `_deepMerge()` ignore maintenant les valeurs `null` (hérite du parent)
- `_deepMerge()` a maintenant un champ d'identité défini (code, extends, alias jamais hérités)
- `formality.default` est maintenant dérivé des drapeaux de registre `isDefault: true`
- 205 fiches dérivées de Grambank ont reçu une correction structurelle `formality.default`
- 38 fiches genre/famille/macrolangue fournissent des cibles d'héritage

---

## Cas Limites

### Langues des signes
Les langues des signes (par ex., ASE — langue des signes américaine) sont des langues à part entière
dotées de codes ISO 639-3. Elles possèdent une géographie et un nombre de locuteurs, mais :
- `modality` est `"signed"` — l'affirmation explicite par la fiche de ce que la
  langue *est* ; l'absence de système d'écriture est un fait distinct
- `scripts` est généralement absent (aucun système de notation ne fait l'objet
  d'une adoption standardisée par la communauté), bien que `"Sgnw"` (SignWriting) apparaisse lorsqu'une source l'affirme
- `textDirection` est absent
- `linguisticChallenges` doit aborder la grammaire spatiale, les classificateurs, etc.

### Langues anciennes et historiques
Des langues comme le latin (`lat`, isoLanguageType `"Historical"`) et le sanscrit
(`san`) sont encore employées dans des contextes spécifiques (liturgiques, universitaires) mais n'ont
aucun locuteur natif :
- `isoLanguageType` porte le mot d'état propre à l'ISO (`"Ancient"`,
  `"Historical"`, `"Extinct"`) — la fiche ne l'atténue ni ne le remplace jamais
- `endangerment` et `speakerEstimates` rapportent tout ce que les sources citées
  évaluent réellement, réserves textuelles comprises (les décomptes de communautés L2 restent étiquetés selon
  les désignations de leurs sources)
- `firstDocumented` / `lastDocumented` les situent dans le temps

### Langues construites
L'espéranto (`epo`, isoLanguageType `"Constructed"`), le lojban, etc. :
- `classification` peut être absent — Glottolog classe les idéolangues dans une
  catégorie non généalogique, et cette catégorie n'est jamais affichée en tant que famille
- `contactInfluences` reflète les matériaux sources (par ex., l'espéranto s'inspire des langues romanes, germaniques, slaves)
- `endangerment` est atypique — communauté de locuteurs en expansion mais aucun territoire d'origine autochtone

### Macrolangues
L'arabe (`ara`), le chinois (`zho`), le cri (`cre`), le quechua (`que`) sont des macrolangues
qui englobent plusieurs langues individuelles :
- `isoScope: "Macrolanguage"` — un pivot de navigation, jamais une cible d'évaluation comparative
- `macrolanguageMembers` énumère les codes des membres individuels ;
  `canonicalisedMembers` enregistre les membres dont les étiquettes sont intégrées par les registres BCP 47
  dans l'étiquette de la macrolangue (chaque registre étant attribué)
- `methodSupport` reflète ce que la *fiche de la macrolangue* prend en charge (généralement la variété standardisée)
- Les membres individuels possèdent leurs propres fiches, renvoyant via `macrolanguage` vers le pivot

### Langues sans orthographe standardisée
De nombreuses langues (en particulier les langues de tradition orale) ne disposent d'aucun système d'écriture
standardisé, ou ont des orthographes concurrentes :
- `scripts`, `scriptNames` et `textDirection` sont absents — aucune source
  n'a affirmé d'écriture, ce qui n'équivaut pas à affirmer qu'elle est « non écrite »
- `notes` doit expliquer la situation orthographique
- `linguisticChallenges` doit noter en quoi cela affecte la TA (par ex., absence de données d'entraînement)

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

## Comment les faits des fiches sont mis à jour

Les fiches sont un **résultat de compilation** — une projection déterministe à partir d'instantanés amont
épinglés. Il n'existe plus de procédure d'enrichissement par fiche : la filière de scripts
`enrich-*` exécutée manuellement est retirée, et une modification apportée directement à un fichier de fiche
est supprimée lors de la compilation suivante. Pour modifier un fait :

1. **Enregistrer la décision.** Chaque champ constitue une ligne dans le registre
   de décisions de la compilation : quel paramètre amont l'alimente, comment il se projette et ce qu'une
   valeur absente signifie.
2. **Corriger la couche d'ingestion.** Une valeur erronée est un défaut dans le gestionnaire de source
   (ou un épinglage amont obsolète), jamais un élément à corriger ponctuellement sur la fiche.
3. **Reconstruire et basculer.** La compilation reprojette chaque fiche à partir des instantanés
   épinglés ; les barrières de validation refusent les compilations partielles, les valeurs nulles ou vides et les fiches qui
   échouent aux règles d'intégrité.

### Gestion des Conflits

Lorsque les sources divergent :
1. **Stocker l'ensemble des valeurs** avec l'attribution de la source — c'est la raison d'être
   de l'enveloppe d'attribution
2. **Ne faites PAS de moyenne** et ne prenez pas parti — `consensus` n'apparaît que lorsque les
   sources sont réellement d'accord
3. **Reprenez textuellement les réserves de chaque source** dans le champ `note` de cette valeur
4. Une valeur unique pour l'affichage ou le calcul est **dérivée par l'adaptateur**
   selon l'ordre d'autorité déclaré — la fiche elle-même conserve l'éventail complet

---

## Validation

Exécutez le linter après toute reconstruction :

```bash
node scripts/lint-language-cards.mjs              # all cards
node scripts/lint-language-cards.mjs --lang crk    # single card
```

### Liste de Contrôle de PR

Lors de la soumission d'une modification touchant aux fiches (rappel : modifiez la compilation,
pas la fiche) :

- [ ] Le correctif réside dans un gestionnaire d'ingestion ou dans le registre de décisions — aucun fichier
      de fiche n'est modifié à la main
- [ ] Les champs ne portent que des valeurs affirmées par des sources — aucun remplissage avec `null` ou
      `[]` pour « compléter » une fiche
- [ ] `classification` provient de Glottolog (non construit à la main)
- [ ] La provenance de chaque champ modifié figure dans `_fieldSources`, les valeurs
      calculées par Champollion portant la provenance `champollion-derived`
- [ ] Aucun score mesuré de sortie de méthode n'apparaît nulle part sur une fiche
- [ ] Le linter et la barrière de contrôle d'intégrité des fiches réussissent sans erreur

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
