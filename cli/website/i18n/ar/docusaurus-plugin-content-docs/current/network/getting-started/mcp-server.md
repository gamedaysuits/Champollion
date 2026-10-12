---
title: "MCP Server — الواجهة الموجهة للوكيل"
sidebar_label: "MCP Server"
description: "ربط وكيل ذكاء اصطناعي بـ Champollion عبر Model Context Protocol: ‏34 أداة للبحث عن اللغات، وتصفح قائمة انتظار التقييم المعياري وسجل المتون اللغوية، وإجراء التقييمات، وتدريب النماذج وتصديرها، والترجمة — مع توضيح دقيق للأدوات التي تتطلب ما هو أكثر من مجرد أمر npx install."
---

# خادم MCP — الباب المواجه للوكيل

يُتيح `champollion-mcp-server` أداة Champollion لوكلاء الذكاء الاصطناعي عبر [Model
Context Protocol](https://modelcontextprotocol.io). إذا كنت وكيلاً، أو كنت
تقوم بربط وكيل، فهذه هي البوابة: **34 أداة و3 موارد و4 موجهات (prompts)**
عبر stdio.

كل شيء هنا يمكن الوصول إليه أيضاً كـ HTTP عادي — راجع [نقاط النهاية المقروءة آلياً](#machine-readable-endpoints) — ولكن خادم MCP هو الواجهة الوحيدة التي تتيح للوكيل *التصرف* (الترجمة، تشغيل معيار قياس، تدريب نموذج) بدلاً من مجرد القراءة.

## التثبيت

```bash
npx -y champollion-mcp-server
```

ثم قم بتسجيله مع عميلك. بالنسبة لـ Claude Code:

```bash
claude mcp add champollion -- npx -y champollion-mcp-server
```

بالنسبة للعملاء الذين يتم تكوينهم بواسطة ملف (Claude Desktop، Cursor، Antigravity)، أضف:

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

## اقرأ هذا قبل الاعتماد عليه

**تعمل 14 أداة من أصل 34 بمجرد تثبيت `npx` خام، وتعمل `translate` بمجرد
توفر محرك لها. أما الأدوات الـ 19 الأخرى فتحتاج إلى حزم Python لا تتضمنها حزمة npm
ولا يمكنها توفيرها.** لا تفشل هذه الأدوات بصمت — فكل منها يُرجع خطأً
قابلاً للتنفيذ يحدد ما هو مفقود — ولكن يجب أن تكون على دراية بالهيكلية قبل
التخطيط حولها.

| الأدوات | هل تعمل بعد `npx`؟ | ما الذي تحتاجه أيضاً |
|---|---|---|
| `search_languages`، `get_language`، `language_overview`، `list_corpora`، `get_results`، `get_run_card`، `get_metric_reliability`، `list_contests`، `get_contest`، `get_project_info`، `list_queue`، `get_queue_item`، `estimate_cost`، `get_training_guardrails` | **نعم** — للقراءة فقط، وتُقدَّم من نقاط نهاية عامة | لا شيء |
| `translate` | **نعم**، مع توفر محرك | مفتاح API للمحرك الذي تختاره — أو لا شيء، باستخدام الطريقة `local` وخادم نموذج على جهازك الشخصي |
| `run_benchmark`، `get_run_status`، `preview_publish`، `publish_report` | لا | إطار التقييم — `pipx install mt-eval-harness` |
| أدوات `forge_*` الخمس عشرة | لا | NMT Forge بالإصدار 0.2.0 أو أحدث — `python3 -m pip install nmt-forge` (أضف `'nmt-forge[hf]'` للتدريب والخدمة). يتضمن إطار التقييم تلقائياً ويعثر على بطاقات اللغات بمفرده؛ دون الحاجة لاستنساخ المستودع |

لا يلزم استنساخ المستودع لأي من ذلك.

## ماذا تفعل الأدوات

**تصفح العمل وحساب تكلفته.** تتنقل `list_queue` و `get_queue_item` في قائمة انتظار معايير القياس المفتوحة — وهي القائمة المصنفة للقياسات التي من شأنها تحسين الخريطة بأكبر قدر ممكن. تقوم `estimate_cost` بتسعير مجموعة من عمليات التشغيل قبل أن تنفق أي شيء.

**البحث عن المعلومات.** تبحث `search_languages` في بطاقات اللغات حسب الاسم،
أو الرمز، أو العائلة، أو المنطقة، وتتسامح مع الأخطاء الإملائية. توضح كل نتيجة أيضاً أين
يُتحدث باللغة (البلدان، ونقطة على الخريطة، والمنطقة الكبرى macroarea) وأسماءها
الأخرى — فقط الحقائق التي تذكر بطاقتها مصدراً لها، كل منها مع مصدره، حتى
يمكن التمييز بين اللغات ذات الأسماء المتشابهة. لا يتم إظهار أي موقع دون مصدر
إطلاقاً؛ حيث ينص السطر على ذلك ويربط بسجل Glottolog الخاص باللغة
بدلاً من ذلك. البطاقات المكتملة من جداول البطاقات المنشورة على champollion.dev (في
تثبيت npm، كل لغة خارج المجموعة الأساسية المضمنة) لا تحمل مصادر
لكل حقل بعد — وستصل مع الرفع التالي للجداول — لذا تحمل تلك
الأسطر رابط Glottolog بدلاً من الموقع. تعد `language_overview` نقطة
البداية المكونة من صفحة واحدة للبناء للغة معينة: ما هو موجود، وما يمكن
تشغيله، والخطوات التالية. تُرجع `get_language` البطاقة الكاملة الموثقة بالمصادر.
تسرد `list_corpora` مجموعات نصوص التقييم المسجلة
لزوج لغوي أو عائلة معايير قياسية — بيانات وصفية فقط (الحجم،
والترخيص، ودرجة التلوث، وما إذا كان إطار التقييم قادراً على جلبها، أو يحتاج إلى
رمز وصول، أو يحتفظ بها في الحجر الصحي)؛ لا يتم إرجاع محتوى النصوص مطلقاً،
وأي زوج تخضع جميع مجموعات نصوصه للحجر الصحي ينص على ذلك بدلاً من أن يبدو
غير مدعوم. تقرأ `get_results` و`get_run_card` عمليات التشغيل المقيمة من
لوحة الصدارة العامة. تجيب `get_metric_reliability` على السؤال الذي يخطئ
فيه معظم الوكلاء — *ما هو المقياس الذي يجب أن أثق به لهذه اللغة الهدف* —
استناداً إلى الارتباطات مع التقييمات البشرية لكل عائلة لغوية. تعرض `list_contests`
و`get_contest` المسابقات وشروطها المعلنة؛ والانضمام إلى إحداها هو
خطوة CLI بتفويض بشري، وليس أداة أبداً.

**التنفيذ.** تُشغّل `translate` النص عبر مسار المعالجة المختبر، مع ذاكرة
الترجمة (فالتكرارات لا تكلف شيئاً) وبوابة جودة حتمية. تذكر كل إجابة
المحرك الذي تم تشغيله بالفعل، مع نموذجه ونقطة نهايته إن وُجدا.
تبدأ `run_benchmark` عملية تقييم وتُرجع **معرّف مهمة فوراً**،
لأن عمليات التشغيل الحقيقية تستغرق وقتاً أطول من أي مهلة انتهاء للعميل؛
وتقوم بالاستعلام الدوري لـ `get_run_status` باستخدام ذلك المعرّف. تنجو المهمة من
إعادة تشغيل الخادم: يستمر التشغيل، والاستعلام عن المعرّف نفسه بعد ذلك
يظل يُرجع حالته ونتائجه. لا يتم نشر أي شيء ما لم تُمرر `publish: true`؛
وتوضح الخطة حينها ما الذي سيصبح عاماً — كل صف مع نص جملته، أو الدرجات
فقط؛ الموجه، أو تجزئته فقط؛ وأين — ويتطلب النشر الفعلي `publish_ack`
بالكلمات الدقيقة التي تحددها الخطة، حتى يكون المستخدم قد رآها أولاً. ويمكن
نشر أي تشغيل تم إجراؤه بدونها لاحقاً، خلف البوابة نفسها. `preview_publish` للقراءة فقط:
فهي تعرض معاينة النشر الخاصة بإطار التقييم، والكلمات الدقيقة واستدعاء
`publish_report` الدقيق الذي سينشره، ولا يمكنها النشر. وهي
تحمل توصيف MCP التوضيحي `readOnlyHint: true`، لذا يمكن لمضيف الوكيل الذي يطلب
الإذن قبل كل كتابة أن يسمح بها تلقائياً. تنفذ `publish_report` عملية الكتابة
(مصحوبة بالتوصيف `destructiveHint` و`openWorldHint`)، وتحجب `scores_only`
نص الجملة. تفتتح كل خطة أيضاً بحالة `EVAL PACK:`
للغة الهدف — `missing` (مع الأمر الذي يقوم بتثبيته)، أو `ready`، أو `none needed` —
وتذكر ترخيص مجموعة النصوص وشرط `do_not_train` الخاص بها، لأن التشغيل يمر
عبر `--yes`. لا يؤدي فقدان FST (المحلل أو بيئة تشغيل pyhfst الخاصة به)
إلى إيقاف التشغيل أبداً: بل يستمر، وتحدد بطاقة التشغيل أن قبول FST لم يُحسب.
أي جزء مفقود آخر يوقف التشغيل قبل الترجمة. تحسب `skip_fst` و`skip_eval_standard`
الدرجات دون تلك الأجزاء، وتحدد بطاقة التشغيل ما تم استبعاده. توضح الخطة
أيضاً ما إذا كان سيتم حساب COMET (يحسبه إطار التقييم متى كان `unbabel-comet`
مثبتاً؛ بينما تجعل `comet: true` عملية التشغيل تتطلبه)، وتطلب `metricx` و`fuse`
مقياس MetricX-24 الاختياري لإطار التقييم والمقارن بنمط FUSE. ولكل
واحد منها توضح الخطة، استناداً إلى إطار التقييم، ما إذا كان مثبتاً، وما يجب تثبيته
وما يقوم بتنزيله. يُرفض التشغيل المؤكد الذي يطلب مقياساً لا يستطيع إطار التقييم
حسابه بدلاً من تشغيله بدونه. توضح سطور `Results:` و`Cache:` في
الخطة أين يُحفظ سجل التشغيل، والتقرير، وذاكرة التخزين المؤقت للترجمة.
ملف الاختبار الموجود داخل مجلد يحدده `mt-eval contest prepare` كقابل للإصدار
(مجلد `public/` الخاص بالمسابقة) يتم تشغيله داخل مجلد `runs/` الخاص بالمسابقة بدلاً من ذلك،
حتى لا يتم إصدار أي شيء يكتبه التشغيل معه. والنموذج الموجود على جهازك
الخاص (خادم محلي، أو `method: "local-model"`، الذي يشغله إطار التقييم داخل العملية
ولا يحتاج إلى تصديق) يتم الإبلاغ عنه على أنه `$0 API cost (runs on
this machine)`.

**التدريب دون تضليل النفس.** تُرجع `get_training_guardrails` القواعد
المستخرجة من حالات الفشل المقاسة فعلياً. تُشغّل أدوات `forge_*` الخمس عشرة
[NMT Forge](/docs/network/getting-started/training-honestly) خطوة محكمة واحدة
في كل مرة — `forge_status` أولاً وبعد كل خطوة (تحدد الأمر التالي
والأداة التي تُشغّله)، و`forge_preflight` لمعرفة البوابات التي سيصطدم
بها الأمر قبل أن يرفض، و`forge_prereg_template` و`forge_prereg`
لتدوين التنبؤات قبل وجود أي درجة اختبار (وقبل أي تقييم معياري على
مجموعة الاختبار: فالقراءة لحساب الدرجات تمنع التسجيل المسبق لاحقاً)،
و`forge_export` لحساب درجات مجموعة الاختبار لمرة واحدة وتحزيم النموذج المدرب،
و`forge_compare` لإجراء اختبار A/B لنموذجين مع وضع تحذير التوأم شبه المطابق
لكل منهما بجانب الفائز، و`forge_prereg_verdict` لتسجيل حكم المستخدم
الخاص على تنبؤ لا يستطيع forge الحكم عليه (نطاق نصي حر) — ويُعرض كحكم بشري،
وليس كحكم محسوب أبداً. تسرد `forge_status` كل عملية تشغيل مدرّبة مع درجة مجموعة التطوير
الخاصة بها وتوضح متى تصبح مجموعة التطوير مشبعة (درجة تطوير كاملة مع عدم
وجود مفاضلة لاختيار نقطة الفحص). وعندما يضع إطار التقييم تحذيراً
بشأن درجة الاختبار (على سبيل المثال مخرجات شبه ثابتة: حفنة من المخرجات
المعطاة لكل جملة مصدر)، فإن `forge_export` و`forge_status`
و`forge_compare` و`forge_lint` تنقله بكلمات إطار التقييم نفسها، ويأتي التحذير
الرئيسي أولاً في الخطوة التالية: ولا يُقتبس التقييم بدونه إطلاقاً. يعود الرفض
موضحاً ما حدث من خطأ، ولماذا يُعد مهماً، وكيفية إصلاحه. هناك خطوتان تستمران
أطول من أي استدعاء أداة وتعملان في الطرفية بدلاً من ذلك: التدريب (`nmt-forge run`) وخدمة
النموذج المُصدَّر (`nmt-forge serve`، والتي تضعه خلف نقطة نهاية محلية يمكن
لـ `translate` وواجهة سطر الأوامر استخدامها).

### الوسائط

`name` مطلوب و`name?` اختياري. كل أداة تأخذ لغة
واحدة تقبلها أيضاً كـ `language`: تعني عبارة "`code` أو `language`" أن كلا
الاسمين يعمل، وتمرر أحدهما. تظل الأسماء الأصلية تعمل دائماً.

| الأداة | الوسائط |
|---|---|
| `search_languages` | `query` أو `language`، `limit?` |
| `language_overview` | `code` أو `language`، `source?` |
| `get_language` | `code` أو `language`، `format?` |
| `list_corpora` | `source_language?`، `target_language?`، `family?` (واحد على الأقل من هذه الثلاثة)، `include_quarantined?`، `limit?` |
| `get_results` | `source_language?`، `target_language?`، `model?`، `sort?`، `limit?` |
| `get_run_card` | `id` |
| `get_metric_reliability` | `target` أو `language` |
| `list_contests` | `status?`، `language?`، `limit?` |
| `get_contest` | `id` |
| `get_project_info` | لا يوجد |
| `list_queue` | `language?`، `source_language?`، `model?`، `budget?`، `condition?`، `limit?` |
| `get_queue_item` | `id?` أو `priority?` (أحدهما) |
| `estimate_cost` | `budget?`، `language?`، `source_language?`، `model?`، `condition?` |
| `get_training_guardrails` | `topic?` |
| `translate` | `texts`، `source_language`، `target_language`، `method?`، `model?`، `base_url?`، `endpoint?`، `register?`، `project_dir?`، `context?` (سياق msgctxt الخاص بـ gettext: سياق واحد لكل النصوص، أو سياق لكل نص)، `script?`، `use_tm?`، `validate?` |
| `run_benchmark` | نمط واحد: `budget?` أو `top?` (قائمة الانتظار)، أو `item_id?`، أو `corpus?` مع `model?` (مع `method_dir`، النموذج الذي يحمّله الملحق البرمجي)، أو `method?` أو `method_dir?` (دليل ملحق الطريقة؛ `local-model` تحتاج إلى `model` — فليس لها افتراضي)، أو `allow_model_pair_mismatch?` (`local-model`: تشغيل نموذج زوج OPUS-MT يُسمي زوجاً آخر، كخط أساس للغة ذات صلة)، أو `attest_local_transport?` (محرك MT أو ملحق برمجي؛ غير مطلوب إطلاقاً لـ `local-model`)، و`provider?`، و`base_url?`، و`target_language?`، و`script?` (عمليات تشغيل LLM: نظام الكتابة ISO 15924 الذي يجب كتابة المخرجات به، مثل `Cans` أو `Latn`؛ توضح الخطة متى تسرد بطاقة الهدف أكثر من نظام كتابة واحد)، و`source_language?`، و`source_field?`، و`target_field?`، و`max_cost?`، و`coaching_file?`، و`glossary?`، و`attest_no_training?`، و`accept_nc_terms?`، و`skip_fst?` و`skip_eval_standard?` (عمليات تشغيل العناصر ومجموعات النصوص: حساب الدرجات بدون FST أو المقاييس القياسية للتقييم، مع تحديد أنها لم تُحسب)، و`comet?` (طلب COMET: يُرفض التشغيل طالما أنه غير مثبت)، و`metricx?` مع `metricx_model?`، و`fuse?` (عمليات تشغيل العناصر ومجموعات النصوص: مقياس MetricX-24 الاختياري لإطار التقييم والمقارن بنمط FUSE، ويُرفض طالما أنه غير مثبت)؛ ثم `dry_run?`، و`confirm?`، و`publish?`، و`publish_ack?` (مع النشر الفعلي: الكلمات الدقيقة التي تطبعها الخطة)، و`anonymous?` |
| `get_run_status` | `job_id?` |
| `preview_publish` | `report` (`*_report.json` لعملية تشغيل مكتملة)، `scores_only?`، `redact_coaching?`، `anonymous?` (للقراءة فقط: بدون `confirm`، لا يمكنها النشر) |
| `publish_report` | `report` (`*_report.json` لعملية تشغيل مكتملة)، `scores_only?`، `redact_coaching?`، `anonymous?`، `confirm?`، `publish_ack?` (الكلمات الدقيقة التي تطبعها المعاينة) |
| `forge_status` | `workspace?`، `project_dir?` |
| `forge_preflight` | `target` (الأمر المراد التحقق منه)، `config?`، `workspace?`، `project_dir?` |
| `forge_discover` | `code` أو `language`، `cards_dir?`، `workspace?`، `project_dir?` |
| `forge_init` | `code` أو `language`، `dir?`، `pair?`، `model?`، `base?`، `no_card?`، `name?`، `cards_dir?` |
| `forge_split` | `corpus`، `test`، `seed`، `out?` (الافتراضي `data/split`، المسار الذي يقرأه config.json الخاص بـ `forge_init`)، `dev?`، `register?` (بادئة اسم، أو `true` لـ `project`)، `allow_rotate?`، `near_dupe?` (عتبة Jaccard مثل 0.6، عندما يوصي forge باقتطاع النسخ شبه المكررة)، `max_group?` (مع `near_dupe`: أكبر مجموعة شبه مكررة)، `workspace?`، `project_dir?` |
| `forge_leak_audit` | `corpus`، `strict?`، `clean_to?`، `drop_test_twins?` (مع `clean_to` الخاص بها، على سبيل المثال `corpus.notwins.jsonl` — وليس ملف جميع البيانات إطلاقاً)، `companion_config?` (مع `drop_test_twins`: أين يذهب تكوين النموذج الخالي من التوائم؛ الافتراضي `config-notwins.json`)، `overwrite?` (استبدال ملف `clean_to` يستخدمه تكوين، أو تشغيل، أو تقسيم، أو تدقيق آخر — يُرفض بدونه)، `full_indices?` (كل قائمة أرقام صفوف بالكامل؛ بشكل افتراضي تعود القوائم الطويلة كـ `{count, first}`)، `workspace?`، `project_dir?` |
| `forge_register_eval` | `name`، `path`، `role`، `source_field?`، `target_field?`، `allow_rotate?`، `workspace?`، `project_dir?` |
| `forge_prereg_template` | `out?`، `force?`، `project_dir?` |
| `forge_prereg` | `id`، `eval_set`، `predictions`، `author?`، `config_hash?` (تثبيته على عملية تشغيل واحدة)، `allow_after_reads?` (فقط للتنبؤات المكتوبة قبل القراءات المحسوبة لمجموعة الاختبار)، `workspace?`، `project_dir?` |
| `forge_prereg_verdict` | `id`، `prediction` (رقمها، أو معرّفها الخاص)، `verdict` (`held` أو `missed`)، `by` (من أصدر الحكم)، `note?`، `revise?`، `workspace?`، `project_dir?` |
| `forge_export` | `run_manifest`، `out`، `config?`، `no_eval?`، `no_model?`، `glossary?`، `endpoint?`، `port?`، `name?`، `force?`، `prereg?`، `workspace?`، `project_dir?` |
| `forge_evaluate` | `run_manifest`، `config?`، `out_hyps?`، `harness_out?`، `glossary?`، `prereg?`، `workspace?`، `project_dir?` |
| `forge_lint` | `manifest`، `run_manifest?`، `workspace?`، `project_dir?` |
| `forge_report` | `manifest`، `workspace?`، `project_dir?` |
| `forge_compare` | `eval_set`، `hyps_a`، `hyps_b`، `label_a?`، `label_b?`، `run_a?`، `run_b?` (بيان تشغيل كل نموذج: يتم فحص بيانات التدريب الخاصة به بحثاً عن التوائم شبه المتطابقة)، `metric?`، `target_lang?`، `config_hash?`، `prereg?`، `override_respend?`، `workspace?`، `project_dir?` |

على سبيل المثال، يطرح `get_metric_reliability { "language": "crk" }` و`get_metric_reliability { "target": "crk" }` السؤال نفسه.

### الترجمة باستخدام نموذج قمت بنشره

يطبع `nmt-forge serve` عنوانين للنموذج الذي يخدمه. وجّه
`translate` إلى أي منهما:

| الوسيط | استخدامه مع | مثال |
|---|---|---|
| `base_url` | `method: "local"` — خادم متوافق مع OpenAI (أيضاً `"openai"`) | `http://127.0.0.1:8378/v1` |
| `endpoint` | `method: "api"` — عقد واجهة برمجة تطبيقات champollion | `http://127.0.0.1:8378/translate` |
| `model` | محركات LLM فقط؛ يُرفض لواجهات برمجة تطبيقات الترجمة الآلية، التي لا تملك أياً منها | `llama3.1` |
| `project_dir` | أي طريقة — استخدم ذاكرة الترجمة الخاصة بذلك المشروع | `~/my-app` |

لا يحتاج الخادم الموجود على جهازك الخاص إلى مفتاح. وتقرأ نقطة النهاية البعيدة لـ `api` مفتاحها
من `CHAMPOLLION_API_KEY` في بيئة الخادم. وترفض الأداة أي وسيط لا تتعرف عليه، بالاسم، بدلاً من تجاهله، حتى لا يؤدي وسيط
به خطأ إملائي إلى إرسال نصك بهدوء إلى نموذج مختلف.

### أين يحتفظ الخادم بحالته

يوجد كل شيء في `~/.champollion-mcp/` (قم بتعيين `CHAMPOLLION_MCP_HOME` لنقله):

- **ذاكرة الترجمة الخاصة بـ `translate`** هي ملف مستقل بذاته،
  `.champollion/tm.json` في ذلك المجلد. وهي منفصلة عن `.champollion/tm.json` الخاصة بأي مشروع.
  مرر `project_dir` لاستخدام ملف المشروع بدلاً من ذلك،
  وهو الملف الذي تستخدمه `champollion sync` هناك.
- **مهام `run_benchmark`** تُسجل في `jobs.json`، والذي يحتفظ بأحدث
  50 مهمة. تحتوي كل مهمة على مجلد في `jobs/` يضم مخرجاتها، وبالنسبة
  لعنصر قائمة انتظار أو مجموعة نصوص مسجلة، نتائج إطار التقييم. أما التشغيل على ملف
  اختبار بحوزتك فيكتب نتائجه وذاكرته المؤقتة بجانب ذلك الملف، في
  `results/` — باستثناء أي ملف في مجلد يعلمه `mt-eval contest prepare`
  كقابل للإصدار، والذي يكتب تشغيله في مجلد `runs/` الخاص بالمسابقة.
  تكتب عمليات تشغيل قائمة الانتظار تقاريرها إلى `eval/logs/harness/queue/` تحت
  مجلد عمل الخادم، كما يفعل إطار التقييم دائماً.

:::note[الإنفاق مقيد حسب التصميم]
ترفض `run_benchmark` **تشغيل قائمة انتظار غير مقيدة.** يجب عليك تمرير قيد واحد بالضبط — `budget`، أو `top`، أو `item_id` محدد. لا يوجد استدعاء "فقط قم بتشغيل قائمة الانتظار"، لأن الوكيل الذي يسيء فهم قائمة الانتظار قد ينفق بلا حدود بخلاف ذلك.
:::

## إصدار البروتوكول

النقل يتم عبر **stdio فقط** — عملية خادم واحدة لكل وكيل.

جعلت [مراجعة 2026-07-28](https://blog.modelcontextprotocol.io/posts/2026-07-28/) الخاصة بـ MCP البروتوكول عديم الحالة (stateless) افتراضياً، مما أدى إلى إيقاف مصافحة `initialize` وترويسة `Mcp-Session-Id`. لم يتأثر هذا الخادم في تصميمه: فهو لا يستخدم أياً من الإمكانات المهملة (Roots، Sampling، Logging)، ولم يستخدم أبداً نقل HTTP+SSE القديم، ويتبع بالفعل الإرشادات الجديدة لحالة الاستدعاءات المتقاطعة (cross-call state) — حيث تُنشئ `run_benchmark` مقبض وظيفة صريح (job handle) يمرره النموذج مرة أخرى، بدلاً من الاعتماد على جلسة النقل.

**لم** تتم ترقيته إلى المراجعة الجديدة، لأنه لا توجد حزمة تطوير برمجيات (SDK) منشورة لـ TypeScript تدعمها حتى الآن. راجع [ملف README الخاص بالخادم](https://github.com/gamedaysuits/Champollion/tree/main/mcp-server) لمعرفة الموقف بالكامل.

## نقاط النهاية المقروءة آلياً

لا حاجة لعميل MCP لهذه النقاط:

| نقطة النهاية (Endpoint) | ما هي |
|---|---|
| [`/for-agents.md`](https://champollion.dev/for-agents.md) | [الباب الأمامي للوكيل](/for-agents)، بتنسيق markdown خام |
| [`/llms.txt`](https://champollion.dev/llms.txt) | الفهرس المنسق لهذا الموقع |
| [`/llms-full.txt`](https://champollion.dev/llms-full.txt) | كل صفحة مفهرسة، مضمنة (inlined) |
| [`/queue.json`](https://champollion.dev/queue.json) | قائمة انتظار معايير القياس الكاملة |
| [`/queue-preview.json`](https://champollion.dev/queue-preview.json) | أهم عناصر قائمة الانتظار |
| [`/registry.json`](https://champollion.dev/registry.json) | سجل المتون (corpus registry) |
| [`/mesh.json`](https://champollion.dev/mesh.json) | الرسم البياني للغات المقاسة |

## التالي

- [دليل الوكيل — البناء وقياس الأداء](/docs/network/getting-started/agent-guide)
- [دليل الوكيل — الترجمة باستخدام واجهة سطر الأوامر (CLI)](/docs/guides/agent-guide)
- [إرسال طريقة](/docs/network/getting-started/submit-a-method)
