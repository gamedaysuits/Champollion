---
title: "MCP Server — الواجهة الموجهة للوكيل"
sidebar_label: "MCP Server"
description: "اربط وكيل ذكاء اصطناعي بـ Champollion عبر Model Context Protocol: 23 أداة للترجمة، وتصفح قائمة انتظار التقييم المرجعي، وإجراء التقييمات، وتدريب النماذج — بالإضافة إلى تحديد الأدوات التي تحتاج إلى أكثر من مجرد npx install بدقة."
---

# خادم MCP — الباب المواجه للوكيل

يعرض `champollion-mcp-server` أداة Champollion لوكلاء الذكاء الاصطناعي عبر [Model Context Protocol](https://modelcontextprotocol.io). إذا كنت وكيلاً، أو تقوم بإعداد واحد، فهذا هو الباب: **23 أداة، و3 موارد، و3 مطالبات** عبر stdio.

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

**تعمل تسع من أصل 23 أداة من خلال تثبيت `npx` الأساسي. أما الأدوات الأربع عشرة الأخرى فتحتاج إلى برامج لا توفرها حزمة npm ولا يمكنها توفيرها.** وهي لا تفشل بصمت — حيث تُرجع كل منها خطأً قابلاً لاتخاذ إجراء يحدد ما هو مفقود — ولكن يجب أن تعرف الهيكلية قبل التخطيط بناءً عليها.

| الأدوات | هل تعمل بعد `npx`؟ | ماذا تحتاج أيضاً |
|---|---|---|
| `list_queue`, `get_queue_item`, `estimate_cost`, `search_languages`, `get_project_info`, `get_results`, `get_run_card`, `get_metric_reliability`, `get_training_guardrails` | **نعم** — للقراءة فقط، تُقدم من نقاط نهاية عامة | لا شيء |
| `translate` | لا | واجهة سطر الأوامر (CLI) لـ `champollion` (`npm i -g champollion`) ومفتاح API |
| `run_benchmark`, `get_run_status` | لا | بيئة التقييم (eval harness) — `pipx install mt-eval-harness` |
| أدوات `forge_*` الإحدى عشرة | لا | نسخة (clone) من المستودع الموحد (monorepo) مع تعيين `CHAMPOLLION_FORGE_DIR` إلى دليل `forge/` الخاص به؛ يتطلب تسجيل النقاط (scoring) أيضاً `mt-eval` |

إذا كنت تريد الواجهة بالكامل، فقم باستنساخ المستودع (clone) بدلاً من الاعتماد على `npx`.

## ماذا تفعل الأدوات

**تصفح العمل وحساب تكلفته.** تتنقل `list_queue` و `get_queue_item` في قائمة انتظار معايير القياس المفتوحة — وهي القائمة المصنفة للقياسات التي من شأنها تحسين الخريطة بأكبر قدر ممكن. تقوم `estimate_cost` بتسعير مجموعة من عمليات التشغيل قبل أن تنفق أي شيء.

**البحث عن الأشياء.** تبحث `search_languages` في بطاقات اللغات بالاسم، أو الرمز، أو العائلة، أو المنطقة. تقرأ `get_results` و `get_run_card` عمليات التشغيل المسجلة من لوحة الصدارة العامة. تجيب `get_metric_reliability` على السؤال الذي يخطئ فيه معظم الوكلاء — *أي مقياس يجب أن أثق به لهذه اللغة المستهدفة* — من خلال الارتباطات مع التقييمات البشرية لكل عائلة لغوية.

**التصرف.** تمرر `translate` النص عبر مسار المعالجة المُختبر، مع ذاكرة الترجمة (Translation Memory) (التكرارات لا تكلف شيئاً) وبوابة جودة حتمية. تبدأ `run_benchmark` عملية تقييم وتُرجع **معرف الوظيفة (job id) على الفور**، لأن عمليات التشغيل الحقيقية تستغرق وقتاً أطول من أي مهلة زمنية للعميل؛ يمكنك الاستعلام من `get_run_status` باستخدام هذا المعرف.

**التدريب دون خداع نفسك.** تُرجع `get_training_guardrails` القواعد المستخرجة من الإخفاقات الحقيقية المقاسة. تقوم أدوات `forge_*` الإحدى عشرة بتشغيل [NMT Forge](/docs/network/getting-started/training-honestly) — `forge_status` أولاً وبعد كل خطوة، و `forge_preflight` لمعرفة البوابات التي سيصطدم بها الأمر قبل أن يرفض.

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
