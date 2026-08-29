---
sidebar_position: 7
title: "Sổ tay: Kết hợp Rule-Based + LLM"
---

# Mô hình lai Rule-Based + LLM

> **Ý tưởng:** Sử dụng các quy tắc ngôn ngữ mang tính tất định (deterministic) cho các mẫu mà bạn biết chắc chắn là đúng (phụ tố hình thái, định dạng số, cấu trúc cụm từ đã biết), và để LLM xử lý bản dịch sáng tạo cho tất cả các phần còn lại. Các quy tắc sẽ ghi đè LLM khi được áp dụng; LLM sẽ lấp đầy các khoảng trống.

:::info[Đây là hướng dẫn thực hành, không phải là một triển khai hoàn chỉnh]
Hướng dẫn này phác thảo kiến trúc lai (hybrid). Các quy tắc cụ thể phụ thuộc hoàn toàn vào ngữ pháp của ngôn ngữ đích và các tài nguyên ngôn ngữ hiện có của bạn.
:::

## Khi nào nên sử dụng

- Bạn có **chuyên môn sâu về ngôn ngữ** đối với ngôn ngữ đích (hoặc có thể tiếp cận với một nhà ngôn ngữ học)
- Một số mẫu dịch thuật mang tính **tất định** — bạn biết chắc chắn kết quả đầu ra chính xác
- LLM **liên tục thất bại** trên các mẫu cụ thể (định dạng số, kính ngữ, sự kết dính từ/agglutination)
- Bạn muốn **đảm bảo tính chính xác** cho các mẫu quan trọng trong khi vẫn duy trì sự trôi chảy cho phần còn lại

## Cách thức hoạt động

```
Input ──→ [Rule Engine] ──→ [LLM] ──→ [Merge] ──→ Output
              │                │           │
              │ Known patterns │ Unknown    │ Rules override
              │ handled here   │ parts      │ LLM where both
              ▼                ▼            ▼ produced output
         Deterministic     Creative     Final translation
         fragments         translation
```

1. **Định nghĩa quy tắc** — các mẫu regex, tra cứu FST, bảng tra cứu cho các bản dịch đã biết
2. **Tiền xử lý** — xác định và trích xuất các phân đoạn khớp với quy tắc từ nguồn
3. **LLM dịch** — phần văn bản còn lại, với kết quả đầu ra của quy tắc đóng vai trò là các ràng buộc
4. **Hợp nhất** — lắp ráp lại bản dịch, ưu tiên kết quả đầu ra của quy tắc nếu có
5. **Xác thực** — kiểm tra FST/quy tắc tùy chọn trên kết quả hợp nhất

## Ví dụ: Quy tắc về số và ngày tháng

```python
import re

# Rule: Numbers stay as-is (don't let the LLM hallucinate number translations)
def rule_preserve_numbers(text):
    return re.sub(r'\b\d+\b', lambda m: f'__NUM_{m.group()}__', text)

# Rule: Known greetings have exact translations
GREETING_RULES = {
    "hello": "tânisi",
    "goodbye": "êkosi",
    "thank you": "kinanâskomitin",
}

# Rule: Date format conversion
def rule_date_format(text):
    # "January 15" → "kisê-pîsim 15" (deterministic month mapping)
    ...
```

## Các quyết định thiết kế quan trọng

**Độ ưu tiên của quy tắc:** Khi cả quy tắc và LLM đều tạo ra kết quả cho cùng một phân đoạn, bên nào sẽ thắng? Các quy tắc nên thắng đối với các mẫu **yêu cầu nghiêm ngặt về tính chính xác**. LLM nên thắng đối với các mẫu **yêu cầu cao về độ trôi chảy**.

**Độ chi tiết (Granularity):** Quy tắc cấp từ (tra cứu từ điển) so với quy tắc cấp cụm từ (ánh xạ thành ngữ) so với quy tắc cấu trúc (sắp xếp lại câu). Hãy bắt đầu với cấp từ; thêm cấp cụm từ khi bạn xác định được các mẫu.

**Bảo trì quy tắc:** Mỗi quy tắc đều đi kèm với nghĩa vụ bảo trì. Hãy ưu tiên một tập hợp nhỏ các quy tắc có độ tin cậy cao hơn là một tập hợp lớn các quy tắc mang tính xấp xỉ. Nếu bạn không chắc chắn một quy tắc có chính xác hay không, hãy để LLM xử lý.

## Ưu điểm và nhược điểm

| | |
|---|---|
| ✅ Đảm bảo tính chính xác tại những nơi áp dụng quy tắc | ❌ Đòi hỏi chuyên môn sâu về ngôn ngữ |
| ✅ Minh bạch — các quy tắc có thể đọc và kiểm tra được | ❌ Điểm tiếp giáp giữa Quy tắc/LLM có thể tạo ra kết quả không tự nhiên |
| ✅ Các quy tắc hoạt động nhanh (không tốn chi phí API) | ❌ Gánh nặng bảo trì tăng lên theo số lượng quy tắc |
| ✅ Có tính lũy tiến — thêm quy tắc khi bạn tích lũy thêm kinh nghiệm | ❌ Khó xử lý biến hình từ (inflection) tại ranh giới quy tắc |

## Kết hợp tốt với

- **[FST-Gated Pipeline](./fst-gated-pipeline)** — FST đóng vai trò như một loại công cụ quy tắc cụ thể
- **[Dictionary-Augmented LLM](./dictionary-augmented-llm)** — tra cứu từ điển là một quy tắc đơn giản
- **[Coached LLM Prompting](./coached-llm-prompting)** — huấn luyện (coaching) xử lý các ưu tiên mềm, quy tắc xử lý các yêu cầu cứng

## Xem thêm

- [GiellaLT](https://giellalt.github.io/) — cơ sở hạ tầng FST mã nguồn mở cho hơn 100 ngôn ngữ
- [Apertium](https://www.apertium.org/) — nền tảng dịch máy dựa trên quy tắc (rule-based MT) với từ điển song ngữ
- [Hỗ trợ ngôn ngữ nghèo tài nguyên](/docs/network/community/low-resource-languages)
