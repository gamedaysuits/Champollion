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

- ✅ **En production :** l'enregistrement du corpus (fiches de métadonnées, épinglage de hachage, voies d'exposition), le registre des ensembles scellés (empreinte + groupe de gardiens + qualificateur, sans contenu), le mécanisme de concours avec la voie scellée, la couche de données de demande/octroi/audit d'autorisation (en attente → décision M-sur-N → octroi à usage unique limité dans le temps, journal d'audit en ajout seul chaîné par hachage), et l'émission de scores uniquement, appliquée au niveau de la couche de base de données.
- ✅ **En production : le nœud d'évaluation de l'organisateur + la voie des hypothèses.** Une seule commande divise votre corpus en un ensemble de développement public (le qualificateur), un ensemble de test à l'aveugle (source publiée, références scellées au repos sur VOTRE machine), et optionnellement un ensemble entièrement secret (`mt-eval contest prepare`). L'enregistrement du ou des ensembles scellés, du qualificateur et du concours est **en libre-service depuis votre propre connexion** — `contest prepare --self-serve`, ou `mt-eval contest register --manifest` pour un concours que vous avez préparé plus tôt — chaque ligne étant liée à une identité au niveau de la couche de base de données ; aucun curateur dans la boucle et aucune clé privilégiée (voir l'Étape 4 pour les limites honnêtes). Les participants soumettent leurs traductions avec `mt-eval contest submit-hypotheses` (l'interface en ligne de commande évalue elle-même l'ensemble de développement localement et refuse les téléversements inférieurs à votre seuil) ; VOTRE nœud auto-hébergé (`mt-eval node serve`) réévalue lui-même les preuves de développement, filtre selon le qualificateur, autorise selon le modèle de votre concours (`per-submission` — un gardien approuve chaque évaluation — ou `blanket` / `open`), évalue l'ensemble à l'aveugle par rapport à des références qui ne quittent jamais votre machine, et publie des fiches d'exécution **uniquement agrégées**. Ce que cette voie NE prouve PAS : que la méthode nommée a produit les hypothèses (l'identité de la méthode est déclarée par le participant et étiquetée comme telle sur chaque fiche d'exécution), et elle ne peut pas empêcher un adversaire déterminé d'extraire le signal de référence à travers de nombreuses soumissions distinctes — les limites de débit, la déduplication identique à l'octet près et la chaîne d'audit ralentissent cela ; la voie d'exécution de méthode ci-dessous est la véritable solution.
- ✅ **En production : deux voies de méthode pour ensemble secret.** Les participants ayant un enregistrement publié dans la voie des hypothèses peuvent proposer leur méthode contre votre ensemble secret. Le nœud choisit la voie à partir de la soumission :
  - **Voie A — modèle déclaratif (préféré).** Un modèle neuronal standard est une DONNÉE : `mt-eval contest submit-model` envoie des poids safetensors + un tokeniseur déclaratif + une configuration — **aucun code, aucun Dockerfile.** Votre nœud valide qu'il est sans code (safetensors et non pickle ; aucun `trust_remote_code`/`auto_map` ; uniquement des fichiers de données) et exécute les poids dans son PROPRE moteur de confiance (`transformers`, `trust_remote_code=False`, hors ligne). L'architecture est permissive par défaut (toute architecture que votre moteur charge nativement) ; un hôte prudent peut épingler une liste d'autorisation. Rien de non fiable ne s'exécute, il n'y a donc rien à mettre en bac à sable (sandbox). Publié `declarative-model`, identité de la méthode **sans code par construction**.
  - **Voie B — paquet exécutable (solution de repli en bac à sable).** Pour les méthodes qui SONT du code : `mt-eval contest submit-method` envoie un Dockerfile + un point d'entrée (entrypoint). Après l'approbation de votre gardien, VOTRE nœud l'exécute à l'intérieur d'un conteneur isolé du réseau (`--network=none` — la pile réseau n'existe pas à l'intérieur ; racine en lecture seule, capacités supprimées, environnement assaini), avec des vérifications statiques automatisées au préalable et des références n'entrant jamais dans le conteneur. Publié `method-execution` avec une identité **vérifiée par l'exécution**.
  Dans l'une ou l'autre voie : le hachage du paquet est figé dans la demande d'autorisation (ce qui s'exécute est de manière prouvable ce qui a été proposé), et les scores sont publiés via le même chemin d'agrégats uniquement. Pour une isolation maximale, la machine d'évaluation peut être un véritable système isolé (airgap) : les demandes autorisées et les paquets de scores uniquement signés par Ed25519 transitent par des supports amovibles (`mt-eval node relay` / `import-bundle` / `export-scores`) — le texte secret n'atteint même jamais la machine connectée. Ce que ces voies n'incluent PAS encore : l'attestation matérielle du nœud (l'identité est auto-déclarée), un mécanisme formel de résolution des litiges, et — pour la Voie B spécifiquement — un durcissement plus profond du conteneur au-delà de la suppression de la pile réseau (profils seccomp, microVMs ; c'est une raison de préférer la Voie A). Voir [Limites honnêtes](/docs/network/honest-limitations).
- 🔲 **En développement : signature à seuil.** L'approbation des gardiens M-sur-N est *enregistrée* dans les tables d'autorisation et d'audit aujourd'hui ; l'outillage cryptographique de clé à seuil qui rend un octroi impossible à générer sans M parts n'est pas encore construit — la clé de scellement actuelle est un substitut étiqueté à paire de clés unique (`champollion seal-corpus keygen`), et la signature du paquet de scores en système isolé (airgap) est une clé de nœud unique (`seal-corpus sign-keygen`), et non une cérémonie de gardiens.
- ❌ **Inexistant, par conception :** L'hébergement de votre corpus, la détention de vos clés ou la détention des fonds de prix par Champollion. Les hypothèses des participants (leurs propres traductions) transitent par notre stockage ; le contenu de votre corpus ne le fait jamais.

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

- **docker ou podman** — requis pour la voie d'exécution des méthodes. Le nœud détecte automatiquement docker, puis podman ; si aucun n'est présent, il refuse bruyamment. Il n'y a **pas de solution de secours** — l'isolation des conteneurs avec `--network=none` est la garantie structurelle, donc rien ne s'exécute sans un runtime de conteneur.
- **Node.js 20.11+ et la CLI npm `champollion`** — le harnais ne réimplémente pas le chiffre de scellement. `champollion seal-corpus` (verbes : `keygen`, `seal`, `open`, `sign-keygen`, `sign`, `verify`) est la seule implémentation de chiffre (X25519-ECDH → HKDF-SHA256 → AES-256-GCM), et le nœud organisateur l'appelle.
- **Une configuration de nœud à `~/.mt-eval/node.json`.** Chaque commande `mt-eval node` refuse de démarrer sans une — exécutez l'une d'elles une fois et le message d'erreur indique le chemin de configuration et où se trouve le modèle (il est fourni dans la source du harnais, dans `mt_eval_harness/contest_node.py`). La configuration porte votre `node_id` auto-déclaré (lié dans chaque empreinte de requête) et une carte `contests` pointant vers vos références de développement et artefacts scellés.
- **Une connexion.** Il n'y a pas d'étape de création de compte séparée : la première commande qui a besoin d'une identité (par exemple `mt-eval contest prepare --self-serve` ou `mt-eval publish`) ouvre une connexion OAuth via navigateur via **GitHub ou Google** (Supabase Auth). L'e-mail de ce compte est l'identité à laquelle chaque ligne de registre est liée — utilisez-en une que votre organisation contrôle.
- **L'accélérateur d'admission.** Les soumissions des participants sont limitées en débit par soumetteur à **5 par 24 heures par défaut** (anti-sondage ; défini par concours avec `--intake-daily-limit` au moment de la préparation, ou comme défaut d'édition de tâche partagée). Budgétisez votre calendrier de concours en conséquence.

**Une mise en garde honnête sur l'enregistrement en libre-service.** Sur le **point de terminaison hébergé sur le réseau par défaut**, l'enregistrement en libre-service (`contest prepare --self-serve` / `contest register`) s'arrête actuellement à une garde de point de terminaison de production : la CLI refuse avec un message explicite plutôt que d'écrire dans le projet de production, en attente d'une décision politique sur l'ouverture de cette porte. Les hôtes fédérés (votre propre projet Supabase) ne sont pas affectés. Si vous rencontrez la garde sur l'hôte par défaut, c'est l'état actuel du monde, pas une mauvaise configuration de votre côté — [ouvrez un problème](https://github.com/gamedaysuits) et nous vous guiderons à travers l'enregistrement.

---

## Étape 1 — Construire votre corpus de test retenu

Concevez le corpus que vous mesurerez et gardez-le retenu dès le départ : rien dedans ne devrait jamais avoir été publié, posté ou partagé avec un fournisseur de modèle.

- Suivez le [Cadre de conception de corpus](/docs/network/specifications/corpus-design) pour la structure des entrées, les niveaux de difficulté et la couverture des registres, et le [Livre de recettes de création de corpus](/docs/network/tutorials/corpus-creation) pour l'outillage.
- Faites vérifier les entrées par des locuteurs courants avant le scellement — le [Protocole de validation des locuteurs](/docs/network/specifications/speaker-validation) décrit une structure d'examen que vous pouvez réutiliser pour l'assurance qualité du corpus, pas seulement l'examen de méthode.
- Décidez maintenant de l'étiquette de **version** du corpus (par exemple `v1`). Les octrois d'autorisation sont liés à une version spécifique, donc le versioning fait partie du modèle de sécurité, pas de la tenue de registres.

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

Le manifeste reste sur votre machine — l'enregistrement n'envoie que les identifiants sans contenu, les résumés et les seuils. Chaque ligne de registre est **liée à l'identité** : la base de données enregistre le compte connecté qui l'a enregistré et gèle cette liaison contre les modifications ultérieures, et un qualificateur ne peut gater un ensemble scellé que de la **même** identité enregistrée. Les ensembles scellés naissent en quarantaine (ils ne peuvent jamais soutenir un concours ordinaire ou se classer sur le classement public), les qualificateurs naissent dans un état sûr, et l'enregistrement est limité en débit — tout appliqué par des déclencheurs de base de données sous chaque client, y compris le nôtre. Le registre lui-même est lisible publiquement, vous pouvez donc vérifier que votre entrée dit exactement ce que vous avez scellé — et rien de plus.

**Limites honnêtes.** La porte en libre-service est l'enregistrement uniquement (insertion uniquement au niveau de la base de données). **La rotation du qualificateur et la retraite de l'ensemble scellé restent médiées par le conservateur** — ouvrez un problème ou contactez le projet via [GitHub](https://github.com/gamedaysuits). Et exécuter le nœud de notation de l'organisateur dans les étapes ultérieures (avancées du cycle de vie, octrois d'autorisation, opérations d'audit) est un couloir séparé accrédité par service sur votre propre nœud — le libre-service s'arrête au dossier public.

## Étape 5 — Choisir les dépositaires et la règle M-sur-N

Choisissez les personnes ou institutions qui doivent conjointement approuver chaque évaluation contre votre corpus, et le seuil (par exemple **3 sur 5**). Les dépositaires doivent être responsables envers votre communauté, pas envers Champollion — voir [Intendance des données](/docs/network/sovereignty/data-sovereignty) et [Propriété et conditions](/docs/network/sovereignty/ownership-transfer) pour savoir comment les conditions par communauté sont définies.

**Boîte d'honnêteté :** l'outillage de cryptographie de seuil (partages de clés tels qu'une subvention ne peut littéralement pas être frappée sans M signatures) est **en développement**. Aujourd'hui, la règle M-sur-N est appliquée en tant que processus enregistré : chaque demande d'accès entre dans une file d'attente **en attente**, les décisions des dépositaires sont enregistrées, une subvention est frappée uniquement pour une demande autorisée, chaque subvention est **à usage unique, limitée dans le temps et liée à un empreinte digitale spécifique (méthode, version de corpus, nœud d'évaluation)**, et chaque événement — y compris les tentatives bloquées — atterrit dans un **journal d'audit en ajout seul, chaîné par hachage et lisible publiquement**. La base de données refuse les transitions d'état illégales sous chaque client et clé. Ce qu'elle ne peut pas refuser, c'est un compromis de l'opérateur de plateforme lui-même — c'est ce que la signature de seuil ferme, et jusqu'à ce qu'elle soit livrée, vous devriez traiter « Champollion détient zéro partages de clés » comme l'objectif de conception en cours de construction, pas une propriété que vous pouvez vérifier aujourd'hui.

## Étape 6 — Définir le prix

Décidez et publiez avec le concours :

- **Montant et devise.**
- **Parrain** — qui met l'argent.
- **Où les fonds se trouvent** — le compte de votre organisation ou une fiducie que vous désignez. **Champollion ne détient jamais, ne bloque jamais ou n'achemine jamais les fonds de prix.** Publier l'identité du détenteur à l'avance est ce qui rend le prix crédible ; voir la [note de risque par défaut du parrain](/docs/network/sovereignty/terms-templates#trojan-horse-risks) dans les modèles de conditions.
- **Conditions de seuil** — la barre de score qu'une méthode doit franchir, écrite selon la [Spécification de prix](/docs/network/specifications/prizes) : seuils de métrique, exigences de validation des locuteurs, reproductibilité. Rendez les conditions d'attribution vérifiables à partir des scores publiés, afin que personne n'ait à vous faire confiance (ou à nous faire confiance) pour savoir si la barre a été franchie.

## Étape 7 — Créer le concours

Les concours sur des ensembles scellés utilisent le **couloir scellé** explicite. L'admissibilité est défaillante fermée : le concours est refusé à moins que votre enregistrement d'ensemble scellé existe et soit actif — et créer le concours n'accorde à **personne** aucun accès au corpus.

```bash
mt-eval contest create \
  --name "EN→CRK Community Challenge 2026" \
  --corpus sealed-eng-crk-v1 \
  --language-pair "en>crk" \
  --visibility public \
  --use-context non-commercial \
  --description "Community-custodied held-out set; scores-only; prize held by <your org/trust>."
```

*(La valeur `--corpus` est votre `sealed_set_id` enregistré. Le couloir scellé est sélectionné **automatiquement** à partir de l'enregistrement d'ensemble scellé — aucun drapeau supplémentaire ; un ensemble scellé ne peut jamais soutenir un concours ordinaire, et un ensemble en quarantaine ordinaire ne peut jamais soutenir aucun concours. Les deux règles sont appliquées dans la base de données, sous chaque client. Si vous avez enregistré à l'étape 4 avec `contest register` ou `prepare --self-serve`, la ligne de concours **existe déjà** — ignorez cette étape ; `contest create` à la main est uniquement pour assembler un concours à partir d'un ensemble scellé déjà enregistré.)*

## Étape 8 — Les méthodes se qualifient d'abord en public

Les développeurs construisent et notent leurs méthodes sur des corpus **publics** pour votre paire de langues — le chemin normal [soumettre une méthode](/docs/network/getting-started/submit-a-method). Le `current_qualifier_id` de votre ensemble scellé nomme la manche publique qu'une méthode doit franchir avant qu'une exécution scellée puisse même être demandée. Cela maintient la pression de sondage loin de votre corpus : personne n'obtient de viser l'ensemble scellé jusqu'à ce qu'il ait montré une performance réelle en ouvert.

:::note[Participants : sur quel point de terminaison votre concours se déroule-t-il ?]
Un concours **hébergé sur le réseau** ne nécessite aucune configuration — le point de terminaison par défaut que le harnais fournit porte la machinerie de concours (admission des hypothèses, la porte de qualification, les propositions de méthode), et `mt-eval contest submit-hypotheses` / `submit-method` fonctionnent directement.

Un concours **fédéré** — l'organisateur exécute la machinerie sur son propre projet Supabase, donc les soumissions ne transitent jamais par le nôtre — publie son point de terminaison avec les matériaux du concours. Exportez-le avant de soumettre :

```bash
export MT_EVAL_SUPABASE_URL=https://<contest-host>.supabase.co
export MT_EVAL_SUPABASE_ANON_KEY=<contest-anon-key>
```

Si l'harnais pointe vers un point de terminaison qui n'a pas la machinerie de concours (par exemple, un hôte fédéré manquant une migration), la commande s'arrête avec *« le couloir de concours n'est pas encore disponible sur ce point de terminaison Supabase »* et vous indique le point de terminaison auquel il parlait. (Organisateurs fédérés : publiez ces deux valeurs à côté de votre version de corpus, `--node-id`, et `--corpus-version`.)
:::

## Étape 9 — Exécutions scellées : demander, autoriser, exécuter, scores sortent

Pour chaque méthode admissible :

1. Une **demande** est déposée contre votre ensemble scellé — elle entre `pending` et porte une empreinte digitale immuable de (hachage de tarball de méthode, identifiant de corpus, version de corpus, `scores-only`, mesure de nœud d'évaluation).
2. Vos **dépositaires décident** (M-sur-N). L'approbation frappe une **subvention** : à usage unique, expirant, valide uniquement pour cette empreinte digitale exacte.
3. L'évaluation s'exécute dans le bac à sable isolé du réseau sur **votre** nœud (`mt-eval node run-method`) : vérifications statiques automatisées, un conteneur sans pile réseau, références tenues en dehors — ou, pour un isolement maximal, sur une vraie machine isolée de l'air avec des paquets de scores uniquement signés traversant par support amovible (voir la boîte d'état ci-dessus pour ce qui est et n'est pas couvert).
4. **Seuls les scores sortent.** La règle d'émission `scores-only` est épinglée au niveau de la base de données ; le texte par entrée de votre corpus n'est jamais publié.
5. Chaque étape — demande, votes, subvention, utilisation et toute tentative bloquée — est ajoutée au journal d'audit public, chaîné par hachage que vous (et n'importe qui) pouvez rejouer.

## Soumettre une méthode (pour les participants) — deux voies

La plupart des soumissions de traduction automatique neuronale (NMT) ne sont pas exotiques : un transformateur standard affiné (fine-tuned) et ses poids. Pour celles-ci, il existe une **voie préférée, sans code** — et une solution de repli en bac à sable (sandbox) pour les méthodes qui sont véritablement du code.

### Voie A — modèle déclaratif (préféré pour la NMT standard)

Si votre méthode est un modèle neuronal standard, vous la soumettez en tant que **données** — les poids, le tokeniseur et la configuration — et l'organisateur l'exécute dans son propre moteur d'inférence de confiance. **Aucun Dockerfile, aucun code, aucun bac à sable.** Étant donné que rien de ce que vous soumettez ne s'exécute, la vérification de sécurité de l'organisateur est une validation de format décidable au lieu d'essayer de prouver qu'un code arbitraire est sûr — une garantie strictement plus forte pour vous et pour le corpus.

```bash
mt-eval contest submit-model <contest-slug> \
  --model-dir ./my-model \          # config.json + model.safetensors + tokenizer.* at the ROOT
  --name "My NMT" --version 2.0 \
  --architecture MarianMTModel \    # must be on the organizer's trusted whitelist
  --method-class pipeline --paradigm neural-nmt \
  --developer "Your Name" --node-id <organizer-advertised-node-id> --agree
```

Les règles que votre paquet doit satisfaire (validées localement avant le téléversement, puis à nouveau par le nœud de l'organisateur) :

- **Les poids sont `safetensors`, jamais pickle.** Un `.bin`/`.pt`/`.ckpt` PyTorch est un pickle — du code arbitraire au chargement — et est refusé. Exportez vers `model.safetensors` (`safetensors` / `transformers` le font nativement).
- **Une architecture que le moteur de l'organisateur charge nativement.** Le `architectures` de `config.json` peut être n'importe quelle architecture implémentée par le `transformers` de l'hôte (Marian, NLLB/M2M100, mBART, T5, Pegasus, et bien d'autres) — les hôtes sont **permissifs par défaut**, car avec `trust_remote_code=False` la sécurité provient du format sans code, et non du nom de l'architecture (une architecture non prise en charge échoue simplement au chargement, n'exécutant rien). Un hôte prudent peut publier une liste d'autorisation. Aucun `auto_map`, aucun `trust_remote_code` — ceux-ci réintroduisent du code personnalisé en cachette et sont toujours refusés.
- **Un tokeniseur déclaratif** (`tokenizer.json` ou un `.model` `sentencepiece` + vocabulaire), et **uniquement des fichiers de données** — aucun `.py`/scripts/binaires dans le paquet.

L'organisateur l'exécute avec `trust_remote_code=False`, hors ligne, et seuls les scores sortent — publiés en tant que `declarative-model`, l'identité de la méthode étant **sans code par construction**. (Poids de plusieurs Go : utilisez `--bundle-out` pour la voie par transfert physique (sneakernet), comme ci-dessous.)

### Voie B — paquet exécutable (le bac à sable, pour les méthodes avec code)

Si votre méthode est véritablement du code — un pipeline, un modèle hybride assisté par LLM, un décodeur personnalisé — elle ne peut pas être exécutée de manière déclarative, elle passe donc par le bac à sable isolé du réseau. Il s'agit de la voie honnêtement plus faible (elle contient du code non fiable plutôt que de refuser de l'exécuter), utilisez donc la Voie A chaque fois que votre méthode est un modèle standard.

**Le contrat du bundle exécutable est stdin/stdout.** Votre bundle déclare un point d'entrée (par exemple `method/translate.py`). À l'intérieur du conteneur, le nœud de l'organisateur exécute exactement :

```
cat /eval/source.txt | <your entrypoint> > /output/translations.txt
```

Les phrases source arrivent une par ligne sur stdin ; vous écrivez une traduction par ligne sur stdout. Tout ce que vous avez passé comme `--method-dir` est emballé sous `method/` dans le bundle et monté **en lecture seule à `/method`** au moment de l'exécution — poids inclus, pas besoin de copier dans l'image. Le conteneur n'a pas de pile réseau (`--network=none`), une racine en lecture seule, et un `/tmp` inscriptible.

**Un wrapper transformers Hugging Face minimal :**

```python title="method/translate.py"
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
RUN pip install --no-index --find-links=/wheels torch transformers sentencepiece
# Weights are NOT copied — /method is mounted read-only at run time.
```

Soumettez-le avec :

```bash
mt-eval contest submit-method <contest-slug> \
  --method-dir ./my-method --dockerfile ./Dockerfile \
  --name "My NMT" --version 1.0 \
  --entrypoint method/translate.py \
  --method-class pipeline --paradigm neural-nmt \
  --developer "Your Name" --node-id <organizer-advertised-node-id> \
  --agree
```

(Vous avez besoin d'un enregistrement de voie d'hypothèses publié pour le concours d'abord — la porte T1 de l'étape 9 — et `--agree` reconnaît les conditions de soumission de méthode.)

**Poids multi-GB : utilisez la voie sneakernet.** Le chemin d'admission hébergé télécharge votre tarball en tant que **POST unique** vers le stockage de l'hôte de concours, il est donc limité par la limite de téléchargement de stockage de cet hôte — bien pour le code et les petits modèles, pas pour les points de contrôle multi-GB. Le contrat du bundle lui-même permet des artefacts beaucoup plus volumineux (tarballs jusqu'à 100 GB, images construites jusqu'à 150 GB). Pour les gros poids, ignorez le téléchargement hébergé :

```bash
# Package + write an exchange directory, no upload:
mt-eval contest submit-method … --offline --bundle-out ./exchange \
  --secret-set <sealed-set-id> --pair eng>crk --developer-email you@example.org
```

Le répertoire d'échange se déplace vers l'organisateur par média amovible (ou tout canal en lequel vous avez tous les deux confiance) ; ils l'ingèrent avec `mt-eval node import-bundle`. Le SHA-256 du bundle est gelé dans la demande d'autorisation de toute façon, donc ce qui s'exécute est prouvablement ce que vous avez proposé.

**Organisateurs : pré-chargez les images de base sur les machines airgap.** Parce que la construction d'image s'exécute avec `--network=none`, l'image de base `FROM` du Dockerfile doit déjà être dans le magasin d'images local de la machine. Sur une machine connectée, `docker pull python:3.11-slim && docker save -o base.tar python:3.11-slim` ; transportez `base.tar` avec le bundle ; sur la machine airgap, `docker load -i base.tar` avant d'exécuter `mt-eval node run-method`. Mettez-vous d'accord sur la ou les images de base avec les participants dans vos matériaux de concours publiés.

## Étape 10 — Publier les scores, attribuer selon votre seuil publié

Les résultats de scores uniquement publient au [classement](/docs/network/leaderboard/rules) comme n'importe quelle autre exécution, marqués comme évaluations d'ensemble scellé. Si une méthode franchit les conditions de seuil que vous avez publiées à l'étape 6 — y compris [validation des locuteurs](/docs/network/specifications/speaker-validation), qui est la porte de votre communauté, pas une porte automatisée — **vous** (ou votre fiducie) attribuez le prix, selon vos propres conditions publiées. Le rôle de Champollion s'arrête à la mesure.

---

## Ce que vous gardez, pour toujours

- **Le corpus.** Il n'a jamais quitté votre infrastructure. Prenez le texte chiffré hors ligne et l'ensemble scellé cesse simplement d'être exécutable.
- **Les clés.** L'accès meurt quand vos dépositaires cessent de l'accorder.
- **L'argent.** Il n'était jamais ailleurs.
- **Le dossier.** Le résumé de la tête du journal d'audit est publiable, donc l'historique de qui a exécuté quoi contre votre corpus ne peut pas être silencieusement réécrit — par n'importe qui, y compris nous.

Pour le langage des conditions que vous pouvez adapter — propriété, licence de scores uniquement et une visite explicite des façons dont un concours peut être attaqué — voir [Modèles de conditions](/docs/network/sovereignty/terms-templates).
