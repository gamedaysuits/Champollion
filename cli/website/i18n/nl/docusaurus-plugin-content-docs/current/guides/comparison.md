---
sidebar_position: 7
title: "Vergelijking"
---

# Hoe Champollion Zich Verhoudt

champollion bevindt zich in een andere categorie dan de meeste lokalisatietools. Hier volgt een eerlijke vergelijking.

## Het Landschap

De meeste lokalisatietools vallen in één van drie categorieën:

| Categorie | Voorbeelden | Model |
|----------|----------|-------|
| **Cloud TMS-platforms** | Crowdin, Phrase, Locize, Tolgee | SaaS-dashboard + menselijke vertalers + maandelijks abonnement |
| **Key-extractietools** | i18next-scanner, FormatJS CLI | Broncode scannen op aanroepen van vertaalfuncties |
| **CLI-vertaalmachines** | **champollion** | Uitvoeren in uw project, bestanden direct vertalen, geen cloudaccount |

Champollion is een **CLI-vertaalmachine** — het vertaalt uw localebestanden direct via configureerbare backends (LLM's, Google Translate, aangepaste plugins). Geen clouddashboard, geen workflow voor menselijke vertalers, geen maandelijkse kosten.

---

## Functievergelijking

| Functie | champollion | Crowdin | Phrase | Locize |
|---------|:------------:|:-------:|:------:|:------:|
| **Draait lokaal (geen cloudaccount)** | ✅ | ❌ | ❌ | ❌ |
| **Minimale afhankelijkheden** | ✅ | ❌ | ❌ | ❌ |
| **Methodeconfiguratie per talenpaar** | ✅ | ❌ | ❌ | ❌ |
| **Aangepaste taalregisters** | ✅ | ❌ | ❌ | ❌ |
| **Inhoudsbewust (beschermt codeblokken)** | ✅ | ❌ | ❌ | ❌ |
| **Kunsttalen & schriftconversie** | ✅ | ❌ | ❌ | ❌ |
| **Plugin-architectuur** | ✅ | ❌ | ❌ | ❌ |
| **Markdown- / inhoudsvertaling** | ✅ | ✅ | ✅ | ❌ |
| **Vertaalgeheugen** | ✅ | ✅ | ✅ | ✅ |
| **XLIFF-export/import** | ✅ | ✅ | ✅ | ❌ |
| **ICU-meervoudsvalidatie** | ✅ | ✅ | ✅ | ❌ |
| **Terminologiehandhaving** | ✅ | ✅ | ✅ | ❌ |
| **Workflow voor menselijke vertalers** | Op basis van XLIFF | ✅ | ✅ | ✅ |
| **In-context bewerken (visueel)** | ❌ | ✅ | ✅ | ✅ |
| **Teamsamenwerking** | ❌ | ✅ | ✅ | ✅ |
| **Ondersteunde bestandsformaten** | JSON, TOML, YAML, MD, XLIFF | 50+ | 40+ | JSON |
| **Prijzen** | Gratis voor niet-commercieel gebruik (u betaalt uw LLM) | Vanaf $0/mnd | Vanaf $0/mnd | Vanaf $0/mnd |

---

## Wanneer Champollion te Gebruiken

**Champollion is een goede keuze wanneer:**

- U machinale vertaling wilt integreren in uw buildpipeline — niet als afzonderlijke workflow
- U per taal de methode wilt bepalen (LLM voor sommige talen, Google Translate voor andere, aangepaste plugins voor de rest)
- U vertaalt naar talen zonder API-ondersteuning (inheemse talen, bedreigde talen, geconstrueerde talen)
- U deterministische schriftuitvoer wilt (Cree-lettergrepen, Klingon pIqaD, Tengwar)
- U geen leveranciersafhankelijkheid en geen cloudafhankelijkheden wilt
- U een soloOntwikkelaar of klein team bent dat geen volledig TMS-dashboard nodig heeft
- U XLIFF-gebaseerde overdracht aan professionele vertalers wilt zonder cloudabonnement

**Een cloud-TMS is een betere keuze wanneer:**

- U professionele menselijke vertalers elke tekstreeks laat beoordelen (de XLIFF-workflow van champollion is eenvoudiger dan een volledig TMS)
- U projectoverschrijdend vertaalgeheugen en glossariumbeheer nodig heeft
- U in-context visueel bewerken nodig heeft (vertalingen bekijken in uw gebruikersinterface)
- U een groot team heeft met behoeften op het gebied van rolgebaseerde toegangscontrole
- U ondersteuning voor 50+ bestandsformaten nodig heeft

---

## Wat Champollion Doet Wat Niemand Anders Doet

### 1. Aangepaste Registers

Elk taalpaar krijgt cultureel passende tooninstructies voor de LLM:

```json
{
  "de": {
    "register": "Standard professional register. Use Sie-form for formal address."
  },
  "tl": {
    "register": "Educated Manila Taglish. Use Tagalog as the primary language but keep technical terms in English."
  },
  "tlh": {
    "register": "Warrior's honor. OVS grammar. Use Marc Okrand vocabulary."
  }
}
```

Geen enkel ander hulpmiddel wordt geleverd met 47 vooraf geconfigureerde taalregisters, of laat u per project aangepaste registers definiëren.

### 2. Deterministische Schriftconverters

Champollion wordt geleverd met vijf ingebouwde schriftconverters die als post-vertaalhooks worden uitgevoerd — geen LLM vereist:

| Locale | Conversie | Voorbeeld |
|--------|-----------|---------|
| `crk` | SRO → Cree-lettergrepen | `nêhiyawêwin` → `ᓀᐦᐃᔭᐍᐏᐣ` |
| `sr` | Latijn → Cyrillisch | `Beograd` → `Београд` |
| `tlh` | Romanisering → pIqaD | `tlhIngan Hol` → (pIqaD-glyphs) |
| `x-elvish-s` | Latijn → Tengwar | Sindarin → Tengwar (Mode of Beleriand) |
| `x-kryptonian` | Latijn → Kryptoniaans | Cijfersubstitutie (vereist lettertype) |

Dit zijn pure opzoektabelconverters — deterministisch, controleerbaar, zonder risico op LLM-hallucinaties.

### 3. Inhoudsbewuste Afscherming

Bij het vertalen van Markdown of rijke inhoud beschermt Champollion:

- Omheinde codeblokken (` ``` `)
- Inline code (`` ` ` ``)
- Hugo-shortcodes (`{{</* */>}}`, `{{%/* */%}}`)
- Interpolatievariabelen (`{{ .Count }}`, `{name}`, `{{t('key')}}`)
- Ruwe HTML-blokken

Deze worden vóór de vertaling vervangen door Unicode-schildwachttokens en daarna hersteld. De LLM ziet nooit uw code, uw shortcodes of uw variabelen.

### 4. Gecoachte Methodeplugins

Voor talen zonder API-ondersteuning kunt u een gecoachte vertaalmethode bouwen:

1. Schrijf linguïstische coachingdata (grammaticaregels, woordenschat, voorbeelden)
2. Bundel het als een plugin
3. Benchmark het aan de hand van referentievertalingen met behulp van de [eval harness](https://github.com/gamedaysuits/Champollion)
4. Installeer het in uw project met `champollion plugin install`

Dit is hoe champollion Plains Cree verwerkt — en hoe u elke taal kunt verwerken, inclusief talen die nog niet bestaan.

---

## De Conclusie

Champollion is geen vervanging voor Crowdin. Het is een ander hulpmiddel voor een andere workflow. Als u menselijke vertalers nodig heeft, gebruik dan een TMS. Als u een CLI nodig heeft die uw bestanden met één opdracht vertaalt en u per taal controle geeft over methoden, modellen en registers — gebruik dan champollion.
