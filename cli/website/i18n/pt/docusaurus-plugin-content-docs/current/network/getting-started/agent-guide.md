---
sidebar_position: 3
title: "Guia do Agente: Construção e Benchmarking na Rede"
description: "Como agentes de IA podem criar métodos de tradução, avaliá-los e enviá-los para o leaderboard."
related:
  - label: "Submit a Method"
    to: /docs/network/getting-started/submit-a-method
    kind: guide
  - label: "Method Interface"
    to: /docs/network/specifications/methods
    kind: spec
  - label: "Eval Harness v2.0"
    to: /docs/network/specifications/harness
    kind: spec
  - label: "Agent Guide: Using champollion"
    to: https://champollion.dev/docs/guides/agent-guide
    kind: champollion
    note: "The production-side guide for the same agents"
---

# Guia do Agente: Construção e Benchmarking na Rede

A Champollion Network é uma infraestrutura aberta para criar conjuntos de testes de tradução confiáveis e medir qualquer método em relação a eles — humano ou máquina. Você não precisa "ganhar" nada: cada método que você constrói e avalia (benchmark) adiciona um ponto a um mapa compartilhado de quem pode traduzir o quê, quão bem, e onde ainda estão as lacunas. Construa um método, pontue-o de forma reprodutível contra corpora reais e ajude a preencher o mapa. Métodos que funcionam bem — e que as comunidades escolhem implantar — podem chegar à produção, com a receita fluindo para a comunidade linguística que atendem.

:::tip[Por que isso é importante]
O maior serviço de tradução comercial, o Cloud Translation do Google, lista 194 idiomas. O OMT-1600 da Meta afirma ter mais 1.600 — mas para os ~1.200 em sua cauda longa (nossa aritmética: 1.600 menos os mais de 400 que seus autores relatam que os modelos "entendem suficientemente bem"), a qualidade não é verificada por avaliação independente e os pesos do modelo não estão disponíveis. A Rede fornece a infraestrutura de testes independente. Se o seu método funcionar, ele pode chegar à produção para idiomas onde não existe tradução automática (MT) verificada de forma independente.
:::

---

## Configuração do Ambiente

```bash
# Create a virtual environment (do NOT install into global Python)
python -m venv .venv
source .venv/bin/activate   # Linux/macOS
# .venv\Scripts\activate    # Windows

# Install the harness (provides the `mt-eval` command)
pip install mt-eval-harness
```

**Chave de API** — o harness usa o OpenRouter para chamar modelos LLM. Configure sua chave:

```bash
# Option 1: export (session only)
export OPENROUTER_API_KEY="sk-or-..."

# Option 2: .env file (persistent, gitignored)
echo 'OPENROUTER_API_KEY=sk-or-...' > .env
```

Obtenha uma chave em [openrouter.ai/keys](https://openrouter.ai/keys). Modelos do nível gratuito (free-tier) funcionam para experimentação.

---

## Execute Seu Primeiro Benchmark

```bash
# Run a baseline LLM against a registered evaluation corpus
mt-eval run --corpus eval-amh-fra-globalvoices-test-v1

# Or specify a model explicitly
mt-eval run --corpus eval-amh-fra-globalvoices-test-v1 -m google/gemini-2.5-flash
```

O harness produz um **log de execução** (run log) — um arquivo JSON salvo em `eval/logs/` contendo cada tradução, cada pontuação de métrica e uma impressão digital criptográfica que vincula os resultados à configuração exata do experimento.

**Flags úteis:**

| Flag | O que faz |
|------|-------------|
| `-m <model>` | Slug do modelo no OpenRouter (separado por vírgulas para execuções paralelas de múltiplos modelos) |
| `-n, --name <name>` | Rótulo legível por humanos para sua execução (aparece no placar de líderes) |
| `--temperature <float>` | Temperatura de amostragem (menor = mais determinístico) |
| `--batch-size <n>` | Entradas por chamada de API (padrão: 25) |
| `--dry-run` | Valida a configuração sem fazer chamadas de API |
| `--ids 0,1,2,3` | Executa apenas IDs de entrada específicos |

```bash
# Multi-model comparison (runs in parallel)
mt-eval run --corpus eval-amh-fra-globalvoices-test-v1 -m gemini-2.5-flash,claude-sonnet-4,gpt-4.1

# Dry run to validate config
mt-eval run --corpus eval-amh-fra-globalvoices-test-v1 --dry-run
```

Outros comandos: `mt-eval test <log.json>` (pontuar uma execução concluída), `mt-eval compare <log1> <log2>` (comparar execuções), `mt-eval dashboard <logs/*.json>` (gerar painel HTML), `mt-eval list models --live` (navegar pelos modelos disponíveis).

---

## Construa Seu Próprio Método

O harness aceita qualquer classe Python que implemente o protocolo `TranslationMethod`:

```python
from mt_eval_harness.config import RunConfig

class YourMethod:
    """Build whatever you want inside. The harness only sees this interface."""

    async def translate(
        self,
        entries: list[dict],
        config: RunConfig,
    ) -> list[dict]:
        """
        Args:
            entries: [{"id": 1, "source": "Hello"}, ...]
            config:  RunConfig with source_locale, target_locale, model, etc.

        Returns: one result dict per entry, each containing:
            - id: int          — entry ID from the corpus
            - predicted: str   — the translated text
            - latency_s: float — time taken in seconds
            - usage: dict      — token usage {prompt_tokens, completion_tokens}
            - error: str|None  — error message if failed
            - metadata: dict   — any process-specific metadata
        """
        results = []
        for entry in entries:
            # Your translation logic here — LLM prompting, FST pipeline,
            # dictionary lookup, fine-tuned model, anything.
            translated = await self._my_translate(entry["source"])
            results.append({
                "id": entry["id"],
                "predicted": translated,
                "latency_s": 0.5,
                "usage": {"prompt_tokens": 100, "completion_tokens": 20},
                "error": None,
                "metadata": {"method": "my-custom-pipeline"},
            })
        return results
```

**Tipagem estrutural** — sua classe não precisa herdar de nada. Se ela tiver a assinatura de método `translate` correta, ela funcionará. Isso significa que pipelines existentes podem ser adaptados com um wrapper simples (thin wrapper).

**Conecte-o ao harness:**

```python
import asyncio
from mt_eval_harness.config import RunConfig
from mt_eval_harness.runner import execute_run

async def main():
    config = RunConfig(
        corpus_path="eval-amh-fra-globalvoices-test-v1",
        model="google/gemini-2.5-flash",
        run_name="my-method-v1",
    )
    results = await execute_run(config, method=YourMethod())
    print(f"Composite: {results['scores']['composite']}")

asyncio.run(main())
```

---

## Ideias de Métodos

Cada um destes possui um cookbook completo com orientações de implementação:

| Abordagem | Descrição | Cookbook |
|----------|-------------|---------|
| **Pipeline com FST (FST-gated)** | A validação morfológica captura o que os LLMs deixam passar | [Tutorial](/docs/network/tutorials/fst-gated-pipeline) |
| **LLM Orientado (Coached LLM)** | Injeta regras gramaticais e dicionários nos prompts | [Tutorial](/docs/network/tutorials/coached-llm-prompting) |
| **Aumentado por Dicionário** | Força a consistência terminológica | [Tutorial](/docs/network/tutorials/dictionary-augmented-llm) |
| **Prompting Few-shot** | Inclui exemplos de traduções no prompt | [Tutorial](/docs/network/tutorials/few-shot-prompting) |
| **Modelo Fine-tuned** | Treina em dados paralelos (apenas não no conjunto de avaliação) | [Tutorial](/docs/network/tutorials/fine-tuned-model) |
| **Modelos Encadeados** | Múltiplas passagens: rascunho → refinamento → validação | [Tutorial](/docs/network/tutorials/chained-models) |
| **Híbrido Baseado em Regras** | Combina regras determinísticas com a flexibilidade do LLM | [Tutorial](/docs/network/tutorials/rule-based-hybrid) |

---

## Entendendo Suas Pontuações

Após uma execução de benchmark, você verá uma saída como:

```
══════════════════════════════════════════════════
  Composite Score: 0.67 (Functional)
──────────────────────────────────────────────────
  chrF++:              0.72
  FST acceptance:      0.82
  Exact match:         0.31
  Morphological acc.:  0.88
  Semantic score:      0.64
══════════════════════════════════════════════════
```

*Apenas ilustrativo — os números acima são um layout de exemplo, não um resultado real.*

O composto (composite) combina várias métricas — precisão no nível do caractere (chrF++), validade morfológica (aceitação FST), correspondência exata, precisão morfológica e preservação semântica — cada uma com um peso definido. **Os pesos e a fórmula exata do composto vivem em um só lugar: a [Especificação de Pontuação](/docs/network/specifications/scoring), a única fonte da verdade.** Leia-os na especificação em vez de copiar números de uma página de guia — eles podem mudar, e a especificação é canônica.

**Níveis de qualidade** (também definidos na [Especificação de Pontuação](/docs/network/specifications/scoring)):

| Nível | Faixa do Composto | O que significa |
|------|----------------|---------------|
| Linha de Base (Baseline) | 0.00–0.30 | Abaixo da [chance aleatória para o idioma](/docs/network/specifications/connection-strength) — toda ortografia tem um piso de chance diferente de zero, e isso difere por idioma |
| Emergente (Emerging) | 0.30–0.50 | Mostra potencial, mas não é utilizável |
| Funcional (Functional) | 0.50–0.70 | Utilizável com pós-edição |
| **Implantável (Deployable)** | **0.70–0.85** | **Pronto para produção com revisão de falantes** |
| Fluente (Fluent) | 0.85–1.00 | Qualidade quase nativa |

Detalhes completos: [Especificação de Pontuação](/docs/network/specifications/scoring)

---

## Envie para o Placar de Líderes (Leaderboard)

Quando você estiver satisfeito com sua pontuação:

1. **Pontue sua execução** — `mt-eval test eval/logs/your_run.json` produz um TestReport pontuado
2. **Revise suas pontuações** — `mt-eval dashboard eval/logs/your_run.json` gera um painel visual
3. **Envie** — siga o guia [Enviar um Método](/docs/network/getting-started/submit-a-method)

Cada envio recebe uma impressão digital (fingerprint) vinculada a uma configuração específica e versão do conjunto de dados. Não há ambiguidade sobre o que foi testado.

---

## Contribuição e Prêmios

A coisa mais útil que você pode fazer agora é **preencher o mapa**: execute benchmarks da fila pública. Cada execução adiciona um ponto de dados ao placar de líderes e à malha de tradução, independentemente de haver algum prêmio ativo. Consulte [Contribuindo com Computação](/docs/network/getting-started/contributing-compute).

:::note[Prêmios, quando existem, são secundários]
A Rede às vezes apoia prêmios patrocinados para chamar a atenção para pares específicos mal atendidos. Eles são uma maneira de direcionar o esforço para onde é mais necessário — não o objetivo da plataforma, e não um torneio. Verifique a [Especificação de Prêmios](/docs/network/specifications/prizes) para o status atual; os prêmios podem ou não estar ativos em um determinado momento.
:::

### Arquitetura Anti-Trapaça (Anti-Gaming)

Seja competindo por prêmios ou realizando benchmarks para o placar de líderes, a arquitetura de avaliação evita trapaças (gaming):

- **Corpora de teste secretos.** A avaliação final é executada contra dados padrão-ouro (gold-standard) que os desenvolvedores nunca veem. O conjunto de desenvolvimento (dev set) no qual você pratica é *diferente* do conjunto de teste secreto. O overfitting no conjunto de desenvolvimento não será transferido.
- **Execução em sandbox.** A organização de governança executa seu método em um ambiente controlado. Você envia o método, não as pontuações.
- **Validação da comunidade.** Mesmo que suas métricas sejam perfeitas, falantes bilíngues devem confirmar que a saída é realmente utilizável.
- **Verificação de reprodutibilidade.** A organização de governança deve reproduzir suas pontuações dentro de ±2%. Execuções de sorte isoladas não contam.

### Construindo um Método Forte

:::tip[Onde está a oportunidade]
O problema central é a **alucinação morfológica** — LLMs produzem strings que se parecem com Cree, mas não são formas de palavras reais. Os métodos atuais pontuam 70-85% de aceitação FST. Os limites de qualidade exigem 99%+. A lacuna é solucionável com a abordagem certa.
:::

1. **Comece com o conjunto de desenvolvimento.** Execute linhas de base (baselines) contra um corpus de avaliação registrado para entender a qualidade atual:
   ```bash
   mt-eval run --corpus eval-amh-fra-globalvoices-test-v1 -m gemini-2.5-flash
   mt-eval test eval/logs/your_run.json
   ```

2. **Estude o que falha.** Observe as palavras rejeitadas pelo FST — estas são as formas alucinadas. Entenda os padrões morfológicos que o modelo erra.

3. **Construa um pipeline híbrido.** As abordagens mais promissoras combinam:
   - **Geração por LLM** — para qualidade de tradução e precisão semântica
   - **Validação FST** — o FST do GiellaLT captura formas de palavras inválidas; use-o como um filtro
   - **Tentar novamente ao rejeitar (Retry on reject)** — regenere palavras que o FST rejeita, possivelmente com dicas morfológicas
   - **Dados de treinamento (Coaching data)** — injete regras linguísticas, tabelas de paradigmas e entradas de dicionário no prompt
   - **Aumento por dicionário** — faça referência cruzada com um dicionário bilíngue para validar ou substituir as escolhas do LLM

4. **Itere no conjunto de desenvolvimento.** O conjunto de desenvolvimento é seu para experimentar livremente. Acompanhe suas pontuações do composto, aceitação FST e chrF++.

5. **Envie para o placar de líderes** — mesmo sem um prêmio, resultados fortes ganham visibilidade e impulsionam o campo.

### O Que Acontece Se Você Ganhar um Prêmio

- **Você mantém:** Atribuição, direitos de publicação, seu nome no placar de líderes
- **A comunidade recebe:** O direito de usar, modificar, implantar e monetizar seu método para o idioma deles
- **O que é transferido:** Todos os prompts, dados de treinamento, código do pipeline, configuração — a receita completa. Se o seu método usar um LLM comercial (Classe A1), apenas a receita é transferida; a comunidade pode apontá-la para qualquer modelo compatível.

Detalhes completos: [Especificação de Prêmios](/docs/network/specifications/prizes) | [Interface do Método](/docs/network/specifications/methods#method-validity-and-dependency-classes)

---

## Implante em Produção

Métodos comprovados podem ser implantados via [champollion](https://champollion.dev), a CLI de tradução em produção. A mesma interface que o harness avalia se torna um plugin que traduz conteúdo real.

```bash
# Export your benchmark as a champollion plugin
mt-eval export --report eval/logs/report.json --name crk-v1 --type llm-coached --locales crk
```

**[→ Implantar em Produção](/docs/network/getting-started/deploy-to-production)** — leve seu método da Rede para a produção.

---

## Solução de Problemas

| Problema | Solução |
|---------|-----|
| `OPENROUTER_API_KEY not set` | Exporte a chave ou adicione-a ao `.env` (veja a configuração acima) |
| `Model not found` | Execute `mt-eval list models --live` para navegar pelos modelos disponíveis |
| Todas as traduções estão vazias | Verifique se sua chave de API tem créditos. Tente `--dry-run` primeiro |
| `ModuleNotFoundError` | Certifique-se de ter ativado o venv e executado `pip install -e .` |
| Log de execução não salvo | Verifique `eval/logs/` — os logs são nomeados por carimbo de data/hora (timestamp) |

---

## Veja Também

- [Especificação de Prêmios](/docs/network/specifications/prizes) — estrutura do prêmio, limites e processo de reivindicação
- [Enviar um Método](/docs/network/getting-started/submit-a-method) — guia de envio passo a passo
- [Especificação de Pontuação](/docs/network/specifications/scoring) — definições completas de métricas e pesos
- [Especificação do Harness](/docs/network/specifications/harness) — referência de arquitetura e configuração
- [Regras do Placar de Líderes](/docs/network/leaderboard/rules) — requisitos de envio
- [Soberania de Dados](/docs/network/sovereignty/data-sovereignty) — princípios indígenas de soberania de dados, CARE e governança da comunidade
- **Quer usar um método existente?** Consulte o [Guia do Agente champollion](https://champollion.dev/docs/guides/agent-guide) — instale e traduza com um comando.
