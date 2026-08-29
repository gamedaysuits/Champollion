---
sidebar_position: 3
title: "에이전트 가이드: 네트워크에서의 구축 및 벤치마킹"
description: "AI 에이전트가 번역 방식을 구축하고, 벤치마킹하여 리더보드에 제출하는 방법을 안내해요."
related:
  - label: "Submit a Method"
    to: /docs/network/getting-started/submit-a-method
    kind: guide
  - label: "Method Interface"
    to: /docs/network/specifications/methods
    kind: spec
  - label: "Eval Harness v2.0"
    to: /docs/network/specifications/harness
    kind: spec
  - label: "Agent Guide: Using champollion"
    to: https://champollion.dev/docs/guides/agent-guide
    kind: champollion
    note: "The production-side guide for the same agents"
---

# 에이전트 가이드: 네트워크에서 빌드 및 벤치마킹하기

Champollion 네트워크는 신뢰할 수 있는 번역 테스트 세트를 만들고, 사람이나 기계 등 모든 번역 방식을 이에 맞춰 측정할 수 있는 개방형 인프라예요. 무언가를 "이길" 필요는 없어요. 여러분이 빌드하고 벤치마킹하는 모든 방식은 누가 무엇을 얼마나 잘 번역할 수 있는지, 그리고 여전히 부족한 부분은 어디인지 보여주는 공유 지도에 하나의 점을 추가하게 되거든요. 번역 방식을 빌드하고, 실제 말뭉치를 대상으로 재현 가능한 점수를 매겨 지도를 채우는 데 도움을 주세요. 성능이 뛰어나고 커뮤니티가 배포하기로 선택한 방식은 프로덕션 환경에 적용될 수 있으며, 이를 통해 해당 언어 커뮤니티로 수익이 돌아갈 수 있어요.

:::tip[이것이 중요한 이유]
가장 큰 상업용 번역 서비스인 Google의 Cloud Translation은 194개 언어를 지원해요. Meta의 OMT-1600은 1,600개 이상의 언어를 지원한다고 주장하지만, 롱테일에 속하는 약 1,200개 언어(저자들이 모델이 "충분히 잘 이해한다"고 보고한 400여 개를 1,600에서 뺀 수치)의 경우 독립적인 평가를 통해 품질이 검증되지 않았으며 모델 가중치도 공개되지 않았어요. 네트워크는 독립적인 테스트 인프라를 제공해요. 여러분의 방식이 효과적이라면, 독립적으로 검증된 기계 번역(MT)이 존재하지 않는 언어의 프로덕션 환경에도 적용될 수 있어요.
:::

---

## 환경 설정

```bash
# Create a virtual environment (do NOT install into global Python)
python -m venv .venv
source .venv/bin/activate   # Linux/macOS
# .venv\Scripts\activate    # Windows

# Install the harness (provides the `mt-eval` command)
pip install mt-eval-harness
```

**API 키** — 테스트 하네스는 OpenRouter를 사용하여 LLM 모델을 호출해요. 키를 설정해 주세요:

```bash
# Option 1: export (session only)
export OPENROUTER_API_KEY="sk-or-..."

# Option 2: .env file (persistent, gitignored)
echo 'OPENROUTER_API_KEY=sk-or-...' > .env
```

[openrouter.ai/keys](https://openrouter.ai/keys)에서 키를 발급받으세요. 실험용으로는 무료 티어 모델도 충분히 작동해요.

---

## 첫 번째 벤치마크 실행하기

```bash
# Run a baseline LLM against a registered evaluation corpus
mt-eval run --corpus eval-amh-fra-globalvoices-test-v1

# Or specify a model explicitly
mt-eval run --corpus eval-amh-fra-globalvoices-test-v1 -m google/gemini-2.5-flash
```

테스트 하네스는 **실행 로그(run log)**를 생성해요. 이는 `eval/logs/`에 저장되는 JSON 파일로, 모든 번역 결과, 각 지표의 점수, 그리고 결과를 정확한 실험 구성과 연결하는 암호화된 지문(fingerprint)을 포함하고 있어요.

**유용한 플래그:**

| 플래그 | 기능 |
|------|-------------|
| `-m <model>` | OpenRouter 모델 슬러그 (다중 모델 병렬 실행 시 쉼표로 구분) |
| `-n, --name <name>` | 실행에 대한 사람이 읽을 수 있는 레이블 (리더보드에 표시됨) |
| `--temperature <float>` | 샘플링 온도 (낮을수록 더 결정론적임) |
| `--batch-size <n>` | API 호출당 항목 수 (기본값: 25) |
| `--dry-run` | API 호출 없이 구성 유효성 검사 |
| `--ids 0,1,2,3` | 특정 항목 ID만 실행 |

```bash
# Multi-model comparison (runs in parallel)
mt-eval run --corpus eval-amh-fra-globalvoices-test-v1 -m gemini-2.5-flash,claude-sonnet-4,gpt-4.1

# Dry run to validate config
mt-eval run --corpus eval-amh-fra-globalvoices-test-v1 --dry-run
```

기타 명령어: `mt-eval test <log.json>` (완료된 실행 점수 매기기), `mt-eval compare <log1> <log2>` (실행 결과 비교), `mt-eval dashboard <logs/*.json>` (HTML 대시보드 생성), `mt-eval list models --live` (사용 가능한 모델 찾아보기).

---

## 나만의 방식 빌드하기

테스트 하네스는 `TranslationMethod` 프로토콜을 구현하는 모든 Python 클래스를 허용해요:

```python
from mt_eval_harness.config import RunConfig

class YourMethod:
    """Build whatever you want inside. The harness only sees this interface."""

    async def translate(
        self,
        entries: list[dict],
        config: RunConfig,
    ) -> list[dict]:
        """
        Args:
            entries: [{"id": 1, "source": "Hello"}, ...]
            config:  RunConfig with source_locale, target_locale, model, etc.

        Returns: one result dict per entry, each containing:
            - id: int          — entry ID from the corpus
            - predicted: str   — the translated text
            - latency_s: float — time taken in seconds
            - usage: dict      — token usage {prompt_tokens, completion_tokens}
            - error: str|None  — error message if failed
            - metadata: dict   — any process-specific metadata
        """
        results = []
        for entry in entries:
            # Your translation logic here — LLM prompting, FST pipeline,
            # dictionary lookup, fine-tuned model, anything.
            translated = await self._my_translate(entry["source"])
            results.append({
                "id": entry["id"],
                "predicted": translated,
                "latency_s": 0.5,
                "usage": {"prompt_tokens": 100, "completion_tokens": 20},
                "error": None,
                "metadata": {"method": "my-custom-pipeline"},
            })
        return results
```

**구조적 타이핑(Structural typing)** — 클래스가 무언가를 상속받을 필요는 없어요. 올바른 `translate` 메서드 시그니처만 있다면 잘 작동해요. 즉, 얇은 래퍼(wrapper)만으로도 기존 파이프라인을 쉽게 조정할 수 있어요.

**하네스에 연결하기:**

```python
import asyncio
from mt_eval_harness.config import RunConfig
from mt_eval_harness.runner import execute_run

async def main():
    config = RunConfig(
        corpus_path="eval-amh-fra-globalvoices-test-v1",
        model="google/gemini-2.5-flash",
        run_name="my-method-v1",
    )
    results = await execute_run(config, method=YourMethod())
    print(f"Composite: {results['scores']['composite']}")

asyncio.run(main())
```

---

## 방식 아이디어

각각의 아이디어에는 구현 지침이 포함된 전체 쿡북이 있어요:

| 접근 방식 | 설명 | 쿡북 |
|----------|-------------|---------|
| **FST-gated pipeline** | 형태소 검증을 통해 LLM이 놓친 부분을 포착해요 | [튜토리얼](/docs/network/tutorials/fst-gated-pipeline) |
| **Coached LLM** | 프롬프트에 문법 규칙과 사전을 주입해요 | [튜토리얼](/docs/network/tutorials/coached-llm-prompting) |
| **Dictionary-augmented** | 용어의 일관성을 강제해요 | [튜토리얼](/docs/network/tutorials/dictionary-augmented-llm) |
| **Few-shot prompting** | 프롬프트에 번역 예시를 포함해요 | [튜토리얼](/docs/network/tutorials/few-shot-prompting) |
| **Fine-tuned model** | 병렬 데이터로 학습해요 (단, 평가 세트는 제외) | [튜토리얼](/docs/network/tutorials/fine-tuned-model) |
| **Chained models** | 다중 패스: 초안 작성 → 다듬기 → 검증 | [튜토리얼](/docs/network/tutorials/chained-models) |
| **Rule-based hybrid** | 결정론적 규칙과 LLM의 유연성을 결합해요 | [튜토리얼](/docs/network/tutorials/rule-based-hybrid) |

---

## 점수 이해하기

벤치마크 실행 후 다음과 같은 출력을 볼 수 있어요:

```
══════════════════════════════════════════════════
  Composite Score: 0.67 (Functional)
──────────────────────────────────────────────────
  chrF++:              0.72
  FST acceptance:      0.82
  Exact match:         0.31
  Morphological acc.:  0.88
  Semantic score:      0.64
══════════════════════════════════════════════════
```

*이해를 돕기 위한 예시일 뿐이에요 — 위 숫자는 레이아웃 예시이며 실제 결과가 아니에요.*

종합 점수(composite)는 문자 수준 정확도(chrF++), 형태소 유효성(FST 승인), 정확한 일치(exact match), 형태소 정확도, 의미 보존 등 여러 지표를 결합하며, 각각 정해진 가중치를 가져요. **가중치와 정확한 종합 점수 공식은 단일 진실 공급원(single source of truth)인 [채점 사양(Scoring Specification)](/docs/network/specifications/scoring) 한 곳에만 존재해요.** 가이드 페이지의 숫자를 복사하기보다는 사양 문서를 직접 읽어보세요. 숫자는 변경될 수 있으며 사양 문서가 공식 기준이거든요.

**품질 티어** (마찬가지로 [채점 사양](/docs/network/specifications/scoring)에 정의되어 있어요):

| 티어 | 종합 점수 범위 | 의미 |
|------|----------------|---------------|
| Baseline | 0.00–0.30 | [해당 언어의 무작위 확률](/docs/network/specifications/connection-strength) 미만 — 모든 정서법은 0이 아닌 확률 하한선을 가지며, 이는 언어마다 달라요 |
| Emerging | 0.30–0.50 | 가능성은 보이나 아직 사용할 수 없어요 |
| Functional | 0.50–0.70 | 사후 편집(post-editing)을 거치면 사용할 수 있어요 |
| **Deployable** | **0.70–0.85** | **원어민 검토를 거쳐 프로덕션에 적용할 준비가 되었어요** |
| Fluent | 0.85–1.00 | 원어민에 가까운 품질이에요 |

자세한 내용: [채점 사양](/docs/network/specifications/scoring)

---

## 리더보드에 제출하기

점수가 만족스럽다면 다음 단계를 진행해 주세요:

1. **실행 점수 매기기** — `mt-eval test eval/logs/your_run.json` 명령어로 점수가 매겨진 TestReport를 생성해요
2. **점수 검토하기** — `mt-eval dashboard eval/logs/your_run.json` 명령어로 시각적 대시보드를 생성해요
3. **제출하기** — [방식 제출하기](/docs/network/getting-started/submit-a-method) 가이드를 따라 진행해요

모든 제출물은 특정 구성 및 데이터셋 버전에 대한 지문(fingerprint)이 기록돼요. 무엇을 테스트했는지에 대한 모호함이 전혀 없어요.

---

## 기여 및 상금

지금 당장 할 수 있는 가장 유용한 일은 **지도를 채우는 것**이에요. 공개 대기열에서 벤치마크를 실행해 보세요. 상금 활성화 여부와 관계없이, 모든 실행은 리더보드와 번역 메시(mesh)에 데이터 포인트를 추가해요. [컴퓨팅 리소스 기여하기](/docs/network/getting-started/contributing-compute)를 참고해 주세요.

:::note[상금은 존재하더라도 부차적인 요소예요]
네트워크는 소외된 특정 언어 쌍에 대한 관심을 끌기 위해 때때로 후원 상금 풀을 지원해요. 이는 가장 필요한 곳에 노력을 집중하기 위한 방법일 뿐, 플랫폼의 주된 목적이나 토너먼트가 아니에요. 현재 상태는 [상금 사양](/docs/network/specifications/prizes)을 확인해 주세요. 상금은 특정 시점에 활성화되어 있을 수도 있고 아닐 수도 있어요.
:::

### 어뷰징 방지 아키텍처

상금을 위해 경쟁하든 리더보드를 위해 벤치마킹하든, 평가 아키텍처는 어뷰징(gaming)을 방지해요:

- **비밀 테스트 말뭉치.** 최종 평가는 개발자가 절대 볼 수 없는 골드 스탠다드(gold-standard) 데이터를 대상으로 실행돼요. 연습에 사용하는 개발 세트는 비밀 테스트 세트와 *달라요*. 개발 세트에 과적합(overfitting)되더라도 실제 테스트에는 적용되지 않아요.
- **샌드박스 실행.** 거버넌스 조직이 통제된 환경에서 여러분의 방식을 실행해요. 여러분은 점수가 아닌 방식을 제출하는 거예요.
- **커뮤니티 검증.** 지표가 완벽하더라도, 이중 언어 구사자가 결과물이 실제로 사용 가능한지 확인해야 해요.
- **재현성 확인.** 거버넌스 조직은 ±2% 오차 범위 내에서 여러분의 점수를 재현할 수 있어야 해요. 운 좋게 한 번 성공한 실행은 인정되지 않아요.

### 강력한 방식 빌드하기

:::tip[기회가 있는 곳]
가장 핵심적인 문제는 **형태소 환각(morphological hallucination)**이에요. LLM이 Cree어처럼 보이지만 실제 단어 형태가 아닌 문자열을 생성하는 현상이죠. 현재 방식들은 70-85%의 FST 승인율을 기록하고 있어요. 하지만 품질 임계값은 99% 이상을 요구해요. 올바른 접근 방식을 사용한다면 이 격차를 해결할 수 있어요.
:::

1. **개발 세트로 시작하기.** 등록된 평가 말뭉치를 대상으로 베이스라인을 실행하여 현재 품질을 파악해 보세요:
   ```bash
   mt-eval run --corpus eval-amh-fra-globalvoices-test-v1 -m gemini-2.5-flash
   mt-eval test eval/logs/your_run.json
   ```

2. **실패 원인 분석하기.** FST에서 거부된 단어들을 살펴보세요. 이것들이 바로 환각(hallucinated) 형태예요. 모델이 틀리는 형태소 패턴을 이해해야 해요.

3. **하이브리드 파이프라인 구축하기.** 가장 유망한 접근 방식은 다음을 결합하는 거예요:
   - **LLM 생성** — 번역 품질과 의미적 정확도를 위해 사용해요
   - **FST 검증** — GiellaLT FST는 유효하지 않은 단어 형태를 잡아내요. 이를 필터로 활용하세요
   - **거부 시 재시도** — FST가 거부한 단어를 형태소 힌트와 함께 다시 생성해요
   - **코칭 데이터** — 언어 규칙, 패러다임 표, 사전 항목을 프롬프트에 주입해요
   - **사전 증강** — 이중 언어 사전을 교차 참조하여 LLM의 선택을 검증하거나 재정의해요

4. **개발 세트에서 반복하기.** 개발 세트는 자유롭게 실험할 수 있는 공간이에요. 종합 점수, FST 승인율, chrF++ 점수를 추적해 보세요.

5. **리더보드에 제출하기** — 상금이 없더라도, 강력한 결과는 주목을 받고 해당 분야를 발전시키는 원동력이 돼요.

### 상금을 받게 되면 어떻게 되나요?

- **여러분이 유지하는 것:** 저작자 표시, 출판권, 리더보드에 이름 등재
- **커뮤니티가 얻는 것:** 해당 언어에 대해 여러분의 방식을 사용, 수정, 배포 및 수익화할 수 있는 권리
- **이전되는 것:** 모든 프롬프트, 코칭 데이터, 파이프라인 코드, 구성 등 전체 레시피. 상업용 LLM(Class A1)을 사용하는 방식이라면 레시피만 이전되며, 커뮤니티는 호환되는 모든 모델에 이를 적용할 수 있어요.

자세한 내용: [상금 사양](/docs/network/specifications/prizes) | [방식 인터페이스](/docs/network/specifications/methods#method-validity-and-dependency-classes)

---

## 프로덕션에 배포하기

검증된 방식은 프로덕션 번역 CLI인 [champollion](https://champollion.dev)을 통해 배포할 수 있어요. 테스트 하네스가 평가하는 것과 동일한 인터페이스가 실제 콘텐츠를 번역하는 플러그인이 돼요.

```bash
# Export your benchmark as a champollion plugin
mt-eval export --report eval/logs/report.json --name crk-v1 --type llm-coached --locales crk
```

**[→ 프로덕션에 배포하기](/docs/network/getting-started/deploy-to-production)** — 네트워크에서 만든 방식을 프로덕션으로 가져가세요.

---

## 문제 해결

| 문제 | 해결 방법 |
|---------|-----|
| `OPENROUTER_API_KEY not set` | 키를 내보내거나 `.env`에 추가하세요 (위의 설정 참고) |
| `Model not found` | `mt-eval list models --live` 명령어를 실행하여 사용 가능한 모델을 찾아보세요 |
| 모든 번역이 비어 있음 | API 키에 크레딧이 있는지 확인하세요. 먼저 `--dry-run` 명령어를 시도해 보세요 |
| `ModuleNotFoundError` | 가상 환경(venv)을 활성화하고 `pip install -e .` 명령어를 실행했는지 확인하세요 |
| 실행 로그가 저장되지 않음 | `eval/logs/` 폴더를 확인하세요 — 로그는 타임스탬프 이름으로 저장돼요 |

---

## 참고 항목

- [상금 사양](/docs/network/specifications/prizes) — 상금 풀 프레임워크, 임계값 및 청구 절차
- [방식 제출하기](/docs/network/getting-started/submit-a-method) — 단계별 제출 가이드
- [채점 사양](/docs/network/specifications/scoring) — 전체 지표 정의 및 가중치
- [하네스 사양](/docs/network/specifications/harness) — 아키텍처 및 구성 참조
- [리더보드 규칙](/docs/network/leaderboard/rules) — 제출 요구 사항
- [데이터 주권](/docs/network/sovereignty/data-sovereignty) — 원주민 데이터 주권 원칙, CARE 및 커뮤니티 거버넌스
- **기존 방식을 사용하고 싶으신가요?** [champollion 에이전트 가이드](https://champollion.dev/docs/guides/agent-guide)를 확인해 보세요 — 명령어 하나로 설치하고 번역할 수 있어요.
