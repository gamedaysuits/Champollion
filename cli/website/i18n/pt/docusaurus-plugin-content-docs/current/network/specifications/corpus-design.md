---
sidebar_position: 7
title: "Framework de Design de Corpus"
---

# Marco de Design do Corpus de Avaliação

Quando você avalia um modelo de fronteira no FLORES+ e ele atinge a pontuação de 85 chrF++, não é possível distinguir se "o modelo é bom em tradução" ou se "o modelo memorizou esses pares de frases específicos". Essa única ambiguidade é o motivo pelo qual este framework existe: só vale a pena construir um corpus de avaliação se as suas pontuações significarem o que afirmam, e isso exige um design deliberado — pares inéditos, proveniência rastreada, domínios estratificados, dificuldade escalonada. Esta página é a fonte da verdade sobre como os conjuntos de dados de avaliação do Champollion são projetados, construídos e mantidos.

> **Versão:** 1.0 · **Status:** Rascunho · Complemento: o fluxo de trabalho [Corpus Partnership](/docs/network/specifications/corpus-partnership) coloca essa metodologia em prática com um departamento de pesquisa.

---

## 1. Princípios de Design

### 1.1 — Por Que Não Benchmarks Públicos?

Corpora paralelos públicos (FLORES+, Tatoeba, conjuntos de teste WMT, OPUS) estão disponíveis para desenvolvimento e depuração, mas são **excluídos da avaliação oficial do leaderboard**. A razão é direta:

**Contaminação.** LLMs de fronteira são treinados em enormes volumes de dados raspados da web. Qualquer texto paralelo que tenha existido publicamente — especialmente em conjuntos de dados de benchmark curados e amplamente citados — provavelmente está em seus dados de treinamento. Esta não é uma preocupação teórica — [pesquisas demonstraram](https://arxiv.org/abs/2311.04850) efeitos mensuráveis de contaminação em benchmarks de MT. (Benchmarks públicos ainda são executados aqui — mas apenas em uma trilha de *comparação relativa* que pode classificar os métodos uns contra os outros, nunca como qualidade absoluta.)

Para o Champollion, isso é de extrema importância porque:
- O leaderboard compara métodos de LLM, serviços clássicos de MT e sistemas criados para fins específicos lado a lado
- Nossa proposta de valor é uma *avaliação honesta e rigorosa*
- Nossos usuários-alvo (comunidades linguísticas) tomam decisões de implantação com base nessas pontuações

### 1.2 — Requisitos Principais

Todo corpus de avaliação do Champollion deve satisfazer:

| Requisito | Justificativa |
|-----------|---------------|
| **Autoria humana** | Sem dados sintéticos. Todo texto-fonte e tradução de referência devem ser escritos por humanos. LLMs podem auxiliar com alinhamento e formatação, mas nunca gerar conteúdo. |
| **Não disponível publicamente em forma paralela** | O texto-fonte pode ser público; as traduções de referência podem ser públicas; mas o *emparelhamento* específico não deve existir como um corpus paralelo para download. |
| **Proveniência rastreada** | Cada entrada deve ter origem documentada: documento-fonte, tradutor, licença, data. |
| **Informado linguisticamente** | A cobertura deve ser guiada por características tipológicas, não amostragem aleatória. |
| **Estratificado por domínio** | As entradas devem abranger domínios definidos com representação controlada. |
| **Escalonado por dificuldade** | As entradas devem ser atribuídas a níveis de dificuldade (1–5) com base na complexidade estrutural. |
| **Versionado** | As versões do corpus são com hash de conteúdo. As pontuações são comparáveis apenas dentro da mesma versão. |
| **Revisável pela comunidade** | As traduções de referência devem ser revisáveis por membros da comunidade linguística. |

### 1.3 — Neutralidade de Tipo de Corpus, Comprimento e Estilo

Champollion é um hub de avaliação de tradução aberto que é **neutro sobre o que é uma unidade de tradução**. Uma entrada de corpus é texto de comprimento arbitrário — uma única sentença curta, uma sentença longa com múltiplas cláusulas, um parágrafo ou um documento inteiro — e a plataforma avalia todos eles da mesma forma. **Não há restrição a texto curto ou fácil.** O harness não impõe limite de comprimento (deliberadamente define espaço generoso de token de saída para evitar truncar traduções longas); níveis de dificuldade (§3) e domínios (§2.1) são *eixos configuráveis*, não portões que excluem material difícil ou longo.

O hub é neutro e configurável em:

| Eixo | Intervalo |
|------|-----------|
| **Granularidade** | sentença · sentença longa · parágrafo · documento (`sizeUnit: entries \| sentences \| segments \| documents`) |
| **Comprimento e complexidade** | curto → longo; simples → altamente complexo (níveis de dificuldade 1–5) |
| **Estilo e registro** | formal, informal, técnico, literário, conversacional, administrativo (taxonomia de domínio, §2.1) |
| **Método** | qualquer `TranslationMethod` — LLM, NMT neural, baseado em regras, híbrido, humano |
| **Idioma e par** | qualquer par direcionado; sem viés de alto recurso incorporado |

Um corpus declara seu próprio tipo, granularidade, registro e dificuldade em seu card, e o harness honra o que o card declara. Os corpora de **desenvolvimento** padrão com origem em Tatoeba são sentenças curtas porque Tatoeba é — essa é uma propriedade desses corpora-fonte, **não** um limite da plataforma. Avaliação em nível de documento e longo-prazo são de primeira classe; registre-os da mesma forma (e, por exemplo, para entradas muito longas, configure um lote de requisição menor).

---

## 2. Seleção de Texto-Fonte

### 2.1 — Taxonomia de Domínio

Champollion avalia tradução para **contextos de implantação prática**, não exercícios acadêmicos. Cada entrada de corpus é marcada com um domínio da **taxonomia de domínio canônica de 16 códigos**, que é validada no momento da construção.

A taxonomia é definida uma vez — em [Especificação de Benchmark §2.7](/docs/network/specifications/benchmark#27-domain), a única fonte de verdade — e não é reafirmada aqui para evitar desvio. Os códigos são: `conv`, `ecommerce`, `edu`, `financial`, `gov`, `legal`, `literary`, `marketing`, `medical`, `news`, `religious`, `scientific`, `subtitles`, `support`, `tech` e `ui`. Veja §2.7 para a descrição de cada código e consumidores típicos. Não introduza códigos de domínio fora desse conjunto.

### 2.2 — Distribuição de Domínio

Um corpus de avaliação padrão deve visar uma distribuição entre os domínios mais relevantes para a comunidade-alvo. Os códigos exatos e percentuais variam por par de idiomas; a tabela abaixo é uma distribuição-alvo *ilustrativa*, usando os códigos canônicos de §2.1:

| Domínio | Código | % Alvo | Justificativa |
|---------|--------|--------|---------------|
| Interface de software | `ui` | 25% | Contexto de implantação primário para usuários da CLI champollion |
| Governo / administrativo | `gov` | 15% | Tradução de alto risco com implicações legais |
| Educacional | `edu` | 15% | Caso de uso central para revitalização linguística |
| Literário / narrativo | `literary` | 10% | Testa nuance cultural e registro literário |
| Conversacional | `conv` | 10% | Testa registro informal e padrões de fala natural |
| Técnico | `tech` | 10% | Testa precisão e consistência de terminologia |
| Médico / saúde | `medical` | 10% | Alto risco, testa vocabulário específico do domínio |
| Notícias / jornalístico | `news` | 5% | Testa vocabulário contemporâneo e registro neutro |

### 2.3 — Critérios de Seleção de Fonte

Ao selecionar textos-fonte para um novo corpus:

1. **Compatibilidade de licença.** O texto-fonte deve estar sob uma licença que permita uso em um corpus de avaliação. Prefira CC BY, CC BY-SA ou domínio público. Documente a licença.

2. **Recência.** Prefira textos publicados nos últimos 10 anos. A linguagem evolui — especialmente vocabulário em torno de tecnologia, governança e medicina.

3. **Diversidade de registro.** Dentro de cada domínio, busque textos em diferentes níveis de formalidade. Um comunicado de imprensa do governo (formal) e um post de mídia social do governo (informal) são ambos domínio `admin` mas registros diferentes.

4. **Relevância cultural.** Para idiomas indígenas e minoritários, priorize textos que importam para a comunidade — documentos de gestão de terras, materiais educacionais no idioma, textos de preservação cultural — sobre textos que acontecem existir em paralelo.

5. **Sem fontes traduzidas por máquina.** Se um documento "paralelo" foi criado executando o original através do Google Translate e depois editando, NÃO é aceitável como tradução de referência. A referência deve ser uma tradução humana independente.

---

## 3. Sistema de Nível de Dificuldade

### 3.1 — Definições de Nível

Cada entrada é atribuída a um nível de dificuldade (1–5) com base na complexidade estrutural do *texto-fonte*, não na dificuldade de tradução (que varia por método).

| Nível | Rótulo | Características Estruturais |
|-------|--------|---------------------------|
| 1 | **Elementar** | Sentenças simples. Cláusula única. Tempo presente. Vocabulário comum. Sem idiomas. Sem estruturas incorporadas. |
| 2 | **Intermediário** | Sentenças compostas. Duas cláusulas unidas por conjunção. Tempo passado/futuro. Algum vocabulário de domínio. |
| 3 | **Avançado** | Sentenças complexas. Cláusulas subordinadas, cláusulas relativas. Tempos mistos. Terminologia específica do domínio. Voz passiva. |
| 4 | **Especialista** | Múltiplas cláusulas incorporadas. Registro legal/técnico. Estruturas condicionais. Conceitos abstratos. Referências culturais. |
| 5 | **Extremo** | Prosa densa com múltiplos desafios simultâneos: subordinação aninhada, referência de pronome ambígua, idiomas culturais, registro misto, vocabulário raro. |

### 3.2 — Fatores de Dificuldade Informados Linguisticamente

Além da complexidade estrutural, a dificuldade é modulada pela **distância tipológica** entre o idioma-fonte e o idioma-alvo. Esses fatores são extraídos de características tipológicas WALS e dados de classificação do language card:

| Fator | Baixa Dificuldade | Alta Dificuldade |
|-------|------------------|------------------|
| **Ordem de palavras** | Mesma ordem básica (ex., SVO→SVO) | Ordem básica diferente (ex., SVO→SOV) |
| **Tipo morfológico** | Tipo similar (ex., analítico→analítico) | Tipo diferente (ex., analítico→polissintético) |
| **Gênero gramatical** | Mesmo sistema ou sem gênero | Fonte sem gênero, alvo com gênero complexo |
| **Honorífico/registro** | Sem marcação de registro | Alvo tem sistema de registro complexo (ex., japonês, coreano) |
| **Script** | Mesmo script | Script diferente (transliteração necessária) |
| **Animacidade** | Sem distinção de animacidade | Alvo tem concordância baseada em animacidade (ex., Cree) |
| **Evidencialidade** | Sem evidencialidade | Alvo marca fonte de informação gramaticalmente |

### 3.3 — Distribuição de Nível

Um corpus padrão deve ter aproximadamente:

| Nível | % Alvo | Justificativa |
|-------|--------|---------------|
| 1 | 15% | Estabelece linha de base — até métodos ruins devem lidar com estes |
| 2 | 25% | Tradução prática do dia a dia |
| 3 | 30% | Onde diferenças de qualidade de método se tornam visíveis |
| 4 | 20% | Separa bons métodos de ótimos |
| 5 | 10% | Teste de teto — muito poucos métodos lidarão bem com estes |

---

## 4. Qualidade da Tradução de Referência

### 4.1 — Requisitos do Tradutor

As traduções de referência devem ser produzidas por humanos que são:

1. **Falantes fluentes** do idioma-alvo (L1 ou equivalente)
2. **Alfabetizados** em idioma-fonte e idioma-alvo
3. **Conscientes do domínio** para o domínio do texto (um tradutor médico para textos de saúde, etc.)
4. **Independentes** — o tradutor não deve ter acesso a nenhuma saída de MT para o mesmo texto durante a tradução

### 4.2 — Briefing de Tradução

Todo tradutor recebe um briefing que inclui:

- O **registro** a usar (formal, conversacional, etc.)
- O **público-alvo** (público geral, especialistas, crianças, etc.)
- Quaisquer **convenções de terminologia** específicas da comunidade linguística
- Instrução explícita: "Traduza o significado, não as palavras. Uma tradução que soa natural é mais valiosa que uma literal."

### 4.3 — Garantia de Qualidade

1. **Tradução dupla.** Idealmente, cada entrada tem duas traduções de referência independentes por tradutores diferentes. Quando isso não é viável, priorize tradução dupla para Níveis 4–5.

2. **Revisão comunitária.** As traduções de referência devem ser revisadas por pelo menos um falante adicional que não produziu a tradução.

3. **Variantes aceitáveis.** Para cada referência, documente variantes aceitáveis conhecidas (ordem de palavras, convenções ortográficas, formas dialetais). Estas alimentam a métrica `equivalent_match_rate`.

### 4.4 — O Que Torna uma Referência Ruim

| Problema | Por Que Invalida Avaliação |
|---------|---------------------------|
| Traduzida por máquina e depois editada | Edição preserva estrutura de MT; penaliza métodos que produzem traduções mais naturais |
| Traduzida por um aprendiz, não um falante fluente | Referência pode conter erros que penalizam saída de MT correta |
| Excessivamente literal | Traduções naturais pontuam mal contra referências literais |
| Interpretação única válida para fonte ambígua | Penaliza interpretações alternativas válidas |

---

## 5. Prevenção de Contaminação

### 5.1 — Modelo de Ameaça de Contaminação

| Ameaça | Descrição | Mitigação |
|--------|-----------|-----------|
| **Sobreposição de dados de treinamento** | LLMs treinados no corpus paralelo | Não publique o corpus paralelo publicamente |
| **Vazamento de poucos exemplos** | Autor do método usa entradas de avaliação como exemplos de poucos exemplos | Verificação de impressão digital: entradas no prompt são detectadas e sinalizadas |
| **Contaminação indireta** | Texto-fonte existe em dados de treinamento de LLM (monolíngue) | Aceitável — texto-fonte monolíngue é esperado. O *emparelhamento* deve ser novo. |
| **Contaminação de multidão** | Revisores comunitários compartilham entradas publicamente | Termos de licença proíbem redistribuição do corpus paralelo |

### 5.2 — Níveis de Sigilo de Corpus

| Nível | Visibilidade | Uso |
|-------|-------------|-----|
| **Conjunto de desenvolvimento público** | Totalmente público | Desenvolvimento de método, depuração, testes de regressão. Pontuações NÃO publicadas no leaderboard. |
| **Conjunto de avaliação retido** | Texto-fonte visível, referências secretas | Avaliação oficial do leaderboard. Métodos recebem texto-fonte e retornam traduções; pontuação acontece no servidor. Referências nunca são expostas ao método. |
| **Conjunto padrão-ouro** | Totalmente secreto, controlado pela comunidade | Avaliação validada pela comunidade. Gerenciado pela organização de governança. Usado para verificação de nível "Validado pela Comunidade". |

### 5.3 — Política de Rotação

Corpora de avaliação devem ser **rotacionados** periodicamente:

1. Após um corpus estar em uso por 12 meses, comece a construir um substituto
2. Retire o corpus antigo para status de "conjunto de desenvolvimento" (público)
3. Promova o novo corpus para "conjunto de avaliação retido"
4. Isso previne contaminação gradual através de otimização iterativa contra um alvo fixo

---

## 6. Fluxo de Trabalho de Construção de Corpus

### 6.1 — Processo Passo a Passo

```
Step 1: Language Pair Selection
    └─ Identify target language, read language card
    └─ Review typological features (WALS), contact influences, scripts
    └─ Identify which difficulty factors apply

Step 2: Source Text Curation
    └─ Identify candidate source documents per domain
    └─ Verify licenses
    └─ Extract candidate sentences/segments
    └─ Classify by domain and preliminary difficulty tier

Step 3: Segment Selection
    └─ Sample segments to match domain distribution (§2.2)
    └─ Sample segments to match difficulty distribution (§3.3)
    └─ Ensure linguistic phenomenon coverage (§6.2)
    └─ Target minimum corpus size (§6.3)

Step 4: Reference Translation
    └─ Assign segments to qualified translators
    └─ Provide translation brief
    └─ Collect translations
    └─ Dual-translate Tier 4–5 entries

Step 5: Quality Assurance
    └─ Community review of references
    └─ Document acceptable variants
    └─ Flag and resolve disagreements

Step 6: Metadata & Packaging
    └─ Assign final difficulty tiers
    └─ Add provenance metadata per entry
    └─ Content-hash the corpus for versioning
    └─ Package as corpus JSON per harness spec

Step 7: Registration
    └─ Register in Supabase datasets table
    └─ Add to ATTRIBUTION.md if new sources used
    └─ Document in arena website
```

### 6.2 — Cobertura de Fenômeno Linguístico

Todo corpus deve incluir entradas que testam fenômenos linguísticos específicos relevantes para o par de idiomas. Estes são extraídos dos campos `linguisticChallenges` e `contactInfluences` do language card:

**Fenômenos universais (todos os pares de idiomas):**
- Resolução de pronome (antecedentes ambíguos)
- Negação (simples, dupla, escopo)
- Quantificadores (todos, alguns, nenhum, maioria)
- Expressões temporais (datas relativas, durações)
- Entidades nomeadas (pessoas, lugares, organizações)
- Números e medidas
- Listas e enumeração

**Fenômenos específicos do par (do language card):**
- Para alvos polissintéticos: morfologia verbal complexa, incorporação
- Para alvos com gênero: concordância de gênero, referência neutra/inclusiva
- Para alvos SOV: verbos finais de cláusula, posposições
- Para idiomas tonais: distinções de significado dependentes de tom
- Para idiomas honoríficos: marcadores de registro, contexto social
- Para idiomas de contato: limites de code-switching, integração de empréstimos

### 6.3 — Tamanho Mínimo de Corpus

A confiabilidade estatística requer contagens mínimas de entradas. Estas são baseadas em requisitos de intervalo de confiança bootstrap pareado (de `significance.py`):

| Propósito | Entradas Mínimas | Recomendado |
|-----------|-----------------|-------------|
| Conjunto de desenvolvimento | 50 | 100–200 |
| Conjunto de avaliação retido | 100 | 200–500 |
| Conjunto padrão-ouro | 200 | 500+ |
| Mínimo por domínio | 10 | 25+ |
| Mínimo por nível | 10 | 20+ |

**Por que 100 mínimo para avaliação?** Com menos de ~100 entradas, testes de significância bootstrap pareado (1.000 reamostragens) não conseguem detectar confiabilmente diferenças menores que ~5 pontos chrF++. Com 200+ entradas, podemos detectar diferenças de ~2 pontos em p<0,05.

---

## 7. Formato JSON de Corpus

Cada entrada de corpus segue a especificação do harness:

```json
{
  "id": "edtekla-dev-v1-042",
  "source": "The school board will meet on Tuesday to discuss the new curriculum.",
  "reference": "ᑭᓯᑭᓄᐦᐊᒫᑐᐏᓐ ᑲ ᐃᔑ ᐱᒥᐸᔨᐦᑕᐦᒃ ᑭᔅᑭᓄᐦᐊᒫᑐᐏᓇ ᐁ ᐃᔑ ᒫᒥᑐᓀᔨᐦᑕᐦᒃ ᐅᔥᑭ ᑭᔅᑭᓄᐦᐊᒫᑫᐏᓂᔭ ᓂᔓ ᑭᔑᑲᐤ",
  "acceptable_variants": [
    "ᑭᔅᑭᓄᐦᐊᒫᑐᐏᓐ ᓂᔓ ᑭᔑᑲᐤ ᑲ ᐃᔑ ᒫᒥᑐᓀᔨᐦᑕᐦᒃ ᐅᔥᑭ ᑭᔅᑭᓄᐦᐊᒫᑫᐏᓂᔭ"
  ],
  "domain": "edu",
  "difficulty": 3,
  "phenomena": ["temporal_expression", "named_entity", "future_tense"],
  "provenance": {
    "source_doc": "EdTeKLA Module 4, Unit 7",
    "source_license": "LicenseRef-EdTeKLA-Modified-CC-BY-NC-SA-4.0",
    "translator": "anonymous-speaker-001",
    "translator_qualification": "L1 Plains Cree, certified translator",
    "translation_date": "2025-11-15",
    "reviewer": "anonymous-speaker-002",
    "review_date": "2025-12-01"
  }
}
```

---

## 8. Medidas Anti-Gaming

### 8.1 — Integridade de Corpus

| Medida | Implementação |
|--------|---------------|
| **Hash de conteúdo** | Versão de corpus = SHA-256 de IDs de entrada ordenados + referências. Qualquer modificação produz uma nova versão. |
| **Impressão digital de entrada** | Cada entrada tem um ID derivado de conteúdo. Se alguém enviar resultados contra um corpus modificado, a impressão digital não corresponderá. |
| **Aplicação retida** | Para avaliação oficial, métodos recebem APENAS texto-fonte. Referências nunca são expostas. Pontuação acontece no servidor. |
| **Cronograma de rotação** | Corpora rodam anualmente para prevenir otimização de longo prazo contra um alvo fixo. |

### 8.2 — Integridade de Envio

| Medida | Implementação |
|--------|---------------|
| **Impressão digital determinística** | Configuração de execução (modelo, temperatura, prompt, versão de corpus) é feita hash. Configurações idênticas produzem impressões digitais idênticas. |
| **Detecção de cherry-pick** | Submissores devem divulgar todas as execuções, não apenas a melhor. Múltiplos envios com a mesma impressão digital são sinalizados. |
| **Verificação de contaminação** | Se entradas de avaliação aparecem verbatim no prompt ou dados de coaching do método, o envio é desqualificado. |

---

## 9. Corpora Existentes

### 9.1 — Conjunto de Desenvolvimento EDTeKLA v1

| Propriedade | Valor |
|----------|-------|
| **ID** | `edtekla-dev-v1` |
| **Par** | EN → CRK (Plains Cree, SRO) |
| **Entradas** | Divisão de desenvolvimento com 436 entradas (`textbook_dev.json`). O detalhamento completo é declarado uma vez na [página de Conjuntos de Dados de Avaliação](/docs/network/leaderboard/datasets#edtekla-development-set-v1). |
| **Domínios** | Educacional (100%) |
| **Níveis** | 1–5 (distribuição a definir por auditoria de entradas) |
| **Licença** | CC BY-NC-SA modificada da EdTeKLA (`LicenseRef-EdTeKLA-Modified-CC-BY-NC-SA-4.0`, com escopo de soberania) — **excluída das trilhas de leaderboard, prêmios e comercial/API** (não comercial) |
| **Status** | Conjunto de desenvolvimento (público) |

**Limitações:** Domínio único (apenas educacional). Sem estratificação de domínio. Atribuições de nível podem precisar auditoria. Tamanho pequeno de corpus limita poder estatístico para testes de significância.

### 9.2 — Corpora Planejados

| Corpus | Par | Status | Proprietário |
|--------|-----|--------|--------------|
| Corpus customizado EN → TL (Filipino) | EN → TL | Planejado | Proprietário do projeto |
| Conjunto retido EN → CRK | EN → CRK | Futuro (precisa de parceiro comunitário) | Organização de governança comunitária |

---

## 10. Integração com Language Card

O framework de corpus se integra com o sistema de language card:

1. **Seleção de domínio** é informada pelo `linguisticChallenges` do card — se um idioma tem desafios únicos (polissíntese, tom, animacidade), o corpus deve incluir entradas que os testem.

2. **Calibração de dificuldade** usa o `classification` do card — distância tipológica entre famílias de fonte e alvo afeta o que constitui "difícil".

3. **Cobertura de registro** usa o `registers` do card — se um idioma tem registros definidos (formal-filipino, taglish-profissional, taglish-casual), o corpus deve incluir entradas em cada nível de registro.

4. **Teste de influência de contato** usa o `contactInfluences` do card — para idiomas com camadas de empréstimo pesadas (Filipino: espanhol + inglês + árabe), inclua entradas que testem se métodos lidam corretamente com empréstimos vs. sobre-traduzindo-os.

5. **Manipulação de script** usa o `scripts[]` do card — para idiomas multi-script (sérvio: cirílico + latino), inclua entradas que testem seleção correta de script.

---

## Referências

- **Especificação de Pontuação Champollion** — define todas as métricas, pesos compostos, níveis de qualidade
- **Especificação de Benchmark Champollion** — protocolo de avaliação, formato de corpus, soberania de dados
- **WALS** (World Atlas of Language Structures) — banco de dados de características tipológicas
- **Glottolog** — fonte de verdade de classificação linguística
- **ISO 639-3** — padrão de identificação de idioma
- **EdTeKLA** — fonte do primeiro corpus de avaliação

---

*Este documento é uma especificação viva. Atualize-o conforme novos corpora são construídos e lições são aprendidas.*
