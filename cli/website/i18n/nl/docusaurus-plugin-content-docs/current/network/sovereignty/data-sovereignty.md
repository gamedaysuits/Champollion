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
> ontwikkeling op het gebied van automatische vertaling — de broncode is beschikbaar en gratis voor niet-commercieel gebruik, het
> evaluatieframework is open source. Deze pagina beschrijft de volledige positie ten aanzien van taaldata:
> corpora behoren toe aan de mensen van wie ze afkomstig zijn, elke licentie en gemeenschapsvoorwaarde
> wordt mechanisch gerespecteerd in plaats van slechts door een belofte, en het platform stelt
> zelf geen voorwaarden aan de taal van wie dan ook.

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

2. **Elke licentie wordt nageleefd — via een poort, niet via een belofte.** Niet-commerciële en uitsluitend voor onderzoek bestemde corpora worden mechanisch uitgesloten van elk gebruik dat hun licentie niet toestaat. Beperkingen die een gemeenschap buiten de licentie om oplegt, worden geregistreerd met hun bron en op dezelfde wijze gerespecteerd. De handhaving berust op CI-poorten en databasetriggers, niet op een gedragscode.

3. **De voorwaarden zijn die van de beheerder, en zij variëren.** Verschillende talen zullen verschillende overeenkomsten kennen — een openbaar CC0-corpus, een uitsluitend voor onderzoek bestemd gemeenschapscorpus en een afgesloten testset met soevereine implementatievereisten kunnen allemaal deelnemen, elk op eigen voorwaarden. Er is hier geen universeel contract en er wordt geen standaardaanspraak gemaakt op wat dan ook. Zie het [Voorwaardenraamwerk](/docs/network/sovereignty/ownership-transfer).

4. **Geheime corpora worden ondersteund als architectuur, niet als uitzondering.** Een gemeenschap kan een testset afgesloten houden — bewaard op haar eigen infrastructuur, nooit ingezien door Champollion of door ontwikkelaars — en toch methoden daarop laten scoren. Meetbaarheid zonder extraheerheid is een ontwerpdoel, geen noodoplossing.

5. **Attributie en erkenning reizen mee met de data.** Erkenning van bouwers en taalkundigen is verplicht op elk oppervlak waarop een corpus verschijnt. Waar een gemeenschap [Local Contexts](https://localcontexts.org/) TK- of BC-labels heeft toegepast, tonen wij deze en respecteren wij het protocol dat zij coderen. Wij dragen Labels; wij kennen ze nooit zelf toe.

6. **Bijdragers worden betaald.** Het bouwen en valideren van corpora is professioneel werk tegen gepubliceerde tarieven — zie [Hoe sprekers worden betaald](/docs/network/perspectives/how-speakers-get-paid). Betaling koopt het corpus niet: de bouwer wordt betaald *en* blijft de beheerder.

## Hoe een licentie wordt gehandhaafd

Toezegging 2 heeft een specifieke vorm en het is de moeite waard om deze volledig te vermelden — dit is
hoe "elke licentie wordt gerespecteerd" in de praktijk werkt, niet slechts een samenvatting van goede
bedoelingen.

**Elke benchmark wordt bij binnenkomst vastgehouden.** Een nieuw gecatalogiseerde testset wordt standaard in quarantaine geplaatst:
zichtbaar in de index, uitgesloten van de evaluatiewachtrij, van
wedstrijden en van elke ranglijst. Er wordt bij inname niets aangenomen over een corpus
— zelfs geen licentie die er permissief uitziet — totdat de voorwaarden ervan zijn getoetst aan
de daadwerkelijke licentietekst bij een vastgezette upstream-revisie.

**Beoordelingsbesluiten zijn mechanisch, en de moeilijke gevallen blijven vastgehouden.** Een duidelijk
vermelde permissieve licentie geeft het corpus vrij voor elk traject. Een duidelijk vermelde
niet-commerciële licentie geeft het vrij voor een onderzoekstraject dat is uitgesloten van
elke commerciële, prijs- en API-omgeving. En een licentie die niet is vermeld,
gewijzigd, gemengd of op maat gemaakt is, wordt **nooit geïnterpreteerd namens de
rechthebbende**: het corpus blijft gecatalogiseerd maar vastgehouden — buiten de wachtrij, wedstrijden
en ranglijsten — totdat de rechthebbende voorwaarden stelt of een toestemming registreert. Het
besluit, de datum, het traject en de grondslag ervan worden machinaal leesbaar vastgelegd op de
corpuskaart en de registervermeldingen, zodat "waarom is dit uitvoerbaar?" altijd een
citeerbaar antwoord heeft, net als "waarom is dit niet zo?"

**Tekst naar een model sturen is een transmissie, en deze wordt gecontroleerd.** Een model
evalueren betekent dat er bronzinnen naar worden verzonden — dat is het corpus dat zijn thuisbasis verlaat, en
dit wordt per licentie gereguleerd. Corpora met een permissieve licentie mogen standaardkanalen
gebruiken. Corpora onder een vermelde niet-commerciële licentie verplaatsen zich alleen via
kanalen die contractueel niet trainen op invoer — precies als zodanig vermeld: een
garantie op niet-trainen, niet een garantie op niet-bewaren. Corpora onder niet-vermelde of
gewijzigde toekenningen worden direct geweigerd voor evaluatie op afstand totdat toestemming is
geregistreerd, en verzegelde gemeenschapssets verlaten de infrastructuur van hun beheerder
helemaal nooit. Wanneer de poort weigert, citeert het weigeringsbericht het
besluit van de licentiebeoordeling.

**De handhaving bevindt zich onder elke client.** Blokkades worden gehandhaafd door een
database-trigger die geen enkele client kan omzeilen, de no-hosting-regel wordt gehandhaafd door een
repository-poort die elk getraceerd pad scant op corpusinhoud, en de
transmissiepoort draait binnen het evaluatieframework zelf. Elk van deze kan
nee tegen ons zeggen, en dat is precies de bedoeling.

## Wat dit niet is

Champollion is geen datamakelaardij, geen vertaalleverancier en geen commercieel platform. Het is onderzoeksgereedschap. Een hoge score op het leaderboard bewijst dat een methode technisch werkt; het is geen licentie om vertalingen te publiceren, een corpus te herverspreiden of iets in te zetten tegen de wensen van een gemeenschap. Die beslissingen behoren altijd toe aan de beheerder.

## De raamwerken die dit ontwerp hebben gevormd

Dit standpunt is niet hier uitgevonden. Het is geïnformeerd door, en schatplichtig aan, het werk op het gebied van Indigenous data governance van de afgelopen twee decennia:

- **First Nations-datasoevereiniteitsprincipes** — First Nations in Canada hebben eigendom, controle, toegang en bezit van hun eigen informatie verwoord; het beheermodel hier is ontworpen om daarmee compatibel te zijn.
- **[CARE Principles](https://www.gida-global.org/care)** (Collective Benefit, Authority to Control, Responsibility, Ethics) — Global Indigenous Data Alliance.
- **[Te Mana Raraunga](https://www.temanararaunga.maori.nz/)** — het Māori Data Sovereignty Network.
- **De [Kaitiakitanga License](https://tehiku.nz/)** — de op voogdijschap gebaseerde licentie van Te Hiku Media voor te reo Māori-data, een directe invloed op het hier gebruikte bewaarmodel waarbij de beheerder de sleutels houdt.

Wij verwijzen iedereen die governance ontwerpt voor de data van hun eigen taal rechtstreeks naar die bronnen — zij zijn de autoriteiten, niet wij. Waar een gemeenschap een van deze raamwerken voor haar corpus aanneemt, legt de corpuskaart die bewering vast en respecteert het gereedschap deze.

Champollion toont de Local Contexts **"Open to Collaborate" Notice**: wij bouwen relaties op met de gemeenschappen wier talen hier verschijnen, en door de gemeenschap opgestelde Labels hebben voorrang boven alles wat wij over hun data zeggen.

## Zie ook

- [Datasoevereiniteit, vanaf nul](/docs/learn/data-sovereignty) — de introductieversie van deze pagina, voor lezers voor wie dit concept nieuw is

- [Corpora registreren & blootstellingsbanen](/docs/network/sovereignty/registering-corpora) — de mechanismen
- [Voor taalgemeenschappen](/docs/network/community/for-language-communities) — een gids in begrijpelijke taal
- [Hoe sprekers worden betaald](/docs/network/perspectives/how-speakers-get-paid) — gepubliceerde tarieven en voorwaarden
- [Vertaalmethoden](https://champollion.dev/docs/guides/translation-methods) — de `api`-methode, die de prompts, woordenboeken en coachingdata van een gemeenschap op haar eigen servers bewaart
