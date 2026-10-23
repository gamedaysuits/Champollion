---
sidebar_position: 1
title: "Tradução Não É Revitalização"
slug: '/network/perspectives/translation-is-not-revitalization'
description: "O que tradução automática pode e não pode fazer por línguas em perigo — dito claramente. TA é infraestrutura para comunidades linguísticas. Nunca substitui pessoas falando com pessoas."
related:
  - label: "Working with speakers"
    to: /docs/working-with-speakers
    kind: position
  - label: "From Benchmark to Daily Use"
    to: /docs/put-it-to-work
    kind: position
    note: "The post-editing path from draft to published text"
  - label: "Data Sovereignty"
    to: /docs/your-words-your-rules
    kind: doc
    note: "Who decides what happens to language data, and consent before deployment"
---

# Tradução Não É Revitalização

> **Posição.** Tradução automática converte texto entre idiomas. Revitalização cria novos falantes. Estas são atividades diferentes com critérios de sucesso diferentes, e nenhuma pontuação em um ranking muda isso. Construímos TA como infraestrutura que serve aos objetivos de uma comunidade — nunca como substituto para transmissão intergeracional. Crianças aprendem idioma com pessoas, não com máquinas.

Em 2026 é fácil acreditar que software pode consertar qualquer coisa, incluindo um idioma que está perdendo falantes. Queremos ser precisos sobre por que essa crença está errada — e sobre o que a tecnologia de tradução *pode* honestamente contribuir.

Este texto existe porque uma crítica a este projeto, escrita sob a perspectiva de um linguista, apresentou um argumento contundente: um sistema perfeito de tradução inglês→cree não resolveria o problema da transmissão (crianças não aprendendo a língua em casa), o problema do prestígio (o inglês como língua de poder econômico) ou o problema pedagógico (falta de escolas de imersão e de professores capacitados). Poderia até piorar as coisas, ao criar a ilusão de que "o computador sabe falar cree" e atenuar a urgência da transmissão humana. Aceitamos a maior parte dessa crítica e publicamos nossa resposta aqui em vez de enterrá-la.

---

## O que a revitalização realmente exige

A literatura de pesquisa sobre revitalização de idiomas é consistente em um ponto: idiomas sobrevivem quando são transmitidos entre gerações — quando pais, avós e comunidades os falam para crianças, e as crianças crescem falando-os de volta (Fishman 1991; Hinton & Hale 2001). Tudo mais — escolas, mídia, dicionários, apps — apoia essa transmissão ou não apoia nada.

Nenhum sistema de tradução participa dessa troca. Um modelo que converte um documento em inglês para Cree das Planícies não cria um falante. Não equipa uma sala de aula de imersão, não treina um professor, ou não senta com uma criança à mesa da cozinha. Se nosso trabalho for alguma vez descrito como "salvando idiomas", essa descrição está errada e diremos isso.

## O que TA não pode fazer

Dito claramente, para não haver ambiguidade depois:

- **Ela não pode substituir falantes.** Qualquer saída que nenhum falante fluente tenha revisado é um rascunho, não um texto. Nossas próprias [regras de pontuação](/docs/network/specifications/scoring) tratam toda pontuação automatizada como uma aproximação; apenas a revisão humana confirma a utilidade.
- **Ela não pode ensinar uma primeira língua.** Crianças adquirem uma língua por meio de relacionamentos e imersão, não por meio de documentos traduzidos.
- **Ela pode criar uma ilusão prejudicial.** Uma demonstração que "fala" uma língua pode sugerir que ela está a salvo quando não está. Esse risco de prestígio é real, e nós o tratamos como uma questão em aberto a ser examinada *com* as comunidades, não como um discurso pronto a ser gerenciado.
- **Ela não pode decidir nada.** Se um sistema de tradução deve existir para uma língua e onde ele pode ser usado é uma decisão da comunidade — incluindo a decisão de não implantá-lo de forma alguma. Esse controle é parte integrante da arquitetura de [transferência de propriedade](/docs/network/sovereignty/ownership-transfer) e [soberania de dados](/docs/your-words-your-rules), e abrange diferentes contextos: uma comunidade pode aceitar tradução automática para documentos oficiais e recusá-la para materiais de sala de aula.

## O que TA pode honestamente fazer

Contra esse pano de fundo, há coisas concretas e delimitadas que a infraestrutura de tradução contribui — cada uma servindo pessoas que já estão fazendo o trabalho real.

**1. Produtividade para tradutores sobrecarregados.** Os setores de tradução comunitários lidam com mais documentos que *deveriam* existir na língua do que tradutores humanos conseguem produzir do zero. Um rascunho automático muda o trabalho de "traduzir tudo" para "revisar e corrigir" — e estudos controlados constataram que a pós-edição é significativamente mais rápida do que traduzir do zero, mantendo ou melhorando a qualidade (Plitt & Masselot 2010; Green, Heer & Manning 2013). Descrevemos esse fluxo de trabalho em detalhes em [Coloque em prática](/docs/put-it-to-work). A ressalva: esses estudos abrangeram pares de línguas com muitos recursos; ainda não temos evidências equivalentes para línguas polissintéticas, o que é parte do que este projeto foi estruturado para medir.

**2. Alavancagem prática para direitos linguísticos.** O direito a serviços governamentais em idiomas indígenas existe em lei em várias jurisdições. O que frequentemente falta é a capacidade prática de produzir traduções na velocidade que a burocracia exige. Uma comunidade que consegue transformar um documento de política de cinquenta páginas em uma tradução revisada em dias em vez de meses está em uma posição de negociação mais forte. A tecnologia não cria o direito; torna o direito mais difícil de ignorar.

**3. Infraestrutura linguística reutilizável.** O analisador morfológico (FST) que usamos para verificar que a saída de tradução contém palavras reais — não alucinadas — codifica *por que* cada forma de palavra é válida. A mesma maquinaria é a base para ferramentas de aprendizado: treinadores de conjugação, auxiliares de escrita com correção de erros, exploradores morfológicos. O mecanismo de verificação e o mecanismo pedagógico são o mesmo artefato. Este é um caminho, não uma promessa — as ferramentas de aprendizado exigem construção, e se serão construídas é uma decisão da comunidade.

**4. Suporte para aprendizes de segunda língua.** Revitalização não é apenas crianças adquirindo uma primeira língua. É também adultos aprendendo como segunda língua — pessoas que podem nunca alcançar fluência no nível de Ancião mas que conseguem ler documentos comunitários, participar com compreensão, e elevar a presença pública do idioma usando-o. Para essa população, uma ferramenta de tradução é uma ferramenta genuína, como um dicionário é uma ferramenta.

**5. Uma razão para o trabalho ser financiado e pertencer à própria comunidade.** Em nosso modelo, métodos comprovados são [transferidos integralmente para a propriedade da comunidade](/docs/network/sovereignty/ownership-transfer), e tudo o que uma comunidade ganha com um ativo que possui é inteiramente seu ([Quem pode usar e quanto custa](/docs/getting-started/who-may-use-this)). Os falantes são [remunerados por sua experiência](/docs/working-with-speakers), em vez de solicitados como voluntários. Nada disso é revitalização propriamente dita — mas direciona recursos para as pessoas que estão fazendo a revitalização, em vez de afastá-los delas.

## O enquadramento honesto

O campo tem um longo histórico de projetos de tecnologia que chegam com narrativas de resgate e saem com publicações (Bird 2020). Tentamos manter uma reivindicação mais estreita: **TA é infraestrutura.** Infraestrutura serve objetivos definidos por outras pessoas. Estradas não decidem para onde você viaja; esta tecnologia não decide se um idioma vive. Falantes, famílias e comunidades decidem — e o enquadramento da [Década Internacional das Línguas Indígenas da UNESCO](https://idil2022-2032.org/) está certo em colocar povos indígenas, não ferramentas, no centro.

Se uma comunidade conclui que a tecnologia de tradução ajuda seus objetivos, queremos que seja a versão melhor, mais responsável possível — possuída por eles, validada por seus falantes, implantada em seus termos. Se uma comunidade conclui que não ajuda, essa conclusão é um resultado válido deste projeto, não uma falha dele. Ambas as metades dessa frase são compromissos.

---

## O que isso significa para você

:::info[Se você faz parte de uma comunidade]
Este projeto não dirá a você que um aplicativo pode salvar sua língua — ele não pode. O que ele oferece tem limites claros: tradução de documentos mais rápida sob a revisão de falantes fluentes, infraestrutura que sua comunidade pode deter por completo e remuneração pela experiência dos falantes. Se e como tudo isso será usado é uma decisão da sua comunidade, incluindo a decisão de não usar nada disso. Consulte [Suas palavras, suas regras](/docs/your-words-your-rules) e [Relatar erros e deter correções](/docs/network/perspectives/reporting-errors-and-owning-corrections).
:::

:::info[Se você é pesquisador]
Trate a "tradução automática para línguas ameaçadas" como uma proposta de infraestrutura, não de revitalização, e a sua pergunta de avaliação mudará: não será "a pontuação BLEU é alta?", mas sim "isso reduz de forma mensurável a carga de trabalho das pessoas que realizam o trabalho real, nos termos delas?". A [especificação de benchmark](/docs/network/specifications/benchmark) e a seção [Painel de classificação e publicação](/docs/reference/leaderboard) são onde nos comprometemos com esse padrão.
:::

:::info[Se você desenvolve soluções]
Desenvolva para o fluxo de pós-edição, não para a demonstração. A pessoa que usará seu método é um falante fluente corrigindo um rascunho, e o pior cenário de falha são palavras alucinadas que parecem plausíveis para quem não fala a língua — e é por isso que a validação morfológica controla tudo por aqui. Comece com [Enviar um método](/docs/network/getting-started/submit-a-method) e [Coloque em prática](/docs/put-it-to-work).
:::

---

## Fontes

- Fishman, J. A. (1991). *Reversing Language Shift: Theoretical and Empirical Foundations of Assistance to Threatened Languages.* Multilingual Matters.
- Hinton, L., & Hale, K. (eds.) (2001). *The Green Book of Language Revitalization in Practice.* Academic Press.
- Plitt, M., & Masselot, F. (2010). "A Productivity Test of Statistical Machine Translation Post-Editing in a Typical Localisation Context." *The Prague Bulletin of Mathematical Linguistics*, 93, 7–16. [PDF](https://ufal.mff.cuni.cz/pbml/93/art-plitt-masselot.pdf)
- Green, S., Heer, J., & Manning, C. D. (2013). "The Efficacy of Human Post-Editing for Language Translation." *Proceedings of CHI 2013.* [Paper](https://idl.uw.edu/papers/post-editing)
- Bird, S. (2020). "Decolonising Speech and Language Technology." *Proceedings of COLING 2020*, 3504–3519. [Paper](https://aclanthology.org/2020.coling-main.42/)
- UNESCO. *International Decade of Indigenous Languages 2022–2032.* [idil2022-2032.org](https://idil2022-2032.org/)

## Veja também

- [Trabalhando com falantes](/docs/working-with-speakers) — o modelo de remuneração, em números
- [Coloque em prática](/docs/put-it-to-work) — o caminho da pós-edição
- [Painel de classificação e publicação](/docs/reference/leaderboard) — a arquitetura completa da plataforma, incluindo o §8 sobre tensões que ainda não resolvemos
