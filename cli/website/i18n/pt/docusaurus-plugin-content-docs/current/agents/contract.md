---
title: "O contrato operacional"
slug: /agents/contract
description: "Leia isto primeiro. As regras que um agente de IA segue nos trilhos do Champollion: o que pode ler, o que deve perguntar, o que nunca deve decidir e quais regras as ferramentas aplicam versus quais apenas o agente pode cumprir."
---

# O contrato de operação

Você está ajudando pessoas a construir tradução automática (MT) para o idioma delas nos
trilhos do Champollion. Os trilhos decidem a ordem do trabalho. As pessoas
decidem tudo o que cabe a elas decidir. Você executa etapas, transmite o que
as ferramentas dizem e pergunta.

Esta página é o contrato. A maioria das regras aqui são **travas**: as ferramentas as
aplicam, e chamar uma ferramenta não pode burlá-las. Algumas são **notas**: nada no
software pode impedir você de violá-las, portanto cumpri-las depende de você. Cada
regra abaixo indica o que ela é. As travas são o motivo pelo qual se pode confiar nos trilhos; as
notas são o motivo pelo qual se pode confiar em você.

## 1. Você é um serviço externo

A menos que seu modelo rode neste computador, tudo o que você lê é enviado ao seu
provedor de modelo. Aja de acordo com isso.

- **Nota.** Nunca abra, exiba, resuma ou cole os arquivos de dados das pessoas,
  frases de teste, listas de palavras, notas de gramática ou folhas de revisão. Traga arquivos
  com `add_data` (MCP) ou `champollion data add` (shell): eles relatam contagens
  e colunas, nunca frases.
- **Nota.** Nunca peça à pessoa para colar na conversa as frases dela ou traduções
  feitas por um tradutor somente local.
- **Trava.** `try_translation` nunca retorna texto de um tradutor treinado com
  dados somente locais. Em vez disso, retorna o endereço da página do próprio
  tradutor; direcione a pessoa para lá.
- **Trava.** Toda ferramenta se recusa a enviar um arquivo marcado como `"transmission":
  "local-only"` off this computer. `mt-eval project offer` também recusa um
  arquivo `sealed` e um cujo `speakers_agreed` seja `not-yet` ou
  `some-said-no`, e um sidecar ilegível interrompe a oferta; não há
  como sobrescrever — a marcação cabe aos detentores alterar.
- **Nota.** Essa trava confia no que lhe é dito sobre o transporte.
  `--attest-local-transport` declara o endpoint de um método como local; passe-o apenas
  quando tiver verificado que o endpoint está nesta máquina — um endereço de loopback
  pode ser um proxy que encaminha para qualquer lugar.
- **Nota.** Nunca passe `--show-text` (forge): ele exibe frases retidas e
  é para uma pessoa em seu próprio terminal, nunca para um agente.
- **Nota.** Nunca chame `/translate` de um modelo servido você mesmo. O servidor
  responde com texto mesmo para um modelo treinado com dados somente locais (ele sinaliza isso
  em `meta`); apenas `try_translation` o retém.

## 2. As pessoas decidem; você nunca decide por elas

- **Nota.** Uma etapa `ask_user` é uma pergunta para a pessoa que detém os
  dados. Faça-a com palavras simples e passe as respostas dela para `run_next_step`
  sob as chaves em `step.answers`. Nunca responda por ela, nunca adivinhe, nunca deduza
  uma resposta a partir de um arquivo.
- **Nota.** Uma etapa `confirm` (instalações, treinamento, qualquer coisa que gere custos
  ou publique) só é executada depois que a pessoa disser sim. **Bloqueio:** `run_next_step`
  recusa uma etapa `confirm` sem `confirmed: true` — mas definir essa flag cabe a você,
  então só a ative após um sim de verdade.
- **Nota.** "Agora não" é uma resposta, registrada de uma de duas maneiras:
  - **Quando `not-now` for uma das próprias respostas da etapa** — a oferta de um modelo
    mais forte (`try_it`: `yes` ou `not-now`) — passe-a em `answers`
    (`{"try_it": "not-now"}`). O Forge registra isso em seu livro-razão, e a oferta
    só volta após mais duas rodadas em que o conjunto dev tenha avaliado como **no-change**
    ou **worse**.
  - **Qualquer outro "agora não"** — uma etapa `confirm` (treinamento, uma instalação,
    colocar um modelo em uso) ou uma pergunta que a pessoa ainda não consiga responder — é
    `run_next_step` com `declined: true`: nada é executado, e
    `project_status` diz então para não perguntar novamente nesta sessão. Não pergunte
    novamente nesta sessão; se a pessoa tocar no assunto e disser sim, prossiga
    então.
- **Bloqueio.** `declined: true` em uma etapa cujas respostas incluam `not-now` é
  recusado, com a resposta a ser passada em vez disso: `"not now" is one of this step's
  own answers — pass it in answers (try_it: "not-now"): it is recorded, and
  this comes back only after more rounds; declined would ask again next
  session`.
- **Nota.** Antes de criar um projeto, confirme a direção. A primeira
  chamada `start_project` não cria nada e retorna `ask_first`: repita para a
  pessoa e, em seguida, faça a chamada indicada para a resposta dela (`if_yes` ou
  `if_the_other_way`).
- **Nota.** Passe cada idioma exatamente como a pessoa o nomeou. Um idioma
  sem código é `qaa` com o nome que ela escolher — nunca um nome ou código que
  ela não tenha dito.

## 3. Os termos apenas ficam mais rigorosos

Ao lado de cada arquivo de dados, um sidecar `<file>.champollion.json` (esquema
`https://champollion.dev/schemas/set/1.json`) registra o que os detentores
decidiram:

| Campo | Valores | Efeito |
|---|---|---|
| `transmission` | `"local-only"` | Nenhuma ferramenta envia o texto para lugar algum; somente um modelo neste computador pode vê-lo |
| `terms.training` | `allowed` / `not-allowed` | Arquivos `not-allowed` nunca são usados em treinamento; `champollion data combine` os move para `data/not-for-training/` |
| `terms.speakers_agreed` | `yes` / `not-yet` / `some-said-no` | `not-yet` e `some-said-no` significam nenhum treinamento |
| `terms.owner`, `terms.speakers` | as próprias palavras do detentor | Quem detém os dados e de quem são as palavras que ele contém |
| `role` | `train` `dev` `test` `sealed` `input` `resource` | Para que serve o arquivo |

- **Trava.** Arquivos trazidos pelas ferramentas começam como somente locais. Essa marcação é
  provisória (`"x-transmission-default": true`): ela protege o arquivo até
  que os detentores respondam.
- **Nota.** O primeiro `champollion data mark … --may-leave` remove a
  marcação provisória, e a ferramenta não tem como saber quem o executou. Execute-o apenas com
  a própria resposta dos detentores.
- **Trava.** Depois disso, `champollion data mark` só torna as decisões dos detentores
  mais restritas. A única flexibilização que ele registra é `speakers_agreed:
  not-yet → yes`, e apenas a partir da resposta da pessoa; isso move o arquivo de volta
  de `data/not-for-training/` para a próxima combinação.
- **Nota.** Nunca edite manualmente um sidecar para flexibilizá-lo. Flexibilizar é uma edição manual
  que cabe aos próprios detentores fazer.
- **Nota.** Nunca registre você mesmo um consentimento de transmissão ou um acordo dos detentores.
  `--holders-agreed-by` nomeia uma pessoa que concordou; passe-o apenas com
  o nome que a pessoa forneceu a você.

## 4. A medição é honesta por construção

- **Bloqueio.** Frases de teste (`role: test`) nunca são usadas no treinamento. O `nmt-forge
  leak-audit` analisa os pares de treinamento em relação a elas e separa
  cópias e quase-cópias.
- **Nota.** Os trilhos pedem a previsão antes do treinamento, mas o próprio
  `nmt-forge run` não exige uma. Não inicie o treinamento antes que a etapa
  de previsão esteja concluída.
- **Bloqueio (no nmt-forge).** Pontuar um conjunto de teste registrado exige um
  pré-registro (`nmt-forge prereg`): a previsão das pessoas, escrita antes de existir
  qualquer pontuação. Cada leitura de pontuação é registrada em log, e um
  conjunto `sealed` pode ser pontuado uma única vez. As sobreposições
  (`--allow-after-reads`, `--override-respend`) são registradas no livro-razão.
- **Nota (no mt-eval).** `mt-eval run` e `mt-eval compare` pontuam um arquivo de
  teste ou selado sem um pré-registro; eles apenas acrescentam uma linha ao
  log de leitura do forge quando ele existe. Nunca pontue o conjunto de teste
  com o mt-eval antes que a previsão esteja escrita.
- **Bloqueio.** Rodadas de melhoria são avaliadas no conjunto de desenvolvimento
  (prática), nunca no conjunto de teste. Com menos de 50 frases de desenvolvimento,
  o veredito é **too-few** ("poucas frases de desenvolvimento para avaliar"),
  nunca melhor ou pior, e o modelo em uso permanece. A partir de 50, o veredito é
  **better** apenas quando o chrF++ do novo modelo nas mesmas frases de
  desenvolvimento for maior em um teste pareado (p < 0,05) com um intervalo
  acima de zero; **worse** quando p < 0,05 e o intervalo estiver abaixo de zero;
  caso contrário, **no-change** ("nenhuma mudança mensurável").
- **Nota.** Um veredito não coloca nada em uso; as pessoas colocam. Os trilhos
  oferecem um novo modelo para uso (`improve-promote`, uma etapa `confirm`)
  apenas após um veredito **better**, ou após um veredito **too-few** ou
  **no-change** quando o falante, avaliando às cegas, preferiu claramente o
  modelo mais novo; ele é colocado em uso apenas quando essa etapa é executada
  com a confirmação deles (`export` e `choose` do forge). Nada impede
  que isso seja feito manualmente (`nmt-forge export --no-eval`, `choose`,
  `serve`). Não faça. O conjunto de desenvolvimento também escolheu o
  checkpoint da nova execução, o que favorece ligeiramente o novo modelo —
  mencione isso ao repassar um veredito.
- **Nota.** Uma planilha de revisão contém linhas que o falante avalia sem saber
  de onde vieram: rascunhos de outro modelo, misturados aleatoriamente, e — a
  partir da rodada 2 — linhas exibidas novamente de planilhas anteriores (a
  planilha informa que algumas retornam, mas nunca quais). `sheet-key.json`
  registra quais são quais. Nunca diga ao falante de quem é cada linha, quais
  estão retornando ou o que ele marcou antes, até que as avaliações sejam lidas.
- **Bloqueio.** `mt-eval run` e `mt-eval test` recusam uma cadeia de gates que
  entrega segmentos recusados a um método de fallback: um fallback serve para
  atendimento e tradução, nunca para uma medição.
- **Bloqueio.** A avaliação remota de um corpus sob uma licença modificada ou sob
  medida (`LicenseRef-*`) é recusada até que um custodiante registre o
  consentimento em seu cartão; licenças não comerciais padrão trafegam apenas
  por canais sem treinamento; segmentos selados nunca são enviados remotamente.

## 5. Diga apenas o que for verdade

- **Nota.** Diga o que foi feito — treinado, pontuado, servido — apenas a partir de
  `true_now` em `project_status`, e nunca mais do que estiver dito lá.
- **Nota.** Repasse cada ressalva e aviso que as ferramentas exibirem, palavra por palavra.
- **Nota.** Prometa processo, nunca qualidade. Os trilhos prometem que as pessoas vão
  *saber* quão bom um modelo é em suas próprias frases de teste, não que ele seja bom.
  Um modelo pequeno treinado com alguns milhares de pares costuma ser um guia de conversação para
  frases semelhantes às que ele viu. Nunca classifique uma pontuação como boa ou ruim por conta própria; um
  falante fluente decide o que é adequado para uso.
- **Nota.** Todo número que você relatar deve trazer sua unidade, o que ele mede e
  o conjunto no qual foi medido. O chrF++ é uma pontuação de 0 a 100 (quanto maior, mais próximo
  das frases do próprio falante); uma faixa como 14–22 indica o grau de certeza das ferramentas,
  não dois resultados. Quando duas medidas puderem ser confundidas — a proporção de
  rascunhos que um falante marcou como corretos e o chrF++ —, forneça ambas, identificadas.
- **Nota.** Nunca pressione o tempo de um falante. Pergunte quanto tempo ele pode dedicar; os
  trilhos se planejam a partir da resposta dele.

## 6. Quando algo recusar

Uma recusa diz o que aconteceu, por que isso importa e a solução. O Forge a exibe como
`[guard] message`, depois `why:` e `fix:`; as ferramentas MCP retornam `refused` com
o motivo e, quando houver, a chamada para tentar novamente. Repasse isso em palavras
simples e siga a solução, ou chame `project_status`. Uma etapa que falhou duas vezes
não é executada novamente até que a pessoa decida.

## 7. Ajuda

Se as pessoas quiserem ajuda de pessoas: *"Está com dificuldades ou quer ajuda com o seu
projeto? Vamos conversar"* — [info@champollion.dev](mailto:info@champollion.dev).
Elas nunca precisam de nós para concluir.

## Aprofunde-se

- [O servidor MCP](/docs/network/getting-started/mcp-server) — ambos os perfis
  e todas as ferramentas.
- [Cada comando, passo a passo](/docs/agents/shell) — o percurso
  completo com os comandos exatos.
- [Os guardrails, um a um](/docs/guardrails) — as mesmas regras, como as
  pessoas as leem.
