---
sidebar_position: 5
title: "Khoảng trống độ phủ: Cách chúng tôi ước tính"
description: "Cách Champollion lý giải con số “hơn một tỷ người” — phương pháp, hai nhận định chủ quan đằng sau nó, và lý do tại sao trang web cố tình đưa ra một mức sàn thận trọng. Rất hoan nghênh các ý kiến đính chính và thảo luận."
---

# Khoảng trống độ phủ: Cách chúng tôi ước tính

> **Tóm tắt nội dung.** Trang chủ của Champollion nói rằng *hơn một tỷ* người đang sống hiện nay không thể sử dụng dịch máy sang ngôn ngữ mẹ đẻ của họ. Trang này trình bày các phép toán đằng sau cụm từ đó, chỉ ra hai quyết định đánh giá làm thay đổi con số này, và giải thích lý do tại sao chúng tôi công bố một mức sàn thận trọng thay vì tổng số thô lớn hơn. Champollion là một chỉ mục, không phải là một cơ quan thẩm quyền — mọi con số ở đây đều có thể được trích xuất từ bản build công khai, và chúng tôi hoan nghênh mọi sự điều chỉnh.

## Câu hỏi thực sự mà chúng tôi đang đặt ra

Không phải là "có bao nhiêu ngôn ngữ thiếu dịch máy (MT)," mà là **có bao nhiêu người không thể sử dụng dịch máy sang ngôn ngữ mẹ đẻ của họ.** Ngôn ngữ mẹ đẻ (L1) của một người là ngôn ngữ họ dùng để suy nghĩ và mong muốn dùng nhất để đọc tin tức. Việc song ngữ không loại bỏ bất kỳ ai khỏi số đếm này: một người song ngữ Quechua–Tây Ban Nha có ngôn ngữ mẹ đẻ là tiếng Quechua vẫn không thể đọc một trang web *bằng tiếng Quechua*. Vì vậy, nhóm dân số mục tiêu là: tất cả những người có L1 là một trong những ngôn ngữ đang tồn tại mà không có công cụ dịch máy chuyên dụng nào hỗ trợ.

## Con số này được tính toán như thế nào

Có hai thành phần, cả hai đều nằm trong kho lưu trữ (repository):

1. **Những ngôn ngữ đang tồn tại nào có MT.** Bản build lấy phần giao giữa tập hợp danh sách ngôn ngữ của chín công cụ được theo dõi (Google, Microsoft, DeepL, LibreTranslate, NLLB-200, OPUS-MT, M2M-100, MADLAD-400, Tilde — `shared/catalogue/method-coverage.json`, mỗi danh sách đều được trích dẫn và ghi ngày tháng) với các ngôn ngữ *đang tồn tại riêng biệt* theo chuẩn ISO 639-3 (`isoType: 'L'`) trong `data/tc-index.json`. Kết quả: **552 ngôn ngữ đang tồn tại được hỗ trợ, 6.525 ngôn ngữ không được hỗ trợ**, trong tổng số **7.077** ngôn ngữ đang tồn tại (`stats.coverage.dedicatedLiving` / `uncoveredLiving`).
2. **Có bao nhiêu người nói những ngôn ngữ không được hỗ trợ.** Đối với mỗi ngôn ngữ đang tồn tại không được hỗ trợ, chúng tôi lấy `speakerCount` của nó (được rút ra từ các ước tính có trích dẫn trên thẻ ngôn ngữ) và tính tổng. Bản build xuất ra kết quả này dưới dạng `stats.coverageGap`. Tổng số thô của tất cả 6.525 ngôn ngữ không được hỗ trợ là khoảng **2,9 tỷ** (`uncoveredSpeakerSumRaw` ≈ 2.974.871.273).

Con số 2,9 tỷ đó là một con số **gần mức trần**, và chúng tôi nói rõ điều đó.

### Tại sao tổng số thô không hoàn toàn chính xác

`speakerCount` pha trộn giữa số người nói ngôn ngữ mẹ đẻ (L1) và tổng số người nói (L1+L2) tùy thuộc vào những gì mỗi nguồn báo cáo, và một người đa ngôn ngữ có thể được tính cho nhiều hơn một ngôn ngữ. Dấu hiệu nhận biết: tính tổng `speakerCount` trên *tất cả* 7.082 ngôn ngữ đang tồn tại cho ra khoảng **10,8 tỷ** — nhiều hơn con số ~8,1 tỷ người đang sống (Triển vọng Dân số Thế giới của Liên Hợp Quốc). Một cuộc điều tra dân số L1 thuần túy không thể vượt quá dân số thế giới; nhưng con số này lại vượt, điều đó chứng tỏ trường dữ liệu này không phải là L1 thuần túy.

## Hai quyết định đánh giá (mỗi quyết định đều làm thay đổi con số)

**(a) Chỉ tính L1 so với tổng số.** Việc giới hạn ở những người nói ngôn ngữ mẹ đẻ sẽ làm giảm mức ước tính — theo định nghĩa, những người nói L2 là những người *đã có* một ngôn ngữ khác. Nhưng số liệu L1 cho từng ngôn ngữ không có sẵn một cách đồng đều trong các nguồn mà chúng tôi trích dẫn, vì vậy chúng tôi không thể áp dụng quy tắc chỉ tính L1 ở mọi nơi mà không phải tự bịa ra các con số. Việc sử dụng số đếm pha trộn sẽ đẩy mức ước tính *lên cao*.

**(b) 777 ngôn ngữ không được hỗ trợ không có số liệu báo cáo.** Trong số 6.525 ngôn ngữ đang tồn tại không được hỗ trợ, **5.748 ngôn ngữ có số liệu người nói và 777 ngôn ngữ thì không** (`uncoveredWithCount` / `uncoveredNoCount`). Việc gạt 777 ngôn ngữ này sang một bên — đó là những gì tổng số thô đang làm — sẽ dẫn đến *đếm thiếu*, bởi vì đó là những ngôn ngữ thực sự với những người nói thực sự (chưa được đo lường), hầu hết trong số đó là các ngôn ngữ nhỏ và có nguy cơ tuyệt chủng.

Vì vậy, hai sai số này hướng về hai phía đối lập: sự pha trộn L1/L2 làm tăng vọt con số, và phần đuôi 777 ngôn ngữ làm giảm con số.

## Tại sao chúng tôi báo cáo mức sàn là "hơn một tỷ"

Phạm vi hợp lý chạy từ mức sàn gần **1 tỷ** lên đến con số thô **~2,9 tỷ**. Ngay cả sau khi đã chiết khấu mạnh tay cho việc đếm trùng L2 *và* gạt bỏ toàn bộ phần đuôi 777 ngôn ngữ chưa được đo lường, dân số sử dụng ngôn ngữ mẹ đẻ của các ngôn ngữ không được hỗ trợ vẫn ở mức thoải mái trên một tỷ. Thay vì đưa ra con số lớn hơn, lộn xộn hơn làm tiêu đề, trang web báo cáo ở mức thận trọng. "Hơn một tỷ" là tuyên bố mà chúng tôi tự tin nhất có thể vượt qua được sự giám sát.

## Điều gì có thể làm thay đổi con số này

Một ước tính sắc bén hơn cần **số liệu người nói L1 cho từng ngôn ngữ, mỗi số liệu đều có trích dẫn**, để chúng tôi có thể tính tổng L1 trực tiếp thay vì pha trộn L1/L2, và có thể đưa ra một ước tính hợp lý cho 777 ngôn ngữ hiện chưa được đếm. Khi các công cụ bổ sung thêm ngôn ngữ, con số 552 sẽ tăng lên và khoảng trống sẽ thu hẹp lại; khi các thẻ có được số đếm từ các nguồn tốt hơn, tổng số sẽ sát thực tế hơn. Đây là một **ước tính liên tục**, được tính toán lại trên mỗi bản build — không phải là một sự thật cố định.

## Hoan nghênh sự điều chỉnh và tranh luận

Nếu bạn có dữ liệu tốt hơn, cho rằng một quyết định ở đây là sai, hoặc có thể tìm nguồn cho 777 ngôn ngữ còn thiếu, hãy cho chúng tôi biết. Đó chính là mục đích. Hãy mở một issue tại [github.com/gamedaysuits/Champollion/issues](https://github.com/gamedaysuits/Champollion/issues) hoặc gửi email tới [info@champollion.dev](mailto:info@champollion.dev).

---

## Nguồn dữ liệu

- **Độ phủ (Coverage)** — `cli/shared/catalogue/method-coverage.json` (chín công cụ, mỗi danh sách đều được trích dẫn và ghi ngày tháng) ∩ các ngôn ngữ đang tồn tại riêng biệt theo chuẩn ISO 639-3 trong `cli/website/data/tc-index.json`; được hiển thị dưới dạng `stats.coverage.dedicatedLiving` / `uncoveredLiving`. Bắt nguồn từ Champollion.
- **Tổng số người nói (Speaker sums)** — `speakerCount` trên các hàng `tc-index.json` (từ `speakerEstimates` được trích dẫn của mỗi thẻ ngôn ngữ), được bản build tính tổng thành `stats.coverageGap` (`uncoveredSpeakerSumRaw`, `uncoveredWithCount`, `uncoveredNoCount`). Bắt nguồn từ Champollion; pha trộn L1/L2 theo nguồn.
- **Dân số thế giới (World population)** — khoảng 8,1 tỷ (Liên Hợp Quốc, *Triển vọng Dân số Thế giới*), chỉ được sử dụng làm giới hạn kiểm tra tính hợp lý cho tổng số người nói.

## Điều này dẫn đến đâu trên trang web này

Những con số này thể hiện quy mô của vấn đề. Câu trả lời của trang web cho vấn đề này bắt đầu
tại [Champollion là gì](/docs/what-is-champollion); phương pháp luận đằng sau
sự phân chia được hỗ trợ/không được hỗ trợ nằm trong
[cách tính toán độ phủ](/docs/network/context/coverage-counting), và các
ngôn ngữ nằm ở phía bên kia ranh giới — được xếp hạng theo việc ai có khả năng
xây dựng một tập đánh giá tiếp theo nhất — được công bố trong
[danh sách mong muốn về ngữ liệu](https://champollion.dev/corpus-wishlist.json).
