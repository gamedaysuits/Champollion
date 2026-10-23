---
title: "레퍼런스"
slug: /reference
description: "모든 기술적 세부 정보를 하나의 지도에 담았어요: 명령어, 파일 형식, 사양, 기술적 제한, 봉인된 테스트 호스팅, 리더보드, 앱 및 사이트 번역, Atlas, 네트워크 인프라까지 살펴볼 수 있어요."
---

# 레퍼런스

개발자, 연구자, AI 에이전트를 위한 완전한 기술 기록이에요.
[사람을 위한 페이지](/docs/)에서는 같은 내용을 쉬운 말로 설명하고,
[에이전트 매뉴얼](/docs/agents)에서는 에이전트가 이를 구동하는 방법을 다뤄요.
아래의 모든 페이지는 이를 완전하고 정밀하게 기술하고 있어요.

## 명령어

- [`champollion`](/docs/reference/cli) — 프로젝트 도구 및 앱·웹사이트 번역기의 모든 명령어와 플래그예요.
- [`nmt-forge`](/docs/network/getting-started/forge-command-reference) — 모델 훈련 도구 모음의 모든 명령어이며, 파서로부터 생성돼요.
- [`mt-eval`](/docs/reference/mt-eval) — 평가 하네스의 모든 명령어이며, 파서로부터 생성돼요.
- [MCP 서버](/docs/network/getting-started/mcp-server) — 두 프로필과 모든 도구, 모든 인자예요.

## 포맷

- [프레임워크 포맷](/docs/reference/formats) — 스키마에서 정의하는 project/1, set/1, method/1, gate-chain/1, deployment/1, service-api/1이에요.
- [실행 카드](/docs/network/specifications/run-card) — 점수가 매겨진 실행 결과가 기록하고 공개하는 내용이에요.
- [코칭 데이터](/docs/concepts/coaching-data) — LLM 방식에 주어지는 문법 설명과 단어 목록이에요.
- [플러그인 규격](/docs/reference/plugin-spec) — 번역 방식이 배포되는 형태인 방식 플러그인 매니페스트(`method.json`)예요.
- [언어 카드](/docs/reference/language-card-spec) — Atlas에 수록되는 카드의 스키마예요.

## 규격

- [점수 산출](/docs/network/specifications/scoring) — scoring standard/1: 95% 부트스트랩 신뢰구간이 포함된 말뭉치 chrF++ 대표 점수, 함께 표시되는 표준 지표, 그리고 별도로 분리된 진단 지표예요.
- [유의성](/docs/network/specifications/significance) — 대응 표본 검정과 한 실행 결과가 다른 결과보다 우수한 시점이에요.
- [방식 인터페이스](/docs/network/specifications/methods) — 방식의 정의, 클래스 및 의존성이에요.
- [지표 신뢰성](/docs/network/specifications/metric-reliability) — 인간 평가를 바탕으로 어떤 유형의 언어에 어떤 지표를 신뢰해야 하는지 다뤄요.
- [벤치마크](/docs/network/specifications/benchmark) — 모든 유효한 실행이 따르는 프로토콜이에요.
- [하네스](/docs/network/specifications/harness) — `mt-eval`가 실행, 점수 산출 및 공개를 수행하는 방식이에요.
- [화자 검증](/docs/network/specifications/speaker-validation) — 자동 점수가 대체하고 있는 인간 평가예요.

## 기술적 한계

- [기술적 한계](/docs/network/honest-limitations) — 보장하지 않는 사항들: 자체 보고된 신뢰 등급, 아직 미실시된 화자 검토, 비공개 테스트 보관, 문장별 신뢰도 부재에 대해 다뤄요.

## 비공개 테스트 호스팅하기

- [자체 관할 대회 운영](/docs/network/sovereignty/run-a-sovereign-contest) — 호스트의 머신 밖으로 결코 유출되지 않는 테스트 세트를 위한 엔드투엔드 런북이에요.
- [자체 관할 평가 노드](/docs/network/sovereignty/sovereign-eval-node) — 점수 산출 머신: 하드웨어, 망 분리(air gap), 키 세레머니예요.
- [말뭉치 등록](/docs/network/sovereignty/registering-corpora) — 보유한 말뭉치의 공개 등급 및 라이선스 레인이에요.
- [소유권 및 약관](/docs/network/sovereignty/ownership-transfer) 및 [약관 템플릿](/docs/network/sovereignty/terms-templates) — 참가 전 선언되는, 출품작이 양도하는 권리 범위예요.
- [상금](/docs/network/specifications/prizes) — 스폰서가 상금을 개설할 때 필요한 요구사항이에요.

## 리더보드 및 공개

- [리더보드 및 공개](/docs/reference/leaderboard) — 리더보드의 정의, 두 가지 벤치마크 종류, 공개된 실행에 포함되는 정보예요.
- [제출 규칙](/docs/network/leaderboard/rules) — 승인 대상, 실격 사유 및 검증 등급이에요.
- [평가 데이터셋](/docs/network/leaderboard/datasets) — 등록된 데이터셋 및 해당 라이선스 레인이에요.
- [방식 제출하기](/docs/network/getting-started/submit-a-method) — 하네스를 실행하고 실행 카드를 공개해요.
- [컴퓨팅 자원 기여하기](/docs/network/getting-started/contributing-compute) — 본인의 키로 공개 대기열의 작업을 실행해요.
- [FAQ](/docs/network/getting-started/faq) — 지표, 모델, FST 및 실격에 관한 안내예요.

## 앱 및 웹사이트 번역

- [앱 및 웹사이트 번역](/docs/intro) — `champollion sync`가 하는 일과 관련 페이지 전체 안내예요: 빠른 시작, 설치, 설정, 프레임워크, CI/CD, 방식, 콘텐츠, 번역 메모리, 품질 게이트, 보안, 스크립트, 번역기 및 문제 해결.

## Atlas

- [Atlas](/docs/atlas) — 언어 색인의 정의와 사실 정보의 출처예요.
- [언어 카드 규격](/docs/reference/language-card-spec) 및 [인용 절차](/docs/reference/language-card-citation-procedure) — 모든 필드와 각 필드의 인용 방법이에요.
- [무엇을 언어로 볼 것인가](/docs/network/context/what-counts-as-a-language) — 색인이 제시하는 답과 그 이유예요.
- [색인에 제출하기](/docs/network/getting-started/submit-to-the-index) 및 [오류 제보하기](/docs/network/perspectives/reporting-errors-and-owning-corrections) — 항목 등록 또는 수정 제안이에요.

## 네트워크 인프라

- [대기열 구성](/docs/network/specifications/queue-construction) 및 [대기열이 이렇게 구성된 이유](/docs/network/perspectives/why-the-queue) — 공개 작업 대기열이 다음에 측정할 항목의 순위를 정하는 방식이에요.
- [연결 강도](/docs/network/specifications/connection-strength) — 네트워크 맵의 호(arc)가 언어 쌍에 대해 나타내는 의미와 폐기된 강도 단계에 대해 다뤄요.
- [컴퓨팅 자원 기여하기](/docs/network/getting-started/contributing-compute) — 대기열 실행하기예요.
