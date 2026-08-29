---
sidebar_position: 4
title: "Interface de Método"
related:
  - label: "Submit a Method"
    to: /docs/network/getting-started/submit-a-method
    kind: guide
    note: "Put this interface on the leaderboard"
  - label: "Eval Harness v2.0"
    to: /docs/network/specifications/harness
    kind: spec
  - label: "Run Card Specification"
    to: /docs/network/specifications/run-card
    kind: spec
  - label: "Cookbook: FST-Gated Translation Pipeline"
    to: /docs/network/tutorials/fst-gated-pipeline
    kind: cookbook
    note: "A full method, built end-to-end"
---

# Interface de Método Compartilhado

> **Resumo Executivo.** Esta página especifica o protocolo `TranslationMethod` que todos os métodos de Network devem implementar, as seis classes de método (`raw-llm`, `coached-llm`, `pipeline`, `custom-plugin`, `api`, `human`), o eixo **paradigma** ortogonal (`rule-based`, `statistical`, `neural-nmt`, `llm`, `hybrid`, …) que torna *como um método traduz* comparável entre sistemas, o formato de plugin de método, e as **classes de dependência** (S/O/A1/A2/X) que determinam se um método pode ser executado na sandbox de avaliação e se qualifica para prêmios. Estes são três eixos independentes. Qualquer abordagem que implemente este protocolo pode ser avaliada; o que ela depende determina onde pode competir.

O harness de avaliação e champollion compartilham um conceito comum de **método de tradução**. Um método é qualquer procedimento que recebe texto de origem e produz texto traduzido — seja uma chamada direta de LLM, um pipeline multi-estágio, uma API de terceiros, ou um tradutor humano.

## Arquitetura

```
Method Plugin (v2 Spec)
├── method.json           ← Manifest (name, class, entry_point, dependencies, metadata)
├── method_card.json      ← Leaderboard description (what, not how)
├── pipeline.py           ← Python module implementing TranslationMethod
└── (optional helpers)    ← Additional Python modules
```

Carregado via `--method path/to/dir`. O harness não descobre nada automaticamente.

## Dois Sistemas, Uma Interface

| | Eval Harness | champollion |
|---|---|---|
| **Linguagem** | Python | Node.js |
| **Ponto de entrada** | `translate.py` | `translate.js` |
| **Interface** | protocolo `TranslationMethod` | config `methodPlugin` |
| **Propósito** | Avaliação em lote com pontuação | Localização ao vivo em dev/CI |
| **Saída** | Cartão de execução com métricas | Arquivos de locale traduzidos |

Um método que suporta ambos os sistemas fornece dois pontos de entrada — um para cada runtime de linguagem. O **cartão de método** é a ponte: descreve o método em um formato que ambos os sistemas entendem.

## Cartão de Método {#method-card}

Um cartão de método descreve *o quê* é um método de tradução sem revelar detalhes proprietários como o prompt completo do sistema. Ele responde:

- Que classe de método é este? (LLM bruto, LLM treinado, pipeline, API, etc.)
- Que **paradigma** ele usa? (baseado em regras, estatístico, neural-nmt, llm, híbrido)
- Que ferramentas ele usa? (analisador FST, dicionário, etc.)
- A implementação é código aberto?
- Que pares de idiomas ele suporta?

Veja a [Especificação de Cartão de Método](/docs/network/specifications/methods#method-card) para o esquema JSON completo.

### Exemplo

```json
{
  "method_id": "fst-gated-v8",
  "name": "FST-Gated Coached Translation v8",
  "class": "pipeline",
  "paradigm": "hybrid",
  "description": "LLM translation with morphological validation. Failed words are retried with FST feedback.",
  "author": "Curtis Forbes",
  "tools_used": ["HFST morphological analyzer", "Wolvengrey dictionary"],
  "open_source": false,
  "dependency_class": "A2",
  "supported_pairs": ["eng>crk"]
}
```

O campo `dependency_class` resume o que o método precisa para executar e transferir — veja [Validade de Método e Classes de Dependência](#method-validity-and-dependency-classes) abaixo. O campo `paradigm` coloca o método no **eixo de paradigma** (aqui `hybrid`: um LLM controlado por um FST baseado em regras) — veja [Paradigmas](#paradigms) abaixo.

### Classes de Método

| Classe | Descrição |
|-------|-----------|
| `raw-llm` | Chamada direta de LLM com instrução mínima |
| `coached-llm` | LLM com prompt estruturado, exemplos, restrições |
| `pipeline` | Pipeline multi-estágio com componentes determinísticos |
| `custom-plugin` | Processo externo implementando o protocolo `TranslationMethod` |
| `api` | API de tradução de terceiros (Google Translate, DeepL, etc.) |
| `human` | Tradução humana (para estabelecer linhas de base) |

### Paradigmas {#paradigms}

O **paradigma** é um terceiro eixo independente: *como um método traduz no nível algorítmico*. É ortogonal tanto à classe de método quanto à classe de dependência. A classe de método sozinha é centrada em LLM — um sistema baseado em regras [Apertium](https://www.apertium.org/) e Google Translate caem em `pipeline`/`api`, então "baseado em regras vs neural" é invisível sem ele. O eixo de paradigma torna essa comparação de primeira classe e filtrável no leaderboard.

| Paradigma | Descrição | Exemplos |
|----------|-----------|----------|
| `rule-based` | Transdutores de estado finito, gramáticas escritas à mão, transferência morfológica | Apertium, geração FST GiellaLT |
| `statistical` | MT baseada em frases / estatística (SMT) aprendida de corpora paralelos | Moses clássico |
| `neural-nmt` | Um modelo de MT neural dedicado codificador–decodificador | Google Translate, DeepL, Microsoft Translator, OPUS-MT, LibreTranslate, Tilde MT, Translated (Lara) |
| `llm` | Um modelo de linguagem grande de propósito geral solicitado para traduzir | uma chamada GPT / Claude / Gemini bruta ou treinada |
| `hybrid` | Combina dois ou mais paradigmas em um método | um LLM controlado por um FST baseado em regras (crk-translate); NMT + pós-edição baseada em regras |
| `human` | Tradução humana (linha de base no nível de paradigma) | linha de base de tradutor comunitário |
| `unknown` | Não especificado — o cartão não declarou paradigma | compatibilidade retroativa padrão para cartões pré-paradigma |

Os eixos são independentes. Alguns exemplos trabalhados:

| Método | `class` | `paradigm` | `dependency_class` |
|--------|---------|-----------|--------------------|
| Google Translate | `api` | `neural-nmt` | A2 |
| Tilde MT / Translated (Lara) | `api` | `neural-nmt` | A2 |
| LibreTranslate (auto-hospedado, OSS) | `api` | `neural-nmt` | O |
| Apertium | `pipeline` | `rule-based` | O |
| crk-translate (FST-controlado, LLM-treinado) | `pipeline` | `hybrid` | A2 |
| Chamada GPT bruta | `raw-llm` | `llm` | A1 |

O paradigma é **opcional** em um cartão de método; um paradigma ausente é registrado como `unknown` (nunca bloqueia publicação — o eixo é aditivo). A enumeração acima é o vocabulário canônico e suportado, aplicado pelo harness (`config.VALID_PARADIGMS`). Como a aplicação é do lado da aplicação em vez de uma restrição de banco de dados, novos paradigmas podem ser adicionados depois sem uma migração; apenas renomear ou remover um valor uma vez que métodos dependem dele é custoso.

## Validade de Método e Classes de Dependência {#method-validity-and-dependency-classes}

Um método é apenas tão executável, e apenas tão transferível, quanto sua dependência menos disponível. Dois mecanismos de Network dependem de saber exatamente o que um método precisa:

1. **Avaliação em sandbox** ([Especificação de Benchmark §8.2](/docs/network/specifications/benchmark)) — pontuações ouro-padrão oficiais vêm de uma sandbox cuja política de rede é **padrão-negar**. Um método que silenciosamente requer um serviço externo não pode produzir uma pontuação oficial.
2. **Transferência de prêmio** ([Especificação de Prêmio](/docs/network/specifications/prizes)) — métodos vencedores de prêmios transferem para a organização de governança da comunidade de idiomas. Um método que agrupa conteúdo que o remetente não tinha direito de incluir não pode ser transferido legalmente. O remetente deve deter (ou ser concedido) os direitos de tudo na caixa.

Para tornar ambas as verificações mecânicas em vez de ad hoc, cada método declara uma **classe de dependência**, derivada de um **manifesto de dependência** em `method.json`.

> **Nota sobre nomenclatura — três eixos independentes.** *Classe de método* (§acima: `raw-llm`, `pipeline`, …) descreve a *forma* de um método — o contrato de interface que apresenta. *Paradigma* ([§Paradigmas](#paradigms): `rule-based`, `neural-nmt`, `llm`, …) descreve *como ele traduz algoritmicamente*. *Classe de dependência* (esta seção) descreve *o que ele precisa para executar e transferir*. Os três são ortogonais: um método `pipeline` pode ser `rule-based` ou `hybrid`, e pode ser qualquer classe de dependência. (Classe e paradigma são intencionalmente separados porque classe sozinha é centrada em LLM — não pode distinguir um sistema baseado em regras de um neural quando ambos se apresentam como `pipeline` ou `api`.)

### As Cinco Classes de Dependência

| Classe | Nome | Definição | Executável em sandbox? | Elegível para prêmio? |
|-------|------|-----------|-------------------|-----------------|
| **S** | Auto-contido | Todo código, dados, modelos e pesos são enviados dentro do diretório de método, sob licenças que permitem redistribuição e transferência comunitária. | ✅ Sim, como está | ✅ Sim |
| **O** | Externo aberto | Depende de artefatos hospedados externamente sob licenças abertas que permitem redistribuição (incluindo licenças copyleft como AGPL) — por exemplo, um FST baixado no tempo de instalação. | ✅ Sim — artefatos são fixados e **espelhados na submissão** | ✅ Sim, com condições de compatibilidade de licença: termos copyleft são preservados através da transferência, e a comunidade recebe os mesmos direitos que a licença concede a todos |
| **A1** | Dependente de API, substituível | Requer inferência de LLM em tempo de execução, onde o modelo é **configuração substituível** — qualquer modelo suficientemente capaz pode ser inserido. O valor do método vive em seus prompts, dados de treinamento e código, não em nenhum modelo de um provedor. | ⚠️ Apenas via o **gateway de LLM** que a especificação de sandbox define (🔲 planejado — veja abaixo) | ⚠️ Condicional — veja abaixo |
| **A2** | Dependente de API, não-substituível | Requer chamadas em tempo de execução para uma API de dados ou serviço externo que não pode ser espelhada ou substituída — tipicamente porque o conteúdo servido é proprietário ou sem licença (por exemplo, uma API de dicionário cujo dicionário subjacente não tem licença pública). | ❌ Não — a dependência não pode existir na sandbox sem permissão do detentor de direitos | ❌ Não até que o detentor de direitos conceda permissões de inclusão em sandbox **e** transferência. Permitido no leaderboard aberto (segmento de desenvolvimento) com uma flag **"dependência externa"** visível |
| **X** | Fechado | Agrupa conteúdo que o remetente não tem direito de redistribuir — datasets sem licença, conteúdo proprietário raspado, componentes incompatíveis com licença. | ❌ | ❌ Inadmissível em todas as faixas. Agrupar conteúdo sem direitos é uma violação de licença independentemente de onde o método é executado |

**Classe efetiva.** A classe de dependência de um método é a classe *mais restritiva* entre todas as suas dependências declaradas, na ordem S < O < A1 < A2 < X. Um dicionário sem licença torna um pipeline de outra forma auto-contido Classe A2 (se acessado em tempo de execução) ou Classe X (se agrupado sem direitos).

### A Distinção A1/A2: Substituibilidade

A maioria dos métodos chama LLMs. A Network não finge o contrário — mas distingue dois tipos muito diferentes de dependência de API:

- **A1 (substituível):** A API fornece inferência de LLM de commodity. O identificador do modelo é configuração: o método deve ser executado de ponta a ponta contra qualquer endpoint de inferência compatível, incluindo um modelo de peso aberto hospedado pela comunidade. A qualidade de saída pode diferir entre modelos — esse é o risco do desenvolvedor, e pontuações oficiais são vinculadas ao modelo fixado usado na avaliação. Um método que depende de **estado do lado do provedor** (um ajuste fino hospedado apenas no provedor, armazenamentos de arquivo do provedor, assistentes específicos do provedor) *não* é substituível: esse estado não pode ser removido, então a dependência é A2 a menos que os pesos ou dados subjacentes sejam incluídos na submissão.
- **A2 (não-substituível):** A API serve algo único — tipicamente dados proprietários ou sem licença. Nenhum endpoint alternativo pode fornecê-lo, e o conteúdo não pode ser espelhado na sandbox sem permissão do detentor de direitos. O método funciona no leaderboard aberto (sinalizado), mas não pode produzir pontuações oficiais de sandbox ou se qualificar para prêmios até que permissões existam.

**O que uma transferência de prêmio A1 realmente transmite.** A comunidade não recebe o modelo — ninguém pode transferir os pesos da Anthropic, Google ou OpenAI. A transferência cobre a receita completa *ao redor* do modelo: todos os prompts, dados de treinamento, código de pipeline, lógica de retry, configuração e requisitos de modelo documentados. Como o modelo é substituível por construção, a comunidade pode apontar o método transferido para qualquer provedor que escolher — ou para um modelo de peso aberto em seu próprio hardware — sem envolvimento do desenvolvedor. A receita é de propriedade; o motor é alugado e substituível.

### Manifesto de Dependência (`method.json`)

Cada método declara suas dependências no manifesto `method.json`. Cada entrada registra o que é o artefato, de onde vem, que licença o cobre e como o método o acessa:

```json
{
  "name": "FST-Gated Coached Translation v8",
  "method_id": "fst-gated-v8",
  "class": "pipeline",
  "paradigm": "hybrid",
  "entry_point": "pipeline:PipelineMethod",
  "supported_pairs": ["eng>crk"],
  "dependency_class": "A2",
  "dependencies": [
    {
      "id": "giellalt-lang-crk-fst",
      "kind": "software",
      "license": "AGPL-3.0-or-later",
      "access": "mirrored",
      "source": "https://github.com/giellalt/lang-crk",
      "pin": "sha256:3f1a…",
      "redistributable": true,
      "transferable": true
    },
    {
      "id": "llm-inference",
      "kind": "model",
      "license": "proprietary",
      "access": "gateway",
      "source": "openrouter:google/gemini-2.5-flash",
      "substitutable": true,
      "redistributable": false,
      "transferable": false,
      "notes": "Any compatible chat-completions endpoint works; the model slug is configuration."
    },
    {
      "id": "crk-dictionary-api",
      "kind": "service",
      "license": "none",
      "access": "external-api",
      "source": "https://itwewina.altlab.app/",
      "redistributable": false,
      "transferable": false,
      "notes": "Dictionary content has no public license; runtime lookups only. Class A2 until the rights holders grant permission."
    }
  ]
}
```

| Campo | Obrigatório | Descrição |
|-------|----------|-------------|
| `id` | ✅ | Identificador estável para a dependência |
| `kind` | ✅ | `data`, `model`, `software`, ou `service` |
| `license` | ✅ | Identificador SPDX, `proprietary`, ou `none`. `none` significa que nenhuma licença pública existe — tratada como todos os direitos reservados |
| `access` | ✅ | `bundled` (enviado no diretório de método), `mirrored` (buscado na instalação, fixado, vendido na submissão), `gateway` (inferência de LLM em tempo de execução via gateway de avaliação), `external-api` (qualquer outra chamada de rede em tempo de execução) |
| `source` | ✅ | URL canônica ou identificador `provider:slug` |
| `pin` | para `mirrored` | Versão, commit ou hash de conteúdo que fixa o artefato exato |
| `substitutable` | para `gateway`/`external-api` | Se qualquer endpoint compatível pode servir essa dependência |
| `redistributable` | ✅ | Se a licença permite redistribuir o artefato |
| `transferable` | ✅ | Se o artefato (ou direitos a ele) pode ser transferido para uma comunidade sob termos de transferência de prêmio |
| `notes` | ❌ | Contexto de forma livre |

**Derivação de classe.** Cada dependência contribui uma classe; o `dependency_class` do método é o mais restritivo:

| Perfil de dependência | Contribui |
|--------------------|-------------|
| `bundled` + licença permite redistribuição e transferência | S |
| `mirrored` + licença aberta permitindo redistribuição (copyleft incluído) | O |
| `gateway` + `substitutable: true` (inferência de LLM) | A1 |
| `external-api`, ou `gateway` com `substitutable: false` | A2 |
| `bundled` + `license: none` ou licença incompatível com redistribuição | X |

O `dependency_class` declarado deve corresponder à classe que o harness deriva do manifesto. Uma incompatibilidade é um erro de validação.

Um método com **nenhuma** dependência externa declara `"dependency_class": "S"` e `"dependencies": []`. O array vazio é uma declaração afirmativa, auditada como qualquer outra.

### Como a Validade É Verificada

Três camadas, da mais barata para a mais autoritária:

1. **Auditoria de manifesto.** O harness deriva a classe efetiva do manifesto e rejeita incompatibilidades. Revisores verificam cada dependência declarada contra sua licença e fonte declaradas — uma dependência declarada `redistributable: true` cuja licença upstream diz o contrário falha na revisão.
2. **Análise estática.** Código submetido é verificado para chamadas de rede, downloads dinâmicos e acesso ao sistema de arquivos que o manifesto não contabiliza. Uma dependência *não declarada* encontrada na revisão é motivo para rejeição independentemente de que classe teria sido — o manifesto deve ser completo, não apenas preciso.
3. **Política de rede de sandbox.** A especificação de sandbox requer **saída padrão-negar**: contêineres de método não recebem acesso de rede a menos que um caminho seja explicitamente permitido. O único caminho de saída que a especificação define é o **gateway de LLM** — um proxy de inferência operado pela infraestrutura de avaliação, restrito a uma lista de permissão explícita de modelos fixados, com cada solicitação e resposta registrada para auditoria pós-execução. Qualquer coisa não na lista de permissão falha na camada de rede, não na camada de política. Veja [Especificação de Benchmark §8.6](/docs/network/specifications/benchmark) para o design de política de rede e gateway.

> **Dois sandboxes diferentes — um planejado, um em produção.** Leia com atenção, porque a palavra "sandbox" cobre duas coisas distintas:
>
> - 🔲 **Planejado: o sandbox da plataforma e seu gateway LLM.** O ambiente operado pela infraestrutura de avaliação descrito nesta seção — aquele cujo gateway LLM permitiria que métodos Class A1 produzissem scores ouro-padrão oficiais — está especificado mas ainda não foi construído. Até que seja, métodos Class A1 são elegíveis para prêmio *em princípio* mas ainda não podem produzir scores ouro-padrão oficiais.
> - ✅ **Em produção: a lane de execução de métodos do nó organizador.** O nó de scoring próprio de um organizador de concurso já executa bundles de métodos propostos dentro de um container isolado de rede (`mt-eval node run-method`): construído e executado com `--network=none`, root somente leitura, dependências vendorizadas — o que o restringe a métodos que não precisam de rede em tempo de execução (Class S/O por construção). Pode rodar em uma máquina com verdadeiro airgap com bundles de scores assinados cruzando por mídia removível. Veja [Run a Sovereign Contest](/docs/network/sovereignty/run-a-sovereign-contest) para o caminho completo.
>
> Esta seção descreve o que a especificação da plataforma requer, não o que atualmente roda na plataforma.

### Exibição de Leaderboard

- O leaderboard mostra a classe de dependência de cada método ao lado de seu badge de classe de método.
- Métodos Classe A2 no leaderboard aberto carregam uma flag **"dependência externa"** visível: suas pontuações dependem de um serviço de terceiros que pode mudar ou desaparecer, e atualmente não são elegíveis para prêmio.
- Métodos Classe X não são listados.

## Eval Harness: Protocolo TranslationMethod {#eval-harness-translationmethod-protocol}

O harness de avaliação usa tipagem estrutural do Python (`Protocol`) para plugins. Qualquer classe com os membros corretos funciona — nenhuma herança necessária. O protocolo tem **três** membros obrigatórios, não apenas `translate`:

1. **`name`** (`str`) — nome do método legível por humanos, usado em IDs de execução e logs.
2. **`method_card()`** (`-> dict | None`) — metadados do método para rastreamento de proveniência, incorporados no log de execução e no cartão de execução publicado. Retorne `None` se o método não tiver cartão.
3. **`async translate(entries, config)`** (`-> list[dict]`) — a tradução em si: um lote de entradas, um dict de resultado por entrada de saída.

Quando o harness carrega um plugin via `--method path/to/dir`, valida que `translate` é chamável e então lê `method.name` e chama `method.method_card()` incondicionalmente — um plugin que não tiver nenhum dos dois falhará no tempo de carregamento, não falhará graciosamente.

```python
class MyMethod:
    name = "My Pipeline v1"  # required — run IDs and logs

    def method_card(self) -> dict | None:
        # required — provenance metadata (or None for no card)
        return {
            "method_id": "my-pipeline-v1",
            "name": self.name,
            "class": "pipeline",
        }

    async def translate(self, entries: list[dict], config: RunConfig) -> list[dict]:
        results = []
        for entry in entries:
            translation = await self.do_translation(entry["source"])
            results.append({
                "id": entry["id"],
                "predicted": translation,
                "latency_s": 0.5,
                "usage": {"prompt_tokens": 0, "completion_tokens": 0},
                "error": None,
                "tool_calls": [],
                "tool_call_count": 0,
                "metadata": {},
            })
        return results
```

O diretório do plugin precisa de um manifesto `method.json` com pelo menos `name` e `entry_point` (`"module_name:ClassName"` — o módulo é carregado do diretório do plugin e a classe instanciada). Se um cartão de método retornado declarar um `class` ou `paradigm`, deve usar o vocabulário canônico acima — um cartão fora da taxonomia falha na validação no tempo de carregamento em vez de silenciosamente desaparecer dos filtros do leaderboard.

Para um exemplo completo e funcional — construindo, executando e submetendo um plugin de ponta a ponta — veja [Submit a Method](/docs/network/getting-started/submit-a-method) e o [FST-Gated Pipeline cookbook](/docs/network/tutorials/fst-gated-pipeline).

## champollion: Config methodPlugin

Em champollion, métodos são registrados por par de idiomas em `champollion.config.json`:

```json
{
  "version": 3,
  "pairs": {
    "en:crk": {
      "methodPlugin": "crk-coached-v1"
    }
  }
}
```

Veja a [Especificação de Plugin](https://champollion.dev/docs/reference/plugin-spec) para a interface do lado champollion.

## Integração de Leaderboard

Quando um cartão de método é anexado a uma execução (via `--method-card`), é incorporado no cartão de execução e exibido no leaderboard:

```bash
# Run with method card attached
mt-eval run \
  --method path/to/my-method \
  --corpus eval-amh-fra-globalvoices-test-v1 \
  --method-card method_card.json

# Publish to the leaderboard
mt-eval publish eval/logs/harness/your-run-card.json
```

Se nenhum `--method-card` foi fornecido, `mt-eval publish` inicia um assistente interativo que o guia através da descrição do seu método.

O leaderboard mostra:
- **Badge de classe** — indicador visual (por exemplo, "pipeline", "coached-llm")
- **Paradigma** — o paradigma algorítmico (por exemplo, "rule-based", "neural-nmt", "llm", "hybrid"), uma coluna filtrável (veja [Paradigmas](#paradigms))
- **Classe de dependência** — S/O/A1/A2 (veja [Validade de Método e Classes de Dependência](#method-validity-and-dependency-classes)); métodos A2 carregam uma flag "dependência externa"
- **Nome do método** — do cartão de método
- **Ferramentas usadas** — listadas do cartão de método
- **Indicador de código aberto**

Quando nenhum cartão de método é anexado, o leaderboard mostra configuração nativa do harness (modelo, versão de prompt, temperatura, ferramentas habilitadas).

:::danger[NÃO TREINE com dados de avaliação]
Métodos cujo processo de desenvolvimento incluiu exposição ao dataset de avaliação — como dados de treinamento, exemplos few-shot, entradas de dicionário ou material de tuning de prompt — serão **desqualificados** do leaderboard. Veja [MT Evaluation](/docs/network/leaderboard/rules) para o que distingue um bom método de um ruim.
:::

---

## Veja Também

- [Avaliação de MT](/docs/network/leaderboard/rules) — visão geral, valor de leaderboard e orientação de método bom/ruim
- [Eval Harness](/docs/network/specifications/harness) — como executar avaliações
- [Datasets de Avaliação](/docs/network/leaderboard/datasets) — datasets disponíveis (EDTeKLA, FLORES+)
- [Especificação de Cartão de Execução](/docs/network/specifications/run-card) — o esquema JSON do cartão de execução
- [Especificação de Plugin](https://champollion.dev/docs/reference/plugin-spec) — interface de plugin do lado champollion
- [Leaderboard de Método](https://champollion.dev/leaderboard) — pontuações de benchmark ao vivo
- [Especificação de Benchmark](/docs/network/specifications/benchmark) — protocolo de avaliação, formato de corpus, esquema de cartão de execução
- [Especificação de Pontuação](/docs/network/specifications/scoring) — SSOT para métricas, pesos compostos e tiers de qualidade
