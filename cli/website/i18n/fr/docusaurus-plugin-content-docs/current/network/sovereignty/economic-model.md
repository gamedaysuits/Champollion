---
sidebar_position: 3
title: "Comment le travail est financé"
---

# Comment le travail est financé

> **Résumé exécutif.** Champollion est un projet de recherche non commercial —
> dont le code source est disponible et gratuit pour un usage non commercial, son harnais d'évaluation et
> ses registres étant open source — et il est aujourd'hui **entièrement autofinancé par son
> fondateur**. Aucune subvention,
> aucun sponsor, aucune institution ne le soutient — pour le moment : nous [recherchons désormais activement
> des sponsors](/get-involved#sponsors). Chaque dollar de parrainage est
> **reversé à 100 %** : il finance la constitution de corpus, l'outillage et le travail communautaire
> à des tarifs publiés et justifiés publiquement — rien ne revient à Champollion.
> Rien n'est monétisé ici : il n'y a pas d'API payante, pas de facturation à l'usage, pas de partage de revenus,
> et aucune revendication de la plateforme sur ce qu'une communauté possède. Cette page explique
> clairement d'où vient l'argent actuellement, ce que les financements permettraient d'acquérir, et comment
> nous contacter si vous souhaitez changer la première partie.

Champollion est un outillage de recherche et développement en traduction automatique —
dont le code source est disponible et gratuit pour un usage non commercial. La CLI est sous licence PolyForm
Noncommercial 1.0.0 (l'utilisation commerciale nécessite une autorisation), le harnais
d'évaluation est open source sous AGPL-3.0, et les registres de données sont open source
sous Apache-2.0. Il n'y a aucun produit commercial derrière eux — et aucun financement
pour le moment non plus.

## D'où vient l'argent actuellement

**Une personne.** Tout ce qui a été construit jusqu'à présent — l'harnais,
l'interface de ligne de commande, l'index des langues, les spécifications de
référence, le site — a été autofinancé par le fondateur du projet. Nous le
disons clairement pour deux raisons :

1. **Honnêteté sur l'échelle.** Un projet autofinancé ne peut pas encore payer
   la construction de corpus et la validation par les locuteurs que les
   spécifications exigent. Les tarifs publiés sont des engagements sur la
   *façon* dont l'argent circule quand il existe, non une preuve qu'il circule
   déjà.
2. **C'est une invitation ouverte.** L'infrastructure est construite et les
   coûts unitaires sont publiés. Ce qui manque, c'est le financement pour la
   faire fonctionner. Si vous financez la technologie des langues — en tant
   qu'agence de subvention, fondation, département ou individu — **nous
   aimerions vous entendre** : ouvrez un problème sur
   [GitHub](https://github.com/gamedaysuits/Champollion) ou contactez-nous
   via [champollion.dev](https://champollion.dev).

## Ce que le financement achète

Les coûts sont déjà spécifiés, donc un bailleur de fonds peut acheter des
choses concrètes et délimitées :

- **Un engagement de corpus pour une langue** — 2 500–6 000 $ en rémunération
  des locuteurs (50–65 CAD/heure, tarifs publiés) construit un corpus de
  référence qui reste la propriété du constructeur. Voir
  [Comment les locuteurs sont rémunérés](/docs/network/perspectives/how-speakers-get-paid).
- **Un cycle de validation de métrique** — 1 475–1 920 $ paie trois locuteurs
  bilingues pour vérifier les métriques automatisées par rapport au jugement
  humain.
- **Un prix parrainé** — financez une barre ciblée (par exemple, traduction
  fiable anglais → cri des Plaines). Les fonds de prix sont détenus et
  attribués par une fiducie gouvernée par la communauté, selon les conditions
  de la communauté — non par Champollion. Voir la
  [Spécification des prix](/docs/network/specifications/prizes).
- **Crédits de calcul et d'API** — mis en commun pour exécuter la file d'attente
  de référence publique.

En pratique, cela fait du Réseau un mécanisme de distribution de financement
pour le travail sur les données linguistiques : l'argent entre, le travail
rémunéré pour les personnes construisant les corpus sort — et elles conservent
ce qu'elles construisent.

## Où va l'argent

- **Aux constructeurs et validateurs de corpus, aux tarifs publiés.** Le
  paiement ne transfère pas la propriété : un constructeur est payé pour le
  travail *et* reste le gestionnaire du corpus.
- **Aux gagnants de prix, par le biais de fiducies communautaires.** Quand un
  prix parrainé est remporté, la fiducie paie le développeur ; la méthode est
  transférée à la communauté selon les conditions de ce prix (voir
  [Propriété et conditions](/docs/network/sovereignty/ownership-transfer)).
- **À l'infrastructure** — hébergement, exécutions d'évaluation et maintenance.
- **Comptabilisé publiquement.** Les engagements parrainés sont enregistrés
  ouvertement — ce qui a été financé, au tarif publié, et ce qui a été livré —
  afin qu'un parrain (et tout le monde) puisse vérifier que la promesse de
  transfert a été tenue.

## Ce que Champollion prélève

**Rien.** Il n'y a pas de partage de revenus, pas de pourcentage
d'infrastructure, et aucune revendication sur les actifs communautaires. Si une
communauté déploie une méthode qu'elle possède — sur ses propres serveurs, par
ses propres canaux, commercialement ou non — tout ce qu'elle gagne lui
appartient. Les corpus enregistrés auprès du Réseau restent la propriété du
gestionnaire, avant, pendant et après toute évaluation.

Si des opportunités commerciales émergent autour de ce travail, nous sommes
ouverts à cette conversation — mais tout arrangement de ce type serait négocié
à ce moment-là, avec les gestionnaires dont les données ou méthodes sont
impliquées, selon leurs conditions. Rien n'est préengagé dans ces documents, et
aucun document ici ne doit être lu comme réservant une part de quoi que ce soit
pour la plateforme.

## Pour les bailleurs de fonds

La question de la durabilité pour la technologie des langues est généralement
« que se passe-t-il après la fin de la subvention ? » Pour un projet non
commercial, la réponse honnête est : les *actifs* survivent au financement,
parce qu'ils sont possédés par les personnes qui peuvent les maintenir.

| Modèle traditionnel | Modèle de gérance |
|---|---|
| La subvention finance la recherche | La subvention finance la recherche |
| Article publié | Corpus construit, méthodes mesurées |
| La subvention se termine, l'outil est abandonné | La communauté possède le corpus et toute méthode transférée |
| La communauté ne reçoit rien | Les locuteurs ont été payés pour chaque heure ; les actifs restent à la maison |

Résultats mesurables pour un bailleur de fonds :

- Corpus construits et enregistrés, sous contrôle du gestionnaire
- Heures de locuteurs rémunérées livrées aux communautés linguistiques
- Méthodes mesurées, et (où les conditions du prix le prévoient) transférées à
  la propriété communautaire
- Paires de langues couvertes par des références publiques fiables

Voir la [Spécification de référence](/docs/network/specifications/benchmark),
§10 pour les modèles de coûts détaillés.

## Voir aussi

- [Propriété et conditions](/docs/network/sovereignty/ownership-transfer) —
  conditions par langue et modèle de transfert
- [Gérance des données](/docs/network/sovereignty/data-sovereignty) — la
  position que ce modèle met en œuvre
- [Comment les locuteurs sont rémunérés](/docs/network/perspectives/how-speakers-get-paid)
  — tarifs publiés
