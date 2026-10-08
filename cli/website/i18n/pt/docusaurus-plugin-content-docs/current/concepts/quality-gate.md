---
sidebar_position: 3
title: "Portão de Qualidade"
related:
  - label: "Coaching Data"
    to: /docs/concepts/coaching-data
    kind: concept
  - label: "Script Converters"
    to: /docs/concepts/script-converters
    kind: concept
  - label: "Scoring Specification"
    to: /docs/network/specifications/scoring
    kind: arena
    note: "How quality is scored on the public benchmark"
  - label: "Cookbook: Translate 30 Languages"
    to: /docs/tutorials/translate-30-languages
    kind: cookbook
    note: "Audit quality across 30 locales"
---

# Portão de Qualidade

Toda tradução passa por um portão de validação determinístico antes de ser escrita no disco. O portão de qualidade captura modos de falha comuns em tradução automática — sem fallbacks silenciosos, sem lixo escrito nos seus arquivos de locale.

## Verificações de Validação

| Verificação | O que detecta | Rótulo do Gate |
|---|---|---|
| **Vazio/em branco** | O modelo retornou uma string vazia ou espaços em branco | `[GATE] empty` |
| **Eco do original** | O modelo retornou a entrada original em inglês — exatamente como estava, ou disfarçada (acentos, maiúsculas/minúsculas, caracteres de largura total), no valor inteiro ou em uma forma plural | `[GATE] source-echo` |
| **Estrutura de ICU / placeholder** | Uma variável traduzida, palavra-chave ou seletor de plural, um `#` ou `%s` perdido | `[GATE] icu` |
| **Marcação** | Uma tag aberta, fechada ou aninhada de forma diferente da origem | `[GATE] markup` |
| **Quebra de frase ao lado de um placeholder** | Um final de frase que a tradução coloca logo antes ou depois de um placeholder onde a origem não tem nenhum: `Take this medicine at {time}.` → `… sina. {time}.` | `sentence break beside a placeholder` |
| **Loop de alucinação** | Padrões de trigramas repetidos (ex.: `"Qo' Qo' Qo'"`) | `[GATE] hallucination` |
| **Inflação de tamanho** | A saída é significativamente mais longa do que a origem | `[GATE] length` |
| **Exclusão de conteúdo** | A saída é a origem com suas letras removidas | `[GATE] content` |
| **Conformidade de escrita** | Sistema de escrita incorreto para a localidade de destino | `[GATE] script` |
| **Mesma saída, entradas diferentes** | Um mesmo texto retornado para várias strings de origem diferentes (uma frase memorizada) | `[GATE] shared-output` |
| **Categorias de plural ICU** | Formas de plural obrigatórias ausentes para a localidade | `[GATE] icu-plural` |

Chaves declaradas como [`noTranslate`](/docs/getting-started/configuration#no-translate) nunca chegam ao gate — elas são copiadas textualmente da origem, portanto não há nada a validar.

**Páginas Markdown recebem as mesmas verificações, bloco por bloco.** Em uma pasta de conteúdo (`contentDir`, documentação do Docusaurus), cada título, parágrafo, item de lista e célula de tabela é verificado individualmente, assim como cada campo de front-matter. As verificações são as mesmas descritas acima: vazio, eco do original, loop de alucinação, inflação de tamanho, exclusão de conteúdo, sistema de escrita e mesma saída para entradas diferentes. Um título curto como `## Feast` que retorna como uma frase inteira é recusado, assim como acontece com a chave do aplicativo com o mesmo texto.

Um bloco recusado é **solicitado mais uma vez, acompanhado do motivo**. O modelo é informado sobre o que estava errado e que textos que já estejam corretos como foram escritos podem retornar inalterados. Algumas recusas não podem ser decididas por nenhuma regra fixa: um título que é um nome (`### BLEURT (Sellam et al., 2020)`), uma entrada de lista de referências, uma tabela de códigos ou uma glosa podem estar corretos exatamente como foram escritos, ou podem ser uma tradução perdida. Se o bloco retornou inalterado, ou mantido no alfabeto latino em um idioma não latino, e o modelo der a mesma resposta novamente, essa resposta será aceita como intencional. Todas as outras recusas devem passar pelo gate diretamente na segunda resposta. Um endpoint que declara não seguir instruções (`"acceptsInstructions": false`) não é consultado novamente; sua primeira resposta é avaliada como uma segunda resposta.

O que continuar sendo recusado vai para o método `fallback` do par. Sem ele, **o bloco mantém seu texto de origem, sem nenhum marcador adicionado à página**, nunca é armazenado em cache e a entrada de lock da página fica como `pending:<hash>`. `status` e `verify` listam essas páginas, e a sincronização nomeia cada bloco. A recusa é lembrada: a próxima sincronização simples não enviará esse bloco para o mesmo modelo novamente (consulte [Blocos Markdown e campos de front-matter recusados](#refused-markdown-blocks-and-front-matter-fields)). Código, links e marcação em um bloco são protegidos separadamente, e comentários HTML nunca são enviados. Alguns textos são mantidos exatamente como foram escritos sem que sejam questionados:
- um nome curto (`## GitHub`), medido sem seu código inline, aspas, parênteses e `{#anchor}`;
- uma entrada de lista de referências, ou uma lista de referências inteira em um único bloco;
- letras de largura total (fullwidth) que a própria origem exibe.

Uma tabela é avaliada por suas células, não por suas barras verticais (pipes) e linha delimitadora. `verify` verifica os blocos já no disco da mesma forma, exceto aquele que for exatamente o que a sincronização aceitou e armazenou em cache para a sua origem. Um bloco que falha gera um aviso, o que faz o `verify --strict` falhar, e vem acompanhado do comando de reparo `champollion sync --pair en:fr --redo files:<page>`. A sincronização exibe o mesmo comando para o mesmo arquivo.

### Vazio/Em Branco

Rejeita traduções que são strings vazias, apenas espaços em branco, ou `null`. Isso captura modelos que não retornam nada para chaves difíceis.

### Eco da Fonte

Detecta quando o modelo retorna o texto de origem em inglês em vez de traduzi-lo. Comum em strings curtas e prompts pouco especificados. Duas regras se aplicam, e elas medem coisas diferentes:

1. **Uma cópia exata** (byte a byte da origem) é recusada — exceto no caso de um valor **curto e composto majoritariamente por ASCII**: 30 caracteres ou menos, mais de 80% ASCII simples. `"Blog"`, `"GitHub"`, `"npm"` legitimamente permanecem em inglês, portanto, em um idioma de destino com escrita latina, essa cópia é aceita (o `verify` a lista como eco do original); em um destino não latino, o modelo é questionado uma vez se é um nome, e a mesma resposta dada duas vezes é aceita como tal. **Esta isenção diz respeito ao comprimento e cobre apenas cópias exatas.**
2. **Uma cópia disfarçada** — a origem apenas com maiúsculas/minúsculas, acentos, espaçamento, caracteres invisíveis ou formas de compatibilidade (caracteres de largura total, ligaduras) alterados — é recusada quando a origem possui **três ou mais palavras** com letras (placeholders como `{count}` ou `%s` e tags de marcação não contam), **por mais curta que seja**. `"Book an appointment"` (19 caracteres, 3 palavras) → `"Bóok án appóintment"` é recusado; `"cafe"` → `"café"` (1 palavra) é aceito, pois uma tradução real pode diferir do inglês apenas pelos seus acentos. Um nome mais longo que legitimamente ganhe acentos (`"Universite de Montreal"`) é aceito assim que você declarar a grafia acentuada como um termo protegido.

Ambas as regras se aplicam **a cada forma de plural** também. Um plural `msgstr[n]` do gettext, uma ramificação `{n, plural, …}` de ICU ou uma chave `_one`/`_other` do i18next são submetidos às mesmas regras que um valor no singular: um plural em russo cuja forma `few` retornou como o inglês com acentos é recusado da mesma forma que o singular seria.

Valores mais longos que também estejam corretos inalterados — URLs, caminhos de repositório, identificadores de produto — não são um problema do gate e não podem ser corrigidos ajustando o gate: a resposta correta *é* o eco, então qualquer saída do modelo estaria errada. Declare essas chaves com [`noTranslate`](/docs/getting-started/configuration#no-translate) e elas ignorarão o pipeline por completo. Chaves com valores de URL são tratadas dessa forma por padrão.

### Loop de Alucinação

Analisa padrões de trigrama (3 caracteres) na saída. Se algum trigrama se repete mais que um número limite de vezes em relação ao comprimento da saída, a tradução é rejeitada. Isso captura saídas degeneradas como `"Qo' Qo' Qo' Qo' Qo'"`.

### Inflação de Comprimento

Rejeita traduções em que o comprimento da saída exceda `maxLengthRatio × source length` (padrão: 4×) — estritamente mais: uma tradução de exatamente 4× é aprovada. Isso captura alucinações do modelo que produzem blocos enormes de texto para uma entrada curta.

Configurável via `maxLengthRatio` na sua configuração.

### Exclusão de conteúdo

O oposto da inflação de tamanho. Um modelo sem vocabulário para uma string pode excluir todas as letras que não consegue traduzir e deixar a pontuação e os espaços da origem intactos:

```
"low-resource nmt · tokenizers · nêhiyawêwin"  →  "   ·   · êhiêi"
"the simple-builder approach"                  →  "  "
```

Nada mais detecta isso. Não está vazio, não é um eco, não é repetitivo e, com 33% do *tamanho* da origem, passa confortavelmente por `minLengthRatio`.

A verificação compara os **caracteres de conteúdo** — letras e dígitos, ignorando pontuação, espaços em branco e formatação invisível — entre a origem e a saída. Mas a densidade por si só não pode ser a regra, porque escritas densas legítimas ficam exatamente na mesma faixa:

| Origem | Saída | Conteúdo retido | Veredito |
|--------|--------|------------------|---------|
| `low-resource nmt · tokenizers · nêhiyawêwin` | `   ·   · êhiêi` | 14% | **rejeitado** |
| `Getting started` | `入门` | 14% | aceito |
| `Frequently asked questions` | `常见问题` | 17% | aceito |

Qualquer limite que capture o primeiro caso rejeitaria chinês, japonês e coreano de imediato. O que os diferencia não é o quanto sobreviveu, mas *de onde veio*: a saída esvaziada é uma **subsequência** de sua própria origem — gerável pela exclusão de caracteres dela —, enquanto uma tradução real essencialmente não compartilha nada com a origem. Uma sinalização requer **ambos** os sinais, de modo que a verificação é necessária, mas não suficiente, da mesma forma que o detector de repetição.

Configurável via `minContentRetention` (padrão `0.35`), por par ou por idioma. Aumentar esse valor torna a verificação mais rigorosa; ela só é acionada em conjunto com o sinal de subsequência.

:::note[Este é um sinal de vocabulário, não um ajuste de qualidade]
Quando isso dispara repetidamente para um idioma de destino, significa que o modelo não possui palavras para aquele texto — geralmente strings curtas e cheias de jargões em um idioma com léxico restrito. Flexibilizar o limite apenas restaura a corrupção silenciosa; não produz uma tradução. Corrija o prompt, os dados de coaching ou o par.
:::

### Conformidade de Script

Para localidades cujo cartão de idioma registra um sistema de escrita não latino (árabe, CJK, cirílico, …), valida se a saída não é apenas latina. As letras são classificadas pelo **sistema de escrita Unicode**, não por byte: latim acentuado (`"Bóók"`) e latim de largura total (`"Ｂｏｏｋ"`) são latinos, portanto nenhum dos dois passa como russo. Letras latinas de largura total são recusadas em qualquer destino fora da tipografia CJK (onde `"ＯＫ"` é de uso comum no japonês) — elas são inglês disfarçado. As tolerâncias habituais se mantêm: um nome curto mantido como escrito (a questão de nome ou rótulo mencionada acima), termos protegidos declarados e chaves `noTranslate` (URLs entre elas) nunca falham nessa validação.

Dois esclarecimentos sobre o que esta verificação *não* é:

- Ela **não é orientada pelo campo de configuração `script:`.** Esse campo seleciona a ortografia de saída para [conversão de escrita](/docs/getting-started/configuration#script-conversion); a expectativa do gate vem dos cartões de idioma.
- Ela sempre valida a **escrita de trabalho emitida pelo modelo**, *antes* de qualquer conversão de escrita. Localidades com um conversor de escrita (crk, sr, tlh, …) produzem corretamente uma saída em escrita de trabalho latina, portanto estão isentas dessa verificação; a conversão — caso a configuração opte por ela — ocorre após o gate.

### Marcação

Tags são código. Por nome de tag, a tradução deve abrir, fechar e fechar automaticamente o mesmo número de tags que a origem, aninhando-as da mesma forma (`<b>` dentro de `<a>` permanece dentro de `<a>`); a ordem entre elementos irmãos pode mudar com a ordem das palavras. `"Please <strong>book</strong> now"` → `"Veuillez <strong>réserver maintenant"` é recusado — uma tag de fechamento perdida quebra a página. Em uma mensagem no plural, cada forma é comparada com a forma de origem que ela traduz. `verify` executa a mesma verificação nos arquivos.

### Quebra de frase ao lado de um placeholder

Um placeholder é preenchido em tempo de execução, portanto, um ponto final que a tradução coloque logo ao lado dele altera o que o leitor vê: `"Take this medicine at {time}."` → `"… sina. {time}."` exibe a hora como uma frase própria. O gate recusa uma tradução que insira uma finalização de frase (`.`, `!`, `?`, ou a pontuação de outro sistema de escrita: `。`, `？`, `।`, `؟`, `።`, `᙮`, …) logo **antes** de um placeholder, ou logo **depois** de um seguido de mais texto, quando a origem não possui pontuação ali e a tradução tem mais finais de frase do que a origem. Um placeholder que apenas se move para o fim da frase (`"Shipped by {carrier} on {date}."` → `"Expédié le {date} par {carrier}."`) é aprovado. O mesmo vale para reticências, casas decimais ou nomes de arquivo (`{host}.com`), e abreviações de uma letra (`"M. {name}"`). Uma abreviação mais longa antes de um placeholder (`"ca. {count}"`) não pode ser diferenciada de um final de frase, portanto também é recusada, e o fallback do par, ou uma resposta reformulada, assume o caso. `verify` sinaliza os mesmos valores no disco, com o comando `--redo` que solicita novamente. Mensagens ICU de plural e select ficam a cargo da verificação de ICU.

### Mesma saída, entradas diferentes

Um modelo que memorizou uma frase de treinamento pode retorná-la para strings que não conhece: uma mesma frase para o título do aplicativo, "Contact the school", o título de uma newsletter e seu cabeçalho, passando individualmente em cada verificação acima. Quando uma tradução responde a **três ou mais strings de origem diferentes** na execução de uma localidade — e tem quatro ou mais palavras, ou as origens têm duas ou mais palavras cada com pouco em comum —, essas chaves são recusadas (para que a nova tentativa e, em seguida, o fallback as assumam). **Duas** strings de origem diferentes são suficientes quando a evidência é forte: ambas têm duas ou mais palavras, compartilham menos da metade de suas palavras e a tradução compartilhada tem quatro ou mais palavras (`"Thank you for coming!"` e `"Please bring the forms."` respondidos com uma única frase). Uma frase capturada dessa forma é lembrada para a localidade: uma sincronização posterior que a receba novamente, mesmo para uma única string, irá recusá-la, e as entradas de cache que já a forneceram são removidas, para que um redo consulte o modelo novamente em vez de gravar a partir do cache. Sinônimos que convergem para uma tradução curta (`"OK"`/`"Okay"`/`"Sure"` → `"D'accord"`, `"Close"`/`"Dismiss"` → `"Fermer"`) passam, assim como um único texto de origem usado sob várias chaves. Blocos Markdown e campos de front-matter dos arquivos de conteúdo da execução também contam, assim como cada ramificação de uma mensagem ICU de plural ou select (as ramificações de um mesmo plural contam como uma única origem — um idioma sem flexão de número grava o mesmo texto em cada uma). As saídas são comparadas desconsiderando maiúsculas/minúsculas, pontuação e marcadores de bloco Markdown; assim, `"S?"`, `"S."` e um título `# S` são considerados uma única saída. A contagem inclui o que a localidade já contém no disco e o que o cache forneceria (uma frase armazenada em cache um texto por vez por outra ferramenta é recusada no cache, não gravada), portanto, uma chave adicionada uma sincronização por vez também é capturada. `verify` falha no mesmo padrão no disco, e a ferramenta MCP `translate` o recusa dentro de uma chamada.

### Uma pergunta que perdeu seu ponto de interrogação

Quando a origem termina com `?` ou `!` e a tradução não termina com isso nem com o equivalente usado pelo seu sistema de escrita (`？`, `؟`, `;` grego, `¿…?`, `！`, …), `sync` e `verify` emitem um aviso: `"Where does it hurt?"` escrito como uma afirmação é lido como tal. É um aviso, não uma recusa, porque alguns idiomas marcam perguntas com uma palavra ou partícula em vez de um sinal de pontuação. O aviso lista as chaves e o comando `--redo keys:<key> --fresh` que solicita novamente (`--fresh`, pois o cache armazena a resposta).

## O Que Acontece em Caso de Falha

1. A tradução com falha é registrada em stderr com o prefixo `[GATE]`, o nome da chave, o motivo e uma prévia do valor
2. A chave **não** é gravada no arquivo de localidade
3. A cascata de novas tentativas entra em ação (veja abaixo)
4. Se ainda assim falhar, a recusa é **lembrada** (consulte [Chaves recusadas são retidas](#refused-keys-are-held-back))

```
[GATE] hero.title: source-echo — "Welcome to our platform"
[GATE] nav.about: hallucination — "À À À À À À À À"
```

## Nova tentativa com feedback e a cascata de novas tentativas

Uma chave rejeitada pelo gate recebe **uma nova tentativa com feedback**: o motivo da rejeição é injetado no prompt como contexto por chave (uma nova tentativa cega com temperatura baixa retornaria uma saída idêntica em bytes). Se a nova tentativa for aprovada, a chave é gravada e a sincronização fica **verde** — uma rejeição do gate que se autocorrige não é uma falha, e essa é a semântica esperada. As chaves que continuarem falhando após a nova tentativa são ignoradas e reportadas (a sincronização é encerrada com `2`).

A nova tentativa é executada pelo próprio método de tradução do par, seja ele qual for — LLM, Google Translate, DeepL ou um provedor direto. Apenas métodos de LLM leem o feedback; a linha de execução informa isso (`retrying with feedback` ou `asking once more (deepl takes no instructions…)`). Um endpoint `api` recebe o feedback apenas se declarar `"acceptsInstructions": true` (no par ou em seu manifesto de plugin); um que declarar `false` — um modelo de NMT treinado como o `nmt-forge serve`, que responderia o mesmo — não é consultado novamente: suas respostas são julgadas como uma segunda resposta seria, e o que ele recusar vai para o fallback do par. A nova tentativa também se aplica a correspondências de Memória de Tradução (Translation Memory): um valor em cache rejeitado pelo gate é removido e retraduzido na mesma execução, de modo que um cache contaminado se autocorrige.

### Chaves recusadas são retidas

Uma recusa é lembrada em `.champollion.lock`, por chave, para o **texto de origem atual** da chave e o **método e modelo** que produziram a resposta recusada. Strings de interface do Docusaurus (`i18n/<locale>/code.json` e os arquivos JSON dos plugins) seguem a mesma regra, por arquivo e id. A próxima execução simples de `sync` não envia essa chave para o mesmo modelo novamente — isso apenas cobraria pela mesma resposta — e informa quantas foram retidas e como proceder:

- solicitar novamente: `champollion sync --redo keys:<key>` (ou `--redo all`, ou `--fresh`) — especificar a chave é uma nova tentativa explícita;
- preenchê-la de outra forma: adicione um método `"fallback"` ao par (ele é consultado para chaves que o método original do par recusou), liste a chave em `noTranslate` se ela deve permanecer como escrita, ou escreva a tradução manualmente no arquivo.

Uma chave retida fica sem tradução, portanto a sincronização é encerrada com `2` até que ela seja preenchida. Alterar o texto de origem, o modelo ou o método remove a retenção (a recusa foi referente àquele texto gerado por aquele modelo). O cache ainda é lido para ela — a retenção impede chamadas pagas, não as gratuitas. Uma chave que uma nova execução (redo) não conseguiu concluir é a única exceção, descrita abaixo.

### Blocos Markdown e campos de front-matter recusados

A mesma regra se aplica a arquivos de conteúdo (`contentDir`, documentação do Docusaurus). Um bloco ou campo de front-matter recusado pelo gate é registrado em `.champollion-content.lock`, por página, bloco e localidade, para o **texto de origem atual** do bloco e o **método e modelo** que produziram a resposta recusada. Um bloco é identificado pelo seu texto de origem, portanto, editar o parágrafo remove a retenção. A próxima execução simples de `sync` não o envia para o mesmo modelo novamente, e informa quantos blocos e campos foram retidos em cada página:

- um bloco retido mantém seu texto de origem na página, sem nenhum marcador, até que seja preenchido; o restante da página é gravado;
- um campo de front-matter retido mantém seu texto de origem da mesma maneira, e o restante da página é gravado;
- uma página traduzida inteira (`contentSegmentation: "page"`) é recusada por completo quando sua resposta danifica um bloco protegido ou esvazia a página. Ela é lembrada pelo texto de seu corpo e retida por inteiro: não é gravada e nada dela é enviado até que seja preenchida. Editar o corpo ou alternar para segmentação por blocos remove a retenção.

Uma recusa feita por uma versão anterior do gate é liberada automaticamente. Quando uma verificação é flexibilizada, o que havia sido recusado por ela é solicitado novamente na próxima sincronização, sem necessidade de um redo.

A ordem de precedência é a mesma das chaves:

1. Uma página especificada para um redo é sempre enviada: `champollion sync --redo files:<page>`, `--redo content` (todas as páginas), `--retranslate` ou qualquer coisa sob `--fresh`.
2. Caso contrário, um bloco ou campo recusado é retido. Se o par tiver um método `fallback` que não o tenha recusado, o fallback é consultado e o método principal do par não.
3. Uma mudança de modelo ou método remove a retenção, assim como uma alteração no texto de origem do bloco.

O cache ainda é lido primeiro, portanto a retenção evita chamadas pagas, não as gratuitas. Um bloco preenchido de outra maneira remove seu registro: por um fallback, pelo cache ou por um parágrafo que você mesmo escreva na tradução (uma pasta de conteúdo preserva parágrafos escritos manualmente). Um bloco ou campo retido fica sem tradução, de modo que a sincronização é encerrada com `2` até ser preenchido. O mesmo se aplica a um bloco recusado pelo gate durante a execução atual. Uma simulação (dry run) lista o que uma execução real reteria.

### Um redo que não pôde ser concluído

Quando `--redo all`, `--redo keys:` ou uma troca de modelo (`--redo all --fresh-on-model-change`) deixam chaves de um arquivo chave-valor sem tradução, elas são registradas como **pendentes** em `.champollion.lock`, e a próxima sincronização simples com `sync` solicita essas chaves ao modelo mais uma vez — diretamente do modelo, não do cache (já que o objetivo do redo era o texto do novo modelo). `champollion status` lista essas chaves. Se essa nova tentativa também for recusada, a chave continuará pendente (o status informará isso) e será retida como qualquer chave recusada. Em ordem de precedência: uma chave especificada por `--redo`/`--fresh` é sempre enviada; uma chave pendente recebe essa nova tentativa única; uma chave recusada é retida. Uma string de interface do Docusaurus não tem nova tentativa pendente: recusada sob um redo, ela é retida pela próxima sincronização simples, assim como um bloco de conteúdo.

Separadamente, quando um lote inteiro falha (erro de análise de JSON), o champollion tenta novamente com lotes progressivamente menores:

```
Full batch (80 keys) → parse error
  └→ Half batch (40 keys) → 2 failures
      └→ Individual keys (1 each) → isolates the 2 problem keys
```

O orçamento de retry é limitado por `maxRetries` (padrão: 3, configurável por idioma). Isso previne gasto de tokens descontrolado em chaves que falham consistentemente.

Após esgotar as tentativas, as chaves com problemas são registradas e ignoradas. Uma chave que não obteve nenhuma resposta utilizável (ausente na resposta) é solicitada novamente na próxima execução de `sync`; uma chave recusada pelo gate é retida, conforme descrito acima.

## Cache de Prompt

A mensagem do sistema (registro, regras de gramática, notas de estilo) é separada da mensagem do usuário (as chaves a traduzir). Essa separação é intencional:

- A mensagem do sistema é **idêntica entre lotes** para um dado locale
- Provedores como Anthropic e Google fazem cache de mensagens de sistema repetidas
- Resultado: o primeiro lote paga o custo total de tokens, lotes subsequentes pagam apenas pela mensagem do usuário

Isso pode reduzir significativamente os custos de tokens para projetos com muitos lotes.

## Validação de ICU MessageFormat

O comando `integrity` valida padrões plurais de ICU MessageFormat contra regras plurais CLDR. Se seu arquivo fonte usa sintaxe ICU como:

```json
"items": "{count, plural, one {# item} other {# items}}"
```

Champollion verifica que versões traduzidas incluem todas as categorias plurais obrigatórias para o locale de destino. Por exemplo, árabe requer seis categorias (`zero`, `one`, `two`, `few`, `many`, `other`) — não apenas `one` e `other`.

### Formas de plural não fornecidas pela tradução

O prompt informa as categorias CLDR do idioma de destino. Quando uma mensagem de plural retorna sem uma categoria que o idioma utiliza para contagens comuns (qualquer contagem de 0 a 1000 — como `few` em russo para 2, 3, 4 e `many` para 0, 5, 6), o gate consulta o modelo mais uma vez, indicando as formas ausentes e as contagens que elas cobrem. Uma segunda resposta sem elas é aceita, nunca solicitada uma terceira vez e nunca preenchida pela ferramenta — a sincronização então:

- emite um aviso, indicando cada chave e suas formas ausentes, bem como o comando para tentar novamente (`sync --redo keys:… --fresh`, onde um `--model` mais forte ajuda);
- em um catálogo gettext, onde `msgfmt` precisa de cada `msgstr[n]`, grava as formas ausentes como cópias de `other` e marca a entrada com um comentário de tradutor `# champollion:` (o Poedit e o Weblate o exibem; `verify` o lê, inclusive no CI sem o cache);
- em arquivos ICU (next-intl, ARB), grava a mensagem da forma como veio; o aplicativo exibe a forma `other` para essas contagens.

Essa mensagem não é tratada como traduzida. Uma sincronização posterior que execute outro método ou modelo — um que ainda não a tenha respondido, como o modelo hospedado do CI após um modelo local — a solicita novamente, a partir do modelo, e não do cache (que armazena a resposta incompleta); a estimativa inclui seu custo. `sync --redo gaps` solicita todas essas mensagens, independentemente de quem as deixou. Se a nova resposta também não contiver as formas, a mensagem permanece como estava (marcada em um catálogo), e `.champollion.lock` registra quais configurações responderam sem elas, para que nenhuma delas seja consultada novamente para o mesmo texto ([guia de CI](/docs/guides/ci-cd#plural-gaps)).

`verify` relata ambos os casos com o comando de reparo. Formas alcançadas apenas acima de 1000 ou por frações (o `many` em francês e espanhol, usado para 1 000 000) recebem uma linha informativa, não um aviso. Um mecanismo de tradução automática (DeepL, Google, …) não pode ser instruído sobre quais formas escrever, portanto sua resposta não recebe novas tentativas — apenas é relatada. Para arquivos i18next, cada forma que a origem não possui (como o `count_many` em francês a partir do inglês) é sua própria chave, traduzida a partir do texto de `_other`: um LLM é consultado para essa forma, e a sincronização informa isso; com um mecanismo de tradução automática, ela informa que o valor contém a forma `other`.

Execute `champollion integrity` para verificar completude plural em todos os locales.

## Aplicação de Terminologia

Para pares treinados com um dicionário, champollion executa uma verificação de terminologia pós-tradução. Após o portão de qualidade passar, verifica se o LLM realmente usou os termos de dicionário obrigatórios.

```
[TERM] en→fr: 2 term violation(s)
  • hero.title: "dashboard" → expected "tableau de bord" but got "panneau de contrôle"
```

Violações de terminologia são **avisos, não erros bloqueadores**. A tradução ainda é escrita no disco. Isso é intencional — o LLM pode ter razões válidas para escolher uma alternativa (contexto, gramática), e bloquear em incompatibilidades de termos causaria mais dano que bem.

Para corrigir violações, atualize o dicionário de treinamento ou edite manualmente o arquivo de locale.

---

## Veja Também

- [Como Sync Funciona](/docs/concepts/how-sync-works) — onde o portão de qualidade se encaixa no pipeline
- [Métodos de Tradução](/docs/guides/translation-methods) — métodos que alimentam o portão
- [Conversores de Script](/docs/concepts/script-converters) — conversão de script pós-portão
- [Dados de Treinamento](/docs/concepts/coaching-data) — melhorando qualidade de tradução upstream
- [Memória de Tradução](/docs/concepts/translation-memory) — cacheando traduções validadas
- [Referência CLI — sync](/docs/reference/cli#sync) — flags de sync incluindo comportamento de retry
- [Referência CLI — integrity](/docs/reference/cli#integrity) — auditoria plural ICU
