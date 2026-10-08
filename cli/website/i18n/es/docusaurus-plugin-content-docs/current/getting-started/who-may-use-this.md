---
title: "Quién puede usar esto"
description: "La licencia de cada paquete de Champollion en términos sencillos —a quién cubre y a quién no. Un resumen, no asesoría legal; prevalece el texto de la licencia."
related:
  - label: "Installation"
    to: /docs/getting-started/installation
    kind: guide
  - label: "Quick Start"
    to: /docs/getting-started/quick-start
    kind: guide
---

# Quién puede usar esto

Los paquetes de Champollion no comparten una única licencia. Esta página explica, en términos sencillos, a quién cubre cada uno.

**Esto es un resumen, no asesoramiento legal. El texto de la licencia prevalece.** Cada licencia está enlazada en la tabla a continuación y se incluye con su respectivo paquete.

## Los paquetes y sus licencias

| Paquete | Qué es | Licencia |
|---|---|---|
| `champollion` (npm) | La CLI que traduce sus archivos de configuración regional | [PolyForm Noncommercial 1.0.0](https://github.com/gamedaysuits/Champollion/blob/main/cli/LICENSE) |
| `champollion-mcp-server` (npm) | El servidor MCP que proporciona estas herramientas a agentes de IA | [PolyForm Noncommercial 1.0.0](https://github.com/gamedaysuits/Champollion/blob/main/mcp-server/LICENSE) |
| `nmt-forge` | El conjunto de herramientas para entrenamiento de modelos | [PolyForm Noncommercial 1.0.0](https://github.com/gamedaysuits/Champollion/blob/main/forge/LICENSE) |
| `mt-eval-harness` (PyPI; el comando `mt-eval`) | El entorno de evaluación | [AGPL-3.0-or-later](https://github.com/gamedaysuits/Champollion/blob/main/arena/LICENSE), con una [excepción para complementos](https://github.com/gamedaysuits/Champollion/blob/main/arena/LICENSE-EXCEPTION.md) |
| `champollion-lyss` (PyPI) | El complemento de estándar de evaluación para cree de las llanuras | Su propia licencia provisional: uso únicamente con autorización ([en PyPI](https://pypi.org/project/champollion-lyss/)) |

Los registros de datos (`shared/`) y las migraciones de la base de datos (`mt-eval-arena/`) en el [repositorio](https://github.com/gamedaysuits/Champollion) están bajo Apache-2.0.

## La CLI, el servidor MCP y nmt-forge

Estos tres están bajo la Licencia PolyForm Noncommercial 1.0.0. Usted puede usarlos, modificarlos y compartirlos para un **propósito no comercial**. La licencia define esos propósitos. Dos de sus cláusulas resuelven la mayoría de los casos:

> **Usos personales.** El uso personal para investigación, experimentación y pruebas en beneficio del conocimiento público, estudio personal, entretenimiento privado, proyectos de pasatiempo, actividades aficionadas o práctica religiosa, sin ninguna aplicación comercial prevista, es un uso para un propósito permitido.

> **Organizaciones no comerciales.** El uso por parte de cualquier organización benéfica, institución educativa, organización pública de investigación, organización de salud o seguridad pública, organización de protección ambiental o institución gubernamental es un uso para un propósito permitido, independientemente de la fuente de financiamiento o de las obligaciones derivadas de este.

Para una organización de alguno de esos tipos, la forma en que se financie no altera la respuesta: la cláusula establece "independientemente de la fuente de financiamiento".

| Quién | ¿Cubierto? | Por qué |
|---|---|---|
| Una escuela que traduce su aplicación o su boletín informativo | ✓ Sí | Una institución educativa |
| Un hospital público o una clínica de salud pública que traduce instrucciones para pacientes | ✓ Sí | Una organización de salud o seguridad pública |
| Una organización benéfica que traduce su sitio web | ✓ Sí | Una organización benéfica |
| Una oficina gubernamental o un instituto público de investigación | ✓ Sí | Una institución gubernamental o una organización pública de investigación |
| Usted, en un proyecto personal o de investigación sin ninguna aplicación comercial prevista | ✓ Sí | Uso personal para investigación, experimentación, pruebas, estudio privado o un pasatiempo |
| Una tienda que traduce su escaparate comercial | ✗ No | El producto de un negocio con fines de lucro constituye un uso comercial |
| Una clínica privada con fines de lucro que traduce su portal para pacientes | ✗ No | El producto de un negocio con fines de lucro constituye un uso comercial. No es una organización de salud pública |

Un propósito comercial no está cubierto: esta licencia no concede autorización para ello.

## El entorno de evaluación (`mt-eval-harness`)

El entorno de evaluación es de código abierto bajo la Licencia Pública General Affero de GNU, versión 3 o posterior (AGPL-3.0-or-later). La AGPL permite el uso comercial, bajo sus propios términos. Los principales son:

- Si usted distribuye el entorno, modificado o no, debe hacerlo bajo la misma licencia y junto con su código fuente.
- Si usted modifica el entorno y permite que otras personas lo utilicen a través de una red, debe poner a disposición de esas personas el código fuente de su versión modificada (sección 13, "Interacción remota a través de una red").

Una autorización independiente ([LICENSE-EXCEPTION.md](https://github.com/gamedaysuits/Champollion/blob/main/arena/LICENSE-EXCEPTION.md), bajo la sección 7 de la AGPL) permite que los complementos de estándares de evaluación bajo otras licencias funcionen con el entorno a través de su interfaz pública de complementos. Esto no modifica la propia licencia del entorno.

## El complemento para cree de las llanuras (`champollion-lyss`)

`champollion-lyss` tiene su propia licencia provisional: solo puede utilizarse con autorización por escrito. Por lo general, la autorización se concede de forma gratuita para investigación no comercial, educación y uso en beneficio de la comunidad. No se permite ningún uso comercial. Es una licencia provisional, pensada para ser reemplazada por términos definidos mediante la gobernanza comunitaria. El texto de la licencia y su aviso NOTICE se incluyen con el paquete.

## Qué no cubren estas licencias

Los servicios de traducción, modelos y corpus que usted utilice a través de estas herramientas conservan sus propios términos: los términos de la API de un proveedor, la licencia de un modelo o la licencia de un corpus. El entorno registra la licencia de cada corpus y aplica sus reglas sobre qué servicios de modelos pueden acceder a él, pero dichos términos los establecen sus propietarios, no las licencias descritas en esta página.

## Los textos de las licencias

- [PolyForm Noncommercial License 1.0.0](https://github.com/gamedaysuits/Champollion/blob/main/cli/LICENSE) (también en [polyformproject.org](https://polyformproject.org/licenses/noncommercial/1.0.0)): la CLI, y el mismo texto para el [servidor MCP](https://github.com/gamedaysuits/Champollion/blob/main/mcp-server/LICENSE) y [nmt-forge](https://github.com/gamedaysuits/Champollion/blob/main/forge/LICENSE)
- [GNU AGPL-3.0](https://github.com/gamedaysuits/Champollion/blob/main/arena/LICENSE) y su [excepción para complementos](https://github.com/gamedaysuits/Champollion/blob/main/arena/LICENSE-EXCEPTION.md): el entorno de evaluación
- [champollion-lyss](https://pypi.org/project/champollion-lyss/): su licencia provisional y NOTICE se incluyen en el paquete

Esta página es un resumen, no asesoramiento legal. En caso de discrepancia entre esta página y el texto de una licencia, el texto de la licencia prevalece.
