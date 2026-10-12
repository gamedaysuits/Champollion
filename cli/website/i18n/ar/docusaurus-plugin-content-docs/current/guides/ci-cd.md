---
sidebar_position: 3
title: "CI/CD"
---

# التكامل مع CI/CD

أتمتة الترجمات في مسار البناء (build pipeline) الخاص بك.

أداة واجهة سطر الأوامر لـ champollion متاحة المصدر بموجب [PolyForm Noncommercial License 1.0.0](https://github.com/gamedaysuits/Champollion/blob/main/cli/LICENSE): مجانية للاستخدام والتعديل والمشاركة للأغراض غير التجارية. لا يغطي هذا الترخيص استخدامها لأغراض تجارية ([من يجوز له استخدام هذا](/docs/getting-started/who-may-use-this)).

## GitHub Actions: الحفاظ على مزامنة الترجمات

سير عمل كامل: ترجمة ما تغير، والتحقق من النتيجة، وتثبيتها وإرسالها (commit). يعمل هذا مع أي مشروع — سواء كان يعتمد على Node أم لا (Django، وFlutter، وHugo).

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

**سبب تصميم سير العمل بهذه الطريقة.** يقوم `actions/cache` بمفرده بحفظ التخزين المؤقت (cache) فقط عند نجاح المهمة بأكملها، ويخرج `sync` برمز `2` كلما تم رفض أي مفتاح — لذا كان التشغيل الجزئي يتخطى كلاً من التثبيت (commit) وحفظ التخزين المؤقت، ويدفع التشغيل التالي مقابل الترجمات نفسها مرة أخرى. هنا، تتم استعادة التخزين المؤقت وحفظه على خطوتين (`actions/cache/restore`، ثم `actions/cache/save` مع `if: always()`)، وتسجل خطوة المزامنة رمز الخروج الخاص بها بدلاً من الفشل عند `2`، ويتم تثبيت الملفات المترجمة، وعندها فقط تفشل المهمة — في خطوة خاصة بها، قبل `verify`، بحيث توضح الخطوة الفاشلة السبب (توقف بسبب `--max-cost`، أو مفاتيح لم تتمكن المزامنة من ترجمتها) بدلاً من أن يذكر `verify` مفتاحاً مفقوداً. الخطوة الأخيرة هي `verify --strict`: يخرج `verify` العادي بالرمز 0 عند التحذيرات (ومن بينها صيغة جمع إضافية أو مفقودة)، بينما يُفشل `--strict` المهمة عند وجودها. يتم تذكر المفتاح الذي رفضته بوابة الجودة (quality gate): ولا يرسله التشغيل التالي إلى النموذج نفسه مرة أخرى (إذ ستتم فوترة الإجابة نفسها) — حيث يذكر سجل المزامنة المفتاح وأمر `--redo keys:` الذي يطلبه مجدداً.

**نسخة تخزين مؤقت واحدة لكل تغيير، وليس لكل تشغيل.** تستعيد خطوة الاستعادة أحدث نسخة تخزين مؤقت للفرع (المفتاح الدقيق لها، `…-newest`، لا يُحفظ أبداً، لذا يختار `restore-keys` النسخة الأحدث). وتعيّن خطوة الحفظ مفتاح التخزين المؤقت بالاعتماد على تجزئة (hash) لملفاته الخاصة (`hashFiles('.champollion/**')`): فالتشغيل الذي ترجم شيئاً ما — حتى لو كان تشغيلاً جزئياً، أو تشغيلاً فشل الدفع (push) فيه — قد غيّر التخزين المؤقت، وبالتالي يحصل على مفتاح جديد ويتم حفظه؛ أما التشغيل الذي لم يُضف شيئاً (لا يوجد ما يُترجم، أو تم استرجاع كل شيء من التخزين المؤقت، أو توقف بسبب `--max-cost`) فيحتفظ بالمفتاح الذي استعاده، مما يؤدي إلى تخطي الحفظ وعدم تخزين نسخة جديدة. كان ربط المفتاح بمعرّف التشغيل (run id) يحفظ نسخة كاملة في كل عملية تشغيل؛ في حين أن ربطه بملف القفل والملفات المصدرية كان سيستعيد نسخة أقدم عبر المطابقة الدقيقة بعد تشغيل تم فيه رفض الدفع، لأن ملف القفل المثبّت لم يحصل على تغييرات ذلك التشغيل قط.

في مشروع Node، يمكنك إضافة `champollion` كاعتمادية تطوير (dev dependency) واستدعاء `npx champollion sync` بدلاً من ذلك؛ أما `champollion@0.5` المثبّت الإصدار أعلاه فيعمل في أي مستودع ولا يختار إصداراً مختلفاً على نحو مفاجئ أبداً. يجب على المهمة بعد ذلك تثبيته: على بيئة تشغيل (runner) جديدة، فإن تنفيذ `npx champollion` بدون تثبيت مسبق يجلب أحدث إصدار، وليس الإصدار المثبّت في ملف القفل الخاص بك. كما تؤدي عملية التثبيت إلى كتابة `node_modules/`، والذي سيقوم `git add --all` بتثبيته (commit) ما لم يكن مدرجاً في ملف `.gitignore` الخاص بك (الملف الذي ينشئه `champollion init` يسرد `.champollion/` فقط)، لذا قم بإدراج ملفات اللغات وملف القفل بالاسم في مرحلة التجهيز (stage)، تماماً كما يفعل سير عمل Django أدناه:

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

**تثبيت ملفات القفل (Commit).** يسجل كل من `.champollion.lock` و`.champollion-content.lock` النص المصدري الذي تم إنشاء كل ترجمة منه. وبهذه الطريقة يعرف التشغيل التالي أن سلسلة نصية قد تغيرت. ولا يمكن لبيئة التشغيل التي لا تراهما التمييز بين سلسلة نصية معدلة وأخرى لم تُمس. **لا تقم بتثبيت `.champollion/`** — فهو التخزين المؤقت الخاص بكل جهاز؛ ويقوم `champollion init` بإضافته إلى `.gitignore`.

يوقف الخيار **`--max-cost`** التشغيل قبل أن ينفق أكثر مما تتوقع؛ اضبطه على التكلفة المعتادة لتغييرات يوم عادي. عندما يوقف التشغيل، لا يتم ترجمة أو كتابة أي شيء، وتخرج المزامنة بالرمز `2`: حيث لا يوجد شيء لتثبيته، وتُفشل خطوة "Stop when the sync was partial" المهمة موصحةً ذلك. لا يمكن تقدير تكلفة طريقة ليس لها سعر معلن (مثل نقطة نهاية مستضافة ذاتياً على جهاز آخر)، لذا يتوقف `--max-cost` كلما وجد ما يتطلب الترجمة — اتركه معطلاً في تلك الحالات. أما النموذج المستضاف على بيئة التشغيل نفسها (`local` عند `localhost`/`127.0.0.1`) فتُسعّر تكلفة واجهة برمجة التطبيقات (API) الخاصة به بمبلغ 0 دولار.

**عمليات الدفع (pushes) التي تغيّر سلسلة نصية مصدرية هي فقط التي تبدأ المهمة.** يسرد عامل التصفية `paths:` ملفات اللغات المصدرية الخاصة بك وملف `champollion.config.json`: وأي عملية دفع تغيّر التعليمات البرمجية فقط، أو تغيّر الترجمات وملفات القفل فقط، ليس لديها ما تترجمه، وبالتالي لا تبدأ أي مهمة. قم بتعديل مساري ملفات اللغات ليطابقا الملفين المحددين في إعداداتك (`messages/en.json`، `lib/l10n/app_en.arb`، ...)؛ وأضف مجلد `contentDir` الخاص بك عندما تقوم المزامنة بترجمة Markdown أيضاً. يظل خيار **Run workflow** (مُشغّل `workflow_dispatch`) يشغّله يدوياً.

**التثبيت التلقائي الخاص بالمهمة لا يعيد تشغيلها أبداً** — وليس عامل التصفية `paths:` هو ما يمنع ذلك. تقوم خطوة التثبيت بالدفع باستخدام `GITHUB_TOKEN` الخاص بسير العمل، والدفع الذي يتم بواسطة `GITHUB_TOKEN` لا يشغّل سير العمل إطلاقاً (وفقاً لقواعد GitHub، لمنع سير العمل من تشغيل نفسه ذاتياً). ولهذا السبب يستطيع سير عمل Django أدناه مراقبة `locale/**`، والذي يغيره كل تثبيت يقوم به البوت. إذا قمت بالدفع باستخدام رمز وصول شخصي (personal access token) أو رمز GitHub App بدلاً من ذلك (لتشغيل مهام سير عمل أخرى عند تثبيت البوت، مثلاً)، فسيؤدي هذا الدفع إلى إعادة تشغيل سير العمل هذا؛ وعندئذ يكون عامل التصفية `paths:` هو الفيصل. يستثني عامل التصفية أعلاه الملفات المترجمة وملفات القفل، فلا يبدأ تثبيت البوت أي تشغيل. في المقابل، يشمل `locale/**` في مرشح Django الفهارس التي يثبتها البوت، مما يجعل كل تثبيت للبوت يبدأ تشغيلاً إضافياً — والذي لا يجد شيئاً ليترجمه ولا يثبت أي شيء. مع وجود مثل هذا الرمز، ضيّق النطاق إلى الفهرس المصدري (`locale/en/**`) وأضف اللغات عبر ملف الإعدادات.

**مفتاح المزود مطلوب في كل تشغيل يبدأ**، حتى عندما لا يكون هناك ما يحتاج إلى ترجمة: تتحقق المزامنة من إمكانية تشغيل الطريقة قبل أن تبحث في ما تغير. وأي تشغيل يبدأ يدوياً دون أي تغيير في المصدر سيفشل بدون السر `OPENROUTER_API_KEY` (أو مفتاح طريقتك). لا يحتاج `local` إلى مفتاح، لكن بيئة التشغيل لا تحتوي على خادم نماذج: المشروع الذي يترجم باستخدام `local` على جهاز المطور يحدد طريقة مستضافة في CI (`--method` / `--model` — سطر `SYNC_FLAGS` المعلّق في سير العمل أعلاه). للتحقق من وصول السر إلى الخطوة، دون ترجمة أي شيء، يحذر `sync --dry` عندما يتوقع توقف التشغيل الحقيقي ويذكر المتغير المفقود (ولا يزال يخرج بالرمز 0 — فالتشغيل التجريبي مجرد معاينة). وهو يتحقق من أن المتغير **مُعيّن**، وليس من أن المفتاح **يعمل**: فهو لا يرسل أي شيء، وبالتالي تُقبل أي قيمة غير فارغة — حتى لو كانت قيمة نائبة مؤقتة. يظهر المفتاح الخاطئ أو الملغى عند أول طلب في التشغيل الحقيقي (حيث يذكر الخطأ رد المزود، مثل HTTP 401). لإفشال المهمة عند فقدان المفتاح قبل تشغيل أي شيء، أضف [الفحص قبل المزامنة](#check-before-sync).

**يتم الاحتفاظ بالتخزين المؤقت لكل طريقة بشكل منفصل.** تُخزَّن الترجمة مؤقتاً بالاعتماد على الطريقة ومستوى الخطاب (register) وملف التوجيه (coaching file) الذي أنشأها (ويعيد نموذج مختلف يتبع الطريقة نفسها استخدامها — ترحيل النموذج model carry-over). وبالتالي، فإن المطور الذي يترجم باستخدام `local` ونظام CI الذي يترجم بنموذج مستضاف لا يتشاركان مدخلات التخزين المؤقت أبداً — كما أن التخزين المؤقت لـ CI مستقل بذاته على أي حال (حيث لا يتم تثبيت `.champollion/`). هذا لا يعني أن CI يعيد ترجمة المشروع بأكمله: فما هو موجود بالفعل في ملفات اللغات، مع تثبيت ملف القفل الخاص به، يُعد مكتملاً. يدفع CI للنموذج المستضاف مقابل السلاسل النصية الجديدة أو التي تغيرت منذ آخر تثبيت — بما في ذلك أي سلاسل ترجمها المطور محلياً ولكنه لم يثبتها — ولا يدفع شيئاً للباقي. إعادة ترجمة المشروع بأكمله بالنموذج المستضاف (`--redo all`) تفرض تكلفة على كل سلسلة نصية مرة واحدة.

**وفق جدول زمني** بدلاً من الدفع عند كل دفع (push): استبدل كتلة `on:` بـ `schedule: [{ cron: '0 6 * * *' }]`.

### الفحص قبل المزامنة: إفشال المهمة مبكراً {#check-before-sync}

يخرج التشغيل التجريبي برمز `0` أياً كان ما يجده — فهو مجرد معاينة — ولذلك فإن `sync --dry --max-cost 5` يحذر من أن التشغيل الحقيقي سيتوقف عند الحد الأقصى ومع ذلك ينجح كخطوة في CI. لإفشال المهمة عندما يتوقع توقف التشغيل الحقيقي (مفتاح مفقود، أو `--max-cost`)، اقرأ ملخص `sync --dry --json`. هذا الإخراج هو كائن JSON واحد لكل سطر (NDJSON)، يحتوي كل منها على `level` — أسطر `info` و`ok` و`event` على stdout، وأسطر `warn` و`error` على stderr — وآخر سطر في stdout هو الملخص، `{"level": "summary", "command": "sync", …}`.
حدده بناءً على مستواه. **قم بتشغيله بنفس الرايات (flags) المستخدمة في المزامنة**: فبدونها يتحقق من الطريقة المحددة في الإعدادات؛ فبالنسبة لمشروع تنص إعداداته على `local`، سيتحقق من الطريقة المحلية — وليس النموذج المستضاف الذي تشغله المهمة — وينجح على بيئة تشغيل لا تحتوي على مفتاح. كخطوة في سير العمل أعلاه، قبل "Sync translations"، يقرأ نفس `SYNC_FLAGS`:

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

أو في سطر الأوامر (shell)، مع كتابة الرايات صراحةً — نفس رايات سطر المزامنة:

```bash
SYNC_FLAGS="--method llm --model google/gemini-3.8-flash --max-cost 5"
out=$(npx --yes champollion@0.5 sync --dry $SYNC_FLAGS --json)
printf '%s\n' "$out" | jq -e 'select(.level == "summary") | .preflight.ready and (.maxCost.wouldStop | not)' > /dev/null \
  || printf '%s\n' "$out" | jq -r 'select(.level == "summary") | .error // "A real sync would exit \(.realRun.exitCode): \(.realRun.reasons | join("; "))"'
```

تكون قيمة `preflight.ready` هي `false` عندما يكون المفتاح الذي تحتاجه الطريقة مفقوداً (غير معيّن أو فارغ — وليس عندما يكون خاطئاً)، سواء كان هناك ما يحتاج إلى ترجمة أم لا: فالطريقة المستضافة لا تكون جاهزة أبداً بدون مفتاحها. ويكون `maxCost.wouldStop` (موجود مع `--max-cost`) هو `true` عندما يتوقف التشغيل الحقيقي عند الحد الأقصى. يخرج `jq -e` بالرمز 1 في أي من الحالتين، وتقوم الخطوة بعد ذلك بطباعة السبب في سجل المهمة — على سبيل المثال:
`A real sync would exit 1: it would stop before translating: No OpenRouter API
key (OPENROUTER_API_KEY) for en:fr`, or `A real sync would exit 2: --max-cost
would stop it before any API call (Estimated translation cost exceeds the
--max-cost cap: estimate ~$7.1200, cap $5.0000)`. عندما يتعذر تشغيل المزامنة على الإطلاق (بسبب ملف إعدادات معطوب)، تطبع الخطوة `error` الخاص بالملخص بدلاً من ذلك. لا ترسل الخطوة stderr إلى `/dev/null`، لذا تظل التحذيرات في السجل أيضاً. يوضح حقل `realRun.exitCode` في الملخص رمز الخروج المتوقع للتشغيل الحقيقي، وفقاً لما يمكن للمعاينة معرفته: `1` عندما يوقفه الفحص الأولي (preflight)، و`2` عندما يوقفه `--max-cost`، أو عندما ينتهي جزئياً — كوجود مفاتيح محجوبة، أو رسائل جمع على القرص تفتقر إلى صيغة تستخدمها اللغة (يوضح `realRun.reasons` ذلك بالتفصيل). يمكن للرفض من قبل بوابة الجودة، والذي لا يكشفه إلا التشغيل الحقيقي، أن يغير النتيجة من `0` إلى `2`. لإفشال الفحص عند توقع تشغيل جزئي أيضاً، ضع `.realRun.exitCode == 0` بدلاً من `.preflight.ready and (.maxCost.wouldStop | not)`.

### الفرع الرئيسي المحمي: تقديم طلب سحب (Pull Request)

يدفع سير العمل أعلاه الترجمات مباشرة إلى `main`. إذا كان `main` محمياً (يتطلب مراجعات أو فحوصات حالة إلزامية)، فسيتم رفض هذا الدفع — بعد أن تكون المزامنة قد عملت بالفعل ودُفعت تكلفة الترجمات. ولن يتم الدفع مقابلها مجدداً: إذ يُحفظ التخزين المؤقت قبل خطوة التثبيت، حتى عند فشل إحدى الخطوات، وبالتالي فإن إعادة تشغيل المهمة أو الدفع التالي (حيث يستعيد كل منهما أحدث تخزين مؤقت للفرع، عبر `restore-keys`) يسترجعها من التخزين المؤقت. ولأن ملفات القفل لم تصل إلى `main` أبداً، فإن التشغيل التالي يجد السلاسل نفسها قد تغيرت ويكتبها مرة أخرى — من التخزين المؤقت، ودون أي تكلفة.

على فرع `main` محمي، قم بالتثبيت في فرع يملكه البوت وافتح (أو حدّث) طلب سحب بدلاً من ذلك. احتفظ بسير العمل أعلاه وغيّر أمرين فقط: الأذونات، وخطوة التثبيت.

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

**متى تستخدم كلاً منهما.** ادفع إلى `main` عندما يُسمح لسير العمل بالدفع هناك: كعدم وجود حماية للفرع، أو وجود قاعدة تسمح لـ GitHub Actions بتجاوزها. وافتح طلب سحب عندما يكون `main` محمياً، أو عندما ينبغي لشخص — متحدث باللغة — مراجعة الترجمات قبل شحنها ونشرها.

- الفرع يخص البوت. وإلى أن يتم دمج طلب السحب، فإن ملفات القفل الخاصة بـ `main` لا تحتوي على ترجماته، لذا يقترح كل تشغيل المجموعة بأكملها مرة أخرى — من التخزين المؤقت، بحيث تتم فوترة السلاسل التي تغيرت منذ ذلك الحين فقط. التعديلات التي تُدفع إلى ذلك الفرع يستبدلها التشغيل التالي: راجع في طلب السحب، وادمج، ثم عدّل على `main` (إعادة الإجراء الشاملة لاحقاً تحتفظ بتعديلات العنصر البشري).
- يجب أن يسمح المستودع لـ Actions بفتح طلبات السحب: Settings ← Actions ← General ← "Allow GitHub Actions to create and approve pull requests".
- طلب السحب المفتوح باستخدام `GITHUB_TOKEN` الخاص بسير العمل لا يشغّل أي سير عمل آخر، وبالتالي لن تعمل عليه فحوصات الحالة المطلوبة أبداً. إذا كان `main` يتطلبها، فافتحه باستخدام رمز GitHub App أو رمز دقيق الصلاحيات (fine-grained token) محفوظ كسر (`GH_TOKEN: ${{ secrets.<name> }}`)، أو استخدم إجراءً مثل `peter-evans/create-pull-request`، الذي يقوم بالتثبيت وتحديث الفرع وتعديل طلب السحب المفتوح نيابة عنك (مرر له الرمز بالطريقة نفسها).

### gettext (Django وBabel) وFlutter

تترجم المزامنة الفهارس (catalogs) الموجودة بالفعل؛ ولا تستخرج السلاسل النصية من الكود الخاص بك. ويقوم مشروع Django بتحديث الفهارس قبل خطوة المزامنة، والتحقق من ترجمتها وتجميعها (compile) بعدها، وتثبيت الفهارس فقط.

يقوم كل من `makemessages` و`compilemessages` باستيراد الإعدادات الخاصة بك، لذا تحدد المهمة ما يحتاجان إليه، مرة واحدة، لجميع الخطوات: أي متغير تقرأه وحدة الإعدادات عند الاستيراد (`SECRET_KEY`، `DATABASE_URL`، ...). لا يمس أي من الأمرين قاعدة البيانات، لذا تكفي قيمة نائبة مؤقتة لهما. يُترك `DJANGO_SETTINGS_MODULE` كتعليق: فالملف `manage.py` الذي يكتبه `startproject` يقوم بتعيينه بنفسه، وأي قيمة تُعيّن في المهمة ستتجاوز تلك القيمة — والاسم الخاطئ للوحدة يعطل `makemessages`. لا تقم بتعيينه إلا إذا لم يقم `manage.py` الخاص بك بذلك.

يختلف عامل التصفية `paths:` الخاص به عن سير العمل أعلاه: فالسلاسل النصية المصدرية توجد داخل كود Python والقوالب الخاصة بك، ويقوم `makemessages` باستخراجها أثناء المهمة، لذا يمكن لأي تغيير في الكود أن يأتي بسلسلة نصية جديدة. ضيّق نطاق الأنماط إلى تطبيقاتك (`myapp/**.py`) إذا كانت كل عملية دفع تعدل في Python. كما يراقب `locale/**` أيضاً: حيث تضاف أي لغة جديدة كمجلد فهرس جديد (`makemessages -l <code>`). يؤدي التثبيت الخاص بالبوت إلى تعديل تلك الفهارس ولكنه لا يبدأ أي تشغيل، لأنه يُدفع باستخدام `GITHUB_TOKEN` (انظر **التثبيت التلقائي الخاص بالمهمة لا يعيد تشغيلها أبداً** أعلاه — وما يجب تضييق نطاقه عند الدفع برمز آخر).

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

يحدّث `--all` كل فهرس موجود بالفعل؛ أضف لغة باستخدام `makemessages -l <code>` لمرة واحدة (أو `champollion init --langs <code>`).
يتم تشغيل `makemessages` مرة واحدة لكل نطاق (domain): `django` لـ Python والقوالب، و`djangojs` (`-d djangojs`) لـ JavaScript. تترجم المزامنة فهرس كل نطاق تجده. وتشغّل الخطوة الأخيرة `verify --strict`. ومدخلة الجمع الروسية التي تفتقر ترجمتها إلى صيغة `few` أو `many` تُكتب بصيغة `other` وتُعلّم بعلامة `# champollion:`. وتخرج كل مزامنة بالرمز `2` طالما وجد مثل هذا المدخل في الفهرس — سواء المزامنة التي كتبته أو كل مزامنة تليها، تماماً كما هو الحال مع المفتاح المحجوب — ويذكر ملخصها المدخل والأمر الذي يعيد طلبه؛ وعندئذ يفيد سطر التحقق بعد المزامنة بأن التشغيل غير مكتمل بدلاً من `[OK]`.
لذا تُفشل خطوة "Stop when the sync was partial" المهمة بعد التثبيت إلى أن تتم كتابة الصيغ. وبشكل مستقل، يُعد هذا تحذيراً: فالأمر `verify` العادي يخرج بالرمز 0 عنده، بينما يُفشله `--strict`. ويحسب `audit` المدخلات نفسها على أنها غير مكتملة.

يشغّل `compilemessages` الأمر `msgfmt --check-format`، والذي يتحقق أيضاً من احتفاظ كل `%(name)s` بنوعه — ولكن فقط في المدخلات التي تحمل العلامة `#, python-format`. يضيف `makemessages` تلك العلامة إلى المدخلات التي يستخرجها باستخدام عنصر نائب من نوع `%`؛ أما الفهرس المُنشأ يدوياً فقد يفتقر إليها، وحينئذ لا يتم التحقق من مدخلاته. يقارن `champollion verify` العناصر النائبة لـ printf (الاسم وحرف النوع) في كل مدخلة بغض النظر عن علاماتها، وتحتفظ المزامنة بعلامات المدخلة المصدرية في كل مدخلة تترجمها. وتقوم خطوة التثبيت بإدراج `*.po` و`.champollion.lock` في مرحلة التجهيز (stage) بالاسم (وسجل التعديلات المستبدلة عند وجوده)؛ وإذا كان مشروعك يتتبع ملفات `.mo`، فأضف `'*.mo'` إليها. وتوجد خطوات التخزين المؤقت، ورمز الخروج المسجل، و`git pull --rebase` للأسباب نفسها الموضحة في سير العمل أعلاه. بالنسبة لـ Babel: استخدم `pybabel extract` + `pybabel update --no-wrap` قبل المزامنة، و`pybabel compile` بعدها.

لا يتطلب Flutter أي خطوة إضافية في هذه المهمة: فالمزامنة تكتب ملفات `app_<locale>.arb`، ويعد `flutter gen-l10n` (أو `flutter build` الذي يشغله) خطوة بناء تطبيقك الخاصة، حيث يحولها إلى Dart.

#### صيغ الجمع التي أغفلها النموذج {#plural-gaps}

المدخلة المعلّمة لا تُعد ترجمة، لذا لا تتركها المزامنة للمراجعة البشرية وحدها:

- **طريقة أو نموذج آخر يطلبها مجدداً تلقائياً.** المزامنة التي لم يُجب إعدادها (الطريقة، والنموذج، ومستوى الخطاب، والتوجيه) على تلك المدخلة بعد، ترسلها إلى النموذج مرة أخرى — وليس إلى التخزين المؤقت الذي يحفظ الإجابة غير المكتملة. لذلك، عندما يُغفل النموذج المحلي للمطور هذه الصيغ، يطلبها النموذج المستضاف للمهمة (`SYNC_FLAGS`) في تشغيله التالي، ويحدد التقدير تكلفتها. ويسجل ملف القفل (`.champollion.lock`، تحت `gaps`) كل إعداد أجاب بدون الصيغ، بحيث لا يتناوب التشغيل المحلي وتشغيل CI على الدفع مقابل الإجابة غير المكتملة نفسها.
- **`sync --redo gaps` يطلب كل مدخلة من هذا النوع**، أياً كان من أغفلها — في مهام سير العمل أعلاه، ضع علامة اختيار على `redo_gaps` تحت **Run workflow**. أضف `--model` إلى `SYNC_FLAGS` لاختيار نموذج أقوى.
- **إذا كانت الإجابة الجديدة تفتقر إلى الصيغ أيضاً، تظل المدخلة معلّمة** ويخرج التشغيل برمز `2`، كما كان سابقاً. وحينئذ، اكتب الصيغ يدوياً واحذف سطر `# champollion:`.

يذكر التشغيل التجريبي (`sync --dry`) المدخلات التي سيطلبها مجدداً ويسعّرها؛ ويحصي ملخصه `--json` المدخلات التي لن يطلبها (`totalPluralGaps`) ويوضح أن التشغيل الحقيقي سيخرج بالرمز `2` بسببها (`realRun.exitCode`).

## طرق أخرى

توضح المقتطفات أدناه المفتاح الذي تتطلبه كل طريقة وأمر `sync` الخاص بها.
استخدمها **داخل** خطوة "Sync translations" في سير العمل أعلاه: استبدل `env` الخاص بها، وضع الرايات الموضحة (`--method openai`، ...) في سطر `SYNC_FLAGS` الخاص بسير العمل — حتى يقوم فحص التشغيل التجريبي باختبار الطريقة نفسها — واحتفظ ببقية الخطوة (`id: sync` والأسطر التي تسجل رمز الخروج)، بحيث يظل التشغيل الجزئي يثبت ما قام بترجمته ويحفظ التخزين المؤقت.

## طريقة Google Translate

إذا كنت تستخدم طريقة Google Translate المدمجة بدلاً من OpenRouter:

```yaml
- name: Sync translations
  env:
    GOOGLE_TRANSLATE_API_KEY: ${{ secrets.GOOGLE_TRANSLATE_API_KEY }}
  run: npx --yes champollion@0.5 sync
```

## مزودو LLM المباشرون

إذا كنت تستخدم الطرق `openai`، أو `anthropic`، أو `gemini` مباشرة:

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

## Remote Translation API (واجهة برمجة تطبيقات الترجمة عن بُعد)

إذا كنت تستخدم نقطة نهاية ترجمة عن بُعد (مثل خدمة ترجمة مستضافة):

```yaml
- name: Sync translations
  env:
    CHAMPOLLION_API_KEY: ${{ secrets.CHAMPOLLION_API_KEY }}
  run: npx --yes champollion@0.5 sync
```

## بوابة تحقق قبل النشر

لإفشال عملية البناء عند وجود أي ملف لغة غير مكتمل أو تالف، دون ترجمة أي شيء، شغّل عمليات التحقق بشكل مستقل.

:::warning[شغّل بوابة التحقق بعد المزامنة، وليس قبلها]
إذا كانت الترجمة تعمل فقط بعد الدمج (سير العمل أعلاه)، فإن طلب السحب الذي يضيف سلسلة نصية جديدة لن يحتوي على ترجمة لها بعد، وسوف يُفشل `audit`/`verify` كل طلب سحب من هذا القبيل. شغّل بوابة التحقق حيث توجد الترجمات بالفعل: على `main` بعد مهمة المزامنة (`needs: sync`، أو `on: workflow_run` لسير عمل المزامنة). لا ينطلق مشغل `push` عند عمليات التثبيت الخاصة ببوت المزامنة نفسه — حيث يتم دفعها باستخدام `GITHUB_TOKEN`، والذي لا يبدأ أي سير عمل (انظر أعلاه). في طلبات السحب، شغّل `lint` فقط، أو شغّل مهمة المزامنة على فرع طلب السحب أولاً.
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

| الفحص | الأمر | يفشل عندما |
|-------|---------|------------|
| **التدقيق اللغوي (Lint)** | `lint` | يحتوي الكود المصدري على سلاسل نصية غير موجودة في ملف اللغة — أو لم يعثر على ملفات مصدرية لفحصها (يذكر المجلدات التي بحث فيها؛ وجهه إلى مكان آخر باستخدام `--src <dir>`) |
| **المراجعة (Audit)** | `audit` | يكون هناك مفتاح مفقود، أو فارغ، أو لا يزال يعتمد على بديل احتياطي (fallback) من `[EN]` — أو تكون الترجمة **قديمة**: تم إنشاؤها من نص مصدري أقدم من النص الحالي (تعديل في المصدر فشلت إعادة ترجمته) — أو تفتقر رسالة الجمع إلى صيغة تستخدمها اللغة للأعداد الشائعة (مثل `few`/`many` في الروسية؛ وهي المدخلات التي يفشل `verify --strict` بسببها)، مع ذكر الأمر لإعادة طلبها |
| **التحقق (Verify)** | `verify` | تتسبب الترجمة في إتلاف عنصر نائب، أو صيغة جمع ICU، أو بنية ترميز (وسم تم فتحه أو إغلاقه أو تضمينه بشكل مختلف) أو نص برمجي (script) — أو يكون هناك مفتاح مفقود — أو يحل نص واحد محل عدة سلاسل مصدرية مختلفة (نموذج يكرر جملة محفوظة) — أو لم يعثر على شيء ليفحصه (الملف المصدري أو مجلد ملفات اللغات ليس في المسار المحدد في الإعدادات) |
| **التحقق الصارم (Verify, strict)** | `verify --strict` | يحدث أي مما سبق، أو أي تحذير |

يخرج `verify` بالرمز `1` عند حدوث أي خطأ، وبالرمز `0` في الحالات الأخرى. تُطبع التحذيرات ولكنها لا تُفشل المهمة: مثل تكرار المصدر (source echo)، أو لغتين بنص متطابق، أو ترجمة قديمة، أو ترجمة أسقطت علامة الإغلاق `?` أو `!` الخاصة بالمصدر (تحدد بعض اللغات السؤال باستخدام أداة بدلاً من ذلك)، وتحذيرات الجمع الموضحة أدناه. كتابة نص واحد لعدة سلاسل مصدرية مختلفة يُعد خطأً: سلسلتان متعددتا الكلمات ومختلفتان تماماً تمت الإجابة عنهما بالنص نفسه المكون من أربع كلمات أو أكثر، أو ثلاث كلمات أو أكثر في الحالات الأخرى. يُحتسب هذا عبر قيم المفاتيح، وكل فرع جمع، وصفحات Markdown الخاصة باللغة، وفقاً للقاعدة التي ترفض بها بوابة `sync` ذلك. يحول `verify --strict` كل تحذير إلى حالة فشل. استخدمه عندما يكون من الضروري، مثلاً، منع النشر بسبب صيغ جمع روسية أغفلها النموذج. وتُعد الترجمات القديمة تحذيراً في `verify` (فالبنية سليمة) وفشلاً في `audit` (بوابة الاكتمال)، والتي تطبع الأمر الذي يعيد ترجمتها.

تعتمد نتائج فحص صيغ الجمع على كيفية تخزين التنسيق لصيغ الجمع:

| التنسيق | خطأ (يخرج `verify` بالرمز 1) | تحذير (يفشل فقط مع `--strict`) |
|--------|--------------------------|--------------------------------------|
| مفاتيح i18next ذات اللواحق (`count_one`، `count_other`، ...) | صيغة تحتاجها اللغة مفقودة (`count_many` في الفرنسية): يُعد هذا مفتاحاً مفقوداً. | مفتاح لصيغة لا تستخدمها اللغة (`count_two` في الفرنسية أو الإسبانية). يطبع `verify` الأمر الذي يزيل هذه المفاتيح تحديداً، `sync --prune plural-extras`؛ ولا تحذفها المزامنة تلقائياً دونه. |
| رسائل ICU (`{count, plural, …}` في next-intl، وARB، وi18next ICU) | بنية الجمع تالفة (متغير مترجم، أو كلمة مفتاحية، أو محدد selector، أو فقدان `#`). | فرع تستخدمه اللغة للأعداد الشائعة مفقود (`few`، `many` في الروسية). لا يتم الإبلاغ عن صيغة مفقودة لا تُستخدم إلا للأعداد الكبيرة (`many` في الفرنسية، للعدد 1 000 000). |
| gettext (`msgid_plural`) | مدخلة بلا ترجمة (فارغة أو `fuzzy`): يُعد هذا مفتاحاً مفقوداً. | صيغ `msgstr[]` تكرر صيغة `other` في حين أن اللغة تمتلك صيغتها الخاصة للأعداد الشائعة (مميّزة بتعليق `# champollion:`). وجود أسطر `msgstr[]` أكثر من `nplurals` الخاص بالفهرس. يتم حساب صيغ الجمع بناءً على ترويسة `Plural-Forms` الخاصة بالفهرس نفسه. |

يمكن لصيغة i18next مترجمة من نص صيغة أخرى أن تحتفظ بنص تلك الصيغة تماماً (`count_many` في الفرنسية مساوٍ لـ `count_other`). قد تُكتب الصيغتان بالشكل نفسه في الفرنسية، لذا لا يُعد هذا تحذيراً أبداً. عندما تطلب المزامنة صيغة ما من النموذج، فإنها تسجل ذلك في `.champollion.lock` مع بصمة للإجابة. يقرأ `verify` هذا السجل فقط، بحيث يحصل كل استنساخ (clone) للتثبيت على النتيجة نفسها. ولا يمكن أن يختلف التخزين المؤقت على حاسوبك المحمول عن بيئة تشغيل CI جديدة. وأي قيمة ليس لها سجل (كُتبت يدوياً، أو بأداة أخرى، أو بمحرك ترجمة آلية لا يمكن إخباره بالصيغة، أو بإصدار أقدم) تتلقى سطر معلومات يحتوي على الأمر الذي يعيد طلبها. ولا يفشل `--strict` بسبب ذلك.
يتحقق أمر Verify من البنية وليس من المعنى: فالنجاح يعني أن المفاتيح، والعناصر النائبة، وصيغ الجمع، وبنية الترميز، والنص البرمجي سليمة، وليس أن النص يؤدي المعنى الصحيح.

---

## انظر أيضًا

- [مرجع واجهة سطر الأوامر (CLI)](/docs/reference/cli) — مرجع كامل للأوامر
- [كيف تعمل المزامنة](/docs/concepts/how-sync-works) — فهم المزامنة التزايدية
- [ذاكرة الترجمة](/docs/concepts/translation-memory) — التخزين المؤقت وتوفير التكاليف
- [طرق الترجمة](/docs/guides/translation-methods) — اختيار الطريقة لكل زوج لغوي
- [بوابة الجودة](/docs/concepts/quality-gate) — ماذا يحدث عند فشل الترجمات
- [الإعدادات](/docs/getting-started/configuration) — مرجع ملف الإعدادات
