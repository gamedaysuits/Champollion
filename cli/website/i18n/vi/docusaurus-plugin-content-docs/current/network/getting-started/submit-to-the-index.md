---
sidebar_position: 0
title: "Đóng góp cho Chỉ mục"
description: "Đề xuất một tập dữ liệu, tài nguyên, phương pháp, dịch vụ dịch thuật do con người thực hiện hoặc kết quả bên ngoài — hoặc gợi ý chỉnh sửa thẻ ngôn ngữ. Mọi nội dung gửi lên đều được con người xem xét về việc tuân thủ sở hữu trí tuệ, giấy phép và chủ quyền — không có nội dung nào được phê duyệt tự động."
related:
  - label: "Submit a Method"
    to: /docs/network/getting-started/submit-a-method
    kind: guide
    note: "Already have a benchmark run? Publish the run card instead."
  - label: "Registering Corpora"
    to: /docs/network/sovereignty/registering-corpora
    kind: guide
    note: "Exposure tiers for corpora you own"
  - label: "Data Sovereignty"
    to: /docs/network/sovereignty/data-sovereignty
    kind: doc
  - label: "Honest Limitations"
    to: /docs/network/honest-limitations
    kind: doc
---

# Gửi thông tin lên Index

> **Tóm tắt nhanh.** Đề xuất một nội dung cho index của Champollion — một benchmark, tài nguyên, phương pháp dịch thuật, dịch vụ dịch thuật bởi con người, hoặc kết quả đã công bố bên ngoài. Bạn điền vào một biểu mẫu cấu trúc ngắn (trên trình duyệt hoặc từ CLI); **người duy trì dự án (maintainer) sẽ xem xét thủ công từng thông tin gửi lên** để đảm bảo tuân thủ về sở hữu trí tuệ (IP), giấy phép và quyền tự quyết/cộng đồng trước khi thêm bất kỳ thứ gì. **Không có gì được tự động phê duyệt.**

Index là bản đồ chung: các tập dữ liệu dùng để đánh giá (benchmark) các phương pháp, các từ điển và công cụ hỗ trợ, chính các phương pháp đó, những người dịch thuật thủ công, và các kết quả mà người khác đã công bố. Bất kỳ ai cũng có thể đề xuất thêm thông tin. Vì đây là cơ sở hạ tầng dành cho các cộng đồng ngôn ngữ, mọi đề xuất đều phải qua bước kiểm duyệt bởi con người trước tiên.

---

## Những gì bạn có thể gửi

| Loại | Mô tả | Những gì chúng tôi thêm |
|---|---|---|
| **Benchmark / tập dữ liệu** | Một kho ngữ liệu đánh giá hoặc benchmark | Một thẻ siêu dữ liệu + một con trỏ *lấy từ nguồn* (fetch-from-source) — tuyệt đối không chứa nội dung ngữ liệu |
| **Tài nguyên** | Một từ điển, kho lưu trữ, ứng dụng, FST (bộ phân tích hình thái học), hoặc công cụ | Một danh mục kèm con trỏ + cấp độ truy cập (mở / hạn chế / cần sự chấp thuận) |
| **Phương pháp dịch** | Một công cụ MT, nhà cung cấp LLM, hoặc quy trình xử lý (pipeline) | Một mục nhập method-registry để có thể chạy và đánh giá benchmark |
| **Dịch vụ dịch thuật bởi con người** | Một văn phòng cộng đồng tự nguyện tham gia, cơ quan dịch thuật, hoặc dịch giả cá nhân | Danh mục theo từng cặp ngôn ngữ (thông tin liên hệ được giữ ngoài luồng — không bao giờ đưa vào issue công khai) |
| **Kết quả công bố từ bên ngoài** | Điểm số được báo cáo bởi một hệ thống hoặc bài báo khoa học khác | Một **trích dẫn** — các kết quả bên ngoài chỉ được trích dẫn, không bao giờ tự lưu trữ lại hoặc tự xếp hạng lại như kết quả đo lường của riêng chúng tôi |
| **Chỉnh sửa thẻ ngôn ngữ** | Thông tin nào đó trên [thẻ ngôn ngữ](/catalogue) bị sai, lỗi thời hoặc còn thiếu — ước tính số người nói, trạng thái, hệ chữ viết, hoặc tài nguyên chưa được liệt kê | Một **bản sửa lỗi có trích dẫn được áp dụng tại nguồn dữ liệu** (các thẻ được tạo tự động, do đó bản chỉnh sửa sẽ được lưu giữ cố định); khi các nguồn có sự bất đồng, thẻ sẽ hiển thị tất cả kèm ghi nhận nguồn gốc rõ ràng |

Mỗi thẻ ngôn ngữ cũng có một liên kết **"Suggest a correction or addition"** (Đề xuất chỉnh sửa hoặc bổ sung)
giúp mở biểu mẫu chỉnh sửa với thông tin ngôn ngữ đã được điền sẵn.

**Yêu cầu gỡ bỏ và hạn chế từ cộng đồng.** Nếu bạn là thành viên hoặc
đại diện có thẩm quyền của cộng đồng và muốn dữ liệu về ngôn ngữ của mình bị hạn chế hoặc gỡ bỏ, hãy sử dụng
biểu mẫu chỉnh sửa (hoặc liên hệ riêng ngoài luồng với người bảo trì nếu bạn không muốn
công khai). Các yêu cầu này sẽ được xem xét thông qua quy trình [đánh giá chủ quyền](/docs/network/sovereignty/data-sovereignty)
với mức độ ưu tiên cao — không yêu cầu trích dẫn.

---

## Quy trình kiểm duyệt hoạt động như thế nào

Đây là phần quan trọng: **các thông tin gửi lên được kiểm duyệt bởi con người, không phải robot.** Khi bạn gửi thông tin, bạn sẽ mở một GitHub issue. Issue đó chính là hàng đợi kiểm duyệt. Người duy trì dự án (maintainer) sẽ đọc và đối chiếu với các quy tắc của dự án trước khi thêm bất kỳ thứ gì:

- **Sở hữu trí tuệ & giấy phép.** Chúng tôi phải được phép liệt kê dữ liệu đó. Các tài liệu phi thương mại, không cho phép phân phối lại, hoặc có giấy phép không rõ ràng vẫn có thể được *đưa vào danh mục*, nhưng sẽ bị chặn khỏi bất kỳ luồng thương mại / giải thưởng / truy xuất công khai nào.
- **Cộng đồng & chủ quyền.** Dữ liệu ngôn ngữ bản địa và ngôn ngữ cộng đồng chỉ được liệt kê khi có sự đồng ý của cộng đồng đó. Nhà cung cấp hoặc người trông coi dữ liệu không bao giờ bị nêu tên công khai trước khi họ xác nhận.
- **Chúng tôi không bao giờ lưu trữ nội dung ngữ liệu.** Các tập dữ liệu được liệt kê dưới dạng siêu dữ liệu cộng với một con trỏ tới nơi truy xuất dữ liệu. **Không dán các câu nguồn/câu tham chiếu vào nội dung gửi.**
- **Không có dữ liệu cá nhân.** Không đưa email, số điện thoại hoặc PII (thông tin nhận dạng cá nhân) nào khác vào issue công khai. Đối với dịch vụ dịch thuật bởi con người, thông tin liên hệ được cung cấp riêng ngoài luồng cho người bảo trì.
- **Phạm vi.** Các ngữ liệu Kinh thánh / phụng vụ và các tài liệu áp đặt thời thuộc địa khác đều nằm ngoài phạm vi và sẽ bị từ chối.

Mỗi biểu mẫu đều kết thúc bằng một cam kết bắt buộc:

> *"Tôi xác nhận rằng thông tin này có thể được liệt kê công khai, KHÔNG chứa nội dung ngữ liệu hoặc dữ liệu cá nhân, đồng thời tôn trọng giấy phép của nguồn và mọi hạn chế về quyền tự quyết/cộng đồng."*

---

## Hai cách để gửi thông tin

### Từ trình duyệt của bạn

Mở trình chọn issue và chọn biểu mẫu phù hợp với nội dung bạn muốn gửi:

➡️ **[Mở biểu mẫu gửi thông tin trên GitHub](https://github.com/gamedaysuits/Champollion/issues/new/choose)**

Mỗi biểu mẫu chỉ yêu cầu những thông tin cần thiết cho mục index tương ứng (tên, ngôn ngữ/cặp ngôn ngữ, giấy phép, URL nguồn, v.v.) và hộp kiểm cam kết.

### Từ CLI

Nếu bạn có [champollion CLI](/docs/network/getting-started/submit-a-method), `champollion submit` sẽ thu thập các trường thông tin và cung cấp cho bạn một phiên bản **được điền sẵn** của chính biểu mẫu GitHub đó:

```bash
# Interactive — pick a type and answer the prompts
champollion submit

# See the submission types
champollion submit --list

# Fully scripted (prints a pre-filled GitHub issue URL)
champollion submit --yes --type dataset --attest \
  --field dataset-name="GlobalVoices eng-amh" \
  --field pairs=eng-amh \
  --field license=CC-BY-4.0 \
  --field source-url=https://globalvoices.org
```

CLI sẽ in ra một URL — hãy mở nó, xem lại cam kết trên trình duyệt và gửi. Thêm `--out submission.json` để lưu thêm một bản sao cục bộ không chứa nội dung của những gì bạn đang đề xuất. Bản thân CLI không bao giờ tự động tải lên bất kỳ thứ gì và không bao giờ ghi trực tiếp vào index.

---

## Điều gì xảy ra sau khi bạn gửi thông tin

1. Thông tin bạn gửi sẽ đến dưới dạng một GitHub issue — đây chính là hàng đợi kiểm duyệt.
2. Người duy trì dự án sẽ xem xét thông tin đó dựa trên các quy tắc về sở hữu trí tuệ (IP) / giấy phép / quyền tự quyết ở trên.
3. **Nếu được chấp nhận:** người duy trì dự án sẽ thêm mục đó vào nguồn thông tin xác thực tương ứng (sổ đăng ký tập dữ liệu, thẻ thông tin, sổ đăng ký phương pháp hoặc dịch vụ dịch thuật bởi con người, hoặc danh mục kết quả bên ngoài) thông qua một thay đổi thông thường, và gắn nhãn issue là **accepted** (đã chấp nhận).
4. **Nếu không thể liệt kê nguyên trạng:** người duy trì dự án sẽ gắn nhãn là **declined** (bị từ chối) (hoặc yêu cầu cung cấp thêm thông tin) kèm theo lý do.

Không có việc tự động hợp nhất (merge) hay tự động xuất bản. Con người sẽ luôn là bên đưa ra quyết định cuối cùng.

---

## Xem thêm

- [Gửi một phương pháp](/docs/network/getting-started/submit-a-method) — bạn đã chạy benchmark rồi? Hãy xuất bản trực tiếp thẻ lượt chạy (run card).
- [Đăng ký ngữ liệu](/docs/network/sovereignty/registering-corpora) — các cấp độ hiển thị (cục bộ / riêng tư / công khai / niêm phong) đối với ngữ liệu mà bạn sở hữu.
- [Quyền tự quyết dữ liệu](/docs/network/sovereignty/data-sovereignty) — cách thức hoạt động của việc kiểm soát dữ liệu ngôn ngữ bởi cộng đồng tại đây.
- [Dành cho các cộng đồng ngôn ngữ](/docs/network/community/for-language-communities) — quan hệ đối tác, sự đồng ý và quản lý khóa.
