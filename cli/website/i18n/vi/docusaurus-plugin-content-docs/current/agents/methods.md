---
title: "Phương thức và cổng kiểm soát"
slug: /agents/methods
description: "method/1 và gate-chain/1 theo cách mọi công cụ Champollion đọc chúng, cổng kiểm tra tính hợp lệ FST làm ví dụ minh họa, cùng các công thức phương thức ngoài mô hình được huấn luyện mặc định — LLM kèm hướng dẫn, few-shot, tăng cường từ điển, lai ghép dựa trên quy tắc, nối chuỗi, dịch một phần, tinh chỉnh — mỗi loại kèm thông tin nội dung gửi và nơi nhận."
---

# Phương thức và cổng kiểm soát (gates)

Một **phương thức** (method) là bất kỳ thứ gì thực hiện dịch thuật: một mô hình đã huấn luyện, một LLM được prompt, tra cứu từ điển, một bộ máy dựa trên quy tắc, một dịch vụ, hoặc con người. Một **cổng kiểm soát** (gate) là bước kiểm tra giữa đầu ra của phương thức và những gì được phát hành. Phương thức mặc định của rails là một mô hình được huấn luyện bằng nmt-forge ([huấn luyện](/docs/agents/training)); trang này mô tả định dạng để viết cả hai thành phần này, cùng các công thức (recipes) khác.

Mọi công thức dưới đây đều tuân thủ [quy tắc truyền dữ liệu](/docs/agents/data-rules): **phương thức gọi tới nhà cung cấp mô hình sẽ gửi văn bản tới nhà cung cấp đó**, và tệp chỉ dùng nội bộ (local-only), tệp niêm phong (sealed) hoặc tệp yêu cầu chấp thuận (consent-required) sẽ từ chối phương thức này.

## method/1

`$schema` `https://champollion.dev/schemas/method/1.json`. Bắt buộc: `id`
(các từ viết thường nối bằng dấu gạch ngang), `name`, `kind` — cùng với một thiết lập mà loại (kind) đó yêu cầu, được các bộ đọc kiểm tra với cùng thông báo lỗi trong cả hai runtime.

| `kind` | Thiết lập bắt buộc | Chạy trong | Gửi văn bản tới |
|---|---|---|---|
| `llm` | `model` (một id chính xác, không dùng bí danh); tùy chọn `provider` | CLI; harness thông qua `-m` và `--provider` | Nhà cung cấp |
| `llm-coached` | `model`; chỉ dẫn huấn luyện (coaching) nằm trong `coaching` (`file`, `prompt` hoặc `dir`) | CLI; harness thông qua `-m` và `--coaching-file` | Nhà cung cấp: các câu văn và phần chỉ dẫn huấn luyện |
| `mt-api` | `engine` (từ `shared/method-registry.json`) | CLI; harness | Dịch vụ của bộ máy |
| `local-model` | `model` (một Hugging Face id hoặc một thư mục cục bộ) | Harness, trong tiến trình | Không đi đâu cả |
| `nmt-checkpoint` | `model_dir` | Thông qua dịch vụ của nó (`nmt-forge serve`) | Máy chủ của máy tính này |
| `lexicon` | `dictionary` | Harness, trong tiến trình | Không đi đâu cả |
| `python` | `entry_point` (`module:Class`) | Harness (`mt-eval run --method <folder>`) | Bất cứ nơi nào plugin gửi đến (`dependency_class`) |
| `service` | `service.endpoint` | CLI (phương thức `api`) | Điểm cuối (endpoint) đó |
| `human` | — | Con người; chấm điểm đầu ra của họ bằng `mt-eval test` | — |

Tùy chọn: `version`, `description`, `author`, `pairs` (`{source?, target}`),
`decode` (`temperature` 0–2, `batch_size`, `max_tokens`), `card` (thông tin hiển thị trên bảng xếp hạng), `dependency_class` (`S` độc lập khép kín, `O` bên ngoài mở,
`A1`/`A2` phụ thuộc API, `X` đóng), `evidence` (các lượt chạy đã đo lường: `dataset`,
`metric`, `score`, `ci`, `n` — chỉ các số), `runtimes` (`cli`, `engine`).

**Nơi một tệp method.json được tạo ra:** `methods/<id>/method.json` trong một dự án;
`nmt-forge export` (loại `nmt-checkpoint`); `mt-eval export --report <report>
--name <name> --type <type> --locales <code>`; `champollion serve
--emit-manifest` (kind `service`). Các định dạng cũ hơn (manifest plugin của CLI với
`type`, manifest plugin của harness với `entry_point`) vẫn được đọc dưới dạng
method/0 kèm theo một cảnh báo. Một tài liệu mang `$schema` được đọc là
method/1 và bắt buộc phải hợp lệ.

**Runtime nào nhận loại nào.** CLI từ chối `python`, `lexicon`,
`local-model` và `human` (*"chạy trong công cụ đánh giá (mt-eval run --method),
chứ không chạy trong champollion CLI — hoặc hãy khởi chạy dịch vụ và sử dụng thông qua điểm cuối của nó"*).
Tùy chọn `--method <folder>` của harness chỉ tải `python`; đối với bất kỳ loại nào khác,
nó sẽ nêu rõ các cờ (flags) để chạy thay thế.

**Giải mã (Decoding).** Nhiệt độ (temperature) mặc định là **0** (`shared/model-defaults.json`):
một giá trị duy nhất cho mức nhiệt độ mà ứng dụng dịch và mức mà harness đánh giá, nhằm
đảm bảo những gì được đo lường chính là những gì được phát hành — `mt-eval run --temperature` mặc định theo giá trị này.
Một cặp ngôn ngữ, một cấu hình hoặc một lượt chạy có thể tự đặt giá trị riêng.
Model id phải là các slug chính xác, không bao giờ dùng bí danh.

## Chuỗi cổng kiểm soát (Gate chains)

`$schema` `https://champollion.dev/schemas/gate-chain/1.json`, một tệp trong
`gates/`. Bắt buộc: `id`, `gates` (một hoặc nhiều). Tùy chọn: `description`,
`fallback`.

Mỗi cổng kiểm soát gồm: `id`, `kind` (`metric-threshold`, loại duy nhất), `metric` (tên
của một metric plugin), `field` (một khóa trong kết quả theo từng phân đoạn của plugin đó — một
con số, hoặc true/false được đọc thành 1/0), `min` và/hoặc `max`, `on_refuse`.

**Các quy tắc** (`arena/mt_eval_harness/gates.py`):

- Các cổng kiểm soát chạy theo thứ tự; cổng **đầu tiên** từ chối một phân đoạn sẽ quyết định những gì
  được phát hành:

  | `on_refuse` | Phát hành | Tính là |
  |---|---|---|
  | `drop` | không có gì | bị từ chối |
  | `keep-source` | văn bản nguồn | bị từ chối |
  | `flag` | đầu ra, có gắn dấu cờ | được gắn cờ, không bị từ chối |
  | `fallback` | bản dịch dự phòng (fallback), nếu các cổng tương tự chấp nhận nó; nếu lại bị từ chối, không phát hành gì | bị từ chối |

- **Khóa an toàn (Lock).** Một phân đoạn mà plugin không thể chấm điểm sẽ bị từ chối (`no_value`, hoặc
  `plugin_error:<type>`) — không bao giờ được phát hành như thể nó đã vượt qua kiểm tra.
- **Khóa an toàn (Lock).** Một cổng có plugin chưa được tải, hoặc không thể chấm điểm tại đây, sẽ dừng lượt
  chạy trước khi bất kỳ nội dung nào được dịch: *"một cổng không thể đưa ra đánh giá sẽ không bao giờ
  được xem là đã thông qua"*.
- **Khóa an toàn (Lock).** Bản dịch dự phòng phải chạy trong chính tiến trình này (`lexicon`, `local-model`,
  hoặc một plugin khai báo `dependency_class` `S` hoặc `O`), để phân đoạn bị từ chối
  không bị gửi ra ngoài.
- **Khóa an toàn (Lock).** `mt-eval run` và `mt-eval test` từ chối chuỗi có cổng `fallback`:
  *"dự phòng chỉ dành cho việc phục vụ và dịch thuật, không bao giờ dùng cho việc đo lường:
  điểm số khi đó sẽ là một phần của phương thức này và một phần của bản dự phòng, chung dưới một
  tên gọi"*. Hãy đo lường phương thức dự phòng như một phương thức độc lập.
- **Nơi áp dụng cổng kiểm soát:** `mt-eval run --gates`, `mt-eval test <run log>
  --gates` (re-scored without translating again), `mt-eval translate --gates`,
  `mt-eval serve --gates`, và `gates` của bản triển khai.
- Trong một phép đo lường, điểm số tiêu đề (headline) phản ánh những gì được phát hành; điểm chrF++ chưa qua cổng kiểm soát và
  tỷ lệ từ chối sẽ hiển thị bên cạnh, cùng mã nhận diện (fingerprint - sha256 của
  JSON chuẩn hóa) của chuỗi đi kèm với báo cáo ([đo lường](/docs/agents/measurement#gated-measurement)).
  Với `keep-source`, điểm tiêu đề sẽ chấm điểm văn bản nguồn tại nơi nó được phát hành.
- **Khóa an toàn (Lock).** Mỗi cổng cần `min` và/hoặc `max`, các gate id là duy nhất, và một
  cổng `fallback` cần `fallback` của chuỗi — `champollion validate` và
  harness sẽ đưa ra kết luận tương tự nhau. Tính năng thử lại một phân đoạn bị từ chối với
  lý do của cổng hiện chưa được xây dựng.

## Ví dụ thực tế: cổng kiểm tra tính hợp lệ FST

Bộ phân tích trạng thái hữu hạn (FST) cho biết liệu một từ có phải là một từ đúng cấu trúc trong
ngôn ngữ hay không. Metric plugin `giellalt_fst_validity` của harness báo cáo, trên từng
phân đoạn, các giá trị `fst_total_words`, `fst_valid_words`, `fst_invalid_words` và
`fst_validity_rate` (0–1). Các từ được tách theo khoảng trắng và loại bỏ dấu câu ở rìa;
từ viết hoa sẽ được thử lại ở dạng viết thường.

```json
{
  "$schema": "https://champollion.dev/schemas/gate-chain/1.json",
  "id": "fst-every-word",
  "description": "Ship a sentence only when the analyzer accepts every word.",
  "gates": [
    { "id": "fst-all-words", "kind": "metric-threshold",
      "metric": "giellalt_fst_validity", "field": "fst_validity_rate",
      "min": 1.0, "on_refuse": "flag" }
  ]
}
```

```bash
mt-eval setup --status               # the languages with a pinned analyzer
mt-eval setup --fst                  # the analyzer runtime
mt-eval setup --lang <code>          # the language's analyzer, once per machine
mt-eval run --corpus <dev file> --target-lang-code <code> --method local-model -m <model folder> \
  --gates gates/fst-every-word.json
```

- Bộ phân tích **không được đóng gói kèm**: harness chỉ cung cấp thông tin ghim (tên tệp
  và sha256 cho mỗi ngôn ngữ), và `setup --lang` sẽ tải bộ phân tích từ nguồn
  thượng nguồn vào `~/.mt-eval/fsts/<code>/`, theo các điều khoản của thượng nguồn. Nó được
  chạy như một công cụ riêng biệt, không bao giờ được liên kết vào CLI `champollion`.
- Thiếu bộ phân tích không bao giờ được tính là điểm 0: dưới dạng chỉ số (metric), nó được đánh dấu là chưa
  được tính toán; dưới dạng cổng kiểm soát (gate), nó sẽ dừng lượt chạy.
- Đầu ra rỗng nhận điểm 0 và bị từ chối dưới ngưỡng `min`.
- Để phục vụ với cổng này, hãy dùng `on_refuse: "fallback"` và một `fallback` chẳng hạn như
  `{"method": "lexicon", "model": "data/lexicon/words.tsv"}` — chỉ dành cho
  `translate` và `serve`.
- **Lưu ý.** Việc FST chấp nhận chỉ biểu thị rằng từ đó tồn tại, chứ không đảm bảo câu dịch mang
  đúng nghĩa. Đây là công cụ chẩn đoán: nó không bao giờ được đưa vào điểm tiêu đề chrF++.

## Các công thức (recipes)

### LLM có hướng dẫn (`llm-coached`)

Một mô hình tổng quát được prompt kèm theo hướng dẫn của cộng đồng: ghi chú ngữ pháp, phong cách,
thuật ngữ.

```bash
mt-eval run --corpus <dev file> -m <exact model id> --coaching-file coaching.md --glossary terms.json
champollion sync --method llm-coached --coaching-file coaching.md
```

- **Trong harness**, văn bản của tệp hướng dẫn (coaching file) *chính là* toàn bộ system prompt,
  vì vậy nó phải nêu rõ nội dung cần dịch và chỉ xuất ra bản dịch.
  `--glossary` là đầu vào dùng để chấm điểm (mức độ tuân thủ thuật ngữ), không bao giờ được gửi đi.
- **Khóa an toàn (Lock).** Một lượt chạy harness chỉ có một nội dung hướng dẫn: `--coaching-file`, `--coaching`
  (văn bản trực tiếp) hoặc tùy chọn cũ hơn `--custom-prompt` — hãy chọn một. Dùng cả hai cùng lúc sẽ
  bị từ chối: *"--coaching-file and --coaching each give the run its coaching —
  give one (put inline text in the file, or drop the file)"*.
- **Trong CLI**, `llm-coached` gửi prompt riêng của nó kèm theo nội dung hướng dẫn dưới dạng
  khối "Coaching guidance", cộng với `.champollion/coaching/<locale>.json`
  (`grammar_rules`, `style_notes`, `dictionary`).
- **Lưu ý.** Đây là hai prompt khác nhau: điểm số có hướng dẫn đo lường trong
  harness không bắt nguồn từ prompt chính xác mà CLI sử dụng khi phát hành. Hãy ghi rõ điều này khi bạn dùng kết quả
  này làm minh chứng cho kết quả kia.
- **Dữ liệu gửi đi:** toàn bộ các câu nguồn và toàn bộ tệp hướng dẫn tới nhà cung cấp. Tệp
  hướng dẫn có sidecar chỉ dùng nội bộ (local-only) chỉ chạy được trên một endpoint loopback
  (`champollion data mark coaching.md --local-only` đánh dấu điều này).

### Few-shot

Các ví dụ về bản dịch tốt được đặt bên trong nội dung hướng dẫn. Đây là một dạng coached LLM: cùng
các lệnh, cùng phương thức truyền tải — các ví dụ sẽ được gửi trong system prompt tới
nhà cung cấp.

- **Lưu ý.** Không bao giờ lấy ví dụ từ tập kiểm tra (test set), và không bao giờ lấy từ
  tệp chỉ dùng nội bộ (local-only) để gửi tới một nhà cung cấp từ xa. Không có cơ chế tự động nào
  kiểm tra xem các ví dụ few-shot có trùng với tài liệu tham chiếu kiểm tra hay không.

### LLM bổ trợ bằng từ điển

- **CLI:** `dictionary` trong `.champollion/coaching/<locale>.json` được gửi
  tới mọi phương thức LLM dưới dạng "REQUIRED TERMINOLOGY" cho các thuật ngữ tìm thấy trong từng
  lô (so khớp chuỗi con không phân biệt hoa thường). DeepL nhận mục này dưới dạng bảng thuật ngữ (glossary).
  Các vi phạm sẽ được cảnh báo sau khi dịch; không có cơ chế thử lại.
- **Harness:** từ điển chỉ đến được với mô hình dưới dạng văn bản trong tệp
  hướng dẫn.
- **Chỉ dùng từ điển:** `mt-eval run --method lexicon -m data/lexicon/words.tsv
  --corpus <dev file>` — cụm từ dài nhất trước, giữ nguyên từ chưa biết, chạy trong
  tiến trình. `nmt-forge floor` chính là phương thức này, chạy trên tập phát triển (dev set)
  ([đo lường](/docs/agents/measurement#the-dictionary-floor)).
- **Dữ liệu gửi đi:** các mục khớp trong từ điển cùng với các câu dịch tới
  nhà cung cấp. Một từ điển chỉ dùng nội bộ tuyệt đối không được gửi tới nhà cung cấp từ xa.

### Phương thức lai dựa trên quy tắc (Rule-based hybrid)

Không có bộ máy quy tắc nào được tích hợp sẵn. Những gì hiện có: `lexicon` (xác định, chạy trong
tiến trình); `mt-eval run --method apertium` (bộ máy dựa trên quy tắc — gửi văn bản
tới `apertium.org` trừ khi `APERTIUM_API_URL` trỏ tới máy chủ riêng của bạn); và
các plugin `python` dành cho quy tắc riêng của bạn, tùy chọn kết hợp với một LLM. Một lớp plugin
cần `async def translate(self, entries, config)`; chạy nó bằng `mt-eval run
--method <folder>`. Xác thực đầu ra của nó bằng một chuỗi cổng kiểm soát.

- **Dữ liệu gửi đi:** bất kỳ thứ gì mà plugin gọi tới. Plugin là một phương thức bên ngoài: trên một
  tập ngữ liệu yêu cầu chấp thuận hoặc niêm phong (bao gồm cả local-only), harness sẽ từ chối
  nó trừ khi có `--attest-local-transport` — cờ mà bạn chỉ truyền vào sau khi đã xác minh
  mọi thứ nó gọi đều nằm trên máy tính này.

### Các phương thức theo chuỗi (Chained methods)

Có hai chuỗi được tích hợp sẵn:

1. **Dự phòng của chuỗi cổng kiểm soát:** phương thức → các cổng kiểm soát → phương thức dự phòng trong tiến trình → chính các
   cổng kiểm soát đó. Chỉ dành cho `translate` và `serve`.
2. **Dự phòng theo cặp của CLI** (`"fallback": {"method": …}` trên một cặp của ứng dụng):
   phương thức chính → cổng chất lượng của CLI → thử lại với phản hồi của cổng
   (các phương thức LLM, hoặc một điểm cuối `api` có khai báo `acceptsInstructions`) →
   phương thức dự phòng một lần, qua cùng cổng đó.

Bất kỳ chuỗi nào dài hơn (tạo, chỉnh sửa, xác thực qua các mô hình) đều là một plugin
`python` hoặc một `service`.

- **Dữ liệu gửi đi:** mỗi mắt xích gửi những gì loại của nó gửi. Một chuỗi chỉ mang tính riêng tư bằng
  mắt xích có mức độ riêng tư thấp nhất trong nó.

### Dịch bán phần (người và máy)

Mô hình dịch nháp; người nói ngôn ngữ sẽ kiểm tra và sửa lỗi. Trên rails, đây là vòng cải thiện
(improve round): `champollion improve sheet` tạo bản nháp, người nói ngôn ngữ đánh dấu `Y`/`N`/`?`,
`champollion improve marks` chuyển các chỉnh sửa và bản nháp đã xác nhận thành các cặp
huấn luyện và các hàng thực hành thành câu dev ([coaching](/docs/agents/coaching)).
Để chấm điểm bản dịch do chính con người tạo ra như một phương thức (`kind` `human`), hãy chạy
`mt-eval test` trên đầu ra của họ. Một cổng với `on_refuse: "flag"` sẽ đánh dấu đầu ra
để rà soát lại.

- **Lưu ý.** Một câu được dùng để hướng dẫn (coach) hoặc huấn luyện (train) một phương thức không bao giờ được phép nằm trong tập câu
  dùng để chấm điểm phương thức đó.
- **Dữ liệu gửi đi:** không có gì ngoài các quy tắc của chính mô hình dịch nháp; các trang tính (sheets) vẫn nằm
  trong thư mục dự án.

### Mô hình tinh chỉnh (Fine-tuned model)

- **Trên rails:** `nmt-forge` (`nmt-checkpoint`; các preset `cpu-tiny`,
  `byt5-small`, `byt5-small-lowmem`, `cpu-finetune`, `nllb-600m`), được xuất,
  phục vụ và kết nối —
  [huấn luyện](/docs/agents/training), [phục vụ](/docs/agents/serving).
- **Mô hình có sẵn bạn đang có:** `mt-eval run --method local-model -m
  <Hugging Face id or folder>` — chạy trong tiến trình; không có gì rời khỏi máy tính.
- **Một LLM bạn tự phục vụ** (Ollama, vLLM, bất kỳ hệ thống nào tương thích OpenAI):
  `mt-eval run --provider local --base-url http://127.0.0.1:11434/v1 -m
  <model name>`. Nó chỉ được tính là cục bộ khi điểm cuối là một địa chỉ
  loopback.
- **Dữ liệu gửi đi:** không gửi gì ra khỏi máy tính, khi điểm cuối thực sự là cục bộ.

## Tìm hiểu sâu hơn

- [Quy cách phương thức](/docs/network/specifications/methods) và
  [manifest plugin](/docs/reference/plugin-spec) (định dạng cũ hơn).
- [Phục vụ và triển khai](/docs/agents/serving) — deployment/1 và
  service-api/1.
- [Quy tắc đo lường](/docs/agents/measurement) — điểm số qua cổng kiểm soát.
- [Quy tắc dữ liệu và truyền tải](/docs/agents/data-rules) — những gì được phép gửi đi.
- [Phương thức dịch cho ứng dụng và trang web](/docs/guides/translation-methods).
