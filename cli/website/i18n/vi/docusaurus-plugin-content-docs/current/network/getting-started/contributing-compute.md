---
sidebar_position: 4
title: "Đóng góp tài nguyên tính toán"
description: "Chạy hàng đợi: chạy các đợt quét benchmark mở từ hàng đợi công cộng bằng khóa API của riêng bạn và công bố kết quả."
related:
  - label: "Agent Guide: Building & Benchmarking on the Network"
    to: /docs/network/getting-started/agent-guide
    kind: guide
  - label: "Cookbook: Coached LLM Prompting"
    to: /docs/network/tutorials/coached-llm-prompting
    kind: cookbook
  - label: "Cookbook: FST-Gated Pipeline"
    to: /docs/network/tutorials/fst-gated-pipeline
    kind: cookbook
  - label: "Method Interface & Dependency Classes"
    to: /docs/network/specifications/methods
    kind: spec
  - label: "Leaderboard Rules & Trust Tiers"
    to: /docs/network/leaderboard/rules
    kind: guide
---

# Đóng góp tài nguyên tính toán

> **Ý tưởng:** bảng xếp hạng có những ô trống — các tổ hợp (cặp ngôn ngữ, phương pháp, điều kiện) mà chưa ai đo lường. Chúng tôi duy trì một hàng đợi công khai cho chúng. Bạn chạy các mục này bằng API key của riêng mình, xuất bản các báo cáo và bản đồ sẽ được lấp đầy. Đóng góp tài nguyên máy tính (compute) là một đóng góp thực sự, có thể trích dẫn cho việc đánh giá dịch máy (MT) tài nguyên thấp.

Hàng đợi chứa hai loại công việc. **Các mục LLM** kiểm tra một mô hình trò chuyện trên một cặp ngôn ngữ, trong điều kiện prompting `naive` hoặc `coached`. **Các mục Engine** (điều kiện `engine`) kiểm tra một dịch vụ dịch máy (MT) cổ điển — DeepL, Google Translate, Microsoft Translator, LibreTranslate, Tilde — trên các cặp ngôn ngữ nằm trong phạm vi hỗ trợ đã công bố của chính dịch vụ đó; đây là xương sống được đo lường của bản đồ độ phủ, và cho đến tháng 8 năm 2026, chúng gần như hoàn toàn trống. Cả hai loại đều chạy qua cùng một harness và xuất bản lên cùng một bảng.

## Hàng đợi

Hàng đợi trực tiếp được phục vụ từ cơ sở dữ liệu (harness đọc nó theo mặc định); một bản snapshot nhỏ gọn được xuất bản tại [champollion.dev/queue-preview.json](https://champollion.dev/queue-preview.json), với tệp đầy đủ tại [queue.json](https://champollion.dev/queue.json) (hàng chục MB — bản preview là lựa chọn tải về đầu tiên phù hợp). Bạn có thể theo dõi những gì các lần chạy của mình xây dựng trên [bản đồ trực tiếp tại champollion.dev](https://champollion.dev) — bản đồ độ phủ về việc ai có thể dịch ngôn ngữ nào. Ngoài ra còn có một trình xem trên terminal không cần cài đặt:

```bash
curl -fsSL https://champollion.dev/run_queue | bash -s -- --budget 2
```

Trình xem này chỉ *hiển thị* các mục đang mở và các lệnh `mt-eval run` chính xác của chúng — nó không bao giờ thực thi bất kỳ lệnh nào hoặc tiêu tốn token của bạn. Mỗi mục bao gồm:

- `run_command` — sẵn sàng để sao chép-dán (tải corpus, chạy harness)
- `est_cost_usd` và `est_basis` — có thể là chi phí **quan sát được** từ lần chạy baseline của chính chúng tôi cho cùng một (corpus, mô hình), hoặc một **ước tính ngoại suy** từ chi phí trung bình trên mỗi mục của mô hình đó × số lượng mục trong corpus. Cơ sở tính toán được nêu rõ cho từng mục; chi phí thực tế của bạn phụ thuộc vào giá của nhà cung cấp tại thời điểm chạy.
- `priority` — thứ hạng được xuất bản (chế độ khảo sát: ưu tiên khám phá các cặp, ngôn ngữ và ngữ hệ trên mỗi đô la). Bản preview cũng xuất bản **các mức ngân sách** — $1 / $10 / $100 / $1000 sẽ mua được gì từ đầu bảng xếp hạng (các mục, cặp ngôn ngữ, mô hình đạt được) — để bạn có thể ước lượng quy mô đóng góp trước khi chi tiêu bất cứ thứ gì. Mô hình giá trị cơ bản là **giá trị chuỗi kỳ vọng** (expected chain value): một lần chạy này được dự đoán sẽ củng cố toàn bộ mạng lưới ngôn ngữ bao nhiêu, trên mỗi đô la ước tính. Mỗi mục đều mang theo phân tích công thức đầy đủ của nó (`edge_strength`, `pair_prior`, `model_offset`, `exploration_bonus`, `predicted_strength`, `expected_mesh_gain`, `ecv_per_usd`) để bất kỳ thứ hạng nào cũng có thể được tính toán lại bằng tay — công thức và các giá trị mặc định của nó được xuất bản trong [Queue Construction Specification](/docs/network/specifications/queue-construction), và lý do đằng sau nó nằm trong [Why the Queue Is Built This Way](/docs/network/perspectives/why-the-queue).

**Không khóa lượt nhận — chọn bất kỳ mục nào đang mở.** Việc hai người cùng chạy một mục là hoàn toàn vô hại theo thiết kế: mỗi thẻ lượt chạy (run card) đều được gắn dấu vân tay (SHA-256 dựa trên hash của tập dữ liệu + mô hình + điều kiện + prompt hệ thống, [Đặc tả Benchmark §3.8](/docs/network/specifications/benchmark)), vì vậy các lượt chạy giống hệt nhau sẽ được loại bỏ trùng lặp khi xuất bản, và các lượt chạy độc lập của cùng một cấu hình là bằng chứng hữu ích chứ không phải lãng phí.

Các ngữ liệu trong hàng đợi được chia theo tập phát triển (dev-split), thuộc họ giấy phép CC-BY (nguồn gốc từ Tatoeba), và được gắn cờ `do_not_train` — chúng là các tập dữ liệu đánh giá, không phải dữ liệu huấn luyện. Các ngữ liệu có giấy phép phi thương mại và ngữ liệu bị cách ly (quarantined) sẽ bị loại trừ khỏi hàng đợi mở.

## Thiết lập (một lần)

```bash
# 1. Install the harness (python3 + pipx, no sudo — read it first if you like)
pipx install mt-eval-harness

# 2. Set your API key — any ONE of these; the harness auto-detects it
export OPENROUTER_API_KEY="sk-or-..."     # reaches every model in the queue
# or a direct vendor key:
#   ANTHROPIC_API_KEY / OPENAI_API_KEY / GOOGLE_API_KEY
# (any of them can also live in a local .env file)
```

### Sử dụng key của nhà cung cấp nào?

Khung thử nghiệm chấp nhận bốn loại key nhà cung cấp, được chọn bằng `--provider` trên `mt-eval run` và `mt-eval queue` — hoặc tự động phát hiện từ bất kỳ key nào được thiết lập trong môi trường của bạn hoặc trong `.env`:

| `--provider` | Key | Tiếp cận |
|---|---|---|
| `openrouter` (mặc định) | `OPENROUTER_API_KEY` | mọi mô hình trong danh sách hàng đợi |
| `anthropic` | `ANTHROPIC_API_KEY` | các mô hình Anthropic Claude |
| `openai` | `OPENAI_API_KEY` | các mô hình OpenAI GPT |
| `gemini` | `GOOGLE_API_KEY` | các mô hình Google Gemini |

Một key [OpenRouter](https://openrouter.ai/keys) có thể tiếp cận mọi mô hình trong danh sách, và việc theo dõi chi phí cũng như ảnh chụp nhanh giá cả của khung thử nghiệm đều lấy từ cùng một siêu dữ liệu (metadata) của OpenRouter, vì vậy chi phí lượt chạy được báo cáo sẽ khớp với số tiền thực tế bị tính phí trên key của bạn — đó là lý do tại sao đây là tùy chọn mặc định. Nếu số dư của bạn nằm trực tiếp ở Anthropic, OpenAI hoặc Google, hãy thiết lập key của nhà cung cấp đó và khung thử nghiệm sẽ gọi trực tiếp API của họ mà không qua proxy. Key trực tiếp chỉ tiếp cận được các mô hình của chính nhà cung cấp đó (phù hợp cho một loạt lượt chạy của một nhà cung cấp duy nhất), và số liệu chi phí của nó sẽ lấy từ bảng giá công bố của nhà cung cấp thay vì siêu dữ liệu thanh toán thực tế — hãy coi chúng là các ước tính gần đúng. Nếu cả key OpenRouter và key trực tiếp đều được thiết lập, hệ thống tự động phát hiện sẽ chọn OpenRouter; trình chạy hàng đợi (queue worker) sẽ thông báo cho bạn và hướng dẫn cách ghi đè bằng `--provider`. Mỗi thẻ lượt chạy đều ghi lại luồng xử lý mà nó đã đi qua trong trường `api_provider`.

(`mt-eval run` cũng nhận `--provider local` cho các endpoint tương thích với OpenAI tự lưu trữ — Ollama, vLLM, LM Studio — thông qua `--base-url`. Đây là một tùy chọn kích hoạt rõ ràng, không bao giờ được tự động phát hiện.)

### Không có API key: chạy mô hình tự lưu trữ (self-hosted)

Bạn hoàn toàn không cần cloud key. Phương pháp `local-model` chạy một mô hình neural-MT mở trên phần cứng của riêng bạn — những mô hình mà các cloud engine không phục vụ, và đây chính xác là nơi tồn tại độ phủ cho các ngôn ngữ tài nguyên thấp: **NLLB-200**, **OPUS-MT** (Helsinki-NLP), và **MADLAD-400**.

```bash
# transformers backend (Hugging Face) — install the extra once:
pip install 'mt-eval[local-models]'

# then point --model at any Hugging Face id (or a local from_pretrained dir):
mt-eval run --method local-model \
  --model facebook/nllb-200-distilled-600M \
  --dataset flores-eng-fra
```

**Hai "cách thông thường" để tải một mô hình, được tự động chọn — không cần cấu hình gì cả:**

- **transformers** (mặc định): `--model` là một hub id của Hugging Face (`facebook/nllb-200-distilled-600M`, `Helsinki-NLP/opus-mt-en-es`, `google/madlad400-3b-mt`) hoặc một thư mục `from_pretrained()` cục bộ. Cần `pip install 'mt-eval[local-models]'`.
- **CTranslate2** (suy luận CPU/GPU nhanh): `--model` là một thư mục mô hình đã được chuyển đổi sang CTranslate2 (được tạo bởi `ct2-transformers-converter`, chứa một `model.bin`). Cần `pip install 'mt-eval[ctranslate2]'`. Tokenizer được đọc từ thư mục đã chuyển đổi, hoặc được đặt tên bằng `LOCAL_TOKENIZER_ID`.

Backend được phát hiện từ đường dẫn mô hình (một thư mục CTranslate2 có chứa `model.bin`); bạn có thể ép buộc sử dụng nó bằng `LOCAL_MODEL_BACKEND=transformers|ctranslate2` nếu cần.

**Mã ngôn ngữ đến từ thẻ ngôn ngữ (language card), không phải do phỏng đoán.** Đối với một mô hình đa ngôn ngữ như NLLB, harness đọc mã FLORES-200 trực tiếp từ thẻ của ngôn ngữ đích (cùng một nguồn chân lý mà mọi phương pháp đều sử dụng). Một ngôn ngữ mà mô hình thực sự không phục vụ — ví dụ: NLLB-200 không có tiếng Plains Cree (`crk`) — sẽ **thất bại một cách trung thực** ("nằm ngoài phạm vi của mô hình này") thay vì phát ra một mã giả mạo và một bản dịch có vẻ hợp lý nhưng sai. Các mô hình OPUS-MT là dành riêng cho từng cặp, vì vậy cặp ngôn ngữ *chính là* mô hình.

Một lần chạy mô hình cục bộ sẽ chấm điểm và xuất bản chính xác giống như bất kỳ lần chạy nào khác — cùng các số liệu, cùng thẻ chạy (run card), cùng bảng xếp hạng. (Đó là một phương pháp của harness; công cụ dịch CLI sẽ tiếp cận nó sau thông qua một cầu nối subprocess, vì vậy Node không bao giờ cần đến một Python ML stack.)

### Lối tắt cho agent

Nếu bạn làm việc với Claude Code hoặc một coding agent khác, toàn bộ quá trình đóng góp chỉ gói gọn trong một prompt:

```text
Install the Champollion mt-eval harness with `pipx install mt-eval-harness`.
Fetch https://champollion.dev/queue.json and show me the top 3 open items.
Using my API key (OPENROUTER_API_KEY, or a direct ANTHROPIC_API_KEY /
OPENAI_API_KEY / GOOGLE_API_KEY), execute the run_command of the
item I pick, then run `mt-eval publish` on the generated report JSON and
show me the published run card.
```

## Cấp độ 0 — Một lệnh duy nhất

Cách nhanh nhất để đóng góp là để khung thử nghiệm tự động lấy mục đầu tiên trong hàng đợi cho bạn:

```bash
mt-eval queue --top 5          # run the 5 highest-value open items
mt-eval queue --budget 2.50    # or: run from the top until ~$2.50 of
                               # estimated spend is committed
mt-eval queue --top 3 --dry-run   # see the plan first, spend nothing
```

Nó không bao giờ sắp xếp lại — thứ tự hàng đợi *chính là* [mô hình ưu tiên](/docs/network/specifications/queue-construction) — và nó hiển thị kế hoạch đầy đủ với chi phí ước tính cũng như hỏi ý kiến bạn trước khi thực thi bất kỳ điều gì. Các mục có hướng dẫn (coached items) sẽ bị bỏ qua trừ khi bạn cung cấp tệp hướng dẫn của riêng mình (`--include-coached --coaching-file my-coaching.txt`).

**Trình chạy hàng đợi sẽ tự động xuất bản cho bạn — không cần tài khoản.** Không giống như một lệnh `mt-eval run` đơn lẻ (không bao giờ tự động xuất bản), `mt-eval queue` xác định danh tính xuất bản *trước khi* tiêu tốn bất kỳ token nào và **tự động xuất bản mỗi lượt chạy thành công** lên bảng xếp hạng ngay khi hoàn thành — không cần bước xuất bản riêng biệt. Bạn chỉ cần đăng nhập (GitHub/Google) nếu muốn tên mình xuất hiện trên bảng xếp hạng; nếu không, hãy tiếp tục ẩn danh và kết quả sẽ được đăng dưới tên người gửi `anonymous` (`--anonymous` sẽ bắt buộc điều này, và các lượt chạy `curl | bash` không tương tác không có đăng nhập được lưu trong bộ nhớ cache sẽ mặc định chọn chế độ này và thông báo rõ ràng). Truyền `--no-publish` để lưu kết quả cục bộ (bạn có thể xuất bản chúng sau bằng `mt-eval publish`). Sau đó, hãy theo dõi những gì lượt chạy của bạn đóng góp trên [bản đồ trực tiếp tại champollion.dev](https://champollion.dev).

## Cấp độ 1 — Chạy một benchmark

Mỗi `run_command` của mục hàng đợi đều độc lập. Một ví dụ điển hình:

```bash
mt-eval run --corpus eval-eng-yor-tatoeba-dev-v1 \
  --model anthropic/claude-haiku-4.5 \
  --target-lang "Yoruba" \
  --yes
```

Bạn truyền vào **registry id**, không phải một tệp — khung thử nghiệm sẽ tải bản tham chiếu từ nguồn thượng nguồn của nó tại thời điểm chạy và tính điểm dựa trên dữ liệu vừa tải về (nội dung ngữ liệu không bao giờ được lưu trữ hoặc theo dõi ở đây).

Lượt chạy sẽ in ra tổng chi phí và ghi nhật ký chạy cùng báo cáo điểm số vào `eval/logs/`. Sau đó xuất bản:

```bash
mt-eval publish eval/logs/harness/run_..._report.json
```

**Không cần tài khoản.** Việc xuất bản cung cấp tùy chọn đăng nhập OAuth (GitHub/Google) để tên của bạn được ghi nhận trên bảng xếp hạng — nhưng điều này là không bắt buộc: `mt-eval publish <report> --anonymous` cho phép xuất bản mà không cần tài khoản, và hàng kết quả sẽ hiển thị chính xác như bất kỳ kết quả tự benchmark nào khác với người gửi là `anonymous`. Việc tiếp nhận ẩn danh bị giới hạn tần suất (một vài thẻ mỗi giờ cho mỗi kết nối; đăng nhập là con đường không bị giới hạn) và đi qua các cổng kiểm tra tính toàn vẹn của cơ sở dữ liệu giống như mọi lượt gửi khác — quy trình cách ly, phạm vi điểm số, liên kết corpus-sha và bảo vệ nội dung ngữ liệu đều được áp dụng giống hệt nhau. Dù ẩn danh hay được ghi nhận danh tính, các lượt gửi từ cộng đồng sẽ nằm ở mức độ tin cậy **tự benchmark (self-benchmarked)** — được dán nhãn rõ ràng là "được gửi bởi người đã chạy nó". Đó không phải là một sự hạ cấp; đó là cách mô hình tin cậy hoạt động. Thẻ lượt chạy mang theo mọi thứ cần thiết để bất kỳ ai cũng có thể chạy lại chính xác cấu hình của bạn: hash tập dữ liệu, mô hình, điều kiện, prompt hệ thống đầy đủ và chi phí. Các cấp độ tin cậy cao hơn (xác minh, xác thực cộng đồng) được cấp thông qua quy trình đánh giá — xem [Quy tắc bảng xếp hạng](/docs/network/leaderboard/rules).

:::note[Kiểm duyệt]
Các hàng ẩn danh cũng được kiểm duyệt giống như mọi thứ khác: các lượt gửi là bất biến đối với API công khai, và bất kỳ hoạt động xóa hoặc sửa đổi nào từ người quản lý (curator) đều đi qua luồng vai trò dịch vụ (service-role lane), nơi nhật ký kiểm toán (audit trail) của cơ sở dữ liệu lưu giữ hàng dữ liệu trước đó — vì vậy việc xóa bỏ luôn được ghi lại và có thể hoàn tác, không bao giờ diễn ra trong âm thầm.
:::

## Cấp độ 2 — Thiết kế prompt có hướng dẫn (coached prompts)

Khung thử nghiệm hỗ trợ tối đa cho tính năng **hướng dẫn (coaching)**: thay thế prompt hệ thống thông thường (naive system prompt) bằng một prompt mang kiến thức ngôn ngữ thực tế. Truyền `--coaching-file` (hoặc `--coaching "inline text"` cho các prompt ngắn) và khung thử nghiệm sẽ sử dụng văn bản của bạn làm prompt hệ thống, ghi lại **toàn bộ văn bản cùng với mã SHA-256 của nó** trong khối nguồn gốc (provenance block) của nhật ký chạy, và dán nhãn điều kiện của lượt chạy là **`coached`** (trừ khi bạn thiết lập `--prompt` một cách rõ ràng) — nhờ đó, việc thiết kế prompt trở thành một thử nghiệm có thể tái lập và ghi nhận công lao rõ ràng, hai tệp hướng dẫn khác nhau không bao giờ bị nhầm lẫn với nhau, và các lượt chạy có hướng dẫn không bao giờ bị nhầm với các baseline thông thường trên bảng xếp hạng.

Một ví dụ thực tế cho tiếng Faroe, sử dụng các dữ kiện loại hình học và các mục từ điển từ [thẻ ngôn ngữ công khai](https://champollion.dev/languages) của ngôn ngữ này:

```text title="coaching-fao.txt"
You are translating English into Faroese (føroyskt).

Grammar notes:
- Faroese is a North Germanic V2 language: the finite verb is the second
  constituent of a main clause.
- Nouns inflect for case (nominative, accusative, dative, genitive),
  gender (masculine, feminine, neuter), and number. Make adjectives and
  determiners agree.
- The skerping pattern applies before -gv/-ggj sequences; preserve
  standard orthography including ð (which is silent).

Glossary (use these exact equivalents):
- language -> mál
- island -> oyggj
- weather -> veður

Style: plain register, modern standard orthography. Output only the
Faroese translation, no commentary.
```

```bash
mt-eval run --corpus eval-eng-fao-tatoeba-dev-v1 \
  --model anthropic/claude-haiku-4.5 \
  --target-lang "Faroese" \
  --coaching-file coaching-fao.txt \
  --yes
```

(Hãy tự viết nội dung hướng dẫn của riêng bạn — các dữ kiện trên minh họa cho *khung sườn*: một vài quy tắc ngữ pháp có tác động lớn, một từ điển nhỏ gồm các thuật ngữ mà mô hình hay dịch sai, một hướng dẫn về văn phong. Các thẻ ngôn ngữ tại [champollion.dev/languages](https://champollion.dev/languages) trích dẫn các nguồn loại hình học mà bạn có thể tham khảo.)

So sánh với baseline thông thường bằng `mt-eval compare <naive_log> <coached_log>`, lặp lại quy trình và xuất bản lượt chạy tốt nhất của bạn. Lượt chạy sẽ tự động được xuất bản với điều kiện `coached`; nếu bạn muốn bảng xếp hạng hiển thị một phương pháp có tên cụ thể thay vì nhãn chung chung, hãy đính kèm một thẻ phương pháp (method card) khi xuất bản (quy trình xuất bản có cung cấp một trình hướng dẫn từng bước). Việc vượt qua baseline thông thường trên một cặp ngôn ngữ nguồn tài nguyên thấp chỉ bằng kỹ nghệ prompt (prompt engineering) là một phát hiện thực tế, rất đáng để công bố — xem toàn bộ [hướng dẫn thực hành Coached LLM Prompting](/docs/network/tutorials/coached-llm-prompting) để biết thêm chỉ dẫn thiết kế.

## Cấp độ 3 — Xây dựng một phương pháp

Đóng góp đầy tham vọng nhất: triển khai giao thức `TranslationMethod` (`translate(entries, config)`) và benchmark một hệ thống thực tế, chứ không chỉ là một prompt. Khung thử nghiệm sẽ chạy nó thông qua `--method <plugin-dir>` và nhúng thẻ phương pháp của bạn vào thẻ lượt chạy. Các mô hình thiết kế kèm hướng dẫn thực hành chi tiết:

- **[FST-gated pipelines](/docs/network/tutorials/fst-gated-pipeline)** — mỗi từ ứng viên đều được kiểm tra bởi một bộ phân tích hình thái; LLM sẽ tạo lại cho đến khi vượt qua cổng kiểm duyệt. Đầu ra bán xác định, đảm bảo tính chính xác về mặt hình thái.
- **[Dictionary-augmented generation](/docs/network/tutorials/dictionary-augmented-llm)** — tra cứu các thuật ngữ nguồn trong một từ điển song ngữ tại thời điểm dịch và ràng buộc đầu ra.
- [Chained models](/docs/network/tutorials/chained-models) (mô hình chuỗi), [few-shot retrieval](/docs/network/tutorials/few-shot-prompting) (truy xuất few-shot), [back-translation](/docs/network/tutorials/back-translation) (dịch ngược), [rule-based hybrids](/docs/network/tutorials/rule-based-hybrid) (mô hình lai dựa trên quy tắc)…

Các phương pháp khai báo một **lớp phụ thuộc (dependency class)** (S/O/A1/A2/X — xem [đặc tả phương pháp](/docs/network/specifications/methods#method-validity-and-dependency-classes)) mô tả những gì chúng cần để chạy và truyền tải: một pipeline độc lập là Lớp S; một pipeline gọi API từ điển có bản quyền tại thời điểm chạy là A2. Hãy khai báo trung thực — lớp này quyết định nơi phương pháp của bạn có thể cạnh tranh, và các tệp manifest sẽ được kiểm toán.

## Tại sao điều này lại quan trọng ngoài phạm vi bảng xếp hạng

Mỗi lượt chạy được xuất bản là một bằng chứng độc lập về chất lượng dịch máy (MT) cho một cặp ngôn ngữ mà các nhà cung cấp thương mại không đo lường. Hàng đợi này đồng thời đóng vai trò là một hồ sơ công khai về *nhu cầu*: những cặp ngôn ngữ nào được cộng đồng coi là đáng để đo lường, chi phí bao phủ ở mức giá API hiện tại là bao nhiêu, và tài nguyên tính toán đóng góp có thể tiến xa đến mức nào. Khi chúng tôi yêu cầu các quỹ tài trợ bảo trợ cho các đợt quét hệ thống, hàng đợi này và tỷ lệ lấp đầy của nó chính là bằng chứng thực tế về nhu cầu.
