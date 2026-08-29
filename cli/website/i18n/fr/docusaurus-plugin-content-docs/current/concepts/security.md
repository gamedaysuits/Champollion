---
sidebar_position: 4
title: "Sécurité"
---

# Sécurité et sûreté

Champollion est conçu pour être sûr dans des environnements adversariaux — où les données de locale pourraient provenir de sources non fiables, où les noms de fichiers élaborés pourraient franchir les limites de répertoires, et où la sortie du LLM peut contenir n'importe quoi.

## Modèle de menace

| Menace | Vecteur d'attaque | Atténuation |
|--------|--------------|-----------|
| **Prototype pollution** | Clés JSON élaborées (`__proto__`, `constructor`) | Rejetées au moment de l'analyse |
| **Traversée de répertoires** | Codes de locale comme `../../etc/passwd` | Écritures de fichiers validées dans les répertoires configurés |
| **Corruption de bloc de code** | LLM traduit à l'intérieur des clôtures de code | Protection par sentinelle Unicode |
| **Clés halluccinées** | LLM retourne des clés qui n'ont pas été envoyées | Validation de réponse — seules les clés acceptées sont écrites |
| **Dépense de jetons incontrôlée** | Boucles de retry infinies | Budget plafonné via `maxRetries` |

## Garde contre la prototype pollution

Toutes les clés de locale sont validées par rapport à une liste de blocage avant le traitement :

- `__proto__`
- `constructor`
- `prototype`

Toute clé correspondant à ces motifs est rejetée avec une erreur. Cela empêche les attaquants d'utiliser des fichiers de locale élaborés pour modifier les prototypes d'objets JavaScript.

## Confinement des chemins

Lors de l'écriture de fichiers de locale, champollion valide que le chemin de sortie reste dans les répertoires configurés (`localesDir`, `contentDir`). Les codes de locale sont assainis — un code comme `../../secrets` ne peut pas écrire en dehors du répertoire attendu.

## Protection des blocs

Lors de la traduction de contenu Markdown, les éléments structurés sont remplacés par des sentinelles Unicode avant que le texte ne soit envoyé au LLM :

1. **Blocs de code** (clôturés et en ligne) → sentinelle
2. **Shortcodes Hugo** (`{{< >}}`, `{{% %}}`) → sentinelle  
3. **HTML brut** → sentinelle
4. **Variables d'interpolation** (`{{ .Count }}`) → sentinelle

Après la traduction, les sentinelles sont remplacées par le contenu original. Le LLM ne voit jamais les blocs de code, les shortcodes ou le HTML — il ne peut pas les corrompre.

## Validation de réponse

Lorsque le LLM retourne une réponse JSON, champollion valide que :
- Seules les clés qui ont été envoyées dans le lot apparaissent dans la réponse
- Aucune clé supplémentaire n'est injectée
- La réponse s'analyse comme du JSON valide

Les clés halluccinées sont silencieusement supprimées. Cela empêche la sortie du LLM d'injecter des traductions inattendues dans vos fichiers de locale.

## Portail de qualité

Chaque traduction est validée par cinq vérifications déterministes avant d'être écrite sur le disque. Consultez [Portail de qualité](/docs/concepts/quality-gate) pour plus de détails.

## Backoff exponentiel

Les appels API utilisent un backoff exponentiel avec gigue sur les réponses 429 (limite de débit) et 5xx (erreur serveur). Trois tentatives avec délai croissant empêchent de surcharger l'API lors des pannes.

## Délai d'expiration des requêtes

Chaque requête API a un délai d'expiration de 30 secondes via `AbortController`. Cela empêche le processus de synchronisation de se bloquer indéfiniment sur une connexion morte.

## Défaillances de traduction bruyantes

Lorsque l'API est indisponible ou qu'une traduction échoue, champollion lève une erreur bruyante avec des conseils exploitables au lieu d'écrire silencieusement des données corrompues. Aucun espace réservé préfixé par `[EN]` n'est jamais écrit lors de la synchronisation.

```
[ERR] Content sync for fr: no API key available.
  Set OPENROUTER_API_KEY in .env.local to translate content.
```

L'échec d'un fichier n'arrête pas l'ensemble de la synchronisation — l'erreur est enregistrée et le pipeline continue vers le fichier suivant, de sorte que vous obtenez une progression maximale par exécution.

## Vérification post-synchronisation

Après la fin de toutes les traductions, champollion relit les fichiers de locale écrits depuis le disque et exécute une passe de vérification. Cela détecte l'écart entre le rapport de succès de la synchronisation et les traductions étant incorrectes en réalité :

- **Parité des clés** — toutes les clés source présentes dans chaque cible
- **Marqueurs `[EN]`** — marqueurs de secours hérités des exécutions antérieures
- **Traductions vides** — valeurs vides qui ont glissé
- **Conformité des scripts** — locales non-latines avec traductions ASCII uniquement
- **Préservation des espaces réservés** — les espaces réservés ICU correspondent à la source

Ignorer avec `--no-verify` ou exécuter de manière autonome avec `npx champollion verify`.

## Tests

Les propriétés de sécurité sont vérifiées par la suite de tests adversariaux :

```bash
npm run test:redteam    # prototype pollution, path traversal, encoding attacks
```

---

## Voir aussi

- [Architecture](/docs/concepts/architecture) — comment l'écosystème en trois parties se connecte
- [Référence CLI — intégrité](/docs/reference/cli#integrity) — commande de vérification d'intégrité
- [Référence CLI — provenance](/docs/reference/cli#provenance) — commande d'audit de provenance
- [Spécification des plugins](/docs/reference/plugin-spec) — champs de provenance dans les manifestes de plugins
- [Portail de qualité](/docs/concepts/quality-gate) — vérifications de sécurité au niveau de la traduction
