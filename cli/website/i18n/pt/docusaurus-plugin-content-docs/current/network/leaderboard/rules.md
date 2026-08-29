---
sidebar_position: 1
title: "Regras de Submissão"
related:
  - label: "Scoring Specification"
    to: /docs/network/specifications/scoring
    kind: spec
    note: "How the composite score is computed"
  - label: "Statistical Significance Testing"
    to: /docs/network/specifications/significance
    kind: spec
  - label: "Evaluation Datasets"
    to: /docs/network/leaderboard/datasets
    kind: doc
  - label: "Live Leaderboard"
    to: https://champollion.dev/leaderboard
    kind: leaderboard
    note: "The rules, applied"
---

# Avaliação de MT

> **Resumo Executivo.** Esta página define os critérios de submissão do leaderboard, métricas de pontuação (chrF++, aceitação FST, correspondência exata, correspondência equivalente, pontuação semântica), políticas anti-gaming, níveis de verificação e o fluxo de submissão. Métodos que foram expostos a dados de avaliação são desqualificados.

champollion inclui um framework de avaliação de tradução automática projetado para **benchmarking reproduzível** de métodos de tradução — especialmente para idiomas de baixo recurso e indígenas onde benchmarks padrão de MT não existem e afirmações de qualidade são difíceis de verificar.

---

## O Leaderboard

A peça central é o **[Placar de Métodos](https://champollion.dev/leaderboard)** — um placar público, ao vivo e **aberto para envios**, onde pesquisadores e membros da comunidade enviam e comparam métodos de tradução com avaliação reproduzível e com impressão digital (fingerprint).

Cada submissão inclui:

- **Pipeline com fingerprint** — vinculado a um commit específico do Git e hash de configuração, para que os resultados sejam rastreáveis até o código exato que os produziu
- **Dataset versionado** — com hash de conteúdo e versionado; as pontuações só são comparáveis dentro da mesma versão do dataset
- **Métricas padronizadas** — toda a pontuação é calculada pelo harness de avaliação compartilhado, eliminando diferenças de implementação
- **Níveis de confiança** — autoavaliado (self-benchmarked), Verificado pelo Champollion (Champollion Verified) ou Validado pela Comunidade (Community Validated)
- **Rastreamento de custos** — custo de API por envio, para que as compensações entre custo e qualidade sejam transparentes

O leaderboard pontua cinco métricas. Três funcionam para qualquer idioma; duas estão disponíveis para Plains Cree e serão generalizadas conforme expandimos:

| Métrica | Tipo | O Que Mede |
|---------|------|-----------|
| **chrF++** | F-score de n-gramas de caracteres | Métrica de qualidade primária — correlaciona bem com julgamento humano, especialmente para idiomas morfologicamente ricos |
| **Exact Match** | Proporção de correspondências perfeitas | Precisão rigorosa — com que frequência a tradução é exatamente o padrão ouro? |
| **FST Acceptance** | Taxa de aprovação do portão morfológico | Para métodos com verificação de transdutor de estado finito — qual proporção de saídas é morfologicamente válida? |
| **Equivalent Match** | Taxa de variante aceitável | Fração correspondente à referência ou a uma variante aceitável (ordem de palavras, convenção ortográfica). Atualmente CRK; generalizando. |
| **Semantic Score** | Fidelidade semântica | Preservação de significado — a tradução captura o significado pretendido independentemente da forma de superfície? Atualmente CRK; generalizando. |

:::info[Conjunto Completo de Métricas]
A [Especificação de Pontuação](/docs/network/specifications/scoring) define o inventário completo de métricas (seis categorias: superficial, estrutural, semântico, comportamental, conformidade e comparadores reportados), fórmula de pontuação composta, tabelas de peso e limites de nível de qualidade.
:::

**[→ Ver o leaderboard](https://champollion.dev/leaderboard)**

---

## Datasets Disponíveis

### EDTeKLA Development Set v1

O primeiro dataset de avaliação, construído para tradução English→Plains Cree (SRO). Criado pelo [grupo de pesquisa EdTeKLA](https://spaces.facsci.ualberta.ca/edtekla/) da Universidade de Alberta.

| Propriedade | Valor |
|----------|-------|
| **ID** | `edtekla-dev-v1` |
| **Par de idiomas** | EN → CRK (Plains Cree, ortografia SRO) |
| **Contagem de entradas** | Divisão de desenvolvimento com 436 entradas (`textbook_dev.json`); o detalhamento completo é declarado uma vez na [página de Datasets de Avaliação](/docs/network/leaderboard/datasets#edtekla-development-set-v1) |
| **Licença** | [CC BY-NC-SA modificada da EdTeKLA](https://github.com/EdTeKLA/IndigenousLanguages_Corpora) (`LicenseRef-EdTeKLA-Modified-CC-BY-NC-SA-4.0`, com escopo de soberania) — não comercial; excluída das vias do placar, de prêmios e comercial/API |
| **Proveniência** | `gold_standard` (verificado por falantes), `textbook` (materiais educacionais publicados) |

### FLORES+ Devtest — Apenas Uso em Desenvolvimento

> [!WARNING]
> **FLORES+ está disponível para desenvolvimento e debugging, mas NÃO é usado para avaliação oficial do leaderboard.** FLORES+ (originalmente Meta FLORES-200) é um dataset de benchmark amplamente público que LLMs de fronteira quase certamente foram treinados. Pontuações contra FLORES+ não refletem confiávelmente a qualidade de tradução do mundo real para métodos baseados em LLM. Métodos não-LLM (FST, baseados em regras, NMT fine-tuned) são menos afetados, mas pontuações FLORES+ ainda não são publicadas no leaderboard.

Fixtures FLORES+ permanecem disponíveis em `test/benchmark/fixtures/` para smoke testing de pipeline, validação entre idiomas e uso em desenvolvimento. A avaliação oficial usa corpora customizados construídos a partir de texto escrito por humanos não disponível publicamente em forma paralela.

Veja [Evaluation Datasets](/docs/network/leaderboard/datasets) para o schema completo do dataset, níveis de dificuldade e como criar o seu próprio.

:::danger[NÃO TREINE com dados de avaliação]

**Estes datasets são apenas para avaliação.** Métodos treinados, fine-tuned, few-shot-prompted ou de outra forma expostos a dados de avaliação produzirão pontuações artificialmente inflacionadas e serão **desqualificados do leaderboard.**

Isto não é uma sugestão — é a regra mais importante de integridade de avaliação. Use corpora separados para treinamento. Conjuntos de avaliação devem permanecer invisíveis para seu modelo durante o desenvolvimento.

Se você está usando dados de coaching ou exemplos few-shot, eles devem vir de **fontes completamente separadas**. Se tiver dúvida, não inclua.
:::

:::warning[Não-determinismo de LLM]

Saídas de LLM são não-determinísticas. Pontuações representam medições em um ponto no tempo sob versões de modelo específicas e configurações de API. Provedores de modelo podem atualizar pesos, estratégias de decodificação ou filtros de segurança a qualquer momento, o que pode causar drift de pontuação entre execuções. O leaderboard registra o slug de modelo exato e timestamp para cada submissão.
:::

---

## O Que Faz um Bom Método

Nem todos os métodos são criados iguais. Aqui está o que separa trabalho rigoroso de pontuações inflacionadas.

### Características de um método forte

- **Separação limpa de dados de treinamento e avaliação** — seu método nunca viu o conjunto de avaliação durante desenvolvimento, tuning, engenharia de prompt ou seleção de exemplos few-shot
- **Reproduzível** — alguém pode clonar seu repo, executar o harness e obter as mesmas pontuações (dentro dos limites de não-determinismo de LLM)
- **Documentado** — seu [method card](/docs/network/specifications/methods) descreve o que seu método faz, quais ferramentas usa e quais são suas limitações
- **Honesto sobre escopo** — se seu método funciona apenas para um par de idiomas, diga; se degrada em certos padrões morfológicos, documente isso
- **Consciente da comunidade** — para idiomas indígenas, seu método respeita soberania de dados. Você consultou comunidades de linguagem ou usou apenas dados com licença aberta

### Sinais de alerta (o que é desqualificado)

| Sinal de Alerta | Por Que É um Problema |
|-----------------|----------------------|
| Treinamento em dados de avaliação | Derrota completamente o propósito da avaliação. Pontuações inflacionadas enganam todos. |
| Cherry-picking de resultados | Executar 10 vezes e enviar a melhor execução sem divulgar as outras |
| Pós-processamento não divulgado | Corrigir manualmente saídas antes de pontuar |
| Dados de coaching contaminados | Usar exemplos do conjunto de avaliação como prompts few-shot ou entradas de dicionário |
| Afirmar prontidão comercial sem proveniência | Se seu método usa dados CC BY-NC-SA, não está pronto comercialmente |

### Níveis de verificação

Níveis de verificação descrevem **quem validou o resultado** — separado dos níveis de qualidade (Baseline → Fluent) definidos na [Especificação de Pontuação, §5](/docs/network/specifications/scoring#5-quality-tiers), que descrevem o que a pontuação composta automatizada significa.

| Nível | Significado | Como Obter |
|------|---------|--------------|
| **Autoavaliado** | Você mesmo executou o harness e enviou os resultados | Publique seu run card com `mt-eval publish` |
| **Verificado pelo Champollion** | O servidor recalculou de forma independente as suas saídas enviadas em relação ao corpus de referência fixado por SHA e reproduziu a sua pontuação | Automático — todo envio é recalculado (veja abaixo) |
| **Validado pela Comunidade** | Falantes bilíngues do idioma de destino, qualificados sob o próprio protocolo da comunidade, revisaram uma amostra estratificada da saída (≥30 entradas, ≥2 revisores) e ≥70% atingiram o padrão da comunidade. Conferido apenas pelos próprios testes da comunidade; o rebaixamento por auditoria pontual é simétrico | Envie o código do método para a organização de governança — eles o executam em relação ao conjunto padrão-ouro (gold-standard) e submetem a saída à revisão da comunidade |

### Como a verificação escala: auditoria ponderada por reputação

**Não reivindicamos proveniência.** Uma linha no placar é produzida por um contribuidor
executando o harness de *código aberto* em sua *própria* máquina. "Esta execução realmente passou
pelo harness" não é algo que um servidor possa verificar para computação auto-hospedada — a
chave de assinatura do harness está nas mãos do contribuidor, portanto, uma
assinatura autentica uma *máquina, não a honestidade*. Em vez de fingir o
contrário, **a validade aqui é conquistada e autocorretiva**: uma linha é confiável
porque sua pontuação é **reproduzível** e porque o contribuidor por trás dela
**arriscou uma reputação que uma falsificação descoberta destruiria.** A verificação é
executada em quatro camadas, para que seja minuciosa onde deve ser e barata onde pode ser
— o projeto nunca precisa reexecutar o trabalho de todos.

- **L0 — recalcular tudo (gratuito, 100%).** O servidor deriva novamente a sua pontuação
  a partir das *suas próprias saídas enviadas* em relação ao **corpus de referência fixado por SHA**
  (não a sua cópia armazenada dele), com a mesma métrica que o harness usa. Se a
  pontuação não for reproduzida a partir das saídas, ou se uma referência armazenada foi alterada,
  a execução é **desqualificada** — isso por si só elimina uma pontuação digitada ou editada. Uma
  execução que é reproduzida é promovida a **Verificado pelo Champollion**, o único nível que o
  placar ranqueia. Isso é executado em todos os envios e leva milissegundos.
- **L1 — uma escada de reputação do contribuidor.** Cada contribuidor (identificado pelo seu
  login) ganha reputação *apenas* por sobreviver às verificações mais profundas abaixo — nunca
  apenas por volume, então criar novas identidades não traz vantagem alguma. A reputação é
  **pública** e decide com que frequência a verificação custosa é acionada.
- **L2 — reexecutar uma *amostra* (a verificação custosa).** Para um conjunto de desenvolvimento
  *público*, o L0 não consegue pegar um contribuidor que simplesmente copia a referência como sua
  "tradução". Pegar isso exige realmente reexecutar o modelo — computação real — então fazemos isso em uma
  **amostra**, não em todos. Uma execução é amostrada para uma reexecução L2 com uma probabilidade que aumenta com os
  **riscos** (uma execução que estabelece a primeira ponte para toda uma família de idiomas é *sempre* reexecutada),
  aumenta com a **anomalia** (um salto bom demais para ser verdade sobre o melhor anterior é *sempre*
  reexecutado) e diminui com a **reputação** (um contribuidor que passou por muitas auditorias é
  verificado por amostragem raramente; um novato ou remetente anônimo é verificado em
  todas as execuções até ganhar confiança). Passar por uma auditoria L2 aumenta a reputação.
- **L3 — corroboração (verificação gratuita).** Quando dois contribuidores *independentes*
  executam o mesmo modelo no mesmo corpus e suas saídas recalculadas **concordam**,
  essa concordância *é* a verificação — e aumenta a reputação de ambos. Uma
  **discordância** genuína sinaliza ambas as execuções para uma auditoria L2. A replicação é
  recompensada em vez de ser tratada como redundante.

**Uma falsificação descoberta é catastrófica — como uma retratação.** Uma falsificação
comprovada zera a reputação do contribuidor, **reaudita todo o seu histórico verificado**
(cada uma de suas execuções verificadas é enviada de volta para verificação) e é registrada
**publicamente** no log de auditoria. É isso que torna a amostragem leve segura:
trapacear em um conjunto de desenvolvimento público pode passar despercebido em uma execução, mas
o custo esperado — perder toda a confiança conquistada e ter todo o seu registro reexaminado —
torna isso uma péssima aposta. Essas regras vinculam as próprias execuções dos mantenedores de forma simétrica.

**Por que ainda vale a pena contribuir.** Você sempre paga a parte cara
(executar o seu método); o projeto paga apenas o recálculo L0 gratuito para todos
mais uma reexecução L2 em uma *amostra decrescente* — alta para novatos e execuções de alto risco,
baixa para contribuidores comprovados. O custo de verificação é *amortizado pela reputação
e compartilhado pela corroboração*, não pago integralmente todas as vezes.

---

## Como Enviar

1. **Construa o seu método** — veja [Construindo um Método](/docs/network/specifications/methods) para a interface do método
2. **Execute o harness** — veja [Harness de Avaliação](/docs/network/specifications/harness) para configuração e uso
3. **Gere um run card** — o harness produz um run card em JSON com as suas pontuações, fingerprint e metadados
4. **Publique** — `mt-eval publish eval/logs/harness/<your-run-card>.json` faz o upload do run card para o placar
5. **Apareça no placar** — a sua execução é registrada como *autoavaliada (não verificada)*, então o servidor recalcula automaticamente as suas saídas em relação ao corpus fixado por SHA (L0); quando reproduzida, a execução é promovida a *Verificado pelo Champollion* — o único nível que o [Placar de Métodos](https://champollion.dev/leaderboard) ranqueia. Uma auditoria mais profunda ponderada por reputação segue os níveis de confiança acima

---

## Política de Integridade: Retratações, Reexecuções, Deslistagem, Disputas

Escritas com antecedência para que a aplicação seja um procedimento, não um drama. Essas regras
vinculam todos de forma simétrica — incluindo as próprias execuções dos mantenedores.

**Sem retratações.** Uma execução publicada é um registro permanente. Não há
mecanismo — para ninguém — de excluir uma pontuação porque ela é embaraçosa.
Cada linha de execução carrega um carimbo de data/hora `submitted_at` marcado pelo servidor e
uma trilha de auditoria imutável; as próprias ações de moderação são registradas.

**Reexecuções são anexadas, nunca substituem.** Se você melhorar o seu método, publique uma nova
execução. A execução antiga permanece. A divulgação seletiva — testar de forma privada muitas
variantes e publicar apenas a vencedora — é o que tornou outros placares
manipuláveis; um registro apenas de anexação (append-only) é a resposta estrutural. A desduplicação
por fingerprint impede o spam de reenvios idênticos em bytes; ela nunca reescreve a história.

**A deslistagem é a execução de uma regra, com a regra nomeada.** Uma execução é deslistada
(marcada como `disqualified`, de forma visível — não removida silenciosamente) apenas por causas
listadas: um dataset em quarentena ou subconjunto impróprio (aplicado por gatilho de banco de dados
abaixo de cada cliente), incompatibilidade de checksum do corpus, pontuações falsificadas ou
fora do intervalo, violações de proteção de conteúdo ou a retirada do registro dos dados
subjacentes por um administrador (steward). A deslistagem nomeia a regra e a evidência. Novas causas são
adicionadas aqui por edição datada antes de serem aplicadas, nunca inventadas retroativamente para um caso.

**Níveis de confiança são rótulos, não edições.** Linhas `self-benchmarked` são alegações;
linhas `Champollion Verified` foram recalculadas de forma independente a partir das
saídas do remetente em relação ao corpus fixado por SHA; `Community Validated` é
conferido apenas pelos próprios testes da comunidade. A verificação altera o nível de uma linha — ela nunca altera as pontuações da linha.

**A reputação é pública e autocorretiva.** A reputação do contribuidor e o
log de auditoria que registra cada recálculo, reexecução amostrada, corroboração e
queima por falsificação são públicos. A reputação não é um multiplicador de pontuação e nunca
toca nos números de uma execução — ela apenas define com que frequência as execuções de um contribuidor são
reauditadas (veja *auditoria ponderada por reputação* acima). Uma falsificação comprovada é
registrada tão publicamente quanto uma retratação e reaudita todo o histórico
verificado do contribuidor; as mesmas regras se aplicam às próprias execuções dos mantenedores.

**Disputas.** Abra uma issue com o ID da execução e a alegação específica (pontuação errada, dataset errado, regra mal aplicada). Os mantenedores reexecutam as verificações determinísticas em público; o resultado e suas evidências vão para a issue. Se a disputa for sobre os dados ou a validação de uma comunidade, a própria autoridade da comunidade decide e o placar implementa a sua decisão. Para concursos com prêmios, as mesmas regras se aplicam, além das etapas de qualificação e auditoria pré-publicadas do concurso — os vencedores são auditados **antes** do pagamento, e uma desqualificação cita a regra exatamente como qualquer outra deslistagem.

## Direções Futuras

- **Execuções de comparação de modelo abrangentes** — avaliação sistemática de modelos de fronteira (GPT-4o, Claude, Gemini, etc.) em idiomas champollion usando corpora de avaliação customizados (não benchmarks públicos)
- **Mais pares de idiomas** — Quechua, Inuktitut e outros idiomas de baixo recurso conforme datasets verificados pela comunidade ficarem disponíveis
- **Importação de dataset** — ferramentas para converter datasets de avaliação externos (WMT, Tatoeba, etc.) no formato de avaliação champollion
- **Re-execuções automatizadas** — detectando mudanças de versão de modelo e re-executando benchmarks para rastrear drift de pontuação

---

## Veja Também

- **[Method Leaderboard](https://champollion.dev/leaderboard)** — pontuações e submissões ao vivo
- **[Eval Harness](/docs/network/specifications/harness)** — como executar avaliações
- **[Evaluation Datasets](/docs/network/leaderboard/datasets)** — formato de dataset e datasets disponíveis
- **[Building a Method](/docs/network/specifications/methods)** — especificação da interface do método
- **[Run Card Specification](/docs/network/specifications/run-card)** — schema JSON do run card
- **[Benchmark Specification](/docs/network/specifications/benchmark)** — protocolo de avaliação, formato de corpus, soberania
- **[Scoring Specification](/docs/network/specifications/scoring)** — SSOT para métricas, pesos compostos e níveis de qualidade
