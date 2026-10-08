---
sidebar_position: 4
title: "Interface de méthode"
related:
  - label: "Submit a Method"
    to: /docs/network/getting-started/submit-a-method
    kind: guide
    note: "Put this interface on the leaderboard"
  - label: "Eval Harness v2.0"
    to: /docs/network/specifications/harness
    kind: spec
  - label: "Run Card Specification"
    to: /docs/network/specifications/run-card
    kind: spec
  - label: "Cookbook: FST-Gated Translation Pipeline"
    to: /docs/network/tutorials/fst-gated-pipeline
    kind: cookbook
    note: "A full method, built end-to-end"
---

# Interface de Méthode Partagée

> **Résumé exécutif.** Cette page spécifie le protocole `TranslationMethod` que toutes les méthodes Network doivent implémenter, les six classes de méthodes (`raw-llm`, `coached-llm`, `pipeline`, `custom-plugin`, `api`, `human`), l'axe **paradigme** orthogonal (`rule-based`, `statistical`, `neural-nmt`, `llm`, `hybrid`, …) qui rend *comment une méthode traduit* comparable entre systèmes, le format du plugin de méthode, et les **classes de dépendances** (S/O/A1/A2/X) qui déterminent si une méthode peut s'exécuter dans le bac à sable d'évaluation et se qualifier pour les prix. Ce sont trois axes indépendants. Toute approche qui implémente ce protocole peut être comparée ; ce dont elle dépend détermine où elle peut concourir.

Le harnais d'évaluation et champollion partagent un concept commun de **méthode de traduction**. Une méthode est toute procédure qui prend du texte source et produit du texte traduit — qu'il s'agisse d'un appel LLM direct, d'un pipeline multi-étapes, d'une API tierce, ou d'un traducteur humain.

## Architecture

```
Method Plugin (v2 Spec)
├── method.json           ← Manifest (name, class, entry_point, dependencies, metadata)
├── method_card.json      ← Leaderboard description (what, not how)
├── pipeline.py           ← Python module implementing TranslationMethod
└── (optional helpers)    ← Additional Python modules
```

Chargé via `--method path/to/dir`. Le harnais ne découvre rien automatiquement.

## Deux Systèmes, Une Interface

| | Harnais d'évaluation | champollion |
|---|---|---|
| **Langage** | Python | Node.js |
| **Point d'entrée** | `translate.py` | `translate.js` |
| **Interface** | protocole `TranslationMethod` | config `methodPlugin` |
| **Objectif** | Évaluation par lot avec notation | Localisation en direct en dev/CI |
| **Sortie** | Carte d'exécution avec métriques | Fichiers de locale traduits |

Une méthode qui supporte les deux systèmes fournit deux points d'entrée — un pour chaque runtime de langage. La **carte de méthode** est le pont : elle décrit la méthode dans un format que les deux systèmes comprennent.

## Carte de Méthode {#method-card}

Une carte de méthode décrit *ce qu'est* une méthode de traduction sans révéler les détails propriétaires comme l'invite système complète. Elle répond à :

- Quelle classe de méthode est-ce ? (LLM brut, LLM entraîné, pipeline, API, etc.)
- Quel **paradigme** utilise-t-elle ? (basé sur les règles, statistique, neural-nmt, llm, hybride)
- Quels outils utilise-t-elle ? (analyseur FST, dictionnaire, etc.)
- L'implémentation est-elle open source ?
- Quelles paires de langues supporte-t-elle ?

Consultez la [Spécification de Carte de Méthode](/docs/network/specifications/methods#method-card) pour le schéma JSON complet.

### Exemple

```json
{
  "method_id": "fst-gated-v8",
  "name": "FST-Gated Coached Translation v8",
  "class": "pipeline",
  "paradigm": "hybrid",
  "description": "LLM translation with morphological validation. Failed words are retried with FST feedback.",
  "author": "Curtis Forbes",
  "tools_used": ["HFST morphological analyzer", "Wolvengrey dictionary"],
  "open_source": false,
  "dependency_class": "A2",
  "supported_pairs": ["eng>crk"]
}
```

Le champ `dependency_class` résume ce dont la méthode a besoin pour s'exécuter et se transférer — voir [Validité de Méthode et Classes de Dépendances](#method-validity-and-dependency-classes) ci-dessous. Le champ `paradigm` place la méthode sur l'**axe paradigme** (ici `hybrid` : un LLM contrôlé par un FST basé sur les règles) — voir [Paradigmes](#paradigms) ci-dessous.

### Classes de Méthodes

| Classe | Description |
|-------|-------------|
| `raw-llm` | Appel LLM direct avec instruction minimale |
| `coached-llm` | LLM avec invite structurée, exemples, contraintes |
| `pipeline` | Pipeline multi-étapes avec composants déterministes |
| `custom-plugin` | Processus externe implémentant le protocole `TranslationMethod` |
| `api` | API de traduction tierce (Google Translate, DeepL, etc.) |
| `human` | Traduction humaine (pour établir des références) |

### Paradigmes {#paradigms}

Le **paradigme** est un troisième axe indépendant : *comment une méthode traduit au niveau algorithmique*. Il est orthogonal à la fois à la classe de méthode et à la classe de dépendance. La classe de méthode seule est centrée sur les LLM — un système [Apertium](https://www.apertium.org/) basé sur les règles et Google Translate atterrissent tous deux dans `pipeline`/`api`, donc « basé sur les règles vs neural » est invisible sans lui. L'axe paradigme rend cette comparaison de première classe et filtrable sur le classement.

| Paradigme | Description | Exemples |
|----------|-------------|----------|
| `rule-based` | Transducteurs à états finis, grammaires écrites à la main, transfert morphologique | Apertium, génération FST GiellaLT |
| `statistical` | TA basée sur les phrases / statistique (SMT) apprise à partir de corpus parallèles | Moses classique |
| `neural-nmt` | Un modèle de TA neural encoder–decoder dédié | Google Translate, DeepL, Microsoft Translator, OPUS-MT, LibreTranslate, Tilde MT, Translated (Lara) |
| `llm` | Un modèle de langage de grande taille à usage général invité à traduire | un appel GPT / Claude / Gemini brut ou entraîné |
| `hybrid` | Combine deux paradigmes ou plus dans une méthode | un LLM contrôlé par un FST basé sur les règles (crk-translate) ; TA neural + post-édition basée sur les règles |
| `human` | Traduction humaine (référence au niveau paradigme) | référence de traducteur communautaire |
| `unknown` | Non spécifié — la carte n'a déclaré aucun paradigme | compatibilité rétroactive par défaut pour les cartes pré-paradigme |

Les axes sont indépendants. Quelques exemples travaillés :

| Méthode | `class` | `paradigm` | `dependency_class` |
|--------|---------|-----------|--------------------|
| Google Translate | `api` | `neural-nmt` | A2 |
| Tilde MT / Translated (Lara) | `api` | `neural-nmt` | A2 |
| LibreTranslate (auto-hébergé, OSS) | `api` | `neural-nmt` | O |
| Apertium | `pipeline` | `rule-based` | O |
| crk-translate (FST-contrôlé, LLM-entraîné) | `pipeline` | `hybrid` | A2 |
| Appel GPT brut | `raw-llm` | `llm` | A1 |

Le paradigme est **optionnel** sur une carte de méthode ; un paradigme absent est enregistré comme `unknown` (il ne bloque jamais la publication — l'axe est additif). L'énumération ci-dessus est le vocabulaire canonique et supporté, appliqué par le harnais (`config.VALID_PARADIGMS`). Parce que l'application est côté application plutôt qu'une contrainte de base de données, de nouveaux paradigmes peuvent être ajoutés ultérieurement sans migration ; seul le renommage ou la suppression d'une valeur une fois que les méthodes en dépendent est coûteux.

## Validité de Méthode et Classes de Dépendances {#method-validity-and-dependency-classes}

Une méthode n'est exécutable, et n'est transférable, que selon sa dépendance la moins disponible. Deux mécanismes Network dépendent de savoir exactement ce dont une méthode a besoin :

1. **Évaluation en bac à sable** ([Spécification de Benchmark §8.2](/docs/network/specifications/benchmark)) — les scores officiels de référence proviennent d'un bac à sable dont la politique réseau est **refus par défaut**. Une méthode qui nécessite silencieusement un service externe ne peut pas produire un score officiel.
2. **Transfert de prix** ([Spécification de Prix](/docs/network/specifications/prizes)) — les méthodes gagnantes de prix se transfèrent à l'organisation de gouvernance de la communauté linguistique. Une méthode qui regroupe du contenu que le soumetteur n'avait pas le droit d'inclure ne peut pas être transférée légalement. Le soumetteur doit détenir (ou se voir accorder) les droits sur tout ce qui se trouve dans la boîte.

Pour rendre les deux vérifications mécaniques plutôt qu'ad hoc, chaque méthode déclare une **classe de dépendance**, dérivée d'un **manifeste de dépendance** dans `method.json`.

> **Note sur la nomenclature — trois axes indépendants.** *Classe de méthode* (§ci-dessus : `raw-llm`, `pipeline`, …) décrit la *forme* d'une méthode — le contrat d'interface qu'elle présente. *Paradigme* ([§Paradigmes](#paradigms) : `rule-based`, `neural-nmt`, `llm`, …) décrit *comment elle traduit algorithmiquement*. *Classe de dépendance* (cette section) décrit *ce dont elle a besoin pour s'exécuter et se transférer*. Les trois sont orthogonaux : une méthode `pipeline` peut être `rule-based` ou `hybrid`, et peut être de n'importe quelle classe de dépendance. (La classe et le paradigme sont intentionnellement séparés parce que la classe seule est centrée sur les LLM — elle ne peut pas distinguer un système basé sur les règles d'un système neural quand les deux se présentent comme `pipeline` ou `api`.)

### Les Cinq Classes de Dépendances

| Classe | Nom | Définition | Exécutable en bac à sable ? | Admissible aux prix ? |
|-------|------|-----------|-------------------|-----------------|
| **S** | Autonome | Tout le code, les données, les modèles et les poids se trouvent dans le répertoire de méthode, sous des licences qui permettent la redistribution et le transfert communautaire. | ✅ Oui, tel quel | ✅ Oui |
| **O** | Externe ouvert | Dépend d'artefacts hébergés en externe sous des licences ouvertes qui permettent la redistribution (y compris les licences copyleft telles que AGPL) — par exemple, un FST téléchargé au moment de l'installation. | ✅ Oui — les artefacts sont épinglés et **mis en miroir dans la soumission** | ✅ Oui, avec conditions de compatibilité de licence : les termes copyleft sont préservés lors du transfert, et la communauté reçoit les mêmes droits que la licence accorde à tous |
| **A1** | Dépendant d'API, substituable | Nécessite l'inférence LLM à l'exécution, où le modèle est **configuration substituable** — n'importe quel modèle suffisamment capable peut être inséré. La valeur de la méthode réside dans ses invites, ses données d'entraînement et son code, pas dans le modèle d'un fournisseur particulier. | ⚠️ Uniquement via la **passerelle LLM** que la spécification de bac à sable définit (🔲 prévu — voir ci-dessous) | ⚠️ Conditionnel — voir ci-dessous |
| **A2** | Dépendant d'API, non-substituable | Nécessite des appels à l'exécution à une API de données ou de service externe qui ne peut pas être mise en miroir ou substituée — généralement parce que le contenu servi est propriétaire ou sans licence (par exemple, une API de dictionnaire dont le dictionnaire sous-jacent n'a pas de licence publique). | ❌ Non — la dépendance ne peut pas exister dans le bac à sable sans la permission du détenteur des droits | ❌ Pas jusqu'à ce que le détenteur des droits accorde les permissions d'inclusion en bac à sable **et** de transfert. Autorisé sur le classement ouvert (segment de développement) avec un drapeau **« dépendance externe »** visible |
| **X** | Fermé | Regroupe du contenu que le soumetteur n'a pas le droit de redistribuer — ensembles de données sans licence, contenu propriétaire raclé, composants incompatibles avec la licence. | ❌ | ❌ Inadmissible dans chaque voie. Regrouper du contenu sans droits est une violation de licence indépendamment de l'endroit où la méthode s'exécute |

**Classe effective.** La classe de dépendance d'une méthode est la classe *la plus restrictive* parmi toutes ses dépendances déclarées, dans l'ordre S < O < A1 < A2 < X. Un dictionnaire sans licence rend un pipeline autrement autonome Classe A2 (s'il est accédé à l'exécution) ou Classe X (s'il est regroupé sans droits).

### La Distinction A1/A2 : Substituabilité

La plupart des méthodes appellent des LLM. Le Network ne prétend pas le contraire — mais il distingue deux types très différents de dépendance d'API :

- **A1 (substituable) :** L'API fournit l'inférence LLM de base. L'identifiant du modèle est configuration : la méthode doit s'exécuter de bout en bout contre n'importe quel point de terminaison d'inférence compatible, y compris un modèle de poids ouvert hébergé par la communauté. La qualité de sortie peut différer selon les modèles — c'est le risque du développeur, et les scores officiels sont liés au modèle épinglé utilisé dans l'évaluation. Une méthode qui dépend de **l'état côté fournisseur** (un fine-tune hébergé uniquement chez le fournisseur, des magasins de fichiers du fournisseur, des assistants spécifiques au fournisseur) n'est *pas* substituable : cet état ne peut pas être retiré, donc la dépendance est A2 sauf si les poids ou données sous-jacents sont inclus dans la soumission.
- **A2 (non-substituable) :** L'API sert quelque chose d'unique — généralement des données propriétaires ou sans licence. Aucun point de terminaison alternatif ne peut le fournir, et le contenu ne peut pas être mis en miroir dans le bac à sable sans la permission du détenteur des droits. La méthode fonctionne sur le classement ouvert (signalée), mais ne peut pas produire de scores officiels en bac à sable ou se qualifier pour les prix jusqu'à ce que les permissions existent.

**Ce qu'un transfert de prix A1 transmet réellement.** La communauté ne reçoit pas le modèle — personne ne peut transférer les poids d'Anthropic, Google ou OpenAI. Le transfert couvre la recette complète *autour* du modèle : toutes les invites, données d'entraînement, code de pipeline, logique de nouvelle tentative, configuration et exigences de modèle documentées. Parce que le modèle est substituable par construction, la communauté peut pointer la méthode transférée vers n'importe quel fournisseur qu'elle choisit — ou vers un modèle de poids ouvert sur son propre matériel — sans l'implication du développeur. La recette est possédée ; le moteur est loué et remplaçable.

### Manifeste de Dépendance (`method.json`)

Chaque méthode déclare ses dépendances dans le manifeste `method.json`. Chaque entrée enregistre ce qu'est l'artefact, d'où il provient, quelle licence le couvre et comment la méthode y accède :

```json
{
  "name": "FST-Gated Coached Translation v8",
  "method_id": "fst-gated-v8",
  "class": "pipeline",
  "paradigm": "hybrid",
  "entry_point": "pipeline:PipelineMethod",
  "supported_pairs": ["eng>crk"],
  "dependency_class": "A2",
  "dependencies": [
    {
      "id": "giellalt-lang-crk-fst",
      "kind": "software",
      "license": "AGPL-3.0-or-later",
      "access": "mirrored",
      "source": "https://github.com/giellalt/lang-crk",
      "pin": "sha256:3f1a…",
      "redistributable": true,
      "transferable": true
    },
    {
      "id": "llm-inference",
      "kind": "model",
      "license": "proprietary",
      "access": "gateway",
      "source": "openrouter:google/gemini-2.5-flash",
      "substitutable": true,
      "redistributable": false,
      "transferable": false,
      "notes": "Any compatible chat-completions endpoint works; the model slug is configuration."
    },
    {
      "id": "crk-dictionary-api",
      "kind": "service",
      "license": "none",
      "access": "external-api",
      "source": "https://itwewina.altlab.app/",
      "redistributable": false,
      "transferable": false,
      "notes": "Dictionary content has no public license; runtime lookups only. Class A2 until the rights holders grant permission."
    }
  ]
}
```

| Champ | Requis | Description |
|-------|----------|-------------|
| `id` | ✅ | Identifiant stable pour la dépendance |
| `kind` | ✅ | `data`, `model`, `software`, ou `service` |
| `license` | ✅ | Identifiant SPDX, `proprietary`, ou `none`. `none` signifie qu'aucune licence publique n'existe — traité comme tous droits réservés |
| `access` | ✅ | `bundled` (se trouve dans le répertoire de méthode), `mirrored` (récupéré à l'installation, épinglé, vendorisé dans la soumission), `gateway` (inférence LLM à l'exécution via la passerelle d'évaluation), `external-api` (tout autre appel réseau à l'exécution) |
| `source` | ✅ | URL canonique ou identifiant `provider:slug` |
| `pin` | pour `mirrored` | Version, commit ou hash de contenu qui épingle l'artefact exact |
| `substitutable` | pour `gateway`/`external-api` | Si n'importe quel point de terminaison compatible peut servir cette dépendance |
| `redistributable` | ✅ | Si la licence permet de redistribuer l'artefact |
| `transferable` | ✅ | Si l'artefact (ou les droits sur celui-ci) peut se transférer à une communauté selon les termes de transfert de prix |
| `notes` | ❌ | Contexte libre |

**Dérivation de classe.** Chaque dépendance contribue une classe ; la `dependency_class` de la méthode est la plus restrictive :

| Profil de dépendance | Contribue |
|--------------------|-------------|
| `bundled` + la licence permet la redistribution et le transfert | S |
| `mirrored` + licence ouverte permettant la redistribution (copyleft inclus) | O |
| `gateway` + `substitutable: true` (inférence LLM) | A1 |
| `external-api`, ou `gateway` avec `substitutable: false` | A2 |
| `bundled` + `license: none` ou licence incompatible avec la redistribution | X |

La `dependency_class` déclarée doit correspondre à la classe que le harnais dérive du manifeste. Une non-correspondance est une erreur de validation.

Une méthode sans **aucune** dépendance externe déclare `"dependency_class": "S"` et `"dependencies": []`. Le tableau vide est une affirmation positive, auditée comme toute autre.

### Comment la Validité Est Vérifiée

Trois couches, de la moins chère à la plus autoritaire :

1. **Audit du manifeste.** Le harnais dérive la classe effective du manifeste et rejette les non-correspondances. Les examinateurs vérifient chaque dépendance déclarée par rapport à sa licence déclarée et sa source — une dépendance déclarée `redistributable: true` dont la licence en amont dit le contraire échoue l'examen.
2. **Analyse statique.** Le code soumis est analysé pour les appels réseau, les téléchargements dynamiques et l'accès au système de fichiers que le manifeste ne tient pas compte. Une dépendance *non déclarée* trouvée lors de l'examen est motif de rejet indépendamment de la classe qu'elle aurait été — le manifeste doit être complet, pas seulement exact.
3. **Politique réseau du bac à sable.** La spécification du bac à sable nécessite **refus par défaut de sortie** : les conteneurs de méthode n'obtiennent aucun accès réseau sauf si un chemin est explicitement autorisé. Le seul chemin de sortie que la spécification définit est la **passerelle LLM** — un proxy d'inférence exploité par l'infrastructure d'évaluation, restreint à une liste d'autorisation explicite de modèles épinglés, avec chaque demande et réponse enregistrées pour audit post-exécution. Tout ce qui n'est pas sur la liste d'autorisation échoue au niveau réseau, pas au niveau politique. Voir [Spécification de Benchmark §8.6](/docs/network/specifications/benchmark) pour la conception de la politique réseau et de la passerelle.

> **Deux bacs à sable distincts — l'un prévu, l'autre opérationnel.** Lisez ceci attentivement, car le terme « bac à sable » recouvre deux réalités distinctes :
>
> - 🔲 **Prévu : le bac à sable de la plateforme et sa passerelle LLM.** L'environnement exploité par l'infrastructure d'évaluation décrit dans cette section — celui dont la passerelle LLM permettrait aux méthodes de classe A1 de produire des scores officiels de référence — est spécifié mais pas encore construit. Jusqu'à ce qu'il le soit, les méthodes de classe A1 sont admissibles aux prix *en principe* mais ne peuvent pas encore produire de scores officiels de référence.
> - ✅ **Opérationnel : la voie d'exécution des méthodes du nœud organisateur.** Le nœud de notation propre à un organisateur de concours exécute déjà les bundles de méthodes proposés à l'intérieur d'un conteneur isolé du réseau (`mt-eval node run-method`) : construit et exécuté avec `--network=none`, racine en lecture seule, dépendances vendorisées — ce qui le restreint aux méthodes ne nécessitant aucun accès réseau à l'exécution (classe S/O par construction). Il peut s'exécuter sur une véritable machine isolée avec des bundles de scores signés uniquement traversant par média amovible. Consultez [Exécuter un concours souverain](/docs/network/sovereignty/run-a-sovereign-contest) pour le chemin complet.
>
> Cette section décrit ce que la spécification de la plateforme exige, non ce qui s'exécute actuellement sur la plateforme.

### Affichage du Classement

- Le classement affiche la classe de dépendance de chaque méthode aux côtés de son badge de classe de méthode.
- Les méthodes Classe A2 sur le classement ouvert portent un drapeau **« dépendance externe »** visible : leurs scores dépendent d'un service tiers qui peut changer ou disparaître, et elles ne sont actuellement pas admissibles aux prix.
- Les méthodes Classe X ne sont pas listées.

## Harnais d'Évaluation : Protocole TranslationMethod {#eval-harness-translationmethod-protocol}

Le banc d'évaluation utilise le typage structurel de Python (`Protocol`) pour les plugins. Toute classe possédant les membres appropriés fonctionne — aucun héritage n'est requis. Le protocole comporte trois membres ; seul `translate` est requis pour un plugin chargé avec `--method path/to/dir` :

1. **`async translate(entries, config)`** (`-> list[dict]`) — **requis.** La traduction elle-même : un lot d'entrées en entrée, un dictionnaire de résultat par entrée en sortie.
2. **`name`** (`str`) — facultatif. Nom de méthode lisible par l'humain, utilisé dans les journaux. En son absence, le banc d'évaluation utilise le `name` de `method.json`.
3. **`method_card()`** (`-> dict | None`) — facultatif. Métadonnées de méthode pour la traçabilité, intégrées dans le journal d'exécution et la fiche d'exécution publiée. En son absence, le banc d'évaluation génère la fiche à partir de `method.json` : ses `method_id`, `name`, `class`, `paradigm`, `description`, `author`, `version`, `tools_used`, `open_source`, `prompt_published`, `supported_pairs` et `dependency_class` lorsqu'ils sont déclarés, `method_id` prenant par défaut le nom du répertoire du plugin, `class` valant `custom-plugin` et `paradigm` valant `unknown`. L'exécution affiche les membres qu'elle a extraits de `method.json`. Définissez `method_card()` (ou retournez `None` depuis celui-ci) pour remplacer ce comportement.

Lorsque le banc d'évaluation charge un plugin via `--method path/to/dir`, il vérifie tout cela au chargement et signale chaque problème au sein d'une seule erreur : un `translate` manquant, un `name` qui n'est pas une chaîne non vide, un `method_card` qui n'est pas appelable ou ne retourne pas un dictionnaire ou `None`, une fiche générée à partir de `method.json` qui n'est pas une fiche valide (par exemple un `method_id` qui n'est pas en kebab-case), et un `class` ou `paradigm` de fiche en dehors du vocabulaire canonique.

Une exécution de plugin est publiée avec sa classe de méthode comme `condition` (par exemple `custom-plugin` ou `pipeline`), et non les conditions de prompt LLM `naive`/`coached`, qui ne s'appliquent jamais à une méthode traduisant de manière autonome.

**Le modèle fourni à un plugin.** `translate()` reçoit le `RunConfig` de l'exécution. Pour une exécution de plugin, `config.model` est le `method_id` du plugin, l'identité sous laquelle l'exécution est publiée. Le modèle que vous transmettez au plugin avec `-m/--model` est `config.method_model` (une chaîne vide si aucun n'a été fourni), selon la nomenclature utilisée par le plugin, exactement tel qu'indiqué : le banc d'évaluation ne le compare à aucun registre de modèles, ne l'appelle jamais et ne le réécrit jamais. La fiche d'exécution l'enregistre (`method_plugin.model_given` et `method_config.model`) avec les `version`, `dependency_class` et `dependencies` déclarés du plugin ainsi qu'un hachage de ses fichiers ; de plus, le modèle et les dépendances font partie de l'[empreinte](/docs/network/specifications/benchmark#38-fingerprint) de l'exécution, si bien que le même plugin testé sur deux modèles constitue deux expériences distinctes.

```python
class MyMethod:
    name = "My Pipeline v1"  # optional — defaults to method.json's "name"

    def method_card(self) -> dict | None:
        # optional — defaults to a card built from method.json
        return {
            "method_id": "my-pipeline-v1",
            "name": self.name,
            "class": "pipeline",
        }

    async def translate(self, entries: list[dict], config: RunConfig) -> list[dict]:
        # The model given with -m/--model ("" when none was given).
        model = config.method_model
        results = []
        for entry in entries:
            translation = await self.do_translation(entry["source"], model)
            results.append({
                "id": entry["id"],
                "predicted": translation,
                "latency_s": 0.5,
                "usage": {"prompt_tokens": 0, "completion_tokens": 0},
                "error": None,
                "tool_calls": [],
                "tool_call_count": 0,
                "metadata": {},
            })
        return results
```

Le répertoire du plugin a besoin d'un manifeste `method.json` avec au minimum `name` et `entry_point` (`"module_name:ClassName"` — le module est chargé depuis le répertoire du plugin et la classe instanciée). Si une carte de méthode retournée déclare un `class` ou `paradigm`, elle doit utiliser le vocabulaire canonique ci-dessus — une carte hors taxonomie échoue la validation au chargement plutôt que de disparaître silencieusement des filtres du classement.

Pour un exemple complet travaillé — construire, exécuter et soumettre un plugin de bout en bout — consultez [Soumettre une méthode](/docs/network/getting-started/submit-a-method) et le [cookbook du pipeline FST-Gated](/docs/network/tutorials/fst-gated-pipeline).

## champollion : Config methodPlugin

Dans champollion, les méthodes sont enregistrées par paire de langues dans `champollion.config.json` :

```json
{
  "version": 3,
  "pairs": {
    "en:fr": {
      "methodPlugin": "french-formal-v1"
    }
  }
}
```

Consultez la [Spécification de Plugin](https://champollion.dev/docs/reference/plugin-spec) pour l'interface côté champollion.

## Intégration du Classement

Quand une carte de méthode est attachée à une exécution (via `--method-card`), elle est intégrée dans la carte d'exécution et affichée sur le classement :

```bash
# Run with method card attached
mt-eval run \
  --method path/to/my-method \
  --corpus eval-amh-fra-globalvoices-test-v1 \
  --method-card method_card.json

# Publish to the leaderboard
mt-eval publish eval/logs/harness/your-run-card.json
```

Si aucun `--method-card` n'a été fourni, `mt-eval publish` lance un assistant interactif qui vous guide à travers la description de votre méthode.

Le classement affiche :
- **Badge de classe** — indicateur visuel (par exemple, « pipeline », « coached-llm »)
- **Paradigme** — le paradigme algorithmique (par exemple, « rule-based », « neural-nmt », « llm », « hybrid »), une colonne filtrable (voir [Paradigmes](#paradigms))
- **Classe de dépendance** — S/O/A1/A2 (voir [Validité de Méthode et Classes de Dépendances](#method-validity-and-dependency-classes)) ; les méthodes A2 portent un drapeau « dépendance externe »
- **Nom de la méthode** — de la carte de méthode
- **Outils utilisés** — listés de la carte de méthode
- **Indicateur open source**

Quand aucune carte de méthode n'est attachée, le classement affiche la configuration native du harnais (modèle, version d'invite, température, outils activés).

`mt-eval publish --dry-run` affiche ces champs tels que la fiche les comportera — méthode et classe, paradigme, classe de dépendance, outils, indicateur open-source, et pour une exécution de plugin, son hachage de code, sa version et le modèle qui lui a été transmis — avant que quoi que ce soit ne soit envoyé. Le coût d'exécution d'un plugin s'exprime selon les termes de la classe de dépendance déclarée par son `method.json`. Un plugin S ou O n'appelle aucune API : lorsque sa liste `dependencies` ne mentionne aucun accès `gateway` ou `external-api` (y compris le `[]` d'un plugin S), le plan, le résumé d'exécution, la fiche d'exécution, `compare` et l'aperçu avant publication indiquent tous **coût d'API de 0 $ (s'exécute sur cette machine)**, et le rapport enregistre `cost_unknown: false` et `api_cost_usd: 0`. Cela repose sur la déclaration ; le banc d'évaluation exécute le plugin dans son propre processus mais ne surveille pas son utilisation du réseau, de sorte qu'un corpus exclusivement local nécessite toujours l'attestation de l'utilisateur avant qu'un plugin ne puisse le lire. Un plugin A1 ou A2, ou un plugin qui ne déclare aucune classe, effectue et paie ses propres appels, que le banc d'évaluation ne peut pas tarifer : son coût est **inconnu**, jamais 0 $.

:::danger[NE PAS ENTRAÎNER sur les données d'évaluation]
Les méthodes dont le processus de développement a inclus une exposition à l'ensemble de données d'évaluation — en tant que données d'entraînement, exemples few-shot, entrées de dictionnaire ou matériel d'ajustement de prompt — seront **disqualifiées** du classement. Consultez [Évaluation TA](/docs/network/leaderboard/rules) pour comprendre ce qui distingue une bonne méthode d'une mauvaise.
:::

---

## Voir aussi

- [Évaluation de la TA](/docs/network/leaderboard/rules) — vue d'ensemble, valeur pour le classement et recommandations pour de bonnes/mauvaises méthodes
- [Banc d'évaluation](/docs/network/specifications/harness) — comment exécuter des évaluations
- [Jeux de données d'évaluation](/docs/network/leaderboard/datasets) — catalogue de jeux de données, format de corpus et voies de licence (`mt-eval corpora` répertorie ce qui est exécutable)
- [Spécification de la fiche d'exécution](/docs/network/specifications/run-card) — schéma JSON de la fiche d'exécution
- [Spécification des plugins](https://champollion.dev/docs/reference/plugin-spec) — interface des plugins côté Champollion
- [Classement des méthodes](https://champollion.dev/leaderboard) — scores du benchmark en direct
- [Spécification du benchmark](/docs/network/specifications/benchmark) — protocole d'évaluation, format de corpus, schéma de fiche d'exécution
- [Spécification de notation](/docs/network/specifications/scoring) — source unique de vérité (SSOT) pour les métriques et la notation des exécutions
