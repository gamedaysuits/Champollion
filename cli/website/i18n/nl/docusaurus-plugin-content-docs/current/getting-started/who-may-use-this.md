---
title: "Wie het mag gebruiken en wat het kost"
description: "Gratis voor gezinnen, scholen, goede doelen en openbare diensten; commerciële licenties op aanvraag gratis voor taalgemeenschappen. De licentie van elk pakket in begrijpelijke taal — een samenvatting, geen juridisch advies; de licentietekst is leidend."
related:
  - label: "Installation"
    to: /docs/getting-started/installation
    kind: guide
  - label: "Quick Start"
    to: /docs/getting-started/quick-start
    kind: guide
---

# Wie het mag gebruiken, en wat het kost

**In het kort:**

- **Gratis** voor gezinnen, scholen, goede doelen, openbare diensten zoals ziekenhuizen,
  overheidsdiensten zelf, en persoonlijke of onderzoeksprojecten.
- **Commercieel gebruik** — een taal-app, een betaalde dienst — valt niet onder de
  gratis licentie. **Als uw sprekersgemeenschap de tools commercieel wil
  gebruiken, vraag het dan aan: de licentie is gratis.**
  [Vraag een licentie aan](mailto:info@champollion.dev?subject=Commercial%20licence%20request).
- **Geen aandeel.** Champollion vraagt geen aandeel in wat een gemeenschap aan
  haar eigen taal verdient. Als een sponsor werk financiert, gaat het geld er rechtstreeks naartoe.
- **Hulp is optioneel.** Als u mensen wilt die helpen bij uw project, [laten we
  praten](/docs/getting-help) — voorwaarden worden met elke gemeenschap afgestemd, en
  er is geen prijslijst. U heeft ons nooit nodig om het af te ronden.

Dat is alles wat de meesten nodig hebben. De rest van deze pagina bevat de details, voor juristen en ontwikkelaars: de pakketten van Champollion delen niet één licentie, en deze pagina legt in duidelijke taal uit voor wie elk pakket geldt.

**Dit is een samenvatting, geen juridisch advies. De licentietekst is bindend.** Elke licentie is gelinkt in de onderstaande tabel en wordt meegeleverd met het bijbehorende package.

## De packages en hun licenties

| Pakket | Wat het is | Licentie |
|---|---|---|
| `champollion` (npm) | De projecttool: de rails, en het vertalen van app- en websitebestanden | [PolyForm Noncommercial 1.0.0](https://github.com/gamedaysuits/Champollion/blob/main/cli/LICENSE) |
| `champollion-mcp-server` (npm) | De MCP-server die AI-agents toegang geeft tot deze tools | [PolyForm Noncommercial 1.0.0](https://github.com/gamedaysuits/Champollion/blob/main/mcp-server/LICENSE) |
| `nmt-forge` | De suite voor modeltraining | [PolyForm Noncommercial 1.0.0](https://github.com/gamedaysuits/Champollion/blob/main/forge/LICENSE) |
| `mt-eval-harness` (PyPI; de opdracht `mt-eval`) | De evaluatie-omgeving | [AGPL-3.0-or-later](https://github.com/gamedaysuits/Champollion/blob/main/arena/LICENSE), met een [plugin-uitzondering](https://github.com/gamedaysuits/Champollion/blob/main/arena/LICENSE-EXCEPTION.md) |
| `champollion-lyss` (PyPI) | De evaluatiestandaard-plugin voor Plains Cree | Een eigen tijdelijke licentie: alleen te gebruiken met toestemming ([op PyPI](https://pypi.org/project/champollion-lyss/)) |

De dataregisters (`shared/`) en de databasemigraties (`mt-eval-arena/`) in de [repository](https://github.com/gamedaysuits/Champollion) vallen onder Apache-2.0.

## De CLI, de MCP-server en nmt-forge

Deze drie vallen onder de PolyForm Noncommercial License 1.0.0. U mag ze gebruiken, wijzigen en delen voor een **niet-commercieel doeleinde**. De licentie specificeert deze doeleinden zelf. Twee van de bepalingen zijn in de meeste gevallen doorslaggevend:

> **Persoonlijk gebruik.** Persoonlijk gebruik voor onderzoek, experimenten en testen ten behoeve van algemene kennis, persoonlijke studie, privéamusement, hobbyprojecten, amateuroefening of religieuze uitoefening, zonder enige verwachte commerciële toepassing, is gebruik voor een toegestaan doeleinde.

> **Niet-commerciële organisaties.** Gebruik door een liefdadigheidsorganisatie, onderwijsinstelling, publieke onderzoeksorganisatie, organisatie voor openbare veiligheid of volksgezondheid, milieubeschermingsorganisatie of overheidsinstelling is gebruik voor een toegestaan doeleinde, ongeacht de financieringsbron of verplichtingen die voortvloeien uit de financiering.

Voor een organisatie van een van deze typen maakt de wijze van financiering geen verschil: de bepaling luidt "ongeacht de financieringsbron".

| Wie | Gedekt? | Waarom |
|---|---|---|
| Een school die haar app of nieuwsbrief vertaalt | ✓ Ja | Een onderwijsinstelling |
| Een openbaar ziekenhuis of een openbare gezondheidskliniek die patiënteninstructies vertaalt | ✓ Ja | Een organisatie voor openbare veiligheid of volksgezondheid |
| Een goed doel dat zijn website vertaalt | ✓ Ja | Een liefdadigheidsorganisatie |
| Een overheidsinstantie of een openbaar onderzoeksinstituut | ✓ Ja | Een overheidsinstelling of een publieke onderzoeksorganisatie |
| U, voor een persoonlijk of onderzoeksproject zonder enig commercieel oogmerk | ✓ Ja | Persoonlijk gebruik voor onderzoek, experimenten, testen, privestudie of een hobby |
| Een winkel die zijn webwinkel vertaalt | ✗ Nee | Het product van een bedrijf met winstoogmerk is commercieel gebruik |
| Een privékliniek met winstoogmerk die haar patiëntenportaal vertaalt | ✗ Nee | Het product van een bedrijf met winstoogmerk is commercieel gebruik. Het is geen organisatie voor volksgezondheid |

Commercieel gebruik valt hier niet onder: deze licentie verleent daar geen toestemming voor.
Als een sprekersgemeenschap deze tools commercieel wil gebruiken, kan zij een
commerciële licentie aanvragen, en voor een sprekersgemeenschap is die licentie gratis:
[vraag er een aan](mailto:info@champollion.dev?subject=Commercial%20licence%20request).

## De evaluatie-harness (`mt-eval-harness`)

De harness is open source onder de GNU Affero General Public License, versie 3 of nieuwer (AGPL-3.0-or-later). De AGPL staat commercieel gebruik toe, onder haar eigen voorwaarden. De belangrijkste zijn:

- Als u de harness distribueert, al dan niet gewijzigd, doet u dit onder dezelfde licentie, inclusief de broncode.
- Als u de harness wijzigt en mensen deze via een netwerk laat gebruiken, moet u die mensen de broncode van uw gewijzigde versie aanbieden (sectie 13, "Remote Network Interaction").

Een afzonderlijke toestemming ([LICENSE-EXCEPTION.md](https://github.com/gamedaysuits/Champollion/blob/main/arena/LICENSE-EXCEPTION.md), onder AGPL-sectie 7) maakt het mogelijk dat evaluatiestandaard-plugins onder andere licenties samenwerken met de harness via de openbare plugin-interface. Dit verandert niets aan de licentie van de harness zelf.

## De Plains Cree-plugin (`champollion-lyss`)

`champollion-lyss` heeft een eigen overgangslicentie: het mag uitsluitend worden gebruikt met schriftelijke toestemming. Toestemming wordt doorgaans kosteloos verleend voor niet-commercieel onderzoek, onderwijs en gebruik ten behoeve van de gemeenschap. Commercieel gebruik is niet toegestaan. Het is een overgangslicentie, bedoeld om te worden vervangen door voorwaarden die zijn vastgesteld via community governance. De licentietekst en het bijbehorende NOTICE-bestand worden meegeleverd met het package.

## Wat deze licenties niet dekken

De vertaaldiensten, modellen en corpora die u via deze tools gebruikt, behouden hun eigen voorwaarden: de API-voorwaarden van een provider, de licentie van een model of de licentie van een corpus. De harness legt de licentie van elk corpus vast en past de bijbehorende regels toe over welke modeldiensten het mogen inzien, maar die voorwaarden worden bepaald door de respectievelijke eigenaren, niet door de licenties op deze pagina.

## De licentieteksten

- [PolyForm Noncommercial License 1.0.0](https://github.com/gamedaysuits/Champollion/blob/main/cli/LICENSE) (ook op [polyformproject.org](https://polyformproject.org/licenses/noncommercial/1.0.0)): de CLI, en dezelfde tekst voor de [MCP-server](https://github.com/gamedaysuits/Champollion/blob/main/mcp-server/LICENSE) en [nmt-forge](https://github.com/gamedaysuits/Champollion/blob/main/forge/LICENSE)
- [GNU AGPL-3.0](https://github.com/gamedaysuits/Champollion/blob/main/arena/LICENSE) en de bijbehorende [plugin-uitzondering](https://github.com/gamedaysuits/Champollion/blob/main/arena/LICENSE-EXCEPTION.md): de harness
- [champollion-lyss](https://pypi.org/project/champollion-lyss/): de overgangslicentie en het NOTICE-bestand worden meegeleverd in het package

Deze pagina is een samenvatting, geen juridisch advies. Waar deze pagina en een licentietekst van elkaar verschillen, is de licentietekst bindend.
