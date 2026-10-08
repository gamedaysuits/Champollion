---
sidebar_position: 7
title: "Guia Prático: Híbrido Baseado em Regras + LLM"
---

# Híbrido Baseado em Regras + LLM

> **A ideia:** Use regras linguísticas determinísticas para padrões que você sabe estar corretos (afixação morfológica, formatação de números, estruturas de frases conhecidas), e deixe o LLM lidar com a tradução criativa para todo o resto. Regras sobrescrevem o LLM onde se aplicam; o LLM preenche as lacunas.

:::info[Este é um cookbook, não uma implementação finalizada]
Este guia esboça a arquitetura híbrida. As regras específicas dependem inteiramente da gramática do seu idioma de destino e dos recursos linguísticos disponíveis.
:::

## Quando Usar Isso

- Você tem **expertise linguística profunda** na língua-alvo (ou acesso a um linguista)
- Alguns padrões de tradução são **determinísticos** — você conhece a saída correta com certeza
- O LLM **falha consistentemente** em padrões específicos (formatação de números, honoríficos, aglutinação)
- Você quer **garantir correção** para padrões críticos enquanto mantém fluência para o resto

## Como Funciona

```
Input ──→ [Rule Engine] ──→ [LLM] ──→ [Merge] ──→ Output
              │                │           │
              │ Known patterns │ Unknown    │ Rules override
              │ handled here   │ parts      │ LLM where both
              ▼                ▼            ▼ produced output
         Deterministic     Creative     Final translation
         fragments         translation
```

1. **Defina regras** — padrões regex, buscas em FST, tabelas de consulta para traduções conhecidas
2. **Pré-processe** — identifique e extraia segmentos correspondentes às regras da fonte
3. **LLM traduz** — o texto restante, com saídas de regras como restrições
4. **Mescle** — remonte a tradução, preferindo a saída de regras onde disponível
5. **Valide** — verificação opcional de FST/regra no resultado mesclado

## Exemplo: Regras de Número e Data

```python
import re

# Rule: Numbers stay as-is (don't let the LLM hallucinate number translations)
def rule_preserve_numbers(text):
    return re.sub(r'\b\d+\b', lambda m: f'__NUM_{m.group()}__', text)

# Rule: Known greetings have exact translations
GREETING_RULES = {
    "hello": "tânisi",
    "goodbye": "êkosi",
    "thank you": "kinanâskomitin",
}

# Rule: Date format conversion
def rule_date_format(text):
    # "January 15" → "kisê-pîsim 15" (deterministic month mapping)
    ...
```

## Decisões de Design Principais

**Prioridade de regra:** Quando uma regra e o LLM produzem saída para o mesmo segmento, qual vence? Regras devem vencer para padrões **críticos para correção**. LLM deve vencer para padrões **críticos para fluência**.

**Granularidade:** Regras em nível de palavra (busca em dicionário) vs. regras em nível de frase (mapeamento de idioma) vs. regras estruturais (reordenação de sentença). Comece com nível de palavra; adicione nível de frase conforme você identifica padrões.

**Manutenção de regras:** Cada regra é uma obrigação de manutenção. Prefira um pequeno conjunto de regras de alta confiança a um grande conjunto de regras aproximadas. Se você não tem certeza de que uma regra está correta, deixe para o LLM.

## Prós e Contras

| | |
|---|---|
| ✅ Correção garantida onde as regras se aplicam | ❌ Requer expertise linguística profunda |
| ✅ Transparente — regras são legíveis e auditáveis | ❌ A costura regra/LLM pode produzir saída não natural |
| ✅ Regras são rápidas (sem custo de API) | ❌ Carga de manutenção cresce com o número de regras |
| ✅ Progressivo — adicione regras conforme aprende | ❌ Difícil lidar com flexão nos limites das regras |

## Combina Bem Com

- **[FST-Gated Pipeline](./fst-gated-pipeline)** — FST como um tipo específico de mecanismo de regras
- **[Dictionary-Augmented LLM](./dictionary-augmented-llm)** — busca em dicionário é uma regra simples
- **[Coached LLM Prompting](./coached-llm-prompting)** — coaching lida com preferências suaves, regras lidam com requisitos rígidos

## Veja Também

- [GiellaLT](https://giellalt.github.io/) — infraestrutura FST de código aberto para 100+ idiomas
- [Apertium](https://www.apertium.org/) — plataforma de TA baseada em regras com dicionários bilíngues
- [Support a Low-Resource Language](/docs/network/community/low-resource-languages)
