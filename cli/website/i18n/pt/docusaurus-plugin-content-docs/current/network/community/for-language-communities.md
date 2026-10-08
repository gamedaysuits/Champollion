---
sidebar_position: 1
title: "Para Comunidades de Linguagem"
---

# Para Comunidades Linguísticas

> **Resumo Executivo.** Sua comunidade pode ter seu próprio conjunto de testes — o "gabarito" pelo qual todo método de tradução é avaliado — e realizar sua própria competição em seus próprios termos, sem nunca entregar os dados. Esta página explica o que a Rede solicita das comunidades linguísticas (traduções de referência, revisão de tradução, dados de orientação), o que você recebe em troca (trabalho remunerado a taxas publicadas assim que o trabalho for financiado — hoje não há fundos retidos —, além da propriedade do código e controle total de implantação) e as proteções de soberania que vêm em primeiro lugar. Nenhum conhecimento em programação é necessário. Algumas proteções já estão integradas ao software e ao banco de dados; outras ainda são compromissos, e [Limitações Honestas](/docs/network/honest-limitations) detalha quais são.

Você não precisa ser programador para contribuir para a Rede. Se você fala uma língua indígena ou de baixos recursos, você é a pessoa mais importante neste ecossistema.

---

## A Soberania Vem em Primeiro Lugar

Antes de pedirmos qualquer coisa a você, a regra fundamental: **os dados do seu idioma são seus.** Dados linguísticos são *biodados* — eles carregam a identidade e as relações da sua comunidade e não podem ser anonimizados de forma significativa — portanto, as pessoas que os fornecem detêm as chaves para eles e para tudo o que for avaliado em relação a eles. A Rede é construída sobre [princípios de soberania de dados indígenas](/docs/network/sovereignty/data-sovereignty):

- Nunca coletamos ou armazenamos seus dados linguísticos em nossos servidores
- Métodos de tradução usam a arquitetura `api` — todos os dados de treinamento, dicionários e regras gramaticais permanecem em infraestrutura que você controla
- Você decide quem pode desenvolver métodos para sua língua
- Pontuações no leaderboard provam que um método funciona; elas não concedem permissão para implantá-lo

:::note[Onde isso está hoje]
O modelo de transferência de propriedade descrito abaixo é um **design comprometido, ainda não um programa em funcionamento.** O leaderboard está aberto para submissões e atualmente não tem execuções publicadas, e nenhum método foi transferido para uma comunidade ainda. Descrevemos como foi construído para funcionar para que você possa nos cobrar por isso — não para sugerir que já está em movimento. O relacionamento, e sua autoridade sobre seus dados, vêm em primeiro lugar; o resto segue daí.
:::

---

## Possua Seu Conjunto de Testes

A posição mais forte que uma comunidade pode ocupar neste sistema é **possuir o
próprio benchmark**. Um conjunto de testes é a chave de resposta: quem o possui decide
o que "boa tradução" significa para a língua, e todo método — o nosso,
de uma corporação, de qualquer um — é medido contra *seu* padrão.

- **Registro é metadados, não conteúdo.** Registrar um corpus com a
  Rede significa publicar um cartão descritivo — nunca fazer upload do corpus.
  Você escolhe sua [faixa de exposição](/docs/network/sovereignty/registering-corpora):
  aberta, restrita ou totalmente soberana.
- **Benchmarks soberanos permanecem secretos.** Na faixa soberana, o conjunto de testes
  nunca sai da infraestrutura comunitária e nós nunca o vemos. Métodos são
  pontuados contra ele do seu lado; apenas a pontuação viaja.
- **Você pode executar seu próprio concurso.** O guia passo a passo —
  [Executar um Concurso Soberano](/docs/network/sovereignty/run-a-sovereign-contest)
  — orienta você através da hospedagem de uma avaliação controlada pela comunidade em seus próprios
  termos: seu conjunto de testes, suas regras, sua decisão sobre o que (se algo)
  é publicado.

As garantias por trás de tudo isso estão documentadas, não implícitas:
[Gestão de Dados](/docs/network/sovereignty/data-sovereignty) (o posicionamento
de soberania de dados/CARE e o que ele nos proíbe de fazer) e
[Propriedade e Termos](/docs/network/sovereignty/ownership-transfer) (o que
acontece, contratualmente, quando um método vence).

---

## O Que Precisamos De Você

### Traduções de referência

Precisamos de pares de tradução curados para avaliação — inglês de um lado, sua língua do outro. Estes se tornam a "chave de resposta" contra a qual todos os métodos de tradução são pontuados.

Você pode criar estes a partir de:
- **Materiais educacionais** — exercícios de livros didáticos, planos de aula, planilhas
- **Documentos comunitários** — atas de reuniões, boletins informativos, anúncios
- **Frases do dia a dia** — strings de UI, rótulos de aplicativos, expressões comuns
- **Conteúdo cultural** — histórias, canções ou descrições (com permissões apropriadas)

O formato é JSON simples:
```json
{
  "entries": [
    { "id": 1, "source": "Hello", "reference": "tânisi" },
    { "id": 2, "source": "Thank you", "reference": "kinanâskomitin" }
  ]
}
```

### Revisão de tradução

Todo método que afirma produzir traduções funcionais precisa de validação humana. Falantes bilíngues revisam os resultados e nos dizem se o computador acertou — e mais importante, *por que* errou.

### Dados de treinamento

Regras gramaticais, entradas de dicionário, padrões morfológicos — estes são os recursos linguísticos que fazem os métodos de tradução funcionarem. Seu conhecimento de como sua língua funciona é insubstituível por qualquer modelo de IA.

---

## O Que Você Recebe em Troca

### Propriedade

Quando um método de tradução é construído para sua língua e validado na Rede, a [propriedade é transferida](/docs/network/sovereignty/ownership-transfer) para a organização de governança da sua comunidade. Você possui o código, os pesos do modelo e a implantação.

### Trabalho remunerado, não extração

A criação de corpus e a revisão de tradução são trabalhos profissionais, a serem remunerados conforme as
[taxas publicadas](/docs/network/perspectives/how-speakers-get-paid) assim que houver financiamento
(hoje não há fundos retidos) — e o pagamento não compra os seus dados. Você é pago pelo trabalho *e* continua sendo o
proprietário do que constrói. O Champollion é um projeto de pesquisa não comercial: ele
não vende nada, não tarifa nada e [não fica com nenhuma fatia](/docs/network/sovereignty/economic-model)
de tudo o que sua comunidade vier a ganhar com um método de sua propriedade.

### Controle

Sua organização de governança controla:
- Quem pode acessar o método
- Se pode ser usado comercialmente — e se sim, em seus termos, mantendo tudo que ganha
- Quando e como é atualizado
- Quais dados são usados para desenvolvimento adicional

---

## Como Se Envolver

:::tip[Algo que os falantes podem fazer hoje — se a comunidade concordar]
O Champollion não cria nem hospeda corpora — os dados de teste são sempre buscados
diretamente de sua fonte. Se os falantes da sua comunidade quiserem contribuir com frases
*agora mesmo*, o [Tatoeba](https://tatoeba.org) aceita contribuições frase por frase
em qualquer idioma, e coleções abertas como o
[OPUS](https://opus.nlpl.eu/) agregam textos paralelos a partir dos quais a Rede cria
benchmarks. Frases adicionadas lá podem se tornar dados de avaliação aqui.

Esteja ciente das concessões antes de começar: o Tatoeba publica frases sob uma licença aberta
(CC BY 2.0 FR por padrão), de modo que qualquer pessoa pode copiá-las — inclusive para treinar modelos
de IA — e cópias já feitas não podem ser revogadas. Essa pode ser a escolha certa
para frases do dia a dia. Para qualquer coisa que a sua comunidade queira manter
sob seu próprio controle, mantenham os dados com vocês e usem um
[conjunto de testes selado](/docs/network/sovereignty/run-a-sovereign-contest) em vez disso.
Um aplicativo de contribuição direta para falantes e um gerador de corpus estão planejados, mas ainda
não foram desenvolvidos.
:::

1. **Entre em contato** — Abra uma issue no [repositório da Rede](https://github.com/gamedaysuits/Champollion) ou envie um e-mail para [info@champollion.dev](mailto:info@champollion.dev)
2. **Descreva seu idioma** — A qual família linguística ele pertence? Quantos falantes existem? Quais sistemas de escrita são utilizados? Quais recursos computacionais existem (FSTs, dicionários, corpora)?
3. **Comece pequeno** — Apenas 50 pares de tradução selecionados já são suficientes para criar um conjunto de dados de avaliação e abrir uma nova categoria no leaderboard. O trabalho com corpus é [pago a taxas publicadas](/docs/network/perspectives/how-speakers-get-paid) assim que for financiado; hoje não há fundos retidos
4. **Mantenha-o seu** — Registre o corpus como metadados na trilha que escolher ([Registro de Corpora](/docs/network/sovereignty/registering-corpora)); se quiser que o conjunto de testes seja totalmente secreto, o [guia de execução para competições soberanas](/docs/network/sovereignty/run-a-sovereign-contest) é o caminho
5. **Conecte-nos à governança** — Quem em sua comunidade possui autoridade sobre dados e tecnologia linguística? O modelo de soberania da Rede exige um parceiro de governança

---

## Veja Também

- [Realizar uma Competição Soberana](/docs/network/sovereignty/run-a-sovereign-contest) — o guia de execução para uma avaliação controlada pela comunidade
- [Modelos de Termos](/docs/network/sovereignty/terms-templates) — termos juridicamente simples, orientados à mínima necessidade de confiança (trustless), que sua comunidade pode adaptar, com os riscos de "cavalo de Troia" detalhados
- [Gestão de Dados](/docs/network/sovereignty/data-sovereignty) — o posicionamento e os frameworks (CARE, Te Mana Raraunga e outros instrumentos de soberania de dados indígenas) que o moldaram
- [Propriedade e Termos](/docs/network/sovereignty/ownership-transfer) — termos específicos por idioma e o que acontece quando um método vence
- [Como o Trabalho É Financiado](/docs/network/sovereignty/economic-model) — para onde o dinheiro se move em um projeto não comercial
- [Apoiar um Idioma de Baixos Recursos](/docs/network/community/low-resource-languages) — contexto técnico para pesquisadores que trabalham junto a comunidades
