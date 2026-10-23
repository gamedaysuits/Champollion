---
title: "Een app of website vertalen"
slug: /translate-an-app-or-website
description: "Vertaal de woorden op de schermen van een app of website naar uw taal, houd ze up-to-date wanneer het origineel verandert en kies welke vertaler elke taal verzorgt."
---

# Een app of website vertalen

Apps en websites bewaren hun woorden — knoppen, menu's, berichten, pagina's — in
bestanden, één per taal. Champollion kan het bestand voor uw taal voor u
invullen en up-to-date houden wanneer het origineel verandert. Eén commando is
voldoende:

```bash
npx champollion sync
```

Het vindt de taalbestanden van uw app, vertaalt alleen wat ontbreekt of
gewijzigd is, controleert elke vertaling alvorens deze weg te schrijven, en laat de rest
ongemoeid.

## Welke vertaler het werk doet

U kiest, voor elke taal:

- **Uw eigen vertaler**, gebouwd op de rails — de tools verbinden deze met uw
  app. Als deze heeft geleerd van besloten zinnen, maakt deze pas verbinding nadat u
  hebt aangegeven wie van de mensen die de woorden beheren, akkoord is gegaan.
- **Een AI-model of een vertaaldienst** — voor talen die ze al
  goed beheersen. Deze sturen de woorden van uw app naar het bedrijf dat ze aanbiedt, dus
  gebruik ze voor tekst die zonder bezwaar gedeeld kan worden.
- **Uw eigen dienst**, op een adres dat u opgeeft.

## Wat het regelt

- **Alleen wat er veranderd is.** Het onthoudt wat het eerder heeft vertaald, zodat u nooit
  twee keer voor dezelfde zin betaalt.
- **Controles vóór het wegschrijven.** Lege antwoorden, het origineel dat teruggekopieerd wordt, woorden
  die zich in een lus herhalen, tekst die veel langer is dan zou moeten, ontbrekende delen of
  het verkeerde alfabet worden opgemerkt en geweigerd. Deze controles vangen defecte uitvoer op,
  geen verkeerde betekenis — een spreker heeft nog altijd het laatste woord.
- **Uw bestanden, uw indeling.** JSON-, YAML-, TOML- en Markdown-pagina's, en de
  gangbare app- en websiteframeworks.

## Wie het mag gebruiken

Gratis voor niet-commercieel gebruik — de app van een school, de website van een gemeenschap, een publieke
dienst. Het product van een bedrijf valt niet onder de gratis licentie; als een sprekersgemeenschap
het commercieel wil gebruiken, vraag het aan en de licentie is gratis.
[Wie dit mag gebruiken](/docs/getting-started/who-may-use-this) bevat alle details.

**Volgende:** [Een verzegelde test hosten →](/docs/host-a-sealed-test)

## Meer informatie

- [App- en sitevertaling](/docs/intro) — de volledige referentie: snelstart,
  configuratie, frameworks, vertaalgeheugen, de kwaliteitscontroles, CI.
- [Serving en deployment](/docs/agents/serving) — uw eigen vertaler
  verbinden.
