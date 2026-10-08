---
sidebar_position: 9
title: "Nœud d'évaluation souverain — Matériel et opérations air-gap"
description: "Matériel de référence, discipline air-gap et opérations de garde des clés pour l'exploitation d'un nœud d'évaluation contrôlé par la communauté : le jeu de test secret ne quitte jamais votre machine ; les méthodes viennent aux données."
related:
  - label: "Run a Sovereign Contest"
    to: /docs/network/sovereignty/run-a-sovereign-contest
    kind: doc
    note: "The organizer workflow this node runs"
  - label: "The Derived-Artifacts Commitment"
    to: /docs/network/sovereignty/derived-artifacts
    kind: doc
    note: "Who owns what comes out: you"
  - label: "Benchmark Specification §8 (sandbox)"
    to: /docs/network/specifications/benchmark
    kind: doc
    note: "The isolation model the executor implements"
---

# Nœud d'évaluation souverain — Matériel et opérations Air-Gap

Un nœud d'évaluation souverain est une machine que **vous** contrôlez, qui contient un ensemble de test secret et évalue les méthodes de traduction par rapport à celui-ci. Les méthodes voyagent vers les données ; les données ne voyagent jamais. Les scores — et uniquement les scores — en ressortent.

Cette page constitue la spécification pratique : quel matériel acheter (ou réutiliser), comment le configurer, et la discipline opérationnelle qui fait que « l'ensemble de test n'a jamais quitté la machine » soit un fait que vous pouvez défendre plutôt qu'une promesse à laquelle vous devez faire confiance.

:::info[Ce qui est disponible aujourd'hui vs. ce qui est indiqué en cours]
Le logiciel de nœud organisateur **est disponible dès aujourd'hui** dans `mt-eval` — voir le
[guide des concours souverains](/docs/network/sovereignty/run-a-sovereign-contest) :
préparation et scellement du concours, portail de qualification public **réexécuté par
le nœud lui-même sur chaque soumission avant que tout dépositaire ne soit invité à approuver
quoi que ce soit**, évaluation régie par seuil, et exécuteur de méthode isolé du réseau
avec son analyse des importations. Ce qu'un nœud accepte est un **modèle ou une méthode** — un
artefact qu'il peut exécuter. Le téléversement de traductions d'un jeu de test aveugle à source publique a été
abandonné comme modalité de soumission le 2026-09-06 et le verbe correspondant supprimé ; une
manche à source publique ne subsiste qu'en tant que diagnostic facultatif pour l'organisateur, et
les scores auto-déclarés ont leur place sur le classement public, qui est un tableau public
indexé par corpus et direction de paire plutôt qu'un concours.
La **cérémonie de clés à seuil et le flux de travail scellé au repos du §4 sont également disponibles
aujourd'hui** : `mt-eval node ceremony init|share|verify|restore`, `mt-eval node
seal`, parts de quorum présentées au moment de l'exécution
(`node run-method --offline --share …`), registre d'autorisation local en chaîne de hachage (`node ledger verify|head`), manifestes de scores signés
(`node sign-manifest` / `node verify-manifest`), et outillage d'isolation physique (*air-gap*) des §2–§3
(`node bundle`, `node manifest`, `node egress-check`). Les lots de scores
sont signés **sur le nœud, en Python** — le bundle hors ligne ne nécessite aucun
environnement d'exécution Node.js — et le même format de signature détachée se vérifie avec
l'une ou l'autre implémentation. La **préparation des requêtes côté organisateur est également disponible** :
`mt-eval node stage-request` écrit exactement la requête d'échange qu'un relais
en ligne écrirait, à partir d'un fichier de bundle et sans aucune base de données (pour une
répétition générale, ou un déploiement qui ne se connecte jamais), pré-validée comme l'importation
la validerait et liée à l'identifiant du nœud ; les scores renvoyés sont
vérifiables par manifeste mais ne sont pas publiés par relais, car aucun
enregistrement d'autorisation n'existe pour les publier. Le
substitut à paire de clés unique ne subsiste que pour les concours où l'organisateur
détient directement les références — chaque interface indique clairement quelle voie est
utilisée. Pour le dire simplement, ce que la v1 n'inclut **pas** : aucune attestation
matérielle à distance (TEE) n'est revendiquée (§5), et la *signature* à seuil
côté plateforme (approbations de dépositaires par téléphone sur une infrastructure hébergée) relève
de travaux futurs — sur un nœud souverain, la garde s'exerce en présentant physiquement
M parts parmi N sur la machine (§4). Et pour être précis quant à la
cryptographie : il s'agit d'un partage de secret de Shamir M parmi N dont la clé est
**reconstruite dans la mémoire verrouillée du nœud pendant une exécution autorisée**
(puis mise à zéro) — il ne s'agit *pas* de calcul multipartite (*MPC*), et la clé existe
bel et bien brièvement assemblée sur votre machine hors ligne. Enfin, jusqu'à ce que le
portail de consentement communautaire s'ouvre, la voie s'exécute uniquement sur des **données
synthétiques** ; les corpus réels restent en attente de ce consentement.
:::

## 1. Matériel de référence

L'exécuteur lance des méthodes autonomes : décodage NMT local, validation FST/morphologie, et calcul de métriques. Aucun appel cloud ne se produit à l'intérieur de l'Air-Gap (les méthodes LLM-API sont exactement la classe qu'un nœud Air-Gap refuse — voir les classes de méthodes de la [spécification du benchmark](/docs/network/specifications/benchmark)).

| Niveau | Spécifications | Convient pour | Coût approximatif (2026) |
|---|---|---|---|
| **Minimum** (fonctionnel) | 4 cœurs x86_64 ou Apple/ARM, 16 Go de RAM, SSD de 500 Go | Évaluation de métriques + FST, décodage CPU de petits modèles NMT (lent mais correct) | 0 $ US (un ordinateur portable de rechange) – 400 $ d'occasion |
| **Recommandé** | 8 cœurs, 32 Go de RAM, NVMe de 1 To, GPU NVIDIA ≥ 12 Go de VRAM (ex. classe RTX 4070) | Décodage NMT confortable pour des batteries de tests complètes ; évaluation de méthodes en parallèle | ~900 $–1 600 $ US (station de travail compacte) |
| **Institutionnel** | 16 cœurs, 64–128 Go de RAM, NVMe de 2 To, 24 Go+ de VRAM | Concours à méthodes multiples, grandes batteries, stockage d'archives chiffrées | ~2 500 $–4 000 $ US |

Exigences strictes à chaque niveau :

- **Aucune radio, ou des radios dont vous pouvez prouver qu'elles sont éteintes.** Idéal : un ordinateur de bureau sans carte Wi-Fi/Bluetooth. Acceptable : un ordinateur portable dont la carte sans fil est physiquement retirée ou désactivée dans le firmware. Le « mode avion » n'est pas un Air-Gap.
- **Une carte réseau filaire (NIC) que vous pouvez laisser débranchée.** L'absence du câble est le contrôle réseau le plus auditable qui soit.
- **Deux clés USB dédiées** (étiquetées IN et OUT — voir §3) et, idéalement,
  une machine dont vous désactivez les autres ports dans le firmware.
- **Chiffrement complet du disque** (LUKS sur Linux) pour qu'un nœud volé soit inutilisable, et
  un onduleur (UPS) si votre alimentation électrique n'est pas fiable — une évaluation interrompue au milieu d'une batterie
  est récupérable, mais pourquoi prendre le risque.

## 2. Configuration logicielle (une fois, ~une heure)

1. Installez une version LTS actuelle de Linux (Ubuntu/Debian) à partir d'un support d'installation USB **avec
   le câble réseau débranché** ; activez le chiffrement complet du disque à l'installation.
2. Sur une machine distincte, connectée à Internet et dotée du banc d'essai
   (`python3 -m pip install mt-eval-harness`, version 0.2.0 ou ultérieure), générez le bundle hors ligne.
   `mt-eval node bundle --out <dir>` effectue quatre opérations :
   - empaquète au format wheel le banc d'essai installé et ses dépendances (ou un wheel spécifique,
     avec `--wheel <file>`) ;
   - télécharge les bibliothèques cryptographiques conformément à la liste épinglée par hachage fournie
     au sein du banc d'essai ;
   - copie les éventuels artefacts `--include` ;
   - écrit un manifeste sha256 couvrant chaque fichier.

   Incluez les **fiches linguistiques** pour chaque langue que le nœud évaluera
   (`--include <cards-dir>`) : le nœud identifie la paire linguistique d'une exécution à partir d'un
   index local de fiches et n'en télécharge jamais aucune. Aucun des packages installés ne fournit
   de répertoire de fiches par langue ; générez-le donc ici avec la
   CLI `champollion`, un fichier `<code>.json` par langue (`champollion network card eng --json >
   node-cards/eng.json`, puis de même pour votre autre langue), et transmettez
   `--include node-cards`. Sur le nœud, il se place dans
   `<dir>/artifacts/node-cards` ; faites-y pointer `cards_dir`. Tout ce dont le nœud a besoin transite
   une seule fois par le disque IN. Construisez l'ensemble sur la même version de Python que celle qu'exécute le nœud
   (3.11 ou 3.12) ; la liste épinglée refusera toute autre version.
3. Transférez le bundle sur le disque IN ; vérifiez le sha256 de chaque artefact
   par rapport au manifeste **sur le nœud** avant de procéder à l'installation
   (`mt-eval node bundle --verify <dir>`). Puis installez uniquement à partir des
   wheels inclus dans le bundle :
   `python3 -m pip install --no-index --find-links <dir>/wheels 'mt-eval-harness[node]'`.
   L'extra `[node]` correspond à la bibliothèque `cryptography` dont `mt-eval node
   keygen` and the custody ceremony need; a plain `mt-eval-harness` est
   dépourvue à l'installation.
4. Créez la paire de clés de signature du nœud (`mt-eval node keygen`) et consignez
   sa moitié publique — vous la publierez afin que quiconque puisse vérifier vos manifestes
   de scores (§5).
   Le nœud requiert également **Docker** (ou Podman), qui exécute chaque méthode
   soumise dans un conteneur sans accès réseau ; si aucun des deux n'est présent dans le `PATH`,
   `mt-eval node run-method` s'interrompt avec une seule ligne nommant les deux, et la
   requête reste exécutable. Il requiert également une configuration de nœud dans
   `~/.mt-eval/node.json`. Ce fichier spécifie le nœud, son répertoire de fiches
   (`cards_dir`, ou `MT_EVAL_CARDS_DIR`), ainsi que les concours qu'il dessert.
   `mt-eval node init` génère une configuration initiale comportant chaque clé lue par
   un nœud d'évaluation, y compris le portail de qualification public (`qualifier` + `dev_corpus`,
   sur lequel le nœud réexécute chaque méthode avant d'ouvrir un ensemble scellé)
   et les emplacements du jeu d'exclusion scellé (`holdout_set_id` + `holdout_corpus` ;
   supprimez-les pour un concours sans jeu d'exclusion).
   `mt-eval node init --from-contest <out>` renseigne les valeurs du concours à partir
   du manifeste généré par `contest prepare` (la correspondance est détaillée dans le
   [guide des concours souverains](/docs/network/sovereignty/run-a-sovereign-contest#organizer-prerequisites)).
   Son bloc `sandbox` définit la politique de ressources du nœud (4 Go de RAM, 4 Go d'espace temporaire,
   30 minutes par exécution, pas de GPU), et `contest submit-method` déclare exactement
   ces valeurs par défaut : publiez donc vos limites avec le concours si vous
   les modifiez.
   Une configuration de nœud qui ne déclare que la moitié de ce portail est refusée au démarrage.
   `mt-eval node ledger verify` valide le fichier complété : il rejette la
   première valeur `<...>` restante ou tout fichier déclaré absent du nœud,
   affiche ce qu'il a vérifié, puis rejoue la chaîne de hachage du registre local. La
   machine connectée qui relaie les requêtes vers le nœud a également besoin de la
   **clé service-role** de la base de données (`MT_EVAL_SUPABASE_SERVICE_KEY`). Cette clé
   n'est jamais nécessaire sur le nœud isolé physiquement lui-même.
5. Dès lors, la machine n'a plus jamais accès à aucun réseau — et une exécution scellée peut
   être configurée pour le prouver au préalable : `mt-eval node egress-check` (également appliqué
   automatiquement avec `assert_airgap` dans la configuration du nœud) s'interrompt dès qu'une
   route, une sonde ou un DNS révèle une issue quelconque vers l'extérieur. Les mises à jour du système d'exploitation sont un événement
   délibéré, regroupé en bundle et vérifié par hachage — et non un service d'arrière-plan.

## 3. Discipline de transfert (à chaque concours, dans les deux sens)

L'Air-Gap est une *procédure*, pas un produit. La procédure :

- Le **disque IN** transporte : les bundles de méthodes ou de modèles soumis ainsi que leur
  manifeste. Avant toute exécution, le nœud vérifie le hachage
  de chaque package par rapport au manifeste et l'analyse des importations s'exécute (elle rejette
  les méthodes qui importent des bibliothèques réseau — ceci est disponible dès aujourd'hui).
- Le **disque OUT** transporte : le manifeste de scores signé — les scores agrégés, les
  hachages de méthode/configuration auxquels ils se rapportent, la tête du journal d'audit — et *rien
  d'autre*. Les sorties par segment restent sur le nœud sous le
  contrôle de l'organisateur ; leur publication constitue une décision communautaire distincte et délibérée.
- Une seule direction par disque, sans exception. Un disque qui a été connecté au nœud ne doit jamais
  être monté automatiquement sur une machine en ligne — montez-le avec `noexec,nodev` et copiez
  le manifeste manuellement.
- `mt-eval node manifest write <drive> --direction in|out` hache chaque
  fichier présent sur le disque avant un transfert ; `mt-eval node manifest verify`
  côté réception refuse tout élément ajouté, modifié ou manquant.
- Consignez chaque transfert (date, disque, hachage du manifeste) dans le registre papier ou
  sur le registre local du nœud. L'austérité est précisément le but : ce registre est ce qui vous permet de prouver,
  éléments à l'appui, si « quoi que ce soit d'autre a déjà quitté le système ».

## 4. Garde des clés (M parmi N, détenue par la communauté)

L'ensemble de test scellé est chiffré au repos ; son déchiffrement nécessite un quorum de
parts de clés détenues par des dépositaires **choisis par la communauté** — un
conseil des Aînés, une autorité linguistique, un organisme éducatif. Cette conception n'attribue
aucune part à la plateforme : ainsi, Champollion ne pourrait pas déchiffrer un ensemble scellé,
pas plus qu'aucun dépositaire ne le pourrait isolément. La cérémonie décrite ci-dessous n'a pas
encore été menée avec de véritables dépositaires.

La cérémonie (une session hors ligne ; les outils fournis l'automatisent) :
`mt-eval node ceremony init` génère la clé de l'ensemble sur le nœud, la divise
en N parts (n'importe quel M reconstruit ; moins ne révèle rien — le partage relève de la théorie de l'information), et efface la clé dans la foulée ; `ceremony share` émet la part de chaque gardien sous forme de fichier pour un jeton, plus une sauvegarde papier imprimable ; `ceremony verify` prouve que les copies distribuées se
reconstruisent — sans rien persister ; `ceremony share
--wipe-originals` then destroys the node's own copies. `mt-eval node
seal` chiffre le corpus avec la clé publique de la cérémonie : le nœud stocke
le texte chiffré et une carte de métadonnées sans contenu, rien d'autre. Dès lors,
exécuter une évaluation signifie que les gardiens présentent physiquement M parts sur N
(`node run-method --offline --share …`) : la clé est reconstruite **uniquement dans
la mémoire verrouillée de l'exécuteur**, utilisée pour cette seule exécution liée à l'autorisation,
et effacée — elle ne touche plus jamais le disque. Chaque requête, vote, autorisation et utilisation
est ajouté à un registre local chaîné par hachage (`node ledger verify`), et une
tentative sans quorum est refusée *et* enregistrée.

Une phrase honnête sur le mécanisme : il s'agit du partage de secret de Shamir
avec reconstruction dans la mémoire de la machine hors ligne détenue par la communauté —
et non d'un calcul multiparti. Lors d'une exécution autorisée, la clé existe brièvement,
assemblée, sur le matériel que la communauté contrôle physiquement ; les
propriétés qu'elle défend sont *aucune clé permanente sur le disque*, *aucune exécution sans la présence d'un quorum*, et *chaque utilisation chaînée dans le registre inspectable*.
La signature à seuil côté plateforme, où la clé ne s'assemble jamais nulle part,
reste un travail futur et est étiquetée comme tel partout où elle est mentionnée.

La rotation et le remplacement des gardiens relancent la cérémonie ; la perte de plus de
N−M parts signifie que l'ensemble est scellé à nouveau à partir de la copie source de la communauté —
la communauté conserve toujours son propre original en texte clair, car la
[possession](/docs/network/sovereignty/data-sovereignty) n'a jamais été la nôtre.

## 5. Ce que signifie « attesté » ici — et ce que cela ne signifie pas

Chaque évaluation produit un **manifeste de scores signé** : la signature du nœud
sur les scores, les hachages des paquets de méthodes, la somme de contrôle du corpus, et
l'en-tête du journal d'audit en ajout seul. Toute personne détenant la clé publique publiée du nœud
peut vérifier — `mt-eval node verify-manifest <manifest>
--pubkey <published .pub.json>` — que *ce nœud* a produit *ces scores*
pour *ces entrées exactes*, et le journal chaîné par hachage rend détectables les modifications silencieuses de l'historique.

Il s'agit d'une **attestation logicielle** — elle prouve l'intégrité de l'enregistrement, et
c'est ce que propose la v1. Elle ne prouve **pas** quel silicium a exécuté le traitement :
l'attestation matérielle à distance (TEE) est un travail futur et n'est délibérément pas
revendiquée. La déclaration de sécurité honnête pour la v1 : la discipline de l'organisateur
(§3) plus les manifestes signés plus la garde physique de la machine par la communauté
constituent l'ancre de confiance — ce qui est exactement là où une conception axée sur la souveraineté
souhaite que la confiance réside de toute façon.

## 6. La boucle opérationnelle

1. Annoncez le concours ; publiez la clé publique du nœud ainsi que le seuil sur le jeu de développement.
2. Recevez les soumissions en ligne (machine ordinaire), assemblez le manifeste IN
   (`mt-eval node manifest write <drive> --direction in`).
3. Transportez le disque IN jusqu'au nœud ; vérifiez les hachages (`node manifest verify`) ;
   import-scan (`node import-bundle`); queue methods. An entrant's offline
   la proposition arrive avec le statut *en attente*. Le nœud la vérifie d'abord (`node run-method
   <id> --offline` réexécute le filtre de qualification du candidat sur le jeu de développement public
   et vérifie l'environnement d'exécution de conteneur pour une soumission de code, n'ouvre aucun élément scellé, et
   enregistre la réussite dans le registre local). Ensuite, un dépositaire enregistre la décision
   sur le nœud (`node approve <id> --offline --actor <custodian>`, refusé
   tant que cette vérification n'a pas abouti, ou `node deny … --offline --reason …` : un vote
   + une autorisation dans le registre local ainsi qu'un enregistrement signé avec la clé du nœud ;
   `node list --offline` affiche les éléments en attente). L'exécution scellée (à nouveau via `node run-method
   --offline`) rejette toute proposition en attente tant que cette approbation n'est pas
   enregistrée et validée.
4. Les dépositaires autorisent l'exécution en présentant un quorum de parts (§4 —
   `node run-method <id> --offline --share … --share …`) ; l'ensemble scellé n'est
   déchiffré qu'au sein de l'exécuteur. Sans quorum, aucune exécution — et la tentative
   est consignée dans le registre.
5. Exécution ; les scores sont calculés ; les sorties par segment sont conservées côté nœud.
6. Clôture : le texte en clair de travail est purgé ; le journal d'audit est complété ; le manifeste est signé.
7. Rapportez le disque OUT ; publiez les scores et le manifeste ; chacun peut alors procéder à la vérification
   (`node verify-manifest`).
8. Consignez le transfert ; les disques restent dédiés ; le nœud demeure isolé du réseau.
