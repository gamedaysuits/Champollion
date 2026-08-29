---
sidebar_position: 5
title: "프로덕션에 배포하기"
description: "Network에서 검증된 방법을 가져와 champollion으로 배포하세요."
---

# 프로덕션에 배포하기

Network에서 작동함을 확인했어요. 이제 배포할 차례예요.

Network는 R&D를 위한 공간이에요 — 번역 방법을 구축하고, 벤치마킹하고, 비교하는 곳이죠. **프로덕션 배포**는 개발자 대상 번역 CLI인 [champollion](https://champollion.dev)을 통해 이루어져요. 둘은 공유 플러그인 형식을 통해 연결돼요.

```mermaid
graph LR
    A["Network\n(benchmark)"] -->|"method.json\n+ coaching data"| B["champollion\n(production)"]
    B -->|"Speaker feedback\nimproves the method"| A
```

---

## 배포 경로

### 1. 방법을 플러그인으로 내보내기

벤치마크 결과를 패키징하는 `method.json` 매니페스트를 생성하세요:

```json
{
  "name": "crk-coached-v3",
  "type": "llm-coached",
  "version": "3.0.0",
  "description": "Coached LLM translation for Plains Cree",
  "locales": ["crk"],
  "config": {
    "model": "google/gemini-2.5-flash",
    "temperature": 0.3
  },
  "benchmarks": {
    "crk": {
      "composite_score": 0.67,
      "fst_acceptance": 0.82,
      "corpus_size": 150
    }
  }
}
```

매니페스트와 함께 코칭 데이터(문법 규칙, 사전)도 포함하세요.

### 2. Champollion에 설치하기

```bash
champollion plugin install ./my-method-plugin/
```

### 3. 페어 구성하기

```json title="champollion.config.json"
{
  "pairs": {
    "en-crk": { "method": "plugin", "plugin": "crk-coached-v3" }
  }
}
```

### 4. 실제 콘텐츠 번역하기

```bash
npx champollion sync
```

이제 벤치마킹한 방법이 프로덕션에서 실제 번역을 생성하고 있어요.

---

## 토착어의 경우

원주민 언어 커뮤니티를 지원하는 방법론은 프로덕션 배포 전에 **커뮤니티의 동의**가 필요해요. First Nations 데이터 주권 원칙(소유 Ownership, 통제 Control, 접근 Access, 점유 Possession)은 번역 방법론이 개발, 평가, 배포되는 방식을 규정해요.

Deployable 등급(0.70+)에 도달한 방법이라고 해서 자동으로 배포되는 것은 아니에요 — 해당 언어 공동체의 거버넌스 기구가 동의할 **때에 한해** 배포돼요.

전체 거버넌스 프레임워크는 [데이터 주권](/docs/network/sovereignty/data-sovereignty)과 [소유권 이전](/docs/network/sovereignty/ownership-transfer)을 참고하세요.

---

## 참고 항목

- [Eval Harness Bridge](https://champollion.dev/docs/guides/bridge) — Network→champollion 파이프라인에 대한 자세한 설명
- [플러그인 명세](https://champollion.dev/docs/reference/plugin-spec) — method.json 매니페스트 형식
- [champollion 에이전트 가이드](https://champollion.dev/docs/guides/agent-guide) — 번역에 champollion을 사용하는 방법
