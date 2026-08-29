---
sidebar_position: 5
title: "Kookboek: Fijn Afgestemd Model"
---

# Verfijnd Model

> **Het idee:** Verfijn een open-gewicht model (Llama, Mistral, Gemma) op parallelle tekst voor uw doeltaalpaar. Potentieel het hoogste kwaliteitsplafond, maar vereist parallelle data die schaars kan zijn — en de regels omtrent besmetting van evaluatiedata zijn strikt.

:::info[Dit is een kookboek, geen kant-en-klare implementatie]
Deze handleiding beschrijft de aanpak, gegevensvereisten en valkuilen. De daadwerkelijke trainingsinfrastructuur valt buiten het bereik van de harness.
:::

## Wanneer gebruikt u dit

- U heeft toegang tot een **parallel corpus** (honderden tot duizenden zinsparen) dat **volledig onafhankelijk** is van de evaluatiedataset
- U heeft **GPU-toegang** voor training (lokale hardware, cloud of universitair rekencluster)
- U wilt het **hoogste kwaliteitsplafond** voor een specifiek taalpaar en bent bereid te investeren in training
- Andere benaderingen (coached prompting, few-shot) hebben een kwaliteitsplateau bereikt

## Hoe het werkt

1. **Stel parallelle data samen** — bron-doelzinsparen uit onafhankelijke bronnen (leerboeken, gemeenschapsarchieven, Hansard-verslagen, religieuze teksten, educatief materiaal)
2. **Bereid het trainingsformaat voor** — instructie-afstemmingsformaat (systeemprompt + invoer + verwachte uitvoer)
3. **Verfijn** — LoRA/QLoRA op een basismodel (4-bit kwantisering maakt dit haalbaar op consumenten-GPU's)
4. **Evalueer met de harness** — voer het verfijnde model uit via de eval harness
5. **Itereer** — pas trainingsdata, hyperparameters en basismodelselectie aan

## Datavereisten

| Corpusomvang | Wat te Verwachten |
|-------------|----------------|
| 50–200 paren | Marginale verbetering ten opzichte van zero-shot; kan overfitten |
| 200–1.000 paren | Merkbare verbetering in stijl en terminologie |
| 1.000–5.000 paren | Significante kwaliteitswinst voor het specifieke taalpaar |
| 5.000+ paren | Nadering van het kwaliteitsplafond voor het basismodel |

:::danger[Besmetting van evaluatiedata = diskwalificatie]
Uw trainingsdata MAG NIET overlappen met de evaluatiedataset. Niet de zinnen, niet de woordenlijst, niet de parafrasen van dezelfde inhoud. De harness maakt een vingerafdruk van uw uitvoer; statistische overlap is detecteerbaar. Als u twijfelt of een gegevensbron onafhankelijk is, kiest u voor uitsluiting. Zie [Leaderboard-regels](/docs/network/leaderboard/rules).
:::

## Skelet: LoRA-verfijning

```python
# Conceptual skeleton — adapt to your framework (HuggingFace, Axolotl, etc.)

# 1. Format your parallel data as instruction pairs
training_data = [
    {"instruction": "Translate to Plains Cree (SRO)", 
     "input": "The children are playing",
     "output": "awâsisak mêtawêwak"},
    # ... hundreds more
]

# 2. Fine-tune with LoRA (4-bit for consumer GPUs)
# Base model: meta-llama/Llama-3.1-8B, google/gemma-2-9b, etc.
# Rank: 16–64, Alpha: 32–128, Epochs: 3–5

# 3. Export and serve via the harness TranslationMethod protocol
```

## Waar Parallelle Data Te Vinden

- **Gemeenschapsarchieven** — educatief materiaal, overheidsdocumenten, tweetalige publicaties
- **Nunavut Hansard** — 1,3 miljoen uitgelijnde Engels-Inuktitut-paren (NRC Canada)
- **Bijbelvertalingen** — beschikbaar voor veel laagresourcetalen, maar domeinspecifiek
- **Educatieve leerboeken** — vaak tweetalig voor taalleersituaties
- **Maak uw eigen** — zie [Corpuscreatiegids](./corpus-creation)

## Voor- en nadelen

| | |
|---|---|
| ✅ Hoogste kwaliteitsplafond | ❌ Vereist parallelle data (schaars voor LRL's) |
| ✅ Model leert taalspecifieke patronen | ❌ GPU-kosten (hoewel LoRA helpt) |
| ✅ Kan gestuurde benaderingen overtreffen | ❌ Overfittingrisico bij kleine datasets |
| ✅ Eenmalige trainingskosten, daarna goedkope inferentie | ❌ Strikte regels omtrent evaluatiebesmetting |

## Combineert goed met

- **[Corpuscreatie](./corpus-creation)** — bouw de trainingsdata die u nodig heeft
- **[Terugvertaling](./back-translation)** — breid uw parallel corpus synthetisch uit
- **[FST-Gated Pipeline](./fst-gated-pipeline)** — verfijnd model + morfologische validatie
- **[Coached LLM Prompting](./coached-llm-prompting)** — coaching bovenop een verfijnd basismodel

## Zie ook

- [Evaluatiedatasets](/docs/network/leaderboard/datasets) — weet wat u NIET op mag trainen
- [Leaderboard-regels](/docs/network/leaderboard/rules) — beleid omtrent besmetting
- [Ondersteuning van een Laagresourcetaal](/docs/network/community/low-resource-languages)
