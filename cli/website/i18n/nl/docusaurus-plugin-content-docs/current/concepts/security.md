---
sidebar_position: 4
title: "Beveiliging"
---

# Beveiliging & Veiligheid

Champollion is ontworpen om veilig te werken in vijandige omgevingen — waar localegegevens afkomstig kunnen zijn van niet-vertrouwde bronnen, waar geconstrueerde bestandsnamen directorygrenzen kunnen overschrijden, en waar LLM-uitvoer van alles kan bevatten.

## Bedreigingsmodel

| Bedreiging | Aanvalsvector | Maatregel |
|--------|--------------|-----------|
| **Prototype-vervuiling** | Geconstrueerde JSON-sleutels (`__proto__`, `constructor`) | Afgewezen tijdens het parsen |
| **Padtraversaal** | Localecodes zoals `../../etc/passwd` | Bestandsschrijfbewerkingen gevalideerd tegen geconfigureerde mappen |
| **Corruptie van codeblokken** | LLM vertaalt binnen code-omheiningen | Unicode-schildwachtbeveiliging |
| **Gehallusineerde sleutels** | LLM retourneert sleutels die niet zijn verzonden | Responsvalidatie — alleen geaccepteerde sleutels worden geschreven |
| **Ongecontroleerde tokenuitgaven** | Oneindige herhaallussen | Budget begrensd via `maxRetries` |

## Beveiliging tegen Prototype-vervuiling

Alle localesleutels worden gevalideerd aan de hand van een blokkeringslijst vóór verwerking:

- `__proto__`
- `constructor`
- `prototype`

Elke sleutel die overeenkomt met deze patronen wordt afgewezen met een foutmelding. Dit voorkomt dat aanvallers geconstrueerde localebestanden gebruiken om JavaScript-objectprototypes te wijzigen.

## Padbeperking

Bij het schrijven van localebestanden valideert champollion dat het uitvoerpad binnen de geconfigureerde mappen blijft (`localesDir`, `contentDir`). Localecodes worden gesaneerd — een code zoals `../../secrets` kan niet buiten de verwachte map schrijven.

## Blokbeveiliging

Tijdens de vertaling van Markdown-inhoud worden gestructureerde elementen vervangen door Unicode-schildwachtplaceholders voordat de tekst naar de LLM wordt verzonden:

1. **Codeblokken** (omheind en inline) → schildwacht
2. **Hugo-shortcodes** (`{{< >}}`, `{{% %}}`) → schildwacht
3. **Ruwe HTML** → schildwacht
4. **Interpolatievariabelen** (`{{ .Count }}`) → schildwacht

Na de vertaling worden schildwachten vervangen door de oorspronkelijke inhoud. De LLM ziet nooit codeblokken, shortcodes of HTML — deze kunnen daardoor niet worden beschadigd.

## Responsvalidatie

Wanneer de LLM een JSON-respons retourneert, valideert champollion dat:
- Alleen sleutels die in de batch zijn verzonden, in de respons voorkomen
- Er geen extra sleutels worden geïnjecteerd
- De respons als geldige JSON kan worden geparseerd

Gehallusineerde sleutels worden stilzwijgend verwijderd. Dit voorkomt dat LLM-uitvoer onverwachte vertalingen in uw localebestanden injecteert.

## Kwaliteitspoort

Elke vertaling wordt gevalideerd via vijf deterministische controles voordat deze naar schijf wordt geschreven. Zie [Kwaliteitspoort](/docs/concepts/quality-gate) voor meer informatie.

## Exponentiële Terugval

API-aanroepen maken gebruik van exponentiële terugval met jitter bij 429- (snelheidslimiet) en 5xx- (serverfout) responsen. Drie herhaalpogingen met toenemende vertraging voorkomen overbelasting van de API tijdens storingen.

## Aanvraagtime-out

Elke API-aanvraag heeft een time-out van 30 seconden via `AbortController`. Dit voorkomt dat het synchronisatieproces onbepaald blijft hangen bij een verbroken verbinding.

## Duidelijke Foutmeldingen bij Vertaalfouten

Wanneer de API niet beschikbaar is of een vertaling mislukt, genereert champollion een duidelijke foutmelding met uitvoerbare richtlijnen in plaats van stilzwijgend onbruikbare inhoud te schrijven. Er worden nooit placeholders met het voorvoegsel `[EN]` geschreven tijdens synchronisatie.

```
[ERR] Content sync for fr: no API key available.
  Set OPENROUTER_API_KEY in .env.local to translate content.
```

Het mislukken van één bestand stopt de volledige synchronisatie niet — de fout wordt geregistreerd en de pipeline gaat verder met het volgende bestand, zodat u maximale voortgang per uitvoering behaalt.

## Verificatie na Synchronisatie

Nadat alle vertalingen zijn voltooid, leest champollion de geschreven localebestanden opnieuw van schijf en voert een verificatiecontrole uit. Dit detecteert het verschil tussen een geslaagde synchronisatierapportage en vertalingen die in werkelijkheid onjuist zijn:

- **Sleutelpariteit** — alle bronsleutels aanwezig in elk doel
- **`[EN]`-markeringen** — verouderde terugvalmarkeringen van eerdere uitvoeringen
- **Lege vertalingen** — blanco waarden die er doorheen zijn geglipt
- **Scriptnaleving** — niet-Latijnse locales met uitsluitend ASCII-vertalingen
- **Behoud van placeholders** — ICU-placeholders komen overeen met de bron

Overslaan met `--no-verify` of afzonderlijk uitvoeren met `npx champollion verify`.

## Testen

Beveiligingseigenschappen worden geverifieerd door de adversariale testsuite:

```bash
npm run test:redteam    # prototype pollution, path traversal, encoding attacks
```

---

## Zie Ook

- [Architectuur](/docs/concepts/architecture) — hoe het driedelig ecosysteem verbonden is
- [CLI-referentie — integrity](/docs/reference/cli#integrity) — opdracht voor integriteitscontrole
- [CLI-referentie — provenance](/docs/reference/cli#provenance) — opdracht voor herkomstaudit
- [Pluginspecificatie](/docs/reference/plugin-spec) — herkomstvelden in pluginmanifesten
- [Kwaliteitspoort](/docs/concepts/quality-gate) — veiligheidscontroles op vertaalniveau
