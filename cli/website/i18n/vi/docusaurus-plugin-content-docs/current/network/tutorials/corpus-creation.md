---
sidebar_position: 11
title: "Sổ tay hướng dẫn: Tạo ngữ liệu (Corpus)"
---

# Hướng dẫn Tạo Tập dữ liệu (Corpus)

> **Ý tưởng cốt lõi:** Trước khi có thể đánh giá một phương pháp dịch thuật, bạn cần có một tập dữ liệu đánh giá (evaluation corpus). Hướng dẫn này sẽ trình bày cách xây dựng một tập dữ liệu từ con số không — bao gồm tìm nguồn dữ liệu, yêu cầu định dạng, tiêu chuẩn chất lượng, cấp phép và đóng góp cho Network.

:::info[Đây không phải là một phương pháp dịch]
Hướng dẫn này là điều kiện tiên quyết cho nhiều phương pháp. Một kho ngữ liệu đánh giá tốt là nền tảng giúp mọi thứ khác trở nên khả thi. Ngay cả 50 cặp dữ liệu được tuyển chọn kỹ lưỡng cũng đủ để mở một nhánh bảng xếp hạng mới.
:::

Item 

## Khi nào nên sử dụng

- Bạn muốn **thêm một cặp ngôn ngữ mới** vào bảng xếp hạng của Network
- Bạn là **giáo viên ngôn ngữ** muốn đánh giá điểm chuẩn bài dịch của học sinh
- Bạn là **nhân sự hoạt động ngôn ngữ cộng đồng** có quyền truy cập vào các tài liệu song ngữ
- Bạn là **nhà nghiên cứu** cần một bộ đánh giá chuẩn hóa cho cặp ngôn ngữ của mình

## Định dạng Tập dữ liệu

Hệ thống kiểm thử (harness) sử dụng định dạng JSON đơn giản:

```json title="my-corpus.json"
{
  "metadata": {
    "name": "Quechua Dev v1",
    "version": "1.0.0",
    "source_language": "eng",
    "target_language": "que",
    "entry_count": 75,
    "license": "CC-BY-SA-4.0",
    "author": "Your Name / Organization",
    "description": "75 English-Quechua pairs from educational materials"
  },
  "entries": [
    {
      "id": 1,
      "source": "Hello, how are you?",
      "reference": "Allillanchu, imaynallan kashanki?"
    },
    {
      "id": 2,
      "source": "The sun is shining today",
      "reference": "Kunan p'unchay inti k'anchashan"
    }
  ]
}
```

## Nguồn khai thác dữ liệu

| Nguồn | Chất lượng | Số lượng | Bản quyền / Cấp phép |
|--------|---------|--------|-----------|
| **Sách giáo khoa / tài liệu giáo dục** | Cao (được chuyên gia kiểm duyệt) | Thấp - trung bình | Kiểm tra với nhà xuất bản |
| **Tài liệu chính phủ** | Trung bình (văn phong trang trọng) | Trung bình - cao | Thường thuộc phạm vi công cộng |
| **Từ điển song ngữ** | Cao (các mục từ đã được xác minh) | Trung bình | Thay đổi tùy nguồn |
| **Người lớn tuổi trong cộng đồng / người bản xứ** | Cao nhất (trực giác bản ngữ) | Thấp (thời gian hạn chế) | Do cộng đồng quản lý |
| **Văn bản tôn giáo** | Trung bình (đặc thù lĩnh vực) | Cao | Thường là mở |
| **Tập dữ liệu có sẵn** (Hansard, FLORES) | Trung bình - cao | Cao | Kiểm tra giấy phép |
| **Tự biên soạn thủ công** | Cao nhất | Thấp | Thuộc sở hữu của bạn |

## Tiêu chuẩn Chất lượng

Một tập dữ liệu đánh giá tốt cần có:

1. **Nội dung đa dạng** — không chỉ có câu chào hỏi hay các cụm từ đơn giản. Hãy bao gồm câu hỏi, câu lệnh, câu phức và các thuật ngữ chuyên ngành.
2. **Bản dịch đã được xác minh** — được kiểm duyệt bởi ít nhất một người nói lưu loát, lý tưởng nhất là hai người.
3. **Chính tả nhất quán** — sử dụng thống nhất một hệ chữ viết và một quy chuẩn chính tả xuyên suốt.
4. **Nguồn độc lập** — không được lấy từ cùng một văn bản mà các phương pháp dịch sẽ dùng để huấn luyện.
5. **Bản quyền rõ ràng** — có giấy phép rõ ràng cho phép sử dụng vào mục đích đánh giá.

:::danger[Nhiễm độc kho ngữ liệu]
Kho ngữ liệu đánh giá phải **độc lập** với bất kỳ dữ liệu huấn luyện nào. Nếu một phương pháp được huấn luyện hoặc gợi ý (prompted) bằng dữ liệu từ kho ngữ liệu đánh giá, phương pháp đó sẽ bị loại. Hãy thiết kế kho ngữ liệu của bạn theo hướng tách biệt (held-out) ngay từ ngày đầu tiên.
:::

Item 

## Hướng dẫn về Quy mô

| Quy mô | Khả năng đáp ứng |
|------|----------------|
| **50 mục** | Đánh giá khả thi tối thiểu — đủ để phát hiện sự khác biệt lớn về chất lượng |
| **100–200 mục** | Xếp hạng đáng tin cậy — đủ để đạt ý nghĩa thống kê giữa các phương pháp |
| **500+ mục** | Cấp độ nghiên cứu — điểm số tổng hợp mạnh mẽ, khoảng tin cậy rõ ràng |
| **1.000+ mục** | Tiêu chuẩn vàng — tương đương với phạm vi bao phủ của bộ devtest FLORES |

Hãy bắt đầu từ quy mô nhỏ. 50 mục là đủ để mở một nhánh bảng xếp hạng mới. Bạn có thể mở rộng quy mô sau này.

## Đóng góp cho Network

1. **Tạo kho ngữ liệu của bạn** theo định dạng JSON ở trên
2. **Cấp phép cho nó** — CC BY-SA 4.0 được khuyến nghị cho đánh giá mở; CC BY-NC-SA 4.0 cho mục đích sử dụng hạn chế
3. **Lưu trữ nó tại một nguồn ổn định** (kho lưu trữ của riêng bạn, kho lưu trữ của tổ chức hoặc sổ đăng ký dữ liệu) — Champollion không bao giờ lưu trữ hoặc theo dõi nội dung kho ngữ liệu
4. **Gửi thẻ siêu dữ liệu tải-từ-nguồn (fetch-from-source)** — mở một PR gửi tới [kho lưu trữ công khai](https://github.com/gamedaysuits/Champollion) để thêm một mục đăng ký trỏ harness đến nguồn upstream của bạn (loader/URL, mã pin SHA, giấy phép, nguồn gốc); xem [Datasets](/docs/network/leaderboard/datasets#creating-a-new-dataset) để biết định dạng thẻ
5. **Bảng xếp hạng sẽ mở** cho cặp ngôn ngữ của bạn sau khi thẻ được hợp nhất (merged)

## Dành cho các Cộng đồng Ngôn ngữ Bản địa

Tạo lập tập dữ liệu là một hành động khẳng định **chủ quyền ngôn ngữ**. Tập dữ liệu của bạn, quy tắc của bạn:

- Bạn quyết định giấy phép và điều kiện truy cập.
- Bạn có thể đóng góp một **bộ phát triển công khai** (để phát triển phương pháp) trong khi vẫn giữ một **bộ kiểm thử bí mật** (để đánh giá chính thức) dưới sự kiểm soát của cộng đồng.
- [Khung chủ quyền dữ liệu](/docs/network/sovereignty/data-sovereignty) bảo vệ dữ liệu của bạn ở mọi cấp độ.

Ngay cả một tập dữ liệu nhỏ cũng là một **tài sản chiến lược** — đó là thước đo quyết định thế nào là "đủ tốt" đối với ngôn ngữ của bạn.

## Kết hợp tốt với

- **[Dịch thuật một phần](./partial-translation)** — việc tạo tập dữ liệu CHÍNH LÀ bước dịch thuật của con người.
- **[Dịch ngược (Back-Translation)](./back-translation)** — dữ liệu tổng hợp bổ sung cho các tập dữ liệu do con người tạo ra.
- Mọi hướng dẫn thực hành khác — tất cả đều cần một tập dữ liệu đánh giá.

## Xem thêm

- [Tập dữ liệu đánh giá](/docs/network/leaderboard/datasets) — các tập dữ liệu hiện có (EDTeKLA, FLORES+)
- [Chủ quyền dữ liệu](/docs/network/sovereignty/data-sovereignty) — quyền sở hữu và kiểm soát
- [Dành cho cộng đồng ngôn ngữ](/docs/network/community/for-language-communities) — sự tham gia của cộng đồng
- [Hỗ trợ ngôn ngữ ít tài nguyên](/docs/network/community/low-resource-languages) — bức tranh toàn cảnh
