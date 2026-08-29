---
sidebar_position: 5
title: "Données de coaching"
related:
  - label: "Build a Translation Plugin"
    to: /docs/tutorials/build-a-plugin
    kind: tutorial
    note: "Develop and ship coaching data end-to-end"
  - label: "Plugin Specification"
    to: /docs/reference/plugin-spec
    kind: reference
  - label: "Cookbook: Coached LLM Prompting"
    to: /docs/network/tutorials/coached-llm-prompting
    kind: arena
    note: "The eval-side cookbook for coached methods"
  - label: "Quality Gate"
    to: /docs/concepts/quality-gate
    kind: concept
---

# Données de coaching

Les données de coaching constituent le mécanisme de Champollion pour enseigner aux LLM les langues sur lesquelles ils n'ont pas été entraînés. En fournissant des règles de grammaire, des dictionnaires et des notes de style aux côtés de chaque demande de traduction, vous transformez un LLM à usage général en traducteur conscient du contexte pour n'importe quelle langue — y compris les langues sans aucun support TA existant.

## Fonctionnement

Lorsque vous définissez la méthode d'une paire sur `llm-coached`, Champollion charge un fichier de coaching depuis `.champollion/coaching/<locale>.json` et injecte son contenu dans chaque invite LLM en tant que partie du message système. Le LLM voit vos règles linguistiques aux côtés de la demande de traduction, produisant une sortie qui suit votre grammaire et votre terminologie au lieu de deviner.

```
┌──────────────────────────────────────────────────────┐
│ System Message (cached across batches)               │
│ ┌──────────────────────────────────────────────────┐ │
│ │ Base translation rules                           │ │
│ │ + Register instructions                          │ │
│ │ + Coaching guidance (from coachingFile, if set)   │ │
│ │ + Grammar rules (from coaching data)             │ │
│ │ + Dictionary entries (from coaching data)         │ │
│ │ + Style notes (from coaching data)               │ │
│ └──────────────────────────────────────────────────┘ │
├──────────────────────────────────────────────────────┤
│ User Message (per batch)                             │
│ ┌──────────────────────────────────────────────────┐ │
│ │ Keys to translate (JSON)                         │ │
│ └──────────────────────────────────────────────────┘ │
└──────────────────────────────────────────────────────┘
```

Il existe deux types de contenu de coaching :

1. **Données de coaching structurées** (méthode `llm-coached`) — Règles de grammaire, dictionnaires et notes de style au format JSON. Chargées depuis `.champollion/coaching/<locale>.json` ou depuis le répertoire `coaching/` d'un plugin.
2. **Invite de coaching en texte libre** (champ de configuration `coachingFile`) — Un fichier texte brut avec des conseils supplémentaires injectés dans l'invite système. Fonctionne avec n'importe quelle méthode LLM, pas seulement `llm-coached`. Défini via `coachingFile` dans votre configuration ou `--coaching-file` sur la CLI.

Les deux peuvent être utilisés ensemble. Le harnais d'évaluation utilise exactement la même structure d'invite — vos scores de référence reflètent donc vos invites de production réelles.

Parce que les données de coaching font partie du message système, elles bénéficient de la **mise en cache des invites** — les fournisseurs comme Anthropic et Google mettent en cache les préfixes système répétés, vous ne payez donc que pour le contexte de coaching une fois par session, et non une fois par lot.

## Format du fichier de coaching

Créez un fichier JSON par locale dans `.champollion/coaching/` :

```json title=".champollion/coaching/crk.json"
{
  "grammar_rules": [
    "Plains Cree is polysynthetic — a single word can express what English needs a full sentence for",
    "Animate/inanimate noun distinction affects verb conjugation",
    "Use SRO (Standard Roman Orthography) unless script converter handles conversion",
    "Verb stems are modified by prefixes and suffixes to indicate person, number, tense, and evidentiality"
  ],
  "dictionary": {
    "home": "kīwēwin",
    "settings": "isi-nākatohkēwin",
    "search": "nānātawāpahtam",
    "welcome": "tānisi",
    "submit": "ispīhci",
    "cancel": "pōni"
  },
  "style_notes": "Use formal register. Preserve English technical terms in parentheses when no Cree equivalent exists. Avoid loanwords when a descriptive Cree expression exists."
}
```

### Champs

| Champ | Type | Requis | Description |
|-------|------|--------|-------------|
| `grammar_rules` | `string[]` | Non | Tableau de règles de grammaire injectées dans l'invite système. Chaque règle doit être une instruction concise et exploitable que le LLM peut suivre. |
| `dictionary` | `object` | Non | Mappage clé-valeur de terme anglais → terme dans la langue cible. Utilisé pour le vocabulaire spécifique au domaine que le LLM ne connaîtrait pas. |
| `style_notes` | `string` | Non | Instructions de style en texte libre (registre, ton, conventions de formalité). |

Tous les champs sont optionnels — vous pouvez commencer avec juste un dictionnaire et ajouter des règles de grammaire au fur et à mesure que vous affinez.

## Comportement de secours

Si une paire est configurée pour `llm-coached` mais qu'aucun fichier de coaching n'existe pour cette locale, Champollion **bascule vers la méthode `llm` standard** avec un avertissement sur la console :

```
[INFO] No coaching data for "crk" at .champollion/coaching/crk.json
       Falling back to standard LLM method. Create coaching data for better results.
```

Cela signifie que vous pouvez définir en toute sécurité `"defaultMethod": "llm-coached"` globalement — les langues avec données de coaching l'utiliseront, et les autres obtiendront une traduction LLM standard sans erreurs.

## Quand utiliser le coaching

| Scénario | Méthode recommandée |
|---------|-------------------|
| Langues de niveau 1 (français, espagnol, allemand) | `llm` ou `google-translate` — Les LLM connaissent déjà bien ces langues |
| Langues de niveau 2 (coréen, turc, thaï) | `llm` avec un registre — Les LLM gèrent ces langues correctement avec des conseils de style |
| Langues de niveau 3 (cri des Plaines, yoruba, quechua) | `llm-coached` — Les LLM ont besoin de règles de grammaire et de dictionnaires |
| Conlangs (klingon, sindarin, kryptonien) | `llm-coached` — Les LLM ont des données d'entraînement mais ont besoin de corrections |

## Construire de bonnes données de coaching

### Règles de grammaire

Écrivez les règles comme des **instructions**, pas des descriptions. Le LLM suit mieux les instructions qu'il n'interprète la théorie linguistique.

```json
// ❌ Descriptive (the LLM learns nothing actionable)
"Plains Cree has animate and inanimate noun classes"

// ✅ Instructive (the LLM knows what to do)
"When translating nouns, check whether the Cree equivalent is animate (NA) or inanimate (NI) — this affects which verb conjugation to use"
```

### Dictionnaires

Concentrez-vous sur les **termes spécifiques au domaine** que le LLM se tromperait ou inventerait. Ne vous embêtez pas avec les mots courants que le LLM gère déjà — concentrez-vous sur les termes spécifiques à l'interface utilisateur de votre application.

### Notes de style

Soyez précis concernant le registre, la formalité et les conventions :

```json
"style_notes": "Use formal register (vous-form in French). Preserve brand names untranslated. UI labels should be imperative mood ('Save', not 'Saves'). Maximum 40 characters for button text."
```

## Tester les traductions coachées

Utilisez le [harnais d'évaluation TA](https://github.com/gamedaysuits/Champollion) pour évaluer vos traductions coachées par rapport à un corpus de référence :

```bash
# Install the harness
pip install mt-eval-harness

# Run coached translations against your test corpus
mt-eval run --corpus data/crk-corpus.json --model google/gemini-2.5-pro

# Score the results
mt-eval test eval/logs/run_*.json
```

Cela vous donne les scores chrF++, BLEU et correspondance exacte. Créez plusieurs versions de fichiers de coaching et comparez — les métriques objectives surpassent l'examen subjectif.

---

## Voir aussi

- [Méthodes de traduction](/docs/guides/translation-methods) — la méthode llm-coached
- [Supporter une langue peu dotée en ressources](/docs/network/community/low-resource-languages) — coaching en pratique
- [Spécification des plugins](/docs/reference/plugin-spec) — empaquetage des données de coaching dans un plugin
- [Portail de qualité](/docs/concepts/quality-gate) — comment les traductions coachées sont validées
- [Configuration](/docs/getting-started/configuration) — configuration de coaching par paire
