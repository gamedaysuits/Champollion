---
title: "nmt-forge로 훈련하기"
slug: /agents/training
description: "nmt-forge가 레일 위에서 모델을 훈련하고 테스트하는 방법: 모델 프리셋과 메모리에 따라 --model auto가 선택하는 항목, 명령어별 보호 루프, 디코딩 및 길이 제한, 백그라운드 작업과 한 번에 하나씩 훈련하는 대기열, 디스크 공간(보관되는 체크포인트, 디스크 검사, tidy), 내보내기 및 서빙, 개선 라운드(라운드 판정, 화자 판정)와 더 강력한 모델 제안, 합성 데이터, 검증된 증상 → 원인 → 해결 방법 표, 실패 분류 체계를 살펴봅니다."
---

# nmt-forge로 훈련하기

`nmt-forge`은 가드레일 안에서 사람들이 모은 말모음 쌍으로 모델을 훈련해요. 결과를 왜곡할 수 있는 요청은 거부하며, 거부할 때마다 무엇이 문제인지, 이유가 무엇인지, 어떻게 해결하는지 알려줘요. 자체 메트릭은 구현하지 않으며, 모든 점수는 다른 모든 항목을 평가할 때와 동일한 코드인 평가 엔진(`mt-eval`)에서 나와요.

레일 위에서는 이 명령들을 직접 입력할 일이 거의 없어요. `champollion next`이 명령을 알려주고, `forge` 단계부터는 forge 자체의 어드바이저(`nmt-forge status`)를 전달해 줘요. 이 페이지에서는 각 단계에서 무슨 일이 일어나는지 설명해요.

## 모델

`nmt-forge init --model <preset>`은 프리셋을 명시적인 수치로 `config.json`에 기록해요(각 런의 식별자에 해시로 포함되므로, 이후 forge 릴리스가 나와도 기존 프로젝트의 런이 변경되지 않아요). `nmt-forge use-model <preset>`은 프로젝트를 전환해요.

| 프리셋 | 설명 | 요구 사항 | forge가 안내하는 예상 성능 |
|---|---|---|---|
| `cpu-tiny` | 훈련 데이터 행에서 학습한 4,000개 어휘 조각을 사용해, 말모음 쌍으로 처음부터 훈련하는 작은 트랜스포머 모델 | CPU 전용 · 다운로드 없음 | "약 1천~2천 쌍 기준: chrF++ 약 5~30(상위 점수는 템플릿화가 매우 잘 된 데이터에 한함) — 암기된 문구와 데이터의 템플릿 수준이며, 일반적인 번역은 아님" |
| `byt5-small` | Google의 ByT5-small(매개변수 3억 개, 바이트를 읽어 맞출 어휘집이 없음)을 미세 조정 | 약 1.2GB 다운로드 · Apple silicon 또는 CUDA GPU 권장 | "forge 자체 테스트에서는 동일한 쌍에서 cpu-tiny보다 훨씬 더 많이 학습함 — 그래도 개발 세트에서 현재 사용 중인 모델과 비교해 측정해야 함" |
| `byt5-small-lowmem` | 8~15GB 메모리를 갖춘 컴퓨터용으로 설정된 동일 모델, 동일 학습률 및 길이 제한: Adafactor, 그래디언트 체크포인팅, 4쌍 배치 4회 누적(스텝당 동일하게 16쌍) — 스텝당 메모리는 적게 들고 시간은 더 걸림. 8GB 컴퓨터에서는 아직 측정되지 않음 | `byt5-small`와 동일 | `byt5-small`와 동일 |
| `cpu-finetune` | CPU에서 미세 조정한 작은 사전 훈련 Marian/opus-mt 모델. 베이스(`--base`)를 직접 지정해야 하며, 자동으로 추측하지 않음 | CPU 전용 · 약 300MB 다운로드 | "베이스의 타깃 언어가 얼마나 관련되어 있는지에 따라 달라짐 — 개발 세트에서 cpu-tiny와 비교해 측정해야 함" |
| `nllb-600m` | LoRA를 적용한 NLLB-200 distilled 600M | CUDA GPU (8GB 이상) · 약 2.5GB 다운로드 | "NLLB가 관련 언어를 다룰 때 세 모델 중 가장 강력함. 그래도 직접 측정해야 하며, 절대 짐작으로 넘겨짚지 말 것" |

모든 프리셋은 시드 42와 함께 forge의 훈련 엑스트라(`nmt-forge[hf]`)를 사용해 훈련해요. 어떤 프리셋도 시간 예산을 정해두지 않아요. 그 수치는 사람들이 직접 결정해요.

- **`--model`이 없으면**, `init`은 `cpu-tiny`을 기록해요.
- **`--model auto`**(레일이 전달하는 옵션)은 forge가 훈련할 수 있는 GPU 메모리를 확인해요. Apple silicon이 탑재된 Mac에서는 컴퓨터 메모리(GPU와 공유됨)를 확인하고, `PATH`에서 `nvidia-smi`를 사용할 때는 가장 큰 NVIDIA 카드의 메모리를 확인해요. 16GB 이상(또는 메모리를 읽을 수 없는 경우) → `byt5-small`, 8~15GB → `byt5-small-lowmem`, 8GB 미만 → `cpu-tiny`. 어느 GPU도 없으면 `cpu-tiny`이에요. 확인된 메모리와 함께 판단 이유가 출력(`chosen: …`)되고, `--json`에 `model_choice`로 반환돼요. GPU가 정상 작동하는지 테스트하지는 않아요. `NMT_FORGE_AUTO_PRESET`로 이를 재정의할 수 있어요(반드시 프리셋 이름을 지정해야 해요).
- **라운드에서 제안하는 더 강력한 모델**은 현재 사용 중인 모델이 `cpu-tiny`인 프로젝트에만 적용돼요. `--model auto`가 선택할 환경에서는 `byt5-small-lowmem`, 그렇지 않으면 `byt5-small`예요. `auto`가 `cpu-tiny`을 선택할 컴퓨터에서도 마찬가지예요. 제안의 `why`에 필요한 사항이 표시돼요.

**참고.** 프리셋의 예상 성능을 절대 보장된 결과로 설명하지 마세요. 반드시 개발 세트에서 측정해 보세요.

## 보호된 루프

각 명령은 `--json`을 받으며, `--workspace <dir>`(기본값 `.forge`)은 하위 명령 앞에 위치해요. forge는 축약된 플래그를 거부해요.

| 단계 | 명령어 | 수행하는 작업 | 거부하는 항목 |
|---|---|---|---|
| 워크숍 | `nmt-forge init <code> --dir . --pair <src>-<tgt> --model auto` | `.forge/`, `config.json`, `NEXT_STEPS.md`을 작성해요 | 읽을 수 없는 `--pair`, `--base`이 없는 `cpu-finetune` |
| 테스트 세트 | `nmt-forge registry add project-test <file> --role test` | 파일의 sha256을 고정하고 읽기 로그를 시작해요 | 테스트 또는 봉인 세트의 합성 행, 다른 내용으로 이미 등록된 이름(`--allow-rotate` 제외) |
| 선별 | `nmt-forge leak-audit <corpus> --clean-to <clean.jsonl>` | 등록된 모든 개발, 테스트, 봉인 세트와 대조하여 모든 쌍을 선별하고 깨끗한 사본을 작성해요 | 사용 중인 파일 덮어쓰기(`--overwrite` 제외), 훈련 데이터가 전혀 남지 않는 결과 |
| 예측 | `nmt-forge prereg new <id> --eval-set <set> --expect "…" --rationale "…"` | 점수를 매기기 전에 사람들의 예측을 기록해요 | 이미 존재하는 id, forge 또는 `mt-eval`가 세트의 점수를 매기기 위해 읽은 후의 쓰기 작업(원장에 기록되는 `--allow-after-reads` 제외) |
| 개발 세트 | `nmt-forge split <clean.jsonl> --test 0 --dev <n> --seed 42 --near-dupe 0.6 --max-group <m> --out data/split --register project` | `project-dev`로 등록되는 그룹 분리형 개발 세트 분할이에요. 레일의 `<n>`: 선별된 쌍 10개 중 1개, 최소 50개, 최대 500개이며, 200쌍 미만일 때는 그중 4분의 1이에요([셸](/docs/agents/shell#build-and-test-a-model)). `--near-dupe 0.6`는 유사 복사본(단어 중복도 ≥ 0.6)을 한쪽에 유지하며, 이는 이후 모든 라운드의 선별에 적용되는 기준이에요. 템플릿으로 작성된 파일도 여전히 분할될 수 있도록 레일은 `--max-group`을 개발 세트 크기의 절반 더하기 1로 설정해요 | 요청의 1.5배를 초과하는 쪽, 또는 훈련 데이터가 전체 행의 절반 미만으로 남는 경우 |
| 바닥선 | `nmt-forge floor <word lists>` | 개발 세트를 사전에서 단어별로 직역하고 실행의 개발 점수와 같은 방식으로 점수를 매겨요 | 등록된 개발 세트가 없음 |
| 검사 | `nmt-forge preflight run --config config.json` | 실행 시 마주칠 모든 게이트를 해결책과 함께 실행하며, 하나라도 실패하면 종료 코드 2를 반환해요 | — |
| 훈련 | `nmt-forge run config.json --detach` | 훈련을 진행하고, 개발 세트에서 체크포인트를 선택하고, 실행의 다른 체크포인트를 삭제하며([디스크 공간](#disk-space)), `run-manifest.json`, `run-report.md`, `dev-outputs.jsonl`을 포함한 `.forge/runs/<run name>-<8 hex>/`을 작성해요 | 이미 존재하는 실행(동일한 설정, 훈련 파일, 개발 세트), 디스크 공간 부족(무언가 작성되기 전의 `disk-room`, `--skip-disk-check`로 무시 가능), 진행 중인 실행, 테스트 또는 봉인 세트로 유출된 훈련 행, 훈련에 포함된 개발 행, 훈련 금지 또는 격리 표시된 데이터, `terms.training: not-allowed`, 한도를 초과한 합성 데이터, 참조 문장에 비해 너무 짧은 디코딩 한도, 알 수 없는 설정 키 |
| 테스트 점수 | `nmt-forge export <run-manifest.json> --prereg <id> --out export/` | 예측과 대조하여 테스트 세트의 점수를 한 번 매기고, 폴더 옆에 `input-words.json`를 두어 모델을 패키징해요. 이는 훈련에 사용된 단어들로, 서버가 한 번도 보지 못한 단어를 식별할 수 있게 해 줘요([서빙](/docs/agents/serving#what-an-export-holds)) | 사전 등록이 없거나 여러 개인데 `--prereg`이 없는 경우, 이미 소진된 봉인 세트, `--force`가 없는데 비어 있지 않은 `--out` |
| 선택 | `nmt-forge choose <export>/model` | 사람들이 선택한 모델을 기록해요 | 모델이 포함된 기록된 내보내기가 아닌 폴더 |
| 서빙 | `nmt-forge serve <export>/model --detach` | 이 컴퓨터에서 모델을 서빙해요([서빙](/docs/agents/serving#nmt-forge-serve)) | 토큰 없는 루프백 외부 접근, 또는 `--holders-agreed-by` 없는 로컬 전용 모델 |

중요한 모든 내용은 해시 체인 원장(`.forge/ledger.jsonl`)에 기록돼요. 등록, 목적이 명시된 읽기, 예측, 점수, 봉인된 세트 소진, 재정의, 감사 판정, 기준선, 내보내기, 선택, 서빙, 작업 시작 및 종료가 모두 포함돼요. 런 매니페스트는 해당 런의 기록이에요.

**사전 점검 관문:** 설정(전체 설정 해시 출력), 워크스페이스 일치 여부, 진행 중인 런 없음, 개발 세트 울타리, 훈련 데이터, 백엔드 설치 여부, 선별 플러그인, 테스트 유사 항목 및 개발 유사 항목(경고), 유출 감사, 훈련 데이터 배합, 생성 여유분, 일정 적합성.

**디코딩.** 최종 개발 디코드, 테스트 읽기(`export`), 사용 중인 모델의 개발 세트 재번역, 서빙되는 모델은 `decode.num_beams`(`config.json`에 별도 지정이 없으면 4)을 사용하는 빔 서치를 적용해요. 여러 체크포인트의 순위를 매기는 체크포인트 선별은 그리디 방식으로 디코딩해요. 내보내기에는 `beams_applied`이 기록되며, `nmt-forge serve`은 모델이 측정되었던 방식대로 디코딩해요. 이 정보가 없는 이전 내보내기는 그리디 방식으로 서비스돼요.

**길이 제한.** 모델은 소스 문장에서 최대 `model.max_src` 토큰, 번역문에서 최대 `model.max_tgt` 토큰을 학습하고, 번역할 때 최대 `model.max_src`을 읽으며, 최대 `decode.max_new_tokens`을 작성해요(`byt5-small`: 각각 320바이트 — 로마자 기준 약 320자, 음절 문자 기준 약 100자, `cpu-tiny`: 입력 256개 조각, 출력 384개 조각). 어떤 문장도 말없이 잘리지 않아요. 훈련 시에는 두 한도를 넘는 쌍을 잘라내기 전에 개수를 세고, 최종 개발 디코드에서는 입력 시 잘린 문장과 상한에서 중단된 번역문의 개수를 세어요. 둘 다 런 매니페스트(`length_limits`)에 기록되며, `status`은 긴 문장을 나누거나 `config.json`에서 `model.max_src`과 `model.max_tgt`(및 `decode.max_new_tokens`)을 늘리는 해결 방법과 함께 경고를 표시해요(이 경우 훈련 시간이 더 오래 걸려요).

**참고.** `nmt-forge run` 자체는 예측을 필수로 요구하지 않지만, 레일에서는 이를 먼저 요구해요. 예측 단계가 완료되기 전에는 훈련하지 마세요.

**참고.** `export`은 테스트 세트를 읽는 단계예요. 이 명령을 실행하는 것은 사람들의 예측이 이미 기록된 상태에서 진행하는 중요한 이정표이며, 결코 일상적인 점검이 아니에요.

## 백그라운드 작업

`run --detach`과 `serve --detach`은 감독되는 작업을 시작하고 바로 반환해요.

```bash
nmt-forge jobs                          # every job: state, stage, step, time left, last sign of life
nmt-forge jobs stop <name> --wait 120   # stop it, and wait up to 120 s (at most 180) for it to exit
```

- 상태: `running`, `finished`, `refused`, `crashed`, `stalled`, `deadline`, `interrupted`, `lost`. `lost`은 재부팅 후 해당 프로세스 번호가 다른 프로세스에 할당된 경우를 포함하여, 감독 프로세스가 기록 없이 종료된 작업을 의미해요.
- **이 컴퓨터에서는 한 번에 하나의 훈련만 진행돼요.** 훈련 작업은 모든 프로젝트에 걸쳐 기기 전체에서 선착순(`~/.nmt-forge/machine/train-queue`)으로 큐에 대기해요. 대기 중인 작업은 `running` 상태를 유지하며 `nmt-forge jobs --json`에 `queued_behind`(대기 중인 대상 작업)가 표시돼요. `status`은 `training` 상태가 되어 누구 뒤에서 대기 중인지 안내하며, 차례가 되면 자동으로 시작돼요. 대기 중 중단하면 시작되지 않은 채 종료(`interrupted`)되고, 24시간 동안 대기하면 종료(`deadline`)돼요.
- **제한 시간**(훈련 작업): 시작 후 15분간 아무런 반응이 없는 경우(`--startup-minutes`), 10분과 중앙 스텝 시간의 30배 중 더 긴 시간 동안 진행이 없는 경우(`--stall-minutes`), 마감 시간인 `--deadline-hours`(설정되지 않은 경우 설정의 시간 예산 × 1.25, 그 외에는 24시간). 제한 시간을 초과한 작업은 중단되고 기록돼요.
- **중단**: 런은 다음 스텝에서 중지돼요. 감독 프로세스는 60초 후 종료(terminate)를 시도하고, 10초 후에 강제 종료(kill) 단계로 전환해요.
- **실제 소요 시간 관문**(Hugging Face 백엔드): 워밍업 후 forge는 스텝 시간을 측정해 전체 런 시간을 예측하고, 예산에 맞지 않는 런은 거부해요(`wall-clock budget exceeded: …`). 예산이 설정되지 않은 경우 최대 24시간이 한도예요.
- 훈련 작업이 실행되는 동안 `status`은 `training` 상태가 되고 레일 단계는 `wait`이 돼요. 실패한 작업은 이후 모든 상태 확인에서 경고로 표시돼요.
- **재개.** 마지막 훈련 작업이 체크포인트를 저장한 후 `lost`, `crashed`, `stalled` 또는 `deadline`로 종료된 경우, `status`은 `nmt-forge preflight run --config config.json && nmt-forge run config.json --resume --detach` 명령을 안내해요. 이는 중단된 런의 마지막 체크포인트(해당 가중치, 새로운 옵티마이저, 남은 에포크)에서 시작하며 매니페스트에 재개된 위치를 기록(`resumed_from`)하는 새 런이에요. 수동으로 중단한 후에는 이 기능이 제공되지 않아요.
- 백그라운드 분리(detached) 작업은 POSIX 전용(macOS, Linux)이에요.

## 디스크 공간

훈련 중에는 체크포인트가 작성돼요. 한 번에 최대 `model.save_total_limit`개까지 생성되며(`config.json`에 별도 지정이 없으면 4개), ByT5-small의 경우 각 약 1.4GB예요. 이러한 규칙이 생기기 전에는 ByT5-small 프로젝트의 매 개선 라운드마다 약 5.6GB가 유지되었고, 이전 라운드의 모델을 지우는 장치가 없어 디스크가 가득 차면 저장 도중 실행이 중단되곤 했어요. Forge에서 1GB는 1024³바이트를 뜻해요.

- **완료된 실행은 선택된 체크포인트만 보관해요.** 체크포인트가 선택되고 나면 해당 실행의 다른 모든 `checkpoint-*` 폴더는 삭제돼요. 이후에는 아무것도 이를 다시 읽지 않아요(`export`가 선택된 체크포인트를 복사하고, 다음 라운드는 사용 중인 모델에서 시작해요). 매니페스트에는 `checkpoints_pruned`가 기록돼요(`removed`, `bytes`, `kept`). `config.json`의 `model` 블록에 있는 `"keep_checkpoints": "all"`은 모든 체크포인트를 보관해요. 그 외의 값은 훈련이 시작되기 전, 설정을 읽을 때 거부돼요(`ConfigError`, 여기서는 값 `x` 기준): `config.model.keep_checkpoints is "selected" (the default: only the checkpoint the run picks stays) or "all", not 'x'`.
- **잠금.** 디스크가 감당할 수 없는 실행은 아무것도 쓰기 전에 거부돼요(가드 `disk-room`). 분리된 실행(detached run)은 작업이 시작되기 전에 바로 거부돼요. 예상 크기: 체크포인트 1개의 크기(이 워크스페이스에서 동일한 기본 모델로 진행한 이전 실행의 보관된 체크포인트, 또는 로컬 폴더나 Hugging Face 캐시에 있는 기본 모델 자체의 가중치 파일)에 `model.save_total_limit`을 곱하고, 완료를 위한 1 GB를 더한 값이에요. 어떤 경우에도 2 GB 미만이 될 수는 없어요. 거부 메시지에는 `[disk-room] this computer has <free> free; training this model needs about <need> (<n> checkpoints of about <size> each while it trains, and room to finish)`가 표시되며, 크기를 알 수 없는 경우에는 *"(어떤 모델이든 최소한 이만큼은 비워 두어야 합니다)"*가 표시돼요. 이어서 `why: a disk that fills mid-training loses the run as it saves, and slows the whole computer`가 나오고, 여기서 `nmt-forge tidy`가 확보할 수 있는 항목(확보할 수 있는 게 있을 때), 디스크 밖으로 다른 파일을 옮기는 방법, `--skip-disk-check`을 안내하는 `fix`가 나타나요.
- `nmt-forge run … --skip-disk-check`(`--detach` 지정 여부와 무관)를 지정하면 그래도 시작해요. 매니페스트의 `disk_room`에는 검사 결과인 `free_bytes`, `checkpoint_bytes`(알 수 없는 경우 `null`), `checkpoints_at_once`, `need_bytes` 또는 `{"skipped": "--skip-disk-check"}`이 기록돼요. **참고.** 예상치는 틀릴 수 있어요. 검사를 건너뛸지는 여러분이 직접 판단해요.
- **`nmt-forge tidy`**는 아무것도 사용하지 않는 이전 라운드의 모델 가중치를 나열(각 실행의 크기, 총합, 여유 공간 표시)하며, 아무것도 삭제하지 않아요. `nmt-forge tidy --yes`는 이를 삭제해요. 현재 사용 중인 모델, 가장 최근 실행, 또는 사용 중인 모델에 의해 대체된 모델(블라인드 검토 시트 초안 작성에 사용돼요)은 절대 삭제하지 않아요. 출력의 `Kept:` 줄에 각각의 이름과 이유가 나와요. 정리된 실행도 기록(매니페스트, 개발 세트 번역, 보고서)은 유지하며, 매니페스트에 `model_removed`(`at`, `by`, `bytes`, `why`)가 추가돼요. 원장에는 `tidy` 항목(`runs`, `bytes`)이 들어가요. 정리된 실행에 번역을 요청하면(`compare-runs`로 개발 세트를 재번역하려는 경우) 거부돼요: `run <name>'s model was removed by nmt-forge tidy on <time> to free disk space — its record stays, its weights do not`. **참고.** `--yes`는 파일을 삭제해요. 사용자에게 목록을 보여주고, 승인했을 때만 실행하세요.
- **`status` 경고** — 워크스페이스가 있는 디스크의 여유 공간이 10 GB 미만이거나 정리로 5 GB 이상을 확보할 수 있을 때, 레일(rails)을 통해 전달되는 `warnings`의 한 줄 안내문이에요: *"이 컴퓨터의 여유 공간은 X GB입니다. 사용되지 않는 이전 N개 라운드의 모델이 Y GB를 차지하고 있습니다 — `nmt-forge tidy`는 이를 나열하고, `nmt-forge tidy --yes`는 공간을 확보합니다(사용 중인 모델, 최신 모델 및 대체된 모델은 유지됩니다)"* (세미콜론 뒷부분은 정리로 확보할 수 있는 공간이 있을 때만 표시돼요).

## 개선 라운드

모델이 사용되기 시작하면, 각 라운드마다 동일한 개발 세트를 사용해 더 많은 데이터로 새 런을 훈련해요.

**라운드 훈련 방식.** `champollion improve prepare`은 다음 두 가지 방식 중 하나로 `nmt-forge round-plan --config config.json`, which rewrites `config.json`을 실행하고 계획을 원장(`round-plan`)에 기록해요.

- **사용 중인 모델을 이어서 진행**(해당 모델 폴더 `init_from`): 지금까지의 모든 문장을 절반의 학습률로 4회 순회(에포크)해요. 이전 문장들이 모델의 망각을 방지해 줘요. 처음부터 훈련하는 것보다 훨씬 짧게 걸려요. 전체 설정은 `config.json`의 `model_full` 아래에 보관돼요.
- **처음부터 진행**: 아직 사용 중인 모델이 없을 때, 모델이 변경되었을 때(`use-model`, 이때 `model_full`도 삭제됨), 어휘집이 훈련 문장에서 생성되는 `cpu-tiny`인 경우(몇 분 만에 훈련됨), 어댑터(LoRA) 모델인 경우, 그리고 여러 번의 짧은 연속 학습으로 인한 편향을 방지하기 위해 4라운드마다 전체 설정을 복원해 처음부터 진행해요.

`prepare`은 계획과 그 이유를 출력하고, `improve/round-<k>/prepared.json`에 `training`(`mode`, `epochs`)을 기록해요. 어느 쪽이든 새 실행은 동일한 개발 문장에서 사용 중인 모델과 비교 평가돼요. 그런 다음(1, 3, 4번은 forge의 조언자가 제시하는 상태이고, 2번은 레일이 기록해요):

1. **`improve-compare`** (`auto`): `nmt-forge compare-runs <in-use
   run-manifest.json> <new run-manifest.json>` — 개발 세트에서 두 모델을 문장별로 짝지어 비교해요. 개발 문장이 50개 미만이면 점수와 상관없이 판정은 **too-few**가 돼요: *"판단하기에 개발 문장이 너무 적습니다: 50개 미만에서는 크기와 상관없이 그 차이가 우연에 의한 것인지 안정적으로 구별할 수 없습니다"*. 50개부터는 대응 표본 검정(paired test)의 p < 0.05**이고** 차이의 95% 구간이 0보다 클 때만 **better**가 되며, p < 0.05이고 0보다 작을 때는 **worse**, 그 외의 경우에는 **no-change**가 돼요. 모든 판정은 개발 세트가 안정적으로 보여줄 수 있는 최소 차이를 밝혀요. 테스트 세트는 절대 읽지 않아요. 개발 세트가 서로 다른 실행, 개발 세트 번역이 저장되지 않은 실행, 또는 새 실행 이후 변경된 개발 세트에 대해서는 거부돼요(`improve-loop`).
2. **화자의 판정**, 개발 세트가 결정을 내리지 못한 경우예요. 사용에 투입되지 않은 라운드의 모델은 다음 검토 시트의 초안 행 중 절반을 블라인드로 작성하며(아래 `draft-newer`), `champollion improve marks`가 화자의 평가 집계를 forge에 기록해요:
   `nmt-forge speaker-verdict --newer <run> --in-use <run> --newer-right <n> --newer-judged <n> --in-use-right <n> --in-use-judged <n> --json`.
   Forge는 **too-few** 또는 **no-change** 판정 이후에만 이에 따라 작업을 수행해요. 5% 수준의 양측 통합 2-비율 검정(|z| > 1.96)을 통해 `clear`을 얻어요: `newer`, `in-use` 또는 `neither`. 원장의 `improve-speaker` 항목에는 두 실행의 이름, 네 가지 집계 수치, `z` 및 `clear`만 저장되며 — 오직 수치만 보관돼요. 0 미만의 수치, 평가된 수보다 더 많은 정답 수치, 평가된 초안이 없는 모델은 거부해요. 표시되는 텍스트: *"동일한 방문에서 블라인드로 채점한 결과, 화자는 새로운 문장 B개 중 A개(P%)에서 더 새로운 모델이 맞았다고 평가했고, D개 중 C개(Q%)에서 사용 중인 모델이 맞았다고 평가했습니다"*, 그 후 *"이 문장들에서 더 새로운 모델이 분명하게 더 낫습니다 — forge가 이를 사용에 투입할 것을 제안합니다"*, *"이 문장들에서 사용 중인 모델이 분명하게 더 낫습니다 — 사용 중인 모델을 유지합니다"* 또는 *"이 문장들에서 뚜렷한 차이가 없습니다 — 사용 중인 모델을 유지합니다"*.
3. **`improve-promote`** (`confirm`): **better**일 때, 또는 해당 실행의 가장 최근 `speaker-verdict`가 `clear: newer`라고 표시할 때 **too-few** 또는 **no-change**에서 제안돼요(**worse**일 때는 절대 제안되지 않아요). 이것은 제안일 뿐이며, 판정만으로는 어떤 것도 사용에 투입되지 않아요. 사람들이 승인하면 테스트 세트를 읽지 않고 새 실행을 내보내고(`--no-eval`), 선택된 것으로 기록하며(`choose`), 실행 중인 서버를 중지하고 동일한 포트에서 새 모델을 서비스해요. 오직 `export`와 `choose`만이 모델을 사용에 투입한 것으로 인정돼요. 그때까지 라운드 보고서에는 *"측정상 더 나음: 사용되지 않음 — 사람들이 선택하지 않음"*으로 표시되며, 진행 상황, 예측 및 과적합 검사에서 해당 모델은 제외돼요. 화자의 채점이 있으면 `why`에 그 집계와 *"분명한 차이: 가족들에게 필요한 문장에서 더 새로운 모델이 더 낫습니다"*가 추가돼요. 다음 시트에서는 초안 행의 절반이 이전 모델에서 나오므로, 화자가 블라인드로 승격 여부를 확인하게 돼요(아래 참고).
4. 그렇지 않으면 사용 중인 모델이 유지되고 다음 라운드가 시작돼요 — 모델이 마지막으로 변경된 이후 최근 두 라운드의 판정이 모두 **no-change** 또는 **worse**이고, `cpu-tiny`을 사용 중인 경우는 예외예요. 마지막 모델 변경은 원장의 가장 최신 `model-change`(프리셋 전환 또는 `not-now`) 또는 `choose` 항목을 의미하며, 화자의 채점에 따른 승격을 포함해 사람들이 사용에 투입한 모든 모델이 해당돼요. **too-few** 라운드는 평가된 라운드가 아니에요. 최근 두 라운드 중 어느 하나라도 too-few라면 제안이 나오지 않아요. 그 후 **`improve-stronger-model`** (`ask_user`)가 제안돼요: `nmt-forge use-model <preset> --config config.json --answer yes`(또는 `not-now`), 프리셋 `byt5-small` 또는 `byt5-small-lowmem`([모델](#models)). 답변 입력 슬롯은 `try_it`예요. `yes`는 설정의 모델을 다시 작성하고(사람들의 시간 예산은 유지해요) 다음 단계에서 이를 훈련해요. `not-now`는 아무것도 변경하지 않아요. 두 답변 모두 원장에 기록되며(`model-change`), 이러한 라운드가 두 번 더 지난 후에야 제안이 다시 나타나요. MCP에서 여기서의 "지금은 아님(not now)"은 `try_it: "not-now"` 답변에 해당해요. 이 단계에서는 `declined: true`가 거부돼요([MCP](/docs/agents/mcp#not-now)). `why`는 문장이 더 늘어나도 도움이 되지 않는다는 식으로는 절대 말하지 않아요. 라운드의 향상을 확인하기에 개발 세트가 너무 작은 경우에는 *"작은 향상이 숨겨져 있을 수 있습니다"*라고 표시돼요. 그렇지 않은 경우에는 해당 라운드들이 *"개발 문장으로 확인할 수 있는 변화가 없음(약 X chrF++ 포인트 이상): 각 라운드가 그보다 적은 향상을 더하고 있거나, 아무런 향상이 없을 수 있습니다"*를 가져왔다고 표시돼요 — 곡선의 정점 부근에서는 한 라운드가 200개의 개발 문장이 보여줄 수 있는 수준보다 낮은 약 0.5 chrF++ 포인트를 추가하기 때문이에요. **참고.** `--answer`의 기본값은 `yes`예요. 항상 사람들의 답변을 명시적으로 전달하세요.

라운드의 나머지 과정은 레일이 이끌어요(`champollion improve …`): `nmt-forge wishlist`는 가장 도움이 될 항목의 시트를 작성해요(기본 40개 프롬프트, 최소 4분의 1은 자유 작성용으로 비워 둠. 모델이 본 적 없는 단어에 대해 각각 2~3개의 문장을 요청하며 문장마다 다른 내용을 담음 — 훈련에서 한 번만 본 단어는 거의 학습되지 않음([측정](/docs/agents/measurement#what-the-wishlist-steers-on))). `nmt-forge analyze`은 개발 세트 chrF++ 점수를 문장 종류별로 분류하고, `nmt-forge grow-dev`은 화자의 연습 문장을 동일한 이름의 개발 세트에 추가해요(개발 세트에 이미 있는 행이나 소스 텍스트가 테스트 또는 봉인 세트에 있는 행은 절대 추가되지 않음). 특정 종류의 문장은 다른 문장들에 비해 점수가 확연히 낮을 때만 위시리스트를 이끌어요([측정](/docs/agents/measurement#what-the-wishlist-steers-on)). `nmt-forge draft-newer`(`champollion improve sheet`가 실행)은 다음 검토 시트 행의 절반을 무작위로 선택하여 다른 모델로 표시 없이 초안을 작성하므로, 화자가 두 모델을 블라인드로 평가할 수 있어요([측정](/docs/agents/measurement#the-speakers-marks)). 사용 중인 모델이 아닐 때(해당 라운드가 실제 적용되지 않았을 때)는 가장 최근 훈련된 모델로 작성하고, 승격된 후에는 현재 사용 중인 모델이 대체한 이전 모델로 작성해요. `--json`은 어느 쪽인지(`relation`: `newer` 또는 `replaced`, 다른 모델이 없고 모든 행이 사용 중인 모델의 것일 때는 `null`)를 `other`, `in_use`, 각각의 기반이 된 훈련 쌍(`other_pairs`, `in_use_pairs`) 및 `n`와 함께 알려줘요. 원장의 `draft-newer` 항목에도 동일한 내용이 기록돼요. 라운드를 전달하고 안내하는 방법은 [코칭](/docs/agents/coaching)을 참고하세요.

## 합성 데이터와 역번역

- `nmt-forge synth <pack> --out <file>`은 언어 팩의 생성기를 실행해요. forge는 언어 팩을 기본 제공하지 않아요. 각 행은 검증을 거쳐 `synthetic: true` 태그가 붙어요.
- 합성 파일은 `config.json`에서 태그가 지정된 레인으로 훈련돼요(`data.synthetic`, `{"path", "tag": "<synth>"}`). 특정 유형이 15%를 넘으면, 설정에 `mix.synthetic_sample`이 지정되지 않는 한 런이 거부돼요. `nmt-forge sample --cap 0.15 --key kind`는 상한이 적용된 샘플을 추출해요.
- **역번역에는 별도 명령이 없어요.** 이는 라이브러리 함수예요(`nmt_forge.training.backtranslation.backtranslate`): 역방향 모델을 직접 제공해야 해요. 먼저 등록된 모든 세트를 기준으로 단일 언어 텍스트를 스크리닝하고 출력물에 `<bt>` 태그를 붙여요. 그런 다음 이 출력물은 합성 레인으로 훈련돼요. 별도의 품질 필터링은 실행되지 않아요. `config.data.monolingual`는 거부돼요.
- **참고.** 단일 언어 텍스트도 다른 데이터와 마찬가지로 사람들의 데이터예요. 사이드카 약관이 적용되며, 호스팅된 LLM인 역방향 모델을 사용하는 경우 제공업체로 텍스트가 전송돼요([데이터 규칙](/docs/agents/data-rules)).

## 증상 → 원인 → 해결 방법

| 증상 | 가능한 원인 | 해결책 |
|---|---|---|
| 개발 세트에서 `cpu-tiny`의 점수가 5~30 chrF++ 사이임 | 설계상 성능이 약함: 훈련 데이터와 유사한 관용구를 위한 회화집 수준임 | 실제 쌍을 더 추가해요. Apple silicon이나 GPU 환경이라면 `byt5-small`(`nmt-forge use-model byt5-small`, GPU 메모리가 8~15GB인 경우 `byt5-small-lowmem`)를 사용하세요 |
| "템플릿에서는 잘 작동하지만 실제 텍스트에서는 성능이 나쁨" | 규칙 R7(전이 정체): 개발 손실이 마지막 체크포인트 전에 최저점을 찍고 5% 이상 상승함. 이는 개발 chrF++ 점수와 무관하게 이러한 상승이 발생할 때마다 실행되므로 개발 점수와 함께 확인해야 함 | 실제 쌍을 더 추가하세요. 내보내기가 아닌 `nmt-forge lint <run-manifest.json>`에 표시돼요 |
| 점수가 너무 높게 나옴 | 훈련 데이터에 테스트 데이터의 복사본 또는 유사 복사본이 포함되어 있음. 또는 테스트 행 대부분에 대응하는 훈련 쌍둥이 데이터가 존재함(R4-번역이-아닌-단순암기, 절반 이상인 경우) | 쌍둥이 데이터가 없는 파일을 위해 `leak-audit --drop-test-twins`을 사용하세요. 쌍둥이 데이터를 포함한 점수와 제외한 점수를 모두 보고하세요 |
| 두 모델 간의 차이가 작음 | 신뢰구간이 넓음(R5-검정력-부족, 신뢰구간이 8포인트보다 넓음) | `nmt-forge compare`(쌍체 검정)을 사용하세요. 라운드의 경우 `compare-runs`을 사용하세요. 개발 세트 크기를 늘리세요 |
| 라운드에서 "판단하기에 개발 문장이 너무 적습니다"(`too-few`)라고 표시됨 | 개발 세트 문장이 50개 미만임: 이 상태에서는 비교로 판정할 수 없음 | 해결할 문제가 아니에요. 다음 시트에서 두 모델의 초안을 블라인드로 섞어 화자의 평가로 결정해요. 개발 세트가 50개가 될 때까지 시트 행 2개 중 1개는 연습 행으로 채워져요 |
| 라운드에서 "측정 가능한 변화 없음"이라고 표시됨 | 개발 세트가 너무 작아서 라운드의 성능 향상을 감지할 수 없음 | 화자의 연습 문장으로 개발 세트를 늘리세요(`champollion improve prepare`가 구동하는 `grow-dev`) |
| 훈련 거부됨: `[disk-room] this computer has … free` | 실행의 체크포인트를 저장할 디스크 공간이 부족함 | `nmt-forge tidy`으로 이전 라운드 모델을 삭제해 확보할 수 있는 공간을 확인하고, 사용자가 동의하면 `nmt-forge tidy --yes`을 실행하세요. 또는 다른 곳에서 공간을 확보하세요. `--skip-disk-check`는 사용자가 예상치가 잘못되었다고 판단했을 때만 사용하세요 |
| 실행 결과가 사전 바닥선 점수를 넘지 못함 | 단어 목록에서 제공하는 것 외에 훈련을 통해 학습한 내용이 없음 | 쌍을 더 추가하고, 바닥선의 커버리지를 확인하며, 사람들에게 이 상황을 설명하세요 |
| 개발 세트가 포화 상태임 | 신뢰구간의 하한선이 상한선의 99%에 도달함 | 더 어려운 개발 세트를 사용하세요. 현재 세트에서는 점수가 더 이상 오를 수 없어요 |
| 훈련 전 거부됨 | 위의 "훈련" 행을 참고하세요. `preflight run`이 실패한 각 게이트와 해결책을 알려줘요 | 안내된 해결책을 따르세요. 누락된 훈련 추가 패키지는 `uv tool install --reinstall --python 3.12 'nmt-forge[hf]'`(또는 forge 자체 Python 환경에 `pip`)을 실행하세요 |
| 실제 실행 시간 제한으로 중단됨 | 예상 실행 시간이 예산을 초과함(지정하지 않은 경우 24시간) | 더 작은 모델이나 적은 에포크를 사용하거나, 사람들이 정한 예산(`model.time_budget_hours`)을 설정하세요 |
| 백그라운드 작업이 실패함 | `nmt-forge jobs`에 `crashed`, `stalled`, `deadline`, `lost` 또는 `refused`가 표시됨 | `.forge/jobs/<name>/`에서 해당 `stderr.log`을 읽고 문제를 해결하세요. 그런 다음 다시 훈련하거나, `status`이 `--resume`을 가리킬 때 마지막 체크포인트부터 다시 시작하세요 |
| 훈련이 시작되지 않고 대기 중임 | 이 컴퓨터에서 다른 훈련이 실행 중이며, 그 뒤에 대기열로 등록되어 있음(`queued_behind`) | 기다리세요. 저절로 시작돼요. 다른 훈련을 또 시작하지 마세요 |
| 긴 문장이 잘려서 나옴 | 길이 제한 때문임: `status`이 건수(훈련에서 잘린 쌍, 입력 시 잘린 개발 문장, 한도에서 중단된 번역)와 함께 경고함 | 긴 문장을 나누거나, `model.max_src`, `model.max_tgt`, `decode.max_new_tokens`를 늘리세요(훈련 시간 증가) |
| 단어가 알 수 없는 조각(`cpu-tiny`)으로 나옴 | 어휘집을 훈련 행에서만 학습하기 때문임 | 해당 단어를 사용하는 쌍을 더 추가하거나, 바이트 단위로 읽는 `byt5-small`을 사용하세요 |

## 실패 분류 체계

forge는 훈련 프로젝트가 스스로를 속이게 되는 다양한 유형의 목록을 바탕으로 만들어졌어요. 요약하자면 — 강제 적용된다는 것은 도구가 이를 거부한다는 의미예요.

| 분류 | 실패 유형 | 코드 수준 대처 |
|---|---|---|
| 유출 | 훈련 세트에 정답 포함, 유사 복사본, 분할 경계를 넘나드는 의역 문장, 연쇄 템플릿 | 강제 적용(유출 감사, 분할 보호). 템플릿 파생 항목은 유지되고 집계됨 |
| 개발/테스트 오염 | 테스트 세트에서 체크포인트 선별, 봉인된 세트 두 번 소진, 예측 없는 테스트 점수 측정, 읽은 후 예측 | 강제 적용(개발 세트 울타리, 평가 원장, 사전 등록) |
| 토크나이저 및 표기법 | 문자를 작성할 수 없는 토크나이저, 혼용된 맞춤법 규칙 | 토크나이저는 미점검, 혼용된 규칙은 설정에 명시된 경우에만 린트로 점검 |
| 합성 데이터 | 합성 데이터 배합의 과적합, 조기 종료로 합성 데이터 비중이 높은 런이 중단됨, 붕괴 현상, 자체 오류를 재생산하는 역번역 | 조기 종료 기준선은 강제 적용, 나머지는 린트 또는 태그 처리 |
| 커버리지 | 특정 사용역에 필요한 단어 누락 | 플러그인이 커버리지를 보고할 때 린트로 점검 |
| 측정 | 신뢰구간보다 작은 점수 차이, 불투명한 단일 수치, 엔진 외부의 메트릭 연산 | 강제 적용: 모든 점수는 신뢰구간을 포함하며 엔진에서 산출됨 |
| 디코딩 | 잘린 출력, 출력 대신 손실값 기준으로 선별된 체크포인트 | 강제 적용: 디코드 여유분, 생성 메트릭 기반 선별, 길이 절단 건수 집계 및 경고 |
| 프로세스 | 알 수 없는 설정 키, 훈련 금지 데이터, 제어 불능 런 | 강제 적용 |

아직 코드가 구현되지 않은 알려진 공백: 토크나이저 커버리지, 역번역 품질, 사용역에 따른 절단, 정답/합성 데이터 비율, 시드 간 분산.

## 프로그램용 출력

`--json`은 표준 출력(stdout)에 정확히 하나의 JSON 문서를 출력해요. 거부 시에는 `{"error": {"type", "guard", "message", "why", "fix", "how_to_get", "text"}}` 및 종료 코드 2가 반환돼요(분할 및 개발 세트 울타리 거부의 경우 `details`가 추가됨). 종료 코드 1은 예기치 않은 비정상 종료예요. `nmt-forge run`은 `RUN EXIT <code>`(0, 1, 2 또는 130)으로 종료돼요. `run --detach`는 작업 문서와 함께 0을 반환해요. `nmt-forge status --json` is `{"snapshot", "advice": {"state", "next_command", "why", "ready", "blockers", "warnings", "answers"}}`.

## 더 알아보기

- [`nmt-forge` 명령 참조서](/docs/network/getting-started/forge-command-reference) — 모든 하위 명령과 플래그.
- [측정 규칙](/docs/agents/measurement) — 점수가 의미하는 바.
- [첫 번째 번역기 만들기](/docs/your-first-translator) 및 [더 개선하기](/docs/make-it-better) — 일반 사용자를 위한 안내.
- [서빙 및 배포](/docs/agents/serving) — 내보내기에 포함되는 내용.
