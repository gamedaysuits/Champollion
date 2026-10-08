---
title: Who may use this
description: The license of each Champollion package in plain words — who is covered and who is not. A summary, not legal advice; the license text governs.
related:
  - label: "Installation"
    to: /docs/getting-started/installation
    kind: guide
  - label: "Quick Start"
    to: /docs/getting-started/quick-start
    kind: guide
---

# Who may use this

Champollion's packages do not share one license. This page says, in plain words, who each one covers.

**This is a summary, not legal advice. The license text governs.** Each license is linked in the table below and ships with its package.

## The packages and their licenses

| Package | What it is | License |
|---|---|---|
| `champollion` (npm) | The CLI that translates your locale files | [PolyForm Noncommercial 1.0.0](https://github.com/gamedaysuits/Champollion/blob/main/cli/LICENSE) |
| `champollion-mcp-server` (npm) | The MCP server that gives AI agents these tools | [PolyForm Noncommercial 1.0.0](https://github.com/gamedaysuits/Champollion/blob/main/mcp-server/LICENSE) |
| `nmt-forge` | The model-training suite | [PolyForm Noncommercial 1.0.0](https://github.com/gamedaysuits/Champollion/blob/main/forge/LICENSE) |
| `mt-eval-harness` (PyPI; the `mt-eval` command) | The evaluation harness | [AGPL-3.0-or-later](https://github.com/gamedaysuits/Champollion/blob/main/arena/LICENSE), with a [plugin exception](https://github.com/gamedaysuits/Champollion/blob/main/arena/LICENSE-EXCEPTION.md) |
| `champollion-lyss` (PyPI) | The Plains Cree evaluation-standard plugin | Its own interim license: use by permission only ([on PyPI](https://pypi.org/project/champollion-lyss/)) |

The data registries (`shared/`) and the database migrations (`mt-eval-arena/`) in the [repository](https://github.com/gamedaysuits/Champollion) are Apache-2.0.

## The CLI, the MCP server and nmt-forge

These three are under the PolyForm Noncommercial License 1.0.0. You may use, change and share them for a **noncommercial purpose**. The license names those purposes itself. Two of its clauses decide most cases:

> **Personal Uses.** Personal use for research, experiment, and testing for the benefit of public knowledge, personal study, private entertainment, hobby projects, amateur pursuits, or religious observance, without any anticipated commercial application, is use for a permitted purpose.

> **Noncommercial Organizations.** Use by any charitable organization, educational institution, public research organization, public safety or health organization, environmental protection organization, or government institution is use for a permitted purpose regardless of the source of funding or obligations resulting from the funding.

For an organization of one of those kinds, how it is funded does not change the answer: the clause says "regardless of the source of funding".

| Who | Covered? | Why |
|---|---|---|
| A school translating its app or its newsletter | ✓ Yes | An educational institution |
| A public hospital or a public health clinic translating patient instructions | ✓ Yes | A public safety or health organization |
| A charity translating its website | ✓ Yes | A charitable organization |
| A government office, or a public research institute | ✓ Yes | A government institution, or a public research organization |
| You, on a personal or research project with no commercial application in view | ✓ Yes | Personal use for research, experiment, testing, private study or a hobby |
| A shop translating its storefront | ✗ No | A for-profit business's product is commercial use |
| A for-profit private clinic translating its patient portal | ✗ No | A for-profit business's product is commercial use. It is not a public health organization |

A commercial purpose is not covered: this license gives no permission for it.

## The evaluation harness (`mt-eval-harness`)

The harness is open source under the GNU Affero General Public License, version 3 or later (AGPL-3.0-or-later). The AGPL allows commercial use, on its own terms. The main ones:

- If you distribute the harness, changed or not, you do so under the same license, with its source.
- If you change the harness and let people use it over a network, you must offer those people the source of your changed version (section 13, "Remote Network Interaction").

A separate permission ([LICENSE-EXCEPTION.md](https://github.com/gamedaysuits/Champollion/blob/main/arena/LICENSE-EXCEPTION.md), under AGPL section 7) lets evaluation-standard plugins under other licenses work with the harness through its public plugin interface. It does not change the harness's own license.

## The Plains Cree plugin (`champollion-lyss`)

`champollion-lyss` has its own interim license: it may be used only with written permission. Permission is ordinarily granted without charge for noncommercial research, education and community-benefit use. No commercial use is permitted. It is an interim license, meant to be replaced by terms set through community governance. The license text and its NOTICE ship with the package.

## What these licenses do not cover

The translation services, models and corpora you use through these tools keep their own terms: a provider's API terms, a model's license, a corpus's license. The harness records each corpus's license and applies its rules on which model services may see it, but those terms are set by their owners, not by the licenses on this page.

## The license texts

- [PolyForm Noncommercial License 1.0.0](https://github.com/gamedaysuits/Champollion/blob/main/cli/LICENSE) (also at [polyformproject.org](https://polyformproject.org/licenses/noncommercial/1.0.0)): the CLI, and the same text for the [MCP server](https://github.com/gamedaysuits/Champollion/blob/main/mcp-server/LICENSE) and [nmt-forge](https://github.com/gamedaysuits/Champollion/blob/main/forge/LICENSE)
- [GNU AGPL-3.0](https://github.com/gamedaysuits/Champollion/blob/main/arena/LICENSE) and its [plugin exception](https://github.com/gamedaysuits/Champollion/blob/main/arena/LICENSE-EXCEPTION.md): the harness
- [champollion-lyss](https://pypi.org/project/champollion-lyss/): its interim license and NOTICE ship in the package

This page is a summary, not legal advice. Where it and a license text differ, the license text governs.
