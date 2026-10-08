---
sidebar_position: 3
title: "CI/CD"
---

# การผสานรวม CI/CD

ทำให้การแปลเป็นอัตโนมัติในไปป์ไลน์การ build ของคุณ

champollion CLI เป็นซอร์สที่เปิดให้เข้าถึงได้ (source-available) ภายใต้ [PolyForm Noncommercial License 1.0.0](https://github.com/gamedaysuits/Champollion/blob/main/cli/LICENSE): ใช้งาน ดัดแปลง และแบ่งปันได้ฟรีเพื่อวัตถุประสงค์ที่ไม่ใช่เชิงพาณิชย์ การใช้งานเพื่อวัตถุประสงค์เชิงพาณิชย์จะไม่ครอบคลุมภายใต้สัญญาอนุญาตนี้ ([ใครบ้างที่สามารถใช้งานได้](/docs/getting-started/who-may-use-this))

## GitHub Actions: ซิงค์คำแปลให้เป็นปัจจุบันอยู่เสมอ

เวิร์กโฟลว์ที่สมบูรณ์: แปลส่วนที่มีการเปลี่ยนแปลง ตรวจสอบผลลัพธ์ และคอมมิตกลับเข้าไป สามารถทำงานได้กับทุกโปรเจกต์ — ไม่ว่าจะเป็น Node หรือไม่ก็ตาม (Django, Flutter, Hugo)

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

**เหตุผลที่เวิร์กโฟลว์ถูกออกแบบในรูปแบบนี้** `actions/cache` เพียงลำพังจะบันทึกแคชเฉพาะเมื่อทั้งจ็อบสำเร็จเท่านั้น และ `sync` จะจบการทำงานด้วยรหัส `2` เมื่อมีคีย์ใดๆ ถูกปฏิเสธ — ดังนั้นการรันที่เสร็จสิ้นเพียงบางส่วนจึงเคยข้ามทั้งการคอมมิตและการบันทึกแคช ทำให้การรันครั้งถัดไปต้องเสียค่าใช้จ่ายสำหรับคำแปลเดิมซ้ำอีก ในที่นี้แคชจะถูกกู้คืนและบันทึกแยกเป็นสองขั้นตอน (`actions/cache/restore` แล้วตามด้วย `actions/cache/save` พร้อม `if: always()`) ขั้นตอนการซิงค์จะบันทึก exit code ของตัวเองแทนที่จะล้มเหลวทันทีที่ `2` ไฟล์ที่แปลแล้วจะถูกคอมมิต และหลังจากนั้นจ็อบจึงค่อยล้มเหลว — ในขั้นตอนของมันเอง ก่อนหน้า `verify` เพื่อให้ขั้นตอนที่ล้มเหลวแจ้งเหตุผล (การหยุดทำงานเนื่องจาก `--max-cost` หรือคีย์ที่การซิงค์ไม่สามารถแปลได้) แทนที่ `verify` จะระบุชื่อคีย์ที่ขาดหายไป ขั้นตอนสุดท้ายคือ `verify --strict`: คำสั่ง `verify` ปกติจะจบด้วย 0 เมื่อพบคำเตือน (รวมถึงรูปพหูพจน์ที่เกินมาหรือขาดหายไป) และ `--strict` จะทำให้จ็อบล้มเหลวเมื่อพบคำเตือนเหล่านั้น คีย์ที่ quality gate ปฏิเสธจะถูกจดจำไว้: การรันครั้งถัดไปจะไม่ส่งคีย์เดิมไปยังโมเดลเดิมอีก (เพราะจะทำให้เสียค่าใช้จ่ายสำหรับคำตอบเดิม) — บันทึกการซิงค์จะระบุชื่อคีย์และคำสั่ง `--redo keys:` ที่ใช้ขอคำแปลใหม่อีกครั้ง

**แคชหนึ่งชุดต่อหนึ่งการเปลี่ยนแปลง ไม่ใช่ต่อหนึ่งการรัน** ขั้นตอนการกู้คืนจะดึงแคชที่ใหม่ที่สุดของบรันช์กลับมา (คีย์ที่ตรงกันเป๊ะๆ คือ `…-newest` จะไม่ถูกบันทึก ดังนั้น `restore-keys` จึงเลือกแคชล่าสุด) ขั้นตอนการบันทึกจะกำหนดคีย์ของแคชตามแฮชของไฟล์ในตัวมันเอง (`hashFiles('.champollion/**')`): การรันที่มีการแปลบางอย่างเกิดขึ้น — แม้จะเป็นการรันที่สำเร็จเพียงบางส่วน หรือการรันที่ push ไม่สำเร็จ — จะทำให้แคชเปลี่ยนไป ดังนั้นมันจึงได้คีย์ใหม่และถูกบันทึกไว้; ส่วนการรันที่ไม่ได้เพิ่มอะไรใหม่เลย (ไม่มีอะไรให้แปล, ข้อมูลทั้งหมดมาจากแคช, หรือหยุดเพราะ `--max-cost`) จะมีคีย์ตรงกับที่กู้คืนมา ดังนั้นจึงข้ามการบันทึกและไม่มีการเก็บชุดแคชใหม่ การกำหนดคีย์ตาม run id จะทำให้เกิดการบันทึกแคชเต็มชุดใหม่ทุกการรัน ส่วนการกำหนดคีย์ตามไฟล์ lock และไฟล์ต้นทางจะกู้คืนแคชเวอร์ชันเก่ากว่าโดยการจับคู่ตรงตัวหลังจากการรันที่การ push ถูกปฏิเสธ เนื่องจากไฟล์ lock ที่คอมมิตไปยังไม่ได้รับค่าการเปลี่ยนแปลงจากการรันนั้น

ในโปรเจกต์ Node คุณสามารถเพิ่ม `champollion` เป็น dev dependency และเรียก `npx champollion sync` แทนได้ แต่การตรึงเวอร์ชันด้วย `champollion@0.5` ด้านบนจะทำงานได้กับทุกที่เก็บข้อมูล (repository) และไม่มีทางดึงเวอร์ชันอื่นมาใช้โดยไม่คาดคิด จากนั้นจ็อบจะต้องติดตั้งแพ็กเกจ: บน runner เครื่องใหม่ การใช้ `npx champollion` โดยที่ยังไม่ได้ติดตั้งอะไรไว้จะดึงเวอร์ชันล่าสุดมา ไม่ใช่เวอร์ชันที่ไฟล์ lock ของคุณตรึงไว้ และการติดตั้งจะเขียนไฟล์ `node_modules/` ซึ่ง `git add --all` จะคอมมิตไฟล์นี้ไปด้วย เว้นแต่ว่า `.gitignore` ของคุณจะระบุชื่อไฟล์นี้ไว้ (ไฟล์ที่ `champollion init` สร้างขึ้นจะระบุเฉพาะ `.champollion/` เท่านั้น) ดังนั้นควรทำการสเตจ (stage) ไฟล์ภาษาและไฟล์ lock ตามชื่อไฟล์โดยเฉพาะ ดังที่เวิร์กโฟลว์ Django ด้านล่างทำ:

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

**คอมมิตไฟล์ lock เสมอ** `.champollion.lock` และ `.champollion-content.lock` จะบันทึกว่าคำแปลแต่ละคำสร้างมาจากข้อความต้นทางใด ไฟล์เหล่านี้คือวิธีที่การรันครั้งถัดไปจะทราบว่ามีสตริงที่เปลี่ยนแปลงไป runner ที่มองไม่เห็นไฟล์เหล่านี้จะไม่สามารถแยกความแตกต่างระหว่างสตริงที่แก้ไขกับสตริงที่ไม่ได้แตะต้องได้ **อย่าคอมมิต `.champollion/`** — โฟลเดอร์นี้คือแคชเฉพาะเครื่อง โดย `champollion init` จะเพิ่มลงใน `.gitignore` ให้อยู่แล้ว

**`--max-cost`** จะหยุดการรันก่อนที่จะใช้จ่ายเกินกว่าที่คุณคาดไว้ โดยตั้งค่าให้เท่ากับค่าใช้จ่ายสำหรับการเปลี่ยนแปลงตามปกติในหนึ่งวัน เมื่อตัวเลือกนี้สั่งหยุดการรัน จะไม่มีสิ่งใดถูกแปลหรือเขียนลงไฟล์ และ sync จะจบด้วยโค้ด `2`: ทำให้ไม่มีอะไรต้องคอมมิต และขั้นตอน "Stop when the sync was partial" จะทำให้จ็อบล้มเหลวพร้อมแจ้งเหตุดังกล่าว วิธีการที่ไม่มีราคาประกาศไว้ (เช่น เอนด์พอยต์ที่โฮสต์เองบนเครื่องอื่น) จะไม่สามารถประเมินค่าใช้จ่ายได้ ดังนั้น `--max-cost` จะหยุดทำงานทุกครั้งเมื่อมีสิ่งที่จะต้องแปล — จึงควรปิดการใช้งานตัวเลือกนี้สำหรับกรณีดังกล่าว ส่วนโมเดลที่ให้บริการบน runner โดยตรง (`local` ที่ `localhost`/`127.0.0.1`) จะคิดค่าใช้จ่าย API ที่ $0

**เฉพาะการ push ที่เปลี่ยนแปลงสตริงต้นทางเท่านั้นที่จะเริ่มทำงานจ็อบ** ตัวกรอง `paths:` จะระบุไฟล์ภาษาต้นทางและ `champollion.config.json` ของคุณ: การ push ที่เปลี่ยนเฉพาะโค้ด หรือเปลี่ยนเฉพาะคำแปลและไฟล์ lock จะไม่มีอะไรให้แปล จึงไม่มีการเริ่มจ็อบ แก้ไขพาธภาษาทั้งสองให้ตรงกับไฟล์ที่คอนฟิกของคุณระบุไว้ (`messages/en.json`, `lib/l10n/app_en.arb`, …); เพิ่มโฟลเดอร์ `contentDir` ของคุณเมื่อ sync ทำการแปล Markdown ด้วย ทั้งนี้ **Run workflow** (ทริกเกอร์ `workflow_dispatch`) ยังคงสามารถสั่งรันด้วยตนเองได้เสมอ

**คอมมิตของตัวจ็อบเองจะไม่มีวันสั่งให้จ็อบเริ่มทำงานใหม่อีกครั้ง** — และไม่ใช่ตัวกรอง `paths:` ที่หยุดมัน ขั้นตอนการคอมมิตจะ push ด้วย `GITHUB_TOKEN` ของเวิร์กโฟลว์ และการ push ที่ทำด้วย `GITHUB_TOKEN` จะไม่มีวันทริกเกอร์การรันเวิร์กโฟลว์ (กฎของ GitHub เพื่อไม่ให้เวิร์กโฟลว์สั่งให้ตัวเองเริ่มทำงานซ้ำไปซ้ำมา) นั่นคือเหตุผลที่เวิร์กโฟลว์ Django ด้านล่างสามารถเฝ้าดู `locale/**` ซึ่งคอมมิตของบอทจะเปลี่ยนแปลงทุกครั้งได้ หากคุณเปลี่ยนไป push ด้วย Personal Access Token หรือ GitHub App token แทน (เช่น เพื่อให้เวิร์กโฟลว์อื่นเริ่มทำงานเมื่อบอทคอมมิต) การ push นั้นจะสั่งให้เวิร์กโฟลว์นี้เริ่มทำงานใหม่อีกครั้ง ซึ่งเมื่อถึงจุดนั้น ตัวกรอง `paths:` จะเป็นตัวตัดสิน ตัวกรองด้านบนจะละเว้นไฟล์ที่แปลแล้วและไฟล์ lock บอทจึงไม่ทำให้เกิดการรันใหม่ ส่วน `locale/**` ในตัวกรองของ Django จะรวมเอาแคตตาล็อกที่บอทคอมมิตไปด้วย ดังนั้นแต่ละคอมมิตของบอทจะเริ่มการรันเพิ่มอีกหนึ่งครั้ง — ซึ่งจะไม่พบสิ่งใดให้แปลและไม่คอมมิตอะไรเพิ่ม หากใช้โทเคนดังกล่าว ให้จำกัดขอบเขตตัวกรองเฉพาะแคตตาล็อกต้นทาง (`locale/en/**`) และเพิ่มภาษาผ่านคอนฟิกแทน

**ต้องระบุคีย์ของผู้ให้บริการในการรันทุกครั้งที่เริ่มต้นขึ้น** แม้กระทั่งในตอนที่ไม่มีอะไรต้องแปลก็ตาม: sync จะตรวจสอบว่าวิธีดังกล่าวสามารถรันได้หรือไม่ก่อนที่จะตรวจสอบสิ่งที่เปลี่ยนแปลง การสั่งรันด้วยตนเองโดยไม่มีการเปลี่ยนแปลงที่ต้นทางจะยังคงล้มเหลวหากไม่มี secret `OPENROUTER_API_KEY` (หรือคีย์สำหรับวิธีที่คุณเลือก) สำหรับ `local` ไม่จำเป็นต้องใช้คีย์ แต่ runner จะไม่มีเซิร์ฟเวอร์โมเดล: โปรเจกต์ที่แปลด้วย `local` บนเครื่องของนักพัฒนา จึงต้องระบุวิธีแบบ hosted ใน CI (`--method` / `--model` — บรรทัด `SYNC_FLAGS` ที่คอมเมนต์ไว้ในเวิร์กโฟลว์ด้านบน) หากต้องการตรวจสอบว่า secret ส่งผ่านไปยังขั้นตอนดังกล่าวอย่างถูกต้องหรือไม่โดยไม่ต้องแปลสิ่งใด `sync --dry` จะแจ้งเตือนเมื่อการรันจริงจะต้องหยุดลงและระบุชื่อตัวแปรที่ขาดหายไป (โดยยังคงจบด้วยรหัส 0 — เนื่องจากการ dry run เป็นเพียงการแสดงตัวอย่าง) ทั้งนี้จะเป็นการตรวจว่าตัวแปรได้รับการ **ตั้งค่าไว้** หรือไม่ ไม่ได้ตรวจว่าคีย์ **ใช้งานได้จริง** หรือไม่: เนื่องจากไม่มีการส่งข้อมูลใดๆ ค่าใดก็ตามที่ไม่ว่างเปล่าจึงผ่านการตรวจสอบ — รวมถึงค่า placeholder ด้วย คีย์ที่ไม่ถูกต้องหรือถูกเพิกถอนจะแสดงข้อผิดพลาดเมื่อมีคำขอแรกในการรันจริง (ข้อผิดพลาดจะระบุการตอบกลับของผู้ให้บริการ เช่น HTTP 401) หากต้องการให้จ็อบล้มเหลวเมื่อคีย์หายไปก่อนที่สิ่งใดจะเริ่มรัน ให้เพิ่ม [การตรวจสอบก่อนการซิงค์](#check-before-sync)

**แคชจะถูกแยกเก็บตามแต่ละวิธี (method)** คำแปลจะถูกแคชไว้ภายใต้วิธี ระดับภาษา (register) และไฟล์ coaching ที่สร้างคำแปลนั้นขึ้นมา (โมเดลอื่นที่ใช้วิธีเดียวกันสามารถนำมาใช้ซ้ำได้ — model carry-over) ดังนั้นนักพัฒนาที่แปลด้วย `local` กับ CI ที่แปลด้วยโมเดลแบบ hosted จึงไม่มีวันแชร์รายการแคชร่วมกัน — และแคชของ CI ก็แยกเป็นของตัวเองอยู่แล้ว (ไม่ได้คอมมิต `.champollion/`) แต่นั่นไม่ได้หมายความว่า CI จะต้องแปลทั้งโปรเจกต์ใหม่ทั้งหมด: สิ่งที่อยู่ในไฟล์ภาษาอยู่แล้วและได้คอมมิตไฟล์ lock ไปแล้วจะถือว่าเสร็จสมบูรณ์ CI จะจ่ายให้กับโมเดลแบบ hosted เฉพาะสตริงที่เพิ่มขึ้นใหม่หรือเปลี่ยนแปลงนับตั้งแต่การคอมมิตครั้งล่าสุดเท่านั้น — รวมถึงสตริงที่นักพัฒนาแปลในเครื่องแต่ไม่ได้คอมมิตด้วย — และไม่ต้องจ่ายสำหรับส่วนที่เหลือ การแปลทั้งโปรเจกต์ใหม่ทั้งหมดด้วยโมเดลแบบ hosted (`--redo all`) จะคิดค่าใช้จ่ายสำหรับทุกสตริงหนึ่งครั้ง

**รันตามกำหนดเวลา (Schedule)** แทนที่จะรันเมื่อมี push: ให้แทนที่บล็อก `on:` ด้วย `schedule: [{ cron: '0 6 * * *' }]`

### การตรวจสอบก่อนการซิงค์: ทำให้จ็อบล้มเหลวตั้งแต่เนิ่นๆ {#check-before-sync}

การ dry run จะจบด้วยรหัส `0` ไม่ว่าจะพบอะไรก็ตาม — เนื่องจากเป็นการแสดงตัวอย่าง — ดังนั้น `sync --dry --max-cost 5` จะเตือนว่าการรันจริงจะหยุดลงที่วงเงินที่กำหนด แต่ก็ยังถือว่าผ่านขั้นตอน CI หากต้องการให้จ็อบล้มเหลวเมื่อการรันจริงต้องหยุดลง (คีย์หายไป หรือ `--max-cost`) ให้อ่านสรุปจาก `sync --dry --json` เอาต์พุตดังกล่าวจะเป็นออบเจกต์ JSON บรรทัดละหนึ่งตัว (NDJSON) โดยแต่ละตัวจะมี `level` — บรรทัด `info`, `ok` และ `event` จะอยู่บน stdout ส่วนบรรทัด `warn` และ `error` จะอยู่บน stderr — และบรรทัด stdout สุดท้ายคือสรุปผล `{"level": "summary", "command": "sync", …}`
เลือกอ่านตาม level ของมัน **รันคำสั่งด้วยแฟล็กเดียวกันกับการซิงค์**: หากไม่มีแฟล็กเหล่านั้น คำสั่งจะตรวจสอบวิธีที่คอนฟิกระบุไว้ ดังนั้นสำหรับโปรเจกต์ที่คอนฟิกระบุเป็น `local` คำสั่งจะไปตรวจสอบวิธีในเครื่อง — ไม่ใช่โมเดลแบบ hosted ที่จ็อบกำลังรัน — และทำให้ผ่านการตรวจสอบบน runner ที่ไม่มีคีย์ได้ หากใส่เป็นขั้นตอนในเวิร์กโฟลว์ด้านบน ก่อนหน้า "Sync translations" จะอ่าน `SYNC_FLAGS` เดียวกัน:

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

หรือในเชลล์ โดยเขียนแฟล็กออกมาชัดเจน — ซึ่งเป็นแฟล็กเดียวกับบรรทัดที่ใช้ sync:

```bash
SYNC_FLAGS="--method llm --model google/gemini-3.8-flash --max-cost 5"
out=$(npx --yes champollion@0.5 sync --dry $SYNC_FLAGS --json)
printf '%s\n' "$out" | jq -e 'select(.level == "summary") | .preflight.ready and (.maxCost.wouldStop | not)' > /dev/null \
  || printf '%s\n' "$out" | jq -r 'select(.level == "summary") | .error // "A real sync would exit \(.realRun.exitCode): \(.realRun.reasons | join("; "))"'
```

`preflight.ready` จะมีค่าเป็น `false` เมื่อคีย์ที่วิธีดังกล่าวจำเป็นต้องใช้ขาดหายไป (ไม่ได้ตั้งค่าไว้หรือว่างเปล่า — ไม่ใช่กรณีที่คีย์ไม่ถูกต้อง) ไม่ว่าจะมีสิ่งใดต้องแปลหรือไม่ก็ตาม: วิธีแบบ hosted จะไม่พร้อมทำงานหากไม่มีคีย์ ส่วน `maxCost.wouldStop` (ปรากฏร่วมกับ `--max-cost`) จะเป็น `true` เมื่อการรันจริงจะหยุดลงที่วงเงินที่กำหนด `jq -e` จะจบด้วยรหัส 1 ในทั้งสองกรณี และขั้นตอนนี้จะพิมพ์เหตุผลลงในบันทึกของจ็อบ — ตัวอย่างเช่น
`A real sync would exit 1: it would stop before translating: No OpenRouter API
key (OPENROUTER_API_KEY) for en:fr`, or `A real sync would exit 2: --max-cost
would stop it before any API call (Estimated translation cost exceeds the
--max-cost cap: estimate ~$7.1200, cap $5.0000)` เมื่อ sync ไม่สามารถรันได้เลย (คอนฟิกเสียหาย) ขั้นตอนนี้จะพิมพ์ `error` ของสรุปผลแทน ขั้นตอนนี้ไม่ได้ส่ง stderr ไปยัง `/dev/null` ดังนั้นคำเตือนจึงยังคงแสดงอยู่ในบันทึกเช่นกัน `realRun.exitCode` ของสรุปผลจะบอกว่าการรันจริงจะจบด้วยรหัสใด เท่าที่การแสดงตัวอย่างจะบอกได้: `1` เมื่อ preflight สั่งหยุด, `2` เมื่อ `--max-cost` สั่งหยุด หรือเมื่อผลลัพธ์จะเสร็จสิ้นเพียงบางส่วน — คีย์ถูกระงับไว้ หรือข้อความพหูพจน์บนดิสก์ไม่มีรูปแบบที่ภาษานั้นใช้ (`realRun.reasons` จะระบุว่าคืออะไร) ทั้งนี้ การปฏิเสธโดย quality gate ซึ่งจะพบเฉพาะในการรันจริงเท่านั้น ยังคงสามารถเปลี่ยนรหัสจาก `0` ให้กลายเป็น `2` ได้ หากต้องการให้การตรวจสอบล้มเหลวเมื่อคาดการณ์ว่าการรันจะเสร็จสิ้นเพียงบางส่วนด้วย ให้ใส่ `.realRun.exitCode == 0` แทนที่ `.preflight.ready and (.maxCost.wouldStop | not)`

### กรณีที่ main branch มีการป้องกัน: เสนอการเปลี่ยนแปลงผ่าน Pull Request

เวิร์กโฟลว์ด้านบนจะ push คำแปลตรงไปยัง `main` หาก `main` มีการป้องกันไว้ (ต้องมีการรีวิวก่อนหรือต้องผ่าน status checks) การ push นั้นจะถูกปฏิเสธ — ซึ่งเกิดขึ้นหลังจากที่ sync ทำงานไปแล้ว คำแปลจึงถูกจ่ายเงินไปแล้ว แต่คำแปลเหล่านั้นจะไม่ต้องจ่ายเงินซ้ำอีก: แคชจะถูกบันทึกไว้ก่อนขั้นตอนการคอมมิต แม้ว่าจะมีขั้นตอนใดล้มเหลวก็ตาม ดังนั้นการรันจ็อบใหม่อีกครั้งหรือการ push ครั้งถัดไป (แต่ละครั้งจะกู้คืนแคชใหม่สุดของบรันช์ผ่าน `restore-keys`) จะดึงคำแปลเหล่านี้มาจากแคช ไฟล์ lock ยังไม่เคยไปถึง `main` ดังนั้นการรันครั้งถัดไปจะพบว่าสตริงเดิมมีการเปลี่ยนแปลงและเขียนไฟล์เหล่านั้นใหม่อีกครั้ง — โดยดึงมาจากแคชโดยไม่มีค่าใช้จ่าย

ในกรณีที่ `main` มีการป้องกัน ให้เปลี่ยนไปคอมมิตไปยังบรันช์ที่เป็นของบอทและเปิด (หรืออัปเดต) pull request แทน โดยใช้เวิร์กโฟลว์เดิมด้านบนและปรับเปลี่ยนสองจุด: สิทธิ์ (permissions) และขั้นตอนการคอมมิต

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

**ควรเลือกใช้แบบไหนเมื่อใด** ให้ push ไปยัง `main` เมื่อเวิร์กโฟลว์ได้รับอนุญาตให้ push ไปได้: เช่น ไม่มีการป้องกันบรันช์ หรือมีกฎที่อนุญาตให้ GitHub Actions ข้ามการป้องกันได้ ให้เปิด pull request เมื่อ `main` มีการป้องกันไว้ หรือเมื่อต้องการให้มนุษย์ — ซึ่งเป็นผู้พูดภาษานั้น — ตรวจทานคำแปลก่อนที่จะนำขึ้นใช้งานจริง

- บรันช์ดังกล่าวเป็นของบอท จนกว่า pull request จะถูกผสานรวม (merge) ไฟล์ lock ของ `main` จะยังไม่มีคำแปลเหล่านั้น ดังนั้นการรันทุกครั้งจะเสนอการเปลี่ยนแปลงทั้งหมดซ้ำอีกครั้ง — โดยดึงมาจากแคช จึงมีเพียงสตริงที่เปลี่ยนแปลงหลังจากนั้นเท่านั้นที่จะถูกคิดค่าใช้จ่าย การแก้ไขที่ push ไปยังบรันช์นั้นจะถูกแทนที่ในการรันครั้งถัดไป: ให้รีวิวใน pull request ทำการ merge แล้วจึงแก้ไขบน `main` (การสั่งทำซ้ำเป็นชุดใหญ่ในภายหลังจะยังคงรักษาการแก้ไขของมนุษย์ไว้)
- ที่เก็บข้อมูล (repository) ต้องอนุญาตให้ Actions เปิด pull request ได้: Settings → Actions → General → "Allow GitHub Actions to create and approve pull requests"
- Pull request ที่เปิดด้วย `GITHUB_TOKEN` ของเวิร์กโฟลว์จะไม่ทริกเกอร์เวิร์กโฟลว์อื่น ดังนั้น status checks ที่จำเป็นจะไม่ทำงานกับ PR นั้น หาก `main` กำหนดให้ต้องผ่านการตรวจสอบเหล่านี้ ให้เปิด PR ด้วย GitHub App token หรือ fine-grained token ที่เก็บไว้เป็น secret (`GH_TOKEN: ${{ secrets.<name> }}`) หรือใช้ action เช่น `peter-evans/create-pull-request` ซึ่งจะช่วยคอมมิต อัปเดตบรันช์ และแก้ไข pull request ที่เปิดอยู่ให้คุณโดยอัตโนมัติ (ส่งโทเคนให้ด้วยวิธีเดียวกัน)

### gettext (Django, Babel) และ Flutter

Sync จะแปลแคตตาล็อกที่มีอยู่แล้วเท่านั้น โดยไม่ได้ดึงสตริงออกจากโค้ดของคุณ โปรเจกต์ Django จึงควรอัปเดตแคตตาล็อกใหม่ก่อนขั้นตอนการซิงค์ ตรวจสอบว่าคอมไพล์ผ่านหลังจากการซิงค์ และคอมมิตเฉพาะไฟล์แคตตาล็อกเท่านั้น

`makemessages` และ `compilemessages` ต่างก็นำเข้า (import) settings ของคุณ ดังนั้นจ็อบจึงต้องกำหนดค่าที่จำเป็นสำหรับคำสั่งเหล่านี้ไว้เพียงครั้งเดียวสำหรับทุกขั้นตอน: ตัวแปรใดก็ตามที่โมดูล settings ของคุณอ่านขณะนำเข้า (`SECRET_KEY`, `DATABASE_URL`, …) ทั้งสองคำสั่งไม่ได้แตะต้องฐานข้อมูล ดังนั้นการกำหนดค่า placeholder ก็เพียงพอแล้ว ส่วน `DJANGO_SETTINGS_MODULE` ถูกคอมเมนต์ปิดไว้: เพราะ `manage.py` ที่ `startproject` เขียนขึ้นได้ตั้งค่านี้ไว้เองแล้ว และค่าที่ตั้งไว้ในจ็อบจะไปเขียนทับค่านั้น — หากระบุชื่อโมดูลผิดจะทำให้ `makemessages` ใช้งานไม่ได้ ให้ตั้งค่านี้ก็ต่อเมื่อ `manage.py` ของคุณไม่ได้ตั้งค่าไว้เท่านั้น

ตัวกรอง `paths:` ของกรณีนี้จะแตกต่างจากเวิร์กโฟลว์ด้านบน: สตริงต้นทางจะอยู่ในโค้ด Python และเทมเพลตของคุณ โดยมี `makemessages` เป็นผู้ดึงสตริงเหล่านั้นออกมาในจ็อบ ดังนั้นการเปลี่ยนโค้ดจึงอาจนำมาซึ่งสตริงใหม่ได้ ให้จำกัดแพตเทิร์นให้แคบลงเฉพาะแอปของคุณ (`myapp/**.py`) หากการ push ทุกครั้งมีการแตะต้องโค้ด Python และตัวกรองยังเฝ้าดู `locale/**` ด้วยเช่นกัน: เนื่องจากภาษาใหม่จะเข้ามาในรูปของโฟลเดอร์แคตตาล็อกใหม่ (`makemessages -l <code>`) คอมมิตของตัวบอทเองจะเปลี่ยนแคตตาล็อกเหล่านี้แต่จะไม่ทำให้เกิดการรันใหม่ เพราะถูก push ด้วย `GITHUB_TOKEN` (ดูหัวข้อ **คอมมิตของตัวจ็อบเองจะไม่มีวันสั่งให้จ็อบเริ่มทำงานใหม่อีกครั้ง** ด้านบน — และสิ่งที่ต้องจำกัดขอบเขตให้แคบลงเมื่อคุณ push ด้วยโทเคนอื่น)

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

`--all` จะอัปเดตทุกแคตตาล็อกที่มีอยู่แล้ว; หากต้องการเพิ่มภาษา ให้ใช้ `makemessages -l <code>` หนึ่งครั้ง (หรือ `champollion init --langs <code>`)
`makemessages` จะรันหนึ่งครั้งต่อหนึ่งโดเมน: `django` สำหรับ Python และเทมเพลต, `djangojs` (`-d djangojs`) สำหรับ JavaScript โดย sync จะแปลแคตตาล็อกของทุกโดเมนที่พบ ขั้นตอนสุดท้ายจะรัน `verify --strict` หากรายการพหูพจน์ภาษารัสเซียมีคำแปลที่ขาดรูป `few` หรือ `many` ระบบจะเขียนด้วยรูป `other` และทำเครื่องหมายเป็น `# champollion:` การ sync แต่ละครั้งจะจบด้วยรหัส `2` ตราบใดที่ยังมีรายการดังกล่าวอยู่ในแคตตาล็อก — ทั้งรอบที่เขียนไฟล์นั้นลงไปและทุกรอบหลังจากนั้น เช่นเดียวกับกรณีของคีย์ที่ถูกระงับไว้ — และสรุปผลจะระบุชื่อรายการพร้อมคำสั่งสำหรับขอคำแปลใหม่อีกครั้ง; จากนั้นบรรทัดการตรวจสอบหลังการซิงค์จะระบุว่าการรันยังไม่สมบูรณ์แทนที่จะเป็น `[OK]` ดังนั้นขั้นตอน "Stop when the sync was partial" จะทำให้จ็อบล้มเหลวหลังจากการคอมมิตจนกว่าจะมีการเขียนรูปพหูพจน์เหล่านั้น หากรันแบบเดี่ยวๆ จะถือเป็นคำเตือน: คำสั่ง `verify` ปกติจะจบด้วย 0 ในขณะที่ `--strict` จะล้มเหลว ส่วน `audit` จะนับรายการเดียวกันนี้ว่ายังไม่สมบูรณ์ (incomplete)

`compilemessages` จะรัน `msgfmt --check-format` ซึ่งจะตรวจสอบด้วยว่า `%(name)s` แต่ละตัวยังคงชนิดเดิมไว้หรือไม่ — แต่จะตรวจเฉพาะรายการที่มีแฟล็ก `#, python-format` เท่านั้น โดย `makemessages` จะเพิ่มแฟล็กนี้ให้กับรายการที่ดึงออกมาซึ่งมีตัวแทนที่ (placeholder) แบบ `%` ส่วนแคตตาล็อกที่สร้างขึ้นด้วยตนเองอาจไม่มีแฟล็กนี้ และรายการเหล่านั้นจะไม่ถูกตรวจสอบ แต่ `champollion
verify` จะเปรียบเทียบตัวแทนที่ printf (ชื่อและตัวอักษรระบุชนิด) ของทุกรายการ ไม่ว่าจะมีแฟล็กใดก็ตาม และ sync จะรักษาแฟล็กของรายการต้นทางไว้ในทุกรายการที่แปล ขั้นตอนการคอมมิตจะสเตจ `*.po` และ `.champollion.lock` ตามชื่อ (และบันทึก replaced-edits หากมี); หากโปรเจกต์ของคุณมีการติดตามไฟล์ `.mo` ด้วย ให้เพิ่ม `'*.mo'` เข้าไปด้วย สำหรับขั้นตอนของแคช, รหัส exit code ที่บันทึกไว้ และ `git pull --rebase` มีไว้ด้วยเหตุผลเดียวกันกับในเวิร์กโฟลว์ด้านบน สำหรับ Babel: ใช้ `pybabel extract` + `pybabel update --no-wrap` ก่อนการซิงค์ และ `pybabel compile` หลังการซิงค์

Flutter ไม่จำเป็นต้องมีขั้นตอนเพิ่มเติมในจ็อบนี้: sync จะเขียนไฟล์ `app_<locale>.arb` และ `flutter gen-l10n` (หรือ `flutter build` ซึ่งเป็นคำสั่งที่เรียกใช้งาน) จะเป็นขั้นตอนการบิลด์ของแอปคุณเอง ซึ่งจะแปลงไฟล์เหล่านั้นเป็นโค้ด Dart

#### รูปพหูพจน์ที่โมเดลละเว้นไป {#plural-gaps}

รายการที่ถูกทำเครื่องหมายไว้ไม่ใช่คำแปล ดังนั้น sync จึงไม่ปล่อยให้เป็นภาระของมนุษย์จัดการเพียงลำพัง:

- **วิธีหรือโมเดลอื่นจะขอคำแปลใหม่อีกครั้งโดยอัตโนมัติ** การซิงค์ที่มีการตั้งค่า (วิธี, โมเดล, register, coaching) ที่ยังไม่เคยตอบรายการนั้น จะส่งรายการดังกล่าวไปยังโมเดลอีกครั้ง — โดยไม่ดึงจากแคชซึ่งเก็บคำตอบที่ไม่สมบูรณ์เอาไว้ ดังนั้นเมื่อโมเดลในเครื่องของนักพัฒนาละเว้นรูปพหูพจน์ไป โมเดลแบบ hosted ของจ็อบ (`SYNC_FLAGS`) จะขอรูปเหล่านั้นในการรันครั้งถัดไป และการประเมินค่าใช้จ่ายจะรวมราคานี้ไว้ด้วย ไฟล์ lock (`.champollion.lock` ภายใต้ `gaps`) จะบันทึกการตั้งค่าแต่ละแบบที่ตอบกลับมาโดยไม่มีรูปพหูพจน์ เพื่อไม่ให้การรันในเครื่องและการรันบน CI สลับกันจ่ายเงินซ้ำซ้อนสำหรับคำตอบที่ไม่สมบูรณ์เดิม
- **`sync --redo gaps` จะขอคำแปลใหม่สำหรับทุกรายการดังกล่าว** ไม่ว่าใครจะเป็นผู้ละเว้นไว้ก็ตาม — ในเวิร์กโฟลว์ด้านบน ให้ทำเครื่องหมายที่ `redo_gaps` ใต้ **Run workflow** หรือเพิ่ม `--model` ไปยัง `SYNC_FLAGS` เพื่อใช้โมเดลที่มีความสามารถสูงกว่า
- **หากคำตอบใหม่ยังคงขาดรูปพหูพจน์ รายการนั้นจะยังคงถูกทำเครื่องหมายไว้** และการรันจะจบด้วยรหัส `2` เช่นเดิม จากนั้นให้เขียนรูปพหูพจน์ด้วยตนเองแล้วลบบรรทัด `# champollion:` ออก

การ dry run (`sync --dry`) จะระบุชื่อรายการที่จะขอคำแปลใหม่อีกครั้งพร้อมประเมินราคา ส่วนสรุปผล `--json` จะนับจำนวนรายการที่จะไม่ขอใหม่ (`totalPluralGaps`) และแจ้งว่าการรันจริงจะจบด้วยรหัส `2` เนื่องจากรายการเหล่านั้น (`realRun.exitCode`)

## วิธีอื่นๆ

โค้ดตัวอย่างด้านล่างแสดงคีย์ที่แต่ละวิธีจำเป็นต้องใช้และคำสั่ง `sync` นำไปใช้ **ภายใน** ขั้นตอน "Sync translations" ของเวิร์กโฟลว์ด้านบน: เปลี่ยน `env` ของมัน, ใส่แฟล็กที่แสดงไว้ (`--method openai`, …) ในบรรทัด `SYNC_FLAGS` ของเวิร์กโฟลว์ — เพื่อให้การตรวจสอบแบบ dry-run ใช้วิธีเดียวกัน — และคงส่วนที่เหลือของขั้นตอนไว้ (`id: sync` และบรรทัดที่บันทึก exit code) เพื่อให้การรันที่สำเร็จเพียงบางส่วนยังคงคอมมิตสิ่งที่แปลไปแล้วและบันทึกแคชไว้ได้

## วิธี Google Translate

หากใช้วิธี Google Translate ที่มีอยู่ในตัวแทน OpenRouter:

```yaml
- name: Sync translations
  env:
    GOOGLE_TRANSLATE_API_KEY: ${{ secrets.GOOGLE_TRANSLATE_API_KEY }}
  run: npx --yes champollion@0.5 sync
```

## ผู้ให้บริการ LLM โดยตรง

หากใช้วิธี `openai`, `anthropic` หรือ `gemini` โดยตรง:

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

## Remote Translation API

หากใช้ endpoint การแปลระยะไกล (เช่น บริการแปลที่โฮสต์ไว้):

```yaml
- name: Sync translations
  env:
    CHAMPOLLION_API_KEY: ${{ secrets.CHAMPOLLION_API_KEY }}
  run: npx --yes champollion@0.5 sync
```

## ด่านตรวจก่อนที่คุณจะ Deploy

หากต้องการให้บิลด์ล้มเหลวเมื่อมีภาษาใดไม่สมบูรณ์หรือเสียหาย โดยไม่ต้องแปลสิ่งใด ให้รันการตรวจสอบเหล่านี้แยกต่างหาก

:::warning[ให้รันด่านตรวจหลังจากการซิงค์ ไม่ใช่ก่อนหน้า]
หากการแปลทำงานเฉพาะหลังจากผสานรวม (merge) เท่านั้น (เวิร์กโฟลว์ด้านบน) pull request ที่เพิ่มสตริงจะยังไม่มีคำแปลสำหรับสตริงนั้น และ `audit`/`verify` จะทำให้ PR ดังกล่าวล้มเหลวทุกครั้ง ดังนั้นให้รันด่านตรวจในจุดที่มีคำแปลอยู่แล้ว: บน `main` หลังจ็อบ sync (`needs: sync` หรือ `on: workflow_run` ของเวิร์กโฟลว์ sync) ส่วนทริกเกอร์ `push` จะไม่ทำงานกับคอมมิตของตัวบอท sync เอง — เนื่องจากคอมมิตถูก push ด้วย `GITHUB_TOKEN` ซึ่งไม่เริ่มทำงานเวิร์กโฟลว์ใดๆ (ดูด้านบน) สำหรับ pull requests ให้รันเฉพาะ `lint` เท่านั้น หรือรันจ็อบ sync บนบรันช์ของ PR ก่อน
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

| การตรวจสอบ | คำสั่ง | ล้มเหลวเมื่อ |
|---|---|---|
| **Lint** | `lint` | ซอร์สโค้ดมีสตริงที่ไม่ได้อยู่ในไฟล์ภาษา — หรือไม่พบไฟล์ต้นทางที่จะตรวจสอบ (ระบบจะระบุโฟลเดอร์ที่เข้าไปค้นหา; ชี้ไปยังโฟลเดอร์อื่นได้ด้วย `--src <dir>`) |
| **Audit** | `audit` | คีย์ขาดหายไป ว่างเปล่า หรือยังคงเป็นค่าสำรอง (fallback) ของ `[EN]` — หรือคำแปล**ล้าสมัย**: แปลมาจากข้อความต้นทางที่เก่ากว่าข้อความปัจจุบัน (การแก้ไขต้นทางที่แปลใหม่อีกครั้งไม่สำเร็จ) — หรือข้อความพหูพจน์ขาดรูปที่ภาษานั้นใช้สำหรับการนับในชีวิตประจำวัน (ภาษารัสเซีย `few`/`many`; รายการที่ `verify --strict` ล้มเหลว) พร้อมระบุคำสั่งสำหรับขอคำแปลใหม่อีกครั้ง |
| **Verify** | `verify` | คำแปลทำให้ตัวแทนที่ (placeholder), พหูพจน์แบบ ICU, มาร์กอัป (แท็กถูกเปิด ปิด หรือซ้อนกันต่างไปจากเดิม) หรือสคริปต์เสียหาย — หรือคีย์ขาดหายไป — หรือมีข้อความเดียวใช้แทนสตริงต้นทางหลายสตริงที่แตกต่างกัน (โมเดลพูดซ้ำประโยคที่จำมา) — หรือไม่พบสิ่งใดให้ตรวจสอบ (ไฟล์ต้นทางหรือโฟลเดอร์ภาษารองรับไม่ได้อยู่ในตำแหน่งที่คอนฟิกระบุไว้) |
| **Verify แบบเข้มงวด (strict)** | `verify --strict` | มีข้อใดข้อหนึ่งข้างต้น หรือมีคำเตือนใดๆ |

`verify` จะจบด้วยรหัส `1` เมื่อมีข้อผิดพลาดใดๆ และจบด้วย `0` ในกรณีอื่นๆ คำเตือนจะถูกพิมพ์ออกมาแต่ไม่ทำให้จ็อบล้มเหลว: เช่น การสะท้อนข้อความต้นทาง (source echo), ไฟล์สองภาษามีข้อความเหมือนกันทุกประการ, คำแปลที่ล้าสมัย, คำแปลที่ทำ `?` หรือ `!` ปิดท้ายของต้นทางหายไป (บางภาษาใช้คำลงท้ายแสดงคำถามแทน) และคำเตือนเรื่องรูปพหูพจน์ด้านล่าง ส่วนการใช้ข้อความเดียวสำหรับสตริงต้นทางที่แตกต่างกันหลายสตริงถือเป็นข้อผิดพลาด: ได้แก่ สตริงแบบหลายคำสองสตริงที่แตกต่างกันอย่างชัดเจนแต่ถูกตอบกลับด้วยข้อความเดียวกันตั้งแต่สี่คำขึ้นไป หรือตั้งแต่สามคำขึ้นไปในกรณีอื่นๆ โดยจะนับรวมทั้งค่าของคีย์ แต่ละกิ่งของรูปพหูพจน์ และหน้า Markdown ของภาษานั้นๆ ตามกฎที่ gate ของ `sync` ใช้ปฏิเสธ `verify --strict` จะเปลี่ยนทุกคำเตือนให้เป็นข้อผิดพลาดที่ทำให้งานล้มเหลว ใช้ตัวเลือกนี้เมื่อต้องการให้กรณีเช่น รูปพหูพจน์ภาษารัสเซียที่โมเดลละเว้นไป บล็อกการ deploy สำหรับคำแปลที่ล้าสมัยจะถือเป็นคำเตือนใน `verify` (โครงสร้างยังสมบูรณ์ดี) และถือเป็นข้อผิดพลาดใน `audit` (gate ตรวจสอบความครบถ้วนสมบูรณ์) ซึ่งจะพิมพ์คำสั่งสำหรับแปลใหม่ออกมาให้ด้วย

ผลการตรวจสอบรูปพหูพจน์จะขึ้นอยู่กับว่ารูปแบบไฟล์จัดเก็บรูปพหูพจน์อย่างไร:

| รูปแบบ | ข้อผิดพลาด (`verify` จบด้วย 1) | คำเตือน (ล้มเหลวเฉพาะเมื่อใช้ `--strict`) |
|---|---|---|
| คีย์แบบมี suffix ของ i18next (`count_one`, `count_other`, …) | รูปที่ภาษานั้นต้องใช้ขาดหายไป (ภาษาฝรั่งเศส `count_many`): ถือเป็นคีย์ที่ขาดหายไป | คีย์สำหรับรูปที่ภาษานั้นไม่มี (ภาษาฝรั่งเศสหรือสเปน `count_two`) โดย `verify` จะพิมพ์คำสั่งสำหรับลบคีย์เหล่านั้นโดยเฉพาะ คือ `sync --prune plural-extras`; sync จะไม่มีวันลบคีย์เหล่านั้นหากไม่มีคำสั่งนี้ |
| ข้อความแบบ ICU (`{count, plural, …}` ใน next-intl, ARB, i18next ICU) | โครงสร้างรูปพหูพจน์เสียหาย (ตัวแปร คีย์เวิร์ด หรือ selector ถูกแปล, `#` หายไป) | กิ่งที่ภาษานั้นใช้สำหรับการนับในชีวิตประจำวันขาดหายไป (ภาษารัสเซีย `few`, `many`) รูปที่ขาดหายไปซึ่งใช้เฉพาะสำหรับตัวเลขจำนวนมาก (ภาษาฝรั่งเศส `many` สำหรับ 1,000,000) จะไม่ถูกรายงาน |
| gettext (`msgid_plural`) | รายการที่ไม่มีคำแปล (ว่างเปล่าหรือ `fuzzy`): ถือเป็นคีย์ที่ขาดหายไป | รูป `msgstr[]` ที่ซ้ำกับรูป `other` ในภาษาที่มีรูปของตัวเองสำหรับการนับในชีวิตประจำวัน (ทำเครื่องหมายด้วยความคิดเห็น `# champollion:`) หรือมีบรรทัด `msgstr[]` มากกว่า `nplurals` ของแคตตาล็อก ทั้งนี้จำนวนรูปพหูพจน์จะนับตามส่วนหัว `Plural-Forms` ของตัวแคตตาล็อกเอง |

รูปพหูพจน์ของ i18next ที่แปลมาจากข้อความของอีกรูปหนึ่งสามารถมีข้อความเหมือนกับรูปนั้นได้พอดี (ภาษาฝรั่งเศส `count_many` เหมือนกับ `count_other`) ภาษาฝรั่งเศสอาจเขียนทั้งสองรูปเหมือนกัน ดังนั้นกรณีนี้จึงไม่ถือเป็นคำเตือน เมื่อ sync ขอรูปพหูพจน์จากโมเดล ระบบจะบันทึกสิ่งนั้นไว้ใน `.champollion.lock` พร้อมกับ fingerprint ของคำตอบ `verify` จะอ่านเฉพาะบันทึกดังกล่าวเท่านั้น ดังนั้นทุกการ clone ของคอมมิตจะได้ผลลัพธ์แบบเดียวกันเสมอ แคชบนแล็ปท็อปของคุณกับ CI runner ตัวใหม่จะไม่มีทางขัดแย้งกัน ค่าที่ไม่มีบันทึก (เขียนด้วยตนเอง, แปลโดยเครื่องมืออื่น, เครื่องมือแปลภาษาอัตโนมัติที่ไม่สามารถระบุรูปพหูพจน์ได้ หรือเวอร์ชันเก่า) จะแสดงเป็นบรรทัด info พร้อมคำสั่งสำหรับขอคำแปลใหม่อีกครั้ง โดย `--strict` จะไม่ล้มเหลวเพราะกรณีนี้
Verify จะตรวจสอบโครงสร้าง ไม่ได้ตรวจสอบความหมาย: การผ่านการตรวจสอบหมายความว่าคีย์, ตัวแทนที่ (placeholder), รูปพหูพจน์, มาร์กอัป และสคริปต์ยังคงสมบูรณ์ ไม่ได้แปลว่าข้อความนั้นถูกต้องตามความหมายที่แท้จริง

---

## ดูเพิ่มเติม

- [CLI Reference](/docs/reference/cli) — เอกสารอ้างอิงคำสั่งทั้งหมด
- [How Sync Works](/docs/concepts/how-sync-works) — ทำความเข้าใจการซิงค์แบบ incremental
- [Translation Memory](/docs/concepts/translation-memory) — การแคชและการประหยัดต้นทุน
- [Translation Methods](/docs/guides/translation-methods) — การเลือกวิธีการแปลสำหรับแต่ละคู่ภาษา
- [Quality Gate](/docs/concepts/quality-gate) — สิ่งที่เกิดขึ้นเมื่อการแปลล้มเหลว
- [Configuration](/docs/getting-started/configuration) — เอกสารอ้างอิงการตั้งค่า
