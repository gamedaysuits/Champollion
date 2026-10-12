---
title: "Qui peut l'utiliser"
description: "La licence de chaque paquet Champollion en termes simples — qui est couvert·e et qui ne l'est pas. Un résumé, sans valeur de conseil juridique ; seul le texte de la licence fait foi."
related:
  - label: "Installation"
    to: /docs/getting-started/installation
    kind: guide
  - label: "Quick Start"
    to: /docs/getting-started/quick-start
    kind: guide
---

# Qui peut l'utiliser

Les paquets de Champollion ne partagent pas tous la même licence. Cette page explique en termes clairs qui est couvert par chacune d'entre elles.

**Ceci est un résumé et ne constitue pas un avis juridique. Seul le texte de la licence fait foi.** Chaque licence est liée dans le tableau ci-dessous et est fournie avec son paquet.

## Les paquets et leurs licences

| Paquet | Description | Licence |
|---|---|---|
| `champollion` (npm) | Le CLI qui traduit vos fichiers de locale | [PolyForm Noncommercial 1.0.0](https://github.com/gamedaysuits/Champollion/blob/main/cli/LICENSE) |
| `champollion-mcp-server` (npm) | Le serveur MCP qui met ces outils à la disposition des agents IA | [PolyForm Noncommercial 1.0.0](https://github.com/gamedaysuits/Champollion/blob/main/mcp-server/LICENSE) |
| `nmt-forge` | La suite d'entraînement de modèles | [PolyForm Noncommercial 1.0.0](https://github.com/gamedaysuits/Champollion/blob/main/forge/LICENSE) |
| `mt-eval-harness` (PyPI ; la commande `mt-eval`) | Le banc d'évaluation | [AGPL-3.0-or-later](https://github.com/gamedaysuits/Champollion/blob/main/arena/LICENSE), avec une [exception relative aux plugins](https://github.com/gamedaysuits/Champollion/blob/main/arena/LICENSE-EXCEPTION.md) |
| `champollion-lyss` (PyPI) | Le plugin de référence d'évaluation pour le cri des plaines | Sa propre licence provisoire : utilisation sur autorisation uniquement ([sur PyPI](https://pypi.org/project/champollion-lyss/)) |

Les registres de données (`shared/`) et les migrations de base de données (`mt-eval-arena/`) dans le [dépôt](https://github.com/gamedaysuits/Champollion) sont sous licence Apache-2.0.

## Le CLI, le serveur MCP et nmt-forge

Ces trois composants sont sous la licence PolyForm Noncommercial License 1.0.0. Vous pouvez les utiliser, les modifier et les partager à des **fins non commerciales**. La licence définit elle-même ces fins. Deux de ses clauses s'appliquent à la majorité des cas :

> **Usages personnels.** L'usage personnel à des fins de recherche, d'expérimentation et d'évaluation au profit de la connaissance publique, d'étude personnelle, de divertissement privé, de projets de loisir, d'activités en amateur ou de pratique religieuse, sans aucune application commerciale envisagée, constitue un usage à des fins autorisées.

> **Organisations non commerciales.** L'utilisation par toute organisation caritative, établissement d'enseignement, organisme de recherche public, organisation de sécurité publique ou de santé publique, organisation de protection de l'environnement ou institution gouvernementale constitue un usage à des fins autorisées, indépendamment de la source de financement ou des obligations découlant de ce financement.

Pour une organisation relevant de l'une de ces catégories, son mode de financement ne modifie pas la réponse : la clause stipule « indépendamment de la source de financement ».

| Qui | Couvert ? | Pourquoi |
|---|---|---|
| Une école traduisant son application ou son bulletin d'information | ✓ Oui | Un établissement d'enseignement |
| Un hôpital public ou un centre de santé publique traduisant des instructions destinées aux patients | ✓ Oui | Une organisation de sécurité publique ou de santé publique |
| Une organisation caritative traduisant son site web | ✓ Oui | Une organisation caritative |
| Une administration publique ou un institut de recherche public | ✓ Oui | Une institution gouvernementale ou un organisme de recherche public |
| Vous, dans le cadre d'un projet personnel ou de recherche sans aucune application commerciale en vue | ✓ Oui | Usage personnel à des fins de recherche, d'expérimentation, d'évaluation, d'étude privée ou de loisir |
| Un commerce traduisant sa boutique en ligne | ✗ Non | Le produit d'une entreprise à but lucratif constitue un usage commercial |
| Une clinique privée à but lucratif traduisant son portail patient | ✗ Non | Le produit d'une entreprise à but lucratif constitue un usage commercial. Il ne s'agit pas d'une organisation de santé publique |

Les fins commerciales ne sont pas couvertes : cette licence n'accorde aucune autorisation en ce sens.

## Le banc d'évaluation (`mt-eval-harness`)

Le banc d'évaluation est open source sous la licence GNU Affero General Public License, version 3 ou ultérieure (AGPL-3.0-or-later). L'AGPL autorise l'usage commercial, selon ses propres conditions. Les principales sont :

- Si vous distribuez le banc d'évaluation, modifié ou non, vous devez le faire sous la même licence, avec son code source.
- Si vous modifiez le banc d'évaluation et permettez à des tiers de l'utiliser à travers un réseau, vous devez mettre à leur disposition le code source de votre version modifiée (section 13, « Remote Network Interaction »).

Une autorisation distincte ([LICENSE-EXCEPTION.md](https://github.com/gamedaysuits/Champollion/blob/main/arena/LICENSE-EXCEPTION.md), en vertu de la section 7 de l'AGPL) permet aux plugins de référence d'évaluation sous d'autres licences de fonctionner avec le banc d'évaluation par l'intermédiaire de son interface publique de plugin. Elle ne modifie pas la licence propre du banc d'évaluation.

## Le plugin pour le cri des plaines (`champollion-lyss`)

`champollion-lyss` dispose de sa propre licence provisoire : il ne peut être utilisé qu'avec une autorisation écrite. L'autorisation est généralement accordée à titre gracieux pour la recherche non commerciale, l'enseignement et les usages au bénéfice de la communauté. Aucun usage commercial n'est autorisé. Il s'agit d'une licence provisoire, destinée à être remplacée par des conditions définies dans le cadre d'une gouvernance communautaire. Le texte de la licence et son fichier NOTICE sont fournis avec le paquet.

## Ce que ces licences ne couvrent pas

Les services de traduction, les modèles et les corpus que vous utilisez par l'intermédiaire de ces outils conservent leurs propres conditions : les conditions d'utilisation de l'API d'un fournisseur, la licence d'un modèle ou la licence d'un corpus. Le banc d'évaluation enregistre la licence de chaque corpus et applique ses règles déterminant quels services de modèles sont autorisés à y accéder, mais ces conditions sont fixées par leurs propriétaires et non par les licences présentées sur cette page.

## Les textes des licences

- [PolyForm Noncommercial License 1.0.0](https://github.com/gamedaysuits/Champollion/blob/main/cli/LICENSE) (également disponible sur [polyformproject.org](https://polyformproject.org/licenses/noncommercial/1.0.0)) : le CLI, et le même texte pour le [serveur MCP](https://github.com/gamedaysuits/Champollion/blob/main/mcp-server/LICENSE) et [nmt-forge](https://github.com/gamedaysuits/Champollion/blob/main/forge/LICENSE)
- [GNU AGPL-3.0](https://github.com/gamedaysuits/Champollion/blob/main/arena/LICENSE) et son [exception relative aux plugins](https://github.com/gamedaysuits/Champollion/blob/main/arena/LICENSE-EXCEPTION.md) : le banc d'évaluation
- [champollion-lyss](https://pypi.org/project/champollion-lyss/) : sa licence provisoire et son fichier NOTICE sont fournis dans le paquet

Cette page est un résumé et ne constitue pas un avis juridique. En cas de divergence entre celle-ci et le texte d'une licence, le texte de la licence fait foi.
