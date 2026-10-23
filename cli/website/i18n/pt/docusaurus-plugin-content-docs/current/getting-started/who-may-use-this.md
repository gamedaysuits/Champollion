---
title: "Quem pode usar e quanto custa"
description: "Gratuito para famílias, escolas, instituições de caridade e serviços públicos; licenças comerciais gratuitas para comunidades de falantes mediante solicitação. A licença de cada pacote em palavras simples — um resumo, não aconselhamento jurídico; o texto da licença é o que prevalece."
related:
  - label: "Installation"
    to: /docs/getting-started/installation
    kind: guide
  - label: "Quick Start"
    to: /docs/getting-started/quick-start
    kind: guide
---

# Quem pode usar e quanto custa

**Em resumo:**

- **Gratuito** para famílias, escolas, instituições de caridade, serviços públicos como hospitais,
  órgãos governamentais e projetos pessoais ou de pesquisa.
- **Uso comercial** — um aplicativo de idiomas, um serviço pago — não é coberto pela
  licença gratuita. **Se a sua comunidade de falantes quiser usar as ferramentas
  comercialmente, basta pedir, e a licença é gratuita.**
  [Solicitar uma licença](mailto:info@champollion.dev?subject=Commercial%20licence%20request).
- **Sem participação nos ganhos.** O Champollion não fica com nenhuma parte do que uma comunidade ganha com
  seu próprio idioma. Se um patrocinador financiar o trabalho, o dinheiro é repassado diretamente.
- **A ajuda é opcional.** Se você quiser que pessoas ajudem no seu projeto, [vamos
  conversar](/docs/getting-help) — os termos são combinados com cada comunidade, e
  não existe uma tabela de preços. Você nunca depende de nós para concluir.

Isso é tudo o que a maioria das pessoas precisa saber. O restante desta página traz os detalhes para advogados e desenvolvedores: os pacotes do Champollion não têm uma única licença em comum, e esta página explica, em palavras simples, quem cada uma cobre.

**Este é um resumo, não uma consultoria jurídica. O texto da licença é o que prevalece.** O link para cada licença está disponível na tabela abaixo e cada uma é fornecida junto ao seu respectivo pacote.

## Os pacotes e suas licenças

| Pacote | O que é | Licença |
|---|---|---|
| `champollion` (npm) | A ferramenta do projeto: a estrutura e a tradução de arquivos de aplicativos e sites | [PolyForm Noncommercial 1.0.0](https://github.com/gamedaysuits/Champollion/blob/main/cli/LICENSE) |
| `champollion-mcp-server` (npm) | O servidor MCP que disponibiliza essas ferramentas para agentes de IA | [PolyForm Noncommercial 1.0.0](https://github.com/gamedaysuits/Champollion/blob/main/mcp-server/LICENSE) |
| `nmt-forge` | O conjunto de ferramentas de treinamento de modelos | [PolyForm Noncommercial 1.0.0](https://github.com/gamedaysuits/Champollion/blob/main/forge/LICENSE) |
| `mt-eval-harness` (PyPI; o comando `mt-eval`) | A estrutura de avaliação | [AGPL-3.0-or-later](https://github.com/gamedaysuits/Champollion/blob/main/arena/LICENSE), com uma [exceção para plugins](https://github.com/gamedaysuits/Champollion/blob/main/arena/LICENSE-EXCEPTION.md) |
| `champollion-lyss` (PyPI) | O plugin com o padrão de avaliação para cree das planícies | Licença própria provisória: uso apenas com permissão ([no PyPI](https://pypi.org/project/champollion-lyss/)) |

Os registros de dados (`shared/`) e as migrações de banco de dados (`mt-eval-arena/`) no [repositório](https://github.com/gamedaysuits/Champollion) estão sob a Apache-2.0.

## A CLI, o servidor MCP e o nmt-forge

Estes três estão sob a PolyForm Noncommercial License 1.0.0. Você pode usá-los, alterá-los e compartilhá-los para uma **finalidade não comercial**. A própria licença especifica essas finalidades. Duas de suas cláusulas definem a maioria dos casos:

> **Usos Pessoais.** O uso pessoal para pesquisa, experimentação e testes em benefício do conhecimento público, estudo pessoal, entretenimento privado, projetos por hobby, atividades amadoras ou prática religiosa, sem qualquer aplicação comercial prevista, constitui uso para uma finalidade permitida.

> **Organizações Não Comerciais.** O uso por qualquer organização de caridade, instituição de ensino, organização pública de pesquisa, organização de segurança pública ou de saúde, organização de proteção ambiental ou instituição governamental constitui uso para uma finalidade permitida, independentemente da fonte de financiamento ou das obrigações decorrentes desse financiamento.

Para uma organização enquadrada em uma dessas categorias, a forma como ela é financiada não altera a resposta: a cláusula diz explicitamente "independentemente da fonte de financiamento".

| Quem | Coberto? | Motivo |
|---|---|---|
| Uma escola traduzindo seu aplicativo ou boletim informativo | ✓ Sim | Uma instituição de ensino |
| Um hospital público ou uma clínica de saúde pública traduzindo instruções para pacientes | ✓ Sim | Uma organização de segurança pública ou de saúde |
| Uma organização beneficente traduzindo seu site | ✓ Sim | Uma organização de caridade |
| Um órgão governamental ou um instituto público de pesquisa | ✓ Sim | Uma instituição governamental ou organização pública de pesquisa |
| Você, em um projeto pessoal ou de pesquisa sem nenhuma aplicação comercial em vista | ✓ Sim | Uso pessoal para pesquisa, experimentação, testes, estudo privado ou hobby |
| Uma loja traduzindo sua vitrine virtual | ✗ Não | O produto de uma empresa com fins lucrativos constitui uso comercial |
| Uma clínica privada com fins lucrativos traduzindo seu portal de pacientes | ✗ Não | O produto de uma empresa com fins lucrativos constitui uso comercial. Ela não é uma organização pública de saúde |

O uso para fins comerciais não é coberto: esta licença não concede permissão para isso.
Se uma comunidade de falantes quiser usar essas ferramentas comercialmente, basta solicitar uma
licença comercial, e para uma comunidade de falantes essa licença é gratuita:
[solicite uma](mailto:info@champollion.dev?subject=Commercial%20licence%20request).

## O framework de avaliação (`mt-eval-harness`)

O framework de avaliação é código aberto sob a GNU Affero General Public License, versão 3 ou posterior (AGPL-3.0-or-later). A AGPL permite o uso comercial, segundo seus próprios termos. Os principais são:

- Se você distribuir o framework, modificado ou não, deverá fazê-lo sob a mesma licença, junto com o código-fonte.
- Se você modificar o framework e permitir que outras pessoas o usem por meio de uma rede, deverá disponibilizar a essas pessoas o código-fonte da sua versão modificada (seção 13, "Interação Remota em Rede").

Uma permissão separada ([LICENSE-EXCEPTION.md](https://github.com/gamedaysuits/Champollion/blob/main/arena/LICENSE-EXCEPTION.md), sob a seção 7 da AGPL) permite que plugins de padrões de avaliação sob outras licenças funcionem com o framework por meio de sua interface pública de plugins. Isso não altera a licença do próprio framework.

## O plugin para Cree das Planícies (`champollion-lyss`)

O `champollion-lyss` possui sua própria licença provisória: ele só pode ser utilizado com autorização por escrito. A permissão normalmente é concedida de forma gratuita para pesquisa não comercial, educação e iniciativas de benefício comunitário. Nenhum uso comercial é permitido. Trata-se de uma licença provisória, com o objetivo de ser substituída por termos definidos por meio de governança comunitária. O texto da licença e o arquivo NOTICE são fornecidos junto ao pacote.

## O que estas licenças não cobrem

Os serviços de tradução, modelos e corpora que você utiliza por meio dessas ferramentas mantêm seus próprios termos: termos de API de um provedor, licença de um modelo, licença de um corpus. O framework registra a licença de cada corpus e aplica suas regras sobre quais serviços de modelo podem visualizá-lo, mas esses termos são definidos pelos seus respectivos proprietários, e não pelas licenças apresentadas nesta página.

## Os textos das licenças

- [PolyForm Noncommercial License 1.0.0](https://github.com/gamedaysuits/Champollion/blob/main/cli/LICENSE) (também em [polyformproject.org](https://polyformproject.org/licenses/noncommercial/1.0.0)): a CLI, e o mesmo texto para o [servidor MCP](https://github.com/gamedaysuits/Champollion/blob/main/mcp-server/LICENSE) e o [nmt-forge](https://github.com/gamedaysuits/Champollion/blob/main/forge/LICENSE)
- [GNU AGPL-3.0](https://github.com/gamedaysuits/Champollion/blob/main/arena/LICENSE) e sua [exceção para plugins](https://github.com/gamedaysuits/Champollion/blob/main/arena/LICENSE-EXCEPTION.md): o framework de avaliação
- [champollion-lyss](https://pypi.org/project/champollion-lyss/): sua licença provisória e o arquivo NOTICE acompanham o pacote

Esta página é um resumo, não uma consultoria jurídica. Em caso de divergência entre esta página e o texto de uma licença, o texto da licença prevalece.
