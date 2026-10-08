---
sidebar_position: 8
title: "Spécification du Prix"
slug: '/network/specifications/prizes'
related:
  - label: "Run a Sovereign Contest"
    to: /docs/network/sovereignty/run-a-sovereign-contest
    kind: guide
    note: "The self-serve path to running your own prize"
  - label: "How Speakers Get Paid"
    to: /docs/network/perspectives/how-speakers-get-paid
    kind: position
    note: "The plain-language version of these numbers"
  - label: "The Economic Model"
    to: /docs/network/sovereignty/economic-model
    kind: doc
  - label: "MT Evaluation Rules"
    to: /docs/network/leaderboard/rules
    kind: doc
  - label: "Submit a Method"
    to: /docs/network/getting-started/submit-a-method
    kind: guide
---

# Spécification des Prix

Un prix constitue le volet incitatif du principe « l'évaluation d'abord ». Une communauté ou un groupe de recherche prépare un ensemble d'évaluation restreint et scellé — quelques centaines de paires, chacune vérifiée (le [Partenariat de corpus](/docs/network/specifications/corpus-partnership) formalise ce flux de travail). Un sponsor propose un prix associé à un score cible sur cet ensemble. Dès cet instant, la langue devient un défi permanent : tout concepteur de méthode au monde peut tenter de le relever, le classement mesure chaque tentative publiquement, et le niveau d'exigence est fixé par le corrigé de la communauté elle-même plutôt que par celui qui s'exprime le plus fort. Ce document spécifie le fonctionnement d'un tel prix — conditions de seuil, processus de réclamation, classes de dépendances et règles — afin que les critères soient dépourvus d'ambiguïté et indépendants des méthodes dès son ouverture.

Les prix sont **financés par les sponsors et détenus par les sponsors** : les fonds restent entre les mains de l'organisation promotrice, ou auprès d'un trust communautaire désigné par le sponsor — **Champollion ne détient, ne met sous séquestre ni n'achemine jamais les fonds des prix.** Toute communauté ou organisation peut organiser un prix en toute autonomie via [Organiser un concours souverain](/docs/network/sovereignty/run-a-sovereign-contest), en conservant son propre corpus et ses propres fonds.

> **Statut : PROPOSÉ — aucun prix n'est ouvert, et aucun élément n'est encore réclamable ici.**
> L'élément déclencheur de l'*ouverture* d'un prix relève de la mesure : un corpus de référence consenti par la communauté et le filtre de révision par des locuteurs.
> Aucun des deux n'existe encore. Le bac à sable d'évaluation hermétique (*air-gapped*) est en revanche disponible — voir la
> [Spécification du Benchmark §8.6](/docs/network/specifications/benchmark#86-dependency-classes-and-the-sandbox-network-policy).
> Aucun score sur ce site n'a franchi le seuil d'un prix. Voir
> [Limites honnêtes](/docs/network/honest-limitations). Référence des métriques :
> la [Spécification d'évaluation](/docs/network/specifications/scoring) ; protocole :
> la [Spécification du Benchmark](/docs/network/specifications/benchmark).

> **La couche d'engagement est opérationnelle.** Le gel rendant les conditions d'un prix déclaré non modifiables dès qu'une soumission existe, ainsi que les résultats retenus (`hidden_until_close`),
> sont appliqués au niveau de la base de données sur le point de terminaison hébergé par le réseau depuis le
> 07/09/2026. Un hôte fédéré bénéficie des mêmes règles en appliquant la migration
> fournie avec le banc de test ; face à un point de terminaison plus ancien, le banc de test bascule
> sur l'ensemble de base et le signale explicitement au lieu de feindre la compatibilité. La règle de sortie
> restreinte aux seuls agrégats définie au §3.2 a toujours été appliquée partout.

---

## Vous souhaitez aider à intégrer une langue au réseau ?

Vous n'avez pas besoin d'attendre un prix. Les actions à plus fort impact que vous pouvez entreprendre aujourd'hui :

- **Commanditer un prix de réussite en traduction automatique.** Financez une barre ciblée — par exemple, une méthode fiable anglais → cri des Plaines. Champollion coordonne la mesure ; les fonds restent auprès de **vous** (votre organisation, ou une fiducie communautaire que vous désignez) et sont attribués selon les conditions de la communauté (voir [Souveraineté des Données](/docs/network/sovereignty/data-sovereignty) et le [Modèle Économique](/docs/network/sovereignty/economic-model)). Le chemin autonome de bout en bout est documenté dans [Gérer un Concours Souverain](/docs/network/sovereignty/run-a-sovereign-contest) ; l'introduction d'une nouvelle paire linguistique commence par un [partenariat de corpus](/docs/network/specifications/corpus-partnership).
- **Coordonner un don de calcul.** Mettez en commun des crédits API / jetons afin que la file d'attente publique puisse cartographier davantage de paires et mettre en évidence où la traduction est — et n'est pas — encore fiable.
- **Soutenir directement les initiatives open-source sur lesquelles nous nous appuyons.** Champollion est une tuyauterie qui relie le travail ouvert d'autres personnes ; les soutenir, c'est soutenir cette carte (nous préférerions vous orienter en amont plutôt que de nous approprier leur travail) :
  - [Tatoeba](https://tatoeba.org) — phrases parallèles contribuées par la communauté
  - [Catalogue des Langues en Danger (ELCat)](https://www.endangeredlanguages.com) — données sur le danger
  - [Glottolog](https://glottolog.org) · [WALS](https://wals.info) · [Grambank](https://grambank.clld.org) · [PHOIBLE](https://phoible.org) — catalogues de langues et typologie
  - [GiellaLT](https://giellalt.uit.no) / ALTLab — les transducteurs morphologiques (FST)
  - [Masakhane](https://www.masakhane.io) — communauté de traduction automatique pour les langues africaines
  - [OPUS](https://opus.nlpl.eu) — corpus parallèles ouverts

> Pour sponsoriser un prix, organiser un don de calcul ou discuter d'un partenariat,
> contactez le projet via [GitHub](https://github.com/gamedaysuits). Aucun dépositaire
> des clés communautaires n'a encore été désigné, et aucune nation ou organisation n'est mentionnée
> en tant que partenaire avant d'y avoir consenti.

---

## 1. Philosophie

> **L'accord en une phrase : débloquez une langue, gagnez, selon les conditions déclarées par l'hôte.**
> Champollion est délibérément une opération d'évaluation comparative en ML — c'est par l'émulation compétitive que les paires complexes sont résolues. Nous invitons les chercheurs en ML et tout concepteur compétent à concevoir la
> meilleure méthode pour une paire de langues difficile spécifique et à remporter le prix. Ce qu'il advient de
> la méthode par la suite relève du choix publié par l'**hôte**, non du nôtre ni d'une quelconque
> option par défaut : une communauté souhaitant le transfert d'une méthode gagnante le stipule dans ses
> conditions, et celle qui souhaite uniquement mesurer puis supprimer le précise à la place (§1.3).
> L'énergie compétitive est bien réelle, et elle est mise au service de la mission — permettre la traduction de chaque
> langue, selon les conditions définies par son peuple — et non dans le seul but de gravir un classement.

### 1.1 Les Prix Récompensent les Percées, Pas la Participation

L'argent du prix n'est versé que lorsqu'une méthode démontre clairement qu'elle atteint un seuil de capacité défini. Il n'y a pas de prix de participation, de prix pour les finalistes, ni de paiements de consolation. Si personne ne franchit la barre, personne n'est payé. C'est intentionnel — cela signifie que les sponsors ne paient que pour les résultats qui fonctionnent réellement.

### 1.2 La Validation Communautaire Est Non-Négociable

Les métriques automatisées sont des approximations (SCORING_SPEC §1.1). Une méthode peut obtenir un bon score en chrF++ et en acceptation FST tout en produisant un résultat qu'aucun locuteur n'accepterait. **Chaque réclamation de prix nécessite une validation communautaire** — les locuteurs bilingues doivent confirmer que le résultat est utilisable. C'est la porte de validation humaine (BENCHMARK_SPEC §7).

### 1.3 Le devenir d'une méthode gagnante est déclaré, non présumé {#1-3-declared-terms}

Un aspect demeure invariable, car il définit la nature même d'un concours souverain : la soumission est remise au nœud hermétique de l'hôte, qui l'exécute sur un ensemble scellé situé sur la machine de l'hôte. Ce qu'il en advient *ensuite* relève du choix déclaré par l'hôte, défini pour chaque concours et publié avec lui — et il s'agit d'**un choix parmi trois** :

| La condition | Ce que cela implique pour vous |
|---|---|
| `pass_to_holders` — *transfert aux détenteurs* | La méthode est cédée aux détenteurs souverains du benchmark. Ils l'évaluent et la conservent, quel que soit le vainqueur. |
| `retain_ip` — *conservation de la PI* | Vous conservez la propriété de votre méthode. L'hôte l'évalue et conserve au plus une copie scellée pour audit. |
| `release_open` — *publication ouverte* | Vous conservez la propriété mais devez publier la méthode sous une licence open source. Cette publication constitue la condition d'attribution du prix. |

Tout ce qui découle d'une condition — la conservation de l'artefact, le transfert éventuel de droits, l'usage qu'en fera l'hôte, l'échéance d'une publication éventuelle — est **dérivé** de l'option choisie par l'hôte (§2.1, condition 7), et non d'une case supplémentaire à cocher par l'hôte. L'hôte sélectionne la condition ; les détails en découlent.

Deux conséquences méritent d'être formulées clairement :

- **Un concours sans conditions de prix déclarées ne comporte aucun prix.** C'est l'option par défaut. Il ne s'agit pas d'un concours inférieur, et rien concernant la soumission n'est transféré.
- **Rien n'est implicite.** La condition déclarée fait l'objet d'un hachage, est présentée au participant en langage clair et est acceptée par ce hachage ; l'acceptation est intégrée à la soumission et couverte par son empreinte de contenu, et le nœud de l'hôte rejette toute soumission ayant accepté une condition différente. La condition est ensuite gelée dès la première soumission au concours, afin que nul ne soit tenu par des conditions qu'il n'aurait pu lire.

Lorsqu'un hôte choisit `pass_to_holders`, le développeur conserve la paternité et les droits de publication, l'objectif de cette disposition étant que les fonds du prix financent une technologie que la communauté linguistique peut concrètement exploiter. C'est une excellente raison pour un hôte communautaire de retenir cette condition. Il s'agit d'un choix, non d'une règle absolue.

### 1.4 Anti-Triche

Les seuils des prix sont définis par rapport à l'**évaluation de référence** (ensemble de test secret, exécuté par l'organisation de gouvernance dans un bac à sable). Les développeurs ne voient jamais les données de test. C'est architecturalement appliqué — pas une politique qui repose sur l'honneur. Voir BENCHMARK_SPEC §8.2.

### 1.5 Licences de Corpus : Les Corpus Non-Commerciaux Restent Hors de la Voie des Prix

Certains corpus exploités pendant le développement de méthodes sont régis par des licences non commerciales — par exemple, le corpus EdTeKLA Cree Language Textbook relève de la **licence modifiée CC BY-NC-SA d'EdTeKLA** (périmètre de souveraineté, usage non commercial ; le manuel d'origine étant sous CC BY-NC-ND 4.0). Ces corpus sont **strictement réservés au circuit de recherche et développement** :

1. **Les corpus de référence des prix ne doivent pas intégrer de contenu de corpus sous licence NC.** Les segments de test de référence sont des originaux commandés par la communauté (voir Stratégie de Partenariat de Corpus) — rédigés par des humains pour le prix, avec droits dégagés pour l'évaluation et le déploiement commercial dès le départ.
2. **Une méthode qui réclame un prix ne doit pas intégrer de contenu de corpus sous licence NC** (par exemple, comme données d'entraînement, exemples intégrés, ou tables de consultation). La méthode transférée doit être déployable par l'organisation de gouvernance selon les conditions qu'elle choisit — y compris commercialement, si la communauté le décide (BENCHMARK_SPEC §8.3) ; le contenu sous licence NC à l'intérieur l'empoisonnerait cette liberté.
3. **Les développeurs peuvent librement utiliser des corpus sous licence NC pour développer et auto-évaluer** — c'est à cela que sert la voie de développement. La restriction s'applique à ce qui est soumis et à ce qui est déployé, pas à la façon dont un développeur apprend.

### 1.6 Les Classes de Dépendances Conditionnent l'Admissibilité aux Prix

Toute évaluation de prix se déroule dans un bac à sable (§1.4), et les méthodes gagnantes se transfèrent à l'organisation de gouvernance (§1.3). Les deux faits imposent la même contrainte : **tout ce dont une méthode dépend doit être quelque chose que le développeur a le droit de mettre dans le bac à sable et de transférer à la communauté.** Chaque soumission déclare une classe de dépendance — définie dans la [spécification de l'Interface de Méthode](/docs/network/specifications/methods#method-validity-and-dependency-classes) — et l'admissibilité suit la classe :

| Classe de dépendance | Admissible au prix ? | Conditions |
|----------------------|---------------------|-----------|
| **S** — autonome | ✅ Oui | Aucune au-delà des conditions de seuil dans §2 |
| **O** — externe ouvert (par exemple, FST AGPL miroir à la soumission) | ✅ Oui | Artefacts épinglés et vendus dans la soumission ; les licences permettent le transfert communautaire ; les conditions copyleft préservées (la communauté reçoit les mêmes droits que la licence accorde à tous) |
| **A1** — inférence LLM substitutable | ⚠️ Conditionnel | Modèle déclaré, épinglé et substitutable (doit s'exécuter contre un modèle de poids ouvert hébergé par la communauté) ; l'évaluation acheminée via la passerelle LLM du bac à sable (🔲 planifié — les méthodes A1 ne peuvent pas produire de scores de référence jusqu'à ce que la passerelle soit opérationnelle) ; le transfert transmet la recette complète (invites, entraînement, code), pas le modèle |
| **A2** — API de service/données externe non-substitutable | ❌ Pas encore | Inadmissible jusqu'à ce que le détenteur des droits accorde les permissions d'inclusion dans le bac à sable et de transfert. Autorisé sur le classement ouvert avec un drapeau visible « dépendance externe » |
| **X** — contenu groupé sans droits | ❌ Jamais | Inadmissible dans chaque voie |

La classe d'une méthode est la classe la plus restrictive parmi ses dépendances déclarées. Les dépendances non déclarées de toute classe sont disqualifiantes (§5).

---

## 2. Pools de Prix Proposés (aucun n'est ouvert pour le moment)

### 2.1 Le Prix du Fondateur — EN→Cri des Plaines (nêhiyawêwin)

| Champ | Valeur |
|-------|-------|
| **Dotation du prix** | **10 000 $ CAD** (proposée) |
| **Paire de langues** | Anglais → Cri des plaines (EN→CRK) |
| **Sponsor prévu** | Fondateur du projet Champollion — un engagement d'intention, **aucun fonds n'est encore séquestré nulle part.** Une fois engagés, les fonds resteraient chez le sponsor ou auprès d'un trust communautaire désigné — jamais chez Champollion. |
| **Statut** | **PROPOSÉ — non ouvert.** Les soumissions ne sont pas acceptées. |
| **Ouverture** | Uniquement lorsque le corpus de référence et le filtre de révision par des locuteurs existeront (aucun n'est encore prêt), que le bac à sable d'évaluation aura été validé sur de vrais modèles (il n'a pour l'instant exécuté qu'une méthode factice), et que les fonds du sponsor seront vérifiables conformément au §4.2. |
| **Expiration** | Aucune expiration une fois ouvert. |

#### Conditions de Seuil

Une méthode réclame le Prix du Fondateur en satisfaisant **TOUTES** les conditions suivantes simultanément :

| # | Condition | Métrique | Seuil | Justification |
|---|-----------|--------|-----------|-----------|
| 1 | ~~Score composite~~ — **retiré** | — | — | Cette condition (composite ≥ 0,80) a été retirée en même temps que le score composite le 04/10/2026 ([Spécification d'évaluation §4](/docs/network/specifications/scoring#4-composite-score)). La condition de score repose uniquement sur chrF++ (condition 3) ; la numérotation est conservée pour préserver l'ordre des autres conditions. |
| 2 | **Validation FST** (un filtre de diagnostic, non le score) | `fst_acceptance_rate` (SCORING_SPEC §2.2) | **≥ 0,99 (99 %+)** | La quasi-totalité des mots en sortie doivent être des formes morphologiquement valides reconnues par le FST GiellaLT. La tolérance de 1 % prend en compte les cas limites (noms propres, néologismes, emprunts) que le FST peut légitimement ne pas couvrir. Il s'agit du filtre de qualité déterminant pour la TA polysynthétique — si le FST rejette plus de 1 % des mots, la méthode produit des formes inexistantes dans la langue. L'unique objet de ce prix est d'acquérir un système qui ne dénature pas la langue. |
| 3 | **chrF++** (le score) | `chrf_plus_plus` (SCORING_SPEC §2.1), avec sa signature sacreBLEU et son IC à 95 % | **≥ 55,0** | Le chrF++ de corpus sur l'ensemble scellé doit atteindre 55 sur une échelle de 0 à 100 — métrique de référence standard ([Spécification d'évaluation](/docs/network/specifications/scoring#how-runs-are-scored)). Elle compare chaque sortie à sa référence, empêchant un système d'atteindre le seuil avec des mots valides qui ne traduisent pas l'entrée. |
| 4 | **Validation communautaire** | Révision humaine (BENCHMARK_SPEC §7) | **≥ 70 % « acceptable » ou « excellent »** | Un échantillon stratifié de sorties (≥ 30 entrées réparties sur les niveaux de difficulté 2 à 5) est révisé par ≥ 2 locuteurs bilingues CRK. Au moins 70 % des entrées examinées doivent recevoir la mention « acceptable » ou « excellent ». |
| 5 | **Évaluation sur référence scellée** | Exécution en bac à sable (BENCHMARK_SPEC §8.2) | **Requis** | Toutes les métriques automatisées doivent être calculées sur le segment de corpus `gold_standard`, exécuté par l'organisme de gouvernance dans un environnement cloisonné. Les scores sur l'ensemble de développement ne comptent pas. |
| 6 | **Reproductibilité** | Correspondance d'empreinte (BENCHMARK_SPEC §3.8) | **±2 %** | L'organisme de gouvernance doit pouvoir réexécuter la méthode et obtenir des scores situés dans une marge de ±2 % par rapport à la fiche d'exécution soumise. |
| 7 | **Respect des conditions de prix déclarées du concours** | Les vérifications requises par cette condition (voir ci-dessous) | **Requis** | Les prix n'existent que dans le cadre de concours souverains, où votre soumission est exécutée par le nœud hermétique de l'hôte sur un ensemble scellé. Son devenir *ultérieur* correspond à l'une des trois options déclarées, publiées avec le concours avant l'ouverture des soumissions — et non à une condition unique imposée par chaque concours. |

#### La condition 7 en détail : la clause est un choix parmi trois

Chaque concours souverain fonctionne de la même manière lors de l'exécution : vous confiez votre méthode (poids ou code) au nœud hermétique de l'hôte, et le nœud l'évalue sur l'ensemble scellé. C'est exactement ce que signifie « l'hôte l'a mesuré », et cela n'est pas ajustable.

Ce qui se produit *ensuite* relève du choix de l'hôte, déclaré par concours, parmi trois options. L'hôte le publie avant l'ouverture des soumissions ; ce choix est **gelé** dès la première soumission, garantissant que les conditions que vous lisez sont celles qui vous seront appliquées.

| La condition | Ce que cela implique pour vous |
|---|---|
| `pass_to_holders` — *transfert aux détenteurs* | La méthode est cédée aux détenteurs souverains du benchmark. Ils l'évaluent et la conservent, quel que soit le vainqueur. |
| `retain_ip` — *conservation de la PI* | Vous conservez la propriété de votre méthode. L'hôte l'évalue et conserve au plus une copie scellée pour audit. |
| `release_open` — *publication ouverte* | Vous conservez la propriété mais devez publier la méthode sous une licence open source. Cette publication constitue la condition d'attribution du prix. |

**Signification détaillée de chaque option.** Ces quatre dimensions — ainsi que la licence accompagnant une publication obligatoire — sont *dérivées* de l'option choisie : un hôte ne renseigne jamais `rights` ou `host_use` manuellement, et aucun concours ne peut les combiner arbitrairement :

| Champ | `pass_to_holders` | `retain_ip` | `release_open` |
|---|---|---|---|
| `retention` — l'artefact subsiste-t-il après l'évaluation ? | `retain` | `retain_sealed_audit` | `retain` |
| `rights` — y a-t-il transfert de propriété ? | `assignment_to_host` | `participant_retains_all` | `participant_retains_all` |
| `host_use` — quel usage l'hôte peut-il en faire ? | `any` | `evaluation_only` | `any` (sous la licence open source que vous avez publiée) |
| `release` — devez-**vous** la publier, et à quelle échéance ? | `not_required` | `not_required` | `required_before_prize` |
| `release_license` — sous quelle licence devez-vous publier | — | — | `any_osi`, ou un identifiant SPDX désigné |

Deux des options permettent à un hôte de restreindre un champ unique, et cela s'arrête là :

- sous `retain_ip`, l'hôte peut définir `retention` sur `delete_after_scoring` — votre méthode est détruite une fois son évaluation achevée ;
- sous `release_open`, l'hôte peut déplacer la publication vers `required_before_scores` (vous publiez avant la divulgation de vos propres scores) ou `required_after_prize` (vous publiez après le versement), et peut imposer la licence au lieu d'accepter toute licence validée par l'OSI.

Un champ `community_terms_url` — un lien `https://` vers les conditions écrites propres à l'hôte — peut accompagner chacune des trois options. Sur le concours lui-même, l'option retenue est enregistrée sous son `disposition`, et c'est l'unique valeur à partir de laquelle tous les éléments ci-dessus sont déduits.

Toute autre configuration est refusée lors de la création du concours : une option ne propose aucun champ qui ne lui appartienne pas, et un champ renseigné manuellement alors qu'il devrait être dérivé est explicitement rejeté par son nom plutôt qu'accepté sans vérification.

**Ce qui est vérifié avant le paiement d'un prix.** Les vérifications requises découlent de la condition retenue ; aucun hôte ne les configure isolément :

- **Remise** — systématique. L'hôte détient l'artefact exact qu'il a évalué (l'empreinte de la méthode enregistrée par le nœud). Cet élément est mesuré.
- **Publication** — sous `release_open`, lorsque l'échéance de publication précède les scores ou le versement du prix. L'hôte consigne l'URL de publication et le SHA-256 de l'artefact publié ; l'enregistrement fait l'objet d'un contrôle, sans que l'URL ne soit jamais interrogée sur le réseau, afin qu'un résultat figé ne dépende jamais de la disponibilité d'un tiers. Une publication exigée *après* le prix constitue une obligation ultérieure au paiement et ne fait donc pas partie des vérifications préalables au versement.
- **Cession** — sous `pass_to_holders`, dès lors qu'il y a transfert de propriété. Une cession est un acte juridique signé en dehors de cette plateforme ; l'hôte consigne cet acte ainsi que sa date, et la plateforme vérifie l'existence de cet enregistrement. **Elle ne procède jamais à une validation juridique.**

**Un concours sans conditions de prix déclarées ne comporte aucun prix.** Il n'existe aucune clause par défaut et aucune n'est présumée pour quiconque. Participer à un concours qui en stipule une impose de l'accepter explicitement, par son hachage, au moment de la soumission — cette acceptation est intégrée dans votre archive et constitue l'un des points contrôlés par le nœud de l'hôte.

> **Pourquoi exiger plus de 99 % au FST ?** Le problème fondamental de la traduction automatique pour les langues polysynthétiques réside dans l'hallucination — les LLM génèrent des chaînes qui *ressemblent* à la langue cible mais s'avèrent morphologiquement invalides. Une méthode produisant 95 % de sorties valides contient encore 5 % de mots inventés — un niveau de bruit inacceptable pour un usage en production. Le seuil de 99 %+ impose un taux d'hallucination quasi nul tout en tolérant de rares cas limites (un nom propre inconnu du FST, un néologisme légitime). Si une méthode ne parvient pas à atteindre 99 %+ d'acceptation par le FST, elle n'a pas résolu le problème.
>
> **Pourquoi associer chrF++ et FST, et pourquoi ni l'un ni l'autre ne suffit isolément.** L'acceptation FST confirme uniquement la validité lexicale de chaque mot ; un système répétant une seule phrase valide pour chaque entrée réussirait parfaitement ce test. chrF++ compare chaque sortie à sa référence et permet ainsi de détecter ce cas de figure. Aucun score automatique ne certifie à lui seul la qualité : le filtre de validation communautaire (condition n° 4) constitue la seule confirmation que les locuteurs jugent la traduction exploitable.

#### Ce Que Ce Seuil Signifie en Pratique

Ce que ces conditions garantissent ensemble :

- **La quasi-totalité** des mots en sortie sont d'authentiques mots cris (validation FST à 99 %+ — formes inventées quasi nulles)
- Les sorties sont fidèles aux références sur l'ensemble scellé (chrF++ ≥ 55)
- Des locuteurs bilingues, selon le protocole établi par la communauté, ont évalué au moins 70 % d'un échantillon stratifié comme acceptable ou supérieur — l'unique condition attestant de la qualité
- Les erreurs restantes relèvent de la langue réelle (inflexion erronée, obviation incorrecte, désaccords d'animacité) — et non de mots forgés de toutes pièces

C'est un système qui **ne massacre pas la langue.** Il peut ne pas être parfait, mais chaque mot qu'il produit est un vrai mot. C'est la barre minimale pour une traduction automatique respectueuse d'une langue polysynthétique.

---

## 3. Processus de Réclamation du Prix

### 3.1 Admission, puis soumission

1. **Qualification publique.** Le développeur évalue l'ensemble de développement publié du concours à l'aide de son propre système et conserve le reçu (`mt-eval contest qualify`). Le reçu est déclaratif par conception — il s'agit d'une allégation que l'hôte vérifiera à l'étape 4.

2. **Remise de la soumission.** On participe à un concours en fournissant au nœud de l'hôte un élément exécutable, selon l'une des deux voies suivantes :
   - un **modèle** — des poids safetensors, un générateur de jetons (*tokenizer*) déclaratif et une configuration, sans aucun code (`mt-eval contest submit-model`) ; ou
   - une **méthode** — un Dockerfile et un point d'entrée, intégrant toutes ses dépendances (*vendored*) pour compiler et s'exécuter hors réseau (`mt-eval contest submit-method`).

   Le téléversement de traductions d'un jeu de test public, tout comme l'envoi d'un lien vers un score publié de façon autonome par le développeur, ont été **supprimés comme voies d'accès aux concours le 06/09/2026** et les commandes correspondantes effacées. Les scores déclaratifs ont toujours leur place sur le classement public général, qui est un tableau public indexé par corpus et par sens de paire — et non un concours ni une voie d'attribution de prix.

3. **Déclarer, directement sur la soumission :** la catégorie (`constrained` — entraîné uniquement sur les données autorisées par l'hôte — ou `unconstrained`), le nombre de paramètres, la licence des poids et leur caractère public ou non, les données d'entraînement sur lesquelles repose la déclaration contrainte, le caractère principal ou contrastif de la soumission de l'équipe et — lorsque le concours l'exige — une description du système. Le développeur transmet également `--agree` pour les conditions de soumission de la méthode et, lorsque le concours comporte des conditions de prix, `--accept-terms <hash>` pour celles-ci.

### 3.2 Évaluation

1. Le nœud de l'hôte exécute ses **vérifications statiques** sur l'archive, rejetant tout élément qui nécessiterait un accès réseau et refusant toute soumission ayant accepté des conditions de prix différentes de celles déclarées pour ce concours.
2. Le nœud **réexécute lui-même le test de qualification**, sur sa propre copie de l'ensemble de développement public, en utilisant le même exécuteur de circuit et le même outil d'évaluation. Le reçu du développeur constituait une déclaration ; cette étape en constitue la mesure. Tout échec est rejeté dès ce stade — avant même de solliciter l'approbation d'un quelconque dépositaire et avant l'ouverture de l'ensemble scellé — en indiquant ce qui a été revendiqué, ce qui a été mesuré et le seuil requis.
3. **Les dépositaires autorisent** l'exécution scellée (M sur N, selon le modèle d'autorisation du concours). L'autorisation est à usage unique, limitée dans le temps et liée à l'empreinte exacte (hachage de l'archive, corpus, version du corpus, nœud).
4. La soumission s'exécute sur le corpus scellé `gold_standard` dans un bac à sable isolé du réseau sur la propre machine de l'hôte, et les métriques automatisées sont calculées (chrF++ avec son IC et sa signature, les autres métriques standard, et des diagnostics tels que la validation FST). Tout ensemble d'exclusion scellé déclaré et toute suite de tests tierce s'exécutent lors de la **même** session autorisée.
5. **Seuls les scores agrégés sont extraits** — contrainte imposée au niveau de la base de données, et non par simple convention. Si le concours a promis la retenue des résultats (`hidden_until_close`), la fiche est masquée jusqu'à sa publication lors de la clôture.
6. Si les seuils automatisés sont atteints (conditions 2 et 3), l'hôte engage la révision communautaire. Dans le cas contraire, le développeur reçoit ses scores et aucune révision communautaire n'est déclenchée.

### 3.3 Examen Communautaire

1. Un échantillon stratifié de résultats (≥30 entrées, couvrant les niveaux de difficulté 2–5) est présenté aux locuteurs bilingues
2. Au minimum 2 examinateurs indépendants évaluent chaque entrée
3. Échelle d'évaluation : **rejeter** / **gist** / **acceptable** / **excellent**
4. Si ≥70% des entrées reçoivent « acceptable » ou « excellent » des deux examinateurs, la validation communautaire réussit

### 3.4 Paiement

L'ordre est immuable : **vérification des étapes d'accès déclarées → clôture du concours → versement du prix.** La nature exacte de ces étapes dépend des conditions déclarées par *ce* concours (§2.1, condition 7) — mais quelles qu'elles soient, elles sont vérifiées avant la clôture, et aucun paiement n'est effectué à partir d'un classement susceptible d'évoluer.

Un organisateur peut recourir à `close --force` pour outrepasser une étape d'accès non validée. La clôture s'exécute alors et le classement figé consigne l'éligibilité au prix de cette soumission exactement telle qu'elle a été calculée — non éligible, en nommant l'étape défaillante. Une clôture forcée correspond à un concours clôturé, jamais à une étape validée.

1. Les 7 conditions sont satisfaites
2. **Chaque étape de contrôle requise par les conditions de prix déclarées du concours est vérifiée** — systématiquement la remise de l'artefact évalué, ainsi qu'une publication enregistrée et/ou une cession enregistrée dès lors que ces conditions l'exigent
3. Le concours est **clôturé** et son classement est figé
4. L'organisme de gouvernance confirme le résultat au vu du classement figé
5. Le prix est versé dans un délai de 30 jours suivant la confirmation
6. Toutes les stipulations des conditions déclarées relatives à la propriété s'appliquent selon les modalités prévues — pour un concours dont `rights` est `participant_retains_all`, aucun transfert n'a lieu
7. Le résultat est publié sur le classement avec le niveau de vérification « Validé par la communauté »

### 3.5 Soumissions Multiples

- Le même développeur/équipe peut soumettre plusieurs fois
- Chaque soumission est évaluée indépendamment
- Si une méthode est améliorée et re-soumise, seule la dernière carte d'exécution compte
- Le prix est attribué à la **première** méthode qui franchit tous les seuils — il n'est pas divisé

### 3.6 Soumissions d'Équipe

- Les équipes et les paires Aîné-jeunesse sont admissibles
- La distribution du prix au sein d'une équipe est la responsabilité de l'équipe
- Tous les membres de l'équipe doivent signer les conditions de participation
- L'attribution sur le classement énumère tous les membres de l'équipe

---

## 4. Pools de Prix Futurs {#4-future-prize-pools}

Le Prix du Fondateur est la graine. Des pools de prix supplémentaires sont financés par les sponsors. Chaque nouveau pool de prix est documenté comme une nouvelle sous-section de §2 avec ses propres :

- Montant et devise du prix
- Paire linguistique
- Attribution du sponsor
- Conditions de seuil (qui peuvent différer du Prix du Fondateur)
- Date d'expiration (le cas échéant)
- Toute condition spéciale

### 4.1 Modèle de Prix du Sponsor

Les sponsors financent des pools de prix à tout montant. Niveaux suggérés :

| Niveau | Montant | Seuil suggéré |
|------|--------|---------------------|
| **Amorçage** | 5 000 $ à 15 000 $ | Un seuil chrF++ sur l'ensemble scellé, publié avant l'ouverture du concours + validation communautaire |
| **Avancée majeure** | 25 000 $ à 50 000 $ | Un seuil chrF++ plus élevé + validation communautaire |
| **Grand Prix** | 100 000 $+ | Les conditions de l'Avancée majeure + couverture multi-registres + intégration en déploiement |

Le seuil repose systématiquement sur chrF++ (avec sa signature, garantissant sa reproductibilité) ; des critères de diagnostic tels que la validation FST peuvent s'y ajouter en tant que filtres d'accès. Un score composite ou un niveau de qualité ne peuvent servir de seuil d'attribution d'un prix.

Les sponsors peuvent également financer :
- **Des primes d'amélioration** — versement forfaitaire pour chaque progression de 5 points de chrF++ par rapport au meilleur résultat existant
- **Des prix de registre** — récompenses distinctes pour des registres spécifiques (formel, cérémoniel, pédagogique)
- **Des prix de coût** — coût le plus bas par entrée parmi les méthodes franchissant le seuil chrF++ (le coût est indiqué en regard du score, sans jamais être combiné avec lui)

### 4.2 Où Les Fonds des Prix Sont Détenus

Les fonds des prix sont **détenus par le sponsor** : ils restent auprès de l'organisation commanditaire, ou auprès d'une fiducie communautaire que le sponsor désigne — **jamais auprès de Champollion**, qui coordonne la mesure et ne touche pas l'argent. Un prix crédible publie, avant son ouverture : **qui détient les fonds**, selon quel arrangement (compte organisationnel, fiducie, ou tiers dépositaire du choix du sponsor), et le seuil d'attribution — de sorte que franchir la barre soit vérifiable à partir des scores publiés plus le verdict de validation des locuteurs de la communauté, et qu'un défaut de paiement serait publiquement visible comme tel. Aucun fonds de prix n'est détenu nulle part aujourd'hui. Si un prix devait expirer sans être réclamé, les fonds restent où ils ont toujours été — auprès du sponsor — pour être redirigés ou retirés à la discrétion du sponsor. La mécanique autonome, y compris le risque de défaut du sponsor et ses atténuations, est documentée dans [Gérer un Concours Souverain](/docs/network/sovereignty/run-a-sovereign-contest) et les [Modèles de Conditions](/docs/network/sovereignty/terms-templates).

---

## 5. Disqualification

Une soumission est disqualifiée si :

1. **Entraînement sur les données d'évaluation.** La méthode a été exposée à des entrées des corpus `gold_standard` ou `held_out`. (Matériellement empêché par l'exécution en bac à sable — mais si une preuve de contamination est établie, le résultat est invalidé.)
2. **Absence de reproductibilité.** L'organisme de gouvernance ne parvient pas à reproduire les scores à ±2 % près.
3. **Dépendances non déclarées ou non admissibles.** La méthode requiert à l'exécution un accès à des services externes au-delà de ce que précise son manifeste de dépendances, ou sa classe de dépendance effective est A2 ou X (§1.6). L'inférence LLM déclarée de classe A1 routée via la passerelle d'évaluation est autorisée ; toute autre dépendance réseau à l'exécution — ainsi que toute dépendance non déclarée, quelle qu'en soit la classe — est éliminatoire.
4. **Conditions de participation non signées.** Tous les membres de l'équipe doivent accepter les conditions de soumission de la méthode et — lorsque le concours déclare des conditions de prix (§1.3) — accepter celles-ci, par hachage.
5. **Comportement d'optimisation abusive détecté.** La sortie est optimisée pour la métrique au détriment de la qualité de traduction (détecté par la révision communautaire et/ou les vérifications anti-triche prévues par BENCHMARK_SPEC §9.3).

---

## 6. Relation aux Autres Spécifications

| Ce document | Références | Objet |
|--------------|-----------|-----|
| §2 conditions de seuil | SCORING_SPEC « Mode d'évaluation des exécutions » et §2.1–2.2 (métriques) | Définitions et échelle des métriques |
| §2 validation communautaire | BENCHMARK_SPEC §7 | Protocole de révision humaine |
| §3 exécution en bac à sable | BENCHMARK_SPEC §8.2 | Mécanisme de souveraineté |
| §1.3 conditions de prix déclarées | BENCHMARK_SPEC §8.3 | Ce que l'hôte peut faire d'une soumission par la suite |
| §1.6 classes de dépendance | Spécification de l'interface des méthodes ; BENCHMARK_SPEC §8.6 | Définitions des classes, conditions d'admissibilité, politique réseau du bac à sable |
| §4 prix de coût | SCORING_SPEC §6.2 | Formules de calcul des métriques de coût |

---

## 7. Synchronisation Code–Spécification

### 7.1 Source Canonique

Ce document (`cli/website/docs/network/specifications/prize-spec.md`) est la source canonique pour :
- Définitions des pools de prix (§2)
- Conditions de seuil (§2.x)
- Processus de réclamation (§3)
- Règles de disqualification (§5)

### 7.2 Exigences de Mise en Œuvre

Lorsqu'une dotation de prix est activée :
1. L'interface utilisateur du classement doit afficher les prix actifs ainsi que leurs conditions de seuil
2. Les fiches d'exécution atteignant les seuils automatisés (conditions 2 et 3) doivent être signalées pour révision communautaire
3. Aucun niveau de qualité n'est utilisé : le champ `quality_tier` est null sur chaque nouvelle fiche d'exécution (standard de score/1)
4. La couche des **conditions** de prix est déjà déployée (`contest_prize_terms` — déclaration, hachage, acceptation et filtre de paiement), et l'évaluation elle-même demeure inchangée. L'activation d'une nouvelle dotation de prix introduit uniquement la politique de seuil définie au §2 et la mise en évidence sur le classement mentionnée aux points 1 et 2 ci-dessus

---

*La structure d'un prix doit être compatible avec les conditions de prix déclarées par le concours correspondant (§1.3). Ces conditions relèvent du choix de l'hôte sur chaque aspect — depuis « évaluer, supprimer, tous les droits restent au participant » jusqu'à « vous remettez la méthode, nous l'évaluons et nous la conservons quoi qu'il arrive » — et elles sont publiées, hachées et acceptées avant toute soumission. Un hôte communautaire souhaitant qu'une méthode gagnante devienne la propriété de la communauté peut stipuler exactement cela, et le prix finance alors la création d'une technologie appartenant à la communauté linguistique. Aucune disposition des présentes ne présume de ce choix à la place d'un quelconque hôte.*
