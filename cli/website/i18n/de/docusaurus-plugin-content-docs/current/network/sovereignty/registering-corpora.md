---
sidebar_position: 8
title: "Registrierung von Korpora und Exposure-Lanes"
slug: /network/sovereignty/registering-corpora
description: "Registrieren Sie einen Evaluationskorpus, ohne ihn abzutreten. Die vier Freigabestufen – local-only, private, public und sealed –, die parallel dazu verlaufenden Lizenzpfade und wie fetch-from-source dafür sorgt, dass Korpusinhalte nicht in unsere Hände gelangen."
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

> **Zusammenfassung.** Sie können ein Evaluierungskorpus beim Netzwerk registrieren,
> damit Methoden daran gebenchmarkt werden können, **ohne uns die Daten zu übergeben**. Jedes
> Korpus wird als SHA-gepinnte *Metadaten-Karte* registriert, nicht als Inhalt – die eigentlichen
> Sätze werden zum Evaluierungszeitpunkt von ihrer Quelle abgerufen. Bei der Registrierung
> treffen Sie zwei unabhängige Entscheidungen: eine **Freigabestufe** (*exposure tier*) – wie viel Ihre
> Maschine verlässt (`local-only`, `private`, `public` oder `sealed`, wobei das Korpus
> auf Ihrem Gerät unter einem M-von-N-Verwahrerschlüssel verschlüsselt wird) – und einen **Lizenzpfad**
> (*license lane*), der regelt, wofür das Korpus verwendet werden darf (öffentlich, rein nicht-kommerzielle
> Forschung oder privat). Dies ist der Mechanismus, der es einer Gemeinschaft ermöglicht,
> ihre Sprache *messbar* zu machen, ohne sie *extrahierbar* zu machen.

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

Die Registrierung stellt Ihnen zwei unabhängige Fragen, und es lohnt sich, sie
auseinanderzuhalten, da sie unterschiedliche Dinge schützen:

1. **Was Ihre Maschine verlässt** – die *Freigabestufe*.
2. **Wofür Ihr Korpus verwendet werden darf** – der *Lizenzpfad*.

Ein Korpus kann versiegelt und nicht-kommerziell sein oder öffentlich und kommerziell freigegeben, oder
jede andere Kombination. Das eine impliziert nicht das andere.

### 2a. Freigabestufen – was Ihre Maschine verlässt

Vier Stufen, definiert in `cli/lib/corpus-registration.mjs`. **Klartext-Korpusinhalte
werden in keiner von ihnen hochgeladen** – das ist keine Richtlinieneinstellung, sondern
gilt für jede Stufe. Die Registrierung verwendet standardmäßig immer die privateste.

| Stufe | Registriert? | Was wir empfangen | Karte nachverfolgt |
|---|:---:|---|:---:|
| **Privat / nur lokal** | ❌ | Nichts. Karte und Text verbleiben auf Ihrer Maschine. **Der Standard.** | ❌ |
| **Privat registrieren** | ✅ | Nur Metadaten – ein geheimes Held-out-Set im WMT-Stil. Sie behalten die Verwahrung; Ergebnisse können veröffentlicht werden, ohne die Daten offenzulegen. | ✅ |
| **Öffentlich registrieren** | ✅ | Metadaten + ein Zeiger zum Abrufen von der Quelle. Ihr Text wird bei Bedarf von Upstream abgerufen, niemals hier gehostet. Erfordert eine für die Weiterverbreitung freigegebene Lizenz. | ✅ |
| **Versiegelt** | ✅ | Eine inhaltsfreie Karte. Der Geheimtext verbleibt bei Ihnen. | ✅ |

#### Ein Testset von jedem externen KI-Dienst fernhalten

Ihren Text nicht hochzuladen, ist eine Garantie. Ihn während der
Evaluierung nicht an eine Modell-API zu *senden*, ist eine andere, und das ist
besonders wichtig für ein Testset, das sensible Formulierungen enthält.
Markieren Sie die Datei als nur lokal, indem Sie eine kleine Datei daneben
platzieren, die nach ihr benannt ist und um `.champollion.json` ergänzt wird:

```bash
# data/nurse_checked_test.tsv  →  data/nurse_checked_test.tsv.champollion.json
echo '{"transmission": "local-only"}' > data/nurse_checked_test.tsv.champollion.json
```

Dies funktioniert für jedes Korpusformat (TSV, JSONL, Klartextpaare, JSON). Ab
diesem Zeitpunkt behandelt `mt-eval run` das Korpus als versiegelt:
- bei einem Remote-Anbieter (OpenRouter, OpenAI, Anthropic, Gemini) wird der Durchlauf
  **verweigert, bevor Text gesendet wird** und bevor ein API-Schlüssel abgefragt wird;
- wenn `--provider local` auf ein Modell auf dieser Maschine verweist (eine Loopback-Adresse
  wie `http://localhost:11434/v1`), wird der Durchlauf fortgesetzt;
- bei `--method local-model -m <model>` (ein NLLB-, OPUS-MT- oder MADLAD-Modell,
  das das Harness in seinem eigenen Prozess lädt; `-m` ist erforderlich), wird der Durchlauf fortgesetzt:
  Kein Satz verlässt die
  Maschine, und das Herunterladen der Gewichte überträgt Modelldateien, niemals Ihren Text;
- bei einer MT-Engine oder einem Methoden-Plugin (`--method <plugin dir>`) wird der Durchlauf
  verweigert, es sei denn, Sie bestätigen, dass dessen Übertragung vollständig lokal erfolgt
  (`--attest-local-transport`, protokolliert im Ausführungsprotokoll): Das Harness kann
  nicht sehen, wohin ein Plugin oder ein Dienst Text sendet;
- die sprachspezifischen Evaluierungsmetriken aus der Sprachkarte werden **nicht
  geladen**. Sie stammen aus separaten Paketen, die Wörter bei einem externen
  Dienst nachschlagen können, wie etwa einem Online-Wörterbuch. Der Durchlauf wird ohne
  sie bewertet, und die Ausführungskarte gibt an, dass sie zurückgehalten wurden und warum;
- `mt-eval publish` hält die Sätze zurück und ersetzt standardmäßig einen
  Coaching- oder benutzerdefinierten Prompt durch dessen SHA-256-Hash, sodass Prompt-Beispiele, die aus
  Ihren eigenen Sätzen stammen, ebenfalls auf dieser Maschine bleiben. Einige Metadaten über das Korpus
  werden jedoch zusammen mit dem Score öffentlich gemacht: seine ID, Version, das Sprachpaar, die Größe, der
  SHA-256-Hash der Datei, seine Lizenz und Namensnennung, sein Kontaminationsgrad, dass
  es als nur lokal markiert ist, und seine Segmentnamen. Für eine ID, die kein
  registrierter Datensatz ist, erstellt die Veröffentlichung außerdem eine öffentliche `datasets`-Zeile mit
  derselben ID, demselben Paar, derselben Größe und demselben SHA-256-Hash sowie dessen Domäne, Segmentnamen und
  Schwierigkeitsbereich. Die Vorschau von `--dry-run` listet diese für Ihren Durchlauf auf, neben
  dem, was hier verbleibt: jeder Satz, die Datei und ihr Pfad. Andere sehen dann einen
  Score für ein Testset, das sie nicht öffnen können. Es ist selbst-gebenchmarkt, niemand sonst
  kann es erneut ausführen, und der SHA-256-Hash erlaubt es nur jemandem, der dieselbe Datei
  besitzt, zu bestätigen, dass es sich um diese Datei handelt;
- die Ausgaben der Tools lassen die Sätze aus, da ein KI-Agent, der
  das Terminal liest, das Gelesene an seinen Modellanbieter weiterleitet. `mt-eval compare`
  zeigt Eintrags-IDs und Scores anstelle der Sätze, und eine Fehlermeldung,
  die einen Satz zitiert, wird unter Entfernung desselben ausgegeben. `--show-text` gibt sie für
  eine Person am Terminal aus. Dateien, die in Ihren Ergebnisordner geschrieben werden, behalten den
  Text, und jede trägt die Markierung des Korpus: Jedes Ausführungsprotokoll, jeder Bericht,
  jede Vergleichsdatei und jedes Dashboard, das das Harness aus dem Korpus schreibt, erhält sein
  eigenes `.champollion.json` mit denselben Bedingungen plus `derived_from`. Das nächste
  Tool oder ein späterer Durchlauf auf dieser Datei behandelt sie dann ebenfalls als geschützt. Das
  Terminal nennt jede Datei, die den Text enthält;
- der Übersetzungscache hält die Einträge dieses Korpus getrennt: unter
  `<cache-dir>/protected/<namespace>/` (standardmäßig
  `eval/cache/harness/protected/…`), in einem Namensraum, der durch die Einstellungen
  des Durchlaufs, den SHA-256-Hash des Korpus und dessen Bedingungen geschlüsselt ist, sodass ein Eintrag immer nur
  für einen Durchlauf desselben Korpus bereitgestellt wird – niemals für einen Durchlauf eines anderen oder eines
  unmarkierten Korpus. Jede Cache-Datei dort trägt dieselbe `.champollion.json`-Markierung.
  (Einträge, die vor der Existenz dieses Schutzes zwischengespeichert wurden, befinden sich unmarkiert im regulären
  Cache; löschen Sie `eval/cache/harness/` einmalig, um sie zu entfernen.)

Die Markierung kann ein Korpus nur strenger machen. Keine Lizenz und kein
`--allow-data-collection`-Flag kann sie lockern. Wenn die Markerdatei
unlesbar ist, bricht der Durchlauf ab, anstatt sie zu ignorieren.

**Versiegelt ist die stärkste Garantie, die das System bietet.** Ihr Korpus wird
**auf Ihrem Gerät** mit dem Schlüssel der Verwahrergruppe verschlüsselt, und der Geheimtext
verbleibt auf Ihrer Maschine oder Ihrem Evaluierungsknoten. Champollion empfängt nur die
inhaltsfreie Karte. Auf dem Offline-Knoten ist der Schlüssel aufgeteilt, sodass es
**M von N** Verwahrern gemeinsam bedarf, um einen Durchlauf zu autorisieren; diese Zeremonie ist implementiert,
wurde jedoch noch nicht mit echten Verwahrern genutzt. Versiegelte Sets werden katalogisiert, aber unter Quarantäne gestellt, und sind mit
einem öffentlichen *Qualifier*-Korpus gepaart, das eine Methode bestehen muss, bevor ein versiegelter Durchlauf
überhaupt vorgeschlagen werden kann. Siehe [Einen souveränen Wettbewerb durchführen](/docs/network/sovereignty/run-a-sovereign-contest) und den [Souveränen Evaluierungsknoten](/docs/network/sovereignty/sovereign-eval-node).

### 2b. Lizenzpfade – wofür das Korpus verwendet werden darf

Unabhängig davon regelt die Lizenz, wo Ergebnisse erscheinen dürfen.

#### Öffentlich

Ein offen lizenziertes Korpus (z. B. CC0, CC-BY), dessen Referenzen auf öffentlichen
Oberflächen erscheinen dürfen und dessen Läufe im öffentlichen Leaderboard erscheinen dürfen. Der Inhalt wird weiterhin
von der Quelle abgerufen — „öffentlich“ regelt die *Exposition von Referenzen und Rankings*, nicht
das Hosting. Der größte Teil des Katalogs (Tatoeba, GlobalVoices, TICO-19, IN22, SMOL, ALT,
Turkic-x-WMT, WMT24++) befindet sich in diesem Pfad.

#### Rein nicht-kommerzielle Forschung

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

| Lizenzpfad | Benchmarkbar | Referenzen öffentlich sichtbar | Kann auf öffentlicher Bestenliste rangieren | Im kommerziellen / Preis- / API-Pfad |
|------|:---:|:---:|:---:|:---:|
| **Öffentlich** | ✅ | ✅ | ✅ | ✅ (sofern Lizenz es erlaubt) |
| **Rein nicht-kommerzielle Forschung** | ✅ | abhängig von Lizenz | nur im Forschungspfad | ❌ |
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

### Die Karten-ID

`champollion register-corpus` schreibt die Karte für Sie und weist ihr eine ID der
Form `eval-<source>-<target>-<name>[-<role>]-v1` zu:

- **name** stammt aus `--name`: „Ward phrases“ wird zu `ward-phrases`. Der
  Herausgeber wird nur verwendet, wenn der Name keine Zeichen von a–z oder 0–9 enthält, zum
  Beispiel ein Name, der ausschließlich in Silbenschrift geschrieben ist.
- **role** gibt an, wofür das Set gedacht ist: `--role test`, `--role dev` oder
  `--role train`. Sie erscheint nur dann in der ID, wenn Sie sie übergeben. Das Tool rät
  niemals eine Rolle; ein Held-out-Testset wird also nur dann als Testset bezeichnet, wenn Sie
  dies explizit angeben.

```bash
champollion register-corpus --yes --name "Ward phrases" --pair "eng>xyz" \
  --license proprietary --tier private --role test --size 120 --domain medical
```

Dies registriert `eval-eng-xyz-ward-phrases-test-v1`. Um die ID
selbst zu wählen, übergeben Sie `--id eval-…`; sie wird exakt wie angegeben verwendet.

### Welche Lizenz-ID für ein privates Testset

`--license` erfasst die Bedingungen, die die Eigentümer der Daten tatsächlich gewähren. Es
ist kein Platzhalter, und das Tool wählt keinen für Sie aus. Fragen Sie sie
zuerst (die Familien, das medizinische Personal, die Datenverwalter der Gemeinschaft) und wählen
Sie dann die ID, die dem entspricht, was sie festgelegt haben:

| Was die Eigentümer gewähren | `--license` |
|---|---|
| Sie veröffentlichen den Text bereits unter einer Standardlizenz | deren SPDX-ID, zum Beispiel `CC-BY-NC-4.0` |
| Nur zum Bewerten von Systemen nutzen: niemals darauf trainieren, niemals weiterverbreiten, keine kostenpflichtige Bewertung | `community-eval-grant-nc` (`LicenseRef-Champollion-Eval-Grant-NC`) |
| Dasselbe, aber die Bewertung für zahlende Nutzer ist gestattet | `community-eval-grant` (`LicenseRef-Champollion-Eval-Grant`) |
| Keine Einräumung über die eigene Nutzung hinaus: alle Rechte vorbehalten | `proprietary` (`LicenseRef-Proprietary`) |
| Eigene Bedingungen, die keine dieser Optionen abdeckt | `LicenseRef-<a name for their terms>`, unverändert eingegeben, wobei die Bedingungen dort schriftlich festgehalten sind, wo der Datenverwalter sie aufbewahrt |

Jede `LicenseRef-…`-ID in der Tabelle (einschließlich der beiden Evaluierungsfreigaben und
`proprietary`) ist eine maßgeschneiderte Vereinbarung: Champollion liest sie niemals im
Namen der Eigentümer. Eine Remote-Evaluierung dagegen wird verweigert, bis der Verwalter
seine Erlaubnis protokolliert, sodass nur Modelle auf Ihrer eigenen Maschine dagegen
getestet werden. Wenn Sie unsicher sind, ist die konservativste Wahl, die Ihnen dennoch Messungen
ermöglicht, `community-eval-grant-nc`; halten Sie diese als vorläufig fest und
lassen Sie sie vom Datenverwalter bestätigen oder die richtige benennen.

Die Lizenz ändert nichts daran, wohin die Sätze gelangen. Ein rein lokales Set (der
`.champollion.json`-Marker oder `--tier local-only`) verbleibt auf Ihrer Maschine,
unabhängig davon, was seine Lizenz besagt: Der Marker verweigert jedes Remote-Modell, und eine
Lizenz kann dies niemals aufweichen. Die Lizenz regelt, was andere mit
dem Set tun dürfen, falls es jemals geteilt wird, und welche Evaluierungspfade es betreten darf. Sobald eine Datei
mit `--data` registriert wurde, wird ihre ID in der
`.champollion.json`-Datei daneben festgehalten und ändert sich nie. Eine erneute Registrierung dieser Datei
bricht ab und fordert Sie auf, die ID mit `--id` zu übergeben.

Für ein Testset, an dem ein Modell trainiert werden darf (`--role test` oder ein
rein lokales oder privates Set ohne Rolle), gibt der Befehl anschließend die
nmt-forge-Schritte aus, die vor dem ersten Score des Sets erfolgen müssen: registrieren Sie es,
prüfen Sie Ihr Trainingskorpus dagegen ab (*screen*) und zeichnen Sie Ihre Vorhersagen auf.
Die Baseline `mt-eval run` folgt danach. Ein Benchmark ist ein bewertender Lesevorgang,
und nmt-forge verweigert Vorhersagen, die danach verfasst wurden.

`mt-eval run --corpus <that file>` findet die Karte über dieselbe
`.champollion.json`-Datei. Die Datensatz-ID des Durchlaufs entspricht der ID der Karte, sodass jeder Durchlauf
auf dem Set denselben Namen trägt und der Dateiname auf dem Durchlauf als dessen
Korpuspfad erhalten bleibt. Der Kontaminationsgrad der Karte wird so gemeldet, wie die Karte ihn
angibt. Beides gilt nur, solange die Datei diejenige ist, die Sie registriert haben: Wenn sie sich
seitdem geändert hat, weist der Durchlauf darauf hin und verwendet keines von beidem.

Eine `local-only`-, `private`- oder `sealed`-Karte gibt an, dass ihr Text unveröffentlicht ist
(`Contamination: NONE`), daher vergleicht die Registrierung die von Ihnen übergebene Datei
zunächst über `--data` (oder `--seal-input`) mit den öffentlichen Korpora. Ein Repository-Checkout
vergleicht sie mit den Korpus-Karten, die er enthält. Eine npm-Installation, die
keine Korpus-Karten mitliefert, vergleicht sie mit dem öffentlichen Korpus-Katalog: Das CLI
lädt die IDs und Prüfsummen der öffentlichen Korpora herunter und vergleicht sie auf Ihrer
Maschine, sodass die Prüfsumme Ihrer Datei diese niemals verlässt. Wenn die Datei Byte für
Byte einem öffentlichen Korpus entspricht (gleicher SHA-256-Hash), stoppt die Registrierung und nennt dieses Korpus.
Registrieren Sie es als öffentlich, verwenden Sie Sätze, die tatsächlich privat sind, oder behalten Sie die
Stufe bei und geben Sie die Offenlegung mit `--contamination` an (die Karte erfasst dann,
dass der Text öffentlich ist). Ein versiegeltes Set aus öffentlichem Text wird abgewiesen: Es würde
nichts testen.

Wenn kein Vergleich durchgeführt werden kann (Sie sind offline oder der Katalog kann nicht
erreicht werden), wird die Karte als `Contamination: UNCHECKED` eingestuft, nicht als `NONE`, es sei denn,
Sie geben mit `--contamination` selbst eine Einstufung an. Registrieren Sie sie online erneut, um
sie zu vergleichen. `mt-eval` behandelt ein `UNCHECKED`-Korpus wie jedes Korpus, das
nicht mit `LOW` eingestuft ist: Seine Scores wandern in den Nur-Relativvergleichs-Pfad. Die
Prüfung vergleicht ganze Dateien; ein öffentliches Set, das bearbeitet oder neu formatiert wurde, wird daher
nicht erkannt; `mt-eval contest prepare` vergleicht Zeilen.
