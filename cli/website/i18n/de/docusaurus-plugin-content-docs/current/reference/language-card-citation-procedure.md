---
title: "Zitierverfahren für Sprachkarten"
sidebar_label: "Citation Procedure"
---

# Zitierverfahren für Sprachkarten

*Wie Champollion sicherstellt, dass jede Aussage auf einer Sprachkarte auf eine Primärquelle zurückführbar ist.*

---

## 1. Das Problem

Sprachkarten enthalten faktische Aussagen — Sprecherzahlen, Gefährdungsstatus, Kontakteinflüsse, morphologische Eigenschaften, typografische Konventionen, Methodenunterstützung —, die **überprüfbar sein müssen**. Derzeit gilt:

- Das Feld `dataSources` ist ein flaches Array von Zeichenketten (z. B. `["cldr-48", "glottolog-5.3"]`)
- Es gibt keine Zitiergranularität auf Feldebene
- Aussagen wie „~2,8 Mio. Sprecher“ oder „gefährdet“ verfügen über keine nachvollziehbare Herkunft
- Ein Prüfer kann nicht feststellen, welche Quelle welche Aussage stützt

> [!CAUTION]
> **Eine unbelegte Aussage ist eine nicht überprüfbare Aussage.** Für ein Projekt, das sich als professionell rigoros positioniert, muss jede Behauptung auf einer Sprachkarte auf eine bestimmte, versionierte Primärquelle zurückführbar sein.

---

## 2. Maßgebliche Quellen (nach Priorität gereiht)

Für jede Art von Aussage sind die folgenden Quellen maßgeblich. **Bevorzugen Sie stets die höchstgereihte verfügbare Quelle.**

### Klassifikation und Identität

| Priorität | Quelle | Umfasst | Lizenz | Zitierweise |
|---|---|---|---|---|
| 1 | [Glottolog](https://glottolog.org) (Max Planck) | Familie, Abstammung, Glottocode | CC-BY 4.0 | `glottolog-5.x` |
| 2 | [ISO 639-3](https://iso639-3.sil.org) (SIL) | ISO-Codes, Makrosprachen | Frei | `iso639-3-{date}` |
| 3 | [WALS](https://wals.info) (Max Planck) | Genus-Definitionen, typologische Merkmale | CC-BY 4.0 | `wals-2024` |
| 4 | [CLDR](https://cldr.unicode.org) (Unicode) | Locale-Codes, Skript-Codes, Pluralregeln | Unicode ToS | `cldr-{version}` |

### Sprecherdemografie und Vitalität

| Priorität | Quelle | Umfasst | Lizenz | Zitierweise |
|---|---|---|---|---|
| 1 | Nationale Zensusdaten | Offizielle Sprecherzahlen | Variiert (üblicherweise öffentlich) | `census-{country}-{year}` |
| 2 | [Ethnologue](https://www.ethnologue.com) | Sprecherschätzungen, EGIDS | Proprietär (Abonnement) | `ethnologue-{edition}` |
| 3 | [UNESCO Atlas](http://www.unesco.org/languages-atlas/) | Gefährdungsstatus | Frei | `unesco-atlas-{year}` |
| 4 | Veröffentlichte wissenschaftliche Arbeiten | Regionale Sprechererhebungen | Lizenz je Arbeit | `{author}-{year}` |
| 5 | [Katig Collective](https://linguistics.upd.edu.ph/the-katig-collective/) | Philippinische Sprachen | Akademisch | `katig-{year}` |

> [!WARNING]
> **Verwenden Sie niemals Wikipedia, LLM-generierten Text oder eigenes Wissen als Primärquelle für demografische Aussagen.** Dabei handelt es sich bestenfalls um Sekundär-/Tertiärquellen. Führen Sie stets auf die Primärdaten zurück.

### Methodenunterstützung (Abdeckung der Übersetzungs-APIs)

| Methode | Verifizierungsquelle | Verifizierungsweise | Zitierweise |
|---|---|---|---|
| Google Translate | [Sprachliste](https://cloud.google.com/translate/docs/languages) | API-Aufruf oder Dokumentationsseite | `google-translate-{date}` |
| DeepL | [Sprachliste](https://www.deepl.com/docs-api/translate-text/) | API-Aufruf | `deepl-api-{date}` |
| Microsoft Translator | [Sprachliste](https://learn.microsoft.com/en-us/azure/ai-services/translator/language-support) | Dokumentationsseite | `ms-translator-{date}` |
| LibreTranslate | [Sprachliste](https://libretranslate.com/languages) | API-Aufruf | `libretranslate-{date}` |
| NLLB | [FLORES README](https://github.com/openlanguagedata/flores) | README + Modellkarte | `nllb-200-{date}` |
| LLM | Stets `true` | Entfällt (Qualität variiert) | `llm-assumed` |

### DLS (Digital Language Support)

| Priorität | Quelle | Umfasst | Zitierweise |
|---|---|---|---|
| 1 | [Simons et al. 2022](https://aclanthology.org/2022.coling-1.379/) | DLS-Werte (ursprüngliche 143 Werkzeuge) | `simons-2022` |
| 2 | Ethnologue 27. Aufl. ff. | DLS-Werte (erweiterte 211 Werkzeuge) | `ethnologue-{edition}-dls` |

### Typografie, Plurale, Skripte

| Priorität | Quelle | Umfasst | Zitierweise |
|---|---|---|---|
| 1 | [CLDR](https://cldr.unicode.org) | Pluralregeln, Anführungszeichen, Zahlenformatierung | `cldr-{version}` |
| 2 | [Unicode CSUR](https://unicode.org/iso15924/) | Skript-Codes | `iso15924-{date}` |
| 3 | Veröffentlichte Grammatiken | Sprachspezifische Regeln | `{author}-{year}` |

### Kontakteinflüsse

| Priorität | Quelle | Umfasst | Zitierweise |
|---|---|---|---|
| 1 | Veröffentlichte historisch-linguistische Arbeiten | Lehnwortstudien, Kontaktgeschichte | `{author}-{year}` |
| 2 | Referenzgrammatiken | Beschreibungen struktureller Einflüsse | `{grammar-title}-{year}` |
| 3 | [WALS](https://wals.info) | Typologische Vergleiche | `wals-{feature}-{year}` |

> [!IMPORTANT]
> **Aussagen zu Kontakteinflüssen sind am schwierigsten zu belegen.** Aussagen wie „spanisches Superstrat, tief, 1571–1898“ erfordern Fachwissen der historischen Linguistik. Falls keine veröffentlichte Quelle gefunden werden kann, kennzeichnen Sie die Aussage mit `"citation_needed": true`, anstatt zu raten.

---

## 3. Zitierverfahren (Schritt für Schritt)

### Beim Erstellen einer neuen Sprachkarte

1. **Beginnen Sie mit automatisch befüllten Feldern:**
   - Führen Sie `node scripts/build-language-tree.mjs --enrich` aus → befüllt `classification` aus Glottolog
   - Erfassen Sie `"glottolog-{version}"` in `dataSources`

2. **Fügen Sie CLDR-Daten hinzu:**
   - Schlagen Sie Pluralregeln, Anführungszeichen und Skript-Code in CLDR nach
   - Erfassen Sie `"cldr-{version}"` in `dataSources`

3. **Recherchieren Sie die Sprecherdemografie:**
   - Prüfen Sie ZUERST nationale Zensusdaten
   - Gleichen Sie mit Ethnologue ab (sofern verfügbar)
   - Gleichen Sie mit dem UNESCO Atlas ab
   - Erfassen Sie ALLE konsultierten Quellen in `dataSources`

4. **Verifizieren Sie die Methodenunterstützung:**
   - Prüfen Sie die Sprachliste JEDER API (nicht aus dem Gedächtnis, nicht aus Annahmen)
   - Erfassen Sie das Verifizierungsdatum

5. **Recherchieren Sie Kontakteinflüsse:**
   - Finden Sie veröffentlichte historisch-linguistische Arbeiten
   - Dokumentieren Sie Zeitraum, Typ und Tiefe mit Quellenangaben
   - Falls keine veröffentlichte Quelle existiert, fügen Sie dem Einfluss-Eintrag `"citation_needed": true` hinzu

6. **Recherchieren Sie die Vitalität:**
   - Prüfen Sie Ethnologue auf EGIDS
   - Prüfen Sie den UNESCO Atlas auf den Gefährdungsstatus
   - Vermerken Sie etwaige Diskrepanzen zwischen Quellen

7. **Befüllen Sie `dataSources`:**
   - Listen Sie JEDE konsultierte Quelle auf (nicht nur jene, die Daten geliefert haben)
   - Verwenden Sie das Zitierformat aus den obigen Tabellen

### Beim Aktualisieren einer bestehenden Karte

1. **Ändern Sie niemals eine faktische Aussage, ohne `dataSources` zu aktualisieren**
2. **Wenn Sie eine Sprecherzahl aktualisieren**, entfernen Sie die alte Quelle und fügen Sie die neue hinzu
3. **Wenn Sie Methodenunterstützung hinzufügen**, verifizieren Sie diese gegen die API und erfassen Sie das Datum
4. **Versehen Sie alle Prüfungen der Methodenunterstützung mit einem Datumsstempel** — die API-Abdeckung ändert sich häufig

---

## 4. Vorgeschlagene Schema-Erweiterung: Zitate auf Feldebene

### Aktuelles Schema (flaches `dataSources`)

```json
"dataSources": ["cldr-48", "glottolog-5.3"]
```

**Problem:** Welche Felder stammen aus CLDR? Welche aus Glottolog? Welche sind unbelegt?

### Vorgeschlagene Erweiterung: Strukturiertes `dataSources`

```json
"dataSources": {
  "classification": ["glottolog-5.3"],
  "vitality.unescoStatus": ["unesco-atlas-2024"],
  "vitality.egids": ["ethnologue-27"],
  "vitality.speakerCount": ["census-ph-2020", "ethnologue-27"],
  "rules.plurals": ["cldr-48"],
  "rules.typography": ["cldr-48"],
  "contactInfluences": ["blust-2013", "llamzon-1969"],
  "methodSupport.googleTranslate": ["google-translate-2024-07"],
  "methodSupport.nllb": ["nllb-200-2024-03"],
  "dls": ["simons-2022", "ethnologue-27-dls"],
  "pipelineReadiness": ["manual-assessment-2025-06"]
}
```

### Migrationspfad

Dies ist eine **rückwärtskompatible** Änderung:
1. Bestehende Karten behalten das flache Array (weiterhin gültig)
2. Neue Karten verwenden das strukturierte Format
3. Die Schema-Validierung akzeptiert beide Formate
4. Bestehende Karten werden schrittweise migriert, sobald sie überprüft werden

> [!TIP]
> **Validieren Sie mit einem Skript.** Fügen Sie ein `validate-citations.mjs`-Skript hinzu, das:
> - prüft, ob jede Karte mindestens `classification`- und `vitality`-Quellen aufweist
> - Karten mit flachen `dataSources`-Arrays zur Aufwertung markiert
> - bei `methodSupport`-Einträgen ohne datumsgestempelte Verifizierung warnt

---

## 5. Qualitäts-Checkliste

Verifizieren Sie vor dem Mergen jeder Änderung an einer Sprachkarte:

- [ ] Jede Sprecherzahl verfügt über eine Quelle (Zensus oder Ethnologue, nicht Wikipedia)
- [ ] Jeder UNESCO-/EGIDS-Status verfügt über eine Quelle
- [ ] Jede Markierung der Methodenunterstützung wurde gegen die tatsächliche API verifiziert (nicht angenommen)
- [ ] Jeder Kontakteinfluss verfügt über eine veröffentlichte akademische Quelle ODER ist mit `citation_needed` gekennzeichnet
- [ ] Die Klassifikation wurde automatisch aus Glottolog befüllt (nicht von Hand erstellt)
- [ ] `dataSources` listet ALLE konsultierten Quellen auf
- [ ] Keine Aussage beruht ausschließlich auf LLM-generiertem Wissen
- [ ] `humanReviewed` ist auf die Kennung und das Datum des Prüfers gesetzt, falls ein Muttersprachler die Karte überprüft hat

---

## 6. Feld `humanReviewed`

Das Schema der Sprachkarte enthält ein Feld `humanReviewed`, das derzeit auf allen Karten `null` ist. Dieses Feld sollte befüllt werden, wenn ein Muttersprachler oder qualifizierter Linguist die Karte überprüft:

```json
"humanReviewed": {
  "reviewer": "Prof. Kenneth Jamandre",
  "affiliation": "University of the Philippines",
  "date": "2026-06-08",
  "scope": "full",
  "notes": "Verified speaker count, vitality assessment, and contact influences."
}
```

> [!IMPORTANT]
> **Die Überprüfung durch die Gemeinschaft ist der Goldstandard.** Automatisierte Daten und akademische Arbeiten bilden die Grundlage, doch die Überprüfung durch einen Muttersprachler ist die endgültige Validierung. Dies ist besonders entscheidend für:
> - Aussagen zu Kontakteinflüssen (Mitglieder der Gemeinschaft wissen, welche Lehnwörter tatsächlich verwendet werden)
> - Vitalitätsbewertungen (Mitglieder der Gemeinschaft wissen, ob Kinder die Sprache sprechen)
> - Höflichkeitssysteme (akademische Beschreibungen übersehen möglicherweise alltägliche Verwendungsmuster)

---

## 7. Referenzen für dieses Verfahren

1. Glottolog: https://glottolog.org — CC-BY 4.0
2. ISO 639-3: https://iso639-3.sil.org — Frei
3. WALS: https://wals.info — CC-BY 4.0
4. CLDR: https://cldr.unicode.org — Unicode Terms of Use
5. Ethnologue: https://www.ethnologue.com — Proprietär (Abonnement)
6. UNESCO Atlas: http://www.unesco.org/languages-atlas/ — Frei
7. Simons et al. (2022): https://aclanthology.org/2022.coling-1.379/
8. Champollion Language Card Spec: `cli/website/docs/reference/language-card-spec.md`
