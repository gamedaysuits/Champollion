---
sidebar_position: 6
title: "Đặc tả độ tin cậy của chỉ số"
slug: '/network/specifications/metric-reliability'
related:
  - label: "Scoring Specification"
    to: /docs/network/specifications/scoring
    kind: spec
    note: "What each metric measures and how the harness computes it"
  - label: "Statistical Significance Testing"
    to: /docs/network/specifications/significance
    kind: spec
    note: "When a score difference actually means something"
  - label: "Benchmark Specification"
    to: /docs/network/specifications/benchmark
    kind: spec
  - label: "Eval Harness v2.0"
    to: /docs/network/specifications/harness
    kind: spec
---

# Đặc tả Độ tin cậy của Metric (Metric Reliability Specification)

> **Tóm tắt dành cho quản lý.** Một điểm số benchmark chỉ thực sự có ý nghĩa khi metric đằng sau nó đáng tin cậy — và các metric tự động không đồng thuận với đánh giá của con người ở mức độ giống nhau trên mọi ngôn ngữ. Tài liệu này đặc tả cách Champollion đo lường **độ tin cậy của metric**: đối với mỗi họ ngôn ngữ, mức độ tương quan mạnh mẽ của từng metric tự động (BLEU, spBLEU, chrF, chrF++, COMET, MetricX) với đánh giá chất lượng của con người, được tính toán từ kho lưu trữ task chung WMT Metrics (2019–2025). Kết quả đầu ra là một tệp minh chứng (evidence artifact) có thể đọc được bằng máy và được công bố công khai, mà harness, CLI và MCP server sẽ tham chiếu trước khi hiển thị bất kỳ điểm số nào là đáng tin cậy. Theo hiểu biết của chúng tôi, không có cơ sở hạ tầng đánh giá nào khác công bố minh chứng này cho từng ngôn ngữ; đây là điều giúp chuyển đổi từ "chúng tôi đã chạy một metric" thành "đây là mức độ bạn có thể tin tưởng nó."
>
> **Phạm vi.** Tài liệu này định nghĩa *minh chứng về độ tin cậy là gì, nó đến từ đâu, chính xác nó được tính toán như thế nào và nó chủ động loại trừ những gì*. Bản thân các định nghĩa metric nằm trong [Đặc tả chấm điểm (Scoring Specification)](/docs/network/specifications/scoring); kiểm định thống kê về sự khác biệt điểm số nằm trong [Ý nghĩa thống kê (Significance)](/docs/network/specifications/significance). Trình nhập (importer) tái tạo tệp minh chứng này là `arena/scripts/import_wmt_metaeval.py` trong kho lưu trữ harness — mã nguồn là quyết định cuối cùng về chi tiết triển khai và nó luôn sẵn sàng để xem xét.

---

## 1. Vấn đề mà tài liệu này giải quyết

Chất lượng dịch thuật máy, suy cho cùng, là một đánh giá của con người. Các metric tự động tồn tại vì việc đánh giá bởi con người rất chậm và tốn kém; mỗi điểm số tự động là một *đại diện (proxy)* cho những gì một người song ngữ thành thạo sẽ nhận xét. Cách nói ngắn gọn của toàn bộ lĩnh vực này — "Hệ thống A đánh bại Hệ thống B với cách biệt 2 BLEU" — ngầm định rằng đại diện đó là trung thực.

Giả định đó đã được kiểm chứng trong nhiều năm qua task chung WMT Metrics, nhưng hầu như luôn ở *mức độ tổng hợp*: các metric được xếp hạng theo mức độ tương quan trung bình với đánh giá của con người trên bất kỳ cặp ngôn ngữ nào mà chiến dịch năm đó bao phủ — chủ yếu là các cặp ngôn ngữ châu Âu tài nguyên cao cùng với tiếng Trung và tiếng Nhật. Chi tiết cho từng ngôn ngữ tồn tại trong dữ liệu thô và trong các bài báo công bố kết quả hàng năm, nhưng nó không được xuất bản ở bất kỳ đâu dưới dạng một lớp minh chứng có thể truy vấn được cho từng họ ngôn ngữ mà một pipeline đánh giá có thể tham chiếu.

Chi tiết này cực kỳ quan trọng đối với các ngôn ngữ tài nguyên thấp và phong phú về mặt hình thái. Hai phát hiện từ chính quá trình nhập dữ liệu của chúng tôi sẽ minh họa cho những rủi ro này (§7 có bảng đầy đủ):

- **Tiếng Anh→Tiếng Inuktitut (wmt20).** Độ tương quan cấp hệ thống của BLEU với đánh giá của con người là **+0.16** — về cơ bản là không cung cấp thông tin. chrF đạt được +0.35. COMET đạt tới +0.86. Một bảng xếp hạng dựa trên BLEU cho cặp ngôn ngữ này sẽ chỉ là xếp hạng các độ nhiễu; trong khi bảng xếp hạng tương tự dựa trên COMET lại mang lại tín hiệu thực sự.
- **Tiếng Anh→Tiếng Maasai (wmt25).** Một lỗi ngược lại: độ tương quan của MetricX-25 là **−0.09** — một metric *học máy (learned metric)* tiên tiến nhất chấm điểm cho một ngôn ngữ không có trong dữ liệu huấn luyện của nó sẽ đưa ra các con số không tương quan với đánh giá của con người, trong khi chrF++ được tính toán (một metric chuỗi "thô sơ" không cần dữ liệu huấn luyện) lại đạt được +0.50.

Cả hai dạng lỗi này đều không thể nhìn thấy được trong điểm trung bình toàn cầu, và chúng chỉ ra các hướng ngược nhau: đối với một ngôn ngữ, metric học máy là metric duy nhất có thể sử dụng; đối với ngôn ngữ khác, nó lại là metric duy nhất *không thể sử dụng*. Bất kỳ cơ sở hạ tầng nào chấm điểm cho hàng trăm cặp ngôn ngữ bằng một bộ metric cố định — như Champollion đang làm — đều có nghĩa vụ phải cung cấp minh chứng này cho người dùng của mình.

## 2. Định nghĩa

Các định nghĩa dưới đây là mức tối thiểu cần thiết để đọc phần còn lại của tài liệu một cách chính xác. Độc giả đã quen thuộc với việc đánh giá dịch máy (MT evaluation) có thể đọc lướt qua đến §3.

**Metric tự động (Automatic metric).** Một hàm ánh xạ từ (đầu ra của hệ thống, bản dịch tham chiếu, và đôi khi là văn bản nguồn) thành một con số. *Metric chuỗi (String metrics)* — BLEU, spBLEU, chrF, chrF++ — so sánh sự trùng lặp bề mặt giữa đầu ra và bản dịch tham chiếu. *Metric học máy (Learned metrics)* — COMET, MetricX, BLEURT — là các mô hình mạng nơ-ron được huấn luyện trên các đánh giá của con người trong quá khứ để dự đoán chất lượng. Các định danh chuẩn cho tất cả các metric trong tài liệu này đến từ registry metric của Champollion (`shared/metric-registry.json`): `bleu`, `spbleu`, `chrf_plain`, `chrf_plus_plus`, `comet_score`, `metricx_score`.

**Giao thức đánh giá của con người (Human judgment protocols).** Các chiến dịch WMT đã thu thập điểm số chất lượng từ con người theo một số giao thức, mà tệp minh chứng này sẽ phân biệt rõ ràng:

- **DA (Direct Assessment - Đánh giá trực tiếp)** — những người làm việc tự do (crowdworkers) hoặc các nhà nghiên cứu xếp hạng một bản dịch từ 0–100. DA *chuẩn hóa z* (được viết là `wmt-z`) chuẩn hóa điểm số của mỗi người đánh giá về giá trị trung bình bằng 0, phương sai bằng 1, loại bỏ ảnh hưởng của sự rộng lượng từ người đánh giá.
- **DA+SQM** (`da-sqm`, `wmt`) — DA được thu thập trên thang điểm 0–100 được chú thích bằng các mô tả mốc metric chất lượng vô hướng; được sử dụng từ WMT22.
- **MQM (Multidimensional Quality Metrics - Metric chất lượng đa chiều)** (`mqm`) — những người chú thích chuyên nghiệp đánh dấu và phân loại các khoảng lỗi (error spans) riêng lẻ cùng với mức độ nghiêm trọng; số lượng lỗi được tính trọng số sẽ trở thành điểm số của phân đoạn (segment score). Chậm, tốn kém và là tín hiệu đáng tin cậy nhất hiện có; chỉ được thu thập cho một vài cặp ngôn ngữ tài nguyên cao mỗi năm (các chú thích bắt nguồn từ các bản phát hành `wmt-mqm-human-evaluation` của Google).
- **ESA (Error Span Annotation - Chú thích khoảng lỗi)** (`esa`, `esa-merged`) — giao thức của WMT24 và WMT25 kết hợp việc đánh dấu khoảng lỗi với xếp hạng vô hướng; rẻ hơn MQM, cung cấp nhiều thông tin hơn DA.

**Đánh giá siêu cấp (Meta-evaluation).** Đánh giá các công cụ đánh giá: đo lường mức độ đồng thuận giữa điểm số của từng metric tự động với điểm số của con người trên cùng các bản dịch đó. Sự đồng thuận được đo ở hai cấp độ:

- **Cấp hệ thống (System level)** (`sys`): mỗi hệ thống dịch máy nhận được một điểm số con người tổng hợp và một điểm số metric tổng hợp cho một tập kiểm thử; sự đồng thuận được tính toán trên các hệ thống. Điều này đặt ra câu hỏi: *liệu metric có xếp hạng toàn bộ các hệ thống giống như cách con người làm hay không?* — câu hỏi mà một bảng xếp hạng quan tâm.
- **Cấp phân đoạn (Segment level)** (`seg`): sự đồng thuận trên các cặp (hệ thống, câu) riêng lẻ. Điều này đặt ra câu hỏi: *liệu metric có thể phân biệt một câu tốt với một câu tồi hay không?* — câu hỏi mà việc ước lượng chất lượng và lọc dữ liệu quan tâm. Việc này khó hơn nhiều, và các độ tương quan có tính hệ thống là thấp hơn.

**Thống kê tương quan (Correlation statistics).** Bốn chỉ số thống kê tiêu chuẩn, được định nghĩa ở đây chính xác như cách chúng được tính toán:

- **Pearson's r** — tương quan tuyến tính giữa hai vectơ điểm số.
- **Spearman's ρ** — Pearson's r được tính toán trên các thứ hạng trung bình; đo lường sự đồng thuận đơn điệu, không nhạy cảm với thang đo.
- **Kendall's τ-b** — trong số tất cả các cặp mục, phần dư (đã điều chỉnh liên kết) của các cặp được sắp xếp đồng thuận so với các cặp được sắp xếp không đồng thuận. Chúng tôi sử dụng công thức τ-b điều chỉnh liên kết tiêu chuẩn (tương đương với `scipy.stats.kendalltau`; triển khai của chúng tôi không có dependency và được kiểm tra chéo với một tham chiếu brute-force trong bộ kiểm thử).
- **Độ chính xác xếp hạng theo cặp (Pairwise ranking accuracy)** (chỉ ở cấp hệ thống) — trong số tất cả các cặp hệ thống mà con người sắp xếp thứ tự một cách *nghiêm ngặt*, tỷ lệ mà metric sắp xếp theo cùng một cách, với một liên kết metric (metric tie) được tính là một thất bại trong việc tái tạo thứ tự. Đây là thống kê độ chính xác của Kocmi và cộng sự (2021), được các chiến dịch WMT gần đây sử dụng làm con số cấp hệ thống tiêu đề của họ.

**Họ ngôn ngữ (Language family).** Nhóm phả hệ của ngôn ngữ *đích* (ngôn ngữ được dịch sang), như được ghi lại trong cơ sở dữ liệu ngôn ngữ của Champollion (`languages.family`, có nguồn gốc từ Glottolog). §5 thảo luận về lý do tại sao lại chọn phía đích, và một họ ngôn ngữ có thể và không thể đại diện cho điều gì.

## 3. Dữ liệu

### 3.1 Các nguồn dữ liệu, đã ghim (pinned)

| Nguồn | Những gì nó cung cấp | Ghim (Pin) |
|---|---|---|
| `google-research/mt-metrics-eval` (kho lưu trữ dữ liệu v2) | Điểm số của con người, điểm số metric, đầu ra hệ thống, nguồn và tham chiếu cho mọi tập kiểm thử Metrics-task của WMT, wmt19–wmt25 | commit mã nguồn `68a481ae…`; tệp nén dữ liệu `mt-metrics-eval-v2.tgz` từ `data.statmt.org`, được ghim **sha256 `6708eec9aaa8a9deca5e370bdd0e23db4881aeca129f29d5281575eaa66c7e10`**, ETag `36579a46-64ff8bb1d3080`, Last-Modified 2026-04-21, 911,710,790 bytes |
| `google/wmt-mqm-human-evaluation` | Nguồn gốc thượng nguồn của các chú thích chuyên gia MQM mà mt-metrics-eval phân phối lại dưới dạng hợp nhất; Apache-2.0 | commit `7fadea28…` |

Hai thực tế về tính toàn vẹn dữ liệu định hình kỷ luật ghim dữ liệu này. Đầu tiên, **tệp nén dữ liệu không phải là bất biến** — nó được xuất bản lại tại chỗ khi các chiến dịch mới được thêm vào — vì vậy tệp minh chứng sẽ ghi lại checksum, ETag và timestamp của bản sao chính xác mà các con số được tính toán từ đó, và trình nhập sẽ từ chối chạy nếu không có checksum. Thứ hai, giấy phép Apache-2.0 của bộ công cụ chỉ bao gồm *mã nguồn* của nó; **dữ liệu đánh giá của con người và tập kiểm thử đi kèm không có tuyên bố cấp phép rõ ràng**. Hệ quả của việc đó nằm ở §8.

Nội dung kho lưu trữ (≈4.2 GB chưa giải nén: các đánh giá của con người, các tham chiếu và đầu ra hệ thống đầy đủ cho mọi chiến dịch) **không bao giờ được lưu trữ trong kho lưu trữ này hoặc được phân phối lại bởi Champollion**. Chúng được tải về từ nguồn vào một bộ nhớ đệm cục bộ; chỉ các con số tương quan phái sinh mới được công bố. Đây là cùng một cơ chế tải về từ nguồn mà mọi benchmark của Champollion đều tuân theo.

### 3.2 Những gì mỗi chiến dịch đóng góp

| Tập kiểm thử | Các cặp có đánh giá của con người | (Các) giao thức con người được sử dụng ở đây |
|---|---|---|
| wmt19 | 18 | DA-z |
| wmt20 | 18 (bao gồm en→iu, en→ta, km→en, ps→en) | DA-z; MQM (en→de, zh→en) |
| wmt21.news | 16 (bao gồm en→ha, en→is) | DA-z; MQM (en→de, zh→en, en→ru) |
| wmt21.tedtalks | 3 | MQM |
| wmt21.flores | 4 (bn↔hi, xh↔zu) | DA-z |
| wmt22 | 17 (bao gồm en→liv, sah→ru, cs↔uk) | DA-SQM; MQM (en→de, zh→en, en→ru) |
| wmt23 | 9 (bao gồm he→en) | DA-SQM; MQM |
| wmt23.sent | 1 | MQM |
| wmt24 | 11 (bao gồm en→is, en→hi) | ESA; MQM |
| wmt25 | 16 (bao gồm en→bho, en→mas, en→ar) | ESA-merged; MQM |

**Bị loại trừ: wmt24pp.** Bản phát hành WMT24++ mở rộng phạm vi bao phủ lên 55 cặp ngôn ngữ nhưng *chỉ cung cấp các tham chiếu và đầu ra hệ thống* — không có đánh giá của con người — vì vậy không thể tính toán độ tương quan từ nó. Nó được liệt kê trong sổ cái loại trừ của tệp minh chứng thay vì bị bỏ qua một cách âm thầm.

## 4. Phương pháp

Trình nhập sẽ duyệt qua từng (tập kiểm thử, cặp ngôn ngữ) và tính toán một **ô (cell)** cho mỗi (luồng đánh giá của con người, cấp độ, metric):

1. **Khám phá các luồng đánh giá của con người.** Tất cả các tệp điểm số của con người có sẵn cho cặp ngôn ngữ được so khớp với một danh sách cho phép rõ ràng (§4.1). Các tệp cấp độ người đánh giá, tệp khoảng lỗi thô và điểm số cấp tài liệu/tên miền nằm ngoài phạm vi.
2. **Loại trừ các "hệ thống" con người.** Các tệp điểm số của WMT bao gồm chính các bản dịch tham chiếu như các hệ thống được chấm điểm (`refA`, `refb`, `HUMAN.0`…). Việc tương quan một metric với chính tham chiếu của nó là vô nghĩa, vì vậy bất kỳ hệ thống nào khớp với tập tham chiếu của cặp ngôn ngữ hoặc các tiền tố `ref`/`human`/`synthetic` đều bị loại trừ hoàn toàn.
3. **Căn chỉnh (Align).** Cấp hệ thống: phần giao của các hệ thống có cả điểm số của con người và điểm số metric (các giá trị bị thiếu sẽ bị bỏ qua, không bao giờ bị ép buộc về 0). Cấp phân đoạn: mọi cặp (hệ thống, phân đoạn) có cả hai điểm số, được gộp chung trên các hệ thống mà không cần nhóm — đây là cách làm phẳng "không tính trung bình" của mt-metrics-eval. Các tệp không đồng đều (số lượng phân đoạn không khớp) sẽ làm hỏng ô đó thay vì căn chỉnh xấp xỉ.
4. **Tính toán.** Pearson, Spearman và Kendall τ-b ở cả hai cấp độ; độ chính xác xếp hạng theo cặp ở cấp hệ thống. Các ô có ít hơn 3 hệ thống được căn chỉnh (sys) hoặc ít hơn 10 điểm được căn chỉnh trên ít nhất 2 hệ thống (seg), hoặc có phương sai bằng không ở một trong hai bên, sẽ được ghi lại trong sổ cái loại trừ dưới dạng suy biến (20 ô trong bản dựng hiện tại).
5. **Tổng hợp (Roll up).** Trên mỗi họ ngôn ngữ đích, mỗi metric, mỗi cấp độ: giá trị trung bình có trọng số n của từng chỉ số thống kê trên các ô *được ưu tiên* (§4.1), với danh sách (tập kiểm thử, cặp ngôn ngữ) đóng góp được giữ lại để bất kỳ giá trị tổng hợp nào cũng có thể được phân rã ngược lại thành các đầu vào của nó.

### 4.1 Ưu tiên luồng đánh giá của con người

Khi một cặp ngôn ngữ có nhiều luồng đánh giá của con người, tất cả đều được tính toán, nhưng chính xác một luồng được gắn cờ **được ưu tiên (preferred)** và chỉ các ô được ưu tiên mới đi vào phần tổng hợp họ ngôn ngữ — nếu không, một cặp ngôn ngữ được đánh giá dưới cả MQM và DA sẽ bị tính hai lần. Thứ tự ưu tiên dựa trên chất lượng tín hiệu:

```
mqm > esa-merged > esa > da-sqm > wmt-z > wmt-appraise-z > wmt-appraise > wmt > wmt-raw
```

Chú thích lỗi của chuyên gia (MQM) xếp trên các giao thức khoảng lỗi (ESA), các giao thức này xếp trên đánh giá trực tiếp vô hướng (DA); trong DA, các luồng chuẩn hóa z xếp trên các luồng thô. Các ô không được ưu tiên vẫn được giữ lại trong tệp minh chứng cho bất kỳ ai muốn nghiên cứu ảnh hưởng của giao thức.

### 4.2 Định danh và phiên bản metric

Các metric học máy thay đổi theo từng năm (COMET-20, COMET-22, MetricX-23/24/25 là các mô hình khác nhau), và việc coi chúng là một metric duy nhất sẽ làm mờ đi chính sự khác biệt mà meta-evaluation tồn tại để chỉ ra. Do đó, mỗi ô ghi lại **tên điểm số thượng nguồn nguyên văn** (`COMET-22`, `MetricX-25-Ref`, `metricx_xxl_MQM_2020`…) bên cạnh id registry chuẩn, và tệp minh chứng liệt kê những tên thượng nguồn nào đã nạp vào mỗi id. Khi một chiến dịch chấm điểm một metric đối với nhiều tham chiếu, luồng tham chiếu được sử dụng cũng được ghi lại cho mỗi ô.

Điểm số được sử dụng chính xác như cách kho lưu trữ phân phối chúng (tất cả các luồng điểm số càng cao càng tốt; điểm số lỗi MQM và MetricX được lưu trữ dưới dạng phủ định ở thượng nguồn). Không áp dụng việc đảo dấu hoặc thay đổi thang đo; các độ tương quan không thay đổi theo thang đo và quy ước định hướng đã được xác minh bằng thực nghiệm trước khi nhập.

### 4.3 Luồng chrF++ được tính toán

chrF++ — metric chuỗi chính của harness — chỉ được gửi cho chiến dịch wmt20, vì vậy điểm số thượng nguồn chỉ tồn tại cho một năm. Đối với mọi tập kiểm thử khác, trình nhập tự tính toán chrF++ (sacreBLEU, `word_order=2`) từ các đầu ra hệ thống được lưu trong bộ nhớ đệm đối với tham chiếu được ghi lại. Các ô này được gắn cờ `computed: true` và tên thượng nguồn của chúng ghi rõ như vậy: một điểm số do Champollion tự tính toán không bao giờ được trình bày dưới dạng một bài nộp của WMT. Tất cả các ô metric khác là các giá trị thượng nguồn nguyên văn; điều duy nhất Champollion thêm vào chúng là phép tính tương quan.

## 5. Các lựa chọn thiết kế, giải pháp thay thế và lý do căn bản

Đây là những quyết định mà một người đánh giá nên chất vấn. Mỗi mục liệt kê những gì đã được chọn, những gì không được chọn và lý do tại sao.

**Được khóa theo họ ngôn ngữ đích.** *Được chọn:* tổng hợp theo họ của ngôn ngữ được dịch *sang*. *Các giải pháp thay thế:* chỉ theo từng cặp (không tổng hợp); phân loại theo phía nguồn hoặc cấp độ cặp; các vectơ đặc trưng phân loại thay vì phả hệ. *Lý do căn bản:* độ tin cậy của metric bị chi phối bởi mức độ khó của ngôn ngữ *đầu ra* cần chấm điểm — sự phong phú về mặt hình thái làm tăng sự không khớp bề mặt đối với các metric chuỗi, và sự khan hiếm dữ liệu huấn luyện làm giảm chất lượng của các metric học máy — cả hai đều là thuộc tính của ngôn ngữ đích. Họ ngôn ngữ là một khóa thô sơ nhưng luôn có sẵn (mọi ngôn ngữ trong cơ sở dữ liệu của Champollion đều có một họ); các đặc trưng phân loại sẽ chi tiết hơn nhưng lại bị thiếu hoặc bị tranh chấp đối với chính các ngôn ngữ tài nguyên thấp mà tài liệu này tồn tại để phục vụ. Các ô theo từng cặp được giữ lại đầy đủ, vì vậy các hoạt động tái tổng hợp chi tiết hơn (theo chi, theo loại hình thái) có thể được xây dựng từ tệp minh chứng mà không cần nhập lại.

**Tương quan cấp phân đoạn được làm phẳng.** *Được chọn:* Kendall τ-b trên vectơ (hệ thống, phân đoạn) được gộp chung. *Các giải pháp thay thế:* độ chính xác theo cặp được nhóm theo mục với hiệu chuẩn liên kết (acc*-eq của các phát hiện WMT gần đây); τ trên mỗi phân đoạn được tính trung bình trên các phân đoạn. *Lý do căn bản:* thống kê được làm phẳng là lựa chọn đơn giản nhất có thể bảo vệ được, có thể tái tạo chính xác từ định nghĩa của nó mà không cần quy trình hiệu chuẩn liên kết, và bảo toàn khả năng so sánh giữa các ngôn ngữ mà tệp minh chứng này cần. Nó *không phải* là thống kê tiêu đề WMT mới nhất, và §8 liệt kê đó là một hạn chế thay vì giả vờ tương đương.

**Các liên kết metric tính là thất bại của metric** trong độ chính xác theo cặp. Một metric không thể tách biệt hai hệ thống mà con người tách biệt đã thất bại trong việc tái tạo thứ tự của con người; việc cho một nửa điểm sẽ thưởng cho việc lượng tử hóa điểm số.

**Giá trị trung bình có trọng số trong phần tổng hợp.** Các giá trị tổng hợp họ ngôn ngữ tính trọng số cho mỗi ô theo kích thước mẫu của nó (các hệ thống ở cấp sys, các điểm ở cấp seg), vì vậy một cặp MQM 17 hệ thống sẽ có trọng số lớn hơn một cặp DA 6 hệ thống. Các giá trị không tính trọng số cho từng ô vẫn có sẵn.

**Các ngưỡng.** Các ô cần ≥3 hệ thống được căn chỉnh (một tương quan trên 2 điểm là vô nghĩa) hoặc ≥10 điểm phân đoạn được căn chỉnh trên ≥2 hệ thống. Đây là những mức sàn chống lại các phép tính suy biến, không phải là các tuyên bố về ý nghĩa thống kê — xem §8.

**Kỷ luật nguyên văn thượng nguồn.** Champollion không tính toán lại bất kỳ thứ gì nó có thể trích dẫn (ngoại trừ luồng chrF++ được gắn cờ), bởi vì các metric học máy được tính điểm lại sẽ tạo ra sự sai lệch về phiên bản và môi trường mà các tên thượng nguồn trên mỗi ô tồn tại để ngăn chặn. Sự đánh đổi — các khoảng trống bao phủ khi một chiến dịch không chạy một metric — hiển thị dưới dạng các ô bị thiếu thay vì bị che đậy.

**Loại trừ trung thực khi thất bại.** Mọi thứ bị bỏ qua (một tập kiểm thử không có đánh giá của con người, một mã ngôn ngữ không thể phân giải, một ô suy biến) đều được ghi vào sổ cái loại trừ kèm theo lý do. Người đọc tệp minh chứng có thể liệt kê những gì *không* có trong đó — thuộc tính mà hầu hết các báo cáo tổng hợp đều thiếu.

## 6. Tệp minh chứng được công bố

Minh chứng được phân phối dưới dạng một tệp JSON có thể đọc được bằng máy, được theo dõi trong monorepo (chủ động không đóng gói vào các gói npm/PyPI):

```
shared/catalogue/metric-reliability.json    # the artifact (≈0.6 MB)
shared/schemas/metric-reliability.schema.json  # its JSON-Schema contract
```

Bản dựng hiện tại: **1,810 ô** (1,052 ô được ưu tiên) trên **57 cặp ngôn ngữ**, **10 tập kiểm thử**, **11 họ ngôn ngữ đích**, với 21 trường hợp loại trừ trong sổ cái. Các khối cấp cao nhất: `sources` và `provenance` đã ghim (mọi giá trị phái sinh đều mang nguồn gốc `champollion-derived` đặt tên cho các nguồn thượng nguồn — các tương quan là của chúng tôi, các đánh giá thì không); `correlation_definitions` (các định nghĩa thống kê chính xác của §2); `metrics` (id registry ↔ tên thượng nguồn); `languages` (mã → họ/chi); `families` (phần tổng hợp); `cells` (mọi tương quan, được ghi nhận đầy đủ); `excluded` (sổ cái).

Ba bề mặt tiêu thụ đọc nó ngày hôm nay:

- **Harness CLI:** `mt-eval recommend SRC TGT` hiển thị một khối "độ tin cậy metric cho mục tiêu" bên cạnh tính khả dụng của phương pháp và kết quả được trích dẫn.
- **Champollion CLI:** `champollion recommend SRC TGT` (cùng một hợp đồng payload; tệp minh chứng được theo dõi trong monorepo, vì vậy các cài đặt được đóng gói sẽ giảm cấp xuống một ghi chú rõ ràng "chỉ mục không khả dụng").
- **MCP server:** công cụ `get_metric_reliability` trả lời câu hỏi "tôi nên tin tưởng metric nào cho ngôn ngữ X?" cho bất kỳ tác nhân AI nào được kết nối, bao gồm một câu trả lời UNMEASURED rõ ràng cho các ngôn ngữ chưa từng được chiến dịch WMT nào đánh giá.

## 7. Tổng quan kết quả

Hệ số tương quan Pearson cấp hệ thống với luồng con người được ưu tiên, giá trị trung bình có trọng số cho mỗi họ ngôn ngữ đích (bản dựng hiện tại; các con số cấp phân đoạn, Spearman, τ-b và độ chính xác theo cặp nằm trong tệp minh chứng):

| Họ ngôn ngữ đích | Số cặp | BLEU | spBLEU | chrF | chrF++ | COMET | MetricX |
|---|---|---|---|---|---|---|---|
| Afro-Asiatic | 2 | +0.88 | +0.95 | +0.85 | +0.87 | +0.67 | **−0.62** |
| Dravidian | 1 | +0.88 | — | +0.94 | +0.93 | +0.94 | — |
| Eskimo-Aleut | 1 | **+0.16** | — | +0.35 | +0.33 | **+0.86** | — |
| Indo-European | 42 | +0.75 | +0.76 | +0.79 | +0.76 | +0.81 | +0.84 |
| Japonic | 1 | +0.52 | +0.89 | +0.93 | +0.84 | +0.73 | +0.74 |
| Koreanic | 1 | +0.89 | +0.87 | +0.87 | +0.88 | +0.55 | +0.77 |
| Niger-Congo | 2 | +0.94 | — | +1.00 | +1.00 | +1.00 | — |
| Nilotic | 1 | — | — | — | +0.50 | — | **−0.09** |
| Sino-Tibetan | 2 | +0.49 | +0.68 | +0.68 | +0.62 | +0.72 | +0.82 |
| Turkic | 1 | +0.85 | — | +0.97 | +0.97 | — | — |
| Uralic | 3 | +0.85 | +0.88 | +0.91 | +0.91 | +0.75 | +0.81 |

Cách đọc bảng này — và cách không nên đọc:

- **Mô hình rộng khớp với các phát hiện tổng hợp của lĩnh vực.** Trên phần lớn 42 cặp ngôn ngữ Indo-European, các metric học máy dẫn đầu (MetricX +0.84, COMET +0.81) với chrF đứng sau và BLEU đứng cuối — kết quả WMT tiêu chuẩn, được tái tạo ở đây từ dữ liệu thô như một mốc kiểm tra tính đúng đắn.
- **Các sai lệch theo từng họ ngôn ngữ là phần thông tin giá trị nhất.** Đối với tiếng Inuktitut đa tổng hợp (polysynthetic), các metric chuỗi sụp đổ và COMET là tín hiệu duy nhất có thể sử dụng. Đối với tiếng Maasai và tiếng Anh→tiếng Ả Rập trong wmt25, MetricX tương quan *âm* trong khi các metric chuỗi vẫn có thể sử dụng được — một metric học máy ngoại suy vượt ra ngoài phân phối huấn luyện của nó sẽ thất bại một cách âm thầm, với các điểm số trông có vẻ rất tự tin. Đây chính xác là những trường hợp mà điểm trung bình toàn cầu sẽ xóa nhòa.
- **Các họ ngôn ngữ chỉ có một cặp là minh chứng, không phải kết luận.** Tám trong số mười một họ ngôn ngữ dựa trên một hoặc hai cặp từ một chiến dịch duy nhất. Cách đọc trung thực của "Eskimo-Aleut: BLEU +0.16" là *"trong chiến dịch duy nhất mà con người đánh giá en→iu, BLEU đã không cung cấp thông tin"* — một phép đo đã được ghi nhận, một cảnh báo đỏ và là lý do để thu thập thêm dữ liệu, chứ không phải là một quy luật về họ ngôn ngữ đó.
- **Một ô có giá trị âm không có nghĩa là metric đó bị hỏng ở mọi nơi.** Nó có nghĩa là: trên cặp ngôn ngữ đó, trong nhóm hệ thống của chiến dịch đó, metric đã sắp xếp thứ tự các hệ thống ngược lại với đánh giá của con người. Hạn chế phạm vi (xem §8) có thể làm giảm bất kỳ độ tương quan nào khi các hệ thống tập trung chặt chẽ về mặt chất lượng.

## 8. Hạn chế

Được phát biểu một cách rõ ràng, bởi vì giá trị của tệp minh chứng nằm ở sự trung thực của nó:

1. **Họ ngôn ngữ là một đại diện, không phải là một cơ chế.** Họ ngôn ngữ phả hệ tương quan với, nhưng không quyết định, các thuộc tính hình thái thúc đẩy hành vi của metric. Các ô theo từng cặp (với chi được ghi lại cho mỗi ngôn ngữ) cho phép phân tích chi tiết hơn; khóa họ ngôn ngữ là một mặc định có thể truy vấn được, không phải là một tuyên bố về nguyên nhân loại hình học.
2. **Phạm vi bao phủ là những gì WMT đã đánh giá, không phải những gì thế giới nói.** 57 cặp ngôn ngữ, chịu ảnh hưởng nặng nề bởi châu Âu; mọi cặp xx→English đều được gộp vào Indo-European; toàn bộ các siêu họ (Algonquian, Austronesian, Quechuan, …) hoàn toàn *không có phạm vi bao phủ đánh giá của con người*. Đối với những ngôn ngữ đó, các bề mặt của Champollion trả về UNMEASURED thay vì mượn một con số của ngôn ngữ lân cận. Chương trình benchmark độc lập của riêng Champollion — các tập kiểm thử do cộng đồng kiểm soát với sự xác thực của người bản xứ — là giải pháp lâu dài cho chính khoảng trống này.
3. **Chuyển giao trong cùng họ ngôn ngữ là một giả định.** Khi một ngôn ngữ được truy vấn chưa bao giờ được đánh giá trực tiếp, minh chứng cấp họ ngôn ngữ sẽ đến từ các ngôn ngữ *khác* trong họ đó, và mọi bề mặt tiêu thụ đều nói rõ điều này.
4. **Chưa có khoảng tin cậy.** Các ô mang kích thước mẫu nhưng không có khoảng bootstrap; đặc biệt là các giá trị tổng hợp họ ngôn ngữ một cặp nên được đọc với các độ rộng mà §7 ngụ ý. Việc thêm các khoảng tin cậy bootstrap cho từng ô (harness đã có sẵn cơ chế cho các khoảng tin cậy điểm số) là công việc đã được lên kế hoạch.
5. **Hạn chế phạm vi.** Các độ tương quan được tính toán trên các hệ thống được gửi của mỗi chiến dịch. Các chiến dịch gần đây tập hợp nhiều hệ thống mạnh lại với nhau một cách chặt chẽ, điều này làm giảm độ tương quan cho tất cả các metric — một phần lý do tại sao các ô có nguồn gốc từ wmt25 (Maasai, tiếng Ả Rập) hiển thị các giá trị cực đoan. Việc ghi nhận theo từng tập kiểm thử trên mỗi ô giúp điều này có thể kiểm tra được.
6. **Lựa chọn thống kê cấp phân đoạn.** Chỉ số τ-b được làm phẳng là đơn giản và có thể tái tạo nhưng không phải là độ chính xác nhóm được hiệu chuẩn liên kết của các bài báo công bố kết quả WMT gần đây nhất; các con số ở đây không nên được so sánh từng chữ số với các ấn phẩm đó.
7. **Giấy phép dữ liệu.** Dữ liệu đánh giá của con người ở thượng nguồn không có tuyên bố cấp phép rõ ràng (§3.1). Champollion không phân phối lại bất kỳ phần nào trong đó, chỉ công bố các thống kê phái sinh với đầy đủ ghi nhận nguồn gốc, và giữ tệp minh chứng này trong một **luồng minh chứng phi thương mại** (`license_lane.commercial_ok: false`) cho đến khi vấn đề này được giải quyết. Các luồng MQM ngoài ra còn có nguồn gốc từ các bản phát hành chú thích Apache-2.0 của Google.
8. **Kho lưu trữ là một mục tiêu di động.** Các chiến dịch mới được thêm vào cùng một URL tệp nén. Các ghim xác định chính xác ảnh chụp nhanh (snapshot) của chúng tôi; việc tái tạo đối với một ảnh chụp nhanh mới hơn là một phiên bản tệp minh chứng mới với các ghim mới, không bao giờ là một bản cập nhật âm thầm.

## 9. Tái tạo

Bất kỳ ai cũng có thể tái tạo tệp minh chứng từ nguồn:

```bash
# 1. Fetch the archive (912 MB compressed; NOT immutable — keep the pins)
mkdir -p ~/.mt-eval/mt-metrics-eval && cd ~/.mt-eval/mt-metrics-eval
curl -sSL -D mt-metrics-eval-v2.headers -o mt-metrics-eval-v2.tgz \
     https://data.statmt.org/wmt26/mt-metrics-eval-v2.tgz
shasum -a 256 mt-metrics-eval-v2.tgz > mt-metrics-eval-v2.sha256
tar xzf mt-metrics-eval-v2.tgz

# 2. Regenerate (refuses to run without a checksum pin)
python3 arena/scripts/import_wmt_metaeval.py
```

Lưu ý rằng tệp README của chính kho lưu trữ chỉ ra một URL storage.googleapis.com đã ngừng hoạt động; `data.statmt.org` là host đang hoạt động. Trình nhập là thư viện tiêu chuẩn Python thuần túy (chỉ sử dụng sacreBLEU cho luồng chrF++ được tính toán); các triển khai tương quan của nó được kiểm tra chéo với các tham chiếu brute-force trong `arena/tests/test_wmt_metaeval.py`, và hợp đồng cấu trúc của tệp minh chứng được thực thi bởi schema JSON của nó cùng với các bài kiểm tra tính toàn vẹn trong cả hai runtime.

## 10. Ghi nhận và trích dẫn

Các đánh giá của con người được tóm tắt ở đây là công trình của **các nhà tổ chức và người chú thích task chung WMT Metrics** — bao gồm Markus Freitag, Nitika Mathur, Tom Kocmi và nhiều cộng tác viên trong các chiến dịch 2019–2025 — và của **chương trình chú thích Google MQM** (Freitag và cộng sự, *Experts, Errors, and Context*, TACL 2021; `google/wmt-mqm-human-evaluation`). Kho lưu trữ và bộ công cụ được duy trì dưới dạng `google-research/mt-metrics-eval`. Độ chính xác xếp hạng theo cặp tuân theo Kocmi, Federmann và cộng sự (2021), *To Ship or Not to Ship*. Đóng góp của Champollion là việc tổ chức theo từng họ ngôn ngữ, tính toán tương quan và khung trung thực xung quanh nó — mọi con số trong tệp minh chứng đều mang nguồn gốc `champollion-derived` đặt tên cho nguồn thượng nguồn mà nó bắt nguồn từ đó, và không có văn bản, đánh giá hoặc điểm số nào của họ bị phân phối lại.

Khi trích dẫn các con số độ tin cậy từ tệp minh chứng này, hãy trích dẫn cả (các) chiến dịch WMT mà các ô ghi nhận và phiên bản tệp minh chứng của Champollion (khối `sources` mang các ghim dữ liệu chính xác), và tôn trọng luồng minh chứng phi thương mại được mô tả trong §8.
