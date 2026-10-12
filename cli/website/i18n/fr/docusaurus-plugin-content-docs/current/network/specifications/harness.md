---
sidebar_position: 2
title: "Eval Harness v2.0"
related:
  - label: "Scoring Specification"
    to: /docs/network/specifications/scoring
    kind: spec
    note: "What the harness metrics feed into"
  - label: "Statistical Significance Testing"
    to: /docs/network/specifications/significance
    kind: spec
  - label: "Method Interface"
    to: /docs/network/specifications/methods
    kind: spec
  - label: "Run Card Specification"
    to: /docs/network/specifications/run-card
    kind: spec
  - label: "Cookbook: Translate 30 Languages"
    to: https://champollion.dev/docs/tutorials/translate-30-languages
    kind: champollion
    note: "Use the harness to audit registers in production"
---

# Eval Harness v2.0

> **Résumé exécutif.** Cette page couvre l'installation, la configuration et l'utilisation du harnais d'évaluation MT — l'outil qui évalue les méthodes de traduction par rapport à des corpus standardisés et produit des cartes de résultats notées. Pour les définitions canoniques des métriques, des schémas et du protocole d'évaluation, consultez la [Spécification de référence](/docs/network/specifications/benchmark).

Le harnais exécute des expériences de traduction et produit des cartes de résultats. Il gère la construction des invites, les appels API, la notation et la sérialisation des résultats — vous fournissez l'ensemble de données et le modèle.

## Installation

**Prérequis :** Python 3.10+

```bash
python3 -m pip install mt-eval-harness
```

Cela installe la commande `mt-eval`.

## Utilisation

```bash
mt-eval run --corpus path/to/dataset.json
```

Cela exécute chaque entrée du corpus via le modèle configuré (ou le plugin de méthode), note les résultats et écrit un fichier JSON de carte de résultats dans le répertoire de sortie.

## Drapeaux CLI

### `mt-eval run`

| Option | Requis | Par défaut | Description |
|------|----------|---------|-------------|
| `--corpus` | ✅ | — | Chemin vers le fichier de corpus (`.json`, `.jsonl`, `.tsv`) |
| `--source-file` / `--reference-file` | — | — | Fichiers texte parallèles (format FLORES+, WMT) |
| `-m, --model` | — | `google/gemini-3.1-pro-preview` | Slug exact du modèle : l'identifiant OpenRouter complet ou le nom exact propre à un fournisseur direct. Aucun alias ni identifiant flottant (`~vendor/…`, `…-latest`) : un nom court tel que `gemini-pro` est refusé, et le refus indique le slug à renseigner. Séparés par des virgules pour les exécutions multi-modèles. Avec `--method local-model`, il s'agit du modèle à exécuter — un identifiant Hugging Face ou un répertoire de modèles — et il est obligatoire : ce moteur ne dispose d'aucun modèle par défaut. Avec un plugin de méthode, il est transmis au plugin sous le nom de `config.method_model`. Tout autre moteur de TA traduit avec son propre modèle et l'exécution indique que `-m` n'est pas utilisé |
| `-d, --dataset` | — | `all` | Filtre de jeu de données : `all`, nom de segment ou plage d'identifiants |
| `--ids` | — | — | Identifiants des entrées à évaluer séparés par des virgules |
| `--source-lang` | — | `English` | Nom de la langue source |
| `--target-lang` | — | — | Nom de la langue cible, tel qu'énoncé dans le prompt. Un code fourni ici (`sme`) est nommé à partir de sa fiche de langue (« Sami du Nord »), et l'en-tête d'exécution l'indique ; un code qu'aucune fiche ne nomme (un code à usage privé `qaa`) reste sous forme de code, accompagné d'un avertissement précisant que le prompt le transportera |
| `-p, --prompt` | — | `naive` | Version du prompt (`naive`, `custom`, `champollion`) |
| `--coaching-file` | — | — | Chemin vers le fichier texte de prompt de guidage (coaching). Il **remplace** le prompt intégré : le modèle reçoit le fichier tel quel (plus la ligne `--target-script`), et non l'instruction intégrée « Translate the given … text to …; output only the translation ». L'exécution à blanc et l'en-tête d'exécution l'indiquent en un seul verdict : ✓ lorsque le fichier nomme la langue cible (et sous quel nom ou code), ⚠ lorsqu'il ne nomme ni la langue ni son code, ou non vérifié si aucun nom ni code n'est connu |
| `--glossary` | — | — | Glossaire d'évaluation (JSON) pour le respect terminologique ; évaluation uniquement, jamais envoyé au modèle |
| `--coaching` | — | — | Texte de guidage en ligne (chaîne entre guillemets) |
| `--method` | — | — | Chemin vers le répertoire du plugin de méthode (contient `method.json` + module Python), ou un moteur de TA enregistré (`google-translate`, `deepl`, `local-model`, …) |
| `--allow-model-pair-mismatch` | — | `false` | Avec `--method local-model` : exécuter un modèle de paire OPUS-MT dont l'identifiant nomme une autre paire que celle du corpus (`opus-mt-en-fi` sur un corpus `eng>sme`, en guise de référence pour une langue apparentée). Refusé sans cela ; la fiche d'exécution l'enregistre |
| `--method-card` | — | — | Chemin vers le JSON de la fiche de méthode pour les métadonnées du tableau de classement |
| `--fst-retries` | — | `0` | Nombre de tentatives de réessai FST (méthode LLM par défaut uniquement) |
| `--skip-fst` | — | `false` | Évaluer sans l'acceptation FST, même si la langue dispose d'un FST, et ne rien ajouter d'autre. La fiche d'exécution l'indique comme non calculée. Sans cette option, un FST manquant (l'analyseur ou son runtime pyhfst) n'interrompt pas non plus l'exécution : celle-ci se poursuit, la fiche d'exécution marque l'acceptation FST et la morphologie comme non calculées, et l'avertissement mentionne `mt-eval setup --lang <code>`. Après cette installation, `mt-eval test <run log>` ajoute le score FST à l'exécution terminée sans relancer de traduction. Rien ne se télécharge de manière autonome |
| `--skip-eval-standard` | — | `false` | Évaluer sans les métriques standard d'évaluation de la fiche de langue (un paquet externe). La fiche d'exécution les marque comme non calculées. Sans cette option, les métriques d'un paquet installé sont calculées ; un paquet non installé est considéré comme un module optionnel — l'exécution se poursuit sans ses métriques (marquées non calculées) et indique le `python3 -m pip install` déclaré par la fiche. Rien n'est installé par une exécution |
| `--tools` | — | `false` | Activer le mode d'appel d'outils (tool-calling) |
| `--tools-list` | — | — | Noms des outils séparés par des virgules |
| `--max-tool-rounds` | — | `8` | Nombre maximal d'itérations d'appel d'outils par entrée |
| `--hooks` | — | — | Noms des hooks post-traduction |
| `--style-profile` | — | — | Chemin vers un profil de style JSON. Active les métriques de cohérence stylistique (diagnostics — jamais intégrées au score principal ; voir [§ Métriques de style d'écriture et de registre](#writing-style-and-register-metrics-informational)) |
| `-b, --batch-size` | — | `25` | Entrées par appel API |
| `-c, --concurrency` | — | `8` | Appels API en parallèle |
| `--max-tokens` | — | `32768` | Nombre maximal de jetons par appel API |
| `--temperature` | — | `0.0` | Température d'échantillonnage (0.0 = déterministe) |
| `--no-cache` | — | `false` | Désactiver la mise en cache des réponses |
| `--cache-dir` | — | `eval/cache/harness` | Chemin du répertoire de cache (voir [Le cache de traduction](#the-translation-cache)) |
| `--metricx` | — | `false` | Calculer également MetricX-24 (Google, Apache-2.0), un score d'erreur neuronal où le plus bas est le meilleur (0–25), rapporté aux côtés du score principal chrF++ et jamais combiné à celui-ci. Nécessite l'extra `metricx` et le code de modèle de Google (voir [Métriques neuronales optionnelles](#opt-in-neural-metrics)) |
| `--metricx-model` | — | `google/metricx-24-hybrid-large-v2p6` | Avec `--metricx` : un autre point de contrôle MetricX (un checkpoint xl/xxl ou `google/metricx-25-*`) |
| `--fuse` | — | `false` | Calculer également le comparateur de type FUSE, une réimplémentation non entraînée de l'approche FUSE d'AmericasNLP 2025, rapporté en tant que comparateur de diagnostic, jamais dans le score principal. Nécessite l'extra `fuse` (voir [Métriques neuronales optionnelles](#opt-in-neural-metrics)) |
| `-o, --output-dir` | — | `eval/logs/harness` | Répertoire de sortie pour les fiches d'exécution et les journaux |
| `-n, --name` | — | — | Nom d'exécution lisible par un humain |
| `--dry-run` | — | `false` | Valider la configuration et le corpus sans effectuer d'appels API. La commande nomme le fichier de guidage et le glossaire que l'exécution utiliserait (ou `none`), affiche le prompt (le prompt intégré en entier ; un fichier de guidage par sa première ligne et son sha256, et précise qu'il remplace le prompt intégré), indique où se trouve le cache de traduction et effectue la même vérification d'eval-pack que l'exécution réelle, en l'indiquant sur des lignes commençant par `EVAL PACK:` (`ready (…)`, `missing — <pieces>; …` ou `none needed for <language>`) sans échouer. Une seconde ligne précise si l'exécution réelle s'arrêterait : un FST manquant ne l'arrête jamais, tandis que tout autre élément manquant le fait. Sous `--json`, le résumé comprend `coaching_file`, `prompt` (son type, son sha256 et sa longueur ; le texte du prompt intégré), `glossary_file` et `eval_pack` (`status`, `missing`, `setup_command`, `blocks_run`, `advisory`) |
| `--target-lang-code` | — | — | Code de langue BCP-47 |
| `--target-script` | — | — | L'écriture ISO 15924 dans laquelle les traductions doivent être rédigées (`Latn`, `Cans`, …), figurant sur la fiche de langue cible. Le prompt du banc d'évaluation la demande (également ajoutée au texte d'un fichier de guidage), elle fait donc partie du sha256 du prompt. Pour une langue écrite dans plusieurs écritures, comme le cri des plaines, utilisez l'écriture dans laquelle vos références sont rédigées. Sans cela, le banc d'évaluation compte les lettres des références par écriture (un agrégat : aucune phrase n'est affichée, ce qui vaut également pour un corpus strictement local) et demande l'écriture qui en contient 90 % ou plus, en l'indiquant dans l'en-tête d'exécution (« references are 100% Latn → prompting for Latn ») et en l'enregistrant dans le journal d'exécution (`config.target_script_source`) ; les références mixtes n'obtiennent aucune écriture et reçoivent un avertissement avec les proportions, et une référence dans l'autre écriture obtient alors un score proche de zéro. Refusé pour un moteur de TA ou un plugin de méthode, qui ne reçoivent pas de prompt |

`--champollion-config` et `--prompt champollion` ont été retirés dans la version 0.2.0 et sont refusés avec le motif. Il en va de même pour `--champollion-cards-dir` ; définissez `MT_EVAL_CARDS_DIR` pour pointer le banc d'évaluation vers un autre répertoire de fiches. Ils reconstruisaient le prompt de la CLI en Python, et cette copie avait divergé de la CLI. Utilisez un plugin de méthode (`--method`) pour évaluer une méthode CLI, et `mt-eval export-config` pour réintégrer un résultat dans un projet CLI.

### Métriques neuronales optionnelles

COMET est calculé dès que `unbabel-comet` est installé (`mt-eval setup --comet` : environ 300 Mo d'installation et environ 2,3 Go de modèle lors de la première utilisation). Deux autres métriques sont désactivées à moins qu'une exécution ne les demande explicitement, car chacune charge un modèle volumineux. Tout comme COMET, elles s'exécutent sur cette machine (aucun coût d'API, aucun texte envoyé ailleurs), sont rapportées aux côtés du score principal chrF++ et jamais combinées avec lui, et la fiche d'exécution indique « non exécuté » avec l'option à renseigner lorsqu'elles n'ont pas été demandées.

| Métrique | Option | Prérequis | Ce que cela coûte |
|--------|------|---------------|---------------|
| MetricX-24 (`metricx_score`, plus bas est le meilleur, 0–25) | `--metricx` (point de contrôle : `--metricx-model`) | `python3 -m pip install 'mt-eval-harness[metricx]'` (PyTorch, Transformers, SentencePiece) et le code du modèle de Google, qui ne se trouve pas sur PyPI : `python3 -m pip install git+https://github.com/google-research/metricx` | Le point de contrôle `google/metricx-24-hybrid-large-v2p6` par défaut et le tokeniseur mT5-XL téléchargent plusieurs Go depuis Hugging Face lors de la première utilisation ; l'évaluation est lente sur processeur (CPU). Sans référence, le calcul s'effectue dans son mode sans référence (QE) |
| Comparateur de type FUSE (`fuse_score`) | `--fuse` | `python3 -m pip install 'mt-eval-harness[fuse]'` (sentence-transformers, jellyfish) | LaBSE télécharge environ 1,8 Go lors de la première utilisation. Sans LaBSE, le score n'est pas calculé et le rapport l'indique. Il n'est pas entraîné (une moyenne non pondérée de ses composantes), et le résultat porte la mention `fuse_untrained` |

Via MCP, `run_benchmark` accepte `metricx` (avec `metricx_model`) et `fuse`, et `comet: true` requiert COMET ; son plan indique si chacun est installé, et une exécution confirmée qui demande une métrique que le banc d'évaluation ne peut pas calculer est refusée.

La description de ce que chaque métrique mesure et dans quelle mesure s'y fier pour une langue donnée se trouve dans [Évaluation](/docs/network/specifications/scoring) et [Fiabilité des métriques](/docs/network/specifications/metric-reliability).

### Le cache de traduction

Chaque exécution conserve la sortie du modèle pour chaque phrase source dans un cache (`--cache-dir`, par défaut `eval/cache/harness` sous le répertoire où l'exécution démarre), de sorte qu'une nouvelle exécution de la même configuration la réutilise sans coût additionnel. La clé de cache couvre le modèle, le prompt tel qu'envoyé (son sha256), les paramètres influençant les sorties et la version du banc d'évaluation, ce qui garantit qu'une ancienne sortie n'est jamais servie en cas de modification de l'un d'eux. Le cache contient des copies des phrases du corpus :

- l'en-tête d'exécution et l'exécution à blanc affichent son emplacement et le nombre d'entrées qu'il contient ;
- le dossier comporte un fichier `.gitignore`, pour que git l'ignore ;
- il n'est jamais écrit dans un dossier `mt-eval contest prepare` marqué comme publiable (son `public/`) : `mt-eval run` refuse un tel `--cache-dir` ou `--output-dir` et indique à la place le dossier `runs/` du concours ([Organiser un concours souverain](/docs/network/sovereignty/run-a-sovereign-contest)) ;
- un corpus strictement local, scellé ou soumis à consentement dispose de son propre dossier `protected/<namespace>/`, indexé par les paramètres de l'exécution, le sha256 du corpus et ses conditions, et chaque fichier y porte l'empreinte du corpus dans un fichier annexe `<file>.champollion.json` ([Enregistrement des corpus](/docs/network/sovereignty/registering-corpora)) ;
- supprimez le dossier pour effacer les copies, ou transmettez `--no-cache` pour n'en conserver aucune.

Le serveur MCP `run_benchmark` mentionne le cache dans son plan et son résultat. Pour un fichier en votre possession, il place le cache aux côtés des résultats d'exécution (`<corpus folder>/results/cache/`), et pour un identifiant de corpus enregistré, dans son propre dossier (`~/.champollion-mcp/cache/harness/`). Un cache déjà présent dans `eval/cache/harness` sous le répertoire de travail du serveur suite à des exécutions antérieures continue d'être utilisé, évitant ainsi de payer deux fois pour ses sorties. Ses entrées ne dépendent pas de l'emplacement du dossier, il peut donc être déplacé.

### Toutes les sous-commandes

L'ensemble des dix-huit sous-commandes de premier niveau, générées d'après `mt_eval_harness/cli.py`
le 1er août 2026. Jusqu'alors, cette section n'en listait que sept, et six —
y compris `node`, le nœud d'évaluation pour organisateur souverain — n'étaient documentées
**ni ici ni dans le guide du banc d'évaluation**.

**Exécuter et évaluer**

| Sous-commande | Description |
|---|---|
| `mt-eval run` | Exécuter une session de traduction (options ci-dessus) |
| `mt-eval test <log>` | Analyser le journal d'une exécution terminée. `-o <path>` écrit le rapport ailleurs que dans `<log>_report.json`, et le journal d'exécution consigne ce chemin pour que `card` et `compare` le retrouvent. `--glossary <file>` évalue la terminologie par rapport à ce glossaire ; le rapport consigne son nom et son sha256, et la fiche, `compare` ainsi que l'aperçu avant publication indiquent par rapport à quel glossaire le respect terminologique (un diagnostic) a été évalué |
| `mt-eval compare <reports…>` | Comparer au moins deux exécutions (`*_report.json` ou journaux d'exécution). Une ligne par métrique (chrF++, BLEU, spBLEU, TER, …), une colonne par exécution étiquetée A, B, C…, les métriques où la valeur la plus basse est la meilleure étant signalées ; `--significance` ajoute des tests appariés pour chaque paire, chaque tableau étant désigné par les lettres des exécutions, avec l'IC à 95 % sur Δ, et précise que les valeurs de p sont par métrique et non corrigées ; `--method paired_bootstrap` remplace la randomisation approximative par défaut par le bootstrap de Koehn ([Significativité](/docs/network/specifications/significance)). Écrit `comparison-<hash>.json` (le hachage des identifiants des exécutions comparées, afin qu'une autre comparaison ne l'écrase jamais) aux côtés des rapports lorsqu'ils partagent un dossier, sinon dans `comparisons/` dans leur dossier commun le plus proche (jamais dans le propre dossier d'une exécution), à moins que `-o` ne spécifie un fichier. Le test chrF++ décide à lui seul quelle exécution est meilleure ; les autres lignes sont affichées, mais n'interviennent pas dans la décision. Le score composite d'un ancien rapport est signalé comme obsolète et n'est pas comparé |
| `mt-eval dashboard <logs…>` | Générer un tableau de bord HTML interactif |
| `mt-eval card <run log>` | Afficher une fiche d'exécution lisible dans un format soigné. Les scores proviennent du rapport de l'exécution : aux côtés du journal, là où `mt-eval test -o` l'a consigné, ou dans `--report <path>`. Une exécution sans rapport trouvé affiche NON ÉVALUÉ ainsi que l'emplacement vérifié, jamais des zéros. Un fichier de rapport peut également être transmis ; il est lu avec le journal d'exécution qu'il consigne |

**Choisir une méthode**

| Sous-commande | Description |
|---|---|
| `mt-eval recommend <src> <tgt>` | Recommandations de méthodes pour une paire de langues — disponibilité accompagnée de **preuves citées**, et non un simple classement. La paire peut également être fournie sous la forme `--source <src> --target <tgt>`, format accepté par `corpora` |
| `mt-eval corpora --source X --target Y` | Lister les corpus d'évaluation disponibles pour une paire. Chaque option fonctionne seule : `--target Y` liste tous les corpus vers Y, `--source X` tous les corpus depuis X |
| `mt-eval corpora --with-fst` | Uniquement les corpus dont la langue cible dispose d'un FST figé par le banc d'évaluation, afin que l'acceptation FST puisse être notée. Chaque cible est répertoriée avec l'indication de l'installation de son FST sur cette machine et la façon de l'installer (`mt-eval setup --lang <code>`, ou une installation manuelle pour certains formats). Associez cette commande à `--source`/`--target`, ou utilisez-la seule pour toutes les paires. Rien n'est téléchargé |
| `mt-eval list models\|prompts\|datasets` | Lister les ressources disponibles |

**Contribuer**

| Sous-commande | Description |
|---|---|
| `mt-eval publish <report>` | Soumettre un TestReport au tableau de classement |
| `mt-eval queue` | Exécuter le premier élément de la file de calcul communautaire avec votre propre clé — voir [Contribuer à la puissance de calcul](/docs/network/getting-started/contributing-compute) |
| `mt-eval export` | Empaqueter un TestReport sous forme de plugin de méthode champollion |
| `mt-eval generate-plugin` | Alias pour `export` |
| `mt-eval export-config` | Générer un extrait `champollion.config.json` à partir d'un TestReport |

**Concours et organisation de concours**

| Sous-commande | Description |
|---|---|
| `mt-eval contest` | Organiser ou participer à un **concours souverain** — côté organisateur : `prepare`, `register`, `create`, `rank`, `close`, `export` ; côté participant : `qualify` (auto-évaluer le jeu de développement public pour obtenir le récépissé d'admission ; la qualification se fait sur chrF++ de 0 à 100), `validate` (répéter les vérifications du nœud hors ligne), `submit-model` / `submit-method` (transmettre un modèle ou une méthode), `status`, `list`. L'inscription à un concours s'effectue en fournissant au nœud de l'organisateur un élément qu'il peut EXÉCUTER ; le téléversement de traductions et le lien vers une fiche auto-déclarée ont été abandonnés comme voies de participation le 6 septembre 2026 |
| `mt-eval shared-task` | Structure globale pour édition de tâches partagées multi-paires : une ligne regroupe les N concours par paire d'une édition de type AmericasNLP et contient ses règles par défaut. **Regroupement et valeurs par défaut uniquement — chaque point de validation reste propre à chaque concours** |
| `mt-eval node` | **Le nœud d'évaluation de l'organisateur.** Scrute les soumissions, valide le qualificatif public, autorise selon la politique du concours, évalue par rapport aux **références secrètes détenues par l'organisateur**, publie uniquement les scores. Il s'agit de la commande sous-jacente à [Organiser un concours souverain](/docs/network/sovereignty/run-a-sovereign-contest) et au [Nœud d'évaluation souverain](/docs/network/sovereignty/sovereign-eval-node) — le corpus ne quitte jamais la machine de l'organisateur |

`mt-eval node` possède dix-huit sous-commandes propres, dont la voie avec barrière de sécurité physique (airgap)
(`import-bundle`, `export-scores`, `relay`, `egress-check`, `manifest`) et la
cérémonie de garde M-de-N (`ceremony`, `seal`, `keygen`, `sign-manifest`,
`verify-manifest`, `ledger`). Exécutez `mt-eval node --help` ; les mécanismes
de souveraineté sont détaillés sur les deux pages mises en lien ci-dessus.

**Configuration**

| Sous-commande | Description |
|---|---|
| `mt-eval setup` | Installer les dépendances optionnelles (métrique neuronale COMET, runtime FST) |
| `mt-eval logout` | Supprimer les identifiants d'authentification enregistrés |

### Exemples

```bash
# Run with defaults (google/gemini-3.1-pro-preview, naive prompt)
mt-eval run --corpus eval-amh-fra-globalvoices-test-v1

# Coached experiment with coaching file
mt-eval run \
  --corpus eval-amh-fra-globalvoices-test-v1 \
  --model google/gemini-3.1-pro-preview \
  --coaching-file prompts/crk-coaching-v8.txt \
  --temperature 0.0

# Run a custom method plugin with FST retries
mt-eval run \
  --corpus eval-amh-fra-globalvoices-test-v1 \
  --method ./methods/fst-gated-pipeline \
  --fst-retries 3
```

---

## Schéma de la carte de résultats

Chaque expérience produit une **carte de résultats** — un document JSON autonome. La structure de niveau supérieur :

```json
{
  "run_id": "uuid-v4",
  "harness_version": "2.0",
  "model_slug": "google/gemini-3.1-pro-preview",
  "model_id": "gemini-3.1-pro-001",
  "condition": "naive",
  "timestamp": "2026-06-01T03:22:41Z",
  "elapsed_seconds": 142.7,
  "dataset": { ... },
  "config": { ... },
  "method_card": { ... },
  "system_prompt_sha256": "abc123...",
  "system_prompt_used": "You are a translator...",
  "fingerprint": { ... },
  "scores": { ... },
  "totals": { ... },
  "environment": { ... },
  "results": [ ... ],
  "run_card_hash": "sha256-of-entire-card"
}
```

Consultez la [Spécification de la carte de résultats](/docs/network/specifications/run-card) pour le schéma complet avec chaque champ documenté.

:::info[Schéma de référence]
La [Spécification du benchmark](/docs/network/specifications/benchmark) constitue l'unique source de vérité pour le schéma de la fiche d'exécution. Pour la définition des métriques et le calcul des scores d'exécution, consultez la [Spécification d'évaluation](/docs/network/specifications/scoring). Cette page documente l'utilisation du banc d'évaluation ; les spécifications définissent la signification des sorties.
:::

### Blocs clés

**`dataset`** — Identifie quel ensemble de données a été utilisé, y compris son hachage de contenu pour que les résultats soient liés à une version spécifique :

```json
// Example using textbook_dev.json — the 436-entry textbook dev split
{
  "id": "edtekla-dev-v1",
  "version": "1.0",
  "language_pair": "EN→CRK",
  "sha256": "...",
  "entry_count": 436
}
```

**`scores`** — Métriques agrégées pour l'exécution :

```json
// Counts reflect the dataset used (here: textbook_dev.json, 436 entries)
{
  "total": 436,
  "exact_matches": 12,
  "exact_match_rate": 0.0968,
  "fst_accepted": 87,
  "fst_acceptance_rate": 0.7016,
  "chrf_plus_plus": 42.31,
  "errors": 0,
  "avg_latency_seconds": 1.15,
  "median_latency_seconds": 1.02,
  "p95_latency_seconds": 2.34,
  "by_difficulty": { ... },
  "by_provenance": { ... }
}
```

**`totals`** — Suivi de l'utilisation des jetons et des coûts :

```json
{
  "prompt_tokens": 48200,
  "completion_tokens": 3100,
  "reasoning_tokens": 0,
  "cached_tokens": 12000,
  "total_cost_usd": 0.42,
  "cost_per_entry_usd": 0.0034,
  "reasoning_ratio": 0.0
}
```

---

## Métriques de style d'écriture et de registre (informatif) {#writing-style-and-register-metrics-informational}

Le harnais peut évaluer si les traductions correspondent à un **registre** et un **style d'écriture** cibles, via le plugin de métrique `WritingStyleConsistency` (`mt_eval_harness/plugins/writing_style.py`). Une traduction peut être linguistiquement correcte mais dans le mauvais registre — formulation informelle dans un document juridique, passe-partout formel dans une copie marketing — et les métriques de chaîne ne le remarqueront pas. Ces métriques le font.

**Ce qui est mesuré (par entrée) :**

| Métrique | Échelle | Signification |
|----------|--------|-------------|
| `style_register_match` | booléen | La sortie correspond-elle au registre attendu ? La cible provient du champ `register` de l'entrée du corpus (voir [Spécification de référence §2.6](/docs/network/specifications/benchmark)) ou d'un profil de style |
| `style_sentence_length_ratio` | flottant | Longueur moyenne de phrase prédite par rapport à la référence (1.0 = correspondance ; divergence = dérive de style) |
| `style_formality_score` | 0.0–1.0 | Présence de marqueurs formels/informels (pronoms T–V, contractions, …) en utilisant des ressources de marqueurs par langue |

**Agrégat :** `style_consistency_rate` — la fraction d'entrées sans décalage de registre détecté.

Activez une cible personnalisée avec `--style-profile path/to/profile.json` (par exemple, un profil de voix de marque) ; sans elle, le plugin revient aux métadonnées `register` de chaque entrée du corpus le cas échéant.

:::caution[Périmètre d'application]
Ces métriques sont des **diagnostics** — elles ne font jamais partie du score principal, et la détection du niveau de langue repose sur des marqueurs (une heuristique) et non sur un jugement appris. Considérez-les comme un détecteur de dérive pour le respect du registre, et non comme un verdict sur la qualité stylistique.
:::

---

## Empreinte digitale par rapport au hachage de la carte de résultats {#fingerprint-vs-run-card-hash}

Le harnais produit deux hachages distincts. Ils servent des objectifs différents :

### Empreinte digitale

L'**empreinte digitale** répond à : *« Cette exécution pourrait-elle être reproduite ? »*

Elle hache la combinaison d'entrées qui définissent la configuration de l'expérience — pas les résultats :

- SHA-256 du jeu de données
- Slug du modèle
- Libellé de condition
- SHA-256 du prompt système
- Température
- Taille de lot
- Outils activés
- Version du banc d'évaluation

Huit composantes en tout : la taille de lot et l'appel d'outils modifient
substantiellement la sortie, ils font donc partie de l'identité de l'expérience — deux
exécutions avec des tailles de lot différentes ne partagent **pas** la même empreinte. Voir
la [Spécification du benchmark §3.8](/docs/network/specifications/benchmark#38-fingerprint).

Deux exécutions avec des empreintes digitales identiques ont utilisé la même configuration. Leurs résultats doivent être comparables (modulo le non-déterminisme de l'API).

### Hachage de la carte de résultats

Le **hachage de la carte de résultats** répond à : *« Ce fichier de résultat spécifique a-t-il été falsifié ? »*

C'est le SHA-256 de l'ensemble du JSON de la carte de résultats (à l'exclusion du champ `run_card_hash` lui-même). Si un champ change — un score, un horodatage, une seule sortie — le hachage se casse.

:::info[Quand utiliser lequel]
Utilisez l'**empreinte** pour regrouper les exécutions comparables (même expérience, exécutions différentes). Utilisez le **hash de la carte d'exécution** pour vérifier l'intégrité d'un fichier de résultat spécifique.
:::

---

## Publication sur le classement

Une fois l'exécution terminée, utilisez `mt-eval publish` sur le `<run-id>_report.json` de l'exécution. Une écriture sur le tableau de classement public nécessite un `--prod` explicite (ou `MT_EVAL_ALLOW_PROD=1`) ; `mt-eval run --publish --prod` effectue les deux étapes à la fois :

```bash
mt-eval publish eval/logs/harness/<run-id>_report.json --dry-run   # preview
mt-eval publish eval/logs/harness/<run-id>_report.json --prod      # write to the live board
```

Si aucun `--method-card` n'a été fourni lors de l'exécution, `mt-eval publish` lance un assistant interactif (`method_card_wizard.py`) qui vous guide dans la description de votre méthode (nom, classe, outils utilisés, etc.). La sortie de l'assistant est intégrée dans la carte de résultats avant la soumission.

### Inspection manuelle

Les cartes d'exécution sont enregistrées sous forme de fichiers JSON dans le répertoire de sortie (`eval/logs/harness/` par défaut) — inspectez-les là avant de les publier. `mt-eval publish` est le chemin de soumission ; il n'y a pas d'ingestion de carte d'exécution basée sur les PR.

:::note[L'API de soumission et le téléchargement web ne sont pas encore en direct]
Un point de terminaison `POST https://champollion.dev/api/leaderboard/submit` et une interface utilisateur de téléchargement du Leaderboard sont prévus mais **pas encore implémentés**. Jusqu'à leur déploiement, le seul chemin de soumission fonctionnant est `mt-eval publish`.
:::

:::warning[Validation du Leaderboard]
Le leaderboard valide les cartes d'exécution soumises par rapport au registre des ensembles de données. Les soumissions référençant des ensembles de données inconnus, ou avec un `run_card_hash` cassé, sont rejetées.
:::

:::danger[NE PAS ENTRAÎNER sur les données d'évaluation]
Si votre méthode a vu l'ensemble de données d'évaluation au cours du développement — comme données d'entraînement, exemples few-shot, entrées de dictionnaire ou matériel d'ingénierie de prompt — votre soumission sera **disqualifiée**. Consultez [Évaluation MT](/docs/network/leaderboard/rules) pour savoir ce qui constitue une bonne méthode par rapport à une mauvaise.
:::

---

## Voir aussi

- [Évaluation de la TA](/docs/network/leaderboard/rules) — vue d'ensemble, proposition de valeur du tableau de classement et conseils sur les méthodes recommandées et déconseillées
- [Jeux de données d'évaluation](/docs/network/leaderboard/datasets) — format de jeu de données, EDTeKLA, FLORES+
- [Spécification de la fiche d'exécution](/docs/network/specifications/run-card) — le schéma JSON complet
- [Création d'une méthode](/docs/network/specifications/methods) — l'interface de méthode pour concevoir des méthodes évaluables
- [Tableau de classement des méthodes](https://champollion.dev/leaderboard) — scores du benchmark en temps réel
- [Spécification du benchmark](/docs/network/specifications/benchmark) — protocole d'évaluation, format de corpus, schéma de la fiche d'exécution
- [Spécification d'évaluation](/docs/network/specifications/scoring) — source unique de vérité pour les métriques et le calcul des scores d'exécution
