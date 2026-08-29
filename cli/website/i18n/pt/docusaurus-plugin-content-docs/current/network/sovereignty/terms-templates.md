---
sidebar_position: 10
title: "Modelos de Termos"
slug: /network/sovereignty/terms-templates
description: "Ideias de termos adaptáveis e orientadas à confiança zero para uma comunidade que executa um concurso soberano — propriedade, licenciamento apenas de pontuações, integridade fixada por hash, padrões fail-closed e um tour honesto dos riscos de cavalo de Troia."
related:
  - label: "Run a Sovereign Contest"
    to: /docs/network/sovereignty/run-a-sovereign-contest
    kind: doc
    note: "The runbook these terms attach to"
  - label: "Ownership & Terms"
    to: /docs/network/sovereignty/ownership-transfer
    kind: doc
  - label: "Data Stewardship"
    to: /docs/network/sovereignty/data-sovereignty
    kind: doc
  - label: "Prize Specification"
    to: /docs/network/specifications/prizes
    kind: spec
---

# Modelos de Termos

> **Resumo Executivo.** Termos iniciais que uma comunidade ou organização pode
> adaptar ao executar um [concurso soberano](/docs/network/sovereignty/run-a-sovereign-contest).
> O viés de design em todo o documento é **inclinado para a desconfiança**: sempre que possível, um
> termo é apoiado por um mecanismo (um hash, um gate, um log append-only) em vez de
> uma promessa. Cada termo é um parágrafo curto mais uma explicação em linguagem clara.

:::warning[Isto não é aconselhamento jurídico]
Estas são *ideias* de rascunho de um projeto de pesquisa não comercial, não constituem aconselhamento jurídico, e não somos advogados. As leis variam por jurisdição, e frameworks de governança de dados indígenas (por exemplo, os princípios de soberania de dados das Primeiras Nações) impõem obrigações que nenhum modelo pode descarregar. Tenha seu próprio conselho jurídico — e seu próprio processo de governança comunitária — revisar qualquer coisa antes de você confiar nela.
:::

---

## Termos principais

### 1. O corpus é e permanece propriedade do proprietário

*Termo.* O corpus de avaliação, todas as entradas nele, e todos os metadados
derivados permanecem propriedade exclusiva da comunidade/organização registradora. Nenhum uso do
registro, concurso ou maquinário de avaliação da Rede transfere qualquer
direito, título ou interesse no corpus para a plataforma, para desenvolvedores de métodos,
ou para qualquer patrocinador. A plataforma não mantém cópia alguma e não reivindica licença além do
digest do blob criptografado.

*Linguagem clara:* executar um concurso contra seu corpus não dá a ninguém uma parte
dele. Champollion mantém um hash, não uma reivindicação.

### 2. A avaliação concede uma licença apenas de scores — nada mais

*Termo.* Uma execução de avaliação autorizada concede à plataforma e ao
desenvolvedor do método uma licença para receber e publicar **apenas scores numéricos e
estatísticas agregadas**. Ela não concede **nenhum** direito de reter conteúdo do corpus após a
execução, **nenhum** direito de treinar, ajustar ou orientar qualquer modelo com ele, e **nenhum**
direito de construir corpora derivados, exemplos memorizados ou tabelas de consulta
a partir dele. Qualquer retenção de conteúdo além da execução encerra a licença e invalida
os resultados da execução.

*Linguagem clara:* o que sai de uma execução selada é um número. Sentenças nunca
saem — não para um leaderboard, não para um conjunto de treinamento, não para o cache de ninguém.

### 3. Integridade fixada por hash: o digest é publicado, o conteúdo nunca é

*Termo.* O corpus é identificado exclusivamente pelo digest SHA-256 publicado do
seu blob criptografado e um rótulo de versão. Apenas blobs que correspondem ao digest contam como
o corpus; qualquer execução contra bytes não correspondentes é nula. A publicação do
digest não é publicação do conteúdo, e nada nestes termos obriga o
proprietário a jamais divulgar o conteúdo para ninguém.

*Linguagem clara:* todos podem verificar *qual* corpus foi usado; ninguém consegue
*ler* ele. Se os bytes não corresponderem ao hash, a execução não conta.

### 4. Padrões fail-closed

*Termo.* Toda ambiguidade se resolve para nenhum acesso e nenhuma publicação. Uma solicitação
que não é afirmativamente autorizada pelo limiar de custódio é negada; uma
concessão que expirou ou foi usada está morta; um resultado cuja proveniência não pode
ser verificada não é publicado; um corpus cuja inscrição expira deixa de ser
executável. O silêncio nunca constitui consentimento.

*Linguagem clara:* em caso de dúvida, a resposta é não. Nada é aberto por padrão.

### 5. Autorização de custódio controla cada execução

*Termo.* Nenhuma avaliação pode ser executada contra o corpus selado sem uma
autorização registrada e aprovada por limiar, e uma concessão de uso único, limitada no tempo, vinculada ao
método específico, versão do corpus e ambiente de avaliação. Todos os
eventos de autorização, incluindo negações e tentativas bloqueadas, são registrados em um
log de auditoria append-only, publicamente reproduzível.

*Linguagem clara:* seus custódios aprovam cada execução, uma execução por vez,
e todo o histórico é público e à prova de adulteração. (A ferramenta de assinatura de limiar criptográfico
ainda está em desenvolvimento — veja a
[caixa de status no runbook](/docs/network/sovereignty/run-a-sovereign-contest) —
então hoje este termo é aplicado como processo registrado, não ainda como matemática.)

### 6. Fundos de prêmios são mantidos pelo patrocinador e a regra de prêmio é pública

*Termo.* Fundos de prêmios são mantidos pela organização patrocinadora nomeada ou por um
fundo comunitário designado — nunca pela plataforma. O limiar de prêmio é publicado
antes do concurso abrir, é verificável a partir de scores publicados mais o
veredicto de validação de falante da comunidade, e a decisão de prêmio pertence
exclusivamente ao detentor dos fundos.

*Linguagem clara:* o dinheiro fica com quem o colocou, a barra é pública, e
se a barra foi ultrapassada é verificável por qualquer um. Champollion não pode pagar,
reter ou redirecionar um prêmio porque Champollion nunca tem o dinheiro.

---

## Riscos de cavalo de Troia {#trojan-horse-risks}

Um documento de termos honesto nomeia as formas pelas quais o arranjo pode ser atacado. Coloque
estas no seu — um patrocinador ou comunidade que as leu é mais difícil de enganar.

### Submissões de métodos maliciosos que tentam exfiltrar os dados de teste

Um "método" é código submetido. Um hostil pode tentar contrabandear sentenças de teste
— codificando-as em suas saídas, escrevendo-as em logs, ou fazendo chamadas para fora.
**Mitigações:** emissão apenas de scores (texto de saída por entrada de execuções seladas
nunca é publicado — aplicado na camada de dados hoje); uma **sandbox sem egresso**
para execução selada (🔲 em desenvolvimento — até que seja lançada, trate esta
mitigação como parcial e pondere as aprovações de seus custódios de acordo); e
**orçamentos de query/execução por método por rodada** — um método recebe um número
pequeno e fixo de execuções seladas, então o corpus não pode ser reconstruído por
sondagem repetida mesmo através do canal de scores.

### Corpora submetidos envenenados ou contaminados

O ataque também pode funcionar da outra forma: alguém oferece a uma comunidade um
corpus de teste "pronto para usar" que é sutilmente errado, ofensivo, ou já é público
(então métodos o memorizaram e scores são sem sentido).
**Mitigações:** requisitos de proveniência em cada entrada (quem a autorizou,
quando, de qual fonte); [validação de falante](/docs/network/specifications/speaker-validation)
do próprio corpus antes de selar; e triagem de contaminação contra dados
públicos antes de um corpus ser aceito como qualificador ou padrão ouro.

### Trojans de licença em dependências

Um método vencedor que silenciosamente agrupa conteúdo ou código cuja licença proíbe
o uso pretendido pela comunidade (implantação comercial, redistribuição) envenena a
transferência — você ganha uma ferramenta que não pode usar legalmente.
**Mitigações:** declarações de classe de dependência e um gate de licença mecânico em
submissões (veja a tabela de classe de dependência na [Especificação de Prêmios](/docs/network/specifications/prizes));
dependências não declaradas são desqualificantes.

### Phishing de credenciais

Qualquer um executando um concurso se torna alvo para ataques "cole seu token aqui para
verificar seu registro". **Mitigações:** nunca cole tokens,
chaves ou credenciais em páginas de terceiros ou compartilhe-as em chat; toda
autenticação neste projeto acontece através do fluxo OAuth da CLI, e
**não existem mais fluxos de token de acesso pessoal em navegador** — qualquer página pedindo
um é hostil. Decisões de custódio devem acontecer em canais que sua
comunidade já confia.

### Inadimplência do lado do patrocinador

O modo de falha silenciosa: métodos ultrapassam a barra e o patrocinador não paga.
**Mitigações:** publique a identidade do detentor dos fundos e o arranjo de
retenção (conta org, fundo, agente de depósito) *antes* do concurso abrir;
torne as condições de prêmio verificáveis a partir de scores publicados para que uma inadimplência seja
publicamente visível como uma inadimplência, não negável como uma chamada de julgamento; e prefira um
detentor com algo a perder reputacionalmente. Champollion não pode subscrever
este risco — por design nunca mantém os fundos — então a credibilidade de um prêmio é
exatamente a credibilidade de seu detentor nomeado.

---

## Usando estes

Copie o que se encaixa, delete o que não se encaixa, adicione o que sua governança requer, e
publique o resultado ao lado de seu concurso para que os participantes concordem com *seus*
termos, não com uma vibe. Termos por comunidade — incluindo transferência de propriedade de método
para prêmios patrocinados — são a norma aqui, não a exceção: veja
[Propriedade & Termos](/docs/network/sovereignty/ownership-transfer).
