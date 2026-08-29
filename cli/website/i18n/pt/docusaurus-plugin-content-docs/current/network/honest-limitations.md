---
title: "Limitações Honestas"
description: "O que Champollion não (ainda) oferece. Os limites verificáveis em nossa avaliação, níveis de confiança, validação comunitária e infraestrutura reservada."
---

# Limitações Honestas

> Estas são as afirmações que **não** vamos exceder. Se qualquer coisa em outro
> lugar neste site implicar mais do que o que está escrito aqui, trate como um
> bug e [nos avise](/docs/network/perspectives/reporting-errors-and-owning-corrections).

A infraestrutura de avaliação só ganha confiança sendo honesta sobre seus
limites. Aqui estão os nossos, declarados de forma clara o suficiente para
verificar.

## 1. A validação morfológica profunda atualmente cobre um par

A validação morfológica baseada em FST — verificar que cada palavra de saída é
uma palavra bem-formada na língua de destino — na prática está configurada para
**English → Plains Cree apenas**. O `GiellaLTFSTMetric` em si é **genérico**: ele
avalia qualquer língua com um analisador GiellaLT `.hfstol` publicado
(Plains Cree, as línguas Sámi, finlandês, norueguês Bokmål, inuktitut e outros),
então a capacidade é ampla. Mas **corpora de avaliação existem apenas para
Plains Cree** hoje, então crk é o único par que é avaliado por FST na prática.
Todos os outros pares no leaderboard são avaliados com métricas de superfície
(chrF++, BLEU) e verificações comportamentais. Esses são sinais úteis, mas eles
**não** garantem validade morfológica. Não reivindicamos validação morfológica
para nenhuma língua sem tanto um FST quanto um corpus de avaliação.

## 2. Os níveis de confiança são auto-relatados no lançamento

A maioria dos scores é computada por contribuidores executando o harness eles
mesmos e publicando o resultado. A **verificação** do lado do servidor —
re-avaliação de uma submissão contra o corpus canônico fixado por SHA — existe e
está se expandindo, mas "verificado" ainda não é universal. Leia o badge de
confiança em cada linha: **"auto-relatado" significa exatamente isso**, e é o
padrão.

## 3. A validação por falantes da comunidade ainda não aconteceu

Nosso prêmio requer **≥ 70% de aceitação de falantes bilíngues**. Esse critério
é especificado, e a ferramenta para executá-lo está em construção — mas **nenhuma
revisão por falantes da comunidade foi conduzida**, e **nenhum score neste site
passou pelo critério de falantes**. Números compostos e chrF++ são sinais de
máquina, não um veredicto da comunidade.

## 4. A sandbox de avaliação existe; sua cerimônia de custódia ainda não

Buscamos os corpora em sua fonte e os fixamos com SHA, e as divisões reservadas são seladas. Quando uma comunidade mantém um conjunto de testes secreto, um método pode ser pontuado em relação a ele sem que o conjunto saia de suas mãos — e essa avaliação agora possui **duas vias**. A
preferida, para modelos neurais padrão, é a **declarativa**: o participante
envia apenas dados — pesos safetensors + um tokenizador declarativo + uma config —
e o organizador executa isso em seu próprio motor de inferência confiável
(`trust_remote_code=False`, offline; permissivo em relação à arquitetura porque
a segurança está no formato sem código, não no nome da arquitetura). Nenhum código do participante é executado,
portanto não há nada para isolar em sandbox; a verificação de segurança é uma validação de formato decidível
(isso é safetensors e não um pickle? sem `trust_remote_code`?), não
uma tentativa de provar que um código arbitrário é seguro. Para métodos que são genuinamente código
(pipelines, híbridos orientados por LLM), a alternativa é a **sandbox** isolada da rede
(verificações estáticas, contêineres `--network=none`, saída apenas de pontuações,
um transporte de arquivos true-airgap opcional). A sandbox contém código não confiável
em vez de se recusar a executá-lo, portanto, é a via honestamente mais fraca — sua garantia
de sustentação é `--network=none` (uma varredura estática heurística não pode validar um modelo
binário), e o fortalecimento mais profundo (seccomp, microVMs) é adiado. Consulte
[executar um concurso soberano](/docs/network/sovereignty/run-a-sovereign-contest)
para saber exatamente o que está ativo e o que não está. O que **não** está construído de nenhuma das formas: o
lado da custódia de chaves pela comunidade — assinaturas com limite (*threshold signing*), cerimônias de chaves e atestado de nós.
A autorização atual é um processo registrado (custodiantes únicos, chaves únicas, rotulados honestamente), de modo que a avaliação de **prêmios** padrão-ouro permanece fechada até que o trabalho de custódia e o consentimento da comunidade se atualizem.

## 5. A custódia de chaves é decidida; custódios comunitários estão em confirmação

O *mecanismo* de custódia é decidido: um esquema de threshold/multisig no qual
**Champollion não possui nenhuma participação de chave**. Os custódios em si são
escolhidos pelas comunidades, e essas conversas estão em andamento — então
dizemos **"custódios de chaves comunitários (em confirmação)."** Custódia não é
consentimento: o processo relacional de consentimento comunitário é sua própria
trilha, mais lenta e mais importante.

---

Esses limites se moverão conforme o trabalho avança. Quando um deles mudar, esta
página muda com ele — e a mudança deve ser visível no histórico da página, não
silenciosamente descartada.
