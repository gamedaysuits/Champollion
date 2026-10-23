---
sidebar_position: 1
slug: /intro
title: "Dịch ứng dụng và trang web"
description: "Tài liệu tham khảo để dịch các tệp của chính ứng dụng hoặc trang web bằng `champollion sync`: lệnh này làm gì, khi nào nên dùng và hướng dẫn về từng trang liên quan."
related:
  - label: "Quick Start"
    to: /docs/getting-started/quick-start
    kind: guide
    note: "Install, configure, and run your first sync"
  - label: "How Sync Works"
    to: /docs/concepts/how-sync-works
    kind: doc
    note: "The pipeline behind every translation"
  - label: "Translation Methods"
    to: /docs/guides/translation-methods
    kind: guide
    note: "LLM, machine-translation APIs, your own model — when to use which"
  - label: "Translate an app or website"
    to: /docs/translate-an-app-or-website
    kind: guide
    note: "The same lane, in plain words"
---

# Dịch ứng dụng và trang web

`champollion sync` đồng bộ các bản dịch của một ứng dụng hoặc trang web với
ngôn ngữ nguồn. Công cụ đọc các tệp bản địa hoá (hoặc các trang Markdown) của bạn,
tìm những nội dung còn thiếu hoặc đã lỗi thời, chỉ dịch phần đó, kiểm tra từng kết quả, và
ghi lại đúng theo định dạng gốc của tệp.

```bash
npx champollion sync
```

Phần này là tài liệu tham khảo cho quy trình đó. Nếu bạn muốn đọc phiên bản
diễn giải đơn giản trước, hãy xem [Dịch ứng dụng hoặc trang web](/docs/translate-an-app-or-website).

## `sync` làm những gì

1. **Tìm các tệp của bạn.** Công cụ tự động phát hiện thư mục bản địa hoá và định dạng (JSON, TOML,
   YAML, gettext PO, Flutter ARB), hoặc một thư mục chứa các trang Markdown/MDX (Hugo,
   Docusaurus, hoặc bất kỳ thư mục nào bạn chỉ định bằng `--content-dir`).
2. **Xác định nội dung đã thay đổi.** Mọi giá trị nguồn đều được ghi lại bằng mã băm
   SHA-256 trong `.champollion.lock`. Các khóa còn thiếu, trống hoặc có văn bản nguồn
   bị thay đổi sẽ được đưa vào hàng đợi; tất cả các phần khác đều được giữ nguyên.
3. **Dịch theo phương pháp bạn chọn cho từng cặp ngôn ngữ.** Một tệp cấu hình có thể
   chuyển một cặp ngôn ngữ tới LLM, một cặp khác tới API dịch máy, và cặp thứ ba
   tới mô hình do chính bạn huấn luyện và tự phục vụ. Các phương pháp LLM mặc định dịch ở
   temperature 0 (giá trị mặc định duy nhất trong `shared/model-defaults.json`);
   một mô hình được lưu trữ (hosted model) vẫn có thể dao động đôi chút giữa các lần chạy, đó là một lý do
   Bộ nhớ dịch lưu lại những gì đã nhận được.
4. **Tái sử dụng những gì đã trả phí.** Bộ nhớ dịch lưu tạm từng bản dịch
   theo văn bản nguồn, locale và phương pháp: văn bản xuất hiện lại (chuỗi
   được đổi lại như cũ, cùng một câu trong tệp khác, hoặc chạy lại) đều miễn phí.
5. **Kiểm tra từng kết quả trước khi ghi.** Cổng kiểm soát chất lượng từ chối
   kết quả trống, bản sao y nguyên văn bản nguồn, vòng lặp lặp từ, chữ viết sai hệ thống chữ,
   placeholder bị hỏng và các lỗi tương tự, kèm theo một lần thử lại có phản hồi. Cổng này
   phát hiện kết quả bị hỏng, chứ không bắt lỗi sai nghĩa.
6. **Xác minh sau khi ghi.** Một lượt kiểm tra sau đồng bộ sẽ đọc lại các tệp đã ghi và
   kiểm tra tính tương đương của khóa, các giá trị trống, hệ chữ viết và placeholder;
   `champollion verify` và `champollion audit` chạy cùng loại kiểm tra này dưới dạng các
   cổng CI.

Không có gì được ghi một cách âm thầm. Một khóa mà cổng kiểm soát vẫn từ chối sau lần thử lại sẽ
được giữ nguyên trạng thái chưa dịch và được báo cáo, đồng thời quá trình đồng bộ thoát với mã `2`. Lần từ chối này
sẽ được ghi nhớ, do đó lần đồng bộ thông thường tiếp theo sẽ không trả phí cho cùng một mô hình để nhận cùng
một câu trả lời: bạn có thể yêu cầu lại bằng `--redo`, thêm một phương pháp `fallback` cho cặp ngôn ngữ, hoặc
tự nhập giá trị thủ công.

## Khi nào nên sử dụng

- Bạn có một ứng dụng hoặc trang web có văn bản nằm trong các tệp locale hoặc Markdown,
  và bạn muốn các ngôn ngữ khác luôn được cập nhật khi ngôn ngữ nguồn thay đổi.
- Bạn muốn dùng các phương pháp khác nhau cho từng cặp ngôn ngữ trong cùng một dự án, với chi phí
  được giới hạn (`--max-cost`) và hiển thị rõ ràng trước khi phát sinh thanh toán (`--dry`).
- Bạn đã xây dựng một bộ dịch trên hệ thống rail và muốn ứng dụng sử dụng bộ dịch đó:
  `champollion connect` đưa một mô hình đang được phục vụ vào dự án ứng dụng, và `sync`
  sau đó sẽ dịch bằng mô hình đó. Một mô hình được huấn luyện trên dữ liệu chỉ lưu cục bộ
  chỉ được kết nối khi những người nắm giữ dữ liệu đã đồng ý.

`sync` không phải là cách bạn xây dựng một bộ dịch cho một ngôn ngữ mà chưa có dịch vụ nào xử lý
tốt. Đối với mục đích đó, hãy bắt đầu tại [Bắt đầu một dự án](/docs/start).

## Các trang trong phần này

**Bắt đầu**

- [Khởi động nhanh](/docs/getting-started/quick-start) — lần đồng bộ đầu tiên chỉ trong vài phút.
- [Cài đặt](/docs/getting-started/installation) — yêu cầu hệ thống, khóa API,
  và giấy phép.
- [Cấu hình](/docs/getting-started/configuration) — từng trường trong
  `champollion.config.json`, cài đặt cho từng cặp, bố cục locale và phương án dự phòng.

**Framework và quy trình của bạn**

- [Tích hợp framework](/docs/integrations/frameworks) — Hugo, next-intl,
  react-i18next, Flutter, và Django với gettext.
- [CI/CD](/docs/guides/ci-cd) — `lint`, `sync`, `verify` và `audit` dưới dạng cổng kiểm tra.
- [Dịch nội dung](/docs/guides/content-translation) — các trang Markdown và MDX,
  front matter, cùng những phần được bảo toàn.

**Lựa chọn cách thức dịch**

- [Phương pháp dịch](/docs/guides/translation-methods) — từng phương pháp,
  khóa tương ứng và khi nào nên sử dụng.
- [Dữ liệu hướng dẫn](/docs/concepts/coaching-data) — các ghi chú ngữ pháp và danh sách từ vựng
  được cung cấp cho LLM cùng với mỗi yêu cầu.
- [Bộ chuyển đổi chữ viết](/docs/concepts/script-converters) và
  [Ngôn ngữ nhân tạo, hệ chữ viết & chính tả](/docs/guides/conlangs-scripts-orthography)
  — các hệ thống chữ viết, phông chữ và ngôn ngữ nhân tạo.

**Cách thức hoạt động bên trong**

- [Cách thức đồng bộ hoạt động](/docs/concepts/how-sync-works) — quy trình xử lý, từng bước một.
- [Bộ nhớ dịch](/docs/concepts/translation-memory) — bộ nhớ đệm, và các khóa
  định danh của nó.
- [Cổng kiểm soát chất lượng](/docs/concepts/quality-gate) — mọi bước kiểm tra, và điều gì xảy ra
  với một khóa hay khối bị từ chối.
- [Bảo mật](/docs/concepts/security) — các khóa và đường dẫn cố ý tạo lập, các khối
  mã được bảo vệ, và việc báo lỗi dứt khoát.

**Con người và xử lý sự cố**

- [Làm việc với dịch giả chuyên nghiệp](/docs/guides/professional-translators)
  — xuất và nhập tệp XLIFF để rà soát.
- [Xử lý sự cố](/docs/guides/troubleshooting) — các lỗi thường gặp và cách khắc phục.

Mọi lệnh và cờ hiệu đều có trong [Tài liệu tham khảo CLI](/docs/reference/cli), và
định dạng plugin phương pháp nằm trong [Đặc tả Plugin](/docs/reference/plugin-spec).

## Giấy phép

CLI `champollion` là phần mềm có sẵn mã nguồn theo
[PolyForm Noncommercial License 1.0.0](https://github.com/gamedaysuits/Champollion/blob/main/cli/LICENSE);
trang [ai có thể sử dụng](/docs/getting-started/who-may-use-this) quy định những đối tượng được áp dụng.
Bạn gặp khó khăn hay cần trợ giúp về dự án của mình? [Hãy trao đổi với chúng tôi](/docs/getting-help).
