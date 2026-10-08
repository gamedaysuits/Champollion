---
sidebar_position: 1
title: "Référence CLI"
related:
  - label: "Quick Start"
    to: /docs/getting-started/quick-start
    kind: guide
  - label: "Configuration"
    to: /docs/getting-started/configuration
    kind: reference
  - label: "CI/CD"
    to: /docs/guides/ci-cd
    kind: guide
  - label: "Troubleshooting"
    to: /docs/guides/troubleshooting
    kind: guide
---

# Référence CLI

## Commandes

```
champollion init              Interactive setup wizard (--yes for quick defaults)
champollion sync              Translate & sync all locale files
champollion watch             Auto-sync when the source file changes
champollion audit             List untranslated and out-of-date translations (CI completeness gate)
champollion lint              Scan source code for hardcoded strings
champollion wrap              Auto-wrap hardcoded strings in t() calls (with undo)
champollion seo <sub>         Generate hreflang, sitemap.xml, or JSON-LD schema
champollion integrity         Audit locale files for format/encoding issues
champollion repair-script     Restore romanization where script conversion was unwanted
champollion verify            Verify translations are present and correct (CI gate)
champollion status            Show pair configuration, plugins, and benchmark scores
champollion provenance        Audit translation resource licensing
champollion plugin <sub>      Manage method plugins (install, remove, list)
champollion fonts <sub>       Download web fonts for PUA script converters
champollion tm <sub>          Manage Translation Memory cache (stats, clear, seed, prune)
champollion xliff <sub>       Export/import XLIFF 1.2 for professional review
champollion models            List available models from a provider (--method <provider>)
champollion doctor            System health check (cards, config, FSTs, API keys, methods)
```

Les commandes qui interagissent avec l'index partagé et le tableau de classement, plutôt qu'avec votre projet, sont regroupées sous `champollion network`. Chacune fonctionne également sans le préfixe :

```
champollion network card <code>        What the index knows about a language (--json for raw output)
champollion network recommend <s> <t>  Methods you can run for a pair, with the evidence for each, and open models that declare the target (or one pair: eng-crk)
champollion network leaderboard        Published results; install a proven method (--install, --apply)
champollion network register-corpus    Register a test set without handing it over (local-only/private/public/sealed)
champollion network seal-corpus <sub>  Sealed-tier crypto verbs: keygen / seal / open (organizer-node bridge)
champollion network submit             Propose an index entry (review-gated): prints a pre-filled GitHub issue
```

Exécutez `champollion <command> --help` pour obtenir une aide détaillée sur n'importe quelle commande (`champollion network` liste les commandes réseau).

## Options globales

```
--help, -h              Show help (global or per-command)
--version, -v           Print version and exit
--yes, -y               Skip interactive prompts, use defaults
--config <path>         Custom config file path
--dir <path>            Override locales directory
--content-dir <path>    Folder of Markdown/MDX to translate (a Hugo content/ or any folder); each translation is written beside its source as <name>.<locale>.md
--source <code>         Override source locale (default: en)
--model <model>         Translation model for this run only (an exact model slug; aliases and floating "-latest" ids are refused); the config is not changed — to switch for good, edit "model" in champollion.config.json
--method <method>       Translation method for this run only: llm, llm-coached, local, openai, anthropic, gemini, google-translate, deepl, … Overrides the config, including a pair's own method (sync says which); scope with --pair. To switch for good, edit "defaultMethod" (or the pair's "method")
--temperature <n>       LLM temperature (0.0–2.0, default: 0.3)
--coaching-file <path>  Path to free-text coaching prompt file (injected into system prompt)
--format <fmt>          Locale file format: json, toml, yaml, po, arb, or auto
--dry, --dry-run        Preview changes without writing files
--list-keys             With --dry: name every queued key per reason
--concurrency <n>       Max parallel API calls (sets both JSON and content, default: 48)
--json-concurrency <n>  Max parallel locale translations for JSON keys (default: 200)
--content-concurrency <n> Max parallel API calls for content translation (default: 48)
--redo <scope>          Translate again: all | keys:<k1,k2> | content | files:<glob> (repeatable). Cached text is still served, so a redo is cheap. gaps: every plural message on disk without a form its language uses for ordinary counts — asked from the model, not the cache
--prune plural-extras   sync: remove i18next plural keys for a form the language does not have (Spanish count_two) — only those, each one listed; never without this flag
--fresh                 Don't use the cache for what is queued — it is billed again
--files <glob>          Only these content files this run (repeatable; e.g. docs/intro.md, "posts/**")
--force                 Same as --redo all (whole-locale rebuild; scope with --pair)
--force-keys <keys>     Same as --redo keys:<keys> (namespace::key for one file of a multi-file language; \, for a comma inside a key; ctx\x04msgid — or ctx␄msgid — for a gettext entry with a context)
--force-content         Same as --redo content
--retranslate <glob>    Same as --redo files:<glob> --fresh (bypasses the lock and the cache — billed — and replaces paragraphs a person edited in the named files)
--no-tm                 Same as --fresh
--fresh-on-model-change Don't reuse the previous model's cached translations for what this run translates; with --redo all, the new model translates what an earlier model wrote
--pair <src:tgt>        Only these pairs this run, comma-separated (e.g. en:fr,en:de; en>fr and en-fr work too); unknown pairs fail loud (sync, verify, serve)
--max-cost <usd>        sync: stop before any API call if the estimated cost is over this USD cap, or unknown (exit 2, nothing spent)
--no-verify             Skip post-sync verification pass
--strict                verify: warnings fail the check too (exit 1)
--script <choice>       init: writing system of a language with two real orthographies, e.g. crk=Cans
--name <code=name>      init: display name of a language with no card (a private-use code), e.g. qaa="Ayta (variety not yet confirmed)"
--locale <code>         Target locale (xliff export, tm clear)
--quiet                 Errors and warnings only — suppress banner, progress bar, and info lines
--json                  Machine-readable NDJSON output — one JSON object per event
```

### Écriture d'une paire de langues

Une paire de projet s'écrit de la manière dont `champollion.config.json` la référence : `en:fr`. `sync`, `verify` et `serve` acceptent également `en>fr` et `en-fr`, et `en-pt-BR` est mise en correspondance avec les paires que vous avez configurées. Les commandes réseau (`network register-corpus`, `leaderboard`, `recommend`, `submit`) écrivent une paire sous la forme `eng>crk`, le format que le tableau de classement stocke et que `mt-eval` utilise, et lisent `eng-crk` et `eng:crk` de la même façon. Avec des traits d'union uniquement, une paire est composée de deux codes de deux ou trois lettres (`eng-crk`). Un code contenant déjà un trait d'union nécessite `>` : `--pair "eng>pt-BR"`. `eng-pt-BR` est refusé et n'est jamais deviné. Mettez la forme `>` entre guillemets dans un shell : sans guillemets, `--pair eng>crk` redirige la sortie vers un fichier nommé `crk`.

---

## init

Assistant de configuration interactif qui crée `champollion.config.json`. Vous guide à travers la locale source, les langues cibles, le format de fichier et le modèle de traduction.

```bash
champollion init                          # interactive wizard
champollion init --yes                    # skip wizard, use defaults
champollion init --yes --langs fr,de,ja   # quick setup with specific languages
champollion init --source en --dir ./i18n # overrides with defaults
champollion init --yes --langs crk --content-dir newsletters  # also translate a folder of Markdown
champollion init --yes --langs abc --method api --endpoint http://127.0.0.1:8378/translate --accepts-instructions false
```

**Option `--content-dir`** : un dossier de fichiers Markdown/MDX à traduire en plus de vos fichiers de locale (noté `contentDir`). Le dossier doit exister ; `init` s'arrête sans rien écrire s'il n'existe pas.

**Un projet contenant un fichier exclusivement local utilise par défaut `local`** : la méthode par défaut est `llm` (OpenRouter, un service hébergé). Lorsqu'un fichier, où que ce soit dans le projet, est marqué comme exclusivement local — un `<file>.champollion.json` à côté avec `"transmission": "local-only"`, comme l'écrit `champollion network register-corpus --data <file> --tier local-only` —, `init` (ainsi que `--yes`) bascule par défaut sur la méthode `local` : un modèle servi sur cette machine (la valeur par défaut d'Ollama `http://localhost:11434/v1`, ou le serveur désigné par `LOCAL_API_BASE`). Il en explique la raison en nommant le fichier marqué, et indique comment choisir délibérément une méthode hébergée : `champollion init --force --method llm --model <model>`. Une option `--method` explicite l'emporte toujours ; `init` signale alors le fichier marqué à côté de la destination du texte.

**Réexécuter `init` (`--force`)** : sans `--force`, `init` s'arrête lorsque `champollion.config.json` existe. Avec cette option, `init` part de ce fichier et ne réécrit que ce que les drapeaux spécifient : `--langs` définit la liste des langues cibles (une langue déjà présente conserve son entrée — registre, graphie, nom), `--method` la méthode par défaut (et le modèle associé, sauf si `--model` en désigne un), `--model`, `--temperature`, `--source`, `--dir`, `--format`, `--content-dir`, `--script`, `--name`, et `--method api` les paires spécifiées. Il ne redétecte la disposition des locales que lorsque le fichier ne trouve plus vos fichiers sources (ou que `--dir` indique un autre dossier). Tous les autres paramètres — `batchSize`, `pairs`, `glossary`, solutions de repli, registres choisis — restent inchangés. Il affiche chaque champ modifié et ceux conservés, et copie d'abord le fichier précédent dans `champollion.config.json.bak` (lorsque cette sauvegarde contient déjà un fichier plus ancien, le suivant est `.bak.2`, `.bak.3`… ; une ancienne sauvegarde n'est jamais écrasée). Un fichier qui n'est pas un JSON valide ne peut pas être conservé : il est sauvegardé et un nouveau fichier est écrit. Pour modifier un seul paramètre, éditez-le directement dans le fichier — `init` n'a jamais besoin d'être réexécuté pour cela.

**Localisation de vos fichiers de locale** : `init` recherche le fichier de votre langue source avant d'écrire quoi que ce soit. Il vérifie d'abord le dossier habituel de votre framework (next-intl `messages/`, i18next `public/locales/<lang>/` puis `locales/<lang>/`, vue-i18n `src/locales/`, Hugo `i18n/`), puis `locales`, `messages`, `i18n`, `lang`, `translations`, `public/locales`, `src/locales` et `src/i18n`, et affiche ce qu'il a trouvé. Il n'écrit jamais un `localesDir` qui n'existe pas. Consultez [Dispositions des fichiers de locale](/docs/getting-started/configuration#locale-layouts).

**Option `--langs`** : liste de codes de langues cibles séparés par des virgules. Ignore l'invite de sélection de langue et applique le préréglage de registre par défaut de chaque langue — inscrit dans la configuration, rendant le choix visible et modifiable : `"languages": { "fr": "formal-vous", "es": "neutral-latam" }` (remplacez-en un par un autre préréglage, ou par vos propres termes décrivant le ton ; une langue sans préréglage est inscrite sous la forme `{}`). Elle crée également les fichiers cibles vides selon votre structure (`fr.json`, ou `fr/common.json` pour chaque espace de noms). Combinez avec `--yes` pour une configuration entièrement non interactive.

**`--method api --endpoint <url>`** : un serveur respectant le contrat d'API de champollion — par exemple un modèle que vous avez entraîné, servi par `nmt-forge serve`. `init` écrit une paire par cible, la même entrée que le `DEPLOY.md` à côté du modèle : `"pairs": { "en:abc": { "method": "api", "endpoint": "http://127.0.0.1:8378/translate", "acceptsInstructions": false } }`. `--accepts-instructions true|false` indique si le point de terminaison suit des instructions par clé (un modèle entraîné avec nmt-forge ne le fait pas) ; sans cela, `init` reprend la valeur depuis le manifeste d'un plugin installé pour le même point de terminaison (`.champollion/methods/<name>/method.json`), ou la laisse non spécifiée. Il nécessite `--langs` (le point de terminaison est défini par paire), et une clé uniquement pour un point de terminaison situé hors de cette machine (`CHAMPOLLION_API_KEY`). Ajoutez manuellement une méthode `fallback` à la paire, comme l'illustre `DEPLOY.md`.

**Option `--script`** : quelques langues s'écrivent dans plusieurs orthographes réelles — le cri des Plaines (`crk` : `Latn` = orthographe standardisée en caractères romains [SRO], `Cans` = syllabaire), le serbe (`sr` : `Latn`, `Cyrl`). Champollion ne fait pas ce choix à la place d'une communauté : `sync` refuse de traduire une telle langue tant que la configuration n'en spécifie pas une. L'assistant pose la question ; avec `--yes`, transmettez `--script crk=Cans` (plusieurs : `--script crk=Cans,sr=Latn` ; avec une seule langue cible, `--script Cans` suffit), ce qui inscrit `"languages": { "crk": { "script": "Cans" } }`. Sans cela, `init --yes` indique quelles langues nécessitent un choix, liste les options et affiche la ligne `"script"` à ajouter à l'entrée de cette langue dans la configuration.

**Option `--name`** : un code à usage privé (`qaa`–`qtz`, pour une variété sans code confirmé) ne possède pas de fiche de langue, `init` le signale donc au lieu de vous demander de vérifier l'orthographe. `--name qaa="Ayta (variety not yet confirmed)"` lui attribue le nom d'affichage utilisé par les invites et les rapports, inscrit sous la forme `"languages": { "qaa": { "name": "Ayta (variety not yet confirmed)" } }` (plusieurs : `--name "qaa=…;qab=…"`). À côté de chaque registre, `init` affiche également les directives relatives au genre que les invites du LLM intègrent pour la langue ([Directives de genre](/docs/getting-started/configuration#gender-guidance)).

**Présets de langue** : Lorsque vous êtes invité à entrer les langues cibles, vous pouvez taper les noms des présets :
- `european` → fr, de, es, it, pt, nl
- `asian` → ja, zh, ko
- `global` → fr, es, de, ja, zh, ko, pt, ar
- `nordic` → da, fi, nb, sv

Mélangez les présets et les codes individuels : `european, ja` → fr, de, es, it, pt, nl, ja

---

## sync

Traduit les clés manquantes et obsolètes dans tous les fichiers de locale. Exécute la vérification post-synchronisation par défaut.

```bash
champollion sync                                   # translate everything
champollion sync --dry-run                         # preview only
champollion sync --dry --list-keys                 # preview AND name every queued key
champollion sync --redo keys:hero.title            # translate one key again (cache still serves)
champollion sync --redo "keys:a.title,a.subtitle"   # several keys
champollion sync --redo 'keys:Welcome\, %(name)s'  # a key with a comma in it (gettext)
champollion sync --pair en:tlh --redo all           # rebuild one whole locale
champollion sync --pair en:tlh --redo all --fresh   # ...bypassing a suspect cache (billed)
champollion sync --redo content                     # re-process all Markdown/MDX (cached text is free; reviewers' edits are kept)
champollion sync --files "docs/guides/**"           # only these content files
champollion sync --redo files:docs/intro.md --fresh # translate one file from scratch (billed)
champollion sync --redo gaps                        # ask again for plural forms a model left out
champollion sync --prune plural-extras              # remove plural keys for forms a language does not have
champollion sync --content-dir ./newsletters       # include a folder of Markdown (Hugo content/ or any folder)
champollion sync --method google-translate          # force Google Translate
champollion sync --concurrency 20                  # 20 parallel API calls (both phases)
champollion sync --json-concurrency 30              # 30 parallel locale translations (JSON)
champollion sync --content-concurrency 8            # 8 parallel content translations
champollion sync --no-verify                        # skip post-sync verification
champollion sync --no-tm                            # skip cache, fresh API calls
```

**Mémoire de traduction** : par défaut, `sync` charge `.champollion/tm.json` et restitue les traductions en cache pour les valeurs sources inchangées. Changer de modèle ne les supprime pas : le texte déjà traduit avec le modèle précédent est réutilisé sans coût, et sync le signale avant l'estimation des coûts. Pour que le nouveau modèle les traduise plutôt à nouveau : `--redo all --fresh-on-model-change` — cette commande envoie les clés traduites par un modèle antérieur, tandis que ce que le nouveau modèle a déjà traduit provient toujours du cache (à elle seule, `--fresh-on-model-change` n'affecte que les clés que l'exécution traduit de toute façon). Utilisez `--no-tm` pour contourner complètement le cache (utile lors du débogage de la qualité). Consultez [Mémoire de traduction](/docs/concepts/translation-memory).

**Estimation des coûts et `--max-cost`** : l'estimation ne tarifie que ce qui sera facturé lors de l'exécution. Les clés, champs de front-matter et blocs Markdown déjà présents dans la mémoire de traduction sont tarifés à 0 $, et le tableau montre ce que le cache permet d'économiser. Un modèle servi sur cette machine (`local`, ou un point de terminaison `api` à l'adresse `localhost`/`127.0.0.1`/`::1`) affiche `$0 (local)` — aucune facture d'API ; votre matériel et votre consommation électrique ne sont pas comptabilisés. `--max-cost` effectue la comparaison par rapport à ce montant. Au-delà du plafond, ou sans estimation (une méthode sans tarif publié, telle que `local` pointant vers une autre machine), sync s'arrête avant tout appel d'API et se termine avec le code `2` ; rien n'est traduit ni écrit. La ligne de conclusion indique combien de clés ont été envoyées au modèle et combien proviennent du cache.

Sous le tableau, une ligne indique le tarif auquel le montant a été calculé et sa provenance — pour un modèle hébergé, le prix par million de jetons d'entrée et de sortie issu de la grille tarifaire publique d'OpenRouter, ainsi que la date à laquelle elle a été consultée (`Rate: google/gemini-3.8-flash $0.30 input / $2.50 output per 1M tokens — OpenRouter's price list, read 2026-10-04 14:02 UTC`) ; pour un fournisseur direct (`openai`, `anthropic`, `gemini`), la même grille fait office de tarif du fournisseur, et lorsqu'elle ne peut être lue (ou ne contient pas de prix pour le modèle), une copie conservée dans champollion est utilisée, avec la date de sa dernière vérification et la raison ; DeepL, Google et Microsoft d'après leur tarif publié par caractère, avec sa date. Il s'agit d'une estimation : la ligne indique le nombre de jetons (ou de caractères) par clé supposé, et la facture finale dépend des longueurs réelles. Avec `--json`, l'estimation contient le détail : le `rate` de chaque paire et le `rates` de l'exécution (`inputPerMillion`, `outputPerMillion` ou `perMillionChars`, `tokensPerKey`, `from`, `url`, `fetchedAt` ou `verified`).

**Visualiser la requête** : `sync --dry --show-prompt [key]` affiche la requête exacte qui serait transmise à la méthode de la paire — les messages système et utilisateur (ou, pour un point de terminaison `api`, le corps de la requête), construits par le propre code de la méthode, les clés d'API étant masquées — sans rien envoyer. Avec une clé (désignée de la façon dont `--redo keys:` la nomme : `verb␄Open`, `common::nav.home` ; un msgid gettext contenant une virgule peut être fourni en entier), la commande affiche la requête relative à cette clé, qu'elle soit en file d'attente ou non. Lorsqu'une véritable exécution n'enverrait rien pour celle-ci (elle est à jour, servie depuis le cache ou retenue), elle le signale et mentionne la commande `--redo keys:<key> --fresh` qui l'enverrait. Sans clé, elle affiche le premier lot que chaque fichier enverrait, ou indique que rien ne serait envoyé. C'est le moyen de vérifier qu'un `msgctxt` gettext, un commentaire `#.` ou une description ARB parvient bien au modèle. Les moteurs de traduction automatique (DeepL, Google…) ne reçoivent que le texte source seul ; l'aperçu le précise. Avec `--json`, chaque requête correspond à une ligne `{"level": "event", "event": "request", …}`.

**Exécutions à blanc (dry runs)** : `--dry` ne traduit rien et n'écrit rien, mais vérifie ce que la véritable exécution vérifierait d'abord : lorsqu'une clé requise par la méthode manque (`OPENROUTER_API_KEY`, `DEEPL_API_KEY`, …), la commande prévient que la véritable exécution s'arrêterait et nomme la variable concernée. Elle vérifie que la clé est définie, pas qu'elle fonctionne : rien n'étant envoyé, un espace réservé (placeholder) est accepté. Elle se termine tout de même avec le code `0` — un aperçu n'échoue jamais (voir les [codes de sortie](#sync-exit-codes)). Il en va de même pour `--max-cost` : une exécution à blanc ne s'arrête pas au plafond, mais lorsque l'estimation le dépasse (ou est inconnue), elle indique une fois, à la fin, que la véritable exécution s'y arrêterait et se terminerait avec `2`. Avec `--json`, chaque ligne est un objet JSON doté d'un `level` (`info`, `ok`, `event` sur stdout ; `warn`, `error` sur stderr), et la dernière ligne sur stdout est le récapitulatif, `{"level": "summary", "command": "sync", …}`, contenant `preflight: { ready, failures }`, avec un plafond `maxCost: { cap, estimatedCost, wouldStop, exitCode }`, et `realRun: { exitCode, wouldStop, reasons }` — le code de sortie avec lequel la véritable exécution se terminerait, dans la mesure où un aperçu peut le déterminer (voir les [codes de sortie](#sync-exit-codes)). Exécutez-la avec les options que le vrai sync utilise (`--method`, `--model`) : sans elles, elle vérifie la méthode désignée par la configuration. Le code de sortie propre à une exécution à blanc ne fait jamais échouer une étape de CI ; son avertissement `--max-cost` explique donc comment conditionner une étape : lisez `maxCost.wouldStop` (ou `realRun.exitCode`) depuis le récapitulatif `--json` — par exemple `jq -e 'select(.level == "summary") | .preflight.ready and (.maxCost.wouldStop | not)'`. L'[étape de vérification du guide CI](/docs/guides/ci-cd#check-before-sync) effectue cette opération et, en cas d'échec, affiche la raison (`realRun.reasons`) plutôt qu'un simple `false`. Le champ `totalPluralGaps` de l'exécution à blanc compte les messages pluriels sur le disque ne disposant pas d'une forme utilisée par la langue que la véritable exécution ne redemanderait pas, et `verify` vaut `{ "ran": false }` (rien n'ayant été écrit, rien n'a été vérifié).

**Retraduction** : `--redo` indique *ce qu'il faut* retraduire et `--fresh` indique *s'il faut payer pour cela*. Sans `--fresh`, tout ce que le cache contient déjà est restitué gratuitement (et passe toujours le filtre de qualité) ; avec cette option, tous les éléments mis en file d'attente sont retraduits à neuf et facturés. Les anciens drapeaux (`--force`, `--force-keys`, `--force-content`, `--retranslate`, `--no-tm`) fonctionnent toujours et ont exactement la signification indiquée dans le tableau.

**Ciblage de fichiers** : `--files` limite l'étape de contenu aux fichiers correspondants, et `--redo files:<glob> --fresh` force de nouvelles traductions pour les fichiers correspondants (la seule dépense délibérément réitérée). Les motifs correspondent aux chemins affichés par sync (relatifs à `contentDir`, `2026-10.md`) ainsi qu'au même chemin depuis la racine du projet (`newsletter/2026-10.md`) : `*` reste dans un dossier et `**` traverse les dossiers. Les deux drapeaux peuvent être répétés. Un motif qui ne correspond à aucun fichier interrompt l'exécution avant que la moindre dépense ne soit engagée. L'étape clé-valeur est déjà incrémentale et s'exécute normalement.

**Échecs** : l'échec d'un fichier de contenu n'interrompt pas les autres. Les fichiers traités avec succès sont enregistrés et leurs traductions mises en cache, puis l'exécution se termine par la liste des fichiers en échec avec l'état dans lequel chacun a été laissé. La ligne d'un fichier n'affiche jamais `[OK]` lorsque des clés qu'il contient n'ont pas été traduites. Le récapitulatif des échecs indique, pour chaque clé, ce que fera la prochaine synchronisation : redemander (pas de réponse exploitable), demander une fois de plus (en attente après une réexécution), ou retenir (refusé par le filtre de qualité). Les blocs Markdown et les champs de front-matter refusés par le filtre sont retenus de la même manière, par page ; `--redo files:<page>` ou `--redo content` redemande leur traduction ([Filtre de qualité](/docs/concepts/quality-gate#refused-markdown-blocks-and-front-matter-fields)). Le code de sortie est `0` (succès complet), `2` (partiel : du travail a été effectué, mais un élément a échoué, a été retenu ou n'a pas pu être vérifié, un message pluriel a été écrit sans une forme utilisée par la langue pour les décomptes ordinaires — ou interrompu par `--max-cost` avant toute dépense) ou `1` (aucun succès).

**Détection des modifications** : champollion stocke des hachages SHA-256 dans `.champollion.lock`. Lorsque les valeurs sources changent, la synchronisation suivante retraduit automatiquement ces clés. Validez le fichier lock dans votre gestionnaire de versions afin que tous les développeurs partagent la même référence. Le fichier lock enregistre également, par locale cible, une empreinte de chaque valeur écrite par sync (afin qu'une valeur modifiée par un être humain soit reconnue et conservée lors des réexécutions globales — [Modification des traductions](/docs/guides/professional-translators#editing-key-value-files)), les clés qu'une réexécution n'a pas pu terminer (**pending** : la synchronisation suivante les redemande une fois) et les clés refusées par le filtre de qualité (**held back** : non renvoyées au même modèle lors d'un simple sync — [Filtre de qualité](/docs/concepts/quality-gate#refused-keys-are-held-back)).

**Modifications manuelles et réexécutions** : `--redo all`, `--force` et un changement de modèle conservent les valeurs modifiées par un être humain et indiquent lesquelles ; `--redo keys:<key>` désignant une clé la remplace ; une clé dont la source a changé est retraduite. Une modification remplacée est affichée et ajoutée à `.champollion-replaced-edits.jsonl` (suivi — validez-le avec le fichier lock).

**Clés gettext avec contexte** : une clé se compose de `msgctxt` + U+0004 + `msgid`. Les rapports affichent le séparateur sous la forme `␄`, que `--redo keys:` et `--force-keys` acceptent en retour ; pour en saisir un, écrivez `\x04` : `--redo 'keys:django::verb\x04Open'` (les guillemets simples préservent la barre oblique inverse). Les deux notations fonctionnent. Les commandes de réparation affichent la forme `␄`, suivie d'un commentaire shell qui indique `\x04`.

**Une clé spécifiée qui ne correspond à rien** : `--redo keys:` / `--force-keys` avec un nom qu'aucune clé source ne possède (une faute de frappe, ou un msgid qui n'existe qu'avec un contexte) échoue avec le code de sortie 1. L'erreur énumère les clés les plus proches, y compris toutes les variantes de contexte de ce msgid, sous les deux notations. Si aucun des noms ne correspond, rien ne s'exécute. Si certains correspondent, ceux-ci sont réexécutés, puis l'exécution échoue en indiquant les autres.

**Une clé spécifiée servie depuis le cache** : sans `--fresh`, une réexécution restitue le contenu du cache (revérifié, sans coût) et le signale, en indiquant la commande `--fresh` qui sollicite à nouveau le modèle ainsi que son coût.

**Parallélisme** : La traduction des clés JSON et la traduction du contenu s'exécutent en parallèle. Les locales JSON sont traduites simultanément (par défaut : 200 locales concurrentes), avec des lots au sein de chaque locale également parallélisés (4 lots concurrents). La traduction du contenu (Markdown, MDX, articles de blog) s'exécute dans un pool d'éléments de travail plat (par défaut : 48 appels API concurrents). Remplacez avec `--json-concurrency`, `--content-concurrency` ou `--concurrency` (définit les deux).

**Sortie** : La synchronisation affiche une bannière de version, la détection du format/framework, une estimation des coûts et des barres de progression par locale :

```
champollion v0.1.0

[INFO] Detected format: json (auto)
[INFO] Source: en.json (2,847 keys)
[INFO] Pairs: es-MX:llm, fr:deepl

[INFO] es-MX.json — 2,847 missing
     ████████████████████████████████ 2,847/2,847 keys
[INFO] fr.json — 2,847 missing
     ████████████████████████████████ 2,847/2,847 keys
[OK] Synced 5,694 keys total.
```

Les barres de progression se mettent à jour sur place après chaque lot (~80 clés). Utilisez `--quiet` pour n'afficher que les erreurs et avertissements, ou `--json` pour une sortie NDJSON lisible par une machine. Les deux options suppriment la barre de progression et la bannière. Avec `--json`, un événement `cost` intervient avant le filtre `--max-cost`, un événement `file` intervient pour chaque fichier de contenu et locale, et un événement `summary` clôt chaque exécution.

### Codes de sortie {#sync-exit-codes}

| Code | Une exécution réelle | Une exécution à blanc (`--dry`) |
|------|----------------------|-----------------------------------------|
| `0` | Tout ce qui était en file d'attente a été traduit et vérifié, ou rien n'était en attente. | Elle s'est exécutée — même lorsqu'elle indique que la véritable exécution s'arrêterait. |
| `2` | Partiel : du travail a été effectué, mais un élément a échoué, a été retenu ou n'a pas pu être vérifié, ou un message pluriel a été écrit sans une forme utilisée par la langue pour les décomptes ordinaires. Également : `--max-cost` a interrompu l'exécution avant que quoi que ce soit ne soit envoyé. | Jamais. |
| `1` | Rien n'a abouti, ou l'exécution n'a pas pu démarrer : une clé requise par la méthode manque, un serveur de modèles requis ne répond pas, une clé spécifiée pour une réexécution ne correspond à rien, un motif `--files` ne correspond à aucun fichier, ou la configuration est invalide. | L'exécution à blanc elle-même n'a pas pu s'exécuter : une clé spécifiée pour une réexécution ne correspond à rien, un motif `--files` ne correspond à aucun fichier, ou la configuration est invalide. |

Une exécution à blanc se termine par `0` à dessein : c'est l'aperçu que vous lancez avant de décider, et une étape de CI qui se contente d'observer ne doit pas échouer. Ce que ferait la véritable exécution se trouve dans les dernières lignes de l'exécution à blanc et dans son récapitulatif `--json` : `preflight.ready: false` signifie que la véritable exécution s'arrêterait avant de traduire et se terminerait par `1` (`preflight.failures` en indique la raison) ; `maxCost.wouldStop: true` signifie qu'elle s'arrêterait au plafond et se terminerait par `2` (`maxCost.exitCode: 2`) ; `maxCost.exitCode: 1`, avec `maxCost.stopsEarlier`, signifie que la vérification préliminaire (preflight) l'interromprait avant même que le plafond ne soit vérifié. `realRun.exitCode` regroupe ces informations avec ce qui rendrait la véritable exécution partielle : clés retenues, ou messages pluriels sur le disque sans une forme utilisée par la langue que l'exécution ne redemanderait pas (`2` ; `realRun.reasons` les énumère, et la dernière ligne de l'exécution à blanc l'indique). Un refus par le filtre de qualité ou un échec de vérification, que seule l'exécution réelle peut détecter, peut toujours transformer un `0` prédit en un `2`. L'[étape de vérification du guide CI](/docs/guides/ci-cd#check-before-sync) transforme ces cas en une étape de CI en échec qui affiche le motif.

---

## watch

Synchronisation automatique lorsque le fichier de locale source change. S'exécute jusqu'à interruption avec `Ctrl+C`.

```bash
champollion watch
```

---

## audit

Le filtre d'exhaustivité. Énumère chaque clé qui n'est pas traduite — manquante, vide ou restée un repli `[EN]` — et chaque traduction **obsolète** : issue d'un texte source plus ancien que le texte actuel (selon `.champollion.lock` ; une modification de la source dont la retraduction a échoué laisse exactement cet état). Chaque liste d'éléments obsolètes se termine par la commande permettant de les retraduire. Quitte avec le code 1 si des anomalies sont trouvées — à utiliser comme filtre de CI pour faire échouer les builds comportant des traductions incomplètes ou périmées.

```bash
champollion audit
champollion audit --json   # summary carries untranslatedKeys and outOfDateKeys per locale
```

---

## verify

Relit tous les fichiers de locale depuis le disque et vérifie que les traductions sont réellement présentes et correctes. C'est la même vérification qui s'exécute automatiquement à la fin de chaque `sync` (sauf si `--no-verify` est passé).

```bash
champollion verify                    # verify all locale files
champollion verify --warn-only        # non-blocking
champollion verify --strict           # warnings fail too
champollion verify && echo "All good" # CI gate
champollion verify --json             # one "verify" record per locale (NDJSON)
```

**Ce qu'il vérifie :**
- Parité des clés — toutes les clés sources présentes dans chaque cible (pour les clés de pluriel i18next, les clés des formes de pluriel CLDR propres à la locale : le français a également besoin de `count_many`)
- Marqueurs de repli `[EN]` issus d'exécutions antérieures
- Traductions vides
- Conformité de l'écriture (script) — une locale non latine ne doit pas contenir de texte uniquement latin ; les lettres sont classées selon l'écriture Unicode, de sorte que les caractères latins accentués et pleine chasse (fullwidth) comptent comme latins. Les lettres latines pleine chasse constituent une erreur dans toute locale en dehors de la typographie CJK
- Espaces réservés (placeholders), chaque constat étant qualifié par la syntaxe concernée — structure ICU MessageFormat (`ICU structure error` : un argument `{name}`, un mot-clé ou sélecteur plural/select traduit, un `#` égaré), conversions printf (`printf/python-format placeholder mismatch` : `%s`, `%d`, `%(name)s` — un `%(name)s` égaré dans un catalogue gettext est qualifié de printf, pas d'ICU), interpolation i18next (`i18next {{…}} placeholder mismatch` : `{{name}}`, y compris `{{name}}` écrit `{name}`, qu'i18next affiche tel quel), et une accolade simple `{name}` en dehors d'un message ICU (`{…} placeholder mismatch`)
- Balisage — par nom de balise, les mêmes balises ouvrantes, fermantes et auto-fermantes que la source, imbriquées de la même manière (un `</strong>` perdu est une erreur)
- Problèmes d'encodage — marqueurs BOM, caractères invisibles
- Échos de la source — valeurs identiques à la source (avertissement)
- Formes de pluriel — un message pluriel sans une forme que la langue utilise pour les décomptes ordinaires (russe `few`/`many`), une entrée gettext dont les formes ne font que répéter `other` (sync les marque avec un commentaire `# champollion:`), une clé i18next ou `msgstr[n]` pour une forme que la langue ne possède pas (avertissements)
- Locales identiques — deux locales cibles avec le même texte pour la plupart des clés : l'une est probablement dans la langue de l'autre (avertissement)
- Même texte, sources différentes — un seul et même texte produit pour plusieurs chaînes sources distinctes (un modèle répétant une phrase mémorisée) : deux chaînes de plusieurs mots manifestement différentes auxquelles répond un même texte de quatre mots ou plus, ou de trois mots ou plus dans les autres cas ; une phrase qu'une synchronisation antérieure a vu le modèle répéter compte dès la première occurrence. Ce décompte s'applique aux valeurs des clés, à chaque branche plural/select ICU (les branches d'un même pluriel comptent pour une seule source) et aux pages Markdown de la locale (champs de front-matter et blocs ; abstraction faite de `# ` et de la ponctuation finale), selon la même règle de refus que le filtre de `sync` (erreur)
- Obsolescence — une traduction issue d'un texte source plus ancien que le texte actuel (simple avertissement ici ; `audit` échoue dans ce cas)
- Point d'interrogation ou d'exclamation manquant — la source se termine par `?` ou `!` et la traduction ne se termine ni par cela, ni par l'équivalent dans l'écriture cible (`？`, `؟`, grec `;`, …). Un avertissement : certaines langues marquent une question par un mot ou une particule à la place

Il vérifie la structure, pas le sens : un succès indique que les clés, les espaces réservés, les pluriels, le balisage et l'écriture sont intacts, et non que le texte a le sens attendu — faites relire par un locuteur avant de vous y fier.

**Quelles locales.** `verify` vérifie chaque locale ; `verify --pair en:fr` vérifie uniquement le français. Après `sync --pair en:fr`, la vérification post-synchronisation couvre les paires exécutées, et aucune autre. Une vérification ciblée le précise sur sa ligne de conclusion — `Verification passed for fr: … intact (only en:fr was synced; champollion verify checks every locale)` — and never "in every locale"; with `--json`, cette ligne comporte `checked` (les locales vérifiées) et `scope`.

**Couverture des pluriels.** Le bloc de chaque locale comporte une ligne par type de pluriel contenu dans ses fichiers — clés i18next avec suffixe, messages de pluriel ICU, entrées gettext `msgid_plural` — indiquant les formes attendues pour la locale (les catégories de pluriel du CLDR pour celle-ci ; dans un catalogue gettext, celles pour lesquelles son `Plural-Forms` prévoit un emplacement) et précisant si chaque pluriel en dispose :

```text
  ── fr ──────────────────────────────────────
  [OK] 7/7 keys present
  Plural forms (CLDR fr): one, many, other ✓ — 2 i18next plural key group(s), every form present
```

`✗` nomme les pluriels auxquels il manque une forme. Une forme utilisée uniquement pour les nombres supérieurs à 1000 ou les fractions (le français `many` dans un message ICU) est mentionnée à part : la forme `other` s'y substitue, ce qui ne constitue pas une anomalie. La ligne est un récapitulatif — une forme manquante constitue également une anomalie signalée plus haut (une clé manquante, un avertissement de pluriel).

**`--json`** écrit un objet JSON par ligne. Chaque locale reçoit un enregistrement sur stdout — `{"level": "event", "event": "verify", "locale": "fr", …}` — avec `ok`, `keys` (`expected`, `present`, `missing`, `extra`), son `errors`, `warnings` et `infos`, `placeholders` (chaque anomalie avec son `syntax` : `icu`, `printf`, `i18next`, `brace` ou `markup`) et `plurals` (par catégorie et type : `categories`, `total`, `complete`, `incomplete`). Les anomalies sont également transmises sous forme de lignes `error`/`warn` sur stderr, et la ligne de conclusion conserve son niveau et son message (`ok` sur stdout lorsque la vérification réussit, `error` sur stderr dans le cas contraire) et comporte les totaux `errors` et `warnings`. Après une synchronisation, les mêmes enregistrements apparaissent avant le propre récapitulatif de sync. (Les enregistrements d'un projet Docusaurus ne comportent ni `keys` ni `plurals` : ses chaînes d'interface sont vérifiées fichier par fichier.)

```bash
npx champollion verify --json 2>/dev/null | jq -c 'select(.event == "verify") | {locale, plurals}'
```

**Code de sortie :** `1` lorsqu'une erreur a été trouvée — ou lorsqu'il n'a rien pu vérifier du tout (le fichier source ou le dossier des locales ne se trouve pas là où pointe la configuration ; la ligne d'erreur indique le chemin et le paramètre), `0` sinon. Les avertissements ne provoquent pas son échec à moins de transmettre `--strict`, qui quitte avec `1` à tout avertissement (une CI qui ne doit pas déployer, par exemple, des pluriels russes sans leurs formes `few`/`many`) et se termine par une ligne `[FAIL]`, jamais une ligne `[OK]` ; `--warn-only` fait en sorte que les erreurs quittent avec `0` également. Une locale dont le nombre de clés ne correspond pas le signale au lieu de `[OK]` : `8 expected, 9 present (1 extra: count_two)`.

---

## lint

Analyse le code source pour les chaînes de caractères codées en dur visibles par l'utilisateur qui devraient utiliser les appels de traduction i18n. Détecte automatiquement votre framework (next-intl, react-i18next, vue-i18n, Hugo).

```bash
champollion lint                    # exits 1 if issues found (or no source files were found)
champollion lint --warn-only        # always exits 0
champollion lint --src ./app        # custom source directory
champollion lint --min-length 4     # minimum string length to flag
```

**Ce qu'il détecte :**
- Chaînes codées en dur dans le texte JSX, `placeholder`, `alt`, `aria-label`, `title`
- Fichiers avec du contenu visible par l'utilisateur mais sans importation de framework i18n
- Clés mortes — clés de locale qu'aucun fichier source ne référence
- Score de couverture — pourcentage de chaînes passant par i18n

**Exclusions** : Créez `.champollionignore` à la racine de votre projet (motifs glob, comme `.gitignore`).

**L'absence d'éléments à analyser (lint) est un échec** : lorsqu'aucun fichier source ne correspond (les dossiers par défaut du framework — `src/`, `app/`, `pages/`, `components/` pour les projets web — ou votre `--src`), lint quitte avec `1` et nomme les dossiers et extensions recherchés. Une analyse qui n'a rien vérifié ne doit pas franchir un contrôle de CI ; pointez-la vers votre code avec `--src <dir>` ou `"lint": { "srcDir": "<dir>" }`.

---

## wrap

Enveloppe automatiquement les chaînes codées en dur détectées par `lint` dans les appels `t()`. Crée des sauvegardes automatiques avant de modifier les fichiers.

```bash
champollion wrap                    # auto-wrap with backup
champollion wrap --dry              # preview wrapping changes
champollion wrap --undo             # restore from .champollion-backup/
```

**Portes de sécurité :**
1. Vérification de propreté Git (ignorée en mode dry-run)
2. Sauvegarde automatique vers `.champollion-backup/`
3. Aperçu des différences avant chaque écriture de fichier
4. Support `--undo` pour restaurer à partir de la sauvegarde

---

## seo

Générez des artefacts SEO pour les sites multilingues.

```bash
champollion seo hreflang                                        # print hreflang tags
champollion seo sitemap --base-url https://example.com --out sitemap.xml
champollion seo jsonld --base-url https://example.com           # JSON-LD schema
```

| Sous-commande | Sortie |
|------------|--------|
| `hreflang` | Balises `<link rel="alternate" hreflang>` |
| `sitemap` | `sitemap.xml` multilingue |
| `jsonld` | Schéma JSON-LD WebSite language |

---

## integrity

Détecte la corruption et la dérive dans les fichiers de locale traduits.

```bash
champollion integrity               # exits 1 if issues found
champollion integrity --warn-only   # non-blocking
```

**Ce qu'il vérifie :**
- Altération des espaces réservés (par ex., `{name}` présent dans la source mais manquant dans la cible)
- Problèmes d'encodage (mojibake, Unicode invalide)
- Copies non traduites (valeur cible identique à la source) — les clés [`noTranslate`](/docs/getting-started/configuration#no-translate) sont exemptées, tout comme les échos que la mémoire de traduction confirme comme produits par le pipeline et validés par le filtre. Ce qui reste signalé correspond exactement à ce que `sync` remettrait en file d'attente — les deux outils ne peuvent pas être en désaccord sur un fichier sain
- Dérive de non-traduction (une clé `noTranslate` qui n'est *pas* identique à la source) — signalée avec les valeurs attendue et réelle, les caractères invisibles étant échappés ; exécutez `champollion sync` pour réparer
- PUA inattendue (points de code de la zone d'utilisation privée [Private Use Area] dans une locale dont la [conversion d'écriture](/docs/getting-started/configuration#script-conversion) est désactivée — s'affiche vide sans police spéciale) ; exécutez `champollion repair-script` pour réparer
- Valeurs vidées (une cible qui correspond à sa source dont les lettres ont été supprimées — dommage causé par un pipeline antérieur au filtre de préservation du contenu) ; retraduisez avec `sync --force-keys <key>` ou `sync --pair <pair> --force`
- Clés orphelines (clés dans la cible qui n'existent pas dans la source)
- Complétude des catégories de pluriel ICU MessageFormat (par ex., l'arabe nécessite 6 catégories) — selon la même règle que celle employée par `sync` et `verify` : une forme manquante que des décomptes ordinaires atteignent (russe `few`/`many`) est un avertissement ; une forme que seuls des nombres supérieurs à 1 000 ou des fractions atteignent (français `many`, utilisé pour 1 000 000) est une simple note, puisque la forme `other` est utilisée à cet endroit

---

## repair-script

Annule une conversion d'écriture qui n'aurait pas dû avoir lieu : les valeurs encodées en PUA (pIqaD, tengwar, kryptonien) dans des locales dont la configuration désactive la conversion sont restaurées sous forme de romanisation via la table inverse propre au convertisseur.

```bash
champollion repair-script --dry     # preview
champollion repair-script           # repair in place
```

| Option | Effet |
|--------|-------|
| `--dry` | Prévisualiser les réparations sans écrire |
| `--locale <code>` | Réparer une seule locale |
| `--json` | Sortie JSON lisible par une machine |
| `--warn-only` | Quitter avec 0 même s'il reste des PUA irréversibles |

Le pIqaD s'inverse exactement. Les inversions pour le tengwar et le kryptonien ne peuvent pas récupérer la casse (signalées comme case-lossy). La mémoire de traduction ne nécessite aucune réparation — elle conserve les valeurs antérieures à la conversion. Quitte avec 1 lorsqu'il reste des caractères PUA qu'aucun convertisseur enregistré ne peut inverser.

---

## tm

Gérez le cache de mémoire de traduction (`.champollion/tm.json`). TM stocke les traductions précédentes et les fournit lors des synchronisations suivantes au lieu d'appeler l'API.

```bash
champollion tm stats                  # show cache statistics
champollion tm clear                  # clear cache (with confirmation)
champollion tm clear --yes            # clear without confirmation
champollion tm clear --locale fr      # clear only French entries
```

| Sous-commande | Sortie |
|------------|--------|
| `stats` | Nombre d'entrées, taille du fichier, répartition par locale |
| `clear` | Supprimer le fichier cache (complet ou par locale) |

| Option | Effet |
|--------|--------|
| `--locale <code>` | Effacer uniquement les entrées d'une locale |
| `--yes` | Ignorer l'invite de confirmation |

Consultez [Mémoire de traduction](/docs/concepts/translation-memory) pour comprendre le fonctionnement de TM et quand l'effacer.

---

## xliff

Exportez et importez des fichiers XLIFF 1.2 pour l'examen par des traducteurs professionnels. XLIFF est le format d'échange universel pris en charge par les outils TAO comme memoQ, SDL Trados et Phrase.

```bash
champollion xliff export --locale fr                   # export French XLIFF
champollion xliff export --locale ja --out ./review/   # custom output path
champollion xliff import .champollion/xliff/fr.xliff       # import reviewed file
champollion xliff import ./reviewed.xliff --dry        # preview import
```

| Sous-commande | Sortie |
|------------|--------|
| `export` | Générez `.xliff` à partir des fichiers de locale source + cible |
| `import` | Fusionnez les traductions `.xliff` examinées dans les fichiers de locale |

| Option | Effet |
|--------|--------|
| `--locale <code>` | Locale cible pour l'export (obligatoire) |
| `--out <path>` | Chemin ou répertoire de sortie personnalisé |
| `--dry` | Aperçu de l'import sans écriture |

Consultez [Travailler avec des traducteurs professionnels](/docs/guides/professional-translators) pour le flux de travail complet.

---

## status

Affiche la configuration des paires, les plugins installés et les scores de référence (benchmarks).

Une paire dont la configuration définit `qualityTier` (`standard`, `high`, `research` ou `verified`) l'affiche, désigné pour ce qu'il est : un libellé que vous avez choisi, et non une mesure — sync traduit de la même manière quelle que soit sa valeur, et `serve` le diffuse. Une paire qui n'en définit aucun n'en affiche aucun (`--json` conserve `qualityTier`, avec `qualityTierSet: false`).

```bash
champollion status
```

Après un changement de modèle, elle signale également lorsqu'un fichier de locale mélange des textes issus de plusieurs modèles (d'après la mémoire de traduction : quel modèle a produit chaque valeur sur le disque), avec la commande permettant au modèle actuel de retraduire ce qu'un modèle antérieur a écrit — `sync --pair <pair> --redo all --fresh-on-model-change`.
Pour une méthode qui exécute un modèle de votre choix (`local`, `api`, `external`), elle répète la note de licence que la première synchronisation avait affichée une fois. Pour une méthode compatible OpenAI (`local`, `openai`), elle indique l'adresse vers laquelle les requêtes sont envoyées ainsi que le paramètre qui l'a définie : `LOCAL_API_BASE` dans l'environnement ou dans `.env`, ou la valeur par défaut (Ollama, `http://localhost:11434/v1`). Avec `contentDir`, elle liste le dossier de contenu à côté des fichiers clé-valeur, en indiquant combien de pages sources il contient et, pour chaque langue, combien de traductions sont à jour, obsolètes ou en attente.
« En attente » (pending) signifie pas de traduction pour le moment, ou des parties refusées par le filtre de qualité laissées dans la langue source (le lock de contenu indique `pending:<hash>`).
Sous chaque registre, elle affiche les directives de genre que les invites de LLM comportent et leur provenance (valeur par défaut de Champollion pour la langue, votre configuration, ou désactivé — voir [Directives de genre](/docs/getting-started/configuration#gender-guidance)).
Pour une paire avec solution de repli, elle compte combien de valeurs dans les fichiers ont été écrites par la solution de repli, et cite les premières.
`--json` affiche les mêmes informations que `requestsGoTo` (sur une paire ou une solution de repli avec un tel point de terminaison), `content`, `genderGuidance` et `fallback.valuesInFiles`.

---

## provenance

Auditez les licences des ressources de traduction pour tous les plugins installés.

```bash
champollion provenance
```

---

## plugin

Gérez les plugins de méthode de traduction. Les plugins sont des recettes de traduction pré-packagées installées dans `.champollion/methods/`.

```bash
champollion plugin list                      # show installed plugins
champollion plugin install ./my-method/      # install from local directory
champollion plugin remove my-method          # remove a plugin
```

Consultez [Spécification des plugins](/docs/reference/plugin-spec) pour le format du manifeste des plugins.

---

## leaderboard

`champollion network leaderboard` (fonctionne également sous la forme `champollion leaderboard`). Parcourez, recherchez et installez des méthodes de traduction depuis le tableau de classement du réseau. Les méthodes installées depuis le tableau de classement sont accompagnées de scores de référence (benchmarks) et de la MethodConfig canonique complète — la configuration exacte utilisée lors de l'évaluation.

```bash
champollion network leaderboard                       # show leaderboard
champollion network leaderboard --pair "eng>fra"      # filter by language pair (quote the >)
champollion network leaderboard --install 1           # install the method ranked 1 as a plugin
champollion network leaderboard --install 1 --apply   # install + patch config
```

| Option | Effet |
|--------|-------|
| `--pair <pair>` | Filtrer par paire de langues, telle qu'écrite sur le tableau : `"eng>fra"` (ISO 639-3 ; mettez le `>` entre guillemets). `eng-fra` et `eng:fra` fonctionnent également, et un code à 2 lettres est résolu (`en` → `eng`) |
| `--install <rank>` | Installer la méthode située à ce rang (telle que listée) en tant que plugin |
| `--apply` | Après l'installation, ajouter automatiquement `methodPlugin` à `champollion.config.json` |

**Flux de travail `--apply` :** Lorsque vous installez avec `--apply`, champollion écrit le plugin de méthode dans `.champollion/methods/` **et** corrige votre `champollion.config.json` pour l'utiliser pour la paire pertinente. C'est le chemin le plus rapide de « qu'est-ce qui obtient les meilleurs scores ? » à « je l'utilise en production ».

---

## fonts

Télécharge et gère les polices web PUA pour les convertisseurs de scripts de langues construites. Les langues qui utilisent des caractères de zone d'utilisation privée (Klingon, Sindarin, Kryptonien) ont besoin de polices web personnalisées pour rendre leurs scripts. Cette commande les télécharge à partir de référentiels open-source vérifiés.

```bash
champollion fonts list                           # show needed fonts
champollion fonts install                        # download all needed fonts
champollion fonts install --css                  # also generate CSS snippet
champollion fonts install --dir ./public/fonts   # custom output directory
```

| Sous-commande | Sortie |
|------------|--------|
| `list` | Affiche les polices PUA nécessaires et leur statut d'installation |
| `install` | Télécharge les polices pour les langues configurées |

| Option | Effet |
|--------|--------|
| `--dir <path>` | Remplacez le répertoire de sortie des polices (détection automatique à partir du type de projet) |
| `--css` | Générez un extrait `conlang-fonts.css` aux côtés des polices |
| `--config <path>` | Chemin du fichier de configuration (utilisé pour détecter les langues qui ont besoin de polices) |

**Détection automatique :** Le répertoire de sortie est déduit de votre structure de projet :
- **Docusaurus** → `static/fonts/` ou `website/static/fonts/`
- **Hugo** → `static/fonts/`
- **Par défaut** → `public/fonts/`

**Convertisseurs Unicode natifs** (`crk` → Syllabaires du Cree, `sr` → Cyrillique serbe) ne nécessitent PAS d'installation de polices.

Consultez [Conlangs, Scripts & Orthographie](/docs/guides/conlangs-scripts-orthography) pour les détails complets des polices PUA.

## Pipeline à trois niveaux

Utilisez `lint`, `sync` et `audit` ensemble pour une i18n infaillible :

```json title="package.json"
{
  "scripts": {
    "i18n:lint": "champollion lint",
    "i18n:sync": "champollion sync",
    "i18n:audit": "champollion audit"
  }
}
```

| Niveau | Commande | Quand | Objectif |
|-------|---------|------|---------|
| **Lint** | `lint` | Pré-commit | Bloquez les commits avec des chaînes codées en dur |
| **Sync** | `sync` | Post-commit / CI | Traduisez les clés manquantes et modifiées |
| **Verify** | `verify` | Post-sync / CI | Confirmez que les traductions sont présentes et correctes |
| **Audit** | `audit` | Étape de build | Échouez le déploiement si une locale a des marqueurs `[EN]` |

---

## Voir aussi

- [Configuration](/docs/getting-started/configuration) — référence du fichier de configuration
- [Méthodes de traduction](/docs/guides/translation-methods) — sélection de méthode par paire
- [Mémoire de traduction](/docs/concepts/translation-memory) — mise en cache et économies de coûts
- [Travailler avec des traducteurs professionnels](/docs/guides/professional-translators) — flux de travail XLIFF
- [Spécification des plugins](/docs/reference/plugin-spec) — format du manifeste des plugins
- [Guide CI/CD](/docs/guides/ci-cd) — automatisation des commandes CLI dans votre pipeline
- [Comment fonctionne la synchronisation](/docs/concepts/how-sync-works) — comprendre le pipeline de synchronisation
- [Porte de qualité](/docs/concepts/quality-gate) — comment les traductions sont validées
