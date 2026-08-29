---
sidebar_position: 4
title: "Contribuindo Computação"
description: "Execute a fila: execute sweeps de benchmark abertos da fila pública com sua própria chave de API e publique os resultados."
related:
  - label: "Agent Guide: Building & Benchmarking on the Network"
    to: /docs/network/getting-started/agent-guide
    kind: guide
  - label: "Cookbook: Coached LLM Prompting"
    to: /docs/network/tutorials/coached-llm-prompting
    kind: cookbook
  - label: "Cookbook: FST-Gated Pipeline"
    to: /docs/network/tutorials/fst-gated-pipeline
    kind: cookbook
  - label: "Method Interface & Dependency Classes"
    to: /docs/network/specifications/methods
    kind: spec
  - label: "Leaderboard Rules & Trust Tiers"
    to: /docs/network/leaderboard/rules
    kind: guide
---

# Contribuindo Compute

> **A ideia:** o placar de líderes possui quadrados vazios — combinações de (par de idiomas, método, condição) que ninguém mediu. Nós mantemos uma fila pública deles. Você executa os itens com sua própria chave de API, publica os relatórios e o mapa se preenche. Contribuir com poder computacional é uma contribuição real e citável para a avaliação de MT de poucos recursos.

A fila contém dois tipos de trabalho. **Itens de LLM** testam um modelo de chat em um par de idiomas, em uma condição de prompting `naive` ou `coached`. **Itens de motor** (condição `engine`) testam um serviço clássico de MT — DeepL, Google Translate, Microsoft Translator, LibreTranslate, Tilde — em pares dentro da própria cobertura publicada desse serviço; estes são a espinha dorsal medida do mapa de cobertura e, até 2026-08, estavam quase totalmente em branco. Ambos os tipos são executados através do mesmo harness e publicados no mesmo placar.

## A fila

A fila em tempo real é servida a partir do banco de dados (o harness a lê por padrão); um snapshot compacto é publicado em [champollion.dev/queue-preview.json](https://champollion.dev/queue-preview.json), com o arquivo completo em [queue.json](https://champollion.dev/queue.json) (dezenas de MB — o preview é a primeira busca ideal). Você pode acompanhar o que suas execuções constroem no [mapa em tempo real em champollion.dev](https://champollion.dev) — o mapa de cobertura de quem pode traduzir o quê. Há também um visualizador de terminal sem instalação:

```bash
curl -fsSL https://champollion.dev/run_queue | bash -s -- --budget 2
```

O visualizador apenas *exibe* itens abertos e seus comandos `mt-eval run` exatos — nunca executa nada ou gasta seus tokens. Cada item carrega:

- `run_command` — pronto para copiar e colar (busca o corpus, executa o harness)
- `est_cost_usd` e `est_basis` — seja o custo **observado** da nossa própria execução de referência do mesmo (corpus, modelo), ou uma **extrapolação** do custo médio de varredura desse modelo por entrada × a contagem de entradas do corpus. A base é declarada por item; seu custo real depende dos preços do provedor no momento da execução.
- `priority` — o ranking publicado (modo de pesquisa: primeira luz através de pares, idiomas e famílias por dólar). O preview também publica **faixas de orçamento** — o que $1 / $10 / $100 / $1000 compra do topo do ranking (itens, pares, modelos alcançados) — para que você possa dimensionar uma contribuição antes de gastar qualquer coisa. O modelo de valor subjacente é o **valor esperado da cadeia**: o quanto se prevê que esta única execução fortaleça toda a malha de idiomas, por dólar estimado. Cada item carrega o detalhamento completo de sua fórmula (`edge_strength`, `pair_prior`, `model_offset`, `exploration_bonus`, `predicted_strength`, `expected_mesh_gain`, `ecv_per_usd`) para que qualquer classificação possa ser re-derivada à mão — a fórmula e seus padrões são publicados na [Especificação de Construção da Fila](/docs/network/specifications/queue-construction), e o raciocínio por trás disso em [Por Que a Fila é Construída Desta Forma](/docs/network/perspectives/why-the-queue).

**Sem bloqueio de reivindicação — escolha qualquer item aberto.** Duas pessoas executando o mesmo item é inofensivo por design: cada cartão de execução é impressionado digitalmente (SHA-256 sobre hash do dataset + modelo + condição + prompt do sistema, [Benchmark Spec §3.8](/docs/network/specifications/benchmark)), então execuções idênticas se deduplicam na publicação, e replicações independentes da mesma configuração são evidência útil, não desperdício.

Os corpora enfileirados são dev-split, CC-BY-family (derivados de Tatoeba), e sinalizados `do_not_train` — são conjuntos de avaliação, não dados de treinamento. Corpora com licenças não comerciais e em quarentena são excluídos da fila aberta.

## Configuração (uma vez)

```bash
# 1. Install the harness (python3 + pipx, no sudo — read it first if you like)
pipx install mt-eval-harness

# 2. Set your API key — any ONE of these; the harness auto-detects it
export OPENROUTER_API_KEY="sk-or-..."     # reaches every model in the queue
# or a direct vendor key:
#   ANTHROPIC_API_KEY / OPENAI_API_KEY / GOOGLE_API_KEY
# (any of them can also live in a local .env file)
```

### Qual chave de provedor?

O harness aceita quatro chaves de provedor, selecionadas com `--provider` em `mt-eval run` e `mt-eval queue` — ou detectadas automaticamente de qualquer chave definida em seu ambiente ou `.env`:

| `--provider` | Chave | Alcança |
|---|---|---|
| `openrouter` (padrão) | `OPENROUTER_API_KEY` | todos os modelos no lineup da fila |
| `anthropic` | `ANTHROPIC_API_KEY` | modelos Anthropic Claude |
| `openai` | `OPENAI_API_KEY` | modelos OpenAI GPT |
| `gemini` | `GOOGLE_API_KEY` | modelos Google Gemini |

Uma chave [OpenRouter](https://openrouter.ai/keys) alcança todos os modelos no lineup, e o rastreamento de custo do harness e snapshots de preços vêm dos mesmos metadados do OpenRouter, então o custo de execução relatado corresponde ao que sua chave foi cobrada — é por isso que é o padrão. Se seus créditos estão com Anthropic, OpenAI ou Google diretamente, defina a chave daquele fornecedor e o harness chama a API do fornecedor sem proxy. Uma chave direta alcança apenas os próprios modelos daquele fornecedor (bom para um lote de um único fornecedor), e suas figuras de custo vêm do preço publicado do fornecedor em vez de metadados cobrados — trate-as como estimativas próximas. Se tanto uma chave OpenRouter quanto uma chave direta estiverem definidas, a detecção automática escolhe OpenRouter; o worker da fila informa isso e como substituir com `--provider`. Cada cartão de execução registra qual lane foi executado através de seu campo `api_provider`.

(`mt-eval run` também aceita `--provider local` para endpoints compatíveis com OpenAI auto-hospedados — Ollama, vLLM, LM Studio — via `--base-url`. É um opt-in explícito, nunca detectado automaticamente.)

### Sem chave de API: execute um modelo auto-hospedado

Você não precisa de nenhuma chave de nuvem. O método `local-model` executa um modelo aberto de MT neural no seu próprio hardware — os modelos que os motores de nuvem não servem, que é exatamente onde reside a cobertura de poucos recursos: **NLLB-200**, **OPUS-MT** (Helsinki-NLP) e **MADLAD-400**.

```bash
# transformers backend (Hugging Face) — install the extra once:
pip install 'mt-eval[local-models]'

# then point --model at any Hugging Face id (or a local from_pretrained dir):
mt-eval run --method local-model \
  --model facebook/nllb-200-distilled-600M \
  --dataset flores-eng-fra
```

**Duas "maneiras habituais" de carregar um modelo, selecionadas automaticamente — nada para configurar:**

- **transformers** (padrão): `--model` é um ID do hub do Hugging Face (`facebook/nllb-200-distilled-600M`, `Helsinki-NLP/opus-mt-en-es`, `google/madlad400-3b-mt`) ou um diretório `from_pretrained()` local. Requer `pip install 'mt-eval[local-models]'`.
- **CTranslate2** (inferência rápida em CPU/GPU): `--model` é um diretório de modelo convertido para CTranslate2 (um produzido por `ct2-transformers-converter`, contendo um `model.bin`). Requer `pip install 'mt-eval[ctranslate2]'`. O tokenizador é lido a partir do diretório convertido, ou nomeado com `LOCAL_TOKENIZER_ID`.

O backend é detectado a partir do caminho do modelo (um diretório CTranslate2 possui um `model.bin`); force-o com `LOCAL_MODEL_BACKEND=transformers|ctranslate2` se você precisar.

**Os códigos de idioma vêm do cartão de idioma, não de um palpite.** Para um modelo multilíngue como o NLLB, o harness lê o código FLORES-200 diretamente do cartão do idioma de destino (a mesma fonte de verdade que todos os métodos usam). Um idioma que o modelo genuinamente não atende — o NLLB-200, por exemplo, não possui Plains Cree (`crk`) — **falha honestamente** ("fora do escopo para este modelo") em vez de emitir um código falso e uma tradução plausível, mas errada. Os modelos OPUS-MT são específicos para pares, então o par *é* o modelo.

A execução de um modelo local pontua e publica exatamente como qualquer outra execução — mesmas métricas, mesmo cartão de execução, mesmo placar de líderes. (É um método do harness; a ferramenta de tradução da CLI o acessa posteriormente por meio de uma ponte de subprocesso, para que o Node nunca precise de uma stack de ML em Python.)

### O caminho rápido do agente

Se você trabalha com Claude Code ou outro agente de codificação, toda a contribuição é um prompt:

```text
Install the Champollion mt-eval harness with `pipx install mt-eval-harness`.
Fetch https://champollion.dev/queue.json and show me the top 3 open items.
Using my API key (OPENROUTER_API_KEY, or a direct ANTHROPIC_API_KEY /
OPENAI_API_KEY / GOOGLE_API_KEY), execute the run_command of the
item I pick, then run `mt-eval publish` on the generated report JSON and
show me the published run card.
```

## Tier 0 — Um comando

A forma mais rápida de contribuir é deixar o harness pegar o topo da
fila para você:

```bash
mt-eval queue --top 5          # run the 5 highest-value open items
mt-eval queue --budget 2.50    # or: run from the top until ~$2.50 of
                               # estimated spend is committed
mt-eval queue --top 3 --dry-run   # see the plan first, spend nothing
```

Nunca reordena — a ordem da fila *é* o [modelo de
prioridade](/docs/network/specifications/queue-construction) — e mostra o plano completo
com gasto estimado e pede confirmação antes de executar qualquer coisa. Itens
treinados são pulados a menos que você traga seu próprio arquivo de treinamento
(`--include-coached --coaching-file my-coaching.txt`).

**O worker da fila publica para você — nenhuma conta necessária.** Diferentemente de um único
`mt-eval run` (que nunca publica automaticamente), `mt-eval queue` resolve uma
identidade de publicação *antes* de gastar qualquer token e **publica automaticamente cada
execução bem-sucedida** no leaderboard conforme é concluída — nenhuma etapa de publicação separada. Entre (GitHub/Google) apenas se quiser seu nome no quadro;
caso contrário, continue anonimamente e os resultados são postados como remetente `anonymous`
(`--anonymous` força isso, e execuções `curl | bash` não interativas sem sign-in em cache
padrão para isso, dizendo em voz alta). Passe `--no-publish` para
manter os resultados locais (você pode publicá-los depois com `mt-eval
publish`). Então acompanhe o que suas execuções construíram no
[mapa ao vivo em champollion.dev](https://champollion.dev).

## Tier 1 — Executar um benchmark

Cada `run_command` de item da fila é autossuficiente. Um típico:

```bash
mt-eval run --corpus eval-eng-yor-tatoeba-dev-v1 \
  --model anthropic/claude-haiku-4.5 \
  --target-lang "Yoruba" \
  --yes
```

Você passa o **id do registro**, não um arquivo — o harness busca a referência de
sua fonte upstream no momento da execução e pontua contra os dados recém-buscados
(o conteúdo do corpus nunca é hospedado ou rastreado aqui).

A execução imprime seu custo total e escreve um log de execução mais um relatório pontuado em `eval/logs/`. Depois publique:

```bash
mt-eval publish eval/logs/harness/run_..._report.json
```

**Nenhuma conta necessária.** Publicar oferece um sign-in OAuth (GitHub/Google) para que seu nome se torne a atribuição do leaderboard — mas é opcional: `mt-eval publish <report> --anonymous` publica sem uma conta, e a linha é exibida exatamente como qualquer outro resultado auto-avaliado com remetente `anonymous`. A entrada anônima é limitada por taxa (alguns cartões por hora por conexão; sign-in é o caminho ilimitado) e passa pelos mesmos portões de integridade do banco de dados que qualquer outra submissão — quarentena, intervalos de pontuação, vinculação de corpus-sha e a guarda de conteúdo do corpus se aplicam identicamente. Anônimo ou atribuído, as submissões da comunidade chegam ao nível de confiança **auto-avaliado** — claramente rotulado como "enviado pela pessoa que o executou." Isso não é uma degradação; é o modelo de confiança funcionando. O cartão de execução carrega tudo o que é necessário para qualquer pessoa re-executar sua configuração exata: hash do dataset, modelo, condição, o prompt do sistema completo e custo. Níveis elevados (verificação, validação da comunidade) são concedidos por revisão — veja [Regras do Leaderboard](/docs/network/leaderboard/rules).

:::note[Moderação]
Linhas anônimas são moderadas como tudo mais: submissões são imutáveis para a API pública, e qualquer remoção ou correção do curador passa pela lane de função de serviço, onde a trilha de auditoria do banco de dados preserva a linha anterior — então uma limpeza é registrada e reversível, nunca silenciosa.
:::

## Tier 2 — Criar prompts treinados

O harness tem suporte de primeira classe para **treinamento**: substitua o prompt do sistema ingênuo por um que carregue conhecimento linguístico real. Passe `--coaching-file` (ou `--coaching "inline text"` para prompts curtos) e o harness usa seu texto como o prompt do sistema, registra o **texto completo mais seu SHA-256** no bloco de proveniência do log de execução, e rotula a condição da execução como **`coached`** (a menos que você defina `--prompt` explicitamente) — então a criação de prompt é um experimento reproduzível e atribuível, dois arquivos de treinamento diferentes nunca podem ser confundidos um com o outro, e execuções treinadas nunca são confundidas com baselines ingênuos no leaderboard.

Um exemplo prático para Faroês, usando fatos de tipologia e entradas de glossário do [cartão de idioma público](https://champollion.dev/languages) da língua:

```text title="coaching-fao.txt"
You are translating English into Faroese (føroyskt).

Grammar notes:
- Faroese is a North Germanic V2 language: the finite verb is the second
  constituent of a main clause.
- Nouns inflect for case (nominative, accusative, dative, genitive),
  gender (masculine, feminine, neuter), and number. Make adjectives and
  determiners agree.
- The skerping pattern applies before -gv/-ggj sequences; preserve
  standard orthography including ð (which is silent).

Glossary (use these exact equivalents):
- language -> mál
- island -> oyggj
- weather -> veður

Style: plain register, modern standard orthography. Output only the
Faroese translation, no commentary.
```

```bash
mt-eval run --corpus eval-eng-fao-tatoeba-dev-v1 \
  --model anthropic/claude-haiku-4.5 \
  --target-lang "Faroese" \
  --coaching-file coaching-fao.txt \
  --yes
```

(Escreva seu próprio conteúdo de treinamento — os fatos acima ilustram a *forma*: algumas regras de gramática de alto impacto, um pequeno glossário de termos que o modelo erra, uma instrução de registro. Cartões de idioma em [champollion.dev/languages](https://champollion.dev/languages) citam fontes de tipologia das quais você pode extrair.)

Compare com o baseline ingênuo com `mt-eval compare <naive_log> <coached_log>`, itere e publique sua melhor execução. A execução publica com condição `coached` automaticamente; se quiser que o leaderboard mostre um método nomeado em vez do rótulo genérico, anexe um cartão de método quando publicar (o fluxo de publicação oferece um assistente). Vencer o baseline ingênuo em um par de baixo recurso com nada além de engenharia de prompt é uma descoberta genuína e publicável — veja o [cookbook completo de Coached LLM Prompting](/docs/network/tutorials/coached-llm-prompting) para orientação de design.

## Tier 3 — Construir um método

A contribuição mais ambiciosa: implemente o protocolo `TranslationMethod` (`translate(entries, config)`) e faça benchmark de um sistema real, não apenas um prompt. O harness o executa via `--method <plugin-dir>` e incorpora seu cartão de método no cartão de execução. Padrões com cookbooks práticos:

- **[Pipelines com portão FST](/docs/network/tutorials/fst-gated-pipeline)** — cada palavra candidata é verificada por um analisador morfológico; o LLM regenera até que o portão passe. Saída semi-determinística, garantida por morfologia.
- **[Geração aumentada por dicionário](/docs/network/tutorials/dictionary-augmented-llm)** — procure termos de origem em um léxico bilíngue no momento da tradução e restrinja a saída.
- [Modelos encadeados](/docs/network/tutorials/chained-models), [recuperação few-shot](/docs/network/tutorials/few-shot-prompting), [back-translation](/docs/network/tutorials/back-translation), [híbridos baseados em regras](/docs/network/tutorials/rule-based-hybrid)…

Métodos declaram uma **classe de dependência** (S/O/A1/A2/X — veja [a especificação de métodos](/docs/network/specifications/methods#method-validity-and-dependency-classes)) descrevendo o que precisam para executar e transferir: um pipeline autossuficiente é Classe S; um que chama uma API de dicionário licenciado em tempo de execução é A2. Declare honestamente — a classe determina onde seu método pode competir, e manifestos são auditados.

## Por que isso importa além do leaderboard

Cada execução publicada é evidência independente sobre qualidade de MT para um par de idiomas que provedores comerciais não medem. A fila funciona também como um registro público de *demanda*: quais pares a comunidade considera digno de medir, qual cobertura custa aos preços atuais de API, e até onde o compute contribuído se estende. Quando pedimos a agências de financiamento para subsidiar varreduras sistemáticas, esta fila e sua taxa de preenchimento são a evidência de demanda.
