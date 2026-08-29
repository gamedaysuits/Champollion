---
sidebar_position: 4
title: "Contribution de ressources de calcul"
description: "Exécutez la file d'attente : lancez des balayages de référence ouverts à partir de la file d'attente publique avec votre propre clé API et publiez les résultats."
related:
  - label: "Agent Guide: Building & Benchmarking on the Network"
    to: /docs/network/getting-started/agent-guide
    kind: guide
  - label: "Cookbook: Coached LLM Prompting"
    to: /docs/network/tutorials/coached-llm-prompting
    kind: cookbook
  - label: "Cookbook: FST-Gated Pipeline"
    to: /docs/network/tutorials/fst-gated-pipeline
    kind: cookbook
  - label: "Method Interface & Dependency Classes"
    to: /docs/network/specifications/methods
    kind: spec
  - label: "Leaderboard Rules & Trust Tiers"
    to: /docs/network/leaderboard/rules
    kind: guide
---

# Contribuer du calcul

> **L'idée :** le classement comporte des cases vides — des combinaisons (paire de langues, méthode, condition) que personne n'a mesurées. Nous en maintenons une file d'attente publique. Vous exécutez des éléments avec votre propre clé d'API, publiez les rapports, et la carte se remplit. Contribuer de la puissance de calcul est une contribution réelle et citable à l'évaluation de la traduction automatique pour les langues peu dotées.

La file d'attente contient deux types de tâches. Les **éléments LLM** testent un modèle de discussion sur une paire de langues, dans une condition de prompt `naive` ou `coached`. Les **éléments de moteur** (condition `engine`) testent un service de traduction automatique classique — DeepL, Google Translate, Microsoft Translator, LibreTranslate, Tilde — sur des paires incluses dans la couverture publiée par ce service ; ceux-ci constituent l'épine dorsale mesurée de la carte de couverture, et jusqu'en 2026-08, ils étaient presque entièrement vides. Les deux types s'exécutent via le même harnais de test et sont publiés sur le même tableau.

## La file d'attente

La file d'attente en direct est servie depuis la base de données (le harnais la lit par défaut) ; un instantané compact est publié sur [champollion.dev/queue-preview.json](https://champollion.dev/queue-preview.json), avec le fichier complet sur [queue.json](https://champollion.dev/queue.json) (des dizaines de Mo — l'aperçu est le bon choix pour un premier téléchargement). Vous pouvez observer ce que vos exécutions construisent sur [la carte en direct sur champollion.dev](https://champollion.dev) — la carte de couverture indiquant qui peut traduire quoi. Il existe également une visionneuse de terminal sans installation :

```bash
curl -fsSL https://champollion.dev/run_queue | bash -s -- --budget 2
```

Le visualiseur *affiche* uniquement les éléments ouverts et leurs commandes `mt-eval run` exactes — il n'exécute jamais rien ni ne dépense vos jetons. Chaque élément porte :

- `run_command` — prêt à être copié-collé (récupère le corpus, exécute le harnais)
- `est_cost_usd` et `est_basis` — soit le coût **observé** de notre propre exécution de référence pour les mêmes (corpus, modèle), soit une **extrapolation** à partir du coût moyen par entrée de ce modèle lors du balayage × le nombre d'entrées du corpus. La base est indiquée pour chaque élément ; votre coût réel dépend de la tarification du fournisseur au moment de l'exécution.
- `priority` — le classement publié (mode enquête : première lumière à travers
  les paires, les langues et les familles par dollar). L'aperçu publie également
  des **paliers de budget** — ce que 1 $ / 10 $ / 100 $ / 1000 $ permet d'obtenir en haut du
  classement (éléments, paires, modèles atteints) — afin que vous puissiez dimensionner une contribution
  avant de dépenser quoi que ce soit. Le modèle de valeur sous-jacent est la **valeur
  de chaîne attendue** : dans quelle mesure cette exécution spécifique est censée renforcer l'ensemble du maillage linguistique, par dollar estimé. Chaque élément comporte la décomposition complète de sa formule (`edge_strength`, `pair_prior`, `model_offset`, `exploration_bonus`, `predicted_strength`, `expected_mesh_gain`, `ecv_per_usd`) afin que n'importe quel rang puisse être recalculé à la main — la formule et ses valeurs par défaut sont publiées dans la [Spécification de construction de la file d'attente](/docs/network/specifications/queue-construction), et le raisonnement qui la sous-tend dans [Pourquoi la file d'attente est construite de cette façon](/docs/network/perspectives/why-the-queue).

**Pas de verrouillage de réclamation — choisissez n'importe quel élément ouvert.** Deux personnes exécutant le même élément est inoffensif par conception : chaque carte d'exécution est empreinte (SHA-256 sur le hachage du dataset + modèle + condition + invite système, [Spécification d'évaluation §3.8](/docs/network/specifications/benchmark)), donc les exécutions identiques se dédupliquent à la publication, et les réplications indépendantes de la même configuration sont des preuves utiles, non du gaspillage.

Les corpus en file d'attente sont divisés en dev, CC-BY-family (dérivés de Tatoeba), et signalés `do_not_train` — ce sont des ensembles d'évaluation, pas des données d'entraînement. Les corpus sans licence commerciale et en quarantaine sont exclus de la file d'attente ouverte.

## Configuration (une fois)

```bash
# 1. Install the harness (python3 + pipx, no sudo — read it first if you like)
pipx install mt-eval-harness

# 2. Set your API key — any ONE of these; the harness auto-detects it
export OPENROUTER_API_KEY="sk-or-..."     # reaches every model in the queue
# or a direct vendor key:
#   ANTHROPIC_API_KEY / OPENAI_API_KEY / GOOGLE_API_KEY
# (any of them can also live in a local .env file)
```

### Quelle clé de fournisseur ?

Le harnais accepte quatre clés de fournisseur, sélectionnées avec `--provider` sur `mt-eval run` et `mt-eval queue` — ou détectées automatiquement à partir de la clé définie dans votre environnement ou `.env` :

| `--provider` | Clé | Atteint |
|---|---|---|
| `openrouter` (par défaut) | `OPENROUTER_API_KEY` | tous les modèles de la file d'attente |
| `anthropic` | `ANTHROPIC_API_KEY` | modèles Anthropic Claude |
| `openai` | `OPENAI_API_KEY` | modèles OpenAI GPT |
| `gemini` | `GOOGLE_API_KEY` | modèles Google Gemini |

Une clé [OpenRouter](https://openrouter.ai/keys) atteint tous les modèles de la file d'attente, et le suivi des coûts du harnais et les instantanés de tarification proviennent des mêmes métadonnées OpenRouter, donc le coût d'exécution signalé correspond à ce qui a été facturé à votre clé — c'est pourquoi c'est la valeur par défaut. Si vos crédits se trouvent chez Anthropic, OpenAI ou Google directement, définissez la clé de ce fournisseur et le harnais appelle l'API du fournisseur sans proxy. Une clé directe n'atteint que les propres modèles de ce fournisseur (bon pour un lot d'un seul fournisseur), et ses chiffres de coût proviennent de la tarification publiée du fournisseur plutôt que des métadonnées facturées — traitez-les comme des estimations proches. Si une clé OpenRouter et une clé directe sont toutes deux définies, la détection automatique choisit OpenRouter ; le travailleur de file d'attente vous le dit et comment le remplacer avec `--provider`. Chaque carte d'exécution enregistre la voie par laquelle elle a été exécutée dans son champ `api_provider`.

(`mt-eval run` accepte également `--provider local` pour les points de terminaison auto-hébergés compatibles OpenAI — Ollama, vLLM, LM Studio — via `--base-url`. C'est un opt-in explicite, jamais détecté automatiquement.)

### Aucune clé d'API : exécuter un modèle auto-hébergé

Vous n'avez besoin d'aucune clé cloud. La méthode `local-model` exécute un modèle de traduction automatique neuronale ouvert sur votre propre matériel — les modèles que les moteurs cloud ne proposent pas, ce qui correspond exactement là où se trouve la couverture des langues peu dotées : **NLLB-200**, **OPUS-MT** (Helsinki-NLP) et **MADLAD-400**.

```bash
# transformers backend (Hugging Face) — install the extra once:
pip install 'mt-eval[local-models]'

# then point --model at any Hugging Face id (or a local from_pretrained dir):
mt-eval run --method local-model \
  --model facebook/nllb-200-distilled-600M \
  --dataset flores-eng-fra
```

**Deux « méthodes habituelles » pour charger un modèle, sélectionnées automatiquement — rien à configurer :**

- **transformers** (par défaut) : `--model` est un identifiant de hub Hugging Face (`facebook/nllb-200-distilled-600M`, `Helsinki-NLP/opus-mt-en-es`, `google/madlad400-3b-mt`) ou un répertoire `from_pretrained()` local. Nécessite `pip install 'mt-eval[local-models]'`.
- **CTranslate2** (inférence CPU/GPU rapide) : `--model` est un répertoire de modèle converti pour CTranslate2 (produit par `ct2-transformers-converter`, contenant un `model.bin`). Nécessite `pip install 'mt-eval[ctranslate2]'`. Le tokenizer est lu à partir du répertoire converti, ou nommé avec `LOCAL_TOKENIZER_ID`.

Le backend est détecté à partir du chemin du modèle (un répertoire CTranslate2 contient un `model.bin`) ; forcez-le avec `LOCAL_MODEL_BACKEND=transformers|ctranslate2` si vous en avez besoin.

**Les codes de langue proviennent de la fiche de langue, et non d'une supposition.** Pour un modèle multilingue comme NLLB, le harnais lit le code FLORES-200 directement sur la fiche de la langue cible (la même source de vérité utilisée par toutes les méthodes). Une langue que le modèle ne prend véritablement pas en charge — NLLB-200, par exemple, n'inclut pas le Plains Cree (`crk`) — **échoue honnêtement** (« hors de portée pour ce modèle ») plutôt que d'émettre un code factice et une traduction plausible mais erronée. Les modèles OPUS-MT sont spécifiques à une paire, donc la paire *est* le modèle.

L'exécution d'un modèle local est évaluée et publiée exactement comme n'importe quelle autre exécution — mêmes métriques, même fiche d'exécution, même classement. (Il s'agit d'une méthode du harnais ; l'outil de traduction en ligne de commande l'atteint plus tard via un pont de sous-processus, de sorte que Node n'a jamais besoin d'une pile ML Python.)

### Le chemin rapide de l'agent

Si vous travaillez avec Claude Code ou un autre agent de codage, la contribution entière est une invite :

```text
Install the Champollion mt-eval harness with `pipx install mt-eval-harness`.
Fetch https://champollion.dev/queue.json and show me the top 3 open items.
Using my API key (OPENROUTER_API_KEY, or a direct ANTHROPIC_API_KEY /
OPENAI_API_KEY / GOOGLE_API_KEY), execute the run_command of the
item I pick, then run `mt-eval publish` on the generated report JSON and
show me the published run card.
```

## Niveau 0 — Une commande

Le moyen le plus rapide de contribuer est de laisser le harnais prendre le haut de la
file d'attente pour vous :

```bash
mt-eval queue --top 5          # run the 5 highest-value open items
mt-eval queue --budget 2.50    # or: run from the top until ~$2.50 of
                               # estimated spend is committed
mt-eval queue --top 3 --dry-run   # see the plan first, spend nothing
```

Il ne réorganise jamais — l'ordre de la file d'attente *est* le [modèle de priorité](/docs/network/specifications/queue-construction) — et il affiche le plan complet avec les dépenses estimées et demande avant d'exécuter quoi que ce soit. Les éléments entraînés sont ignorés sauf si vous apportez votre propre fichier d'entraînement
(`--include-coached --coaching-file my-coaching.txt`).

**Le travailleur de file d'attente publie pour vous — aucun compte nécessaire.** Contrairement à un seul `mt-eval run` (qui ne publie jamais automatiquement), `mt-eval queue` résout une identité de publication *avant* de dépenser des jetons et **publie automatiquement chaque exécution réussie** au classement au fur et à mesure de sa réalisation — aucune étape de publication séparée. Connectez-vous (GitHub/Google) uniquement si vous voulez votre nom sur le tableau ; sinon, continuez anonymement et les résultats sont publiés en tant que soumetteur `anonymous` (`--anonymous` le force, et les exécutions `curl | bash` non interactives sans connexion en cache par défaut le font, le disant à haute voix). Passez `--no-publish` pour garder les résultats locaux à la place (vous pouvez les publier plus tard avec `mt-eval publish`). Ensuite, observez ce que vos exécutions ont construit sur [la carte en direct à champollion.dev](https://champollion.dev).

## Niveau 1 — Exécuter une évaluation

Chaque `run_command` d'élément de file d'attente est autonome. Un élément typique :

```bash
mt-eval run --corpus eval-eng-yor-tatoeba-dev-v1 \
  --model anthropic/claude-haiku-4.5 \
  --target-lang "Yoruba" \
  --yes
```

Vous passez l'**identifiant du registre**, pas un fichier — le harnais récupère la référence de sa source en amont au moment de l'exécution et évalue par rapport aux données fraîchement récupérées (le contenu du corpus n'est jamais hébergé ou suivi ici).

L'exécution affiche son coût total et écrit un journal d'exécution plus un rapport évalué dans `eval/logs/`. Ensuite, publiez :

```bash
mt-eval publish eval/logs/harness/run_..._report.json
```

**Aucun compte nécessaire.** La publication offre une connexion OAuth (GitHub/Google) afin que votre nom devienne l'attribution du classement — mais c'est optionnel : `mt-eval publish <report> --anonymous` publie sans compte, et la ligne s'affiche exactement comme tout autre résultat auto-évalué avec soumetteur `anonymous`. L'admission anonyme est limitée en débit (quelques cartes par heure par connexion ; la connexion est le chemin illimité) et passe par les mêmes portes d'intégrité de base de données que toute autre soumission — quarantaine, plages de score, liaison corpus-sha, et la garde de contenu de corpus s'appliquent identiquement. Anonyme ou attribué, les soumissions communautaires arrivent au niveau de confiance **auto-évalué** — clairement étiqueté comme « soumis par la personne qui l'a exécuté ». Ce n'est pas une rétrogradation ; c'est le modèle de confiance qui fonctionne. La carte d'exécution porte tout ce qui est nécessaire pour que quiconque réexécute votre configuration exacte : hachage du dataset, modèle, condition, l'invite système complète, et coût. Les niveaux élevés (vérification, validation communautaire) sont accordés par examen — voir [Règles du classement](/docs/network/leaderboard/rules).

:::note[Modération]
Les lignes anonymes sont modérées comme tout le reste : les soumissions sont immuables à l'API publique, et toute suppression ou correction de curateur passe par la voie du rôle de service, où la piste d'audit de la base de données préserve la ligne antérieure — donc une suppression est enregistrée et réversible, jamais silencieuse.
:::

## Niveau 2 — Élaborer des invites entraînées

Le harnais a un support de première classe pour l'**entraînement** : remplacez l'invite système naïve par une qui porte une véritable connaissance linguistique. Passez `--coaching-file` (ou `--coaching "inline text"` pour les invites courtes) et le harnais utilise votre texte comme invite système, enregistre le **texte complet plus son SHA-256** dans le bloc de provenance du journal d'exécution, et étiquette la condition d'exécution **`coached`** (sauf si vous définissez `--prompt` explicitement) — donc l'élaboration d'invite est une expérience reproductible et attribuable, deux fichiers d'entraînement différents ne peuvent jamais être confondus l'un avec l'autre, et les exécutions entraînées ne sont jamais confondues avec les lignes de base naïves sur le classement.

Un exemple travaillé pour le féroïen, utilisant des faits de typologie et des entrées de glossaire de la [carte de langue publique](https://champollion.dev/languages) de la langue :

```text title="coaching-fao.txt"
You are translating English into Faroese (føroyskt).

Grammar notes:
- Faroese is a North Germanic V2 language: the finite verb is the second
  constituent of a main clause.
- Nouns inflect for case (nominative, accusative, dative, genitive),
  gender (masculine, feminine, neuter), and number. Make adjectives and
  determiners agree.
- The skerping pattern applies before -gv/-ggj sequences; preserve
  standard orthography including ð (which is silent).

Glossary (use these exact equivalents):
- language -> mál
- island -> oyggj
- weather -> veður

Style: plain register, modern standard orthography. Output only the
Faroese translation, no commentary.
```

```bash
mt-eval run --corpus eval-eng-fao-tatoeba-dev-v1 \
  --model anthropic/claude-haiku-4.5 \
  --target-lang "Faroese" \
  --coaching-file coaching-fao.txt \
  --yes
```

(Écrivez votre propre contenu d'entraînement — les faits ci-dessus illustrent la *forme* : quelques règles de grammaire à fort impact, un petit glossaire de termes que le modèle se trompe, une instruction de registre. Les cartes de langue à [champollion.dev/languages](https://champollion.dev/languages) citent les sources de typologie dont vous pouvez tirer.)

Comparez avec la ligne de base naïve avec `mt-eval compare <naive_log> <coached_log>`, itérez, et publiez votre meilleure exécution. L'exécution publie avec condition `coached` automatiquement ; si vous voulez que le classement affiche une méthode nommée au lieu de l'étiquette générique, joignez une carte de méthode lorsque vous publiez (le flux de publication offre un assistant). Battre la ligne de base naïve sur une paire peu dotée avec rien d'autre que l'ingénierie d'invite est une découverte genuine et publiable — voir le [livre de recettes complet sur l'invite LLM entraînée](/docs/network/tutorials/coached-llm-prompting) pour des conseils de conception.

## Niveau 3 — Construire une méthode

La contribution la plus ambitieuse : implémenter le protocole `TranslationMethod` (`translate(entries, config)`) et évaluer un système réel, pas une invite. Le harnais l'exécute via `--method <plugin-dir>` et intègre votre carte de méthode dans la carte d'exécution. Modèles avec livres de recettes travaillés :

- **[Pipelines contrôlés par FST](/docs/network/tutorials/fst-gated-pipeline)** — chaque mot candidat est vérifié par un analyseur morphologique ; le LLM régénère jusqu'à ce que la porte passe. Sortie semi-déterministe, morphologie garantie.
- **[Génération augmentée par dictionnaire](/docs/network/tutorials/dictionary-augmented-llm)** — recherchez les termes source dans un lexique bilingue au moment de la traduction et contraignez la sortie.
- [Modèles chaînés](/docs/network/tutorials/chained-models), [récupération few-shot](/docs/network/tutorials/few-shot-prompting), [rétrotraduction](/docs/network/tutorials/back-translation), [hybrides basés sur des règles](/docs/network/tutorials/rule-based-hybrid)…

Les méthodes déclarent une **classe de dépendance** (S/O/A1/A2/X — voir [la spécification des méthodes](/docs/network/specifications/methods#method-validity-and-dependency-classes)) décrivant ce dont elles ont besoin pour s'exécuter et se transférer : un pipeline autonome est la classe S ; celui qui appelle une API de dictionnaire sous licence au moment de l'exécution est A2. Déclarez honnêtement — la classe détermine où votre méthode peut concourir, et les manifestes sont audités.

## Pourquoi cela importe au-delà du classement

Chaque exécution publiée est une preuve indépendante de la qualité de la traduction automatique pour une paire de langues que les fournisseurs commerciaux ne mesurent pas. La file d'attente sert également de registre public de la *demande* : quelles paires la communauté considère comme dignes de mesure, quel coût de couverture aux prix actuels des API, et jusqu'où le calcul contribué s'étend. Lorsque nous demandons aux agences de financement de financer des balayages systématiques, cette file d'attente et son taux de remplissage sont la preuve de la demande.
