---
sidebar_position: 8
title: "Enregistrement des corpus et des voies d'exposition"
slug: /network/sovereignty/registering-corpora
description: "Enregistrez un corpus d'évaluation sans le céder. Les quatre niveaux d'exposition — local-only, private, public et sealed —, les régimes de licence qui les accompagnent, et comment fetch-from-source garantit que le contenu du corpus reste hors de notre portée."
related:
  - label: "Data Stewardship"
    to: /docs/network/sovereignty/data-sovereignty
    kind: doc
    note: "The position these mechanics implement"
  - label: "Ownership & Terms"
    to: /docs/network/sovereignty/ownership-transfer
    kind: doc
  - label: "Evaluation Datasets"
    to: /docs/network/leaderboard/datasets
    kind: doc
    note: "The catalogue these lanes apply to"
  - label: "Corpus Design Framework"
    to: /docs/network/specifications/corpus-design
    kind: spec
---

# Enregistrement des corpus et voies d'exposition

> **Résumé pour les décideurs.** Vous pouvez enregistrer un corpus d'évaluation auprès du Réseau
> afin que les méthodes puissent être comparées par rapport à celui-ci **sans nous transmettre les données**. Chaque
> corpus est enregistré sous la forme d'une *fiche de métadonnées* épinglée par hachage SHA, et non sous forme de contenu — les
> phrases réelles sont récupérées depuis leur source au moment de l'évaluation. Lorsque vous vous enregistrez,
> vous faites deux choix indépendants : un **niveau d'exposition** — ce qui quitte votre
> machine (`local-only`, `private`, `public` ou `sealed`, où le corpus est
> chiffré sur votre appareil sous une clé de gardiennage M-sur-N) — et une **voie de
> licence**, qui régit l'usage qui peut être fait du corpus (public, recherche non commerciale
> uniquement, ou privé). C'est le mécanisme qui permet à une communauté de rendre
> sa langue *mesurable* sans la rendre *extractible*.

L'évaluation de la traduction automatique exige généralement l'inverse de la souveraineté des données : « téléchargez votre ensemble de test pour que nous puissions le noter ». C'est inacceptable pour les corpus de langues autochtones et autres corpus communautaires, où les données appartiennent aux personnes dont elles proviennent. Le Réseau est construit de sorte que vous n'ayez jamais à faire ce compromis.

---

## 1. L'enregistrement est des métadonnées, pas du contenu {#1-registration-is-metadata-not-content}

Un corpus enregistré est une **fiche** : un petit enregistrement JSON décrivant *où* le corpus se trouve et *ce qu'il est*, avec un hachage de contenu pour que les octets exacts puissent être vérifiés — mais **pas de phrases**. Une fiche contient :

| Champ | Ce que c'est |
|-------|-----------|
| `url` | Où le corpus est récupéré (l'archive en amont que vous contrôlez) |
| `sha256` | Hachage de contenu de l'archive épinglée — prouve que personne n'a échangé les données |
| `license` | Identifiant SPDX (ou `LicenseRef-…` pour une licence personnalisée) |
| `language_pair` | Source → cible, par exemple `eng-crk` |
| `do_not_train` | Toujours défini — les données d'évaluation ne doivent jamais être entraînées |
| `attribution` | Le crédit du constructeur/linguiste affiché partout où le corpus apparaît |

Au moment de l'évaluation, le harnais **récupère à partir de la source**, vérifie le `sha256`, et note par rapport aux références fraîchement récupérées. Le Réseau ne stocke, n'héberge ni ne redistribue jamais le contenu du corpus. Si vous mettez hors ligne l'archive en amont, le corpus cesse simplement d'être exécutable — le contrôle reste avec vous. C'est la même discipline de récupération à partir de la source appliquée à tout le catalogue (voir [Datasets d'évaluation](/docs/network/leaderboard/datasets)).

:::info[Pourquoi un hash plutôt qu'une copie]
Un hash de contenu permet à un score auto-déclaré d'être **revérifié** par rapport au corpus réel,
non modifié, sans que nous ne possédions jamais ce corpus. Une exécution dont les chiffres ne
se reproduisent pas par rapport à la source épinglée au hash est rejetée. La vérifiabilité et
la non-possession ne sont pas en tension ici — le hash est ce qui rend les deux possibles.
:::

---

## 2. Deux choix distincts

L'enregistrement vous pose deux questions indépendantes, et il convient de bien les
distinguer car elles protègent des éléments différents :

1. **Ce qui quitte votre machine** — le *niveau d'exposition*.
2. **Ce à quoi votre corpus peut servir** — la *voie de licence*.

Un corpus peut être scellé et non commercial, ou public et libre de droits commerciaux, ou
toute autre combinaison. L'un n'implique pas l'autre.

### 2a. Niveaux d'exposition — ce qui quitte votre machine

Quatre niveaux, définis dans `cli/lib/corpus-registration.mjs`. **Le contenu
en clair du corpus n'est jamais téléversé dans aucun d'eux** — il ne s'agit pas d'un paramètre de configuration, cela
s'applique à tous les niveaux. L'enregistrement utilise toujours par défaut le niveau le plus privé.

| Niveau | Enregistré ? | Ce que nous recevons | Fiche suivie |
|---|:---:|---|:---:|
| **Privé / local uniquement** | ❌ | Rien. La fiche et le texte restent sur votre machine. **Par défaut.** | ❌ |
| **Enregistrement privé** | ✅ | Métadonnées uniquement — un jeu de données de test tenu secret à la manière du WMT. Vous en conservez la garde ; les résultats peuvent être publiés sans exposer les données. | ✅ |
| **Enregistrement public** | ✅ | Métadonnées + un pointeur de récupération à la source. Votre texte est récupéré en amont à la demande, jamais hébergé ici. Nécessite une licence autorisant la redistribution. | ✅ |
| **Scellé** | ✅ | Une fiche exempte de contenu. Le texte chiffré reste chez vous. | ✅ |

#### Tenir un jeu de test à l'écart de tout service IA externe

Ne pas téléverser votre texte est une première garantie. Ne pas l'*envoyer* à l'API d'un
modèle pendant votre évaluation en est une autre, et cela importe tout particulièrement pour un jeu de test qui
contient des formulations sensibles. Marquez le fichier comme étant strictement local en plaçant à côté de lui un petit
fichier portant le même nom avec `.champollion.json` ajouté :

```bash
# data/nurse_checked_test.tsv  →  data/nurse_checked_test.tsv.champollion.json
echo '{"transmission": "local-only"}' > data/nurse_checked_test.tsv.champollion.json
```

Cela fonctionne pour n'importe quel format de corpus (TSV, JSONL, paires de texte brut, JSON). Dès
lors, `mt-eval run` traite le corpus comme scellé :
- avec un fournisseur distant (OpenRouter, OpenAI, Anthropic, Gemini), l'exécution est
  **refusée avant tout envoi de texte**, et avant même qu'une clé d'API ne soit demandée ;
- avec `--provider local` pointé vers un modèle sur cette machine (une adresse
  de bouclage telle que `http://localhost:11434/v1`), l'exécution se poursuit ;
- avec `--method local-model -m <model>` (un modèle NLLB, OPUS-MT ou MADLAD
  que le banc de test charge dans son propre processus ; `-m` est requis), l'exécution se poursuit :
  aucune phrase ne quitte la
  machine, et le téléchargement des poids transfère les fichiers du modèle, jamais votre texte ;
- avec un moteur de TA ou un plugin de méthode (`--method <plugin dir>`), l'exécution est
  refusée à moins que vous n'attestiez que son transport est intégralement local
  (`--attest-local-transport`, consigné dans le journal d'exécution) : le banc de test ne peut pas
  savoir où un plugin ou un service envoie du texte ;
- les métriques d'évaluation propres à la langue issues de sa fiche linguistique ne sont **pas
  chargées**. Elles proviennent de paquets séparés capables de rechercher des mots sur un
  service externe, comme un dictionnaire en ligne. L'exécution est évaluée sans
  elles, et la fiche d'exécution indique qu'elles ont été retenues et pourquoi ;
- `mt-eval publish` retient les phrases et, par défaut, remplace une
  invite de guidage ou personnalisée par son sha256, de sorte que les exemples d'invite tirés de
  vos propres phrases restent eux aussi sur cette machine. Certaines métadonnées relatives au corpus
  deviennent publiques avec le score : son identifiant, sa version, sa paire de langues, sa taille, le
  sha256 du fichier, sa licence et son attribution, son niveau de contamination, la
  mention de son caractère local uniquement, ainsi que le nom de ses segments. Pour un identifiant qui n'est pas un
  jeu de données enregistré, la publication crée également une ligne publique `datasets` avec
  les mêmes identifiant, paire, taille et sha256, en plus de son domaine, du nom de ses segments et
  de sa plage de difficulté. L'aperçu `--dry-run` les liste pour votre exécution, à côté de
  ce qui reste ici : chaque phrase, le fichier et son chemin. Les tiers voient alors un
  score sur un jeu de test qu'ils ne peuvent pas ouvrir. Le banc d'essai est auto-réalisé, personne d'autre
  ne peut le réexécuter, et le sha256 permet uniquement à une personne détenant le même fichier
  de confirmer qu'il s'agit bien de ce fichier ;
- ce que les outils affichent omet les phrases, car un agent IA lisant
  le terminal transmet ce qu'il lit à son fournisseur de modèle. `mt-eval compare`
  affiche les identifiants d'entrée et les scores à la place des phrases, et tout message d'erreur
  qui en cite une est affiché en la masquant. `--show-text` les affiche, pour
  un opérateur humain au terminal. Les fichiers écrits dans votre dossier de résultats conservent le
  texte, et chacun porte la marque du corpus : chaque journal d'exécution, rapport,
  fichier de comparaison et tableau de bord généré par le banc d'essai à partir du corpus reçoit son
  propre `.champollion.json` avec les mêmes conditions ainsi que `derived_from`. L'outil
  suivant, ou une exécution ultérieure sur ce fichier, le traite alors également comme protégé. Le
  terminal indique le nom de chaque fichier contenant le texte ;
- le cache de traduction conserve les entrées de ce corpus à l'écart : sous
  `<cache-dir>/protected/<namespace>/` (par défaut
  `eval/cache/harness/protected/…`), dans un espace de noms indexé par les paramètres
  de l'exécution, le sha256 du corpus et ses conditions, de sorte qu'une entrée n'est jamais
  restituée qu'à une exécution sur ce même corpus — jamais à une exécution sur un autre corpus ou sur un
  corpus non marqué. Chaque fichier de cache à cet endroit porte la même marque
  `.champollion.json`. (Les entrées mises en cache avant l'existence de cette protection se trouvent dans le
  cache ordinaire sans être marquées ; supprimez `eval/cache/harness/` une fois pour les effacer.)

Cette marque ne peut que rendre un corpus plus strict. Aucune licence et aucun
indicateur `--allow-data-collection` ne peut l'assouplir. Si le fichier marqueur est
illisible, l'exécution s'interrompt plutôt que de l'ignorer.

**Le mode Scellé constitue la garantie la plus forte offerte par le système.** Votre corpus est
chiffré **sur votre appareil**, avec la clé du groupe de gardiens, et le texte chiffré
reste sur votre machine ou votre nœud d'évaluation. Champollion ne reçoit que la
fiche exempte de contenu. Sur le nœud hors ligne, la clé est fragmentée de manière à ce qu'il faille
**M parmi N** gardiens réunis pour autoriser une exécution ; cette cérémonie est mise en place mais
n'a pas encore été employée avec de véritables gardiens. Les jeux scellés sont répertoriés mais mis en quarantaine, et sont associés à
un corpus *qualificatif* public qu'une méthode doit valider avant même qu'une exécution scellée ne puisse
être proposée. Consultez [Organiser un concours souverain](/docs/network/sovereignty/run-a-sovereign-contest) et le [Nœud d'évaluation souverain](/docs/network/sovereignty/sovereign-eval-node).

### 2b. Voies de licence — ce à quoi le corpus peut servir

Par ailleurs, la licence régit les endroits où les résultats peuvent apparaître.

#### Public

Un corpus sous licence ouverte (par exemple CC0, CC-BY) dont les références peuvent apparaître sur des surfaces publiques et dont les exécutions peuvent figurer au classement public. Le contenu est toujours récupéré à partir de la source — « public » régit l'*exposition des références et des classements*, non l'hébergement. La plupart du catalogue (Tatoeba, GlobalVoices, TICO-19, IN22, SMOL, ALT, Turkic-x-WMT, WMT24++) se trouve dans cette voie.

#### Recherche non commerciale uniquement

Un corpus sous licence non commerciale (par exemple CC BY-NC-SA, ou une licence personnalisée communautaire/ONG telle que celle des kits Gamayun `LicenseRef-TWB-Gamayun`). Il peut être **comparé à des fins de recherche** — les méthodes s'exécutent sur celui-ci, les scores sont calculés — mais il est **exclu de tous les chemins commerciaux, prix et API.** L'admissibilité est **basée sur l'utilisation**, non sur le corpus :

- la **voie commerciale est stricte** — tout ce qui n'est pas clairement sous licence commerciale est exclu ;
- la **voie de recherche est indulgente** — les corpus non commerciaux sont les bienvenus ;
- la **quarantaine l'emporte toujours** — un corpus signalé comme un sous-ensemble impropre (ou autrement interdit) ne peut jamais figurer dans *aucune* voie, indépendamment de la licence.

C'est ainsi qu'une communauté peut laisser son corpus stimuler les progrès de la recherche tout en le tenant à l'écart de tout produit.

#### Privé

Un corpus enregistré pour **vos propres exécutions notées**, où les références ne sont jamais publiées. Vous tenez la source ; vous exécutez l'évaluation ; vous décidez ce qui, le cas échéant, est jamais montré. Un corpus privé peut être rendu public ou non commercial ultérieurement — l'exposition ne s'assouplit que par une décision explicite et dirigée par le propriétaire, jamais silencieusement.

| Voie de licence | Évaluable sur banc d'essai | Références affichées publiquement | Peut figurer au classement public | Dans le parcours commercial / prix / API |
|------|:---:|:---:|:---:|:---:|
| **Public** | ✅ | ✅ | ✅ | ✅ (si la licence le permet) |
| **Recherche non commerciale uniquement** | ✅ | dépend de la licence | voie de recherche uniquement | ❌ |
| **Privé** | ✅ (vos exécutions) | ❌ | ❌ | ❌ |

:::note[La lane commerciale est une barrière de sécurité, non une activité commerciale]
Champollion lui-même est non-commercial — il n'existe pas d'API payante ou de produit commercial derrière
tout cela. La lane commerciale/prix existe comme une barrière *prospective* : elle enregistre,
mécaniquement, quels corpus pourraient jamais légalement apparaître dans un contexte de prix ou
commercial, de sorte qu'aucun usage futur — par quiconque — ne puisse dériver au-delà d'une
licence ou des conditions d'un intendant.
:::

---

## 3. Garanties de souveraineté

L'enregistrement est conçu autour de la [position d'intendance des données](/docs/network/sovereignty/data-sovereignty). Concrètement :

- **La possession reste à la source.** Nous tenons un hachage et une URL, pas les données.
- **Le contrôle appartient au propriétaire.** La voie est le choix du propriétaire, et l'exposition ne s'assouplit que par une décision explicite. Retirer l'archive en amont révoque l'exécutabilité.
- **Non commercial signifie non commercial.** Les corpus NC sont mécaniquement exclus des voies commerciales, prix et API — non par promesse, par porte.
- **Les sous-ensembles impropres ne peuvent jamais figurer.** La quarantaine remplace la licence, de sorte qu'un corpus interdit de classement reste interdit partout.
- **L'attribution est obligatoire.** Le crédit du constructeur/linguiste accompagne la fiche à chaque surface où le corpus apparaît.

Pour savoir comment les conditions par langue sont définies — y compris le transfert de propriété des méthodes pour les prix parrainés — voir [Propriété et conditions](/docs/network/sovereignty/ownership-transfer).

---

## 4. Comment enregistrer

Le schéma de fiche de corpus et les outils de construction/vérification sont documentés dans le [Cadre de conception de corpus](/docs/network/specifications/corpus-design) et le [Livre de recettes de création de corpus](/docs/network/tutorials/corpus-creation). En bref :

1. Hébergez l'archive de corpus quelque part que vous contrôlez (elle y reste — elle n'est jamais copiée dans le Réseau).
2. Écrivez une fiche : `url`, `sha256`, `license`, `language_pair`, `attribution`, `do_not_train`.
3. Choisissez la voie d'exposition (publique / non commerciale / privée).
4. Enregistrez la fiche. Les méthodes peuvent maintenant être comparées au corpus récupéré à partir de la source, selon les règles de la voie.

Vous ne téléchargez jamais les phrases. Vous pouvez arrêter à tout moment.

### L'identifiant de la fiche

`champollion register-corpus` rédige la fiche à votre place et lui attribue un identifiant de
la forme `eval-<source>-<target>-<name>[-<role>]-v1` :

- **name** provient de `--name` : « Ward phrases » devient `ward-phrases`. L'éditeur
  n'est utilisé que lorsque le nom ne comporte aucun caractère a–z ou 0–9, par
  exemple un nom rédigé uniquement en syllabaire.
- **role** précise la finalité du jeu de données : `--role test`, `--role dev` ou
  `--role train`. Il n'apparaît dans l'identifiant que si vous le transmettez. L'outil ne
  devine jamais de rôle ; ainsi, un jeu de test de validation n'est désigné comme jeu de test que si vous
  le spécifiez.

```bash
champollion register-corpus --yes --name "Ward phrases" --pair "eng>xyz" \
  --license proprietary --tier private --role test --size 120 --domain medical
```

Cela enregistre `eval-eng-xyz-ward-phrases-test-v1`. Pour choisir l'identifiant
vous-même, transmettez `--id eval-…` ; il sera utilisé exactement tel quel.

### Quel identifiant de licence pour un jeu de test privé

`--license` consigne les conditions que les propriétaires des données accordent réellement. Il
ne s'agit pas d'un paramètre fictif, et l'outil n'en choisit aucun pour vous. Demandez-leur
d'abord (aux familles, aux cliniciens, au délégué aux données de la communauté), puis choisissez
l'identifiant qui correspond à ce qu'ils ont déclaré :

| Ce que les propriétaires accordent | `--license` |
|---|---|
| Ils publient déjà le texte sous une licence standard | son identifiant SPDX, par exemple `CC-BY-NC-4.0` |
| L'utiliser uniquement pour évaluer des systèmes : ne jamais entraîner de modèle dessus, ne jamais le redistribuer, aucune évaluation payante | `community-eval-grant-nc` (`LicenseRef-Champollion-Eval-Grant-NC`) |
| De même, mais l'évaluation pour des utilisateurs payants est autorisée | `community-eval-grant` (`LicenseRef-Champollion-Eval-Grant`) |
| Aucune concession au-delà de leur propre usage : tous droits réservés | `proprietary` (`LicenseRef-Proprietary`) |
| Leurs propres conditions qu'aucun de ces choix ne décrit | `LicenseRef-<a name for their terms>`, saisi tel quel, avec les conditions consignées là où le gestionnaire les conserve |

Chaque identifiant `LicenseRef-…` du tableau (les deux autorisations d'évaluation et
`proprietary` inclus) constitue une concession sur mesure : Champollion ne l'interprète jamais
au nom des propriétaires. Toute évaluation distante par rapport à ce corpus est refusée tant que le gestionnaire
n'a pas consigné son autorisation, de sorte que seuls les modèles présents sur votre propre machine sont testés
par rapport à lui. En cas de doute, le choix le plus prudent qui vous permette
malgré tout de mesurer est `community-eval-grant-nc` ; enregistrez-le comme provisoire et
demandez au gestionnaire de le confirmer ou d'indiquer le bon identifiant.

La licence ne modifie pas la destination des phrases. Un jeu strictement local (le
marqueur `.champollion.json`, ou `--tier local-only`) demeure sur votre machine
quelles que soient les stipulations de sa licence : le marqueur refuse tout modèle distant, et une
licence ne peut jamais l'assouplir. La licence détermine ce que les tiers peuvent faire du
jeu de données s'il venait à être partagé, ainsi que les voies d'évaluation auxquelles il peut accéder. Dès lors qu'un fichier a
été enregistré avec `--data`, son identifiant est consigné dans le fichier
`.champollion.json` situé à ses côtés et ne change jamais. Réenregistrer ce fichier
interrompt le processus et vous demande de transmettre l'identifiant avec `--id`.

Pour un jeu de test par rapport auquel un modèle peut être entraîné (`--role test`, ou un
jeu strictement local ou privé sans rôle défini), la commande affiche ensuite
les étapes nmt-forge qui doivent précéder la première évaluation du jeu : l'enregistrer,
filtrer votre corpus d'entraînement par rapport à lui, et consigner vos prédictions.
Le score de référence `mt-eval run` intervient après celles-ci. Un banc d'essai est une lecture d'évaluation,
et nmt-forge refuse les prédictions consignées après une telle lecture.

`mt-eval run --corpus <that file>` retrouve la fiche par le biais du même
fichier `.champollion.json`. L'identifiant de jeu de données de l'exécution correspond à l'identifiant de la fiche, de sorte que chaque exécution
sur le jeu porte le même nom, et le nom de fichier est conservé sur l'exécution comme son
chemin de corpus. Le niveau de contamination de la fiche est consigné tel que la fiche l'indique.
Ces deux éléments ne s'appliquent que tant que le fichier correspond à celui que vous avez enregistré : s'il a
été modifié depuis, l'exécution le signale et n'utilise ni l'un ni l'autre.

Une fiche `local-only`, `private` ou `sealed` indique que son texte n'est pas publié
(`Contamination: NONE`), de sorte que l'enregistrement compare d'abord le fichier que vous transmettez
avec `--data` (ou `--seal-input`) aux corpus publics. Une copie locale du dépôt
le compare aux fiches de corpus qu'elle contient. Une installation par npm, qui
ne fournit aucune fiche de corpus, le compare au catalogue des corpus publics : l'interface CLI
télécharge les identifiants et les sommes de contrôle des corpus publics et les compare sur votre
machine, de sorte que la somme de contrôle de votre fichier ne la quitte jamais. Lorsque le fichier est identique
octet par octet à un corpus public (même sha256), l'enregistrement s'interrompt et nomme ce corpus.
Enregistrez-le comme public, utilisez des phrases qui sont véritablement privées, ou conservez le
niveau tout en précisant l'exposition avec `--contamination` (la fiche consigne alors
que le texte est public). Un jeu scellé composé de texte public est refusé : il ne
testerait rien.

Lorsqu'aucune comparaison ne peut être effectuée (vous êtes hors ligne, ou le catalogue ne peut pas être
joint), la fiche reçoit la note `Contamination: UNCHECKED`, et non `NONE`, à moins
que vous n'indiquiez vous-même une note avec `--contamination`. Réenregistrez en ligne pour
effectuer la comparaison. `mt-eval` traite un corpus `UNCHECKED` comme tout corpus qui
n'est pas noté `LOW` : ses scores rejoignent la voie réservée aux comparaisons relatives. La
vérification compare des fichiers entiers, de sorte qu'un jeu public ayant été modifié ou reformaté n'est
pas reconnu ; `mt-eval contest prepare` compare les lignes.
