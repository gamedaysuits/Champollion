---
title: "Métodos e portões"
slug: /agents/methods
description: "method/1 e gate-chain/1 como cada ferramenta do Champollion os lê, um portão de validade FST como exemplo prático e as receitas de métodos além do modelo treinado padrão — LLM orientado, few-shot, ampliado por dicionário, híbrido baseado em regras, encadeado, tradução parcial, com ajuste fino — cada um com o que envia para onde."
---

# Métodos e gates

Um **método** é qualquer coisa que traduz: um modelo treinado, um LLM com prompt, uma
consulta de dicionário, um mecanismo de regras, um serviço, pessoas. Um **gate** é uma verificação
entre a saída de um método e o que é entregue. O método padrão dos rails é um
modelo treinado com o nmt-forge ([treinamento](/docs/agents/training)); esta página traz
o formato em que ambos são escritos e as outras receitas.

Cada receita abaixo segue as [regras de transmissão](/docs/agents/data-rules):
**um método que chama um provedor de modelo envia texto para esse provedor**, e um
arquivo somente local, selado ou que exige consentimento o recusa.

## method/1

`$schema` `https://champollion.dev/schemas/method/1.json`. Obrigatório: `id`
(palavras em minúsculas unidas por hifens), `name`, `kind` — mais a configuração única
que esse tipo precisa, verificada pelos leitores com as mesmas mensagens em ambos os
ambientes de execução.

| `kind` | Configuração obrigatória | É executado em | Envia texto para |
|---|---|---|---|
| `llm` | `model` (um id exato, nunca um alias); opcional `provider` | CLI; harness via `-m` e `--provider` | O provedor |
| `llm-coached` | `model`; o coaching vai em `coaching` (`file`, `prompt` ou `dir`) | CLI; harness via `-m` e `--coaching-file` | O provedor: as frases e o coaching |
| `mt-api` | `engine` (de `shared/method-registry.json`) | CLI; harness | O serviço do mecanismo |
| `local-model` | `model` (um id do Hugging Face ou uma pasta local) | Harness, em processo | Lugar nenhum |
| `nmt-checkpoint` | `model_dir` | Por meio do seu serviço (`nmt-forge serve`) | O servidor deste computador |
| `lexicon` | `dictionary` | Harness, em processo | Lugar nenhum |
| `python` | `entry_point` (`module:Class`) | Harness (`mt-eval run --method <folder>`) | Para onde o plugin enviar (`dependency_class`) |
| `service` | `service.endpoint` | CLI (método `api`) | Aquele endpoint |
| `human` | — | Pessoas; avalie a saída delas com `mt-eval test` | — |

Opcional: `version`, `description`, `author`, `pairs` (`{source?, target}`),
`decode` (`temperature` 0–2, `batch_size`, `max_tokens`), `card` (o que o
placar mostra), `dependency_class` (`S` autossuficiente, `O` externo aberto,
`A1`/`A2` dependente de API, `X` fechado), `evidence` (execuções medidas: `dataset`,
`metric`, `score`, `ci`, `n` — apenas números), `runtimes` (`cli`, `engine`).

**De onde vem um method.json:** `methods/<id>/method.json` em um projeto;
`nmt-forge export` (tipo `nmt-checkpoint`); `mt-eval export --report <report>
--name <name> --type <type> --locales <code>`; `champollion serve
--emit-manifest` (kind `service`). Formatos mais antigos (o manifesto de plugin da CLI com
`type`, o manifesto de plugin do harness com `entry_point`) ainda são lidos, como
method/0, com um aviso. Um documento contendo `$schema` é lido como
method/1 e deve ser validado.

**Qual ambiente de execução aceita qual tipo.** A CLI recusa `python`, `lexicon`,
`local-model` e `human` (*"runs in the eval engine (mt-eval run --method),
not in the champollion CLI — or serve it and use it through its endpoint"*).
O `--method <folder>` do harness carrega apenas `python`; para qualquer outro tipo, ele
informa as flags para executá-lo em vez disso.

**Decodificação.** A temperatura padrão é **0** (`shared/model-defaults.json`):
um único valor para a tradução em um app e a avaliação no harness, de modo que
o que é medido seja o que é entregue — `mt-eval run --temperature` usa isso como padrão.
Um par, uma configuração ou uma execução pode definir o seu próprio.
Os IDs de modelo são slugs exatos, nunca aliases.

## Cadeias de gates

`$schema` `https://champollion.dev/schemas/gate-chain/1.json`, um arquivo em
`gates/`. Obrigatório: `id`, `gates` (um ou mais). Opcional: `description`,
`fallback`.

Cada gate: `id`, `kind` (`metric-threshold`, o único tipo), `metric` (o nome de um
plugin de métrica), `field` (uma chave no resultado por segmento daquele plugin — um
número, ou true/false lido como 1/0), `min` e/ou `max`, `on_refuse`.

**As regras** (`arena/mt_eval_harness/gates.py`):

- Os gates são executados em ordem; o **primeiro** gate que recusar um segmento decide o que
  é entregue:

  | `on_refuse` | Entrega | Contabilizado como |
  |---|---|---|
  | `drop` | nada | recusado |
  | `keep-source` | o texto fonte | recusado |
  | `flag` | a saída, marcada | sinalizado, não recusado |
  | `fallback` | a tradução do fallback, se os mesmos gates a aceitarem; recusada novamente, nada | recusado |

- **Bloqueio.** Um segmento que o plugin não consegue avaliar é recusado (`no_value` ou
  `plugin_error:<type>`) — nunca entregue como se tivesse passado.
- **Bloqueio.** Um gate cujo plugin não esteja carregado, ou não consiga pontuar aqui, interrompe a
  execução antes que qualquer coisa seja traduzida: *"a gate that cannot judge is never
  treated as passing"*.
- **Bloqueio.** O fallback deve rodar neste processo (`lexicon`, `local-model`
  ou um plugin declarando `dependency_class` `S` ou `O`), de forma que um segmento recusado
  não saia para lugar nenhum.
- **Bloqueio.** `mt-eval run` e `mt-eval test` recusam uma cadeia com um gate `fallback`:
  *"a fallback is for serving and translating, never for a measurement:
  the score would be partly this method's and partly the fallback's, under one
  name"*. Avalie o fallback como um método próprio.
- **Onde os gates se aplicam:** `mt-eval run --gates`, `mt-eval test <run log>
  --gates` (re-scored without translating again), `mt-eval translate --gates`,
  `mt-eval serve --gates` e o `gates` de uma implantação.
- Em uma medição, a pontuação principal avalia o que é entregue; o chrF++ sem gates e a
  taxa de recusa ficam ao lado dela, e a impressão digital da cadeia (sha256 do seu
  JSON canônico) viaja com o relatório ([medição](/docs/agents/measurement#gated-measurement)).
  Com `keep-source`, a pontuação principal avalia o texto fonte onde ele foi entregue.
- **Bloqueio.** Todo gate precisa de `min` e/ou `max`, os IDs de gate são únicos e um
  gate `fallback` precisa do `fallback` da cadeia — `champollion validate` e
  o harness dão o mesmo veredito. Tentar novamente um segmento recusado com o
  motivo do gate não foi implementado.

## Exemplo prático: um gate de validade FST

Um analisador de estados finitos (FST) diz se uma palavra é bem formada no
idioma. O plugin de métrica do harness `giellalt_fst_validity` informa, por
segmento, `fst_total_words`, `fst_valid_words`, `fst_invalid_words` e
`fst_validity_rate` (0–1). As palavras são divididas por espaços em branco com a pontuação nas bordas
removida; uma palavra com inicial maiúscula é tentada novamente em minúsculas.

```json
{
  "$schema": "https://champollion.dev/schemas/gate-chain/1.json",
  "id": "fst-every-word",
  "description": "Ship a sentence only when the analyzer accepts every word.",
  "gates": [
    { "id": "fst-all-words", "kind": "metric-threshold",
      "metric": "giellalt_fst_validity", "field": "fst_validity_rate",
      "min": 1.0, "on_refuse": "flag" }
  ]
}
```

```bash
mt-eval setup --status               # the languages with a pinned analyzer
mt-eval setup --fst                  # the analyzer runtime
mt-eval setup --lang <code>          # the language's analyzer, once per machine
mt-eval run --corpus <dev file> --target-lang-code <code> --method local-model -m <model folder> \
  --gates gates/fst-every-word.json
```

- O analisador **não vem embutido**: o harness inclui apenas fixações (um nome de arquivo
  e sha256 por idioma), e o `setup --lang` busca o analisador do seu
  upstream para `~/.mt-eval/fsts/<code>/`, sob os termos do upstream. Ele é
  executado como uma ferramenta separada, nunca vinculado à CLI do `champollion`.
- Um analisador ausente nunca se torna zero: como métrica, é marcado como não
  computado; como gate, interrompe a execução.
- Uma saída vazia pontua 0 e é recusada abaixo de `min`.
- Para servir com ele, use `on_refuse: "fallback"` e um `fallback` como
  `{"method": "lexicon", "model": "data/lexicon/words.tsv"}` — apenas para
  `translate` e `serve`.
- **Observação.** A aceitação pelo FST indica que uma palavra existe, não que a frase signifique
  a coisa certa. É um diagnóstico: nunca entra na pontuação principal do chrF++.

## As receitas

### LLM orientado (`llm-coached`)

Um modelo geral guiado por prompts com as orientações da comunidade: notas gramaticais, estilo,
termos.

```bash
mt-eval run --corpus <dev file> -m <exact model id> --coaching-file coaching.md --glossary terms.json
champollion sync --method llm-coached --coaching-file coaching.md
```

- **No harness**, o texto do arquivo de coaching *é* todo o prompt de sistema,
  portanto ele deve dizer o que traduzir e gerar apenas a tradução como saída.
  `--glossary` é uma entrada de pontuação (aderência à terminologia), nunca enviada.
- **Bloqueio.** Uma execução do harness tem um coaching: `--coaching-file`, `--coaching`
  (texto em linha) ou o mais antigo `--custom-prompt` — informe um deles. Dois juntos são
  recusados: *"--coaching-file and --coaching each give the run its coaching —
  give one (put inline text in the file, or drop the file)"*.
- **Na CLI**, `llm-coached` envia seu próprio prompt com o coaching como um
  bloco "Coaching guidance", além de `.champollion/coaching/<locale>.json`
  (`grammar_rules`, `style_notes`, `dictionary`).
- **Observação.** Trata-se de dois prompts diferentes: uma pontuação orientada medida no
  harness não é o prompt exato que a CLI entrega. Informe isso ao usar um como
  evidência para o outro.
- **Envia:** cada frase fonte e o coaching completo para o provedor. Um
  arquivo de coaching com um sidecar somente local é executado apenas em um endpoint de loopback
  (`champollion data mark coaching.md --local-only` marca um).

### Few-shot

Exemplos de boas traduções dentro do coaching. Trata-se de um LLM orientado: mesmos
comandos, mesmo transporte — os exemplos viajam no prompt de sistema para o
provedor.

- **Observação.** Nunca tire exemplos do conjunto de teste, e nunca de um
  arquivo somente local para um provedor remoto. Nada verifica exemplos few-shot
  em relação às referências de teste automaticamente.

### LLM enriquecido com dicionário

- **CLI:** o `dictionary` em `.champollion/coaching/<locale>.json` é enviado
  para todo método LLM como "REQUIRED TERMINOLOGY" para os termos encontrados em cada
  lote (correspondência de substring sem distinção de maiúsculas/minúsculas). O DeepL recebe isso como um glossário.
  Avisos de violação são emitidos após a tradução; não há nova tentativa.
- **Harness:** um dicionário chega ao modelo apenas como texto no arquivo
  de coaching.
- **Apenas dicionário:** `mt-eval run --method lexicon -m data/lexicon/words.tsv
  --corpus <dev file>` — frase mais longa primeiro, palavras desconhecidas mantidas, em
  processo. `nmt-forge floor` é isso, no conjunto de desenvolvimento
  ([medição](/docs/agents/measurement#the-dictionary-floor)).
- **Envia:** as entradas correspondentes do dicionário, com as frases, para o
  provedor. Um dicionário somente local não deve ir para um remoto.

### Híbrido baseado em regras

Nenhum mecanismo de regras vem embutido. O que existe: `lexicon` (determinístico, em
processo); `mt-eval run --method apertium` (um mecanismo baseado em regras — ele envia texto
para `apertium.org` a menos que `APERTIUM_API_URL` aponte para o seu próprio servidor); e
plugins `python` para suas próprias regras, opcionalmente com um LLM. Uma classe de plugin
precisa de `async def translate(self, entries, config)`; execute-a com `mt-eval run
--method <folder>`. Valide sua saída com uma cadeia de gates.

- **Envia:** o que quer que o plugin chame. Um plugin é um método externo: em um
  corpus com consentimento obrigatório ou selado (incluindo somente local), o harness o recusa,
  a menos que `--attest-local-transport` — o qual você passa apenas após verificar
  se tudo o que ele chama está nesta máquina.

### Métodos encadeados

Duas cadeias vêm integradas:

1. **O fallback de uma cadeia de gates:** método → gates → fallback em processo → os
   mesmos gates. Apenas para `translate` e `serve`.
2. **O fallback de par da CLI** (`"fallback": {"method": …}` no par de um aplicativo):
   método principal → gate de qualidade da CLI → nova tentativa com o feedback do gate
   (métodos de LLM ou um endpoint `api` que declare `acceptsInstructions`) →
   o fallback uma vez, através do mesmo gate.

Qualquer coisa mais longa (gerar, editar, validar entre modelos) é um plugin
`python` ou um `service`.

- **Envia:** cada elo envia o que seu tipo envia. Uma cadeia é tão privada quanto o seu
  elo menos privado.

### Tradução parcial (pessoas e máquina)

O modelo cria o rascunho; um falante verifica e corrige. Nos rails, esta é a rodada
de aprimoramento: `champollion improve sheet` elabora rascunhos, o falante marca `Y`/`N`/`?`,
`champollion improve marks` transforma correções e rascunhos confirmados em pares de
treinamento e linhas de prática em frases de desenvolvimento ([coaching](/docs/agents/coaching)).
Para pontuar as traduções feitas por pessoas como um método (`kind` `human`), execute
`mt-eval test` nas saídas delas. Um gate com `on_refuse: "flag"` marca a saída
para revisão.

- **Observação.** Uma frase usada para orientar ou treinar um método nunca deve ser aquela em que
  ele é pontuado.
- **Envia:** nada além das regras próprias do modelo de rascunho; as planilhas ficam na
  pasta do projeto.

### Modelo com ajuste fino (fine-tuned)

- **Nos rails:** `nmt-forge` (`nmt-checkpoint`; predefinições `cpu-tiny`,
  `byt5-small`, `byt5-small-lowmem`, `cpu-finetune`, `nllb-600m`), exportado,
  servido e conectado —
  [treinamento](/docs/agents/training), [disponibilização](/docs/agents/serving).
- **Um modelo aberto que você já possui:** `mt-eval run --method local-model -m
  <Hugging Face id or folder>` — em processo; nada sai da máquina.
- **Um LLM que você mesmo disponibiliza** (Ollama, vLLM, qualquer um compatível com OpenAI):
  `mt-eval run --provider local --base-url http://127.0.0.1:11434/v1 -m
  <model name>`. Só é considerado local quando o endpoint é um endereço de
  loopback.
- **Envia:** nada para fora da máquina, quando o endpoint é verdadeiramente local.

## Aprofunde-se

- [A especificação do método](/docs/network/specifications/methods) e o
  [manifesto de plugin](/docs/reference/plugin-spec) (o formato mais antigo).
- [Disponibilização e implantação](/docs/agents/serving) — deployment/1 e
  service-api/1.
- [Regras de medição](/docs/agents/measurement) — pontuações com gates.
- [Regras de dados e transmissão](/docs/agents/data-rules) — o que pode ser enviado.
- [Métodos de tradução para apps e sites](/docs/guides/translation-methods).
