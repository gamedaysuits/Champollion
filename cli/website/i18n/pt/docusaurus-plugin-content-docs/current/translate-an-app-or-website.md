---
title: "Traduza um aplicativo ou site"
slug: /translate-an-app-or-website
description: "Traduza as palavras das telas de um aplicativo ou site para o seu idioma, mantenha-as atualizadas conforme o original muda e escolha qual tradutor cuida de cada idioma."
---

# Traduzir um aplicativo ou site

Aplicativos e sites guardam suas palavras — botões, menus, mensagens, páginas — em
arquivos, um para cada idioma. O Champollion pode preencher o arquivo do seu idioma
para você e mantê-lo atualizado sempre que o original mudar. Um único comando faz
isso:

```bash
npx champollion sync
```

Ele encontra os arquivos de idioma do seu aplicativo, traduz apenas o que estiver faltando ou
alterado, verifica cada tradução antes de gravá-la e não mexe no restante.

## Quem faz a tradução

Você escolhe, para cada idioma:

- **Seu próprio tradutor**, construído sobre os trilhos — as ferramentas o conectam ao seu
  aplicativo. Se ele aprendeu com frases privadas, ele se conecta apenas depois que você
  indicar quem, entre as pessoas que guardam as palavras, concordou.
- **Um modelo de IA ou serviço de tradução** — para idiomas que eles já
  atendem bem. Esses serviços enviam as palavras do seu aplicativo para a empresa que os opera;
  portanto, use-os para textos que não tenham problema compartilhar.
- **Seu próprio serviço**, em um endereço fornecido por você.

## Do que ele cuida

- **Apenas o que mudou.** Ele se lembra do que já traduziu antes, para você nunca
  pagar duas vezes pela mesma frase.
- **Verificações antes de gravar.** Respostas vazias, o texto original copiado de volta, palavras
  se repetindo em loop, texto muito mais longo do que deveria, partes faltando ou
  o alfabeto incorreto são detectados e recusados. Essas verificações pegam saídas corrompidas,
  não sentidos incorretos — quem fala o idioma ainda tem a palavra final.
- **Seus arquivos, seu formato.** JSON, YAML, TOML e páginas em Markdown, além dos
  frameworks comuns de aplicativos e sites.

## Quem pode usar

Gratuito para uso não comercial — o aplicativo de uma escola, o site de uma comunidade, um serviço
público. O produto de uma empresa não é coberto pela licença gratuita; se uma comunidade de
falantes quiser usá-lo comercialmente, basta pedir, e a licença é gratuita.
[Quem pode usar](/docs/getting-started/who-may-use-this) traz os detalhes.

**A seguir:** [Hospedar um teste selado →](/docs/host-a-sealed-test)

## Aprofunde-se

- [Tradução de aplicativos e sites](/docs/intro) — a referência completa: início rápido,
  configuração, frameworks, memória de tradução, verificações de qualidade, CI.
- [Disponibilização e implantação](/docs/agents/serving) — conectando seu próprio
  tradutor.
