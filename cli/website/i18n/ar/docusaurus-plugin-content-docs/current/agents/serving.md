---
title: "التقديم والنشر"
slug: /agents/serving
description: "ضع نموذجًا تم قياسه قيد العمل: ملف deployment/1 الذي يكتبه nmt-forge export، وmt-eval translate وserve، وnmt-forge serve وصفحة التجربة الخاصة به، وعقد service-api/1 لـ /translate، وchampollion connect، وchampollion sync الموجّه بواسطة وكيل — مع ما يمكن وما لا يمكن للمخرجات المحلية فقط القيام به."
---

# التقديم والنشر

**النشر هو مسار القياس على مدخلات المصدر فقط.** يُحدد ملف
deployment/1 واحد الطريقة ونموذجها وبواباتها والزوج اللغوي.
ويُختبر الملف نفسه على مجموعة اختبار، ويُشغَّل على ملف ويُقدَّم كخدمة، بحيث يكون ما تم
قياسه هو ما يُشحن. هذه الصفحة هي الجانب المخصص للوكيل من صفحة
[ابدأ العمل](/docs/put-it-to-work).

في كل مكان: النموذج الذي تعلّم من جُمَل مصنفة على أنها محلية فقط يمكنه تكرارها،
لذا **فإن مخرجاته محلية فقط أيضاً**. تحتفظ كل أداة أدناه بتلك المخرجات
على هذا الحاسوب ما لم يوافق أصحاب البيانات على خلاف ذلك، وتُسجل
`--holders-agreed-by` من وافق على ذلك. **ملاحظة.** لا تُمرر هذه الراية إلا بالاسم
الذي أعطاك إياه الشخص، بعد أن يؤكد موافقة أصحاب البيانات.

## deployment/1

`$schema` `https://champollion.dev/schemas/deployment/1.json`. الحقول المطلوبة: `id`،
و`pair` (`source`، `target`، واختيارياً `target_script`)، و`method` (`method`،
واختيارياً `model`). الحقول الاختيارية: `gates` (ملف gate-chain/1) و`serve`
(`host`، الافتراضي `127.0.0.1`؛ `port`). المسارات نسبية لجذر المشروع،
حيث تُشغّل الـ rails الأوامر. ولا يذكر أي درجة تقييم.

**من يكتبه.** يكتب `nmt-forge export`، عندما يكون التصدير داخل مشروع rails
(أي يوجد `champollion.project.json` أعلاه)،
`deploy/<name>.json` — حيث `<name>` هي `--name` بصيغة kebab case، وإلا
`nmt-forge-<run>`:

```json
{
  "$schema": "https://champollion.dev/schemas/deployment/1.json",
  "id": "nmt-forge-<run>",
  "description": "nmt-forge <backend> model <run> (<src>→<tgt>), written by nmt-forge export <version>",
  "pair": { "source": "<src>", "target": "<tgt>" },
  "method": { "method": "local-model", "model": "<export>/model" }
}
```

لا يكتب أي شيء (ويعرض `no deployment file: …`) عندما يكون التصدير خارج
مشروع rails، أو عندما يُحدَّد النموذج في ظل خطاف فك ترميز (decode hook) (إذ يُشغّل `nmt-forge serve`
فقط خطافات forge)، أو عندما لا يحدد التكوين زوجاً، أو عندما يتعذر
التحقق من صحة المستند، أو عندما ينشر `deploy/<name>.json` بالفعل
نموذجاً آخر (لا يُستبدل أبداً).

**من يقرأه.**

```bash
mt-eval run --deployment deploy/<name>.json --corpus <test set>          # measure exactly what it serves
mt-eval translate --deployment deploy/<name>.json --source-file <input> --out <output>
mt-eval serve --deployment deploy/<name>.json
```

**القيود.** مع `--deployment`، يرفض `run` و`translate` كلاً من `--method`،
و`-m`/`--model`، و`--gates` و`--target-script` (*"--deployment … says the
method, its model, its gates and the target script; drop … (or change the
file)"*)؛ كما يرفض `serve` أيضاً `--pair`. وتُرفض المدخلات
التي تنتمي لزوج لغوي آخر (`deployment <id> translates from <src>; this input is in <x>`). والنشر الذي تتراجع فيه سلسلة البوابات
(falls back) يمكن ترجمته وتقديمه، لكن لا يمكن قياسه:
إذ يرفض `mt-eval run` السلسلة التي تتراجع
([الطرائق والبوابات](/docs/agents/methods#gate-chains)).

## ما يحتويه التصدير

يكتب `nmt-forge export <run-manifest.json> --prereg <id> --out <dir>`:

| المسار | ما هو |
|---|---|
| `<dir>/model/` | المجلد المراد نشره: الأوزان ومجزئ النصوص (tokenizer)، و`forge-model.json` (ما تدرّب عليه، `trained_on.terms`)، و`DEPLOY.md` |
| `<dir>/model/champollion-plugin/method.json` | method/1، النوع `nmt-checkpoint`، و`service.endpoint` `http://127.0.0.1:<port>/translate` (المنفذ 8378 ما لم يُحدد `--port`)، و`card.commercial_ready: false`، و`evidence` مع chrF++ لمجموعة الاختبار ومجالها وn |
| `<dir>/evaluation/` | أدلة مجموعة الاختبار. لا تنسخها مع النموذج أبداً |
| `<dir>/input-words.json` | كلمات جانب المدخلات لجُمَل التدريب، كلمة واحدة من كل منها، مرتبة (`words`، `english`، `sentences`، `from`، و`notes` يذكر ملف تدريب تعذرت قراءته كما قرأه التشغيل). بجانب `model/`، وليس بداخله أبداً: إنها كلمات من بيانات أهل اللغة. وتُكتب عندما يتضمن التصدير النموذج وتكون ملفات تدريبه على هذا الحاسوب؛ وإلا يذكر ملخص التصدير `input_words.written: false` مع `why`. يقرؤه `nmt-forge serve` لذكر الكلمات التي لم يرها النموذج قط ([أدناه](#words-the-model-never-saw)) |
| `<dir>/README.md` | ما يمثله التصدير |

## `mt-eval translate`

المسار على ملف، دون حساب درجات التقييم. يأخذ `--out` `.jsonl` (صف واحد لكل
مقطع: `id`، `source`، `output`، `error`، ومع البوابات `gates`،
`shipped_from`، `fallback`) أو `.tsv` (المصدر، علامة تبويب، المخرجات). وبدون `--out`
يكتب `<run id>.translations.jsonl` في مجلد المخرجات (`-o`).
وتحمل المخرجات شروط المدخلات — وشروط النموذج — في ملف جانبي بتنسيق set/1.

**قيد.** عندما تكون مخرجات الطريقة محلية فقط (أو مخرجات بديل سلسلة البوابات كذلك)،
تُرفض أي وجهة خارج المشروع قبل ترجمة أي شيء:
*"refusing to write …: what this method writes is local-only (…), and that is outside … — a place the data's holders did not choose. Only they can agree to that — ask them; if they do: --holders-agreed-by "<who
agreed>" (recorded in the file's sidecar; it stays marked local-only). Or write it inside the project"*.
ومع الموافقة، يُسجل الملف الجانبي `holders_agreed: {by, date}`؛ ويظل الملف محلياً فقط لجميع الأدوات.

يطبع `--json` `translated`، و`errors`، و`out`، و`run_id`، و`marked`،
و`holders_agreed` و`output_gates`. وتكون حالة الخروج 1 عند فشل كل صف. ويُرفض `--publish`:
فلا توجد درجات تقييم.

## `mt-eval serve`

| | |
|---|---|
| العنوان الافتراضي | `127.0.0.1:8379` (`--host` أو `--port` أو كتلة `serve` الخاصة بالنشر) |
| ما يُقدّمه | الطريقة التي تعمل في هذه العملية فقط: `lexicon` أو `local-model` أو إضافة يعلن ملف method.json الخاص بها `dependency_class` `S` أو `O`. ويُرفض نموذج اللغة الكبير (LLM) أو المحرك المستضاف |
| الرمز المميز | `MT_EVAL_SERVE_TOKEN`، من البيئة فقط. مطلوب للاستماع على أي عنوان بخلاف `127.0.0.1` أو `::1` أو `localhost`؛ وعند تعيينه، يكون مطلوباً في كل `POST` (وعلى الاسترجاع الداخلي (loopback) أيضاً). ولا يحتاجه `GET /health` أبداً |
| الحدود | نص بحجم 1,000,000 بايت، و500 مفتاح، و20,000 حرف لكل سلسلة نصية — وتجاوز أي منها ينتج عنه `413` |
| البوابات | `--gates <chain>` (أو `gates` الخاص بالنشر). يجب أن تُقيّم إضافة كل بوابة دون مراجع، وإلا فلن تبدأ. ويُسمح بالبديل هنا، ويجب أن يعمل داخل هذه العملية |

**قيد — خارج الاسترجاع الداخلي (loopback).** بدون رمز مميز: *"refusing to listen on … without a
token — anyone who can reach the port could use the method"*. وفي حال كانت المخرجات محلية فقط
ودون موافقة: *"refusing to serve on …: what this method writes is
local-only (…), and an address other machines can reach sends it off this
one. Only the data's holders can agree to that — ask them; if they do:
--holders-agreed-by "<who agreed>" (reported on /health), or keep --host
127.0.0.1"*. وتكون المخرجات محلية فقط عندما يشير الملف الجانبي للقاموس إلى ذلك (أو يتعذر
قراءته)، أو عندما يسجل `forge-model.json` في مجلد النموذج شروط تدريب محلية فقط
أو لا يسجل أياً منها؛ ويُبلَّغ عنها بأنها غير معروفة (`null`) لأي إضافة
أو مجلد نموذج لا يحتوي على `forge-model.json`.

يجيب `/health` بـ `status`، و`method`، و`model`، و`pair`، و`deployment` (`id`،
`sha256`)، و`runs` (في هذه العملية — لا يُرسل أي شيء إلى أي مكان)، و`scored`
(لا شيء)، و`output_gates` و`gates` (معرّف السلسلة، والبصمة، والبوابات، والبديل)،
و`output_local_only`، و`output_local_only_why`، و`holders_agreed_by`، و`license`
(`AGPL-3.0-or-later`)، و`source` (المستودع) و`version`.

مع وجود البوابات، يعود المقطع المرفوض وفقاً لما تحدده بوابته: `drop` — المفتاح
تحت `errors`؛ و`keep-source` — المصدر؛ و`flag` — المخرجات، المفتاح
المسمى في `meta.gates.flagged`؛ و`fallback` — ترجمة البديل إذا قبلتها
البوابات. وبدون بوابات لا يفحص أي شيء يرجعه.

## `nmt-forge serve`

```bash
nmt-forge serve <export>/model --detach        # a supervised background job
nmt-forge serve <export>/model --choose        # also record it as the people's choice
nmt-forge jobs                                 # list jobs
nmt-forge jobs stop <name> --wait 120
```

| | |
|---|---|
| العنوان الافتراضي | `127.0.0.1`، المنفذ `NMT_FORGE_SERVE_PORT` أو 8378 |
| الرمز المميز | `--token` أو `NMT_FORGE_SERVE_TOKEN`؛ مطلوب خارج الاسترجاع الداخلي. يأخذه `--detach` من البيئة فقط |
| المسارات | `GET /` — صفحة تجربة مخصصة للشخص (بدون رمز مميز؛ وتطلب رمزاً عند تعيين واحد)؛ و`GET /health`؛ و`POST /translate` (service-api/1)؛ و`POST /v1/chat/completions` (متوافق مع OpenAI)؛ و`GET /v1/models` |
| `--detach` | يعود بمجرد أن يجيب `/health`؛ ويتوقف إذا لم يجب خلال 120 ثانية. ويُرفض عندما يكون المنفذ يجيب بالفعل |
| `--no-hook` | التقديم بدون خطاف فك الترميز الخاص بالتشغيل (يُذكر ذلك في `/health` وفي `meta`) |
| `--allow-locale` | قبول رموز الإعدادات المحلية هذه أيضاً (قابلة للتكرار) |
| `--device` | `auto` (افتراضي) أو `cpu`. مع `auto`، فإن الخادم الذي يبدأ أثناء تشغيل مهمة تدريب للمشروع نفسه يستخدم وحدة المعالجة المركزية (CPU) بدلاً من مشاركة وحدة معالجة الرسومات (GPU)، ويذكر `/health` ذلك (`device_note`) |
| الحدود | نص بحجم 1,000,000 بايت، و500 مفتاح، و20,000 حرف لكل سلسلة نصية، و5,000 جزء من عمل النموذج لكل طلب — وتجاوز أي منها ينتج عنه `413`. يُطلب من النموذج 32 جزءاً في المرة الواحدة، لذا تنتظر الجملة من طلب آخر كتلة واحدة فقط، ولا تنتظر طلباً كاملاً أبداً. ويُرفض أي طلب لا يزال قيد التشغيل بعد 600 ثانية بالكامل — `503`، *"send fewer pieces at a time"* — ولا يُجاب عنه جزئياً أبداً |
| فك الترميز | بحث الحزمة (beam search) مع `num_beams` الخاص بالتصدير عندما يسجل التصدير `beams_applied` (كما تم قياس النموذج)؛ وخوارزمية جشعة (greedy) للتصدير الأقدم. يُطبَّع النص المُرسل إلى NFC، كما هي الحال في بيانات التدريب |

**قيد.** خارج الاسترجاع الداخلي، يُرفض النموذج الذي تكون مخرجاته محلية فقط — أي المدرَّب على
جُمَل محلية فقط، أو الذي لا يملك سجلاً بما تعلّم منه —
دون `--holders-agreed-by`. يُبلّغ `/health` عن `pair`، و`accepts`،
و`decode_hook`، و`run`، وتقارير التطوير والاختبار، و`score_caveats`، و`caveats`،
و`trained_on`، و`output_local_only`، و`holders_agreed_by`، و`device_note`،
و`limits` (`pieces_per_request`، `pieces_per_turn`، `request_seconds`)،
و`unseen_words_check`، و`text_pipeline` و`output_gates`. تحمل كل إجابة `/translate` من
نموذج محلي فقط الحقل `meta.output_local_only: true`، ويحمل كل
رد `/v1/chat/completions` الحقل `meta.output_local_only` (صحيح أو خطأ).
وعندما تقتطع حدود الطول أي جزء من الطلب، يُحصي `meta.cut` الخاص به
الجمل المقتطعة عند الدخول (`inputs`) والترجمات التي توقفت عند
الحد الأقصى (`outputs`) ([التدريب](/docs/agents/training#the-guarded-loop)).

**ملاحظة.** صُفحة التجربة مخصصة للشخص. يوجهه `try_translation` (MCP)
إليها في حالة النموذج المحلي فقط؛ ولا تستدعِ `/translate` بنفسك أبداً لقراءة
مخرجاته ([العقد](/docs/agents/contract) §1).

### كلمات لم يرها النموذج قط

الجملة التي تحتوي على كلمة لم يرها النموذج قط أثناء التدريب يُرجَّح بشدة أن تكون
مترجمة بصورة خاطئة، مهما بدت سلسة القراءة. في لغة الاختبار المبتكرة، تُرجمت
جملة اختبار محجوبة تتضمن كلمة دلالية لم يرها النموذج بشكل صحيح 0 مرة من أصل 358
(باستخدام ByT5-small عند 1,600 و6,400 و25,600 زوج تدريبي)،
وجاءت النتيجة خاطئة بثقة — سلسة، وكل كلمة ذات صيغة حقيقية، لكن المعنى
خاطئ — بنسبة 32% و55% و83% من الحالات: فكلما كان النموذج أفضل، كان
تخمينه أكثر إقناعاً. لذلك يذكر الخادم تلك الكلمات بالاسم.

- **`/health`** يوضح ما إذا كان قادراً على ذلك: `unseen_words_check` هو `{on: true,
  words_seen: <count of words in input-words.json>, notes}` or `{on: false,
  why}`.
- **`/translate`** يضيف، فقط عندما يحتوي الطلب على مثل هذه الكلمات،
  `meta.unseen_words` (المفتاح ← كلمات نص هذا المفتاح التي لم يرها النموذج
  قط، مرة واحدة لكل منها، بالترتيب) و`meta.unseen_note`. يضيف **`/v1/chat/completions`**
  الشيء نفسه، مرتبة بحسب ما طُلب: `SEG_<id>` لكل مقطع في وضع
  الكتلة، و`page` للصفحة، أو مفاتيح كائن JSON نفسه، أو `text`.
- **غياب السجل، يُذكر في كل رد.** يقرأ الخادم `input-words.json`
  من المجلد الموجود فوق مجلد النموذج الذي يقدمه. وفي حال عدم وجود أي سجل هناك —
  export made before 2026-10-13, one made without its training files on this
  حاسوب، أو مجلد نموذج نُسخ بعيداً عن تصديره — يذكر حقل `meta.unseen_check`
  في كل رد أنه لا يستطيع التحقق، ولماذا. قدّم النموذج من
  export, or export it again.
- **صفحة التجربة** تضع علامة على السطر: *"Never seen in training: … — this line is
  very likely wrong, however fluent it reads."*

الكلمة هي تتابع من الحروف بأي نظام كتابة (مع الاحتفاظ بعلامات الفصل بداخلها)،
بأحرف صغيرة، وبصيغة NFC. وعندما يكون جانب المدخلات باللغة الإنجليزية، فإن النهاية
الإنجليزية البسيطة تُعتبر مرئية في كلا الاتجاهين (رؤية `walk` ← يُحتسب `walked`؛ ورؤية `walked`
← يُحتسب `walk`).

## service-api/1 — عقد `/translate`

`$schema` `https://champollion.dev/schemas/service-api/1.json`، ملتزم بـ
`shared/test-fixtures/framework/service-api-vectors.json` (يُشغَّل مقابل
`mt-eval serve` و`nmt-forge serve`).

- **الطلب** `POST /translate`: `keys` (المفتاح ← سلسلة نصية للمصدر؛ مطلوب)،
  واختيارياً `source_locale`، و`target_locale`، و`method`، و`text_format`
  (`"markdown"` لنص المستند)، و`instructions` (المفتاح ← ملاحظة؛ تُرسل فقط إلى
  خادم مُعلن عن اتباعه لها، `accepts_instructions`). يُتجاهل الحقل الذي لا يستخدمه الخادم،
  ولا يُرفض أبداً.
- **الاستجابة:** `200` `{translations, meta}` — `meta` مطلوب؛ ويضيف `207`
  `errors` (المفتاح ← `{message}`). الأخطاء تكون `{error: {message}}`: `400` لطلب
  لا يمكن قبوله، و`401` لرمز مفقود أو غير صحيح، و`404` لمسار
  غير معروف، و`413` للحجم الزائد، و`500` لفشل الطريقة — ولا توجد إجابة جزئية أبداً.
  (يجيب `nmt-forge serve` أيضاً بـ `503` للطلب الذي يتجاوز حد الـ 600 ثانية).
- **`meta`:** `method`، و`model`، و`output_gates`، و`output_local_only`
  (true أو false أو null)، و`cost_usd`؛ ويجوز للخوادم إضافة حقول.
- **`GET /health`** يتطلب `status` (`ok`)، و`pair`، و`output_gates` و`output_local_only`؛
  واختيارياً `output_local_only_why`، و`holders_agreed_by`،
  و`model`، و`method`.
- **القاعدة:** الخادم الذي يذكر `/health` الخاص به `output_local_only: true` يضع
  `output_local_only: true` في `meta` لكل استجابة، ولا يكتب العميل
  مثل هذه المخرجات إلا في المكان الذي وافق عليه أصحاب البيانات.

## `champollion connect`

```bash
champollion connect <export>/model --app <app folder>
champollion connect <export>/model --app <app folder> --holders-agreed-by "<who agreed>"
```

يعثر على `method.json` (الملف المسمى، أو `method.json`،
أو `champollion-plugin/method.json`، أو `model/champollion-plugin/method.json` في
المجلد)، ويثبته في `.champollion/methods/` الخاص بالتطبيق، ويوجه
كلاً من أزواجه (`<inputLocale>:<target>`) إليه بصفته `methodPlugin`، مع الاحتفاظ
ببقية الزوج. يحتاج مجلد التطبيق إلى `champollion.config.json`، ويجب أن تترجم
الطريقة من `inputLocale` الخاص بالتطبيق.

**قيد.** يُرفض النموذج الذي تكون مخرجاته محلية فقط — والمعروف من
`forge-model.json` الخاص به (ويُعتد بالمفقود أيضاً)، أو من `/health` لخدمته —
دون `--holders-agreed-by`: لأن ما يكتبه في ملفات الإعدادات المحلية للتطبيق
يُنشر مع التطبيق. ومع وجوده، يسجل كل زوج
`holdersAgreed: {by, date, method, what}`. ويُحذّر، دون فشل، عندما
لا يجيب أي شيء عند نقطة النهاية (يشغله `nmt-forge serve <dir> --detach`)
أو عندما لا يتبع `/health` مواصفة service-api/1. يطبع `--json` `method`،
و`kind`، و`pairs`، و`endpoint`، و`answering`، و`health_problems`،
و`holders_agreed_by`.

## `champollion sync`، بقيادة وكيل

يترجم `sync` ملفات الإعدادات المحلية لتطبيق أو موقع باستخدام الطرائق
التي يحددها `champollion.config.json` الخاص به. ولا يطلب أي شيء بشكل تفاعلي.

```bash
champollion sync --dry-run --json      # what would be sent, and its estimated cost
champollion sync --max-cost 2 --json   # stop before any call if the estimate is over $2, or unknown
champollion verify                     # placeholders, scripts, key parity
```

**مخرجات `--json`** تكون كائن JSON واحداً في كل سطر. على stdout: `{level: "info" |
"ok", message}`, events `{level: "event", event: "cost" | "file" | "verify" |
"request", …}`, and last `{level: "summary", command: "sync", …}` مع
`dryRun`، و`totalProcessed`، و`totalFailed`، و`totalHeld`، و`tmHits`،
و`sentToModel`، و`verify` (`ran`، `errors`، `warnings`)، و`failedPairs`،
و`locales`، و`costEstimate` والمزيد؛ ويضيف التشغيل التجريبي `preflight`، و`realRun`
(`exitCode`، `wouldStop`، `reasons`) و`maxCost`. على stderr: `{level: "warn"
| "error", message}`. A hard error prints a summary with `ok: false` و
`error`.

| الخروج | المعنى |
|---|---|
| 0 | سليم |
| 1 | لم يتطابق اسم `--redo` أو `--force-keys` مع أي مفتاح؛ إخفاقات دون معالجة أي شيء؛ خطأ |
| 2 | أوقفه `--max-cost` قبل أي استدعاء (أو كان التقدير غير معروف)؛ أو خروج جزئي: فشل شيء ما، أو حُجبت مفاتيح، أو فُقدت صيغ الجمع، أو عثر التحقق على أخطاء |

لا يرسل التشغيل التجريبي أي شيء ولا يكتبه، ولا يجري تحققاً، ويخرج بالحالة 0 ما لم
يتطابق مفتاح مسمى مع لا شيء أو حدث خطأ. ويُشغَّل التحقق بعد المزامنة الحقيقية
ما لم يُحدد `--no-verify`.

**قيد — الإجابات المحلية فقط.** بالنسبة لطريقة `api`، فإن الدفعة التي يكون
`meta.output_local_only` الخاص بها `true` لا تُكتب ما لم يسمِّ `holdersAgreed` الخاص بالزوج
تلك الطريقة؛ ويذكر `sync` ذلك مرة واحدة، ويسمي
استدعاء `champollion connect … --holders-agreed-by`. وتظل تلك المفاتيح
دون ترجمة (أو تنتقل إلى بديل الزوج).

**قيد — طريقة `local`.** تطلب طريقة `local` (نقطة نهاية متوافقة
مع OpenAI) `/health` الخاص بالخادم مرة واحدة. وعندما يشير إلى
`output_local_only: true` — كما يفعل `nmt-forge serve` لنموذج مدرَّب على
جُمَل محلية فقط — لا يُكتب أي شيء من ذلك الخادم ما لم يسمِّ `holdersAgreed`
الخاص بالزوج `local`: *"the model at … says what it writes is
local-only … nothing from it was written"*، متبوعاً باستدعاء
`champollion connect <the model> --holders-agreed-by "<who agreed>"`. أما الخادم
الذي لا يجيب `/health` الخاص به أو لا يقول `true` (مثل خادم Ollama أو
LM Studio، على سبيل المثال) فيُستخدم كما في السابق.

**ملاحظة.** صِل نموذج forge باستخدام `champollion connect` (مسار `api`):
فهو يقرأ سجل النموذج الخاص بما تعلّم منه، ويسجل
موافقة أصحاب البيانات على الزوج تحت الطريقة التي يثبتها.

**كلمات لم يرها النموذج قط.** عندما يحدد خادم forge مفاتيح في
`meta.unseen_words`، تُحذّر طريقتا `local` و`api` بالمفاتيح —
وليس بالنص أو الكلمات أبداً: *"<API batch N | Local method>: <n> key(s) hold
words the model never saw in training — very likely mistranslated, however
fluent; have a speaker check them: <up to 20 keys>"* (ثم *"and <n> more"*).
ولا يزال يتم كتابة الترجمات؛ والتحذير هو وسيلة الناس لمعرفة ما يجب
التحقق منه ([التوجيه](/docs/agents/coaching)).

**ملاحظة.** مرّر كل سطر `warn`. فالنصوص المترجمة آلياً تظل مسودات
حتى يراجعها متحدث باللغة؛ ولا تصفها بالصحيحة أبداً.

## `champollion serve`

خادم مختلف: يقدم حزمة الترجمة المهيأة الخاصة **بمشروع التطبيق**
(الطريقة، والتوجيه، وذاكرة الترجمة، وبوابة الجودة) إلى
المشاريع الأخرى. الإعدادات الافتراضية `127.0.0.1`، المنفذ 1822. ويتطلب رمز حامل (bearer token)
حتى على الاسترجاع الداخلي (`--token` أو `CHAMPOLLION_SERVE_TOKEN`، بحد أدنى 12
حرفاً) ما لم يُحدد `--no-auth`، والذي يُقبل فقط عند الربط بالاسترجاع الداخلي.
يكتب `--emit-manifest` بيان method/1 من نوع `service` للمستهلكين.
ويكون `/health` الخاص به هو `{ok, service, version}`، وليس مستند صحة
service-api/1، لذا يُبلّغ `champollion connect` عن مشاكل الصحة الخاصة به.

## تعمّق أكثر

- [ابدأ العمل](/docs/put-it-to-work) — نسخة أهل اللغة.
- [الطرائق والبوابات](/docs/agents/methods) — method/1 وgate-chain/1.
- [قواعد البيانات والنقل](/docs/agents/data-rules) — محلي فقط و
  `holders_agreed`.
- [نموذج rails](/docs/agents/rails-model) — المسار الموحد.
- [مرجع `mt-eval`](/docs/reference/mt-eval) و
  [مرجع `nmt-forge`](/docs/network/getting-started/forge-command-reference).
- ترجمة التطبيقات والمواقع: [التكامل والتسليم المستمر (CI/CD)](/docs/guides/ci-cd)،
  [استكشاف الأخطاء وإصلاحها](/docs/guides/troubleshooting).
