---
sidebar_position: 0
title: "Enviar para o Índice"
description: "Proponha um conjunto de dados, recurso, método, serviço de tradução humana ou resultado externo — ou sugira uma correção em uma ficha de idioma. Todos os envios passam por revisão humana quanto à conformidade com propriedade intelectual, licenças e soberania — nada é aprovado automaticamente."
related:
  - label: "Submit a Method"
    to: /docs/network/getting-started/submit-a-method
    kind: guide
    note: "Already have a benchmark run? Publish the run card instead."
  - label: "Registering Corpora"
    to: /docs/network/sovereignty/registering-corpora
    kind: guide
    note: "Exposure tiers for corpora you own"
  - label: "Data Sovereignty"
    to: /docs/network/sovereignty/data-sovereignty
    kind: doc
  - label: "Honest Limitations"
    to: /docs/network/honest-limitations
    kind: doc
---

# Enviar para o Índice

> **Resumo Executivo.** Proponha algo para o índice Champollion — um benchmark, um recurso, um método de tradução, um serviço de tradução humana, ou um resultado publicado externamente. Você preenche um formulário estruturado curto (no seu navegador ou pela CLI); um **mantenedor revisa cada envio manualmente** para conformidade com IP, licença e comunidade/soberania antes de qualquer coisa ser adicionada. **Nada é aprovado automaticamente.**

O índice é o mapa compartilhado: os datasets nos quais os métodos são avaliados, os dicionários e ferramentas que ajudam, os próprios métodos, as pessoas que traduzem manualmente, e os resultados que outros publicaram. Qualquer pessoa pode propor uma adição. Como essa é uma infraestrutura para comunidades de linguagem, cada proposta passa por um portão de revisão humana primeiro.

---

## O que você pode enviar

| Tipo | O que é | O que adicionamos |
|---|---|---|
| **Benchmark / dataset** | Um corpus de avaliação ou benchmark | Um card de metadados + um ponteiro *fetch-from-source* — nunca o conteúdo do corpus |
| **Recurso** | Um dicionário, arquivo, app, FST (analisador morfológico) ou ferramenta | Uma listagem com um ponteiro + nível de acesso (aberto / restrito / consentimento obrigatório) |
| **Método de tradução** | Um motor de MT, provedor de LLM ou pipeline | Uma entrada no registro de métodos para que possa ser executado e avaliado em benchmarks |
| **Serviço de tradução humana** | Um escritório comunitário opt-in, agência ou tradutor individual | Uma listagem por par (detalhes de contato permanecem fora de banda — nunca na issue pública) |
| **Resultado publicado externo** | Uma pontuação reportada por outro sistema ou artigo | Uma **citação** — resultados externos são citados, nunca hospedados novamente ou reclassificados como medição própria |
| **Correção em card de idioma** | Algo em um [card de idioma](/catalogue) está incorreto, desatualizado ou ausente — uma estimativa de falantes, um status, uma escrita, um recurso que ainda não listamos | Uma **correção citada aplicada na fonte dos dados** (os cards são gerados, logo a correção se mantém); quando as fontes divergirem, o card exibirá todas elas, com a devida atribuição |

Cada card de idioma também possui um link **"Sugerir uma correção ou adição"**
que abre o formulário de correção com o idioma pré-preenchido.

**Solicitações comunitárias de remoção e restrição.** Se você for membro ou
autoridade de uma comunidade e quiser que os dados sobre o seu idioma sejam restritos ou removidos, use o
formulário de correção (ou entre em contato com o mantenedor fora de banda caso prefira que não seja
público). Essas solicitações passam pela [revisão de soberania](/docs/network/sovereignty/data-sovereignty)
com prioridade — nenhuma citação é necessária.

---

## Como funciona a revisão

Essa é a parte importante: **envios são revisados por um humano, não por um robô.** Quando você envia, você abre uma issue no GitHub. Essa issue é a fila de revisão. Um mantenedor a lê e verifica contra as regras do projeto antes de adicionar qualquer coisa:

- **Propriedade intelectual e licença.** Devemos ter permissão para listá-lo. Materiais não comerciais, com proibição de redistribuição ou com licença incerta ainda podem ser *catalogados*, mas são mantidos fora de qualquer fluxo comercial / de premiação / de busca pública.
- **Comunidade e soberania.** Dados de idiomas indígenas e comunitários são listados apenas com o consentimento da comunidade. Um provedor ou custodiante nunca é identificado publicamente antes de sua confirmação.
- **Nunca hospedamos conteúdo de corpus.** Datasets são listados como metadados acompanhados de um ponteiro para o local de onde os dados são obtidos. **Não cole frases de origem/referência na sua submissão.**
- **Sem dados pessoais.** Nenhum e-mail, telefone ou outro dado de identificação pessoal (PII) em uma issue pública. Para serviços de tradução humana, os dados de contato são fornecidos ao mantenedor fora de banda.
- **Escopo.** Corpora bíblicos/litúrgicos e outros materiais de imposição colonial estão fora do escopo e serão recusados.

Cada formulário termina com uma atestação obrigatória:

> *"Confirmo que isso é publicamente listável, contém SEM conteúdo de corpus ou dados pessoais, e respeita a licença da fonte e qualquer restrição de comunidade/soberania."*

---

## Duas formas de enviar

### Do seu navegador

Abra o seletor de issue e escolha o formulário que corresponde ao que você está enviando:

➡️ **[Abra um formulário de envio no GitHub](https://github.com/gamedaysuits/Champollion/issues/new/choose)**

Cada formulário pede apenas o que o índice correspondente precisa (nome, linguagens/pares, licença, URL de origem, e assim por diante) e a caixa de atestação.

### Da CLI

Se você tem a [CLI champollion](/docs/network/getting-started/submit-a-method), `champollion submit` coleta os campos e entrega a você uma versão **pré-preenchida** do mesmo formulário do GitHub:

```bash
# Interactive — pick a type and answer the prompts
champollion submit

# See the submission types
champollion submit --list

# Fully scripted (prints a pre-filled GitHub issue URL)
champollion submit --yes --type dataset --attest \
  --field dataset-name="GlobalVoices eng-amh" \
  --field pairs=eng-amh \
  --field license=CC-BY-4.0 \
  --field source-url=https://globalvoices.org
```

A CLI imprime uma URL — abra-a, revise a atestação no navegador, e envie. Adicione `--out submission.json` para também salvar uma cópia local, sem conteúdo, do que você está propondo. A CLI nunca faz upload de nada por si mesma e nunca escreve no índice.

---

## O que acontece depois que você envia

1. Seu envio chega como uma issue no GitHub — a fila de revisão.
2. Um mantenedor a revisa contra as regras de IP / licença / soberania acima.
3. **Se aceito:** o mantenedor adiciona a entrada à fonte-de-verdade relevante (o registro de dataset, um cartão, o registro de método ou serviço humano, ou o catálogo de resultados-externos) através de uma mudança normal, e rotula a issue como **aceito**.
4. **Se não puder ser listado como está:** o mantenedor a rotula como **recusado** (ou pede mais informações) com o motivo.

Não há merge automático e nenhuma publicação automática. Uma pessoa toma a decisão toda vez.

---

## Veja Também

- [Enviar um Método](/docs/network/getting-started/submit-a-method) — já tem uma execução de benchmark? Publique o cartão de execução diretamente.
- [Registrando Corpora](/docs/network/sovereignty/registering-corpora) — níveis de exposição (local / privado / público / selado) para corpora que você possui.
- [Soberania de Dados](/docs/network/sovereignty/data-sovereignty) — como o controle comunitário de dados de linguagem funciona aqui.
- [Para Comunidades de Linguagem](/docs/network/community/for-language-communities) — parceria, consentimento, e custódia de chaves.
