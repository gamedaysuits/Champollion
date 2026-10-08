---
sidebar_position: 3
title: "Kwaliteitspoort"
related:
  - label: "Coaching Data"
    to: /docs/concepts/coaching-data
    kind: concept
  - label: "Script Converters"
    to: /docs/concepts/script-converters
    kind: concept
  - label: "Scoring Specification"
    to: /docs/network/specifications/scoring
    kind: arena
    note: "How quality is scored on the public benchmark"
  - label: "Cookbook: Translate 30 Languages"
    to: /docs/tutorials/translate-30-languages
    kind: cookbook
    note: "Audit quality across 30 locales"
---

# Kwaliteitspoort

Elke vertaling doorloopt een deterministische validatiepoort voordat deze naar schijf wordt geschreven. De kwaliteitspoort onderschept veelvoorkomende foutmodi bij machinevertalingen — geen stille terugvalmechanismen, geen onzin in uw localebestanden.

## Validatiecontroles

| Controle | Wat het detecteert | Gate-label |
|-------|----------------|-----------|
| **Leeg/blanco** | Model retourneerde een lege string of witruimte | `[GATE] empty` |
| **Bron-echo** | Model retourneerde de originele Engelse invoer — ongewijzigd of vermomd (accenten, hoofd-/kleine letters, 'fullwidth'-tekens), in de gehele waarde of in één meervoudsvorm | `[GATE] source-echo` |
| **ICU- / placeholderstructuur** | Een vertaalde variabele, meervoudssleutelwoord of -selector, een ontbrekende `#` of `%s` | `[GATE] icu` |
| **Markup** | Een tag die anders is geopend, gesloten of genest dan in de bron | `[GATE] markup` |
| **Zinseinde naast een placeholder** | Een zinseinde dat door de vertaling direct voor of na een placeholder wordt geplaatst waar de bron er geen heeft: `Take this medicine at {time}.` → `… sina. {time}.` | `sentence break beside a placeholder` |
| **Hallucinatielus** | Herhaalde trigrampatronen (bijv. `"Qo' Qo' Qo'"`) | `[GATE] hallucination` |
| **Lengte-inflatie** | Uitvoer is aanzienlijk langer dan de bron | `[GATE] length` |
| **Inhoudsverwijdering** | Uitvoer is de bron waarvan de letters zijn verwijderd | `[GATE] content` |
| **Schriftconformiteit** | Verkeerd schrift voor de doellocale | `[GATE] script` |
| **Zelfde uitvoer, verschillende invoeren** | Eén tekst geretourneerd voor meerdere verschillende bronstrings (een gememoriseerde zin) | `[GATE] shared-output` |
| **ICU-meervoudscategorieën** | Ontbrekende vereiste meervoudsvormen voor de locale | `[GATE] icu-plural` |

Sleutels die zijn gedeclareerd als [`noTranslate`](/docs/getting-started/configuration#no-translate) bereiken de gate nooit — ze worden letterlijk overgenomen uit de bron, waardoor er niets te valideren valt.

**Markdown-pagina's ondergaan dezelfde controles, blok voor blok.** In een contentmap (`contentDir`, Docusaurus-documenten) wordt elke kop, alinea, lijstitem en tabelcel afzonderlijk gecontroleerd, evenals elk front-matter-veld. De controles zijn dezelfde als hierboven: leeg, bron-echo, hallucinatielus, lengte-inflatie, inhoudsverwijdering, schrift en dezelfde uitvoer voor verschillende invoeren. Een korte kop zoals `## Feast` die terugkomt als een volledige zin wordt geweigerd, net zoals de app-sleutel met dezelfde tekst.

Voor een geweigerd blok wordt **nog één poging gevraagd, inclusief de reden**. Aan het model wordt uitgelegd wat er mis was en dat tekst die zoals geschreven correct is, ongewijzigd mag terugkomen. Sommige weigeringen kunnen niet door een vaste regel worden bepaald: een kop die een naam is (`### BLEURT (Sellam et al., 2020)`), een vermelding in een referentielijst, een tabel met codes of een verklarende aantekening kan exact zoals geschreven correct zijn, of juist een gemiste vertaling. Als het blok ongewijzigd terugkwam, of in Latijns schrift behouden bleef in een niet-Latijnse taal, en het model geeft opnieuw hetzelfde antwoord, dan wordt dat antwoord als opzettelijk geaccepteerd. Elke andere weigering moet bij het tweede antwoord zonder meer voor de gate slagen. Een endpoint dat aangeeft geen instructies te volgen (`"acceptsInstructions": false`) wordt niet opnieuw gevraagd; het eerste antwoord wordt direct beoordeeld alsof het een tweede antwoord is.

Wat nog steeds wordt geweigerd, gaat naar de `fallback`-methode van het paar. Zonder een dergelijke methode **behoudt het blok zijn brontekst, zonder dat er een markering aan de pagina wordt toegevoegd**, wordt het nooit gecachet en luidt de lock-vermelding van de pagina `pending:<hash>`. `status` en `verify` geven een overzicht van dergelijke pagina's, en sync benoemt elk blok. De weigering wordt onthouden: de volgende reguliere sync stuurt dat blok niet opnieuw naar hetzelfde model (zie [Geweigerde Markdown-blokken en front-matter-velden](#refused-markdown-blocks-and-front-matter-fields)). Code, links en markup in een blok worden afzonderlijk beschermd, en een HTML-commentaar wordt nooit verzonden. Sommige tekst wordt zonder navraag behouden zoals geschreven:
- een korte naam (`## GitHub`), gemeten zonder inline code, aanhalingstekens, haakjes en `{#anchor}`;
- een vermelding in een referentielijst, of een volledige referentielijst in één blok;
- 'fullwidth'-letters die de bron zelf toont.

Een tabel wordt beoordeeld op basis van zijn cellen, niet op de scheidingstekens (pipes) en de scheidingsrij. `verify` controleert de reeds op schijf aanwezige blokken op dezelfde manier, met uitzondering van een blok dat exact overeenkomt met wat sync voor de bron heeft geaccepteerd en gecachet. Een blok dat niet slaagt levert een waarschuwing op, waardoor `verify --strict` faalt, en gaat vergezeld van de herstelopdracht `champollion sync --pair en:fr --redo files:<page>`. Sync toont dezelfde opdracht voor hetzelfde bestand.

### Leeg/Blanco

Verwerpt vertalingen die lege strings zijn, uitsluitend uit witruimte bestaan, of `null`. Dit onderschept modellen die niets retourneren voor moeilijke sleutels.

### Bronherhaling

Detecteert wanneer het model de Engelse brontekst retourneert in plaats van deze te vertalen. Dit komt vaak voor bij korte strings en ondergespecificeerde prompts. Er gelden twee regels, en ze meten verschillende zaken:

1. **Een exacte kopie** (byte voor byte gelijk aan de bron) wordt geweigerd — behalve bij een **korte, voornamelijk uit ASCII bestaande** waarde: 30 tekens of minder, meer dan 80% gewone ASCII. `"Blog"`, `"GitHub"`, `"npm"` blijven terecht in het Engels, dus bij een doeltaal in Latijns schrift wordt een dergelijke kopie geaccepteerd (`verify` vermeldt dit als een bron-echo); bij een niet-Latijns doel wordt het model eenmalig gevraagd of het een naam betreft, en hetzelfde antwoord tweemaal wordt geaccepteerd als zodanig. **Deze uitzondering heeft betrekking op lengte en geldt uitsluitend voor exacte kopieën.**
2. **Een vermomde kopie** — de bron waarin alleen hoofd-/kleine letters, accenten, spatiëring, onzichtbare tekens of compatibiliteitsvormen ('fullwidth'-letters, ligaturen) zijn gewijzigd — wordt geweigerd wanneer de bron **drie of meer woorden** bevat die letters dragen (placeholders zoals `{count}` of `%s` en markuptags tellen niet mee), **ongeacht hoe kort deze is**. `"Book an appointment"` (19 tekens, 3 woorden) → `"Bóok án appóintment"` wordt geweigerd; `"cafe"` → `"café"` (1 woord) wordt geaccepteerd, omdat een echte vertaling uitsluitend door accenten kan verschillen van het Engels. Een langere naam die terecht accenten krijgt (`"Universite de Montreal"`) wordt geaccepteerd zodra u de spelling met accenten declareert als beschermde term.

Beide regels gelden eveneens **voor elke meervoudsvorm**. Een gettext-`msgstr[n]`-meervoud, een ICU-`{n, plural, …}`-tak of een i18next-`_one`/`_other`-sleutel wordt aan dezelfde regels gehouden als een enkelvoudige waarde: een Russisch meervoud waarvan de `few`-vorm terugkwam als het Engels met accenten, wordt net zo geweigerd als het enkelvoud zou worden.

Langere waarden die ongewijzigd ook correct zijn — URL's, repositorypaden, product-ID's — zijn geen gate-probleem en kunnen niet worden opgelost door de gate aan te passen: het juiste antwoord *is* de echo, waardoor elke mogelijke modeluitvoer onjuist is. Declareer die sleutels met [`noTranslate`](/docs/getting-started/configuration#no-translate) zodat ze de pipeline volledig omzeilen. Sleutels met een URL als waarde worden standaard op die manier verwerkt.

### Hallucinatieherhaling

Analyseert trigrampatronen (3 tekens) in de uitvoer. Als een trigram meer dan een drempelaantal keren herhaalt ten opzichte van de uitvoerlengte, wordt de vertaling verworpen. Dit onderschept degeneratieve uitvoer zoals `"Qo' Qo' Qo' Qo' Qo'"`.

### Lengte-inflatie

Weist vertalingen af waarbij de uitvoerlengte `maxLengthRatio × source length` overschrijdt (standaard: 4×) — strikt meer: een vertaling van exact 4× slaagt. Dit vangt modelhallucinaties op die lappen tekst produceren voor een korte invoer.

Configureerbaar via `maxLengthRatio` in uw configuratie.

### Inhoudsverwijdering

Het spiegelbeeld van lengte-inflatie. Een model dat geen woordenschat heeft voor een string kan elke letter verwijderen die het niet kan vertalen, terwijl de interpunctie en spatiëring van de bron blijven staan:

```
"low-resource nmt · tokenizers · nêhiyawêwin"  →  "   ·   · êhiêi"
"the simple-builder approach"                  →  "  "
```

Niets anders vangt dit op. Het is niet leeg, geen echo, niet repetitief, en met 33% van de bron*lengte* blijft het ruim binnen `minLengthRatio`.

De controle vergelijkt **inhoudstekens** — letters en cijfers, waarbij interpunctie, witruimte en onzichtbare opmaak worden genegeerd — tussen bron en uitvoer. Maar dichtheid alleen kan niet de regel zijn, omdat legitieme dichte schriften zich in exact hetzelfde bereik bevinden:

| Bron | Uitvoer | Behouden inhoud | Oordeel |
|--------|--------|------------------|---------|
| `low-resource nmt · tokenizers · nêhiyawêwin` | `   ·   · êhiêi` | 14% | **afgewezen** |
| `Getting started` | `入门` | 14% | geaccepteerd |
| `Frequently asked questions` | `常见问题` | 17% | geaccepteerd |

Elke drempelwaarde die het eerste geval opvangt, zou Chinees, Japans en Koreaans categorisch afwijzen. Wat hen onderscheidt is niet hoeveel er behouden is gebleven, maar *waar het vandaan kwam*: de uitgeholde uitvoer is een **deelsequentie** van zijn eigen bron — te produceren door er tekens uit te verwijderen — terwijl een echte vertaling in wezen niets deelt met de bron. Een markering vereist **beide** signalen; de controle is dus noodzakelijk maar niet voldoende, op dezelfde manier als de herhalingsdetector.

Configureerbaar via `minContentRetention` (standaard `0.35`), per paar of per taal. Verhogen maakt de controle strikter; hij treedt uitsluitend op in combinatie met het deelsequentiesignaal.

:::note[Dit is een woordenschatsignaal, geen kwaliteitsknop]
Wanneer dit herhaaldelijk afgaat voor één doeltaal, beschikt het model over geen woorden voor die tekst — meestal korte, jargonrijke strings in een taal met een gesloten lexicon. Het versoepelen van de drempelwaarde herstelt de geruisloze beschadiging; het levert geen vertaling op. Verbeter de prompt, de instructiegegevens of het paar.
:::

### Schriftconformiteit

Voor locales waarvan de taalkaart een niet-Latijns schrift registreert (Arabisch, CJK, Cyrillisch, …), valideert dit dat de uitvoer niet uitsluitend Latijns is. Letters worden geclassificeerd op basis van **Unicode-schrift**, niet op basis van byte: Latijns met accenten (`"Bóók"`) en 'fullwidth' Latijns (`"Ｂｏｏｋ"`) zijn Latijns, dus geen van beide geldt als Russisch. 'Fullwidth' Latijnse letters worden geweigerd in elk doel buiten CJK-typografie (waar `"ＯＫ"` gebruikelijk Japans is) — het is Engels in vermomming. De gebruikelijke uitzonderingen blijven van kracht: een korte naam die behouden blijft zoals geschreven (de kwestie naam-of-label hierboven), gedeclareerde beschermde termen en `noTranslate`-sleutels (waaronder URL's) falen hier nooit op.

Twee verduidelijkingen over wat deze controle *niet* is:

- Het wordt **niet aangestuurd door het configuratieveld `script:`.** Dat veld selecteert de uitvoerorthografie voor [schriftconversie](/docs/getting-started/configuration#script-conversion); de verwachting van de gate is afkomstig van de taalkaarten.
- Het valideert altijd het **werkschrift dat het model produceert**, *vóór* eventuele schriftconversie. Locales met een schriftconverter (crk, sr, tlh, …) produceren terecht Latijnse werkschriftuitvoer en zijn daarom vrijgesteld van deze controle; conversie vindt — indien geactiveerd in de configuratie — plaats na de gate.

### Markup

Tags zijn code. Per tagnaam moet de vertaling hetzelfde aantal tags openen, sluiten en zelfsluitend maken als de bron, en deze op dezelfde manier nesten (`<b>` binnen `<a>` blijft binnen `<a>`); de volgorde van nevengeschikte elementen kan veranderen met de woordvolgorde. `"Please <strong>book</strong> now"` → `"Veuillez <strong>réserver maintenant"` wordt geweigerd — een ontbrekende sluitende tag maakt de pagina kapot. In een meervoudsbericht wordt elke vorm vergeleken met de bronvorm die erdoor wordt vertaald. `verify` voert dezelfde controle uit op de bestanden.

### Zinseinde naast een placeholder

Een placeholder wordt tijdens runtime ingevuld, dus een zinseinde dat door de vertaling direct ernaast wordt geplaatst, verandert wat de lezer te zien krijgt: `"Take this medicine at {time}."` → `"… sina. {time}."` toont de tijd als een eigen zin. De gate weigert een vertaling die een zinseinde (`.`, `!`, `?` of een leesteken uit een ander schrift: `。`, `？`, `।`, `؟`, `።`, `᙮`, …) direct **vóór** een placeholder plaatst, of direct **erna** terwijl er nog meer tekst volgt, wanneer de bron daar geen leesteken heeft en de vertaling meer zinseinden telt dan de bron. Een placeholder die zich enkel verplaatst naar het einde van de zin (`"Shipped by {carrier} on {date}."` → `"Expédié le {date} par {carrier}."`) slaagt wel. Dat geldt ook voor een beletselteken, een decimaalteken of een bestandsnaam (`{host}.com`), en een afkorting van één letter (`"M. {name}"`). Een langere afkorting voor een placeholder (`"ca. {count}"`) kan niet worden onderscheiden van een zinseinde en wordt daarom eveneens geweigerd, waarna de fallback van het paar of een geherformuleerd antwoord de taak overneemt. `verify` markeert dezelfde waarden op schijf, vergezeld van de `--redo`-opdracht om het opnieuw te vragen. Meervouds- en select-berichten in ICU worden overgelaten aan de ICU-controle.

### Zelfde uitvoer, verschillende invoeren

Een model dat een trainingszin uit het hoofd heeft geleerd, kan deze retourneren voor strings die het niet kent: één zin voor de titel van de app, "Contact the school", de titel van een nieuwsbrief en de bijbehorende kop, waarbij elk afzonderlijk door alle bovenstaande controles komt. Wanneer één vertaling het antwoord vormt op **drie of meer verschillende bronstrings** binnen de run van een locale — en deze vier of meer woorden bevat, of de bronnen elk uit twee of meer woorden bestaan met weinig onderlinge overeenkomst — worden die sleutels geweigerd (zodat de herhaalpoging en vervolgens de fallback ze overneemt). **Twee** verschillende bronstrings volstaan wanneer het bewijs sterk is: beide bestaan uit twee of meer woorden, ze delen minder dan de helft van hun woorden, en de gedeelde vertaling telt vier of meer woorden (`"Thank you for coming!"` en `"Please bring the forms."` beantwoord met één zin). Een op deze wijze opgevangen zin wordt onthouden voor de locale: een latere sync die deze opnieuw ontvangt, zelfs voor één string, weigert deze, en de cache-items die deze al hebben geleverd worden verwijderd, zodat een herhaalde verwerking het model opnieuw raadpleegt in plaats van de tekst uit de cache te schrijven. Synoniemen die samenvallen tot één korte vertaling (`"OK"`/`"Okay"`/`"Sure"` → `"D'accord"`, `"Close"`/`"Dismiss"` → `"Fermer"`) slagen wel, evenals één brontekst die onder meerdere sleutels wordt gebruikt. Markdown-blokken en front-matter-velden van de contentbestanden van de run tellen ook mee, evenals elke tak van een ICU-meervouds- of select-bericht (de takken van één meervoud tellen als één bron — een taal zonder getalsverbuiging schrijft in elke tak dezelfde tekst). Uitvoeren worden vergeleken zonder rekening te houden met hoofd-/kleine letters, interpunctie en Markdown-blokmarkeringen, zodat `"S?"`, `"S."` en een kop `# S` als één uitvoer gelden. De telling omvat wat de locale reeds op schijf heeft staan en wat de cache zou leveren (een zin die tekst voor tekst door een andere tool is gecachet, wordt geweigerd bij de cache en niet weggeschreven), waardoor een sleutel die sync na sync wordt toegevoegd eveneens wordt opgemerkt. `verify` faalt op hetzelfde patroon op schijf, en de MCP-tool `translate` weigert dit binnen een aanroep.

### Een vraag die haar vraagteken heeft verloren

Wanneer de bron eindigt op `?` of `!` en de vertaling noch daarop eindigt, noch op het equivalent dat het betreffende schrift gebruikt (`？`, `؟`, Grieks `;`, `¿…?`, `！`, …), geven `sync` en `verify` een waarschuwing: `"Where does it hurt?"` geschreven als mededeling leest ook als zodanig. Het is een waarschuwing en geen weigering, omdat sommige talen een vraag markeren met een woord of partikel in plaats van een leesteken. De waarschuwing noemt de sleutels en de opdracht `--redo keys:<key> --fresh` om het opnieuw te vragen (`--fresh`, omdat de cache het antwoord bevat).

## Wat er bij een fout gebeurt

1. De falende vertaling wordt gelogd naar stderr met een `[GATE]`-voorvoegsel, de sleutelnaam, de reden en een voorvertoning van de waarde
2. De sleutel wordt **niet** naar het localebestand geschreven
3. De herhaalcascade treedt in werking (zie hieronder)
4. Als het nog steeds faalt, wordt de weigering **onthouden** (zie [Geweigerde sleutels worden tegengehouden](#refused-keys-are-held-back))

```
[GATE] hero.title: source-echo — "Welcome to our platform"
[GATE] nav.about: hallucination — "À À À À À À À À"
```

## Feedback-herhaalpoging en de herhaalcascade

Een door de gate afgewezen sleutel krijgt **één feedback-herhaalpoging**: de reden van afwijzing wordt als context per sleutel in de prompt geïnjecteerd (een blinde herhaalpoging bij lage temperatuur zou immers byte-identieke uitvoer opleveren). Als de herhaalpoging slaagt, wordt de sleutel geschreven en is de sync **groen** — een gate-afwijzing die zichzelf herstelt is geen fout, en dit is de beoogde werking. Sleutels die na de herhaalpoging nog steeds falen, worden overgeslagen en gerapporteerd (de sync sluit af met `2`).

De herhaalpoging verloopt via de eigen vertaalmethode van het paar, wat die ook is — LLM, Google Translate, DeepL of een directe provider. Alleen LLM-methoden lezen de feedback; de uitvoerregel geeft dit aan (`retrying with feedback` of `asking once more (deepl takes no instructions…)`). Een `api`-endpoint ontvangt de feedback alleen wanneer het `"acceptsInstructions": true` declareert (op het paar of in het plugin-manifest); een endpoint dat `false` declareert — een getraind NMT-model zoals `nmt-forge serve`, dat hetzelfde zou antwoorden — wordt helemaal niet opnieuw gevraagd: de antwoorden worden beoordeeld zoals een tweede antwoord zou worden beoordeeld, en wat het weigert gaat naar de fallback van het paar. De herhaalpoging geldt ook voor treffers uit het vertaalgeheugen (Translation Memory): een gecachete waarde die door de gate wordt afgewezen, wordt verwijderd en in dezelfde run opnieuw vertaald, zodat een vervuilde cache zichzelf herstelt.

### Geweigerde sleutels worden tegengehouden

Een weigering wordt onthouden in `.champollion.lock`, per sleutel, voor de **huidige brontekst** van de sleutel en de **methode en het model** die het geweigerde antwoord hebben geproduceerd. Docusaurus UI-strings (`i18n/<locale>/code.json` en de JSON-bestanden van de plugins) volgen dezelfde regel, per bestand en id. De volgende reguliere `sync` stuurt die sleutel niet opnieuw naar hetzelfde model — dat zou hetzelfde antwoord factureren — en geeft aan hoeveel er zijn tegengehouden en hoe u verder kunt gaan:

- vraag opnieuw: `champollion sync --redo keys:<key>` (of `--redo all`, of `--fresh`) — het expliciet noemen van de sleutel is een directe herhaalpoging;
- vul het op een andere manier in: voeg een `"fallback"`-methode toe aan het paar (deze wordt geraadpleegd voor sleutels die de eigen methode van het paar heeft geweigerd), neem de sleutel op in `noTranslate` als deze behouden moet blijven zoals geschreven, of schrijf de vertaling handmatig in het bestand.

Een tegengehouden sleutel is niet vertaald, waardoor de sync afsluit met `2` totdat deze is ingevuld. Het wijzigen van de brontekst, het model of de methode heft de blokkering op (de weigering gold immers voor die specifieke tekst van dat model). De cache wordt er nog steeds voor gelezen — het tegenhouden stopt betaalde aanroepen, geen kosteloze. Een sleutel die een herhaalde verwerking niet kon voltooien, is de enige uitzondering, zoals hieronder beschreven.

### Geweigerde Markdown-blokken en front-matter-velden

Dezelfde regel geldt voor contentbestanden (`contentDir`, Docusaurus-documenten). Een blok of front-matter-veld dat door de gate is geweigerd, wordt onthouden in `.champollion-content.lock`, per pagina, blok en locale, voor de **huidige brontekst** van het blok en de **methode en het model** die het geweigerde antwoord hebben geproduceerd. Een blok wordt geïdentificeerd aan de hand van zijn brontekst, dus het bewerken van de alinea heft de blokkering op. De volgende reguliere `sync` stuurt het niet opnieuw naar hetzelfde model, en vermeldt hoeveel blokken en velden op welke pagina zijn tegengehouden:

- een tegengehouden blok behoudt zijn brontekst op de pagina, zonder markering, totdat het is ingevuld; de rest van de pagina wordt geschreven;
- een tegengehouden front-matter-veld behoudt zijn brontekst op dezelfde manier, en de rest van de pagina wordt geschreven;
- een pagina die in zijn geheel is vertaald (`contentSegmentation: "page"`), wordt in zijn geheel geweigerd wanneer het antwoord een beschermd blok beschadigt of de pagina uitholt. Deze wordt onthouden op basis van de tekst van de hoofdtekst (body) en in zijn geheel tegengehouden: de pagina wordt niet geschreven en er wordt niets van verzonden totdat deze is ingevuld. Het bewerken van de hoofdtekst of het overschakelen op bloksegmentatie heft de blokkering op.

Een weigering die is gedaan door een eerdere versie van de gate, vervalt vanzelf. Wanneer een controle wordt versoepeld, wordt datgene wat geweigerd was bij de volgende sync opnieuw opgevraagd, zonder dat er een herhaalde verwerking nodig is.

De prioriteit volgt de prioriteit van de sleutels:

1. Een pagina die expliciet is aangewezen voor herhaalde verwerking wordt altijd verzonden: `champollion sync --redo files:<page>`, `--redo content` (elke pagina), `--retranslate`, of alles onder `--fresh`.
2. Anders wordt een geweigerd blok of veld tegengehouden. Als het paar een `fallback`-methode heeft die het niet heeft geweigerd, wordt de fallback geraadpleegd en de eigen methode van het paar niet.
3. Een wijziging van model of methode heft de blokkering op, evenals een wijziging in de brontekst van het blok.

De cache wordt nog steeds eerst gelezen, dus het tegenhouden stopt betaalde aanroepen, geen kosteloze. Een blok dat op een andere manier wordt ingevuld, verliest zijn registratie: via een fallback, via de cache of via een alinea die u zelf in de vertaling schrijft (een contentmap behoudt een handgeschreven alinea). Een tegengehouden blok of veld is niet vertaald, waardoor de sync afsluit met `2` totdat het is ingevuld. Hetzelfde geldt voor een blok dat de gate tijdens deze run heeft geweigerd. Een dry-run geeft een overzicht van wat een daadwerkelijke run zou tegenhouden.

### Een herhaalde verwerking die niet kon worden voltooid

Wanneer `--redo all`, `--redo keys:` of een modelwissel (`--redo all --fresh-on-model-change`) sleutels van een sleutel-waardebestand onvertaald laat, worden deze als **in behandeling** geregistreerd in `.champollion.lock`, en vraagt de volgende reguliere `sync` ze nog eenmaal op bij het model — bij het model, niet uit de cache (het doel van de herhaalde verwerking was immers de tekst van het nieuwe model). `champollion status` toont deze sleutels. Als die herhaalpoging eveneens wordt geweigerd, blijft de sleutel in behandeling (de status geeft dit aan) en wordt deze tegengehouden zoals elke geweigerde sleutel. In volgorde van prioriteit: een sleutel genoemd door `--redo`/`--fresh` wordt altijd verzonden; een sleutel in behandeling krijgt die ene herhaalpoging; een geweigerde sleutel wordt tegengehouden. Een Docusaurus UI-string kent geen herhaalpoging bij 'in behandeling': wordt deze geweigerd bij een herhaalde verwerking, dan wordt deze bij de volgende reguliere sync tegengehouden, net als een contentblok.

Afzonderlijk daarvan geldt: wanneer een hele batch mislukt (JSON-parseerfout), probeert champollion het opnieuw met steeds kleinere batches:

```
Full batch (80 keys) → parse error
  └→ Half batch (40 keys) → 2 failures
      └→ Individual keys (1 each) → isolates the 2 problem keys
```

Het herprobeerbudget wordt begrensd door `maxRetries` (standaard: 3, per taal configureerbaar). Dit voorkomt ongecontroleerde tokenuitgaven voor sleutels die consequent mislukken.

Na het uitputten van de herhaalpogingen worden de probleemsleutels gelogd en overgeslagen. Een sleutel die geen bruikbaar antwoord heeft gekregen (ontbrekend in de respons) wordt bij de volgende `sync` opnieuw gevraagd; een sleutel die door de gate is geweigerd, wordt tegengehouden, zoals hierboven beschreven.

## Promptcaching

Het systeembericht (register, grammaticaregels, stijlnotities) wordt gescheiden van het gebruikersbericht (de te vertalen sleutels). Deze scheiding is bewust:

- Het systeembericht is **identiek voor alle batches** voor een gegeven locale
- Providers zoals Anthropic en Google cachen herhaalde systeemberichten
- Resultaat: de eerste batch betaalt de volledige tokenkosten, volgende batches betalen alleen voor het gebruikersbericht

Dit kan de tokenkosten aanzienlijk verlagen voor projecten met veel batches.

## ICU MessageFormat-validatie

Het commando `integrity` valideert ICU MessageFormat-meervoudspatronen aan de hand van CLDR-meervoudsregels. Als uw bronbestand ICU-syntaxis gebruikt zoals:

```json
"items": "{count, plural, one {# item} other {# items}}"
```

Champollion verifieert dat vertaalde versies alle vereiste meervoudscategorieën voor de doellocale bevatten. Arabisch vereist bijvoorbeeld zes categorieën (`zero`, `one`, `two`, `few`, `many`, `other`) — niet alleen `one` en `other`.

### Meervoudsvormen die de vertaling niet heeft geleverd

De prompt noemt de CLDR-categorieën van de doeltaal. Wanneer een meervoudsbericht terugkomt zonder een vorm die de taal gebruikt voor gangbare tellingen (elk getal van 0 tot 1000 — Russisch `few` voor 2, 3, 4 en `many` voor 0, 5, 6), vraagt de gate het model nog eenmaal, met vermelding van de ontbrekende vormen en de getallen die ze dekken. Een tweede antwoord zonder die vormen wordt geaccepteerd, nooit een derde keer gevraagd en nooit door de tool aangevuld — sync doet dan het volgende:

- waarschuwt, met vermelding van elke sleutel en de ontbrekende vormen, evenals de opdracht om het opnieuw te vragen (`sync --redo keys:… --fresh`, waarbij een sterker `--model` kan helpen);
- schrijft in een gettext-catalogus, waar `msgfmt` elke `msgstr[n]` vereist, de ontbrekende vormen als kopieën van `other` en markeert de vermelding met een `# champollion:`-vertalerscommentaar (Poedit en Weblate tonen dit; `verify` leest het, ook in CI zonder de cache);
- schrijft het bericht in ICU-bestanden (next-intl, ARB) zoals het binnenkwam; de app toont de `other`-vorm voor die aantallen.

Een dergelijk bericht wordt niet behandeld als vertaald. Een latere sync die een andere methode of een ander model uitvoert — een die het nog niet heeft beantwoord, zoals het gehoste model van CI na een lokaal model — vraagt het opnieuw op, bij het model en niet uit de cache (die het onvolledige antwoord bevat); de schatting berekent de kosten hiervoor. `sync --redo gaps` vraagt elk dergelijk bericht opnieuw op, ongeacht wie het heeft achtergelaten. Als het nieuwe antwoord de vormen eveneens mist, blijft het bericht zoals het was (gemarkeerd in een catalogus), en `.champollion.lock` legt vast welke configuraties zonder deze vormen hebben geantwoord, zodat geen van hen opnieuw naar dezelfde tekst wordt gevraagd ([CI-gids](/docs/guides/ci-cd#plural-gaps)).

`verify` rapporteert beide gevallen met de bijbehorende herstelopdracht. Vormen die alleen boven de 1000 voorkomen of bij breuken (Frans en Spaans `many`, gebruikt voor 1 000 000) krijgen een informatielijn, geen waarschuwing. Een machinevertalingsengine (DeepL, Google, …) kan niet worden geïnstrueerd welke vormen moeten worden geschreven, dus het antwoord daarvan wordt niet opnieuw geprobeerd — alleen gerapporteerd. Voor i18next-bestanden geldt dat elke vorm die de bron niet heeft (Frans `count_many` vanuit het Engels) een eigen sleutel is, vertaald vanuit de `_other`-tekst: een LLM wordt om die vorm gevraagd, en sync geeft dat aan; bij een machinevertalingsengine geeft het aan dat de waarde de `other`-vorm bevat.

Voer `champollion integrity` uit om de meervoudsvolledigheid voor alle locales te controleren.

## Terminologiehandhaving

Voor gecoachte paren met een woordenboek voert champollion na de vertaling een terminologiecontrole uit. Nadat de kwaliteitspoort is geslaagd, wordt geverifieerd of de LLM de vereiste woordenboektermen daadwerkelijk heeft gebruikt.

```
[TERM] en→fr: 2 term violation(s)
  • hero.title: "dashboard" → expected "tableau de bord" but got "panneau de contrôle"
```

Terminologieovertredingen zijn **waarschuwingen, geen blokkerende fouten**. De vertaling wordt nog steeds naar schijf geschreven. Dit is bewust — de LLM kan geldige redenen hebben om een alternatief te kiezen (context, grammatica), en blokkeren op termijnafwijkingen zou meer schade aanrichten dan goed doen.

Om overtredingen te verhelpen, werkt u het coachingwoordenboek bij of bewerkt u het localebestand handmatig.

---

## Zie ook

- [Hoe synchronisatie werkt](/docs/concepts/how-sync-works) — waar de kwaliteitspoort in de pijplijn past
- [Vertaalmethoden](/docs/guides/translation-methods) — methoden die invoer leveren aan de poort
- [Schriftconverters](/docs/concepts/script-converters) — schriftconversie na de poort
- [Coachinggegevens](/docs/concepts/coaching-data) — vertaalkwaliteit stroomopwaarts verbeteren
- [Vertaalgeheugen](/docs/concepts/translation-memory) — gevalideerde vertalingen cachen
- [CLI-referentie — sync](/docs/reference/cli#sync) — sync-vlaggen inclusief herprobeergedrag
- [CLI-referentie — integrity](/docs/reference/cli#integrity) — ICU-meervoudsaudit
