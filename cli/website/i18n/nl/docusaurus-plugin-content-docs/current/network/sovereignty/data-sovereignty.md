---
sidebar_position: 7
title: "Gegevensbeheer"
description: "Het standpunt van Champollion over taaldata: corpora blijven bij hun beheerders, elke licentie wordt gerespecteerd en gemeenschapsvoorwaarden zijn van toepassing op gemeenschapsdata."
related:
  - label: "The Derived-Artifacts Commitment"
    to: /docs/network/sovereignty/derived-artifacts
    kind: doc
    note: "The output side: models and derived artifacts belong to speakers"
  - label: "Registering Corpora & Exposure Lanes"
    to: /docs/network/sovereignty/registering-corpora
    kind: doc
    note: "The mechanics: benchmark a corpus without handing it over"
  - label: "How the Work Is Funded"
    to: /docs/network/sovereignty/economic-model
    kind: doc
  - label: "Reporting Errors and Owning Corrections"
    to: /docs/network/perspectives/reporting-errors-and-owning-corrections
    kind: position
  - label: "For Language Communities"
    to: /docs/network/community/for-language-communities
    kind: doc
---

# Gegevensbeheer

> **Managementsamenvatting.** Champollion is tooling voor onderzoek en
> ontwikkeling op het gebied van machinevertaling — met beschikbare broncode en gratis voor
> niet-commercieel gebruik, waarvan het evaluatiekader open source is. Deze pagina
> beschrijft het standpunt over taaldata volledig: corpora behoren toe aan de
> mensen van wie ze afkomstig zijn, elke licentie- en gemeenschapsvoorwaarde wordt
> mechanisch gerespecteerd in plaats van enkel op basis van beloften, en het
> platform legt zelf geen voorwaarden op aan de taal van wie dan ook.

:::info[Taaldata is biodata]
Taaldata is **biodata**. Net als genetische of medische gegevens draagt een taal
de identiteit, verwantschap en relaties van de mensen die haar spreken — en net
als een genoom kan zij niet op zinvolle wijze worden geanonimiseerd: verwijder
de namen en de taal codeert nog steeds wie haar mensen zijn. De mensen die een
corpus aanleveren, bezitten dus de sleutels daartoe, en tot alles wat daaraan
wordt gemeten. Dat is de premisse waarop alles hieronder berust.
:::

Vanuit die premisse volgt het ontwerp. Champollion behandelt elke corpusbijdrager als een **beheerder**: het corpus blijft van hen — juridisch, fysiek en praktisch — terwijl de infrastructuur het *meetbaar* maakt.

## De toezeggingen

1. **Wij bewaren de data nooit.** Corpora worden geregistreerd als hash-vastgezette metadatakaarten en worden op het moment van evaluatie opgehaald van de eigen hosting van de beheerder. Er wordt niets gekopieerd naar deze repository of geserveerd vanuit onze infrastructuur. Zet uw archief offline en de evaluatie daartegen stopt eenvoudigweg. Zie [Corpora registreren](/docs/network/sovereignty/registering-corpora).

2. **Elke licentie wordt gerespecteerd — via gates, niet via beloften.** Niet-commerciële
   corpora en corpora uitsluitend voor onderzoeksdoeleinden worden mechanisch
   uitgesloten van elk gebruik dat hun licentie niet toestaat. Beperkingen die door
   een gemeenschap buiten de licentie om worden gesteld, worden geregistreerd met
   hun bron en op dezelfde wijze gerespecteerd. De handhaving bevindt zich in
   pre-push-gates die lokaal vóór elke push worden uitgevoerd (CI is momenteel
   uitgeschakeld) en in databasetriggers, niet in een gedragscode.

3. **De voorwaarden zijn die van de beheerder, en zij variëren.** Verschillende talen zullen verschillende overeenkomsten kennen — een openbaar CC0-corpus, een uitsluitend voor onderzoek bestemd gemeenschapscorpus en een afgesloten testset met soevereine implementatievereisten kunnen allemaal deelnemen, elk op eigen voorwaarden. Er is hier geen universeel contract en er wordt geen standaardaanspraak gemaakt op wat dan ook. Zie het [Voorwaardenraamwerk](/docs/network/sovereignty/ownership-transfer).

4. **Geheime corpora worden ondersteund als architectuur, niet als uitzondering.** Een gemeenschap kan een testset afgesloten houden — bewaard op haar eigen infrastructuur, nooit ingezien door Champollion of door ontwikkelaars — en toch methoden daarop laten scoren. Meetbaarheid zonder extraheerheid is een ontwerpdoel, geen noodoplossing.

5. **Naamsvermelding en erkenning reizen mee met de data.** Erkenning voor makers
   en taalkundigen is verplicht op elk oppervlak waarop een corpus verschijnt.
   Waar een gemeenschap [Local Contexts](https://localcontexts.org/) TK- of BC-Labels
   heeft toegepast, zijn we voornemens deze weer te geven en het protocol dat ze
   coderen te respecteren; ondersteuning voor Labels is nog niet geïmplementeerd.
   We zullen Labels tonen; we kennen ze nooit zelf toe.

6. **Bijdragers worden betaald.** Het bouwen en valideren van corpora is
   professioneel werk dat tegen gepubliceerde tarieven zal worden betaald zodra
   er financiering is (momenteel zijn er geen fondsen beschikbaar) — zie
   [Hoe sprekers worden betaald](/docs/network/perspectives/how-speakers-get-paid).
   Betaling koopt het corpus niet af: de maker wordt betaald *en* blijft de
   beheerder.

## Hoe een licentie wordt omgezet in handhaving

Toezegging 2 heeft een specifieke vorm en is het waard om volledig te worden
geformuleerd — dit is hoe "elke licentie wordt gerespecteerd" in de praktijk
werkt, niet een opsomming van goede bedoelingen.

**Elke benchmark begint in de wachtstand.** Een nieuw gecatalogiseerde testset
wordt standaard in quarantaine geplaatst: zichtbaar in de index, maar uitgesloten
van de evaluatiewachtrij, van wedstrijden en van elke ranglijst. Bij opname wordt
niets aangenomen over een corpus — zelfs geen licentie die permissief oogt —
totdat de voorwaarden zijn gecontroleerd aan de hand van de daadwerkelijke
licentietekst bij een vastgezette upstream-revisie.

**Beoordelingsbesluiten zijn mechanisch, en de moeilijke gevallen blijven in de
wachtstand.** Een duidelijk vermelde permissieve licentie geeft het corpus vrij
voor elk traject. Een duidelijk vermelde niet-commerciële licentie geeft het vrij
voor een onderzoekstraject dat is uitgesloten van elk commercieel platform,
prijzen- en API-oppervlak. En een licentie die niet is vermeld, gewijzigd, gemengd
of op maat gemaakt is, wordt **nooit geïnterpreteerd namens de rechthebbende**:
het corpus blijft gecatalogiseerd maar in de wachtstand — buiten de wachtrij,
wedstrijden en ranglijsten — totdat de rechthebbende voorwaarden formuleert of een
toekenning vastlegt. Het besluit, de datum, het traject en de grondslag worden
machinaal leesbaar vastgelegd op de corpuskaart en de registervermeldingen ervan,
zodat "waarom is dit uitvoerbaar?" altijd een citeerbaar antwoord heeft, net zoals
"waarom is dit dat niet?"

**Tekst naar een model sturen is een transmissie, en deze wordt gereguleerd door
een gate.** Het evalueren van een model betekent dat er bronzinnen naartoe worden
gestuurd — daarmee verlaat het corpus zijn vertrouwde omgeving, en dat wordt
gereguleerd per licentie. Permissief gelicentieerde corpora mogen standaardkanalen
gebruiken. Corpora onder een uitdrukkelijk niet-commerciële licentie verplaatsen
zich uitsluitend via kanalen die contractueel niet trainen op invoer — expliciet
geformuleerd als: een niet-trainen-garantie, niet een niet-bewaren-garantie. Corpora
onder niet-vermelde of gewijzigde toekenningen wordt evaluatie op afstand direct
geweigerd totdat toestemming is vastgelegd, en verzegelde gemeenschapssets verlaten
de infrastructuur van hun beheerder nooit. Wanneer de gate weigert, citeert het
weigeringsbericht het oordeel van de licentiebeoordeling.

**De handhaving bevindt zich onder elke client.** Wachtstanden worden afgedwongen
door een databasetrigger die geen enkele client kan omzeilen, de regel tegen
hosting wordt afgedwongen door een pre-push-gate die lokaal vóór elke push wordt
uitgevoerd (CI is momenteel uitgeschakeld) en die elk bijgehouden en gepusht pad
scant op corpusinhoud, en de transmissiegate draait binnen het evaluatiekader
zelf. Elk van deze mechanismen kan 'nee' tegen ons zeggen, en dat is precies het
punt.

## Wat dit niet is

Champollion is geen datamakelaardij, geen vertaalleverancier en geen commercieel platform. Het is onderzoeksgereedschap. Een hoge score op het leaderboard bewijst dat een methode technisch werkt; het is geen licentie om vertalingen te publiceren, een corpus te herverspreiden of iets in te zetten tegen de wensen van een gemeenschap. Die beslissingen behoren altijd toe aan de beheerder.

## De raamwerken die dit ontwerp hebben gevormd

Dit standpunt is niet hier uitgevonden. Het is geïnformeerd door, en schatplichtig aan, het werk op het gebied van Indigenous data governance van de afgelopen twee decennia:

- **Principes van datasoevereiniteit van First Nations** — First Nations in Canada
  hebben gemeenschapseigendom, controle, toegang en bezit van hun eigen informatie
  geformuleerd; het beheermodel hier is ontworpen om compatibel te zijn met die
  uitgangspunten.
- **[CARE-principes](https://www.gida-global.org/care)** (Collective Benefit,
  Authority to Control, Responsibility, Ethics) — Global Indigenous Data
  Alliance.
- **[Te Mana Raraunga](https://www.temanararaunga.maori.nz/)** — het Māori Data
  Sovereignty Network.
- **De [Kaitiakitanga-licentie](https://tehiku.nz/)** — Te Hiku Media's op
  beheerderschap gebaseerde licentie voor data in het te reo Māori, een directe
  invloed op het bewaarmodel waarbij de beheerder de sleutels in handen heeft dat
  hier wordt gebruikt.

Wij verwijzen iedereen die governance ontwerpt voor de data van hun eigen taal rechtstreeks naar die bronnen — zij zijn de autoriteiten, niet wij. Waar een gemeenschap een van deze raamwerken voor haar corpus aanneemt, legt de corpuskaart die bewering vast en respecteert het gereedschap deze.

Champollion is voornemens de **"Open to Collaborate"-kennisgeving** en Labels van
Local Contexts over te nemen; geen van beide is nog geïmplementeerd. Zodra dat wel
het geval is, hebben door de gemeenschap opgestelde Labels voorrang op alles wat
wij over de data van een gemeenschap zeggen.

## Zie ook

- [Datasoevereiniteit vanaf nul](/docs/learn/data-sovereignty) — de introductieversie van deze pagina, voor lezers voor wie dit concept nieuw is

- [Corpora registreren & blootstellingsbanen](/docs/network/sovereignty/registering-corpora) — de mechanismen
- [Voor taalgemeenschappen](/docs/network/community/for-language-communities) — een gids in begrijpelijke taal
- [Hoe sprekers worden betaald](/docs/network/perspectives/how-speakers-get-paid) — gepubliceerde tarieven en voorwaarden
- [Vertaalmethoden](https://champollion.dev/docs/guides/translation-methods) — de `api`-methode, die de prompts, woordenboeken en coachingdata van een gemeenschap op haar eigen servers bewaart
