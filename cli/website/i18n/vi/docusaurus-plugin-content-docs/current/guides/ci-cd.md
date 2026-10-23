---
sidebar_position: 3
title: "CI/CD"
---

# Tích hợp CI/CD

Tự động hóa dịch thuật trong pipeline bản dựng của bạn.

CLI champollion được cung cấp dưới dạng source-available theo [Giấy phép PolyForm Phi thương mại 1.0.0](https://github.com/gamedaysuits/Champollion/blob/main/cli/LICENSE): miễn phí sử dụng, sửa đổi và chia sẻ cho các mục đích phi thương mại. Việc sử dụng cho mục đích thương mại không nằm trong phạm vi giấy phép này ([ai có thể sử dụng công cụ này](/docs/getting-started/who-may-use-this)).

## GitHub Actions: giữ các bản dịch luôn đồng bộ

Một quy trình làm việc (workflow) hoàn chỉnh: dịch những gì đã thay đổi, kiểm tra kết quả và commit
ngược trở lại. Quy trình này hoạt động với mọi dự án — dù dùng Node hay không (Django, Flutter, Hugo).

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
          npx --yes champollion@0.6 sync $SYNC_FLAGS ${{ inputs.redo_gaps && '--redo gaps' || '' }}
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
        run: npx --yes champollion@0.6 verify --strict
```

**Lý do workflow được thiết kế như vậy.** Tự bản thân `actions/cache` chỉ lưu
cache khi toàn bộ job thành công, và `sync` sẽ thoát với mã `2` bất cứ khi nào có khóa
bị từ chối — do đó, một lần chạy dở dang từng bỏ qua cả bước commit lẫn lưu cache,
khiến lần chạy tiếp theo phải trả phí cho chính những bản dịch đó một lần nữa. Tại đây, cache được
khôi phục và lưu thành hai bước riêng (`actions/cache/restore`, rồi đến
`actions/cache/save` với `if: always()`), bước sync sẽ ghi lại mã thoát
thay vì thất bại ngay tại `2`, các tệp đã dịch được commit, và chỉ sau đó
job mới báo thất bại — trong một bước riêng, trước `verify`, để bước thất bại nêu rõ
lý do (dừng do `--max-cost`, hoặc các khóa mà sync không thể dịch) thay vì
`verify` nêu tên một khóa bị thiếu. Bước cuối cùng là `verify --strict`: lệnh
`verify` thông thường thoát với mã 0 khi gặp cảnh báo (bao gồm cả dạng số nhiều thừa hoặc thiếu), còn
`--strict` sẽ đánh trượt job nếu gặp chúng. Khóa bị cổng chất lượng từ chối sẽ được ghi nhớ: lần chạy tiếp theo
sẽ không gửi lại khóa đó cho cùng một mô hình (điều này sẽ tính phí cho cùng một câu trả lời) —
nhật ký sync sẽ chỉ rõ tên khóa và lệnh `--redo keys:` để yêu cầu dịch lại.

**Một bản sao cache cho mỗi lần thay đổi, không phải mỗi lần chạy.** Bước khôi phục sẽ lấy lại
bản cache mới nhất của nhánh (khóa chính xác của nó, `…-newest`, không bao giờ được lưu, nên
`restore-keys` sẽ chọn bản gần đây nhất). Bước lưu sẽ đặt khóa cho cache dựa trên
mã băm của chính các tệp của nó (`hashFiles('.champollion/**')`): lần chạy nào đã dịch
thứ gì đó — kể cả lần chạy dở dang, hoặc lần chạy bị lỗi push — đều đã làm thay đổi cache,
nên nó nhận được một khóa mới và được lưu lại; lần chạy nào không thêm gì mới (không có gì để
dịch, mọi thứ lấy từ cache, dừng do `--max-cost`) sẽ giữ nguyên khóa mà nó
đã khôi phục, vì vậy bước lưu được bỏ qua và không có bản sao mới nào được lưu. Việc đặt khóa theo run
id từng lưu một bản sao đầy đủ ở mỗi lần chạy; còn đặt khóa theo tệp lock và tệp nguồn sẽ
khôi phục một bản sao cũ hơn theo khớp chính xác sau một lần chạy bị từ chối push,
bởi vì tệp lock đã commit không bao giờ nhận được các thay đổi của lần chạy đó.

Trong dự án Node, bạn có thể thêm `champollion` làm dev dependency và gọi
`npx champollion sync` để thay thế; lệnh `champollion@0.6` đã ghim phiên bản ở trên hoạt động trong bất kỳ
kho lưu trữ nào và không bao giờ bất ngờ dùng nhầm phiên bản khác. Job khi đó
phải cài đặt nó: trên một runner mới, `npx champollion` khi chưa cài gì
sẽ lấy phiên bản mới nhất, chứ không phải phiên bản mà tệp lock của bạn ghim. Và việc cài đặt
sẽ ghi vào `node_modules/`, tệp mà `git add --all` sẽ commit trừ khi tệp `.gitignore` của bạn
liệt kê nó (tệp do `champollion init` tạo chỉ liệt kê `.champollion/`), vì vậy
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

**Hãy commit các tệp lock.** `.champollion.lock` và `.champollion-content.lock`
ghi lại văn bản nguồn mà mỗi bản dịch được tạo ra từ đó. Nhờ chúng mà
lần chạy tiếp theo biết được một chuỗi đã thay đổi. Một runner không bao giờ thấy các tệp này sẽ không thể phân biệt
chuỗi đã chỉnh sửa với chuỗi chưa đụng tới. **Không commit `.champollion/`** — đó là
bộ nhớ cache riêng của từng máy; `champollion init` sẽ thêm nó vào `.gitignore`.

**`--max-cost`** dừng lần chạy trước khi nó tiêu tốn nhiều hơn mức bạn dự tính; hãy đặt giá trị này tương đương
chi phí cho những thay đổi của một ngày bình thường. Khi nó dừng một lần chạy, chưa có gì được
dịch hay ghi lại và sync sẽ thoát với mã `2`: không có gì để commit,
và bước "Stop when the sync was partial" sẽ đánh trượt job kèm thông báo tương ứng. Một phương thức không có giá công bố (một endpoint
tự host trên máy khác) thì không thể ước tính chi phí, vì vậy `--max-cost` sẽ dừng
bất cứ khi nào có nội dung cần dịch — hãy tắt tùy chọn này đối với các trường hợp đó. Một mô hình
được phục vụ trực tiếp trên runner (`local` tại `localhost`/`127.0.0.1`) có giá
$0 chi phí API.

**Chỉ những lần push làm thay đổi chuỗi nguồn mới khởi chạy job.** Bộ lọc `paths:`
liệt kê các tệp locale nguồn của bạn và `champollion.config.json`: một lần push
chỉ thay đổi mã nguồn, hoặc chỉ thay đổi các bản dịch và tệp lock, sẽ không có gì
để dịch, do đó không khởi chạy job nào. Hãy sửa hai đường dẫn locale thành các tệp mà
cấu hình của bạn chỉ định (`messages/en.json`, `lib/l10n/app_en.arb`, …); thêm thư mục
`contentDir` của bạn nếu sync cũng dịch cả Markdown. **Run workflow** (trigger
`workflow_dispatch`) vẫn cho phép bạn chạy thủ công.

**Bản thân commit của job không bao giờ kích hoạt lại chính nó** — và bộ lọc `paths:` không
phải là thứ ngăn chặn điều đó. Bước commit thực hiện push bằng `GITHUB_TOKEN` của workflow,
và một lần push thực hiện bằng `GITHUB_TOKEN` không bao giờ kích hoạt một lần chạy workflow (quy tắc
của GitHub, nhằm không cho workflow tự kích hoạt chính nó). Đó là lý do workflow Django
bên dưới có thể theo dõi `locale/**`, tệp mà mọi commit của bot đều làm thay đổi.
Nếu push bằng một personal access token hoặc GitHub App token (chẳng hạn để kích hoạt
các workflow khác khi bot commit), lần push đó sẽ kích hoạt lại workflow
này; khi đó bộ lọc `paths:` sẽ là yếu tố quyết định. Bộ lọc ở trên
bỏ qua các tệp đã dịch và tệp lock, nên commit của bot
không bắt đầu lần chạy nào. Bộ lọc `locale/**` của Django bao gồm cả các catalog mà bot
commit, nên mỗi commit của nó sẽ khởi chạy thêm một lần chạy nữa — lần chạy này không tìm thấy gì để
dịch và không commit gì cả. Với loại token như vậy, hãy thu hẹp phạm vi về catalog nguồn
(`locale/en/**`) và thêm ngôn ngữ qua tệp cấu hình.

**Khóa nhà cung cấp là bắt buộc cho mỗi lần chạy được khởi động**, kể cả khi không có gì
cần dịch: sync kiểm tra xem phương thức có thể chạy được không trước khi xem xét những gì
đã thay đổi. Một lần chạy được khởi chạy thủ công mà không có thay đổi nguồn nào vẫn sẽ thất bại nếu thiếu
secret `OPENROUTER_API_KEY` (hoặc khóa của phương thức bạn dùng). `local` không cần khóa, nhưng
runner không có sẵn model server: một dự án dịch bằng `local` trên
máy của lập trình viên sẽ chỉ định một phương thức được lưu trữ (hosted) trong CI (`--method` / `--model` — dòng
`SYNC_FLAGS` được chú thích trong workflow ở trên). Để kiểm tra xem secret
có được truyền đến bước này không mà không cần dịch gì, `sync --dry` sẽ cảnh báo khi
lần chạy thật sẽ phải dừng lại và nêu tên biến bị thiếu (nó vẫn thoát với mã 0 — dry
run chỉ là bản xem trước). Lệnh này kiểm tra xem biến đã được **thiết lập** hay chưa, chứ không kiểm tra khóa có
**hoạt động** hay không: nó không gửi đi gì cả, nên bất kỳ giá trị không rỗng nào cũng vượt qua — kể cả giá trị giữ chỗ (placeholder).
Một khóa sai hoặc bị thu hồi sẽ lộ ra ở yêu cầu đầu tiên của lần chạy thật (lỗi
sẽ nêu câu trả lời của nhà cung cấp, chẳng hạn HTTP 401). Để đánh trượt job nếu thiếu
khóa trước khi bất kỳ thứ gì chạy, hãy thêm [bước kiểm tra trước khi sync](#check-before-sync).

**Cache được lưu giữ riêng cho từng phương thức.** Bản dịch được lưu cache theo phương thức,
văn phong (register) và tệp hướng dẫn (coaching) đã tạo ra nó (một mô hình khác của cùng một
phương thức có thể tái sử dụng nó — chuyển tiếp mô hình / model carry-over). Do đó, lập trình viên dịch bằng `local`
và CI dịch bằng mô hình hosted không bao giờ dùng chung các mục cache —
và đằng nào thì cache của CI cũng là của riêng nó (`.champollion/` không được commit). Điều đó
không có nghĩa là CI dịch lại toàn bộ dự án: những gì đã có trong các tệp locale,
với tệp lock đã được commit, được tính là đã hoàn thành. CI chỉ trả tiền cho mô hình hosted đối với
các chuỗi mới hoặc bị thay đổi kể từ commit gần nhất — bao gồm bất kỳ chuỗi nào mà
lập trình viên đã dịch cục bộ nhưng chưa commit — và không tốn gì cho phần còn lại.
Việc dịch lại toàn bộ dự án bằng mô hình hosted (`--redo all`) sẽ tính phí
mỗi chuỗi một lần.

**Theo lịch trình** thay vì theo push: hãy thay khối `on:` bằng
`schedule: [{ cron: '0 6 * * *' }]`.

### Kiểm tra trước khi sync: cho job thất bại sớm {#check-before-sync}

Một lần chạy thử (dry run) luôn thoát với mã `0` bất kể nó tìm thấy gì — vì nó chỉ là bản xem trước — nên `sync --dry
--max-cost 5` sẽ cảnh báo rằng lần chạy thật sẽ dừng lại ở mức giới hạn chi phí nhưng bước CI vẫn được thông qua.
Để đánh trượt job khi lần chạy thật sẽ dừng lại (thiếu khóa, hoặc
`--max-cost`), hãy đọc bản tóm tắt của `sync --dry --json`. Đầu ra đó là
mỗi dòng một đối tượng JSON (NDJSON), mỗi dòng có một `level` — các dòng `info`, `ok` và
`event` ở stdout, các dòng `warn` và `error` ở stderr — và dòng stdout
cuối cùng là phần tóm tắt, `{"level": "summary", "command": "sync", …}`.
Hãy lọc nó theo cấp độ (level). **Chạy lệnh này với cùng các cờ như lệnh sync**: nếu không có
chúng, nó sẽ kiểm tra phương thức mà cấu hình chỉ định, nên đối với dự án có cấu hình
chỉ ra `local`, nó sẽ kiểm tra phương thức cục bộ — chứ không phải mô hình hosted mà job
thực thi — và sẽ vượt qua trên một runner không có khóa API. Dưới dạng một bước trong workflow ở trên,
trước bước "Sync translations", nó đọc cùng một `SYNC_FLAGS`:

```yaml
      - name: Check the sync can run (translates nothing)
        env:
          OPENROUTER_API_KEY: ${{ secrets.OPENROUTER_API_KEY }}
        # The JSON lines go to $out; the warnings (stderr) stay in the log.
        # When the check fails, the step prints why: the summary's
        # realRun.reasons, or its error when sync could not run at all
        # (that exit code is not fatal here — the summary is read instead).
        run: |
          out=$(npx --yes champollion@0.6 sync --dry $SYNC_FLAGS --json) || true
          if ! printf '%s\n' "$out" | jq -e 'select(.level == "summary") | .preflight.ready and (.maxCost.wouldStop | not)' > /dev/null; then
            printf '%s\n' "$out" | jq -r 'select(.level == "summary") | "::error::" + (.error // "A real sync would exit \(.realRun.exitCode): \(.realRun.reasons | join("; "))")'
            exit 1
          fi
```

Hoặc trong shell, với các cờ được viết rõ ràng — giống hệt các cờ ở dòng sync:

```bash
SYNC_FLAGS="--method llm --model google/gemini-3.8-flash --max-cost 5"
out=$(npx --yes champollion@0.6 sync --dry $SYNC_FLAGS --json)
printf '%s\n' "$out" | jq -e 'select(.level == "summary") | .preflight.ready and (.maxCost.wouldStop | not)' > /dev/null \
  || printf '%s\n' "$out" | jq -r 'select(.level == "summary") | .error // "A real sync would exit \(.realRun.exitCode): \(.realRun.reasons | join("; "))"'
```

`preflight.ready` là `false` khi thiếu khóa mà phương thức cần (chưa đặt hoặc
để trống — chứ không phải khi khóa bị sai), bất kể có cần dịch gì hay không: một
phương thức hosted không bao giờ sẵn sàng nếu thiếu khóa. `maxCost.wouldStop` (xuất hiện cùng với
`--max-cost`) là `true` khi lần chạy thật sẽ dừng lại ở mức giới hạn chi phí. `jq -e` thoát với
mã 1 trong cả hai trường hợp, và bước này sau đó sẽ in lý do vào nhật ký job — ví dụ:
`A real sync would exit 1: it would stop before translating: No OpenRouter API
key (OPENROUTER_API_KEY) for en:fr`, or `A real sync would exit 2: --max-cost
would stop it before any API call (Estimated translation cost exceeds the
--max-cost cap: estimate ~$7.1200, cap $5.0000)`. Khi sync không thể chạy
được chút nào (cấu hình bị hỏng), bước này sẽ in `error` của phần tóm tắt. Bước này
không chuyển hướng stderr sang `/dev/null`, nên các cảnh báo vẫn được giữ lại trong nhật ký. Mục
`realRun.exitCode` của bản tóm tắt cho biết lần chạy thật sẽ thoát với mã nào,
trong chừng mực mà bản xem trước có thể xác định: `1` khi quá trình tiền kiểm dừng nó lại, `2`
khi `--max-cost` dừng nó, hoặc khi nó kết thúc dở dang — các khóa bị giữ lại, hoặc
các thông điệp số nhiều trên đĩa thiếu dạng mà ngôn ngữ đó sử dụng (`realRun.reasons`
sẽ nêu rõ dạng nào). Việc bị cổng chất lượng từ chối, điều mà chỉ lần chạy thật mới phát hiện được, vẫn
có thể biến `0` thành `2`. Để bước kiểm tra cũng thất bại khi dự đoán lần chạy sẽ dở dang,
hãy đặt `.realRun.exitCode == 0` vào vị trí của `.preflight.ready and (.maxCost.wouldStop | not)`.

### Nhánh main được bảo vệ: tạo pull request

Workflow ở trên sẽ push các bản dịch trực tiếp lên `main`. Nếu `main` được
bảo vệ (yêu cầu review hoặc kiểm tra trạng thái), lần push đó sẽ bị từ chối — sau khi
sync đã chạy, tức là các bản dịch đã được trả phí xong. Chúng sẽ không bị tính phí
lần nữa: cache được lưu trước bước commit, kể cả khi có một bước bị thất bại,
nên việc chạy lại job hoặc lần push tiếp theo (mỗi lần đều khôi phục cache mới nhất
của nhánh, thông qua `restore-keys`) sẽ lấy chúng từ cache. Các
tệp lock chưa từng vào được `main`, nên lần chạy tiếp theo thấy chính các chuỗi đó
đã thay đổi và ghi lại chúng — từ cache, không tốn chi phí.

Trên một nhánh `main` được bảo vệ, hãy commit vào một nhánh do bot sở hữu và mở (hoặc cập nhật) một
pull request thay thế. Hãy giữ nguyên workflow ở trên và thay đổi hai điều: quyền hạn
(permissions) và bước commit.

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

**Khi nào nên dùng cách nào.** Push lên `main` khi workflow được phép push tới đó: không có
bảo vệ nhánh, hoặc có quy tắc cho phép GitHub Actions bỏ qua bảo vệ. Hãy mở một pull
request khi `main` được bảo vệ, hoặc khi một con người — người nói ngôn ngữ đó
— cần đọc các bản dịch trước khi phát hành.

- Nhánh này thuộc về bot. Cho đến khi pull request được hợp nhất (merge), các tệp lock
  của `main` chưa có các bản dịch đó, vì vậy mỗi lần chạy đều đề xuất lại toàn bộ
  tập hợp — từ cache, do đó chỉ các chuỗi thay đổi sau đó mới bị tính phí. Các chỉnh sửa
  được push lên nhánh đó sẽ bị lần chạy tiếp theo ghi đè: hãy review trong pull
  request, merge, rồi mới chỉnh sửa trên `main` (việc làm lại hàng loạt sau đó sẽ giữ lại chỉnh sửa
  của con người).
- Kho lưu trữ phải cho phép Actions mở pull request: Settings → Actions →
  General → "Allow GitHub Actions to create and approve pull requests".
- Một pull request được mở bằng `GITHUB_TOKEN` của workflow sẽ không kích hoạt workflow
  nào khác, do đó các quy trình kiểm tra trạng thái bắt buộc sẽ không bao giờ chạy trên đó. Nếu `main` yêu cầu
  chúng, hãy mở PR bằng GitHub App token hoặc fine-grained token được lưu dưới dạng
  secret (`GH_TOKEN: ${{ secrets.<name> }}`), hoặc dùng một action như
  `peter-evans/create-pull-request`, công cụ này sẽ commit, cập nhật nhánh và
  chỉnh sửa pull request đang mở thay cho bạn (truyền token cho nó theo cách tương tự).

### gettext (Django, Babel) và Flutter

Sync dịch các catalog đã tồn tại; nó không trích xuất chuỗi từ
mã nguồn của bạn. Dự án Django sẽ làm mới các catalog trước bước sync,
kiểm tra xem chúng có biên dịch được sau đó không, và chỉ commit các catalog.

Cả `makemessages` và `compilemessages` đều import các cài đặt của bạn, nên job
sẽ thiết lập những gì chúng cần, một lần, cho mọi bước: bất kỳ biến nào mà module settings
của bạn đọc khi import (`SECRET_KEY`, `DATABASE_URL`, …). Cả hai lệnh đều không can thiệp vào
cơ sở dữ liệu, vì vậy một giá trị giữ chỗ (placeholder) là đủ cho những biến đó. `DJANGO_SETTINGS_MODULE`
được để ở dạng chú thích: tệp `manage.py` mà `startproject` ghi ra sẽ tự
thiết lập nó, và giá trị được đặt trong job sẽ ghi đè lên giá trị đó — tên module sai
sẽ làm hỏng `makemessages`. Chỉ đặt giá trị này khi `manage.py` của bạn không làm điều đó.

Bộ lọc `paths:` của nó khác với workflow ở trên: các chuỗi nguồn nằm trong
mã nguồn Python và template của bạn, và `makemessages` sẽ trích xuất chúng trong job, vì vậy
thay đổi mã nguồn có thể mang lại chuỗi mới. Hãy thu hẹp các pattern vào các app của bạn
(`myapp/**.py`) nếu mọi lần push đều chạm vào Python. Nó cũng theo dõi `locale/**`:
ngôn ngữ mới xuất hiện dưới dạng một thư mục catalog mới (`makemessages -l <code>`). Bản thân
commit của bot làm thay đổi các catalog đó nhưng không bắt đầu lần chạy nào, vì nó
được push bằng `GITHUB_TOKEN` (xem **Bản thân commit của job không bao giờ kích hoạt lại chính nó**
ở trên — và những gì cần thu hẹp khi bạn push bằng một token khác).

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
          npx --yes champollion@0.6 sync $SYNC_FLAGS ${{ inputs.redo_gaps && '--redo gaps' || '' }}
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
        run: npx --yes champollion@0.6 verify --strict
```

`--all` cập nhật mọi catalog đã tồn tại; thêm một ngôn ngữ bằng
`makemessages -l <code>` một lần (hoặc `champollion init --langs <code>`).
`makemessages` chạy một lần cho mỗi domain: `django` cho Python và template,
`djangojs` (`-d djangojs`) cho JavaScript. Sync dịch catalog của mọi domain
mà nó tìm thấy. Bước cuối cùng chạy `verify --strict`. Một mục số nhiều tiếng Nga
có bản dịch thiếu dạng `few` hoặc `many` sẽ được ghi bằng dạng `other`
và được đánh dấu `# champollion:`. Mọi lần sync đều thoát với mã `2` chừng nào mục như vậy còn
nằm trong catalog — lần chạy ghi ra nó và mọi lần chạy sau đó, tương tự như một khóa bị
giữ lại — và bản tóm tắt của nó sẽ nêu tên mục đó cùng lệnh để yêu cầu dịch lại; dòng
xác minh sau sync khi đó sẽ thông báo lần chạy chưa hoàn tất thay vì `[OK]`.
Vì vậy, bước "Stop when the sync was partial" sẽ đánh trượt job sau khi commit
cho đến khi các dạng số nhiều được điền đầy đủ. Khi chạy độc lập, đây chỉ là cảnh báo: lệnh `verify`
thông thường thoát với mã 0 khi gặp nó, trong khi `--strict` sẽ thất bại. `audit` tính các mục này
là chưa hoàn chỉnh.

`compilemessages` chạy `msgfmt --check-format`, lệnh này cũng kiểm tra xem mỗi
`%(name)s` có giữ đúng kiểu của nó hay không — nhưng chỉ trên các mục được gắn cờ `#, python-format`.
`makemessages` thêm cờ đó vào các mục mà nó trích xuất có placeholder `%`;
một catalog tạo thủ công có thể thiếu cờ này, và các mục của nó khi đó sẽ không được
kiểm tra. `champollion
verify` so sánh các placeholder printf của mọi mục (tên và ký tự kiểu)
bất kể cờ của nó là gì, và sync giữ lại các cờ của mục nguồn trên từng mục mà nó
dịch. Bước commit sẽ stage `*.po` và
`.champollion.lock` theo tên (và bản ghi các chỉnh sửa bị thay thế nếu có);
nếu dự án của bạn có theo dõi các tệp `.mo`, hãy thêm `'*.mo'` vào đó. Các
bước cache, mã thoát được ghi lại và `git pull --rebase` có mặt ở đó với
cùng lý do như trong workflow ở trên. Với Babel: `pybabel extract` + `pybabel update --no-wrap` trước
khi sync, `pybabel compile` sau khi sync.

Flutter không cần thêm bước nào trong job này: sync ghi các tệp `app_<locale>.arb`,
và `flutter gen-l10n` (hoặc `flutter build`, lệnh thực thi nó) là bước bản dựng
riêng của ứng dụng của bạn, nơi nó chuyển đổi chúng thành Dart.

#### Các dạng số nhiều mà mô hình bỏ sót {#plural-gaps}

Một mục bị đánh dấu không phải là một bản dịch, vì vậy sync không phó mặc hoàn toàn cho con người:

- **Phương thức hoặc mô hình khác sẽ tự động hỏi lại.** Một lần sync có thiết lập
  (phương thức, mô hình, văn phong, tệp hướng dẫn) chưa từng trả lời mục đó sẽ gửi lại
  mục đó cho mô hình — thay vì lấy từ cache, nơi đang giữ câu trả lời chưa
  hoàn chỉnh. Do đó, khi mô hình cục bộ của lập trình viên bỏ sót các dạng số nhiều, mô hình
  hosted của job (`SYNC_FLAGS`) sẽ yêu cầu chúng trong lần chạy tiếp theo, và bản ước tính
  sẽ tính giá cho phần này. Tệp lock (`.champollion.lock`, dưới `gaps`) ghi lại từng thiết lập
  đã trả lời mà thiếu các dạng số nhiều, nhờ đó lần chạy cục bộ và lần chạy CI không bao giờ lần lượt
  trả phí cho cùng một câu trả lời chưa hoàn chỉnh.
- **`sync --redo gaps` sẽ yêu cầu lại mọi mục như vậy**, bất kể bên nào đã bỏ sót — trong các
  workflow ở trên, hãy tick chọn `redo_gaps` dưới **Run workflow**. Thêm `--model` vào
  `SYNC_FLAGS` nếu muốn dùng một mô hình mạnh hơn.
- **Nếu câu trả lời mới cũng thiếu các dạng số nhiều, mục đó vẫn giữ nguyên trạng thái bị đánh dấu** và
  lần chạy thoát với mã `2` như trước. Khi đó, hãy tự điền các dạng số nhiều bằng tay và xóa dòng
  `# champollion:`.

Lần chạy thử (`sync --dry`) sẽ nêu tên các mục mà nó sẽ yêu cầu dịch lại kèm theo chi
phí; phần tóm tắt `--json` của nó đếm các mục mà nó sẽ không hỏi lại (`totalPluralGaps`)
và thông báo rằng lần chạy thật sẽ thoát với mã `2` vì chúng (`realRun.exitCode`).

## Các phương thức khác

Các đoạn mã dưới đây hiển thị khóa mà mỗi phương thức cần và lệnh `sync` tương ứng.
Hãy sử dụng chúng **bên trong** bước "Sync translations" của workflow ở trên: hoán đổi
`env` của nó, đưa các cờ hiển thị (`--method openai`, …) vào dòng
`SYNC_FLAGS` của workflow — để bước kiểm tra dry-run chạy cùng một phương thức — và giữ nguyên
phần còn lại của bước (`id: sync` và các dòng ghi lại mã thoát), để một lần
chạy dở dang vẫn commit những gì đã dịch và lưu cache.

## Phương thức Google Translate

Nếu sử dụng phương thức Google Translate tích hợp sẵn thay vì OpenRouter:

```yaml
- name: Sync translations
  env:
    GOOGLE_TRANSLATE_API_KEY: ${{ secrets.GOOGLE_TRANSLATE_API_KEY }}
  run: npx --yes champollion@0.6 sync
```

## Các nhà cung cấp LLM trực tiếp

Nếu sử dụng trực tiếp các phương thức `openai`, `anthropic`, hoặc `gemini`:

```yaml
# OpenAI
- name: Sync translations
  env:
    OPENAI_API_KEY: ${{ secrets.OPENAI_API_KEY }}
  run: npx --yes champollion@0.6 sync --method openai

# Anthropic
- name: Sync translations
  env:
    ANTHROPIC_API_KEY: ${{ secrets.ANTHROPIC_API_KEY }}
  run: npx --yes champollion@0.6 sync --method anthropic

# Gemini (free tier available)
- name: Sync translations
  env:
    GEMINI_API_KEY: ${{ secrets.GEMINI_API_KEY }}
  run: npx --yes champollion@0.6 sync --method gemini
```

## DeepL

```yaml
- name: Sync translations
  env:
    DEEPL_API_KEY: ${{ secrets.DEEPL_API_KEY }}
  run: npx --yes champollion@0.6 sync --method deepl
```

## Remote Translation API

Nếu sử dụng một remote translation endpoint (ví dụ: dịch vụ dịch thuật được lưu trữ từ xa):

```yaml
- name: Sync translations
  env:
    CHAMPOLLION_API_KEY: ${{ secrets.CHAMPOLLION_API_KEY }}
  run: npx --yes champollion@0.6 sync
```

## Cổng kiểm soát trước khi triển khai (deploy)

Để đánh trượt bản dựng khi có bất kỳ locale nào chưa hoàn chỉnh hoặc bị hỏng mà không cần dịch
bất cứ thứ gì, hãy chạy riêng các bước kiểm tra.

:::warning[Chạy cổng kiểm soát sau khi sync, không chạy trước đó]
Nếu quá trình dịch chỉ chạy sau khi merge (workflow ở trên), một pull request
thêm chuỗi mới sẽ chưa có bản dịch cho chuỗi đó, và `audit`/`verify` sẽ đánh trượt mọi
PR như vậy. Hãy chạy cổng kiểm soát ở nơi bản dịch đã tồn tại: trên `main` sau
job sync (`needs: sync`, hoặc `on: workflow_run` của workflow sync). Trigger
`push` không kích hoạt trên các commit của chính bot sync — chúng được push
bằng `GITHUB_TOKEN`, thứ không khởi chạy workflow nào (xem ở trên). Trên pull request,
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
      - run: npx --yes champollion@0.6 lint
      # 2. Every key present, nothing empty or left as an [EN] fallback
      - run: npx --yes champollion@0.6 audit
      # 3. Placeholders, ICU plurals, markup and scripts intact. --strict:
      #    warnings fail the build too (an extra or missing plural form, a
      #    source echo, an out-of-date translation pass plain verify).
      - run: npx --yes champollion@0.6 verify --strict
```

| Kiểm tra | Lệnh | Bị trượt khi |
|-------|---------|------------|
| **Lint** | `lint` | Mã nguồn có các chuỗi không nằm trong tệp locale — hoặc không tìm thấy tệp nguồn nào để kiểm tra (lệnh sẽ nêu tên các thư mục đã tìm; trỏ lệnh sang nơi khác bằng `--src <dir>`) |
| **Audit** | `audit` | Một khóa bị thiếu, trống, hoặc vẫn là fallback `[EN]` — hoặc bản dịch **bị lỗi thời**: được tạo từ văn bản nguồn cũ hơn văn bản hiện tại (chỉnh sửa nguồn nhưng dịch lại thất bại) — hoặc thông điệp số nhiều thiếu một dạng mà ngôn ngữ dùng cho việc đếm thông thường (tiếng Nga `few`/`many`; các mục mà `verify --strict` đánh trượt), kèm theo lệnh để yêu cầu dịch lại |
| **Verify** | `verify` | Bản dịch làm hỏng placeholder, số nhiều ICU, markup (thẻ mở, đóng hoặc lồng nhau sai cách) hoặc script — hoặc thiếu khóa — hoặc một đoạn văn bản dùng chung cho nhiều chuỗi nguồn khác nhau (mô hình lặp lại một câu học vẹt) — hoặc không tìm thấy gì để kiểm tra (tệp nguồn hoặc thư mục locales không nằm ở nơi cấu hình chỉ định) |
| **Verify, strict** | `verify --strict` | Bất kỳ lỗi nào ở trên, hoặc bất kỳ cảnh báo nào |

`verify` thoát với mã `1` khi gặp bất kỳ lỗi nào và thoát với mã `0` trong các trường hợp khác. Cảnh báo sẽ được in ra nhưng không
làm trượt job: chuỗi lặp lại nguồn (source echo), hai locale có văn bản y hệt nhau,
bản dịch bị lỗi thời, bản dịch làm mất dấu đóng `?` hoặc `!` của nguồn (một số ngôn ngữ đánh dấu câu hỏi bằng trợ từ thay thế),
và các cảnh báo số nhiều bên dưới. Một đoạn văn bản được dùng cho nhiều chuỗi nguồn khác nhau
sẽ tính là lỗi: hai chuỗi nhiều từ rõ ràng khác nhau nhưng lại được trả lời bằng
cùng một văn bản từ bốn từ trở lên, hoặc từ ba từ trở lên trong các trường hợp khác. Lỗi này được tính
trên các giá trị khóa, từng nhánh số nhiều và các trang Markdown của locale, theo
quy tắc mà cổng kiểm soát của `sync` dùng để từ chối. `verify --strict` biến mọi cảnh báo thành
lỗi thất bại. Hãy dùng tùy chọn này khi, chẳng hạn, các dạng số nhiều tiếng Nga bị mô hình bỏ sót bắt buộc
phải chặn việc triển khai. Bản dịch lỗi thời chỉ là cảnh báo trong `verify` (cấu trúc
vẫn nguyên vẹn) và là lỗi thất bại trong `audit` (cổng kiểm tra tính hoàn chỉnh), lệnh này sẽ
in ra câu lệnh để dịch lại chúng.

Các phát hiện về số nhiều phụ thuộc vào cách định dạng lưu trữ dạng số nhiều:

| Định dạng | Lỗi (`verify` thoát với mã 1) | Cảnh báo (chỉ trượt với `--strict`) |
|--------|--------------------------|--------------------------------------|
| Khóa hậu tố i18next (`count_one`, `count_other`, …) | Thiếu một dạng mà locale cần (tiếng Pháp `count_many`): tính là thiếu khóa. | Khóa cho một dạng mà locale không có (tiếng Pháp hoặc tiếng Tây Ban Nha `count_two`). `verify` in lệnh để xóa chính xác các khóa đó, `sync --prune plural-extras`; sync không bao giờ tự ý xóa chúng nếu không có lệnh này. |
| Thông điệp ICU (`{count, plural, …}` trong next-intl, ARB, i18next ICU) | Cấu trúc số nhiều bị hỏng (biến, từ khóa hoặc selector bị dịch, mất `#`). | Thiếu một nhánh mà locale dùng cho việc đếm thông thường (tiếng Nga `few`, `many`). Dạng bị thiếu chỉ dùng cho các số lớn (tiếng Pháp `many`, cho 1 000 000) sẽ không bị báo lỗi. |
| gettext (`msgid_plural`) | Một mục không có bản dịch (trống hoặc `fuzzy`): tính là thiếu khóa. | Các dạng `msgstr[]` lặp lại dạng `other` ở những nơi ngôn ngữ có dạng riêng cho việc đếm thông thường (được đánh dấu bằng chú thích `# champollion:`). Số dòng `msgstr[]` nhiều hơn `nplurals` của catalog. Các dạng số nhiều được tính theo chính tiêu đề `Plural-Forms` của catalog. |

Một dạng i18next được dịch từ văn bản của dạng khác có thể chứa chính xác văn bản
của dạng đó (tiếng Pháp `count_many` giống hệt `count_other`). Tiếng Pháp có thể viết
cả hai giống nhau, vì vậy điều này không bao giờ là cảnh báo. Khi sync yêu cầu mô hình dịch một dạng số nhiều, nó
sẽ ghi lại điều đó vào `.champollion.lock` cùng mã định danh (fingerprint) của câu trả lời. `verify`
chỉ đọc bản ghi đó, vì vậy mọi bản clone của một commit đều nhận được kết quả như nhau. Cache
trên laptop của bạn và một CI runner mới sẽ không thể sai lệch nhau. Một giá trị không có bản ghi
(được viết thủ công, bởi công cụ khác, bởi một công cụ dịch máy không
thể nhận diện dạng, hoặc bởi một phiên bản cũ hơn) sẽ nhận được một dòng thông tin kèm theo lệnh
yêu cầu dịch lại. `--strict` không đánh trượt trường hợp này.
Verify kiểm tra cấu trúc, không kiểm tra ngữ nghĩa: việc vượt qua kiểm tra chỉ xác nhận các khóa, placeholder,
số nhiều, markup và script còn nguyên vẹn, chứ không khẳng định văn bản có ý nghĩa
chính xác.

---

## Xem thêm

- [Tài liệu tham khảo CLI](/docs/reference/cli) — tài liệu tham khảo đầy đủ về các lệnh
- [Cách Sync hoạt động](/docs/concepts/how-sync-works) — tìm hiểu về đồng bộ tăng dần (incremental sync)
- [Bộ nhớ dịch (Translation Memory)](/docs/concepts/translation-memory) — lưu cache và tiết kiệm chi phí
- [Phương thức dịch](/docs/guides/translation-methods) — lựa chọn phương thức theo từng cặp ngôn ngữ
- [Cổng chất lượng (Quality Gate)](/docs/concepts/quality-gate) — điều gì xảy ra khi bản dịch thất bại
- [Cấu hình](/docs/getting-started/configuration) — tài liệu tham khảo cấu hình
