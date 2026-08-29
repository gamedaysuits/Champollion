---
sidebar_position: 1
title: "Para Comunidades de Linguagem"
---

# Para Comunidades Linguísticas

> **Resumo Executivo.** Sua comunidade pode possuir seu próprio conjunto de testes — a "chave de resposta" contra a qual todo método de tradução é medido — e executar seu próprio concurso em seus próprios termos, sem nunca entregar os dados. Esta página explica o que a Rede pede das comunidades linguísticas (traduções de referência, revisão de tradução, dados de treinamento), o que você recebe em troca (trabalho remunerado com taxas publicadas, propriedade do código, controle total de implantação) e as garantias de soberania que vêm em primeiro lugar. Nenhuma programação é necessária, e nada aqui exige confiar em nós: as garantias são estruturais, não promessas.

Você não precisa ser programador para contribuir para a Rede. Se você fala uma língua indígena ou de baixos recursos, você é a pessoa mais importante neste ecossistema.

---

## A Soberania Vem em Primeiro Lugar

Antes de pedirmos qualquer coisa de você, a regra fundamental: **seus dados linguísticos são seus.** Dados linguísticos são *biodados* — carregam a identidade e os relacionamentos da sua comunidade e não podem ser significativamente anonimizados — então as pessoas que os fornecem detêm as chaves para eles e para qualquer coisa medida contra eles. A Rede é construída sobre [princípios indígenas de soberania de dados](/docs/network/sovereignty/data-sovereignty):

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

As garantias por trás de tudo isso estão escritas, não implícitas:
[Administração de Dados](/docs/network/sovereignty/data-sovereignty) (a posição de soberania de dados/CARE
e o que nos proíbe de fazer) e
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

Construção de corpus e revisão de tradução são trabalho profissional, remunerado com
[taxas publicadas](/docs/network/perspectives/how-speakers-get-paid) — e
pagamento não compra seus dados. Você é pago pelo trabalho *e* permanece o
proprietário do que você constrói. Champollion é um projeto de pesquisa não comercial: não
vende nada, não mede nada, e [não toma nenhuma parte](/docs/network/sovereignty/economic-model)
de qualquer coisa que sua comunidade ganhe com um método que possui.

### Controle

Sua organização de governança controla:
- Quem pode acessar o método
- Se pode ser usado comercialmente — e se sim, em seus termos, mantendo tudo que ganha
- Quando e como é atualizado
- Quais dados são usados para desenvolvimento adicional

---

## Como Se Envolver

:::tip[Algo que falantes podem fazer hoje]
Champollion não constrói ou hospeda corpora — dados de teste são sempre obtidos
de sua fonte. Se falantes em sua comunidade querem contribuir com frases
*agora mesmo*, [Tatoeba](https://tatoeba.org) aceita contribuições
frase por frase em qualquer idioma, e coleções abertas como
[OPUS](https://opus.nlpl.eu/) agregam texto paralelo que a Network constrói
benchmarks a partir de. Frases adicionadas lá podem se tornar dados de avaliação aqui na
próxima construção de corpus. Um app de contribuição direta de falantes e um construtor de corpus
são o próximo passo planejado em nosso roadmap.
:::

1. **Entre em contato** — Abra uma issue no [repositório da Rede](https://github.com/gamedaysuits/Champollion) ou envie um email para [info@champollion.dev](mailto:info@champollion.dev)
2. **Descreva sua língua** — A qual família pertence? Quantos falantes? Quais sistemas de escrita são usados? Quais recursos computacionais existem (FSTs, dicionários, corpora)?
3. **Comece pequeno** — Até 50 pares de tradução curados são suficientes para criar um conjunto de dados de avaliação e abrir uma nova faixa no leaderboard. Trabalho com corpus é [remunerado com taxas publicadas](/docs/network/perspectives/how-speakers-get-paid)
4. **Mantenha como seu** — Registre o corpus como metadados na faixa que você escolher ([Registrando Corpora](/docs/network/sovereignty/registering-corpora)); se você quer que o conjunto de testes seja totalmente secreto, o [guia de concurso soberano](/docs/network/sovereignty/run-a-sovereign-contest) é o caminho
5. **Conecte-nos à governança** — Quem em sua comunidade tem autoridade sobre dados e tecnologia linguística? O modelo de soberania da Rede requer um parceiro de governança

---

## Veja Também

- [Executar um Concurso Soberano](/docs/network/sovereignty/run-a-sovereign-contest) — o guia para uma avaliação controlada pela comunidade
- [Modelos de Termos](/docs/network/sovereignty/terms-templates) — termos legalmente simples, tendendo para sem confiança, que sua comunidade pode adaptar, com os riscos de cavalo de Troia explicados
- [Administração de Dados](/docs/network/sovereignty/data-sovereignty) — a posição e os frameworks (CARE, Te Mana Raraunga e outros instrumentos indígenas de soberania de dados) que a moldaram
- [Propriedade e Termos](/docs/network/sovereignty/ownership-transfer) — termos por língua e o que acontece quando um método vence
- [Como o Trabalho É Financiado](/docs/network/sovereignty/economic-model) — para onde o dinheiro se move em um projeto não comercial
- [Apoiar uma Língua de Baixos Recursos](/docs/network/community/low-resource-languages) — contexto técnico para pesquisadores trabalhando ao lado de comunidades
