---
sidebar_position: 1
title: "Règles de soumission"
related:
  - label: "Scoring Specification"
    to: /docs/network/specifications/scoring
    kind: spec
    note: "How the composite score is computed"
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

> **Résumé exécutif.** Cette page définit les critères de soumission au classement, les métriques de notation (chrF++, acceptation FST, correspondance exacte, correspondance équivalente, score sémantique), les politiques anti-triche, les niveaux de vérification et le flux de soumission. Les méthodes qui ont été exposées aux données d'évaluation sont disqualifiées.

champollion inclut un cadre d'évaluation de la traduction automatique conçu pour l'**évaluation comparative reproductible** des méthodes de traduction — en particulier pour les langues peu dotées en ressources et les langues autochtones où les repères MT standard n'existent pas et où les affirmations de qualité sont difficiles à vérifier.

---

## Le classement

La pièce maîtresse est le **[Method Leaderboard](https://champollion.dev/leaderboard)** — un tableau de bord public, en direct et **ouvert aux soumissions**, où les chercheurs et les membres de la communauté soumettent et comparent des méthodes de traduction avec une évaluation reproductible et identifiée par empreinte numérique.

Chaque soumission comprend :

- **Pipeline à empreinte numérique** — lié à un commit Git spécifique et à un hachage de configuration, de sorte que les résultats remontent au code exact qui les a produits
- **Jeu de données versionné** — haché selon le contenu et versionné ; les scores ne sont comparables qu'au sein de la même version du jeu de données
- **Métriques standardisées** — toute la notation est calculée par le harnais d'évaluation partagé, éliminant les différences d'implémentation
- **Niveaux de confiance** — auto-évalué, Champollion Verified, ou Validé par la communauté
- **Suivi des coûts** — coût de l'API par soumission, afin que les compromis coût-qualité soient transparents

Le classement évalue cinq métriques. Trois fonctionnent pour n'importe quelle langue ; deux sont disponibles pour le cri des Plaines et seront généralisées à mesure que nous nous développons :

| Métrique | Type | Ce qu'elle mesure |
|----------|------|------------------|
| **chrF++** | Score F des n-grammes de caractères | Métrique de qualité principale — corrèle bien avec le jugement humain, en particulier pour les langues morphologiquement riches |
| **Correspondance exacte** | Proportion de correspondances parfaites | Précision stricte — à quelle fréquence la traduction correspond-elle exactement à l'étalon-or ? |
| **Acceptation FST** | Taux de passage de la porte morphologique | Pour les méthodes avec vérification par transducteur à états finis — quelle proportion des résultats sont morphologiquement valides ? |
| **Correspondance équivalente** | Taux de variante acceptable | Fraction correspondant à la référence ou à une variante acceptable (ordre des mots, convention orthographique). Actuellement CRK ; généralisation en cours. |
| **Score sémantique** | Fidélité sémantique | Préservation du sens — la traduction capture-t-elle le sens prévu indépendamment de la forme de surface ? Actuellement CRK ; généralisation en cours. |

:::info[Suite complète de métriques]
La [Spécification de notation](/docs/network/specifications/scoring) définit l'inventaire complet des métriques (six catégories : surface, structurelle, sémantique, comportementale, conformité et comparateurs signalés), la formule de score composite, les tableaux de pondération et les seuils de niveau de qualité.
:::

**[→ Consulter le classement](https://champollion.dev/leaderboard)**

---

## Ensembles de données disponibles

### Ensemble de développement EDTeKLA v1

Le premier ensemble de données d'évaluation, construit pour la traduction anglais→cri des Plaines (SRO). Créé par le [groupe de recherche EdTeKLA](https://spaces.facsci.ualberta.ca/edtekla/) de l'Université de l'Alberta.

| Propriété | Valeur |
|----------|-------|
| **ID** | `edtekla-dev-v1` |
| **Paire de langues** | EN → CRK (Cri des plaines, orthographe SRO) |
| **Nombre d'entrées** | Ensemble de développement de 436 entrées (`textbook_dev.json`) ; la répartition complète est indiquée une fois sur la [page des jeux de données d'évaluation](/docs/network/leaderboard/datasets#edtekla-development-set-v1) |
| **Licence** | [CC BY-NC-SA modifiée d'EdTeKLA](https://github.com/EdTeKLA/IndigenousLanguages_Corpora) (`LicenseRef-EdTeKLA-Modified-CC-BY-NC-SA-4.0`, à portée de souveraineté) — non commerciale ; exclue du classement, des prix et des voies commerciales/API |
| **Provenance** | `gold_standard` (vérifié par des locuteurs), `textbook` (matériel éducatif publié) |

### FLORES+ Devtest — Utilisation en développement uniquement

> [!WARNING]
> **FLORES+ est disponible pour le développement et le débogage mais n'est PAS utilisé pour l'évaluation officielle du classement.** FLORES+ (originellement Meta FLORES-200) est un ensemble de données de repère largement public sur lequel les LLM de pointe ont presque certainement été entraînés. Les scores par rapport à FLORES+ ne reflètent pas de manière fiable la qualité réelle de la traduction pour les méthodes basées sur LLM. Les méthodes non-LLM (FST, basées sur des règles, NMT affiné) sont moins affectées, mais les scores FLORES+ ne sont toujours pas publiés sur le classement.

Les fixtures FLORES+ restent disponibles dans `test/benchmark/fixtures/` pour les tests de fumée du pipeline, la validation multilingue et l'utilisation en développement. L'évaluation officielle utilise des corpus personnalisés construits à partir de texte rédigé par des humains non disponible publiquement sous forme parallèle.

Consultez [Ensembles de données d'évaluation](/docs/network/leaderboard/datasets) pour le schéma complet de l'ensemble de données, les niveaux de difficulté et comment créer le vôtre.

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

Les niveaux de vérification décrivent **qui a validé le résultat** — distinct des niveaux de qualité (Baseline → Fluent) définis dans la [Spécification de notation, §5](/docs/network/specifications/scoring#5-quality-tiers), qui décrivent ce que le score composite automatisé signifie.

| Niveau | Signification | Comment l'obtenir |
|------|---------|--------------|
| **Auto-évalué** | Vous avez exécuté le harnais vous-même et soumis les résultats | Publiez votre fiche d'exécution avec `mt-eval publish` |
| **Champollion Verified** | Le serveur a recalculé indépendamment vos sorties soumises par rapport au corpus de référence épinglé par SHA et a reproduit votre score | Automatique — chaque soumission est recalculée (voir ci-dessous) |
| **Validé par la communauté** | Des locuteurs bilingues de la langue cible, qualifiés selon le propre protocole de la communauté, ont examiné un échantillon stratifié de la sortie (≥ 30 entrées, ≥ 2 examinateurs) et ≥ 70 % ont atteint le niveau d'exigence de la communauté. Conféré uniquement par les propres tests de la communauté ; la rétrogradation par audit ponctuel est symétrique | Soumettez le code de la méthode à l'organisation de gouvernance — ils l'exécutent par rapport à l'ensemble de référence (gold-standard) et soumettent la sortie à l'examen de la communauté |

### Comment la vérification passe à l'échelle : audit pondéré par la réputation

**Nous ne revendiquons pas la provenance.** Une ligne du classement est produite par un contributeur exécutant le harnais *open-source* sur sa *propre* machine. « Cette exécution provient réellement du harnais » n'est pas quelque chose qu'un serveur peut vérifier pour un calcul auto-hébergé — la clé de signature du harnais est entre les mains du contributeur, donc une signature authentifie une *machine, pas l'honnêteté*. Au lieu de prétendre le contraire, **la validité ici se mérite et s'auto-corrige** : une ligne est digne de confiance parce que son score est **reproductible** et parce que le contributeur qui en est à l'origine a **mis en jeu une réputation qu'une falsification découverte détruirait.** La vérification est exécutée en quatre couches, de sorte qu'elle est approfondie là où elle doit l'être et peu coûteuse là où elle peut l'être — le projet n'a jamais à réexécuter le travail de tout le monde.

- **L0 — tout recalculer (gratuit, 100 %).** Le serveur recalcule votre score à partir de *vos propres sorties soumises* par rapport au **corpus de référence épinglé par SHA** (et non votre copie stockée de celui-ci), avec la même métrique que celle utilisée par le harnais. Si le score ne se reproduit pas à partir des sorties, ou si une référence stockée a été altérée, l'exécution est **disqualifiée** — cela suffit à éliminer un score saisi manuellement ou modifié. Une exécution qui se reproduit est promue au niveau **Champollion Verified**, le seul niveau classé par le tableau. Cela s'exécute à chaque soumission et prend quelques millisecondes.
- **L1 — une échelle de réputation des contributeurs.** Chaque contributeur (identifié par sa connexion) gagne en réputation *uniquement* en survivant aux vérifications plus approfondies ci-dessous — jamais par le seul volume, de sorte que la création de nouvelles identités n'apporte rien. La réputation est **publique**, et elle détermine la fréquence à laquelle la vérification coûteuse se déclenche.
- **L2 — réexécuter un *échantillon* (la vérification coûteuse).** Pour un ensemble de développement *public*, L0 ne peut pas attraper un contributeur qui copie simplement la référence comme étant sa « traduction ». Pour détecter cela, il faut réellement réexécuter le modèle — un vrai calcul — nous le faisons donc sur un **échantillon**, et non sur tout le monde. Une exécution est échantillonnée pour une réexécution L2 avec une probabilité qui augmente avec les **enjeux** (une exécution qui établit le premier pont vers toute une famille de langues est *toujours* réexécutée), augmente avec l'**anomalie** (un bond trop beau pour être vrai par rapport au meilleur précédent est *toujours* réexécuté), et diminue avec la **réputation** (un contributeur qui a passé de nombreux audits est rarement contrôlé de manière ponctuelle ; un nouveau venu ou un soumissionnaire anonyme est contrôlé à chaque exécution jusqu'à ce qu'il ait gagné la confiance). Réussir un audit L2 augmente la réputation.
- **L3 — corroboration (vérification gratuite).** Lorsque deux contributeurs *indépendants* exécutent le même modèle sur le même corpus et que leurs sorties recalculées **concordent**, cette concordance *est* une vérification — et elle augmente la réputation des deux. Un véritable **désaccord** signale les deux exécutions pour un audit L2. La réplication est récompensée plutôt que traitée comme redondante.

**Une falsification découverte est catastrophique — comme une rétractation.** Une falsification prouvée réduit à zéro la réputation du contributeur, **ré-audite l'intégralité de son historique vérifié** (chacune de ses exécutions vérifiées est renvoyée à la vérification), et est enregistrée **publiquement** dans le journal d'audit. C'est ce qui rend l'échantillonnage léger sûr : tricher sur un ensemble de développement public pourrait passer inaperçu lors d'une exécution, mais le coût attendu — perdre toute la confiance acquise et voir l'intégralité de son dossier réexaminé — en fait un mauvais pari. Ces règles lient les propres exécutions des mainteneurs de manière symétrique.

**Pourquoi contribuer en vaut toujours la peine.** Vous payez toujours la partie coûteuse (l'exécution de votre méthode) ; le projet ne paie que le recalcul L0 gratuit pour tout le monde, plus une réexécution L2 sur un *échantillon décroissant* — élevé pour les nouveaux venus et les exécutions à forts enjeux, faible pour les contributeurs confirmés. Le coût de vérification est *amorti par la réputation et partagé par la corroboration*, et non payé intégralement à chaque fois.

---

## Comment soumettre

1. **Construisez votre méthode** — voir [Construire une méthode](/docs/network/specifications/methods) pour l'interface de la méthode
2. **Exécutez le harnais** — voir [Harnais d'évaluation](/docs/network/specifications/harness) pour la configuration et l'utilisation
3. **Générez une fiche d'exécution** — le harnais produit une fiche d'exécution JSON avec vos scores, votre empreinte numérique et vos métadonnées
4. **Publiez** — `mt-eval publish eval/logs/harness/<your-run-card>.json` téléverse la fiche d'exécution vers le classement
5. **Apparaissez dans le classement** — votre exécution est préparée comme *auto-évaluée (non vérifiée)*, puis le serveur recalcule automatiquement vos sorties par rapport au corpus épinglé par SHA (L0) ; lorsqu'elle se reproduit, l'exécution est promue au niveau *Champollion Verified* — le seul niveau classé par le [Method Leaderboard](https://champollion.dev/leaderboard). Un audit plus approfondi pondéré par la réputation suit les niveaux de confiance ci-dessus

---

## Politique d'intégrité : Rétractations, Réexécutions, Retraits, Litiges

Rédigée à l'avance afin que l'application soit une procédure, et non un drame. Ces règles lient tout le monde de manière symétrique — y compris les propres exécutions des mainteneurs.

**Aucune rétractation.** Une exécution publiée est un enregistrement permanent. Il n'existe aucun mécanisme — pour quiconque — permettant de supprimer un score parce qu'il est embarrassant. Chaque ligne d'exécution comporte un horodatage `submitted_at` estampillé par le serveur et une piste d'audit immuable ; les actions de modération elles-mêmes sont journalisées.

**Les réexécutions s'ajoutent, elles ne remplacent jamais.** Si vous améliorez votre méthode, publiez une nouvelle exécution. L'ancienne exécution reste. La divulgation sélective — tester en privé de nombreuses variantes et ne publier que la gagnante — est ce qui a rendu d'autres classements manipulables ; un enregistrement en ajout seul est la réponse structurelle. La déduplication par empreinte numérique arrête le spam de resoumission identique à l'octet près ; elle ne réécrit jamais l'histoire.

**Le retrait est l'exécution d'une règle, avec la règle nommée.** Une exécution est retirée (marquée `disqualified`, de manière visible — et non supprimée silencieusement) uniquement pour des causes répertoriées : un jeu de données mis en quarantaine ou un sous-ensemble inapproprié (appliqué par un déclencheur de base de données sous chaque client), une non-concordance de la somme de contrôle du corpus, des scores falsifiés ou hors limites, des violations des garde-fous de contenu, ou le retrait par un responsable de l'enregistrement des données sous-jacentes. Le retrait nomme la règle et les preuves. De nouvelles causes sont ajoutées ici par une modification datée avant d'être appliquées, et ne sont jamais inventées rétroactivement pour un cas particulier.

**Les niveaux de confiance sont des étiquettes, pas des modifications.** Les lignes `self-benchmarked` sont des affirmations ; les lignes `Champollion Verified` ont été recalculées indépendamment à partir des sorties du soumissionnaire par rapport au corpus épinglé par SHA ; `Community Validated` est conféré uniquement par les propres tests de la communauté. La vérification modifie le niveau d'une ligne — elle ne modifie jamais les scores de la ligne.

**La réputation est publique et s'auto-corrige.** La réputation des contributeurs, ainsi que le journal d'audit qui enregistre chaque recalcul, réexécution échantillonnée, corroboration et destruction pour falsification, sont publics. La réputation n'est pas un multiplicateur de score et ne touche jamais aux chiffres d'une exécution — elle définit uniquement la fréquence à laquelle les exécutions d'un contributeur sont ré-auditées (voir *audit pondéré par la réputation* ci-dessus). Une falsification prouvée est enregistrée aussi publiquement qu'une rétractation et ré-audite l'intégralité de l'historique vérifié du contributeur ; les mêmes règles s'appliquent aux propres exécutions des mainteneurs.

**Litiges.** Ouvrez un ticket (issue) avec l'identifiant de l'exécution et la réclamation spécifique (mauvais score, mauvais jeu de données, règle mal appliquée). Les mainteneurs réexécutent les vérifications déterministes en public ; le résultat et ses preuves sont publiés sur le ticket. Si le litige concerne les données ou la validation d'une communauté, la propre autorité de la communauté décide et le tableau met en œuvre sa décision. Pour les concours à prix, les mêmes règles s'appliquent, en plus des étapes de qualification et d'audit pré-publiées du concours — les gagnants sont audités **avant** le paiement, et une disqualification cite la règle exactement comme tout autre retrait.

## Orientations futures

- **Exécutions de comparaison de modèles complètes** — évaluation systématique des modèles de pointe (GPT-4o, Claude, Gemini, etc.) dans les langues champollion en utilisant des corpus d'évaluation personnalisés (pas des repères publics)
- **Plus de paires de langues** — quechua, inuktitut et autres langues peu dotées en ressources à mesure que des ensembles de données vérifiés par la communauté deviennent disponibles
- **Importation d'ensembles de données** — outils pour convertir les ensembles de données d'évaluation externes (WMT, Tatoeba, etc.) au format d'évaluation champollion
- **Réexécutions automatisées** — détection des changements de version de modèle et réexécution des repères pour suivre la dérive des scores

---

## Voir aussi

- **[Classement des méthodes](https://champollion.dev/leaderboard)** — scores en direct et soumissions
- **[Harnais d'évaluation](/docs/network/specifications/harness)** — comment exécuter les évaluations
- **[Ensembles de données d'évaluation](/docs/network/leaderboard/datasets)** — format d'ensemble de données et ensembles de données disponibles
- **[Construire une méthode](/docs/network/specifications/methods)** — la spécification de l'interface de méthode
- **[Spécification de fiche d'exécution](/docs/network/specifications/run-card)** — le schéma JSON de fiche d'exécution
- **[Spécification de repère](/docs/network/specifications/benchmark)** — protocole d'évaluation, format de corpus, souveraineté
- **[Spécification de notation](/docs/network/specifications/scoring)** — SSOT pour les métriques, les poids composites et les niveaux de qualité
