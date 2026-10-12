---
sidebar_position: 3
title: "CI/CD"
---

# Tích hợp CI/CD

Tự động hóa việc dịch thuật trong pipeline build của bạn.

CLI champollion được cung cấp dưới dạng source-available theo giấy phép [PolyForm Noncommercial License 1.0.0](https://github.com/gamedaysuits/Champollion/blob/main/cli/LICENSE): miễn phí sử dụng, thay đổi và chia sẻ cho các mục đích phi thương mại. Việc sử dụng cho mục đích thương mại không nằm trong phạm vi của giấy phép này ([ai có thể sử dụng](/docs/getting-started/who-may-use-this)).

## GitHub Actions: giữ các bản dịch luôn đồng bộ

Một workflow hoàn chỉnh: dịch những gì đã thay đổi, kiểm tra kết quả và commit
ngược lại. Nó hoạt động cho mọi dự án — dù là Node hay không (Django, Flutter, Hugo).

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

**Lý do workflow được thiết kế theo cách này.** Tự bản thân `actions/cache` chỉ lưu
cache khi toàn bộ job thành công, và `sync` thoát với mã `2` bất cứ khi nào có khóa
bị từ chối — do đó một lần chạy một phần từng bỏ qua cả việc commit lẫn lưu cache,
và lần chạy tiếp theo lại phải trả phí cho chính những bản dịch đó. Ở đây, cache được
khôi phục và lưu thành hai bước (`actions/cache/restore`, sau đó là
`actions/cache/save` với `if: always()`), bước sync ghi lại exit code
thay vì thất bại do `2`, các tệp đã dịch được commit, và chỉ khi đó
job mới báo thất bại — trong một bước riêng biệt, trước `verify`, để bước thất bại nêu rõ
lý do (dừng do `--max-cost`, hoặc các khóa mà sync không thể dịch) thay vì
`verify` gọi tên một khóa bị thiếu. Bước cuối cùng là `verify --strict`: lệnh
`verify` thông thường thoát với mã 0 khi có cảnh báo (bao gồm dạng số nhiều bị thừa hoặc thiếu), còn
`--strict` sẽ làm job thất bại khi gặp chúng. Khóa bị quality gate từ chối sẽ được ghi nhớ: lần chạy tiếp theo
không gửi lại khóa đó cho cùng một mô hình (điều này sẽ tính phí cho cùng một câu trả lời) —
nhật ký sync sẽ nêu tên khóa đó và lệnh `--redo keys:` để yêu cầu dịch lại.

**Một bản sao cache cho mỗi thay đổi, không phải cho mỗi lần chạy.** Bước khôi phục sẽ lấy lại
cache mới nhất của nhánh (key chính xác của nó, `…-newest`, không bao giờ được lưu, vì vậy
`restore-keys` sẽ chọn bản gần đây nhất). Bước lưu sẽ tạo key cho cache dựa trên
hash của các tệp thuộc chính nó (`hashFiles('.champollion/**')`): một lần chạy đã dịch được
nội dung nào đó — kể cả lần chạy một phần, hoặc lần chạy bị thất bại khi push — đã làm thay đổi cache,
do đó nó nhận được một key mới và được lưu lại; một lần chạy không thêm nội dung gì (không có gì
để dịch, mọi thứ lấy từ cache, dừng do `--max-cost`) sẽ giữ nguyên key mà nó đã
khôi phục, vì vậy việc lưu được bỏ qua và không có bản sao mới nào được lưu trữ. Việc tạo key theo run
id sẽ lưu một bản sao đầy đủ ở mỗi lần chạy; việc tạo key theo tệp lock và tệp nguồn sẽ
khôi phục một bản sao cũ hơn theo khớp chính xác sau một lần chạy bị từ chối push,
bởi vì tệp lock đã commit không bao giờ nhận được các thay đổi của lần chạy đó.

Trong một dự án Node, bạn có thể thêm `champollion` làm dev dependency và gọi
`npx champollion sync` thay thế; lệnh `champollion@0.5` được ghim phiên bản ở trên hoạt động trong bất kỳ
kho lưu trữ nào và không bao giờ vô tình chọn phải một phiên bản khác. Job khi đó
phải cài đặt nó: trên một runner mới, `npx champollion` khi chưa cài đặt gì
sẽ tải về phiên bản mới nhất, chứ không phải phiên bản mà tệp lock của bạn đã ghim. Và quá trình cài đặt
sẽ ghi `node_modules/`, tệp mà `git add --all` sẽ commit trừ khi `.gitignore`
của bạn liệt kê nó (tệp mà `champollion init` tạo chỉ liệt kê `.champollion/`), vì vậy
hãy stage các tệp locale và tệp lock theo tên cụ thể, như workflow Django dưới đây thực hiện:

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

**Commit các tệp lock.** `.champollion.lock` và `.champollion-content.lock`
ghi lại văn bản nguồn mà mỗi bản dịch được tạo ra từ đó. Chúng là cách để
lần chạy tiếp theo biết được một chuỗi đã thay đổi. Một runner không bao giờ thấy chúng sẽ không thể phân biệt
chuỗi đã chỉnh sửa với chuỗi chưa chỉnh sửa. **Không commit `.champollion/`** — đó là
cache riêng của từng máy; `champollion init` sẽ thêm nó vào `.gitignore`.

**`--max-cost`** dừng một lần chạy trước khi nó tiêu tốn nhiều hơn mức bạn dự tính; hãy đặt nó
bằng chi phí cho các thay đổi trong một ngày bình thường của bạn. Khi nó dừng một lần chạy, chưa có gì
được dịch hay ghi và sync thoát với mã `2`: không có gì để commit,
và bước "Stop when the sync was partial" sẽ làm job thất bại kèm thông báo như vậy. Một phương thức không có giá công bố (một endpoint
tự host trên máy khác) thì không thể ước tính được chi phí, do đó `--max-cost` sẽ dừng
bất cứ khi nào có nội dung cần dịch — hãy tắt tùy chọn này đối với các phương thức đó. Mô hình
được phục vụ ngay trên runner (`local` tại `localhost`/`127.0.0.1`) có giá
chi phí API là $0.

**Chỉ những lần push làm thay đổi chuỗi nguồn mới khởi chạy job.** Bộ lọc `paths:`
liệt kê các tệp locale nguồn và `champollion.config.json`: một lần push
chỉ thay đổi code, hoặc chỉ thay đổi các bản dịch và tệp lock, sẽ không có gì
để dịch, vì vậy nó không khởi chạy job nào. Hãy chỉnh sửa hai đường dẫn locale thành các tệp mà
cấu hình của bạn chỉ định (`messages/en.json`, `lib/l10n/app_en.arb`, …); thêm thư mục
`contentDir` của bạn khi sync dịch cả Markdown. **Run workflow** (trigger
`workflow_dispatch`) vẫn cho phép bạn chạy thủ công.

**Chính commit của job không bao giờ khởi chạy lại job** — và bộ lọc `paths:`
không phải là thứ ngăn chặn điều đó. Bước commit thực hiện push bằng `GITHUB_TOKEN` của workflow,
và một lần push được thực hiện bằng `GITHUB_TOKEN` không bao giờ kích hoạt một lần chạy workflow (quy tắc của
GitHub, nhằm ngăn workflow tự khởi chạy chính nó). Đó là lý do tại sao workflow Django
dưới đây có thể theo dõi `locale/**`, tệp mà mọi commit của bot đều thay đổi.
Nếu bạn push bằng một personal access token hoặc GitHub App token thay thế (chẳng hạn để khởi chạy
các workflow khác khi bot commit), thì lần push đó sẽ khởi chạy lại workflow này;
khi đó bộ lọc `paths:` mới là yếu tố quyết định. Bộ lọc ở trên loại trừ các tệp đã dịch
và các tệp lock, do đó commit của bot sẽ không khởi chạy lần chạy nào. Mẫu `locale/**`
của bộ lọc Django bao gồm cả các catalog mà bot commit, vì vậy mỗi commit của nó sẽ khởi chạy thêm một lần chạy —
lần chạy này không tìm thấy gì để dịch và không commit gì cả. Với loại token như vậy, hãy thu hẹp nó về
catalog nguồn (`locale/en/**`) và thêm ngôn ngữ thông qua tệp cấu hình.

**Key của nhà cung cấp cần thiết cho mỗi lần chạy được khởi động**, kể cả khi không
có gì cần dịch: sync kiểm tra xem phương thức có thể chạy được không trước khi xem xét những gì
đã thay đổi. Một lần chạy được bắt đầu thủ công mà không có thay đổi nguồn nào vẫn sẽ thất bại nếu thiếu
secret `OPENROUTER_API_KEY` (hoặc key của phương thức bạn dùng). `local` không cần key, nhưng
runner không có máy chủ mô hình: một dự án dịch bằng `local` trên máy của
lập trình viên sẽ chỉ định một phương thức được host trên CI (`--method` / `--model` — dòng
`SYNC_FLAGS` được chú thích trong workflow ở trên). Để kiểm tra xem secret
có đến được bước này hay không mà không cần dịch bất cứ thứ gì, `sync --dry` sẽ cảnh báo khi
lần chạy thực tế có thể bị dừng và chỉ ra biến bị thiếu (nó vẫn thoát với mã 0 — dry run chỉ là bản xem trước).
Nó kiểm tra xem biến đã được **thiết lập** hay chưa, chứ không kiểm tra xem key
có **hoạt động** hay không: nó không gửi gì cả, nên bất kỳ giá trị không rỗng nào cũng vượt qua — kể cả giá trị giữ chỗ.
Một key sai hoặc bị thu hồi sẽ xuất hiện ở yêu cầu đầu tiên của lần chạy thực tế (lỗi
sẽ nêu rõ câu trả lời của nhà cung cấp, chẳng hạn như HTTP 401). Để làm job thất bại do thiếu
key trước khi bất cứ điều gì chạy, hãy thêm [bước kiểm tra trước khi sync](#check-before-sync).

**Cache được lưu giữ theo từng phương thức.** Bản dịch được lưu trong cache theo phương thức,
văn phong và tệp coaching đã tạo ra nó (một mô hình khác của cùng một
phương thức có thể tái sử dụng nó — chuyển tiếp mô hình). Do đó, một lập trình viên dịch bằng `local`
và CI dịch bằng mô hình được host sẽ không bao giờ dùng chung các mục cache —
và dù sao thì cache của CI cũng là của riêng nó (`.champollion/` không được commit). Điều đó
không có nghĩa là CI dịch lại toàn bộ dự án: những gì đã có trong các tệp locale,
cùng với tệp lock đã commit, được tính là đã hoàn thành. CI trả phí cho mô hình được host
đối với các chuỗi mới hoặc đã thay đổi kể từ commit gần nhất — bao gồm bất kỳ chuỗi nào lập trình viên
đã dịch cục bộ nhưng chưa commit — và không tốn gì cho phần còn lại.
Việc dịch lại toàn bộ dự án bằng mô hình được host (`--redo all`) sẽ tính phí cho
mỗi chuỗi một lần.

**Theo lịch trình** thay vì khi push: thay thế khối `on:` bằng
`schedule: [{ cron: '0 6 * * *' }]`.

### Kiểm tra trước khi sync: cho job thất bại sớm {#check-before-sync}

Một lần dry run sẽ thoát với mã `0` bất kể nó tìm thấy gì — vì đó là bản xem trước — do đó `sync --dry
--max-cost 5` sẽ cảnh báo rằng lần chạy thực tế sẽ dừng lại ở mức giới hạn nhưng vẫn vượt qua
như một bước CI thành công. Để làm job thất bại khi lần chạy thực tế sẽ dừng lại (thiếu key, hoặc
`--max-cost`), hãy đọc phần tóm tắt của `sync --dry --json`. Đầu ra đó là
mỗi dòng một đối tượng JSON (NDJSON), mỗi đối tượng có một trường `level` — các dòng `info`, `ok` và
`event` trên stdout, các dòng `warn` và `error` trên stderr — và dòng stdout cuối cùng là phần tóm tắt, `{"level": "summary", "command": "sync", …}`.
Hãy chọn nó theo cấp độ. **Chạy lệnh này với các cờ giống như lệnh sync**: nếu không có
chúng, nó sẽ kiểm tra phương thức mà cấu hình chỉ định, do đó đối với một dự án có cấu hình
ghi `local`, nó sẽ kiểm tra phương thức cục bộ — chứ không phải mô hình được host mà job
chạy — và vượt qua thành công trên một runner không có key. Là một bước trong workflow ở trên,
trước "Sync translations", nó đọc cùng một `SYNC_FLAGS`:

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

Hoặc trong shell, với các cờ được viết đầy đủ — giống như trên dòng lệnh sync:

```bash
SYNC_FLAGS="--method llm --model google/gemini-3.8-flash --max-cost 5"
out=$(npx --yes champollion@0.5 sync --dry $SYNC_FLAGS --json)
printf '%s\n' "$out" | jq -e 'select(.level == "summary") | .preflight.ready and (.maxCost.wouldStop | not)' > /dev/null \
  || printf '%s\n' "$out" | jq -r 'select(.level == "summary") | .error // "A real sync would exit \(.realRun.exitCode): \(.realRun.reasons | join("; "))"'
```

`preflight.ready` là `false` khi key mà phương thức cần bị thiếu (chưa đặt hoặc
rỗng — không phải khi key bị sai), bất kể có nội dung nào cần dịch hay không: một
phương thức được host không bao giờ sẵn sàng nếu thiếu key. `maxCost.wouldStop` (xuất hiện cùng với
`--max-cost`) là `true` khi lần chạy thực tế sẽ dừng lại ở mức giới hạn trần. `jq -e` thoát
với mã 1 trong cả hai trường hợp, và bước này sau đó sẽ in lý do vào nhật ký job — ví dụ:
`A real sync would exit 1: it would stop before translating: No OpenRouter API
key (OPENROUTER_API_KEY) for en:fr`, or `A real sync would exit 2: --max-cost
would stop it before any API call (Estimated translation cost exceeds the
--max-cost cap: estimate ~$7.1200, cap $5.0000)`. Khi sync hoàn toàn không thể chạy
(cấu hình bị hỏng), bước này sẽ in `error` của phần tóm tắt để thay thế. Bước
này không gửi stderr đến `/dev/null`, vì vậy các cảnh báo vẫn được giữ lại trong nhật ký.
Trường `realRun.exitCode` của phần tóm tắt cho biết lần chạy thực tế sẽ thoát
với mã nào, theo những gì bản xem trước có thể biết: `1` khi quá trình kiểm tra trước dừng nó lại, `2`
khi `--max-cost` làm điều đó, hoặc khi nó kết thúc ở trạng thái một phần — các khóa bị giữ lại, hoặc
các thông điệp số nhiều trên đĩa thiếu dạng mà ngôn ngữ sử dụng (`realRun.reasons`
sẽ chỉ rõ dạng nào). Việc từ chối bởi quality gate, điều mà chỉ lần chạy thực tế mới phát hiện ra, vẫn
có thể biến `0` thành `2`. Để bước kiểm tra cũng thất bại khi dự đoán lần chạy sẽ chỉ hoàn thành một phần,
hãy đặt `.realRun.exitCode == 0` vào vị trí của `.preflight.ready and (.maxCost.wouldStop | not)`.

### Nhánh main được bảo vệ: đề xuất một pull request

Workflow ở trên thực hiện push các bản dịch trực tiếp lên `main`. Nếu `main`
được bảo vệ (yêu cầu review hoặc các bước kiểm tra trạng thái), lần push đó sẽ bị từ chối — sau
khi sync đã chạy, đồng nghĩa với việc các bản dịch đã được trả phí. Chúng sẽ không bị tính phí
lần nữa: cache được lưu trước bước commit, ngay cả khi một bước gặp lỗi,
vì vậy việc chạy lại job hoặc lần push tiếp theo (mỗi lần đều khôi phục cache mới nhất của nhánh,
thông qua `restore-keys`) sẽ lấy chúng từ cache. Các tệp
lock chưa bao giờ lên tới `main`, vì vậy lần chạy tiếp theo sẽ thấy các chuỗi tương tự
bị thay đổi và ghi lại chúng — từ cache, không tốn thêm chi phí.

Trên một `main` được bảo vệ, hãy commit vào một nhánh do bot sở hữu và mở (hoặc cập nhật) một
pull request để thay thế. Hãy giữ nguyên workflow ở trên và thay đổi hai điều: quyền hạn
và bước commit.

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

**Khi nào nên dùng cách nào.** Hãy push lên `main` khi workflow được phép push tới đó: không có
cơ chế bảo vệ nhánh, hoặc có một quy tắc cho phép GitHub Actions bỏ qua việc bảo vệ. Mở một pull
request khi `main` được bảo vệ, hoặc khi cần một người — một người nói ngôn ngữ đó
— đọc lại các bản dịch trước khi phát hành.

- Nhánh này thuộc về bot. Cho đến khi pull request được merge, các tệp lock của `main`
  vẫn chưa có các bản dịch này, do đó mỗi lần chạy sẽ đề xuất lại toàn bộ tập hợp
  — lấy từ cache, vì vậy chỉ những chuỗi thay đổi kể từ thời điểm đó mới bị tính phí. Các chỉnh sửa
  được push lên nhánh đó sẽ bị thay thế ở lần chạy tiếp theo: hãy review trong pull
  request, merge, sau đó chỉnh sửa trên `main` (lần thực hiện lại hàng loạt sau này sẽ giữ lại
  chỉnh sửa của con người).
- Kho lưu trữ phải cho phép Actions mở pull request: Settings → Actions →
  General → "Allow GitHub Actions to create and approve pull requests".
- Một pull request được mở bằng `GITHUB_TOKEN` của workflow sẽ không khởi chạy bất kỳ
  workflow nào khác, do đó các status check bắt buộc sẽ không bao giờ chạy trên đó. Nếu `main` yêu cầu
  chúng, hãy mở PR bằng GitHub App token hoặc fine-grained token được lưu dưới dạng
  secret (`GH_TOKEN: ${{ secrets.<name> }}`), hoặc sử dụng một action như
  `peter-evans/create-pull-request`, action này sẽ tự động commit, cập nhật nhánh và
  chỉnh sửa pull request đang mở cho bạn (truyền token cho nó theo cùng cách).

### gettext (Django, Babel) và Flutter

Sync dịch các catalog đã tồn tại; nó không trích xuất chuỗi từ
mã của bạn. Dự án Django sẽ làm mới các catalog trước bước sync,
kiểm tra xem chúng có biên dịch được không sau bước đó, và chỉ commit các catalog.

Cả `makemessages` và `compilemessages` đều import cài đặt của bạn, vì vậy job
sẽ thiết lập những gì chúng cần, một lần, cho mọi bước: bất kỳ biến nào mà module settings của bạn
đọc khi import (`SECRET_KEY`, `DATABASE_URL`, …). Cả hai lệnh đều không động chạm đến
cơ sở dữ liệu, do đó một giá trị giữ chỗ là đủ cho các biến đó. `DJANGO_SETTINGS_MODULE`
được để dưới dạng chú thích: tệp `manage.py` mà `startproject` tạo ra sẽ tự thiết lập
nó, và giá trị được đặt trong job sẽ ghi đè giá trị đó — tên module sai
sẽ làm hỏng `makemessages`. Chỉ thiết lập nó khi `manage.py` của bạn không làm điều đó.

Bộ lọc `paths:` của nó khác với workflow ở trên: các chuỗi nguồn nằm trong
mã Python và template của bạn, và `makemessages` sẽ trích xuất chúng trong job, vì vậy
thay đổi mã có thể mang lại chuỗi mới. Hãy thu hẹp các pattern lại cho các app của bạn
(`myapp/**.py`) nếu mọi lần push đều tác động đến Python. Nó cũng theo dõi `locale/**`:
một ngôn ngữ mới sẽ xuất hiện dưới dạng một thư mục catalog mới (`makemessages -l <code>`). Chính commit
của bot làm thay đổi các catalog đó nhưng không khởi chạy lần chạy nào, vì nó được
push bằng `GITHUB_TOKEN` (xem **Chính commit của job không bao giờ khởi chạy lại job**
ở trên — và những gì cần thu hẹp khi bạn push bằng token khác).

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

`--all` cập nhật mọi catalog đã tồn tại; thêm ngôn ngữ bằng
`makemessages -l <code>` một lần (hoặc `champollion init --langs <code>`).
`makemessages` chạy một lần cho mỗi domain: `django` cho Python và template,
`djangojs` (`-d djangojs`) cho JavaScript. Sync dịch catalog của mọi domain mà nó tìm thấy.
Bước cuối cùng chạy `verify --strict`. Một mục số nhiều tiếng Nga
có bản dịch thiếu dạng `few` hoặc `many` sẽ được ghi bằng dạng `other`
và đánh dấu là `# champollion:`. Mọi lần sync sẽ thoát với mã `2` chừng nào một mục như vậy
còn nằm trong catalog — lần chạy ghi ra nó và mọi lần chạy sau đó, tương tự như đối với một khóa bị giữ
lại — và phần tóm tắt của nó sẽ nêu tên mục đó cùng lệnh để yêu cầu dịch lại; dòng
xác minh sau khi sync sau đó sẽ báo lần chạy chưa hoàn chỉnh thay vì `[OK]`.
Vì vậy bước "Stop when the sync was partial" sẽ làm job thất bại sau khi commit
cho đến khi các dạng số nhiều được ghi đầy đủ. Đứng độc lập, đây chỉ là cảnh báo: lệnh `verify`
thông thường thoát với mã 0 khi gặp trường hợp này, trong khi `--strict` sẽ báo thất bại. `audit` tính
các mục tương tự là chưa hoàn chỉnh.

`compilemessages` chạy `msgfmt --check-format`, lệnh này cũng kiểm tra xem mỗi
`%(name)s` có giữ nguyên kiểu dữ liệu của nó hay không — nhưng chỉ trên các mục được gắn cờ `#, python-format`.
`makemessages` thêm cờ đó vào các mục mà nó trích xuất có placeholder `%`;
một catalog được tạo thủ công có thể thiếu cờ này, và các mục của nó khi đó sẽ không được
kiểm tra. `champollion
verify` so sánh các placeholder printf của từng mục (tên và ký tự kiểu)
bất kể cờ của nó là gì, và sync giữ nguyên các cờ của mục nguồn trên từng mục mà nó
dịch. Bước commit stage `*.po` và
`.champollion.lock` theo tên cụ thể (và bản ghi các chỉnh sửa đã bị thay thế nếu
có); nếu dự án của bạn có theo dõi các tệp `.mo`, hãy thêm `'*.mo'` vào đó. Các
bước cache, mã thoát được ghi lại và `git pull --rebase` có mặt ở đây vì
những lý do tương tự như trong workflow ở trên. Babel: `pybabel extract` + `pybabel update --no-wrap` trước
khi sync, `pybabel compile` sau khi sync.

Flutter không cần thêm bước nào trong job này: sync ghi các tệp `app_<locale>.arb`,
và `flutter gen-l10n` (hoặc `flutter build`, lệnh thực thi nó) là bước build riêng của
ứng dụng của bạn, nơi nó chuyển đổi chúng thành Dart.

#### Các dạng số nhiều mà mô hình bỏ sót {#plural-gaps}

Một mục được đánh dấu không phải là một bản dịch, vì vậy sync không chỉ phó mặc nó cho con người:

- **Một phương thức hoặc mô hình khác tự động yêu cầu lại.** Một lần sync có thiết lập
  (phương thức, mô hình, register, coaching) chưa từng trả lời mục đó sẽ gửi
  lại mục đó cho mô hình — chứ không lấy từ cache, nơi đang giữ câu trả lời
  chưa hoàn chỉnh. Vì vậy khi mô hình cục bộ của lập trình viên bỏ sót các dạng này, mô hình
  được host của job (`SYNC_FLAGS`) sẽ yêu cầu chúng trong lần chạy tiếp theo, và bản ước tính
  sẽ tính chi phí cho nó. Tệp lock (`.champollion.lock`, dưới `gaps`) ghi lại từng thiết lập
  đã trả lời mà thiếu các dạng số nhiều, do đó lần chạy cục bộ và lần chạy CI không bao giờ luân phiên
  trả phí cho cùng một câu trả lời chưa hoàn chỉnh.
- **`sync --redo gaps` yêu cầu lại cho mọi mục như vậy**, bất kể ai hay mô hình nào đã bỏ sót — trong
  các workflow ở trên, hãy tích chọn `redo_gaps` bên dưới **Run workflow**. Thêm `--model` vào
  `SYNC_FLAGS` để sử dụng một mô hình mạnh hơn.
- **Nếu câu trả lời mới cũng thiếu các dạng số nhiều, mục đó vẫn giữ nguyên đánh dấu** và
  lần chạy thoát với mã `2` như trước. Khi đó hãy tự tay viết các dạng đó và xóa
  dòng `# champollion:`.

Một lần dry run (`sync --dry`) sẽ nêu tên các mục mà nó sẽ yêu cầu dịch lại và định giá
chúng; phần tóm tắt `--json` của nó đếm các mục mà nó sẽ không yêu cầu lại (`totalPluralGaps`)
và cho biết lần chạy thực tế sẽ thoát với mã `2` vì chúng (`realRun.exitCode`).

## Các phương thức khác

Các đoạn mã bên dưới hiển thị key mà mỗi phương thức cần cùng lệnh `sync` tương ứng.
Hãy sử dụng chúng **bên trong** bước "Sync translations" của workflow ở trên: hoán đổi
`env` của nó, đặt các cờ được hiển thị (`--method openai`, …) vào dòng
`SYNC_FLAGS` của workflow — để bước kiểm tra dry-run chạy cùng một phương thức — và giữ nguyên
phần còn lại của bước (`id: sync` và các dòng ghi lại mã thoát), để lần
chạy một phần vẫn commit những gì đã dịch và lưu cache.

## Phương thức Google Translate

Nếu sử dụng phương thức Google Translate tích hợp sẵn thay vì OpenRouter:

```yaml
- name: Sync translations
  env:
    GOOGLE_TRANSLATE_API_KEY: ${{ secrets.GOOGLE_TRANSLATE_API_KEY }}
  run: npx --yes champollion@0.5 sync
```

## Các nhà cung cấp LLM trực tiếp

Nếu sử dụng trực tiếp các phương thức `openai`, `anthropic`, hoặc `gemini`:

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

## API Dịch thuật Từ xa

Nếu sử dụng một endpoint dịch thuật từ xa (ví dụ: một dịch vụ dịch thuật được host):

```yaml
- name: Sync translations
  env:
    CHAMPOLLION_API_KEY: ${{ secrets.CHAMPOLLION_API_KEY }}
  run: npx --yes champollion@0.5 sync
```

## Quality gate trước khi deploy

Để làm cho bản build thất bại khi bất kỳ locale nào chưa hoàn chỉnh hoặc bị hỏng, mà không cần dịch
bất cứ thứ gì, hãy chạy riêng các bước kiểm tra.

:::warning[Chạy gate sau khi sync, không phải trước đó]
Nếu việc dịch chỉ chạy sau khi merge (như workflow ở trên), một pull request thêm
một chuỗi mới sẽ chưa có bản dịch cho chuỗi đó, và `audit`/`verify` sẽ làm thất bại mọi
PR như vậy. Hãy chạy gate ở nơi các bản dịch đã tồn tại: trên `main` sau
job sync (`needs: sync`, hoặc `on: workflow_run` của workflow sync). Trigger
`push` không kích hoạt trên chính các commit của bot sync — chúng được push
bằng `GITHUB_TOKEN`, thứ không khởi chạy bất kỳ workflow nào (xem ở trên). Trên các pull request,
chỉ chạy `lint`, hoặc chạy job sync trên nhánh PR trước.
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

| Kiểm tra | Lệnh | Thất bại khi |
|-------|---------|------------|
| **Lint** | `lint` | Mã nguồn có các chuỗi không nằm trong tệp locale — hoặc không tìm thấy tệp nguồn nào để kiểm tra (lệnh sẽ nêu tên các thư mục đã quét; hãy trỏ đến nơi khác bằng `--src <dir>`) |
| **Audit** | `audit` | Một khóa bị thiếu, trống rỗng, hoặc vẫn là fallback `[EN]` — hoặc bản dịch **bị lỗi thời**: được tạo từ văn bản nguồn cũ hơn văn bản hiện tại (chỉnh sửa nguồn nhưng dịch lại thất bại) — hoặc thông điệp số nhiều thiếu một dạng mà ngôn ngữ sử dụng cho số đếm thông thường (tiếng Nga `few`/`many`; các mục mà `verify --strict` thất bại), kèm theo lệnh để yêu cầu dịch lại |
| **Verify** | `verify` | Một bản dịch làm hỏng placeholder, số nhiều ICU, markup (thẻ được mở, đóng hoặc lồng nhau khác đi) hoặc script — hoặc thiếu khóa — hoặc một văn bản được dùng cho nhiều chuỗi nguồn khác nhau (mô hình lặp lại câu đã ghi nhớ) — hoặc không tìm thấy gì để kiểm tra (tệp nguồn hoặc thư mục locales không nằm ở nơi cấu hình chỉ định) |
| **Verify, strict** | `verify --strict` | Bất kỳ trường hợp nào ở trên, hoặc bất kỳ cảnh báo nào |

`verify` thoát với mã `1` khi có bất kỳ lỗi nào và thoát với mã `0` trong các trường hợp khác. Các cảnh báo được in ra nhưng không
làm thất bại job: sao chép nguyên văn nguồn, hai locale có văn bản giống hệt nhau, một
bản dịch bị lỗi thời, một bản dịch làm mất dấu `?` hoặc `!` đóng của nguồn (một số ngôn ngữ đánh dấu câu hỏi bằng trợ từ),
và các cảnh báo số nhiều bên dưới. Một văn bản được viết cho nhiều chuỗi
nguồn khác nhau sẽ bị tính là lỗi: hai chuỗi nhiều từ khác biệt rõ rệt được trả lời bằng cùng một văn bản
có từ bốn từ trở lên, hoặc từ ba từ trở lên trong các trường hợp khác. Nó được tính
trên các giá trị khóa, từng nhánh số nhiều và các trang Markdown của locale, theo
quy tắc mà gate của `sync` sử dụng để từ chối. `verify --strict` biến mọi cảnh báo thành
lỗi thất bại. Sử dụng cờ này khi, chẳng hạn, các dạng số nhiều tiếng Nga mà mô hình bỏ sót cần phải
chặn quá trình deploy. Các bản dịch lỗi thời là cảnh báo trong `verify` (vì
cấu trúc vẫn nguyên vẹn) và là lỗi thất bại trong `audit` (gate kiểm tra tính đầy đủ), lệnh này
sẽ in ra câu lệnh để dịch lại chúng.

Các phát hiện về số nhiều phụ thuộc vào cách định dạng lưu trữ số nhiều:

| Định dạng | Lỗi (`verify` thoát với mã 1) | Cảnh báo (chỉ thất bại với `--strict`) |
|--------|--------------------------|--------------------------------------|
| Khóa có hậu tố trong i18next (`count_one`, `count_other`, …) | Thiếu dạng mà locale cần (tiếng Pháp `count_many`): đây là lỗi thiếu khóa. | Khóa cho dạng mà locale không có (tiếng Pháp hoặc tiếng Tây Ban Nha `count_two`). `verify` in lệnh để xóa chính xác các khóa đó, `sync --prune plural-extras`; sync không bao giờ tự ý xóa chúng nếu không có lệnh này. |
| Thông điệp ICU (`{count, plural, …}` trong next-intl, ARB, i18next ICU) | Cấu trúc số nhiều bị hỏng (biến, từ khóa hoặc selector bị dịch, mất `#`). | Thiếu nhánh mà locale sử dụng cho các số đếm thông thường (tiếng Nga `few`, `many`). Dạng bị thiếu chỉ dùng cho các số lớn (tiếng Pháp `many`, dành cho 1 000 000) sẽ không bị báo cáo. |
| gettext (`msgid_plural`) | Mục không có bản dịch (trống hoặc `fuzzy`): đây là lỗi thiếu khóa. | Các dạng `msgstr[]` lặp lại dạng `other` khi ngôn ngữ có dạng riêng cho số đếm thông thường (được đánh dấu bằng chú thích `# champollion:`). Nhiều dòng `msgstr[]` hơn `nplurals` của catalog. Các dạng số nhiều được tính theo header `Plural-Forms` của chính catalog đó. |

Một dạng i18next được dịch từ văn bản của một dạng khác có thể chứa chính xác
văn bản của dạng đó (tiếng Pháp `count_many` giống với `count_other`). Tiếng Pháp có thể viết
hai dạng này giống nhau, vì vậy đây không bao giờ là cảnh báo. Khi sync yêu cầu mô hình cung cấp một dạng số nhiều, nó
sẽ ghi lại điều đó vào `.champollion.lock`, cùng với fingerprint của câu trả lời. `verify`
chỉ đọc bản ghi đó, vì vậy mọi bản clone của một commit đều nhận được cùng một kết quả. Cache
trên máy tính xách tay của bạn và một runner CI mới tinh sẽ không thể có sự bất đồng. Một giá trị
không có bản ghi (được viết thủ công, bởi công cụ khác, bởi công cụ dịch máy không được chỉ định dạng,
hoặc bởi phiên bản cũ hơn) sẽ nhận được một dòng thông tin cùng lệnh để yêu cầu dịch lại.
`--strict` không báo thất bại vì điều này.
Verify kiểm tra cấu trúc chứ không kiểm tra ngữ nghĩa: việc vượt qua kiểm tra chỉ cho biết các khóa, placeholder,
dạng số nhiều, markup và script vẫn nguyên vẹn, chứ không khẳng định văn bản diễn đạt đúng ý nghĩa.

---

## Xem thêm

- [Tài liệu tham khảo CLI](/docs/reference/cli) — tài liệu tham khảo lệnh đầy đủ
- [Cách hoạt động của Sync](/docs/concepts/how-sync-works) — tìm hiểu về đồng bộ hóa tăng dần
- [Bộ nhớ Dịch thuật](/docs/concepts/translation-memory) — lưu cache và tiết kiệm chi phí
- [Phương thức Dịch thuật](/docs/guides/translation-methods) — lựa chọn phương thức cho từng cặp ngôn ngữ
- [Cổng Chất lượng (Quality Gate)](/docs/concepts/quality-gate) — điều gì xảy ra khi dịch thuật thất bại
- [Cấu hình](/docs/getting-started/configuration) — tài liệu tham khảo cấu hình
