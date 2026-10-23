---
title: "خادم MCP — الباب الموجّه للوكلاء"
sidebar_label: "خادم MCP"
description: "وصّل وكيل ذكاء اصطناعي بـ Champollion عبر Model Context Protocol. ملفّان تعريفِيّان: يوجّه ملف rails (الافتراضي) مشروع لغة واحداً بست أدوات؛ ويقدّم --profile full‏ 34 أداة للبحث عن اللغات، وتصفح قائمة انتظار التقييم المعياري وسجل المدونات اللغوية، وتشغيل التقييمات، وتدريب النماذج وتصديرها، والترجمة — بالإضافة إلى تحديد أي منها بالضبط يتطلب أكثر من npx install."
---

# خادم MCP — الواجهة المخصصة للوكلاء

تتيح حزمة `champollion-mcp-server` استخدام Champollion لوكلاء الذكاء الاصطناعي عبر [بروتوكول سياق النموذج (Model Context Protocol)](https://modelcontextprotocol.io)، وذلك عبر stdio. وتتضمن ملفي تعريف (profiles):

| ملف التعريف | تشغيله باستخدام | ما يقدمه | مصمم لـ |
|---|---|---|---|
| **rails** (الافتراضي) | `npx -y champollion-mcp-server` | ست أدوات: `start_project`، و`project_status`، و`run_next_step`، و`add_data`، و`try_translation`، و`explain` | مرافقة مشروع لغة واحدة خطوة بخطوة من مجلد فارغ إلى نموذج مقيس على حاسوب الشخص نفسه |
| **full** | `npx -y champollion-mcp-server --profile full` (أو `CHAMPOLLION_MCP_PROFILE=full`) | 34 أداة، و3 موارد، و4 توجيهات (prompts) | الاستكشاف، والتقييم المعياري، والتدريب خطوة بخطوة، والترجمة، والشبكة |

إذا كنت تساعد شخصًا ما في بناء مترجم للغته، فاستخدم ملف التعريف rails؛ وتفاصيل تشغيله مشروحة في [تشغيل rails عبر MCP](/docs/agents/mcp)، والقواعد التي تعمل بموجبها محددة في [عقد التشغيل](/docs/agents/contract).

يمكن أيضًا الوصول إلى كل شيء هنا عبر بروتوكول HTTP العادي — راجع [نقاط النهاية المقروءة آليًا](#machine-readable-endpoints) — لكن خادم MCP هو الواجهة الوحيدة التي تتيح للوكيل *العمل الفعلي* (الترجمة، وتشغيل التقييم المعياري، وتدريب النموذج) بدلًا من مجرد القراءة.

## التثبيت

```bash
npx -y champollion-mcp-server
```

ثم سجّله مع عميلك. بالنسبة لـ Claude Code:

```bash
claude mcp add champollion -- npx -y champollion-mcp-server
```

بالنسبة للعملاء الذين يتم تكوينهم عبر ملف (Claude Desktop، وCursor، وAntigravity)، أضف ما يلي:

```json
{
  "mcpServers": {
    "champollion": {
      "command": "npx",
      "args": ["-y", "champollion-mcp-server"]
    }
  }
}
```

بالنسبة لملف التعريف full، أضف `"--profile", "full"` بعد اسم الحزمة في `args`، أو أنهِ أمر `claude mcp add` بـ `--profile full`.

## ملف التعريف rails (الافتراضي)

ترافق الأدوات الست مشروع لغة واحدة من مجلد فارغ إلى نموذج مقيس على حاسوب الشخص نفسه. تحدد كل خطوة الأداة المطلوب استدعاؤها بدقة، وتُحال كل مسألة لا يمكن لأحد غير الشخص الإجابة عنها (من يملك الملف، وهل يُسمح لنموذج بالتعلم منه، وهل يمكن لنصه مغادرة الحاسوب، وما هي توقعاته، وهل النتيجة جيدة بما يكفي) إليه مباشرة. تُبلغ الأدوات عن الأعداد والأعمدة، ولا تُظهر الجمل أبدًا. وتدير كل أداة سطر أوامر `champollion` كعملية منفصلة ومحدودة — وهي الأوامر نفسها التي يكتبها الشخص. هذا الملف مخصص للوكلاء الصغار، مع تعليمات موجزة.

| الأداة | الوسائط | ما تفعله |
|---|---|---|
| `start_project` | `folder`، و`from`، و`to`، و`target_name?`، و`source_name?`، و`purpose?`، و`parent_dir?`، و`confirmed?` | تنشئ مشروعًا (`champollion new`). الاستدعاء الأول لا ينشئ شيئًا ويعيد `ask_first`: اذكر التوجيه للشخص، ثم نفّذ الاستدعاء الذي يوفره لإجابته |
| `project_status` | `project_dir`، و`wait_seconds?` (حتى 120) | الخطوة التالية، مقروءة من الملفات (`champollion next --json`): وضعها، وما يجب قوله، والسبب، والاستدعاء الدقيق لتنفيذها |
| `run_next_step` | `project_dir`، و`step_id`، و`answers?`، و`confirmed?` | تنفّذ الخطوة التي حددتها `project_status` للتو. تتطلب خطوة `confirm` تمرير `confirmed: true` بعد موافقة الشخص؛ وتتطلب خطوة `ask_user` إجابات الشخص نفسه؛ وتُرفض خطوات `human_only` و`wait` مع توضيح ما ينبغي فعله بدلاً من ذلك |
| `add_data` | `project_dir`، و`path`، و`into?` (`parallel`، أو `test`، أو `lexicon`)، و`source_col?`، و`target_col?`، و`sheet?`، و`header?`، و`usfm_source?`، و`replace?` | تستورد ملفًا من مكانه — جدول بيانات، أو جدول Word، أو معجم Toolbox أو LIFT، أو ملف ELAN، أو نصوص USFM الدينية (`champollion data add`) — وتُبلغ عن الأعداد والأعمدة، دون الجمل إطلاقًا |
| `try_translation` | `project_dir`، و`text` (حتى 10 أسطر) | تترجم بضع جمل للشخص باستخدام النموذج الذي يوفره المشروع. بالنسبة لنموذج تعلّم من جمل محلية فقط، فإنها تعيد عنوان صفحة النموذج نفسه، ولا تعيد النص أبدًا |
| `explain` | `topic`: `rails`، أو `privacy`، أو `quality`، أو `modes`، أو `improve`، أو `off_rails` | شروحات بكلمات بسيطة لنقلها إلى المستخدم |

## ملف التعريف full

يصف كل ما يرد أدناه **ملف التعريف full** — جميع الأدوات المخصصة للاستكشاف والتقييم المعياري والشبكة:

```bash
npx -y champollion-mcp-server --profile full
```

## اقرأ هذا قبل الاعتماد عليه

**في ملف التعريف full، تعمل أربع عشرة أداة من أصل 34 أداة بمجرد تثبيت `npx` الأساسي، وتعمل `translate` بمجرد تزويدها بمحرك. أما الأدوات التسع عشرة الأخرى فتحتاج إلى حزم Python لا توفرها حزمة npm ولا يمكنها تضمينها.** وهي لا تفشل بصمت — فكل منها يعيد خطأً إجرائيًا يوضح ما ينقص — ولكن يجدر بك معرفة الهيكل العام قبل التخطيط للعمل وفقًا له.

| الأدوات | هل تعمل بعد `npx`؟ | ما تحتاجه أيضًا |
|---|---|---|
| `search_languages`، و`get_language`، و`language_overview`، و`list_corpora`، و`get_results`، و`get_run_card`، و`get_metric_reliability`، و`list_contests`، و`get_contest`، و`get_project_info`، و`list_queue`، و`get_queue_item`، و`estimate_cost`، و`get_training_guardrails` | **نعم** — للقراءة فقط، وتُقدَّم من نقاط نهاية عامة | لا شيء |
| `translate` | **نعم**، مع محرك | مفتاح API للمحرك الذي تختاره — أو دونه، باستخدام الطريقة `local` مع خادم نموذج على جهازك الشخصي |
| `run_benchmark`، و`get_run_status`، و`preview_publish`، و`publish_report` | لا | بيئة التقييم — `pipx install mt-eval-harness` |
| أدوات `forge_*` الخمس عشرة | لا | NMT Forge 0.2.0 أو أحدث — `python3 -m pip install nmt-forge` (أضف `'nmt-forge[hf]'` للتدريب والخدمة). وتتضمن بيئة التقييم وتصل إلى بطاقات اللغة تلقائيًا؛ دون الحاجة إلى نسخ المستودع |

لا حاجة لنسخ المستودع لإجراء أي من هذه العمليات.

## وظائف الأدوات

**استعراض وتكلفة العمل.** تتنقل `list_queue` و`get_queue_item` عبر قائمة انتظار التقييم المعياري المفتوحة — وهي القائمة المرتبة للقياسات التي تساهم أكثر في تحسين الخريطة. وتُحدد `estimate_cost` تكلفة مجموعة من عمليات التشغيل قبل إنفاق أي شيء.

**البحث والاستعلام.** تبحث `search_languages` في بطاقات اللغة حسب الاسم أو الرمز أو العائلة أو المنطقة، وتتسامح مع الأخطاء الإملائية. وتوضح كل نتيجة أيضًا أماكن التحدث باللغة (البلدان، ونقطة على الخريطة، والمنطقة الكبرى) وأسماءها الأخرى — فقط الحقائق الموثقة بمصدر في بطاقتها، مع ذكر ذلك المصدر، للتمييز بين اللغات ذات الأسماء المتشابهة. ولا يُعرض الموقع الجغرافي الخالي من مصدر أبدًا؛ حيث يوضح السطر ذلك ويوفر رابطًا لسجل اللغة في Glottolog بدلًا من ذلك. أما البطاقات المعبأة من جداول البطاقات المنشورة على champollion.dev (في تثبيت npm، كل لغة خارج المجموعة الأساسية المدمجة) فلا تحتوي على مصادر لكل حقل بعد — وستتوفر مع التحديث التالي للجداول — لذلك تتضمن هذه الأسطر رابط Glottolog بدلًا من الموقع الجغرافي. وتعد `language_overview` نقطة الانطلاق في صفحة واحدة للبناء للغة معينة: ما هو متاح، وما يمكن تشغيله، والخطوات التالية. وتُعيد `get_language` البطاقة الموثقة كاملة. وتدرج `list_corpora` مدونات التقييم المسجلة لزوج لغوي أو عائلة تقييم معياري — البيانات الوصفية فقط (الحجم، والترخيص، ودرجة التلوث، وما إذا كان بإمكان بيئة العمل جلبها، أو تحتاج إلى رمز وصول، أو تضعها في الحجر الصحي)؛ ولا يُعاد محتوى المدونة مطلقًا، والزوج الذي تكون جميع مدوناته في الحجر الصحي يوضح ذلك بدلًا من الظهور بمظهر غير المدعوم. وتقرأ `get_results` و`get_run_card` عمليات التشغيل المسجلة من لوحة المتصدرين العامة. وتجيب `get_metric_reliability` عن السؤال الذي يخطئ فيه معظم الوكلاء — *ما المقياس الذي ينبغي لي الوثوق به لهذه اللغة الهدف* — استنادًا إلى الارتباطات مع التقييمات البشرية لكل عائلة لغوية. وتعرض `list_contests` و`get_contest` المسابقات وشروطها المعلنة؛ والانضمام إلى أي منها هو خطوة سطر أوامر مصرح بها بشريًا، وليست أداة برمجية أبدًا.

**التنفيذ.** تمرر `translate` النص عبر المسار المختبر، مع ذاكرة الترجمة (التكرارات لا تكلف شيئًا) وبوابة جودة حتمية. وتسمي كل إجابة المحرك الذي تم تشغيله فعليًا، مع نموذجه ونقطة نهايته حيثما توفرا.
تبدأ `run_benchmark` عملية تقييم وتُعيد **معرّف المهمة فورًا**، لأن عمليات التشغيل الفعلية تتجاوز أي مهلة زمنية للعميل؛ ويمكنك الاستعلام عبر `get_run_status` باستخدام ذلك المعرّف. تظل المهمة قائمة حتى بعد إعادة تشغيل الخادم: حيث يستمر التشغيل، ويظل الاستعلام عن المعرف نفسه بعد ذلك يعيد حالته ونتائجه. لا يُنشر أي شيء ما لم تمرر `publish: true`؛ وتحدد الخطة بعد ذلك ما سيتم نشره للعامة — كل صف مع نص جملته، أو النتائج فقط؛ والمطالبة (prompt)، أو تجزئتها فقط؛ وأين — ويتطلب النشر الفعلي `publish_ack` بالكلمات الدقيقة التي تقدمها الخطة، حتى يتسنى للمستخدم رؤيتها أولًا. ويمكن نشر العملية المنفذة بدونها لاحقًا عبر البوابة نفسها. تُعد `preview_publish` للقراءة فقط: حيث تعرض معاينة النشر الخاصة ببيئة التقييم، والكلمات الدقيقة، واستدعاء `publish_report` الدقيق الذي سينشرها، ولا يمكنها النشر بذاتها. وتحمل التعليق التوضيحي لـ MCP `readOnlyHint: true`، مما يسمح لمضيف الوكيل الذي يسأل قبل كل عملية كتابة بالسماح بها تلقائيًا. وتتولى `publish_report` عملية الكتابة (معلّمة بـ `destructiveHint` و`openWorldHint`)، بينما تحجب `scores_only` نص الجملة. وتبدأ كل خطة أيضًا بحالة `EVAL PACK:` للغة الهدف — `missing` (مع الأمر الذي يثبتها)، أو `ready`، أو `none needed` — وتذكر ترخيص المدونة وشرط `do_not_train` الخاص بها، لأن التشغيل يجتاز `--yes`. لا يؤدي غياب FST (المحلل أو بيئة تشغيل pyhfst الخاصة به) إلى إيقاف التشغيل مطلقًا: فهو يستمر، وتحدد بطاقة التشغيل أن قبول FST لم يُحسب. ويؤدي أي جزء مفقود آخر إلى إيقاف التشغيل قبل البدء في الترجمة. وتقوم `skip_fst` و`skip_eval_standard` بالتقييم دون تلك الأجزاء، مع توضيح ما تم استبعاده في بطاقة التشغيل. وتوضح الخطة أيضًا ما إذا كان سيتم حساب COMET (تحسبه بيئة التقييم متى ما تم تثبيت `unbabel-comet`؛ ويجعل `comet: true` التشغيل يتطلبه إلزامًا)، وتطلب `metricx` و`fuse` أداة المقارنة الاختيارية MetricX-24 وأسلوب FUSE في بيئة التقييم. وتوضح الخطة لكل منها، وفقًا لبيئة العمل، ما إذا كان مثبتًا، وما يجب تثبيته، وما يتم تنزيله. وتُرفض عملية التشغيل المؤكدة التي تطلب مقياسًا لا تستطيع بيئة التقييم حسابه، بدلًا من تشغيلها دونه. وتحدد أسطر `Results:` و`Cache:` في الخطة مكان حفظ سجل التشغيل والتقرير ومخزن الترجمة المؤقت. أما ملف الاختبار الموجود داخل مجلد يحدده `mt-eval contest prepare` كقابل للإصدار (وهو `public/` لمسابقة) فيتم تشغيله داخل مجلد `runs/` الخاص بالمسابقة بدلًا من ذلك، لضمان عدم إصدار أي شيء يكتبه التشغيل معه. ويتم الإبلاغ عن النموذج الموجود على جهازك الخاص (خادم محلي، أو `method: "local-model"`، الذي تشغله بيئة التقييم ضمن العملية ولا يحتاج إلى تصديق) على أنه `$0 API cost (runs on this machine)`.

**التدريب دون الوقوع في الأخطاء الزائفة.** تُعيد `get_training_guardrails` القواعد المستخلصة من حالات الفشل المقيسة الحقيقية. وتدير أدوات `forge_*` الخمس عشرة أداة [NMT Forge](/docs/agents/training) خطوة بخطوة بطريقة آمنة ومحمية — `forge_status` أولًا وبعد كل خطوة (تحدد الأمر التالي والأداة التي تشغله)، و`forge_preflight` للاطلاع على البوابات التي سيعترضها الأمر قبل الرفض، و`forge_prereg_template` و`forge_prereg` لتدوين التوقعات قبل توفر أي نتيجة اختبار (وقبل أي تقييم معياري على مجموعة الاختبار: فالقراءة التي تتضمن تقييمًا تعطل التسجيل المسبق لاحقًا)، و`forge_export` لتقييم مجموعة الاختبار مرة واحدة وتحزيم النموذج المدرب، و`forge_compare` للمقارنة بين نموذجين (A/B) مع وضع تنبيه النظير المقارب لكل منهما بجوار الفائز، و`forge_prereg_verdict` لتسجيل حكم المستخدم الخاص على توقع لا تستطيع أداة forge تقييمه (نطاق نصي حر) — ويُعرض كتقييم بشري وليس حسابيًا. وتدرج `forge_status` كل عملية تدريب مع نتيجتها على مجموعة التطوير (dev score)، وتوضح وصول مجموعة التطوير إلى حالة التشبع (نتيجة كاملة لمجموعة التطوير لا تترك مجالًا للمفاضلة بين نقاط التحقق). وعندما تضع بيئة التقييم تنبيهًا على نتيجة الاختبار (على سبيل المثال مخرجات شبه ثابتة: عدد محدود جدًا من المخرجات المكررة لكل جملة مصدر)، تنقل أدوات `forge_export`، و`forge_status`، و`forge_compare`، و`forge_lint` ذلك بكلمات بيئة التقييم نفسها، وتُقدم التنبيهات الرئيسية في الخطوة التالية: ولا تُذكر النتيجة دونها إطلاقًا. ويأتي الرفض مصحوبًا ببيان الخطأ، وسبب أهميته، وكيفية إصلاحه. وتتجاوز خطوتان مدة أي استدعاء للأدوات وتعملان في الطرفية بدلًا من ذلك: التدريب (`nmt-forge run`)، وخدمة النموذج المصدر (`nmt-forge serve`، والذي يضعه خلف نقطة نهاية محلية يمكن لـ `translate` وسطر الأوامر استخدامها).

### الوسائط

تُعد `name` مطلوبة وتكون `name?` اختيارية. وتقبل كل أداة تأخذ لغة واحدة استخدام `language` أيضًا: حيث تعني عبارة "`code` أو `language`" إمكانية استخدام أي من الاسمين، مع تمرير أحدهما. وتظل الأسماء الأصلية تعمل بصورة طبيعية.

| الأداة | الوسائط |
|---|---|
| `search_languages` | `query` أو `language`، و`limit?` |
| `language_overview` | `code` أو `language`، و`source?` |
| `get_language` | `code` أو `language`، و`format?` |
| `list_corpora` | `source_language?`، و`target_language?`، و`family?` (واحد على الأقل من هذه الثلاثة)، و`include_quarantined?`، و`limit?` |
| `get_results` | `source_language?`، و`target_language?`، و`model?`، و`sort?`، و`limit?` |
| `get_run_card` | `id` |
| `get_metric_reliability` | `target` أو `language` |
| `list_contests` | `status?`، و`language?`، و`limit?` |
| `get_contest` | `id` |
| `get_project_info` | لا شيء |
| `list_queue` | `language?`، و`source_language?`، و`model?`، و`budget?`، و`condition?`، و`limit?` |
| `get_queue_item` | `id?` أو `priority?` (أحدهما) |
| `estimate_cost` | `budget?`، و`language?`، و`source_language?`، و`model?`، و`condition?` |
| `get_training_guardrails` | `topic?` |
| `translate` | `texts`، و`source_language`، و`target_language`، و`method?`، و`model?`، و`base_url?`، و`endpoint?`، و`register?`، و`project_dir?`، و`context?` (gettext msgctxt: واحد لكل نص، أو واحد لكل النصوص)، و`script?`، و`use_tm?`، و`validate?` |
| `run_benchmark` | وضع واحد: `budget?` أو `top?` (قائمة الانتظار)، أو `item_id?`، أو `corpus?` مع `model?` (مع `method_dir`، النموذج الذي يحمّله الملحق)، أو `method?` أو `method_dir?` (دليل ملحق الطريقة؛ يتطلب `local-model` استخدام `model` — فليس له إعداد افتراضي)، و`allow_model_pair_mismatch?` (`local-model`: تشغيل نموذج زوج OPUS-MT يحدد زوجًا آخر، كخط أساس للغة قريبة)، و`attest_local_transport?` (محرك MT أو ملحق؛ غير مطلوب إطلاقًا لـ `local-model`)، و`provider?`، و`base_url?`، و`target_language?`، و`script?` (عمليات تشغيل نماذج اللغة الكبيرة: نظام كتابة ISO 15924 الذي يجب كتابة المخرجات به، مثل `Cans` أو `Latn`؛ وتوضح الخطة متى تسرد بطاقة الهدف أكثر من نظام واحد)، و`source_language?`، و`source_field?`، و`target_field?`، و`max_cost?`، و`coaching_file?`، و`glossary?`، و`attest_no_training?`، و`accept_nc_terms?`، و`skip_fst?` و`skip_eval_standard?` (عمليات تشغيل العناصر والمدونات: التقييم دون FST أو مقاييس التقييم القياسية، وتُعلّم بأنها غير محسوبة)، و`comet?` (طلب COMET إلزامًا: يُرفض التشغيل إذا لم يكن مثبتًا)، و`metricx?` مع `metricx_model?`، و`fuse?` (عمليات تشغيل العناصر والمدونات: أداة المقارنة الاختيارية MetricX-24 وأسلوب FUSE في بيئة التقييم، وتُرفض في حال عدم التثبيت)؛ ثم `dry_run?`، و`confirm?`، و`publish?`، و`publish_ack?` (مع النشر الفعلي: الكلمات الدقيقة التي تطبعها الخطة)، و`anonymous?` |
| `get_run_status` | `job_id?` |
| `preview_publish` | `report` (`*_report.json` لعملية منتهية)، و`scores_only?`، و`redact_coaching?`، و`anonymous?` (للقراءة فقط: دون `confirm`، ولا يمكنها النشر) |
| `publish_report` | `report` (`*_report.json` لعملية منتهية)، و`scores_only?`، و`redact_coaching?`، و`anonymous?`، و`confirm?`، و`publish_ack?` (الكلمات الدقيقة التي تطبعها المعاينة) |
| `forge_status` | `workspace?`، و`project_dir?` |
| `forge_preflight` | `target` (الأمر المراد التحقق منه)، و`config?`، و`workspace?`، و`project_dir?` |
| `forge_discover` | `code` أو `language`، و`cards_dir?`، و`workspace?`، و`project_dir?` |
| `forge_init` | `code` أو `language`، و`dir?`، و`pair?`، و`model?`، و`base?`، و`no_card?`، و`name?`، و`cards_dir?` |
| `forge_split` | `corpus`، و`test`، و`seed`، و`out?` (الافتراضي `data/split`، المسار الذي يقرأه config.json الخاص بـ `forge_init`)، و`dev?`، و`register?` (بادئة الاسم، أو `true` لـ `project`)، و`allow_rotate?`، و`near_dupe?` (عتبة Jaccard مثل 0.6، عندما توصي أداة forge باقتطاع البيانات شبه المكررة)، و`max_group?` (مع `near_dupe`: أكبر مجموعة شبه مكررة)، و`workspace?`، و`project_dir?` |
| `forge_leak_audit` | `corpus`، و`strict?`، و`clean_to?`، و`drop_test_twins?` (مع `clean_to` الخاص به، مثل `corpus.notwins.jsonl` — وليس ملف جميع البيانات مطلقًا)، و`companion_config?` (مع `drop_test_twins`: حيث يوضع تكوين النموذج الخالي من النظائر؛ الافتراضي `config-notwins.json`)، و`overwrite?` (استبدال ملف `clean_to` الذي يستخدمه تكوين أو تشغيل أو تقسيم أو تدقيق آخر — ويُرفض دونه)، و`full_indices?` (كل قائمة أرقام صفوف بالكامل؛ بشكل افتراضي تعود القوائم الطويلة كـ `{count, first}`)، و`workspace?`، و`project_dir?` |
| `forge_register_eval` | `name`، و`path`، و`role`، و`source_field?`، و`target_field?`، و`allow_rotate?`، و`workspace?`، و`project_dir?` |
| `forge_prereg_template` | `out?`، و`force?`، و`project_dir?` |
| `forge_prereg` | `id`، و`eval_set`، و`predictions`، و`author?`، و`config_hash?` (تثبيتها لعملية تشغيل واحدة)، و`allow_after_reads?` (فقط للتوقعات المكتوبة قبل قراءات المجموعة المسجلة)، و`workspace?`، و`project_dir?` |
| `forge_prereg_verdict` | `id`، و`prediction` (رقمها، أو معرفها الخاص)، و`verdict` (`held` أو `missed`)، و`by` (من قام بالتقييم)، و`note?`، و`revise?`، و`workspace?`، و`project_dir?` |
| `forge_export` | `run_manifest`، و`out`، و`config?`، و`no_eval?`، و`no_model?`، و`glossary?`، و`endpoint?`، و`port?`، و`name?`، و`force?`، و`prereg?`، و`workspace?`، و`project_dir?` |
| `forge_evaluate` | `run_manifest`، و`config?`، و`out_hyps?`، و`harness_out?`، و`glossary?`، و`prereg?`، و`workspace?`، و`project_dir?` |
| `forge_lint` | `manifest`، و`run_manifest?`، و`workspace?`، و`project_dir?` |
| `forge_report` | `manifest`، و`workspace?`، و`project_dir?` |
| `forge_compare` | `eval_set`، و`hyps_a`، و`hyps_b`، و`label_a?`، و`label_b?`، و`run_a?`، و`run_b?` (بيان تشغيل كل نموذج: يتم فحص بيانات تدريبه بحثًا عن النظائر المقاربة)، و`metric?`، و`target_lang?`، و`config_hash?`، و`prereg?`، و`override_respend?`، و`workspace?`، و`project_dir?` |

على سبيل المثال، يطرح كل من `get_metric_reliability { "language": "crk" }` و`get_metric_reliability { "target": "crk" }` السؤال نفسه.

### الترجمة باستخدام نموذج قمت بنشره

تطبع `nmt-forge serve` عنوانين للنموذج الذي تخدمه. وجّه `translate` نحو أي منهما:

| الوسيطة | استخدمها مع | مثال |
|---|---|---|
| `base_url` | `method: "local"` — خادم متوافق مع OpenAI (وكذلك `"openai"`) | `http://127.0.0.1:8378/v1` |
| `endpoint` | `method: "api"` — عقد API الخاص بـ champollion | `http://127.0.0.1:8378/translate` |
| `model` | محركات نماذج اللغة الكبيرة فقط؛ وتُرفض مع واجهات برمجة تطبيقات الترجمة الآلية، التي لا تملك ذلك | `llama3.1` |
| `project_dir` | أي طريقة — استخدام ذاكرة الترجمة الخاصة بذلك المشروع | `~/my-app` |

لا يحتاج الخادم الموجود على جهازك الخاص إلى مفتاح. وتقرأ نقطة النهاية البعيدة لـ `api` مفتاحها من `CHAMPOLLION_API_KEY` في بيئة الخادم. وترفض الأداة أي وسيطة لا تعرفها، بالاسم، بدلًا من تجاهلها، حتى لا يؤدي الخطأ الإملائي في الوسيطة إلى إرسال نصك بصمت إلى نموذج مختلف.

### مكان حفظ حالة الخادم

يتم حفظ كل شيء في `~/.champollion-mcp/` (عيّن `CHAMPOLLION_MCP_HOME` لنقله):

- **ذاكرة ترجمة `translate`** هي ملف خاص بها، وهو `.champollion/tm.json` في ذلك المجلد. وهو منفصل عن `.champollion/tm.json` لأي مشروع. مرر `project_dir` لاستخدام ملف المشروع بدلًا منه، وهو الملف الذي تستخدمه `champollion sync` هناك.
- تُسجل **مهام `run_benchmark`** في `jobs.json`، والذي يحتفظ بأحدث 50 مهمة. ولكل مهمة مجلد في `jobs/` يحتوي على مخرجاتها، ونتائج بيئة التقييم لعنصر قائمة انتظار أو مدونة مسجلة. وتكتب عملية التشغيل على ملف اختبار بحوزتك نتائجها ومخزنها المؤقت بجوار ذلك الملف، في `results/` — باستثناء الملف الموجود في مجلد يحدده `mt-eval contest prepare` كقابل للإصدار، حيث يكتب تشغيله في مجلد `runs/` الخاص بالمسابقة. وتحصل كل عملية تشغيل من هذا القبيل على مجلد `mcp-run-<id>/` خاص بها هناك، وتطبع `get_run_status` أمر `mt-eval compare` الشامل لها جميعًا (`results/mcp-run-*/*_report.json`).
  وتكتب عمليات تشغيل قائمة الانتظار تقاريرها في `eval/logs/harness/queue/` تحت مجلد عمل الخادم، كما تفعل بيئة التقييم دائمًا.

:::note[الإنفاق محدود بطبيعته]
ترفض `run_benchmark` **تشغيل قائمة الانتظار بلا حدود.** يجب عليك تمرير حد واحد بالضبط — `budget`، أو `top`، أو `item_id` محدد. لا يوجد استدعاء لمجرد "تشغيل قائمة الانتظار"، لأن الوكيل الذي يسيء فهم قائمة الانتظار قد ينفق حينئذٍ دون قيود.
:::

## إصدار البروتوكول

النقل عبر **stdio فقط** — عملية خادم واحدة لكل وكيل.

جعلت [مراجعة 2026-07-28](https://blog.modelcontextprotocol.io/posts/2026-07-28/) لبروتوكول MCP البروتوكول عديم الحالة (stateless) افتراضيًا، مستغنية عن مصافحة `initialize` وترويسة `Mcp-Session-Id`. ولا يتأثر هذا الخادم من حيث التصميم: فهو لا يستخدم أيًا من الإمكانات المهملة (Roots، وSampling، وLogging)، ولم يستخدم مطلقًا وسيلة النقل القديمة HTTP+SSE، ويتبع بالفعل التوجيهات الجديدة للحالة عبر الاستدعاءات — حيث تصدر `run_benchmark` معالج مهمة صريحًا يمرره النموذج مجددًا، بدلًا من الاعتماد على جلسة نقل.

ولم يتم **تحديثه** إلى المراجعة الجديدة بعد، نظرًا لعدم وجود حزمة تطوير برمجيات (SDK) منشورة لـ TypeScript تدعمها حتى الآن. راجع [ملف README للخادم](https://github.com/gamedaysuits/Champollion/tree/main/mcp-server) لمعرفة الموقف الكامل.

## نقاط النهاية المقروءة آليًا

لا حاجة لعميل MCP للوصول إلى هذه النقاط:

| نقطة النهاية | ماهيتها |
|---|---|
| [`/for-agents.md`](https://champollion.dev/for-agents.md) | [الواجهة المخصصة للوكلاء](/for-agents)، بتنسيق markdown الأولي |
| [`/llms.txt`](https://champollion.dev/llms.txt) | الفهرس المنظم لهذا الموقع |
| [`/llms-full.txt`](https://champollion.dev/llms-full.txt) | جميع الصفحات المفهرسة مدمجة بالكامل |
| [`/queue.json`](https://champollion.dev/queue.json) | قائمة انتظار التقييم المعياري الكاملة |
| [`/queue-preview.json`](https://champollion.dev/queue-preview.json) | أهم عناصر قائمة الانتظار |
| [`/registry.json`](https://champollion.dev/registry.json) | سجل المدونات اللغوية |
| [`/mesh.json`](https://champollion.dev/mesh.json) | الرسم البياني المقيس للغات |

## التالي

- [تشغيل rails عبر MCP](/docs/agents/mcp) — ملف التعريف rails، خطوة بخطوة
- [عقد التشغيل](/docs/agents/contract) — القواعد التي يعمل الوكيل بموجبها
- [دليل الوكيل — البناء والتقييم المعياري](/docs/agents/measurement)
- [دليل الوكيل — الترجمة عبر سطر الأوامر](/docs/agents/serving)
- [إرسال طريقة](/docs/network/getting-started/submit-a-method)
