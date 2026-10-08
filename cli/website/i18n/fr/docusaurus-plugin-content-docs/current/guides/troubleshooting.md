---
sidebar_position: 6
title: "Dépannage"
---

# Dépannage

Problèmes courants et solutions pour champollion.

## API et authentification

### « OPENROUTER_API_KEY not found »

Champollion nécessite une clé API pour la traduction par LLM. Définissez-la comme variable d'environnement :

```bash
export OPENROUTER_API_KEY="sk-or-v1-..."
```

Ou dans un fichier `.env` (si votre projet charge les fichiers `.env`) :

```
OPENROUTER_API_KEY=sk-or-v1-...
```

:::tip
Si vous disposez uniquement d'une clé API Google Translate, champollion détecte automatiquement et utilise Google Translate comme méthode par défaut. Aucune modification de configuration n'est nécessaire.
:::

### « 401 Unauthorized » depuis OpenRouter

Votre clé API est invalide ou expirée. Vérifiez-la sur [openrouter.ai/keys](https://openrouter.ai/keys).

### « 429 Too Many Requests » / Limitation de débit

Champollion gère les limites de débit en interne avec un backoff exponentiel. Si vous atteignez régulièrement les limites de débit :

1. **Réduisez la taille des lots** dans votre configuration :
   ```json
   { "batchSize": 15 }
   ```
2. **Utilisez un modèle avec des limites de débit plus élevées** (par ex., `google/gemini-3.8-flash` a des limites généreuses)
3. **Utilisez une méthode plus économique/plus rapide** pour les paires à fort volume — Google Translate n'a pas de limites de débit :
   ```json
   { "pairs": { "en:it": { "method": "google-translate" } } }
   ```

### Modèle non trouvé / Erreurs 404

Les fournisseurs de LLM directs (`openai`, `anthropic`, `gemini`) reçoivent leurs propres noms de modèles. Un identifiant au format OpenRouter correspondant à leur propre fournisseur est automatiquement mis en correspondance pour vous (`google/gemini-3.8-flash` → `gemini-3.8-flash` sur `gemini`). Si l'exécution s'arrête avec :

**« is an OpenRouter model id … which has no model by that name »** — Vous utilisez un modèle au format OpenRouter provenant d'un autre fournisseur (`google/gemini-3.8-flash` avec `openai`). Rien n'a été envoyé. Indiquez un modèle appartenant à ce fournisseur, utilisez la méthode qui propose ce modèle, ou passez à la méthode `llm` pour utiliser OpenRouter — le message indique chaque option et l'endroit où le modèle a été configuré :

```diff
- { "method": "openai", "model": "google/gemini-3.8-flash" }
+ { "method": "openai", "model": "gpt-4o" }
```
```json
{ "method": "llm", "model": "google/gemini-3.8-flash" }
```

Ils vérifient également le nom de votre modèle lors de la première utilisation. Si vous constatez un avertissement :

**« is an Anthropic/OpenAI/Gemini model »** — Vous envoyez un modèle au mauvais fournisseur :

```diff
- { "method": "gemini", "model": "claude-sonnet-4-6" }
+ { "method": "anthropic", "model": "claude-sonnet-4-6" }
```

**« not found in available models »** — Le modèle peut être obsolète ou mal orthographié. Champollion récupère la liste des modèles en direct du fournisseur et suggère des alternatives. Consultez la documentation du fournisseur pour les noms de modèles actuels.

:::tip[L'obsolescence des modèles se produit]
Les fournisseurs retirent régulièrement les noms de modèles. Si les traductions échouent soudainement après une mise à jour du fournisseur, vérifiez la sortie `[WARN]` — elle vous montrera les alternatives actuelles.
:::

### `local` : « could not reach … »

La méthode `local` envoie des requêtes à un serveur compatible OpenAI sur votre machine (Ollama, vLLM, LM Studio, llama.cpp). En cas d'échec de connexion, l'erreur indique l'adresse tentée et le paramètre qui l'a définie :

```text
[ERR] Local (OpenAI-compatible) Batch 1 failed: fetch failed (ECONNREFUSED) — could not reach http://localhost:8000/v1 (from LOCAL_API_BASE in .env)
```

L'adresse provient de la première variable définie, dans l'environnement ou dans `.env.local` / `.env` : `LOCAL_API_BASE`, puis `OPENAI_API_BASE`, puis `OPENAI_BASE_URL`. Si aucune n'est définie, la valeur par défaut d'Ollama est utilisée, `http://localhost:11434/v1`. Démarrez le serveur ou corrigez le paramètre indiqué dans le message.

## Qualité de la traduction

### Les traductions reprennent la langue source

La porte de qualité détecte cela. Si une traduction est identique à la source anglaise, elle est rejetée et réessayée. Si cela persiste :

1. **Vérifiez le modèle** — Certains modèles sont peu performants pour des paires de langues spécifiques
2. **Ajoutez des instructions de registre** — Indiquez au modèle la langue à produire :
   ```json
   {
     "languages": {
       "ja": { "name": "Japanese", "register": "Polite/formal Japanese" }
     }
   }
   ```
3. **Essayez un autre modèle** — Passez de `gpt-4o-mini` à `gpt-4o` ou `google/gemini-3.1-pro-preview`

### Sortie en mauvais script (par exemple, texte latin pour le japonais)

La vérification de conformité des scripts de la porte de qualité détecte la plupart des cas. Si cela persiste :

- Vérifiez que le code de locale est correct (`ja`, pas `jp`)
- Ajoutez des instructions de script explicites dans le champ `register` :
  ```json
  { "register": "Japanese using hiragana, katakana, and kanji" }
  ```

### Les noms échouent à la vérification (par ex. « Curtis Forbes » en japonais)

Les noms propres sont corrects en alphabet latin ; indiquez donc à Champollion quels sont vos noms :

```json
{ "protectedTerms": ["Curtis Forbes", "Game Day Suits"] }
```

Le modèle a pour instruction de les conserver tels quels, et une valeur composée uniquement de ces noms n'est jamais signalée comme non traduite ou dans une mauvaise écriture. Sans cette liste, une valeur courte en alphabet latin dans une langue n'utilisant pas l'alphabet latin déclenche une nouvelle tentative demandant s'il s'agit d'un nom ou d'un libellé. Si le modèle la conserve, elle est acceptée en tant que nom et mise en cache, de sorte qu'elle ne soit plus jamais facturée. Vous n'avez pas besoin de `--no-verify`.

### Motifs d'hallucination dans la sortie

Les motifs de trigrammes répétés (par exemple, « hello hello hello ») sont détectés par le détecteur de boucle d'hallucination. Si la sortie est corrompue mais passe le détecteur :

1. **Réduisez la taille des lots** — Les lots plus petits produisent une sortie plus ciblée
2. **Utilisez un modèle plus puissant** — Les modèles plus grands hallucinent moins sur les scripts non-latins
3. **Ajoutez des données de coaching** — Les termes du dictionnaire ancrent la traduction

## Problèmes de fichiers et de format

### « No locale files found »

Champollion détecte automatiquement les fichiers de locale. S'il ne peut pas les trouver :

1. **Vérifiez `localesDir`** — Doit pointer vers le répertoire contenant les fichiers de locale :
   ```json
   { "localesDir": "./locales" }
   ```
2. **Vérifiez la dénomination des fichiers** — Les fichiers doivent être nommés par code de locale : `en.json`, `fr.json`, etc.
3. **Vérifiez le format** — Formats supportés : JSON, JSON imbriqué, YAML, TOML

### Conflits de fichier de verrouillage

`.champollion.lock` enregistre le texte anglais à partir duquel chaque traduction a
été créée. Résolvez un conflit de fusion dans ce fichier comme pour tout fichier
généré : conservez l'une ou l'autre version, exécutez `npx champollion sync`, et committez
le résultat.

:::warning[Supprimer le fichier de verrouillage ne retraduit rien]
Sans le fichier de verrouillage, la synchronisation ne peut pas savoir quelles
chaînes en anglais ont changé depuis la création des traductions existantes.
Elle ne traduit que les clés qui sont **manquantes** dans un fichier cible,
et enregistre l'anglais actuel comme nouvelle référence. Une chaîne en anglais
modifiée avant la suppression du verrou conserve son ancienne traduction, de
façon silencieuse. Pour reconstruire délibérément une locale, utilisez `--force`
(limitez sa portée avec `--pair`) ; les traductions en cache sont réutilisées,
de sorte que seul le texte que le cache n'a jamais vu soit facturé.
:::

### Retraduction de clés spécifiques

Si des traductions individuelles sont incorrectes et que vous souhaitez les forcer à être retraduits sans supprimer le fichier de verrouillage :

```bash
# Re-translate a single key
npx champollion sync --force-keys "hero.title"

# Re-translate multiple keys
npx champollion sync --force-keys "nav.home,nav.about,footer.copyright"
```

Le drapeau `--force-keys` outrepasse la vérification du hachage dans le fichier de verrouillage pour ces clés spécifiques, forçant leur retraduction sans affecter les autres clés. `--redo keys:hero.title` est la même chose sous son nom le plus récent. Les deux sont servis depuis la mémoire de traduction lorsqu'elle contient le texte ; ajoutez `--fresh` pour payer une nouvelle traduction à la place. Une clé contenant une virgule (un msgid gettext étant une phrase entière) s'écrit avec `\,`, en entourant l'argument de guillemets pour le shell : `--redo 'keys:Welcome back\, %(name)s!'`.

### `verify` signale une non-concordance de variable de substitution (ou une autre valeur endommagée)

`champollion verify` (ainsi que la vérification exécutée après chaque synchronisation) signale les valeurs endommagées : une variable de substitution perdue ou renommée, un pluriel ICU corrompu, une valeur dont les lettres ont été supprimées. Un simple `champollion sync` ne les répare **pas**. La valeur existe déjà sur le disque et son entrée dans le verrou indique qu'elle est à jour, la synchronisation la laisse donc telle quelle.

Chaque constat indique la commande qui répare exactement ces clés, par exemple :

```text
[ERR] [VERIFY] fr: 1 i18next {{…}} placeholder mismatch(es): greeting (placeholder {{name}} was changed to {{nom}}) — fix: `champollion sync --pair en:fr --redo keys:greeting`
```

Exécutez cette commande. Lorsqu'une locale s'étend sur plusieurs fichiers, les clés s'écrivent `<file>::<key>` (par exemple `common::nav.home`), ce qui permet de retraduire la clé de ce fichier précis et aucune autre.

Vous n'avez pas besoin de `--fresh`. Si la valeur endommagée provenait de la mémoire de traduction, `verify` l'a déjà supprimée du cache, et l'indique explicitement : `[TM] Evicted 1 cached translation(s) that produced damaged values`. La réexécution traduit alors à nouveau le texte (ou sert la traduction différente du cache lui-même) au lieu de renvoyer la valeur corrompue. Une valeur modifiée à la main n'est jamais mise en cache ; rien n'est donc supprimé pour celle-ci, et la réexécution fonctionne de la même manière.

Pour les fichiers de contenu Markdown/MDX, utilisez plutôt `--retranslate` avec un chemin ou un motif glob (par ex. `--retranslate docs/intro.md`). Cela retraduit ces fichiers à neuf, même s'ils sont à jour ou ont été traduits manuellement. Utilisez `--files` pour limiter une exécution à certains fichiers de contenu sans forcer leur retraduction.

### La traduction de contenu corrompt les blocs de code

Cela ne devrait pas se produire — les blocs de code sont protégés avant la traduction. Si cela se produit :

1. Vérifiez que le bloc de code utilise un clôturage standard (triple backtick)
2. Vérifiez les blocs de code non fermés dans le Markdown source
3. Signalez un problème — c'est un bug dans le système de protection des sentinelles

## Problèmes CLI

### `--watch` ne détecte pas les modifications

La surveillance des fichiers utilise `fs.watch` natif de Node.js. Problèmes connus :

- **Lecteurs réseau** — `fs.watch` ne fonctionne pas de manière fiable sur les montages NFS/SMB
- **Volumes Docker** — Utilisez le mode d'interrogation ou exécutez champollion à l'intérieur du conteneur
- **Répertoires volumineux** — Le moniteur surveille `localesDir` de manière récursive ; les arbres très profonds peuvent dépasser les limites du système d'exploitation

### `npx` exécute une ancienne version

```bash
# Clear the npx cache
npx --yes champollion@latest sync
```

Ou installez globalement :

```bash
npm install -g champollion
champollion sync
```

## Performance

### La synchronisation est lente pour plusieurs langues

Champollion traduit toutes les locales en parallèle par défaut. Si la synchronisation est toujours lente :

1. **Utilisez Google Translate pour les paires à haut volume** — C'est 10–50× plus rapide que la traduction par LLM
2. **Augmentez la taille des lots** (la valeur par défaut est 80) :
   ```json
   { "batchSize": 120 }
   ```
3. **Ajustez la concurrence** — Le parallélisme des locales JSON est par défaut 200 et le contenu 48. Si votre fournisseur API supporte des limites de débit plus élevées :
   ```bash
   npx champollion sync --json-concurrency 80 --content-concurrency 20
   ```
4. **Utilisez un modèle rapide** — `gpt-4o-mini` est considérablement plus rapide que `gpt-4o`

### Coûts API élevés

- **Vérifiez les tailles des lots** — Les lots plus grands = moins d'appels API = coût inférieur
- **Utilisez la mémoire de traduction** — TM est activée par défaut. Exécutez `champollion tm stats` pour vérifier qu'elle fonctionne. Si vous voyez 0 entrées après plusieurs synchronisations, quelque chose peut être mal avec les permissions de votre répertoire `.champollion/`
- **Utilisez la mise en cache des invites** — Champollion divise les messages système/utilisateur pour les accès au cache sur les modèles Anthropic et Google
- **Utilisez Google Translate pour les langues de niveau 2** — Voir le livre de recettes [Translate 30 Languages](/docs/tutorials/translate-30-languages)

### Traductions après un changement de modèle ou de fournisseur

Changer de méthode (par ex. de `llm` à `deepl`), de registre ou de consignes produit de nouvelles traductions pour ce qui est retraduit, car la clé de cache les inclut — mais une simple synchronisation ne retraduit rien de ce qui est déjà fait : seul `champollion sync --redo all` le fait. Changer de **modèle** au sein de la même méthode réutilise ce que le modèle précédent a traduit, sans frais ; la synchronisation vous en informe avant l'estimation. Si vous souhaitez obtenir les propres traductions du nouveau modèle :

```bash
# Have the new model translate what an earlier model wrote
# (what the new model already translated still comes from the cache)
champollion sync --redo all --fresh-on-model-change

# Re-translate specific content files from scratch
champollion sync --retranslate "docs/guides/**"
```

À lui seul, `--fresh-on-model-change` ne modifie que les clés qu'une exécution traduirait de toute façon (les nouvelles ou celles modifiées) : après un simple changement de modèle, une exécution standard de `sync --fresh-on-model-change` n'envoie rien.

Voir [Translation Memory](/docs/concepts/translation-memory) pour plus de détails sur la conception de la clé de cache.

## Récupération après une version défectueuse {#recover-old-damage}

Les valeurs écrites par un ancien pipeline **ne s'autoréparent jamais** : leurs hachages de manifeste correspondent à la source actuelle, donc `sync` les considère comme réglées et aucun contrôle ne les examine à nouveau. Si vous mettez à niveau un projet ayant tourné sur des versions antérieures à la 0.3.0, partez du principe que des corruptions peuvent être présentes dans vos fichiers de locale et procédez d'abord à un audit :

```bash
champollion integrity
```

L'audit détecte les signatures d'altération connues et indique le correctif correspondant pour chacune :

| Constat | Description | Correctif |
|---------|-----------|-----|
| `UNEXPECTED PUA` | Résultat d'une conversion d'écriture (pIqaD/Tengwar/kryptonien) appliquée alors qu'elle n'était pas souhaitée — produit un affichage vide | `champollion repair-script` (hors ligne, exact pour pIqaD) |
| `HOLLOWED VALUES` | La source dont les lettres ont été supprimées — résultat antérieur au contrôle de préservation du contenu | Retraduire (voir ci-dessous) |
| `NO-TRANSLATE DRIFT` | Une URL ou une autre clé textuelle littérale qui a été « traduite » | `champollion sync` (réparée gratuitement, automatiquement) |

Pour les valeurs vidées de leur contenu — ou toute locale en laquelle vous n'avez tout simplement plus confiance — reconstruisez-la :

```bash
champollion sync --pair en:tlh --force
```

`--force` remet en file d'attente chaque clé source pour la ou les paires ciblées. Les correspondances de la mémoire de traduction sont toujours servies, mais chaque résultat servi est **d'abord validé par les contrôles actuels** — une valeur en cache désormais rejetée par le contrôle est évincée et refacturée, de sorte qu'un cache corrompu se répare de lui-même au lieu d'alimenter la reconstruction. Ajoutez `--no-tm` si vous souhaitez quoi qu'il en soit une refacturation entièrement nouvelle, et `--max-cost` pour plafonner les dépenses dans les deux cas.

La vérification post-synchronisation signale également ces signatures, de sorte qu'une locale endommagée fasse échouer `sync` de manière explicite (en indiquant le correctif) au lieu d'être déployée silencieusement.

### Remise en file d'attente ponctuelle après les nettoyages avec `--no-tm` {#one-time-requeue}

Si votre récupération a utilisé `--no-tm`, attendez-vous à ce que la **prochaine** synchronisation mette en file d'attente un lot de clés identiques à la source que vous pensiez réglées. `--no-tm` écrit des valeurs sans les enregistrer dans la mémoire de traduction, et une valeur *non estampillée* identique à sa source ne se distingue pas d'une valeur non traduite — elle est donc remise en file d'attente une fois, renvoyée (souvent identique), estampillée, et définitivement réglée. Il s'agit d'un coût ponctuel, pas d'une boucle infinie. Prévisualisez exactement les clés concernées avec :

```bash
champollion sync --dry --list-keys
```

## Toujours bloqué ?

- **[GitHub Issues](https://github.com/gamedaysuits/champollion/issues)** — Recherchez les problèmes existants ou signalez-en un nouveau
- **[Architecture Docs](/docs/concepts/architecture)** — Comprenez la conception du système
- **[Quality Gate](/docs/concepts/quality-gate)** — Comment fonctionne la validation en coulisse
