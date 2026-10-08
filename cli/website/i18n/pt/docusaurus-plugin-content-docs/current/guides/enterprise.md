---
sidebar_position: 7
title: "Para Empresas"
description: "Como organizações podem padronizar tradução com métodos comprovados em leaderboard, plugins customizados e deployment em um único comando."
---

# champollion para Empresas

Sua equipe traduz conteúdo regularmente. Você tem um monte de arquivos de locale, um pipeline de CI, e um processo que provavelmente envolve alguém executando manualmente o Google Translate, copiando resultados em JSON, e torcendo para dar certo. Ou você está pagando por uma plataforma TMS onde fica preso ao mecanismo de tradução de um único fornecedor.

champollion oferece uma opção mais tranquila: escolha o método certo para cada idioma — máquina ou humano — e execute todos através de um único comando.

## Por que equipes usam champollion

1. **Escolha o método certo para cada idioma** — máquina ou humano, não o que seu fornecedor padroniza
2. **Implante com um comando** — `npx champollion sync` traduz cada locale, cada formato, toda vez
3. **Troque métodos sem alterar código** — uma mudança de config, não uma migração
4. **Controle seu pipeline** — sem lock-in de fornecedor, sem dashboards mensais, sem contas

```json title="champollion.config.json"
{
  "version": 3,
  "pairs": {
    "en:fr": { "method": "deepl" },
    "en:ja": { "method": "llm", "model": "google/gemini-3.1-pro-preview" },
    "en:de": { "method": "google-translate" },
    "en:ko": { "method": "llm", "register": "polite-haeyo" },
    "en:es": { "method": "api", "endpoint": "https://review.your-lsp.example/mtpe" },
    "en:crk": { "method": "llm-coached" }
  }
}
```

O francês fica com o DeepL (sua equipe prefere sua fluência europeia). O japonês fica com um LLM de ponta. O alemão fica com o Google Translate (rápido, barato, bom o suficiente). O coreano fica com um LLM com registro formal. O espanhol é direcionado a um serviço profissional humano / MTPE por meio do método `api` — a tradução humana é um método de primeira classe aqui, não um mero adendo. O cree das planícies fica com o método de LLM orientado, com notas gramaticais e um dicionário fornecido por você.

**Mesmo comando. Mesmo pipeline de CI. Métodos diferentes por par — humano ou máquina. Um arquivo de config.**

:::note[Métodos para línguas comunitárias são soberanos]
O par de cree das planícies acima não é apenas mais um par. Os métodos para línguas indígenas e outras línguas comunitárias são **de propriedade e governança comunitárias**: a comunidade detém as chaves dos dados por trás deles, define os termos de uso, e qualquer corpus ou método não comercial (NC) é excluído de fluxos comerciais por padrão. Se o seu uso for comercial, verifique a licença do método antes de colocar em produção. Consulte [Soberania de dados](/docs/network/sovereignty/data-sovereignty).
:::

## Workflow Leaderboard → Deploy

:::tip[O `champollion network leaderboard` já vem com a CLI]
O fluxo de trabalho abaixo é executado pelo comando `champollion network leaderboard` — navegue pela tabela de classificação da [Rede](/arena) diretamente do seu terminal e instale um plugin de método a partir dela. Consulte a [referência da CLI](/docs/reference/cli#leaderboard) para conferir todas as opções.
:::

A [Rede](/arena) é onde os métodos de tradução passam por benchmark com pontuações reproduzíveis e com fingerprint. As execuções são classificadas da forma como a área de MT as classifica: pelo chrF++ em nível de corpus com seu intervalo de confiança de 95%. BLEU, TER e COMET são exibidos ao lado, e diagnósticos como correspondência exata e aceitação de FST são relatados separadamente, nunca misturados à métrica principal. Determinar se um método é genuinamente melhor do que outro é uma questão de teste de significância pareado, e não uma diferença entre dois números. A tabela de classificação acompanha cada envio.

O fluxo de trabalho:

```bash
# Browse the leaderboard from your terminal
npx champollion network leaderboard --pair "eng>fra"

# Output (abridged):
#   #   Model         chrF++ [95% CI]      BLEU   …   EM     FST
#   1   gemini-3.5    72.3 [70.8, 73.7]    48.1   …   0.31   —
#   2   deepl         70.9 [69.2, 72.4]    46.0   …   0.29   —
#   3   claude-4      68.4 [66.9, 70.0]    43.7   …   0.27   —
#   Headline: chrF++ with its 95% bootstrap CI; rows whose intervals overlap are not distinguishable.

# Install the method that fits as a plugin (by its rank)
npx champollion network leaderboard --install 1

# Use it
npx champollion sync
```

*Apenas ilustrativo — as linhas da tabela de classificação acima são um exemplo de layout. Neste exemplo, os intervalos das duas primeiras linhas se sobrepõem, portanto a tabela não indica que um seja melhor que o outro. A tabela está atualmente aberta para envios e ainda não possui execuções publicadas.*

**Você não constrói o método. Você não treina o modelo. Você escolhe o método que se encaixa no seu domínio, orçamento e licença — humano ou máquina — e faz o deploy.** Se um método mais adequado aparecer no próximo mês, você o troca com um comando.

## O Que Está Disponível Hoje

A ponte leaderboard-para-CLI está em desenvolvimento. Aqui está o que funciona agora:

### Métodos integrados (sem plugins necessários)

| Método | Melhor Para | Custo |
|--------|----------|------|
| `llm` (padrão) | Focado em qualidade, qualquer idioma | Por token via OpenRouter |
| `gemini` | Qualidade + tier gratuito | Gratuito (limitado), depois por token |
| `google-translate` | Velocidade + volume | $20/M caracteres |
| `deepl` | Idiomas europeus | $25/M caracteres |
| `llm-coached` | Idiomas com dados de coaching | Por token via OpenRouter |
| `api` | Métodos customizados/hospedados pela comunidade | Auto-hospedado |

### Métodos de plugin (instale separadamente)

Plugins customizados podem envolver qualquer lógica de tradução — um modelo fine-tuned, um pipeline com gate FST, uma API comunitária, ou qualquer coisa que produza JSON. Veja [Build a Plugin](/docs/tutorials/build-a-plugin).

## Workflow Empresarial

### 1. Avalie sua qualidade atual

```bash
# See what you're getting today
npx champollion status

# Output shows: method per pair, cache hit rate, quality gate stats
```

### 2. Execute o harness de eval em candidatos

O [eval harness](/docs/network/specifications/harness) permite que você avalie múltiplos métodos contra o mesmo dataset. Execute um sweep, compare pontuações, escolha vencedores:

```bash
# In the eval harness repo
python -m mt_eval_harness.run \
  --methods coached-v3 baseline prompt-tuned \
  --dataset data/your-corpus.json
```

### 3. Configure vencedores por par

Atualize sua config para usar o melhor método por par de idiomas. Idiomas diferentes têm métodos melhores diferentes — esse é o ponto.

### 4. Integre em CI/CD

```bash
# In your CI pipeline — pinned to the 0.5 line, so a new release never
# changes what the pipeline runs (the CI guide has the complete workflow)
npx --yes champollion@0.5 lint        # Catch hardcoded strings
npx --yes champollion@0.5 sync        # Translate what changed
npx --yes champollion@0.5 audit       # Fail if any locale is incomplete
npx --yes champollion@0.5 integrity   # Validate placeholder consistency
```

Três comandos. Zero tradução manual. O pipeline detecta strings hardcoded, traduz-as com seus métodos escolhidos, e falha o build se algo estiver faltando ou corrompido.

### 5. Revisão profissional (opcional)

Para conteúdo crítico, exporte para XLIFF para revisão humana:

```bash
npx champollion xliff export --locale ja --out translations.xliff
# → Send to your translation agency
# → Import corrections back:
npx champollion xliff import translations.xliff
```

Traduza em massa com máquina. Revise criticamente os caminhos críticos com humanos. Pague por tempo humano apenas onde importa.

## Modelo de Custo

O champollion **não tem assinatura nem cobrança por usuário**. A CLI tem código disponível sob a PolyForm Noncommercial 1.0.0 — gratuita para uso não comercial: pesquisa, educação, organizações sem fins lucrativos, hospitais e clínicas públicas, governo, projetos pessoais. O uso para fins comerciais, como o produto de uma empresa com fins lucrativos, não é coberto por essa licença. Verifique [quem pode usar](/docs/getting-started/who-may-use-this) antes de adotá-lo. Fora isso, você paga apenas pelas chamadas de API de tradução:

| Volume | Google Translate | LLM (Gemini Flash) | LLM (GPT-4o) |
|--------|-----------------|---------------------|---------------|
| 1.000 chaves × 5 locales | ~$0,50 | ~$0,30 (tier gratuito) | ~$2,00 |
| 10.000 chaves × 15 locales | ~$15 | ~$8 | ~$60 |
| 50.000 chaves × 30 locales | ~$75 | ~$40 | ~$300 |

Translation Memory significa que você paga apenas por **chaves alteradas** em sincronizações subsequentes. Se você atualizar 10 strings de 10.000, você paga por 10 traduções, não 10.000.

## vs. Plataformas TMS

| | champollion | Crowdin / Phrase / Locize |
|---|---|---|
| **Preço** | Gratuito para uso não comercial ([quem pode usar](/docs/getting-started/who-may-use-this)) + custos de API | $50–$500/mês + por usuário |
| **Vendor lock-in** | Nenhum — troque de provedor na configuração | Alto — dados na nuvem deles |
| **Escolha de método** | Qualquer provedor, qualquer modelo, por par | O que eles oferecerem |
| **CI/CD** | De primeira classe (`lint → sync → audit`) | Plugin/webhook |
| **Métodos personalizados** | Sistema de plugins, plugins da comunidade | Não suportado |
| **Quality gate** | Integrado (wrong-script, echo, length) | Varia |
| **Autohospedado** | Sim (LibreTranslate, API personalizada) | Não |

Veja a [comparação completa](/docs/guides/comparison) para detalhes.

## Leitura Adicional

- **[Quick Start](/docs/getting-started/quick-start)** — execute sua primeira sincronização em 60 segundos
- **[Translation Methods](/docs/guides/translation-methods)** — o menu completo de métodos com árvore de decisão
- **[CI/CD Integration](/docs/guides/ci-cd)** — automatize em seu pipeline
- **[Working with Professional Translators](/docs/guides/professional-translators)** — exportação/importação XLIFF
- **[the Network](/arena)** — benchmark e leaderboard
- **[Configuration Reference](/docs/getting-started/configuration)** — cada opção de config
