---
title: "Wer dies nutzen darf"
description: "Die Lizenz jedes Champollion-Pakets in einfachen Worten – wer abgedeckt ist und wer nicht. Eine Zusammenfassung, keine Rechtsberatung; maßgeblich ist der Lizenztext."
related:
  - label: "Installation"
    to: /docs/getting-started/installation
    kind: guide
  - label: "Quick Start"
    to: /docs/getting-started/quick-start
    kind: guide
---

# Wer dies nutzen darf

Die Pakete von Champollion unterliegen nicht einer einzigen Lizenz. Diese Seite erklärt in einfachen Worten, für wen welches Paket gilt.

**Dies ist eine Zusammenfassung, keine Rechtsberatung. Maßgeblich ist der Lizenztext.** Jede Lizenz ist in der folgenden Tabelle verlinkt und liegt dem jeweiligen Paket bei.

## Die Pakete und ihre Lizenzen

| Paket | Beschreibung | Lizenz |
|---|---|---|
| `champollion` (npm) | Die CLI, die Ihre Locale-Dateien übersetzt | [PolyForm Noncommercial 1.0.0](https://github.com/gamedaysuits/Champollion/blob/main/cli/LICENSE) |
| `champollion-mcp-server` (npm) | Der MCP-Server, der KI-Agenten diese Werkzeuge zur Verfügung stellt | [PolyForm Noncommercial 1.0.0](https://github.com/gamedaysuits/Champollion/blob/main/mcp-server/LICENSE) |
| `nmt-forge` | Die Modell-Trainingssuite | [PolyForm Noncommercial 1.0.0](https://github.com/gamedaysuits/Champollion/blob/main/forge/LICENSE) |
| `mt-eval-harness` (PyPI; der Befehl `mt-eval`) | Das Evaluierungs-Harness | [AGPL-3.0-or-later](https://github.com/gamedaysuits/Champollion/blob/main/arena/LICENSE), mit einer [Plugin-Ausnahme](https://github.com/gamedaysuits/Champollion/blob/main/arena/LICENSE-EXCEPTION.md) |
| `champollion-lyss` (PyPI) | Das Evaluierungsstandard-Plugin für Plains Cree | Eigene Übergangslizenz: Nutzung nur mit Genehmigung ([auf PyPI](https://pypi.org/project/champollion-lyss/)) |

Die Datenregister (`shared/`) und die Datenbankmigrationen (`mt-eval-arena/`) im [Repository](https://github.com/gamedaysuits/Champollion) stehen unter Apache-2.0.

## Die CLI, der MCP-Server und nmt-forge

Diese drei unterliegen der PolyForm Noncommercial License 1.0.0. Sie dürfen sie für **nichtkommerzielle Zwecke** nutzen, ändern und weitergeben. Die Lizenz nennt diese Zwecke selbst. Zwei ihrer Klauseln decken die meisten Fälle ab:

> **Persönliche Nutzung.** Die persönliche Nutzung für Forschung, Experimente und Tests zum Nutzen des öffentlichen Wissens, für das persönliche Studium, die private Unterhaltung, Hobbyprojekte, Amateurbeschäftigungen oder die Religionsausübung ohne eine absehbare kommerzielle Anwendung ist die Nutzung für einen zulässigen Zweck.

> **Nichtkommerzielle Organisationen.** Die Nutzung durch eine gemeinnützige Organisation, eine Bildungseinrichtung, eine öffentliche Forschungseinrichtung, eine Organisation der öffentlichen Sicherheit oder des Gesundheitswesens, eine Umweltschutzorganisation oder eine staatliche Einrichtung ist die Nutzung für einen zulässigen Zweck, unabhängig von der Finanzierungsquelle oder den aus der Finanzierung resultierenden Verpflichtungen.

Für eine Organisation einer dieser Arten spielt die Art der Finanzierung keine Rolle: Die Klausel besagt ausdrücklich „unabhängig von der Finanzierungsquelle“.

| Wer | Abgedeckt? | Begründung |
|---|---|---|
| Eine Schule, die ihre App oder ihren Newsletter übersetzt | ✓ Ja | Eine Bildungseinrichtung |
| Ein öffentliches Krankenhaus oder eine öffentliche Gesundheitsklinik, die Patientenanweisungen übersetzt | ✓ Ja | Eine Organisation der öffentlichen Sicherheit oder des Gesundheitswesens |
| Eine gemeinnützige Organisation, die ihre Website übersetzt | ✓ Ja | Eine gemeinnützige Organisation |
| Eine Behörde oder ein öffentliches Forschungsinstitut | ✓ Ja | Eine staatliche Einrichtung oder eine öffentliche Forschungseinrichtung |
| Sie selbst bei einem persönlichen oder Forschungsprojekt ohne absehbare kommerzielle Anwendung | ✓ Ja | Persönliche Nutzung für Forschung, Experimente, Tests, privates Studium oder ein Hobby |
| Ein Geschäft, das seinen Webshop übersetzt | ✗ Nein | Das Produkt eines gewinnorientierten Unternehmens ist eine kommerzielle Nutzung |
| Eine gewinnorientierte Privatklinik, die ihr Patientenportal übersetzt | ✗ Nein | Das Produkt eines gewinnorientierten Unternehmens ist eine kommerzielle Nutzung. Es handelt sich nicht um eine Organisation des öffentlichen Gesundheitswesens |

Ein kommerzieller Zweck ist nicht abgedeckt: Diese Lizenz erteilt hierfür keine Erlaubnis.

## Das Evaluierungs-Harness (`mt-eval-harness`)

Das Harness ist Open Source unter der GNU Affero General Public License, Version 3 oder neuer (AGPL-3.0-or-later). Die AGPL erlaubt eine kommerzielle Nutzung zu ihren eigenen Bedingungen. Die wichtigsten davon:

- Wenn Sie das Harness weitergeben – ob verändert oder unverändert –, tun Sie dies unter derselben Lizenz und zusammen mit dem Quellcode.
- Wenn Sie das Harness verändern und Dritten die Nutzung über ein Netzwerk ermöglichen, müssen Sie diesen Personen den Quellcode Ihrer veränderten Version zur Verfügung stellen (Abschnitt 13, „Remote Network Interaction“).

Eine gesonderte Genehmigung ([LICENSE-EXCEPTION.md](https://github.com/gamedaysuits/Champollion/blob/main/arena/LICENSE-EXCEPTION.md), gemäß AGPL-Abschnitt 7) ermöglicht es Evaluierungsstandard-Plugins unter anderen Lizenzen, über die öffentliche Plugin-Schnittstelle mit dem Harness zu interagieren. Die eigene Lizenz des Harness ändert sich dadurch nicht.

## Das Plains-Cree-Plugin (`champollion-lyss`)

`champollion-lyss` verfügt über eine eigene Übergangslizenz: Es darf nur mit schriftlicher Genehmigung verwendet werden. Für nichtkommerzielle Forschung, Bildung und gemeinnützige Zwecke wird die Genehmigung üblicherweise kostenlos erteilt. Eine kommerzielle Nutzung ist nicht gestattet. Es handelt sich um eine Übergangslizenz, die durch Bedingungen ersetzt werden soll, die im Rahmen einer gemeinschaftlichen Selbstverwaltung (Community Governance) festgelegt werden. Der Lizenztext und die zugehörige NOTICE-Datei liegen dem Paket bei.

## Was diese Lizenzen nicht abdecken

Die Übersetzungsdienste, Modelle und Korpora, die Sie über diese Werkzeuge nutzen, behalten ihre eigenen Bedingungen: die API-Bedingungen eines Anbieters, die Lizenz eines Modells, die Lizenz eines Korpus. Das Harness erfasst die Lizenz jedes Korpus und wendet dessen Regeln darauf an, welche Modelldienste darauf zugreifen dürfen; diese Bedingungen werden jedoch von deren Eigentümern festgelegt, nicht durch die Lizenzen auf dieser Seite.

## Die Lizenztexte

- [PolyForm Noncommercial License 1.0.0](https://github.com/gamedaysuits/Champollion/blob/main/cli/LICENSE) (auch unter [polyformproject.org](https://polyformproject.org/licenses/noncommercial/1.0.0)): die CLI sowie derselbe Text für den [MCP-Server](https://github.com/gamedaysuits/Champollion/blob/main/mcp-server/LICENSE) und [nmt-forge](https://github.com/gamedaysuits/Champollion/blob/main/forge/LICENSE)
- [GNU AGPL-3.0](https://github.com/gamedaysuits/Champollion/blob/main/arena/LICENSE) und deren [Plugin-Ausnahme](https://github.com/gamedaysuits/Champollion/blob/main/arena/LICENSE-EXCEPTION.md): das Harness
- [champollion-lyss](https://pypi.org/project/champollion-lyss/): die Übergangslizenz und NOTICE-Datei liegen dem Paket bei

Diese Seite ist eine Zusammenfassung, keine Rechtsberatung. Weichen diese Seite und ein Lizenztext voneinander ab, ist der Lizenztext maßgeblich.
