---
title: "누가 사용할 수 있나요"
description: "각 Champollion 패키지의 라이선스를 알기 쉽게 설명해요 — 적용 대상과 제외 대상을 안내합니다. 이는 법적 조언이 아닌 요약본이며, 라이선스 전문이 우선 적용돼요."
related:
  - label: "Installation"
    to: /docs/getting-started/installation
    kind: guide
  - label: "Quick Start"
    to: /docs/getting-started/quick-start
    kind: guide
---

# 이용 대상 안내

Champollion의 패키지들은 모두 동일한 라이선스를 공유하지 않아요. 이 페이지에서는 각 패키지가 누구에게 적용되는지 알기 쉽게 설명해요.

**본 문서는 요약본이며, 법률 자문이 아니에요. 법적 효력은 라이선스 원문에 있어요.** 각 라이선스는 아래 표에 링크되어 있으며 각 패키지와 함께 제공돼요.

## 패키지 및 라이선스 목록

| 패키지 | 설명 | 라이선스 |
|---|---|---|
| `champollion` (npm) | 로케일 파일을 번역하는 CLI | [PolyForm Noncommercial 1.0.0](https://github.com/gamedaysuits/Champollion/blob/main/cli/LICENSE) |
| `champollion-mcp-server` (npm) | AI 에이전트에 관련 도구를 제공하는 MCP 서버 | [PolyForm Noncommercial 1.0.0](https://github.com/gamedaysuits/Champollion/blob/main/mcp-server/LICENSE) |
| `nmt-forge` | 모델 훈련 스위트 | [PolyForm Noncommercial 1.0.0](https://github.com/gamedaysuits/Champollion/blob/main/forge/LICENSE) |
| `mt-eval-harness` (PyPI, `mt-eval` 명령어) | 평가 하네스 | [플러그인 예외 조항](https://github.com/gamedaysuits/Champollion/blob/main/arena/LICENSE-EXCEPTION.md)이 포함된 [AGPL-3.0-or-later](https://github.com/gamedaysuits/Champollion/blob/main/arena/LICENSE) |
| `champollion-lyss` (PyPI) | 평원 크리어(Plains Cree) 평가 표준 플러그인 | 자체 임시 라이선스: 사전 승인 시에만 사용 가능([PyPI에서 확인](https://pypi.org/project/champollion-lyss/)) |

[저장소](https://github.com/gamedaysuits/Champollion) 내의 데이터 레지스트리(`shared/`)와 데이터베이스 마이그레이션(`mt-eval-arena/`)은 Apache-2.0 라이선스를 따라요.

## CLI, MCP 서버 및 nmt-forge

이 세 패키지는 PolyForm Noncommercial License 1.0.0을 따라요. **비영리 목적**에 한해 패키지를 사용, 수정 및 공유할 수 있어요. 라이선스 본문에서 이러한 목적을 직접 명시하고 있으며, 대부분의 경우는 다음 두 가지 조항에 따라 결정돼요.

> **개인적 사용(Personal Uses).** 상업적 적용을 계획하지 않고 공공 지식을 증진하기 위한 연구, 실험 및 테스트나 개인적인 학업, 사적 여가, 취미 프로젝트, 아마추어 활동 또는 종교 의식을 위한 개인적 사용은 허용된 목적의 사용이에요.

> **비영리 단체(Noncommercial Organizations).** 자선 단체, 교육 기관, 공공 연구 기관, 공공 안전 또는 보건 기구, 환경 보호 단체, 정부 기관에 의한 사용은 자금의 출처나 자금에 따른 의무와 관계없이 허용된 목적의 사용이에요.

이러한 유형의 단체라면 자금 조달 방식은 사용 여부에 영향을 주지 않아요. 조항에 "자금의 출처와 관계없이(regardless of the source of funding)"라고 명시되어 있기 때문이에요.

| 대상 | 허용 여부 | 사유 |
|---|---|---|
| 앱이나 뉴스레터를 번역하는 학교 | ✓ 허용 | 교육 기관에 해당 |
| 환자 안내문을 번역하는 국공립 병원 또는 공공 보건소 | ✓ 허용 | 공공 안전 또는 보건 기구에 해당 |
| 웹사이트를 번역하는 자선 단체 | ✓ 허용 | 자선 단체에 해당 |
| 정부 기관 또는 공공 연구 기관 | ✓ 허용 | 정부 기관 또는 공공 연구 기관에 해당 |
| 상업적 적용 계획이 없는 개인 또는 연구 프로젝트를 진행하는 개인 | ✓ 허용 | 연구, 실험, 테스트, 개인적 학업 또는 취미를 위한 개인적 사용에 해당 |
| 상점 웹사이트(storefront)를 번역하는 상점 | ✗ 불가 | 영리 기업의 제품은 상업적 사용에 해당 |
| 환자 포털을 번역하는 영리 목적의 개인 클리닉 | ✗ 불가 | 영리 기업의 제품은 상업적 사용에 해당하며, 공공 보건 기구에 해당하지 않음 |

상업적 목적은 허용 대상에 포함되지 않아요. 이 라이선스는 상업적 사용에 대한 권한을 부여하지 않아요.

## 평가 하네스(`mt-eval-harness`)

이 하네스는 GNU Affero General Public License 버전 3 이상(AGPL-3.0-or-later)을 따르는 오픈 소스예요. AGPL은 자체 조건에 따라 상업적 사용을 허용해요. 주요 조건은 다음과 같아요.

- 하네스를 수정 여부와 관계없이 배포하는 경우, 소스 코드와 함께 동일한 라이선스로 배포해야 해요.
- 하네스를 수정한 후 네트워크를 통해 다른 사람이 사용하도록 하는 경우, 해당 사용자에게 수정된 버전의 소스 코드를 제공해야 해요(제13조 "원격 네트워크 상호작용").

별도의 허용 조항(AGPL 제7조에 근거한 [LICENSE-EXCEPTION.md](https://github.com/gamedaysuits/Champollion/blob/main/arena/LICENSE-EXCEPTION.md))을 통해, 다른 라이선스를 따르는 평가 표준 플러그인도 공개 플러그인 인터페이스를 거쳐 이 하네스와 함께 동작할 수 있어요. 이는 하네스 자체의 라이선스를 변경하지는 않아요.

## 평원 크리어(Plains Cree) 플러그인(`champollion-lyss`)

`champollion-lyss`은 자체 임시 라이선스를 따르며, 서면 승인을 받은 경우에만 사용할 수 있어요. 비영리 연구, 교육 및 커뮤니티 이익을 위한 사용에는 통상적으로 무료로 승인이 제공돼요. 상업적 사용은 허용되지 않아요. 이 라이선스는 임시 라이선스이며, 향후 커뮤니티 거버넌스를 통해 수립된 조항으로 대체될 예정이에요. 라이선스 전문과 NOTICE 파일은 패키지와 함께 제공돼요.

## 본 라이선스가 적용되지 않는 항목

이 도구들을 통해 사용하는 번역 서비스, 모델 및 코퍼스(말뭉치)는 각자의 자체 이용약관을 그대로 유지해요. 제공자의 API 이용약관, 모델 라이선스, 코퍼스 라이선스가 이에 해당해요. 하네스는 각 코퍼스의 라이선스를 기록하고 어떤 모델 서비스가 해당 코퍼스를 볼 수 있는지에 대한 규칙을 적용하지만, 이러한 조건은 이 페이지의 라이선스가 아닌 각 소유자가 설정한 것이에요.

## 라이선스 전문

- [PolyForm Noncommercial License 1.0.0](https://github.com/gamedaysuits/Champollion/blob/main/cli/LICENSE)([polyformproject.org](https://polyformproject.org/licenses/noncommercial/1.0.0)에서도 확인 가능): CLI에 적용되며, [MCP 서버](https://github.com/gamedaysuits/Champollion/blob/main/mcp-server/LICENSE) 및 [nmt-forge](https://github.com/gamedaysuits/Champollion/blob/main/forge/LICENSE)에도 동일한 전문이 적용돼요.
- [GNU AGPL-3.0](https://github.com/gamedaysuits/Champollion/blob/main/arena/LICENSE) 및 [플러그인 예외 조항](https://github.com/gamedaysuits/Champollion/blob/main/arena/LICENSE-EXCEPTION.md): 평가 하네스에 적용돼요.
- [champollion-lyss](https://pypi.org/project/champollion-lyss/): 임시 라이선스 및 NOTICE 파일이 패키지에 포함되어 있어요.

본 문서는 요약본이며, 법률 자문이 아니에요. 본 문서의 내용과 라이선스 원문이 상충하는 경우 라이선스 원문이 우선해요.
