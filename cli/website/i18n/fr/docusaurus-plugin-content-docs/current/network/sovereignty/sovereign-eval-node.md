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

:::info[Ce qui est disponible aujourd'hui vs ce qui est indiqué comme étant en cours]
Le logiciel du nœud organisateur (préparation du concours, réception des hypothèses, notation conditionnée par un seuil, l'exécuteur de méthode isolé du réseau avec son import scan) **ships today** in `mt-eval` — see the
[guide du concours souverain](/docs/network/sovereignty/run-a-sovereign-contest). La **cérémonie des clés à seuil et le flux de travail scellé au repos de la section 4 sont également disponibles aujourd'hui** : `mt-eval node ceremony init|share|verify|restore`, `mt-eval node
seal`, les parts de quorum présentées au moment de l'exécution
(`node run-method --offline --share …`), un registre d'autorisation local chaîné par hachage (`node ledger verify|head`), les manifestes de scores signés
(`node sign-manifest` / `node verify-manifest`), et les outils Air-Gap des sections 2 et 3 (`node bundle`, `node manifest`, `node egress-check`). Le
substitut à paire de clés unique ne subsiste que pour les concours où l'organisateur
détient purement et simplement les références — chaque surface indique quelle voie est
utilisée. Pour être clair, ce que la v1 n'inclut **pas** : l'attestation matérielle à distance (TEE) n'est pas revendiquée (§5), et la *signature* à seuil côté plateforme (approbations téléphoniques des gardiens contre une infrastructure hébergée) est un
travail futur — sur un nœud souverain, la garde s'exerce en présentant physiquement
M parts sur N à la machine (§4). Et pour être précis concernant la
cryptographie : il s'agit du partage de secret de Shamir (M parmi N) avec la clé
**reconstruite dans la mémoire verrouillée du nœud lors d'une exécution autorisée**
(puis effacée) — ce n'est *pas* du calcul multiparti, et la clé
existe brièvement assemblée sur votre machine hors ligne. Enfin, jusqu'à ce que la
barrière de consentement de la communauté s'ouvre, la voie s'exécute **uniquement sur des données
synthétiques** ; les corpus réels attendent ce consentement.
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

1. Installez une version Linux LTS récente (Ubuntu/Debian) à partir d'un programme d'installation USB **avec
   le câble réseau débranché** ; activez le chiffrement complet du disque lors de l'installation.
2. Sur une machine distincte et connectée à Internet, créez le paquet hors ligne —
   `mt-eval node bundle --out <dir>` les wheels `mt-eval[node]` et ses
   dépendances, copiez tous les artefacts `--include`, et écrivez un manifeste sha256
   pour chaque fichier. Tout ce dont le nœud a besoin transite une seule fois sur le lecteur IN.
3. Transférez le paquet sur le lecteur IN ; vérifiez le sha256 de chaque artefact
   par rapport au manifeste **sur le nœud** avant l'installation
   (`mt-eval node bundle --verify <dir>`).
4. Créez la paire de clés de signature du nœud (`mt-eval node keygen`) et enregistrez
   sa moitié publique — vous la publierez afin que quiconque puisse vérifier vos manifestes de scores (§5).
5. À partir de ce moment, la machine ne voit plus jamais de réseau — et une exécution scellée peut
   être effectuée pour le prouver au préalable : `mt-eval node egress-check` (également appliqué
   automatiquement avec `assert_airgap` dans la configuration du nœud) refuse l'exécution lorsqu'une
   route, une sonde ou un DNS indique une quelconque voie de sortie. Les mises à jour du système d'exploitation sont un événement délibéré,
   regroupé et vérifié par hachage — et non un service en arrière-plan.

## 3. Discipline de transfert (à chaque concours, dans les deux sens)

L'Air-Gap est une *procédure*, pas un produit. La procédure :

- **Le lecteur IN** transporte : les paquets de méthodes soumis, les fichiers d'hypothèses et
  leur manifeste. Avant toute exécution, le nœud vérifie le hachage de chaque paquet par rapport au manifeste et l'analyse d'importation s'exécute (il refuse les méthodes
  qui importent des bibliothèques réseau — ceci est disponible aujourd'hui).
- **Le lecteur OUT** transporte : le manifeste de scores signé — les scores agrégés, les
  hachages de méthodes/configurations auxquels ils appartiennent, l'en-tête du journal d'audit — et *rien
  d'autre*. Les sorties par segment restent sur le nœud sous le contrôle de l'organisateur ;
  leur publication est une décision communautaire distincte et délibérée.
- Une seule direction par lecteur, pour toujours. Un lecteur qui a touché le nœud ne se monte jamais
  automatiquement sur une machine connectée — montez-le `noexec,nodev` et copiez
  le manifeste manuellement.
- `mt-eval node manifest write <drive> --direction in|out` hache chaque
  fichier sur le lecteur avant un passage ; `mt-eval node manifest verify`
  du côté de la réception refuse tout élément ajouté, modifié ou manquant.
- Consignez chaque passage (date, lecteur, hachage du manifeste) dans le journal papier ou
  sur le nœud. L'aspect fastidieux est voulu : le journal est ce qui vous permet de répondre
  avec des preuves à la question « est-ce que quelque chose d'autre est déjà sorti ? ».

## 4. Garde des clés (M parmi N, détenue par la communauté)

L'ensemble de test scellé est chiffré au repos ; le déchiffrement nécessite un quorum de parts de clés détenues par des gardiens **choisis par la communauté** — un conseil des Anciens, une autorité linguistique, un organisme éducatif. La plateforme ne détient aucune part ; Champollion ne peut pas déchiffrer un ensemble scellé, et aucun gardien ne le peut seul.

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

1. Annoncez le concours ; publiez la clé publique du nœud + le seuil de l'ensemble de développement.
2. Recevez les soumissions en ligne (machine ordinaire), assemblez le manifeste IN
   (`mt-eval node manifest write <drive> --direction in`).
3. Apportez le lecteur IN au nœud ; vérifiez les hachages (`node manifest verify`) ;
   import-scan (`node import-bundle`); queue methods.
4. Les gardiens autorisent l'exécution en présentant un quorum de parts (§4 —
   `node run-method <id> --offline --share … --share …`) ; l'ensemble scellé se
   déchiffre uniquement dans l'exécuteur. Pas de quorum, pas d'exécution — et la tentative
   est inscrite dans le registre.
5. Exécutez ; les scores sont calculés ; les sorties par segment sont conservées côté nœud.
6. Démantèlement : le texte clair de travail est effacé ; le journal d'audit est complété ; le manifeste est signé.
7. Ramenez le lecteur OUT ; publiez les scores + le manifeste ; n'importe qui peut vérifier
   (`node verify-manifest`).
8. Consignez le passage ; les lecteurs restent dédiés ; le nœud reste déconnecté.

