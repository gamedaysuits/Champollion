---
title: "De mensen begeleiden"
slug: /agents/coaching
description: "Hoe een AI-agent het ronderapport van Champollion overbrengt en praat met de mensen die een vertaler bouwen: vooruitgang voorop, elk getal met zijn eenheid en set, alleen aanmoediging bij gemeten verbeteringen, tijd gevraagd zonder druk en niets beloofd over kwaliteit."
---

# De mensen begeleiden

De rails meten. U geeft het door. Het meeste van wat de mensen over hun
vertaler horen, komt via u, dus de manier waarop u het verwoordt, maakt deel uit van het werk. Deze
pagina legt uit hoe u het verwoordt: wat het ronderapport bevat, hoe u het doorgeeft, hoe u
om tijd vraagt en welke woorden u gebruikt.

De onderliggende regels staan in [het contract](/docs/agents/contract) §5: zeg alleen
wat waar is, geef elk voorbehoud woord voor woord door, beloof het proces en nooit
kwaliteit, geef elk getal zijn eenheid en de set waarop het gemeten is.

## Het ronderapport

Elke verbeteringsronde eindigt met `champollion improve report` (de stap
`improve-report` van het traject, modus `auto`). Dit schrijft
`improve/round-<k>/report.json` en toont vier onderdelen; `--json` toont
hetzelfde object:

| Veld | Wat het bevat |
|---|---|
| `round` | De lopende ronde: één verder dan de rondes die forge heeft beoordeeld |
| `progress` | Regels, in volgorde: de trend in de beoordelingen van de spreker, vervolgens de beoordelingen van elke ronde (elk gevolgd, in een ronde waarvan het blad concepten van een ander model bevatte, door de blinde vergelijking), vervolgens het oordeel van elke ronde over de dev-set |
| `checks` | Waarschuwingen over wat de getallen wel en niet kunnen aantonen |
| `projection` | Een ruwe schatting van hoeveel extra trainingszinnen nodig zijn om "werkend" te bereiken, geteld per verdubbeling ervan, met een bereik — of waarom die er niet is — of `null` vóór twee beoordelingsrondes |
| `projection_numbers` | Dezelfde schatting in getallen: `more_sentences`, `range` (`[fewest, most]` trainingszinnen; `most` is `null` wanneer de controles dit niet kunnen begrenzen) en `speaker_hours` — of `null` wanneer er geen projectie is |
| `actions` | Eén tot vier dingen om vervolgens te doen |

Het leest alleen gegevens die de rondes bijhouden — de `marks.json` van de spreker per ronde
en de `improve-compare`-oordelen van forge — en toont aantallen en percentages,
nooit een zin.

### Wat elke regel betekent

**De beoordelingen van de spreker — de maatstaf die ertoe doet.** Elke ronde stelt het model in
gebruik concepten op van de zinnen die het gezin heeft geschreven, en de spreker beoordeelt elk concept als
`Y` (goed), `N` (fout, met hoe het wordt gezegd) of `?` (onzeker). Het aandeel goed
wordt geteld over de concepten die als `Y` of `N` zijn gemarkeerd, met een 95%-Wilson-interval:

> Ronde 1: de spreker beoordeelde 9 van de 24 concepten van nieuwe zinnen als goed — 38%
> (95%-bereik 21%–57%).

Dit zijn nieuwe zinnen — opgesteld voordat enig model ze leerde — dus dit is
de out-of-sample-meting. In een ronde waarin het werkblad ontwerpen van een ander
model bevatte, betreffen deze tellingen alleen de rijen van het gebruikte model. Opnieuw getoonde
rijen (hieronder) zijn hierin nooit opgenomen.

**Opnieuw getoonde rijen.** Vanaf ronde 2 is ongeveer een op de tien rijen een ontwerp dat de
spreker al op een eerder werkblad heeft beoordeeld, teruggekeerd zonder markering. Het werkblad vermeldt dit
bovenaan — *\"Een paar rijen hieronder komen met opzet terug van eerdere werkbladen.
Beoordeel ze alstublieft opnieuw, alsof ze nieuw zijn: hoe vaak de beoordelingen overeenstemmen laat zien in hoeverre
ze te vertrouwen zijn.\"* — en vermeldt nooit welke. `improve marks` print *\"Opnieuw
getoonde rijen: de spreker beoordeelde A van J op dezelfde manier als voorheen (P%)\"*, met
de wisselingen in beide richtingen. Deze rijen worden nooit meegeteld in het aandeel van de ronde en
er wordt nooit meer op getraind; ze kosten de spreker ongeveer 10 seconden per rij
([meting](/docs/agents/measurement#the-speakers-marks)).

**De blinde vergelijking.** Een tweede model stelt een willekeurige helft van de concepten
op een blad op, ongemarkeerd, en de spreker beoordeelt beide zonder te weten welke welke is
([meting](/docs/agents/measurement#the-speakers-marks)). Het tweede
model is het nieuwste model wanneer dit niet in gebruik is genomen; bij het bezoek na een
promotie is het het model dat door het nieuwe model is vervangen. Het rapport voegt een regel toe:

> Ronde 2: Blind, op nieuwe zinnen: het model in gebruik werd op 5
> van de 12 als goed beoordeeld (42%), het nieuwere model (niet in gebruik) op 7 van de 12 (58%) — geen duidelijk
> verschil op 24 zinnen.

Na een promotie luidt dit *"het laatst in gebruik genomen model werd als goed beoordeeld op …,
het model dat het verving op …"*. Het eindigt op een van drie manieren (een tweeproportietoets
op 5%): voor een nieuwer model, *het nieuwere model is duidelijk beter op de
zinnen die het gezin nodig heeft* of *het model in gebruik is duidelijk beter*; na een
promotie, *het nieuwe model is duidelijk beter op de zinnen die het gezin
nodig heeft* of *het model dat het verving was duidelijk beter — het nieuwe heeft niet
geholpen op de zinnen die het gezin nodig heeft*; of *geen duidelijk verschil op N
zinnen*. Bij te weinig beoordeelde rijen van één model luidt het *"er zijn te weinig rijen van
één model beoordeeld om te vergelijken"*.

**De trend.** Het rapport noemt een stijging alleen *echte vooruitgang* wanneer aan alle drie
de voorwaarden is voldaan:

- het bereik van de laatste ronde ligt geheel boven dat van de eerste ronde (het onderste uiteinde ervan
  boven het bovenste uiteinde van de eerste);
- tussentijds is een model uit een ronde in gebruik genomen — gekozen door de mensen
  (de records `export` en `choose` van forge): na een **better**-oordeel en
  hun ja, op basis van de blinde beoordelingen van de spreker, of uit eigen keuze. Een
  **better**-oordeel alleen telt niet mee; en
- bij een blinde beoordeling tijdens dezelfde bezoeken beoordeelde de spreker het nieuwe model
  duidelijk vaker als juist dan het model dat het verving (de controles na elke
  promotie, samengevoegd; een tweeproportietoets op 5%).

Het derde punt is toegevoegd omdat de beoordeling van een spreker kan verschuiven: iemand die elke ronde milder wordt, verhoogt elk aandeel, maar tijdens één bezoek heeft dat op beide modellen dezelfde uitwerking. In een simulatie met een spreker die 10% van de concepten verkeerd beoordeelt en elke ronde milder wordt, werd een promotie die de oefenset per toeval verkeerd had, in 106 van de 1.600 rapporten als echte vooruitgang geïnterpreteerd waarin het model niet kon verbeteren; met de blinde controle was dit 3 — en opnieuw maximaal 3 op 1.600 bij herhaling met de ondergrens van 50 zinnen en het oordeel van de spreker, inclusief runs waarbij de oefenset bij 30 zinnen begint.

Een stijging met een promotie maar zonder die controle wordt weergegeven als *nog niet
meegeteld als echte vooruitgang: hoe mild concepten worden beoordeeld, kan ook zijn veranderd*
— met de tellingen van de controle, of met de melding dat het volgende blad concepten van beide modellen
bevat. Een stijging met hetzelfde model in gebruik wordt weergegeven als *niet meegeteld als
vooruitgang*: de zinnen of de beoordeling zijn veranderd, niet het model. Een stijging binnen
de bereiken wordt weergegeven als *omhoog, hoewel nog niet voorbij de onzekerheid*.

**Het oordeel over de dev-set.** Forge vergelijkt het nieuwe model met het model in gebruik op
dezelfde dev- (oefen)zinnen, zin voor zin:

> Ronde 1: op dezelfde 50 oefenzinnen (dev), chrF++ (0–100, overlap met de gecontroleerde vertaling) 24,1 voor het nieuwe model tegenover 22,0 voor het model in gebruik — geen meetbare verandering: niet gebruikt (op 50 zinnen is pas een verschil van ongeveer 5,8 punten of meer betrouwbaar zichtbaar).

Hoe de regel eindigt, hangt af van het oordeel en van de vraag of de mensen
het model van de ronde hebben gekozen (de records `export` en `choose` van forge) — een oordeel alleen
neemt niets in gebruik:

| Oordeel | Niet gekozen | Gekozen |
|---|---|---|
| **better** | *meetbaar beter: niet in gebruik genomen — de mensen hebben het niet gekozen* | *meetbaar beter: in gebruik genomen* |
| **worse** | *meetbaar slechter: niet gebruikt* | *meetbaar slechter — in gebruik genomen …* |
| **no-change** | *geen meetbare verandering: niet gebruikt* | *geen meetbare verandering — in gebruik genomen …* |
| **too-few** | *te weinig oefenzinnen om te beoordelen (onder 50): de blinde beoordelingen van de spreker beslissen* | *te weinig oefenzinnen om te beoordelen (onder 50) — in gebruik genomen …* |

"In gebruik genomen …" eindigt op *op basis van de blinde beoordelingen van de spreker* wanneer forge een
oordeel van de spreker bevat voor dat model met `clear: newer` (`improve-speaker`), en
anders op *uit eigen keuze van de mensen*. `champollion improve status` gebruikt
dezelfde woorden: de regel van elke ronde eindigt op *"· nieuw model op de oefenzinnen (dev): …"*. De oordeelregel staat in
[meting](/docs/agents/measurement#comparing-two-models).

**De controles.**

- *Overfitting.* Als de dev-chrF++ van het gebruikte model over de rondes heen met 3 punten of
  meer steeg (het nieuwe model van de laatste ronde telt pas mee zodra de
  mensen het hebben gekozen), terwijl het aandeel juist van de spreker met 2 punten of minder steeg,
  meldt het rapport dat de winst mogelijk toebehoort aan de oefenzinnen, en dat men op de
  beoordelingen moet vertrouwen.
- *Een dev-set die te klein is om winst te zien.* Wanneer het kleinste verschil dat de dev-set
  betrouwbaar aantoont meer dan 3 chrF++-punten is (of, indien onbekend, minder dan 50
  zinnen), meldt het rapport dat \"geen meetbare verandering\" de limiet van de dev-set is,
  en geen bewijs dat de ronde niets heeft opgeleverd.
- *In hoeverre de beoordelingen te vertrouwen zijn.* Zodra er over alle rondes heen 10 opnieuw getoonde
  rijen zijn beoordeeld: *\"De spreker beoordeelde A van J opnieuw getoonde rijen op dezelfde manier
  als voorheen (P%): ongeveer E% van de beoordelingen valt willekeurig andersom uit, wat
  elk als juist gemarkeerd aandeel naar 50% trekt — de projectie houdt hier rekening mee.\"* Wanneer
  voorheen foute ontwerpen die nu als juist zijn beoordeeld duidelijk in de meerderheid zijn ten opzichte van de omgekeerde richting (een
  tekentoets op 5%, 6 wisselingen of meer), voegt het toe: *\"de beoordeling wordt mogelijk milder,
  wat een stijging in het aandeel niet zou laten zien\"*. Vóór 10: *\"Tot nu toe zijn er N opnieuw
  getoonde rijen beoordeeld — de eigen beoordelingsfout van de spreker wordt geschat vanaf
  10.\"*

**De projectie.** Wordt alleen gemaakt wanneer de stijging echte vooruitgang is (alle drie de
bovenstaande punten) en het aandeel juist nog onder de 80% ligt — de term van de rails voor
*werkend* op de zinnen die de familie nodig heeft. Leercurves stijgen met grofweg
gelijke stappen per verdubbeling van het aantal trainingszinnen, dus het leest de stap af uit
de blinde controles van de spreker van elk nieuw model ten opzichte van het model dat het verving
(waarbij de trainingsparen van beide modellen zijn vastgelegd) en vermeldt hoeveel extra trainingszinnen
nodig zijn om 80% als juist beoordeeld te bereiken, met een bereik, en de uren van de spreker bij
ongeveer 70 seconden per zin (een minuut om te schrijven, tien seconden om te beoordelen). Het
bereik dekt wat de controles toelaten (95%) en, zodra er 10 opnieuw getoonde rijen zijn
beoordeeld, waar \"werkelijk juist op 80%\" kan liggen volgens de eigen beoordelingen van deze spreker; de
tekst meldt dan *\"ontwerpen die werkelijk voor 80% juist zijn, worden op basis van diens beoordelingen mogelijk in ongeveer T% van de
gevallen als juist beoordeeld — het bereik houdt hier rekening mee\"*. Vóór dat moment meldt het
*\"(Met de eigen beoordelingsfout van de spreker wordt nog geen rekening gehouden: er zijn te weinig opnieuw
getoonde rijen beoordeeld.)\"* De schatting zelf blijft op de eenvoudige
80%. Aantallen worden afgerond op twee cijfers. Wanneer de controles het niet kunnen begrenzen, meldt
het dat ze *\"nog niet kunnen zeggen hoeveel er nog nodig zouden kunnen zijn\"*. Anders vermeldt het
waarom er geen is — bijvoorbeeld: *\"de blinde controle van de spreker heeft nog niet aangetoond
dat het nieuwe model wint van het model dat het verving, dus de stijging kan in de
beoordeling zitten en niet in het model\"*. Zeg altijd dat het een ruwe schatting is; dat doet het rapport ook.
In simulaties kwam het 69–78% van de tijd binnen een factor 2 van het werkelijke aantal uit
bij 400 zinnen per ronde en 53–56% bij 800, en het werkelijke aantal viel
89–94% en 76–80% van de tijd binnen het bereik (bij 800 per ronde 51–54%
voordat het bereik rekening hield met de beoordelingen van de spreker); de rechte lijn die het
verving, 5% bij 400. Zeg nooit op basis van de beoordelingsfout van de spreker dat een model \"mogelijk al werkt\":
het rapport doet dat niet, omdat die opmerking in simulaties 2–3 keer fout was voor elke keer dat hij juist was.

**De acties.** Naar prioriteit, maximaal vier: beoordeel de lijst van deze ronde, of schrijf de zinnen die nog ontbreken (20 per ronde); wanneer de blinde vergelijking uitwees dat het nieuwere model duidelijk beter was, dat *"de ronde wel degelijk heeft geholpen, ook al kon de oefenset dat niet aantonen"* — ga door, en door de oefenset uit te breiden kan het volgende oordeel dit zichtbaar maken; wanneer de spreker het model dat door een promotie werd vervangen duidelijk beter vond, vragen aan de gemeenschap of het eerdere model moet worden teruggezet, en de oefenset meer laten aansluiten op de zinnen die zij nodig hebben; breid de oefenset uit wanneer deze te klein is om de winst van een ronde te zien en onder de 200 zinnen telt (*"één op de 2 zinnen op elke lijst heeft geen concept — de spreker schrijft op hoe het wordt gezegd, en deze wordt aan de oefenset toegevoegd (nu 31; met 50 kan een ronde überhaupt worden beoordeeld, met 200 wordt een winst van ongeveer 3 punten zichtbaar)"* — "op de 4" vanaf 50); wat te doen na twee rondes zonder winst (hieronder); dat de tijd die de spreker heeft aangegeven te kunnen besteden te beperkt lijkt; en, zodra de ondergrens van het aandeel juiste vertalingen 70% bereikt, een controle op de vergrendelde testset — waarbij eerst een voorspelling wordt genoteerd.

**Twee rondes zonder winst** — de laatste twee oordelen zijn beide **no-change** of
**worse** (een ronde met **too-few** zegt in geen van beide richtingen iets en telt niet mee),
waartussen geen model in gebruik is genomen; forge telt op dezelfde manier voor het
aanbod van een sterker model. Waar de oefenset de gebruikelijke winst van een ronde kan waarnemen,
luidt de actie *"Twee rondes zonder een winst die deze oefenset kan zien
(ongeveer X chrF++-punten of meer): de rondes voegen mogelijk minder dan dat toe, of
niets — dat valt niet te onderscheiden. Snellere manieren om verder te komen: het sterkere model dat
de rails aanbieden wanneer de computer er een kan trainen, of meer van het soort zinnen
dat het fout doet."* (X is het kleinste verschil dat het oordeel kan tonen.) Waar dit
niet kan, meldt het dat men door moet gaan. Zeg of suggereer nooit dat meer zinnen niet
zullen helpen: dicht bij de top van de curve voegt een ronde ongeveer een half chrF++-punt toe, minder
dan wat 200 oefenzinnen kunnen aantonen. In gesimuleerde rondes werd de oudere formulering
"meer van hetzelfde helpt mogelijk niet" uitgesproken in 98 van de 1.200 rapporten terwijl het
model in werkelijkheid verbeterde.

### Hoe u het doorgeeft

1. **Vooruitgang eerst.** Begin met wat er veranderd is in de beoordelingen van de spreker.
2. **Elk getal met bijbehorende eenheid en set.** "9 van de 24 nieuwe zinnen die de spreker heeft gecontroleerd waren juist — 38%", nooit alleen "38%". "chrF++ 24,1 op 100 op de 50 oefenzinnen", nooit "24,1". Een bereik geeft aan hoe zeker de tools zijn, geen twee resultaten: "ergens tussen 21% en 57% — met 24 zinnen kunnen de tools niet zekerder zijn dan dat".
3. **De controles, in eenvoudige bewoordingen.** Als het rapport waarschuwt, vertel dan waarvoor het waarschuwt.
4. **De volgende stappen als dingen die men kan doen.** Vertaal elke actie naar een zin gericht aan de gemeenschap, met het genoemde bestand erbij.
5. **Geef elk voorbehoud woord voor woord door.**

**Moedig aan wat gemeten is.** Een concept dat als goed is beoordeeld, een stijging voorbij de
bereiken, een nieuw model dat in gebruik is genomen: benoem het op een warme manier. De eerste vertaling is het
vieren waard. Vier nooit een getal dat het rapport geen vooruitgang noemt.

**"Geen meetbare verandering" — helder en vriendelijk.** Het betekent niet dat de ronde
verspild was. Zeg wat het betekent: op dit aantal oefenzinnen is alleen een
verschil van ongeveer deze omvang zichtbaar; een kleinere winst kan verborgen zijn; het model
in gebruik blijft in gebruik; de zinnen die de spreker heeft gecorrigeerd tellen nog steeds mee. Noem vervolgens
de volgende stap.

**"Te weinig oefenzinnen om te beoordelen" — niet "geen verandering".** Met minder dan 50 oefenzinnen geeft geen enkele vergelijking de doorslag, wat de twee scores ook zijn; het is geen oordeel over het nieuwe model. Vertel wat er in plaats daarvan gebeurt: het model in gebruik blijft voorlopig actief; op de volgende lijst worden de concepten van het nieuwere model er ongemarkeerd tussengevoegd, en de beoordelingen van de spreker bepalen de uitkomst; één op de twee regels op de lijst heeft geen concept, en die zinnen breiden de oefenset uit totdat een ronde erop beoordeeld kan worden.

**De blinde vergelijking — met beide aantallen en wat deze doet.** Noem de aantallen van beide modellen en de afsluiting van het rapport, zoals geschreven. Wanneer het nieuwere model duidelijk beter is, verwoord het dan zoals het rapport doet — de ronde heeft wel degelijk geholpen, ook al kon de oefenset dat niet aantonen — en geef aan dat het het eigen oordeel van de spreker over nieuwe zinnen betreft. Na een oordeel **te weinig** of **geen verandering** over dat model zorgt een duidelijke voorkeur ervoor dat forge het ter ingebruikname aanbiedt: `improve marks` toont *"forge heeft het vastgelegd: het biedt aan om het nieuwere model in gebruik te nemen (de gemeenschap stemt eerst toe)"*, en het voorstel verschijnt als de stap `improve-promote` (hieronder) — vraag om toestemming voordat u deze uitvoert. Na een oordeel **slechter** wordt het niet aangeboden. Na een promotie is dezelfde controle bepalend om het rapport een stijging als echte vooruitgang te laten tellen; wanneer daaruit blijkt dat het model dat werd vervangen duidelijk beter was, vraag dan aan de gemeenschap of het eerdere model moet worden teruggezet — doe dit nooit zonder hun toestemming. "Geen duidelijk verschil" op 24 zinnen betekent precies wat er staat.
**Let op.** Vertel de spreker nooit welke regels van welk model afkomstig zijn voordat diens beoordelingen zijn uitgelezen.

**Opnieuw getoonde rijen — waar ze voor dienen.** Noem de overeenstemming met de bijbehorende aantallen,
zoals het rapport dat doet (\"de spreker beoordeelde 17 van de 20 opnieuw getoonde rijen op dezelfde manier
als voorheen — 85%\"), en waar dit voor dient: in hoeverre de beoordelingen te
vertrouwen zijn. Het wordt aangekondigd op het werkblad, het is geen verborgen controle van de spreker.
Benoem de toevallige fout zoals het rapport dat doet: ongeveer E% van de beoordelingen valt
willekeurig andersom uit, wat elk aandeel naar 50% trekt, en de projectie
houdt hier rekening mee. Wanneer het rapport zegt *\"de beoordeling wordt mogelijk milder\"*,
zeg dit dan nuchter en zonder verwijt: een stijging in het aandeel kan dan aan de
beoordeling liggen, niet aan het model. **Opmerking.** Vertel de spreker nooit welke rijen
terugkomen, of wat deze eerder heeft beoordeeld — het werkblad vermeldt alleen dat enkele rijen dat doen.

**Woorden die het model nooit heeft gezien.** Wanneer `sync` waarschuwt dat sleutels *"woorden bevatten die het
model nooit heeft gezien tijdens de training — zeer waarschijnlijk verkeerd vertaald, hoe vloeiend ook"*,
zeg het dan duidelijk: die regels zijn zeer waarschijnlijk fout, zelfs als ze goed lezen; een
spreker zou ze moeten controleren, of de zinnen van de volgende ronde kunnen die
woorden aanleren. Noem de sleutels, zoals de waarschuwing doet; u ziet de woorden zelf nooit. De
persoon ziet ze op de uitprobeerpagina van het model, onder elke regel. Het bewijs, op
de verzonnen testtaal: zinnen die een woord bevatten dat het model niet had gezien,
waren 0 van de 358 keer juist ([serving](/docs/agents/serving#words-the-model-never-saw)).

**De woorden van de verlanglijst.** Het onderdeel "Woorden die het nog nooit heeft gezien" vraagt om
*"twee of drie zinnen met elk woord dat u nodig hebt, elk met een andere
betekenis"*: minder woorden, elk in een paar zinnen, leren het model meer dan
veel woorden één keer. Geef het op die manier door. Op de verzonnen testtaal kwam een woord
dat één keer in de training was gezien in 27–29% van de gevallen goed naar voren, en bij 2–4 keer
in 63–95%; en met 3.200 trainingszinnen had ByT5-small getraind op zinnen
gekozen op de meeste nieuwe woorden 39,4% van 500 achtergehouden zinnen qua betekenis
goed, tegenover 53,4% voor alledaagse zinnen — bij iets meer tijd van de
spreker (ongeveer 57 uur tegenover 54).

Noem een score nooit zelf goed of slecht. Een vloeiende spreker bepaalt wat geschikt is
voor gebruik.

## Vragen om tijd

De stap `improve-time` (modus `ask_user`) vraagt hoeveel tijd de spreker kan
geven: `per_week` en `total`, elk **exact zoals deze het zei** ("misschien 30
zinnen per week", "een paar uur, dan zien we wel"). Dit wordt vastgelegd door
`champollion improve time` in `improve/time.json`; het aantal zinnen van elke ronde
wordt eromheen gepland, en het rapport vergelijkt de projectie ermee.

- **Opmerking.** Vraag het eenmaal; dring nooit aan op meer. Als ze het niet weten, geef dan door wat ze
  zeiden — vage bewoordingen zijn ook een antwoord.
- **Opmerking.** Wanneer het rapport aangeeft dat de projectie meer zinnen vereist dan de
  resterende tijd die ze hebben aangegeven, vertel het hun dan helder, met de opties die het noemt: meer
  sprekers, helpers bij het project, of voorlopig een beperkter doel (een taalgids
  voor de zinnen die ze het hardst nodig hebben). Laat hen vervolgens kiezen.

## De voorstellen die de rails doen

**Een beter model aanbieden voor gebruik** (forge-status `improve-promote`, modus
`confirm`). Een nieuw model was meetbaar beter op de dev-set — of de dev-set
kon geen uitsluitsel geven (**too-few** of **no-change**) en de spreker beoordeelde het bij
een blinde beoordeling duidelijk vaker als juist. Vervolgens voegt `why` van forge de
tellingen van de spreker toe: *"Bij een blinde beoordeling tijdens hetzelfde bezoek beoordeelde de spreker het
nieuwere model als juist bij A van de B nieuwe zinnen (P%) en het model in gebruik bij C van
D (Q%) — een duidelijk verschil: het nieuwere model is beter voor de zinnen die de
familie nodig heeft."* Geef aan welke het was. Het is een aanbod: een oordeel alleen verandert
niets. Ingebruikname verandert wat hun pagina of app antwoordt, dus vraag dit voordat
u de stap uitvoert; bij "niet nu", `declined: true`. Alleen hun ja — `export` en `choose` van de stap —
neemt het in gebruik; tot die tijd meldt het rapport
*"meetbaar beter: niet in gebruik genomen — de mensen hebben het niet gekozen"*, en
telt geen enkele stijging als voortgang hiervan. Eenmaal gekozen op basis van de beoordelingen van de spreker,
luidt de regel van de ronde *"in gebruik genomen op basis van de blinde beoordelingen van de spreker"*.

**Een sterker model** (forge-status `improve-stronger-model`, modus `ask_user`).
Wanneer twee opeenvolgende rondes die de dev-set kon beoordelen geen winst vertonen —
beide **no-change** of **worse**; een ronde met **too-few** telt niet mee —
gerekend vanaf de laatste modelwijziging (een wisseling van preset, of elk model dat
de mensen in gebruik hebben genomen met `choose`, inclusief een promotie op basis van de beoordelingen van de spreker),
terwijl het tiny-model in gebruik is, bieden de rails ByT5-small aan
— `byt5-small`, of `byt5-small-lowmem` waar de GPU 8–15 GB geheugen heeft
om mee te trainen (minder geheugen per stap, langzamer): een download van ongeveer 1,2 GB en
een langere training, bij voorkeur op Apple silicon of een NVIDIA-GPU
([training](/docs/agents/training#models)). Het antwoordveld is `try_it`:
`yes` of `not-now`. Zeg wat `why` van forge zegt — wanneer de dev-set te
klein is om de winst van een ronde te zien, dat kleine winsten mogelijk verborgen blijven; anders, dat
de twee rondes *"geen verandering brachten die de dev-zinnen kunnen zien (ongeveer X chrF++-punten
of meer): de rondes voegen mogelijk minder dan dat toe, of niets"*. Het
zegt niet dat meer zinnen niet helpen, en dat doet u ook niet. "Niet nu"
is een van de antwoorden van deze stap: geef `try_it: "not-now"` door (via MCP
wordt `declined: true` hier geweigerd). Forge legt dit vast, behoudt het model in gebruik,
en het aanbod keert pas terug na nog twee van zulke rondes (**no-change** of
**worse**). Beide antwoorden zijn prima; de keuze is aan hen.

**Het beoordelen van de voorspelling.** Na een testset-score geven de mensen aan of
de voorspelling die ze hadden opgeschreven standhield (`held` of `missed`) en wie deze heeft beoordeeld. Lees
hun de voorspelling en de score met het bijbehorende bereik voor; beoordeel dit nooit voor hen.

**Sprekers die nog niet hebben ingestemd.** Naar een bestand in `waiting_for_agreement` wordt
eenmaal per sessie vriendelijk gevraagd. Alleen een ja van de persoon — dat
iedereen wiens woorden erin staan heeft ingestemd — volstaat als antwoord.

## Woorden voor de mensen

| Zeg | In plaats van |
|---|---|
| "een score op 100 voor hoe dicht de vertalingen bij die van de spreker zelf komen — chrF++" | enkel "chrF++ 24,1" |
| "hoe zeker de tools zijn: ergens tussen 21% en 57%" | "BI [0,21; 0,57]" |
| "de oefenzinnen" (de dev-set) | "dev-split" |
| "de testzinnen, vergrendeld gehouden" | "held-out testset" |
| "het eerste kleine model" | de map- of run-naam ervan |
| "geen meetbare verandering — op 50 oefenzinnen is pas een verschil van ongeveer 6 punten zichtbaar" | "geen verbetering" |
| "nog te weinig oefenzinnen om te kunnen beoordelen — onder de 50 bepalen de eigen beoordelingen van de spreker" | "geen verandering" bij een oordeel te weinig |
| "een taalgids: goed met zinnen zoals die waarop het heeft geleerd" | "low-resource NMT-baseline" |
| "de spreker beoordeelde 9 van de 24 als juist" | "nauwkeurigheid 38%" |

Leg een term uit wanneer deze voor het eerst voorkomt, met een voorbeeld vóór het woord.

## Wanneer hulp voor te stellen

- **Het project zit vast, of ze vragen om hulp van mensen.** Zeg: *"Ervaart u
  problemen, of wilt u hulp bij uw project? Laten we praten."* —
  [info@champollion.dev](mailto:info@champollion.dev). Nooit verplicht; geen
  tarieven.
- **Ze hebben meer zinnen, sprekers of rekenkracht nodig dan ze hebben.**
  Verwijs hen naar [Deelnemen aan een project](/docs/join-a-project): anderen kunnen
  zinnen, woordenlijsten of methoden aanbieden (vooralsnog alleen bestanden), en niets van hen
  verlaat het systeem zonder hun instemming ([hosten en deelnemen](/docs/agents/hosting-and-joining)).

## Meer informatie

- [Maak het beter, ronde na ronde](/docs/make-it-better) — de verbeteringslus zoals
  de mensen die lezen.
- [Meetregels](/docs/agents/measurement) — de oordeelsregel, bereiken en
  dev-setlimieten.
- [Trainen met nmt-forge](/docs/agents/training) — wat het sterkere model
  is en kost.
- [Het operationele contract](/docs/agents/contract) §5 — zeg alleen wat waar is.
