---
sidebar_position: 8
title: "Protocole de Validation des Locuteur·rice·s"
slug: '/network/specifications/speaker-validation'
---

# Protocole de Validation par Locuteurs

> **Objectif.** Ce document définit exactement ce dont nous avons besoin de la part de locuteurs bilingues cri-anglais pour valider les métriques d'évaluation LYSS. Sans cette validation, nos scores automatisés sont des estimations techniques, et non des mesures de qualité prouvées. Il s'agit de la lacune la plus importante du projet.
>
> **Public cible.** Partenaires communautaires, collaborateurs potentiels, évaluateurs de subventions et l'équipe du projet.

---

## 1. Pourquoi nous avons besoin de locuteurs

Le cadre d'évaluation LYSS (Linguistically-informed Yield & Structural Scoring) calcule des scores de qualité automatisés pour les traductions anglais → cri des Plaines. Il utilise trois signaux fondamentaux :

- **LYSS-fst** : La sortie contient-elle des mots cris valides ? (vérifiée par le transducteur à états finis GiellaLT)
- **LYSS-eq** : La sortie est-elle une variante acceptable de la traduction de référence ? (vérifiée par les classes d'équivalence du linter)
- **LYSS-sem** : La sortie préserve-t-elle le sens de la source ? (vérifiée par le validateur sémantique)

Ces métriques produisent des nombres. **Nous ne savons pas si ces nombres signifient quelque chose.** Le FST peut rejeter des mots cris valides qu'il ne reconnaît pas (emprunts, néologismes, noms propres). Le linter peut manquer des équivalences valides ou en accepter des invalides. Le validateur sémantique peut mal juger le sens. Tant que les locuteurs bilingues ne nous disent pas si nos scores automatisés correspondent à leur jugement humain de la qualité de traduction, nous devinons.

Chaque métrique majeure d'évaluation de TA (BLEU, COMET, chrF++) a été validée en comparant les scores automatisés à des milliers d'évaluations humaines de qualité. Nous avons besoin de la même chose — à une échelle plus réduite, car nos ressources sont limitées, mais avec la même rigueur.

---

## 2. Ce dont nous avons besoin : trois tâches

### Tâche A : Évaluation de la qualité de traduction (Principale — ~8 heures au total)

**Quoi :** Évaluer 200 traductions anglais → cri générées par machine sur deux échelles.

**Qui :** 3 locuteurs ou plus bilingues cri des Plaines–anglais ayant une fluidité de lecture en SRO (Standard Roman Orthography).

**Comment cela fonctionne :**

1. Nous fournissons une feuille de calcul ou un formulaire web avec 200 lignes. Chaque ligne contient :
   - La phrase source en anglais
   - Une traduction crie générée par machine
   - (Optionnellement) une traduction crie de référence à titre de comparaison

2. Pour chaque traduction, le locuteur évalue deux choses :

   **Adéquation** (dit-elle la bonne chose ?) :
   | Score | Étiquette | Signification |
   |-------|-----------|---------------|
   | 1 | Aucune | La traduction n'a rien à voir avec la source |
   | 2 | Peu | Quelques mots correspondent mais le sens global est faux |
   | 3 | Beaucoup | Le sens fondamental est présent mais des parties importantes manquent ou sont fausses |
   | 4 | Presque tout | Presque tout est correct, lacunes mineures de sens |
   | 5 | Tout | La traduction transmet pleinement le sens de la source |

   **Fluidité** (sonne-t-elle comme du vrai cri ?) :
   | Score | Étiquette | Signification |
   |-------|-----------|---------------|
   | 1 | Incompréhensible | Ce n'est pas du cri |
   | 2 | Non fluide | Les mots individuels pourraient être du cri mais la phrase est cassée |
   | 3 | Non natif | Compréhensible mais clairement pas comment un locuteur cri le dirait |
   | 4 | Bon | Naturel avec une légère maladresse |
   | 5 | Impeccable | Un locuteur cri aurait pu écrire ceci |

3. Optionnellement, le locuteur peut ajouter une note en texte libre expliquant son évaluation (par exemple, « accord animé/inanimé incorrect sur le verbe », « c'est du dialecte th mais j'évalue selon le dialecte y »).

**Estimation du temps :** ~2,5 minutes par traduction × 200 traductions = ~8 heures. Peut être réparti sur plusieurs sessions (par exemple, 4 × sessions de 2 heures sur 2 semaines).

**Compensation :** 50–65 CAD/heure (correspondant aux taux de compensation des locuteurs de BENCHMARK_SPEC §10.3). Total par locuteur : 400–520 CAD. Pour 3 locuteurs : **1 200–1 560 CAD**.

**Ce que nous en faisons :** Nous calculons la corrélation entre nos scores LYSS automatisés et les évaluations des locuteurs. Si LYSS-fst corrèle avec les évaluations de fluidité et LYSS-sem corrèle avec les évaluations d'adéquation, les métriques sont validées. Sinon, nous savons où les corriger.

---

### Tâche B : Validation de l'équivalence du linter (~2 heures)

**Quoi :** Examiner 50 paires de traductions cries que notre linter classe comme « équivalentes » et nous dire si elles signifient réellement la même chose.

**Qui :** 1–2 locuteurs bilingues (peuvent être les mêmes locuteurs que la tâche A).

**Comment cela fonctionne :**

1. Nous fournissons 50 paires. Chaque paire contient :
   - La source en anglais
   - Traduction A (la référence)
   - Traduction B (une variante que notre linter dit équivalente)
   - La raison de l'équivalence (par exemple, « permutation d'ordre des mots », « variante orthographique », « particule optionnelle supprimée »)

2. Pour chaque paire, le locuteur répond :
   - **Même sens ?** Oui / Non / Dépend du contexte
   - **Les deux sont naturelles ?** Oui / A est meilleure / B est meilleure / Aucune n'est naturelle
   - **Notes** (texte libre optionnel)

**Estimation du temps :** ~2 minutes par paire × 50 paires = ~2 heures.

**Compensation :** 50–65 CAD/heure × 2 heures = **100–130 CAD par locuteur**.

**Ce que nous en faisons :** Nous calculons la précision de chaque classe d'équivalence. Si les locuteurs disent que 90 % des équivalences « ordre des mots » sont véritablement équivalentes, cette classe est validée. S'ils disent que 40 % des équivalences « synonyme de lemme » sont fausses, nous savons que nous devons corriger ou supprimer cette classe.

---

### Tâche C : Examen des faux rejets du FST (~1,5 heures)

**Quoi :** Examiner 100 mots cris que l'analyseur FST rejette (dit que ce ne sont pas des mots cris valides) et nous dire s'ils sont réellement valides.

**Qui :** 1 locuteur bilingue ayant une solide connaissance du vocabulaire cri.

**Comment cela fonctionne :**

1. Nous exécutons l'analyseur FST sur notre corpus de développement EdTeKLA de 436 entrées (`textbook_dev.json`) et recueillons chaque mot qu'il rejette.
2. Nous présentons jusqu'à 100 mots rejetés au locuteur avec leur contexte dans la phrase.
3. Pour chaque mot, le locuteur répond :
   - **S'agit-il d'un mot cri valide ?** Oui / Non / Incertain
   - **Si oui, de quel type ?** Mot établi / Emprunt / Nom / Forme dialectale / Néologisme / Autre
   - **Notes** (facultatif)

**Estimation du temps :** ~1 minute par mot × 100 mots = ~1,5 heures.

**Compensation :** 50–65 CAD/heure × 1,5 heures = **75–100 CAD**.

**Ce que nous en faisons :** Nous calculons le taux de faux rejet du FST. Si le FST rejette 50 mots et les locuteurs disent que 30 d'entre eux sont valides, le taux de faux rejet est de 60 % — inacceptablement élevé, nécessitant une liste d'exceptions/emprunts. Si les locuteurs disent que seulement 5 sont valides, le taux de faux rejet est de 10 % — la métrique est fiable.

---

## 3. Engagement total des locuteurs

| Tâche | Locuteurs nécessaires | Heures par locuteur | Coût par locuteur | Coût total |
|-------|----------------------|---------------------|------------------|------------|
| A : Évaluation de qualité | 3 | ~8 heures | 400–520 CAD | 1 200–1 560 CAD |
| B : Validation du linter | 2 | ~2 heures | 100–130 CAD | 200–260 CAD |
| C : Examen du FST | 1 | ~1,5 heures | 75–100 CAD | 75–100 CAD |
| **Total** | **3 locuteurs** | **~11,5 heures (max par locuteur)** | **575–750 CAD (max)** | **1 475–1 920 CAD** |

Si les mêmes 3 locuteurs font toutes les tâches : **~11,5 heures chacun sur 2–4 semaines, 575–750 CAD chacun**.

Un seul locuteur faisant seulement la tâche A s'engagerait pour **~8 heures sur 2 semaines pour 400–520 CAD**.

---

## 4. Qualifications des locuteurs

**Obligatoires :**
- Bilingue en cri des Plaines et anglais
- Fluidité de lecture en SRO (Standard Roman Orthography)
- À l'aise pour évaluer les traductions sur une échelle structurée

**Préférées :**
- Expérience avec le dialecte y (le dialecte utilisé dans notre corpus de référence d'EDTeKLA)
- Expérience en enseignement ou traduction (fournit un jugement de qualité étalonné)
- Familiarité avec différents registres (formel, éducatif, conversationnel)

**Non obligatoires :**
- Connaissances techniques ou en TAL (nous fournissons tous les outils et le contexte)
- Compétences informatiques (l'interface d'évaluation sera une simple feuille de calcul ou un formulaire web)
- Implication antérieure dans le projet Champollion

---

## 5. Gouvernance des données {#5-data-governance}

Toutes les contributions des locuteurs sont régies par les politiques de données aspirantes à la souveraineté du projet :

- **Propriété :** Les évaluations de qualité des locuteurs restent leur contribution intellectuelle. Ils sont crédités par leur nom (ou anonymement, à leur choix) dans toute publication.
- **Contrôle :** Les locuteurs peuvent retirer leurs évaluations à tout moment. Le retrait supprime leurs données de toutes les analyses.
- **Accès :** Les données d'évaluation sont stockées sur l'infrastructure contrôlée par l'organisation de gouvernance communautaire (une fois établie) ou sur la plateforme préférée du locuteur.
- **Possession :** Les données d'évaluation brutes ne sont jamais publiées. Seules les statistiques agrégées (corrélations, accord inter-annotateurs) apparaissent dans les publications.
- **Compensation :** Les locuteurs sont payés pour leur temps indépendamment du fait que nous utilisions leurs évaluations. Le paiement n'est pas conditionnel aux résultats.

---

## 6. Ce que les locuteurs reçoivent {#6-what-speakers-get}

Au-delà de la compensation :

- **Co-auteur** sur toute publication utilisant leurs évaluations (si souhaité)
- **Reconnaissance** dans toute la documentation du projet
- **Accès anticipé** aux outils d'évaluation et aux résultats
- **Contribution** sur la façon dont les métriques sont utilisées — si un locuteur dit « votre linter se trompe sur X », nous corrigeons le linter
- **Droit de veto** sur la publication des résultats qu'ils trouvent problématiques

---

## 7. Comment commencer {#7-how-to-get-started}

Si vous êtes un locuteur bilingue cri–anglais intéressé par la participation, ou si vous connaissez quelqu'un qui pourrait l'être :

1. **Contactez-nous** à [email/contact du projet] — aucun engagement requis, juste une conversation
2. **Nous expliquons les tâches** en langage clair (sans jargon)
3. **Vous choisissez les tâches** qui vous intéressent (A, B, C, ou toute combinaison)
4. **Nous établissons un calendrier** qui vous convient (blocs de 2 heures, horaires flexibles)
5. **Vous évaluez les traductions** via feuille de calcul ou formulaire web — de n'importe où, à votre rythme
6. **Nous payons rapidement** — dans les 2 semaines suivant l'achèvement de chaque bloc de tâches

---

## 8. Ce qui se passe après

Avec les données de validation des locuteurs, nous pouvons :

1. **Publier les corrélations des métriques** — prouvant (ou réfutant) que les scores LYSS reflètent le jugement humain
2. **Recalibrer les métriques** — ajustant les poids, les seuils et les classes d'équivalence en fonction des commentaires des locuteurs
3. **Corriger le linter** — supprimant les fausses équivalences, en ajoutant les manquantes
4. **Corriger la liste d'exceptions du FST** — en ajoutant les mots valides que le FST rejette incorrectement
5. **Soumettre à un lieu académique** — avec les locuteurs comme co-auteurs, établissant LYSS comme une métrique validée pour l'évaluation de la TA en langues polysynthétiques

Sans validation par les locuteurs, LYSS reste un outil technique. Avec elle, LYSS devient une métrique d'évaluation scientifiquement fondée. C'est la différence entre « nous avons construit quelque chose » et « nous avons prouvé que cela fonctionne ».

---

## Où cela mène-t-il sur ce site

La validation par les locuteurs est une étape d'un pipeline plus vaste : le flux de travail du
[Partenariat de corpus](/docs/network/specifications/corpus-partnership)
précise comment ces tâches s'intègrent dans la construction d'un corpus d'évaluation, et
[Comment les locuteurs sont rémunérés](/docs/network/perspectives/how-speakers-get-paid)
est la version en langage clair des tarifs et conditions ci-dessus.
