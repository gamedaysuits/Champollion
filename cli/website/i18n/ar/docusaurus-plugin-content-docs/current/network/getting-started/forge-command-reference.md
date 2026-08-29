---
sidebar_position: 5
title: "مرجع الأمر forge"
description: "كل أمر فرعي لـ nmt-forge، ومعاملاته، وما يحميه — مُولد من محلل CLI بحيث لا ينحرف أبدًا."
---

<!-- تم الإنشاء بواسطة forge/scripts/gen_command_reference.py — لا تقم بتعديله يدويًا.
     أعد تشغيل المولد بعد أي تغيير في واجهة سطر الأوامر (CLI). -->

# مرجع أوامر forge

كل أمر فرعي لـ `nmt-forge`، تم إنشاؤه مباشرة من محلل واجهة سطر الأوامر (CLI) بحيث لا يمكن أن تنحرف هذه الصفحة عن الأداة. لمعرفة *السبب* وراء كل حارس (guard)، راجع
[تدريب نموذج بصدق](/docs/network/getting-started/training-honestly)؛ ولتشغيل forge من وكيل (agent)، راجع
[تدريب نموذجك الأول (باستخدام وكيلك)](/docs/network/getting-started/train-your-first-model).

**العلامة العامة (global flag):** `--workspace <dir>` (الافتراضي `./.forge`) تسبق كل أمر فرعي وتحدد اسم المشروع الذي تعمل عليه.

الوكلاء (Agents): استدعِ `nmt-forge status --json` أولاً — فهو يخبرك بأي من هذه الأوامر يجب تشغيله تاليًا.


## `discover`

ماذا تمتلك هذه اللغة؟ (يقرأ بطاقة لغة SSOT؛ الغياب = غير معروف، وليس صفرًا أبدًا)

**الوسائط (Arguments):**

- `code` — رمز ISO 639-3 (مثل crk، fra، nav، arb)

**الخيارات (Options):**

- `--cards-dir` — دليل بطاقات اللغات (الافتراضي: $CHAMPOLLION_CARDS_DIR أو البحث التصاعدي في المستودع الأحادي monorepo)
- `--json` — 
- `--no-registry` — تخطي الفحص المتقاطع لسجل mt-eval لمجموعات بيانات التقييم

## `init`

إنشاء هيكل مشروع من بطاقة لغة: مساحة عمل + تكوين مبدئي + NEXT_STEPS.md

**الوسائط (Arguments):**

- `code` — رمز ISO 639-3 للغة الهدف (TARGET)

**الخيارات (Options):**

- `--dir` — دليل المشروع (الافتراضي .)
- `--pair` — زوج اللغات بصيغة SRC-TGT (الافتراضي eng-<code>)
- `--cards-dir` — 

## `status`

أين أنا؟ جدول الحالة + الأمر التالي (الوكلاء: استدعوا هذا أولاً، استخدموا --json)

**الخيارات (Options):**

- `--json` — 

## `preflight`

هل سيرفض <command>؟ كل بوابة سيصطدم بها، مع الإصلاحات (الخروج برمز 2 إذا فشلت أي بوابة)

**الوسائط (Arguments):**

- `target` — الأمر المراد فحصه مسبقًا (preflight): run|score|split|prereg|leak-audit

**الخيارات (Options):**

- `--json` — 

## `lint`

تشخيص بيان حزمة التقييم (battery manifest): السجلات الضعيفة → السبب الأكثر احتمالاً → الإجراء التالي الذي يجب اتخاذه

**الوسائط (Arguments):**

- `manifest` — ملف json لبيان حزمة التقييم (الحارس: ci-scoring/battery)

**الخيارات (Options):**

- `--run-manifest` — بيان التشغيل (run manifest) لإشارات الجدول الزمني/استقرار النقل (schedule/transfer-plateau)
- `--json` — 

## `registry`

سجل مجموعة التقييم (eval-set registry)

### `registry add`

**الوسائط (Arguments):**

- `name` — 
- `path` — 

**الخيارات (Options):**

- `--role` *(مطلوب)* (واحد من: dev، test، sealed) — 
- `--source-field` — 
- `--target-field` — 
- `--note` — 
- `--allow-rotate` — 

### `registry list`

### `registry add-harness`

**الوسائط (Arguments):**

- `dataset_id` — 

**الخيارات (Options):**

- `--role` (واحد من: dev، test، sealed) — 
- `--yes` — قبول مطالبات الجلب الخاصة ببيئة الاختبار (harness) بشكل غير تفاعلي

## `split`

تقسيم train/dev/test بمجموعات منفصلة (group-disjoint)

**الوسائط (Arguments):**

- `corpus` — 

**الخيارات (Options):**

- `--test` *(مطلوب)* — 
- `--dev` — 
- `--seed` *(مطلوب)* — 
- `--out` *(مطلوب)* — 
- `--source-field` — 
- `--target-field` — 
- `--register` — تسجيل PREFIX-test / PREFIX-dev أيضًا في مساحة العمل

## `verify-split`

فحص انعدام التداخل (zero-overlap) في الملفات الموجودة

**الوسائط (Arguments):**

- `sides` — ملفات train/dev/test (أي مجموعة فرعية)

**الخيارات (Options):**

- `--source-field` — 
- `--target-field` — 

## `leak-audit`

فحص مجموعة نصوص (corpus) مقابل التقييمات المسجلة

**الوسائط (Arguments):**

- `corpus` — 

**الخيارات (Options):**

- `--strict` — فشل تام (hard-fail) عند وجود تطابقات في test/sealed
- `--clean-to` — كتابة الصفوف المتبقية هنا بدلاً من الفشل
- `--manifest` — 
- `--target-field` — 

## `sample`

عينة خزان (reservoir sample) محددة السقف لكل نوع

**الوسائط (Arguments):**

- `corpus` — 

**الخيارات (Options):**

- `--n` *(مطلوب)* — 
- `--cap` — 
- `--key` — 
- `--seed` *(مطلوب)* — 
- `--out` *(مطلوب)* — 

## `ledger`

فحص سجل التقييم (eval-ledger)

### `ledger show`

**الخيارات (Options):**

- `--set` — تقرير الإنفاق لمجموعة واحدة

### `ledger verify`

## `prereg`

التسجيل المسبق (preregistration)

### `prereg new`

**الوسائط (Arguments):**

- `id` — 

**الخيارات (Options):**

- `--eval-set` *(مطلوب)* — 
- `--predictions` *(مطلوب)* — ملف JSON: قائمة بكائنات التنبؤ (prediction objects)
- `--author` — 
- `--config-hash` — 
- `--consequences` — 

### `prereg check`

**الوسائط (Arguments):**

- `id` — 

**الخيارات (Options):**

- `--results` *(مطلوب)* — ملف JSON لبيان ScoreReport

## `score`

تسجيل الفرضيات (score hypotheses) على مجموعة مسجلة (فترات الثقة CIs دائمًا)

**الخيارات (Options):**

- `--eval-set` — 
- `--config` — مسار تكوين التشغيل (run-config): يوجه حزمة التقييم من كتلة التقييم الخاصة به (حزمة التقييم المسجلة، التجميع، المكونات الإضافية، أداة التوحيد canonicalizer، ربط التسجيل المسبق) — ملف واحد، تقييم كامل
- `--hyps` *(مطلوب)* — 
- `--config-hash` — 
- `--metric` — المسار المراد تسجيله (قابل للتكرار): chrf++، bleu، exact_match، comet، comet-qe، metricx (الافتراضي: chrf++/bleu/exact_match)
- `--target-lang` — رمز الهدف ISO 639-3 — يحدد نموذج المقياس العصبي الصحيح وتحذير الموارد المنخفضة الخاص به
- `--plugin` — المكون الإضافي لمقياس بروتوكول LYSS، 'module.path:ClassName' (قابل للتكرار)؛ تصبح مجاميعه الرقمية مسارات خاضعة لفترات الثقة (CI'd lanes)
- `--card-plugins` — تشغيل اكتشاف المكونات الإضافية لبيئة الاختبار (harness) لهذه اللغة (بطاقة evalMetrics + صلاحية FST + أدوات فحص السلوك behavioral linters)
- `--override-respend` — 
- `--json-out` — 

## `compare`

اختبار A/B على مجموعة مسجلة (مقيد بالتسجيل المسبق prereg-gated)

**الخيارات (Options):**

- `--eval-set` *(مطلوب)* — 
- `--hyps-a` *(مطلوب)* — 
- `--hyps-b` *(مطلوب)* — 
- `--label-a` — 
- `--label-b` — 
- `--config-hash` — 
- `--metric` — المسار المراد مقارنته (قابل للتكرار؛ الافتراضي chrf++) — يتضمن comet/comet-qe/metricx
- `--target-lang` — 
- `--plugin` — المكون الإضافي لمقياس بروتوكول LYSS (قابل للتكرار)
- `--card-plugins` — اكتشاف المكونات الإضافية لبيئة الاختبار (harness) لهذه اللغة
- `--override-respend` — 

## `synth`

تشغيل التوليف (synthesis) لحزمة لغة

**الوسائط (Arguments):**

- `pack` — مواصفة 'module.path:get_pack' (مثل nmt_forge_crk.pack:get_pack) أو اسم نقطة الإدخال لحزمة مثبتة (مثل crk)

**الخيارات (Options):**

- `--out` *(مطلوب)* — 
- `--seed` — 
- `--limit` — 

## `run`

تشغيل تدريب قابل للتكرار بأمر واحد

**الوسائط (Arguments):**

- `config` — 

## `evaluate`

إغلاق الحلقة: فك تشفير حزمة التقييم الخاصة بالتكوين باستخدام نقطة التحقق المحددة (SELECTED checkpoint) للتشغيل، وتسجيلها (فترات الثقة CIs، مقيدة بالتسجيل المسبق prereg-gated) والتشخيص التلقائي — بدون فك تشفير يدوي

**الوسائط (Arguments):**

- `run_manifest` — ملف run-manifest.json المكتوب بواسطة `nmt-forge run`

**الخيارات (Options):**

- `--config` — مسار تكوين التشغيل (run-config) (الافتراضي هو التكوين المضمن في بيان التشغيل)؛ يجب أن يحتوي على كتلة تقييم (eval block)
- `--out-hyps` — مكان كتابة فرضيات حزمة التقييم التي تم فك تشفيرها (الافتراضي: بجانب بيان التشغيل)

## `report`

إعادة تصيير (re-render) التقرير باللغة العادية من بيان تشغيل أو بيان حزمة تقييم

**الوسائط (Arguments):**

- `manifest` —
