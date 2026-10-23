---
title: "Bắt đầu một dự án"
slug: /start
description: "Bắt đầu xây dựng công cụ dịch thuật cho ngôn ngữ của bạn — cùng trợ lý AI trên máy tính, hoặc tự mình nhập bốn câu lệnh."
---

# Bắt đầu một dự án

Có hai cách để bắt đầu. Dù chọn cách nào, các công cụ cũng sẽ chạy trên chính máy tính của bạn và hướng dẫn bạn từng bước một.

## Với trợ lý AI

Đây là cách dễ nhất. Trợ lý của bạn sẽ gõ lệnh; bạn chỉ cần trả lời những câu hỏi dành cho mình.

**Những gì bạn cần:** một trợ lý AI chạy dưới dạng ứng dụng trên máy tính của bạn — không chỉ là ứng dụng điện thoại — và có thể sử dụng các công cụ trên máy.

### 1. Thêm đường ray vào trợ lý của bạn

Sao chép phần cài đặt ngắn bên dưới, dán vào trợ lý của bạn và nói:
*"Hãy thiết lập phần này giúp tôi."* Nhiều trợ lý có thể làm được. Nếu trợ lý của bạn không thể, hãy nhờ ai đó thạo máy tính làm giúp một lần — các bước thực hiện ở ngay bên dưới.

```json
{
  "mcpServers": {
    "champollion": { "command": "npx", "args": ["-y", "champollion-mcp-server"] }
  }
}
```

<details>
<summary>Tự thiết lập thủ công</summary>

Các trợ lý kết nối với công cụ thông qua một tiêu chuẩn chung có tên là MCP; phần cài đặt ở trên sẽ chỉ cho trợ lý của bạn cách khởi động đường ray. Máy tính của bạn cũng cần cài Node.js 20.11 trở lên, một chương trình miễn phí.

- **Ứng dụng Claude trên máy tính:** Settings → Developer → Edit Config. Thêm phần cài đặt vào tệp đó, lưu lại và khởi động lại ứng dụng.
- **Claude Code:** chạy lệnh này một lần trong cửa sổ dòng lệnh (terminal):
  `claude mcp add champollion -- npx -y champollion-mcp-server`
- **Cursor:** thêm phần cài đặt vào tệp `mcp.json` trong thư mục `.cursor` của dự án, hoặc trong thư mục `.cursor` ở thư mục chính (home) của bạn.

</details>

### 2. Diễn đạt bằng lời của bạn

Đại loại như:

> *Chúng tôi muốn xây dựng một công cụ dịch từ tiếng Anh sang ngôn ngữ của chúng tôi — hãy dùng champollion.*

### 3. Trả lời những gì trợ lý hỏi

Đầu tiên, trợ lý sẽ nhắc lại hướng dịch cho bạn — *"bạn nhập tiếng Anh vào, và ngôn ngữ của bạn xuất ra. Đó có đúng là chiều dịch bạn muốn không?"* — bởi vì rất dễ nhầm ngược chiều này. Sau đó, trợ lý sẽ tạo một thư mục dự án và hỏi xin các tệp của bạn.

Kể từ đó, trợ lý sẽ hỏi bất cứ khi nào cần bạn đưa ra quyết định: lời văn của bạn thuộc về ai, liệu một mô hình dịch có được phép học từ chúng hay không, có nên cài đặt thứ gì đó không. Hãy tự mình trả lời. Nếu bạn chưa biết, cứ nói ra — đường ray có thể chờ. Và *không phải bây giờ* luôn là một câu trả lời hợp lệ: đường ray sẽ không hỏi lại trong phiên làm việc đó nữa.

**Một điều cần biết trước.** Hầu hết các trợ lý đều gửi nội dung họ đọc được về công ty vận hành chúng. Đối với các tệp lưu trên máy tính này, các công cụ chỉ cho trợ lý biết bạn có *bao nhiêu* câu, chứ không bao giờ gửi các câu đó — nhưng một trợ lý có quyền truy cập máy tính của bạn có thể mở bất kỳ tệp nào bạn mở được. Đối với những câu từ bạn muốn giữ riêng tư, hãy yêu cầu trợ lý không mở chúng, hoặc sử dụng một trợ lý chạy ngay trên máy tính của bạn. Trang [Lời văn của bạn, quy tắc của bạn](/docs/your-words-your-rules) sẽ giải thích rõ hơn.

## Tự làm một mình

Nếu bạn quen gõ các dòng lệnh, chỉ cần bốn dòng. Cài đặt công cụ dự án (yêu cầu Node.js 20.11 trở lên), bắt đầu một dự án và hỏi xem bước tiếp theo là gì:

```bash
npm install -g champollion
champollion new family --from English --to qaa --target-name "Our language"
cd family
champollion next
```

`qaa` có nghĩa là "ngôn ngữ chưa có mã định danh" — nó vẫn hoạt động tốt; các công cụ chỉ không tự động điền các thông tin như bảng chữ cái giúp bạn. Tên trong ngoặc kép là tên bạn sẽ gọi ngôn ngữ đó. Nếu ngôn ngữ của bạn đã có mã định danh, hoặc một cái tên mà các công cụ nhận biết được, hãy dùng mã hoặc tên đó. Nếu một tên gọi có thể chỉ nhiều hơn một ngôn ngữ, hãy hỏi những người nói tiếng đó xem họ nói ngôn ngữ nào trước khi bạn chọn mã; cho đến khi họ xác nhận, `qaa` vẫn hoạt động được, nhưng nó không có thẻ ngôn ngữ, vì vậy sẽ không có quy tắc số nhiều hay hệ chữ viết nào được lấy từ thẻ đó.

Kể từ đó, `champollion next` sẽ luôn chỉ rõ bước tiếp theo và lệnh chính xác cần dùng. Khi đến lúc huấn luyện mô hình dịch, đường ray sẽ hỏi ý kiến bạn trước khi cài đặt các công cụ huấn luyện.

## Làm việc không cần kết nối mạng

Hãy duy trì kết nối mạng trong suốt quá trình cài đặt và lần huấn luyện đầu tiên: các công cụ huấn luyện cùng mô hình dịch mạnh hơn (khoảng 1,2 GB) sẽ được tải về lúc này. Sau đó, toàn bộ công việc đều diễn ra trên máy tính của bạn. Để chặn các lượt tra cứu tự động của công cụ — chúng có thể tải thẻ thông tin công khai của một ngôn ngữ và chỉ gửi đi mã ngôn ngữ — hãy thiết lập biến này trong terminal và trong phần cài đặt của trợ lý:

```bash
export CHAMPOLLION_OFFLINE=1
```

Trợ lý AI chạy trên máy chủ của một công ty vẫn cần kết nối internet. Để làm việc ngoại tuyến hoàn toàn, hãy sử dụng một trợ lý chạy ngay trên máy tính của bạn.

## Điều bạn có thể kỳ vọng

Mô hình dịch đầu tiên của bạn có thể sẽ chỉ như một cuốn sổ tay câu đàm thoại: xử lý tốt những câu tương tự như các câu nó đã học, và chưa làm được gì nhiều ngoài số đó. Mọi dự án đều bắt đầu từ đây. Trang [Những gì mô hình chưa thể làm](/docs/what-it-cant-do-yet) nêu rõ những điều bạn có thể kỳ vọng, và [Cải thiện mô hình](/docs/make-it-better) sẽ chỉ ra cách để nó tiến bộ hơn.

**Tiếp theo:** [Mang theo những gì bạn có →](/docs/bring-your-data)

## Tìm hiểu sâu hơn

- [Điều khiển đường ray qua MCP](/docs/agents/mcp) — sáu công cụ, vòng lặp và hướng dẫn thiết lập chi tiết cho từng trợ lý.
- [Điều khiển đường ray từ shell](/docs/agents/shell) — mọi lệnh mà đường ray thực thi.
- [Thỏa ước vận hành](/docs/agents/contract) — các quy tắc mà trợ lý của bạn tuân thủ.
- [Ai có thể sử dụng](/docs/getting-started/who-may-use-this) — giấy phép.
