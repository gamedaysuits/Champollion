---
title: "봉인된 테스트 주최하기, 그리고 프로젝트 참여하기"
slug: /agents/hosting-and-joining
description: "직접 구축하는 것 외에 참여할 수 있는 두 가지 방법이 있어요. `mt-eval contest`와 `mt-eval node`로 봉인된 테스트를 주최하는 방법(정상 작동하지만 아직 레일 위에 올라가 있지는 않으며, 주최자가 선택한 보관인들이 키 조각을 보유해요), 그리고 `mt-eval project`로 등록된 프로젝트에 참여하는 방법이에요. 모든 명령어와 어떤 내용을 어디로 보내는지, 그리고 무엇을 절대 보여주지 않는지 안내해요."
---

# 비공개 테스트 호스팅 및 프로젝트 참여하기

빌드 레일 옆에 마련된 두 개의 레인이에요. 둘 다 일반 `mt-eval` 명령어이며, 어느 쪽도 `champollion next`이 지정하는 단계는 아니에요.

## 비공개 테스트 호스팅하기

**현재 상태 안내.**

- 작동하는 기능: 비공개 세트 준비, 키 세레모니, 에어갭 노드에서의 제출물 실행, 판정 및 순위 산정은 모두 테스트를 거친 명령어예요.
- **아직 레일 위에 올라와 있지 않아요.** `champollion new --kind task` 요청은 거부돼요. 지원되는 여정은 언어 여정뿐이에요. 더 긴 수동 절차를 거쳐야 하므로, [콘테스트 운영 안내서](/docs/network/sovereignty/run-a-sovereign-contest)를 따라 진행해 주세요.
- **키 조각은 주최자가 지정한 수탁자가 보관해요.** 코드에는 이들을 임명하거나 검증하는 기능이 없어요. 어떤 테스트에 대해서도 커뮤니티 키 수탁자가 지정된 적은 없어요.
- **Champollion은 키 조각이나 개인 키를 일절 보유하지 않아요.** 세레모니는 주최자의 컴퓨터에서 실행되며, 등록 시 식별자, 다이제스트, 예선 통과 기준값만 전송돼요. 키, 키 조각, 문장은 절대 전송되지 않아요.

**참고.** 호스팅은 사람들의 문장에 어떤 일이 일어나는지, 그리고 누가 그 문장의 잠금을 해제할 수 있는지를 결정해요. 아래의 모든 단계는 주최자의 결정에 따라 진행돼요. 주최자가 요청할 때만 각 단계를 실행해 주세요.

### 만들어지는 것

`mt-eval contest prepare` 명령어가 주최자의 말뭉치를 분할해요:

| 플래그 | 세트 | 볼 수 있는 사람 |
|---|---|---|
| `--dev-size` (필수) | 예선 세트: 원문 및 참조 번역문 | 공개, `<out>/public/`에서 배포 |
| `--secret-size` | 콘테스트가 등록되는 비공개 테스트 세트 | 아무도 볼 수 없음: `<out>/local/`로 봉인됨 |
| `--sealed-holdout-size` (`--secret-size` 필요) | 두 번째 비공개 분할 세트, 점수는 매겨지지만 종료 시까지 비공개 유지 | 아무도 볼 수 없음 |

`--seed`, `--qualifier-threshold`(0 초과), `--license`는 필수예요. 라이선스는 임의로 가정되지 않아요. `--custodian-group` 및 `--threshold-pubkey`도 필수 항목이에요(비공개 세트가 암호화될 대상 키). 각 비공개 세트의 일반 텍스트는 봉인 후 삭제돼요. `<out>/local/manifest.json`는 레시피를 보관하며 컴퓨터 외부로 절대 나가지 않아요. 봉인 과정에서 `champollion network seal-corpus seal`가 실행되므로 `champollion` CLI가 설치되어 있어야 해요.

### 수탁 관리

**임계값 수탁 관리 (M-of-N).** 에어갭 노드에서 진행돼요:

```bash
mt-eval node ceremony init --dir <ceremony> --set <sealed set id> --group <group id> --quorum 3 --shares 5 \
  --custodian <name 1> --custodian <name 2> --custodian <name 3> --custodian <name 4> --custodian <name 5>
mt-eval node ceremony share --dir <ceremony> --custodian <name 1> --dest <their token>
mt-eval node ceremony verify --dir <ceremony> --share <a> --share <b> --share <c>
mt-eval node ceremony share --dir <ceremony> --wipe-originals
```

`init` 명령어가 키를 생성하고, Shamir의 방식을 사용하여 키를 분할한 뒤, 한 번의 호출로 키를 완전히 지워요. 그런 다음 `ceremony.json`(공개 기록)와 수탁자당 하나의 키 조각 파일을 작성해요. `--set`는 비밀 세트의 ID여야 하고, `--group`는 준비 시 사용할 `--custodian-group`여야 해요. prepare는 이를 확인하지 않으며, 불일치 여부는 실행이 거부될 때만 알 수 있어요. prepare에 세레모니 기록을 전달하세요: `--threshold-pubkey <ceremony>/ceremony.json`.

**잠금.** 비공개 세트는 해당 세트와 ID가 일치하는 서로 다른 수탁자의 키 조각이 최소 M개 이상 제공된 `mt-eval node run-method <id> --offline --share … --share …` 명령어로만 복호화할 수 있어요. 임계값 수탁 관리는 이 오프라인 레인에서만 실행돼요.

**단일 키.** `champollion network seal-corpus keygen --out <dir>`는 하나의 키 쌍을 만들어요. 해당 키 파일을 가지고 있는 사람이라면 누구나 단독으로 복호화할 수 있어요. 연결된 노드 레인에서 사용하는 방식이에요.

### 주최자 절차 (임계값 수탁 관리)

```bash
mt-eval node bundle --out <bundle>                    # on a connected machine: the node's install
mt-eval node bundle --verify <bundle>                 # on the node
mt-eval node keygen --out <keys>
# the ceremony, above
mt-eval contest prepare --corpus master.json --slug <slug> --name "<name>" --pair '<src>><tgt>' \
  --dev-size <n> --secret-size <n> --seed <n> --qualifier-threshold <chrF++> --license <licence> \
  --custodian-group <group id> --threshold-pubkey <ceremony>/ceremony.json --out ./<slug> --no-register
mt-eval contest register --manifest ./<slug>/local/manifest.json
mt-eval node init --from-contest ./<slug>
mt-eval node egress-check
mt-eval node import-bundle <exchange>                 # entries, carried in
mt-eval node run-method <request id> --offline --share <s1> --share <s2> --share <s3>
mt-eval node export-scores <exchange>
mt-eval node verdicts --contest <slug> --out verdicts.json --metric chrf_plus_plus --tie-test ar \
  --alpha <a> --n-resamples <n> --seed <n>
mt-eval contest rank <slug>
mt-eval contest close <slug> --node-verdicts verdicts.json --verify-key <score-signing public key>
```

세트가 세레모니 키로 봉인된 경우 `node init --from-contest`가 임계값 수탁 관리를 설정해요. 참가자는 공개 개발 세트(`mt-eval contest qualify`) and submit methods or models (`mt-eval contest submit-method`, `mt-eval contest submit-model`, 둘 다 `--offline --bundle-out` 경로 사용)에서 자격을 얻어요. 모든 노드 명령어는 [노드 안내서](/docs/network/sovereignty/sovereign-eval-node)에서 확인할 수 있어요.

### 연결이 필요한 작업과 필요한 권한

| 오프라인 작동 | 로그인 필요 | 데이터베이스 서비스 키 필요 |
|---|---|---|
| `contest prepare --no-register`, `contest qualify`(`--offline-qualifier-id`, `--offline-threshold` 사용), `contest validate`, `submit-* --offline`, 모든 `node ceremony`, `node seal`, `node keygen`, `node init`, `node import-bundle`, `node run-method --offline`, `node export-scores`, `node verdicts`, `node egress-check` | `contest register`, `contest create`, 온라인 `submit-*`, `contest open-intake`, `contest close-intake`, `contest close` | `--no-register` 또는 `--self-serve` 없는 `contest prepare`, `node serve`, `node list`, `node approve`, `node deny`, 온라인 `node run-method`, `node relay`, 그리고 결과가 비공개된 경우의 `contest close` |

서비스 키는 데이터베이스를 운영하는 사람에게 속해요. 외부 주최자는 자신의 데이터베이스(`MT_EVAL_SUPABASE_URL` 및 해당 키)를 대상으로 이를 실행하거나 오프라인 레인만 사용해야 해요. 오프라인 레인의 점수는 서명된 매니페스트를 통해 검증할 수 있지만 공개 순위표에는 등록되지 않아요. **참고.** `MT_EVAL_ALLOW_PROD`를 설정하지 마세요. 기본 프로덕션 데이터베이스에 대한 도구의 쓰기 거부 정책이 해제되며, 이는 에이전트가 결정할 사항이 아니에요.

## 프로젝트 참여하기

**등록된 프로젝트**는 문장, 단어 목록 또는 번역 방법 등의 파일로 다른 사람들이 도울 수 있도록 소유자가 등록한 언어 프로젝트예요(검토 시간과 컴퓨팅 지원은 아직 제공되지 않아요). 아래의 `mt-eval project` 명령어는 프로젝트 데이터베이스(`MT_EVAL_SUPABASE_URL`)와 통신해요. `list`(익명)와 `review`(운영자용)를 제외한 모든 하위 명령어는 로그인이 필요해요(캐시된 세션, `MT_EVAL_REFRESH_TOKEN`, 또는 대화형 GitHub나 Google 로그인). 계정은 로그인한 이메일이에요.

**규칙.**

- **등록 전 검토.** 새 프로젝트는 `pending_review` 상태로 시작되며, 검토를 거친 후에만 등록 목록에 표시돼요. 소유자는 프로젝트를 닫을 수 있으며, 등록 목록에 표시하지 않을 수도 있어요.
- **소유자 이름은 원하는 대로 지정돼요** (`--owner-name`). 프로젝트 행에는 이메일이 포함되지 않으며, 소유자의 계정은 분리되어 소유자 본인만 읽을 수 있어요.
- **등록 목록에 이메일 표시 안 됨.** `project list`는 익명으로 이름과 개수만 표시해요. `project offers`는 도움을 준 사람들을 직접 입력한 이름(`--as`)으로 출력해요. 소유자 계정은 제안 기록에서 참여자의 계정 이메일을 여전히 읽을 수 있으며, 동의서에는 두 계정이 모두 기록돼요.
- **제안은 양측 모두 보관해요.** 제안을 수락하면 제출한 사람과 승인한 사람의 이름이 적힌 동의서가 작성돼요.
- **파일 내용은 출력되지 않아요.** 이름, 개수, 상태만 표시돼요.

### 소유자

```bash
mt-eval project register --project . --name "<project name>" --owner-name "<as they want to be named>" \
  --purpose "<what the translations are for>"
mt-eval project ask <slug> --kind sentences --what "<what would help>" --how-many 200 --terms "<their terms>"
mt-eval project offers <slug>
mt-eval project accept <offer id> --into .
mt-eval project decline <offer id> --why "<reason>"
```

- `register`는 `champollion.project.json`에서 언어 쌍을 읽어와요(`--purpose`가 아닌 한 목적도 함께 읽음). 선택 사항으로 `--slug`, `--domain`, `--register`, `--about`가 있어요. 계정당 24시간 동안 최대 5회까지 등록할 수 있어요.
- `ask`의 `--kind`는 `sentences`, `word-list` 또는 `method`예요. 요청은 프로젝트가 등록 목록에 표시되어 있는 동안에만 나타나요.
- `accept`는 파일을 다운로드하고, **sha256 해시를 검증하며**(불일치 시 거부), `inbox/offer-<offer id>-<file name>` 및 `consent/offer-<offer id>.json`(`offer_id`, `file`, `sha256`, `submitted_by`, `authorized_by`, `terms`, `note`, `held_by`)를 작성한 뒤 제안을 수락 상태로 표시해요. 그런 다음 파일은 다른 일반 파일과 마찬가지로 가져와지며(`champollion data add inbox/<file>`), 보유자의 조건이 확인돼요.
- **참고.** 참여자의 `--terms`는 동의서에 담겨 있어요. `champollion data mark`로 기록하는 답변이 이 조건을 완화해서는 안 돼요.

### 참여자

```bash
mt-eval project list
mt-eval project offer <slug> <file> --as "<your name>" --terms "<what it may be used for>" --ask <ask id> --note "<note>"
mt-eval project withdraw <offer id>
```

- `offer`는 비어 있지 않은 최대 50MB 크기의 파일 하나를 sha256 값과 함께 프로젝트의 비공개 스토리지로 업로드해요. 등록 목록에 있는 프로젝트에만 가능해요. 참여자당 24시간 동안 최대 24회까지 제안할 수 있어요.
- 제안 상태는 한 번만 변경돼요: `offered` → `accepted`, `declined` 또는 `withdrawn`.
- **참고.** 제안을 철회하거나 거절하면 제안의 상태가 바뀌지만, 스토리지에서 업로드된 파일이 삭제되지는 않아요. 나중에 되돌리고 싶을 수 있는 파일을 제안하기 전에 참여자에게 이 점을 미리 알려주세요.
- **잠금.** `offer`는 파일을 업로드하기 전에 사이드카 파일을 먼저 확인해요. `local-only` 파일, `sealed` 세트, 그리고 `speakers_agreed`가 `not-yet` 또는 `some-said-no`인 파일은 거부돼요. 사이드카를 읽을 수 없으면 제안이 중단돼요. 이를 무시하고 진행할 방법은 없어요. 표시는 권리 보유자만이 변경할 수 있어요. `training: not-allowed` 조건이 제안 조건에 추가되어 소유자가 볼 수 있게 돼요.
- **참고.** 제안을 진행하면 파일이 참여자의 컴퓨터에서 프로젝트 데이터베이스의 스토리지로 전송돼요. 반드시 참여자에게 먼저 묻고, 참여자 대신 파일을 제안하지 마세요.

`mt-eval project review`는 데이터베이스 운영자용 명령어예요(서비스 키 사용). 에이전트가 사용하는 명령어가 아니에요.

## 더 알아보기

- [비공개 테스트 호스팅하기](/docs/host-a-sealed-test) 및 [프로젝트 참여하기](/docs/join-a-project) — 일반 사용자를 위한 안내예요.
- [소버린 콘테스트 운영하기](/docs/network/sovereignty/run-a-sovereign-contest) 및 [소버린 평가 노드](/docs/network/sovereignty/sovereign-eval-node).
- [소유권 이전](/docs/network/sovereignty/ownership-transfer) 및 [이용조건 템플릿](/docs/network/sovereignty/terms-templates).
- [데이터 및 전송 규칙](/docs/agents/data-rules) — 봉인 세트 및 로컬 전용 파일 안내예요.
- [`mt-eval` 레퍼런스](/docs/reference/mt-eval).
