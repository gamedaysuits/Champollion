---
sidebar_position: 1
title: "Règles de soumission"
related:
  - label: "Scoring Specification"
    to: /docs/network/specifications/scoring
    kind: spec
    note: "How runs are scored: chrF++ with its CI and signature"
  - label: "Statistical Significance Testing"
    to: /docs/network/specifications/significance
    kind: spec
  - label: "Evaluation Datasets"
    to: /docs/network/leaderboard/datasets
    kind: doc
  - label: "Live Leaderboard"
    to: https://champollion.dev/leaderboard
    kind: leaderboard
    note: "The rules, applied"
---

# Évaluation de la traduction automatique

> **Résumé exécutif.** Cette page définit les critères de soumission au classement, l'évaluation (chrF++ comme métrique principale, accompagnée des métriques standard et des diagnostics), les politiques anti-triche, les niveaux de vérification et le flux de travail de soumission. Les méthodes ayant été exposées aux données d'évaluation sont disqualifiées.

champollion inclut un cadre d'évaluation de la traduction automatique conçu pour l'**évaluation comparative reproductible** des méthodes de traduction — en particulier pour les langues peu dotées en ressources et les langues autochtones où les repères MT standard n'existent pas et où les affirmations de qualité sont difficiles à vérifier.

---

## Le classement

La pièce maîtresse est le **[classement des méthodes](https://champollion.dev/leaderboard)** — un tableau d'affichage public, en direct et **ouvert aux soumissions**, où les chercheurs et les membres de la communauté soumettent et comparent des méthodes de traduction au moyen d'évaluations reproductibles et dotées d'une empreinte numérique.

Chaque soumission comprend :

- **Pipeline avec empreinte** — lié à un commit Git et à un hachage de configuration spécifiques, de sorte que les résultats puissent être retracés jusqu'au code exact les ayant produits
- **Jeu de données versionné** — doté d'un hachage de contenu et versionné ; les scores ne sont comparables qu'au sein d'une même version du jeu de données
- **Métriques standardisées** — tous les scores sont calculés par le banc d'évaluation partagé, éliminant ainsi les différences d'implémentation
- **Niveaux de confiance** — auto-évalué (self-benchmarked), Champollion Verified ou Community Validated
- **Suivi des coûts** — coût d'API par soumission, afin que les compromis coût-qualité soient transparents

Le classement ordonne les exécutions de la même manière que WMT, FLORES-200 et les tâches partagées d'AmericasNLP rapportent l'évaluation de la TA : selon **une métrique standard, chrF++**, affichée avec son intervalle de confiance à 95 % et sa signature sacreBLEU — par exemple `chrF++ 47.5 [45.9, 49.0]`. Tout le reste est affiché à ses côtés, sans jamais y être mélangé :

| Métrique | Rôle | Ce qu'elle mesure |
|----------|------|-------------------|
| **chrF++** | **Métrique principale et de classement** | F-score de n-grammes de caractères par rapport à la référence (sacreBLEU, `word_order=2`). Gère mieux la morphologie riche que les métriques au niveau des mots |
| **BLEU, spBLEU, TER, COMET** | Métriques standard, aux côtés de la métrique principale | Les autres métriques rapportées par les articles de TA ; COMET lorsqu'il a été calculé, avec son identifiant de modèle |
| **Exact Match** | Diagnostic | Fréquence à laquelle la traduction correspond exactement à la référence |
| **FST Acceptance** | Diagnostic | Pour les langues disposant d'un transducteur à états finis : proportion de mots générés qui sont des formes valides. Ne compare pas avec la source ni la référence, ce n'est donc jamais un score |
| **Equivalent Match** | Diagnostic | Fraction correspondant à la référence ou à une variante acceptable (ordre des mots, convention orthographique). Actuellement CRK ; en cours de généralisation. |
| **Semantic Score** | Diagnostic | Préservation du sens, par un validateur déterministe. Actuellement CRK ; en cours de généralisation. |
| **Score caveats** | Affichés aux côtés de la métrique principale | Lorsque les sorties copient leur source, sont beaucoup plus courtes ou plus longues que les références, répètent une même sortie pour plusieurs entrées, ou que les lignes de test ont des jumelles dans les données d'entraînement |

Pour déterminer si une exécution est meilleure qu'une autre, on applique un test de significativité apparié sur chrF++, et non un simple ordre entre deux nombres — des intervalles qui se chevauchent indiquent que l'ordre peut être dû au bruit ([Tests de significativité statistique](/docs/network/specifications/significance)) ; les classements de concours utilisent ce test pour former des groupes de rangs (clusters). chrF++ classe les systèmes sur un même jeu de données uniquement, jamais d'une langue à l'autre. Aucun score automatique ne porte de label de qualité — seule une révision humaine par des locuteurs certifie la qualité. Le score composite pondéré et les niveaux de qualité utilisés auparavant sont abandonnés ; le composite d'une ancienne fiche est affiché, le cas échéant, sous la mention « composite hérité (retiré) ».

:::info[Suite complète de métriques]
La [spécification de notation](/docs/network/specifications/scoring#how-runs-are-scored) définit la façon dont les exécutions sont notées ainsi que l'inventaire complet des métriques (six catégories : surface, structurelle, sémantique, comportementale, conformité et comparateurs rapportés).
:::

**[→ Consulter le classement](https://champollion.dev/leaderboard)**

---

## Ensembles de données disponibles

Ce sur quoi une exécution peut être évaluée est répertorié par les outils ; cette page ne tient donc aucune liste qui lui soit propre :

```bash
# the runnable corpora for a pair: size, contamination, domain, licence, provider
mt-eval corpora --source eng --target crk

# …and the catalogued ones that can never run, each with its reason
mt-eval corpora --source eng --target crk --include-quarantined
```

La page [Jeux de données d'évaluation](/docs/network/leaderboard/datasets) décrit
le catalogue, le format des corpus, les niveaux de difficulté, les filières de licence
et la façon de créer le vôtre. Trois règles de ce catalogue déterminent ce qui peut
être classé :

- **Un corpus en quarantaine n'est jamais classé.** Il est répertorié au catalogue mais ne peut jamais être exécuté, et la base de données refuse tout score publié à son encontre. Les corpus anglais→cri des plaines d'EdTeKLA (`eval-eng-crk-edtekla-dev-v1` et `eval-eng-crk-edtekla-textbook`) sont en quarantaine. Ils portent une licence CC BY-NC-SA modifiée et axée sur la souveraineté (`LicenseRef-EdTeKLA-Modified-CC-BY-NC-SA-4.0`) et sont exclus de tout classement, prix et filière commerciale.
- **Un corpus contaminé n'est classé que de manière relative.** FLORES+, ainsi que tout corpus noté `HIGH` ou `MEDIUM` pour la contamination ou non évalué, porte la mention de comparaison relative uniquement sur sa fiche d'exécution. Il permet de comparer des méthodes exécutées sur ce corpus et n'est jamais rapporté en tant que qualité absolue. Seul un corpus noté `LOW` est classé selon la qualité absolue.
- **Les filières de licence sont respectées.** Un corpus non commercial reste à l'écart des voies commerciales et des concours à prix. Un corpus régi par une concession modifiée, sur mesure ou non précisée refuse l'évaluation à distance par API de modèle tant que l'autorisation du titulaire des droits n'a pas été enregistrée sur son entrée.

**Les concours se déroulent sur des ensembles scellés conservés par l'hôte.** Un concours n'est évalué sur aucun de ces corpus publics. L'hôte, qu'il s'agisse d'une communauté ou d'une organisation, conserve un ensemble de test scellé et tenu secret sur sa propre infrastructure. Les participants se qualifient sur l'ensemble de développement public publié par l'hôte, puis transmettent un modèle ou une méthode au nœud de l'hôte pour exécution. Les dépositaires de l'hôte autorisent chaque exécution, et seuls les scores en ressortent. Voir [Organiser un concours souverain](/docs/network/sovereignty/run-a-sovereign-contest).

:::danger[NE PAS ENTRAÎNER sur les données d'évaluation]

**Ces ensembles de données sont réservés à l'évaluation.** Les méthodes entraînées, affinées, peu-shot-invitées ou autrement exposées aux données d'évaluation produiront des scores artificiellement gonflés et seront **disqualifiées du classement.**

Ce n'est pas une suggestion — c'est la règle la plus importante de l'intégrité de l'évaluation. Utilisez des corpus distincts pour l'entraînement. Les ensembles d'évaluation doivent rester invisibles à votre modèle pendant le développement.

Si vous utilisez des données d'entraînement ou des exemples peu-shot, ceux-ci doivent provenir de **sources complètement distinctes**. En cas de doute, ne l'incluez pas.
:::

:::warning[Non-déterminisme des LLM]

Les résultats des LLM sont non-déterministes. Les scores représentent des mesures ponctuelles dans le temps selon des versions de modèle spécifiques et des configurations d'API. Les fournisseurs de modèles peuvent mettre à jour les poids, les stratégies de décodage ou les filtres de sécurité à tout moment, ce qui peut entraîner une dérive des scores entre les exécutions. Le classement enregistre le slug de modèle exact et l'horodatage pour chaque soumission.
:::

---

## Ce qui fait une bonne méthode

Toutes les méthodes ne sont pas créées égales. Voici ce qui sépare le travail rigoureux des scores gonflés.

### Caractéristiques d'une méthode solide

- **Séparation nette des données d'entraînement et d'évaluation** — votre méthode n'a jamais vu l'ensemble d'évaluation pendant le développement, l'ajustement, l'ingénierie des invites ou la sélection d'exemples peu-shot
- **Reproductible** — quelqu'un d'autre peut cloner votre dépôt, exécuter le harnais et obtenir les mêmes scores (dans les limites du non-déterminisme des LLM)
- **Documentée** — votre [fiche de méthode](/docs/network/specifications/methods) décrit ce que votre méthode fait, quels outils elle utilise et quelles sont ses limitations
- **Honnête sur la portée** — si votre méthode ne fonctionne que pour une paire de langues, dites-le ; si elle se dégrade sur certains motifs morphologiques, documentez-le
- **Consciente de la communauté** — pour les langues autochtones, votre méthode respecte la souveraineté des données. Vous avez consulté les communautés linguistiques ou utilisé uniquement des données sous licence ouverte

### Signaux d'alerte (ce qui est disqualifié)

| Signal d'alerte | Pourquoi c'est un problème |
|-----------------|---------------------------|
| Entraînement sur les données d'évaluation | Annule complètement l'objectif de l'évaluation. Les scores gonflés trompent tout le monde. |
| Sélection des résultats | Exécution 10 fois et soumission de la meilleure exécution sans divulguer les autres |
| Post-traitement non divulgué | Correction manuelle des résultats avant la notation |
| Données d'entraînement contaminées | Utilisation d'exemples d'ensemble d'évaluation comme invites peu-shot ou entrées de dictionnaire |
| Affirmation de disponibilité commerciale sans provenance | Si votre méthode utilise des données CC BY-NC-SA, elle n'est pas prête commercialement |

### Niveaux de vérification

Les niveaux de vérification décrivent **qui a validé le résultat**. Ce ne sont pas des labels de qualité (les anciens niveaux automatiques de qualité sont [retirés](/docs/network/specifications/scoring#5-quality-tiers)).

| Niveau | Signification | Comment l'obtenir |
|--------|---------------|-------------------|
| **Self-benchmarked** | Vous avez exécuté le banc d'évaluation vous-même et soumis les résultats | Publiez votre fiche d'exécution avec `mt-eval publish` |
| **Champollion Verified** | Le projet a réévalué de manière indépendante vos sorties soumises par rapport au corpus de référence épinglé par SHA et a reproduit votre score | Le réévaluateur est un outil destiné aux mainteneurs, exécuté manuellement par lots. Rien ne le planifie, aucune soumission n'est donc réévaluée à l'arrivée (voir ci-dessous) |
| **Community Validated** | Des locuteurs bilingues de la langue cible, qualifiés selon le protocole propre à la communauté, ont évalué un échantillon stratifié de la sortie (≥30 entrées, ≥2 évaluateurs) et ≥70 % ont satisfait aux exigences de la communauté. Attribué uniquement par les tests propres à la communauté ; la rétrogradation par audit inopiné est symétrique | Soumettez le code de la méthode à l'organisation de gouvernance — celle-ci l'exécute sur le jeu de données de référence (gold-standard) et soumet les sorties à l'examen de la communauté |

**L'évaluation validée par la communauté est une filière distincte, et aucun score d'évaluation humaine n'existe pour l'instant :** le banc d'évaluation peut sélectionner les systèmes qu'un budget fixe de révision humaine couvrirait à partir du classement figé d'un concours clos (groupes d'ex æquo entiers uniquement — un groupe n'est jamais coupé en deux), mais il n'enregistre aucune note, et rien sur le classement actuel ne porte de jugement humain.

**Les rangs sont des clusters, pas un ordre strict.** Les entrées voisines que le test de significativité ne peut séparer partagent un rang et portent une *plage* de rangs ; dans un concours scellé, où la sortie par segment ne quitte jamais la machine de l'organisateur, le test apparié s'exécute sur cette machine et seuls ses verdicts signés en sortent ; en leur absence, les égalités reposent sur des preuves d'intervalles de confiance ou d'égalité ponctuelle. Le fonctionnement de ce système et la faiblesse relative de chaque échelon de l'échelle des preuves sont décrits dans [Tests de significativité statistique → Clusters de classement](/docs/network/specifications/significance#ranking-clusters).

### Comment la vérification passe à l'échelle : l'audit pondéré par la réputation

**Nous ne revendiquons pas la provenance.** Une ligne du classement est produite par un contributeur exécutant le banc d'évaluation *open source* sur sa *propre* machine. « Cette exécution provient véritablement du banc d'évaluation » n'est pas une affirmation qu'un serveur peut vérifier pour du calcul auto-hébergé — la clé de signature du banc d'évaluation est entre les mains du contributeur, de sorte qu'une signature authentifie une *machine, pas l'honnêteté*. Plutôt que de prétendre le contraire, **la validité se mérite et s'auto-corrige** : une ligne est digne de confiance parce que son score est **reproductible** et parce que le contributeur qui en est à l'origine a **mis en jeu une réputation qu'une falsification avérée détruirait.** La vérification s'effectue en quatre couches, ce qui la rend rigoureuse là où c'est nécessaire et économique là où c'est possible — le projet n'a jamais à réexécuter le travail de tout le monde.

- **L0 — tout réévaluer (gratuit, ~100 %).** Le réévaluateur recalcule votre score à partir de *vos propres sorties soumises* par rapport au **corpus de référence épinglé par SHA** (et non votre copie stockée de celui-ci), avec la même métrique que celle utilisée par le banc d'évaluation. Si le score ne se reproduit pas à partir des sorties, ou si une référence stockée a été modifiée, l'exécution est **disqualifiée** — cela suffit à éliminer un score saisi manuellement ou modifié. Une exécution qui se reproduit est promue au rang **Champollion Verified** — le niveau utilisé par défaut pour le classement d'un concours, et le seul niveau éligible à un prix. Il est opérationnel et peu coûteux, mais il s'agit d'une **commande de mainteneur, exécutée manuellement** : rien ne l'exécute à la soumission, et rien ne la planifie. Jusqu'à ce que cela change, chaque ligne arrive — et reste — au statut auto-évalué (self-benchmarked).
- **L1 — une échelle de réputation des contributeurs.** Chaque contributeur (identifié par son identifiant de connexion) gagne de la réputation *uniquement* en réussissant les vérifications plus approfondies ci-dessous — jamais par le simple volume, de sorte que créer de nouvelles identités n'apporte rien. La réputation est **publique**, et elle détermine la fréquence à laquelle la vérification coûteuse est déclenchée.
- **L2 — réexécuter un *échantillon* (la vérification coûteuse ; politique uniquement, pas encore de réexécuteur).** Pour un ensemble de développement *public*, le L0 ne peut pas détecter un contributeur qui se contenterait de copier la référence comme sa « traduction ». Pour détecter cela, il faut réexécuter réellement le modèle — un calcul réel —, nous le ferions donc sur un **échantillon**, et non sur tout le monde. La **politique d'échantillonnage** est conçue et testée : une exécution est sélectionnée avec une probabilité qui augmente avec les **enjeux** (une exécution qui établit la première passerelle vers toute une famille de langues est *toujours* sélectionnée), augmente avec l'**anomalie** (un bond trop beau pour être vrai par rapport au meilleur résultat précédent est *toujours* sélectionné), et diminue avec la **réputation** (un contributeur ayant passé de nombreux audits est rarement contrôlé de manière inopinée ; un nouveau venu ou un auteur anonyme est contrôlé à chaque exécution jusqu'à ce qu'il ait gagné la confiance). Réussir un audit L2 augmente la réputation. **Le réexécuteur que cette politique piloterait n'existe pas encore**, aucun audit L2 n'a donc jamais été déclenché : une exécution sélectionnée est enregistrée comme *en attente L2*.
- **L3 — corroboration (vérification gratuite).** Lorsque deux contributeurs *indépendants* exécutent le même modèle sur le même corpus et que leurs sorties réévaluées **concordent**, cette concordance *constitue* une vérification — et elle augmente la réputation des deux. Une **discordance** authentique signale les deux exécutions pour un audit L2. La réplication est récompensée plutôt que traitée comme redondante.

**Une seule falsification avérée est catastrophique — comme une rétractation.** Une falsification prouvée remet la réputation du contributeur à zéro, **réaudite l'intégralité de son historique vérifié** (chacune de ses exécutions vérifiées est renvoyée en vérification) et est consignée **publiquement** dans le journal d'audit. C'est ce qui rend l'échantillonnage léger sûr : tricher sur un ensemble de développement public peut passer inaperçu sur une exécution, mais le coût espéré — perdre toute la confiance acquise et voir l'ensemble de ses antécédents réexaminé — en fait un très mauvais calcul. Ces règles s'appliquent de manière symétrique aux propres exécutions des mainteneurs.

**Pourquoi contribuer reste intéressant.** Vous assumez toujours la partie coûteuse (l'exécution de votre méthode) ; le projet ne prend en charge que la réévaluation L0 gratuite pour tout le monde, plus une réexécution L2 sur un *échantillon décroissant* — élevé pour les nouveaux arrivants et les exécutions à fort enjeu, faible pour les contributeurs confirmés. Le coût de vérification est *amorti par la réputation et partagé par la corroboration*, et non repayé intégralement à chaque fois.

---

## Comment soumettre

1. **Construisez votre méthode** — voir [Construire une méthode](/docs/network/specifications/methods) pour l'interface de méthode
2. **Exécutez le banc d'évaluation** — voir [Banc d'évaluation](/docs/network/specifications/harness) pour la configuration et l'utilisation
3. **Générez une fiche d'exécution** — le banc d'évaluation produit une fiche d'exécution JSON avec vos scores, votre empreinte et vos métadonnées
4. **Publiez** — `mt-eval publish eval/logs/harness/<run-id>_report.json --prod` téléverse la fiche d'exécution sur le classement (prévisualisez avec `--dry-run`)
5. **Apparaissez sur le classement** — votre exécution est répertoriée comme *auto-évaluée (non vérifiée)* (*self-benchmarked (unverified)*). Le [classement des méthodes](https://champollion.dev/leaderboard) répertorie et classe chaque ligne qui n'est pas `disqualified`, y compris celles auto-évaluées, étiquetées comme telles ; filtrez sur *Champollion Verified* pour ne voir que les résultats réévalués. La réévaluation L0 qui promeut une exécution à ce niveau est un traitement par lots de mainteneur, et rien ne le planifie ; aujourd'hui, chaque ligne du tableau est donc une déclaration auto-rapportée. L'affichage réservé aux résultats vérifiés est la valeur par défaut pour le classement d'un **concours**, et c'est le seul niveau éligible à un prix

---

## Politique d'intégrité : rétractations, réexécutions, déclassement, litiges

Rédigée à l'avance pour que l'application soit une procédure et non un drame. Ces règles s'appliquent à tous de manière symétrique — y compris aux propres exécutions des mainteneurs.

**Aucune rétractation.** Une exécution publiée constitue un enregistrement permanent. Il n'existe aucun mécanisme — pour quiconque — permettant de supprimer un score embarrassant. Chaque ligne d'exécution comporte un horodatage `submitted_at` certifié par le serveur et une piste d'audit immuable ; les actions de modération sont elles-mêmes journalisées.

**Les réexécutions s'ajoutent, elles ne remplacent jamais.** Si vous améliorez votre méthode, publiez une nouvelle exécution. L'ancienne exécution reste. La divulgation sélective — tester de nombreuses variantes en privé et ne publier que la gagnante — est ce qui a rendu d'autres classements manipulables ; un registre en ajout seul (append-only) est la réponse structurelle. La déduplication par empreinte bloque le spam de resoumissions identiques à l'octet près ; elle ne réécrit jamais l'histoire.

**Le déclassement est l'application d'une règle, avec mention explicite de la règle.** Une exécution n'est déclassée (marquée `disqualified` de manière visible — et non supprimée silencieusement) que pour des motifs répertoriés : un jeu de données en quarantaine ou formant un sous-ensemble invalide (imposé par un déclencheur de base de données sous chaque client), une non-concordance de la somme de contrôle du corpus, des scores falsifiés ou hors limites, des violations des filtres de contenu (content guards), ou le retrait de l'enregistrement des données sous-jacentes par un gestionnaire. Le déclassement mentionne la règle et la preuve. De nouveaux motifs sont ajoutés ici par une modification datée avant d'être appliqués, et ne sont jamais inventés rétroactivement pour un cas particulier.

### Signaler un résultat

*Ajouté le 7 septembre 2026.*

:::caution[Signalements non acceptés pour le moment]

Le système de signalement est en place et la base de données est prête depuis le 7 septembre 2026 — mais le formulaire permettant de déposer un signalement n'a pas encore été redéployé avec cette prise en charge, de sorte que *Signaler ce résultat* ne peut toujours rien soumettre. L'opération échoue plutôt que d'accepter un signalement silencieusement. En attendant, envoyez un e-mail à `info@champollion.dev`. Cet avis sera retiré le jour où le formulaire sera déployé.

:::

**Tout le monde peut signaler un résultat.** Développez sa ligne dans le classement et utilisez *Signaler ce résultat* : cela ouvre un formulaire de message déjà associé à l'identifiant de cette exécution, dans lequel vous indiquez ce qui vous semble incorrect et comment vous le savez — un corpus contaminé, une métrique qui ne correspond pas à son libellé, une méthode mal attribuée, ou toute autre raison. Un signalement doit obligatoirement être motivé. Un signalement sans motif n'est qu'un vote négatif (« downvote »), et ce tableau ne comporte aucun vote négatif.

**Un signalement est un message privé, pas un vote.** Il parvient aux mainteneurs sous la forme d'un ticket et ne va nulle part ailleurs. Aucun décompte de signalements n'est jamais affiché — ni sur la ligne, ni dans la fiche d'exécution, ni nulle part ailleurs —, car un décompte visible inciterait lui-même à la manipulation, et la validité d'un résultat doit reposer sur des preuves plutôt que sur le nombre de personnes ayant formulé une objection. Le dépôt d'un signalement ne modifie, en lui-même, rien à la ligne.

**Un signalement retenu ne se manifeste que d'une seule façon :** le résultat est marqué `disqualified`, pour un motif déjà répertorié sur cette page. Comme pour tout autre déclassement, un nouveau motif est ajouté ici **par une modification datée avant d'être appliqué à quiconque** — un signalement ne peut donc jamais engendrer une règle secrète ou rétroactive. Si un signalement n'est pas retenu, la ligne reste inchangée, et si vous avez laissé une adresse, vous recevrez une réponse dans tous les cas.

**Les niveaux de confiance sont des labels, pas des modifications.** Les lignes `self-benchmarked` sont déclaratives ; les lignes `Champollion Verified` ont été réévaluées de manière indépendante à partir des sorties du soumissionnaire par rapport au corpus épinglé par SHA ; `Community Validated` n'est conféré que par les propres tests de la communauté. La vérification modifie le niveau d'une ligne — elle ne modifie jamais ses scores.

**La réputation est publique et s'auto-corrige.** La réputation des contributeurs, ainsi que le journal d'audit qui consigne chaque réévaluation, réexécution échantillonnée, corroboration et sanction de falsification, sont publics. La réputation n'est pas un multiplicateur de score et n'affecte jamais les chiffres d'une exécution — elle détermine uniquement la fréquence à laquelle les exécutions d'un contributeur sont réauditées (voir ci-dessus *l'audit pondéré par la réputation*). Une falsification prouvée est consignée aussi publiquement qu'une rétractation et entraîne un réaudit de l'intégralité de l'historique vérifié du contributeur ; les mêmes règles s'appliquent aux propres exécutions des mainteneurs.

**Litiges.** Ouvrez un ticket (issue) contenant l'identifiant de l'exécution et l'objet précis de la réclamation (score erroné, mauvais jeu de données, règle mal appliquée). Les mainteneurs réexécutent publiquement les vérifications déterministes ; le résultat et ses preuves sont publiés sur le ticket. Si le litige concerne les données ou la validation d'une communauté, c'est l'autorité propre à cette communauté qui tranche et le tableau applique sa décision. Pour les concours dotés de prix, les mêmes règles s'appliquent, complétées par les étapes de qualification et d'audit publiées au préalable pour le concours — les gagnants sont audités **avant** le versement des prix, et une disqualification cite la règle exactement comme pour tout autre déclassement.

## Orientations futures

- **Exécutions de comparaison de modèles complètes** — évaluation systématique des modèles de pointe (GPT-4o, Claude, Gemini, etc.) dans les langues champollion en utilisant des corpus d'évaluation personnalisés (pas des repères publics)
- **Plus de paires de langues** — quechua, inuktitut et autres langues peu dotées en ressources à mesure que des ensembles de données vérifiés par la communauté deviennent disponibles
- **Importation d'ensembles de données** — outils pour convertir les ensembles de données d'évaluation externes (WMT, Tatoeba, etc.) au format d'évaluation champollion
- **Réexécutions automatisées** — détection des changements de version de modèle et réexécution des repères pour suivre la dérive des scores

---

## Voir aussi

- **[Classement des méthodes](https://champollion.dev/leaderboard)** — scores en direct et soumissions
- **[Banc d'évaluation](/docs/network/specifications/harness)** — comment exécuter des évaluations
- **[Jeux de données d'évaluation](/docs/network/leaderboard/datasets)** — format et jeux de données disponibles
- **[Construire une méthode](/docs/network/specifications/methods)** — spécification de l'interface de méthode
- **[Spécification de la fiche d'exécution](/docs/network/specifications/run-card)** — schéma JSON de la fiche d'exécution
- **[Spécification du benchmark](/docs/network/specifications/benchmark)** — protocole d'évaluation, format de corpus, souveraineté
- **[Spécification de notation](/docs/network/specifications/scoring)** — source unique de vérité (SSOT) pour les métriques et la notation des exécutions
