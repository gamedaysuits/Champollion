---
sidebar_position: 8
title: "Wachtrijconstructiespecificatie"
slug: '/network/specifications/queue-construction'
description: "De transparante formule achter de community-compute-wachtrij: rangschikking op basis van verwachte ketenwaarde, elk onderdeel gepubliceerd, elke rang handmatig te herleiden."
related:
  - label: "Why the Queue Is Built This Way"
    to: /docs/network/perspectives/why-the-queue
    kind: position
    note: "The philosophy behind this formula"
  - label: "Contributing Compute"
    to: /docs/network/getting-started/contributing-compute
    kind: guide
    note: "How to actually run queue items"
  - label: "Scoring Specification"
    to: /docs/network/specifications/scoring
    kind: spec
  - label: "Corpus Design Framework"
    to: /docs/network/specifications/corpus-design
    kind: spec
    note: "Small-corpus floors and noise thresholds the formula inherits"
---

# Wachtrijconstructiespecificatie

**Formelversie: `ecv-v3` (verwachte ketenwaarde met brugbetrouwbaarheid).** Dit document is de normatieve definitie van de volgorde van
[champollion.dev/queue.json](https://champollion.dev/queue.json). De implementatie
(`arena/scripts/generate_sweep_queue.py` in de publieke harness-repository)
weerspiegelt deze pagina sectie voor sectie; de metadata van de wachtrij echoot de exacte parameterwaarden die bij het genereren zijn gebruikt, en **elk item bevat zijn volledige formelafleiding**, zodat elke rang met de hand kan worden herleid uit de gepubliceerde JSON alleen. Als deze pagina en de wachtrij ooit van elkaar afwijken, is dat een fout — meld dit alstublieft.

**De wachtrij vandaag, in één alinea.** De openbare wachtrij (queue) bevat zowel LLM-items (naïeve en gecoachte prompting-condities) als MT-service engine-items op één bord, gerangschikt volgens de survey-ordening (`map`, §2.2): eerste licht over paren, talen en taalfamilies per dollar, met een boost voor eerste meting (first-reading boost) voor talen die nog nooit zijn gemeten (§2.2), budgetniveaus (budget tiers) gepubliceerd in de preview (§2.1.1), en de volledige rangschikking geserveerd vanuit de database (het statische bestand bevat het bovenste deel wanneer de volledige rangschikking de maximale grootte overschrijdt, en vermeldt dit). De onderstaande secties vormen de normatieve definitie, bewaard met hun gedateerde beslissingsgeschiedenis — de metadata van elke geserveerde wachtrij benoemt de exacte parameters die deze hebben gerangschikt.

> **v3 (2026-06-13).** Elke verbinding is nu een *brug* met twee getallen —
> kwaliteit en betrouwbaarheid — en de ketenmatrix werkt op hun product
> (§1.5). 62 enkelvoudige woordenschatitems die eenmalig worden uitgevoerd, kunnen niet langer als een pad worden beschouwd; herhalingen, grotere corpora, rijkere corpora en nauwere betrouwbaarheidsintervallen dragen alle een geprijsde waarde. v2-wachtrijen
> (alleen kwaliteit) blijven interpreteerbaar via hun eigen metadata.

## 1. Het doel: een kwaliteitsgewogen netwerk

De missie is *elke taal naar elke taal via gemeten individuele paarsketens*. Een vertaling tussen twee talen zonder directe benchmark wordt bediend door **ketening** van gebenchmarkte paren
(X→spil→Y), zodat de waarde van de benchmark niet wordt bepaald door het aantal corpora, maar door de **ketencapaciteit van de graaf**.

**Definities.** Laat de *benchmarkgraaf* één knoop per taal hebben
en, voor elk taalpaar met ten minste één gepubliceerde, niet-gediskwalificeerde
uitvoering, een **verbindingssterkte**

```
s(e) = (best published corpus-level chrF++ on that pair) / 100   ∈ [0, 1]
```

Corpus-niveau chrF++ is het canonieke gepubliceerde getal (zie de
[Scoringsspecificatie](/docs/network/specifications/scoring)); *best* omdat
een keten door het best aangetoonde systeem per stap zou worden geleid.
Paren zonder gepubliceerde uitvoeringen hebben s(e) = 0.

De **geschatte ketensterkte** van een pad P tussen twee talen is

```
strength(P) = λ^(|P|−1) · Π_{e ∈ P} s(e)
```

— verbindingskwaliteiten worden multiplicatief samengesteld, en elke *knooppunt* (elke tussenliggende spil) kost een extra fideliteitsfactor **λ < 1**.
Beide keuzes zijn gegrond in de literatuur over spilvertaling:
vertaling via een spil verliest betrouwbaar kwaliteit ten opzichte van directe
vertaling, buiten wat naïeve samenstelling suggereert (Utiyama & Isahara
2007; Wu & Wang 2007), de omvang van het verlies hangt af van de gekozen spil (Paul et al. 2009), en het bouwen van *directe* niet-Engelscentrische
paren verslaat aantoonbaar Engels-spilvertaling op schaal — met ~10 BLEU in
de many-to-many-instelling van M2M-100 (Fan et al. 2021). λ is de vaste herinnering van de formule dat een geschatte keten geen meting is: alleen een directe uitvoering verwijdert de korting.

De **beste-ketenmatrix** en het **netwerk-doel** zijn dan

```
Q(u,v) = max over paths P from u to v of strength(P)      (1 if u = v, 0 if disconnected)

Φ = mean over ordered language pairs (u ≠ v) of Q(u,v)    ∈ [0, 1]
```

Q wordt exact berekend als een kortste-padprobleem onder de standaard
logtransformatie (verbindingsgewicht −ln(λ·s(e)) ≥ 0, Dijkstra, dan
Q = exp(−d)/λ). Φ is de [Latora & Marchiori
(2001)](https://arxiv.org/abs/cond-mat/0101396) *globale efficiëntie*-constructie waarbij de 1/afstand-kernel is vervangen door multiplicatieve
ketenfideliteit — de natuurlijke kernel wanneer verbindingen kwaliteitsbehoud per stap dragen in plaats van eenheidslengte. (Wachtrij v1 rangschikt op ongewogen globale efficiëntiewinst — het speciale geval van deze familie waarbij alles wat u over een verbinding weet is of deze bestaat.)

### 1.5 Betrouwbaarheid: een brug is (q, r)

Een opvallende score op een klein, dun, nooit-gerepliceerd corpus is geen
brug. v3 splitst daarom elke gemeten verbinding in:

```
quality      q(e)   = best published corpus-level chrF++ / 100
reliability  r(e)   = f_size · f_rich · f_conf · f_repl        ∈ [0, 1]
effective    s_eff(e) = q(e) · r(e)        ← what chains compose over
```

| Factor | Definitie | Volledige krediet bij | Anker |
|---|---|---|---|
| `f_size` | min(1, n/100), n = geëvalueerde vermeldingen van de beste uitvoering | 100 vermeldingen | de [corpusontwerp](/docs/network/specifications/corpus-design)-significantiedrempel; Koehn (2004) valideert bootstrap-testen op ~300-zinssets — zelfs 300 is "klein", dus omvang geeft korting op betrouwbaarheid in plaats van enkel weergave te beperken |
| `f_rich` | min(1, L̄/5), L̄ = gemiddelde *effectieve* bronlengte | 5 effectieve woorden | AmericasNLP (Mager et al. 2021) adopteerde chrF omdat woordniveau-eenheden breken op rijke morfologie; Mager et al. (2022) documenteren witruimtetokens als de verkeerde eenheid |
| `f_conf` | min(1, 5/h), h = de halve breedte van het 95%-BI van de beste uitvoering (proxy `50/√n` wanneer niet gepubliceerd) | BI ≤ ±5 chrF | de ruisdrempel waaronder delta's niet te onderscheiden zijn op kleine corpora; Kocmi et al. (2021) tonen aan dat delta's binnen het BI frequent menselijke voorkeur tegenspreken |
| `f_repl` | min(1, uitvoeringen/2) | 2 gepubliceerde uitvoeringen | Marie, Fujita & Rubino (2021), meta-evaluatie van 769 papers: niet-gerepliceerde enkelvoudige vergelijkingen zijn het gedocumenteerde geloofwaardigheidsprobleem van het vakgebied |

**Effectieve lengte** wordt gemeten in inhoudseenheden, niet in witruimtewoorden: `L̄ = mean source chars / c(L)`, waarbij de *tekeneconomie*
`c(L)` de mediaan tekens is aan de kant van taal L per Engels woord
aan de uitgelijnde kant, gemeten uit de eigen parallelle corpora van dit project
(7.400+ uitgelijnde vermeldingen bij v3-verzending: cmn 1,6, jpn 2,3, kor 2,6;
eng basislijn 5,0; deu 6,0; crk 4,7 — polysynthetische woorden geprijsd naar de inhoud die ze dragen). Geen opzoektabellen voor typologie; de schatting wordt scherper naarmate corpora groeien; talen zonder eng-gekoppelde gegevens gebruiken de standaardeconomie. Per corpus gestempeld in het register (`richness`-blok).

**Brugtiers** (weergavevocabulaire): **vastgesteld** — n ≥ 100,
L̄ ≥ 5, h ≤ 5, uitvoeringen ≥ 2; **voorlopig** — gemeten maar niet aan alle criteria voldoend; **geregistreerd** — geen gepubliceerde uitvoeringen. Een ketenclaim ("u kunt van X naar Y komen") is slechts zo sterk als de tier van de zwakste stap, en de netwerkvisualisatie toont betrouwbaarheid als verbindingsopaciteit.

**Uitgewerkte controles** (uit het ingecheckte verificatiescript, uitgevoerd vóór
v3-verzending): *62 enkelvoudige woordenschatitems, één uitvoering* → r ≈ **0,04**
(geen pad); *200 zinnen, ±3 BI, 3 uitvoeringen* → r = **1,00**; een
101-vermelding Japans corpus waarvan de naïeve woordtelling 1,0 is (scriptartefact) rehabiliteert naar 6,5 effectieve woorden en volledige `f_rich`.
Grenzen en per-factor-monotoniciteit worden eigenschap-getest.

**Waarde van een uitvoering onder v3.** Een uitvoering kan een brug op twee manieren verbeteren, en
ΔΦ neemt de beste van: **(a)** het wordt de beste uitvoering van de verbinding —
`ŝ_eff = voorspelde kwaliteit × r(n van zijn corpus, rijkheid, BI-proxy,
uitvoeringen+1)`; of **(b)** het repliceert slechts — de huidige beste blijft,
`f_repl` stijgt. Replicatie op een enkelvoudige-uitvoeringsverbinding is daarom echte,
geprijsde waarde, en een groter of rijker corpus op een gemeten paar
overtreft een heruitvoering van het kleine. Items tonen `edge_quality`,
`edge_reliability`, `edge_tier`, `effective_strength`,
`post_run_reliability` en `predicted_effective` naast de v2-voorspellingsvelden.

**Wat Φ niet is.** Φ is de interne prioriteringsvaluta van de wachtrij,
geen capabiliteitsclaim. De invoer zijn ontwikkelingssetscores met alle
voorbehouden van het [Corpusontwerpraamwerk](/docs/network/specifications/corpus-design): mogelijke trainingsdata-contaminatie maakt elke score een bovengrens, chrF++-waarden zijn niet strikt vergelijkbaar over talen heen, en kleine corpora hebben brede
betrouwbaarheidsintervallen. De formule heeft Φ alleen nodig om *uitvoeringen te ordenen op bruikbaarheid*; het wordt nooit gepubliceerd als kwaliteitsgarantie.

## 2. Het beslissingsprobleem

De open items van de wachtrij zijn elke (corpus, model, conditie)-combinatie die in aanmerking komt (development split, herdistribueerbare licentie, niet in quarantaine, transmissie-geschikt, en **benchmark-resolvable** — zie de language-identity gate in §2.2) en nog niet op het leaderboard staat. Identieke herhalingen van reeds behandelde combinaties worden uitgesloten — run-card fingerprints ontdubbelen deze bij publicatie — maar nieuwe modellen of condities op een reeds gemeten paar blijven open items.

Bijgedragen rekenkracht is een budget. Kiezen welk open item als volgende wordt uitgevoerd zodat het netwerk het snelst verbetert, is een gebudgetteerde dekkingsmaximalisatie, en de canonieke aanpak is gretige selectie op basis van
**marginale waarde per kosteneenheid**: voor monotone submodulaire doelstellingen
draagt de gretige regel de klassieke (1 − 1/e)-garantie (Nemhauser,
Wolsey & Fisher 1978), en de voordeel/kostenverhouding-vorm is het standaardalgoritme onder budgetten (Khuller, Moss & Naor 1999). We gebruiken de
verhoudingsregel als ons rangschikkingsprincipe. (Eerlijkheidsopmerking: ons doel heeft
dekkingsachtige afnemende meeropbrengsten in zijn deterministische kern, maar de
stochastische voorspellingslaag betekent dat we de gretige garantie citeren als
*motivatie*, niet als een stelling over dit exacte systeem.)

```
ECV(item) = ΔΦ(item) / max(est_cost_usd, COST_FLOOR)
```

Items worden gerangschikt op ECV aflopend. Gelijke standen worden als volgt opgelost: naïef vóór begeleid, goedkoper eerst, dan item-id.

### 2.1 Rangschikkingscorrecties — 2026-07-12

Vier aanpassingen bovenop de greedy ECV-regel, elk weerspiegeld in de
metadata van de wachtrij (`priority_parameters.contamination_ecv_factors`,
`priority_parameters.frontier_interleave`, `metadata.preview_policy`):

1. **Contaminatiemultiplicator.** De ECV van elk item wordt vermenigvuldigd met
   een factor op basis van de contaminatiegraad van het corpus: **LOW 1.0 / MEDIUM
   0.4 / HIGH 0.1**, waarbij een onbekende of ontbrekende graad als
   MEDIUM wordt behandeld (ga nooit uit van schone data). Motivatie: de schone ketengraph laat
   alleen LOW-contaminatie-edges toe, zodat een niet-LOW-run er geen deel van kan uitmaken
   en schoon mesh-werk bij gelijke kosten niet mag overtreffen. Niet-LOW-items
   blijven in de wachtrij staan — relatieve vergelijkingen binnen een lane zijn reële waarde — ze
   rangschikken zich enkel achter schoon werk.
2. **Frontier-interleaving.** Na de greedy sortering krijgt elke 5e prioriteitsslot
   het hoogst gerangschikte nog niet geplaatste item uit de
   frontier-modelset (bijgehouden als data in de generator en weerspiegeld
   in de metadata), zodat frontier-bewijs vroeg de voorspellingspriors bereikt
   in plaats van pas nadat de goedkope lagen verzadigd zijn. Uitsluitend herordening:
   er wordt niets weggelaten of gedupliceerd; een frontier-item dat een natuurlijke
   slot verdiende behoudt dit, en prioriteiten worden genummerd op basis van de geweven volgorde —
   de gepubliceerde rangschikking is de waarheid.
3. **Bronhub-limiet voor preview.** De publieke preview van de top-25 toont
   maximaal **6** items met dezelfde brontaal, zodat één goed
   bedeelde hub het etalage niet kan domineren. Items boven de limiet
   behouden hun werkelijke prioriteit in de volledige wachtrij; de preview
   trekt eenvoudigweg het volgende in aanmerking komende item op volgorde van rangschikking.
4. **Uitsluiting van geconstrueerde talen in de preview.** Items waarvan de bron- of
   doeltaal een geconstrueerde taal is, worden overgeslagen door de preview. De
   bepaling is gebaseerd op de kaartfamilie (Glottolog's Artificial
   Language-bucket, uitgelezen uit de taalkaarten — nooit een hardgecodeerde
   taalset), en de afgeleide codelijst wordt gepubliceerd in
   `metadata.preview_policy` zodat server-side verversingen dezelfde
   selectie toepassen.

(3) en (4) zijn **uitsluitend presentatiebeleid**: de volledige `queue.json`,
de rangschikking ervan en de prioriteiten worden niet beïnvloed.

### 2.1.1 Budgetniveaus — "wat koopt u voor $X?" (2026-08-24)

`queue-preview.json` bevat een `budget_tiers`-array die voor budgetten van **$1 / $10 / $100 / $1000** de greedy betaalbare prefix van de gepubliceerde rangschikking samenvat: doorloop de items in prioriteitsvolgorde, neem elk item waarvan de geschatte kosten nog binnen het budget vallen, sla de items over waarbij dit niet het geval is, en blijf aanvullen met latere, goedkopere items. Elk niveau (tier) rapporteert hoeveel items daarmee worden gekocht, hun totale geschatte kosten, hoeveel verschillende talenparen en modellen ze betrekken, en hoe diep het budget in de rangschikking reikt (`max_priority`).

Omdat de rangschikking al is gebaseerd op marginale waarde per kosten (§2), **is** de greedy betaalbare prefix de allocatie die dit model aanbeveelt voor die uitgave — een kleine en een grote bijdrager lezen elk een concreet, optimaal antwoord uit dezelfde gepubliceerde rangschikking, in plaats van één lijst die impliciet op niemand is afgestemd. De niveaus zijn slechts samenvattingen: de allocatie zelf is simpelweg de rangschikking, in volgorde doorlopen tegen uw eigen budget. Server-side vernieuwingen herberekenen de niveaus over de resterende items met een identieke doorloop (de generator en de vernieuwingsfunctie implementeren dit als tweelingen, getest aan beide kanten).

### 2.2 Lanes en rangschikkingsmodi — 2026-07-19

De geserveerde wachtrij verklaart in zijn eigen metadata welke **lane** deze bevat en welke **rangschikkingsmodus** (ranking mode) deze heeft geordend. De metadata is leidend; deze sectie definieert de terminologie.

**Lanes** (`metadata.lane`, `metadata.lane_policy`). Sinds 2026-08-27 bevat de openbare wachtrij de **both**-lane: LLM-items (model × prompting-conditie) **en** MT-service-items (conditie `engine` — DeepL, Google Translate, Microsoft Translator, LibreTranslate, Tilde; elk plaatst zich alleen in de wachtrij voor paren binnen hun eigen gepubliceerde dekkingslijst). De **llm**-lane van 2026-07-19 — uitsluitend LLM-items, beperkt tot paren waarvan ten minste één kant buiten de gepubliceerde dekking van elke MT-service valt — reserveerde service-benchmarking voor door organisatoren beheerde campagnes die nooit zijn uitgevoerd, waardoor het grootste deel van de catalogus werd geparkeerd; het meten van de services *is* de ruggengraat van de dekkingskaart, dus beide soorten werk staan nu op één bord. De dekkingsunie (macrolanguage-aliased via de language cards) wordt nog steeds weergegeven als `service_coverage_methods` en `service_covered_languages`, en een llm-lane-wachtrij rapporteert zijn uitgesloten paren nog steeds als `pairs_dropped_fully_covered`.

**Blob size cap** (2026-08-27). De geserveerde `queue.json` is een statisch bestand met een harde hostinglimiet, dus wanneer de volledige rangschikking hier te groot voor wordt, bevat het bestand het **bovenste deel** (top slice) van de rangschikking en vermeldt dit in `metadata.blob_truncated {kept, total}` — nooit een stille limiet. De database-wachtrij (`queue_top()` / `queue_pairs()`) serveert altijd de **volledige** rangschikking en is de gezaghebbende werklijst; de paar-aggregatie en budgetniveaus van de preview beschrijven het artefact waarmee ze worden geleverd.

**Language-identity gate** (2026-07-19). Wachtrij-items richten zich uitsluitend op **actieve individuele ISO 639-3-codes** — een score tegen een macrotaal ("Arabisch") of een collectieve familiecode ("Berbertalen") zou een onfalsifieerbare claim zijn over variëteiten die nooit zijn geëvalueerd (dezelfde redenering die FLORES-200/NLLB volgt door data te coderen als `arb`/`quy`/`zsm`). Upstream corpuslabels worden *opgelost* (resolved), nooit blindelings gevolgd of genegeerd: script-tags worden mechanisch gestript (een `eng→cmn-Hans`-corpus wordt in de wachtrij geplaatst voor `eng→cmn`, waarbij het script behouden blijft als item-weergavemetadata `source_script`/ `target_script`); netjes ingetrokken codes volgen hun officiële ISO-opvolger; en een macro-gelabeld corpus wordt alleen in de wachtrij geplaatst onder een geregistreerde, geciteerde **variety resolution** in de bijbehorende registervermelding (bijv. FLORES+ documenteert zijn Quechua als `quy`). Corpora die via geen van beide paden worden opgelost, worden uitgesloten met machineleesbare redenen die zijn gepubliceerd in `metadata.doctrine_exclusions` (totaal, tellingen per reden, redenen per corpus) en geteld in het desert ledger (`service_landscape.invisible_reasons.corpus_excluded_by_doctrine`) — zichtbare uitsluitingen, nooit stille weglatingen. Historische resultaten op corpora met een overkoepelend label behouden hun eigen eerlijk benoemde mesh-node (node `scope`: `macrolanguage` / `collective` / `retired`), en worden nooit samengevoegd in een lid-variëteit. De resolutie-invoer wordt volledig gepubliceerd: de `language_resolution`-stempels per vermelding in het register bevatten de opgeloste codes, scopes en pin-citaties.

**Rangschikkingsmodi** (`metadata.rank_mode`, beschreven in `metadata.priority_model`). Twee ordeningen van dezelfde items:

- **ecv** — de greedy expected-chain-value-regel van §2–§3: mesh-verbetering per geschatte dollar. De exploitatie-ordening; correct wanneer het bord dicht genoeg is voor voorspellingen en ΔΦ om een signaal te dragen.
- **map** (map-value v2) — de survey-ordening: `MapValue = novelty × uncertainty × promise × connectivity × corpus-quality × contamination ÷ cost`, samengesteld door een exacte greedy trace. *Novelty* is positioneel eerste-licht-krediet (first-light credit) dat afneemt naarmate reeds geplaatste items hetzelfde gerichte paar (1/(1+n)), doeltaal, doeltaalfamilie, methode × doeltaalfamilie-cel, en doel × domein-cel bezetten (elk 1/√(1+n); families uit de language cards, domeinen uit de taxonomie van het corpusregister — de vroege dekking van een doel moet zich verspreiden over registers, en niet het eerste gemeten domein herhalen). *Uncertainty* is de back-off-diepte van de voorspelling uit §3.1 (paar 0.25 · doeltaal 0.55 · brontaal 0.75 · globaal 1.0) × 1/(1+gepubliceerde runs op de edge). *Promise* is de voorspelde sterkte uit §3.1 met een ondergrens (floor) van 0.25 — waarschijnlijk werkende onbekenden leiden, en het in kaart brengen van een waarschijnlijke woestijn (desert) heeft nog steeds waarde. *Connectivity* waardeert paren op die **het gemeten netwerk verbinden met een taal die het nog niet kan bereiken**: een eindpunt is *gevestigd* (established) wanneer het op een gemeten mesh-edge ligt (`mesh.json`, status `measured`) of binnen de gepubliceerde dekkingslijst van een MT-service valt (macrolanguage-aliased, dezelfde aliasing als de lane-gate hierboven); **bruggen** (exact één gevestigd eindpunt) en **eilanden** (geen van beide) scoren beide 1.0 — sinds 2026-08-27 telt het eerste licht van een losgekoppelde woestijn volledig mee (eilanden scoorden 0.5 onder de grow-out-of-the-network-dimensionering van 2026-07-19, wat de diepste staart structureel degradeerde) — terwijl **interne** verdichting (beide gevestigd) 0.5 scoort: versterking tussen bekende punten is de taak van de ecv-modus. Een **first-reading boost** (×2.0) vermenigvuldigt bovendien de survey-waarde van elk item waarvan de bron- of doeltaal NUL gepubliceerde metingen waar dan ook heeft — het negende principe, eenvoudig gesteld: **de eerste lezing van een taal overtreft verfijning**. De onzekerheidsfactor alleen kan dit niet uitdrukken (het scoort een ongemeten paar tussen twee goed gemeten talen identiek aan een nooit gemeten taal); de boost maakt het eerste licht van de long tail een expliciet doel in plaats van een onvoorzien toeval. Beide factoren maken gebruik van `metadata.map_value_parameters` en zijn identiek van toepassing binnen de survey-component van edv (§2.3).

  De andere helft van het negende principe bevindt zich BUITEN de rangschikking: geen enkele ordening van bestaande items kan een taal bereiken zonder enig corpus (~7.500 levende talen met een individuele code vandaag de dag). De **corpus-verlanglijst** (corpus wish-list) (`/corpus-wishlist.json`, geregenereerd naast de wachtrij) publiceert die acquisitiegrens (acquisition frontier): elke levende, individuele-code, nul-corpus-taal gerangschikt op het best geciteerde aantal sprekers — het aantal sprekers als de haalbaarheidsproxy voor een gemeenschap die daadwerkelijk een corpus zou kunnen bouwen — waarbij elke telling wordt toegeschreven aan de bron en nooit wordt gearbitreerd.
  *Corpus-quality* is het intrinsieke betrouwbaarheidspotentieel van het corpus `f_size × f_rich` uit §1.5 — de survey moet landen op corpora die gewicht kunnen dragen, zodat een woordenlijst van 62 losse woorden niet langer bovenaan staat puur omdat deze goedkoop is; een ontbrekende rijkdomsmeting (richness measurement) blijft neutraal (afwezigheid van meting is geen bewijs van armoede). Kosten- en contaminatiediscipline zijn identiek aan ecv. De frontier interleave en tie-breaks (§2.1) blijven ongewijzigd van toepassing. Correct voor de survey-fase: het maximaliseert wat de *kaart leert* per dollar — eerste metingen over paren, talen, families, methode-cellen en domeinen, groeiend vanuit het gemeten netwerk in plaats van te versnipperen — tegen de bewuste prijs van een tragere groei van de mesh-sterkte.

> **map-value v2 (2026-07-19).** Twee door de oprichter gestuurde toevoegingen aan de survey-ordening: paren die *een brug slaan naar het gemeten netwerk* rangschikken nu hoger dan losgekoppelde probes en interne verdichting, en corpuskwaliteit (grootte-ondergrens × effectieve rijkdom, §1.5) plus domeinspreiding per doel wegen mee in de rangschikking — rekenkracht van bijdragers (contributor compute) moet gevestigde paden verbinden met nieuwe, op corpora die goed genoeg zijn om het gewicht te dragen. Licentie blijft een **poort, geen gewicht** (gate, not a weight): regels voor licenties en transmissiekanalen bepalen wat überhaupt in de wachtrij mag worden geplaatst (§2, en de `transmission_note` van de wachtrij); onder in aanmerking komende corpora is de rangschikking licentie-blind, zodat beperkte-maar-gepinde onderzoekssets — vaak het enige corpus van een paar — nooit systematisch worden uitgehongerd. v1-wachtrijen (alleen novelty × uncertainty × promise) blijven interpreteerbaar via hun eigen metadata.

De exacte factorwaarden die bij de generatie zijn gebruikt, worden meegeleverd in `metadata.map_value_parameters`; de connectiviteits- en kwaliteitsinvoer zijn herleidbaar uit de gepubliceerde `mesh.json` (gemeten edges), de dekkingsunie van de services die in de metadata wordt weergegeven, en `registry.json` (aantal vermeldingen + rijkdom). Elk item behoudt bovendien de volledige ecv-v3 diagnostische velden, ongeacht de modus, zodat beide ordeningen kunnen worden herleid uit dezelfde artefacten.

### 2.3 Rangschikkingsmodus `edv` — expected decision value (2026-08-27)

*Status: geïmplementeerd, standaard uitgeschakeld in afwachting van de gemeten vergelijking in §2.3.6. De gepubliceerde standaard blijft tot die tijd `map`.*

De wachtrij koopt exact twee producten: de **capability map** (welke methode is goed in wat, met eerlijke onzekerheid) en de **routing mesh** (gemeten paren die aaneenschakelen tot routes). `edv` prijst elk kandidaat-item op basis van hoeveel het beide bevordert, als een gewogen portfolio:

```
EDV(item) = [ w_judge·Ĵ + w_mesh·M̂ + w_survey·Ŝ ] × contamination ÷ max(cost, COST_FLOOR)
```

met standaardwaarden `w_judge = 0.35, w_mesh = 0.25, w_survey = 0.40` (instelbaar door de oprichter; elke generatie geeft de daadwerkelijk gebruikte gewichten weer in `metadata.edv_parameters`). De contaminatiefactor (§2.1 remedie 1) wordt exact één keer toegepast, als de buitenste vermenigvuldiger. Licenties en transmissie blijven **poorten, geen gewichten** — geschiktheid wordt bepaald voordat er enige waarde wordt berekend, en de rangschikking is licentie-blind onder in aanmerking komende corpora.

#### 2.3.1 Ĵ — method-judgment value

Prijst hoeveel de run bijdraagt aan het **beslechten van methodevergelijkingen op hetzelfde corpus** — de enige cross-methode claim die het eigen meetonderzoek van dit project toestaat. (De W2 difficulty-transfer studie verwierp het koppelen van vaardigheden over talen heen; het toegestane positieve resultaat — additieve methode × corpus-aanpassing binnen dezelfde taal — is exact wat deze component gebruikt. Scores worden uitsluitend gebruikt voor ordening en scheiding, en worden nooit omgezet in acceptatiewaarschijnlijkheden, conform de kalibratie-pilot.)

Voor een kandidaat (corpus C, methode M, conditie): de **contrastpartners** zijn de methoden M′ die al een gepubliceerde run hebben op (C, zelfde conditie). Voor elke partner, met `sep` de scorescheiding in chrF-punten over gepoolde CI-halfbreedtes (geregistreerde CI's; proxy `50/√n` indien ongepubliceerd), en `sep_pred` hetzelfde berekend tegen de voorspelde score uit §3.1:

| contraststatus van {M, M′} op het paar | krediet |
|---|---|
| **unmet** — nog geen gedeeld corpus | `JUDGE_FIRST = 1.0` |
| **contested** — gedeelde corpora bestaan, alle `sep < Z_DEC` | `JUDGE_CONTESTED = 0.8 × clip(sep_pred / Z_DEC, 0, 1)` |
| **decided** — enkele `sep ≥ Z_DEC`, n_dec corpora beslissen het | `JUDGE_DECIDED = 0.25 / (1 + n_dec)` |

elk vermenigvuldigd met `w_top = 1/√(rank(M)·rank(M′))` — het beslissen van de eerste plaats tegen de tweede is meer waard dan de zevende tegen de achtste. De methode-rangschikking per paar gebruikt de toegestane additieve methode × corpus-fit (alternating least squares over geobserveerde cellen) wanneer het paar ≥2 methoden × ≥2 corpora gemeten heeft, anders de beste score per methode; de fit is **strikt per paar, nooit gepoold over talen heen**. `Z_DEC = 1.96`.

Een gecoacht-vs-naïef contrast op dezelfde (C, M) voegt `JUDGE_COND = 0.5 / (1 + n_cond)` toe. De contrasten van een item worden opgeteld met afnemende meeropbrengsten (diminishing returns) (`JUDGE_GAMMA = 0.7` per extra contrast, aflopend gesorteerd), plus een **seed-term** `JUDGE_SEED = 0.25 × min(1, m_C/3) × corpus-quality` (m_C = andere line-up methoden met een wachtrij-item op C) zodat een leeg bord nog steeds de voorkeur geeft aan corpora waar toekomstige vergelijkingen kunnen worden beoordeeld — locatiewaarde (venue value), nooit een geleende score. Tijdens de samenstelling neemt de judge-component af met `1/(1 + items already placed on the same pair and condition lane)`.

#### 2.3.2 M̂ en Ŝ

`M̂` is de verwachte mesh-winst (ΔΦ) uit §3, ongewijzigd, waarbij de ketenmatrix (chain matrix) is bevroren op het moment van generatie. `Ŝ` is de kern van map-value v2 uit §2.2 — `uncertainty × promise × connectivity × corpus-quality` met de positionele novelty-afname — ongewijzigd. Het voorspelde score-*niveau* (promise) bevindt zich alleen in Ŝ; Ĵ gebruikt uitsluitend score-*scheidingen* — de twee componenten kunnen hetzelfde optimisme niet dubbel tellen.

#### 2.3.3 Normalisatie

De drie componenten bevinden zich op onvergelijkbare schalen, dus elke statische component wordt gedeeld door zijn 95e percentiel over de kandidaatset (gemaximeerd op `EDV_NORM_CAP = 4.0`); de drie normalisatoren worden meegeleverd in `metadata.edv_parameters.normalizers`, waardoor elke gepubliceerde EDV-waarde herleidbaar is uit zijn eigen artefacten.

#### 2.3.4 Samenstelling

De ordening is exact dezelfde lazy-greedy trace als in de map-modus: elke volgorde-afhankelijke vermenigvuldiger (survey novelty, judge placement decay) is monotoon niet-stijgend naarmate items worden geplaatst, dus een verouderde heap-vermelding kan alleen maar overschatten — de lazy-greedy invariant blijft behouden en de trace is gelijk aan brute-force greedy. Frontier interleave, preview-beleid en budgetniveaus blijven ongewijzigd van toepassing.

#### 2.3.5 Uitlegbaarheid

Elk item behoudt in zijn diagnostiek: de contrastlijst waarvoor het krediet kreeg (partner, status, voorspelde scheiding, ranggewicht), de seed- en decay-termen, alle velden uit §2.2 en §3, de gewichten en normalisatoren — de gepubliceerde EDV-waarde is exact herberekenbaar vanuit de rij. "Hoe heeft dit item deze rang gekregen?" is te beantwoorden zonder enige externe status.

#### 2.3.6 Adoptiecriterium

`edv` wordt pas de gepubliceerde standaard na een gemeten vergelijking met `map` en `ecv` op hetzelfde bord: binnen 10% van map op elke survey-metriek (first-light dieptepercentielen, unieke paren/talen/families op diepte, marginal-new-pair rate), strikt beter op beide judge-metrieken (betwiste contrasten opgelost per gesimuleerde $1k; methode-rangschikking herstel bij vaste uitgaven), en mesh-groei-per-dollar niet slechter dan map. Het vergelijkingsrapport wordt gepubliceerd tegelijk met de omschakeling (flip).

## 3. De waarde van één uitvoering

### 3.1 De score voorspellen vóór uitvoering

De verwachte score van een niet-uitgevoerd (paar, model, conditie) is een
bewust eenvoudige, volledig inspecteerbare som — een tweerichtings-hoofdeffectenvoorspelling plus gestructureerd optimisme, elk term gepubliceerd op het item:

```
ŝ = clip( pair_prior + model_offset + condition_offset + exploration_bonus,  0, S_CAP )
```

- **`pair_prior`** — hiërarchische terugval over gepubliceerde sterktes:
  gemiddelde op dit paar → gemiddelde op deze doeltaal → gemiddelde op deze
  brontaal → globaal gemiddelde → `S0_FALLBACK`. Het gebruikte niveau wordt
  gepubliceerd als `prior_basis`.
- **`model_offset`** — hoe dit model presteert ten opzichte van de *andere*
  modellen op hetzelfde paar, gemiddeld over alle paren waar een vergelijking
  bestaat. Nul voor nooit-geziene modellen.
- **`condition_offset`** — de waargenomen begeleid-minus-naïef delta op
  hetzelfde paar (terugvallend op dezelfde doeltaal), en **nul
  anders**: begeleidingswinsten zijn reëel waar gemeten maar worden niet
  verondersteld over te dragen naar andere talen, dus op niet-bewezen paren geldt de basislijn-eerst-conventie.
- **`exploration_bonus`** — optimisme bij onzekerheid, met
  het UCB1-schema (Auer, Cesa-Bianchi & Fischer 2002):
  `κ·sqrt(2·ln(1+N)/(1+n))`, waarbij N het totale aantal gepubliceerde
  gescoorde uitvoeringen is en n het aantal op dit (paar, model). Nooit-geprobeerde
  cellen krijgen de grootste bonus; goed-gemeten cellen vervagen naar nul.
  We lenen het schema — de vorm die onderverkende armen op het juiste moment laat herrijzen — niet de spijtstelling, die een stationaire bandiet veronderstelt die dit systeem niet is.

### 3.2 De netwerkwinst, in gesloten vorm

Een uitvoering kan het netwerk alleen verbeteren door het verbindingspaar te verhogen naar
`s' = max(s(e), ŝ)`. Voor een enkelvoudige verbindingswijziging negeert de nieuwe beste keten
tussen twee talen de nieuwe verbinding of gebruikt deze precies één keer, zodat de bijgewerkte matrix — en daarmee ΔΦ — een exacte éénregelvorm heeft (geen herberekening van de hele graaf):

```
Q'(u,v) = max( Q(u,v),  E(u,a)·s'·E(b,v),  E(u,b)·s'·E(a,v) )

E(x,y) = λ·Q(x,y) for x ≠ y;  E(x,x) = 1        (edge e = {a, b})

ΔΦ = mean over ordered pairs of (Q'(u,v) − Q(u,v))
```

E is "de beste keten naar het eindpunt van de nieuwe verbinding, waarbij de knooppuntkosten worden betaald om erop aan te sluiten"; de twee termen zijn de twee richtingen van het oversteken van de verbinding. Dit wordt getest in de harness-suite tegen brute-kracht herberekening van Φ.

Een voorspelling die de huidige verbindingssterkte niet kan overtreffen, levert
ΔΦ = 0 op: de formule besteedt het geld van donateurs aan het bevestigen van het onbekende, niet aan het hermeten van het aangetoonde. (De verkenningsbonus voorkomt dat zwakke of ondergesamplede cellen voor altijd worden uitgehongerd.)

### 3.3 Wat telt als bewijs versus wat in de wachtrij kan worden geplaatst

Twee verschillende poorten, bewust asymmetrisch:

- **Bewijs** komt van *elke* gepubliceerde, niet-gediskwalificeerde uitvoering —
  inclusief uitvoeringen op corpora die niet publiekelijk in de wachtrij kunnen worden geplaatst (bijv.
  niet-commercieel gelicentieerde sets). Een gepubliceerde meting van een paar
  is kennis, ongeacht of u het opnieuw kunt uitvoeren.
- **Acties** (wachtrij-items) komen alleen van openlijk uitvoerbare corpora:
  ontwikkelingssplitsing, CC-BY-familie-licentie, door iedereen opvraagbaar.

Talen die alleen bereikbaar zijn via niet-in-de-wachtrij-plaatsbare corpora zitten nog steeds in
de graaf: het verbeteren van verbindingen *rondom* hen verandert hun ketenwaarden,
en de formule houdt hier rekening mee.

## 4. Parameters

| Parameter | Standaard | Betekenis en rechtvaardiging |
|---|---|---|
| `λ` (`lambda_junction_discount`) | **0,9** | Fideliteitsbehoud per knooppunt van een *geschatte* keten. Codeert "directe meting verslaat product-gelijke ketening" (Utiyama & Isahara 2007; Wu & Wang 2007; Fan et al. 2021). De ~10%-korting is een kalibratiebeslissing, herzien naarmate gemeten ketentriangels zich ophopen (§6). |
| `κ` (`kappa_exploration_scale`) | **0,05** | Schaal van de verkenningsbonus, in sterkteëenheden. 0,05 ≡ 5 chrF++-punten — de ruisdrempel waaronder scoreverschillen niet te onderscheiden zijn op sub-100-vermelding-corpora ([Corpusontwerp §6.3](/docs/network/specifications/corpus-design)). Optimisme is begrensd op de resolutie van het instrument. |
| `S_CAP` | **0,95** | Voorspellingsplafond — geen geschatte verbinding mag bijna-perfecte fideliteit claimen die niet is aangetoond. |
| `S0_FALLBACK` | **0,5** | Paar-prior als laatste redmiddel, alleen gebruikt wanneer er helemaal geen gepubliceerde resultaten zijn (het waargenomen globale gemiddelde — ≈ 0,54 over de eerste 429 uitvoeringen — heeft de voorkeur wanneer er enig resultaat bestaat). |
| `COST_FLOOR` | **$0,01** | Drempel voor de ECV-noemer, zodat bijna-gratis uitvoeringen geen onbegrensde waarde per dollar kunnen claimen. |
| `N_FULL` | **100** | Geëvalueerde vermeldingen voor volledig omvangskrediet (§1.5). |
| `L_HEALTHY` | **5,0** | Effectieve woorden voor volledig rijkheidskrediet (§1.5). |
| `H_NOISE` | **±5 chrF** | BI-halve breedte voor volledig betrouwbaarheidskrediet; ontbrekende BI's worden geproxied als 50/√n (verankerd op ±5 bij n=100). |
| `RUNS_FULL` | **2** | Gepubliceerde uitvoeringen voor volledig replicatiekrediet. |

**Versiebeheer.** Parameter- of formelwijzigingen verhogen `formula_version`
(metadata) en de versieregel van deze pagina. De wachtrij echoot altijd de
exacte gebruikte waarden onder `metadata.priority_parameters`, inclusief de
huidige Φ, zodat historische wachtrijen interpreteerbaar blijven. Gevoeligheidsuitvoeringen zijn één vlag verwijderd: `generate_sweep_queue.py --lam 0.8 --kappa 0.1`.

## 5. Uitgewerkt voorbeeld (live waarden, 2026-06-12)

Generatie tegen 424 gescoorde uitvoeringen, 59 gemeten verbindingen, 60 talen;
**Φ = 0,272**. Het topitem:

```
eng>fao · claude-haiku-4.5 · naive
  edge_strength        0.0      (no published eng→fao runs)
  pair_prior           0.613    basis: target-language (Faroese runs exist via dan→fao)
  model_offset        −0.114    (haiku trails other models on shared pairs)
  condition_offset     0.0      (no coaching evidence for fao)
  exploration_bonus   +0.174    (never-run cell: κ·√(2·ln 425 / 1))
  predicted_strength   0.673
  expected_mesh_gain   0.0181   (eng→fao is a near-component join)
  est_cost_usd         0.0101
  ecv_per_usd          1.79     ← rank #1
```

Lees het terug: Faeröers is alleen via Deens verbonden met het netwerk, dus
een gemeten eng→fao-verbinding snijdt een grote familie van ketens af (de grote
ΔΦ); het model wordt midden in de rangschikking voorspeld voor een dergelijk paar (prior +
offset), niemand heeft deze cel ooit geprobeerd (grote bonus), en de uitvoering
kost een cent. Niets anders in de wachtrij koopt meer netwerk per dollar.
Dezelfde rekenkunde, met elke invoer gepubliceerd, produceert elke andere rang.

## 6. Bekende beperkingen (en wat ze zou oplossen)

1. **chrF++ is niet vergelijkbaar over talen heen.** Morfologie verschuift de
   schaal; een 0,5-verbinding naar het Baskisch is niet dezelfde prestatie als naar het
   Nederlands. Mitigatie: prioriteiten worden gedomineerd door *structuur* (s = 0 →
   s > 0-overgangen) waarbij schaaleffecten van tweede orde zijn. Oplossing:
   per-taal-scorenormalisatie, of statistieken met betere
   taaloverkoepelende kalibratie naarmate ze beschikbaar komen voor deze talen.
2. **Het product-λ-ketenmodel is een prior, geen meting.** Het wordt
   richtingsgewijs ondersteund door de spilliteratuur maar is niet gekalibreerd
   voor LLM-vertaling. Oplossing (gepland): het netwerk bevat nu gemeten
   triangels (bijv. deu→fra direct naast deu→eng→fra), zodat geketende
   uitvoer direct kan worden gescoord en λ op gegevens kan worden afgestemd in plaats van gekozen.
3. **Contaminatie en ontwikkelingssetstatus.** Verbindingssterktes erven elk
   voorbehoud van publieke ontwikkelingssets — behandel Φ als een bovengrens-planningssignaal, nooit als een capabiliteitsclaim
   ([Corpusontwerp](/docs/network/specifications/corpus-design)).
4. **Domeinblindheid.** Een verbinding gemeten op conversationele tekst wordt
   behandeld als één getal; ketens die domeinen overschrijden, zullen meer degraderen
   dan λ voorspelt.
5. **Directionaliteit.** Verbindingen zijn momenteel ongerichteerd (X→Y-bewijs
   verlicht X↔Y). Wanneer ketensamenstelling in de praktijk richtingsgevoelig wordt, splitsen sterktes per richting — de formule is ongewijzigd,
   de graaf verdubbelt slechts.

## 7. Referenties

- Latora, V. & Marchiori, M. (2001). *Efficient Behavior of
  Small-World Networks.* Physical Review Letters 87, 198701.
  [arXiv:cond-mat/0101396](https://arxiv.org/abs/cond-mat/0101396)
- Auer, P., Cesa-Bianchi, N. & Fischer, P. (2002). *Finite-time
  Analysis of the Multiarmed Bandit Problem.* Machine Learning 47,
  235–256. [doi:10.1023/A:1013689704352](https://link.springer.com/article/10.1023/A:1013689704352)
- Nemhauser, G., Wolsey, L. & Fisher, M. (1978). *An Analysis of
  Approximations for Maximizing Submodular Set Functions—I.*
  Mathematical Programming 14, 265–294.
  [doi:10.1007/BF01588971](https://link.springer.com/article/10.1007/BF01588971)
- Khuller, S., Moss, A. & Naor, J. (1999). *The Budgeted Maximum
  Coverage Problem.* Information Processing Letters 70(1), 39–45.
  [doi:10.1016/S0020-0190(99)00031-9](https://dl.acm.org/doi/10.1016/S0020-0190(99)00031-9)
- Utiyama, M. & Isahara, H. (2007). *A Comparison of Pivot Methods for
  Phrase-Based Statistical Machine Translation.* HLT-NAACL 2007,
  484–491. [ACL Anthology N07-1061](https://aclanthology.org/N07-1061/)
- Wu, H. & Wang, H. (2007). *Pivot Language Approach for Phrase-Based
  Statistical Machine Translation.* ACL 2007; tijdschriftversie Machine
  Translation 21(3), 165–181.
  [doi:10.1007/s10590-008-9041-6](https://link.springer.com/article/10.1007/s10590-008-9041-6)
- Paul, M., Yamamoto, H., Sumita, E. & Nakamura, S. (2009). *On the
  Importance of Pivot Language Selection for Statistical Machine
  Translation.* NAACL-HLT 2009 Short Papers, 221–224.
  [ACL Anthology N09-2056](https://aclanthology.org/N09-2056/)
- Haffari, G., Roy, M. & Sarkar, A. (2009). *Active Learning for
  Statistical Phrase-Based Machine Translation.* NAACL-HLT 2009,
  415–423. [ACL Anthology N09-1047](https://aclanthology.org/N09-1047/)
- Fan, A. et al. (2021). *Beyond English-Centric Multilingual Machine
  Translation.* Journal of Machine Learning Research 22(107), 1–48.
  [arXiv:2010.11125](https://arxiv.org/abs/2010.11125)
