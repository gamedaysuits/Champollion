---
sidebar_position: 10
title: "Kookboek: Gedeeltelijke Vertaling (Mens + Machine)"
---

# Gedeeltelijke Vertaling (Menselijk + Machine)

> **Het idee:** Vertaal handmatig een representatief steekproef, bewijs dat uw machinale methode qua stijl overeenkomt met de menselijke vertaling van dat steekproef, en vertaal vervolgens de resterende bulk automatisch. Combineert menselijke kwaliteit met machinale schaal — de mens stelt de norm, de machine volgt die.

:::info[Dit is een kookboek, geen kant-en-klare implementatie]
Deze handleiding schetst de hybride mens-machine-workflow. Deze is bijzonder relevant voor vertaalbureaus, medewerkers van gemeenschapstalen en educatieve contexten.
:::

## Wanneer gebruikt u dit

- U heeft **toegang tot vloeiende sprekers**, maar hun tijd is beperkt
- U moet een **groot volume** vertalen, maar slechts een klein deel hoeft perfect te zijn
- U wilt een **kwaliteitsbasislijn vaststellen** met menselijke vertaling en vervolgens opschalen met MT
- U werkt in een **educatieve of gemeenschapscontext** waarbij menselijke beoordeling van een deelverzameling haalbaar is

## Hoe het werkt

```
[Full corpus: 1,000 entries]
        │
        ├── [100 entries] ──→ Human translator ──→ Gold translations
        │                                              │
        │                                              ▼
        │                                    Train / prompt machine
        │                                    method to match style
        │                                              │
        └── [900 entries] ──→ Machine method ──→ Auto translations
                                                       │
                                                       ▼
                                              [Optional: human review
                                               of flagged entries]
```

1. **Selecteer een representatief steekproef** — dek verschillende zinstypen, lengtes en onderwerpen af
2. **Vertaal het steekproef handmatig** — stel de gouden standaard vast voor stijl, register en terminologie
3. **Configureer uw machinale methode** — gebruik de menselijke vertalingen als coachingdata, few-shot-voorbeelden of fijnafstemmingsdata
4. **Beoordeel de machine op het menselijke steekproef** — komt de stijl van de machine overeen met die van de mens?
5. **Vertaal de rest automatisch** — als de machinale kwaliteit op het steekproef acceptabel is
6. **Optionele menselijke beoordeling** — markeer uitvoer met lage betrouwbaarheid voor beoordeling door sprekers

## Kwaliteitsborging: De Stijlovereenkomsttest

```bash
# Translate the human-translated sample with your machine method
mt-eval run \
  --corpus data/human-sample.json \
  --name coached-v3

# Compare: does the machine match the human translator's choices?
# Look at: chrF++ (similarity), FST acceptance (validity),
# and qualitative patterns (register, formality, terminology)
```

## Het Steekproef Selecteren

**Dek de verdeling af.** Uw 100 vermeldingen moeten bevatten:
- Korte zinsdelen (1–3 woorden) en volledige zinnen
- Gangbare woordenschat en domeinspecifieke termen
- Eenvoudige structuren en complexe structuren
- Meerdere grammaticale kenmerken (vragen, gebiedende wijs, conditionalis)

**Kies niet alleen de gemakkelijke vermeldingen.** Het steekproef moet vermeldingen bevatten waarbij uw methode waarschijnlijk moeite zal hebben — daar is menselijke kwaliteit het belangrijkst.

## De Workflow voor Gemeenschapsbeoordeling

Voor gemeenschappen van Inheemse talen respecteert deze aanpak de tijd van sprekers:

1. **Een spreker vertaalt 50–100 vermeldingen** (2–4 uur geconcentreerd werk)
2. **De machine vertaalt de resterende 900** met het werk van de spreker als coachingdata
3. **De spreker beoordeelt gemarkeerde vermeldingen** — alleen de vermeldingen waarbij de machine het minst zeker was (nog eens 1–2 uur)
4. **Resultaat:** 1.000 vertalingen van bijna-menselijke kwaliteit, met ~5 uur sprekersinzet in plaats van ~50

## Voor- en nadelen

| | |
|---|---|
| ✅ Combineert menselijke kwaliteit met machinale schaal | ❌ Vereist een initiële menselijke investering |
| ✅ Respecteert beperkte beschikbaarheid van sprekers | ❌ De machine kan niet alle stilistische nuances vastleggen |
| ✅ Natuurlijke kwaliteitsborgingsworkflow | ❌ De steekproefselectie beïnvloedt de algehele kwaliteit |
| ✅ Uitstekend voor gemeenschaps- en educatieve contexten | ❌ Menselijke beoordelingsbottleneck voor gemarkeerde vermeldingen |

## Combineert goed met

- **[Coached LLM Prompting](./coached-llm-prompting)** — menselijke vertalingen voeden de coachingdata
- **[Few-Shot Prompting](./few-shot-prompting)** — menselijke vertalingen als in-context-voorbeelden
- **[Corpus Creation](./corpus-creation)** — het menselijke steekproef ÍS corpuscreatie

## Zie ook

- [Voor Taalgemeenschappen](/docs/network/community/for-language-communities) — model voor gemeenschapsbetrokkenheid
- [Datasouvereiniteit](/docs/network/sovereignty/data-sovereignty) — eigenaarschap van vertaaldata
- [Ondersteuning van een Taal met Weinig Middelen](/docs/network/community/low-resource-languages)
