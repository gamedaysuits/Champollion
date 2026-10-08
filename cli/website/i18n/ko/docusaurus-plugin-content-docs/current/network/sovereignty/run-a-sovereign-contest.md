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

- ✅ **운영 중:** 말뭉치 등록(메타데이터 카드, 해시 고정, 노출 레인), 봉인된 세트 레지스트리(다이제스트 + 관리자 그룹 + 자격 검정기, 콘텐츠 없음), 봉인된 레인이 포함된 콘테스트 메커니즘, 인가 요청/승인/감사 데이터 레이어(대기 중 → M-of-N 결정 → 1회용 시간 제한 승인, 추가 전용 해시 체인 감사 로그), 데이터베이스 레이어에서 강제되는 점수 전용 방출을 지원해요.
- ✅ **운영 중: 주최자 채점 노드.** 단 하나의 명령어로 말뭉치를 공개 개발 세트(참가자가 자체 채점하는 자격 검정기)와 노드가 출품작을 대상으로 실행하는 봉인된 비밀 세트로 분할하고, 비밀 세트를 여러분의 로컬 머신(`mt-eval contest prepare`)에서 암호화 상태로 봉인해요. 봉인된 세트, 자격 검정기, 콘테스트 등록은 **본인의 로그인 계정에서 셀프서비스로 수행할 수 있어요** — `contest prepare --self-serve`를 사용하거나, 이전에 준비해 둔 콘테스트의 경우 `mt-eval contest register --manifest`를 사용하며, 모든 행은 데이터베이스 레이어에서 신원 바인딩돼요. 큐레이터의 개입이나 특권 키는 전혀 필요하지 않아요(솔직한 한계점은 4단계를 참고하세요).
- ✅ **운영 중: 출품작은 번역이 아니라 '메서드'예요.** 콘테스트 참가는 노드가 실행할 수 있는 무언가를 제출하는 방식으로 이루어져요. 참가자는 공개 개발 세트를 자체 채점(`mt-eval contest qualify`)하여 영수증을 발급받은 뒤, 모델 또는 메서드를 제출해요. 노드는 관리자에게 승인을 요청하기 전에 자체 개발 세트 사본에서 해당 영수증의 점수를 다시 실행하며, 일치하지 않으면 거부해요. 노드는 제출물을 바탕으로 레인을 선택해요:
  - **레인 A — 선언형 모델(권장).** 표준 신경망 모델은 '데이터'예요: `mt-eval contest submit-model`는 safetensors 가중치 + 선언형 토크나이저 + 설정을 전송하며, **코드나 Dockerfile은 전혀 포함하지 않아요.** 노드는 이것이 코드가 없는지 검증하고(pickle이 아닌 safetensors 사용, `trust_remote_code`/`auto_map` 없음, 데이터 전용 파일) 자체적으로 신뢰하는 엔진(`transformers`, `trust_remote_code=False`, 오프라인)에서 가중치를 실행해요. 아키텍처는 기본적으로 허용적이며(엔진이 기본적으로 로드하는 모든 아키텍처 지원), 신중한 호스트는 허용 목록을 고정할 수도 있어요. 신뢰할 수 없는 요소가 전혀 실행되지 않으므로 샌드박스 처리할 필요도 없어요. `declarative-model`로 게시되며, 메서드 신원은 **구조상 코드가 없는 형태(code-free by construction)**로 보장돼요.
  - **레인 B — 실행 가능한 번들(샌드박스 대체 수단).** 실제 '코드'인 메서드의 경우: `mt-eval contest submit-method`는 Dockerfile + 진입점을 전송해요. 관리자가 승인한 후 여러분의 노드는 네트워크가 격리된 컨테이너(`--network=none` — 내부에는 네트워크 스택이 존재하지 않으며 읽기 전용 루트, 권한 박탈, 정리된 환경 제공) 내에서 이를 실행하며, 자동화된 정적 검사를 먼저 거치고 참조 번역은 컨테이너에 절대 들어가지 않아요. **실행 검증된(execution-verified)** 신원으로 `method-execution`에 게시돼요.
  어느 레인이든 번들 해시는 인가 요청에 고정되므로(실행되는 것이 제안된 내용과 동일함을 증명 가능), 점수는 동일한 집계 전용 경로를 통해 게시돼요. 극대화된 격리를 위해 채점 머신을 완전한 에어갭(airgap) 환경으로 구성할 수도 있어요: 인가된 요청과 Ed25519로 서명된 점수 전용 번들은 이동식 미디어(`mt-eval node relay` / `import-bundle` / `export-scores`)를 통해 전달되므로, 비밀 텍스트는 네트워크에 연결된 머신에도 절대 도달하지 않아요. 현재 이 레인에 아직 포함되지 않은 사항: 노드의 하드웨어 증명(신원은 자체 보고됨), 공식 분쟁 메커니즘, 그리고 레인 B의 경우 네트워크 스택 제거 이상의 심층적인 컨테이너 강화(seccomp 프로필, microVM 등 — 이는 레인 A를 권장하는 이유이기도 해요). 자세한 내용은 [솔직한 한계점](/docs/network/honest-limitations)을 참고하세요.
- ✅ **약속 레이어가 운영 중이에요 (2026-09-07).** 출품 선언(기본/대조, 트랙), 제출 단계, 비공개 결과(`hidden_until_close`), 그리고 출품작이 접수된 후 선언된 약속을 수정할 수 없도록 동결하는 기능이 네트워크 호스팅 엔드포인트의 데이터베이스에서 강제돼요. 연합 호스트는 하네스와 함께 제공되는 마이그레이션을 적용하여 동일한 규칙을 적용받을 수 있어요. 구버전 엔드포인트의 경우 하네스는 눈속임 없이 기본 세트로 폴백하고 이를 명시해요(`declarations_available: false`). 아래 단계에서 *데이터베이스가 동결/비공개 처리한다*고 명시된 부분은 실제로 그대로 적용돼요.
- 🔲 **개발 중: 임계값 서명.** `champollion seal-corpus`로 봉인된 세트의 경우, M-of-N 관리자 승인이 인가 및 감사 테이블에 *기록*되며, 봉인 키는 레이블이 지정된 단일 키 쌍 대리자(`champollion seal-corpus keygen`)예요. 오프라인 노드에서 봉인된 세트(`mt-eval node seal`)는 노드에 내장된 **키 의식(key ceremony)**(`mt-eval node ceremony`)을 사용해요: 세트 키가 M-of-N으로 분할되고 정족수 승인을 받은 실행 중에만 메모리 내에서 재조립돼요. 이 의식은 아직 실제 관리자와 함께 사용된 적이 없으며, v1에서는 공유 키가 일반 파일 형태예요. 두 경로 모두 임계값 *서명*은 아직 지원하지 않아요: 에어갭 점수 번들 서명은 단일 노드 키(`seal-corpus sign-keygen`)를 사용해요.
- ❌ **설계상 지원하지 않음:** Champollion이 여러분의 말뭉치를 호스팅하거나 키를 보관하거나 상금을 보관하는 일은 없어요. 참가자의 번들(자체 모델 또는 코드)은 노드로 이동하는 과정에서 저희 스토리지를 거치지만, 여러분의 말뭉치 콘텐츠는 절대 거치지 않아요.
- ❌ **함정으로 남겨두지 않고 삭제됨.** `contest submit-hypotheses`(2026-09-06 폐기)는 소스 공개 블라인드 세트의 번역을 업로드하는 방식이었고, `contest submit`(2026-09-06 폐기)는 직접 게시한 점수를 연결하는 방식이었어요. 이제 둘 다 콘테스트 참가 경로로 사용되지 않아요. 소스 공개 블라인드 라운드는 주최자용 선택적 진단 도구로만 남아 있으며, 자체 보고 점수는 여전히 공개 리더보드(콘테스트가 아닌 말뭉치 및 언어 쌍 방향별로 색인된 공개 게시판)에 속해요.

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

- **노드 extra가 포함된 하네스:**
  `python3 -m pip install 'mt-eval-harness[node]'` (0.2.0 이상; 하네스가 실행되는 모든 환경에서 작동하는 `python3 -m pip`를 사용하세요 — 독립형 `pip`는 모든 가상 환경의 `PATH`에 존재하지는 않아요). `[node]` extra는 `mt-eval node keygen`, 관리자 의식 및 점수 매니페스트 서명에 사용되는 `cryptography` 라이브러리를 추가해 줘요. 일반 `python3 -m pip install mt-eval-harness`에는 이 라이브러리가 없으므로, 해당 명령어 실행 시 중단되며 이 패키지 설치를 안내해요.
- **docker 또는 podman** — 메서드 실행 레인에 필요해요. 노드는 docker를 먼저 감지한 후 podman을 감지해요(`node.json`의 `sandbox.runtime` 설정은 기본값이 `null`예요. 특정 런타임을 강제하려면 여기에 지정하세요). 둘 다 `PATH`에 없으면, `mt-eval node run-method`는 아무것도 실행하지 않고 두 런타임을 모두 언급하는 한 줄의 오류와 함께 작업을 거부해요. 요청은 원래 상태로 유지되므로 런타임을 설치한 후 다시 실행할 수 있어요. **대체 수단(fallback)은 없어요.** `--network=none`를 통한 컨테이너 격리는 핵심 보장 사항이므로, 컨테이너 런타임 없이는 아무것도 실행되지 않아요.
- **Node.js 20.11+ 및 `champollion` npm CLI** — 하네스는 봉인 암호를 직접 재구현하지 않아요. `champollion seal-corpus`(동사: `keygen`, `seal`, `open`, `sign-keygen`, `sign`, `verify`)가 유일한 암호 구현체(X25519-ECDH → HKDF-SHA256 → AES-256-GCM)이며, 주최자 노드는 이를 셸로 호출하여 사용해요.
- **`~/.mt-eval/node.json` 위치의 노드 설정 파일.** 모든 `mt-eval node` 명령어는 설정 파일이 없으면 시작을 거부해요. `mt-eval node init`는 해당 위치에 시작용 설정을 작성해요(`--print`는 작성 대신 내용을 화면에 보여줘요). 이 파일에는 자체 보고된 `node_id`(모든 요청 핑거프린트에 바인딩됨)와 개발 세트, 봉인된 세트(`secret_set_id` + `secret_artifact`), 준비해 둔 경우 봉인된 홀드아웃(`holdout_set_id` + `holdout_corpus`. 없으면 두 키 모두 삭제), 그리고 공개 자격 검정기 게이트(`qualifier` + `dev_corpus`, 0–100 자격 검정 척도의 기준점)를 가리키는 `contests` 맵이 담겨요. `contest prepare`(1단계)를 실행한 후 `mt-eval node init --from-contest ./mytask`를 실행하면 `./mytask/local/manifest.json`의 콘테스트 값들이 미리 채워진 시작용 설정을 작성하고, 추가로 입력해야 할 항목들을 나열해 줘요. 적용되는 매핑은 다음과 같아요(원하는 경우 직접 작성해도 돼요):

  | `local/manifest.json` | `node.json` (`contests.<contest-id>` 아래) |
  |---|---|
  | `contest.language_pair` | `language_pair` |
  | `secret.sealed_set_id` | `secret_set_id` |
  | `secret.corpus_sealed_artifact` | `secret_artifact` |
  | `holdout.sealed_set_id` / `holdout.corpus_sealed_artifact` | `holdout_set_id` / `holdout_corpus` (홀드아웃이 없으면 둘 다 제거됨) |
  | `qualifier.corpus_file` | `dev_corpus` |
  | `qualifier.qualifier_id`, `corpus_card_id`, `threshold`, `metric`, `year` | `qualifier.*` (동일한 이름) |
  | `test_suites[].suite_id` / `sha256`, `test_suite_local_copies` | `test_suites[].suite_id` / `corpus_sha256` / `corpus_path`: 고정된 바이트와 함께 이 머신에 있을 때 `contest prepare`가 읽은 사본(`--test-suite <id>=<path>` 또는 찾은 사본). 그렇지 않은 경우 `corpus_path` 설정 |
  | `secret.sealed_block.keyScheme` | `custody`: 단일 키 쌍으로 봉인된 세트의 경우 `single-key`(이후 `secret_privkey` 설정), 의식의 경우 `threshold-quorum` |
  | `registration.prize_terms` (`contest prepare` 및 `contest register`에 의해 기록됨) | `prize_terms_sha256`: 이용 약관의 SHA-256이자 참가자가 `--accept-terms`에 전달하는 해시(콘테스트에 상금이 없으면 생략됨) |

  콘테스트 ID는 `contest prepare`에 지정한 `--slug`예요(아래 예시에서는 `mytask`). prepare 명령어가 이를 매니페스트에 기록하고, 등록 시 이 ID로 콘테스트가 생성되며, 참가자가 `contest qualify`와 `submit-method`에 전달하는 ID이기도 하므로 개발 세트 공개 시 함께 공지하세요. `--contest-id`로 재정의할 수 있어요. (ID가 기록되기 전에 작성된 매니페스트는 해당 콘테스트, 영수증, 노드 설정에서 이미 사용 중이므로 이름에서 파생된 ID 등록(`"My Task 2026"` → `my-task-2026`)을 유지해요.) 어떤 매니페스트도 `node_id`, `cards_dir`, `signing_key` 또는 개인 키 파일을 알지 못하므로, 이 항목들은 직접 채울 수 있도록 `<...>`로 남겨져요.
  그런 다음 `mt-eval node ledger verify`가 이를 점검하고 확인된 내용을 출력해요: 설정(보관, 전체 자격 검정기 게이트, 홀드아웃 쌍, 로컬 카드 인덱스)을 로드하고, 여전히 `<...>` 플레이스홀더로 남아 있는 첫 번째 값이나 이 머신에 없는 선언된 파일이 있으면 거부하며, 각 콘테스트의 세트와 파일을 출력한 후 인가 원장의 해시 체인을 재생해요(새 노드에서는 0개 항목).
- **노드가 보관하는 로컬 언어 카드 인덱스.** 채점 시 실행할 언어 쌍을 지정해야 하며, 노드는 네트워크를 통해 언어를 조회하지 않아요.
  `node.json`의 `cards_dir`가 노드에서 채점할 모든 언어에 대한 카드가 포함된 디렉터리를 가리키도록 설정하세요(또는 `MT_EVAL_CARDS_DIR` 설정). 로컬 인덱스가 없는 노드는 네트워크에서 가져오는 대신 시작 시 즉시 거부해요. 설치된 패키지 중 언어별 카드 디렉터리를 함께 제공하는 패키지는 없으므로, 인터넷이 연결된 머신에서 `champollion` CLI를 사용해 해당 언어 쌍의 언어당 하나의 `<code>.json` 파일을 생성하세요:

  ```bash
  mkdir -p node-cards
  champollion network card eng --json > node-cards/eng.json
  champollion network card crk --json > node-cards/crk.json
  ```

  그런 다음 `"cards_dir"`를 해당 디렉터리의 절대 경로로 설정하세요. 에어갭 노드의 경우 오프라인 번들(`mt-eval node bundle --out <dir> --include node-cards`)에 이를 담아 옮기세요. 파일은 `<dir>/artifacts/node-cards`에 위치하게 되며, 노드에서는 `cards_dir`가 해당 경로를 가리키게 돼요.
- **로그인.** 별도의 회원가입 단계는 없어요: 신원이 필요한 첫 번째 명령어(예: `mt-eval contest prepare --self-serve` 또는 `mt-eval publish`)를 실행하면 **GitHub 또는 Google**(Supabase Auth)을 통한 브라우저 OAuth 로그인이 열려요. 해당 계정의 이메일이 모든 레지스트리 행에 바인딩되는 신원이 되므로, 조직에서 관리하는 계정을 사용하세요.
- **접수 제한(Intake throttle).** 참가자 제출은 악의적인 탐색을 방지하기 위해 제출자당 **24시간 기준 기본 5회**로 속도가 제한돼요(준비 시 콘테스트별로 `--intake-daily-limit`를 설정하거나 공유 태스크 에디션 기본값으로 설정 가능). 콘테스트 일정을 계획할 때 이를 감안해 주세요.

**셀프서비스 등록에 대한 솔직한 주의 사항.** **기본 네트워크 호스팅 엔드포인트**에서 셀프서비스 등록(`contest prepare --self-serve` / `contest register`)은 현재 프로덕션 엔드포인트 보호 조치로 인해 중단돼요: 이 경로의 개방 여부에 대한 정책 결정이 내려질 때까지 CLI는 프로덕션 프로젝트에 직접 기록하는 대신 명시적인 메시지와 함께 작업을 거부해요. 연합 호스트(직접 운영하는 Supabase 프로젝트)는 영향을 받지 않아요. 기본 호스트에서 이러한 보호 조치와 마주치더라도 설정 오류가 아니라 현재 시스템 상태에 따른 정상적인 동작이에요 — [이슈를 등록해 주시면](https://github.com/gamedaysuits/Champollion/issues) 등록 절차를 함께 안내해 드릴게요.

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

### 말뭉치 분할 방식

사용자가 직접 선택하고 기록한 시드(seed)를 바탕으로, 단 하나의 명령어가 마스터 말뭉치에서 모든 계층을 결정론적으로 생성해요:

```bash
mt-eval contest prepare --corpus master.json --slug mytask --name "My Task 2026" \
    --pair 'eng>crk' --seed 20260906 --qualifier-threshold 35 \
    --dev-size 400 --secret-size 500 --sealed-holdout-size 250 \
    --test-suite <a public corpus card id> \
    --license <the licence the rights-holder grants> \
    --custodian-group <opaque id> --threshold-pubkey ./contest.pub.json \
    --out ./mytask
```

`--qualifier-threshold`는 노드가 봉인된 세트와 봉인된 홀드아웃에서 메서드를 실행하기 전에, 해당 메서드가 공개 개발 세트에서 반드시 달성해야 하는 점수예요. **0–100 자격 검정 척도**를 사용해요: 자격 검정 점수는 공개된 개발 세트 참조 번역 대비 개발 세트 출력물의 **말뭉치 chrF++**(sacreBLEU chrF, `word_order=2`)로 측정돼요. 이는 채점 표준의 대표 지표이며, 동일한 출력물에 대해 `mt-eval run` 카드가 메인으로 표시하는 수치와 같아요. 다른 지표는 전혀 혼합되지 않으며, 완전 일치(exact match)는 진단용으로 함께 표시될 뿐 통과 여부를 제한하지 않아요. 노드가 메서드를 재실행할 때도 동일한 수치를 계산하므로, 참가자의 영수증과 노드의 측정 결과를 정확히 비교할 수 있어요.

기준값은 다른 평가 세트의 점수가 아니라, 이 개발 세트에서 직접 측정한 chrF++ 점수(베이스라인의 개발 세트 출력물에 대해 `contest qualify` 실행)를 바탕으로 설정하세요. chrF++ 수치는 언어와 말뭉치에 따라 크게 달라질 수 있어요.
현재의 [채점 표준](/docs/network/specifications/scoring#how-runs-are-scored)이 도입되기 전 폐기된 복합 점수를 지표로 등록했던 자격 검정기도 계속 작동해요: 해당 기준값은 chrF++ 척도로 해석되며, qualify 실행 시마다 이 내용이 안내되므로 수치를 확인하거나 새 자격 검정기로 교체하세요.

`--license`는 필수 항목이에요. 공개되는 개발 세트에 적용되는 라이선스를 지정하며, mt-eval이 임의로 선택해 주지 않아요. 공개된 파일에는 `dataset.license`로 포함되며, `mt-eval run`, `contest qualify`, `publish`가 이를 읽어 참가자의 실행을 라이선스에 따라 제어해요. 저작권자의 고유 권한 부여 내역을 SPDX ID로 입력하세요. `CC-BY-4.0`를 사용하면 참가자가 어떤 모델 서비스를 사용해서든 평가할 수 있어요. `CC-BY-NC-4.0` 같은 비상업적 라이선스를 사용할 경우 원격 모델은 학습 데이터로 사용하지 않는 채널을 통해서만 실행돼요. 자체 약관(`LicenseRef-<name>`)을 지정하면 저작권자의 허가가 기록될 때까지 원격 평가가 거부되므로 참가자는 로컬 모델을 사용해야 해요.

공개된 파일에는 마스터 자체 카드(`champollion network register-corpus`가 `<file>.champollion.json` 사이드카를 통해 작성한 말뭉치 카드)와 자체 봉투에서 읽어온 마스터의 기타 약관도 명시돼요: `dataset.do_not_train` 및 마스터가 로컬 전용으로 표시된 경우 `dataset.transmission: "local-only"`(이 경우 참가자는 자신의 머신에 있는 모델로만 개발 세트를 실행할 수 있어요)가 포함되며, `dataset.terms_from`에는 각 약관의 출처가 명시돼요. 마스터 카드에 학습 약관이 명시되어 있지 않은 경우 `--do-not-train true` 또는 `false`를 전달하세요. 이 플래그는 마스터의 약관을 더 엄격하게 제한할 수는 있지만, 절대 완화할 수는 없어요(`doNotTrain: true` 마스터에 `--do-not-train false`를 지정하면 거부돼요). prepare 명령어는 이러한 약관을 출력하며, 마스터 카드에 재배포가 금지되어 있다고 명시된 경우 경고를 표시해요: `public/`를 공개하는 것 자체가 재배포에 해당하므로, 저작권자가 동의하기 전에는 공개하지 마세요.

| 분할 | 열람 권한 | 용도 |
|-------|-------------|----------------|
| **공개 개발 세트** (`--dev-size`) | 전체 공개 — 소스 *및* 참조 번역 모두 공개 | **자격 검정기**: 참가자가 제출하기 전에 반드시 이 세트를 바탕으로 자체 채점을 거쳐야 해요 (8단계) |
| **봉인된 세트** (`--secret-size`) | 주최자 노드 전용 — 소스 *및* 참조 번역 모두 암호화 유지 | 출품작이 실제로 채점되는 대상 |
| **봉인된 홀드아웃** (`--sealed-holdout-size`, 선택 사항) | 주최자 노드 전용 | 동일한 실행에서 함께 채점되는 **두 번째** 봉인 분할 세트로, 콘테스트가 종료될 때까지 점수가 비공개로 유지돼요 |
| *블라인드 세트* (`--blind-size`, 기본값 0) | 소스 공개, 참조 번역 비공개 | 주최자가 자체적으로 진행하는 선택적 진단 라운드. **출품 경로가 아니에요**: 콘테스트 참가는 메서드를 제출하는 방식으로만 가능하며, 번역문을 업로드하는 방식으로는 절대 참가할 수 없어요 |

분할은 상호 배타적(disjoint)이며 재현 가능해요: 동일한 말뭉치와 동일한 시드라면 언제나 동일하게 분할돼요. 분할 레시피는 주최자 로컬 매니페스트에 보관되며 머신 외부로 절대 유출되지 않아요.

**반복되는 문장은 한쪽에만 유지돼요.** 분할은 그룹 단위 배타적(group-disjoint, 매니페스트의 `split` 블록에 `group-disjoint/1`로 기록됨)으로 이루어져요: 대소문자, 문장 부호, 띄어쓰기를 정규화한 후 또는 정확히 일치하는 소스나 참조 번역을 공유하는 행들은 하나의 그룹을 형성하며, 그룹 전체가 하나의 분할에 통째로 들어가요. 따라서 공개된 개발 세트의 문장이 봉인된 행에 중복되어 나타나지 않아요. 그룹들은 지정한 시드로 셔플된 후 개발(dev), 블라인드(blind), 비밀(secret), 홀드아웃(holdout) 순서대로 배치돼요. 반복 문장이 없는 마스터 말뭉치는 행 단위 셔플과 완전히 동일하게 분할돼요. 그룹 전체 크기가 요청한 크기를 채울 수 없는 경우, prepare는 반복 행 수와 함께 중복을 제거하거나(각 그룹당 한 행만 유지) 일부 그룹이 제외될 수 있도록 마스터 크기보다 작은 총합을 요청하라는 해결 방법을 안내하며 작업을 거부해요.

**`public/`는 공개 가능하며, 실행 로그는 `runs/`에 저장돼요.** prepare는 `public/`에 마커 파일 `.champollion-releasable.json`를 작성해요. 실행 로그, 보고서, 번역 캐시는 여기에 절대 작성되지 않아요: `mt-eval run`는 내부의 `--output-dir` 또는 `--cache-dir`를 거부하고 옆에 있는 `runs/`(`<out>/runs/`)를 대신 가리키며, MCP 서버의 `run_benchmark`는 공개된 개발 세트(기준점을 설정하기 위해 실행하는 베이스라인)에서의 실행을 `runs/`에 자동으로 배치하고 이를 안내해요. 마커가 존재하기 전에 준비된 콘테스트는 디렉터리 구조(`local/manifest.json` 옆의 `public/`)를 통해 인식돼요.

**홀드아웃이 필요한 이유.** 단일 봉인 세트만 사용할 경우 긴 콘테스트 기간 동안 이에 맞춰 튜닝될 위험이 있어요 — 모든 제출물은 일종의 탐색(probe)이며, 탐색이 충분히 누적되면 정보가 조금씩 유출되기 마련이에요. 동일한 인가 실행에서 채점되지만 종료 시까지 아무에게도 점수가 공개되지 않는 두 번째 분할 세트가 있으면 마지막에 깔끔한 결과를 얻을 수 있어요: 두 세트 간에 시스템 순위 변동이 있다면, 순수한 번역 성능과 튜닝에 의한 영향이 각각 어느 정도였는지 파악할 수 있어요. 두 세트 모두 **단 한 번의** 인가로 처리되므로 관리자에게 추가적인 의식 부담을 주지 않아요.

**서드파티 테스트 스위트.** `--test-suite`는 모든 출품작을 대상으로 함께 실행할 공개 진단용 말뭉치(sha 고정되어 공개 다운로드 가능한 타인의 말뭉치)를 지정해요. 이 수치들은 **순위에 반영되지 않고 단순 보고용으로만 사용돼요**: 봉인된 세트에서 얻은 높은 점수가 콘테스트에서 자체 설계하지 않은 독립적인 세트에서도 유지되는지 독자가 확인할 수 있도록 하기 위한 목적이에요. Champollion은 격리 조치되었거나, 핀 고정되지 않았거나, 대상 언어 쌍과 일치하지 않거나, 주최자 자체 분할 세트 중 하나인 스위트는 거부해요.

**이미 공개된 봉인 행은 봉인된 것이 아니에요.** `contest prepare`는 봉인된 세트 및 봉인된 홀드아웃을 공개된 모든 데이터와 비교해요: 공개되는 개발 세트(위의 그룹 배타적 분할 덕분에 중복이 0으로 유지됨), 블라인드 소스 공개본(있는 경우), 선언된 모든 테스트 스위트가 포함돼요. 정확한 일치 및 대소문자, 문장 부호, 띄어쓰기를 정규화한 후의 일치(분할 그룹화와 동일한 비교 방식)를 확인한 다음, 중복 항목마다 개수(예: "30 of 30 rows also appear in test suite …")를 출력하고 `local/manifest.json`에 기록해요. 서드파티 스위트의 경우 작업을 거부하는 대신 경고를 표시해요: 해당 스위트는 타인의 공개 텍스트이므로, 마스터에서 해당 행을 제거할지 스위트를 제외하고 다시 준비할지는 주최자가 결정해야 해요. 스위트를 확인하려면 prepare에 해당 문장들이 필요해요. 이때 머신에 이미 있는 사본을 사용하며, 준비 과정 중에는 절대 네트워크로 다운로드하지 않아요. `--test-suite <id>=<path>`로 사본을 지정하세요. SHA-256 해시가 레지스트리에 고정된 핀과 반드시 일치해야 해요. 사본을 찾을 수 없는 경우 경고에는 문제가 없다는 뜻이 아니라 스위트가 **확인되지 않았다**는 사실이 명시돼요. 매니페스트에는 prepare가 읽은 각 사본의 경로가 기록되므로 `node init --from-contest`가 노드에 해당 경로를 안내할 수 있어요.

선언한 홀드아웃과 테스트 스위트는 공약이 돼요: 첫 번째 출품작이 도착하는 즉시 콘테스트에서 해당 항목들이 동결되므로, 콘테스트 도중에 테스트 스위트를 추가하거나 제외할 수 없어요.

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

매니페스트는 여러분의 머신에만 유지돼요 — 등록 시에는 콘텐츠가 포함되지 않은 ID, 다이제스트, 임계값만 전송돼요. 실제로 전송되기 전에 무엇이 전송되는지 정확히 확인할 수 있어요: `contest prepare --no-register`는 등록 계획, 즉 `contest register`가 기록할 모든 행을 순서대로 출력해요 — 각 봉인된 세트의 ID와 암호문의 SHA-256(머신에 봉인 상태로 유지되는 행 수 포함), 관리자 그룹, 자격 검정기 ID 및 임계값, 기록된 공약이 포함된 콘테스트 행, 정책 컬럼, 콘테스트 메타데이터에 병합된 모든 홀드아웃, 테스트 스위트 및 상금 약관이 포함돼요. 이 계획은 행을 전송하는 것과 동일한 코드로 작성되므로, 실제 전송되는 내용과 다르게 표시될 수 없어요.
모든 레지스트리 행은 **신원 바인딩(identity-bound)**돼요: 데이터베이스는 이를 등록한 로그인 계정을 기록하고 이후의 수정으로부터 해당 바인딩을 동결하며, 자격 검정기는 **동일한** 신원이 등록한 봉인 세트만 제어할 수 있어요. 봉인된 세트는 격리된 상태로 생성되며(일반 콘테스트의 기반이 되거나 공개 리더보드에 순위가 매겨질 수 없음), 자격 검정기는 안전한 상태로 생성되고 등록 빈도가 제한돼요 — 이 모든 것은 저희 클라이언트를 포함한 모든 클라이언트 하위의 데이터베이스 트리거에 의해 강제돼요. 레지스트리 자체는 공개적으로 읽을 수 있으므로, 등록된 항목이 여러분이 봉인한 내용과 정확히 일치하며 그 이상도 이하도 아님을 직접 검증할 수 있어요.

**솔직한 한계점.** 셀프서비스 창구는 등록 전용(데이터베이스 레이어의 insert-only)이에요. **자격 검정기 교체 및 봉인된 세트 폐기는 여전히 큐레이터의 중재가 필요해요** — 이슈를 등록하거나 [GitHub](https://github.com/gamedaysuits/Champollion/issues)을 통해 프로젝트 팀에 문의해 주세요. 그리고 이후 단계에서 주최자 채점 노드를 실행하는 작업(수명 주기 진행, 인가 승인, 감사 작업)은 본인 노드에서 서비스 자격 증명을 사용하는 별도의 레인이에요 — 셀프서비스는 공개 기록 단계까지만 지원돼요.

## 5단계 — 관리인과 M-of-N 규칙 선택하기

여러분의 코퍼스에 대한 모든 평가를 공동으로 승인해야 하는 사람이나
기관, 그리고 임계값(예: **5명 중 3명**)을 선택하세요. 관리인은
Champollion이 아니라 여러분의 커뮤니티에 책임을 져야 합니다 —
커뮤니티별 조건이 어떻게 설정되는지는
[데이터 관리](/docs/network/sovereignty/data-sovereignty)와
[소유권 및 조건](/docs/network/sovereignty/ownership-transfer)을
참조하세요.

**솔직한 고지:** 임계값 *서명*(M개의 서명이 없으면 인가를 발행하는 것 자체가 물리적으로 불가능한 방식)은 **현재 개발 중**이에요. 오프라인 노드의 키 의식(`mt-eval node ceremony`, Shamir M-of-N)은 구현되어 있지만 아직 실제 관리자와 함께 사용된 적은 없어요. 그 외의 경우, M-of-N 규칙은 기록된 프로세스로서 강제돼요: 모든 접근 요청은 **대기(pending)** 큐에 들어가고, 관리자 결정이 기록되며, 인가된 요청에 대해서만 승인이 발행돼요. 각 승인은 **1회용이며, 유효 시간이 제한되고, 특정 (메서드, 말뭉치 버전, 평가 노드) 핑거프린트에 단단히 바인딩**돼요. 또한 차단된 시도를 포함한 모든 이벤트는 **추가 전용이며 해시 체인으로 연결된 공개 읽기 가능한 감사 로그**에 기록돼요. 데이터베이스는 모든 클라이언트와 키 아래에서 유효하지 않은 상태 전이를 거부해요. 다만 현재 시스템이 아직 거부할 수 없는 것은 플랫폼 운영자 자체의 침해예요 — 이는 임계값 서명이 해결하고자 하는 과제이며, 해당 기능이 출시되기 전까지는 "Champollion이 키 조각을 전혀 보유하지 않는다"는 점을 오늘날 바로 검증 가능한 특성이 아니라 지향하고 있는 설계 목표로 이해해 주셔야 해요.

## 6단계 — 상금을 설정하고 이용 약관을 선언해요

상금 설정은 선택 사항이에요. **상금 약관이 선언되지 않은 콘테스트는 단순히 상금이 없는 콘테스트가 돼요** — 이것이 기본값이며, 결코 격이 떨어지는 콘테스트가 아니에요.

상금을 제공하려는 경우, 다음 사항을 결정하여 콘테스트와 함께 공개하세요:

- **금액 및 통화.**
- **후원자** — 상금을 지급하는 주체.
- **자금 보관 위치** — 주최 조직의 계좌 또는 지정한 커뮤니티 신탁. **Champollion은 상금을 직접 보관하거나 에스크로하거나 중개하지 않아요.** 보관 주체의 신원을 사전에 공개해야 상금의 신뢰성이 확보돼요. 약관 템플릿의 [후원자 채무 불이행 위험 참고 사항](/docs/network/sovereignty/terms-templates#trojan-horse-risks)을 참고하세요.
- **임계 조건** — 메서드가 통과해야 하는 점수 기준으로, [상금 규격](/docs/network/specifications/prizes)에 따라 작성해요: chrF++ 임계값, 원하는 진단 게이트(최소 FST 수용률 등 — 출품작이 통과해야 하는 조건이며 점수 자체는 아님), 화자 검증 요건, 재현 가능성 등이 포함돼요. 기준 통과 여부를 누군가의 말(또는 저희의 말)에만 의존하지 않고 공개된 점수를 통해 직접 검증할 수 있도록 수여 조건을 구성하세요.
- **상금 약관** — 출품작 자체에 대한 처리 방식.

### 상금 약관은 주최자가 직접 선택해요

실행 방식은 고정되어 있어요: 소버린 콘테스트에서 참가자는 모델이나 메서드를 주최자에게 전달하고 주최자의 노드가 이를 실행해요. 그 *이후*에 출품작이 어떻게 처리될지는 주최자의 선택에 달려 있으며, 다음 세 가지 중 하나예요:

| 약관 | 참가자에게 알리는 내용 |
|---|---|
| `pass_to_holders` — *보유자에게 이전* | 메서드가 소버린 벤치마크 보유자(주최자)에게 이전돼요. 수상 여부와 관계없이 주최자가 채점하고 소유권을 보유해요. |
| `retain_ip` — *지식재산권 유지* | 참가자가 소유권을 유지해요. 주최자는 출품작을 채점하며 감사를 위해 최대 봉인된 사본 하나만 보관해요. |
| `release_open` — *오픈 소스 공개* | 참가자가 소유권을 유지하지만 오픈 라이선스로 메서드를 공개해야 해요. 해당 공개가 상금 수여 조건이 돼요. |

선택한 약관에 따라 세부 내용이 자동으로 결정되므로 복잡한 매트릭스를 채울 필요가 없어요: 보관 항목(`retention`), 권리 이전 여부(`rights`), 사용 목적(`host_use`), 참가자의 공개 의무 여부(`release`)는 모두 선택한 옵션에서 **자동으로 파생**돼요. 두 가지 옵션에서는 필드 하나를 세부 조정할 수 있어요:

- `retain_ip`의 경우, `--prize-retention delete_after_scoring`를 설정하면 채점이 완료된 후 결과물을 파기해요(기본값은 봉인된 감사용 사본을 보관해요).
- `release_open`의 경우, `--prize-release-timing`를 설정하면 공개 시점을 `required_before_scores` 또는 `required_after_prize`로 변경할 수 있으며(기본값은 `required_before_prize`), `--prize-release-license`를 통해 모든 OSI 승인 라이선스를 수용(`any_osi`)하는 대신 특정 라이선스를 직접 지정할 수 있어요.

파생되는 전체 표와 지급 전 각 옵션의 검증 방식은 [상금 규격 §2.1, 조건 7](/docs/network/specifications/prizes#condition-7-in-detail-the-term-is-one-choice-of-three)을 참고하세요.

```bash
# The term…
mt-eval contest prepare … --prize-disposition retain_ip

# …with the one narrowing that option offers
mt-eval contest prepare … --prize-disposition retain_ip \
  --prize-retention delete_after_scoring

# …or the same declaration from a JSON file
mt-eval contest prepare … --prize-terms my-terms.json
```

어떤 옵션을 선택하든 약관은 데이터가 기록되기 전에 **SHA-256** 해시와 함께 알기 쉬운 일반 언어로 화면에 출력돼요. 이 해시가 바로 동의 토큰 역할을 해요: 참가자가 `--accept-terms <hash>`를 전달하면 이 동의 내용이 번들에 패키징되고 콘텐츠 해시로 보호되며, 다른 조건에 동의한 번들은 노드에서 거부돼요. 약관은 콘테스트에 첫 출품작이 접수되는 순간 동결되므로, 참가자가 읽지 않은 약관에 구속되는 일은 발생하지 않아요.

상금 액수는 의도적으로 약관에 포함되지 *않아요*: 금액, 통화, 후원자는 콘테스트 기본 정보이며, 메서드의 소유권에 관한 약관은 지급 금액에 관한 진술과는 성격이 전혀 다르기 때문이에요.

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
  --prize-disposition retain_ip \
  --results-visibility hidden_until_close \
  --anonymize-until-close \
  --description "Community-custodied held-out set; scores-only; prize held by <your org/trust>."
```

이 플래그들 중 두 개는 이후 어떤 작업을 하든 데이터베이스에 의해 고정되거나 동결되며, 나머지 세 개는 **공약(promises)**이에요:

- `--use-context`는 콘테스트 신원의 일부예요: 콘테스트가 등록되는 순간 고정되며 절대 변경할 수 없어요(변경이 필요한 경우 새 콘테스트를 생성하세요). 기본값은 `non-commercial`예요.
- 순위 산정에 사용되는 지표인 `--primary-metric`(기본값 `chrf_plus_plus`)는 콘테스트에 첫 출품작이 접수되면 동결돼요. 이미 폐기된 `composite`를 지정하여 새 콘테스트를 만들려고 하면 사유와 함께 거부돼요. [채점 표준](/docs/network/specifications/scoring#how-runs-are-scored) 이전에 등록된 콘테스트는 계속 정상 작동해요.
- `--visibility`(기본값 `public`), `--description`, 접수 시작 여부는 동결되지 않아요.

콘테스트에 첫 번째 출품작이 접수되는 순간 다음 세 가지 공약이 동결돼요:

- `--prize-disposition` / `--prize-terms` — 6단계의 약관이에요. 둘 다 생략하면 콘테스트에 상금이 없어요.
- `--results-visibility hidden_until_close` — 노드가 측정한 모든 점수가 콘테스트를 종료할 때까지 **비공개로 유지**되므로, 참가자가 자신의 결과를 보고 봉인된 세트에 맞춰 튜닝하는 것을 방지해요. 이것이 기본값이며, 예시에서는 공약이 기록에 명확히 드러나도록 명시해 두었어요. 노드가 채점을 마치는 즉시 각 카드가 게시되는 실시간 리더보드를 원한다면 `--results-visibility immediate`를 전달하세요.
- `--anonymize-until-close` — 콘테스트가 진행되는 동안 참가자가 순위표에서 고유한 가명으로 표시돼요. (이는 주최자 순위 화면용이며, 공개 리더보드에 카드가 게시된 후에는 익명화되지 않아요.)

이 세 가지 플래그는 `contest prepare`와 `contest register`에서도 사용할 수 있으며, 콘테스트 생성을 대신해 주는 창구이므로 대부분의 주최자는 이곳에서 설정하게 돼요. `contest prepare --no-register`를 사용하면 전달한 등록 플래그(`--results-visibility`, `--anonymize-until-close`, `--primary-metric`, 상금 플래그, `--visibility`, `--use-context`, `--closed-intake`)가 `local/manifest.json`에 기록되며, `contest register --manifest`에 자체 플래그를 전달하지 않는 한 해당 값들이 적용돼요(기록된 값을 대체하는 경우 안내 메시지가 출력돼요). prepare 명령어는 등록이 이루어지기 전에 직접 지정한 값이나 기본값을 포함한 모든 약관과 변경 불가능해지는 시점을 출력해요. `--help`에는 각 기본값이 안내되어 있어요.

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

개발자는 1단계에서 공개된 **공개 개발 세트**를 바탕으로 메서드를 빌드하고 채점해요. 봉인된 세트의 `current_qualifier_id`가 해당 라운드를 지정하며, 봉인된 실행을 요청하기 전에 먼저 이 임계값을 통과해야 해요. 이를 통해 말뭉치에 대한 과도한 탐색 압력을 방지할 수 있어요: 공개 환경에서 실질적인 성능을 입증하기 전에는 누구도 봉인된 세트를 직접 겨냥할 수 없어요.

참가자는 오프라인에서 단 하나의 명령어로 이를 직접 실행할 수 있어요:

```bash
mt-eval contest qualify <contest-id> --dev my-dev-output.txt \
    --dev-corpus <the dev corpus you released> \
    --system "acme-nmt" --method-class pipeline \
    --offline-qualifier-id <qualifier id> --offline-threshold <threshold>
```

자격 검정기 ID와 임계값은 채점에 필요한 두 가지 핵심 정보이므로, 개발 세트 공개 시 둘 다 함께 공지하세요. `contest prepare`로 생성된 콘테스트의 경우, 자격 검정기 ID는 개발 말뭉치 자체의 ID(해당 `dataset.corpus_id`)이며, prepare 명령어가 개발 말뭉치 설명에 임계값을 기록해요. 두 개의 `--offline-…` 플래그를 지정하지 않으면 qualify는 콘테스트 데이터베이스에서 이를 대신 읽어와요. 이 방식은 참가자가 가리키는 엔드포인트에 콘테스트가 이미 등록되어 있을 때만 작동해요. 콘테스트가 없거나 데이터베이스에 연결할 수 없는 경우, qualify는 중단되며 참가자의 인수가 채워진 위의 오프라인 명령어를 출력해 줘요.

`--dev`는 개발 세트에 대한 참가자의 번역문을 말뭉치 순서대로 한 줄에 하나씩 받거나, 항목 ID를 키로 하는 JSON 형태로 받거나, `mt-eval run --corpus <the dev corpus>` wrote (or its `_report.json`) 형식의 실행 로그로 받아요. 실행 로그는 항목 ID별로 읽히며 동일한 개발 말뭉치에 대한 실행인지 검증돼요. 모든 항목이 채점되어야 하므로 오류가 발생한 항목이 있는 로그는 거부돼요. 그런 다음 요약에는 출력물이 해당 실행에서 하네스에 의해 생성되었고 해당 파일로부터 다시 채점되었다는 점(해당 실행의 비용 포함)이 명시되며, 하네스 외부에서 생성되었다고는 절대 표시되지 않아요. 순수 가설 파일만 외부 생성으로 설명돼요.

**통과가 곧 제출을 의미하지는 않아요.** 판정이 나온 후 qualify는 제출과 관련하여 미리 확인할 수 있는 내용을 안내해요. 머신에 폴더가 있는 메서드 플러그인 실행의 경우, `submit-method` 및 노드가 실행하는 것과 동일한 정적 검사(네트워크 라이브러리, 셸 네트워크 도구, 금지된 파일 시스템 경로)를 수행하고 모델 서버 호출을 위해 `urllib`를 임포트하는 플러그인처럼 거부될 만한 요소를 표시해 줘요. 하네스 자체 LLM 경로(공급자를 통해 접근하는 모델) 실행의 경우, 현재 상태로는 제출할 메서드가 없다고 안내해요: 노드는 네트워크 없이 출품작을 실행하므로 모델이 내부에 포함되어 있어야 하기 때문이에요(아래 *메서드가 호출하는 모든 모델을 번들링하세요* 참고). 그렇지 않은 경우 통과 안내 줄에 제출 시점에 남아 있는 추가 검사 항목들이 표시돼요. 이러한 내용이 판정 결과나 영수증을 바꾸지는 않아요.

자격 검정 점수(통과 기준)와 임계값을 0–100 chrF++ 자격 검정 척도로 나란히 출력하고, 점수의 구성 내용을 보여줘요: sacreBLEU 시그니처가 포함된 말뭉치 chrF++, 나란히 표시되는 기타 표준 지표(절대 혼합되지 않음), 통과 여부에 영향을 주지 않는 진단용 완전 일치(exact match), 그리고 점수 관련 주의 사항이 포함돼요. Qualify는 아무것도 외부에 게시하지 않아요. 개발 세트 출력물의 대부분이 원본 텍스트의 단순 복사본인 시스템은 점수와 무관하게 거부돼요: 출력물의 절반 이상이 원본과 동일한 경우(대소문자, 악센트, 문장 부호 무시, 인명 등 참조 번역 자체가 원본인 라인은 제외), 참가자가 번역을 수행하지 않은 것으로 간주해요. 노드가 이를 재실행할 때도 동일한 규칙에 따라 다시 거부돼요. 이 과정이 완료되면 참가자의 머신에 **자격 검정 영수증**이 작성되며, `submit-model`와 `submit-method`는 이 영수증 없이는 제출물 생성을 거부해요. 영수증은 콘테스트별 및 시스템별(`--system`)로 보관되므로, 두 개의 시스템에 대해 자격을 취득한 참가자는 둘 다 유지할 수 있어요. 동일한 시스템에 대해 다시 자격을 취득하면 이전 영수증도 함께 보관돼요. `submit-method`와 `submit-model`는 `--system`의 영수증(기본값: `--name`의 영수증, 또는 콘테스트의 유일한 영수증)을 사용하며, 모호한 경우 목록과 함께 거부해요. 영수증은 본질적으로 자체 보고된 내용이므로, 게이트 통과의 최종 기준이 되지 않아요. 승인이 요청되기 전에 **노드는 제출된 메서드를 동일한 개발 세트에서 재실행**하여 자체 측정값과 제출된 주장을 비교해요. 메서드를 과장한 영수증은 이 단계에서 거부되며, 거부 사유에 주장된 값과 측정된 값이 함께 명시돼요.

**영수증에는 출처가 된 실행이 명시돼요.** `--dev`가 실행 로그(또는 해당 `_report.json`)인 경우, 영수증에는 실행 정보와 실행된 모델이 기록돼요: `mt-eval run --method local-model -m <model>`의 경우 Hugging Face ID 및 리비전, 또는 파일들의 SHA-256이 포함된 모델 디렉터리가 기록돼요. 모델을 명시하지 않은 `local-model` 실행 로그는 거부돼요 — 초기 0.2.0 빌드는 해당 엔진에 `-m`를 전달하지 않아 대체 영어→스페인어 모델이 대신 실행되는 문제가 있었어요. 그런 다음 `submit-model`는 패키징하는 가중치가 영수증에 명시된 파일들에 포함되어 있는지 확인하고, 일치하지 않으면 두 해시를 모두 명시하며 거부해요. 순수 가설 파일로부터 채점된 영수증에는 모델이 명시되지 않으며, 노드의 재실행이 이를 검증하는 수단이 돼요.

**영수증과 노드 간의 차이는 플래그로 표시돼요.** 두 수치는 동일한 방식(동일한 채점기, 동일한 개발 세트, 모델의 경우 동일한 디코드 길이 규칙)으로 계산되므로 동일한 가중치라면 1점 미만의 근소한 차이 내에 들어오게 돼요. 노드의 측정값과 영수증의 값이 0–100 자격 검정 척도에서 **2.0점**을 초과하여 차이 나는 경우, 노드는 재실행 후 이를 명시해요. 에어갭 노드는 로컬 원장의 검사 기록과 함께 이 차이를 기록하고, `node approve --offline` 실행 시 관리자에게 다시 출력해 줘요. 이는 단순 플래그 표시일 뿐 거부 사유가 되지는 않아요: 노드 자체의 측정값이 게이트의 기준이 되기 때문이에요. (2.0점 기준은 민감하게 반응하도록 의도적으로 보수적으로 잡은 수치이며, 주최자가 정책적으로 재조정할 수 있는 값이에요.)

### 참가자는 제출 전에 모든 과정을 리허설해 볼 수 있어요

번들이 잘못 구성되었다는 사실을 며칠 뒤 거절 통보를 받고서야 알게 되는 일은 없어야 해요. `mt-eval contest validate`는 참가자의 머신에서 네트워크 없이 노드가 가장 먼저 실행하는 검사를 정확히 그대로 실행해요:

```bash
# the static checks your node runs on a bundle
mt-eval contest validate ./my-bundle.tar.gz

# …and the qualifier: does my dev output line up, and does it clear the bar?
mt-eval contest validate ./my-bundle.tar.gz --contest <contest-id> \
    --dev my-dev-output.txt --dev-corpus <released dev corpus>
```

결과 표를 출력하고, 거부될 만한 항목이 있으면 0이 아닌 종료 코드로 종료돼요(도구 연동 시 `--json` 사용). 참가 안내 시 이 명령어를 참가자들에게 안내해 주세요: 참가자는 명령어 한 줄로 검증할 수 있고, 주최자는 불필요한 거부 작업을 줄일 수 있어요.

`validate`는 아무것도 기록하지 않아요. 영수증을 작성하지 않고 개발 세트 출력물을 다시 채점한 뒤, 영수증을 점검해요:

- **패키징된 번들**(제출 명령어가 작성한 `.tar.gz`)은 함께 패키징된 영수증을 포함하고 있으며, 노드가 읽는 사본이 바로 이 사본이에요. 따라서 validate는 해당 사본을 기준으로 리허설을 점검해요. 또한 번들의 메서드 이름과 상관없이 사본의 출처가 된 참가자 머신의 영수증을 찾아 시스템 이름을 명시해요. `--system`가 다른 영수증을 가리키고 있거나, 패키징 이후 참가자가 해당 시스템의 자격을 다시 취득한 경우(번들에는 여전히 이전 영수증이 포함되어 있음) 경고를 표시해요. `--offline-…` 플래그가 없으면 자격 검정기 ID와 임계값도 해당 사본에서 가져오므로, 참가자가 `contest qualify`에 전달했던 값이 사용돼요. 검사 결과에 이 내용이 명시돼요.
- `--manifest`로 검사를 위해 패키징된 **소스 디렉터리**: validate는 `submit-method` 및 `submit-model`가 임베드할 영수증을 해당 명령어들과 동일한 탐색 방식(`--system`, 없으면 번들의 메서드 이름과 일치하는 영수증, 없으면 콘테스트의 유일한 영수증)으로 찾아 사용해요.

해당 영수증이 다른 개발 세트 출력물, 다른 개발 파일 또는 다른 자격 검정기를 대상으로 작성된 경우 경고를 표시해요. 영수증이 없는 경우에도 경고를 표시해요. 영수증은 `contest qualify`를 통해서만 생성돼요.

이것은 리허설이며, 화면에도 그렇게 명시돼요. 노드는 여전히 네트워크 없이 이미지를 빌드하고, 컨테이너를 실행하며, 자격 검정기를 직접 다시 실행해요. validate 검사를 문제없이 통과했다는 것은 *이미 알려진 문제*가 없다는 뜻일 뿐, 실제 실행 시 채점이 성공할 것임을 보장하는 것은 아니에요.

:::note[참가자 참고: 여러분의 콘테스트는 어느 엔드포인트에 있나요?]
**네트워크 호스팅** 콘테스트는 별도의 엔드포인트 설정이 필요하지 않아요 — 하네스 기본 제공 엔드포인트가 콘테스트 메커니즘(자격 검정기 게이트, 메서드 제안, 인가)을 지원하며, `mt-eval contest submit-model` / `submit-method`가 여기에 직접 통신해요. 하네스 **0.2.0 이상**(`mt-eval --version`)이 필요해요. 이전 릴리스에는 `qualify`, `validate`, `rank`, `close`가 포함되어 있지 않아요. 네트워크 호스팅 콘테스트는 주최자가 위의 주의 사항에 설명된 창구를 통해 등록된 경우에만 열리므로, 현재 대부분의 콘테스트는 **연합(federated)** 방식이에요.

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

각 출품작에 대해 다음 단계가 진행돼요:

1. 봉인된 세트를 대상으로 **요청(request)**이 접수돼요 — `pending` 상태로 들어가며, (번들 해시, 말뭉치 ID, 말뭉치 버전, `scores-only`, 평가 노드 측정값)으로 구성된 불변의 핑거프린트를 가져요.
2. 주최자 노드가 번들에 대해 **자체 정적 검사**를 실행해요. 코드 출품작(레인 B)의 경우 실행 가능 여부를 먼저 점검해요: 컨테이너 런타임이 설치되어 있는지, 번들이 요구하는 RAM, 임시 디스크 용량, 런타임이 `sandbox` 한도 내에 들어오는지 확인해요. 이 단계에서 일치하지 않더라도 메서드에 대한 최종 판정은 아니에요. 거부 메시지에 불일치 항목("8 GB RAM requested, this node allows 4 GB (sandbox.max_ram_gb)")이 명시되며, 아무것도 실행되거나 거절 처리되지 않고 요청은 원래 상태로 유지돼요. `node.json`에서 한도를 높이고 재제출 없이 `mt-eval node run-method <id>`를 다시 실행할 수 있어요. 또는 참가자가 거부 메시지에 출력된 플래그(예: `--ram-gb 4`)를 사용해 다시 패키징할 수도 있어요. 요구사항은 번들 해시 내부에 포함되므로 이는 새로운 요청이 돼요. 그런 다음 노드는 공개 개발 세트 사본에서 **참가자의 자격 검정 주장을 재실행**해요. 참가자의 영수증은 주장에 불과하며, 이것이 실제 측정값이에요. 기준에 미치지 못하면 관리자에게 승인을 요청하기 전이자 봉인 세트를 열기 전인 이 단계에서 거부되며, 거부 메시지에 주장된 값, 측정된 값, 기준값이 명시돼요. 콘테스트에 선언된 약관과 다른 상금 약관에 동의한 번들도 이 단계에서 거부돼요.
3. **관리자가 결정**(M-of-N)을 내려요. 승인 시 해당 핑거프린트에만 유효한 1회용 시간 제한 **승인(grant)**이 발행돼요.
4. 평가는 **주최자** 노드의 네트워크 격리 샌드박스(`mt-eval node run-method`)에서 실행돼요: 네트워크 스택이 없고 참조 번역이 외부에 보관되는 컨테이너 환경이며, 극대화된 격리를 위해 이동식 미디어로 서명된 점수 전용 번들을 주고받는 완전 에어갭 머신에서 실행될 수도 있어요(지원 범위는 위의 상태 박스를 참고하세요). 다크 노드(dark node)는 아무것도 업로드하지 않아요: 서명된 점수 번들을 외부로 반출하여 네트워크에 연결된 머신에서 실행 카드를 게시(`mt-eval node relay`)하게 돼요. 봉인된 홀드아웃과 선언된 모든 서드파티 테스트 스위트는 **동일한** 인가 실행 내에서 함께 실행되므로 관리자에게 추가적인 의식 부담을 주지 않아요.
5. **오직 점수만 외부로 반출돼요.** `scores-only` 방출 규칙은 데이터베이스 레이어에서 강제되므로, 말뭉치의 항목별 텍스트는 절대 외부에 공개되지 않아요.
6. 콘테스트에서 `hidden_until_close`를 약속한 경우 점수가 즉시 게시되지 않아요: 주최자만 볼 수 있는 지연된 결과로 **비공개 보류(withheld)** 처리되며, `contest close`가 순위를 동결하기 전에 보류된 모든 카드를 먼저 게시해요. 비공개 보류된 결과는 유실된 결과가 아니에요.
7. 요청, 투표, 승인, 사용, 차단된 시도를 포함한 모든 단계가 공개 해시 체인 감사 로그에 추가되어 주최자를 비롯한 누구나 재생해 검증할 수 있어요.

## 메서드 제출하기 (참가자용) — 두 가지 레인

대부분의 NMT 출품작은 크게 특별하지 않아요: 표준 파인튜닝된 트랜스포머와 가중치로 구성되죠. 이러한 출품작을 위해 **권장되는 무코드(code-free) 레인**이 제공되며, 실제 코드 형태의 메서드를 위한 샌드박스 대체 수단도 마련되어 있어요.

### 레인 A — 선언형 모델 (표준 NMT 권장)

메서드가 표준 신경망 모델이라면 가중치, 토크나이저, 설정 등의 **데이터** 형태로 제출하며, 주최자는 자체적으로 신뢰하는 추론 엔진에서 이를 실행해요. **Dockerfile도, 코드도, 샌드박스도 필요 없어요.** 제출한 내용 중 실행되는 코드가 전혀 없기 때문에, 주최자의 안전 검사는 임의의 코드가 안전한지 증명하려 애쓰는 대신 판정 가능한 형식 검증으로 대체돼요 — 이는 참가자와 말뭉치 모두에게 훨씬 더 강력한 안전성을 보장해요.

```bash
mt-eval contest submit-model <contest-id> \
  --model-dir ./my-model \          # config.json + model.safetensors + tokenizer.* at the ROOT
  --name "My NMT" --version 2.0 \
  --architecture MarianMTModel \    # must be on the organizer's trusted whitelist
  --method-class pipeline --paradigm neural-nmt \
  --track constrained --training-data-file ./training-data.txt \
  --parameter-count 92487 \
  --weights-license Apache-2.0 --weights-public \
  --developer "Your Name" --node-id <organizer-advertised-node-id> --agree
```

**NMT Forge로 학습된 모델.** `nmt-forge export`는 배포 가능한 폴더 `export/model/`를 작성해요. 가중치, 설정, 토크나이저 외에도 `forge-model.json`(비공개 테스트 세트에서의 해당 모델 점수 및 로컬 경로), `DEPLOY.md`, `champollion-plugin/`가 포함되어 있지만, 이 셋은 출품작의 일부가 아니에요. `submit-model`는 transformers가 읽는 파일(가중치, `config.json`, `generation_config.json`, 토크나이저 파일)만 패키징하고 제외된 모든 파일을 출력하므로, 이 세 파일은 자동으로 제외돼요. 해당 `DEPLOY.md`의 섹션 6에는 출품작을 구성하는 파일 목록, `config.json`의 아키텍처, 가중치 파일 헤더에서 읽은 매개변수 수가 정확한 명령어와 함께 나열되어 있어요. 직접 확인한 파일만 정확히 전송하려면 해당 파일들을 별도의 폴더에 복사한 후 `--model-dir`로 전달하세요:

```bash
mkdir -p lane-a
cp export/model/config.json export/model/generation_config.json \
   export/model/model.safetensors export/model/tokenizer.json \
   export/model/tokenizer_config.json lane-a/      # the files DEPLOY.md §6 lists
mt-eval contest submit-model <contest-id> --model-dir lane-a \
  --architecture MarianMTModel --paradigm neural-nmt …
```

**매개변수 수 기준.** 레인 A는 가중치 파일을 기준으로 `--parameter-count`를 검사해요. `safetensors` 헤더의 텐서 크기를 합산하며, 1% 이상 차이 나는 주장은 거부해요. 이것이 파일에 실제 저장된 값이며, PyTorch에서 측정한 수치와는 다를 수 있어요. 묶여 있거나(tied) 공유된 가중치는 한 번만 저장돼요. 모델 로드 시 재구성되는 테이블(예: 사인 곡선 위치 임베딩)은 아예 저장되지 않을 수도 있어요. 거부 메시지에 파일의 실제 매개변수 수가 출력되므로, 그 숫자를 선언하세요.

번들이 충족해야 하는 규칙(업로드 전 로컬에서 검증되고 주최자 노드에서 다시 검증됨):

- **가중치는 `safetensors` 형식이어야 하며, 절대 pickle을 사용할 수 없어요.** PyTorch의 `.bin`/`.pt`/`.ckpt`는 로드 시 임의의 코드를 실행할 수 있는 pickle 형식이므로 거부돼요. `model.safetensors` 형식으로 내보내세요(`safetensors` / `transformers`는 이를 기본 지원해요).
- **주최자 엔진이 기본적으로 로드할 수 있는 아키텍처여야 해요.** `config.json`의 `architectures`는 호스트의 `transformers`가 구현하는 모든 아키텍처(Marian, NLLB/M2M100, mBART, T5, Pegasus 등 다수)가 될 수 있어요 — 호스트는 **기본적으로 허용적**이에요. `trust_remote_code=False` 환경에서는 아키텍처 이름이 아니라 코드가 없는 데이터 형식 자체에서 안전성이 확보되기 때문이에요(지원되지 않는 아키텍처는 단순히 로드에 실패하고 아무것도 실행하지 않아요). 신중한 호스트는 허용 목록을 공개할 수도 있어요. `auto_map`와 `trust_remote_code`는 커스텀 코드를 다시 끌어들이므로 절대 허용되지 않으며 항상 거부돼요.
- **선언형 토크나이저**(`tokenizer.json` 또는 `sentencepiece` `.model` + 어휘집)를 사용해야 하며, **데이터 파일만 포함**해야 해요 — 번들 내에 `.py`/스크립트/바이너리가 포함되어서는 안 돼요.

**`submit-model`가 패키징하는 항목.** `--model-dir` 루트에 있는 데이터 파일들(`.safetensors`, `.json`, `.model`, `.txt`, `.spm`, `.vocab`, `.merges`): 가중치, 설정, 토크나이저 및 생성 설정이에요. 그 외의 모든 것(`README.md` 또는 `DEPLOY.md`, 하위 폴더, safetensors 옆의 pickle 체크포인트)은 제외되며, 명령어가 제외된 항목들을 나열해 줘요. 따라서 `nmt-forge export`가 작성한 `model/` 폴더는 그대로 제출할 수 있어요: `DEPLOY.md`와 `champollion-plugin/`는 자동으로 제외돼요. `contest validate`도 동일한 방식으로 패키징하며 제외된 파일들을 INFO 결과로 보고해요. 노드의 검사는 동일하게 유지돼요: 데이터가 아닌 파일이 포함된 번들은 노드에서 여전히 거부돼요.

**출력 길이 제한.** 노드는 항상 명시적인 길이를 사용하여 디코딩해요: 모델이 선언한 `max_new_tokens` 또는 `max_length`(해당 `generation_config.json`)를 사용하며, 없는 경우 문장당 최대 `max(64, 4 × source tokens)`개의 새 토큰(디코더의 최대 위치로 제한됨)까지 생성해요. `mt-eval run --method local-model`도 동일한 규칙으로 디코딩하므로 참가자의 영수증과 노드의 재실행 결과가 일치해요. `submit-model`는 적용될 길이를 출력하고 매니페스트(`model.decodeLength`)에 기록하며, 노드는 실행 팩트(`execution.generation`)에 적용된 길이를 기록해요. 명시적인 길이가 지정되지 않으면 transformers 라이브러리는 약 20개 토큰에서 중단되므로 모든 출품작이 잘린 출력물로 채점되는 문제가 생겨요.

주최자는 `trust_remote_code=False`를 사용하여 오프라인에서 이를 실행하며, 점수만 외부로 반출돼요 — `declarative-model`로 게시되며, 메서드 신원은 **구조상 코드가 없는 형태(code-free by construction)**로 보장돼요. (수 GB 단위의 대용량 가중치의 경우: 아래와 동일하게 스니커넷(sneakernet) 레인용 `--bundle-out`를 사용하세요.)

### 레인 B — 실행 가능한 번들 (코드 메서드용 샌드박스)

파이프라인, LLM 코칭 하이브리드, 커스텀 디코더 등 실제 코드 형태의 메서드는 선언형으로 실행할 수 없으므로 네트워크 격리 샌드박스를 거쳐야 해요. 이 레인은 실행을 거부하는 대신 신뢰할 수 없는 코드를 격리하여 실행하는 방식이므로 솔직히 보안상 더 취약한 레인이에요. 따라서 표준 모델인 경우에는 가급적 레인 A를 사용하세요.

**메서드가 호출하는 모든 모델을 번들링하세요.** 노드는 네트워크가 완전히 차단된 상태에서 출품작을 실행하므로 호스팅된 모델 API를 호출하는 메서드(클라우드 LLM에 질의하는 LLM 코칭 하이브리드, MT 서비스 등)는 응답을 받지 못해 채점 점수가 나오지 않아요. LLM 코칭 하이브리드는 LLM이 번들 내에 포함된 경우에만 자격을 취득할 수 있어요: `/method` 아래의 오픈 가중치를 프로세스 내에서 직접 실행하거나 진입점이 시작하는 로컬 서버를 통해 실행해야 해요. 메서드가 런타임에 읽는 사전, FST 또는 기타 데이터도 마찬가지예요. ([메서드 규격](/docs/network/specifications/methods#method-validity-and-dependency-classes)에서는 호스팅된 LLM이 필요한 메서드를 의존성 클래스 A1으로 정의하지만, 샌드박스 내에서 이를 허용하는 게이트웨이는 구현되어 있지 않아요.)

**실행 가능한 번들의 규약은 stdin/stdout이에요.** 컨테이너 내부에서 주최자의 노드는 정확히 다음 명령어를 실행해요:

```
cat /eval/source.txt | <your entrypoint> > /output/translations.txt
```

소스 문장은 stdin으로 한 줄에 하나씩 전달되며, 참가자는 번역문을 stdout으로 한 줄에 하나씩 작성해야 해요. 컨테이너에는 네트워크 스택이 없으며(`--network=none`), 읽기 전용 루트와 쓰기 가능한 `/tmp`를 가져요.

**파일 배치 위치.** `--method-dir`로 전달한 폴더 내의 모든 파일은 번들의 `method/` 아래에 패키징되며, 런타임에 가중치를 포함하여 **`/method` 위치에 읽기 전용으로 마운트**되므로 이미지 안으로 파일을 복사할 필요가 없어요. 다음과 같이 구성하세요:

```text
my-method/              ← --method-dir ./my-method
  translate.py          ← --entrypoint translate.py   (runs as /method/translate.py)
  weights/              ← read at /method/weights
  wheels/               ← vendored dependencies (see the Dockerfile below)
Dockerfile              ← --dockerfile ./Dockerfile
training-data.txt       ← --training-data-file ./training-data.txt
```

`--entrypoint`는 `--method-dir` 내부의 스크립트 경로예요. 번들 경로인 `method/translate.py`도 지원돼요. 이름이 서로 다른 두 파일을 가리킬 가능성이 있는 경우 명령어는 두 파일을 모두 명시하며 작업을 거부하고, 파일이 누락된 경우 검색한 모든 경로를 명시해 줘요.

**최소한의 Hugging Face transformers 래퍼:**

```python title="my-method/translate.py"
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
RUN python3 -m pip install --no-index --find-links=/wheels torch transformers sentencepiece
# Weights are NOT copied — /method is mounted read-only at run time.
```

**모든 제출물에 반드시 포함되어야 하는 항목.** 아래 항목들은 필수이며, 하나라도 누락되면 네트워크 단계로 넘어가기 전에 명령어가 중단돼요:

- `--method-dir`, `--dockerfile`, `--entrypoint`, `--name`, `--version`, `--method-class`, `--developer`, `--node-id`, `--agree`.
- 해당 콘테스트 및 시스템에 대해 **통과한 `mt-eval contest qualify` 영수증**(8단계. 둘 이상의 자격을 취득한 경우 `--system`로 지정).
- 사용자의 주장으로 기록되는 두 가지 선언: `--track constrained` 또는 `--track unconstrained`(기본값 없음), 그리고 `--parameter-count`.
- 학습된 가중치가 있는 메서드(0 초과의 `--parameter-count`)의 경우: `--weights-license <SPDX id or LicenseRef-…>` 및 `--weights-public` 또는 `--weights-private` 중 하나도 필수.
- **학습된 가중치가 없는** 메서드(규칙 기반, 사전, FST): `--parameter-count 0`를 사용하며 가중치 플래그를 생략해요. 제출 시 임의의 라이선스를 만들어낼 필요 없이 가중치 라이선스 및 공개 여부가 해당 없음(not applicable)으로 기록돼요.
- **LLM에 프롬프트를 전달하는** 메서드(학습하지 않고 프롬프트만 작성하는 경우): 매개변수 수는 직접 학습하지 않았더라도 번들이 실행하는 LLM을 포함한 모든 모델의 매개변수 합계예요. LLM의 모델 카드나 가중치 헤더에서 값을 확인하고, 가중치를 공개 다운로드할 수 있는 경우 `--weights-license`와 함께 LLM의 라이선스를 `--weights-public`로 전달하세요. `--parameter-count 0`로 지정하면 시스템 정보가 잘못 전달돼요: 0은 메서드가 모델을 전혀 실행하지 않음을 의미하기 때문이에요. 호스팅된 LLM을 호출하는 메서드는 봉인된 콘테스트에 절대 참가할 수 없어요: 노드에 네트워크가 없고 이러한 호출을 중계할 게이트웨이가 구현되어 있지 않기 때문이에요(위의 *메서드가 호출하는 모든 모델을 번들링하세요* 참고). 채점 대상 출력물이 제공자를 통해 생성된 경우 `contest qualify`에서 이미 이를 안내해요.
- `--track constrained` 사용 시: 학습에 사용된 데이터의 일반 텍스트 목록인 `--training-data-file` 필수(아무것도 학습하지 않은 메서드는 파일 내에 그렇다고 명시).
- 콘테스트에 상금 약관이 선언된 경우: `--accept-terms <hash>` 필수(이 플래그 없이 한 번 실행하면 약관과 함께 회신할 해시가 출력돼요). 설명이 필수인 콘테스트의 경우: `--description-file`.

**메서드가 선언하는 리소스.** 번들에는 필요한 RAM, 임시 디스크 공간, 실행 시간(wall-clock time)이 명시되며, 주최자의 노드는 `sandbox` 한도를 초과하여 요구하는 번들을 거부해요. 기본값은 `mt-eval node init`가 작성하는 노드 템플릿의 한도예요: `--ram-gb 4`, `--disk-gb 4`, `--max-runtime-minutes 30`, GPU 없음. 따라서 기본값으로 패키징된 번들은 템플릿 기본값으로 구성된 노드에서 문제없이 실행돼요. 메서드에 더 많은 리소스가 필요한 경우 해당 플래그들(및 `--gpu`)로 이를 명시하고, 주최자의 노드가 이를 허용하는지 확인하세요. 한도를 변경한 주최자는 콘테스트와 함께 이를 공지해야 해요. 노드가 거부할 경우 각 수치와 노드의 허용 한도가 거부 메시지에 명시돼요.

다음으로 제출하세요:

```bash
mt-eval contest submit-method <contest-id> \
  --method-dir ./my-method --dockerfile ./Dockerfile \
  --name "My NMT" --version 1.0 \
  --entrypoint translate.py \
  --method-class pipeline --paradigm neural-nmt \
  --developer "Your Name" --node-id <organizer-advertised-node-id> \
  --track constrained --parameter-count 78000000 \
  --weights-license Apache-2.0 --weights-public \
  --training-data-file ./training-data.txt \
  --primary \
  --agree
```

주최자의 노드는 관리자에게 실행 승인을 요청하기 전에 자체 공개 개발 세트 사본에서 참가자의 메서드를 재실행해요. `--agree`는 메서드 제출 약관에 동의함을 확인해요.

**수 GB 단위 가중치 또는 인터넷 연결이 없는 경우: 스니커넷(sneakernet) 레인을 사용하세요.** 호스팅된 접수 경로는 tarball을 콘테스트 호스트 스토리지에 **단일 POST**로 업로드하므로 호스트의 스토리지 업로드 제한을 받게 돼요 — 코드와 작은 모델에는 괜찮지만 수 GB 단위의 체크포인트에는 적합하지 않아요. 번들 규약 자체는 훨씬 더 큰 결과물(최대 100 GB의 tarball, 최대 150 GB의 빌드된 이미지)을 허용해요. `--offline`는 네트워크 연결 없이 번들을 패키징하고 교환 디렉터리를 작성해요. 연결이 없으면 읽어올 콘테스트 행이 없으므로 주최자가 공지한 값들도 필요해요: `--bundle-out`, `--secret-set`, `--pair`, `--developer-email`, `--offline-qualifier-id` 및 `--offline-threshold`(0–100 자격 검정 척도의 임계값). 가중치가 없는 규칙 기반 메서드를 오프라인에서 패키징하는 예시:

```bash
mt-eval contest submit-method <contest-id> \
  --method-dir ./my-method --dockerfile ./Dockerfile \
  --name "My Rules" --version 1.0 \
  --entrypoint translate.py \
  --method-class pipeline --paradigm rule-based \
  --developer "Your Name" --developer-email you@example.org \
  --node-id <organizer-advertised-node-id> \
  --track constrained --parameter-count 0 \
  --training-data-file ./training-data.txt \
  --agree \
  --offline --bundle-out ./exchange \
  --secret-set <sealed-set-id> --pair 'eng>crk' \
  --offline-qualifier-id <published-qualifier-id> --offline-threshold 35
```

exchange 디렉터리는 이동식 미디어(또는 양쪽이 신뢰하는 아무 채널)를 통해
주최자에게 전달되며, 주최자는 `mt-eval node import-bundle`로 이를 수집합니다.
번들의 SHA-256은 어느 방식이든 인증 요청에 고정되므로, 실행되는 것이 여러분이
제안한 것임을 증명할 수 있습니다.

**주최자 참고: 오프라인 제안도 온라인 제안과 마찬가지로 관리자의 승인을 기다려야 하며, 노드가 9단계 순서에 따라 먼저 검사를 수행해요.** 제안은 *대기(pending)* 요청으로 접수되며, 에어갭 노드는 데이터베이스나 서비스 키 없이 자체 검사와 관리자의 결정을 직접 기록해요:

```bash
mt-eval node import-bundle ./exchange               # stages it: PENDING custodian approval
mt-eval node run-method <request-id> --offline      # the node's checks: re-runs the entrant's qualifier, checks the container runtime
mt-eval node list --offline                         # what is staged, checked, approved or waiting, and the next command
mt-eval node approve <request-id> --offline --actor <custodian>
#   or: mt-eval node deny <request-id> --offline --actor <custodian> --reason "…"
mt-eval node run-method <request-id> --offline      # the sealed run: refuses until the approval is recorded
mt-eval node export-scores ./exchange               # signed scores, or the signed refusal
```

대기 중인 제안에 대한 첫 번째 `node run-method --offline` 실행은 봉인된 데이터를 열지 않아요. 공개 개발 세트(`node.json`가 선언하는 `qualifier` + `dev_corpus`. `node init --from-contest`가 둘 다 채워줌)에서 참가자의 자격 검정을 재실행하고, 코드 출품작의 경우 컨테이너 런타임의 존재 여부 및 번들이 선언한 RAM, 임시 디스크, 런타임이 `sandbox` 한도에 부합하는지 점검해요. 통과 기록은 노드의 해시 체인 로컬 원장에 작성돼요. 자격 검정을 통과하지 못하면 이 단계에서 거부되어 노드의 거부로 기록되고 서명된 거부 통보로 반환되며, 관리자에게는 승인이 요청되지 않아요. 노드가 출품작을 실행할 수 없는 경우(런타임 없음, 한도 부족)는 노드 측 문제로 거부되며 아무것도 기록되지 않고 요청은 원래 상태로 유지돼요.

`node approve --offline`는 해당 요청의 정확한 핑거프린트와 번들에 대한 검사 통과 기록이 원장에 존재할 때까지 승인을 거부하며, 오류 메시지에 먼저 실행해야 할 명령어를 안내해요. 검사가 확인되면 동일한 원장(관리자 공유 키 의식에서 사용하는 원장)에 투표와 인가를 기록하고, 승인이 이루어진 검사 내역을 명시하여 노드의 `signing_key`로 서명된 결정 기록을 작성해요. 두 번째 `node run-method --offline`는 봉인된 데이터가 실행되기 전에 세 가지 항목을 모두 확인하므로(원장 검증, 가져온 핑거프린트로 인가된 요청인지 확인, 서명된 기록 검증 및 해당 요청 명시 여부), 대기 중인 제안이 운영자의 독단적인 판단만으로 실행되는 일은 절대 없어요. 그런 다음 봉인 세트가 열리기 전에 런타임 검사와 자격 검정을 다시 실행해요. 거부 처리는 동일한 방식으로 기록되어 참가자에게 서명된 거부 통보로 반환되며, 관리자는 검사 여부와 상관없이 어느 시점에서든 거부할 수 있어요.
이미 인가된 상태로 도착한 요청 — 릴레이 내보내기(콘테스트 데이터베이스에서 인가됨) 또는 `node stage-request`(스테이징 주최자 자체가 인가 권한임) — 은 두 번째 결정을 거칠 필요가 없어요.

**주최자: 에어갭 머신에 베이스 이미지를 미리 로드하세요.** 이미지
빌드가 `--network=none`로 실행되기 때문에, Dockerfile의 `FROM` 베이스 이미지가
이미 머신의 로컬 이미지 스토어에 있어야 합니다. 연결된 머신에서
`docker pull python:3.11-slim && docker save -o base.tar python:3.11-slim`를 실행하고,
`base.tar`를 번들과 함께 가져간 다음, 에어갭 머신에서
`mt-eval node run-method`를 실행하기 전에 `docker load -i base.tar`를 실행하세요. 게시된 콘테스트
자료에서 참가자들과 베이스 이미지를 합의하세요.

## 10단계 — 순위 산정, 종료, 내보내기

점수 전용 결과는 다른 일반 실행과 마찬가지로 봉인 세트 평가로 표시되어 [리더보드](/docs/network/leaderboard/rules)에 게시돼요. 콘테스트 자체의 순위표를 구축하고 동결하며 게시하는 것은 주최자의 몫이에요:

```bash
mt-eval contest open-intake <contest-id>     # entry intake on — submit-model / submit-method admitted (owner only)
mt-eval contest close-intake <contest-id>    # intake off — work already received still scores
mt-eval contest rank <contest-id> --json     # provisional ranking, any time
mt-eval contest close <contest-id>           # one-way: freezes the ranking, shuts intake
mt-eval contest export <contest-id> --format csv --out results.csv
```

규칙에 명시할 수 있도록 `rank`의 작동 방식을 설명해 드릴게요: 출품작은 콘테스트에 **기록된 기본 지표**(생성 시의 `--primary-metric`, 기본값 chrF++)를 기준으로 순위가 매겨지며, 동점인 경우 chrF++ → BLEU → COMET → 최초 제출 순으로 순위가 결정돼요. **기본적으로 검증된 결과만 반영(verified-only by default)**되며(노드가 게시한 실행 카드), 숨겨진 자체 보고 카드가 있다면 그 수를 집계해요. 인접한 모든 쌍에는 라벨이 지정된 동점 판정이 포함돼요: 세그먼트별 행이 존재하는 경우 세그먼트별 대응 표본 유의성 검정을 수행하고, 그렇지 않으면 **95% 신뢰 구간 중첩**, 그것도 아니면 단순 점수 일치 여부를 사용해요. **봉인된 콘테스트는 세그먼트별 행을 절대 공개하지 않으므로**(설계상 집계 데이터만 공개), 대응 검정은 노드에서 대신 실행돼요. 종료하기 전에 노드에서 `mt-eval node verdicts --contest <id> --out verdicts.json`를 실행하세요. 노드는 텍스트 없이 서명된 판정 결과만 작성해요(쌍마다 p-값, 점수 차이, 신뢰 구간, 세그먼트 수 포함). 그런 다음 `--node-verdicts verdicts.json --verify-key <the node's .pub.json>` 옵션과 함께 콘테스트를 종료하세요. 판정 파일이 없으면 신뢰 구간 중첩을 기준으로 동점을 처리해요. 어느 쪽이든 출력에는 사용된 근거가 명시되며, 동점인 시스템은 동일한 순위를 공유해요(`1, 1, 3`).

`close`는 되돌릴 수 없는 단방향 작업이에요. 기록된 지표를 기준으로 순위를 매기며, 아직 채점 중인 제출물이 있으면 작업을 거부하고(강제 옵션을 사용하지 않는 한), 결과 표를 보여준 뒤 확인을 거쳐 콘테스트 기록에 순위를 동결해요. `export`는 결과 발표 페이지나 논문에 활용할 수 있도록 동결된 결과를 JSON 또는 CSV 형식으로 그대로 반환해요. 다른 세트(완전 비밀 T2 세트, 테스트용 개발 세트 카드 등)에서 채점된 카드는 별도로 나열되며 메인 순위에는 절대 섞이지 않아요.

### 결과 공개 시점 결정하기

콘테스트 생성 시 설정하는 두 가지 공약은 나중에 몰래 변경할 수 없어요 — 출품작이 접수되는 순간 데이터베이스가 둘 다 동결해요:

```bash
mt-eval contest create … \
  --results-visibility hidden_until_close \   # no score is visible while the contest runs
  --anonymize-until-close                     # pseudonyms in YOUR ranking artifacts
```

**`--results-visibility hidden_until_close`는 실제로 점수를 숨기는 옵션이에요.** 이 옵션이 설정되면 노드가 채점한 모든 카드가 즉시 게시되지 않고 보류돼요: 메서드는 정상 실행되었고 인가도 정상 사용되었으며 카드도 온전히 생성, 검증 및 저장되지만, 단순히 리더보드에만 노출되지 않는 상태예요. `contest close`는 보류된 모든 카드를 **먼저** 게시한 다음 순위를 구축하고 동결하므로, 어떤 결과도 유실되지 않으며 동결된 결과에는 보류되었던 모든 데이터가 반영돼요. 강제 종료 시에도 마찬가지로 처리돼요: 강제 종료는 아직 진행 중인 채점 작업을 정리하기 위한 것일 뿐, 공개해야 할 점수를 숨기기 위한 것이 아니에요. 동결된 스냅샷에는 종료 시 게시된 결과 목록이 정확히 나열돼요.

비공개 보류는 **유실된 실행이 아니라 명확히 기록된 상태**예요: 보류된 카드는 수정할 수 없으며, 카드가 게시된 위치를 가리키는 포인터는 한 번 작성되면 다른 곳을 가리키도록 재지정할 수 없어요 — 두 가지 모두 모든 클라이언트 하위의 데이터베이스에서 강제돼요. 콘테스트가 열려 있는 동안 `rank`는 현재 비공개 보류 중인 결과 수를 알려주므로, 미완성 상태의 임시 순위표가 완성된 것처럼 오해되는 일이 없어요.

**`--anonymize-until-close`의 역할은 조금 다르며, 그 차이를 정확히 알아두는 것이 좋아요.** 이 옵션은 콘테스트가 열려 있는 동안 주최자의 순위 결과물(`rank` 표, JSON, CSV)에서 참가자 이름을 결정론적인 가명으로 대체하고, `close`가 실행될 때 실제 이름을 공개해요. 공개 리더보드를 **익명화하지는 않아요**: 이미 게시된 카드에는 출품작이 선언한 참가자명이 그대로 표시돼요. 종료 전까지 참가자들이 서로의 결과를 보지 못하게 하려면 `--results-visibility hidden_until_close`를 사용해야 해요. 이 플래그가 그것을 대신할 수는 없어요.

메서드가 6단계에서 공개한 임계 조건(자동화된 게이트가 아닌 커뮤니티 고유의 게이트인 [화자 검증](/docs/network/specifications/speaker-validation) 포함)을 통과하면, 주최자(또는 지정한 신탁)가 직접 공개한 약관에 따라 상금을 수여해요. Champollion의 역할은 측정에서 끝나요.

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
