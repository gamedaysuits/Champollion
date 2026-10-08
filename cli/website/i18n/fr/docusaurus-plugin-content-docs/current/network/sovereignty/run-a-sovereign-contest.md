---
sidebar_position: 9
title: "Organiser un concours souverain"
slug: /network/sovereignty/run-a-sovereign-contest
description: "Le parcours autonome et de bout en bout permettant à une communauté ou une organisation d'organiser un concours de traduction automatique sur son propre corpus confidentiel et réservé — sans que Champollion ne détienne jamais les données ni les fonds du prix."
related:
  - label: "Registering Corpora & Exposure Lanes"
    to: /docs/network/sovereignty/registering-corpora
    kind: doc
    note: "The registration lane this path builds on"
  - label: "Data Stewardship"
    to: /docs/network/sovereignty/data-sovereignty
    kind: doc
  - label: "Terms Templates"
    to: /docs/network/sovereignty/terms-templates
    kind: doc
    note: "Adaptable terms ideas, including trojan-horse risks"
  - label: "Prize Specification"
    to: /docs/network/specifications/prizes
    kind: spec
---

# Organiser un concours souverain

> **Résumé exécutif.** Une communauté ou une organisation peut organiser un concours d'évaluation — incluant un prix parrainé — contre un corpus de test retenu qui **ne quitte jamais sa propre infrastructure**. Vous construisez le corpus, le chiffrez, l'hébergez et conservez les clés ; le Réseau n'enregistre qu'une fiche de métadonnées sans contenu et un résumé de texte chiffré. Les méthodes se qualifient d'abord sur des corpus publics ; chaque exécution contre votre ensemble scellé nécessite l'autorisation de vos dépositaires ; seuls les **scores** sortent. Les fonds de prix sont **détenus par le parrain** — par votre organisation ou une fiducie que vous désignez — et **Champollion ne touche jamais l'argent ni les données.** Cette page est le guide complet d'exécution en libre-service.

:::warning[Ce qui est en production aujourd'hui par rapport à ce qui est en développement]
Soyez lucide avant de commencer — il s'agit d'un projet de recherche évolutif et non commercial, et nous préférerions que vous nous vérifiez plutôt que de nous faire confiance :

- ✅ **Opérationnel :** l'enregistrement du corpus (fiches de métadonnées, épinglage par hachage,
  voies d'exposition), le registre des jeux scellés (empreinte + groupe de dépositaires + qualificatif, aucun
  contenu), le mécanisme de concours avec la voie scellée, la couche de données de demande/octroi/audit d'autorisation
  (en attente → décision M-de-N → octroi à usage unique et limité dans le temps,
  journal d'audit en ajout seul avec chaîne de hachage), et l'émission des scores seuls
  imposée au niveau de la base de données.
- ✅ **Opérationnel : le nœud d'évaluation de l'organisateur.** Une seule commande fractionne votre corpus
  en un jeu de dev public (le qualificatif sur lequel les participants s'auto-évaluent) et un jeu secret
  scellé sur lequel votre nœud exécute les soumissions, puis scelle la moitié secrète au
  repos sur VOTRE machine (`mt-eval contest prepare`). L'enregistrement du ou des jeux
  scellés, du qualificatif et du concours se fait **en libre-service depuis votre propre connexion** —
  `contest prepare --self-serve`, ou `mt-eval contest register --manifest`
  pour un concours préparé antérieurement — chaque ligne étant liée à une identité au
  niveau de la base de données ; aucun curateur dans la boucle et aucune clé privilégiée (voir l'Étape 4
  pour les limites réelles).
- ✅ **Opérationnel : les soumissions sont des MÉTHODES, pas des traductions.** On participe à un concours
  en fournissant à votre nœud quelque chose qu'il peut EXÉCUTER. Un participant s'auto-évalue sur le jeu de
  dev public (`mt-eval contest qualify`) pour obtenir un reçu, puis soumet un modèle
  ou une méthode ; votre nœud réexécute le score de ce reçu sur sa propre copie du
  jeu de dev avant qu'aucun dépositaire ne soit sollicité pour approuver quoi que ce soit, et refuse
  en cas de non-concordance. Le nœud choisit la voie en fonction de la soumission :
  - **Voie A — modèle déclaratif (privilégiée).** Un modèle neuronal standard est une
    DONNÉE : `mt-eval contest submit-model` envoie les poids safetensors + un
    tokeniseur déclaratif + une configuration — **aucun code, aucun Dockerfile.** Votre nœud
    valide l'absence totale de code (safetensors et non pickle ; aucun
    `trust_remote_code`/`auto_map` ; fichiers de données uniquement) et exécute les poids dans son
    PROPRE moteur de confiance (`transformers`, `trust_remote_code=False`, hors ligne).
    L'architecture est permissive par défaut (toute architecture chargée nativement par votre moteur) ; un
    hôte prudent peut imposer une liste blanche. Rien d'inconnu n'étant exécuté, il n'y
    a rien à isoler en bac à sable. Publication `declarative-model`, identité de la méthode
    **sans code par construction**.
  - **Voie B — paquet exécutable (solution de secours en bac à sable).** Pour les méthodes qui SONT du code :
    `mt-eval contest submit-method` envoie un Dockerfile + un point d'entrée. Une fois votre
    dépositaire ayant validé, VOTRE nœud l'exécute au sein d'un conteneur isolé du
    réseau (`--network=none` — la pile réseau n'existe pas à l'intérieur ;
    racine en lecture seule, privilèges révoqués, environnement nettoyé), avec
    des contrôles statiques automatisés préalables et des références qui ne pénètrent jamais dans le conteneur.
    Publication `method-execution` avec identité **vérifiée à l'exécution**.
  Dans les deux voies : le hachage du paquet est figé dans la demande d'autorisation (ce qui
  s'exécute correspond de manière vérifiable à ce qui a été proposé), et les scores sont publiés par le même
  canal d'agrégats seuls. Pour une isolation maximale, la machine d'évaluation peut être un véritable
  système hermétique (airgap) : les requêtes autorisées et les paquets de scores seuls signés avec Ed25519 transitent par
  support amovible (`mt-eval node relay` / `import-bundle` / `export-scores`) —
  le texte secret n'atteint même jamais la machine connectée. Ce que ces voies n'incluent
  PAS encore : l'attestation matérielle du nœud (l'identité est auto-déclarée),
  un mécanisme formel de contestation, et — pour la Voie B spécifiquement — un renforcement
  plus poussé du conteneur au-delà de la suppression de la pile réseau (profils seccomp, microVM ; c'est
  une raison de préférer la Voie A). Voir les
  [Limites réelles](/docs/network/honest-limitations).
- ✅ **La couche d'engagements est active (2026-09-07).** Les déclarations d'inscription
  (principale/contrastive, pistes), les phases de soumission, les résultats retenus
  (`hidden_until_close`), et le gel rendant vos engagements déclarés
  inmodifiables dès qu'il existe des soumissions sont appliqués en base de données sur
  le point de terminaison hébergé sur le réseau. Un hôte fédéré bénéficie des mêmes règles en appliquant la
  migration fournie avec le banc d'évaluation ; face à un point de terminaison plus ancien, le banc d'évaluation
  se replie sur le jeu de base et l'indique explicitement (`declarations_available: false`)
  au lieu de feindre la compatibilité. Lorsqu'une étape ci-dessous indique que *la base de données gèle /
  retient*, cela s'applique au sens strict.
- 🔲 **En développement : signature à seuil.** Pour un jeu scellé avec
  `champollion seal-corpus`, l'approbation de dépositaires M-de-N est *consignée* dans
  les tables d'autorisation et d'audit, et la clé de scellement est un substitut sous la forme d'une
  paire de clés unique étiquetée (`champollion seal-corpus keygen`). Un jeu scellé sur
  le nœud hors ligne (`mt-eval node seal`) utilise la **cérémonie de clés**
  intégrée du nœud (`mt-eval node ceremony`) : la clé du jeu est fractionnée en M-de-N et
  réassemblée uniquement en mémoire lors d'une exécution autorisée par quorum. Cette cérémonie
  n'a encore jamais été employée avec un dépositaire réel, et ses parts sont de simples fichiers
  dans la v1. Aucune des deux voies ne dispose de la *signature* à seuil : la signature du
  paquet de scores hermétique repose sur une clé de nœud unique (`seal-corpus sign-keygen`).
- ❌ **Exclu par conception :** le fait que Champollion héberge votre corpus, détienne vos
  clés ou conserve les fonds de prix. Le paquet d'un participant (son propre modèle ou code)
  transite par notre stockage en route vers votre nœud ; le contenu de votre corpus n'y transite jamais.
- ❌ **Supprimé plutôt que laissé comme un piège.** `contest submit-hypotheses` (retiré le 2026-09-06) téléversait
  des traductions d'un jeu aveugle à source publique ; `contest submit` (retiré le 2026-09-06) liait un score
  que vous aviez vous-même publié. Aucun des deux
  ne constitue plus une voie de soumission à un concours. Une session aveugle à source publique ne subsiste
  qu'en tant que diagnostic facultatif pour l'organisateur, et les scores auto-déclarés restent à leur place
  sur le classement public — qui est un tableau public indexé par corpus et direction
  de paire, et non un concours.

Si une étape ci-dessous dépend de quelque chose dans la liste 🔲, l'étape le dit.
:::

---

## La forme de l'accord

| Qui | Détient | Ne détient jamais |
|-----|---------|-------------------|
| **Vous (communauté/org)** | Le corpus, les clés de chiffrement (via vos dépositaires), les fonds de prix, la décision d'attribution | — |
| **Champollion / le Réseau** | Une fiche de métadonnées, un résumé de texte chiffré, l'enregistrement d'autorisation + audit, les scores publiés | Le contenu de votre corpus, vos clés, votre argent |
| **Développeurs de méthodes** | Leur méthode | Vos données de test — ils voient les scores, jamais les phrases |

Tout ce qui suit est l'expansion mécanique de ce tableau.

---

## Prérequis pour l'organisateur

Avant l'étape 1, comprenez ce que l'exécution du côté nœud exige réellement :

- **Le banc d'évaluation avec son extension node :**
  `python3 -m pip install 'mt-eval-harness[node]'` (0.2.0 ou ultérieur ; utilisez
  `python3 -m pip`, qui fonctionne dans n'importe quel environnement où tourne le banc d'évaluation —
  une commande `pip` brute n'est pas présente dans le `PATH` de tous les environnements virtuels). L'extension `[node]`
  ajoute la bibliothèque `cryptography` qu'utilisent `mt-eval node keygen`, la cérémonie
  des dépositaires et la signature des manifestes de scores. Un simple
  `python3 -m pip install mt-eval-harness` en est dépourvu, et ces commandes s'interrompent en indiquant
  cette installation.
- **docker ou podman** — requis pour la voie d'exécution de méthode. Le nœud
  détecte automatiquement docker, puis podman (`sandbox.runtime` dans `node.json` vaut `null`
  par défaut ; indiquez-en un explicitement à cet endroit pour l'imposer). Si aucun des deux ne figure dans le `PATH`,
  `mt-eval node run-method` refuse avec un message d'une ligne mentionnant les deux, avant toute
  exécution, et la requête est laissée en l'état afin que vous puissiez la relancer une fois
  un moteur d'exécution installé. Il n'y a **aucun repli possible**. L'isolation par conteneur avec
  `--network=none` est la garantie fondamentale ; rien ne s'exécute donc sans
  moteur de conteneurs.
- **Node.js 20.11+ et le CLI npm `champollion`** — le banc d'évaluation ne
  réimplémente pas le chiffrement de scellement. `champollion seal-corpus` (verbes : `keygen`,
  `seal`, `open`, `sign-keygen`, `sign`, `verify`) est l'unique implémentation
  de chiffrement (X25519-ECDH → HKDF-SHA256 → AES-256-GCM), et le nœud de l'organisateur
  fait appel à celle-ci via le shell.
- **Une configuration de nœud à l'emplacement `~/.mt-eval/node.json`.** Chaque commande `mt-eval node`
  refuse de démarrer sans celle-ci. `mt-eval node init` y génère une configuration
  de départ (`--print` l'affiche au lieu de l'écrire). Elle contient votre `node_id` auto-déclaré
  (intégré dans l'empreinte de chaque requête) et une table `contests` pointant vers votre
  jeu de dev, votre jeu scellé (`secret_set_id` + `secret_artifact`), votre réserve
  scellée si vous en avez préparé une (`holdout_set_id` + `holdout_corpus` ; supprimez
  les deux clés si ce n'est pas le cas) et le filtre qualificatif public (`qualifier` +
  `dev_corpus`, le seuil sur l'échelle qualificative de 0 à 100). Dès que vous avez exécuté
  `contest prepare` (Étape 1), `mt-eval node init --from-contest ./mytask`
  écrit la configuration initiale avec les valeurs du concours déjà renseignées depuis
  `./mytask/local/manifest.json`, et liste ce qu'il vous reste à remplir. La correspondance
  qu'il applique (à renseigner manuellement si vous préférez) :

  | `local/manifest.json` | `node.json` (sous `contests.<contest-id>`) |
  |---|---|
  | `contest.language_pair` | `language_pair` |
  | `secret.sealed_set_id` | `secret_set_id` |
  | `secret.corpus_sealed_artifact` | `secret_artifact` |
  | `holdout.sealed_set_id` / `holdout.corpus_sealed_artifact` | `holdout_set_id` / `holdout_corpus` (tous deux retirés en l'absence de réserve) |
  | `qualifier.corpus_file` | `dev_corpus` |
  | `qualifier.qualifier_id`, `corpus_card_id`, `threshold`, `metric`, `year` | `qualifier.*` (mêmes noms) |
  | `test_suites[].suite_id` / `sha256`, `test_suite_local_copies` | `test_suites[].suite_id` / `corpus_sha256` / `corpus_path` : la copie lue par `contest prepare` (`--test-suite <id>=<path>`, ou celle qu'il a trouvée), lorsqu'elle est présente sur cette machine avec les octets épinglés ; sinon vous définissez `corpus_path` |
  | `secret.sealed_block.keyScheme` | `custody` : `single-key` pour un jeu scellé avec une seule paire de clés (définissez ensuite `secret_privkey`), `threshold-quorum` pour une cérémonie |
  | `registration.prize_terms` (enregistré par `contest prepare` et `contest register`) | `prize_terms_sha256` : le SHA-256 des conditions, le hachage que les participants transmettent à `--accept-terms` (omis lorsque le concours ne déclare aucun prix) |

  L'identifiant du concours est le `--slug` que vous avez transmis à `contest prepare` (`mytask` dans
  l'exemple ci-dessous). La commande prepare l'enregistre dans le manifeste, l'enregistrement crée
  le concours sous cet identifiant, et c'est l'identifiant que les participants fournissent à `contest qualify`
  et `submit-method` ; publiez-le donc avec la version de dev ; `--contest-id`
  permet de le remplacer. (Un manifeste rédigé avant que l'identifiant ne soit consigné conserve l'identifiant
  d'enregistrement dérivé de son nom, `"My Task 2026"` → `my-task-2026`,
  car c'est ce qu'utilisent déjà son concours, ses reçus et les configurations de ses nœuds.) Aucun
  manifeste ne connaît `node_id`, `cards_dir`, `signing_key` ni votre fichier de clé privée,
  ces éléments restent donc sous la forme `<...>` afin que vous les renseigniez.
  `mt-eval node ledger verify` effectue ensuite la vérification et affiche ce qu'il a contrôlé : il
  charge la configuration (garde, ensemble du filtre qualificatif, paire de réserve,
  index local des fiches), rejette la première valeur restant un espace réservé `<...>`
  ou un fichier déclaré absent de cette machine, affiche les jeux et fichiers de chaque
  concours, et alors seulement rejoue la chaîne de hachage du registre d'autorisations
  (zéro entrée sur un nouveau nœud).
- **Un index local des fiches de langue embarqué par le nœud.** L'évaluation mentionne la
  paire de langues de l'exécution, et le nœud ne consulte jamais de langue sur le réseau.
  Faites pointer `cards_dir` dans `node.json` vers un répertoire contenant une fiche pour chaque
  langue évaluée par votre nœud (ou définissez `MT_EVAL_CARDS_DIR`) ; un nœud dépourvu d'index
  local refusera de démarrer au lieu d'en télécharger un. Aucun des paquets installés
  ne fournit de répertoire de fiches par langue ; générez-en un sur une machine connectée
  à l'aide du CLI `champollion`, à raison d'un fichier `<code>.json` par langue de
  votre paire :

  ```bash
  mkdir -p node-cards
  champollion network card eng --json > node-cards/eng.json
  champollion network card crk --json > node-cards/crk.json
  ```

  Définissez ensuite `"cards_dir"` avec le chemin absolu de ce répertoire. Pour un
  nœud isolé (airgap), intégrez-le dans le paquet hors ligne
  (`mt-eval node bundle --out <dir> --include node-cards`) ; il est placé à l'emplacement
  `<dir>/artifacts/node-cards`, et `cards_dir` y pointe sur le nœud.
- **Une connexion.** Il n'y a pas d'étape distincte de création de compte : la première commande
  nécessitant une identité (par ex. `mt-eval contest prepare --self-serve` ou
  `mt-eval publish`) ouvre une authentification OAuth dans le navigateur via **GitHub ou Google**
  (Supabase Auth). L'adresse e-mail de ce compte constitue l'identité à laquelle chaque ligne du registre
  est liée — utilisez-en une contrôlée par votre organisation.
- **La régulation des entrées.** Les soumissions des participants sont limitées par défaut à
  **5 par tranche de 24 heures par participant** (protection anti-sondage ; paramétrable par concours
  avec `--intake-daily-limit` lors de la préparation, ou comme valeur par défaut
  d'une édition de tâche partagée). Planifiez le calendrier de votre concours en conséquence.

**Une réserve importante concernant l'enregistrement en libre-service.** Sur le **point de terminaison
par défaut hébergé sur le réseau**, l'enregistrement en libre-service (`contest prepare
--self-serve` / `contest register`) s'interrompt actuellement devant une protection du point
de terminaison de production : le CLI refuse d'écrire sur le projet de production en affichant un
message explicite, dans l'attente d'une décision de politique d'ouverture de cet accès. Les hôtes
fédérés (votre propre projet Supabase) ne sont pas concernés. Si vous rencontrez ce verrouillage
sur l'hôte par défaut, il s'agit de l'état actuel du système et non d'une mauvaise configuration
de votre part — [ouvrez un ticket](https://github.com/gamedaysuits/Champollion/issues)
et nous vous guiderons pas à pas pour finaliser l'enregistrement.

---

## Étape 1 — Construire votre corpus de test retenu

Concevez le corpus que vous mesurerez et gardez-le retenu dès le départ : rien dedans ne devrait jamais avoir été publié, posté ou partagé avec un fournisseur de modèle.

- Suivez le [Cadre de conception de corpus](/docs/network/specifications/corpus-design) pour la structure des entrées, les niveaux de difficulté et la couverture des registres, et le [Livre de recettes de création de corpus](/docs/network/tutorials/corpus-creation) pour l'outillage.
- Faites vérifier les entrées par des locuteurs courants avant le scellement — le [Protocole de validation des locuteurs](/docs/network/specifications/speaker-validation) décrit une structure d'examen que vous pouvez réutiliser pour l'assurance qualité du corpus, pas seulement l'examen de méthode.
- Décidez maintenant de l'étiquette de **version** du corpus (par exemple `v1`). Les octrois d'autorisation sont liés à une version spécifique, donc le versioning fait partie du modèle de sécurité, pas de la tenue de registres.

### Comment le corpus est fractionné

Une seule commande prend votre corpus principal et génère chaque palier, de manière déterministe
à partir d'une graine que vous choisissez et consignez :

```bash
mt-eval contest prepare --corpus master.json --slug mytask --name "My Task 2026" \
    --pair 'eng>crk' --seed 20260906 --qualifier-threshold 35 \
    --dev-size 400 --secret-size 500 --sealed-holdout-size 250 \
    --test-suite <a public corpus card id> \
    --license <the licence the rights-holder grants> \
    --custodian-group <opaque id> --threshold-pubkey ./contest.pub.json \
    --out ./mytask
```

`--qualifier-threshold` représente le score qu'une méthode doit atteindre sur le jeu de dev public
avant que votre nœud ne l'exécute sur le jeu scellé et la réserve scellée. Il s'exprime
sur **l'échelle qualificative de 0 à 100** : le score qualificatif est le **chrF++ du corpus**
(sacreBLEU chrF, `word_order=2`) des sorties de dev par rapport aux références de dev publiées —
la métrique de référence du standard d'évaluation, et la même valeur qu'une fiche `mt-eval run`
affiche en tête pour ces mêmes sorties. Rien d'autre n'y est agrégé ; la correspondance exacte est affichée
à titre indicatif à côté et ne sert jamais de filtre. Votre nœud calcule la même valeur
lorsqu'il réexécute une méthode, de sorte que le reçu d'un participant et la mesure de votre nœud
sont directement comparables.

Définissez le seuil à partir des scores chrF++ que vous avez mesurés sur ce jeu de dev (exécutez
`contest qualify` sur les sorties de dev d'une référence de base), et non à partir de scores issus
d'autres jeux d'évaluation : les niveaux de chrF++ varient considérablement selon les langues et les corpus.
Un qualificatif enregistré avant le
[standard d'évaluation](/docs/network/specifications/scoring#how-runs-are-scored)
avec l'ancienne métrique composite retirée fonctionne toujours : son seuil est interprété
sur l'échelle chrF++, ce que la commande qualify rappelle à chaque fois ; confirmez la valeur ou
passez à un nouveau qualificatif.

`--license` est obligatoire. Elle indique la licence sous laquelle le jeu de dev publié
est proposé, et mt-eval n'en choisit jamais à votre place. Le fichier publié la comporte sous la forme
`dataset.license`, qui est lue par `mt-eval run`, `contest qualify` et
`publish` ; les exécutions d'un participant sont donc régies par votre licence. Utilisez l'octroi
propre du détenteur des droits sous forme d'identifiant SPDX. Avec `CC-BY-4.0`, les participants peuvent évaluer
avec n'importe quel service de modèle.
Avec une licence non commerciale telle que `CC-BY-NC-4.0`, les modèles distants ne s'exécutent
que sur des canaux sans entraînement. Avec vos propres conditions (`LicenseRef-<name>`), l'évaluation
distante est refusée tant que l'autorisation du détenteur des droits n'est pas consignée, imposant aux
participants l'usage de modèles locaux.

Les fichiers publiés indiquent également les autres conditions du corpus principal, lues depuis
sa propre fiche (la fiche de corpus générée par `champollion network register-corpus`,
via son fichier auxiliaire `<file>.champollion.json`) et son propre conteneur :
`dataset.do_not_train` et, lorsque le fichier principal est marqué pour usage local uniquement,
`dataset.transmission: "local-only"` (les participants ne peuvent alors exécuter le jeu de dev
qu'avec un modèle présent sur leur propre machine), avec `dataset.terms_from` indiquant
l'origine de chaque condition. Lorsque la fiche du corpus principal ne précise aucune condition d'entraînement,
transmettez `--do-not-train true` ou `false` ; cette option peut restreindre la condition du corpus
principal, mais jamais l'assouplir (`--do-not-train false` sur un corpus principal `doNotTrain: true` est
refusé). prepare affiche ces conditions et émet un avertissement lorsque la fiche du corpus principal indique
que la redistribution est interdite : la publication de `public/` constituant une redistribution,
ne le diffusez pas sans l'accord du détenteur des droits.

| Fractionnement | Qui le voit | Son rôle |
|-------|-------------|----------------|
| **Jeu de dev public** (`--dev-size`) | tout le monde — la source *et* les références sont publiées | le **qualificatif** : les participants s'y auto-évaluent avant toute possibilité de soumettre (Étape 8) |
| **Jeu scellé** (`--secret-size`) | personne en dehors de votre nœud — la source *et* les références restent chiffrées | ce sur quoi une soumission est réellement évaluée |
| **Réserve scellée** (`--sealed-holdout-size`, optionnel) | personne en dehors de votre nœud | un **second** sous-ensemble scellé, évalué lors de la même session, dont les scores sont retenus jusqu'à la clôture du concours |
| *Jeu aveugle* (`--blind-size`, par défaut 0) | source publiée, références retenues | une phase de diagnostic optionnelle pour votre propre usage. Ce n'est **pas** une voie de participation : on entre dans un concours en fournissant une méthode, jamais en téléversant des traductions |

Les sous-ensembles sont disjoints et reproductibles : même corpus, même graine, même fractionnement,
indéfiniment. La formule reste dans un manifeste local à l'organisateur qui ne quitte jamais
votre machine.

**Les phrases répétées restent d'un seul côté.** Le fractionnement est disjoint par groupe
(`group-disjoint/1`, consigné dans le bloc `split` du manifeste) : les lignes qui partagent
une source ou une référence, exactement ou après normalisation de la casse, de la ponctuation et
des espaces, constituent un groupe unique, et ce groupe est placé d'un seul tenant dans une même fraction.
Aucune ligne scellée ne répète donc une ligne du jeu de dev publié. Les groupes sont mélangés selon votre
graine et attribués dans l'ordre : dev, aveugle, secret, réserve ; un fichier maître sans aucune
phrase répétée obtient exactement le même résultat qu'un mélange ligne par ligne. Si des groupes entiers
ne permettent pas d'atteindre les tailles demandées, prepare refuse l'opération en indiquant le nombre
de lignes répétées et la solution : supprimer les doublons (conserver une ligne de chaque groupe),
ou demander une taille totale inférieure à celle du corpus principal afin d'écarter certains groupes.

**`public/` peut être publié ; les journaux d'exécution vont dans `runs/`.** prepare écrit un fichier
marqueur, `.champollion-releasable.json`, dans `public/`. Les journaux d'exécution, les rapports et
les caches de traduction n'y sont jamais stockés : `mt-eval run` refuse la présence d'un
`--output-dir` ou `--cache-dir` à cet endroit et renvoie vers le `runs/` situé à côté
(`<out>/runs/`) à la place, et le `run_benchmark` du serveur MCP consigne automatiquement
une exécution sur le jeu de dev publié (la référence de base lancée pour établir le seuil) dans `runs/`
en le signalant. Un concours préparé avant l'existence de ce marqueur est
reconnu par sa structure (`public/` à côté de `local/manifest.json`).

**Pourquoi une réserve.** Un unique jeu scellé peut toujours faire l'objet d'un ajustement excessif
au cours d'un concours prolongé — chaque soumission est une sonde, et un nombre suffisant de sondes finit par créer une fuite. Une seconde
fraction évaluée au cours de la même session autorisée, mais dont personne ne voit les scores
avant la clôture, offre une mesure neutre à la fin : si le classement d'un système varie entre
les deux, vous comprenez mieux la part relative à l'optimisation par rapport à la qualité réelle de traduction.
Les deux jeux sont couverts par **une seule** autorisation, ce qui n'impose aucune cérémonie
supplémentaire à vos dépositaires.

**Suites de tests tierces.** `--test-suite` désigne un corpus de diagnostic public —
appartenant à un tiers, épinglé par sha et téléchargeable publiquement — sur lequel chaque soumission
est également testée. Ces résultats sont **rapportés à titre indicatif et ne font jamais l'objet d'un classement** :
ils permettent à quiconque de vérifier si un bon score sur le jeu scellé se confirme
sur un jeu non conçu par votre concours. Champollion rejette toute suite en quarantaine,
non épinglée, ne correspondant pas à votre paire de langues, ou issue de vos propres fractionnements.

**Une ligne scellée déjà publique n'est pas scellée.** `contest prepare`
compare votre jeu scellé et votre réserve scellée avec l'ensemble des éléments publics : le jeu de dev
qu'il publie (le fractionnement disjoint par groupe ci-dessus maintient cette valeur à zéro), la
version source aveugle éventuelle, et chaque suite de tests déclarée. La comparaison s'effectue
à l'identique ainsi qu'après normalisation de la casse, de la ponctuation et des espaces (le même
critère que pour le regroupement du fractionnement), puis affiche chaque chevauchement avec un décompte
(par exemple « 30 lignes sur 30 apparaissent également dans la suite de tests … ») et consigne ces totaux
dans `local/manifest.json`. Pour une suite tierce, un simple avertissement est émis au lieu d'un refus :
la suite étant un texte public appartenant à un tiers, il vous appartient de décider si vous retirez
ces lignes du corpus principal ou si vous abandonnez la suite, avant de relancer la préparation. Pour vérifier une suite, prepare a besoin de
ses phrases. La commande utilise une copie déjà présente sur votre machine, sans jamais télécharger
pendant la préparation. Spécifiez votre copie avec `--test-suite <id>=<path>` ; son
sha256 doit correspondre à la valeur épinglée dans le registre. Si aucune copie n'est trouvée, l'avertissement précise
que la suite n'a **pas été vérifiée**, et non qu'elle était exempte de doublons. Le manifeste enregistre
le chemin de chaque copie lue par prepare, afin que `node init --from-contest` puisse
y diriger votre nœud.

Votre réserve déclarée et vos suites deviennent des engagements : dès l'arrivée de la première soumission,
le concours les gèle, empêchant tout ajout ou retrait de suite de tests en cours de concours.

## Étape 2 — Le chiffrer et l'héberger sur VOTRE infrastructure

Chiffrez le corpus au repos (n'importe quel schéma AEAD moderne — par exemple `age`/x25519 ou AES-256-GCM) et hébergez le **texte chiffré** quelque part que vous contrôlez. Champollion ne reçoit jamais le texte en clair *ni* le texte chiffré.

Publiez exactement un artefact : le **résumé SHA-256 de l'objet blob de texte chiffré**.

```bash
shasum -a 256 sealed-corpus-v1.age
# → 3b5f0c…e91a  sealed-corpus-v1.age
```

Le résumé est public ; les données ne le sont pas. N'importe qui peut vérifier ultérieurement que l'objet blob évalué est byte-identique à l'objet blob que vous avez scellé — intégrité sans possession. C'est la même discipline de hachage-au-lieu-de-copie que [l'enregistrement ordinaire de corpus](/docs/network/sovereignty/registering-corpora#1-registration-is-metadata-not-content).

## Étape 3 — Enregistrer la fiche de métadonnées

Enregistrez le corpus via le [couloir d'enregistrement](/docs/network/sovereignty/registering-corpora) standard, défaillant en privé : une fiche avec `language_pair`, `license`, `attribution` et `do_not_train` — **pas de phrases**. Choisissez le couloir d'exposition **privé** ; l'enregistrement d'ensemble scellé à l'étape suivante est ce qui le rend admissible au concours.

## Étape 4 — L'enregistrer comme ensemble scellé

Un ensemble scellé est une entrée de registre sans contenu qui met trois choses sur le dossier public :

| Champ | Ce à quoi il vous engage |
|-------|-------------------------|
| `ciphertext_digest` | Les octets exacts qui comptent comme « le corpus » |
| `custodian_group_id` | Un identifiant opaque pour le groupe qui contrôle l'accès (jamais un nom d'org/nation public avant consentement) |
| `current_qualifier_id` | La manche publique qu'une méthode doit franchir avant qu'une exécution scellée puisse même être proposée |

L'enregistrement est **en libre-service, depuis votre propre connexion** — aucun conservateur en boucle et aucune clé privilégiée :

```bash
# Register a contest you prepared with `mt-eval contest prepare --no-register`
mt-eval contest register --manifest local/manifest.json

# Or do it in one shot at prepare time
mt-eval contest prepare … --self-serve
```

Le manifeste reste sur votre machine — l'enregistrement ne transmet que les identifiants,
empreintes et seuils exempts de contenu. Vous pouvez vérifier exactement ce qui est transmis avant
tout envoi : `contest prepare --no-register` affiche le plan d'enregistrement,
chaque ligne que `contest register` va écrire, dans l'ordre — l'identifiant de chaque jeu scellé et
le SHA-256 de son texte chiffré (avec le nombre de lignes restant scellées sur votre machine),
le groupe de dépositaires, l'identifiant du qualificatif et son seuil, la ligne du concours avec ses
engagements enregistrés, les colonnes de politique, ainsi que toute réserve, suite de tests et condition
de prix intégrées aux métadonnées du concours. Le plan est généré par le code même
qui transmet les lignes, garantissant qu'il ne peut décrire autre chose que ce qui est envoyé.
Chaque ligne du registre est **liée à une identité** : la
base de données enregistre le compte connecté qui l'a inscrite et verrouille cette
liaison contre toute modification ultérieure ; un qualificatif ne peut filtrer qu'un jeu scellé enregistré
par la **même** identité. Les jeux scellés sont créés en quarantaine (ils ne peuvent jamais
servir de base à un concours standard ni figurer dans le classement public), les qualificatifs sont
initialisés dans un état sécurisé, et l'enregistrement est limité en débit — le tout étant appliqué par
des déclencheurs de base de données sous chaque client, y compris les nôtres. Le registre lui-même est
accessible en lecture publique, vous permettant de vérifier que votre entrée mentionne exactement ce que vous avez scellé —
et rien de plus.

**Limites réelles.** L'accès en libre-service concerne uniquement l'enregistrement (insertion seule au
niveau de la base de données). **La rotation des qualificatifs et le retrait des jeux scellés restent
soumis à la médiation d'un curateur** — ouvrez un ticket ou contactez le projet via
[GitHub](https://github.com/gamedaysuits/Champollion/issues). De plus, l'exécution du nœud d'évaluation
de l'organisateur dans les étapes suivantes (progression du cycle de vie, octroi d'autorisations,
opérations d'audit) constitue un canal distinct, muni d'identifiants de service sur votre propre nœud —
le libre-service s'arrête au registre public.

## Étape 5 — Choisir les dépositaires et la règle M-sur-N

Choisissez les personnes ou institutions qui doivent conjointement approuver chaque évaluation contre votre corpus, et le seuil (par exemple **3 sur 5**). Les dépositaires doivent être responsables envers votre communauté, pas envers Champollion — voir [Intendance des données](/docs/network/sovereignty/data-sovereignty) et [Propriété et conditions](/docs/network/sovereignty/ownership-transfer) pour savoir comment les conditions par communauté sont définies.

**Transparence :** la *signature* à seuil (un octroi qu'il est matériellement impossible de créer
sans M signatures) est **en cours de développement**. La cérémonie de clés du nœud hors ligne
(`mt-eval node ceremony`, Shamir M-de-N) est développée mais n'a pas encore été utilisée
avec un dépositaire réel. Pour le reste, la règle M-de-N est appliquée sous la forme d'une procédure tracée : chaque demande d'accès
rejoint une file **en attente**, les décisions des dépositaires sont consignées, un octroi n'est créé
que pour une demande autorisée, chaque octroi est **à usage unique, limité dans le temps et
lié à une empreinte précise (méthode, version de corpus, nœud d'évaluation)**,
et chaque événement — y compris les tentatives bloquées — est consigné dans un **journal d'audit public,
en ajout seul et chaîné par hachage**. La base de données refuse les transitions d'état non autorisées
au niveau de chaque client et de chaque clé. Ce qu'elle ne peut pas encore empêcher, c'est une
compromission de l'opérateur de la plateforme lui-même — c'est ce vide que comblera la signature à seuil,
et d'ici sa mise en service, vous devez considérer l'absence de détention de parts de clés par Champollion
comme un objectif de conception en cours de réalisation, et non comme une propriété vérifiable aujourd'hui.

## Étape 6 — Définir le prix et déclarer ses conditions

L'attribution d'un prix est facultative. **Un concours sans conditions de prix déclarées n'a tout simplement pas
de prix** — c'est le cas par défaut, et cela n'en fait pas un concours inférieur.

Si vous en proposez un, déterminez et publiez avec le concours :

- **Le montant et la devise.**
- **Le sponsor** — l'entité qui finance le montant.
- **Le lieu de dépôt des fonds** — le compte de votre organisation ou un fonds communautaire
  que vous désignez. **Champollion ne détient, ne séquestre ni n'achemine jamais les fonds de prix.**
  La publication préalable de l'identité du détenteur assure la crédibilité du prix ;
  consultez la [note sur le risque de défaut du sponsor](/docs/network/sovereignty/terms-templates#trojan-horse-risks)
  dans les modèles de conditions.
- **Les conditions de seuil** — le niveau de score qu'une méthode doit atteindre, défini
  selon la [Spécification des prix](/docs/network/specifications/prizes) : un seuil chrF++,
  les filtres de diagnostic souhaités (comme un taux minimal d'acceptation FST —
  un filtre que la soumission doit valider, sans constituer le score), des exigences de validation
  par des locuteurs, la reproductibilité. Rendez les conditions d'attribution
  vérifiables à partir des scores publiés, afin que personne n'ait à vous croire sur parole
  (ni à nous croire) pour savoir si le palier a été franchi.
- **Les conditions relatives au prix** — le sort réservé à la soumission elle-même.

### Le choix des conditions du prix vous appartient

L'exécution est invariable : dans un concours souverain, le participant vous remet un modèle ou une
méthode et votre nœud l'exécute. Ce qu'il en advient *ensuite* relève de votre choix,
parmi les trois options suivantes :

| Condition | Ce que vous indiquez aux participants |
|---|---|
| `pass_to_holders` — *cession aux détenteurs* | La méthode vous est cédée, en tant que détenteurs de la référence souveraine. Vous l'évaluez et la conservez, quel que soit le vainqueur. |
| `retain_ip` — *conservation de la PI* | Le participant conserve la propriété intellectuelle. Vous évaluez la soumission et ne conservez au maximum qu'une copie scellée pour audit. |
| `release_open` — *publication ouverte* | Le participant conserve la propriété intellectuelle mais doit publier la méthode sous licence libre. Cette publication constitue la condition d'obtention du prix. |

Les détails découlent directement de la condition choisie, sans qu'aucune grille ne soit à remplir : ce que vous
conservez (`retention`), le transfert éventuel de droits (`rights`), l'usage autorisé
(`host_use`) et l'obligation de publication pour le participant (`release`) sont tous
**dérivés** de l'option choisie. Deux des options vous permettent d'ajuster un
champ :

- sous `retain_ip`, `--prize-retention delete_after_scoring` détruit l'artefact une fois celui-ci évalué (par défaut, une copie scellée est conservée pour audit) ;
- sous `release_open`, `--prize-release-timing` reporte la publication à `required_before_scores` ou `required_after_prize` (la valeur par défaut étant `required_before_prize`), et `--prize-release-license` spécifie la licence au lieu d'accepter toute licence validée par l'OSI (`any_osi`).

Le tableau récapitulatif complet des dérivations et la procédure de vérification de chaque option avant paiement figurent
dans la [Spécification des prix §2.1, condition 7](/docs/network/specifications/prizes#condition-7-in-detail-the-term-is-one-choice-of-three).

```bash
# The term…
mt-eval contest prepare … --prize-disposition retain_ip

# …with the one narrowing that option offers
mt-eval contest prepare … --prize-disposition retain_ip \
  --prize-retention delete_after_scoring

# …or the same declaration from a JSON file
mt-eval contest prepare … --prize-terms my-terms.json
```

Quel que soit votre choix, la condition vous est restituée en langage clair accompagnée d'un
**SHA-256** avant tout enregistrement. Ce hachage fait office de jeton d'acceptation :
le participant transmet `--accept-terms <hash>`, l'acceptation est intégrée à son
paquet et protégée par son hachage de contenu, et votre nœud rejette tout paquet ayant
accepté d'autres conditions. La condition est verrouillée dès que votre concours reçoit sa première
soumission, empêchant ainsi d'imposer à quiconque des termes qu'il n'a pas consultés.

L'aspect financier est délibérément *exclu* des conditions : le montant, la devise et le
sponsor relèvent des informations générales du concours ; une clause relative à la propriété d'une méthode
est d'une tout autre nature qu'une indication portant sur le montant versé.

## Étape 7 — Créer le concours

Les concours sur des ensembles scellés utilisent le **couloir scellé** explicite. L'admissibilité est défaillante fermée : le concours est refusé à moins que votre enregistrement d'ensemble scellé existe et soit actif — et créer le concours n'accorde à **personne** aucun accès au corpus.

```bash
mt-eval contest create \
  --name "EN→CRK Community Challenge 2026" \
  --corpus sealed-eng-crk-v1 \
  --language-pair "en>crk" \
  --visibility public \
  --use-context non-commercial \
  --prize-disposition retain_ip \
  --results-visibility hidden_until_close \
  --anonymize-until-close \
  --description "Community-custodied held-out set; scores-only; prize held by <your org/trust>."
```

Deux de ces paramètres sont fixés ou verrouillés par la base de données quoi que vous fassiez
par la suite, et trois autres constituent des **engagements** :

- `--use-context` fait partie de l'identité du concours : il est fixé dès
  l'enregistrement du concours et ne peut plus être modifié (créez un nouveau concours
  le cas échéant). La valeur par défaut est `non-commercial`.
- `--primary-metric` (par défaut `chrf_plus_plus`), la métrique sur laquelle repose le classement,
  est gelée dès la réception de la première soumission. Tout nouveau concours mentionnant l'ancienne métrique
  `composite` est refusé avec motif ; les concours enregistrés avant le
  [standard d'évaluation](/docs/network/specifications/scoring#how-runs-are-scored)
  continuent de fonctionner.
- `--visibility` (par défaut `public`), `--description` et l'état d'ouverture des candidatures
  ne sont pas gelés.

Les trois engagements sont gelés dès l'instant où votre concours enregistre sa première soumission :

- `--prize-disposition` / `--prize-terms` — la condition issue de l'Étape 6. Omettez les deux et
  le concours ne comporte aucun prix.
- `--results-visibility hidden_until_close` — chaque score mesuré par votre nœud
  est **retenu** jusqu'à la clôture du concours, afin d'éviter toute optimisation sur le
  jeu scellé à partir de ses propres résultats. Il s'agit du comportement par défaut ; l'exemple l'indique
  explicitement pour que l'engagement apparaisse dans vos propres notes. Spécifiez
  `--results-visibility immediate` si vous préférez un tableau de bord en direct, où chaque
  fiche est publiée dès que votre nœud en termine l'évaluation.
- `--anonymize-until-close` — les participants apparaissent sous des pseudonymes stables dans votre
  classement tant que le concours est ouvert. (Cela concerne votre vue du classement ; cela
  n'anonymise pas une fiche une fois celle-ci publiée sur le tableau public.)

Ces trois mêmes options sont accessibles sur `contest prepare` et `contest register`,
qui constituent l'endroit où la plupart des organisateurs les définiront, puisque ces commandes créent le
concours pour vous. Avec `contest prepare --no-register`, les options
d'enregistrement que vous fournissez (`--results-visibility`, `--anonymize-until-close`,
`--primary-metric`, les options de prix, `--visibility`, `--use-context`,
`--closed-intake`) sont inscrites dans `local/manifest.json`, et
`contest register --manifest` les applique à moins que vous ne passiez ses propres options,
en signalant tout remplacement d'une valeur enregistrée. Prepare affiche l'ensemble de
ces conditions avec leur valeur, qu'elle soit explicite ou par défaut, ainsi que le
moment où elle devient non modifiable, avant tout enregistrement. Sa commande
`--help` indique chaque valeur par défaut.

*(La valeur `--corpus` est votre `sealed_set_id` enregistré. Le couloir scellé est sélectionné **automatiquement** à partir de l'enregistrement d'ensemble scellé — aucun drapeau supplémentaire ; un ensemble scellé ne peut jamais soutenir un concours ordinaire, et un ensemble en quarantaine ordinaire ne peut jamais soutenir aucun concours. Les deux règles sont appliquées dans la base de données, sous chaque client. Si vous avez enregistré à l'étape 4 avec `contest register` ou `prepare --self-serve`, la ligne de concours **existe déjà** — ignorez cette étape ; `contest create` à la main est uniquement pour assembler un concours à partir d'un ensemble scellé déjà enregistré.)*

## Étape 8 — Les méthodes se qualifient d'abord en public

Les développeurs conçoivent et évaluent leurs méthodes sur le **jeu de dev public** que vous avez publié
à l'Étape 1. Le paramètre `current_qualifier_id` de votre jeu scellé désigne cette phase, et une
méthode doit impérativement franchir son seuil avant même de pouvoir demander une exécution scellée. Cette
disposition protège votre corpus des tentatives de sondage : personne ne peut cibler le jeu scellé
sans avoir démontré des performances probantes dans un cadre public.

Un participant l'exécute lui-même, hors ligne, en une seule commande :

```bash
mt-eval contest qualify <contest-id> --dev my-dev-output.txt \
    --dev-corpus <the dev corpus you released> \
    --system "acme-nmt" --method-class pipeline \
    --offline-qualifier-id <qualifier id> --offline-threshold <threshold>
```

L'identifiant du qualificatif et le seuil sont les deux éléments dont l'évaluation a besoin de
votre part : veillez donc à publier les deux lors de la mise à disposition de la version dev. Pour un concours créé avec `contest
prepare`, l'identifiant du qualificatif correspond à l'identifiant propre du corpus dev (son
`dataset.corpus_id`), et prepare inscrit le seuil dans la description
du corpus dev. Sans les deux options `--offline-…`, qualify les récupère directement
depuis la base de données du concours. Cela ne fonctionne qu'une fois le concours enregistré sur
le point de terminaison ciblé par le participant. S'il n'y figure pas ou si la base de données
est injoignable, qualify s'arrête et affiche la commande hors ligne ci-dessus, renseignée
avec les propres arguments du participant.

`--dev` accepte les traductions du jeu de dev fournies par le participant à raison d'une par ligne selon
l'ordre du corpus, sous forme de JSON indexé par identifiant d'entrée, ou sous la forme du journal d'exécution produit par `mt-eval run
--corpus <the dev corpus>` wrote (or its `_report.json`). Un journal d'exécution est lu par
identifiant d'entrée et vérifié pour s'assurer qu'il correspond bien à ce même corpus dev ; un journal contenant des entrées
en erreur est rejeté, car chaque entrée doit être évaluée. Le récapitulatif indique alors que
les sorties ont été générées par le banc d'évaluation lors de cette exécution et réévaluées depuis son fichier
(avec le coût de ladite exécution), et non qu'elles ont été produites hors du banc d'évaluation ; seul
un simple fichier d'hypothèses est présenté de cette manière.

**Une réussite ne constitue pas encore une soumission.** À l'issue du résultat, qualify indique ce qu'il
est déjà en mesure de déterminer quant à la soumission. Pour une exécution reposant sur un plugin de méthode dont le dossier
se trouve sur la machine, la commande lance la même analyse statique que celle exécutée par `submit-method` et votre nœud
(bibliothèques réseau, utilitaires réseau shell, chemins de fichiers interdits) et
signale tout élément susceptible d'entraîner un refus, par exemple un plugin important `urllib`
pour solliciter un serveur de modèles. Pour une exécution utilisant la voie LLM propre au banc d'évaluation (un modèle
accessible via un fournisseur), elle précise qu'il n'existe aucune méthode soumissible en l'état :
le nœud exécutant les soumissions sans aucun accès réseau, le modèle doit impérativement être intégré au paquet
(voir ci-dessous *Intégrer chaque modèle appelé par votre méthode*). Dans les autres cas, la ligne de validation
énumère les contrôles qui resteront à effectuer au moment de la soumission. Rien de tout cela ne modifie
le verdict ni le reçu.

La commande affiche le score qualificatif (le critère de sélection) et le seuil côte à côte,
tous deux sur l'échelle qualificative chrF++ de 0 à 100, puis détaille la composition du score : chrF++
du corpus avec sa signature sacreBLEU, les autres métriques standard en regard
(jamais combinées), la correspondance exacte à titre de diagnostic sans incidence sur la sélection, ainsi que les
éventuelles réserves sur le score. Qualify ne publie rien. Un système dont les sorties
de dev sont majoritairement des copies du texte source est rejeté quel que soit son score :
lorsque la moitié ou plus des lignes sont identiques à la source (sans tenir compte de la casse, des accents et de la ponctuation,
et en excluant les lignes dont la référence est la source elle-même, comme les noms propres), le participant ne traduit
pas. La même règle s'applique à nouveau lors de la réexécution par votre nœud. Cela génère un **reçu
de qualification** sur la machine du participant, sans lequel `submit-model` et `submit-method` refusent
de constituer une soumission. Les reçus sont conservés par concours et par système (`--system`),
permettant à un participant qualifiant deux systèmes de conserver les deux ; requalifier un même
système préserve le reçu précédent à côté. `submit-method` et
`submit-model` exploitent le reçu correspondant à `--system` (par défaut : celui de `--name`,
sinon l'unique reçu du concours) et s'interrompent en listant les options en cas d'ambiguïté. Le reçu étant
auto-déclaré par construction, il ne constitue pas le filtre d'admission. Avant tout octroi
d'autorisation, **votre nœud réexécute la méthode soumise sur ce même jeu de dev** et
confronte sa propre mesure à l'affirmation formulée ; un reçu qui surestime la méthode
y est rejeté, le refus précisant la valeur déclarée face à la valeur mesurée.

**Un reçu indique l'exécution dont il est issu.** Lorsque `--dev` est un journal d'exécution (ou son
`_report.json`), le reçu enregistre l'exécution ainsi que le modèle sollicité : pour
`mt-eval run --method local-model -m <model>`, l'identifiant et la révision Hugging Face,
ou le répertoire du modèle avec un SHA-256 calculé sur ses fichiers. Un
journal d'exécution `local-model` ne mentionnant aucun modèle est rejeté — les versions antérieures de la 0.2.0
ne transmettaient pas `-m` à ce moteur, qui exécutait alors un modèle anglais→espagnol
par défaut à la place. `submit-model` contrôle ensuite que les poids embarqués figurent bien
parmi les fichiers répertoriés dans le reçu, et refuse l'opération en affichant les deux empreintes
en cas de discordance. Un reçu évalué depuis un simple fichier d'hypothèses ne mentionne aucun modèle ;
la réexécution par le nœud tient lieu de vérification.

**Tout écart entre le reçu et le nœud est signalé.** Les deux valeurs étant
calculées selon le même procédé — même évaluateur, même jeu de dev et, pour un modèle,
même règle de longueur de décodage —, les mêmes poids aboutissent à une fraction de point
près. Si l'écart entre la valeur du nœud et celle du reçu excède **2,0
points** sur l'échelle qualificative de 0 à 100, le nœud le signale à l'issue de sa
réexécution ; un nœud hermétique consigne également cet écart avec sa vérification dans son
registre local et l'affiche de nouveau à l'intention du dépositaire lors de `node approve
--offline`. Il s'agit d'une alerte, jamais d'un refus :
seule la valeur propre au nœud fait foi. (La limite de 2,0 constitue un choix
délibérément strict pensé pour alerter facilement ; c'est un paramètre d'arbitrage qu'un organisateur
peut souhaiter réajuster.)

### Les participants peuvent tout répéter avant de soumettre

Personne ne devrait découvrir que son paquet était mal formé via un rejet survenu des jours
plus tard. `mt-eval contest validate` exécute, sur la machine du participant et sans aucun accès
réseau, la procédure exacte que votre nœud applique en premier :

```bash
# the static checks your node runs on a bundle
mt-eval contest validate ./my-bundle.tar.gz

# …and the qualifier: does my dev output line up, and does it clear the bar?
mt-eval contest validate ./my-bundle.tar.gz --contest <contest-id> \
    --dev my-dev-output.txt --dev-corpus <released dev corpus>
```

La commande affiche un tableau de résultats et renvoie un code de sortie non nul si un élément justifie un refus
(`--json` pour l'automatisation). Recommandez-la aux participants dans votre appel à participation :
elle ne leur coûte qu'une commande et vous évite des rejets inutiles.

`validate` n'enregistre rien. Elle réévalue la sortie de dev sans générer de
reçu, puis valide un reçu existant :

- **Un paquet constitué** (le `.tar.gz` produit par une commande de soumission) intègre le
  reçu avec lequel il a été assemblé, cette copie étant celle que votre nœud lira. La commande
  validate teste donc la répétition sur cette copie. Elle retrouve également le reçu d'origine
  sur la machine du participant et identifie son système, quel que soit le nom de la méthode du
  paquet. Elle émet un avertissement si `--system` désigne un autre reçu,
  ou si le participant a requalifié ce système depuis l'empaquetage (le paquet conservant
  alors l'ancien reçu). En l'absence des options `--offline-…`,
  l'identifiant du qualificatif et le seuil sont également extraits de cette copie, correspondant
  ainsi aux valeurs transmises à `contest qualify` par le participant.
  Le résultat le mentionne expressément.
- **Un répertoire source** préparé pour le contrôle avec `--manifest` : validate
  utilise le reçu que `submit-method` et `submit-model` vont intégrer, identifié
  selon leur méthode habituelle : `--system`, sinon le reçu portant le nom de la
  méthode du paquet, sinon l'unique reçu existant pour ce concours.

La commande émet un avertissement si ce reçu concerne une autre sortie de dev, un autre fichier de dev ou
un autre qualificatif. Elle avertit également en l'absence totale de reçu. Les reçus proviennent
exclusivement de `contest qualify`.

Il s'agit d'une répétition, et elle se présente comme telle. Votre nœud continuera de construire l'image sans
réseau, d'exécuter le conteneur et de relancer lui-même le qualificatif. Une validation sans erreur
indique simplement qu'aucune anomalie n'est *déjà identifiée* — et non que l'exécution produira un score valide.

:::note[Participants : sur quel point de terminaison votre concours réside-t-il ?]
Un concours **hébergé sur le réseau** ne nécessite aucune configuration d'accès — le point de terminaison par défaut
fourni avec le banc d'évaluation prend en charge toute la mécanique du concours (filtre qualificatif, propositions
de méthodes, autorisations), et `mt-eval contest submit-model` /
`submit-method` communiquent directement avec lui. Vous devez disposer du banc d'évaluation **0.2.0 ou supérieur**
(`mt-eval --version`) ; les versions plus anciennes ne disposent pas de `qualify`, `validate`, `rank` et
`close`. Les concours hébergés sur le réseau ne s'ouvrent que lorsqu'un organisateur est enregistré
selon la procédure détaillée dans la mise en garde ci-dessus, de sorte que la majorité des concours actuels sont
**fédérés**.

Un concours **fédéré** — l'organisateur exécute la machinerie sur son propre projet Supabase, donc les soumissions ne transitent jamais par le nôtre — publie son point de terminaison avec les matériaux du concours. Exportez-le avant de soumettre :

```bash
export MT_EVAL_SUPABASE_URL=https://<contest-host>.supabase.co
export MT_EVAL_SUPABASE_ANON_KEY=<contest-anon-key>
```

Si l'harnais pointe vers un point de terminaison qui n'a pas la machinerie de concours (par exemple, un hôte fédéré manquant une migration), la commande s'arrête avec *« le couloir de concours n'est pas encore disponible sur ce point de terminaison Supabase »* et vous indique le point de terminaison auquel il parlait. (Organisateurs fédérés : publiez ces deux valeurs à côté de votre version de corpus, `--node-id`, et `--corpus-version`.)
:::

## Étape 9 — Exécutions scellées : demander, autoriser, exécuter, scores sortent

Pour chaque soumission :

1. Une **demande** est soumise pour votre jeu scellé — elle rejoint `pending` et
   intègre une empreinte immuable composée de (hachage du paquet, id du corpus, version
   du corpus, `scores-only`, mesure du nœud d'évaluation).
2. Votre nœud procède à ses **propres vérifications statiques** sur le paquet. Pour une soumission de code
   (Voie B), il vérifie ensuite sa capacité matérielle à l'exécuter : présence d'un moteur de conteneur,
   et adéquation de la RAM, du disque temporaire et du temps d'exécution déclarés avec vos limites
   `sandbox`. Un dépassement à ce stade ne constitue pas un jugement sur la valeur de la méthode. Le
   refus précise chaque incompatibilité (« 8 Go de RAM demandés, ce nœud autorise 4 Go
   (sandbox.max_ram_gb) »), rien n'est exécuté ni rejeté définitivement, et la demande reste
   dans son état initial. Vous pouvez relever le plafond dans `node.json` et relancer
   `mt-eval node run-method <id>` sans exiger de nouvelle soumission. Le participant peut également
   reconditionner son paquet avec les options suggérées par le message de refus (par exemple `--ram-gb 4`) ;
   les exigences matérielles faisant partie du hachage du paquet, cela constitue alors une nouvelle demande.
   Le nœud procède ensuite à la **réexécution de la déclaration qualificative du participant** sur sa propre
   copie du jeu de dev public. Le reçu n'est qu'une affirmation ; cette étape constitue
   la mesure réelle. Tout manquement entraîne un rejet
   immédiat — avant qu'aucun dépositaire ne soit sollicité pour valider quoi que ce soit, et avant
   toute ouverture du jeu scellé —, le motif explicitant la valeur déclarée, la valeur mesurée
   et l'exigence requise. Un paquet ayant accepté des conditions de prix différentes de celles définies
   pour votre concours est rejeté au même stade.
3. Vos **dépositaires statuent** (décision M-de-N). Une approbation génère un **octroi** : à usage unique,
   temporaire, valide exclusivement pour cette empreinte exacte.
4. L'évaluation s'exécute dans le bac à sable isolé du réseau sur **votre** nœud
   (`mt-eval node run-method`) : un conteneur dépourvu de pile réseau, avec les références
   maintenues à l'extérieur — ou, pour une isolation absolue, sur une machine hermétique (airgap) dédiée,
   les paquets de scores seuls signés étant transférés par média amovible (voir l'encadré d'état
   plus haut pour le périmètre couvert). Un nœud déconnecté ne téléverse rien : vous
   récupérez son paquet de scores signé et publiez la fiche d'exécution depuis une machine
   connectée (`mt-eval node relay`). Votre réserve scellée ainsi que les suites de tests tierces
   déclarées s'exécutent au sein de la **même** session autorisée, sans imposer de formalité
   additionnelle à vos dépositaires.
5. **Seuls les scores sortent.** La règle de diffusion `scores-only` est verrouillée au
   niveau de la base de données ; les textes de votre corpus relatifs aux entrées individuelles ne sont jamais publiés.
6. Si votre concours a promis `hidden_until_close`, le score n'est pas publié
   immédiatement : il est **retenu** sous forme de résultat différé visible de vous seul,
   `contest close` se chargeant de publier chaque fiche retenue avant de figer
   le classement définitif. Un résultat retenu n'est jamais perdu.
7. Chaque étape — demande, votes, octroi, exécution et éventuelle tentative bloquée — est
   consignée dans le journal d'audit public, chaîné par hachage, que vous (et quiconque) pouvez rejouer.

## Soumettre une méthode (guide participants) — deux voies possibles

La plupart des soumissions en TA neuronale restent classiques : un transformeur standard affiné avec ses
poids. Pour ces cas, il existe une **voie privilégiée, sans code** — ainsi qu'une solution de secours
en bac à sable pour les approches reposant réellement sur du code exécutable.

### Voie A — modèle déclaratif (privilégiée pour la TA standard)

Si votre méthode repose sur un modèle neuronal standard, vous la soumettez sous forme de **données** — les
poids, le tokeniseur et la configuration — et l'organisateur l'exécute au sein de son propre moteur
d'inférence de confiance. **Sans Dockerfile, sans code, sans bac à sable.** Aucune partie de ce que vous
soumettez n'étant exécutée directement, le contrôle de sécurité de l'organisateur se résume à une validation
de format décidable au lieu de chercher à prouver l'innocuité d'un code arbitraire — une garantie strictement
supérieure pour vous comme pour la préservation du corpus.

```bash
mt-eval contest submit-model <contest-id> \
  --model-dir ./my-model \          # config.json + model.safetensors + tokenizer.* at the ROOT
  --name "My NMT" --version 2.0 \
  --architecture MarianMTModel \    # must be on the organizer's trusted whitelist
  --method-class pipeline --paradigm neural-nmt \
  --track constrained --training-data-file ./training-data.txt \
  --parameter-count 92487 \
  --weights-license Apache-2.0 --weights-public \
  --developer "Your Name" --node-id <organizer-advertised-node-id> --agree
```

**Un modèle entraîné avec NMT Forge.** `nmt-forge export` génère le
dossier déployable `export/model/`. Outre les poids, la configuration et le tokeniseur,
il contient `forge-model.json` (les scores de ce modèle sur votre jeu de test privé,
ainsi que des chemins locaux), `DEPLOY.md` et `champollion-plugin/`, qui ne font
pas partie d'une soumission. `submit-model` n'emballe que les fichiers requis par la bibliothèque transformers
(les poids, `config.json`, `generation_config.json`, les fichiers du tokeniseur) et
liste tout ce qui a été exclu, garantissant que ces trois éléments restent automatiquement à l'écart.
La section 6 de ce `DEPLOY.md` détaille les fichiers constituant la soumission,
l'architecture issue de `config.json` et le nombre de paramètres extrait de l'en-tête
du fichier de poids, en fournissant la commande exacte. Pour n'expédier strictement que les fichiers
que vous avez inspectés, isolez-les dans un dossier dédié et passez ce dernier en argument
de `--model-dir` :

```bash
mkdir -p lane-a
cp export/model/config.json export/model/generation_config.json \
   export/model/model.safetensors export/model/tokenizer.json \
   export/model/tokenizer_config.json lane-a/      # the files DEPLOY.md §6 lists
mt-eval contest submit-model <contest-id> --model-dir lane-a \
  --architecture MarianMTModel --paradigm neural-nmt …
```

**Quel nombre de paramètres déclarer.** La Voie A confronte `--parameter-count` au
fichier de poids. Elle cumule la taille des tenseurs dans l'en-tête `safetensors` et
rejette toute déclaration s'en écartant de plus de 1 %. C'est bien la valeur stockée dans le fichier,
qui peut différer d'un décompte calculé dans PyTorch. Un poids partagé ou lié n'est enregistré qu'une fois.
Une table réinstanciée dynamiquement au chargement du modèle, comme des positions sinusoïdales, peut ne pas
être sauvegardée. Le message de rejet indique le décompte exact relevé dans le fichier ; déclarez ce chiffre.

Les exigences auxquelles votre paquet doit se conformer (validées localement avant l'envoi, puis
à nouveau par le nœud de l'organisateur) :

- **Les poids sont en format `safetensors`, jamais en pickle.** Un fichier PyTorch `.bin`/`.pt`/`.ckpt`
  est un pickle — exécutant du code arbitraire lors de son chargement — et sera refusé. Exportez vers
  `model.safetensors` (`safetensors` / `transformers` gèrent cela nativement).
- **Une architecture prise en charge nativement par le moteur de l'organisateur.** L'attribut `config.json` de
  `architectures` peut correspondre à toute architecture implémentée par le `transformers` de l'hôte
  (Marian, NLLB/M2M100, mBART, T5, Pegasus et bien d'autres) — les hôtes sont
  **permissifs par défaut**, car avec `trust_remote_code=False`, la sécurité
  résulte du format exempt de code et non du nom de l'architecture (une architecture non prise en charge
  échouera simplement au chargement, sans rien exécuter). Un hôte rigoureux peut choisir
  de publier une liste blanche. Ni `auto_map`, ni `trust_remote_code` — ces options réintroduisant
  du code personnalisé, elles sont systématiquement rejetées.
- **Un tokeniseur déclaratif** (`tokenizer.json` ou un binôme `sentencepiece` `.model` +
  vocabulaire), et **des fichiers de données exclusivement** — aucun script, binaire ou fichier `.py` dans le paquet.

**Ce qu'embarque `submit-model`.** Les fichiers de données situés à la racine de `--model-dir`
(`.safetensors`, `.json`, `.model`, `.txt`, `.spm`, `.vocab`, `.merges`) :
poids, configuration, tokeniseur et configuration de génération. Tout le reste — un fichier
`README.md` ou `DEPLOY.md`, un sous-dossier, un point de contrôle pickle voisin
des safetensors — est ignoré, la commande affichant la liste des éléments exclus. Ainsi, le
dossier `model/` généré par `nmt-forge export` se soumet directement : ses fichiers `DEPLOY.md`
et `champollion-plugin/` restent en arrière. `contest validate` applique la même sélection
et signale les fichiers ignorés sous forme d'indication INFO. Le contrôle opéré par votre nœud reste
identique : tout paquet comportant un fichier autre que de données y demeure rejeté.

**Détermination de la longueur des sorties.** Votre nœud applique systématiquement une longueur
de décodage explicite : la valeur `max_new_tokens` ou `max_length` stipulée par le modèle (son
`generation_config.json`), ou à défaut une limite de `max(64, 4 × source tokens)` nouveaux jetons
par phrase, plafonnée aux positions du décodeur. La commande `mt-eval run --method
local-model` applique strictement la même règle, assurant une parfaite concordance entre le reçu du participant
et la réexécution par votre nœud. `submit-model` affiche la longueur retenue
et l'inscrit dans le manifeste (`model.decodeLength`) ; le nœud consigne la
longueur réellement appliquée dans les paramètres d'exécution du test (`execution.generation`).
Faute de longueur explicite, la bibliothèque transformers tronque la génération aux alentours de 20
jetons, ce qui conduirait à évaluer les soumissions sur des sorties coupées.

L'organisateur procède à l'évaluation avec `trust_remote_code=False`, hors ligne, et seuls les scores
sont extraits — publiés sous l'identifiant `declarative-model`, avec une identité de méthode
**exempte de code par construction**. (Poids volumineux de plusieurs Go : utilisez `--bundle-out` pour
le transfert par support physique, comme indiqué ci-après.)

### Voie B — paquet exécutable (bac à sable pour méthodes avec code)

Si votre démarche repose effectivement sur du code — un pipeline spécifique, une approche hybride guidée par LLM,
un décodeur personnalisé —, elle ne peut être exécutée de manière purement déclarative et doit transiter par le
bac à sable isolé du réseau. Cette voie offre un niveau de garantie intrinsèquement moindre (elle encapsule du code
non vérifié au lieu d'en interdire l'exécution) ; privilégiez donc systématiquement la Voie A dès lors que votre
méthode correspond à un modèle standard.

**Intégrer chaque modèle appelé par votre méthode.** Le nœud évalue votre soumission en l'absence
totale de connexion réseau : toute méthode sollicitant l'API d'un modèle hébergé (système hybride
interrogeant un LLM distant, service de TA tiers) n'obtiendra aucune réponse et n'enregistrera aucun
score. Un système hybride guidé par LLM ne valide l'épreuve qu'en incorporant son LLM au paquet :
poids ouverts placés sous `/method`, exécutés dans le processus ou via un serveur local lancé
par votre point d'entrée. Il en va de même pour tout dictionnaire, transducteur (FST) ou autre ressource consultée
à l'exécution. (La [spécification des méthodes](/docs/network/specifications/methods#method-validity-and-dependency-classes)
classe les méthodes nécessitant un LLM distant dans la catégorie de dépendance A1 ; la passerelle
sécurisée permettant leur exécution en bac à sable n'est pas encore développée.)

**Le contrat du paquet exécutable repose sur stdin/stdout.** Dans le conteneur, le nœud de
l'organisateur exécute très précisément :

```
cat /eval/source.txt | <your entrypoint> > /output/translations.txt
```

Les phrases sources sont transmises sur l'entrée standard (stdin) à raison d'une par ligne ; vous renvoyez une traduction par
ligne sur la sortie standard (stdout). Le conteneur ne possède aucune interface réseau (`--network=none`),
dispose d'une racine en lecture seule et d'un volume accessible en écriture sur `/tmp`.

**Emplacement de vos fichiers.** L'intégralité du contenu du dossier transmis via `--method-dir`
est encapsulée sous `method/` au sein du paquet et montée **en lecture seule sur `/method`**
lors de l'exécution, poids compris, évitant toute duplication dans l'image. Organisez l'arborescence
ainsi :

```text
my-method/              ← --method-dir ./my-method
  translate.py          ← --entrypoint translate.py   (runs as /method/translate.py)
  weights/              ← read at /method/weights
  wheels/               ← vendored dependencies (see the Dockerfile below)
Dockerfile              ← --dockerfile ./Dockerfile
training-data.txt       ← --training-data-file ./training-data.txt
```

`--entrypoint` représente le chemin d'accès au script au sein de `--method-dir`. Son chemin dans le paquet,
`method/translate.py`, est également accepté. Si une désignation s'avère ambiguë entre deux fichiers,
la commande s'interrompt en signalant les deux ; si le fichier est introuvable, elle détaille l'ensemble
des chemins inspectés.

**Un wrapper transformers Hugging Face minimal :**

```python title="my-method/translate.py"
#!/usr/bin/env python3
import sys
from transformers import AutoModelForSeq2SeqLM, AutoTokenizer

tok = AutoTokenizer.from_pretrained("/method/weights")
model = AutoModelForSeq2SeqLM.from_pretrained("/method/weights")

for line in sys.stdin:
    inputs = tok(line.strip(), return_tensors="pt", truncation=True)
    out = model.generate(**inputs, max_new_tokens=256)
    print(tok.decode(out[0], skip_special_tokens=True), flush=True)
```

**Le Dockerfile doit se construire sans réseau.** L'organisateur construit votre image avec `--network=none` — le test de construction en air-gap *est* la construction — donc chaque dépendance doit être **vendorisée dans le bundle** (un `pip install` qui atteint PyPI échoue la construction, et l'analyse statique de pré-vol signale les appels réseau avant même que quoi que ce soit ne soit envoyé). Livrez les wheels à l'intérieur de votre répertoire de méthode et installez-les à partir de ceux-ci :

```dockerfile title="Dockerfile"
FROM python:3.11-slim
# The build context is the bundle root: Dockerfile + method/
COPY method/wheels/ /wheels/
RUN python3 -m pip install --no-index --find-links=/wheels torch transformers sentencepiece
# Weights are NOT copied — /method is mounted read-only at run time.
```

**Éléments requis pour chaque soumission.** Ces informations sont obligatoires, et la commande
s'interrompt avant tout transfert réseau si l'une d'elles fait défaut :

- `--method-dir`, `--dockerfile`, `--entrypoint`, `--name`, `--version`,
  `--method-class`, `--developer`, `--node-id` et `--agree` ;
- un **reçu `mt-eval contest qualify` validé** pour ce concours et ce
  système précis (Étape 8 ; `--system` le spécifie si vous en avez qualifié plusieurs) ;
- deux déclarations, enregistrées sous votre responsabilité : `--track constrained` ou
  `--track unconstrained` (aucune valeur par défaut n'est appliquée), ainsi que `--parameter-count` ;
- pour toute méthode comportant des poids entraînés (`--parameter-count` supérieur à 0) : également
  `--weights-license <SPDX id or LicenseRef-…>` ainsi que l'une des mentions `--weights-public`
  ou `--weights-private` ;
- pour une approche **sans poids entraînés** (système à base de règles, dictionnaire, FST) :
  `--parameter-count 0` et aucune option relative aux poids. La soumission mentionne
  la licence et l'ouverture des poids comme non applicables, vous évitant de renseigner une licence
  fictive ;
- pour une méthode reposant sur **l'ingénierie de prompt avec un LLM** (aucun entraînement, conception
  de requêtes uniquement) : le nombre de paramètres correspond à la somme de ceux de chaque modèle exécuté par le paquet,
  LLM compris, quand bien même vous ne l'avez pas entraîné. Relevez ce chiffre sur la fiche
  du modèle ou dans l'en-tête de ses poids, et renseignez la licence du LLM via
  `--weights-license` avec `--weights-public` si ses poids sont librement
  téléchargeables. L'option `--parameter-count 0` traduirait mal la réalité du système : une valeur de 0 indique
  qu'aucun modèle n'est exécuté. Une méthode nécessitant un LLM hébergé en ligne ne peut absolument pas
  concourir à une session scellée : le nœud n'a aucun accès réseau et l'interface intermédiaire requise
  pour ces requêtes n'est pas développée (voir plus haut *Intégrer chaque modèle appelé par votre méthode*).
  `contest qualify` l'indique explicitement lorsque les sorties évaluées
  ont été obtenues via un fournisseur tiers ;
- avec `--track constrained` : `--training-data-file`, sous la forme d'une énumération en texte brut
  des corpus ayant servi à l'entraînement (un système n'ayant nécessité aucun entraînement le stipule dans ce fichier) ;
- si le concours a défini des conditions de prix : `--accept-terms <hash>` (lancez une première exécution
  sans cette option pour afficher les conditions et récupérer le hachage à retourner) ; si des descriptions
  sont requises : `--description-file`.

**Ressources déclarées par votre méthode.** Le paquet précise les exigences en RAM,
disque de travail temporaire et temps d'exécution réel (wall-clock), le nœud de l'organisateur rejetant tout paquet
qui excède ses plafonds `sandbox`. Les valeurs par défaut correspondent aux limites du
modèle de nœud généré par `mt-eval node init` : `--ram-gb 4`, `--disk-gb 4`,
`--max-runtime-minutes 30`, sans GPU. Un paquet constitué avec les options par défaut
s'exécutera donc sans encombre sur un nœud initialisé avec les paramètres par défaut du modèle. Si votre
méthode exige des ressources accrues, déclarez-le via ces options (ainsi que `--gpu`) et vérifiez
que le nœud de l'organisateur l'autorise. Les organisateurs modifiant ces plafonds sont tenus de les
publier avec les informations du concours. En cas de rejet par le nœud, le motif précise chaque valeur
demandée ainsi que la limite autorisée.

Soumettez-le avec :

```bash
mt-eval contest submit-method <contest-id> \
  --method-dir ./my-method --dockerfile ./Dockerfile \
  --name "My NMT" --version 1.0 \
  --entrypoint translate.py \
  --method-class pipeline --paradigm neural-nmt \
  --developer "Your Name" --node-id <organizer-advertised-node-id> \
  --track constrained --parameter-count 78000000 \
  --weights-license Apache-2.0 --weights-public \
  --training-data-file ./training-data.txt \
  --primary \
  --agree
```

Le nœud de l'organisateur réexécute votre méthode sur sa propre copie du jeu de dev public
avant que les dépositaires ne soient invités à approuver la session d'évaluation. L'option `--agree`
atteste de votre acceptation des conditions de soumission de méthodes.

**Poids volumineux (plusieurs Go) ou absence d'accès réseau : utilisez le transfert physique (sneakernet).**
Le canal d'ingestion en ligne expédie votre archive sous la forme d'un **unique POST** vers l'espace de stockage
de l'hôte du concours, se heurtant ainsi à la limite de téléversement de cet hébergement — ce qui convient aux scripts
et modèles compacts, mais exclut les points de contrôle de plusieurs gigaoctets. Les spécifications de format
admettent pourtant des volumes bien plus importants (archives jusqu'à 100 Go, images compilées jusqu'à
150 Go). `--offline` assemble le paquet et génère un dossier d'échange sans aucune connexion réseau.
En l'absence de réseau, aucune information de concours ne pouvant être récupérée, vous devez lui fournir les valeurs
diffusées par l'organisateur : `--bundle-out`,
`--secret-set`, `--pair`, `--developer-email`, `--offline-qualifier-id` et
`--offline-threshold` (le seuil sur l'échelle qualificative de 0 à 100). Exemple pour une méthode à base de règles
sans poids, préparée hors ligne :

```bash
mt-eval contest submit-method <contest-id> \
  --method-dir ./my-method --dockerfile ./Dockerfile \
  --name "My Rules" --version 1.0 \
  --entrypoint translate.py \
  --method-class pipeline --paradigm rule-based \
  --developer "Your Name" --developer-email you@example.org \
  --node-id <organizer-advertised-node-id> \
  --track constrained --parameter-count 0 \
  --training-data-file ./training-data.txt \
  --agree \
  --offline --bundle-out ./exchange \
  --secret-set <sealed-set-id> --pair 'eng>crk' \
  --offline-qualifier-id <published-qualifier-id> --offline-threshold 35
```

Le répertoire d'échange se déplace vers l'organisateur par média amovible (ou tout canal en lequel vous avez tous les deux confiance) ; ils l'ingèrent avec `mt-eval node import-bundle`. Le SHA-256 du bundle est gelé dans la demande d'autorisation de toute façon, donc ce qui s'exécute est prouvablement ce que vous avez proposé.

**Organisateurs : une proposition hors ligne requiert l'accord d'un dépositaire, au même titre qu'une proposition en ligne — le nœud applique ses contrôles préalables selon la séquence de l'Étape 9.**
Elle est intégrée avec le statut *en attente*, le nœud hermétique consignant lui-même ses propres vérifications
ainsi que l'arbitrage du dépositaire, sans base de données externe ni clé de service :

```bash
mt-eval node import-bundle ./exchange               # stages it: PENDING custodian approval
mt-eval node run-method <request-id> --offline      # the node's checks: re-runs the entrant's qualifier, checks the container runtime
mt-eval node list --offline                         # what is staged, checked, approved or waiting, and the next command
mt-eval node approve <request-id> --offline --actor <custodian>
#   or: mt-eval node deny <request-id> --offline --actor <custodian> --reason "…"
mt-eval node run-method <request-id> --offline      # the sealed run: refuses until the approval is recorded
mt-eval node export-scores ./exchange               # signed scores, or the signed refusal
```

Le premier appel à `node run-method --offline` sur une soumission en attente n'accède à aucune donnée
scellée. Il réexécute le qualificatif du participant sur le jeu de dev public (le couple
`qualifier` + `dev_corpus` indiqué par votre `node.json` ; `node init
--from-contest` les renseigne automatiquement) et, dans le cas d'une soumission avec code, vérifie la présence
d'un environnement de conteneurs ainsi que la compatibilité de la RAM, du disque temporaire et de la durée d'exécution
avec vos plafonds `sandbox`. La validation est consignée dans le registre local
chaîné par hachage du nœud. Tout échec sur le qualificatif entraîne un rejet immédiat, enregistré comme
refus du nœud et restitué sous forme de refus signé : aucun dépositaire n'est sollicité.
Un nœud dans l'incapacité d'exécuter la soumission (moteur manquant, plafond trop bas) émet un refus lié
à l'infrastructure sans rien consigner, préservant la demande dans son état antérieur.

`node approve --offline` refuse de poursuivre tant que cette validation préalable n'est pas inscrite au registre
pour l'empreinte et le paquet exacts de la demande, son message d'erreur mentionnant la
commande à lancer en premier. Il consigne ensuite un vote et l'autorisation dans ce
même registre (celui employé pour la cérémonie de partage des dépositaires), accompagnés d'un enregistrement
de décision signé avec la clé `signing_key` du nœud, attestant du contrôle sur lequel elle s'est fondée. Le
second appel à `node run-method --offline` contrôle ces trois éléments avant d'exécuter la moindre donnée scellée
(le registre est valide, il confirme l'autorisation de la demande pour l'empreinte importée,
et l'acte signé est vérifié en faisant référence à cette requête), garantissant qu'une proposition en attente
ne s'exécute jamais sur la seule affirmation d'un opérateur. Il relance ensuite la vérification matérielle
et le qualificatif avant l'ouverture du jeu scellé.
Un refus est tracé de manière analogue et transmis au participant sous forme de refus signé ; un dépositaire
garde la faculté de refuser à tout instant, que le contrôle ait eu lieu ou non.
Les demandes transmises déjà autorisées — export de relai (autorisé dans la base de données du concours)
ou `node stage-request` (l'organisateur de qualification valant autorisation) — ne requièrent aucune
seconde décision.

**Organisateurs : pré-chargez les images de base sur les machines airgap.** Parce que la construction d'image s'exécute avec `--network=none`, l'image de base `FROM` du Dockerfile doit déjà être dans le magasin d'images local de la machine. Sur une machine connectée, `docker pull python:3.11-slim && docker save -o base.tar python:3.11-slim` ; transportez `base.tar` avec le bundle ; sur la machine airgap, `docker load -i base.tar` avant d'exécuter `mt-eval node run-method`. Mettez-vous d'accord sur la ou les images de base avec les participants dans vos matériaux de concours publiés.

## Étape 10 — Classer, clôturer, exporter

Les résultats constitués de scores seuls sont diffusés sur le [classement](/docs/network/leaderboard/rules)
au même titre que toute autre exécution, sous la mention d'évaluations sur jeu scellé. Le classement
propre au concours relève de votre responsabilité pour l'établissement, le gel et la publication :

```bash
mt-eval contest open-intake <contest-id>     # entry intake on — submit-model / submit-method admitted (owner only)
mt-eval contest close-intake <contest-id>    # intake off — work already received still scores
mt-eval contest rank <contest-id> --json     # provisional ranking, any time
mt-eval contest close <contest-id>           # one-way: freezes the ranking, shuts intake
mt-eval contest export <contest-id> --format csv --out results.csv
```

Fonctionnement de `rank`, afin de pouvoir l'expliciter dans vos règles : les soumissions sont classées selon la
**métrique principale enregistrée** pour le concours (`--primary-metric` à l'initialisation ; chrF++
par défaut), puis selon la séquence chrF++ → BLEU → COMET → date de soumission la plus ancienne. L'évaluation est
**limitée aux résultats vérifiés par défaut** — les fiches d'exécution issues du nœud —, avec décompte
des éventuelles fiches auto-déclarées masquées. Chaque paire contiguë affiche une décision
d'égalité formelle : test de significativité par paires au niveau du segment si les enregistrements segmentaires existent,
sinon **chevauchement de l'intervalle de confiance à 95 %**, sinon égalité exacte des scores.
**Un concours scellé ne publiant jamais de données segmentaires** (agrégats seuls, par
conception), le test apparié s'exécute directement sur votre nœud. Avant de clôturer, exécutez
`mt-eval node verdicts --contest <id> --out verdicts.json` sur le nœud ; la commande
génère exclusivement des décisions signées (par paire : valeur p, écart de score, intervalle,
nombre de segments — aucun extrait textuel). Procédez ensuite à la clôture avec `--node-verdicts verdicts.json
--verify-key <the node's .pub.json>`. Sans verdicts fournis, l'arbitrage des égalités repose sur le chevauchement
des IC. Dans les deux cas, le résultat détaille les éléments justificatifs retenus, et les systèmes à égalité
partagent le même rang (`1, 1, 3`).

L'action `close` est irréversible. Elle établit le classement sur la métrique définie, refuse
d'opérer tant que des évaluations sont en cours (sauf recours à l'option de force), vous soumet
la grille pour confirmation, puis fige le classement dans les données du concours. `export`
restitue ce classement gelé à l'identique, aux formats JSON ou CSV, pour vos bilans ou votre
page de résultats. Les fiches évaluées sur tout autre jeu (jeu T2 totalement secret, fiche
égarée du jeu de dev) sont répertoriées à part et ne sont jamais intégrées au classement principal.

### Déterminer le calendrier d'apparition des résultats

Deux engagements pris lors de la configuration initiale ne peuvent être modifiés discrètement par la suite — la
base de données verrouille l'un et l'autre dès la première soumission reçue :

```bash
mt-eval contest create … \
  --results-visibility hidden_until_close \   # no score is visible while the contest runs
  --anonymize-until-close                     # pseudonyms in YOUR ranking artifacts
```

**`--results-visibility hidden_until_close` constitue le mécanisme effectif de masquage
d'un score.** Lorsqu'elle est active, chaque fiche évaluée par votre nœud est retenue au lieu d'être
publiée : la méthode a bien été exécutée, l'autorisation a été consommée et la fiche
a été compilée, validée et archivée à l'identique — elle n'apparaît simplement pas sur le
tableau. `contest close` procède à la publication de chaque fiche retenue **en préalable**, avant d'établir
et de figer le classement, assurant qu'aucun résultat n'est omis et que l'état figé intègre
la totalité de vos évaluations. Cela s'applique également lors d'une clôture forcée : le forçage permet de statuer
sur des traitements en cours d'exécution, sans jamais autoriser la rétention d'un score contractuellement dû. Le relevé
figé détaille très précisément les résultats publiés à l'occasion de la clôture.

L'état retenu constitue un **état consigné et non une exécution abandonnée** : la fiche conservée ne peut être
altérée, et l'indicateur pointant vers son lieu de diffusion est immuable dès son écriture — ces
deux garanties étant verrouillées en base de données pour tout client. Durant toute la durée du
concours, `rank` vous indique le volume de résultats actuellement retenus, garantissant
qu'un classement intermédiaire ne puisse être confondu avec un résultat définitif.

**`--anonymize-until-close` remplit un rôle plus restreint qu'il convient de cerner précisément.**
Cette option substitue des pseudonymes déterministes aux noms des participants dans *vos*
documents de restitution — le tableau `rank`, son exportation JSON, le CSV — tant que le concours
reste ouvert, `close` se chargeant de lever l'anonymat. Elle **n'anonymise pas**
le classement public : toute fiche publiée mentionne l'auteur déclaré lors de la soumission.
Pour empêcher les participants de découvrir leurs résultats respectifs avant la fin des épreuves,
activez `--results-visibility hidden_until_close` ; la présente option ne saurait s'y substituer.

Dès lors qu'une méthode satisfait aux exigences de seuil publiées à l'Étape 6 —
notamment la [validation par des locuteurs](/docs/network/specifications/speaker-validation),
qui relève d'une décision de votre communauté et non d'un traitement automatisé —, il vous revient,
à **vous** (ou à votre structure fiduciaire), d'attribuer le prix conformément aux conditions publiées. Le rôle
de Champollion se limite strictement à la mesure technique.

---

## Ce que vous gardez, pour toujours

- **Le corpus.** Il n'a jamais quitté votre infrastructure. Prenez le texte chiffré hors ligne et l'ensemble scellé cesse simplement d'être exécutable.
- **Les clés.** L'accès meurt quand vos dépositaires cessent de l'accorder.
- **L'argent.** Il n'était jamais ailleurs.
- **Le dossier.** Le résumé de la tête du journal d'audit est publiable, donc l'historique de qui a exécuté quoi contre votre corpus ne peut pas être silencieusement réécrit — par n'importe qui, y compris nous.

Pour le langage des conditions que vous pouvez adapter — propriété, licence de scores uniquement et une visite explicite des façons dont un concours peut être attaqué — voir [Modèles de conditions](/docs/network/sovereignty/terms-templates).
