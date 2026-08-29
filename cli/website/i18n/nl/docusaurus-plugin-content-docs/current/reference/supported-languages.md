---
sidebar_position: 4
title: "Ondersteunde talen"
related:
  - label: "The Language Atlas"
    to: /languages
    kind: atlas
    note: "Browse the same coverage on the map"
  - label: "Trading Cards"
    to: /trading-cards
    kind: card
    note: "Every language as a collectible stat card"
  - label: "Language Card Specification"
    to: /docs/reference/language-card-spec
    kind: reference
  - label: "Endonym"
    to: /glossary#term-endonym
    kind: glossary
    note: "Why we write languages in their own names"
---

# Ondersteunde Talen

champollion wordt geleverd met **Taalkaarten** — gestructureerde configuratiebestanden voor 50 talen. Elke kaart bevat registervoorinstellingen, metadata van het formaliteitssysteem, ondersteuningsvlaggen voor methoden, typografieregels en scriptinformatie. Elke taal die uw LLM kent, kan worden toegevoegd met één configuratieregel — dit zijn de talen met gecureerde, productieklare registers.

---

## Vertaalmethoden

Elke taal kan gebruikmaken van een of meer van de volgende vertaalmethoden:

| Icoon | Methode | Hoe het werkt | Kosten |
|------|--------|-------------|------|
| 🟢 | **Google Translate** | Neurale MT-basislijn. 194 talen. Alleen key-value strings — kan Markdown-content niet veilig vertalen. | ~$20/1M tekens |
| 🔵 | **LLM (OpenRouter)** | Elke taal die het model kent. Registergestuurde prompts. Verwerkt key-value + Markdown-content. | Varieert per model |
| 🟣 | **LLM-Coached** | LLM + grammaticewoordenboeken + coachingdata geïnjecteerd in prompts. Het beste voor morfologisch complexe talen. | Varieert per model |
| 🟠 | **API (Plugin)** | Door de community gehoste vertaalpijplijnen die via HTTP worden aangeboden. [Soevereiniteits-aspirant](/docs/network/community/low-resource-languages). | Varieert per aanbieder |

Stel `GOOGLE_TRANSLATE_API_KEY` in voor Google Translate, of `OPENROUTER_API_KEY` voor LLM-methoden. Zie [Vertaalmethoden](/docs/guides/translation-methods) voor volledige details.

---

## Prioriteitstalen

Dit zijn de meest gevraagde landinstellingen voor web- en mobiele toepassingen, weergegeven in de door champollion aanbevolen volgorde op basis van toegankelijkheid.

| Vlag | Taal | Code | Google | LLM | Coached | Script | Opmerkingen |
|------|----------|------|:------:|:---:|:-------:|--------|-------|
| 🇸🇦 | Arabisch | `ar` | ✅ | ✅ | ✅ | — | RTL. Modern Standaard Arabisch (فصحى). |
| 🇵🇭 | Filipijns (Taglish) | `tl` / `fil` | ✅ | ✅ | ✅ | — | Gebruik `fil` in Docusaurus-configuraties. champollion herkent beide. |
| 🇫🇷 | Frans | `fr` | ✅ | ✅ | ✅ | — | Vous-vorm. Genderinclusief (Connecté·e). |
| 🇪🇸 | Spaans | `es` | ✅ | ✅ | ✅ | — | Neutraal Latijns-Amerikaans. |
| 🇩🇪 | Duits | `de` | ✅ | ✅ | ✅ | — | Sie-vorm. Genderinclusief (Benutzer:innen). |
| 🇯🇵 | Japans | `ja` | ✅ | ✅ | ✅ | — | です/ます voor hoofdtekst, する voor UI-labels. |
| 🇨🇳 | Chinees (Vereenvoudigd) | `zh` | ✅ | ✅ | ✅ | — | 简体中文. |
| 🇮🇹 | Italiaans | `it` | ✅ | ✅ | ✅ | — | Lei-vorm. |
| 🇧🇷 | Portugees (BR) | `pt` | ✅ | ✅ | ✅ | — | Braziliaans Portugees. |
| 🇰🇷 | Koreaans | `ko` | ✅ | ✅ | ✅ | — | 해요체 beleefd register. |

## Grote Wereldtalen

| Vlag | Taal | Code | Google | LLM | Coached | Script | Opmerkingen |
|------|----------|------|:------:|:---:|:-------:|--------|-------|
| 🇧🇩 | Bengaals | `bn` | ✅ | ✅ | ✅ | — | Voorkeur voor শুদ্ধ ভাষা. |
| 🇧🇬 | Bulgaars | `bg` | ✅ | ✅ | ✅ | — | |
| 🇨🇿 | Tsjechisch | `cs` | ✅ | ✅ | ✅ | — | Vykání (vy-vorm). |
| 🇩🇰 | Deens | `da` | ✅ | ✅ | ✅ | — | |
| 🇬🇷 | Grieks | `el` | ✅ | ✅ | ✅ | — | Modern Δημοτική. |
| 🇮🇷 | Perzisch | `fa` | ✅ | ✅ | ✅ | — | RTL. |
| 🇫🇮 | Fins | `fi` | ✅ | ✅ | ✅ | — | Geen grammaticaal geslacht. |
| 🇮🇱 | Hebreeuws | `he` | ✅ | ✅ | ✅ | — | RTL. |
| 🇮🇳 | Hindi | `hi` | ✅ | ✅ | ✅ | — | शुद्ध हिन्दी. Minimale Engelse leenwoorden. |
| 🇭🇺 | Hongaars | `hu` | ✅ | ✅ | ✅ | — | Ön-vorm. |
| 🇮🇩 | Indonesisch | `id` | ✅ | ✅ | ✅ | — | |
| 🇲🇾 | Maleis | `ms` | ✅ | ✅ | ✅ | — | |
| 🇳🇱 | Nederlands | `nl` | ✅ | ✅ | ✅ | — | U-vorm. |
| 🇳🇴 | Noors | `nb` | ✅ | ✅ | ✅ | — | Bokmål. |
| 🇵🇱 | Pools | `pl` | ✅ | ✅ | ✅ | — | Pan/Pani-vorm. |
| 🇵🇹 | Portugees (EU) | `pt-PT` | ✅ | ✅ | ✅ | — | Europees Portugees. |
| 🇷🇴 | Roemeens | `ro` | ✅ | ✅ | ✅ | — | |
| 🇷🇺 | Russisch | `ru` | ✅ | ✅ | ✅ | — | Вы-vorm. |
| 🇸🇰 | Slowaaks | `sk` | ✅ | ✅ | ✅ | — | Vykanie (vy-vorm). |
| 🇷🇸 | Servisch | `sr` | ✅ | ✅ | ✅ | 🔤 Latijn→Cyrillisch | Deterministische scriptconverter. |
| 🇸🇪 | Zweeds | `sv` | ✅ | ✅ | ✅ | — | |
| 🇰🇪 | Swahili | `sw` | ✅ | ✅ | ✅ | — | |
| 🇹🇭 | Thais | `th` | ✅ | ✅ | ✅ | — | ครับ/ค่ะ beleefdheidpartikels. |
| 🇹🇷 | Turks | `tr` | ✅ | ✅ | ✅ | — | Siz-vorm. |
| 🇺🇦 | Oekraïens | `uk` | ✅ | ✅ | ✅ | — | Ви-vorm. |
| 🇵🇰 | Urdu | `ur` | ✅ | ✅ | ✅ | — | RTL. آپ-vorm. |
| 🇻🇳 | Vietnamees | `vi` | ✅ | ✅ | ✅ | — | |
| 🇹🇼 | Chinees (Traditioneel) | `zh-TW` | ✅ | ✅ | ✅ | — | 繁體中文. |
| 🇬🇪 | Georgisch | `ka` | ✅ | ✅ | — | — | ქართული. Kartveelse taalfamilie. |
| 🇳🇬 | Yoruba | `yo` | ✅ | ✅ | — | — | Èdè Yorùbá. Tonaal (3 tonen). |

## Regionale Varianten

| Vlag | Taal | Code | Google | LLM | Coached | Script | Opmerkingen |
|------|----------|------|:------:|:---:|:-------:|--------|-------|
| 🇲🇽 | Mexicaans Spaans | `es-MX` | ✅ | ✅ | ✅ | — | Tú-vorm. Warm register. |
| 🇨🇦 | Canadees Frans | `fr-CA` | ✅ | ✅ | ✅ | — | Québécois-uitdrukkingen. |

---

## Inheemse & Laagresourcetalen

Deze talen worden niet ondersteund door commerciële MT-diensten. champollion biedt de tooling voor taalgemeenschappen om hun eigen methoden te bouwen volgens [datasoevereiniteitsprincipes](/docs/network/community/low-resource-languages).

| | Taal | Code | Google | LLM | Coached | Script | Status |
|---|----------|------|:------:|:---:|:-------:|--------|--------|
| 🪶 | Plains Cree | `crk` | ❌ | ✅ | ✅ | 🔤 SRO→Syllabics | 🚧 In ontwikkeling |
| 🌄 | Quechua | `qu` | ✅ | ✅ | — | — | Runasimi. Evidentiële achtervoegsels. |

:::info[Plains Cree is in actieve ontwikkeling]
Het register, de coachinginfrastructuur, de scriptconverter en het evaluatieraamwerk voor Plains Cree zijn allemaal functioneel, maar de vertaalpijplijn is **nog niet uitgebracht**. Wij werken samen met taalgemeenschappen volgens [datasoevereiniteitsprincipes](/docs/network/community/low-resource-languages) om de kwaliteit vóór de release te waarborgen. Zie [Een taal met weinig middelen ondersteunen](/docs/network/community/low-resource-languages) voor het volledige verhaal — en hoe u kunt bijdragen.
:::

:::tip[Meer talen met beperkte middelen toevoegen]
Het methode-pluginsysteem van champollion is hier speciaal voor ontworpen. Een taalgemeenschap kan een aangepaste vertaalmethode bouwen, deze onder eigen beheer hosten en beschikbaar stellen via de [API-methode](/docs/guides/serving-a-method). Het [Method Leaderboard](/leaderboard) houdt scores bij voor elk taalpaar — bouw een methode, voer het evaluatieraamwerk uit en claim de topscore.
:::

---

## Geconstrueerde Talen

Contalen worden ondersteund via LLM-registers en optionele scriptconverters. Ze maken gebruik van dezelfde infrastructuur als echte talen — de kwaliteitspoort, het coachingsysteem en de scriptconversiepijplijn werken identiek.

| | Taal | Code | Google | LLM | Script | Opmerkingen |
|---|----------|------|:------:|:---:|--------|-------|
| 🖖 | Klingon | `tlh` | ❌ | ✅ | 🔤 Romanisering→pIqaD | PUA-lettertype vereist. Marc Okrand-woordenschat. |
| 🧝 | Sindarin (Tolkien Elfisch) | `x-elvish-s` | ❌ | ✅ | 🔤 Latijn→Tengwar | CSUR PUA-lettertype vereist. |
| 🏴‍☠️ | Piraten-Engels | `x-pirate` | ❌ | ✅ | — | Alleen register. Nautische metaforen. |
| 🦸 | Kryptoniaans | `x-kryptonian` | ❌ | ✅ | 🔤 Latijn→Kryptoniaans | PUA-lettertype vereist. |
| 🎭 | Shakespeariaans Engels | `x-shakespeare` | ❌ | ✅ | — | Alleen register. Thee/thou, -eth/-est-vormen. |
| 🐸 | Yoda-spreektaal | `x-yoda` | ❌ | ✅ | — | Alleen register. OSV-woordvolgorde. |

Zie [Contalen, Scripts & Orthografie](/docs/guides/conlangs-scripts-orthography) voor PUA-lettertypevereisten, Unicode-beperkingen en instructies voor het toevoegen van uw eigen contaal.

---

## Taalvoorinstellingen

De `init`-wizard ondersteunt voorinstellingsnamen voor snelle configuratie. U kunt voorinstellingen combineren met afzonderlijke codes.

| Voorinstelling | Uitbreiding naar |
|--------|-----------|
| `european` | fr, de, es, it, pt, nl |
| `asian` | ja, zh, ko |
| `global` | fr, es, de, ja, zh, ko, pt, ar |
| `nordic` | da, fi, nb, sv |

```bash
# Mix presets with individual codes
champollion init
# → Target languages: european, ja
# → Resolves to: fr, de, es, it, pt, nl, ja
```

---

## Een Taal Toevoegen

champollion kan vertalen naar **elke taal die uw LLM kent** — de bovenstaande tabel bevat alleen talen met ingebouwde registervoorinstellingen. Om een niet-vermelde taal toe te voegen, neemt u de BCP-47-code op in uw configuratie:

```json
{
  "languages": {
    "sw": {},
    "am": {
      "register": "Formal Amharic. Professional register with Geʽez script."
    }
  }
}
```

De LLM vertaalt op basis van zijn trainingskennis van de taal. Door een `register` in te stellen, heeft u controle over toon, formaliteit en orthografische conventies. Zie [Configuratie](/docs/getting-started/configuration) voor details.

---

## Taalkaarten {#language-cards}

Elke ingebouwde taal heeft een **Taalkaart** — een uniform JSON-bestand in `shared/language-cards/` dat alle metadata bevat: registers, formaliteit, methodeondersteuning, typografieregels, genealogische classificatie, taalkundige uitdagingen en NLP-bronnen.

### Uniforme Kaartarchitectuur

Elke kaart wordt gretig geladen bij import. Er is geen afzonderlijke referentielaag — alle gegevens bevinden zich in één bestand per taal. Kaarten worden verrijkt vanuit gezaghebbende bronnen:

| Bron | Gegevens |
|--------|------|
| [Glottolog](https://glottolog.org) | Familieclassificatie, afstammingsketen, Glottocode |
| [WALS](https://wals.info) | Genusclassificatie, typologische kenmerken |
| [CLDR](https://cldr.unicode.org) | Script, richting, meervoudsregels, typografie |
| [ISO 15924](https://unicode.org/iso15924/) | Scriptcodes |

### Belangrijke Kaartvelden

| Veld | Inhoud |
|-------|------------------|
| **`nativeName`** | Endoniem — de naam van de taal in de taal zelf, in het eigen schrift (bijv. ქართული, Runasimi) |
| **`classification`** | Genealogisch ankerpunt: familie, genus, volledige afstammingsketen uit Glottolog |
| **`contactInfluences`** | Universele contactgeschiedenis — leenlagen, superstraten, substraten |
| **Formaliteitssysteem** | T-V-onderscheid, spraakregisters, keigo, partikels, enz. |
| **Registervoorinstellingen** | Benoemde LLM-promptvoorinstellingen specifiek voor het karakter van de taal |
| **Methodeondersteuning** | Welke vertaal-API's deze taal ondersteunen |
| **Genderbegeleiding** | Grammaticaal geslacht en tips voor inclusief schrijven |
| **Script/richting** | ISO 15924-scriptcode en RTL/LTR |
| **Regels** | Typografie (aanhalingstekens, spatiëring), hoofdlettergebruik, meervoudscategorieën |
| **`glottocode`** | Canonieke Glottolog-identifier voor kruisverwijzingen |
| **`dataSources`** | Herkomstregistratie (bijv. `["glottolog-5.3", "cldr-48"]`) |

### Een Nieuwe Taalkaart Opzetten

Gebruik de generator om een kaart op te zetten op basis van gezaghebbende gegevensbronnen (IANA, CLDR, Glottolog):

```bash
# Preview what would be generated
node scripts/generate-language-card.mjs sw --dry-run

# Generate a unified card
node scripts/generate-language-card.mjs sw
```

De generator vult automatisch metadata in (codes, script, richting, meervouden, aanhalingstekens, methodeondersteuning, classificatie) en markeert taalkundige beoordelingsvelden als TODO voor menselijke curatie.

### Voorinstellingssleutels Gebruiken

In plaats van volledige registertekst te schrijven, kunt u een voorinstellingssleutelnaam gebruiken:

```json
{
  "languages": {
    "fr": "casual-tu",
    "ko": "formal-hapsyo",
    "ja": "polite"
  }
}
```

Champollion zet de sleutel om naar de volledige registerprompt. Voer `npx champollion init` uit om beschikbare voorinstellingen per taal te bekijken.

### Voorbeeldvoorinstellingen

| Taal | Voorinstellingen | Standaard |
|----------|---------|--------|
| Frans | `formal-vous`, `casual-tu` | `formal-vous` |
| Koreaans | `polite-haeyo`, `formal-hapsyo`, `casual-hae` | `polite-haeyo` |
| Japans | `polite`, `formal-keigo`, `casual` | `polite` |
| Duits | `formal-Sie`, `casual-du` | `formal-Sie` |
| Thais | `neutral-professional`, `polite-male`, `polite-female` | `neutral-professional` |
| Spaans | `neutral-professional`, `formal-usted`, `casual-tuteo` | `neutral-professional` |

Zie [Een Taalkaart Bijdragen](https://github.com/gamedaysuits/champollion) voor de volledige specificatie, inclusief veldvalidatie en PR-checklist.

---

## Zie ook

- [Configuratie](/docs/getting-started/configuration) — volledige configuratiereferentie inclusief taalinstellingen
- [Vertaalmethoden](/docs/guides/translation-methods) — werking van elke methode
- [Scriptconverters](/docs/concepts/script-converters) — deterministische scriptconversiepijplijn
- [Contalen, Scripts & Orthografie](/docs/guides/conlangs-scripts-orthography) — PUA-lettertypen, Unicode, contalen toevoegen
- [Ondersteuning voor een Laagresourcetaal](/docs/network/community/low-resource-languages) — methoden bouwen voor ondervertegenwoordigde talen
