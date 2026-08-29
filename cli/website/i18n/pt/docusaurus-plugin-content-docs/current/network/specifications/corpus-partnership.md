---
sidebar_position: 9
title: "Estratégia de Parceria de Corpus"
slug: '/network/specifications/corpus-partnership'
---

# Estratégia de Parceria de Corpus: Estabelecendo Corpora de Avaliação Através de Departamentos de Linguística Acadêmica

Construir um corpus de *treinamento* para uma língua com poucos recursos exige
centenas de milhares de pares de frases — um número grande demais para ser
verificado, de modo que a qualidade varia de maneiras que ninguém percebe até
que um modelo treinado com eles falhe. Um corpus de *avaliação* exige algumas
centenas de pares, cada um deles revisado por alguém que conhece a língua,
e ele nunca se torna obsoleto: cada novo modelo ou método que surge é medido
em relação a ele. Este documento é o fluxo de trabalho para construir essa
segunda opção, drasticamente mais barata — a única entrega em que a
especialidade de um departamento alcança cada frase individualmente — e para o
que acontece depois: com um padrão de avaliação estabelecido, um
[prêmio anunciado](/docs/network/specifications/prizes) transforma a sua língua
em um alvo que qualquer desenvolvedor de métodos no mundo pode mirar, e o
placar público mede cada tentativa.

> **Objetivo.** O fluxo de trabalho completo para estabelecer um corpus de avaliação de tradução automática por meio de uma parceria com um departamento de linguística: o que o departamento entrega, como o corpus deve ser, como ele é selado criptograficamente, como funciona a avaliação em sandbox e o que o departamento recebe em troca. Este é o documento que você leva para uma reunião com um potencial parceiro acadêmico.
>
> **Público-alvo.** Chefes de departamento, pesquisadores principais, coordenadores de pesquisa e diretores de programas de línguas indígenas em universidades com programas ativos de documentação de línguas ou NLP.
>
> **Documentos complementares:**
> - [Estrutura de Design do Corpus](/docs/network/specifications/corpus-design) — a metodologia por trás de corpora de avaliação válidos e confiáveis
> - [Especificação de Prêmios](/docs/network/specifications/prizes) — a parte do incentivo: anunciar um prêmio para o seu conjunto selado
> - [Registro de Corpora](/docs/network/sovereignty/registering-corpora) — como um corpus se junta à Rede sem sair das suas mãos
> - [Protocolo de Validação de Falantes](/docs/network/specifications/speaker-validation) — o pedido para que falantes bilíngues *marquem* traduções existentes (classificação de qualidade, validação de linter, revisão de FST)
> - [Especificação de Benchmark](/docs/network/specifications/benchmark) — a especificação técnica completa para corpora, run cards e protocolos de avaliação
> - [Soberania de Dados](/docs/network/sovereignty/data-sovereignty) — princípios indígenas de soberania de dados, CARE e por que a transferência de propriedade é importante

---

## 1. O Que Esta Parceria Produz

Um **corpus de avaliação selado**: um conjunto curado de pares de texto paralelo (língua de origem → língua de destino) que se torna a verdade fundamental para medir a qualidade da tradução automática. Os métodos são testados contra este corpus em um sandbox — os desenvolvedores nunca veem os dados de teste.

A parceria produz três artefatos:

| Artefato | O Que É | Quem Controla |
|----------|---------|---------------|
| **Corpus de desenvolvimento** | 100–200+ pares de texto paralelo públicos para desenvolvimento de métodos | Publicado abertamente (CC BY-NC-SA 4.0 ou equivalente) |
| **Conjunto de teste padrão-ouro** | 50–150 pares de texto paralelo secretos para avaliação oficial | Organização de governança comunitária (selada criptograficamente) |
| **Suite de teste diagnóstico** | 10–50 pares contrastivos direcionados testando fenômenos linguísticos específicos | Publicado abertamente |

Juntos, isso representa de 160 a 400 pares — um corpus que um grupo de pesquisa
pode realmente fazer a curadoria com padrão profissional, em comparação com as
centenas de milhares que um corpus de treinamento exigiria. O corpus de
desenvolvimento permite que qualquer pessoa crie métodos de tradução. O conjunto
padrão-ouro garante que esses métodos sejam testados de forma honesta. A suíte
de diagnóstico captura modos de falha específicos (por exemplo, "este sistema
consegue lidar com a obviação?").

---

## 2. O Que o Departamento Precisa Fazer

### Fase 1: Design do Corpus (2–4 semanas, tempo de pesquisador)

**Liderança:** PI ou pós-doutorando com expertise na língua de destino.

1. **Selecione domínios de material de origem.** Escolha 4–6 domínios do mundo real onde a tradução é realmente necessária pela comunidade de língua. Nossa taxonomia suporta 16 domínios (veja Benchmark Spec §2.7):

   | Prioridade | Domínio | Por Quê |
   |-----------|--------|--------|
   | 🔴 Alta | `edu` — Educacional | Livros didáticos, currículos — necessidade direta da comunidade |
   | 🔴 Alta | `gov` — Governo | Documentos de conselho de banda, política — necessidade prática diária |
   | 🔴 Alta | `medical` — Saúde | Formulários de admissão em clínicas, informações de saúde — crítico para segurança |
   | 🟡 Média | `conv` — Conversacional | Fala cotidiana — estabelece fluência de linha de base |
   | 🟡 Média | `legal` — Legal | Documentos de direitos, tratados — significância comunitária |
   | 🟢 Menor | `literary` — Literário/Cultural | Histórias, histórias orais — preservação cultural |

2. **Rascunhe um documento de design do corpus** especificando:
   - Tamanho alvo por segmento (desenvolvimento, padrão_ouro, diagnóstico)
   - Distribuição de nível de dificuldade (veja §3.3 abaixo)
   - Cobertura de registro e domínio
   - Critérios de seleção de sentença de origem (sem texto sintético, sem apenas Bíblia)
   - Plano de recrutamento de falantes

3. **Envie o design para nossa revisão.** Validamos contra o schema do corpus (Benchmark Spec §2) e retornamos feedback em 1 semana.

### Fase 2: Criação de Sentença de Origem (4–8 semanas, tempo de falante)

**Liderança:** Coordenador de pesquisa trabalhando com falantes bilíngues.

1. **Gere ou selecione sentenças de origem** através dos domínios e níveis de dificuldade planejados. As fontes podem ser:
   - Materiais bilíngues publicados existentes (livros didáticos, documentos governamentais)
   - Sentenças recém-eliciadas projetadas para cobrir fenômenos linguísticos específicos
   - Adaptadas de documentos do mundo real (agendas de conselho de banda, formulários de clínica, materiais educacionais)

2. **Cada sentença de origem deve ter:**
   - Tag de domínio (da taxonomia de 16 códigos)
   - Tag de registro (conversacional, formal, técnico, cerimonial, educacional)
   - Tag de contexto (saudação, declaração, pergunta, instrução, narrativa, rótulo, erro)
   - Nível de dificuldade estimado (1–5, veja §3.3)
   - Tag de proveniência (livro didático, eliciado, corpus, padrão_ouro)

3. **Traduza cada sentença de origem** para a língua de destino, realizado por falantes bilíngues. Múltiplas traduções de referência por entrada são valiosas, mas não obrigatórias.

4. **Opcionalmente, adicione análise morfológica** para cada tradução de referência:
   - Glosa interlinear (decomposição morfema-por-morfema)
   - String de tag FST (se um FST existe para a língua)
   - Notas do tradutor sobre variantes dialetais, ambiguidade ou contexto cultural

### Fase 3: Garantia de Qualidade (2–4 semanas)

**Liderança:** Linguista com expertise na língua de destino.

1. **Revisão cruzada.** Cada tradução deve ser revisada por pelo menos um falante bilíngue adicional que não produziu a tradução original. O revisor verifica:
   - A tradução é precisa?
   - Soa natural?
   - A classificação de dificuldade está correta?
   - Existem variantes aceitáveis que devem ser anotadas?

2. **Execute através de nosso validador de schema.** Fornecemos um script que valida o corpus contra o schema de entrada (Benchmark Spec §2.2). Ele verifica:
   - Campos obrigatórios presentes
   - Códigos de domínio válidos
   - Níveis de dificuldade são inteiros 1–5
   - Sem IDs duplicados
   - Codificação de caracteres (normalização UTF-8 NFC)

3. **Se um FST existe para a língua,** execute as traduções de referência através dele. Cada palavra na referência deve ser válida no FST. Palavras que não são (empréstimos, neologismos, nomes próprios) devem ser documentadas em uma lista de permissão.

### Fase 4: Segmentação e Selagem (1 semana, engenharia Champollion)

**Liderança:** Equipe Champollion, com revisão do departamento.

1. **Divisão estratificada.** Dividimos o corpus em segmentos usando amostragem aleatória determinística (seed documentada, reproduzível):

   | Segmento | Tamanho Alvo | Acesso |
   |----------|------------|--------|
   | `development` | 60% das entradas (mín. 100) | Público |
   | `gold_standard` | 30% das entradas (mín. 50) | Secreto, selado |
   | `held_out` | 10% das entradas (mín. 10) | Secreto, selado, nunca usado até ser ativado |

   A divisão preserva a distribuição de nível de dificuldade (amostragem estratificada) para que cada segmento tenha representação proporcional através dos níveis.

2. **Selagem criptográfica** dos segmentos padrão_ouro e retido:

   ```
   1. SHA-256 hash of each entry (source + reference + metadata)
   2. SHA-256 hash of the complete segment file
   3. Segment file encrypted with AES-256-GCM
   4. Encryption key split using Shamir Secret Sharing (2-of-3 threshold)
   5. Key shares distributed to:
        - Share 1: Community governance organization
        - Share 2: Academic department partner
        - Share 3: Champollion project (escrow)
   6. Hash manifest published to a public commit (proves the corpus existed
      at a specific time without revealing its contents)
   ```

3. **O segmento de desenvolvimento** é confirmado no repositório público e publicado com licenciamento completo.

4. **O segmento diagnóstico** também é público — testa fenômenos linguísticos específicos (veja §3.4).

### Fase 5: Integração e Lançamento (1–2 semanas, engenharia Champollion)

1. **Configuração do harness.** Adicionamos a língua ao harness de avaliação:
   - Cartão de língua criado ou verificado
   - Corpus registrado no registro de dataset
   - Métricas LYSS configuradas (LYSS-fst se FST disponível, LYSS-eq se regras de linter existem)
   - Perfil de pontuação padrão selecionado (Perfil A se FST disponível, Perfil B caso contrário)

2. **Benchmark de linha de base.** Executamos uma varredura de 12 modelos contra o segmento de desenvolvimento para popular o leaderboard com pontuações iniciais.

3. **Anúncio público.** A língua aparece no leaderboard da Rede com um benchmark de segmento de desenvolvimento ao vivo. O departamento é creditado como parceiro do corpus.

---

## 3. Como o Corpus Deve Se Parecer

### 3.1 Formato

Todo arquivo de corpus é um documento JSON seguindo o schema em Benchmark Spec §2.1–§2.2:

```json
{
  "dataset": {
    "id": "crk-ualberta-v1",
    "version": "1.0",
    "language_pair": "EN→CRK",
    "source_language": "en",
    "target_language": "crk",
    "created": "2026-09-15",
    "license": "CC-BY-NC-SA-4.0",
    "provenance": ["textbook", "elicited", "gold_standard"]
  },
  "entries": [
    {
      "id": 1,
      "source": "I see the dog",
      "reference": "niwâpamâw atim",
      "segment": "development",
      "difficulty": 2,
      "provenance": "textbook",
      "register": "conversational",
      "context": "declaration",
      "domain": "edu",
      "morphological_analysis": "ni-wâpam-âw atim | 1sg-see.TA-3sg.DIR dog.AN",
      "notes": "Animate noun (atim); direct form because speaker is proximate"
    }
  ]
}
```

### 3.2 Requisitos de Tamanho Mínimo

| Segmento | Entradas Mínimas | Recomendado |
|----------|-----------------|------------|
| `development` | 100 | 200–300 |
| `gold_standard` | 50 | 100–150 |
| `diagnostic` | 10 | 30–50 |
| `held_out` | 10 | 20–30 |
| **Total** | **170** | **350–530** |

### 3.3 Distribuição de Dificuldade

O corpus deve incluir entradas através de todos os cinco níveis de dificuldade, ponderados em direção aos níveis 2–4:

| Nível | Descrição | Distribuição Alvo |
|-------|-----------|------------------|
| 1 — Vocabulário básico | Palavras únicas, saudações comuns, números | 10–15% |
| 2 — Sentenças simples | SVO, tempo presente | 25–30% |
| 3 — Complexidade moderada | Tempo passado/futuro, possessivos, animacidade | 30–35% |
| 4 — Morfologia complexa | Obviação, passiva, ordem de conjuntivo, orações relativas | 15–20% |
| 5 — Avançado | Multi-cláusula, registro formal, cerimonial, idiomático | 5–10% |

### 3.4 Suite de Teste Diagnóstico

O segmento diagnóstico testa fenômenos linguísticos específicos usando **pares contrastivos**: uma tradução correta e uma tradução incorreta minimamente diferente. Se a métrica de um sistema pontua a correta mais alta, o teste passa.

Para línguas polissintéticas, a suite de teste diagnóstico deve visar:

| Fenômeno | Exemplo (Cree) | O Que Testa |
|----------|----------------|-----------|
| **Concordância de animacidade** | atim (AN) vs. maskisin (IN) — formas verbais diferentes | O sistema sabe quais nomes são animados? |
| **Obviação** | Terceira pessoa proximal vs. obviativa | Ele rastreia a hierarquia de terceira pessoa? |
| **Marcação inversa** | Formas verbais diretas vs. inversas | Ele lida com paciente-supera-agente? |
| **Conjuntivo/Independente** | Verbo de cláusula principal vs. cláusula subordinada | Ele usa o paradigma verbal correto? |
| **Inclusivo/Exclusivo** | "Nós (incluindo você)" vs. "Nós (excluindo você)" | Ele distingue formas de primeira pessoa plural? |

Para outras famílias linguísticas, identifique os 3–5 fenômenos mais diagnósticos que distinguem tradução competente de incompetente. A expertise linguística do departamento é essencial aqui — estes são os testes que apenas um especialista saberia escrever.

### 3.5 O Que NÃO Queremos

| Anti-padrão | Por Quê |
|-----------|--------|
| **Texto apenas de Bíblia** | Registro arcaico, vocabulário litúrgico, estrutura formulaica. OMT-1600 avaliou 1.560 línguas desta forma — deliberadamente evitamos. |
| **Pares de avaliação sintéticos** | Pares de referência gerados por LLM derrotam o propósito da avaliação. A referência deve ser de autoria humana. |
| **Corpora de registro único** | Tudo formal, ou tudo conversacional. A tradução do mundo real abrange múltiplos registros. |
| **Apenas dificuldade-1** | Palavras únicas e saudações não testam tradução — testam busca de vocabulário. |
| **Referências traduzidas por máquina** | Usar saída do Google Translate como "referência" é circular. |
| **Sentenças sem tag de contexto** | Precisamos saber a função comunicativa para análise diagnóstica. |

---

## 4. Selagem Criptográfica e Teste em Sandbox {#4-cryptographic-sealing-and-sandbox-testing}

### 4.1 Por Que Selar o Conjunto de Teste?

Benchmarks convencionais de ML publicam conjuntos de teste abertamente. Uma vez publicados, LLMs de fronteira eventualmente treinarão neles (intencionalmente ou através de web scraping), tornando as pontuações não confiáveis. Para dados de línguas indígenas, há uma preocupação adicional: dados linguísticos publicados podem ser usados sem consentimento comunitário.

A selagem garante:
- **Integridade do conjunto de teste:** Métodos não podem fazer overfitting em dados que nunca viram
- **Soberania de dados:** A comunidade controla quem avalia contra seus dados
- **Frescor perpétuo:** O conjunto de teste nunca fica contaminado

### 4.2 Como Funciona o Teste em Sandbox

```
Developer workflow:
  1. Developer builds a translation method using the PUBLIC development corpus
  2. Developer tests locally against the development segment (unlimited, self-serve)
  3. When ready, developer submits their complete method (code + config + coaching data)
  4. Governance org installs the method in the evaluation sandbox
  5. Sandbox runs the method against the SEALED gold-standard test set
  6. Only scores are returned to the developer
  7. Developer never sees the source sentences or reference translations

The sandbox:
  - Runs on governance-controlled infrastructure
  - Has selective network access (LLM APIs only, no exfiltration)
  - Produces a tamper-proof run card (SHA-256 hash of all inputs and outputs)
  - Logs all execution for audit purposes
  - Can be inspected by the governance org at any time
```

### 4.3 Gerenciamento de Chaves

A chave de criptografia para o conjunto de teste selado é dividida usando Shamir Secret Sharing com limiar 2-de-3:

| Detentor da Chave | Papel | Poder de Revogação |
|------------------|-------|------------------|
| **Organização de governança comunitária** | Custodiante principal | Pode revogar acesso de avaliação unilateralmente |
| **Parceiro departamento acadêmico** | Co-custodiante | Pode participar da reconstrução de chave |
| **Projeto Champollion** | Depósito | Não pode acessar dados sozinho; garante continuidade se outras partes ficarem indisponíveis |

Qualquer 2 de 3 compartilhamentos reconstroem a chave. Isto significa:
- A comunidade + departamento podem acessar os dados sem Champollion
- A comunidade + Champollion podem acessar os dados sem o departamento
- Champollion sozinho NUNCA pode acessar os dados

### 4.4 Manifestos de Hash

Quando o corpus é selado, um **manifesto de hash** é publicado em um commit Git público:

```json
{
  "corpus_id": "crk-ualberta-v1",
  "seal_date": "2026-09-15T00:00:00Z",
  "segments": {
    "development": {
      "entry_count": 200,
      "sha256": "a3f7c...",
      "access": "public"
    },
    "gold_standard": {
      "entry_count": 100,
      "sha256": "b8d2e...",
      "access": "sealed",
      "key_scheme": "shamir-2-of-3"
    },
    "held_out": {
      "entry_count": 20,
      "sha256": "c9e4f...",
      "access": "sealed",
      "key_scheme": "shamir-2-of-3"
    },
    "diagnostic": {
      "entry_count": 30,
      "sha256": "d1a3b...",
      "access": "public"
    }
  },
  "total_entries": 350,
  "manifest_sha256": "e2b5c..."
}
```

Isto prova:
- O corpus existia em uma data específica
- Tem um tamanho e estrutura conhecidos
- Qualquer modificação dos segmentos selados quebraria a cadeia de hash
- A comunidade pode verificar que seus dados não foram adulterados

---

## 5. O Que o Departamento Recebe

### 5.1 Infraestrutura de Pesquisa

| Ativo | Descrição |
|------|-----------|
| **Harness de avaliação** | Um framework de avaliação funcional e testado para sua língua — economiza meses de construção de ferramentas |
| **Métricas LYSS** | Métricas de avaliação específicas da língua (LYSS-fst, LYSS-eq, LYSS-sem) configuradas para sua língua — se recursos FST e dicionário existem |
| **Leaderboard** | Um leaderboard público e ao vivo mostrando o estado da arte para seu par de línguas |
| **Benchmark de linha de base** | Varredura de 12 modelos fornecendo baselines imediatos e publicáveis |
| **Suite de teste diagnóstico** | Testes direcionados para fenômenos linguísticos específicos — reutilizáveis para outras avaliações |

### 5.2 Publicações

A construção do corpus e resultados de avaliação suportam múltiplas publicações:

| Artigo | Venue | Papel do Departamento |
|--------|-------|----------------------|
| Metodologia de construção de corpus | LREC, ComputEL | Autor principal ou co-autor |
| Resultados de avaliação de linha de base | ACL, EMNLP | Co-autor |
| Validação de métrica LYSS | WMT Metrics Shared Task | Co-autor |
| Design de suite de teste diagnóstico | SIGMORPHON, NAACL | Autor principal ou co-autor |
| Recursos de PLN específicos da língua | Venues específicas da língua | Autor principal |

### 5.3 Posicionamento de Concessão

A parceria fornece saídas concretas para propostas de concessão:

- "Infraestrutura de avaliação de código aberto para MT de [língua]" — entrega demonstrável
- "Soberania de dados criptográfica para dados linguísticos indígenas" — aplica frameworks indígenas de soberania de dados estabelecidos (CARE, Kaitiakitanga, TK Labels) à avaliação de MT; publicável
- "Benchmark governado pela comunidade com leaderboard ao vivo" — métrica de impacto contínuo
- "Avaliação independente de OMT-1600 / Google Translate para [língua]" — oportuno, alta visibilidade

### 5.4 Impacto Comunitário

- A comunidade de língua ganha uma **capacidade de avaliação independente** — pode avaliar se qualquer sistema de MT (Google, Meta, ou customizado) realmente funciona para sua língua
- A comunidade **controla os dados de teste** via custódia de chave criptográfica
- Qualquer método comprovado através do benchmark **transfere propriedade** para a comunidade (veja Benchmark Spec §8.3), que mantém tudo que qualquer deployment já ganhou — Champollion é não-comercial e não toma nenhuma parte

### 5.5 O Que Custa ao Departamento

| Componente | Custo Estimado | Quem Paga |
|-----------|---------------|----------|
| Tempo de PI/pós-doutorando (design, supervisão) | ~40 horas | Departamento (ou financiado por concessão) |
| Compensação de falante (tradução) | $2.500–6.000 | Financiado por concessão ou Champollion |
| Compensação de falante (revisão) | $500–1.500 | Financiado por concessão ou Champollion |
| Tempo de coordenador de pesquisa | ~20 horas | Departamento |
| **Engenharia, infraestrutura, harness** | **$0** | **Projeto Champollion** |

Fornecemos toda engenharia, configuração de harness, setup de métrica LYSS, integração de leaderboard e infraestrutura contínua sem custo para o departamento. A contribuição do departamento é expertise linguística e acesso a falantes.

---

## 6. Cronograma

| Fase | Duração | Marco-chave |
|------|---------|-----------|
| 1: Design do Corpus | 2–4 semanas | Documento de design aprovado |
| 2: Sentenças de Origem + Tradução | 4–8 semanas | Corpus bruto completado |
| 3: Garantia de Qualidade | 2–4 semanas | Revisado cruzadamente, schema-validado |
| 4: Selagem | 1 semana | Padrão-ouro selado, manifesto de hash publicado |
| 5: Integração | 1–2 semanas | Língua ao vivo no leaderboard com baselines |
| **Total** | **10–19 semanas** | **Leaderboard ao vivo com avaliação selada** |

---

## 7. Como Começar {#7-how-to-get-started}

1. **Entre em contato conosco** — [email/contato do projeto]. Agendaremos uma chamada de 30 minutos para discutir sua língua, recursos disponíveis e logística de parceria.

2. **Fornecemos:**
   - Este documento
   - O schema do corpus e ferramentas de validação
   - Exemplos de nosso corpus Cree (CRK) existente
   - Um template de design de corpus rascunhado

3. **Você fornece:**
   - Um pesquisador principal (PI) ou pós-doutorando para liderar o trabalho linguístico
   - Acesso a falantes bilíngues (ou um plano para recrutá-los)
   - Informações sobre os recursos disponíveis (FST, dicionário, corpora existentes)
   - Aprovação institucional para a governança de dados (consistente com os princípios de soberania de dados das Primeiras Nações, ou a própria estrutura da comunidade)

4. **Co-projetamos o corpus** — seleção de domínio, distribuição de dificuldade, testes diagnósticos, cronograma e orçamento.

5. **O trabalho começa.** Verificamos semanalmente. O departamento tem autonomia total sobre decisões linguísticas; lidamos com toda engenharia.

---

## 8. Perguntas Frequentes

### "Já temos um corpus paralelo. Podemos usá-lo?"

Sim — se o corpus tem proveniência clara, é de autoria humana, e a licença permite uso em avaliação. Ajudaremos você a formatá-lo para nosso schema, adicionar metadados faltantes e integrá-lo. Corpora existentes podem acelerar dramaticamente o cronograma (pular Fase 2 ou reduzi-la a um exercício de preenchimento de lacunas).

### "Não temos um FST para nossa língua."

Tudo bem. LYSS-fst (validade morfológica) requer um FST, mas o harness funciona sem ele usando pesos de Perfil B (chrF++, BLEU, COMET, métricas comportamentais). Se um FST GiellaLT existe para uma língua relacionada, podemos conseguir adaptá-lo. Se não, o corpus ainda permite avaliação valiosa — apenas sem a porta de validade morfológica.

### "Nossos falantes usam um script não-latino."

Totalmente suportado. O schema do corpus lida com qualquer script Unicode. Projetamos para SRO (Standard Roman Orthography) e silabários para Cree, mas a mesma infraestrutura funciona para Devanagari, script árabe, CJK, Etíope, ou qualquer outro sistema de escrita.

### "E quanto à variação dialetal?"

Marque-a. O schema de entrada do corpus inclui um campo `notes` para informação dialetal. Se múltiplos dialetos são representados, documente-os. As classes de equivalência do linter (LYSS-eq) podem ser configuradas para aceitar variantes dialetais como equivalentes. A suite de teste diagnóstico pode incluir contrastes específicos de dialeto.

### "Quem é dono do corpus?"

A comunidade de língua, via organização de governança. O departamento é creditado como parceiro de pesquisa. Champollion mantém uma chave de compartilhamento de depósito para continuidade operacional, mas não pode acessar os dados selados sozinho. O segmento de desenvolvimento é publicado sob uma licença Creative Commons especificada pela comunidade.

### "E se quisermos parar?"

A comunidade pode revogar acesso de avaliação a qualquer momento recusando-se a reconstruir a chave de criptografia. Os dados selados nunca são expostos. O segmento de desenvolvimento, já publicado, permanece público sob sua licença. Os resultados de pesquisa do departamento (publicações, apresentações) são deles para manter independentemente.

### "E se a organização de governança ainda não existe?"

Podemos começar com Fases 1–3 (design do corpus, criação, QA) sem uma organização de governança. A selagem (Fase 4) requer identificar um custodiante de chave. Enquanto isso, o departamento pode servir como co-custodiante ao lado do projeto Champollion, com o entendimento de que a custódia transfere para a organização de governança comunitária quando uma for estabelecida.

---

## Apêndice: Marcação vs. Construção de Corpus

Este documento cobre **construção de corpus** — criando os pares de texto paralelo que formam a verdade fundamental de avaliação. Marcação (anotação morfológica, glossagem interlinear, strings de tag FST) é uma atividade separada que enriquece o corpus, mas não é obrigatória para avaliação básica.

| Atividade | Obrigatória? | O Que Permite |
|-----------|------------|--------------|
| **Construção de corpus** (este documento) | ✅ Obrigatória | Avaliação básica: chrF++, correspondência exata, COMET, métricas comportamentais |
| **Verificação de cobertura FST** | 🟡 Opcional | Métrica de validade morfológica LYSS-fst **e** o `morphological_accuracy` derivado de FST (correspondência de lema — sem anotação necessária; Scoring Spec §2.2) |
| **Anotação morfológica** | 🟡 Opcional | Permitiria uma futura atualização *validada-ouro* de `morphological_accuracy`; a versão derivada de FST (acima) não precisa de nenhuma |
| **Regras de equivalência de linter** | 🟡 Opcional | Métrica de correspondência equivalente LYSS-eq |
| **Regras de validador semântico** | 🟡 Opcional | Métrica de validação semântica LYSS-sem |
| **Avaliações de qualidade de falante** | Atividade separada | Validação de métrica (veja [Protocolo de Validação de Falantes](/docs/network/specifications/speaker-validation)) |

Marcação e validação de falante são cobertas por documentos separados e podem prosseguir em paralelo com ou após construção de corpus.
