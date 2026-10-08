---
sidebar_position: 3
title: "Conlangs, Scripts & Orthografie"
---

# Conlangs, Scripts & Orthografie

champollion biedt eersteklas ondersteuning voor geconstrueerde talen via LLM-registers en deterministische scriptconverters. Deze handleiding beschrijft hoe conlang-ondersteuning werkt, welke lettertypen u nodig heeft en hoe u uw eigen ondersteuning kunt toevoegen.

:::tip[Waarom kunsttalen van belang zijn]
Kunsttalen zijn niet louter een curiositeit — ze maken gebruik van exact dezelfde infrastructuur als echte, ondervertegenwoordigde talen. De kwaliteitscontrole, het coachingsysteem en de pipeline voor scriptconversie werken identiek voor Klingon en Plains Cree. Als uw kunsttalenpipeline werkt, werkt uw pipeline voor talen met beperkte middelen ook.
:::

---

## Ondersteunde Geconstrueerde Talen

| Taal | Code | Scriptconverter | Lettertype vereist |
|----------|------|:----------------:|:-------------:|
| Klingon | `tlh` | ✅ Romanisering → pIqaD | PUA-lettertype (bijv. pIqaD qolqoS) |
| Sindarin (Tolkien Elfisch) | `x-elvish-s` | ✅ Latijn → Tengwar | CSUR PUA-lettertype |
| Kryptonian | `x-kryptonian` | ✅ Latijn → Kryptonian | PUA-lettertype |
| Piraten-Engels | `x-pirate` | ❌ alleen register | Geen |
| Shakespeareaans Engels | `x-shakespeare` | ❌ alleen register | Geen |
| Yoda-spreektaal | `x-yoda` | ❌ alleen register | Geen |

Conlang-codes gebruiken het `x-`-prefix conform de BCP-47-conventie voor privégebruik, met uitzondering van Klingon (`tlh`), dat een [ISO 639-3](https://iso639-3.sil.org/code/tlh)-code heeft toegewezen gekregen van SIL International.

---

## Unicode, PUA en Lettertypevereisten

### Het Privégebruikgebied

Klingon (pIqaD), Sindarin (Tengwar) en Kryptonian maken gebruik van Unicode **Private Use Area (PUA)**-tekens. PUA is het bereik U+E000–U+F8FF — deze codepunten hebben **geen standaardtoewijzing**. Het [ConScript Unicode Registry (CSUR)](https://www.evertype.com/standards/csur/) beheert door de gemeenschap overeengekomen toewijzingen voor fictieve schriften, maar deze maken geen deel uit van de Unicode-standaard.

Wat dit in de praktijk betekent:

- PUA-tekst wordt weergegeven als **lege vakjes** (□□□) zonder het juiste geladen lettertype
- Verschillende lettertypen kunnen verschillende glyphs toewijzen aan dezelfde PUA-codepunten
- champollion levert GEEN PUA-lettertypen mee — u dient deze zelf te laden
- Systeemlettertypen zullen deze tekens nooit weergeven

### PUA-bereiken per Script

| Script | PUA-bereik | CSUR-referentie |
|--------|-----------|---------------|
| Klingon (pIqaD) | U+F8D0–U+F8FF | [CSUR Klingon](https://www.evertype.com/standards/csur/klingon.html) |
| Tengwar (Elfisch) | U+E000–U+E07F | [CSUR Tengwar](https://www.evertype.com/standards/csur/tengwar.html) |
| Kryptonian | Varieert per lettertype | Geen CSUR-standaard |

### PUA-weblettertypen laden

champollion bevat een ingebouwde opdracht voor het downloaden en beheren van PUA-weblettertypen:

```bash
# See which fonts are needed for your configured languages
champollion fonts list

# Download all needed fonts (auto-detects project type for output directory)
champollion fonts install

# Also generate a CSS snippet with @font-face declarations
champollion fonts install --css
```

De opdracht `fonts install` downloadt vanuit geverifieerde open-source-repositories:

| Lettertype | Script | Licentie | Bron |
|------|--------|---------|--------|
| pIqaD qolqoS | Klingon | SIL Open Font License 1.1 | [GitHub](https://github.com/dadap/pIqaD-fonts) |
| FreeMonoTengwar | Tengwar | GNU GPL v3 (met lettertypeuitzondering) | [SourceForge](https://sourceforge.net/projects/freetengwar/) |
| *(door gebruiker aangeleverd)* | Kryptonian | Varieert | Geen open-source PUA-lettertype beschikbaar |

De uitvoermap wordt automatisch gedetecteerd op basis van uw projectstructuur (Docusaurus → `static/fonts/`, Hugo → `static/fonts/`, standaard → `public/fonts/`). Overschrijf dit met `--dir`.

Als u lettertypen liever handmatig beheert, voeg dan `@font-face`-regels toe in uw CSS:

```css
@font-face {
  font-family: 'pIqaD';
  src: url('/fonts/pIqaDqolqoS.ttf') format('truetype');
  font-display: swap;
  unicode-range: U+F8D0-F8FF;
}

/* Apply to Klingon text elements */
[lang="tlh"], [data-script="piqad"] {
  font-family: 'pIqaD', sans-serif;
}
```

:::warning[Unicode-ondersteuning is NIET gegarandeerd]
Het Unicode Consortium heeft [expliciet geweigerd](https://www.unicode.org/faq/private_use.html) fictieve schriften in de standaard op te nemen. PUA-toewijzingen worden door de gemeenschap beheerd en kunnen conflicteren tussen verschillende lettertype-implementaties. Geef altijd het exacte lettertype op dat uw project gebruikt, en test de weergave in verschillende browsers.
:::

---

## Scriptconverters

### Hoe Ze Werken

De schrijfstroomconversie van champollion is een **post-vertalingshook, die alleen wordt toegepast wanneer de configuratie daarom vraagt**:

1. Het LLM vertaalt tekst naar een **werkschrift** (meestal Latijns of SRO)
2. De [kwaliteitscontrole](/docs/concepts/quality-gate) valideert de uitvoer
3. Als de instelling `script:` van het paar het weergaveschrift selecteert, zet de deterministische converter de gevalideerde tekst om — waarden met letters die de converter niet kan toewijzen, blijven intact in het werkschrift, met een waarschuwing per sleutel
4. Het resultaat wordt naar schijf geschreven

Deze tweestapsaanpak werkt omdat LLM's betere uitvoer produceren wanneer ze werken met op het Latijn gebaseerde schriften. De deterministische converter garandeert correcte scriptuitvoer zonder te vertrouwen op de (vaak onbetrouwbare) scriptkennis van het model.

Of stap 3 überhaupt wordt uitgevoerd, is een beslissing per project — zie [Schrijfstroomconversie](/docs/getting-started/configuration#script-conversion). De PUA-weergaveschriften (pIqaD, Tengwar, Kryptonian) zijn standaard uitgeschakeld omdat ze zonder een speciaal ontwikkeld lettertype als niets worden weergegeven; crk en sr hebben helemaal geen standaardwaarde, omdat beide orthografieën reëel zijn en de keuze aan het project is.

### Alle Vijf Converters

champollion wordt geleverd met vijf ingebouwde scriptconverters:

#### Plains Cree: SRO → Syllabics (`crk`)

Standard Roman Orthography naar Canadian Aboriginal Syllabics.

```
Input:  "pâ tê ki"    (syllables, a spelling example — not a word)
Output: "ᐹ ᑌ ᑭ"
```

Lange klinkers gebruiken een circumflex (of macron): ê, î, ô, â. De conversie wordt uitgevoerd door `cree-sro-syllabics`, de door de gemeenschap onderhouden converter die door ALTLab's itwêwina wordt gebruikt; placeholders, ICU-syntaxis, tags en URL's blijven onaangeroerd. Zie [Een taal met weinig middelen ondersteunen](/docs/network/community/low-resource-languages) voor de volledige Cree-pipeline.

#### Servisch: Latijn → Cyrillisch (`sr`)

Deterministische Latijn-naar-Cyrillisch-conversie voor het Servisch.

```
Input:  "zdravo"
Output: "здраво"
```

Dit verwerkt de volledige Servische alfabettoewijzing, inclusief digrafen (lj → љ, nj → њ, dž → џ).

#### Klingon: Romanisering → pIqaD (`tlh`)

Marc Okrands romaniseringssysteem naar pIqaD PUA-tekens.

```
Input:  "tlh gh Q"   (romanized letters, a spelling example — tlh is one letter)
Output: [pIqaD PUA]  (requires pIqaD font to render)
```

#### Sindarin: Latijn → Tengwar (`x-elvish-s`)

Tolkiens Sindarin-modus Tengwar-toewijzing.

```
Input:  "la ne mi"   (Latin letters, a spelling example — not a word)
Output: [Tengwar PUA] (requires Tengwar font to render)
```

#### Kryptonian: Latijn → Kryptonian (`x-kryptonian`)

Fan-lexicon Kryptonian-scripttoewijzing.

```
Input:  "Kal-El"
Output: [Kryptonian PUA] (requires Kryptonian font to render)
```

### Een Converter Activeren

Stel het veld `script` in op de ISO 15924-code van de orthografie die u wilt laten schrijven:

```json
{
  "languages": {
    "sr": { "script": "Cyrl" },
    "crk": { "script": "Cans" },
    "tlh": { "script": "Piqd" }
  }
}
```

Zonder dit veld wordt er niets geconverteerd. Voor `crk` en `sr` is het veld **verplicht** — beide orthografieën zijn reëel, en `sync` weigert er een voor u te kiezen. Voor de PUA-locales is het een opt-in bovenop de standaard romanisering. Zie [Schrijfstroomconversie](/docs/getting-started/configuration#script-conversion).

---

## Meertalige Scripts

Sommige echte talen maken gebruik van meerdere actieve schriften:

| Taal | Schriften | champollion-aanpak |
|------|-----------|--------------------|
| Servisch | Latijns + Cyrillisch | Eén locale, expliciete keuze: `"script": "Cyrl"` converteert, `"script": "Latn"` behoudt Latijns |
| Plains Cree | SRO (Latijns) + Syllabics | Eén locale, expliciete keuze: `"script": "Cans"` of `"script": "Latn"` |
| Chinees | Vereenvoudigd + Traditioneel | Afzonderlijke localecodes (`zh` vs. `zh-TW`) met verschillende registers |

Voor talen waarin beide schriften dezelfde doelgroep bedienen (Servisch, Plains Cree), behoudt één locale plus een expliciete keuze voor `script` één enkele vertaalpipeline. Voor talen waarin de schriften verschillende doelgroepen bedienen (Vereenvoudigd Chinees voor het vasteland van China, Traditioneel Chinees voor Taiwan/HK), gebruikt u afzonderlijke localecodes.

---

## Orthografische Opmerkingen

Registers zijn niet alleen een kwestie van toon — ze bevatten **orthografische instructies** die het LLM sturen naar correcte schrijfconventies.

### Formele Aanspreekvorm

De ingebouwde registers van champollion bevatten de cultureel passende formele aanspreekvorm voor elke taal:

| Taal | Formele vorm | Registerinstructie |
|----------|------------|---------------------|
| Duits | Sie | `Use Sie-form for formal address` |
| Frans | vous | `Use vous-form` |
| Russisch | вы | `Professional register with вы-form` |
| Turks | siz | `Professional register with siz-form` |
| Koreaans | 합쇼체 | `Formal Korean (합쇼체)` |
| Japans | です/ます | `Polite professional register (です/ます form)` |
| Pools | Pan/Pani | `Professional register with Pan/Pani form` |

### Genderinclusief Schrijven

Elke taalkaart heeft een veld `gender.inclusiveGuidance` met taalspecifiek advies. Dit wordt afzonderlijk van de registervoorinstelling in de LLM-vertaalprompt ingevoegd, zodat het consistent van toepassing is ongeacht welke formaliteitsvoorinstelling de gebruiker kiest:

- **Frans**: Inclusief schrijven met interpunctnotatie (bijv. "Connecté·e")
- **Duits**: Dubbele-puntnotatie (bijv. "Benutzer:innen")
- **Spaans**: Genderneutrale herformulering heeft de voorkeur; schuine-streepnotatie (bijv. "usuario/a") als terugvaloptie

Voor talen zonder specifieke richtlijnen op hun kaart (bijv. Koreaans, conlangs) valt het systeem terug op een algemene regel: *"geef de voorkeur aan genderneutrale vormen of de meest inclusieve beschikbare optie."*

### RTL-scriptvereisten

Registers voor het Arabisch, Hebreeuws, Perzisch en Urdu vermelden allemaal vereisten voor rechts-naar-links-weergave: `Ensure text reads naturally in RTL layout contexts.`

### Een Register Overschrijven

Elk register is een configuratiewaarde — overschrijf het om aan te sluiten bij de stem van uw project:

```json
{
  "languages": {
    "fr": {
      "register": "Casual French. Use tu-form. Conversational blog tone. Gender-neutral when possible."
    },
    "de": {
      "register": "Informal German. Use du-form. Tech startup voice."
    }
  }
}
```

Zie [Configuratie](/docs/getting-started/configuration) voor de volledige configuratiereferentie.

---

## Een Nieuwe Conlang Toevoegen

### Stap voor stap

1. **Kies een BCP-47-code voor privégebruik**: Gebruik het prefix `x-` (bijv. `x-dothraki`, `x-valyrian`).

2. **Voeg toe aan uw configuratie**:

```json
{
  "languages": {
    "x-dothraki": {
      "register": "Dothraki language. Use David J. Peterson's vocabulary from the Living Language Dothraki textbook. Harsh, direct tone. No articles, no verb 'to be'."
    }
  }
}
```

3. **(Optioneel) Voeg een scriptconverter toe**: Als uw conlang een niet-Latijns weergaveschrift gebruikt, voeg dan een converter toe in `lib/scripts.js` en registreer deze in `SCRIPT_CONVERTERS`.

4. **Testen**: Voer `champollion sync --dry` uit om vertalingen te bekijken zonder bestanden te schrijven.

5. **Controleer de kwaliteitspoort**: De [kwaliteitspoort](/docs/concepts/quality-gate) heeft mogelijk afstemming nodig voor uw conlang — met name de controle `requireNonLatin` als uw conlang PUA-tekens gebruikt.

:::note[De kwaliteit van kunsttaalvertalingen is afhankelijk van de LLM-kennis]
De LLM kan alleen vertalen naar een kunsttaal die aanwezig was in de trainingsdata. Goed gedocumenteerde kunsttalen (Klingon, Sindarin, Dothraki) werken goed. Obscure of recent bedachte kunsttalen kunnen inconsistente resultaten opleveren. Gebruik [coachingdata](/docs/concepts/coaching-data) om de kwaliteit te verbeteren.
:::

---

## Zie ook

- [Ondersteunde talen](/docs/reference/supported-languages) — volledige taaltabel met beschikbaarheid per methode
- [Scriptconverters](/docs/concepts/script-converters) — technische details van de conversiepijplijn
- [Vertaalmethoden](/docs/guides/translation-methods) — hoe elke vertaalmethode werkt
- [Configuratie](/docs/getting-started/configuration) — configuratiereferentie inclusief taal- en registerinstellingen
- [Ondersteuning voor een taal met weinig middelen](/docs/network/community/low-resource-languages) — dezelfde infrastructuur toegepast op echte ondervertegenwoordigde talen
