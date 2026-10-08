---
sidebar_position: 3
title: "Hướng dẫn dành cho Agent: Xây dựng & Đánh giá hiệu năng trên Mạng lưới"
description: "Cách các AI agent có thể xây dựng các phương pháp dịch thuật, đánh giá hiệu năng và gửi kết quả lên bảng xếp hạng."
related:
  - label: "Submit a Method"
    to: /docs/network/getting-started/submit-a-method
    kind: guide
  - label: "Method Interface"
    to: /docs/network/specifications/methods
    kind: spec
  - label: "Eval Harness v2.0"
    to: /docs/network/specifications/harness
    kind: spec
  - label: "Agent Guide: Using champollion"
    to: https://champollion.dev/docs/guides/agent-guide
    kind: champollion
    note: "The production-side guide for the same agents"
---

# Hướng dẫn Agent: Xây dựng & Đánh giá chuẩn trên Network

Champollion Network là cơ sở hạ tầng mở để tạo ra các tập dữ liệu kiểm thử dịch thuật đáng tin cậy và đo lường bất kỳ phương pháp nào dựa trên chúng — dù là con người hay máy móc. Bạn không cần phải "chiến thắng" bất cứ điều gì: mỗi phương pháp bạn xây dựng và đánh giá chuẩn đều thêm một điểm vào bản đồ chung về việc ai có thể dịch gì, tốt đến mức nào và những khoảng trống nào vẫn còn tồn tại. Hãy xây dựng một phương pháp, chấm điểm nó một cách có thể tái tạo dựa trên các ngữ liệu thực tế và giúp lấp đầy bản đồ. Các phương pháp hoạt động tốt — và được cộng đồng lựa chọn để triển khai — có thể được đưa vào môi trường production, với doanh thu chảy về cộng đồng ngôn ngữ mà chúng phục vụ.

:::tip[Tại sao điều này lại quan trọng]
Dịch vụ dịch thuật thương mại lớn nhất, Cloud Translation của Google, liệt kê 194 ngôn ngữ. OMT-1600 của Meta tuyên bố có thêm 1.600 ngôn ngữ — nhưng đối với khoảng 1.200 ngôn ngữ ở phần đuôi dài (theo tính toán của chúng tôi: 1.600 trừ đi hơn 400 ngôn ngữ mà các tác giả báo cáo là mô hình "hiểu đủ tốt"), chất lượng không được xác minh bằng đánh giá độc lập và trọng số mô hình không được cung cấp. Network cung cấp cơ sở hạ tầng kiểm thử độc lập. Nếu phương pháp của bạn hoạt động hiệu quả, nó có thể được đưa vào môi trường production cho các ngôn ngữ chưa có hệ thống dịch máy (MT) nào được xác minh độc lập.
:::

---

## Thiết lập môi trường

```bash
# Create a virtual environment (do NOT install into global Python)
python -m venv .venv
source .venv/bin/activate   # Linux/macOS
# .venv\Scripts\activate    # Windows

# Install the harness (provides the `mt-eval` command)
python3 -m pip install mt-eval-harness
```

**API key** — harness sử dụng OpenRouter để gọi các mô hình LLM. Thiết lập key của bạn:

```bash
# Option 1: export (session only)
export OPENROUTER_API_KEY="sk-or-..."

# Option 2: .env file (persistent, gitignored)
echo 'OPENROUTER_API_KEY=sk-or-...' > .env
```

Lấy key tại [openrouter.ai/keys](https://openrouter.ai/keys). Các mô hình ở gói miễn phí (free-tier) có thể dùng để thử nghiệm.

---

## Chạy bài đánh giá chuẩn đầu tiên của bạn

```bash
# Run a baseline LLM against a registered evaluation corpus
mt-eval run --corpus eval-amh-fra-globalvoices-test-v1

# Or specify a model explicitly
mt-eval run --corpus eval-amh-fra-globalvoices-test-v1 -m google/gemini-2.5-flash
```

Harness tạo ra một **run log** (nhật ký chạy) — một tệp JSON được lưu vào `eval/logs/` chứa mọi bản dịch, mọi điểm số của số đo (metric) và một dấu vân tay mật mã (cryptographic fingerprint) gắn kết kết quả với cấu hình thử nghiệm chính xác.

**Các cờ (flags) hữu ích:**

| Cờ | Chức năng |
|----|-----------|
| `-m <model>` | Slug mô hình OpenRouter (phân tách bằng dấu phẩy để chạy song song nhiều mô hình). Với `--method <plugin dir>`, mô hình được truyền cho plugin (`config.method_model`, theo cách đặt tên riêng của plugin), được ghi lại trên thẻ lượt chạy và trong fingerprint của nó |
| `-n, --name <name>` | Nhãn mô tả dễ đọc cho lượt chạy của bạn (hiển thị trên bảng xếp hạng) |
| `--temperature <float>` | Nhiệt độ lấy mẫu (sampling temperature) (càng thấp = càng tất định) |
| `--batch-size <n>` | Số mục trên mỗi lệnh gọi API (mặc định: 25) |
| `--dry-run` | Xác thực cấu hình mà không thực hiện các lệnh gọi API. Nêu tên tệp huấn luyện và bảng thuật ngữ, đồng thời báo cáo bước kiểm tra eval-pack mà lượt chạy thực tế sẽ dừng lại, trên các dòng bắt đầu bằng `EVAL PACK:` (`--json`: một đối tượng `eval_pack` với `status`, `missing`, `setup_command`) |
| `--ids 0,1,2,3` | Chỉ chạy các ID mục cụ thể |

```bash
# Multi-model comparison (runs in parallel)
mt-eval run --corpus eval-amh-fra-globalvoices-test-v1 -m google/gemini-2.5-flash,anthropic/claude-sonnet-4,openai/gpt-4.1

# Dry run to validate config
mt-eval run --corpus eval-amh-fra-globalvoices-test-v1 --dry-run
```

Các lệnh khác: `mt-eval test <log.json>` (chấm điểm một lần chạy đã hoàn thành), `mt-eval compare <log1> <log2>` (so sánh các lần chạy), `mt-eval dashboard <logs/*.json>` (tạo bảng điều khiển HTML), `mt-eval list models --live` (duyệt các mô hình hiện có).

---

## Xây dựng phương pháp của riêng bạn

Harness chấp nhận bất kỳ lớp Python nào triển khai giao thức `TranslationMethod`:

```python
from mt_eval_harness.config import RunConfig

class YourMethod:
    """Build whatever you want inside. The harness only sees this interface."""

    async def translate(
        self,
        entries: list[dict],
        config: RunConfig,
    ) -> list[dict]:
        """
        Args:
            entries: [{"id": 1, "source": "Hello"}, ...]
            config:  RunConfig with source_locale, target_locale, model, etc.

        Returns: one result dict per entry, each containing:
            - id: int          — entry ID from the corpus
            - predicted: str   — the translated text
            - latency_s: float — time taken in seconds
            - usage: dict      — token usage {prompt_tokens, completion_tokens}
            - error: str|None  — error message if failed
            - metadata: dict   — any process-specific metadata
        """
        results = []
        for entry in entries:
            # Your translation logic here — LLM prompting, FST pipeline,
            # dictionary lookup, fine-tuned model, anything.
            translated = await self._my_translate(entry["source"])
            results.append({
                "id": entry["id"],
                "predicted": translated,
                "latency_s": 0.5,
                "usage": {"prompt_tokens": 100, "completion_tokens": 20},
                "error": None,
                "metadata": {"method": "my-custom-pipeline"},
            })
        return results
```

**Định kiểu cấu trúc (Structural typing)** — lớp của bạn không cần kế thừa từ bất cứ thứ gì. Nếu nó có chữ ký phương thức `translate` chính xác, nó sẽ hoạt động. Điều này có nghĩa là các pipeline hiện có có thể được điều chỉnh bằng một wrapper mỏng.

**Hoặc trỏ CLI vào nó.** Đặt lớp (class) vào một thư mục có `method.json` chỉ định tên lớp — `{"name": "My method", "method_id": "my-method", "entry_point": "my_module:YourMethod"}` — và chạy `mt-eval run --corpus … --method ./that-dir`. `translate` là thành viên duy nhất mà lớp cần có: harness sẽ lấy `name` của phương thức và thẻ phương thức của nó (`method_id`, `class`, `paradigm`, …) từ `method.json`, đặt mặc định `class` thành `custom-plugin` và `paradigm` thành `unknown`, đồng thời thông báo điều này trong kết quả đầu ra của lượt chạy. Plugin không thể tải sẽ nhận được một lỗi liệt kê mọi vấn đề gặp phải. Toàn bộ quy ước có trong [Đặc tả Phương thức](/docs/network/specifications/methods#eval-harness-translationmethod-protocol).

**Kết nối nó vào harness:**

```python
import asyncio
from mt_eval_harness.config import RunConfig
from mt_eval_harness.runner import execute_run

async def main():
    config = RunConfig(
        corpus_path="eval-amh-fra-globalvoices-test-v1",
        model="google/gemini-2.5-flash",
        run_name="my-method-v1",
    )
    results = await execute_run(config, method=YourMethod())
    summary = results["_summary"]
    print(f"chrF++: {summary['scores']['corpus_chrf']}")   # corpus-level
    print(f"Report: {summary['report_path']}")            # what `mt-eval publish` takes

asyncio.run(main())
```

Thẻ lượt chạy được tổng hợp cho bảng xếp hạng bắt đầu bằng chính điểm chrF++ cấp corpus đó
cùng khoảng tin cậy 95% của nó. Chạy `mt-eval publish <report> --dry-run` để
xem thẻ mà không cần xuất bản.

---

## Ý tưởng phương pháp

Mỗi ý tưởng này đều có một cookbook đầy đủ với hướng dẫn triển khai:

| Phương pháp tiếp cận | Mô tả | Cookbook |
|----------|-------------|---------|
| **FST-gated pipeline** | Xác thực hình thái học bắt lỗi những gì LLM bỏ sót | [Hướng dẫn](/docs/network/tutorials/fst-gated-pipeline) |
| **Coached LLM** | Đưa các quy tắc ngữ pháp và từ điển vào prompt | [Hướng dẫn](/docs/network/tutorials/coached-llm-prompting) |
| **Dictionary-augmented** | Bắt buộc tính nhất quán của thuật ngữ | [Hướng dẫn](/docs/network/tutorials/dictionary-augmented-llm) |
| **Few-shot prompting** | Bao gồm các ví dụ dịch thuật trong prompt | [Hướng dẫn](/docs/network/tutorials/few-shot-prompting) |
| **Fine-tuned model** | Huấn luyện trên dữ liệu song song (chỉ là không trên tập đánh giá) | [Hướng dẫn](/docs/network/tutorials/fine-tuned-model) |
| **Chained models** | Nhiều bước: nháp → tinh chỉnh → xác thực | [Hướng dẫn](/docs/network/tutorials/chained-models) |
| **Rule-based hybrid** | Kết hợp các quy tắc tất định với sự linh hoạt của LLM | [Hướng dẫn](/docs/network/tutorials/rule-based-hybrid) |

---

## Hiểu điểm số của bạn

Sau `mt-eval test`, phần tóm tắt được trình bày như sau:

```
  Headline:         chrF++ 47.5 [45.9, 49.0]  (corpus, 0-100; 95% bootstrap CI)
  Signature:        nrefs:1|case:mixed|eff:yes|nc:6|nw:2|space:no|version:2.4.3

  Beside it (standard metrics, never blended):
  Corpus BLEU:      21.3  [19.8 – 22.9]
  Corpus spBLEU:    24.0
  Corpus TER:       61.2  (lower is better)

  Diagnostics (reported separately; never in the headline):
  Exact match:      10/62 (16.1%)
```

*Chỉ mang tính minh họa — các con số ở trên là bố cục ví dụ, không phải kết quả thực tế.*

Các lượt chạy được chấm điểm theo cách mà giới nghiên cứu báo cáo đánh giá dịch máy (MT):

- **Chỉ số tiêu đề** là chrF++ ở cấp corpus (0–100) cùng khoảng tin cậy bootstrap 95% và chữ ký sacreBLEU của nó. Đây là chỉ số dùng để xếp hạng một lượt chạy.
- **BLEU, spBLEU, TER và COMET** (khi được tính toán) được hiển thị bên cạnh, mỗi chỉ số độc lập. Không có gì được gộp chung thành một con số duy nhất.
- **Chỉ số chẩn đoán** — khớp chính xác, chấp nhận FST, độ chính xác hình thái học, chuyển mã, ảo giác, thuật ngữ — được báo cáo riêng biệt. Chúng giúp bạn hiểu *lý do* tại sao một lượt chạy lại đạt điểm số như vậy; chúng không bao giờ được dùng để xếp hạng.
- **Cảnh báo điểm số** sẽ in ngay bên dưới tiêu đề khi harness phát hiện một mẫu bất thường khiến con số trở nên sai lệch (ví dụ: một đầu ra lặp lại cho mọi đầu vào). Hãy đọc kỹ chúng trước khi tin tưởng vào con số.

Không có nhãn chất lượng nào cả. Điểm số tự động không phải là phán quyết về chất lượng; chỉ những người nói ngôn ngữ đó mới có thể khẳng định liệu đầu ra có thể sử dụng được hay không. Điểm tổng hợp có trọng số cùng các bậc xếp loại của nó ("functional", "deployable", …) đã bị loại bỏ — xem [lý do](/docs/network/specifications/scoring#why-the-composite-was-retired). Để xác định xem một lượt chạy có vượt trội hơn lượt chạy khác hay không, hãy sử dụng kiểm định ý nghĩa theo cặp (`mt-eval compare --significance`), chứ không phải so sánh hai con số cạnh nhau.

Chi tiết đầy đủ: [Cách chấm điểm các lượt chạy](/docs/network/specifications/scoring#how-runs-are-scored)

---

## Gửi lên Bảng xếp hạng (Leaderboard)

Khi bạn hài lòng với điểm số của mình:

1. **Chấm điểm lần chạy của bạn** — `mt-eval test eval/logs/your_run.json` tạo ra một TestReport đã được chấm điểm
2. **Xem lại điểm số của bạn** — `mt-eval dashboard eval/logs/your_run.json` tạo ra một bảng điều khiển trực quan
3. **Gửi** — làm theo hướng dẫn [Gửi một phương pháp](/docs/network/getting-started/submit-a-method)

Mỗi lượt gửi đều được gắn dấu vân tay với một cấu hình và phiên bản tập dữ liệu cụ thể. Không có sự mơ hồ về những gì đã được kiểm thử.

---

## Đóng góp & Giải thưởng

Điều hữu ích nhất bạn có thể làm lúc này là **lấp đầy bản đồ**: chạy các bài đánh giá chuẩn từ hàng đợi công khai. Mỗi lần chạy sẽ thêm một điểm dữ liệu vào bảng xếp hạng và mạng lưới dịch thuật (translation mesh), bất kể có giải thưởng nào đang diễn ra hay không. Xem [Đóng góp tài nguyên tính toán](/docs/network/getting-started/contributing-compute).

:::note[Giải thưởng, khi có, chỉ là phụ]
Network đôi khi hỗ trợ các quỹ giải thưởng được tài trợ để thu hút sự chú ý đến các cặp ngôn ngữ cụ thể ít được phục vụ. Chúng là một cách để hướng nỗ lực vào nơi cần thiết nhất — không phải là mục đích chính của nền tảng và không phải là một giải đấu. Kiểm tra [Đặc tả giải thưởng](/docs/network/specifications/prizes) để biết trạng thái hiện tại; các giải thưởng có thể đang hoạt động hoặc không tại bất kỳ thời điểm nào.
:::

### Kiến trúc chống gian lận (Anti-Gaming)

Dù cạnh tranh để giành giải thưởng hay đánh giá chuẩn cho bảng xếp hạng, kiến trúc đánh giá đều ngăn chặn việc gian lận:

- **Ngữ liệu kiểm thử bí mật.** Đánh giá cuối cùng chạy trên dữ liệu tiêu chuẩn vàng (gold-standard) mà các nhà phát triển không bao giờ nhìn thấy. Tập dev mà bạn thực hành *khác* với tập kiểm thử bí mật. Việc overfit (quá khớp) với tập dev sẽ không mang lại hiệu quả trên tập kiểm thử.
- **Thực thi trong sandbox.** Tổ chức quản trị chạy phương pháp của bạn trong một môi trường được kiểm soát. Bạn gửi phương pháp, không phải điểm số.
- **Xác thực từ cộng đồng.** Ngay cả khi các số đo của bạn hoàn hảo, những người nói song ngữ phải xác nhận rằng đầu ra thực sự có thể sử dụng được.
- **Kiểm tra tính tái tạo.** Tổ chức quản trị phải tái tạo được điểm số của bạn trong khoảng ±2%. Những lần chạy may mắn chỉ xảy ra một lần sẽ không được tính.

### Xây dựng một phương pháp mạnh mẽ

:::tip[Cơ hội nằm ở đâu]
Vấn đề cốt lõi là **ảo giác hình thái học** (morphological hallucination) — các LLM tạo ra các chuỗi ký tự trông giống tiếng Cree nhưng không phải là các dạng từ có thật. Các phương thức hiện tại đạt tỷ lệ chấp nhận FST từ 70-85%; tiêu chuẩn FST gate của giải thưởng yêu cầu trên 99%. Khoảng cách này hoàn toàn có thể giải quyết được nếu có cách tiếp cận đúng đắn.
:::

1. **Bắt đầu với tập phát triển (dev set).** Chạy các baseline dựa trên một corpus đánh giá đã đăng ký để nắm được chất lượng hiện tại:
   ```bash
   mt-eval run --corpus eval-amh-fra-globalvoices-test-v1 -m google/gemini-2.5-flash
   mt-eval test eval/logs/your_run.json
   ```

2. **Nghiên cứu những gì thất bại.** Hãy xem các từ bị FST từ chối — đây là những dạng từ bị ảo giác. Hiểu các mẫu hình thái học mà mô hình làm sai.

3. **Xây dựng một pipeline lai (hybrid).** Các phương pháp tiếp cận hứa hẹn nhất kết hợp:
   - **Tạo sinh bằng LLM** — cho chất lượng dịch thuật và độ chính xác ngữ nghĩa
   - **Xác thực bằng FST** — GiellaLT FST bắt các dạng từ không hợp lệ; sử dụng nó như một bộ lọc
   - **Thử lại khi bị từ chối** — tạo lại các từ mà FST từ chối, có thể kèm theo các gợi ý hình thái học
   - **Dữ liệu huấn luyện (Coaching data)** — đưa các quy tắc ngôn ngữ học, bảng hệ biến hóa (paradigm tables) và các mục từ điển vào prompt
   - **Tăng cường bằng từ điển** — đối chiếu chéo với từ điển song ngữ để xác thực hoặc ghi đè các lựa chọn của LLM

4. **Lặp lại thử nghiệm trên tập dev.** Tập dev là nơi bạn có thể tự do thử nghiệm. Hãy theo dõi chrF++ cùng khoảng tin cậy của nó, đồng thời quan sát chỉ số chẩn đoán FST-acceptance và bất kỳ cảnh báo điểm số nào.

5. **Gửi lên bảng xếp hạng** — ngay cả khi không có giải thưởng, những kết quả mạnh mẽ sẽ nhận được sự chú ý và thúc đẩy lĩnh vực này tiến lên.

### Điều gì xảy ra nếu bạn giành được giải thưởng

- **Bạn giữ lại:** Quyền ghi công, quyền xuất bản, tên của bạn trên bảng xếp hạng
- **Cộng đồng nhận được:** Quyền sử dụng, sửa đổi, triển khai và kiếm tiền từ phương pháp của bạn cho ngôn ngữ của họ
- **Những gì được chuyển giao:** Tất cả các prompt, dữ liệu huấn luyện, mã pipeline, cấu hình — toàn bộ công thức. Nếu phương pháp của bạn sử dụng một LLM thương mại (Class A1), chỉ có công thức được chuyển giao; cộng đồng có thể trỏ nó tới bất kỳ mô hình tương thích nào.

Chi tiết đầy đủ: [Đặc tả giải thưởng](/docs/network/specifications/prizes) | [Giao diện phương pháp](/docs/network/specifications/methods#method-validity-and-dependency-classes)

---

## Triển khai lên Production

Các phương pháp đã được chứng minh có thể được triển khai thông qua [champollion](https://champollion.dev), CLI dịch thuật production. Cùng một giao diện mà harness đánh giá sẽ trở thành một plugin để dịch nội dung thực tế.

```bash
# Export your benchmark as a champollion plugin
mt-eval export --report eval/logs/report.json --name crk-v1 --type llm-coached --locales crk
```

**[→ Triển khai lên Production](/docs/network/getting-started/deploy-to-production)** — đưa phương pháp của bạn từ Network lên môi trường production.

---

## Khắc phục sự cố

| Vấn đề | Cách khắc phục |
|--------|----------------|
| `OPENROUTER_API_KEY not set` | Export khóa hoặc thêm khóa vào `.env` (xem phần thiết lập ở trên) |
| `Model not found` | Chạy `mt-eval list models --live` để xem danh sách các mô hình khả dụng |
| Tất cả bản dịch đều trống | Kiểm tra xem API key của bạn còn số dư (credit) không. Hãy thử `--dry-run` trước |
| `ModuleNotFoundError` | Đảm bảo bạn đã kích hoạt venv và chạy `python3 -m pip install -e .` |
| Nhật ký lượt chạy không được lưu | Kiểm tra `eval/logs/` — nhật ký được đặt tên theo mốc thời gian |

---

## Xem thêm

- [Đặc tả Giải thưởng](/docs/network/specifications/prizes) — khung giải thưởng, các ngưỡng và quy trình nhận thưởng
- [Gửi Phương thức](/docs/network/getting-started/submit-a-method) — hướng dẫn nộp phương thức từng bước
- [Đặc tả Chấm điểm](/docs/network/specifications/scoring) — định nghĩa đầy đủ về các chỉ số và trọng số
- [Đặc tả Harness](/docs/network/specifications/harness) — tài liệu tham khảo về kiến trúc và cấu hình
- [Quy tắc Bảng xếp hạng](/docs/network/leaderboard/rules) — các yêu cầu nộp bài
- [Chủ quyền Dữ liệu](/docs/network/sovereignty/data-sovereignty) — các nguyên tắc chủ quyền dữ liệu bản địa, CARE và quản trị cộng đồng
- **Bạn muốn sử dụng một phương thức hiện có?** Xem [Hướng dẫn Agent của champollion](https://champollion.dev/docs/guides/agent-guide) — cài đặt và dịch chỉ với một lệnh duy nhất.
