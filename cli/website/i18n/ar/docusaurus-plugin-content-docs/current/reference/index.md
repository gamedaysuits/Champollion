---
title: "المرجع"
slug: /reference
description: "كل التفاصيل التقنية في خريطة واحدة: الأوامر، وصيغ الملفات، والمواصفات، والحدود التقنية، واستضافة اختبار مغلق، ولوحة الصدارة، وترجمة التطبيقات والمواقع، وAtlas، والبنية التحتية للشبكة."
---

# المرجع

السجل التقني الكامل، للمطورين والباحثين ووكلاء الذكاء الاصطناعي.
تروي [صفحات المستخدمين](/docs/) القصة نفسها بكلمات مبسطة،
ويبيّن [دليل الوكلاء](/docs/agents) كيفية قيادة الوكيل لها؛ وتوضح كل صفحة
أدناه التفاصيل بدقة تامة.

## الأوامر

- [`champollion`](/docs/reference/cli) — كل أمر وخيار لأداة المشروع
  ومترجم التطبيقات والمواقع.
- [`nmt-forge`](/docs/network/getting-started/forge-command-reference) — كل
  أمر لحزمة تدريب النماذج، مُولَّد من المحلل الخاص بها.
- [`mt-eval`](/docs/reference/mt-eval) — كل أمر لبيئة
  التقييم، مُولَّد من المحلل الخاص بها.
- [خادم MCP](/docs/network/getting-started/mcp-server) — كِلا الملفين التعريفيين،
  وكل أداة وكل وسيط.

## التنسيقات

- [تنسيقات أطر العمل](/docs/reference/formats) — project/1، وset/1، وmethod/1،
  وgate-chain/1، وdeployment/1، وservice-api/1، استنادًا إلى مخططاتها.
- [بطاقة التشغيل](/docs/network/specifications/run-card) — ما تسجله
  عملية تشغيل مُقيَّمة وتنشره.
- [بيانات التوجيه](/docs/concepts/coaching-data) — الملاحظات النحوية وقوائم
  الكلمات المُقدَّمة لطريقة تعتمد على LLM.
- [مواصفات الإضافة](/docs/reference/plugin-spec) — بيان إضافة الطريقة
  (`method.json`) الذي تُشحن طريقة الترجمة كجزء منه.
- [بطاقة اللغة](/docs/reference/language-card-spec) — مخطط البطاقة
  في الأطلس.

## المواصفات

- [تسجيل النقاط](/docs/network/specifications/scoring) — معيار تسجيل النقاط/1: النتيجة
  الرئيسية لمقياس chrF++ للمدونة مع فترة التمهيد بنسبة 95%، والمقاييس القياسية
  بجانبها، والإجراءات التشخيصية المفصولة عنها.
- [الدلالة الإحصائية](/docs/network/specifications/significance) — الاختبارات المقترنة،
  ومتى تكون عملية تشغيل أفضل من أخرى.
- [واجهة الطريقة](/docs/network/specifications/methods) — ماهية الطريقة،
  وفئاتها واعتمادياتها.
- [موثوقية المقياس](/docs/network/specifications/metric-reliability) —
  المقياس الموثوق به لكل نوع من اللغات، استنادًا إلى التقييمات البشرية.
- [المعيار المرجعي](/docs/network/specifications/benchmark) — البروتوكول الذي تتبعه
  كل عملية تشغيل صالحة.
- [بيئة التقييم](/docs/network/specifications/harness) — كيفية قيام `mt-eval`
  بالتشغيل وتسجيل النقاط والنشر.
- [التحقق بواسطة المتحدثين](/docs/network/specifications/speaker-validation) — المراجعة
  البشرية التي تنوب عنها الدرجات الآلية.

## الحدود التقنية

- [الحدود التقنية](/docs/network/honest-limitations) — ما لا يُدَّعى:
  مستويات الثقة المُبلَّغ عنها ذاتيًا، وعدم وجود مراجعة من المتحدثين حتى الآن، وحضانة الاختبارات المغلقة، وعدم وجود ثقة على مستوى كل جملة.

## استضافة اختبار محكم

- [إجراء مسابقة سيادية](/docs/network/sovereignty/run-a-sovereign-contest)
  — دليل التشغيل الشامل لمجموعة اختبار لا تغادر جهاز المضيف أبدًا.
- [عقدة التقييم السيادية](/docs/network/sovereignty/sovereign-eval-node) — جهاز
  تسجيل النقاط: العتاد، والعزل عن الشبكة، ومراسم المفاتيح.
- [تسجيل المدونات](/docs/network/sovereignty/registering-corpora) —
  مستويات الإتاحة ومسارات الترخيص لمدونة بحوزتك.
- [الملكية والشروط](/docs/network/sovereignty/ownership-transfer) و
  [نماذج الشروط](/docs/network/sovereignty/terms-templates) — ما تتنازل عنه
  المشاركة، والمُعلن عنه قبل مشاركة أي شخص.
- [الجوائز](/docs/network/specifications/prizes) — ما تتطلبه الجائزة، إذا
  أطلق راعٍ واحدة منها.

## لوحة الصدارة والنشر

- [لوحة الصدارة والنشر](/docs/reference/leaderboard) — ماهية اللوحة،
  ونوعا المعايير المرجعية، وما تحمله عملية التشغيل المنشورة.
- [قواعد التقديم](/docs/network/leaderboard/rules) — ما هو مقبول،
  وما هو مستبعد، ومستويات التحقق.
- [مجموعات بيانات التقييم](/docs/network/leaderboard/datasets) — مجموعات
  البيانات المسجلة ومسارات تراخيصها.
- [تقديم طريقة](/docs/network/getting-started/submit-a-method) — تشغيل
  بيئة التقييم ونشر بطاقة تشغيل.
- [المساهمة بالقوة الحسابية](/docs/network/getting-started/contributing-compute) —
  تشغيل عناصر من قائمة الانتظار العامة بمفتاحك الخاص.
- [الأسئلة الشائعة](/docs/network/getting-started/faq) — المقاييس، والنماذج،
  وFSTs، والاستبعاد.

## ترجمة التطبيقات والمواقع

- [ترجمة التطبيقات والمواقع](/docs/intro) — ما يقوم به `champollion sync`، ودليل
  لكل صفحة عنه: البدء السريع، والتثبيت، والإعداد، وأطر
  العمل، وCI/CD، والطرائق، والمحتوى، وذاكرة الترجمة، وبوابة الجودة،
  والأمان، والبرامج النصية، والمترجمون، واستكشاف الأخطاء وإصلاحها.

## الأطلس

- [الأطلس](/docs/atlas) — ماهية فهرس اللغات ومصدر حقائقه.
- [مواصفات بطاقة اللغة](/docs/reference/language-card-spec) و[إجراء
  التوثيق](/docs/reference/language-card-citation-procedure) —
  كل حقل، وكيفية توثيق كل منها.
- [ما يُعد لغةً](/docs/network/context/what-counts-as-a-language)
  — الإجابات التي يقدمها الفهرس، وسبب ذلك.
- [التقديم إلى الفهرس](/docs/network/getting-started/submit-to-the-index) و[الإبلاغ
  عن الأخطاء](/docs/network/perspectives/reporting-errors-and-owning-corrections)
  — اقتراح مدخل أو تصحيح.

## البنية التحتية للشبكة

- [بناء قائمة الانتظار](/docs/network/specifications/queue-construction) و[سبب
  بناء قائمة الانتظار بهذه الطريقة](/docs/network/perspectives/why-the-queue)
  — كيف ترتب قائمة العمل العامة ما يجب قياسه تاليًا.
- [قوة الاتصال](/docs/network/specifications/connection-strength) —
  ما يوضحه القوس على خريطة الشبكة حول زوج لغوي، ومدرج القوة
  الذي أُحيل إلى التقاعد.
- [المساهمة بالقوة الحسابية](/docs/network/getting-started/contributing-compute) —
  تشغيل قائمة الانتظار.
