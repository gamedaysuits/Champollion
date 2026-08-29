---
title: "Procédure de citation de la carte de langue"
sidebar_label: "Citation Procedure"
---

# Procédure de Citation des Fiches Linguistiques

*Comment Champollion garantit que chaque affirmation sur une fiche linguistique est traçable jusqu'à une source primaire.*

---

## 1. Le Problème

Les fiches linguistiques contiennent des affirmations factuelles — nombres de locuteurs, statut d'endangérment, influences de contact, propriétés morphologiques, conventions typographiques, support des méthodes — qui **doivent être vérifiables**. Actuellement :

- Le champ `dataSources` est un tableau plat de chaînes de caractères (par ex. `["cldr-48", "glottolog-5.3"]`)
- Il n'existe pas de granularité de citation par champ
- Des affirmations comme « ~2,8M de locuteurs » ou « vulnérable » n'ont aucune provenance traçable
- Un relecteur ne peut pas déterminer quelle source soutient quelle affirmation

> [!CAUTION]
> **Une affirmation non sourcée est une affirmation invérifiable.** Pour un projet qui se positionne comme rigoureusement professionnel, chaque assertion sur une fiche linguistique doit être traçable jusqu'à une source primaire spécifique et versionnée.

---

## 2. Sources Faisant Autorité (Classées par Priorité)

Pour chaque type d'affirmation, les sources suivantes font autorité. **Préférez toujours la source de plus haut rang disponible.**

### Classification et Identité

| Priorité | Source | Couvre | Licence | Comment Citer |
|---|---|---|---|---|
| 1 | [Glottolog](https://glottolog.org) (Max Planck) | Famille, ascendance, glottocode | CC-BY 4.0 | `glottolog-5.x` |
| 2 | [ISO 639-3](https://iso639-3.sil.org) (SIL) | Codes ISO, macrolangues | Gratuit | `iso639-3-{date}` |
| 3 | [WALS](https://wals.info) (Max Planck) | Définitions de genre, traits typologiques | CC-BY 4.0 | `wals-2024` |
| 4 | [CLDR](https://cldr.unicode.org) (Unicode) | Codes de locale, codes de script, règles de pluriel | Conditions Unicode | `cldr-{version}` |

### Démographie des Locuteurs et Vitalité

| Priorité | Source | Couvre | Licence | Comment Citer |
|---|---|---|---|---|
| 1 | Données de recensement national | Nombres officiels de locuteurs | Varie (généralement public) | `census-{country}-{year}` |
| 2 | [Ethnologue](https://www.ethnologue.com) | Estimations de locuteurs, EGIDS | Propriétaire (abonnement) | `ethnologue-{edition}` |
| 3 | [Atlas UNESCO](http://www.unesco.org/languages-atlas/) | Statut d'endangérment | Gratuit | `unesco-atlas-{year}` |
| 4 | Articles académiques publiés | Enquêtes régionales sur les locuteurs | Licence par article | `{author}-{year}` |
| 5 | [Katig Collective](https://linguistics.upd.edu.ph/the-katig-collective/) | Langues des Philippines | Académique | `katig-{year}` |

> [!WARNING]
> **N'utilisez jamais Wikipédia, du texte généré par IA, ou des connaissances personnelles comme source primaire pour les affirmations démographiques.** Ce sont au mieux des sources secondaires/tertiaires. Remontez toujours jusqu'aux données primaires.

### Support des Méthodes (Couverture des API de Traduction)

| Méthode | Source de Vérification | Comment Vérifier | Comment Citer |
|---|---|---|---|
| Google Translate | [Liste des langues](https://cloud.google.com/translate/docs/languages) | Appel API ou page de documentation | `google-translate-{date}` |
| DeepL | [Liste des langues](https://www.deepl.com/docs-api/translate-text/) | Appel API | `deepl-api-{date}` |
| Microsoft Translator | [Liste des langues](https://learn.microsoft.com/en-us/azure/ai-services/translator/language-support) | Page de documentation | `ms-translator-{date}` |
| LibreTranslate | [Liste des langues](https://libretranslate.com/languages) | Appel API | `libretranslate-{date}` |
| NLLB | [README FLORES](https://github.com/openlanguagedata/flores) | README + model card | `nllb-200-{date}` |
| LLM | Toujours `true` | S/O (la qualité varie) | `llm-assumed` |

### DLS (Support Numérique des Langues)

| Priorité | Source | Couvre | Comment Citer |
|---|---|---|---|
| 1 | [Simons et al. 2022](https://aclanthology.org/2022.coling-1.379/) | Scores DLS (143 outils originaux) | `simons-2022` |
| 2 | Ethnologue 27e+ éd. | Scores DLS (211 outils étendus) | `ethnologue-{edition}-dls` |

### Typographie, Pluriels, Scripts

| Priorité | Source | Couvre | Comment Citer |
|---|---|---|---|
| 1 | [CLDR](https://cldr.unicode.org) | Règles de pluriel, guillemets, formatage des nombres | `cldr-{version}` |
| 2 | [CSUR Unicode](https://unicode.org/iso15924/) | Codes de script | `iso15924-{date}` |
| 3 | Grammaires publiées | Règles spécifiques à la langue | `{author}-{year}` |

### Influences de Contact

| Priorité | Source | Couvre | Comment Citer |
|---|---|---|---|
| 1 | Articles de linguistique historique publiés | Études d'emprunts, histoire du contact | `{author}-{year}` |
| 2 | Grammaires de référence | Descriptions d'influences structurelles | `{grammar-title}-{year}` |
| 3 | [WALS](https://wals.info) | Comparaisons typologiques | `wals-{feature}-{year}` |

> [!IMPORTANT]
> **Les affirmations d'influence de contact sont les plus difficiles à sourcer.** Des affirmations comme « superstrat espagnol, profond, 1571–1898 » exigent une expertise en linguistique historique. Si aucune source publiée ne peut être trouvée, marquez l'affirmation avec `"citation_needed": true` plutôt que de deviner.

---

## 3. Procédure de Citation (Étape par Étape)

### Lors de la Création d'une Nouvelle Fiche Linguistique

1. **Commencez par les champs pré-remplis :**
   - Exécutez `node scripts/build-language-tree.mjs --enrich` → remplit `classification` à partir de Glottolog
   - Enregistrez `"glottolog-{version}"` dans `dataSources`

2. **Ajoutez les données CLDR :**
   - Recherchez les règles de pluriel, guillemets, code de script à partir de CLDR
   - Enregistrez `"cldr-{version}"` dans `dataSources`

3. **Recherchez la démographie des locuteurs :**
   - Vérifiez d'abord les données de recensement national
   - Recoupez avec Ethnologue (si disponible)
   - Recoupez avec l'Atlas UNESCO
   - Enregistrez TOUTES les sources consultées dans `dataSources`

4. **Vérifiez le support des méthodes :**
   - Vérifiez la liste des langues de CHAQUE API (pas de mémoire, pas d'hypothèses)
   - Enregistrez la date de vérification

5. **Recherchez les influences de contact :**
   - Trouvez des articles de linguistique historique publiés
   - Documentez la période, le type, la profondeur avec des citations
   - Si aucune source publiée n'existe, ajoutez `"citation_needed": true` à l'entrée d'influence

6. **Recherchez la vitalité :**
   - Vérifiez Ethnologue pour l'EGIDS
   - Vérifiez l'Atlas UNESCO pour le statut d'endangérment
   - Notez les divergences entre les sources

7. **Remplissez `dataSources` :**
   - Listez CHAQUE source consultée (pas seulement celles qui ont fourni des données)
   - Utilisez le format de citation des tableaux ci-dessus

### Lors de la Mise à Jour d'une Fiche Existante

1. **Ne modifiez jamais une affirmation factuelle sans mettre à jour `dataSources`**
2. **Si vous mettez à jour un nombre de locuteurs**, supprimez l'ancienne source et ajoutez la nouvelle
3. **Si vous ajoutez un support de méthode**, vérifiez par rapport à l'API et enregistrez la date
4. **Horodatez toutes les vérifications de support de méthode** — la couverture des API change fréquemment

---

## 4. Amélioration de Schéma Proposée : Citations par Champ

### Schéma Actuel (`dataSources` Plat)

```json
"dataSources": ["cldr-48", "glottolog-5.3"]
```

**Problème :** Quels champs proviennent de CLDR ? Lesquels de Glottolog ? Lesquels ne sont pas cités ?

### Amélioration Proposée : `dataSources` Structuré

```json
"dataSources": {
  "classification": ["glottolog-5.3"],
  "vitality.unescoStatus": ["unesco-atlas-2024"],
  "vitality.egids": ["ethnologue-27"],
  "vitality.speakerCount": ["census-ph-2020", "ethnologue-27"],
  "rules.plurals": ["cldr-48"],
  "rules.typography": ["cldr-48"],
  "contactInfluences": ["blust-2013", "llamzon-1969"],
  "methodSupport.googleTranslate": ["google-translate-2024-07"],
  "methodSupport.nllb": ["nllb-200-2024-03"],
  "dls": ["simons-2022", "ethnologue-27-dls"],
  "pipelineReadiness": ["manual-assessment-2025-06"]
}
```

### Chemin de Migration

C'est un changement **rétrocompatible** :
1. Les fiches existantes conservent le tableau plat (toujours valide)
2. Les nouvelles fiches utilisent le format structuré
3. La validation du schéma accepte les deux formats
4. Migrez les fiches existantes progressivement au fur et à mesure de leur révision

> [!TIP]
> **Validez avec un script.** Ajoutez un script `validate-citations.mjs` qui :
> - Vérifie que chaque fiche a au moins `classification` et `vitality` sources
> - Signale les fiches avec des tableaux `dataSources` plats pour mise à niveau
> - Avertit sur les entrées `methodSupport` sans vérification horodatée

---

## 5. Liste de Contrôle de Qualité

Avant de fusionner tout changement de fiche linguistique, vérifiez :

- [ ] Chaque nombre de locuteurs a une source (recensement ou Ethnologue, pas Wikipédia)
- [ ] Chaque statut UNESCO/EGIDS a une source
- [ ] Chaque drapeau de support de méthode a été vérifié par rapport à l'API réelle (pas supposé)
- [ ] Chaque influence de contact a une source académique publiée OU est marquée `citation_needed`
- [ ] La classification a été pré-remplie à partir de Glottolog (pas construite manuellement)
- [ ] `dataSources` liste TOUTES les sources consultées
- [ ] Aucune affirmation ne repose uniquement sur des connaissances générées par IA
- [ ] `humanReviewed` est défini à l'identifiant du relecteur et à la date si un locuteur natif a révisé

---

## 6. Champ `humanReviewed`

Le schéma de fiche linguistique inclut un champ `humanReviewed` qui est actuellement `null` sur toutes les fiches. Ce champ doit être rempli lorsqu'un locuteur natif ou un linguiste qualifié révise la fiche :

```json
"humanReviewed": {
  "reviewer": "Prof. Kenneth Jamandre",
  "affiliation": "University of the Philippines",
  "date": "2026-06-08",
  "scope": "full",
  "notes": "Verified speaker count, vitality assessment, and contact influences."
}
```

> [!IMPORTANT]
> **L'examen communautaire est l'étalon-or.** Les données automatisées et les articles académiques fournissent la base, mais l'examen d'un locuteur natif est la validation finale. C'est particulièrement critique pour :
> - Les affirmations d'influence de contact (les membres de la communauté savent quels mots empruntés sont réellement utilisés)
> - Les évaluations de vitalité (les membres de la communauté savent si les enfants parlent la langue)
> - Les systèmes de formalité (les descriptions académiques peuvent manquer les modèles d'utilisation quotidienne)

---

## 7. Références pour Cette Procédure

1. Glottolog : https://glottolog.org — CC-BY 4.0
2. ISO 639-3 : https://iso639-3.sil.org — Gratuit
3. WALS : https://wals.info — CC-BY 4.0
4. CLDR : https://cldr.unicode.org — Conditions d'Utilisation Unicode
5. Ethnologue : https://www.ethnologue.com — Propriétaire (abonnement)
6. Atlas UNESCO : http://www.unesco.org/languages-atlas/ — Gratuit
7. Simons et al. (2022) : https://aclanthology.org/2022.coling-1.379/
8. Spécification de Fiche Linguistique Champollion : `cli/website/docs/reference/language-card-spec.md`
