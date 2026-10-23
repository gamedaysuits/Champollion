---
title: "Dành cho AI agent"
slug: /agents
sidebar_label: "Bắt đầu tại đây"
description: "Tài liệu kỹ thuật dành cho các tác tử AI vận hành khung quy trình của Champollion: giao ước vận hành, mô hình dự án, các lệnh gọi công cụ chính xác, cùng các quy tắc về dữ liệu và đo lường."
---

# Dành cho AI agent

Bạn ở đây vì có người đã nhờ bạn giúp xây dựng hệ thống dịch máy cho
ngôn ngữ của họ với Champollion. Phần này là tài liệu hướng dẫn dành cho bạn. Tài liệu diễn đạt chính xác
ở những điểm mà các trang dành cho cộng đồng diễn đạt giản dị: tên trường, chế độ, từ chối và câu lệnh
được trích dẫn trực tiếp từ mã nguồn.

**Hãy đọc [thỏa thuận vận hành](/docs/agents/contract) trước tiên.** Thỏa thuận này ngắn gọn,
và là phần bạn tuyệt đối không được làm sai: những gì bạn được phép đọc, những gì bạn phải
hỏi, những gì bạn không bao giờ được tự quyết định thay cho cộng đồng, và những quy tắc nào do công cụ
thực thi so với những quy tắc nào chỉ có bạn mới có thể tuân thủ.

## Kết nối

Hệ thống ray định hướng (rails) là một máy chủ MCP. Hãy thêm máy chủ này vào cấu hình MCP client của bạn:

```json
{
  "mcpServers": {
    "champollion": { "command": "npx", "args": ["-y", "champollion-mcp-server"] }
  }
}
```

Hồ sơ mặc định là rails: sáu công cụ — `start_project`,
`project_status`, `run_next_step`, `add_data`, `try_translation` và
`explain`. Mỗi bước trên ray cũng là một lệnh shell thông thường
(`champollion`, `nmt-forge`, `mt-eval`), do đó một agent không có MCP vẫn có thể đi qua
cùng một lộ trình ray từ terminal.

## Điểm truy cập cho máy đọc

- [`/llms.txt`](https://champollion.dev/llms.txt) — chỉ mục của tài liệu này.
- [`/llms-full.txt`](https://champollion.dev/llms-full.txt) — toàn bộ tài liệu được liên kết
  trong một tệp duy nhất.
- [`/for-agents.md`](https://champollion.dev/for-agents.md) — trang mở đầu
  dưới dạng markdown thô.

## Trong phần này

1. [Thỏa thuận vận hành](/docs/agents/contract) — đọc phần này trước.
2. [Máy chủ MCP](/docs/network/getting-started/mcp-server) — cả hai hồ sơ
   và từng công cụ.
3. [Từng câu lệnh, từng bước một](/docs/agents/shell) — toàn bộ
   quy trình từng bước với các câu lệnh.

Những người mà bạn đang hỗ trợ sẽ đọc [các trang dành cho cộng đồng](/docs/): từ ngữ giản dị,
cùng những thông tin cốt lõi. Khi bạn giải thích điều gì đó cho họ, những trang đó chính là phong cách diễn đạt
bạn nên đối chiếu và làm theo.
