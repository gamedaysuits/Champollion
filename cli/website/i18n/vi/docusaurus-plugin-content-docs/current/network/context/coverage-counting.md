---
sidebar_position: 6
title: "Số liệu bao phủ: Cách chúng tôi thống kê"
description: "Cách Champollion thống kê “các ngôn ngữ có dịch máy” — hai cấp độ (bất kỳ engine nào so với dịch vụ đã triển khai), SSOT mà mọi con số hiển thị được trích xuất, và quy trình cập nhật. Rất mong nhận được góp ý sửa đổi."
---

# Số liệu bao phủ: Cách chúng tôi tính toán

> **Tóm tắt nội dung.** Khi trang web cho biết **552 ngôn ngữ sống có bất kỳ bản dịch máy nào** và **196 ngôn ngữ được phục vụ bởi một dịch vụ đã triển khai**, đó là hai số liệu khác nhau, được tách biệt một cách có chủ ý. Trang này định nghĩa cả hai cấp độ (tier), nêu tên nguồn dữ liệu gốc duy nhất (single source of truth) mà mỗi con số được đọc vào thời điểm build, và mô tả cách các danh sách được làm mới. Mức độ bao phủ là một *tuyên bố về sự tồn tại*, không bao giờ là một tuyên bố về chất lượng.

## Hai cấp độ

**Cấp độ 1 — bất kỳ engine dịch máy (MT) chuyên dụng nào ("được bao phủ").** Một ngôn ngữ sống được tính là được bao phủ nếu nó xuất hiện trên danh sách ngôn ngữ được hỗ trợ đã công bố của *bất kỳ* engine MT chuyên dụng nào được theo dõi — các dịch vụ API/người dùng cuối đã triển khai (Google Translate, Microsoft Translator, DeepL, LibreTranslate, …) **hoặc** các mô hình nghiên cứu mở (NLLB-200, OPUS-MT, M2M-100, MADLAD-400, …). Đây là tập hợp hợp nhất làm sáng một chấm xanh lá trên bản đồ mạng lưới.

**Cấp độ 2 — dịch vụ đã triển khai ("được phục vụ").** Tiêu chí khắt khe hơn: ngôn ngữ nằm trong danh sách của một engine mà bất kỳ ai cũng có thể thực sự *sử dụng ngay hôm nay* dưới dạng dịch vụ API hoặc người dùng cuối. Một checkpoint nghiên cứu mở mà bạn phải tự tải xuống, lưu trữ và phục vụ sẽ không được tính ở đây. Đây là con số trả lời cho câu hỏi "liệu một người bản ngữ có thể dịch một trang web ngay bây giờ mà không cần đến công việc kỹ thuật không?"

Hai cấp độ này tồn tại vì chúng trả lời các câu hỏi khác nhau, và việc gộp chung chúng sẽ phóng đại mức độ bao phủ trên thế giới. Cả hai đều chỉ được đếm trên **các ngôn ngữ sống riêng biệt theo chuẩn ISO 639-3** (`isoType: 'L'`).

## Các con số đến từ đâu (không có gì được nhập thủ công)

Mỗi số liệu được hiển thị là một **bản đọc lúc build (build-time read)** từ các SSOT của máy — không có con số nào trên trang web được gõ vào văn bản và bị bỏ mặc cho đến khi lỗi thời:

1. **Danh sách của từng engine** nằm trong `cli/shared/catalogue/method-coverage.json` —
   mỗi engine một mục, được nhập *chỉ để trích dẫn (cite-only)* từ danh sách ngôn ngữ
   được hỗ trợ do chính nhà cung cấp đó công bố, với `source_url` và ngày `asOf` của nó. Champollion
   không kiểm toán hay tái tạo các danh sách này; chúng là những tuyên bố của chính các nhà cung cấp.
2. **Quá trình build giao cắt (intersect)** các danh sách đó với chỉ mục ngôn ngữ sống và xuất ra
   số lượng theo cấp độ vào số liệu thống kê build của trang web (`stats.coverage.dedicatedLiving` cho
   cấp độ 1, `stats.coverage.serviceLiving` cho cấp độ 2, trên `stats.livingTotal`
   ngôn ngữ sống).
3. **Các trang render số liệu thống kê**, và một cổng kiểm tra tính đồng nhất trước khi push (pre-push parity gate) sẽ đánh rớt quá trình build nếu văn bản
   và số liệu thống kê bị lệch nhau.

## "194 ngôn ngữ" và "187 ngôn ngữ" đều có thể đúng

Danh sách của một nhà cung cấp và số lượng *ngôn ngữ* không phải là cùng một đối tượng, vì vậy mỗi mục trong SSOT đều khai báo rõ con số của nó là gì:

- **`publisher-list-rows`** — độ dài danh sách được công bố của chính nhà cung cấp,
  chính xác như những gì họ công bố. Trang Cloud Translation của Google liệt kê **194** hàng
  cho mô hình NMT của họ; đó là con số mà trang web này gán cho Google bằng tên.
- **`champollion-derived-enumeration`** — việc *chúng tôi* thu gọn danh sách đó thành các ngôn ngữ
  cơ sở ISO 639-3 riêng biệt. Cùng 194 hàng đó của Google là **187** ngôn ngữ,
  bởi vì `zh-CN` và `zh-TW` là một ngôn ngữ ở hai hệ chữ viết, tương tự với `pt-PT`
  và `pt-BR`, v.v. Con số này là của chúng tôi, không bao giờ là của nhà cung cấp.
- **`publisher-stated-headline`** — tổng số mà nhà cung cấp khẳng định nhưng không có danh sách
  nào được công bố đằng sau nó. Không thể suy ra điều gì từ con số này.

Khoảng cách giữa hai con số đầu tiên là do số học, không phải do bất đồng, và điều này xảy ra với mọi nhà cung cấp: Microsoft 135 hàng → 128 ngôn ngữ, LibreTranslate 49 → 47, 200 biến thể FLORES của NLLB-200 → 196. Bản đồ và số lượng theo cấp độ đọc *danh sách được liệt kê*, không bao giờ đọc tiêu đề. Một cổng kiểm tra trước khi push sẽ đánh rớt quá trình build nếu cơ sở được khai báo của một mục và danh sách của nó mâu thuẫn với nhau.

Cũng cần lưu ý rằng một nhà cung cấp có thể công bố nhiều danh sách. Trang của Google có một bảng riêng cho cấp độ Translation LLM của họ (127 hàng tính đến ngày 16-08-2026) và hoàn toàn không nêu tổng số kết hợp — vì vậy câu hỏi "Google hỗ trợ bao nhiêu ngôn ngữ?" không có một câu trả lời duy nhất nào được công bố, và trang web này không tự bịa ra một câu trả lời.

## Mức độ bao phủ được tuyên bố không phải là chất lượng — và không phải lúc nào cũng có thể triển khai

Một ngôn ngữ nằm trong danh sách của nhà cung cấp có nghĩa là nhà cung cấp *tuyên bố có hỗ trợ*, không hơn không kém. Hai lưu ý trung thực mà trang web áp dụng ở mọi nơi các con số này xuất hiện:

- **Mức độ bao phủ ≠ chất lượng.** Liệu các bản dịch có tốt hay không là một câu hỏi riêng biệt,
  được đo lường — đó là toàn bộ mục đích của mạng lưới benchmark. Các tuyên bố về chất lượng
  nằm trên bảng xếp hạng (leaderboard), được phân loại theo (phương pháp, tập dữ liệu, số liệu); các tuyên bố
  về mức độ bao phủ nằm ở đây.
- **Được tuyên bố ≠ có thể triển khai.** Các mô hình nghiên cứu diện rộng có thể tuyên bố số lượng ngôn ngữ
  rất lớn trong khi tài liệu của chính họ báo cáo chất lượng có thể sử dụng được cho một tập hợp con
  nhỏ hơn nhiều. Khi một nhà cung cấp công bố bản tự đánh giá như vậy, trang web sẽ hiển thị
  con số được tuyên bố *và* con số về chất lượng/khả năng triển khai của chính nhà cung cấp, mỗi con số đều được trích dẫn từ
  tài liệu của nhà cung cấp.

## Kỷ luật làm mới

Danh sách của nhà cung cấp thay đổi; các con số cũng phải thay đổi theo một cách máy móc:

- Mỗi mục trong `method-coverage.json` mang ngày `asOf` của riêng nó, và tệp
  mang một `asOf` ở cấp cao nhất — ngày của lần rà soát (sweep) cuối cùng. Các bề mặt hiển thị
  số lượng mức độ bao phủ sẽ hiển thị hoặc liên kết đến ngày này.
- Một **SOTA sweep** (kiểm tra lại danh sách đã công bố của mọi nhà cung cấp, thêm các engine
  mới được theo dõi) là một nhiệm vụ bảo trì định kỳ; quá trình rà soát này cập nhật SSOT, và
  mọi con số trên trang web sẽ tuân theo ở lần build tiếp theo. Không có gì cần phải "ghi nhớ"
  trong nội dung trang.
- Giữa các lần rà soát, các con số có độ mới chính xác bằng với ngày `asOf` của chúng — đó là
  lý do tại sao những ngày đó là một phần của dữ liệu, chứ không phải là một quy ước chú thích.

## Hoan nghênh sửa lỗi và thảo luận

Nếu danh sách của một nhà cung cấp đã thay đổi, một ngôn ngữ bị phân loại sai, hoặc bạn nghĩ rằng ranh giới cấp độ được vạch ra không đúng, hãy cho chúng tôi biết — mở một issue tại
[github.com/gamedaysuits/Champollion/issues](https://github.com/gamedaysuits/Champollion/issues)
hoặc gửi email đến [info@champollion.dev](mailto:info@champollion.dev).

---

## Nguồn

- **Danh sách của từng engine** — `cli/shared/catalogue/method-coverage.json`: danh sách ngôn ngữ được hỗ trợ
  đã công bố của riêng mỗi engine (chỉ để trích dẫn; `source_url` + `asOf` cho mỗi mục).
- **Tập hợp ngôn ngữ sống** — các ngôn ngữ sống riêng biệt theo chuẩn ISO 639-3 (`isoType: 'L'`)
  trong chỉ mục ngôn ngữ được xây dựng từ các thẻ ngôn ngữ được trích dẫn.
- **Số lượng theo cấp độ** — được xuất ra lúc build `stats.coverage.dedicatedLiving` (cấp độ 1),
  `stats.coverage.serviceLiving` (cấp độ 2), `stats.livingTotal`. Bắt nguồn từ Champollion.
- **Ước tính dân số được xây dựng dựa trên các con số này** — xem
  [Khoảng trống bao phủ: Cách chúng tôi ước tính](/docs/network/context/coverage-gap-estimate).
