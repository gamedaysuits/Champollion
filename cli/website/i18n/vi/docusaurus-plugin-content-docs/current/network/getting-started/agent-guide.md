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
pip install mt-eval-harness
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
|------|-------------|
| `-m <model>` | Slug của mô hình OpenRouter (phân tách bằng dấu phẩy cho các lần chạy song song nhiều mô hình) |
| `-n, --name <name>` | Nhãn dễ đọc cho lần chạy của bạn (hiển thị trên bảng xếp hạng) |
| `--temperature <float>` | Nhiệt độ lấy mẫu (sampling temperature) (càng thấp = càng mang tính tất định) |
| `--batch-size <n>` | Số mục nhập cho mỗi lệnh gọi API (mặc định: 25) |
| `--dry-run` | Xác thực cấu hình mà không thực hiện lệnh gọi API |
| `--ids 0,1,2,3` | Chỉ chạy các ID mục nhập cụ thể |

```bash
# Multi-model comparison (runs in parallel)
mt-eval run --corpus eval-amh-fra-globalvoices-test-v1 -m gemini-2.5-flash,claude-sonnet-4,gpt-4.1

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
    print(f"Composite: {results['scores']['composite']}")

asyncio.run(main())
```

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

Sau một lần chạy đánh giá chuẩn, bạn sẽ thấy đầu ra như sau:

```
══════════════════════════════════════════════════
  Composite Score: 0.67 (Functional)
──────────────────────────────────────────────────
  chrF++:              0.72
  FST acceptance:      0.82
  Exact match:         0.31
  Morphological acc.:  0.88
  Semantic score:      0.64
══════════════════════════════════════════════════
```

*Chỉ mang tính minh họa — các con số ở trên là bố cục ví dụ, không phải kết quả thực tế.*

Điểm tổng hợp (composite) kết hợp một số số đo — độ chính xác cấp độ ký tự (chrF++), tính hợp lệ hình thái học (FST acceptance), khớp chính xác (exact match), độ chính xác hình thái học và bảo toàn ngữ nghĩa — mỗi số đo mang một trọng số xác định. **Các trọng số và công thức tổng hợp chính xác nằm ở một nơi duy nhất: [Đặc tả chấm điểm (Scoring Specification)](/docs/network/specifications/scoring), nguồn chân lý duy nhất.** Hãy đọc chúng từ đặc tả thay vì sao chép các con số từ trang hướng dẫn — chúng có thể thay đổi và đặc tả mới là chuẩn mực.

**Các cấp độ chất lượng** (cũng được định nghĩa trong [Đặc tả chấm điểm](/docs/network/specifications/scoring)):

| Cấp độ | Khoảng điểm tổng hợp | Ý nghĩa |
|------|----------------|---------------|
| Baseline | 0.00–0.30 | Dưới [mức ngẫu nhiên cho ngôn ngữ](/docs/network/specifications/connection-strength) — mọi hệ thống chữ viết đều có mức sàn ngẫu nhiên khác không và nó khác nhau tùy theo ngôn ngữ |
| Emerging | 0.30–0.50 | Cho thấy tiềm năng nhưng chưa thể sử dụng |
| Functional | 0.50–0.70 | Có thể sử dụng với hậu biên tập (post-editing) |
| **Deployable** | **0.70–0.85** | **Sẵn sàng cho production với sự đánh giá của người bản ngữ** |
| Fluent | 0.85–1.00 | Chất lượng gần như người bản ngữ |

Chi tiết đầy đủ: [Đặc tả chấm điểm](/docs/network/specifications/scoring)

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
Vấn đề trọng tâm là **ảo giác hình thái học (morphological hallucination)** — các LLM tạo ra các chuỗi trông giống tiếng Cree nhưng không phải là các dạng từ thực sự. Các phương pháp hiện tại đạt điểm FST acceptance từ 70-85%. Ngưỡng chất lượng yêu cầu 99%+. Khoảng cách này có thể giải quyết được bằng phương pháp tiếp cận phù hợp.
:::

1. **Bắt đầu với tập dev.** Chạy các baseline trên một ngữ liệu đánh giá đã đăng ký để hiểu chất lượng hiện tại:
   ```bash
   mt-eval run --corpus eval-amh-fra-globalvoices-test-v1 -m gemini-2.5-flash
   mt-eval test eval/logs/your_run.json
   ```

2. **Nghiên cứu những gì thất bại.** Hãy xem các từ bị FST từ chối — đây là những dạng từ bị ảo giác. Hiểu các mẫu hình thái học mà mô hình làm sai.

3. **Xây dựng một pipeline lai (hybrid).** Các phương pháp tiếp cận hứa hẹn nhất kết hợp:
   - **Tạo sinh bằng LLM** — cho chất lượng dịch thuật và độ chính xác ngữ nghĩa
   - **Xác thực bằng FST** — GiellaLT FST bắt các dạng từ không hợp lệ; sử dụng nó như một bộ lọc
   - **Thử lại khi bị từ chối** — tạo lại các từ mà FST từ chối, có thể kèm theo các gợi ý hình thái học
   - **Dữ liệu huấn luyện (Coaching data)** — đưa các quy tắc ngôn ngữ học, bảng hệ biến hóa (paradigm tables) và các mục từ điển vào prompt
   - **Tăng cường bằng từ điển** — đối chiếu chéo với từ điển song ngữ để xác thực hoặc ghi đè các lựa chọn của LLM

4. **Lặp lại trên tập dev.** Tập dev là của bạn để tự do thử nghiệm. Theo dõi điểm tổng hợp, FST acceptance và điểm chrF++ của bạn.

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
|---------|-----|
| `OPENROUTER_API_KEY not set` | Xuất (export) key hoặc thêm nó vào `.env` (xem phần thiết lập ở trên) |
| `Model not found` | Chạy `mt-eval list models --live` để duyệt các mô hình hiện có |
| Tất cả các bản dịch đều trống | Kiểm tra xem API key của bạn còn credit không. Thử `--dry-run` trước |
| `ModuleNotFoundError` | Đảm bảo bạn đã kích hoạt venv và chạy `pip install -e .` |
| Run log không được lưu | Kiểm tra `eval/logs/` — các log được đặt tên theo dấu thời gian (timestamp) |

---

## Xem thêm

- [Đặc tả giải thưởng](/docs/network/specifications/prizes) — khuôn khổ quỹ giải thưởng, các ngưỡng và quy trình nhận giải
- [Gửi một phương pháp](/docs/network/getting-started/submit-a-method) — hướng dẫn gửi từng bước
- [Đặc tả chấm điểm](/docs/network/specifications/scoring) — định nghĩa đầy đủ về số đo và trọng số
- [Đặc tả Harness](/docs/network/specifications/harness) — tài liệu tham khảo về kiến trúc và cấu hình
- [Quy tắc Bảng xếp hạng](/docs/network/leaderboard/rules) — yêu cầu gửi
- [Chủ quyền dữ liệu](/docs/network/sovereignty/data-sovereignty) — các nguyên tắc chủ quyền dữ liệu, CARE và quản trị cộng đồng
- **Bạn muốn sử dụng một phương pháp hiện có?** Xem [Hướng dẫn Agent champollion](https://champollion.dev/docs/guides/agent-guide) — cài đặt và dịch thuật chỉ với một lệnh.
