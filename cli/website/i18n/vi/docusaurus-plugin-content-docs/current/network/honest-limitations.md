---
title: "Giới hạn thực tế"
description: "Những điều mà Champollion chưa (hoặc không) cam kết thực hiện. Các giới hạn có thể kiểm chứng trong quá trình đánh giá của chúng tôi, các cấp độ tin cậy, quy trình xác thực từ cộng đồng và cơ sở hạ tầng thử nghiệm độc lập."
---

# Giới hạn thực tế

> Đây là những tuyên bố mà chúng tôi sẽ **không** vượt quá. Nếu có bất kỳ điều gì khác trên
> trang web này ám chỉ nhiều hơn những gì được viết ở đây, hãy coi đó là một lỗi và
> [báo cho chúng tôi](/docs/network/perspectives/reporting-errors-and-owning-corrections).

Cơ sở hạ tầng đánh giá chỉ có được sự tin cậy bằng cách trung thực về các giới hạn của nó. Dưới đây
là các giới hạn của chúng tôi, được nêu rõ ràng để bạn có thể kiểm chứng.

## 1. Xác thực hình thái chuyên sâu hiện chỉ hỗ trợ một cặp ngôn ngữ

Xác thực hình thái dựa trên FST — kiểm tra xem mọi từ đầu ra có phải là một
từ được cấu trúc đúng trong ngôn ngữ đích hay không — trên thực tế chỉ được thiết lập cho **Tiếng Anh →
Tiếng Plains Cree**. Bản thân `GiellaLTFSTMetric` là **chung**: nó chấm điểm cho bất kỳ
ngôn ngữ nào có trình phân tích GiellaLT `.hfstol` đã được xuất bản (tiếng Plains Cree, các ngôn ngữ
Sámi, tiếng Phần Lan, tiếng Na Uy Bokmål, tiếng Inuktitut và các ngôn ngữ khác), vì vậy khả năng
áp dụng là rất rộng. Nhưng **kho ngữ liệu đánh giá hiện chỉ tồn tại cho tiếng Plains Cree**, vì vậy crk là
cặp duy nhất được chấm điểm bằng FST trên thực tế. Mọi cặp ngôn ngữ khác trên
bảng xếp hạng đều được chấm điểm bằng các chỉ số bề mặt (chrF++, BLEU) và các kiểm tra hành vi.
Đó là những tín hiệu hữu ích, nhưng chúng **không** đảm bảo tính hợp lệ về mặt hình thái.
Chúng tôi không tuyên bố xác thực hình thái cho bất kỳ ngôn ngữ nào nếu không có cả FST và
kho ngữ liệu đánh giá.

## 2. Các cấp độ tin cậy là tự báo cáo khi ra mắt

Hầu hết các điểm số được tính toán bởi các cộng tác viên tự chạy công cụ kiểm thử và
công bố kết quả. Việc **xác minh** phía máy chủ — chấm điểm lại một bản nộp
dựa trên kho ngữ liệu chuẩn đã được ghim mã SHA — đã tồn tại và đang được mở rộng, nhưng
trạng thái "đã xác minh" vẫn chưa phổ biến. Hãy đọc huy hiệu tin cậy trên mỗi hàng: **"tự báo cáo" (self-reported)
nghĩa chính xác là như vậy**, và đó là giá trị mặc định.

## 3. Việc xác thực bởi người bản xứ trong cộng đồng vẫn chưa diễn ra

Giải thưởng của chúng tôi yêu cầu **tỷ lệ chấp nhận ≥ 70% từ những người nói song ngữ**. Cổng kiểm duyệt đó
đã được quy định, và công cụ để vận hành nó đang được xây dựng — nhưng **chưa có cuộc đánh giá nào từ người bản xứ trong cộng đồng được thực hiện**, và **chưa có điểm số nào trên trang web này vượt qua cổng kiểm duyệt của người bản xứ**. Các con số tổng hợp và chrF++ là tín hiệu từ máy, không phải là phán quyết của cộng đồng.

## 4. Hộp cát đánh giá đã tồn tại; quy trình bàn giao quyền quản lý thì chưa

Chúng tôi lấy các kho ngữ liệu từ nguồn và ghim mã băm SHA (SHA-pin) cho chúng, và các tập dữ liệu tách riêng (held-out splits) được niêm phong. Khi một cộng đồng nắm giữ một tập kiểm tra bí mật, một phương pháp có thể được chấm điểm dựa trên tập dữ liệu đó mà không cần phải giao nó cho ai khác — và quá trình đánh giá đó hiện có **hai luồng**. Luồng được ưu tiên, dành cho các mô hình neural tiêu chuẩn, là **khai báo** (declarative): người tham gia chỉ gửi dữ liệu — trọng số safetensors + một tokenizer khai báo + một config — và ban tổ chức chạy nó trong công cụ suy luận đáng tin cậy của riêng họ (`trust_remote_code=False`, ngoại tuyến; không hạn chế về mặt kiến trúc vì sự an toàn nằm ở định dạng không chứa mã, chứ không phải tên kiến trúc). Hoàn toàn không có mã nào của người tham gia được chạy, do đó không cần đến sandbox; việc kiểm tra an toàn là một quá trình xác thực định dạng rõ ràng (đây có phải là safetensors chứ không phải pickle? không có `trust_remote_code`?), chứ không phải là nỗ lực chứng minh một đoạn mã bất kỳ là an toàn. Đối với các phương pháp thực sự là mã (pipeline, mô hình lai được huấn luyện bởi LLM), phương án dự phòng là **sandbox** cách ly mạng (kiểm tra tĩnh, container `--network=none`, chỉ cho phép xuất điểm số, tùy chọn truyền tệp hoàn toàn cách ly mạng - true-airgap). Sandbox chứa mã không đáng tin cậy thay vì từ chối chạy nó, do đó đây thực sự là luồng yếu hơn — lớp bảo vệ chính của nó là `--network=none` (một quá trình quét tĩnh heuristic không thể kiểm duyệt một mô hình nhị phân), và các biện pháp tăng cường bảo mật sâu hơn (seccomp, microVMs) sẽ được thực hiện sau. Xem [tổ chức một cuộc thi có chủ quyền](/docs/network/sovereignty/run-a-sovereign-contest) để biết chính xác những gì đang hoạt động và những gì không. Những gì **không** được xây dựng trong cả hai luồng này: khía cạnh lưu giữ khóa của cộng đồng — ký ngưỡng (threshold signing), nghi thức tạo khóa (key ceremonies) và chứng thực node (node attestation). Việc cấp quyền hiện tại là một quy trình được ghi nhận (người lưu giữ đơn lẻ, khóa đơn lẻ, được dán nhãn trung thực), do đó việc đánh giá **giải thưởng** tiêu chuẩn vàng vẫn chưa được mở cho đến khi công tác lưu giữ và sự đồng thuận của cộng đồng theo kịp.

## 5. Phương thức quản lý khóa đã được quyết định; các bên quản lý cộng đồng đang trong quá trình xác nhận

*Cơ chế* quản lý đã được quyết định: một sơ đồ ngưỡng/đa chữ ký (threshold/multisig) trong đó
**Champollion nắm giữ không phần chia sẻ khóa nào**. Bản thân các bên quản lý được lựa chọn bởi
các cộng đồng, và các cuộc thảo luận đó vẫn đang tiếp diễn — vì vậy chúng tôi ghi **"bên quản lý khóa cộng đồng (đang xác nhận)."** Quản lý không phải là sự đồng thuận: quy trình đồng thuận về chủ quyền dữ liệu liên quan là một lộ trình riêng biệt, chậm hơn và quan trọng hơn.

---

Các giới hạn này sẽ thay đổi khi công việc tiến triển. Khi một trong số chúng thay đổi, trang này
sẽ thay đổi theo — và sự thay đổi đó sẽ hiển thị trong lịch sử trang, chứ không bị âm thầm loại bỏ.

