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
2. **Utilisez un modèle avec des limites de débit plus élevées** (par exemple, `google/gemini-3.5-flash` offre des limites généreuses)
3. **Utilisez une méthode moins chère/plus rapide** pour les paires à haut volume — Google Translate n'a pas de limites de débit :
   ```json
   { "pairs": { "en:it": { "method": "google-translate" } } }
   ```

### Modèle non trouvé / Erreurs 404

Les fournisseurs LLM directs (`openai`, `anthropic`, `gemini`) valident votre chaîne de modèle à la première utilisation. Si vous voyez un avertissement :

**« looks like an OpenRouter path »** — Vous utilisez un modèle au format OpenRouter (`google/gemini-3.5-flash`) avec un fournisseur direct. Les fournisseurs directs utilisent des noms de modèles simples :

```diff
- { "method": "gemini", "model": "google/gemini-3.5-flash" }
+ { "method": "gemini", "model": "gemini-2.5-flash" }
```

Ou basculez vers la méthode `llm` pour utiliser OpenRouter :
```json
{ "method": "llm", "model": "google/gemini-3.5-flash" }
```

**« is an Anthropic/OpenAI/Gemini model »** — Vous envoyez un modèle au mauvais fournisseur :

```diff
- { "method": "gemini", "model": "claude-sonnet-4-6" }
+ { "method": "anthropic", "model": "claude-sonnet-4-6" }
```

**« not found in available models »** — Le modèle peut être obsolète ou mal orthographié. Champollion récupère la liste des modèles en direct du fournisseur et suggère des alternatives. Consultez la documentation du fournisseur pour les noms de modèles actuels.

:::tip[L'obsolescence des modèles se produit]
Les fournisseurs retirent régulièrement les noms de modèles. Si les traductions échouent soudainement après une mise à jour du fournisseur, vérifiez la sortie `[WARN]` — elle vous montrera les alternatives actuelles.
:::

## Qualité de la traduction

### Les traductions reprennent la langue source

La porte de qualité détecte cela. Si une traduction est identique à la source anglaise, elle est rejetée et réessayée. Si cela persiste :

1. **Vérifiez le modèle** — Certains modèles fonctionnent mal pour des paires de langues spécifiques
2. **Ajoutez des instructions de registre** — Dites au modèle quelle langue produire :
   ```json
   {
     "languages": {
       "ja": { "name": "Japanese", "register": "Polite/formal Japanese" }
     }
   }
   ```
3. **Essayez un modèle différent** — Passez de `gpt-4o-mini` à `gpt-4o` ou `google/gemini-2.5-pro`

### Sortie en mauvais script (par exemple, texte latin pour le japonais)

La vérification de conformité des scripts de la porte de qualité détecte la plupart des cas. Si cela persiste :

- Vérifiez que le code de locale est correct (`ja`, pas `jp`)
- Ajoutez des instructions de script explicites dans le champ `register` :
  ```json
  { "register": "Japanese using hiragana, katakana, and kanji" }
  ```

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

Si `.champollion.lock` se trouve dans un mauvais état :

```bash
# Reset the lock file (next sync will retranslate everything)
rm .champollion.lock
npx champollion sync
```

:::warning
Supprimer le fichier de verrouillage signifie que la prochaine synchronisation retraduit toutes les clés, pas seulement les clés modifiées. Cela a des implications de coût API pour les grands projets.
:::

### Retraduction de clés spécifiques

Si des traductions individuelles sont incorrectes et que vous souhaitez les forcer à être retraduits sans supprimer le fichier de verrouillage :

```bash
# Re-translate a single key
npx champollion sync --force-keys "hero.title"

# Re-translate multiple keys
npx champollion sync --force-keys "nav.home,nav.about,footer.copyright"
```

Le drapeau `--force-keys` remplace la vérification du hachage du fichier de verrouillage pour ces clés spécifiques, forçant la retraduction sans affecter les autres clés.

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

### Traductions obsolètes après changement de fournisseur

Si vous passez d'une méthode de traduction à une autre (par exemple, `llm` à `deepl`), le cache TM peut toujours servir les anciennes traductions de la méthode précédente pour les clés dont le texte source n'a pas changé. La clé de cache inclut le nom de la méthode, donc la plupart des cas sont gérés automatiquement. Mais si vous avez modifié `model` au sein de la même méthode :

```bash
# Force fresh translations for all keys
champollion sync --no-tm

# Or clear the cache entirely and re-sync
champollion tm clear --yes
champollion sync
```

Voir [Translation Memory](/docs/concepts/translation-memory) pour plus de détails sur la conception de la clé de cache.

## Récupération après une mauvaise version {#recover-old-damage}

Les valeurs écrites par un ancien pipeline **ne se réparent jamais d'elles-mêmes** : les hachages de leur manifeste correspondent à la source actuelle, `sync` les considère donc comme traitées et aucune porte (gate) ne les examine plus jamais. Si vous mettez à niveau un projet qui exécutait des versions antérieures à la 0.3.0, partez du principe que des dommages peuvent être présents dans vos fichiers de locales et effectuez d'abord un audit :

```bash
champollion integrity
```

L'audit détecte les signatures de dommages connues et indique le correctif pour chacune d'elles :

| Anomalie | Description | Correctif |
|---------|-----------|-----|
| `UNEXPECTED PUA` | Résultat de la conversion de script (pIqaD/Tengwar/Kryptonien) écrit alors que la conversion n'était pas souhaitée — s'affiche vide | `champollion repair-script` (hors ligne, exact pour pIqaD) |
| `HOLLOWED VALUES` | La source avec ses lettres supprimées — résultat d'avant la porte de préservation du contenu | Retraduire (voir ci-dessous) |
| `NO-TRANSLATE DRIFT` | Une URL ou une autre clé verbatim qui a été « traduite » | `champollion sync` (réparé gratuitement, automatiquement) |

Pour les valeurs vidées — ou toute locale en laquelle vous n'avez tout simplement plus confiance — reconstruisez-la :

```bash
champollion sync --pair en:tlh --force
```

`--force` remet en file d'attente chaque clé source pour la ou les paires ciblées. Les correspondances de la mémoire de traduction sont toujours fournies, mais chaque correspondance fournie est **d'abord validée par rapport aux portes actuelles** — une valeur en cache que la porte rejette désormais est expulsée et refacturée, de sorte qu'un cache empoisonné se guérit de lui-même au lieu d'alimenter la reconstruction. Ajoutez `--no-tm` si vous souhaitez une refacturation complète quoi qu'il en soit, et `--max-cost` pour plafonner les dépenses dans les deux cas.

La vérification post-synchronisation signale également ces signatures, de sorte qu'une locale endommagée fait échouer `sync` de manière visible (avec le correctif indiqué) au lieu d'être déployée silencieusement.

### Une remise en file d'attente unique après les nettoyages de `--no-tm` {#one-time-requeue}

Si votre récupération a utilisé `--no-tm`, attendez-vous à ce que la **prochaine** synchronisation mette en file d'attente un lot de clés identiques à la source (source-echo) que vous pensiez traitées. `--no-tm` écrit les valeurs sans les estampiller dans la mémoire de traduction, et une valeur *non estampillée* identique à sa source est indiscernable d'une valeur non traduite — elle est donc remise en file d'attente une fois, revient (souvent identique), est estampillée et est définitivement traitée. Il s'agit d'un coût unique, et non d'une boucle. Prévisualisez exactement de quelles clés il s'agit avec :

```bash
champollion sync --dry --list-keys
```

## Toujours bloqué ?

- **[GitHub Issues](https://github.com/gamedaysuits/champollion/issues)** — Recherchez les problèmes existants ou signalez-en un nouveau
- **[Architecture Docs](/docs/concepts/architecture)** — Comprenez la conception du système
- **[Quality Gate](/docs/concepts/quality-gate)** — Comment fonctionne la validation en coulisse
