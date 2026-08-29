---
sidebar_position: 5
title: "Guia Prático: Modelo Fine-Tuned"
---

# Modelo Fine-Tuned

> **A ideia:** Fine-tune um modelo de peso aberto (Llama, Mistral, Gemma) em texto paralelo para seu par de idiomas alvo. Potencialmente o teto de qualidade mais alto, mas requer dados paralelos que podem ser escassos — e as regras de contaminação de dados de avaliação são rigorosas.

:::info[Este é um cookbook, não uma implementação finalizada]
Este guia descreve a abordagem, os requisitos de dados e as armadilhas. A infraestrutura de treinamento real está fora do escopo do harness.
:::

## Quando Usar Isso

- Você tem acesso a um **corpus paralelo** (centenas a milhares de pares de sentenças) que é **completamente independente** do conjunto de dados de avaliação
- Você tem **acesso a GPU** para treinamento (hardware local, nuvem ou cluster de computação universitário)
- Você quer o **teto de qualidade mais alto** para um par de idiomas específico e está disposto a investir em treinamento
- Outras abordagens (coached prompting, few-shot) atingiram um platô de qualidade

## Como Funciona

1. **Montar dados paralelos** — pares de sentenças fonte-alvo de fontes independentes (livros didáticos, arquivos comunitários, registros de Hansard, textos religiosos, materiais educacionais)
2. **Preparar formato de treinamento** — formato de instruction-tuning (system prompt + input + output esperado)
3. **Fine-tune** — LoRA/QLoRA em um modelo base (quantização de 4-bit torna isso viável em GPUs consumer)
4. **Avaliar com o harness** — executar o modelo fine-tuned através do eval harness
5. **Iterar** — ajustar dados de treinamento, hiperparâmetros, seleção de modelo base

## Requisitos de Dados

| Tamanho do Corpus | O Que Esperar |
|---|---|
| 50–200 pares | Melhoria marginal sobre zero-shot; pode sofrer overfitting |
| 200–1.000 pares | Melhoria notável em estilo e terminologia |
| 1.000–5.000 pares | Ganhos significativos de qualidade para o par de idiomas específico |
| 5.000+ pares | Aproximando-se do teto de qualidade do modelo base |

:::danger[Contaminação de dados de avaliação = desqualificação]
Seus dados de treinamento NÃO DEVEM sobrepor-se ao conjunto de dados de avaliação. Nem as sentenças, nem a lista de vocabulário, nem paráfrases do mesmo conteúdo. O harness faz fingerprint de seus outputs; a sobreposição estatística é detectável. Se você não tem certeza se uma fonte de dados é independente, erre pelo lado da exclusão. Veja [Regras do Leaderboard](/docs/network/leaderboard/rules).
:::

## Esqueleto: Fine-Tuning com LoRA

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

## Onde Encontrar Dados Paralelos

- **Arquivos comunitários** — materiais educacionais, documentos governamentais, publicações bilíngues
- **Nunavut Hansard** — 1,3M pares alinhados English-Inuktitut (NRC Canada)
- **Traduções da Bíblia** — disponíveis para muitos idiomas de baixo recurso, mas específicas de domínio
- **Livros didáticos** — frequentemente bilíngues em contextos de aprendizado de idiomas
- **Criar seus próprios** — veja [Corpus Creation Guide](./corpus-creation)

## Prós e Contras

| | |
|---|---|
| ✅ Teto de qualidade mais alto | ❌ Requer dados paralelos (escassos para LRLs) |
| ✅ Modelo aprende padrões específicos do idioma | ❌ Custos de GPU (embora LoRA ajude) |
| ✅ Pode superar abordagens com prompting | ❌ Risco de overfitting com datasets pequenos |
| ✅ Custo de treinamento único, depois inferência barata | ❌ Regras rigorosas de contaminação de avaliação |

## Combina Bem Com

- **[Corpus Creation](./corpus-creation)** — construir os dados de treinamento que você precisa
- **[Back-Translation](./back-translation)** — expandir seu corpus paralelo sinteticamente
- **[FST-Gated Pipeline](./fst-gated-pipeline)** — modelo fine-tuned + validação morfológica
- **[Coached LLM Prompting](./coached-llm-prompting)** — coaching em cima de uma base fine-tuned

## Veja Também

- [Evaluation Datasets](/docs/network/leaderboard/datasets) — saiba o que você NÃO PODE treinar
- [Leaderboard Rules](/docs/network/leaderboard/rules) — política de contaminação
- [Support a Low-Resource Language](/docs/network/community/low-resource-languages)
