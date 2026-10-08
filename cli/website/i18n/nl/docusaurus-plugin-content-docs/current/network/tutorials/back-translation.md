---
sidebar_position: 8
title: "Kookboek: Back-Translation Augmentation"
---

# Terugvertaling-augmentatie

> **Het idee:** Genereer synthetische parallelle data door bestaande doeltaaltekst terug te vertalen naar de brontaal, en gebruik deze synthetische paren vervolgens om een voorwaarts model te trainen of te prompten. Dit breidt uw parallelle corpus goedkoop uit — maar met kanttekeningen over kwaliteit.

:::info[Dit is een kookboek, geen kant-en-klare implementatie]
Deze handleiding schetst de strategie en de kritieke valkuilen ervan. Terugvertaling is krachtig, maar kan fouten versterken als het niet zorgvuldig wordt uitgevoerd.
:::

## Wanneer gebruikt u dit

- U beschikt over **eentalige doeltaaltekst** maar beperkte parallelle data
- U wilt een **trainingskorpus uitbreiden** voor [fine-tuning](./fine-tuned-model) zonder handmatige vertaling
- U heeft **meer few-shot-voorbeelden** nodig maar kunt niet snel genoeg menselijke vertalingen verkrijgen
- U bereid bent de synthetische data **agressief te kwaliteitsfilteren**

## Hoe het werkt

```
[Target-language text]          "awâsisak mêtawêwak"
        │
        ▼
[Back-translate to source]      "The children are playing"  (via LLM or MT API)
        │
        ▼
[Create synthetic pair]         ("The children are playing", "awâsisak mêtawêwak")
        │
        ▼
[Quality filter]                Keep only high-confidence pairs
        │
        ▼
[Use for training/prompting]    Expand your parallel corpus
```

1. **Verzamel eentalige tekst** — doeltaalboeken, artikelen, transcripten, sociale media
2. **Terugvertalen** — gebruik een LLM of MT API om elke zin naar de brontaal te vertalen
3. **Kwaliteitsfiltering** — vertaal heen en terug (vertaal opnieuw terug) en vergelijk; bewaar paren waarbij de retourvertaling ≈ het origineel is
4. **Gebruik het synthetische corpus** — voor fine-tuning, few-shot-voorbeelden of coachingdata

## Kwaliteitsfiltering: de retourvertalingstest

```python
# Pseudo-code for round-trip quality filtering
for target_text in monolingual_corpus:
    # Back-translate: target → source
    synthetic_source = translate(target_text, "crk", "en")
    
    # Forward-translate: source → target
    round_trip = translate(synthetic_source, "en", "crk")
    
    # Compare round-trip to original
    chrf_score = compute_chrf(target_text, round_trip)
    
    if chrf_score > 0.70:  # High similarity = high-quality pair
        parallel_corpus.append((synthetic_source, target_text))
```

## Kritieke valkuil: foutversterking

:::warning[Terugvertaling versterkt bestaande modelvooroordelen]
Als uw terugvertaalmodel consequent dezelfde fouten maakt, zal uw synthetisch corpus die fouten als "correct" vastleggen. Dit creëert een feedbacklus: trainen op slechte data → slechtere vertalingen produceren → slechtere synthetische data genereren. **Filter synthetische data altijd streng op kwaliteit** en combineer synthetische data met geverifieerde menselijke vertalingen.
:::

## Waar u eentalige tekst kunt vinden

- Gemeenschapsnieuwsbrieven, kranten en publicaties
- Overheidsdocumenten in de doeltaal (bijv. Nunavut Hansard voor Inuktitut)
- Educatief materiaal en leerboeken
- Religieuze teksten (voor veel talen ruim beschikbaar)
- Sociale media (met passende toestemmingen en kwaliteitsfiltering)
- Getranscribeerde audio/video van taalprogramma's

## Voor- en nadelen

| | |
|---|---|
| ✅ Breidt trainingsdata goedkoop uit | ❌ Versterkt modelfouten indien niet gefilterd |
| ✅ Maakt gebruik van overvloedige eentalige tekst | ❌ Kwaliteitsplafond beperkt door het terugvertaalmodel |
| ✅ Eenvoudig op grote schaal te genereren | ❌ Retourvertalingsfiltering is rekenintensief |
| ✅ Complementeert andere benaderingen | ❌ Synthetische data is nooit zo goed als menselijke vertaling |

## Combineert goed met

- **[Fine-Tuned Model](./fine-tuned-model)** — terugvertaling creëert trainingsdata voor fine-tuning
- **[Corpuscreatie](./corpus-creation)** — synthetische data vult door mensen gecreëerde corpora aan
- **[Coached LLM Prompting](./coached-llm-prompting)** — synthetische voorbeelden kunnen coachingwoordenboeken informeren

## Zie ook

- [Evaluatiedatasets](/docs/network/leaderboard/datasets) — synthetische data mag niet overlappen met evaluatiedata
- [Leaderboard-regels](/docs/network/leaderboard/rules) — beleid inzake contaminatie
- [Ondersteuning van een taal met weinig middelen](/docs/network/community/low-resource-languages)
