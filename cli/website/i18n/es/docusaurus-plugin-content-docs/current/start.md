---
title: "Iniciar un proyecto"
slug: /start
description: "Comience a crear un traductor para su idioma — con un asistente de IA en su computadora, o escribiendo cuatro comandos por su cuenta."
---

# Iniciar un proyecto

Hay dos formas de comenzar. De cualquier manera, las herramientas funcionan en su propia computadora
y lo guiarán paso a paso.

## Con un asistente de IA

Esta es la forma más fácil. Su asistente escribe; usted responde las
preguntas que le corresponde responder.

**Lo que necesita:** un asistente de IA que funcione como una aplicación en su computadora —no
solo como una aplicación de celular— y que pueda usar herramientas allí.

### 1. Añada los rieles a su asistente

Copie la breve configuración que aparece abajo, péguela en su asistente y dígale:
*“Por favor, configure esto por mí.”* Muchos asistentes pueden hacerlo. Si el suyo no puede, pídale a
alguien que sepa de computadoras que lo haga una vez; los pasos están justo abajo.

```json
{
  "mcpServers": {
    "champollion": { "command": "npx", "args": ["-y", "champollion-mcp-server"] }
  }
}
```

<details>
<summary>Configurarlo a mano</summary>

Los asistentes se conectan a las herramientas mediante un estándar común llamado MCP; la configuración
anterior le indica al suyo cómo iniciar los rieles. Su computadora también necesita Node.js
20.11 o posterior, un programa gratuito.

- **Aplicación de escritorio de Claude:** Settings → Developer → Edit Config. Añada la
  configuración a ese archivo, guárdelo y reinicie la aplicación.
- **Claude Code:** ejecute esto una vez en una terminal:
  `claude mcp add champollion -- npx -y champollion-mcp-server`
- **Cursor:** añada la configuración al archivo `mcp.json` en la carpeta
  `.cursor` de su proyecto, o en la carpeta `.cursor` de su carpeta de inicio.

</details>

### 2. Dígaselo con sus propias palabras

Algo como:

> *Queremos crear un traductor del inglés a nuestro idioma; usa
> champollion.*

### 3. Responda lo que pregunte

Primero, le confirmará la dirección: *“ingresas inglés y sale tu
idioma. ¿Es así como lo quieres?”* —porque equivocarse en el orden es un
error fácil de cometer. Luego crea una carpeta para el proyecto y le pide sus
archivos.

A partir de ahí, le preguntará cada vez que una decisión sea suya: a quién le pertenecen sus palabras,
si un traductor puede aprender de ellas, si se debe instalar algo. Responda
por usted mismo. Si aún no lo sabe, dígalo; los rieles pueden esperar. Y *ahora
no* siempre es una respuesta válida: los rieles no volverán a preguntar en esa sesión.

**Algo que debe saber primero.** La mayoría de los asistentes envían lo que leen a la empresa
que los opera. En el caso de los archivos guardados en esta computadora, las herramientas solo le dicen al suyo
*cuántas* oraciones tiene, nunca las oraciones en sí; pero un asistente que puede
usar su computadora puede abrir cualquier archivo que usted pueda abrir. Para las palabras que desee mantener privadas,
pídale que no lo haga, o use un asistente que funcione en su propia computadora. [Sus palabras, sus reglas](/docs/your-words-your-rules) lo explica.

## Por su cuenta

Si se siente cómodo escribiendo comandos, son cuatro líneas. Instale la
herramienta del proyecto (necesita Node.js 20.11 o posterior), inicie un proyecto y pregunte qué sigue:

```bash
npm install -g champollion
champollion new family --from English --to qaa --target-name "Our language"
cd family
champollion next
```

`qaa` significa “un idioma sin código todavía”; funciona bien, solo que las herramientas
no completarán datos como su alfabeto por usted. El nombre entre comillas es como
usted lo llamará. Si su idioma tiene un código, o un nombre que las herramientas conozcan,
use ese en su lugar. Si un nombre pudiera referirse a más de un idioma, pregunte a sus
hablantes cuál hablan antes de elegir un código; hasta que lo digan, `qaa`
funciona, pero no tiene una ficha de idioma, por lo que ninguna regla de plural o sistema de escritura provendrá de ella.

A partir de ahí, `champollion next` siempre indica el siguiente paso y el
comando exacto para realizarlo. Cuando llegue el momento de entrenar a un traductor, los rieles preguntan antes
de instalar las herramientas de entrenamiento.

## Trabajar sin internet

Manténgase en línea durante la instalación y su primer entrenamiento: las herramientas de entrenamiento
y el traductor más potente (alrededor de 1.2 GB) se descargan en ese momento. Después de eso, el
trabajo se realiza en su computadora. Para detener las consultas propias de las herramientas —estas pueden buscar la ficha
de información pública de un idioma, enviando únicamente el código del idioma—, configure esto en su
terminal y en la configuración de su asistente:

```bash
export CHAMPOLLION_OFFLINE=1
```

Un asistente de IA que funcione en las computadoras de una empresa seguirá necesitando internet.
Para trabajar completamente sin conexión, use uno que funcione en su propia computadora.

## Qué esperar

Es probable que su primer traductor sea como una guía de frases: bueno con oraciones parecidas a
aquellas con las que aprendió, y no mucho más por ahora. Ahí es donde comienza cada
proyecto. [Lo que aún no puede hacer](/docs/what-it-cant-do-yet) explica con claridad qué
esperar, y [Mejórelo](/docs/make-it-better) muestra cómo va creciendo.

**Siguiente:** [Traiga lo que tenga →](/docs/bring-your-data)

## Para profundizar

- [Dirigir los rieles mediante MCP](/docs/agents/mcp) — las seis herramientas, el ciclo
  y la configuración detallada por asistente.
- [Dirigir los rieles desde la terminal](/docs/agents/shell) — cada comando que
  ejecutan los rieles.
- [El contrato operativo](/docs/agents/contract) — las reglas que sigue
  su asistente.
- [Quiénes pueden usar esto](/docs/getting-started/who-may-use-this) — la licencia.
