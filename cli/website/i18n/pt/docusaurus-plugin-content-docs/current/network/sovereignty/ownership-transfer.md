---
sidebar_position: 2
title: "Propriedade & Termos"
---

# Propriedade & Termos

> **Resumo Executivo.** Champollion não possui um acordo universal, por design.
> Os termos são definidos por corpus, por idioma e por prêmio pelo responsável que
> detém os dados — o trabalho da plataforma é respeitar quaisquer que sejam esses termos. Esta
> página descreve as dimensões que uma planilha de termos cobre e o **Community
> Transfer Template**, o ponto de partida padrão para prêmios patrocinados em
> corpora de idiomas indígenas.

## O framework de termos

Champollion foi projetado para ser flexível em seus termos, de modo que todas as licenças sejam
respeitadas — e para que possa suportar arranjos inovadores: corpora secretos,
conjuntos de testes mantidos pela comunidade e requisitos de implantação soberana. Diferentes
idiomas terão diferentes acordos. Um corpus CC0, um corpus comunitário apenas para pesquisa e um
conjunto de padrão-ouro selado governado por um conselho tribal
podem todos participar, cada um em seus próprios termos.

O que é uniforme é a maquinaria que honra esses termos: exposure lanes,
license gates, quarantine e fetch-from-source registration (veja
[Registering Corpora](/docs/network/sovereignty/registering-corpora)). O que *nunca* é uniforme é o acordo em si.

Quando um responsável de corpus define termos — para participação em benchmark, para um prêmio
patrocinado ou para qualquer outra coisa — a planilha de termos responde um pequeno conjunto de perguntas:

| Dimensão | A pergunta |
|---|---|
| **Corpus exposure** | Qual lane — pública, apenas para pesquisa ou privada? Referências são mostradas? |
| **Method ownership** | Se um prêmio for ganho, quem é o proprietário do método vencedor — o desenvolvedor, a comunidade ou compartilhado? |
| **Deployment** | Quem pode implantar o método, onde e sob quais condições? |
| **Self-hosting** | O método deve ser executado inteiramente em infraestrutura controlada pela comunidade? |
| **Secrecy** | O conjunto de testes é selado? Quem detém as chaves? Quem autoriza cada execução de avaliação? |
| **Compensation** | Quanto recebem construtores, validadores e revisores? (Padrões publicados: [How Speakers Get Paid](/docs/network/perspectives/how-speakers-get-paid)) |

Nenhuma dessas tem respostas impostas pela plataforma. Os padrões abaixo são um template,
não uma regra.

## O Community Transfer Template

Para prêmios patrocinados em corpora de idiomas indígenas, o template padrão —
oferecido como ponto de partida para um órgão de governança da comunidade revisar —
funciona assim:

### 1. Desenvolvimento do método
Um pesquisador, estudante ou desenvolvedor constrói um método de tradução — um pipeline
com FST-gate, um LLM treinado, um modelo fine-tuned ou qualquer outra abordagem — usando
seus próprios recursos e dados com licença aberta.

### 2. Avaliação de rede
O método é avaliado através do [eval harness](/docs/network/specifications/harness).
Cada submissão é impressa digitalmente em um commit Git específico e versão de dataset.
Os scores são reproduzíveis.

### 3. Revisão comunitária
Os resultados são revisados por trabalhadores de linguagem da comunidade. Um score alto no leaderboard
prova que o método *funciona*; não prova que é *apropriado*. Falantes bilíngues
validam uma amostra de outputs, e os revisores da comunidade podem rejeitar
um método por qualquer motivo.

### 4. Transferência de propriedade
Quando um método atende à barra do prêmio (métricas automatizadas **e** validação humana),
o desenvolvedor transfere o método — código-fonte, pesos treinados,
configuração, dados de coaching — para a organização de governança da comunidade
(um conselho tribal, autoridade de linguagem ou corpo similar escolhido pela comunidade,
nunca por Champollion). A comunidade é proprietária do artefato completamente: pode
inspecionar, modificar, implantar, arquivar ou licenciar, sem nenhuma reivindicação contínua do
desenvolvedor ou de Champollion.

Componentes de terceiros que o desenvolvedor não possui (um modelo base de peso aberto,
um FST AGPL) não podem ter sua propriedade transferida — eles passam para a
comunidade sob suas próprias licenças abertas, razão pela qual a admissibilidade do prêmio
requer que toda dependência carregue direitos que a comunidade possa realmente receber.
Veja as classes de dependência na
[Method Interface spec](/docs/network/specifications/methods#method-validity-and-dependency-classes).

O desenvolvedor mantém o que pesquisadores devem manter: o direito irrestrito de
publicar a abordagem e resultados, reutilizar suas técnicas em qualquer lugar e
atribuição permanente como criador do método.

### 5. Implantação — se e como a comunidade escolher
A comunidade decide se o método é implantado, por quem e em quais termos. A implantação
independente é inteiramente assunto da comunidade:
**Champollion não recebe nenhuma parte de nada que uma comunidade ganhe de um ativo que
possui**, e não mantém direitos de implantação próprios.

:::note[Status: modelo, não histórico]
Nenhum prêmio foi aberto e nenhuma transferência aconteceu ainda — o placar
atualmente não tem execuções publicadas. Este modelo é documentado para que os
termos pretendidos sejam transparentes antes de qualquer pessoa investir esforço,
e para que o órgão de governança de uma comunidade tenha um rascunho concreto
para reagir em vez de uma página em branco. Um instrumento assinado, elaborado
com assessoria jurídica para as partes específicas, é o que tornaria qualquer
coisa disso vinculante.
:::

## Para pesquisadores

Se você está desenvolvendo um método para um idioma indígena:

1. **Estabeleça um relacionamento** com a comunidade de linguagem antes de começar
2. **Use dados com licença aberta** para desenvolvimento (não recursos restritos à comunidade)
3. **Documente a proveniência** em seu [run card](/docs/network/specifications/run-card) — cada recurso, sua licença e origem
4. **Leia os termos do prêmio antes de construir para ele** — se os termos incluem
   transferência, sua contribuição é a arquitetura e técnica (suas para
   publicar e reutilizar); a contribuição da comunidade é o conhecimento
   linguístico que a torna funcionar para seu idioma

## Veja Também

- [Data Stewardship](/docs/network/sovereignty/data-sovereignty) — a posição que esses termos implementam
- [How the Work Is Funded](/docs/network/sovereignty/economic-model) — para onde o dinheiro se move e o que Champollion recebe (nada)
- [Registering Corpora](/docs/network/sovereignty/registering-corpora) — exposure lanes e fetch-from-source
- [Prize Specification](/docs/network/specifications/prizes) — condições de limite e processo de reclamação
