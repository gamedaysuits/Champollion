---
sidebar_position: 8
title: "Die Selbstverpflichtung bezüglich abgeleiteter Artefakte"
description: "Wem gehören die Modelle, Translation Memories und Evaluierungsstandards, die aus den Sprachdaten der Gemeinschaft erstellt werden: nicht uns. Champollion ist eine Infrastruktur für Gemeinschaften, mit der sie ihre eigenen erstellen und besitzen können."
related:
  - label: "Data Stewardship"
    to: /docs/network/sovereignty/data-sovereignty
    kind: doc
    note: "The corpus-side position: data stays with its stewards"
  - label: "Ownership Transfer"
    to: /docs/network/sovereignty/ownership-transfer
    kind: doc
    note: "How infrastructure custody hands over to communities"
  - label: "For Language Communities"
    to: /docs/network/community/for-language-communities
    kind: doc
    note: "The ground rules, in plain language"
---

# Die Verpflichtung zu abgeleiteten Artefakten

Die Position zur [Datenverwaltung](/docs/network/sovereignty/data-sovereignty) (Data Stewardship) deckt die *Eingaben* ab: Korpora verbleiben bei ihren Verwaltern, wir hosten oder verteilen niemals Community-Daten weiter. Diese Seite behandelt die *Ausgaben* — die Dinge, die **aus** Sprachdaten **erstellt** werden: trainierte Modelle und deren Gewichte, Translation Memories, Fine-Tunes, Coaching-Sets, Evaluierungsstandards und Ausführungsartefakte.

Die Verpflichtung in einem Satz:

> **Wir erheben keinen Eigentumsanspruch auf Sprachmodelle oder aus Sprache abgeleitete Artefakte, die aus den Daten einer Community erstellt wurden — und wir haben auch nicht den Wunsch danach. Der eigentliche Zweck dieses Projekts besteht darin, die Kontrolle über diese Technologien auf Entwicklungs- und Eigentumsebene in die Hände der Sprecher zu legen.**

Champollion ist **Infrastruktur**. Einer Straße gehören nicht die Güter, die auf ihr transportiert werden.

## Was das konkret bedeutet

**Modelle gehören den Menschen, deren Sprache sie sprechen.** Wenn ein Modell mit den Daten einer Community trainiert wird — mit unseren Tools oder denen von anderen —, unterliegen die Gewichte, die Fine-Tunes und jedes Derivat den Bedingungen der Community, nicht unseren. Wir fertigen keine Kopien an, wir vergeben keine neuen Lizenzen und wir betrachten "wir haben das Trainingsskript geschrieben" nicht als Eigentumsanteil an dem, was es hervorgebracht hat. Die Lektion ist historisch, nicht hypothetisch: Sprachgemeinschaften mussten wiederholt mit ansehen, wie externe Organisationen ihre Sprache aufzeichneten, zusammenstellten oder damit trainierten und dann die Ergebnisse einbehielten — Urheberrechte an den Aufnahmen von Ältesten, Modelle, die mit gescrapten Sprachdaten trainiert wurden —, während die Sprecher selbst um Erlaubnis für ihre eigenen Stimmen bitten mussten. Genau dieses Fehlermuster soll durch diese Verpflichtung ausgeschlossen werden.

**Die Arbeit mit Plains Cree (nêhiyawêwin) ist der Testfall, und die Antwort steht bereits fest.** Nichts, was in diesem Projekt für Cree entwickelt wurde, gehört uns — weder der Trainingskorpus (der mit Erlaubnis seiner Inhaber verwendet und niemals weiterverteilt wird), noch die gecoachten Pipelines, noch irgendein trainiertes Modell. Jedes Cree-Modell, das in dieser Arbeit erstellt wird, wird **ausschließlich an eine anerkannte Autorität der Community** übergeben — eine Bildungsbehörde, einen Ältestenrat oder eine andere von der Community selbst benannte Einrichtung —, und zwar unter den eigenen Bedingungen der Community und an niemanden sonst. Es gibt keine Version hiervon, in der ein Cree-Modell als Produkt ausgeliefert wird. Die Evaluierungsarbeit für Cree ist ebenfalls **durchweg nicht-kommerziell**: Champollion pflegt höchstens die *generische* Evaluierungsmethodik (den LYSS-Standard — die Idee einer intensionalen, morphologiebewussten, fehler-ehrlichen Bewertung). Die **Cree-Instanziierung** dieses Standards — das linguistische Wissen, das er kodiert und gegen das er validiert — ist nicht unser Eigentum; eine kommerzielle Nutzung bleibt bis zur Konsultation mit der nêhiyaw-Sprachgemeinschaft vorbehalten, und es gelten die Bedingungen der Community.

**Bewertungen reisen; Artefakte nicht.** Das Leaderboard veröffentlicht *Messwerte* — einen chrF++-Wert, eine Validierungsrate, ein Konfidenzintervall — unter Angabe der Methode und des Korpus. Es veröffentlicht, hostet oder verlangt niemals das Modell selbst, den Korpusinhalt oder die Ausgaben über das hinaus, was die Bedingungen des Verwalters zulassen. Wenn eine Community möchte, dass die Zeile ihrer Sprache aus der öffentlichen Ansicht entfernt wird, existieren die [Registrierungswege](/docs/network/sovereignty/registering-corpora) genau aus dem Grund, damit die Sichtbarkeit in ihrer Hand liegt, nicht in unserer.

## Infrastruktur bedeutet: Ihre Daten, Ihr Build, Ihre Schlüssel

Drei konkrete Ausprägungen, wie "wir sind nur Infrastruktur" in der Praxis aussieht:

1. **Eine Community baut ihren eigenen Korpus auf.** Sie verwenden die CLI auf ihren eigenen Rechnern; der Korpus verbleibt dort, wo sie ihn ablegen. Wenn sie sich entscheiden, ihn für Benchmarking zu registrieren, speichert die Registry einen *Zeiger und eine Prüfsumme* — Abruf von der Quelle (Fetch-from-Source), unter ihrer Lizenz, auf Wunsch austragbar. Der Korpus gelangt niemals in unser Repository oder unseren Speicher. Dies wird durch Mechanismen erzwungen, die Sie überprüfen können: Das öffentliche Repo liefert die Quarantäne-Gates und Datenbank-Trigger mit, die das Hosten von Community-Inhalten strukturell unmöglich machen, nicht nur unhöflich.

2. **Eine Community trainiert ihr eigenes Modell.** Die Trainings-Suite ([nmt-forge](https://github.com/gamedaysuits/Champollion)) läuft auf ihrer Hardware; Checkpoints und Gewichte existieren nur dort. Das Evaluierungs-Harness bewertet es; das Board zeichnet die Bewertung auf. Wir besitzen das Modell zu keinem Zeitpunkt. Wenn sie es für immer privat halten wollen, bleibt es das — eine Bewertungszeile ist die einzige öffentliche Spur, und auch nur dann, wenn sie eine veröffentlichen.

3. **Eine Community führt ihren eigenen Benchmark durch.** Bei [souveränen Wettbewerben](/docs/network/sovereignty/run-a-sovereign-contest) bleibt das Testset auf der von der Community kontrollierten Infrastruktur versiegelt; die Methoden kommen *zu* den Daten; nur aggregierte Bewertungen verlassen sie. Die Community entscheidet, wer zu welchen Bedingungen evaluieren darf, und kann dies jederzeit beenden.

In jedem Fall ist die Bewegungsrichtung dieselbe: Die Fähigkeiten verlagern sich hin zur Community; Daten und ihre Derivate bewegen sich nicht von ihr weg.

## Die Frameworks, zu denen wir aufschauen

Wir sind **inspiriert von und streben nach** den indigenen Data-Governance-Frameworks, die die Communities selbst aufgebaut haben. Es steht uns nicht zu, uns selbst als konform mit einem von ihnen zu bezeichnen — dieses Urteil obliegt den Communities und Institutionen, die sie verfasst haben. Was wir tun können, ist, in ihre Richtung zu entwerfen, sie als Maßstabsetzer zu benennen und klar zu sagen, dass wir die Gelegenheit zutiefst schätzen würden, diesen Experten zuzuhören und mit ihnen zusammenzuarbeiten, um dieses System in ihrem Sinne zu verbessern:

- **Die Datensouveränitätsprinzipien der First Nations** — Eigentum, Kontrolle, Zugang und Besitz der eigenen Informationen einer Gemeinschaft: genau die vier Fähigkeiten, zu deren Verbleib in den Händen der Community sich diese Seite verpflichtet.
- **Die CARE-Prinzipien für indigene Data Governance** (Collective Benefit, Authority to Control, Responsibility, Ethics), von der Global Indigenous Data Alliance — das Korrektiv zu rein "offenen" Daten: Offenheit ist keine Tugend, wenn sie einem Volk die Autorität über sein eigenes Wissen entzieht.
- **Te Mana Raraunga**, die Charta des Māori Data Sovereignty Network — Daten als lebendiges Taonga (Schatz), mit Rechten und Pflichten, die damit einhergehen.
- **Die Kaitiakitanga-Lizenz** (Te Hiku Media) — unseres Wissens nach das klarste funktionierende Beispiel für die Souveränität abgeleiteter Artefakte in der Sprachtechnologie: Te Hiku hat Sprachmodelle *aus* und *für* te reo Māori entwickelt und lizenziert den Zugang unter Vormundschaftsbedingungen, sodass die Modelle den Māori zugutekommen und unter der Verwaltung der Māori bleiben. Wenn wir sagen "Modelle gehören den Sprechern", ist Te Hiku der Existenzbeweis, dass es funktioniert.
- **Das partizipative Forschungsmodell von Masakhane** — Afrikanisches NLP, das von Sprecher-Forschern als Mitautoren und Eigentümer anstatt als Datenquellen entwickelt wurde; der Beweis, dass der *Prozess* der Entwicklung von Sprachtechnologie selbst der Transfer von Fähigkeiten sein kann.

Dies sind unterschiedliche Frameworks von unterschiedlichen Völkern mit unterschiedlichen rechtlichen und kulturellen Positionen — wir nennen sie nebeneinander, anstatt sie unter einem Begriff zusammenzufassen. Wo unser Design ihrem Geist nicht gerecht wird, ist das ein Mangel, den es zu beheben gilt, und wir würden dies lieber von den Experten hören, als es in einer Post-Mortem-Analyse zu entdecken. Wenn Sie in diesem Bereich arbeiten und bereit sind, uns zu sagen, was wir falsch gemacht haben: **Dieses Gespräch ist der wertvollste Beitrag, den dieses Projekt erhalten kann.** Erreichen Sie uns über [Mitmachen](/get-involved).

## Was unser Eigentum ist

Zur Klarstellung, die Dinge, auf die Champollion *tatsächlich* Anspruch erhebt: der Infrastruktur-Code (CLI, Harness, Trainings-Suite — jeweils unter der veröffentlichten Lizenz), die generische Evaluierungsmethodik und die *abgeleiteten Messwerte* des Index (die eine `champollion-derived`-Provenienz tragen, genau damit sie niemals fälschlicherweise einer Community oder einer Upstream-Quelle zugeschrieben werden). Das ist der Werkzeugkasten. Was Sie damit bauen, gehört Ihnen.
