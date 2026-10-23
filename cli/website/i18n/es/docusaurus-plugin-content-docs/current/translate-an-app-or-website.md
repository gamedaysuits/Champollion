---
title: "Traduzca una aplicación o un sitio web"
slug: /translate-an-app-or-website
description: "Traduzca a su idioma las palabras en las pantallas de una aplicación o un sitio web, manténgalas al día a medida que cambie el original y elija qué traductor se encarga de cada idioma."
---

# Traducir una aplicación o un sitio web

Las aplicaciones y los sitios web guardan sus palabras —botones, menús, mensajes, páginas— en
archivos, uno por idioma. Champollion puede completar el archivo de su idioma por
usted y mantenerlo al día cada vez que el original cambie. Un solo comando lo
hace:

```bash
npx champollion sync
```

Encuentra los archivos de idioma de su aplicación, traduce únicamente lo que falta o
ha cambiado, revisa cada traducción antes de escribirla y deja el resto
intacto.

## Qué traductor hace el trabajo

Usted elige, para cada idioma:

- **Su propio traductor**, construido sobre los rieles — las herramientas lo conectan con su
  aplicación. Si aprendió de oraciones privadas, se conecta únicamente una vez que usted haya
  indicado quiénes, de entre las personas que custodian las palabras, estuvieron de acuerdo.
- **Un modelo de IA o un servicio de traducción** — para idiomas que ya
  manejan bien. Estos envían las palabras de su aplicación a la empresa que los opera, así
  que úselos para textos que no haya problema en compartir.
- **Su propio servicio**, en una dirección que usted proporcione.

## De qué se encarga

- **Solo lo que cambió.** Recuerda lo que ya tradujo antes, para que nunca
  pague dos veces por la misma oración.
- **Revisiones antes de escribir.** Se detectan y rechazan respuestas vacías, el original copiado
  tal cual, palabras que se repiten en bucle, textos mucho más largos de lo debido, partes
  faltantes o un alfabeto incorrecto. Estas comprobaciones detectan resultados defectuosos,
  no significados incorrectos — una persona hablante siempre tiene la última palabra.
- **Sus archivos, su formato.** Páginas en JSON, YAML, TOML y Markdown, y los
  frameworks habituales de aplicaciones y sitios web.

## Quién puede usarlo

Gratis para uso no comercial — la aplicación de una escuela, el sitio web de una comunidad, un
servicio público. El producto de una empresa no está cubierto por la licencia gratuita; si una
comunidad de hablantes desea usarlo comercialmente, solo pídalo y la licencia es gratis.
[Quién puede usar esto](/docs/getting-started/who-may-use-this) tiene los detalles.

**Siguiente:** [Alojar una prueba sellada →](/docs/host-a-sealed-test)

## Para profundizar

- [Traducción de aplicaciones y sitios](/docs/intro) — la referencia completa: inicio rápido,
  configuración, frameworks, memoria de traducción, controles de calidad, CI.
- [Servicio y despliegue](/docs/agents/serving) — cómo conectar su propio
  traductor.
