---
title: "Bảng xếp hạng và công bố"
slug: /reference/leaderboard
description: "Bảng xếp hạng công khai là gì, hai loại bộ chuẩn (công khai và niêm phong), những gì nó bao gồm và không bao gồm, cùng chính xác những gì một lượt chạy được công bố mang theo."
---

# Bảng xếp hạng và xuất bản

[Bảng xếp hạng](/leaderboard) là một bản ghi công khai về các lượt chạy dịch thuật đã được chấm điểm.
Bất kỳ ai cũng có thể đóng góp: bạn chạy khung đánh giá (`mt-eval`) trên chính
máy của mình, dựa trên một tập dữ liệu đã đăng ký, rồi xuất bản kết quả dưới dạng một **thẻ
lượt chạy**. Bảng xếp hạng lưu giữ thẻ này; nó không tự chạy phương pháp của bạn. Nó
chỉ lưu văn bản theo từng câu đối với các tập dữ liệu được cấp phép mở, có thể phân phối lại —
tuyệt đối không lưu đối với các tập dữ liệu phi thương mại, bị hạn chế, được niêm phong, bị cách ly hoặc chỉ dùng cục bộ,
và không bao giờ lưu khi bạn xuất bản với `--scores-only`.

Đây là một sổ cái ghi nhận các phép đo, không phải phán quyết đối với bất kỳ người dịch nào. Một vị trí trên
bảng chỉ cho biết phương pháp đó đạt điểm thế nào trên một tập dữ liệu theo một thước đo cụ thể. Nó không khẳng định
bản dịch là tốt, và không cấp quyền cho bất kỳ ai sử dụng một phương pháp lên ngôn ngữ của một cộng đồng.

## Ba thành phần được tách bạch

| | Bản chất | Nơi thực thi |
|---|---|---|
| **Khung đánh giá** ([`mt-eval`](/docs/network/specifications/harness)) | Bộ chấm điểm. Nhận vào một phương pháp và một tập kiểm thử, tạo ra điểm số và một thẻ lượt chạy | Máy của bạn |
| **Bảng xếp hạng** | Cổng gửi bài và sổ cái ghi thẻ lượt chạy, được lập chỉ mục theo tập dữ liệu và chiều cặp ngôn ngữ | champollion.dev |
| **Bản đồ mạng lưới** | Tổng hợp từ các lượt chạy đã xuất bản: những cặp nào đã được đo lường, và những cặp nào chưa | Một góc nhìn của sổ cái, không phải một thành phần phần mềm |

Không có gì được đưa vào bản đồ ngoại trừ thông qua bảng xếp hạng, và không có gì được đưa vào bảng xếp hạng
ngoại trừ dưới dạng một lượt chạy đã được chấm điểm và gắn mã nhận diện. Một phép đo không rõ nguồn gốc xuất xứ không thể
trở thành một phần của hệ thống.

## Hai loại chuẩn đánh giá

**Chuẩn đánh giá công khai** sử dụng các tập dữ liệu mở. Mỗi tập dữ liệu được đăng ký dưới dạng
một thẻ siêu dữ liệu kèm con trỏ tải-từ-nguồn: khung đánh giá sẽ tải các
bản tham chiếu từ nguồn thượng nguồn (upstream) khi chạy, đối chiếu chúng với mã SHA-256 đã ghim,
và chấm điểm dựa trên những gì tải về. Dữ liệu công khai có thể đã nằm sẵn trong dữ liệu huấn luyện
của mô hình, vì vậy các tập dữ liệu sẽ mang một mức độ nhiễm bẩn dữ liệu. Một tập được xếp hạng `HIGH`
hoặc `MEDIUM` (FLORES+ là `HIGH`), hoặc hoàn toàn chưa được xếp hạng, là **chỉ mang tính tương đối**:
dùng để so sánh các phương pháp chạy trên đó, tuyệt đối không được báo cáo là chất lượng tuyệt đối.
Chỉ tập dữ liệu được xếp hạng `LOW` mới được xếp hạng theo chất lượng tuyệt đối. Một tập dữ liệu bị cách ly
sẽ không bao giờ được xếp hạng: cơ sở dữ liệu sẽ từ chối điểm số gửi lên đối với tập dữ liệu đó.
Các tập dữ liệu đã đăng ký và làn cấp phép của chúng được liệt kê trong
[Tập dữ liệu đánh giá](/docs/network/leaderboard/datasets).

**Chuẩn đánh giá niêm phong** là các tập kiểm thử được giữ kín mà bên lưu trữ tự bảo quản trên
máy của họ. Người tham gia không bao giờ nhìn thấy chúng. Một bài dự thi là một mô hình hoặc một phương pháp mà
chính nút chấm điểm của bên lưu trữ sẽ chạy trên tập dữ liệu niêm phong; chỉ có điểm số được xuất ra, và
mọi lượt chạy niêm phong đều cần sự ủy quyền của bên lưu trữ. Khóa của các tập dữ liệu hiện do ban tổ chức
nắm giữ. Người bảo quản khóa cộng đồng — hiện chưa có ai được chỉ định;
Champollion không giữ bất kỳ phần khóa nào. Giải thưởng chỉ tồn tại ở các cuộc thi niêm phong, theo
các điều khoản mà bên lưu trữ công bố trước khi có người tham gia. Cách tổ chức:
[Chạy một cuộc thi có chủ quyền](/docs/network/sovereignty/run-a-sovereign-contest).

## Phạm vi

- **Văn bản viết.** Bảng xếp hạng đo lường bản dịch của văn bản viết: tài liệu,
  tài liệu giáo dục và chính thức, các chuỗi giao diện người dùng. Nó không đo lường tiếng nói,
  phiên dịch thời gian thực hay trò chuyện tự do.
- **Các ngôn ngữ dựa trên văn bản.** Dịch máy ngôn ngữ ký hiệu là một bài toán
  khác; các mục ngôn ngữ ký hiệu trong chỉ mục hiển thị "chưa được hỗ trợ"
  ([Những gì được tính là một ngôn ngữ](/docs/network/context/what-counts-as-a-language)).
- **Mỗi lần một tập dữ liệu.** Điểm số chỉ có thể so sánh với điểm số trên
  cùng một phiên bản tập dữ liệu. Thứ hạng không bao giờ so sánh chéo giữa các tập dữ liệu hoặc các ngôn ngữ khác nhau.
- **Phương pháp, không phải từng câu.** Điểm số phản ánh một phương pháp trên một chuẩn đánh giá. Không có
  độ tin cậy theo từng câu nào được công bố cho bất kỳ bản dịch nào
  ([Giới hạn kỹ thuật](/docs/network/honest-limitations#system-vs-output)).

## Những thông tin mà một lượt chạy được xuất bản mang theo

Mỗi thẻ mới đều được chấm điểm theo **scoring standard/1**
([Quy cách chấm điểm](/docs/network/specifications/scoring)):

- **Chỉ số chính:** chrF++ ở cấp độ ngữ liệu (0–100) cùng với khoảng tin cậy bootstrap 95%
  và chữ ký sacreBLEU của nó, để bất kỳ ai cũng có thể tính toán lại.
- **Bên cạnh:** BLEU, spBLEU và TER, cùng COMET nếu đã được tính toán. Chúng được
  hiển thị riêng, không bao giờ được gộp vào chỉ số chính.
- **Tách biệt:** các chỉ số chẩn đoán như tỷ lệ chấp nhận FST và khớp chính xác, ở những nơi có công cụ cho chúng. Chúng không bao giờ được đưa vào chỉ số chính hay dùng để xếp hạng một lượt chạy.
- **Các trường đã ngưng sử dụng:** `composite`, `quality_tier` và `cost_adjusted` là
  `null` trên mọi thẻ mới. Thẻ cũ vẫn giữ điểm tổng hợp đã lưu của nó, được hiển thị dưới dạng
  "legacy composite (retired)". Không có điểm số tự động nào mang nhãn chất lượng.
- **Nguồn gốc xuất xứ:** id tập dữ liệu và SHA-256 của nó, slug chính xác của mô hình,
  điều kiện, những gì mô hình được hướng dẫn (SHA-256 của prompt, và nội dung văn bản của nó
  trừ khi bạn che bớt), chi phí, phiên bản khung đánh giá và mã nhận diện trên
  cấu hình. Các lượt chạy giống hệt nhau sẽ được khử trùng lặp khi xuất bản, và một lần
  tái lập độc lập được tính là bằng chứng xác thực.
- **Cấp độ tin cậy:** mỗi hàng mới gửi đến đều mang trạng thái *tự đánh giá*. *Champollion Verified*
  nghĩa là điểm số đã được tính toán lại từ các kết quả đầu ra bạn đã gửi dựa trên
  các bản tham chiếu đã ghim; trình chấm điểm lại đó là một lệnh do người duy trì chạy thủ công, vì vậy
  hiện tại không có hàng nào được nâng cấp ngay khi mới gửi đến. *Community Validated* chỉ được trao
  thông qua việc xem xét của chính cộng đồng ([các cấp độ xác minh](/docs/network/leaderboard/rules#verification-tiers)).

Lược đồ đầy đủ có tại [Quy cách thẻ lượt chạy](/docs/network/specifications/run-card).

## Xuất bản

```bash
# See exactly what would be uploaded (no sign-in, no network)
mt-eval publish eval/logs/harness/<run-id>_report.json --dry-run

# Publish to the live board (a browser sign-in the first time)
mt-eval publish eval/logs/harness/<run-id>_report.json --prod
```

- Cần có `--prod` (hoặc `MT_EVAL_ALLOW_PROD=1`) để ghi vào bảng xếp hạng
  đang hoạt động; nếu không có, khung đánh giá sẽ từ chối.
- `--anonymous` xuất bản mà không cần đăng nhập; bảng xếp hạng sẽ hiển thị "anonymous".
- `--scores-only` xuất bản các điểm số tổng hợp cùng mã băm và kích thước của tập dữ liệu,
  không bao giờ bao gồm văn bản nguồn hay văn bản tham chiếu — dành cho ngữ liệu của riêng bạn hoặc ngữ liệu riêng tư.
- `--redact-coaching` thay thế văn bản prompt bằng một đánh dấu và giữ lại mã
  băm của nó. Prompt được huấn luyện kèm của một ngữ liệu chỉ dùng cục bộ sẽ được che bớt theo mặc định.

Hướng dẫn từng bước có tại [Gửi một phương pháp](/docs/network/getting-started/submit-a-method).

## Các quy tắc áp dụng ở mọi nơi

- **Tuyệt đối không huấn luyện trên dữ liệu đánh giá.** Một phương pháp tiếp xúc với một tập chuẩn đánh giá — dưới
  dạng dữ liệu huấn luyện, ví dụ few-shot, mục từ điển hoặc tài liệu dùng làm prompt — sẽ bị
  loại ([Quy tắc gửi bài](/docs/network/leaderboard/rules)).
- **Tốt hơn được quyết định bằng kiểm định, không phải bằng hai con số.** Việc một lượt chạy có vượt trội hơn
  lượt chạy khác hay không được xác định bằng kiểm định ý nghĩa thống kê theo cặp trên chrF++; các lượt chạy liền kề mà phép kiểm định không thể
  phân tách sẽ dùng chung một thứ hạng ([Ý nghĩa thống kê](/docs/network/specifications/significance)).
- **Ngữ liệu không được lưu trữ tại đây.** Việc đăng ký chỉ là siêu dữ liệu; các ngữ liệu được
  tải về từ chính nguồn của chúng. Một lượt chạy được xuất bản của một tập dữ liệu có giấy phép mở có thể
  mang theo văn bản theo từng câu của nó (như trên).
- **Các làn cấp phép mang tính cấu trúc.** Các ngữ liệu phi thương mại được loại khỏi
  mọi giải thưởng, API và lộ trình thương mại. Một ngữ liệu theo giấy phép sửa đổi, tùy chỉnh hoặc
  không nêu rõ (`LicenseRef-*`) sẽ từ chối việc đánh giá qua API mô hình từ xa cho đến khi
  sự đồng thuận của chủ sở hữu quyền được ghi nhận trên thẻ của nó; các giấy phép phi thương mại tiêu chuẩn
  chỉ được gửi đến các mô hình từ xa qua các kênh không dùng để huấn luyện; các phân đoạn niêm phong
  không bao giờ được gửi ra bên ngoài. Các tập Plains Cree của EdTeKLA được xếp vào danh mục nhãn cách ly,
  và cơ sở dữ liệu sẽ từ chối bất kỳ điểm số nào được gửi lên đối với chúng.

## Tình trạng hoạt động hiện tại

- Bảng xếp hạng đang hoạt động, công khai và mở tiếp nhận bài gửi. Nội dung trên bảng là
  dữ liệu trực tiếp, vì vậy trang này không mô tả chi tiết chúng — [xem bảng xếp hạng](/leaderboard).
- Hiện tại mọi hàng đều ở trạng thái tự đánh giá (xem các cấp độ tin cậy ở trên).
- Chưa có giải thưởng nào mở, và chưa có điểm số nào vượt qua mức chuẩn để nhận giải
  ([Quy cách giải thưởng](/docs/network/specifications/prizes)).
- Chưa có cuộc đánh giá nào từ người bản ngữ trong cộng đồng được thực hiện
  ([Xác thực bởi người nói](/docs/network/specifications/speaker-validation)).
- Chưa có phương pháp nào được bàn giao cho cộng đồng theo các điều khoản của cuộc thi.

[Giới hạn kỹ thuật](/docs/network/honest-limitations) là danh sách đầy đủ những điều
không được cam đoan; nếu có điểm khác biệt giữa trang này và trang đó, thông tin tại trang đó sẽ được ưu tiên.

## Xem thêm

- [Quy tắc gửi bài](/docs/network/leaderboard/rules) — những gì được chấp nhận,
  truất quyền tham gia, xác minh và độ uy tín.
- [Tập dữ liệu đánh giá](/docs/network/leaderboard/datasets) — sổ đăng ký và
  các làn cấp phép của nó.
- [Gửi một phương pháp](/docs/network/getting-started/submit-a-method) và
  [Câu hỏi thường gặp](/docs/network/getting-started/faq).
- [Chấm điểm](/docs/network/specifications/scoring),
  [Ý nghĩa thống kê](/docs/network/specifications/significance) và
  [Thẻ lượt chạy](/docs/network/specifications/run-card).
- [Đóng góp năng lực tính toán](/docs/network/getting-started/contributing-compute) —
  chạy các mục từ hàng đợi công khai bằng khóa của riêng bạn.
