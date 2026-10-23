---
sidebar_position: 5
title: "Données de coaching"
related:
  - label: "Methods and gates"
    to: /docs/agents/methods
    kind: tutorial
  - label: "Plugin Specification"
    to: /docs/reference/plugin-spec
    kind: reference
  - label: "Quality Gate"
    to: /docs/concepts/quality-gate
    kind: concept
---

# Données de coaching

Les données d'accompagnement (*coaching data*) constituent le mécanisme de champollion permettant de fournir à un LLM ce qu'il ignore au sujet d'une langue. En fournissant des règles de grammaire, des dictionnaires et des notes de style avec chaque requête de traduction, vous apportez à un LLM généraliste le contexte qui lui fait défaut — particulièrement utile pour les langues qu'aucun service de traduction automatique ne traite correctement. Cela ne permet pas d'enseigner à un modèle une langue qu'il n'a jamais rencontrée ; évaluez ce qu'une méthode accompagnée réalise réellement à l'aide du [banc d'évaluation](/docs/network/specifications/harness) avant de vous y fier.

## Comment ça fonctionne

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

1. **Données de coaching structurées** (méthode `llm-coached`) — Règles de grammaire, dictionnaires et notes de style au format JSON. Chargées depuis `.champollion/coaching/<locale>.json` ou le répertoire `coaching/` d'un plugin. Son `dictionary` sert également de glossaire pour le projet : chaque méthode LLM (`llm`, `openai`, `anthropic`, `gemini`, `local`) est informée des termes du glossaire contenus dans chaque lot, DeepL l'envoie en tant que glossaire, et sync émet un avertissement lorsque la sortie d'une méthode omet un terme. Les règles de grammaire et les notes de style ne sont lues que par `llm-coached` — sur n'importe quel fournisseur (`"provider": "openai"`, `"local"`, …).
2. **Prompt de coaching en texte brut** (champ de configuration `coachingFile`) — Un fichier texte brut contenant des instructions supplémentaires injectées dans le prompt système. Fonctionne avec n'importe quelle méthode LLM, pas seulement `llm-coached`. Défini via `coachingFile` dans votre configuration ou `--coaching-file` sur la CLI.

Les deux peuvent être utilisés conjointement. Notez que le banc d'évaluation ne construit pas la même invite (*prompt*) : il envoie le fichier d'accompagnement comme invite système complète, tandis que `champollion sync` l'insère au sein de sa propre invite de traduction. Le score obtenu avec accompagnement via le banc d'évaluation sert donc de repère pour les résultats de la CLI, et non d'une mesure exacte de ceux-ci — évaluez les résultats réels de la CLI sur vos phrases de test avant de vous y fier.

Parce que les données de coaching font partie du message système, elles bénéficient de la **mise en cache des invites** — les fournisseurs comme Anthropic et Google mettent en cache les préfixes système répétés, vous ne payez donc que pour le contexte de coaching une fois par session, et non une fois par lot.

## Format du fichier de coaching

Créez un fichier JSON par locale dans `.champollion/coaching/`. L'exemple
ci-dessous concerne une langue fictive sous `qaa`, un code à usage privé qu'aucune
langue réelle ne possède : chaque règle et terme qu'il contient est un substitut, et non un fait propre à une quelconque
langue. Rédigez le vôtre, idéalement avec un locuteur de la langue, et extrayez
les termes du dictionnaire d'une source que vous pouvez citer.

```json title=".champollion/coaching/qaa.json"
{
  "grammar_rules": [
    "One word can carry what English says in a whole clause: translate the meaning of the phrase, not word by word",
    "Nouns are animate or inanimate, and the verb ending follows the class: check the noun's class before choosing the verb form",
    "Write the standard Latin orthography; the script converter produces the display script",
    "Put the verb first in a command (button labels, menu items)"
  ],
  "dictionary": {
    "home": "<your term for home>",
    "settings": "<your term for settings>",
    "search": "<your term for search>",
    "welcome": "<your term for welcome>",
    "submit": "<your term for submit>",
    "cancel": "<your term for cancel>"
  },
  "style_notes": "Use the formal register. When the language has no term for an English technical word, write a descriptive phrase and keep the English word in parentheses after it."
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
[INFO] No coaching data for "qaa" at .champollion/coaching/qaa.json
       Falling back to standard LLM method. Create coaching data for better results.
```

Cela signifie que vous pouvez définir en toute sécurité `"defaultMethod": "llm-coached"` globalement — les langues avec données de coaching l'utiliseront, et les autres obtiendront une traduction LLM standard sans erreurs.

## Quand utiliser le coaching

| Scénario | Méthode recommandée |
|----------|-------------------|
| Langues à hautes ressources (français, espagnol, allemand) | `llm` ou `google-translate` — les LLM les maîtrisent déjà bien |
| Langues à ressources moyennes (coréen, turc, thaï) | `llm` avec un registre — les LLM les traitent correctement avec des indications de style |
| Langues à faibles ressources (cri des plaines, yoruba, quechua) | `llm-coached` — les LLM ont besoin de règles de grammaire et de dictionnaires |
| Langues construites (klingon, sindarin, kryptonien) | `llm-coached` — les LLM disposent de quelques données d'entraînement mais nécessitent des corrections |

## Construire de bonnes données de coaching

### Règles de grammaire

Écrivez les règles comme des **instructions**, pas des descriptions. Le LLM suit mieux les instructions qu'il n'interprète la théorie linguistique.

```json
// ❌ Descriptive (the LLM learns nothing actionable)
"This language has animate and inanimate noun classes"

// ✅ Instructive (the LLM knows what to do)
"When translating a noun, look up whether it is animate (NA) or inanimate (NI) in the dictionary — the class decides the verb ending"
```

### Dictionnaires

Concentrez-vous sur les **termes spécifiques au domaine** que le LLM se tromperait ou inventerait. Ne vous embêtez pas avec les mots courants que le LLM gère déjà — concentrez-vous sur les termes spécifiques à l'interface utilisateur de votre application.

**Le dictionnaire est vérifié pour chaque méthode.** Quelle que soit la méthode qui traduit une
paire — un modèle hébergé, votre propre modèle via `local`, DeepL, un point de terminaison
`api` — `champollion sync` vérifie chaque chaîne traduite par rapport au
dictionnaire et affiche un avertissement `[TERM]` nommant chaque terme qui n'a pas été utilisé.
Seuls `llm-coached` (dans le prompt) et `deepl` (en tant que glossaire DeepL) l'*appliquent*
également lors de la traduction ; pour les autres, la vérification vous indique quelles
chaînes corriger, par exemple avec `champollion sync --method llm-coached
--redo keys:<key>`.

### Notes de style

Soyez précis concernant le registre, la formalité et les conventions :

```json
"style_notes": "Use formal register (vous-form in French). Preserve brand names untranslated. UI labels should be imperative mood ('Save', not 'Saves'). Maximum 40 characters for button text."
```

## Tester les traductions coachées

Utilisez le [harnais d'évaluation TA](https://github.com/gamedaysuits/Champollion) pour évaluer vos traductions coachées par rapport à un corpus de référence :

```bash
# Install the harness
python3 -m pip install mt-eval-harness

# Run coached translations against your test corpus
mt-eval run --corpus data/crk-corpus.json --model google/gemini-3.1-pro-preview

# Score the results
mt-eval test eval/logs/run_*.json
```

Cela vous donne les scores chrF++, BLEU et correspondance exacte. Créez plusieurs versions de fichiers de coaching et comparez — les métriques objectives surpassent l'examen subjectif.

---

## Voir aussi

- [Méthodes de traduction](/docs/guides/translation-methods) — la méthode llm-coached
- [Ce que c'est](/docs/what-is-champollion) — l'accompagnement en pratique
- [Spécification des plugins](/docs/reference/plugin-spec) — empaqueter les données d'accompagnement dans un plugin
- [Porte de qualité](/docs/concepts/quality-gate) — comment les traductions accompagnées sont validées
- [Configuration](/docs/getting-started/configuration) — configuration de l'accompagnement par paire de langues
