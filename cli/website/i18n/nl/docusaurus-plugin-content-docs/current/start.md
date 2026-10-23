---
title: "Start een project"
slug: /start
description: "Begin met het bouwen van een vertaler voor uw taal — met een AI-assistent op uw computer, of door zelf vier commando's te typen."
---

# Een project starten

Er zijn twee manieren om te beginnen. In beide gevallen draaien de tools op uw eigen computer,
en nemen ze u stap voor stap mee.

## Met een AI-assistent

Dit is de eenvoudigste manier. Uw assistent typt; u beantwoordt de
vragen die aan u zijn.

**Wat u nodig heeft:** een AI-assistent die als app op uw computer draait — niet
alleen een telefoon-app — en daar tools kan gebruiken.

### 1. Voeg de rails toe aan uw assistent

Kopieer de korte instelling hieronder, plak deze in uw assistent en zeg:
*"Stel dit alsjeblieft voor me in."* Veel assistenten kunnen dat. Als die van u dat niet kan, vraag
dan iemand die handig is met computers om het één keer te doen — de stappen staan hieronder.

```json
{
  "mcpServers": {
    "champollion": { "command": "npx", "args": ["-y", "champollion-mcp-server"] }
  }
}
```

<details>
<summary>Handmatig instellen</summary>

Assistenten maken verbinding met tools via een gangbare standaard genaamd MCP; de instelling
hierboven vertelt de uwe hoe de rails gestart moeten worden. Uw computer heeft ook Node.js
20.11 of nieuwer nodig, een gratis programma.

- **Claude's desktop-app:** Settings → Developer → Edit Config. Voeg de
  instelling toe aan dat bestand, sla het op en herstart de app.
- **Claude Code:** voer dit eenmalig uit in een terminal:
  `claude mcp add champollion -- npx -y champollion-mcp-server`
- **Cursor:** voeg de instelling toe aan het bestand `mcp.json` in de map
  `.cursor` van uw project, of in de map `.cursor` in uw thuismap.

</details>

### 2. Vertel het, in uw eigen woorden

Iets zoals:

> *We willen een vertaler bouwen van het Engels naar onze taal — gebruik
> champollion.*

### 3. Beantwoord wat er gevraagd wordt

Eerst herhaalt de assistent de richting voor u — *"u voert Engels in en uw
taal komt eruit. Is dat de bedoeling?"* — want dat omdraaien is een veelgemaakte fout. Daarna maakt deze een projectmap aan en vraagt om uw
bestanden.

Vanaf dat moment vraagt de assistent telkens wanneer een beslissing aan u is: van wie uw woorden zijn,
of een vertaler ervan mag leren, of er iets geïnstalleerd moet worden. Geef zelf antwoord. Als u het nog niet weet, zeg dat dan — de rails kunnen wachten. En *nu even niet* is altijd een antwoord: de rails vragen er die sessie niet meer naar.

**Eén ding om vooraf te weten.** De meeste assistenten sturen wat ze lezen naar het bedrijf
dat ze beheert. Voor bestanden die op deze computer staan, vertellen de tools uw assistent
alleen *hoeveel* zinnen u heeft, nooit de zinnen zelf — maar een assistent die
uw computer kan gebruiken, kan elk bestand openen dat u kunt openen. Voor woorden die u privé wilt houden,
vraagt u de assistent om dat niet te doen, of gebruikt u een assistent die op uw eigen computer draait. [Uw woorden, uw regels](/docs/your-words-your-rules) legt dit uit.

## Zelf aan de slag

Als u vertrouwd bent met het typen van commando's, zijn het vier regels. Installeer de project-tool
(deze heeft Node.js 20.11 of nieuwer nodig), start een project en vraag wat de volgende stap is:

```bash
npm install -g champollion
champollion new family --from English --to qaa --target-name "Our language"
cd family
champollion next
```

`qaa` betekent "een taal die nog geen code heeft" — dat werkt prima; de tools
vullen alleen geen gegevens zoals uw alfabet voor u in. De naam tussen aanhalingstekens is hoe
u de taal noemt. Als uw taal een code heeft, of een naam die de tools kennen,
gebruik die dan. Als een naam op meer dan één taal kan slaan, vraag dan aan uw
sprekers welke zij spreken voordat u een code kiest; totdat zij dat aangeven, werkt `qaa`
prima, maar deze heeft geen taalkaart, dus er worden geen meervoudsregels of schrift uit overgenomen.

Vanaf dat moment noemt `champollion next` altijd de volgende stap en het exacte
commando daarvoor. Wanneer het tijd is om een vertaler te trainen, vragen de rails eerst toestemming voordat
de trainingstools worden geïnstalleerd.

## Werken zonder internet

Blijf online tijdens de installatie en uw eerste trainingsronde: de trainingstools
en de krachtigere vertaler (ongeveer 1,2 GB) worden dan gedownload. Daarna vindt het
werk plaats op uw computer. Om te voorkomen dat de tools zelf gegevens opzoeken — ze kunnen een openbare
informatiekaart van een taal ophalen, waarbij alleen de taalcode wordt verzonden — stelt u dit in uw
terminal en in de instellingen van uw assistent in:

```bash
export CHAMPOLLION_OFFLINE=1
```

Een AI-assistent die op de computers van een bedrijf draait, heeft nog steeds internet nodig.
Voor volledig offline werk gebruikt u er een die op uw eigen computer draait.

## Wat u kunt verwachten

Uw eerste vertaler zal waarschijnlijk een zinnenboek zijn: goed in zinnen zoals
degene waarvan hij geleerd heeft, en verder nog niet veel. Dat is waar elk project
begint. [Wat het nog niet kan](/docs/what-it-cant-do-yet) legt helder uit wat u kunt
verwachten, en [Beter maken](/docs/make-it-better) laat zien hoe het groeit.

**Volgende stap:** [Breng mee wat u heeft →](/docs/bring-your-data)

## Meer informatie

- [De rails aansturen via MCP](/docs/agents/mcp) — de zes tools, de cyclus
  en de configuratie per assistent in detail.
- [De rails aansturen vanuit de shell](/docs/agents/shell) — elk commando dat de
  rails uitvoeren.
- [Het werkcontract](/docs/agents/contract) — de regels die uw assistent
  volgt.
- [Wie dit mag gebruiken](/docs/getting-started/who-may-use-this) — de licentie.
