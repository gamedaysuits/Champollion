---
title: "Quem pode usar"
description: "A licença de cada pacote do Champollion em termos simples — quem está coberto e quem não está. Um resumo, não uma orientação jurídica; o texto da licença prevalece."
related:
  - label: "Installation"
    to: /docs/getting-started/installation
    kind: guide
  - label: "Quick Start"
    to: /docs/getting-started/quick-start
    kind: guide
---

# Quem pode usar isto

Os pacotes do Champollion não compartilham uma única licença. Esta página explica, em linguagem simples, a quem cada um deles se aplica.

**Este é um resumo, não uma consultoria jurídica. O texto da licença é o que prevalece.** O link para cada licença está disponível na tabela abaixo e cada uma é fornecida junto ao seu respectivo pacote.

## Os pacotes e suas licenças

| Pacote | O que é | Licença |
|---|---|---|
| `champollion` (npm) | A CLI que traduz seus arquivos de localização | [PolyForm Noncommercial 1.0.0](https://github.com/gamedaysuits/Champollion/blob/main/cli/LICENSE) |
| `champollion-mcp-server` (npm) | O servidor MCP que fornece essas ferramentas para agentes de IA | [PolyForm Noncommercial 1.0.0](https://github.com/gamedaysuits/Champollion/blob/main/mcp-server/LICENSE) |
| `nmt-forge` | O pacote para treinamento de modelos | [PolyForm Noncommercial 1.0.0](https://github.com/gamedaysuits/Champollion/blob/main/forge/LICENSE) |
| `mt-eval-harness` (PyPI; o comando `mt-eval`) | O framework de avaliação | [AGPL-3.0-or-later](https://github.com/gamedaysuits/Champollion/blob/main/arena/LICENSE), com uma [exceção para plugins](https://github.com/gamedaysuits/Champollion/blob/main/arena/LICENSE-EXCEPTION.md) |
| `champollion-lyss` (PyPI) | O plugin de padrão de avaliação para Cree das Planícies | Sua própria licença provisória: uso apenas com permissão ([no PyPI](https://pypi.org/project/champollion-lyss/)) |

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

Uma finalidade comercial não está coberta: esta licença não concede permissão para isso.

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
