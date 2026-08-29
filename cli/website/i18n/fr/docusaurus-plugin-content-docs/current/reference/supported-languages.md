---
sidebar_position: 4
title: "Langues prises en charge"
related:
  - label: "The Language Atlas"
    to: /languages
    kind: atlas
    note: "Browse the same coverage on the map"
  - label: "Trading Cards"
    to: /trading-cards
    kind: card
    note: "Every language as a collectible stat card"
  - label: "Language Card Specification"
    to: /docs/reference/language-card-spec
    kind: reference
  - label: "Endonym"
    to: /glossary#term-endonym
    kind: glossary
    note: "Why we write languages in their own names"
---

# Langues Prises en Charge

champollion est fourni avec des **Cartes de Langue** — des fichiers de configuration structurés pour 50 langues. Chaque carte contient des présets de registre, des métadonnées de système de formalité, des drapeaux de support de méthode, des règles typographiques et des informations de script. Toute langue que votre LLM connaît peut être ajoutée avec une seule ligne de configuration — ce sont celles avec des registres curés et prêts pour la production.

---

## Méthodes de Traduction

Chaque langue peut utiliser une ou plusieurs de ces méthodes de traduction :

| Icône | Méthode | Fonctionnement | Coût |
|------|--------|-------------|------|
| 🟢 | **Google Translate** | Traduction automatique neuronale de base. 194 langues. Chaînes clé-valeur uniquement — ne peut pas traduire le contenu Markdown de manière fiable. | ~20 $/1 M de caractères |
| 🔵 | **LLM (OpenRouter)** | Toute langue connue du modèle. Invites dirigées par le registre. Gère les chaînes clé-valeur + le contenu Markdown. | Varie selon le modèle |
| 🟣 | **LLM encadré** | LLM + dictionnaires de grammaire + données d'encadrement injectées dans les invites. Idéal pour les langues morphologiquement complexes. | Varie selon le modèle |
| 🟠 | **API (Plugin)** | Pipelines de traduction hébergés par la communauté et servis via HTTP. [Aspirant à la souveraineté](/docs/network/community/low-resource-languages). | Varie selon le fournisseur |

Définissez `GOOGLE_TRANSLATE_API_KEY` pour Google Translate, ou `OPENROUTER_API_KEY` pour les méthodes LLM. Consultez [Méthodes de Traduction](/docs/guides/translation-methods) pour plus de détails.

---

## Langues Prioritaires

Ce sont les paramètres régionaux les plus couramment demandés pour les applications web et mobiles, listés dans l'ordre recommandé par champollion en mettant l'accessibilité en avant.

| Drapeau | Langue | Code | Google | LLM | Coached | Script | Notes |
|--------|--------|------|:------:|:---:|:-------:|--------|-------|
| 🇸🇦 | Arabe | `ar` | ✅ | ✅ | ✅ | — | RTL. Arabe standard moderne (فصحى). |
| 🇵🇭 | Philippin (Taglish) | `tl` / `fil` | ✅ | ✅ | ✅ | — | Utilisez `fil` dans les configurations Docusaurus. champollion résout les deux. |
| 🇫🇷 | Français | `fr` | ✅ | ✅ | ✅ | — | Vous-form. Inclusif de genre (Connecté·e). |
| 🇪🇸 | Espagnol | `es` | ✅ | ✅ | ✅ | — | Neutre latino-américain. |
| 🇩🇪 | Allemand | `de` | ✅ | ✅ | ✅ | — | Sie-form. Inclusif de genre (Benutzer:innen). |
| 🇯🇵 | Japonais | `ja` | ✅ | ✅ | ✅ | — | です/ます pour le corps du texte, する pour les étiquettes d'interface. |
| 🇨🇳 | Chinois (Simplifié) | `zh` | ✅ | ✅ | ✅ | — | 简体中文. |
| 🇮🇹 | Italien | `it` | ✅ | ✅ | ✅ | — | Lei-form. |
| 🇧🇷 | Portugais (BR) | `pt` | ✅ | ✅ | ✅ | — | Portugais brésilien. |
| 🇰🇷 | Coréen | `ko` | ✅ | ✅ | ✅ | — | Registre poli 해요체. |

## Grandes Langues Mondiales

| Drapeau | Langue | Code | Google | LLM | Coached | Script | Notes |
|--------|--------|------|:------:|:---:|:-------:|--------|-------|
| 🇧🇩 | Bengali | `bn` | ✅ | ✅ | ✅ | — | Préférence শুদ্ধ ভাষা. |
| 🇧🇬 | Bulgare | `bg` | ✅ | ✅ | ✅ | — | |
| 🇨🇿 | Tchèque | `cs` | ✅ | ✅ | ✅ | — | Vykání (vy-form). |
| 🇩🇰 | Danois | `da` | ✅ | ✅ | ✅ | — | |
| 🇬🇷 | Grec | `el` | ✅ | ✅ | ✅ | — | Δημοτική moderne. |
| 🇮🇷 | Persan | `fa` | ✅ | ✅ | ✅ | — | RTL. |
| 🇫🇮 | Finnois | `fi` | ✅ | ✅ | ✅ | — | Pas de genre grammatical. |
| 🇮🇱 | Hébreu | `he` | ✅ | ✅ | ✅ | — | RTL. |
| 🇮🇳 | Hindi | `hi` | ✅ | ✅ | ✅ | — | शुद्ध हिन्दी. Emprunts anglais minimaux. |
| 🇭🇺 | Hongrois | `hu` | ✅ | ✅ | ✅ | — | Ön-form. |
| 🇮🇩 | Indonésien | `id` | ✅ | ✅ | ✅ | — | |
| 🇲🇾 | Malais | `ms` | ✅ | ✅ | ✅ | — | |
| 🇳🇱 | Néerlandais | `nl` | ✅ | ✅ | ✅ | — | U-form. |
| 🇳🇴 | Norvégien | `nb` | ✅ | ✅ | ✅ | — | Bokmål. |
| 🇵🇱 | Polonais | `pl` | ✅ | ✅ | ✅ | — | Forme Pan/Pani. |
| 🇵🇹 | Portugais (EU) | `pt-PT` | ✅ | ✅ | ✅ | — | Portugais européen. |
| 🇷🇴 | Roumain | `ro` | ✅ | ✅ | ✅ | — | |
| 🇷🇺 | Russe | `ru` | ✅ | ✅ | ✅ | — | Вы-form. |
| 🇸🇰 | Slovaque | `sk` | ✅ | ✅ | ✅ | — | Vykanie (vy-form). |
| 🇷🇸 | Serbe | `sr` | ✅ | ✅ | ✅ | 🔤 Latin→Cyrillique | Convertisseur de script déterministe. |
| 🇸🇪 | Suédois | `sv` | ✅ | ✅ | ✅ | — | |
| 🇰🇪 | Swahili | `sw` | ✅ | ✅ | ✅ | — | |
| 🇹🇭 | Thaï | `th` | ✅ | ✅ | ✅ | — | Particules de politesse ครับ/ค่ะ. |
| 🇹🇷 | Turc | `tr` | ✅ | ✅ | ✅ | — | Siz-form. |
| 🇺🇦 | Ukrainien | `uk` | ✅ | ✅ | ✅ | — | Ви-form. |
| 🇵🇰 | Ourdou | `ur` | ✅ | ✅ | ✅ | — | RTL. Forme آپ. |
| 🇻🇳 | Vietnamien | `vi` | ✅ | ✅ | ✅ | — | |
| 🇹🇼 | Chinois (Traditionnel) | `zh-TW` | ✅ | ✅ | ✅ | — | 繁體中文. |
| 🇬🇪 | Géorgien | `ka` | ✅ | ✅ | — | — | ქართული. Famille kartvelienne. |
| 🇳🇬 | Yoruba | `yo` | ✅ | ✅ | — | — | Èdè Yorùbá. Tonal (3 tons). |

## Variantes Régionales

| Drapeau | Langue | Code | Google | LLM | Coached | Script | Notes |
|--------|--------|------|:------:|:---:|:-------:|--------|-------|
| 🇲🇽 | Espagnol mexicain | `es-MX` | ✅ | ✅ | ✅ | — | Tú-form. Registre chaleureux. |
| 🇨🇦 | Français canadien | `fr-CA` | ✅ | ✅ | ✅ | — | Idiomes québécois. |

---

## Langues Autochtones et Peu Dotées en Ressources

Ces langues ne sont pas prises en charge par les services commerciaux de traduction automatique. champollion fournit les outils nécessaires aux communautés linguistiques pour créer leurs propres méthodes selon les [principes communautaires de souveraineté des données](/docs/network/community/low-resource-languages).

| | Langue | Code | Google | LLM | Coached | Script | Statut |
|---|--------|------|:------:|:---:|:-------:|--------|--------|
| 🪶 | Cri des Plaines | `crk` | ❌ | ✅ | ✅ | 🔤 SRO→Syllabaires | 🚧 En développement |
| 🌄 | Quechua | `qu` | ✅ | ✅ | — | — | Runasimi. Suffixes d'évidence. |

:::info[Le cri des plaines est en cours de développement actif]
Le registre, l'infrastructure d'encadrement, le convertisseur d'écriture et le dispositif d'évaluation pour le cri des plaines sont tous fonctionnels, mais le pipeline de traduction n'a **pas encore été publié**. Nous collaborons avec les communautés linguistiques selon les [principes communautaires de souveraineté des données](/docs/network/community/low-resource-languages) pour garantir la qualité avant la publication. Consultez [Soutenir une langue à faibles ressources](/docs/network/community/low-resource-languages) pour connaître toute l'histoire — et savoir comment vous pouvez y contribuer.
:::

:::tip[Ajouter davantage de langues peu dotées en ressources]
Le système de plugin de méthode de champollion est conçu à cet effet. Une communauté linguistique peut construire une méthode de traduction personnalisée, l'héberger sous son propre contrôle et la servir via la [méthode API](/docs/guides/serving-a-method). Le [Classement des méthodes](/leaderboard) suit les scores pour toute paire de langues — construisez une méthode, exécutez le harnais et revendiquez le meilleur score.
:::

---

## Langues Construites

Les conlangs sont pris en charge via les registres LLM et les convertisseurs de script optionnels. Ils utilisent la même infrastructure que les langues réelles — la porte de qualité, le système de coaching et le pipeline de conversion de script fonctionnent de manière identique.

| | Langue | Code | Google | LLM | Script | Notes |
|---|--------|------|:------:|:---:|--------|-------|
| 🖖 | Klingon | `tlh` | ❌ | ✅ | 🔤 Romanisation→pIqaD | Police PUA requise. Vocabulaire Marc Okrand. |
| 🧝 | Sindarin (Elfique Tolkien) | `x-elvish-s` | ❌ | ✅ | 🔤 Latin→Tengwar | Police PUA CSUR requise. |
| 🏴‍☠️ | Anglais Pirate | `x-pirate` | ❌ | ✅ | — | Registre uniquement. Métaphores nautiques. |
| 🦸 | Kryptonien | `x-kryptonian` | ❌ | ✅ | 🔤 Latin→Kryptonien | Police PUA requise. |
| 🎭 | Anglais Shakespearien | `x-shakespeare` | ❌ | ✅ | — | Registre uniquement. Formes thee/thou, -eth/-est. |
| 🐸 | Parler de Yoda | `x-yoda` | ❌ | ✅ | — | Registre uniquement. Ordre des mots OSV. |

Consultez [Conlangs, Scripts et Orthographe](/docs/guides/conlangs-scripts-orthography) pour les exigences de police PUA, les limitations Unicode et comment ajouter les vôtres.

---

## Présets de Langue

L'assistant `init` prend en charge les noms de présets pour une configuration rapide. Vous pouvez mélanger les présets avec des codes individuels.

| Preset | Expands To |
|--------|-----------|
| `european` | fr, de, es, it, pt, nl |
| `asian` | ja, zh, ko |
| `global` | fr, es, de, ja, zh, ko, pt, ar |
| `nordic` | da, fi, nb, sv |

```bash
# Mix presets with individual codes
champollion init
# → Target languages: european, ja
# → Resolves to: fr, de, es, it, pt, nl, ja
```

---

## Ajouter Toute Langue

champollion peut traduire vers **toute langue que votre LLM connaît** — le tableau ci-dessus liste simplement les langues avec des présets de registre intégrés. Pour ajouter une langue non listée, incluez son code BCP-47 dans votre configuration :

```json
{
  "languages": {
    "sw": {},
    "am": {
      "register": "Formal Amharic. Professional register with Geʽez script."
    }
  }
}
```

Le LLM traduira en utilisant sa connaissance d'entraînement de la langue. Définir un `register` vous donne le contrôle sur le ton, la formalité et les conventions orthographiques. Consultez [Configuration](/docs/getting-started/configuration) pour plus de détails.

---

## Cartes de Langue {#language-cards}

Chaque langue intégrée a une **Carte de Langue** — un fichier JSON unifié dans `shared/language-cards/` contenant toutes les métadonnées : registres, formalité, support de méthode, règles typographiques, classification généalogique, défis linguistiques et ressources PNL.

### Architecture de Carte Unifiée

Chaque carte est chargée avec impatience à l'importation. Il n'y a pas de niveau de référence séparé — toutes les données vivent dans un seul fichier par langue. Les cartes sont enrichies à partir de sources faisant autorité :

| Source | Données |
|--------|---------|
| [Glottolog](https://glottolog.org) | Classification familiale, chaîne d'ascendance, Glottocode |
| [WALS](https://wals.info) | Classification de genre, caractéristiques typologiques |
| [CLDR](https://cldr.unicode.org) | Script, direction, règles de pluriel, typographie |
| [ISO 15924](https://unicode.org/iso15924/) | Codes de script |

### Champs Clés de la Carte

| Champ | Contenu |
|-------|---------|
| **`nativeName`** | Endonym — le nom de la langue pour elle-même, dans son propre script (p. ex., ქართული, Runasimi) |
| **`classification`** | Ancre généalogique : famille, genre, chaîne d'ascendance complète de Glottolog |
| **`contactInfluences`** | Historique de contact universel — couches d'emprunt, superstrats, substrats |
| **Système de formalité** | Distinction T-V, niveaux de discours, keigo, particules, etc. |
| **Présets de registre** | Présets d'invite LLM nommés spécifiques au caractère de la langue |
| **Support de méthode** | Quelles API de traduction prennent en charge cette langue |
| **Guidance de genre** | Règles de genre grammatical et conseils d'écriture inclusive |
| **Script/direction** | Code de script ISO 15924 et RTL/LTR |
| **Règles** | Typographie (guillemets, espacement), capitalisation, catégories de pluriel |
| **`glottocode`** | Identifiant Glottolog canonique pour la référence croisée |
| **`dataSources`** | Suivi de provenance (p. ex., `["glottolog-5.3", "cldr-48"]`) |

### Échafaudage d'une Nouvelle Carte de Langue

Utilisez le générateur pour échafauder une carte à partir de sources de données faisant autorité (IANA, CLDR, Glottolog) :

```bash
# Preview what would be generated
node scripts/generate-language-card.mjs sw --dry-run

# Generate a unified card
node scripts/generate-language-card.mjs sw
```

Le générateur remplit automatiquement les métadonnées (codes, script, direction, pluriels, guillemets, support de méthode, classification) et marque les champs de jugement linguistique comme TODO pour la curation humaine.

### Utilisation des Clés de Preset

Au lieu d'écrire le texte de registre complet, vous pouvez utiliser un nom de clé de preset :

```json
{
  "languages": {
    "fr": "casual-tu",
    "ko": "formal-hapsyo",
    "ja": "polite"
  }
}
```

Champollion résout la clé au prompt de registre complet. Exécutez `npx champollion init` pour voir les présets disponibles pour chaque langue.

### Exemples de Présets

| Langue | Présets | Par défaut |
|--------|---------|-----------|
| Français | `formal-vous`, `casual-tu` | `formal-vous` |
| Coréen | `polite-haeyo`, `formal-hapsyo`, `casual-hae` | `polite-haeyo` |
| Japonais | `polite`, `formal-keigo`, `casual` | `polite` |
| Allemand | `formal-Sie`, `casual-du` | `formal-Sie` |
| Thaï | `neutral-professional`, `polite-male`, `polite-female` | `neutral-professional` |
| Espagnol | `neutral-professional`, `formal-usted`, `casual-tuteo` | `neutral-professional` |

Consultez [Contribuer une Carte de Langue](https://github.com/gamedaysuits/champollion) pour la spécification complète, y compris la validation des champs et la liste de contrôle des PR.

---

## Voir aussi

- [Configuration](/docs/getting-started/configuration) — référence de configuration complète incluant la configuration de la langue
- [Méthodes de Traduction](/docs/guides/translation-methods) — fonctionnement de chaque méthode
- [Convertisseurs de Script](/docs/concepts/script-converters) — pipeline de conversion de script déterministe
- [Conlangs, Scripts et Orthographe](/docs/guides/conlangs-scripts-orthography) — polices PUA, Unicode, ajout de conlangs
- [Soutenir une Langue Peu Dotée en Ressources](/docs/network/community/low-resource-languages) — construction de méthodes pour les langues mal desservies

