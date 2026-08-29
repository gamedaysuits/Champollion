---
sidebar_position: 8
title: "Especificação do Prêmio"
slug: '/network/specifications/prizes'
related:
  - label: "Run a Sovereign Contest"
    to: /docs/network/sovereignty/run-a-sovereign-contest
    kind: guide
    note: "The self-serve path to running your own prize"
  - label: "How Speakers Get Paid"
    to: /docs/network/perspectives/how-speakers-get-paid
    kind: position
    note: "The plain-language version of these numbers"
  - label: "The Economic Model"
    to: /docs/network/sovereignty/economic-model
    kind: doc
  - label: "MT Evaluation Rules"
    to: /docs/network/leaderboard/rules
    kind: doc
  - label: "Submit a Method"
    to: /docs/network/getting-started/submit-a-method
    kind: guide
---

# Especificação de Prêmio

Um prêmio é a metade de incentivo do acordo *eval-first*. Uma comunidade ou
grupo de pesquisa faz a curadoria de um conjunto de avaliação pequeno e selado — algumas centenas de pares,
todos verificados (a [Parceria de Corpus](/docs/network/specifications/corpus-partnership)
é esse fluxo de trabalho). Um patrocinador oferece um prêmio atrelado a uma pontuação-alvo nesse
conjunto. A partir desse momento, o idioma se torna um desafio permanente: qualquer desenvolvedor
de métodos no mundo pode tentar alcançá-lo, o *leaderboard* mede cada tentativa
publicamente, e o nível de exigência é definido pelo próprio gabarito da comunidade, em vez
de por quem grita mais alto. Este documento especifica como esse prêmio
funciona — condições de limite, processo de reivindicação, classes de dependência e regras —
para que o nível de exigência seja inequívoco e agnóstico em relação ao método quando um prêmio for aberto.

Os prêmios são **financiados e mantidos pelo patrocinador**: o dinheiro fica com a
organização patrocinadora, ou com um fundo comunitário que o patrocinador designar —
**O Champollion nunca retém, guarda em custódia ou roteia os fundos do prêmio.** Qualquer comunidade
ou organização pode realizar um no modelo de autoatendimento em
[Executar um Concurso Soberano](/docs/network/sovereignty/run-a-sovereign-contest),
mantendo seu próprio corpus e seu próprio dinheiro.

> **Status: PROPOSTO — nenhum prêmio está aberto e nada aqui pode ser reivindicado ainda.**
> O que condiciona a *abertura* de um prêmio é o lado da medição: um
> corpus padrão-ouro consentido pela comunidade, o ambiente de avaliação isolado (*air-gapped*)
> (*sandbox* especificado, mas ainda não construído) e a etapa de revisão por falantes. Nenhuma pontuação
> neste site atingiu o nível de exigência de um prêmio. Consulte
> [Limitações Honestas](/docs/network/honest-limitations). Referência de métricas:
> a [Especificação de Pontuação](/docs/network/specifications/scoring); protocolo:
> a [Especificação de Benchmark](/docs/network/specifications/benchmark).

---

## Quer ajudar a trazer um idioma para a rede?

Você não precisa esperar por um prêmio. As coisas de maior impacto que você pode fazer hoje:

- **Patrocine um prêmio de conquista em TA.** Financie um critério direcionado — por exemplo, um método confiável de Inglês → Plains Cree. Champollion coordena a medição; os fundos ficam com **você** (sua organização, ou um fundo comunitário que você designa) e são concedidos nos termos da comunidade (veja
> [Soberania de Dados](/docs/network/sovereignty/data-sovereignty)
> e o [Modelo Econômico](/docs/network/sovereignty/economic-model)). O caminho de autoatendimento de ponta a ponta está documentado em
> [Executar um Concurso Soberano](/docs/network/sovereignty/run-a-sovereign-contest);
> trazer um novo par de idiomas começa com uma
> [parceria de corpus](/docs/network/specifications/corpus-partnership).
- **Coordene uma doação de computação.** Reúna créditos de API / tokens para que a fila pública possa mapear mais pares e mostrar onde a tradução está — e não está — ainda confiável.
- **Apoie as iniciativas de código aberto em que construímos — *diretamente*.** Champollion é encanamento que une o trabalho aberto de outras pessoas; apoiá-*los* é apoiar este mapa (preferimos apontá-lo para a fonte do que receber crédito pelo trabalho deles):
  - [Tatoeba](https://tatoeba.org) — sentenças paralelas contribuídas pela comunidade
  - [Catálogo de Idiomas em Perigo (ELCat)](https://www.endangeredlanguages.com) — dados de perigo
  - [Glottolog](https://glottolog.org) · [WALS](https://wals.info) · [Grambank](https://grambank.clld.org) · [PHOIBLE](https://phoible.org) — catálogos de idiomas e tipologia
  - [GiellaLT](https://giellalt.uit.no) / ALTLab — os transdutores morfológicos (FSTs)
  - [Masakhane](https://www.masakhane.io) — comunidade de TA para idiomas africanos
  - [OPUS](https://opus.nlpl.eu) — corpora paralelos abertos

> Para patrocinar um prêmio, organizar uma doação de computação ou discutir uma parceria,
> entre em contato com o projeto via [GitHub](https://github.com/gamedaysuits). Os guardiões de chaves comunitárias estão em confirmação; nenhuma nação ou organização é nomeada como parceira antes de consentir.

---

## 1. Filosofia

> **O acordo em uma linha: quebre um idioma, vença, devolva-o.** Champollion é uma operação de benchmarking de ML propositalmente — competição é como pares difíceis são resolvidos. Convidamos pesquisadores de ML e qualquer construtor capaz a construir o melhor método para um par de idiomas específico e difícil, vencer o prêmio, **e** entregar o método resultante à organização de soberania que possui esse idioma (§1.3). A energia competitiva é real, e está apontada para a missão — conseguir que cada idioma seja traduzido, nos termos que seu povo estabelece — não para subir em um placar pelo próprio bem.

### 1.1 Prêmios Recompensam Avanços, Não Participação

O dinheiro do prêmio é liberado apenas quando um método demonstra alcançar um limite de capacidade definido. Não há prêmios de participação, prêmios para segundo lugar ou pagamentos de consolação. Se ninguém passar do critério, ninguém recebe pagamento. Isso é intencional — significa que patrocinadores pagam apenas por resultados que realmente funcionam.

### 1.2 Validação Comunitária É Inegociável

Métricas automatizadas são proxies (SCORING_SPEC §1.1). Um método pode pontuar bem em chrF++ e aceitação de FST enquanto produz saída que nenhum falante aceitaria. **Toda reclamação de prêmio requer validação comunitária** — falantes bilíngues devem confirmar que a saída é utilizável. Este é o portão de validação humana (BENCHMARK_SPEC §7).

### 1.3 Transferência de Propriedade É Parte do Acordo

Métodos que reclamam um prêmio estão sujeitos à cláusula de transferência de propriedade (BENCHMARK_SPEC §8.3). O desenvolvedor mantém direitos de atribuição e publicação. A organização de governança ganha o direito de usar, modificar, distribuir e monetizar o método para seu idioma. Isso não é uma penalidade — é o ponto. O dinheiro do prêmio financia a criação de tecnologia que pertence à comunidade de idiomas.

### 1.4 Anti-Gaming

Os limites de prêmio são definidos contra **avaliação padrão-ouro** (conjunto de testes secreto, executado pela organização de governança em caixa de areia). Os desenvolvedores nunca veem os dados de teste. Isso é aplicado arquitetonicamente — não uma política que depende de honra. Veja BENCHMARK_SPEC §8.2.

### 1.5 Licenciamento de Corpus: Corpora Não-Comerciais Ficam Fora da Pista de Prêmio

Alguns corpora usados durante o desenvolvimento de métodos possuem licenças não comerciais — por exemplo, o corpus do EdTeKLA Cree Language Textbook possui a **CC BY-NC-SA modificada do EdTeKLA** (com escopo de soberania, não comercial; o livro didático base é CC BY-NC-ND 4.0). Esses corpora são **exclusivos para a trilha de pesquisa/desenvolvimento**:

1. **Os corpora padrão-ouro de prêmio não devem incorporar conteúdo de corpus licenciado em NC.** Os segmentos de teste padrão-ouro são originais encomendados pela comunidade (veja Estratégia de Parceria de Corpus) — criados por humanos para o prêmio, com direitos esclarecidos para avaliação e implantação comercial desde o início.
2. **Um método que reclama um prêmio não deve incorporar conteúdo de corpus licenciado em NC** (por exemplo, como dados de coaching, exemplos incorporados ou tabelas de consulta). O método transferido deve ser implantável pela organização de governança em qualquer termo que escolha — incluindo comercialmente, se a comunidade assim decidir (BENCHMARK_SPEC §8.3); conteúdo licenciado em NC dentro dele envenenaria essa liberdade.
3. **Os desenvolvedores podem usar livremente corpora licenciados em NC para desenvolver e auto-avaliar** — é para isso que a pista de desenvolvimento existe. A restrição se aplica ao que é enviado e ao que é implantado, não a como um desenvolvedor aprende.

### 1.6 Classes de Dependência Bloqueiam Elegibilidade de Prêmio

Toda avaliação de prêmio acontece em uma caixa de areia (§1.4), e métodos vencedores de prêmio são transferidos para a organização de governança (§1.3). Ambos os fatos impõem a mesma restrição: **tudo de que um método depende deve ser algo que o desenvolvedor tem o direito de colocar na caixa de areia e transmitir à comunidade.** Cada envio declara uma classe de dependência — definida na [especificação de Interface de Método](/docs/network/specifications/methods#method-validity-and-dependency-classes) — e a elegibilidade segue a classe:

| Classe de dependência | Elegível para prêmio? | Condições |
|------------------|----------------|------------|
| **S** — autossuficiente | ✅ Sim | Nenhuma além das condições de limite em §2 |
| **O** — aberta externa (por exemplo, FST AGPL espelhado no envio) | ✅ Sim | Artefatos fixados e inclusos no envio; licenças permitem transferência comunitária; termos copyleft preservados (a comunidade recebe os mesmos direitos que a licença concede a todos) |
| **A1** — inferência de LLM substituível | ⚠️ Condicional | Modelo declarado, fixado e substituível (deve executar contra um modelo de peso aberto hospedado pela comunidade); avaliação roteada através do gateway de LLM da caixa de areia (🔲 planejado — métodos A1 não podem produzir pontuações padrão-ouro até que o gateway esteja operacional); transferência transmite a receita completa (prompts, coaching, código), não o modelo |
| **A2** — API de serviço/dados externos não-substituível | ❌ Ainda não | Inelegível até que o detentor de direitos conceda permissões de inclusão em caixa de areia e transferência. Permitido no placar aberto com uma bandeira visível de "dependência externa" |
| **X** — conteúdo agrupado sem direitos | ❌ Nunca | Inadmissível em todas as pistas |

A classe de um método é a classe mais restritiva entre suas dependências declaradas. Dependências não declaradas de qualquer classe são desqualificantes (§5).

---

## 2. Pools de Prêmios Propostos (nenhum aberto ainda)

### 2.1 O Prêmio do Fundador — EN→Plains Cree (nêhiyawêwin)

| Campo | Valor |
|-------|-------|
| **Pool de prêmio** | **$10.000 CAD** (proposto) |
| **Par de idiomas** | Inglês → Plains Cree (EN→CRK) |
| **Patrocinador pretendido** | Fundador do projeto Champollion — um compromisso pretendido, **nenhum fundo está sendo mantido em lugar algum ainda.** Quando comprometido, os fundos ficariam com o patrocinador ou um fundo comunitário designado — nunca com Champollion. |
| **Status** | **PROPOSTO — não aberto.** Não aceitando envios. |
| **Abre** | Apenas quando o corpus padrão-ouro, a caixa de areia de avaliação e o portão de revisão de falantes existirem (nenhum existe ainda), e os fundos do patrocinador forem verificavelmente mantidos conforme §4.2. |
| **Expira** | Sem expiração uma vez aberto. |

#### Condições de Limite

Um método reclama o Prêmio do Fundador atendendo **TODAS** as seguintes condições simultaneamente:

| # | Condição | Métrica | Limite | Justificativa |
|---|-----------|--------|-----------|-----------|
| 1 | **Pontuação composta** | `composite` (SCORING_SPEC §4) | **≥ 0,80** | Entre Implantável (0,70) e Fluente (0,85). Requer alta qualidade em todas as dimensões de métrica — não apenas validade morfológica. |
| 2 | **Aceitação de FST** | `fst_acceptance_rate` (SCORING_SPEC §2.2) | **≥ 0,99 (99%+)** | Efetivamente todas as palavras de saída devem ser formas morfologicamente válidas reconhecidas pelo FST do GiellaLT. A tolerância de 1% leva em conta casos extremos (nomes próprios, neologismos, empréstimos) que o FST pode legitimamente não cobrir. Este é o portão de qualidade definidor para TA polissintética — se o FST rejeita mais de 1% das palavras, o método está produzindo formas que não existem no idioma. O ponto inteiro deste prêmio é comprar um sistema que não destrói as coisas. |
| 3 | **chrF++** | `chrf_plus_plus` (SCORING_SPEC §2.1) | **≥ 55,0** | A sobreposição de n-gramas de caracteres deve exceder 55 na escala 0–100. Garante similaridade de nível de superfície com traduções de referência, não apenas validade morfológica. |
| 4 | **Validação comunitária** | Revisão humana (BENCHMARK_SPEC §7) | **≥ 70% "aceitável" ou "excelente"** | Uma amostra estratificada de saídas (≥30 entradas em níveis de dificuldade 2–5) é revisada por ≥2 falantes bilíngues de CRK. Pelo menos 70% das entradas revisadas devem receber uma classificação "aceitável" ou "excelente". |
| 5 | **Avaliação padrão-ouro** | Execução em caixa de areia (BENCHMARK_SPEC §8.2) | **Obrigatório** | Todas as métricas automatizadas devem ser computadas contra o segmento de corpus `gold_standard`, executado pela organização de governança em um ambiente de caixa de areia. Pontuações de conjunto de desenvolvimento não contam. |
| 6 | **Reprodutibilidade** | Correspondência de impressão digital (BENCHMARK_SPEC §3.8) | **±2%** | A organização de governança deve ser capaz de re-executar o método e alcançar pontuações dentro de ±2% da cartão de execução enviado. |

> **Por que 99+% de FST?** O problema central em tradução automática para idiomas polissintéticos é alucinação — LLMs produzem strings que *parecem* o idioma alvo mas são morfologicamente inválidas. Um método que produz 95% de saída válida ainda tem 5% de palavras fabricadas — ruído inaceitável para qualquer uso em produção. O limite de 99%+ exige alucinação quase zero enquanto permite o caso raro (um nome próprio que o FST não conhece, um neologismo legítimo). Se um método não conseguir alcançar aceitação de FST de 99%+, ele não resolveu o problema.
>
> **Por que 0,80 composto?** Isso fica entre Implantável (0,70) e Fluente (0,85). Um método em 0,80 com aceitação de FST de 99%+ produz saída onde praticamente cada palavra é uma palavra real de Cree *e* a qualidade geral de tradução é alta em dimensões de superfície, estrutural e semântica. O portão de validação comunitária (condição #4) garante que isso não seja apenas gaming de métrica — falantes devem confirmar que a saída é genuinamente utilizável.

#### O Que Este Limite Significa na Prática

Em composto ≥ 0,80 com FST ≥ 0,99 e chrF++ ≥ 55, um falante bilíngue tipicamente veria:

- **Praticamente cada** palavra de saída é uma palavra real de Cree (FST valida 99%+ — formas alucinadas quase zero)
- Categorias gramaticais principais (pessoa, número, tempo) estão corretas na maioria das entradas
- A ordem das palavras é geralmente natural
- O significado é preservado de forma confiável
- Os erros restantes são erros de idioma real (inflexão errada, obviation incorreta, incompatibilidades de animacy) — não palavras fabricadas
- Um falante fluente poderia usar a saída como um rascunho de alta qualidade e corrigi-lo significativamente mais rápido do que traduzir do zero

Este é um sistema que **não destrói o idioma.** Pode não ser perfeito, mas cada palavra que produz é uma palavra real. Esse é o critério mínimo para tradução automática respeitosa de um idioma polissintético.

---

## 3. Processo de Reclamação de Prêmio

### 3.1 Envio

1. Desenvolvedor envia seu método completo e executável para a organização de governança:
   - Todo código-fonte
   - Todas as dependências (dados de coaching, dicionários, configurações de FST, prompts)
   - Instruções de instalação e execução
   - Um README descrevendo a abordagem do método
   - Um cartão de execução de conjunto de desenvolvimento mostrando pontuações aproximadas (para pré-triagem)

2. Desenvolvedor assina os termos de participação, incluindo:
   - Cláusula de transferência de propriedade (BENCHMARK_SPEC §8.3)
   - Declaração de não treinamento em dados de avaliação
   - Compromisso de reprodutibilidade

### 3.2 Avaliação

1. Organização de governança instala e executa o método em um harness de caixa de areia contra o corpus `gold_standard`
2. Métricas automatizadas são computadas (composto, FST, chrF++, etc.)
3. Se os limites automatizados forem atendidos (condições 1–3), a organização de governança prossegue para revisão comunitária
4. Se os limites automatizados NÃO forem atendidos, o desenvolvedor recebe pontuações e feedback. Nenhuma revisão comunitária é acionada.

### 3.3 Revisão Comunitária

1. Uma amostra estratificada de saídas (≥30 entradas, cobrindo níveis de dificuldade 2–5) é apresentada a falantes bilíngues
2. No mínimo 2 revisores independentes classificam cada entrada
3. Escala de classificação: **rejeitar** / **essência** / **aceitável** / **excelente**
4. Se ≥70% das entradas receberem "aceitável" ou "excelente" de ambos os revisores, a validação comunitária passa

### 3.4 Pagamento

1. Todas as 6 condições são atendidas
2. Organização de governança confirma resultado
3. Prêmio é pago dentro de 30 dias da confirmação
4. Propriedade do método é transferida conforme BENCHMARK_SPEC §8.3
5. Resultado é publicado no placar com nível de verificação "Validado pela Comunidade"

### 3.5 Múltiplos Envios

- O mesmo desenvolvedor/equipe pode enviar múltiplas vezes
- Cada envio é avaliado independentemente
- Se um método é melhorado e re-enviado, apenas o cartão de execução mais recente conta
- O prêmio é concedido ao **primeiro** método que passa por todos os limites — não é dividido

### 3.6 Envios de Equipe

- Equipes e pares de Anciãos-jovens são elegíveis
- A distribuição de prêmio dentro de uma equipe é responsabilidade da equipe
- Todos os membros da equipe devem assinar os termos de participação
- A atribuição no placar lista todos os membros da equipe

---

## 4. Pools de Prêmios Futuros {#4-future-prize-pools}

O Prêmio do Fundador é a semente. Pools de prêmios adicionais são financiados por patrocinadores. Cada novo pool de prêmio é documentado como uma nova subseção de §2 com seu próprio:

- Valor e moeda do prêmio
- Par de idiomas
- Atribuição do patrocinador
- Condições de limite (que podem diferir do Prêmio do Fundador)
- Data de expiração (se houver)
- Quaisquer condições especiais

### 4.1 Modelo de Prêmio de Patrocinador

Patrocinadores financiam pools de prêmios em qualquer valor. Níveis sugeridos:

| Nível | Valor | Limite Sugerido |
|------|--------|---------------------|
| **Semente** | $5.000–$15.000 | Implantável (composto ≥ 0,70) + validação comunitária |
| **Avanço** | $25.000–$50.000 | Fluente (composto ≥ 0,85) + validação comunitária |
| **Grande Prêmio** | $100.000+ | Fluente + cobertura de múltiplos registros + integração de implantação |

Patrocinadores também podem financiar:
- **Recompensas de melhoria** — pagamento fixo para cada melhoria de 5 pontos em chrF++ sobre o melhor atual
- **Prêmios de registro** — prêmios separados para registros específicos (formal, cerimonial, educacional)
- **Prêmios de velocidade** — melhor pontuação ajustada por custo (SCORING_SPEC §6.3)

### 4.2 Onde os Fundos de Prêmio São Mantidos

Os fundos de prêmio são **mantidos por patrocinador**: ficam com a organização patrocinadora, ou com um fundo comunitário que o patrocinador designa — **nunca com Champollion**, que coordena medição e não toca em dinheiro. Um prêmio credível publica, antes de abrir: **quem mantém os fundos**, sob que arranjo (conta organizacional, fundo ou terceiro escrow da escolha do patrocinador), e o limite de prêmio — para que passar do critério seja verificável a partir de pontuações publicadas mais o veredicto de validação de falante da comunidade, e um padrão de pagamento seria visível publicamente como um. Nenhum fundo de prêmio está sendo mantido em lugar algum hoje. Se um prêmio expirasse sem ser reclamado, os fundos ficariam onde sempre estiveram — com o patrocinador — para serem redirecionados ou retirados a critério do patrocinador. A mecânica de autoatendimento, incluindo o risco de padrão do patrocinador e suas mitigações, está documentada em [Executar um Concurso Soberano](/docs/network/sovereignty/run-a-sovereign-contest) e os [Modelos de Termos](/docs/network/sovereignty/terms-templates).

---

## 5. Desqualificação

Um envio é desqualificado se:

1. **Treinamento em dados de avaliação.** O método foi exposto a entradas de corpus `gold_standard` ou `held_out`. (Arquitetonicamente prevenido por execução em caixa de areia — mas se evidência de contaminação for encontrada, o resultado é anulado.)
2. **Não-reprodutível.** A organização de governança não consegue reproduzir pontuações dentro de ±2%.
3. **Dependências não declaradas ou inelegíveis.** O método requer acesso em tempo de execução a serviços externos além do que seu manifesto de dependência declara, ou sua classe de dependência efetiva é A2 ou X (§1.6). Inferência de LLM de Classe A1 declarada roteada através do gateway de avaliação é permitida; qualquer outra dependência de rede em tempo de execução — e qualquer dependência não declarada de qualquer classe — é desqualificante.
4. **Termos de participação não assinados.** Todos os membros da equipe devem concordar com a transferência de propriedade.
5. **Gaming detectado.** A saída é otimizada para a métrica em vez de qualidade de tradução (capturada por revisão comunitária e/ou verificações anti-gaming conforme BENCHMARK_SPEC §9.3).

---

## 6. Relação com Outras Especificações

| Este Documento | Referencia | Para |
|--------------|-----------|-----|
| §2 condições de limite | SCORING_SPEC §4 (composto), §2.1–2.2 (métricas), §5 (níveis) | Definições de métrica e escala |
| §2 validação comunitária | BENCHMARK_SPEC §7 | Protocolo de revisão humana |
| §3 execução em caixa de areia | BENCHMARK_SPEC §8.2 | Mecanismo de soberania |
| §3 transferência de propriedade | BENCHMARK_SPEC §8.3 | Termos de transferência de IP |
| §1.6 classes de dependência | Especificação de Interface de Método; BENCHMARK_SPEC §8.6 | Definições de classe, termos de admissibilidade, política de rede de caixa de areia |
| §4 prêmios ajustados por custo | SCORING_SPEC §6.3 | Fórmula ajustada por custo |

---

## 7. Sincronização Código–Especificação

### 7.1 Fonte Canônica

Este documento (`cli/website/docs/network/specifications/prize-spec.md`) é a fonte canônica para:
- Definições de pool de prêmio (§2)
- Condições de limite (§2.x)
- Processo de reclamação (§3)
- Regras de desqualificação (§5)

### 7.2 Requisitos de Implementação

Quando um pool de prêmio é ativado:
1. A UI do placar deve exibir prêmios ativos e suas condições de limite
2. Cartões de execução que atendem limites automatizados (condições 1–3) devem ser sinalizados para revisão comunitária
3. O campo `quality_tier` no esquema de cartão de execução já captura o nível ("implantável", "fluente")
4. Nenhuma mudança de código nova no harness é necessária — a especificação de prêmio é uma camada de política em cima da pontuação existente

---

*Estruturas de prêmio devem ser compatíveis com termos de transferência de propriedade. O vencedor pode reclamar o prêmio, mas o método se torna propriedade da organização de governança se atingir o nível Implantável. Isso é intencional — o prêmio financia a criação de tecnologia que pertence à comunidade de idiomas.*
