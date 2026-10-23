---
sidebar_position: 3
title: "CI/CD"
---

# การทำงานร่วมกับ CI/CD

ทำการแปลโดยอัตโนมัติในไปป์ไลน์การบิลด์ของคุณ

champollion CLI เผยแพร่ซอร์สโค้ด (source-available) ภายใต้ [PolyForm Noncommercial License 1.0.0](https://github.com/gamedaysuits/Champollion/blob/main/cli/LICENSE): ใช้งาน ดัดแปลง และแชร์ได้ฟรีสำหรับวัตถุประสงค์ที่ไม่ใช่เชิงพาณิชย์ การนำไปใช้ในเชิงพาณิชย์ไม่ครอบคลุมในสิทธิ์การใช้งานนี้ ([ใครบ้างที่สามารถใช้งานได้](/docs/getting-started/who-may-use-this))

## GitHub Actions: อัปเดตงานแปลให้ตรงกันอยู่เสมอ

เวิร์กโฟลว์ที่สมบูรณ์: แปลส่วนที่มีการเปลี่ยนแปลง ตรวจสอบผลลัพธ์ และคอมมิตกลับเข้าไป สามารถใช้ได้กับทุกโปรเจกต์ — ไม่ว่าจะใช้ Node หรือไม่ก็ตาม (Django, Flutter, Hugo)

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

**เหตุผลที่เวิร์กโฟลว์ถูกออกแบบมาเช่นนี้** `actions/cache` เพียงอย่างเดียวจะบันทึกแคชเมื่อทั้งจ็อบทำงานสำเร็จเท่านั้น และ `sync` จะส่งออกสถานะ `2` เมื่อใดก็ตามที่มีคีย์ใดถูกปฏิเสธ — ดังนั้นการรันที่เสร็จสิ้นเพียงบางส่วนจึงมักข้ามทั้งการคอมมิตและการบันทึกแคช และการรันครั้งถัดไปก็ต้องจ่ายค่าแปลสำหรับข้อความเดิมซ้ำอีก ในที่นี้แคชจะถูกกู้คืนและบันทึกแยกเป็นสองขั้นตอน (`actions/cache/restore` จากนั้นตามด้วย `actions/cache/save` พร้อม `if: always()`) ส่วนขั้นตอนการซิงค์จะบันทึกรหัสออกจากโปรแกรม (exit code) แทนที่จะล้มเหลวใน `2` ไฟล์ที่แปลแล้วจะถูกคอมมิต และหลังจากนั้นจ็อบจึงจะล้มเหลว — ในขั้นตอนของมันเอง ก่อนที่จะถึง `verify` เพื่อให้ขั้นตอนที่ล้มเหลวระบุสาเหตุอย่างชัดเจน (การหยุดทำงานเนื่องจาก `--max-cost` หรือมีคีย์ที่การซิงค์ไม่สามารถแปลได้) แทนที่จะเป็น `verify` ที่ระบุชื่อคีย์ที่ขาดหายไป ขั้นตอนสุดท้ายคือ `verify --strict`: โดยปกติแล้ว `verify` จะส่งออกสถานะ 0 เมื่อพบคำเตือน (รวมถึงกรณีมีรูปพหูพจน์เกินมาหรือขาดหายไป) และ `--strict` จะทำให้จ็อบล้มเหลวเมื่อพบคำเตือนเหล่านั้น คีย์ที่ quality gate ปฏิเสธจะถูกจดจำไว้: การรันครั้งต่อไปจะไม่ส่งคีย์เดิมไปยังโมเดลเดิมอีก (เพราะจะทำให้เสียค่าใช้จ่ายกับคำตอบเดิม) — บันทึกการซิงค์จะระบุชื่อคีย์ดังกล่าวพร้อมคำสั่ง `--redo keys:` เพื่อขอให้ลองใหม่อีกครั้ง

**เก็บแคชหนึ่งชุดต่อการเปลี่ยนแปลง ไม่ใช่ต่อการรัน** ขั้นตอนการกู้คืนจะดึงแคชล่าสุดของบรันช์กลับมา (คีย์ที่ตรงกันทุกตัวอักษรของมัน `…-newest` จะไม่มีวันถูกบันทึก ดังนั้น `restore-keys` จึงจะเลือกแคชที่ล่าสุดที่สุดเสมอ) ขั้นตอนการบันทึกจะกำหนดคีย์ของแคชจากค่าแฮชของไฟล์ในตัวมันเอง (`hashFiles('.champollion/**')`): การรันที่มีการแปลบางอย่าง — แม้ว่าจะเป็นการรันที่ทำได้เพียงบางส่วน หรือการรันที่ push ไม่สำเร็จ — จะทำให้แคชเปลี่ยนไป จึงได้รับคีย์ใหม่และถูกบันทึกไว้ ส่วนการรันที่ไม่ได้เพิ่มอะไรใหม่เลย (ไม่มีอะไรต้องแปล ทุกอย่างนำมาจากแคช หรือการหยุดเนื่องจาก `--max-cost`) จะมีคีย์เดียวกับที่กู้คืนมา ขั้นตอนการบันทึกจึงถูกข้ามไปและไม่มีสำเนาใหม่ถูกจัดเก็บ การใช้ run id เป็นคีย์จะทำให้ต้องบันทึกสำเนาเต็มใหม่ทุกรอบการรัน ส่วนการใช้ lock file และไฟล์ต้นฉบับเป็นคีย์จะทำให้ระบบกู้คืนสำเนาเก่ากลับมาเนื่องจากค่าตรงกันพอดีหลังจากรอบการรันที่ push ถูกปฏิเสธ เพราะไฟล์ล็อกที่คอมมิตไม่เคยได้รับการเปลี่ยนแปลงของการรันรอบนั้น

ในโปรเจกต์ Node คุณสามารถเพิ่ม `champollion` เป็น dev dependency แล้วเรียกใช้ `npx champollion sync` แทนได้ แต่การตรึงเวอร์ชันด้วย `champollion@0.6` ตามด้านบนจะทำงานได้กับทุกที่เก็บข้อมูล (repository) และจะไม่เปลี่ยนเวอร์ชันไปเป็นเวอร์ชันอื่นโดยไม่คาดคิด จากนั้นจ็อบจะต้องติดตั้งมัน: บนรันเนอร์ที่เพิ่งเริ่มใหม่ `npx champollion` ที่ไม่มีอะไรติดตั้งไว้ก่อนหน้าจะดึงเวอร์ชันล่าสุดมา ไม่ใช่เวอร์ชันที่ไฟล์ล็อกของคุณตรึงไว้ และการติดตั้งจะเขียน `node_modules/` ซึ่ง `git add --all` จะคอมมิตไฟล์นี้ไปด้วย เว้นแต่ว่า `.gitignore` ของคุณจะระบุละเว้นไว้ (ไฟล์ที่ `champollion init` สร้างขึ้นจะระบุไว้เพียง `.champollion/`) ดังนั้นโปรดสเตจไฟล์โลแคลและไฟล์ล็อกโดยระบุชื่อไฟล์โดยตรง เช่นเดียวกับที่เวิร์กโฟลว์ Django ด้านล่างทำ:

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

**คอมมิตไฟล์ล็อก** `.champollion.lock` และ `.champollion-content.lock` จะบันทึกว่าแต่ละคำแปลสร้างขึ้นมาจากข้อความต้นฉบับใด ไฟล์เหล่านี้คือวิธีที่การรันครั้งถัดไปจะทราบว่าข้อความสตริงมีการเปลี่ยนแปลง รันเนอร์ที่ไม่เคยเห็นไฟล์เหล่านี้จะไม่สามารถบอกได้เลยว่าข้อความใดถูกแก้ไขหรือข้อความใดยังไม่ถูกแตะต้อง **ห้ามคอมมิต `.champollion/`** — เพราะเป็นแคชประจำเครื่องแต่ละเครื่อง โดย `champollion init` จะเพิ่มมันลงใน `.gitignore` ให้อยู่แล้ว

**`--max-cost`** จะหยุดการรันก่อนที่จะใช้จ่ายเกินกว่าที่คุณคาดไว้ โปรดตั้งค่านี้ตามค่าใช้จ่ายสำหรับการเปลี่ยนแปลงในแต่ละวันตามปกติ เมื่อคำสั่งนี้หยุดการรัน จะยังไม่มีสิ่งใดได้รับการแปลหรือเขียนลงไฟล์ และ sync จะจบการทำงานด้วยรหัส `2`: จะไม่มีสิ่งใดให้คอมมิต และขั้นตอน "Stop when the sync was partial" จะทำให้จ็อบล้มเหลวพร้อมแจ้งเหตุดังกล่าว วิธีการแปลที่ไม่มีการประกาศราคาอย่างเป็นทางการ (เช่น เอนด์พอยต์ที่โฮสต์เองบนเครื่องอื่น) จะไม่สามารถประเมินค่าใช้จ่ายได้ ดังนั้น `--max-cost` จะหยุดการทำงานทันทีที่มีสิ่งต้องแปล — จึงควรปิดตัวเลือกนี้สำหรับกรณีดังกล่าว ส่วนโมเดลที่ให้บริการบนตัวรันเนอร์เอง (`local` ที่ `localhost`/`127.0.0.1`) จะคิดค่าบริการ API ที่ $0

**เฉพาะการ push ที่เปลี่ยนแปลงข้อความต้นฉบับเท่านั้นที่จะเริ่มงาน** ตัวกรอง `paths:` จะระบุไฟล์โลแคลต้นฉบับของคุณและ `champollion.config.json`: การ push ที่เปลี่ยนเฉพาะโค้ด หรือเปลี่ยนเฉพาะงานแปลและไฟล์ล็อก จะถือว่าไม่มีสิ่งใดต้องแปล จึงไม่เริ่มจ็อบใดๆ ให้แก้ไขพาธโลแคลทั้งสองให้ตรงกับไฟล์ที่การกำหนดค่าของคุณระบุไว้ (`messages/en.json`, `lib/l10n/app_en.arb`, …) และเพิ่มโฟลเดอร์ `contentDir` ของคุณเมื่อการซิงค์ต้องแปล Markdown ด้วย ส่วน **Run workflow** (ทริกเกอร์ `workflow_dispatch`) ยังคงใช้สั่งรันด้วยตนเองได้เสมอ

**คอมมิตของงานนั้นเองจะไม่สั่งให้เริ่มงานซ้ำอีก** — และตัวกรอง `paths:` ไม่ใช่สิ่งที่คอยหยุดมัน ขั้นตอนการคอมมิตจะ push ด้วย `GITHUB_TOKEN` ของเวิร์กโฟลว์ และการ push ที่ทำด้วย `GITHUB_TOKEN` จะไม่มีวันทริกเกอร์ให้เวิร์กโฟลว์ทำงาน (เป็นกฎของ GitHub เพื่อป้องกันไม่ให้เวิร์กโฟลว์เรียกตัวเองวนซ้ำ) นั่นคือสาเหตุที่เวิร์กโฟลว์ Django ด้านล่างสามารถเฝ้าดู `locale/**` ได้ ซึ่งทุกๆ คอมมิตของบอทจะเปลี่ยนแปลงไฟล์นี้ หากเปลี่ยนไป push ด้วย Personal Access Token หรือ GitHub App Token แทน (เช่น เพื่อสั่งให้เวิร์กโฟลว์อื่นเริ่มทำงานเมื่อบอทคอมมิต) การ push นั้นจะสั่งให้เวิร์กโฟลว์นี้เริ่มทำงานใหม่อีกครั้ง ซึ่งตัวกรอง `paths:` จะเป็นตัวตัดสิน ตัวกรองด้านบนได้แยกไฟล์ที่แปลแล้วและไฟล์ล็อกออกไป คอมมิตของบอทจึงไม่เริ่มการรันใหม่ แต่ `locale/**` ของตัวกรอง Django จะรวมเอาแคตตาล็อกที่บอทคอมมิตเข้าไปด้วย คอมมิตแต่ละครั้งของมันจึงเริ่มการรันขึ้นอีกหนึ่งรอบ — ซึ่งจะตรวจไม่พบสิ่งที่ต้องแปลและไม่มีการคอมมิตสิ่งใด หากใช้โทเคนประเภทดังกล่าว ให้จำกัดขอบเขตให้แคบลงเหลือเฉพาะแคตตาล็อกต้นฉบับ (`locale/en/**`) และเพิ่มภาษาผ่านไฟล์การกำหนดค่าแทน

**จำเป็นต้องมีคีย์ผู้ให้บริการในการรันทุกครั้งที่เริ่มต้น** รวมถึงรอบที่ไม่มีสิ่งใดต้องแปลด้วยเช่นกัน: sync จะตรวจสอบว่าวิธีการแปลสามารถทำงานได้จริงก่อนที่จะดูว่ามีอะไรเปลี่ยนแปลงบ้าง การสั่งรันด้วยตนเองโดยไม่มีการเปลี่ยนแปลงที่ต้นฉบับจะยังคงล้มเหลวหากไม่มีซีเคร็ต `OPENROUTER_API_KEY` (หรือคีย์สำหรับวิธีการของคุณ) `local` ไม่จำเป็นต้องใช้คีย์ แต่รันเนอร์จะไม่มีเซิร์ฟเวอร์โมเดล: โปรเจกต์ที่แปลด้วย `local` บนเครื่องของนักพัฒนาจะระบุวิธีการแบบโฮสต์ใน CI (`--method` / `--model` — บรรทัด `SYNC_FLAGS` ที่ใส่คอมเมนต์ไว้ในเวิร์กโฟลว์ด้านบน) หากต้องการตรวจสอบว่าซีเคร็ตส่งมาถึงขั้นตอนนี้หรือไม่ โดยไม่ทำการแปลสิ่งใด `sync --dry` จะแจ้งเตือนเมื่อการรันจริงจะต้องหยุดลงและระบุชื่อตัวแปรที่ขาดหายไป (โดยยังคงส่งออกสถานะ 0 — การทำ dry run คือการดูตัวอย่างล่วงหน้า) มันจะตรวจสอบว่าตัวแปรถูก **ตั้งค่าไว้** หรือไม่ ไม่ได้ตรวจสอบว่าคีย์ **ใช้งานได้** หรือไม่: คำสั่งนี้ไม่ได้ส่งข้อมูลใดๆ ดังนั้นค่าใดๆ ที่ไม่ว่างเปล่าจะผ่านการตรวจสอบ — รวมถึงค่าตัวแทน (placeholder) ด้วย คีย์ที่ไม่ถูกต้องหรือถูกเพิกถอนจะแสดงให้เห็นในคำขอแรกของการรันจริง (ข้อผิดพลาดจะระบุคำตอบจากผู้ให้บริการ เช่น HTTP 401) หากต้องการให้จ็อบล้มเหลวทันทีที่คีย์ขาดหายไปก่อนที่สิ่งใดจะเริ่มทำงาน ให้เพิ่ม [การตรวจสอบก่อนการซิงค์](#check-before-sync)

**แคชจะถูกเก็บแยกตามแต่ละวิธี** คำแปลจะถูกแคชไว้ภายใต้วิธีการ, ระดับภาษา (register) และไฟล์ให้คำแนะนำ (coaching) ที่ใช้สร้างมันขึ้นมา (โมเดลอื่นของวิธีการเดียวกันสามารถนำมาใช้ซ้ำได้ — model carry-over) ดังนั้น นักพัฒนาที่แปลด้วย `local` กับ CI ที่แปลด้วยโมเดลแบบโฮสต์จึงไม่เคยใช้ข้อมูลแคชร่วมกัน — และแคชของ CI ก็แยกเป็นของตัวเองอยู่แล้ว (`.champollion/` ไม่ได้ถูกคอมมิต) แต่นั่นไม่ได้หมายความว่า CI จะต้องแปลโปรเจกต์ใหม่ทั้งหมด: สิ่งที่อยู่ในไฟล์โลแคลอยู่แล้วและมีไฟล์ล็อกถูกคอมมิตไว้ จะถือว่าทำเสร็จแล้ว CI จะจ่ายค่าโมเดลแบบโฮสต์เฉพาะข้อความที่เป็นข้อความใหม่หรือมีการเปลี่ยนแปลงนับตั้งแต่การคอมมิตครั้งล่าสุดเท่านั้น — รวมถึงข้อความใดๆ ที่นักพัฒนาแปลในเครื่องแต่ไม่ได้คอมมิต — และไม่ต้องจ่ายอะไรเลยสำหรับส่วนที่เหลือ การแปลใหม่ทั้งโปรเจกต์ด้วยโมเดลแบบโฮสต์ (`--redo all`) จะคิดค่าบริการทุกข้อความหนึ่งครั้ง

**ตามกำหนดเวลา** แทนที่จะทำเมื่อมีการ push: ให้แทนที่บล็อก `on:` ด้วย `schedule: [{ cron: '0 6 * * *' }]`

### ตรวจสอบก่อนทำการซิงค์: ให้งานล้มเหลวตั้งแต่เนิ่นๆ {#check-before-sync}

การทำ dry run จะส่งออกสถานะ `0` ไม่ว่าจะพบสิ่งใดก็ตาม — เนื่องจากเป็นการดูตัวอย่าง — ดังนั้น `sync --dry
--max-cost 5` จะแจ้งเตือนว่าการรันจริงจะหยุดลงที่ขีดจำกัดงบประมาณ แต่ก็ยังคงผ่านขั้นตอน CI ได้ หากต้องการให้จ็อบล้มเหลวเมื่อการรันจริงจะต้องหยุดลง (คีย์ขาดหายไป หรือ `--max-cost`) ให้อ่านส่วนสรุปของ `sync --dry --json` เอาต์พุตนั้นจะเป็นออบเจกต์ JSON บรรทัดละหนึ่งตัว (NDJSON) โดยแต่ละตัวจะมี `level` — บรรทัด `info`, `ok` และ `event` จะอยู่บน stdout ส่วนบรรทัด `warn` และ `error` จะอยู่บน stderr — และบรรทัดสุดท้ายของ stdout คือส่วนสรุป `{"level": "summary", "command": "sync", …}`
เลือกอ่านตามระดับของมัน **รันคำสั่งด้วยแฟล็กเดียวกับที่ใช้ในการ sync**: หากไม่มีแฟล็กเหล่านั้น มันจะไปตรวจสอบวิธีการที่ระบุในไฟล์การกำหนดค่า ดังนั้นสำหรับโปรเจกต์ที่ระบุไว้ว่า `local` มันจะไปตรวจวิธีในเครื่อง — ไม่ใช่โมเดลแบบโฮสต์ที่จ็อบเรียกใช้ — และจะผ่านบนรันเนอร์ที่ไม่มีคีย์ เมื่อนำไปใส่เป็นขั้นตอนในเวิร์กโฟลว์ด้านบน ก่อนขั้นตอน "Sync translations" มันจะอ่าน `SYNC_FLAGS` เดียวกัน:

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

หรือในเชลล์ โดยระบุแฟล็กต่างๆ — ซึ่งเป็นแฟล็กเดียวกับในบรรทัดคำสั่ง sync:

```bash
SYNC_FLAGS="--method llm --model google/gemini-3.8-flash --max-cost 5"
out=$(npx --yes champollion@0.6 sync --dry $SYNC_FLAGS --json)
printf '%s\n' "$out" | jq -e 'select(.level == "summary") | .preflight.ready and (.maxCost.wouldStop | not)' > /dev/null \
  || printf '%s\n' "$out" | jq -r 'select(.level == "summary") | .error // "A real sync would exit \(.realRun.exitCode): \(.realRun.reasons | join("; "))"'
```

`preflight.ready` จะเป็น `false` เมื่อคีย์ที่วิธีการนั้นต้องใช้ขาดหายไป (ไม่ได้ตั้งค่าหรือเป็นค่าว่าง — ไม่ใช่กรณีที่คีย์ผิด) ไม่ว่าจะมีสิ่งใดต้องแปลหรือไม่ก็ตาม: วิธีการแบบโฮสต์จะไม่มีทางพร้อมทำงานหากไม่มีคีย์ `maxCost.wouldStop` (จะมีอยู่เมื่อใช้ `--max-cost`) จะเป็น `true` เมื่อการรันจริงจะหยุดลงเนื่องจากเกินขีดจำกัดงบประมาณ `jq -e` จะส่งออกสถานะ 1 ในทั้งสองกรณี และขั้นตอนนี้จะพิมพ์เหตุผลลงในบันทึกของจ็อบ — ตัวอย่างเช่น
`A real sync would exit 1: it would stop before translating: No OpenRouter API
key (OPENROUTER_API_KEY) for en:fr`, or `A real sync would exit 2: --max-cost
would stop it before any API call (Estimated translation cost exceeds the
--max-cost cap: estimate ~$7.1200, cap $5.0000)` เมื่อ sync ไม่สามารถทำงานได้เลย (การกำหนดค่าเสียหาย) ขั้นตอนนี้จะพิมพ์ `error` ของส่วนสรุปแทน ขั้นตอนนี้ไม่ได้ส่ง stderr ไปที่ `/dev/null` คำเตือนต่างๆ จึงยังคงปรากฏในบันทึกเช่นกัน `realRun.exitCode` ในส่วนสรุปจะบอกว่าการรันจริงจะจบด้วยรหัสใด เท่าที่การดูตัวอย่างจะบอกได้: `1` เมื่อการตรวจสอบก่อนเริ่มทำงานจะสั่งหยุด, `2` เมื่อ `--max-cost` สั่งหยุด หรือเมื่อผลลัพธ์จะเสร็จสิ้นเพียงบางส่วน — เช่น มีคีย์ที่ถูกระงับไว้ หรือมีข้อความพหูพจน์บนดิสก์ที่ไม่มีรูปแบบที่ภาษานั้นใช้ (`realRun.reasons` จะระบุว่าเป็นกรณีใด) การปฏิเสธโดย quality gate ซึ่งจะพบได้ในการรันจริงเท่านั้น ยังคงสามารถเปลี่ยนผลลัพธ์จาก `0` ให้กลายเป็น `2` ได้ หากต้องการให้การตรวจสอบล้มเหลวเมื่อคาดการณ์ว่าการรันจะเสร็จสิ้นเพียงบางส่วนด้วย ให้ใส่ `.realRun.exitCode == 0` แทนที่ `.preflight.ready and (.maxCost.wouldStop | not)`

### เมนบรันช์ที่มีการป้องกัน: เสนอผ่าน Pull Request

เวิร์กโฟลว์ด้านบนจะ push คำแปลตรงไปยัง `main` หาก `main` มีการป้องกัน (ต้องมีการรีวิวก่อนหรือต้องผ่านการตรวจสอบสถานะ) การ push นั้นจะถูกปฏิเสธ — ซึ่งเกิดขึ้นหลังจากที่ sync ทำงานเสร็จแล้ว คำแปลเหล่านั้นจึงถูกจ่ายเงินไปแล้ว แต่จะไม่ต้องจ่ายเงินซ้ำอีก: แคชจะได้รับการบันทึกก่อนขั้นตอนการคอมมิต แม้ว่าจะมีขั้นตอนใดล้มเหลวก็ตาม ดังนั้นการสั่งรันจ็อบซ้ำหรือการ push ครั้งถัดไป (แต่ละครั้งจะกู้คืนแคชล่าสุดของบรันช์ผ่าน `restore-keys`) จะดึงข้อมูลเหล่านั้นมาจากแคช ไฟล์ล็อกไม่เคยถูกส่งไปถึง `main` ดังนั้นการรันครั้งถัดไปจะพบว่าข้อความเดิมยังคงมีการเปลี่ยนแปลงและจะเขียนไฟล์เหล่านั้นใหม่อีกครั้ง — จากแคช โดยไม่มีค่าใช้จ่าย

บน `main` ที่มีการป้องกัน ให้คอมมิตไปยังบรันช์ที่เป็นของบอทและเปิด (หรืออัปเดต) pull request แทน คงเวิร์กโฟลว์ข้างต้นไว้แล้วเปลี่ยนสองจุด: สิทธิ์ (permissions) และขั้นตอนการคอมมิต

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

**ควรใช้วิธีไหนเมื่อใด** Push ไปยัง `main` เมื่อเวิร์กโฟลว์ได้รับอนุญาตให้ push ได้: ไม่มีการป้องกันบรันช์ หรือมีกฎที่อนุญาตให้ GitHub Actions ข้ามการป้องกันได้ เปิด pull request เมื่อ `main` มีการป้องกัน หรือเมื่อต้องการให้มนุษย์ — ผู้พูดภาษานั้น — ตรวจสอบงานแปลก่อนส่งขึ้นระบบจริง

- บรันช์นี้เป็นของบอท จนกว่า pull request จะถูกรวม (merge) ไฟล์ล็อกของ `main` จะยังไม่มีคำแปลเหล่านั้น ดังนั้นการรันทุกครั้งจะเสนอชุดคำแปลทั้งหมดใหม่อีกครั้ง — ดึงมาจากแคช จึงมีค่าใช้จ่ายเฉพาะข้อความที่เปลี่ยนแปลงหลังจากนั้นเท่านั้น การแก้ไขที่ push ไปยังบรันช์นั้นจะถูกเขียนทับโดยการรันรอบถัดไป: ให้รีวิวใน pull request ทำการรวมโค้ด แล้วค่อยแก้ไขบน `main` (การทำซ้ำแบบกลุ่มในภายหลังจะยังคงเก็บการแก้ไขของมนุษย์ไว้)
- ที่เก็บข้อมูลต้องอนุญาตให้ Actions เปิด pull request ได้: Settings → Actions →
  General → "Allow GitHub Actions to create and approve pull requests"
- pull request ที่เปิดด้วย `GITHUB_TOKEN` ของเวิร์กโฟลว์จะไม่เริ่มเวิร์กโฟลว์อื่น ดังนั้นการตรวจสอบสถานะที่จำเป็นจะไม่ทำงาน หาก `main` กำหนดให้ต้องมีการตรวจสอบเหล่านั้น ให้เปิดด้วย GitHub App token หรือ fine-grained token ที่เก็บไว้ในซีเคร็ต (`GH_TOKEN: ${{ secrets.<name> }}`) หรือใช้แอ็กชันอย่าง `peter-evans/create-pull-request` ซึ่งจะคอมมิต อัปเดตบรันช์ และแก้ไข pull request ที่เปิดอยู่ให้คุณ (ส่งโทเคนให้ด้วยวิธีเดียวกัน)

### gettext (Django, Babel) และ Flutter

Sync จะแปลเฉพาะแคตตาล็อกที่มีอยู่แล้วเท่านั้น โดยจะไม่สกัดข้อความออกจากโค้ดของคุณ โปรเจกต์ Django จะรีเฟรชแคตตาล็อกก่อนขั้นตอนการซิงค์ ตรวจสอบว่าคอมไพล์ผ่านหลังการซิงค์ และคอมมิตเฉพาะไฟล์แคตตาล็อกเท่านั้น

`makemessages` และ `compilemessages` ต่างก็นำเข้า (import) การตั้งค่าของคุณ ดังนั้นจ็อบจึงต้องตั้งค่าสิ่งที่คำสั่งต้องการเพียงครั้งเดียวสำหรับทุกขั้นตอน: ตัวแปรใดๆ ที่โมดูลการตั้งค่าของคุณอ่านเมื่อทำการนำเข้า (`SECRET_KEY`, `DATABASE_URL`, …) ทั้งสองคำสั่งไม่ได้แตะต้องฐานข้อมูล ดังนั้นค่าตัวแทนจึงเพียงพอแล้วสำหรับค่าเหล่านั้น `DJANGO_SETTINGS_MODULE` ถูกใส่คอมเมนต์ละไว้: เพราะ `manage.py` ที่ `startproject` เขียนขึ้นจะกำหนดค่านี้เองอยู่แล้ว และค่าที่กำหนดไว้ในจ็อบจะไปทับค่านั้น — ซึ่งหากระบุชื่อโมดูลผิดจะทำให้ `makemessages` ใช้งานไม่ได้ กำหนดค่านั้นเฉพาะเมื่อ `manage.py` ของคุณไม่ได้กำหนดไว้เท่านั้น

ตัวกรอง `paths:` จะต่างจากเวิร์กโฟลว์ด้านบน: ข้อความต้นฉบับจะอยู่ในโค้ด Python และเทมเพลตของคุณ และ `makemessages` จะสกัดข้อความเหล่านั้นในระหว่างจ็อบ ดังนั้นการเปลี่ยนโค้ดจึงอาจนำมาซึ่งข้อความใหม่ได้ ให้จำกัดแพตเทิร์นให้แคบลงเหลือเฉพาะแอปของคุณ (`myapp/**.py`) หากการ push ทุกครั้งมีการแตะต้องโค้ด Python มันจะเฝ้าดู `locale/**` ด้วยเช่นกัน: ภาษาใหม่จะถูกเพิ่มเข้ามาเป็นโฟลเดอร์แคตตาล็อกใหม่ (`makemessages -l <code>`) คอมมิตของตัวบอทเองจะเปลี่ยนแคตตาล็อกเหล่านั้นแต่จะไม่เริ่มการรันใหม่ เพราะถูก push ด้วย `GITHUB_TOKEN` (ดู **คอมมิตของงานนั้นเองจะไม่สั่งให้เริ่มงานซ้ำอีก** ด้านบน — และสิ่งที่ต้องจำกัดให้แคบลงเมื่อคุณ push ด้วยโทเคนอื่น)

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

`--all` จะอัปเดตทุกแคตตาล็อกที่มีอยู่แล้ว ให้เพิ่มภาษาใหม่ด้วย `makemessages -l <code>` หนึ่งครั้ง (หรือ `champollion init --langs <code>`)
`makemessages` จะรันหนึ่งครั้งต่อหนึ่งโดเมน: `django` สำหรับ Python และเทมเพลต, `djangojs` (`-d djangojs`) สำหรับ JavaScript โดย sync จะแปลแคตตาล็อกของทุกโดเมนที่พบ ขั้นตอนสุดท้ายจะรัน `verify --strict` รายการพหูพจน์ภาษารัสเซียที่งานแปลขาดรูปแบบ `few` หรือ `many` จะถูกเขียนด้วยรูปแบบ `other` และทำเครื่องหมาย `# champollion:` ไว้ การซิงค์ทุกครั้งจะจบด้วยรหัส `2` ตราบใดที่ยังมีรายการดังกล่าวอยู่ในแคตตาล็อก — ทั้งรอบที่เขียนไฟล์นั้นและทุกรอบหลังจากนั้น เช่นเดียวกับกรณีที่คีย์ถูกระงับไว้ — และส่วนสรุปจะระบุชื่อรายการพร้อมคำสั่งสำหรับขอให้ลองใหม่อีกครั้ง บรรทัดตรวจสอบหลังการซิงค์จะแจ้งว่าการรันไม่สมบูรณ์แทนที่จะเป็น `[OK]`
ดังนั้นขั้นตอน "Stop when the sync was partial" จะทำให้จ็อบล้มเหลวหลังจากคอมมิตแล้ว จนกว่าจะมีการเขียนรูปแบบเหล่านั้นจนครบ หากทำงานแบบแยกเดี่ยว มันจะเป็นเพียงคำเตือน: โดยปกติ `verify` จะจบด้วยรหัส 0 ขณะที่ `--strict` จะล้มเหลว `audit` จะนับว่ารายการเหล่านั้นไม่สมบูรณ์เช่นเดียวกัน

`compilemessages` จะรัน `msgfmt --check-format` ซึ่งจะตรวจสอบด้วยว่าแต่ละ `%(name)s` ยังคงรักษาชนิดข้อมูลเดิมไว้หรือไม่ — แต่จะตรวจเฉพาะรายการที่มีแฟล็ก `#, python-format` เท่านั้น
`makemessages` จะเพิ่มแฟล็กดังกล่าวให้กับรายการที่สกัดมาพร้อมตัวแทนข้อความ `%` แต่แคตตาล็อกที่สร้างด้วยมืออาจไม่มีแฟล็กนี้ และรายการเหล่านั้นจะไม่ได้รับการตรวจสอบ คำสั่ง `champollion
verify` จะเปรียบเทียบ printf placeholder ของทุกรายการ (ทั้งชื่อและตัวอักษรระบุชนิดข้อมูล) ไม่ว่าจะมีแฟล็กใดหรือไม่ก็ตาม และ sync จะรักษาแฟล็กของรายการต้นฉบับไว้ในทุกรายการที่แปล ขั้นตอนการคอมมิตจะสเตจ `*.po` และ `.champollion.lock` ตามชื่อ (รวมถึงบันทึกรายการแก้ไขที่ถูกแทนที่หากมี) หากโปรเจกต์ของคุณมีการติดตามไฟล์ `.mo` ให้เพิ่ม `'*.mo'` เข้าไปด้วย ขั้นตอนการแคช, รหัสออกจากการทำงานที่บันทึกไว้ และ `git pull --rebase` ถูกใส่ไว้ด้วยเหตุผลเดียวกับในเวิร์กโฟลว์ด้านบน สำหรับ Babel: ให้ใช้ `pybabel extract` + `pybabel update --no-wrap` ก่อนการซิงค์ และ `pybabel compile` หลังการซิงค์

Flutter ไม่จำเป็นต้องมีขั้นตอนพิเศษในจ็อบนี้: sync จะเขียนไฟล์ `app_<locale>.arb` ให้ และ `flutter gen-l10n` (หรือ `flutter build` ซึ่งเป็นตัวเรียกใช้งานมัน) จะเป็นขั้นตอนการบิลด์ของแอปคุณเอง ซึ่งจะแปลงไฟล์เหล่านั้นเป็น Dart

#### รูปพหูพจน์ที่โมเดลละเว้นไว้ {#plural-gaps}

รายการที่ถูกทำเครื่องหมายไว้ไม่ใช่คำแปล ดังนั้น sync จึงไม่ปล่อยให้เป็นหน้าที่ของมนุษย์เพียงอย่างเดียว:

- **วิธีการหรือโมเดลอื่นจะสอบถามใหม่อีกครั้งโดยอัตโนมัติ** การซิงค์ที่มีการตั้งค่า (วิธีการ, โมเดล, ระดับภาษา, การให้คำแนะนำ) ที่ยังไม่เคยตอบรายการนั้น จะส่งรายการดังกล่าวไปยังโมเดลอีกครั้ง — โดยไม่ดึงจากแคชซึ่งเก็บคำตอบที่ไม่สมบูรณ์เอาไว้ ดังนั้นเมื่อโมเดลในเครื่องของนักพัฒนาละเว้นรูปแบบพหูพจน์ไป โมเดลแบบโฮสต์ของจ็อบ (`SYNC_FLAGS`) จะขอรูปแบบเหล่านั้นในการรันครั้งถัดไป และการประเมินราคาจะคิดค่าบริการรวมเข้าไปด้วย ไฟล์ล็อก (`.champollion.lock` ภายใต้ `gaps`) จะบันทึกการตั้งค่าแต่ละแบบที่ตอบกลับมาโดยไม่มีรูปแบบพหูพจน์ เพื่อไม่ให้การรันในเครื่องและการรันใน CI ต้องสลับกันจ่ายเงินซ้ำซ้อนสำหรับคำตอบที่ไม่สมบูรณ์ชุดเดิม
- **`sync --redo gaps` จะขอรับรายการดังกล่าวทุกรายการ** ไม่ว่าใครจะเป็นผู้ละเว้นไว้ก็ตาม — ในเวิร์กโฟลว์ด้านบน ให้ทำเครื่องหมายที่ `redo_gaps` ใต้ **Run workflow** หรือเพิ่ม `--model` ใน `SYNC_FLAGS` เพื่อใช้โมเดลที่เก่งกว่า
- **หากคำตอบใหม่ยังคงขาดรูปแบบพหูพจน์ รายการนั้นจะยังคงถูกทำเครื่องหมายไว้** และการรันจะจบด้วยรหัส `2` เช่นเดิม จากนั้นให้เขียนรูปแบบเหล่านั้นด้วยตนเองและลบบรรทัด `# champollion:` ออก

การทำ dry run (`sync --dry`) จะระบุชื่อรายการที่จะขอใหม่อีกครั้งพร้อมทั้งประเมินราคา ส่วนสรุป `--json` จะนับจำนวนรายการที่จะไม่ขอใหม่ (`totalPluralGaps`) และแจ้งว่าการรันจริงจะจบด้วยรหัส `2` เนื่องจากรายการเหล่านั้น (`realRun.exitCode`)

## วิธีการแปลอื่นๆ

ตัวอย่างโค้ดด้านล่างแสดงคีย์ที่แต่ละวิธีต้องการและคำสั่ง `sync` ของวิธีนั้นๆ
นำไปใช้ **ภายใน** ขั้นตอน "Sync translations" ของเวิร์กโฟลว์ด้านบน: โดยเปลี่ยน `env` ของขั้นตอน, นำแฟล็กที่แสดงไว้ (`--method openai`, …) ไปใส่ในบรรทัด `SYNC_FLAGS` ของเวิร์กโฟลว์ — เพื่อให้การตรวจสอบแบบ dry-run ใช้วิธีการเดียวกัน — และคงส่วนที่เหลือของขั้นตอนไว้ (`id: sync` และบรรทัดที่บันทึกรหัสออกจากโปรแกรม) เพื่อให้การรันที่สำเร็จเพียงบางส่วนยังคงคอมมิตสิ่งที่แปลแล้วและบันทึกแคชไว้ได้

## วิธี Google Translate

หากใช้วิธี Google Translate ในตัวแทน OpenRouter:

```yaml
- name: Sync translations
  env:
    GOOGLE_TRANSLATE_API_KEY: ${{ secrets.GOOGLE_TRANSLATE_API_KEY }}
  run: npx --yes champollion@0.6 sync
```

## ผู้ให้บริการ LLM โดยตรง

หากใช้วิธี `openai`, `anthropic` หรือ `gemini` โดยตรง:

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

## API การแปลระยะไกล

หากใช้เอนด์พอยต์การแปลระยะไกล (เช่น บริการแปลภาษาที่โฮสต์ไว้):

```yaml
- name: Sync translations
  env:
    CHAMPOLLION_API_KEY: ${{ secrets.CHAMPOLLION_API_KEY }}
  run: npx --yes champollion@0.6 sync
```

## ประตูตรวจสอบ (Gate) ก่อนคุณจะดีพลอย

หากต้องการให้การบิลด์ล้มเหลวเมื่อมีโลแคลใดไม่สมบูรณ์หรือเสียหาย โดยไม่ต้องทำการแปลสิ่งใด ให้รันการตรวจสอบเหล่านี้แยกต่างหาก

:::warning[รันการตรวจสอบหลังการซิงค์ ไม่ใช่ก่อนการซิงค์]
หากการแปลทำงานเฉพาะหลังจากการรวมโค้ด (merge) เท่านั้น (ตามเวิร์กโฟลว์ด้านบน) pull request ที่เพิ่มข้อความใหม่จะยังไม่มีคำแปลสำหรับข้อความนั้น และ `audit`/`verify` จะทำให้ PR ดังกล่าวล้มเหลวทุกครั้ง ให้รันการตรวจสอบในจุดที่มีคำแปลอยู่แล้ว: บน `main` หลังจากจ็อบการซิงค์ทำงานเสร็จสิ้น (`needs: sync` หรือ `on: workflow_run` ของเวิร์กโฟลว์การซิงค์) ทริกเกอร์ `push` จะไม่ทำงานกับคอมมิตของตัวบอทซิงค์เอง — เนื่องจากถูก push ด้วย `GITHUB_TOKEN` ซึ่งจะไม่เริ่มเวิร์กโฟลว์ใดๆ (ดูรายละเอียดด้านบน) สำหรับ pull request ให้รันเฉพาะ `lint` เท่านั้น หรือรันจ็อบการซิงค์บนบรันช์ของ PR ก่อน
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

| การตรวจสอบ | คำสั่ง | ล้มเหลวเมื่อ |
|---|---|---|
| **Lint** | `lint` | ซอร์สโค้ดมีข้อความสตริงที่ไม่มีอยู่ในไฟล์โลแคล — หรือไม่พบไฟล์ต้นฉบับที่จะตรวจสอบ (คำสั่งจะระบุชื่อโฟลเดอร์ที่ค้นหา; สามารถชี้ไปยังที่อื่นได้ด้วย `--src <dir>`) |
| **Audit** | `audit` | มีคีย์ที่ขาดหายไป, เป็นค่าว่าง หรือยังคงเป็นค่าสำรองของ `[EN]` — หรือคำแปล **ล้าสมัย**: สร้างขึ้นจากข้อความต้นฉบับที่เก่ากว่าข้อความปัจจุบัน (มีการแก้ไขต้นฉบับแต่การแปลใหม่ล้มเหลว) — หรือข้อความพหูพจน์ขาดรูปแบบที่ภาษานั้นใช้สำหรับการนับทั่วไปในชีวิตประจำวัน (ภาษารัสเซีย `few`/`many`; รายการที่ `verify --strict` ตรวจพบว่าล้มเหลว) พร้อมระบุคำสั่งสำหรับขอให้แปลใหม่อีกครั้ง |
| **Verify** | `verify` | คำแปลทำให้ placeholder, รูปแบบพหูพจน์ ICU, มาร์กอัป (แท็กถูกเปิด ปิด หรือซ้อนกันผิดไปจากเดิม) หรือสคริปต์เสียหาย — หรือมีคีย์ขาดหายไป — หรือมีข้อความเดียวที่ถูกนำไปใช้แทนข้อความต้นฉบับหลายข้อความที่แตกต่างกัน (โมเดลท่องจำและตอบประโยคเดิมซ้ำๆ) — หรือไม่พบสิ่งใดให้ตรวจสอบ (ไฟล์ต้นฉบับหรือโฟลเดอร์โลแคลไม่ได้อยู่ในตำแหน่งที่การกำหนดค่าชี้ไว้) |
| **Verify แบบเข้มงวด (strict)** | `verify --strict` | พบกรณีใดก็ตามข้างต้น หรือพบคำเตือนใดๆ |

`verify` จะจบด้วยรหัส `1` เมื่อพบข้อผิดพลาดใดๆ และจบด้วย `0` ในกรณีอื่นๆ คำเตือนจะถูกพิมพ์ออกมาแต่จะไม่ทำให้จ็อบล้มเหลว: เช่น การสะท้อนข้อความต้นฉบับ (source echo), โลแคลสองภาษาที่มีข้อความตรงกันทุกประการ, คำแปลที่ล้าสมัย, คำแปลที่ทำเครื่องหมายปิดท้าย `?` หรือ `!` ของต้นฉบับหายไป (บางภาษาจะระบุคำถามด้วยคำลงท้ายแทน) และคำเตือนเรื่องพหูพจน์ด้านล่าง ข้อความเดียวที่ถูกเขียนขึ้นสำหรับข้อความต้นฉบับหลายข้อความที่ต่างกันจะถือเป็นข้อผิดพลาด: สตริงหลายคำสองข้อความที่ต่างกันชัดเจนแต่ได้รับคำตอบเป็นข้อความเดียวกันที่มีตั้งแต่สี่คำขึ้นไป หรือตั้งแต่สามคำขึ้นไปในกรณีอื่นๆ การนับจะนับครอบคลุมทั้งค่าของคีย์ แต่ละกิ่งของพหูพจน์ และหน้า Markdown ของโลแคล ตามกฎที่เกตของ `sync` ใช้ปฏิเสธ `verify --strict` จะเปลี่ยนทุกคำเตือนให้กลายเป็นข้อผิดพลาด ให้ใช้ตัวเลือกนี้เมื่อคุณต้องการบล็อกการดีพลอยหากพบสิ่งผิดปกติ เช่น กรณีที่โมเดลละเว้นรูปแบบพหูพจน์ภาษารัสเซีย คำแปลที่ล้าสมัยจะเป็นเพียงคำเตือนใน `verify` (เนื่องจากโครงสร้างยังสมบูรณ์) แต่จะเป็นข้อผิดพลาดใน `audit` (เกตตรวจสอบความสมบูรณ์) ซึ่งจะพิมพ์คำสั่งสำหรับการแปลข้อความเหล่านั้นใหม่ออกมา

ผลการตรวจสอบรูปแบบพหูพจน์จะขึ้นอยู่กับวิธีที่รูปแบบไฟล์นั้นๆ จัดเก็บพหูพจน์:

| รูปแบบ | ข้อผิดพลาด (`verify` จบด้วยรหัส 1) | คำเตือน (ล้มเหลวเฉพาะเมื่อใช้ `--strict`) |
|---|---|---|
| i18next suffixed keys (`count_one`, `count_other`, …) | รูปแบบที่โลแคลนั้นจำเป็นต้องใช้ขาดหายไป (ภาษาฝรั่งเศส `count_many`): ถือเป็นกรณีคีย์ขาดหาย | มีคีย์สำหรับรูปแบบที่โลแคลนั้นไม่มี (ภาษาฝรั่งเศสหรือภาษาสเปน `count_two`) โดย `verify` จะพิมพ์คำสั่งสำหรับลบคีย์เหล่านั้นออกโดยเฉพาะ คือ `sync --prune plural-extras`; sync จะไม่มีวันลบคีย์เหล่านี้หากไม่มีคำสั่งดังกล่าว |
| ข้อความ ICU (`{count, plural, …}` ใน next-intl, ARB, i18next ICU) | โครงสร้างพหูพจน์เสียหาย (ตัวแปร คีย์เวิร์ด หรือตัวเลือกถูกแปล หรือทำ `#` หายไป) | กิ่ง (branch) ที่โลแคลนั้นใช้สำหรับการนับทั่วไปในชีวิตประจำวันขาดหายไป (ภาษารัสเซีย `few`, `many`) ส่วนรูปแบบที่ขาดหายไปซึ่งใช้เฉพาะกับตัวเลขจำนวนมาก (ภาษาฝรั่งเศส `many` สำหรับ 1 000 000) จะไม่ถูกรายงาน |
| gettext (`msgid_plural`) | รายการที่ไม่มีคำแปล (ว่างเปล่าหรือเป็น `fuzzy`): ถือเป็นกรณีคีย์ขาดหาย | รูปแบบ `msgstr[]` ที่ใช้ข้อความซ้ำกับรูปแบบ `other` ในภาษาที่มีรูปแบบเฉพาะของตนเองสำหรับการนับทั่วไปในชีวิตประจำวัน (ทำเครื่องหมายไว้ด้วยคอมเมนต์ `# champollion:`) หรือมีบรรทัด `msgstr[]` มากกว่า `nplurals` ของแคตตาล็อก รูปแบบพหูพจน์จะถูกนับตามส่วนหัว `Plural-Forms` ของแคตตาล็อกเอง |

รูปแบบของ i18next ที่แปลมาจากข้อความของอีกรูปแบบหนึ่งอาจมีข้อความตรงกับรูปแบบนั้นทุกประการได้ (เช่น ภาษาฝรั่งเศส `count_many` เหมือนกับ `count_other`) ภาษาฝรั่งเศสอาจเขียนทั้งสองรูปแบบเหมือนกันได้ จึงไม่ถือเป็นคำเตือน เมื่อ sync ร้องขอรูปแบบใดจากโมเดล มันจะบันทึกสิ่งนั้นไว้ใน `.champollion.lock` พร้อมกับลายนิ้วมือ (fingerprint) ของคำตอบ `verify` จะอ่านเฉพาะบันทึกนั้น ดังนั้นทุกเครื่องที่โคลนคอมมิตเดียวกันไปจะได้ผลลัพธ์เหมือนกัน แคชในแล็ปท็อปของคุณกับรันเนอร์ CI ตัวใหม่จึงไม่มีทางขัดแย้งกัน ค่าที่ไม่มีบันทึก (เขียนขึ้นด้วยมือ, สร้างโดยเครื่องมืออื่น, สร้างโดยโปรแกรมแปลภาษาที่ไม่สามารถระบุรูปแบบได้ หรือสร้างโดยเวอร์ชันเก่า) จะแสดงเป็นบรรทัดข้อมูล (info) พร้อมคำสั่งสำหรับขอใหม่อีกครั้ง โดย `--strict` จะไม่ล้มเหลวเพราะกรณีนี้
การ Verify จะตรวจสอบเฉพาะโครงสร้าง ไม่ได้ตรวจความหมาย: การผ่านการตรวจสอบหมายความว่าคีย์, placeholder, พหูพจน์, มาร์กอัป และสคริปต์ยังคงสมบูรณ์ ไม่ได้หมายความว่าข้อความสื่อความหมายถูกต้อง

---

## ดูเพิ่มเติม

- [เอกสารอ้างอิง CLI](/docs/reference/cli) — เอกสารอ้างอิงคำสั่งทั้งหมด
- [Sync ทำงานอย่างไร](/docs/concepts/how-sync-works) — ทำความเข้าใจการซิงค์แบบส่วนเพิ่ม
- [ความจำการแปล (Translation Memory)](/docs/concepts/translation-memory) — การแคชและการประหยัดค่าใช้จ่าย
- [วิธีการแปล](/docs/guides/translation-methods) — การเลือกวิธีการแปลสำหรับแต่ละคู่ภาษา
- [Quality Gate](/docs/concepts/quality-gate) — จะเกิดอะไรขึ้นเมื่อการแปลไม่ผ่าน
- [การกำหนดค่า](/docs/getting-started/configuration) — เอกสารอ้างอิงการกำหนดค่า
