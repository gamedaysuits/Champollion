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
    "en:ja": { "method": "llm", "model": "google/gemini-2.5-pro" },
    "en:de": { "method": "google-translate" },
    "en:ko": { "method": "llm", "register": "polite-haeyo" },
    "en:es": { "method": "api", "endpoint": "https://review.your-lsp.example/mtpe" },
    "en:crk": { "methodPlugin": "crk-coached-v3" }
  }
}
```

Francês usa DeepL (sua equipe prefere sua fluência europeia). Japonês usa um LLM de fronteira. Alemão usa Google Translate (rápido, barato, bom o suficiente). Coreano usa um LLM com registro formal. Espanhol roteia para um serviço profissional humano / MTPE via método `api` — tradução humana é um método de primeira classe aqui, não um complemento. Cree das Planícies usa um plugin construído e possuído pela comunidade.

**Mesmo comando. Mesmo pipeline de CI. Métodos diferentes por par — humano ou máquina. Um arquivo de config.**

:::note[Métodos de línguas comunitárias são soberanos]
O plugin Plains Cree acima não é apenas "mais um método". Métodos para línguas indígenas e outras línguas comunitárias são **de propriedade e governança comunitária**: a comunidade detém as chaves dos dados por trás deles, estabelece os termos de uso, e qualquer corpus ou método não comercial (NC) é separado de caminhos comerciais por padrão. Se seu uso é comercial, verifique a licença do método antes de fazer o deploy. Veja [Data Sovereignty](/docs/network/sovereignty/data-sovereignty).
:::

## Workflow Leaderboard → Deploy

:::tip[O `champollion leaderboard` acompanha a CLI]
O fluxo de trabalho abaixo é executado no comando `champollion leaderboard` — navegue pelo placar de líderes da [Rede](/arena) a partir do seu terminal e instale um plugin de método diretamente dele. Consulte a [referência da CLI](/docs/reference/cli#leaderboard) para ver todas as opções.
:::

O [Network](/arena) é onde métodos de tradução são avaliados com pontuação reproduzível e com impressão digital. Cada método recebe uma pontuação composta em múltiplas métricas (chrF++, correspondência exata, aceitação FST, pontuação semântica). O leaderboard rastreia cada submissão.

O fluxo de trabalho:

```bash
# Browse the leaderboard from your terminal
npx champollion leaderboard --pair en:crk

# Output:
# ┌──────┬───────────────────────┬────────────┬──────────┬───────────┐
# │ Rank │ Method                │ Model      │ chrF++   │ Composite │
# ├──────┼───────────────────────┼────────────┼──────────┼───────────┤
# │  1   │ crk-coached-v3        │ gemini-2.5 │ 43.2     │ 0.67      │
# │  2   │ fst-gated-pipeline    │ gpt-4o     │ 41.8     │ 0.63      │
# │  3   │ prompt-baseline       │ claude-4   │ 38.1     │ 0.55      │
# └──────┴───────────────────────┴────────────┴──────────┴───────────┘

# Install the method that fits as a plugin
npx champollion leaderboard --install crk-coached-v3

# Use it
npx champollion sync
```

*Apenas ilustrativo — as linhas do leaderboard acima são um exemplo de layout. O board está atualmente aberto para submissões e não tem execuções publicadas ainda.*

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
# In your CI pipeline
npx champollion lint        # Catch hardcoded strings
npx champollion sync        # Translate what changed
npx champollion audit       # Fail if any locale is incomplete
npx champollion integrity   # Validate placeholder consistency
```

Três comandos. Zero tradução manual. O pipeline detecta strings hardcoded, traduz-as com seus métodos escolhidos, e falha o build se algo estiver faltando ou corrompido.

### 5. Revisão profissional (opcional)

Para conteúdo crítico, exporte para XLIFF para revisão humana:

```bash
npx champollion xliff export --locale ja --output translations.xliff
# → Send to your translation agency
# → Import corrections back:
npx champollion xliff import translations.xliff
```

Traduza em massa com máquina. Revise criticamente os caminhos críticos com humanos. Pague por tempo humano apenas onde importa.

## Modelo de Custo

O champollion **não possui assinatura nem cobrança por usuário**. A CLI tem código-fonte disponível sob a licença PolyForm Noncommercial 1.0.0 — gratuita para uso não comercial (pesquisa, educação, trabalho comunitário); o uso comercial requer permissão, portanto, [fale conosco](/get-involved) primeiro. Além disso, você paga apenas pelas chamadas de API de tradução:

| Volume | Google Translate | LLM (Gemini Flash) | LLM (GPT-4o) |
|--------|-----------------|---------------------|---------------|
| 1.000 chaves × 5 locales | ~$0,50 | ~$0,30 (tier gratuito) | ~$2,00 |
| 10.000 chaves × 15 locales | ~$15 | ~$8 | ~$60 |
| 50.000 chaves × 30 locales | ~$75 | ~$40 | ~$300 |

Translation Memory significa que você paga apenas por **chaves alteradas** em sincronizações subsequentes. Se você atualizar 10 strings de 10.000, você paga por 10 traduções, não 10.000.

## vs. Plataformas TMS

| | champollion | Crowdin / Phrase / Locize |
|---|---|---|
| **Preço** | Gratuito para uso não comercial (comercial com permissão) + custos de API | US$ 50–US$ 500/mês + por usuário |
| **Dependência de fornecedor** | Nenhuma — troque de provedor na configuração | Alta — dados na nuvem deles |
| **Escolha de método** | Qualquer provedor, qualquer modelo, por par | O que eles oferecerem |
| **CI/CD** | De primeira classe (`lint → sync → audit`) | Plugin/webhook |
| **Métodos personalizados** | Sistema de plugins, plugins da comunidade | Não suportado |
| **Controle de qualidade** | Integrado (wrong-script, echo, length) | Varia |
| **Auto-hospedado** | Sim (LibreTranslate, API personalizada) | Não |

Veja a [comparação completa](/docs/guides/comparison) para detalhes.

## Leitura Adicional

- **[Quick Start](/docs/getting-started/quick-start)** — execute sua primeira sincronização em 60 segundos
- **[Translation Methods](/docs/guides/translation-methods)** — o menu completo de métodos com árvore de decisão
- **[CI/CD Integration](/docs/guides/ci-cd)** — automatize em seu pipeline
- **[Working with Professional Translators](/docs/guides/professional-translators)** — exportação/importação XLIFF
- **[the Network](/arena)** — benchmark e leaderboard
- **[Configuration Reference](/docs/getting-started/configuration)** — cada opção de config
