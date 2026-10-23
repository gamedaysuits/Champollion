---
title: "Accompagner les personnes"
slug: /agents/coaching
description: "Comment un agent IA relaie le rapport de cycle de Champollion et échange avec les personnes qui conçoivent un traducteur : les progrès d'abord, chaque nombre avec son unité et son ensemble, des encouragements uniquement pour les gains mesurés, du temps demandé sans pression et aucune promesse sur la qualité."
---

# Accompagner la communauté

Les rails mesurent. Vous transmettez. La majeure partie de ce que la communauté apprend au sujet de son traducteur passe par vous ; la manière dont vous le formulez fait donc partie intégrante du travail. Cette page explique comment vous exprimer : ce que contient le rapport de cycle, comment le transmettre, comment demander du temps et les termes à employer.

Les règles sous-jacentes figurent dans [le contrat](/docs/agents/contract) § 5 : ne dire que ce qui est vrai, transmettre chaque mise en garde mot pour mot, promettre une méthode et jamais une qualité, associer à chaque chiffre son unité et l'ensemble sur lequel il a été mesuré.

## Le rapport de cycle

Chaque cycle d'amélioration se termine par `champollion improve report` (l'étape `improve-report` du parcours, mode `auto`). Elle écrit `improve/round-<k>/report.json` et affiche quatre parties ; `--json` affiche le même objet :

| Champ | Ce qu'il contient |
|---|---|
| `round` | Le cycle en cours : un de plus que les cycles évalués par forge |
| `progress` | Lignes, dans l'ordre : la tendance des évaluations du locuteur, puis les évaluations de chaque cycle (suivies chacune, pour un cycle dont la feuille intégrait les ébauches d'un autre modèle, de la comparaison à l'aveugle), puis le verdict de chaque cycle sur le jeu de développement |
| `checks` | Avertissements sur ce que les chiffres peuvent et ne peuvent pas montrer |
| `projection` | Une estimation approximative du nombre de phrases d'entraînement supplémentaires nécessaires pour atteindre un fonctionnement « opérationnel », comptée par doublement de celles-ci, avec un intervalle — ou la raison de son absence — ou `null` avant deux cycles d'évaluations |
| `projection_numbers` | La même estimation sous forme de chiffres : `more_sentences`, `range` (`[fewest, most]` phrases d'entraînement ; `most` vaut `null` lorsque les vérifications ne peuvent pas le borner) et `speaker_hours` — ou `null` lorsqu'il n'y a pas de projection |
| `actions` | Une à quatre actions à mener ensuite |

Il lit uniquement les enregistrements conservés par les cycles — les `marks.json` du locuteur par cycle et les verdicts `improve-compare` de forge — et affiche des totaux et des pourcentages, jamais de phrase.

### La signification de chaque ligne

**Les évaluations du locuteur — la mesure qui compte.** À chaque cycle, le modèle en service ébauche les phrases rédigées par la famille, et le locuteur évalue chaque ébauche par `Y` (correct), `N` (incorrect, en indiquant comment cela se dit) ou `?` (incertain). La proportion de traductions correctes est calculée sur les ébauches marquées `Y` ou `N`, avec un intervalle de Wilson à 95 % :

> Cycle 1 : le locuteur a jugé correctes 9 ébauches de nouvelles phrases sur 24 — 38 %
> (intervalle à 95 % : 21 %–57 %).

Il s'agit de nouvelles phrases — rédigées avant qu'aucun modèle ne les apprenne —
il s'agit donc de la mesure hors échantillon. Dans une série dont la feuille
mélangeait les brouillons d'un autre modèle, ces décomptes ne concernent que
les lignes du modèle en service. Les lignes réaffichées (ci-dessous) n'en font
jamais partie.

**Lignes réaffichées.** À partir de la série 2, environ une ligne sur dix est un
brouillon que le locuteur a déjà évalué sur une feuille antérieure, réapparu non
annoté. La feuille le précise en tête — *"Quelques lignes ci-dessous proviennent
volontairement de feuilles antérieures. Veuillez les évaluer à neuf, comme si
elles étaient nouvelles : la fréquence à laquelle les annotations concordent
indique dans quelle mesure on peut leur faire confiance."* — sans jamais indiquer
lesquelles. `improve marks` affiche *"Lignes réaffichées : le locuteur a évalué A
lignes sur J comme auparavant (P %)"*, avec les inversions dans chaque sens. Ces
lignes ne sont jamais comptabilisées dans la proportion de la série et ne sont
plus jamais utilisées pour l'entraînement ; elles prennent environ 10 secondes par
ligne au locuteur ([mesure](/docs/agents/measurement#the-speakers-marks)).

**La comparaison à l'aveugle.** Un second modèle génère une moitié aléatoire des ébauches d'une feuille, sans étiquette, et le locuteur les évalue toutes les deux sans savoir laquelle provient de quel modèle ([mesure](/docs/agents/measurement#the-speakers-marks)). Le second modèle est le plus récent lorsqu'il n'a pas été mis en service ; lors de la visite suivant une promotion, il s'agit du modèle que le nouveau a remplacé. Le rapport ajoute une ligne :

> Cycle 2 : À l'aveugle, sur de nouvelles phrases : le modèle en service a été jugé correct sur 5 phrases sur 12 (42 %), le modèle plus récent (non utilisé) sur 7 sur 12 (58 %) — pas de différence nette sur 24 phrases.

Après une promotion, la ligne indique *« le dernier modèle mis en service a été jugé correct sur …, le modèle qu'il a remplacé sur … »*. Elle se termine de l'une des trois manières suivantes (test de comparaison de deux proportions à 5 %) : pour un modèle plus récent, *le modèle plus récent est nettement meilleur sur les phrases dont la famille a besoin* ou *le modèle en service est nettement meilleur* ; après une promotion, *le nouveau modèle est nettement meilleur sur les phrases dont la famille a besoin* ou *le modèle qu'il a remplacé était nettement meilleur — le nouveau n'a pas apporté d'amélioration sur les phrases dont la famille a besoin* ; ou bien *pas de différence nette sur N phrases*. S'il y a trop peu de lignes évaluées pour l'un des modèles, elle indique *« trop peu de lignes d'un modèle ont été évaluées pour pouvoir comparer »*.

**La tendance.** Le rapport ne qualifie une hausse de *progrès réel* que lorsque les trois conditions suivantes sont remplies :

- la plage de la dernière itération se situe entièrement au-dessus de celle de la première itération (sa borne inférieure étant supérieure à la borne supérieure de la première) ;
- le modèle d'une itération a été mis en service dans l'intervalle — choisi par la communauté (enregistrements `export` et `choose` de forge) : après un verdict **better** et son accord, d'après les évaluations en aveugle du locuteur, ou par son propre choix. Un verdict **better** seul ne compte pas ; et
- lors d'évaluations en aveugle au cours des mêmes visites, le locuteur a jugé le nouveau modèle correct nettement plus souvent que celui qu'il remplaçait (les vérifications après chaque promotion étant regroupées ; test bilatéral de comparaison de deux proportions à 5 %).

La troisième condition existe parce que la notation d'un locuteur peut dériver : une personne qui devient plus indulgente à chaque itération fait augmenter toutes les proportions, mais au cours d'une même séance, cela touche les deux modèles de manière identique. Dans une simulation avec un locuteur qui note 10 % des brouillons de manière erronée et devient plus indulgent à chaque itération, une promotion accordée par erreur par l'ensemble de pratique sous l'effet du hasard a été considérée comme un réel progrès dans 106 rapports sur 1 600 alors que le modèle ne pouvait pas s'améliorer ; avec la vérification à l'aveugle, ce nombre passe à 3 — et au maximum 3 sur 1 600 à nouveau lorsqu'elle est réexécutée avec le plancher de 50 phrases et le verdict du locuteur, y compris les exécutions dont l'ensemble de pratique commence à 30 phrases.

Une hausse accompagnée d'une promotion mais sans cette vérification s'affiche comme *non encore comptabilisée comme un progrès réel : l'indulgence dans l'évaluation des ébauches a peut-être changé elle aussi* — avec les résultats de la vérification, ou en indiquant que la prochaine feuille mélangera les ébauches des deux modèles. Une hausse avec le même modèle en service s'affiche comme *non comptabilisée comme un progrès* : ce sont les phrases ou l'évaluation qui ont changé, pas le modèle. Une hausse comprise à l'intérieur des intervalles s'affiche comme *en hausse, mais pas encore au-delà de l'incertitude*.

**Le verdict sur le jeu de développement.** Forge compare le nouveau modèle avec celui en service sur les mêmes phrases de développement (pratique), phrase par phrase :

> Itération 1 : sur les 50 mêmes phrases de pratique (dev), chrF++ (0–100, chevauchement
> avec la traduction vérifiée) de 24,1 pour le nouveau modèle contre 22,0 pour le
> modèle en service — aucun changement mesurable : non utilisé (sur 50 phrases, seule une
> différence d'environ 5,8 points ou plus apparaît de manière fiable).

La fin de la ligne dépend du verdict et de la décision de la communauté de choisir ou non le modèle de l'itération (enregistrements `export` et `choose` de forge) — un verdict seul ne met rien en service :

| Verdict | Non choisi | Choisi |
|---|---|---|
| **better** | *mesurablement meilleur : non mis en service — la communauté ne l'a pas choisi* | *mesurablement meilleur : mis en service* |
| **worse** | *mesurablement moins bon : non utilisé* | *mesurablement moins bon — mis en service …* |
| **no-change** | *aucun changement mesurable : non utilisé* | *aucun changement mesurable — mis en service …* |
| **too-few** | *trop peu de phrases d'exercice pour se prononcer (moins de 50) : les évaluations en aveugle du locuteur décident* | *trop peu de phrases d'exercice pour se prononcer (moins de 50) — mis en service …* |

« Mis en service … » se termine par *d'après les évaluations en aveugle du locuteur* lorsque forge détient un verdict de locuteur pour ce modèle avec `clear: newer` (`improve-speaker`), et par *selon le choix de la communauté* dans le cas contraire. `champollion improve status` emploie les mêmes termes : la ligne de chaque itération se termine par *« · nouveau modèle sur les phrases d'exercice (dev) : … »*. La règle relative au verdict se trouve dans [mesure](/docs/agents/measurement#comparing-two-models).

**Les vérifications.**

- *Surapprentissage.* Si le chrF++ de dev du modèle en service a augmenté de
  3 points ou plus au fil des séries (le nouveau modèle de la dernière série ne
  compte qu'une fois choisi par la communauté) alors que la proportion de
  phrases correctes du locuteur a augmenté de 2 points ou moins, le rapport
  indique que le gain pourrait n'appartenir qu'aux phrases d'entraînement, et
  qu'il faut faire confiance aux évaluations.
- *Un jeu de dev trop petit pour observer un gain.* Lorsque la plus petite
  différence mise en évidence de manière fiable par le jeu de dev est supérieure
  à 3 points de chrF++ (ou, si elle est inconnue, avec moins de 50 phrases), le
  rapport indique que l'absence de « changement mesurable » est une limite propre
  au jeu de dev, et non la preuve que la série n'a rien apporté.
- *Dans quelle mesure on peut faire confiance aux évaluations.* Dès lors que
  10 lignes réaffichées ont été évaluées, toutes séries confondues : *"Le
  locuteur a évalué A lignes réaffichées sur J de la même manière qu'auparavant
  (P %) : environ E % des évaluations s'inversent de manière aléatoire, ce qui
  tire chaque proportion de phrases jugées correctes vers 50 % — la projection
  en tient compte."* Lorsque les brouillons autrefois jugés incorrects et
  désormais notés corrects dépassent nettement le cas inverse (test des signes
  à 5 %, 6 inversions ou plus), il ajoute : *"l'évaluation devient peut-être plus
  indulgente, ce qu'une hausse de la proportion ne révélerait pas"*. Avant 10 :
  *"N lignes réaffichées évaluées jusqu'ici — l'erreur d'évaluation propre au
  locuteur est estimée à partir de 10."*

**La projection.** Établie uniquement lorsque la hausse constitue un progrès
réel (les trois conditions ci-dessus étant réunies) et que la proportion de
phrases correctes demeure inférieure à 80 % — le terme employé par les rails
pour qualifier un modèle qui *fonctionne* sur les phrases dont la famille a
besoin. Les courbes d'apprentissage progressant par paliers à peu près
réguliers à chaque doublement des phrases d'entraînement, la projection déduit
donc ce palier des vérifications à l'aveugle menées par le locuteur pour chaque
nouveau modèle par rapport à celui qu'il a remplacé (les paires d'entraînement
des deux modèles étant enregistrées) et indique le nombre de phrases
d'entraînement supplémentaires nécessaires pour atteindre 80 % d'évaluations
correctes, accompagné d'une fourchette, ainsi que le temps de travail du
locuteur en heures à raison d'environ 70 secondes par phrase (une minute pour
rédiger, dix secondes pour évaluer). La fourchette couvre ce que permettent les
vérifications (95 %) et, dès lors que 10 lignes réaffichées ont été évaluées, le
niveau auquel une qualité « véritablement correcte à 80 % » peut se situer
selon les évaluations propres à ce locuteur ; le texte indique alors : *"les
brouillons véritablement corrects à 80 % peuvent être évalués comme corrects
environ T % du temps d'après ses notations — la fourchette en tient compte"*.
Auparavant, il indique : *"(L'erreur d'évaluation propre au locuteur n'est pas
encore prise en compte : trop peu de lignes réaffichées ont été évaluées.)"*
L'estimation elle-même s'en tient au simple seuil de 80 %. Les décomptes sont
arrondis à deux chiffres significatifs. Lorsque les vérifications ne permettent
pas de la borner, il indique qu'elles *"ne peuvent pas encore déterminer combien
de phrases supplémentaires seraient nécessaires"*. Dans le cas contraire, il
explique pourquoi il n'y en a aucune — par exemple, *"la vérification à l'aveugle
du locuteur n'a pas encore montré que le nouveau modèle surpassait celui qu'il a
remplacé, de sorte que la hausse peut provenir de l'évaluation, et non du
modèle"*. Précisez toujours qu'il s'agit d'une estimation approximative ; c'est
ce que fait le rapport. En simulation, elle s'est située à un facteur 2 près du
décompte réel dans 69 à 78 % des cas à 400 phrases par série et 53 à 56 % à 800,
et le décompte réel est tombé à l'intérieur de la fourchette dans 89 à 94 % et
76 à 80 % des cas (à 800 phrases par série, 51 à 54 % avant que la fourchette
n'intègre les évaluations du locuteur) ; la régression linéaire qu'elle a
remplacée n'y parvenait qu'à 5 % à 400 phrases. N'affirmez jamais qu'un modèle
« fonctionne peut-être déjà » sur la base de l'erreur d'évaluation du locuteur :
le rapport ne le fait pas, car en simulation, cette remarque était erronée 2 à
3 fois pour chaque fois où elle s'avérait exacte.

**Les actions.** Par ordre de priorité, quatre au maximum : évaluer la feuille de cette itération, ou rédiger les phrases encore manquantes (20 par itération) ; lorsque la comparaison à l'aveugle a conclu que le modèle le plus récent était nettement meilleur, indiquer que *« l'itération a bien été utile, même là où l'ensemble de pratique n'a pas pu le montrer »* — continuer ainsi, et agrandir l'ensemble de pratique permettra au prochain verdict de le constater ; lorsque le locuteur a jugé nettement meilleur le modèle qu'une promotion a remplacé, demander à la communauté s'il convient de rétablir le modèle précédent, et faire en sorte que l'ensemble de pratique ressemble davantage aux phrases dont elle a besoin ; agrandir l'ensemble de pratique, lorsqu'il est trop restreint pour déceler le gain d'une itération et compte moins de 200 phrases (*« une phrase sur 2 sur chaque feuille n'a pas de brouillon — le locuteur écrit la façon dont elle se dit, et elle rejoint l'ensemble de pratique (actuellement 31 ; 50 permettent d'évaluer une itération, 200 permettent de faire apparaître un gain d'environ 3 points) »* — « 1 sur 4 » à partir de 50) ; la marche à suivre après deux itérations sans gain (ci-dessous) ; le fait que le temps que le locuteur a indiqué pouvoir consacrer semble trop restreint ; et, une fois que la borne inférieure de la proportion de phrases correctes atteint 70 %, une vérification sur l'ensemble de test verrouillé — après avoir préalablement rédigé une prédiction.

**Deux itérations sans gain** — les deux derniers verdicts étant tous deux **no-change** ou **worse** (une itération **too-few** ne permet de conclure dans aucun sens et ne compte pas), sans qu'aucun modèle n'ait été mis en service entre elles ; forge décompte de la même manière pour la proposition de modèle plus robuste. Lorsque le jeu d'exercice permet de déceler le gain habituel d'une itération, l'action indique *« Deux itérations sans gain décelable par ce jeu d'exercice (environ X points de chrF++ ou plus) : les itérations apportent peut-être moins que cela, ou rien du tout — impossible de trancher. Des pistes plus rapides pour progresser : le modèle plus robuste proposé par les rails lorsque l'ordinateur a la capacité d'en entraîner un, ou davantage de phrases du type de celles où il commet des erreurs. »* (X correspond à la plus petite différence mise en évidence par le verdict.) Lorsqu'il ne le permet pas, elle indique de poursuivre. Ne dites ni ne sous-entendez jamais que des phrases supplémentaires ne seront d'aucune utilité : près du sommet de la courbe, une itération apporte environ un demi-point de chrF++, ce qui est inférieur à ce que 200 phrases d'exercice peuvent révéler. Lors d'itérations simulées, l'ancienne formulation « d'autres phrases similaires pourraient ne pas aider » a été énoncée dans 98 rapports sur 1 200 alors que le modèle s'améliorait réellement.

### Comment le transmettre

1. **Le progrès d'abord.** Commencez par ce qui a évolué, dans les évaluations du locuteur.
2. **Chaque chiffre avec son unité et son ensemble.** « 9 des 24 nouvelles phrases vérifiées par le locuteur étaient correctes — 38 % », jamais « 38 % ». « chrF++ de 24,1 sur 100 sur les 50 phrases de pratique », jamais « 24,1 ». Un intervalle indique le degré de certitude des outils, pas deux résultats distincts : « quelque part entre 21 % et 57 % — avec 24 phrases, les outils ne peuvent pas être plus sûrs que cela ».
3. **Les vérifications, en toute clarté.** Si le rapport émet un avertissement, indiquez ce dont il avertit.
4. **Les étapes suivantes sous forme d'actions concrètes.** Transformez chaque action en une phrase adressée à la communauté, en citant le fichier qu'elle mentionne.
5. **Transmettez chaque mise en garde mot pour mot.**

**Encouragez ce qui est mesuré.** Une ébauche jugée correcte, une progression dépassant les intervalles, la mise en service d'un nouveau modèle : exprimez-le chaleureusement. La première traduction mérite d'être célébrée. Ne vous réjouissez jamais d'un chiffre que le rapport ne qualifie pas de progrès.

**« Aucun changement mesurable » — avec franchise et bienveillance.** Cela ne signifie pas que le cycle a été vain. Expliquez ce que cela veut dire : sur ce volume de phrases de pratique, seule une différence d'environ cet ordre de grandeur apparaît ; un gain plus modeste est peut-être masqué ; le modèle en service reste utilisé ; les phrases corrigées par le locuteur comptent toujours. Indiquez ensuite l'étape suivante.

**« Trop peu de phrases de pratique pour trancher » — et non « aucun changement ».** En dessous de 50 phrases de pratique, aucune comparaison ne permet de trancher, quels que soient les deux scores ; il ne s'agit pas d'un verdict sur le nouveau modèle. Expliquez ce qui se passe à la place : le modèle en service est conservé pour le moment ; la feuille suivante intègre les brouillons du nouveau modèle sans distinction, et les évaluations du locuteur tranchent ; une ligne sur deux de la feuille ne comporte aucun brouillon, et ces phrases viennent enrichir l'ensemble de pratique jusqu'à ce qu'une itération puisse y être évaluée.

**La comparaison à l'aveugle — avec les deux décomptes et ses effets.** Indiquez les décomptes des deux modèles ainsi que la conclusion du rapport, tels qu'ils sont rédigés. Lorsque le nouveau modèle est nettement meilleur, formulez-le comme le fait le rapport — l'itération a bien été utile, même là où l'ensemble de pratique n'a pas pu le montrer — et précisez qu'il s'agit du propre jugement du locuteur sur de nouvelles phrases. Après un verdict **too-few** ou **no-change** sur ce modèle, une nette préférence amène forge à proposer sa mise en service : `improve marks` affiche *« forge l'a enregistré : il propose de mettre le nouveau modèle en service (la communauté doit d'abord donner son accord) »*, et la proposition apparaît sous la forme de l'étape `improve-promote` (ci-dessous) — demandez leur accord avant de l'exécuter. Après un verdict **worse**, il n'est pas proposé. Après une promotion, cette même vérification est ce qui permet au rapport de considérer une progression comme un réel progrès ; lorsqu'elle indique que le modèle remplacé était nettement meilleur, demandez à la communauté s'il faut rétablir le modèle antérieur — ne le faites jamais sans son accord. « Aucune différence nette » sur 24 phrases signifie exactement ce que cela veut dire.
**Remarque.** Ne révélez jamais au locuteur quelles lignes proviennent de quel modèle avant que ses évaluations ne soient relevées.

**Lignes réaffichées — à quoi elles servent.** Indiquez la concordance avec ses
décomptes, tout comme le fait le rapport (« le locuteur a évalué 17 lignes
réaffichées sur 20 comme auparavant — 85 % »), ainsi que son utilité :
déterminer dans quelle mesure on peut faire confiance aux évaluations. Cela est
annoncé sur la feuille, et ne constitue pas un contrôle dissimulé du locuteur.
Énoncez l'erreur aléatoire de la même manière que le rapport : environ E % des
évaluations s'inversent de manière aléatoire, ce qui tire chaque proportion vers
50 %, et la projection en tient compte. Lorsque le rapport indique que
*"l'évaluation devient peut-être plus indulgente"*, dites-le clairement et sans
reproche : une hausse de la proportion peut alors provenir de l'évaluation, et
non du modèle. **Remarque.** Ne dites jamais au locuteur quelles lignes
réapparaissent, ni ce qu'il a noté auparavant — la feuille indique uniquement
que quelques lignes reviennent.

**Mots que le modèle n'a jamais vus.** Lorsque `sync` avertit que des clés *« contiennent des mots que le modèle n'a jamais rencontrés lors de l'entraînement — très probablement mal traduits, quelle que soit leur fluidité »*, dites-le sans détour : ces lignes sont très probablement fausses même si elles semblent naturelles ; un locuteur devrait les vérifier, ou les phrases du prochain cycle peuvent enseigner ces mots. Nommez les clés, comme le fait l'avertissement ; vous ne voyez jamais les mots. La personne les voit sur la page de test du modèle, sous chaque ligne. La preuve empirique, sur la langue test inventée : les phrases contenant un mot que le modèle n'avait jamais vu étaient correctes 0 fois sur 358 ([mise à disposition](/docs/agents/serving#words-the-model-never-saw)).

**Les mots de la liste de souhaits.** Sa section « Mots qu'il n'a jamais vus » demande *« deux ou trois phrases pour chaque mot dont vous avez besoin, chacune exprimant quelque chose de différent »* : moins de mots, chacun intégré dans plusieurs phrases, enseignent davantage au modèle que beaucoup de mots vus une seule fois. Transmettez-le ainsi. Sur la langue test inventée, un mot rencontré une seule fois à l'entraînement était correctement traduit dans 27 à 29 % des cas, et lorsqu'il était rencontré 2 à 4 fois, dans 63 à 95 % des cas ; et avec 3 200 phrases d'entraînement, ByT5-small entraîné sur des phrases sélectionnées pour comporter le plus de mots nouveaux obtenait un sens correct sur 39,4 % de 500 phrases d'évaluation mises de côté, contre 53,4 % pour des phrases courantes — en mobilisant un peu plus de temps du locuteur (environ 57 heures contre 54).

Ne qualifiez jamais vous-même un score de bon ou de mauvais. C'est à un locuteur maîtrisant la langue de décider de ce qui est prêt à l'emploi.

## Demander du temps

L'étape `improve-time` (mode `ask_user`) demande combien de temps le locuteur peut consacrer : `per_week` et `total`, chacun **exactement comme il l'a exprimé** (« peut-être 30 phrases par semaine », « quelques heures, puis on verra »). C'est consigné par `champollion improve time` dans `improve/time.json` ; le nombre de phrases de chaque cycle est planifié en fonction de cela, et le rapport y compare la projection.

- **Remarque.** Demandez une seule fois ; n'insistez jamais pour en obtenir plus. S'ils ne savent pas, transmettez ce qu'ils ont dit — des mots imprécis constituent une réponse.
- **Remarque.** Lorsque le rapport indique que la projection nécessite plus de phrases que le temps qu'ils ont déclaré disponible, dites-le-leur clairement, en présentant les options qu'il mentionne : d'autres locuteurs, des contributeurs sur le projet, ou un objectif plus restreint pour le moment (un recueil de phrases pour celles dont ils ont le plus besoin). Laissez-les ensuite décider.

## Les propositions faites par les rails

**Proposer la mise en service d'un meilleur modèle** (état de forge `improve-promote`, mode `confirm`). Un nouveau modèle s'est avéré mesurablement meilleur sur le jeu dev — ou le jeu dev n'a pas pu trancher (**too-few** ou **no-change**) et le locuteur, en évaluant à l'aveugle, l'a jugé correct nettement plus souvent. Dès lors, `why` de forge ajoute les décomptes du locuteur : *« Évaluant à l'aveugle au cours de la même visite, le locuteur a jugé le nouveau modèle correct sur A phrases nouvelles sur B (P %) et le modèle en service sur C sur D (Q %) — une différence nette : le nouveau modèle est meilleur sur les phrases dont la famille a besoin. »* Précisez duquel il s'agissait. Il s'agit d'une proposition : un verdict seul ne modifie rien. Sa mise en service modifie les réponses fournies par leur page ou application ; demandez donc confirmation avant d'exécuter l'étape ; en cas de réponse « pas maintenant », `declined: true`. Seul leur accord — les `export` et `choose` de l'étape — permet de le mettre en service ; jusque-là, le rapport indique *« mesurablement meilleur : non mis en service — la communauté ne l'a pas choisi »*, et aucune progression n'est comptabilisée à partir de celui-ci. Une fois choisi d'après les évaluations du locuteur, la ligne de l'itération indique *« mis en service d'après les évaluations en aveugle du locuteur »*.

**Un modèle plus robuste** (état de forge `improve-stronger-model`, mode `ask_user`).
Après deux itérations consécutives dont le jeu dev a pu évaluer l'absence de gain —
toutes deux **no-change** ou **worse** ; une itération **too-few** ne comptant pas —
décomptées à partir du dernier changement de modèle (changement de préréglage, ou tout modèle que la communauté a mis en service avec `choose`, y compris une promotion fondée sur les évaluations du locuteur), lorsque le modèle tiny est en service, les rails proposent ByT5-small
— `byt5-small`, ou `byt5-small-lowmem` lorsque le GPU dispose de 8 à 15 Go de mémoire pour l'entraînement (moins de mémoire par étape, plus lent) : un téléchargement d'environ 1,2 Go et un entraînement plus long, idéal sur Apple silicon ou un GPU NVIDIA ([entraînement](/docs/agents/training#models)). L'emplacement de réponse est `try_it` : `yes` ou `not-now`. Restituez ce qu'indique `why` de forge — lorsque le jeu dev est trop restreint pour déceler le gain d'une itération, précisez que de légers gains peuvent être masqués ; dans le cas contraire, que les deux itérations n'ont apporté *« aucun changement décelable par les phrases dev (environ X points de chrF++ ou plus) : les itérations apportent peut-être moins que cela, ou rien du tout »*. Cela ne signifie pas que davantage de phrases ne serviraient à rien, et vous ne devez pas l'affirmer non plus. « Pas maintenant » constitue l'une des réponses à cette étape : transmettez `try_it: "not-now"` (via MCP, `declined: true` est refusé ici). Forge l'enregistre, maintient le modèle en service, et la proposition ne réapparaît qu'après deux nouvelles itérations de ce type (**no-change** ou **worse**). L'une ou l'autre réponse convient ; la décision leur appartient.

**Évaluer la prédiction.** Après l'obtention d'un score sur le jeu de test, les personnes indiquent si la prédiction qu'elles avaient formulée s'est vérifiée (`held` ou `missed`) et qui l'a évaluée. Lisez-leur la prédiction ainsi que le score et son intervalle ; ne portez jamais de jugement à leur place.

**Locuteurs n'ayant pas encore donné leur accord.** La présence d'un fichier dans `waiting_for_agreement` fait l'objet d'une demande par session, avec tact. Seule une réponse affirmative de la personne — confirmant que chaque individu dont les paroles y figurent a donné son accord — permet de valider.

## Les termes à employer avec la communauté

| Dites | Au lieu de |
|---|---|
| « un score sur 100 indiquant à quel point les traductions se rapprochent de celles du locuteur — chrF++ » | « chrF++ 24,1 » seul |
| « le degré de certitude des outils : quelque part entre 21 % et 57 % » | « IC [0,21, 0,57] » |
| « les phrases de pratique » (l'ensemble de dev) | « split dev » |
| « les phrases de test, gardées sous clé » | « jeu de test réservé » |
| « le premier petit modèle » | le nom de son dossier ou de son exécution |
| « aucun changement mesurable — sur 50 phrases de pratique, seule une différence d'environ 6 points apparaît » | « aucune amélioration » |
| « trop peu de phrases de pratique pour trancher pour l'instant — en dessous de 50, les évaluations du locuteur tranchent » | « aucun changement » pour un verdict too-few |
| « un guide de conversation : efficace pour les phrases semblables à celles qu'il a apprises » | « baseline NMT pour langues peu dotées » |
| « le locuteur en a jugé 9 sur 24 correctes » | « exactitude 38 % » |

Expliquez un terme lors de sa première apparition, en donnant un exemple avant le mot lui-même.

## Quand proposer de l'aide

- **Le projet est bloqué, ou ils sollicitent une aide humaine.** Dites : *« Vous rencontrez des difficultés ou souhaitez de l'aide pour votre projet ? Échangeons ensemble. »* — [info@champollion.dev](mailto:info@champollion.dev). Jamais obligatoire ; aucune tarification.
- **Ils ont besoin de plus de phrases, de locuteurs ou de puissance de calcul qu'ils n'en ont.** Orientez-les vers [Rejoindre un projet](/docs/join-a-project) : d'autres personnes peuvent proposer des phrases, des listes de mots ou des méthodes (uniquement sous forme de fichiers, aujourd'hui), et rien de ce qui leur appartient ne sort sans leur accord ([hébergement et participation](/docs/agents/hosting-and-joining)).

## Approfondir

- [Améliorer cycle après cycle](/docs/make-it-better) — la boucle d'amélioration telle que la communauté la lit.
- [Règles de mesure](/docs/agents/measurement) — la règle de verdict, les intervalles et les limites du jeu de dev.
- [Entraînement avec nmt-forge](/docs/agents/training) — ce qu'est le modèle plus puissant et ce qu'il coûte.
- [Le contrat d'exploitation](/docs/agents/contract) § 5 — ne dire que ce qui est vrai.
