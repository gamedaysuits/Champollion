---
title: "Règles relatives aux données et à la transmission"
slug: /agents/data-rules
description: "Les règles que chaque outil Champollion applique aux données des peuples : le sidecar set/1 champ par champ, local-only et sa valeur par défaut provisoire, training not-allowed, les locuteur·rice·s et détenteur·rice·s ayant donné leur accord, ce que chaque outil affiche et n'affiche jamais, les quatre modes de transmission, les niveaux d'enregistrement et les sorties de modèle en tant que dérivés."
---

# Règles relatives aux données et à la transmission

Les personnes détentrices des données linguistiques décident de leur utilisation. Les rails consignent leurs
décisions aux côtés de chaque fichier, et chaque outil respecte ce qui est consigné — avec
l'appropriation et le contrôle des données linguistiques par la communauté comme règle de conception fondamentale, et non comme
un simple paramètre. Cette page présente l'ensemble exact des règles : le rôle de chaque champ, ce que
les outils refusent, et les éléments dont vous avez la garde exclusive.

## Le sidecar (set/1)

À côté de tout fichier de données, `<file>.champollion.json`, `$schema`
`https://champollion.dev/schemas/set/1.json`. Les clés inconnues sont refusées ; les notes
figurent sous `x-`. Un sidecar rédigé avant set/1 (sans `$schema`) est interprété comme set/0
et demeure valide (`champollion upgrade` le réécrit).

| Champ | Valeurs | Effet |
|---|---|---|
| `transmission` | `local-only` (l'unique valeur) | Seul un modèle présent sur cet ordinateur peut voir le texte ; chaque outil refuse de l'envoyer où que ce soit (`mt-eval project offer` y compris) |
| `role` | `train` · `dev` · `test` · `sealed` · `input` · `resource` | L'usage prévu du fichier. `test` et `sealed` ne font jamais l'objet d'un entraînement |
| `kind` | `parallel` · `monolingual` · `lexicon` · `grammar` · `glossary` | Ce qu'il contient |
| `pair` | `{source, target}` | Le sens de lecture de ses colonnes, selon les codes des fiches |
| `fields` | `{source, target}` | Quelle colonne ou quel champ JSON contient chaque côté |
| `terms.training` | `allowed` · `not-allowed` | `not-allowed` : aucun modèle ne peut être entraîné dessus |
| `terms.owner` | texte | Qui le détient, selon les termes de la personne détentrice |
| `terms.speakers` | texte | De qui sont les paroles qu'il contient, selon les termes de la personne détentrice |
| `terms.speakers_agreed` | `yes` · `not-yet` · `some-said-no` | Si les personnes dont ce sont les paroles ont donné leur accord |
| `terms.consent_record` | chemin | La note de consentement, relative au dossier du fichier |
| `holders_agreed` | `{by, date}` | Qui parmi les détenteurs a accepté qu'une sortie strictement locale se trouve là où elle est (n'assouplit rien) |
| `derived_from` | chemin | Le fichier protégé à partir duquel celui-ci a été créé ; ses marquages ont été reportés ici |
| `id`, `name`, `license`, `tier`, `segment`, `sha256`, `rows`, `card`, `registeredAt` | | Écrit par `champollion network register-corpus` ; un fichier modifié (autre sha256) ne reçoit plus l'identifiant de la fiche |
| `written_by` | texte | La commande qui l'a écrit |

**Verrou.** Un sidecar ne peut que rendre un fichier plus strict : il n'assouplit jamais ce qu'indiquent une enveloppe
de corpus ou une entrée de registre.

## Strictement local et valeur par défaut provisoire

`champollion data add` marque le fichier qu'il écrit comme strictement local lorsque le paramètre `defaults.transmission`
du projet est `local-only` (ce qu'écrit `champollion new`), et
systématiquement pour `--into test`. Ce marquage constitue la protection de l'outil jusqu'à ce que les détenteurs
répondent, signalée par `"x-transmission-default": true`.

- La première réponse des détenteurs est décisive. `champollion data mark <file>
  --may-leave` lifts a provisional mark; `--local-only` leur en attribue la décision (l'indicateur
  est supprimé).
- **Remarque.** L'outil ne peut pas savoir qui a exécuté la commande. Ne levez un marquage provisoire
  qu'avec la réponse explicite des détenteurs.
- **Verrou.** Un marquage strictement local établi par les détenteurs ne peut être levé par aucune
  commande : *« ce fichier est marqué comme strictement local, et un sidecar ne peut que devenir plus
  strict. La possibilité qu'il quitte cet ordinateur relève de la décision de ses détenteurs — s'ils
  sont d'accord, modifiez le sidecar manuellement. »*
- **Verrou.** `data mark` sur un fichier qui n'est pas encore strictement local nécessite `--local-only` ou
  `--may-leave` : *« la possibilité que le texte de ce fichier soit un jour transmis à un service d'IA
  externe relève de la décision de ses détenteurs, elle n'est donc jamais présumée »*.

Ce que signifie strictement local dans chaque outil :

| Emplacement | Ce qui se passe |
|---|---|
| Toute évaluation (`mt-eval run`, évaluation forge) | La politique résout vers `sealed` (niveau `local-only`) : seul un point de terminaison de bouclage, l'adaptateur intra-processus du banc d'essai lui-même (`local-model`), ou une méthode externe exécutée avec `--attest-local-transport` peut voir le texte |
| Sortie du terminal et `--json` | Ses phrases sont retenues ; les numéros de ligne, identifiants, décomptes et scores sont affichés à la place, avec une ligne expliquant pourquoi |
| Fichiers qui en sont issus | Les découpages, copies nettoyées, hypothèses et journaux d'exécution conservent le texte (ils se trouvent dans les dossiers de la personne) et portent le marquage dans leur propre sidecar |
| Un modèle entraîné dessus | Sa sortie est également strictement locale (`forge-model.json` `trained_on.terms` ; non consigné compte comme strictement local) : `try_translation` ne renvoie que la page du modèle, `champollion connect`, `mt-eval serve` hors bouclage et `mt-eval translate` en dehors du projet nécessitent `--holders-agreed-by`, et `sync` retient ses réponses, aussi bien via la méthode `api` que `local` ([mise en service](/docs/agents/serving)) |
| Un fichier d'accompagnement ou dictionnaire | Un fichier d'accompagnement doté d'un sidecar applique sa politique à l'invite ; les sorties d'une exécution de lexique sont retenues lorsque son dictionnaire est strictement local |

**Remarque.** `--attest-local-transport` déclare le point de terminaison d'une méthode comme local. Ne le transmettez
que si vous avez vérifié que le point de terminaison se trouve bien sur cette machine : une adresse de
bouclage peut être un serveur mandataire qui transfère le trafic n'importe où.

## Entraînement

- **Verrou.** nmt-forge refuse de s'entraîner sur un fichier dont le sidecar indique
  `terms.training: not-allowed` ; un sidecar illisible est considéré comme une
  restriction, jamais comme une absence de restriction.
- **Verrou.** `champollion data combine` ne fusionne jamais un fichier non autorisé : il le déplace,
  avec son sidecar, vers `data/not-for-training/`. Il refuse tout fichier dont les
  détenteurs n'ont pas encore répondu — absence de `terms.training`, ou absence de
  `terms.speakers_agreed` (*« personne n'a encore indiqué si toutes les personnes dont les paroles y figurent
  ont donné leur accord — champollion interrogera les personnes ensuite ; effectuez la fusion après »*) —
  et le fichier combiné adopte les conditions les plus strictes des fichiers d'origine (strictement local si
  l'un d'eux l'est, non autorisé si l'un d'eux l'est, chaque propriétaire étant nommé).
- **Verrou.** L'étape des conditions du parcours ne considère un fichier situé dans `data/parallel/`,
  `data/lexicon/`, `data/grammar/` ou `data/monolingual/` comme ayant reçu une réponse que lorsque
  son sidecar comporte à la fois `terms.training` et `terms.speakers_agreed` (et que la
  réponse concernant l'entraînement émane des détenteurs, et non de la mise en garde de l'outil ci-dessous) ; jusque-là,
  il pose à nouveau la question et les rails ne vont pas plus loin.
- **Remarque.** nmt-forge lit `terms.training`, et non `speakers_agreed`. Avec un seul
  fichier de paires, il n'y a pas de fusion, de sorte que seule l'étape des conditions attend cette
  réponse : n'entraînez jamais un fichier dont la réponse des locuteurs est manquante.
- **Verrou.** Un fichier `test` ou `sealed` ne fait jamais l'objet d'un entraînement : `--training
  allowed` lui est refusé, et lui attribuer un autre rôle est également refusé.
- **Verrou.** `not-allowed` ne peut pas devenir `allowed` par commande (*« Si ses détenteurs
  donnent leur accord pour l'entraînement, modifiez le sidecar manuellement »*) — avec une exception ci-dessous.
- Les textes sacrés (USFM) sont intégrés avec `terms.training: not-allowed` marqué par
  précaution par l'outil (`"x-training-default": true`) ; la réponse des détenteurs s'y
  substitue.

## Paroles de qui, et qui a donné son accord

`--speakers` consigne les personnes dont le fichier contient les paroles ; `--speakers-agreed` indique si
elles ont donné leur accord.

| `speakers_agreed` | Effet |
|---|---|
| `yes` | Entraînement selon ce qu'ont indiqué les détenteurs |
| `not-yet` | L'entraînement est forcé à `not-allowed` jusqu'à ce qu'ils soient tous d'accord ; le fichier apparaît dans `waiting_for_agreement` |
| `some-said-no` | Aucun modèle ne peut apprendre de ce fichier, jamais : *« déplacez leurs paroles dans un autre fichier, et marquez le reste »* |
| (aucune réponse) | L'étape des conditions continue de poser la question, et `data combine` refuse le fichier (ci-dessus) |

**Le seul assouplissement qu'une commande permet :** `not-yet` → `yes` conjointement avec
`--training allowed`. Un fichier mis de côté par `combine` retourne ensuite dans
`data/parallel/` pour la fusion suivante.

**Remarque.** Ne posez la question `waiting_for_agreement` qu'une seule fois par session, avec délicatesse, et
n'y répondez que si la personne confirme que tout le monde a donné son accord.

**`--holders-agreed-by "<who>"`** désigne une personne parmi les détenteurs des données qui
a accepté qu'une sortie strictement locale soit dirigée vers un emplacement précis : dans les fichiers
de paramètres régionaux d'une application (`champollion connect`, consigné sous `holdersAgreed` pour la paire), sur
une adresse accessible par d'autres machines (`mt-eval serve`, `nmt-forge serve`, rapporté
sur `/health`), ou dans un fichier situé en dehors du projet (`mt-eval translate`,
consigné comme `holders_agreed` dans le sidecar). Cela n'assouplit rien d'autre : la
sortie demeure strictement locale pour chaque outil. **Remarque.** Ne transmettez que le nom fourni par
la personne.

## Ce que les outils affichent, et n'affichent jamais

| Outil | Affiche | N'affiche jamais |
|---|---|---|
| `champollion data add` | Les décomptes, les colonnes (lettre, taux de remplissage, longueur moyenne, proportion de lettres latines), une cellule d'en-tête uniquement si elle nomme l'une des langues de la paire, les niveaux ELAN par leur numéro, ainsi que les numéros de ligne relevés par la vérification des lignes | Une phrase ; toute autre cellule d'en-tête (sa longueur à la place) ; l'identifiant d'un niveau ELAN |
| `champollion data mark`, `combine`, `next`, `validate` | Champs, décomptes, états | Le texte d'un fichier de données — ils ne l'ouvrent jamais |
| `champollion improve …` | Décomptes et pourcentages | Les phrases des feuilles |
| `champollion sync` (les méthodes `local` et `api`) | Les clés dont le texte contient des mots qu'un modèle forge n'a jamais vus lors de l'entraînement, issus de `meta.unseen_words` du serveur | Le texte, ou les mots eux-mêmes |
| `nmt-forge`, `mt-eval` | Pour un corpus strictement local, scellé ou exigeant un consentement : identifiants, numéros de ligne, décomptes, scores ; `[sentence withheld]` dans les messages d'erreur | Ses phrases, sous forme de sortie humaine ou `--json` |
| Outils MCP rails | Ce que le CLI affiche, tronqué | Des phrases ; la sortie d'un modèle strictement local |

**Remarque.** `--show-text` (nmt-forge ; `mt-eval compare`) affiche les phrases
retenues. Cette commande est destinée à une personne devant son propre terminal, jamais à un agent —
ce que vous lisez est transmis au fournisseur de votre modèle.

**Remarque.** Aucun outil ne peut vous empêcher d'ouvrir un fichier. N'ouvrez, n'affichez,
ne résumez ni ne collez jamais les fichiers de données, phrases de test, listes de mots ou
feuilles appartenant aux communautés — ni le fichier `input-words.json` d'un export : il dresse la liste des mots de leurs
phrases d'entraînement et reste à côté du dossier du modèle, jamais à l'intérieur
([mise en service](/docs/agents/serving#what-an-export-holds)).

**La vérification des lignes.** Lorsqu'il importe un fichier (paires, ensemble de test ou liste de mots),
`data add` vérifie ses lignes par rapport aux deux colonnes du fichier lui-même — sans
dictionnaire, sans rien retirer. Il dénombre et identifie par leur numéro de ligne :

- les copies : la traduction est identique à la phrase source (un nom propre ou un emprunt
  est tout à fait recevable ; sinon la traduction est manquante) ;
- les répétitions d'une paire antérieure ;
- les traductions nettement plus longues ou plus courtes que le ratio habituel du fichier (tronquées,
  ou deux phrases dans une même cellule) ;
- les lignes qui semblent inversées : la source ressemble aux traductions du fichier, et
  inversement ;
- les séries de lignes présentant un décalage d'une ligne : leurs traductions correspondent mieux à la ligne suivante
  ou précédente — les nombres, points d'interrogation et longueurs s'alignent avec un décalage
  d'une ligne, de même que les mots : la concordance des mots sources d'une ligne avec ceux
  d'une traduction, évaluée d'après leur fréquence de cooccurrence dans le
  reste du même fichier (les mots plus rares pèsent davantage ; la ligne elle-même étant exclue).
  Cela permet de déceler un décalage dans un fichier de phrases types, dont les longueurs se ressemblent
  toutes ; cela n'apporte rien si les mots du fichier sont trop peu distinctifs.

Il affiche jusqu'à 12 numéros de ligne par type (jusqu'à 6 séries pour les lignes décalées d'une ligne) — pour un
tableur, la ligne dans le fichier propre de la personne, en-tête inclus — et consigne
les décomptes dans `x-import.quality` du sidecar. Les vérifications de longueur, d'inversion et de décalage
nécessitent au moins 20 paires ; une liste de mots (`--into lexicon`) ne fait l'objet que des vérifications de copies et
de répétitions. **Remarque.** Transmettez les numéros de ligne : les personnes examinent ces lignes dans
leur propre fichier et prennent leur décision. N'ouvrez jamais le fichier pour regarder vous-même.

**Fichiers ELAN.** Lorsque `data add` ne parvient pas à déterminer quel niveau correspond à quel côté (un côté
désigné par aucun indicateur, sans qu'un seul et unique niveau ne soit enregistré dans sa langue), il refuse
et énumère les niveaux par numéro, dans l'ordre du fichier : `tier <n> (<language or
"no language">, <count> annotation(s))`, with `, under tier <m>` pour un niveau
qui fait référence à un autre. Transmettez les numéros sous la forme `--source-col` et `--target-col`
(`champollion data add <file> --source-col <number> --target-col <number>`) ;
le sidecar consigne ces numéros (`x-import.elan_tiers`). Un numéro ou identifiant qui
ne correspond à aucun niveau est refusé (`no such tier — … Name a tier by its number`), tout
comme un niveau dont la langue enregistrée n'est pas celle de ce côté. Deux niveaux ne sont associés
que si l'un renvoie à l'autre ou s'ils partagent des créneaux temporels — jamais par
simple déduction. **Remarque.** L'identifiant d'un niveau correspond à ce qu'a saisi l'auteur du fichier et s'avère
souvent être le nom d'une personne, de sorte que `data add` ne l'affiche jamais. La personne peut saisir
elle-même un identifiant exact ; vous devez transmettre le numéro.
Les fichiers LIFT sont mis en correspondance d'après leurs codes de langue, et les fichiers Toolbox d'après leurs marqueurs
MDF (`\ge` et `\xe` correspondent à l'anglais selon la norme).

## Modes de transmission

Chaque évaluation résout son corpus vers un mode unique avant tout envoi
(`arena/mt_eval_harness/transmission_policy.py`), et le consigne dans le journal
d'exécution :

| Mode | Quand | Modèles distants |
|---|---|---|
| `cleared` | Une licence autorisant la redistribution | Autorisé |
| `no-train` | Une licence standard Creative Commons non commerciale ou sans modification ; ou un corpus non enregistré qui ne déclare aucune licence | Uniquement sur des canaux qui ne s'entraînent pas sur les entrées : OpenRouter verrouillé sur `data_collection: deny`, API de fournisseurs directs, ou localement. Une garantie de non-entraînement, et non de non-rétention |
| `consent-required` | Une licence modifiée, sur mesure ou non précisée (`LicenseRef-*`) | Refusé jusqu'à ce que l'entrée du jeu de données consigne une autorisation `transmission_consent` (`granted_by`, `date`, `scope`, `evidence`) ; l'utilisation locale fonctionne toujours |
| `sealed` | Un segment tenu à l'écart ou de référence (gold standard), un jeu mis en quarantaine, ou un marquage strictement local d'un intendant | Refusé, sans dérogation possible |

- **Verrou.** Le texte d'un corpus `consent-required` ou `sealed` est également retenu
  au niveau du terminal.
- Une méthode externe (un greffon) sur un corpus `no-train` fait l'objet d'un avertissement sans être
  refusée : le banc d'essai ne peut pas inspecter le canal du greffon. Sur les corpus `consent-required`
  et `sealed`, elle est refusée sauf si `--attest-local-transport`.
- **Verrou.** Le fournisseur local n'est considéré comme local que si son point de terminaison est une
  adresse de bouclage (`localhost`, `127.0.0.1`, `::1`, un socket Unix) — jamais
  en raison de son nom.
- **Remarque.** N'enregistrez jamais d'autorisation `transmission_consent` et n'interprétez jamais une
  licence pour le compte du titulaire des droits. Une autorisation est consignée par l'intendant
  du jeu de données une fois accordée par le titulaire des droits.
- **Remarque.** `--allow-data-collection` ne lève le verrouillage de non-entraînement que pour un
  corpus non enregistré qui ne déclare aucune licence ; cela affirme que l'appelant détient
  les droits. Ne le transmettez que si la personne déclare expressément les détenir.

## Niveaux d'enregistrement

L'enregistrement d'un corpus est facultatif : les rails n'en ont jamais besoin. Il génère une
fiche de métadonnées permettant de nommer le corpus, de le comparer et, si ses détenteurs le souhaitent,
de le répertorier. `champollion network register-corpus` est interactif dans un terminal
et scriptable au moyen d'indicateurs (`--tier`, `--data`, `--license`, `--name`, …).
**Remarque.** Le niveau, comme chaque condition, relève de la décision des détenteurs.

| Niveau | La fiche | Le texte | Ce qu'il refuse |
|---|---|---|---|
| `local-only` (par défaut) | Écrite à côté du fichier `--data` (ou `--out`, ou ici), jamais dans le dossier partagé des fiches | Ne quitte jamais cet ordinateur ; le sidecar reçoit `transmission: local-only` | — |
| `private` | Métadonnées avec `quarantine: true` ; depuis une installation npm, elle reste locale, et son référencement fait l'objet d'une requête distincte (`champollion network submit --type dataset`) | Jamais téléversé ; aucun marquage de transmission — sa licence détermine le mode | — |
| `public` | Métadonnées assorties d'un pointeur de récupération depuis la source (`--repo-url`, `--builder`) | Jamais hébergé : récupéré depuis sa source | Une licence non commerciale, sans modification, restreinte ou non confirmée (*« Enregistrez plutôt à titre privé ou strictement local. »*) ; `--data` |
| `sealed` | Métadonnées avec `quarantine: true` et un bloc scellé (`--seal-input`, `--threshold-pubkey`, `--custodian-group`, `--qualifier-id`) | Seul le texte chiffré existe, écrit dans `<id>.sealed.json` ou `--seal-out` | Un fichier constituant une copie à l'octet près d'un corpus public ; `--data` |

Dans chaque niveau, rien n'est téléversé lors de l'enregistrement (`--json` indique
`uploadedContent: false`). L'unique appel réseau, depuis une installation npm, compare
le sha256 du fichier avec celui du catalogue public sur cet ordinateur (le hachage ne quitte
jamais la machine) ; avec `CHAMPOLLION_OFFLINE=1`, la fiche indique que la comparaison n'a pas
été effectuée. Avec `--data`, le sidecar consigne `id`, `name`, `license`, `tier`,
`sha256`, `rows`, `card` et `registeredAt`. **Verrou.** Un identifiant enregistré n'est
jamais dérivé à nouveau : réenregistrer le fichier sous un autre identifiant est refusé, et
un fichier modifié (autre sha256) ne reçoit plus l'identifiant ni la note de la fiche.

## Les sorties sont des œuvres dérivées

La sortie d'un modèle produite à partir de phrases restreintes constitue une œuvre dérivée de celles-ci, et une
évaluation génère de telles sorties à grande échelle. Les outils traitent les sorties de la même manière
qu'ils traitent leurs entrées :

- Pour tout corpus qui n'est pas `cleared`, l'exécution consigne et affiche un avis :
  ses prédictions sont des dérivés automatiques de phrases restreintes, qui ne doivent pas être
  distribués.
- Lorsque le texte est retenu (strictement local, scellé, consentement requis), chaque
  fichier produit à partir de celui-ci — journaux d'exécution, rapports, comparaisons, entrées de cache,
  sortie `mt-eval translate`, côtés découpés par forge, corpus nettoyés et
  hypothèses — reçoit un sidecar set/1 portant le marquage (`derived_from`,
  `written_by`). Un corpus `no-train` reçoit l'avis mais aucun sidecar.
- Un modèle entraîné sur du texte strictement local produit des sorties strictement locales (ci-dessus).
- `mt-eval publish` ne téléverse jamais les phrases d'un corpus strictement local, même avec
  `--publish-entries`, et ne publie par défaut une invite accompagnée que sous forme de hachage
  pour un tel corpus. Pour les autres corpus, l'invite est publiée sauf si
  `--redact-coaching`.

**Remarque.** La publication relève de la décision des personnes, exprimée selon leurs propres termes, après leur
avoir d'abord présenté l'aperçu (`--dry-run`). Ne publiez, ne collez et n'envoyez jamais les sorties
d'une exécution pour leur compte.

## Pour aller plus loin

- [Le contrat de fonctionnement](/docs/agents/contract) §1 et §3.
- [Vos paroles, vos règles](/docs/your-words-your-rules) — la version destinée aux communautés.
- [Enregistrer des corpus](/docs/network/sovereignty/registering-corpora) — les
  niveaux, avec chaque indicateur.
- [Mise en service et déploiement](/docs/agents/serving) — les sorties strictement locales
  en pratique.
- [La souveraineté des données, en mots simples](/docs/learn/data-sovereignty).
