---
title: "استضافة اختبار مغلق، والانضمام إلى مشروع"
slug: /agents/hosting-and-joining
description: "طريقتان للمشاركة بخلاف البناء: استضافة اختبار مغلق باستخدام mt-eval contest وmt-eval node (الميزة تعمل، لكنها ليست على المسار بعد، ويحتفظ الأمناء الذين اختارهم المنظِّم بحصص المفتاح)، والانضمام إلى مشروع مسجل باستخدام mt-eval project — كل أمر، وما يرسله وإلى أين، وما لا يعرضه إطلاقًا."
---

# استضافة اختبار محكم، والانضمام إلى مشروع

مساران بجانب مسارات البناء. كلاهما من أوامر `mt-eval` الصريحة؛ ولا يمثل أي منهما خطوة يذكرها `champollion next` بالاسم.

## استضافة اختبار محكم

**الوضع الفعلي بكل وضوح.**

- الأمر يعمل: إعداد مجموعة محكمة، ومراسم المفاتيح، وتشغيل المشاركات على عقدة معزولة عن الشبكة، والقرارات والترتيب، كلها أوامر تخضع لاختبارات تحقق.
- **ليس ضمن المسارات الموجهة بعد.** يُرفض `champollion new --kind task`؛ والمسار الوحيد المتاح هو مسار اللغة. توقَّع خطوات يدوية أطول، واتبع [دليل تشغيل المسابقة](/docs/network/sovereignty/run-a-sovereign-contest).
- **يحتفظ بحصص المفاتيح أمناء يُسميهم المنظّم.** لا يوجد في الكود ما يعينهم أو يدقق في أهليتهم. ولم يُعيَّن أي أمناء مفاتيح مجتمعيين لأي اختبار بعد.
- **لا يحتفظ Champollion بأي حصة مفتاح ولا بأي مفتاح خاص.** تُجرى المراسم على جهاز المنظّم، ولا يُرسل التسجيل سوى المعرّفات والملخصات المشفرة وعتبة التأهيل — دون إرسال أي مفتاح أو حصة أو الجمل إطلاقاً.

**ملاحظة.** تحدد الاستضافة مصير جُمَل الأفراد والجهات التي يمكنها فتح قفلها. كل خطوة أدناه هي قرار يعود للمنظّم؛ ولا تُنفذ أي خطوة إلا بطلب صريح منه.

### ما يتم إنشاؤه

يقسم `mt-eval contest prepare` مجموعة نصوص المنظّم:

| الراية | المجموعة | من يراها |
|---|---|---|
| `--dev-size` (مطلوب) | مجموعة التأهيل: المصدر والمراجع | عامة، تُطرح من `<out>/public/` |
| `--secret-size` | الاختبار المحكم الذي تُسجَّل المسابقة بناءً عليه | لا أحد: محكم الإغلاق في `<out>/local/` |
| `--sealed-holdout-size` (يتطلب `--secret-size`) | قسم محكم ثانٍ، يُقيَّم لكن تُحجب نتائجه حتى الإغلاق | لا أحد |

تعد `--seed` و`--qualifier-threshold` (أكبر من 0) و`--license` مطلوبة — فلا يُفترض وجود أي ترخيص مسبقاً. كما يُطلب `--custodian-group` و`--threshold-pubkey` (المفتاح الذي تُشفَّر المجموعات المحكمة باستخدامه). يُحذف النص الصريح لكل مجموعة محكمة بعد الإحكام؛ ويحتفظ `<out>/local/manifest.json` بالوصفة ولا يغادر الجهاز أبداً. تتضمن عملية الإحكام تشغيل `champollion network seal-corpus seal`، لذا يجب أن تكون واجهة سطر أوامر `champollion` مثبتة.

### الحضانة

**الحضانة عبر العتبة (M من N).** على العقدة المعزولة عن الشبكة:

```bash
mt-eval node ceremony init --dir <ceremony> --set <sealed set id> --group <group id> --quorum 3 --shares 5 \
  --custodian <name 1> --custodian <name 2> --custodian <name 3> --custodian <name 4> --custodian <name 5>
mt-eval node ceremony share --dir <ceremony> --custodian <name 1> --dest <their token>
mt-eval node ceremony verify --dir <ceremony> --share <a> --share <b> --share <c>
mt-eval node ceremony share --dir <ceremony> --wipe-originals
```

يُولّد `init` المفتاح، ويقسمه بمخطط شامير (Shamir) ويصفّره في استدعاء واحد؛ ويكتب `ceremony.json` (السجل العام) وملف حصة واحداً لكل أمين. يجب أن يكون `--set` معرّف المجموعة السرية و`--group` هو `--custodian-group` الذي سيستخدمه أمر الإعداد (prepare) — فالإعداد لا يتحقق منهما، ولا يُكتشف عدم التطابق إلا عند رفض التشغيل. مرّر سجل المراسم إلى أمر الإعداد: `--threshold-pubkey <ceremony>/ceremony.json`.

**قفل.** لا يُفك تشفير المجموعة المحكمة إلا عبر `mt-eval node run-method <id>
--offline --share … --share …` باستخدام ما لا يقل عن M من الحصص من أمناء مختلفين تتطابق معرّفاتهم مع المجموعة. لا تعمل الحضانة عبر العتبة إلا في هذا المسار غير المتصل بالإنترنت.

**مفتاح فردي.** يُنشئ `champollion network seal-corpus keygen --out <dir>` زوج مفاتيح واحداً؛ ويمكن لأي شخص يحمل ملف مفتاحه فك التشفير بمفرده. وهذا ما يستخدمه مسار العقد المتصلة.

### الخطوات الإجرائية للمنظّم (الحضانة عبر العتبة)

```bash
mt-eval node bundle --out <bundle>                    # on a connected machine: the node's install
mt-eval node bundle --verify <bundle>                 # on the node
mt-eval node keygen --out <keys>
# the ceremony, above
mt-eval contest prepare --corpus master.json --slug <slug> --name "<name>" --pair '<src>><tgt>' \
  --dev-size <n> --secret-size <n> --seed <n> --qualifier-threshold <chrF++> --license <licence> \
  --custodian-group <group id> --threshold-pubkey <ceremony>/ceremony.json --out ./<slug> --no-register
mt-eval contest register --manifest ./<slug>/local/manifest.json
mt-eval node init --from-contest ./<slug>
mt-eval node egress-check
mt-eval node import-bundle <exchange>                 # entries, carried in
mt-eval node run-method <request id> --offline --share <s1> --share <s2> --share <s3>
mt-eval node export-scores <exchange>
mt-eval node verdicts --contest <slug> --out verdicts.json --metric chrf_plus_plus --tie-test ar \
  --alpha <a> --n-resamples <n> --seed <n>
mt-eval contest rank <slug>
mt-eval contest close <slug> --node-verdicts verdicts.json --verify-key <score-signing public key>
```

يضبط `node init --from-contest` الحضانة عبر العتبة عندما تكون المجموعة قد أُحكمت بمفتاح المراسم. يتأهل المشاركون عبر مجموعة التطوير العامة (`mt-eval contest qualify`) and submit methods or models (`mt-eval contest submit-method`، `mt-eval contest submit-model`، كلاهما باستخدام مسار `--offline --bundle-out`). يتضمن [دليل العقدة](/docs/network/sovereignty/sovereign-eval-node) جميع أوامر العقد.

### ما يتطلب اتصالاً، ومن صاحب الاتصال

| يعمل دون اتصال | يتطلب تسجيل الدخول | يتطلب مفتاح خدمة قاعدة البيانات |
|---|---|---|
| `contest prepare --no-register` و`contest qualify` (مع `--offline-qualifier-id`، `--offline-threshold`) و`contest validate` و`submit-* --offline` وكل `node ceremony` و`node seal` و`node keygen` و`node init` و`node import-bundle` و`node run-method --offline` و`node export-scores` و`node verdicts` و`node egress-check` | `contest register` و`contest create` و`submit-*` المتصل بالإنترنت و`contest open-intake` و`contest close-intake` و`contest close` | `contest prepare` دون `--no-register` أو `--self-serve`، و`node serve` و`node list` و`node approve` و`node deny` و`node run-method` المتصل بالإنترنت و`node relay`، و`contest close` عند حجب النتائج |

يعود مفتاح الخدمة إلى الجهة التي تدير قاعدة البيانات. ويقوم المنظّم الخارجي بتشغيل هذه الأوامر على قاعدة بيانات خاصة به (`MT_EVAL_SUPABASE_URL` ومفاتيحها)، أو يلتزم بالمسار غير المتصل بالإنترنت — الذي يمكن التحقق من درجاته عبر بياناته الموقعة ولكنها لا تُدرج في لوحة النتائج العامة. **ملاحظة.** لا تضبط أبداً `MT_EVAL_ALLOW_PROD`: فهذا يلغي رفض الأدوات للكتابة في قاعدة بيانات الإنتاج الافتراضية، وهذا ليس قراراً يتخذه الوكيل.

## الانضمام إلى مشروع

**المشروع المسجل** هو مشروع لغوي أدرجه صاحبه ليتمكن الآخرون من المساعدة، عبر الملفات: الجمل، أو قوائم الكلمات، أو الطرق (لم يُتح وقت المراجعة والموارد الحاسوبية بعد). تتواصل أوامر `mt-eval project` أدناه مع قاعدة بيانات المشروع (`MT_EVAL_SUPABASE_URL`). يتطلب كل أمر فرعي تسجيل الدخول (عبر جلسة مخبأة، أو `MT_EVAL_REFRESH_TOKEN`، أو تسجيل دخول تفاعلي عبر GitHub أو Google)، باستثناء `list` (مجهول الهوية) و`review` (الخاص بالمشغّل)؛ ويكون الحساب هو البريد الإلكتروني المستخدم في تسجيل الدخول.

**القواعد.**

- **المراجعة قبل الإدراج.** يبدأ المشروع الجديد بالحالة `pending_review`؛ ولا يُدرج إلا بعد المراجعة. يمكن للمالك إغلاق المشروع، دون أن يُدرجه أبداً.
- **يُسمّى المالك كما يشاء** (`--owner-name`). لا يحتوي صف المشروع على بريد إلكتروني؛ ويبقى حساب المالك منفصلاً ولا يمكن لأحد قراءته سواه.
- **لا يظهر أي بريد إلكتروني في القائمة.** الأمر `project list` مجهول الهوية ويعرض الأسماء والأعداد؛ ويطبع `project offers` المساعدين بالاسم الذي قدموه (`--as`). لا يزال بإمكان حساب المالك قراءة البريد الإلكتروني لحساب المساعد في سجل العرض، كما تسجل مذكرة الموافقة كلا الحسابين.
- **العروض مشتركة بين الطرفين.** يؤدي القبول إلى كتابة مذكرة موافقة تذكر من قدّم العرض ومن خوّله.
- **لا يُطبع أي محتوى من الملفات.** تقتصر الطباعة على الأسماء والأعداد والحالات فقط.

### المالك

```bash
mt-eval project register --project . --name "<project name>" --owner-name "<as they want to be named>" \
  --purpose "<what the translations are for>"
mt-eval project ask <slug> --kind sentences --what "<what would help>" --how-many 200 --terms "<their terms>"
mt-eval project offers <slug>
mt-eval project accept <offer id> --into .
mt-eval project decline <offer id> --why "<reason>"
```

- يقرأ `register` الزوج اللغوي من `champollion.project.json` (والغرض أيضاً، ما لم يُحدد `--purpose`)؛ المعاملات الاختيارية هي `--slug` و`--domain` و`--register` و`--about`. بحد أقصى 5 عمليات تسجيل لكل حساب خلال 24 ساعة.
- تكون قيمة `ask` `--kind` هي `sentences` أو `word-list` أو `method`؛ وتظهر الطلبات فقط أثناء إدراج المشروع.
- يُنزّل `accept` الملف، **ويتحقق من قيمة sha256 الخاصة به** (يُرفض في حال عدم التطابق)، ويكتب `inbox/offer-<offer id>-<file name>` و`consent/offer-<offer id>.json` (`offer_id`، `file`، `sha256`، `submitted_by`، `authorized_by`، `terms`، `note`، `held_by`)، ثم يُعلّم العرض بأنه مقبول. يُدرج الملف بعد ذلك كأي ملف آخر — `champollion data add inbox/<file>` — وتُطلب شروط أصحابه.
- **ملاحظة.** توجد `--terms` الخاصة بالمساعد في مذكرة الموافقة. ويجب ألا تؤدي الإجابات التي تسجلها باستخدام `champollion data mark` إلى التساهل فيها أو تخفيف قيودها.

### المساعد

```bash
mt-eval project list
mt-eval project offer <slug> <file> --as "<your name>" --terms "<what it may be used for>" --ask <ask id> --note "<note>"
mt-eval project withdraw <offer id>
```

- يرفع `offer` ملفاً واحداً غير فارغ بحجم لا يتجاوز 50 ميغابايت إلى التخزين الخاص بالمشروع، مصحوباً برمز sha256 الخاص به، إلى مشروع مدرج فقط. وبحد أقصى 24 عرضاً لكل مساعد خلال 24 ساعة.
- ينتقل العرض مرة واحدة فقط: `offered` ← `accepted` أو `declined` أو `withdrawn`.
- **ملاحظة.** يؤدي سحب العرض أو رفضه إلى تغيير حالته؛ ولا يحذف الملف المرفوع من وحدة التخزين. بيّن ذلك للمساعد قبل أن يقدم أي ملف قد يرغب في استعادته أو حذفه.
- **قفل.** يقرأ `offer` الملف الجانبي التابع للملف (sidecar) قبل رفع أي شيء. ويرفض أي ملف من نوع `local-only`، أو مجموعة `sealed`، وأي ملف يحمل `speakers_agreed` بالقيمة `not-yet` أو `some-said-no`؛ وإذا تعذرت قراءة الملف الجانبي يتوقف تقديم العرض. ولا يمكن تجاوز ذلك: فتغيير هذه السمة حق حصري لأصحاب الملف. يُضاف شرط `training: not-allowed` إلى شروط العرض، ليتمكن المالك من رؤيته.
- **ملاحظة.** يؤدي تقديم العرض إلى إرسال الملف من جهاز المساعد إلى وحدة تخزين قاعدة بيانات المشروع. استأذن المساعد دائماً، ولا تقدم ملفاً نيابة عنه إطلاقاً.

يخص `mt-eval project review` مشغّل قاعدة البيانات (حيث يستخدم مفتاح الخدمة). وليس أمراً مخصصاً للوكيل.

## للمزيد من التفاصيل

- [استضافة اختبار محكم](/docs/host-a-sealed-test) و[الانضمام إلى مشروع](/docs/join-a-project) — النسخ الموجهة للمستخدمين.
- [إدارة مسابقة سيادية](/docs/network/sovereignty/run-a-sovereign-contest) و[عقدة التقييم السيادية](/docs/network/sovereignty/sovereign-eval-node).
- [نقل الملكية](/docs/network/sovereignty/ownership-transfer) و[قوالب الشروط](/docs/network/sovereignty/terms-templates).
- [قواعد البيانات ونقلها](/docs/agents/data-rules) — المجموعات المحكمة والملفات المحلية فقط.
- [مرجع `mt-eval`](/docs/reference/mt-eval).
