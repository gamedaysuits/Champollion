---
title: "Iniciar um projeto"
slug: /start
description: "Comece a criar um tradutor para a sua língua — com um assistente de IA no seu computador, ou digitando quatro comandos por conta própria."
---

# Iniciar um projeto

Há duas maneiras de começar. De qualquer forma, as ferramentas rodam no seu próprio computador e guiam você passo a passo.

## Com um assistente de IA

Este é o caminho mais fácil. O assistente digita para você; você só responde às perguntas que cabem a você responder.

**Do que você precisa:** um assistente de IA que funcione como um aplicativo no seu computador — não apenas no celular — e que possa usar ferramentas nele.

### 1. Adicione os trilhos ao seu assistente

Copie a breve configuração abaixo, cole-a no seu assistente e diga:
*"Por favor, configure isto para mim."* Muitos assistentes conseguem fazer isso. Se o seu não conseguir, peça a alguém com familiaridade em computadores para fazer isso uma vez — os passos estão logo abaixo.

```json
{
  "mcpServers": {
    "champollion": { "command": "npx", "args": ["-y", "champollion-mcp-server"] }
  }
}
```

<details>
<summary>Configurando manualmente</summary>

Os assistentes se conectam a ferramentas por meio de um padrão comum chamado MCP; a configuração acima diz ao seu como iniciar os trilhos. O seu computador também precisa do Node.js 20.11 ou mais recente, um programa gratuito.

- **Aplicativo para desktop do Claude:** Settings → Developer → Edit Config. Adicione a configuração a esse arquivo, salve e reinicie o aplicativo.
- **Claude Code:** execute isto uma vez em um terminal:
  `claude mcp add champollion -- npx -y champollion-mcp-server`
- **Cursor:** adicione a configuração ao arquivo `mcp.json` na pasta `.cursor` do seu projeto, ou na pasta `.cursor` na sua pasta pessoal.

</details>

### 2. Diga com suas próprias palavras

Algo como:

> *Queremos criar um tradutor de inglês para a nossa língua — use o
> champollion.*

### 3. Responda ao que ele perguntar

Primeiro, ele confirmará a direção com você — *"você insere inglês e sai a sua língua. É nessa ordem que você quer?"* — porque inverter isso é um erro fácil de cometer. Depois, ele cria uma pasta de projeto e pede os seus arquivos.

A partir daí, ele perguntará sempre que uma decisão for sua: a quem pertencem as suas palavras, se um tradutor pode aprender com elas, se deve instalar algo. Responda por si mesmo. Se ainda não souber, avise — os trilhos podem esperar. E *agora não* é sempre uma resposta válida: os trilhos não perguntarão novamente nessa sessão.

**Uma coisa a saber antes.** A maioria dos assistentes envia o que lê para a empresa que os opera. No caso de arquivos mantidos neste computador, as ferramentas apenas dizem ao seu assistente *quantas* frases você tem, nunca as frases em si — mas um assistente que pode usar o seu computador pode abrir qualquer arquivo que você possa abrir. Para palavras que você queira manter em sigilo, peça a ele que não faça isso, ou use um assistente que rode no seu próprio computador. O artigo [Suas palavras, suas regras](/docs/your-words-your-rules) explica melhor.

## Por conta própria

Se você se sente à vontade digitando comandos, são apenas quatro linhas. Instale a ferramenta do projeto (ela precisa do Node.js 20.11 ou mais recente), inicie um projeto e pergunte qual é o próximo passo:

```bash
npm install -g champollion
champollion new family --from English --to qaa --target-name "Our language"
cd family
champollion next
```

`qaa` significa "uma língua ainda sem código" — funciona perfeitamente; as ferramentas só não vão preencher informações como o seu alfabeto para você. O nome entre aspas é como você vai chamá-la. Se a sua língua tiver um código, ou um nome que as ferramentas conheçam, use-o em vez disso. Se um nome puder se referir a mais de uma língua, pergunte aos falantes qual delas eles falam antes de escolher um código; até que eles digam, `qaa` funciona, mas não possui ficha de idioma, portanto nenhuma regra de plural ou escrita virá dela.

A partir daí, `champollion next` sempre informa o próximo passo e o comando exato para ele. Quando chegar a hora de treinar um tradutor, os trilhos perguntam antes de instalar as ferramentas de treinamento.

## Trabalhando sem internet

Fique online durante a instalação e o primeiro treinamento: as ferramentas de treinamento e o tradutor mais forte (cerca de 1,2 GB) são baixados nessa etapa. Depois disso, o trabalho ocorre no seu computador. Para interromper as consultas das próprias ferramentas — elas podem buscar a ficha de informações públicas de uma língua, enviando apenas o código dela —, defina isto no seu terminal e nas configurações do seu assistente:

```bash
export CHAMPOLLION_OFFLINE=1
```

Um assistente de IA que roda nos computadores de uma empresa ainda precisa de internet. Para trabalhar totalmente offline, use um que rode no seu próprio computador.

## O que esperar

Seu primeiro tradutor provavelmente será como um guia de frases: bom com frases semelhantes àquelas com as quais aprendeu, e não muito além disso por enquanto. É aí que todo projeto começa. [O que ele ainda não consegue fazer](/docs/what-it-cant-do-yet) explica com clareza o que esperar, e [Como torná-lo melhor](/docs/make-it-better) mostra como ele evolui.

**A seguir:** [Traga o que você tiver →](/docs/bring-your-data)

## Aprofunde-se

- [Operando os trilhos via MCP](/docs/agents/mcp) — as seis ferramentas, o ciclo e a configuração detalhada por assistente.
- [Operando os trilhos pelo shell](/docs/agents/shell) — todos os comandos executados pelos trilhos.
- [O contrato de operação](/docs/agents/contract) — as regras que o seu assistente segue.
- [Quem pode usar isto](/docs/getting-started/who-may-use-this) — a licença.
