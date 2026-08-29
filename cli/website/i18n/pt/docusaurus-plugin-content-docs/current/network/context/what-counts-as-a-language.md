---
sidebar_position: 2
title: "O que Conta como um Idioma Aqui?"
---

# O Que Conta Como Uma Língua Aqui?

> **Resumo Executivo.** A Rede cataloga línguas por ISO 639-3, faz benchmarks de línguas individuais (não de guarda-chuvas macrolínguas), inclui línguas de sinais como as línguas naturais que são, inclui línguas construídas reconhecidas pela ISO, exclui linguagens de programação e exibe disputas taxonômicas sem tomar partido. Esta página explica cada escolha e o que significa para o leaderboard.

Qualquer projeto que faz benchmark de tradução em milhares de línguas precisa responder uma pergunta antiga e surpreendentemente difícil: o que conta como uma língua? Linguistas sabem há muito tempo que a fronteira entre "língua" e "dialeto" é tanto social e política quanto estrutural — a famosa frase de que *"uma língua é um dialeto com exército e marinha"* foi popularizada pelo linguista ídiche Max Weinreich em 1945 (ele creditou a um membro da audiência em uma de suas palestras). Não podemos fugir da pergunta, então aqui estão nossas respostas e nosso raciocínio.

---

## Línguas de sinais são línguas. Ponto final.

Línguas de sinais são línguas naturais — com gramáticas completas, aquisição nativa por crianças e comunidades de falantes vivos. Isso foi estabelecido na linguística desde a demonstração de William Stokoe em 1960 de que a Língua de Sinais Americana tem o mesmo tipo de estrutura interna que as línguas faladas, e sessenta anos de pesquisa desde então (Klima & Bellugi 1979; Sandler & Lillo-Martin 2006) só aprofundaram o ponto. ISO 639-3 atribui códigos de língua individuais a línguas de sinais; Glottolog as cataloga junto com famílias faladas. Nosso catálogo inclui mais de 160 delas, marcadas com `modality: signed`.

Algumas são línguas indígenas ameaçadas: a Língua de Sinais das Planícies Indígenas (`psd`), historicamente uma importante língua franca intertribal na América do Norte, está criticamente ameaçada hoje (Davis 2010, *Hand Talk*). O risco de extinção de línguas de sinais *é* risco de extinção de línguas indígenas, e está dentro da missão deste projeto.

**Uma nota de escopo honesta.** A Rede atualmente faz benchmark de tradução automática *baseada em texto*. MT de língua de sinais — trabalhando com vídeo, gramática espacial e línguas que não têm forma escrita amplamente adotada — é um problema técnico diferente e em grande parte não resolvido (veja Yin et al. 2021, "Including Signed Languages in Natural Language Processing," ACL). Ainda não o servimos. Entradas de língua de sinais em nosso catálogo dizem exatamente isso: **ainda não servido — nunca "não é uma língua."**

## Existem duas modalidades. Escrita não é uma delas.

Línguas vêm em duas modalidades primárias: **falada** e **sinalizada**. Escrita não é uma terceira modalidade — é uma tecnologia sobreposta a uma língua, e a maioria das línguas do mundo se vira bem sem uma padronizada. É por isso que nossas fichas de língua rastreiam a escrita separadamente (quais scripts uma língua usa, ou se não tem ortografia padronizada) e a rastreiam honestamente: para uma plataforma de MT baseada em texto, se uma língua é escrita é informação crítica, não uma nota de rodapé — e uma língua não escrita não é uma língua menor.

## Línguas construídas: sim. Linguagens de programação: não.

Seguimos a própria linha da ISO 639-3. O padrão admite uma língua construída apenas se for uma língua completa, projetada para comunicação humana, com uma literatura e uma comunidade que a passou para uma segunda geração de usuários — e explicitamente exclui linguagens de programação de computador. Esperanto, com seus falantes nativos, se qualifica; Python não, porque ninguém adquire Python como primeira língua de seus pais. Nosso catálogo inclui as duas dúzias de línguas construídas que a ISO reconhece, tipadas como tal, e nenhuma linguagem de programação.

## Fazemos benchmark de línguas individuais, não de guarda-chuvas

ISO 639-3 distingue *línguas individuais* de *macrolínguas* — códigos guarda-chuva como `cre` (Cree), `ara` (Árabe), ou `zho` (Chinês) que cobrem várias línguas individuais estreitamente relacionadas. A unidade de benchmark da Rede é a **língua individual**, por uma razão operacional: recursos de tradução são específicos de variedade. Um analisador morfológico construído para Cree das Planícies (`crk`) não gera Cree Moose (`crm`); um corpus de árabe egípcio diz pouco sobre a qualidade de um método em árabe marroquino. Uma pontuação anexada a um código de macrolíngua seria uma afirmação sobre variedades que nunca foram realmente avaliadas — então não fazemos isso.

Macrolínguas ainda aparecem no catálogo como **páginas hub**: navegação que vincula uma identidade guarda-chuva a seus membros individuais, refletindo a própria observação da ISO de que ambos os níveis de identidade são reais. Abaixo da língua individual, exibimos informações de dialeto e linhagem da árvore languoid do Glottolog (Hammarström & Forkel 2022), que modela famílias, línguas e dialetos como uma hierarquia navegável.

**E quanto aos corpora que chegam rotulados com um código abrangente?** Muitos dados do mundo real chegam assim — conjuntos de dados publicados como "Quéchua", "Persa" ou "Chinês (Simplificado)". Tratamos o rótulo de origem como *metadados a serem resolvidos*, não como uma verdade a ser obedecida ou descartada. Casos mecânicos são resolvidos automaticamente a partir das tabelas oficiais da ISO: uma tag de script é removida (`cmn-Hans` é Chinês Mandarim, escrito em Han Simplificado — o script é registrado, a identidade do idioma é `cmn`), e um código descontinuado segue seu sucessor oficial. Quando o editor documenta qual é realmente a variedade de seus dados — o FLORES+ codifica seu registro Quéchua como `quy`, Quéchua de Ayacucho —, registramos essa resolução *com a citação* na entrada de registro do corpus, e o corpus é avaliado em benchmark sob o idioma individual real. E quando ninguém sabe dizer qual variedade uma coleção contém (algumas coleções de frases da comunidade mantêm uma categoria "Árabe" deliberadamente genérica), nós não tentamos adivinhar: o corpus permanece catalogado sob seu próprio rótulo, é excluído da fila de trabalho com um motivo legível por máquina que você pode ver nos metadados da fila, e quaisquer pontuações históricas nele permanecem anexadas a um nó abrangente rotulado honestamente — nunca creditadas silenciosamente a uma variedade que nunca foi avaliada. Toda resolução pode ser re-derivada: as tabelas ISO fixadas, os carimbos de resolução por corpus e as citações são todos fornecidos no registro público.

## Quando as autoridades discordam, mostramos ambas

ISO 639-3 e Glottolog ocasionalmente dividem ou agrupam diferentemente, e comunidades às vezes discordam de ambas. Não arbitramos. Fichas de língua carregam uma affordance de *notas de taxonomia* que exibe o desacordo com fontes, e a nomenclatura segue a comunidade onde a comunidade expressou uma preferência. Se uma variedade é "uma língua" é, no final, parcialmente uma questão de identidade — e questões de identidade pertencem às próprias comunidades, um princípio que adotamos de marcos indígenas de governança de dados.

## Uma direção de pesquisa: benchmarks como instrumento de medição

Uma coisa que uma arena como esta produz, quase como um subproduto, é um novo tipo de evidência sobre o quão próximas as variedades de língua realmente são *operacionalmente*. Se um único método de tradução, mantido fixo, serve várias variedades relacionadas com qualidade implantável, essas variedades se agrupam na prática; se exigem corpora separados e métodos separados, são operacionalmente distintas — seja qual for a política de nomenclatura. Isso se assemelha a tradições empíricas mais antigas, de testes de inteligibilidade de texto gravado a medidas de distância lexical automatizadas, com uma reviravolta fundamentada em implantação.

Oferecemos isso com cuidado, como uma direção de pesquisa em vez de uma afirmação. Resultados de transferência de método são confundidos por tamanho de corpus, domínio, ortografia e contaminação de dados de treinamento, e um agrupamento é sempre relativo a um método e um limiar de qualidade. Acima de tudo: este sinal pode *informar* conversas sobre língua e dialeto, mas nunca substitui como uma comunidade identifica sua própria língua.

---

## Referências

- Davis, Jeffrey E. (2010). *Hand Talk: Sign Language among American Indian Nations.* Cambridge University Press.
- Dryer, Matthew S. & Martin Haspelmath, eds. (2013). *The World Atlas of Language Structures Online.* https://wals.info
- Hammarström, Harald & Robert Forkel (2022). "Glottocodes: Identifiers Linking Families, Languages and Dialects to Comprehensive Reference Information." *Semantic Web* 13(6).
- Haugen, Einar (1966). "Dialect, Language, Nation." *American Anthropologist* 68(4).
- ISO 639-3 Registration Authority. "Scope of denotation" and "Types of individual languages." https://iso639-3.sil.org/about/scope · https://iso639-3.sil.org/about/types
- Klima, Edward S. & Ursula Bellugi (1979). *The Signs of Language.* Harvard University Press.
- Sandler, Wendy & Diane Lillo-Martin (2006). *Sign Language and Linguistic Universals.* Cambridge University Press.
- Stokoe, William C. (1960). *Sign Language Structure.* Studies in Linguistics, Occasional Papers 8.
- Weinreich, Max (1945). "Der YIVO un di problemen fun undzer tsayt." *YIVO Bleter* 25(1).
- Yin, Kayo, Amit Moryossef, Julie Hochgesang, Yoav Goldberg & Malihe Alikhani (2021). "Including Signed Languages in Natural Language Processing." *Proc. ACL-IJCNLP 2021.* https://aclanthology.org/2021.acl-long.570/


## Aonde isso leva neste site

As regras de contagem aqui regem todos os números neste site: a
[metodologia de cobertura](/docs/network/context/coverage-counting) as aplica
aos serviços de MT, e os
[cartões de idioma](/docs/reference/language-card-spec) registram, por idioma,
o que cada fonte realmente afirma.
