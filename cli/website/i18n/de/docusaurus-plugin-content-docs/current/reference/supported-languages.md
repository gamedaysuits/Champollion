---
sidebar_position: 4
title: "Unterstützte Sprachen"
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

# Unterstützte Sprachen

champollion wird mit **Language Cards** ausgeliefert — strukturierten Konfigurationsdateien für 50 Sprachen. Jede Card enthält Register-Voreinstellungen, Metadaten zum Formalitätssystem, Flags zur Methodenunterstützung, Typografieregeln und Schriftinformationen. Jede Sprache, die Ihr LLM kennt, kann mit einer einzigen Konfigurationszeile hinzugefügt werden — dies sind diejenigen mit kuratierten, produktionsreifen Registern.

---

## Übersetzungsmethoden

Jede Sprache kann eine oder mehrere dieser Übersetzungsmethoden verwenden:

| Symbol | Methode | Funktionsweise | Kosten |
|------|--------|-------------|------|
| 🟢 | **Google Translate** | Neuronale MT-Basis. 194 Sprachen. Nur Schlüssel-Wert-Zeichenfolgen — kann Markdown-Inhalte nicht sicher übersetzen. | ~$20/1 Mio. Zeichen |
| 🔵 | **LLM (OpenRouter)** | Jede Sprache, die das Modell kennt. Registergesteuerte Prompts. Verarbeitet Schlüssel-Wert- + Markdown-Inhalte. | Variiert je nach Modell |
| 🟣 | **LLM-Coached** | LLM + Grammatikwörterbücher + Coaching-Daten, die in Prompts integriert werden. Am besten für morphologisch komplexe Sprachen geeignet. | Variiert je nach Modell |
| 🟠 | **API (Plugin)** | Von der Community gehostete Übersetzungs-Pipelines, die über HTTP bereitgestellt werden. [Souveränitätsanstrebend](/docs/network/community/low-resource-languages). | Variiert je nach Anbieter |

Setzen Sie `GOOGLE_TRANSLATE_API_KEY` für Google Translate oder `OPENROUTER_API_KEY` für LLM-Methoden. Vollständige Details finden Sie unter [Übersetzungsmethoden](/docs/guides/translation-methods).

---

## Prioritätssprachen

Dies sind die am häufigsten angeforderten Sprachen für Web- und Mobilanwendungen, aufgeführt in der von champollion empfohlenen, barrierefreiheitsorientierten Reihenfolge.

| Flagge | Sprache | Code | Google | LLM | Coached | Schrift | Anmerkungen |
|------|----------|------|:------:|:---:|:-------:|--------|-------|
| 🇸🇦 | Arabisch | `ar` | ✅ | ✅ | ✅ | — | RTL. Modernes Hocharabisch (فصحى). |
| 🇵🇭 | Filipino (Taglish) | `tl` / `fil` | ✅ | ✅ | ✅ | — | Verwenden Sie `fil` in Docusaurus-Konfigurationen. champollion löst beide auf. |
| 🇫🇷 | Französisch | `fr` | ✅ | ✅ | ✅ | — | Vous-Form. Geschlechtergerecht (Connecté·e). |
| 🇪🇸 | Spanisch | `es` | ✅ | ✅ | ✅ | — | Neutrales Lateinamerikanisch. |
| 🇩🇪 | Deutsch | `de` | ✅ | ✅ | ✅ | — | Sie-Form. Geschlechtergerecht (Benutzer:innen). |
| 🇯🇵 | Japanisch | `ja` | ✅ | ✅ | ✅ | — | です/ます für Fließtext, する für UI-Beschriftungen. |
| 🇨🇳 | Chinesisch (vereinfacht) | `zh` | ✅ | ✅ | ✅ | — | 简体中文. |
| 🇮🇹 | Italienisch | `it` | ✅ | ✅ | ✅ | — | Lei-Form. |
| 🇧🇷 | Portugiesisch (BR) | `pt` | ✅ | ✅ | ✅ | — | Brasilianisches Portugiesisch. |
| 🇰🇷 | Koreanisch | `ko` | ✅ | ✅ | ✅ | — | 해요체 höfliches Register. |

## Bedeutende Weltsprachen

| Flagge | Sprache | Code | Google | LLM | Coached | Schrift | Anmerkungen |
|------|----------|------|:------:|:---:|:-------:|--------|-------|
| 🇧🇩 | Bengalisch | `bn` | ✅ | ✅ | ✅ | — | শুদ্ধ ভাষা-Präferenz. |
| 🇧🇬 | Bulgarisch | `bg` | ✅ | ✅ | ✅ | — | |
| 🇨🇿 | Tschechisch | `cs` | ✅ | ✅ | ✅ | — | Vykání (vy-Form). |
| 🇩🇰 | Dänisch | `da` | ✅ | ✅ | ✅ | — | |
| 🇬🇷 | Griechisch | `el` | ✅ | ✅ | ✅ | — | Modernes Δημοτική. |
| 🇮🇷 | Persisch | `fa` | ✅ | ✅ | ✅ | — | RTL. |
| 🇫🇮 | Finnisch | `fi` | ✅ | ✅ | ✅ | — | Kein grammatisches Geschlecht. |
| 🇮🇱 | Hebräisch | `he` | ✅ | ✅ | ✅ | — | RTL. |
| 🇮🇳 | Hindi | `hi` | ✅ | ✅ | ✅ | — | शुद्ध हिन्दी. Minimale englische Lehnwörter. |
| 🇭🇺 | Ungarisch | `hu` | ✅ | ✅ | ✅ | — | Ön-Form. |
| 🇮🇩 | Indonesisch | `id` | ✅ | ✅ | ✅ | — | |
| 🇲🇾 | Malaiisch | `ms` | ✅ | ✅ | ✅ | — | |
| 🇳🇱 | Niederländisch | `nl` | ✅ | ✅ | ✅ | — | U-Form. |
| 🇳🇴 | Norwegisch | `nb` | ✅ | ✅ | ✅ | — | Bokmål. |
| 🇵🇱 | Polnisch | `pl` | ✅ | ✅ | ✅ | — | Pan/Pani-Form. |
| 🇵🇹 | Portugiesisch (EU) | `pt-PT` | ✅ | ✅ | ✅ | — | Europäisches Portugiesisch. |
| 🇷🇴 | Rumänisch | `ro` | ✅ | ✅ | ✅ | — | |
| 🇷🇺 | Russisch | `ru` | ✅ | ✅ | ✅ | — | Вы-Form. |
| 🇸🇰 | Slowakisch | `sk` | ✅ | ✅ | ✅ | — | Vykanie (vy-Form). |
| 🇷🇸 | Serbisch | `sr` | ✅ | ✅ | ✅ | 🔤 Lateinisch→Kyrillisch | Deterministischer Schriftkonverter. |
| 🇸🇪 | Schwedisch | `sv` | ✅ | ✅ | ✅ | — | |
| 🇰🇪 | Suaheli | `sw` | ✅ | ✅ | ✅ | — | |
| 🇹🇭 | Thailändisch | `th` | ✅ | ✅ | ✅ | — | ครับ/ค่ะ Höflichkeitspartikel. |
| 🇹🇷 | Türkisch | `tr` | ✅ | ✅ | ✅ | — | Siz-Form. |
| 🇺🇦 | Ukrainisch | `uk` | ✅ | ✅ | ✅ | — | Ви-Form. |
| 🇵🇰 | Urdu | `ur` | ✅ | ✅ | ✅ | — | RTL. آپ-Form. |
| 🇻🇳 | Vietnamesisch | `vi` | ✅ | ✅ | ✅ | — | |
| 🇹🇼 | Chinesisch (traditionell) | `zh-TW` | ✅ | ✅ | ✅ | — | 繁體中文. |
| 🇬🇪 | Georgisch | `ka` | ✅ | ✅ | — | — | ქართული. Kartwelische Sprachfamilie. |
| 🇳🇬 | Yoruba | `yo` | ✅ | ✅ | — | — | Èdè Yorùbá. Tonal (3 Töne). |

## Regionale Varianten

| Flagge | Sprache | Code | Google | LLM | Coached | Schrift | Anmerkungen |
|------|----------|------|:------:|:---:|:-------:|--------|-------|
| 🇲🇽 | Mexikanisches Spanisch | `es-MX` | ✅ | ✅ | ✅ | — | Tú-Form. Warmes Register. |
| 🇨🇦 | Kanadisches Französisch | `fr-CA` | ✅ | ✅ | ✅ | — | Québécois-Idiome. |

---

## Indigene und ressourcenarme Sprachen

Diese Sprachen werden von kommerziellen MT-Diensten nicht unterstützt. champollion stellt die Werkzeuge für Sprachgemeinschaften bereit, um ihre eigenen Methoden nach den [Datensouveränitätsprinzipien der Gemeinschaften](/docs/network/community/low-resource-languages) zu entwickeln.

| | Sprache | Code | Google | LLM | Coached | Schrift | Status |
|---|----------|------|:------:|:---:|:-------:|--------|--------|
| 🪶 | Plains Cree | `crk` | ❌ | ✅ | ✅ | 🔤 SRO→Silbenschrift | 🚧 In Entwicklung |
| 🌄 | Quechua | `qu` | ✅ | ✅ | — | — | Runasimi. Evidenzielle Suffixe. |

:::info[Plains Cree befindet sich in aktiver Entwicklung]
Das Register, die Coaching-Infrastruktur, der Skript-Konverter und die Evaluierungsumgebung für Plains Cree sind alle funktionsfähig, aber die Übersetzungs-Pipeline wurde **noch nicht veröffentlicht**. Wir arbeiten mit Sprachgemeinschaften nach den [Datensouveränitätsprinzipien der Gemeinschaften](/docs/network/community/low-resource-languages) zusammen, um die Qualität vor der Veröffentlichung sicherzustellen. Siehe [Unterstützung einer ressourcenarmen Sprache](/docs/network/community/low-resource-languages) für die vollständigen Hintergründe — und wie Sie dazu beitragen können.
:::

:::tip[Weitere ressourcenarme Sprachen hinzufügen]
Das Method-Plugin-System von champollion ist genau dafür konzipiert. Eine Sprachgemeinschaft kann eine eigene Übersetzungsmethode erstellen, unter eigener Kontrolle hosten und über die [API-Methode](/docs/guides/serving-a-method) bereitstellen. Das [Method Leaderboard](/leaderboard) verfolgt Bewertungen für beliebige Sprachpaare — erstellen Sie eine Methode, führen Sie das Framework aus und beanspruchen Sie den Spitzenplatz.
:::

---

## Konstruierte Sprachen

Conlangs werden über LLM-Register und optionale Schriftkonverter unterstützt. Sie verwenden dieselbe Infrastruktur wie echte Sprachen — das Qualitätsgate, das Coaching-System und die Schriftkonvertierungs-Pipeline funktionieren identisch.

| | Sprache | Code | Google | LLM | Schrift | Anmerkungen |
|---|----------|------|:------:|:---:|--------|-------|
| 🖖 | Klingonisch | `tlh` | ❌ | ✅ | 🔤 Romanisierung→pIqaD | PUA-Schriftart erforderlich. Marc-Okrand-Vokabular. |
| 🧝 | Sindarin (Tolkiens Elbisch) | `x-elvish-s` | ❌ | ✅ | 🔤 Lateinisch→Tengwar | CSUR-PUA-Schriftart erforderlich. |
| 🏴‍☠️ | Piratenenglisch | `x-pirate` | ❌ | ✅ | — | Nur Register. Nautische Metaphern. |
| 🦸 | Kryptonisch | `x-kryptonian` | ❌ | ✅ | 🔤 Lateinisch→Kryptonisch | PUA-Schriftart erforderlich. |
| 🎭 | Shakespeare-Englisch | `x-shakespeare` | ❌ | ✅ | — | Nur Register. Thee/thou, -eth/-est-Formen. |
| 🐸 | Yoda-Sprache | `x-yoda` | ❌ | ✅ | — | Nur Register. OSV-Wortstellung. |

Siehe [Conlangs, Schriften & Orthografie](/docs/guides/conlangs-scripts-orthography) für PUA-Schriftart-Anforderungen, Unicode-Einschränkungen und wie Sie Ihre eigene hinzufügen.

---

## Sprach-Voreinstellungen

Der Assistent `init` unterstützt Voreinstellungsnamen für eine schnelle Einrichtung. Sie können Voreinstellungen mit einzelnen Codes kombinieren.

| Voreinstellung | Wird erweitert zu |
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

## Eine beliebige Sprache hinzufügen

champollion kann in **jede Sprache übersetzen, die Ihr LLM kennt** — die obige Tabelle listet lediglich Sprachen mit integrierten Register-Voreinstellungen auf. Um eine nicht aufgeführte Sprache hinzuzufügen, geben Sie ihren BCP-47-Code in Ihrer Konfiguration an:

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

Das LLM übersetzt anhand seines Trainingswissens über die Sprache. Das Festlegen eines `register` gibt Ihnen Kontrolle über Tonfall, Formalität und orthografische Konventionen. Details finden Sie unter [Konfiguration](/docs/getting-started/configuration).

---

## Language Cards {#language-cards}

Jede integrierte Sprache verfügt über eine **Language Card** — eine einheitliche JSON-Datei in `shared/language-cards/`, die alle Metadaten enthält: Register, Formalität, Methodenunterstützung, Typografieregeln, genealogische Klassifizierung, sprachliche Herausforderungen und NLP-Ressourcen.

### Einheitliche Card-Architektur

Jede Card wird beim Import sofort geladen. Es gibt keine separate Referenzebene — alle Daten befinden sich in einer einzigen Datei pro Sprache. Cards werden aus maßgeblichen Quellen angereichert:

| Quelle | Daten |
|--------|------|
| [Glottolog](https://glottolog.org) | Familienklassifizierung, Abstammungskette, Glottocode |
| [WALS](https://wals.info) | Genus-Klassifizierung, typologische Merkmale |
| [CLDR](https://cldr.unicode.org) | Schrift, Richtung, Pluralregeln, Typografie |
| [ISO 15924](https://unicode.org/iso15924/) | Schriftcodes |

### Wichtige Card-Felder

| Feld | Inhalt |
|-------|------------------|
| **`nativeName`** | Endonym — der Name der Sprache für sich selbst, in ihrer eigenen Schrift (z. B. ქართული, Runasimi) |
| **`classification`** | Genealogischer Anker: Familie, Genus, vollständige Abstammungskette aus Glottolog |
| **`contactInfluences`** | Universelle Kontaktgeschichte — Entlehnungsschichten, Superstrate, Substrate |
| **Formalitätssystem** | T-V-Unterscheidung, Sprechebenen, Keigo, Partikel usw. |
| **Register-Voreinstellungen** | Benannte LLM-Prompt-Voreinstellungen, die für den Charakter der Sprache spezifisch sind |
| **Methodenunterstützung** | Welche Übersetzungs-APIs diese Sprache unterstützen |
| **Geschlechterhinweise** | Regeln zum grammatischen Geschlecht und Tipps für geschlechtergerechtes Schreiben |
| **Schrift/Richtung** | ISO-15924-Schriftcode und RTL/LTR |
| **Regeln** | Typografie (Anführungszeichen, Abstände), Großschreibung, Pluralkategorien |
| **`glottocode`** | Kanonischer Glottolog-Identifikator für Querverweise |
| **`dataSources`** | Herkunftsverfolgung (z. B. `["glottolog-5.3", "cldr-48"]`) |

### Eine neue Language Card aufsetzen

Verwenden Sie den Generator, um eine Card aus maßgeblichen Datenquellen (IANA, CLDR, Glottolog) aufzusetzen:

```bash
# Preview what would be generated
node scripts/generate-language-card.mjs sw --dry-run

# Generate a unified card
node scripts/generate-language-card.mjs sw
```

Der Generator füllt Metadaten automatisch aus (Codes, Schrift, Richtung, Plurale, Anführungszeichen, Methodenunterstützung, Klassifizierung) und markiert Felder mit sprachlichem Beurteilungsbedarf als TODO für die menschliche Kuratierung.

### Voreinstellungsschlüssel verwenden

Anstatt den vollständigen Registertext zu schreiben, können Sie einen Namen für einen Voreinstellungsschlüssel verwenden:

```json
{
  "languages": {
    "fr": "casual-tu",
    "ko": "formal-hapsyo",
    "ja": "polite"
  }
}
```

Champollion löst den Schlüssel zum vollständigen Register-Prompt auf. Führen Sie `npx champollion init` aus, um die verfügbaren Voreinstellungen für jede Sprache anzuzeigen.

### Beispiel-Voreinstellungen

| Sprache | Voreinstellungen | Standard |
|----------|---------|--------|
| Französisch | `formal-vous`, `casual-tu` | `formal-vous` |
| Koreanisch | `polite-haeyo`, `formal-hapsyo`, `casual-hae` | `polite-haeyo` |
| Japanisch | `polite`, `formal-keigo`, `casual` | `polite` |
| Deutsch | `formal-Sie`, `casual-du` | `formal-Sie` |
| Thailändisch | `neutral-professional`, `polite-male`, `polite-female` | `neutral-professional` |
| Spanisch | `neutral-professional`, `formal-usted`, `casual-tuteo` | `neutral-professional` |

Siehe [Eine Language Card beitragen](https://github.com/gamedaysuits/champollion) für die vollständige Spezifikation, einschließlich Feldvalidierung und PR-Checkliste.

---

## Siehe auch

- [Konfiguration](/docs/getting-started/configuration) — vollständige Konfigurationsreferenz einschließlich Spracheinrichtung
- [Übersetzungsmethoden](/docs/guides/translation-methods) — wie jede Methode funktioniert
- [Schriftkonverter](/docs/concepts/script-converters) — deterministische Schriftkonvertierungs-Pipeline
- [Conlangs, Schriften & Orthografie](/docs/guides/conlangs-scripts-orthography) — PUA-Schriftarten, Unicode, Conlangs hinzufügen
- [Eine ressourcenarme Sprache unterstützen](/docs/network/community/low-resource-languages) — Methoden für unterversorgte Sprachen entwickeln
