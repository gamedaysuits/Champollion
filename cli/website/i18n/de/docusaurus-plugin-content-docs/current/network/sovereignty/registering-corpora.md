---
sidebar_position: 8
title: "Registrierung von Korpora und Exposure-Lanes"
slug: /network/sovereignty/registering-corpora
description: "Registrieren Sie ein Evaluierungskorpus, ohne es aus der Hand zu geben. Die vier Freigabestufen – nur lokal, privat, öffentlich und versiegelt –, die damit einhergehenden Lizenzpfade und wie „fetch-from-source“ dafür sorgt, dass Korpusinhalte nicht in unsere Hände gelangen."
related:
  - label: "Data Stewardship"
    to: /docs/network/sovereignty/data-sovereignty
    kind: doc
    note: "The position these mechanics implement"
  - label: "Ownership & Terms"
    to: /docs/network/sovereignty/ownership-transfer
    kind: doc
  - label: "Evaluation Datasets"
    to: /docs/network/leaderboard/datasets
    kind: doc
    note: "The catalogue these lanes apply to"
  - label: "Corpus Design Framework"
    to: /docs/network/specifications/corpus-design
    kind: spec
---

# Registrierung von Korpora & Expositionspfaden

> **Zusammenfassung.** Sie können ein Evaluierungskorpus beim Netzwerk registrieren, damit Methoden daran gemessen werden können, **ohne uns die Daten zu übergeben**. Jedes Korpus wird als SHA-gepinnte *Metadaten-Karte* registriert, nicht als Inhalt — die tatsächlichen Sätze werden zur Evaluierungszeit von ihrer Quelle abgerufen. Wenn Sie sich registrieren, treffen Sie zwei unabhängige Entscheidungen: eine **Expositionsstufe** — wie viel Ihre Maschine verlässt (`local-only`, `private`, `public` oder `sealed`, wobei das Korpus auf Ihrem Gerät unter einem M-von-N-Treuhänderschlüssel verschlüsselt wird) — und eine **Lizenzspur**, die regelt, wofür das Korpus verwendet werden darf (öffentlich, nur für nicht-kommerzielle Forschung oder privat). Dies ist der Mechanismus, der es einer Gemeinschaft ermöglicht, ihre Sprache *messbar* zu machen, ohne sie *extrahierbar* zu machen.

Die Evaluierung maschineller Übersetzungen verlangt üblicherweise das Gegenteil von Datensouveränität:
„Laden Sie Ihr Testset hoch, damit wir dagegen bewerten können.“ Das ist ein absolutes Ausschlusskriterium für
indigene Sprachen und andere von Gemeinschaften gehaltene Korpora, bei denen die Daten den
Menschen gehören, von denen sie stammen. Das Network ist so konzipiert, dass Sie diesen Kompromiss niemals eingehen müssen.

---

## 1. Registrierung bedeutet Metadaten, nicht Inhalt {#1-registration-is-metadata-not-content}

Ein registriertes Korpus ist eine **Karte**: ein kleiner JSON-Datensatz, der beschreibt, *wo* das
Korpus liegt und *was es ist*, mit einem Inhalts-Hash, sodass die exakten Bytes
verifiziert werden können — aber **ohne Sätze**. Eine Karte enthält:

| Feld | Was es ist |
|-------|-----------|
| `url` | Woher das Korpus abgerufen wird (das vorgelagerte Archiv, das Sie kontrollieren) |
| `sha256` | Inhalts-Hash des fixierten Archivs — beweist, dass niemand die Daten ausgetauscht hat |
| `license` | SPDX-Kennung (oder `LicenseRef-…` für eine maßgeschneiderte Lizenz) |
| `language_pair` | Quelle → Ziel, z. B. `eng-crk` |
| `do_not_train` | Immer gesetzt — Evaluierungsdaten dürfen niemals zum Training verwendet werden |
| `attribution` | Die Nennung des Erstellers/Linguisten, die überall dort angezeigt wird, wo das Korpus erscheint |

Zum Zeitpunkt der Evaluierung **ruft das Harness von der Quelle ab**, verifiziert den `sha256`
und bewertet gegen die frisch abgerufenen Referenzen. Das Network speichert, hostet
oder verteilt den Korpusinhalt niemals. Wenn Sie das vorgelagerte Archiv offline nehmen,
ist das Korpus einfach nicht mehr ausführbar — die Kontrolle bleibt bei Ihnen. Dies ist dieselbe
Fetch-from-Source-Disziplin, die auf den gesamten Katalog angewendet wird (siehe
[Evaluierungsdatensätze](/docs/network/leaderboard/datasets)).

:::info[Warum ein Hash statt einer Kopie]
Ein Content-Hash ermöglicht es, eine selbstgemeldete Bewertung gegen das reale,
unveränderte Korpus **erneut zu überprüfen**, ohne dass wir dieses Korpus jemals
selbst besitzen. Ein Durchlauf, dessen Zahlen sich nicht gegen die per Hash
fixierte Quelle reproduzieren lassen, wird abgelehnt. Verifizierbarkeit und
Nichtbesitz stehen hier nicht im Widerspruch — der Hash ist das, was beides
möglich macht.
:::

---

## 2. Zwei separate Entscheidungen

Die Registrierung stellt Ihnen zwei unabhängige Fragen, und es lohnt sich, diese getrennt zu betrachten, da sie unterschiedliche Dinge schützen:

1. **Was Ihre Maschine verlässt** — die *Expositionsstufe*.
2. **Wofür Ihr Korpus verwendet werden darf** — die *Lizenzspur*.

Ein Korpus kann versiegelt und nicht-kommerziell sein, oder öffentlich und kommerziell freigegeben, oder jede andere Kombination. Das eine setzt das andere nicht voraus.

### 2a. Expositionsstufen — was Ihre Maschine verlässt

Vier Stufen, definiert in `cli/lib/corpus-registration.mjs`. **Der Klartext-Inhalt des Korpus wird in keiner von ihnen jemals hochgeladen** — das ist keine Richtlinieneinstellung, sondern gilt für jede Stufe. Die Registrierung ist standardmäßig immer auf die privateste Stufe eingestellt.

| Stufe | Registriert? | Was wir erhalten | Karte erfasst |
|---|:---:|---|:---:|
| **Privat / nur lokal** | ❌ | Nichts. Karte und Text bleiben auf Ihrer Maschine. **Der Standard.** | ❌ |
| **Privat registrieren** | ✅ | Nur Metadaten — ein geheimes Held-out-Set im WMT-Stil. Sie behalten die Verwahrung; Ergebnisse können veröffentlicht werden, ohne die Daten preiszugeben. | ✅ |
| **Öffentlich registrieren** | ✅ | Metadaten + ein Zeiger zum Abruf von der Quelle. Ihr Text wird bei Bedarf von Upstream abgerufen und niemals hier gehostet. Erfordert eine für die Weiterverbreitung freigegebene Lizenz. | ✅ |
| **Versiegelt** | ✅ | Chiffretext + eine inhaltsfreie Karte. Sonst nichts. | ✅ |

**Versiegelt ist die stärkste Garantie, die das System bietet.** Ihr Korpus wird **auf Ihrem Gerät** unter dem Schwellenwertschlüssel der Treuhändergruppe verschlüsselt, bevor auch nur ein einziges Byte es verlässt. Champollion empfängt den Chiffretext und kann ihn nicht entschlüsseln — und das kann auch kein einzelner Treuhänder: Es bedarf **M von N** von ihnen zusammen, um einen Durchlauf zu autorisieren. Versiegelte Sets werden katalogisiert, aber unter Quarantäne gestellt, und sind mit einem öffentlichen *Qualifikations*-Korpus gekoppelt, das eine Methode erfolgreich durchlaufen muss, bevor ein versiegelter Durchlauf überhaupt vorgeschlagen werden kann. Siehe [Einen souveränen Wettbewerb durchführen](/docs/network/sovereignty/run-a-sovereign-contest) und den [Souveränen Evaluierungsknoten](/docs/network/sovereignty/sovereign-eval-node).

### 2b. Lizenzspuren — wofür das Korpus verwendet werden darf

Unabhängig davon regelt die Lizenz, wo Ergebnisse erscheinen dürfen.

#### Öffentlich

Ein offen lizenziertes Korpus (z. B. CC0, CC-BY), dessen Referenzen auf öffentlichen
Oberflächen erscheinen dürfen und dessen Läufe im öffentlichen Leaderboard erscheinen dürfen. Der Inhalt wird weiterhin
von der Quelle abgerufen — „öffentlich“ regelt die *Exposition von Referenzen und Rankings*, nicht
das Hosting. Der größte Teil des Katalogs (Tatoeba, GlobalVoices, TICO-19, IN22, SMOL, ALT,
Turkic-x-WMT, WMT24++) befindet sich in diesem Pfad.

#### Nur für nicht-kommerzielle Forschung

Ein Korpus unter einer nicht-kommerziellen Lizenz (z. B. CC BY-NC-SA oder eine maßgeschneiderte
Community-/NGO-Lizenz wie das `LicenseRef-TWB-Gamayun` der Gamayun-Kits). Es kann
**für Forschungszwecke als Benchmark genutzt werden** — Methoden werden darauf ausgeführt, Bewertungen werden berechnet —
aber es ist **aus jedem kommerziellen, Preis- und API-Pfad ausgeschlossen.** Die Eignung ist
**nutzungsbasiert**, nicht korpusbasiert:

- der **kommerzielle Pfad ist streng** — alles, was nicht eindeutig kommerziell lizenziert ist, wird
  ausgeschlossen;
- der **Forschungspfad ist nachsichtig** — nicht-kommerzielle Korpora sind willkommen;
- **Quarantäne gewinnt immer** — ein als unzulässige Teilmenge markiertes (oder
  anderweitig gesperrtes) Korpus kann niemals in *irgendeinem* Pfad erscheinen, unabhängig von der Lizenz.

So kann eine Gemeinschaft ihr Korpus den Forschungsfortschritt vorantreiben lassen und es dabei
aus dem Produkt aller Beteiligten heraushalten.

#### Privat

Ein Korpus, das für **Ihre eigenen bewerteten Läufe** registriert wird, wobei die Referenzen niemals
veröffentlicht werden. Sie halten die Quelle; Sie führen die Evaluierung durch; Sie entscheiden, was, falls
überhaupt, jemals angezeigt wird. Ein privates Korpus kann später öffentlich oder nicht-kommerziell
gemacht werden — die Exposition *lockert* sich nur durch eine ausdrückliche, vom Eigentümer getriebene Entscheidung, niemals
stillschweigend.

| Lizenzspur | Benchmarkfähig | Referenzen öffentlich sichtbar | Darf auf öffentlicher Rangliste ranken | Im kommerziellen / Preis- / API-Pfad |
|------|:---:|:---:|:---:|:---:|
| **Öffentlich** | ✅ | ✅ | ✅ | ✅ (wenn die Lizenz es erlaubt) |
| **Nur für nicht-kommerzielle Forschung** | ✅ | abhängig von der Lizenz | nur in der Forschungsspur | ❌ |
| **Privat** | ✅ (Ihre Durchläufe) | ❌ | ❌ | ❌ |

:::note[Die kommerzielle Lane ist ein Schutzmechanismus, kein Geschäft]
Champollion selbst ist nicht-kommerziell — es gibt keine kostenpflichtige API
und kein Produkt hinter all dem. Die kommerzielle Lane bzw. Prämien-Lane
existiert als *vorausschauender* Schutzmechanismus: Sie erfasst mechanisch,
welche Korpora jemals rechtmäßig in einem Prämien- oder kommerziellen Kontext
erscheinen könnten, sodass keine künftige Nutzung — durch wen auch immer —
über eine Lizenz oder die Bedingungen eines Verwalters hinausgehen kann.
:::

---

## 3. Souveränitätsgarantien

Die Registrierung ist um die [Position zur Datenverwaltung](/docs/network/sovereignty/data-sovereignty) herum konzipiert.
Konkret:

- **Der Besitz bleibt bei der Quelle.** Wir halten einen Hash und eine URL, nicht die Daten.
- **Die Kontrolle liegt beim Eigentümer.** Der Pfad ist die Wahl des Eigentümers, und die Exposition lockert sich
  nur durch eine ausdrückliche Entscheidung. Das Zurückziehen des vorgelagerten Archivs widerruft die Ausführbarkeit.
- **Nicht-kommerziell bedeutet nicht-kommerziell.** NC-Korpora werden mechanisch aus
  kommerziellen, Preis- und API-Pfaden ausgeschlossen — nicht durch ein Versprechen, sondern durch ein Gatter.
- **Unzulässige Teilmengen können niemals erscheinen.** Quarantäne setzt sich über die Lizenz hinweg, sodass ein
  vom Ranking gesperrtes Korpus überall gesperrt bleibt.
- **Die Nennung ist verpflichtend.** Die Nennung des Erstellers/Linguisten reist mit der Karte
  zu jeder Oberfläche, auf der das Korpus erscheint.

Wie sprachspezifische Bedingungen festgelegt werden — einschließlich der Übertragung des Methodeneigentums für
gesponserte Preise — siehe [Eigentum & Bedingungen](/docs/network/sovereignty/ownership-transfer).

---

## 4. Wie man registriert

Das Korpuskarten-Schema und die Build-/Verifizierungswerkzeuge sind im
[Corpus Design Framework](/docs/network/specifications/corpus-design) und im
[Corpus-Creation-Kochbuch](/docs/network/tutorials/corpus-creation) dokumentiert. Kurz gesagt:

1. Hosten Sie das Korpusarchiv an einem Ort, den Sie kontrollieren (es bleibt dort — es wird niemals
   in das Network kopiert).
2. Schreiben Sie eine Karte: `url`, `sha256`, `license`, `language_pair`, `attribution`,
   `do_not_train`.
3. Wählen Sie den Expositionspfad (öffentlich / nicht-kommerziell / privat).
4. Registrieren Sie die Karte. Methoden können nun gegen das Korpus als Benchmark getestet werden,
   indem sie von der Quelle abgerufen werden, gemäß den Regeln des Pfads.

Sie laden die Sätze niemals hoch. Sie können jederzeit aufhören.
