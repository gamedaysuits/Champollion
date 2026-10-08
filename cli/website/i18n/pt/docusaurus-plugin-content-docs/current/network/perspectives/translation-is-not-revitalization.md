---
sidebar_position: 1
title: "Tradução Não É Revitalização"
slug: '/network/perspectives/translation-is-not-revitalization'
description: "O que tradução automática pode e não pode fazer por línguas em perigo — dito claramente. TA é infraestrutura para comunidades linguísticas. Nunca substitui pessoas falando com pessoas."
related:
  - label: "How Speakers Get Paid"
    to: /docs/network/perspectives/how-speakers-get-paid
    kind: position
  - label: "From Benchmark to Daily Use"
    to: /docs/network/perspectives/from-benchmark-to-daily-use
    kind: position
    note: "The post-editing path from draft to published text"
  - label: "Data Sovereignty"
    to: /docs/network/sovereignty/data-sovereignty
    kind: doc
    note: "Data-sovereignty principles, CARE, and consent before deployment"
  - label: "For Language Communities"
    to: /docs/network/community/for-language-communities
    kind: doc
---

# Tradução Não É Revitalização

> **Posição.** Tradução automática converte texto entre idiomas. Revitalização cria novos falantes. Estas são atividades diferentes com critérios de sucesso diferentes, e nenhuma pontuação em um ranking muda isso. Construímos TA como infraestrutura que serve aos objetivos de uma comunidade — nunca como substituto para transmissão intergeracional. Crianças aprendem idioma com pessoas, não com máquinas.

Em 2026 é fácil acreditar que software pode consertar qualquer coisa, incluindo um idioma que está perdendo falantes. Queremos ser precisos sobre por que essa crença está errada — e sobre o que a tecnologia de tradução *pode* honestamente contribuir.

Este texto existe porque um linguista que convidamos para criticar este projeto argumentou com força: um sistema de tradução perfeito de inglês→Cree não resolveria o problema de transmissão (crianças não aprendendo o idioma em casa), o problema de prestígio (inglês como idioma do poder econômico), ou o problema pedagógico (não há escolas de imersão suficientes e professores treinados). Poderia até piorar as coisas, criando a ilusão de que "o computador consegue falar Cree" e suavizando a urgência da transmissão humana. Aceitamos a maior parte dessa crítica, e publicamos nossa resposta aqui em vez de ocultá-la.

---

## O que a revitalização realmente exige

A literatura de pesquisa sobre revitalização de idiomas é consistente em um ponto: idiomas sobrevivem quando são transmitidos entre gerações — quando pais, avós e comunidades os falam para crianças, e as crianças crescem falando-os de volta (Fishman 1991; Hinton & Hale 2001). Tudo mais — escolas, mídia, dicionários, apps — apoia essa transmissão ou não apoia nada.

Nenhum sistema de tradução participa dessa troca. Um modelo que converte um documento em inglês para Cree das Planícies não cria um falante. Não equipa uma sala de aula de imersão, não treina um professor, ou não senta com uma criança à mesa da cozinha. Se nosso trabalho for alguma vez descrito como "salvando idiomas", essa descrição está errada e diremos isso.

## O que TA não pode fazer

Dito claramente, para não haver ambiguidade depois:

- **Não pode substituir falantes.** Resultado que nenhum falante fluente revisou é um rascunho, não um texto. Nossas próprias [regras de pontuação](/docs/network/specifications/scoring) tratam cada pontuação automatizada como um proxy; apenas revisão humana confirma usabilidade.
- **Não pode ensinar um idioma de primeira língua.** Crianças adquirem idioma através de relacionamento e imersão, não através de documentos traduzidos.
- **Pode criar uma ilusão prejudicial.** Uma demonstração que "fala" um idioma pode sugerir que o idioma está seguro quando não está. Este risco de prestígio é real, e o tratamos como uma questão aberta a ser examinada *com* comunidades, não como um ponto de discussão a ser gerenciado.
- **Não pode decidir nada.** Se um sistema de tradução deve existir para um idioma, e onde pode ser usado, é a decisão da comunidade — incluindo a decisão de não implantá-lo. Esse controle está integrado na arquitetura de [transferência de propriedade](/docs/network/sovereignty/ownership-transfer) e [soberania de dados](/docs/network/sovereignty/data-sovereignty), e inclui contextos: uma comunidade pode aceitar TA para documentos oficiais e recusá-lo para materiais de sala de aula.

## O que TA pode honestamente fazer

Contra esse pano de fundo, há coisas concretas e delimitadas que a infraestrutura de tradução contribui — cada uma servindo pessoas que já estão fazendo o trabalho real.

**1. Throughput para tradutores sobrecarregados.** Escritórios de tradução comunitária enfrentam mais documentos que *deveriam* existir no idioma do que tradutores humanos conseguem produzir do zero. Um rascunho de máquina muda o trabalho de "traduzir tudo" para "revisar e corrigir" — e estudos controlados encontraram pós-edição significativamente mais rápida do que traduzir do zero, com qualidade mantida ou melhorada (Plitt & Masselot 2010; Green, Heer & Manning 2013). Descrevemos esse fluxo de trabalho em detalhes em [Do Benchmark ao Uso Diário](/docs/network/perspectives/from-benchmark-to-daily-use). A ressalva: esses estudos cobriram pares de idiomas de alto recurso; ainda não temos evidência equivalente para idiomas polissintéticos, que é parte do que este projeto está configurado para medir.

**2. Alavancagem prática para direitos linguísticos.** O direito a serviços governamentais em idiomas indígenas existe em lei em várias jurisdições. O que frequentemente falta é a capacidade prática de produzir traduções na velocidade que a burocracia exige. Uma comunidade que consegue transformar um documento de política de cinquenta páginas em uma tradução revisada em dias em vez de meses está em uma posição de negociação mais forte. A tecnologia não cria o direito; torna o direito mais difícil de ignorar.

**3. Infraestrutura linguística reutilizável.** O analisador morfológico (FST) que usamos para verificar que a saída de tradução contém palavras reais — não alucinadas — codifica *por que* cada forma de palavra é válida. A mesma maquinaria é a base para ferramentas de aprendizado: treinadores de conjugação, auxiliares de escrita com correção de erros, exploradores morfológicos. O mecanismo de verificação e o mecanismo pedagógico são o mesmo artefato. Este é um caminho, não uma promessa — as ferramentas de aprendizado exigem construção, e se serão construídas é uma decisão da comunidade.

**4. Suporte para aprendizes de segunda língua.** Revitalização não é apenas crianças adquirindo uma primeira língua. É também adultos aprendendo como segunda língua — pessoas que podem nunca alcançar fluência no nível de Ancião mas que conseguem ler documentos comunitários, participar com compreensão, e elevar a presença pública do idioma usando-o. Para essa população, uma ferramenta de tradução é uma ferramenta genuína, como um dicionário é uma ferramenta.

**5. Uma razão para o trabalho ser financiado e possuído em casa.** Em nosso modelo, métodos comprovados [transferem para propriedade comunitária](/docs/network/sovereignty/ownership-transfer) completamente, e qualquer coisa que uma comunidade ganhe de um ativo que possui é inteiramente sua ([como o trabalho é financiado](/docs/network/sovereignty/economic-model)). Falantes são [pagos por sua expertise](/docs/network/perspectives/how-speakers-get-paid), não solicitados a voluntariar. Nada disso é revitalização também — mas direciona recursos para as pessoas fazendo revitalização, em vez de longe delas.

## O enquadramento honesto

O campo tem um longo histórico de projetos de tecnologia que chegam com narrativas de resgate e saem com publicações (Bird 2020). Tentamos manter uma reivindicação mais estreita: **TA é infraestrutura.** Infraestrutura serve objetivos definidos por outras pessoas. Estradas não decidem para onde você viaja; esta tecnologia não decide se um idioma vive. Falantes, famílias e comunidades decidem — e o enquadramento da [Década Internacional das Línguas Indígenas da UNESCO](https://idil2022-2032.org/) está certo em colocar povos indígenas, não ferramentas, no centro.

Se uma comunidade conclui que a tecnologia de tradução ajuda seus objetivos, queremos que seja a versão melhor, mais responsável possível — possuída por eles, validada por seus falantes, implantada em seus termos. Se uma comunidade conclui que não ajuda, essa conclusão é um resultado válido deste projeto, não uma falha dele. Ambas as metades dessa frase são compromissos.

---

## O que isso significa para você

:::info[Se você é um membro da comunidade]
Este projeto não vai dizer que um app pode salvar sua língua — não pode. O que oferece é limitado: tradução de documentos mais rápida sob revisão de falantes fluentes, infraestrutura que sua comunidade pode possuir completamente, e compensação pela expertise dos falantes. Se e como qualquer coisa disso é usada é decisão da sua comunidade, incluindo a decisão de não usar. Veja [Para Comunidades de Línguas](/docs/network/community/for-language-communities) e [Reportando Erros e Possuindo Correções](/docs/network/perspectives/reporting-errors-and-owning-corrections).
:::

:::info[Se você é um pesquisador]
Trate "MT para línguas em perigo" como uma afirmação de infraestrutura, não de revitalização, e sua pergunta de avaliação muda: não "o score BLEU é alto?" mas "isso reduz mensuravelmente a carga de trabalho das pessoas fazendo o trabalho real, nos termos delas?" A [especificação de benchmark](/docs/network/specifications/benchmark) e [Como Funciona §8 (Tensões e Limitações)](/docs/network/how-it-works#8-tensions-and-limitations) são onde nos mantemos a esse padrão.
:::

:::info[Se você é um desenvolvedor]
Construa para o fluxo de pós-edição, não para a demo. O usuário do seu método é um falante fluente corrigindo um rascunho, e o pior modo de falha é palavras alucinadas que parecem plausíveis para não-falantes — é por isso que validação morfológica controla tudo aqui. Comece com [Enviar um Método](/docs/network/getting-started/submit-a-method) e [Do Benchmark ao Uso Diário](/docs/network/perspectives/from-benchmark-to-daily-use).
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

- [Como Falantes Recebem Pagamento](/docs/network/perspectives/how-speakers-get-paid) — o modelo de compensação, em números
- [Do Benchmark ao Uso Diário](/docs/network/perspectives/from-benchmark-to-daily-use) — o caminho de pós-edição
- [Como Funciona](/docs/network/how-it-works) — a arquitetura completa da plataforma, incluindo §8 sobre tensões que não resolvemos
