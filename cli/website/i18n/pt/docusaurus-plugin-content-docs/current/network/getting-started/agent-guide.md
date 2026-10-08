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
python3 -m pip install mt-eval-harness
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
|------|-----------|
| `-m <model>` | Slug do modelo no OpenRouter (separe por vírgulas para execuções paralelas com vários modelos). Com `--method <plugin dir>`, o modelo passado para o plugin (`config.method_model`, na nomenclatura própria do plugin), registrado no cartão de execução e em sua impressão digital (fingerprint) |
| `-n, --name <name>` | Rótulo legível para humanos para sua execução (aparece no leaderboard) |
| `--temperature <float>` | Temperatura de amostragem (menor = mais determinístico) |
| `--batch-size <n>` | Entradas por chamada de API (padrão: 25) |
| `--dry-run` | Valida a configuração sem fazer chamadas de API. Informa o arquivo de coaching e o glossário, e relata a verificação do pacote de avaliação na qual a execução real é interrompida, em linhas que começam com `EVAL PACK:` (`--json`: um objeto `eval_pack` com `status`, `missing`, `setup_command`) |
| `--ids 0,1,2,3` | Executa apenas IDs de entrada específicos |

```bash
# Multi-model comparison (runs in parallel)
mt-eval run --corpus eval-amh-fra-globalvoices-test-v1 -m google/gemini-2.5-flash,anthropic/claude-sonnet-4,openai/gpt-4.1

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

**Ou aponte a CLI para ela.** Coloque a classe em um diretório com um `method.json` nomeando-a — `{"name": "My method", "method_id": "my-method", "entry_point": "my_module:YourMethod"}` — e execute `mt-eval run --corpus … --method ./that-dir`. `translate` é o único membro que a classe precisa ter: o harness extrai o `name` do método e seu cartão de método (`method_id`, `class`, `paradigm`, …) a partir de `method.json`, definindo o padrão de `class` como `custom-plugin` e de `paradigm` como `unknown`, e informa isso na saída da execução. Um plugin que não puder ser carregado gera um único erro listando tudo o que está incorreto. O contrato completo está na [Especificação de métodos](/docs/network/specifications/methods#eval-harness-translationmethod-protocol).

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
    summary = results["_summary"]
    print(f"chrF++: {summary['scores']['corpus_chrf']}")   # corpus-level
    print(f"Report: {summary['report_path']}")            # what `mt-eval publish` takes

asyncio.run(main())
```

O cartão de execução montado para o leaderboard abre com o mesmo chrF++ de nível de corpus e seu intervalo de confiança de 95%. Execute `mt-eval publish <report> --dry-run` para ver o cartão sem publicar.

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

Após `mt-eval test`, o resumo é apresentado da seguinte forma:

```
  Headline:         chrF++ 47.5 [45.9, 49.0]  (corpus, 0-100; 95% bootstrap CI)
  Signature:        nrefs:1|case:mixed|eff:yes|nc:6|nw:2|space:no|version:2.4.3

  Beside it (standard metrics, never blended):
  Corpus BLEU:      21.3  [19.8 – 22.9]
  Corpus spBLEU:    24.0
  Corpus TER:       61.2  (lower is better)

  Diagnostics (reported separately; never in the headline):
  Exact match:      10/62 (16.1%)
```

*Apenas ilustrativo — os números acima são um layout de exemplo, não um resultado real.*

As execuções são pontuadas da mesma maneira que a área relata a avaliação de MT:

- **O destaque** é o chrF++ em nível de corpus (0–100) com seu intervalo de confiança bootstrap de 95% e sua assinatura sacreBLEU. É isso que classifica uma execução.
- **BLEU, spBLEU, TER e COMET** (quando calculados) são exibidos ao lado dele, cada um isoladamente. Nada é mesclado em um único número.
- **Diagnósticos** — correspondência exata, aceitação de FST, precisão morfológica, code-switching, alucinação, terminologia — são relatados separadamente. Eles ajudam você a ver *por que* uma execução obteve aquela pontuação; eles nunca a classificam.
- **Ressalvas de pontuação** são exibidas logo abaixo do destaque quando o harness detecta um padrão que torna o número enganoso (por exemplo, uma mesma saída repetida para cada entrada). Leia-as antes de confiar no número.

Não há rótulos de qualidade. Uma pontuação automática não é um veredito de qualidade; apenas os falantes do idioma podem dizer se o resultado é utilizável. A pontuação composta ponderada e seus níveis ("funcional", "implantável", …) foram descontinuados — veja o [motivo](/docs/network/specifications/scoring#why-the-composite-was-retired). Para decidir se uma execução supera outra, use um teste de significância pareado (`mt-eval compare --significance`), não dois números lado a lado.

Detalhes completos: [Como as execuções são pontuadas](/docs/network/specifications/scoring#how-runs-are-scored)

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
O problema central é a **alucinação morfológica** — LLMs produzem cadeias de caracteres que parecem Cree, mas não são formas de palavras reais. Os métodos atuais alcançam 70-85% de aceitação no FST; o critério de FST da especificação de prêmios exige 99%+. Essa lacuna pode ser resolvida com a abordagem certa.
:::

1. **Comece com o dev set.** Execute baselines contra um corpus de avaliação registrado para entender a qualidade atual:
   ```bash
   mt-eval run --corpus eval-amh-fra-globalvoices-test-v1 -m google/gemini-2.5-flash
   mt-eval test eval/logs/your_run.json
   ```

2. **Estude o que falha.** Observe as palavras rejeitadas pelo FST — estas são as formas alucinadas. Entenda os padrões morfológicos que o modelo erra.

3. **Construa um pipeline híbrido.** As abordagens mais promissoras combinam:
   - **Geração por LLM** — para qualidade de tradução e precisão semântica
   - **Validação FST** — o FST do GiellaLT captura formas de palavras inválidas; use-o como um filtro
   - **Tentar novamente ao rejeitar (Retry on reject)** — regenere palavras que o FST rejeita, possivelmente com dicas morfológicas
   - **Dados de treinamento (Coaching data)** — injete regras linguísticas, tabelas de paradigmas e entradas de dicionário no prompt
   - **Aumento por dicionário** — faça referência cruzada com um dicionário bilíngue para validar ou substituir as escolhas do LLM

4. **Itere no dev set.** O dev set é seu para experimentar livremente. Acompanhe o chrF++ com seu intervalo de confiança e observe o diagnóstico de aceitação no FST e quaisquer ressalvas de pontuação.

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
|----------|---------|
| `OPENROUTER_API_KEY not set` | Exporte a chave ou adicione-a ao `.env` (veja a configuração acima) |
| `Model not found` | Execute `mt-eval list models --live` para navegar pelos modelos disponíveis |
| Todas as traduções estão vazias | Verifique se sua chave de API possui créditos. Tente `--dry-run` primeiro |
| `ModuleNotFoundError` | Certifique-se de que ativou o venv e executou `python3 -m pip install -e .` |
| Log de execução não foi salvo | Verifique `eval/logs/` — os logs são nomeados com carimbos de data/hora (timestamp) |

---

## Veja Também

- [Especificação de Prêmios](/docs/network/specifications/prizes) — estrutura do fundo de prêmios, limites e processo de reivindicação
- [Enviar um Método](/docs/network/getting-started/submit-a-method) — guia passo a passo para envio
- [Especificação de Pontuação](/docs/network/specifications/scoring) — definições completas de métricas e pesos
- [Especificação do Harness](/docs/network/specifications/harness) — referência de arquitetura e configuração
- [Regras do Leaderboard](/docs/network/leaderboard/rules) — requisitos de envio
- [Soberania de Dados](/docs/network/sovereignty/data-sovereignty) — princípios indígenas de soberania de dados, CARE e governança comunitária
- **Quer usar um método existente?** Consulte o [Guia do Agente do Champollion](https://champollion.dev/docs/guides/agent-guide) — instale e traduza com um único comando.
