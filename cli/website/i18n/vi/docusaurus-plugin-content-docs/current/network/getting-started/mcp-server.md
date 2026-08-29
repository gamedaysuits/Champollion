---
title: "MCP Server — cánh cửa dành cho agent"
sidebar_label: "MCP Server"
description: "Kết nối AI agent với Champollion thông qua Model Context Protocol: 23 công cụ để dịch thuật, duyệt qua hàng đợi benchmark, chạy đánh giá và huấn luyện mô hình — cùng với thông tin chính xác về những công cụ nào yêu cầu nhiều hơn một lệnh npx install."
---

# MCP Server — cánh cửa dành cho agent

`champollion-mcp-server` cung cấp Champollion cho các AI agent thông qua [Model Context Protocol](https://modelcontextprotocol.io). Nếu bạn là một agent, hoặc bạn đang thiết lập một agent, thì đây chính là cánh cửa: **23 công cụ, 3 tài nguyên và 3 prompt** qua stdio.

Mọi thứ ở đây cũng có thể truy cập được dưới dạng HTTP thuần túy — xem [Các endpoint có thể đọc bằng máy](#machine-readable-endpoints) — nhưng MCP server là bề mặt duy nhất cho phép một agent *hành động* (dịch thuật, chạy benchmark, huấn luyện mô hình) thay vì chỉ đọc.

## Cài đặt

```bash
npx -y champollion-mcp-server
```

Sau đó đăng ký nó với client của bạn. Đối với Claude Code:

```bash
claude mcp add champollion -- npx -y champollion-mcp-server
```

Đối với các client được cấu hình bằng file (Claude Desktop, Cursor, Antigravity), hãy thêm:

```json
{
  "mcpServers": {
    "champollion": {
      "command": "npx",
      "args": ["-y", "champollion-mcp-server"]
    }
  }
}
```

## Đọc phần này trước khi bạn phụ thuộc vào nó

**Chín trong số 23 công cụ hoạt động từ một bản cài đặt `npx` cơ bản. Mười bốn công cụ còn lại cần phần mềm mà npm package không có và không thể đi kèm.** Chúng không thất bại trong im lặng — mỗi công cụ trả về một lỗi có thể xử lý được, chỉ rõ những gì bị thiếu — nhưng bạn nên biết cấu trúc này trước khi lên kế hoạch sử dụng.

| Công cụ | Hoạt động sau `npx`? | Cần thêm gì khác |
|---|---|---|
| `list_queue`, `get_queue_item`, `estimate_cost`, `search_languages`, `get_project_info`, `get_results`, `get_run_card`, `get_metric_reliability`, `get_training_guardrails` | **Có** — chỉ đọc, được phục vụ từ các endpoint công khai | không cần gì |
| `translate` | Không | `champollion` CLI (`npm i -g champollion`) và một API key |
| `run_benchmark`, `get_run_status` | Không | eval harness — `pipx install mt-eval-harness` |
| mười một công cụ `forge_*` | Không | một bản clone của monorepo với `CHAMPOLLION_FORGE_DIR` được trỏ tới thư mục `forge/` của nó; việc chấm điểm cũng cần `mt-eval` |

Nếu bạn muốn toàn bộ bề mặt này, hãy clone repo thay vì phụ thuộc vào `npx`.

## Chức năng của các công cụ

**Duyệt và tính chi phí công việc.** `list_queue` và `get_queue_item` duyệt qua hàng đợi benchmark mở — danh sách xếp hạng các phép đo sẽ cải thiện bản đồ nhiều nhất. `estimate_cost` định giá một tập hợp các lần chạy trước khi bạn tiêu tốn bất kỳ chi phí nào.

**Tra cứu thông tin.** `search_languages` tìm kiếm các thẻ ngôn ngữ theo tên, mã, ngữ hệ hoặc khu vực. `get_results` và `get_run_card` đọc các lần chạy đã được chấm điểm từ bảng xếp hạng công khai. `get_metric_reliability` trả lời câu hỏi mà hầu hết các agent đều làm sai — *tôi nên tin tưởng số đo (metric) nào cho ngôn ngữ đích này* — từ các mối tương quan với đánh giá của con người theo từng ngữ hệ.

**Hành động.** `translate` chạy văn bản qua pipeline đã được kiểm thử, với Translation Memory (các phần lặp lại không tốn phí) và một cổng kiểm soát chất lượng tất định (deterministic quality gate). `run_benchmark` bắt đầu một quá trình đánh giá và trả về một **job id ngay lập tức**, bởi vì các lần chạy thực tế kéo dài hơn bất kỳ thời gian chờ (timeout) nào của client; bạn thăm dò (poll) `get_run_status` bằng id đó.

**Huấn luyện mà không tự lừa dối mình.** `get_training_guardrails` trả về các quy tắc được trích xuất từ những thất bại thực tế đã được đo lường. Mười một công cụ `forge_*` chạy [NMT Forge](/docs/network/getting-started/training-honestly) — `forge_status` trước tiên và sau mỗi bước, `forge_preflight` để xem một lệnh sẽ chạm đến những cổng (gate) nào trước khi nó từ chối.

:::note[Chi tiêu được giới hạn theo thiết kế]
`run_benchmark` **từ chối một lần chạy hàng đợi không giới hạn.** Bạn phải truyền chính xác một giới hạn — `budget`, `top`, hoặc một `item_id` cụ thể. Không có lệnh gọi "chỉ chạy hàng đợi" nào, bởi vì một agent hiểu sai về hàng đợi có thể sẽ tiêu tốn không giới hạn.
:::

## Phiên bản giao thức

Giao thức truyền tải (Transport) **chỉ là stdio** — một tiến trình server cho mỗi agent.

[Bản sửa đổi ngày 2026-07-28](https://blog.modelcontextprotocol.io/posts/2026-07-28/) của MCP đã làm cho giao thức mặc định trở thành stateless (không trạng thái), loại bỏ quá trình bắt tay `initialize` và header `Mcp-Session-Id`. Server này không bị ảnh hưởng về mặt thiết kế: nó không sử dụng bất kỳ khả năng nào đã bị ngừng hỗ trợ (Roots, Sampling, Logging), chưa bao giờ sử dụng giao thức truyền tải HTTP+SSE cũ, và đã tuân theo hướng dẫn mới về trạng thái cross-call — `run_benchmark` tạo ra một job handle rõ ràng mà mô hình truyền ngược lại, thay vì dựa vào một phiên truyền tải (transport session).

Nó **chưa** được nâng cấp lên bản sửa đổi mới, bởi vì chưa có TypeScript SDK nào được phát hành hỗ trợ nó. Xem [README của server](https://github.com/gamedaysuits/Champollion/tree/main/mcp-server) để biết quan điểm đầy đủ.

## Các endpoint có thể đọc bằng máy

Không cần MCP client cho các endpoint này:

| Endpoint | Mô tả |
|---|---|
| [`/for-agents.md`](https://champollion.dev/for-agents.md) | [Cánh cửa dành cho agent](/for-agents), dưới dạng markdown thô |
| [`/llms.txt`](https://champollion.dev/llms.txt) | Chỉ mục được tuyển chọn của trang web này |
| [`/llms-full.txt`](https://champollion.dev/llms-full.txt) | Mọi trang được lập chỉ mục, inlined |
| [`/queue.json`](https://champollion.dev/queue.json) | Toàn bộ hàng đợi benchmark |
| [`/queue-preview.json`](https://champollion.dev/queue-preview.json) | Các mục hàng đầu trong hàng đợi |
| [`/registry.json`](https://champollion.dev/registry.json) | Registry của ngữ liệu |
| [`/mesh.json`](https://champollion.dev/mesh.json) | Đồ thị ngôn ngữ đã được đo lường |

## Tiếp theo

- [Hướng dẫn Agent — xây dựng & benchmark](/docs/network/getting-started/agent-guide)
- [Hướng dẫn Agent — dịch thuật với CLI](/docs/guides/agent-guide)
- [Gửi một Phương pháp](/docs/network/getting-started/submit-a-method)
