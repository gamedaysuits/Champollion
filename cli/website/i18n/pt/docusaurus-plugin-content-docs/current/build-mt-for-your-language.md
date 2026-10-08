---
slug: /build-mt-for-your-language
title: "Construa MT para o seu idioma"
description: "De “por onde começar?” a um fluxo de trabalho de tradução testado: descubra o que já existe, proteja seu conjunto de testes, avalie as opções, construa algo melhor, comprove sua eficácia e faça a implantação — com os comandos exatos e chamadas de ferramentas MCP para cada etapa."
---

# Crie tradução automática para o seu idioma

Esta página leva você de *"queremos tradução para o nosso idioma — como começamos?"*
até um fluxo de trabalho de tradução que você **mediu em suas próprias
frases** e colocou para funcionar. Ela foi escrita para pessoas e para agentes de IA:
cada etapa fornece o comando para executar e, onde houver, a
[ferramenta MCP](/docs/network/getting-started/mcp-server) que um agente chama em vez disso.

Dois exemplos contínuos:

- **Uma escola** deseja Inglês → Plains Cree para seu boletim informativo e um pequeno aplicativo.
  Os professores revisaram algumas centenas de frases e querem mantê-las privadas.
- **Um hospital** deseja Inglês → um idioma que o índice quase não cobre, para um
  guia de frases de beira de leito. Suas frases de teste contêm termos clínicos e nunca
  devem ser enviadas a um serviço de IA externo.

Você terminará com: um conjunto de testes privado, pontuações de vários métodos nele, um
método melhor (um modelo instruído ou um que você mesmo treinou), e esse método implantado
por meio da CLI — com cada número rastreável ao que o produziu.

:::info[O que isso não faz]
Nada aqui torna uma tradução correta. As pontuações dizem qual opção está
*menos errada nas suas frases*; um falante fluente ainda decide o que está apto para
ser usado. Leia [Limitações Honestas](/docs/network/honest-limitations) antes de
confiar em qualquer número.
:::

:::warning[Agentes: antes de abrir qualquer um dos arquivos do usuário]
Se um conjunto de testes puder ser privado (revisado por professores, revisado por enfermeiros, qualquer coisa que
uma comunidade não tenha publicado), não o leia — sem `cat`, `head` ou pré-visualização,
nem mesmo para ver seu formato. O que você lê vai para o seu provedor de modelo. Pergunte
ao usuário e marque-o como somente local primeiro ([etapa 2](#2-gather-your-data--and-protect-your-test-set)).
:::

## 0. Instalação

```bash
npm install -g champollion        # translate + deploy        (Node 20.11+)
python3 -m pip install mt-eval-harness       # measure                   (Python 3.11+)
python3 -m pip install 'nmt-forge[hf]'       # train a model (optional; a CPU is enough to start)
```

Para um agente, adicione o servidor MCP à configuração dele:

```json
{
  "mcpServers": {
    "champollion": { "command": "npx", "args": ["-y", "champollion-mcp-server"] }
  }
}
```

## 1. Descubra o que já existe

O que já se sabe sobre o idioma — dicionários, gramáticas, corpora,
analisadores (FSTs), modelos, resultados publicados, serviços — e de onde
vem cada fato.

```bash
champollion network card crk                 # the cited language card
champollion network recommend eng crk        # methods you can run, with the evidence for each
mt-eval corpora --source eng --target crk   # registered test sets for the pair
nmt-forge discover crk               # what a training project can use
```

**Agente:** `search_languages { "query": "Atya" }` encontra o código mesmo a partir de um
erro de digitação (nomes mais próximos por distância de edição). Cada resultado mostra onde o
idioma é falado apenas quando seu cartão cita uma fonte para isso, e exibe essa
fonte, para que o usuário possa escolher entre idiomas com nomes semelhantes. Uma localização
sem fonte nunca é exibida: a linha informa isso e, em vez disso, fornece o link para o registro do idioma no
Glottolog, onde os candidatos podem ser comparados na fonte.
A partir de uma instalação via npm, um idioma fora do conjunto principal empacotado é preenchido a partir
das tabelas de cartões publicadas do champollion.dev, que ainda não contêm fontes por campo
(elas chegarão com o próximo upload das tabelas); portanto, sua linha traz o link do Glottolog
em vez de uma localização. Quando nada do que for exibido diferenciar os candidatos,
os falantes decidem (abaixo). Então, `language_overview { "code": "<code>" }` fornece uma
página: o que existe, quais benchmarks e resultados há, e os próximos
passos numerados. Qualquer ferramenta que aceite um idioma também o aceita como `language`.

Leia o cartão da forma como ele foi escrito: **ausência significa desconhecido, não zero.** Um
cartão que não lista nenhum dicionário significa que o índice não registrou nenhum — não que
nenhum exista. Onde as fontes discordam (a contagem de falantes frequentemente diverge), o cartão mostra
todas elas.

Se o seu idioma não tiver nenhum cartão, você ainda poderá fazer tudo o que está abaixo; as
ferramentas apenas saberão menos sobre ele (`nmt-forge init <code> --no-card --name <name>`
inicia um projeto de treinamento de qualquer maneira).

### Quando a variedade ainda não está confirmada

Um nome pode se aplicar a vários idiomas. "Ayta", por exemplo, corresponde a seis idiomas
Ayta das Filipinas, cada um com seu próprio código. **Pergunte aos falantes
primeiro.** A comunidade sabe qual variedade fala, e um código escolhido por
eles é uma afirmação sobre eles.

Se você precisar começar antes que eles possam responder, use um código de uso privado: a ISO 639
reserva `qaa` a `qtz` exatamente para isso. Dê a ele um nome de exibição, para que prompts e
relatórios nomeiem o idioma:

```bash
champollion init --yes --langs qaa --name qaa="Ayta (variety not yet confirmed)"
```

o que grava, em `champollion.config.json`:

```json
"languages": { "qaa": { "name": "Ayta (variety not yet confirmed)" } }
```

`init` informa que o código é de uso privado, sem cartão de idioma (ele não
pede para você verificar a ortografia).

`init`, `sync`, `verify` e `network register-corpus` aceitam um
código de uso privado. O que isso custa a você, até que o código real o substitua:

- **Sem fatos do cartão.** Sem predefinições de registro, regras de plural ou sistema de escrita de um
  cartão de idioma. A sincronização usa configurações genéricas, portanto, verifique os primeiros resultados com um
  falante.
- **Sem FST.** Nenhum analisador morfológico está vinculado a um código de uso privado, portanto,
  nada é verificado palavra por palavra.
- **Sem resultados anteriores.** Os benchmarks publicados e a fila são indexados por códigos
  reais, portanto, `recommend` e `corpora` não têm nada para mostrar sobre isso.

Quando a comunidade confirmar a variedade, mude para o código dela:

1. Em `champollion.config.json`, substitua `qaa` pelo código (e remova o
   `name` se o nome do cartão for adequado).
2. Renomeie os arquivos de localidade (`messages/qaa.json` → `messages/ayt.json`). As
   traduções continuam válidas: o próximo `champollion sync` as mantém e
   traduz apenas o que for novo.
3. Registre o conjunto de testes novamente sob o par real:
   `champollion network register-corpus --pair "eng>ayt" --data <file> --role test …`.
   O comando exibe o `--id` a ser passado, porque um arquivo registrado mantém seu
   id, a menos que você escolha um novo. (`--pair` aceita `eng-ayt` ou `"eng>ayt"`
   aqui e em `nmt-forge init`; coloque entre aspas a forma `>`, pois uma shell interpreta um
   `>` isolado como "gravar em um arquivo".)

## 2. Reúna seus dados — e proteja seu conjunto de testes

**Separe o conjunto de testes primeiro.** Reserve as frases pelas quais você julgará
tudo (aquelas revisadas por professores, por enfermeiros) antes de
treinar ou ajustar qualquer coisa, e nunca treine nelas.

Um conjunto de testes é um arquivo TSV: um par de frases por linha, origem, um TAB, e depois a
tradução de referência. Linhas que começam com `# ` são comentários.

```text
# teacher-checked, 2026 term 1
The library opens at nine.	<the teacher's translation>
```

Em seguida, decida até onde ele pode trafegar:

| Você deseja… | Faça isto |
|---|---|
| Nada sai desta máquina — nenhum serviço de IA externo pode ver essas frases | Coloque um arquivo marcador ao lado dele (abaixo). Apenas um modelo na sua própria máquina poderá ser testado com ele. |
| Outros podem ver que o conjunto de testes existe, mas nunca seu conteúdo | `champollion network register-corpus --tier private --role test …` registra apenas metadados |
| Uma competição nele, executada em uma máquina controlada por você, possivelmente isolada da rede (air-gapped) | `--tier sealed` mais o [nó soberano](/docs/network/sovereignty/sovereign-eval-node) |
| Ele é público e sob licença aberta | `--tier public` aponta para onde ele reside; ainda assim, nós nunca o hospedamos |

O marcador para "nunca sai desta máquina":

```bash
echo '{"transmission": "local-only"}' > data/nurse_checked_test.tsv.champollion.json
```

Com ele posicionado, `mt-eval run` recusa qualquer provedor remoto para esse arquivo
e é executado apenas contra um modelo em loopback. Detalhes:
[Registrando Corpora](/docs/network/sovereignty/registering-corpora).

**Qual id de licença.** O registro solicita `--license`: os termos que os
proprietários dos dados realmente concedem, nunca um valor temporário. Pergunte a eles e, em seguida, escolha o id que
expressa isso: um id SPDX se eles já publicarem o texto sob um;
`community-eval-grant-nc` para "apenas para pontuar sistemas, nunca treinar, nunca
compartilhar, sem pontuação paga"; `community-eval-grant` para o mesmo com pontuação
paga permitida; `proprietary` para todos os direitos reservados; ou
`LicenseRef-<name>` para termos próprios deles. Os últimos quatro são ids
`LicenseRef-…`, concessões sob medida: a avaliação remota com eles é recusada até que o
responsável registre a permissão. Até que o responsável
confirme, registre sua escolha como provisória. Somente local permanece local qualquer que seja
a licença: o marcador, não a licença, decide para onde as frases vão.
[Qual id de licença para um conjunto de testes privado](/docs/network/sovereignty/registering-corpora#which-licence-id-for-a-private-test-set).

**Agentes: não leiam um arquivo de teste somente local.** Nada de `cat`, `head` ou abri-lo
para dar uma olhada. O que você lê vai para o seu provedor de modelo, que é o
lugar para onde o marcador diz que essas frases não devem ir. Você não precisa fazer isso: as
ferramentas mantêm suas frases fora do que exibem (`mt-eval compare` mostra ids de
entradas e pontuações em vez disso), e `--show-text` existe apenas para uma pessoa no
terminal.

**Agente:** `language_overview { "code": "<code>" }` lista as opções de proteção para o idioma;
`run_benchmark` respeita o marcador e retorna uma recusa (com o motivo)
em vez de enviar frases protegidas para fora.

### Se você planeja treinar um modelo depois: registre, filtre, faça previsões — antes de qualquer pontuação

Faça estas três coisas agora, nesta ordem, antes que a etapa 3 meça qualquer coisa no
conjunto de testes. O Forge conta cada consulta a um conjunto de testes, e um benchmark (etapa 3)
é uma leitura de pontuação: um pré-registro feito após uma leitura é recusado. A ordem
importa; fazer isso mais tarde não é a mesma coisa.

1. **Registre o conjunto de testes com o NMT Forge.** Seu registro de leitura começa aqui, para que
   cada leitura posterior seja contada (uma leitura de pontuação antes do registro é listada,
   mas não contada).
2. **Filtre seu corpus de treinamento contra ele** (`leak-audit`). Isso lê o
   conjunto de testes para uma auditoria, nunca para pontuação, portanto, não conta contra as suas
   previsões. Leia o veredito: se a maioria das linhas de teste tiver uma correspondência quase idêntica em seu
   corpus, um modelo treinado com todos os dados pontuará a memorização de frases de treinamento,
   não a tradução. Você então geralmente treinará dois modelos: um com todos os
   dados e outro livre de duplicatas (`--drop-test-twins` grava seu corpus e sua
   configuração, `config-notwins.json`).
3. **Anote o que você espera, um pré-registro por modelo que você planeja
   treinar**, nomeado com o nome do modelo. Essas previsões são o parâmetro contra o qual as
   pontuações de teste serão julgadas depois: a exportação compara cada modelo com
   aquele que você indicar com `--prereg <id>` (com dois no mesmo conjunto de testes, ela se recusa
   a adivinhar). Em vez disso, você pode fixar uma previsão na configuração do modelo com
   `--config-hash <hash>`, o hash completo que
   `nmt-forge preflight run --config config-notwins.json` imprime. Qualquer
   edição posterior dessa configuração (um limite de tempo, por exemplo) altera o hash e remove a
   fixação, portanto, nomear o pré-registro na exportação é o caminho mais simples.

```bash
nmt-forge init crk --dir school-crk
cd school-crk
nmt-forge registry add project-test ../data/test.tsv --role test
nmt-forge leak-audit ../data/corpus.tsv --clean-to corpus.clean.jsonl
nmt-forge prereg template --out predictions.json      # edit it: what you expect, and why
nmt-forge prereg new all-data --eval-set project-test --predictions predictions.json
cd ..                                                 # step 3 runs from here
```

Se o veredito foi SEVERE, adicione o modelo livre de duplicatas e suas próprias previsões
(em `school-crk/`):

```bash
nmt-forge leak-audit ../data/corpus.tsv --clean-to corpus.notwins.jsonl --drop-test-twins
nmt-forge prereg new notwins --eval-set project-test --predictions predictions-notwins.json  # your edited copy
```

O corpus livre de duplicatas ganha seu próprio arquivo. `corpus.clean.jsonl` continua sendo o
corpus com todos os dados: o leak-audit se recusa a sobrescrever um arquivo que uma configuração, uma
execução ou uma divisão lê, ou que outra auditoria tenha gerado (`--overwrite` substitui
um intencionalmente). Sua resposta em `--json` lista os primeiros números de linha de
cada lista; o arquivo `.audit.json` ao lado do corpus limpo guarda todos eles.

`--allow-after-reads` existe apenas para previsões que foram verdadeiramente anotadas
antes das leituras (no papel, por exemplo). Isso fica registrado, e cada relatório,
export and DEPLOY.md then says the predictions came after the scores.

**Agente:** `forge_init { "code": "<code>", "dir": "<dir>" }`, depois
`forge_register_eval { "name": "project-test", "path": "../data/test.tsv", "role": "test", "project_dir": "<dir>" }`,
`forge_leak_audit { "corpus": "../data/corpus.tsv", "clean_to": "corpus.clean.jsonl", "project_dir": "<dir>" }`
(os caminhos são lidos a partir de `project_dir`, já que os comandos acima são executados a partir
de dentro do projeto; um caminho absoluto funciona em qualquer lugar),
depois `forge_prereg_template` → `forge_prereg { id, eval_set, predictions }`
com o usuário, um por modelo, cada um com o nome do seu modelo (`forge_export`
então aceita esse id como `prereg`; `config_hash` em `forge_prereg` fixa um em
sua configuração, em vez disso). `forge_status` indica esta etapa assim que um
conjunto de testes é registrado. A etapa 4 treina no mesmo projeto.
`language_overview` também lista essas etapas nesta ordem.

## 3. Meça as opções

Execute cada candidato contra o **seu** conjunto de testes (registrado, filtrado e
pré-registrado com o forge primeiro, se você planeja treinar depois —
[etapa 2](#2-gather-your-data--and-protect-your-test-set)). O ambiente de testes avalia cada um
da mesma forma, como a área relata a avaliação de MT: o destaque é o
chrF++ do corpus com seu intervalo de confiança de 95%, com BLEU, spBLEU e TER ao lado
(nunca combinados em um único número). Correspondência exata e verificações comportamentais
(saída com escrita incorreta, sinais de alucinação) são relatados como diagnósticos,
junto com custo e velocidade. Onde o ambiente de testes tem um analisador morfológico
fixado para o idioma, ele adiciona aceitação FST e precisão morfológica como
diagnósticos;
`mt-eval setup --status` lista esses idiomas, e `mt-eval setup --comet`
adiciona COMET onde aplicável.

```bash
# a hosted model (needs OPENROUTER_API_KEY); --max-cost stops before spending more
mt-eval run --corpus data/test.tsv --source-lang English --target-lang "Plains Cree" \
  --target-lang-code crk --provider openrouter --model google/gemini-3.8-flash \
  --max-cost 1 -n gemini-3.8-flash -o results

# a model on your own machine (Ollama, llama.cpp, vLLM — anything OpenAI-compatible)
mt-eval run --corpus data/test.tsv --source-lang English --target-lang "Plains Cree" \
  --target-lang-code crk --provider local --base-url http://127.0.0.1:11434/v1 \
  --model llama3.1 -n local-llama -o results

mt-eval compare results/*_report.json --significance
```

`compare` informa se uma diferença é real ou ruído (randomização
aproximada pareada). Uma diferença dentro dos intervalos de confiança
não constitui uma classificação. O comando gera `comparison-<hash>.json`, nomeado de acordo com as execuções
que compara, ao lado dos relatórios quando compartilham uma pasta, ou em uma pasta
`comparisons/` acima deles quando não compartilham, nunca dentro da pasta da própria execução.
Outra comparação nunca o sobrescreve.

**Pacotes de avaliação.** Alguns idiomas declaram ferramentas extras de que suas métricas precisam
(para Plains Cree, um analisador morfológico). O primeiro `mt-eval run` indica
o que está faltando. Um analisador ausente nunca interrompe a execução: a aceitação FST é
marcada como não computada, `mt-eval setup --lang crk` faz a instalação (uma vez por
máquina), e `mt-eval test <run log>` adiciona a pontuação sem
precisar traduzir novamente.

**Agente:** `run_benchmark { "corpus": "data/test.tsv", "provider": "local",
"base_url": "http://127.0.0.1:11434/v1", "model": "llama3.1",
"target_language": "crk" }` plans first and runs only with `confirm: true`;
`get_run_status { "job_id": "<id>" }` retorna as pontuações. Ele não publica nada,
a menos que você passe `publish: true`. Um código como `target_language` é nomeado a partir do seu
cartão de idioma ("Plains Cree") antes de chegar ao prompt, e o plano mostra
o prompt que o modelo receberá. Um arquivo de instrução substitui esse prompt, e o
plano avisa isso. Quando o cartão lista dois sistemas de escrita e você não passa `script`, o
plano identifica qual escrita as referências usam (contando as letras na sua máquina,
sem exibir nenhuma frase) e solicita essa escrita. Seus relatórios são salvos ao lado do arquivo
de teste, em `data/results/mcp-run-<id>/`, com o cache de tradução do ambiente de testes em
`data/results/cache/`. `get_run_status` exibe o comando `mt-eval compare`
para eles e, para execuções em um id de corpus registrado, lista os relatórios por
caminho. Um plano de `local-model` informa primeiro quanto a confirmação vai baixar e onde.

**Em qual métrica confiar** depende do idioma:
`get_metric_reliability { "language": "<code>" }` (MCP) informa se alguma métrica automática já foi
validada com julgamentos humanos para ele. Para a maioria dos idiomas de baixos recursos
nenhuma foi, portanto chrF++ é a convenção — interprete isso como uma comparação
entre métodos no mesmo conjunto de testes, não como uma nota final.

## 4. Construa algo melhor

Dois caminhos. Meça ambos da mesma forma que na etapa 3.

**Instrua um modelo geral.** Forneça a ele um glossário e orientações, depois execute a etapa 3 novamente
com a instrução:

```bash
mt-eval run --corpus data/test.tsv --source-lang English --target-lang "Plains Cree" \
  --target-lang-code crk --provider openrouter --model google/gemini-3.8-flash \
  --coaching-file coaching.json -n gemini-coached -o results
```

`--coaching-file` aceita Markdown, texto simples ou JSON; o texto completo do arquivo é
o conjunto de instruções do modelo, enviado exatamente como foi escrito.

Para pontuar a terminologia (cada termo listado sai como a sua tradução
exigida?), forneça a cada execução comparada a mesma lista de termos com
`--glossary terms.json` (`{"blood pressure": "…"}`, ou uma lista de formas
aceitas por termo). O glossário é usado apenas para a pontuação; ele nunca é enviado ao
modelo, portanto, uma execução padrão e uma instruída são pontuadas sob os mesmos termos.
Sem `--glossary`, o `dictionary` de um arquivo de instrução JSON
(o formato de [prompting instruído](/docs/network/tutorials/coached-llm-prompting):
`grammar_rules`, `dictionary`, `style_notes`) é usado em seu lugar. Nesse
caso, a execução é pontuada em relação à sua própria instrução, e a saída informa
isso. Um arquivo de instrução em Markdown instrui da mesma maneira, mas não fornece glossário.

Consulte [prompting instruído](/docs/network/tutorials/coached-llm-prompting) e
[prompting aumentado por dicionário](/docs/network/tutorials/dictionary-augmented-llm).

**Treine seu próprio modelo** com o NMT Forge, que previne os erros que fazem com que
resultados em dados pequenos pareçam melhores do que são (vazamento de frases de teste, divisões
inadequadas, escolha de checkpoint no conjunto de testes, interpretação de ruído como progresso):

```bash
cd school-crk     # after step 2: registered, screened, preregistered
nmt-forge split corpus.clean.jsonl --test 0 --dev 100 --seed 42 --out data/split --register project
nmt-forge preflight run --config config.json          # every check run makes, with fixes
nmt-forge run config.json
nmt-forge export .forge/runs/<run>/run-manifest.json --prereg all-data --out export/
```

`preflight run` faz as verificações que `run` faz antes do treinamento — o conjunto de desenvolvimento,
a auditoria de vazamento de cada arquivo de treinamento, o tamanho da decodificação — para que uma execução
aprovada por ele não seja recusada no início. `config.json` lê a divisão a partir de
`data/split/`; uma divisão gravada em outro lugar informa quais linhas alterar.

Os pares de treinamento ficam em um TSV como o conjunto de testes (ou JSONL com `source` e
`target`); `leak-audit` (etapa 2) descartou qualquer um que pudesse vazar o conjunto de testes
para o treinamento e explicou cada caso. Dois modelos? Após a divisão, execute o
leak-audit livre de duplicatas da etapa 2 novamente (com o conjunto de desenvolvimento registrado, suas linhas
saem do arquivo livre de duplicatas também), depois `nmt-forge run config-notwins.json` e
export it to its own folder with `--prereg notwins`. `nmt-forge status` names
o comando seguinte a qualquer momento. O modelo padrão
treina em CPU em poucos minutos; com 1 a 2 mil pares de frases, espere um chrF++
em torno de 5–30 — ele aprende as frases e padrões dos seus dados, não o
idioma em geral. `export` pontua o conjunto de testes uma vez e gera um relatório mt-eval,
permitindo comparar o modelo treinado com tudo da etapa 3. Passo a
passo completo: [Treine Seu Primeiro Modelo](/docs/network/getting-started/train-your-first-model).

**Agente:** `forge_status { "project_dir": "<dir>" }` primeiro e após cada
etapa; após `forge_init`, `forge_register_eval`, `forge_leak_audit`
e `forge_prereg` da etapa 2: `forge_split { corpus, test, seed, out }`,
`forge_preflight { "target": "run" }`, depois — após `nmt-forge run` em um
terminal — `forge_export { run_manifest, out, prereg }`. Chame
`get_training_guardrails` uma vez antes de `forge_split`: ele lista cada regra
que o forge impõe e o erro que a regra previne. O parâmetro `register` de `forge_split`
aceita um prefixo ou `true` (`project`), e `out` tem como padrão
`data/split`. Toda ferramenta do forge após
`forge_init` aceita o `project_dir` que ela retorna. `get_training_guardrails`
(`topic` opcional) explica cada regra. Todos os argumentos de cada ferramenta:
[Servidor MCP](/docs/network/getting-started/mcp-server#arguments).

## 5. Comprove — de forma privada ou aberta

Suas pontuações pertencem a você. Nada é publicado a menos que você decida fazê-lo.

```bash
mt-eval publish results/<run-id>_report.json --dry-run   # shows exactly what would leave, and what is withheld
mt-eval publish results/<run-id>_report.json --scores-only --prod
```

Um conjunto de testes privado ou somente local nunca faz upload de suas frases; `--dry-run`
garante isso linha por linha. Para permitir que outros concorram no seu conjunto de testes sem
nunca vê-lo, faça uma competição em uma máquina sob seu controle: os participantes fornecem o
método deles, ele roda no seu nó e apenas as pontuações saem. Novas competições ocultam todas
as pontuações até que a competição se encerre, para que ninguém possa otimizar contra o seu conjunto de testes.
Consulte [Realizar uma Competição Soberana](/docs/network/sovereignty/run-a-sovereign-contest).
Para inscrever um modelo que você treinou na competição de outra pessoa, a seção `DEPLOY.md` §6
na exportação dele indica os arquivos que compõem a submissão e o comando
`mt-eval contest submit-model` exato.

**Agente:** `list_contests { "language": "<code>" }`, `get_contest { id }`;
`get_results { "target_language": "<code>" }` e `get_run_card { id }` para
o painel público.

## 6. Combine os melhores

**Escolha entre suas próprias medições primeiro.** Tudo o que você pontuou em seu
conjunto de testes é um relatório mt-eval: as linhas de base e execuções instruídas das etapas 3
e 4 e a exportação de cada modelo treinado (`evaluation/runlog_report.json` em seu
export folder). A terminal run with `-o results` writes to
`results/*_report.json`; uma execução iniciada com o MCP `run_benchmark` grava
ao lado do arquivo de teste, em `data/results/mcp-run-<id>/`). Compare todos eles
de uma vez — o primeiro padrão glob para execuções no terminal, o segundo para execuções de agente (use
aquele correspondente às suas execuções; o zsh é interrompido em um glob que não corresponde a nada):

```bash
mt-eval compare results/*_report.json school-crk/export*/evaluation/runlog_report.json --significance
mt-eval compare data/results/mcp-run-*/*_report.json school-crk/export*/evaluation/runlog_report.json --significance
```

Uma diferença dentro dos intervalos de confiança não constitui uma classificação, e um
modelo treinado cujas linhas de teste tenham correspondências quase idênticas nos dados de treinamento pontuou
por memorização: cite o valor livre de duplicatas ao lado dele (DEPLOY.md e
`nmt-forge report` indicam qual), juntamente com qualquer **ressalva de pontuação** que o mt-eval
tenha apontado para esse número. Uma ressalva de *saída quase constante* (uma dentre poucas frases
fornecida para muitas frases de teste diferentes) significa que as saídas não acompanham as
entradas, qualquer que seja a pontuação; o forge a exibe ao lado da pontuação em `export`,
`DEPLOY.md`, `status`, `report`, `compare` e `lint`. Havendo vários modelos exportados,
`nmt-forge status` lista cada um com sua pontuação, pontuação livre de duplicatas e ressalva,
e solicita que você escolha qual implantar. Registre a escolha com
`nmt-forge choose <export>/model` (ou `nmt-forge serve <export>/model
--choose`). Servir um modelo para experimentá-lo é registrado como servido, não como sua
escolha; portanto, `status` continuará perguntando até que você decida.

**Agente:** `forge_status { "project_dir": "<dir>" }` — no
estado `choose-export`, mostre ao usuário `result.advice.exports`, a pontuação de cada exportação
com seu `score_caveats`, e pergunte qual modelo implantar; a resposta do usuário é registrada com `nmt-forge choose` em um
terminal. Servir provisoriamente não responde à pergunta. `forge_compare { eval_set, hyps_a, hyps_b }` compara lado a lado (A/B) dois
modelos do forge com as ressalvas de quase duplicatas de cada um e as ressalvas de pontuação do mt-eval ao lado do vencedor;
o arquivo de hipóteses de cada modelo é o caminho `hypotheses` que `forge_export` retorna
(`<export>/evaluation/battery-hyps.jsonl`).

Em seguida, olhe além de suas próprias execuções. Métodos diferentes vencem para pares diferentes
e tipos diferentes de texto. O [Network](/docs/network/) lista os
métodos e serviços existentes e as evidências de cada um — o que foi
publicado, não o que você mediu:

```bash
champollion network recommend eng crk               # runnable methods + cited evidence for the pair
champollion network leaderboard --pair "eng>crk"     # published results for the pair
```

Um método publicado na tabela de classificação com sua configuração pode ser instalado
exatamente como foi pontuado: `champollion network leaderboard --install <method>
--apply` o adiciona ao seu projeto para aquele par. A CLI configura um método
**por par de idiomas**, de modo que o Cree do
boletim informativo pode usar seu modelo treinado enquanto o francês usa um modelo hospedado. O encadeamento
de métodos (por exemplo, um modelo seguido por um verificador) é abordado em
[modelos encadeados](/docs/network/tutorials/chained-models).

## 7. Use na prática

Implante o método que você mediu — não um diferente.

```bash
nmt-forge serve export/model                     # your trained model on http://127.0.0.1:8378
LOCAL_API_BASE=http://127.0.0.1:8378/v1 champollion sync --method local
```

Enquanto estiver em execução, `nmt-forge status` informa `serving` (ele verifica se o servidor
ainda responde); após a parada do servidor, ele indica novamente o comando `serve`,
na mesma porta.

Ou, para um modelo hospedado com instrução, configure-o no par em
`champollion.config.json`. De qualquer forma:

```bash
champollion init --langs crk     # detects your app's locale files
champollion sync                 # translates only what changed
champollion verify               # placeholders, scripts, key parity
```

**O que o seu próprio modelo ainda não consegue fazer.** Um modelo pequeno treinado com poucas
milhares de frases aprende apenas os padrões delas. Frequentemente ele danifica marcadores de posição
(`{name}`), formas plurais e marcações, ou transforma um rótulo curto como "Home" em
uma frase inteira. O controle de qualidade recusa essas saídas; nada corrompido é
gravado. Forneça ao par um **fallback** (método de contingência), e essas strings serão enviadas a um segundo
método na mesma sincronização:

```json
"pairs": {
  "en:crk": {
    "method": "api",
    "endpoint": "http://127.0.0.1:8378/translate",
    "fallback": { "method": "llm-coached", "model": "google/gemini-3.8-flash" }
  }
}
```

Se nenhum texto puder sair de suas máquinas, configure o fallback como um modelo executado nelas
também: `"fallback": { "method": "local", "model": "<your local model>" }` envia
para um servidor compatível com OpenAI nesta máquina (Ollama, llama.cpp, vLLM), a
um custo de API de $0. Um modelo hospedado geralmente oferece uma segunda opinião mais forte; use-o
quando o texto puder ser enviado ao respectivo provedor.

Seu modelo traduz tudo o que puder. O fallback recebe apenas o que o filtro de qualidade
recusou dele, bem como os blocos Markdown omitidos ou corrompidos, e sua
saída passa pelo mesmo filtro de qualidade. `sync` imprime uma linha `[FALLBACK]` por par com
as contagens, e `champollion verify` lista tudo o que nenhum dos métodos conseguiu
traduzir. Consulte [Método de fallback](/docs/getting-started/configuration#fallback).

Em vez disso, para um caso pontual, traduza apenas essas strings de outra forma:

```bash
champollion sync --method llm-coached --redo keys:nav.home,greeting
```

…ou manualmente, ou por meio de um revisor com `champollion xliff export`. E inclua
as próprias strings do aplicativo no seu conjunto de testes: um modelo com boa pontuação em frases
de professores ainda pode errar em "Onde dói?".

**Sistemas de escrita.** Se o idioma puder ser escrito em mais de um sistema
(Plains Cree: Ortografia Romana Padrão e silábico), a CLI solicita que você
faça uma escolha antes de traduzir. Defina `"script"` para esse idioma na configuração;
a mensagem listará as opções.

A memória de tradução garante que uma frase inalterada nunca seja paga duas vezes,
e a troca de modelos não retraduz tudo. Integre isso ao CI com
o [guia de CI/CD](/docs/guides/ci-cd). `export/model/DEPLOY.md` (da etapa 4) traz
a configuração exata para um modelo treinado, incluindo o método `api` e
como expô-lo em uma rede com segurança.

**Agente:** `translate { texts, source_language, target_language }` processa
strings através do mesmo pipeline. Adicione `method: "local"` e `base_url`, ou
`method: "api"` e `endpoint`, para um modelo hospedado por você mesmo, e `script`
para um idioma escrito em mais de um sistema de escrita.

## Decisões ao longo do caminho

| Decisão | Escolha… | Quando |
|---|---|---|
| Onde o conjunto de testes fica | somente local | Ele for sensível, ou você ainda não tiver consultado as pessoas que o escreveram |
| | privado / lacrado | Você deseja que outros saibam de sua existência, ou concorram nele, sem vê-lo |
| Instruir ou treinar | Instruir um modelo hospedado | Você possui um glossário e pouco texto paralelo, e serviços externos forem aceitáveis |
| | Treinar com forge | Você possui alguns milhares de pares ou mais, ou os dados precisarem ficar nas suas máquinas |
| Publicar | Apenas pontuações | Padrão para qualquer conteúdo que você mesmo não tenha escrito |
| | Nada | Sempre permitido — a medição é útil privadamente |

## Quanto custa

- As ferramentas são gratuitas para uso não comercial: uma escola, um hospital ou
  clínica pública, uma instituição de caridade ou um projeto de pesquisa estão cobertos (a CLI, o nmt-forge e o
  servidor MCP estão sob a PolyForm Noncommercial 1.0.0; o ambiente de avaliação é de código
  aberto, AGPL-3.0-or-later). [Quem pode usar isto](/docs/getting-started/who-may-use-this).
- Um modelo hospedado custa o que o provedor cobrar; `--max-cost` interrompe uma execução
  antes que ela gaste mais do que o limite permitido, e o relatório exibe o custo por
  frase. Um modelo local custa apenas o tempo da sua máquina.
- Treinar o modelo padrão do forge requer uma CPU e alguns minutos; predefinições maiores
  exigem uma GPU.
