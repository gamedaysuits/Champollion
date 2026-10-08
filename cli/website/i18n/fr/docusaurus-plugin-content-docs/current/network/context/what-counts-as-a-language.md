---
sidebar_position: 2
title: "Qu'est-ce qui compte comme une langue ici ?"
---

# Qu'est-ce qui compte comme une langue ici ?

> **Résumé exécutif.** Le Réseau catalogue les langues selon la norme ISO 639-3, évalue les langues individuelles (et non les parapluies macrolinguistiques), inclut les langues des signes en tant que langues naturelles qu'elles sont, inclut les langues construites reconnues par l'ISO, exclut les langages de programmation, et affiche les désaccords taxonomiques sans prendre parti. Cette page explique chaque choix et ce qu'il signifie pour le classement.

Tout projet qui évalue la traduction sur des milliers de langues doit répondre à une vieille question étonnamment difficile : qu'est-ce qui compte comme une langue ? Les linguistes savent depuis longtemps que la frontière entre « langue » et « dialecte » est autant sociale et politique que structurelle — le célèbre aphorisme selon lequel *« une langue est un dialecte avec une armée et une marine »* a été popularisé par le linguiste yiddish Max Weinreich en 1945 (il l'a attribué à un membre du public lors de l'une de ses conférences). Nous ne pouvons pas esquiver la question, voici donc nos réponses et notre raisonnement.

---

## Les langues des signes sont des langues. Point final.

Les langues des signes sont des langues naturelles — avec des grammaires complètes, une acquisition native par les enfants, et des communautés de locuteurs vivantes. Cela a été établi en linguistique depuis la démonstration de William Stokoe en 1960 que la Langue des signes américaine possède le même type de structure interne que les langues parlées, et soixante ans de recherche depuis (Klima & Bellugi 1979 ; Sandler & Lillo-Martin 2006) n'ont fait que renforcer ce point. L'ISO 639-3 attribue aux langues des signes des codes de langue individuels ; Glottolog les catalogue aux côtés des familles parlées. Notre catalogue en inclut plus de 160, étiquetées `modality: signed`.

Certaines sont des langues autochtones en danger : la Langue des signes des Indiens des Plaines (`psd`), historiquement une importante lingua franca intertribale en Amérique du Nord, est gravement menacée aujourd'hui (Davis 2010, *Hand Talk*). L'endangérment des langues des signes *est* l'endangérment des langues autochtones, et il relève de la mission de ce projet.

**Une note de portée honnête.** Le Réseau évalue actuellement la traduction automatique *basée sur le texte*. La traduction en langue des signes — travaillant avec la vidéo, la grammaire spatiale, et les langues qui n'ont pas de forme écrite largement adoptée — est un problème technique différent et largement non résolu (voir Yin et al. 2021, « Including Signed Languages in Natural Language Processing », ACL). Nous ne la servons pas encore. Les entrées de langues des signes dans notre catalogue le disent exactement : **pas encore servie — jamais « pas une langue ».**

## Il y a deux modalités. L'écriture n'en est pas une.

Les langues se présentent en deux modalités principales : **parlée** et **signée**. L'écriture n'est pas une troisième modalité — c'est une technologie superposée à une langue, et la plupart des langues du monde s'en passent sans orthographe standardisée. C'est pourquoi nos fiches de langue suivent l'écriture séparément (quels systèmes d'écriture une langue utilise, ou si elle n'a pas d'orthographe standardisée du tout) et la suivent honnêtement : pour une plateforme de traduction automatique basée sur le texte, le fait qu'une langue soit écrite est une information critique, non une note de bas de page — et une langue non écrite n'est pas une langue inférieure.

## Les langues construites : oui. Les langages de programmation : non.

Nous suivons la ligne de l'ISO 639-3 elle-même. La norme n'admet une langue construite que si c'est une langue complète, conçue pour la communication humaine, avec une littérature et une communauté qui l'a transmise à une deuxième génération d'utilisateurs — et elle exclut explicitement les langages de programmation informatique. L'Espéranto, avec ses locuteurs natifs, se qualifie ; Python ne se qualifie pas, car personne n'acquiert Python comme première langue de ses parents. Notre catalogue inclut les deux douzaines de langues construites que l'ISO reconnaît, typées comme telles, et aucun langage de programmation.

## Nous évaluons les langues individuelles, pas les parapluies

L'ISO 639-3 distingue les *langues individuelles* des *macrolangues* — des codes parapluies comme `cre` (Cree), `ara` (Arabe), ou `zho` (Chinois) qui couvrent plusieurs langues individuelles étroitement apparentées. L'unité d'évaluation du Réseau est la **langue individuelle**, pour une raison opérationnelle : les ressources de traduction sont spécifiques à la variété. Un analyseur morphologique construit pour le Cree des Plaines (`crk`) ne génère pas le Cree de Moose (`crm`) ; un corpus d'arabe égyptien dit peu de choses sur la qualité d'une méthode en arabe marocain. Un score attaché à un code macrolangue serait une affirmation sur des variétés qui n'ont jamais été réellement évaluées — nous ne le faisons donc pas.

Les macrolangues apparaissent toujours dans le catalogue en tant que **pages hub** : une navigation qui relie une identité parapluie à ses membres individuels, reflétant l'observation de l'ISO elle-même que les deux niveaux d'identité sont réels. Sous la langue individuelle, nous affichons les informations de dialecte et de lignage de l'arbre languoïde de Glottolog (Hammarström & Forkel 2022), qui modélise les familles, les langues et les dialectes comme une hiérarchie navigable unique.

**Qu'en est-il des corpus qui arrivent étiquetés avec un code générique ?** C'est le cas de nombreuses données réelles — des jeux de données publiés sous les dénominations « quechua », « persan » ou « chinois (simplifié) ». Nous traitons l'étiquette en amont comme une *métadonnée à résoudre*, et non comme une vérité à laquelle obéir ou qu'il conviendrait d'écarter. Les cas mécaniques sont résolus automatiquement à partir des tables officielles de l'ISO : une étiquette d'écriture est retirée (`cmn-Hans` correspond au chinois mandarin, écrit en han simplifié — l'écriture est consignée, l'identité linguistique est `cmn`), et un code retiré suit son successeur officiel. Lorsque l'éditeur documente la variété précise à laquelle correspondent réellement ses données — FLORES+ code son entrée quechua sous `quy`, le quechua d'Ayacucho —, nous enregistrons cette résolution *avec la citation* dans l'entrée du registre du corpus, et le corpus est évalué sous la véritable langue individuelle. Et lorsque nul ne peut préciser quelle variété contient une collection (certaines collections communautaires de phrases conservent délibérément un regroupement générique « arabe »), nous ne faisons aucune supposition : le corpus reste catalogué sous sa propre étiquette, il est exclu de la file d'attente de traitement avec un motif lisible par machine consultable dans les métadonnées de la file, et tous les scores historiques qui lui sont associés restent rattachés à un nœud générique honnêtement étiqueté — sans jamais être discrètement crédités à une variété qui n'a jamais été évaluée. Chaque résolution peut être recalculée : les tables ISO figées, les marques de résolution par corpus et les citations sont toutes incluses dans le registre public.

## Quand les autorités ne sont pas d'accord, nous montrons les deux

L'ISO 639-3 et Glottolog opèrent parfois des regroupements ou des distinctions différents, et les communautés sont parfois en désaccord avec les deux. Nous ne tranchons pas. Les fiches de langue comportent un encart de *notes taxonomiques* qui affiche les divergences avec les sources, et la dénomination suit celle de la communauté dès lors que celle-ci a exprimé une préférence. Déterminer si une variété constitue « une langue » relève en définitive, en partie, d'une question d'identité — et les questions d'identité appartiennent aux communautés elles-mêmes, un principe que nous empruntons aux cadres de gouvernance des données autochtones.

## Une direction de recherche : les évaluations comme instrument de mesure

L'un des résultats qu'une telle arène produit, presque comme un sous-produit, est un nouveau type de données probantes sur le degré de proximité réelle des variétés linguistiques *sur le plan opérationnel*. Si une méthode de traduction unique, maintenue constante, dessert suffisamment bien plusieurs variétés apparentées pour que leurs locuteurs en acceptent le résultat, ces variétés se regroupent dans la pratique ; si elles exigent des corpus distincts et des méthodes distinctes, elles sont opérationnellement distinctes — quelles que soient les considérations politiques relatives à leur dénomination. Cela s'apparente à des traditions empiriques plus anciennes, allant des tests d'intelligibilité sur textes enregistrés aux mesures automatisées de distance lexicale, avec une dimension ancrée dans le déploiement en conditions réelles.

Nous l'offrons avec prudence, en tant que direction de recherche plutôt que comme une affirmation. Les résultats de transfert de méthode sont confondus par la taille du corpus, le domaine, l'orthographe et la contamination des données d'entraînement, et un regroupement est toujours relatif à une méthode et à un seuil de qualité. Surtout : ce signal peut *informer* les conversations sur la langue et le dialecte, mais il ne remplace jamais la façon dont une communauté identifie sa propre langue.

---

## Références

- Davis, Jeffrey E. (2010). *Hand Talk: Sign Language among American Indian Nations.* Cambridge University Press.
- Dryer, Matthew S. & Martin Haspelmath, éd. (2013). *The World Atlas of Language Structures Online.* https://wals.info
- Hammarström, Harald & Robert Forkel (2022). « Glottocodes: Identifiers Linking Families, Languages and Dialects to Comprehensive Reference Information ». *Semantic Web* 13(6).
- Haugen, Einar (1966). « Dialect, Language, Nation ». *American Anthropologist* 68(4).
- Autorité d'enregistrement ISO 639-3. « Scope of denotation » et « Types of individual languages ». https://iso639-3.sil.org/about/scope · https://iso639-3.sil.org/about/types
- Klima, Edward S. & Ursula Bellugi (1979). *The Signs of Language.* Harvard University Press.
- Sandler, Wendy & Diane Lillo-Martin (2006). *Sign Language and Linguistic Universals.* Cambridge University Press.
- Stokoe, William C. (1960). *Sign Language Structure.* Studies in Linguistics, Occasional Papers 8.
- Weinreich, Max (1945). « Der YIVO un di problemen fun undzer tsayt ». *YIVO Bleter* 25(1).
- Yin, Kayo, Amit Moryossef, Julie Hochgesang, Yoav Goldberg & Malihe Alikhani (2021). « Including Signed Languages in Natural Language Processing ». *Proc. ACL-IJCNLP 2021.* https://aclanthology.org/2021.acl-long.570/


## Où cela mène-t-il sur ce site

Les règles de décompte présentées ici régissent chaque chiffre sur ce site : la
[méthodologie de couverture](/docs/network/context/coverage-counting) les applique
aux services de traduction automatique, et les
[fiches de langue](/docs/reference/language-card-spec) consignent, par langue,
ce que chaque source affirme réellement.
