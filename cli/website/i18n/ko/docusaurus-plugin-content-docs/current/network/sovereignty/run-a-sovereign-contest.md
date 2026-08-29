---
sidebar_position: 9
title: "주권적 대회 운영하기"
slug: /network/sovereignty/run-a-sovereign-contest
description: "커뮤니티나 조직이 자체적으로 봉인해 별도로 보관한 코퍼스를 대상으로 MT 대회를 운영할 수 있는 셀프 서비스 방식의 엔드투엔드 경로예요. Champollion이 데이터나 상금을 보유하지 않아도 돼요."
related:
  - label: "Registering Corpora & Exposure Lanes"
    to: /docs/network/sovereignty/registering-corpora
    kind: doc
    note: "The registration lane this path builds on"
  - label: "Data Stewardship"
    to: /docs/network/sovereignty/data-sovereignty
    kind: doc
  - label: "Terms Templates"
    to: /docs/network/sovereignty/terms-templates
    kind: doc
    note: "Adaptable terms ideas, including trojan-horse risks"
  - label: "Prize Specification"
    to: /docs/network/specifications/prizes
    kind: spec
---

# 주권적 콘테스트 운영하기

> **요약.** 커뮤니티나 조직은 **자체 인프라를 절대 벗어나지 않는**
> 별도 보관 테스트 코퍼스를 대상으로 평가 콘테스트를 — 후원 상금을
> 포함하여 — 운영할 수 있습니다. 코퍼스를 만들고, 암호화하고,
> 호스팅하며, 키를 보유하는 것은 여러분입니다. 네트워크는 콘텐츠가
> 없는 메타데이터 카드와 암호문 다이제스트만 등록합니다. 방법은 먼저
> 공개 코퍼스에서 자격을 얻으며, 봉인된 세트에 대한 모든 실행은
> 여러분 관리인의 인가를 필요로 합니다. 밖으로 나오는 것은 오직
> **점수**뿐입니다. 상금은 **후원자가 보유**합니다 — 여러분의 조직이나
> 여러분이 지정한 신탁에 의해 — 그리고 **Champollion은 자금이나 데이터에
> 절대 손대지 않습니다.** 이 페이지는 처음부터 끝까지 셀프서비스로
> 진행하는 실행 안내서입니다.

:::warning[오늘 사용 가능한 기능 vs. 개발 중인 기능]
시작하기 전에 명확히 짚고 넘어갈게요 — 이 프로젝트는 계속 발전하고 있는 비상업적
연구 프로젝트이며, 우리를 신뢰하기보다는 직접 검증해 보시는 편이 낫습니다:

- ✅ **라이브:** 말뭉치 등록(메타데이터 카드, 해시 고정, 노출
  레인), 봉인된 세트 레지스트리(다이제스트 + 관리자 그룹 + 예선 데이터, 콘텐츠
  없음), 봉인된 레인이 있는 경연 시스템, 권한 부여
  요청/승인/감사 데이터 계층(대기 중 → M-of-N 결정 → 일회성
  시간 제한 승인, 추가 전용 해시 체인 감사 로그), 그리고 데이터베이스 계층에서
  강제되는 점수 전용 배출.
- ✅ **라이브: 주최자 채점 노드 + 가설 레인.** 단일
  명령으로 말뭉치를 공개 개발 세트(예선 데이터), 블라인드 테스트 세트(소스는 공개되지만,
  참조 데이터는 사용자의 머신에 봉인된 상태로 유지됨), 그리고 선택적으로 완전한 비밀 세트(`mt-eval contest prepare`)로
  분할해요. 봉인된 세트, 예선 데이터 및 경연 등록은 **사용자 본인의
  로그인으로 직접 처리(self-serve)**할 수 있어요. `contest prepare --self-serve`를 사용하거나,
  이전에 준비한 경연의 경우 `mt-eval contest register
  --manifest`를 사용하면 돼요. 모든 행은 데이터베이스 계층에서
  신원과 바인딩되며, 큐레이터가 개입하지 않고 특권 키도 없어요(정직한 한계에 대해서는
  4단계를 참조하세요). 참가자는 `mt-eval contest submit-hypotheses`를 사용하여 번역을
  제출해요(CLI가 로컬에서 개발 세트를 자체 채점하고 임계값 미만의 업로드는 거부해요).
  사용자가 직접 호스팅하는 노드(`mt-eval node serve`)는 개발 증거를 자체적으로
  다시 채점하고, 예선 데이터를 기준으로 통과 여부를 결정하며, 경연 모델(`per-submission` —
  관리자가 각 채점을 승인 — 또는 `blanket` /
  `open`)에 따라 권한을 부여하고, 사용자의 머신을 절대 벗어나지 않는
  참조 데이터를 바탕으로 블라인드 세트를 채점한 후, **집계 결과만 포함된(aggregates-only)**
  실행 카드를 게시해요. 이 레인이 증명하지 않는 것은 다음과 같아요. 명시된 방법론이
  해당 가설을 생성했다는 점(방법론의 신원은 참가자가 주장하는 것이며 모든 실행 카드에
  그렇게 표시됨)을 증명하지 않으며, 단호한 공격자가 여러 번의 개별 제출을 통해
  참조 신호를 추출하는 것을 막을 수 없어요. 속도 제한, 바이트 단위로 동일한 중복 제거,
  감사 체인이 이를 늦출 수는 있지만, 아래의 방법론 실행 레인이 진정한 해결책이에요.
- ✅ **라이브: 두 가지 비밀 세트 방법론 레인.** 가설 레인 기록이 게시된
  참가자는 사용자의 비밀 세트에 대해 자신의 방법론을 제안할 수 있어요.
  노드는 제출물에 따라 레인을 선택해요.
  - **레인 A — 선언적 모델(권장).** 표준 신경망 모델은
    데이터예요. `mt-eval contest submit-model`는 safetensors 가중치 +
    선언적 토크나이저 + 구성을 전송해요. **코드나 Dockerfile은 없어요.** 사용자의 노드는
    코드가 없는지(pickle이 아닌 safetensors, `trust_remote_code`/`auto_map` 없음,
    데이터 전용 파일) 검증하고, 자체적으로 신뢰할 수 있는 엔진(`transformers`, `trust_remote_code=False`, 오프라인)에서
    가중치를 실행해요. 아키텍처는 기본적으로 허용적이에요(엔진이 기본적으로 로드하는
    모든 아키텍처). 신중한 호스트라면 허용 목록을 고정할 수 있어요. 신뢰할 수 없는 것은
    실행되지 않으므로 샌드박스 처리할 것도 없어요. `declarative-model`가 게시되며, 방법론의 신원은
    **구조적으로 코드가 없음(code-free by construction)**을 보장해요.
  - **레인 B — 실행 가능한 번들(샌드박스 대체 수단).** 코드로 구성된 방법론의 경우:
    `mt-eval contest submit-method`는 Dockerfile + 진입점(entrypoint)을 전송해요.
    관리자가 승인한 후, 사용자의 노드는 네트워크가 격리된
    컨테이너(`--network=none` — 내부에 네트워크 스택이 존재하지 않음,
    읽기 전용 루트, 권한 축소, 무결한 환경) 내부에서 이를 실행해요. 이때
    자동화된 정적 검사가 먼저 수행되며 참조 데이터는 컨테이너에 절대 들어가지 않아요.
    **실행 검증된(execution-verified)** 신원과 함께 `method-execution`가 게시돼요.
  두 레인 모두: 번들 해시는 권한 부여 요청에 고정되며(실행되는 것이 제안된 것과
  동일함이 증명됨), 점수는 동일한 집계 전용 경로를 통해 게시돼요. 최대 격리를 위해
  채점 머신을 완전한 에어갭(airgap)으로 구성할 수 있어요. 승인된 요청과 Ed25519로 서명된
  점수 전용 번들은 이동식 미디어(`mt-eval node relay` / `import-bundle` / `export-scores`)를 통해
  교환되며, 비밀 텍스트는 연결된 머신에도 절대 도달하지 않아요. 이러한 레인에 아직
  포함되지 않은 것은 다음과 같아요. 노드의 하드웨어 증명(신원은 자체 보고됨),
  공식적인 분쟁 해결 시스템, 그리고 (특히 레인 B의 경우) 제거된 네트워크 스택을 넘어서는
  더 깊은 수준의 컨테이너 강화(seccomp 프로필, microVM 등. 이것이 레인 A를 선호해야 하는 이유예요).
  [정직한 한계](/docs/network/honest-limitations)를 참조하세요.
- 🔲 **개발 중: 임계값 서명(threshold signing).** 현재 M-of-N 관리자 승인은
  권한 부여 및 감사 테이블에 *기록*되지만, M개의 공유(share) 없이는 승인을
  생성할 수 없게 만드는 암호화 임계값 키 도구는 아직 구축되지 않았어요.
  현재의 봉인 키는 레이블이 지정된 단일 키 페어 대체물(`champollion seal-corpus keygen`)이며,
  에어갭 점수 번들 서명은 관리자 세리머니가 아닌 단일 노드 키(`seal-corpus sign-keygen`)예요.
- ❌ **의도적으로 지원하지 않음:** Champollion이 사용자의 말뭉치를 호스팅하거나,
  키를 보관하거나, 상금을 보관하는 일은 없어요. 참가자의 가설(자체 번역)은
  당사의 스토리지를 거쳐 가지만, 사용자의 말뭉치 콘텐츠는 절대 그렇지 않아요.

아래 단계가 🔲 목록의 무언가에 의존한다면, 해당 단계에 그렇게
명시되어 있습니다.
:::

---

## 거래의 형태

| 누가 | 보유하는 것 | 절대 보유하지 않는 것 |
|-----|-------|-------------|
| **여러분(커뮤니티/조직)** | 코퍼스, 암호화 키(관리인을 통해), 상금, 수여 결정 | — |
| **Champollion / 네트워크** | 메타데이터 카드, 암호문 다이제스트, 인가 + 감사 기록, 게시된 점수 | 여러분의 코퍼스 콘텐츠, 여러분의 키, 여러분의 돈 |
| **방법 개발자** | 자신의 방법 | 여러분의 테스트 데이터 — 그들은 점수를 보지만, 문장은 절대 보지 않습니다 |

아래의 모든 내용은 그 표를 기계적으로 확장한 것입니다.

---

## 주최자 사전 요구사항

1단계에 앞서, 노드 측을 실행하는 데 실제로 무엇이 필요한지 알아두세요:

- **docker 또는 podman** — method-execution 레인에 필요합니다. 노드는 먼저
  docker를 감지한 다음 podman을 감지하며, 둘 다 없으면 명시적으로 실행을 거부합니다.
  **폴백은 없습니다** — `--network=none`를 이용한 컨테이너 격리가
  핵심 보증이기 때문에, 컨테이너 런타임 없이는 아무것도 실행되지 않습니다.
- **Node.js 20.11+ 및 `champollion` npm CLI** — 하네스는 실링 암호를
  재구현하지 않습니다. `champollion seal-corpus` (동사: `keygen`,
  `seal`, `open`, `sign-keygen`, `sign`, `verify`)이 유일한 암호
  구현체이며(X25519-ECDH → HKDF-SHA256 → AES-256-GCM), 주최자
  노드는 이를 셸에서 호출합니다.
- **`~/.mt-eval/node.json`에 있는 노드 config.** 모든 `mt-eval node` 명령은
  이것 없이는 시작을 거부합니다 — 아무거나 한 번 실행하면 오류 메시지가
  config 경로와 템플릿 위치를 알려줍니다(하네스 소스의
  `mt_eval_harness/contest_node.py`에 함께 배포됩니다). 이 config는 직접 보고한
  `node_id`(모든 요청 지문에 바인딩됨)와 개발 참조 및 실링된 아티팩트를 가리키는
  `contests` 맵을 담고 있습니다.
- **로그인.** 별도의 계정 생성 단계는 없습니다: 신원이 필요한 첫 명령
  (예: `mt-eval contest prepare --self-serve` 또는
  `mt-eval publish`)이 **GitHub 또는 Google**을 통한 브라우저 OAuth 로그인을 엽니다
  (Supabase Auth). 해당 계정의 이메일이 모든 레지스트리 행에 바인딩되는
  신원이므로, 조직이 관리하는 계정을 사용하세요.
- **인테이크 스로틀.** 참가자 제출은 제출자당
  **기본적으로 24시간에 5회로** 속도 제한이 걸립니다(안티 프로빙; 준비 시
  `--intake-daily-limit`로 콘테스트별 설정하거나 공유 작업 에디션
  기본값으로 설정). 콘테스트 일정을 이에 맞춰 계획하세요.

**셀프 서비스 등록에 관한 한 가지 솔직한 유의사항.** **기본 네트워크 호스팅
엔드포인트**에서는 셀프 서비스 등록(`contest prepare
--self-serve` / `contest register`)이 현재 프로덕션 엔드포인트
가드에서 멈춥니다: 그 문을 여는 정책 결정이 내려질 때까지, CLI는 프로덕션
프로젝트에 쓰기를 하는 대신 명시적인 메시지와 함께 거부합니다. 페더레이션
호스트(자체 Supabase 프로젝트)는 영향을 받지 않습니다. 기본 호스트에서 이 가드를
만난다면, 그것은 현재 상태이지 여러분 쪽의 잘못된 설정이 아닙니다 —
[이슈를 열어주시면](https://github.com/gamedaysuits) 등록을 함께 진행하겠습니다.

---

## 1단계 — 별도 보관 테스트 코퍼스 구축하기

측정 대상이 될 코퍼스를 설계하고, 첫날부터 별도로 보관하세요:
그 안의 어떤 것도 게시되거나, 게재되거나, 모델 제공자와 공유된 적이
없어야 합니다.

- 항목 구조, 난이도 계층, 레지스터 범위에 관해서는
  [코퍼스 설계 프레임워크](/docs/network/specifications/corpus-design)를,
  도구에 관해서는
  [코퍼스 생성 쿡북](/docs/network/tutorials/corpus-creation)을 따르세요.
- 봉인하기 전에 유창한 화자가 항목을 검토하게 하세요 —
  [화자 검증 프로토콜](/docs/network/specifications/speaker-validation)은
  방법 검토뿐만 아니라 코퍼스 QA에도 재사용할 수 있는 검토 구조를
  설명합니다.
- 코퍼스 **버전** 레이블을 지금 결정하세요(예: `v1`). 인가
  승인은 특정 버전에 결속되므로, 버전 관리는 장부 정리가 아니라 보안
  모델의 일부입니다.

## 2단계 — 암호화하고 여러분의 인프라에 호스팅하기

코퍼스를 저장 상태에서 암호화하고(현대적인 모든 AEAD 방식 — 예:
`age`/x25519 또는 AES-256-GCM), 여러분이 통제하는 곳에
**암호문**을 호스팅하세요. Champollion은 평문 *이나* 암호문을 절대
수신하지 않습니다.

정확히 하나의 산출물만 게시하세요: **암호문 blob의 SHA-256
다이제스트**입니다.

```bash
shasum -a 256 sealed-corpus-v1.age
# → 3b5f0c…e91a  sealed-corpus-v1.age
```

다이제스트는 공개되지만 데이터는 그렇지 않습니다. 누구든 나중에
평가된 blob이 여러분이 봉인한 blob과 바이트 단위로 동일한지 검증할 수
있습니다 — 소유 없는 무결성입니다. 이것은
[일반 코퍼스 등록](/docs/network/sovereignty/registering-corpora#1-registration-is-metadata-not-content)과
동일한 복사-대신-해시 원칙입니다.

## 3단계 — 메타데이터 카드 등록하기

표준적이고 기본적으로 비공개인
[등록 레인](/docs/network/sovereignty/registering-corpora)을 통해
코퍼스를 등록하세요: `language_pair`, `license`, `attribution`,
그리고 `do_not_train`를 담은 카드 — **문장 없음**. **비공개** 노출
레인을 선택하세요. 다음 단계의 봉인된 세트 등록이 이를 콘테스트 자격
대상으로 만들어 줍니다.

## 4단계 — 봉인된 세트로 등록하기

봉인된 세트는 세 가지를 공개 기록에 올리는, 콘텐츠가 없는 레지스트리
항목입니다:

| 필드 | 여러분이 이를 통해 약속하는 것 |
|-------|------------------------|
| `ciphertext_digest` | "코퍼스"로 간주되는 정확한 바이트 |
| `custodian_group_id` | 접근을 통제하는 그룹의 불투명한 id(동의 전에는 공개 조직/국가 이름을 절대 사용하지 않음) |
| `current_qualifier_id` | 봉인된 실행이 제안되기라도 하려면 방법이 통과해야 하는 공개 라운드 |

등록은 **여러분 자신의 로그인에서 셀프서비스**로 이루어집니다 —
중간에 큐레이터도 없고 특권 키도 없습니다:

```bash
# Register a contest you prepared with `mt-eval contest prepare --no-register`
mt-eval contest register --manifest local/manifest.json

# Or do it in one shot at prepare time
mt-eval contest prepare … --self-serve
```

매니페스트는 여러분의 머신에 남습니다 — 등록은 콘텐츠가 없는 id,
다이제스트, 임계값만 전송합니다. 모든 레지스트리 행은 **신원에
결속**됩니다: 데이터베이스는 이를 등록한 로그인 계정을 기록하고 이후
편집에 대해 그 결속을 고정하며, 자격 심사는 **동일한** 신원이 등록한
봉인된 세트만 게이트할 수 있습니다. 봉인된 세트는 격리된 상태로
태어나고(일반 콘테스트를 뒷받침하거나 공개 리더보드에서 순위에 오를
수 없음), 자격 심사는 안전한 상태로 태어나며, 등록은 속도 제한을
받습니다 — 이 모든 것이 저희 것을 포함한 모든 클라이언트 아래의
데이터베이스 트리거로 강제됩니다. 레지스트리 자체는 공개적으로 읽을 수
있으므로, 여러분은 항목이 정확히 봉인한 것을 말하는지 — 그리고 그 이상은
아무것도 말하지 않는지 — 검증할 수 있습니다.

**정직한 한계.** 셀프서비스 문은 등록 전용입니다(데이터베이스
계층에서 삽입 전용). **자격 심사 교체와 봉인된 세트 폐기는 여전히
큐레이터를 거칩니다** — 이슈를 열거나
[GitHub](https://github.com/gamedaysuits)를 통해 프로젝트에
연락하세요. 그리고 후속 단계에서 주최자 채점 노드를 실행하는 것(라이프사이클
진행, 인가 승인, 감사 작업)은 여러분 자신의 노드에서 이루어지는 별도의
서비스 자격 증명 레인입니다 — 셀프서비스는 공개 기록에서 멈춥니다.

## 5단계 — 관리인과 M-of-N 규칙 선택하기

여러분의 코퍼스에 대한 모든 평가를 공동으로 승인해야 하는 사람이나
기관, 그리고 임계값(예: **5명 중 3명**)을 선택하세요. 관리인은
Champollion이 아니라 여러분의 커뮤니티에 책임을 져야 합니다 —
커뮤니티별 조건이 어떻게 설정되는지는
[데이터 관리](/docs/network/sovereignty/data-sovereignty)와
[소유권 및 조건](/docs/network/sovereignty/ownership-transfer)을
참조하세요.

**정직함 박스:** 임계값 *암호학* 도구(M개의 서명 없이는 승인을 문자
그대로 발행할 수 없게 하는 키 몫)는 **개발 중**입니다. 오늘날 M-of-N
규칙은 기록된 프로세스로 강제됩니다: 모든 접근 요청은 **대기** 큐에
들어가고, 관리인 결정이 기록되며, 승인은 인가된 요청에 대해서만
발행되고, 각 승인은 **일회용이며, 시간 제한이 있고, 하나의 특정
(방법, 코퍼스 버전, 평가 노드) 지문에 결속**되며, 모든 이벤트 —
차단된 시도 포함 — 는 **추가 전용, 해시 체인, 공개적으로 읽을 수 있는
감사 로그**에 기록됩니다. 데이터베이스는 모든 클라이언트와 키 아래에서
불법적인 상태 전환을 거부합니다. 아직 거부할 수 없는 것은 플랫폼
운영자 자체의 침해입니다 — 그것이 바로 임계값 서명이 막는 것이며,
출시되기 전까지 "Champollion은 키 몫을 하나도 보유하지 않는다"는 것을
오늘 검증할 수 있는 속성이 아니라 지향하며 구축 중인 설계 목표로
취급해야 합니다.

## 6단계 — 상금 설정하기

결정하고, 콘테스트와 함께 게시하세요:

- **금액 및 통화.**
- **후원자** — 누가 돈을 대는지.
- **자금이 있는 곳** — 여러분 조직의 계좌, 또는 여러분이 지정한
  커뮤니티 신탁. **Champollion은 상금을 보유하거나, 에스크로하거나,
  전달하지 않습니다.** 보유자의 신원을 미리 게시하는 것이 상금을
  신뢰할 수 있게 만듭니다. 조건 템플릿의
  [후원자 기본 위험 안내](/docs/network/sovereignty/terms-templates#trojan-horse-risks)를
  참조하세요.
- **임계값 조건** — 방법이 통과해야 하는 점수 기준으로,
  [상금 명세](/docs/network/specifications/prizes)에 따라 작성됩니다:
  메트릭 임계값, 화자 검증 요구사항, 재현 가능성. 수여 조건을 게시된
  점수로부터 검증할 수 있게 만들어, 기준 통과 여부에 대해 아무도
  여러분의(또는 저희의) 말을 그대로 믿을 필요가 없도록 하세요.

## 7단계 — 콘테스트 만들기

봉인된 세트에 대한 콘테스트는 명시적인 **봉인 레인**을 사용합니다.
자격은 기본적으로 닫힘입니다: 여러분의 봉인된 세트 등록이 존재하고
활성 상태가 아니면 콘테스트는 거부됩니다 — 그리고 콘테스트를 만드는
것은 **누구에게도** 코퍼스에 대한 접근 권한을 부여하지 않습니다.

```bash
mt-eval contest create \
  --name "EN→CRK Community Challenge 2026" \
  --corpus sealed-eng-crk-v1 \
  --language-pair "en>crk" \
  --visibility public \
  --use-context non-commercial \
  --description "Community-custodied held-out set; scores-only; prize held by <your org/trust>."
```

*(`--corpus` 값은 여러분이 등록한 `sealed_set_id`입니다. 봉인
레인은 봉인된 세트 등록으로부터 **자동으로** 선택됩니다 — 추가 플래그
없음. 봉인된 세트는 일반 콘테스트를 절대 뒷받침할 수 없고, 일반
격리된 데이터셋은 어떤 콘테스트도 절대 뒷받침할 수 없습니다. 두 규칙
모두 모든 클라이언트 아래의 데이터베이스에서 강제됩니다. 4단계에서
`contest register` 또는 `prepare --self-serve`로 등록했다면, 콘테스트 행이
**이미 존재**합니다 — 이 단계를 건너뛰세요. 수동으로 하는
`contest create`은 이미 등록된 봉인된 세트로부터 콘테스트를 조립하는
경우에만 필요합니다.)*

## 8단계 — 방법은 먼저 공개적으로 자격을 얻는다

개발자는 여러분의 언어 쌍에 대해 **공개** 코퍼스에서 방법을 구축하고
채점합니다 — 일반적인
[방법 제출하기](/docs/network/getting-started/submit-a-method) 경로.
여러분 봉인된 세트의 `current_qualifier_id`는 봉인된 실행이 요청되기라도
하려면 방법이 통과해야 하는 공개 라운드를 명명합니다. 이것은 여러분의
코퍼스에 대한 탐색 압력을 차단합니다: 공개적으로 실제 성능을 보여주기
전까지는 아무도 봉인된 세트를 겨냥할 수 없습니다.

:::note[참가자: 여러분의 콘테스트는 어느 엔드포인트에 있나요?]
**네트워크 호스팅** 콘테스트는 설정이 필요 없습니다 — 하네스에 함께 배포되는
기본 엔드포인트가 콘테스트 기능(가설 인테이크, 예선 게이트, 방법 제안)을
담고 있어서 `mt-eval contest submit-hypotheses` /
`submit-method`가 바로 작동합니다.

**연합형** 컨테스트 — 주최자가 자신의
Supabase 프로젝트에서 기계를 실행하므로 제출물이 우리 것을 절대 경유하지 않아요 — 는 컨테스트
자료와 함께 엔드포인트를 발행해요. 제출하기 전에 내보내세요:

```bash
export MT_EVAL_SUPABASE_URL=https://<contest-host>.supabase.co
export MT_EVAL_SUPABASE_ANON_KEY=<contest-anon-key>
```

하니스가 컨테스트 기계가 없는 엔드포인트를 가리키면
(예를 들어 마이그레이션이 누락된 연합형 호스트), 명령어가
*"the contest lane isn't available on this Supabase endpoint yet"*와 함께 중지되며
어느 엔드포인트와 통신 중이었는지 알려줘요. (연합형 주최자: 이 두
값을 당신의 코퍼스 릴리스 옆에 발행하세요, `--node-id`, 그리고 `--corpus-version`.)
:::

## 9단계 — 봉인된 실행: 요청, 인가, 실행, 점수 방출

각 자격을 갖춘 방법에 대해:

1. 여러분의 봉인된 세트에 대해 **요청**이 제출됩니다 — 이는
   `pending`에 들어가며 (방법 tarball 해시, 코퍼스 id, 코퍼스
   버전, `scores-only`, 평가 노드 측정)의 불변 지문을 담습니다.
2. 여러분의 **관리인이 결정**합니다(M-of-N). 승인은 **승인권**을
   발행합니다: 일회용, 만료됨, 그 정확한 지문에 대해서만 유효.
3. 평가는 **여러분의** 노드의 네트워크 격리 샌드박스에서 실행됩니다
   (`mt-eval node run-method`): 자동 정적 검사, 네트워크 스택이 없는 컨테이너,
   그 밖에 보관되는 참조 — 또는, 최대 격리를 위해, 서명된 점수 전용
   번들이 이동식 미디어를 통해 교차하는 진정한 에어갭 머신에서(무엇이
   포함되고 포함되지 않는지는 위의 상태 박스 참조).
4. **점수만 나갑니다.** `scores-only` 방출 규칙은 데이터베이스
   계층에 고정됩니다. 여러분 코퍼스의 항목별 텍스트는 절대 게시되지
   않습니다.
5. 모든 단계 — 요청, 투표, 승인, 사용, 그리고 모든 차단된 시도 —
   는 여러분(그리고 누구든)이 재생할 수 있는 공개 해시 체인 감사
   로그에 추가됩니다.

## 방법론 제출(참가자용) — 두 가지 레인

대부분의 NMT 출품작은 특이하지 않아요. 표준 미세 조정 트랜스포머와 그 가중치로 구성되죠. 이러한 경우를 위해 **코드가 없는 권장 레인**이 있으며, 실제로 코드로 구성된 방법론을 위한 샌드박스 대체 수단도 있어요.

### 레인 A — 선언적 모델(표준 NMT에 권장됨)

방법론이 표준 신경망 모델인 경우, 가중치, 토크나이저, 구성 등 **데이터** 형태로 제출하면 주최자가 자체적으로 신뢰할 수 있는 추론 엔진에서 이를 실행해요. **Dockerfile도, 코드도, 샌드박스도 없어요.** 제출한 내용 중 어느 것도 실행되지 않으므로, 주최자의 안전 검사는 임의의 코드가 안전한지 증명하려는 시도 대신 결정 가능한 형식 검증으로 이루어져요. 이는 참가자와 말뭉치 모두에게 훨씬 더 강력한 보장을 제공해요.

```bash
mt-eval contest submit-model <contest-slug> \
  --model-dir ./my-model \          # config.json + model.safetensors + tokenizer.* at the ROOT
  --name "My NMT" --version 2.0 \
  --architecture MarianMTModel \    # must be on the organizer's trusted whitelist
  --method-class pipeline --paradigm neural-nmt \
  --developer "Your Name" --node-id <organizer-advertised-node-id> --agree
```

번들이 충족해야 하는 규칙은 다음과 같아요(업로드 전 로컬에서 검증되고, 주최자의 노드에서 다시 검증돼요).

- **가중치는 `safetensors`이며, 절대 pickle이 아니어야 해요.** PyTorch `.bin`/`.pt`/`.ckpt`는
  로드 시 임의의 코드를 실행하는 pickle이므로 거부돼요. `model.safetensors` 형식으로
  내보내세요(`safetensors` / `transformers`는 이를 기본적으로 지원해요).
- **주최자의 엔진이 기본적으로 로드하는 아키텍처여야 해요.** `config.json`의
  `architectures`는 호스트의 `transformers`가 구현하는 모든 아키텍처(Marian,
  NLLB/M2M100, mBART, T5, Pegasus 등)가 될 수 있어요. 호스트는
  **기본적으로 허용적**이에요. `trust_remote_code=False`를 사용하면 안전성은
  아키텍처 이름이 아니라 코드가 없는 형식에서 비롯되기 때문이에요(지원되지 않는
  아키텍처는 단순히 로드에 실패하며 아무것도 실행하지 않아요). 신중한 호스트는
  허용 목록을 게시할 수 있어요. `auto_map`나 `trust_remote_code`는 허용되지 않아요.
  이는 사용자 지정 코드를 몰래 들여오기 때문에 항상 거부돼요.
- **선언적 토크나이저**(`tokenizer.json` 또는 `sentencepiece` `.model` +
  어휘)와 **데이터 파일만** 포함해야 해요. 번들에 `.py`/스크립트/바이너리가 있어서는 안 돼요.

주최자는 이를 오프라인에서 `trust_remote_code=False`로 실행하며, 점수만 외부로 전송돼요. 이는 `declarative-model`로 게시되며, 방법론의 신원은 **구조적으로 코드가 없음(code-free by construction)**을 보장해요. (수 GB에 달하는 가중치의 경우: 아래와 동일하게 스니커넷(sneakernet) 레인용 `--bundle-out`를 사용하세요.)

### 레인 B — 실행 가능한 번들(코드 방법론을 위한 샌드박스)

방법론이 파이프라인, LLM 코칭 하이브리드, 사용자 지정 디코더 등 실제로 코드인 경우, 선언적으로 실행할 수 없으므로 대신 네트워크가 격리된 샌드박스를 거치게 돼요. 이는 솔직히 말해 더 취약한 레인(실행을 거부하는 대신 신뢰할 수 없는 코드를 포함함)이므로, 방법론이 표준 모델인 경우에는 항상 레인 A를 사용하세요.

**실행 가능한 번들 계약은 stdin/stdout입니다.** 번들은 엔트리포인트를
선언합니다(예: `method/translate.py`). 컨테이너 내부에서 주최자의
노드는 정확히 다음을 실행합니다:

```
cat /eval/source.txt | <your entrypoint> > /output/translations.txt
```

소스 문장은 stdin으로 한 줄에 하나씩 도착하며, 여러분은 stdout으로 한 줄에
하나씩 번역을 씁니다. `--method-dir`로 전달한 모든 것은 번들의
`method/` 아래에 패킹되어 실행 시 **`/method`에 읽기 전용으로** 마운트됩니다 —
가중치 포함이며, 이미지에 복사할 필요가 없습니다. 컨테이너에는 네트워크 스택이 없고
(`--network=none`), 읽기 전용 루트와 쓰기 가능한 `/tmp`를 갖습니다.

**최소한의 Hugging Face transformers 래퍼:**

```python title="method/translate.py"
#!/usr/bin/env python3
import sys
from transformers import AutoModelForSeq2SeqLM, AutoTokenizer

tok = AutoTokenizer.from_pretrained("/method/weights")
model = AutoModelForSeq2SeqLM.from_pretrained("/method/weights")

for line in sys.stdin:
    inputs = tok(line.strip(), return_tensors="pt", truncation=True)
    out = model.generate(**inputs, max_new_tokens=256)
    print(tok.decode(out[0], skip_special_tokens=True), flush=True)
```

**Dockerfile은 네트워크 없이 빌드되어야 합니다.** 주최자는
`--network=none`로 여러분의 이미지를 빌드합니다 — 에어갭 빌드 테스트가 *곧* 빌드입니다 — 그래서 모든
의존성이 **번들에 벤더링되어** 있어야 합니다(PyPI에 접근하는 `pip install`는
빌드에 실패하며, 사전 정적 스캔이 아무것도 전송되기 전에 네트워크 호출을
표시합니다). method 디렉터리 안에 wheel을 넣어 배포하고 그것으로 설치하세요:

```dockerfile title="Dockerfile"
FROM python:3.11-slim
# The build context is the bundle root: Dockerfile + method/
COPY method/wheels/ /wheels/
RUN pip install --no-index --find-links=/wheels torch transformers sentencepiece
# Weights are NOT copied — /method is mounted read-only at run time.
```

다음으로 제출하세요:

```bash
mt-eval contest submit-method <contest-slug> \
  --method-dir ./my-method --dockerfile ./Dockerfile \
  --name "My NMT" --version 1.0 \
  --entrypoint method/translate.py \
  --method-class pipeline --paradigm neural-nmt \
  --developer "Your Name" --node-id <organizer-advertised-node-id> \
  --agree
```

(먼저 콘테스트에 대한 게시된 hypotheses-lane 레코드가 필요합니다 — 9단계의
T1 게이트 — 그리고 `--agree`는 방법 제출 약관에 동의합니다.)

**멀티 GB 가중치: sneakernet 레인을 사용하세요.** 호스팅 인테이크 경로는
tarball을 콘테스트 호스트의 스토리지에 **단일 POST**로 업로드하므로, 해당
호스트의 스토리지 업로드 한도에 묶입니다 — 코드와 작은 모델에는 괜찮지만,
멀티 GB 체크포인트에는 적합하지 않습니다. 번들 계약 자체는 훨씬 더 큰
아티팩트를 허용합니다(tarball은 최대 100 GB, 빌드된 이미지는 최대 150 GB).
큰 가중치의 경우 호스팅 업로드를 건너뛰세요:

```bash
# Package + write an exchange directory, no upload:
mt-eval contest submit-method … --offline --bundle-out ./exchange \
  --secret-set <sealed-set-id> --pair eng>crk --developer-email you@example.org
```

exchange 디렉터리는 이동식 미디어(또는 양쪽이 신뢰하는 아무 채널)를 통해
주최자에게 전달되며, 주최자는 `mt-eval node import-bundle`로 이를 수집합니다.
번들의 SHA-256은 어느 방식이든 인증 요청에 고정되므로, 실행되는 것이 여러분이
제안한 것임을 증명할 수 있습니다.

**주최자: 에어갭 머신에 베이스 이미지를 미리 로드하세요.** 이미지
빌드가 `--network=none`로 실행되기 때문에, Dockerfile의 `FROM` 베이스 이미지가
이미 머신의 로컬 이미지 스토어에 있어야 합니다. 연결된 머신에서
`docker pull python:3.11-slim && docker save -o base.tar python:3.11-slim`를 실행하고,
`base.tar`를 번들과 함께 가져간 다음, 에어갭 머신에서
`mt-eval node run-method`를 실행하기 전에 `docker load -i base.tar`를 실행하세요. 게시된 콘테스트
자료에서 참가자들과 베이스 이미지를 합의하세요.

## 10단계 — 점수 게시, 게시된 임계값에 따라 수여

점수 전용 결과는 다른 실행과 마찬가지로
[리더보드](/docs/network/leaderboard/rules)에 게시되며, 봉인된 세트
평가로 표시됩니다. 방법이 6단계에서 여러분이 게시한 임계값 조건을
통과하면 — 자동화된 것이 아니라 여러분 커뮤니티의 게이트인
[화자 검증](/docs/network/specifications/speaker-validation)을 포함하여
— **여러분**(또는 여러분의 신탁)이 여러분 자신의 게시된 조건에 따라
상금을 수여합니다. Champollion의 역할은 측정에서 끝납니다.

---

## 여러분이 영원히 보유하는 것

- **코퍼스.** 여러분의 인프라를 절대 벗어나지 않았습니다. 암호문을
  오프라인으로 두면 봉인된 세트는 그저 실행 불가능해집니다.
- **키.** 관리인이 부여를 멈추면 접근은 사라집니다.
- **돈.** 다른 어디에도 있었던 적이 없습니다.
- **기록.** 감사 로그의 헤드 다이제스트는 게시할 수 있으므로, 누가
  여러분의 코퍼스에 대해 무엇을 실행했는지의 이력은 — 저희를 포함해
  누구도 — 조용히 다시 쓸 수 없습니다.

적용할 수 있는 조건 문구 — 소유권, 점수 전용 라이선싱, 그리고
콘테스트가 공격받을 수 있는 방식에 대한 명시적인 안내 — 에 대해서는
[조건 템플릿](/docs/network/sovereignty/terms-templates)을 참조하세요.
