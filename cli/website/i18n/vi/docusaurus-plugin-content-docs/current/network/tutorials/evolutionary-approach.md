---
sidebar_position: 9
title: "Cookbook: Tiến hóa / Dựa trên Tìm kiếm"
---

# Dịch thuật dựa trên Tiến hóa / Tìm kiếm

> **Ý tưởng:** Tạo ra nhiều bản dịch ứng viên, chấm điểm chúng dựa trên một hàm thích nghi (fitness function) (chrF++, tỷ lệ chấp nhận FST, tính nhất quán dịch khứ hồi), đột biến những bản dịch tốt nhất và lặp lại. Chọn lọc tự nhiên cho bản dịch — bản dịch thích nghi nhất sẽ tồn tại.

:::info[Đây là cookbook, không phải là một triển khai hoàn chỉnh]
Đây là phương pháp mang tính thử nghiệm nhất trong chuỗi tài liệu cookbook. Nó chưa được chứng minh hiệu quả cho dịch máy (MT) ở quy mô lớn, nhưng kiến trúc của nó rất vững chắc và hệ thống harness sẽ sẵn sàng chấm điểm cho bất kỳ kết quả nào được tạo ra.
:::

## Khi nào nên sử dụng

- Bạn có một **hàm chấm điểm tốt** nhưng không có mô hình đơn lẻ nào tạo ra kết quả nhất quán
- Bạn muốn **khám phá không gian giải pháp** rộng hơn so với việc chỉ tạo ra một kết quả tham lam (greedy generation) duy nhất
- Bạn có **ngân sách tính toán** cho nhiều lượt tạo song song (hàng chục ứng viên cho mỗi đầu vào)
- Bạn quan tâm đến **nghiên cứu mới lạ** — phương pháp này vẫn chưa được khai phá nhiều đối với dịch máy cho ngôn ngữ nghèo tài nguyên (low-resource MT)

## Cách thức hoạt động

```
[Generation 0]    Generate N candidates (different models, temperatures, prompts)
       │
       ▼
[Score]           Evaluate each candidate: chrF++, FST acceptance, fluency
       │
       ▼
[Select]          Keep top K performers
       │
       ▼
[Mutate]          Prompt an LLM: "improve this translation, fix these issues"
       │
       ▼
[Generation 1]    Score again. Repeat for G generations.
       │
       ▼
[Output]          Best-scoring candidate from final generation
```

## Cấu trúc khung (Skeleton)

```python
async def evolutionary_translate(source, reference=None, generations=3, pop_size=8):
    # Generation 0: diverse candidates
    population = []
    for model in ["gemini-2.5-pro", "gpt-4o", "claude-sonnet-4-6"]:
        for temp in [0.3, 0.7, 1.0]:
            candidate = await translate(source, model=model, temperature=temp)
            population.append(candidate)
    
    for gen in range(generations):
        # Score each candidate
        scored = [(c, score(c, reference)) for c in population]
        scored.sort(key=lambda x: x[1], reverse=True)
        
        # Select top K
        survivors = [c for c, s in scored[:pop_size // 2]]
        
        # Mutate: ask LLM to improve each survivor
        mutants = []
        for survivor in survivors:
            mutant = await improve(source, survivor, feedback=scored[0])
            mutants.append(mutant)
        
        population = survivors + mutants
    
    return max(population, key=lambda c: score(c, reference))
```

## Thiết kế hàm thích nghi (Fitness Function)

Hàm thích nghi quyết định tất cả. Các lựa chọn bao gồm:

| Metric | Đo lường điều gì | Tự động hóa? |
|--------|-----------------|------------|
| chrF++ đối chiếu với bản dịch tham chiếu | Độ tương đồng ở cấp độ ký tự so với bản dịch chuẩn | ✅ Có |
| Tỷ lệ chấp nhận FST | Tính hợp lệ về mặt hình thái học | ✅ Có (nếu có sẵn FST) |
| Tính nhất quán dịch khứ hồi | Việc dịch ngược lại có khôi phục được văn bản gốc không? | ✅ Có |
| LLM làm giám khảo (LLM-as-judge) | Một LLM khác đánh giá độ trôi chảy/độ chính xác | ✅ Có (nhưng có nhiễu) |
| Sự xuất hiện của thuật ngữ trong từ điển | Các thuật ngữ đã biết có xuất hiện chính xác không? | ✅ Có |

:::tip[Kết hợp nhiều tín hiệu]
Sự kết hợp có trọng số của các chỉ số sẽ tạo ra một hàm thích nghi (fitness function) mạnh mẽ hơn bất kỳ chỉ số đơn lẻ nào. Điều này tương tự như [điểm số tổng hợp (composite score)](/docs/network/leaderboard/rules) của chính hệ thống harness.
:::

## Ưu điểm và nhược điểm

| | |
|---|---|
| ✅ Khám phá các giải pháp đa dạng | ❌ Tốn kém tài nguyên tính toán (N × G cuộc gọi API) |
| ✅ Có thể phát hiện ra các phương pháp mà không một mô hình đơn lẻ nào tìm thấy | ❌ Yêu cầu một hàm thích nghi tốt |
| ✅ Có thể chạy song song | ❌ Chậm — cần nhiều lượt tạo cho mỗi bản dịch |
| ✅ Không phụ thuộc vào mô hình (Model-agnostic) | ❌ Hiệu suất giảm dần sau một vài thế hệ |

## Kết hợp tốt với

- **[Mô hình chuỗi (Chained Models)](./chained-models)** — bước đột biến là một dạng liên kết chuỗi
- **[Đường ống lọc bằng FST (FST-Gated Pipeline)](./fst-gated-pipeline)** — sử dụng sự chấp nhận của FST làm tín hiệu thích nghi
- **[LLM tăng cường từ điển (Dictionary-Augmented LLM)](./dictionary-augmented-llm)** — sử dụng sự xuất hiện của từ điển làm tín hiệu thích nghi

## Xem thêm

- [Thông số kỹ thuật của Run Card](/docs/network/specifications/run-card) — chi phí và độ trễ được ghi lại cho mỗi lượt chạy
- [Hệ thống đánh giá (Eval Harness)](/docs/network/specifications/harness) — hệ thống harness chấm điểm kết quả đầu ra cuối cùng của bạn, không chấm điểm quá trình thực hiện
- [Hỗ trợ ngôn ngữ nghèo tài nguyên](/docs/network/community/low-resource-languages)
