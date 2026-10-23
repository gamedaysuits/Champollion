---
title: "نموذج المسارات"
slug: /agents/rails-model
description: "كيف يُبنى المشروع على مسارات Champollion: شجرة المشروع، والتنسيقات الستة المتحقَّق من صحتها بمخطط والتي تقرؤها كل أداة، وخط العمليات الواحد من المدخلات المقبولة إلى المخرجات المقيسة، والرحلة بوصفها بيانات، وشكل كل حالة رفض."
---

# نموذج القضبان

المشروع على القضبان عبارة عن مجلد من الملفات البسيطة. تقرأ كل أداة — واجهة سطر أوامر `champollion`، و`nmt-forge`، و`mt-eval`، وخادم MCP — الملفات نفسها أصلاً، وفق المخططات نفسها، وبالأحكام نفسها. وتُقرأ الخطوة التالية دائماً من الملفات، ولا تُحفظ في الذاكرة أبداً. (هناك أمران يقعان خارج المشروع: يحسب خادم MCP مرات إخفاق الخطوة طوال فترة تشغيله، ويحتفظ nmt-forge بصف تدريب واحد على مستوى الجهاز في `~/.nmt-forge`.) عدّل ملفاً يدوياً، ثم اطلب الخطوة التالية، وستعكس الإجابة التغيير.

تمثل هذه الصفحة الخريطة. وتوجد قواعد التشغيل في [العقد](/docs/agents/contract)؛ بينما توجد استدعاءات الأدوات في [MCP](/docs/agents/mcp) و[الطرفية](/docs/agents/shell).

## الأدوات

| الأداة | التثبيت | ما تفعله على القضبان |
|---|---|---|
| `champollion` | npm (Node 20.11+) | تبدأ المشاريع، وتستورد البيانات، وتسجل شروطها، وتسمي الخطوة التالية، وتشغل جولات التحسين، وتربط النموذج بالتطبيق |
| `nmt-forge` | PyPI (`uv tool install --python 3.12 nmt-forge`) | تدرب، وتفحص، وتقسم، وتسجل التنبؤات، وتقيم النماذج على مجموعة الاختبار وتصدرها، وتقدمها كخدمة؛ وتحتفظ بسجل العمليات |
| `mt-eval` | تأتي مع `nmt-forge` (حزمة `mt-eval-harness`) | تشغل طريقة عبر مجموعة اختبار أو ملف أو طلب؛ وتطبق البوابات؛ وتقيم |
| `champollion-mcp-server` | npx | تدير واجهة سطر أوامر `champollion` كعمليات فرعية مقيدة؛ ويتكون ملف تعريف القضبان من ست أدوات |

تعمل كل أداة كعملية مستقلة بذاتها. ويشغل خادم MCP الأوامر نفسها التي يكتبها المستخدم (إذ ترفض أداة `run_next_step` الخاصة به أي برنامج بخلاف `champollion` و`nmt-forge` و`uv tool install … nmt-forge`).

## شجرة المشروع

يكتب `champollion new <folder> --from <language> --to <language>`:

```text
<folder>/
  champollion.project.json   project/1 — the decisions (kind, name, pair, purpose, defaults)
  README.md                  what goes where, for the people
  NEXT.md                    the next step, as a page (rewritten by `champollion next --write`)
  AGENTS.md                  the operating contract, for an AI agent working in the folder (an existing one is kept)
  .gitignore                 keeps data/, inbox/, consent/, models/, runs/, export*/, .forge/runs/, .champollion/ out of git
  inbox/                     files as the people have them
  data/parallel/             sentence pairs to learn from
  data/test/                 sentences a fluent speaker checked — never learned from
  data/lexicon/              word lists and dictionaries
  data/grammar/              grammar notes
  data/monolingual/          one-language text (kept; kept; not used for training)
  consent/                   notes recording who agreed to what, and when
```

ويرفض المجلد الذي يحتوي بالفعل على مشروع (رمز الخروج 1) أو أي ملف غير مخفي (رمز الخروج 1)، وأي `kind` غير `language`: فمشاريع `task` و`service` ليست على القضبان بعد. ويحلل `--dry` اللغات ولا يكتب أي شيء.

تضيف الخطوات الباقي أثناء تشغيلها:

| المسار | كُتب بواسطة | المحتوى |
|---|---|---|
| `<file>.champollion.json` | `champollion data add`، `data mark`، `data combine`، `improve marks` | set/1 — شروط الملف المجاور له |
| `data/combined-from/` | `champollion data combine` | النسخ الأصلية التي جمعها أمر combine (نُقلت، ولم تُحذف قط) |
| `data/not-for-training/` | `champollion data combine` | ملفات أوضح أصحابها أنه لا يجوز لأي نموذج التعلم منها |
| `.forge/` | `nmt-forge init` | ورشة العمل: `eval-registry.json`، `ledger.jsonl`، التسجيلات المسبقة، `runs/` |
| `config.json`، `NEXT_STEPS.md` | `nmt-forge init` | إعدادات التدريب (إعداد مسبق للنموذج موسّع إلى أرقام صريحة) |
| `data/clean/` | `nmt-forge leak-audit --clean-to` | أزواج التدريب المفرزة |
| `data/split/` | `nmt-forge split`، `champollion improve prepare` | مجموعة التطوير؛ ملف تدريب كل جولة |
| `data/dev/practice-round-<k>.tsv` | `champollion improve marks` | جمل كتبها المتحدث لمجموعة التطوير — الدور `dev`، محلية فقط، لم يُدرَّب عليها إطلاقاً |
| `improve/time.json` | `champollion improve time` | وقت المتحدث، بكلماته |
| `improve/round-<k>/` | خطوات التحسين | `wishlist.md`، `to-translate.txt`، `review.csv`، `sheet-key.json` (الصفوف التي صاغ النموذج الآخر مسودتها — نموذج أحدث ليس قيد الاستخدام، أو النموذج الذي استُبدل بعد الترقية: أرقام الصفوف، وأسماء جولات التشغيل، والعلاقة وعدد أزواج التدريب لكل نموذج — ومن الجولة 2 فصاعداً، `repeat_rows`: الصفوف المعروضة مجدداً، وكل من `row`، `from_round`، `from_row` و`mark` السابقة)، `marks.json` (الأعداد، ونسبة الصواب مع مجالها، `blind`، و`repeats`: `shown`، `judged`، `agreed`، `agreement`، `wrong_to_right`، `right_to_wrong`، `wrong_before`، `rounds_apart_wrong_before`)، `prepared.json`، `report.json` |
| `export*/` | `nmt-forge export` | نموذج مُصدَّر وملف method.json الخاص به |
| `deploy/<name>.json` | `nmt-forge export` (داخل مشروع rails) | deployment/1 — ما يتم نشره |
| `gates/*.json` | أشخاص | gate-chain/1 — عمليات التحقق بين المخرجات وما يتم شحنه |
| `methods/<id>/method.json` | أشخاص | method/1 (يكتبه أيضاً `nmt-forge export` في مجلد النموذج، `mt-eval export` و`champollion serve --emit-manifest`) |

## التنسيقات

توجد ستة مخططات لإطار العمل في `shared/schemas/framework/`. وتحدد كل وثيقة مخططها في `$schema`. وتُرفض المفاتيح غير المعروفة؛ ويوضع أي مفتاح خاص بك تحت `x-`.

| التنسيق | `$schema` | الموقع | ماهيته |
|---|---|---|---|
| project/1 | `https://champollion.dev/schemas/project/1.json` | `champollion.project.json` | القرارات فقط: `kind`، و`name`، و`pair`، و`purpose`، و`defaults`، و`created_with` |
| set/1 | `https://champollion.dev/schemas/set/1.json` | `<file>.champollion.json` | شروط ملف البيانات: `transmission`، و`role`، و`kind`، و`pair`، و`fields`، و`terms`، وحقول التسجيل، و`derived_from`، و`holders_agreed` |
| method/1 | `https://champollion.dev/schemas/method/1.json` | `method.json` | طريقة واحدة: `id`، و`name`، و`kind` والإعداد الوحيد لهذا النوع، و`pairs`، و`decode`، و`card`، و`evidence` |
| gate-chain/1 | `https://champollion.dev/schemas/gate-chain/1.json` | `gates/*.json` | بوابات `metric-threshold` مرتبة مع `fallback` اختياري |
| deployment/1 | `https://champollion.dev/schemas/deployment/1.json` | `deploy/*.json` | طريقة واحدة، وبواباتها، وزوج لغوي واحد؛ ومضيف ومنفذ `serve` اختياريان |
| service-api/1 | `https://champollion.dev/schemas/service-api/1.json` | عقد `/translate` | وثائق الطلب، والاستجابة، والخطأ، و`/health` |

`project.defaults` — ما تحصل عليه البيانات المضافة إلى المشروع ما لم يُنص على خلاف ذلك. يكتب `champollion new` `{"transmission": "local-only", "training": "ask", "share_scores": "ask"}`. The values: `transmission` إما `local-only` أو `ask`؛ و`training` إما `allowed` أو `not-allowed` أو `ask`؛ و`share_scores` إما `never` أو `ask`. تجعل القيمة `ask` الأدوات تتوقف وتسأل — فالقضبان لا تبتكر إجابة من تلقاء نفسها أبداً.

هناك سجلان إضافيان ليسا من مخططات إطار العمل ولكنهما جزء من النموذج:

- **سجل forge**، `.forge/ledger.jsonl`: مقتصر على الإضافة وسلسلي التجزئة
  (يُضمّن كل مدخل تجزئة المدخل الذي يسبقه؛ ويفشل `nmt-forge ledger verify`
  عند أي تعديل). وهو يسجل عمليات التسجيل، وكل عملية قراءة لمجموعة
  مسجلة، والتسجيلات المسبقة، والدرجات، واستهلاك المجموعات المختومة، والتجاوزات، وأحكام
  تدقيق التسريب، والحد الأدنى للقاموس، وعمليات التصدير، والخيارات، وتقديم الخدمات، وأحكام الجولات
  (`improve-compare`: `better`، أو `worse`، أو `no-change`، أو `too-few` لما دون 50
  جملة تطوير)، وكيفية تدريب كل جولة (`round-plan`)، ومسودات النموذج
  الآخر لورقة المراجعة (`draft-newer`: أسماء التشغيل، و`relation`، وعدد
  أزواج التدريب لكل نموذج وعدد المسودات)، وحكم المتحدث الأعمى
  على نموذج أحدث (`improve-speaker`: أسماء التشغيل، وأربعة أعداد، و`z`،
  و`clear`)، وتغييرات النموذج (`model-change`، بما في ذلك `not-now`) وما
  أزاله `nmt-forge tidy` (`tidy`: التشغيلات والبايتات). أعداد وتجزئات
  ومسارات — ولا يضم جملة أبداً. إنه مسك دفاتر كاشف
  للتلاعب، وليس أماناً تشفيرياً.
- **بطاقة التشغيل**: ما يسجله `mt-eval run` لتشغيل تم تقييمه، وما تحمله
  النتيجة المنشورة. راجع [مواصفة بطاقة التشغيل](/docs/network/specifications/run-card).

**القفل.** يتحقق `champollion validate [folder]` من ملف المشروع، وكل ملف جانبي، وكل ملف `method.json` (في المجلد الجذري، وفي `methods/*/` و`.champollion/methods/*/`)، و`gates/*.json` و`deploy/*.json` وفق هذه المخططات. وتتحقق بيئة الاختبار من الملفات نفسها بالأحكام نفسها. رمز الخروج 0 = لا توجد أخطاء، 1 = وثيقة غير صالحة، 2 = خطأ في الاستخدام. ولا يفتح سوى ملفات JSON هذه فقط، ولا يفتح أي ملف بيانات أبداً.

يعيد `champollion upgrade [folder]` كتابة الملفات الجانبية المكتوبة قبل set/1 (دون `$schema`) بصيغة set/1، مع الاحتفاظ بجميع القيم (أي مفتاح لا يتعرف عليه set/1 يُنقل إلى `x-<key>`). ويترك الملف الجانبي غير الصالح دون تغيير، ويسرد ملف `method.json` الأقدم دون تعديله: وتظل جميع الأدوات تقرأه بصيغة method/0 مع إصدار تحذير.

## المسار الموحد

كل وسيلة تلتقي بها الطريقة بالنص تمثل مساراً واحداً في محرك التقييم:

1. **القبول.** تُقرأ شروط المدخلات (الملف الجانبي set/1، أو غلاف JSON، أو مدخلة السجل) وتُحدد سياسة الإرسال وتُطبق قبل ترجمة أي شيء. وتُرفض هنا أي قناة لا تسمح بها السياسة (راجع [قواعد البيانات](/docs/agents/data-rules)).
2. **الطريقة.** تترجم طريقة واحدة (أنواع method/1: `llm`، و`llm-coached`، و`mt-api`، و`local-model`، و`nmt-checkpoint`، و`lexicon`، و`python`، و`service`، و`human`).
3. **البوابات.** إذا حُددت سلسلة بوابات، يُحكم على كل مقطع؛ وأول بوابة ترفض تحدد ما يتم تسليمه (`drop`، و`keep-source`، و`flag`، و`fallback`). راجع [الطرق والبوابات](/docs/agents/methods).
4. **المخرجات.** يُكتب سجل التشغيل؛ وتحمل الملفات المستقطعة من مدخلات موسومة شروطها في ملف جانبي مجاور لها.
5. **المقاييس.** فقط عند وجود مراجع: تقيم النتيجة الرئيسية ما تم تسليمه، وتوضع النتيجة غير الخاضعة للبوابات بجانبها. راجع [القياس](/docs/agents/measurement).

هذه الأنماط هي مسار العمل نفسه على مدخلات مختلفة:

| النمط | الأمر | المدخلات | المقاييس |
|---|---|---|---|
| القياس | `mt-eval run` (يعيد `mt-eval test` تقييم سجل التشغيل) | مجموعة اختبار أو تطوير | نعم |
| ترجمة ملف | `mt-eval translate --out <file>` | المصدر فقط | لا |
| الخدمة | `mt-eval serve` | طلب واحد في كل مرة | لا |

**النشر هو مسار القياس مطبقاً على مدخلات المصدر فقط.** يُختبر ملف deployment/1 واحد (`mt-eval run --deployment`)، ويُشغل عبر ملف (`mt-eval translate --deployment`)، ويُقدم كخدمة (`mt-eval serve --deployment`)، لضمان أن ما تم قياسه هو ما يتم تسليمه. ومع `--deployment`، تُرفض الخيارات التي يحددها الملف (`--method`، و`-m`/`--model`، و`--gates`، و`--target-script`). ولا يحدد النشر أي درجة تقييم: فالرقم المقاس هو نتيجة تشغيل تُحفظ مع التشغيل نفسه. راجع [تقديم الخدمة](/docs/agents/serving).

## المسار، كبيانات

ترتيب العمل محدد في ملف: `shared/journeys/language.json`. والمُقيِّم، `cli/lib/framework/journey.js`، هو القارئ الوحيد؛ حيث يوجه له كل من `champollion next`، وملف تعريف قضبان MCP، و`NEXT.md` السؤال نفسه. **أول خطوة لم تكتمل هي الخطوة التالية.** وهو يقرأ فقط الملفات الجانبية، وملف المشروع، وسجل forge وقيدها — دون قراءة نص أي ملف بيانات على الإطلاق — ولا يشغل أي شيء باستثناء `nmt-forge --version` (بحد أقصى 30 ثانية) لخطوة التثبيت و`nmt-forge status --json` (بحد أقصى 60 ثانية) بمجرد وصول العمل إلى التدريب.

**المراحل.** `start` → `gather` → `protect` → `tools` → `build` → `improve`.

تحتوي **الخطوة** على `id`، و`stage`، و`mode`، وكلمات بسيطة لإخبار المستخدم (`say`) وسبب أهميتها (`why`)، وعادةً ما تتضمن `command`. الحقول الاختيارية:

| الحقل | المعنى |
|---|---|
| `done_when` | الفحص الذي يؤكد اكتمال الخطوة. مطلوب (باستثناء الخطوات المفوضة) |
| `when` | فحص يجب أن يتحقق لتنطبق الخطوة من الأساس (لا ينطبق الحد الأدنى للقاموس إلا عندما يحتوي `data/lexicon/` على ملف) |
| `question`، `answers` | سؤال خطوة `ask_user` وخانات إجابتها: `{"enum": [...]}` أو `{"type": "string", "say": "…"}` |
| `agent`، `agent_tool` | ما يقوم به الوكيل بنفسه لخطوة تخص المستخدم (استيراد الملفات المحددة باستخدام `add_data`) |
| `outdated` | متغير يُستخدم عندما يكتشف الفحص أن الأداة قديمة جداً |
| `delegate` | `"nmt-forge"`: التسليم إلى المستشار الخاص بأداة forge |

تُملأ عناصر `{placeholders}` في `say` و`question` و`command` من ملف المشروع والملفات التي عُثر عليها.

تمثل **الفحوصات** مجموعة مغلقة؛ ويطلق المُقيِّم استثناءً عند مصادفة فحص غير معروف: `project_valid`، و`data_files`، و`every_data_file_has_terms`، و`protected_test_set`، و`tool_on_path` (مع `min_version`)، و`path_exists`، و`forge_test_registered`، و`single_file`، و`forge_role_registered`، و`forge_ledger_event`، و`screened_rows`، و`lines_in_file`، و`review_marked`، و`improve_prepared`، و`forge_trained_on_current`.

**الأنماط:**

| النمط | من يتصرف | ما تسمح به القضبان |
|---|---|---|
| `auto` | الوكيل | تشغيل الأمر |
| `confirm` | الوكيل، بعد الموافقة | التثبيت، التدريب، وأي شيء يستهلك موارد أو ينشر؛ لا يُشغّل إلا بعد موافقة المستخدم |
| `ask_user` | يجيب المستخدم | اطرح `question`؛ ومرر إجاباته عبر المفاتيح في `answers`؛ ولا تجب نيابة عنه أبداً |
| `wait` | لا أحد | هناك عملية قيد التشغيل؛ اسأل مجدداً لاحقاً |
| `human_only` | المستخدم | جمع الجمل، وتحديد المسودات، والاختيار |
| `use_tool` | الوكيل، بأداته الخاصة | في MCP فقط: تظهر خطوة `human_only` التي تحتوي على حقل `agent` كـ `use_tool` مع `step.tool` |

**التفويض.** عند خطوة `forge`، يستعلم المسار عبر `nmt-forge status --json` ويعتمد حالة forge كخطوة. وتُربط حالات forge بأنماط: `training` → `wait`؛ و`ready-to-train` و`needs-training-extra` → `confirm`؛ و`missing-preregistration` → `ask_user`؛ و`choose-export` → `human_only`؛ و`improve-compare` → `auto`؛ و`improve-promote` → `confirm`؛ و`improve-stronger-model` → `ask_user`. وأي حالة أخرى تكون `auto` عندما تحدد forge أمراً، و`human_only` عندما لا تحدده. وتنهي حالة `serving` مرحلة البناء لتبدأ مرحلة التحسين.

يأتي نوعان من الخطوات من خارج قائمة الخطوات:

- **تحكيم التنبؤ.** بعد تصدير تم تقييمه على مجموعة الاختبار، ينتظر تنبؤ كتبه المعنيون بكلماتهم الخاصة حكمهم: خطوة `ask_user` مع `answers` `verdict` (`held` أو `missed`) و`by` (من قام بالتحكيم)، والتي تشغل `nmt-forge prereg verdict`.
- **انتظار الموافقة.** كل ملف يشير ملفه الجانبي إلى `speakers_agreed: not-yet` becomes its own `ask_user` question in `waiting`، وتتم الإجابة عنه بمعرف الخطوة الخاص به متى توفرت الإجابة لدى المستخدم. ولا يعطل هذا بقية القضبان أبداً.

**معرف الخطوة** هو `<journey step id>:<8 hex characters>` — وهو تجزئة للخطوة وأمرها بعد ملئه. وإذا تغير المشروع، يتغير المعرف، ويُرفض أي `run_next_step` بالمعرف القديم (`the project changed since that step was named`).

**ما يعيده `champollion next --json`:** `project`، و`kind`، و`stage` (`n`، و`of`، و`id`، و`title`)، و`done` (معرفات الخطوات)، و`step` (`id`، و`mode`، و`say`، و`why`، وحيثما وُجدت `command`، و`question`، و`answers`، و`agent`، و`agent_tool`، و`file`، و`source`)، و`now` (حقائق forge — ما هو صحيح في اللحظة الحالية)، و`waiting`، و`forge` (`state`، و`blockers`، و`warnings`)، و`finished` (عندما لا تتبقى أي خطوة)، و`error`. ويكون رمز الخروج 1 عند وجود خطأ وعدم وجود خطوة.

## أشكال الرفض

يذكر كل رفض ما حدث، وتوضح معظم حالات الرفض السبب وكيفية الإصلاح.

| الأداة | المخرجات للمستخدم | المخرجات للآلة | رمز الخروج |
|---|---|---|---|
| `nmt-forge` | `[guard] message`، ثم `  why: …` و`  fix: …` | `--json`: `{"error": {"type", "guard", "message", "why", "fix", "how_to_get", "text"}}` على stdout | 2 عند الرفض |
| `champollion` | `[ERR] message` على stderr | `--json` حيث يدعم الأمر ذلك | 1 عند الرفض، 2 عند خطأ الاستخدام |
| أدوات قضبان MCP | — | `{"refused": "<reason>", …}` مع `isError: true`، بالإضافة إلى خيار إعادة المحاولة إن وجد (`if_it_has_no_code`، و`current`، و`last_output`، و`question`، و`answers`) | — |

`type` في خطأ forge هي فئة الاستثناء (`UsageError` للوسائط
غير الصالحة — يرفض forge الرايات المختصرة بدلاً من التخمين). وتتضمن أسماء
حراس Forge كلاً من `split-guard`، و`dev-fence`، و`leak-audit`، و`preregister`،
و`eval-ledger`، و`ci-scoring`، و`registry`، و`improve-loop`، و`disk-room` (تشغيل
تدريب لا يمكن للقرص استيعابه). وعندما يقتبس
خطأٌ ما جملةً من مجموعة نصوص محجوبة، تُقرأ الجملة
`[sentence withheld]` ويضيف الكائن `text_withheld`.

انقل الرفض بكلمات بسيطة واتبع طريقة إصلاحه، أو اطلب الخطوة التالية مجدداً. والخطوة التي تفشل مرتين لا تُشغّل مرة أخرى حتى يقرر المستخدم ذلك ([MCP](/docs/agents/mcp#when-a-step-fails)).

## تعمّق أكثر

- [عقد التشغيل](/docs/agents/contract) — القواعد، والأقفال، والملاحظات.
- [إدارة القضبان عبر MCP](/docs/agents/mcp) و[من الطرفية](/docs/agents/shell).
- [قواعد البيانات والإرسال](/docs/agents/data-rules) — وثيقة set/1 بالكامل.
- [الطرق والبوابات](/docs/agents/methods) و[تقديم الخدمة](/docs/agents/serving) — method/1، وgate-chain/1، وdeployment/1، وservice-api/1.
- [مواصفات بطاقة التشغيل](/docs/network/specifications/run-card) و[مواصفات بيئة الاختبار](/docs/network/specifications/harness).
- [مرجع أوامر `mt-eval`](/docs/reference/mt-eval) و[مرجع أوامر `nmt-forge`](/docs/network/getting-started/forge-command-reference).
