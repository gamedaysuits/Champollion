---
title: "تشغيل المسارات من الطرفية"
slug: /agents/shell
description: "كل خطوة في المسارات كأمر اعتيادي: التثبيت، وبدء مشروع، وجلب البيانات، وتسجيل مصطلحاتها، وتدريب نموذج واختباره باستخدام nmt-forge، وتشغيل جولات التحسين، والترجمة وتقديم الخدمة عبر mt-eval — بالإضافة إلى وضع العمل دون اتصال، ومتغيرات البيئة التي تقرؤها الأدوات، ورموز الخروج."
---

# قيادة المسارات من سطر الأوامر

كل خطوة على المسارات هي أمر عادي. يمكن للوكيل دون MCP — أو لشخص أمام الطرفية — أن يسلك المسارات نفسها باستخدام ثلاثة برامج:
`champollion` و`nmt-forge` و`mt-eval`. لا حاجة لحفظ الترتيب على الإطلاق: يُحدد `champollion next` الخطوة التالية، مع وضعها والأمر الدقيق، مقروءاً من ملفات المشروع.

القواعد هي نفسها المتبعة عبر MCP. لا تعمل خطوة `confirm` إلا بعد موافقة الشخص؛ وإجابات خطوة `ask_user` تعود إليه حصراً ([العقد](/docs/agents/contract)).

## التثبيت

```bash
npm install -g champollion                  # Node.js 20.11 or newer
uv tool install --python 3.12 nmt-forge     # brings mt-eval (mt-eval-harness) with it
```

**ملاحظة.** كلاهما يُنزّل حزماً: وضع `confirm` — اسأل أولاً. إذا فشل الأمر `uv --version`، يقوم الشخص بتثبيت uv من https://docs.astral.sh/uv/؛ فالوكيل لا يُنزّل برامج التثبيت. يحتاج التدريب أيضاً إلى حزمة forge الإضافية الخاصة بالتدريب (PyTorch وHugging Face transformers، وهي بحجم عدة مئات من الميجابايت). يذكر forge اسمها عند فقدانها (الحالة `needs-training-extra`):

```bash
uv tool install --reinstall --python 3.12 'nmt-forge[hf]'
```

تحتاج المسارات إلى الإصدار 0.3.0 أو أحدث من `nmt-forge`؛ وتتم الإشارة إلى الإصدار الأقدم مع أمر ترقيته (`uv tool install --upgrade --python 3.12 nmt-forge`).

## الحلقة التكرارية

```bash
champollion next              # the next step: what to say, why, the command, how to take it
champollion next --json       # the same, for a program (see the rails model page for the shape)
champollion next --write      # also rewrite NEXT.md, the person's copy
```

يمثل `How:` في المخرجات الموجهة للمستخدم الوضعَ التالي: `run it` (`auto`)، `اسأل أولاً، ثم نفّذ` (`confirm`), `اسأل الشخص المالك للبيانات — إياك والإجابة عنه` (`ask_user`), `انتظر، ثم اسأل مجدداً` (`wait`), `يقوم شخص بهذا الإجراء` (`human_only`). نفّذ الأمر المحدد، ثم اسأل مجدداً. لا بأس بالخروج عن المسارات — نفّذ أي أمر متقدم، ثم شغّل `champollion next`: ستتم قراءة الخطوة التالية من الملفات.

## البدء

```bash
champollion new family --from English --to qaa --target-name "Our language" --dry
champollion new family --from English --to qaa --target-name "Our language" --purpose "notes for the grandchildren"
cd family
```

اللغات إما رموز أو أسماء، وتتم مطابقتها عبر بطاقات اللغات. التنوع اللغوي الذي ليس له رمز يتخذ رمزاً للاستخدام الخاص (`qaa`–`qtz`) والاسم الذي يطلقه عليه أهله (`--target-name`، `--source-name`). **ملاحظة.** اذكر اتجاه الترجمة صراحةً قبل إنشاء المشروع: يحلل `--dry` كلا اللغتين ولا يكتب أي شيء. مرّر كل لغة تماماً كما سماها الشخص.

## جمع البيانات وتسجيل الشروط

```bash
champollion data add ../family-files/grandpa.xlsx                     # pairs → data/parallel/
champollion data add ../family-files/grandpa.xlsx --source-col A --target-col B --header
champollion data add ../family-files/words.lift --into lexicon        # a word list → data/lexicon/
champollion data add ../family-files/recording.eaf --source-col <number> --target-col <number>   # ELAN: tier numbers
```

يقرأ `data add` كلاً من `.xlsx`، و`.ods`، و`.csv`، و`.tsv`، و`.txt`، وجداول Word `.docx`، وقواميس Toolbox وLIFT، وملفات ELAN `.eaf` وUSFM (`--usfm-source`). وهو يكتب `<stem>.tsv` وملفه المرفق، ويترك الأصل دون مساس، ويطبع الأعداد والأعمدة وأرقام الصفوف التي رصدها فحصه للصفوف (نسخ مكررة، تكرارات، أطوال شاذة، صفوف متبادلة أو مزاحة — لا يُحذف شيء) — دون طباعة جُمل أبداً. وعندما يتعذر عليه تمييز عمود عن آخر (أو طبقة ELAN، بالرقم، أو لغة LIFT)، فإنه يرفض الاستمرار ويسأل؛ فاسأل الشخص المعني. يقرأ `--replace` الأصل ذاته مجدداً بأعمدة أخرى، محتفظاً بإجابات المالكين؛ ويضيف `--name <stem>` ملفاً آخر باسم مختلف. راجع [قواعد البيانات](/docs/agents/data-rules#what-tools-print-and-never-print).

ثم الشروط، ملفاً تلو الآخر، من واقع إجابات الشخص:

```bash
champollion data mark data/parallel/grandpa.tsv --speakers "grandpa" --speakers-agreed yes \
  --owner "our family" --training allowed --local-only
```

يلزم تحديد `--local-only` أو `--may-leave` على أي ملف لم يُحدد بعد بأنه محلي فقط. تسأل خطوة الشروط في المسار عن كل ملف في `data/parallel/`، و`data/lexicon/`، و`data/grammar/`، و`data/monolingual/` حتى تُسجل إجابة التدريب الخاصة به و`--speakers-agreed` معاً. كل قيمة هي خيار المالكين — راجع [قواعد البيانات](/docs/agents/data-rules) لمعرفة ما يفعله كل خيار وما يرفضه الأمر.

## حماية مجموعة الاختبار

```bash
champollion data add ../family-files/checked.tsv --into test
champollion data mark data/test/checked.tsv --role test --training not-allowed --local-only
```

## بناء النموذج واختباره

يسمي المسار هذه الخطوات بالترتيب (مع ملء `{placeholders}` الخاصة بها من المشروع):

```bash
nmt-forge init qaa --dir . --pair eng-qaa --no-card --name "Our language" --model auto
nmt-forge registry add project-test data/test/checked.tsv --role test
champollion data combine
nmt-forge leak-audit data/parallel/combined.tsv --clean-to data/clean/combined.clean.jsonl
nmt-forge prereg new first-model --eval-set project-test --expect "<their words>" --rationale "<their reason>"
nmt-forge split data/clean/combined.clean.jsonl --test 0 --dev 50 --seed 42 --near-dupe 0.6 --max-group 26 --out data/split --register project
nmt-forge floor data/lexicon/words.tsv
```

- يختار `init --model auto` النموذج الأقوى الذي يمكن لهذا الحاسوب تدريبه في
  ساعات، وفقاً لذاكرته ([التدريب](/docs/agents/training#models)). في حال وجود
  بطاقة لغة، يُستبعد `--no-card --name`.
- لا يعمل `data combine` إلا عندما يحتوي `data/parallel/` على أكثر من ملف واحد. وهو
  يُبقي على الشروط الأكثر صرامة للملفات التي يجمعها ويرفض أي ملف لم يُجب
  أصحابه بعد — بشأن ما إذا كان يجوز للنموذج التعلم منه،
  وما إذا كان كل من وردت كلماته فيه قد وافق على ذلك.
- تُعد `prereg new` خطوة `ask_user`: حيث تمثل `--expect` و`--rationale`
  كلمات الناس، تماماً كما قالوها، مكتوبة قبل وجود أي درجة تقييم.
  ولا يقترح السؤال أي رقم، ولا تفعل أنت ذلك أيضاً.
- حجم مجموعة التطوير الذي تملؤه الرحلة (`dev_n`) هو عُشر الأزواج
  المفحوصة، بما لا يقل عن 50 ولا يزيد عن 500؛ ومع وجود أقل من 200 زوج يكون
  ربعها بدلاً من ذلك، حتى يحتفظ التدريب بمعظمها — وذلك أقل من 50.
  إذن: 40 جملة تطوير من 160 زوجاً، و50 من 200 إلى 500 زوج، و160 من
  1,600، و500 من 5,000 زوج أو أكثر. وفي حال كان العدد أقل من 50، لا يمكن الحكم على أي جولة
  بناءً على مجموعة التطوير ([القياس](/docs/agents/measurement#comparing-two-models)).
  يُبقي `--near-dupe 0.6` النُّسخ شبه المتطابقة في جانب واحد؛ و`--max-group` هو نصف
  حجم مجموعة التطوير، مقرباً إلى الأدنى، زائداً واحداً.
- لا ينطبق `floor` إلا عندما يحتوي `data/lexicon/` على قائمة كلمات.

من هنا فصاعداً، يحدد المستشار الخاص بـ forge كل خطوة. ينقلها `champollion next`؛ ويذكرها `nmt-forge status` مباشرةً:

```bash
nmt-forge preflight run --config config.json && nmt-forge run config.json --detach
nmt-forge jobs                      # what is running
nmt-forge status                    # the next step, with what is ready and what blocks it
nmt-forge export <run-manifest.json> --prereg first-model --out export/
nmt-forge serve export/model --detach
nmt-forge tidy                      # earlier rounds' model weights nothing uses, and the space they take
```

التدريب هو `confirm` (إذ يستهلك قدرة حوسبة، تمتد من دقائق إلى ساعات)؛ وبينما يتدرب
تشغيل منفصل، تكون الخطوة `wait`. يرفض `nmt-forge run` أي تشغيل لا تتسع له
مساحة القرص قبل أن يبدأ (`[disk-room]`)، مع بيان المساحة الفارغة وتقديره للمساحة المطلوبة
وما يمكن لـ `nmt-forge tidy` إخلاؤه؛ ويتولى `nmt-forge tidy --yes` إخلاءها، بينما يبدأ
`--skip-disk-check` في `run` على أي حال، مسجلاً ذلك في التشغيل. هذان الخياران هما
قرار الشخص، وليس قرارك ([التدريب](/docs/agents/training#disk-space)).
يُقيّم التصدير النموذج مرة واحدة على مجموعة الاختبار، مقارنةً بالتوقع.
ويعود اختيار تصدير من بين عدة تصديرات إلى الشخص
(`nmt-forge choose <model folder>`). وبعد تقييم مجموعة الاختبار، يحكم الناس على
توقعهم:

```bash
nmt-forge prereg verdict first-model --prediction 1 --held --by "grandma"
```

(تُستخدم `--missed` عندما لا يتحقق التوقع؛ `--prediction` هو رقم التوقع، وهو 1 لـ `--expect` واحدة؛ ويحدد `--by` من قيّمه، كما ذكروا.) راجع [التدريب](/docs/agents/training) لمعرفة كل أوامر forge وحالات الرفض.

## جولات التحسين

بمجرد تشغيل النموذج للخدمة، تبدأ الجولات:

```bash
champollion improve time --per-week "about 30 sentences" --total "maybe 800"
champollion improve wishlist        # improve/round-<k>/wishlist.md, a printable sheet
# the people write 20 or more sentences in improve/round-<k>/to-translate.txt
champollion improve sheet           # the model in use drafts them → improve/round-<k>/review.csv
# the speaker marks the Right? column: Y, N (and how it is said), or ?
champollion improve marks           # counts the marks; fixes and confirmed drafts become pairs
champollion improve report          # the round's report
champollion improve prepare         # grows the dev set, screens, points config.json at the round's file, plans the training
nmt-forge preflight run --config config.json && nmt-forge run config.json --detach
champollion improve status          # the rounds so far: marks, and each verdict in the round report's words
```

- `improve sheet`: طالما أن مجموعة التطوير (الممارسة) أقل من 200 جملة، فإن بعض
  الصفوف لا تحتوي على مسودة — صف من كل صفين عندما تكون أقل من 50، وصف من كل أربعة بدءاً من 50
  — ويكتبها المتحدث. يكتبها `improve marks` في `data/dev/`
  ويضيفها `improve prepare` إلى مجموعة التطوير (`nmt-forge grow-dev`)،
  دون إضافتها إلى التدريب إطلاقاً. كما يُشغّل `nmt-forge draft-newer`. وعندما يتوفر
  نموذج آخر — وهو أحدث نموذج مدرَّب حين لا يكون قيد الاستخدام (لم يُطرح للاستخدام
  بعد جولته: قليل جداً لتحديد ذلك، أو دون تغيير ملموس، أو أسوأ)، أو
  النموذج الذي حل النموذج المستخدم محله بعد الترقية — يضع ذلك النموذج مسودة لنصف
  عشوائي من الصفوف ذات المسودات، دون تمييز، ويبقى المفتاح بجانب
  الورقة (`sheet-key.json`). بعد ذلك، يحسب `improve marks` كل نموذج على حدة —
  وهي المقارنة العمياء التي تُعدّ بعد الترقية الفحص الذي يحتاجه التقرير
  قبل أن يصف أي ارتفاع بأنه تقدم حقيقي
  ([القياس](/docs/agents/measurement#the-speakers-marks)).
- `improve sheet`، بدءاً من الجولة 2: صف واحد لكل 10 جمل جديدة
  (مقرباً إلى الأدنى) عبارة عن مسودة وضع المتحدث علامة `Y` أو `N` عليها في ورقة
  سابقة، وتعود دون تمييز في موضع عشوائي. ينص السطر الأول من الورقة على أن بضعة
  صفوف تعود عن قصد، دون تحديد أيٍّ منها إطلاقاً؛ ويسردها `sheet-key.json`
  (`repeat_rows`). يطبع الأمر عدد الصفوف التي عادت، *"(أيٌّ منها غير محدّد)"*،
  وأنها تستغرق *"نحو 10 ثوانٍ لكل صف، ولا يُدرَّب عليها ثانيةً
  أبداً"*.
- يُقيّم `improve marks` الصف المعروض مجدداً بمقارنته مع تقييم المتحدث
  السابق فقط — وليس أبداً في حصة الجولة، أو أزواج التدريب، أو
  المقارنة العمياء — ويكتب `repeats` في `marks.json`، ويطبع *"الصفوف
  المعروضة مجدداً: قيّم المتحدث A من أصل J بالطريقة نفسها كما في السابق (P%) — W
  كانت خاطئة وأصبحت الآن صحيحة، وR كانت صحيحة وأصبحت الآن خاطئة. لا تُحتسب ضمن حصة هذه
  الجولة، ولا يُدرَّب عليها مجدداً إطلاقاً."*
- يُسجّل `improve marks`، عندما يكون النموذج الآخر هو الأحدث ويكون المتحدث
  قد قيّم مسودة واحدة على الأقل لكل منهما، الأعداد لدى forge (الأعداد
  فقط، دون أي جملة على الإطلاق):

  ```bash
  nmt-forge speaker-verdict --newer <run> --in-use <run> --newer-right <n> --newer-judged <n> --in-use-right <n> --in-use-judged <n> --json
  ```

  عندما يحدد المتحدث أن النموذج الأحدث كان صائباً بصورة متكررة وواضحة، فإنه
  يطبع *"سجّل forge ذلك: وهو يعرض وضع النموذج الأحدث قيد الاستخدام (يوافق
  الناس أولاً)"*؛ وعندما لا يكون forge مثبتاً أو يرفض، فإنه يوضح
  أن العلامات لم تُسجَّل، مع بيان السبب.
- ينتهي `improve prepare` بـ `nmt-forge round-plan`: تستمر الجولة
  انطلاقاً من النموذج قيد الاستخدام (4 دورات على كافة الجمل حتى الآن) أو تدرب
  من البداية، مع توضيح السبب ([التدريب](/docs/agents/training#the-improve-rounds)).

يحكم Forge بعد ذلك على النموذج الجديد بمقارنته بالنموذج قيد الاستخدام
(`nmt-forge compare-runs <in-use run-manifest.json> <new run-manifest.json>`،
`auto`)، ويعرض وضعه قيد الاستخدام (`confirm`) فقط إذا كان أفضل
بصورة قابلة للقياس — أو، في الحالات التي كان فيها عدد الجمل أقل من أن يحسم الحكم (أقل من 50 جملة تطوير)
أو لم يظهر تغيير قابل للقياس، بمجرد أن تفضّله بوضوح تقييمات المتحدث المعماة.
فالحكم وحده لا يضع أي شيء قيد الاستخدام: وحدها موافقة الناس (`nmt-forge export`
و`nmt-forge choose` في تلك الخطوة) تفعل ذلك. تحصل الأزواج الجديدة من `improve marks` على مصطلحاتها الخاصة أولاً — بحسب ما
تطلبه الرحلة. كيفية نقل التقرير: [التوجيه](/docs/agents/coaching).

## الترجمة والتشغيل للخدمة باستخدام mt-eval

كتابة `nmt-forge export` داخل مشروع تؤدي إلى كتابة `deploy/<name>.json` (deployment/1). الملف نفسه يقوم بالقياس والترجمة وتقديم الخدمة:

```bash
mt-eval translate --deployment deploy/<name>.json --source-file <input file> --out <output file>
mt-eval serve --deployment deploy/<name>.json      # http://127.0.0.1:8379 by default
mt-eval run --deployment deploy/<name>.json --corpus <dev or test file>
```

- **ملاحظة.** لا يحتاج `mt-eval run` على ملف اختبار إلى تسجيل مسبق — فهو يكتفي بتسجيل عملية القراءة. قيّم مجموعة الاختبار من خلال `nmt-forge export` (أو بعد كتابة التوقع)، ولا تفعل ذلك قبله أبداً.
- يضيف `--gates gates/<chain>.json` سلسلة بوابات إلى `run`، أو `translate`، أو `serve` (دون `--deployment`)؛ ويرفض `run` و`test` السلسلة التي تتضمن تراجعاً بديلاً (fallback). راجع [الأساليب والبوابات](/docs/agents/methods) و[التشغيل للخدمة](/docs/agents/serving).

## خارج المسارات: ما هو متوفر للغة

```bash
champollion network card <code>                    # the cited language card
champollion network recommend <source> <target>    # methods that can run, with their evidence
mt-eval corpora --source <source> --target <target>   # registered test sets for the pair
nmt-forge discover <code>                          # what a training project can use
```

## فحص الملفات وترقيتها

```bash
champollion validate        # project file, sidecars, method.json, gates/, deploy/ — 0 ok, 1 invalid, 2 usage
champollion upgrade --dry   # what upgrading older sidecars to set/1 would change; drop --dry to write
```

## العمل دون اتصال

يمنع خيار `CHAMPOLLION_OFFLINE=1` واجهة سطر أوامر `champollion` من الاتصال بالشبكة: فلا تأتي بطاقات اللغات إلا من الحزمة المدمجة والذاكرة المؤقتة المحلية (لا يتم جلب البطاقات النادرة)، ويتم تجاوز التحديث اليومي للذاكرة المؤقتة للبطاقات، ولا يقارن `register-corpus` تجزئة الملف بالفهرس العام (ويسجل المقارنة على أنها لم تُجرَ). ولا يغير هذا ما يُرسله أي أسلوب: فالأسلوب الذي يستدعي مزود خدمة يظل بحاجة إلى الشبكة، وتظل قواعد الإرسال سارية عليه.

يمنع خيار `MT_EVAL_NO_REMOTE_REGISTRY=1` برنامج `mt-eval` من جلب سجل مجموعات البيانات من الويب (للأجهزة المعزولة تماماً عن الشبكة).

ما يحتاج إلى الشبكة على المسارات في كل الأحوال: تثبيت الأدوات، وحزمة التدريب الإضافية، وأول عملية تنزيل لنموذج مدرب مسبقاً (`byt5-small` أو `byt5-small-lowmem`، حوالي 1.2 جيجابايت؛ بينما لا يُنزّل `cpu-tiny` أي شيء).

## متغيرات البيئة

يقرؤها الكود، ومخصصة لمسؤول التشغيل. لا يلزم توفير مفاتيح API الخاصة بمزودي الخدمة إلا للأساليب التي تستدعي مزوداً، ولا تلزم أبداً في المسار الافتراضي.

| المتغير | يُقرأ بواسطة | التأثير |
|---|---|---|
| `CHAMPOLLION_MCP_PROFILE` | خادم MCP | `rails` (افتراضي) أو `full` |
| `CHAMPOLLION_CLI_BIN` | خادم MCP | نقطة إدخال `champollion` المراد تشغيلها |
| `NMT_FORGE_BIN` | `champollion`، خادم MCP | الملف التنفيذي لـ `nmt-forge` |
| `UV_TOOL_BIN_DIR` | `champollion`، خادم MCP | مكان البحث عن `nmt-forge` و`uv` بعد `PATH` (الافتراضي `~/.local/bin`) |
| `CHAMPOLLION_OFFLINE` | `champollion` | `1`: عدم استخدام الشبكة لبطاقات اللغات أو عمليات البحث في الفهرس |
| `CHAMPOLLION_CARDS_CACHE_DIR` | `champollion` | الذاكرة المؤقتة لبطاقات اللغات لكل مستخدم (الافتراضي `~/.champollion/cards`) |
| `CHAMPOLLION_CARDS_TTL_HOURS` | `champollion` | وتيرة فحص الذاكرة المؤقتة للبطاقات بحثاً عن تحديثات (الافتراضي 24) |
| `NMT_FORGE_AUTO_PRESET` | `nmt-forge init --model auto` | تثبيت الإعداد المسبق الذي يختاره `auto` (يجب أن يكون اسم إعداد مسبق) |
| `NMT_FORGE_SERVE_PORT` | `nmt-forge serve` | المنفذ الافتراضي (8378 بدونه) |
| `NMT_FORGE_SERVE_TOKEN` | `nmt-forge serve` | رمز حامل المصادقة (bearer token)؛ مطلوب خارج الاتصال المحلي (loopback) |
| `NMT_FORGE_NO_MONITOR` | `nmt-forge run` | `1`: دون لوحة تدريب مباشرة |
| `MT_EVAL_SERVE_TOKEN` | `mt-eval serve` | رمز حامل المصادقة (لا يُمرر أبداً كقيمة في سطر الأوامر) |
| `CHAMPOLLION_SERVE_TOKEN` | `champollion serve` | رمز حامل المصادقة الخاص بخادم واجهة سطر الأوامر نفسها |
| `MT_EVAL_NO_REMOTE_REGISTRY` | `mt-eval` | `1`: عدم جلب السجل |
| `MT_EVAL_DATA_ROOT` | `mt-eval` | مكان مطابقة مسارات مجموعات البيانات المسجلة أولاً |
| `OPENROUTER_API_KEY` | `champollion`، `mt-eval` | مفتاح مزود النماذج المستضافة الافتراضي |

## مخرجات البرامج

| الأداة | مخرجات الآلة | رموز الخروج |
|---|---|---|
| `champollion` | `--json` في أوامر المسارات (`new`، `next`، `data add`، `data mark`، `data combine`، `improve report`، `improve status`، `connect`، `upgrade`) | 0 تم بنجاح · 1 رُفض · 2 خطأ استخدام |
| `nmt-forge` | `--json` في كل أمر فرعي: مستند JSON واحد على stdout، وكل شيء آخر على stderr | 0 تم بنجاح · 2 رُفض (`{"error": …}`) |
| `mt-eval` | `--json` و`--non-interactive` في كل أمر فرعي | 0 تم بنجاح · غير صفري يعني الرفض |

أشكال الرفض: [نموذج المسارات](/docs/agents/rails-model#refusal-shapes).

## تعمّق أكثر

- [مرجع أوامر `champollion`](/docs/reference/cli)، و[`nmt-forge`](/docs/network/getting-started/forge-command-reference) و[`mt-eval`](/docs/reference/mt-eval).
- [نموذج المسارات](/docs/agents/rails-model) — المسار و`next --json`.
- [قيادة المسارات عبر MCP](/docs/agents/mcp) — الخطوات نفسها في هيئة ست أدوات.
- [التدريب باستخدام nmt-forge](/docs/agents/training) و[قواعد البيانات](/docs/agents/data-rules).
