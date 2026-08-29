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
| **Bron-echo** | Model retourneerde de originele Engelse invoer | `[GATE] source-echo` |
| **Hallucinatie-lus** | Herhaalde trigrampatronen (bijv. `"Qo' Qo' Qo'"`) | `[GATE] hallucination` |
| **Lengte-inflatie** | Uitvoer is aanzienlijk langer dan de bron | `[GATE] length` |
| **Inhoudsverwijdering** | Uitvoer is de bron waarvan de letters zijn verwijderd | `[GATE] content` |
| **Schriftnaleving** | Verkeerd schrift voor de doellocale | `[GATE] script` |
| **ICU-meervoudscategorieën** | Ontbrekende vereiste meervoudsvormen voor de locale | `[GATE] icu-plural` |

Sleutels die als [`noTranslate`](/docs/getting-started/configuration#no-translate) zijn gedeclareerd, bereiken de gate nooit — ze worden letterlijk uit de bron gekopieerd, dus er is niets om te valideren.

### Leeg/Blanco

Verwerpt vertalingen die lege strings zijn, uitsluitend uit witruimte bestaan, of `null`. Dit onderschept modellen die niets retourneren voor moeilijke sleutels.

### Bronherhaling

Detecteert wanneer het model de Engelse brontekst retourneert in plaats van deze te vertalen. Komt vaak voor bij korte strings en onvoldoende gespecificeerde prompts.

Korte, voornamelijk ASCII-strings (≤ 30 tekens) zijn vrijgesteld — `"Blog"`, `"GitHub"`, `"npm"` blijven overal legitiem in het Engels, en het afwijzen ervan zou een oneindige lus veroorzaken.

Langere waarden die ongewijzigd ook correct zijn — URL's, repository-paden, product-identifiers — vormen geen probleem voor de gate en kunnen niet worden opgelost door de gate af te stemmen: het juiste antwoord *is* de echo, dus elke mogelijke modeluitvoer is onjuist. Declareer die sleutels met [`noTranslate`](/docs/getting-started/configuration#no-translate) en ze omzeilen de pijplijn volledig. Sleutels met een URL-waarde worden standaard op die manier afgehandeld.

### Hallucinatieherhaling

Analyseert trigrampatronen (3 tekens) in de uitvoer. Als een trigram meer dan een drempelaantal keren herhaalt ten opzichte van de uitvoerlengte, wordt de vertaling verworpen. Dit onderschept degeneratieve uitvoer zoals `"Qo' Qo' Qo' Qo' Qo'"`.

### Lengte-inflatie

Verwerpt vertalingen waarbij de uitvoerlengte `maxLengthRatio × source length` overschrijdt (standaard: 4×). Dit onderschept modelhallucinaties die een muur van tekst produceren voor een korte invoer.

Configureerbaar via `maxLengthRatio` in uw configuratie.

### Inhoudsverwijdering

Het spiegelbeeld van lengte-inflatie. Een model zonder vocabulaire voor een string kan elke letter verwijderen die het niet kan vertalen en de interpunctie en spatiëring van de bron laten staan:

```
"low-resource nmt · tokenizers · nêhiyawêwin"  →  "   ·   · êhiêi"
"the simple-builder approach"                  →  "  "
```

Niets anders detecteert dit. Het is niet leeg, geen echo, niet repetitief, en met 33% van de *bronlengte* passeert het `minLengthRatio` moeiteloos.

De controle vergelijkt **inhoudstekens** — letters en cijfers, waarbij interpunctie, witruimte en onzichtbare opmaak worden genegeerd — tussen bron en uitvoer. Maar dichtheid alleen kan niet de regel zijn, omdat legitieme dichte schriften zich op precies dezelfde plek bevinden:

| Bron | Uitvoer | Behouden inhoud | Oordeel |
|--------|--------|------------------|---------|
| `low-resource nmt · tokenizers · nêhiyawêwin` | `   ·   · êhiêi` | 14% | **afgewezen** |
| `Getting started` | `入门` | 14% | geaccepteerd |
| `Frequently asked questions` | `常见问题` | 17% | geaccepteerd |

Elke drempelwaarde die de eerste detecteert, wijst Chinees, Japans en Koreaans direct af. Wat hen onderscheidt is niet hoeveel er is overgebleven, maar *waar het vandaan kwam*: de uitgeholde uitvoer is een **subsequentie** van zijn eigen bron — te produceren door er tekens uit te verwijderen — terwijl een echte vertaling in wezen niets deelt met de bron. Een markering vereist **beide** signalen, dus de controle is noodzakelijk-maar-niet-voldoende op dezelfde manier als de herhalingsdetector dat is.

Configureerbaar via `minContentRetention` (standaard `0.35`), per paar of per taal. Het verhogen ervan maakt de controle gretiger; deze wordt alleen geactiveerd in combinatie met het subsequentiesignaal.

:::note[Dit is een vocabulaire-signaal, geen kwaliteitsknop]
Wanneer dit herhaaldelijk wordt geactiveerd voor één doeltaal, heeft het model geen woorden voor die tekst — meestal korte, met jargon gevulde strings in een taal met een gesloten lexicon. Het versoepelen van de drempelwaarde herstelt de stille corruptie; het levert geen vertaling op. Corrigeer de prompt, de coachinggegevens of het paar.
:::

### Schriftconformiteit

Voor locales waarvan de taalkaart een niet-Latijns schrift registreert (Arabisch, CJK, Cyrillisch, …), wordt gevalideerd of de uitvoer daadwerkelijk niet-ASCII-tekens bevat — uitvoer die uitsluitend uit Latijnse tekens bestaat, wordt voor die locales afgewezen als verkeerd schrift.

Twee verduidelijkingen over wat deze controle *niet* is:

- Het wordt **niet aangestuurd door het configuratieveld `script:`.** Dat veld selecteert de uitvoer-orthografie voor [schriftconversie](/docs/getting-started/configuration#script-conversion); de verwachting van de gate is afkomstig van de taalkaarten.
- Het valideert altijd het **werkschrift dat het model genereert**, *voorafgaand* aan enige schriftconversie. Locales met een schriftconverter (crk, sr, tlh, …) produceren correct Latijnse werkschrift-uitvoer, dus zij zijn vrijgesteld van deze controle; conversie — indien ingeschakeld in de configuratie — vindt plaats na de gate.

## Wat er bij een fout gebeurt

1. De mislukte vertaling wordt naar stderr gelogd met een `[GATE]`-prefix, de sleutelnaam, de reden en een voorvertoning van de waarde
2. De sleutel wordt **niet** naar het localebestand geschreven
3. De herprobeercascade wordt geactiveerd (zie hieronder)

```
[GATE] hero.title: source-echo — "Welcome to our platform"
[GATE] nav.about: hallucination — "À À À À À À À À"
```

## Feedback-retry en de Retry-cascade

Een sleutel die door de gate wordt afgewezen, krijgt **één feedback-retry**: de reden van afwijzing wordt in de prompt geïnjecteerd als context per sleutel (een blinde retry op lage temperatuur zou byte-identieke uitvoer retourneren). Als de retry slaagt, wordt de sleutel weggeschreven en is de synchronisatie **groen** — een gate-afwijzing die zichzelf herstelt is geen fout, en dit is de beoogde semantiek. Alleen sleutels die na de retry nog steeds falen, worden overgeslagen, gerapporteerd (de synchronisatie eindigt met een non-zero status) en opnieuw geprobeerd bij de volgende synchronisatie.

De retry verloopt via de eigen vertaalmethode van het paar, wat deze ook is — LLM, Google Translate, DeepL of een directe provider. Dit is ook van toepassing op Translation Memory-hits: een in de cache opgeslagen waarde die door de gate wordt afgewezen, wordt verwijderd en in dezelfde run opnieuw vertaald, zodat een vergiftigde cache zichzelf herstelt.

Afzonderlijk daarvan, wanneer een hele batch faalt (JSON-parsefout), probeert champollion het opnieuw met steeds kleinere batches:

```
Full batch (80 keys) → parse error
  └→ Half batch (40 keys) → 2 failures
      └→ Individual keys (1 each) → isolates the 2 problem keys
```

Het herprobeerbudget wordt begrensd door `maxRetries` (standaard: 3, per taal configureerbaar). Dit voorkomt ongecontroleerde tokenuitgaven voor sleutels die consequent mislukken.

Na het uitputten van de herprobeerpogingen worden de probleemsleutels gelogd en overgeslagen. Ze worden opnieuw geprobeerd bij de volgende `sync`-uitvoering.

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
