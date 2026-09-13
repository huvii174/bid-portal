# Vận hành Bid Portal

## Người chịu trách nhiệm

| Vai trò | Người | Việc phải làm |
|---|---|---|
| **Chủ sở hữu khiếu nại / takedown** | ⚠️ **CHƯA ĐIỀN — phải điền tên và email thật trước khi chạy production** | Nhận và xử lý mọi khiếu nại từ sàn nguồn. Có quyền tắt nguồn ngay lập tức, không cần hỏi ai. |
| Quản trị hệ thống | (điền) | Theo dõi `/admin/sources`, xử lý cảnh báo adapter |

Đây không phải thủ tục giấy tờ. Hệ thống này crawl dữ liệu của bên thứ ba trên đường dẫn mà 2 trong 3 sàn dự kiến **chặn trong robots.txt** (xem `.omc/plans/`). Nếu có thư yêu cầu ngừng, phải có đúng một người biết mình phải phản hồi.

## Ranh giới đã cam kết — không được vượt

1. **Không bao giờ crawl sau đăng nhập** trên site nguồn. Biến tranh cãi robots.txt (yếu) thành vi phạm hợp đồng click-through (mạnh). Không có ngoại lệ.
2. **Không tái xuất bản dữ liệu ra ngoài đội.** Đây là công cụ nội bộ. Không API công khai, không chia sẻ link cho người ngoài.
3. **Chỉ cache thumbnail ≤400px**, không lưu ảnh gốc độ phân giải cao.
4. **Mọi card phải có link về nguồn.** Người dùng luôn kết thúc giao dịch trên site gốc.
5. **Giữ dữ liệu tối đa 90 ngày** sau khi phiên kết thúc (job `retention` tự chạy; món trong watchlist được giữ lại).
6. **Danh tính crawler tách biệt hoàn toàn** khỏi tài khoản đấu giá thật của đội. Không dùng chung IP, không dùng chung email.

## Chạy hệ thống

```bash
docker compose up -d          # Postgres (cổng host 5433)
npm install
cp .env.example .env          # sửa AUTH_SECRET: openssl rand -base64 32
npm run db:migrate
npm run -w @bid/db seed-sources
npm run db:seed-admin -- ban@congty.com   # in mật khẩu một lần duy nhất

npm run dev:web               # http://localhost:3100
npm run dev:worker            # xử lý job tìm kiếm + bảo trì mỗi 6h
```

Worker phải chạy liên tục — không có worker thì tìm kiếm từ khóa mới sẽ treo ở trạng thái `queued` mãi mãi.

## Tắt một nguồn khi có sự cố

**Qua giao diện:** `/admin/sources` → nút **Tắt nguồn**. Có hiệu lực ngay từ job kế tiếp.

**Qua SQL** (khi web sập):

```sql
update sources set enabled = false where id = 'hibid';
```

Nguồn đã tắt vẫn trả kết quả đã cache cho người dùng; job mới báo `disabled` thay vì lỗi.

## Đọc sức khoẻ hệ thống

`/admin/sources` có bảng các lần chạy gần đây. Ý nghĩa từng trạng thái:

| Trạng thái | Nghĩa là gì | Làm gì |
|---|---|---|
| `ổn` | Bình thường | — |
| `0 kết quả (nghi hỏng)` | Từ khóa này **trước đây có** kết quả, giờ về 0 | **Ưu tiên cao.** Gần như chắc chắn adapter hỏng chứ không phải hết hàng. Chạy `npm run -w @bid/worker search -- "<từ khóa>"` để xem adapter còn parse được không |
| `lỗi` | Adapter ném lỗi | Xem cột Lỗi. `khong tim thay <script id="hibid-state">` = HiBid đã bỏ TransferState → phải viết lại adapter |

Admin cũng nhận email cho mọi trạng thái khác `ổn` (cần `RESEND_API_KEY`; chưa có thì chỉ ghi log — **nghĩa là trên production bắt buộc phải cấu hình**).

## Kiểm tra recall hàng tháng — đừng bỏ

Chế độ hỏng nguy hiểm nhất **không phải** hệ thống sập, mà là nó âm thầm thu thập thiếu. Đội vẫn thấy kết quả, tin là đủ, và bỏ lỡ hàng.

Mỗi tháng, với 3 từ khóa đội hay dùng:

1. Tìm trực tiếp trên từng sàn (hibid.com, liveauctioneers.com, invaluable.com), đếm số kết quả.
2. Tìm cùng từ khóa trên portal, đếm số kết quả **theo từng nguồn** (badge trên trang tìm kiếm có ghi).
3. Lệch quá ~10% ở nguồn nào → điều tra adapter của nguồn đó.

Lưu ý: nếu nguồn bị gắn nhãn "còn nữa, chưa lấy hết" thì lệch là bình thường — đó là `pages_per_search`, không phải adapter hỏng.

Ghi lại kết quả vào đây:

| Ngày | Từ khóa | Nguồn | Trên sàn | Trên portal | Ghi chú |
|---|---|---|---|---|---|
| | | | | | |

## Ba nguồn, ba tính chất khác hẳn nhau

| Nguồn | Cách lấy | robots.txt | Giãn cách | Lot/trang | Độ bền |
|---|---|---|---|---|---|
| **HiBid** | `fetch` + JSON nhúng (`hibid-state`) | **Cho phép** `/lots?q=` | 2s | 100 | Khá |
| **LiveAuctioneers** | `fetch` + JSON nhúng (`window.__data`) | **Chặn** `/search?` | 5s | 24 | Khá |
| **Invaluable** | Gọi thẳng **Algolia** bằng khoá nhúng trong trang | **Chặn** `/search?keyword=`, `Crawl-delay: 10` | 10s | 40 | **Thấp nhất** |

**Invaluable là mắt xích yếu nhất.** Kết quả của họ render phía client qua Algolia, nên adapter gọi thẳng API Algolia bằng cặp khoá search-only mà trang của họ nhúng công khai. Hệ quả:

- Khoá **có thể bị đổi bất cứ lúc nào** → adapter chết ngay lập tức. Dấu hiệu: `adapter_runs` ghi HTTP 401/403 kèm ghi chú trong thông báo lỗi.
- Việc này **tiêu vào hạn mức Algolia trả phí của Invaluable**, không phải của ta. Đó là lý do giãn cách để 10s và nên giữ số từ khóa thấp.
- Khi bị chặn: **tắt nguồn ở `/admin/sources`**, đừng đi sửa parser. Có thể đặt khoá mới qua `INVALUABLE_ALGOLIA_APP_ID` / `INVALUABLE_ALGOLIA_API_KEY` / `INVALUABLE_ALGOLIA_INDEX` nếu tìm được, nhưng hãy coi đó là dấu hiệu nên cân nhắc bỏ nguồn này.

**Dữ liệu cá nhân:** phản hồi Algolia của Invaluable kèm `watched` / `watchedRefs` — danh sách ID người dùng của họ đang theo dõi lot. Adapter **loại bỏ các trường này ngay tại tầng parse**; chúng không bao giờ chạm tới DB. Có test khoá hành vi này (`parse.test.ts`). Đừng gỡ bỏ nó.

**Số lot mỗi trang chênh nhau nhiều** (100 / 40 / 24), nên `pages_per_search` cho độ phủ rất khác nhau giữa các nguồn: 2 trang = 200 món ở HiBid nhưng chỉ 48 ở LiveAuctioneers. Nếu thấy LiveAuctioneers hay bị gắn "còn nữa, chưa lấy hết", đó là lý do.

## Không còn trần theo ngày — cái gì đang giữ nhịp?

Trần `daily_page_budget` đã được bỏ. Nó ra đời khi kế hoạch còn giả định phải dùng proxy trả tiền theo GB; sau khi cả ba adapter chạy bằng `fetch` thường thì mỗi request **không tốn đồng nào**, nên trần đó chỉ còn là thứ gây phiền.

Thứ thật sự giới hạn việc gọi nguồn là **giãn cách theo từng nguồn** (`sources.min_request_interval_ms`): HiBid 2s, LiveAuctioneers 5s, Invaluable 10s, cộng nhiễu ngẫu nhiên ±50%. Đây là trần cứng về **nhịp**, và nó áp cho cả tiến trình chứ không phải từng job.

Muốn siết lại thì sửa thẳng trong DB:

```sql
update sources set min_request_interval_ms = 15000 where id = 'invaluable';
```

Vẫn theo dõi khối lượng được: cột **Trang** trong bảng "Lần chạy gần đây" ở `/admin/sources` ghi số request thật mỗi lần chạy. Nếu thấy con số tăng bất thường, đó là dấu hiệu có vòng lặp hỏng — hãy tắt nguồn và xem lại.

## Quy đổi tiền tệ

Tỷ giá lấy từ `open.er-api.com` (công khai, không cần key, 166 loại tiền **kể cả VND** — ECB/frankfurter không có VND). Job bảo trì làm mới mỗi 6 giờ; chạy tay bằng `npm run -w @bid/worker fx`.

Hai nguyên tắc:

1. **Giá gốc luôn là giá chính.** Quy đổi chỉ hiện thêm dòng `≈` bên dưới, vì số tiền thực phải trả là số tiền gốc.
2. **Thiếu tỷ giá thì không hiện gì**, không bao giờ đoán. Hiện một con số quy đổi sai cho người đang quyết định trả bao nhiêu còn tệ hơn là không hiện.

Mã tiền tệ trong dữ liệu thật có rác — HiBid trả về cả `CDN`, `Can`, `CAN` cho đô la Canada vì nhà đấu giá tự gõ. `normalizeCurrency()` xử lý ở tầng upsert; gặp mã lạ mới thì thêm vào bảng alias trong `packages/db/src/currency.ts`.

## Giới hạn đã biết (đừng báo nhầm thành bug)

- **~10% lot thiếu tiền tệ và giờ kết thúc.** Trang tìm kiếm của HiBid không kèm đủ dữ liệu Auction cho mọi lot. Khắc phục triệt để cần fetch từng lot riêng, tức nhân số request lên hàng chục lần. Xem `docs/SPIKE-hibid.md`.
- **Chưa gộp trùng giữa các sàn.** LiveAuctioneers và Invaluable cùng bán catalog của nhiều nhà đấu giá giống nhau, nên một món có thể hiện 2 lần. Đã hoãn có chủ ý; làm khi thấy phiền thật.
- **Chưa xếp hạng chéo nguồn.** Thứ tự hiện tại là tất định (hạng trong nguồn → tên nguồn → id) nhưng không phải "liên quan nhất trước". Hoãn có chủ ý.
- **Chưa có saved search và email digest.** Thuộc v1.5, làm sau khi đội dùng thật 2 tuần.
- **Đăng nhập chưa giới hạn số lần thử.** Thời gian phản hồi đã được làm phẳng nên không lộ email nào là tài khoản thật, nhưng không có khoá tạm sau nhiều lần sai. Mật khẩu yếu vẫn đoán được qua nhiều ngày — đặt mật khẩu mạnh cho mọi tài khoản, và thêm giới hạn trước khi hệ thống chứa thứ gì đáng mất.

## Chi phí thật, dài hạn

Không phải tiền máy chủ mà là **công bảo trì: ~2–8 giờ/tháng cho mỗi adapter**, vô thời hạn. Mỗi lần sàn đổi giao diện là adapter hỏng. Trước khi thêm nguồn mới, hỏi: đội có thực sự cần sàn này không, đủ để trả cái giá đó mãi mãi?

## Cổng trước khi làm tiếp v1.5

Plan yêu cầu **dùng thật 2 tuần** rồi mới làm saved search + digest. Tiêu chí đi tiếp: số lần đội vẫn phải tự vào HiBid tìm tay **giảm rõ rệt**. Không giảm thì vấn đề nằm ở chỗ khác, thêm tính năng không cứu được.
