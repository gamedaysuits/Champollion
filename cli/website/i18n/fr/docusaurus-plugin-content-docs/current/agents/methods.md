---
title: "Méthodes et barrières"
slug: /agents/methods
description: "method/1 et gate-chain/1 tels que chaque outil Champollion les interprète, une barrière de validité FST comme exemple concret, et les recettes de méthodes au-delà du modèle entraîné par défaut — LLM guidé, few-shot, augmenté par dictionnaire, hybride à base de règles, chaîné, traduction partielle, affiné — chacune précisant ce qu'elle envoie et où."
---

# Méthodes et barrières

Une **méthode** est tout ce qui traduit : un modèle entraîné, un LLM guidé par des invites, une
recherche dans un dictionnaire, un moteur de règles, un service, des personnes. Une **barrière** est un contrôle
entre la sortie d'une méthode et ce qui est livré. La méthode par défaut des rails est un
modèle entraîné avec nmt-forge ([entraînement](/docs/agents/training)) ; cette page présente
le format dans lequel toutes deux sont écrites, ainsi que les autres recettes.

Chaque recette ci-dessous respecte les [règles de transmission](/docs/agents/data-rules) :
**une méthode qui appelle un fournisseur de modèles transmet du texte à ce fournisseur**, et un
fichier local uniquement, scellé ou exigeant un consentement le refuse.

## method/1

`$schema` `https://champollion.dev/schemas/method/1.json`. Requis : `id`
(mots en minuscules reliés par des traits d'union), `name`, `kind` — plus le paramètre unique
dont ce type a besoin, vérifié par les lecteurs avec les mêmes messages dans les deux
environnements d'exécution.

| `kind` | Paramètre requis | S'exécute dans | Envoie du texte à |
|---|---|---|---|
| `llm` | `model` (un identifiant exact, jamais un alias) ; `provider` facultatif | CLI ; banc d'évaluation via `-m` et `--provider` | Le fournisseur |
| `llm-coached` | `model` ; le coaching se place dans `coaching` (`file`, `prompt` ou `dir`) | CLI ; banc d'évaluation via `-m` et `--coaching-file` | Le fournisseur : les phrases et le coaching |
| `mt-api` | `engine` (depuis `shared/method-registry.json`) | CLI ; banc d'évaluation | Le service du moteur |
| `local-model` | `model` (un identifiant Hugging Face ou un dossier local) | Banc d'évaluation, dans le processus | Nulle part |
| `nmt-checkpoint` | `model_dir` | À travers son service (`nmt-forge serve`) | Le serveur de cet ordinateur |
| `lexicon` | `dictionary` | Banc d'évaluation, dans le processus | Nulle part |
| `python` | `entry_point` (`module:Class`) | Banc d'évaluation (`mt-eval run --method <folder>`) | Partout où le plugin l'envoie (`dependency_class`) |
| `service` | `service.endpoint` | CLI (méthode `api`) | Ce point de terminaison |
| `human` | — | Des personnes ; évaluez leur résultat avec `mt-eval test` | — |

Facultatif : `version`, `description`, `author`, `pairs` (`{source?, target}`),
`decode` (`temperature` 0–2, `batch_size`, `max_tokens`), `card` (ce qu'affiche le
tableau des scores), `dependency_class` (`S` autonome, `O` externe ouvert,
`A1`/`A2` dépendant d'une API, `X` fermé), `evidence` (exécutions mesurées : `dataset`,
`metric`, `score`, `ci`, `n` — nombres uniquement), `runtimes` (`cli`, `engine`).

**D'où provient un method.json :** `methods/<id>/method.json` dans un projet ;
`nmt-forge export` (type `nmt-checkpoint`) ; `mt-eval export --report <report>
--name <name> --type <type> --locales <code>`; `champollion serve
--emit-manifest` (kind `service`). Les formats plus anciens (le manifeste de plugin du CLI avec
`type`, le manifeste de plugin du banc d'évaluation avec `entry_point`) sont toujours lus, en tant que
method/0, avec un avertissement. Un document portant `$schema` est lu comme
method/1 et doit être validé.

**Quel environnement d'exécution accepte quel type.** Le CLI refuse `python`, `lexicon`,
`local-model` et `human` (*« s'exécute dans le moteur d'évaluation (mt-eval run --method),
pas dans le CLI champollion — ou servez-le et utilisez-le via son point de terminaison »*).
`--method <folder>` du banc d'évaluation ne charge que `python` ; pour tout autre type, il
indique les options qui permettent de l'exécuter à la place.

**Décodage.** La température par défaut est **0** (`shared/model-defaults.json`) :
une valeur unique pour la traduction d'une application et pour l'évaluation du banc d'évaluation, afin
que ce qui est mesuré corresponde à ce qui est livré — `mt-eval run --temperature` l'utilise par défaut.
Une paire, une configuration ou une exécution peut définir la sienne.
Les identifiants de modèle sont des slugs exacts, jamais des alias.

## Chaînes de barrières

`$schema` `https://champollion.dev/schemas/gate-chain/1.json`, un fichier dans
`gates/`. Requis : `id`, `gates` (un ou plusieurs). Facultatif : `description`,
`fallback`.

Chaque barrière : `id`, `kind` (`metric-threshold`, le seul type), `metric` (le
nom d'un plugin de métrique), `field` (une clé dans le résultat par segment de ce plugin — un
nombre, ou vrai/faux lu comme 1/0), `min` et/ou `max`, `on_refuse`.

**Les règles** (`arena/mt_eval_harness/gates.py`) :

- Les barrières s'exécutent dans l'ordre ; la **première** barrière qui refuse un segment décide de ce qui
  est livré :

  | `on_refuse` | Livré | Comptabilisé comme |
  |---|---|---|
  | `drop` | rien | refusé |
  | `keep-source` | le texte source | refusé |
  | `flag` | la sortie, marquée | signalé, non refusé |
  | `fallback` | la traduction de repli, si les mêmes barrières l'acceptent ; si refusée à nouveau, rien | refusé |

- **Verrou.** Un segment que le plugin ne peut pas évaluer est refusé (`no_value` ou
  `plugin_error:<type>`) — jamais livré comme s'il avait réussi le test.
- **Verrou.** Une barrière dont le plugin n'est pas chargé, ou ne peut pas évaluer ici, interrompt
  l'exécution avant que quoi que ce soit ne soit traduit : *« une barrière qui ne peut pas juger n'est jamais
  considérée comme franchie »*.
- **Verrou.** Le repli doit s'exécuter dans ce processus (`lexicon`, `local-model`
  ou un plugin déclarant `dependency_class` `S` ou `O`), afin qu'un segment refusé
  ne quitte pas l'environnement.
- **Verrou.** `mt-eval run` et `mt-eval test` refusent une chaîne comportant une barrière
  `fallback` : *« un repli sert au déploiement et à la traduction, jamais à une mesure :
  le score appartiendrait en partie à cette méthode et en partie au repli, sous un seul
  nom »*. Mesurez le repli en tant que méthode à part entière.
- **Où s'appliquent les barrières :** `mt-eval run --gates`, `mt-eval test <run log>
  --gates` (re-scored without translating again), `mt-eval translate --gates`,
  `mt-eval serve --gates`, et le `gates` d'un déploiement.
- Dans une mesure, le score principal évalue ce qui est livré ; le score chrF++ sans barrière et le
  taux de refus figurent à ses côtés, et l'empreinte de la chaîne (sha256 de son
  JSON canonique) accompagne le rapport ([mesure](/docs/agents/measurement#gated-measurement)).
  Avec `keep-source`, le score principal évalue le texte source là où il a été livré.
- **Verrou.** Chaque barrière requiert `min` et/ou `max`, les identifiants de barrière sont uniques, et une
  barrière `fallback` nécessite le `fallback` de la chaîne — `champollion validate` et
  le banc d'évaluation rendent le même verdict. Réessayer un segment refusé avec le
  motif de la barrière n'est pas prévu.

## Exemple concret : une barrière de validité FST

Un analyseur à états finis (FST) indique si un mot est un mot bien formé de la
langue. Le plugin de métrique du banc d'évaluation `giellalt_fst_validity` rapporte, par
segment, `fst_total_words`, `fst_valid_words`, `fst_invalid_words` et
`fst_validity_rate` (0–1). Les mots sont séparés par les espaces avec suppression de la ponctuation
aux extrémités ; un mot avec majuscule est réessayé en minuscules.

```json
{
  "$schema": "https://champollion.dev/schemas/gate-chain/1.json",
  "id": "fst-every-word",
  "description": "Ship a sentence only when the analyzer accepts every word.",
  "gates": [
    { "id": "fst-all-words", "kind": "metric-threshold",
      "metric": "giellalt_fst_validity", "field": "fst_validity_rate",
      "min": 1.0, "on_refuse": "flag" }
  ]
}
```

```bash
mt-eval setup --status               # the languages with a pinned analyzer
mt-eval setup --fst                  # the analyzer runtime
mt-eval setup --lang <code>          # the language's analyzer, once per machine
mt-eval run --corpus <dev file> --target-lang-code <code> --method local-model -m <model folder> \
  --gates gates/fst-every-word.json
```

- L'analyseur n'est **pas inclus** : le banc d'évaluation ne fournit que des épingles (un nom de fichier
  et un sha256 par langue), et `setup --lang` télécharge l'analyseur depuis sa
  source amont dans `~/.mt-eval/fsts/<code>/`, selon les conditions de l'amont. Il est
  exécuté comme un outil séparé, jamais lié au CLI `champollion`.
- Un analyseur manquant ne devient jamais un zéro : en tant que métrique, il est marqué comme non
  calculé ; en tant que barrière, il interrompt l'exécution.
- Une sortie vide obtient un score de 0 et est refusée en dessous de `min`.
- Pour servir avec celui-ci, utilisez `on_refuse: "fallback"` et un `fallback` tel que
  `{"method": "lexicon", "model": "data/lexicon/words.tsv"}` — pour
  `translate` et `serve` uniquement.
- **Remarque.** L'acceptation par le FST indique qu'un mot existe, non que la phrase a le
  sens attendu. Il s'agit d'un diagnostic : il n'entre jamais dans le score principal chrF++.

## Les recettes

### LLM guidé (`llm-coached`)

Un modèle général guidé par les orientations de la communauté : notes grammaticales, style,
terminologie.

```bash
mt-eval run --corpus <dev file> -m <exact model id> --coaching-file coaching.md --glossary terms.json
champollion sync --method llm-coached --coaching-file coaching.md
```

- **Dans le banc d'évaluation**, le texte du fichier de coaching *est* l'intégralité de l'invite système,
  il doit donc préciser ce qu'il faut traduire et exiger de ne fournir que la traduction.
  `--glossary` est une entrée d'évaluation (respect de la terminologie), jamais envoyée.
- **Verrou.** Une exécution du banc d'évaluation ne comporte qu'un seul coaching : `--coaching-file`, `--coaching`
  (texte en ligne) ou le plus ancien `--custom-prompt` — fournissez-en un seul. Deux simultanément sont
  refusés : *« --coaching-file et --coaching définissent chacun le coaching de l'exécution —
  fournissez-en un seul (placez le texte en ligne dans le fichier, ou supprimez le fichier) »*.
- **Dans le CLI**, `llm-coached` envoie sa propre invite avec le coaching sous forme de
  bloc « Coaching guidance », plus `.champollion/coaching/<locale>.json`
  (`grammar_rules`, `style_notes`, `dictionary`).
- **Remarque.** Il s'agit de deux invites différentes : un score avec coaching mesuré dans le
  banc d'évaluation ne correspond pas à l'invite exacte livrée par le CLI. Précisez-le lorsque vous présentez l'un comme
  preuve de l'autre.
- **Envoie :** chaque phrase source et l'intégralité du coaching au fournisseur. Un
  fichier de coaching accompagné d'un fichier annexe local uniquement ne s'exécute que sur un point de terminaison de bouclage
  (`champollion data mark coaching.md --local-only` en désigne un).

### Few-shot

Des exemples de bonnes traductions intégrés au coaching. Il s'agit d'un LLM guidé : mêmes
commandes, même transport — les exemples sont transmis au fournisseur dans l'invite système.

- **Remarque.** Ne prenez jamais d'exemples dans le jeu de test, et jamais dans un
  fichier local uniquement à destination d'un fournisseur distant. Aucun mécanisme ne vérifie automatiquement
  les exemples few-shot par rapport aux références de test.

### LLM enrichi par dictionnaire

- **CLI :** le `dictionary` présent dans `.champollion/coaching/<locale>.json` est envoyé
  à chaque méthode de LLM sous la mention « REQUIRED TERMINOLOGY » pour les termes trouvés dans chaque
  lot (correspondance de sous-chaîne insensible à la casse). DeepL le reçoit sous la forme d'un glossaire.
  Les infractions font l'objet d'un avertissement après la traduction ; il n'y a pas de nouvelle tentative.
- **Banc d'évaluation :** un dictionnaire ne parvient au modèle que sous forme de texte dans le fichier
  de coaching.
- **Dictionnaire seul :** `mt-eval run --method lexicon -m data/lexicon/words.tsv
  --corpus <dev file>` — syntagme le plus long en premier, mots inconnus conservés, dans
  le processus. `nmt-forge floor` correspond à cela, sur le jeu de développement
  ([mesure](/docs/agents/measurement#the-dictionary-floor)).
- **Envoie :** les entrées correspondantes du dictionnaire, avec les phrases, au
  fournisseur. Un dictionnaire local uniquement ne doit pas être transmis à un fournisseur distant.

### Hybride à base de règles

Aucun moteur de règles n'est intégré. Ce qui existe : `lexicon` (déterministe, dans
le processus) ; `mt-eval run --method apertium` (un moteur à base de règles — il envoie du texte
à `apertium.org` sauf si `APERTIUM_API_URL` pointe vers votre propre serveur) ; et
les plugins `python` pour vos propres règles, éventuellement associés à un LLM. Une classe de plugin
nécessite `async def translate(self, entries, config)` ; exécutez-la avec `mt-eval run
--method <folder>`. Validez sa sortie à l'aide d'une chaîne de barrières.

- **Envoie :** tout ce que le plugin appelle. Un plugin est une méthode externe : sur un
  corpus exigeant un consentement ou scellé (local uniquement inclus), le banc d'évaluation le refuse
  sauf si `--attest-local-transport` est spécifié — ce que vous ne devez transmettre qu'après avoir vérifié
  que tout ce qu'il appelle se trouve sur cette machine.

### Méthodes enchaînées

Deux chaînes sont intégrées :

1. **Le repli d'une chaîne de barrières :** méthode → barrières → repli dans le processus → les
   mêmes barrières. Pour `translate` et `serve` uniquement.
2. **Le repli de paire du CLI** (`"fallback": {"method": …}` sur la paire d'une application) :
   méthode principale → barrière de qualité du CLI → nouvelle tentative avec le retour de la barrière
   (méthodes LLM, ou point de terminaison `api` déclarant `acceptsInstructions`) →
   le repli une fois, à travers la même barrière.

Tout ce qui est plus long (génération, édition, validation à travers plusieurs modèles) relève d'un plugin
`python` ou d'un `service`.

- **Envoie :** chaque maillon envoie ce que son type envoie. Une chaîne n'est aussi confidentielle que son
  maillon le moins confidentiel.

### Traduction partielle (humains et machine)

Le modèle ébauche ; un locuteur vérifie et corrige. Sur les rails, il s'agit du cycle
d'amélioration : `champollion improve sheet` ébauche, le locuteur marque `Y`/`N`/`?`,
`champollion improve marks` transforme les corrections et ébauches confirmées en paires
d'entraînement et les lignes d'exercice en phrases de développement ([coaching](/docs/agents/coaching)).
Pour évaluer les traductions humaines en tant que méthode (`kind` `human`), exécutez
`mt-eval test` sur leurs résultats. Une barrière avec `on_refuse: "flag"` marque la sortie
pour révision.

- **Remarque.** Une phrase utilisée pour guider ou entraîner une méthode ne doit jamais être une phrase sur laquelle
  elle est évaluée.
- **Envoie :** rien au-delà des règles propres au modèle d'ébauche ; les feuilles restent dans
  le dossier du projet.

### Modèle affiné

- **Sur les rails :** `nmt-forge` (`nmt-checkpoint` ; préréglages `cpu-tiny`,
  `byt5-small`, `byt5-small-lowmem`, `cpu-finetune`, `nllb-600m`), exporté,
  servi et connecté —
  [entraînement](/docs/agents/training), [déploiement](/docs/agents/serving).
- **Un modèle ouvert dont vous disposez déjà :** `mt-eval run --method local-model -m
  <Hugging Face id or folder>` — dans le processus ; rien ne quitte la machine.
- **Un LLM que vous servez vous-même** (Ollama, vLLM, tout outil compatible OpenAI) :
  `mt-eval run --provider local --base-url http://127.0.0.1:11434/v1 -m
  <model name>`. Il n'est considéré comme local que lorsque le point de terminaison est une adresse
  de bouclage.
- **Envoie :** rien hors de la machine, lorsque le point de terminaison est véritablement local.

## Pour aller plus loin

- [Spécification des méthodes](/docs/network/specifications/methods) et
  [manifeste de plugin](/docs/reference/plugin-spec) (l'ancien format).
- [Mise à disposition et déploiement](/docs/agents/serving) — deployment/1 et
  service-api/1.
- [Règles de mesure](/docs/agents/measurement) — scores avec barrières.
- [Règles relatives aux données et à la transmission](/docs/agents/data-rules) — ce qui peut être envoyé.
- [Méthodes de traduction pour applications et sites](/docs/guides/translation-methods).
