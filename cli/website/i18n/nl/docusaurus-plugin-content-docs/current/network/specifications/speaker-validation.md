---
sidebar_position: 8
title: "Sprekervalidatieprotocol"
slug: '/network/specifications/speaker-validation'
---

# Sprekervalidatieprotocol

> **Doel.** Dit document definieert precies wat we nodig hebben van tweetalige Cree-Engels sprekers om de LYSS-evaluatiemetrieken te valideren. Zonder deze validatie zijn onze geautomatiseerde scores technische schattingen, geen bewezen kwaliteitsmetingen. Dit is de allerbelangrijkste leemte in het project.
>
> **Doelgroep.** Gemeenschapspartners, potentiële samenwerkingspartners, subsidiebeoordelaars en het projectteam.


---

## 1. Waarom We Sprekers Nodig Hebben

Het LYSS-evaluatieraamwerk (Linguistically-informed Yield & Structural Scoring) berekent geautomatiseerde kwaliteitsscores voor vertalingen van het Engels naar het Plains Cree. Het maakt gebruik van drie kernsignalen:

- **LYSS-fst**: Bevat de uitvoer geldige Cree-woorden? (gecontroleerd door de GiellaLT finite-state transducer)
- **LYSS-eq**: Is de uitvoer een aanvaardbare variant van de referentievertaling? (gecontroleerd door de equivalentieklassen van de linter)
- **LYSS-sem**: Behoudt de uitvoer de betekenis van de bron? (gecontroleerd door de semantische validator)

Deze metrieken produceren getallen. **We weten niet of die getallen iets betekenen.** De FST kan geldige woorden afwijzen die hij niet herkent (leenwoorden, neologismen, eigennamen). De linter kan geldige equivalenties missen of ongeldige accepteren. De semantische validator kan betekenis verkeerd beoordelen. Totdat tweetalige sprekers ons vertellen of onze geautomatiseerde scores overeenkomen met hun menselijk oordeel over vertaalkwaliteit, tasten we in het duister.

Elke grote MT-evaluatiemetriek (BLEU, COMET, chrF++) werd gevalideerd door geautomatiseerde scores te vergelijken met duizenden menselijke kwaliteitsbeoordelingen. We hebben hetzelfde nodig — op kleinere schaal, omdat onze middelen beperkt zijn, maar met dezelfde nauwkeurigheid.

---

## 2. Wat We Nodig Hebben: Drie Taken

### Taak A: Beoordeling van Vertaalkwaliteit (Primair — ~8 uur totaal)

**Wat:** Beoordeel 200 machinaal gegenereerde vertalingen van het Engels naar het Cree op twee schalen.

**Wie:** 3+ tweetalige Plains Cree–Engelse sprekers met leesvaardigheid in SRO (Standard Roman Orthography).

**Hoe het werkt:**

1. We verstrekken een spreadsheet of webformulier met 200 rijen. Elke rij bevat:
   - De Engelse bronzin
   - Een machinaal gegenereerde Cree-vertaling
   - (Optioneel) een referentie-Cree-vertaling ter vergelijking

2. Voor elke vertaling beoordeelt de spreker twee aspecten:

   **Adequaatheid** (zegt het de juiste dingen?):
   | Score | Label | Betekenis |
   |-------|-------|---------|
   | 1 | Geen | De vertaling heeft niets te maken met de bron |
   | 2 | Weinig | Enkele woorden komen overeen, maar de algehele betekenis is onjuist |
   | 3 | Veel | De kernbetekenis is aanwezig, maar belangrijke onderdelen ontbreken of zijn onjuist |
   | 4 | Meeste | Bijna alles is correct, kleine betekenishiaten |
   | 5 | Alles | De vertaling brengt de betekenis van de bron volledig over |

   **Vloeiendheid** (klinkt het als echt Cree?):
   | Score | Label | Betekenis |
   |-------|-------|---------|
   | 1 | Onbegrijpelijk | Dit is geen Cree |
   | 2 | Niet-vloeiend | Afzonderlijke woorden kunnen Cree zijn, maar de zin is gebroken |
   | 3 | Niet-moedertaals | Begrijpelijk, maar duidelijk niet zoals een Cree-spreker het zou zeggen |
   | 4 | Goed | Natuurlijk klinkend met kleine onhandigheid |
   | 5 | Vlekkeloos | Een Cree-spreker had dit kunnen schrijven |

3. Optioneel kan de spreker een vrije-tekst-opmerking toevoegen ter toelichting van zijn of haar beoordeling (bijv. "onjuiste animate/inanimate-congruentie op het werkwoord," "dit is th-dialect, maar ik beoordeel op basis van y-dialect").

**Tijdschatting:** ~2,5 minuten per vertaling × 200 vertalingen = ~8 uur. Kan worden verdeeld over meerdere sessies (bijv. 4 × 2-uurssessies over 2 weken).

**Vergoeding:** $50–65 CAD/uur (overeenkomstig de sprekervergoedingstarieven in BENCHMARK_SPEC §10.3). Totaal per spreker: $400–520 CAD. Voor 3 sprekers: **$1.200–1.560 CAD**.

**Wat we ermee doen:** We berekenen de correlatie tussen onze geautomatiseerde LYSS-scores en de sprekerbeoordelingen. Als LYSS-fst correleert met vloeiendheidsbeoordelingen en LYSS-sem correleert met adequaatheidsbeoordelingen, zijn de metrieken gevalideerd. Zo niet, dan weten we waar we ze moeten verbeteren.

---

### Taak B: Linter-equivalentievalidatie (~2 uur)

**Wat:** Beoordeel 50 paren van Cree-vertalingen die onze linter als "equivalent" classificeert en geef aan of ze werkelijk hetzelfde betekenen.

**Wie:** 1–2 tweetalige sprekers (kunnen dezelfde sprekers zijn als bij Taak A).

**Hoe het werkt:**

1. We verstrekken 50 paren. Elk paar bevat:
   - De Engelse bron
   - Vertaling A (de referentie)
   - Vertaling B (een variant die onze linter als equivalent beschouwt)
   - De equivalentiereden (bijv. "woordvolgordepermutatie," "orthografische variant," "optioneel partikel verwijderd")

2. Voor elk paar beantwoordt de spreker:
   - **Zelfde betekenis?** Ja / Nee / Afhankelijk van de context
   - **Beide natuurlijk?** Ja / A is beter / B is beter / Geen van beide is natuurlijk
   - **Opmerkingen** (optionele vrije tekst)

**Tijdschatting:** ~2 minuten per paar × 50 paren = ~2 uur.

**Vergoeding:** $50–65 CAD/uur × 2 uur = **$100–130 CAD per spreker**.

**Wat we ermee doen:** We berekenen de precisie van elke equivalentieklasse. Als sprekers zeggen dat 90% van de "woordvolgorde"-equivalenties werkelijk equivalent zijn, is die klasse gevalideerd. Als ze zeggen dat 40% van de "lemma-synoniem"-equivalenties onjuist is, weten we dat we die klasse moeten corrigeren of verwijderen.

---

### Taak C: FST-beoordeling van ten onrechte afgewezen woorden (~1,5 uur)

**Wat:** Beoordeel 100 Cree-woorden die de FST-analyzer afwijst (als niet-geldige Cree-woorden beschouwt) en geef aan of ze werkelijk geldig zijn.

**Wie:** 1 tweetalige spreker met uitgebreide kennis van het Cree-vocabulaire.

**Hoe het werkt:**

1. We voeren de FST-analyzer uit op ons EdTeKLA dev-corpus van 436 items (`textbook_dev.json`) en verzamelen elk woord dat deze afwijst.
2. We presenteren maximaal 100 afgewezen woorden aan de spreker, inclusief de context van de zin.
3. Voor elk woord beantwoordt de spreker:
   - **Is dit een geldig Cree-woord?** Ja / Nee / Onzeker
   - **Zo ja, welk type?** Gevestigd woord / Leenwoord / Naam / Dialectvorm / Neologisme / Anders
   - **Opmerkingen** (optioneel)

**Tijdschatting:** ~1 minuut per woord × 100 woorden = ~1,5 uur.

**Vergoeding:** $50–65 CAD/uur × 1,5 uur = **$75–100 CAD**.

**Wat we ermee doen:** We berekenen de fout-afwijzingspercentage van de FST. Als de FST 50 woorden afwijst en sprekers zeggen dat 30 ervan geldig zijn, bedraagt het fout-afwijzingspercentage 60% — onaanvaardbaar hoog, waarvoor een allowlist voor leenwoorden/uitzonderingen vereist is. Als sprekers zeggen dat slechts 5 geldig zijn, bedraagt het fout-afwijzingspercentage 10% — de metriek is betrouwbaar.

---

## 3. Totale Sprekersinzet

| Taak | Benodigde sprekers | Uren per spreker | Kosten per spreker | Totale kosten |
|------|----------------|-------------------|-----------------|------------|
| A: Kwaliteitsbeoordeling | 3 | ~8 uur | $400–520 | $1.200–1.560 |
| B: Lintervalidatie | 2 | ~2 uur | $100–130 | $200–260 |
| C: FST-beoordeling | 1 | ~1,5 uur | $75–100 | $75–100 |
| **Totaal** | **3 sprekers** | **~11,5 uur (max. per spreker)** | **$575–750 (max.)** | **$1.475–1.920** |

Als dezelfde 3 sprekers alle taken uitvoeren: **~11,5 uur elk over 2–4 weken, $575–750 elk**.

Een enkele spreker die alleen Taak A uitvoert, verbindt zich voor **~8 uur over 2 weken voor $400–520**.

---

## 4. Kwalificaties voor Sprekers

**Vereist:**
- Tweetalig in Plains Cree en Engels
- Leesvaardigheid in SRO (Standard Roman Orthography)
- Comfortabel met het beoordelen van vertalingen op een gestructureerde schaal

**Gewenst:**
- Ervaring met het y-dialect (het dialect dat wordt gebruikt in ons referentiecorpus van EDTeKLA)
- Onderwijs- of vertaalervaring (biedt gekalibreerd kwaliteitsoordeel)
- Bekendheid met verschillende registers (formeel, educatief, conversationeel)

**Niet vereist:**
- Technische kennis of NLP-kennis (we verstrekken alle hulpmiddelen en context)
- Computationele vaardigheden (de beoordelingsinterface is een eenvoudige spreadsheet of webformulier)
- Eerdere betrokkenheid bij het Champollion-project

---

## 5. Gegevensbeheer {#5-data-governance}

Alle bijdragen van sprekers vallen onder het soevereiniteits-aspirant databeleid van het project:

- **Eigendom:** De kwaliteitsbeoordelingen van sprekers blijven hun intellectuele bijdrage. Ze worden bij naam vermeld (of anoniem, naar hun keuze) in elke publicatie.
- **Controle:** Sprekers kunnen hun beoordelingen op elk moment intrekken. Intrekking verwijdert hun gegevens uit alle analyses.
- **Toegang:** Beoordelingsgegevens worden opgeslagen op infrastructuur die wordt beheerd door de gemeenschapsbestuursorganisatie (wanneer opgericht) of op het voorkeursplatform van de spreker.
- **Bezit:** Ruwe beoordelingsgegevens worden nooit gepubliceerd. Alleen geaggregeerde statistieken (correlaties, inter-annotatorovereenstemming) verschijnen in publicaties.
- **Vergoeding:** Sprekers worden betaald voor hun tijd, ongeacht of we hun beoordelingen gebruiken. Betaling is niet afhankelijk van de resultaten.

---

## 6. Wat Sprekers Ontvangen {#6-what-speakers-get}

Naast de vergoeding:

- **Mede-auteurschap** bij elke publicatie die gebruikmaakt van hun beoordelingen (indien gewenst)
- **Erkenning** in alle projectdocumentatie
- **Vroege toegang** tot de evaluatietools en -resultaten
- **Inbreng** over hoe de metrieken worden gebruikt — als een spreker zegt "uw linter heeft het mis over X," passen we de linter aan
- **Vetorecht** over publicatie van resultaten die zij problematisch achten

---

## 7. Hoe te Beginnen {#7-how-to-get-started}

Als u een tweetalige Cree–Engelse spreker bent die geïnteresseerd is in deelname, of als u iemand kent die dat zou kunnen zijn:

1. **Neem contact met ons op** via [project e-mail/contact] — geen verplichting vereist, slechts een gesprek
2. **We leggen de taken uit** in begrijpelijke taal (geen jargon)
3. **U kiest welke taken** u interesseren (A, B, C of een combinatie)
4. **We stellen een schema op** dat voor u werkt (blokken van 2 uur, flexibele tijden)
5. **U beoordeelt vertalingen** via spreadsheet of webformulier — van overal, op uw eigen tijd
6. **We betalen snel** — binnen 2 weken na het voltooien van elk taakblok

---

## 8. Wat Er Daarna Gebeurt

Met sprekervalidatiegegevens kunnen we:

1. **De metriekcorrelaties publiceren** — bewijs leveren (of weerleggen) dat LYSS-scores het menselijk oordeel weerspiegelen
2. **De metrieken herijken** — gewichten, drempelwaarden en equivalentieklassen aanpassen op basis van feedback van sprekers
3. **De linter verbeteren** — valse equivalenties verwijderen, ontbrekende toevoegen
4. **De FST-allowlist verbeteren** — geldige woorden toevoegen die de FST ten onrechte afwijst
5. **Indienen bij een academisch tijdschrift** — met sprekers als mede-auteurs, waarmee LYSS wordt gevestigd als een gevalideerde metriek voor MT-evaluatie van polysynthetische talen

Zonder sprekervalidatie blijft LYSS een technisch hulpmiddel. Met validatie wordt LYSS een wetenschappelijk gefundeerde evaluatiemetriek. Dat is het verschil tussen "we hebben iets gebouwd" en "we hebben bewezen dat het werkt."

---


## Waar dit toe leidt op deze site

Sprekervalidatie is één fase van een grotere pijplijn: de
[Corpuspartnerschap](/docs/network/specifications/corpus-partnership)
workflow is waar deze taken in de opbouw van een evaluatiecorpus passen, en
[Hoe sprekers worden betaald](/docs/network/perspectives/how-speakers-get-paid)
is de in begrijpelijke taal geschreven versie van de bovenstaande tarieven en voorwaarden.
