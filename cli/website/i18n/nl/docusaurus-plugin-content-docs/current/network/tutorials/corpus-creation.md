---
sidebar_position: 11
title: "Kookboek: Corpuscreatie"
---

# Handleiding voor Corpuscreatie

> **Het idee:** Voordat u een vertaalmethode kunt evalueren, hebt u een evaluatiecorpus nodig. Deze handleiding beschrijft hoe u er een van de grond af opbouwt — gegevensbronnen, formaatvereisten, kwaliteitsnormen, licenties en bijdragen aan het Netwerk.

:::info[Dit is geen vertaalmethode]
Deze handleiding is de vereiste voor veel methoden. Een goed evaluatiecorpus is de basis die alles mogelijk maakt. Zelfs 50 zorgvuldig samengestelde paren zijn voldoende om een nieuw leaderboard-onderdeel te openen.
:::

## Wanneer gebruikt u dit

- U wilt een **nieuw taalpaar** toevoegen aan het leaderboard van het Netwerk
- U bent een **taalleraar** die studentvertalingen wil benchmarken
- U bent een **gemeenschapstaalwerker** met toegang tot tweetalig materiaal
- U bent een **onderzoeker** die een gestandaardiseerde evaluatieset nodig heeft voor uw taalpaar

## Corpusformaat

Het harnas gebruikt eenvoudige JSON:

```json title="my-corpus.json"
{
  "metadata": {
    "name": "Quechua Dev v1",
    "version": "1.0.0",
    "source_language": "eng",
    "target_language": "que",
    "entry_count": 75,
    "license": "CC-BY-SA-4.0",
    "author": "Your Name / Organization",
    "description": "75 English-Quechua pairs from educational materials"
  },
  "entries": [
    {
      "id": 1,
      "source": "Hello, how are you?",
      "reference": "Allillanchu, imaynallan kashanki?"
    },
    {
      "id": 2,
      "source": "The sun is shining today",
      "reference": "Kunan p'unchay inti k'anchashan"
    }
  ]
}
```

## Waar Gegevens Te Vinden

| Bron | Kwaliteit | Volume | Licentie |
|------|-----------|--------|----------|
| **Leerboeken / educatief materiaal** | Hoog (door experts beoordeeld) | Laag-gemiddeld | Controleer bij uitgever |
| **Overheidsdocumenten** | Gemiddeld (formeel register) | Gemiddeld-hoog | Vaak publiek domein |
| **Tweetalige woordenboeken** | Hoog (geverifieerde vermeldingen) | Gemiddeld | Varieert |
| **Gemeenschapsoudsten / sprekers** | Hoogst (moedertaalintuïtie) | Laag (beperkte tijd) | Beheerd door gemeenschap |
| **Religieuze teksten** | Gemiddeld (domeinspecifiek) | Hoog | Meestal open |
| **Bestaande corpora** (Hansard, FLORES) | Gemiddeld-hoog | Hoog | Controleer licentie |
| **Handgemaakt** | Hoogst | Laag | U bezit het |

## Kwaliteitsnormen

Een goed evaluatiecorpus bevat:

1. **Gevarieerde inhoud** — niet alleen begroetingen of eenvoudige zinnen. Voeg vragen, opdrachten, complexe zinnen en domeinspecifieke termen toe
2. **Geverifieerde vertalingen** — beoordeeld door ten minste één vloeiende spreker, bij voorkeur twee
3. **Consistente orthografie** — één schrift, één spellingconventie door het gehele corpus
4. **Onafhankelijke bronnen** — niet afgeleid van dezelfde tekst waarop methoden getraind worden
5. **Duidelijke licentie** — een expliciete licentie die evaluatiegebruik toestaat

:::danger[Corpusbesmetting]
Het evaluatiecorpus moet **onafhankelijk** zijn van alle trainingsdata. Als een methode getraind of geprompt is met data uit het evaluatiecorpus, wordt deze gediskwalificeerd. Ontwerp uw corpus van meet af aan als held-out data.
:::

## Richtlijnen voor Omvang

| Omvang | Wat Het Mogelijk Maakt |
|--------|----------------------|
| **50 vermeldingen** | Minimaal levensvatbare evaluatie — voldoende om grove kwaliteitsverschillen te detecteren |
| **100–200 vermeldingen** | Betrouwbare rangschikking — voldoende voor statistische significantie tussen methoden |
| **500+ vermeldingen** | Onderzoekskwaliteit — robuuste samengestelde scores, betrouwbaarheidsintervallen |
| **1.000+ vermeldingen** | Gouden standaard — equivalent aan FLORES devtest-dekking |

Begin klein. 50 vermeldingen zijn voldoende om een leaderboard-track te openen. U kunt later uitbreiden.

## Bijdragen aan het Netwerk

1. **Maak uw corpus** in het bovenstaande JSON-formaat
2. **Licentieer het** — CC BY-SA 4.0 wordt aanbevolen voor open evaluatie; CC BY-NC-SA 4.0 voor beperkt gebruik
3. **Host het op een stabiele bron** (uw eigen repository, een institutioneel archief of een dataregister) — Champollion host of beheert corpusinhoud nooit
4. **Dien een fetch-from-source-metadatakaart in** — open een PR tegen de [publieke repository](https://github.com/gamedaysuits/Champollion) en voeg een registervermelding toe die de harness naar uw upstream-bron verwijst (loader/URL, SHA-pin, licentie, herkomst); zie [Datasets](/docs/network/leaderboard/datasets#creating-a-new-dataset) voor het kaartformaat
5. **Het leaderboard opent** voor uw taalpaar zodra de kaart is samengevoegd

## Voor Inheemse Taalgemeenschappen

Corpuscreatie is een daad van **taalsoevereiniteit**. Uw corpus, uw voorwaarden:

- U bepaalt de licentie en toegangsvoorwaarden
- U kunt een **publieke ontwikkelingsset** bijdragen (voor methode-ontwikkeling) terwijl u een **geheime testset** (voor officiële evaluatie) onder gemeenschapscontrole houdt
- Het [soevereiniteitskader](/docs/network/sovereignty/data-sovereignty) beschermt uw gegevens op elk niveau

Zelfs een klein corpus is een **strategisch bezit** — het is de benchmark die bepaalt wat "goed genoeg" betekent voor uw taal.

## Combineert goed met

- **[Gedeeltelijke Vertaling](./partial-translation)** — een corpus aanmaken IS de menselijke vertaalstap
- **[Terugvertaling](./back-translation)** — synthetische gegevens vullen door mensen gemaakte corpora aan
- Elk ander kookboek — ze hebben allemaal een evaluatiecorpus nodig

## Zie ook

- [Evaluatiedatasets](/docs/network/leaderboard/datasets) — bestaande corpora (EDTeKLA, FLORES+)
- [Gegevenssoevereiniteit](/docs/network/sovereignty/data-sovereignty) — eigendom en controle
- [Voor Taalgemeenschappen](/docs/network/community/for-language-communities) — betrokkenheid van de gemeenschap
- [Ondersteuning van een Taal met Weinig Middelen](/docs/network/community/low-resource-languages) — het grote geheel
