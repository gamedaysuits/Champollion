---
sidebar_position: 0
title: "인덱스에 제출하기"
description: "데이터셋, 리소스, 방법, 인간 번역 서비스, 외부 결과를 제안하거나 언어 카드 수정을 제안해 주세요. 모든 제출 내용은 IP, 라이선스 및 주권 준수 여부를 사람이 직접 검토하며, 자동으로 승인되는 항목은 없어요."
related:
  - label: "Submit a Method"
    to: /docs/network/getting-started/submit-a-method
    kind: guide
    note: "Already have a benchmark run? Publish the run card instead."
  - label: "Registering Corpora"
    to: /docs/network/sovereignty/registering-corpora
    kind: guide
    note: "Exposure tiers for corpora you own"
  - label: "Data Sovereignty"
    to: /docs/network/sovereignty/data-sovereignty
    kind: doc
  - label: "Honest Limitations"
    to: /docs/network/honest-limitations
    kind: doc
---

# 인덱스에 제출하기

> **요약.** Champollion 인덱스에 제출할 항목을 제안하세요 — 벤치마크, 리소스, 번역 방법, 사람이 직접 하는 번역 서비스, 또는 외부에 게시된 결과 등을 제안할 수 있어요. 짧은 구조화된 양식을 작성하면(브라우저에서 또는 CLI에서) **관리자가 모든 제출을 직접 손으로 검토**하여 IP, 라이선스, 커뮤니티/주권 준수 여부를 확인한 후에야 항목이 추가돼요. **자동으로 승인되는 것은 없어요.**

인덱스는 공유된 지도예요. 방법이 벤치마킹되는 데이터셋, 도움이 되는 사전과 도구, 방법 자체, 직접 번역하는 사람들, 그리고 다른 사람들이 게시한 결과를 담고 있어요. 누구나 추가를 제안할 수 있어요. 이것은 언어 커뮤니티를 위한 인프라이기 때문에, 모든 제안은 먼저 사람의 검토 단계를 거쳐요.

---

## 제출할 수 있는 항목

| 유형 | 설명 | 추가되는 내용 |
|---|---|---|
| **벤치마크 / 데이터셋** | 평가 말뭉치 또는 벤치마크 | 메타데이터 카드 + *소스에서 가져오기(fetch-from-source)* 포인터 — 말뭉치 내용은 절대 포함하지 않아요 |
| **리소스** | 사전, 아카이브, 앱, FST(형태소 분석기) 또는 도구 | 포인터와 접근 권한 수준(공개 / 제한됨 / 동의 필요)이 포함된 목록 |
| **번역 방식** | 기계 번역(MT) 엔진, LLM 제공자 또는 파이프라인 | 실행 및 벤치마크 평가를 위한 방식 레지스트리(method-registry) 항목 |
| **인간 번역 서비스** | 자발적으로 참여한 커뮤니티 사무소, 에이전시 또는 개별 번역가 | 언어 쌍별 목록(연락처 정보는 비공개(out-of-band)로 유지되며, 공개 이슈에는 절대 기재하지 않아요) |
| **외부 발표 결과** | 다른 시스템이나 논문에서 보고된 점수 | **인용(citation)** — 외부 결과는 인용만 되며, 자체 측정한 결과로 다시 호스팅하거나 순위를 다시 매기지 않아요 |
| **언어 카드 수정** | [언어 카드](/catalogue)의 내용 중 화자 수 추정치, 현황, 문자 체계, 미등록 리소스 등 잘못되었거나 오래되었거나 누락된 항목 | **데이터 소스에 적용되는 인용된 수정 사항**(카드는 자동 생성되므로 수정 사항이 그대로 유지돼요). 출처 간 내용이 다를 경우, 출처를 명시하여 모든 내용을 카드에 표시해요 |

모든 언어 카드에는 해당 언어가 미리 입력된 수정 양식을 열어주는 **"수정 또는 추가 제안(Suggest a correction or addition)"** 링크도 포함되어 있어요.

**커뮤니티의 삭제 및 제한 요청.** 커뮤니티 구성원이거나 대표 권한을 가진 분으로서 해당 언어에 대한 데이터 제한이나 삭제를 원하신다면, 수정 양식을 사용해 주세요(공개되는 것을 원치 않으시면 비공개 방식으로 관리자에게 연락해 주셔도 돼요). 이러한 요청은 별도의 인용 자료 없이도 최우선으로 [주권 검토](/docs/network/sovereignty/data-sovereignty)를 거치게 돼요.

---

## 검토 방식

이 부분이 중요해요: **제출물은 로봇이 아니라 사람이 검토해요.** 제출하면 GitHub 이슈가 열려요. 그 이슈가 검토 대기열이에요. 관리자가 그것을 읽고 무언가를 추가하기 전에 프로젝트 규칙에 비추어 확인해요:

- **지식재산권 및 라이선스.** 목록 등재가 허용되어야 해요. 비상업적, 재배포 불가 또는 라이선스가 불분명한 자료도 *카탈로그에 등록*될 수는 있지만, 상업적/상금/공개 패치 경로에서는 제외돼요.
- **커뮤니티 및 주권.** 원주민 및 커뮤니티 언어 데이터는 커뮤니티의 동의가 있는 경우에만 등재돼요. 데이터 제공자나 관리자의 확인을 받기 전에는 이들의 이름을 절대 공개적으로 명시하지 않아요.
- **말뭉치 본문은 호스팅하지 않아요.** 데이터셋은 메타데이터와 데이터를 가져올 위치를 가리키는 포인터 형태로만 등재돼요. **제출 시 원문/참조 문장을 직접 붙여넣지 마세요.**
- **개인정보 금지.** 공개 이슈에 이메일, 전화번호 또는 기타 개인식별정보(PII)를 남기지 마세요. 인간 번역 서비스의 경우, 연락처 정보는 비공개 방식으로 관리자에게 전달돼요.
- **적용 범위.** 성경/전례 및 기타 식민지 지배로 강요된 말뭉치는 범위에서 제외되며 거절돼요.

모든 양식은 필수 확인 항목으로 끝나요:

> *"이것이 공개적으로 목록화 가능하며, 코퍼스 콘텐츠나 개인정보를 포함하지 않고, 원본의 라이선스 및 모든 커뮤니티/주권 제한을 준수함을 확인합니다."*

---

## 제출하는 두 가지 방법

### 브라우저에서

이슈 선택기를 열고 제출하려는 항목과 일치하는 양식을 선택하세요:

➡️ **[GitHub에서 제출 양식 열기](https://github.com/gamedaysuits/Champollion/issues/new/choose)**

각 양식은 해당 인덱스에 필요한 정보(이름, 언어/언어 쌍, 라이선스, 원본 URL 등)와 확인 체크박스만 요청해요.

### CLI에서

[champollion CLI](/docs/network/getting-started/submit-a-method)가 있다면, `champollion submit`이 필드를 수집하고 동일한 GitHub 양식의 **미리 채워진** 버전을 제공해요:

```bash
# Interactive — pick a type and answer the prompts
champollion submit

# See the submission types
champollion submit --list

# Fully scripted (prints a pre-filled GitHub issue URL)
champollion submit --yes --type dataset --attest \
  --field dataset-name="GlobalVoices eng-amh" \
  --field pairs=eng-amh \
  --field license=CC-BY-4.0 \
  --field source-url=https://globalvoices.org
```

CLI는 URL을 출력해요 — 그것을 열고, 브라우저에서 확인 항목을 검토한 후 제출하세요. `--out submission.json`를 추가하면 제안하는 내용의 콘텐츠 없는 로컬 사본도 저장돼요. CLI는 자체적으로 아무것도 업로드하지 않으며 인덱스에 쓰기 작업을 하지 않아요.

---

## 제출 후 일어나는 일

1. 제출물이 GitHub 이슈로 도착해요 — 검토 대기열이에요.
2. 관리자가 위의 IP / 라이선스 / 주권 규칙에 비추어 검토해요.
3. **수락되면:** 관리자가 일반적인 변경 절차를 통해 해당 정보 원천(데이터셋 레지스트리, 카드, method 또는 사람 서비스 레지스트리, 또는 외부 결과 카탈로그)에 항목을 추가하고, 이슈에 **accepted** 라벨을 붙여요.
4. **있는 그대로 목록에 올릴 수 없는 경우:** 관리자가 이유와 함께 **declined** 라벨을 붙이거나(또는 추가 정보를 요청해요).

자동 병합이나 자동 게시는 없어요. 매번 사람이 결정을 내려요.

---

## 참고 항목

- [방법 제출하기](/docs/network/getting-started/submit-a-method) — 이미 벤치마크 실행이 있나요? 실행 카드를 직접 게시하세요.
- [코퍼스 등록하기](/docs/network/sovereignty/registering-corpora) — 소유한 코퍼스에 대한 노출 단계(로컬 / 비공개 / 공개 / 봉인).
- [데이터 주권](/docs/network/sovereignty/data-sovereignty) — 여기서 언어 데이터에 대한 커뮤니티 통제가 작동하는 방식.
- [언어 커뮤니티를 위하여](/docs/network/community/for-language-communities) — 파트너십, 동의, 그리고 키 관리.
