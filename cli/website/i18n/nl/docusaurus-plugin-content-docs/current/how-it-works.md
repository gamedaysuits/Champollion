---
title: "Hoe het werkt"
slug: /how-it-works
description: "Wat “op rails met vangrails” betekent: elke stap bij het bouwen van een vertaler overzichtelijk op volgorde, met controles die de gebruikelijke fouten tegenhouden en uw woorden onder uw controle houden."
---

# Hoe het werkt: op rails met vangrails

Stelt u zich twee regels voor die naast elkaar lopen: een zin in de ene taal, en
dezelfde zin in de andere. Dat is waar een vertaler van leert, en wat deze
schrijft.

Om er een te bouwen had u vroeger een specialist nodig. U moest weten hoe u de
zinnen voorbereidde, hoe u een vertaler trainde, en — het moeilijkst van alles —
hoe u deze testte zonder uzelf voor de gek te houden. De meeste van die lessen
werden met vallen en opstaan geleerd.

Champollion legt dit alles uit als **rails**: elke stap op volgorde, en een plek
voor alles. Langs de rails lopen **vangrails**: controles die de gebruikelijke
fouten voorkomen en uw woorden onder uw controle houden. U — of een AI-assistent
die u vertrouwt — volgt de rails. U neemt de beslissingen.

## Wie wat beslist

De rails voeren de stappen uit. Mensen beslissen. Elke stap valt onder een van vier soorten:

- **Alleen een mens kan het doen** — zinnen schrijven en vertalingen controleren.
  Geen enkel hulpmiddel doet zich voor als een spreker.
- **Alleen u kunt antwoorden** — aan wie uw woorden toebehoren, of een vertaler
  ervan mag leren, wat u verwacht voordat u enig resultaat ziet. Uw
  assistent vraagt het; deze antwoordt nooit voor u.
- **Uw assistent vraagt eerst** — alles wat iets installeert, een vertaler
  traint, geld kost of iets online zet, wacht op uw toestemming. *Niet
  nu* is ook een antwoord: de rails vragen het die sessie niet opnieuw.
- **Uw assistent doet het gewoon** — zoals zinnen controleren op problemen, of
  er een aantal opzijzetten.

## De rails: een plek voor alles

Een project is één map op uw computer, met een plank voor elk soort ding:

| Plank | Wat erop hoort |
|---|---|
| Zinnen om van te leren | Zinnenparen, één in elke taal |
| Testzinnen | Zinnen die een vloeiende spreker heeft gecontroleerd. Alleen gebruikt om te beoordelen, nooit om van te leren |
| Woordenlijsten | Woordenboeken en woordenlijsten |
| Grammaticanotities | Alles wat geschreven is over hoe de taal werkt |
| Overeenkomsten | Aantekeningen van wie waarmee akkoord ging, en wanneer |
| Postvak in | Uw bestanden, zoals u ze heeft, wachtend om binnengehaald te worden |

De vertalers die u bouwt, hun resultaten en een vastlegging van elke stap krijgen
een eigen plank.

Uw zinnen belanden op drie stapels. De meeste zijn om te **leren**. Sommige — eerst
een kwart, één op de tien zodra u er veel hebt — worden **oefenzinnen**
— zoals oefenvragen, die elke ronde worden gebruikt
om te zien hoe het gaat. Een paar, gecontroleerd door een spreker, zijn de **testzinnen**,
die slechts af en toe worden gebruikt. De vertaler leert nooit van de
laatste twee.

Omdat alles een eigen plek heeft, kunnen de hulpmiddelen altijd zien wat er klaar is en
wat er daarna komt. Vraag het ze op elk willekeurig moment en ze noemen **de volgende stap**,
rechtstreeks uitgelezen uit de map. Uw assistent hoeft geen expert te zijn, of
te onthouden waar u was gebleven. Deze volgt de rails.

De stappen volgen deze volgorde:

1. **Start het project** — geef de twee talen op, en in welke richting u
   vertaalt.
2. **Verzamel uw gegevens** — breng binnen wat u heeft, en leg vast aan wie het
   toebehoort en hoe het mag worden gebruikt.
3. **Bescherm uw testset** — zet de zinnen opzij waarop u elke vertaler
   zult beoordelen.
4. **Installeer de trainingshulpmiddelen** — eenmalig, met uw toestemming.
5. **Bouw en test een vertaler** — train deze, en kijk vervolgens hoe deze presteert op de
   testzinnen.
6. **Verbeter het, ronde na ronde** — een spreker controleert de concepten, en elke
   ronde richt zich op wat er misgaat.

U kunt een stap altijd op uw eigen manier doen — met de hand, of met andere hulpmiddelen — en
de rails pakken de draad weer op vanaf waar de map aangeeft dat u bent.

## De vangrails

Er zijn twee soorten vangrails.

**Sommige behoeden u ervoor uzelf voor de gek te houden.** Een vertaler die wordt getest op zinnen
waarvan deze al heeft geleerd, lijkt briljant maar is dat niet. Een gelukkige ronde lijkt op vooruitgang.
Daarom doen de rails het volgende:

- de testzinnen opzijzetten voordat het trainen begint,
- zinnen verwijderen die deze vrijwel kopiëren,
- u vragen op te schrijven wat u verwacht voordat u een resultaat ziet,
- en een nieuwe vertaler pas beter noemen wanneer deze de oude met meer dan
  alleen geluk verslaat.

**Sommige houden uw woorden onder uw controle.** Elk bestand krijgt een notitie met wat
de mensen aan wie het toebehoort hebben besloten — mag het deze computer verlaten, mag een
vertaler ervan leren — en elk hulpmiddel respecteert die notitie.

De hulpmiddelen weigeren de meeste van deze controles over te slaan. Een paar zijn afhankelijk van u en uw
assistent, en [de vangrailspagina](/docs/guardrails) geeft aan welke dat zijn.

**Volgende:** [De vangrails, één voor één →](/docs/guardrails)

## Meer informatie

- [Het operationele contract voor AI-agents](/docs/agents/contract) — de regels die een
  assistent op de rails volgt, en welke de hulpmiddelen zelf afdwingen.
- [Elk commando, stap voor stap](/docs/agents/shell) — het volledige
  technische overzicht.
- [Hoe de pijplijn voor app-vertaling werkt](/docs/concepts/how-sync-works) —
  als u hier bent gekomen voor het vertalen van de tekst van een app of website.
