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
    to: https://champollion.dev/docs/getting-started/configuration
    kind: champollion
    note: "Use the harness to audit registers in production"
---

# Eval Harness v2.0

> **Résumé exécutif.** Cette page couvre l'installation, la configuration et l'utilisation du harnais d'évaluation MT — l'outil qui évalue les méthodes de traduction par rapport à des corpus standardisés et produit des cartes de résultats notées. Pour les définitions canoniques des métriques, des schémas et du protocole d'évaluation, consultez la [Spécification de référence](/docs/network/specifications/benchmark).

Le harnais exécute des expériences de traduction et produit des cartes de résultats. Il gère la construction des invites, les appels API, la notation et la sérialisation des résultats — vous fournissez l'ensemble de données et le modèle.

## Installation

**Prérequis :** Python 3.11+

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
| `--source-file` / `--reference-file` | — | — | Fichiers de texte parallèle (format FLORES+, WMT) |
| `-m, --model` | — | `google/gemini-3.1-pro-preview` | Slug exact du modèle : l'identifiant OpenRouter complet ou le nom exact propre à un fournisseur direct. Aucun alias ni identifiant flottant (`~vendor/…`, `…-latest`) : un nom court tel que `gemini-pro` est refusé, et le refus indique le slug à renseigner. Séparés par des virgules pour les exécutions multi-modèles. Avec `--method local-model`, il s'agit du modèle à exécuter — un identifiant Hugging Face ou un répertoire de modèle — et il est requis : ce moteur ne possède aucun modèle par défaut. Avec un greffon de méthode, il est transmis au greffon sous la forme `config.method_model`. Tout autre moteur de TA traduit avec son propre modèle et l'exécution indique que `-m` n'est pas utilisé |
| `-d, --dataset` | — | `all` | Filtre de jeu de données : `all`, nom de segment ou plage d'identifiants |
| `--ids` | — | — | Identifiants d'entrées séparés par des virgules à évaluer |
| `--source-lang` | — | `English` | Nom de la langue source |
| `--target-lang` | — | — | Nom de la langue cible, tel qu'énoncé dans l'invite. Un code fourni ici (`sme`) est nommé d'après sa fiche de langue (« Northern Sami »), et l'en-tête de l'exécution l'indique ; un code qu'aucune fiche ne mentionne (un `qaa` à usage privé) reste un code, avec un avertissement indiquant que l'invite le contiendra |
| `-p, --prompt` | — | `naive` | Version de l'invite (`naive`, `custom`, `champollion`) |
| `--coaching-file` | — | — | Chemin vers le fichier texte de l'invite de guidage. Il **remplace** l'invite intégrée : le modèle reçoit le fichier tel qu'écrit (plus la ligne `--target-script`), et non l'instruction intégrée « Translate the given … text to …; output only the translation ». L'exécution à blanc et l'en-tête d'exécution l'indiquent en un seul verdict : ✓ lorsque le fichier nomme la langue cible (et sous quel nom ou code), ⚠ lorsqu'il ne nomme ni la langue ni son code, ou non vérifié lorsqu'aucun nom ni code n'est connu |
| `--glossary` | — | — | Glossaire d'évaluation (JSON) pour le respect de la terminologie ; calcul des scores uniquement, jamais envoyé au modèle |
| `--coaching` | — | — | Texte de guidage en ligne (chaîne entre guillemets) |
| `--method` | — | — | Chemin vers le répertoire du greffon de méthode (contient `method.json` + module Python), ou un moteur de TA enregistré (`google-translate`, `deepl`, `local-model`, …) |
| `--allow-model-pair-mismatch` | — | `false` | Avec `--method local-model` : exécuter un modèle de paire OPUS-MT dont l'identifiant désigne une autre paire que celle du corpus (`opus-mt-en-fi` sur un corpus `eng>sme`, en tant que référence de base d'une langue apparentée). Refusé sans cela ; la fiche d'exécution l'enregistre |
| `--method-card` | — | — | Chemin vers le fichier JSON de la fiche de méthode pour les métadonnées du tableau de classement |
| `--skip-fst` | — | `false` | Calculer les scores sans l'acceptation FST, même lorsque la langue dispose d'un FST, et ne rien indiquer de plus. La fiche d'exécution le marque comme non calculé. Sans cette option, un FST manquant (l'analyseur ou son environnement d'exécution pyhfst) n'interrompt pas non plus l'exécution : elle se poursuit, la fiche d'exécution marque l'acceptation FST et la morphologie comme non calculées, et l'avis indique `mt-eval setup --lang <code>`. Après cette installation, `mt-eval test <run log>` ajoute le score FST à l'exécution terminée sans relancer la traduction. Rien ne se télécharge automatiquement |
| `--skip-eval-standard` | — | `false` | Calculer les scores sans les métriques du standard d'évaluation de la fiche de langue (un paquet externe). La fiche d'exécution les marque comme non calculées. Sans cette option, les métriques d'un paquet installé sont calculées ; un paquet non installé constitue un module complémentaire facultatif — l'exécution se poursuit sans ses métriques (marquées non calculées) et indique le `python3 -m pip install` déclaré par la fiche. Rien n'est installé lors d'une exécution |
| `--tools` | — | `false` | Activer le mode d'appel d'outils |
| `--tools-list` | — | — | Noms d'outils séparés par des virgules |
| `--max-tool-rounds` | — | `8` | Nombre maximal de tours d'appel d'outils par entrée |
| `--style-profile` | — | — | Chemin vers un profil de style JSON. Active les métriques de cohérence du style rédactionnel (diagnostics — jamais intégrés au score principal ; voir [§ Métriques de style rédactionnel et de registre](#writing-style-and-register-metrics-informational)) |
| `-b, --batch-size` | — | `25` | Entrées par appel API |
| `-c, --concurrency` | — | `8` | Appels API en parallèle |
| `--max-tokens` | — | `32768` | Nombre maximal de jetons par appel API |
| `--temperature` | — | `0.0` | Température d'échantillonnage (0.0 = déterministe) |
| `--no-cache` | — | `false` | Désactiver la mise en cache des réponses |
| `--cache-dir` | — | `eval/cache/harness` | Chemin du répertoire de cache (voir [Le cache de traduction](#the-translation-cache)) |
| `--metricx` | — | `false` | Calculer également MetricX-24 (Google, Apache-2.0), un score d'erreur neural où une valeur plus basse est meilleure (0–25), rapporté à côté du score principal chrF++ et jamais combiné à celui-ci. Nécessite l'extra `metricx` et le code de modèle de Google (voir [Métriques neurales optionnelles](#opt-in-neural-metrics)) |
| `--metricx-model` | — | `google/metricx-24-hybrid-large-v2p6` | Avec `--metricx` : un autre point de contrôle MetricX (un point de contrôle xl/xxl, ou un `google/metricx-25-*`) |
| `--fuse` | — | `false` | Calculer également le comparateur de type FUSE, une réimplémentation non entraînée de l'approche FUSE d'AmericasNLP 2025, rapporté en tant que comparateur de diagnostic, jamais dans le score principal. Nécessite l'extra `fuse` (voir [Métriques neurales optionnelles](#opt-in-neural-metrics)) |
| `-o, --output-dir` | — | `eval/logs/harness` | Répertoire de sortie pour les fiches d'exécution et les journaux |
| `-n, --name` | — | — | Nom d'exécution lisible |
| `--dry-run` | — | `false` | Valider la configuration et le corpus sans effectuer d'appels API. Indique le fichier de guidage et le glossaire que l'exécution utiliserait (ou `none`), affiche l'invite (l'invite intégrée dans son intégralité ; un fichier de guidage par sa première ligne et son sha256, en précisant qu'il remplace l'invite intégrée), indique l'emplacement du cache de traduction et effectue la même vérification du pack d'évaluation que lors d'une exécution réelle, en la signalant sur des lignes débutant par `EVAL PACK:` (`ready (…)`, `missing — <pieces>; …` ou `none needed for <language>`) sans échouer. Une seconde ligne indique si l'exécution réelle s'arrêterait : un FST manquant ne l'interrompt jamais, tandis que tout autre élément manquant l'interrompt. Sous `--json`, le résumé comprend `coaching_file`, `prompt` (son type, son sha256 et sa longueur ; le texte de l'invite intégrée), `glossary_file` et `eval_pack` (`status`, `missing`, `setup_command`, `blocks_run`, `advisory`) |
| `--target-lang-code` | — | — | Code de langue BCP-47 |
| `--target-script` | — | — | L'écriture ISO 15924 dans laquelle les traductions doivent être rédigées (`Latn`, `Cans`, …), répertoriée dans la fiche de langue de la cible. L'invite du banc d'évaluation la demande (également ajoutée au texte d'un fichier de guidage), elle fait donc partie du sha256 de l'invite. Pour une langue s'écrivant dans plusieurs écritures, comme le cri des plaines, utilisez l'écriture dans laquelle vos références sont rédigées. Sans cela, le banc d'évaluation compte les lettres des références par écriture (un agrégat : aucune phrase n'est affichée, cela s'applique donc aussi à un corpus exclusivement local) et demande l'écriture qui en contient au moins 90 %, en l'indiquant dans l'en-tête d'exécution (« references are 100% Latn → prompting for Latn ») et en l'enregistrant dans le journal d'exécution (`config.target_script_source`) ; les références mixtes ne reçoivent aucune écriture et génèrent un avertissement avec les proportions, et une référence dans l'autre écriture obtient alors un score proche de zéro. Refusé pour un moteur de TA ou un greffon de méthode, qui ne reçoivent aucune invite |

`--champollion-config` et `--prompt champollion` ont été retirés dans la version 0.2.0 et sont refusés avec le motif. Il en va de même pour `--champollion-cards-dir` ; définissez `MT_EVAL_CARDS_DIR` pour pointer le banc d'évaluation vers un autre répertoire de fiches. Ils reconstruisaient le prompt de la CLI en Python, et cette copie avait divergé de la CLI. Utilisez un plugin de méthode (`--method`) pour évaluer une méthode CLI, et `mt-eval export-config` pour réintégrer un résultat dans un projet CLI.

### Métriques neuronales optionnelles

COMET est calculé dès que `unbabel-comet` est installé (`mt-eval setup --comet` : environ 300 Mo d'installation et environ 2,3 Go de modèle lors de la première utilisation). Deux autres métriques sont désactivées à moins qu'une exécution ne les demande explicitement, car chacune charge un modèle volumineux. Tout comme COMET, elles s'exécutent sur cette machine (aucun coût d'API, aucun texte envoyé ailleurs), sont rapportées aux côtés du score principal chrF++ et jamais combinées avec lui, et la fiche d'exécution indique « non exécuté » avec l'option à renseigner lorsqu'elles n'ont pas été demandées.

| Métrique | Option | Prérequis | Ce que cela coûte |
|--------|------|---------------|---------------|
| MetricX-24 (`metricx_score`, plus bas est le meilleur, 0–25) | `--metricx` (point de contrôle : `--metricx-model`) | `python3 -m pip install 'mt-eval-harness[metricx]'` (PyTorch, Transformers, SentencePiece) et le code du modèle de Google, qui ne se trouve pas sur PyPI : `python3 -m pip install git+https://github.com/google-research/metricx` | Le point de contrôle `google/metricx-24-hybrid-large-v2p6` par défaut et le tokeniseur mT5-XL téléchargent plusieurs Go depuis Hugging Face lors de la première utilisation ; l'évaluation est lente sur processeur (CPU). Sans référence, le calcul s'effectue dans son mode sans référence (QE) |
| Comparateur de type FUSE (`fuse_score`) | `--fuse` | `python3 -m pip install 'mt-eval-harness[fuse]'` (sentence-transformers, jellyfish) | LaBSE télécharge environ 1,8 Go lors de la première utilisation. Sans LaBSE, le score n'est pas calculé et le rapport l'indique. Il n'est pas entraîné (une moyenne non pondérée de ses composantes), et le résultat porte la mention `fuse_untrained` |

Via MCP (le profil complet, `--profile full`), `run_benchmark` prend en charge `metricx` (avec `metricx_model`) et `fuse`, et `comet: true` nécessite COMET ; son plan indique si chacun est installé, et une exécution confirmée qui en demande un que le banc d'évaluation ne peut pas calculer est refusée.

La description de ce que chaque métrique mesure et dans quelle mesure s'y fier pour une langue donnée se trouve dans [Évaluation](/docs/network/specifications/scoring) et [Fiabilité des métriques](/docs/network/specifications/metric-reliability).

### Le cache de traduction

Chaque exécution conserve la sortie du modèle pour chaque phrase source dans un cache (`--cache-dir`, par défaut `eval/cache/harness` sous le répertoire où l'exécution démarre), de sorte qu'une nouvelle exécution de la même configuration la réutilise sans coût additionnel. La clé de cache couvre le modèle, le prompt tel qu'envoyé (son sha256), les paramètres influençant les sorties et la version du banc d'évaluation, ce qui garantit qu'une ancienne sortie n'est jamais servie en cas de modification de l'un d'eux. Le cache contient des copies des phrases du corpus :

- l'en-tête d'exécution et l'exécution à blanc affichent son emplacement et le nombre d'entrées qu'il contient ;
- le dossier comporte un fichier `.gitignore`, pour que git l'ignore ;
- il n'est jamais écrit dans un dossier `mt-eval contest prepare` marqué comme publiable (son `public/`) : `mt-eval run` refuse un tel `--cache-dir` ou `--output-dir` et indique à la place le dossier `runs/` du concours ([Organiser un concours souverain](/docs/network/sovereignty/run-a-sovereign-contest)) ;
- un corpus strictement local, scellé ou soumis à consentement dispose de son propre dossier `protected/<namespace>/`, indexé par les paramètres de l'exécution, le sha256 du corpus et ses conditions, et chaque fichier y porte l'empreinte du corpus dans un fichier annexe `<file>.champollion.json` ([Enregistrement des corpus](/docs/network/sovereignty/registering-corpora)) ;
- supprimez le dossier pour effacer les copies, ou transmettez `--no-cache` pour n'en conserver aucune.

Le `run_benchmark` du serveur MCP (profil complet) indique le cache dans son plan et son résultat. Pour un fichier en votre possession, il place le cache aux côtés des résultats de l'exécution (`<corpus folder>/results/cache/`), et pour un identifiant de corpus enregistré, dans son propre dossier (`~/.champollion-mcp/cache/harness/`). Un cache déjà présent dans `eval/cache/harness` sous le répertoire de travail du serveur issu d'exécutions antérieures continue d'être utilisé, afin que ses sorties ne soient pas facturées deux fois. Ses entrées ne dépendent pas de l'emplacement du dossier, il peut donc être déplacé.

### Toutes les sous-commandes

L'ensemble des vingt sous-commandes de premier niveau. Chaque option de chacune d'elles figure dans la
[référence des commandes `mt-eval`](/docs/reference/mt-eval) générée ; cette section
explique la fonction de chacune.

**Exécuter et évaluer**

| Sous-commande | Description |
|---|---|
| `mt-eval run` | Exécuter une session de traduction (options ci-dessus) |
| `mt-eval test <log>` | Analyser le journal d'une exécution terminée. `-o <path>` écrit le rapport ailleurs que dans `<log>_report.json`, et le journal d'exécution consigne ce chemin pour que `card` et `compare` le retrouvent. `--glossary <file>` évalue la terminologie par rapport à ce glossaire ; le rapport consigne son nom et son sha256, et la fiche, `compare` ainsi que l'aperçu avant publication indiquent par rapport à quel glossaire le respect terminologique (un diagnostic) a été évalué |
| `mt-eval compare <reports…>` | Comparer au moins deux exécutions (`*_report.json` ou journaux d'exécution). Une ligne par métrique (chrF++, BLEU, spBLEU, TER, …), une colonne par exécution étiquetée A, B, C…, les métriques où la valeur la plus basse est la meilleure étant signalées ; `--significance` ajoute des tests appariés pour chaque paire, chaque tableau étant désigné par les lettres des exécutions, avec l'IC à 95 % sur Δ, et précise que les valeurs de p sont par métrique et non corrigées ; `--method paired_bootstrap` remplace la randomisation approximative par défaut par le bootstrap de Koehn ([Significativité](/docs/network/specifications/significance)). Écrit `comparison-<hash>.json` (le hachage des identifiants des exécutions comparées, afin qu'une autre comparaison ne l'écrase jamais) aux côtés des rapports lorsqu'ils partagent un dossier, sinon dans `comparisons/` dans leur dossier commun le plus proche (jamais dans le propre dossier d'une exécution), à moins que `-o` ne spécifie un fichier. Le test chrF++ décide à lui seul quelle exécution est meilleure ; les autres lignes sont affichées, mais n'interviennent pas dans la décision. Le score composite d'un ancien rapport est signalé comme obsolète et n'est pas comparé |
| `mt-eval dashboard <logs…>` | Générer un tableau de bord HTML interactif |
| `mt-eval card <run log>` | Afficher une fiche d'exécution lisible dans un format soigné. Les scores proviennent du rapport de l'exécution : aux côtés du journal, là où `mt-eval test -o` l'a consigné, ou dans `--report <path>`. Une exécution sans rapport trouvé affiche NON ÉVALUÉ ainsi que l'emplacement vérifié, jamais des zéros. Un fichier de rapport peut également être transmis ; il est lu avec le journal d'exécution qu'il consigne |

**Mettre une méthode au travail** (aucun calcul de score)

| Sous-commande | Ce qu'elle fait |
|---|---|
| `mt-eval translate` | Traduire une entrée source seule avec une méthode — le pipeline d'exécution sans rien à évaluer. Écrit `.jsonl` ou `.tsv` avec les termes de l'entrée sous forme de fichier lié set/1 ; une méthode dont la sortie est exclusivement locale n'écrit qu'à l'intérieur du projet, à moins que `--holders-agreed-by` n'indique qui parmi les détenteurs des données a donné son accord |
| `mt-eval serve` | Servir une méthode qui s'exécute sur cette machine (`lexicon`, `local-model` ou un greffon de classe de dépendance S ou O) derrière le contrat champollion `/translate`, à partir d'un fichier deployment/1 ou d'options, avec un fichier optionnel gate-chain/1 filtrant chaque réponse. Écoute sur 127.0.0.1 par défaut ; un autre hôte nécessite `$MT_EVAL_SERVE_TOKEN` |

**Choisir une méthode**

| Sous-commande | Description |
|---|---|
| `mt-eval recommend <src> <tgt>` | Recommandations de méthodes pour une paire de langues — disponibilité accompagnée de **preuves citées**, et non un simple classement. La paire peut également être fournie sous la forme `--source <src> --target <tgt>`, format accepté par `corpora` |
| `mt-eval corpora --source X --target Y` | Lister les corpus d'évaluation disponibles pour une paire. Chaque option fonctionne seule : `--target Y` liste tous les corpus vers Y, `--source X` tous les corpus depuis X |
| `mt-eval corpora --with-fst` | Uniquement les corpus dont la langue cible dispose d'un FST figé par le banc d'évaluation, afin que l'acceptation FST puisse être notée. Chaque cible est répertoriée avec l'indication de l'installation de son FST sur cette machine et la façon de l'installer (`mt-eval setup --lang <code>`, ou une installation manuelle pour certains formats). Associez cette commande à `--source`/`--target`, ou utilisez-la seule pour toutes les paires. Rien n'est téléchargé |
| `mt-eval list models\|prompts\|datasets` | Lister les ressources disponibles |

**Contribuer**

| Sous-commande | Ce qu'elle fait |
|---|---|
| `mt-eval publish <report>` | Soumettre un TestReport au tableau de classement |
| `mt-eval queue` | Exécuter la tête de la file de calcul communautaire avec votre propre clé — voir [Contribuer au calcul](/docs/network/getting-started/contributing-compute) |
| `mt-eval export` | Empaqueter un TestReport sous la forme d'un greffon de méthode champollion (un `method.json` method/1) |
| `mt-eval generate-plugin` | Alias pour `export` |
| `mt-eval export-config` | Générer un extrait `champollion.config.json` à partir d'un TestReport |

**Concours et organisation de concours**

| Sous-commande | Ce qu'elle fait |
|---|---|
| `mt-eval contest` | Exécuter ou participer à un **concours souverain** — côté organisateur : `prepare`, `register`, `create`, `rank`, `close`, `export` ; côté participant : `qualify` (auto-évaluer le jeu dev public pour obtenir le récépissé d'admission ; le qualificatif est chrF++ sur 0–100), `validate` (répéter les vérifications du nœud hors ligne), `submit-model` / `submit-method` (soumettre un modèle ou une méthode), `status`, `list`. On participe à un concours en fournissant au nœud de l'organisateur quelque chose qu'il peut EXÉCUTER ; le téléversement de traductions et la liaison vers une fiche autodéclarée ont été abandonnés comme voies d'accès le 06/09/2026 |
| `mt-eval shared-task` | Cadre global d'une édition de tâche partagée multipaires : une ligne regroupe les N concours par paire d'une édition de tâche partagée multipaires et porte ses politiques par défaut. **Regroupement et valeurs par défaut uniquement — chaque contrôle d'accès reste défini par concours** |
| `mt-eval node` | **Le nœud d'évaluation de l'organisateur.** Scrute les soumissions, filtre selon le qualificatif public, autorise selon la politique du concours, évalue par rapport aux **références secrètes détenues par l'organisateur**, publie uniquement les scores. C'est la commande à l'origine de [Organiser un concours souverain](/docs/network/sovereignty/run-a-sovereign-contest) et du [Nœud d'évaluation souverain](/docs/network/sovereignty/sovereign-eval-node) — le corpus ne quitte jamais la machine de l'organisateur |

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

# Run a custom method plugin
mt-eval run \
  --corpus eval-amh-fra-globalvoices-test-v1 \
  --method ./methods/fst-gated-pipeline
```

Le banc d'évaluation ne réessaie ni ne filtre jamais une traduction rejetée par le FST : l'acceptation FST est une métrique, évaluée lorsque le pack d'évaluation de la langue dispose d'un FST. Une méthode qui souhaite des réessais guidés par FST les effectue au sein de son propre greffon, comme l'illustre le tutoriel `fst-gated-pipeline`. (`--fst-retries` et `--hooks` n'ont jamais été reliés à quoi que ce soit sur la ligne de commande ; tous deux sont refusés pour ce motif.)

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
