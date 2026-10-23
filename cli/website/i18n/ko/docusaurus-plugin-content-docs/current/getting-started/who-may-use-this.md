---
title: "누가 이용할 수 있고, 비용은 얼마인가요"
description: "가족, 학교, 자선 단체, 공공 서비스에는 무료예요. 화자 커뮤니티에는 요청 시 상업용 라이선스도 무료로 제공돼요. 각 패키지의 라이선스를 알기 쉬운 말로 정리했어요 — 법적 조언이 아닌 요약본이며, 라이선스 본문 내용이 우선해요."
related:
  - label: "Installation"
    to: /docs/getting-started/installation
    kind: guide
  - label: "Quick Start"
    to: /docs/getting-started/quick-start
    kind: guide
---

# 누가 이용할 수 있고, 비용은 얼마인가요

**요약하자면:**

- 가족, 학교, 자선단체, 병원 같은 공공 서비스, 정부 기관 자체 업무, 개인이나 연구 프로젝트에는 **무료**예요.
- **상업적 이용** — 언어 앱, 유료 서비스 등 — 은 무료 라이선스 적용 대상이 아니에요. **화자 공동체에서 이 도구를 상업적으로 이용하고 싶다면 문의해 주세요. 라이선스를 무료로 제공해 드려요.**
  [라이선스 요청하기](mailto:info@champollion.dev?subject=Commercial%20licence%20request).
- **수익을 나누지 않아요.** Champollion은 공동체가 고유 언어를 통해 얻은 수익에서 어떤 몫도 가져가지 않아요. 후원자가 프로젝트를 지원하더라도 지원금은 공동체에 온전히 전달돼요.
- **도움 요청은 선택사항이에요.** 프로젝트에 도움이 필요하다면 [함께 이야기를 나눠봐요](/docs/getting-help). 조건은 각 공동체와 맞추어 정해지며, 정해진 가격표는 없어요. 프로젝트를 끝마치기 위해 꼭 저희가 필요한 것은 아니에요.

대부분의 분들에게는 이것만으로 충분해요. 이 페이지의 나머지 내용은 법률 검토자와 개발자를 위한 세부 사항이에요. Champollion의 패키지들은 라이선스가 하나로 통일되어 있지 않아서, 각 라이선스의 적용 대상을 쉬운 말로 설명해 드릴게요.

**본 문서는 요약본이며, 법률 자문이 아니에요. 법적 효력은 라이선스 원문에 있어요.** 각 라이선스는 아래 표에 링크되어 있으며 각 패키지와 함께 제공돼요.

## 패키지 및 라이선스 목록

| 패키지 | 역할 | 라이선스 |
|---|---|---|
| `champollion` (npm) | 프로젝트 도구: 레일 환경 및 앱과 사이트 파일 번역 | [PolyForm Noncommercial 1.0.0](https://github.com/gamedaysuits/Champollion/blob/main/cli/LICENSE) |
| `champollion-mcp-server` (npm) | AI 에이전트에 이 도구들을 제공하는 MCP 서버 | [PolyForm Noncommercial 1.0.0](https://github.com/gamedaysuits/Champollion/blob/main/mcp-server/LICENSE) |
| `nmt-forge` | 모델 훈련 도구 모음 | [PolyForm Noncommercial 1.0.0](https://github.com/gamedaysuits/Champollion/blob/main/forge/LICENSE) |
| `mt-eval-harness` (PyPI; `mt-eval` 명령어) | 평가 하네스 | [AGPL-3.0-or-later](https://github.com/gamedaysuits/Champollion/blob/main/arena/LICENSE) ([플러그인 예외 조항](https://github.com/gamedaysuits/Champollion/blob/main/arena/LICENSE-EXCEPTION.md) 포함) |
| `champollion-lyss` (PyPI) | Plains Cree 평가 기준 플러그인 | 자체 임시 라이선스: 허가를 받은 경우에만 사용 가능([PyPI에서 확인](https://pypi.org/project/champollion-lyss/)) |

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

상업적 용도는 적용되지 않으며, 이 라이선스는 상업적 이용을 허용하지 않아요.
화자 공동체에서 이 도구들을 상업적으로 이용하고 싶다면 상업용 라이선스를 요청할 수 있으며, 화자 공동체에는 해당 라이선스가 무료로 제공돼요:
[라이선스 요청하기](mailto:info@champollion.dev?subject=Commercial%20licence%20request).

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
