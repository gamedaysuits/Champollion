---
sidebar_position: 3
title: "CI/CD"
---

# تكامل CI/CD

أتمتة الترجمات في مسار البناء الخاص بك.

أداة سطر أوامر champollion متاحة المصدر بموجب [PolyForm Noncommercial License 1.0.0](https://github.com/gamedaysuits/Champollion/blob/main/cli/LICENSE): مجانية للاستخدام والتعديل والمشاركة للأغراض غير التجارية. ولا يغطي هذا الترخيص استخدامها لأغراض تجارية ([من يجوز له استخدام هذه الأداة](/docs/getting-started/who-may-use-this)).

## GitHub Actions: إبقاء الترجمات متزامنة

سير عمل كامل: ترجمة ما تغير، والتحقق من النتيجة، وإيداعها (commit)
مجدداً. ويعمل مع أي مشروع — سواء كان يعتمد على Node أم لا (Django، وFlutter، وHugo).

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

**سبب تصميم سير العمل بهذه الطريقة.** يحفظ `actions/cache` بمفرده ذاكرة
التخزين المؤقت فقط عندما تنجح المهمة بالكامل، ويخرج `sync` برمز `2` كلما تم
رفض أي مفتاح — لذا كان التشغيل الجزئي يتخطى كلاً من الإيداع وحفظ التخزين المؤقت،
وكان التشغيل التالي يدفع تكلفة الترجمات نفسها مرة أخرى. هنا يُستعاد التخزين
المؤقت ويُحفظ كخطوتين (`actions/cache/restore`، ثم
`actions/cache/save` مع `if: always()`)، وتسجل خطوة المزامنة رمز الخروج الخاص بها
بدلاً من الفشل عند `2`، وتُودع الملفات المترجمة، وعندها فقط
تفشل المهمة — في خطوة خاصة بها، قبل `verify`، حتى توضح الخطوة الفاشلة
السبب (توقف بسبب `--max-cost`، أو مفاتيح لم تتمكن المزامنة من ترجمتها) بدلاً من أن
يذكر `verify` مفتاحاً مفقوداً. الخطوة الأخيرة هي `verify --strict`: يخرج
`verify` العادي برمز 0 عند التحذيرات (من بينها صيغة جمع إضافية أو مفقودة)،
ويُفشل `--strict` المهمة عند وجودها. يتم تذكر المفتاح الذي رفضته بوابة الجودة: فلا يرسله
التشغيل التالي إلى النموذج نفسه مجدداً (إذ سيحاسب على الإجابة نفسها) —
ويذكر سجل المزامنة اسمه وأمر `--redo keys:` الذي يعيد الطلب.

**نسخة تخزين مؤقت واحدة لكل تغيير، وليس لكل تشغيل.** تعيد خطوة الاستعادة أحدث
تخزين مؤقت للفرع (مفتاحه الدقيق، `…-newest`، لا يُحفظ أبداً، لذا
يختار `restore-keys` الأحدث). وتعتمد خطوة الحفظ مفتاحاً للتخزين المؤقت مبنياً على
تجزئة (hash) لملفاته الخاصة (`hashFiles('.champollion/**')`): التشغيل الذي ترجم
شيئاً ما — حتى التشغيل الجزئي، أو التشغيل الذي فشل دفعه — يغير التخزين المؤقت،
لذا يحصل على مفتاح جديد ويُحفظ؛ والتشغيل الذي لم يضف شيئاً (لا يوجد شيء
للترجمة، أو تم أخذ كل شيء من التخزين المؤقت، أو توقف عند `--max-cost`) يحتفظ بالمفتاح الذي
استعاده، لذا يتم تخطي الحفظ ولا تُخزّن نسخة جديدة. كان ربط المفتاح بمعرّف
التشغيل يحفظ نسخة كاملة في كل تشغيل؛ وكان ربطه بملف القفل وملفات المصدر
سيستعيد نسخة أقدم عبر المطابقة الدقيقة بعد تشغيل رُفض دفعه،
لأن ملف القفل المودَع لم يتلقَّ تغييرات ذلك التشغيل أبداً.

في مشروع Node يمكنك إضافة `champollion` كتبعية تطوير (dev dependency) واستدعاء
`npx champollion sync` بدلاً من ذلك؛ يعمل `champollion@0.6` المثبت أعلاه في أي
مستودع ولا يلتقط إصداراً مختلفاً على حين غرة. ويجب على المهمة
حينئذٍ تثبيته: في بيئة تشغيل (runner) جديدة، يجلب أمر `npx champollion` عند عدم وجود أي شيء مثبت
أحدث إصدار، وليس الإصدار المثبت في ملف القفل الخاص بك. ويكتب التثبيت
`node_modules/`، الذي يودعه `git add --all` ما لم يُدرجه ملف `.gitignore` الخاص بك
(الملف الذي ينشئه `champollion init` يدرج فقط `.champollion/`)، لذا
قم بتجهيز (stage) ملفات اللغات وملف القفل بالاسم، كما يفعل سير عمل Django أدناه:

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

**أودع ملفات القفل.** يسجل `.champollion.lock` و`.champollion-content.lock`
النص المصدري الذي أُنشئت منه كل ترجمة. وهما الوسيلة التي يعرف بها
التشغيل التالي أن هناك نصاً قد تغير. ولا يمكن لبيئة التشغيل التي لا تراها أبداً التمييز بين
النص المعدل والنص الذي لم يُمس. **لا تودع `.champollion/`** — فهو
التخزين المؤقت الخاص بكل جهاز؛ ويضيفه `champollion init` إلى `.gitignore`.

يوقف **`--max-cost`** التشغيل قبل أن ينفق أكثر مما تتوقع؛ اضبطه على
تكلفة التغييرات في يوم عادي بالنسبة لك. وعندما يوقف التشغيل، لا يكون قد تم
ترجمة أو كتابة أي شيء وتخرج المزامنة برمز `2`: لا يوجد شيء لإيداعه،
وتُفشل خطوة "Stop when the sync was partial" المهمة، معلنةً ذلك. الطريقة التي ليس لها سعر معلن (نقطة نهاية مستضافة ذاتياً
على جهاز آخر) لا يمكن تقدير تكلفتها، لذا يتوقف `--max-cost`
كلما وجد شيء لترجمته — اترك هذا الخيار معطلاً لتلك الطرق. ويُسعّر النموذج
المقدَّم على بيئة التشغيل نفسها (`local` عند `localhost`/`127.0.0.1`)
بتكلفة API تبلغ 0 دولار.

**عمليات الدفع التي تغير نصاً مصدرياً هي فقط التي تبدأ المهمة.** يسرد مرشح `paths:`
ملفات لغة المصدر الخاصة بك و`champollion.config.json`: أي عملية دفع
تغير الكود فقط، أو الترجمات وملفات القفل فقط، ليس لديها ما
تترجمه، وبالتالي لا تبدأ أي مهمة. عدّل مسارَي ملفات اللغات ليطابقا الملفات المسماة في
إعداداتك (`messages/en.json`، `lib/l10n/app_en.arb`، ...)؛ وأضف مجلد
`contentDir` عندما تترجم المزامنة ملفات Markdown أيضاً. ويظل خيار **Run workflow** (المُشغّل
`workflow_dispatch`) يُشغّله يدوياً.

**إيداع المهمة نفسه لا يبدأ تشغيلها مجدداً على الإطلاق** — ومرشح `paths:` ليس
هو ما يمنع ذلك. تدفع خطوة الإيداع باستخدام `GITHUB_TOKEN` الخاص بسير العمل،
وعملية الدفع المنفذة باستخدام `GITHUB_TOKEN` لا تُطلق تشغيل سير العمل أبداً (قاعدة
من GitHub، لكي لا يتمكن سير العمل من بدء تشغيل نفسه). لهذا السبب يمكن لسير عمل Django
أدناه مراقبة `locale/**`، الذي يغيره كل إيداع للبوت.
إذا دفعت باستخدام رمز وصول شخصي (personal access token) أو رمز تطبيق GitHub بدلاً من ذلك (لتشغيل
سير عمل آخر بناءً على إيداع البوت مثلاً)، فإن عملية الدفع تلك ستبدأ سير
العمل هذا مجدداً؛ وعندئذٍ يكون مرشح `paths:` هو الفيصل. يستثني المرشح أعلاه
الملفات المترجمة وملفات القفل، فلا يبدأ إيداع البوت
أي تشغيل. أما `locale/**` في مرشح Django فيشمل الفهارس التي يودعها
البوت، لذا يبدأ كل إيداع منه تشغيلاً إضافياً — لا يجد شيئاً
لترجمته ولا يودع شيئاً. مع مثل هذا الرمز، ضيّق النطاق إلى فهرس
المصدر (`locale/en/**`) وأضف اللغات عبر ملف الإعداد.

**مفتاح المزود مطلوب في كل تشغيل يبدأ**، حتى وإن لم يكن هناك شيء
يحتاج إلى ترجمة: تتحقق المزامنة من إمكانية تشغيل الطريقة قبل أن تنظر فيما
تغير. والتشغيل الذي يبدأ يدوياً دون أي تغيير في المصدر سيظل يفشل دون
سر `OPENROUTER_API_KEY` (أو مفتاح طريقتك). لا يحتاج `local` إلى مفتاح، لكن
بيئة التشغيل تفتقر إلى خادم نماذج: فالمشروع الذي يترجم باستخدام `local` على
جهاز المطور يحدد طريقة مستضافة في CI (`--method` / `--model` — سطر
`SYNC_FLAGS` المعلق في سير العمل أعلاه). وللتحقق من وصول السر
إلى الخطوة، دون ترجمة أي شيء، يحذر `sync --dry` عندما يتوقع توقف
التشغيل الفعلي ويذكر المتغير المفقود (ولا يزال يخرج برمز 0 — فالتشغيل التجريبي مجرد معاينة). وهو يتحقق من أن المتغير **معيّن**، وليس من أن المفتاح
**يعمل**: فهو لا يرسل أي شيء، لذا فإن أي قيمة غير فارغة تُقبل — حتى لو كانت نصاً نائباً.
ويظهر المفتاح الخاطئ أو الملغى عند أول طلب في التشغيل الفعلي (يذكر الخطأ
استجابة المزود، مثل HTTP 401). لإفشال المهمة عند فقدان المفتاح
قبل تشغيل أي شيء، أضف [الفحص قبل المزامنة](#check-before-sync).

**يُحتفظ بالتخزين المؤقت لكل طريقة على حدة.** تُخزّن الترجمة مؤقتاً ضمن الطريقة،
ومستوى الخطاب (register)، وملف التوجيه (coaching) الذي أنتجها (ويعيد نموذج مختلف من
الطريقة نفسها استخدامها — ترحيل النموذج model carry-over). وبالتالي، لا يتشارك المطور الذي يترجم باستخدام `local`
وCI الذي يترجم بنموذج مستضاف مدخلات التخزين المؤقت أبداً —
كما أن التخزين المؤقت لـ CI منفصل بذاته على أي حال (`.champollion/` لا يُودَع). ولا
يعني هذا أن CI يعيد ترجمة المشروع: فما هو موجود بالفعل في ملفات اللغات،
مع إيداع ملف القفل الخاص به، يُعد منجزاً. ويدفع CI للنموذج المستضاف مقابل
النصوص الجديدة أو المعدلة منذ آخر إيداع — بما في ذلك أي نصوص ترجمها
المطور محلياً ولكن لم يودعها — ولا يدفع شيئاً للباقي.
وإعادة ترجمة المشروع بالكامل باستخدام النموذج المستضاف (`--redo all`) تحسب
تكلفة كل نص مرة واحدة.

**وفق جدول زمني** بدلاً من الدفع: استبدل كتلة `on:` بـ
`schedule: [{ cron: '0 6 * * *' }]`.

### الفحص قبل المزامنة: إفشال المهمة مبكراً {#check-before-sync}

يخرج التشغيل التجريبي برمز `0` أياً كان ما يجده — فهو مجرد معاينة — لذا فإن `sync --dry
--max-cost 5` يحذر من أن التشغيل الفعلي سيتوقف عند الحد الأقصى ومع ذلك ينجح
كخطوة في CI. ولإفشال المهمة عندما يتوقف التشغيل الفعلي (مفتاح مفقود، أو
`--max-cost`)، اقرأ ملخص `sync --dry --json`. وهذا الناتج عبارة عن
كائن JSON واحد لكل سطر (NDJSON)، كل كائن يحتوي على `level` — أسطر `info` و`ok` و`event`
على stdout، وأسطر `warn` و`error` على stderr — وآخر
سطر في stdout هو الملخص، `{"level": "summary", "command": "sync", …}`.
حدده بناءً على مستواه. **شغّله بالخيارات نفسها المستخدمة مع المزامنة**: فبدونها
يفحص الطريقة المحددة في ملف الإعداد؛ لذا بالنسبة لمشروع تنص إعداداته
على `local`، سيفحص الطريقة المحلية — وليس النموذج المستضاف الذي تشغله
المهمة — وينجح على بيئة تشغيل لا تحتوي على مفتاح. وكخطوة في سير العمل أعلاه،
قبل "Sync translations"، يقرأ نفس `SYNC_FLAGS`:

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

أو في سطر الأوامر (shell)، مع كتابة الخيارات بالكامل — وهي نفس الخيارات المستخدمة في سطر المزامنة:

```bash
SYNC_FLAGS="--method llm --model google/gemini-3.8-flash --max-cost 5"
out=$(npx --yes champollion@0.6 sync --dry $SYNC_FLAGS --json)
printf '%s\n' "$out" | jq -e 'select(.level == "summary") | .preflight.ready and (.maxCost.wouldStop | not)' > /dev/null \
  || printf '%s\n' "$out" | jq -r 'select(.level == "summary") | .error // "A real sync would exit \(.realRun.exitCode): \(.realRun.reasons | join("; "))"'
```

تكون قيمة `preflight.ready` هي `false` عندما يكون المفتاح الذي تحتاجه الطريقة مفقوداً (غير معيّن أو
فارغ — وليس عندما يكون خاطئاً)، سواء كان هناك شيء يحتاج إلى ترجمة أم لا:
فالطريقة المستضافة لا تكون جاهزة أبداً دون مفتاحها. وتكون قيمة `maxCost.wouldStop` (الموجودة مع
`--max-cost`) هي `true` عندما يتوقف التشغيل الفعلي عند الحد الأقصى. ويخرج `jq -e` برمز
1 في أي من الحالتين، ثم تطبع الخطوة السبب في سجل المهمة — على سبيل المثال
`A real sync would exit 1: it would stop before translating: No OpenRouter API
key (OPENROUTER_API_KEY) for en:fr`, or `A real sync would exit 2: --max-cost
would stop it before any API call (Estimated translation cost exceeds the
--max-cost cap: estimate ~$7.1200, cap $5.0000)`. وعندما لا تتمكن المزامنة من العمل
على الإطلاق (بسبب إعداد تالف)، تطبع الخطوة قيمة `error` الخاصة بالملخص بدلاً من ذلك. ولا ترسل
الخطوة stderr إلى `/dev/null`، لذا تظل التحذيرات في السجل أيضاً.
ويوضح `realRun.exitCode` في الملخص رمز الخروج المتوقع للتشغيل
الفعلي، بقدر ما تكشفه المعاينة: `1` عندما يوقفه الفحص الأولي، و`2`
عندما يوقفه `--max-cost`، أو عندما ينتهي بشكل جزئي — مفاتيح محجوبة، أو
رسائل جمع على القرص تفتقر إلى صيغة تستخدمها اللغة (ويوضح `realRun.reasons`
أيها المعني). والرفض من قِبل بوابة الجودة، الذي لا يكشفه إلا التشغيل الفعلي، يمكنه
مع ذلك تحويل `0` إلى `2`. ولإفشال الفحص عند توقع تشغيل جزئي أيضاً،
ضع `.realRun.exitCode == 0` مكان `.preflight.ready and (.maxCost.wouldStop | not)`.

### فرع رئيسي محمي: اقتراح طلب سحب (pull request)

يدفع سير العمل أعلاه الترجمات مباشرة إلى `main`. وإذا كان `main`
محمياً (يتطلب مراجعات أو فحوصات حالة)، فسيتم رفض هذا الدفع — بعد
تشغيل المزامنة، أي بعد أن تكون الترجمات قد دُفعت تكلفتها بالفعل. ولن يُدفع
مقابلها مرة أخرى: إذ يُحفظ التخزين المؤقت قبل خطوة الإيداع، حتى عند فشل خطوة ما،
وبالتالي فإن إعادة تشغيل المهمة أو عملية الدفع التالية (كل منهما يستعيد أحدث
تخزين مؤقت للفرع، عبر `restore-keys`) يقدم الترجمات من التخزين المؤقت. لم
تصل ملفات القفل إلى `main` أبداً، لذا يجد التشغيل التالي النصوص نفسها
معدلة ويكتبها مجدداً — من التخزين المؤقت، دون أي تكلفة.

في فرع `main` محمي، قم بالإيداع في فرع يملكه البوت وافتح (أو حدّث)
طلب سحب (pull request) بدلاً من ذلك. احتفظ بسير العمل أعلاه وغيّر أمرين:
الأذونات، وخطوة الإيداع.

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

**متى تستخدم كل خيار.** ادفع إلى `main` عندما يُسمح لسير العمل بالدفع هناك: دون
حماية للفرع، أو بوجود قاعدة تسمح لـ GitHub Actions بتجاوزها. وافتح طلب
سحب عندما يكون `main` محمياً، أو عندما يتعين على شخص — متحدث باللغة
— قراءة الترجمات قبل شحنها وإطلاقها.

- الفرع يخص البوت. وإلى أن يُدمج طلب السحب، لن تحتوي ملفات قفل
  `main` على ترجماته، لذا يقترح كل تشغيل المجموعة الكاملة
  مجدداً — من التخزين المؤقت، بحيث لا تُحسب التكلفة إلا للنصوص التي تغيرت منذ ذلك الحين. تُستبدل التعديلات
  المدفوعة إلى ذلك الفرع في التشغيل التالي: راجع في طلب
  السحب، ثم ادمج، ثم عدّل على `main` (إذ تحافظ إعادة المعالجة الشاملة لاحقاً على تعديل
  الإنسان).
- يجب أن يسمح المستودع لـ Actions بفتح طلبات السحب: Settings ← Actions ←
  General ← "Allow GitHub Actions to create and approve pull requests".
- لا يبدأ طلب السحب المفتوح باستخدام `GITHUB_TOKEN` الخاص بسير العمل أي سير
  عمل آخر، وبالتالي لا تعمل فحوصات الحالة المطلوبة عليه أبداً. وإذا كان `main`
  يتطلبها، فافتحه باستخدام رمز تطبيق GitHub أو رمز دقيق الصلاحيات محفوظ
  كسر (`GH_TOKEN: ${{ secrets.<name> }}`)، أو استخدم إجراءً (action) مثل
  `peter-evans/create-pull-request`، الذي يودع التغييرات ويحدث الفرع
  ويعدل طلب السحب المفتوح نيابة عنك (مرر له الرمز بالطريقة نفسها).

### gettext (Django وBabel) وFlutter

تترجم المزامنة الفهارس الموجودة؛ ولا تستخرج النصوص من
كودك. يقوم مشروع Django بتحديث الفهارس قبل خطوة المزامنة،
ويتحقق من تصريفها (compile) بعدها، ولا يودع سوى الفهارس فقط.

يستورد كل من `makemessages` و`compilemessages` إعداداتك، لذا تحدد المهمة
ما يحتاجان إليه مرة واحدة لجميع الخطوات: أي متغير تقرأه وحدة الإعدادات
عند الاستيراد (`SECRET_KEY`، `DATABASE_URL`، ...). ولا يتعامل أي من الأمرين مع
قاعدة البيانات، لذا تكفي قيمة نائبة لتلك المتغيرات. يُترك `DJANGO_SETTINGS_MODULE`
مُعلّقاً: فملف `manage.py` الذي يكتبه `startproject` يضبطه
بنفسه، وأي قيمة تُحدد في المهمة تتجاوز تلك القيمة — وقد يؤدي اسم الوحدة الخاطئ
إلى تعطل `makemessages`. لا تضبطه إلا إذا كان `manage.py` الخاص بك لا يضبطه.

يختلف مرشح `paths:` الخاص به عن سير العمل أعلاه: توجد النصوص المصدرية في
كود Python والقوالب الخاصة بك، ويستخرجها `makemessages` في المهمة، لذا
يمكن لأي تغيير في الكود أن يأتي بنص جديد. ضيّق الأنماط لتقتصر على تطبيقاتك
(`myapp/**.py`) إذا كانت كل عملية دفع تعدل Python. كما يراقب `locale/**` أيضاً:
إذ تأتي أي لغة جديدة كمجلد فهرس جديد (`makemessages -l <code>`). يغير
إيداع البوت نفسه تلك الفهارس لكنه لا يبدأ أي تشغيل، لأنه
يُدفع باستخدام `GITHUB_TOKEN` (انظر **إيداع المهمة نفسه لا يبدأ تشغيلها مجدداً على الإطلاق**
أعلاه — وما يجب تضييقه عند الدفع برمز آخر).

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

يحدث `--all` كل فهرس موجود بالفعل؛ أضف لغة باستخدام
`makemessages -l <code>` لمرة واحدة (أو `champollion init --langs <code>`).
يعمل `makemessages` مرة واحدة لكل نطاق (domain): `django` لـ Python والقوالب،
و`djangojs` (`-d djangojs`) لـ JavaScript. وتترجم المزامنة فهرس
كل نطاق تجده. وتشغل الخطوة الأخيرة `verify --strict`. ومدخلة الجمع الروسية
التي تفتقر ترجمتها إلى صيغة `few` أو `many` تُكتب مع صيغة `other`
وتُعلّم بأنها `# champollion:`. تخرج كل مزامنة برمز `2` طالما توجد مثل هذه المدخلة
في الفهرس — العملية التي كتبتها وكل عملية تليها، تماماً كما هو الحال مع المفتاح
المحجوب — ويذكر ملخصها المدخلة والأمر الذي يطلبها مجدداً؛ ثم
يفيد سطر التحقق بعد المزامنة بأن التشغيل غير مكتمل بدلاً من `[OK]`.
لذا تُفشل خطوة "Stop when the sync was partial" المهمة بعد الإيداع
إلى أن تُكتب تلك الصيغ. وبشكل مستقل، يُعد هذا تحذيراً: يخرج `verify`
العادي برمز 0 عنده، بينما يفشل `--strict`. ويعدّ `audit` المدخلات نفسها
غير مكتملة.

يشغل `compilemessages` أمر `msgfmt --check-format`، الذي يتحقق أيضاً من احتفاظ كل
`%(name)s` بنوعه — ولكن فقط في المدخلات الموسومة بـ `#, python-format`.
يضيف `makemessages` هذه العلامة إلى المدخلات التي يستخرجها متضمنةً عنصر
نائب `%`؛ أما الفهرس المُنشأ يدوياً فقد يفتقر إليها، وعندئذٍ لا تُفحص
مدخلاته. يقارن أمر `champollion
verify` العناصر النائبة بصيغة printf (الاسم وحرف النوع) في كل مدخلة
أياً كانت علاماتها، وتحتفظ المزامنة بعلامات المدخلة المصدرية في كل مدخلة
تترجمها. تقوم خطوة الإيداع بتجهيز (stage) `*.po` و`.champollion.lock`
بالاسم (وسجل التعديلات المستبدلة عند وجوده)؛
وإذا كان مشروعك يتتبع ملفات `.mo` بالفعل، فأضف `'*.mo'` إليها. وتوجد
خطوات التخزين المؤقت، ورمز الخروج المسجل، و`git pull --rebase`
للأسباب نفسها المذكورة في سير العمل أعلاه. وبالنسبة لـ Babel: استخدم `pybabel extract` + `pybabel update --no-wrap` قبل
المزامنة، و`pybabel compile` بعدها.

لا يحتاج Flutter إلى أي خطوة إضافية في هذه المهمة: تكتب المزامنة ملفات
`app_<locale>.arb`، وأمر `flutter gen-l10n` (أو `flutter build`، الذي يشغله) هو خطوة
البناء الخاصة بتطبيقك، حيث يحولها إلى Dart.

#### صيغ الجمع التي أغفلها النموذج {#plural-gaps}

المدخلة المعلّمة ليست ترجمة، لذا لا تتركها المزامنة لشخص
بمفرده:

- **تطلب طريقة أو نموذج آخر المدخلة مجدداً تلقائياً.** أي مزامنة لم يجب إعدادها
  (الطريقة، والنموذج، ومستوى الخطاب، والتوجيه) على تلك المدخلة بعد، ترسلها
  إلى النموذج مجدداً — وليس إلى التخزين المؤقت الذي يحتوي على الإجابة
  غير المكتملة. لذلك، عندما يُغفل النموذج المحلي للمطور هذه الصيغ، فإن النموذج
  المستضاف في المهمة (`SYNC_FLAGS`) يطلبها في تشغيله التالي، ويحدد التقدير
  تكلفتها. ويسجل ملف القفل (`.champollion.lock`، تحت `gaps`) كل إعداد
  أجاب دون الصيغ المطلوبة، حتى لا يتناوب التشغيل المحلي وتشغيل CI
  على دفع تكلفة الإجابة غير المكتملة نفسها.
- **يطلب `sync --redo gaps` كل مدخلة من هذا النوع**، أياً كان من أغفلها — في مسارات
  العمل أعلاه، ضع علامة اختيار بجوار `redo_gaps` ضمن **Run workflow**. وأضف `--model` إلى
  `SYNC_FLAGS` لاستخدام نموذج أقوى.
- **إذا كانت الإجابة الجديدة تفتقر إلى الصيغ أيضاً، تظل المدخلة معلّمة** ويخرج
  التشغيل برمز `2`، كما في السابق. وعندئذٍ، اكتب الصيغ يدوياً واحذف
  سطر `# champollion:`.

يذكر التشغيل التجريبي (`sync --dry`) المدخلات التي سيطلبها مجدداً ويسعّر
تكلفتها؛ ويحصي ملخص `--json` الخاص به المدخلات التي لن يطلبها (`totalPluralGaps`)
ويوضح أن التشغيل الفعلي سيخرج برمز `2` بسببها (`realRun.exitCode`).

## طرق أخرى

توضح المقتطفات البرمجية أدناه المفتاح الذي تحتاجه كل طريقة وأمر `sync` الخاص بها.
استخدمها **داخل** خطوة "Sync translations" في سير العمل أعلاه: بدّل
`env` الخاص بها، وضع الخيارات الموضحة (`--method openai`، ...) في سطر
`SYNC_FLAGS` الخاص بسير العمل — حتى يجري فحص التشغيل التجريبي الطريقة نفسها — واحتفظ
ببقية الخطوة (`id: sync` والأسطر التي تسجل رمز الخروج)، حتى يتمكن التشغيل
الجزئي من إيداع ما ترجمه وحفظ التخزين المؤقت.

## طريقة Google Translate

في حال استخدام طريقة Google Translate المضمنة بدلاً من OpenRouter:

```yaml
- name: Sync translations
  env:
    GOOGLE_TRANSLATE_API_KEY: ${{ secrets.GOOGLE_TRANSLATE_API_KEY }}
  run: npx --yes champollion@0.6 sync
```

## مزودو LLM المباشرون

في حال استخدام طرق `openai` أو `anthropic` أو `gemini` مباشرة:

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

في حال استخدام نقطة نهاية ترجمة بعيدة (remote translation endpoint) (مثل خدمة ترجمة مستضافة):

```yaml
- name: Sync translations
  env:
    CHAMPOLLION_API_KEY: ${{ secrets.CHAMPOLLION_API_KEY }}
  run: npx --yes champollion@0.6 sync
```

## بوابة تحقق قبل النشر

لإفشال عملية البناء عند وجود أي لغة غير مكتملة أو تالفة، دون ترجمة
أي شيء، شغّل عمليات الفحص بمفردها.

:::warning[شغّل بوابة التحقق بعد المزامنة، وليس قبلها]
إذا كانت الترجمة تعمل فقط بعد الدمج (سير العمل أعلاه)، فإن أي طلب سحب
يضيف نصاً لن يحتوي على ترجمة له بعد، وسوف يُفشل `audit`/`verify` كل
طلب سحب من هذا النوع. شغّل بوابة التحقق حيث توجد الترجمات بالفعل: على `main` بعد
مهمة المزامنة (`needs: sync`، أو `on: workflow_run` من سير عمل المزامنة). لا
ينطلق مُشغّل `push` عند إيداعات بوت المزامنة نفسه — إذ تُدفع
باستخدام `GITHUB_TOKEN`، الذي لا يبدأ أي سير عمل (انظر أعلاه). وفي طلبات السحب،
شغّل `lint` فقط، أو شغّل مهمة المزامنة على فرع طلب السحب أولاً.
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

| الفحص | الأمر | يفشل عندما |
|-------|---------|------------|
| **Lint** | `lint` | يحتوي الكود المصدري على نصوص ليست موجودة في ملف اللغة — أو لم يعثر على أي ملفات مصدرية لفحصها (يذكر المجلدات التي بحث فيها؛ وجهه إلى موضع آخر باستخدام `--src <dir>`) |
| **Audit** | `audit` | يكون هناك مفتاح مفقود أو فارغ أو لا يزال بديلاً احتياطياً (fallback) لـ `[EN]` — أو تكون الترجمة **قديمة**: أُنشئت من نص مصدري أقدم من النص الحالي (تعديل في المصدر فشلت إعادة ترجمته) — أو تفتقر رسالة الجمع إلى صيغة تستخدمها اللغة للعد اليومي (`few`/`many` بالروسية؛ المدخلات التي يفشل `verify --strict` بسببها)، مع الأمر الذي يطلبها مجدداً |
| **Verify** | `verify` | تتلف الترجمة عنصراً نائباً، أو صيغة جمع ICU، أو وسماً (علامة تم فتحها أو إغلاقها أو تداخلها بشكل مختلف)، أو نظام كتابة — أو يكون هناك مفتاح مفقود — أو ينوب نص واحد عن عدة نصوص مصدرية مختلفة (نموذج يكرر جملة محفوظة) — أو لم يجد أي شيء ليفحصه (الملف المصدري أو مجلد اللغات ليس في المسار المحدد في الإعدادات) |
| **Verify, strict** | `verify --strict` | أي مما سبق، أو أي تحذير |

يخرج `verify` برمز `1` عند حدوث أي خطأ، وبـ `0` في الحالات الأخرى. وتُطبع التحذيرات ولكنها
لا تُفشل المهمة: تكرار المصدر (source echo)، أو لغتان بنص متطابق، أو
ترجمة قديمة، أو ترجمة أسقطت علامة `?` أو `!`
الختامية من المصدر (تميز بعض اللغات السؤال بأداة بدلاً من ذلك)،
وتحذيرات الجمع الموضحة أدناه. كتابة نص واحد لعدة نصوص مصدرية مختلفة
يُعد خطأً: سلسلتان نصيتان متعددتا الكلمات ومختلفتان بوضوح تمت الإجابة عنهما
بالنص نفسه المكون من أربع كلمات أو أكثر، أو ثلاث كلمات أو أكثر في الحالات الأخرى. ويتم احتساب ذلك
عبر قيم المفاتيح، وكل فرع جمع، وصفحات Markdown الخاصة باللغة، وفقاً للقاعدة
التي ترفض بها بوابة `sync` ذلك. يحول `verify --strict` كل تحذير إلى
فشل. استخدمه عندما يتعين مثلاً على صيغ الجمع الروسية التي أغفلها النموذج
أن تمنع النشر. وتُعد الترجمات القديمة تحذيراً في `verify` (فالبنية
سليمة) وفشلاً في `audit` (بوابة الاكتمال)، الذي
يطبع الأمر الذي يعيد ترجمتها.

تعتمد نتائج فحص صيغ الجمع على كيفية تخزين التنسيق لصيغ الجمع:

| التنسيق | خطأ (`verify` يخرج برمز 1) | تحذير (يفشل فقط مع `--strict`) |
|--------|--------------------------|--------------------------------------|
| مفاتيح i18next ذات اللاحقات (`count_one`، `count_other`، ...) | صيغة تحتاجها اللغة مفقودة (`count_many` بالفرنسية): هذا مفتاح مفقود. | مفتاح لصيغة لا تملكها اللغة (`count_two` بالفرنسية أو الإسبانية). يطبع `verify` الأمر الذي يزيل تلك المفاتيح تحديداً، `sync --prune plural-extras`؛ ولا تحذفها المزامنة أبداً بدونه. |
| رسائل ICU (`{count, plural, …}` في next-intl وARB وi18next ICU) | بنية الجمع تالفة (متغير مترجم، أو كلمة رئيسية، أو محدد، أو فقدان `#`). | فرع تستخدمه اللغة للعد اليومي مفقود (`few`، `many` بالروسية). لا يتم الإبلاغ عن صيغة مفقودة لا تُستخدم إلا للأعداد الكبيرة (`many` بالفرنسية، لـ 1 000 000). |
| gettext (`msgid_plural`) | مدخلة بدون ترجمة (فارغة أو `fuzzy`): هذا مفتاح مفقود. | صيغ `msgstr[]` تكرر صيغة `other` حيث تمتلك اللغة صيغتها الخاصة للعد اليومي (معلّمة بتعليق `# champollion:`). عدد أسطر `msgstr[]` أكثر من `nplurals` الخاص بالفهرس. يتم عد صيغ الجمع بواسطة ترويسة `Plural-Forms` الخاصة بالفهرس نفسه. |

يمكن لصيغة i18next مترجمة من نص صيغة أخرى أن تحمل نص تلك الصيغة
بالضبط (`count_many` بالفرنسية مساوٍ لـ `count_other`). وقد تكتب الفرنسية
الصيغتين بشكل متطابق، لذا لا يُعد هذا تحذيراً أبداً. وعندما تطلب المزامنة صيغة من النموذج، فإنها
تسجل ذلك في `.champollion.lock`، مع بصمة للإجابة. يقرأ `verify`
ذلك السجل فقط، لذا يحصل كل استنساخ (clone) لإيداع معين على النتيجة نفسها. ولا
يمكن لذاكرة التخزين المؤقت على حاسوبك المحمول وبيئة تشغيل CI الجديدة أن تختلفا. والقيمة التي لا تملك أي سجل
(كُتبت يدوياً، أو بواسطة أداة أخرى، أو بمحرك ترجمة آلية لا يمكن
تحديد الصيغة له، أو بإصدار أقدم) تتلقى سطر معلومات يتضمن الأمر
الذي يطلبها مجدداً. ولا يفشل `--strict` بسببها.
يفحص أمر Verify البنية وليس المعنى: واجتياز الفحص يعني أن المفاتيح، والعناصر النائبة،
وصيغ الجمع، والوسوم، ونظام الكتابة سليمة، وليس أن النص يفيد
المعنى الصحيح.

---

## انظر أيضاً

- [مرجع واجهة سطر الأوامر (CLI)](/docs/reference/cli) — مرجع الأوامر الكامل
- [كيف تعمل المزامنة](/docs/concepts/how-sync-works) — فهم المزامنة التزايدية
- [ذاكرة الترجمة](/docs/concepts/translation-memory) — التخزين المؤقت وتوفير التكاليف
- [طرق الترجمة](/docs/guides/translation-methods) — اختيار الطريقة لكل زوج لغوي
- [بوابة الجودة](/docs/concepts/quality-gate) — ما يحدث عند فشل الترجمات
- [الإعدادات](/docs/getting-started/configuration) — مرجع الإعدادات
