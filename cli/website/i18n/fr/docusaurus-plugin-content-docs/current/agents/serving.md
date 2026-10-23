---
title: "Mise en service et déploiement"
slug: /agents/serving
description: "Mettez à l'œuvre un modèle évalué : le fichier deployment/1 écrit par nmt-forge export, mt-eval translate et serve, nmt-forge serve et sa page try, le contrat service-api/1 /translate, champollion connect, ainsi que champollion sync piloté par un agent — avec ce qu'une sortie exclusivement locale peut et ne peut pas faire."
---

# Service et déploiement

**Un déploiement est le pipeline de mesure appliqué à des entrées source seules.** Un
fichier deployment/1 indique la méthode, son modèle, ses portes de filtrage et la paire. Le
même fichier est testé sur un jeu de test, exécuté sur un fichier et servi, de sorte que ce
qui a été mesuré correspond exactement à ce qui est déployé. Cette page constitue le volet destiné aux agents de
[Mettre en œuvre](/docs/put-it-to-work).

D'un bout à l'autre : un modèle ayant appris à partir de phrases marquées « local-only » peut les
répéter, de sorte que **sa sortie est également local-only**. Chaque outil ci-dessous conserve cette sortie
sur cet ordinateur, à moins que les détenteurs des données n'aient convenu du contraire, et
`--holders-agreed-by` consigne l'identité de la personne ayant donné son accord. **Remarque.** Ne transmettez ce paramètre
qu'avec le nom que la personne vous a communiqué, après qu'elle a confirmé l'accord des détenteurs.

## deployment/1

`$schema` `https://champollion.dev/schemas/deployment/1.json`. Requis : `id`,
`pair` (`source`, `target`, optionnel `target_script`), `method` (`method`,
optionnel `model`). Optionnel : `gates` (un fichier gate-chain/1) et `serve`
(`host`, par défaut `127.0.0.1` ; `port`). Les chemins sont relatifs à la racine du projet,
où les rails exécutent les commandes. Il ne mentionne aucun score.

**Qui l'écrit.** `nmt-forge export`, lorsque l'export se trouve à l'intérieur d'un projet
rails (un `champollion.project.json` au-dessus), écrit
`deploy/<name>.json` — `<name>` correspond à `--name` en kebab-case, sinon
`nmt-forge-<run>` :

```json
{
  "$schema": "https://champollion.dev/schemas/deployment/1.json",
  "id": "nmt-forge-<run>",
  "description": "nmt-forge <backend> model <run> (<src>→<tgt>), written by nmt-forge export <version>",
  "pair": { "source": "<src>", "target": "<tgt>" },
  "method": { "method": "local-model", "model": "<export>/model" }
}
```

Il n'en écrit aucun (et indique `no deployment file: …`) lorsque l'export se situe en dehors
d'un projet rails, lorsque le modèle a été sélectionné sous un hook de décodage (seul
`nmt-forge serve` exécute les hooks de forge), lorsque la configuration ne spécifie aucune paire, lorsque le
document ne valide pas, ou lorsque `deploy/<name>.json` déploie déjà
un autre modèle (jamais remplacé).

**Qui le lit.**

```bash
mt-eval run --deployment deploy/<name>.json --corpus <test set>          # measure exactly what it serves
mt-eval translate --deployment deploy/<name>.json --source-file <input> --out <output>
mt-eval serve --deployment deploy/<name>.json
```

**Verrous.** Avec `--deployment`, `run` et `translate` refusent `--method`,
`-m`/`--model`, `--gates` et `--target-script` (*« --deployment … indique la
méthode, son modèle, ses portes et le script cible ; retirez … (ou modifiez le
fichier) »*) ; `serve` refuse également `--pair`. Une entrée dans une autre paire est refusée
(`deployment <id> translates from <src>; this input is in <x>`). Un
déploiement dont la chaîne de portes effectue un repli (fallback) peut être traduit et servi, mais pas
mesuré : `mt-eval run` refuse une chaîne qui utilise un repli
([méthodes et portes](/docs/agents/methods#gate-chains)).

## Contenu d'un export

`nmt-forge export <run-manifest.json> --prereg <id> --out <dir>` écrit :

| Chemin | Description |
|---|---|
| `<dir>/model/` | Le dossier à déployer : poids et tokenizer, `forge-model.json` (données d'entraînement, `trained_on.terms`), `DEPLOY.md` |
| `<dir>/model/champollion-plugin/method.json` | method/1, type `nmt-checkpoint`, `service.endpoint` `http://127.0.0.1:<port>/translate` (port 8378 sauf si `--port`), `card.commercial_ready: false`, `evidence` avec le score chrF++ du jeu de test, son intervalle et n |
| `<dir>/evaluation/` | Les preuves relatives au jeu de test. Ne jamais les copier avec le modèle |
| `<dir>/input-words.json` | Les mots du côté source des phrases d'entraînement, sans doublons, triés (`words`, `english`, `sentences`, `from`, et `notes` nommant un fichier d'entraînement qui n'a pas pu être lu tel que l'exécution l'avait lu). À côté de `model/`, jamais à l'intérieur : ce sont des mots issus des données de la communauté. Écrit lorsque l'export inclut le modèle et que ses fichiers d'entraînement sont présents sur cet ordinateur ; sinon, le résumé de l'export indique `input_words.written: false` avec `why`. `nmt-forge serve` le lit pour désigner les mots que le modèle n'a jamais vus ([ci-dessous](#words-the-model-never-saw)) |
| `<dir>/README.md` | Nature de l'export |

## `mt-eval translate`

Le pipeline appliqué à un fichier, sans calcul de score. `--out` accepte `.jsonl` (une ligne par
segment : `id`, `source`, `output`, `error`, et avec portes `gates`,
`shipped_from`, `fallback`) ou `.tsv` (source, tabulation, sortie). Sans `--out`,
il écrit `<run id>.translations.jsonl` dans le dossier de sortie (`-o`). La
sortie conserve les conditions de l'entrée — ainsi que celles du modèle — dans un fichier auxiliaire (sidecar) set/1.

**Verrou.** Lorsque la sortie de la méthode est local-only (ou que celle du repli
de sa chaîne de portes l'est), toute destination située en dehors du projet est refusée avant
la moindre traduction : *« refusing to write …: what this method writes is local-only
(…), and that is outside … — a place the data's holders did not choose. Only
they can agree to that — ask them; if they do: --holders-agreed-by "<who
agreed>" (recorded in the file's sidecar; it stays marked local-only). Or
write it inside the project »*. Avec cet accord, le fichier sidecar consigne
`holders_agreed: {by, date}` ; le fichier demeure local-only pour tous les outils.

`--json` affiche `translated`, `errors`, `out`, `run_id`, `marked`,
`holders_agreed` et `output_gates`. Code de sortie 1 lorsque chaque ligne a échoué. `--publish`
est refusé : il n'y a aucun score.

## `mt-eval serve`

| | |
|---|---|
| Adresse par défaut | `127.0.0.1:8379` (`--host`, `--port`, ou le bloc `serve` du déploiement) |
| Ce qu'il dessert | Uniquement une méthode s'exécutant dans ce processus : `lexicon`, `local-model`, ou un plugin dont le fichier method.json déclare `dependency_class` `S` ou `O`. Un LLM ou un moteur hébergé est refusé |
| Jeton | `MT_EVAL_SERVE_TOKEN`, provenant uniquement de l'environnement. Requis pour écouter sur toute adresse autre que `127.0.0.1`, `::1` ou `localhost` ; s'il est défini, requis sur chaque `POST` (bouclage local inclus). `GET /health` n'en a jamais besoin |
| Limites | Corps de 1 000 000 octets, 500 clés, 20 000 caractères par chaîne — tout dépassement renvoie `413` |
| Portes | `--gates <chain>` (ou `gates` du déploiement). Le plugin de chaque porte doit évaluer sans références, sinon il ne démarre pas. Un repli est autorisé ici, et doit s'exécuter dans ce processus |

**Verrou — hors boucle locale (loopback).** Sans jeton : *« refusing to listen on … without a
token — anyone who can reach the port could use the method »*. Avec une sortie
local-only sans accord : *« refusing to serve on …: what this method writes is
local-only (…), and an address other machines can reach sends it off this
one. Only the data's holders can agree to that — ask them; if they do:
--holders-agreed-by "<who agreed>" (reported on /health), or keep --host
127.0.0.1 »*. La sortie est local-only lorsque le fichier sidecar d'un dictionnaire l'indique (ou
ne peut être lu), ou lorsque le `forge-model.json` du dossier d'un modèle consigne
des conditions d'entraînement local-only ou n'en consigne aucune ; elle est signalée comme non connue (`null`) pour un
plugin ou un dossier de modèle sans `forge-model.json`.

`/health` répond par `status`, `method`, `model`, `pair`, `deployment` (`id`,
`sha256`), `runs` (dans ce processus — rien n'est transmis à l'extérieur), `scored`
(rien), `output_gates` et `gates` (identifiant de la chaîne, empreinte, portes, repli),
`output_local_only`, `output_local_only_why`, `holders_agreed_by`, `license`
(`AGPL-3.0-or-later`), `source` (le dépôt) et `version`.

Avec des portes, un segment refusé est renvoyé conformément aux instructions de sa porte : `drop` — la clé
sous `errors` ; `keep-source` — la source ; `flag` — la sortie, la clé
nommée dans `meta.gates.flagged` ; `fallback` — la traduction du repli si les
portes l'acceptent. Sans portes, le serveur ne vérifie rien de ce qu'il renvoie.

## `nmt-forge serve`

```bash
nmt-forge serve <export>/model --detach        # a supervised background job
nmt-forge serve <export>/model --choose        # also record it as the people's choice
nmt-forge jobs                                 # list jobs
nmt-forge jobs stop <name> --wait 120
```

| | |
|---|---|
| Adresse par défaut | `127.0.0.1`, port `NMT_FORGE_SERVE_PORT` ou 8378 |
| Jeton | `--token` ou `NMT_FORGE_SERVE_TOKEN` ; requis hors boucle locale. `--detach` le récupère uniquement depuis l'environnement |
| Routes | `GET /` — une page d'essai pour la personne (sans jeton ; en demande un lorsqu'il est configuré) ; `GET /health` ; `POST /translate` (service-api/1) ; `POST /v1/chat/completions` (compatible OpenAI) ; `GET /v1/models` |
| `--detach` | Rend la main dès que `/health` répond ; arrêté s'il ne répond pas dans un délai de 120 s. Refusé lorsque le port répond déjà |
| `--no-hook` | Servir sans le hook de décodage de l'exécution (indiqué sur `/health` et dans `meta`) |
| `--allow-locale` | Accepter également ces codes de paramètres régionaux (répétable) |
| `--device` | `auto` (par défaut) ou `cpu`. Avec `auto`, un serveur démarré pendant qu'une tâche d'entraînement du même projet est en cours s'exécute sur le processeur (CPU) plutôt que de partager le GPU, et `/health` le signale (`device_note`) |
| Limites | Corps de 1 000 000 octets, 500 clés, 20 000 caractères par chaîne, 5 000 unités de travail du modèle par requête — tout dépassement renvoie `413`. Le modèle est sollicité par blocs de 32 unités à la fois, de sorte qu'une phrase provenant d'une autre requête n'attend qu'un seul bloc, jamais une requête entière. Une requête toujours en cours après 600 s est intégralement refusée — `503`, *« send fewer pieces at a time »* — et ne fait jamais l'objet d'une réponse partielle |
| Décodage | Recherche par faisceau (beam search) avec `num_beams` de l'export lorsque l'export enregistre `beams_applied` (selon la mesure du modèle) ; décodage glouton (greedy) pour un export plus ancien. Le texte transmis est normalisé en NFC, à l'instar des données d'entraînement |

**Verrou.** Hors boucle locale, un modèle dont la sortie est local-only — entraîné sur
des phrases local-only, ou sans trace de ses données d'apprentissage — est refusé
sans `--holders-agreed-by`. `/health` indique `pair`, `accepts`,
`decode_hook`, `run`, les rapports de dev et de test, `score_caveats`, `caveats`,
`trained_on`, `output_local_only`, `holders_agreed_by`, `device_note`,
`limits` (`pieces_per_request`, `pieces_per_turn`, `request_seconds`),
`unseen_words_check`, `text_pipeline` et `output_gates`. Chaque réponse `/translate` d'un
modèle local-only comporte `meta.output_local_only: true`, et chaque
réponse `/v1/chat/completions` comporte `meta.output_local_only` (true ou false).
Lorsque les limites de longueur tronquent un élément d'une requête, son `meta.cut` comptabilise les
phrases tronquées en entrée (`inputs`) et les traductions interrompues au niveau du
plafond (`outputs`) ([entraînement](/docs/agents/training#the-guarded-loop)).

**Remarque.** La page d'essai est destinée à la personne. `try_translation` (MCP) l'y
oriente pour un modèle local-only ; n'appelez jamais `/translate` vous-même pour lire sa
sortie ([contrat](/docs/agents/contract) §1).

### Mots jamais vus par le modèle

Une phrase contenant un mot que le modèle n'a jamais vu lors de l'entraînement est très probablement
mal traduite, quelle que soit sa fluidité apparente. Sur la langue de test inventée, une
phrase mise de côté contenant un mot plein que le modèle n'avait pas vu a été traduite
correctement 0 fois sur 358 (ByT5-small à 1 600, 6 400 et 25 600 paires d'entraînement),
et s'est révélée fausse avec assurance — fluide, chaque mot étant une forme existante, le sens
étant erroné — dans 32 %, 55 % et 83 % des cas : plus le modèle est performant, plus
sa supposition est convaincante. C'est pourquoi le serveur identifie ces mots.

- **`/health`** indique s'il le peut : `unseen_words_check` correspond à `{on: true,
  words_seen: <count of words in input-words.json>, notes}` or `{on: false,
  why}`.
- **`/translate`** ajoute, uniquement lorsqu'une requête comporte de tels mots,
  `meta.unseen_words` (clé → les mots du texte de cette clé que le modèle n'a jamais
  vus, une seule fois chacun, dans l'ordre) et `meta.unseen_note`. **`/v1/chat/completions`**
  ajoute la même information, indexée selon la demande : `SEG_<id>` par segment en mode
  bloc, `page` pour une page, les clés propres à l'objet JSON, ou `text`.
- **Aucun enregistrement, mentionné à chaque réponse.** Le serveur lit `input-words.json`
  depuis le dossier situé au-dessus du dossier de modèle qu'il dessert. En son absence — sur un
  export made before 2026-10-13, one made without its training files on this
  ordinateur, ou si un dossier de modèle a été copié hors de son export —, le champ `meta.unseen_check`
  de chaque réponse indique qu'il ne peut pas vérifier, et pourquoi. Servez le modèle depuis son
  export, or export it again.
- **La page d'essai** signale la ligne : *« Never seen in training: … — this line is
  very likely wrong, however fluent it reads. »*

Un mot est une suite de lettres dans n'importe quel système d'écriture (les apostrophes internes étant conservées),
en minuscules, en NFC. Lorsque le texte d'entrée est en anglais, une terminaison anglaise courante
est considérée comme vue dans les deux sens (`walk` vu → `walked` est pris en compte ; `walked`
vu → `walk` est pris en compte).

## service-api/1 — le contrat `/translate`

`$schema` `https://champollion.dev/schemas/service-api/1.json`, soumis à
`shared/test-fixtures/framework/service-api-vectors.json` (exécuté sur
`mt-eval serve` et `nmt-forge serve`).

- **Requête** `POST /translate` : `keys` (clé → chaîne source ; requis),
  facultatif `source_locale`, `target_locale`, `method`, `text_format`
  (`"markdown"` pour le texte d'un document), `instructions` (clé → note ; envoyé uniquement à un
  serveur déclaré comme les prenant en compte, `accepts_instructions`). Un champ qu'un serveur
  n'utilise pas est ignoré, jamais refusé.
- **Réponse :** `200` `{translations, meta}` — `meta` est requis ; `207` ajoute
  `errors` (clé → `{message}`). Les erreurs sont `{error: {message}}` : `400` pour une
  requête qu'il ne peut pas traiter, `401` pour un jeton manquant ou erroné, `404` pour une
  route inconnue, `413` si le volume est trop important, `500` si la méthode a échoué — jamais de réponse partielle.
  (`nmt-forge serve` renvoie également `503` pour une requête dépassant sa limite de 600 s.)
- **`meta` :** `method`, `model`, `output_gates`, `output_local_only`
  (true, false ou null), `cost_usd` ; les serveurs peuvent ajouter des champs.
- **`GET /health`** exige `status` (`ok`), `pair`, `output_gates` et
  `output_local_only` ; facultatif `output_local_only_why`, `holders_agreed_by`,
  `model`, `method`.
- **La règle :** un serveur dont le `/health` indique `output_local_only: true` insère
  `output_local_only: true` dans le champ `meta` de chaque réponse, et un client n'écrit
  une telle sortie que là où les détenteurs des données ont donné leur accord.

## `champollion connect`

```bash
champollion connect <export>/model --app <app folder>
champollion connect <export>/model --app <app folder> --holders-agreed-by "<who agreed>"
```

Il recherche le `method.json` (le fichier désigné, ou `method.json`,
`champollion-plugin/method.json`, `model/champollion-plugin/method.json` dans
le dossier), l'installe dans le `.champollion/methods/` de l'application, et fait pointer
chacune de ses paires (`<inputLocale>:<target>`) vers celui-ci en tant que `methodPlugin`, en conservant
le reste de la paire. Le dossier de l'application doit contenir `champollion.config.json`, et la
méthode doit traduire depuis la `inputLocale` de l'application.

**Verrou.** Un modèle dont la sortie est local-only — attesté par son
`forge-model.json` (une absence fait foi), ou par le `/health` de son service —
est refusé sans `--holders-agreed-by` : ce qu'il écrit dans les
fichiers de langue de l'application est publié avec celle-ci. Avec ce paramètre, chaque paire consigne
`holdersAgreed: {by, date, method, what}`. Un avertissement est émis, sans provoquer d'échec, lorsque
rien ne répond au point de terminaison (endpoint) (`nmt-forge serve <dir> --detach` le démarre)
ou lorsque `/health` ne respecte pas service-api/1. `--json` affiche `method`,
`kind`, `pairs`, `endpoint`, `answering`, `health_problems`,
`holders_agreed_by`.

## `champollion sync`, piloté par un agent

`sync` traduit les fichiers de langue d'une application ou d'un site à l'aide des méthodes spécifiées
par son `champollion.config.json`. Il ne pose aucune question de manière interactive.

```bash
champollion sync --dry-run --json      # what would be sent, and its estimated cost
champollion sync --max-cost 2 --json   # stop before any call if the estimate is over $2, or unknown
champollion verify                     # placeholders, scripts, key parity
```

**La sortie `--json`** comprend un objet JSON par ligne. Sur stdout : `{level: "info" |
"ok", message}`, events `{level: "event", event: "cost" | "file" | "verify" |
"request", …}`, and last `{level: "summary", command: "sync", …}` avec
`dryRun`, `totalProcessed`, `totalFailed`, `totalHeld`, `tmHits`,
`sentToModel`, `verify` (`ran`, `errors`, `warnings`), `failedPairs`,
`locales`, `costEstimate` et plus encore ; une exécution à blanc (dry run) ajoute `preflight`, `realRun`
(`exitCode`, `wouldStop`, `reasons`) et `maxCost`. Sur stderr : `{level: "warn"
| "error", message}`. A hard error prints a summary with `ok: false` et
`error`.

| Code de sortie | Signification |
|---|---|
| 0 | Succès complet |
| 1 | Un nom de `--redo` ou de `--force-keys` n'a correspondu à aucune clé ; échecs sans qu'aucun élément ne soit traité ; une erreur |
| 2 | `--max-cost` l'a interrompu avant tout appel (ou l'estimation était inconnue) ; ou partiel : un élément a échoué, des clés ont été retenues, des formes plurielles manquent, ou la vérification a détecté des erreurs |

Une exécution à blanc n'envoie ni n'écrit rien, n'effectue aucune vérification et renvoie le code 0, à moins qu'une
clé spécifiée ne corresponde à rien ou qu'une erreur ne survienne. La vérification s'exécute après une synchronisation réelle,
sauf si `--no-verify`.

**Verrou — réponses local-only.** Pour une méthode `api`, un lot dont
`meta.output_local_only` vaut `true` n'est pas écrit, sauf si le `holdersAgreed` de la paire
désigne cette méthode ; `sync` le signale une fois et indique l'appel
`champollion connect … --holders-agreed-by` à effectuer. Ces clés restent
non traduites (ou basculent vers le repli de la paire).

**Verrou — la méthode `local`.** La méthode `local` (un point de terminaison
compatible OpenAI) interroge `/health` du serveur une fois. Lorsqu'il indique
`output_local_only: true` — comme le fait `nmt-forge serve` pour un modèle entraîné sur
des phrases local-only —, rien en provenance de ce serveur n'est écrit, sauf si le
`holdersAgreed` de la paire mentionne `local` : *« the model at … says what it writes is
local-only … nothing from it was written »*, suivi de l'appel
`champollion connect <the model> --holders-agreed-by "<who agreed>"`. Un
serveur dont `/health` ne répond pas ou n'indique pas `true` (par exemple un serveur Ollama ou
LM Studio) est utilisé comme auparavant.

**Remarque.** Connectez un modèle forge avec `champollion connect` (la route
`api`) : il lit le registre propre au modèle concernant ses données d'apprentissage, et consigne
l'accord des détenteurs sur la paire sous la méthode qu'il installe.

**Mots jamais vus par le modèle.** Lorsqu'un serveur forge indique des clés dans
`meta.unseen_words`, les méthodes `local` et `api` émettent un avertissement mentionnant les clés —
jamais le texte ni les mots : *« <API batch N | Local method>: <n> key(s) hold
words the model never saw in training — very likely mistranslated, however
fluent; have a speaker check them: <up to 20 keys> »* (puis *« and <n> more »*).
Les traductions sont tout de même écrites ; l'avertissement permet à la communauté de savoir lesquelles
faire vérifier ([coaching](/docs/agents/coaching)).

**Remarque.** Transmettez chaque ligne `warn`. Les chaînes traduites par machine sont des ébauches
tant qu'un locuteur ne les a pas révisées ; ne les qualifiez jamais de correctes.

## `champollion serve`

Un serveur différent : il dessert la pile de traduction configurée propre à un **projet applicatif**
(méthode, coaching, mémoire de traduction, porte de qualité) à d'autres
projets. Valeurs par défaut `127.0.0.1`, port 1822. Il requiert un jeton porteur (bearer token)
même sur la boucle locale (`--token` ou `CHAMPOLLION_SERVE_TOKEN`, au moins 12
caractères), sauf si `--no-auth`, ce qui n'est accepté que sur une liaison en boucle locale.
`--emit-manifest` génère un manifeste method/1 de type `service` pour les consommateurs.
Son `/health` est `{ok, service, version}`, et non le document de santé
de service-api/1, si bien que `champollion connect` signale les problèmes d'état de santé pour celui-ci.

## Pour aller plus loin

- [Mettre en œuvre](/docs/put-it-to-work) — la version destinée à la communauté.
- [Méthodes et portes](/docs/agents/methods) — method/1 et gate-chain/1.
- [Règles relatives aux données et à la transmission](/docs/agents/data-rules) — local-only et
  `holders_agreed`.
- [Le modèle des rails](/docs/agents/rails-model) — le pipeline unique.
- [Référence `mt-eval`](/docs/reference/mt-eval) et
  [référence `nmt-forge`](/docs/network/getting-started/forge-command-reference).
- Traduction d'applications et de sites : [CI/CD](/docs/guides/ci-cd),
  [dépannage](/docs/guides/troubleshooting).
