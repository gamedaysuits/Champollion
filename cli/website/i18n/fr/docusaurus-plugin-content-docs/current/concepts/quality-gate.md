---
sidebar_position: 3
title: "Contrôle de qualité"
related:
  - label: "Coaching Data"
    to: /docs/concepts/coaching-data
    kind: concept
  - label: "Script Converters"
    to: /docs/concepts/script-converters
    kind: concept
  - label: "Scoring Specification"
    to: /docs/network/specifications/scoring
    kind: arena
    note: "How quality is scored on the public benchmark"
  - label: "Cookbook: Translate 30 Languages"
    to: /docs/tutorials/translate-30-languages
    kind: cookbook
    note: "Audit quality across 30 locales"
---

# Portail de Qualité

Chaque traduction passe par un portail de validation déterministe avant d'être écrite sur le disque. Le portail de qualité détecte les modes de défaillance courants de la traduction automatique — pas de replis silencieux, pas de contenu indésirable écrit dans vos fichiers de locale.

## Contrôles de Validation

| Contrôle | Ce qu'il détecte | Étiquette du contrôle |
|-------|----------------|-----------|
| **Vide / blanc** | Le modèle a renvoyé une chaîne vide ou des espaces | `[GATE] empty` |
| **Écho de la source** | Le modèle a renvoyé le texte source anglais original — tel quel ou déguisé (accents, casse, caractères pleine chasse), dans la valeur entière ou dans une forme plurielle | `[GATE] source-echo` |
| **Structure ICU / variable** | Une variable, un mot-clé ou sélecteur de pluriel traduit, un `#` ou `%s` manquant | `[GATE] icu` |
| **Balisage** | Une balise ouverte, fermée ou imbriquée différemment de la source | `[GATE] markup` |
| **Fin de phrase à côté d'une variable** | Une fin de phrase placée par la traduction juste avant ou après une variable alors que la source n'en comporte pas : `Take this medicine at {time}.` → `… sina. {time}.` | `sentence break beside a placeholder` |
| **Boucle d'hallucination** | Motifs de trigrammes répétés (par ex., `"Qo' Qo' Qo'"`) | `[GATE] hallucination` |
| **Gonflement de la longueur** | Le résultat est nettement plus long que la source | `[GATE] length` |
| **Suppression de contenu** | Le résultat est la source dont les lettres ont été supprimées | `[GATE] content` |
| **Conformité de l'écriture** | Système d'écriture incorrect pour la locale cible | `[GATE] script` |
| **Même résultat pour différentes entrées** | Un seul texte renvoyé pour plusieurs chaînes sources différentes (une phrase mémorisée) | `[GATE] shared-output` |
| **Catégories de pluriel ICU** | Formes de pluriel requises manquantes pour la locale | `[GATE] icu-plural` |

Les clés déclarées [`noTranslate`](/docs/getting-started/configuration#no-translate) n'atteignent jamais le quality gate — elles sont copiées textuellement depuis la source, il n'y a donc rien à valider.

**Les pages Markdown subissent les mêmes vérifications, bloc par bloc.** Dans un dossier de contenu (`contentDir`, documentation Docusaurus), chaque titre, paragraphe, élément de liste et cellule de tableau est vérifié individuellement, tout comme chaque champ de front-matter. Les contrôles sont ceux décrits ci-dessus : vide, écho de la source, boucle d'hallucination, gonflement de la longueur, suppression de contenu, écriture et même résultat pour différentes entrées. Un titre court tel que `## Feast` qui revient sous la forme d'une phrase complète est refusé, tout comme la clé d'application contenant le même texte.

Un bloc refusé est **redemandé une fois de plus, avec la raison**. Le modèle est informé de l'erreur et du fait qu'un texte correct tel quel peut être renvoyé sans modification. Certains refus ne peuvent être tranchés par une règle fixe : un titre qui est un nom propre (`### BLEURT (Sellam et al., 2020)`), une entrée de liste de références, un tableau de codes ou une glose peuvent être tout à fait corrects tels quels, ou constituer un oubli de traduction. Si le bloc est revenu inchangé, ou conservé en écriture latine dans une langue non latine, et que le modèle fournit à nouveau la même réponse, cette réponse est acceptée comme délibérée. Tout autre refus doit passer le contrôle sans réserve à la seconde réponse. Un point de terminaison qui déclare ne suivre aucune instruction (`"acceptsInstructions": false`) n'est pas sollicité à nouveau ; sa première réponse est évaluée comme une seconde.

Ce qui est encore refusé est transmis à la méthode `fallback` de la paire. En l'absence de celle-ci, **le bloc conserve son texte source, sans aucun marqueur ajouté à la page**, n'est jamais mis en cache, et l'entrée de verrouillage de la page indique `pending:<hash>`. `status` et `verify` répertorient ces pages, et sync nomme chaque bloc. Le refus est mémorisé : la prochaine synchronisation simple ne renverra pas ce bloc au même modèle (voir [Blocs Markdown et champs de front-matter refusés](#refused-markdown-blocks-and-front-matter-fields)). Le code, les liens et le balisage d'un bloc sont protégés séparément, et un commentaire HTML n'est jamais envoyé. Certains textes sont conservés tels quels sans faire l'objet d'une nouvelle demande :
- un nom court (`## GitHub`), mesuré sans son code en ligne, ses guillemets, ses parenthèses et `{#anchor}` ;
- une entrée de liste de références, ou une liste de références complète dans un seul bloc ;
- des lettres pleine chasse que la source elle-même présente.

Un tableau est évalué d'après ses cellules, et non ses barres verticales ni sa ligne de délimitation. `verify` vérifie les blocs déjà présents sur le disque de la même manière, à l'exception d'un bloc qui correspond exactement à ce que sync a accepté et mis en cache pour sa source. Un bloc qui échoue génère un avertissement, ce qui fait échouer `verify --strict`, et s'accompagne de la commande de réparation `champollion sync --pair en:fr --redo files:<page>`. Sync affiche la même commande pour le même fichier.

### Vide/Blanc

Rejette les traductions qui sont des chaînes vides, contiennent uniquement des espaces blancs, ou `null`. Cela détecte les modèles qui ne retournent rien pour les clés difficiles.

### Écho Source

Détecte les cas où le modèle renvoie le texte source anglais au lieu de le traduire. Ce phénomène est fréquent avec les chaînes courtes et les invites insuffisamment précises. Deux règles s'appliquent et mesurent des éléments différents :

1. **Une copie exacte** (octet par octet identique à la source) est refusée — à l'exception d'une valeur **courte, principalement ASCII** : 30 caractères ou moins, plus de 80 % d'ASCII pur. `"Blog"`, `"GitHub"`, `"npm"` restent légitimement en anglais, donc pour une cible en écriture latine, une telle copie est acceptée (`verify` la répertorie comme un écho de la source) ; pour une cible non latine, on demande une fois au modèle s'il s'agit d'un nom, et deux réponses identiques sont acceptées comme tel. **Cette exemption concerne la longueur et ne couvre que les copies exactes.**
2. **Une copie déguisée** — la source avec seulement la casse, les accents, l'espacement, les caractères invisibles ou les formes de compatibilité (lettres pleine chasse, ligatures) modifiés — est refusée lorsque la source comporte **trois mots ou plus** contenant des lettres (les variables telles que `{count}` ou `%s` et les balises de balisage ne comptent pas), **quelle que soit sa brièveté**. `"Book an appointment"` (19 caractères, 3 mots) → `"Bóok án appóintment"` est refusé ; `"cafe"` → `"café"` (1 mot) est accepté, car une véritable traduction peut ne différer de l'anglais que par ses accents. Un nom plus long qui gagne légitimement des accents (`"Universite de Montreal"`) est accepté dès lors que vous déclarez l'orthographe accentuée comme terme protégé.

Les deux règles s'appliquent également **à chaque forme de pluriel**. Un pluriel gettext `msgstr[n]`, une branche ICU `{n, plural, …}` ou une clé i18next `_one`/`_other` sont soumis aux mêmes règles qu'une valeur au singulier : un pluriel en russe dont la forme `few` a été renvoyée en anglais avec des accents est refusé au même titre qu'un singulier.

Les valeurs plus longues qui sont également correctes sans modification — URL, chemins de dépôts, identifiants de produits — ne relèvent pas d'un problème du quality gate et ne peuvent être corrigées en ajustant ce dernier : la réponse correcte *est* l'écho, de sorte que toute sortie possible du modèle est incorrecte. Déclarez ces clés avec [`noTranslate`](/docs/getting-started/configuration#no-translate) et elles contourneront complètement le pipeline. Les clés dont la valeur est une URL sont traitées ainsi par défaut.

### Boucle d'Hallucination

Analyse les motifs de trigrammes (3 caractères) dans la sortie. Si un trigramme se répète plus qu'un seuil donné par rapport à la longueur de la sortie, la traduction est rejetée. Cela détecte les sorties dégénérées comme `"Qo' Qo' Qo' Qo' Qo'"`.

### Inflation de Longueur

Rejette les traductions où la longueur du résultat dépasse `maxLengthRatio × source length` (par défaut : 4×) — strictement plus : une traduction d'exactement 4× est acceptée. Cela permet d'intercepter les hallucinations du modèle qui génèrent des pavés de texte à partir d'une entrée courte.

Configurable via `maxLengthRatio` dans votre configuration.

### Suppression de contenu

Le pendant inverse du gonflement de la longueur. Un modèle dépourvu de vocabulaire pour une chaîne peut supprimer chaque lettre qu'il n'arrive pas à traduire et ne conserver que la ponctuation et les espaces de la source :

```
"low-resource nmt · tokenizers · nêhiyawêwin"  →  "   ·   · êhiêi"
"the simple-builder approach"                  →  "  "
```

Rien d'autre ne détecte cela. La chaîne n'est ni vide, ni un écho, ni répétitive, et à 33 % de la *longueur* de la source, elle franchit `minLengthRatio` sans difficulté.

Le contrôle compare les **caractères de contenu** — lettres et chiffres, en ignorant la ponctuation, les espaces et le formatage invisible — entre la source et le résultat. Cependant, la densité ne peut constituer à elle seule la règle, car des écritures légitimement denses se situent exactement au même niveau :

| Source | Résultat | Contenu conservé | Verdict |
|--------|--------|------------------|---------|
| `low-resource nmt · tokenizers · nêhiyawêwin` | `   ·   · êhiêi` | 14% | **rejeté** |
| `Getting started` | `入门` | 14% | accepté |
| `Frequently asked questions` | `常见问题` | 17% | accepté |

Tout seuil qui intercepterait le premier rejetterait d'emblée le chinois, le japonais et le coréen. Ce qui les distingue n'est pas la proportion préservée, mais *son origine* : la sortie vidée est une **sous-séquence** de sa propre source — pouvant être obtenue en supprimant des caractères de celle-ci — tandis qu'une véritable traduction ne partage pour ainsi dire rien avec la source. Un signalement exige **les deux** signaux, de sorte que le contrôle est nécessaire mais non suffisant, tout comme le détecteur de répétition.

Configurable via `minContentRetention` (par défaut `0.35`), par paire ou par langue. L'augmenter rend le contrôle plus strict ; il ne se déclenche jamais sans le signal de sous-séquence.

:::note[Il s'agit d'un signal lié au vocabulaire, non d'un curseur de qualité]
Lorsque ce contrôle se déclenche de manière répétée pour une langue cible donnée, cela signifie que le modèle ne dispose pas des mots nécessaires pour ce texte — il s'agit généralement de chaînes courtes et denses en jargon dans une langue au lexique restreint. Relâcher le seuil rétablit la corruption silencieuse ; cela ne produit pas une traduction. Corrigez l'invite, les données de coaching ou la paire.
:::

### Conformité du Script

Pour les locales dont la fiche de langue indique une écriture non latine (arabe, CJK, cyrillique, …), ce contrôle valide que le résultat n'est pas exclusivement en caractères latins. Les lettres sont classées par **écriture Unicode**, et non par octet : le latin accentué (`"Bóók"`) et le latin pleine chasse (`"Ｂｏｏｋ"`) sont du latin, aucun des deux n'est donc accepté comme du russe. Les lettres latines pleine chasse sont refusées pour toute cible en dehors de la typographie CJK (où `"ＯＫ"` relève de l'usage courant en japonais) — il s'agit d'anglais déguisé. Les tolérances habituelles s'appliquent : un nom court conservé tel quel (la question nom-ou-libellé ci-dessus), les termes protégés déclarés, et les clés `noTranslate` (parmi lesquelles les URL) n'échouent jamais à ce contrôle.

Deux précisions sur ce que ce contrôle n'est *pas* :

- Il n'est **pas déterminé par le champ de configuration `script:`.** Ce champ sélectionne l'orthographe de sortie pour la [conversion d'écriture](/docs/getting-started/configuration#script-conversion) ; les attentes du quality gate proviennent des fiches de langue.
- Il valide systématiquement l'**écriture de travail émise par le modèle**, *avant* toute conversion d'écriture. Les locales disposant d'un convertisseur d'écriture (crk, sr, tlh, …) produisent correctement une sortie dans l'écriture de travail latine et sont donc exemptées de ce contrôle ; la conversion — si la configuration l'active — intervient après le quality gate.

### Balisage

Les balises sont du code. Pour chaque nom de balise, la traduction doit ouvrir, fermer et auto-fermer le même nombre de balises que la source, en les imbriquant de la même manière (`<b>` dans `<a>` reste dans `<a>`) ; l'ordre des éléments frères peut changer selon l'ordre des mots. `"Please <strong>book</strong> now"` → `"Veuillez <strong>réserver maintenant"` est refusé — une balise fermante perdue corrompt la page. Dans un message au pluriel, chaque forme est comparée à la forme source qu'elle traduit. `verify` applique la même vérification aux fichiers.

### Fin de phrase à côté d'une variable

Une variable est renseignée à l'exécution ; par conséquent, un point ou une fin de phrase placé juste à côté par la traduction modifie ce que lit l'utilisateur : `"Take this medicine at {time}."` → `"… sina. {time}."` affiche l'heure comme une phrase distincte. Le quality gate refuse toute traduction qui place une fin de phrase (`.`, `!`, `?`, ou le signe équivalent d'un autre système d'écriture : `。`, `？`, `।`, `؟`, `።`, `᙮`, …) juste **avant** une variable, ou juste **après** celle-ci lorsque du texte suit, dès lors que la source n'en comporte pas à cet endroit et que la traduction compte davantage de fins de phrase que la source. Une variable qui est simplement déplacée en fin de phrase (`"Shipped by {carrier} on {date}."` → `"Expédié le {date} par {carrier}."`) est acceptée. Il en va de même pour des points de suspension, un nombre décimal ou un nom de fichier (`{host}.com`), ainsi qu'une abréviation d'une seule lettre (`"M. {name}"`). Une abréviation plus longue placée devant une variable (`"ca. {count}"`) ne pouvant être distinguée d'une fin de phrase, elle est également refusée, et le mécanisme de secours (fallback) de la paire ou une réponse reformulée la prend alors en charge. `verify` signale les mêmes valeurs sur le disque, en indiquant la commande `--redo` pour solliciter une nouvelle traduction. Les messages pluriels et select ICU sont laissés au contrôle ICU.

### Même résultat pour différentes entrées

Un modèle ayant mémorisé une phrase de son entraînement peut la renvoyer pour des chaînes qu'il ne connaît pas : une même phrase pour le titre de l'application, « Contact the school », un titre de newsletter et son en-tête, chacun passant pourtant individuellement tous les contrôles précédents. Lorsqu'une même traduction répond à **trois chaînes sources distinctes ou plus** au cours de l'exécution d'une locale — et qu'elle compte quatre mots ou plus, ou que les sources comptent chacune deux mots ou plus avec peu de points communs —, ces clés sont refusées (de sorte que la nouvelle tentative, puis le repli (fallback), s'en chargent). **Deux** chaînes sources différentes suffisent lorsque les indices sont probants : toutes deux comptent deux mots ou plus, partagent moins de la moitié de leurs mots, et la traduction partagée compte quatre mots ou plus (`"Thank you for coming!"` et `"Please bring the forms."` recevant la même phrase en réponse). Une phrase interceptée de cette façon est mémorisée pour la locale : une synchronisation ultérieure qui la recevrait à nouveau, même pour une seule chaîne, la refuse, et les entrées du cache qui l'ont déjà fournie sont purgées, de sorte qu'une réexécution (redo) interroge à nouveau le modèle au lieu de l'écrire depuis le cache. Les synonymes se réduisant à une seule traduction courte (`"OK"`/`"Okay"`/`"Sure"` → `"D'accord"`, `"Close"`/`"Dismiss"` → `"Fermer"`) sont acceptés, tout comme un texte source unique utilisé sous plusieurs clés. Les blocs Markdown et les champs de front-matter des fichiers de contenu de l'exécution sont également pris en compte, de même que chaque branche d'un message ICU plural ou select (les branches d'un même pluriel comptent pour une seule source — une langue sans flexion de nombre écrivant le même texte dans chacune). Les résultats sont comparés sans tenir compte de la casse, de la ponctuation ni des marqueurs de bloc Markdown ; ainsi `"S?"`, `"S."` et un titre `# S` constituent une seule et même sortie. Le décompte inclut ce que la locale contient déjà sur le disque et ce que le cache fournirait (une phrase mise en cache texte par texte par un autre outil est refusée au niveau du cache et non écrite) ; ainsi, une clé ajoutée synchronisation après synchronisation est également détectée. `verify` échoue sur ce même motif sur le disque, et l'outil MCP `translate` le refuse au sein d'un appel.

### Une question ayant perdu sa marque interrogative

Lorsque la source se termine par `?` ou `!` et que la traduction ne se termine ni par cela ni par l'équivalent utilisé par son système d'écriture (`？`, `؟`, le `;` grec, `¿…?`, `！`, …), `sync` et `verify` émettent un avertissement : `"Where does it hurt?"` rédigé sous forme d'affirmation sera lu comme tel. Il s'agit d'un avertissement et non d'un refus, car certaines langues marquent l'interrogation par un mot ou une particule plutôt que par un signe de ponctuation. L'avertissement indique les clés concernées ainsi que la commande `--redo keys:<key> --fresh` permettant de redemander la traduction (`--fresh`, car le cache conserve la réponse).

## Ce qui se passe en cas d'Échec

1. La traduction en échec est consignée dans stderr avec un préfixe `[GATE]`, le nom de la clé, la raison et un aperçu de la valeur
2. La clé n'est **pas** écrite dans le fichier de locale
3. La cascade de nouvelles tentatives s'enclenche (voir ci-dessous)
4. Si elle échoue toujours, le refus est **mémorisé** (voir [Les clés refusées sont retenues](#refused-keys-are-held-back))

```
[GATE] hero.title: source-echo — "Welcome to our platform"
[GATE] nav.about: hallucination — "À À À À À À À À"
```

## Nouvelle tentative avec feedback et cascade de réessais

Une clé rejetée par le quality gate bénéficie d'**une nouvelle tentative avec feedback** : le motif de rejet est injecté dans le prompt en tant que contexte propre à la clé (une nouvelle tentative aveugle à basse température renverrait un résultat identique au bit près). Si la nouvelle tentative réussit, la clé est écrite et la synchronisation est au **vert** — un rejet par le quality gate qui s'autorépare n'est pas un échec, et c'est le comportement prévu. Les clés qui échouent encore après cette nouvelle tentative sont ignorées et signalées (la synchronisation se termine avec le code `2`).

La nouvelle tentative passe par la méthode de traduction propre à la paire, quelle qu'elle soit — LLM, Google Translate, DeepL ou un fournisseur direct. Seules les méthodes basées sur un LLM lisent le feedback ; la ligne d'exécution le précise (`retrying with feedback` ou `asking once more (deepl takes no instructions…)`). Un point de terminaison `api` ne reçoit le feedback que s'il déclare `"acceptsInstructions": true` (sur la paire ou dans son manifeste de plugin) ; celui qui déclare `false` — un modèle NMT entraîné tel que `nmt-forge serve`, qui fournirait la même réponse — n'est pas sollicité à nouveau du tout : ses réponses sont évaluées comme le serait une seconde réponse, et ce qu'il refuse est redirigé vers la solution de repli (fallback) de la paire. La nouvelle tentative s'applique également aux correspondances de la mémoire de traduction : une valeur en cache rejetée par le filtre est évincée et retraduite au cours de la même exécution, de sorte qu'un cache corrompu se répare de lui-même.

### Les clés refusées sont retenues

Un refus est mémorisé dans `.champollion.lock`, par clé, pour le **texte source actuel** de la clé ainsi que pour la **méthode et le modèle** ayant produit la réponse refusée. Les chaînes d'interface Docusaurus (`i18n/<locale>/code.json` et les fichiers JSON des plugins) suivent la même règle, par fichier et par identifiant. La prochaine exécution simple de `sync` ne renvoie pas cette clé au même modèle — ce qui facturerait la même réponse — et indique combien ont été retenues ainsi que la marche à suivre :

- redemander : `champollion sync --redo keys:<key>` (ou `--redo all`, ou `--fresh`) — spécifier la clé constitue une nouvelle tentative explicite ;
- renseigner la valeur autrement : ajouter une méthode de `"fallback"` à la paire (elle est sollicitée pour les clés que la méthode principale de la paire a refusées), lister la clé dans `noTranslate` si elle doit rester telle quelle, ou rédiger manuellement la traduction dans le fichier.

Une clé retenue reste non traduite, de sorte que la synchronisation se termine avec le code `2` jusqu'à ce qu'elle soit renseignée. Modifier le texte source, le modèle ou la méthode lève la rétention (le refus concernait ce texte précis produit par ce modèle). Le cache est toujours interrogé pour cette clé — la rétention bloque les appels payants, pas les appels gratuits. Une clé qu'une réexécution (redo) n'a pas pu mener à terme constitue la seule exception, détaillée ci-dessous.

### Blocs Markdown et champs de front-matter refusés

La même règle s'applique aux fichiers de contenu (`contentDir`, documentation Docusaurus). Un bloc ou un champ de front-matter refusé par le quality gate est mémorisé dans `.champollion-content.lock`, par page, par bloc et par locale, pour le **texte source actuel** du bloc ainsi que pour la **méthode et le modèle** ayant produit la réponse refusée. Un bloc est identifié par son texte source ; par conséquent, modifier le paragraphe lève la rétention. La prochaine exécution simple de `sync` ne le renvoie pas au même modèle et indique combien de blocs et de champs ont été retenus, et sur quelle page :

- un bloc retenu conserve son texte source sur la page, sans marqueur, jusqu'à ce qu'il soit traduit ; le reste de la page est écrit ;
- un champ de front-matter retenu conserve son texte source de la même manière, et le reste de la page est écrit ;
- une page traduite dans son intégralité (`contentSegmentation: "page"`) est refusée dans son intégralité lorsque sa réponse endommage un bloc protégé ou vide la page de son contenu. Elle est mémorisée d'après le texte de son corps et retenue en bloc : elle n'est pas écrite, et aucun élément de celle-ci n'est envoyé tant qu'elle n'est pas traduite. Modifier le corps ou basculer vers la segmentation par blocs lève la rétention.

Un refus prononcé par une version antérieure du quality gate se lève de lui-même. Lorsqu'une vérification est assouplie, ce qu'elle avait refusé fait l'objet d'une nouvelle demande lors de la synchronisation suivante, sans nécessiter de réexécution (redo).

L'ordre de priorité est le même que pour les clés :

1. Une page explicitement désignée pour une réexécution est toujours envoyée : `champollion sync --redo files:<page>`, `--redo content` (chaque page), `--retranslate`, ou tout élément situé sous `--fresh`.
2. Dans le cas contraire, un bloc ou un champ refusé est retenu. Si la paire dispose d'une méthode de `fallback` qui ne l'a pas refusé, cette solution de repli est sollicitée et la méthode principale de la paire ne l'est pas.
3. Un changement de modèle ou de méthode lève la rétention, tout comme une modification du texte source du bloc.

Le cache reste consulté en premier, de sorte que la rétention bloque les appels payants et non les appels gratuits. Un bloc renseigné d'une autre façon supprime son enregistrement : par une méthode de secours, par le cache ou par un paragraphe que vous rédigez vous-même dans la traduction (un dossier de contenu conserve les paragraphes rédigés manuellement). Un bloc ou un champ retenu n'est pas traduit, donc la synchronisation se termine avec le code `2` jusqu'à ce qu'il soit renseigné. Il en va de même pour un bloc refusé par le quality gate au cours de cette exécution. Une exécution à blanc (dry run) liste ce qu'une exécution réelle retiendrait.

### Une réexécution qui n'a pas pu se terminer

Lorsque `--redo all`, `--redo keys:` ou un changement de modèle (`--redo all --fresh-on-model-change`) laisse des clés d'un fichier clé-valeur non traduites, celles-ci sont enregistrées comme **en attente** (pending) dans `.champollion.lock`, et la prochaine synchronisation simple `sync` les redemande au modèle — directement auprès du modèle, et non du cache (le but de la réexécution étant d'obtenir le texte du nouveau modèle). `champollion status` en dresse la liste. Si cette nouvelle tentative est également refusée, la clé reste en attente (la commande status l'indique) et est retenue comme toute clé refusée. Par ordre de priorité : une clé désignée par `--redo`/`--fresh` est toujours envoyée ; une clé en attente bénéficie de cette unique nouvelle tentative ; une clé refusée est retenue. Une chaîne d'interface Docusaurus ne bénéficie pas de nouvelle tentative en attente : si elle est refusée lors d'une réexécution, elle est retenue dès la prochaine synchronisation simple, tout comme un bloc de contenu.

Par ailleurs, lorsqu'un lot complet échoue (erreur d'analyse JSON), Champollion réessaie avec des lots progressivement plus réduits :

```
Full batch (80 keys) → parse error
  └→ Half batch (40 keys) → 2 failures
      └→ Individual keys (1 each) → isolates the 2 problem keys
```

Le budget de nouvelle tentative est plafonné par `maxRetries` (par défaut : 3, configurable par langue). Cela prévient les dépenses de jetons incontrôlées sur les clés qui échouent régulièrement.

Après avoir épuisé toutes les tentatives, les clés posant problème sont consignées dans les journaux et ignorées. Une clé n'ayant reçu aucune réponse exploitable (absente de la réponse) est redemandée lors de la prochaine exécution de `sync` ; une clé refusée par le quality gate est retenue, comme expliqué ci-dessus.

## Mise en Cache des Invites

Le message système (registre, règles de grammaire, notes de style) est séparé du message utilisateur (les clés à traduire). Cette séparation est intentionnelle :

- Le message système est **identique entre les lots** pour une locale donnée
- Les fournisseurs comme Anthropic et Google mettent en cache les messages système répétés
- Résultat : le premier lot paie le coût complet des jetons, les lots suivants ne paient que pour le message utilisateur

Cela peut réduire considérablement les coûts en jetons pour les projets avec de nombreux lots.

## Validation du Format de Message ICU

La commande `integrity` valide les motifs pluriels du Format de Message ICU par rapport aux règles plurielles CLDR. Si votre fichier source utilise la syntaxe ICU comme :

```json
"items": "{count, plural, one {# item} other {# items}}"
```

Champollion vérifie que les versions traduites incluent toutes les catégories plurielles requises pour la locale cible. Par exemple, l'arabe nécessite six catégories (`zero`, `one`, `two`, `few`, `many`, `other`) — pas seulement `one` et `other`.

### Formes de pluriel non fournies par la traduction

L'invite spécifie les catégories CLDR de la langue cible. Lorsqu'un message au pluriel revient sans l'une des formes que la langue utilise pour les décomptes ordinaires (tout nombre de 0 à 1 000 — en russe, `few` pour 2, 3, 4 et `many` pour 0, 5, 6), le quality gate interroge à nouveau le modèle en précisant les formes manquantes ainsi que les nombres qu'elles couvrent. Une seconde réponse ne comportant toujours pas ces formes est acceptée, ne fait jamais l'objet d'une troisième demande, et n'est jamais complétée par l'outil — sync procède alors ainsi :

- émet un avertissement précisant chaque clé et ses formes manquantes, ainsi que la commande permettant de redemander la traduction (`sync --redo keys:… --fresh`, où un `--model` plus puissant peut aider) ;
- dans un catalogue gettext, où `msgfmt` requiert chaque `msgstr[n]`, écrit les formes manquantes sous forme de copies de `other` et annote l'entrée avec un commentaire de traducteur `# champollion:` (Poedit et Weblate l'affichent ; `verify` le lit, y compris en CI sans le cache) ;
- dans les fichiers ICU (next-intl, ARB), écrit le message tel qu'il a été reçu ; l'application affiche la forme `other` pour ces décomptes.

Un tel message n'est pas considéré comme traduit. Une synchronisation ultérieure exécutée avec une autre méthode ou un autre modèle — qui n'y a pas encore répondu, comme le modèle hébergé de la CI après un modèle local — le redemande auprès du modèle, et non depuis le cache (qui contient la réponse incomplète) ; l'estimation en chiffre le coût. `sync --redo gaps` redemande chacun de ces messages, quelle que soit la source de l'omission. Si la nouvelle réponse est elle aussi dépourvue de ces formes, le message reste en l'état (marqué dans un catalogue), et `.champollion.lock` consigne quelles configurations ont répondu sans les fournir, afin qu'aucune d'entre elles ne soit sollicitée à nouveau pour le même texte ([guide CI](/docs/guides/ci-cd#plural-gaps)).

`verify` signale les deux cas avec la commande de réparation. Les formes qui ne sont atteintes qu'au-delà de 1 000 ou par des fractions (`many` en français et en espagnol, utilisé pour 1 000 000) génèrent une ligne d'information et non un avertissement. Un moteur de traduction automatique (DeepL, Google, …) ne pouvant recevoir de directives sur les formes à produire, sa réponse ne fait l'objet d'aucune nouvelle tentative — elle est seulement signalée. Pour les fichiers i18next, chaque forme absente de la source (le `count_many` français issu de l'anglais) constitue sa propre clé, traduite à partir du texte de `_other` : un LLM est sollicité pour cette forme, et sync l'indique ; avec un moteur de traduction automatique, l'outil précise que la valeur contient la forme `other`.

Exécutez `champollion integrity` pour vérifier l'exhaustivité des pluriels dans toutes les locales.

## Application de la Terminologie

Pour les paires coachées avec un dictionnaire, champollion exécute une vérification de terminologie post-traduction. Après que le portail de qualité soit passé, il vérifie si le LLM a réellement utilisé les termes de dictionnaire requis.

```
[TERM] en→fr: 2 term violation(s)
  • hero.title: "dashboard" → expected "tableau de bord" but got "panneau de contrôle"
```

Les violations de terminologie sont des **avertissements, pas des erreurs bloquantes**. La traduction est toujours écrite sur le disque. C'est intentionnel — le LLM peut avoir des raisons valables de choisir une alternative (contexte, grammaire), et bloquer sur les non-concordances de termes causerait plus de mal que de bien.

Pour corriger les violations, mettez à jour le dictionnaire de coaching ou modifiez manuellement le fichier de locale.

---

## Voir aussi

- [Comment fonctionne la Synchronisation](/docs/concepts/how-sync-works) — où le portail de qualité s'inscrit dans le pipeline
- [Méthodes de Traduction](/docs/guides/translation-methods) — méthodes qui alimentent le portail
- [Convertisseurs de Script](/docs/concepts/script-converters) — conversion de script post-portail
- [Données de Coaching](/docs/concepts/coaching-data) — amélioration de la qualité de traduction en amont
- [Mémoire de Traduction](/docs/concepts/translation-memory) — mise en cache des traductions validées
- [Référence CLI — sync](/docs/reference/cli#sync) — drapeaux de synchronisation incluant le comportement de nouvelle tentative
- [Référence CLI — integrity](/docs/reference/cli#integrity) — audit pluriel ICU
