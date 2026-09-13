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
| `chạm trần ngân sách` | Đã dùng hết `daily_page_budget` | Tăng trần ở `/admin/settings`, hoặc giảm số saved search |

Admin cũng nhận email cho mọi trạng thái khác `ổn` (cần `RESEND_API_KEY`; chưa có thì chỉ ghi log — **nghĩa là trên production bắt buộc phải cấu hình**).

## Kiểm tra recall hàng tháng — đừng bỏ

Chế độ hỏng nguy hiểm nhất **không phải** hệ thống sập, mà là nó âm thầm thu thập thiếu. Đội vẫn thấy kết quả, tin là đủ, và bỏ lỡ hàng.

Mỗi tháng, với 3 từ khóa đội hay dùng:

1. Tìm trực tiếp trên hibid.com, đếm số kết quả.
2. Tìm cùng từ khóa trên portal, đếm số kết quả.
3. Lệch quá ~10% → điều tra adapter.

Ghi lại kết quả vào đây:

| Ngày | Từ khóa | HiBid | Portal | Ghi chú |
|---|---|---|---|---|
| | | | | |

## Giới hạn đã biết (đừng báo nhầm thành bug)

- **~10% lot thiếu tiền tệ và giờ kết thúc.** Trang tìm kiếm của HiBid không kèm đủ dữ liệu Auction cho mọi lot. Khắc phục triệt để cần fetch từng lot riêng, tức nổ ngân sách request. Xem `docs/SPIKE-hibid.md`.
- **Chưa quy đổi tiền tệ.** Kết quả có cả USD và CAD, hiển thị nguyên tệ. So sánh giữa hai loại tiền là việc của người xem. FX thuộc v2.
- **Chưa gộp trùng giữa các sàn.** Chỉ có một nguồn nên chưa cần; thuộc v2 khi thêm LiveAuctioneers/Invaluable.
- **Chưa có saved search và email digest.** Thuộc v1.5, làm sau khi đội dùng thật 2 tuần.

## Chi phí thật, dài hạn

Không phải tiền máy chủ mà là **công bảo trì: ~2–8 giờ/tháng cho mỗi adapter**, vô thời hạn. Mỗi lần sàn đổi giao diện là adapter hỏng. Trước khi thêm nguồn mới, hỏi: đội có thực sự cần sàn này không, đủ để trả cái giá đó mãi mãi?

## Cổng trước khi làm tiếp v1.5

Plan yêu cầu **dùng thật 2 tuần** rồi mới làm saved search + digest. Tiêu chí đi tiếp: số lần đội vẫn phải tự vào HiBid tìm tay **giảm rõ rệt**. Không giảm thì vấn đề nằm ở chỗ khác, thêm tính năng không cứu được.
