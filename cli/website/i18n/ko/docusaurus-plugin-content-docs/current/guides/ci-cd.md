---
sidebar_position: 3
title: "CI/CD"
---

# CI/CD 통합

빌드 파이프라인에서 번역을 자동화하세요.

champollion CLI는 [PolyForm Noncommercial License 1.0.0](https://github.com/gamedaysuits/Champollion/blob/main/cli/LICENSE)에 따라 소스 코드가 공개되어 있어요. 비상업적 목적으로 자유롭게 사용, 수정, 공유할 수 있어요. 상업적 목적의 사용은 이 라이선스에서 허용되지 않아요 ([사용 대상 안내](/docs/getting-started/who-may-use-this)).

## GitHub Actions: 번역 동기화 유지하기

완전한 워크플로를 소개해요. 변경된 내용을 번역하고, 결과를 검사한 뒤, 다시 커밋해요. Node 프로젝트뿐만 아니라 Django, Flutter, Hugo 등 어떤 프로젝트에서도 작동해요.

```yaml title=".github/workflows/i18n-sync.yml"
name: Sync translations
on:
  push:
    branches: [main]
    # Run only when something sync reads changed: the SOURCE locale files
    # (edit these to the files your config's "localesDir"/"localesPattern"
    # names) and the config. A push that changes neither has nothing to
    # translate, so it starts no job and needs no key.
    paths:
      - 'locales/en.json'       # one file per language
      - 'locales/en/**'         # or one folder per language (i18next: public/locales/en/**)
      - 'champollion.config.json'
  # Run workflow (by hand). The box asks again for plural forms a model
  # left out (--redo gaps; see "Plural forms a model left out" below).
  workflow_dispatch:
    inputs:
      redo_gaps:
        description: 'Ask again for plural forms a model left out (--redo gaps)'
        type: boolean
        default: false

permissions:
  contents: write          # lets the job push the translated files back

# One sync at a time per branch: two quick pushes would otherwise race to
# commit the same files. Queued, not cancelled — a cancelled run may have
# translated (and paid for) work it never committed.
concurrency:
  group: i18n-sync-${{ github.ref }}
  cancel-in-progress: false

# The flags of every `champollion sync` in this job — the sync step below,
# and the dry-run check further down this page, read this one line, so the
# check tests the method this job runs. The config's method runs as it is.
# A runner has no model server: if your config says "local" (a model on
# your machine), name a hosted model here instead, for these runs only
# (the config file is not changed):
#   SYNC_FLAGS: --method llm --model google/gemini-3.8-flash --max-cost 5
env:
  SYNC_FLAGS: --max-cost 5

jobs:
  sync:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 24   # a current LTS; champollion needs Node 20.11 or newer
      # The Translation Memory is a per-machine cache, so a fresh runner
      # starts empty. Restoring it means text translated before is served
      # free instead of billed again. No cache is saved under this exact
      # key: restore-keys brings back the branch's newest one.
      - name: Restore the translation cache
        id: cache
        uses: actions/cache/restore@v4
        with:
          path: .champollion
          key: champollion-tm-${{ github.ref_name }}-newest
          restore-keys: champollion-tm-${{ github.ref_name }}-
      - name: Sync translations
        id: sync
        env:
          OPENROUTER_API_KEY: ${{ secrets.OPENROUTER_API_KEY }}
        # Exit 2 = partial: some keys were translated, some were not (refused
        # by the quality gate, held back, a plural form the model left out, or
        # --max-cost stopped the run). What WAS translated is committed below,
        # then the job fails with the reason. Any other non-zero code stops here.
        #
        # $SYNC_FLAGS: the job's flags (env: above). The redo_gaps box of
        # "Run workflow" adds --redo gaps.
        run: |
          set +e
          npx --yes champollion@0.5 sync $SYNC_FLAGS ${{ inputs.redo_gaps && '--redo gaps' || '' }}
          code=$?
          echo "code=$code" >> "$GITHUB_OUTPUT"
          if [ "$code" -ne 0 ] && [ "$code" -ne 2 ]; then exit "$code"; fi
      # Saved even when a step failed: the translations this run paid for
      # stay cached, so the next run does not pay for them again. The key is
      # a hash of the cache's own files, so a run that added nothing to it
      # has the key it restored and skips the save (no new copy). Skipped too
      # when there is no cache folder (a push with nothing to translate on a
      # fresh runner creates none; saving it would log a path warning).
      - name: Save the translation cache
        if: always() && hashFiles('.champollion/**') != '' && steps.cache.outputs.cache-matched-key != format('champollion-tm-{0}-{1}', github.ref_name, hashFiles('.champollion/**'))
        uses: actions/cache/save@v4
        with:
          path: .champollion
          key: champollion-tm-${{ github.ref_name }}-${{ hashFiles('.champollion/**') }}
      - name: Commit updated translations
        run: |
          git config user.name "champollion"
          git config user.email "bot@example.com"
          # The translated files AND the lock files (.champollion.lock,
          # .champollion-content.lock), whatever your locale folders are called
          # — and .champollion-replaced-edits.jsonl when a sync wrote one.
          # .champollion/ (the cache) is in .gitignore — `champollion init` adds it.
          # (gettext: build steps write .mo files — stage only the catalogs; see below.)
          git add --all
          git diff --staged --quiet || git commit -m "chore: sync translations"
          # Someone may have pushed while this job ran: put this commit on
          # top of theirs, so the push does not fail (and waste the spend).
          git pull --rebase origin "$GITHUB_REF_NAME"
          git push origin "HEAD:$GITHUB_REF_NAME"
      # Right after the commit, before verify: on a partial run verify would
      # fail first on the missing keys, and the red step would name a key
      # while the reason sat in a green step.
      - name: Stop when the sync was partial
        if: steps.sync.outputs.code == '2'
        run: |
          echo "::error::champollion sync exit 2: the run stopped at --max-cost before translating, or some keys were not translated (refused by the quality gate, held back, or a plural form left out). What was translated is committed. The 'Sync translations' step's log says which."
          exit 1
      # --strict: a warning fails the job too. Plain verify passes on warnings
      # — an extra or missing plural form, a source echo, an out-of-date
      # translation — so they would ship with a green build.
      - name: Check every locale is complete and intact
        run: npx --yes champollion@0.5 verify --strict
```

**워크플로가 이렇게 구성된 이유.** `actions/cache`만 단독으로 사용하면 전체 작업이 성공했을 때만 캐시를 저장하고, `sync`는 어떤 키든 거부되면 `2`로 종료돼요. 따라서 일부만 실행된 경우 커밋과 캐시 저장이 모두 건너뛰어져 다음 실행 시 동일한 번역 비용을 다시 지불해야 했어요. 여기서는 캐시 복원과 저장을 두 단계(`actions/cache/restore` 후 `if: always()`가 포함된 `actions/cache/save`)로 나누고, 동기화 단계는 `2`에서 실패하는 대신 종료 코드를 기록하며, 번역된 파일이 커밋된 후에만 작업이 실패하도록 구성되어 있어요. 이 실패는 `verify` 이전의 자체 단계에서 발생하므로 누락된 키를 알리는 `verify` 대신 실패 원인(`--max-cost` 중단 또는 동기화에서 번역하지 못한 키)이 명확히 표시돼요. 마지막 단계는 `verify --strict`예요. 일반 `verify`는 경고(복수형 형태의 초과나 누락 등) 발생 시 0으로 종료되지만, `--strict`는 경고가 있으면 작업을 실패 처리해요. 퀄리티 게이트에서 거부된 키는 기억되므로, 다음 실행 시 동일한 모델로 다시 전송하지 않으며(동일한 답변에 비용이 청구될 수 있으므로), 동기화 로그에 해당 키와 다시 요청하는 `--redo keys:` 명령어가 표시돼요.

**실행 단위가 아닌 변경 단위로 하나의 캐시 복사본 유지.** 복원 단계에서는 브랜치의 최신 캐시를 가져와요(정확한 키인 `…-newest`는 절대 저장되지 않으므로 `restore-keys`가 가장 최근 캐시를 선택해요). 저장 단계에서는 캐시 자체 파일들의 해시(`hashFiles('.champollion/**')`)를 캐시 키로 지정해요. 일부만 실행되었거나 푸시에 실패했더라도 무언가를 번역한 실행은 캐시를 변경했으므로 새 키를 받아 저장돼요. 아무것도 추가하지 않은 실행(번역할 내용이 없거나, 모든 항목을 캐시에서 가져왔거나, `--max-cost`로 중단된 경우)은 복원된 키를 그대로 유지하므로 저장을 건너뛰고 새 복사본이 저장되지 않아요. 실행 ID를 키로 사용하면 실행할 때마다 전체 복사본이 저장되었고, 잠금 파일과 소스 파일을 키로 사용하면 푸시가 거부된 실행 이후 정확히 일치하는 이전 복사본이 복원되었는데, 커밋된 잠금 파일에 해당 실행의 변경 사항이 반영되지 않았기 때문이에요.

Node 프로젝트에서는 `champollion`를 개발 의존성으로 추가하고 대신 `npx champollion sync`를 호출할 수 있어요. 위에 고정된 `champollion@0.5`는 모든 저장소에서 작동하며 예기치 않게 다른 버전을 가져오지 않아요. 그런 다음 작업에서 이를 설치해야 해요. 아무것도 설치되지 않은 새로운 러너에서 `npx champollion`를 실행하면 잠금 파일에 고정된 버전이 아니라 최신 버전을 가져와요. 그리고 설치 과정에서 `node_modules/`가 작성되는데, `.gitignore`에 나열되어 있지 않으면(`champollion init`가 생성하는 파일에는 `.champollion/`만 나열됨) `git add --all`가 이를 커밋해 버려요. 따라서 아래의 Django 워크플로처럼 로캘 파일과 잠금 파일의 이름을 직접 지정해 스테이징하세요:

```yaml title=".github/workflows/i18n-sync.yml (dev dependency)"
# … checkout and setup-node as above; then install the version your
# package-lock.json pins:
      - run: npm ci
# … the cache restore as above. In "Sync translations" and in the last step,
# the installed CLI replaces the pinned one (SYNC_FLAGS as above):
#   npx champollion sync $SYNC_FLAGS ${{ inputs.redo_gaps && '--redo gaps' || '' }}
#   npx champollion verify --strict
# … the cache save as above; then:
      - name: Commit updated translations
        run: |
          git config user.name "champollion"
          git config user.email "bot@example.com"
          # The locale files and the lock file only: not node_modules/ (npm ci
          # just wrote it) and not .champollion/ (the cache). Name your locale
          # folder (messages, public/locales, …); when sync translates Markdown
          # too, add the folders it writes and .champollion-content.lock.
          git add -- locales .champollion.lock
          # A replaced hand edit is recorded here — the only copy of that wording.
          if [ -f .champollion-replaced-edits.jsonl ]; then git add -- .champollion-replaced-edits.jsonl; fi
          git diff --staged --quiet || git commit -m "chore: sync translations"
          git pull --rebase origin "$GITHUB_REF_NAME"
          git push origin "HEAD:$GITHUB_REF_NAME"
```

**잠금 파일 커밋하기.** `.champollion.lock`와 `.champollion-content.lock`는 각 번역이 어떤 소스 텍스트로부터 만들어졌는지 기록해요. 이를 통해 다음 실행 시 문자열이 변경되었음을 알 수 있어요. 이 파일들을 확인하지 못하는 러너는 수정된 문자열과 수정되지 않은 문자열을 구분할 수 없어요. **`.champollion/`는 커밋하지 마세요.** 이는 머신별 캐시이며, `champollion init`가 이를 `.gitignore`에 추가해요.

**`--max-cost`**는 예상보다 많은 비용이 지출되기 전에 실행을 중단시켜요. 일반적인 하루 변경 사항에 드는 비용 수준으로 설정하세요. 이 설정으로 인해 실행이 중단되면 아무것도 번역되거나 작성되지 않으며 sync는 종료 코드 `2`로 종료돼요. 커밋할 내용이 없으며, "Stop when the sync was partial" 단계에서 그 이유를 명시하고 작업을 실패 처리해요. 공개된 가격이 없는 방식(다른 머신의 자체 호스팅 엔드포인트)은 비용을 추정할 수 없으므로 `--max-cost`는 번역할 내용이 있을 때마다 중단돼요. 이런 방식에서는 설정을 해제해 두세요. 러너 자체에서 제공되는 모델(`localhost`/`127.0.0.1`의 `local`)은 API 비용이 $0으로 계산돼요.

**소스 문자열을 변경하는 푸시만 작업을 시작해요.** `paths:` 필터는 소스 로캘 파일과 `champollion.config.json`를 나열해요. 코드만 변경되거나 번역 및 잠금 파일만 변경된 푸시는 번역할 내용이 없으므로 작업을 시작하지 않아요. 두 로캘 경로를 설정에 지정된 파일(`messages/en.json`, `lib/l10n/app_en.arb` 등)로 수정하세요. sync가 Markdown도 번역하는 경우 `contentDir` 폴더를 추가하세요. **Run workflow**(`workflow_dispatch` 트리거)를 사용하면 언제든 수동으로 실행할 수 있어요.

**작업 자체의 커밋은 다시 실행을 시작하지 않아요** — 그리고 이를 방지하는 것은 `paths:` 필터가 아니에요. 커밋 단계에서는 워크플로의 `GITHUB_TOKEN`로 푸시하며, `GITHUB_TOKEN`로 이루어진 푸시는 절대 워크플로 실행을 트리거하지 않아요(워크플로가 자체적으로 무한 실행되지 않도록 하는 GitHub의 규칙이에요). 그렇기 때문에 아래의 Django 워크플로는 봇의 커밋마다 변경되는 `locale/**`를 감시할 수 있어요. 대신 개인용 액세스 토큰이나 GitHub App 토큰을 사용하여 푸시하면(예: 봇의 커밋에 반응해 다른 워크플로를 시작하기 위해) 해당 푸시로 인해 이 워크플로가 다시 시작돼요. 이때는 `paths:` 필터가 동작 여부를 결정해요. 위의 필터는 번역된 파일과 잠금 파일을 제외하므로 봇의 커밋이 실행을 시작하지 않아요. Django 필터의 `locale/**`는 봇이 커밋하는 카탈로그를 포함하므로, 커밋할 때마다 실행이 한 번 더 시작되어 번역할 항목을 찾지 못하고 아무것도 커밋하지 않아요. 이러한 토큰을 사용하는 경우 소스 카탈로그(`locale/en/**`)로 대상을 좁히고 설정을 통해 언어를 추가하세요.

**공급자 키는 시작되는 모든 실행에 필요해요.** 번역할 내용이 없을 때도 마찬가지예요. sync는 무엇이 변경되었는지 확인하기 전에 해당 방식을 실행할 수 있는지 먼저 확인해요. 소스 변경 없이 수동으로 시작된 실행이라도 `OPENROUTER_API_KEY` 시크릿(또는 사용 중인 방식의 키)이 없으면 실패해요. `local`에는 키가 필요하지 않지만 러너에는 모델 서버가 없어요. 개발자 머신에서 `local`로 번역하는 프로젝트는 CI에서 호스팅 방식(`--method` / `--model` — 위 워크플로에서 주석 처리된 `SYNC_FLAGS` 줄)을 지정해요. 아무것도 번역하지 않고 시크릿이 단계에 제대로 전달되는지 확인하려면 `sync --dry`를 사용하세요. 실제 실행 시 중단될 상황이면 경고를 표시하고 누락된 변수 이름을 알려줘요(드라이 런은 미리보기이므로 여전히 0으로 종료돼요). 이 검사는 키의 **작동 여부**가 아니라 변수가 **설정되어 있는지**만 확인해요. 아무것도 전송하지 않으므로 비어 있지 않은 값이면 자리표시자라도 통과돼요. 잘못되었거나 취소된 키는 실제 실행의 첫 번째 요청에서 확인돼요(오류 메시지에 HTTP 401과 같은 공급자의 응답이 표시돼요). 작업이 실행되기 전에 누락된 키로 인해 작업을 즉시 실패 처리하려면 [동기화 전 검사](#check-before-sync)를 추가하세요.

**캐시는 방식별로 유지돼요.** 번역은 이를 생성한 방식, 어조(register), 코칭 파일 아래에 캐시돼요(동일한 방식의 다른 모델은 이를 재사용할 수 있어요 — 모델 승계). 따라서 `local`로 번역하는 개발자와 호스팅 모델로 번역하는 CI는 캐시 항목을 서로 공유하지 않으며, 어차피 CI의 캐시는 독점적이에요(`.champollion/`는 커밋되지 않음). 그렇다고 CI가 프로젝트 전체를 다시 번역한다는 의미는 아니에요. 로캘 파일에 이미 존재하고 잠금 파일이 커밋된 항목은 완료된 것으로 간주돼요. CI는 마지막 커밋 이후 새로 추가되었거나 변경된 문자열(개발자가 로컬에서 번역했지만 커밋하지 않은 문자열 포함)에 대해서만 호스팅 모델에 비용을 지불하고, 나머지에 대해서는 비용이 발생하지 않아요. 호스팅 모델로 전체 프로젝트를 다시 번역하면(`--redo all`) 모든 문자열에 대해 한 번씩 비용이 청구돼요.

푸시 대신 **일정에 따라 실행하려면**: `on:` 블록을 `schedule: [{ cron: '0 6 * * *' }]`로 바꾸세요.

### 동기화 전 검사: 작업을 조기에 실패 처리하기 {#check-before-sync}

드라이 런은 무엇을 발견하든 `0`로 종료돼요(미리보기이기 때문이에요). 따라서 `sync --dry --max-cost 5`는 실제 실행 시 한도에서 중단될 것이라는 경고를 표시하지만 CI 단계 자체는 통과해요. 실제 실행 시 중단될 상황(누락된 키 또는 `--max-cost`)에서 작업을 실패 처리하려면 `sync --dry --json`의 요약을 읽으세요. 이 출력은 줄당 하나의 JSON 객체(NDJSON)이며 각각 `level`를 포함해요. stdout에는 `info`, `ok`, `event` 줄이 출력되고 stderr에는 `warn`와 `error` 줄이 출력되며, stdout의 마지막 줄이 요약인 `{"level": "summary", "command": "sync", …}`예요. 레벨을 기준으로 선택하세요. **동기화와 동일한 플래그로 실행하세요.** 플래그가 없으면 설정 파일에 지정된 방식을 검사하므로, 설정에 `local`로 지정된 프로젝트의 경우 작업이 실행하는 호스팅 모델이 아닌 로컬 방식을 검사하여 키가 없는 러너에서도 통과해 버려요. 위 워크플로의 "Sync translations" 앞 단계로서 동일한 `SYNC_FLAGS`를 읽어요:

```yaml
      - name: Check the sync can run (translates nothing)
        env:
          OPENROUTER_API_KEY: ${{ secrets.OPENROUTER_API_KEY }}
        # The JSON lines go to $out; the warnings (stderr) stay in the log.
        # When the check fails, the step prints why: the summary's
        # realRun.reasons, or its error when sync could not run at all
        # (that exit code is not fatal here — the summary is read instead).
        run: |
          out=$(npx --yes champollion@0.5 sync --dry $SYNC_FLAGS --json) || true
          if ! printf '%s\n' "$out" | jq -e 'select(.level == "summary") | .preflight.ready and (.maxCost.wouldStop | not)' > /dev/null; then
            printf '%s\n' "$out" | jq -r 'select(.level == "summary") | "::error::" + (.error // "A real sync would exit \(.realRun.exitCode): \(.realRun.reasons | join("; "))")'
            exit 1
          fi
```

또는 셸에서 동기화 줄과 동일한 플래그를 직접 작성하여 실행할 수 있어요:

```bash
SYNC_FLAGS="--method llm --model google/gemini-3.8-flash --max-cost 5"
out=$(npx --yes champollion@0.5 sync --dry $SYNC_FLAGS --json)
printf '%s\n' "$out" | jq -e 'select(.level == "summary") | .preflight.ready and (.maxCost.wouldStop | not)' > /dev/null \
  || printf '%s\n' "$out" | jq -r 'select(.level == "summary") | .error // "A real sync would exit \(.realRun.exitCode): \(.realRun.reasons | join("; "))"'
```

번역할 내용이 있든 없든 방식에 필요한 키가 누락된 경우(설정되지 않았거나 비어 있는 경우 — 잘못된 경우는 아님) `preflight.ready`는 `false`가 돼요. 호스팅 방식은 키 없이는 절대 준비 상태가 될 수 없어요. `maxCost.wouldStop`(`--max-cost`와 함께 제공됨)는 실제 실행 시 한도에서 중단될 경우 `true`가 돼요. `jq -e`는 둘 중 어느 쪽이든 1로 종료되며, 단계는 작업 로그에 그 이유를 출력해요. 예를 들면 다음과 같아요. `A real sync would exit 1: it would stop before translating: No OpenRouter API key (OPENROUTER_API_KEY) for en:fr`, or `A real sync would exit 2: --max-cost would stop it before any API call (Estimated translation cost exceeds the --max-cost cap: estimate ~$7.1200, cap $5.0000)`. sync가 전혀 실행될 수 없는 경우(설정이 깨진 경우) 이 단계는 대신 요약의 `error`를 출력해요. 이 단계는 stderr를 `/dev/null`로 보내지 않으므로 경고도 로그에 그대로 남아요. 요약의 `realRun.exitCode`는 미리보기를 통해 알 수 있는 한도 내에서 실제 실행이 어떤 코드로 종료될지 알려줘요. 사전 점검에서 중단될 경우 `1`, `--max-cost`로 인해 중단되거나 보류된 키 또는 언어에서 사용하는 형태가 디스크의 복수형 메시지에 없는 경우(`realRun.reasons`에 명시됨)처럼 부분 실행으로 끝날 경우 `2`를 반환해요. 실제 실행에서만 감지되는 퀄리티 게이트의 거부는 `0`를 `2`로 바꿀 수도 있어요. 예상되는 부분 실행에 대해서도 검사를 실패 처리하려면 `.preflight.ready and (.maxCost.wouldStop | not)` 대신 `.realRun.exitCode == 0`를 넣으세요.

### 보호된 main 브랜치: 풀 리퀘스트 제안하기

위의 워크플로는 번역을 `main`로 직접 푸시해요. `main`가 보호되어 있다면(필수 리뷰나 상태 확인 등) 해당 푸시는 거부돼요. 동기화가 실행된 이후이므로 번역 비용은 이미 지불된 상태예요. 하지만 비용이 다시 지불되지는 않아요. 단계가 실패하더라도 커밋 단계 전에 캐시가 저장되므로, 작업을 다시 실행하거나 다음 푸시를 수행할 때(각각 `restore-keys`를 통해 브랜치의 최신 캐시를 복원함) 캐시에서 가져와요. 잠금 파일이 `main`에 도달하지 않았으므로 다음 실행 시 동일한 문자열이 변경된 것으로 감지되어 다시 작성되지만, 캐시에서 가져오므로 비용은 들지 않아요.

보호된 `main`에서는 봇 소유의 브랜치에 커밋하고 풀 리퀘스트를 열거나 업데이트하세요. 위의 워크플로는 그대로 유지하고 권한과 커밋 단계의 두 가지만 변경하면 돼요.

```yaml title=".github/workflows/i18n-sync.yml (pull request)"
permissions:
  contents: write          # pushes the bot's branch
  pull-requests: write     # opens the pull request

# … checkout, setup-node, cache restore, "Sync translations" and the cache
# save as above; then, in place of "Commit updated translations":
      - name: Open or update the translations pull request
        env:
          GH_TOKEN: ${{ github.token }}
        run: |
          git config user.name "champollion"
          git config user.email "bot@example.com"
          branch=champollion/translations
          git switch -C "$branch"
          # Django: stage the catalogs and the lock by name, as in the
          # Django workflow below, instead of --all.
          git add --all
          if git diff --staged --quiet; then
            echo "Nothing to propose: the translations on $GITHUB_REF_NAME are up to date."
            exit 0
          fi
          git commit -m "chore: sync translations"
          # The branch is rebuilt from the latest $GITHUB_REF_NAME on every
          # run, so a force-push replaces the last proposal.
          git push --force origin "$branch"
          if [ -z "$(gh pr list --head "$branch" --base "$GITHUB_REF_NAME" --state open --json number --jq '.[].number')" ]; then
            gh pr create --head "$branch" --base "$GITHUB_REF_NAME" \
              --title "chore: sync translations" \
              --body "Translations and lock files from champollion sync (run $GITHUB_RUN_ID). Merge them together."
          fi
# "Stop when the sync was partial" and the verify --strict step stay as they
# are, after this one.
```

**상황별 사용 지침.** 브랜치 보호가 없거나 GitHub Actions가 이를 우회할 수 있는 규칙이 있어서 워크플로가 푸시할 수 있는 환경이라면 `main`로 직접 푸시하세요. `main`가 보호되어 있거나, 번역이 배포되기 전에 해당 언어 화자가 번역을 직접 검토해야 하는 경우에는 풀 리퀘스트를 생성하세요.

- 브랜치는 봇의 소유예요. 풀 리퀘스트가 병합될 때까지 `main`의 잠금 파일에는 해당 번역이 포함되지 않으므로, 실행할 때마다 전체 번역 세트가 다시 제안돼요(캐시에서 가져오므로 그 이후 변경된 문자열에 대해서만 비용이 청구돼요). 해당 브랜치로 푸시된 수정 사항은 다음 실행 시 대체돼요. 따라서 풀 리퀘스트에서 검토하고 병합한 다음 `main`에서 편집하세요(나중에 일괄 다시 실행하더라도 사람이 편집한 내용은 유지돼요).
- 저장소에서 Actions가 풀 리퀘스트를 열 수 있도록 허용해야 해요: Settings → Actions → General → "Allow GitHub Actions to create and approve pull requests".
- 워크플로의 `GITHUB_TOKEN`로 생성된 풀 리퀘스트는 다른 워크플로를 시작하지 않으므로 필수 상태 확인이 실행되지 않아요. `main`에 필수 상태 확인이 필요한 경우 GitHub App 토큰이나 시크릿으로 저장된 세분화된 토큰(`GH_TOKEN: ${{ secrets.<name> }}`)으로 풀 리퀘스트를 열거나, 커밋, 브랜치 업데이트, 열린 풀 리퀘스트 수정을 자동으로 처리해 주는 `peter-evans/create-pull-request` 같은 액션을 사용하세요(토큰은 동일한 방식으로 전달).

### gettext (Django, Babel) 및 Flutter

sync는 기존에 존재하는 카탈로그를 번역하며, 코드에서 문자열을 추출하지는 않아요. Django 프로젝트의 경우 동기화 단계 전에 카탈로그를 새로고침하고, 동기화 후 컴파일되는지 확인한 뒤 카탈로그만 커밋해요.

`makemessages`와 `compilemessages`는 둘 다 설정을 가져오므로, 작업에서 모든 단계에 필요한 값을 한 번 설정해요. 즉, 설정 모듈이 가져올 때 읽는 모든 변수(`SECRET_KEY`, `DATABASE_URL` 등)를 설정해요. 두 명령어 모두 데이터베이스를 건드리지 않으므로 자리표시자 값으로 충분해요. `DJANGO_SETTINGS_MODULE`는 주석 처리된 상태로 둡니다. `startproject`가 작성하는 `manage.py`가 이를 자체적으로 설정하며, 작업에서 설정된 값이 이를 덮어쓰기 때문에 모듈 이름이 잘못되면 `makemessages`가 작동하지 않아요. `manage.py`에서 설정하지 않은 경우에만 설정하세요.

이 워크플로의 `paths:` 필터는 위의 워크플로와 달라요. 소스 문자열이 Python 코드와 템플릿에 존재하고 작업 내에서 `makemessages`가 이를 추출하므로, 코드가 변경되면 새 문자열이 생길 수 있어요. 푸시할 때마다 Python 코드가 수정된다면 패턴을 앱 단위(`myapp/**.py`)로 좁히세요. 또한 `locale/**`도 감시해요. 새 언어는 새 카탈로그 폴더(`makemessages -l <code>`)로 추가되기 때문이에요. 봇 자체 커밋은 해당 카탈로그를 변경하지만 `GITHUB_TOKEN`로 푸시되기 때문에 실행을 시작하지 않아요(위의 **작업 자체의 커밋은 다시 실행을 시작하지 않아요** 및 다른 토큰으로 푸시할 때 범위를 좁히는 방법 참조).

```yaml title=".github/workflows/i18n-sync.yml (Django)"
name: Sync translations
on:
  push:
    branches: [main]
    # makemessages finds new strings in your code and templates, so a code
    # change can bring a string to translate: watch those, the catalogs
    # and the config. A push that touches none of them starts no job.
    paths:
      - '**.py'
      - '**.html'
      - '**.txt'                # templates for emails and the like
      - '**.js'                 # djangojs strings; drop it if you have none
      - 'locale/**'
      - 'champollion.config.json'
  # Run workflow (by hand): the box asks again for plural forms a model left
  # out — Russian few/many marked "# champollion:" (--redo gaps).
  workflow_dispatch:
    inputs:
      redo_gaps:
        description: 'Ask again for plural forms a model left out (--redo gaps)'
        type: boolean
        default: false

permissions:
  contents: write

concurrency:
  group: i18n-sync-${{ github.ref }}
  cancel-in-progress: false

jobs:
  sync:
    runs-on: ubuntu-latest
    # For every step: makemessages and compilemessages both import your
    # settings, so set what your settings read at import (see above).
    # Placeholders are enough: neither command uses the database.
    env:
      # DJANGO_SETTINGS_MODULE: myproject.settings   # only if your manage.py does not set it
      SECRET_KEY: makemessages-only
      # The flags of every `champollion sync` in this job (the dry-run check
      # above reads them too). A runner has no model server: if your config
      # uses "local" (a model on your machine), a hosted method runs here,
      # for these runs only — the config file is not changed.
      SYNC_FLAGS: --method llm --model google/gemini-3.8-flash --max-cost 5
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 24
      - uses: actions/setup-python@v5
        with:
          python-version: '3.12'
      # A fresh runner's package index is empty: update it first, or the
      # install fails. gettext brings msgmerge and msgfmt, used below.
      - run: sudo apt-get update && sudo apt-get install -y gettext
      - run: python -m pip install -r requirements.txt   # the Python setup-python just installed
      - name: Restore the translation cache
        id: cache
        uses: actions/cache/restore@v4
        with:
          path: .champollion
          key: champollion-tm-${{ github.ref_name }}-newest
          restore-keys: champollion-tm-${{ github.ref_name }}-
      - name: Extract new strings into the catalogs
        # --no-wrap: champollion writes each msgstr on one line; without it
        # msgmerge re-wraps those lines at 79 columns on the next run, and
        # every sync commits whitespace-only changes. The second line
        # refreshes the JavaScript catalogs (djangojs.po); drop it if your
        # project has none.
        run: |
          python manage.py makemessages --all --no-wrap
          python manage.py makemessages --all --no-wrap -d djangojs
      - name: Sync translations
        id: sync
        env:
          OPENROUTER_API_KEY: ${{ secrets.OPENROUTER_API_KEY }}
        # $SYNC_FLAGS: the job's flags (env: above); the redo_gaps box of
        # "Run workflow" adds --redo gaps. Exit 2 (partial) is recorded, not
        # fatal: what was translated is committed, then the job fails.
        run: |
          set +e
          npx --yes champollion@0.5 sync $SYNC_FLAGS ${{ inputs.redo_gaps && '--redo gaps' || '' }}
          code=$?
          echo "code=$code" >> "$GITHUB_OUTPUT"
          if [ "$code" -ne 0 ] && [ "$code" -ne 2 ]; then exit "$code"; fi
      - name: Save the translation cache
        if: always() && hashFiles('.champollion/**') != '' && steps.cache.outputs.cache-matched-key != format('champollion-tm-{0}-{1}', github.ref_name, hashFiles('.champollion/**'))
        uses: actions/cache/save@v4
        with:
          path: .champollion
          key: champollion-tm-${{ github.ref_name }}-${{ hashFiles('.champollion/**') }}
      - name: Check the catalogs compile (placeholder types included)
        run: python manage.py compilemessages
      - name: Commit updated catalogs
        run: |
          git config user.name "champollion"
          git config user.email "bot@example.com"
          # The catalogs and the lock file only: not the .mo files
          # compilemessages just wrote, and not .champollion/ (the cache).
          git add -- '*.po' .champollion.lock
          # A replaced hand edit is recorded here — the only copy of that wording.
          if [ -f .champollion-replaced-edits.jsonl ]; then git add -- .champollion-replaced-edits.jsonl; fi
          # makemessages (msgmerge) writes a new POT-Creation-Date into every
          # catalog on each run: commit only when something else changed
          # (git diff -I needs git 2.30 or newer; GitHub's runners have it).
          if git diff --staged --quiet -I '^"POT-Creation-Date:'; then
            echo "Nothing to commit: only the catalogs' POT-Creation-Date changed."
          else
            git commit -m "chore: sync translations"
            git pull --rebase origin "$GITHUB_REF_NAME"
            git push origin "HEAD:$GITHUB_REF_NAME"
          fi
      # Right after the commit, before verify: on a partial run verify would
      # fail first on the missing keys, and the red step would name a key
      # while the reason sat in a green step.
      - name: Stop when the sync was partial
        if: steps.sync.outputs.code == '2'
        run: |
          echo "::error::champollion sync exit 2: the run stopped at --max-cost before translating, or some keys were not translated (refused by the quality gate, held back, or a plural form left out). What was translated is committed. The 'Sync translations' step's log says which."
          exit 1
      # --strict: a plural entry where the model left out a form the
      # language uses for everyday counts (Russian few/many) is a warning,
      # and plain verify passes on warnings. Strict fails on it, so wrong
      # plurals never ship with a green build.
      - name: Check every catalog is complete and intact
        run: npx --yes champollion@0.5 verify --strict
```

`--all`는 이미 존재하는 모든 카탈로그를 업데이트해요. 언어 추가는 `makemessages -l <code>`(또는 `champollion init --langs <code>`)로 한 번 실행하면 돼요. `makemessages`는 도메인당 한 번씩 실행돼요. Python 및 템플릿에는 `django`, JavaScript에는 `djangojs`(`-d djangojs`)가 사용돼요. sync는 발견된 모든 도메인의 카탈로그를 번역해요. 마지막 단계는 `verify --strict`를 실행해요. 번역에 `few` 또는 `many` 형태가 누락된 러시아어 복수형 항목은 `other` 형태로 작성되고 `# champollion:` 플래그가 지정돼요. 카탈로그에 이러한 항목이 있는 동안에는 보류된 키의 경우와 마찬가지로 이를 작성하는 동기화 및 그 이후의 모든 동기화가 `2`로 종료되며, 요약에 해당 항목과 다시 요청하는 명령어가 표시돼요. 이후 동기화 후 검증 줄에 `[OK]` 대신 실행이 불완전하다고 표시돼요. 따라서 해당 형태가 작성될 때까지 "Stop when the sync was partial" 단계에서 커밋 후 작업을 실패 처리해요. 단독으로 실행할 때는 경고로 처리되어 일반 `verify`는 0으로 종료되지만, `--strict`는 실패해요. `audit`는 동일한 항목들을 불완전한 것으로 집계해요.

`compilemessages`는 `msgfmt --check-format`를 실행하며, 각 `%(name)s`가 타입을 유지하는지도 검사해요. 단, `#, python-format` 플래그가 지정된 항목에서만 검사해요. `makemessages`는 `%` 자리표시자가 있는 추출 항목에 해당 플래그를 추가하지만, 수작업으로 만든 카탈로그에는 이 플래그가 누락되어 검사되지 않을 수 있어요. `champollion verify`는 플래그와 관계없이 모든 항목의 printf 자리표시자(이름 및 타입 문자)를 비교하며, sync는 번역하는 각 항목에 원본 항목의 플래그를 유지해요. 커밋 단계는 `*.po`와 `.champollion.lock`를 이름으로 직접 스테이징해요(대체된 편집 기록이 있는 경우 해당 기록도 포함). 프로젝트에서 `.mo` 파일을 추적하는 경우 여기에 `'*.mo'`를 추가하세요. 캐시 단계, 기록된 종료 코드, `git pull --rebase`는 위의 워크플로와 동일한 이유로 존재해요. Babel의 경우: 동기화 전에 `pybabel extract` + `pybabel update --no-wrap`, 동기화 후에 `pybabel compile`를 실행하세요.

Flutter는 이 작업에서 별도의 단계가 필요하지 않아요. sync가 `app_<locale>.arb` 파일을 작성하고, 앱 자체의 빌드 단계인 `flutter gen-l10n`(또는 이를 실행하는 `flutter build`)에서 이를 Dart 코드로 변환해요.

#### 모델이 누락한 복수형 형태 {#plural-gaps}

표시된 항목은 완전한 번역이 아니므로, sync는 이를 사람의 손에만 맡겨두지 않아요:

- **다른 방식이나 모델이 자동으로 다시 요청해요.** 해당 항목에 아직 응답하지 않은 설정(방식, 모델, 어조, 코칭)을 사용하는 sync는 불완전한 답변이 저장된 캐시가 아니라 모델로 해당 항목을 다시 전송해요. 따라서 개발자의 로컬 모델이 해당 형태를 누락했더라도, 작업의 호스팅 모델(`SYNC_FLAGS`)이 다음 실행 시 이를 요청하며 견적에도 해당 비용이 반영돼요. 잠금 파일(`.champollion.lock`, `gaps` 아래)은 형태가 누락된 채 응답한 각 설정을 기록하므로, 로컬 실행과 CI 실행이 번갈아 가며 동일한 불완전한 답변에 비용을 지불하는 일이 없어요.
- **`sync --redo gaps`는 누가 누락했든 이러한 모든 항목을 다시 요청해요.** 위 워크플로의 경우 **Run workflow** 아래에서 `redo_gaps`를 체크하세요. 더 뛰어난 모델을 사용하려면 `SYNC_FLAGS`에 `--model`를 추가하세요.
- **새 답변에도 형태가 누락된 경우 항목은 계속 표시된 상태로 유지**되며 이전과 마찬가지로 실행이 `2`로 종료돼요. 이 경우 직접 손으로 형태를 작성하고 `# champollion:` 줄을 삭제하세요.

드라이 런(`sync --dry`)은 다시 요청할 항목의 이름을 지정하고 비용을 산출해요. `--json` 요약에는 다시 요청하지 않을 항목(`totalPluralGaps`)의 수가 집계되며, 실제 실행 시 이로 인해 `2`로 종료될 것임(`realRun.exitCode`)을 알려줘요.

## 기타 방식

아래 스니펫은 각 방식에 필요한 키와 `sync` 명령어를 보여줘요. 위 워크플로의 "Sync translations" 단계 **내부**에서 사용하세요. `env`를 교체하고, 표시된 플래그(`--method openai` 등)를 워크플로의 `SYNC_FLAGS` 줄에 넣어 드라이 런 검사에서도 동일한 방식을 실행하도록 하세요. 단계의 나머지 부분(`id: sync` 및 종료 코드를 기록하는 줄)은 그대로 유지하여 부분 실행 시에도 번역된 내용을 커밋하고 캐시를 저장하도록 하세요.

## Google Translate 방식

OpenRouter 대신 내장된 Google Translate 방식을 사용하는 경우:

```yaml
- name: Sync translations
  env:
    GOOGLE_TRANSLATE_API_KEY: ${{ secrets.GOOGLE_TRANSLATE_API_KEY }}
  run: npx --yes champollion@0.5 sync
```

## 직접 LLM 제공자

`openai`, `anthropic`, 또는 `gemini` 방식을 직접 사용하는 경우:

```yaml
# OpenAI
- name: Sync translations
  env:
    OPENAI_API_KEY: ${{ secrets.OPENAI_API_KEY }}
  run: npx --yes champollion@0.5 sync --method openai

# Anthropic
- name: Sync translations
  env:
    ANTHROPIC_API_KEY: ${{ secrets.ANTHROPIC_API_KEY }}
  run: npx --yes champollion@0.5 sync --method anthropic

# Gemini (free tier available)
- name: Sync translations
  env:
    GEMINI_API_KEY: ${{ secrets.GEMINI_API_KEY }}
  run: npx --yes champollion@0.5 sync --method gemini
```

## DeepL

```yaml
- name: Sync translations
  env:
    DEEPL_API_KEY: ${{ secrets.DEEPL_API_KEY }}
  run: npx --yes champollion@0.5 sync --method deepl
```

## 원격 번역 API

원격 번역 엔드포인트(예: 호스팅된 번역 서비스)를 사용하는 경우:

```yaml
- name: Sync translations
  env:
    CHAMPOLLION_API_KEY: ${{ secrets.CHAMPOLLION_API_KEY }}
  run: npx --yes champollion@0.5 sync
```

## 배포 전 검사 게이트

아무것도 번역하지 않고 로캘이 불완전하거나 손상되었을 때 빌드를 실패 처리하려면 검사만 단독으로 실행하세요.

:::warning[게이트는 동기화 전이 아니라 동기화 후에 실행하세요]
번역이 병합 후에만 실행되는 경우(위 워크플로), 문자열을 추가하는 풀 리퀘스트에는 아직 해당 번역이 없으므로 `audit`/`verify`가 이러한 모든 PR을 실패 처리해요. 번역이 이미 존재하는 위치에서 게이트를 실행하세요. 즉, 동기화 작업 후의 `main`에서 실행하세요(`needs: sync` 또는 동기화 워크플로의 `on: workflow_run`). `push` 트리거는 동기화 봇 자체 커밋에 대해서는 실행되지 않아요. 워크플로를 시작하지 않는 `GITHUB_TOKEN`로 푸시되기 때문이에요(위 내용 참조). 풀 리퀘스트에서는 `lint`만 실행하거나 PR 브랜치에서 동기화 작업을 먼저 실행하세요.
:::

```yaml
jobs:
  i18n-check:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 24
      # 1. Hardcoded strings that never reached a locale file (web projects)
      - run: npx --yes champollion@0.5 lint
      # 2. Every key present, nothing empty or left as an [EN] fallback
      - run: npx --yes champollion@0.5 audit
      # 3. Placeholders, ICU plurals, markup and scripts intact. --strict:
      #    warnings fail the build too (an extra or missing plural form, a
      #    source echo, an out-of-date translation pass plain verify).
      - run: npx --yes champollion@0.5 verify --strict
```

| 검사 | 명령어 | 실패 조건 |
|-------|---------|------------|
| **Lint** | `lint` | 소스 코드에 로캘 파일에 없는 문자열이 있는 경우 — 또는 검사할 소스 파일을 찾지 못한 경우 (검색한 폴더가 표시되며, `--src <dir>`를 사용하여 다른 위치를 가리킬 수 있음) |
| **Audit** | `audit` | 키가 누락되었거나 비어 있거나 여전히 `[EN]` 폴백 상태인 경우 — 또는 번역이 **최신 상태가 아닌** 경우: 현재보다 이전 소스 텍스트로부터 생성됨(재번역에 실패한 소스 수정본) — 또는 복수형 메시지에 해당 언어가 일상적인 수량 표현에 사용하는 형태가 누락된 경우(러시아어 `few`/`many`, `verify --strict`가 실패하는 항목들). 다시 요청하는 명령어가 함께 표시됨 |
| **Verify** | `verify` | 번역이 자리표시자, ICU 복수형, 마크업(태그의 열기/닫기 또는 중첩 방식이 달라짐) 또는 스크립트를 손상시킨 경우 — 또는 키가 누락된 경우 — 또는 하나의 텍스트가 여러 다른 소스 문자열을 대신하는 경우(모델이 암기된 문장을 반복함) — 또는 검사할 항목을 찾지 못한 경우(소스 파일이나 로캘 폴더가 설정이 가리키는 위치에 없음) |
| **Verify, strict** | `verify --strict` | 위 항목 중 어느 하나에 해당하거나 경고가 있는 경우 |

`verify`는 오류가 있으면 `1`로 종료되고, 그렇지 않으면 `0`로 종료돼요. 경고는 출력되지만 작업을 실패 처리하지는 않아요: 소스 에코(source echo), 동일한 텍스트를 가진 두 로캘, 최신 상태가 아닌 번역, 소스의 닫는 `?` 또는 `!`를 누락한 번역(일부 언어는 물음표 대신 조사로 의문을 표시함), 아래에 설명된 복수형 경고 등이 여기에 해당해요. 여러 서로 다른 소스 문자열에 대해 동일한 텍스트가 작성된 경우는 오류예요: 명확히 서로 다른 여러 단어로 구성된 두 문자열에 4단어 이상(그 외의 경우 3단어 이상)의 동일한 텍스트로 응답한 경우를 말해요. 이는 `sync` 게이트가 거부하는 규칙에 따라 키 값, 각 복수형 분기, 로캘의 Markdown 페이지 전체에서 집계돼요. `verify --strict`는 모든 경고를 실패로 처리해요. 예를 들어 모델이 누락한 러시아어 복수형 형태가 배포를 차단해야 할 때 사용하세요. 최신 상태가 아닌 번역은 `verify`에서는 경고(구조는 유지되어 있음)이지만, 완성도 게이트인 `audit`에서는 실패로 처리되며 재번역하는 명령어를 출력해요.

복수형 검사 결과는 포맷이 복수형을 저장하는 방식에 따라 달라져요:

| 포맷 | 오류 (`verify`가 1로 종료됨) | 경고 (`--strict` 사용 시에만 실패) |
|--------|--------------------------|--------------------------------------|
| i18next 접미사 키 (`count_one`, `count_other` 등) | 로캘에 필요한 형태가 누락된 경우 (프랑스어 `count_many`): 누락된 키로 처리돼요. | 로캘에 없는 형태의 키가 존재하는 경우 (프랑스어나 스페인어 `count_two`). `verify`는 정확히 해당 키들을 삭제하는 명령어인 `sync --prune plural-extras`를 출력해요. sync는 이 플래그 없이 키를 삭제하지 않아요. |
| ICU 메시지 (next-intl, ARB, i18next ICU의 `{count, plural, …}`) | 복수형 구조가 손상된 경우 (번역된 변수, 키워드 또는 선택기, 누락된 `#`). | 로캘이 일상적인 수량 표현에 사용하는 분기가 누락된 경우 (러시아어 `few`, `many`). 큰 숫자에만 사용되는 누락된 형태(1,000,000에 대한 프랑스어 `many`)는 보고되지 않아요. |
| gettext (`msgid_plural`) | 번역이 없는 항목(비어 있거나 `fuzzy`): 누락된 키로 처리돼요. | 언어 자체에 일상적인 수량 표현 형태가 있음에도 `other` 형태를 반복하는 `msgstr[]` 형태 (`# champollion:` 주석으로 표시됨). 카탈로그의 `nplurals`보다 `msgstr[]` 줄이 더 많은 경우. 복수형 형태는 카탈로그 자체의 `Plural-Forms` 헤더에 따라 계산돼요. |

다른 형태의 텍스트로부터 번역된 i18next 형태는 해당 형태의 텍스트를 정확히 그대로 유지할 수 있어요(프랑스어 `count_many`가 `count_other`와 동일함). 프랑스어에서는 두 형태를 동일하게 작성할 수 있으므로 이는 결코 경고 대상이 아니에요. sync는 모델에 특정 형태를 요청할 때 이를 답변의 지문(fingerprint)과 함께 `.champollion.lock`에 기록해요. `verify`는 이 기록만 읽으므로, 특정 커밋을 클론한 모든 환경에서 동일한 결과를 얻어요. 노트북의 캐시와 새로운 CI 러너의 결과가 달라질 수 없어요. 기록이 없는 값(수작업으로 작성되었거나, 다른 도구, 형태를 지정할 수 없는 기계 번역 엔진, 또는 이전 버전에서 작성된 값)은 다시 요청하는 명령어가 포함된 정보(info) 줄을 출력해요. `--strict`는 이에 대해 실패하지 않아요.
Verify는 의미가 아니라 구조를 검사해요. 통과했다는 것은 텍스트의 내용이 정확하다는 것이 아니라 키, 자리표시자, 복수형, 마크업, 스크립트가 온전히 보존되어 있음을 의미해요.

---

## 참고 항목

- [CLI 레퍼런스](/docs/reference/cli) — 전체 명령어 레퍼런스
- [동기화 작동 방식](/docs/concepts/how-sync-works) — 증분 동기화 이해하기
- [Translation Memory](/docs/concepts/translation-memory) — 캐싱 및 비용 절감
- [번역 방식](/docs/guides/translation-methods) — 쌍별 방식 선택
- [품질 게이트](/docs/concepts/quality-gate) — 번역 실패 시 발생하는 일
- [구성](/docs/getting-started/configuration) — 구성 레퍼런스
