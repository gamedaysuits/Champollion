---
title: "Tabela de classificação e publicação"
slug: /reference/leaderboard
description: "O que é o ranking público, os dois tipos de benchmark (público e selado), o que ele cobre e o que não cobre, e exatamente o que uma execução publicada contém."
---

# Tabela de classificação e publicação

A [tabela de classificação](/leaderboard) é um registro público de execuções de tradução pontuadas.
Qualquer pessoa pode adicionar a ela: você executa a estrutura de avaliação (`mt-eval`) na sua própria
máquina, em relação a um conjunto de dados registrado, e publica o resultado como um **cartão
de execução**. A tabela guarda o cartão; ela não executa o seu método para você. Ela
mantém texto por sentença apenas para conjuntos de dados redistribuíveis e sob licença aberta —
nunca para aqueles não comerciais, restritos, selados, em quarentena ou somente locais,
e nunca quando você publica com `--scores-only`.

É um registro de medições, não um veredito sobre qualquer tradutor. Uma posição
nele diz como um método pontuou em um conjunto de dados sob uma métrica. Não diz
que a tradução é boa, e não concede a ninguém permissão para usar um método no
idioma de uma comunidade.

## Três coisas, mantidas separadas

| | O que é | Onde é executado |
|---|---|---|
| **A estrutura de avaliação** ([`mt-eval`](/docs/network/specifications/harness)) | O pontuador. Dado um método e um conjunto de testes, produz uma pontuação e um cartão de execução | Sua máquina |
| **A tabela de classificação** | A porta de envio e o registro de cartões de execução, indexado por conjunto de dados e direção do par | champollion.dev |
| **O mapa da rede** | A soma do que as execuções publicadas representam: quais pares foram medidos e quais não foram | Uma visualização do registro, não um componente |

Nada entra no mapa a não ser por meio da tabela, e nada entra na tabela
a não ser como uma execução pontuada e com impressão digital. Uma medição sem proveniência não
pode fazer parte dele.

## Dois tipos de benchmark

**Benchmarks públicos** usam conjuntos de dados abertos. Cada conjunto de dados é registrado como um
cartão de metadados com um ponteiro de busca na fonte: a estrutura de avaliação baixa as
referências do upstream em tempo de execução, verifica-as em relação a um SHA-256 fixado
e pontua em relação ao que buscou. Dados públicos já podem estar nos dados de treinamento
de um modelo, portanto os conjuntos de dados trazem um grau de contaminação. Um conjunto classificado como `HIGH`
ou `MEDIUM` (o FLORES+ é `HIGH`), ou não classificado de forma alguma, é **apenas relativo**:
utilizável para comparar métodos executados nele, nunca relatado como qualidade absoluta.
Apenas um conjunto classificado como `LOW` classifica por qualidade absoluta. Um conjunto de dados em quarentena
nunca entra na classificação: o banco de dados recusa uma pontuação enviada contra ele.
Os conjuntos de dados registrados e suas faixas de licença estão listados em
[Conjuntos de dados de avaliação](/docs/network/leaderboard/datasets).

**Benchmarks selados** são conjuntos de testes retidos que o anfitrião mantém em sua própria
máquina. Os participantes nunca os veem. Uma submissão é um modelo ou método que o
próprio nó de pontuação do anfitrião executa contra o conjunto selado; apenas as pontuações saem, e
toda execução selada precisa da autorização do anfitrião. As chaves dos conjuntos estão hoje
com os organizadores. Guardiões comunitários de chaves — nenhum nomeado ainda;
o Champollion não possui frações de chave. Prêmios existem apenas em concursos selados, nos
termos que o anfitrião declara antes de qualquer pessoa participar. Como hospedar um:
[Realizar um concurso soberano](/docs/network/sovereignty/run-a-sovereign-contest).

## Escopo

- **Texto escrito.** A tabela mede a tradução de texto escrito: documentos,
  materiais educativos e oficiais, strings de interface. Ela não mede fala,
  interpretação em tempo real ou chat aberto.
- **Idiomas baseados em texto.** A tradução automática de línguas de sinais é um problema
  diferente; entradas de línguas de sinais no índice dizem "ainda não atendido"
  ([O que conta como um idioma](/docs/network/context/what-counts-as-a-language)).
- **Um conjunto de dados por vez.** Uma pontuação só é comparável com pontuações na
  mesma versão do conjunto de dados. As classificações nunca cruzam conjuntos de dados ou idiomas.
- **Métodos, não sentenças.** Uma pontuação descreve um método em um benchmark. Nenhuma
  confiança por sentença é publicada para qualquer tradução
  ([Limites técnicos](/docs/network/honest-limitations#system-vs-output)).

## O que uma execução publicada traz

Cada novo cartão é pontuado sob o **scoring standard/1**
([Especificação de Pontuação](/docs/network/specifications/scoring)):

- **A métrica principal:** chrF++ no nível do corpus (0–100) com seu intervalo de
  confiança bootstrap de 95% e sua assinatura do sacreBLEU, para que qualquer pessoa possa recalculá-lo.
- **Ao lado:** BLEU, spBLEU e TER, além de COMET quando tiver sido calculado. Eles são
  exibidos, nunca misturados à métrica principal.
- **À parte:** diagnósticos como aceitação por FST e correspondência exata, onde suas
  ferramentas existirem. Eles nunca entram na métrica principal nem classificam uma execução.
- **Campos descontinuados:** `composite`, `quality_tier` e `cost_adjusted` são
  `null` em todo novo cartão. Um cartão antigo mantém seu composto armazenado, exibido como
  "composto legado (descontinuado)". Nenhuma pontuação automática traz um rótulo de qualidade.
- **Proveniência:** o ID do conjunto de dados e seu SHA-256, o slug exato do modelo, a
  condição, o que foi dito ao modelo (o SHA-256 do prompt e o texto dele,
  a menos que você o oculte), o custo, a versão da estrutura de avaliação e uma impressão digital
  da configuração. Execuções idênticas são deduplicadas na publicação, e uma replicação
  independente conta como evidência.
- **Nível de confiança:** cada linha chega como *autoavaliada*. *Champollion Verified*
  significa que a pontuação foi recalculada a partir das saídas enviadas por você em relação às
  referências fixadas; esse repontuador é um comando de mantenedor executado manualmente, portanto
  hoje nenhuma linha é promovida ao chegar. *Community Validated* é concedido apenas
  pela própria avaliação de uma comunidade ([níveis de verificação](/docs/network/leaderboard/rules#verification-tiers)).

O esquema completo é a [Especificação do Cartão de Execução](/docs/network/specifications/run-card).

## Publicação

```bash
# See exactly what would be uploaded (no sign-in, no network)
mt-eval publish eval/logs/harness/<run-id>_report.json --dry-run

# Publish to the live board (a browser sign-in the first time)
mt-eval publish eval/logs/harness/<run-id>_report.json --prod
```

- `--prod` (ou `MT_EVAL_ALLOW_PROD=1`) é obrigatório para gravação na tabela
  ativa; sem ele, a estrutura de avaliação se recusa a gravar.
- `--anonymous` publica sem fazer login; a tabela exibe "anonymous".
- `--scores-only` publica pontuações agregadas e o hash e tamanho do conjunto de dados,
  nunca o texto fonte ou de referência — para o seu próprio corpus ou um privado.
- `--redact-coaching` substitui o texto do prompt por um marcador e mantém seu
  hash. O prompt guiado de um corpus somente local é ocultado por padrão.

O guia passo a passo está em [Enviar um método](/docs/network/getting-started/submit-a-method).

## As regras que valem em todo lugar

- **Nunca treine em dados de avaliação.** Um método exposto a um conjunto de benchmark — como
  dados de treinamento, exemplos few-shot, entradas de dicionário ou material de prompt — é
  desqualificado ([Regras de envio](/docs/network/leaderboard/rules)).
- **O melhor é decidido por um teste, não por dois números.** Se uma execução supera
  outra é determinado por um teste pareado de significância no chrF++; vizinhos que o teste não consegue
  separar compartilham a mesma classificação ([Significância](/docs/network/specifications/significance)).
- **Corpora não são hospedados aqui.** O registro são metadados; os corpora são
  buscados na sua fonte. Uma execução publicada de um conjunto sob licença aberta pode
  trazer seu texto por sentença (acima).
- **As faixas de licença são estruturais.** Corpora não comerciais são mantidos fora de
  qualquer premiação, API e via comercial. Um corpus sob uma licença modificada, sob medida ou
  não especificada (`LicenseRef-*`) recusa avaliação remota por API de modelo até
  que o consentimento do detentor dos direitos seja registrado no seu cartão; licenças não comerciais
  padrão vão para modelos remotos apenas por canais sem treinamento; segmentos selados
  nunca vão para ambientes remotos. Os conjuntos do Plains Cree de EdTeKLA são catalogados como
  rótulos em quarentena, e o banco de dados recusa qualquer pontuação enviada contra eles.

## O que está em execução hoje

- A tabela está no ar, pública e aberta para envios. Seus conteúdos são dados
  em tempo real, portanto esta página não os descreve — [consulte a tabela](/leaderboard).
- Cada linha é autoavaliada hoje (consulte os níveis de confiança acima).
- Nenhum prêmio está aberto, e nenhuma pontuação atingiu o patamar de um prêmio
  ([Especificação de Prêmios](/docs/network/specifications/prizes)).
- Nenhuma validação por falantes da comunidade foi realizada
  ([Validação por falantes](/docs/network/specifications/speaker-validation)).
- Nenhum método foi repassado a uma comunidade sob os termos de um concurso.

[Limites técnicos](/docs/network/honest-limitations) é a lista completa do que
não é reivindicado; onde esta página e aquela divergirem, aquela prevalece.

## Veja também

- [Regras de envio](/docs/network/leaderboard/rules) — o que é aceito,
  desqualificação, verificação e reputação.
- [Conjuntos de dados de avaliação](/docs/network/leaderboard/datasets) — o registro e
  suas faixas de licença.
- [Enviar um método](/docs/network/getting-started/submit-a-method) e as
  [Perguntas frequentes](/docs/network/getting-started/faq).
- [Pontuação](/docs/network/specifications/scoring),
  [Significância](/docs/network/specifications/significance) e o
  [Cartão de execução](/docs/network/specifications/run-card).
- [Contribuir com computação](/docs/network/getting-started/contributing-compute) —
  execute itens da fila pública com sua própria chave.
